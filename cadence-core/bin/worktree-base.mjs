#!/usr/bin/env node
// @ts-check
// worktree-base.mjs - the preflight for the parallel /cad-execute path (#68): reads the host's effective
// `worktree.baseRef` from the Claude Code settings cascade and says whether parallel execution is safe.
// The default `fresh` forks worktrees from the remote default branch, so a phase's unpushed CONTEXT and PLAN files on
// the integration branch aren't there and every executor halts `blocked` on its missing plan. `head` forks from local
// HEAD (before Claude Code 2.1.208 `fresh` used whatever `origin/HEAD` was cached locally).
// Read-only, always: the setting is the user's, and a plugin silently editing it would be a worse bug than this guards.
// Cascade, highest first: managed policy, <root>/.claude/settings.local.json, <root>/.claude/settings.json, then
// ~/.claude/settings.json; the first to set the key wins, none means `fresh`. CADENCE_MANAGED_SETTINGS and
// CADENCE_USER_SETTINGS override the first and last layer, for tests.
// A session-level CLI override isn't on disk, so `head` is evidence, not proof: the executor's own check stays.
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { emit } from './lib/seam-io.mjs';
// no flag rule here: lib/arg-contract.mjs declares what `--dir` may be and `requireFlag` raises the refusal. `--dir`
// refuses though this seam mutates nothing, because the ref it resolves is what a worktree forks from, so a wrong-tree
// answer isn't cheaper for being advisory.
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';

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
 * the tree whose `.claude/settings*.json` Claude Code actually reads. Degrades to `dir` when git can't answer.
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
/** This script's declared rows; a subcommand's row wins over the `'*'` row, where flags allowed on every arm are declared. */
const ROWS = CONTRACTS['worktree-base.mjs'];
/** One flag of `sub` read through its declared row. An adapter over argv, never a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // `--dir` refuses on both axes, so a truly absent one still reads as undefined and falls to cwd, while empty, valueless
  // and flag-shaped spellings raise the refusal the e.seam arm names
  if (cmd === 'resolve') {
    resolveBaseRef(arg('resolve', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: resolve [--dir <path>]' });
  }
} catch (e) {
  // the raised refusal has no `message`, so without this arm a valueless --dir would emit detail "[object Object]".
  // One JSON line on stdout like every verdict: no workflow reading this seam parses stderr.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
