#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-decision.mjs. It
// advises rail 1 (references/git-guard.md) whether to create/switch to the
// per-milestone integration branch, stay, or ask - it NEVER runs `checkout -b`
// itself (that is rail 1's job), exactly as git-guard.mjs only advises. One
// JSON line on stdout, exit 0 (seam convention, lib/seam-io.mjs). The tested
// logic lives in lib/branch-decision.mjs; this wraps it with config + prose I/O.
//
// Subcommand (prints one JSON line):
//   decide [--dir <path>] [--branch <name>]
//     --dir     planning root (default cwd); reads <dir>/.planning/config.json,
//               PROJECT.md, ROADMAP.md, and the repo's tag list (`git tag
//               --list`) - the versions already published, none of which a new
//               integration branch may be named after.
//     --branch  override the current branch; when absent, read it via
//               `git -C <dir> rev-parse --abbrev-ref HEAD`, degrading to "" on
//               failure (no repo / no commits -> treated as not-on-a-base).
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName, decideBranch } from './lib/branch-decision.mjs';
// The tag reader moved to lib/ when `planning.mjs audit` became its second
// consumer (FRI-03): one reader of "what has this repo published", the same
// single-reader discipline branch-decision.mjs keeps for the prose version.
import { readTags } from './lib/git-tags.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The argv and file readers this file used to define for itself; both contracts
// and the reason there are two of them live in lib/seam-input.mjs.
import { optionalFlag, readText } from './lib/seam-input.mjs';

/** The current branch of the repo at `dir`, or "" if it cannot be read. */
function readCurrentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

function decide(dir, branchOverride) {
  // warnings[] rides the envelope: every value below - the mode, the auto_branch
  // policy and the protected list - comes off this merge, so a torn layer means
  // this advice was computed from DEFAULTS and the caller has to be able to see
  // that. Present on every result shape, empty array included, the way
  // route.mjs's does (DOC-01).
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const mode = git.integration_branch || 'milestone';
  const autoBranch = git.auto_branch || 'ask';
  // The ONE coercion (lib/protected-branches.mjs): a lone-string
  // protected_branches used to be DROPPED here for the default list, so this
  // seam advised as though the branch the user named were unprotected while
  // git-guard was already honoring it.
  const protectedBranches = resolveProtectedBranches(git);
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const integrationName = integrationBranchName(
    readText(join(dir, '.planning', 'PROJECT.md')),
    readText(join(dir, '.planning', 'ROADMAP.md')),
  );
  // The WHOLE tag list, unranked: `decideBranch` tests membership, so there is
  // nothing to pick a highest from. The ranking helper that used to sit here was
  // deleted with the sort-order comparison it fed - a dead ranking helper beside
  // a membership test is what would invite the sort order back.
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName,
    publishedVersions: readTags(dir) });
  emit({ ok: true, action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason, warnings });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. An adapter
 * binding over lib/seam-input.mjs's reader - this file's own argv, so every
 * call site below keeps its spelling - never a second definition of it. */
const flag = (name) => optionalFlag(argv, name);

try {
  if (cmd === 'decide') {
    decide(flag('--dir') || process.cwd(), flag('--branch'));
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: decide [--dir <path>] [--branch <name>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
