// @ts-check
// planning/cite-count.mjs - `cite-count`: what recall surfaced against what the
// produced plan cites (RBK-01).
//
// `CITE_POINTS` is the two-value enum the declared argument row cannot express,
// refused here in this seam's own `bad-args` vocabulary, and nothing else reads
// it - so it travels with the handler under phase 4's D-05 partition.
'use strict';

import { join } from 'node:path';
import { fail, listPlanFiles, memoryBackend, ok, read, readJsonPayload } from './core.mjs';
import { citedMentions } from '../lib/cite-cited.mjs';
import { SURFACED_KINDS, surfacedRows } from '../lib/cite-surfaced.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { appendEvent } from '../lib/trace.mjs';

// ---------------------------------------------------------------------------
// cite-count - the read-back count (RBK-01). The Core Value claims what Cadence
// writes down "comes back on its own at the moment it matters", and until this
// subcommand nothing measured it: a planner could be handed twelve prior
// decisions and cite none of them, and no gate noticed.
//
// It REPORTS and never gates. A plan citing zero of a non-empty surfaced set is
// a number on the record, not a refusal - a threshold needs a legitimate-zero
// rate to be set against, and that rate is what this seam exists to produce.
//
// TWO READERS, ONE JOIN. lib/cite-surfaced.mjs states what the surfaced set is
// (bounded `results`, the queried phase's own rows excluded, one of four kinds,
// an id only where the artifact carries one) and lib/cite-cited.mjs states what
// a citation is (a textual D-NN scan of the whole plan, bare mentions scoped to
// the plan's own phase). Both are pure; this function owns the refusals, the
// disk reads and the envelope, and nothing else.
//
// THE MATCH IS PER ITEM (D-01), never per source. Measured on a reconstructed
// phase-1 plan-time query against the three real PLAN files, the per-item rule
// reads 1 cited of 5 and the per-source rule reads 4 of 5 on the identical plan
// and the identical envelope - because per-source credits every row from a
// source on one mention. The rule IS the metric, so the low honest number is
// the one that can carry a threshold later.
//
// STATED CONSEQUENCE, not a defect to be "fixed": under D-04 (own-phase rows
// excluded) plus D-10 (a bare mention is own-phase) a BARE mention can only
// ever match an ARCHIVED same-numbered phase's decision. That falls out of the
// two rules together, and widening either one to raise the number would be
// widening the metric to flatter the thing it measures.
// ---------------------------------------------------------------------------

/**
 * The two count points D-05 names: once after the planner returns and before
 * the gate, and once on the plan as committed. An ENUM the declared row cannot
 * express, so it is refused here in this file's own `bad-args` vocabulary - the
 * same carve-out `capture --kind must be one of ...` occupies.
 */
const CITE_POINTS = ['planned', 'committed'];

function cmdCiteCount(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'cite-count needs --phase <N>',
      'pass --phase <N> naming the phase whose plans should be counted, then re-run');
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

  // The effective `memory.backend`, through the SAME reader `cmdRecall` gates
  // on - literally the same function, so the two seams cannot come to disagree
  // about whether the backend is off. This repository sets no `memory.backend`
  // and runs the `builtin` default, so its own dogfooding never exercises the
  // off arm: the state has to be CONSTRUCTED to be tested at all (D-06).
  //
  // `none` is a THIRD state on the record, not a spelling of "surfaced
  // nothing". It is what makes three runs separable by their recorded fields
  // alone: `backend: 'none'` is one, a `surfaced.count` of 0 WITHOUT that field
  // is a second, and a non-empty `surfaced` with `cited.count` 0 is a third. No
  // fourth field restates any of it.
  const { backend, warnings } = memoryBackend(dir);
  const off = backend === 'none';

  // On `none` there is no envelope to hand over, because `workflows/plan.md`
  // skips the call that would have produced one, so `--payload` is neither
  // required nor read and the surfaced set is empty by construction.
  // `cmdRecall`'s own `none` arm is the precedent: it ignores the query it was
  // handed and answers `{backend:'none', results:[], total:0}` without looking
  // at the corpus. The envelope SHAPE below is the same on both paths, so a
  // reader of these figures never has to branch on which state produced them.
  //
  // On `builtin` an absent `--payload` is refused rather than fed to stdin, the
  // reason `cmdAdjudication` states in full: `readJsonPayload()` with no
  // argument sits reading a stdin no call site opens.
  if (!off && opts.payload === undefined) {
    return fail('bad-args',
      'cite-count needs --payload <file> - the surfaced set is a FILE, never inline '
      + 'JSON and never stdin',
      "write the recall envelope to a file and pass --payload <path>; with `memory.backend` set to"
      + ' `none` there is no surfaced set and the flag is not needed at all');
  }
  const payload = off ? { ok: true, value: {} } : readJsonPayload(opts.payload);
  if (!payload.ok) return;

  // The DIRECTORY is the caller's spelling; only the echoed `phase` below is
  // the number (D-02). `listPlanFiles` is the SAME reader `plan-overlap` uses,
  // so this seam and that one cannot disagree about what a plan file is.
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

  // A surfaced decision is cited when some mention carries the SAME number AND
  // the same scope phase as that row's own source phase. A row with neither -
  // every capture, deviation and UAT row, and a CONTEXT bullet nobody numbered -
  // can match nothing, which is what the unjoinable arms below report.
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

  // `surfaced.count` is every KINDED row and `surfaced.ids` is only the rows an
  // id exists for, and the gap between the two numbers is the answer rather
  // than a truncation: D-02 says a CAPTURE row and a SUMMARY deviation carry no
  // identifier at all, and synthesizing one from corpus position would break
  // determinism the moment a bullet is added above the row. `cited_by_kind` is
  // what reconciles the headline - the four arms' `surfaced` figures sum to it.
  //
  // The three lists ride the envelope even when EMPTY, against this file's
  // usual compactness rule, because they are the answer and not decoration: AC1
  // asks for an explicit id list rather than a number alone, and an empty
  // `cited.ids` beside `count: 0` is exactly the zero-citation case this seam
  // was built to make visible.
  const surfaced = {
    count: rows.length,
    ids: rows.filter((r) => r.id !== undefined).map((r) => r.id),
  };
  const cited = { count: citedIds.length, ids: citedIds };
  const citedByKind = {
    decision: { surfaced: byKind.decision.surfaced, cited: byKind.decision.cited },
    // UNJOINABLE, never silently zero (D-02): these three arms carry no
    // identifier to join on, so `cited: 0` here would report a plan that
    // ignored them where the truth is that nothing could tell either way.
    capture: { surfaced: byKind.capture.surfaced, unjoinable: true },
    deviation: { surfaced: byKind.deviation.surfaced, unjoinable: true },
    uat: { surfaced: byKind.uat.surfaced, unjoinable: true },
  };

  // Appended BEFORE the envelope is emitted, `cmdRiskCheckRun`'s precedent
  // exactly (D-08). An IN-CODE producer is what keeps the coordinator from
  // retyping a figure onto a flag - the transcription surface this file
  // condemns where `--payload` replaced inline JSON - and it is why the count
  // is not a pure reader with `/cad-plan` issuing a separate `trace append`
  // beside it: two extra invocations, and both figures retyped between them.
  //
  // `outcome` is one of `FAMILIES`, so this lands where `renderTrace` counts.
  // The event carries BOTH figures with their id lists and the per-kind
  // breakdown, so the record answers the same question the envelope does
  // without a reader having to join back to the session that produced it - the
  // legitimate-zero rate is measurable across phases, not only in the run.
  //
  // It opens no bracket and bills no worker, so it carries no `role` and no
  // `tokens`: a token figure is read off a SUBAGENT's return and this seam has
  // no return to read (lib/trace.mjs's TOKEN PROVENANCE).
  //
  // `phase` is the caller's OWN spelling, verbatim, the way a prose
  // `trace append --phase` stores it - `lib/trace.mjs`'s `key()` stringifies
  // both sides, so a record written `2` still joins a bracket written `"2"`.
  //
  // The write may NOT change the verdict, and `appendEvent` never throws and
  // never speaks, so its `{written, reason}` rides the envelope instead. That
  // field is the ONLY place a caller learns the figures were dropped (D-15):
  // `MAX_TRACE_BYTES` is 1,048,576, `appendEvent` stats before it writes, and
  // `.planning/trace.jsonl` held 1,762 events in 419,756 B on 2026-08-23 -
  // unpruned and gitignored, so `size-cap` is a stated failure mode rather
  // than a silent one.
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
    // Present ONLY on the off path, mirroring `cmdRecall`, which omits the
    // field on every other arm. Its absence is what says the count ran against
    // a live backend, so an omitted field is load-bearing here.
    ...(off ? { backend: 'none' } : {}),
    plans: planFiles,
    surfaced,
    cited,
    cited_by_kind: citedByKind,
    // Present on EVERY path, `reason` only where the append failed. A trace
    // that could not be written leaves every figure above byte-identical.
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
    // A payload row this reader could not place. Reported rather than binned:
    // a row counted in `surfaced` and in no arm would make the breakdown stop
    // reconciling with the headline, and a row dropped in silence would make an
    // unreadable payload look like a small one.
    ...(unkinded.length ? { unkinded } : {}),
    ...(malformed ? { malformed } : {}),
    // A TORN config layer reads `memory.backend` as absent, which defaults to
    // `builtin` - so a project that deliberately set `none` would be counted as
    // a live backend and the third state would silently disappear from the
    // record. Present only when non-empty, so the ordinary byte-stable output
    // is unchanged (AC6).
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdCiteCount };
