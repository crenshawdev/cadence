// @ts-check
// planning/workflow-run.mjs - `workflow-run`: a finished review-panel run becomes a payload and a review input
// it reads the run file whole from disk and writes into the run's scratch directory. The record and the review file are
// written by their own seams, so --round, --task and the receipts stay where review-record.md states them
'use strict';

import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import {
  ANSWERS_FILE, MAX_ANSWERS_BYTES, MAX_RUN_BYTES, PAYLOAD_FILE, REVIEW_INPUT_FILE,
  mapRun, mergeAnswers, parseAnswers, parseRun,
} from '../lib/workflow-run.mjs';

/**
 * A regular file's text under a size cap, or why it can't be had (`tooLarge` apart from the rest).
 * @param {string} file @param {number} cap
 * @returns {{text: string|null, why: string, tooLarge?: boolean}}
 */
function readCapped(file, cap) {
  const cannot = (/** @type {any} */ e) => ({ text: null, why: `cannot be read (${(e && e.code) || 'error'})` });
  let st;
  try { st = lstatSync(file); } catch (e) { return cannot(e); }
  if (!st.isFile()) return { text: null, why: 'is not a regular file' };
  if (st.size > cap) return { text: null, why: `is ${st.size} bytes, over the ${cap} byte cap`, tooLarge: true };
  try { return { text: readFileSync(file, 'utf8'), why: '' }; } catch (e) { return cannot(e); }
}

/**
 * Turn the answers file and the answers earlier calls kept into one list, or say what is wrong with either.
 * @param {string} outDir @param {unknown} answersFile
 * @returns {{ok: boolean, reason?: string, detail?: string, answers?: any[], fresh?: boolean}}
 */
function loadAnswers(outDir, answersFile) {
  /** @type {any[]} */
  let prior = [];
  const kept = join(outDir, ANSWERS_FILE);
  let present = true;
  try { lstatSync(kept); } catch { present = false; }
  if (present) {
    const r = readCapped(kept, MAX_ANSWERS_BYTES);
    /** @type {any} */
    let parsed = null;
    try { parsed = r.text === null ? null : JSON.parse(r.text); } catch { /* judged below */ }
    const checked = parseAnswers(parsed);
    if (!checked.ok) return { ok: false, reason: 'bad-answers', detail: `the answers kept from an earlier call (${kept}) are unusable: ${r.text === null ? r.why : checked.detail}` };
    prior = checked.answers || [];
  }
  if (answersFile === undefined) return { ok: true, answers: prior, fresh: false };
  if (typeof answersFile !== 'string' || !answersFile.trim()) {
    return { ok: false, reason: 'bad-args', detail: 'workflow-run --answers-file needs a path after it' };
  }
  const r = readCapped(answersFile, MAX_ANSWERS_BYTES);
  if (r.text === null) return { ok: false, reason: 'bad-answers', detail: `the answers file ${r.why}` };
  /** @type {any} */
  let parsed;
  try { parsed = JSON.parse(r.text); } catch { return { ok: false, reason: 'bad-answers', detail: 'the answers file is not JSON' }; }
  const checked = parseAnswers(parsed);
  if (!checked.ok) return { ok: false, reason: 'bad-answers', detail: checked.detail };
  return { ok: true, answers: mergeAnswers(prior, checked.answers || []), fresh: true };
}

function cmdWorkflowRun(dir, opts) {
  const phase = requirePhaseArg(opts.phase);
  if (!phase.ok) {
    return fail('bad-args', 'workflow-run needs --phase <N>', 'pass --phase <N> for the phase this fire belongs to, then re-run');
  }
  for (const flag of ['run-file', 'out-dir']) {
    if (typeof opts[flag] !== 'string' || !opts[flag].trim()) {
      return fail('bad-args', `workflow-run needs --${flag} <path>`, `pass --${flag} <path> and re-run - nothing was written`);
    }
  }
  const outDir = resolve(opts['out-dir']);
  let outStat = null;
  try { outStat = lstatSync(outDir); } catch { /* refused below */ }
  if (!outStat || !outStat.isDirectory()) {
    return fail('bad-args', `--out-dir ${outDir} is not a directory`, 'make this run\'s scratch directory first and pass it - nothing was written');
  }

  const run = readCapped(opts['run-file'], MAX_RUN_BYTES);
  if (run.text === null) {
    return fail(run.tooLarge ? 'run-too-large' : 'run-unreadable',
      `the run file ${run.why}`,
      'nothing was written - read the run file named on the launch result, and if it is gone the notice\'s totals are all that remain');
  }
  const parsed = parseRun(run.text);
  if (!parsed.ok) return fail(/** @type {string} */ (parsed.reason), parsed.detail, 'nothing was written - a run that did not complete cleanly is not a clean review, so rule this fire another way');

  const loaded = loadAnswers(outDir, opts['answers-file']);
  if (!loaded.ok) return fail(/** @type {string} */ (loaded.reason), loaded.detail, 'nothing was written - repair the answers and re-run');
  const answers = loaded.answers || [];

  const mapped = mapRun(parsed.run, answers);
  if (!mapped.ok) return fail(/** @type {string} */ (mapped.reason), mapped.detail, 'nothing was written - this run cannot be turned into a record');

  const files = {
    payload: join(outDir, PAYLOAD_FILE),
    review_input: join(outDir, REVIEW_INPUT_FILE),
    answers: join(outDir, ANSWERS_FILE),
  };
  atomicWrite(files.payload, `${JSON.stringify(mapped.payload, null, 2)}\n`);
  atomicWrite(files.review_input, `${JSON.stringify(mapped.review, null, 2)}\n`);
  if (loaded.fresh) atomicWrite(files.answers, `${JSON.stringify({ answers }, null, 2)}\n`);

  return ok({
    phase: phase.raw,
    run_id: typeof parsed.run.runId === 'string' ? parsed.run.runId : undefined,
    payload: files.payload,
    review_input: files.review_input,
    ...(loaded.fresh || answers.length ? { answers: files.answers } : {}),
    ...mapped.summary,
  });
}

export { cmdWorkflowRun };
