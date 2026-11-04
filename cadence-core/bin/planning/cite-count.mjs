// @ts-check
// planning/cite-count.mjs - `cite-count`: what recall surfaced against what the produced plan cites
// CITE_POINTS is an enum the declared argument row can't express, so it's refused here in this seam's own bad-args vocabulary, and nothing else reads it
'use strict';

import { join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, memoryBackend, ok, read, readJsonPayload } from './core.mjs';
import { citedMentions } from '../lib/cite-cited.mjs';
import { SURFACED_KINDS, surfacedRows } from '../lib/cite-surfaced.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { appendEvent } from '../lib/trace.mjs';

// the Core Value says what Cadence writes down comes back on its own when it matters, and nothing measured that: a planner could be handed twelve prior decisions and cite none, and no gate noticed
// it reports and never gates: a plan citing zero of a non-empty surfaced set is a number on the record, and a threshold needs a legitimate-zero rate to set against, which this seam exists to produce
// lib/cite-surfaced.mjs says what the surfaced set is and lib/cite-cited.mjs says what a citation is; both are pure, and this function owns the refusals, the disk reads and the envelope
// the match is per item and not per source, because per-source would credit every row from a source on one mention. The low honest number is the one that can carry a threshold later
// a bare mention can only match an archived same-numbered phase's decision, since own-phase rows are excluded and a bare mention is own-phase. That's intended: widening either rule to raise the number would flatter the thing it measures

/**
 * The two moments a count is taken: after the planner returns and before the gate, and on the plan as committed.
 * An enum the declared row can't express, so it's refused here in this file's own `bad-args` vocabulary, like `capture --kind`.
 */
const CITE_POINTS = ['planned', 'committed'];

function cmdCiteCount(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'cite-count needs --phase <N>',
      'pass --phase <N> naming the phase whose plans should be counted, then re-run');
  }
  // the tree-aware collision check goes before any read of the phase directory, since a flag is validated ahead of the work it names
  // it refuses only when the normalized spelling names a directory that exists here, so phases/1.10/ stays addressable on a tree with no phases/1.1/
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `cite-count ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const n = parsedPhase.value;

  if (opts.point !== undefined) {
    if (typeof opts.point !== 'string' || !CITE_POINTS.includes(opts.point)) {
      return fail('bad-args', `cite-count --point must be one of ${CITE_POINTS.join(' | ')}`,
        'send one of the two points the detail lists, naming which moment in /cad-plan this count'
        + ' was taken at, or drop --point');
    }
  }
  const point = typeof opts.point === 'string' ? opts.point : undefined;

  // memory.backend comes through the same reader cmdRecall gates on, so the two seams can't disagree about whether the backend is off
  // this repo runs the builtin default and never exercises the off arm, so that state has to be constructed to be tested
  // `none` is a third state on the record and not a spelling of "surfaced nothing": backend 'none', a surfaced.count of 0 without it, and a non-empty surfaced with cited.count 0 are three runs you can tell apart from recorded fields alone
  const { backend, warnings } = memoryBackend(dir);
  const off = backend === 'none';

  // on `none` there's no envelope, because workflows/plan.md skips the call that would make one, so --payload is neither required nor read and the surfaced set is empty by construction
  // the envelope shape is the same on both paths, so a reader never has to branch on which state produced it
  // on `builtin` an absent --payload is refused and not fed to stdin, for the reason cmdAdjudication gives: readJsonPayload with no argument sits reading a stdin no call site opens
  if (!off && opts.payload === undefined) {
    return fail('bad-args',
      'cite-count needs --payload <file> - the surfaced set is a FILE, never inline '
      + 'JSON and never stdin',
      "write the recall envelope to a file and pass --payload <path>; with `memory.backend` set to"
      + ' `none` there is no surfaced set and the flag is not needed at all');
  }
  const payload = off ? { ok: true, value: {} } : readJsonPayload(opts.payload);
  if (!payload.ok) return;

  // the directory is the caller's spelling and only the echoed phase below is the number
  // listPlanFiles is the reader plan-overlap uses, so the two seams can't disagree about what a plan file is
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles, missing } = listPlanFiles(pdir);
  if (missing) {
    return fail('no-phase-dir', `${pdir} not found`,
      'run /cad-plan <N> first - this counts citations in the PLAN files that directory holds, so'
      + ' there is nothing to count until they exist');
  }

  const { rows, unkinded, malformed } = surfacedRows(payload.value, parsedPhase.raw);
  const mentions = [];
  for (const f of planFiles) {
    mentions.push(...citedMentions(read(join(pdir, f)) || '', parsedPhase.raw));
  }

  // a surfaced decision is cited when some mention has the same number and the same scope phase as the row's source phase
  // a row with neither (captures, deviations, UAT rows, an unnumbered CONTEXT bullet) can match nothing, which the unjoinable arms below report
  const isCited = (row) => row.kind === 'decision'
    && row.number !== undefined && row.phase !== undefined
    && mentions.some((m) => m.number === row.number && m.phase === row.phase);

  const byKind = {};
  for (const k of SURFACED_KINDS) byKind[k] = { surfaced: 0, cited: 0 };
  const citedIds = [];
  for (const row of rows) {
    byKind[row.kind].surfaced += 1;
    if (!isCited(row)) continue;
    byKind[row.kind].cited += 1;
    citedIds.push(row.id);
  }

  // surfaced.count is every kinded row and surfaced.ids only the rows an id exists for, and the gap is the answer and not a truncation
  // captures and deviations carry no identifier, and inventing one from corpus position would break determinism the moment a bullet is added above it. cited_by_kind is what reconciles the headline
  // the lists ride the envelope even when empty, against this file's usual compactness: an empty cited.ids beside count: 0 is exactly the zero-citation case this seam exists to make visible
  const surfaced = {
    count: rows.length,
    ids: rows.filter((r) => r.id !== undefined).map((r) => r.id),
  };
  const cited = { count: citedIds.length, ids: citedIds };
  const citedByKind = {
    decision: { surfaced: byKind.decision.surfaced, cited: byKind.decision.cited },
    // unjoinable and never silently zero: these arms carry no identifier to join on, so `cited: 0` would report a plan that ignored them when nothing could tell either way
    capture: { surfaced: byKind.capture.surfaced, unjoinable: true },
    deviation: { surfaced: byKind.deviation.surfaced, unjoinable: true },
    uat: { surfaced: byKind.uat.surfaced, unjoinable: true },
  };

  // appended before the envelope is emitted, like cmdRiskCheckRun
  // an in-code producer keeps the coordinator from retyping a figure onto a flag, and a pure reader with a separate trace append would be two extra invocations with both figures retyped between them
  // `outcome` is one of FAMILIES, so this lands where renderTrace counts. The event carries both figures with their id lists and the per-kind breakdown, so the zero rate is measurable across phases and not only in the run
  // no role and no tokens: this opens no bracket and bills no worker, and token counts come off a subagent return this seam doesn't have
  // phase is the caller's own spelling, like a prose `trace append --phase` stores it: key() stringifies both sides, so 2 still joins "2"
  // appendEvent never throws and never speaks, so its {written, reason} rides the envelope, and that's the only place a caller learns the figures were dropped
  // a full record isn't one of those ways anymore: at MAX_TRACE_BYTES it rotates and the append lands, so what's left is a symlinked trace, a stat or append failure, and a single event past the bound
  const res = appendEvent(dir, {
    phase: parsedPhase.raw,
    family: 'outcome',
    event: 'cite_count',
    ...(point ? { point } : {}),
    ...(off ? { backend: 'none' } : {}),
    surfaced,
    cited,
    cited_by_kind: citedByKind,
  });

  ok({
    phase: n,
    ...(point ? { point } : {}),
    // present only on the off path, like cmdRecall, which omits it everywhere else: its absence is what says the count ran against a live backend
    ...(off ? { backend: 'none' } : {}),
    plans: planFiles,
    surfaced,
    cited,
    cited_by_kind: citedByKind,
    // present on every path, reason only where the append failed; a trace that couldn't be written leaves every figure above byte-identical
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
    // a payload row this reader couldn't place is reported and not binned: counted in surfaced and in no arm, it would stop the breakdown reconciling with the headline, and dropped silently it would make an unreadable payload look small
    ...(unkinded.length ? { unkinded } : {}),
    ...(malformed ? { malformed } : {}),
    // a torn config layer reads memory.backend as absent, which defaults to builtin, so a project that set `none` would be counted as live and the third state would vanish from the record
    // present only when non-empty, so ordinary output stays byte-stable
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdCiteCount };
