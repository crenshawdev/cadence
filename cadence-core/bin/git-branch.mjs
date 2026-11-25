#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-decision.mjs. It advises whether to create, switch, stay
// or ask on the integration branch, and never runs `checkout -b` itself. One JSON line.
//   decide [--dir <path>] [--branch <name>]
//     --dir is the planning root: absent means cwd, an empty or valueless one refuses (true of `tags` too).
//     It reads the tag list because no integration branch may be named after a published version.
//     On an agile project the branch carries the release's name, and no version is read.
//     --branch overrides the current branch.
//   tags [--dir <path>]
//     Prints `tags[]` for that root, read-only. Any failure is an empty list, not an enclosing repo's releases.
'use strict';

import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { integrationBranchName, releaseBranchName, configuredNameProblem, milestoneVersion, decideBranch } from './lib/branch-decision.mjs';
import { agileDir, releaseFile } from './lib/agile-paths.mjs';
import { readReleaseFile } from './lib/agile-read.mjs';
// shared with the audit so the two can't drift apart
import { readTags } from './lib/git-tags.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
import { readState } from './lib/project-state.mjs';
// reads '' on failure
import { readText } from './lib/seam-input.mjs';
// no flag rule here: arg-contract declares them. `--dir` refuses though this seam mutates nothing, since an advisory
// reader answering about the wrong tree is the same quiet wrong answer (`tags --dir ''` did exactly that)
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
// degrades to "", which reads as not-on-a-base
import { readCurrentBranch } from './lib/git-head.mjs';

function decide(dir, branchOverride) {
  // warnings[] rides every result: a torn layer means the advice came from defaults, and the caller has to see that
  const planning = join(dir, '.planning');
  const { config, warnings } = mergeLayers(join(planning, 'config.json'));
  const git = config.git || {};
  const mode = git.integration_branch || 'milestone';
  const autoBranch = git.auto_branch || 'ask';
  // one coercion for protected_branches, or this advises a named branch unprotected while git-guard honors it
  const protectedBranches = resolveProtectedBranches(git);
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const state = readState(planning);
  const agile = state.kind === 'invalid' && state.reason === 'agile-path';
  // an old-path file left beside a release must not name its branch
  const projectText = agile ? '' : readText(join(planning, 'PROJECT.md'));
  const roadmapText = agile ? '' : readText(join(planning, 'ROADMAP.md'));
  // the configured name wins; one failing the grammar on read is a naming problem, never a `create` under it
  const configured = git.integration_branch_name;
  const nameProblem = configuredNameProblem(configured);
  const integrationName = agile
    ? releaseBranchName(readReleaseFile(readText(releaseFile(agileDir(planning))))?.title ?? '', configured)
    : integrationBranchName(projectText, roadmapText, configured);
  const noName = agile
    ? 'the release in .planning/agile has no name a branch can take - set git.integration_branch_name' : undefined;
  // the guard reads the version itself, so it holds under any branch name
  const version = milestoneVersion(projectText, roadmapText);
  // the whole tag list, unranked: `decideBranch` only tests membership
  // `dir` is the project root, so it's both where the question is asked and the root the answer must belong to
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName, nameProblem,
    noName, version, publishedVersions: readTags(dir, dir) });
  emit({ ok: true, action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason, warnings });
}

/**
 * Every tag this project has published, as `tags[]`: the prose-facing half of lib/git-tags.mjs.
 * The milestone close decides release-or-not from it, and a bare `git tag` answers for any enclosing repo.
 * No config is read, so there's no `warnings[]` to ride.
 */
function tags(dir) {
  emit({ ok: true, tags: readTags(dir, dir) });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows; a subcommand's row wins over the `'*'` row for flags every arm allows. */
const ROWS = CONTRACTS['git-branch.mjs'];
/** One flag of `sub` read through its declared row, never a second statement of what a flag may be. */
const arg = rowReader(argv, ROWS);

try {
  // `--dir` refuses on both axes, so empty, valueless and flag-shaped spellings raise the refusal below; absent is cwd
  // `--branch` falls back, so an unusable value reads as absent and `decide` derives the branch
  if (cmd === 'decide') {
    decide(arg('decide', '--dir') || process.cwd(), arg('decide', '--branch'));
  } else if (cmd === 'tags') {
    tags(arg('tags', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: decide [--dir <path>] [--branch <name>] | tags [--dir <path>]' });
  }
} catch (e) {
  emitCaught(e);
}
