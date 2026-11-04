#!/usr/bin/env node
// @ts-check
// git-publish.mjs - the one seam that mutates: publish, verify-publish and reap run git, while authorized only answers and spawns nothing
// authorized lives here because gate 1 of publish asks the same question (did both config layers authorize an unattended close), and one seam asking it twice is one place it can drift
// the push runs as a subprocess (execFileSync argv, not a Bash tool call), so git-guard's unconditional push ask never fires on cad-land's unattended close, and that ask is the one prompt this seam exists to keep out of it
// not a land-cleanup subcommand: that file and lib/close-decision.mjs are advisory and never run live git, and a push folded in would blur the line. The safety lives in the pure lib/publish-decision.mjs and this is a thin I/O wrapper
// every subcommand prints one JSON line and takes --dir: absent means the cwd, while empty or valueless refuses with missing-flag-value and runs nothing, so it never pushes or reaps in a tree the caller didn't name
// publish [--dir <path>] [--remote <name>] (remote defaults to origin) refuses, pushing nothing, unless git.auto_close is true in both this repo's .planning/config.json and the user-global config, HEAD is a safe non-protected branch and the remote is a configured bare name. Either half alone authorizes nothing: a cloned repo's committed config can't turn on an unattended push and a home-directory value can't speak for a repo
// verify-publish [--dir <path>] [--remote <name>] pushes so CI can run on the branch, authorized only by cadence.publishForVerification in this repo's own .git/config (lib/publish-authorization.mjs). Same branch and remote rules as publish, and its git calls run with GIT_DIR and the other repo-local variables removed
// reap [--dir <path>] --branch <name> deletes the merged local integration branch. It refuses a missing, unsafe, protected or checked-out branch and skips an absent one (ok:true) so a close stays idempotent, with no merged check (land-cleanup.mjs cleanup owns that) and no auto_close check, since deleting a local branch publishes nothing
// authorized [--dir <path>] answers only whether both layers authorized an unattended publish or merge, so a host whose CLI pushes itself (glab mr create) still has one answer to consult before it mutates. The layers are read through autoCloseLayers in lib/repo-auto-close.mjs and never the merged value, and the refusal's detail names the file to fix
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
// the both-layer git.auto_close read and never the merged one: each half is a raw read that fails closed
import { autoCloseLayers } from './lib/repo-auto-close.mjs';
import { emit } from './lib/seam-io.mjs';
import { authorizationDetail, decidePublish, decideReap, decideVerificationPublish, tornLayerRefusal } from './lib/publish-decision.mjs';
// the one reader of cadence.publishForVerification, and the env scrub the verification publish's own git calls run under
import { localGitEnv, publishAuthorized } from './lib/publish-authorization.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// flag rules are declared rows in lib/arg-contract.mjs, and requireFlag raises the refusal in the throwing form the catch arm at the foot already renders. --dir declares refuse because it names the tree this seam pushes into and deletes branches from, so an empty or valueless one must refuse and not default to the cwd. Every other flag declares fallback and legitimately defaults
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
// shared with git-guard.mjs and git-branch.mjs. It degrades to '' rather than throwing, and here that reaches decidePublish as "no branch", which refuses the push
import { readCurrentBranch } from './lib/git-head.mjs';
import { redactUrl, redactAndCap } from './lib/redact-url.mjs';

/** The configured remotes of the repo at `dir` (`git remote`), or [] on failure. */
function readRemotes(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'remote'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

/** The protected-branch list for the repo at `dir`, coerced by the shared lib/protected-branches.mjs reader, which carries the #38 lone-string tolerance (a hand-edit names the branch the user means to protect) and the empty-list rule.
 *
 * It returns the merge's `warnings` and its `tornLayers` too, because this list is what stops the one mutating seam from pushing off a protected branch: a torn layer means that refusal is running on the default `["main","master"]`. Both callers put the warnings on their envelope and refuse to mutate on the torn class (`tornLayerRefusal` in lib/publish-decision.mjs).
 *
 * `warnings` is a message channel carrying every diagnostic the merge can produce, and refusing on all of it made each new diagnostic a land-stopper, so `tornLayers` is the class this gate means.
 *
 * It also returns the merged `git.auto_close`, because this is the one place the file merges anything and a second mergeLayers callsite would move a count self-verify pins tree-wide. That value decides nothing: `authorized` reports it as `requested`, so `/cad-land` can tell a user who set one half why the ask came back. The verdict is `autoCloseLayers`' both-layer read. */
function readProtectedBranches(dir) {
  const { config, warnings, tornLayers } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const branches = resolveProtectedBranches(git);
  return { branches, autoCloseRequested: git.auto_close === true, warnings, tornLayers };
}

/** Does `refs/heads/<branch>` exist in the repo at `dir`? The probe is always `refs/heads/` plus the name, so it can never begin with a `-` however the name was spelled, and decideReap's earlier gate refuses an unsafe name regardless. */
function branchExists(dir, branch) {
  if (typeof branch !== 'string' || !branch) return false; // decideReap refuses first
  try {
    execFileSync('git', ['-C', dir, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

/** The next step per gate, keyed on the arm and then on the reason lib/publish-decision.mjs decided. A table because the gates have different remedies and one hint covering all of them would name none, and keyed on the arm because three tokens mean different things on the two (`no-branch` is a detached HEAD when publishing and an unnamed `--branch` when reaping). `gateHint` falls back to a general line, so a new gate still says something and not `undefined`. */
const GATE_HINTS = Object.freeze({
  publish: Object.freeze({
    'auto-close-off': 'the unattended close needs `git.auto_close` true in BOTH this repository\'s `.planning/config.json` and the user-global config - the detail names which file to fix - or push by hand',
    'no-branch': 'check out a branch first - a detached HEAD names nothing to publish',
    'bad-branch': 'rename the branch to plain characters (no leading `-`, no `:`, no shell metacharacters) and re-run',
    'protected-branch': 'publish the integration branch instead, or take this name off `git.protected_branches` if it was never meant to be protected',
    'bad-remote': 'pass --remote a bare remote NAME, never a URL or a path',
    'remote-not-configured': 'run `git remote` and pass --remote one of the names it lists',
  }),
  'verify-publish': Object.freeze({
    'publish-not-authorized': 'run `/cad-config --testing` and answer yes to verification publishing, or publish the branch through `/cad-land`',
    'no-branch': 'check out a branch first - a detached HEAD names nothing to publish',
    'bad-branch': 'rename the branch to plain characters (no leading `-`, no `:`, no shell metacharacters) and re-run',
    'protected-branch': 'check out a non-protected branch - a verification publish never pushes a protected one',
    'bad-remote': 'pass --remote a bare remote NAME, never a URL or a path',
    'remote-not-configured': 'run `git remote` and pass --remote one of the names it lists',
  }),
  reap: Object.freeze({
    'no-branch': 'pass --branch the name of the branch to delete',
    'bad-branch': 'this seam only deletes plainly-named branches (no leading `-`, no `:`, no shell metacharacters) - delete this one by hand if the name is really what you want',
    'protected-branch': 'this repository protects that branch: take the name off `git.protected_branches` if it was never meant to be protected, or delete it by hand',
    'current-branch': 'switch to another branch first - this one cannot be deleted while it is checked out',
  }),
});

/** @param {'publish'|'verify-publish'|'reap'} arm @param {string} reason */
const gateHint = (arm, reason) => (GATE_HINTS[arm] || {})[reason]
  || 'the reason names the gate that stopped this - put the repository into a state that gate accepts, then re-run';

function publish(dir, remote) {
  const currentBranch = readCurrentBranch(dir);
  const configuredRemotes = readRemotes(dir);
  const autoClose = autoCloseLayers(dir);
  const { branches: protectedBranches, warnings, tornLayers } = readProtectedBranches(dir);

  // no push while a config layer is torn, checked before decidePublish: under the both-layer read a torn layer always makes one half false, so gate 1 would answer first and report a parse failure as a missing opt-in. It masks no other gate's reason, since gate 1 is the only one decidePublish can reach with a torn layer. reap keeps its order, it has no auto-close gate
  const tornPublish = tornLayerRefusal({ warnings, tornLayers });
  if (tornPublish) {
    emit({ ok: false, reason: 'config-parse-failed', branch: currentBranch,
      remote, detail: tornPublish,
      hint: 'repair the config layer the detail names so the protected-branch list can be read, then re-run - nothing is pushed while that list is unprovable',
      warnings });
    return;
  }

  const decision = decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes });
  if (decision.action !== 'publish') {
    // detail is undefined on every gate but the auto-close one, and JSON.stringify drops an undefined value, so those envelopes are unchanged
    emit({ ok: false, reason: decision.reason, branch: decision.branch, remote: decision.remote,
      detail: decision.detail, hint: gateHint('publish', decision.reason), warnings });
    return;
  }

  pushDecided(dir, decision, warnings);
}

/** Run the push `decision` built, then emit its envelope. Shared by `publish` and `verify-publish` so the push and the one credential-redacting error site exist once.
 *
 * The program is the literal 'git' and the args are a JS array (execve, never /bin/sh), so no command string is ever built. The only variable tokens are `dir` (right after -C), the validated `remote`, and the `branch` (only inside the refspec the decider built). No -c/--config/global option. */
function pushDecided(dir, decision, warnings) {
  try {
    execFileSync('git', ['-C', dir, ...decision.argv],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    emit({ ok: true, action: 'published', branch: decision.branch, remote: decision.remote, warnings });
  } catch (e) {
    // git's stderr names the remote URL, and on transports that don't anonymize it the URL still carries its userinfo, so this is the one site a credential reaches an envelope through. The remote is the caller's, so the message is free-form: both redactors, then the 1024-byte cap. reap-failed and internal below keep redactUrl only
    emit({ ok: false, reason: 'push-failed',
      detail: redactAndCap(e && e.message ? e.message : String(e)),
      hint: 'git itself refused: pull and rebase if it names a non-fast-forward, or fix the credentials for this remote, then re-run',
      warnings });
  }
}

/** The verification publish: push the current branch so CI can run on it, when and only when this repository's own `.git/config` says `cadence.publishForVerification` is true. `git.auto_close` is not read.
 *
 * The repository-local variables (`GIT_DIR`, ...) are deleted from this process's environment first, the same set lib/publish-authorization.mjs `localGitEnv` removes for its read. It's a one-shot CLI process, so that one scrub covers the branch reader, the remote read and the push, and none of them can be pointed at another repository. */
function verifyPublish(dir, remote) {
  const clean = localGitEnv();
  for (const name of Object.keys(process.env)) if (!(name in clean)) delete process.env[name];
  const currentBranch = readCurrentBranch(dir);
  const { branches: protectedBranches, warnings, tornLayers } = readProtectedBranches(dir);
  const decision = decideVerificationPublish({
    authorized: publishAuthorized(dir), currentBranch, protectedBranches, remote,
    configuredRemotes: readRemotes(dir),
  });
  if (decision.action !== 'publish') {
    emit({ ok: false, reason: decision.reason, branch: decision.branch, remote: decision.remote,
      detail: decision.detail, hint: gateHint('verify-publish', decision.reason), warnings });
    return;
  }

  // the protected-branch list is what stopped a protected push above, so a torn layer (the list ran as the default) refuses here, before the mutation
  const torn = tornLayerRefusal({ warnings, tornLayers });
  if (torn) {
    emit({ ok: false, reason: 'config-parse-failed', branch: currentBranch, remote, detail: torn,
      hint: 'repair the config layer the detail names so the protected-branch list can be read, then re-run - nothing is pushed while that list is unprovable',
      warnings });
    return;
  }
  pushDecided(dir, decision, warnings);
}

function reap(dir, branch) {
  const { branches: protectedBranches, warnings, tornLayers } = readProtectedBranches(dir);
  const decision = decideReap({
    branch,
    currentBranch: readCurrentBranch(dir),
    protectedBranches,
    exists: branchExists(dir, branch),
  });
  if (decision.action === 'skip') {
    // idempotent close: the platform's own --delete-branch may already have taken it, and nothing to do is a success
    emit({ ok: true, action: 'already-absent', branch: decision.branch, warnings });
    return;
  }
  if (decision.action !== 'reap') {
    emit({ ok: false, reason: decision.reason, branch: decision.branch,
      hint: gateHint('reap', decision.reason), warnings });
    return;
  }

  // no branch deletion while the protected list is unprovable. Sited at the mutation so every refusal decideReap reached keeps its own reason and reap's already-absent skip above stays ok:true: a torn layer must not break a re-run that deletes nothing
  const tornReap = tornLayerRefusal({ warnings, tornLayers });
  if (tornReap) {
    emit({ ok: false, reason: 'config-parse-failed', branch: decision.branch,
      detail: tornReap,
      hint: 'repair the config layer the detail names so the protected-branch list can be read, then re-run - no branch is deleted while that list is unprovable',
      warnings });
    return;
  }

  // same execve discipline as publish: the program is the literal 'git', the args are a JS array, and the only variable tokens are `dir` (right after -C) and the SAFE_BRANCH-validated name behind a `--` separator. Running the reap here and not as Bash prose is what keeps the branch name from ever becoming shell
  try {
    execFileSync('git', ['-C', dir, ...decision.argv],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    emit({ ok: true, action: 'reaped', branch: decision.branch, warnings });
  } catch (e) {
    emit({ ok: false, reason: 'reap-failed', branch: decision.branch,
      detail: redactUrl(e && e.message ? e.message : String(e)),
      hint: 'git itself refused the delete - an unmerged branch is the usual cause, so confirm it merged before deleting it by hand',
      warnings });
  }
}

/** The read-only arm: did both config layers authorize an unattended publish or merge of the repository at `dir`? It asks the same question publish's gate 1 asks, from the same pure core (lib/publish-decision.mjs authorizationDetail), so the two can never word it differently.
 *
 * It exists for hosts whose publishing CLI pushes the branch itself. On GitHub and Forgejo the chain has to come through `publish` to get the branch onto the remote, so the refusal stops it there; on GitLab `glab mr create` publishes the source branch, no seam call happens, and an unattended merge proceeded on a value nobody authorized. This arm is what that path consults first.
 *
 * It runs no git and spawns nothing, because a seam that ran `glab` would put a third-party network CLI's failure modes on the same envelope as a merge authorization.
 *
 * It deliberately does not apply `tornLayerRefusal`, unlike the two mutating arms: nothing mutates here, and the both-layer read already fails closed on a torn layer (that half reads `unreadable`, so the answer is `auto-close-off` with a detail naming the file that could not be read). The merge's warnings still ride the envelope. */
function authorized(dir) {
  const { autoCloseRequested, warnings } = readProtectedBranches(dir);
  const detail = authorizationDetail(autoCloseLayers(dir));
  if (detail === null) {
    emit({ ok: true, action: 'repo-authorized', requested: autoCloseRequested, warnings });
    return;
  }
  emit({ ok: false, reason: 'auto-close-off', requested: autoCloseRequested, detail,
    hint: gateHint('publish', 'auto-close-off'), warnings });
}


const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows. A subcommand's own row wins over the `'*'` row, where the flags allowed on every arm (here `--dir`) are declared once. */
const ROWS = CONTRACTS['git-publish.mjs'];
/** One flag of `sub`, read through its declared row. The row owns the rule; this is an adapter over this file's own argv and never a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // --dir declares refuse on both axes, so a genuinely absent one still reads as undefined and the cwd default below is unchanged, while empty, valueless and flag-shaped spellings raise the refusal the e.seam arm names. --remote and --branch declare fallback, so a spelling with no usable value reads as absent: || 'origin' still answers for the remote and reap still refuses no-branch and doesn't reap a guessed one
  if (cmd === 'publish') {
    publish(arg('publish', '--dir') || process.cwd(), arg('publish', '--remote') || 'origin');
  } else if (cmd === 'verify-publish') {
    verifyPublish(arg('verify-publish', '--dir') || process.cwd(), arg('verify-publish', '--remote') || 'origin');
  } else if (cmd === 'reap') {
    reap(arg('reap', '--dir') || process.cwd(), arg('reap', '--branch'));
  } else if (cmd === 'authorized') {
    authorized(arg('authorized', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: publish [--dir <path>] [--remote <name>] | verify-publish [--dir <path>] [--remote <name>] | reap [--dir <path>] --branch <name>'
        + ' | authorized [--dir <path>]' });
  }
} catch (e) {
  // the seam arm is what a refuse row costs its bin: the raised refusal carries no message, so a valueless --dir would surface as {"ok":false,"reason":"internal","detail":"[object Object]"}. It goes out through emit on stdout like every verdict, since stderr is a channel no workflow reading this seam parses
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
