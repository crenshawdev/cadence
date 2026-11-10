// @ts-check
// planning/plan-size.mjs - `plan-size`: the size facts a phase carries, each a number against an integer ceiling
'use strict';

import { lstatSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fail, intFlag, phaseSpellingCollision, listPlanFiles, ok, read } from './core.mjs';
import { phaseRequirements, planTaskTitles, readFrontmatterList } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

/**
 * The bytes one plan's `files:` frontmatter declares, and how many declared paths added none.
 * They travel together: the total alone misleads, since files not yet created sum to nothing.
 * The frontmatter list only, never the union with task lines (as lib/phase-plans.mjs), so prose can't inflate it.
 * Out of grammar is null, never 0 (readOnePlan's no-salvage rule): 0 would say the plan declares nothing.
 * Each path is lstat'ed and counted only when isFile (like route.mjs's declaredBodies); else it bumps `absent`.
 * An absolute path or a `..` segment is refused by spelling, never stat'd, and counts as absent.
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

// both are counts against integers because soft ceilings were ignored: 25 requirements got planned as 8 tasks against 4
// one subcommand for two questions: an oversized phase is why a plan overruns its task ceiling
// `--max-reqs`, `--max-tasks` and `--max-bytes` are the caller's resolved values; this seam reads no config
function cmdPlanSize(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'plan-size needs --phase <N>',
      'pass --phase <N> naming the phase whose plans should be sized, then re-run');
  }
  // the tree-aware collision check runs before any phase-directory read (#42, #45); `phases/1.10/` stays addressable
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `plan-size ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const n = parsedPhase.value;

  // resolved to plain numbers at the boundary, never the intFlag envelope: a `{ok:false}` arm fails the typecheck
  let maxTasks = null;
  if (opts['max-tasks'] !== undefined) {
    const parsed = intFlag(opts['max-tasks'], null, '--max-tasks must be an integer',
      'send --max-tasks as a plain integer, or drop it to size without a task ceiling - this seam'
      + ' reads no config, so the value is the one the caller already resolved');
    if (!parsed.ok) return;
    maxTasks = parsed.value;
  }
  let maxBytes = null;
  if (opts['max-bytes'] !== undefined) {
    const parsed = intFlag(opts['max-bytes'], null, '--max-bytes must be an integer',
      'send --max-bytes as a plain integer number of bytes, or drop it to size without a byte'
      + ' ceiling - this seam reads no config, so the value is the one the caller already'
      + ' resolved');
    if (!parsed.ok) return;
    maxBytes = parsed.value;
  }
  let maxReqs = null;
  if (opts['max-reqs'] !== undefined) {
    const parsed = intFlag(opts['max-reqs'], null, '--max-reqs must be an integer',
      'send --max-reqs as a plain integer, or drop it to size without a requirement ceiling');
    if (!parsed.ok) return;
    maxReqs = parsed.value;
  }

  const roadmap = read(join(dir, 'ROADMAP.md')) || '';
  const phase = phaseRequirements(roadmap, parsedPhase.raw);

  // the directory is the caller's spelling; only the echoed `phase` is the number
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles } = listPlanFiles(pdir);
  // declared paths are repo-relative to the planning root's parent, the same derivation route.mjs's risk floor makes
  const repoRoot = dirname(dir);
  // one read per plan feeding both facts, so adding the byte question didn't add a second pass over each plan
  const plans = planFiles.map((f) => {
    const text = read(join(pdir, f)) || '';
    const { bytes, absent } = declaredBytes(repoRoot, text);
    return { plan: f, tasks: planTaskTitles(text).length, bytes, absent };
  });
  const tasks = plans.reduce((a, p) => a + p.tasks, 0);

  const over = [];
  // both ceilings are conditional: `compared` names those that ran, and an empty one makes `within` null, not true
  const reqsCompared = maxReqs !== null && phase.found;
  const tasksCompared = maxTasks !== null && plans.length > 0;
  // an out-of-grammar `files:` list carries a null byte figure and isn't compared; unreadable isn't small
  const bytesCompared = maxBytes !== null && plans.some((p) => p.bytes !== null);
  const compared = [];
  if (reqsCompared) compared.push('max_reqs');
  if (tasksCompared) compared.push('max_tasks');
  if (bytesCompared) compared.push('max_bytes');

  // absence is not zero: a roadmap with no detail block for this phase reports found:false and is never compared
  if (reqsCompared && phase.ids.length > maxReqs) {
    over.push({ kind: 'phase-too-big', measured: phase.ids.length, ceiling: maxReqs,
      detail: `phase ${n} names ${phase.ids.length} requirements, ceiling ${maxReqs}` });
  }
  // per plan, not per phase: the key is `max_plan_tasks`, and a phase-wide reading shipped 8 tasks in one plan
  // only once a plan exists: an unwritten plan has zero tasks, which is under every ceiling
  if (tasksCompared) {
    for (const p of plans) {
      if (p.tasks <= maxTasks) continue;
      over.push({ kind: 'plan-too-many-tasks', plan: p.plan, measured: p.tasks,
        ceiling: maxTasks,
        detail: `phase ${n} ${p.plan} carries ${p.tasks} tasks, ceiling ${maxTasks}` });
    }
  }
  // per plan for the same reason and with the same remedy: a plan over the ceiling splits; reported, never refused
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
