#!/usr/bin/env node
// @ts-check
// issue-check.mjs - the workflow-facing seam over lib/issue-decision.mjs. It
// ADVISES /cad-land step 1 which issues this branch's commits reference, which
// of them are still open, and which issues are open on the detected host - or,
// on every path that cannot answer, the ONE line step 1 prints before carrying
// on (LND-01). Like land-cleanup.mjs it only advises, and it is READ-ONLY in
// the strongest sense available: no argv it can build closes, reopens or
// comments on an issue. Landing closes nothing; closing stays an explicit ask.
// One JSON line on stdout, and the `check` arm is ok:true on EVERY path it
// reaches, including its failures - a tracker that cannot be read is a degraded
// report, never a failed land. A malformed CALL never reaches that arm: an
// empty or valueless --dir refuses at the dispatch (see the --dir line below),
// which is a different thing from a tracker read going wrong. Three actions: `report` (the sentence), `skip` (ONE
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
//     --dir is the planning root AND the repository every read is bound to.
//     ABSENT means the process cwd; an EMPTY or valueless --dir REFUSES
//     (`missing-flag-value`, exit 1) before any spawn (phase 2 D-01). That is
//     not this seam failing a land: nothing was read, so there is no tracker
//     verdict to degrade, and what has to be fixed is the caller's own argv.
//     Base resolves from --base, else git.base_branch, else the
//     first git.protected_branches entry - the same order land-cleanup.mjs
//     cleanup uses. --timeout-ms overrides DEFAULT_TIMEOUT_MS below, which
//     bounds each subprocess AND the whole per-issue resolve loop.
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
// PATH, in ONE place - `lib/on-path.mjs`, which this seam imports rather than
// carries - because PATH is the OS's own lookup: a test injects a stub by
// prepending a directory to the child's PATH and the PRODUCTION resolver is
// what runs. A test-only override honoured in production is exactly what
// review-provider.mjs:445-460 and EXP-01 refused, and that module reads no
// Cadence variable of its own for the same reason. It moved to lib/ when
// `detect-commands` needed the same question answered about a lint driver
// (RCH-01): one rule, two callers, and no way for the seam that advises a land
// and the seam that names an executor's command to disagree about "reachable".
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what each flag may be, and what it costs when it is not, are DECLARED
// rows in lib/arg-contract.mjs, and `requireFlag` raises the refusal in the
// throwing form the catch arm at the foot of this file already renders. `--dir`
// declares `refuse` (D-01) - it names the repository every read is bound to.
// `--base` and `--timeout-ms` declare `fallback`, the latter deliberately
// landing on DEFAULT_TIMEOUT_MS rather than refusing (D-04): this seam's whole
// contract is that it never fails a land, and a contract that made every typed
// flag refuse would hand it the power to fail one. The `int` type it declares
// is lib/require-int.mjs's own classifier, consulted through the row rather
// than called here.
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import {
  HOST_TABLE, classifyOrigin, scanIssueRefs, partitionIssues, decideIssueCheck,
} from './lib/issue-decision.mjs';

/**
 * The bound on EVERY subprocess this seam starts, AND the wall-clock budget for
 * the per-issue resolve loop as a whole (ISS-01). Those are one value on
 * purpose: the same number answers "how long may one call take" and "how long
 * may the resolve phase take", so a land's worst case here is this many
 * milliseconds rather than this many times MAX_RESOLVES. A land must not be
 * delayed by a forge CLI that never returns (LND-01, criterion 4), and this is
 * the first remote state /cad-land reads that is not git. It is a named
 * constant over a `--timeout-ms` flag rather than a config key on purpose: the
 * milestone licenses exactly one new key, and a bound reachable at the call
 * site is directly testable where a buried hardcoded one is not.
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

/**
 * The logins a `tea login list --output json` reading names, as tea printed
 * them. Null when the reading cannot be parsed as a list at all, which
 * classifyOrigin reads as "tea could not be consulted" rather than "no login".
 *
 * Nothing is extracted from a login record here, because nothing needs to be:
 * classifyOrigin asks this reading for its LENGTH, and the query is bound to
 * the checkout's remote by `--remote origin` rather than to a login this seam
 * picked. The name/url/ssh_host parsing that stood here served a host-matching
 * rule that could not be made correct (see classifyOrigin), and it went with it.
 * @param {string} text @returns {unknown[]|null}
 */
function teaLogins(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
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

  const call = run(bin, row.argv(repo, row.limit), { cwd: dir, timeout });
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
  // Numbers the list itself could not answer, resolved on the rows that carry a
  // resolver, under ONE wall-clock budget for the whole loop rather than one
  // bound per call (ISS-01). The deadline is taken once, here, from the same
  // resolved timeout every other subprocess is bound by, and each call is given
  // only what is left of it - so no single resolve can outlive the budget and
  // the loop cannot spend the budget more than once. That is the bound a
  // per-call timeout could not deliver: a `tea` answering at just under the
  // bound and exiting nonzero is never killed, so the old `if (one.timedOut)`
  // exit never fired and MAX_RESOLVES calls each cost nearly the full bound.
  //
  // Three things end the loop and nothing else: the budget is spent, a resolve
  // was killed at what remained of it, or MAX_RESOLVES calls have been made. A
  // FAST nonzero exit does NOT end it - that is what tea answers for an issue
  // that is not there, and a land may reference several of those and still need
  // the states of the numbers behind them.
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
      const one = run(bin, row.resolve.argv(repo, n), { cwd: dir, timeout: left });
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
/** This script's declared rows. A subcommand's own row wins over the `'*'` row,
 * where the flags allowed on every arm - here `--dir` - are declared once. */
const ROWS = CONTRACTS['issue-check.mjs'];
/** One flag of `sub`, read through its DECLARED row. The row owns the rule and
 * this binding owns nothing: it is an adapter over this file's own argv, never
 * a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  if (cmd === 'check') {
    // `--timeout-ms` declares the `int` type with the `fallback` disposition on
    // both axes, so a malformed, empty or valueless one reads as ABSENT and the
    // constant answers - no refusal, ever. What the shared `int` type does NOT
    // carry is positivity, so this seam's own extra term stays spelled here: an
    // unbounded call is the one thing it may never do instead of refusing.
    const ms = arg('check', '--timeout-ms');
    const timeout = ms !== undefined && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
    // `--dir` declares `refuse` on both axes: a genuinely ABSENT one still
    // reads as undefined and the cwd default is unchanged, while the empty,
    // valueless and flag-shaped spellings raise before any spawn and the
    // e.seam arm names them. `--base` declares `fallback`, so a spelling
    // carrying no usable value reads as absent and `git.base_branch` answers.
    check(arg('check', '--dir') || process.cwd(), arg('check', '--base'), timeout);
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: check [--dir <path>] [--base <name>] [--timeout-ms <n>]' });
  }
} catch (e) {
  // The seam arm is what a `refuse` row costs its bin (D-08/D-09): the raised
  // refusal object carries no `message`, so without it a valueless --dir emits
  // detail "[object Object]". Its detail is the flag name this file wrote,
  // never third-party bytes, so the no-output-reaches-the-envelope rule holds.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail });
  else emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
