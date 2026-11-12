// @ts-check
// planning/state-import.mjs - builds a project state from what `status` derives, and writes nothing; below it, what the seams share
// the derivation is core.mjs's readProject, the one `status` calls, so the two can't drift apart
// a plan is finished when its report says so, or when its whole phase derived `complete`; a workflow run file is never read
// the seam half: load the state or refuse, change it under the lock, and write the views from the state as it landed
'use strict';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { derivePhases, fail, read, readProject } from './core.mjs';
import { CLOSED_CYCLE_NAME } from '../lib/planning-files.mjs';
import { atomicWrite } from '../lib/planning-store.mjs';
import { CURSOR_WORDS, readState, statePath, updateState } from '../lib/project-state.mjs';
import { renderPhasesList, renderStateMd, renderTraceability } from '../lib/state-views.mjs';

/** A planning directory holding any of these has been worked in, so a missing ROADMAP.md there is damage and not a fresh start. */
function hasLeftovers(dir) {
  let phases = [];
  try { phases = readdirSync(join(dir, 'phases')); } catch { /* none */ }
  if (phases.length) return true;
  if (existsSync(join(dir, 'STATE.md'))) return true;
  try { return readdirSync(dir).some((e) => e.startsWith('_archive-')); } catch { return false; }
}

/**
 * Read a planning directory into a state, or refuse. Pure reads: the three Markdown files and the phase folders, never
 * `.planning/state.json` and never anything under `records/`.
 * @param {string} dir the planning directory
 * @returns {{ok: true, state: import('../lib/project-state.mjs').ProjectState}
 *   | {ok: false, reason: string, detail: string, hint: string, issues?: unknown[]}}
 */
export function importState(dir) {
  const project = readProject(dir);
  if (project.missing) {
    // nothing set up yet is a fresh project; a planning tree with work in it and no roadmap is one `status` can't read either
    if (hasLeftovers(dir)) {
      return { ok: false, reason: 'no-roadmap', detail: `${join(dir, 'ROADMAP.md')} not found`,
        hint: 'restore ROADMAP.md, or run /cad-new-project if this project was never set up' };
    }
    return { ok: true, state: { cycleOpen: false, cursor: null, phases: [], requirements: [] } };
  }
  if (project.refusal) return { ok: false, ...project.refusal };

  const phases = phasesOf(project);
  const c = project.cursor;
  // a status outside the six lifecycle words is left out, not repaired; `next` is carried exactly as parsed
  // a `Plan:` position the state can't hold (`Plan: 0 of 2`, which /cad-health allows) is dropped from the cursor alone
  const plan = c?.plan && c.plan.k >= 1 && c.plan.j >= 1 ? { plan: c.plan } : {};
  const cursor = c && CURSOR_WORDS.includes(c.status)
    ? { phase: c.phase, status: c.status, next: c.next, updated: c.updated, ...plan }
    : null;
  return {
    ok: true,
    state: {
      cycleOpen: !project.closed, cursor, phases,
      requirements: (project.reqRows ?? []).map((r) => ({ id: r.id, phase: r.phase, status: r.status })),
    },
  };
}

/**
 * The phases of a readable project as the state holds them: derived status, and a plan finished when its report says so
 * or its phase derived complete.
 * @param {any} project what `readProject` answered when it neither refused nor found nothing
 * @returns {import('../lib/project-state.mjs').StatePhase[]}
 */
export function phasesOf(project) {
  return project.derived.map((p, i) => {
    const done = new Map(project.reportsOf[i].map((/** @type {any} */ r) => [r.plan, r.complete]));
    return {
      // a name that parses blank (`**Phase 1:  **`) can't be stored; the number stands in for it, as the views do for a missing one
      n: p.n, name: p.name.trim() === '' ? `Phase ${p.n}` : p.name, description: p.desc, status: p.status,
      plans: p.plans.map((/** @type {string} */ file) => ({ file, finished: p.status === 'complete' || done.get(file) === true })),
    };
  });
}

/**
 * The cursor as `cursor get` answers it: the state's cursor with the total and name the views would show. Neither is
 * stored; the total is the length of the phase list and the name is that phase's, or the closed-cycle name when no cycle is open.
 * @param {import('../lib/project-state.mjs').ProjectState} state
 */
export function cursorOf(state) {
  const c = state.cursor;
  if (!c) return null;
  const phase = state.phases.find((p) => p.n === c.phase);
  return {
    phase: c.phase, total: state.phases.length,
    name: phase ? phase.name : (state.cycleOpen ? `Phase ${c.phase}` : CLOSED_CYCLE_NAME),
    status: c.status, next: c.next, updated: c.updated, ...(c.plan ? { plan: c.plan } : {}),
  };
}

/**
 * The project's state, or null after emitting the refusal. Absent here means the stamp could not be written (a linked
 * planning directory, which `ensureState` leaves alone), since a seam that gets this far was given its state file first.
 * @param {string} dir
 */
export function loadState(dir) {
  const got = readState(dir);
  if (got.kind === 'valid') return got.state;
  fail('no-state', got.kind === 'absent' ? `${statePath(dir)} does not exist` : `${statePath(dir)}: ${got.detail}`,
    got.kind === 'absent'
      ? 'a planning directory that is itself a link is never stamped - point --dir at the real directory; nothing was changed'
      : '/cad-progress rebuilds the state file from the project\'s files; nothing was changed');
  return null;
}

/** The generated files a state write can refresh. */
const VIEW_FILES = ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md'];

/**
 * Write the named generated files from a state, leaving a file the state already agrees with as it was. A file that is
 * missing, or whose heading is missing, is skipped: a view is never invented.
 * @param {string} dir @param {import('../lib/project-state.mjs').ProjectState} state @param {string[]} views
 * @param {string[]} [wrote] gets the name of each file once it agrees with the state, in order, so a caller can say how far a failed write got
 */
export function writeViews(dir, state, views, wrote = []) {
  for (const v of VIEW_FILES.filter((f) => views.includes(f))) {
    const file = join(dir, v);
    const had = read(file);
    let text;
    if (v === 'STATE.md') text = renderStateMd(state);
    else if (had === null) continue;
    else {
      const r = (v === 'ROADMAP.md' ? renderPhasesList : renderTraceability)(state, had);
      if (r.missing) continue;
      text = r.text;
    }
    if (text !== had) atomicWrite(file, text);
    wrote.push(v);
  }
  return wrote;
}

/**
 * Change the state under its lock and write the views from it before the lock goes. On a failure the refusal is emitted
 * and null comes back; `onFail` lets a seam that must say more (what was written) emit its own.
 * @param {string} dir @param {(state: import('../lib/project-state.mjs').ProjectState) => import('../lib/project-state.mjs').ProjectState} change
 * @param {string[]} views
 * @param {{wrote?: string[], onFail?: (res: any) => void}} [opts]
 * @returns {import('../lib/project-state.mjs').ProjectState | null}
 */
export function changeState(dir, change, views, opts = {}) {
  const res = updateState(dir, change, (state) => { writeViews(dir, state, views, opts.wrote); });
  if (res.ok) return res.state;
  if (opts.onFail) opts.onFail(res);
  else {
    const bad = /** @type {any} */ (res);
    fail(bad.reason === 'state-locked' ? 'state-locked' : 'state-write-failed', `${statePath(dir)}: ${bad.reason} - ${bad.detail}`,
      bad.reason === 'state-locked'
        ? 'another seam is writing the state file - let it finish, or clear a stale lock the detail names, then re-run'
        : 'fix the cause the detail names and re-run; the state file and the generated files agree again on the next state write');
  }
  return null;
}

/**
 * The state's phases in the shape `parseRoadmapPhases` gives, for the readers that walk a phase list: a phase is
 * checked when the state holds it complete.
 * @param {import('../lib/project-state.mjs').ProjectState} state
 */
export function phaseListOf(state) {
  return [...state.phases].sort((a, b) => a.n - b.n)
    .map((p) => ({ n: p.n, name: p.name, desc: p.description, checked: p.status === 'complete' }));
}

/**
 * Put what phase `n`'s artifacts derive into the state's entry for it: a seam that touches a phase records where the
 * phase really stands as part of its own write. A phase the state doesn't hold is left alone.
 * @param {string} dir @param {import('../lib/project-state.mjs').ProjectState} state @param {number} n
 * @returns {import('../lib/project-state.mjs').ProjectState}
 */
export function foldPhase(dir, state, n) {
  if (!state.phases.some((p) => p.n === n)) return state;
  const [derived] = derivePhases(dir, [{ n }]);
  return { ...state, phases: state.phases.map((p) => (p.n === n ? { ...p, status: derived.status } : p)) };
}

/** The state with its phase list replaced; a cycle is open exactly when there are phases. */
export function withPhases(state, phases) {
  return { ...state, phases, cycleOpen: phases.length > 0 };
}

/** What phase `n`'s artifacts derive as its status. */
export function derivedStatus(dir, n) {
  return derivePhases(dir, [{ n }])[0].status;
}
