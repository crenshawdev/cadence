#!/usr/bin/env node
// @ts-check
// git-publish.mjs - the ONE seam that actually MUTATES. cad-land's autonomous
// GitHub close (git.auto_close) needs the local-only integration branch on a
// remote before `gh pr create`, and rail 3's push guard (git-guard.mjs) asks on
// every Bash `git push` unconditionally. This seam runs its git as a SUBPROCESS
// (execFileSync argv, not a Bash tool call), so the Bash PreToolUse hook never
// sees it and there is no prompt - the code-guarded exception that replaced
// git-guard's deleted command-string exemption. (TOK-02 later deleted the
// destructive rail, so a Bash `git branch -D` no longer prompts at all; the
// push guard's unconditional ask is the one prompt this seam still exists to
// keep out of the unattended close.)
//
// Why a new file, not a land-cleanup.mjs subcommand: land-cleanup.mjs and its
// lib/close-decision.mjs are ADVISORY - they decide from config + state and
// NEVER run live git. git-publish is the one seam that ACTS (it runs the push
// and the reap). Folding a live push into an advisory file would destroy the
// advisory/acting boundary, so it gets its own file, CONTRACTS row, test file,
// and git-* name - and the reap lands here for the same reason rather than
// beside the advice that gates it. All the safety lives in the pure
// lib/publish-decision.mjs (node --test), separated from this thin I/O wrapper
// (D-10).
//
// Subcommands (each prints one JSON line, seam convention lib/seam-io.mjs):
//   publish [--dir <path>] [--remote <name>]
//     --dir     repo/planning root (default cwd).
//     --remote  the remote to publish to (default `origin`).
//   reap [--dir <path>] --branch <name>
//     --branch  the merged local integration branch to delete.
// publish refuses (ok:false + reason, pushes nothing) unless the repo-layer
// git.auto_close is true AND HEAD is a non-protected branch whose name is safe
// AND the remote is a configured bare name. Reads git.auto_close from the REPO
// layer ONLY (never merged/global) to preserve D-08.
// reap refuses on a missing, unsafe, protected or checked-out branch, and
// SKIPS an already-absent one (ok:true) so a close stays idempotent. It runs no
// merged check - land-cleanup.mjs cleanup owns that verdict - and no auto_close
// check: deleting a local branch publishes nothing.
'use strict';

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { decidePublish, decideReap, tornLayerRefusal } from './lib/publish-decision.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The argv reader this file used to define for itself; both flag contracts and
// the reason there are two of them live in lib/seam-input.mjs.
import { optionalFlag } from './lib/seam-input.mjs';
import { redactUrl } from './lib/redact-url.mjs';

/** The current branch of the repo at `dir`, or "" if it cannot be read. */
function readCurrentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

/** The configured remotes of the repo at `dir` (`git remote`), or [] on failure. */
function readRemotes(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'remote'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

// git.auto_close from the REPO config layer ONLY (never the merged/global value):
// a user-global auto_close must never enable an unattended publish in an
// unrelated project (D-08). Missing/bad/global-only -> false.
function repoAutoClose(dir) {
  try {
    const repo = JSON.parse(readFileSync(join(dir, '.planning', 'config.json'), 'utf8'));
    return repo?.git?.auto_close === true;
  } catch { return false; }
}

/** The protected-branch list for the repo at `dir`, coerced by the ONE shared
 * reader lib/protected-branches.mjs - which carries the #38 lone-string
 * tolerance (a hand-edit names the branch the user means to protect; do not
 * silently swap the list) and the empty-list rule.
 *
 * Returns the merge's `warnings` AND its `tornLayers` alongside the list rather
 * than dropping either: this list is what stops the ONE mutating seam from
 * pushing off a protected branch, so a torn layer means that refusal is running
 * on the default `["main","master"]` and not on the user's. Both callers put
 * the warnings on their envelope AND refuse to mutate on the torn class - see
 * `tornLayerRefusal` in lib/publish-decision.mjs.
 *
 * The two are separate answers on purpose. `warnings` is a MESSAGE channel that
 * carries every diagnostic the merge can produce; refusing on all of it made
 * each new diagnostic a land-stopper, which is why phase 1 had to route its
 * global-only-key warning around this seam (D-18). `tornLayers` is the CLASS
 * this gate actually means. */
function readProtectedBranches(dir) {
  const { config, warnings, tornLayers } = mergeLayers(join(dir, '.planning', 'config.json'));
  const branches = resolveProtectedBranches(config.git || {});
  return { branches, warnings, tornLayers };
}

/** Does `refs/heads/<branch>` exist in the repo at `dir`? The probe argument is
 * always `refs/heads/` + the name, so it can never begin with a `-` however the
 * name was spelled - and an unsafe name is refused by decideReap's earlier gate
 * regardless of what this answers. */
function branchExists(dir, branch) {
  if (typeof branch !== 'string' || !branch) return false; // decideReap refuses first
  try {
    execFileSync('git', ['-C', dir, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

function publish(dir, remote) {
  const currentBranch = readCurrentBranch(dir);
  const configuredRemotes = readRemotes(dir);
  const autoClose = repoAutoClose(dir);
  const { branches: protectedBranches, warnings, tornLayers } = readProtectedBranches(dir);

  const decision = decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes });
  if (decision.action !== 'publish') {
    emit({ ok: false, reason: decision.reason, branch: decision.branch, remote: decision.remote, warnings });
    return;
  }

  // No push while the protected list is unprovable (lib/publish-decision.mjs
  // `tornLayerRefusal`). Sited at the MUTATION rather than right after the
  // destructure, deliberately: every non-mutating arm keeps the answer it has
  // today, so a refusal decidePublish already reached keeps its own named reason
  // instead of being masked by this one. Nothing between the destructure and
  // here does I/O beyond reading git facts.
  const tornPublish = tornLayerRefusal({ warnings, tornLayers });
  if (tornPublish) {
    emit({ ok: false, reason: 'config-parse-failed', branch: decision.branch,
      remote: decision.remote, detail: tornPublish, warnings });
    return;
  }

  // The program is the literal 'git' and the args are a JS array (execve, never
  // /bin/sh); no command string is ever built. The only variable tokens are
  // `dir` (right after -C, a path), the validated `remote`, and the `branch`
  // (only inside the refspec decidePublish built). No -c/--config/global option.
  try {
    execFileSync('git', ['-C', dir, ...decision.argv],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    emit({ ok: true, action: 'published', branch: decision.branch, remote: decision.remote, warnings });
  } catch (e) {
    // git's stderr names the remote URL, and on the transports it does not
    // anonymize that URL still carries its userinfo - this is the one site a
    // credential actually reaches an envelope through (lib/redact-url.mjs).
    emit({ ok: false, reason: 'push-failed', detail: redactUrl(e && e.message ? e.message : String(e)), warnings });
  }
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
    // Idempotent close: the platform's own --delete-branch may already have
    // taken it. Nothing to do is a success, not a failure.
    emit({ ok: true, action: 'already-absent', branch: decision.branch, warnings });
    return;
  }
  if (decision.action !== 'reap') {
    emit({ ok: false, reason: decision.reason, branch: decision.branch, warnings });
    return;
  }

  // No branch deletion while the protected list is unprovable - this is the arm
  // the reproduction hit. Sited at the MUTATION for the reason publish states,
  // and it is what keeps `reap`'s already-absent SKIP above at `ok:true`:
  // cad-land's close is idempotent, and a torn layer must not break a re-run
  // that deletes nothing.
  const tornReap = tornLayerRefusal({ warnings, tornLayers });
  if (tornReap) {
    emit({ ok: false, reason: 'config-parse-failed', branch: decision.branch,
      detail: tornReap, warnings });
    return;
  }

  // Same execve discipline as publish: the program is the literal 'git', the
  // args are a JS array, no command string is ever built, and the only variable
  // tokens are `dir` (right after -C) and the SAFE_BRANCH-validated name behind
  // a `--` end-of-options separator. The rail this comment used to cite was the
  // destructive-op guard v2.2.0 deleted, so a Bash `git branch -D` now prompts
  // nowhere at all (see the header): running the reap here rather than as Bash
  // prose is what keeps the branch name from ever becoming shell, and the one
  // prompt this seam still exists to keep out of the unattended close is the
  // push guard's unconditional ask on the publish half
  // (references/git-publish.md rail 3).
  try {
    execFileSync('git', ['-C', dir, ...decision.argv],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    emit({ ok: true, action: 'reaped', branch: decision.branch, warnings });
  } catch (e) {
    emit({ ok: false, reason: 'reap-failed', branch: decision.branch, detail: redactUrl(e && e.message ? e.message : String(e)), warnings });
  }
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. An adapter
 * binding over lib/seam-input.mjs's reader - this file's own argv, so every
 * call site below keeps its spelling - never a second definition of it. */
const flag = (name) => optionalFlag(argv, name);

try {
  if (cmd === 'publish') {
    publish(flag('--dir') || process.cwd(), flag('--remote') || 'origin');
  } else if (cmd === 'reap') {
    reap(flag('--dir') || process.cwd(), flag('--branch'));
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: publish [--dir <path>] [--remote <name>] | reap [--dir <path>] --branch <name>' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
