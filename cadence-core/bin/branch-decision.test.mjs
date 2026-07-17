// Zero-dep tests for lib/branch-decision.mjs (the pure two-tier branch core).
// Run: node --test 'cadence-core/bin/*.test.mjs'. Only node: builtins, and the
// functions are pure, so this needs no subprocess or live git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrationBranchName, decideBranch } from './lib/branch-decision.mjs';

// --- integrationBranchName --------------------------------------------------

test('name: derives cadence/<version> from the PROJECT.md ### Active section', () => {
  const project = [
    '## Requirements',
    '### Active',
    '',
    '`v1.1.0-rc.2` - the "git model + release lifecycle" round:',
    '- [ ] something',
    '',
    '### Out of Scope',
    '- `v9.9.9` must NOT be picked up (it is past the Active body)',
  ].join('\n');
  assert.equal(integrationBranchName(project, ''), 'cadence/v1.1.0-rc.2');
});

test('name: falls back to the ROADMAP title when Active names no version', () => {
  const project = '### Active\n\nno version here, just prose\n\n### Next\n';
  const roadmap = '# Roadmap: Cadence v2.0.0-beta.1\n\nbody\n';
  assert.equal(integrationBranchName(project, roadmap), 'cadence/v2.0.0-beta.1');
});

test('name: null when neither prose surface carries a version (never invent one)', () => {
  assert.equal(integrationBranchName('### Active\n\nnothing\n', '# Roadmap\n'), null);
  assert.equal(integrationBranchName('', ''), null);
});

test('name: a plain semver without a prerelease suffix still parses', () => {
  assert.equal(integrationBranchName('### Active\n\nshipping `v1.2.0` now\n', ''), 'cadence/v1.2.0');
});

// --- decideBranch -----------------------------------------------------------

const PROTECTED = ['main', 'master'];
const NAME = 'cadence/v1.1.0-rc.2';

test('trunk mode: always stay, no integration branch, branch null', () => {
  const r = decideBranch({ mode: 'trunk', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME });
  assert.equal(r.action, 'stay');
  assert.equal(r.branch, null);
  assert.match(r.reason, /on_protected/);
});

test('milestone + protected + auto: create and switch to the integration branch', () => {
  const r = decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME });
  assert.equal(r.action, 'create');
  assert.equal(r.branch, NAME); // the worktree fork point (D-06)
});

test('milestone + protected + off: stay on the base', () => {
  const r = decideBranch({ mode: 'milestone', autoBranch: 'off', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME });
  assert.equal(r.action, 'stay');
});

test('milestone + protected + ask: prompt once, naming the integration branch', () => {
  const r = decideBranch({ mode: 'milestone', autoBranch: 'ask', currentBranch: 'master',
    protectedBranches: PROTECTED, integrationName: NAME });
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, NAME);
});

test('milestone + already off the base: stay (lazy, once per cycle)', () => {
  const r = decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'cadence/v1.1.0-rc.2',
    protectedBranches: PROTECTED, integrationName: NAME });
  assert.equal(r.action, 'stay');
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2'); // the current tip is the fork point
});

test('decideBranch is total: an unknown mode or auto_branch stays put, never throws', () => {
  assert.equal(decideBranch({ mode: 'weird', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME }).action, 'stay');
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'weird', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME }).action, 'stay');
});
