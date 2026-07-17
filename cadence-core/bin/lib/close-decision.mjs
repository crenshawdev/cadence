// @ts-check
// close-decision.mjs - the pure, testable core of the land-cleanup + autonomous
// -close logic (Phase 2, GIT-02/GIT-03). Zero-dep (node builtins only, and it
// uses none): three TOTAL functions that decide, from config + state, whether a
// land should clean up (return to base + pull + reap), which branch to reap, and
// whether an autonomous close halts before merge on a blocking pre_ship finding.
// It never runs live git and never does I/O - the land-cleanup.mjs seam supplies
// the live `git branch --merged` list and the adjudicated findings, and the
// cad-land prose runs the actual checkout/pull/branch -D. Mirrors
// branch-decision.mjs's discipline: unknown/missing inputs never throw.

/**
 * Pick which branch cleanup should reap, from a derived integration-branch name
 * plus the branches `git branch --merged <base>` reported. Pure: the seam
 * supplies `mergedBranches`.
 *
 * - the derived name when it is a non-empty string present in the merged list
 *   (the normal case: the just-shipped `cadence/<version>` merged into base);
 * - else the sole `cadence/*` entry of the merged list when EXACTLY one exists
 *   (the CONTEXT robustness fallback: PROJECT.md `### Active` already evolved to
 *   the next version, or a null-derived name, so re-derivation would miss - but
 *   exactly one cadence/* branch actually merged, so reap that one);
 * - else null (zero or several cadence/* matches: reap nothing, never guess).
 *
 * @param {string | null | undefined} derivedName
 * @param {string[]} mergedBranches
 * @returns {string | null}
 */
export function resolveReapBranch(derivedName, mergedBranches) {
  const merged = Array.isArray(mergedBranches) ? mergedBranches : [];
  if (typeof derivedName === 'string' && derivedName && merged.includes(derivedName)) {
    return derivedName;
  }
  const cadence = merged.filter((b) => typeof b === 'string' && b.startsWith('cadence/'));
  return cadence.length === 1 ? cadence[0] : null;
}

/**
 * Decide whether a land cleans up. Total: any `onLandCleanup` other than the
 * literal `true` leaves work in place.
 *
 * - onLandCleanup !== true -> skip: leave the branch and HEAD in place.
 * - onLandCleanup === true -> cleanup: return to base and pull, and reap ONLY
 *   when `mergedIntoBase === true` (the seam confirmed the branch is merged);
 *   reap is false whenever the merge is not confirmed, so an unmerged branch is
 *   never deleted.
 *
 * @param {{ onLandCleanup?: boolean, mergedIntoBase?: boolean, branch?: string|null }} args
 * @returns {{ action:'cleanup'|'skip', returnToBase:boolean, pull:boolean, reap:boolean, branch:string|null, reason:string }}
 */
export function decideCleanup({ onLandCleanup, mergedIntoBase, branch } = {}) {
  const b = branch ?? null;
  if (onLandCleanup !== true) {
    return { action: 'skip', returnToBase: false, pull: false, reap: false, branch: b,
      reason: 'on_land_cleanup off: leave HEAD and the integration branch in place' };
  }
  const reap = mergedIntoBase === true;
  return { action: 'cleanup', returnToBase: true, pull: true, reap, branch: b,
    reason: reap
      ? 'on_land_cleanup on and branch confirmed merged: return to base, pull, reap'
      : 'on_land_cleanup on but branch not confirmed merged into base: return to base and pull, do not reap' };
}

/**
 * Decide whether an autonomous close halts before merge. Total: a non-array
 * `findings` coerces to [] and never throws.
 *
 * A surviving `blocker` or `high` pre_ship finding under `auto_close` is a hard
 * halt before merge (D-09) - regardless of the configured gate mode - surfacing
 * the findings instead of merging over them. When auto_close is off the chain is
 * not running unattended, so this always proceeds (the manual publish ask owns
 * the decision).
 *
 * @param {{ autoClose?: boolean, findings?: Array<{severity?:string}> }} args
 * @returns {{ action:'halt'|'proceed', findings:Array<{severity?:string}>, reason:string }}
 */
export function decideGateHalt({ autoClose, findings } = {}) {
  const list = Array.isArray(findings) ? findings : [];
  const blocking = list.filter((f) => f && (f.severity === 'blocker' || f.severity === 'high'));
  if (autoClose === true && blocking.length > 0) {
    return { action: 'halt', findings: blocking,
      reason: 'auto_close on with a surviving blocker/high pre_ship finding: halt before merge, surface the findings' };
  }
  return { action: 'proceed', findings: [],
    reason: autoClose === true
      ? 'auto_close on, no surviving blocker/high finding: proceed to merge'
      : 'auto_close off: the unattended chain is not running, publish is the user\'s call' };
}
