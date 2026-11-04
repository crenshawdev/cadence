#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-decision.mjs. It advises rail 1 (references/git-guard.md)
// whether to create or switch to the integration branch, stay, or ask; it never runs `checkout -b` itself. One JSON line.
//   decide [--dir <path>] [--branch <name>]
//     --dir is the planning root: absent means cwd, an empty or valueless one refuses instead of answering about a tree
//     nobody named (true of `tags` too). It reads config, PROJECT.md, ROADMAP.md and the tag list, because no integration
//     branch may be named after a version already published. --branch overrides the current branch, else it's read from git.
//   tags [--dir <path>]
//     Prints `tags[]` for the repo at that root and only reads. Any failure is an empty list, so a non-repo reads
//     "published nothing" rather than an enclosing repo's releases. Prose uses it to tell a release project from an untagged one.
'use strict';

import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName, decideBranch } from './lib/branch-decision.mjs';
// the shared reader of "what has this repo published", so the audit and this seam can't drift apart
import { readTags } from './lib/git-tags.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// the file reader this file used to define itself; its ''-on-failure contract lives in lib/seam-input.mjs
import { readText } from './lib/seam-input.mjs';
// no flag rule is stated here: lib/arg-contract.mjs declares what `--dir` and `--branch` may be and `requireFlag` raises
// the refusal. `--dir` refuses though this seam mutates nothing, since an advisory reader answering confidently about
// the wrong tree is the same quiet wrong answer (`tags --dir ''` did exactly that).
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
// shared with git-guard.mjs and git-publish.mjs; it degrades to "", which reads as not-on-a-base
import { readCurrentBranch } from './lib/git-head.mjs';

function decide(dir, branchOverride) {
  // warnings[] rides every result: mode, auto_branch and the protected list all come off this merge, so a torn layer
  // means the advice came from defaults and the caller has to be able to see that
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const mode = git.integration_branch || 'milestone';
  const autoBranch = git.auto_branch || 'ask';
  // one coercion for protected_branches: a lone string used to be dropped for the default list, so this advised as though
  // the branch the user named was unprotected while git-guard was already honoring it
  const protectedBranches = resolveProtectedBranches(git);
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const integrationName = integrationBranchName(
    readText(join(dir, '.planning', 'PROJECT.md')),
    readText(join(dir, '.planning', 'ROADMAP.md')),
  );
  // the whole tag list, unranked: `decideBranch` tests membership, and a ranking helper beside a membership test would
  // invite the sort order back. `dir` is the project root (every read above joins `.planning` onto it), so it's both where
  // the question is asked and the root the answer must belong to; a project that isn't a repo mustn't inherit an
  // enclosing repo's tags and get refused over a version it never published.
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName,
    publishedVersions: readTags(dir, dir) });
  emit({ ok: true, action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason, warnings });
}

/**
 * Every tag this project has published, as `tags[]`: the prose-facing half of lib/git-tags.mjs. `workflows/milestone.md`
 * decides whether a close is a release from "has this project ever tagged", and a bare `git tag` answers with whatever
 * repo happens to contain the project. `dir` is both where the question is asked and the root the answer must belong to.
 * No config is read, so there's no `warnings[]` to ride.
 */
function tags(dir) {
  emit({ ok: true, tags: readTags(dir, dir) });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows; a subcommand's row wins over the `'*'` row, where flags allowed on every arm are declared. */
const ROWS = CONTRACTS['git-branch.mjs'];
/** One flag of `sub` read through its declared row. An adapter over argv, never a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // `--dir` refuses on both axes, so empty, valueless and flag-shaped spellings raise the seam refusal below, while an
  // absent one still reads as undefined and falls to cwd. `--branch` falls back, so an unusable value reads as absent
  // and `decide` derives the branch as before.
  if (cmd === 'decide') {
    decide(arg('decide', '--dir') || process.cwd(), arg('decide', '--branch'));
  } else if (cmd === 'tags') {
    tags(arg('tags', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: decide [--dir <path>] [--branch <name>] | tags [--dir <path>]' });
  }
} catch (e) {
  // the raised refusal has no `message`, so without this arm a valueless --dir would emit detail "[object Object]".
  // One JSON line on stdout like every verdict: no workflow reading this seam parses stderr.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
