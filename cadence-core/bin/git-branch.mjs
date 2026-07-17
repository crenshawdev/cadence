#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-decision.mjs. It
// advises rail 1 (references/git.md) whether to create/switch to the
// per-milestone integration branch, stay, or ask - it NEVER runs `checkout -b`
// itself (that is rail 1's job), exactly as git-guard.mjs only advises. One
// JSON line on stdout, exit 0 (seam convention, lib/seam-io.mjs). The tested
// logic lives in lib/branch-decision.mjs; this wraps it with config + prose I/O.
//
// Subcommand (prints one JSON line):
//   decide [--dir <path>] [--branch <name>]
//     --dir     planning root (default cwd); reads <dir>/.planning/config.json,
//               PROJECT.md, ROADMAP.md.
//     --branch  override the current branch; when absent, read it via
//               `git -C <dir> rev-parse --abbrev-ref HEAD`, degrading to "" on
//               failure (no repo / no commits -> treated as not-on-a-base).
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName, decideBranch } from './lib/branch-decision.mjs';

/** Read a file, or "" if missing/unreadable (a missing surface is not fatal). */
function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { return ''; }
}

/** The current branch of the repo at `dir`, or "" if it cannot be read. */
function readCurrentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

function decide(dir, branchOverride) {
  const { config } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const mode = git.integration_branch || 'milestone';
  const autoBranch = git.auto_branch || 'ask';
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches : ['main', 'master'];
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const integrationName = integrationBranchName(
    readText(join(dir, '.planning', 'PROJECT.md')),
    readText(join(dir, '.planning', 'ROADMAP.md')),
  );
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName });
  emit({ ok: true, action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason });
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
  if (cmd === 'decide') {
    decide(flag('--dir') || process.cwd(), flag('--branch'));
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: decide [--dir <path>] [--branch <name>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
