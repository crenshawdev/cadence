// @ts-check
// planning/status.mjs - `status`: where the project is, from phase artifacts, reconciled against the STATE.md cursor
// phaseDirGrammarDrift and AGREE live here because nothing else reads them; the grammar is in core.mjs, shared
'use strict';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PHASE_DIR_NAME, derivePhases, fail, listPlanFiles, ok, planPosition, read, readPlanReports, readQueue,
} from './core.mjs';
import { classifyPhaseList, parseRequirements } from '../lib/planning-files.mjs';
import { parseCursor } from '../lib/state-cursor.mjs';
import { emit } from '../lib/seam-io.mjs';

/**
 * Every `phases/` entry outside `PHASE_DIR_NAME`, as one drift entry per colliding group.
 * One kind covers named, zero-padded and prefix-colliding entries, since no writer builds `14-data-depth-x`.
 * What's worth reporting is a collision like `08` beside a legal `8`.
 * Absent `phases/` is data, stray files aren't phase dirs, and a clean tree leaves `drift` absent.
 * @param {string} dir @returns {Array<{kind: string, entries: string[], detail: string}>}
 */
function phaseDirGrammarDrift(dir) {
  let listing = [];
  try { listing = readdirSync(join(dir, 'phases'), { withFileTypes: true }); }
  catch { return []; }
  /** @type {Map<string, {n: number|null, bad: string[], legal: string[]}>} */
  const groups = new Map();
  for (const ent of listing) {
    if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
    const lead = ent.name.match(/^\d+/);
    // 08, 08-meteogram-legend and 8-foo all group with a legal 8; a name with no leading digits gets a group to itself
    const n = lead ? Number(lead[0]) : null;
    const k = n === null ? `x:${ent.name}` : `n:${n}`;
    const g = groups.get(k) || { n, bad: [], legal: [] };
    (PHASE_DIR_NAME.test(ent.name) ? g.legal : g.bad).push(ent.name);
    groups.set(k, g);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.n === null || b.n === null) return a.n === b.n ? 0 : (a.n === null ? 1 : -1);
    return a.n - b.n;
  });
  const out = [];
  for (const g of ordered) {
    if (!g.bad.length) continue;
    const entries = g.bad.slice().sort();
    const legal = g.legal.slice().sort();
    const verb = entries.length > 1 ? 'are not phase directory names' : 'is not a phase directory name';
    let detail = `${entries.join(', ')} ${verb}`
      + ' (bare integer or N.M, neither part zero-padded, no slug)';
    if (entries.length > 1 && g.n !== null) detail += `; they share numeric prefix ${g.n}`;
    if (legal.length) {
      detail += `; ${legal.map((e) => `phases/${e}`).join(', ')} is the phase they collide with`;
    }
    // no phase key: there's no phase number to report, and inventing one would pass for the drift kinds that have one
    out.push({ kind: 'phase-dir-grammar', entries, detail });
  }
  return out;
}

/**
 * The legal phase-directory names on this tree that parse to the same number, one drift entry per colliding group.
 * `1.1` and `1.10` are different phases but `Number` collapses them; nothing to prefer or refuse, so it reports.
 * Separate from `phase-dir-grammar` because folding them in would tell a user to fix a spelling the grammar accepts.
 * @param {string[]} legalNames @returns {Array<{kind: string, phase: number, entries: string[], detail: string}>}
 */
function phaseDirNumericCollisions(legalNames) {
  /** @type {Map<number, string[]>} */
  const byNumber = new Map();
  for (const name of legalNames) {
    const n = Number(name);
    byNumber.set(n, [...(byNumber.get(n) || []), name]);
  }
  const out = [];
  for (const [n, names] of [...byNumber.entries()].sort((a, b) => a[0] - b[0])) {
    if (names.length < 2) continue;
    const entries = names.slice().sort();
    out.push({
      kind: 'phase-dir-collision', phase: n, entries,
      detail: `${entries.map((e) => `phases/${e}`).join(', ')} are different phases that `
        + `both parse to ${n}, so a numeric phase identity cannot tell them apart; `
        + 'rename one to a sub-phase ordinal that is unique',
    });
  }
  return out;
}

// Which cursor statuses are consistent with a derived phase status.
const AGREE = {
  unplanned: ['ready to plan', 'context gathered'],
  planned: ['planned'],
  executed: ['executed'],
};

function cmdStatus(dir) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`, '/cad-new-project');
  // an empty section is a derived closed milestone, not a parse failure
  const classified = classifyPhaseList(roadmapText);
  if (classified.state === 'no-section') {
    return fail('unparseable-roadmap', 'no `## Phases` section in ROADMAP.md',
      'add a `## Phases` heading to ROADMAP.md, outside any code fence - a closed milestone'
      + ' is that heading with nothing under it, never a missing heading');
  }
  if (classified.state === 'out-of-grammar') {
    // emitted directly because fail has no channel for the issue list
    const first = classified.issues[0];
    return emit({
      ok: false, reason: 'unparseable-roadmap',
      detail: `line ${first.line}: ${first.text}`,
      issues: classified.issues,
      hint: 'rewrite each line listed in `issues` as `- [ ] **Phase <n>: <name>** - <description>`'
        + ' under `## Phases`, or move it out of that section',
    });
  }
  const closed = classified.state === 'closed';
  const roadmap = classified.phases;

  const derived = derivePhases(dir, roadmap);
  const currentEntry = derived.find((p) => p.status !== 'complete') || null;
  const current = currentEntry ? currentEntry.n : null;

  const drift = [];
  for (const p of derived) {
    if (p.checked && p.status !== 'complete') {
      drift.push({ kind: 'roadmap-box', phase: p.n, detail: `box checked, derived ${p.status}` });
    } else if (!p.checked && p.status === 'complete') {
      drift.push({ kind: 'roadmap-box', phase: p.n, detail: 'derived complete, box unchecked' });
    }
  }

  // an interrupted close leaves phases/<N>/ on disk; reported as drift, not folded into the pure classifier
  if (closed) {
    let entries = [];
    try { entries = readdirSync(join(dir, 'phases')); } catch { /* absence is data */ }
    // the grammar, not a looser numeric shape: phases/8 beside phases/08 gave two entries for `phase: 8`
    // the name breaks ties since Number('1.1') === Number('1.10')
    const surviving = entries.filter((e) => PHASE_DIR_NAME.test(e))
      .sort((a, b) => (Number(a) - Number(b)) || (a < b ? -1 : a > b ? 1 : 0));
    for (const e of surviving) {
      const { plans } = listPlanFiles(join(dir, 'phases', e));
      drift.push({
        // 1.1 and 1.10 share a number, so `dir` carries the spelling
        kind: 'phase-dir', phase: Number(e), dir: e,
        detail: `phases/${e}/ survives the milestone close (${plans.length} plan files)`,
      });
    }
    drift.push(...phaseDirNumericCollisions(surviving));
  }

  // checked in every state: a directory Cadence can't address is cheapest to rename while the cycle is open
  drift.push(...phaseDirGrammarDrift(dir));

  // optional file; Deferred and unmapped rows are audit's concern, not drift
  const reqText = read(join(dir, 'REQUIREMENTS.md'));
  if (reqText !== null) {
    const byN = new Map(derived.map((p) => [p.n, p.status]));
    for (const r of parseRequirements(reqText)) {
      if (r.phase === null || r.status === 'Deferred' || !byN.has(r.phase)) continue;
      const phaseDone = byN.get(r.phase) === 'complete';
      if (phaseDone && r.status !== 'Complete') {
        drift.push({ kind: 'req-status', phase: r.phase, detail: `${r.id} still ${r.status}, phase derived complete` });
      } else if (!phaseDone && r.status === 'Complete') {
        drift.push({ kind: 'req-status', phase: r.phase, detail: `${r.id} Complete, phase derived ${byN.get(r.phase)}` });
      }
    }
  }

  // the cursor is a hint, the derivation wins
  const cursorText = read(join(dir, 'STATE.md'));
  const parsed = cursorText !== null ? parseCursor(cursorText) : null;
  let cursor;
  if (parsed) {
    let agrees;
    if (parsed.status === 'paused') agrees = true; // legal at any point
    // closed: only phase complete and ready to plan agree; the number isn't compared, a zero-phase roadmap has none
    else if (closed) agrees = parsed.status === 'phase complete' || parsed.status === 'ready to plan';
    else if (current === null) agrees = parsed.status === 'phase complete';
    else agrees = parsed.phase === current &&
      (AGREE[currentEntry.status] || []).includes(parsed.status);
    // plan is the cursor's own Plan: line when it has one; a mismatch with the derived position isn't drift
    cursor = {
      phase: parsed.phase, status: parsed.status, next: parsed.next, updated: parsed.updated, agrees,
      ...(parsed.plan ? { plan: parsed.plan } : {}),
    };
    if (!agrees) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor says phase ${parsed.phase} ${parsed.status}; derived ` +
          (closed ? 'closed milestone (no phases in ROADMAP)'
            : current === null ? 'all complete' : `phase ${current} ${currentEntry.status}`),
      });
    }
    // a stale "of <M>" on a zero-phase roadmap is reported on its own
    // a tagged close deletes phases/<N>/, so a cursor rewrite that never ran leaves this total as the only sign
    if (closed && parsed.total !== 0) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor totals ${parsed.total} phases; ROADMAP has none - ` +
          'milestone close did not finish (run cursor set)',
      });
    }
  }

  // off the one derivation deferred list uses, so /cad-progress and /cad-land agree on what's queued
  // always present, so a refusal surface can tell "nothing deferred" from "seam predates the queue"
  const queue = readQueue(dir, null);

  // plans a phase still owes, off the same readPlanReports replay-check dispatches from, so routing and dispatch agree
  // a SUMMARY ends a run, not the work, so a phase with a later gap plan shows up here
  // always present, [] when empty, like deferred: an absent key would read as "seam predates the field"
  // read here, not by spawning replay-check per phase; not a new status, which would turn older cursors into drift
  // the dir resolves through String(p.n) as derivePhases does, so phases/1.10 reads as phases/1.1 here too
  // each phase's reports are read here once and handed on to the plan position below
  const reportsOf = derived.map((p) => readPlanReports(join(dir, 'phases', String(p.n)), p.plans));
  const outstanding = [];
  derived.forEach((p, i) => {
    const plans = reportsOf[i].filter((r) => !r.complete).map((r) => r.plan);
    if (plans.length) outstanding.push({ phase: p.n, plans });
  });

  ok({
    current, total: derived.length,
    deferred: queue,
    outstanding,
    // only when closed, or current === null alone reads a closed milestone as all complete
    ...(closed ? { cycle: 'none' } : {}),
    phases: derived.map((p, i) => ({
      n: p.n, name: p.name, status: p.status,
      // the plan to run next, from the helper cursor set writes Plan: from; absent when none or all complete
      ...planPositionEntry(dir, p.n, reportsOf[i]),
      // plans listed only when they deviate from a single PLAN.md
      ...(p.plans.length > 1 || (p.plans.length === 1 && p.plans[0] !== 'PLAN.md')
        ? { plans: p.plans } : {}),
      ...(p.uat ? { uat: p.uat.counts } : {}),
    })),
    ...(cursor ? { cursor } : {}),
    ...(drift.length ? { drift } : {}),
  });
}

/** `{plan: {k, j, name?}}` for a phase with an unfinished plan, else `{}`. */
function planPositionEntry(dir, n, reports) {
  const plan = planPosition(join(dir, 'phases', String(n)), reports);
  return plan ? { plan } : {};
}

export { cmdStatus };
