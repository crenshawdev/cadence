// @ts-check
// planning/cursor-set.mjs - `cursor set`: the write face for .planning/STATE.md.
// every field is validated before anything renders, and the cursor holds the numeric phase on purpose (renumber, status and cursorPhase all read it), so a raw spelling is refused here and not stored.
'use strict';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingRefusal, planPosition, read } from './core.mjs';
import {
  CLOSED_CYCLE_NAME, CURSOR_STATUSES, atomicWrite, classifyPhaseList, parseCursor,
  renderCursor,
} from '../lib/planning-files.mjs';
import { requireCursorNumber, requirePhaseArg } from '../lib/require-int.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';

function cmdCursorSet(dir, opts) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  if (!opts.phase) {
    return fail('bad-args', 'cursor set needs --phase <N>',
      'pass --phase <N> for the phase this cursor points at, then re-run');
  }
  // the cursor keeps the numeric phase (renumber, status and cursorPhase read it), so a 1.10 spelling would render as 1.1 with the other phase's name; that's refused instead
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
  // --next-file carries a resume pointer the caller composed (/cad-pause and progress build theirs from agent-derived text); literal /cad-<command> N sites keep the inline form
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
  // the one refusal the inline form never needed: a wrapped Next: line can't be read back by parseCursor, so the next cursor get would say unparseable-cursor; refused, not flattened, so nothing is written
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

  // name/total: explicit flag > ROADMAP derivation > existing cursor > fail.
  let name = opts.name;
  let total;
  if ('total' in opts) {
    const parsed = requireCursorNumber(opts.total);
    if (!parsed.ok) {
      return fail('bad-args', 'cursor set --total needs a non-negative integer',
        'send --total as the number of phases in this milestone, or drop the flag and let'
        + " ROADMAP.md's phase list supply the count");
    }
    total = parsed.value;
  }
  if (name === undefined || total === undefined) {
    // closed fills no active cycle and 0 so this succeeds on a pruned roadmap; out-of-grammar and no-section keep the old behavior, since writing `of 0` there would erase a live cycle's total
    const { state, phases } = classifyPhaseList(read(join(dir, 'ROADMAP.md')) || '');
    const entry = phases.find((p) => p.n === phase);
    if (name === undefined && entry) name = entry.name;
    if (total === undefined && phases.length) total = phases.length;
    if (state === 'closed') {
      // before the prior-cursor fallback on purpose: a stale total would write `Phase: 1 of 5` against a zero-phase roadmap
      // paused is the exception, it's a hold: deriving 0 would erase the stale `of <M>` that status treats as the only evidence an unfinished close left behind
      const prior = opts.status === 'paused'
        ? parseCursor(read(join(dir, 'STATE.md')) || '') : null;
      if (prior && prior.total && prior.phase === phase) {
        if (name === undefined) name = prior.name;
        if (total === undefined) total = prior.total;
      }
      if (name === undefined) name = CLOSED_CYCLE_NAME;
      if (total === undefined) total = 0;
    }
  }
  if (name === undefined || total === undefined) {
    const prior = parseCursor(read(join(dir, 'STATE.md')) || '');
    if (prior) {
      if (name === undefined && prior.phase === phase) name = prior.name;
      if (total === undefined) total = prior.total;
    }
  }
  if (name === undefined || total === undefined) {
    return fail('cannot-derive', 'phase name/total not in flags, ROADMAP.md, or the existing cursor',
      'pass --name and --total explicitly, or add this phase to the `## Phases` list in ROADMAP.md'
      + ' so both can be derived from it');
  }

  // the plan line is derived from disk on every write: the lowest-numbered plan not `PLAN COMPLETE`, absent with no plans or all complete; the dir is the canonical spelling
  const plan = planPosition(join(dir, 'phases', String(opts.phase)));
  const cursor = {
    phase, total, name, status: opts.status, next,
    updated: new Date().toISOString().slice(0, 10),
    ...(plan ? { plan } : {}),
  };
  atomicWrite(join(dir, 'STATE.md'), renderCursor(cursor));
  ok({ cursor });
}

export { cmdCursorSet };
