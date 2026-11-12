// @ts-check
// planning/migrate.mjs - every project a seam meets gets its state file, once
// planning.mjs calls this after the arguments pass their contract and before the handler runs
// it writes `records/state.json` (and the records folder's `.gitignore` beside it) and nothing else
// a held workflow claim and a live `cadence/phase-<N>-plan-<k>` worktree each refuse, and a refused project is byte-identical
// a project the importer can't read gets no stamp, and a state file that is there but not valid is never rewritten here
// a seam that reports what the project had BEFORE (`trace ignore`) asks for mode 'before' ahead of its handler, which judges
// everything and writes nothing, and mode 'after' once it has answered, which stamps and says nothing more
'use strict';

import { execFileSync } from 'node:child_process';
import { lstatSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fail } from './core.mjs';
import { importState } from './state-import.mjs';
import { readState, statePath, writeState } from '../lib/project-state.mjs';
import { emit } from '../lib/seam-io.mjs';
import { claimHolder } from '../lib/workflow-claim.mjs';

/** A branch an executor worktree is made on. Phases can be decimal (`1.1`). */
const PLAN_BRANCH = /^cadence\/phase-\d+(?:\.\d+)?-plan-\d+$/;

/** @typedef {{reason: string, detail: string, hint: string, issues?: unknown[]}} Refusal */

/** One git read: trimmed stdout, or null on any failure. @param {string[]} args @param {string} [cwd] */
function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

/**
 * Every linked worktree on a `cadence/phase-<N>-plan-<k>` branch, with its path.
 * @param {string} root
 * @returns {{branch: string, path: string}[]}
 */
function planWorktrees(root) {
  const out = git(['-C', root, 'worktree', 'list', '--porcelain']);
  if (!out) return [];
  const found = [];
  // the first block is the main worktree; only linked ones are an executor's
  for (const block of out.split(/\n\s*\n/).slice(1)) {
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
    if (path && branch && PLAN_BRANCH.test(branch)) found.push({ branch, path });
  }
  return found;
}

/**
 * Everything that must hold before the first write, in the order the contract states it.
 * @param {string} dir
 * @returns {{refusal: Refusal} | {}}
 */
function judge(dir) {
  const imported = importState(dir);
  if (imported.ok === false) {
    const { reason, detail, issues, hint } = imported;
    return { refusal: { reason, detail, hint, ...(issues ? { issues } : {}) } };
  }
  const root = resolve(dir, '..');
  const common = git(['-C', root, 'rev-parse', '--git-common-dir']);
  if (common !== null) {
    const holder = claimHolder(resolve(root, common));
    if (holder) {
      return { refusal: { reason: 'workflow-claim-held',
        detail: `a workflow claim is held by ${holder.label ?? 'an unknown holder'} (${holder.age_seconds}s old), and a conversion would move files under it`,
        hint: 'let that workflow finish, or free a dead one with `planning.mjs workflow-claim release`, then re-run; nothing was changed' } };
    }
    const live = planWorktrees(root)[0];
    if (live) {
      return { refusal: { reason: 'plan-worktree-live',
        detail: `the plan worktree ${live.path} is live on ${live.branch}, and a conversion would move files under it`,
        hint: 'finish and merge that plan, or remove the worktree with `git worktree remove`, then re-run; nothing was changed' } };
    }
  }
  return {};
}

/**
 * Build the state and write it.
 * @param {string} dir
 * @returns {Refusal | null}
 */
function convert(dir) {
  const imported = importState(dir);
  if (imported.ok === false) {
    const { reason, detail, issues, hint } = imported;
    return { reason, detail, hint, ...(issues ? { issues } : {}) };
  }
  const wrote = writeState(dir, imported.state);
  if (wrote.ok === false) {
    return { reason: 'state-write-failed', detail: `${statePath(dir)}: ${wrote.reason} - ${wrote.detail}`,
      hint: 'fix the cause the detail names and re-run - no state file was written, and the project files were not changed' };
  }
  return null;
}

/**
 * Make sure the planning directory has a valid state file before a handler runs, converting an unstamped project once.
 * @param {string} dir the planning directory the call resolved
 * @param {'now' | 'before' | 'after'} [mode] 'now' judges and converts; 'before' judges only; 'after' converts with no refusal emitted
 * @returns {boolean} true when the handler may run; false when a refusal has been emitted and the handler must not
 */
export function ensureState(dir, mode = 'now') {
  const quiet = mode === 'after';
  // no directory, or a file where it belongs, is the handler's to report (`no-planning-dir`, or its own best-effort answer)
  let st = null;
  try { st = statSync(dir); } catch { /* absent */ }
  if (!st || !st.isDirectory()) return true;
  // a planning directory that is itself a link may be a repository's way of pointing writes out of the tree, so nothing
  // is stamped through it; the handler keeps whatever refusal it has for that
  // resolve drops a trailing slash, which would make lstat follow the link it is asking about
  try { if (lstatSync(resolve(dir)).isSymbolicLink()) return true; } catch { return true; }
  const got = readState(dir);
  if (got.kind === 'valid') return true;

  if (got.kind === 'invalid') {
    if (quiet) return false;
    fail('invalid-state', `${statePath(dir)}: ${got.reason} - ${got.detail}`,
      got.reason === 'newer-layout'
        ? 'this project was written by a newer Cadence - update the plugin; the file was not touched'
        : '/cad-progress rebuilds the state file from the project\'s files; nothing was changed');
    return false;
  }

  const verdict = judge(dir);
  const refusal = 'refusal' in verdict ? verdict.refusal : (mode === 'before' ? null : convert(dir));
  if (refusal) {
    if (quiet) return false;
    // emitted directly because fail has no channel for the issue list
    const { reason, detail, issues, hint } = refusal;
    emit({ ok: false, reason, detail, ...(issues ? { issues } : {}), hint });
    return false;
  }
  return true;
}
