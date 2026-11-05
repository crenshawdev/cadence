#!/usr/bin/env node
// @ts-check
// issue-check.mjs - what /cad-land step 1 says about the issues this branch references: which are open, or why we
// can't tell. Read-only, and apart from land-cleanup.mjs because it calls a networked CLI.
// `check` is ok:true on every path: an unreadable tracker is a degraded report, never a failed land.
// Actions: `report`, `skip` (one line to print) and `off` (git.issue_check false, so print nothing).
// The forge is what the git.forge_* keys say, never the origin URL; every call gets an explicit --repo.
// No git or forge stderr reaches the envelope: redactUrl only covers URLs, so a bare token would leak.
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
// --timeout-ms is `fallback` on purpose: a flag that could refuse could fail a land
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
import { refuseBase } from './lib/base-ref.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import {
  HOST_TABLE, teaLoginNameForHost, scanIssueRefs, partitionIssues, decideIssueCheck,
} from './lib/issue-decision.mjs';

/** Bounds each subprocess and the whole resolve loop alike, so a hung forge CLI can't hold up a land. */
const DEFAULT_TIMEOUT_MS = 10000;

/** Most per-issue lookups one land makes, for numbers the open-only forgejo list missed; past it, `unresolved`. */
const MAX_RESOLVES = 5;

/**
 * Run a command, bounded, and never throw. SIGKILL because a child that ignores SIGTERM outlives its own timeout.
 * Stderr is discarded, since the default passes a failing CLI's stderr to the terminal and leaks it.
 * A failure is a boolean and a signal, never the third party's text.
 * @param {string} bin @param {string[]} args
 * @param {{cwd:string, timeout:number}} opts
 * @returns {{ok:boolean, stdout:string, timedOut:boolean}}
 */
function run(bin, args, { cwd, timeout }) {
  try {
    const stdout = execFileSync(bin, args, {
      cwd, timeout, killSignal: 'SIGKILL', encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { ok: true, stdout, timedOut: false };
  } catch (e) {
    const err = /** @type {{stdout?:string, signal?:string}} */ (e || {});
    return {
      ok: false,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      timedOut: err.signal === 'SIGKILL',
    };
  }
}

/**
 * The logins in a `tea login list --output json` reading, or null when it isn't a list at all.
 * @param {string} text @returns {unknown[]|null}
 */
function teaLogins(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

/** The one not-reporting shape: a named line and nothing claimed about issues.
 *
 * `action` rides through as is: `skip` prints its reason and `off` prints nothing, and matching the reason text to tell
 * them apart would put a prose match in the caller's path.
 * `detail` is always null so no git or forge stderr can ride the envelope.
 * @param {{action:string, reason:string}} decision
 * @param {{host?:string|null, repo?:string|null, warnings:string[]}} rest */
function skip(decision, rest) {
  emit({
    ok: true, action: decision.action, reason: decision.reason,
    host: rest.host ?? null, repo: rest.repo ?? null,
    referenced: [], open: [],
    detail: null, warnings: rest.warnings,
  });
}

/** @param {string} dir @param {string|undefined} baseArg @param {number} timeout */
function check(dir, baseArg, timeout) {
  // warnings[] rides the envelope: a torn layer means this ran on defaults, including the one that turns the report on
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const enabled = git.issue_check !== false; // default true

  // checked before any subprocess so `false` spawns nothing, and answers `off`, not `skip`, so step 1 prints nothing
  let decision = decideIssueCheck({ enabled });
  if (decision.action !== 'query') return skip(decision, { warnings });

  // off the merge already done, no origin URL; host is null on github and gitlab
  const forge = {
    provider: git.forge_provider ?? null,
    repo: git.forge_repo ?? null,
    host: git.forge_host ?? null,
  };
  decision = decideIssueCheck({ enabled, forge });
  if (decision.action !== 'query') return skip(decision, { warnings });

  const host = forge.host;
  const repo = forge.repo;
  const row = HOST_TABLE[forge.provider];
  const bin = row.bin;

  // only forgejo needs a login name, and only tea can resolve one; guarded on PATH so a missing tea gets its own line
  let loginName;
  if (forge.provider === 'forgejo' && onPath(bin)) {
    const probe = run(bin, ['login', 'list', '--output', 'json'], { cwd: dir, timeout });
    loginName = probe.ok ? teaLoginNameForHost(teaLogins(probe.stdout), host) : null;
  }
  decision = decideIssueCheck({ enabled, forge, loginName });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const gitRead = (args) => run('git', ['-C', dir, ...args], { cwd: dir, timeout });
  const base = baseArg !== undefined ? baseArg : (git.base_branch || resolveProtectedBranches(git)[0]);
  // a committed git.base_branch shaped like a flag would be an option to `git log`, so skip, never fail the land
  const refused = refuseBase(dir, base, timeout);
  if (refused) return skip({ action: 'skip', reason: `${refused}: no tracker report` }, { host, repo, warnings });
  const log = gitRead(['log', `${base}..HEAD`, '--format=%B']);
  decision = decideIssueCheck({ enabled, forge, loginName, logOk: log.ok, bin });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  decision = decideIssueCheck({ enabled, forge, loginName, logOk: true, bin, cliPresent: onPath(bin) });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const call = run(bin, row.argv(repo, row.limit, loginName), { cwd: dir, timeout });
  decision = decideIssueCheck({
    enabled, forge, loginName, logOk: true, bin, cliPresent: true,
    exitOk: call.ok, timedOut: call.timedOut,
  });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const fetched = row.normalize(call.stdout, row.limit);
  decision = decideIssueCheck({
    enabled, forge, loginName, logOk: true, bin, cliPresent: true, exitOk: true, fetched,
  });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const numbers = scanIssueRefs(log.stdout);
  const part = partitionIssues(numbers, fetched);
  // null only over an incomplete fetch, which was already skipped; guards a reorder publishing an unreadable not-found
  if (part === null) {
    return skip({ action: 'skip', reason: `${bin} returned a response this seam could not read as a complete issue list: no tracker report` },
      { host, repo, warnings });
  }
  // one wall-clock budget for the whole loop: per-call bounds let MAX_RESOLVES calls each cost nearly the full bound
  // a fast nonzero exit doesn't end it: that's how tea says "no such issue", and the rest still need their states
  /** @type {Map<number, string>} */
  const resolved = new Map();
  if (row.resolve && repo) {
    const deadline = Date.now() + timeout;
    let spent = 0;
    for (const n of part.notFound) {
      if (spent >= MAX_RESOLVES) break;
      const left = deadline - Date.now();
      if (left <= 0) break;
      spent++;
      const one = run(bin, row.resolve.argv(repo, n, loginName), { cwd: dir, timeout: left });
      if (one.timedOut) break;
      const s = one.ok ? row.resolve.read(one.stdout, n) : null;
      if (s) resolved.set(n, s);
    }
  }
  // `unresolved`, never `not-found`, when the resolver didn't answer: nonzero exit is an absent issue or a failed read
  const state = (n) => {
    if (part.open.includes(n)) return 'open';
    if (part.closed.includes(n)) return 'closed';
    if (!row.resolve) return 'not-found';
    return resolved.get(n) || 'unresolved';
  };
  emit({
    ok: true, action: 'report', reason: decision.reason, host, repo,
    referenced: numbers.map((n) => ({ number: n, state: state(n) })),
    open: fetched.records.filter((r) => r.state === 'open').map((r) => r.number).sort((a, b) => a - b),
    detail: null, warnings,
  });
}


const argv = process.argv.slice(2);
const cmd = argv[0];
/** Declared rows. A subcommand's row wins over `'*'`, which holds the flags every arm takes. */
const ROWS = CONTRACTS['issue-check.mjs'];
/** One flag read through its declared row; the row owns the rule. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  if (cmd === 'check') {
    // --timeout-ms is `fallback`, so a bad one reads as absent; the int type carries no positivity, so that stays here
    const ms = arg('check', '--timeout-ms');
    const timeout = ms !== undefined && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
    // --dir refuses on empty, valueless or flag-shaped values before any spawn; absent means cwd
    check(arg('check', '--dir') || process.cwd(), arg('check', '--base'), timeout);
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: check [--dir <path>] [--base <name>] [--timeout-ms <n>]' });
  }
} catch (e) {
  // a `refuse` row's error has no message, so a valueless --dir would emit "[object Object]"
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
