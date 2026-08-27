// @ts-check
// planning/plan-size.mjs - `plan-size`: the size facts a phase carries -
// requirements named, tasks planned, and the BYTES each plan's `files:`
// frontmatter declares - each as a number against an integer ceiling.
'use strict';

import { lstatSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, ok, read } from './core.mjs';
import { phaseRequirements, planTaskTitles, readFrontmatterList } from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';

/**
 * The BYTES one plan's `files:` frontmatter declares, and how many of those
 * declared paths contributed none (D-10). The two travel together because the
 * total alone is unreadable: a creation-heavy plan declaring ten files that do
 * not exist yet sums to nearly nothing and would read as comfortably under any
 * ceiling while measuring something much smaller than what it declared. 12 of
 * this repository's 43 archived plans declare at least one absent path.
 *
 * The FRONTMATTER list only, never `parsePlanFiles`'s union with the
 * `- **Files:**` task lines - the same choice `lib/phase-plans.mjs` makes and
 * for the same reason: the union would measure a file no frontmatter declared,
 * so the number would answer for incidental task prose rather than for the
 * curated declaration the executor is actually handed.
 *
 * Out of grammar is NULL, never 0, on `readOnePlan`'s no-salvage rule: a
 * half-parsed `files:` list is an unresolvable input and not a shorter one, and
 * a 0 here would state that the plan declares nothing - absence of evidence
 * reported as absence of surface, the shape the v3.5.7 phase 3 UAT refuted.
 * The caller reads null as "not comparable" rather than as "small".
 *
 * Every path is sized with `lstatSync` and counted only when `isFile()`, which
 * is `route.mjs`'s `declaredBodies` guard: a path the plan has yet to create, a
 * directory, and a symlink to a device or FIFO each contribute zero bytes and
 * increment `absent`, because each makes the total measure less than what was
 * declared. A path that is ABSOLUTE or carries a `..` segment is refused by
 * SPELLING and never stat'd at all - a resolve is not a place to walk out of
 * the repository - and lands on the same count.
 * @param {string} repoRoot @param {string} text
 * @returns {{bytes: number|null, absent: number|null}}
 */
function declaredBytes(repoRoot, text) {
  const { items, issues } = readFrontmatterList(text, 'files');
  if (issues && issues.length) return { bytes: null, absent: null };
  let bytes = 0;
  let absent = 0;
  // `readOnePlan`'s filter, verbatim: a declared path is a non-empty string.
  for (const rel of items.filter((f) => typeof f === 'string' && f)) {
    if (isAbsolute(rel) || rel.split('/').includes('..')) {
      absent += 1;
      continue;
    }
    let st;
    try {
      st = lstatSync(join(repoRoot, rel));
    } catch {
      absent += 1;
      continue;
    }
    if (!st.isFile()) {
      absent += 1;
      continue;
    }
    bytes += st.size;
  }
  return { bytes, absent };
}

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
// `--max-reqs`, `--max-tasks` and `--max-bytes` are the CALLER's resolved
// values; this seam
// reads no config for them (D-08). workflows/plan.md already batches a config read at
// its parse step, so a second reader here would be a second place for the
// resolved ceiling to disagree with the one the planner was handed.
function cmdPlanSize(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'plan-size needs --phase <N>',
      'pass --phase <N> naming the phase whose plans should be sized, then re-run');
  }
  // The tree-aware collision check, before ANY read of the phase directory -
  // the #42/#45 rail this file already holds, that a flag is validated ahead of
  // the work it names. It refuses only when the normalized spelling names a
  // directory that exists here, so `phases/1.10/` stays addressable on a tree
  // that has no `phases/1.1/`.
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `plan-size ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
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
  let maxBytes = null;
  if (opts['max-bytes'] !== undefined) {
    const parsed = requireInt(opts['max-bytes']);
    if (!parsed.ok) {
      return fail('bad-args', '--max-bytes must be an integer',
        'send --max-bytes as a plain integer number of bytes, or drop it to size without a byte'
        + ' ceiling - this seam reads no config, so the value is the one the caller already'
        + ' resolved');
    }
    maxBytes = parsed.value;
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
  // Declared paths are repo-relative and the repo root is the planning root's
  // PARENT - the derivation `route.mjs`'s `replay` states for its own
  // `repoRoot`, so the two faces resolve a declared path identically.
  const repoRoot = dirname(dir);
  // ONE read per plan, feeding both facts: `planTaskTitles` and the byte
  // measurement below take the SAME text, so adding a second question about a
  // plan did not add a second pass over it.
  const plans = planFiles.map((f) => {
    const text = read(join(pdir, f)) || '';
    const { bytes, absent } = declaredBytes(repoRoot, text);
    return { plan: f, tasks: planTaskTitles(text).length, bytes, absent };
  });
  const tasks = plans.reduce((a, p) => a + p.tasks, 0);

  const over = [];
  // Both ceilings are CONDITIONAL, so a verdict has to say whether anything
  // was compared at all. `compared` names the ceilings that actually ran; an
  // empty one makes `within` null below, because `within: true` beside
  // `requirements_found: false` reported a comparison that never happened.
  const reqsCompared = maxReqs !== null && phase.found;
  const tasksCompared = maxTasks !== null && plans.length > 0;
  // A plan whose `files:` list is out of grammar carries a null byte figure and
  // is not compared - the rule the `requirements_found: false` arm above already
  // follows, that something nobody could read is not a small one. So the ceiling
  // reaches `compared` only when at least one plan actually had a figure to
  // compare, which is what keeps `within: true` meaning "every comparison that
  // ran came back clean" rather than "nothing was looked at".
  const bytesCompared = maxBytes !== null && plans.some((p) => p.bytes !== null);
  const compared = [];
  if (reqsCompared) compared.push('max_reqs');
  if (tasksCompared) compared.push('max_tasks');
  if (bytesCompared) compared.push('max_bytes');

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
  // PER PLAN for the same reason the task ceiling is, and with the same remedy:
  // the declared paths are what ONE executor dispatch is handed, so a plan over
  // the ceiling splits into more plans rather than shrinking in place. Reported
  // and never refused (D-09) - this is one more `over[]` entry beside
  // `plan-too-many-tasks` at the same `check_size` step, not a new seam and not
  // a new gate.
  if (bytesCompared) {
    for (const p of plans) {
      if (p.bytes === null || p.bytes <= maxBytes) continue;
      over.push({ kind: 'plan-too-many-bytes', plan: p.plan, measured: p.bytes,
        ceiling: maxBytes,
        detail: `phase ${n} ${p.plan} declares ${p.bytes} bytes, ceiling ${maxBytes}` });
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
    ...(maxBytes !== null ? { max_bytes: maxBytes } : {}),
    over,
    compared,
    within: compared.length ? over.length === 0 : null,
  });
}

export { cmdPlanSize };
