// @ts-check
// planning/brief.mjs - `brief`: one plan's brief, or one role's narrowed input, composed with no model and written to a file, never to the transcript
// reads no config, and a bare run composes and checks without writing
'use strict';

import { join } from 'node:path';
import { dirFlag, fail, intFlag, listPlanFiles, ok, phaseGuard, read, readStoredMap } from './core.mjs';
import { slice } from '../lib/codemap-slice.mjs';
import { composeBrief, composePhaseInput, composeReviewerInput, composeVerifierInput } from '../lib/plan-brief.mjs';
import { planFileFor, planNumber } from '../lib/phase-plans.mjs';
import { atomicWrite } from '../lib/planning-store.mjs';

/**
 * The stored map for the plan's check and its rows, or null: any failure the shared read hands back, from no map to no git,
 * is no map. Nothing here opens a path a plan names.
 * @param {string} dir the planning directory
 */
function loadMap(dir) {
  try {
    const m = readStoredMap(dir);
    if ('error' in m) return null;
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

// the roles with an input of their own; each file is named so none is `plan-<k>-brief.md` or another's
const ROLES = ['phase', 'reviewer', 'verifier'];

/** Writes `text` under `outDir` when one was given; the path, or null when nothing was written. */
function writeOut(/** @type {string|null} */ outDir, /** @type {string} */ name, /** @type {string} */ text) {
  if (outDir === null) return null;
  const path = join(outDir, name);
  atomicWrite(path, text);
  return path;
}

/**
 * @param {string} dir the planning directory
 * @param {any} opts `--out-dir` names an existing directory where the brief file is written; `--main-root` names the main tree's root, so the head's paths are absolute there;
 * `--role` names a role whose narrowed input is composed instead of the executor brief, and none is the executor brief
 */
function cmdBrief(dir, opts) {
  const parsedPhase = phaseGuard('brief', dir, opts.phase, 'brief needs --phase <N>',
    'pass --phase <N> for the phase the plan belongs to, then re-run',
    're-run with one of the two spellings the detail names - nothing was read');
  if (!parsedPhase) return;
  const role = opts.role === undefined ? null : String(opts.role);
  if (role !== null && !ROLES.includes(role)) {
    return fail('bad-args', `brief --role takes ${ROLES.join(', ')}, not ${role}`,
      'pass one of the roles the detail names, or no --role for the executor brief - nothing was written');
  }
  // the executor brief and the reviewer's input are one plan's; the door doesn't hold --plan required, so its refusal lives here
  const parsedPlan = role !== null && role !== 'reviewer' ? null
    : intFlag(opts.plan, null, role === null ? 'brief needs --plan <k>' : `brief --role ${role} needs --plan <k>`,
      'pass --plan <k>, the number in PLAN-<k>.md - 1 for a bare PLAN.md - then re-run');
  if (parsedPlan !== null && !parsedPlan.ok) return;
  /** @type {Record<string, string|null>} */
  const dirs = { 'out-dir': null, 'main-root': null };
  for (const flag of Object.keys(dirs)) {
    if (opts[flag] === undefined) continue;
    const dirArg = dirFlag(flag, opts[flag]);
    if (dirArg.detail !== null) {
      return fail('bad-args', dirArg.detail, 'make the directory first and pass it - nothing was written');
    }
    dirs[flag] = dirArg.abs;
  }
  const outDir = dirs['out-dir'];
  const pdir = join(dir, 'phases', parsedPhase.raw);

  if (role === 'phase') {
    const input = composePhaseInput({
      phase: parsedPhase.raw,
      mainRoot: dirs['main-root'],
      roadmapText: read(join(dir, 'ROADMAP.md')),
      requirementsText: read(join(dir, 'REQUIREMENTS.md')),
      projectText: read(join(dir, 'PROJECT.md')),
      contextText: read(join(pdir, 'CONTEXT.md')),
    });
    if (input.ok === false) return fail('no-roadmap', input.detail, input.hint);
    const path = writeOut(outDir, 'phase-input.md', input.text);
    return ok({ phase: parsedPhase.value, role, bytes: input.bytes, ...(path !== null ? { path } : {}) });
  }

  if (role === 'verifier') {
    const input = composeVerifierInput({
      phase: parsedPhase.raw,
      mainRoot: dirs['main-root'],
      plans: listPlanFiles(pdir).plans.map((file) => ({ file, text: read(join(pdir, file)) ?? '' })),
      roadmapText: read(join(dir, 'ROADMAP.md')),
      requirementsText: read(join(dir, 'REQUIREMENTS.md')),
      contextText: read(join(pdir, 'CONTEXT.md')),
      uatText: read(join(pdir, 'UAT.md')),
      summaryText: read(join(pdir, 'SUMMARY.md')),
    });
    if (input.ok === false) return fail('no-roadmap', input.detail, input.hint);
    const path = writeOut(outDir, 'verifier-input.md', input.text);
    return ok({ phase: parsedPhase.value, role, bytes: input.bytes, ...(path !== null ? { path } : {}) });
  }

  // the refusal above returned for every other shape, so a role that reaches here parsed its plan
  const k = /** @type {{ok: true, value: number}} */ (parsedPlan).value;
  const planFile = planFileFor(listPlanFiles(pdir).plans, String(k));
  const planText = planFile === undefined ? null : read(join(pdir, planFile));
  if (planFile === undefined || planText === null) {
    return fail('no-plan', `no PLAN-${k}.md or PLAN.md under ${pdir}`, `/cad-plan ${parsedPhase.raw}`);
  }
  if (role === 'reviewer') {
    const input = composeReviewerInput({
      phase: parsedPhase.raw,
      planFile,
      planText,
      mainRoot: dirs['main-root'],
      roadmapText: read(join(dir, 'ROADMAP.md')),
      requirementsText: read(join(dir, 'REQUIREMENTS.md')),
      contextText: read(join(pdir, 'CONTEXT.md')),
    });
    if (input.ok === false) {
      return input.noEntry ? fail('no-roadmap', input.detail, input.hint) : fail('bad-plan', input.detail, input.hint);
    }
    const path = writeOut(outDir, `plan-${planNumber(planFile)}-review-input.md`, input.text);
    return ok({ phase: parsedPhase.value, role, plan: planFile, bytes: input.bytes, ...(path !== null ? { path } : {}) });
  }
  const brief = composeBrief({
    planFile,
    planRel: `.planning/phases/${parsedPhase.raw}/${planFile}`,
    mainRoot: dirs['main-root'],
    planText,
    projectText: read(join(dir, 'PROJECT.md')),
    contextText: read(join(pdir, 'CONTEXT.md')),
    loadMap: () => loadMap(dir),
  });
  if (brief.ok === false) return fail('bad-plan', brief.detail, brief.hint);

  const path = writeOut(outDir, `plan-${planNumber(planFile)}-brief.md`, brief.text);
  return ok({
    phase: parsedPhase.value, plan: planFile, bytes: brief.bytes, ...(path !== null ? { path } : {}),
    ...(brief.readsMissing.length ? { reads_missing: brief.readsMissing } : {}),
    ...(brief.readsUnchecked ? { reads_unchecked: true } : {}),
  });
}

export { cmdBrief };
