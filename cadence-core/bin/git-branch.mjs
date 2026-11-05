#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-decision.mjs. It advises whether to create, switch, stay
// or ask on the integration branch, and never runs `checkout -b` itself. One JSON line.
//   decide [--dir <path>] [--branch <name>]
//     --dir is the planning root: absent means cwd, an empty or valueless one refuses (true of `tags` too).
//     It reads the tag list because no integration branch may be named after a published version.
//     --branch overrides the current branch.
//   tags [--dir <path>]
//     Prints `tags[]` for that root, read-only. Any failure is an empty list, not an enclosing repo's releases.
'use strict';

import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName, decideBranch } from './lib/branch-decision.mjs';
// shared with the audit so the two can't drift apart
import { readTags } from './lib/git-tags.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// reads '' on failure
import { readText } from './lib/seam-input.mjs';
// no flag rule here: arg-contract declares them. `--dir` refuses though this seam mutates nothing, since an advisory
// reader answering about the wrong tree is the same quiet wrong answer (`tags --dir ''` did exactly that)
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
// degrades to "", which reads as not-on-a-base
import { readCurrentBranch } from './lib/git-head.mjs';

function decide(dir, branchOverride) {
  // warnings[] rides every result: a torn layer means the advice came from defaults, and the caller has to see that
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const mode = git.integration_branch || 'milestone';
  const autoBranch = git.auto_branch || 'ask';
  // one coercion for protected_branches, or this advises a named branch unprotected while git-guard honors it
  const protectedBranches = resolveProtectedBranches(git);
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const integrationName = integrationBranchName(
    readText(join(dir, '.planning', 'PROJECT.md')),
    readText(join(dir, '.planning', 'ROADMAP.md')),
  );
  // the whole tag list, unranked: `decideBranch` only tests membership
  // `dir` is the project root, so it's both where the question is asked and the root the answer must belong to
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName,
    publishedVersions: readTags(dir, dir) });
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
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

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
  // the raised refusal has no `message`, so without this arm a valueless --dir would emit detail "[object Object]"
  // one JSON line on stdout like every verdict: no workflow parses stderr
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
