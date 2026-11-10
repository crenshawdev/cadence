#!/usr/bin/env node
// @ts-check
// config.mjs - zero-dep validator seam for .planning/config.json. Every subcommand prints one JSON line.
// ../config.schema.json is the source of truth. Callers degrade on {ok:false}, never block.
//   validate [--file <path>|--global]
//   check <key=value> ...
//   set [--file <path>|--global] <key=value>
//   unset [--file <path>|--global] <key> ...  removes from that one file, never the merged view
//   get [--file <path>] [key ...]             repo > global > defaults
//   keys [--walk]                             --walk is only keys holding a `question`
//   workflow-layers                           the two workflow switches, each on only when both layers set it
//   layers [--group <name> [--advanced]|--key <key>]  where each setting's value comes from, for the /cad-config menu
//   preview <key=value> ...                   read-only: the file, before and after, and what changes if `set` ran
// --file defaults to .planning/config.json, --global is the user-global layer.

import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GLOBAL_CONFIG, layerIdentity, mergeLayers, isPlainObject } from './lib/config-merge.mjs';
import { retiredKeyError, retiredKeysIn } from './lib/retired-keys.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import { DONE, emit } from './lib/seam-io.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';
import { evaluateFlag, CONTRACTS } from './lib/arg-contract.mjs';
import { checkValue, checkGrammar } from './lib/config-value.mjs';
import { workflowLayers, WORKFLOW_KEYS } from './lib/workflow-layers.mjs';
import { autoCloseLayers } from './lib/repo-auto-close.mjs';
import { flatten, layerRows } from './lib/config-layers.mjs';
import { dependentsOf } from './lib/setting-conditions.mjs';
import { dottedKeyPaths, withoutDottedKeys } from './lib/global-only-keys.mjs';
import { targetLayer, rolesFor, candidateKeys, buildPreview } from './lib/config-preview.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// loaded inside the dispatch try below, so a missing or broken schema answers {ok:false} instead of crashing at import
let SCHEMA;
// the override only counts under the `CADENCE_TEST_SEAM` sentinel: the schema decides which keys are known and global
const SCHEMA_PATH = (testSeamOpen() && process.env.CADENCE_CONFIG_SCHEMA)
  || join(HERE, '..', 'config.schema.json');

// fail throws DONE so the dispatch unwinds without process.exit().
const out = emit;
// hint is a conditional key, so a call without one adds no key and no shipped assertion moves.
const fail = (reason, detail, hint) => {
  out({ ok: false, reason, detail, ...(hint ? { hint } : {}) });
  throw DONE;
};

// JSON where it parses (true, 12, null, "s", [...]), else a bare string, so mode=interactive is "interactive".
function parseToken(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
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
  // a dotted key is not a setting anywhere else, so it is reported here and never walked as one
  const leaves = flatten(withoutDottedKeys(cfg), '', {});
  /** @type {{key: string, error: string, value?: any}[]} */
  const errors = dottedKeyPaths(cfg).map((key) => ({ key, error: 'unknown key: a key spelled with a dot is not a setting - nest it' }));
  for (const [path, v] of Object.entries(leaves)) {
    // hasOwn, not SCHEMA[path]: a `__proto__` leaf found Object.prototype and read as "unknown schema type undefined"
    const spec = Object.hasOwn(SCHEMA, path) ? SCHEMA[path] : undefined;
    if (!spec) { errors.push({ key: path, error: 'unknown key' }); continue; }
    const msg = checkValue(spec, v);
    if (msg) errors.push({ key: path, error: msg, value: v });
  }
  out({ ok: errors.length === 0, file, checked: Object.keys(leaves).length, errors });
}

// Validates key=value pairs. Returns {pairs, errors}.
// targetsGlobal is the resolved target layer, not a flag: set asks whether the file IS the user-global one, so
// `--file <that path>` reaches the scope check the same as --global. check passes its own --global, which is
// how the inspect face reports what the write face refuses.
/** @param {string[]} tokens @param {boolean} [targetsGlobal] */
function checkPairs(tokens, targetsGlobal) {
  const pairs = [];
  const errors = [];
  for (const tok of tokens) {
    const kv = splitPair(tok);
    if (!kv) { errors.push({ key: tok, error: 'not a key=value pair' }); continue; }
    const [key, raw] = kv;
    // before the schema lookup: a retired key is gone from it, so unknown-key would hide the replacement
    const retired = retiredKeyError(key);
    if (retired) { errors.push({ key, error: retired }); continue; }
    // hasOwn again, so `constructor` and friends don't pass as a spec with no type
    const spec = Object.hasOwn(SCHEMA, key) ? SCHEMA[key] : undefined;
    if (!spec) { errors.push({ key, error: 'unknown key' }); continue; }
    const value = parseToken(raw);
    const msg = checkValue(spec, value);
    if (msg) { errors.push({ key, error: msg, value }); continue; }
    // after checkValue on purpose: a pair that's both out of scope and the wrong type reports the type, because
    // that's wrong in either layer. The marker is `repo_only`, never `src`: keys with `src: "repo"` (granularity,
    // review.mode) are ones users legitimately pin machine-wide. repo_only asks the narrower question from
    // config.schema.json: would a user-global value authorize a change to a repo that never opted in. It's read
    // off SCHEMA with no key list, so a second marked key is a schema edit and nothing here moves.
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

// A dotted key writes through containers. Creating an absent one (missing or null) is the point of set, but
// replacing an array or scalar throws its contents away, so refuse that before any pair is applied and a
// multi-pair set stays all-or-nothing.
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

// `create` (the --global path) starts from an empty config and makes the parent dir; a corrupt file still fails.
function set(file, tokens, create) {
  // The layer comes from the target file, not the flag: `--file <the user-global path>` returns global:false and
  // wrote straight through a flag-only rule. layerIdentity, not string equality, because `./` spellings,
  // symlinks and trailing slashes open the same door (8063832d). An unresolvable identity (null) equals nothing,
  // and GLOBAL_CONFIG is '' where homedir throws, so '' must never match a real target.
  const fileId = layerIdentity(file);
  const targetsGlobal = create
    || (Boolean(GLOBAL_CONFIG) && fileId !== null && fileId === layerIdentity(GLOBAL_CONFIG));
  // ahead of every read and write, so a multi-pair set with one marked key leaves the file untouched
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
  // atomicWrite, not a bare write: every other seam reads this layer mid-session and a crash can't leave it torn
  atomicWrite(file, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, file, changed: pairs });
}

// Removes dotted paths from exactly one layer file, never the merged view.
// It validates nothing on purpose: refusing a retired key here would leave a migration with no way to remove it.
// Nothing removed, nothing written: a no-op atomicWrite re-indents a hand-spaced layer and moves its sha256.
// An emptied container isn't pruned: flatten skips an object with no entries, so validate passes over it.
function unset(file, keys) {
  let cfg;
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) {
    // ENOENT is "nothing to remove": failing here would break a migration on every project with no repo config
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
    // hasOwn at every hop, or a bare node[part] walks the prototype chain and `unset toString` finds a function
    for (; depth < parts.length - 1; depth++) {
      const next = Object.hasOwn(node, parts[depth]) ? node[parts[depth]] : undefined;
      if (!isPlainObject(next)) break;
      node = next;
    }
    // fell out of the walk early: the path runs through something this file doesn't hold, so it's absent, not an error
    if (depth !== parts.length - 1) continue;
    if (!Object.hasOwn(node, parts[depth])) continue;
    delete node[parts[depth]];
    removed.push(key);
  }
  if (removed.length) atomicWrite(file, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, file, removed });
}

// The effective value set: schema defaults, then the global layer, then the repo layer (the shared merge lib,
// same as route.mjs). Output is a flat dotted-key map so callers don't re-flatten.
// asGlobal is the --global arm: it hands GLOBAL_CONFIG in as the file, which makes one file both layers, and
// only the caller knows the read was aimed at the global layer. It moves the `source` label, nothing else.
function get(file, keys, asGlobal) {
  const { config, source, warnings, layers, scopeWarnings } = mergeLayers(file, { asGlobal });
  // A key the schema dropped resolves at its default and looks configured, so name it. Otherwise an upgraded
  // repo quietly routes on a value nothing reads. scopeWarnings rides in the same way: get is the read face,
  // so folding it in once is the whole wiring. It stays off mergeLayers's own warnings, which git-publish reads
  // as a refusal to mutate.
  const allWarnings = [...(warnings || []), ...retiredKeysIn(config), ...(scopeWarnings || [])];
  const layered = flatten(config, '', {});
  /** @type {Record<string, any>} */
  const values = {};
  const wanted = keys.length ? keys : Object.keys(SCHEMA);
  // hasOwn, not a bare SCHEMA[k], same as validate: a requested `__proto__` or `toString` found Object.prototype
  // and passed this filter as a spec, and assigning into values at `__proto__` stored nothing, so
  // `get __proto__` answered ok with empty values. unknown-key was always the right answer.
  const unknown = wanted.filter((k) => !Object.hasOwn(SCHEMA, k));
  if (unknown.length) fail('unknown-key', unknown,
    'run `config.mjs keys` for the keys this schema carries, then ask for one of those');
  for (const k of wanted) {
    // redundant given the filter today, but a future path that builds wanted another way would inherit the hole
    const spec = Object.hasOwn(SCHEMA, k) ? SCHEMA[k] : undefined;
    values[k] = layered[k] !== undefined ? layered[k] : spec && spec.default;
    // a hand-edited layer never went through set's grammar, so a stored non-model-id answers null and the key is named
    if (spec && spec.grammar === 'model_id' && checkGrammar(spec, values[k]) !== null) {
      allWarnings.push(`${k}: the stored value is not a model id and was read as null`);
      values[k] = null;
    }
    // no special case for review.triggers or retired `stakes`: a layered value or a schema default always answers
  }
  out({ ok: true, values, source, ...(allWarnings.length ? { warnings: allWarnings } : {}) });
}

// --- the walk's read ---------------------------------------------------------

// Grouped by section so the name is said once, and entries are [value, text?] so `null` and the booleans keep
// their JSON type without an object per option (that shape ran past 25,000 B). `type` and the scope markers
// ride along because the walk converts an `Other` answer by type and says which layer takes a key.
function walkRead() {
  const asked = Object.entries(SCHEMA).filter(([, spec]) => typeof spec.question === 'string')
    .sort((a, b) => a[1].position - b[1].position);
  const groups = [];
  for (const [key, spec] of asked) {
    if (groups.length === 0 || groups[groups.length - 1].section !== spec.section) groups.push({ section: spec.section, keys: [] });
    /** @type {Record<string, unknown>} */
    const row = { key, type: spec.type };
    if (spec.src !== undefined) row.src = spec.src;
    if (spec.repo_only !== undefined) row.repo_only = spec.repo_only;
    row.question = spec.question;
    if (spec.explain) row.explain = spec.explain.map((/** @type {{value: unknown, text?: string}} */ e) => (e.text === undefined ? [e.value] : [e.value, e.text]));
    if (spec.hint !== undefined) row.hint = spec.hint;
    groups[groups.length - 1].keys.push(row);
  }
  return groups;
}

// The menu's read: where each setting's value comes from. The repo is the cwd, as workflow-layers has it.
// Bare gives the opening screen's counts. --group adds that group's shown rows and the names of its Advanced keys,
// --group with --advanced the Advanced rows as key, label, value, winner and purpose, --key one row with the key's full text.
function layersRead(group, advanced, key, catalog) {
  const cwd = process.cwd();
  const repoFile = join(cwd, '.planning', 'config.json');
  const { config, layers, warnings, scopeWarnings, tornLayers } = mergeLayers(repoFile);
  const wl = workflowLayers(cwd);
  const ac = autoCloseLayers(cwd);
  const both = {
    [WORKFLOW_KEYS.use]: wl.keys[WORKFLOW_KEYS.use],
    [WORKFLOW_KEYS.multi]: wl.keys[WORKFLOW_KEYS.multi],
    [WORKFLOW_KEYS.execute]: wl.keys[WORKFLOW_KEYS.execute],
    'git.auto_close': { on: ac.authorized },
  };
  const read = layerRows({ keys: SCHEMA, merged: { config, layers, tornLayers }, files: { repo: repoFile, global: GLOBAL_CONFIG }, both });
  const allWarnings = [...(warnings || []), ...(scopeWarnings || []), ...read.warnings];
  const head = { ok: true, unreadable: read.unreadable, ...(allWarnings.length ? { warnings: allWarnings } : {}) };
  const plain = ({ group: _g, shown: _s, position: _p, ...r }) => r;
  if (catalog) {
    out({ ...head, settings: read.rows.map((r) => {
      const { label, question, purpose, explain } = SCHEMA[r.key];
      return { key: r.key, ...(label !== undefined ? { label } : {}), question: question ?? null, purpose: purpose ?? null, explain: explain ?? null, value: r.value };
    }) });
    return;
  }
  if (key !== undefined) {
    if (!Object.hasOwn(SCHEMA, key)) fail('unknown-key', [key],
      'run `config.mjs keys` for the keys this schema carries, then ask for one of those');
    const spec = SCHEMA[key];
    const row = read.rows.find((r) => r.key === key);
    const { type, question, explain, hint, purpose, src, repo_only, interacts } = spec;
    const worksWith = dependentsOf(SCHEMA, key).map((k) => ({ key: k, value: read.rows.find((r) => r.key === k).value }));
    out({ ...head, row: { ...plain(row), group: spec.section, type, question, explain, hint, purpose, src, repo_only, interacts, works_with: worksWith } });
    return;
  }
  if (group === undefined) { out({ ...head, groups: read.groups, totals: read.totals }); return; }
  const found = read.groups.find((g) => g.name === group);
  if (!found) fail('unknown-group', read.groups.map((g) => g.name),
    'ask for one of the group names the detail lists, spelled as it is there');
  const inGroup = read.rows.filter((r) => r.group === group);
  if (advanced) {
    // a pick of the five fields the Advanced list prints, so a field layerRows gains later stays off this read (10,000 B)
    const pick = (r) => ({ key: r.key, ...(r.label !== undefined ? { label: r.label } : {}), value: r.value, winner: r.winner, purpose: SCHEMA[r.key].purpose });
    out({ ...head, group: found, rows: inGroup.filter((r) => !r.shown).map(pick) });
    return;
  }
  out({ ...head, group: found, rows: inGroup.filter((r) => r.shown).map(plain), advanced: inGroup.filter((r) => !r.shown).map((r) => r.key) });
}

// --- dispatch ----------------------------------------------------------------
// The preview: what a `set` of these pairs would do, with nothing written. Both sides come from one scratch copy of the
// two layers, so the only difference between them is the change. GLOBAL_CONFIG is fixed at module load, so every read
// of the copy is a child process pointed at it, and the real files, the plans and trace.jsonl are never touched.
async function previewRead(tokens) {
  const INVALID_HINT = 'each error names the pair it refused - run `config.mjs keys` for the keys this schema carries and the values each one takes, then re-run with a pair it accepts';
  if (!tokens.length) fail('usage', 'preview needs key=value pairs after it: preview <key=value>...');
  const checked = checkPairs(tokens, false);
  const pairs = checked.pairs;
  const errors = [...checked.errors];
  const globalTokens = tokens.filter((t) => pairs.some((p) => t.startsWith(`${p.key}=`) && targetLayer(SCHEMA[p.key]) === 'global'));
  if (globalTokens.length) errors.push(...checkPairs(globalTokens, true).errors);
  if (errors.length) fail('invalid', errors, INVALID_HINT);

  const cwd = process.cwd();
  const repoFile = join(cwd, '.planning', 'config.json');
  const layerOf = (key) => targetLayer(SCHEMA[key]);
  // Each layer is read once, here: an absent file is an unset layer, one that won't parse is refused, never guessed at.
  const readCopy = (file) => {
    if (!file) return null;
    let text;
    try { text = readFileSync(file, 'utf8'); } catch (e) {
      if (e.code === 'ENOENT') return null;
      return fail('read', `cannot read ${file}: ${e.message}`, 'make the file readable and re-run');
    }
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) {
      return fail('read', `cannot read/parse ${file}: ${e.message}`,
        'repair the JSON in the file the detail names and re-run - a preview of a layer it could not read would be a guess');
    }
    if (!isPlainObject(parsed)) fail('read', `cannot read/parse ${file}: top-level config must be a JSON object`,
      'make the top level of the file a JSON object - an empty {} is a valid layer - then re-run');
    return text;
  };
  const repoText = readCopy(repoFile);
  const globalText = readCopy(GLOBAL_CONFIG);
  if (repoText === null && pairs.some((p) => layerOf(p.key) === 'repo')) {
    fail('read', `cannot read ${repoFile}: no such file`, 'create this repo\'s config with /cad-new-project or /cad-adopt, then re-run');
  }
  if (!GLOBAL_CONFIG && pairs.some((p) => layerOf(p.key) === 'global')) {
    fail('read', 'no user-global config path: the home directory could not be found', 'set CADENCE_GLOBAL_CONFIG to the file and re-run');
  }
  const shared = layerIdentity(GLOBAL_CONFIG) !== null && layerIdentity(GLOBAL_CONFIG) === layerIdentity(repoFile);

  const scratch = mkdtempSync(join(tmpdir(), 'cad-preview-'));
  try {
    const scratchRepo = join(scratch, '.planning', 'config.json');
    const scratchGlobal = shared ? scratchRepo : join(scratch, 'global', 'config.json');
    mkdirSync(dirname(scratchRepo), { recursive: true });
    if (repoText !== null) writeFileSync(scratchRepo, repoText);
    if (!shared && globalText !== null) { mkdirSync(dirname(scratchGlobal), { recursive: true }); writeFileSync(scratchGlobal, globalText); }
    const env = { ...process.env, CADENCE_GLOBAL_CONFIG: scratchGlobal };
    // a child that answers nothing readable is held as `bad` and refused when its turn comes, so the first refusal is still the first in order
    const start = (script, args, where) => new Promise((resolve) => {
      const child = spawn(process.execPath, [join(HERE, script), ...args], { cwd: where, env });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (d) => { stdout += d; });
      child.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
      const bad = () => ({ bad: `${script} ${args[0]} answered nothing readable: ${stderr || stdout}` });
      child.on('error', (e) => { stderr += e.message; resolve(bad()); });
      child.on('close', () => { try { resolve({ body: JSON.parse(stdout) }); } catch { resolve(bad()); } });
    });
    const take = (answer) => (answer.bad === undefined ? answer.body : fail('internal', answer.bad));
    const run = async (script, args, where) => take(await start(script, args, where));
    const keys = pairs.map((p) => p.key);
    const candidates = candidateKeys(SCHEMA, keys);
    const roles = rolesFor(keys);
    // every read of a side starts at once and is read back in key order, layer rows first and then the route decisions
    const readSide = async () => {
      const answers = await Promise.all([
        ...candidates.map((key) => start('config.mjs', ['layers', '--key', key], scratch)),
        ...roles.map((role) => start('route.mjs', ['resolve', '--role', role, '--file', scratchRepo,
          '--planning-root', join(cwd, '.planning'), '--no-record'], cwd)),
      ]);
      const rows = {};
      candidates.forEach((key, i) => {
        const r = take(answers[i]);
        if (r.ok !== true) { out(r); throw DONE; }
        rows[key] = r.row;
      });
      const decisions = {};
      roles.forEach((role, i) => { decisions[role] = take(answers[candidates.length + i]); });
      return { rows, decisions };
    };
    const before = await readSide();
    // a refusal from the scratch set names the scratch files, which are gone by the time it's read: say the real ones
    const realPaths = (answer) => {
      const esc = (p) => JSON.stringify(p).slice(1, -1);
      let text = JSON.stringify(answer);
      if (!shared && GLOBAL_CONFIG) text = text.split(esc(scratchGlobal)).join(esc(GLOBAL_CONFIG));
      return JSON.parse(text.split(esc(scratchRepo)).join(esc(repoFile)));
    };
    const apply = async (args) => { const r = await run('config.mjs', ['set', ...args], scratch); if (r.ok !== true) { out(realPaths(r)); throw DONE; } };
    const tokensFor = (layer) => tokens.filter((t) => pairs.some((p) => t.startsWith(`${p.key}=`) && layerOf(p.key) === layer));
    if (shared) await apply(['--file', scratchRepo, ...tokens]);
    else {
      if (tokensFor('repo').length) await apply(['--file', scratchRepo, ...tokensFor('repo')]);
      if (tokensFor('global').length) await apply(['--global', ...tokensFor('global')]);
    }
    const after = await readSide();
    const files = [];
    for (const layer of ['repo', 'global']) {
      const mine = pairs.filter((p) => (shared ? 'repo' : layerOf(p.key)) === layer);
      if (mine.length) files.push({ layer, file: layer === 'repo' ? repoFile : GLOBAL_CONFIG, pairs: mine });
    }
    out({ ok: true, ...buildPreview({ files, otherFile: { repo: repoFile, global: GLOBAL_CONFIG }, before, after, candidates }) });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}


const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
function optFile(tokens) {
  // --global reads through its declared row too, so a subcommand can't accept a --global it never declared.
  // That was live on get while only validate and set declared it, and self-verify stayed green because no
  // workflow prose spelled the pair. It's tested first and short-circuits before --file is looked at; the row
  // is boolean, so presence is the whole grammar.
  const globalRow = CONTRACTS['config.mjs'][cmd]['--global'];
  const gi = tokens.indexOf('--global');
  if (globalRow !== undefined && evaluateFlag(tokens, '--global', globalRow).value === true) {
    return { file: GLOBAL_CONFIG, global: true, tokens: tokens.filter((_, j) => j !== gi) };
  }
  const i = tokens.indexOf('--file');
  if (i < 0) return { file: '.planning/config.json', global: false, tokens };
  // --file goes through its row in lib/arg-contract.mjs, read at the call since check and keys declare none
  // `--file $VAR` unset, or `--file --nonsense`, once gave file: undefined and get read only the global layer
  // The refusal keeps this bin's own usage wording; the contract mints no reason code.
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
    // --global comes off its declared row like optFile reads it, but not through optFile: that falls through to
    // the --file row once a --file token shows up, check declares none, and undefined would reach evaluateFlag
    // as reason:"internal". The flag token is dropped before checkPairs so it isn't read as a pair.
    const gi = rest.indexOf('--global');
    const asGlobal = evaluateFlag(rest, '--global', CONTRACTS['config.mjs'].check['--global']).value === true;
    // Same failure shape as set, with the same per-pair entry, so a caller reads detail once and the inspect
    // face reports the scope refusal the write face gives.
    const { errors } = checkPairs(asGlobal ? rest.filter((_, j) => j !== gi) : rest, asGlobal);
    if (errors.length) out({ ok: false, reason: 'invalid', detail: errors,
      hint: 'each error names the pair it refused - run `config.mjs keys` for the keys this schema carries and the values each one takes, then re-run with a pair it accepts' });
    else out({ ok: true });
  }
  else if (cmd === 'set') { const { file, tokens, global } = optFile(rest); set(file, tokens, global); }
  // no global argument: the file alone says which layer, and unset never creates one
  else if (cmd === 'unset') { const { file, tokens } = optFile(rest); unset(file, tokens); }
  else if (cmd === 'get') { const { file, tokens, global } = optFile(rest); get(file, tokens, global); }
  else if (cmd === 'keys') {
    if (evaluateFlag(rest, '--walk', CONTRACTS['config.mjs'].keys['--walk']).value === true) out({ ok: true, walk: walkRead() });
    else out({ ok: true, keys: SCHEMA });
  }
  // the repo's cwd, like every other default here; `get` would answer on a repo-only value, so deciders read this
  else if (cmd === 'preview') await previewRead(rest);
  else if (cmd === 'workflow-layers') {
    const r = workflowLayers(process.cwd());
    const unreadable = [];
    if (Object.values(r.keys).some((k) => k.repo === 'unreadable')) unreadable.push(r.repoFile);
    if (Object.values(r.keys).some((k) => k.global === 'unreadable')) unreadable.push(r.globalFile);
    out({ ok: true, ...r, unreadable });
  }
  else if (cmd === 'catalog') layersRead(undefined, false, undefined, true);
  else if (cmd === 'layers') {
    const row = CONTRACTS['config.mjs'].layers;
    const next = 'use `layers`, `layers --group <name>`, `layers --group <name> --advanced` or `layers --key <key>`';
    const g = evaluateFlag(rest, '--group', row['--group']);
    const k = evaluateFlag(rest, '--key', row['--key']);
    if (!g.ok || !k.ok) fail('usage', `${g.ok ? '--key' : '--group'} needs a value after it`, next);
    const advanced = evaluateFlag(rest, '--advanced', row['--advanced']).value === true;
    const used = new Set(['--group', '--key', '--advanced', g.value, k.value]);
    const stray = rest.filter((t) => !used.has(t));
    if (stray.length || (g.value !== undefined && k.value !== undefined) || (advanced && g.value === undefined)) {
      fail('usage', stray.length ? `unexpected: ${stray.join(' ')}` : '--advanced goes with --group, and --group and --key do not combine', next);
    }
    layersRead(g.value, advanced, k.value);
  }
  else fail('usage', 'subcommand: validate | check | set | unset | get | keys | workflow-layers | layers | catalog | preview');
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
