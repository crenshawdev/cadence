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
//               --list`) - the versions already published, which a new
//               integration branch must sort above.
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
import { compareVersions } from './lib/release-decision.mjs';

/** Read a file, or "" if missing/unreadable (a missing surface is not fatal). */
function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { return ''; }
}

/**
 * The versions this repo has already PUBLISHED, read as git TAGS and never from
 * a manifest (D-03). A tag is language-agnostic and true in a project that is
 * not Cadence; the only manifest reader in this tree reads Cadence's OWN
 * .claude-plugin/plugin.json, which anywhere else would compare a user's
 * milestone against Cadence's version. Degrades to [] on any failure - no repo,
 * no tags, git absent - so a project with no tags decides exactly as before.
 * @param {string} dir @returns {string[]}
 */
function readTags(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'tag', '--list'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((t) => t.trim()).filter(Boolean);
  } catch { return []; }
}

/**
 * The highest tag that parses as semver, or null. Non-semver tags (`nightly`,
 * `2024-06-release`) are skipped rather than guessed at: `compareVersions`
 * returns null for anything out of grammar, so `cmp(s, s) === 0` is the parse
 * test and no second SEMVER_RE exists here to drift from that one.
 * @param {string[]} tags @returns {string|null}
 */
function highestSemverTag(tags) {
  /** @type {string|null} */
  let best = null;
  let bestBare = '';
  for (const tag of tags) {
    const bare = tag.replace(/^v/, '');
    if (compareVersions(bare, bare) !== 0) continue; // out of grammar: not a release tag
    if (best === null || compareVersions(bare, bestBare) === 1) { best = tag; bestBare = bare; }
  }
  return best;
}

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
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches : ['main', 'master'];
  const branch = branchOverride !== undefined ? branchOverride : readCurrentBranch(dir);
  const integrationName = integrationBranchName(
    readText(join(dir, '.planning', 'PROJECT.md')),
    readText(join(dir, '.planning', 'ROADMAP.md')),
  );
  const publishedVersion = highestSemverTag(readTags(dir));
  const d = decideBranch({ mode, autoBranch, currentBranch: branch, protectedBranches, integrationName,
    publishedVersion });
  emit({ ok: true, action: d.action, branch: d.branch, mode, currentBranch: branch, reason: d.reason, warnings });
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
