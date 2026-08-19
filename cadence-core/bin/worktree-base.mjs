#!/usr/bin/env node
// @ts-check
// worktree-base.mjs - the preflight for the parallel /cad-execute path. It
// reads the HOST's effective `worktree.baseRef` out of the Claude Code
// settings cascade and reports whether parallel execution is safe to run.
//
// Why it exists (#68): `worktree.baseRef` decides where a subagent worktree
// forks from. Its default `fresh` forks from the remote default branch, so a
// phase's unpushed CONTEXT and PLAN files - which live on the integration
// branch - are simply not in the worktree, and every executor halts `blocked`
// on its own missing plan. `head` forks from the local HEAD and carries them.
//
// READ-ONLY, always. Cadence never writes this setting: it is the user's, it
// lives in their settings files, and a plugin that edited it silently would be
// a worse bug than the one this guards. /cad-config OFFERS the change.
//
// Cascade, highest precedence first (docs: Claude Code settings):
//   1. enterprise managed policy - /etc/claude-code/managed-settings.json
//      (Linux/WSL), /Library/Application Support/ClaudeCode/managed-settings.json
//      (macOS), C:\Program Files\ClaudeCode\managed-settings.json (Windows)
//   2. <root>/.claude/settings.local.json   (project local, gitignored)
//   3. <root>/.claude/settings.json         (project shared)
//   4. ~/.claude/settings.json              (user)
// First layer that defines the key wins; none -> `fresh`, the documented
// default. `<root>` is the MAIN checkout (derived from git's common dir), so
// running inside a worktree still reads the repository's settings files.
//
// Honest limit: a session-level CLI override (`--settings`, `--setting`) is
// not on disk and no script can see it, so a `head` answer here is evidence,
// not proof - which is why cad-executor's `<worktree_mode>` assertion stays.
// Behaviour stated holds for Claude Code >= 2.1.208; before that a `fresh`
// worktree used whatever `origin/HEAD` happened to be cached locally.
//
// Subcommand (prints one JSON line; every resolve is ok:true and exits 0, a
// malformed CALL exits 1):
//   resolve [--dir <path>]
//     --dir  repo/planning root. ABSENT means the process cwd; an EMPTY or
//            valueless --dir REFUSES (`missing-flag-value`, exit 1) rather than
//            resolving the base ref of a tree the caller never named (phase 2
//            D-01).
// Emits { ok, baseRef, source, parallelSafe, reason }.
//
// Test hooks (also honest relocations): CADENCE_MANAGED_SETTINGS and
// CADENCE_USER_SETTINGS override layers 1 and 4.
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { emit } from './lib/seam-io.mjs';
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what `--dir` may be, and what it costs when it is not, is a DECLARED
// row in lib/arg-contract.mjs, and `requireFlag` raises the refusal in the
// throwing form the catch arm at the foot of this file already renders. `--dir`
// declares `refuse` (D-01): this seam mutates nothing, but the ref it resolves
// is what a worktree is then forked from, so an answer about the wrong tree is
// not cheaper for being advisory.
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
 * The MAIN checkout root for `dir`. Inside a linked worktree, git's common dir
 * is the main repo's `.git`, so its parent is the main checkout - the tree
 * whose `.claude/settings*.json` Claude Code actually reads. Degrades to `dir`
 * when git cannot answer (not a repo, no git on PATH).
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
 * `worktree.baseRef` from one settings file, or null when the file is absent,
 * unreadable, malformed, or simply does not set the key. A broken layer is
 * skipped, never fatal: the cascade below it is still the user's real answer.
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
/** This script's declared rows. A subcommand's own row wins over the `'*'` row,
 * where the flags allowed on every arm - here `--dir` - are declared once. */
const ROWS = CONTRACTS['worktree-base.mjs'];
/** One flag of `sub`, read through its DECLARED row. The row owns the rule and
 * this binding owns nothing: it is an adapter over this file's own argv, never
 * a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // `--dir` declares `refuse` on both axes, so a genuinely ABSENT one still
  // reads as undefined and the cwd default is unchanged, while the empty,
  // valueless and flag-shaped spellings raise the refusal the e.seam arm names.
  if (cmd === 'resolve') {
    resolveBaseRef(arg('resolve', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: resolve [--dir <path>]' });
  }
} catch (e) {
  // The seam arm is what a `refuse` row costs its bin (D-08/D-09): the raised
  // refusal object carries no `message`, so without it a valueless --dir emits
  // detail "[object Object]". One JSON line on stdout like every other verdict
  // (D-02) - stderr is a channel no workflow reading this seam parses.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
