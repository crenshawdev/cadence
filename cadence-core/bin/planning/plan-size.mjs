// @ts-check
// planning/plan-size.mjs - `plan-size`: the two size facts a phase carries,
// requirements named and tasks planned, both as counts against integers.
'use strict';

import { join } from 'node:path';
import { fail, listPlanFiles, ok, read } from './core.mjs';
import { phaseRequirements, planTaskTitles } from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';

// The two size facts a phase carries, both COUNTS against integers, because
// both were soft until v2.7.0 and both were ignored. Measured case: a phase
// naming 25 of a project's 46 requirements was planned as 8 tasks against a
// configured ceiling of 4, by a planner told the ceiling and a checker told to
// flag the overrun. Two model-judgment gates missed a comparison a grep makes.
//
// Deliberately ONE subcommand for two questions, because they are asked at the
// same moment and the answer to the first predicts the second: an oversized
// phase is why a plan overruns its task ceiling, so reporting them apart would
// hand the caller two verdicts to reconcile.
//
// `--max-reqs` and `--max-tasks` are the CALLER's resolved values; this seam
// reads no config for them. workflows/plan.md already batches a config read at
// its parse step, so a second reader here would be a second place for the
// resolved ceiling to disagree with the one the planner was handed.
function cmdPlanSize(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'plan-size needs --phase <N>',
      'pass --phase <N> naming the phase whose plans should be sized, then re-run');
  }
  const n = parsedPhase.value;

  // Resolved to plain numbers at the boundary, never carried as the
  // requireInt envelope: a `{ok:false}` arm surviving into the comparisons
  // below is the shape @ts-check refuses, and rightly.
  let maxTasks = null;
  if (opts['max-tasks'] !== undefined) {
    const parsed = requireInt(opts['max-tasks']);
    if (!parsed.ok) {
      return fail('bad-args', '--max-tasks must be an integer',
        'send --max-tasks as a plain integer, or drop it to size without a task ceiling - this seam'
        + ' reads no config, so the value is the one the caller already resolved');
    }
    maxTasks = parsed.value;
  }
  let maxReqs = null;
  if (opts['max-reqs'] !== undefined) {
    const parsed = requireInt(opts['max-reqs']);
    if (!parsed.ok) {
      return fail('bad-args', '--max-reqs must be an integer',
        'send --max-reqs as a plain integer, or drop it to size without a requirement ceiling');
    }
    maxReqs = parsed.value;
  }

  const roadmap = read(join(dir, 'ROADMAP.md')) || '';
  const phase = phaseRequirements(roadmap, parsedPhase.raw);

  // The DIRECTORY is the caller's spelling; only the echoed `phase` is the
  // number (D-02).
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles } = listPlanFiles(pdir);
  const plans = planFiles.map((f) => ({ plan: f, tasks: planTaskTitles(read(join(pdir, f)) || '').length }));
  const tasks = plans.reduce((a, p) => a + p.tasks, 0);

  const over = [];
  // Both ceilings are CONDITIONAL, so a verdict has to say whether anything
  // was compared at all. `compared` names the ceilings that actually ran; an
  // empty one makes `within` null below, because `within: true` beside
  // `requirements_found: false` reported a comparison that never happened.
  const reqsCompared = maxReqs !== null && phase.found;
  const tasksCompared = maxTasks !== null && plans.length > 0;
  const compared = [];
  if (reqsCompared) compared.push('max_reqs');
  if (tasksCompared) compared.push('max_tasks');

  // Absence is not zero (D-05): a roadmap with no detail block for this phase
  // reports found:false and is never compared, because a phase nobody wrote
  // down is not a small one.
  if (reqsCompared && phase.ids.length > maxReqs) {
    over.push({ kind: 'phase-too-big', measured: phase.ids.length, ceiling: maxReqs,
      detail: `phase ${n} names ${phase.ids.length} requirements, ceiling ${maxReqs}` });
  }
  // PER PLAN, not per phase, and the ambiguity was real: the key is named
  // `max_plan_tasks` while workflows/plan.md said "delivering this PHASE needs
  // more than that many tasks". Measured, a tree read it both ways - one phase
  // shipped 8 tasks in one plan, the next shipped 4+4+4 across three. Per-plan
  // is the reading that makes the remedy obvious: a plan over its ceiling
  // splits into more plans inside the same phase, which is a move the phase
  // already supports sequentially.
  //
  // Only once a plan EXISTS. An unwritten plan has zero tasks, and zero is
  // under every ceiling, so comparing before the planner runs would report a
  // clean phase for a plan nobody has written.
  if (tasksCompared) {
    for (const p of plans) {
      if (p.tasks <= maxTasks) continue;
      over.push({ kind: 'plan-too-many-tasks', plan: p.plan, measured: p.tasks,
        ceiling: maxTasks,
        detail: `phase ${n} ${p.plan} carries ${p.tasks} tasks, ceiling ${maxTasks}` });
    }
  }

  ok({
    phase: n,
    requirements: phase.ids.length,
    requirements_found: phase.found,
    ...(phase.ids.length ? { requirement_ids: phase.ids } : {}),
    plans,
    tasks,
    ...(maxReqs !== null ? { max_reqs: maxReqs } : {}),
    ...(maxTasks !== null ? { max_tasks: maxTasks } : {}),
    over,
    compared,
    within: compared.length ? over.length === 0 : null,
  });
}

export { cmdPlanSize };
