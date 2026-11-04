// @ts-check
// close-decision.mjs - the pure core of land-cleanup and the autonomous close: three total functions that decide, from
// config and state, whether a land cleans up (return to base, pull, reap), which branch to reap, and whether an autonomous
// close halts before merge on a genuinely-unfixed risk_surface finding.
// No live git and no I/O: land-cleanup.mjs supplies the `git branch --merged` list and the already-classified halting
// findings, and cad-land prose runs the checkout, pull and branch -D. Unknown or missing input never throws.

/**
 * Pick which branch cleanup reaps, from the derived integration-branch name and the branches `git branch --merged <base>` reported.
 * - the derived name when it's a non-empty string in the merged list (the normal case: the just-shipped `cadence/<version>`);
 * - else the sole `cadence/*` entry of the merged list, for when PROJECT.md `### Active` already moved on to the next
 *   version or the name derived null, so re-derivation misses but exactly one cadence branch merged;
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
 * With it on, return to base and pull, and reap only when `mergedIntoBase === true` and a branch name resolved. An
 * unmerged branch is never deleted and `git branch -D` is never handed a null (GitHub's auto_close deletes the branch at
 * merge, so re-derivation resolves null).
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
 * How an `unruled` halt names what it holds without letting a caller-supplied payload write the reason string. `unruled`
 * arrives off stdin, so it's untrusted: only non-blank strings are named, at most `NAMED_UNRULED`, since an object would
 * render as `[object Object]` and a long list would make the reason unbounded. The count comes from the array's real
 * length, so a member too odd to name still halts, which fails closed.
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
 * Decide whether an autonomous close halts before merge. Total: a non-array `findings`, `unruled` or `overridden` coerces to [].
 * `findings` is already decided: the genuinely-unfixed halting set land-cleanup.mjs classified out of the branch's
 * ADJUDICATION records, so this reads no `severity` and a non-empty list halts. With `auto_close` off every arm proceeds.
 * `unreadable` names why the findings couldn't be read at all. Without it a payload nobody could parse coerced to [] and
 * came back `proceed`, a claim about input never seen. The names `readFindings` passes are `stdin-unreadable`, `stdin-empty`
 * (the gate wants an explicit `{"findings":[]}`, since a forgotten pipe looks like "adjudication killed everything"),
 * `malformed-json` and `not-a-findings-payload`. `unruled` is a fifth state beside those: a `REVIEW-risk_surface*.md` with no
 * sibling `ADJUDICATION-*.json`, so the fire happened and nothing ruled it. It halts as `unruled-review`, not as `unreadable`.
 * Arm order is `unreadable`, `unruled`, then the halting list. `overridden` is what a person already cleared: it rides the
 * result unchanged and never moves `action`, since folding it into `findings` re-adds the false halt.
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
