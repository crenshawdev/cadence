// @ts-check
// Query grammar and git invocations for /cad-why. Pure: no disk, no emit, no exit, no Date, no randomness. why.mjs owns every refusal sentence and envelope field.
// Disambiguation is two steps on purpose. The suffix after the last colon is a line attempt only if it's empty or starts with a digit, `-` or `+`, so `C:/src/a.rs` and `a/b:name.rs` stay paths. Then a line attempt is validated, so `a.rs:-1` is refused as negative instead of quietly re-read as a path.
// Five refusal reasons, each from its own branch: empty-path, trailing-colon, negative-line, non-integer-line, zero-line. requireInt judges the digits once they're known to be digits, since Number() coerces (Number(true) is 1).
// The bare and line arms are separate argv builders because --follow and -L are mutually exclusive and --follow reorders a bare path's answer. Both pin -M and a fixed --format so a user's log.follow or diff.renames can't change the answer.
// LOG_FORMAT is shared so the caller parses one shape, joined by \x1f since no commit subject will contain it. It uses %cI, not %aI: a rebase or cherry-pick can leave author dates out of history order, and the commit date is what git log walks in.
// probeArgv is separate because `git log -- no/such/file` exits 0 with nothing, which looks like a legitimately empty chain. It runs before the full chain query so a typo costs one small invocation.
// The line arm needs no probe: an unknown path and a line past the end fail -L with two different messages, so classifyResult tells them apart from stderr alone.
'use strict';

import { requireInt } from './require-int.mjs';

/** Shared `--format` for both git arms: sha, strict-ISO commit date and subject, joined by the ASCII unit separator, one record per line. */
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
 * Does git know this path: capped at one result in the plainest format, so a mistyped path gets the smallest invocation that can answer it.
 * @param {string} path @returns {string[]}
 */
export function probeArgv(path) {
  return ['log', '-1', '--format=%H', '--', path];
}

/**
 * Every commit that touched `path`, newest first, following renames. The `--` keeps a path that looks like a revision (`HEAD`, a branch name) from being read as one.
 * @param {string} path @returns {string[]}
 */
export function bareArgv(path) {
  return ['log', `--format=${LOG_FORMAT}`, '-M', '--follow', '--', path];
}

/**
 * Only the commits whose diff touched `line` in `path`; `-s` drops the patch body. No `--`, since `-L` takes the path as part of its own argument and can't have a trailing pathspec.
 * @param {string} path @param {number} line @returns {string[]}
 */
export function lineArgv(path, line) {
  return ['log', `-L${line},${line}:${path}`, '-s', `--format=${LOG_FORMAT}`, '-M'];
}

/** The comparand's `--format`: sha and parent list, nothing else. The parents let a caller count merges from evidence, and no subject rides along so the list stays inside the same byte budget as the entry cap. */
export const COMPARAND_FORMAT = '%H%x1f%P';

/**
 * Every commit that touched `path` with git's history simplification turned off, so a caller can measure what the bare arm left out.
 * No `--follow`, and that's why it's a second query: `--follow` defeats `--full-history`, so adding the flag to bareArgv would change nothing and the only way to get both is to ask twice.
 * `-M` and the fixed `--format` are pinned for the same reason as the other arms: a reading machine's diff.renames or log.follow must not change the answer.
 * @param {string} path @returns {string[]}
 */
export function comparandArgv(path) {
  return ['log', '--full-history', '-M', `--format=${COMPARAND_FORMAT}`, '--', path];
}

/**
 * Which of the comparand's commits the chain doesn't carry, in the comparand's own order. That's newest-first as git answered, and re-sorting here would be a second opinion about chronology with no dates to form it.
 * Each carries its parent count instead of a merge flag, so the caller counts merges from evidence. A record with no sha is a parse artifact and is dropped.
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
 * Classify one git invocation's raw result. stderr is read here and never returned, because a caught git error reaching an envelope is how a credential leaked before, and a `fatal:` line follows the same rule.
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
