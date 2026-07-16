#!/usr/bin/env node
// @ts-check
// config.mjs - zero-dep validator seam for .planning/config.json.
// The schema in ../config.schema.json is the single source of truth; the
// cad-config workflow (interactive menu + direct-set) calls this so no invalid
// value is ever written. Never blocks the spine: callers degrade on {ok:false}.
//
// Subcommands (all print one JSON line on stdout):
//   validate [--file <path>|--global]        validate a whole config file
//   check <key=value> ...                     validate one or more dotted key=value pairs
//   set [--file <path>|--global] <key=value>  validate pairs, then write them into the file
//   get [--file <path>] [key ...]             EFFECTIVE values (repo > global > schema
//                                             defaults); no keys = all. The only correct
//                                             way for a workflow to read config.
//   keys                                      dump the schema keys (for menu/catalog derivation)
//
// Default --file is .planning/config.json relative to cwd. --global targets the
// user-global layer (auto-created on set); route.mjs merges global under repo at
// read time (precedence repo > global > defaults). Each file is validated on its
// own - every layer must be independently valid.

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GLOBAL_CONFIG, mergeLayers } from './lib/config-merge.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import { DONE, emit } from './lib/seam-io.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(
  readFileSync(join(HERE, '..', 'config.schema.json'), 'utf8'),
).keys;

// Seam convention lives in lib/seam-io.mjs. fail() throws DONE so the
// dispatch unwinds without process.exit().
const out = emit;
const fail = (reason, detail) => { out({ ok: false, reason, detail }); throw DONE; };

// --- value typing ------------------------------------------------------------

// Validate a single already-parsed value against a schema spec.
// Returns null if ok, else an error string.
/** @param {{type:string, min?:number, values?:any[]}} spec @param {any} v */
function checkValue(spec, v) {
  switch (spec.type) {
    case 'bool':
      return typeof v === 'boolean' ? null : 'expected true or false';
    case 'int':
      if (!Number.isInteger(v)) return 'expected an integer';
      if (spec.min !== undefined && v < spec.min) return `must be >= ${spec.min}`;
      return null;
    case 'string':
      return typeof v === 'string' ? null : 'expected a string';
    case 'string_or_null':
      return v === null || typeof v === 'string' ? null : 'expected a string or null';
    case 'enum':
      return spec.values.includes(v) ? null : `must be one of: ${spec.values.join(', ')}`;
    case 'array_string':
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) return 'expected a list of strings';
      return null;
    case 'array_enum':
      if (!Array.isArray(v)) return 'expected a list';
      { const bad = v.filter((x) => !spec.values.includes(x));
        return bad.length ? `invalid entries [${bad.join(', ')}]; allowed: ${spec.values.join(', ')}` : null; }
    default:
      return `unknown schema type ${spec.type}`;
  }
}

// Parse a CLI value token: JSON where it parses (true/false/12/null/"s"/[...]),
// otherwise a bare string (so `mode=interactive` -> "interactive").
function parseToken(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

// Flatten a config object to dotted leaf paths. Arrays and null are leaves.
/** @param {Record<string, any>} obj @param {string} prefix @param {Record<string, any>} acc */
function flatten(obj, prefix, acc) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, acc);
    else acc[path] = v;
  }
  return acc;
}

function splitPair(tok) {
  const i = tok.indexOf('=');
  if (i < 0) return null;
  return [tok.slice(0, i), tok.slice(i + 1)];
}

// --- subcommands -------------------------------------------------------------

function validate(file) {
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { fail('read', `cannot read/parse ${file}: ${e.message}`); }
  const leaves = flatten(cfg, '', {});
  const errors = [];
  for (const [path, v] of Object.entries(leaves)) {
    const spec = SCHEMA[path];
    if (!spec) { errors.push({ key: path, error: 'unknown key' }); continue; }
    const msg = checkValue(spec, v);
    if (msg) errors.push({ key: path, error: msg, value: v });
  }
  out({ ok: errors.length === 0, file, checked: Object.keys(leaves).length, errors });
}

// Validate key=value pairs. Returns {pairs, errors}.
function checkPairs(tokens) {
  const pairs = [];
  const errors = [];
  for (const tok of tokens) {
    const kv = splitPair(tok);
    if (!kv) { errors.push({ key: tok, error: 'not a key=value pair' }); continue; }
    const [key, raw] = kv;
    const spec = SCHEMA[key];
    if (!spec) { errors.push({ key, error: 'unknown key' }); continue; }
    const value = parseToken(raw);
    const msg = checkValue(spec, value);
    if (msg) { errors.push({ key, error: msg, value }); continue; }
    pairs.push({ key, value });
  }
  return { pairs, errors };
}

// Cross-key checks the per-key schema types cannot express. Advisory only:
// warnings, never errors - a legal-but-surprising value stays settable (a
// user may deliberately disable escalation this way).
function crossWarnings(pairs) {
  const warnings = [];
  for (const { key, value } of pairs) {
    if (key === 'model.auto.ceiling') {
      try {
        const t = JSON.parse(readFileSync(join(HERE, '..', 'route-table.json'), 'utf8'));
        const order = t.profile_order || [];
        const base = t.auto && t.auto.base_profile;
        if (order.indexOf(String(value)) <= order.indexOf(base)) {
          warnings.push({
            key,
            warning: `ceiling "${value}" is at/below auto's base profile "${base}": ` +
              'failure escalation holds at base (it never demotes) - use a higher ceiling to enable raises',
          });
        }
      } catch { /* no table -> no cross-check; per-key validation already ran */ }
    }
  }
  return warnings;
}

function setInto(obj, dotted, value) {
  const parts = dotted.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === undefined || node[parts[i]] === null || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

// `create` (the --global path) starts from an empty config and makes the parent
// dir if the file does not exist yet; a corrupt existing file still fails.
function set(file, tokens, create) {
  const { pairs, errors } = checkPairs(tokens);
  if (errors.length) fail('invalid', errors);
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) {
    if (create && e.code === 'ENOENT') cfg = {};
    else fail('read', `cannot read/parse ${file}: ${e.message}`);
  }
  for (const { key, value } of pairs) setInto(cfg, key, value);
  if (create) mkdirSync(dirname(file), { recursive: true });
  // atomicWrite (temp + rename), not a bare write: config is a live layer
  // every other seam reads mid-session; a crash must never leave it torn.
  atomicWrite(file, JSON.stringify(cfg, null, 2) + '\n');
  const warnings = crossWarnings(pairs);
  out({ ok: true, file, changed: pairs, ...(warnings.length ? { warnings } : {}) });
}

// The effective value set: schema defaults, overlaid by the global then the
// repo layer (shared merge lib - identical semantics to route.mjs). Output is
// a flat dotted-key map, so callers read values without re-flattening.
function get(file, keys) {
  const { config, source } = mergeLayers(file);
  const layered = flatten(config, '', {});
  /** @type {Record<string, any>} */
  const values = {};
  const wanted = keys.length ? keys : Object.keys(SCHEMA);
  const unknown = wanted.filter((k) => !SCHEMA[k]);
  if (unknown.length) fail('unknown-key', unknown);
  for (const k of wanted) {
    values[k] = layered[k] !== undefined ? layered[k] : SCHEMA[k].default;
  }
  out({ ok: true, values, source });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
function optFile(tokens) {
  const gi = tokens.indexOf('--global');
  if (gi >= 0) return { file: GLOBAL_CONFIG, global: true, tokens: tokens.filter((_, j) => j !== gi) };
  const i = tokens.indexOf('--file');
  if (i < 0) return { file: '.planning/config.json', global: false, tokens };
  return { file: tokens[i + 1], global: false, tokens: tokens.filter((_, j) => j !== i && j !== i + 1) };
}

try {
  if (cmd === 'validate') { const { file } = optFile(rest); validate(file); }
  else if (cmd === 'check') {
    const { pairs, errors } = checkPairs(rest);
    const warnings = crossWarnings(pairs);
    out({ ok: errors.length === 0, errors, ...(warnings.length ? { warnings } : {}) });
  }
  else if (cmd === 'set') { const { file, tokens, global } = optFile(rest); set(file, tokens, global); }
  else if (cmd === 'get') { const { file, tokens } = optFile(rest); get(file, tokens); }
  else if (cmd === 'keys') { out({ ok: true, keys: SCHEMA }); }
  else fail('usage', 'subcommand: validate | check | set | get | keys');
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
