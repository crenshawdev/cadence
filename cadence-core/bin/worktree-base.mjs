#!/usr/bin/env node
// @ts-check
// worktree-base.mjs - preflight for parallel /cad-execute (#68): reads the host's `worktree.baseRef` and judges it.
// The default `fresh` forks from the remote branch, so unpushed plan files are missing and executors halt `blocked`.
// Read-only, always: the setting is the user's, and silently editing it would be worse than what this guards.
// Cascade, highest first: managed policy, project settings.local.json, project settings.json, then the user's.
// A session-level CLI override isn't on disk, so `head` is evidence, not proof.
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { emit, emitCaught } from './lib/seam-io.mjs';
// no flag rule here: arg-contract declares them. `--dir` refuses though this seam mutates nothing, because a
// wrong-tree answer isn't cheaper for being advisory
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';

/** The documented default when no layer sets the key. */
const DEFAULT_BASE_REF = 'fresh';
/** The only value the parallel path can run under. */
const SAFE_BASE_REF = 'head';

/** The platform's enterprise managed-settings path. */
function managedPath() {
  const override = process.env.CADENCE_MANAGED_SETTINGS;
  if (override) return override;
  if (platform() === 'darwin') return '/Library/Application Support/ClaudeCode/managed-settings.json';
  if (platform() === 'win32') return 'C:\\Program Files\\ClaudeCode\\managed-settings.json';
  return '/etc/claude-code/managed-settings.json';
}

/** The user layer's path. */
function userPath() {
  return process.env.CADENCE_USER_SETTINGS || join(homedir(), '.claude', 'settings.json');
}

/**
 * The main checkout root for `dir`. In a linked worktree git's common dir is the main repo's `.git`, so its parent is
 * the tree whose settings Claude Code reads. Degrades to `dir` when git can't answer.
 * @param {string} dir
 * @returns {string}
 */
function repoRoot(dir) {
  try {
    const common = execFileSync('git', ['-C', dir, 'rev-parse', '--git-common-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!common) return dir;
    return dirname(resolve(dir, common));
  } catch { return dir; }
}

/**
 * `worktree.baseRef` from one settings file, or null when it's absent, unreadable, malformed or doesn't set the key.
 * A broken layer is skipped, never fatal: the layers below it are still the user's real answer.
 * @param {string} file
 * @returns {string|null}
 */
function baseRefIn(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
  const wt = parsed && typeof parsed === 'object' ? parsed.worktree : null;
  const v = wt && typeof wt === 'object' ? wt.baseRef : null;
  return typeof v === 'string' && v ? v : null;
}

/**
 * Resolve the effective baseRef and judge the parallel path.
 * @param {string} dir
 */
function resolveBaseRef(dir) {
  const root = repoRoot(dir);
  const layers = [
    managedPath(),
    join(root, '.claude', 'settings.local.json'),
    join(root, '.claude', 'settings.json'),
    userPath(),
  ];

  for (const file of layers) {
    const found = baseRefIn(file);
    if (found === null) continue;
    if (found === SAFE_BASE_REF) {
      emit({ ok: true, baseRef: found, source: file, parallelSafe: true,
        reason: 'head: worktrees fork from the local HEAD, so this phase\'s unpushed CONTEXT and PLAN files are in them' });
      return;
    }
    if (found === DEFAULT_BASE_REF) {
      emit({ ok: true, baseRef: found, source: file, parallelSafe: false,
        reason: 'fresh: worktrees fork from the remote default branch, so unpushed CONTEXT and PLAN files are missing from them - set worktree.baseRef to "head" (/cad-config offers it) or run sequentially' });
      return;
    }
    emit({ ok: true, baseRef: found, source: file, parallelSafe: false,
      reason: `unrecognized worktree.baseRef "${found}" - the setting takes only "fresh" or "head", so the host's behaviour cannot be predicted; run sequentially` });
    return;
  }

  emit({ ok: true, baseRef: DEFAULT_BASE_REF, source: 'default', parallelSafe: false,
    reason: 'unset everywhere in the settings cascade, so the "fresh" default applies: worktrees fork from the remote default branch and lack this phase\'s unpushed CONTEXT and PLAN files - set worktree.baseRef to "head" (/cad-config offers it) or run sequentially' });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows; a subcommand's row wins over the `'*'` row for flags every arm allows. */
const ROWS = CONTRACTS['worktree-base.mjs'];
/** One flag of `sub` read through its declared row, never a second statement of what a flag may be. */
const arg = rowReader(argv, ROWS);

try {
  // `--dir` refuses on both axes: absent falls to cwd, while empty, valueless and flag-shaped ones raise the refusal
  if (cmd === 'resolve') {
    resolveBaseRef(arg('resolve', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: resolve [--dir <path>]' });
  }
} catch (e) {
  emitCaught(e);
}
