// @ts-check
// the record readers /cad-why joins through. Text in, data out; no I/O, git or clock here
// use `sectionSpan`, never `split(/^## /m)`: a fenced `## ` line ends that section early and drops every row after
// the Task cell stays a string, never Number(): `fix 1` is a review-fix round, not task 0
// abbreviations vary by era, so a commit match is a prefix test either way (`shaMatches`)
// the header row is read, not counted: old three-column tables would read the task cell as the plan
// a row whose commit cell isn't hex is skipped, so a hand-written line in the table mints no edge
'use strict';

import {
  normalize, normalizeTaskItem, parseContextDecisions, planTaskTitles, sectionBound, sectionSpan,
} from './planning-files.mjs';
import { fenceScanner } from './text-util.mjs';
import { RULINGS } from './adjudication-record.mjs';
import { covers } from './lease-grammar.mjs';

/** The heading whose table carries the commit-to-plan-task edge. */
const COMMITS_HEADING = '## Commits';

/** A commit cell as an auditor can spend it: `git show <cell>`. */
const HEX = /^[0-9a-fA-F]+$/;

/** The four columns wanted, by header text. `Plan` is optional, since the three-column era predates it. */
const COLUMNS = Object.freeze({ plan: 'plan', task: 'task', commit: 'commit', description: 'description' });

/**
 * Do two commit ids name the same commit?
 * Case-insensitive prefix test either way: the corpus holds abbreviations of two widths and the chain full shas.
 * Both sides must be hex and non-empty, or a blank cell prefixes everything and attaches one row to every commit.
 *
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export function shaMatches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y || !HEX.test(x) || !HEX.test(y)) return false;
  return x.length <= y.length ? y.startsWith(x) : x.startsWith(y);
}

/** A markdown table row: a trimmed line that opens with `|`. */
const TABLE_ROW = /^\s*\|/;
/** A separator row - only pipes, dashes, colons and spaces between them. */
const SEPARATOR_ROW = /^\s*\|[\s|:-]*$/;
/** A cell boundary: a `|` the author did not escape. */
const UNESCAPED_PIPE = /(?<!\\)\|/;

/**
 * One table row's cells, trimmed, with the outer empties dropped.
 * Split on unescaped pipes, then unescape: a description with a literal `\|` (milestone-prune writes it) is one cell,
 * or a split row gets attributed to the wrong commit.
 * @param {string} line @returns {string[]}
 */
function cells(line) {
  const parts = line.trim().split(UNESCAPED_PIPE);
  if (parts.length && parts[0].trim() === '') parts.shift();
  if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map((c) => c.replace(/\\\|/g, '|').trim());
}

/**
 * The `## Commits` table of one SUMMARY.md as rows of plan, task, commit and description cells, each verbatim.
 * An absent section, header row or `Commit` column all yield `[]`, read as "this summary contributes no edge".
 *
 * @param {string} text one SUMMARY.md's bytes
 * @returns {Array<{plan: string, task: string, commit: string, description: string}>}
 */
export function parseCommitRows(text) {
  const lines = normalize(String(text || '')).split('\n');
  const { start, end } = sectionSpan(lines, COMMITS_HEADING);
  if (start === -1) return [];

  /** @type {Record<string, number>|null} */
  let header = null;
  const out = [];
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (!TABLE_ROW.test(line)) continue;
    if (SEPARATOR_ROW.test(line)) continue;
    const cs = cells(line);
    if (!header) {
      /** @type {Record<string, number>} */
      const found = {};
      cs.forEach((c, idx) => {
        const key = c.toLowerCase();
        for (const [name, label] of Object.entries(COLUMNS)) {
          if (key === label && found[name] === undefined) found[name] = idx;
        }
      });
      if (found.commit === undefined) return [];
      header = found;
      continue;
    }
    const at = (/** @type {string} */ name) => {
      const idx = header[name];
      return idx === undefined || cs[idx] === undefined ? '' : cs[idx];
    };
    const commit = at('commit');
    if (!HEX.test(commit)) continue;
    out.push({ plan: at('plan'), task: at('task'), commit, description: at('description') });
  }
  return out;
}

// the decision edge: an entry reaches its D-NN only by an explicit cite, the one the author typed. Three scopes:
//   task   the commit's task body names a D-NN, the narrowest true answer
//   plan   the plan's `## Context` names one but that task's body doesn't: true of the plan, labelled that way
//   phase  neither does, so the phase's whole decision set prints under a phase-scoped label, never an empty result
// parseContextDecisions skips the phase-local `## Decisions` once a durable section exists: right for recall, not here

/** A decision id as a context file and the plans that cite it spell it. */
const DECISION_TOKEN = /\bD-\d+(?:\.\d+)?\b/g;

/** The plan section whose cites are plan-scoped rather than task-scoped. */
const PLAN_CONTEXT_HEADING = '## Context';

/**
 * Every distinct `D-NN` token in `s`, in first-occurrence order.
 * @param {string} s @returns {string[]}
 */
function decisionTokens(s) {
  const seen = new Set();
  for (const m of String(s || '').matchAll(DECISION_TOKEN)) seen.add(m[0]);
  return [...seen];
}

/**
 * The `### Task <n>:` chunks of one PLAN file, in file order.
 * `body` runs from the heading to the next task heading or column-0 `## ` section, whichever comes first;
 * the `## ` bound comes from sectionBound, so a fenced `## ` in a task body can't end it early.
 * `[]` when planTaskTitles and the heading lines disagree on the task count: no attribution beats a wrong one.
 *
 * @param {string} text one PLAN file's bytes
 * @returns {Array<{ordinal: number, title: string, heading: string, body: string}>}
 */
export function planTaskBodies(text) {
  const src = normalize(String(text || ''));
  const lines = src.split('\n');
  const titles = planTaskTitles(src);
  const starts = [];
  const fenced = fenceScanner();
  for (let i = 0; i < lines.length; i++) if (!fenced(lines[i]) && lines[i].startsWith('### Task')) starts.push(i);
  if (!starts.length || starts.length !== titles.length) return [];

  return starts.map((start, k) => {
    const nextTask = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const rest = lines.slice(start + 1, nextTask);
    const nextSection = sectionBound(rest);
    const end = nextSection === -1 ? nextTask : start + 1 + nextSection;
    return {
      ordinal: k + 1,
      title: titles[k],
      heading: lines[start],
      body: lines.slice(start, end).join('\n'),
    };
  });
}

/** The second decision section, phase-local by construction. */
const PHASE_DECISIONS_HEADING = '## Decisions';
/** A decision bullet, as `parseContextDecisions` reads one. */
const DECISION_BULLET = /^- (D-\d+(?:\.\d+)?)\b/;

/**
 * Every decision one context file carries: the durable set parseContextDecisions returns, then the phase-local
 * `## Decisions` bullets it skips, de-duplicated by id with the durable spelling winning.
 * @param {string} text @returns {string[]}
 */
export function contextDecisions(text) {
  const src = normalize(String(text || ''));
  const out = parseContextDecisions(src);
  const seen = new Set(out.map((d) => (d.match(/^(D-\d+(?:\.\d+)?)\b/) || [])[1]).filter(Boolean));

  const lines = src.split('\n');
  const { start, end } = sectionSpan(lines, PHASE_DECISIONS_HEADING);
  if (start === -1) return out;
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(DECISION_BULLET);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push(lines[i].replace(/^- /, ''));
  }
  return out;
}

/** A commits-table Task cell as an ordinal, or null when it names no task. */
function taskOrdinal(cell) {
  return /^\d+$/.test(String(cell || '').trim()) ? Number(String(cell).trim()) : null;
}

/**
 * The decision edge for one chain entry.
 *
 * @param {{planText?: string, contextText?: string, taskCell?: string}} input
 * @returns {{scope: 'task'|'plan'|'phase'|'absent', ids: string[], lines: string[]}}
 */
export function decisionsFor({ planText = '', contextText = '', taskCell = '' } = {}) {
  const decisions = contextDecisions(contextText);

  const bodies = planTaskBodies(planText);
  const ordinal = taskOrdinal(taskCell);
  const body = ordinal === null ? null : bodies.find((b) => b.ordinal === ordinal);
  const taskIds = body ? decisionTokens(body.body) : [];
  if (taskIds.length) return { scope: 'task', ids: taskIds, lines: quote(taskIds, decisions) };

  const lines = normalize(String(planText || '')).split('\n');
  const { start, end } = sectionSpan(lines, PLAN_CONTEXT_HEADING);
  const planIds = start === -1 ? [] : decisionTokens(lines.slice(start + 1, end).join('\n'));
  if (planIds.length) return { scope: 'plan', ids: planIds, lines: quote(planIds, decisions) };

  if (!decisions.length) return { scope: 'absent', ids: [], lines: [] };
  return { scope: 'phase', ids: [], lines: decisions };
}

/**
 * The context lines the cited ids name, in cite order. A cited id the context file lacks is stated, not dropped:
 * a plan citing a decision nobody recorded is a gap in the record, and this command exists to show those.
 * @param {string[]} ids @param {string[]} decisions
 * @returns {string[]}
 */
function quote(ids, decisions) {
  return ids.map((id) => {
    const head = new RegExp(`^${id}\\b`);
    const hit = decisions.find((d) => head.test(d));
    return hit || `${id} - cited here, but the phase's CONTEXT.md carries no such decision`;
  });
}

// the deviation edge, and the gap it has to name.
// not parseSummarySnippets, which merges deviations with open items: an open item must never read as a deviation
// nothing marks a deviation that refuted a decision, though the execute workflow prescribes a `corrected by` marker, so
// entries print the phase's deviations unjoined and phase-scoped, plus `MARKER_GAP` saying the marker is absent
// never report this edge as "none": "no deviation corrected a decision" and "nothing here can say so" differ

/** The section whose bullets are deviations and nothing else. */
const DEVIATIONS_HEADING = '## Deviations';

/** Printed beside every resolved entry's deviation bullets; it spells the marker literally so a reader can grep it. */
export const MARKER_GAP = 'the `corrected by plan-<k> deviation:` marker '
  + '`workflows/execute.md` prescribes for a deviation that refutes a decision '
  + 'is absent from the whole record, so no deviation below is joined to a '
  + 'decision - the edge is missing on the WRITE side, not empty here';

/** Template prose, not phase content: the same two shapes parseSummarySnippets skips. */
const PLACEHOLDER = /^(?:None\b|<)/;

/**
 * One SUMMARY.md's `## Deviations` bullets, `[deviation]` stripped and the rest byte-exact. Column-0 `- ` bullets only,
 * first line of each: a wrapped continuation is the bullet's own tail. Template placeholders are skipped.
 * @param {string} text @returns {string[]}
 */
export function parseDeviations(text) {
  const lines = normalize(String(text || '')).split('\n');
  const { start, end } = sectionSpan(lines, DEVIATIONS_HEADING);
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^-\s+(.*)$/);
    if (!m) continue;
    const raw = m[1].trim();
    if (!raw || PLACEHOLDER.test(raw)) continue;
    out.push(raw.replace(/^\[deviation\]\s*/, ''));
  }
  return out;
}

// the surviving review finding edge.
// it reads the JSON records, not summary prose: review sections appear under five different spellings
// only entries ruled `survived` are taken, with `claim`, `failure_scenario` and `counter_evidence` quoted verbatim
// the caller resolves `base_id..head_id`; an entry missing an id yields an issue code, never a silent drop
// fail soft: records come from older writers, so a bad entry is skipped with an issue, not the file refused
// a survivor with no fix commit is legitimate: below blocker or high it was confirmed and not fixed, so none exists

/** The ruling this command reads, taken from RULINGS by position; a test pins the literal so a reorder goes red. */
export const SURVIVED_RULING = RULINGS[0];

/** A non-empty string, or null, so an absent field and a blank one are the same answer. */
const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * The survived findings of one adjudication record.
 * `issues` are codes, not sentences: this module never names the file, so the caller that opened it writes the warning.
 *
 * @param {string} text one ADJUDICATION-*.json's bytes
 * @returns {{ok: boolean, baseId: string|null, headId: string|null,
 *   survivors: Array<{claim: string, failure_scenario: string,
 *     counter_evidence: string|null, fix_commit: string|null,
 *     file: string|null, line: number|null,
 *     severity: string|null, baseId: string|null, headId: string|null}>,
 *   issues: string[]}}
 */
export function parseAdjudication(text) {
  /** @type {string[]} */
  const issues = [];
  const empty = { ok: false, baseId: null, headId: null, survivors: [], issues };

  let record;
  try {
    record = JSON.parse(String(text || ''));
  } catch {
    issues.push('unparseable-json');
    return empty;
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    issues.push('not-a-record-object');
    return empty;
  }

  const baseId = str(record.base_id);
  const headId = str(record.head_id);
  const entries = Array.isArray(record.entries) ? record.entries : [];
  if (!Array.isArray(record.entries)) issues.push('no-entries-array');

  const survivors = [];
  for (const e of entries) {
    if (e === null || typeof e !== 'object' || Array.isArray(e)) { issues.push('entry-not-an-object'); continue; }
    if (e.ruling !== SURVIVED_RULING) continue;
    const entryBase = str(e.base_id) || baseId;
    const entryHead = str(e.head_id) || headId;
    if (!entryBase || !entryHead) issues.push('survivor-without-a-range');
    survivors.push({
      claim: str(e.claim) || '',
      failure_scenario: str(e.failure_scenario) || '',
      counter_evidence: str(e.counter_evidence),
      // through str like the field above: absent and blank both mean no fix an auditor can spend
      fix_commit: str(e.fix_commit),
      file: str(e.file),
      line: Number.isInteger(e.line) ? e.line : null,
      severity: str(e.severity),
      baseId: entryBase,
      headId: entryHead,
    });
  }
  return { ok: true, baseId, headId, survivors, issues };
}

// the task-attributed declared-files edge.
// beside parsePlanFiles, not instead: its flat union answers "do plans collide", not "which task declared this"
// its Files arm is single-line but over a third of Files lines wrap, so this reader consumes the continuation lines
// same normalization as that arm on purpose: a second cleaning rule is two readers disagreeing about one declaration
// containment is `covers` alone, the predicate the overlap gate and commit-time enforcement already read

/** A task's declared-files line. */
const FILES_LINE = /^\s*-\s*\*\*Files:\*\*\s*(.*)$/;
/** An indented, non-blank line - a continuation of whatever came before it. */
const CONTINUATION = /^\s+\S/;
/** An indented bullet opening a NEW bold field, which ends the continuation. */
const NEXT_FIELD = /^\s*-\s*\*\*/;

/**
 * The paths each task's `- **Files:**` line declares, continuation lines included, attributed to that task.
 * @param {string} text one PLAN file's bytes
 * @returns {Array<{ordinal: number, title: string, files: string[]}>}
 */
export function taskDeclaredFiles(text) {
  return planTaskBodies(text).map(({ ordinal, title, body }) => {
    const lines = body.split('\n');
    const files = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(FILES_LINE);
      if (!m) continue;
      let raw = m[1];
      for (let k = i + 1; k < lines.length; k++) {
        if (!CONTINUATION.test(lines[k]) || NEXT_FIELD.test(lines[k])) break;
        raw += ` ${lines[k].trim()}`;
        i = k;
      }
      for (const part of raw.split(',')) {
        const f = normalizeTaskItem(part);
        // `{...}` is a template placeholder, the skip `parsePlanFiles` takes.
        if (f && !f.startsWith('{') && !files.includes(f)) files.push(f);
      }
    }
    return { ordinal, title, files };
  });
}

/**
 * Which of a plan's tasks declared the queried path, and by which declaration (a directory lease can claim it).
 * @param {string} text one PLAN file's bytes @param {string} path repo-relative
 * @returns {Array<{ordinal: number, title: string, declaration: string}>}
 */
export function declaringTasks(text, path) {
  const out = [];
  for (const task of taskDeclaredFiles(text)) {
    const declaration = task.files.find((f) => covers(f, path));
    if (declaration) out.push({ ordinal: task.ordinal, title: task.title, declaration });
  }
  return out;
}
