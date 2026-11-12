// @ts-check
// planning/migrate.mjs - a project a main-session seam meets with no state file is converted into the layout, once
// planning.mjs calls this after the arguments pass their contract and before the handler runs
// the conversion moves what scripts keep into `records/` (top level and each phase, archived ones too), builds the state from
// the project at its new place, writes it LAST with the layout number, and regenerates the three views from it
// it judges everything first and moves nothing unless every judgment passes, so a refused project is byte-identical
// a worktree executor, a held workflow claim and a live `cadence/phase-<N>-plan-<k>` worktree each refuse; no hook script imports this file
// the script makes no commit: the answer of the call that converted says whether one is due (`conversionNote`)
// a move is a plain rename through the write module and a moved file is never read, so review, adjudication and deferred files keep their bytes
// a project the importer can't read gets no stamp, and a state file that is there but not valid is rewritten only by
// `state-rebuild` (`cmdStateRebuild`), the one call the gate lets through for it; that rebuild moves nothing
// a seam that reports what the project had BEFORE (`trace ignore`) asks for mode 'before' ahead of its handler, which judges
// everything and writes nothing, and mode 'after' once it has answered, which converts and says nothing more
// a Rust-era `.planning/state.json` and everything this file does not name are left exactly where they are
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, ok } from './core.mjs';
import { importState, loadState, writeViews } from './state-import.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  archivePath, codemapDir, declinedPath, deferredDir, ensurePhaseRecordsDir, ensureRecordsDir, ensureRecordsIgnore,
  filedPath, movePath, phaseRecordsDir, phaseReportsDir, recordsDir, recordsPath, riskCarryDir, unlinkFile, withPlanningFileLock,
} from '../lib/planning-store.mjs';
import { readState, rebuildState, STATE_LAYOUT, statePath, writeState } from '../lib/project-state.mjs';
import { emit } from '../lib/seam-io.mjs';
import { CLAIM_FILE, claimHolder } from '../lib/workflow-claim.mjs';

/** The run record, the read record, their rotated generation, claim sidecars and rotation temps. */
const LOG_NAME = /^(?:trace|reads)(?:\.1)?\.jsonl(?:\.(?:claim|rotate|evict)(?:\..+)?)?$/;
/** A phase folder's files that move by name prefix, whatever the extension; never read or re-rendered. */
const PHASE_PREFIXES = ['REVIEW-', 'ADJUDICATION-', 'DEFERRED-'];
const PHASE_FILES = ['FINDINGS.json', 'verifier-findings.json'];
/** A branch an executor worktree is made on. Phases can be decimal (`1.1`). */
const PLAN_BRANCH = /^cadence\/phase-\d+(?:\.\d+)?-plan-\d+$/;
/** The lock file a conversion holds, beside the state file's own folder; gone again when the call ends. */
const LOCK_NAME = 'layout-migration';
/** The three generated views, rendered from the state; one the project never had is not invented. */
const VIEWS = ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md'];
/** How many paths a refusal names before it says "and N more". */
const NAMED_MAX = 8;

/** @typedef {{reason: string, detail: string, hint: string, issues?: unknown[]}} Refusal */
/** @typedef {{from: string, to: string, phase: string | null, link: boolean, whole: boolean, dup: boolean}} Move */
/** @typedef {{moves: Move[], links: string[], unread: string[]}} Plan */

/** @type {{converted: true, layout: number, commit_due: boolean, hint?: string} | null} What the last converting call says about itself; null when it converted nothing. */
let note = null;

/**
 * The added field a converting call's answer carries: that it converted, and whether a commit is due.
 * @returns {{converted: true, layout: number, commit_due: boolean, hint?: string} | null}
 */
export function conversionNote() {
  return note;
}

/**
 * Hold what the process writes to stdout until the returned function runs, which puts the converting call's field into
 * the one JSON answer and writes it. The handlers emit through their own channel, so this is the one place the field joins.
 * @returns {() => void}
 */
export function holdAnswer() {
  const write = process.stdout.write;
  /** @type {string[]} */
  const chunks = [];
  // @ts-ignore a stand-in for the stream's write; only the text matters here
  process.stdout.write = (chunk, ...rest) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    const done = rest.find((r) => typeof r === 'function');
    if (done) done();
    return true;
  };
  return () => {
    process.stdout.write = write;
    let text = chunks.join('');
    if (note) {
      try {
        const answer = JSON.parse(text);
        if (answer && typeof answer === 'object' && !Array.isArray(answer)) text = `${JSON.stringify({ ...answer, migration: note })}\n`;
      } catch { /* not one JSON object, so it goes out as it came */ }
    }
    if (text) process.stdout.write(text);
  };
}

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
 * thing that is not there is not listed. A linked phase or archive folder is not walked, and a folder that can't be read
 * shows nothing: both are listed so the judgment refuses them, or the stamp would land on records left at the old place.
 * @param {string} dir
 * @returns {Plan}
 */
function planMoves(dir) {
  /** @type {Move[]} */
  const moves = [];
  /** @type {string[]} */
  const links = [];
  /** @type {string[]} */
  const unread = [];
  /** @param {string} from @param {string} to @param {string | null} phase @param {import('node:fs').Dirent} e */
  const add = (from, to, phase, e) => moves.push({ from, to, phase, link: e.isSymbolicLink(), whole: e.isDirectory(), dup: false });
  /** @param {string} p @returns {import('node:fs').Dirent[]} */
  const list = (p) => {
    try { return readdirSync(p, { withFileTypes: true }); } catch (e) {
      // absent or not a folder holds nothing of ours; anything else would pass as empty
      const code = e && /** @type {any} */ (e).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') unread.push(p);
      return [];
    }
  };
  /** A link that stands where a folder would be walked. @param {string} p @param {import('node:fs').Dirent} e */
  const linkedDir = (p, e) => {
    if (!e.isSymbolicLink()) return false;
    try { return statSync(p).isDirectory(); } catch { return false; }
  };
  const top = list(dir);
  const ledgers = /** @type {[string, string][]} */ ([
    ['ARCHIVE.md', archivePath(dir)], ['FILED.md', filedPath(dir)], ['DECLINED.md', declinedPath(dir)],
    ['deferred', deferredDir(dir)], ['risk-carry', riskCarryDir(dir)], ['codemap', codemapDir(dir)],
  ]);
  for (const e of top) {
    const ledger = ledgers.find(([name]) => name === e.name);
    if (LOG_NAME.test(e.name)) add(join(dir, e.name), recordsPath(dir, e.name), null, e);
    else if (ledger) add(join(dir, e.name), ledger[1], null, e);
  }
  const groups = ['phases'];
  for (const e of top) {
    if (!e.name.startsWith('_archive-')) continue;
    if (e.isDirectory()) groups.push(e.name);
    else if (linkedDir(join(dir, e.name), e)) links.push(join(dir, e.name));
  }
  for (const group of groups) {
    for (const p of list(join(dir, group))) {
      const pdir = join(dir, group, p.name);
      if (linkedDir(pdir, p)) { links.push(pdir); continue; }
      if (!p.isDirectory()) continue;
      for (const e of list(pdir)) {
        if (e.name === 'reports' && (e.isDirectory() || e.isSymbolicLink())) add(join(pdir, e.name), phaseReportsDir(pdir), pdir, e);
        else if (PHASE_PREFIXES.some((x) => e.name.startsWith(x)) || PHASE_FILES.includes(e.name)) {
          add(join(pdir, e.name), join(phaseRecordsDir(pdir), e.name), pdir, e);
        }
      }
    }
  }
  return { moves, links, unread };
}

/**
 * Judge the plan: a link, a folder that can't be read, a records path that is not a real directory, or a destination
 * already taken is a refusal that names the paths. A destination holding the same bytes as a plain-file source is a twin,
 * marked so the move drops the source, which is what lets a run that stopped part way be finished.
 * @param {string} dir @param {Plan} plan
 * @returns {Refusal | null}
 */
function judgeMoves(dir, { moves, links: linked, unread }) {
  const links = [...linked, ...moves.filter((m) => m.link).map((m) => m.from)];
  if (links.length) {
    return { reason: 'layout-symlink', detail: `these are links, so they are not moved: ${named(links)}`,
      hint: 'replace each link with the real file or folder (or move it out of .planning), then re-run - nothing was changed' };
  }
  if (unread.length) {
    return { reason: 'layout-unreadable', detail: `these folders can't be read, so what they hold was not looked at: ${named(unread)}`,
      hint: 'make each one readable (or move it out of .planning), then re-run - nothing was changed' };
  }
  // the state file lands in the top records folder last, so it is judged whenever anything moves, not only top-level files
  const intos = [...new Set([...(moves.length ? [recordsDir(dir)] : []), ...moves.map((m) => dirname(m.to))])];
  const odd = intos.filter((p) => { const st = lstatOf(p); return st !== null && !st.isDirectory(); });
  if (odd.length) {
    return { reason: 'layout-records-not-dir', detail: `these should be real folders but are not: ${named(odd)}`,
      hint: 'move each one aside so a real records folder can be made there, then re-run - nothing was changed' };
  }
  const taken = [];
  for (const m of moves) {
    const there = lstatOf(m.to);
    if (!there) continue;
    if (!m.whole && there.isFile() && sameBytes(m.from, m.to)) m.dup = true;
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
    const gitDir = resolve(root, common);
    const holder = claimHolder(gitDir);
    if (holder) {
      // the release this names skips the conversion in planning.mjs, so following the hint works on this very project
      // label and id come from a file, so only a plain token goes into a command someone may paste
      const plain = (/** @type {string|null} */ s) => (s !== null && /^[\w.:-]{1,200}$/.test(s) ? s : null);
      const fire = plain(holder.label) ?? 'stale-claim';
      const free = plain(holder.id) ? `--id ${holder.id}` : holder.id === null ? '--stale' : null;
      return { refusal: { reason: 'workflow-claim-held',
        detail: `a workflow claim is held by ${holder.label ?? 'an unknown holder'} (id ${holder.id ?? 'none'}, ${holder.age_seconds}s old), and a conversion would move files under it`,
        hint: `let that workflow finish, or if it is dead free it with ${free
          ? `\`planning.mjs workflow-claim release --fire ${fire} ${free}\``
          : `by removing ${join(gitDir, CLAIM_FILE)} by hand`}, then re-run; nothing was changed` } };
    }
    const live = planWorktrees(root)[0];
    if (live) {
      return { refusal: { reason: 'plan-worktree-live',
        detail: `the plan worktree ${live.path} is live on ${live.branch}, and a conversion would move files under it`,
        hint: 'finish and merge that plan, or remove the worktree with `git worktree remove`, then re-run; nothing was changed' } };
    }
  }
  const plan = planMoves(dir);
  const refusal = judgeMoves(dir, plan);
  return refusal ? { refusal } : { moves: plan.moves };
}

/**
 * Is a commit due after a conversion: the project commits its planning files, and git does not ignore them.
 * @param {string} dir
 */
function commitDue(dir) {
  // the config seam resolves the key across both layers and the schema default, so this file holds no second merge
  try {
    const got = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('../config.mjs', import.meta.url)),
      'get', '--file', join(resolve(dir), 'config.json'), 'planning.commit_docs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    if (got.values?.['planning.commit_docs'] === false) return false;
  } catch { /* unreadable settings leave the default, which is to commit */ }
  const root = resolve(dir, '..');
  if (git(['-C', root, 'rev-parse', '--git-dir']) === null) return false;
  try {
    execFileSync('git', ['-C', root, 'check-ignore', '-q', '--', join(resolve(dir), 'ROADMAP.md')], { stdio: 'ignore' });
    return false;
  } catch { return true; }
}

/**
 * Do the moves, then build the state from the project at its new place, write it last and render the views.
 * @param {string} dir @param {Move[]} moves
 * @returns {Refusal | null}
 */
function convert(dir, moves) {
  const steps = moves.map((m) => /** @type {[string, () => void]} */ ([m.from, () => {
    // its twin is already home, so dropping the old copy is the whole move
    if (m.dup) return unlinkFile(m.from);
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
      hint: steps.length
        ? 'fix the cause the detail names and re-run - the records were already moved into the layout and no state file was written; the next run finishes the conversion'
        : 'fix the cause the detail names and re-run - no state file was written, and the project files were not changed' };
  }
  const worked = existsSync(join(dir, 'ROADMAP.md')) || steps.length > 0;
  // a view the project never had is not invented here; the seams that own the cursor write STATE.md when they first set it
  if (worked) writeViews(dir, imported.state, VIEWS.filter((v) => existsSync(join(dir, v))));
  if (worked) {
    const due = commitDue(dir);
    note = { converted: true, layout: STATE_LAYOUT, commit_due: due,
      ...(due ? { hint: 'make one commit of the planning directory before going on (git add -A on it, then git commit), under the rule in references/git-guard.md' } : {}) };
  }
  return null;
}

/** A refusal's hint for a state file that is there but not valid, by why it is not. @param {string} why */
function invalidHint(why) {
  if (why === 'newer-layout') return 'this project was written by a newer Cadence - update the plugin; the file was not touched';
  if (why === 'unreadable') return 'make the state file readable and re-run - it was not touched, since a file that could not be read may still be valid';
  return 'run `planning.mjs state-rebuild`, which rebuilds the state file from the project\'s files, then re-run this; nothing was changed';
}

/**
 * `state-rebuild`: a state file that is there and does not parse is replaced, under its lock, with what the importer reads
 * from the project as it stands, stamped at this layout, and the views are rendered from it. Nothing moves: a rebuild is
 * not a conversion. A valid state is left alone, since it may hold what no artifact does.
 * @param {string} dir
 */
export function cmdStateRebuild(dir) {
  const file = statePath(dir);
  const got = readState(dir);
  // an unstamped project was converted before this ran, so absent here is the linked planning directory nothing stamps
  if (got.kind === 'absent') return loadState(dir);
  if (got.kind === 'valid') return ok({ rebuilt: false, file, detail: 'the state file is valid, so nothing was rebuilt' });
  if (got.reason === 'newer-layout' || got.reason === 'unreadable') {
    return fail('invalid-state', `${file}: ${got.reason} - ${got.detail}`, invalidHint(got.reason));
  }
  const imported = importState(dir);
  if (imported.ok === false) {
    const { reason, detail, issues, hint } = imported;
    return emit({ ok: false, reason, detail, ...(issues ? { issues } : {}), hint: `${hint} - the state file was not touched` });
  }
  /** @type {string[]} */
  const views = [];
  const wrote = rebuildState(dir, imported.state, (state) => {
    writeViews(dir, state, VIEWS.filter((v) => existsSync(join(dir, v))), views);
  });
  if (wrote.ok === false) {
    if (wrote.reason === 'newer-layout' || wrote.reason === 'unreadable') {
      return fail('invalid-state', wrote.detail, invalidHint(wrote.reason));
    }
    const written = 'stateWritten' in wrote && wrote.stateWritten;
    return fail('state-write-failed', `${file}: ${wrote.reason} - ${wrote.detail}`, written
      ? 'the state file was rebuilt, but the generated files may still show the old state - fix the cause the detail names; the next state write renders them again'
      : 'fix the cause the detail names and re-run - the state file was not touched');
  }
  // another call made the file valid between the look and the lock
  if (!wrote.changed && wrote.was === 'valid') return ok({ rebuilt: false, file, detail: 'the state file is valid, so nothing was rebuilt' });
  const s = imported.state;
  return ok({ rebuilt: true, file, layout: STATE_LAYOUT, was: got.reason,
    phases: s.phases.length, requirements: s.requirements.length, cursor: s.cursor !== null, views });
}

/**
 * Make sure the planning directory has a valid state file before a handler runs, converting an unstamped project once.
 * @param {string} dir the planning directory the call resolved
 * @param {'now' | 'before' | 'after' | 'rebuild'} [mode] 'now' judges and converts; 'before' judges only; 'after' converts
 *   with no refusal emitted; 'rebuild' is 'now' that lets a state file that is there but not valid through to `state-rebuild`
 * @returns {boolean} true when the handler may run; false when a refusal has been emitted and the handler must not
 */
export function ensureState(dir, mode = 'now') {
  const quiet = mode === 'after';
  note = null;
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
    // the rebuild judges the file again under its own lock, newer layouts and unreadable files included
    if (mode === 'rebuild') return true;
    if (quiet) return false;
    fail('invalid-state', `${statePath(dir)}: ${got.reason} - ${got.detail}`, invalidHint(got.reason));
    return false;
  }

  // two first calls at once would each move the same files, so the conversion holds a lock and the loser looks again
  /** @type {Refusal | null} */
  let refusal = null;
  if (mode === 'before') {
    const verdict = judge(dir);
    refusal = 'refusal' in verdict ? verdict.refusal : null;
  } else {
    const held = withPlanningFileLock(join(dir, LOCK_NAME), () => {
      if (readState(dir).kind !== 'absent') return null;
      const verdict = judge(dir);
      return 'refusal' in verdict ? verdict.refusal : convert(dir, verdict.moves);
    }, 'layout-locked');
    refusal = held.ok === false
      ? { reason: held.reason, detail: held.detail,
        hint: 'another seam is converting this project - let it finish and re-run, or clear a stale lock the detail names; nothing was changed' }
      : held.value;
  }
  if (refusal) {
    if (quiet) return false;
    // emitted directly because fail has no channel for the issue list
    const { reason, detail, issues, hint } = refusal;
    emit({ ok: false, reason, detail, ...(issues ? { issues } : {}), hint });
    return false;
  }
  return true;
}
