// @ts-check
// planning/req-row.mjs - `req-row`: one change to one requirement row the state holds, re-pointed at a phase or deferred
// the `## Traceability` table is rendered from the state, so a row edited by hand there would be overwritten
// it adds no row (seed-reqs does) and writes no Complete (phase-done does); `## Active` and `## Shipped` stay as written
'use strict';

import { join } from 'node:path';
import { fail, ok, phaseSpellingRefusal, read } from './core.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { renderTraceability } from '../lib/state-views.mjs';
import { changeState } from './state-import.mjs';

/** @typedef {import('../lib/project-state.mjs').StateRequirement} StateRequirement */

function cmdReqRow(dir, opts) {
  const id = typeof opts.id === 'string' ? opts.id.trim() : '';
  if (!id) {
    return fail('bad-args', 'req-row needs --id <requirement id>',
      'pass --id with the id the `## Traceability` table shows, then re-run; nothing was written');
  }
  const defer = 'defer' in opts;
  if (defer === ('phase' in opts)) {
    return fail('bad-args', 'req-row takes exactly one of --phase <N> or --defer',
      'send --phase <N> to re-point the row, or --defer to set a Pending row Deferred - one change per call; nothing'
      + ' was written');
  }
  let n = null;
  if (!defer) {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) {
      return fail('bad-args', 'req-row --phase needs a non-negative phase number (N or N.M)',
        'send a plain phase number - 3, or 3.1 for a phase between two others - then re-run; nothing was written');
    }
    const spelling = phaseSpellingRefusal(parsedPhase);
    if (spelling) {
      return fail('bad-args', `req-row ${spelling}`,
        'retype the flag in the spelling the detail names and re-run - the row stores the phase NUMBER; nothing was'
        + ' written');
    }
    n = parsedPhase.value;
  }

  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    return fail('no-requirements', `${reqFile} not found`,
      'point --dir at the .planning/ directory that holds REQUIREMENTS.md - the row is rendered into its'
      + ' `## Traceability` table; nothing was written');
  }
  // the table is rendered into its heading, the same refusal seed-reqs gives for the same missing table
  if (renderTraceability({ cycleOpen: false, cursor: null, phases: [], requirements: [] }, reqText).missing) {
    return fail('no-traceability-table', `${reqFile} has no "## Traceability" table with a header separator`,
      'add a `## Traceability` heading to REQUIREMENTS.md with a markdown table under it - a header row and its'
      + ' `| --- |` separator - then re-run; nothing was written');
  }

  // judged against the state under the lock; a refusal there empties the view list and hands the state back unchanged
  // one holder, so the body's assignments aren't narrowed away from the code after it
  const box = /** @type {{refused: [string, string, string] | null, row: StateRequirement | null}} */ ({ refused: null, row: null });
  const views = ['REQUIREMENTS.md'];
  const done = changeState(dir, (s) => {
    const held = s.requirements.find((r) => r.id === id);
    if (!held) {
      box.refused = ['unknown-requirement', `${id} has no row in the project's traceability table`,
        'check the id against the `## Traceability` table and re-run - this changes a row and never adds one; a row'
        + ' is seeded by `seed-reqs` from a plan\'s `requirements:` line. Nothing was written'];
    } else if (n !== null && !s.phases.some((p) => p.n === n)) {
      box.refused = ['unknown-phase', `phase ${n} is not in the project's phase list`,
        're-run with a phase number the `## Phases` list shows, or add the phase first with `phase-entry add`;'
        + ' nothing was written'];
    } else if (defer && held.status !== 'Pending') {
      box.refused = ['not-pending', `${id} is ${held.status}, and only a Pending row can be deferred`,
        'leave it as it is - a Complete row is `phase-done`\'s to set and to undo (`phase-done --undo`), and a'
        + ' Deferred one already is; nothing was written'];
    } else {
      box.row = n !== null ? { ...held, phase: n } : { ...held, status: 'Deferred' };
    }
    const row = box.row;
    if (!row) { views.length = 0; return s; }
    return { ...s, requirements: s.requirements.map((r) => (r.id === id ? row : r)) };
  }, views);
  if (!done) return;
  const { refused, row } = box;
  if (refused) return fail(refused[0], refused[1], refused[2]);
  if (!row) return fail('internal', 'req-row changed no row and gave no reason');
  ok({ id: row.id, phase: row.phase, status: row.status });
}

export { cmdReqRow };
