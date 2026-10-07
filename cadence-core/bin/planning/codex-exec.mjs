// @ts-check
// planning/codex-exec.mjs - `codex-exec`: one `codex exec` run for a Codex-mode
// executor, answered as one envelope.
//
// Two ways to run it. Bare, it runs Codex in the foreground with the prompt on
// stdin and prints the envelope. The executor uses the other: `--start` reads
// the prompt, starts a detached runner that runs Codex the same way and writes
// the envelope to a job folder, and answers at once; `--wait` blocks up to
// about eight minutes and answers with the envelope, or with `running: true`
// and how far the run has got. That lets one run outlast the host's 600,000 ms
// Bash ceiling, bounded by `roles.cad-executor.codex.timeout_ms` (540,000 ms
// when unset). `--stop` kills the run and frees the tree.
//
// One run per working tree: a lease file in the temp folder, keyed by the
// tree's real path, names the job and the runner's pid. `--start` refuses
// `codex-busy` while that runner lives, and takes over a lease whose runner is
// dead. The runner kills Codex as `codex-abandoned` once no `--wait` has been
// attached for five minutes, so a wrapper that dies cannot leave Codex editing
// the tree for the rest of a long bound.
//
// The sandbox is pinned on the command line, where no Codex config file can
// loosen it: `workspace-write` (no network, `.git` read-only), no execpolicy
// `.rules` (a persisted `allow` runs a command outside the sandbox), approvals
// refused rather than waited on, network and web search off and no extra
// writable roots. The one way out is `roles.cad-executor.codex.sandbox` set to
// `danger-full-access` in the user-global Cadence config (a repository's value
// is stripped at the merge): then Codex runs unsandboxed, the way a hand-run
// `codex exec --sandbox danger-full-access` does, for builds that write caches
// outside the repository. Rules, approvals and web search stay pinned either
// way. The user's Codex config otherwise loads as set - model, effort,
// profile - because the shell is the tool this path needs, so its features
// stay on rather than being disabled the way the review transport disables them.
//
// The child never sees OPENAI_API_KEY, CODEX_API_KEY or CODEX_ACCESS_TOKEN, so
// it runs on the stored Codex login and bills that plan.
//
// Codex's stdout and stderr are discarded. They never enter the envelope or
// decide the verdict, and discarding them means a chatty run cannot fill a pipe
// buffer. The answer is the `-o` last-message file and the exit status.
//
// The refusals: `no-codex` (nothing started), `codex-exit` (non-zero, killed by
// a signal, or a runner that died without an answer), `codex-timeout` (killed
// at the bound), `no-output` (exit 0, no final message), `codex-abandoned` (no
// wait attached for five minutes), `codex-busy` (another live run holds the
// tree) and `no-run` (a wait or stop with no run held for the tree).
'use strict';

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, existsSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, ok } from './core.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';
import { emit } from '../lib/seam-io.mjs';
import { onPath } from '../lib/on-path.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

/** The wall-clock bound when `roles.cad-executor.codex.timeout_ms` is unset. */
const CODEX_EXEC_TIMEOUT_MS = 540_000;
/** The schema's range for that key; a value outside it warns and the default stands. */
const TIMEOUT_MIN_MS = 60_000;
const TIMEOUT_MAX_MS = 14_400_000;
/** How long one `--wait` blocks before it answers `running`: well inside 600,000 ms. */
const WAIT_SLICE_MS = 480_000;
/** How long a runner goes with no `--wait` attached before it kills Codex. */
const ABANDON_MS = 300_000;

/** The auth variables the child must never see. */
const DROPPED_KEYS = ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'];

const FULL_ACCESS = 'danger-full-access';
const PLANNING = fileURLToPath(new URL('../planning.mjs', import.meta.url));

/**
 * A number from the environment, honoured only behind the test seam.
 * @param {string} name @returns {number|null}
 */
function seamMs(name) {
  if (!testSeamOpen() || !(name in process.env)) return null;
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The sandbox and the bound the merged config names. Only the exact loosening
 * value loosens the sandbox: anything else, an unreadable config included, is
 * `workspace-write`. The merge's warnings ride every envelope this run answers
 * with, so a torn layer that kept the sandbox on is said, not silent.
 * @returns {{sandbox: 'workspace-write'|'danger-full-access', ms: number, warnings: string[]}}
 */
function runConfig() {
  /** @type {any} */
  let codex = {};
  /** @type {string[]} */
  let warnings;
  try {
    const { config, warnings: torn } = mergeLayers('.planning/config.json');
    codex = config?.roles?.['cad-executor']?.codex || {};
    warnings = [...torn];
  } catch (e) {
    warnings = [`config unreadable (${e instanceof Error ? e.message : String(e)}); defaults used`];
  }
  const sandbox = codex.sandbox === FULL_ACCESS ? FULL_ACCESS : 'workspace-write';
  let ms = CODEX_EXEC_TIMEOUT_MS;
  const t = codex.timeout_ms;
  if (Number.isInteger(t) && t >= TIMEOUT_MIN_MS && t <= TIMEOUT_MAX_MS) ms = t;
  else if (t !== undefined && t !== null) {
    warnings.push(`roles.cad-executor.codex.timeout_ms=${JSON.stringify(t)} is not an integer from `
      + `${TIMEOUT_MIN_MS} to ${TIMEOUT_MAX_MS}; the bound is ${CODEX_EXEC_TIMEOUT_MS}`);
  }
  const seam = seamMs('CADENCE_CODEX_EXEC_TIMEOUT_MS');
  return { sandbox, ms: seam ?? ms, warnings };
}

/**
 * The argv after `codex`. `-` reads the prompt from stdin. Never
 * `--dangerously-bypass-approvals-and-sandbox`, `--worktree`, `-m` or a profile.
 * @param {string} out the last-message file
 * @param {'workspace-write'|'danger-full-access'} sandbox
 * @returns {string[]}
 */
function codexExecArgs(out, sandbox) {
  const pins = sandbox === FULL_ACCESS ? []
    : ['-c', 'sandbox_workspace_write.network_access=false',
      '-c', 'sandbox_workspace_write.writable_roots=[]'];
  return ['exec', '-s', sandbox, '--ignore-rules',
    '-c', 'approval_policy="never"',
    ...pins,
    '-c', 'web_search=disabled',
    '-o', out, '-'];
}

/**
 * Run codex once. On POSIX it leads its own process group, so the bound kills
 * whatever it started too, and SIGINT, SIGTERM or SIGHUP on this process stops
 * the group rather than leaving Codex editing the tree on its own. A SIGKILL of
 * this process cannot be relayed: Codex then runs on until it exits, unless a
 * `--stop` kills it by the pid `onPid` recorded.
 * @param {string[]} args @param {number} ms
 * @param {{stdin?: 'inherit'|number, abandoned?: () => boolean, onPid?: (pid: number) => void}} [o]
 * @returns {Promise<{code: number|null, signal: string|null, timedOut?: boolean, abandoned?: boolean, spawnError?: any}>}
 */
function runCodex(args, ms, o = {}) {
  return new Promise((resolve) => {
    const posix = process.platform !== 'win32';
    const env = { ...process.env };
    for (const k of DROPPED_KEYS) delete env[k];
    const child = spawn('codex', args, { cwd: process.cwd(), env, detached: posix,
      stdio: [o.stdin ?? 'inherit', 'ignore', 'ignore'] });
    if (child.pid && o.onPid) o.onPid(child.pid);
    const kill = () => {
      try {
        if (posix && child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch { /* already gone */ }
    };
    /** @param {NodeJS.Signals} sig */
    const relay = (sig) => {
      kill();
      process.kill(process.pid, sig);
    };
    const SIGNALS = /** @type {NodeJS.Signals[]} */ (['SIGINT', 'SIGTERM', 'SIGHUP']);
    for (const s of SIGNALS) process.once(s, relay);
    let settled = false;
    /** @param {any} r @param {boolean} [killed] */
    const settle = (r, killed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watch) clearInterval(watch);
      for (const s of SIGNALS) process.removeListener(s, relay);
      if (killed) { kill(); child.unref(); }
      resolve(r);
    };
    const timer = setTimeout(() => settle({ code: null, signal: null, timedOut: true }, true), ms);
    const abandoned = o.abandoned;
    const watch = abandoned ? setInterval(() => {
      if (abandoned()) settle({ code: null, signal: null, abandoned: true }, true);
    }, 1000) : null;
    child.on('error', (e) => settle({ code: null, signal: null, spawnError: e }, true));
    child.on('exit', (code, signal) => settle({ code, signal }));
  });
}

/**
 * One Codex run, answered as the envelope object rather than printed.
 * @param {{sandbox: 'workspace-write'|'danger-full-access', ms: number, warnings: string[]}} cfg
 * @param {string} out the last-message file
 * @param {{stdin?: 'inherit'|number, abandoned?: () => boolean, onPid?: (pid: number) => void}} [o]
 * @returns {Promise<Record<string, any>>}
 */
async function execute(cfg, out, o) {
  const { sandbox, ms, warnings } = cfg;
  const said = warnings.length ? { warnings } : {};
  const run = await runCodex(codexExecArgs(out, sandbox), ms, o);
  if (run.timedOut) {
    return { ok: false, reason: 'codex-timeout', bound_ms: ms, ...said,
      detail: `codex exec ran past ${ms}ms and was killed`,
      hint: 'split the task into smaller ones, or raise roles.cad-executor.codex.timeout_ms, and'
        + ' re-run; whatever Codex changed before the kill is still in the working tree, uncommitted' };
  }
  if (run.abandoned) {
    return { ok: false, reason: 'codex-abandoned', ...said,
      detail: `no --wait was attached for ${abandonMs()}ms, so Codex was killed`,
      hint: 'whatever Codex changed before the kill is still in the working tree, uncommitted' };
  }
  if (run.spawnError || run.code !== 0) {
    const how = run.spawnError ? `could not start: ${run.spawnError.code || run.spawnError.message}`
      : run.code === null ? `was killed by signal ${run.signal}` : `exited with code ${run.code}`;
    return { ok: false, reason: 'codex-exit', status: run.code, ...said,
      ...(run.signal ? { signal: run.signal } : {}), detail: `codex exec ${how}`,
      hint: run.spawnError
        ? 'codex is on PATH but could not be started; on Windows Codex mode cannot launch an npm'
          + ' `codex.cmd` shim yet, so install a `codex.exe` or set roles.cad-executor.codex.enabled to false'
        : 'run `codex login status`, and check that the model your Codex config names is one'
          + ' your login serves; then re-run' };
  }
  let text = '';
  try { text = readFileSync(out, 'utf8'); } catch { /* no final message: refused below */ }
  if (!text.trim()) {
    return { ok: false, reason: 'no-output', detail: 'codex exec exited 0 with no final message',
      hint: 'read `git status` to see what Codex changed, then re-run the task', ...said };
  }
  return { ok: true, message: text, ...said };
}

const NO_CODEX_HINT = 'install the Codex CLI and run `codex login`, or set'
  + ' roles.cad-executor.codex.enabled to false to run the plan on the Claude executor';

/** The bare form: one foreground run, the prompt on this process's stdin. */
async function cmdForeground() {
  // Before any temp file or spawn: nothing has started when this refuses.
  if (!onPath('codex')) return fail('no-codex', 'codex is not on PATH', NO_CODEX_HINT);
  const root = mkdtempSync(join(tmpdir(), 'cad-codex-exec-'));
  try {
    return emit(await execute(runConfig(), join(root, 'last-message.txt')));
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** @returns {number} */
function abandonMs() { return seamMs('CADENCE_CODEX_ABANDON_MS') ?? ABANDON_MS; }

/** The lease file for the tree this process runs in. @returns {string} */
function leasePath() {
  let tree = process.cwd();
  try { tree = realpathSync(tree); } catch { /* the cwd as given */ }
  const key = createHash('sha256').update(tree).digest('hex').slice(0, 16);
  return join(tmpdir(), `cad-codex-lease-${key}.json`);
}

/** @param {string} file @returns {any} */
function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

/** @param {any} pid @returns {boolean} */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return /** @type {any} */ (e).code === 'EPERM'; }
}

/** Write a file whole or not at all. @param {string} file @param {string} text */
function writeWhole(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Remove a job folder and, when it still names this job, the lease. @param {string} lease @param {string} job */
function release(lease, job) {
  const held = readJson(lease);
  if (held && held.job === job) { try { unlinkSync(lease); } catch { /* gone */ } }
  try { rmSync(job, { recursive: true, force: true }); } catch { /* best effort */ }
}

/**
 * Kill a run's Codex group and its runner. SIGTERM first: the runner installs
 * its relay in the same tick it spawns Codex, so it either dies before Codex
 * exists or kills Codex's group itself. Only a runner that outlives that gets
 * SIGKILL, and then Codex's group by the pid the runner recorded.
 * @param {string} job @param {any} runnerPid
 */
async function killRun(job, runnerPid) {
  if (alive(runnerPid)) {
    try { process.kill(runnerPid, 'SIGTERM'); } catch { /* already gone */ }
    for (let i = 0; i < 30 && alive(runnerPid); i++) await new Promise((r) => setTimeout(r, 100));
  }
  const codexPid = Number(readJson(join(job, 'run.json'))?.codex_pid);
  for (const target of [codexPid > 0 ? -codexPid : 0, alive(runnerPid) ? runnerPid : 0]) {
    if (!target) continue;
    try { process.kill(target, 'SIGKILL'); } catch { /* already gone */ }
  }
}

/** How many paths `git status` lists, for a running answer; null when git cannot say. */
function dirtyPaths() {
  const r = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'],
    { encoding: 'utf8', timeout: 30000 });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean).length : null;
}

/** @param {any} held the lease @returns {Record<string, any>} */
function running(held) {
  const n = dirtyPaths();
  return { ok: true, running: true, job: held.job,
    elapsed_ms: Math.max(0, Date.now() - Number(held.started || Date.now())),
    bound_ms: held.bound_ms, ...(n === null ? {} : { dirty_paths: n }),
    ...(held.warnings && held.warnings.length ? { warnings: held.warnings } : {}) };
}

/** `--start`: take the tree's lease, start the runner, answer `running` at once. */
async function cmdStart() {
  if (!onPath('codex')) return fail('no-codex', 'codex is not on PATH', NO_CODEX_HINT);
  const lease = leasePath();
  const held = readJson(lease);
  if (held && alive(held.pid)) {
    return emit({ ok: false, reason: 'codex-busy', job: held.job, pid: held.pid,
      detail: 'another Codex run holds this working tree',
      hint: 'wait for it with `codex-exec --wait`, or end it with `codex-exec --stop`' });
  }
  if (held) release(lease, held.job);
  else if (existsSync(lease)) { try { unlinkSync(lease); } catch { /* gone */ } }
  const cfg = runConfig();
  const job = mkdtempSync(join(tmpdir(), 'cad-codex-job-'));
  writeFileSync(join(job, 'prompt.md'), readFileSync(0));
  writeFileSync(join(job, 'run.json'), JSON.stringify(cfg));
  let fd;
  try { fd = openSync(lease, 'wx'); } catch {
    rmSync(job, { recursive: true, force: true });
    return emit({ ok: false, reason: 'codex-busy', detail: 'another run took this working tree first',
      hint: 'wait for it with `codex-exec --wait`, or end it with `codex-exec --stop`' });
  }
  closeSync(fd);
  const runner = spawn(process.execPath, [PLANNING, 'codex-exec', '--run', job],
    { cwd: process.cwd(), env: process.env, detached: true, stdio: 'ignore' });
  if (!runner.pid) {
    release(lease, job);
    return fail('internal', 'the runner did not start', 're-run; if it repeats, run codex-exec bare');
  }
  runner.unref();
  const record = { job, pid: runner.pid, started: Date.now(), bound_ms: cfg.ms, warnings: cfg.warnings };
  writeWhole(lease, JSON.stringify(record));
  return emit(running(record));
}

/** `--run <job>`: the detached runner. Writes the envelope; prints nothing. @param {string} job */
async function cmdRun(job) {
  const cfg = readJson(join(job, 'run.json'));
  if (!cfg) return;
  const fd = openSync(join(job, 'prompt.md'), 'r');
  const waiting = join(job, 'waiting');
  let seen = Date.now();
  const abandoned = () => {
    if (alive(Number(readJson(waiting)))) seen = Date.now();
    return Date.now() - seen > abandonMs();
  };
  const onPid = (/** @type {number} */ pid) =>
    writeWhole(join(job, 'run.json'), JSON.stringify({ ...cfg, codex_pid: pid }));
  let envelope;
  try {
    envelope = await execute(cfg, join(job, 'last-message.txt'), { stdin: fd, abandoned, onPid });
  } catch (e) {
    envelope = { ok: false, reason: 'codex-exit', status: null,
      detail: `the runner failed: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    closeSync(fd);
  }
  writeWhole(join(job, 'envelope.json'), JSON.stringify(envelope));
}

/** `--wait`: the run's envelope, or `running` after one slice. */
async function cmdWait() {
  const lease = leasePath();
  const held = readJson(lease);
  if (!held || typeof held.job !== 'string') {
    return fail('no-run', 'no Codex run is held for this working tree',
      'start one with `codex-exec --start`; a finished run is answered once, by the wait that saw it end');
  }
  const answer = join(held.job, 'envelope.json');
  const waiting = join(held.job, 'waiting');
  try { writeFileSync(waiting, String(process.pid)); } catch { /* job gone: answered below */ }
  const slice = seamMs('CADENCE_CODEX_WAIT_MS') ?? WAIT_SLICE_MS;
  const until = Date.now() + slice;
  for (;;) {
    const envelope = readJson(answer);
    if (envelope) { release(lease, held.job); return emit(envelope); }
    if (!alive(held.pid)) {
      const late = readJson(answer);
      release(lease, held.job);
      return emit(late || { ok: false, reason: 'codex-exit', status: null,
        detail: 'the runner ended without an answer',
        hint: 'read `git status` to see what Codex changed, then re-run the task' });
    }
    if (Date.now() >= until) {
      try { unlinkSync(waiting); } catch { /* gone */ }
      return emit(running(held));
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** `--stop`: kill the tree's run and free the tree. */
async function cmdStop() {
  const lease = leasePath();
  const held = readJson(lease);
  if (!held || typeof held.job !== 'string') {
    return fail('no-run', 'no Codex run is held for this working tree', 'nothing to stop');
  }
  await killRun(held.job, held.pid);
  release(lease, held.job);
  return ok({ stopped: true, job: held.job,
    hint: 'whatever Codex changed before the stop is still in the working tree, uncommitted' });
}

/** @param {any} opts */
async function cmdCodexExec(opts) {
  const modes = ['start', 'wait', 'stop', 'run'].filter((k) => opts[k] !== undefined);
  if (modes.length > 1) return fail('usage', `codex-exec takes one of --start, --wait, --stop, not ${modes.join(' and ')}`);
  if (opts.start) return cmdStart();
  if (opts.wait) return cmdWait();
  if (opts.stop) return cmdStop();
  if (opts.run !== undefined) {
    if (typeof opts.run !== 'string' || !opts.run) return fail('usage', '--run takes a job folder');
    return cmdRun(opts.run);
  }
  return cmdForeground();
}

/** The handler `COMMANDS` calls. Async, so it owns its own internal catch. */
/** @param {any} opts */
function cmdCodexExecSafe(opts) {
  cmdCodexExec(opts || {}).catch((err) => fail('internal', err instanceof Error ? err.message : String(err)));
}

export { cmdCodexExecSafe as cmdCodexExec };
