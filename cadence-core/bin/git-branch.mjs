#!/usr/bin/env node
// @ts-check
// git-branch.mjs - the workflow-facing seam over lib/branch-decision.mjs. It
// advises rail 1 (references/git-guard.md) whether to create/switch to the
// per-milestone integration branch, stay, or ask - it NEVER runs `checkout -b`
// itself (that is rail 1's job), exactly as git-guard.mjs only advises. One
// JSON line on stdout, exit 0 (seam convention, lib/seam-io.mjs). The tested
// logic lives in lib/branch-decision.mjs; this wraps it with config + prose I/O.
//
// Subcommands (each prints one JSON line):
//   decide [--dir <path>] [--branch <name>]
//     --dir     planning root. ABSENT means the process cwd; an EMPTY or
//               valueless --dir REFUSES (`missing-flag-value`, exit 1) rather
//               than answering about a tree the caller never named (phase 2
//               D-01) - true of `tags` too. Reads <dir>/.planning/config.json,
//               PROJECT.md, ROADMAP.md, and the repo's tag list (`git tag
//               --list`) - the versions already published, none of which a new
//               integration branch may be named after.
//     --branch  override the current branch; when absent, read it via
//               `git -C <dir> rev-parse --abbrev-ref HEAD`, degrading to "" on
//               failure (no repo / no commits -> treated as not-on-a-base).
//   tags [--dir <path>]
//     --dir     project root (same refusal rule as above); prints `tags[]` -
//               every tag the repository AT that root carries, in
//               `git tag --list` order.
//               Read-only in the strongest sense: `git rev-parse` and `git tag
//               --list` and nothing else, degrading to an empty list on every
//               failure, so a caller in a non-repository reads "this project
//               has published nothing" rather than an enclosing repository's
//               releases (TAG-01). Prose asks this to tell a release project
//               from one that has never tagged.
'use strict';

import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName, decideBranch } from './lib/branch-decision.mjs';
// The tag reader moved to lib/ when `planning.mjs audit` became its second
// consumer (FRI-03): one reader of "what has this repo published", the same
// single-reader discipline branch-decision.mjs keeps for the prose version.
import { readTags } from './lib/git-tags.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The file reader this file used to define for itself; its ''-on-failure
// contract lives in lib/seam-input.mjs.
import { readText } from './lib/seam-input.mjs';
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what `--dir` and `--branch` may be, and what each costs when it is not,
// are DECLARED rows in lib/arg-contract.mjs, and `requireFlag` raises the
// refusal in the throwing form the catch arm at the foot of this file already
// renders. `--dir` refuses even though this seam mutates nothing (D-01): an
// advisory reader that answers confidently about the wrong tree is the same
// quiet-wrong-answer class, and `tags --dir ''` did exactly that.
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
// The current-branch reader, shared with git-guard.mjs and git-publish.mjs. It
// degrades to "" on failure, which is the degradation the header above states:
// no repo / no commits reads as not-on-a-base.
import { readCurrentBranch } from './lib/git-head.mjs';

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
  //
  // `dir` IS this project's root here - every read above joins `.planning` onto
  // it - so it is both the directory the question is asked from and the root the
  // answer must belong to (TAG-01/D-07). A project that is not itself a
  // repository no longer inherits an enclosing repository's tags and gets
  // refused an integration branch over a version it never published.
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName,
    publishedVersions: readTags(dir, dir) });
  emit({ ok: true, action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason, warnings });
}

/**
 * Every tag THIS project has published, as `tags[]`. The prose-facing half of
 * lib/git-tags.mjs: `workflows/milestone.md` step 2 decides whether a close is
 * a release at all from "has this project ever tagged", and a bare `git tag`
 * there answers that question with whatever repository happens to CONTAIN the
 * project - the upward discovery TAG-01 bounded one level up. `dir` is both the
 * directory the question is asked from and the project root the answer must
 * belong to, the same binding `decide` makes for itself above.
 *
 * No config is read here, so there is no `warnings[]` to ride: this arm's whole
 * input is the directory it was handed.
 */
function tags(dir) {
  emit({ ok: true, tags: readTags(dir, dir) });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows. A subcommand's own row wins over the `'*'` row,
 * where the flags allowed on every arm - here `--dir` - are declared once. */
const ROWS = CONTRACTS['git-branch.mjs'];
/** One flag of `sub`, read through its DECLARED row. The row owns the rule and
 * this binding owns nothing: it is an adapter over this file's own argv, never
 * a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // `--dir` declares `refuse` on both axes, so the empty, valueless and
  // flag-shaped spellings raise the seam refusal the catch arm below names,
  // while a genuinely ABSENT --dir still reads as undefined and the cwd default
  // stands. `--branch` declares `fallback` (D-12), so a spelling that carries no
  // usable value reads as absent and `decide` derives the branch as it always
  // did - the permissive reader's answer, now a declared disposition.
  if (cmd === 'decide') {
    decide(arg('decide', '--dir') || process.cwd(), arg('decide', '--branch'));
  } else if (cmd === 'tags') {
    tags(arg('tags', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: decide [--dir <path>] [--branch <name>] | tags [--dir <path>]' });
  }
} catch (e) {
  // The seam arm is what a `refuse` row costs its bin (D-08/D-09): the raised
  // refusal object carries no `message`, so without it a valueless --dir emits
  // detail "[object Object]". One JSON line on stdout like every other verdict
  // (D-02) - stderr is a channel no workflow reading this seam parses.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
