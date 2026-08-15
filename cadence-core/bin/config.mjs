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
import { GLOBAL_CONFIG, mergeLayers, isPlainObject } from './lib/config-merge.mjs';
import { retiredKeyError, retiredKeysIn } from './lib/retired-keys.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import { DONE, emit } from './lib/seam-io.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// SCHEMA is loaded lazily, inside the dispatch try block below, so a missing
// or malformed shipped config.schema.json degrades to {ok:false} instead of
// crashing at import time. CADENCE_CONFIG_SCHEMA overrides the path ONLY when
// the `CADENCE_TEST_SEAM` sentinel holds (lib/test-seam.mjs); without it the
// variable is ignored and the shipped file is read, silently - this constant
// resolves at module load, before any dispatch exists to carry a warning. The
// gate is the point: the schema decides which keys are known and which carry
// the `src: "global"` marker, so an ungated override re-opens CFG-02.
let SCHEMA;
const SCHEMA_PATH = (testSeamOpen() && process.env.CADENCE_CONFIG_SCHEMA)
  || join(HERE, '..', 'config.schema.json');

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
      // `null` is rendered as the literal, not left to Array#join's empty
      // string: every `default: null` enum ends its accepted set with null, and
      // joining it produced a dangling `", "` that reads as a truncated message
      // rather than as the settable value it is ("must be one of: high, xhigh, ").
      return spec.values.includes(v) ? null
        : `must be one of: ${spec.values.map((x) => (x === null ? 'null' : x)).join(', ')}`;
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
//
// The skip is exactly `_meta` and never every `_`-prefixed key. It exists for
// the annotation block config.schema.json:2-5 documents and the repo's own
// template idiom encourages, so it cannot be deleted - but as a PREFIX rule it
// also swallowed `__proto__`, which is how `validate` answered
// {"ok":true,"checked":0,"errors":[]} on a hostile config the guard was already
// obeying: inspection reported a file clean that enforcement read as settings.
//
// And the accumulation defines an own property rather than assigning `acc[path]`,
// for the same reason the merge does (lib/config-merge.mjs): a TOP-LEVEL leaf
// named `__proto__` assigned at that key runs Object.prototype's setter, which
// reparents the accumulator instead of recording a key - leaving `checked` at 0
// again for the scalar spelling, one narrowing later. (An object-valued
// `__proto__` recurses to dotted paths that never touch `acc`'s own `__proto__`,
// so the scalar form is the one that shows this.)
/** @param {Record<string, any>} obj @param {string} prefix @param {Record<string, any>} acc */
function flatten(obj, prefix, acc) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, acc);
    else Object.defineProperty(acc, path, { value: v, writable: true, enumerable: true, configurable: true });
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
    // hasOwn, not a bare `SCHEMA[path]`: the narrowed flatten above now reports
    // a leaf literally named `__proto__`, and a bare lookup answers that with
    // Object.prototype - a truthy "spec" carrying no `type`, which reached the
    // user as "unknown schema type undefined" instead of naming the unknown key.
    const spec = Object.hasOwn(SCHEMA, path) ? SCHEMA[path] : undefined;
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

// The gate keys, whose schema default is the `null` sentinel rather than a
// gate: route-table.json is what fires and the level decides (GAT-02).
// Matched by shape rather than a hand-kept list, so a fifth trigger is
// covered the day its key lands.
const GATE_KEY = /^review\.triggers\.[^.]+\.gate$/;

// The effective value set: schema defaults, overlaid by the global then the
// repo layer (shared merge lib - identical semantics to route.mjs). Output is
// a flat dotted-key map, so callers read values without re-flattening.
// `asGlobal` is the --global arm saying so: that path hands GLOBAL_CONFIG in as
// the file to read, which makes one file BOTH layers, and only the caller knows
// the read was addressed at the user-global layer rather than at a repo config
// the global env happens to alias. It moves the `source` label, nothing else.
function get(file, keys, asGlobal) {
  const { config, source, warnings, layers, scopeWarnings } = mergeLayers(file, { asGlobal });
  // A key the schema dropped is invisible to the read below - it resolves at
  // the default and looks configured. Naming it here is what keeps an upgraded
  // repo from silently routing on a value nothing reads.
  //
  // `scopeWarnings` rides here for the same reason and by the same route: `get`
  // is the read face everything reaches these keys through, so folding it in
  // once is the whole wiring (D-03). It stays OFF `mergeLayers`'s own
  // `warnings[]`, which git-publish reads as a refusal to mutate (D-05).
  const allWarnings = [...(warnings || []), ...retiredKeysIn(config), ...(scopeWarnings || [])];
  const layered = flatten(config, '', {});
  /** @type {Record<string, any>} */
  const values = {};
  const wanted = keys.length ? keys : Object.keys(SCHEMA);
  const unknown = wanted.filter((k) => !SCHEMA[k]);
  if (unknown.length) fail('unknown-key', unknown);
  for (const k of wanted) {
    values[k] = layered[k] !== undefined ? layered[k] : SCHEMA[k].default;
    // The read face says WHICH of the two states a gate is in. The value line
    // above is unchanged (D-06) - the schema sentinel does that work - but a
    // bare `null` cannot tell a reader "no layer set one, the level decides"
    // apart from a layer that wrote null, which is what GAT-02 asks for. So
    // the answer carries a warning naming where the level IS resolved.
    //
    // Only on an EXPLICIT read (D-02). A keyless `get` walks every schema
    // key, so warning there appends four lines to every full read - prose
    // that workflows/milestone.md and verify.md relay straight to the user -
    // for a caller that asked about no gate in particular.
    //
    // It never states what the level fires and never reads route-table.json
    // (D-07): this seam does not know the stakes level, and answering as if
    // it did is the same defect pointed the other way.
    if (keys.length && layered[k] === undefined && GATE_KEY.test(k)) {
      allWarnings.push(`${k} is unset: no config layer pins this gate, so the `
        + 'stakes level decides it - `route.mjs resolve` answers it for a level');
    }
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
  // A `--file` with nothing usable after it is what an interpolated
  // `--file $VAR` on an unset variable produces. Left alone it fell through as
  // `file: undefined`: `set` degraded to reason:"internal" with a raw Node type
  // error, `validate` said "cannot read/parse undefined", and `get` answered
  // ok:true - a full effective read of the user-global layer alone, silently
  // answering about a file the caller never named.
  //
  // Both spellings, because the shell produces both: unquoted `$VAR` drops the
  // token entirely (undefined), quoted `"$VAR"` passes an EMPTY one. Testing
  // only for undefined left the quoted spelling - the one a careful script
  // writer uses - falling through to that silent `get`.
  if (!tokens[i + 1]) {
    fail('usage', '--file needs a path after it: --file <config file> (or --global)');
  }
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
  else if (cmd === 'get') { const { file, tokens, global } = optFile(rest); get(file, tokens, global); }
  else if (cmd === 'keys') { out({ ok: true, keys: SCHEMA }); }
  else fail('usage', 'subcommand: validate | check | set | get | keys');
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
