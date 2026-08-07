#!/usr/bin/env node
// Cadence cross-model review/detect provider. Zero-dependency Node.
//
// This is the ONLY place a direct provider HTTPS call happens. The
// call-review-provider seam (references/seams.md) binds to invoking this
// script; SKILL.md workflows never inline provider specifics. Three jobs:
//
//   review        single-shot structured-output critique of an artifact ->
//                 normalized findings JSON on stdout.
//   consult       reactive dead-end help: a stuck situation in -> angles to
//                 try out (hypotheses, never a decision). Decision-support only.
//   detect-models enumerate the model IDs the resolved key can access ->
//                 {models:[...]} on stdout (feeds cad-config assignment).
//
// Design contract (DESIGN.md §6):
//   - Structured output is ENFORCED by the provider (OpenAI json_schema /
//     Gemini responseSchema), never scraped - EXCEPT DeepSeek, whose only
//     structured mode is json_object (no server-side schema), so its adapter
//     injects the schema into the prompt instead. Either way we assert the
//     shape on return, so an unenforced or schema-ignoring model degrades to a
//     structured bad-shape, never bad data.
//   - Keys resolve env-first, then a shared 600-perm env file. Lazy, never
//     logged. A missing key is not fatal: we emit {ok:false, reason:"no-key"}
//     so the caller falls back to claude-subagent.
//   - Any failure (offline, bad key, http error, bad shape) degrades to a
//     structured {ok:false, reason, detail} on stdout with a nonzero exit -
//     the review subsystem never crashes the spine on a provider problem.
//   - review and consult are the two PAID commands, so both are bounded by
//     `review.max_prompt_tokens` (chars/4 estimated, default 120000). An
//     over-cap payload is REFUSED - {ok:false, reason:"over-cap"} before any
//     request is issued - never truncated and never merely warned about. A
//     non-string payload field is refused as bad-payload first, since an
//     unmeasurable field is an unbounded one. The free claude-subagent
//     reviewer never runs this script and is exempt.
//
// Usage:
//   review-provider.mjs review  --provider <openai|gemini|deepseek> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>]
//       payload (stdin/file): {instruction, artifact} -> {ok, findings[]}
//   review-provider.mjs consult --provider <openai|gemini|deepseek> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>]
//       payload (stdin/file): {situation} -> {ok, angles[]}  (dead-end help)
//   review-provider.mjs detect-models --provider <openai|gemini|deepseek> [--key-file <path>]
//
// --key-file overrides the shared env-file path (config review.key_file); an
// env-set key still wins over it. Omitted -> the XDG default.
//
// The review payload (JSON, from --payload file or stdin) is:
//   { "instruction": "<what to critique and how>",
//     "artifact": "<the plan / diff / files to review>" }
//
// mergeLayers warnings[]: the ONE surfacing for this file is `reviewConfig()`
// (:290), which binds the warnings of the same `.planning/config.json` layer and
// puts them on every provider trace event as `config_warnings`. The two OTHER
// reads here - `requestTimeoutMs()` and `maxPromptTokens()` - are memoized
// SCALAR helpers that cache a number and discard the config object, so there is
// nothing at those two callsites to surface: the value they lose to a torn layer
// is a request timeout and a prompt cap, each degrading to a stated default, and
// the fact that the layer was torn is already in the trace beside the request
// those bounds applied to. What the CALLER sees is the seam's own envelope -
// `{ok:false, reason}` with the fail reason - and no config warning can change
// which reason that is.
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

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Output helpers. Everything the caller consumes is a single JSON object on
// stdout so the main-model adjudicator parses one blob, never stderr scrapes.
// The convention (one line, exitCode mirrors ok, no process.exit after the
// write) lives in lib/seam-io.mjs.
// ---------------------------------------------------------------------------
function ok(obj) { emit({ ok: true, ...obj }); throw DONE; }
function fail(reason, detail) { emit({ ok: false, reason, detail: detail || null }); throw DONE; }

// ok()/fail() throw the DONE sentinel to unwind the current command; the
// entry point swallows it. Any OTHER throw is an unforeseen bug - the
// top-level handlers below convert it to a structured
// {ok:false,reason:"internal"} so a provider/adapter surprise never crashes
// the spine with a raw stack.
process.on('unhandledRejection', (/** @type {any} */ e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});
process.on('uncaughtException', (/** @type {any} */ e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});

// ---------------------------------------------------------------------------
// Arg parsing (minimal, no deps). --flag value pairs + a leading subcommand.
// ---------------------------------------------------------------------------
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) { opts[a.slice(2)] = rest[i + 1]; i++; }
  }
  return { cmd, opts };
}

// ---------------------------------------------------------------------------
// Key resolution: env var first (an env-set key always wins), then a single
// shared env file at ${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env.
// Config stores only the path, never the value. Lazy + never logged.
// ---------------------------------------------------------------------------
const ENV_VAR = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', deepseek: 'DEEPSEEK_API_KEY' };

// The shared env-file path: an explicit --key-file override (config
// `review.key_file`, passed through by the seam) else the XDG default.
function providersEnvPath(override) {
  if (override) return override.replace(/^~(?=\/|$)/, os.homedir());
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'cadence', 'providers.env');
}

// Parse a dotenv-style file: KEY=VALUE per line, # comments, optional quotes,
// ignores blank lines and a leading `export `. Intentionally tiny.
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

function resolveKey(provider, keyFile) {
  const name = ENV_VAR[provider];
  if (process.env[name]) return { key: process.env[name], source: 'env' };
  const file = providersEnvPath(keyFile);
  try {
    const parsed = parseEnvFile(fs.readFileSync(file, 'utf8'));
    if (parsed[name]) return { key: parsed[name], source: 'file' };
  } catch { /* file absent/unreadable -> treated as no-key below */ }
  return { key: null, where: `env $${name} or ${file}` };
}

// ---------------------------------------------------------------------------
// HTTPS helper. Resolves { status, json } or rejects on transport error.
// Zero-dep: node:https only. body omitted -> GET. A hard timeout guarantees a
// stalled/black-hole connection (TCP accepted, no bytes) still rejects, so the
// caller degrades to a structured {ok:false} instead of hanging the spine.
// ---------------------------------------------------------------------------
// node's `timeout` is a socket INACTIVITY timeout, and a provider response is
// not streamed - no bytes arrive until the model stops thinking - so this
// effectively caps total thinking time. 120000 was below what a high-effort
// review actually costs (measured: 292s for a flagship model on a 12.7KB diff),
// which silently dropped cross-model reviewers from the blocking gates. Hence
// the higher default and the config override.
// The execution host bounds this from above and we cannot exceed it: the Bash
// tool that runs this seam caps a command at 600000ms. So MAX is that ceiling,
// and the default sits a minute under it, because whoever aborts first owns the
// output - if the host kills us we print NOTHING and the caller's "read the one
// JSON line" gets an empty string, strictly worse than the {ok:false,
// reason:"transport"} we are supposed to degrade to. The host's DEFAULT is only
// 120000, so fire() must pass an explicit Bash timeout (see
// references/review-triggers.md); this constant alone cannot buy the time.
const DEFAULT_REQUEST_TIMEOUT_MS = 540000;
const MAX_REQUEST_TIMEOUT_MS = 600000;

// The prompt-token cap (#16, REV-03), bounding the two PAID commands - review
// and consult - and nothing else. The free `claude-subagent` reviewer never
// runs this script, so it is exempt by construction rather than by omission;
// that arm's own payload bound, if the host has one, is the host's.
// 120000 estimated tokens because of the three shipped providers DeepSeek's
// context window is the tightest at ~128k: the default sits just under the
// smallest window a configured payload could be sent to, and `chars/4` is an
// estimate rather than a tokenizer, so the margin is deliberate.
const DEFAULT_MAX_PROMPT_TOKENS = 120000;

// Pure so the unit tests can exercise it without touching config or the network.
// Anything unusable - absent, non-numeric, non-integer, zero, negative - falls
// back to the default rather than throwing: a bad timeout must never sink a
// review, same degrade-never-crash contract as the rest of this seam.
//
// An oversized value is CLAMPED, not rejected, and this is the load-bearing
// half: node stores a socket timeout in a 32-bit signed int, so anything past
// 2147483647 is truncated there and the timer effectively never fires - a
// black-hole connection would hang ~24.8 days instead of rejecting, defeating
// the exact guarantee this timeout exists to provide. The schema enforces only
// `min`, so `set review.request_timeout_ms=600000000` (a plausible extra zero)
// validates clean; the bound has to live here.
export function resolveTimeoutMs(configured) {
  if (!Number.isInteger(configured) || configured <= 0) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(configured, MAX_REQUEST_TIMEOUT_MS);
}

// Lazy + memoized on purpose: review-provider.test.mjs imports the pure helpers
// straight from this module, so a module-level read would do config I/O inside
// unit tests. One read per process, and a broken config layer degrades to the
// default (mergeLayers already skips a non-object layer).
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

// Same pure/lazy split as the timeout above, and the same degrade-never-crash
// contract: anything unusable falls back to the default rather than throwing.
// UNLIKE the timeout it is not clamped from above - there is no host ceiling to
// overflow here, and a user who raises the cap has made that call in writing.
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

// The repo's existing deterministic chars/4 proxy, reused rather than
// reimplemented: zero runtime deps forbids a real tokenizer, and both #16 and
// REV-03 ask for a TOKEN cap, so a byte key would rename what was asked for.
// Only the payload is measured. The adapters' schema-injection bytes are a
// small fixed per-provider constant and counting them would make one payload
// cap differently per provider - the number stays reproducible from the
// payload alone.
// The non-string filter is a safety net, NOT the type gate: a non-string part
// measures as nothing, so if the filter were the only guard a `{blob: <480KB>}`
// artifact would estimate ~0 tokens, clear the cap, and still be serialized
// into the request by JSON.stringify. Both callers therefore reject a
// non-string field as `bad-payload` BEFORE calling this - the cap can only
// bound what it can measure.
export function estimatePromptTokens(...parts) {
  return measure(parts.filter((p) => typeof p === 'string').join('')).estTokens;
}

// The refusal both paid commands share. It happens BEFORE any request is
// issued and is neither a truncation nor a warning: truncating still pays the
// provider and returns findings on a fragment while reporting as though it saw
// the whole artifact, which is worse than the unbounded bill, and
// warn-and-send changes no outcome at all. No new caller machinery is needed -
// references/review-triggers.md step 4 already handles any {ok:false} (name
// the reason, drop the reviewer, fall back if the set empties).
function assertUnderCap(...parts) {
  const est = estimatePromptTokens(...parts);
  const cap = maxPromptTokens();
  if (est > cap) {
    fail('over-cap', `payload is ~${est} estimated tokens, over review.max_prompt_tokens (${cap})`);
  }
}

// ---------------------------------------------------------------------------
// The provider family of the joined run record (.planning/trace.jsonl). A
// reviewer that drops out of a fired trigger is supposed to be NAMED to the
// user, and references/review-triggers.md already mandates that visible line -
// that mandate is the thing that failed, twice. So the seam records the
// degradation itself: the panel's actual composition is in the record whether or
// not the orchestrator relays the line.
// ---------------------------------------------------------------------------

// The repo+global config, read once per process and bound with its `warnings`.
//
// mergeLayers warnings[]: a torn config layer is why a tier reverse lookup can
// come back null and why the timeout and the prompt cap fall back to their
// defaults, so the warnings ride the provider trace event (`config_warnings`)
// rather than being dropped at the read. Deliberately its OWN read: the two
// reads above are memoized SCALAR helpers that cache a number and discard the
// config object, so there is nothing there to take a config off.
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
 * The trigger TIER this model id was resolved from, by REVERSE LOOKUP over
 * `review.providers.<name>.tiers`. The seam is never told the tier: the caller
 * resolves `tiers[trigger.tier]` and passes only `--model`
 * (references/review-triggers.md), so the mapping is inverted here rather than
 * added as a `--tier` flag, which would change the CLI contract at every prose
 * callsite. `null` when the map has no such value - a hand-passed model, or
 * `detect-models`, which carries no model at all. Never a guess.
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
 * Record one `provider`/`request` event. `detail` is what makes it a DEGRADATION:
 * present means this reviewer dropped out and the panel is smaller than the
 * trigger asked for. An empty findings set is NOT one - it is `ok` with no
 * detail, because a reviewer that legitimately found nothing must not be
 * recorded as a drop-out (D-22).
 *
 * Never throws, never writes to a stream, never touches the caller's envelope.
 * @param {{command: string, provider: any, model: any, effort: any, started: number}} meta
 * @param {string} outcome the fail() reason, or 'ok'
 * @param {string} [detail]
 */
function traceProvider(meta, outcome, detail) {
  try {
    const root = '.planning';
    const phase = cursorPhase(root);
    // No cursor: an event keyed to no phase joins nothing and the id it would
    // derive is the empty string, so nothing is recorded rather than a line
    // that cannot be read back.
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
      tier: tierOf(meta.provider, meta.model),
      duration_ms: Date.now() - meta.started,
      outcome,
      ...(detail ? { degraded: true, detail: String(detail).slice(0, 200) } : {}),
      ...(warnings.length ? { config_warnings: warnings.length } : {}),
    });
  } catch { /* a record of a call may never change the call */ }
}

// ---------------------------------------------------------------------------
// The transport reference, and the ONE test seam that moves it (QW-05).
//
// Every failure mode this seam degrades on - timeout, HTTP status, truncated
// body, no output - lives PAST the call below, so exercising them needs a way to
// stand in for the wire. That way is a module-private reference a test replaces
// by IMPORTING this module, reachable only from inside the running process.
//
// There is deliberately NO environment variable, no flag and no config key that
// redirects it. The request this transport carries holds a resolved provider key
// in an `authorization` header, so an out-of-process switch on the destination
// would be a credential-read primitive: one attacker-settable variable (a
// `.envrc` in a cloned repo, a devcontainer env block, a compromised npm script)
// would make an ordinary run read the user's real on-disk key and hand it to a
// listener of the attacker's choosing. Loopback is not a privilege boundary -
// any unprivileged local process that binds the port first receives the
// credential - so the fence is that the surface does not exist. This overturns
// CONTEXT D-11, which picked an env override on `CADENCE_*` precedent; that
// precedent does not hold for a variable that redirects a CREDENTIALED request.
//
// The default is `node:https` and nothing else can be reached in production:
// with the seam untouched, `transport` is `HTTPS_TRANSPORT` for the life of the
// process, and the three adapter bases stay hardcoded `https:` URLs.
// ---------------------------------------------------------------------------

// The signature is the `https.request(url, options, cb)` shape and is typed at
// the WIRE types, not at `any`: `req` below is a real `ClientRequest`, so a
// misspelled listener (`req.onnn('error', ...)`) stays a tsc error exactly as it
// was when this line read `https.request(...)` directly. A loose return here
// would silently un-check all six `req.*` uses in `request()`.
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
 * TEST-ONLY. Replace the transport for the CURRENT PROCESS. Nothing in the
 * plugin calls this; the only caller is `review-provider.test.mjs`, which
 * imports this module to drive the six failure modes with no socket at all.
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
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* leave null; caller inspects status */ }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    // 'timeout' fires on inactivity but does not abort; destroy to force an
    // 'error' (ECONNRESET-style) so the promise rejects down the transport path.
    req.on('timeout', () => req.destroy(new Error(`request timed out after ${timeoutMs}ms`)));
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// The normalized finding shape every provider adapter must return. Kept in
// one place so the JSON schema we send and the shape we assert never drift.
// ---------------------------------------------------------------------------
const SEVERITY = ['blocker', 'high', 'medium', 'low'];
const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'line', 'severity', 'claim', 'failure_scenario'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: SEVERITY },
          claim: { type: 'string' },
          failure_scenario: { type: 'string' },
        },
      },
    },
  },
};

// Consult is a different job from review: not "critique this artifact" but
// "the primary engineer is stuck - what would you try?" It returns angles to
// investigate, never a decision. Decision-support only; the main model grounds
// each angle and the user decides (DESIGN §6).
const CONSULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angles'],
  properties: {
    angles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hypothesis', 'rationale', 'how_to_check'],
        properties: {
          hypothesis: { type: 'string' },
          rationale: { type: 'string' },
          how_to_check: { type: 'string' },
        },
      },
    },
  },
};

// Deep-copy a JSON schema with every `additionalProperties` key removed.
// OpenAI strict mode requires it; Gemini's OpenAPI-subset responseSchema
// rejects it. One schema, two dialects.
/** @param {any} node @returns {any} */
export function stripAdditionalProperties(node) {
  if (Array.isArray(node)) return node.map(stripAdditionalProperties);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'additionalProperties') continue;
      out[k] = stripAdditionalProperties(v);
    }
    return out;
  }
  return node;
}

// ===========================================================================
// Provider adapters. The ONLY provider-specific bytes live here: endpoint,
// auth, request builders, and response extractors. Everything above is shared.
// Wire details are pinned in references/provider-api.md (verified against the
// live docs); update both together if a provider changes its API.
// ===========================================================================
export const ADAPTERS = {
  openai: {
    // OpenAI Responses API. reasoning.effort is a first-class per-call param.
    base: 'https://api.openai.com',
    authHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    // One structured-output call, shared by review and consult - only the
    // schema and prompt differ. Wire output for review is byte-identical to
    // before this was generalized.
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
    // Responses API returns output items; the text lives in output_text or in
    // the assistant message content. Handle both to be robust across versions.
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
        // Gemini responseSchema is an OpenAPI-3.0 subset that rejects the
        // `additionalProperties` keyword (which OpenAI strict mode requires),
        // so strip it for Gemini only. thinkingLevel is the Gemini 3.x effort
        // dial (minimal|low|medium|high); omitted when no effort is set.
        responseSchema: stripAdditionalProperties(schema),
      };
      if (effort) generationConfig.thinkingConfig = { thinkingLevel: effort };
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      };
      return { path: `/v1beta/models/${model}:generateContent`, method: 'POST', body };
    },
    extractText(json) {
      const parts = json?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) if (typeof p.text === 'string') return p.text;
      }
      return undefined;
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
    // DeepSeek Chat Completions API - OpenAI-compatible surface, but the
    // Chat Completions shape (choices[].message), NOT the Responses API the
    // openai adapter uses. Its only structured mode is
    // response_format:{type:'json_object'} (no server-side json_schema), so
    // the schema is injected into the system prompt and the shape is asserted
    // on return by validateFindings/validateConsult - the guard every adapter
    // already passes through. json_object mode also requires the word "json"
    // in the prompt, which the injected schema instruction supplies. Effort
    // maps to the first-class `reasoning_effort` param (honored by thinking
    // models; ignored by non-thinking ones).
    base: 'https://api.deepseek.com',
    authHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    structuredRequest({ model, effort, system, user, schema }) {
      // Inject the BARE schema (the object the model must produce), not a
      // {name, schema} wrapper - a wrapper invites the model to echo
      // {name, schema} back instead of the required top-level shape.
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
      // DeepSeek's reasoning_effort accepts low|medium|high only; the shared
      // config effort enum also allows `minimal`, which DeepSeek 400s on - so
      // clamp minimal up to low rather than drop the reviewer on a 400.
      const eff = effort === 'minimal' ? 'low' : effort;
      if (eff) body.reasoning_effort = eff;
      return { path: '/chat/completions', method: 'POST', body };
    },
    extractText(json) {
      const content = json?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : undefined;
    },
    detectRequest() { return { path: '/models', method: 'GET' }; },
    extractModels(json) { return (json.data || []).map((m) => m.id); },
  },
};

// ---------------------------------------------------------------------------
// Assert the model returned our exact shape. Enforced output should already
// match; we still guard so a schema-ignoring model degrades cleanly.
// ---------------------------------------------------------------------------
/** @param {any} obj @returns {string|null} null when valid, else the defect */
export function validateFindings(obj) {
  if (!obj || !Array.isArray(obj.findings)) return 'missing findings[]';
  for (const f of obj.findings) {
    if (!f || typeof f !== 'object') return 'finding not an object';
    for (const k of ['file', 'claim', 'failure_scenario']) {
      if (typeof f[k] !== 'string') return `finding.${k} must be a string`;
    }
    if (!Number.isInteger(f.line)) return 'finding.line must be an integer';
    if (!SEVERITY.includes(f.severity)) return `bad severity: ${f.severity}`;
  }
  return null;
}

/** @param {any} obj @returns {string|null} null when valid, else the defect */
export function validateConsult(obj) {
  if (!obj || !Array.isArray(obj.angles)) return 'missing angles[]';
  for (const a of obj.angles) {
    if (!a || typeof a !== 'object') return 'angle not an object';
    for (const k of ['hypothesis', 'rationale', 'how_to_check']) {
      if (typeof a[k] !== 'string') return `angle.${k} must be a string`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Commands.
// ---------------------------------------------------------------------------
async function readPayload(opts) {
  const src = opts.payload;
  try {
    if (!src || src === '-') return JSON.parse(fs.readFileSync(0, 'utf8'));
    return JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch (e) {
    fail('bad-payload', e.message);
  }
}

// Shared preamble for the two structured-output commands.
function resolveProvider(opts, cmdName) {
  const provider = opts.provider;
  const adapter = ADAPTERS[provider];
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`);
  if (!opts.model) fail('bad-args', `${cmdName} needs --model`);
  const { key, where } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`);
  return { provider, adapter, key };
}

// Run a structured-output request through the transport, extract, and parse.
// Returns the parsed JSON object or degrades via fail(). Schema validation is
// the caller's job (review and consult assert different shapes).
//
// `meta` is the provider trace event's subject, stamped with `started` by the
// caller so ONE event covers the whole call. Each degrading exit records itself
// here, immediately BEFORE the fail() that unwinds the command; the success path
// records nothing, leaving the final outcome (ok, or a bad-shape the caller
// detects) to the caller. Exactly one event per call, either way.
async function callStructured(adapter, key, reqSpec, meta) {
  const { path: p, method, body } = reqSpec;
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key), body });
  } catch (e) {
    traceProvider(meta, 'transport', e.message);
    fail('transport', e.message);
  }
  if (res.status < 200 || res.status >= 300) {
    traceProvider(meta, 'http', `HTTP ${res.status}`);
    fail('http', { status: res.status, body: res.json || res.raw });
  }
  const text = adapter.extractText(res.json);
  if (typeof text !== 'string') {
    traceProvider(meta, 'no-output', 'no text in provider response');
    fail('no-output', 'no text in provider response');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    traceProvider(meta, 'bad-json', e.message);
    fail('bad-json', e.message);
  }
}

async function cmdReview(opts) {
  const { provider, adapter, key } = resolveProvider(opts, 'review');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.instruction !== 'string' || typeof payload.artifact !== 'string') {
    fail('bad-payload', 'payload needs {instruction, artifact}, both strings');
  }
  assertUnderCap(payload.instruction, payload.artifact);
  const meta = { command: 'review', provider, model: opts.model, effort: opts.effort,
    started: Date.now() };
  const parsed = await callStructured(adapter, key, adapter.structuredRequest({
    model: opts.model, effort: opts.effort,
    system: payload.instruction, user: payload.artifact,
    schema: FINDING_SCHEMA, schemaName: 'cadence_review',
  }), meta);
  const bad = validateFindings(parsed);
  if (bad) {
    traceProvider(meta, 'bad-shape', bad);
    fail('bad-shape', bad);
  }
  // An EMPTY findings set is `ok` and carries no `degraded` flag (D-22):
  // a reviewer that legitimately found nothing is not a drop-out.
  traceProvider(meta, 'ok');
  ok({ provider, model: opts.model, findings: parsed.findings });
}

async function cmdConsult(opts) {
  const { provider, adapter, key } = resolveProvider(opts, 'consult');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.situation !== 'string') {
    fail('bad-payload', 'payload needs {situation}, a string');
  }
  assertUnderCap(payload.situation);
  const meta = { command: 'consult', provider, model: opts.model, effort: opts.effort,
    started: Date.now() };
  const system =
    'You are a second-opinion consultant to an engineer stuck at a dead-end. ' +
    'Return angles to investigate - concrete things to try or check, each with ' +
    'why it might be the cause and how to test it. Do NOT make the decision or ' +
    'pick the path: the engineer grounds each angle against the real code and ' +
    'decides. Be specific to the situation, not generic advice.';
  const parsed = await callStructured(adapter, key, adapter.structuredRequest({
    model: opts.model, effort: opts.effort,
    system, user: payload.situation,
    schema: CONSULT_SCHEMA, schemaName: 'cadence_consult',
  }), meta);
  const bad = validateConsult(parsed);
  if (bad) {
    traceProvider(meta, 'bad-shape', bad);
    fail('bad-shape', bad);
  }
  traceProvider(meta, 'ok');
  ok({ provider, model: opts.model, angles: parsed.angles });
}

async function cmdDetect(opts) {
  const provider = opts.provider;
  const adapter = ADAPTERS[provider];
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`);

  const { key, where } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`);

  const { path: p, method } = adapter.detectRequest();
  // `detect-models` carries no model at all, so its `tier` is null by
  // construction rather than by a failed lookup.
  const meta = { command: 'detect-models', provider, model: null, effort: null,
    started: Date.now() };
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key) });
  } catch (e) {
    traceProvider(meta, 'transport', e.message);
    fail('transport', e.message);
  }
  if (res.status < 200 || res.status >= 300) {
    traceProvider(meta, 'http', `HTTP ${res.status}`);
    fail('http', { status: res.status, body: res.json || res.raw });
  }
  const ids = adapter.extractModels(res.json);
  traceProvider(meta, 'ok');
  ok(detectEnvelope(provider, ids));
}

// Load references/model-hints.json, distinguishing a legitimately-absent
// file (silent, per D-01) from one that exists but fails to parse (surfaced
// via `warning`, naming the file). Either way `hints` degrades to {} so the
// caller still classifies everything unknown, nothing excluded - a broken
// hints file is a visibility problem, never a fatal one.
// hintsFile is injectable for tests; production always uses the shipped table.
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

// Tag each detected id with a tier hint (references/model-hints.json). First
// drop non-text modalities (embeddings, audio, image, ...) that can't do text
// review, so the candidate list is review-usable. Then: known id ->
// {tier, high_effort}; unknown text id -> tier:null so cad-config asks the user
// to place it. Missing/broken hint file degrades to all-unknown, never errors
// (fail-safe preserved - the exclude filter and candidate array are unaffected;
// only detectEnvelope's warnings[] differs for a malformed vs. absent file).
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

// The exact envelope shape cmdDetect returns, factored out pure so the
// warnings[] contract (AC3) is provable hermetically - detect-models itself
// needs a live key + network, which the suite forbids.
/** @param {string} provider @param {string[]} ids @param {string} [hintsFile] */
export function detectEnvelope(provider, ids, hintsFile) {
  const { warning } = readModelHints(hintsFile);
  const models = classify(provider, ids, hintsFile);
  return warning ? { provider, models, warnings: [warning] } : { provider, models };
}

// ---------------------------------------------------------------------------
// Entry.
// ---------------------------------------------------------------------------
/** @param {string[]} [argv] */
async function main(argv) {
  const { cmd, opts } = parseArgs(argv || process.argv.slice(2));
  if (cmd === 'review') await cmdReview(opts);
  else if (cmd === 'consult') await cmdConsult(opts);
  else if (cmd === 'detect-models') await cmdDetect(opts);
  else fail('bad-command', `use: review | consult | detect-models (got: ${cmd || 'none'})`);
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
 * TEST-ONLY. Run one command IN THIS PROCESS through the same entry unwind the
 * CLI uses, so a test that replaced the transport (`__setTransportForTests`)
 * asserts on the one JSON line and the exit code a caller actually sees. Nothing
 * in the plugin calls this - the shipped entry is the `isRunAsScript()` arm below.
 * @param {string[]} argv
 * @returns {Promise<void>}
 */
export function __runCommandForTests(argv) {
  return main(argv).catch(unwind);
}
// Run only when executed as a script - importing the module (tests) exports
// the pure helpers without side effects. Compares realpaths (not just
// path.resolve, which normalizes but does not follow symlinks) so a
// symlinked plugin install still detects itself as the entry script; a
// realpathSync failure on either side (e.g. ENOENT on an odd argv[1])
// degrades to the normalized comparison rather than throwing.
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
