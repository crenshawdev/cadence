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
//     Gemini responseSchema), never scraped. We assert the shape on return.
//   - Keys resolve env-first, then a shared 600-perm env file. Lazy, never
//     logged. A missing key is not fatal: we emit {ok:false, reason:"no-key"}
//     so the caller falls back to claude-subagent.
//   - Any failure (offline, bad key, http error, bad shape) degrades to a
//     structured {ok:false, reason, detail} on stdout with a nonzero exit -
//     the review subsystem never crashes the spine on a provider problem.
//
// Usage:
//   review-provider.mjs review  --provider <openai|gemini> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>]
//       payload (stdin/file): {instruction, artifact} -> {ok, findings[]}
//   review-provider.mjs consult --provider <openai|gemini> --model <id>
//                               [--effort <level>] [--payload <file>|-]
//                               [--key-file <path>]
//       payload (stdin/file): {situation} -> {ok, angles[]}  (dead-end help)
//   review-provider.mjs detect-models --provider <openai|gemini> [--key-file <path>]
//
// --key-file overrides the shared env-file path (config review.key_file); an
// env-set key still wins over it. Omitted -> the XDG default.
//
// The review payload (JSON, from --payload file or stdin) is:
//   { "instruction": "<what to critique and how>",
//     "artifact": "<the plan / diff / files to review>" }
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { DONE, emit } from './lib/seam-io.mjs';

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
process.on('unhandledRejection', (e) => {
  if (e === DONE) return;
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
});
process.on('uncaughtException', (e) => {
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
const ENV_VAR = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' };

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
const REQUEST_TIMEOUT_MS = 120000;

function request(urlStr, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payload = body == null ? null : JSON.stringify(body);
    const req = https.request(url, {
      method,
      timeout: REQUEST_TIMEOUT_MS,
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
    req.on('timeout', () => req.destroy(new Error(`request timed out after ${REQUEST_TIMEOUT_MS}ms`)));
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
async function callStructured(adapter, key, reqSpec) {
  const { path: p, method, body } = reqSpec;
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key), body });
  } catch (e) {
    fail('transport', e.message);
  }
  if (res.status < 200 || res.status >= 300) {
    fail('http', { status: res.status, body: res.json || res.raw });
  }
  const text = adapter.extractText(res.json);
  if (typeof text !== 'string') fail('no-output', 'no text in provider response');
  try { return JSON.parse(text); } catch (e) { fail('bad-json', e.message); }
}

async function cmdReview(opts) {
  const { provider, adapter, key } = resolveProvider(opts, 'review');
  const payload = await readPayload(opts);
  if (!payload || !payload.instruction || !payload.artifact) {
    fail('bad-payload', 'payload needs {instruction, artifact}');
  }
  const parsed = await callStructured(adapter, key, adapter.structuredRequest({
    model: opts.model, effort: opts.effort,
    system: payload.instruction, user: payload.artifact,
    schema: FINDING_SCHEMA, schemaName: 'cadence_review',
  }));
  const bad = validateFindings(parsed);
  if (bad) fail('bad-shape', bad);
  ok({ provider, model: opts.model, findings: parsed.findings });
}

async function cmdConsult(opts) {
  const { provider, adapter, key } = resolveProvider(opts, 'consult');
  const payload = await readPayload(opts);
  if (!payload || !payload.situation) {
    fail('bad-payload', 'payload needs {situation}');
  }
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
  }));
  const bad = validateConsult(parsed);
  if (bad) fail('bad-shape', bad);
  ok({ provider, model: opts.model, angles: parsed.angles });
}

async function cmdDetect(opts) {
  const provider = opts.provider;
  const adapter = ADAPTERS[provider];
  if (!adapter) fail('bad-provider', `unknown provider: ${provider}`);

  const { key, where } = resolveKey(provider, opts['key-file']);
  if (!key) fail('no-key', `set ${where}`);

  const { path: p, method } = adapter.detectRequest();
  let res;
  try {
    res = await request(adapter.base + p, { method, headers: adapter.authHeaders(key) });
  } catch (e) {
    fail('transport', e.message);
  }
  if (res.status < 200 || res.status >= 300) {
    fail('http', { status: res.status, body: res.json || res.raw });
  }
  const ids = adapter.extractModels(res.json);
  ok({ provider, models: classify(provider, ids) });
}

// Tag each detected id with a tier hint (references/model-hints.json). First
// drop non-text modalities (embeddings, audio, image, ...) that can't do text
// review, so the candidate list is review-usable. Then: known id ->
// {tier, high_effort}; unknown text id -> tier:null so cad-config asks the user
// to place it. Missing/broken hint file degrades to all-unknown, never errors.
/** @param {string} provider @param {string[]} ids */
export function classify(provider, ids) {
  let rules = [], exclude = [];
  try {
    const hints = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'references', 'model-hints.json'), 'utf8'));
    rules = (hints.rules && hints.rules[provider]) || [];
    exclude = hints.exclude || [];
  } catch { /* no hints -> everything unknown, nothing excluded */ }
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

// ---------------------------------------------------------------------------
// Entry.
// ---------------------------------------------------------------------------
async function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (cmd === 'review') await cmdReview(opts);
  else if (cmd === 'consult') await cmdConsult(opts);
  else if (cmd === 'detect-models') await cmdDetect(opts);
  else fail('bad-command', `use: review | consult | detect-models (got: ${cmd || 'none'})`);
}
// Run only when executed as a script - importing the module (tests) exports
// the pure helpers without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    if (e === DONE) return; // normal ok()/fail() unwind
    emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
  });
}
