// @ts-check
// report-rotation.mjs - the ONE statement of where an executor's existing
// per-task report must move before that executor's first write.
//
// THE DEFECT (#195). `<plandir>/reports/plan-<k>.md` is derived from the plan
// path alone, so a SECOND run of the same plan writes its first task row over
// the first run's file. That file is the only per-task record of what ran and
// what it printed - the orchestrator's timeout and partial arms read nothing
// else - so a re-run destroyed the evidence of the run it was re-running,
// before anything had read it. Rotating the old file aside first is what turns
// two runs into two readable records.
//
// WHY A FREE SUFFIX AND NOT A RUN KEY (CONTEXT D-01). The obvious fix is to
// name the file after the run. There is no run identifier to name it after:
// `correlationId` in lib/trace.mjs returns `${phase}-${sha}` read off the
// newest `phase_start` anchor, so a run that died before committing anything
// re-mints the SAME string at the same HEAD and a key derived from it
// re-collides - the exact overwrite this module exists to stop, one indirection
// down. An orchestrator-minted key is worse: it would have to ride the dispatch
// prompt, and the executor contract's standing rule is that the report path is
// derived from the plan path alone and never accepted from a dispatch, which is
// what keeps `/cad-task`'s `.planning/tasks/<slug>/` dispatch working. Rotation
// needs no identifier at all, so it works in a worktree and under `/cad-task`
// alike.
//
// WHY A SUFFIXED SIBLING AND NOT A PER-RUN SUBDIRECTORY. The rotated name has
// to stay matched by `workflows/report.md`'s
// `.planning/phases/<N>/reports/plan-*.md` glob - the reader that lists an
// unfinished phase's reports. `plan-<k>.<n>.md` matches it; `<key>/plan-<k>.md`
// does not, and would hide the older record from the only reader that consumes
// reports.
//
// WHY THE LOWEST FREE SUFFIX. It is total: it needs no interpretation of a gap
// a hand-deleted report left, and it cannot run out. The answer is only ever a
// name that no entry in the directory already holds, which is the whole
// property the caller relies on before it renames.
//
// FAIL CLOSED, NEVER FAIL OPEN. Every input this cannot read is a THROW, not a
// quiet `{rotate: false}`: the caller acts on `false` by writing straight over
// the file, so degrading a malformed input into "nothing to rotate" would
// perform the destruction rather than report the problem.
//
// Pure in the sense lib/plan-key.mjs and lib/lease-grammar.mjs are - classify,
// never emit, no fs, no env, no process, no randomness. The caller owns the
// directory read and owns the rename. It takes no CONTRACTS row and no CLI
// entry point, for the reason self-verify.mjs check 14 states about
// `lib/*.mjs`: they are modules prose never invokes.
'use strict';

/** A plan number as a plan file spells it: `PLAN-<k>.md`, and 1 for a bare `PLAN.md`. */
const PLAN_NUMBER = /^[1-9][0-9]*$/;

/**
 * The plan number as the digits a filename is built from.
 *
 * Kept as the caller's own SPELLING rather than a `Number`, for the reason
 * `requirePhaseArg` keeps `raw`: the value is a filename component before it is
 * anything arithmetic, and `String(Number('08'))` names a different file. So
 * `08` is refused outright instead of silently answering about plan 8.
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
    // A `Dirent[]` here would make every name comparison below false and answer
    // `rotate: false` about a directory that holds a report - the fail-open arm.
    if (typeof e !== 'string') {
      throw new TypeError(`report-rotation: every entry must be a string, got ${typeof e}`);
    }
  }

  // Case-insensitively, for the SAME reason the suffix scan below is: on a
  // case-folding filesystem a report stored as `PLAN-1.MD` IS `plan-1.md`, and
  // an exact-name miss here answers `rotate: false` about a directory that
  // holds a report - the caller then writes the canonical spelling straight
  // over it, the one outcome this module exists to prevent. `from` is the
  // entry's OWN spelling, never the canonical one, because that is the name
  // the caller's rename has to resolve on a case-SENSITIVE filesystem too.
  // Exact match wins when a case-sensitive tree holds both spellings: the
  // canonical name is the one the caller is about to write.
  const canonical = `plan-${k}.md`;
  const base = new RegExp(`^plan-${k}\\.md$`, 'i');
  const from = entries.includes(canonical) ? canonical : entries.find((e) => base.test(e));
  if (from === undefined) return { rotate: false };

  // `k` reaches the RegExp only past PLAN_NUMBER, so the interpolation is
  // digits and cannot carry pattern syntax. The trailing `.md` and the dot
  // before the suffix are what keep `plan-11.md` from reading as plan 1's
  // rotation number 1.
  const rotated = new RegExp(`^plan-${k}\\.([1-9][0-9]*)\\.md$`, 'i');
  /** @type {Set<number>} */
  const taken = new Set();
  for (const e of entries) {
    const m = rotated.exec(e);
    if (m) taken.add(Number(m[1]));
  }

  // Case-insensitively above, deliberately, and for the same reason the base
  // check is: on a case-folding filesystem a `PLAN-1.1.MD` left by hand IS
  // `plan-1.1.md`, and renaming onto it would destroy a report. The name
  // PRODUCED is always the canonical lower-case spelling, so a suffix is never
  // minted in a spelling the next run would have to match case-insensitively
  // in turn.
  let n = 1;
  while (taken.has(n)) n += 1;
  return { rotate: true, from, to: `plan-${k}.${n}.md` };
}
