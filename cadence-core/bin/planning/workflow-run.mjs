// @ts-check
// planning/workflow-run.mjs - `workflow-run`: a finished review-panel run becomes a payload and a review input
// with --analyzer it takes a finished analyzer run instead: the brackets, then the report written whole to the out-dir
// it reads the run file whole from disk and writes into the run's scratch directory. The record and the review file are
// written by their own seams, so --round, --task and the receipts stay where review-record.md states them
// the run's brackets go FIRST, whatever the file says: an agent that spent tokens on a killed or refused run is still billed
// the same call twice writes no second set, because a resumed session may retry it: a bracket whose key is already there is skipped
'use strict';

import { lstatSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';
import { appendEvent, renderTrace, TERMINAL } from '../lib/trace.mjs';
import {
  ANALYZER_FILE, ANSWERS_FILE, MAX_ANSWERS_BYTES, MAX_RUN_BYTES, PAYLOAD_FILE, REVIEW_INPUT_FILE,
  agentBrackets, agentRows, mapRun, mergeAnswers, noticeBracket, parseAnalyzerRun, parseAnswers, parseRun,
} from '../lib/workflow-run.mjs';

/** A provider's teed envelope is one JSON line, so this is generous. */
const MAX_ENVELOPE_BYTES = 1024 * 1024;

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

/**
 * Write the run's brackets. A worker whose dispatch is on the record gets only its terminal, so a retry after a half-written
 * pair closes it, and one with both is skipped. When the run's `<run id>-notice` bracket is already there, an earlier call
 * billed the run's totals and billing it per agent as well would count it twice, so none are written.
 * @param {string} dir the planning directory
 * @param {string} phase @param {string} runId @param {{plan: string, dispatch: any, terminal: any}[]} list
 * @returns {{written: number, already: number, failed: {plan: string, reason: string}[]}}
 */
function writeBrackets(dir, phase, runId, list) {
  const events = renderTrace(dir, phase).events.filter((e) => e.family === 'lifecycle');
  const dispatched = new Set(events.filter((e) => e.event === 'dispatch').map((e) => String(e.plan)));
  const closed = new Set(events.filter((e) => TERMINAL.includes(e.event)).map((e) => String(e.plan)));
  const out = { written: 0, already: 0, failed: /** @type {{plan: string, reason: string}[]} */ ([]) };
  const billedAsTotals = dispatched.has(`${runId}-notice`);
  for (const b of list) {
    if (closed.has(b.plan) || (billedAsTotals && b.plan !== `${runId}-notice`)) { out.already += 1; continue; }
    for (const event of dispatched.has(b.plan) ? [b.terminal] : [b.dispatch, b.terminal]) {
      const r = appendEvent(dir, event);
      if (!r.written) { out.failed.push({ plan: b.plan, reason: r.reason || 'not-written' }); break; }
      if (event === b.terminal) out.written += 1;
    }
  }
  return out;
}

/**
 * Each provider voice's envelope as parsed from the file the wrapper teed it to, null where it can't be read as JSON.
 * @param {any} run a run `parseRun` accepted
 * @returns {Map<string, any>}
 */
function readEnvelopes(run) {
  const found = new Map();
  for (const v of run.result.voices) {
    // a voice that did not run may still carry what its provider teed before the wrapper failed to answer
    if (typeof v.envelope !== 'string' || !v.envelope.trim()) continue;
    const r = readCapped(v.envelope, MAX_ENVELOPE_BYTES);
    /** @type {any} */
    let parsed = null;
    try { parsed = r.text === null ? null : JSON.parse(r.text); } catch { /* an unreadable envelope falls back to the agent's return */ }
    found.set(v.voice, parsed);
  }
  return found;
}

function cmdWorkflowRun(dir, opts) {
  const phase = requirePhaseArg(opts.phase);
  if (!phase.ok) {
    return fail('bad-args', 'workflow-run needs --phase <N>', 'pass --phase <N> for the phase this fire belongs to, then re-run');
  }
  for (const flag of ['run-file', 'out-dir', 'payload-ref']) {
    if (typeof opts[flag] !== 'string' || !opts[flag].trim()) {
      return fail('bad-args', `workflow-run needs --${flag} <value>`, `pass --${flag} and re-run - nothing was written`);
    }
  }
  /** @type {{tokens?: number, turns?: number, duration_ms?: number}} */
  const totals = {};
  for (const [flag, key] of [['notice-tokens', 'tokens'], ['notice-turns', 'turns'], ['notice-duration-ms', 'duration_ms']]) {
    if (!(flag in opts)) continue;
    const n = requireInt(opts[flag]);
    if (!n.ok || n.value < 0) return fail('bad-args', `workflow-run --${flag} needs a non-negative whole number`, 'copy the notice\'s figure as a plain number - nothing was written');
    totals[key] = n.value;
  }
  const outDir = resolve(opts['out-dir']);
  let outStat = null;
  try { outStat = lstatSync(outDir); } catch { /* refused below */ }
  if (!outStat || !outStat.isDirectory()) {
    return fail('bad-args', `--out-dir ${outDir} is not a directory`, 'make this run\'s scratch directory first and pass it - nothing was written');
  }

  const runRead = readCapped(opts['run-file'], MAX_RUN_BYTES);
  /** @type {any} */
  let file = null;
  if (runRead.text !== null) { try { file = JSON.parse(runRead.text); } catch { /* the bracket falls back below */ } }
  const runId = file && typeof file.runId === 'string' && file.runId ? file.runId : basename(opts['run-file'], '.json');

  // the brackets first: whatever happens to the result below, these agents spent real tokens
  const analyzer = opts.analyzer === true;
  const at = { phase: phase.raw, runId, payloadRef: opts['payload-ref'].trim() };
  const rows = agentRows(file);
  const fromFile = rows.length > 0;
  const why = runRead.text === null ? `the run file ${runRead.why}` : (file === null ? 'the run file is not JSON' : 'the run file holds no agent rows');
  const brackets = {
    source: fromFile ? 'run-file' : 'notice-totals',
    ...writeBrackets(dir, phase.raw, runId, fromFile ? agentBrackets(file, at) : [noticeBracket({ ...at, why, totals })]),
  };
  /** Every answer from here on says what was billed. @param {string} reason @param {string} [detail] @param {string} [hint] */
  const refuse = (reason, detail, hint) => emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}), brackets });

  if (runRead.text === null) {
    return refuse(runRead.tooLarge ? 'run-too-large' : 'run-unreadable', `the run file ${runRead.why}`,
      'no payload was written - the notice\'s totals were billed as one bracket; read the run file named on the launch result if it is still there');
  }
  if (analyzer) {
    const found = parseAnalyzerRun(runRead.text);
    if (!found.ok) return refuse(/** @type {string} */ (found.reason), found.detail, 'no report was written - take the analyzer\'s failure arm. The readers were billed');
    const report = join(outDir, ANALYZER_FILE);
    atomicWrite(report, /** @type {string} */ (found.report));
    return ok({ phase: phase.raw, run_id: runId, report, nulls: found.nulls, brackets });
  }

  const parsed = parseRun(runRead.text);
  if (!parsed.ok) return refuse(/** @type {string} */ (parsed.reason), parsed.detail, 'no payload was written - a run that did not complete cleanly is not a clean review, so rule this fire another way. Its agents were billed');

  const loaded = loadAnswers(outDir, opts['answers-file']);
  if (!loaded.ok) return refuse(/** @type {string} */ (loaded.reason), loaded.detail, 'nothing was written but the brackets - repair the answers and re-run');
  const answers = loaded.answers || [];

  const mapped = mapRun(parsed.run, answers, readEnvelopes(parsed.run));
  if (!mapped.ok) return refuse(/** @type {string} */ (mapped.reason), mapped.detail, 'no payload was written - this run cannot be turned into a record. Its agents were billed');

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
    run_id: runId,
    payload: files.payload,
    review_input: files.review_input,
    ...(loaded.fresh || answers.length ? { answers: files.answers } : {}),
    brackets,
    ...mapped.summary,
  });
}

export { cmdWorkflowRun };
