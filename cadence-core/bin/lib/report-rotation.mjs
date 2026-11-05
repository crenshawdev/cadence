// @ts-check
// report-rotation.mjs - moves an executor's existing per-task report aside before its first write
// #195: the report path comes from the plan path alone, so a rerun wrote over the only record of the first run
// the suffix is free, not a run key: a run that died pre-commit re-mints the same correlationId at the same HEAD
// the rotated name still matches report.md's plan-*.md glob, a subdirectory wouldn't
// fail closed: unreadable is a throw, since the caller writes straight over the file on `{rotate: false}`
// pure: no fs, env, process or randomness, the caller owns the directory read and the rename
'use strict';

/** A plan number as a plan file spells it: `PLAN-<k>.md`, and 1 for a bare `PLAN.md`. */
const PLAN_NUMBER = /^[1-9][0-9]*$/;

/**
 * The plan number as the digits a filename is built from. Kept as the caller's spelling and not a `Number`, as
 * `requirePhaseArg` keeps `raw`: the value is a filename component before it's arithmetic, and `String(Number('08'))`
 * names a different file. So `08` is refused instead of silently answering about a different plan.
 *
 * @param {unknown} raw
 * @returns {string}
 */
function planDigits(raw) {
  const s = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : raw;
  if (typeof s !== 'string' || !PLAN_NUMBER.test(s)) {
    throw new TypeError(`report-rotation: plan number must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return s;
}

/**
 * The rotated-name grammar as a pattern source, stated once. Both readers below and `cmdLeaseCheck`'s report exemption
 * build from it, so two seams can't disagree about which staged name is a report.
 * The anchors matter: `.md` and the dot before the suffix keep `plan-11.md` from reading as rotation 1 of the first
 * plan, and `[1-9][0-9]*` keeps out `plan-1.0.md` and `plan-1.01.md`, which the picker never mints.
 * The scan is case-insensitive so a rename can't destroy a report in another case; the lease check is byte-exact.
 *
 * @param {string} k the plan number's digits, already through `planDigits`
 * @returns {string}
 */
const rotatedSource = (k) => `^plan-${k}\\.([1-9][0-9]*)\\.md$`;

/**
 * Is `name` this plan's report: the canonical `plan-<k>.md`, or a rotated `plan-<k>.<n>.md` for the same `k`?
 * With both on disk, staging the rotated one read as `undeclared-files` and blocked the executor on its own contract.
 * Names only, never a path: the caller owns the "directly in that plan's reports/ directory" half.
 *
 * @param {unknown} planKey the plan number - `1` for a bare `PLAN.md`. Refused
 *   with the same TypeError `rotationTarget` raises rather than answering about
 *   another plan.
 * @param {unknown} name one directory-entry name
 * @returns {boolean}
 */
export function isReportName(planKey, name) {
  const k = planDigits(planKey);
  // not a throw: this answers a filter, and a lease gate fails closed, so a name it can't read isn't exempt
  if (typeof name !== 'string') return false;
  // no 'i' flag, see rotatedSource
  return name === `plan-${k}.md` || new RegExp(rotatedSource(k)).test(name);
}

/**
 * Where an existing `plan-<k>.md` must move before this run's first write.
 *
 * @param {unknown} planKey the plan number - `1` for a bare `PLAN.md`
 * @param {unknown} entries the names already in that plan's `reports/`
 *   directory, as `readdirSync` returns them (names, never `Dirent`s)
 * @returns {{rotate: false} | {rotate: true, from: string, to: string}}
 *   `rotate: false` when no previous run's report is there. Otherwise `from` is
 *   the file to rename and `to` is a name no entry currently holds.
 */
export function rotationTarget(planKey, entries) {
  const k = planDigits(planKey);
  if (!Array.isArray(entries)) {
    throw new TypeError('report-rotation: entries must be an array of directory names');
  }
  for (const e of entries) {
    // a Dirent[] would make every comparison false and say rotate: false about a directory with a report
    if (typeof e !== 'string') {
      throw new TypeError(`report-rotation: every entry must be a string, got ${typeof e}`);
    }
  }

  // case-insensitive like the suffix scan: on a case-folding filesystem an upper-cased name is the same file, and
  // missing it means the caller overwrites it. `from` keeps the entry's own spelling so the rename works on
  // case-sensitive ones too, and an exact match wins when both exist
  const canonical = `plan-${k}.md`;
  const base = new RegExp(`^plan-${k}\\.md$`, 'i');
  const from = entries.includes(canonical) ? canonical : entries.find((e) => base.test(e));
  if (from === undefined) return { rotate: false };

  // the grammar is rotatedSource's, the 'i' flag is this caller's and explained below
  const rotated = new RegExp(rotatedSource(k), 'i');
  /** @type {Set<number>} */
  const taken = new Set();
  for (const e of entries) {
    const m = rotated.exec(e);
    if (m) taken.add(Number(m[1]));
  }

  // the 'i' is on purpose: a hand-left upper-cased rotated name is the same file on a case-folding filesystem, and
  // renaming onto it destroys a report. The name we mint is always lowercase
  let n = 1;
  while (taken.has(n)) n += 1;
  return { rotate: true, from, to: `plan-${k}.${n}.md` };
}
