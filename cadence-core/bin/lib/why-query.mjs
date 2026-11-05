// @ts-check
// query grammar and git argv for /cad-why. Pure: no disk, emit, exit, Date or randomness.
// the last colon's suffix is a line attempt only if empty or led by a digit, `-` or `+`: `C:/src/a.rs` stays a path
// then a line attempt is validated, so `a.rs:-1` is refused as negative, not re-read as a path
// bare and line arms are separate: --follow and -L are mutually exclusive. Both pin -M and a fixed --format
// LOG_FORMAT is joined by \x1f, which no subject contains; %cI not %aI, as rebases leave author dates out of order
'use strict';

import { requireInt } from './require-int.mjs';

/** Shared `--format`: sha, strict-ISO commit date and subject, joined by the unit separator, one record per line. */
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
 * Does git know this path: `git log -- no/such/file` exits 0 with nothing, so a typo needs its own one-result probe.
 * @param {string} path @returns {string[]}
 */
export function probeArgv(path) {
  return ['log', '-1', '--format=%H', '--', path];
}

/**
 * Every commit that touched `path`, newest first, following renames. The `--` keeps a path that looks like a revision
 * (`HEAD`, a branch name) from being read as one.
 * @param {string} path @returns {string[]}
 */
export function bareArgv(path) {
  return ['log', `--format=${LOG_FORMAT}`, '-M', '--follow', '--', path];
}

/**
 * Commits whose diff touched `line` in `path`; `-s` drops the patch. No `--`: `-L` takes the path itself, no pathspec.
 * @param {string} path @param {number} line @returns {string[]}
 */
export function lineArgv(path, line) {
  return ['log', `-L${line},${line}:${path}`, '-s', `--format=${LOG_FORMAT}`, '-M'];
}

/** The comparand's `--format`: sha and parents only, so merges are counted from evidence and the byte budget holds. */
export const COMPARAND_FORMAT = '%H%x1f%P';

/**
 * Every commit that touched `path` with history simplification off, so a caller can measure what the bare arm left out.
 * No `--follow`, which defeats `--full-history`; that's why it's a second query.
 * `-M` and the fixed `--format` are pinned like the other arms, so a reader's diff.renames or log.follow can't matter.
 * @param {string} path @returns {string[]}
 */
export function comparandArgv(path) {
  return ['log', '--full-history', '-M', `--format=${COMPARAND_FORMAT}`, '--', path];
}

/**
 * The comparand's commits the chain lacks, in git's order; re-sorting would guess at chronology without dates.
 * Each carries its parent count, not a merge flag, so merges come from evidence. A record with no sha is dropped.
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
 * Classify one git result. stderr is read here and never returned: a git error in an envelope once leaked a credential.
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
