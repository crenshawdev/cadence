// @ts-check
// planning/cursor-set.mjs - `cursor set`: the write face for the cursor in the state file; STATE.md is rendered from it.
// every field is validated before anything renders
// until the phase list moves into the state (task 2 of plan 7), ROADMAP.md still says which phases exist, so a write
// that can read it folds the list and whether a cycle is open into the state beside the cursor
// the cursor holds the numeric phase (renumber, status, cursorPhase read it), so a raw spelling is refused, not stored
'use strict';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingRefusal, planPosition } from './core.mjs';
import { CLOSED_CYCLE_NAME, CURSOR_STATUSES } from '../lib/planning-files.mjs';
import { changeState, foldPhase, loadState } from './state-import.mjs';
import { requireCursorNumber, requirePhaseArg } from '../lib/require-int.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';

function cmdCursorSet(dir, opts) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  if (!opts.phase) {
    return fail('bad-args', 'cursor set needs --phase <N>',
      'pass --phase <N> for the phase this cursor points at, then re-run');
  }
  // the cursor keeps the numeric phase, so 1.10 would render as 1.1 with the other phase's name; refuse it
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'cursor set --phase needs a non-negative phase number (N or N.M)',
      'send a plain phase number - 3, or 3.1 for a phase inserted between two others - then re-run');
  }
  const spelling = phaseSpellingRefusal(parsedPhase);
  if (spelling) {
    return fail('bad-args', `cursor set ${spelling}`,
      'take one of the two fixes the detail names - retype the flag, or rename the directory - then'
      + ' re-run; the cursor stores the phase NUMBER, so only a spelling that survives that round'
      + ' trip can be written');
  }
  const phase = parsedPhase.value;
  // --next-file carries a pointer the caller composed (/cad-pause and progress build theirs from agent text)
  const resolvedNext = resolveTextFlag(opts, 'next', 'cursor set');
  if (!resolvedNext.ok) {
    return fail('bad-args', resolvedNext.detail,
      'pass --next or --next-file, never both, and point --next-file at a readable, non-empty file,'
      + ' then re-run');
  }
  const next = resolvedNext.value !== undefined ? resolvedNext.value : opts.next;
  if (!opts.status || !next) {
    return fail('bad-args', 'cursor set needs --status and --next',
      `pass both: --status <one of ${CURSOR_STATUSES.join(' | ')}> and --next "<the command to run`
      + ' next>", then re-run');
  }
  // a wrapped Next: line can't be read back by parseCursor; refuse it rather than flatten it
  if (typeof next === 'string' && /[\r\n]/.test(next)) {
    return fail('bad-args',
      'cursor set --next cannot contain a newline - the cursor is four required lines plus an optional `Plan:` line',
      'put the resume pointer on ONE line and re-run; a wrapped one adds a line the next'
      + ' `cursor get` cannot read back');
  }
  if (!CURSOR_STATUSES.includes(opts.status)) {
    return fail('bad-status', `"${opts.status}" is not in the lifecycle: ${CURSOR_STATUSES.join(' | ')}`,
      'send one of the statuses the detail lists, spelled exactly as it appears there - the words'
      + ' are the lifecycle, not free text');
  }

  // name/total: explicit flag > the state's phase list > fail. No phases at all is a closed cycle: no name and a total of 0
  let name = opts.name;
  let total;
  if ('total' in opts) {
    const parsed = requireCursorNumber(opts.total);
    if (!parsed.ok) {
      return fail('bad-args', 'cursor set --total needs a non-negative integer',
        'send --total as the number of phases in this milestone, or drop the flag and let'
        + " the project's phase list supply the count");
    }
    total = parsed.value;
  }
  const state = loadState(dir);
  if (!state) return;
  if (name === undefined || total === undefined) {
    const entry = state.phases.find((p) => p.n === phase);
    if (name === undefined && entry) name = entry.name;
    if (total === undefined && state.phases.length) total = state.phases.length;
    if (!state.phases.length) {
      if (name === undefined) name = CLOSED_CYCLE_NAME;
      if (total === undefined) total = 0;
    }
  }
  if (name === undefined || total === undefined) {
    return fail('cannot-derive', 'phase name/total not in flags or the project\'s phase list',
      'pass --name and --total explicitly, or add this phase to the project\'s phase list'
      + ' so both can be derived from it');
  }

  // the plan line is derived from disk on every write: the lowest plan not `PLAN COMPLETE`, absent if none or all done
  const plan = planPosition(join(dir, 'phases', String(opts.phase)));
  const cursor = {
    phase, total, name, status: opts.status, next,
    updated: new Date().toISOString().slice(0, 10),
    ...(plan ? { plan } : {}),
  };
  const stored = {
    phase, status: opts.status, next, updated: cursor.updated, ...(plan ? { plan } : {}),
  };
  const done = changeState(dir, (s) => ({ ...foldPhase(dir, s, phase), cursor: stored }), ['STATE.md', 'ROADMAP.md']);
  if (!done) return;
  ok({ cursor });
}

export { cmdCursorSet };
