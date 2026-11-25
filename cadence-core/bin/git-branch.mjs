#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-advice.mjs. It advises whether to create, switch, stay
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
import { adviseBranch } from './lib/branch-advice.mjs';
// shared with the audit so the two can't drift apart
import { readTags } from './lib/git-tags.mjs';
// no flag rule here: arg-contract declares them. `--dir` refuses though this seam mutates nothing, since an advisory
// reader answering about the wrong tree is the same quiet wrong answer (`tags --dir ''` did exactly that)
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';

function decide(dir, branchOverride) {
  // warnings[] rides every result: a torn layer means the advice came from defaults, and the caller has to see that
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  emit({ ok: true, ...adviseBranch(dir, config.git || {}, { branch: branchOverride }), warnings });
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
