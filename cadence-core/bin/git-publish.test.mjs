// Zero-dep tests for git-publish.mjs (the ONE publishing seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Hermetic: a local bare origin, no
// network, and GIT_CONFIG_GLOBAL/SYSTEM=/dev/null so the dev's git config never
// leaks into the fixtures (same discipline as git-guard.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
