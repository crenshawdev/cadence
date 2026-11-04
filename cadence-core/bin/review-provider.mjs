#!/usr/bin/env node
// Cadence cross-model review/detect provider, zero-dependency Node, and the only place a direct provider HTTPS call happens. Three jobs: review (a structured critique of an artifact), consult (angles to try when stuck, hypotheses and never a decision) and detect-models (the model ids the key can reach)
// Structured output is enforced by the provider and never scraped, except DeepSeek, whose only mode is json_object, so its adapter injects the schema into the prompt. Either way the shape is asserted on return, so a schema-ignoring model degrades to bad-shape and never to bad data
// Keys resolve from the environment first, then a shared env file whose mode is checked (a group- or world-readable file warns on the envelope and never refuses). A missing key is {ok:false, reason:"no-key"} so the caller falls back to claude-subagent, and any failure degrades to a structured {ok:false, reason, detail} with a nonzero exit instead of crashing the spine
// review and consult are the paid commands, so both are capped by review.max_prompt_tokens (chars/4, default 120000): over the cap is refused as over-cap before any request and never truncated or merely warned about. A non-string payload field is bad-payload first, because an unmeasurable field is an unbounded one
// Every outbound string field crosses fence() (redactUrl composed with redactCredentials) after the shape gate and before the cap, so what's measured is what's sent. It works by shape and not by a prefix list, so it lowers exposure and doesn't make a payload safe to fill with secrets. The redaction count rides the ok envelope and the trace event, because a reviewer reading <redacted> saw less than the caller composed
// The response is bounded by bytes too: past MAX_RESPONSE_BYTES the request is destroyed and degrades to over-response. An http failure's detail.body is always a string, redacted and capped at 1024 bytes by redactAndCap
//
// Usage:
//   review-provider.mjs review  --provider <openai|gemini|deepseek> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>] [--trigger <name>]
//       payload (stdin/file): {instruction, artifact} -> {ok, findings[]}
//       --trigger names the review trigger this call was fired for and rides the provider trace event, so the call joins to its fire by the correlation id both derive. Optional: without it the event is unchanged.
//   review-provider.mjs consult --provider <openai|gemini|deepseek> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>]
//       payload (stdin/file): {situation} -> {ok, angles[]}  (dead-end help)
//   review-provider.mjs detect-models --provider <openai|gemini|deepseek> [--key-file <path>]
// --key-file overrides the shared env-file path (config review.key_file); an
// env-set key still wins over it. Omitted -> the XDG default.
// The review payload (JSON, from --payload file or stdin) is:
//   { "instruction": "<what to critique and how>",
//     "artifact": "<the plan / diff / files to review>" }
//
// mergeLayers warnings[]: the one surfacing here is reviewConfig(), which puts the count of the .planning/config.json layer's warnings on the provider trace event as config_warnings, only when there is one and only on an event that gets written at all (no .planning cursor, no event)
// requestTimeoutMs and maxPromptTokens cache a bare number and discard the config object, so there's nothing at those two reads to surface: a torn layer costs them a default, and the trace beside the request already shows the layer was torn
// the caller sees the seam's own {ok:false, reason} envelope and no config warning changes which reason that is
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { DONE, emit } from './lib/seam-io.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
import { measure } from './lib/surface-weight.mjs';
import { appendEvent } from './lib/trace.mjs';
import { cursorPhase } from './lib/phase-plans.mjs';
import { redactUrl, redactCredentials, redactAndCap, REDACTION_MARK } from './lib/redact-url.mjs';
import { evaluateFlag, CONTRACTS } from './lib/arg-contract.mjs';
import { isModelId } from './lib/model-id.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// everything the caller reads is one JSON object on stdout, so the adjudicator parses one blob and never scrapes stderr
function ok(obj) { emit({ ok: true, ...obj }); throw DONE; }

// the subject of the provider trace event for the running call, set first thing in each command and read by fail(). It's module-level because fail() is reached from sites that never see the command's locals, and the pre-request refusals (no-key, bad-payload, over-cap) are the drop-outs that fire most. null means no command has begun, so fail('bad-command') from main records nothing by construction
/** @type {{command: string, provider: any, model: any, effort: any,
 *   trigger?: any, started: number, redactions?: number,
 *   usage?: ProviderUsage}|null} */
let activeMeta = null;

// one trace event per call, whichever site records first: the explicit traceProvider calls in callStructured and at the bad-shape sites carry better detail than fail() would, so they set this and fail() adds nothing
let traceRecorded = false;

/**
 * Open the trace bracket for one command, before anything can refuse. Returns the meta so each command's traceProvider calls keep taking it as an argument and not module state.
 * @param {string} command
 * @param {{provider: any, model: any, effort: any, trigger?: any}} subject
 */
function beginProviderCall(command, subject) {
  activeMeta = { command, ...subject, started: Date.now() };
  traceRecorded = false;
  return activeMeta;
}

// hint rides as a conditional key, so an absent one adds no key. It stays out of traceProvider on purpose: a hint is advice for whoever's at the terminal, not a fact about what happened
function fail(reason, detail, hint) {
  // trace first, then emit: traceProvider never throws or speaks, so the caller reads the same thing either way
  if (activeMeta && !traceRecorded) {
    // detail is a string everywhere except http, whose object would render [object Object], and that site records itself first
    traceProvider(activeMeta, reason, typeof detail === 'string' && detail ? detail : reason);
  }
  emit({ ok: false, reason, detail: detail || null, ...(hint ? { hint } : {}) });
  throw DONE;
}

// ok and fail throw the DONE sentinel to unwind the command and the entry point swallows it. Anything else thrown is a bug, and these handlers turn it into {ok:false,reason:"internal"} instead of a raw stack
process.on('unhandledRejection', (/** @type {any} */ e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});
process.on('uncaughtException', (/** @type {any} */ e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});

// each declared flag is read through its row in lib/arg-contract.mjs, after a leading subcommand
// the loop this replaced did opts[a.slice(2)] = rest[i + 1] with no flag-shape test, so a valueless flag ate the next one: `consult --payload --provider openai` came back bad-provider "unknown provider: undefined", blaming a flag the caller did pass
// only a flag that's present with a missing, empty or flag-shaped value is refused here. An absent one isn't, even when its row says required, because resolveProvider owns that wording and references/seams.md publishes both
// pure on purpose: it's exported and the tests import it, so it emits and throws nothing. A refusal rides back as badArg and main renders it as bad-args, since the contract mints no reason code

/** What each flag needs after it, in this bin's own wording. */
const NEEDS = {
  '--provider': 'a provider name after it: --provider <openai|gemini|deepseek>',
  '--model': 'a model id after it: --model <id>',
  '--effort': 'a reasoning effort after it: --effort <name>',
  '--payload': 'a payload file after it: --payload <file> (or omit it for stdin)',
  '--trigger': 'a trigger name after it: --trigger <name>',
  '--key-file': 'a path after it: --key-file <env file>',
};

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = {};
  const script = CONTRACTS['review-provider.mjs'];
  // the subcommand's own row plus the script-global one. An unrecognised subcommand declares nothing and main answers bad-command
  const rows = { ...(script[cmd] || {}), ...script['*'] };
  let badArg;
  for (const flag of Object.keys(rows)) {
    if (!rest.includes(flag)) continue;
    const parsed = evaluateFlag(rest, flag, rows[flag]);
    if (!parsed.ok) { badArg = `${cmd} ${flag} needs ${NEEDS[flag]}`; break; }
    if (parsed.value !== undefined) opts[flag.slice(2)] = parsed.value;
  }
  return { cmd, opts, ...(badArg ? { badArg } : {}) };
}

// env var first, then one shared env file at ${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env. Config stores only the path, never the value
const ENV_VAR = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', deepseek: 'DEEPSEEK_API_KEY' };

function providersEnvPath(override) {
  if (override) return override.replace(/^~(?=\/|$)/, os.homedir());
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'cadence', 'providers.env');
}

// dotenv-style: KEY=VALUE per line, # comments, optional quotes, a leading `export `. Tiny on purpose
/** @param {string} text @returns {Record<string, string>} */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// a key from the file with group or other read bits set is readable by other local users: said on the envelope and never refused. An env-supplied key never gets here, win32 has no such bits, and a stat failure adds nothing since the read above it worked
/** @param {string} file @returns {string[]} */
function keyFileWarnings(file) {
  if (process.platform === 'win32') return [];
  try {
    const mode = fs.statSync(file).mode & 0o777;
    if (!(mode & 0o044)) return [];
    return [`${file} is mode ${mode.toString(8).padStart(4, '0')}, readable by other users and it holds an API key - restrict it to its owner: chmod 600 ${file}`];
  } catch { return []; }
}

function resolveKey(provider, keyFile) {
  const name = ENV_VAR[provider];
  if (process.env[name]) return { key: process.env[name], source: 'env', warnings: [] };
  const file = providersEnvPath(keyFile);
  try {
    const parsed = parseEnvFile(fs.readFileSync(file, 'utf8'));
    if (parsed[name]) return { key: parsed[name], source: 'file', warnings: keyFileWarnings(file) };
  } catch { /* file absent/unreadable -> treated as no-key below */ }
  return { key: null, where: `env $${name} or ${file}`, warnings: [] };
}

// node's timeout is a socket inactivity timeout and a provider response isn't streamed, so this effectively caps total thinking time. 120000 was below what a high-effort review costs (292s on a flagship model), which silently dropped cross-model reviewers from the blocking gates
// the Bash tool that runs this caps a command at 600000ms, so that's the max and the default sits a minute under: if the host kills us we print nothing, which is worse than the {ok:false, reason:"transport"} we owe the caller. The host default is only 120000, so the caller must pass an explicit Bash timeout (references/review-triggers.md)
const DEFAULT_REQUEST_TIMEOUT_MS = 540000;
const MAX_REQUEST_TIMEOUT_MS = 600000;

// the prompt-token cap for the two paid commands. The free claude-subagent reviewer never runs this script, so it's exempt by construction
// 120000 because DeepSeek's ~128k window is the tightest of the three providers, and chars/4 is an estimate and not a tokenizer, so the margin is deliberate
const DEFAULT_MAX_PROMPT_TOKENS = 120000;

// the response byte ceiling, the other side of the prompt cap: nothing bounded what we hold, so a proxy error page or a runaway answer was concatenated whole and only the host's command timeout stopped it
// 4 MiB is about 8.7x the largest payload this seam sends (480000 chars) and about 8x the largest response local validation accepts (~0.5 MB). A body past it is something else wearing a 200
// not a config key: a knob nothing needs is just surface to maintain
const MAX_RESPONSE_BYTES = 4194304;

// tags a ceiling crossing so the two catch arms can tell it from an ordinary socket error. A symbol and never a match on the message, because a diagnostic string that decides control flow is a parser
const OVER_RESPONSE = Symbol('cadence-over-response');

// pure so the unit tests can call it without config or network. Anything unusable falls back to the default and never throws, since a bad timeout must not sink a review
// an oversized value is clamped, not rejected: node keeps a socket timeout in a 32-bit signed int, so past 2147483647 it truncates and the timer never fires, and a black-hole connection would hang ~24.8 days. The schema only enforces min, so an extra zero on request_timeout_ms validates clean and the bound has to live here
export function resolveTimeoutMs(configured) {
  if (!Number.isInteger(configured) || configured <= 0) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(configured, MAX_REQUEST_TIMEOUT_MS);
}

// lazy and memoized because review-provider.test.mjs imports the pure helpers, and a module-level read would do config I/O inside unit tests. A broken config layer degrades to the default
let timeoutCache = null;
function requestTimeoutMs() {
  if (timeoutCache === null) {
    let configured;
    try {
      const { config } = mergeLayers('.planning/config.json');
      configured = config && config.review ? config.review.request_timeout_ms : undefined;
    } catch { configured = undefined; }
    timeoutCache = resolveTimeoutMs(configured);
  }
  return timeoutCache;
}

// same pure/lazy split and degrade-never-crash rule as the timeout, but not clamped from above: there's no host ceiling to overflow, and a user who raises the cap made that call in writing
export function resolveMaxPromptTokens(configured) {
  if (!Number.isInteger(configured) || configured <= 0) return DEFAULT_MAX_PROMPT_TOKENS;
  return configured;
}

let maxPromptCache = null;
function maxPromptTokens() {
  if (maxPromptCache === null) {
    let configured;
    try {
      const { config } = mergeLayers('.planning/config.json');
      configured = config && config.review ? config.review.max_prompt_tokens : undefined;
    } catch { configured = undefined; }
    maxPromptCache = resolveMaxPromptTokens(configured);
  }
  return maxPromptCache;
}

// the repo's chars/4 proxy: zero deps rules out a real tokenizer, and the ask was a token cap so a byte key would rename it
// only the payload is measured, since the adapters' schema-injection bytes are a small per-provider constant and counting them would make one payload cap differently per provider
// the non-string filter is a safety net and not the type gate: a non-string part measures as nothing, so a {blob: <480KB>} artifact would clear the cap and still be serialized into the request. Both callers refuse non-strings as bad-payload first
export function estimatePromptTokens(...parts) {
  return measure(parts.filter((p) => typeof p === 'string').join('')).estTokens;
}

// the outbound secret fence (#167): the payload is raw repository contents and leaves the machine for a third party, so every byte crosses this first
// composed and not reimplemented: neither redact-url export is a superset of the other, and a security regex duplicated across sites is how the copies drift. Widen the fence in that file, not here
// it works by shape (a credential-shaped name beside its value, userinfo in a URL, an authorization echo) and never by a prefix list, so a bare Anthropic key with no name beside it isn't caught. That lowers exposure; it doesn't license sending a secrets file to a reviewer
// the count comes back with the text because a fenced payload is smaller than what the caller composed, and the envelope and the run record both have to be able to say so
// the count is a lower bound: marks added isn't spans removed, since a credential span can collapse onto an existing `<redacted>` and net to 0 or less on an altered payload. So the change is decided by comparing the strings and the count floors at 1, because a count that can under-state by a mark beats a zero that can be false
/**
 * @param {string} s @returns {{text: string, redactions: number}}
 */
function fence(s) {
  const text = redactCredentials(redactUrl(s));
  if (text === s) return { text, redactions: 0 };
  const net = occurrences(text, REDACTION_MARK) - occurrences(s, REDACTION_MARK);
  return { text, redactions: net > 0 ? net : 1 };
}

// counted with indexOf from a moving offset: split().length - 1 would allocate a copy of an artifact that may be the whole cap
/** @param {string} hay @param {string} needle @returns {number} */
function occurrences(hay, needle) {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n += 1;
  return n;
}

// the refusal both paid commands share, before any request. Truncating still pays the provider and reviews a fragment as though it saw the whole, which is worse than the bill, and warn-and-send changes no outcome
// the caller already handles any {ok:false} (references/review-triggers.md: name the reason, drop the reviewer, fall back if the set empties)
function assertUnderCap(...parts) {
  const est = estimatePromptTokens(...parts);
  const cap = maxPromptTokens();
  if (est > cap) {
    fail('over-cap', `payload is ~${est} estimated tokens, over review.max_prompt_tokens (${cap})`,
      'send this reviewer less - a narrower diff or one file rather than the whole range - or raise review.max_prompt_tokens for this repo, then re-run');
  }
}

// the provider family of the joined run record (.planning/trace.jsonl). A reviewer that drops out of a fired trigger has to be named, and the prose mandate for that line failed twice, so the seam records the degradation itself
// the record brackets a call and not a request: the first form only recorded what happened past request(), so the five drop-outs that need no network (no-key, bad-provider, bad-args, bad-payload, over-cap) wrote nothing and a panel that silently shrank read as one that was always that size. fail() closes that, and activeMeta is why it can

// the repo+global config, read once per process and bound with its warnings
// mergeLayers warnings[]: a torn config layer is why a tier reverse lookup can come back null and the timeout and cap fall back to defaults, so how many warnings there were rides the provider trace event as config_warnings (a count, only when non-zero) and not dropped
// its own read on purpose: the two memoized helpers above cache a number and discard the config object, so there's nothing there to take one off
let reviewConfigCache = null;
function reviewConfig() {
  if (reviewConfigCache === null) {
    try {
      const { config, warnings } = mergeLayers('.planning/config.json');
      reviewConfigCache = {
        config: config && typeof config === 'object' ? config : {},
        warnings: Array.isArray(warnings) ? warnings : [],
      };
    } catch {
      reviewConfigCache = { config: {}, warnings: [] };
    }
  }
  return reviewConfigCache;
}

/**
 * The trigger tier this model id was resolved from, by reverse lookup over `review.providers.<name>.tiers`. The seam is never told the tier (the caller resolves `tiers[trigger.tier]` and passes only --model), and a --tier flag would change the CLI contract at every prose callsite.
 * `null` when no tier has this value, which is a hand-passed model or detect-models. Never a guess.
 * @param {any} provider @param {any} model @returns {string|null}
 */
function tierOf(provider, model) {
  if (typeof provider !== 'string' || typeof model !== 'string' || !model) return null;
  const { config } = reviewConfig();
  const review = config.review;
  const providers = review && typeof review === 'object' ? review.providers : null;
  const spec = providers && typeof providers === 'object' ? providers[provider] : null;
  const tiers = spec && typeof spec === 'object' ? spec.tiers : null;
  if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) return null;
  for (const [tier, id] of Object.entries(tiers)) if (id === model) return tier;
  return null;
}

/**
 * Record one `provider`/`request` event. `detail` is what makes it a degradation: present means this reviewer dropped out and the panel is smaller than the trigger asked for. An empty findings set isn't one, since a reviewer that found nothing must not be recorded as a drop-out.
 *
 * Never throws, never writes to a stream, never touches the caller's envelope.
 * @param {{command: string, provider: any, model: any, effort: any,
 *   trigger?: any, started: number, redactions?: number,
 *   usage?: ProviderUsage}} meta
 * @param {string} outcome the fail() reason, or 'ok'
 * @param {string} [detail]
 */
function traceProvider(meta, outcome, detail) {
  // marked before the attempt, not after: one event per call, so a write we couldn't complete mustn't license a second attempt from fail() with a poorer detail string
  traceRecorded = true;
  try {
    const root = '.planning';
    const phase = cursorPhase(root);
    // no cursor means no phase, an event keyed to none joins nothing and its id would be empty, so record nothing
    if (phase === null) return;
    const { warnings } = reviewConfig();
    appendEvent(root, {
      phase,
      family: 'provider',
      event: 'request',
      command: meta.command,
      provider: typeof meta.provider === 'string' ? meta.provider : null,
      model: typeof meta.model === 'string' ? meta.model : null,
      effort: typeof meta.effort === 'string' ? meta.effort : null,
      // which trigger fired this call, so a cross-model review and a subagent review of the same phase aren't one shape in the record. Absent when the caller named none, and never a second event: a duplicate would double-count every cross-model review in renderTrace's counts.provider
      ...(typeof meta.trigger === 'string' && meta.trigger.trim()
        ? { trigger: meta.trigger.trim() } : {}),
      tier: tierOf(meta.provider, meta.model),
      duration_ms: Date.now() - meta.started,
      outcome,
      ...(detail ? { degraded: true, detail: String(detail).slice(0, 200) } : {}),
      ...(warnings.length ? { config_warnings: warnings.length } : {}),
      // how many spans the outbound fence removed, only when it removed any, so a call over a clean artifact writes the event it always did. A count and never the spans: those bytes stop here, and a record carrying them would be the leak itself
      ...(typeof meta.redactions === 'number' && meta.redactions > 0
        ? { redactions: meta.redactions } : {}),
      // what the provider says the call cost, written only when real: a response with no usage writes neither key, so older events read as cost unknown and not zero. usage is the normalized input/output pair and usage_raw the provider's own object, a different denomination from the host's token total and never summed with it
      ...(meta.usage ? { usage: meta.usage.normalized } : {}),
      ...(meta.usage && meta.usage.raw !== undefined
        ? { usage_raw: meta.usage.raw } : {}),
    });
  } catch { /* a record of a call may never change the call */ }
}

// the transport reference, and the one test seam that moves it. Every failure we degrade on (timeout, HTTP status, truncated body, no output) lives past the call, so tests need a stand-in for the wire: a module-private reference they replace by importing this module
// there is deliberately no env var, flag or config key that redirects it. The request carries the provider key in an authorization header, so an out-of-process switch on the destination is a credential-read primitive: one attacker-settable variable (a .envrc in a cloned repo, a devcontainer env block) would hand the user's real key to a listener of the attacker's choosing, and loopback isn't a privilege boundary since any local process that binds the port first gets it
// untouched, transport is HTTPS_TRANSPORT for the life of the process and the three adapter bases stay hardcoded https: URLs

// typed at the wire types and not any: req is a real ClientRequest, so a misspelled listener stays a tsc error, and a loose return would silently un-check all six req.* uses in request()
/**
 * @typedef {(
 *   url: URL,
 *   options: import('node:https').RequestOptions,
 *   cb: (res: import('node:http').IncomingMessage) => void
 * ) => import('node:http').ClientRequest} Transport
 */

/** @type {Transport} */
const HTTPS_TRANSPORT = (url, options, cb) => https.request(url, options, cb);

/** @type {Transport} */
let transport = HTTPS_TRANSPORT;

/**
 * TEST-ONLY. Replace the transport for the current process. Only review-provider.test.mjs calls it, to drive the six failure modes with no socket.
 * Pass `null` (or call the returned restore) to put `node:https` back.
 * @param {Transport|null} fn
 * @returns {() => void} restore
 */
export function __setTransportForTests(fn) {
  transport = typeof fn === 'function' ? fn : HTTPS_TRANSPORT;
  return () => { transport = HTTPS_TRANSPORT; };
}

function request(urlStr, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payload = body == null ? null : JSON.stringify(body);
    const timeoutMs = requestTimeoutMs();
    const req = transport(url, {
      method,
      timeout: timeoutMs,
      headers: {
        ...headers,
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      let bytes = 0;
      res.on('data', (c) => {
        // count real bytes, not string length: no encoding is set on res, so a chunk is a Buffer in production and a string in the fake, and Buffer.byteLength is right for both. Counted before the append so the ceiling bounds what we hold
        bytes += Buffer.byteLength(c);
        if (bytes > MAX_RESPONSE_BYTES) {
          // the same abort the timeout handler uses: it forces an 'error' so the promise rejects down the path the callers already handle, and it stops the wire
          req.destroy(Object.assign(
            new Error(`response body over ${MAX_RESPONSE_BYTES} bytes (read ${bytes})`),
            { [OVER_RESPONSE]: true },
          ));
          return;
        }
        data += c;
      });
      // an aborted response emits its own 'error', and without this listener that's unhandled and the ceiling would crash the process instead of degrading to over-response. reject is first-wins
      res.on('error', reject);
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* leave null; caller inspects status */ }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    // 'timeout' fires on inactivity but doesn't abort, so destroy to force an 'error' down the transport path
    req.on('timeout', () => req.destroy(new Error(`request timed out after ${timeoutMs}ms`)));
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * The one mapping from a rejected request() to its degradation reason, shared by both callers so a third read path can't be left knowing only `transport`. A rejection the response ceiling tagged is `over-response`; anything else is a socket failure and stays `transport`.
 * They're distinct because riding `transport` would leave the trace, the caller and workflows/config-review.md unable to tell a provider that flooded us (not a review) from a socket that died (worth a retry).
 * Never returns in practice: fail throws DONE.
 * @param {any} meta @param {any} e
 */
function failRequest(meta, e) {
  const over = !!(e && e[OVER_RESPONSE]);
  const reason = over ? 'over-response' : 'transport';
  traceProvider(meta, reason, e.message);
  // the hint splits where the two words split: one condition is retryable, the other says this provider returns something that isn't a review, and one sentence covering both would name neither recovery
  fail(reason, e.message, over
    ? 'this provider sent back more than the seam will read - ask it for less (a smaller artifact, or a lower effort), or name a different model for this reviewer, then re-run'
    : 'check the network reaches this provider and re-run - a transport failure is worth one retry, and one that repeats on a slow model wants review.request_timeout_ms raised');
}

/**
 * The next step for an `http` refusal, written once because both request-issuing commands reach it. It turns the status into an action: the status says which of three things is wrong, and a caller who can't map 401 to "the key" is who this is for.
 */
const HTTP_HINT = 'the provider refused the request: 401 or 403 means the key, '
  + '404 means the model id, 429 or a 5xx is worth re-running in a minute';

/**
 * The `body` of every `http` failure envelope: a sanitized, capped string.
 * A delegate to `redactAndCap` in lib/redact-url.mjs, where the design lives. It keeps its name and export because review-provider.test.mjs reads it off the namespace import, and git-publish.mjs shares the same helper for its push-failed detail.
 * @param {unknown} raw @returns {string}
 */
export function bodyExcerpt(raw) {
  return redactAndCap(raw);
}

// the normalized finding shape every adapter must return, in one place so the schema we send and the shape we assert can't drift
const SEVERITY = ['blocker', 'high', 'medium', 'low'];

// bounds sized against what this tree has produced and not picked round: the longest observed file is 39 chars, claim 159 and failure_scenario 376, and the largest `raised` count in the adjudication events is 9 (from a panel). Each bound sits an order of magnitude above that, and their product caps what validation accepts near 0.5 MB, well inside the 4 MiB response ceiling
// no minItems on purpose: an empty findings array is what a reviewer that found nothing returns, and refusing it would turn a clean review into bad-shape
const MIN_LINE = 1;
const MAX_FILE_CHARS = 1024;
const MAX_TEXT_CHARS = 2000;
const MAX_FINDINGS = 100;
const FINDING_KEYS = ['file', 'line', 'severity', 'claim', 'failure_scenario'];

export const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      maxItems: MAX_FINDINGS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: FINDING_KEYS,
        properties: {
          file: { type: 'string', minLength: 1, maxLength: MAX_FILE_CHARS },
          line: { type: 'integer', minimum: MIN_LINE },
          severity: { type: 'string', enum: SEVERITY },
          claim: { type: 'string', minLength: 1, maxLength: MAX_TEXT_CHARS },
          failure_scenario: { type: 'string', minLength: 1, maxLength: MAX_TEXT_CHARS },
        },
      },
    },
  },
};

// consult is a different job: "the engineer is stuck, what would you try?". It returns angles to investigate and never a decision; the main model grounds each one and the user decides
// a reply past these bounds is refused and never truncated. Gemini drops maxItems through stripForGemini and keeps maxLength
const MAX_ANGLES = 10;
const CONSULT_KEYS = ['hypothesis', 'rationale', 'how_to_check'];
const CONSULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angles'],
  properties: {
    angles: {
      type: 'array',
      maxItems: MAX_ANGLES,
      items: {
        type: 'object',
        additionalProperties: false,
        required: CONSULT_KEYS,
        properties: {
          hypothesis: { type: 'string', maxLength: MAX_TEXT_CHARS },
          rationale: { type: 'string', maxLength: MAX_TEXT_CHARS },
          how_to_check: { type: 'string', maxLength: MAX_TEXT_CHARS },
        },
      },
    },
  },
};

// deep-copy a JSON schema into Gemini's dialect, with every GEMINI_STRIPPED key removed at every depth. OpenAI strict mode requires additionalProperties and Gemini's responseSchema rejects it. Gemini also refuses a large maxItems on an array of objects with a bare 400 "Request contains an invalid argument" (FINDING_SCHEMA's 100 failed on gemini-3.5-flash-lite and gemini-3.1-pro-preview, and on flash-lite 50 failed and 20 passed), so validateFindings enforces the cap instead
const GEMINI_STRIPPED = new Set(['additionalProperties', 'maxItems']);

/** @param {any} node @returns {any} */
export function stripForGemini(node) {
  if (Array.isArray(node)) return node.map(stripForGemini);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (GEMINI_STRIPPED.has(k)) continue;
      out[k] = stripForGemini(v);
    }
    return out;
  }
  return node;
}

// what the provider says the call cost. It's a different denomination from the host's roles.tokens, a final-window proxy the host measures, and summing the two would denominate the reviewer's tokens in nothing, so it stops at the provider/request event
// usage and usage_raw are written together, and neither when the response carried no usage, never a zero that older events would read as. usage is the normalized pair to sum across a mixed panel; usage_raw is the provider's own object, so an auditor can join it to the wire response untranslated

// the bound on usage_raw. A provider chose those bytes and the event lands in a record capped at MAX_TRACE_BYTES (1 MiB), so an unbounded copy would let one hostile or broken response rotate the history away on every append. Over it the normalized pair still rides and the raw object drops
const MAX_USAGE_RAW_CHARS = 2048;

/**
 * One token count, or `undefined` where the provider sent something that is not
 * one. Negative is refused with non-numeric: a count below zero is not a count.
 * @param {any} v @returns {number|undefined}
 */
function tokenCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/**
 * @typedef {{normalized: {input?: number, output?: number}, raw?: any}} ProviderUsage
 */

/**
 * Build the usage an adapter read into the shape the event carries, or undefined when there is nothing real to record, which is what makes the two keys absent and not zero.
 * @param {any} usage the provider's own usage object, as returned
 * @param {any} input @param {any} output
 * @returns {ProviderUsage|undefined}
 */
function usageOf(usage, input, output) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return undefined;
  const i = tokenCount(input);
  const o = tokenCount(output);
  if (i === undefined && o === undefined) return undefined;
  let raw;
  try {
    const rendered = JSON.stringify(usage);
    // two gates, and the raw object rides only past both. The size bound comes first so the fence never runs on more than MAX_USAGE_RAW_CHARS characters
    // the second is the same fence the outbound payload crosses, read for its verdict: a hostile gateway answering 200 with {"input_tokens":10,"api_key":"<a live key>"} would otherwise land a credential in .planning/trace.jsonl for good, and the outbound fence can't see it because it only runs on what leaves
    // dropped whole and not kept fenced: the credential rule removes the name with its value so the fenced text is no longer JSON, and a credential-shaped span in a usage object means it isn't usage and can't be trusted. The normalized pair is numbers alone, so it still rides
    if (typeof rendered === 'string' && rendered.length <= MAX_USAGE_RAW_CHARS
      && fence(rendered).redactions === 0) raw = usage;
  } catch { /* unserializable (a cycle, a BigInt): the normalized pair still rides */ }
  return {
    normalized: {
      ...(i !== undefined ? { input: i } : {}),
      ...(o !== undefined ? { output: o } : {}),
    },
    ...(raw !== undefined ? { raw } : {}),
  };
}

// provider adapters: the only provider-specific bytes live here (endpoint, auth, request builders, response extractors). Wire details are pinned in references/provider-api.md, so update both together if a provider changes its API
export const ADAPTERS = {
  openai: {
    // OpenAI Responses API. reasoning.effort is a first-class per-call param.
    base: 'https://api.openai.com',
    authHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    // one structured-output call shared by review and consult, only the schema and prompt differ
    structuredRequest({ model, effort, system, user, schema, schemaName }) {
      const body = {
        model,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        text: {
          format: { type: 'json_schema', name: schemaName, strict: true, schema },
        },
      };
      if (effort) body.reasoning = { effort };
      return { path: '/v1/responses', method: 'POST', body };
    },
    // the text is in output_text or in the assistant message content depending on version, so handle both
    extractText(json) {
      let text = json.output_text;
      if (!text && Array.isArray(json.output)) {
        for (const item of json.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === 'output_text' && typeof c.text === 'string') text = c.text;
            }
          }
        }
      }
      return text;
    },
    // Responses API usage: {input_tokens, output_tokens, total_tokens, input_tokens_details, output_tokens_details}. output_tokens already includes the reasoning tokens, the details object is a breakdown and not an addition
    extractUsage(json) {
      const u = json?.usage;
      return usageOf(u, u?.input_tokens, u?.output_tokens);
    },
    detectRequest() { return { path: '/v1/models', method: 'GET' }; },
    extractModels(json) { return (json.data || []).map((m) => m.id); },
  },

  gemini: {
    // Google Gemini API (generativelanguage). Key via x-goog-api-key header.
    base: 'https://generativelanguage.googleapis.com',
    authHeaders: (key) => ({ 'x-goog-api-key': key }),
    structuredRequest({ model, effort, system, user, schema }) {
      const generationConfig = {
        responseMimeType: 'application/json',
        // responseSchema is an OpenAPI-3.0 subset that rejects additionalProperties and the findings array's maxItems, so both are stripped for Gemini only. thinkingLevel is the Gemini 3.x effort dial (minimal|low|medium|high), omitted when no effort is set, and xhigh goes as high, the dial's top
        responseSchema: stripForGemini(schema),
      };
      if (effort) generationConfig.thinkingConfig = { thinkingLevel: effort === 'xhigh' ? 'high' : effort };
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      };
      // only the model segment is percent-encoded: the id is operator-supplied and /, ? or # would redirect the request inside the host. The :generateContent suffix stays raw, it's the method
      return { path: `/v1beta/models/${encodeURIComponent(model)}:generateContent`, method: 'POST', body };
    },
    extractText(json) {
      const parts = json?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) if (typeof p.text === 'string') return p.text;
      }
      return undefined;
    },
    // Gemini reports usage under usageMetadata, and candidatesTokenCount excludes thinking tokens where OpenAI's output_tokens and DeepSeek's completion_tokens include them. So output adds thoughtsTokenCount back, or a thinking reviewer reads short against the same work on another provider, which is the comparison the normalized pair exists for
    extractUsage(json) {
      const u = json?.usageMetadata;
      const answer = tokenCount(u?.candidatesTokenCount);
      const thoughts = tokenCount(u?.thoughtsTokenCount);
      const output = answer === undefined && thoughts === undefined
        ? undefined : (answer ?? 0) + (thoughts ?? 0);
      return usageOf(u, u?.promptTokenCount, output);
    },
    detectRequest() { return { path: '/v1beta/models', method: 'GET' }; },
    extractModels(json) {
      return (json.models || [])
        .filter((m) => !m.supportedGenerationMethods ||
          m.supportedGenerationMethods.includes('generateContent'))
        // model names come back as "models/<id>"; strip the prefix.
        .map((m) => (m.name || '').replace(/^models\//, ''));
    },
  },

  deepseek: {
    // DeepSeek Chat Completions: OpenAI-compatible but the choices[].message shape, not the Responses API the openai adapter uses. Its only structured mode is response_format json_object with no server-side schema, so the schema is injected into the system prompt and validateFindings/validateConsult assert the shape on return
    // json_object mode also needs the word "json" in the prompt, which the injected schema instruction supplies. Effort maps to the first-class reasoning_effort param (honored by thinking models, ignored by others)
    base: 'https://api.deepseek.com',
    authHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    structuredRequest({ model, effort, system, user, schema }) {
      // inject the bare schema, not a {name, schema} wrapper, which invites the model to echo the wrapper back instead of the required shape
      const sys = `${system}\n\nRespond with ONLY a single JSON object that` +
        ` conforms to this JSON schema - the object itself is the result, not` +
        ` the schema; no prose, no markdown fences:\n` + JSON.stringify(schema);
      const body = {
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      };
      // reasoning_effort takes low|medium|high only, and the shared enum also allows minimal and xhigh, which DeepSeek 400s on, so clamp to the nearest it takes and don't drop the reviewer
      const eff = effort === 'minimal' ? 'low' : effort === 'xhigh' ? 'high' : effort;
      if (eff) body.reasoning_effort = eff;
      return { path: '/chat/completions', method: 'POST', body };
    },
    extractText(json) {
      const content = json?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : undefined;
    },
    // Chat Completions usage: {prompt_tokens, completion_tokens, total_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens, completion_tokens_details}. Like OpenAI's, completion_tokens already includes the reasoning tokens
    extractUsage(json) {
      const u = json?.usage;
      return usageOf(u, u?.prompt_tokens, u?.completion_tokens);
    },
    detectRequest() { return { path: '/models', method: 'GET' }; },
    extractModels(json) { return (json.data || []).map((m) => m.id); },
  },
};

// assert the model returned our exact shape. Enforced output should already match, but a schema-ignoring model has to degrade cleanly

/**
 * String length in Unicode code points, which is what JSON Schema's `minLength`/`maxLength` count. JavaScript's `.length` counts 16-bit code units, so an astral character (an emoji, most CJK extension blocks) reads as 2 and a check written on it refuses a string the schema accepts.
 * lib/schema-eval.mjs counts the same way and the agreement test pins both against a non-BMP fixture.
 * @param {string} s @returns {number}
 */
function codePoints(s) {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

/**
 * Mirror of FINDING_SCHEMA's constraints, one named diagnostic each: every refusal here is one the canonical schema also makes. The agreement table in review-provider.test.mjs runs every fixture through this and through a keyword-limited evaluator against the live schema, so a keyword added to FINDING_SCHEMA without a mirror here reddens that test.
 * The diagnostic is never a shared "invalid finding" string, because it reaches the user as bad-shape detail and a degradation they can't act on is the silent drop this guard exists to end. Pure and total: returns null or a string, never throws.
 *
 * @param {any} obj @returns {string|null} null when valid, else the defect
 */
export function validateFindings(obj) {
  if (!obj || !Array.isArray(obj.findings)) return 'missing findings[]';
  for (const k of Object.keys(obj)) {
    if (k !== 'findings') return `unknown top-level key: ${k}`;
  }
  if (obj.findings.length > MAX_FINDINGS) {
    return `findings[] holds at most ${MAX_FINDINGS} entries, got ${obj.findings.length}`;
  }
  for (const f of obj.findings) {
    if (!f || typeof f !== 'object') return 'finding not an object';
    for (const k of ['file', 'claim', 'failure_scenario']) {
      if (typeof f[k] !== 'string') return `finding.${k} must be a string`;
      const max = k === 'file' ? MAX_FILE_CHARS : MAX_TEXT_CHARS;
      const n = codePoints(f[k]);
      if (n < 1) return `finding.${k} must not be empty`;
      if (n > max) return `finding.${k} is at most ${max} characters, got ${n}`;
    }
    if (!Number.isInteger(f.line)) return 'finding.line must be an integer';
    if (f.line < MIN_LINE) return `finding.line must be at least ${MIN_LINE}, got ${f.line}`;
    if (!SEVERITY.includes(f.severity)) return `bad severity: ${f.severity}`;
    for (const k of Object.keys(f)) {
      if (!FINDING_KEYS.includes(k)) return `finding has an unknown key: ${k}`;
    }
  }
  return null;
}

/** @param {any} obj @returns {string|null} null when valid, else the defect */
export function validateConsult(obj) {
  if (!obj || !Array.isArray(obj.angles)) return 'missing angles[]';
  if (obj.angles.length > MAX_ANGLES) {
    return `angles[] holds at most ${MAX_ANGLES} entries, got ${obj.angles.length}`;
  }
  for (const a of obj.angles) {
    if (!a || typeof a !== 'object') return 'angle not an object';
    for (const k of CONSULT_KEYS) {
      if (typeof a[k] !== 'string') return `angle.${k} must be a string`;
      const n = codePoints(a[k]);
      if (n > MAX_TEXT_CHARS) return `angle.${k} is at most ${MAX_TEXT_CHARS} characters, got ${n}`;
    }
  }
  return null;
}

async function readPayload(opts) {
  const src = opts.payload;
  try {
    if (!src || src === '-') return JSON.parse(fs.readFileSync(0, 'utf8'));
    return JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch (e) {
    fail('bad-payload', e.message,
      'the --payload file (or the stdin piped in its place) must hold parseable JSON - fix that file and re-run');
  }
}

// Shared preamble for the two structured-output commands.
function resolveProvider(opts, cmdName) {
  const provider = opts.provider;
  const adapter = ADAPTERS[provider];
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`,
    `pass --provider as one of: ${Object.keys(ADAPTERS).join(', ')}`);
  if (!opts.model) fail('bad-args', `${cmdName} needs --model`,
    'pass --model with an id this provider serves - `review-provider.mjs detect-models --provider <name>` lists them');
  // before the key is read and before any request: the id lands in a request path and a command line, so a malformed one is a malformed call
  if (!isModelId(opts.model)) fail('bad-args',
    `${cmdName} --model ${JSON.stringify(opts.model)} is not a model id`,
    'pass --model with an id this provider serves - `review-provider.mjs detect-models --provider <name>` lists them');
  const { key, where, warnings } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`,
    'write the key into that env file as NAME=value, or export it in this shell, then re-run - the key is never read from a repo config');
  return { provider, adapter, key, warnings };
}

// run a structured-output request through the transport, extract and parse; returns the parsed object or degrades via fail(). Schema validation is the caller's, since review and consult assert different shapes
// meta is the trace event's subject, stamped with started by the caller so one event covers the whole call. Each degrading exit records itself right before the fail() that unwinds, and success records nothing and leaves the final outcome to the caller
async function callStructured(adapter, key, reqSpec, meta) {
  const { path: p, method, body } = reqSpec;
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key), body });
  } catch (e) {
    failRequest(meta, e);
  }
  if (res.status < 200 || res.status >= 300) {
    traceProvider(meta, 'http', `HTTP ${res.status}`);
    fail('http', { status: res.status, body: bodyExcerpt(res.raw) },
      HTTP_HINT);
  }
  // before the three degrading exits, not after: a call that burned its budget and came back unusable is the one whose cost must still reach the record, and no-output, bad-json and the caller's bad-shape all record through this meta. It reads the raw response because this frame is the only one holding it, and carries it on meta the way redactions is. http and pre-request refusals reach no response and set nothing
  meta.usage = adapter.extractUsage(res.json);
  const text = adapter.extractText(res.json);
  if (typeof text !== 'string') {
    traceProvider(meta, 'no-output', 'no text in provider response');
    fail('no-output', 'no text in provider response',
      'the provider answered with no text at all - re-run once, and name a different model for this reviewer if it repeats');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    traceProvider(meta, 'bad-json', e.message);
    fail('bad-json', e.message,
      'this model returned prose where JSON was asked for - name a model that honours structured output for this reviewer, then re-run');
  }
}

async function cmdReview(opts) {
  // first act, before anything can refuse: resolveProvider and the payload checks both unwind through fail(), which needs the subject to name. It's opts.provider and not the resolved one because bad-provider has no resolved one
  const meta = beginProviderCall('review',
    { provider: opts.provider, model: opts.model, effort: opts.effort,
      trigger: opts.trigger });
  const { provider, adapter, key, warnings } = resolveProvider(opts, 'review');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.instruction !== 'string' || typeof payload.artifact !== 'string') {
    fail('bad-payload', 'payload needs {instruction, artifact}, both strings',
      'fix the file --payload names so it holds both keys as strings, then re-run - a caller that hand-built this file is the usual cause');
  }
  // fenced after the string gate and before the cap, because the cap has to measure what's sent. The request is built from the fenced strings only: a second reference to payload.artifact past here would route raw bytes around the fence
  const instruction = fence(payload.instruction);
  const artifact = fence(payload.artifact);
  meta.redactions = instruction.redactions + artifact.redactions;
  assertUnderCap(instruction.text, artifact.text);
  const parsed = await callStructured(adapter, key, adapter.structuredRequest({
    model: opts.model, effort: opts.effort,
    system: instruction.text, user: artifact.text,
    schema: FINDING_SCHEMA, schemaName: 'cadence_review',
  }), meta);
  const bad = validateFindings(parsed);
  if (bad) {
    traceProvider(meta, 'bad-shape', bad);
    fail('bad-shape', bad,
      'the provider parsed as JSON but not as a findings list - re-run once, and name a different model for this reviewer if it repeats');
  }
  // an empty findings set is ok with no degraded flag: a reviewer that found nothing isn't a drop-out
  traceProvider(meta, 'ok');
  // redactions rides the envelope on the same non-zero-only rule as the trace event, so the caller can say the reviewer read a fenced artifact. It's an additive key on the ok side and no existing arm moves
  ok({ provider, model: opts.model, findings: parsed.findings,
    ...(meta.redactions > 0 ? { redactions: meta.redactions } : {}),
    ...(warnings.length ? { warnings } : {}) });
}

async function cmdConsult(opts) {
  const meta = beginProviderCall('consult',
    { provider: opts.provider, model: opts.model, effort: opts.effort });
  const { provider, adapter, key, warnings } = resolveProvider(opts, 'consult');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.situation !== 'string') {
    fail('bad-payload', 'payload needs {situation}, a string',
      'fix the file --payload names so it holds that key as a string, then re-run - a caller that hand-built this file is the usual cause');
  }
  const situation = fence(payload.situation);
  meta.redactions = situation.redactions;
  assertUnderCap(situation.text);
  const system =
    'You are a second-opinion consultant to an engineer stuck at a dead-end. ' +
    'Return angles to investigate - concrete things to try or check, each with ' +
    'why it might be the cause and how to test it. Do NOT make the decision or ' +
    'pick the path: the engineer grounds each angle against the real code and ' +
    'decides. Be specific to the situation, not generic advice.';
  const parsed = await callStructured(adapter, key, adapter.structuredRequest({
    model: opts.model, effort: opts.effort,
    system, user: situation.text,
    schema: CONSULT_SCHEMA, schemaName: 'cadence_consult',
  }), meta);
  const bad = validateConsult(parsed);
  if (bad) {
    traceProvider(meta, 'bad-shape', bad);
    fail('bad-shape', bad,
      'the provider parsed as JSON but not as an angles list - re-run once, and name a different model for this consult if it repeats');
  }
  traceProvider(meta, 'ok');
  ok({ provider, model: opts.model, angles: parsed.angles,
    ...(meta.redactions > 0 ? { redactions: meta.redactions } : {}),
    ...(warnings.length ? { warnings } : {}) });
}

async function cmdDetect(opts) {
  const provider = opts.provider;
  // detect-models carries no model or effort, so tier is null by construction; they stay pinned to null here and don't read opts, which would start recording a --model this command never sends
  const meta = beginProviderCall('detect-models', { provider, model: null, effort: null });
  const adapter = ADAPTERS[provider];
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`,
    `pass --provider as one of: ${Object.keys(ADAPTERS).join(', ')}`);

  const { key, where, warnings: keyWarnings } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`,
    'write the key into that env file as NAME=value, or export it in this shell, then re-run - the key is never read from a repo config');

  const { path: p, method } = adapter.detectRequest();
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key) });
  } catch (e) {
    failRequest(meta, e);
  }
  if (res.status < 200 || res.status >= 300) {
    traceProvider(meta, 'http', `HTTP ${res.status}`);
    fail('http', { status: res.status, body: bodyExcerpt(res.raw) },
      HTTP_HINT);
  }
  const ids = adapter.extractModels(res.json);
  traceProvider(meta, 'ok');
  const env = detectEnvelope(provider, ids);
  const warnings = [...keyWarnings, ...(env.warnings || [])];
  ok(warnings.length ? { ...env, warnings } : env);
}

// load references/model-hints.json: a missing file is silent and one that exists but fails to parse is surfaced via warning, naming the file. Either way hints degrades to {} so everything classifies unknown and nothing is excluded, because a broken hints file is a visibility problem and never fatal
// hintsFile is injectable for tests; production uses the shipped table
/** @param {string} [hintsFile] @returns {{hints: any, warning: string|null}} */
export function readModelHints(hintsFile) {
  const file = hintsFile || path.join(HERE, '..', 'references', 'model-hints.json');
  try {
    return { hints: JSON.parse(fs.readFileSync(file, 'utf8')), warning: null };
  } catch (e) {
    if (e && e.code === 'ENOENT') return { hints: {}, warning: null };
    return { hints: {}, warning: `model-hints file ${file} failed to parse and was ignored: ${e.message}` };
  }
}

// tag each detected id with a tier hint. Non-text modalities (embeddings, audio, image) are dropped first since they can't review text. A known id gets {tier, high_effort}, an unknown text id gets tier:null so cad-config asks the user to place it, and a missing or broken hint file degrades to all-unknown and never errors
/** @param {string} provider @param {string[]} ids @param {string} [hintsFile] */
export function classify(provider, ids, hintsFile) {
  const { hints } = readModelHints(hintsFile);
  const rules = (hints.rules && hints.rules[provider]) || [];
  const exclude = hints.exclude || [];
  const excluded = (lower) => exclude.some((p) => lower.includes(String(p).toLowerCase()));
  return ids
    .filter((id) => !excluded(id.toLowerCase()))
    .map((id) => {
      const lower = id.toLowerCase();
      const hit = rules.find((r) => lower.includes(String(r.match).toLowerCase()));
      return hit
        ? { id, tier: hit.tier, high_effort: !!hit.high_effort }
        : { id, tier: null, high_effort: null };
    });
}

// the exact envelope cmdDetect returns, pure so the warnings[] contract is provable without a live key and network, which the suite forbids
/** @param {string} provider @param {string[]} ids @param {string} [hintsFile] */
export function detectEnvelope(provider, ids, hintsFile) {
  const { warning } = readModelHints(hintsFile);
  // a non-conforming id is dropped before classify and named: the config-review workflow writes surviving ids into a single-quoted config.mjs set line, where a quote or space must never arrive, and a wrongly refused id has to be visible
  const kept = ids.filter(isModelId);
  const warnings = ids.filter((id) => !isModelId(id))
    .map((id) => `dropped ${JSON.stringify(id)}: not a model id`);
  if (warning) warnings.push(warning);
  const models = classify(provider, kept, hintsFile);
  return warnings.length ? { provider, models, warnings } : { provider, models };
}

/** @param {string[]} [argv] */
async function main(argv) {
  // cleared per invocation: production runs one command per process but the in-process test harness runs several, and a leftover bracket would let fail('bad-command') record an event against a subject this call never had
  activeMeta = null;
  traceRecorded = false;
  const { cmd, opts, badArg } = parseArgs(argv || process.argv.slice(2));
  // the argument-shape refusal comes first: a flag present with nothing usable after it is a malformed call, and answering it as bad-provider "unknown provider: undefined" is what this closes
  if (badArg) fail('bad-args', badArg,
    'the detail names the flag and the form it takes - supply it and re-run the command');
  else if (cmd === 'review') await cmdReview(opts);
  else if (cmd === 'consult') await cmdConsult(opts);
  else if (cmd === 'detect-models') await cmdDetect(opts);
  else fail('bad-command', `use: review | consult | detect-models (got: ${cmd || 'none'})`,
    'name one of those three as the FIRST argument, before any flag, and re-run');
}

/**
 * The entry unwind: DONE is the normal ok()/fail() path, anything else is an
 * unforeseen bug and becomes a structured `internal` line rather than a stack.
 * @param {any} e
 */
function unwind(e) {
  if (e === DONE) return; // normal ok()/fail() unwind
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}

/**
 * TEST-ONLY. Run one command in this process through the same unwind the CLI uses, so a test that replaced the transport asserts on the one JSON line and exit code a caller sees. The shipped entry is the isRunAsScript arm below.
 * @param {string[]} argv
 * @returns {Promise<void>}
 */
export function __runCommandForTests(argv) {
  return main(argv).catch(unwind);
}
// run only when executed as a script, so importing the module (tests) exports the pure helpers with no side effects. Realpaths are compared because path.resolve doesn't follow symlinks and a symlinked plugin install has to still detect itself; a realpath failure degrades to the normalized comparison
function canonicalize(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}
function isRunAsScript() {
  if (!process.argv[1]) return false;
  return canonicalize(process.argv[1]) === canonicalize(fileURLToPath(import.meta.url));
}
if (isRunAsScript()) {
  main().catch(unwind);
}
