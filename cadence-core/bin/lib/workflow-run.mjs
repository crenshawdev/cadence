// @ts-check
// workflow-run.mjs - a finished review-panel run, turned into the adjudication payload and the review file's input
//
// INPUT is the run file the host leaves (`<session>/workflows/<run id>.json`) read whole: the completion notice cuts a long
// result short. Only `status`, `result` and `workflowProgress[]` are read, so an undocumented file is trusted for no more
// than that. The result is the shape workflows/review-panel.js returns, and a test runs that script through here so the
// two can't drift.
// NO RULING IS ADDED and no record key: the checker's three words map onto the record's three (D-04), and a finding the
// record could not store is listed for the main session to rule, never stored as something it isn't (D-16)
// BRACKETS: one dispatch and one terminal per `workflow_agent` row, from `workflowProgress[]`, since the completion notice
// holds run totals only. A figure the row lacks is omitted, never 0, as seam-spawn-agent.md states. ROLES: a reviewer row
// is `cad-reviewer` by its agentType, and two labels the script sets keep their spend apart from it so that role's total
// still means the reviewers: a label opening `checker ` is `review-checker`, one opening `provider ` is the provider
// wrapper, `review-provider-wrapper`. No label and no rung agentType reads as `workflow-agent`. With no per-agent rows the
// call bills the run as one `review-workflow` bracket from the notice's totals.
// A PROVIDER VOICE carries `envelope`, the path the wrapper agent teed the provider's own output to. The agent retypes that
// envelope, which can change a byte, so the seam takes `returned` from the file and the file wins. A ruling only counts for
// the text its checker read: an envelope finding with no identical retyped copy keeps no ruling and lands with the nulls,
// and a retyped finding the file does not hold is dropped and named. No readable envelope means the agent's own return,
// and that is named too (D-16, D-20)
// ANSWERS are the main session's, keyed by voice and index. Two groups, and a later answer replaces its group whole:
//   ruling:      ruling (survived|downgraded|refuted), severity, counter_evidence, and the six texts
//   settlement:  fix_commit, fix_file, overridden
// `buildEntries` stays the one judge of what is storable. Pure: no fs, no git, no env
'use strict';

import { buildEntries, HALTING_SEVERITIES, RAISED_SEVERITIES, RULINGS } from './adjudication-record.mjs';
import { HEADINGS } from './review-file.mjs';
import { roleOfAgent } from './rung-agent.mjs';
import { isPlainObject } from './text-util.mjs';

/** The run file's size cap. A real one is about 100 KB, so this is generous and still stops a hostile giant. */
export const MAX_RUN_BYTES = 8 * 1024 * 1024;
/** The answers file's cap. */
export const MAX_ANSWERS_BYTES = 1024 * 1024;
/** The three files a call leaves in its output directory, so prose, tests and the next call agree on the names. */
export const PAYLOAD_FILE = 'payload.json';
export const REVIEW_INPUT_FILE = 'survivors.json';
export const ANSWERS_FILE = 'answers.json';
/** How many entries one envelope list carries before it says how many more there are. */
export const LIST_CAP = 25;

const SIX = HEADINGS.map(([key]) => key);
const HEADING_OF = Object.fromEntries(HEADINGS);
const RANK = { low: 0, medium: 1, high: 2, blocker: 3 };
const CHECKER_RULINGS = ['proved', 'refuted', 'neither'];
const SETTLEMENT_KEYS = ['fix_commit', 'fix_file', 'overridden'];
const RULING_KEYS = ['ruling', 'severity', 'counter_evidence', ...SIX];
const EVIDENCE_KEYS = ['file', 'line', 'note'];

const isText = (v) => typeof v === 'string' && v.trim() !== '';
/** A refusal with its one named reason. @param {string} reason @param {string} detail */
const refuse = (reason, detail) => ({ ok: false, reason, detail });

/**
 * The counter-evidence a record would take, or null when it names no file. Only the three keys it knows are copied.
 * @param {any} ev
 */
function evidenceOf(ev) {
  if (!isPlainObject(ev) || !isText(ev.file)) return null;
  const out = { file: ev.file };
  if (Number.isSafeInteger(ev.line) && ev.line >= 1) out.line = ev.line;
  if (isText(ev.note)) out.note = ev.note;
  return out;
}

/**
 * Check the main session's answers and return them as a list, or the one thing wrong with them.
 * @param {any} raw the parsed answers file
 * @returns {{ok: boolean, reason?: string, detail?: string, answers?: any[]}}
 */
export function parseAnswers(raw) {
  const bad = (/** @type {string} */ detail) => refuse('bad-answers', detail);
  if (!isPlainObject(raw) || !Array.isArray(raw.answers)) return bad('the answers file must be {"answers": [...]}');
  for (const k of Object.keys(raw)) if (k !== 'answers') return bad(`the answers file carries an unknown key: ${k}`);
  const allowed = ['voice', 'index', ...SETTLEMENT_KEYS, ...RULING_KEYS];
  /** @type {any[]} */
  const answers = [];
  for (let i = 0; i < raw.answers.length; i += 1) {
    const a = raw.answers[i];
    const at = `answers[${i}]`;
    if (!isPlainObject(a)) return bad(`${at} is not an object`);
    for (const k of Object.keys(a)) if (!allowed.includes(k)) return bad(`${at} carries an unknown key: ${k}`);
    if (!isText(a.voice)) return bad(`${at}.voice must name the voice that raised the finding`);
    if (!Number.isSafeInteger(a.index) || a.index < 0) return bad(`${at}.index must be the finding's index in that voice's findings`);
    if (a.ruling !== undefined && !RULINGS.includes(a.ruling)) return bad(`${at}.ruling must be one of ${RULINGS.join(' | ')}`);
    if (a.severity !== undefined && !RAISED_SEVERITIES.includes(a.severity)) return bad(`${at}.severity must be one of ${RAISED_SEVERITIES.join(' | ')}`);
    if (a.counter_evidence !== undefined && !isPlainObject(a.counter_evidence)) return bad(`${at}.counter_evidence must be an object`);
    if (a.counter_evidence) {
      for (const k of Object.keys(a.counter_evidence)) if (!EVIDENCE_KEYS.includes(k)) return bad(`${at}.counter_evidence carries an unknown key: ${k}`);
    }
    for (const k of SIX) if (a[k] !== undefined && typeof a[k] !== 'string') return bad(`${at}.${k} must be text`);
    if (a.fix_commit !== undefined && typeof a.fix_commit !== 'string') return bad(`${at}.fix_commit must be text`);
    if (a.fix_file !== undefined && typeof a.fix_file !== 'string') return bad(`${at}.fix_file must be text`);
    if (a.overridden !== undefined && a.overridden !== true) return bad(`${at}.overridden must be the boolean true or be absent`);
    answers.push(a);
  }
  return { ok: true, answers };
}

/**
 * Fold a later round of answers onto the earlier ones. Within one finding a later answer replaces its group whole, so
 * a ruling given in round one survives a settlement given in round two, and a new settlement displaces the old.
 * @param {any[]} prior @param {any[]} incoming @returns {any[]}
 */
export function mergeAnswers(prior, incoming) {
  /** @type {Map<string, any>} */
  const by = new Map();
  for (const a of [...prior, ...incoming]) {
    const id = `${a.voice}\0${a.index}`;
    const cur = by.get(id) || { voice: a.voice, index: a.index };
    for (const group of [SETTLEMENT_KEYS, RULING_KEYS]) {
      if (!group.some((k) => k in a)) continue;
      for (const k of group) delete cur[k];
      for (const k of group) if (k in a) cur[k] = a[k];
    }
    by.set(id, cur);
  }
  return [...by.values()];
}

/**
 * The first thing wrong with a findings list's severities, or null. A severity that is not one of the four would crash the
 * rank lookups, and a non-string one more so, so it is refused at the door.
 * @param {any[]} findings @returns {string|null}
 */
function findingsProblem(findings) {
  for (let i = 0; i < findings.length; i += 1) {
    const f = findings[i];
    if (isPlainObject(f) && !RAISED_SEVERITIES.includes(f.severity)) {
      return `finding ${i} has a severity that is not one of ${RAISED_SEVERITIES.join(' | ')}`;
    }
  }
  return null;
}

/** A finding as one comparable string, keys sorted, so two copies match only when every byte of every field does. @param {any} f */
const canon = (f) => JSON.stringify(Object.keys(f).sort().map((k) => [k, f[k]]));

/**
 * The findings a provider voice is judged on and the notes about how they were got. The envelope on disk wins over the
 * agent's retyped copy. Each envelope finding takes the verdict of the first unused retyped finding identical to it, or
 * `orphan` when there is none. A retyped finding the envelope does not hold is reported apart.
 * @param {any} voice a ran voice carrying `envelope` @param {any} env the parsed envelope file, or null when unreadable
 * @returns {{drop?: string, findings: any[], from: number[], orphan: string[], stray: any[], source: string, note?: string}}
 */
function providerFindings(voice, env) {
  const retyped = voice.result.findings;
  const usable = isPlainObject(env) && env.ok === true && Array.isArray(env.findings) && !findingsProblem(env.findings);
  if (isPlainObject(env) && env.ok === false) {
    return { drop: `the provider's own output says ${isText(env.reason) ? env.reason : 'ok:false'}`, findings: [], from: [], orphan: [], stray: [], source: 'envelope' };
  }
  if (!usable) {
    return {
      findings: retyped, from: retyped.map((_, i) => i), orphan: [], stray: [], source: 'agent-return',
      note: `${voice.voice}: no readable envelope at ${voice.envelope}, so the agent's own return was used and its bytes are unchecked`,
    };
  }
  const used = new Set();
  const from = [];
  const orphan = [];
  env.findings.forEach((f, i) => {
    const j = isPlainObject(f) ? retyped.findIndex((x, k) => !used.has(k) && isPlainObject(x) && canon(x) === canon(f)) : -1;
    if (j >= 0) used.add(j);
    from.push(j);
    orphan.push(j >= 0 ? '' : (voice.salvaged
      ? 'the wrapper returned no usable result, so no checker ruled on this finding from the provider\'s own output'
      : 'the provider\'s own text differs from the copy its checker read, or the agent left it out, so no checker ruling carries over'));
  });
  const stray = retyped.map((f, k) => ({ f, k })).filter(({ k }) => !used.has(k))
    .map(({ f }) => ({ voice: voice.voice, file: f && f.file, line: f && f.line, reason: 'the agent returned a finding the provider\'s own output does not hold, so it was dropped' }));
  return { findings: env.findings, from, orphan, stray, source: 'envelope' };
}

/**
 * A run file's text, judged as far as any script's run goes: JSON, completed, with a result.
 * @param {string} text
 * @returns {{ok: boolean, reason?: string, detail?: string, run?: any}}
 */
function parseCompleted(text) {
  /** @type {any} */
  let run;
  try { run = JSON.parse(text); } catch { return refuse('run-not-json', 'the run file is not JSON'); }
  if (!isPlainObject(run)) return refuse('run-not-json', 'the run file is not a JSON object');
  if (run.status !== 'completed') {
    return refuse('run-not-completed', `the run's status is ${JSON.stringify(run.status)}, not "completed", so it holds no result to rule on`);
  }
  if (run.result === undefined || run.result === null) return refuse('run-no-result', 'the run completed with no result');
  return { ok: true, run };
}

/** What the analyzer arm writes its report to, in the scratch directory. */
export const ANALYZER_FILE = 'analysis.md';

/** The role every analyzer reader bills under, so `workflow.max_dispatch_tokens.cad-assumptions-analyzer` compares against each. */
export const ANALYZER_ROLE = 'cad-assumptions-analyzer';

/**
 * Parse a run file's text and judge whether it is a completed run of workflows/analyzer.js with a report in it. A run with
 * none is `analyzer-no-report`, naming the readers that returned nothing, so it never reads as an analysis with no assumptions.
 * @param {string} text
 * @returns {{ok: boolean, reason?: string, detail?: string, run?: any, report?: string, nulls?: string[]}}
 */
export function parseAnalyzerRun(text) {
  const c = parseCompleted(text);
  if (!c.ok) return c;
  const r = c.run.result;
  if (!isPlainObject(r) || !(r.report === null || typeof r.report === 'string') || !Array.isArray(r.nulls) || !r.nulls.every(isText)) {
    return refuse('run-bad-result', 'the result is not the analyzer\'s: it needs a report (text or null) and a nulls list');
  }
  if (r.report === null || !isText(r.report)) {
    return refuse('analyzer-no-report', `the analyzer returned no report${r.nulls.length ? ` (readers that returned nothing: ${r.nulls.join(', ')})` : ''}`);
  }
  return { ok: true, run: c.run, report: r.report, nulls: r.nulls };
}

/**
 * Parse a run file's text and judge whether it is a completed run of this script.
 * @param {string} text
 * @returns {{ok: boolean, reason?: string, detail?: string, run?: any}}
 */
export function parseRun(text) {
  const c = parseCompleted(text);
  if (!c.ok) return c;
  const run = c.run;
  const r = run.result;
  if (!isPlainObject(r) || !Array.isArray(r.voices)) {
    return refuse('run-bad-result', 'the result is not review-panel\'s: it has no voices array');
  }
  for (let v = 0; v < r.voices.length; v += 1) {
    const voice = r.voices[v];
    const at = `result.voices[${v}]`;
    if (!isPlainObject(voice) || !isText(voice.voice) || typeof voice.ran !== 'boolean') {
      return refuse('run-bad-result', `${at} does not name a voice and say whether it ran`);
    }
    if (!voice.ran) continue;
    if (!isPlainObject(voice.result) || !Array.isArray(voice.result.findings)) {
      return refuse('run-bad-result', `${at} ran but holds no {findings: [...]} result`);
    }
    const sev = findingsProblem(voice.result.findings);
    if (sev) return refuse('run-bad-result', `${at}.result ${sev}`);
    if (voice.envelope !== undefined && !isText(voice.envelope)) return refuse('run-bad-result', `${at}.envelope is not a path`);
    if (!Array.isArray(voice.rulings)) return refuse('run-bad-result', `${at}.rulings is not an array`);
    for (const ruling of voice.rulings) {
      const ok = isPlainObject(ruling) && Number.isSafeInteger(ruling.index) && ruling.index >= 0
        && (ruling.ruling === null || isPlainObject(ruling.ruling));
      if (!ok) return refuse('run-bad-result', `${at}.rulings holds an entry that is not {index, ruling}`);
    }
  }
  return { ok: true, run };
}

/**
 * The checker's verdict as a record ruling plus the texts, or a reason it can't be used.
 * Proved at or above the raised severity stands, below it is downgraded, refuted is refuted, and neither stands as a
 * finding that is suspected. A verdict with a word outside the three is as unusable as none.
 * @param {any} finding @param {any} verdict
 * @returns {{ok: boolean, why?: string, item?: any}}
 */
function fromVerdict(finding, verdict) {
  if (verdict === null || verdict === undefined) return { ok: false, why: 'the checker returned nothing' };
  if (!CHECKER_RULINGS.includes(verdict.ruling)) return { ok: false, why: `the checker's ruling ${JSON.stringify(verdict.ruling)} is none of proved, refuted, neither` };
  if (!RAISED_SEVERITIES.includes(verdict.severity)) return { ok: false, why: 'the checker named no usable severity' };
  const texts = Object.fromEntries(SIX.map((k) => [k, typeof verdict[k] === 'string' ? verdict[k] : '']));
  /** @type {any} */
  const item = { severity: verdict.severity, suspected: verdict.ruling === 'neither', ...texts };
  if (verdict.ruling === 'refuted') {
    item.ruling = 'refuted';
    const ev = evidenceOf(verdict.counter_evidence);
    if (ev) item.counter_evidence = ev;
  } else if (verdict.ruling === 'proved' && RANK[verdict.severity] < RANK[finding.severity]) {
    item.ruling = 'downgraded';
  } else {
    item.ruling = 'survived';
  }
  return { ok: true, item };
}

/**
 * The one ruling for a finding, from the checker's verdict and the main session's answer for it. The answer's ruling
 * group lays over the verdict key by key, and its settlement is carried beside.
 * @param {any} finding @param {any} verdict @param {any} answer
 * @param {string} [orphan] why the verdict is not this finding's, which leaves it with no checker ruling
 * @returns {{ok: boolean, why?: string, item?: any}}
 */
function settle(finding, verdict, answer, orphan) {
  const base = orphan ? { ok: false, why: orphan, item: undefined } : fromVerdict(finding, verdict);
  let item = base.ok ? base.item : null;
  if (answer && answer.ruling !== undefined) {
    item = { ...(item || {}), suspected: false, ruling: answer.ruling };
    for (const k of ['severity', ...SIX]) if (answer[k] !== undefined) item[k] = answer[k];
    if (answer.counter_evidence !== undefined) item.counter_evidence = evidenceOf(answer.counter_evidence) || undefined;
  }
  if (!item) return { ok: false, why: base.why };

  if (item.ruling === 'refuted') {
    if (!evidenceOf(item.counter_evidence)) return { ok: false, why: 'ruled refuted with no counter_evidence.file, which a refutation owes' };
  } else {
    if (item.ruling === 'downgraded' && !(RAISED_SEVERITIES.includes(item.severity) && RANK[item.severity] < RANK[finding.severity])) {
      return { ok: false, why: 'ruled downgraded with no severity below the raised one' };
    }
    if (item.suspected && !isText(item.what_proves)) return { ok: false, why: 'ruled neither with no next check (what_proves is blank)' };
    for (const k of SIX) {
      if (!isText(item[k])) return { ok: false, why: `has no text under "${HEADING_OF[k]}" (${k})` };
    }
  }
  if (answer) {
    if (answer.fix_commit !== undefined) item.fix_commit = answer.fix_commit;
    if (answer.fix_file !== undefined) item.fix_file = answer.fix_file;
    if (answer.overridden !== undefined) item.overridden = true;
  }
  return { ok: true, item };
}

/**
 * Build the payload, the review input and what the main session still owes, from a parsed run.
 * @param {any} run a run `parseRun` accepted
 * @param {any[]} answers the accumulated answers
 * @param {Map<string, any>} [envelopes] each provider voice's parsed envelope file, null where it could not be read
 * @returns {{ok: boolean, reason?: string, detail?: string, payload?: any, review?: any, summary?: any}}
 */
export function mapRun(run, answers, envelopes = new Map()) {
  /** @type {any[]} */
  const rows = Array.isArray(run.workflowProgress) ? run.workflowProgress : [];
  const modelOf = (/** @type {string} */ voice) => {
    const row = rows.find((r) => isPlainObject(r) && r.type === 'workflow_agent' && r.label === `reviewer ${voice}`);
    return isText(row && row.model) ? row.model : (isText(run.defaultModel) ? run.defaultModel : null);
  };
  const answerFor = (/** @type {string} */ voice, /** @type {number} */ index) =>
    answers.find((a) => a.voice === voice && a.index === index);

  /** @type {any[]} */
  const voices = [];
  /** @type {any[]} */
  const dropped = [];
  /** @type {any[]} */
  const unruled = [];
  /** @type {any[]} */
  const needsAnswer = [];
  /** @type {any[]} */
  const kept = [];
  /** @type {any[]} */
  const providers = [];
  /** @type {any[]} */
  const notes = [];
  const counts = { raised: 0, survived: 0, downgraded: 0, refuted: 0, unruled: 0 };

  for (const row of run.result.voices) {
    // a voice that did not run but teed a readable ok:true envelope is judged on it; no checker saw it, so every finding lands unruled
    const teed = !row.ran && isText(row.envelope) ? envelopes.get(row.voice) : null;
    const salvaged = isPlainObject(teed) && teed.ok === true && Array.isArray(teed.findings) && !findingsProblem(teed.findings);
    if (!row.ran && !salvaged) {
      dropped.push({ voice: row.voice, reason: isText(row.reason) ? row.reason : 'it did not run' });
      continue;
    }
    const v = row.ran ? row : { ...row, ran: true, salvaged: true, result: { findings: [] }, rulings: [] };
    if (salvaged) notes.push(`${v.voice}: the wrapper did not answer (${isText(row.reason) ? row.reason : 'it did not run'}), so the envelope at ${v.envelope} was read and its findings carry no checker ruling`);
    const model = isText(v.model) ? v.model : modelOf(v.voice);
    if (!model) return refuse('run-no-model', `the run file records no model for ${v.voice}, and the record owes one`);
    const verdicts = new Map();
    for (const r of v.rulings) if (!verdicts.has(r.index)) verdicts.set(r.index, r.ruling);
    // a provider voice is judged on its envelope; a local voice on what its reviewer returned
    const env = isText(v.envelope) ? providerFindings(v, envelopes.get(v.voice) || null) : null;
    if (env && env.drop) {
      dropped.push({ voice: v.voice, reason: env.drop });
      continue;
    }
    const findings = env ? env.findings : v.result.findings;
    if (env) {
      const disk = env.source === 'envelope' ? envelopes.get(v.voice) : v;
      const redactions = Number.isSafeInteger(disk.redactions) && disk.redactions > 0 ? disk.redactions : undefined;
      const warnings = Array.isArray(disk.warnings) ? disk.warnings.filter(isText).slice(0, 20).map((w) => w.slice(0, 300)) : [];
      providers.push({ voice: v.voice, source: env.source, ...(redactions ? { redactions } : {}), ...(warnings.length ? { warnings } : {}) });
      if (env.note) notes.push(env.note);
      for (const s of env.stray) notes.push(`${s.voice}: ${s.reason} (${s.file}:${s.line})`);
    }
    const block = { voice: v.voice, model, returned: env ? { findings } : v.result, rulings: /** @type {any[]} */ ([]) };
    findings.forEach((finding, index) => {
      counts.raised += 1;
      const at = env ? env.from[index] : index;
      const done = isPlainObject(finding)
        ? settle(finding, at >= 0 && verdicts.has(at) ? verdicts.get(at) : null, answerFor(v.voice, index), env && env.orphan[index] ? env.orphan[index] : undefined)
        : { ok: false, why: 'is not a finding object' };
      if (!done.ok || !done.item) {
        counts.unruled += 1;
        unruled.push({ voice: v.voice, index, file: finding && finding.file, line: finding && finding.line, reason: done.why });
        return;
      }
      const item = done.item;
      counts[item.ruling] += 1;
      block.rulings.push({
        finding: index,
        ruling: item.ruling,
        claim: finding.claim,
        failure_scenario: finding.failure_scenario,
        ...(item.ruling === 'refuted' ? { counter_evidence: item.counter_evidence } : {}),
        ...(item.fix_commit !== undefined ? { fix_commit: item.fix_commit } : {}),
        ...(item.fix_file !== undefined ? { fix_file: item.fix_file } : {}),
        ...(item.overridden ? { overridden: true } : {}),
      });
      if (item.ruling === 'refuted') return;
      // a downgrade shows the checker's lower severity, and a finding it proved higher shows that one; the record keeps the raised one
      const shown = RAISED_SEVERITIES.includes(item.severity)
        && (item.ruling === 'downgraded' || (item.ruling === 'survived' && RANK[item.severity] > RANK[finding.severity]))
        ? item.severity : finding.severity;
      kept.push({ voice: v.voice, finding, item, shown });
      // a blocker its checker proved only high is downgraded and still halts, so the ruling is not what asks for an answer
      if (HALTING_SEVERITIES.includes(shown)
        && item.fix_commit === undefined && item.fix_file === undefined && !item.overridden) {
        needsAnswer.push({ voice: v.voice, index, file: finding.file, line: finding.line, severity: shown, suspected: item.suspected });
      }
    });
    voices.push(block);
  }
  if (voices.length === 0) {
    return refuse('run-no-voice', `no voice ran, so there is nothing to rule on (${dropped.map((d) => `${d.voice}: ${d.reason}`).join('; ') || 'the run held no voices'})`);
  }

  // most severe first, a stable sort so one severity keeps the order the voices returned
  kept.sort((a, b) => RANK[b.shown] - RANK[a.shown]);
  const survivors = kept.map(({ voice, finding, item, shown }) => ({
    file: finding.file,
    line: finding.line,
    severity: shown,
    voices: [voice],
    what_breaks: item.what_breaks,
    why_care: item.why_care,
    what_triggers: item.what_triggers,
    what_proves: item.what_proves,
    // a finding ruled neither opens as suspected and names the next check, which the schema has the checker put in what_proves
    what_uncertain: item.suspected
      ? `Suspected, not proved. The next check: ${item.what_proves.trim()}\n${item.what_uncertain}`
      : item.what_uncertain,
    recommendation: item.recommendation,
  }));

  const payload = { voices };
  const built = buildEntries(payload);
  const cap = (/** @type {any[]} */ list) => list.slice(0, LIST_CAP);
  return {
    ok: true,
    payload,
    review: { raised: counts.raised, survivors },
    summary: {
      counts,
      voices: voices.map((b) => b.voice),
      dropped,
      ...(providers.length ? { providers } : {}),
      ...(notes.length ? { notes: cap(notes) } : {}),
      unruled: cap(unruled),
      ...(unruled.length > LIST_CAP ? { unruled_more: unruled.length - LIST_CAP } : {}),
      needs_answer: cap(needsAnswer),
      ...(needsAnswer.length > LIST_CAP ? { needs_answer_more: needsAnswer.length - LIST_CAP } : {}),
      // whether the record's own grammar takes the payload as it stands, and the first thing it refuses when not;
      // the record asks a settlement of survivors only, so a downgraded blocker or high waits on needs_answer here
      ready: built.ok && needsAnswer.length === 0,
      ...(!built.ok ? { not_ready: built.detail }
        : needsAnswer.length ? { not_ready: `${needsAnswer.length} finding(s) shown at blocker or high have no fix_commit, fix_file or override; an override re-rules the finding survived with overridden: true` } : {}),
    },
  };
}

/** The role labels a workflow agent is billed under besides the rung roles `roleOfAgent` answers. */
export const CHECKER_ROLE = 'review-checker';
export const PROVIDER_ROLE = 'review-provider-wrapper';
/** The one bracket a run bills as when its file gives no rows. */
export const WORKFLOW_ROLE = 'review-workflow';
const OTHER_ROLE = 'workflow-agent';

/** A figure the host reported, or undefined so the key is left off. @param {any} v */
const figure = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : undefined);

/**
 * The rows of a run file that are agents.
 * @param {any} run @returns {any[]}
 */
export function agentRows(run) {
  const rows = isPlainObject(run) && Array.isArray(run.workflowProgress) ? run.workflowProgress : [];
  return rows.filter((r) => isPlainObject(r) && r.type === 'workflow_agent');
}

/**
 * The role an agent row is billed under: the script's label first, then the rung agent it ran as.
 * @param {any} row @returns {string}
 */
export function roleOfRow(row) {
  const label = typeof row.label === 'string' ? row.label : '';
  if (label.startsWith('checker ')) return CHECKER_ROLE;
  if (label.startsWith('provider ')) return PROVIDER_ROLE;
  return roleOfAgent(row.agentType) || OTHER_ROLE;
}

/**
 * The dispatch and terminal events for one bracket, in the shapes `trace append --event dispatch` and `trace close` write.
 * @param {{phase: string, plan: string, role: string, read: string, reviewer?: string, figures: Record<string, number|string>,
 *   terminal: 'return'|'checkpoint', detail?: string}} b
 * @returns {{plan: string, dispatch: Record<string, any>, terminal: Record<string, any>}}
 */
function bracket(b) {
  const common = { phase: b.phase, family: 'lifecycle', plan: b.plan, role: b.role, ...(b.reviewer ? { reviewer: b.reviewer } : {}) };
  return {
    plan: b.plan,
    dispatch: { ...common, event: 'dispatch', read: [b.read] },
    terminal: { ...common, event: b.terminal, ...b.figures, ...(b.detail ? { detail: b.detail } : {}) },
  };
}

/**
 * One bracket per agent row. The worker key carries the run id, so a second run in one phase can't fold into the first.
 * An agent that did not finish is a checkpoint naming its state, and still bills what it spent.
 * A `role` on `at` bills every row under it, as the analyzer arm does for its readers.
 * @param {any} run @param {{phase: string, runId: string, payloadRef: string, role?: string}} at
 */
export function agentBrackets(run, at) {
  return agentRows(run).map((row, i) => {
    const id = isText(row.agentId) ? row.agentId : `agent${i + 1}`;
    const role = at.role || roleOfRow(row);
    const label = typeof row.label === 'string' ? row.label : '';
    const state = typeof row.state === 'string' ? row.state : 'unknown';
    /** @type {Record<string, any>} */
    const figures = {};
    for (const [key, v] of [['tokens', row.tokens], ['turns', row.toolCalls], ['duration_ms', row.durationMs]]) {
      if (figure(v) !== undefined) figures[key] = v;
    }
    if (isText(row.agentId)) figures.agent_id = row.agentId;
    return bracket({
      phase: at.phase, plan: `${at.runId}-${id}`, role, read: at.payloadRef, figures,
      ...(role === 'cad-reviewer' && label.startsWith('reviewer ') ? { reviewer: label.slice('reviewer '.length) } : {}),
      terminal: state === 'done' ? 'return' : 'checkpoint',
      ...(state === 'done' ? {} : { detail: `the workflow agent was in state "${state}", not done` }),
    });
  });
}

/**
 * The one bracket for a run whose file gave no per-agent rows, carrying the notice's totals and saying why it is one.
 * @param {{phase: string, runId: string, payloadRef: string, role?: string, why: string,
 *   totals: {tokens?: number, turns?: number, duration_ms?: number}}} at
 */
export function noticeBracket(at) {
  /** @type {Record<string, any>} */
  const figures = {};
  for (const [key, v] of Object.entries(at.totals)) if (figure(v) !== undefined) figures[key] = v;
  return bracket({
    phase: at.phase, plan: `${at.runId}-notice`, role: at.role || WORKFLOW_ROLE, read: at.payloadRef, figures,
    terminal: 'return',
    detail: `the run's totals from the completion notice, because ${at.why}`,
  });
}
