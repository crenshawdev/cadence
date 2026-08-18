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

/** Plant a .planning fixture at `dir`, whatever built the directory. */
function plant(dir, gitConfig, version) {
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git: gitConfig }));
  writeFileSync(join(dir, '.planning', 'PROJECT.md'),
    `## Requirements\n### Active\n\n\`${version}\` - the round\n\n### Out of Scope\n`);
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), `# Roadmap: Cadence ${version}\n`);
  return dir;
}

/** A .planning fixture with the given git config block. */
function fixture(gitConfig, version = 'v1.1.0-rc.2') {
  return plant(mkdtempSync(join(tmpdir(), 'cad-gb-repo-')), gitConfig, version);
}

/**
 * The same fixture, made a REAL git repo carrying `tags`. The published-version
 * guard reads `git tag --list`, so this one clause cannot be proved on the
 * live-git-free fixtures above. Identity and signing are forced off in the env
 * so the empty commit works on any machine, including one with commit.gpgsign
 * set globally.
 */
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'cad', GIT_AUTHOR_EMAIL: 'cad@example.invalid',
  GIT_COMMITTER_NAME: 'cad', GIT_COMMITTER_EMAIL: 'cad@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function taggedFixture(gitConfig, version, tags) {
  const dir = fixture(gitConfig, version);
  const env = GIT_ENV;
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore', env });
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  for (const t of tags) git('tag', t);
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

test('a STRING protected_branches is honored here too, not dropped (#38, COR-01)', () => {
  // This seam's own per-consumer proof of the shared coercion
  // (lib/protected-branches.mjs). Before it, a lone string fell to
  // ['main','master'] HERE while git-guard already honored it: "release" read
  // as an ordinary work branch, so the seam advised `stay` on the very branch
  // the user had protected, and the default list protected `main` nobody named.
  const cfg = { integration_branch: 'milestone', auto_branch: 'ask', protected_branches: 'release' };
  const onProtected = decide(fixture(cfg), 'release');
  assert.equal(onProtected.action, 'ask');
  assert.equal(onProtected.branch, 'cadence/v1.1.0-rc.2');
  // and the swapped-in default is gone: main is now an ordinary branch.
  assert.equal(decide(fixture(cfg), 'main').action, 'stay');
});

test('published: a milestone the repo has ALREADY TAGGED asks, naming both numbers (AC8)', () => {
  // The #87 collision at the seam: `### Active` still names v0.1.0 while the
  // repo carries v0.1.0 and v0.2.0, so `create cadence/v0.1.0` would name a
  // branch after a shipped release. The tag list is what answers - no manifest.
  const dir = taggedFixture({ integration_branch: 'milestone', auto_branch: 'auto' },
    'v0.1.0', ['v0.1.0', 'v0.2.0']);
  const r = decide(dir, 'main');
  assert.equal(r.ok, true);
  assert.equal(r.action, 'ask');
  assert.equal(r.branch, null);
  // Both numbers are the milestone version and the TAG SPELLING that carries
  // it, which under membership is the tag it collided with. v0.2.0 is merely
  // the highest tag in the repo, has nothing to do with this refusal, and
  // naming it was the sort-order guard talking about the wrong release.
  assert.match(r.reason, /0\.1\.0/);
  assert.match(r.reason, /v0\.1\.0/, 'the tag spelling, so the user can go look at it');
  assert.doesNotMatch(r.reason, /0\.2\.0/, 'not the highest tag: it did not cause this');
});

test('published: an untagged maintenance milestone below a higher tag still creates (AC8)', () => {
  // The live-git half of the sort-order defect: v1.9.1 is published nowhere,
  // and the repo's newest tag is v2.0.0. Sorting refused it as "already
  // published"; membership creates it.
  const dir = taggedFixture({ integration_branch: 'milestone', auto_branch: 'auto' },
    'v1.9.1', ['v1.9.0', 'v2.0.0']);
  const r = decide(dir, 'main');
  assert.equal(r.ok, true);
  assert.equal(r.action, 'create');
  assert.equal(r.branch, 'cadence/v1.9.1');
});

test('published: a milestone above every tag still creates - the guard refuses no new cycle', () => {
  const dir = taggedFixture({ integration_branch: 'milestone', auto_branch: 'auto' },
    'v0.3.0', ['v0.1.0', 'v0.2.0']);
  const r = decide(dir, 'main');
  assert.equal(r.action, 'create');
  assert.equal(r.branch, 'cadence/v0.3.0');
});

test('published: a non-semver tag is skipped, not guessed at', () => {
  // `nightly` parses as no version, so it can carry no milestone: membership is
  // what counts, and an out-of-grammar tag matches nothing rather than being
  // ranked or guessed at.
  const dir = taggedFixture({ integration_branch: 'milestone', auto_branch: 'auto' },
    'v0.2.0', ['nightly', '2024-06-release', 'v0.2.0']);
  assert.equal(decide(dir, 'main').action, 'ask');
  const clean = taggedFixture({ integration_branch: 'milestone', auto_branch: 'auto' },
    'v0.2.0', ['nightly', '2024-06-release']);
  assert.equal(decide(clean, 'main').action, 'create', 'no tag carries it: nothing to refuse');
});

// --- TAG-01: the tags have to belong to THIS project ------------------------
//
// WATCHED FAILING AT 487e150, the branch tip before this fix - the audit-side
// half of the same bound carries the full watch recipe in
// planning.test.mjs's `version_drift` block.

test('published: an enclosing repository\'s tags are not this project\'s (TAG-01)', () => {
  // `git -C` discovers the repository UPWARD, so a project that is not itself a
  // repository read the tag list of whatever repository happened to CONTAIN it
  // - a checkout under an umbrella repo, a vendored copy, a monorepo sibling -
  // and was refused an integration branch over a version it never published.
  // The umbrella's v0.1.0 says nothing about the project below it.
  const umbrella = mkdtempSync(join(tmpdir(), 'cad-gb-umbrella-'));
  const git = (...args) => execFileSync('git', ['-C', umbrella, ...args],
    { stdio: 'ignore', env: GIT_ENV });
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  git('tag', 'v0.1.0');

  const sub = plant(join(umbrella, 'project'),
    { integration_branch: 'milestone', auto_branch: 'auto' }, 'v0.1.0');
  const r = decide(sub, 'main');
  assert.equal(r.ok, true);
  assert.equal(r.action, 'create', 'the umbrella published v0.1.0; this project published nothing');
  assert.equal(r.branch, 'cadence/v0.1.0');
});

// --- the read-only tags arm (REL-01) ----------------------------------------
//
// `workflows/milestone.md` step 2 asks "has this project ever tagged" to tell a
// release close from a non-release one, and it used to ask it with a bare `git
// tag`, which discovers the repository UPWARD. This arm is that question
// bounded to the project the caller names, which is why the same TAG-01 shape
// the `decide` test above builds is what proves it.

/** Run `git-branch.mjs tags` against a directory. */
function tags(dir) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  return JSON.parse(execFileSync('node', [SEAM, 'tags', '--dir', dir],
    { encoding: 'utf8', env }));
}

test('tags: the repository at --dir answers with its own tag list', () => {
  const dir = taggedFixture({}, 'v9.9.0', ['v9.9.0']);
  const r = tags(dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.tags, ['v9.9.0']);
});

test('tags: a non-repository project inside a tagged repository has published nothing (TAG-01)', () => {
  // The defect this arm exists to stop carrying into the release-mode
  // decision: `sub/` is not a repository, so a bare probe there reads the
  // umbrella's v9.9.0 and the close reads as a RELEASE close for a project
  // that has never published anything.
  const umbrella = taggedFixture({}, 'v9.9.0', ['v9.9.0']);
  const sub = plant(join(umbrella, 'project'), {}, 'v9.9.0');
  const r = tags(sub);
  assert.equal(r.ok, true, 'a non-repository is an answer, never a failure');
  assert.deepEqual(r.tags, [], "the umbrella's release is not this project's");
});

test('tags: a directory that is no repository at all reads as no tags, not an error', () => {
  const r = tags(mkdtempSync(join(tmpdir(), 'cad-gb-bare-')));
  assert.equal(r.ok, true);
  assert.deepEqual(r.tags, []);
});

test('an unknown subcommand names BOTH arms, so the new one is reachable from the usage line', () => {
  // `ok:false` mirrors into exit 1 (lib/seam-io.mjs), so the usage line comes
  // back on the thrown error's stdout exactly as `decide` above reads it.
  let out;
  try { out = execFileSync('node', [SEAM, 'nope'], { encoding: 'utf8' }); }
  catch (e) { out = e.stdout; }
  const r = JSON.parse(out);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
  assert.match(r.detail, /decide/);
  assert.match(r.detail, /tags/);
});

test('warnings[] rides the envelope, and a torn layer puts the parse failure on it', () => {
  // Pins the EMISSION, not just the binding: every value this seam decides with
  // - mode, auto_branch, protected_branches - comes off that one merge, so a
  // torn layer means the advice was computed from DEFAULTS. Stripping
  // `, warnings })` off the emit fails here and nowhere else.
  const clean = decide(fixture({ integration_branch: 'milestone', auto_branch: 'auto' }), 'main');
  assert.deepEqual(clean.warnings, [], 'present as an empty array, not omitted');

  const dir = fixture({ integration_branch: 'milestone', auto_branch: 'auto' });
  const torn = join(mkdtempSync(join(tmpdir(), 'cad-gb-torn-')), 'g.json');
  writeFileSync(torn, '{"git":{"auto_branch":"off"');
  const r = JSON.parse(execFileSync('node', [SEAM, 'decide', '--dir', dir, '--branch', 'main'],
    { encoding: 'utf8', env: { ...process.env, CADENCE_GLOBAL_CONFIG: torn } }));
  assert.equal(r.ok, true, 'advisory seam: a torn layer never blocks the advice');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /failed to parse/);
});
