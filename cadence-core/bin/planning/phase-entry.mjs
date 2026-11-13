// @ts-check
// planning/phase-entry.mjs - `phase-entry add|edit`: a phase's number, name and one-line description, written to the state
// the `## Phases` line is rendered from the state; the `### Phase N:` detail section stays hand-written and is never touched
// numbers are renumber's: add takes any number the state doesn't hold, so it fills the slot `renumber insert` leaves
'use strict';

import { join } from 'node:path';
import { PHASE_DIR_NAME, fail, ok, phaseSpellingRefusal, read } from './core.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';
import { parseRoadmapPhases } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { renderPhasesList } from '../lib/state-views.mjs';
import { CYCLE, appendEvent, cycleBoundaryIsNewest } from '../lib/trace.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';
import { changeState } from './state-import.mjs';

/** @typedef {import('../lib/project-state.mjs').StatePhase} StatePhase */

const NO_PHASES = { cycleOpen: false, cursor: null, phases: [], requirements: [] };

/**
 * Null when the line the renderer writes for this entry parses back to the same number, name and description, else why not.
 * The renderer and the reader are the judges, so a name that only looks odd but reads back is fine.
 * @param {StatePhase} entry @returns {[string, string, string] | null}
 */
function unreadable(entry) {
  const shown = renderPhasesList({ ...NO_PHASES, phases: [entry] }, '## Phases\n').text;
  const back = parseRoadmapPhases(shown)[0];
  if (back && back.n === entry.n && back.name === entry.name && back.desc === entry.description) return null;
  return ['bad-args', `the list line for phase ${entry.n} would not read back as written: ${shown.split('\n').pop()}`,
    'take the `**` and any other list markup out of the name and description, then re-run - the `## Phases` line'
    + ' is parsed back into the state, and nothing was written'];
}


function cmdPhaseEntry(dir, sub, opts) {
  if (sub !== 'add' && sub !== 'edit') {
    return fail('usage', 'phase-entry <add --phase N --name X --description Y | edit --phase N [--name X] [--description Y]>');
  }
  const label = `phase-entry ${sub}`;
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', `${label} needs --phase <N>, a non-negative phase number (N or N.M)`,
      'send a plain phase number - 3, or 3.1 for a phase between two others - then re-run; nothing was written');
  }
  const spelling = phaseSpellingRefusal(parsedPhase);
  if (spelling) {
    return fail('bad-args', `${label} ${spelling}`,
      'retype the flag in the spelling the detail names and re-run - the state stores the phase NUMBER; nothing was written');
  }
  // an add is a new phases/<N>/ to be, so it takes only what that directory can be named; edit still reaches any held number
  if (sub === 'add' && !PHASE_DIR_NAME.test(parsedPhase.raw)) {
    return fail('bad-args', `phase-entry add --phase "${parsedPhase.raw}" is not a number a phase directory can carry`,
      'send a whole number from 1 (3), or one with a fraction that does not start with 0 (3.1), then re-run;'
      + ' nothing was written');
  }
  const n = parsedPhase.value;

  // both are caller text, so each also comes by file; trimmed either way, since the line's grammar eats a description's lead spaces
  /** @type {{name?: string, description?: string}} */
  const given = {};
  for (const field of /** @type {const} */ (['name', 'description'])) {
    const resolved = resolveTextFlag(opts, field, label);
    if (!resolved.ok) {
      return fail('bad-args', resolved.detail,
        `pass --${field} or --${field}-file, never both, and point --${field}-file at a readable, non-empty file,`
        + ' then re-run; nothing was written');
    }
    const value = resolved.value !== undefined ? resolved.value : opts[field];
    if (typeof value === 'string') given[field] = value.trim();
  }
  if (sub === 'add' ? !given.name || !given.description : given.name === undefined && given.description === undefined) {
    return fail('bad-args', sub === 'add' ? 'phase-entry add needs --name and --description'
      : 'phase-entry edit needs --name, --description or both',
    `pass ${sub === 'add' ? 'both' : 'the one you are changing'}, each inline or through its -file flag, then re-run;`
      + ' the goal and success criteria are the hand-written `### Phase N:` section, not these');
  }
  if (given.name === '' || given.description === '') {
    return fail('bad-args', `${label} got a blank --name or --description`,
      'send the text you mean, then re-run - a blank name or description has no list line; nothing was written');
  }
  if (/[\r\n]/.test(`${given.name ?? ''}${given.description ?? ''}`)) {
    return fail('bad-args', `${label} --name and --description are one line each - the \`## Phases\` entry is one line`,
      'put each on ONE line and re-run; longer text belongs in the hand-written `### Phase N:` section. Nothing was written');
  }

  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmap = read(roadmapFile);
  if (roadmap === null) {
    return fail('no-roadmap', `${roadmapFile} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md, or run /cad-new-project to write one; nothing was written');
  }
  if (renderPhasesList(NO_PHASES, roadmap).missing) {
    return fail('no-phases-heading', `${roadmapFile} has no "## Phases" heading to list the phase under`,
      'add a `## Phases` heading to ROADMAP.md, then re-run - the list is generated under it and never invents one;'
      + ' nothing was written');
  }

  // judged against the state under the lock, so two adds of one number can't both land
  // a refusal there empties the view list and hands the state back as it was, which the store writes as no change
  // one holder, so the body's assignments aren't narrowed away from the code after it
  const box = /** @type {{refused: [string, string, string] | null, entry: StatePhase | null, opened: boolean, warnings: string[]}} */ ({ refused: null, entry: null, opened: false, warnings: [] });
  const views = ['STATE.md', 'ROADMAP.md'];
  const done = changeState(dir, (s) => {
    const held = s.phases.find((p) => p.n === n);
    if (sub === 'add' && held) {
      box.refused = ['phase-exists', `phase ${n} is already in the project's phase list as "${held.name}"`,
        `use \`phase-entry edit --phase ${n}\` to change its name or description, or \`renumber insert --at ${n}\` to free`
        + ' the number first; nothing was written'];
    } else if (sub === 'edit' && !held) {
      box.refused = ['unknown-phase', `phase ${n} is not in the project's phase list`,
        `re-run with a phase number the \`## Phases\` list shows, or add it with \`phase-entry add --phase ${n}\`;`
        + ' nothing was written'];
    } else {
      box.entry = held ? { ...held, ...given }
        : { n, name: given.name ?? '', description: given.description ?? '', status: 'unplanned', plans: [] };
      box.refused = unreadable(box.entry);
    }
    if (box.refused || !box.entry) { views.length = 0; return s; }
    const e = box.entry;
    box.opened = !s.cycleOpen;
    const phases = held ? s.phases.map((p) => (p.n === n ? e : p)) : [...s.phases, e].sort((a, b) => a.n - b.n);
    // with nothing else unfinished the new phase IS the work, so the cursor moves here, in the same write as the phase;
    // a paused cursor is the user's bookmark and stays put
    let cursor = s.cursor;
    if (!held && s.phases.every((p) => p.status === 'complete') && s.cursor?.status !== 'paused') {
      // mergeLayers warnings[]: ridden on the envelope; a torn layer reads skip_discuss as unset, so /cad-context
      const { config, warnings } = mergeLayers(join(dir, 'config.json'));
      box.warnings = warnings;
      const next = `${config?.workflow?.skip_discuss === true ? '/cad-plan' : '/cad-context'} ${n}`;
      cursor = { phase: n, status: 'ready to plan', next, updated: new Date().toISOString().slice(0, 10) };
    }
    // the first phase into a closed state opens the cycle; an edit leaves it as it was
    return { ...s, phases, cursor, cycleOpen: held ? s.cycleOpen : true };
  }, views);
  if (!done) return;
  const { refused, entry } = box;
  if (refused) return fail(refused[0], refused[1], refused[2]);
  if (!entry) return fail('internal', 'phase-entry wrote no entry and gave no reason');
  // an upgraded project's trace has no marker, so the add that opens a cycle writes one unless a close just did
  if (sub === 'add' && box.opened && !cycleBoundaryIsNewest(dir)) {
    const marker = appendEvent(dir, { family: 'lifecycle', event: CYCLE });
    if (!marker.written) box.warnings.push(`the cycle boundary was not written to the trace (${marker.reason})`);
  }
  ok({ phase: n, name: entry.name, description: entry.description, ...(sub === 'add' && box.opened ? { opened_cycle: true } : {}),
    ...(box.warnings.length ? { warnings: box.warnings } : {}) });
}

export { cmdPhaseEntry };
