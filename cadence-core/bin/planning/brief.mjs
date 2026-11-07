// @ts-check
// planning/brief.mjs - `brief`: one plan's brief, composed with no model and written to a file, never to the transcript
// reads no config: the caller gates it on planning.workflow_plans, so a bare run composes and checks without writing
'use strict';

import { lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fail, listPlanFiles, ok, phaseSpellingCollision, read } from './core.mjs';
import { readStoredMap } from './codemap.mjs';
import { slice } from '../lib/codemap-slice.mjs';
import { composeBrief } from '../lib/plan-brief.mjs';
import { planFileFor, planNumber } from '../lib/phase-plans.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';

/**
 * The stored map for the plan's check and its rows, or null: any failure the shared read hands back, from no map to no git,
 * is no map. Nothing here opens a path a plan names.
 * @param {string} dir the planning directory
 */
function loadMap(dir) {
  try {
    const m = readStoredMap(dir);
    if (m.error) return null;
    const { index, states, entries, entryPath, current, marks } = m;
    return {
      rows: index.rows,
      symbolsShed: index.symbols_shed === true,
      slice: (/** @type {string[]} */ files, /** @type {number} */ limit) => slice({
        rows: index.rows, modules: index.modules, states, entries, select: { files, symbols: [], terms: [] }, entryPath, current, marks, limit,
      }),
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} dir the planning directory
 * @param {any} opts `--out-dir` names an existing directory where the brief file is written
 */
function cmdBrief(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'brief needs --phase <N>',
      'pass --phase <N> for the phase the plan belongs to, then re-run');
  }
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `brief ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const parsedPlan = requireInt(opts.plan);
  if (!parsedPlan.ok) {
    return fail('bad-args', 'brief needs --plan <k>',
      'pass --plan <k>, the number in PLAN-<k>.md - 1 for a bare PLAN.md - then re-run');
  }
  /** @type {string|null} */
  let outDir = null;
  if (opts['out-dir'] !== undefined) {
    outDir = resolve(String(opts['out-dir']));
    let st = null;
    try { st = lstatSync(outDir); } catch { /* refused below */ }
    if (!st || !st.isDirectory()) {
      return fail('bad-args', `--out-dir ${outDir} is not a directory`, 'make the scratch directory first and pass it - nothing was written');
    }
  }

  const pdir = join(dir, 'phases', parsedPhase.raw);
  const planFile = planFileFor(listPlanFiles(pdir).plans, String(parsedPlan.value));
  const planText = planFile === undefined ? null : read(join(pdir, planFile));
  if (planFile === undefined || planText === null) {
    return fail('no-plan', `no PLAN-${parsedPlan.value}.md or PLAN.md under ${pdir}`, `/cad-plan ${parsedPhase.raw}`);
  }
  const brief = composeBrief({
    planFile,
    planRel: `.planning/phases/${parsedPhase.raw}/${planFile}`,
    planText,
    projectText: read(join(dir, 'PROJECT.md')),
    contextText: read(join(pdir, 'CONTEXT.md')),
    loadMap: () => loadMap(dir),
  });
  if (!brief.ok) return fail('bad-plan', brief.detail, brief.hint);

  /** @type {string|null} */
  let path = null;
  if (outDir !== null) {
    path = join(outDir, `plan-${planNumber(planFile)}-brief.md`);
    atomicWrite(path, brief.text);
  }
  return ok({
    phase: parsedPhase.value, plan: planFile, bytes: brief.bytes, ...(path !== null ? { path } : {}),
    ...(brief.readsMissing.length ? { reads_missing: brief.readsMissing } : {}),
    ...(brief.readsUnchecked ? { reads_unchecked: true } : {}),
  });
}

export { cmdBrief };
