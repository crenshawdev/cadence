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
// branch. `publishedVersions` arrives as an ARGUMENT - the whole tag list, read
// by the seam - so every row below runs with no live git.
//
// MEMBERSHIP, not sort order (QW-04 second pass, superseding D-23's scalar
// shape). The first form compared the milestone against the HIGHEST tag, which
// refuses every untagged maintenance milestone below a newer release -
// `v1.9.1` in a repo tagged `v1.9.0` and `v2.0.0` - with a reason asserting a
// publication that never happened. Membership answers the question actually
// asked: is THIS version already a tag?

/** milestone + protected, with the repo's tag list in hand. */
const withPublished = (autoBranch, integrationName, publishedVersions) => decideBranch({
  mode: 'milestone', autoBranch, currentBranch: 'main',
  protectedBranches: PROTECTED, integrationName, publishedVersions,
});

test('published: a milestone EQUAL to a published tag asks, naming both numbers, with branch null', () => {
  // The v2.4.0 collision (#87): the section still reads as open, the tag exists.
  for (const arm of ['auto', 'ask']) {
    const r = withPublished(arm, 'cadence/v2.4.0', ['v2.4.0']);
    assert.equal(r.action, 'ask', arm);
    assert.equal(r.branch, null, `${arm}: never offer the branch name it just refused`);
    assert.match(r.reason, /already-published/);
    assert.match(r.reason, /2\.4\.0/);
  }
});

test('published: an UNTAGGED maintenance milestone below a higher tag still creates', () => {
  // What sort order got wrong, and the reason this guard was rewritten:
  // v1.9.1 is a legitimate patch on the 1.9 line, published nowhere. Sorting it
  // against the highest tag (v2.0.0) refused it while claiming it "has already
  // published as a tag" - an assertion about a tag that does not exist.
  const r = withPublished('auto', 'cadence/v1.9.1', ['v1.9.0', 'v2.0.0']);
  assert.equal(r.action, 'create');
  assert.equal(r.branch, 'cadence/v1.9.1');
  assert.doesNotMatch(r.reason, /already-published/);
  // The neighbours on both sides of it ARE tagged, and both still refuse, so
  // this is membership working rather than the guard having gone quiet.
  assert.equal(withPublished('auto', 'cadence/v1.9.0', ['v1.9.0', 'v2.0.0']).action, 'ask');
  assert.equal(withPublished('auto', 'cadence/v2.0.0', ['v1.9.0', 'v2.0.0']).action, 'ask');
});

test('published: a milestone ABOVE everything published is untouched - the ordinary new cycle', () => {
  // The arm that must NOT escalate: refusing here would refuse every legitimate
  // cycle. This is the live-repo shape (Active v2.5.0, newest tag v2.4.0).
  const auto = withPublished('auto', 'cadence/v2.5.0', ['v2.4.0']);
  assert.equal(auto.action, 'create');
  assert.equal(auto.branch, 'cadence/v2.5.0');
  const ask = withPublished('ask', 'cadence/v2.5.0', ['v2.4.0']);
  assert.equal(ask.action, 'ask');
  assert.equal(ask.branch, 'cadence/v2.5.0', 'the ordinary ask still names the branch');
  assert.doesNotMatch(ask.reason, /already-published/);
});

test('published: a prerelease is refused only when the prerelease ITSELF is tagged', () => {
  // Sort order refused v2.4.0-rc.1 in a repo tagged v2.4.0 (rc.1 < 2.4.0 by
  // semver §11), which is backwards: an rc for a release that already shipped is
  // odd, but nothing published it, and the guard's job is publication.
  const untagged = withPublished('auto', 'cadence/v2.4.0-rc.1', ['v2.4.0']);
  assert.equal(untagged.action, 'create');
  assert.equal(untagged.branch, 'cadence/v2.4.0-rc.1');
  // Tagged, so refused - and the tag that carries it is the one named, not the
  // highest one in the list.
  const tagged = withPublished('auto', 'cadence/v2.4.0-rc.1', ['v2.4.0-rc.1', 'v2.4.0']);
  assert.equal(tagged.action, 'ask');
  assert.match(tagged.reason, /already-published/);
  assert.match(tagged.reason, /v2\.4\.0-rc\.1/);
  // The release above a published prerelease is a legitimate next step. It held
  // under sort order because 2.4.0 > 2.4.0-rc.1; it holds now for a better
  // reason - no tag in the list carries 2.4.0 at all.
  assert.equal(withPublished('auto', 'cadence/v2.4.0', ['v2.4.0-rc.1']).action, 'create');
});

test('published: absent or unparseable comparands leave every arm exactly as it was', () => {
  // "I cannot tell" is never an escalation: an unprovable comparison must not
  // refuse a cycle. Absent (no tags), null, empty, and out-of-grammar on either
  // side all fall through to the ordinary arms.
  const equalName = 'cadence/v2.4.0';
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: equalName }).action, 'create', 'argument absent');
  assert.equal(withPublished('auto', equalName, null).action, 'create', 'null');
  assert.equal(withPublished('auto', equalName, []).action, 'create', 'no tags at all');
  assert.equal(withPublished('auto', equalName, ['']).action, 'create', 'empty tag');
  assert.equal(withPublished('auto', equalName, ['nightly', '2024-06-release']).action,
    'create', 'unparseable tags match nothing');
  assert.equal(withPublished('auto', 'cadence/2.4', ['v2.4.0']).action, 'create', 'unparseable milestone');
  // A tag list holding non-strings is data this seam did not write; it must skip
  // them rather than throw, and still see the real tag beside them.
  assert.equal(withPublished('auto', equalName, [null, 42, {}, 'v2.4.0']).action, 'ask', 'skips, not throws');
});

test('published: a SCALAR tag spelling is read as a one-tag list, never as "no comparand"', () => {
  // The one shape that must not fail open. `publishedVersions` replaced a scalar
  // `publishedVersion` argument, so a caller left on the old shape would hand a
  // string here - and treating it as "not a list, therefore nothing published"
  // would disarm the guard silently, which is worse than the sort-order bug it
  // replaced. It is read as the single tag it is, under the same membership rule.
  assert.equal(withPublished('auto', 'cadence/v2.4.0', 'v2.4.0').action, 'ask');
  assert.equal(withPublished('auto', 'cadence/v2.3.0', 'v2.4.0').action, 'create',
    'and still membership, not the old sort order');
});

test('published: off and trunk are untouched by the guard, even on a collision', () => {
  assert.equal(withPublished('off', 'cadence/v2.4.0', ['v2.4.0']).action, 'stay');
  assert.equal(decideBranch({ mode: 'trunk', autoBranch: 'auto', currentBranch: 'main',
    protectedBranches: PROTECTED, integrationName: 'cadence/v2.4.0', publishedVersions: ['v2.4.0'] }).action,
  'stay');
  // Off the protected base the guard never runs either: creation already happened.
  assert.equal(decideBranch({ mode: 'milestone', autoBranch: 'auto', currentBranch: 'cadence/v2.4.0',
    protectedBranches: PROTECTED, integrationName: 'cadence/v2.4.0', publishedVersions: ['v2.4.0'] }).action,
  'stay');
});

test('published: the naming-problem ask still wins over the published guard', () => {
  // A null name has no version to compare, and its own diagnostic is the useful
  // one - it must not be replaced by a published-version reason.
  const r = withPublished('auto', null, ['v2.4.0']);
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, null);
  assert.match(r.reason, /naming-problem/);
});
