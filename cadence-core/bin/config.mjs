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

import { readFileSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import { GLOBAL_CONFIG, mergeLayers, isPlainObject } from './lib/config-merge.mjs';
import { retiredKeyError, retiredKeysIn } from './lib/retired-keys.mjs';
import { surfaceKeyError, OVERRIDE_PREFIX } from './lib/risk-surfaces.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import { DONE, emit } from './lib/seam-io.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// SCHEMA is loaded lazily, inside the dispatch try block below, so a missing
// or malformed shipped config.schema.json degrades to {ok:false} instead of
// crashing at import time. CADENCE_CONFIG_SCHEMA overrides the path
// (hermetic test injection only; production always uses the shipped file).
let SCHEMA;
const SCHEMA_PATH = process.env.CADENCE_CONFIG_SCHEMA || join(HERE, '..', 'config.schema.json');

// Seam convention lives in lib/seam-io.mjs. fail() throws DONE so the
// dispatch unwinds without process.exit().
const out = emit;
const fail = (reason, detail) => { out({ ok: false, reason, detail }); throw DONE; };

// --- value typing ------------------------------------------------------------

// Validate a single already-parsed value against a schema spec.
// Returns null if ok, else an error string.
/** @param {{type:string, min?:number, max?:number, values?:any[]}} spec @param {any} v */
function checkValue(spec, v) {
  switch (spec.type) {
    case 'bool':
      return typeof v === 'boolean' ? null : 'expected true or false';
    case 'int':
      if (!Number.isInteger(v)) return 'expected an integer';
      if (spec.min !== undefined && v < spec.min) return `must be >= ${spec.min}`;
      if (spec.max !== undefined && v > spec.max) return `must be <= ${spec.max}`;
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
  if (!isPlainObject(cfg)) {
    return out({ ok: false, file, checked: 0,
      errors: [{ key: '(root)', error: 'top-level config must be a JSON object', value: cfg }] });
  }
  const leaves = flatten(cfg, '', {});
  const errors = [];
  for (const [path, v] of Object.entries(leaves)) {
    // Same message the write face gives, for the same reason the retired-key
    // check states: a value refused at `set` with one message and named
    // differently at `validate` is the drift this repo keeps closing.
    const surfaceErr = surfaceKeyError(path, Object.keys(SCHEMA));
    if (surfaceErr) { errors.push({ key: path, error: surfaceErr }); continue; }
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
    // BEFORE the schema lookup, deliberately: a retired key is one the schema
    // no longer holds, so the `!spec` arm below would answer a rename with the
    // generic 'unknown key' and leave the user to find the replacement. This
    // runs inside checkPairs, which both `set` and `check` reach before any
    // read or write, so the refusal stays atomic.
    const retired = retiredKeyError(key);
    if (retired) { errors.push({ key, error: retired }); continue; }
    // Same placement, same reason: `risk.override.athu` is a misspelled surface,
    // and the generic `unknown key` arm below would answer it with nothing the
    // user can act on. This names every accepted surface instead.
    const surfaceErr = surfaceKeyError(key, Object.keys(SCHEMA));
    if (surfaceErr) { errors.push({ key, error: surfaceErr }); continue; }
    const spec = SCHEMA[key];
    if (!spec) { errors.push({ key, error: 'unknown key' }); continue; }
    const value = parseToken(raw);
    const msg = checkValue(spec, value);
    if (msg) { errors.push({ key, error: msg, value }); continue; }
    pairs.push({ key, value });
  }
  return { pairs, errors };
}

// A dotted key writes through intermediate containers. Auto-vivifying one that
// is ABSENT (missing, or an explicit null holding no data) is the point of
// `set`; silently replacing one that already holds an array or a scalar throws
// its contents away, which is the same data loss the `(root)` check refuses at
// depth 0. checkPaths refuses it the same way and BEFORE any pair is applied,
// so a multi-pair set is all-or-nothing rather than half-written.
function checkPaths(cfg, pairs) {
  const errors = [];
  for (const { key } of pairs) {
    const parts = key.split('.');
    let node = cfg;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = node[parts[i]];
      if (next === undefined || next === null) break;   // absent -> setInto creates it
      if (!isPlainObject(next)) {
        errors.push({
          key,
          error: `cannot set through "${parts.slice(0, i + 1).join('.')}": ` +
            'it holds a non-object; remove or replace it first',
          value: next,
        });
        break;
      }
      node = next;
    }
  }
  return errors;
}

function setInto(obj, dotted, value) {
  const parts = dotted.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === undefined || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

// The `risk.override.<surface>` family is the one key family whose whole purpose
// is to LOWER a floor, and its schema `src` says `repo`. `src` is metadata
// nothing in bin/ reads today (closing that generally is phase 6's shape), so
// without this one narrow refusal a single
// `config.mjs set risk.override.auth=true --global` would waive the auth floor
// in every repository on the machine, forever, with nothing in any of those
// repos recording it - the silent lowering this whole phase exists to prevent.
/**
 * Filesystem identity for a path that may not exist yet. `--global` AUTO-CREATES
 * the global file, so absence is the ordinary case, not an error: fall back to
 * the realpath of the parent directory joined with the basename, and to a plain
 * absolute resolve when even the directory is absent. That is what lets the
 * comparison below see through a symlinked ~/.claude, a relative path and a
 * trailing-slash spelling alike.
 * @param {string} p
 * @returns {string}
 */
function fsIdentity(p) {
  try { return realpathSync(p); } catch { /* not created yet - fall through */ }
  try { return join(realpathSync(dirname(p)), basename(p)); } catch { /* dir absent too */ }
  return resolvePath(p);
}

/** @param {string} file @param {boolean} create @param {{key:string}[]} pairs */
function repoScopedErrors(file, create, pairs) {
  // Identity, not string equality: `--file <global-dir>/./config.json` wrote
  // straight through the refusal, and a symlink, a relative path or a trailing
  // slash opened the same door. The GLOBAL_CONFIG guard stays non-empty-only -
  // lib/config-merge.mjs deliberately yields '' where homedir() throws, and ''
  // must never match a real target.
  const targetsGlobal = create
    || (Boolean(GLOBAL_CONFIG) && fsIdentity(file) === fsIdentity(GLOBAL_CONFIG));
  if (!targetsGlobal) return [];
  return pairs.filter((p) => p.key.startsWith(OVERRIDE_PREFIX)).map((p) => ({
    key: p.key,
    error: `"${p.key}" is repo-scoped (src: repo): a risk-floor waiver applies to `
      + 'ONE repository, so it cannot be written to the user-global layer - '
      + 'set it with --file <repo config> instead',
  }));
}

// `create` (the --global path) starts from an empty config and makes the parent
// dir if the file does not exist yet; a corrupt existing file still fails.
function set(file, tokens, create) {
  const { pairs, errors } = checkPairs(tokens);
  // Both refusals land in ONE detail list, before any read or write, so a
  // multi-pair set stays all-or-nothing.
  const scoped = repoScopedErrors(file, create, pairs);
  if (errors.length || scoped.length) fail('invalid', [...errors, ...scoped]);
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) {
    if (create && e.code === 'ENOENT') cfg = {};
    else fail('read', `cannot read/parse ${file}: ${e.message}`);
  }
  if (!isPlainObject(cfg)) fail('invalid', [{ key: '(root)', error: 'top-level config must be a JSON object', value: cfg }]);
  const pathErrors = checkPaths(cfg, pairs);
  if (pathErrors.length) fail('invalid', pathErrors);
  for (const { key, value } of pairs) setInto(cfg, key, value);
  if (create) mkdirSync(dirname(file), { recursive: true });
  // atomicWrite (temp + rename), not a bare write: config is a live layer
  // every other seam reads mid-session; a crash must never leave it torn.
  atomicWrite(file, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, file, changed: pairs });
}

// The effective value set: schema defaults, overlaid by the global then the
// repo layer (shared merge lib - identical semantics to route.mjs). Output is
// a flat dotted-key map, so callers read values without re-flattening.
function get(file, keys) {
  const { config, source, warnings } = mergeLayers(file);
  // A key the schema dropped is invisible to the read below - it resolves at
  // the default and looks configured. Naming it here is what keeps an upgraded
  // repo from silently routing on a value nothing reads.
  const allWarnings = [...(warnings || []), ...retiredKeysIn(config)];
  const layered = flatten(config, '', {});
  /** @type {Record<string, any>} */
  const values = {};
  const wanted = keys.length ? keys : Object.keys(SCHEMA);
  const unknown = wanted.filter((k) => !SCHEMA[k]);
  if (unknown.length) fail('unknown-key', unknown);
  for (const k of wanted) {
    values[k] = layered[k] !== undefined ? layered[k] : SCHEMA[k].default;
  }
  out({ ok: true, values, source, ...(allWarnings.length ? { warnings: allWarnings } : {}) });
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
  try {
    SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')).keys;
  } catch (e) {
    fail('bad-schema', `cannot read/parse ${SCHEMA_PATH}: ${e.message}`);
  }
  if (cmd === 'validate') { const { file } = optFile(rest); validate(file); }
  else if (cmd === 'check') {
    // The same failure contract `set` speaks (and workflows/config.md
    // documents): one shape for both faces, so a caller reads `detail` once.
    const { errors } = checkPairs(rest);
    if (errors.length) out({ ok: false, reason: 'invalid', detail: errors });
    else out({ ok: true });
  }
  else if (cmd === 'set') { const { file, tokens, global } = optFile(rest); set(file, tokens, global); }
  else if (cmd === 'get') { const { file, tokens } = optFile(rest); get(file, tokens); }
  else if (cmd === 'keys') { out({ ok: true, keys: SCHEMA }); }
  else fail('usage', 'subcommand: validate | check | set | get | keys');
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
