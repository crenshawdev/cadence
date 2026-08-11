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
// and never its `source` or `warnings` fields. The merged VALUES do not move in
// this phase (D-05), so every assertion here holds before and after the
// read-face identity fix lands beside it.
//
// Every arm carries TWO contrasting values for the key it drives, and pins the
// DECISION rather than an echo of the input. An `x === getValue(x)` pair moves
// together under a mutation and answers "yes" on a wrong value, and a single
// value is satisfied by a hardcoded constant - both were live here: the
// git-branch arm compared the seam's echoed `mode` field while the decision it
// fed was blind to the config, and three arms had one value to hit. The last
// section covers the merge itself, which both faces share and neither could
// therefore disagree about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(BIN, 'config.mjs');

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
function layers({ global, repo } = {}) {
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
function getValue(key, fx) {
  const env = { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: fx.globalFile };
  const raw = execFileSync('node', [CONFIG, 'get', '--file', fx.repoFile, key],
    { encoding: 'utf8', env });
  const r = JSON.parse(raw.trim());
  assert.equal(r.ok, true, `config.mjs get ${key}: ${raw}`);
  return r.values[key];
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
function seam(script, args, { globalFile, cwd, stdin }) {
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
function gitLayers({ branch = 'main', origin = false, ...spec } = {}) {
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

// --- route.mjs: the stakes level a layer set --------------------------------

test('route: the stakes it routes on is what config.mjs get reports (global layer)', () => {
  // The global layer alone carries `stakes`, so the merge is doing real work:
  // route.mjs must inherit it exactly as `get` reports it.
  const fx = layers({
    global: { stakes: 'critical' },
    repo: { model: { escalate_on_failure: true } },
  });
  // `--phase 9` names a phase with no PLAN (no phases/ dir at all), so the
  // computed risk floor (STK-03) cannot fire and this arm stays about config
  // rather than about surface detection.
  const r = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', fx.repoFile, '--phase', '9'], fx);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, getValue('stakes', fx));
  // ...and the value came from the global layer, not from the schema default:
  // `shipped` is what an unset `stakes` resolves to.
  assert.equal(r.stakes, 'critical');

  // The contrasting value, so a hardcoded `critical` fails this arm: the same
  // read over a different global-layer value has to land somewhere else. `solo`
  // is not the default either, so neither constant satisfies both halves.
  const low = layers({ global: { stakes: 'solo' }, repo: { model: { escalate_on_failure: true } } });
  const r2 = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', low.repoFile, '--phase', '9'], low);
  assert.equal(r2.ok, true);
  assert.equal(r2.stakes, getValue('stakes', low));
  assert.equal(r2.stakes, 'solo');
});

// --- the three --dir git seams ----------------------------------------------

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

test('land-cleanup: the base branch it resolves is what get reports', () => {
  // land-cleanup.mjs:71-76 reads git.base_branch off the merged config. The
  // fixture needs no git repo: readMergedBranches degrades to [] when git
  // cannot read the directory, which is the ordinary advisory path.
  const fx = layers({
    global: { git: { base_branch: 'release-2' } },
    repo: { git: { on_land_cleanup: true } },
  });
  const d = seam('land-cleanup.mjs', ['cleanup', '--dir', fx.root], fx);
  assert.equal(d.ok, true);
  assert.equal(d.base, getValue('git.base_branch', fx));
  // Not the fallback: with the key unset, base would be protected_branches[0],
  // i.e. `main`.
  assert.equal(d.base, 'release-2');

  // The contrasting value, so a hardcoded base fails this arm: neither
  // `release-2` nor the `main` fallback satisfies both halves.
  const other = layers({
    global: { git: { base_branch: 'stable' } },
    repo: { git: { on_land_cleanup: true } },
  });
  const d2 = seam('land-cleanup.mjs', ['cleanup', '--dir', other.root], other);
  assert.equal(d2.ok, true);
  assert.equal(d2.base, getValue('git.base_branch', other));
  assert.equal(d2.base, 'stable');
});

test('land-cleanup: with git.base_branch unset, get says null and the seam says main', () => {
  // The THIRD expected divergence in this file, and the only one that is the
  // default state of every unconfigured install rather than a deliberate
  // narrowing: `git.base_branch` defaults to null in the schema, and
  // land-cleanup.mjs:76 falls back to `protectedBranches[0]` rather than
  // landing a null base. So `get` answers null and the seam acts on `main`.
  //
  // Recorded rather than asserted equal, for the same reason as the two layer
  // narrowings: a future change that made the seam honour the null - or moved
  // the fallback off the protected list - would then fail a test instead of
  // passing silently. It is a fallback DEFAULT, not a layer disagreement, which
  // is why it sits with its own seam rather than in the narrowings section.
  const bare = layers({ repo: { git: { on_land_cleanup: true } } });
  assert.equal(getValue('git.base_branch', bare), null, 'get: unset resolves to the schema default');
  const d = seam('land-cleanup.mjs', ['cleanup', '--dir', bare.root], bare);
  assert.equal(d.ok, true);
  assert.equal(d.base, 'main');
  assert.deepEqual(getValue('git.protected_branches', bare), ['main', 'master'],
    'and `main` is protected_branches[0], not a constant of its own');

  // Which is what the fallback follows, not the literal `main`: move the
  // protected list and the base moves with it, still with `get` reporting null.
  const listed = layers({
    global: { git: { protected_branches: ['release-2', 'main'] } },
    repo: { git: { on_land_cleanup: true } },
  });
  assert.equal(getValue('git.base_branch', listed), null);
  const d2 = seam('land-cleanup.mjs', ['cleanup', '--dir', listed.root], listed);
  assert.equal(d2.base, 'release-2');
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

// --- the two repo-layer narrowings, encoded as EXPECTED divergences ---------
//
// These seams deliberately read NARROWER than the merged config, so their arms
// assert the divergence rather than equality. Widening either narrowing later
// fails a test instead of passing silently. (The file's third divergence is not
// a narrowing at all - it is land-cleanup's `base_branch` fallback default, and
// it is recorded with that seam's own arm above.)

/** A `{findings}` stdin payload carrying one surviving blocker. */
const BLOCKER = JSON.stringify({ findings: [{ severity: 'blocker' }] });

test('git-publish + land-cleanup: one git.auto_close, two questions, two layer reads', () => {
  // The EXPECTED divergence, and why it is not an inconsistency to eliminate.
  // The two seams ask different things of one key. git-publish.mjs:56-61
  // (`repoAutoClose`) asks "am I authorized to push unattended HERE", which D-08
  // answers repo-layer-only so a user-global value starts no close in an
  // unrelated project. land-cleanup.mjs's gate() asks "is anybody WATCHING", and
  // that must match what the prose branched on - skills/cad-land/SKILL.md:27
  // reads the MERGED value and suppresses the pre_ship triage ask under it, so
  // the gate's halt is what replaces the human it switched off.
  //
  // Collapsing the two onto the repo layer (0b1c322, reverted) aligned the
  // values and disarmed the pairing: triage suppressed, gate proceeding, and on
  // the GitLab arm - where no publish seam gates the chain - a blocker merged.
  const fx = gitLayers({
    branch: 'cadence/v9.9.9', origin: true,
    global: { git: { auto_close: true } },
    repo: { git: { on_land_cleanup: true } },
  });
  assert.equal(getValue('git.auto_close', fx), true, 'get reports the MERGED value');
  const d = seam('git-publish.mjs', ['publish', '--dir', fx.root, '--remote', 'origin'], fx);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'auto-close-off', 'publish narrows to the repo layer (D-08)');
  assert.equal(refExists(fx.bare, 'refs/heads/cadence/v9.9.9'), false, 'nothing was pushed');
  const g = seam('land-cleanup.mjs', ['gate', '--dir', fx.root], { ...fx, stdin: BLOCKER });
  assert.equal(g.action, 'halt', 'the gate reads the merged value the prose suppressed triage on');
  assert.match(g.reason, /auto_close on/);

  // The contrast that makes both halves about the LAYER rather than about an
  // absent key: the same value in the REPO layer turns both seams on, and a
  // global `false` cannot turn either back off.
  const repoFx = gitLayers({
    branch: 'cadence/v9.9.9', origin: true,
    global: { git: { auto_close: false } },
    repo: { git: { auto_close: true } },
  });
  const d2 = seam('git-publish.mjs', ['publish', '--dir', repoFx.root, '--remote', 'origin'], repoFx);
  assert.equal(d2.action, 'published');
  assert.equal(refExists(repoFx.bare, 'refs/heads/cadence/v9.9.9'), true);
  const g2 = seam('land-cleanup.mjs', ['gate', '--dir', repoFx.root], { ...repoFx, stdin: BLOCKER });
  assert.equal(g2.action, 'halt');
});

test('git-publish: the protected list it refuses on IS the merged one get reports', () => {
  // The same seam's other config read goes through the merge, so this half is
  // an equality arm - the narrowing above is specific to git.auto_close.
  const spec = {
    global: { git: { protected_branches: ['release'] } },
    repo: { git: { auto_close: true } },
  };
  const onList = gitLayers({ branch: 'release', origin: true, ...spec });
  assert.deepEqual(getValue('git.protected_branches', onList), ['release']);
  const refused = seam('git-publish.mjs',
    ['publish', '--dir', onList.root, '--remote', 'origin'], onList);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'protected-branch');
  assert.equal(refused.branch, 'release');
  assert.equal(refExists(onList.bare, 'refs/heads/release'), false);

  // The other direction is what proves the seam read the merged list rather
  // than its ['main','master'] fallback: `main` is protected by the fallback
  // and by nothing the merged config names, so it publishes.
  const offList = gitLayers({ branch: 'main', origin: true, ...spec });
  assert.equal(getValue('git.protected_branches', offList).includes('main'), false);
  const published = seam('git-publish.mjs',
    ['publish', '--dir', offList.root, '--remote', 'origin'], offList);
  assert.equal(published.ok, true);
  assert.equal(published.action, 'published');
  assert.equal(refExists(offList.bare, 'refs/heads/main'), true);
});

test('route: a retired risk.override is named by both faces, and routes nothing', () => {
  // The eight `risk.override.*` keys were retired with the dispatch-time floor
  // in v2.7.0. An existing config carrying one must WARN, not break, and must
  // not move a single knob.
  const fx = layers({
    global: {},
    repo: { stakes: 'solo', risk: { override: { auth: true } } },
  });
  planFiles(fx, 9, ['README.md', 'src/auth/session.rs']);
  const r = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', fx.repoFile, '--phase', '9'], fx);
  assert.equal(r.ok, true);
  // The configured level stands: an auth path in the plan raises nothing now.
  assert.equal(r.stakes, 'solo');
  assert.equal(r.model, 'sonnet');
  const named = (r.warnings || []).filter((w) => w.includes('risk.override.auth'));
  assert.ok(named.length >= 1, JSON.stringify(r.warnings));
  assert.match(named[0], /retired in v2\.7\.0/);
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
function consultOverCap(fx, cap) {
  const keyFile = join(fx.root, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="from-file"\n');
  const situation = 'x'.repeat(4 * cap + 8);   // chars/4 proxy: est > cap
  return seam('review-provider.mjs',
    ['consult', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { ...fx, cwd: fx.root, stdin: JSON.stringify({ situation }) });
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
  const r = consultOverCap(fx, cap);
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
    global: { stakes: 'critical' },
    repo: { stakes: 'solo' },
  });
  // `--phase 9` names a phase with no PLAN, so no computed risk floor can raise
  // `solo` back to `critical` and make an inverted merge look right.
  const r = seam('route.mjs',
    ['resolve', '--role', 'cad-executor', '--file', fx.repoFile, '--phase', '9'], fx);
  assert.equal(r.ok, true);
  assert.equal(getValue('stakes', fx), 'solo', 'get: the repo layer wins');
  assert.equal(r.stakes, 'solo', 'route: the repo layer wins, on the same fixture');
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
  const r = consultOverCap(fx, cap);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'over-cap', JSON.stringify(r));
  assert.equal(capInDetail(r.detail), cap, r.detail);
});
