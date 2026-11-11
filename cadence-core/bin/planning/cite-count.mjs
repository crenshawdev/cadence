// @ts-check
// planning/cite-count.mjs - `cite-count`: what recall surfaced against what the produced plan cites
// CITE_POINTS is an enum the declared row can't express, so it's refused here in `bad-args` vocabulary
'use strict';

import { join } from 'node:path';
import { fail, phaseGuard, listPlanFiles, memoryBackend, ok, read, readJsonPayload } from './core.mjs';
import { citedMentions } from '../lib/cite-cited.mjs';
import { SURFACED_KINDS, surfacedRows } from '../lib/cite-surfaced.mjs';
import { appendEvent } from '../lib/trace.mjs';

// it reports and never gates: a threshold needs a legitimate-zero rate to set against, which this produces
// lib/cite-surfaced.mjs says what the surfaced set is, lib/cite-cited.mjs what a citation is; this owns the rest
// the match is per item, not per source, or one mention would credit every row from that source
// a bare mention only matches an archived same-numbered phase's decision; widening either rule would flatter the number

/**
 * The two moments a count is taken: after the planner returns and before the gate, and on the plan as committed.
 * An enum the declared row can't express, so it's refused here in `bad-args` vocabulary, like `capture --kind`.
 */
const CITE_POINTS = ['planned', 'committed'];

function cmdCiteCount(dir, opts) {
  // the collision check goes first and refuses only if the normalized spelling names a directory that exists here
  const parsedPhase = phaseGuard('cite-count', dir, opts.phase, 'cite-count needs --phase <N>',
    'pass --phase <N> naming the phase whose plans should be counted, then re-run',
    're-run with one of the two spellings the detail names - nothing was read');
  if (!parsedPhase) return;
  const n = parsedPhase.value;

  if (opts.point !== undefined) {
    if (typeof opts.point !== 'string' || !CITE_POINTS.includes(opts.point)) {
      return fail('bad-args', `cite-count --point must be one of ${CITE_POINTS.join(' | ')}`,
        'send one of the two points the detail lists, naming which moment in /cad-plan this count'
        + ' was taken at, or drop --point');
    }
  }
  const point = typeof opts.point === 'string' ? opts.point : undefined;

  // memory.backend comes through the same reader cmdRecall gates on, so the two seams can't disagree about it being off
  // `none` is its own state on the record, not "surfaced nothing"; this repo never runs it, so tests construct it
  const { backend, warnings } = memoryBackend(dir);
  const off = backend === 'none';

  // on `none` there's no envelope (workflows/plan.md skips the call), so --payload is neither required nor read
  // on `builtin` an absent --payload is refused, not fed to stdin, as in cmdAdjudication
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

  // a surfaced decision is cited when a mention has the same number and scope phase as the row's source phase
  // a row with neither (captures, deviations, UAT rows) can match nothing, which the unjoinable arms report
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

  // surfaced.count is every kinded row and surfaced.ids only those with an id: the gap is the answer, not a truncation
  // lists ride the envelope even when empty: an empty cited.ids beside count: 0 is the case this seam exists to show
  const surfaced = {
    count: rows.length,
    ids: rows.filter((r) => r.id !== undefined).map((r) => r.id),
  };
  const cited = { count: citedIds.length, ids: citedIds };
  const citedByKind = {
    decision: { surfaced: byKind.decision.surfaced, cited: byKind.decision.cited },
    // unjoinable, never silently zero: these arms have no id to join on, so `cited: 0` would claim a plan ignored them
    capture: { surfaced: byKind.capture.surfaced, unjoinable: true },
    deviation: { surfaced: byKind.deviation.surfaced, unjoinable: true },
    uat: { surfaced: byKind.uat.surfaced, unjoinable: true },
  };

  // appended before the envelope is emitted, like cmdRiskCheckRun; in-code so the coordinator doesn't retype figures
  // `outcome` is one of FAMILIES, so this lands where renderTrace counts; no role or tokens, nothing bills a worker
  // phase is the caller's own spelling, as `trace append --phase` stores it: key() stringifies both sides
  // appendEvent never throws, so its {written, reason} rides the envelope: that's how a caller learns of a drop
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
    // present only on the off path, like cmdRecall: its absence says the count ran against a live backend
    ...(off ? { backend: 'none' } : {}),
    plans: planFiles,
    surfaced,
    cited,
    cited_by_kind: citedByKind,
    // present on every path, reason only where the append failed; the figures above are the same either way
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
    // a payload row we couldn't place is reported, not binned: in surfaced and no arm, it breaks the breakdown
    ...(unkinded.length ? { unkinded } : {}),
    ...(malformed ? { malformed } : {}),
    // a torn config layer reads memory.backend as absent (builtin), so a project that set `none` would look live
    // present only when non-empty, so ordinary output stays byte-stable
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdCiteCount };
