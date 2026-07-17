#!/usr/bin/env node
// @ts-check
// land-cleanup.mjs - the workflow-facing seam over lib/close-decision.mjs. It
// ADVISES cad-land whether a land should clean up (return to base + pull + reap
// the merged integration branch) and whether an autonomous close halts before
// merge on a blocking pre_ship finding. Like git-branch.mjs / git-guard.mjs it
// only advises: it NEVER runs `checkout`, `pull`, or `branch -D` - that is
// cad-land prose's job, gated by this advice. One JSON line on stdout, exit 0
// (seam convention, lib/seam-io.mjs). The tested logic lives in
// lib/close-decision.mjs; this wraps it with config + git-read I/O.
//
// Subcommands (each prints one JSON line):
//   cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>]
//     Decide the return-to-base + pull + reap for a land. --dir is the planning
//     root (default cwd). Base resolves from --base, else git.base_branch, else
//     the first git.protected_branches entry (cad-land / git.md order). The reap
//     target is resolveReapBranch(derived, `git branch --merged <base>`), where
//     derived = --branch when given, else integrationBranchName(PROJECT/ROADMAP)
//     - so an already-evolved ### Active or a null-derived name still reaps the
//     cadence/* branch that actually merged. --merged is a test hook forcing the
//     merged-into-base verdict (else inferred from the merged list).
//   gate [--dir <path>]
//     Read {findings} JSON from stdin (empty -> []) and, under git.auto_close,
//     decide whether a surviving blocker/high pre_ship finding halts the chain
//     before merge.
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName } from './lib/branch-decision.mjs';
import { resolveReapBranch, decideCleanup, decideGateHalt } from './lib/close-decision.mjs';

/** Read a file, or "" if missing/unreadable (a missing surface is not fatal). */
function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { return ''; }
}

/**
 * The branches `git branch --merged <base>` reports at `dir`, or [] if git
 * cannot be read (no repo / bad base) - degrade to empty like git-branch.mjs,
 * never throw.
 */
function readMergedBranches(dir, base) {
  try {
    const out = execFileSync('git', ['-C', dir, 'branch', '--merged', base],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n')
      .map((l) => l.replace(/^[*+ ]+/, '').trim()) // strip the `* `/`+ ` markers
      .filter(Boolean);
  } catch { return []; }
}

/** Parsed {findings} from stdin, or [] when stdin is empty/unreadable/bad JSON. */
function readFindings() {
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { return []; }
  raw = raw.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return Array.isArray(parsed && parsed.findings) ? parsed.findings : [];
  } catch { return []; }
}

function cleanup(dir, branchArg, baseArg, mergedArg) {
  const { config } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const onLandCleanup = git.on_land_cleanup !== false; // default true
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches : ['main', 'master'];
  const base = baseArg !== undefined ? baseArg : (git.base_branch || protectedBranches[0]);
  const mergedList = readMergedBranches(dir, base);
  const derived = branchArg !== undefined ? branchArg
    : integrationBranchName(
      readText(join(dir, '.planning', 'PROJECT.md')),
      readText(join(dir, '.planning', 'ROADMAP.md')),
    );
  const branch = resolveReapBranch(derived, mergedList);
  const mergedIntoBase = mergedArg !== undefined
    ? mergedArg === 'true'
    : (branch !== null && mergedList.includes(branch));
  const decision = decideCleanup({ onLandCleanup, mergedIntoBase, branch });
  emit({ ok: true, ...decision, base });
}

function gate(dir) {
  const { config } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const autoClose = git.auto_close === true;
  const decision = decideGateHalt({ autoClose, findings: readFindings() });
  emit({ ok: true, ...decision });
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
  if (cmd === 'cleanup') {
    cleanup(flag('--dir') || process.cwd(), flag('--branch'), flag('--base'), flag('--merged'));
  } else if (cmd === 'gate') {
    gate(flag('--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>] | gate [--dir <path>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
