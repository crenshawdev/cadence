#!/usr/bin/env node
// @ts-check
// the one seam that mutates: publish, verify-publish and reap run git, authorized only answers
// a subprocess push, not a Bash call, so git-guard's push ask never fires on an unattended close
// an empty or valueless --dir refuses instead of acting on the cwd
// publish needs git.auto_close true in both the repo and user-global config; either half alone authorizes nothing
// verify-publish is authorized only by cadence.publishForVerification in this repo's own .git/config
// reap skips an absent branch (ok:true) so a close stays idempotent
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
// both layers, never the merged value: each half is a raw read that fails closed
import { autoCloseLayers } from './lib/repo-auto-close.mjs';
import { emit } from './lib/seam-io.mjs';
import { authorizationDetail, decidePublish, decideReap, decideVerificationPublish, tornLayerRefusal } from './lib/publish-decision.mjs';
// the verification publish's authorization read and the env scrub its git calls run under
import { localGitEnv, publishAuthorized } from './lib/publish-authorization.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// requireFlag raises the refusal the catch at the foot renders; --dir refuses when empty so it can't default to the cwd
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
// a failed read degrades to '', which decidePublish sees as no branch and refuses
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

/** The protected-branch list for the repo at `dir`, plus the merge's `warnings` and `tornLayers`.
 *
 * A torn layer means the protected list ran as the default ["main","master"], so both mutating arms refuse on it.
 * Only `tornLayers` counts, not every warning, or each new diagnostic would stop a land.
 *
 * It also returns the merged `git.auto_close`, because a second merge call here would move a count self-verify pins.
 * That value decides nothing: `authorized` reports it as `requested` and the both-layer read is the verdict. */
function readProtectedBranches(dir) {
  const { config, warnings, tornLayers } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const branches = resolveProtectedBranches(git);
  return { branches, autoCloseRequested: git.auto_close === true, warnings, tornLayers };
}

/** Does `refs/heads/<branch>` exist? Always probed with the `refs/heads/` prefix, so a name can't pass as an option. */
function branchExists(dir, branch) {
  if (typeof branch !== 'string' || !branch) return false; // decideReap refuses first
  try {
    execFileSync('git', ['-C', dir, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

/** The next step per gate, keyed by arm then reason, since `no-branch` means different things on publish and reap. */
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

/**
 * The refusal for a torn config layer: the protected list ran as the default, so what it guards must not run.
 * `where` is the branch (and remote) the caller names; `idle` says what stays undone, in the hint's closing clause.
 * @param {{branch: any, remote?: any}} where @param {string} detail @param {any} warnings @param {string} idle
 */
function refuseTorn(where, detail, warnings, idle) {
  emit({ ok: false, reason: 'config-parse-failed', ...where, detail,
    hint: `repair the config layer the detail names so the protected-branch list can be read, then re-run - ${idle} while that list is unprovable`,
    warnings });
}

function publish(dir, remote) {
  const currentBranch = readCurrentBranch(dir);
  const configuredRemotes = readRemotes(dir);
  const autoClose = autoCloseLayers(dir);
  const { branches: protectedBranches, warnings, tornLayers } = readProtectedBranches(dir);

  // checked before decidePublish: a torn layer makes gate 1 report a parse failure as a missing opt-in
  const tornPublish = tornLayerRefusal({ warnings, tornLayers });
  if (tornPublish) {
    refuseTorn({ branch: currentBranch, remote }, tornPublish, warnings, 'nothing is pushed');
    return;
  }

  const decision = decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes });
  if (decision.action !== 'publish') {
    // detail is undefined on every gate but auto-close, and JSON drops undefined
    emit({ ok: false, reason: decision.reason, branch: decision.branch, remote: decision.remote,
      detail: decision.detail, hint: gateHint('publish', decision.reason), warnings });
    return;
  }

  pushDecided(dir, decision, warnings);
}

/** Run the push `decision` built, then emit its envelope. Shared, so the redacting error site exists once.
 *
 * The program is the literal 'git' and args are an array: no shell, no command string, no -c or --config. */
function pushDecided(dir, decision, warnings) {
  try {
    execFileSync('git', ['-C', dir, ...decision.argv],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    emit({ ok: true, action: 'published', branch: decision.branch, remote: decision.remote, warnings });
  } catch (e) {
    // git's stderr can carry the remote URL with userinfo, so redact and cap before it reaches an envelope
    emit({ ok: false, reason: 'push-failed',
      detail: redactAndCap(e && e.message ? e.message : String(e)),
      hint: 'git itself refused: pull and rebase if it names a non-fast-forward, or fix the credentials for this remote, then re-run',
      warnings });
  }
}

/** Push the current branch so CI can run on it, only when this repo's own `.git/config` allows it.
 *
 * The repo-local GIT_* variables are deleted from this process first, so nothing here can be aimed at another repo. */
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

  // a torn layer means the protected list ran as the default, so refuse before the push
  const torn = tornLayerRefusal({ warnings, tornLayers });
  if (torn) {
    refuseTorn({ branch: currentBranch, remote }, torn, warnings, 'nothing is pushed');
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

  // sited at the mutation so other refusals keep their reason and an already-absent skip stays ok:true
  const tornReap = tornLayerRefusal({ warnings, tornLayers });
  if (tornReap) {
    refuseTorn({ branch: decision.branch }, tornReap, warnings, 'no branch is deleted');
    return;
  }

  // execve with a literal 'git' and an array, the name validated and behind `--`, so the branch never becomes shell
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

/** Did both config layers authorize an unattended publish or merge? Same pure core as publish's gate 1, so no drift.
 *
 * Hosts like GitLab push the branch from their own CLI (`glab mr create`) and never reach `publish`.
 *
 * It runs no git, and skips `tornLayerRefusal` because nothing mutates; a torn layer already reads auto-close-off. */
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
/** This script's declared rows. A subcommand's own row wins over the `'*'` row, where flags every arm takes live. */
const ROWS = CONTRACTS['git-publish.mjs'];
/** One flag of `sub`, read through its declared row. The row owns the rule; this just adapts our argv. */
const arg = rowReader(argv, ROWS);

try {
  // --dir refuses when empty, valueless or flag-shaped; --remote and --branch fall back (origin, and reap's no-branch)
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
  // a refusal carries no message, so without this a valueless --dir surfaces as internal "[object Object]"
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
