// @ts-check
// planning/migrate.mjs - a project a main-session seam meets with no state file is converted into the layout, once
// planning.mjs calls this after the arguments pass their contract and before the handler runs
// the conversion moves what scripts keep into `records/` (top level and each phase, archived ones too), builds the state from
// the project at its new place, writes it LAST with the layout number, and regenerates the three views from it
// it judges everything first and moves nothing unless every judgment passes, so a refused project is byte-identical
// a worktree executor, a held workflow claim and a live `cadence/phase-<N>-plan-<k>` worktree each refuse; no hook script imports this file
// the script makes no commit
// a move is a plain rename through the write module and a moved file is never read, so review, adjudication and deferred files keep their bytes
// a project the importer can't read gets no stamp, and a state file that is there but not valid is never rewritten here
// a seam that reports what the project had BEFORE (`trace ignore`) asks for mode 'before' ahead of its handler, which judges
// everything and writes nothing, and mode 'after' once it has answered, which converts and says nothing more
// a Rust-era `.planning/state.json` and everything this file does not name are left exactly where they are
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fail } from './core.mjs';
import { importState, writeViews } from './state-import.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  archivePath, codemapDir, declinedPath, deferredDir, ensurePhaseRecordsDir, ensureRecordsDir, ensureRecordsIgnore,
  filedPath, movePath, phaseRecordsDir, phaseReportsDir, recordsPath, riskCarryDir,
} from '../lib/planning-store.mjs';
import { readState, statePath, writeState } from '../lib/project-state.mjs';
import { emit } from '../lib/seam-io.mjs';
import { dirents } from '../lib/surface-weight.mjs';
import { claimHolder } from '../lib/workflow-claim.mjs';

/** The run record, the read record, their rotated generation, claim sidecars and rotation temps. */
const LOG_NAME = /^(?:trace|reads)(?:\.1)?\.jsonl(?:\.(?:claim|rotate|evict)(?:\..+)?)?$/;
/** A phase folder's files that move by name prefix, whatever the extension; never read or re-rendered. */
const PHASE_PREFIXES = ['REVIEW-', 'ADJUDICATION-', 'DEFERRED-'];
const PHASE_FILES = ['FINDINGS.json', 'verifier-findings.json'];
/** A branch an executor worktree is made on. Phases can be decimal (`1.1`). */
const PLAN_BRANCH = /^cadence\/phase-\d+(?:\.\d+)?-plan-\d+$/;
/** How many paths a refusal names before it says "and N more". */
const NAMED_MAX = 8;

/** @typedef {{reason: string, detail: string, hint: string, issues?: unknown[]}} Refusal */
/** @typedef {{from: string, to: string, phase: string | null, link: boolean, whole: boolean, skip: boolean}} Move */

/** One git read: trimmed stdout, or null on any failure. @param {string[]} args @param {string} [cwd] */
function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

/** @param {string} p */
function real(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}

/**
 * Is this call a worktree executor's: the working directory is in a linked worktree, and the planning directory the call
 * resolved sits outside it. That is the `--dir <main tree>/.planning` shape the executor contract prescribes. A planning
 * directory in no repository, or inside the same worktree, is the main session's.
 * @param {string} dir
 */
function isExecutorCall(dir) {
  const gitDir = git(['rev-parse', '--git-dir']);
  const common = git(['rev-parse', '--git-common-dir']);
  if (gitDir === null || common === null || real(resolve(gitDir)) === real(resolve(common))) return false;
  const here = git(['rev-parse', '--show-toplevel']);
  const there = git(['rev-parse', '--show-toplevel'], resolve(dir));
  return here !== null && there !== null && real(here) !== real(there);
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

/** @param {string} p @returns {import('node:fs').Stats | null} */
function lstatOf(p) {
  try { return lstatSync(p); } catch { return null; }
}

/** @param {string} a @param {string} b */
function sameBytes(a, b) {
  try { return readFileSync(a).equals(readFileSync(b)); } catch { return false; }
}

/** @param {string[]} paths */
function named(paths) {
  return paths.slice(0, NAMED_MAX).join(', ') + (paths.length > NAMED_MAX ? ` and ${paths.length - NAMED_MAX} more` : '');
}

/**
 * Every move the layout asks for, each destination taken from the write module. Names come from reading the folders, so a
 * thing that is not there is not listed; a linked phase or archive folder is not walked.
 * @param {string} dir
 * @returns {Move[]}
 */
function planMoves(dir) {
  /** @type {Move[]} */
  const moves = [];
  /** @param {string} from @param {string} to @param {string | null} phase @param {import('node:fs').Dirent} e */
  const add = (from, to, phase, e) => moves.push({ from, to, phase, link: e.isSymbolicLink(), whole: e.isDirectory(), skip: false });
  const top = dirents(dir);
  const ledgers = /** @type {[string, string][]} */ ([
    ['ARCHIVE.md', archivePath(dir)], ['FILED.md', filedPath(dir)], ['DECLINED.md', declinedPath(dir)],
    ['deferred', deferredDir(dir)], ['risk-carry', riskCarryDir(dir)], ['codemap', codemapDir(dir)],
  ]);
  for (const e of top) {
    const ledger = ledgers.find(([name]) => name === e.name);
    if (LOG_NAME.test(e.name)) add(join(dir, e.name), recordsPath(dir, e.name), null, e);
    else if (ledger) add(join(dir, e.name), ledger[1], null, e);
  }
  const groups = ['phases', ...top.filter((e) => e.isDirectory() && e.name.startsWith('_archive-')).map((e) => e.name)];
  for (const group of groups) {
    for (const p of dirents(join(dir, group))) {
      if (!p.isDirectory()) continue;
      const pdir = join(dir, group, p.name);
      for (const e of dirents(pdir)) {
        if (e.name === 'reports' && (e.isDirectory() || e.isSymbolicLink())) add(join(pdir, e.name), phaseReportsDir(pdir), pdir, e);
        else if (PHASE_PREFIXES.some((x) => e.name.startsWith(x)) || PHASE_FILES.includes(e.name)) {
          add(join(pdir, e.name), join(phaseRecordsDir(pdir), e.name), pdir, e);
        }
      }
    }
  }
  return moves;
}

/**
 * Judge the moves: a link, a records path that is not a real directory, or a destination already taken is a refusal that
 * names the paths. A destination holding the same bytes as a plain-file source is already done and is marked to skip,
 * which is what lets a run that stopped part way be finished.
 * @param {Move[]} moves
 * @returns {Refusal | null}
 */
function judgeMoves(moves) {
  const links = moves.filter((m) => m.link).map((m) => m.from);
  if (links.length) {
    return { reason: 'layout-symlink', detail: `these are links, so they are not moved: ${named(links)}`,
      hint: 'replace each link with the real file or folder (or move it out of .planning), then re-run - nothing was changed' };
  }
  const intos = [...new Set(moves.map((m) => dirname(m.to)))];
  const odd = intos.filter((p) => { const st = lstatOf(p); return st !== null && !st.isDirectory(); });
  if (odd.length) {
    return { reason: 'layout-records-not-dir', detail: `these should be real folders but are not: ${named(odd)}`,
      hint: 'move each one aside so a real records folder can be made there, then re-run - nothing was changed' };
  }
  const taken = [];
  for (const m of moves) {
    const there = lstatOf(m.to);
    if (!there) continue;
    if (!m.whole && there.isFile() && sameBytes(m.from, m.to)) m.skip = true;
    else taken.push(m.to);
  }
  if (taken.length) {
    return { reason: 'layout-destination-exists', detail: `these already exist, so the files that belong there were not moved: ${named(taken)}`,
      hint: 'a log or record written before the conversion is in the way - compare the two, move one aside, then re-run; nothing was changed' };
  }
  return null;
}

/**
 * Everything that must hold before the first write, in the order the contract states it.
 * @param {string} dir
 * @returns {{refusal: Refusal} | {moves: Move[]}}
 */
function judge(dir) {
  if (isExecutorCall(dir)) {
    return { refusal: { reason: 'executor-cannot-convert',
      detail: `${resolve(dir)} has no state file, and this call comes from a linked worktree whose planning directory is outside it`,
      hint: 'the main session converts the project on its next command - re-run after that; nothing was changed' } };
  }
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
  const moves = planMoves(dir);
  const refusal = judgeMoves(moves);
  return refusal ? { refusal } : { moves };
}

/**
 * Do the moves, then build the state from the project at its new place, write it last and render the views.
 * @param {string} dir @param {Move[]} moves
 * @returns {Refusal | null}
 */
function convert(dir, moves) {
  const steps = moves.filter((m) => !m.skip).map((m) => /** @type {[string, () => void]} */ ([m.from, () => {
    if (m.phase === null) {
      const made = ensureRecordsDir(dir);
      if (made.ok === false) throw new Error(`the records folder cannot be used: ${made.reason}`);
      ensureRecordsIgnore(dir);
    } else ensurePhaseRecordsDir(m.phase);
    movePath(m.from, m.to);
  }]));
  const ran = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!ran.ok) {
    const err = ran.failures[0];
    return { reason: 'layout-move-failed',
      detail: `${err.key} could not be moved: ${err.error && err.error.message ? err.error.message : String(err.error)}`,
      hint: 'fix the cause the detail names and re-run - the next run finishes the conversion from where this one stopped; no state file was written' };
  }
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
  if (existsSync(join(dir, 'ROADMAP.md')) || steps.length > 0) writeViews(dir, imported.state, ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md']);
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
  const refusal = 'refusal' in verdict ? verdict.refusal : (mode === 'before' ? null : convert(dir, verdict.moves));
  if (refusal) {
    if (quiet) return false;
    // emitted directly because fail has no channel for the issue list
    const { reason, detail, issues, hint } = refusal;
    emit({ ok: false, reason, detail, ...(issues ? { issues } : {}), hint });
    return false;
  }
  return true;
}
