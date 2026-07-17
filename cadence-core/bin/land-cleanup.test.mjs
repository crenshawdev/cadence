// Zero-dep tests for land-cleanup.mjs (the close-decision seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Fixture style mirrors
// git-branch.test.mjs: a temp .planning dir with config/PROJECT/ROADMAP, driven
// through the seam with explicit --merged/--branch so no live git repo is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

/** Run a land-cleanup subcommand against a fixture; optional stdin string. */
function seam(args, stdin = '') {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  try {
    return JSON.parse(execFileSync('node', [SEAM, ...args],
      { encoding: 'utf8', env, input: stdin }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

// --- cleanup ----------------------------------------------------------------

test('cleanup --merged true on a default config: reap true, return to base', () => {
  const dir = fixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
  assert.equal(r.reap, true);
  assert.equal(r.base, 'main');
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

test('unknown subcommand: usage, ok false', () => {
  const r = seam(['frobnicate']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});
