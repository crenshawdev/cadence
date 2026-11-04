// @ts-check
// report-rotation.mjs - moves an executor's existing per-task report aside before its first write
// the defect (#195): `reports/plan-<k>.md` comes from the plan path alone, so a second run of the same plan wrote over
// the first run's file, the only record of what ran. Rotating it aside first makes two runs two readable records
// a free suffix, not a run key, because there is nothing to key on: correlationId in trace.mjs is `${phase}-${sha}`, so a run
// that died before committing re-mints the same string at the same HEAD and re-collides
// the suffixed sibling still matches the plan-*.md glob workflows/report.md lists reports with, a per-run subdirectory wouldn't
// fail closed: anything unreadable is a throw, not a quiet `{rotate: false}`, since the caller acts on false by writing
// straight over the file and that would perform the destruction instead of reporting it
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
 * The rotated-name grammar as a pattern source, stated once. Both readers below build their RegExp from it, and
 * so does `cmdLeaseCheck`'s report exemption in planning.mjs through `isReportName`: a second copy is how two seams
 * disagree about which staged name is a report, and here that's a parallel-safety gate refusing a file the
 * executor must write, or exempting one nothing writes.
 * The anchors are load-bearing: the trailing `.md` and the dot before the suffix keep `plan-11.md` from reading as
 * the first plan's rotation number 1, and `[1-9][0-9]*` keeps out `plan-1.0.md` and `plan-1.01.md`, which the picker never mints.
 * The flag is the caller's: the scan is case-insensitive so a rename can't destroy a report stored in another case, while
 * the lease question is byte-exact on the lowercase spelling this module produces, or it would exempt an upper-cased name no executor wrote.
 *
 * @param {string} k the plan number's digits, already through `planDigits`
 * @returns {string}
 */
const rotatedSource = (k) => `^plan-${k}\\.([1-9][0-9]*)\\.md$`;

/**
 * Is `name` this plan's report: the canonical `plan-<k>.md`, or a rotated `plan-<k>.<n>.md` for the same `k`?
 * The lease side's question, asked by cmdLeaseCheck's single-name exemption. Once an executor holds both a canonical and a
 * rotated report, staging the rotated one during a task commit read as `undeclared-files`, blocking the executor for obeying its own contract.
 * Names only, never a path: the caller keeps the "directly in that plan's reports/ directory" half, which needs to know where the directory is.
 *
 * @param {unknown} planKey the plan number - `1` for a bare `PLAN.md`. Refused
 *   with the same TypeError `rotationTarget` raises rather than answering about
 *   another plan.
 * @param {unknown} name one directory-entry name
 * @returns {boolean}
 */
export function isReportName(planKey, name) {
  const k = planDigits(planKey);
  // not a throw, unlike the inputs above: this answers a filter, and fail closed for a lease gate is false, a name it can't read is a name it doesn't exempt
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
    // a Dirent[] would make every comparison below false and answer rotate: false about a directory holding a report, the fail-open arm
    if (typeof e !== 'string') {
      throw new TypeError(`report-rotation: every entry must be a string, got ${typeof e}`);
    }
  }

  // case-insensitive like the suffix scan below: on a case-folding filesystem an upper-cased `plan-1.md` is the same file, and an exact-name
  // miss would answer rotate: false about a directory holding a report, then the caller writes straight over it, the one
  // outcome this module exists to prevent. `from` is the entry's own spelling so the rename resolves on a case-sensitive
  // filesystem too, and an exact match wins when a tree holds both, since the canonical name is what the caller is about to write
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

  // the 'i' above is on purpose: on a case-folding filesystem a hand-left upper-cased rotated name is the same file, and renaming onto
  // it would destroy a report. The name produced is always lowercase, so no suffix is minted in a spelling the next run
  // would have to match case-insensitively
  let n = 1;
  while (taken.has(n)) n += 1;
  return { rotate: true, from, to: `plan-${k}.${n}.md` };
}
