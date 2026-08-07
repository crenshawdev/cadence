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
  assert.equal(r.branch, NAME); // what worktree branches merge back into
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
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2'); // what worktree branches merge back into
});

test('decideBranch is total: an unknown mode or auto_branch stays put, never throws', () => {
  assert.equal(decideBranch({ mode: 'weird', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME }).action, 'stay');
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'weird', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: NAME }).action, 'stay');
});

test('milestone + protected + null name: auto/ask downgrade to a naming-problem ask, never create an unnamed branch', () => {
  // auto with no derivable version must NOT return {create, null} (rail-1 would
  // run `git checkout -b <null>`); it downgrades to a naming-problem ask.
  const auto = decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: null });
  assert.equal(auto.action, 'ask');
  assert.equal(auto.branch, null);
  assert.match(auto.reason, /naming-problem/);
  // ask + null name behaves the same.
  const ask = decideBranch({ mode: 'milestone', autoBranch: 'ask', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: null });
  assert.equal(ask.action, 'ask');
  assert.equal(ask.branch, null);
  assert.match(ask.reason, /naming-problem/);
  // off + null name still just stays put.
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'off', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: null }).action, 'stay');
});

// --- decideBranch: the published-version guard (QW-04) ----------------------
// A version the repo has ALREADY TAGGED must not be offered as a new integration
// branch. `publishedVersion` arrives as an ARGUMENT - the seam reads the tags -
// so every row below runs with no live git.

/** milestone + protected, with a published version in hand. */
const withPublished = (autoBranch, integrationName, publishedVersion) => decideBranch({
  mode: 'milestone', autoBranch, currentBranch: 'main',
  protectedBranches: PROTECTED, integrationName, publishedVersion,
});

test('published: a milestone EQUAL to a published tag asks, naming both numbers, with branch null', () => {
  // The v2.4.0 collision (#87): the section still reads as open, the tag exists.
  for (const arm of ['auto', 'ask']) {
    const r = withPublished(arm, 'cadence/v2.4.0', 'v2.4.0');
    assert.equal(r.action, 'ask', arm);
    assert.equal(r.branch, null, `${arm}: never offer the branch name it just refused`);
    assert.match(r.reason, /already-published/);
    assert.match(r.reason, /2\.4\.0/);
  }
});

test('published: a milestone BELOW a published tag asks too, naming both numbers', () => {
  const r = withPublished('auto', 'cadence/v2.3.0', 'v2.4.0');
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, null);
  assert.match(r.reason, /2\.3\.0/);
  assert.match(r.reason, /2\.4\.0/);
});

test('published: a milestone ABOVE everything published is untouched - the ordinary new cycle', () => {
  // The arm that must NOT escalate: refusing here would refuse every legitimate
  // cycle. This is the live-repo shape (Active v2.5.0, newest tag v2.4.0).
  const auto = withPublished('auto', 'cadence/v2.5.0', 'v2.4.0');
  assert.equal(auto.action, 'create');
  assert.equal(auto.branch, 'cadence/v2.5.0');
  const ask = withPublished('ask', 'cadence/v2.5.0', 'v2.4.0');
  assert.equal(ask.action, 'ask');
  assert.equal(ask.branch, 'cadence/v2.5.0', 'the ordinary ask still names the branch');
  assert.doesNotMatch(ask.reason, /already-published/);
});

test('published: a prerelease of the published version sorts BELOW it and asks', () => {
  // v2.4.0-rc.1 < v2.4.0 by semver §11, so it is not a next milestone either.
  const r = withPublished('auto', 'cadence/v2.4.0-rc.1', 'v2.4.0');
  assert.equal(r.action, 'ask');
  assert.match(r.reason, /already-published/);
  // ...and the release above a published prerelease is a legitimate next step.
  assert.equal(withPublished('auto', 'cadence/v2.4.0', 'v2.4.0-rc.1').action, 'create');
});

test('published: absent or unparseable comparands leave every arm exactly as it was', () => {
  // "I cannot tell" is never an escalation: an unprovable comparison must not
  // refuse a cycle. Absent (no tags), null, empty, and out-of-grammar on either
  // side all fall through to the ordinary arms.
  const equalName = 'cadence/v2.4.0';
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: equalName }).action, 'create', 'argument absent');
  assert.equal(withPublished('auto', equalName, null).action, 'create', 'null');
  assert.equal(withPublished('auto', equalName, '').action, 'create', 'empty string');
  assert.equal(withPublished('auto', equalName, 'nightly').action, 'create', 'unparseable published');
  assert.equal(withPublished('auto', 'cadence/2.4', 'v2.4.0').action, 'create', 'unparseable milestone');
});

test('published: off and trunk are untouched by the guard, even on a collision', () => {
  assert.equal(withPublished('off', 'cadence/v2.4.0', 'v2.4.0').action, 'stay');
  assert.equal(decideBranch({ mode: 'trunk', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: 'cadence/v2.4.0', publishedVersion: 'v2.4.0' }).action,
  'stay');
  // Off the protected base the guard never runs either: creation already happened.
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'cadence/v2.4.0',
    protectedBranches: PROTECTED, integrationName: 'cadence/v2.4.0', publishedVersion: 'v2.4.0' }).action,
  'stay');
});

test('published: the naming-problem ask still wins over the published guard', () => {
  // A null name has no version to compare, and its own diagnostic is the useful
  // one - it must not be replaced by a published-version reason.
  const r = withPublished('auto', null, 'v2.4.0');
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, null);
  assert.match(r.reason, /naming-problem/);
});
