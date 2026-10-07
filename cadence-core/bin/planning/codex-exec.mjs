// @ts-check
// planning/codex-exec.mjs - `codex-exec`: one `codex exec` run for a Codex-mode
// executor, answered as one envelope.
//
// The prompt is this process's stdin, passed straight through to the child, and
// Codex works in this process's cwd. The run is bounded below the host's
// 600,000 ms Bash ceiling, so a kill still leaves time to print the envelope.
//
// The sandbox is pinned on the command line, where no config file can loosen
// it: `workspace-write` (no network, `.git` read-only), no execpolicy `.rules`
// (a persisted `allow` runs a command outside the sandbox), approvals refused
// rather than waited on, network off and no extra writable roots. The user's
// Codex config otherwise loads as set - model, effort, profile - because the
// shell is the tool this path needs, so nothing is disabled the way the review
// transport disables it.
//
// The child never sees OPENAI_API_KEY, CODEX_API_KEY or CODEX_ACCESS_TOKEN, so
// it runs on the stored Codex login and bills that plan.
//
// Codex's stdout and stderr are discarded. They never enter the envelope or
// decide the verdict, and discarding them means a chatty run cannot fill a pipe
// buffer. The answer is the `-o` last-message file and the exit status.
//
// Four refusals, one per way a run fails: `no-codex` (nothing started),
// `codex-exit` (non-zero or killed by a signal), `codex-timeout` (killed at the
// bound) and `no-output` (exit 0, no final message).
'use strict';

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { emit } from '../lib/seam-io.mjs';
import { onPath } from '../lib/on-path.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

/** The wall-clock bound, `review.request_timeout_ms`'s default margin. */
const CODEX_EXEC_TIMEOUT_MS = 540_000;

/** The auth variables the child must never see. */
const DROPPED_KEYS = ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'];

/**
 * The argv after `codex`. `-` reads the prompt from stdin. Never
 * `danger-full-access`, `--dangerously-bypass-approvals-and-sandbox`,
 * `--worktree`, `-m` or a profile.
 * @param {string} out the last-message file
 * @returns {string[]}
 */
function codexExecArgs(out) {
  return ['exec', '-s', 'workspace-write', '--ignore-rules',
    '-c', 'approval_policy="never"',
    '-c', 'sandbox_workspace_write.network_access=false',
    '-c', 'sandbox_workspace_write.writable_roots=[]',
    '-o', out, '-'];
}

/** The bound, overridable only behind the test seam. @returns {number} */
function boundMs() {
  if (testSeamOpen() && 'CADENCE_CODEX_EXEC_TIMEOUT_MS' in process.env) {
    const n = Number(process.env.CADENCE_CODEX_EXEC_TIMEOUT_MS);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return CODEX_EXEC_TIMEOUT_MS;
}

/**
 * Run codex once. On POSIX it leads its own process group, so the bound kills
 * whatever it started too, and SIGINT, SIGTERM or SIGHUP on this process stops
 * the group rather than leaving Codex editing the tree on its own. A SIGKILL of
 * this process cannot be relayed: Codex then runs on until it exits.
 * @param {string[]} args @param {number} ms
 * @returns {Promise<{code: number|null, signal: string|null, timedOut?: boolean, spawnError?: any}>}
 */
function runCodex(args, ms) {
  return new Promise((resolve) => {
    const posix = process.platform !== 'win32';
    const env = { ...process.env };
    for (const k of DROPPED_KEYS) delete env[k];
    const child = spawn('codex', args, { cwd: process.cwd(), env, detached: posix,
      stdio: ['inherit', 'ignore', 'ignore'] });
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
      for (const s of SIGNALS) process.removeListener(s, relay);
      if (killed) { kill(); child.unref(); }
      resolve(r);
    };
    const timer = setTimeout(() => settle({ code: null, signal: null, timedOut: true }, true), ms);
    child.on('error', (e) => settle({ code: null, signal: null, spawnError: e }, true));
    child.on('exit', (code, signal) => settle({ code, signal }));
  });
}

async function cmdCodexExec() {
  // Before any temp file or spawn: nothing has started when this refuses.
  if (!onPath('codex')) {
    return fail('no-codex', 'codex is not on PATH',
      'install the Codex CLI and run `codex login`, or set roles.cad-executor.codex.enabled to'
      + ' false to run the plan on the Claude executor');
  }
  const root = mkdtempSync(join(tmpdir(), 'cad-codex-exec-'));
  try {
    const out = join(root, 'last-message.txt');
    const ms = boundMs();
    const run = await runCodex(codexExecArgs(out), ms);
    if (run.timedOut) {
      return emit({ ok: false, reason: 'codex-timeout', bound_ms: ms,
        detail: `codex exec ran past ${ms}ms and was killed`,
        hint: 'split the task into smaller ones and re-run; whatever Codex changed before the kill'
          + ' is still in the working tree, uncommitted' });
    }
    if (run.spawnError || run.code !== 0) {
      const how = run.spawnError ? `could not start: ${run.spawnError.code || run.spawnError.message}`
        : run.code === null ? `was killed by signal ${run.signal}` : `exited with code ${run.code}`;
      return emit({ ok: false, reason: 'codex-exit', status: run.code,
        ...(run.signal ? { signal: run.signal } : {}), detail: `codex exec ${how}`,
        hint: run.spawnError
          ? 'codex is on PATH but could not be started; on Windows Codex mode cannot launch an npm'
            + ' `codex.cmd` shim yet, so install a `codex.exe` or set roles.cad-executor.codex.enabled to false'
          : 'run `codex login status`, and check that the model your Codex config names is one'
            + ' your login serves; then re-run' });
    }
    let text = '';
    try { text = readFileSync(out, 'utf8'); } catch { /* no final message: refused below */ }
    if (!text.trim()) {
      return fail('no-output', 'codex exec exited 0 with no final message',
        'read `git status` to see what Codex changed, then re-run the task');
    }
    return ok({ message: text });
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** The handler `COMMANDS` calls. Async, so it owns its own internal catch. */
function cmdCodexExecSafe() {
  cmdCodexExec().catch((err) => fail('internal', err instanceof Error ? err.message : String(err)));
}

export { cmdCodexExecSafe as cmdCodexExec };
