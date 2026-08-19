#!/usr/bin/env node
// @ts-check
// git-publish.mjs - the ONE seam that actually MUTATES, on two of its three
// subcommands: `publish` and `reap` ACT (they run git), `authorized` only
// ANSWERS - it runs no git, spawns no process at all, and touches nothing. It
// lives here rather than in a file of its own because the question it answers,
// "did this repository authorize an unattended close", is the same question
// gate 1 of `publish` asks, and one seam asking it twice is one place it can
// drift. cad-land's autonomous
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
//     --dir     repo/planning root. An ABSENT --dir is the process cwd; an
//               EMPTY or valueless one REFUSES (`missing-flag-value`, exit 1,
//               nothing run) rather than pushing or reaping in a tree the
//               caller never named (phase 2 D-01). Applies to all three
//               subcommands.
//     --remote  the remote to publish to (default `origin`).
//   reap [--dir <path>] --branch <name>
//     --branch  the merged local integration branch to delete.
//   authorized [--dir <path>]
//     answers only: did this REPOSITORY authorize an unattended publish or
//     merge. Mutates nothing and runs nothing, so a host whose publishing CLI
//     does its own pushing (GitLab: `glab mr create` publishes the source
//     branch itself) still has one authorization answer to consult BEFORE it
//     mutates, instead of no gate at all.
// publish refuses (ok:false + reason, pushes nothing) unless the repo-layer
// git.auto_close is true AND HEAD is a non-protected branch whose name is safe
// AND the remote is a configured bare name. Reads git.auto_close from the REPO
// layer ONLY (never merged/global) to preserve D-08 - and reads the MERGED
// value too, carried only as the `detail` sentence that says which of the two
// authorizations was missing (lib/publish-decision.mjs authorizationDetail).
// The merged value gates no verdict here; it gates the publish ASK in
// skills/cad-land/SKILL.md, which is a different question.
// reap refuses on a missing, unsafe, protected or checked-out branch, and
// SKIPS an already-absent one (ok:true) so a close stays idempotent. It runs no
// merged check - land-cleanup.mjs cleanup owns that verdict - and no auto_close
// check: deleting a local branch publishes nothing.
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
// The repo-layer-only `git.auto_close` read - the value that says the
// REPOSITORY itself authorized the unattended close, never the merged one. Its
// module header carries why it is a raw read and why it must fail closed.
import { repoAutoClose } from './lib/repo-auto-close.mjs';
import { emit } from './lib/seam-io.mjs';
import { authorizationDetail, decidePublish, decideReap, tornLayerRefusal } from './lib/publish-decision.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what each flag may be, and what it costs when it is not, are DECLARED
// rows in lib/arg-contract.mjs, and `requireFlag` raises the refusal in the
// throwing form the catch arm at the foot of this file already renders. `--dir`
// declares `refuse` because it names the tree this seam pushes into and deletes
// branches from, so an empty or valueless one must refuse rather than default
// to the cwd (D-01). Every other flag here declares `fallback` and legitimately
// defaults.
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
// The current-branch reader, shared with git-guard.mjs and git-branch.mjs. It
// degrades to '' rather than throwing; here that '' reaches decidePublish as
// "no branch", which refuses the push.
import { readCurrentBranch } from './lib/git-head.mjs';
import { redactUrl } from './lib/redact-url.mjs';

/** The configured remotes of the repo at `dir` (`git remote`), or [] on failure. */
function readRemotes(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'remote'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
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
 * this gate actually means.
 *
 * It also returns the MERGED `git.auto_close` - the REQUESTED value - because
 * this is the one place the file merges anything, and asking the merge a second
 * question costs nothing while a second `mergeLayers(` callsite would both
 * re-read the same files and move a count self-verify.test.mjs pins tree-wide.
 * The requested value decides NOTHING here: it only tells the refusal sentence
 * whether auto_close is off everywhere or on in the user's home directory with
 * this repository silent. */
function readProtectedBranches(dir) {
  const { config, warnings, tornLayers } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const branches = resolveProtectedBranches(git);
  return { branches, autoCloseRequested: git.auto_close === true, warnings, tornLayers };
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
  // The two resolutions of ONE key, by name at the boundary: `autoClose` is the
  // authorized value (repository layer alone), `autoCloseRequested` the merged
  // one. Only the first can unlock the push.
  const autoClose = repoAutoClose(dir);
  const { branches: protectedBranches, autoCloseRequested, warnings, tornLayers } = readProtectedBranches(dir);

  const decision = decidePublish({ autoClose, autoCloseRequested, currentBranch, protectedBranches, remote, configuredRemotes });
  if (decision.action !== 'publish') {
    // `detail` is undefined on every gate but the auto-close one, and
    // JSON.stringify drops an undefined value, so those envelopes are unchanged.
    emit({ ok: false, reason: decision.reason, branch: decision.branch, remote: decision.remote,
      detail: decision.detail, warnings });
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

/** The read-only arm: did the REPOSITORY at `dir` authorize an unattended
 * publish or merge? Answers the same question `publish`'s gate 1 asks, from the
 * same pure core (lib/publish-decision.mjs authorizationDetail), so the two can
 * never word it differently - one core, two emits.
 *
 * It exists for the hosts whose publishing CLI pushes the branch itself. On
 * GitHub and Forgejo the chain has to come through `publish` to get the branch
 * onto the remote, so the refusal above stops it; on GitLab `glab mr create`
 * publishes the source branch, no seam call happens, and an unattended merge
 * proceeded on a value the repository never set. This arm is what that path
 * consults first (skills/cad-land/SKILL.md step 3(b)).
 *
 * It runs no git and spawns nothing at all - it reads two config layers. That
 * is deliberate: a seam that ran `glab` would put a third-party network CLI's
 * failure modes on the same envelope as a merge authorization.
 *
 * It deliberately does NOT apply `tornLayerRefusal`, unlike the two mutating
 * arms. Nothing mutates here, the repo-layer read already fails closed, and
 * refusing on a torn GLOBAL layer would let one corrupt file in a home
 * directory WITHDRAW a repository's authorization - the direction an
 * authorization check must never fail in. The merge's warnings still ride the
 * envelope, so a torn layer is visible rather than silent. */
function authorized(dir) {
  const authorizedValue = repoAutoClose(dir);
  const { autoCloseRequested, warnings } = readProtectedBranches(dir);
  const detail = authorizationDetail({ requested: autoCloseRequested, authorized: authorizedValue });
  if (detail === null) {
    emit({ ok: true, action: 'repo-authorized', requested: autoCloseRequested, warnings });
    return;
  }
  emit({ ok: false, reason: 'auto-close-off', requested: autoCloseRequested, detail, warnings });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows. A subcommand's own row wins over the `'*'` row,
 * where the flags allowed on every arm - here `--dir` - are declared once. */
const ROWS = CONTRACTS['git-publish.mjs'];
/** One flag of `sub`, read through its DECLARED row. The row owns the rule and
 * this binding owns nothing: it is an adapter over this file's own argv, never
 * a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // `--dir` declares `refuse` on both axes, so a genuinely ABSENT one still
  // reads as undefined and the cwd default below is unchanged while the empty,
  // valueless and flag-shaped spellings raise the refusal the e.seam arm names.
  // `--remote` and `--branch` declare `fallback` (D-12): a spelling carrying no
  // usable value reads as absent, so `|| 'origin'` still answers for the remote
  // and `reap` still refuses `no-branch` rather than reaping a guessed one.
  if (cmd === 'publish') {
    publish(arg('publish', '--dir') || process.cwd(), arg('publish', '--remote') || 'origin');
  } else if (cmd === 'reap') {
    reap(arg('reap', '--dir') || process.cwd(), arg('reap', '--branch'));
  } else if (cmd === 'authorized') {
    authorized(arg('authorized', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: publish [--dir <path>] [--remote <name>] | reap [--dir <path>] --branch <name>'
        + ' | authorized [--dir <path>]' });
  }
} catch (e) {
  // The seam arm is what a `refuse` row costs its bin (D-08/D-09): the raised
  // refusal object carries no `message`, so without this arm a valueless --dir
  // would surface as
  // {"ok":false,"reason":"internal","detail":"[object Object]"}. It goes out
  // through emit on stdout like every other verdict (D-02) - stderr is a
  // channel no workflow reading this seam parses.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail });
  else emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
}
