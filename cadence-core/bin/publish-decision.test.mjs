// Zero-dep tests for lib/publish-decision.mjs (the pure git-publish core).
// Run: node --test 'cadence-core/bin/*.test.mjs'. Only node: builtins, and the
// function is pure, so this needs no subprocess or live git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizationDetail, decidePublish, decideReap, tornLayerRefusal } from './lib/publish-decision.mjs';

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

// --- which authorization was missing (AUT-01, AC4) ---------------------------
//
// `reason` is the token `auto-close-off` in BOTH off-states, deliberately - it
// is asserted by equality across git-publish.test.mjs and config-seams.test.mjs
// and changing its text buys no behaviour. So the state a user has to act on -
// "you turned it on in your home directory, and this repository never did" -
// can only reach them through the sentence.

test('detail: off everywhere and requested-globally are DIFFERENT sentences', () => {
  const off = decidePublish({ ...OK, autoClose: false, autoCloseRequested: false });
  const requested = decidePublish({ ...OK, autoClose: false, autoCloseRequested: true });
  assert.equal(off.reason, 'auto-close-off');
  assert.equal(requested.reason, 'auto-close-off');
  assert.ok(off.detail, 'off-everywhere carries a detail');
  assert.ok(requested.detail, 'requested-globally carries a detail');
  assert.notEqual(off.detail, requested.detail);
});

test('detail: the requested-globally sentence says a user-global setting cannot authorize here', () => {
  const d = decidePublish({ ...OK, autoClose: false, autoCloseRequested: true }).detail || '';
  assert.match(d, /user-global setting cannot authorize/);
  assert.match(d, /never set it|did not opt in/);
  // and names where the opt-in belongs, so the user needs no second lookup
  assert.match(d, /\.planning\/config\.json/);
});

test('detail: the off-everywhere sentence still names where the opt-in belongs', () => {
  const d = decidePublish({ ...OK, autoClose: false, autoCloseRequested: false }).detail || '';
  assert.match(d, /not true anywhere/);
  assert.match(d, /\.planning\/config\.json/);
});

test('detail: an authorized call publishes and carries no detail at all', () => {
  const d = decidePublish({ ...OK, autoCloseRequested: true });
  assert.equal(d.action, 'publish');
  assert.equal(d.detail, undefined);
  assert.equal(authorizationDetail({ requested: true, authorized: true }), null);
  // Authorized here, never requested globally: the repository's own opt-in is
  // the whole answer, so there is still nothing to say.
  assert.equal(authorizationDetail({ requested: false, authorized: true }), null);
});

test('detail: gate 1 is the ONLY refusal that carries one', () => {
  // Every other refuse arm's envelope is unchanged by this addition.
  for (const args of [
    { currentBranch: 'HEAD' }, { currentBranch: '-rf' }, { currentBranch: 'main' },
    { remote: '/tmp/e' }, { remote: 'origin', configuredRemotes: ['upstream'] },
  ]) {
    const d = decidePublish({ ...OK, autoCloseRequested: true, ...args });
    assert.equal(d.action, 'refuse', JSON.stringify(args));
    assert.notEqual(d.reason, 'auto-close-off', JSON.stringify(args));
    assert.equal(d.detail, undefined, JSON.stringify(args));
  }
});

test('detail total: a bare call and non-boolean inputs coerce rather than throw', () => {
  assert.ok(authorizationDetail());
  assert.ok(authorizationDetail({}));
  // Only a literal true authorizes, and only a literal true reads as requested.
  assert.equal(authorizationDetail({ requested: 'true', authorized: 'true' }),
    authorizationDetail({ requested: false, authorized: false }));
  assert.equal(authorizationDetail({ requested: 1, authorized: null }),
    authorizationDetail({ requested: false, authorized: false }));
  assert.ok(decidePublish().detail, 'the bare decidePublish refusal still words itself');
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

// --- the mutation gate's classifier (EXP-01, AC10) --------------------------
//
// This lived in git-publish.mjs, which runs its dispatch at module load and so
// cannot be imported - the rule was reachable only through a subprocess and had
// no unit test at all. These arms are the reason it moved (D-18).

/** The wording `mergeLayers` produces for a layer that failed to parse. */
const TORN_FILE = '/home/u/.claude/cadence/config.json';
const TORN_SAID = `config layer ${TORN_FILE} failed to parse and was skipped: Unexpected end of JSON input`;

test('torn gate: no torn layer is no refusal, whatever else is on warnings[]', () => {
  // THE regression this exists for. The shipped rule returned warnings[0] on any
  // non-empty array with no layer or class discrimination, so every diagnostic
  // `mergeLayers` might add stopped a land - which is why phase 1 had to route
  // its global-only-key warning onto a field of its own to keep /cad-land
  // working in this very repository.
  assert.equal(tornLayerRefusal({ warnings: [], tornLayers: [] }), null);
  assert.equal(tornLayerRefusal({
    warnings: [`ignored the repo layer's workflow.test_command (${TORN_FILE})`,
      'risk.override.auth was retired in v2.7.0'],
    tornLayers: [],
  }), null, 'a message-channel diagnostic is not a torn layer');
});

test('torn gate: a torn layer refuses, with the merge\'s own wording', () => {
  assert.equal(tornLayerRefusal({ warnings: [TORN_SAID], tornLayers: [TORN_FILE] }), TORN_SAID);
  // The torn layer's OWN sentence, not warnings[0]: a non-torn diagnostic
  // sitting first must not become the refusal detail.
  assert.equal(tornLayerRefusal({
    warnings: ['risk.override.auth was retired in v2.7.0', TORN_SAID],
    tornLayers: [TORN_FILE],
  }), TORN_SAID);
  // The class alone still refuses - a caller that supplies no matching message
  // gets a named detail rather than null, because the layer really is torn.
  const bare = tornLayerRefusal({ warnings: [], tornLayers: [TORN_FILE] });
  assert.ok(bare && bare.includes(TORN_FILE), String(bare));
});

test('torn gate: TOTAL - a missing or non-array input is no refusal, never a throw', () => {
  assert.equal(tornLayerRefusal(), null);
  assert.equal(tornLayerRefusal({}), null);
  assert.equal(tornLayerRefusal({ warnings: 'x', tornLayers: 'y' }), null);
  assert.equal(tornLayerRefusal({ warnings: [null, 3], tornLayers: ['', null] }), null);
});
