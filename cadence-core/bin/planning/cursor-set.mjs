// @ts-check
// planning/cursor-set.mjs - `cursor set`: the write face for .planning/STATE.md.
//
// Every field is validated before anything is rendered, and the cursor holds the
// NUMERIC phase on purpose - `renumber`'s shift arithmetic, `status`'s
// agreement test and phase-plans.mjs' `cursorPhase` all consume the number, so
// the raw spelling a caller passed is refused here rather than stored (see
// `phaseSpellingRefusal` in planning/core.mjs) instead of being written through.
'use strict';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingRefusal, read } from './core.mjs';
import {
  CLOSED_CYCLE_NAME, CURSOR_STATUSES, atomicWrite, classifyPhaseList, parseCursor,
  renderCursor
} from '../lib/planning-files.mjs';
import { requireCursorNumber, requirePhaseArg } from '../lib/require-int.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';

function cmdCursorSet(dir, opts) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  if (!opts.phase) {
    return fail('bad-args', 'cursor set needs --phase <N>',
      'pass --phase <N> for the phase this cursor points at, then re-run');
  }
  // The shared reader, for the refusal WORDING - and the cursor keeps holding
  // the numeric value on purpose. `parseCursor` returns a Number that
  // `renumber`'s shift arithmetic, `cmdStatus`'s `parsed.phase === current`
  // agreement test and `phase-plans.mjs`' `cursorPhase` all consume, so a
  // raw-spelled cursor is a wider change than the `--phase` directory fix, and
  // a half-raw cursor would be worse than a numeric one. What used to be the
  // stated cost of that - a cursor set at `--phase 1.10` rendering
  // `Phase: 1.1`, the OTHER phase's name - is REFUSED at the door now (D-07)
  // rather than carried. The raw spelling still addresses `phases/<raw>/` at
  // the reads in this file that are not these two write faces.
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
  // `--next-file` is the path transport for a resume pointer the CALLER
  // composed - /cad-pause and `progress` build theirs from what the run was
  // doing, which is agent-derived text in a double-quoted shell word
  // (lib/text-flag-file.mjs, references/conventions.md). The seven sites that
  // pass a literal `/cad-<command> N` keep the inline form; nothing is deleted.
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
  // ONE refusal the inline form never needed: `renderCursor` writes `next` into
  // the cursor's `Next:` line unflattened, and references/conventions.md states
  // the cursor is always exactly four lines - a wrapped resume pointer would
  // produce a fifth line `parseCursor` cannot read back, so the very next
  // `cursor get` would answer `unparseable-cursor`. A file is the transport
  // that can carry a newline, so this is where the structural term belongs. It
  // REFUSES rather than flattening, mirroring `milestone-prune --label`'s table
  // term: a malformed value is a malformed CALL and nothing is written.
  if (typeof next === 'string' && /[\r\n]/.test(next)) {
    return fail('bad-args',
      'cursor set --next cannot contain a newline - the cursor is exactly four lines',
      'put the resume pointer on ONE line and re-run; a wrapped one writes a fifth line the next'
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
    // The same phase-list grammar `status` reads (references/roadmap-phases.md).
    // `closed` fills `no active cycle` / 0, so the seam succeeds against a
    // pruned roadmap BY CONSTRUCTION and /cad-milestone step 6 runs on the tree
    // its own step 3 produces. `out-of-grammar` and `no-section` deliberately
    // keep today's behavior - a roadmap holding unrecognized phase-shaped lines
    // is broken, not closed, and writing `of 0` there would erase a live
    // cycle's total.
    const { state, phases } = classifyPhaseList(read(join(dir, 'ROADMAP.md')) || '');
    const entry = phases.find((p) => p.n === phase);
    if (name === undefined && entry) name = entry.name;
    if (total === undefined && phases.length) total = phases.length;
    if (state === 'closed') {
      // Before the prior-cursor fallback below on purpose: inheriting a stale
      // total writes `Phase: 1 of 5` against a zero-phase roadmap, which reads
      // as an `of M` mismatch to /cad-health.
      //
      // `paused` is the one exception, and it is a hold rather than a
      // transition: /cad-pause calls this flaglessly, so deriving 0 here would
      // erase the stale `of <M>` that cmdStatus treats as the ONLY surviving
      // evidence of an unfinished close (a tagged close deletes `phases/<N>/`,
      // so the phase-dir drift cannot see it either). Pausing must not destroy
      // the signal that says the close never finished.
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

  const cursor = {
    phase, total, name, status: opts.status, next,
    updated: new Date().toISOString().slice(0, 10),
  };
  atomicWrite(join(dir, 'STATE.md'), renderCursor(cursor));
  ok({ cursor });
}

export { cmdCursorSet };
