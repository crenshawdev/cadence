// @ts-check
// planning/plan-size.mjs - `plan-size`: the size facts a phase carries (requirements named, tasks planned, bytes each plan's `files:` frontmatter declares), each as a number against an integer ceiling
'use strict';

import { lstatSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, ok, read } from './core.mjs';
import { phaseRequirements, planTaskTitles, readFrontmatterList } from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';

/**
 * The bytes one plan's `files:` frontmatter declares, and how many of those declared paths contributed none. They travel together because the total alone is unreadable: a creation-heavy plan declaring ten files that don't exist yet sums to nearly nothing and reads as comfortably under any ceiling while measuring much less than it declared.
 * The frontmatter list only, never parsePlanFiles's union with the `- **Files:**` task lines (same choice as lib/phase-plans.mjs): the union would measure a file no frontmatter declared, so the number would answer for incidental task prose and not for the curated declaration the executor is handed.
 * Out of grammar is null and never 0, on readOnePlan's no-salvage rule: a half-parsed `files:` list is an unresolvable input and not a shorter one, and 0 would state the plan declares nothing, absence of evidence reported as absence of surface. The caller reads null as "not comparable" and not as "small".
 * Every path is sized with lstatSync and counted only when isFile, which is route.mjs's declaredBodies guard: a path the plan has yet to create, a directory, and a symlink to a device or FIFO each contribute zero and increment `absent`, because each makes the total measure less than was declared. An absolute path or one with a `..` segment is refused by spelling and never stat'd, since a resolve is no place to walk out of the repository, and lands on the same count.
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

// both size facts are counts against integers, because both were soft and ignored: a phase naming 25 of a project's 46 requirements was planned as 8 tasks against a ceiling of 4, by a planner told the ceiling and a checker told to flag the overrun, and two model-judgment gates missed a comparison a grep makes
// one subcommand for two questions because they're asked at the same moment and the first predicts the second: an oversized phase is why a plan overruns its task ceiling, so reporting them apart would hand the caller two verdicts to reconcile
// `--max-reqs`, `--max-tasks` and `--max-bytes` are the caller's resolved values and this seam reads no config for them: workflows/plan.md already batches a config read at its parse step, and a second reader here would be a second place for the resolved ceiling to disagree
function cmdPlanSize(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'plan-size needs --phase <N>',
      'pass --phase <N> naming the phase whose plans should be sized, then re-run');
  }
  // the tree-aware collision check goes before any read of the phase directory, the rail this file already holds that a flag is validated ahead of the work it names (#42, #45). It refuses only when the normalized spelling names a directory that exists here, so `phases/1.10/` stays addressable on a tree with no `phases/1.1/`
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `plan-size ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const n = parsedPhase.value;

  // resolved to plain numbers at the boundary and never carried as the requireInt envelope: a `{ok:false}` arm surviving into the comparisons below is a shape the typecheck refuses, rightly
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

  // the directory is the caller's spelling; only the echoed `phase` is the number
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles } = listPlanFiles(pdir);
  // declared paths are repo-relative and the repo root is the planning root's parent, the same derivation route.mjs's risk floor makes for the paths it scans, so the two faces resolve a declared path identically
  const repoRoot = dirname(dir);
  // one read per plan feeding both facts, so adding the byte question didn't add a second pass over each plan
  const plans = planFiles.map((f) => {
    const text = read(join(pdir, f)) || '';
    const { bytes, absent } = declaredBytes(repoRoot, text);
    return { plan: f, tasks: planTaskTitles(text).length, bytes, absent };
  });
  const tasks = plans.reduce((a, p) => a + p.tasks, 0);

  const over = [];
  // both ceilings are conditional, so a verdict has to say whether anything was compared at all: `compared` names the ceilings that ran, and an empty one makes `within` null below, since `within: true` beside `requirements_found: false` reported a comparison that never happened
  const reqsCompared = maxReqs !== null && phase.found;
  const tasksCompared = maxTasks !== null && plans.length > 0;
  // a plan whose `files:` list is out of grammar carries a null byte figure and isn't compared, since something nobody could read isn't a small one; the ceiling reaches `compared` only when at least one plan had a figure, which keeps `within: true` meaning every comparison that ran came back clean and not "nothing was looked at"
  const bytesCompared = maxBytes !== null && plans.some((p) => p.bytes !== null);
  const compared = [];
  if (reqsCompared) compared.push('max_reqs');
  if (tasksCompared) compared.push('max_tasks');
  if (bytesCompared) compared.push('max_bytes');

  // absence is not zero: a roadmap with no detail block for this phase reports found:false and is never compared, because a phase nobody wrote down isn't a small one
  if (reqsCompared && phase.ids.length > maxReqs) {
    over.push({ kind: 'phase-too-big', measured: phase.ids.length, ceiling: maxReqs,
      detail: `phase ${n} names ${phase.ids.length} requirements, ceiling ${maxReqs}` });
  }
  // per plan and not per phase: the key is `max_plan_tasks` while workflows/plan.md once said "delivering this phase needs more than that many tasks", and a tree read it both ways (one phase shipped 8 tasks in one plan, the next 4+4+4 across three). Per plan makes the remedy obvious, since a plan over its ceiling splits into more plans inside the same phase
  // only once a plan exists: an unwritten plan has zero tasks, which is under every ceiling, so comparing before the planner runs would report a clean phase for a plan nobody wrote
  if (tasksCompared) {
    for (const p of plans) {
      if (p.tasks <= maxTasks) continue;
      over.push({ kind: 'plan-too-many-tasks', plan: p.plan, measured: p.tasks,
        ceiling: maxTasks,
        detail: `phase ${n} ${p.plan} carries ${p.tasks} tasks, ceiling ${maxTasks}` });
    }
  }
  // per plan for the same reason as the task ceiling, with the same remedy: the declared paths are what one executor dispatch is handed, so a plan over the ceiling splits into more plans and doesn't shrink in place. Reported and never refused: this is one more `over[]` entry beside `plan-too-many-tasks` at the same `check_size` step, not a new gate
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
