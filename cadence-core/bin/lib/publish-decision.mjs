// @ts-check
// the pure core of git-publish: decides from config and git facts the seam supplies whether a mutating action may run
// and returns the argv minus the -C <dir> prefix. Total functions, no git, no I/O, nothing throws
// decideReap lives here for the same SAFE_BRANCH rule, and a security regex copied across two modules is how they drift

// safe in a refspec: starts alphanumeric so a leading '-' can't read as an option, and has no ':' to smuggle src:dst
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
// a bare remote name: no leading '-' and no '/', ':' or '@', so a path or URL can never be the push destination
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// how the refusal sentences name the user-global file when no path is in hand
const GLOBAL_NAME = 'the user-global config (~/.claude/cadence/config.json, or the file CADENCE_GLOBAL_CONFIG names)';
const SET_IT = '"git": {"auto_close": true}';

/**
 * Which half of the unattended-close authorization is missing, as a sentence the user can act on, or null.
 *
 * It needs `git.auto_close` true in both the repo's config and the user-global one. `reason` stays `auto-close-off`
 * because consumers match it by equality, so the file to fix goes in this sentence. An unreadable file comes first
 * and is never called the missing half, since it may already carry the key.
 *
 * `shared` is the global path resolving to the repo's own config: one layer, so repo-only advice could never work.
 *
 * @param {{ repo?: unknown, global?: unknown, shared?: unknown, globalFile?: unknown }} [layers]
 * @returns {string|null}
 */
export function authorizationDetail(layers) {
  const { repo, global, shared, globalFile } = layers && typeof layers === 'object' ? layers : {};
  if (repo === 'set' && global === 'set') return null;
  const torn = [];
  if (repo === 'unreadable') torn.push("this repository's .planning/config.json");
  if (global === 'unreadable') {
    torn.push(typeof globalFile === 'string' && globalFile
      ? `the user-global config ${globalFile}` : GLOBAL_NAME);
  }
  if (torn.length) {
    return `No unattended publish or merge is authorized: ${torn.join(' and ')} could not be read `
      + 'as a JSON config object, so the git.auto_close opt-in it may carry cannot be proven. '
      + 'Repair that file and re-run.';
  }
  if (shared === true) {
    const named = typeof globalFile === 'string' && globalFile ? `the user-global config ${globalFile}` : 'the user-global config';
    return `No unattended publish or merge is authorized: ${named} resolves to this repository's own `
      + '.planning/config.json, so the two layers are one file, and one file cannot authorize it on its own. '
      + 'Point the user-global config at a separate file (CADENCE_GLOBAL_CONFIG, or ~/.claude/cadence/config.json '
      + `when that is unset) and set ${SET_IT} there.`;
  }
  if (repo === 'set') {
    return "This repository's .planning/config.json sets git.auto_close, but " + GLOBAL_NAME
      + ' does not: a committed repository setting cannot authorize an unattended publish or '
      + `merge on its own. Set ${SET_IT} in the user-global config to authorize it on this machine.`;
  }
  if (global === 'set') {
    return "The user-global config sets git.auto_close, but this repository's .planning/config.json "
      + 'does not: a user-global setting cannot authorize an unattended publish or merge in a '
      + `repository that did not opt in. Set ${SET_IT} in this repository's own .planning/config.json `
      + 'to authorize it here.';
  }
  return 'git.auto_close is set in neither layer, so no unattended publish or merge is authorized. '
    + `It needs ${SET_IT} in BOTH this repository's .planning/config.json and ${GLOBAL_NAME}; `
    + 'either one alone authorizes nothing.';
}

/**
 * Decide whether the seam may publish the current branch, and build the argv. Total: bad input refuses.
 * Gates run first-failing-wins, and every refuse has `argv:[]`:
 *   1. not both layers opted in -> 'auto-close-off', the one gate with a `detail`
 *   2-6. 'no-branch', 'bad-branch', 'protected-branch', 'bad-remote', 'remote-not-configured'
 *   7. else publish.
 *
 * A `--` precedes the remote so nothing parses as an option:
 * `['push','--set-upstream','--',remote,'refs/heads/<b>:refs/heads/<b>']`.
 *
 * Gate 1 passes exactly when `authorizationDetail` is null, so verdict and sentence agree.
 *
 * @param {{ autoClose?: unknown, currentBranch?: unknown,
 *   protectedBranches?: unknown, remote?: unknown, configuredRemotes?: unknown }} args
 * @returns {{ action:'publish'|'refuse', argv:string[], branch:string|null, remote:string|null, reason:string, detail?:string }}
 */
export function decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes } = {}) {
  // both layers must opt in; reason is auto-close-off in every off-state and the detail names the file
  const missing = authorizationDetail(/** @type {any} */ (autoClose));
  if (missing !== null) {
    return { action: 'refuse', argv: [],
      branch: typeof currentBranch === 'string' ? currentBranch : null,
      remote: typeof remote === 'string' ? remote : null,
      reason: 'auto-close-off', detail: missing };
  }
  return branchPush({ currentBranch, protectedBranches, remote, configuredRemotes },
    'sanctioned unattended integration-branch publish');
}

/**
 * Decide whether the seam may push the current branch so CI can verify it. Total, like decidePublish.
 * Only a literal `true` from the repo's own `.git/config` counts; `git.auto_close` authorizes nothing.
 * After that the gates and argv are decidePublish's own via `branchPush`.
 *
 * @param {{ authorized?: unknown, currentBranch?: unknown,
 *   protectedBranches?: unknown, remote?: unknown, configuredRemotes?: unknown }} args
 * @returns {{ action:'publish'|'refuse', argv:string[], branch:string|null, remote:string|null, reason:string, detail?:string }}
 */
export function decideVerificationPublish({ authorized, currentBranch, protectedBranches, remote, configuredRemotes } = {}) {
  if (authorized !== true) {
    return {
      action: 'refuse', argv: [],
      branch: typeof currentBranch === 'string' ? currentBranch : null,
      remote: typeof remote === 'string' ? remote : null,
      reason: 'publish-not-authorized',
      detail: 'cadence.publishForVerification is not true in this repository\'s own .git/config, so nothing is pushed for CI verification. '
        + 'Only that local setting authorizes it: not the user-global config, not .planning/config.json, and not git.auto_close.',
    };
  }
  return branchPush({ currentBranch, protectedBranches, remote, configuredRemotes },
    'sanctioned verification publish');
}

/**
 * Gates 2 to 7 of decidePublish, shared with decideVerificationPublish.
 * @param {{ currentBranch?: unknown, protectedBranches?: unknown, remote?: unknown, configuredRemotes?: unknown }} args
 * @param {string} okReason
 * @returns {{ action:'publish'|'refuse', argv:string[], branch:string|null, remote:string|null, reason:string }}
 */
function branchPush({ currentBranch, protectedBranches, remote, configuredRemotes }, okReason) {
  const protectedList = Array.isArray(protectedBranches) ? protectedBranches : [];
  const remotes = Array.isArray(configuredRemotes) ? configuredRemotes : [];
  const branch = typeof currentBranch === 'string' ? currentBranch : null;
  const rem = typeof remote === 'string' ? remote : null;
  /** @param {string} reason */
  const refuse = (reason) => ({ action: /** @type {const} */ ('refuse'), argv: [], branch, remote: rem, reason });

  if (!branch || branch === 'HEAD') return refuse('no-branch');
  if (!SAFE_BRANCH.test(branch)) return refuse('bad-branch');
  if (protectedList.includes(branch)) return refuse('protected-branch');
  if (!rem || !REMOTE_NAME.test(rem)) return refuse('bad-remote');
  if (!remotes.includes(rem)) return refuse('remote-not-configured');

  // the -- means neither the remote nor the refspec can read as an option
  return {
    action: /** @type {const} */ ('publish'),
    argv: ['push', '--set-upstream', '--', rem, `refs/heads/${branch}:refs/heads/${branch}`],
    branch,
    remote: rem,
    reason: okReason,
  };
}

/**
 * Decide whether the seam may delete a merged local integration branch. Total, like decidePublish.
 * Gates run first-failing-wins:
 *   1-3. 'no-branch', 'bad-branch', 'protected-branch'
 *   4. branch === currentBranch -> refuse 'current-branch', a named reason beats git's error
 *   5. exists === false -> skip 'already-absent', so a close stays idempotent
 *   6. else reap.
 *
 * Merged-ness is `land-cleanup.mjs cleanup`'s call, and `git.auto_close` doesn't gate this: nothing is published.
 * The `--` in the argv covers a SAFE_BRANCH regression letting a leading dash through.
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
 * The mutation gate's classifier: the refusal detail when a layer that could carry `protected_branches` didn't parse.
 *
 * It lives here because git-publish.mjs runs its dispatch at module load and can't be imported to unit-test.
 *
 * It asks about the class, not the channel: refusing on any warning made each new diagnostic stop a land. For a torn
 * layer `readProtectedBranches` fell back to `["main","master"]`, so the protected gate ran on the wrong list.
 * The detail is the merge's own wording where there is one.
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
