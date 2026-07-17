// @ts-check
// publish-decision.mjs - the pure, testable core of the git-publish seam (Phase
// 2, GIT-03). Zero-dep (node builtins only, and it uses none): one TOTAL
// function that decides, from repo config + live git facts the seam supplies,
// whether cad-land's sanctioned unattended integration-branch publish may run,
// and if so returns the byte-exact `git push` argv (minus the runtime `-C <dir>`
// prefix the seam prepends). It never runs live git and never does I/O - the
// git-publish.mjs seam reads the branch, the configured remotes, and the
// repo-layer auto_close, then hands them here. Mirrors branch-decision.mjs and
// close-decision.mjs discipline: unknown/missing inputs never throw.

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
 * Decide whether the seam may publish the current branch, and build the exact
 * argv if so. PURE and TOTAL: non-array `protectedBranches`/`configuredRemotes`
 * coerce to [], a non-string `currentBranch`/`remote` yields a refuse, nothing
 * throws. Gates run FIRST-FAILING-WINS; every refuse is total (`argv:[]`):
 *   1. autoClose !== true                       -> 'auto-close-off'
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
 * @param {{ autoClose?: boolean, currentBranch?: unknown, protectedBranches?: unknown,
 *   remote?: unknown, configuredRemotes?: unknown }} args
 * @returns {{ action:'publish'|'refuse', argv:string[], branch:string|null, remote:string|null, reason:string }}
 */
export function decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes } = {}) {
  const protectedList = Array.isArray(protectedBranches) ? protectedBranches : [];
  const remotes = Array.isArray(configuredRemotes) ? configuredRemotes : [];
  const branch = typeof currentBranch === 'string' ? currentBranch : null;
  const rem = typeof remote === 'string' ? remote : null;

  /** @param {string} reason
   *  @returns {{ action:'refuse', argv:string[], branch:string|null, remote:string|null, reason:string }} */
  const refuse = (reason) => ({ action: 'refuse', argv: [], branch, remote: rem, reason });

  // 1. auto_close must be explicitly on (repo layer only; the seam enforces the
  //    layer). Preserves D-08: an off / global-only auto_close never publishes.
  if (autoClose !== true) return refuse('auto-close-off');
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
