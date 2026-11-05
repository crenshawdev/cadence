#!/usr/bin/env node
// the only place a direct provider HTTPS call happens: review, consult (angles when stuck) and detect-models
// output is provider-enforced, never scraped; DeepSeek only has json_object, so its schema rides the prompt
// review and consult over the prompt cap are refused before any request, never truncated
// every outbound string crosses fence() before the cap, so what's measured is what's sent
//
// Usage:
//   review-provider.mjs review  --provider <openai|gemini|deepseek> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>] [--trigger <name>]
//       payload (stdin/file): {instruction, artifact} -> {ok, findings[]}
//       --trigger names the review trigger this call fired for; it rides the provider trace event. Optional.
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
// mergeLayers warnings[]: reviewConfig counts them onto the trace event; the other reads cache a bare number
// a torn layer there just costs a default, and the trace beside the request already shows it
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

// everything the caller reads is one JSON object on stdout, so the adjudicator parses one blob, never stderr
function ok(obj) { emit({ ok: true, ...obj }); throw DONE; }

// the trace subject for the running call, set first in each command and read by fail()
// module-level because fail() is reached from sites without the command's locals; null means no command has begun
/** @type {{command: string, provider: any, model: any, effort: any,
 *   trigger?: any, started: number, redactions?: number,
 *   usage?: ProviderUsage}|null} */
let activeMeta = null;

// one trace event per call, whichever site records first: traceProvider calls carry better detail than fail()
let traceRecorded = false;

/**
 * Open the trace bracket for one command, before anything can refuse.
 * Returns the meta so each command passes it as an argument, not module state.
 * @param {string} command
 * @param {{provider: any, model: any, effort: any, trigger?: any}} subject
 */
function beginProviderCall(command, subject) {
  activeMeta = { command, ...subject, started: Date.now() };
  traceRecorded = false;
  return activeMeta;
}

// hint rides as a conditional key, so an absent one adds no key
// it stays out of traceProvider on purpose: advice for the terminal, not a fact about what happened
function fail(reason, detail, hint) {
  // trace first, then emit: traceProvider never throws or speaks, so the caller reads the same thing either way
  if (activeMeta && !traceRecorded) {
    // detail is a string everywhere except http, whose object would render [object Object]; http records itself first
    traceProvider(activeMeta, reason, typeof detail === 'string' && detail ? detail : reason);
  }
  emit({ ok: false, reason, detail: detail || null, ...(hint ? { hint } : {}) });
  throw DONE;
}

// ok and fail throw DONE to unwind the command and the entry point swallows it
// anything else thrown is a bug, and these handlers turn it into {ok:false,reason:"internal"} instead of a stack
process.on('unhandledRejection', (/** @type {any} */ e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});
process.on('uncaughtException', (/** @type {any} */ e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});

// each declared flag is read through its row in lib/arg-contract.mjs, after a leading subcommand
// the old loop let a valueless flag eat the next one, so the error blamed a flag the caller did pass
// only a present flag with a missing, empty or flag-shaped value is refused here; absent is resolveProvider's wording
// pure and exported for the tests: a refusal rides back as badArg and main renders it as bad-args

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
  // the subcommand's row plus the script-global one; an unknown subcommand declares nothing, main answers bad-command
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

// env var first, then one shared env file at ${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env; config holds the path
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

// group- or other-readable key file: warned on the envelope, never refused; env keys, win32 and stat failures skip it
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

// node's timeout is a socket inactivity timeout and responses aren't streamed, so this caps total thinking time
// the old 120000 was too low for a high-effort review (292s) and silently dropped reviewers from blocking gates
// Bash caps a command at 600000ms, so that's the max and the default sits a minute under: a host kill prints nothing
// callers must pass an explicit Bash timeout, since the host default is 120000 (references/review-triggers.md)
const DEFAULT_REQUEST_TIMEOUT_MS = 540000;
const MAX_REQUEST_TIMEOUT_MS = 600000;

// the prompt-token cap for the two paid commands; the free claude-subagent reviewer never runs this script
// 120000 because DeepSeek's ~128k window is the tightest, and chars/4 is an estimate, so the margin is deliberate
const DEFAULT_MAX_PROMPT_TOKENS = 120000;

// the response byte ceiling: a proxy error page or runaway answer used to be held whole until the host timed out
// 4 MiB is ~8x the largest payload we send or response we accept; a body past it is something else wearing a 200
// not a config key: a knob nothing needs is just surface to maintain
const MAX_RESPONSE_BYTES = 4194304;

// tags a ceiling crossing so the catch arms can tell it from a socket error: a symbol, never a match on the message
const OVER_RESPONSE = Symbol('cadence-over-response');

// pure so tests can call it without config or network; anything unusable falls back to the default and never throws
// oversized is clamped, not rejected: past 2147483647 node's 32-bit timer truncates and never fires (a ~24.8 day hang)
// the schema only enforces min, so the upper bound has to live here
export function resolveTimeoutMs(configured) {
  if (!Number.isInteger(configured) || configured <= 0) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(configured, MAX_REQUEST_TIMEOUT_MS);
}

// lazy and memoized so unit tests importing the pure helpers do no config I/O; a broken layer degrades to the default
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

// same lazy, pure, degrade-never-crash rule as the timeout, but no upper clamp: raising the cap is the user's call
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

// the repo's chars/4 proxy: zero deps rules out a real tokenizer
// only the payload is measured: the adapters' schema bytes are a small per-provider constant
// a safety net, not the type gate: both callers refuse non-strings as bad-payload first, or a blob would clear the cap
export function estimatePromptTokens(...parts) {
  return measure(parts.filter((p) => typeof p === 'string').join('')).estTokens;
}

// the outbound secret fence (#167): the payload is raw repo contents bound for a third party, so all of it crosses here
// composed, not reimplemented: a security regex copied across sites drifts, so widen the fence in redact-url, not here
// by shape, not a prefix list, so a bare key with no name beside it isn't caught: it lowers exposure, no more
// the count comes back with the text so the envelope and the run record can say the payload shrank
// the count is a lower bound: a span can collapse onto an existing mark, so change is judged by comparing strings
/**
 * @param {string} s @returns {{text: string, redactions: number}}
 */
function fence(s) {
  const text = redactCredentials(redactUrl(s));
  if (text === s) return { text, redactions: 0 };
  const net = occurrences(text, REDACTION_MARK) - occurrences(s, REDACTION_MARK);
  return { text, redactions: net > 0 ? net : 1 };
}

// indexOf from a moving offset: split().length - 1 would copy an artifact that may be the whole cap
/** @param {string} hay @param {string} needle @returns {number} */
function occurrences(hay, needle) {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n += 1;
  return n;
}

// the refusal both paid commands share, before any request: truncating still pays and reviews a fragment as if whole
// callers already handle {ok:false}: name the reason, drop the reviewer, fall back (references/review-triggers.md)
function assertUnderCap(...parts) {
  const est = estimatePromptTokens(...parts);
  const cap = maxPromptTokens();
  if (est > cap) {
    fail('over-cap', `payload is ~${est} estimated tokens, over review.max_prompt_tokens (${cap})`,
      'send this reviewer less - a narrower diff or one file rather than the whole range - or raise review.max_prompt_tokens for this repo, then re-run');
  }
}

// the provider family of the joined run record. A dropped reviewer has to be named, and the prose mandate failed twice
// brackets a call, not a request: the five no-network drop-outs wrote nothing, so a shrunk panel looked normal

// the repo+global config, read once per process and bound with its warnings
// mergeLayers warnings[]: a torn layer defaults the tier lookup and timeout, so a non-zero count rides the trace event
// its own read on purpose: the memoized helpers above cache a number and discard the config object
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
 * The trigger tier this model id was resolved from, by reverse lookup over `review.providers.<name>.tiers`.
 * The seam is never told the tier, and a --tier flag would change the CLI contract at every prose callsite.
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
 * Record one `provider`/`request` event. `detail` makes it a degradation: this reviewer dropped out and the panel
 * is smaller than asked. An empty findings set isn't one.
 *
 * Never throws, never writes to a stream, never touches the caller's envelope.
 * @param {{command: string, provider: any, model: any, effort: any,
 *   trigger?: any, started: number, redactions?: number,
 *   usage?: ProviderUsage}} meta
 * @param {string} outcome the fail() reason, or 'ok'
 * @param {string} [detail]
 */
function traceProvider(meta, outcome, detail) {
  // marked before the attempt: one event per call, so a failed write mustn't license a second from fail()
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
      // which trigger fired this call; absent when none, and never a second event, which would double-count reviews
      ...(typeof meta.trigger === 'string' && meta.trigger.trim()
        ? { trigger: meta.trigger.trim() } : {}),
      tier: tierOf(meta.provider, meta.model),
      duration_ms: Date.now() - meta.started,
      outcome,
      ...(detail ? { degraded: true, detail: String(detail).slice(0, 200) } : {}),
      ...(warnings.length ? { config_warnings: warnings.length } : {}),
      // how many spans the fence removed, only when non-zero; never the spans themselves, which would be the leak
      ...(typeof meta.redactions === 'number' && meta.redactions > 0
        ? { redactions: meta.redactions } : {}),
      // what the provider says the call cost, only when real: no usage writes neither key, so old events read unknown
      // usage is the normalized input/output pair, usage_raw the provider's own object; never summed with the host's
      ...(meta.usage ? { usage: meta.usage.normalized } : {}),
      ...(meta.usage && meta.usage.raw !== undefined
        ? { usage_raw: meta.usage.raw } : {}),
    });
  } catch { /* a record of a call may never change the call */ }
}

// the transport reference and its one test seam: every failure we degrade on is past the call, so tests stub the wire
// deliberately no env var, flag or config key redirects it: the request carries the provider key, so an
// attacker-settable destination (a cloned .envrc, a devcontainer env) would hand the real key to their listener
// untouched, it's HTTPS_TRANSPORT for the process lifetime and the adapter bases stay hardcoded https: URLs

// typed at the wire types, not any, so a misspelled listener stays a tsc error
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
 * TEST-ONLY. Replace the transport for the current process. Only review-provider.test.mjs calls it,
 * to drive the six failure modes with no socket.
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
        // real bytes, not string length: a chunk is a Buffer in production and a string in the fake
        // counted before the append so the ceiling bounds what we hold
        bytes += Buffer.byteLength(c);
        if (bytes > MAX_RESPONSE_BYTES) {
          // the same abort the timeout handler uses: it forces an 'error' so the promise rejects down the existing path
          req.destroy(Object.assign(
            new Error(`response body over ${MAX_RESPONSE_BYTES} bytes (read ${bytes})`),
            { [OVER_RESPONSE]: true },
          ));
          return;
        }
        data += c;
      });
      // an aborted response emits its own 'error', and unhandled it would crash the process instead of degrading
      // reject is first-wins
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
 * The one mapping from a rejected request() to its degradation reason, shared by both callers.
 * A rejection the ceiling tagged is `over-response`; anything else is a socket failure and stays `transport`.
 * They're distinct because the trace and the caller must tell a provider that flooded us (not a review) from a
 * dead socket (worth a retry).
 * Never returns in practice: fail throws DONE.
 * @param {any} meta @param {any} e
 */
function failRequest(meta, e) {
  const over = !!(e && e[OVER_RESPONSE]);
  const reason = over ? 'over-response' : 'transport';
  traceProvider(meta, reason, e.message);
  // one reason is retryable, the other means this provider returns something that isn't a review, so the hints differ
  fail(reason, e.message, over
    ? 'this provider sent back more than the seam will read - ask it for less (a smaller artifact, or a lower effort), or name a different model for this reviewer, then re-run'
    : 'check the network reaches this provider and re-run - a transport failure is worth one retry, and one that repeats on a slow model wants review.request_timeout_ms raised');
}

/**
 * The next step for an `http` refusal, written once for both request-issuing commands; it turns status into action.
 */
const HTTP_HINT = 'the provider refused the request: 401 or 403 means the key, '
  + '404 means the model id, 429 or a 5xx is worth re-running in a minute';

/**
 * The `body` of every `http` failure envelope: a sanitized, capped string.
 * A delegate to `redactAndCap` in lib/redact-url.mjs, where the design lives. Kept as an export because the test
 * reads it off the namespace and git-publish.mjs shares the helper.
 * @param {unknown} raw @returns {string}
 */
export function bodyExcerpt(raw) {
  return redactAndCap(raw);
}

// the finding shape every adapter returns, in one place so the schema we send and the one we assert can't drift
const SEVERITY = ['blocker', 'high', 'medium', 'low'];

// bounds sized against what this tree has produced: longest file 39 chars, claim 159, failure_scenario 376, raised 9
// each sits an order of magnitude above that, and together they cap what validation accepts near 0.5 MB
// no minItems on purpose: an empty findings array is a clean review, and refusing it would turn that into bad-shape
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

// consult is a different job: the engineer is stuck, what would you try? It returns angles, never a decision
// a reply past these bounds is refused, never truncated. Gemini drops maxItems via stripForGemini and keeps maxLength
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

// deep-copy a schema into Gemini's dialect with every GEMINI_STRIPPED key removed at every depth
// OpenAI strict mode requires additionalProperties and Gemini rejects it
// Gemini also 400s on a large maxItems for an array of objects (100 and 50 failed, 20 passed), so validateFindings does
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

// what the provider says the call cost, a different denomination from the host's roles.tokens, so never summed with it
// usage and usage_raw are written together, and neither when the response carried none, never a zero
// usage is the normalized pair to sum across a panel; usage_raw is the provider's own object, untranslated

// the bound on usage_raw: a provider chose those bytes and the record is capped at MAX_TRACE_BYTES (1 MiB)
// over it the normalized pair still rides and the raw object drops
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
 * Build the usage an adapter read into the event's shape, or undefined when nothing real was read (absent, not zero).
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
    // two gates, raw rides only past both; size comes first so the fence never runs on more than MAX_USAGE_RAW_CHARS
    // the second is the outbound fence read for its verdict: a hostile 200 carrying an api_key would otherwise land
    // a credential in trace.jsonl, and the outbound fence only runs on what leaves
    // dropped whole, not kept fenced: the fence leaves non-JSON text, and a credential-shaped span means it isn't usage
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

// provider adapters: the only provider-specific bytes live here; wire details are pinned in references/provider-api.md
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
    // output_tokens already includes the reasoning tokens; the details object is a breakdown, not an addition
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
        // responseSchema is an OpenAPI-3.0 subset: additionalProperties and maxItems are stripped for Gemini only
        // thinkingLevel is Gemini 3.x's effort dial, omitted when no effort is set; xhigh goes as high, the dial's top
        responseSchema: stripForGemini(schema),
      };
      if (effort) generationConfig.thinkingConfig = { thinkingLevel: effort === 'xhigh' ? 'high' : effort };
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      };
      // only the model segment is percent-encoded: an operator-supplied /, ? or # would redirect the request
      return { path: `/v1beta/models/${encodeURIComponent(model)}:generateContent`, method: 'POST', body };
    },
    extractText(json) {
      const parts = json?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) if (typeof p.text === 'string') return p.text;
      }
      return undefined;
    },
    // usageMetadata's candidatesTokenCount excludes thinking tokens, unlike OpenAI and DeepSeek, so output adds
    // thoughtsTokenCount back, or a thinking reviewer reads short against the same work on another provider
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
    // DeepSeek Chat Completions: OpenAI-compatible but a choices[].message shape, with only json_object and no schema
    // so the schema is injected into the system prompt and validateFindings/validateConsult assert the shape on return
    // json_object mode needs the word "json" in the prompt, which the injected schema supplies
    // reasoning_effort is honored by thinking models and ignored by others
    base: 'https://api.deepseek.com',
    authHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    structuredRequest({ model, effort, system, user, schema }) {
      // inject the bare schema, since a {name, schema} wrapper invites the model to echo the wrapper back
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
      // reasoning_effort takes low|medium|high only, and DeepSeek 400s on minimal and xhigh,
      // so clamp to the nearest instead of dropping the reviewer
      const eff = effort === 'minimal' ? 'low' : effort === 'xhigh' ? 'high' : effort;
      if (eff) body.reasoning_effort = eff;
      return { path: '/chat/completions', method: 'POST', body };
    },
    extractText(json) {
      const content = json?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : undefined;
    },
    // like OpenAI's, completion_tokens already includes the reasoning tokens
    extractUsage(json) {
      const u = json?.usage;
      return usageOf(u, u?.prompt_tokens, u?.completion_tokens);
    },
    detectRequest() { return { path: '/models', method: 'GET' }; },
    extractModels(json) { return (json.data || []).map((m) => m.id); },
  },
};

// assert the exact shape: enforced output should match, but a schema-ignoring model has to degrade cleanly

/**
 * String length in Unicode code points, which is what JSON Schema's `minLength`/`maxLength` count.
 * `.length` counts 16-bit units, so an emoji reads as 2 and would refuse a string the schema accepts.
 * lib/schema-eval.mjs counts the same way and the agreement test pins both against a non-BMP fixture.
 * @param {string} s @returns {number}
 */
function codePoints(s) {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

/**
 * Mirror of FINDING_SCHEMA's constraints, one named diagnostic each. The agreement table in review-provider.test.mjs
 * checks it against the live schema, so a keyword added there without a mirror here reddens that test.
 * The diagnostic is never a shared "invalid finding" string: it reaches the user as bad-shape detail, and one they
 * can't act on is the silent drop this guard ends. Pure and total.
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
  // before the key is read or any request: the id lands in a request path and a command line
  if (!isModelId(opts.model)) fail('bad-args',
    `${cmdName} --model ${JSON.stringify(opts.model)} is not a model id`,
    'pass --model with an id this provider serves - `review-provider.mjs detect-models --provider <name>` lists them');
  const { key, where, warnings } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`,
    'write the key into that env file as NAME=value, or export it in this shell, then re-run - the key is never read from a repo config');
  return { provider, adapter, key, warnings };
}

// run a structured-output request through the transport, extract and parse, or degrade via fail()
// schema validation is the caller's, since review and consult assert different shapes
// meta is the trace event's subject, stamped with started by the caller so one event covers the whole call
// each degrading exit records itself right before the fail() that unwinds; success records nothing
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
  // set before the degrading exits: a call that burned its budget and came back unusable still has to show its cost
  // it reads the raw response because this frame is the only one holding it; http and pre-request refusals set nothing
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
  // first act, before anything can refuse: resolveProvider and the payload checks unwind through fail(), which needs it
  // it's opts.provider, not the resolved one, because bad-provider has none
  const meta = beginProviderCall('review',
    { provider: opts.provider, model: opts.model, effort: opts.effort,
      trigger: opts.trigger });
  const { provider, adapter, key, warnings } = resolveProvider(opts, 'review');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.instruction !== 'string' || typeof payload.artifact !== 'string') {
    fail('bad-payload', 'payload needs {instruction, artifact}, both strings',
      'fix the file --payload names so it holds both keys as strings, then re-run - a caller that hand-built this file is the usual cause');
  }
  // fenced after the string gate and before the cap, so the cap measures what's sent
  // build the request from the fenced strings only: payload.artifact past here would route raw bytes around the fence
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
  // redactions rides the envelope on the trace event's non-zero-only rule, so the caller can say it was fenced
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
    // detect-models has no model or effort, so tier is null by construction
    // don't read opts here, or a --model this command never sends would get recorded
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

// load references/model-hints.json: a missing file is silent, one that fails to parse surfaces as a warning naming it
// either way hints degrades to {}, so everything classifies unknown and nothing is excluded; never fatal
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

// tag each detected id with a tier hint, after dropping non-text modalities (embeddings, audio, image)
// an unknown text id gets tier:null so cad-config asks the user to place it; a missing hint file means all-unknown
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

// the exact envelope cmdDetect returns, pure so the warnings[] contract is provable without a live key or network
/** @param {string} provider @param {string[]} ids @param {string} [hintsFile] */
export function detectEnvelope(provider, ids, hintsFile) {
  const { warning } = readModelHints(hintsFile);
  // a non-conforming id is dropped and named before classify: config-review writes surviving ids into a single-quoted
  // config.mjs set line, where a quote or space must never arrive
  const kept = ids.filter(isModelId);
  const warnings = ids.filter((id) => !isModelId(id))
    .map((id) => `dropped ${JSON.stringify(id)}: not a model id`);
  if (warning) warnings.push(warning);
  const models = classify(provider, kept, hintsFile);
  return warnings.length ? { provider, models, warnings } : { provider, models };
}

/** @param {string[]} [argv] */
async function main(argv) {
  // cleared per invocation: the test harness runs several commands in one process, and a stale bracket
  // would record fail('bad-command') against a subject this call never had
  activeMeta = null;
  traceRecorded = false;
  const { cmd, opts, badArg } = parseArgs(argv || process.argv.slice(2));
  // the argument-shape refusal comes first: a flag with nothing usable after it is a malformed call, not bad-provider
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
 * TEST-ONLY. Run one command in this process through the CLI's unwind, so a test that replaced the transport
 * asserts on the one JSON line and exit code a caller sees.
 * @param {string[]} argv
 * @returns {Promise<void>}
 */
export function __runCommandForTests(argv) {
  return main(argv).catch(unwind);
}
// run only as a script, so importing the module (tests) has no side effects
// realpaths are compared because path.resolve doesn't follow symlinks; a failure falls back to the normalized path
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
