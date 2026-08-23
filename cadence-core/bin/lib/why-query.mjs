// @ts-check
// why-query.mjs - the query grammar and the git invocations for
// `/cad-why` (WHY-01, phase 1 plan 1). A pure module in the
// lib/lease-grammar.mjs / lib/plan-key.mjs mold: no disk, no emit, no exit,
// no Date, no randomness. The caller (why.mjs) owns every refusal sentence
// and every envelope field; this module only classifies.
//
// FOUR QUESTIONS, and only these four (CONTEXT phase 1 plan 1, task 1; the
// fourth added by v3.6.1 phase 1 D-01):
//
//   1. The argument grammar - `parseQuery` splits the caller's one positional
//      argument into a repository-relative path and an optional 1-based line.
//   2. The git argument vectors - `probeArgv`, `bareArgv`, `lineArgv` and
//      `comparandArgv` build the argv ARRAYS the caller passes to
//      `execFileSync('git', ...)`. Never a shell string: this module builds
//      arrays only.
//   3. The failure classification - `classifyResult` turns a git exit status
//      plus its stderr into one of the outcomes the seam emits, carrying NO
//      third-party bytes onward.
//   4. What the bare arm's history simplification LEFT OUT - `excludedFrom`
//      names the commits the comparand query carries and the chain does not,
//      which is the whole of WHY-02 on this module's side.
//
// DISAMBIGUATION IS TWO STEPS, deliberately separate (CONTEXT D-15/D-16).
// Step one CLASSIFIES the suffix after the LAST colon as a line attempt only
// when it is empty or starts with a digit, `-` or `+`; any other first
// character leaves the colon inside the path, so `C:/src/a.rs` and
// `a/b:name.rs` stay paths untouched. Step two VALIDATES a line attempt and
// names which of four ways it failed - negative, non-integer, zero, or a
// trailing colon with nothing after it - rather than silently re-reading the
// whole argument as a path, which is what a one-step digits-only classifier
// would do to `a.rs:-1`.
//
// FIVE REFUSAL REASONS, each reached by a different branch so they cannot
// collide: `empty-path` (the whole argument, or the path half of a split, is
// blank), `trailing-colon` (nothing follows the last colon), `negative-line`,
// `non-integer-line` and `zero-line`. `requireInt` (lib/require-int.mjs)
// judges the digits once they are confirmed to BE digits, rather than a
// fresh `Number()` - that module's own header names the coercion hazard
// (`Number(true) === 1`, an unsafe integer read back as a different number).
//
// THE GIT INVOCATIONS ARE DIFFERENT ON PURPOSE (D-15). `--follow` and `-L`
// are mutually exclusive - `fatal: --follow requires exactly one pathspec` -
// and `--follow` also reorders the answer on a bare path, so the bare arm and
// the line arm are two distinct argv builders rather than one with an
// optional flag. Both pin `-M` explicitly and a FIXED `--format` rather than
// inheriting a user's `log.follow` or `diff.renames` configuration: 173
// rename records were measured in the last 400 commits of the surface this
// command reads (D-17).
//
// LOG_FORMAT is shared by both arms so the caller parses one shape: the full
// 40-character sha, the commit's strict-ISO date, and the subject line,
// joined by `\x1f` (ASCII unit separator - a byte no commit subject is going
// to contain) with one record per line, which is git's own default framing
// for a `--format` string. `%cI` (commit date) rather than `%aI` (author
// date) is the sort key D-17 asks for: a rebase or cherry-pick can leave the
// author date out of history order, and the COMMIT date is what `git log`
// itself walks in.
//
// THE EXPLICIT NOT-IN-HISTORY PROBE (D-16) is its own argv, `probeArgv`,
// rather than trusting the bare arm's own emptiness. `git log --format=%H --
// no/such/file` exits 0 printing nothing - observably identical to a chain
// that is legitimately empty, which cannot happen for a real tracked path but
// is exactly the signal a typo produces. The probe is the cheapest possible
// answer to that one question (`-1`, the minimal format) and the caller runs
// it BEFORE the full `--follow` chain query, so a mistyped path costs one
// small invocation instead of two.
//
// THE LINE ARM NEEDS NO SEPARATE PROBE. Measured against this repository on
// 2026-08-22: a path git has never seen fails `-L` with `fatal: There is no
// path <path> in the commit` (exit 128), and a path that exists but whose
// line is past the file's end fails with `fatal: file <path> has only <n>
// lines` (exit 128) - two DIFFERENT stated messages, so `classifyResult`
// tells them apart from stderr alone.
'use strict';

import { requireInt } from './require-int.mjs';

/** The refusal reasons `parseQuery` names, each reached by exactly one
 * branch below so two different inputs cannot report the same reason for
 * different mistakes. */
export const QUERY_REASONS = Object.freeze([
  'empty-path', 'trailing-colon', 'negative-line', 'non-integer-line', 'zero-line',
]);

/** The outcomes `classifyResult` names. `ok` means the caller's own stdout is
 * the answer; the other three are stated results the caller emits instead of
 * letting a raw git byte, or a silently empty chain, reach its envelope. */
export const RESULT_OUTCOMES = Object.freeze([
  'ok', 'not-in-history', 'line-past-end', 'git-failed',
]);

/** Shared `--format` for both git arms: full sha, strict-ISO commit date,
 * subject, joined by the ASCII unit separator. One record per line - git's
 * own default framing for a `--format` string with no explicit terminator. */
export const LOG_FORMAT = '%H%x1f%cI%x1f%s';

/** A line attempt's first character: empty is folded in by the caller. */
const LINE_START = /^[0-9+-]/;
/** Digits only, no sign - the one spelling `parseQuery` accepts as a line. */
const DIGITS_ONLY = /^\d+$/;

/**
 * Split `raw` into a repository-relative path and an optional 1-based line.
 *
 * @param {unknown} raw the caller's one positional argument
 * @returns {{ok: true, path: string, line: number|undefined}
 *   | {ok: false, reason: 'empty-path'|'trailing-colon'|'negative-line'
 *       |'non-integer-line'|'zero-line'}}
 */
export function parseQuery(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'empty-path' };
  }
  const lastColon = raw.lastIndexOf(':');
  if (lastColon === -1) return finishPath(raw);

  const suffix = raw.slice(lastColon + 1);
  const isLineAttempt = suffix === '' || LINE_START.test(suffix);
  if (!isLineAttempt) return finishPath(raw);

  const path = raw.slice(0, lastColon);
  if (path.trim() === '') return { ok: false, reason: 'empty-path' };
  if (suffix === '') return { ok: false, reason: 'trailing-colon' };
  if (suffix.startsWith('-')) return { ok: false, reason: 'negative-line' };
  if (!DIGITS_ONLY.test(suffix)) return { ok: false, reason: 'non-integer-line' };

  const parsed = requireInt(suffix);
  if (!parsed.ok) return { ok: false, reason: 'non-integer-line' };
  if (parsed.value === 0) return { ok: false, reason: 'zero-line' };
  return { ok: true, path, line: parsed.value };
}

/** @param {string} path @returns {{ok: true, path: string, line: undefined}
 *   | {ok: false, reason: 'empty-path'}} */
function finishPath(path) {
  if (path.trim() === '') return { ok: false, reason: 'empty-path' };
  return { ok: true, path, line: undefined };
}

/**
 * The cheap, explicit "does git know this path" probe (D-16). Capped at one
 * result and the plainest possible format, run BEFORE the fuller chain query
 * so a mistyped path is answered by the smallest invocation that can answer
 * it.
 * @param {string} path @returns {string[]}
 */
export function probeArgv(path) {
  return ['log', '-1', '--format=%H', '--', path];
}

/**
 * The bare-path arm: every commit that touched `path`, newest first,
 * following renames. `--` separates the path from the flags so a path that
 * looks like a revision (`HEAD`, a branch name) cannot be read as one.
 * @param {string} path @returns {string[]}
 */
export function bareArgv(path) {
  return ['log', `--format=${LOG_FORMAT}`, '-M', '--follow', '--', path];
}

/**
 * The line arm: only the commits whose diff touched `line` in `path`. `-s`
 * suppresses the patch body, leaving one commit-format record per touching
 * commit. No `--` separator - `-L` takes `<path>` as part of its own
 * argument and is not compatible with a trailing pathspec.
 * @param {string} path @param {number} line @returns {string[]}
 */
export function lineArgv(path, line) {
  return ['log', `-L${line},${line}:${path}`, '-s', `--format=${LOG_FORMAT}`, '-M'];
}

/** The comparand's `--format`: the full sha and the commit's PARENT LIST, and
 * nothing else. The parents are what let a caller say how many of the excluded
 * commits are merges from evidence rather than by assertion, and no subject
 * rides along because this list is bounded by the same byte line the entry cap
 * is (D-02) - the block names the invocation a reader runs to see the rest. */
export const COMPARAND_FORMAT = '%H%x1f%P';

/**
 * The COMPARAND arm (WHY-02, phase 1 D-01): every commit that touched `path`
 * with git's default history simplification turned OFF, so a caller can measure
 * what the bare arm's simplification excluded rather than being silently short.
 *
 * IT CARRIES NO `--follow`, AND THAT IS THE WHOLE REASON IT IS A SECOND QUERY.
 * Measured on git 2.55.0 on 2026-08-23: `git log -M --follow --full-history --
 * cadence-core/bin/lib/release-decision.mjs` returns exactly the 7 commits
 * `--follow` alone returns, while this argv returns 10. The two flags do not
 * compose - `--follow` defeats `--full-history` - so adding the flag to
 * `bareArgv` would change nothing and drop nothing, and the only way to have
 * both rename-following and the full-history count is to ask twice.
 *
 * `-M` is pinned explicitly and the `--format` is fixed for the same reason
 * both other arms pin them (D-17): a reading machine's `diff.renames` or
 * `log.follow` must not change what this command answers.
 * @param {string} path @returns {string[]}
 */
export function comparandArgv(path) {
  return ['log', '--full-history', '-M', `--format=${COMPARAND_FORMAT}`, '--', path];
}

/**
 * Which of the comparand's commits the chain does not carry, in the
 * comparand's OWN order - which is newest-first, because that is the order
 * `git log` answered in and re-sorting here would be a second opinion about
 * chronology this module has no dates to form.
 *
 * Each survivor carries its PARENT COUNT rather than a merge flag, so the
 * caller states how many are merges by counting evidence git returned instead
 * of by asserting it. A record with no sha is dropped: it is a parse artifact,
 * never a commit.
 *
 * @param {Iterable<string>} chainShas the full shas the chain already lists
 * @param {{sha: string, parents?: string[]}[]} records the comparand's records
 * @returns {{sha: string, parentCount: number}[]}
 */
export function excludedFrom(chainShas, records) {
  const carried = new Set(chainShas || []);
  const out = [];
  for (const r of records || []) {
    const sha = r && typeof r.sha === 'string' ? r.sha : '';
    if (!sha || carried.has(sha)) continue;
    out.push({ sha, parentCount: Array.isArray(r.parents) ? r.parents.length : 0 });
  }
  return out;
}

const LINE_PAST_END = /has only \d+ lines$/m;
const PATH_UNKNOWN = /^fatal: There is no path .* in the commit$/m;

/**
 * Classify one git invocation's raw result. Carries NO third-party bytes
 * onward - `stderr` is inspected here and never returned - because a caught
 * git error reaching a seam envelope is exactly how a credential leaked
 * before (EXP-01), and the same rule applies to a `fatal:` line.
 *
 * @param {{status: number, stderr?: string, stdoutEmpty: boolean}} result
 * @returns {{outcome: 'ok'} | {outcome: 'not-in-history'}
 *   | {outcome: 'line-past-end'} | {outcome: 'git-failed'}}
 */
export function classifyResult({ status, stderr, stdoutEmpty }) {
  if (status === 0) {
    return stdoutEmpty ? { outcome: 'not-in-history' } : { outcome: 'ok' };
  }
  const text = String(stderr || '');
  if (PATH_UNKNOWN.test(text)) return { outcome: 'not-in-history' };
  if (LINE_PAST_END.test(text)) return { outcome: 'line-past-end' };
  return { outcome: 'git-failed' };
}
