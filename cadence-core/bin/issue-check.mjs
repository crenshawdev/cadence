#!/usr/bin/env node
// @ts-check
// issue-check.mjs - the workflow-facing seam over lib/issue-decision.mjs. It
// ADVISES /cad-land step 1 which issues this branch's commits reference, which
// of them are still open, and which issues are open on the detected host - or,
// on every path that cannot answer, the ONE line step 1 prints before carrying
// on (LND-01). Like land-cleanup.mjs it only advises, and it is READ-ONLY in
// the strongest sense available: no argv it can build closes, reopens or
// comments on an issue. Landing closes nothing; closing stays an explicit ask.
// One JSON line on stdout, and the `check` arm is ok:true on EVERY path
// including its failures - a tracker that cannot be read is a degraded report,
// never a failed land. Three actions: `report` (the sentence), `skip` (ONE
// degradation line the caller prints) and `off` (git.issue_check false - the
// caller prints nothing at all).
//
// WHY THIS IS NOT land-cleanup.mjs. That seam is advisory over GIT state this
// machine already holds: it can be wrong only if the repo changed under it.
// This one reads a THIRD-PARTY CLI over a network, which is a different failure
// and freshness class - absent binary, missing login, nonzero exit, a hang, a
// paged response that looks complete - and each of those needs its own named
// line. Folding them into a seam whose other subcommand gates an unattended
// merge would put a network timeout on the same envelope as a merge decision.
//
// Subcommand (one, printing one JSON line):
//   check [--dir <path>] [--base <name>] [--timeout-ms <n>]
//     --dir is the planning root AND the repository every read is bound to
//     (default cwd). Base resolves from --base, else git.base_branch, else the
//     first git.protected_branches entry - the same order land-cleanup.mjs
//     cleanup uses. --timeout-ms overrides DEFAULT_TIMEOUT_MS below.
//
// THE CALL IS BOUND TO THE REPOSITORY --dir NAMES, TWO WAYS TOGETHER: `cwd:
// dir` on the spawn AND the explicit `--repo owner/name` selector parsed from
// the origin URL. Neither alone is enough. `gh` and `glab` infer the repo from
// the cwd's remote, so cwd alone reports another project's tracker the moment
// --dir points elsewhere; `tea` infers nothing at all and exits `Error: remote
// repository required: specify id via --repo` outside a configured checkout
// (observed in this repo, 2026-08-15). The selector is asserted directly in
// issue-check.test.mjs against a stub that records its argv.
//
// NO THIRD-PARTY OUTPUT REACHES THE ENVELOPE. A failed git read and a failed
// forge CLI are reported by their own named reason line and NOTHING else: the
// child's stderr is discarded at the spawn, and `detail` is null on every arm
// of `check`. redactUrl covers credentials in URL POSITION and nothing else, so
// a diagnostic carrying a bare token (`Authorization: Bearer ...`,
// `GLAB_TOKEN=glpat-...`) would pass through it intact onto a line /cad-land
// prints - and the reason already says what went wrong, so the raw text buys
// nothing to pay for that. Not a second regex; no third-party bytes at all.
//
// NO CADENCE ENV OVERRIDE AND NO --cli-dir. The forge binary is resolved on
// PATH, in ONE place, because PATH is the OS's own lookup: a test injects a
// stub by prepending a directory to the child's PATH and the PRODUCTION
// resolver is what runs. A test-only override honoured in production is exactly
// what review-provider.mjs:445-460 and EXP-01 refused.
'use strict';

import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { join, delimiter } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { optionalFlag } from './lib/seam-input.mjs';
import { requireInt } from './lib/require-int.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import {
  HOST_TABLE, classifyOrigin, scanIssueRefs, partitionIssues, decideIssueCheck,
} from './lib/issue-decision.mjs';

/**
 * The bound on EVERY subprocess this seam starts. A land must not be delayed by
 * a forge CLI that never returns (LND-01, criterion 4), and this is the first
 * remote state /cad-land reads that is not git. It is a named constant over a
 * `--timeout-ms` flag rather than a config key on purpose: the milestone
 * licenses exactly one new key, and a bound reachable at the call site is
 * directly testable where a buried hardcoded one is not.
 */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * The most per-issue resolves one land may make, on the hosts whose HOST_TABLE
 * row carries a `resolve` (forgejo alone today). The list call there names only
 * OPEN issues, because the server clamps a `--state all` page at 50 rows and an
 * honest incomplete read is all this seam could return otherwise - so a
 * referenced number the list did not answer needs one extra bounded call to
 * tell "closed" from "never existed".
 *
 * A named constant beside DEFAULT_TIMEOUT_MS rather than a config key, for the
 * same reason the bound above is one: a value reachable at the call site is
 * directly testable, and this requirement licenses no new key. Anything past
 * the cap reports `unresolved`, which is an honest non-answer.
 */
const MAX_RESOLVES = 5;

/**
 * Run a command, bounded, and never throw. `killSignal: 'SIGKILL'` because a
 * child that ignores SIGTERM would otherwise outlive its own timeout - the
 * whole point of the bound is that nothing the child does can extend it.
 *
 * The child's stderr is DISCARDED rather than captured (see the header): with
 * no `stdio` given, execFileSync would pass a failing CLI's stderr straight
 * through to /cad-land's terminal, which is the same leak as putting it on the
 * envelope. So the failure is reported as a boolean and a signal, never as the
 * third party's own text.
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

/** Is `bin` an executable on the CHILD's PATH? The one resolution site.
 * @param {string} bin @returns {boolean} */
function onPath(bin) {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    try { accessSync(join(dir, bin), constants.X_OK); return true; } catch { /* next */ }
  }
  return false;
}

/**
 * Every login a `tea login list --output json` reading names, as its NAME plus
 * the hosts that identify it - the login's own name, its API url's hostname and
 * its ssh host, because a login identifies its forge by all three and
 * cad-land's rule is "a matching login". Returns null when the reading cannot
 * be parsed at all, which classifyOrigin reads as "tea could not be consulted"
 * rather than "no login".
 *
 * The NAME rides along rather than being flattened into the host list because
 * matching a login is only half the seam's guard: `tea` resolves an unqualified
 * `--repo <owner>/<name>` in config file order, so the call has to be bound
 * back to the login that matched with `--login <name>` (D-07). A reading that
 * names hosts but no name is therefore dropped by classifyOrigin - a login
 * whose call cannot be bound may not decide the verdict. The hosts are
 * lowercased for comparison; the name is kept EXACTLY as tea reports it,
 * because it is spent as an argv value.
 * @param {string} text @returns {{name:string, hosts:string[]}[]|null}
 */
function teaLogins(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const logins = [];
  for (const login of parsed) {
    if (!login || typeof login !== 'object') continue;
    const hosts = [];
    for (const field of ['name', 'ssh_host']) {
      if (typeof login[field] === 'string') hosts.push(login[field].toLowerCase());
    }
    if (typeof login.url === 'string') {
      const m = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/:]+)/.exec(login.url);
      if (m) hosts.push(m[1].toLowerCase());
    }
    logins.push({ name: typeof login.name === 'string' ? login.name : '', hosts });
  }
  return logins;
}

/** The one not-reporting shape: a named line, and NOTHING claimed about issues.
 *
 * The core's `action` rides straight through, because the two non-query answers
 * mean different things to the caller: `skip` is a degradation whose reason
 * step 1 prints as one line, `off` is the user's own switch and step 1 prints
 * NOTHING for it. Deciding that here by inspecting the reason TEXT would put a
 * prose match in the caller's path; see decideIssueCheck's header.
 *
 * `detail` is always null on this arm, and that is the security property: the
 * reason line already names the degradation, so no git or forge-CLI stderr is
 * carried here for it to add to. See the header.
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
  // warnings[] rides the envelope: git.issue_check, git.base_branch and the
  // protected list all come off this merge, so a torn layer means this report
  // ran on DEFAULTS - including the default that turns the report on - rather
  // than on the user's settings.
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const enabled = git.issue_check !== false; // default true

  // The key is consulted before ANY subprocess: `false` must spawn no forge
  // CLI at all, not merely print nothing (the test asserts that with a marker
  // file every stub writes to). It answers `off` rather than `skip`, which is
  // what makes step 1 print nothing at all instead of a tracker line.
  let decision = decideIssueCheck({ enabled });
  if (decision.action !== 'query') return skip(decision, { warnings });

  const gitRead = (args) => run('git', ['-C', dir, ...args], { cwd: dir, timeout });
  const origin = gitRead(['remote', 'get-url', 'origin']);
  // Classify with no tea reading first: github and gitlab are hostname
  // answers, and probing tea for them would be a spawn the answer never needed.
  let classification = classifyOrigin(origin.ok ? origin.stdout.trim() : '', null);
  if (classification.verdict === 'unrecognized' && classification.slug && onPath('tea')) {
    const probe = run('tea', ['login', 'list', '--output', 'json'], { cwd: dir, timeout });
    classification = classifyOrigin(origin.stdout.trim(), probe.ok ? teaLogins(probe.stdout) : null);
  }
  const host = classification.host;
  const repo = classification.slug;
  decision = decideIssueCheck({ enabled, classification });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const row = HOST_TABLE[classification.verdict];
  const bin = row.bin;
  const base = baseArg !== undefined ? baseArg : (git.base_branch || resolveProtectedBranches(git)[0]);
  const log = gitRead(['log', `${base}..HEAD`, '--format=%B']);
  decision = decideIssueCheck({ enabled, classification, logOk: log.ok, bin });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  decision = decideIssueCheck({ enabled, classification, logOk: true, bin, cliPresent: onPath(bin) });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  // The matched login is spent on every call this row makes: classifyOrigin
  // named it, and an unqualified --repo would let tea answer from whichever
  // login sits first in the user's config instead (D-07).
  const login = classification.login;
  const call = run(bin, row.argv(repo, row.limit, login), { cwd: dir, timeout });
  decision = decideIssueCheck({
    enabled, classification, logOk: true, bin, cliPresent: true,
    exitOk: call.ok, timedOut: call.timedOut,
  });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const fetched = row.normalize(call.stdout, row.limit);
  decision = decideIssueCheck({
    enabled, classification, logOk: true, bin, cliPresent: true, exitOk: true, fetched,
  });
  if (decision.action !== 'query') return skip(decision, { host, repo, warnings });

  const numbers = scanIssueRefs(log.stdout);
  const part = partitionIssues(numbers, fetched);
  // partitionIssues answers null only over an incomplete fetch, which the
  // decision above already turned into a skip; this is belt-and-braces so a
  // future reordering cannot publish a not-found verdict nobody could read.
  if (part === null) {
    return skip({ action: 'skip', reason: `${bin} returned a response this seam could not read as a complete issue list: no tracker report` },
      { host, repo, warnings });
  }
  // Numbers the list itself could not answer, resolved one bounded call each on
  // the rows that carry a resolver. The loop STOPS at the first resolve killed
  // at the call bound rather than continuing: a hung CLI must not be able to
  // multiply the bound by the cap and put five timeouts on the land path.
  /** @type {Map<number, string>} */
  const resolved = new Map();
  if (row.resolve && repo) {
    let spent = 0;
    for (const n of part.notFound) {
      if (spent >= MAX_RESOLVES) break;
      spent++;
      const one = run(bin, row.resolve.argv(repo, n, login), { cwd: dir, timeout });
      if (one.timedOut) break;
      const s = one.ok ? row.resolve.read(one.stdout, n) : null;
      if (s) resolved.set(n, s);
    }
  }
  // `unresolved`, never `not-found`, for anything the resolver did not answer:
  // the CLI exits nonzero both for an absent issue and for a failed read, and
  // this seam discards child stderr, so not-found would be an affirmative claim
  // about input it could not read. A host with no resolver keeps emitting
  // `not-found`, which its `--state all` list is evidence for.
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

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. An adapter
 * binding over lib/seam-input.mjs's reader - never a second definition of it. */
const flag = (name) => optionalFlag(argv, name);

try {
  if (cmd === 'check') {
    const raw = flag('--timeout-ms');
    const parsed = raw === undefined ? null : requireInt(raw);
    // A malformed or non-positive --timeout-ms falls back to the constant
    // rather than refusing: this seam's whole contract is that it never fails a
    // land, and an unbounded call is the one thing it may never do instead.
    const timeout = parsed && parsed.ok && parsed.value > 0 ? parsed.value : DEFAULT_TIMEOUT_MS;
    check(flag('--dir') || process.cwd(), flag('--base'), timeout);
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: check [--dir <path>] [--base <name>] [--timeout-ms <n>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
