// @ts-check
// branch-advice.mjs - what the next first commit should do about the integration branch, from git and the project's files
// the decision itself is branch-decision.mjs; this is the one place that gathers what it judges, so a start and every
// later commit can't be told different things
'use strict';

import { join } from 'node:path';
import { agileDir, releaseFile } from './agile-paths.mjs';
import { readReleaseFile } from './agile-read.mjs';
import { configuredNameProblem, decideBranch, integrationBranchName, milestoneVersion, releaseBranchName } from './branch-decision.mjs';
// degrades to "", which reads as not-on-a-base
import { readCurrentBranch } from './git-head.mjs';
// shared with the audit so the two can't drift apart
import { readTags } from './git-tags.mjs';
import { onAgilePath } from './project-homes.mjs';
import { resolveProtectedBranches } from './protected-branches.mjs';
// reads '' on failure
import { readText } from './seam-input.mjs';

/**
 * @param {string} dir the project root @param {any} git the merged `git` settings
 * @param {{branch?: string, title?: string}} [given] `branch` overrides the current one, and `title` is a release a start
 *   hasn't written yet
 */
export function adviseBranch(dir, git, { branch: branchOverride, title } = {}) {
  const planning = join(dir, '.planning');
  const mode = git.integration_branch || 'milestone';
  const autoBranch = git.auto_branch || 'ask';
  // one coercion for protected_branches, or this advises a named branch unprotected while git-guard honors it
  const protectedBranches = resolveProtectedBranches(git);
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const agile = title !== undefined || onAgilePath(planning);
  // an old-path file left beside a release must not name its branch
  const projectText = agile ? '' : readText(join(planning, 'PROJECT.md'));
  const roadmapText = agile ? '' : readText(join(planning, 'ROADMAP.md'));
  // the configured name wins; one failing the grammar on read is a naming problem, never a `create` under it
  const configured = git.integration_branch_name;
  const nameProblem = configuredNameProblem(configured);
  const integrationName = agile
    ? releaseBranchName(title ?? readReleaseFile(readText(releaseFile(agileDir(planning))))?.title ?? '', configured)
    : integrationBranchName(projectText, roadmapText, configured);
  const noName = agile ? 'the release has no name a branch can take - set git.integration_branch_name' : undefined;
  // the guard reads the version itself, so it holds under any branch name
  const version = milestoneVersion(projectText, roadmapText);
  // the whole tag list, unranked: `decideBranch` only tests membership
  // `dir` is the project root, so it's both where the question is asked and the root the answer must belong to
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName, nameProblem,
    noName, version, publishedVersions: readTags(dir, dir) });
  return { action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason };
}
