#!/usr/bin/env node
// config.mjs - zero-dep validator seam for .planning/config.json.
// The schema in ../config.schema.json is the single source of truth; the
// cad-config workflow (interactive menu + direct-set) calls this so no invalid
// value is ever written. Never blocks the spine: callers degrade on {ok:false}.
//
// Subcommands (all print one JSON line on stdout):
//   validate [--file <path>]        validate a whole config file
//   check <key=value> ...           validate one or more dotted key=value pairs
//   set [--file <path>] <key=value> validate pairs, then write them into the file
//   keys                            dump the schema keys (for menu/catalog derivation)
//
// Default --file is .planning/config.json relative to cwd.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCHEMA = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.schema.json'), 'utf8'),
).keys;

const out = (o) => { process.stdout.write(JSON.stringify(o) + '\n'); };
const fail = (reason, detail) => { out({ ok: false, reason, detail }); process.exit(0); };

// --- value typing ------------------------------------------------------------

// Validate a single already-parsed value against a schema spec.
// Returns null if ok, else an error string.
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

function setInto(obj, dotted, value) {
  const parts = dotted.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === undefined || node[parts[i]] === null || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

function set(file, tokens) {
  const { pairs, errors } = checkPairs(tokens);
  if (errors.length) fail('invalid', errors);
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { fail('read', `cannot read/parse ${file}: ${e.message}`); }
  for (const { key, value } of pairs) setInto(cfg, key, value);
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, file, changed: pairs });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
function optFile(tokens) {
  const i = tokens.indexOf('--file');
  if (i < 0) return { file: '.planning/config.json', tokens };
  return { file: tokens[i + 1], tokens: tokens.filter((_, j) => j !== i && j !== i + 1) };
}

try {
  if (cmd === 'validate') { const { file } = optFile(rest); validate(file); }
  else if (cmd === 'check') { const { errors } = checkPairs(rest); out({ ok: errors.length === 0, errors }); }
  else if (cmd === 'set') { const { file, tokens } = optFile(rest); set(file, tokens); }
  else if (cmd === 'keys') { out({ ok: true, keys: SCHEMA }); }
  else fail('usage', 'subcommand: validate | check | set | keys');
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
