#!/usr/bin/env node
// @ts-check
// git-publish.mjs - the ONE seam that actually PUBLISHES. cad-land's autonomous
// GitHub close (git.auto_close) needs the local-only integration branch on a
// remote before `gh pr create`, and rail 3's push guard (git-guard.mjs) asks on
// every Bash `git push` unconditionally. This seam runs that publish as a
// SUBPROCESS `git push` (execFileSync argv, not a Bash tool call), so the Bash
// PreToolUse hook never sees it and there is no prompt - the code-guarded
// exception that replaced git-guard's deleted command-string exemption.
//
// Why a new file, not a land-cleanup.mjs subcommand: land-cleanup.mjs and its
// lib/close-decision.mjs are ADVISORY - they decide from config + state and
// NEVER run live git. git-publish is the ONE seam that MUTATES (it runs the
// push). Folding a live push into an advisory file would destroy the
// advisory/acting boundary, so it gets its own file, CONTRACTS row, test file,
// and git-* name. All the safety lives in the pure lib/publish-decision.mjs
// (node --test), separated from this thin I/O wrapper (D-10).
//
// Subcommand (prints one JSON line, seam convention lib/seam-io.mjs):
//   publish [--dir <path>] [--remote <name>]
//     --dir     repo/planning root (default cwd).
//     --remote  the remote to publish to (default `origin`).
// The seam refuses (ok:false + reason, pushes nothing) unless the repo-layer
// git.auto_close is true AND HEAD is a non-protected branch whose name is safe
// AND the remote is a configured bare name. Reads git.auto_close from the REPO
// layer ONLY (never merged/global) to preserve D-08.
'use strict';

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { decidePublish } from './lib/publish-decision.mjs';

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

function publish(dir, remote) {
  const currentBranch = readCurrentBranch(dir);
  const configuredRemotes = readRemotes(dir);
  const autoClose = repoAutoClose(dir);
  const { config } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  // Same string tolerance as git-guard (#38): a lone-string hand-edit names
  // the branch the user means to protect; do not silently swap the list.
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches
    : typeof git.protected_branches === 'string'
      ? [git.protected_branches]
      : ['main', 'master'];

  const decision = decidePublish({ autoClose, currentBranch, protectedBranches, remote, configuredRemotes });
  if (decision.action !== 'publish') {
    emit({ ok: false, reason: decision.reason, branch: decision.branch, remote: decision.remote });
    return;
  }

  // The program is the literal 'git' and the args are a JS array (execve, never
  // /bin/sh); no command string is ever built. The only variable tokens are
  // `dir` (right after -C, a path), the validated `remote`, and the `branch`
  // (only inside the refspec decidePublish built). No -c/--config/global option.
  try {
    execFileSync('git', ['-C', dir, ...decision.argv],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    emit({ ok: true, action: 'published', branch: decision.branch, remote: decision.remote });
  } catch (e) {
    emit({ ok: false, reason: 'push-failed', detail: e && e.message ? e.message : String(e) });
  }
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. */
function flag(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

try {
  if (cmd === 'publish') {
    publish(flag('--dir') || process.cwd(), flag('--remote') || 'origin');
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: publish [--dir <path>] [--remote <name>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
