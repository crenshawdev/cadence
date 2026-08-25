// @ts-check
// planning/status.mjs - `status`: where the project is, derived from the phase
// artifacts on disk and reconciled against the STATE.md cursor.
//
// The drift walk over the phase-directory grammar (`phaseDirGrammarDrift`) and
// the cursor/derived agreement table (`AGREE`) live here because nothing else
// reads them - phase 4's D-05 partition puts a single-use helper beside its
// handler and leaves the multi-family readers in planning/core.mjs. The grammar
// itself (`PHASE_DIR_NAME`) is one of those readers and is imported from there.
'use strict';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHASE_DIR_NAME, derivePhases, fail, listPlanFiles, ok, read, readQueue } from './core.mjs';
import { classifyPhaseList, parseCursor, parseRequirements } from '../lib/planning-files.mjs';
import { emit } from '../lib/seam-io.mjs';

/**
 * Every `phases/` entry outside `PHASE_DIR_NAME`, as one drift entry per
 * colliding group.
 *
 * ONE kind covers named, zero-padded and prefix-colliding entries (D-08). There
 * is deliberately no second "shadowing" diagnostic: every writer builds its path
 * as `join(dir, 'phases', <spelling>)`, which can never PRODUCE
 * `14-data-depth-x`, so a shadowing rule would report a hazard no code path
 * reaches. What is worth reporting instead is the collision the reader would
 * otherwise have to notice for themselves - `08` beside a legal `8` - so
 * entries sharing a leading numeric prefix are named together in one entry, and
 * the legal directory of that prefix is named in the detail.
 *
 * An absent `phases/` is data, never a throw. A stray FILE is not a phase
 * directory and is not reported: `.DS_Store` would only make the diagnostic
 * noise. Entries that are entirely legal produce NOTHING, so `drift` stays
 * absent on a clean tree and a legal name is never itself listed in `entries`.
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
    // The leading digit run READ AS A NUMBER, so `08`, `08-meteogram-legend` and
    // `8-foo` all group with a legal `8`. A name with no leading digits at all
    // collides with no phase and gets a group to itself.
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
    // NO `phase` key, the same reason `unpicked` omits one: there is no phase
    // number to report, and inventing one would make this indistinguishable from
    // the drift kinds that legitimately have one.
    out.push({ kind: 'phase-dir-grammar', entries, detail });
  }
  return out;
}

// Which cursor statuses are consistent with a derived phase status.
const AGREE = {
  unplanned: ['ready to plan', 'context gathered'],
  planned: ['planned'],
  executed: ['executed'],
};

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
function cmdStatus(dir) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`, '/cad-new-project');
  // The phase-list grammar (references/roadmap-phases.md). An empty section is
  // a DERIVED closed milestone, not a parse failure; a phase-shaped line that
  // is not a canonical entry is reported per line with its own code.
  const classified = classifyPhaseList(roadmapText);
  if (classified.state === 'no-section') {
    return fail('unparseable-roadmap', 'no `## Phases` section in ROADMAP.md',
      'add a `## Phases` heading to ROADMAP.md, outside any code fence - a closed milestone'
      + ' is that heading with nothing under it, never a missing heading');
  }
  if (classified.state === 'out-of-grammar') {
    // Emitted directly rather than through fail(), which has no channel for
    // the issue list. The detail names the FIRST offending line, so the
    // diagnostic identifies what to fix instead of restating the grammar.
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

  // Interrupted-close corroboration: a closed milestone whose `phases/<N>/`
  // directories are still on disk. Kept OUT of the classifier on purpose - the
  // verdict is text-only and pure (D-05); this is the filesystem half, and it
  // reports the accurate PAIR (closed state AND drift) rather than letting one
  // orphan directory disprove the close.
  if (closed) {
    let entries = [];
    try { entries = readdirSync(join(dir, 'phases')); } catch { /* absence is data */ }
    // The GRAMMAR, not a looser numeric shape: with `/^\d+(\.\d+)?$/` here a
    // tree holding `phases/8` and `phases/08` emitted TWO `phase-dir` entries
    // both carrying `phase: 8`, since `Number` collapses the padding the filter
    // let through. An illegal name is reported by `phaseDirGrammarDrift` under
    // its own kind and is not a surviving phase directory (D-04).
    const surviving = entries.filter((e) => PHASE_DIR_NAME.test(e))
      .sort((a, b) => Number(a) - Number(b));
    for (const e of surviving) {
      const { plans } = listPlanFiles(join(dir, 'phases', e));
      drift.push({
        kind: 'phase-dir', phase: Number(e),
        detail: `phases/${e}/ survives the milestone close (${plans.length} plan files)`,
      });
    }
  }

  // The phase-directory grammar, checked in EVERY state and not only after a
  // close: a directory Cadence cannot address is wrong while the cycle is open,
  // which is when it can still be renamed cheaply.
  drift.push(...phaseDirGrammarDrift(dir));

  // Requirements drift (optional file; Deferred rows and unmapped rows are
  // audit's concern, not drift).
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

  // Cursor: a hint, compared against the derivation (derivation wins).
  const cursorText = read(join(dir, 'STATE.md'));
  const parsed = cursorText !== null ? parseCursor(cursorText) : null;
  let cursor;
  if (parsed) {
    let agrees;
    if (parsed.status === 'paused') agrees = true; // legal at any point
    // A closed milestone: `phase complete` and `ready to plan` both agree, so
    // `planned`/`executed`/`context gathered` stay drift - detection must NOT
    // die in the one state where the cursor is the only surviving evidence.
    // The phase NUMBER is not compared: a zero-phase roadmap gives it nothing
    // to agree with.
    else if (closed) agrees = parsed.status === 'phase complete' || parsed.status === 'ready to plan';
    else if (current === null) agrees = parsed.status === 'phase complete';
    else agrees = parsed.phase === current &&
      (AGREE[currentEntry.status] || []).includes(parsed.status);
    cursor = { phase: parsed.phase, status: parsed.status, next: parsed.next, updated: parsed.updated, agrees };
    if (!agrees) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor says phase ${parsed.phase} ${parsed.status}; derived ` +
          (closed ? 'closed milestone (no phases in ROADMAP)'
            : current === null ? 'all complete' : `phase ${current} ${currentEntry.status}`),
      });
    }
    // A stale `of <M>` against a zero-phase roadmap, reported INDEPENDENTLY of
    // `agrees` (which the mapping above governs alone - a `phase complete`
    // cursor still agrees). This is the case the phase-dir drift cannot see: a
    // tagged close deletes `phases/<N>/`, so when the prune commits and the
    // cursor rewrite never runs, the stale total is literally the only
    // surviving evidence.
    if (closed && parsed.total !== 0) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor totals ${parsed.total} phases; ROADMAP has none - ` +
          'milestone close did not finish (run cursor set)',
      });
    }
  }

  // THE DEFERRED QUEUE, off the one derivation `deferred list` answers from, so
  // /cad-progress and /cad-land cannot disagree about what is queued.
  //
  // ALWAYS PRESENT, unlike `cycle` and `drift` beside it, which appear only in
  // their own states. This key is read by a REFUSAL surface: a caller has to be
  // able to tell "nothing is deferred" from "this seam predates the queue", and
  // a key that is absent in the empty state collapses those two into one answer
  // - the fail-open one, on the gate whose whole job is to refuse.
  //
  // NOT a cursor status and NOT a drift kind (D-05). A `Status:` value outside
  // `AGREE` above is reported as `cursor` drift and rewritten by the very next
  // /cad-progress, so a queue recorded there would stop being recorded one
  // command after it was written.
  const queue = readQueue(dir, null);

  ok({
    current, total: derived.length,
    deferred: queue,
    // Additive, and present ONLY in the closed state: a caller branching on
    // `current === null` alone would otherwise read a closed milestone as
    // "all phases complete" and route back to /cad-milestone.
    ...(closed ? { cycle: 'none' } : {}),
    phases: derived.map((p) => ({
      n: p.n, name: p.name, status: p.status,
      // plans listed only when they deviate from a single PLAN.md
      ...(p.plans.length > 1 || (p.plans.length === 1 && p.plans[0] !== 'PLAN.md')
        ? { plans: p.plans } : {}),
      ...(p.uat ? { uat: p.uat.counts } : {}),
    })),
    ...(cursor ? { cursor } : {}),
    ...(drift.length ? { drift } : {}),
  });
}

export { cmdStatus };
