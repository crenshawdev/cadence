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

/** Feed the hook a PreToolUse payload; return the parsed decision or null. */
function guard(command, cwd) {
  const stdout = execFileSync('node', [GUARD], {
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { command }, cwd }),
    env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
  });
  return stdout.trim() ? JSON.parse(stdout).hookSpecificOutput : null;
}

/** A Cadence project fixture: git repo on `branch` with a .planning dir. */
function project(branch, config) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-repo-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', branch]);
  writeFileSync(join(dir, 'f.txt'), 'x');
  execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'ignore' });
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t',
    'commit', '-q', '-m', 'init'], { stdio: 'ignore' });
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
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /cad-land/);
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
