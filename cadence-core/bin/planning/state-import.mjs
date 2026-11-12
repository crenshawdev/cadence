// @ts-check
// planning/state-import.mjs - builds a project state from what `status` derives, and writes nothing
// the derivation is core.mjs's readProject, the one `status` calls, so the two can't drift apart
// a plan is finished when its report says so, or when its whole phase derived `complete`; a workflow run file is never read
'use strict';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readProject } from './core.mjs';
import { CURSOR_WORDS } from '../lib/project-state.mjs';

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

  const phases = project.derived.map((p, i) => {
    const done = new Map(project.reportsOf[i].map((r) => [r.plan, r.complete]));
    return {
      // a name that parses blank (`**Phase 1:  **`) can't be stored; the number stands in for it, as the views do for a missing one
      n: p.n, name: p.name.trim() === '' ? `Phase ${p.n}` : p.name, description: p.desc, status: p.status,
      plans: p.plans.map((file) => ({ file, finished: p.status === 'complete' || done.get(file) === true })),
    };
  });
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
