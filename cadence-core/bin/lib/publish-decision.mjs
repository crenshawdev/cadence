// @ts-check
// publish-decision.mjs - the pure core of the git-publish seam: total functions that decide, from config and the live git facts the seam supplies, whether one of its mutating actions may run, and return the exact git argv (minus the -C <dir> prefix the seam adds)
// they never run git or do I/O, and unknown or missing inputs never throw. The seam reads the branch, the remotes and the both-layer auto_close answer, then hands them here
// decidePublish is cad-land's unattended integration-branch push, decideVerificationPublish is /cad-verify's push so CI can run (authorized only by the repo-local cadence.publishForVerification) and decideReap is cad-land's local reap of the merged branch
// decideReap lives here because it needs the same SAFE_BRANCH rule, and duplicating a security-relevant regex across two decision modules is how the two drift

// safe to interpolate into a refspec: it starts alphanumeric so a leading '-' can't read as an option, and carries only word, '.', '_', '/' and '-' chars, so no ':' to smuggle a src:dst refspec and no whitespace or shell metachars
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
// a bare remote name: it starts alphanumeric so it can't read as an option like --mirror or -f, and carries no '/', ':' or '@', so a filesystem path or URL can never stand in as the push destination
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// how the refusal sentences name the user-global file when no path is in hand
const GLOBAL_NAME = 'the user-global config (~/.claude/cadence/config.json, or the file CADENCE_GLOBAL_CONFIG names)';
const SET_IT = '"git": {"auto_close": true}';

/**
 * Which half of the unattended-close authorization was missing, as a sentence the user can act on, or null when both halves opted in. Total: anything that isn't the per-layer answer lib/repo-auto-close.mjs `autoCloseLayers` returns reads as off in both layers, and nothing throws.
 *
 * The close needs `git.auto_close` true in both this repository's `.planning/config.json` and the user-global config. `reason` stays the token `auto-close-off` for every off-state (consumers match it by equality), so which file to fix has to live in this sentence, one per state: neither set, repo-only, global-only, and a file that exists but couldn't be read. That last one comes first and never calls the file the missing half, since it may already carry the key and only a repair can prove it.
 *
 * `shared` is one more cause: the user-global path resolving to this repository's own config file. That's one layer, so the global half reads `unset` and the repo-only sentence would tell the user to set a key the file already sets, advice that can never authorize anything. The sentence names the collapse instead and the verdict doesn't move.
 *
 * No sentence names a `config.mjs set` command: the file and the key stay true whichever write face the user reaches for.
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
 * Decide whether the seam may publish the current branch, and build the exact argv if so. Total: non-array `protectedBranches`/`configuredRemotes` coerce to [], a non-string `currentBranch`/`remote` refuses, nothing throws. Gates run first-failing-wins and every refuse is total (`argv:[]`):
 *   1. not both layers opted in -> 'auto-close-off', plus the `detail` sentence from `authorizationDetail`, the one gate that carries a detail
 *   2-6. no branch, unsafe branch, protected branch, bad remote name, unconfigured remote -> 'no-branch', 'bad-branch', 'protected-branch', 'bad-remote', 'remote-not-configured'
 *   7. else publish.
 *
 * The publish argv is the fully-qualified, non-fast-forward-safe refspec, so the only variable token carrying the branch is the single `refs/heads` token, with a `--` separator before the remote so no variable token can be parsed as an option (defense in depth against a REMOTE_NAME regression reopening option injection): `['push','--set-upstream','--',remote,'refs/heads/<b>:refs/heads/<b>']`.
 *
 * `autoClose` is `autoCloseLayers`' per-layer answer. Gate 1 passes exactly when `authorizationDetail` has nothing to say, so the verdict and its sentence are one reading and can't disagree.
 *
 * @param {{ autoClose?: unknown, currentBranch?: unknown,
 *   protectedBranches?: unknown, remote?: unknown, configuredRemotes?: unknown }} args
 * @returns {{ action:'publish'|'refuse', argv:string[], branch:string|null, remote:string|null, reason:string, detail?:string }}
 */
export function decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes } = {}) {
  // gate 1: auto_close on in both layers, so repo-only, global-only and an unreadable half never publish. The reason stays auto-close-off whichever off-state this is; the detail names the file
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
 * Decide whether the seam may push the current branch so CI can verify it, and build the exact argv if so. Total, like decidePublish. The one authorization is `authorized`, the boolean `publishAuthorized` in lib/publish-authorization.mjs reads from the repository's own `.git/config`; `git.auto_close` isn't an input and authorizes nothing, and only a literal `true` does. Once authorized, the branch and remote gates and the argv are decidePublish's own (`branchPush`), so the two can't drift.
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
 * Gates 2 to 7 of decidePublish, shared with decideVerificationPublish: the branch must exist and be safe and unprotected, the remote a configured bare name, then the fully-qualified refspec.
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

  // the -- separator means neither the remote nor the refspec can be read as an option, even if a REMOTE_NAME regression let a dash through
  return {
    action: /** @type {const} */ ('publish'),
    argv: ['push', '--set-upstream', '--', rem, `refs/heads/${branch}:refs/heads/${branch}`],
    branch,
    remote: rem,
    reason: okReason,
  };
}

/**
 * Decide whether the seam may delete a merged local integration branch, and build the exact argv if so. Total, like decidePublish: a non-array `protectedBranches` coerces to [], a non-string `branch` refuses, nothing throws. Gates run first-failing-wins and every refuse is total (`argv:[]`):
 *   1-3. no branch, unsafe branch, protected branch -> refuse 'no-branch', 'bad-branch', 'protected-branch'
 *   4. branch === currentBranch -> refuse 'current-branch'
 *   5. exists === false -> skip 'already-absent'
 *   6. else reap.
 *
 * Gate 4 exists because git itself refuses to delete the checked-out branch, and a named reason beats a git error the caller has to parse. Gate 5 is how cad-land's idempotency survives the platform's own `--delete-branch` having already removed it: an absent branch is a skip, not a failure.
 *
 * It deliberately doesn't re-derive merged-ness, since `land-cleanup.mjs cleanup` owns that verdict and the auto_close arm's merge lands on the platform, so a local merged check would refuse exactly the case the seam exists for. It doesn't gate on `git.auto_close` either: deleting an already-merged local branch publishes nothing.
 *
 * The argv carries the `--` separator for the same reason decidePublish's does, so the one variable token can't be read as an option even if a SAFE_BRANCH regression let a leading dash through.
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
 * The mutation gate's classifier: the refusal detail when a config layer that could have carried `protected_branches` failed to parse, or null when every layer read cleanly. Total, like the two deciders: a non-array input coerces to [], nothing throws.
 *
 * It lives here and not in git-publish.mjs because that file runs its dispatch at module load and can't be imported, so a rule kept there is reachable only through a subprocess and can't be unit-tested.
 *
 * The question is about the class and not the channel. The old rule refused on any non-empty `warnings[]`, so every diagnostic `mergeLayers` might add stopped a land, and the global-only-key warning had to be routed onto a separate field to avoid that. `tornLayers` names the files that couldn't be used as a config layer at all, the only class that matters here: for such a layer `readProtectedBranches` fell back to `["main","master"]`, so the protected-branch gate in decidePublish/decideReap ran on the default list and not the user's.
 *
 * The detail is the merge's own wording for that layer where there is one, so the envelope keeps saying `failed to parse` / `is not an object` and not a second sentence invented here; the fallback covers a caller that supplies the class without the message.
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
