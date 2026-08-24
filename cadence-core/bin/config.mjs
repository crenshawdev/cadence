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
import { GLOBAL_CONFIG, layerIdentity, mergeLayers, isPlainObject } from './lib/config-merge.mjs';
import { retiredKeyError, retiredKeysIn } from './lib/retired-keys.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import { DONE, emit } from './lib/seam-io.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';
import { evaluateFlag, CONTRACTS } from './lib/arg-contract.mjs';

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
// `hint` is the third argument and rides as a conditional key: an absent hint
// adds no key, so no shipped assertion moves (phase-1 D-09/D-10).
const fail = (reason, detail, hint) => {
  out({ ok: false, reason, detail, ...(hint ? { hint } : {}) });
  throw DONE;
};

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
  catch (e) {
    fail('read', `cannot read/parse ${file}: ${e.message}`,
      'repair the JSON in the file the detail names, or point --file at a config that exists, then re-run');
  }
  if (!isPlainObject(cfg)) {
    return out({ ok: false, file, checked: 0,
      errors: [{ key: '(root)', error: 'top-level config must be a JSON object', value: cfg }],
      hint: 'make the top level of this file a JSON object of key/value pairs - an empty {} is a valid layer - then re-run' });
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
//
// `targetsGlobal` is the RESOLVED target layer, never a flag: the caller has
// already asked whether the file it is about to write IS the user-global layer
// (`set` below), so a `--file <that same path>` spelling reaches the scope
// check exactly as `--global` does. `check` passes what its own `--global`
// says, which is how the inspect face reports what the write face refuses.
/** @param {string[]} tokens @param {boolean} [targetsGlobal] */
function checkPairs(tokens, targetsGlobal) {
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
    // hasOwn, the third of the same guard (:142 in validate, :284 in get): a
    // bare `SCHEMA[key]` answers `constructor` or any other Object.prototype
    // member with a truthy "spec" carrying no `type`, which checkValue below
    // reported as "unknown schema type undefined" instead of naming the key
    // the schema does not hold. The retired lookup above carries its own half
    // of this guard, inside retiredKeyError.
    const spec = Object.hasOwn(SCHEMA, key) ? SCHEMA[key] : undefined;
    if (!spec) { errors.push({ key, error: 'unknown key' }); continue; }
    const value = parseToken(raw);
    const msg = checkValue(spec, value);
    if (msg) { errors.push({ key, error: msg, value }); continue; }
    // AFTER checkValue, deliberately, and unlike the retired-key check above: a
    // pair that is both out-of-scope and type-invalid reports the TYPE, because
    // the type is wrong in either layer while the layer is only wrong in this
    // one (D-11).
    //
    // The marker is `repo_only`, never `src`. `src: "repo"` means "settable in
    // either layer" and 33 keys carry it, `stakes` and `granularity` among them
    // - the keys workflows/config.md tells the user to set globally - so keying
    // a layer refusal on `src` would refuse exactly the wrong set. `repo_only`
    // asks the narrower question config.schema.json's _meta.note states: would a
    // user-global value AUTHORIZE a change to a repository that never opted in.
    // Read off the SCHEMA object the dispatch loaded, through the same
    // `Object.hasOwn` guard `spec` came through six lines up - never a
    // hand-maintained key list, so a second marked key is a schema edit and no
    // line of this rule moves.
    if (targetsGlobal && spec.repo_only === true) {
      errors.push({
        key,
        error: `"${key}" can only be set in a repository's own config layer: a `
          + 'user-global value cannot authorize a change to the repository that '
          + 'has to honour it - set it with --file <repo config> instead, e.g. '
          + '--file .planning/config.json',
      });
      continue;
    }
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
  // WHICH LAYER this write lands in, resolved off the target FILE and not off
  // the flag (D-04). `create` is optFile's `global`, so `--global` is direct;
  // the second arm is `--file <the user-global config's own path>`, which
  // returns `global:false` and wrote straight through a flag-only rule.
  // Identity, not string equality: `--file <global-dir>/./config.json` is what
  // forced the realpath hardening the first time (8063832d), and a symlink, a
  // relative spelling or a trailing slash open the same door. It is
  // `layerIdentity` from the merge lib rather than a local copy, because that
  // is the same "one file, both layers" question the read face answers and two
  // copies of it drift. An UNRESOLVABLE identity (null) equals nothing,
  // including another null, and GLOBAL_CONFIG is deliberately '' where
  // homedir() throws - '' must never match a real target.
  const fileId = layerIdentity(file);
  const targetsGlobal = create
    || (Boolean(GLOBAL_CONFIG) && fileId !== null && fileId === layerIdentity(GLOBAL_CONFIG));
  // Ahead of every read and every write below, so a multi-pair set carrying one
  // marked key leaves the target file untouched.
  const { pairs, errors } = checkPairs(tokens, targetsGlobal);
  if (errors.length) fail('invalid', errors,
    'each error names the pair it refused - run `config.mjs keys` for the keys this schema carries and the values each one takes, then re-run with a pair it accepts');
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) {
    if (create && e.code === 'ENOENT') cfg = {};
    else fail('read', `cannot read/parse ${file}: ${e.message}`,
      'repair the JSON in the file the detail names and re-run - set will not overwrite a layer it could not read');
  }
  if (!isPlainObject(cfg)) fail('invalid', [{ key: '(root)', error: 'top-level config must be a JSON object', value: cfg }],
    `make the top level of ${file} a JSON object of key/value pairs - an empty {} is a valid layer - then re-run`);
  const pathErrors = checkPaths(cfg, pairs);
  if (pathErrors.length) fail('invalid', pathErrors,
    `edit ${file} by hand to free the path each error names, then re-run`);
  for (const { key, value } of pairs) setInto(cfg, key, value);
  if (create) mkdirSync(dirname(file), { recursive: true });
  // atomicWrite (temp + rename), not a bare write: config is a live layer
  // every other seam reads mid-session; a crash must never leave it torn.
  atomicWrite(file, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, file, changed: pairs });
}

// The per-trigger keys whose schema default is the `null` sentinel rather than
// a value: route-table.json answers them and the level decides - the `review`
// grid for `.gate` (GAT-02), the `tiers` and `efforts` grids for the two
// fields that reach a cross-model reviewer (RVW-03). Matched by shape rather
// than a hand-kept list, so a fifth trigger is covered the day its keys land.
const LEVEL_KEY = /^review\.triggers\.[^.]+\.(gate|tier|effort)$/;

// What each of them is CALLED in the warning below. Written out rather than
// interpolated from the key's last segment so `tier` and `effort` read as the
// quantities a user recognises, and so `effort` cannot be mistaken for the
// agent rung of the same name.
const LEVEL_KEY_NOUN = { gate: 'gate', tier: 'model tier', effort: 'reasoning effort' };

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
  // hasOwn, not a bare `SCHEMA[k]` - the guard `validate` already carries at
  // :138-142, for the same reason one face over. A bare lookup answers a
  // requested key named `__proto__`, `constructor`, `toString` or any other
  // Object.prototype member with Object.prototype itself: a truthy "spec"
  // carrying no `type` and no `default`, so the key passed this filter as
  // though the schema held it. The value line below then read `.default` off
  // that (undefined), and assigning it into `values` at the name `__proto__`
  // ran the object's own setter and stored NOTHING - which is how
  // `get __proto__` answered {"ok":true,"values":{}} at exit 0, and
  // `get stakes __proto__` answered about one key of the two asked for with
  // nothing saying the other had gone missing. `fail('unknown-key', ...)` was
  // always the right answer; the whole fix is that a prototype member now
  // reaches it.
  const unknown = wanted.filter((k) => !Object.hasOwn(SCHEMA, k));
  if (unknown.length) fail('unknown-key', unknown,
    'run `config.mjs keys` for the keys this schema carries, then ask for one of those');
  for (const k of wanted) {
    // Guarded for the same reason, though the filter above now makes every `k`
    // an own schema key: the keyless arm walks Object.keys(SCHEMA) and the
    // explicit arm is refused, so nothing reaches here off the prototype
    // chain today. A future caller path that builds `wanted` some third way
    // would inherit the hole, and this is the read the hole is spent through.
    const spec = Object.hasOwn(SCHEMA, k) ? SCHEMA[k] : undefined;
    values[k] = layered[k] !== undefined ? layered[k] : spec && spec.default;
    // The read face says WHICH of the two states one of these keys is in. The
    // value line above is unchanged (D-06) - the schema sentinel does that work
    // - but a bare `null` cannot tell a reader "no layer set one, the level
    // decides" apart from a layer that wrote null, which is what GAT-02 asks
    // for. So the answer carries a warning naming where the level IS resolved.
    //
    // Only on an EXPLICIT read (D-02). A keyless `get` walks every schema
    // key, so warning there appends a line per key to every full read - prose
    // that workflows/milestone.md and verify.md relay straight to the user -
    // for a caller that asked about none of them in particular. That is why
    // this arm mattered more once RVW-03 tripled the family it covers.
    //
    // It never states what the level fires and never reads route-table.json
    // (D-07): this seam does not know the stakes level, and answering as if
    // it did is the same defect pointed the other way.
    const levelKey = keys.length && layered[k] === undefined ? LEVEL_KEY.exec(k) : null;
    if (levelKey) {
      allWarnings.push(`${k} is unset: no config layer pins this `
        + `${LEVEL_KEY_NOUN[levelKey[1]]}, so the `
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
  // `--global` reads through its DECLARED row too, and reading it off the row
  // is what makes this class unrepeatable at this seam: a subcommand that
  // ACCEPTS a `--global` it does not declare stops being possible, because the
  // read needs the row to exist. It was live on `get` while only `validate`
  // and `set` declared it, and self-verify stayed green only because no
  // workflow prose spelled that pair - the moment any did, correct prose would
  // be reported `unknown-flag`.
  //
  // Tested FIRST and short-circuiting to the global file before `--file` is
  // looked at, exactly as the hand-written probe did. The row is `boolean`,
  // whose whole grammar is presence, so neither disposition can fire and the
  // three flag spellings a valued row separates do not arise.
  const globalRow = CONTRACTS['config.mjs'][cmd]['--global'];
  const gi = tokens.indexOf('--global');
  if (globalRow !== undefined && evaluateFlag(tokens, '--global', globalRow).value === true) {
    return { file: GLOBAL_CONFIG, global: true, tokens: tokens.filter((_, j) => j !== gi) };
  }
  const i = tokens.indexOf('--file');
  if (i < 0) return { file: '.planning/config.json', global: false, tokens };
  // `--file` reads through its DECLARED row in lib/arg-contract.mjs (ARG-06)
  // rather than through a hand-written value rule. The row is per SUBCOMMAND -
  // `validate`, `set` and `get` each declare one - and is read at the call
  // rather than at module load, because `check` and `keys` declare none and
  // never reach this function.
  //
  // WHAT THE ROW CATCHES THAT THE HAND-WRITTEN RULE DID NOT. `if (!tokens[i+1])`
  // covered the two spellings an interpolated `--file $VAR` produces on an unset
  // variable - unquoted drops the token entirely, quoted `"$VAR"` passes an
  // EMPTY one - and left alone those fell through as `file: undefined`, so `set`
  // degraded to reason:"internal" with a raw Node type error, `validate` said
  // "cannot read/parse undefined", and `get` answered ok:true with a full
  // effective read of the user-global layer alone. What it missed is the
  // FLAG-SHAPED token: measured 2026-08-19, `config.mjs validate --file
  // --nonsense` returned `{"ok":false,"reason":"read","detail":"cannot
  // read/parse --nonsense: ENOENT ..."}` - answering about a file the caller
  // never named, which is the same class one spelling further out. One rule now
  // refuses all three.
  //
  // The refusal keeps this bin's own `usage` and its published wording (D-07);
  // the contract mints no reason code.
  const parsed = evaluateFlag(tokens, '--file', CONTRACTS['config.mjs'][cmd]['--file']);
  if (!parsed.ok) {
    fail('usage', '--file needs a path after it: --file <config file> (or --global)');
  }
  return { file: parsed.value, global: false, tokens: tokens.filter((_, j) => j !== i && j !== i + 1) };
}

try {
  try {
    SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')).keys;
  } catch (e) {
    fail('bad-schema', `cannot read/parse ${SCHEMA_PATH}: ${e.message}`,
      'restore config.schema.json at the path the detail names - a partial or damaged plugin install is the usual cause - then re-run');
  }
  if (cmd === 'validate') { const { file } = optFile(rest); validate(file); }
  else if (cmd === 'check') {
    // `--global` read off its DECLARED row, exactly as optFile reads the same
    // flag - but never THROUGH optFile: that function falls through to
    // `CONTRACTS['config.mjs'][cmd]['--file']` the moment a `--file` token
    // appears, and `check` declares no such row, so it would hand `undefined`
    // to evaluateFlag and reach the user as reason:"internal". The row is
    // `boolean`, whose whole grammar is presence, so the flag token is dropped
    // from what checkPairs is handed rather than read as a pair.
    const gi = rest.indexOf('--global');
    const asGlobal = evaluateFlag(rest, '--global', CONTRACTS['config.mjs'].check['--global']).value === true;
    // The same failure contract `set` speaks (and workflows/config.md
    // documents): one shape for both faces, so a caller reads `detail` once -
    // and now the same per-pair entry, so the inspect face reports the scope
    // refusal the write face gives rather than blessing a pair `set` refuses.
    const { errors } = checkPairs(asGlobal ? rest.filter((_, j) => j !== gi) : rest, asGlobal);
    if (errors.length) out({ ok: false, reason: 'invalid', detail: errors,
      hint: 'each error names the pair it refused - run `config.mjs keys` for the keys this schema carries and the values each one takes, then re-run with a pair it accepts' });
    else out({ ok: true });
  }
  else if (cmd === 'set') { const { file, tokens, global } = optFile(rest); set(file, tokens, global); }
  else if (cmd === 'get') { const { file, tokens, global } = optFile(rest); get(file, tokens, global); }
  else if (cmd === 'keys') { out({ ok: true, keys: SCHEMA }); }
  else fail('usage', 'subcommand: validate | check | set | get | keys');
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
