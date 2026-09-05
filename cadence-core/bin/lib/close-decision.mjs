// @ts-check
// close-decision.mjs - the pure, testable core of the land-cleanup + autonomous
// -close logic (Phase 2, GIT-02/GIT-03). Zero-dep (node builtins only, and it
// uses none): three TOTAL functions that decide, from config + state, whether a
// land should clean up (return to base + pull + reap), which branch to reap, and
// whether an autonomous close halts before merge on a genuinely-unfixed
// risk_surface finding.
// It never runs live git and never does I/O - the land-cleanup.mjs seam supplies
// the live `git branch --merged` list and the ALREADY-CLASSIFIED halting
// findings, and the cad-land prose runs the actual checkout/pull/branch -D.
// Mirrors branch-decision.mjs's discipline: unknown/missing inputs never throw.

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
 *   when `mergedIntoBase === true` (the seam confirmed the branch is merged) AND
 *   a branch name actually resolved (`branch != null`); reap is false whenever
 *   the merge is not confirmed OR no branch resolved, so an unmerged branch is
 *   never deleted and `git branch -D` is never handed a null (the GitHub
 *   auto_close path deletes the branch at merge, so re-derivation resolves null).
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
 * How an `unruled` halt names what it holds, WITHOUT letting a caller-supplied
 * payload write the reason string. `unruled` arrives off stdin, so it is
 * untrusted: a non-string member would render as `[object Object]` and a long
 * list would make the reason unbounded. So only non-blank STRINGS are named,
 * at most `NAMED_UNRULED` of them, and the count in the sentence around this
 * is taken from the array's real length - a member too odd to name still
 * halts, which is the direction that fails closed.
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
 * Decide whether an autonomous close halts before merge. Total: a non-array
 * `findings`, `unruled` or `overridden` each coerce to [] and never throw.
 *
 * `findings` IS ALREADY DECIDED BEFORE IT GETS HERE, and that is the whole
 * change (LND-02, CONTEXT D-06). It is the genuinely-unfixed halting set the
 * land-cleanup.mjs seam classified out of this branch's ADJUDICATION records
 * through lib/filing-decision.mjs's `unfixedFromEntries` - so a finding that
 * was fixed, refuted, downgraded or overridden is not in it, and does not stop
 * a close. This function reads no `severity` at all any more. It used to
 * filter the halting pair here, which was a third spelling of that module's
 * `HALTING_SEVERITIES` that nothing watched (D-11), and it could not have read
 * a ruling without importing a 500-line validator into a module whose header
 * promises zero deps and no I/O. The rule left here is the whole rule: a
 * NON-EMPTY halting list halts.
 *
 * `risk_surface` is the PRODUCER because it is the only review left that runs
 * on this branch's work and carries `blocking` as its schema default; `/cad-land`
 * fires nothing of its own, so the seam reads the rulings those fires
 * persisted. When auto_close is off the chain is not running unattended, so
 * every arm below proceeds (the manual publish ask owns the decision).
 *
 * `unreadable`: the name of why the findings could not be read at all. Without
 * it a payload nobody could parse coerced to `[]` and came back as `proceed,
 * no surviving blocker/high finding` - an affirmative claim about input this
 * function never saw. Under `auto_close` a named failure is a halt carrying
 * that name; the four names land-cleanup.mjs `readFindings` passes are fixed,
 * and are stated HERE so the pure core and the seam cannot drift:
 *
 *   - `stdin-unreadable`   the read itself failed
 *   - `stdin-empty`        nothing on stdin (D-09: the gate requires an
 *                          explicit `{"findings":[]}`, because a forgotten pipe
 *                          is the likeliest operator error and is otherwise
 *                          indistinguishable from "adjudication killed
 *                          everything")
 *   - `malformed-json`     stdin did not parse
 *   - `not-a-findings-payload`  it parsed, but carried no findings list (a
 *                          valid `{"ok":false,"reason":"dispatch-failed"}`
 *                          envelope is the live shape)
 *
 * `unruled` IS THE FIFTH STATE, and it stands BESIDE those four rather than
 * folding into one of them (D-03, D-13): it names every
 * `REVIEW-risk_surface*.md` the caller found carrying no sibling
 * `ADJUDICATION-*.json`, so the fire happened and nothing ruled it - its
 * findings are neither fixed nor refuted nor declined, and reading past them
 * is exactly the fail-open this requirement closes. Its halt name is
 * `unruled-review`. It is NOT an `unreadable` value: the payload here WAS read
 * and parsed, so the unreadable sentence would be a false statement about
 * input this gate did see.
 *
 * ARM ORDER, and it matters: `unreadable` first (a payload nobody parsed says
 * nothing about anything else), then `unruled`, then the halting list.
 *
 * `overridden` IS CARRIED, NEVER DECIDED ON (D-09). It is the halting set a
 * person already cleared - ruled `survived` at a halting severity, no commit,
 * marked `overridden: true` - and it rides the returned object UNCHANGED on
 * every arm including `proceed`. Folding it into `findings` would re-add the
 * false halt this requirement removes, for the one case somebody already
 * decided, so `action` never moves for it and `/cad-land` keeps branching on
 * `action` alone (D-08).
 *
 * With `auto_close` off the answer stays `proceed` whatever any of these hold.
 * Only a non-empty STRING counts as an `unreadable` failure name, so an
 * unknown value cannot halt a close by accident.
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
