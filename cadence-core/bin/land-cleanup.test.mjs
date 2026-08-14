// Zero-dep tests for land-cleanup.mjs (the close-decision seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Fixture style mirrors
// git-branch.test.mjs: a temp .planning dir with config/PROJECT/ROADMAP, driven
// through the seam with explicit --merged/--branch so no live git repo is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'land-cleanup.mjs');
// Hermetic global config (never read the dev's real ~/.claude one).
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-lc-')), 'no-global.json');

/** A .planning fixture with the given git config block. */
function fixture(gitConfig) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-lc-repo-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git: gitConfig }));
  writeFileSync(join(dir, '.planning', 'PROJECT.md'),
    '## Requirements\n### Active\n\n`v1.1.0-rc.2` - the round\n\n### Out of Scope\n');
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), '# Roadmap: Cadence v1.1.0-rc.2\n');
  return dir;
}

/** A real git repo (over a .planning fixture) with cadence/<v> merged into main,
 *  so `git branch --merged main` lists it and the reap target resolves for real. */
function gitFixture(gitConfig) {
  const dir = fixture(gitConfig);
  const g = (...a) => execFileSync('git', ['-C', dir, ...a],
    { stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  g('init', '-q');
  g('config', 'user.email', 'test@example.com');
  g('config', 'user.name', 'test');
  g('config', 'commit.gpgsign', 'false');
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  g('branch', '-M', 'main');
  g('checkout', '-q', '-b', 'cadence/v1.1.0-rc.2');
  writeFileSync(join(dir, 'work.txt'), 'x');
  g('add', '-A');
  g('commit', '-q', '-m', 'work');
  g('checkout', '-q', 'main');
  g('merge', '-q', '--no-ff', '-m', 'merge', 'cadence/v1.1.0-rc.2');
  return dir;
}

/** A user-global config layer holding `cfg`; returns its path. */
function globalLayer(cfg) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-lc-global-')), 'global.json');
  writeFileSync(file, JSON.stringify(cfg));
  return file;
}

/**
 * Run a land-cleanup subcommand against a fixture; optional stdin string and an
 * optional user-global layer (default: none, so the dev's real one is never read).
 */
function seam(args, stdin = '', globalFile = NO_GLOBAL) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: globalFile };
  try {
    return JSON.parse(execFileSync('node', [SEAM, ...args],
      { encoding: 'utf8', env, input: stdin }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

// --- cleanup ----------------------------------------------------------------

test('cleanup on a repo with the branch merged into base: reap true, return to base', () => {
  const dir = gitFixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
  assert.equal(r.reap, true);
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2');
  assert.equal(r.base, 'main');
});

test('cleanup --merged true forced but branch not in merged list (deleted at merge): reap false, branch null', () => {
  // The GitHub auto_close path: gh pr merge --delete-branch removes the branch,
  // so `git branch --merged` no longer lists it and the reap target resolves
  // null, yet the seam forces --merged true. Reap must not fire on a null branch.
  const dir = fixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.reap, false);
  assert.equal(r.branch, null);
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
});

test('cleanup --merged false: cleanup but reap false (never reap an unmerged branch)', () => {
  const dir = fixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'false']);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.reap, false);
});

test('cleanup with git.on_land_cleanup=false: skip, all flags false', () => {
  const dir = fixture({ base_branch: 'main', on_land_cleanup: false });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.action, 'skip');
  assert.equal(r.returnToBase, false);
  assert.equal(r.reap, false);
});

// --- gate -------------------------------------------------------------------

test('gate with a blocker on stdin + git.auto_close=true: halt', () => {
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}');
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
  assert.equal(r.findings.length, 1);
});

test('gate with only a medium finding: proceed', () => {
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"severity":"medium"}]}');
  assert.equal(r.action, 'proceed');
});

test('gate with git.auto_close=false + a blocker: proceed (chain not running)', () => {
  const dir = fixture({ auto_close: false });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}');
  assert.equal(r.action, 'proceed');
});

test('gate: auto_close ONLY in the global layer (repo omits) -> halt', () => {
  // The safety property, pinned in the direction that a repo-layer-only read
  // breaks. skills/cad-land/SKILL.md:24 reads the MERGED auto_close and skips
  // the publish ask under it, so on this input the prose has already entered the
  // unattended chain with no human watching - and this halt is the only
  // consequence left (references/triage-gate.md, the git.auto_close carve-out).
  // Reading the repo layer here (0b1c322, reverted) answered `proceed` on
  // exactly this input while the ask stayed skipped, and on the GitLab arm -
  // where no publish seam gates the chain - the blocker merged.
  const dir = fixture({ on_land_cleanup: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}',
    globalLayer({ git: { auto_close: true } }));
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
});

test('gate: the repo layer wins the merge over a global auto_close:false -> halt', () => {
  // The other direction, so the arm above pins the merged VALUE rather than
  // merely the presence of a global key: repo `true` beats global `false`, which
  // is ordinary repo-wins precedence and not a layer narrowing.
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}',
    globalLayer({ git: { auto_close: false } }));
  assert.equal(r.action, 'halt');
});

test('gate: global auto_close:true beaten by repo false -> proceed (repo wins)', () => {
  // The merge is what this gate reads, so a repo layer that turns the chain OFF
  // wins over a global layer that turns it on - and with no chain running the
  // triage ask is live, so the blocker is the user's call rather than a halt.
  const dir = fixture({ auto_close: false });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}',
    globalLayer({ git: { auto_close: true } }));
  assert.equal(r.action, 'proceed');
});

// --- gate: the four states the seam used to collapse to [] -------------------

// Each entry is [name, stdin]. `undefined` stdin means the process is handed
// closed stdin rather than an empty string, so the read itself can fail.
const UNREADABLE_INPUTS = [
  ['stdin-empty', ''],
  ['malformed-json', '{"findings":[{"severity":"blocker"}'],
  ['not-a-findings-payload', '{"ok":false,"reason":"dispatch-failed"}'],
];

for (const [name, stdin] of UNREADABLE_INPUTS) {
  test(`gate under auto_close: ${name} halts with a reason naming it, never "no surviving finding"`, () => {
    const dir = fixture({ auto_close: true });
    const r = seam(['gate', '--dir', dir], stdin);
    assert.equal(r.ok, true, 'the advisory envelope is preserved - ok:true with one action');
    assert.equal(r.action, 'halt');
    assert.deepEqual(r.findings, []);
    assert.ok(r.reason.includes(name), `reason must name the failure: ${r.reason}`);
  });

  test(`gate with auto_close absent: ${name} still proceeds (no unattended chain)`, () => {
    const dir = fixture({ on_land_cleanup: true });
    const r = seam(['gate', '--dir', dir], stdin);
    assert.equal(r.ok, true);
    assert.equal(r.action, 'proceed');
  });
}

test('gate under auto_close: an EXPLICIT {"findings":[]} is the one spelling that proceeds', () => {
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[]}');
  assert.equal(r.action, 'proceed');
  assert.match(r.reason, /no surviving blocker\/high finding/);
});

test('gate: a bare JSON array on stdin still reads as the findings list', () => {
  const dir = fixture({ auto_close: true });
  assert.equal(seam(['gate', '--dir', dir], '[]').action, 'proceed');
  assert.equal(seam(['gate', '--dir', dir], '[{"severity":"blocker"}]').action, 'halt');
});

test('gate: no stdin piped at all halts under auto_close, whatever the platform calls it', () => {
  // `input` is not passed, and stdin is 'ignore' - the child gets /dev/null on
  // Linux, so the read succeeds and yields "", the stdin-empty arm. The name
  // differs by platform; what must hold on every one of them is that the gate
  // does NOT claim there were no surviving findings.
  const dir = fixture({ auto_close: true });
  let out;
  try {
    out = execFileSync('node', [SEAM, 'gate', '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) { out = e.stdout; }
  const r = JSON.parse(out);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
  assert.ok(/stdin-empty|stdin-unreadable/.test(r.reason), r.reason);
});

test('gate: a genuinely unreadable stdin is the fourth halting state, named', () => {
  // A directory handed in as fd 0: the open succeeds, the read throws EISDIR.
  // This is the one arm `input: ''` and `stdio: 'ignore'` cannot reach - both
  // of those read successfully and land on stdin-empty - so without it the
  // catch that mints `stdin-unreadable` has no seam-level test at all.
  const dir = fixture({ auto_close: true });
  const fd = openSync(tmpdir(), 'r');
  let out;
  try {
    out = execFileSync('node', [SEAM, 'gate', '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
      stdio: [fd, 'pipe', 'ignore'],
    });
  } catch (e) { out = e.stdout; } finally { closeSync(fd); }
  const r = JSON.parse(out);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
  assert.ok(r.reason.includes('stdin-unreadable'), r.reason);
  assert.deepEqual(r.findings, []);
});

// --- the config warnings both subcommands carry -----------------------------

/** A user-global layer holding raw TEXT, so a truncated body can be written
 *  verbatim and the merge reports the parse failure. */
function globalText(text) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-lc-torn-')), 'g.json');
  writeFileSync(file, text);
  return file;
}

test('warnings[] rides BOTH land-cleanup envelopes, empty and torn', () => {
  // Pins the emission itself: stripping `, warnings })` off either emit fails
  // here. The gate arm is the sharper one - a torn layer reads auto_close as
  // absent, which is `false`, which is the arm that does NOT halt on a surviving
  // blocker, so the caller has to be able to tell "no chain is running" from
  // "the file that says so did not parse".
  const dir = fixture({ base_branch: 'main', auto_close: true });
  const cleanCleanup = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.deepEqual(cleanCleanup.warnings, [], 'present as an empty array, not omitted');
  const cleanGate = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}');
  assert.deepEqual(cleanGate.warnings, []);

  const torn = globalText('{"git":{"auto_close":true}');
  const tornCleanup = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true'], '', torn);
  assert.equal(tornCleanup.ok, true, 'advisory seam: a torn layer never blocks the advice');
  assert.match(tornCleanup.warnings[0], /failed to parse/);
  const tornGate = seam(['gate', '--dir', dir], '{"findings":[{"severity":"blocker"}]}', torn);
  assert.equal(tornGate.ok, true);
  assert.match(tornGate.warnings[0], /failed to parse/);
});

test('unknown subcommand: usage, ok false', () => {
  const r = seam(['frobnicate']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});
