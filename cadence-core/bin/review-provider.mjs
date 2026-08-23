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
//   - The RESPONSE is bounded too, by bytes rather than by the host's wrapping
//     command timeout (RVP-01): every command's read path crosses one counter
//     inside `request()`, and a body past `MAX_RESPONSE_BYTES` destroys the
//     request and degrades to {ok:false, reason:"over-response"} rather than
//     being concatenated whole into memory. The `http` failure envelope's
//     `detail.body` is ALWAYS a string on the same reasoning: sanitized through
//     both lib/redact-url.mjs exports and capped at `MAX_HTTP_BODY_BYTES`, never
//     the whole body and never a parsed object for a small one.
//
// Usage:
//   review-provider.mjs review  --provider <openai|gemini|deepseek> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>] [--trigger <name>]
//       payload (stdin/file): {instruction, artifact} -> {ok, findings[]}
//       --trigger names the review trigger this call was fired for, and rides
//       the provider trace event so the call JOINS to its fire through the
//       correlation id both already derive (RVW-02). Optional: a call without
//       it writes exactly the event shape it wrote before.
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
// (:360), which binds the warnings of the same `.planning/config.json` layer and
// puts their COUNT on the provider trace event as `config_warnings` - a count,
// not the warning text, and only when there is at least one, and only on an
// event that was written at all (a run with no `.planning` cursor writes none).
// So this is a signal that the layer was torn beside the call it bounded, not a
// carrier of the warnings themselves. The two OTHER
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
import { redactUrl, redactCredentials } from './lib/redact-url.mjs';
import { evaluateFlag, CONTRACTS } from './lib/arg-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Output helpers. Everything the caller consumes is a single JSON object on
// stdout so the main-model adjudicator parses one blob, never stderr scrapes.
// The convention (one line, exitCode mirrors ok, no process.exit after the
// write) lives in lib/seam-io.mjs.
// ---------------------------------------------------------------------------
function ok(obj) { emit({ ok: true, ...obj }); throw DONE; }

// The subject of the provider trace event for the call currently running, set
// as each command's FIRST act (`beginProviderCall`) and read by `fail()` below.
// It is module-level because `fail()` is reached from sites that never see the
// command's own locals: `resolveProvider` (`bad-provider`, `bad-args`,
// `no-key`), `readPayload` and the two shape checks (`bad-payload`) and
// `assertUnderCap` (`over-cap`) all unwind BEFORE a request is built, and those
// five are the drop-outs that fire most in practice - a reviewer whose key is
// missing on this machine drops out of a fired trigger exactly as hard as one
// the wire refused. `null` means no command has begun, so `fail('bad-command')`
// from `main()` records nothing by construction rather than by a check.
/** @type {{command: string, provider: any, model: any, effort: any,
 *   trigger?: any, started: number}|null} */
let activeMeta = null;

// Exactly one event per call, whichever site records first. The explicit
// `traceProvider` calls in `callStructured` and at the two `bad-shape` sites run
// first and carry better detail than `fail()`'s would (`HTTP 404`, the named
// schema defect), so they set this and `fail()` then adds nothing.
let traceRecorded = false;

/**
 * Open the trace bracket for one command, before anything can refuse. Returns
 * the meta so the command's own `traceProvider` calls keep taking it as an
 * argument rather than reading module state.
 * @param {string} command
 * @param {{provider: any, model: any, effort: any, trigger?: any}} subject
 */
function beginProviderCall(command, subject) {
  activeMeta = { command, ...subject, started: Date.now() };
  traceRecorded = false;
  return activeMeta;
}

// `hint` is the third argument and rides as a conditional key, so an absent
// hint adds no key and no shipped assertion moves (phase-1 D-09/D-10). It is
// deliberately NOT passed to `traceProvider`: the trace records the
// degradation for whoever reads the bracket instead of the envelope, and its
// three arguments are the shipped record's shape - a hint is advice to the
// person at the terminal, not a fact about what happened.
function fail(reason, detail, hint) {
  // The degradation is recorded before the envelope is emitted, and never
  // instead of it: `traceProvider` never throws and never speaks, so this line
  // cannot change what the caller reads or when.
  if (activeMeta && !traceRecorded) {
    // `detail` is a string at every fail() site except `http`, whose object
    // detail would render `[object Object]` - and that site records itself
    // first, so this renders a real string or falls back to the reason.
    traceProvider(activeMeta, reason, typeof detail === 'string' && detail ? detail : reason);
  }
  emit({ ok: false, reason, detail: detail || null, ...(hint ? { hint } : {}) });
  throw DONE;
}

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
// Arg parsing: a leading subcommand, then each declared flag read through its
// row in lib/arg-contract.mjs (ARG-06).
//
// THE DEFECT THIS ENDS. The loop this replaced did `opts[a.slice(2)] =
// rest[i + 1]` with no flag-shape test, so a valueless flag ate the flag after
// it and the one after that was skipped: measured 2026-08-19,
// `review-provider.mjs consult --payload --provider openai` returned
// `{"ok":false,"reason":"bad-provider","detail":"unknown provider: undefined"}`
// - a refusal about a flag the caller DID pass, naming the wrong problem.
//
// THE VALUE DOOR ONLY. A flag PRESENT with a missing, empty or flag-shaped
// value is refused here by name; a flag genuinely ABSENT is not, even where its
// row says `required: true`. Presence belongs to the command handlers that own
// the wording - `resolveProvider` answers an absent `--provider` with
// `bad-provider` and an absent `--model` with `${cmd} needs --model`, and
// references/seams.md publishes both - so answering presence here would change
// which reason a caller sees for an input this phase was never about.
//
// PURE, and it stays that way: this function is exported and the test file
// imports it, so it emits nothing and throws nothing. A refusal rides back as
// `badArg`, a third field beside the `{cmd, opts}` shape its callers destructure,
// and `main` renders it as this bin's own `bad-args` - the contract mints no
// reason code (D-07) and references/seams.md already publishes that one.
// ---------------------------------------------------------------------------

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
  // The subcommand's own row plus the script-global one. An unrecognised
  // subcommand declares nothing and reads nothing; `main` answers it with
  // `bad-command`, exactly as it did before.
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

// The RESPONSE byte ceiling (RVP-01, #143), the other side of the same bound.
// `review.max_prompt_tokens` bounds what we SEND; nothing bounded what we HOLD,
// so a proxy error page or a runaway answer was concatenated whole into one
// string and the only thing stopping it was the execution host's wrapping
// command timeout - a bound Cadence does not own.
//
// Derived rather than round. The shipped request-side bound is 120000 estimated
// tokens, which is 480000 chars under the chars/4 proxy this file already uses,
// and a structured-output response is smaller than the artifact that produced it
// in every observed run. So 4 MiB sits at roughly 8.7x the largest payload this
// seam will ever send, and the finding bounds local validation enforces put the
// largest response it can ever ACCEPT near 0.5 MB, about 8x under this. A body
// that crosses this is not a review; it is something else wearing a 200.
//
// Not a config key (D-03): a knob nothing needs is what v2.7.0 deleted
// `workflow.subagent_timeout` for.
const MAX_RESPONSE_BYTES = 4194304;

// The tag that makes a ceiling crossing DISTINGUISHABLE from an ordinary socket
// error at the two catch arms below. A symbol on the error object, never a match
// on its message: a diagnostic string that decides control flow is a parser, and
// the message is free text nobody promised to keep.
const OVER_RESPONSE = Symbol('cadence-over-response');

// The HTTP failure envelope's body excerpt (RVP-01, D-04). ONE shape always - a
// capped, sanitized STRING - never a parsed object for a small body and a string
// for a large one, which would make every consumer branch on `typeof
// detail.body`.
//
// 1024 bytes, measured rather than round: the largest real OpenAI error body in
// this seam's own fixtures is 155 bytes (`model_not_found`) and a documented
// invalid-schema rejection runs about 226, so the whole diagnostic
// workflows/config-review.md reads this envelope FOR fits with more than 4x
// headroom, while a proxy HTML error page is bounded to a readable head.
const MAX_HTTP_BODY_BYTES = 1024;

// Appended in place of what was cut, so a reader can tell an excerpt from a
// whole body. Inside the cap, not added to it.
const TRUNCATED = ' ...[truncated]';

// How much of the raw body the sanitizers ever see. A COST bound, not a privacy
// one - see `bodyExcerpt` for the measurement that forces it and for why the
// window's edge cannot reach the excerpt.
const SANITIZE_WINDOW_BYTES = MAX_HTTP_BODY_BYTES * 4;

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
//
// The record brackets a CALL, not a REQUEST (corrected 2026-08-08, phase 1
// QW-05). The first form recorded only what happened past `request()`, which
// left the five drop-outs that need no network at all - `no-key`,
// `bad-provider`, `bad-args`, `bad-payload`, `over-cap` - writing nothing, and
// they are the ones that actually fire: a panel that silently shrank because a
// key was missing read as a panel that was always that size. `fail()` above is
// where that is closed, and `activeMeta` is why it can be.
// ---------------------------------------------------------------------------

// The repo+global config, read once per process and bound with its `warnings`.
//
// mergeLayers warnings[]: a torn config layer is why a tier reverse lookup can
// come back null and why the timeout and the prompt cap fall back to their
// defaults, so how MANY warnings there were rides the provider trace event
// (`config_warnings`, a count and only when non-zero) rather than the read
// dropping the fact entirely. Deliberately its OWN read: the two
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
 * @param {{command: string, provider: any, model: any, effort: any,
 *   trigger?: any, started: number}} meta
 * @param {string} outcome the fail() reason, or 'ok'
 * @param {string} [detail]
 */
function traceProvider(meta, outcome, detail) {
  // Marked before the attempt, not after it: the contract is one event per
  // call, so a write this seam could not complete must not license a second
  // attempt from `fail()` with a poorer detail string.
  traceRecorded = true;
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
      // WHICH trigger fired this call, so a cross-model review and a subagent
      // review of the same phase stop being one shape in the record. Emitted
      // only when the caller named one - absent otherwise, so a call made
      // without the flag writes byte-for-byte the event it wrote before. No
      // SECOND event: a duplicate would double-count every cross-model review
      // in renderTrace's `counts.provider`, and would let the seam-written and
      // model-written records disagree about one call (D-06).
      ...(typeof meta.trigger === 'string' && meta.trigger.trim()
        ? { trigger: meta.trigger.trim() } : {}),
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
      let bytes = 0;
      res.on('data', (c) => {
        // Real BYTES, not string length: no encoding is set on `res`, so a chunk
        // is a Buffer in production and a string in the fake, and
        // `Buffer.byteLength` is correct for both where `.length` is correct for
        // neither. Counted BEFORE the append, so the ceiling bounds what this
        // process holds rather than what it held one chunk ago.
        bytes += Buffer.byteLength(c);
        if (bytes > MAX_RESPONSE_BYTES) {
          // `req.destroy(err)` is the same abort the timeout handler below uses:
          // it forces an 'error' so the promise rejects down the one path the
          // callers already handle, and it stops the wire rather than reading a
          // body we have already refused.
          req.destroy(Object.assign(
            new Error(`response body over ${MAX_RESPONSE_BYTES} bytes (read ${bytes})`),
            { [OVER_RESPONSE]: true },
          ));
          return;
        }
        data += c;
      });
      // `req.destroy(err)` above (and the 'timeout' handler below) aborts an
      // ACTIVE response, and an aborted IncomingMessage emits its own 'error'.
      // Without this listener that is an unhandled 'error' event - the ceiling
      // would crash the process instead of degrading to `over-response`.
      // `reject` is first-wins, so whichever of req/res errors first decides.
      res.on('error', reject);
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

/**
 * The ONE mapping from a rejected `request()` to its degradation reason, shared
 * by the two callers so a third read path cannot be left knowing only
 * `transport`. A rejection the response ceiling tagged is `over-response`;
 * everything else is an ordinary socket failure and stays `transport` exactly as
 * before.
 *
 * The two words are deliberately distinct (D-02). Riding `transport` would leave
 * the trace, the caller and workflows/config-review.md unable to tell a provider
 * that flooded us from a socket that died, which are different conditions with
 * different recoveries - one is retryable, the other says this provider is
 * returning something that is not a review.
 *
 * Never returns in practice: `fail` throws the DONE sentinel, exactly as the
 * inline arms this replaced did.
 * @param {any} meta @param {any} e
 */
function failRequest(meta, e) {
  const reason = e && e[OVER_RESPONSE] ? 'over-response' : 'transport';
  traceProvider(meta, reason, e.message);
  fail(reason, e.message);
}

/**
 * The `body` of every `http` failure envelope: a sanitized, capped STRING.
 *
 * Sanitize BEFORE the excerpt is cut, never after. Cutting first can slice a
 * credential in half and leave its prefix in the envelope, which is a leak
 * wearing a cap. Two sanitizers because neither covers the other: `redactUrl`
 * takes credentials in URL position, `redactCredentials` takes the
 * `authorization: Bearer ...` and `<name>=<value>` spans a misconfigured gateway
 * echoes back.
 *
 * The WINDOW is a cost bound, and it is not optional. Measured 2026-08-17 on
 * this box: `redactUrl` is quadratic in its input (78ms at 10KB, 337ms at 20KB,
 * 5.1s at 80KB) because its scheme-less rule scans forward from every offset,
 * and `MAX_RESPONSE_BYTES` above lets a body reach 4 MiB - which extrapolates to
 * roughly four HOURS of CPU for one failure envelope. Sanitizing a bounded
 * window instead keeps the worst case in the tens of milliseconds. Fixing the
 * quadratic in `redactUrl` itself is the better repair and is not this plan's:
 * its four other callers hand it a git error message, so the cost only became
 * reachable here.
 *
 * The window's own edge is handled where it is CREATED, not here. Cutting a
 * prefix can leave a credential's opening quote inside the window and its
 * closing quote outside, so `redactCredentials` matches an unterminated quoted
 * value to end-of-input - see rule 4's VALUE alternatives in lib/redact-url.mjs.
 * The earlier reasoning on this line was that the cap discards anything near the
 * edge unless sanitizing shrank the window below the cap, in which case the
 * trailing token is dropped at the last whitespace. That arm is gated on
 * `clean <= room`, so a body that is almost entirely credential spans could
 * shrink to JUST PAST the cap, skip the safeguard, and carry 73 bytes of a value
 * into the envelope. Both regression fixtures are in the test file; the
 * whitespace arm below stays as a second line of defence, not the guarantee.
 *
 * The cut is by BYTES, and the head is trimmed back if slicing landed
 * mid-code-point, so the returned string never exceeds the cap however the body
 * was encoded.
 * EXPORTED for its own unit test and nothing else (D-09). The two
 * `fail('http', ...)` sites below are still its only callers in the tree; the
 * export exists because the leak class it guards - a credential cut by the
 * window edge - is reachable at unit level with one string, while reaching it
 * through `runFaked` costs a fake transport and a body tuned to a compression
 * ratio. Plain `export function`, matching every other pure helper here with
 * test value (`resolveTimeoutMs`, `validateFindings`, `estimatePromptTokens`);
 * the `__setTransportForTests` spelling is for the transport seam, which is a
 * replaceable module-private REFERENCE rather than a function to call.
 * @param {unknown} raw @returns {string}
 */
export function bodyExcerpt(raw) {
  const full = raw == null ? '' : String(raw);
  const buf = Buffer.from(full, 'utf8');
  const windowed = buf.length > SANITIZE_WINDOW_BYTES;
  let clean = redactCredentials(redactUrl(
    windowed ? buf.subarray(0, SANITIZE_WINDOW_BYTES).toString('utf8') : full));
  const room = MAX_HTTP_BODY_BYTES - Buffer.byteLength(TRUNCATED);
  if (windowed && Buffer.byteLength(clean) <= room) {
    const lastSpace = clean.search(/\s\S*$/);
    clean = lastSpace >= 0 ? clean.slice(0, lastSpace) : '';
  }
  if (!windowed && Buffer.byteLength(clean) <= MAX_HTTP_BODY_BYTES) return clean;
  let head = Buffer.from(clean, 'utf8').subarray(0, room).toString('utf8');
  // A partial code point re-encodes as U+FFFD, which is wider than the bytes it
  // replaced; drop characters until it fits rather than trusting the slice.
  while (Buffer.byteLength(head) > room) head = head.slice(0, -1);
  return head + TRUNCATED;
}

// ---------------------------------------------------------------------------
// The normalized finding shape every provider adapter must return. Kept in
// one place so the JSON schema we send and the shape we assert never drift.
// ---------------------------------------------------------------------------
const SEVERITY = ['blocker', 'high', 'medium', 'low'];

// The bounds the finding shape has always implied and never stated (RVP-02).
// Sized against what this tree has actually produced rather than picked round:
// the longest values in the one committed findings file
// (.planning/phases/1/REVIEW-risk_surface-plan-1.md) are file 39 chars, claim
// 159 and failure_scenario 376, and the largest `raised` count across the 19
// adjudication events in .planning/trace.jsonl is 9 - from a PANEL, the union
// of every reviewer. So each bound sits an order of magnitude above the
// observed longest, and their product caps what local validation can accept at
// roughly 0.5 MB, well inside the 4 MiB response ceiling.
//
// There is deliberately NO `minItems`: an empty findings array is what a
// reviewer that found nothing returns, and refusing it would turn a clean
// review into a `bad-shape` degradation.
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

/**
 * String length in Unicode CODE POINTS, which is what JSON Schema's
 * `minLength`/`maxLength` count. JavaScript's `.length` counts UTF-16 code
 * units, so one astral character (an emoji, most CJK extension blocks) reads
 * as 2 and a `maxLength` check written on it refuses a string the schema
 * accepts. `lib/schema-eval.mjs` counts the same way for the same reason, and
 * the agreement test pins both against a non-BMP fixture.
 * @param {string} s @returns {number}
 */
function codePoints(s) {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

/**
 * Mirror of FINDING_SCHEMA's constraints, one named diagnostic each. Every
 * refusal here is a refusal the canonical schema also makes - `line` below 1,
 * an empty or over-long `file`/`claim`/`failure_scenario`, a findings array
 * past `maxItems`, and an unknown key at either level, since
 * `additionalProperties:false` sits at both. The two sides are checked against
 * each other by test (the agreement table in review-provider.test.mjs runs
 * every fixture through this function AND through a keyword-limited evaluator
 * against the live schema), so the pairing is enforced rather than remembered:
 * a keyword added to FINDING_SCHEMA without a mirror here reddens that test.
 *
 * The diagnostic is never a shared "invalid finding" string, because it is what
 * reaches the user as `{ok:false, reason:"bad-shape", detail}` and a
 * degradation the user cannot act on is the silent drop this guard exists to
 * end. Pure and total: returns null or a string, never throws.
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
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`,
    `pass --provider as one of: ${Object.keys(ADAPTERS).join(', ')}`);
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
    failRequest(meta, e);
  }
  if (res.status < 200 || res.status >= 300) {
    traceProvider(meta, 'http', `HTTP ${res.status}`);
    fail('http', { status: res.status, body: bodyExcerpt(res.raw) });
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
  // FIRST act, before anything can refuse: `resolveProvider` and the payload
  // checks below both unwind through fail(), which needs the subject to name.
  // The provider is `opts.provider` and not the resolved one for the same
  // reason - on the `bad-provider` path there is no resolved one.
  const meta = beginProviderCall('review',
    { provider: opts.provider, model: opts.model, effort: opts.effort,
      trigger: opts.trigger });
  const { provider, adapter, key } = resolveProvider(opts, 'review');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.instruction !== 'string' || typeof payload.artifact !== 'string') {
    fail('bad-payload', 'payload needs {instruction, artifact}, both strings');
  }
  assertUnderCap(payload.instruction, payload.artifact);
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
  const meta = beginProviderCall('consult',
    { provider: opts.provider, model: opts.model, effort: opts.effort });
  const { provider, adapter, key } = resolveProvider(opts, 'consult');
  const payload = await readPayload(opts);
  if (!payload || typeof payload.situation !== 'string') {
    fail('bad-payload', 'payload needs {situation}, a string');
  }
  assertUnderCap(payload.situation);
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
  // `detect-models` carries no model and no effort at all, so its `tier` is
  // null by construction rather than by a failed lookup - the two fields stay
  // pinned to null here rather than reading `opts`, which would start recording
  // a `--model` this command never sends.
  const meta = beginProviderCall('detect-models', { provider, model: null, effort: null });
  const adapter = ADAPTERS[provider];
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`);

  const { key, where } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`);

  const { path: p, method } = adapter.detectRequest();
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key) });
  } catch (e) {
    failRequest(meta, e);
  }
  if (res.status < 200 || res.status >= 300) {
    traceProvider(meta, 'http', `HTTP ${res.status}`);
    fail('http', { status: res.status, body: bodyExcerpt(res.raw) });
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
  // Cleared per invocation. Production runs one command per process, but the
  // in-process test harness runs several, and a bracket left over from the
  // previous one would let `fail('bad-command')` record an event against a
  // subject this call never had.
  activeMeta = null;
  traceRecorded = false;
  const { cmd, opts, badArg } = parseArgs(argv || process.argv.slice(2));
  // The argument-shape refusal comes first: a flag present with nothing usable
  // after it is a malformed CALL, and answering it as a domain problem
  // (`bad-provider: unknown provider: undefined`) is what this closes.
  if (badArg) fail('bad-args', badArg);
  else if (cmd === 'review') await cmdReview(opts);
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
