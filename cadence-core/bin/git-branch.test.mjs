// Zero-dep tests for git-branch.mjs (the branch-decision seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Fixture style mirrors
// git-guard.test.mjs: a temp .planning dir with config/PROJECT/ROADMAP, driven
// through the seam with an explicit --branch so no live git repo is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'git-branch.mjs');
// Hermetic global config (never read the dev's real ~/.claude one).
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-gb-')), 'no-global.json');

/** A .planning fixture with the given git config block. */
function fixture(gitConfig) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-gb-repo-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git: gitConfig }));
  writeFileSync(join(dir, '.planning', 'PROJECT.md'),
    '## Requirements\n### Active\n\n`v1.1.0-rc.2` - the round\n\n### Out of Scope\n');
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), '# Roadmap: Cadence v1.1.0-rc.2\n');
  return dir;
}

/** Run `git-branch.mjs decide` against a fixture with an explicit branch. */
function decide(dir, branch) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  try {
    return JSON.parse(execFileSync('node',
      [SEAM, 'decide', '--dir', dir, '--branch', branch], { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('milestone + auto on a protected base: create the named integration branch', () => {
  const r = decide(fixture({ integration_branch: 'milestone', auto_branch: 'auto' }), 'main');
  assert.equal(r.ok, true);
  assert.equal(r.action, 'create');
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2');
  assert.equal(r.mode, 'milestone');
  assert.equal(r.currentBranch, 'main');
});

test('milestone + ask on a protected base: ask, naming the integration branch', () => {
  const r = decide(fixture({ integration_branch: 'milestone', auto_branch: 'ask' }), 'main');
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2');
});

test('milestone + off on a protected base: stay', () => {
  const r = decide(fixture({ integration_branch: 'milestone', auto_branch: 'off' }), 'main');
  assert.equal(r.action, 'stay');
});

test('milestone already on a work branch: stay (lazy, once per cycle)', () => {
  const r = decide(fixture({ integration_branch: 'milestone', auto_branch: 'auto' }), 'feat/thing');
  assert.equal(r.action, 'stay');
  assert.equal(r.currentBranch, 'feat/thing');
});

test('trunk on a protected base: stay, no integration branch (branch null)', () => {
  const r = decide(fixture({ integration_branch: 'trunk' }), 'main');
  assert.equal(r.action, 'stay');
  assert.equal(r.branch, null);
});

test('defaults (no git block set): milestone + ask on a protected base -> ask', () => {
  const r = decide(fixture({}), 'main');
  assert.equal(r.mode, 'milestone');
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2');
});
