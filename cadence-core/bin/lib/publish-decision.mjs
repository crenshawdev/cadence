// @ts-check
// publish-decision.mjs - the pure, testable core of the git-publish seam (Phase
// 2, GIT-03). Zero-dep (node builtins only, and it uses none): TOTAL functions
// that decide, from repo config + live git facts the seam supplies, whether one
// of the seam's two mutating actions may run, and if so return the byte-exact
// git argv (minus the runtime `-C <dir>` prefix the seam prepends). They never
// run live git and never do I/O - the git-publish.mjs seam reads the branch, the
// configured remotes, and the repo-layer auto_close, then hands them here.
// Mirrors branch-decision.mjs and close-decision.mjs discipline:
// unknown/missing inputs never throw.
//
//   decidePublish - cad-land's sanctioned unattended integration-branch push.
//   decideReap    - cad-land's local reap of the merged integration branch.
//
// decideReap lives HERE rather than in a lib of its own because it needs the
// same SAFE_BRANCH rule, and duplicating a security-relevant regex across two
// decision modules is how the two drift.

// A branch name safe to interpolate into a refspec: starts with an alphanumeric
// (forbids a leading '-' so a branch can never be read as an option) and carries
// only word/`.`/`_`/`/`/`-` chars (no ':', so it can never smuggle a `src:dst`
// refspec, no whitespace or shell metachars).
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
// A bare remote NAME: starts with an alphanumeric (forbids a leading '-' so the
// remote can never be read as an option like `--mirror`/`-f`, mirroring
// SAFE_BRANCH's anchor) and carries no '/', ':', or '@', so a filesystem path or
// URL can never stand in as the push destination.
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Which authorization was missing, as a sentence the user can act on - or null
 * when the repository did authorize the unattended close. PURE and TOTAL: any
 * non-`true` input reads as off, nothing throws.
 *
 * One key, `git.auto_close`, now has TWO resolutions, and the reason this
 * function exists is that a single refusal token cannot tell them apart:
 *
 *   requested  - the MERGED global+repo value. It is presentation: `/cad-land`
 *                skips the publish ask on it, and `land-cleanup.mjs gate` reads
 *                the same value so its halt covers the runs that skipped the
 *                human.
 *   authorized - the REPOSITORY layer alone (lib/repo-auto-close.mjs). Only it
 *                may unlock a mutation of somebody else's project.
 *
 * The interesting state is the one where they disagree: a `true` in the user's
 * own home directory means the run believes it is unattended while nothing in
 * the repository ever said so. `reason` stays the token `auto-close-off` for
 * both states (it is asserted by equality across the seam tests and changing
 * its text buys no behaviour), so the distinction has to live in a sentence.
 *
 * @param {{ requested?: unknown, authorized?: unknown }} [args]
 * @returns {string|null}
 */
export function authorizationDetail({ requested, authorized } = {}) {
  if (authorized === true) return null;
  if (requested === true) {
    return 'git.auto_close is true in the merged config, but this repository never set it: '
      + 'a user-global setting cannot authorize an unattended publish or merge in a repository '
      + 'that did not opt in. Set "git": {"auto_close": true} in this repository\'s own '
      + '.planning/config.json to authorize it here.';
  }
  return 'git.auto_close is not true anywhere, so no unattended publish or merge is authorized. '
    + 'A repository opts in by setting "git": {"auto_close": true} in its own '
    + '.planning/config.json; a user-global setting cannot opt in on its behalf.';
}

/**
 * Decide whether the seam may publish the current branch, and build the exact
 * argv if so. PURE and TOTAL: non-array `protectedBranches`/`configuredRemotes`
 * coerce to [], a non-string `currentBranch`/`remote` yields a refuse, nothing
 * throws. Gates run FIRST-FAILING-WINS; every refuse is total (`argv:[]`):
 *   1. autoClose !== true    -> 'auto-close-off', plus the `detail` sentence
 *      `authorizationDetail` words from the requested/authorized pair - the ONE
 *      gate that carries a detail, so every other refusal's envelope is
 *      unchanged
 *   2. no branch / detached HEAD                 -> 'no-branch'
 *   3. branch fails SAFE_BRANCH                   -> 'bad-branch'
 *   4. branch is protected                        -> 'protected-branch'
 *   5. remote fails REMOTE_NAME                    -> 'bad-remote'
 *   6. remote not in configuredRemotes             -> 'remote-not-configured'
 *   7. else publish.
 *
 * The publish argv is the fully-qualified, non-fast-forward-safe refspec so the
 * only variable token that carries the branch is the single `refs/heads` token,
 * with a `--` end-of-options separator before the remote so no variable token
 * can ever be parsed as an option (defense-in-depth against a REMOTE_NAME
 * regression reopening option injection):
 * `['push','--set-upstream','--',remote,'refs/heads/<b>:refs/heads/<b>']`.
 *
 * `autoClose` is the AUTHORIZED value (repo layer only); `autoCloseRequested` is
 * the merged one and is optional, carrying no verdict at all - it only tells
 * gate 1's sentence which of the two off-states the caller is in.
 *
 * @param {{ autoClose?: boolean, autoCloseRequested?: unknown, currentBranch?: unknown,
 *   protectedBranches?: unknown, remote?: unknown, configuredRemotes?: unknown }} args
 * @returns {{ action:'publish'|'refuse', argv:string[], branch:string|null, remote:string|null, reason:string, detail?:string }}
 */
export function decidePublish({ autoClose, autoCloseRequested, currentBranch, protectedBranches, remote, configuredRemotes } = {}) {
  const protectedList = Array.isArray(protectedBranches) ? protectedBranches : [];
  const remotes = Array.isArray(configuredRemotes) ? configuredRemotes : [];
  const branch = typeof currentBranch === 'string' ? currentBranch : null;
  const rem = typeof remote === 'string' ? remote : null;

  /** @param {string} reason
   *  @returns {{ action:'refuse', argv:string[], branch:string|null, remote:string|null, reason:string, detail?:string }} */
  const refuse = (reason) => ({ action: 'refuse', argv: [], branch, remote: rem, reason });

  // 1. auto_close must be explicitly on (repo layer only; the seam enforces the
  //    layer). Preserves D-08: an off / global-only auto_close never publishes.
  //    The reason token stays `auto-close-off` whichever off-state this is; the
  //    detail is what tells "off everywhere" from "requested globally, never
  //    authorized here".
  if (autoClose !== true) {
    return { ...refuse('auto-close-off'),
      detail: /** @type {string} */ (authorizationDetail({ requested: autoCloseRequested, authorized: autoClose })) };
  }
  // 2. A branch must exist and not be the detached-HEAD sentinel.
  if (!branch || branch === 'HEAD') return refuse('no-branch');
  // 3. The branch must be interpolation-safe (no leading '-', ':', or metachars).
  if (!SAFE_BRANCH.test(branch)) return refuse('bad-branch');
  // 4. Never publish a protected branch.
  if (protectedList.includes(branch)) return refuse('protected-branch');
  // 5. The remote must be a bare name, never a path/URL destination.
  if (!rem || !REMOTE_NAME.test(rem)) return refuse('bad-remote');
  // 6. The remote must actually be configured (`git remote`).
  if (!remotes.includes(rem)) return refuse('remote-not-configured');

  // 7. Sanctioned publish: fully-qualified refspec, branch only inside it, with a
  //    `--` end-of-options separator so neither remote nor refspec can be read as
  //    an option even if a future REMOTE_NAME regression let a dash through.
  return {
    action: 'publish',
    argv: ['push', '--set-upstream', '--', rem, `refs/heads/${branch}:refs/heads/${branch}`],
    branch,
    remote: rem,
    reason: 'sanctioned unattended integration-branch publish',
  };
}

/**
 * Decide whether the seam may delete a merged local integration branch, and
 * build the exact argv if so. PURE and TOTAL, same discipline as decidePublish:
 * a non-array `protectedBranches` coerces to [], a non-string `branch` refuses,
 * nothing throws. Gates run FIRST-FAILING-WINS; every refuse is total
 * (`argv:[]`):
 *   1. no branch / not a string / empty        -> refuse 'no-branch'
 *   2. branch fails SAFE_BRANCH                 -> refuse 'bad-branch'
 *   3. branch is protected                      -> refuse 'protected-branch'
 *   4. branch === currentBranch                  -> refuse 'current-branch'
 *   5. exists === false                          -> skip   'already-absent'
 *   6. else reap.
 *
 * Gate 4 exists because git itself refuses to delete the checked-out branch
 * ("error: cannot delete branch 'main' used by worktree at ..."), and a named
 * reason beats a git error the caller has to parse. Gate 5 is how cad-land's
 * stated idempotency survives the platform's own `--delete-branch` having
 * already removed it: an absent branch is a SKIP, not a failure.
 *
 * It deliberately does NOT re-derive merged-ness: `land-cleanup.mjs cleanup`
 * owns that verdict, and the auto_close arm's merge lands on the platform, so a
 * local merged check would refuse exactly the case the seam exists for. It also
 * deliberately does NOT gate on `git.auto_close`: deleting an already-merged
 * local branch publishes nothing and needs no publish authorization, unlike
 * `publish`.
 *
 * The argv carries the `--` end-of-options separator for the same reason
 * decidePublish's does - verified accepted by git 2.55 - so the one variable
 * token can never be read as an option even if a future SAFE_BRANCH regression
 * let a leading dash through.
 *
 * @param {{ branch?: unknown, currentBranch?: unknown, protectedBranches?: unknown,
 *   exists?: unknown }} args
 * @returns {{ action:'reap'|'skip'|'refuse', argv:string[], branch:string|null, reason:string }}
 */
export function decideReap({ branch, currentBranch, protectedBranches, exists } = {}) {
  const protectedList = Array.isArray(protectedBranches) ? protectedBranches : [];
  const name = typeof branch === 'string' && branch ? branch : null;

  /** @param {'skip'|'refuse'} action
   *  @param {string} reason
   *  @returns {{ action:'skip'|'refuse', argv:string[], branch:string|null, reason:string }} */
  const stop = (action, reason) => ({ action, argv: [], branch: name, reason });

  if (!name) return stop('refuse', 'no-branch');
  if (!SAFE_BRANCH.test(name)) return stop('refuse', 'bad-branch');
  if (protectedList.includes(name)) return stop('refuse', 'protected-branch');
  if (name === currentBranch) return stop('refuse', 'current-branch');
  if (exists === false) return stop('skip', 'already-absent');

  return {
    action: 'reap',
    argv: ['branch', '-D', '--', name],
    branch: name,
    reason: 'merged integration branch reaped locally',
  };
}

/**
 * The mutation gate's classifier: the refusal detail when a config layer that
 * could have carried `protected_branches` failed to parse, or null when every
 * layer read cleanly. PURE and TOTAL, same discipline as the two deciders - a
 * non-array input coerces to [], nothing throws.
 *
 * It lives HERE rather than in git-publish.mjs for the reason that file's header
 * gives for the deciders: git-publish.mjs runs its dispatch at module load and
 * cannot be imported, so a rule kept there is reachable only through a
 * subprocess and cannot be unit-tested at all.
 *
 * The question is deliberately about the CLASS, not about the channel. The
 * shipped rule refused on any non-empty `warnings[]`, so every diagnostic
 * `mergeLayers` might ever add stopped a land - phase 1's global-only-key
 * warning had to be routed onto a separate field to avoid exactly that (D-18).
 * `tornLayers` names the files whose content could not be used as a config layer
 * at all, which is the only class that matters here: for such a layer
 * `readProtectedBranches` fell back to `["main","master"]`, so the
 * protected-branch gate inside decidePublish/decideReap ran on the DEFAULT list
 * and not on the user's.
 *
 * The detail is the merge's own wording for that layer where there is one, so
 * the envelope keeps saying `failed to parse` / `is not an object` rather than a
 * second sentence invented here; the fallback covers a caller that supplies the
 * class without the message.
 *
 * @param {{ warnings?: unknown, tornLayers?: unknown }} [merged]
 * @returns {string|null}
 */
export function tornLayerRefusal({ warnings, tornLayers } = {}) {
  const torn = (Array.isArray(tornLayers) ? tornLayers : [])
    .filter((f) => typeof f === 'string' && f !== '');
  if (!torn.length) return null;
  const said = (Array.isArray(warnings) ? warnings : [])
    .filter((w) => typeof w === 'string')
    .find((w) => torn.some((f) => w.includes(f)));
  return said || `config layer ${torn[0]} could not be read as a config layer`;
}
