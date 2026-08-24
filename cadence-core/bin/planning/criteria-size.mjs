// @ts-check
// planning/criteria-size.mjs - `criteria-size`: the criteria-count ceilings
// three workflows state in prose, as arithmetic.
//
// `CRITERIA_CEILINGS` is the flag/name/source/bound table those ceilings are
// read through and nothing else reads it, so it travels with the handler (D-05).
'use strict';

import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import {
  classifyAcceptanceCriteria, parseRoadmapPhases, phaseCriteria,
} from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';

// ---------------------------------------------------------------------------
// criteria-size - the criteria-count ceilings three workflows state in PROSE,
// as arithmetic. `context.md:281` says 3-7 acceptance criteria, `new-project.md`
// and `adopt.md` say 2-5 success criteria per roadmap phase, and nothing has
// ever counted either: the whole measured lesson of this phase is that a prose
// rule a model is asked to follow fails silently while a count does not.
//
// TWO grammars in one call, because the ceilings live in two files and only one
// of them had a reader (D-01): CONTEXT's `## Acceptance criteria` through
// `classifyAcceptanceCriteria` (already the reader `criteria-coverage` counts
// per phase) and ROADMAP's per-phase criteria list through `phaseCriteria`. A
// single-parser design would report not-found for every roadmap phase and ship
// the new-project/adopt half with no enforcement at all - the exact silent
// no-op this seam exists to remove.
//
// The four ceilings are the CALLER's literal numbers, arriving as flags, and
// are NOT config keys (D-04) - the same rule `plan-size` states above, for the
// same reason: two keys would each need a config.schema.json entry, a
// config-catalog row and a config-reach row to express a shape rule about
// planning documents rather than a per-project preference.
//
// A REPORT, never a gate: `over` names the phase, its measured count and the
// bound it broke, and the workflow decides - exactly as `plan-size`'s
// `phase-too-big` is presented and acted on by prose.
const CRITERIA_CEILINGS = [
  { flag: 'context-min', name: 'context_min', source: 'context', bound: 'min' },
  { flag: 'context-max', name: 'context_max', source: 'context', bound: 'max' },
  { flag: 'roadmap-min', name: 'roadmap_min', source: 'roadmap', bound: 'min' },
  { flag: 'roadmap-max', name: 'roadmap_max', source: 'roadmap', bound: 'max' },
];

function cmdCriteriaSize(dir, opts) {
  // Resolved to plain numbers at the boundary, never carried as the requireInt
  // envelope - the same shape rule cmdPlanSize states.
  /** @type {Record<string, number|null>} */
  const ceiling = {};
  for (const c of CRITERIA_CEILINGS) {
    ceiling[c.name] = null;
    if (opts[c.flag] === undefined) continue;
    const parsed = requireInt(opts[c.flag]);
    if (!parsed.ok) {
      return fail('bad-args', `--${c.flag} must be an integer`,
        `send --${c.flag} as a plain integer, or drop it to report the counts without that bound`);
    }
    ceiling[c.name] = parsed.value;
  }

  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) {
    return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md - with no --phase this walks'
      + ' the phase list there, so it cannot run without one');
  }

  // `--phase` present scopes to one phase, in the CALLER's spelling (D-02);
  // absent walks every phase the roadmap declares, through the same
  // `parseRoadmapPhases` list `cmdCriteriaCoverage` walks - so a caller that
  // just wrote a whole roadmap checks all of it in ONE call, which is what
  // new-project and adopt need at their approval gate.
  let targets;
  if (opts.phase !== undefined) {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) {
      return fail('bad-args', 'criteria-size --phase needs a phase number',
        'send a plain phase number - 3, or 3.1 for an inserted phase - or drop --phase to check'
        + ' every phase the roadmap declares in one call');
    }
    targets = [{ n: parsedPhase.value, raw: parsedPhase.raw }];
  } else {
    targets = parseRoadmapPhases(roadmapText).map((p) => ({ n: p.n, raw: String(p.n) }));
  }

  const phases = [];
  const over = [];
  const comparedNames = new Set();

  for (const t of targets) {
    const roadmap = phaseCriteria(roadmapText, t.raw);
    const contextText = read(join(dir, 'phases', t.raw, 'CONTEXT.md'));
    // `criteria: null` is BOTH an absent `## Acceptance criteria` heading and a
    // near-miss one, and neither is zero: the second means this reader never
    // walked the section, so what the phase declares is not known here.
    const classified = contextText === null ? null : classifyAcceptanceCriteria(contextText);
    const contextCriteria = classified && classified.criteria ? classified.criteria : null;

    phases.push({
      phase: t.n,
      context_criteria: contextCriteria ? contextCriteria.length : 0,
      context_found: contextCriteria !== null,
      roadmap_criteria: roadmap.count,
      roadmap_found: roadmap.found,
    });

    for (const c of CRITERIA_CEILINGS) {
      const limit = ceiling[c.name];
      if (limit === null) continue;
      // Absence is not zero (D-03): a source that declared nothing is never
      // compared, because zero criteria under a floor of 3 would report every
      // unwritten CONTEXT.md as a defect in the document nobody has written.
      const found = c.source === 'context' ? contextCriteria !== null : roadmap.found;
      if (!found) continue;
      comparedNames.add(c.name);
      const measured = c.source === 'context' ? contextCriteria.length : roadmap.count;
      if (c.bound === 'min' ? measured >= limit : measured <= limit) continue;
      over.push({
        kind: `${c.source}-criteria-too-${c.bound === 'min' ? 'few' : 'many'}`,
        phase: t.n,
        measured,
        ceiling: limit,
        detail: `phase ${t.n} declares ${measured} ${c.source} criteria, `
          + `${c.bound === 'min' ? 'floor' : 'ceiling'} ${limit}`,
      });
    }
  }

  // The conditional-comparison envelope, not a bare boolean (D-03). `compared`
  // names the ceilings that ACTUALLY ran against a source that was found; an
  // empty one makes `within` null, because `ok:true, within:true` having
  // compared nothing reproduces inside this seam the very defect it was built
  // to report.
  const compared = CRITERIA_CEILINGS.filter((c) => comparedNames.has(c.name)).map((c) => c.name);
  ok({
    ...(opts.phase !== undefined ? { phase: targets[0].n } : {}),
    phases,
    ...Object.fromEntries(CRITERIA_CEILINGS
      .filter((c) => ceiling[c.name] !== null).map((c) => [c.name, ceiling[c.name]])),
    over,
    compared,
    within: compared.length ? over.length === 0 : null,
  });
}

export { cmdCriteriaSize };
