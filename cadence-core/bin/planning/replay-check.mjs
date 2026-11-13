// @ts-check
// planning/replay-check.mjs - `replay-check`: is this phase's work committed, and which plans still need dispatching
// /cad-execute asked this in prose, so the only test cost an executor dispatch; a fixture directory answers it here
// it reports; the stop and its wording stay the workflow's
// it first folds the phase's plan files and each report's first line into the state, under the lock, and answers from the state it wrote
'use strict';

import { join } from 'node:path';
import { fail, phaseGuard, listPlanFiles, ok, read, readPlanReports } from './core.mjs';
import { planName } from '../lib/planning-files.mjs';
import { changeState, foldPhase, loadState } from './state-import.mjs';

function cmdReplayCheck(dir, opts) {
  const parsedPhase = phaseGuard('replay-check', dir, opts.phase, 'replay-check needs --phase <N>',
    'pass --phase <N> naming the phase whose executor reports should be read, then re-run',
    're-run with one of the two spellings the detail names - nothing was read');
  if (!parsedPhase) return;
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans, nonconforming, missing } = listPlanFiles(pdir);
  if (missing) {
    return fail('no-phase-dir', `${pdir} not found`,
      "run /cad-plan <N> first - this check reads the report each of that phase's plans would have written");
  }

  const rerun = opts.rerun === true;
  const state = loadState(dir);
  if (!state) return;
  // the fold is the importer's rule and no other: finished is the report's first line, or the whole phase held complete
  // a phase the state doesn't hold has nothing to fold into, so its reports answer for themselves
  let finished = null;
  if (state.phases.some((p) => p.n === parsedPhase.value)) {
    const folded = changeState(dir, (s) => foldPhase(dir, s, parsedPhase.value), ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md']);
    if (!folded) return;
    finished = new Map(folded.phases.find((p) => p.n === parsedPhase.value).plans.map((q) => [q.file, q.finished]));
  }
  // the report files and their first lines are facts about the files, read here; `complete` is the state's
  // the phases/<raw>/ prefix stays here: it uses the caller's raw spelling, not the String(n) spelling status resolves
  const reports = readPlanReports(pdir, plans).map((r) => {
    // the name feeds /cad-execute's "plan K of J: <plan name>" line, and is left off when the heading yields none
    const name = planName(read(join(pdir, r.plan)) ?? '');
    return { ...r, complete: finished ? finished.get(r.plan) ?? r.complete : r.complete,
      report: join('phases', parsedPhase.raw, r.report), ...(name ? { name } : {}) };
  });

  ok({
    phase: parsedPhase.value,
    rerun,
    // J: every conforming plan file, not the dispatch set, so a resumed run still prints its true position
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
