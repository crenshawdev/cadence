// Zero-dep tests for git-publish.mjs (the ONE publishing seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Hermetic: a local bare origin, no
// network, and GIT_CONFIG_GLOBAL/SYSTEM=/dev/null so the dev's git config never
// leaks into the fixtures (same discipline as git-guard.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The two-layer git fixture, imported rather than copied (D-19). That file's
// own arms are bound to a no-op unless it is the entry file, so importing it
// registers nothing here.
import { gitLayers } from './config-seams.test.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'git-publish.mjs');
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-pub-')), 'no-global.json');
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };

/** Run a git command against a fixture dir, hermetically. */
function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: GIT_ENV, ...opts });
}

/** Run the seam; return the parsed JSON line. `globalCfg` sets CADENCE_GLOBAL_CONFIG.
 * The seam mirrors ok into the exit code (ok:false -> exit 1, lib/seam-io.mjs),
 * so a refuse makes execFileSync throw with the JSON still on e.stdout. */
function seam(args, globalCfg = NO_GLOBAL) {
  const opts = { encoding: 'utf8', env: { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: globalCfg } };
  let out;
  try { out = execFileSync('node', [SEAM, ...args], opts); }
  catch (e) { out = e.stdout; }
  return JSON.parse(String(out).trim());
}

/** True iff `ref` exists in the bare repo `bare`. */
function refExists(bare, ref) {
  try { git(['-C', bare, 'rev-parse', '--verify', ref]); return true; }
  catch { return false; }
}

/**
 * A work repo with an initial commit. Options:
 *   branch   - branch to check out (default 'cadence/v1.1.0-rc.2'); null = detach.
 *   origin   - add a bare origin remote (default true); returns { dir, bare }.
 *   config   - repo .planning/config.json contents (default {git:{auto_close:true}}).
 */
function repo({ branch = 'cadence/v1.1.0-rc.2', origin = true, config = { git: { auto_close: true } } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-pub-repo-'));
  git(['-C', dir, 'init', '-q', '-b', 'main']);
  writeFileSync(join(dir, 'f.txt'), 'x');
  git(['-C', dir, 'add', '.']);
  git(['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);
  let bare = null;
  if (origin) {
    bare = mkdtempSync(join(tmpdir(), 'cad-pub-bare-'));
    git(['-C', bare, 'init', '-q', '--bare']);
    git(['-C', dir, 'remote', 'add', 'origin', bare]);
  }
  if (branch === null) {
    git(['-C', dir, 'checkout', '-q', '--detach']);
  } else if (branch !== 'main') {
    git(['-C', dir, 'checkout', '-q', '-b', branch]);
  }
  mkdirSync(join(dir, '.planning'), { recursive: true });
  if (config) writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify(config));
  return { dir, bare };
}

const INT_REF = 'refs/heads/cadence/v1.1.0-rc.2';

// --- the publish path -------------------------------------------------------

test('publish: auto_close true on a non-protected branch pushes exactly that ref', () => {
  const { dir, bare } = repo();
  const d = seam(['publish', '--dir', dir]);
  assert.equal(d.ok, true);
  assert.equal(d.action, 'published');
  assert.equal(d.branch, 'cadence/v1.1.0-rc.2');
  assert.equal(d.remote, 'origin');
  assert.equal(refExists(bare, INT_REF), true, 'the integration ref landed in the bare origin');
  // Nothing else moved: the bare has only the one branch ref.
  const heads = git(['-C', bare, 'for-each-ref', '--format=%(refname)', 'refs/heads/']).trim();
  assert.equal(heads, INT_REF);
});

// --- refuse paths: each pushes nothing --------------------------------------

test('refuse: auto_close false -> auto-close-off, bare gains no branch', () => {
  const { dir, bare } = repo({ config: { git: { auto_close: false } } });
  const d = seam(['publish', '--dir', dir]);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'auto-close-off');
  assert.equal(refExists(bare, INT_REF), false);
});

test('refuse: HEAD on a protected branch -> protected-branch, no push', () => {
  const { dir, bare } = repo({ branch: 'main' });
  const d = seam(['publish', '--dir', dir]);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'protected-branch');
  assert.equal(refExists(bare, 'refs/heads/main'), false);
});

test('refuse: no origin remote configured -> remote-not-configured', () => {
  const { dir } = repo({ origin: false });
  const d = seam(['publish', '--dir', dir]);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'remote-not-configured');
});

test('refuse: detached HEAD -> no-branch, no push', () => {
  const { dir, bare } = repo({ branch: null });
  const d = seam(['publish', '--dir', dir]);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'no-branch');
  assert.equal(refExists(bare, INT_REF), false);
});

test('refuse: auto_close ONLY in the global layer (repo omits) -> auto-close-off (D-08)', () => {
  // Repo config has no auto_close; a global auto_close must never enable a
  // publish in an unrelated project - repoAutoClose reads the repo layer only.
  const { dir, bare } = repo({ config: { git: {} } });
  const globalCfg = join(mkdtempSync(join(tmpdir(), 'cad-pub-glob-')), 'g.json');
  writeFileSync(globalCfg, JSON.stringify({ git: { auto_close: true } }));
  const d = seam(['publish', '--dir', dir], globalCfg);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'auto-close-off');
  assert.equal(refExists(bare, INT_REF), false);
});

test('usage: an unknown subcommand -> ok:false reason usage', () => {
  const d = seam(['frobnicate']);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'usage');
});

// --- the reap path ----------------------------------------------------------

const REAP_REF = 'refs/heads/cadence/v2.2.0';

/** Run the seam and return the parsed JSON line AND the exit status, so ok/exit
 * parity is asserted rather than assumed (an `already-absent` skip is ok:true
 * and must therefore exit 0, or an autonomous close reads it as a failure). */
function seamStatus(args, globalCfg = NO_GLOBAL) {
  const opts = { encoding: 'utf8', env: { ...GIT_ENV, CADENCE_GLOBAL_CONFIG: globalCfg } };
  try { return { d: JSON.parse(execFileSync('node', [SEAM, ...args], opts).trim()), status: 0 }; }
  catch (e) { return { d: JSON.parse(String(e.stdout).trim()), status: e.status }; }
}

test('reap: a merged integration branch is actually deleted', () => {
  const { dir } = repo({ branch: 'main' });
  git(['-C', dir, 'branch', 'cadence/v2.2.0']);
  assert.equal(refExists(dir, REAP_REF), true);
  const { d, status } = seamStatus(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0']);
  assert.equal(d.ok, true);
  assert.equal(d.action, 'reaped');
  assert.equal(d.branch, 'cadence/v2.2.0');
  assert.equal(status, 0);
  assert.equal(refExists(dir, REAP_REF), false, 'the local branch is gone');
});

test('reap: an UNMERGED branch is deleted too - land-cleanup owns the merged verdict', () => {
  // Deliberate: the auto_close arm's merge lands on the PLATFORM, so a local
  // merged check would refuse exactly the case the seam exists for. Pinned so
  // the omission reads as a decision rather than a missing gate.
  const { dir } = repo({ branch: 'main' });
  git(['-C', dir, 'checkout', '-q', '-b', 'cadence/v2.2.0']);
  writeFileSync(join(dir, 'g.txt'), 'y');
  git(['-C', dir, 'add', '.']);
  git(['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'ahead']);
  git(['-C', dir, 'checkout', '-q', 'main']);
  const d = seam(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0']);
  assert.equal(d.ok, true);
  assert.equal(d.action, 'reaped');
  assert.equal(refExists(dir, REAP_REF), false);
});

test('reap: an already-absent branch SKIPS with ok:true and exit 0 (idempotent close)', () => {
  const { dir } = repo({ branch: 'main' });
  const { d, status } = seamStatus(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0']);
  assert.equal(d.ok, true);
  assert.equal(d.action, 'already-absent');
  assert.equal(d.branch, 'cadence/v2.2.0');
  assert.equal(status, 0, 'ok:true must exit 0 - the platform may already have deleted it');
});

test('reap refuse: a protected branch, and it is still there afterwards', () => {
  const { dir } = repo({ branch: 'cadence/v2.2.0' });
  const { d, status } = seamStatus(['reap', '--dir', dir, '--branch', 'main']);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'protected-branch');
  assert.equal(status, 1);
  assert.equal(refExists(dir, 'refs/heads/main'), true, 'main survives');
});

test('reap refuse: the CHECKED-OUT branch, named rather than left to a git error', () => {
  const { dir } = repo({ branch: 'cadence/v2.2.0' });
  const d = seam(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0']);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'current-branch');
  assert.equal(refExists(dir, REAP_REF), true);
});

test('reap refuse: an option-shaped branch name never reaches git', () => {
  const { dir } = repo({ branch: 'main' });
  git(['-C', dir, 'branch', 'cadence/v2.2.0']);
  const d = seam(['reap', '--dir', dir, '--branch', '--force']);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'bad-branch');
  assert.equal(refExists(dir, REAP_REF), true, 'nothing else was deleted');
});

test('reap refuse: no --branch at all -> no-branch, and no git ran', () => {
  const { dir } = repo({ branch: 'main' });
  git(['-C', dir, 'branch', 'cadence/v2.2.0']);
  const d = seam(['reap', '--dir', dir]);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'no-branch');
  assert.equal(refExists(dir, REAP_REF), true);
});

test('reap needs no auto_close: a close-off repo still reaps its local branch', () => {
  // Deleting a local branch publishes nothing, so unlike publish it carries no
  // authorization gate.
  const { dir } = repo({ branch: 'main', config: { git: { auto_close: false } } });
  git(['-C', dir, 'branch', 'cadence/v2.2.0']);
  const d = seam(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0']);
  assert.equal(d.ok, true);
  assert.equal(d.action, 'reaped');
  assert.equal(refExists(dir, REAP_REF), false);
});

test('usage: the detail names both subcommands', () => {
  const d = seam(['frobnicate']);
  assert.equal(d.ok, false);
  assert.match(d.detail, /publish/);
  assert.match(d.detail, /reap/);
});

// --- the torn-layer mutation gate -------------------------------------------

/** A user-global layer file holding raw TEXT - so a truncated JSON body can be
 * written verbatim and the merge reports the parse failure the gate keys on. */
function globalText(text) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-pub-glob-')), 'g.json');
  writeFileSync(file, text);
  return file;
}

// A global layer that WOULD have protected the branch, truncated mid-array.
const TORN_GLOBAL = '{"git":{"protected_branches":["cadence/v1.1.0-rc.2","cadence/v2.2.0"]';

test('publish refuse: a TORN layer that could carry protected_branches pushes NOTHING', () => {
  // The list `decidePublish` refused with fell back to ["main","master"] because
  // the layer holding the user's did not parse, so the protected-branch gate ran
  // on the wrong list. No push while that is unprovable.
  const { dir, bare } = repo();
  const { d, status } = seamStatus(['publish', '--dir', dir], globalText(TORN_GLOBAL));
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'config-parse-failed');
  assert.match(d.detail, /failed to parse/);
  assert.equal(d.warnings.length, 1);
  assert.equal(status, 1);
  assert.equal(refExists(bare, INT_REF), false, 'the ref never reached the remote');
});

test('reap refuse: a TORN layer leaves the branch it would have protected in place', () => {
  // The reproduction: with the layer intact this same command answers
  // {"ok":false,"reason":"protected-branch"}; torn, it used to answer
  // {"ok":true,"action":"reaped"} and the branch was already gone.
  const { dir } = repo({ branch: 'main' });
  git(['-C', dir, 'branch', 'cadence/v2.2.0']);
  const { d, status } = seamStatus(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0'],
    globalText(TORN_GLOBAL));
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'config-parse-failed');
  assert.match(d.detail, /failed to parse/);
  assert.equal(status, 1);
  assert.equal(refExists(dir, REAP_REF), true, 'the branch survives the torn layer');
});

test('warnings[] rides the git-publish envelope on the acting AND the skip arms', () => {
  // Pins the emission itself: stripping `, warnings })` off the emits leaves the
  // gate above passing on its refusals but fails here.
  const { dir } = repo({ branch: 'main' });
  git(['-C', dir, 'branch', 'cadence/v2.2.0']);
  const clean = seam(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0']);
  assert.equal(clean.action, 'reaped');
  assert.deepEqual(clean.warnings, [], 'present as an empty array, not omitted');
  // The idempotent skip stays ok:true under a torn layer - it mutates nothing -
  // and carries the diagnostic rather than swallowing it.
  const skipped = seamStatus(['reap', '--dir', dir, '--branch', 'cadence/v2.2.0'],
    globalText(TORN_GLOBAL));
  assert.equal(skipped.d.ok, true);
  assert.equal(skipped.d.action, 'already-absent');
  assert.equal(skipped.status, 0);
  assert.match(skipped.d.warnings[0], /failed to parse/);
});

// --- no failure detail carries a credential (EXP-01, AC8) --------------------
//
// The fixture is `gitLayers` imported from config-seams.test.mjs (D-19) rather
// than this file's own `repo()`: the hostile-repo scaffolding phase 1 built is
// what these arms reuse, and a copy of it here is the drift the shared fixture
// exists to prevent.
//
// Both arms point `origin` at a remote whose URL carries userinfo on a
// transport git does NOT anonymize, measured 2026-08-13 on git 2.55.0 (D-15).
// The `https://x-access-token:TOKEN@host` form the requirement cites is
// anonymized by git before the error is emitted, so an arm built on it is green
// against unpatched code - which is the defect, not the test.

/** The credential planted in the fixture remotes below. */
const LEAK_USER = 'cad';
const LEAK_SECRET = 's3cr3t-tok';

/**
 * A publish fixture on a non-protected branch whose `origin` is `url`.
 * `gitLayers` writes no global layer here, so the seam's merge stays clean and
 * the only thing under test is what the push failure carries.
 * @param {string} url
 */
function leakyOrigin(url) {
  const fx = gitLayers({ branch: 'cadence/v9.9.9', repo: { git: { auto_close: true } } });
  git(['-C', fx.root, 'remote', 'add', 'origin', url]);
  return fx;
}

/** @param {{ok:boolean, reason?:string, detail?:string}} d @param {string} label */
function assertNoCredential(d, label) {
  assert.equal(d.ok, false, `${label}: ${JSON.stringify(d)}`);
  assert.equal(d.reason, 'push-failed', `${label}: ${JSON.stringify(d)}`);
  assert.ok(d.detail && d.detail.length > 0, `${label}: empty detail`);
  assert.equal(d.detail.includes(LEAK_SECRET), false, `${label}: the secret survived: ${d.detail}`);
  assert.equal(d.detail.includes(`${LEAK_USER}:`), false, `${label}: the userinfo survived: ${d.detail}`);
  assert.ok(d.detail.includes('host.invalid'), `${label}: the host was lost too: ${d.detail}`);
}

test('publish: a git:// remote carrying userinfo fails without leaking it', () => {
  // Measured leak: `fatal: unable to look up cad:s3cr3t-tok@host.invalid (port
  // 9418)`. No network - `.invalid` is reserved and never resolves.
  const fx = leakyOrigin(`git://${LEAK_USER}:${LEAK_SECRET}@host.invalid/r.git`);
  assertNoCredential(seam(['publish', '--dir', fx.root]), 'git://');
});

test('publish: a PATH-shaped remote carrying userinfo fails without leaking it', () => {
  // The second transport measured to leak, and the one AC8 names beside git://:
  // git quotes the whole path back (`fatal: '/nonexistent/cad:s3cr3t-tok@
  // host.invalid/r.git' does not appear to be a git repository`). An scp-shaped
  // remote is NOT usable here - git hands it straight to ssh, whose stderr
  // names neither the URL nor the host, so there is nothing for this arm to
  // assert and the ssh it spawns would read the developer's own ~/.ssh/config.
  const fx = leakyOrigin(`/nonexistent/${LEAK_USER}:${LEAK_SECRET}@host.invalid/r.git`);
  const d = seam(['publish', '--dir', fx.root]);
  assertNoCredential(d, 'path-shaped');
  assert.ok(d.detail.includes('/nonexistent/'), d.detail);
});

test('source: every git-publish failure detail goes through redactUrl', () => {
  // The census, so a FOURTH site added to this file fails here rather than
  // shipping a credential: three of EXP-01's four sites live in git-publish.mjs
  // (push-failed, reap-failed, and the dispatch-level internal catch), and each
  // is named so a rename cannot quietly drop one. The fourth site is
  // planning.mjs's no-staged-set, censused by planning.test.mjs beside its own
  // end-to-end arm - one census per file, so the two cannot drift apart.
  const IDIOM = /e && e\.message \? e\.message : String\(e\)/g;
  const WRAPPED = /redactUrl\(e && e\.message \? e\.message : String\(e\)\)/g;
  const pub = readFileSync(join(BIN, 'git-publish.mjs'), 'utf8');
  assert.equal((pub.match(IDIOM) || []).length, 3, 'git-publish.mjs gained or lost a detail site');
  assert.equal((pub.match(WRAPPED) || []).length, 3, 'a git-publish.mjs detail site is unredacted');
  for (const reason of ['push-failed', 'reap-failed', 'internal']) {
    assert.match(pub, new RegExp(`reason: '${reason}'[\\s\\S]{0,120}?detail: redactUrl\\(`), reason);
  }
});
