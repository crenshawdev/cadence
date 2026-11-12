// @ts-check
// planning/criteria-size.mjs - `criteria-size`: the criteria-count ceilings three workflows state in prose, as numbers
// CRITERIA_CEILINGS is the flag/name/source/bound table the ceilings are read through; nothing else reads it
'use strict';

import { join } from 'node:path';
import { fail, phaseGuard, ok, read } from './core.mjs';
import {
  classifyAcceptanceCriteria, phaseCriteria,
} from '../lib/planning-files.mjs';
import { requireInt } from '../lib/require-int.mjs';
import { loadState, phaseListOf } from './state-import.mjs';

// context.md says 3-7 acceptance criteria, new-project.md and adopt.md 2-5 per roadmap phase; nothing counted either
// two grammars in one call: CONTEXT via classifyAcceptanceCriteria, ROADMAP's per-phase list via phaseCriteria
// the four ceilings arrive as flags, not config keys, like plan-size: they're a shape rule on planning documents
// a report, never a gate: `over` names the phase, its count and the bound it broke, and the workflow decides
const CRITERIA_CEILINGS = [
  { flag: 'context-min', name: 'context_min', source: 'context', bound: 'min' },
  { flag: 'context-max', name: 'context_max', source: 'context', bound: 'max' },
  { flag: 'roadmap-min', name: 'roadmap_min', source: 'roadmap', bound: 'min' },
  { flag: 'roadmap-max', name: 'roadmap_max', source: 'roadmap', bound: 'max' },
];

function cmdCriteriaSize(dir, opts) {
  // resolved to plain numbers at the boundary, never the requireInt envelope, as cmdPlanSize does
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

  // `--phase` scopes to one phase in the caller's spelling; absent walks every roadmap phase
  let targets;
  if (opts.phase !== undefined) {
    // the tree-aware collision check runs before any phase-directory read (#42, #45); `phases/1.10/` stays addressable
    const parsedPhase = phaseGuard('criteria-size', dir, opts.phase, 'criteria-size --phase needs a phase number',
      'send a plain phase number - 3, or 3.1 for an inserted phase - or drop --phase to check'
      + ' every phase the roadmap declares in one call',
      're-run with one of the two spellings the detail names - nothing was read');
    if (!parsedPhase) return;
    targets = [{ n: parsedPhase.value, raw: parsedPhase.raw }];
  } else {
    const state = loadState(dir);
    if (!state) return;
    targets = phaseListOf(state).map((p) => ({ n: p.n, raw: String(p.n) }));
  }

  const phases = [];
  const over = [];
  const comparedNames = new Set();

  for (const t of targets) {
    const roadmap = phaseCriteria(roadmapText, t.raw);
    const contextText = read(join(dir, 'phases', t.raw, 'CONTEXT.md'));
    // `criteria: null` is an absent or near-miss heading and neither is zero: the section was never walked
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
      // absence is not zero: zero criteria under a floor of 3 would report every unwritten CONTEXT as a defect
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

  // `compared` names the ceilings that ran and an empty one makes `within` null, not a bare true that compared nothing
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
