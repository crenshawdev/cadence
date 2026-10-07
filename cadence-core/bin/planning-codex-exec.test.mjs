// Zero-dep tests for `planning.mjs codex-exec`. Run:
// node --test cadence-core/bin/planning-codex-exec.test.mjs
//
// Every case runs against a stub `codex` this file writes. The child's PATH is
// built from the stub's directory and a second directory holding only a `node`
// symlink, never inherited and never node's own bin directory: an npm-global
// install puts the real `codex` beside node, and a test must not spend
// anyone's Codex plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLANNING = fileURLToPath(new URL('./planning.mjs', import.meta.url));
const TEST_BOUND_MS = 1500;
const PROMPT = 'Build task 1.\nLine two, with "quotes" and a trailing newline.\n';

/** A directory holding only `node`, so the stub's `#!/usr/bin/env node` resolves. */
function nodeOnlyDir() {
  const d = mkdtempSync(join(tmpdir(), 'cad-codex-node-'));
  symlinkSync(process.execPath, join(d, 'node'));
  return d;
}

/**
 * A stub `codex` that records its argv, whether either key reached it, and its
 * stdin, then acts out `mode`: `exit3`, `sleep`, `empty` (exit 0, no `-o` file)
 * or `ok` (exit 0, writes the `-o` file).
 * @param {string} mode
 */
function stubDir(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-codex-stub-'));
  const rec = join(dir, 'rec');
  mkdirSync(rec);
  const body = `#!/usr/bin/env node
const fs = require('fs');
const rec = ${JSON.stringify(rec)};
const argv = process.argv.slice(2);
fs.writeFileSync(rec + '/argv.json', JSON.stringify(argv));
fs.writeFileSync(rec + '/env.json', JSON.stringify({
  openai: 'OPENAI_API_KEY' in process.env, codex: 'CODEX_API_KEY' in process.env }));
fs.writeFileSync(rec + '/pid', String(process.pid));
fs.writeFileSync(rec + '/stdin.txt', fs.readFileSync(0));
const mode = ${JSON.stringify(mode)};
if (mode === 'exit3') process.exit(3);
if (mode === 'sleep') setTimeout(() => {}, 60000);
if (mode === 'ok') fs.writeFileSync(argv[argv.indexOf('-o') + 1], 'the final message\\n');
`;
  writeFileSync(join(dir, 'codex'), body);
  chmodSync(join(dir, 'codex'), 0o755);
  return { dir, rec };
}

/** Run the subcommand with `pathDirs` as the whole PATH and both keys set. */
function codexExec(pathDirs) {
  const cwd = mkdtempSync(join(tmpdir(), 'cad-codex-cwd-'));
  const started = Date.now();
  const r = spawnSync(process.execPath, [PLANNING, 'codex-exec'], {
    cwd, input: PROMPT, encoding: 'utf8', timeout: 30000,
    env: {
      PATH: pathDirs.join(':'),
      OPENAI_API_KEY: 'sentinel-openai', CODEX_API_KEY: 'sentinel-codex',
      CADENCE_TEST_SEAM: '1', CADENCE_CODEX_EXEC_TIMEOUT_MS: String(TEST_BOUND_MS),
    },
  });
  return { status: r.status, env: JSON.parse(r.stdout), ms: Date.now() - started };
}

const posix = process.platform !== 'win32';

test('missing: no codex on PATH starts nothing', { skip: !posix }, () => {
  const { rec } = stubDir('ok'); // written, but its directory is not on PATH
  const r = codexExec([nodeOnlyDir()]);
  assert.equal(r.status, 1);
  assert.equal(r.env.ok, false);
  assert.equal(r.env.reason, 'no-codex');
  assert.ok(r.env.hint);
  assert.equal(existsSync(join(rec, 'argv.json')), false);
});

test('non-zero exit carries the status', { skip: !posix }, () => {
  const { dir } = stubDir('exit3');
  const r = codexExec([dir, nodeOnlyDir()]);
  assert.equal(r.env.ok, false);
  assert.equal(r.env.reason, 'codex-exit');
  assert.equal(r.env.status, 3);
  assert.ok(r.env.hint);
});

test('timeout: killed at the bound, and the envelope comes back promptly', { skip: !posix }, () => {
  const { dir, rec } = stubDir('sleep');
  const r = codexExec([dir, nodeOnlyDir()]);
  assert.equal(r.env.ok, false);
  assert.equal(r.env.reason, 'codex-timeout');
  assert.equal(r.env.bound_ms, TEST_BOUND_MS);
  assert.ok(r.env.hint);
  assert.ok(r.ms < TEST_BOUND_MS + 5000, `returned after ${r.ms}ms`);
  // The stub is gone, not orphaned. Polled: the reaper may lag the exit.
  const pid = Number(readFileSync(join(rec, 'pid'), 'utf8'));
  let alive = true;
  for (let i = 0; i < 30 && alive; i++) {
    try { process.kill(pid, 0); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
    catch { alive = false; }
  }
  assert.equal(alive, false, `stub pid ${pid} outlived the kill`);
});

test('exit 0 with no final message is its own refusal', { skip: !posix }, () => {
  const { dir } = stubDir('empty');
  const r = codexExec([dir, nodeOnlyDir()]);
  assert.equal(r.env.ok, false);
  assert.equal(r.env.reason, 'no-output');
  assert.ok(r.env.hint);
});

test('the four reasons are distinct', () => {
  const reasons = ['no-codex', 'codex-exit', 'codex-timeout', 'no-output'];
  assert.equal(new Set(reasons).size, 4);
});

test('ok: argv pins the sandbox, the keys are dropped, stdin is the prompt', { skip: !posix }, () => {
  const { dir, rec } = stubDir('ok');
  const r = codexExec([dir, nodeOnlyDir()]);
  assert.equal(r.status, 0);
  assert.deepEqual(r.env, { ok: true, message: 'the final message\n' });

  const argv = JSON.parse(readFileSync(join(rec, 'argv.json'), 'utf8'));
  const joined = argv.join(' ');
  assert.equal(argv[0], 'exec');
  assert.match(joined, /(^| )-s workspace-write( |$)/);
  for (const a of ['--ignore-rules', 'approval_policy="never"',
    'sandbox_workspace_write.network_access=false', 'sandbox_workspace_write.writable_roots=[]']) {
    assert.ok(argv.includes(a), `argv lacks ${a}: ${joined}`);
  }
  for (const a of ['danger-full-access', '--dangerously-bypass-approvals-and-sandbox', '--worktree']) {
    assert.equal(joined.includes(a), false, `argv carries ${a}`);
  }

  assert.deepEqual(JSON.parse(readFileSync(join(rec, 'env.json'), 'utf8')), { openai: false, codex: false });
  assert.equal(readFileSync(join(rec, 'stdin.txt'), 'utf8'), PROMPT);
});
