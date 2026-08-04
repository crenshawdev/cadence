// Zero-dep tests for lib/publish-decision.mjs (the pure git-publish core).
// Run: node --test 'cadence-core/bin/*.test.mjs'. Only node: builtins, and the
// function is pure, so this needs no subprocess or live git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePublish, decideReap } from './lib/publish-decision.mjs';

// A well-formed publish call: auto_close on, a non-protected feature branch, a
// configured bare-name remote.
const OK = {
  autoClose: true,
  currentBranch: 'cadence/v1.1.0-rc.2',
  protectedBranches: ['main', 'master'],
  remote: 'origin',
  configuredRemotes: ['origin'],
};

// --- the publish path -------------------------------------------------------

test('publish: byte-exact argv with the branch only inside the one refspec token', () => {
  const d = decidePublish(OK);
  assert.equal(d.action, 'publish');
  assert.deepEqual(d.argv, [
    'push', '--set-upstream', '--', 'origin',
    'refs/heads/cadence/v1.1.0-rc.2:refs/heads/cadence/v1.1.0-rc.2',
  ]);
  assert.equal(d.branch, 'cadence/v1.1.0-rc.2');
  assert.equal(d.remote, 'origin');
  // The branch string appears in EXACTLY one argv token, and that token is the
  // refspec - never as a bare positional the way a `git push origin <branch>`
  // would place it.
  const carrying = d.argv.filter((a) => a.includes('cadence/v1.1.0-rc.2'));
  assert.equal(carrying.length, 1);
  assert.match(carrying[0], /^refs\/heads\//);
});

test('publish: a valid non-origin remote that IS configured publishes to it', () => {
  const d = decidePublish({ ...OK, remote: 'upstream', configuredRemotes: ['origin', 'upstream'] });
  assert.equal(d.action, 'publish');
  assert.equal(d.remote, 'upstream');
  assert.deepEqual(d.argv, [
    'push', '--set-upstream', '--', 'upstream',
    'refs/heads/cadence/v1.1.0-rc.2:refs/heads/cadence/v1.1.0-rc.2',
  ]);
});

// --- refuse gates, first-failing-wins ---------------------------------------

test('refuse: auto_close off wins even when everything else is valid', () => {
  const d = decidePublish({ ...OK, autoClose: false });
  assert.equal(d.action, 'refuse');
  assert.equal(d.reason, 'auto-close-off');
  assert.deepEqual(d.argv, []);
});

test('refuse: auto_close undefined -> auto-close-off (only literal true publishes)', () => {
  const d = decidePublish({ ...OK, autoClose: undefined });
  assert.equal(d.reason, 'auto-close-off');
});

test('refuse: no branch / detached HEAD -> no-branch', () => {
  assert.equal(decidePublish({ ...OK, currentBranch: '' }).reason, 'no-branch');
  assert.equal(decidePublish({ ...OK, currentBranch: 'HEAD' }).reason, 'no-branch');
});

test('refuse: a leading-dash branch -rf -> bad-branch (never read as an option)', () => {
  const d = decidePublish({ ...OK, currentBranch: '-rf' });
  assert.equal(d.reason, 'bad-branch');
  assert.deepEqual(d.argv, []);
});

test('refuse: a colon/metachar branch -> bad-branch (never a src:dst refspec)', () => {
  assert.equal(decidePublish({ ...OK, currentBranch: 'a:main' }).reason, 'bad-branch');
  assert.equal(decidePublish({ ...OK, currentBranch: 'a b' }).reason, 'bad-branch');
  assert.equal(decidePublish({ ...OK, currentBranch: 'a;rm' }).reason, 'bad-branch');
});

test('refuse: a protected branch -> protected-branch', () => {
  const d = decidePublish({ ...OK, currentBranch: 'main' });
  assert.equal(d.reason, 'protected-branch');
});

test('refuse: a path/URL remote -> bad-remote', () => {
  assert.equal(decidePublish({ ...OK, remote: '/tmp/e' }).reason, 'bad-remote');
  assert.equal(decidePublish({ ...OK, remote: 'git@h:x' }).reason, 'bad-remote');
  assert.equal(decidePublish({ ...OK, remote: '../evil' }).reason, 'bad-remote');
});

// Regression (risk_surface finding): a dash-prefixed remote that IS configured
// must still refuse at gate 5 (bad-remote), so a name like '--mirror' or '-o' can
// never reach the built argv where git would parse it as an option. Locks in the
// REMOTE_NAME leading-alphanumeric anchor.
test('refuse: a dash-prefixed remote never reaches the argv (bad-remote), even if configured', () => {
  assert.equal(
    decidePublish({ ...OK, remote: '--mirror', configuredRemotes: ['--mirror'] }).reason,
    'bad-remote',
  );
  assert.equal(
    decidePublish({ ...OK, remote: '-o', configuredRemotes: ['-o'] }).reason,
    'bad-remote',
  );
  assert.deepEqual(
    decidePublish({ ...OK, remote: '--force', configuredRemotes: ['--force'] }).argv,
    [],
  );
});

test('refuse: a remote not in configuredRemotes -> remote-not-configured', () => {
  const d = decidePublish({ ...OK, remote: 'origin', configuredRemotes: ['upstream'] });
  assert.equal(d.reason, 'remote-not-configured');
});

// Gate order: bad-remote (5) beats remote-not-configured (6).
test('refuse: gate order - bad-remote is reached before remote-not-configured', () => {
  const d = decidePublish({ ...OK, remote: '/tmp/e', configuredRemotes: [] });
  assert.equal(d.reason, 'bad-remote');
});

// --- totality: never throw on malformed/missing input -----------------------

test('total: non-array protectedBranches/configuredRemotes coerce, never throw', () => {
  const d = decidePublish({ ...OK, protectedBranches: null, configuredRemotes: 'origin' });
  // configuredRemotes coerced to [] -> the remote is not configured.
  assert.equal(d.action, 'refuse');
  assert.equal(d.reason, 'remote-not-configured');
});

test('total: non-string currentBranch/remote refuse rather than throw', () => {
  assert.equal(decidePublish({ ...OK, currentBranch: 42 }).reason, 'no-branch');
  assert.equal(decidePublish({ ...OK, remote: null }).reason, 'bad-remote');
  assert.equal(decidePublish({ ...OK, remote: undefined }).reason, 'bad-remote');
});

test('total: a bare call with no args refuses (auto-close-off), no throw', () => {
  const d = decidePublish();
  assert.equal(d.action, 'refuse');
  assert.equal(d.reason, 'auto-close-off');
  assert.deepEqual(d.argv, []);
  assert.equal(d.branch, null);
  assert.equal(d.remote, null);
});

// --- decideReap: the local reap of a merged integration branch ---------------

// A well-formed reap call: a safe, non-protected, not-checked-out branch that
// still exists.
const REAP_OK = {
  branch: 'cadence/v2.2.0',
  currentBranch: 'main',
  protectedBranches: ['main', 'master'],
  exists: true,
};

test('reap: byte-exact argv with the branch behind a -- end-of-options marker', () => {
  const d = decideReap(REAP_OK);
  assert.equal(d.action, 'reap');
  assert.deepEqual(d.argv, ['branch', '-D', '--', 'cadence/v2.2.0']);
  assert.equal(d.branch, 'cadence/v2.2.0');
  // The branch appears in exactly one token, and it is the last one - behind
  // `--`, so no name can ever be read as an option (verified accepted by git
  // 2.55: `git branch -D -- reapme` deletes reapme).
  assert.equal(d.argv.filter((a) => a.includes('cadence/v2.2.0')).length, 1);
  assert.equal(d.argv[d.argv.length - 1], 'cadence/v2.2.0');
});

test('reap: an absent branch is a SKIP, not a failure (idempotent close)', () => {
  const d = decideReap({ ...REAP_OK, exists: false });
  assert.equal(d.action, 'skip');
  assert.equal(d.reason, 'already-absent');
  assert.deepEqual(d.argv, []);
  assert.equal(d.branch, 'cadence/v2.2.0');
});

test('reap: an UNKNOWN exists (undefined) still reaps - only false skips', () => {
  assert.equal(decideReap({ ...REAP_OK, exists: undefined }).action, 'reap');
});

test('refuse: no branch at all -> no-branch', () => {
  for (const branch of [undefined, null, '', 42, {}]) {
    const d = decideReap({ ...REAP_OK, branch });
    assert.equal(d.action, 'refuse', JSON.stringify(branch));
    assert.equal(d.reason, 'no-branch');
    assert.deepEqual(d.argv, []);
  }
});

test('refuse: an unsafe branch name -> bad-branch, and the argv stays empty', () => {
  // Same SAFE_BRANCH rule decidePublish uses - shared on purpose, because two
  // copies of a security-relevant regex are two things to keep in step.
  for (const branch of ['-D', '--force', 'a:b', '../etc', '.hidden', 'a b', 'a;rm -rf /', 'a$(x)']) {
    const d = decideReap({ ...REAP_OK, branch });
    assert.equal(d.action, 'refuse', branch);
    assert.equal(d.reason, 'bad-branch', branch);
    assert.deepEqual(d.argv, []);
  }
});

test('refuse: a protected branch is never reaped', () => {
  const d = decideReap({ ...REAP_OK, branch: 'main', currentBranch: 'other' });
  assert.equal(d.action, 'refuse');
  assert.equal(d.reason, 'protected-branch');
});

test('refuse: the checked-out branch -> current-branch, a name for what git errors on', () => {
  const d = decideReap({ ...REAP_OK, branch: 'cadence/v2.2.0', currentBranch: 'cadence/v2.2.0' });
  assert.equal(d.action, 'refuse');
  assert.equal(d.reason, 'current-branch');
});

test('reap gate order: bad-branch beats protected, protected beats current, current beats absent', () => {
  assert.equal(decideReap({ branch: '-D', protectedBranches: ['-D'], currentBranch: '-D', exists: false }).reason,
    'bad-branch');
  assert.equal(decideReap({ branch: 'main', protectedBranches: ['main'], currentBranch: 'main', exists: false }).reason,
    'protected-branch');
  assert.equal(decideReap({ branch: 'x', protectedBranches: [], currentBranch: 'x', exists: false }).reason,
    'current-branch');
});

test('reap total: a bare call and non-array protectedBranches never throw', () => {
  const bare = decideReap();
  assert.equal(bare.action, 'refuse');
  assert.equal(bare.reason, 'no-branch');
  assert.equal(bare.branch, null);
  assert.deepEqual(bare.argv, []);
  assert.equal(decideReap({ ...REAP_OK, protectedBranches: 'main' }).action, 'reap'); // coerced to []
});

test('reap authorizes nothing: no auto_close input exists to pass it', () => {
  // Deleting an already-merged LOCAL branch publishes nothing, so it needs no
  // publish authorization. Passing one changes no verdict.
  const d = decideReap({ ...REAP_OK, autoClose: false });
  assert.equal(d.action, 'reap');
});
