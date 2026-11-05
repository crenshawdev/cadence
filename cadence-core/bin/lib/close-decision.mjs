// @ts-check
// close-decision.mjs - the pure core of land-cleanup and the autonomous close: three total functions that decide
// whether a land cleans up, which branch to reap, and whether an autonomous close halts on an unfixed finding.
// No live git and no I/O: land-cleanup.mjs supplies the readings. Unknown or missing input never throws.

/**
 * Pick which branch cleanup reaps, from the derived integration-branch name and `git branch --merged <base>`.
 * - the derived name when it's a non-empty string in the merged list (the normal case);
 * - else the sole `cadence/*` entry of the merged list, for when PROJECT.md already moved on to the next version or
 *   the name derived null;
 * - else null: zero or several matches reap nothing, never guess.
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
 * Decide whether a land cleans up. Total: any `onLandCleanup` other than the literal `true` leaves work in place.
 * With it on, return to base and pull, and reap only when `mergedIntoBase === true` and a branch name resolved.
 * An unmerged branch is never deleted and `git branch -D` is never handed a null (GitHub's auto_close deletes the
 * branch at merge, so re-derivation resolves null).
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
  const reap = mergedIntoBase === true && b !== null;
  let reason;
  if (reap) {
    reason = 'on_land_cleanup on and branch confirmed merged: return to base, pull, reap';
  } else if (mergedIntoBase === true) {
    reason = 'on_land_cleanup on and merge confirmed but no reap branch resolved: return to base and pull, do not reap';
  } else {
    reason = 'on_land_cleanup on but branch not confirmed merged into base: return to base and pull, do not reap';
  }
  return { action: 'cleanup', returnToBase: true, pull: true, reap, branch: b, reason };
}

/** How many unruled review names one reason string will spell out. */
const NAMED_UNRULED = 5;

/**
 * How an `unruled` halt names what it holds without letting a caller-supplied payload write the reason string.
 * `unruled` arrives off stdin, so it's untrusted: only non-blank strings are named, at most `NAMED_UNRULED`, or an
 * object would render as `[object Object]` and a long list would make the reason unbounded.
 * The count comes from the array's real length, so a member too odd to name still halts: it fails closed.
 *
 * @param {unknown[]} reviews
 * @returns {string}
 */
function nameSome(reviews) {
  const named = reviews.filter((r) => typeof r === 'string' && r.trim() !== '').slice(0, NAMED_UNRULED);
  if (named.length === 0) return 'the caller named none of them';
  const rest = reviews.length - named.length;
  return named.join(', ') + (rest > 0 ? `, +${rest} more` : '');
}

/**
 * Decide whether an autonomous close halts before merge. Total: a non-array input is [].
 * `findings` is the unfixed halting set land-cleanup.mjs already classified. With `auto_close` off every arm proceeds.
 * `unreadable` names why the findings couldn't be read, or an unparseable payload would come back `proceed`.
 * `stdin-empty` is a name because a forgotten pipe looks like "adjudication killed everything".
 * `unruled` is a review with no ADJUDICATION record; it halts as `unruled-review`.
 * Arm order: `unreadable`, `unruled`, then the halting list. `overridden` rides the result and never moves `action`.
 *
 * @param {{ autoClose?: boolean, findings?: Array<Record<string, any>>,
 *   unreadable?: string|null, unruled?: unknown, overridden?: unknown }} args
 * @returns {{ action:'halt'|'proceed', findings:Array<Record<string, any>>,
 *   overridden:Array<Record<string, any>>, reason:string }}
 */
export function decideGateHalt({ autoClose, findings, unreadable, unruled, overridden } = {}) {
  const cleared = Array.isArray(overridden) ? overridden : [];
  const failure = typeof unreadable === 'string' && unreadable ? unreadable : null;
  if (autoClose === true && failure !== null) {
    return { action: 'halt', findings: [], overridden: cleared,
      reason: `auto_close on but the findings payload could not be read (${failure}): halt before merge, nothing is claimed about survivors` };
  }
  const reviews = Array.isArray(unruled) ? unruled : [];
  if (autoClose === true && reviews.length > 0) {
    return { action: 'halt', findings: [], overridden: cleared,
      reason: `auto_close on with ${reviews.length} risk_surface review(s) nothing ruled (unruled-review: ${nameSome(reviews)}): halt before merge, an unadjudicated fire says nothing about what survived` };
  }
  const list = Array.isArray(findings) ? findings : [];
  if (autoClose === true && list.length > 0) {
    return { action: 'halt', findings: list, overridden: cleared,
      reason: 'auto_close on with a genuinely-unfixed surviving risk_surface finding: halt before merge, surface the findings' };
  }
  return { action: 'proceed', findings: [], overridden: cleared,
    reason: autoClose === true
      ? 'auto_close on, no surviving blocker/high finding left genuinely unfixed: proceed to merge'
      : 'auto_close off: the unattended chain is not running, publish is the user\'s call' };
}
