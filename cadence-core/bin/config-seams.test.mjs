// Zero-dep cross-seam config tests (phase 1, AC7). Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// One question per arm: does the seam act on the value `config.mjs get`
// reports for a key that seam actually reads? No single config key is read by
// all seven consuming seams, so each arm picks a key its own seam reads (D-09)
// and drives BOTH faces over the SAME two layers.
//
// Hermetic by construction: every seam invocation and every `config.mjs get`
// runs as a subprocess with CADENCE_GLOBAL_CONFIG pointed at a fixture path
// (GLOBAL_CONFIG is a module-load const off process.env - D-07), so no row can
// read the developer's real ~/.claude/cadence/config.json. Git fixtures run
// with GIT_CONFIG_GLOBAL/SYSTEM=/dev/null for the same reason.
//
// Deliberately narrow: these arms assert `values[<key>]` from `config.mjs get`
// and never its `source` field. The merged VALUES do not move for the CFG-01
// arms (D-05), so every assertion there holds before and after the read-face
// identity fix lands beside it.
//
// `warnings` is read by exactly the three CFG-02 arms at the foot of this file,
// and only because the question THEY ask is about the warning channel itself -
// a key that is silently ignored and a key that is ignored and announced differ
// in nothing a value assertion can see (AC3, D-13). Each of those reads carries
// a comment saying so, so the channel is never asserted by accident.
//
// Every arm carries TWO contrasting values for the key it drives, and pins the
// DECISION rather than an echo of the input. An `x === getValue(x)` pair moves
// together under a mutation and answers "yes" on a wrong value, and a single
// value is satisfied by a hardcoded constant - both were live here: the
// git-branch arm compared the seam's echoed `mode` field while the decision it
// fed was blind to the config, and three arms had one value to hit. The last
// section covers the merge itself, which both faces share and neither could
// therefore disagree about.
//
// Four helpers here are EXPORTED - `layers`, `gitLayers`, `seam`, `getValue`
// (D-19). A second test file that needs this two-layer git fixture imports them
// rather than copying them, which is the drift a copy-paste fixture produces.
// `hostileLayers` and the `GLOBAL_ONLY_*` payloads stay private (D-20): a
// prototype-pollution payload has no bearing on a leaked remote URL, and D-11
// forbids that config reaching another file's runs.
//
// Importing a test file also REGISTERS its tests in the importing process, so
// every arm below would run a second time - 17 subprocess-spawning arms - inside
// whatever file imported the fixture. `test` is therefore bound to a no-op
// unless this module IS the entry file, the same run-as-script discipline REV-01
// shipped for review-provider.mjs. Under `node --test <file>` the entry file is
// `process.argv[1]`, so a direct run still registers all 17.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BIN = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(BIN, 'config.mjs');

/**
 * True iff this module is what node was told to run. `realpathSync` on both
 * sides so a symlinked checkout - the shape REV-01's own no-op bug came from -
 * still matches; an argv[1] that no longer exists just answers false.
 */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// The dev's git config (commit.gpgsign, init.defaultBranch, hooks) must never
// reach a fixture repo - git-guard.test.mjs / git-publish.test.mjs discipline.
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };

// An empty XDG config root for every child, so review-provider.mjs's key-file
// fallback cannot reach the developer's real providers.env (see `seam` below).
const NO_XDG = mkdtempSync(join(tmpdir(), 'cad-seams-xdg-'));

/** Run a git command against a fixture dir, hermetically. */
function git(args) {
  execFileSync('git', args, { stdio: 'ignore', env: GIT_ENV });
}

/**
 * A two-layer fixture: `<root>/.planning/config.json` carries `repo` and a
 * separate file outside the root carries `global`. Either object may be
 * omitted, which writes no file at all - a legitimately absent layer.
 *
 * The global file lives in its OWN temp dir, never under `root`: the two layers
 * must be two distinct files here (a shared file is the collapse case, which is
 * the identity fix's subject, not this file's), and nothing a git fixture stages
 * may pick it up.
 * @param {{global?: any, repo?: any}} [spec]
 */
export function layers({ global, repo } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-seams-'));
  mkdirSync(join(root, '.planning'), { recursive: true });
  const repoFile = join(root, '.planning', 'config.json');
  if (repo !== undefined) writeFileSync(repoFile, JSON.stringify(repo));
  const globalFile = join(mkdtempSync(join(tmpdir(), 'cad-seams-global-')), 'global.json');
  if (global !== undefined) writeFileSync(globalFile, JSON.stringify(global));
  return { root, repoFile, globalFile };
}

/**
 * The effective value `config.mjs get` reports for one key over this fixture's
 * two layers - `values[key]` and nothing else. `source` and `warnings` are
 * deliberately untouched: the warning channel gains entries elsewhere in this
 * phase, and an arm reading it would couple this file to that ordering.
 * @param {string} key @param {{repoFile: string, globalFile: string}} fx
 */
export function getValue(key, fx) {
  const env = { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: fx.globalFile };
  const raw = execFileSync('node', [CONFIG, 'get', '--file', fx.repoFile, key],
    { encoding: 'utf8', env });
  const r = JSON.parse(raw.trim());
  assert.equal(r.ok, true, `config.mjs get ${key}: ${raw}`);
  return r.values[key];
}

/**
 * The `warnings` array `config.mjs get` reports over this fixture's two layers,
 * or `[]` when the field is absent. Read by the CFG-02 arms alone, where the
 * question IS the warning channel; every other arm in this file reads
 * `getValue` and nothing else.
 * @param {{repoFile: string, globalFile: string}} fx
 */
function getWarnings(fx) {
  const env = { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: fx.globalFile };
  const raw = execFileSync('node', [CONFIG, 'get', '--file', fx.repoFile],
    { encoding: 'utf8', env });
  const r = JSON.parse(raw.trim());
  assert.equal(r.ok, true, `config.mjs get: ${raw}`);
  return r.warnings || [];
}

/**
 * Run a seam as a subprocess over this fixture's layers; return the parsed JSON
 * line. The seams mirror `ok` into the exit code (lib/seam-io.mjs), so a refusal
 * makes execFileSync throw with the JSON still on `e.stdout`.
 *
 * Provider API keys are stripped from every child environment, and
 * XDG_CONFIG_HOME is pinned at an empty fixture dir: no arm here wants a key,
 * and the review-provider arms must resolve theirs from a fixture file. Both
 * halves are needed - `resolveKey` falls back from the env var to
 * `${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env`
 * (review-provider.mjs:111-115), so deleting the env vars alone still lets a
 * developer's REAL key file answer, and an arm that dropped `--key-file` would
 * pass here and fail on a machine that has no such file.
 * @param {string} script @param {string[]} args
 * @param {{globalFile: string, cwd?: string, stdin?: string}} opts
 */
export function seam(script, args, { globalFile, cwd, stdin }) {
  const env = { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: globalFile, XDG_CONFIG_HOME: NO_XDG };
  delete env.OPENAI_API_KEY;
  delete env.GEMINI_API_KEY;
  delete env.DEEPSEEK_API_KEY;
  let out;
  try {
    out = execFileSync('node', [join(BIN, script), ...args], {
      encoding: 'utf8', env,
      ...(cwd !== undefined ? { cwd } : {}),
      ...(stdin !== undefined ? { input: stdin } : {}),
    });
  } catch (e) { out = e.stdout; }
  return JSON.parse(String(out).trim());
}

/**
 * The same two-layer fixture with a real git repo at the root: `git init -b
 * <branch>` plus one commit, and optionally a local bare `origin` - which is
 * what keeps a publish hermetic (no network, and the bare is inspectable).
 * @param {{branch?: string, origin?: boolean, global?: any, repo?: any}} [spec]
 */
export function gitLayers({ branch = 'main', origin = false, ...spec } = {}) {
  const fx = layers(spec);
  git(['-C', fx.root, 'init', '-q', '-b', branch]);
  writeFileSync(join(fx.root, 'f.txt'), 'x');
  git(['-C', fx.root, 'add', 'f.txt']);
  git(['-C', fx.root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);
  if (!origin) return { ...fx, bare: null };
  const bare = mkdtempSync(join(tmpdir(), 'cad-seams-bare-'));
  git(['-C', bare, 'init', '-q', '--bare']);
  git(['-C', fx.root, 'remote', 'add', 'origin', bare]);
  return { ...fx, bare };
}

/**
 * The payload a hostile repo layer wants to install under `git`. EITHER half
 * alone disarms the guard on a protected branch, so an arm that goes red is not
 * telling you which half arrived.
 */
const HOSTILE_GIT = { on_protected: 'allow', protected_branches: [] };

/**
 * The three keys a repo layer must not be able to CHOOSE (CFG-02):
 * `workflow.test_command` and `workflow.lint_command` say what Cadence runs,
 * `review.key_file` says where a provider key is read from. Two contrasting
 * value sets, so an arm pins the decision rather than an echo of its input.
 */
const GLOBAL_ONLY_REPO = {
  workflow: { test_command: 'repo-t', lint_command: 'repo-l' },
  review: { key_file: '/repo/keys.env' },
};
const GLOBAL_ONLY_GLOBAL = {
  workflow: { test_command: 'global-t', lint_command: 'global-l' },
  review: { key_file: '/global/keys.env' },
};
/**
 * The same three keys at `null` - the shape `cadence-core/templates/config.json`
 * ships into every scaffolded repo, copied verbatim by new-project and adopt.
 */
const GLOBAL_ONLY_NULLS = {
  workflow: { test_command: null, lint_command: null },
  review: { key_file: null },
};
/** `[key, the repo layer's value, the global layer's value]`, one row each. */
const GLOBAL_ONLY_ROWS = [
  ['workflow.test_command', 'repo-t', 'global-t'],
  ['workflow.lint_command', 'repo-l', 'global-l'],
  ['review.key_file', '/repo/keys.env', '/global/keys.env'],
];

/**
 * The ONE hostile fixture (CFG-01 and CFG-02 are both proved against it): a git
 * repo on `main` whose REPO layer is a `.planning/config.json` that arrived with
 * a clone, carrying `HOSTILE_GIT` under a prototype-polluting key.
 *
 * Two axes, because the two LIVE spellings fire under OPPOSITE global-layer
 * states. `proto-top` reparents the merged config only when no global layer
 * defines `git`; `proto-nested` is its mirror and only bites when one does - so
 * `globalGit` is not a variation, it is the other half of the coverage. That
 * global layer defines `git` WITHOUT defining `on_protected`, deliberately: an
 * own key there would shadow anything installed on the merged object's
 * prototype and the arm would read the same value before and after the repair.
 * `constructor` and `prototype` are the two inert spellings, and `spelling:
 * null` is the benign control - the same fixture with the key dropped.
 *
 * `globalOnly` is the CFG-02 half of the same file, which is what makes this ONE
 * fixture rather than two (AC7): `set` has the repo layer SET all three
 * global-only keys, `null` has it carry them at the template's `null`, and
 * `honoured` puts a different value for each in the user-global layer - the
 * layer that IS allowed to set them. A `.planning/config.json` that arrived with
 * a clone reaches for both things at once, so the fixture does too, and
 * reverting either fix alone turns an arm red.
 *
 * Built under mkdtemp like every other fixture here, never checked in: a hostile
 * config.json under bin/fixtures/ becomes input to this repository's own tooling
 * runs. The key is written through a COMPUTED property, because `{__proto__: x}`
 * in JS source sets the prototype instead of creating the key an attacker ships
 * - and the spread below carries it on as an own data property for the same
 * reason, never through an assignment that would fire the setter.
 * @param {{spelling?: string|null, globalGit?: boolean,
 *   globalOnly?: 'set'|'null'|null, honoured?: boolean}} [spec]
 */
function hostileLayers({ spelling = null, globalGit = false,
  globalOnly = null, honoured = false } = {}) {
  const PROTO = '__proto__';
  const key = spelling === 'proto-top' ? PROTO : spelling;
  const hostile = spelling === null ? {}
    : spelling === 'proto-nested' ? { git: { [PROTO]: { ...HOSTILE_GIT } } }
      : { [key]: { git: { ...HOSTILE_GIT } } };
  const scoped = globalOnly === 'set' ? GLOBAL_ONLY_REPO
    : globalOnly === 'null' ? GLOBAL_ONLY_NULLS : {};
  const global = {
    ...(globalGit ? { git: { base_branch: 'main' } } : {}),
    ...(honoured ? GLOBAL_ONLY_GLOBAL : {}),
  };
  return gitLayers({
    branch: 'main',
    repo: { ...hostile, ...scoped },
    ...(Object.keys(global).length ? { global } : {}),
  });
}

/**
 * Feed git-guard.mjs a PreToolUse payload for `command` run at the fixture root;
 * return the parsed decision, or null when the guard says nothing. It cannot go
 * through `seam`: an EMPTY stdout is the guard's silent verdict, and the hook
 * always exits 0.
 * @param {string} command @param {{root: string, globalFile: string}} fx
 */
function guard(command, fx) {
  const env = { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: fx.globalFile };
  const stdout = execFileSync('node', [join(BIN, 'git-guard.mjs')], {
    encoding: 'utf8', env,
    input: JSON.stringify({ tool_input: { command }, cwd: fx.root }),
  }).trim();
  return stdout ? JSON.parse(stdout).hookSpecificOutput : null;
}

/** True iff `ref` exists in the bare repo `bare`. */
function refExists(bare, ref) {
  try { git(['-C', bare, 'rev-parse', '--verify', ref]); return true; }
  catch { return false; }
}

/**
 * A `<root>/.planning/PROJECT.md` whose `### Active` section names `version`,
 * which is what `integrationBranchName` derives the branch name from - without
 * it the milestone arm degrades to a naming-problem `ask` for the wrong reason.
 * @param {{root: string}} fx @param {string} version
 */
function projectProse(fx, version) {
  writeFileSync(join(fx.root, '.planning', 'PROJECT.md'),
    `## Requirements\n\n### Active\n\n\`${version}\` - the round\n\n### Out of Scope\n`);
}

/** A `<root>/.planning/phases/<phase>/PLAN.md` whose frontmatter declares `files`. */
function planFiles(fx, phase, files) {
  const pdir = join(fx.root, '.planning', 'phases', String(phase));
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'PLAN.md'),
    `---\nphase: ${phase}\nplan: 1\nrequirements:\n  - CFG-02\nfiles:\n${
      files.map((f) => `  - ${f}\n`).join('')}---\n\n# Plan\n`);
}

/** The `risk floor:` entries of a route bundle's reason list. */
const floorReasons = (r) => (r.reason || []).filter((x) => String(x).startsWith('risk floor: '));

// --- route.mjs: the per-role values a layer set -----------------------------

test('route: the rung it routes on is what config.mjs get reports (global layer)', () => {
  // The global layer alone carries `roles.cad-executor.effort`, so the merge is
  // doing real work: route.mjs must inherit it exactly as `get` reports it.
  const fx = layers({
    global: { roles: { 'cad-executor': { effort: 'max' } } },
    repo: { model: { escalate_on_failure: true } },
  });
  // `--phase 9` names a phase with no PLAN (no phases/ dir at all), so the
  // computed risk floor (STK-03) cannot fire and this arm stays about config
  // rather than about surface detection.
  const r = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', fx.repoFile, '--phase', '9'], fx);
  assert.equal(r.ok, true);
  assert.equal(r.effort, getValue('roles.cad-executor.effort', fx));
  // ...and the value came from the global layer, not from the schema default:
  // `high` is what an unset rung resolves to for this role.
  assert.equal(r.effort, 'max');

  // The contrasting value, so a hardcoded `max` fails this arm: the same read
  // over a different global-layer value has to land somewhere else. `low` is
  // not the default either, so neither constant satisfies both halves.
  const low = layers({
    global: { roles: { 'cad-executor': { effort: 'low' } } },
    repo: { model: { escalate_on_failure: true } },
  });
  const r2 = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', low.repoFile, '--phase', '9'], low);
  assert.equal(r2.ok, true);
  assert.equal(r2.effort, getValue('roles.cad-executor.effort', low));
  assert.equal(r2.effort, 'low');
});

// --- the remaining git seams ------------------------------------------------

test('git-branch: the integration_branch mode it DECIDES on is what get reports', () => {
  // git-branch.mjs:43 reads the key off the merged config, feeds it to
  // decideBranch (`:52`) and also echoes it back as `mode` (`:53`). Comparing
  // the ECHO to `get` proves nothing about the decision: hardcoding the
  // decision's `mode` to 'milestone' left the echo - and the whole file - green.
  //
  // So both halves run over a REAL git repo parked on the protected base with a
  // derivable integration name, the one state where the two modes diverge:
  // trunk stays and names no branch, milestone asks and names `cadence/v9.9.9`.
  const spec = { branch: 'main', repo: { git: { auto_branch: 'ask' } } };

  const trunk = gitLayers({ ...spec, global: { git: { integration_branch: 'trunk' } } });
  projectProse(trunk, 'v9.9.9');
  const t = seam('git-branch.mjs', ['decide', '--dir', trunk.root], trunk);
  assert.equal(t.ok, true);
  assert.equal(t.mode, getValue('git.integration_branch', trunk));
  // Not the `milestone` default and not a repo-layer value: the global layer is
  // the only place this came from.
  assert.equal(t.mode, 'trunk');
  assert.equal(t.currentBranch, 'main', 'the fixture is a real repo on the base');
  assert.equal(t.action, 'stay');
  assert.equal(t.branch, null, 'trunk mode names no integration branch');
  assert.match(t.reason, /trunk mode/);

  // The contrasting value over the identical repo state: only `mode` differs,
  // so the different decision can have come from nothing else.
  const milestone = gitLayers({ ...spec, global: { git: { integration_branch: 'milestone' } } });
  projectProse(milestone, 'v9.9.9');
  const m = seam('git-branch.mjs', ['decide', '--dir', milestone.root], milestone);
  assert.equal(m.ok, true);
  assert.equal(m.mode, getValue('git.integration_branch', milestone));
  assert.equal(m.mode, 'milestone');
  assert.equal(m.currentBranch, 'main');
  assert.equal(m.action, 'ask');
  assert.equal(m.branch, 'cadence/v9.9.9');
});



test('git-guard: the on_protected value it acts on is what get reports', () => {
  // The silent/ask pair rather than `refuse`: whether a refuse hard-blocks
  // depends on commitDecision's `canDeny`, which is a property of the hook
  // payload rather than of config, and this arm is about the config read.
  const allow = gitLayers({
    branch: 'main',
    global: { git: { on_protected: 'allow' } },
    repo: { git: { protected_branches: ['main'] } },
  });
  const configured = getValue('git.on_protected', allow);
  assert.equal(configured, 'allow');
  assert.equal(guard('git commit -m "x"', allow), null,
    `git.on_protected=${configured} means the guard emits nothing at all`);

  // The counterpart: no layer sets the key, so `get` answers with the schema
  // default and the guard acts on that same default.
  const unset = gitLayers({ branch: 'main', repo: { git: { protected_branches: ['main'] } } });
  assert.equal(getValue('git.on_protected', unset), 'ask');
  const d = guard('git commit -m "x"', unset);
  assert.notEqual(d, null);
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /protected branch/);
});

test('git-guard: a hostile repo layer cannot choose the value it acts on (CFG-01)', () => {
  // The same question as the arm above, asked of a config file that arrived
  // with a clone rather than one the user wrote. The contrast is the arm above:
  // this payload set as an ORDINARY key DOES silence the guard, so "ask" here is
  // a decision and not a constant. Pinned again on the same fixture shape:
  const legit = gitLayers({ branch: 'main', repo: { git: HOSTILE_GIT } });
  assert.equal(getValue('git.on_protected', legit), 'allow');
  assert.equal(guard('git commit -m "x"', legit), null, 'a real allow means silence');

  // Each spelling with the global-layer state it is LIVE under (D-07): a repair
  // proved against the top-level form alone leaves every machine that has a
  // global config exploitable while this file goes green.
  for (const [spelling, globalGit] of [['proto-top', false], ['proto-nested', true]]) {
    const label = `${spelling} (global layer defines git: ${globalGit})`;
    // The SAME file also carries the CFG-02 payload, and this arm asserts it:
    // sharing a fixture couples nothing on its own, so each requirement's arm
    // states the OTHER's observable or a lone revert goes green here (AC7).
    const fx = hostileLayers({ spelling, globalGit, globalOnly: 'set', honoured: true });
    const control = hostileLayers({ spelling: null, globalGit, globalOnly: 'set', honoured: true });
    const d = guard('git commit -m "x"', fx);
    assert.notEqual(d, null, `${label}: the guard went silent`);
    assert.equal(d.permissionDecision, 'ask', label);
    assert.match(d.permissionDecisionReason, /protected branch/, label);
    assert.deepEqual(d, guard('git commit -m "x"', control),
      `${label}: not identical to the benign control`);

    // The agreement half: what `get` reports IS what the guard acted on, for
    // BOTH halves of the payload - the branch list it would have emptied as
    // well as the decision it would have flipped.
    assert.equal(getValue('git.on_protected', fx), 'ask', label);
    assert.deepEqual(getValue('git.protected_branches', fx), ['main', 'master'], label);

    // The CFG-02 half of this same file: unwiring `stripGlobalOnly` turns this
    // arm red too, which is the half of AC7 the shared helper alone did not buy.
    for (const [key, , globalValue] of GLOBAL_ONLY_ROWS) {
      assert.equal(getValue(key, fx), globalValue, `${label}: ${key}`);
    }
  }
});

test('git-guard: the two inert hostile spellings, as regression pins only', () => {
  // PINS. `constructor` and `prototype` pass against the UNFIXED merge - it
  // returns the higher layer's value wholesale where the base side holds a
  // function or nothing, which makes an own shadow key rather than firing a
  // setter (D-08) - so these two distinguish nothing about the repair on their
  // own and must never stand in for the arm above.
  for (const spelling of ['constructor', 'prototype']) {
    for (const globalGit of [false, true]) {
      const label = `${spelling} (global layer defines git: ${globalGit})`;
      const fx = hostileLayers({ spelling, globalGit });
      assert.equal(getValue('git.on_protected', fx), 'ask', label);
      const d = guard('git commit -m "x"', fx);
      assert.notEqual(d, null, label);
      assert.equal(d.permissionDecision, 'ask', label);
    }
  }
});

// --- the two repo-layer narrowings, encoded as EXPECTED divergences ---------
//
// These seams deliberately read NARROWER than the merged config, so their arms
// assert the divergence rather than equality. Widening either narrowing later
// fails a test instead of passing silently.



test('route: a retired risk.override is named by both faces, and routes nothing', () => {
  // The eight `risk.override.*` keys were retired with the dispatch-time floor
  // in v2.7.0. CER-01 gives the floor back WITHOUT giving them back: an existing
  // config carrying one must WARN, not break, and must not move a single knob.
  const spec = { granularity: 'coarse', risk: { override: { auth: true } } };
  const fx = layers({ global: {}, repo: spec });
  planFiles(fx, 9, ['README.md', 'src/auth/session.rs']);
  const r = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', fx.repoFile, '--phase', '9'], fx);
  assert.equal(r.ok, true);
  // The declared `src/auth/session.rs` raises the floor, whose whole effect is
  // the plan gate and the deep-verify pass - this is the plan-time floor, not
  // the waiver, and the model and the rung are deliberately not among the
  // things it moves.
  assert.equal(r.review.plan, 'blocking');
  assert.equal(r.verify, 'on');
  const clear = layers({ global: {}, repo: { granularity: 'coarse' } });
  planFiles(clear, 9, ['README.md']);
  const q = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', clear.repoFile, '--phase', '9'], clear);
  assert.equal(q.review.plan, 'advisory', 'the clean fixture is the comparison, so it must be clean');
  assert.equal(r.model, q.model);
  assert.equal(r.effort, q.effort);
  assert.ok(r.reason.some((x) => /^risk floor: .*touches auth/.test(x)), JSON.stringify(r.reason));
  const named = (r.warnings || []).filter((w) => w.includes('risk.override.auth'));
  assert.ok(named.length >= 1, JSON.stringify(r.warnings));
  assert.match(named[0], /retired in v2\.7\.0/);

  // THE CONTROL, which is what makes this a test of the retired key rather than
  // of the floor: the identical fixture with the key REMOVED routes byte-for-byte
  // the same bundle, warnings aside. A waiver that lowered anything would show
  // here as a difference.
  const { risk, ...clean } = spec;
  const noKey = layers({ global: {}, repo: clean });
  planFiles(noKey, 9, ['README.md', 'src/auth/session.rs']);
  const c = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', noKey.repoFile, '--phase', '9'], noKey);
  const { warnings: _w1, ...withKey } = r;
  const { warnings: _w2, ...without } = c;
  assert.deepEqual(withKey, without);
  assert.equal('warnings' in c, false, JSON.stringify(c.warnings));
});

// --- the last two seams -----------------------------------------------------

/** A CAPTURE.md the BM25 corpus can be built from (one `## Todos` bullet). */
const CAPTURE = '# Capture\n\n## Todos\n\n- tokenkiller saturation race in the merge layer\n';

test('planning recall: the memory.backend it gates on is what get reports', () => {
  // planning.mjs:1233 merges `<dir>/config.json`, and this seam's --dir IS the
  // .planning directory - not the project root the git seams take.
  const off = layers({
    global: { memory: { backend: 'none' } },
    repo: { workflow: { research: true } },
  });
  writeFileSync(join(off.root, '.planning', 'CAPTURE.md'), CAPTURE);
  assert.equal(getValue('memory.backend', off), 'none');
  const r = seam('planning.mjs',
    ['recall', 'tokenkiller', '--dir', join(off.root, '.planning')], off);
  assert.equal(r.ok, true);
  assert.equal(r.backend, 'none');
  // Empty against a corpus that WOULD match, so this is the off switch rather
  // than an absent corpus.
  assert.deepEqual(r.results, []);

  // The counterpart: no layer sets the key, so `get` answers with the schema
  // default and recall runs on that same default.
  const on = layers({ repo: { workflow: { research: true } } });
  writeFileSync(join(on.root, '.planning', 'CAPTURE.md'), CAPTURE);
  assert.equal(getValue('memory.backend', on), 'builtin');
  const r2 = seam('planning.mjs',
    ['recall', 'tokenkiller', '--dir', join(on.root, '.planning')], on);
  assert.equal(r2.ok, true);
  assert.equal('backend' in r2, false, 'the off-switch field is absent when recall runs');
  assert.ok(r2.results.length >= 1, JSON.stringify(r2));
  assert.match(r2.results[0].snippet, /tokenkiller/);
});

/**
 * Drive `review-provider.mjs consult` over `fx` with a payload sized to exceed
 * `cap` estimated tokens, and return the parsed refusal. D-08: this seam reads a
 * CWD-relative `.planning/config.json` and caches per process, so it runs as a
 * subprocess with `cwd` at the fixture root - it gains no `--dir`/`--file` flag.
 *
 * The stub key in a throwaway fixture file is load-bearing twice over, exactly
 * as review-provider.test.mjs writes it. `cmdConsult` resolves the provider
 * FIRST and asserts the cap SECOND (review-provider.mjs:591,596), so without a
 * resolvable key the arm refuses `no-key` and never reaches the cap at all -
 * verified by running it with the three key env vars unset, no `--key-file`,
 * and XDG_CONFIG_HOME at an empty dir. And `--key-file` is what pins WHICH key
 * answers: without it `providersEnvPath` walks to
 * `${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env`, so on a developer
 * machine that has one, the arm reads a real key and reports over-cap while a
 * clean machine reports no-key.
 * @param {{root: string, repoFile: string, globalFile: string}} fx
 * @param {number} cap
 */
function reviewOverCap(fx, cap) {
  const keyFile = join(fx.root, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="from-file"\n');
  const artifact = 'x'.repeat(4 * cap + 8);   // chars/4 proxy: est > cap
  return seam('review-provider.mjs',
    ['review', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { ...fx, cwd: fx.root, stdin: JSON.stringify({ instruction: 'review this artifact', artifact }) });
}

/** The cap named in an `over-cap` refusal's detail, or null. */
function capInDetail(detail) {
  const m = /review\.max_prompt_tokens \((\d+)\)/.exec(String(detail));
  return m ? Number(m[1]) : null;
}

test('review-provider: a GLOBAL-layer prompt cap is the one it refuses on', () => {
  // Driven from the global layer like every other arm here, because the arm
  // below puts the decisive value in the REPO layer: with the cap there, both
  // faces read one file and severing this seam's global-layer read entirely
  // left the whole file green, while the live seam does honour a global-only cap.
  const fx = layers({
    global: { review: { max_prompt_tokens: 48 } },
    // 1ms, so a mutation that defeats the cap fails FAST rather than hanging the
    // suite: past the cap this command issues a real HTTPS request, and the
    // shipped default gives one 540s to answer.
    repo: { review: { request_timeout_ms: 1 } },
  });
  const cap = getValue('review.max_prompt_tokens', fx);
  assert.equal(cap, 48, 'the global layer alone carries it - not the 120000 default');
  const r = reviewOverCap(fx, cap);
  assert.equal(r.ok, false);
  // No network: the over-cap reason is itself the proof nothing was sent.
  assert.equal(r.reason, 'over-cap', JSON.stringify(r));
  assert.equal(capInDetail(r.detail), cap, r.detail);
});

// --- the merge layer both faces share ---------------------------------------
//
// Every arm above drives a seam and `config.mjs get` over the same two layers,
// and BOTH call the same `lib/config-merge.mjs` `mergeLayers`. So a bug in the
// merge moves the two sides identically and this file's own question answers
// "yes" on a wrong value: inverting the precedence to
// `deepMerge(repoValue, globalValue)` - the user-global layer silently beating
// the repo's own config - left 8 of 9 arms green.
//
// These two name the winning value LITERALLY over a fixture that sets one key
// in BOTH layers, so repo-wins is pinned by something other than the helper the
// two faces share. One top-level scalar, one nested under an object, because
// `deepMerge` reaches those by different paths.

test('merge precedence: the repo layer wins the same key, on both read faces', () => {
  const fx = layers({
    global: { roles: { 'cad-executor': { effort: 'max' } } },
    repo: { roles: { 'cad-executor': { effort: 'low' } } },
  });
  // `--phase 9` names a phase with no PLAN, so no computed risk floor exists to
  // make an inverted merge look right.
  const r = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', fx.repoFile, '--phase', '9'], fx);
  assert.equal(r.ok, true);
  assert.equal(getValue('roles.cad-executor.effort', fx), 'low', 'get: the repo layer wins');
  assert.equal(r.effort, 'low', 'route: the repo layer wins, on the same fixture');
});

test('review-provider: the prompt cap it refuses on is what get reports (cwd-relative)', () => {
  // The nested half of the precedence pin above: `review.max_prompt_tokens`
  // reaches the merged config through deepMerge's object recursion rather than
  // as a top-level scalar, and 64 is asserted literally on both faces.
  const fx = layers({
    global: { review: { max_prompt_tokens: 999999 } },
    repo: { review: { max_prompt_tokens: 64 } },
  });
  const cap = getValue('review.max_prompt_tokens', fx);
  assert.equal(cap, 64, 'the repo layer wins the merge over the global one');
  const r = reviewOverCap(fx, cap);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'over-cap', JSON.stringify(r));
  assert.equal(capInDetail(r.detail), cap, r.detail);
});

// --- CFG-02: the three keys a repo layer cannot choose ----------------------
//
// The section above pins repo-wins as the merge's rule. These three are the
// exception the rule now carries, on the SAME hostile fixture the CFG-01 arms
// use (AC7): the file that reaches for the merged config's prototype also
// reaches for what Cadence runs, and one helper builds both halves.

test('global-only keys: all THREE resolve to the user-global layer, never the repo one', () => {
  // One fixture, two requirements. Reverting the prototype repair turns the
  // `git.on_protected` half red; reverting the strip turns the three key reads
  // red - and each key is asserted, because the pure-lib unit tests prove the
  // SET, not that the merge strips every member of it. A strip that handled the
  // first key and dropped the rest passes a test_command-only arm.
  const fx = hostileLayers({ spelling: 'proto-top', globalOnly: 'set', honoured: true });
  for (const [key, , globalValue] of GLOBAL_ONLY_ROWS) {
    assert.equal(getValue(key, fx), globalValue, key);
  }
  // The CFG-01 half of the same file, asserted at the GUARD and not only at
  // `get`: reverting `deepMerge`'s own-property definition reparents the merged
  // config, but `mergeLayers`' result keeps an own `git` from the default layer,
  // so the read face still answers the schema default while
  // `git-guard.mjs`'s own `config.git?.on_protected` goes silent. A cross-arm
  // assertion placed on `get` alone cannot see the regression it exists for.
  assert.equal(getValue('git.on_protected', fx), 'ask', 'the CFG-01 half of the same file');
  const cfg01 = guard('git commit -m "x"', fx);
  assert.notEqual(cfg01, null, 'the CFG-01 half: the guard went silent');
  assert.equal(cfg01.permissionDecision, 'ask', 'the CFG-01 half at the guard');

  // ABOUT the warning channel, deliberately (AC3): a value assertion cannot see
  // the difference between a key that is dropped in silence and one that is
  // dropped and named, and an honest mistake needs the same visibility as an
  // attack. Both the key and the file it came from.
  const named = getWarnings(fx).filter((w) => /workflow\.test_command/.test(w));
  assert.equal(named.length, 1, JSON.stringify(getWarnings(fx)));
  assert.ok(named[0].includes(fx.repoFile), named[0]);

  // The contrast with NO global layer, which is what shows the repo value was
  // dropped rather than merely outranked: every read lands on the schema
  // default instead of on `repo-t`/`repo-l`/`/repo/keys.env`.
  const alone = hostileLayers({ spelling: 'proto-top', globalOnly: 'set' });
  for (const [key] of GLOBAL_ONLY_ROWS) assert.equal(getValue(key, alone), null, key);
});

test('global-only keys: the template shape at null overrides nothing and says nothing', () => {
  // `deepMerge` returns the higher layer's value for a null, so a repo `null`
  // left in the merge would SUPPRESS the user-global command - and
  // templates/config.json ships all three at null into every scaffolded repo.
  // The strip is therefore value-agnostic (D-13).
  const fx = hostileLayers({ globalOnly: 'null', honoured: true });
  for (const [key, , globalValue] of GLOBAL_ONLY_ROWS) {
    assert.equal(getValue(key, fx), globalValue, key);
  }
  // ABOUT the warning channel again, and the other half of D-13: warning on
  // PRESENCE would fire on three untouched keys at a new project's first
  // command, which trains exactly the click-through habit CFG-02 declined.
  assert.deepEqual(getWarnings(fx), []);
});
