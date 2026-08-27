// @ts-check
// planning/replay-check.mjs - `replay-check`: has this phase's work already
// been committed, and which plans still need dispatching.
//
// `/cad-execute`'s `locate` step asked this in PROSE, so the only probe was a
// live run reading `.planning/trace.jsonl` afterwards - a test that costs an
// executor dispatch is a test nobody runs. Here a fixture directory answers it.
// It reports; the stop and its wording stay the workflow's.
'use strict';

import { join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, ok, read } from './core.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

/** `PLAN-<k>.md` -> k, bare `PLAN.md` -> 1 - the derivation the executor
 * contract's `<report_file>` states, so this reads the path that gets written. */
const planNumber = (f) => Number(/^PLAN-(\d+)\.md$/.exec(f)?.[1] ?? 1);

/** The FIRST line, trimmed - not the file. A `PLAN COMPLETE` quoted in a Note
 * is prose about a status, not a claim of one, and only line 1 pins the word. */
const firstLine = (body) => (body == null ? null
  : body.slice(0, body.indexOf('\n') === -1 ? undefined : body.indexOf('\n')).trim());

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
  const reports = plans.map((plan) => {
    const k = planNumber(plan);
    // The exact filename, never a `plan-*.md` glob: report-rotation.mjs mints
    // `plan-<k>.<n>.md` siblings, and a glob would let an old one decide.
    const rel = join('reports', `plan-${k}.md`);
    const status = firstLine(read(join(pdir, rel)));
    return { plan, k, report: join('phases', parsedPhase.raw, rel),
      exists: status !== null, status, complete: status === 'PLAN COMPLETE' };
  });

  ok({
    phase: parsedPhase.value,
    rerun,
    reports,
    // EVERY plan, never `some` (D-02): one plan without a complete report is a
    // continuation, not a replay. `plans.length` guards `[].every() === true`,
    // which would report an unplanned phase as a replay.
    replay: !rerun && plans.length > 0 && reports.every((r) => r.complete),
    // Under --rerun, every plan - that is what the override means.
    dispatch_set: rerun ? plans : reports.filter((r) => !r.complete).map((r) => r.plan),
    reports_read: reports.filter((r) => r.exists).map((r) => r.report),
    ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
  });
}

export { cmdReplayCheck };
