// Zero-dep tests for git-guard.mjs (the PreToolUse hook). Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// What a command IS, is read by lib/git-segments.mjs and pinned in
// git-segments.test.mjs. This file tests the HOOK: that a reading reaches the
// permission prompt, which is the guard's only observable (D-09). A defect
// proven only at the reader level is not proven to reach a decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'git-guard.mjs');

// Hermetic global config (never read the dev's real one).
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-guard-')), 'no-global.json');

// Fixture git calls must never read the dev's global/system git config
// (commit.gpgsign, init.defaultBranch hooks, ... would break the fixtures).
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };

/** Run a git command against a fixture dir, hermetically. */
function git(args, opts = {}) {
  execFileSync('git', args, { stdio: 'ignore', env: GIT_ENV, ...opts });
}

/** Feed the hook a raw stdin payload; return trimmed stdout. */
function guardRaw(input) {
  return execFileSync('node', [GUARD], {
    encoding: 'utf8',
    input,
    env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
  }).trim();
}

/** Feed the hook a PreToolUse payload; return the parsed decision or null. */
function guard(command, cwd) {
  const stdout = guardRaw(JSON.stringify({ tool_input: { command }, cwd }));
  return stdout ? JSON.parse(stdout).hookSpecificOutput : null;
}

/** A Cadence project fixture: git repo on `branch` with a .planning dir. */
function project(branch, config) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-repo-'));
  git(['-C', dir, 'init', '-q', '-b', branch]);
  writeFileSync(join(dir, 'f.txt'), 'x');
  git(['-C', dir, 'add', '.']);
  git(['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t',
    'commit', '-q', '-m', 'init']);
  mkdirSync(join(dir, '.planning'), { recursive: true });
  if (config) writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify(config));
  return dir;
}

// --- Scope. -----------------------------------------------------------------

test('silent outside a Cadence project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-plain-'));
  assert.equal(guard('git push origin main', dir), null);
});

test('silent for non-git commands inside a project', () => {
  assert.equal(guard('ls -la', project('main')), null);
});

test('guard applies from a subdirectory of the project (walk-up)', () => {
  const dir = project('main');
  const sub = join(dir, 'src', 'deep');
  mkdirSync(sub, { recursive: true });
  const d = guard('git commit -m "x"', sub);
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /protected/);
});

test('walk-up stops at a repo root without .planning (still not policed)', () => {
  // A plain repo whose PARENT happens to contain .planning must not be policed.
  const outer = mkdtempSync(join(tmpdir(), 'cad-guard-outer-'));
  mkdirSync(join(outer, '.planning'));
  const inner = join(outer, 'other-repo');
  mkdirSync(inner);
  git(['-C', inner, 'init', '-q', '-b', 'main']);
  assert.equal(guard('git push origin main', inner), null);
});

// --- Rail 3: never auto-push. -----------------------------------------------

test('git push always asks (publishing is /cad-land\'s call)', () => {
  const d = guard('git push origin feature', project('feature'));
  assert.equal(d.hookEventName, 'PreToolUse'); // the harness routes on this
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /cad-land/);
});

test('auto_close true does not exempt any push - every push still asks', () => {
  // The direct inversion of the removed exemption: git-guard carries NO push
  // exemption. Even the exact shape that once passed silently under repo
  // auto_close now asks. cad-land's sanctioned publish runs through the
  // git-publish seam as a subprocess argv push this Bash hook never sees.
  const dir = project('cadence/v1.1.0-rc.2', { git: { auto_close: true } });
  const d = guard('git push -u origin cadence/v1.1.0-rc.2', dir);
  assert.notEqual(d, null);
  assert.equal(d.permissionDecision, 'ask');
});

test('compound command still catches the push half', () => {
  const d = guard('git add . && git push', project('feature'));
  assert.equal(d.permissionDecision, 'ask');
});

test('global git options are skipped when finding the subcommand', () => {
  const d = guard('git -C . -c user.name=t push origin x', project('feature'));
  assert.equal(d.permissionDecision, 'ask');
});

test('git stash push is not a publish (the verb is stash)', () => {
  assert.equal(guard('git stash push -m wip', project('main')), null);
});

test('push as an argument or inside quotes never fires the rail', () => {
  const p = project('main');
  assert.equal(guard('git log --grep "push"', p), null);
  assert.equal(guard('git log --grep push', p), null);
  assert.equal(guard('echo "git push"', p), null);
});

// --- Rail 1: the protected-branch commit guard, the only deny surface. ------

test('commit on a protected branch asks by default, silent on a task branch', () => {
  const d = guard('git commit -m "x"', project('main'));
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /protected/);
  assert.equal(guard('git commit -m "x"', project('improve/thing')), null);
});

test('git.on_protected=refuse denies; =allow stays silent', () => {
  const refuse = guard('git commit -m "x"',
    project('main', { git: { on_protected: 'refuse' } }));
  assert.equal(refuse.permissionDecision, 'deny');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { on_protected: 'allow' } })), null);
});

test('on_protected "deny" is an alias of refuse, not a silent soft-ask (#38)', () => {
  const d = guard('git commit -m "x"',
    project('main', { git: { on_protected: 'deny' } }));
  assert.equal(d.permissionDecision, 'deny');
});

test('a string protected_branches guards THAT branch, not the default list (#38)', () => {
  // "release" (string, not array) is an easy hand-edit; honor it instead of
  // silently reverting to ['main','master'].
  const d = guard('git commit -m "x"',
    project('release', { git: { protected_branches: 'release' } }));
  assert.equal(d.permissionDecision, 'ask');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { protected_branches: 'release' } })), null);
});

test('custom protected_branches list is honored', () => {
  const d = guard('git commit -m "x"',
    project('release', { git: { protected_branches: ['release'] } }));
  assert.equal(d.permissionDecision, 'ask');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { protected_branches: ['release'] } })), null);
});

test('a commit message naming the push rail is a commit, not a push', () => {
  // Only the verb is read, so `push` as message content cannot reach rail 3.
  const d = guard('git commit -m "fix the push rail"',
    project('main', { git: { on_protected: 'refuse' } }));
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /protected branch/);
});

// The deny gate is GONE, and this is the suite that replaces it. Detection used
// to be any-position - a wide reader saw `rg -t sh "git commit"` as a commit -
// so a SECOND rule had to narrow refusal back to command position, and that
// rule had an enumerated prefix set three review rounds kept finding new
// members of. Anchoring detection to the command word makes every row below
// silent up front, so there is one rule where there were two and no
// enumeration to maintain.
test('a mention or a read-only search is silent, so no deny gate is needed', () => {
  const p = project('main', { git: { on_protected: 'refuse' } });
  for (const command of [
    'rg -n "git push" .',
    'rg -t sh "git commit"',
    'grep git commit',
    'command -v git commit',
    'echo "git commit"',
    'echo git commit',
  ]) {
    assert.equal(guard(command, p), null, command);
  }
});

// --- The accepted cost of deleting the tokenizer. ---------------------------

// Each row below REALLY CAN run git and is now silent. They are here as a
// pinned, deliberate list rather than as an absence, so the trade stays visible
// and a future reader does not mistake any of them for an oversight. The
// tokenizer that saw them cost 840 lines, an escape surface that never stopped
// producing findings, and a hook OOM that failed OPEN. references/git.md rail 3
// and the CHANGELOG entry that removed the parser carry the same list.
test('shapes the anchored reader declines to see (stated cost, not an oversight)', () => {
  const p = project('feature', { git: { on_protected: 'refuse' } });
  for (const command of [
    'bash -c "git push origin main"',           // shell wrapper
    'sh -c \'git push origin main\'',
    'eval git push origin main',
    '$(git push origin main)',                  // command substitution
    '`git push origin main`',
    '(git push origin main)',                   // subshell
    'sudo git push origin main',                // transparent prefix
    'timeout 60 git push origin main',
    'xargs git push',
    'env -S "git push origin main"',
    'ssh host "git push origin main"',          // always was out of grammar
    'git -C "my repo" push origin main',        // quoted path with a space
    'git \\\n  push origin main',               // line continuation
  ]) {
    assert.equal(guard(command, p), null, command);
  }
});

// --- Failure posture: a broken or overloaded guard never blocks work. -------

test('malformed stdin exits 0 with no output (guard never blocks work)', () => {
  assert.equal(guardRaw('not json {'), '');
});

test('payload without a command stays silent inside a project', () => {
  const dir = project('main');
  assert.equal(guardRaw(JSON.stringify({ tool_input: {}, cwd: dir })), '');
});

test('commit guard degrades silently when .planning has no git repo', () => {
  // planningRoot finds the project, but `git rev-parse` fails - the guard
  // must swallow that and never block (a broken guard blocks nothing).
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-norepo-'));
  mkdirSync(join(dir, '.planning'));
  assert.equal(guard('git commit -m "x"', dir), null);
});

test('detached HEAD is not a protected branch (rev-parse says HEAD)', () => {
  const dir = project('main');
  git(['-C', dir, 'checkout', '-q', '--detach']);
  assert.equal(guard('git commit -m "x"', dir), null);
});

test('the payload size that OOMed the deleted reader still decides', () => {
  // The deleted reader was O(K x N) in memory and aborted (SIGABRT, no stdout)
  // at 280KB. This hook FAILS OPEN, so that abort let a real push run
  // unprompted - the guard's worst failure mode reached by its own input. Here
  // the same size decides normally, through the real hook.
  const p = project('feature');
  const big = 'git clean -fd; '.repeat(24000) + 'git push origin main';
  assert.ok(big.length > 280_000, 'fixture must exceed the measured OOM point');
  const d = guard(big, p);
  assert.notEqual(d, null);
  assert.equal(d.permissionDecision, 'ask');
});
