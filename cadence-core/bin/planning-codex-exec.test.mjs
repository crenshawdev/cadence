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
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
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
if (mode === 'slow') setTimeout(() =>
  fs.writeFileSync(argv[argv.indexOf('-o') + 1], 'the final message\\n'), 2000);
`;
  writeFileSync(join(dir, 'codex'), body);
  chmodSync(join(dir, 'codex'), 0o755);
  return { dir, rec };
}

/** A config layer file holding `codex` as the executor's codex block. @param {any} codex */
function layer(codex) {
  const d = mkdtempSync(join(tmpdir(), 'cad-codex-cfg-'));
  mkdirSync(join(d, '.planning'));
  const f = join(d, '.planning', 'config.json');
  writeFileSync(f, JSON.stringify({ roles: { 'cad-executor': { codex } } }));
  return { dir: d, file: f };
}

/**
 * Run the subcommand with `pathDirs` as the whole PATH and both keys set. The
 * user-global layer is `globalFile` (default: a path that does not exist, so no
 * real ~/.claude config reaches a test), and `cwd` may carry a repo layer.
 * @param {string[]} pathDirs @param {{cwd?: string, globalFile?: string}} [o]
 */
function codexExec(pathDirs, o = {}) {
  const cwd = o.cwd || mkdtempSync(join(tmpdir(), 'cad-codex-cwd-'));
  const started = Date.now();
  /** @type {Record<string, string>} */
  const env = {
    PATH: pathDirs.join(':'),
    OPENAI_API_KEY: 'sentinel-openai', CODEX_API_KEY: 'sentinel-codex',
    CADENCE_TEST_SEAM: '1', CADENCE_CODEX_EXEC_TIMEOUT_MS: String(TEST_BOUND_MS),
    CADENCE_GLOBAL_CONFIG: o.globalFile || join(cwd, 'no-global-config.json'),
    ...(o.env || {}),
  };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  const r = spawnSync(process.execPath, [PLANNING, 'codex-exec', ...(o.flags || [])], {
    cwd, input: PROMPT, encoding: 'utf8', timeout: 30000, env,
  });
  return { status: r.status, env: JSON.parse(r.stdout), ms: Date.now() - started, cwd };
}

/** Block this thread for `ms`. @param {number} ms */
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Whether `pid` is gone, polled: the reaper may lag a kill. @param {number} pid */
function gone(pid) {
  for (let i = 0; i < 50; i++) {
    try { process.kill(pid, 0); nap(100); } catch { return true; }
  }
  return false;
}

/**
 * A detached run's fixture: one cwd, one private TMPDIR (so the lease and the job
 * folders are this test's alone), and a caller for each flag.
 * @param {string} stubMode @param {Record<string, string|undefined>} [env]
 */
function detached(stubMode, env = {}) {
  const stub = stubDir(stubMode);
  const cwd = mkdtempSync(join(tmpdir(), 'cad-codex-cwd-'));
  const tmp = mkdtempSync(join(tmpdir(), 'cad-codex-tmp-'));
  const call = (/** @type {string} */ flag, /** @type {any} */ more = {}) => codexExec(
    [stub.dir, nodeOnlyDir()],
    { cwd, flags: [flag], ...more, env: { TMPDIR: tmp, CADENCE_CODEX_WAIT_MS: '400', ...env, ...(more.env || {}) } });
  return { stub, cwd, tmp, call };
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

test('the seven reasons are distinct', () => {
  const reasons = ['no-codex', 'codex-exit', 'codex-timeout', 'no-output', 'codex-abandoned',
    'codex-busy', 'no-run'];
  assert.equal(new Set(reasons).size, 7);
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
    'sandbox_workspace_write.network_access=false', 'sandbox_workspace_write.writable_roots=[]',
    'web_search=disabled']) {
    assert.ok(argv.includes(a), `argv lacks ${a}: ${joined}`);
  }
  for (const a of ['danger-full-access', '--dangerously-bypass-approvals-and-sandbox', '--worktree']) {
    assert.equal(joined.includes(a), false, `argv carries ${a}`);
  }

  assert.deepEqual(JSON.parse(readFileSync(join(rec, 'env.json'), 'utf8')), { openai: false, codex: false });
  assert.equal(readFileSync(join(rec, 'stdin.txt'), 'utf8'), PROMPT);
});

test('full access: the user-global sandbox runs codex unsandboxed, rules, approvals and web search still pinned', { skip: !posix }, () => {
  const { dir, rec } = stubDir('ok');
  const global = layer({ sandbox: 'danger-full-access' });
  const r = codexExec([dir, nodeOnlyDir()], { globalFile: global.file });
  assert.deepEqual(r.env, { ok: true, message: 'the final message\n' });
  const argv = JSON.parse(readFileSync(join(rec, 'argv.json'), 'utf8'));
  const joined = argv.join(' ');
  assert.match(joined, /(^| )-s danger-full-access( |$)/);
  assert.equal(joined.includes('workspace-write'), false, joined);
  for (const a of ['--ignore-rules', 'approval_policy="never"', 'web_search=disabled']) {
    assert.ok(argv.includes(a), `argv lacks ${a}: ${joined}`);
  }
  for (const a of ['--dangerously-bypass-approvals-and-sandbox', '--worktree']) {
    assert.equal(joined.includes(a), false, `argv carries ${a}`);
  }
  assert.deepEqual(JSON.parse(readFileSync(join(rec, 'env.json'), 'utf8')), { openai: false, codex: false });
});

test('full access: a repository config cannot turn it on', { skip: !posix }, () => {
  const { dir, rec } = stubDir('ok');
  const repo = layer({ sandbox: 'danger-full-access' });
  const r = codexExec([dir, nodeOnlyDir()], { cwd: repo.dir });
  assert.equal(r.env.ok, true);
  const joined = JSON.parse(readFileSync(join(rec, 'argv.json'), 'utf8')).join(' ');
  assert.match(joined, /(^| )-s workspace-write( |$)/);
  assert.equal(joined.includes('danger-full-access'), false, joined);
});

test('full access: any other value reads as workspace-write', { skip: !posix }, () => {
  for (const sandbox of ['full', 'DANGER-FULL-ACCESS', true, null]) {
    const { dir, rec } = stubDir('ok');
    const global = layer({ sandbox });
    const r = codexExec([dir, nodeOnlyDir()], { globalFile: global.file });
    assert.equal(r.env.ok, true);
    const joined = JSON.parse(readFileSync(join(rec, 'argv.json'), 'utf8')).join(' ');
    assert.match(joined, /(^| )-s workspace-write( |$)/, `${JSON.stringify(sandbox)}: ${joined}`);
    assert.ok(joined.includes('sandbox_workspace_write.network_access=false'), joined);
  }
});

// --- the detached run: --start, --wait, --stop ---

test('detached: --start answers running at once and --wait answers the run\'s envelope', { skip: !posix }, () => {
  const f = detached('slow', { CADENCE_CODEX_EXEC_TIMEOUT_MS: '20000' });
  const start = f.call('--start');
  assert.equal(start.env.ok, true);
  assert.equal(start.env.running, true);
  assert.equal(start.env.bound_ms, 20000);
  assert.ok(start.ms < 5000, `start took ${start.ms}ms`);
  const seen = [];
  let r = start;
  for (let i = 0; i < 40 && r.env.running; i++) { r = f.call('--wait'); seen.push(r.env); }
  assert.ok(seen.some((e) => e.running && Number.isInteger(e.elapsed_ms)), JSON.stringify(seen));
  assert.deepEqual(r.env, { ok: true, message: 'the final message\n' });
  assert.equal(readFileSync(join(f.stub.rec, 'stdin.txt'), 'utf8'), PROMPT);
  assert.deepEqual(JSON.parse(readFileSync(join(f.stub.rec, 'env.json'), 'utf8')), { openai: false, codex: false });
  // Answered once: the lease went with the answer.
  assert.equal(f.call('--wait').env.reason, 'no-run');
});

test('detached: a second --start is refused while the run lives, and --stop ends it', { skip: !posix }, () => {
  const f = detached('sleep', { CADENCE_CODEX_EXEC_TIMEOUT_MS: '20000' });
  assert.equal(f.call('--start').env.running, true);
  let pid = 0;
  for (let i = 0; i < 50 && !pid; i++) {
    try { pid = Number(readFileSync(join(f.stub.rec, 'pid'), 'utf8')); } catch { nap(100); }
  }
  const busy = f.call('--start');
  assert.equal(busy.env.ok, false);
  assert.equal(busy.env.reason, 'codex-busy');
  assert.ok(busy.env.hint);
  const stop = f.call('--stop');
  assert.equal(stop.env.ok, true);
  assert.equal(stop.env.stopped, true);
  assert.ok(gone(pid), `codex pid ${pid} outlived --stop`);
  assert.equal(f.call('--wait').env.reason, 'no-run');
  assert.equal(f.call('--stop').env.reason, 'no-run');
});

test('detached: a run nobody waits on is killed as codex-abandoned', { skip: !posix }, () => {
  const f = detached('sleep', { CADENCE_CODEX_EXEC_TIMEOUT_MS: '20000', CADENCE_CODEX_ABANDON_MS: '1500' });
  assert.equal(f.call('--start').env.running, true);
  nap(4000);
  const r = f.call('--wait', { env: { CADENCE_CODEX_WAIT_MS: '5000' } });
  assert.equal(r.env.ok, false);
  assert.equal(r.env.reason, 'codex-abandoned');
  const pid = Number(readFileSync(join(f.stub.rec, 'pid'), 'utf8'));
  assert.ok(gone(pid), `codex pid ${pid} outlived the abandon`);
});

test('detached: the bound still kills the run as codex-timeout', { skip: !posix }, () => {
  const f = detached('sleep');
  assert.equal(f.call('--start').env.bound_ms, TEST_BOUND_MS);
  const r = f.call('--wait', { env: { CADENCE_CODEX_WAIT_MS: '10000' } });
  assert.equal(r.env.reason, 'codex-timeout');
  assert.equal(r.env.bound_ms, TEST_BOUND_MS);
});

test('detached: a dead runner\'s lease is taken over, not refused', { skip: !posix }, () => {
  const f = detached('slow', { CADENCE_CODEX_EXEC_TIMEOUT_MS: '20000' });
  // The lease a runner killed by SIGKILL leaves behind: its pid is gone and its
  // job folder still holds an answer nobody read.
  const deadPid = spawnSync(process.execPath, ['-e', '0']).pid;
  const oldJob = mkdtempSync(join(f.tmp, 'cad-codex-job-'));
  writeFileSync(join(oldJob, 'envelope.json'), JSON.stringify({ ok: true, message: 'stale' }));
  const key = createHash('sha256').update(realpathSync(f.cwd)).digest('hex').slice(0, 16);
  writeFileSync(join(f.tmp, `cad-codex-lease-${key}.json`),
    JSON.stringify({ job: oldJob, pid: deadPid, started: Date.now(), bound_ms: 1 }));
  const again = f.call('--start');
  assert.equal(again.env.running, true, JSON.stringify(again.env));
  assert.notEqual(again.env.job, oldJob);
  assert.equal(existsSync(oldJob), false);
  let r = again;
  for (let i = 0; i < 40 && r.env.running; i++) r = f.call('--wait');
  assert.deepEqual(r.env, { ok: true, message: 'the final message\n' });
});

test('detached: two modes at once is a usage refusal', { skip: !posix }, () => {
  const f = detached('ok');
  const r = codexExec([f.stub.dir, nodeOnlyDir()], { cwd: f.cwd, flags: ['--start', '--wait'],
    env: { TMPDIR: f.tmp } });
  assert.equal(r.env.reason, 'usage');
});

test('bound: roles.cad-executor.codex.timeout_ms sets it, and a value out of range warns', { skip: !posix }, () => {
  for (const [timeout, want, warns] of [[1200000, 1200000, false], [5, 540000, true], ['x', 540000, true]]) {
    const f = detached('sleep', { CADENCE_CODEX_EXEC_TIMEOUT_MS: undefined });
    const global = layer({ timeout_ms: timeout });
    const r = f.call('--start', { globalFile: global.file });
    assert.equal(r.env.bound_ms, want, JSON.stringify(r.env));
    assert.equal((r.env.warnings || []).some((w) => w.includes('timeout_ms')), warns, JSON.stringify(r.env));
    f.call('--stop');
  }
});
