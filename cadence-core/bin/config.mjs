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
//   unset [--file <path>|--global] <key> ...  remove those keys from that ONE file (never the
//                                             merged view). Accepts any dotted path, schema key
//                                             or not; a key the file does not hold writes nothing
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
import { isForgeSlug, splitForgeHost } from './lib/forge-decision.mjs';

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

// Validate a single already-parsed value's TYPE against a schema spec.
// Returns null if ok, else an error string. checkValue below is what callers
// reach: it runs this first and only then the optional per-key grammar, so a
// value of the wrong type reports the type rather than a grammar it could never
// have satisfied.
/** @param {{type:string, min?:number, max?:number, values?:any[]}} spec @param {any} v */
function checkType(spec, v) {
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

// The named grammars a schema key may claim, as a FROZEN registry of one
// predicate each rather than a branch per key inside checkValue.
//
// WHY A NARROWING AT ALL, and why here. `git.forge_repo` and `git.forge_host`
// are typed `string_or_null`, which admitted `forge example.com/../x` and every
// other shape no forge serves - and both values are TYPED BY A USER at setup
// and then interpolated onto a command line, first into the `config.mjs set`
// line the workflow prints and then into a `tea`/`gh`/`glab` argument vector.
// The write face is where a typed answer can still be refused with the user
// still there to retype it, which is why the check lives at `checkValue` (the
// one point `set`, `check` and `validate` all reach) and not at each reader.
//
// The predicates are IMPORTED from lib/forge-decision.mjs, never restated:
// `isForgeSlug` is already the one answer to "what may a repository selector
// be" and `splitForgeHost` the one answer for an instance address, and a second
// spelling here is how a rule comes to be enforced in two strengths.
//
// Each entry carries its own sentence because the two keys refuse for different
// reasons, and what a user reads has to say what is WRONG with the value rather
// than that it failed.
const GRAMMARS = Object.freeze({
  forge_slug: Object.freeze({
    ok: (v) => isForgeSlug(v),
    error: 'expected an owner/name slug - two or more segments of letters, digits, '
      + '`.`, `_` or `-`, no segment starting with `-`, and no `.` or `..` segment',
  }),
  forge_host: Object.freeze({
    ok: (v) => splitForgeHost(v) !== null,
    error: 'expected a hostname, optionally followed by `:<port>` - dot-separated '
      + 'labels of letters, digits and `-` where no label starts or ends with `-`, '
      + 'and a port of 1-65535 in decimal with no leading zero',
  }),
});

// Evaluate a spec's optional `grammar` marker, AFTER its type has passed.
//
// A `null` value skips the grammar: null is the schema default on every key
// that carries one and means the question was never asked, so failing it would
// refuse the scaffolded templates/config.json.
//
// A marker naming a predicate the registry does not hold is an ERROR, in the
// same shape checkType's `default:` arm answers an unknown `spec.type`, and
// NEVER a no-op. A marker silently treated as satisfied would let a future key
// claim a grammar nothing enforces - the silent pass lib/schema-eval.mjs's
// header refuses at length, for this reason.
/** @param {{grammar?:string}} spec @param {any} v */
function checkGrammar(spec, v) {
  const name = spec.grammar;
  if (name === undefined) return null;
  if (v === null) return null;
  const grammar = Object.hasOwn(GRAMMARS, name) ? GRAMMARS[name] : undefined;
  if (!grammar) return `unknown schema grammar ${name}`;
  return grammar.ok(v) ? null : grammar.error;
}

// Validate a single already-parsed value against a schema spec: its type, then
// the per-key grammar when the spec claims one. The one point `set`, `check`
// and `validate` all reach.
/** @param {{type:string, min?:number, max?:number, values?:any[], grammar?:string}} spec @param {any} v */
function checkValue(spec, v) {
  const typeError = checkType(spec, v);
  if (typeError) return typeError;
  return checkGrammar(spec, v);
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
    // either layer" and 32 keys carry it, `granularity` and `review.mode` among
    // them - the keys a user legitimately pins machine-wide - so keying a layer
    // refusal on `src` would refuse exactly the wrong set. `repo_only`
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

// Remove dotted paths from exactly ONE layer file - never the merged view. "The
// key is gone from the file afterwards" is a claim about a file, and the merged
// view is not one.
//
// IT VALIDATES NOTHING, on purpose. Every other write path here runs checkPairs
// first; this one accepts any dotted path - a schema key, a retired key, an
// unknown one - because removing what `validate` refuses is its entire job, and
// `workflows/config.md` closes the only other route ("Never write config JSON by
// hand; go through the seam"). A write face that refused a retired key here
// would leave a migration with no seam at all (D-06).
//
// NOTHING REMOVED MEANS NOTHING WRITTEN, not a rewrite that happens to match.
// atomicWrite re-serializes at two-space indent with a trailing newline, so a
// no-op that still wrote would reformat a hand-spaced layer and move its sha256
// while reporting `removed: []`. An ABSENT file is the same answer for the same
// reason and creates nothing - only `set --global` auto-creates, because only a
// set has a value that has to land somewhere.
//
// An emptied container is NOT pruned. `flatten` above skips an object with no
// entries, so `{"risk":{"override":{}}}` contributes no leaf and `validate`
// passes over it; a second walk to delete it would earn nothing.
function unset(file, keys) {
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) {
    // ENOENT is the "nothing to remove" arm rather than a failure: a layer that
    // does not exist already holds none of these keys, and reporting `read`
    // would fail a migration step on every project that never wrote a repo
    // config. A file that exists and cannot be PARSED is still refused - the
    // keys may well be in there.
    if (e.code === 'ENOENT') return out({ ok: true, file, removed: [] });
    return fail('read', `cannot read/parse ${file}: ${e.message}`,
      'repair the JSON in the file the detail names and re-run - unset will not overwrite a layer it could not read');
  }
  if (!isPlainObject(cfg)) fail('invalid', [{ key: '(root)', error: 'top-level config must be a JSON object', value: cfg }],
    `make the top level of ${file} a JSON object of key/value pairs - an empty {} is a valid layer - then re-run`);
  const removed = [];
  for (const key of keys) {
    const parts = key.split('.');
    let node = cfg;
    let depth = 0;
    // hasOwn at every hop, for the reason `validate` and `get` each state on
    // their own face: a bare `node[part]` walks the prototype chain, so
    // `unset toString` would find a function to delete and `unset
    // constructor.prototype.x` would reach into Object itself. An own-property
    // walk can only ever touch data this file actually holds - and JSON.parse
    // DEFINES a literal `"__proto__"` key as an own property, so the one
    // spelling that really can sit in a config file is still reachable.
    for (; depth < parts.length - 1; depth++) {
      const next = Object.hasOwn(node, parts[depth]) ? node[parts[depth]] : undefined;
      if (!isPlainObject(next)) break;
      node = next;
    }
    // Fell out of the walk early, so the path runs through something this file
    // does not hold (or through a scalar) - absent, not an error.
    if (depth !== parts.length - 1) continue;
    if (!Object.hasOwn(node, parts[depth])) continue;
    delete node[parts[depth]];
    removed.push(key);
  }
  if (removed.length) atomicWrite(file, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, file, removed });
}

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
    // The twelve `review.triggers.<t>.{gate,tier,effort}` keys used to answer
    // with a warning here saying "no layer pins this, so the stakes level
    // decides it". That sentence went with the level: those rows carry real
    // schema defaults now (D-01), so an unset one is answered the way every
    // other defaulted key is answered, and a warning saying something else
    // decides - beside a value that IS the answer - would be a contradiction.
    //
    // `stakes` used to keep a two-state read of its own here - the one key on
    // this face whose unset state no schema default could answer, because the
    // level was computed per phase rather than read. The key is retired
    // (v4.0.0), so there is no two-state read left: every key this face answers
    // now either carries a layered value or carries a schema default, and a
    // config that still holds `stakes` is named by the retired-key warnings
    // folded in above rather than by a special case here.
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
  // No `global` argument: which layer is answered by the FILE alone here, and
  // `unset` never creates one, so the flag has nothing left to say once optFile
  // has resolved it to a path.
  else if (cmd === 'unset') { const { file, tokens } = optFile(rest); unset(file, tokens); }
  else if (cmd === 'get') { const { file, tokens, global } = optFile(rest); get(file, tokens, global); }
  else if (cmd === 'keys') { out({ ok: true, keys: SCHEMA }); }
  else fail('usage', 'subcommand: validate | check | set | unset | get | keys');
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
