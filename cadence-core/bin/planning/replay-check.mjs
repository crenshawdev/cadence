// @ts-check
// planning/replay-check.mjs - `replay-check`: has this phase's work already been committed, and which plans still need dispatching
// /cad-execute's locate step asked this in prose, so the only probe was a live run reading trace.jsonl afterwards, and a test that costs an executor dispatch is one nobody runs. A fixture directory answers it here
// it reports; the stop and its wording stay the workflow's
'use strict';

import { join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, ok, read, readPlanReports } from './core.mjs';
import { planName } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

function cmdReplayCheck(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'replay-check needs --phase <N>',
      'pass --phase <N> naming the phase whose executor reports should be read, then re-run');
  }
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `replay-check ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans, nonconforming, missing } = listPlanFiles(pdir);
  if (missing) {
    return fail('no-phase-dir', `${pdir} not found`,
      "run /cad-plan <N> first - this check reads the report each of that phase's plans would have written");
  }

  const rerun = opts.rerun === true;
  // readPlanReports is the one definition status reads too, so the dispatch set and the outstanding set can't disagree about the same phase
  // the phases/<raw>/ prefix stays here: it's built from the caller's raw spelling and not the String(n) spelling status resolves, so moving it into the shared reader would make one of the two envelopes wrong
  const reports = readPlanReports(pdir, plans).map((r) => {
    // the name is what /cad-execute prints for its "plan K of J: <plan name>" line, and it's left off when the heading yields none
    const name = planName(read(join(pdir, r.plan)) ?? '');
    return { ...r, report: join('phases', parsedPhase.raw, r.report), ...(name ? { name } : {}) };
  });

  ok({
    phase: parsedPhase.value,
    rerun,
    // J: every conforming plan file and not the dispatch set, so a resumed run still prints its true position out of the total
    plan_count: plans.length,
    reports,
    // every plan and never some: one plan without a complete report is a continuation and not a replay
    // plans.length guards `[].every() === true`, which would report an unplanned phase as a replay
    replay: !rerun && plans.length > 0 && reports.every((r) => r.complete),
    // under --rerun it's every plan, which is what the override means
    dispatch_set: rerun ? plans : reports.filter((r) => !r.complete).map((r) => r.plan),
    reports_read: reports.filter((r) => r.exists).map((r) => r.report),
    ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
  });
}

export { cmdReplayCheck };
