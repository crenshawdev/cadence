// @ts-check
// why-record.mjs - the RECORD readers `/cad-why` joins a commit through
// (WHY-01, phase 1 plan 2). Text in, data out: no disk, no git, no emit, no
// exit, no `Date`, no randomness - the mold `lib/adjudication-record.mjs`
// states for a classifier a seam calls, and the pure half of the split
// `lib/phase-plans.mjs` keeps against `lib/risk-diff.mjs`. Every I/O decision
// belongs to `lib/why-corpus.mjs`, and every refusal sentence to `why.mjs`.
//
// WHY THESE READERS ARE NEW RATHER THAN CALLS. Nothing in
// `lib/planning-files.mjs` parses a SUMMARY's `## Commits` table today -
// `cadence-core/workflows/undo.md` reads it BY MODEL - so the commit-to-plan-task
// edge, which CONTEXT D-08 makes the authoritative one, has no machine reader
// at all. The three readers below sit beside that module rather than inside it
// because this phase changes nothing on the write side (D-12): `parsePlanFiles`
// keeps its exact current behaviour because `plan-overlap` depends on it, and
// `parseSummarySnippets` keeps merging `## Deviations` with `## Open items`
// because the BM25 corpus wants both.
//
// SECTIONS ARE BOUND BY `sectionSpan`, NEVER BY `split(/^## /m)`. That idiom -
// which `lib/planning-files.mjs`'s own private `sectionBody` still uses for the
// recall corpus - is fence-BLIND: a fenced `## ` line inside a summary ends the
// section early and every row after it disappears silently. `sectionSpan` feeds
// one never-restarted fence scanner over the whole document, which is the
// defect class SHP-01 closed for `## Shipped`, and the reason a start found
// fence-blind cannot be repaired by a fence-aware end.
//
// TWO MEASURED GRAMMAR FACTS BIND THE COMMITS TABLE (D-08, D-17).
//
//   1. The Task cell is NOT an integer. `fix`, `fix 1`, `fix 2` and `fix 3` all
//      appear in shipped summaries - a `risk_surface` blocker fix carries the
//      round it belongs to rather than a task number - so the cell is carried
//      as the record's OWN string and never passed through `Number()`. A
//      reader that integerized it would silently attribute three review fixes
//      to task 0.
//   2. The abbreviation width varies by ERA: 7 characters across every archived
//      summary on disk, 8 in v3.5.9's. So a commit match is a case-insensitive
//      PREFIX test in EITHER direction (`shaMatches`) against a full
//      40-character sha, never a fixed-width slice of one.
//
// AND THE COLUMN SET VARIES TOO, which is why the header row is READ rather
// than counted: 25 of the 26 archived tables carry `| Plan | Task | Commit |
// Description |`, and `_archive-v2.5.0/2/SUMMARY.md` carries a three-column
// `| Task | Commit | Description |` from before plans were numbered. Mapping by
// POSITION would read that summary's task cell as its plan and its commit cell
// as its task - a wrong join rather than a missing one, which is the failure
// this whole command exists to stop reporting.
//
// A ROW WHOSE COMMIT CELL IS NOT HEXADECIMAL IS SKIPPED - the disposition
// `parseArchiveRows` takes on a line that does not match, so a note or a
// hand-written summary line inside the table mints no edge.
'use strict';

import {
  normalize, parseContextDecisions, planTaskTitles, sectionBound, sectionSpan,
} from './planning-files.mjs';
import { RULINGS } from './adjudication-record.mjs';

/** The heading whose table carries the commit-to-plan-task edge (D-08). */
export const COMMITS_HEADING = '## Commits';

/** A commit cell as an auditor can spend it: `git show <cell>`. */
const HEX = /^[0-9a-fA-F]+$/;

/**
 * The four columns this reader wants, each by the header text that names it.
 * `Plan` is optional - the three-column era predates it - and its absence
 * yields `plan: ''` rather than a shifted read.
 */
const COLUMNS = Object.freeze({ plan: 'plan', task: 'task', commit: 'commit', description: 'description' });

/**
 * Do two commit ids name the same commit?
 *
 * Case-insensitive, and a PREFIX test in EITHER direction, because the corpus
 * holds abbreviations of two different widths and the chain holds full
 * 40-character shas (D-17). Both sides must be hexadecimal and non-empty: a
 * blank cell prefixes everything, which would attach one row to every commit
 * in the chain.
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
 *
 * Split on UNESCAPED pipes and unescape what survives, so a description
 * carrying a literal `\|` - the escaping `milestone-prune` writes into its own
 * rows - stays one cell instead of becoming two. No table in this repository's
 * `## Commits` sections uses it today; the rule is here because the row it
 * would silently split is a row this command would then attribute to the wrong
 * commit.
 * @param {string} line @returns {string[]}
 */
function cells(line) {
  const parts = line.trim().split(UNESCAPED_PIPE);
  if (parts.length && parts[0].trim() === '') parts.shift();
  if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map((c) => c.replace(/\\\|/g, '|').trim());
}

/**
 * The `## Commits` table of one SUMMARY.md, as rows carrying the plan cell,
 * the task cell, the commit cell and the description cell - each VERBATIM, as
 * the record wrote it.
 *
 * An absent section, an absent header row and a table whose header names no
 * `Commit` column all yield `[]`: nothing was read, which is a different answer
 * from a table that was read and held no conforming row, but this reader's
 * caller treats both as "this summary contributes no edge" and says so with its
 * own words rather than borrowing a null from here.
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

// ---------------------------------------------------------------------------
// THE DECISION EDGE (D-10).
//
// An entry reaches its `D-NN` by EXPLICIT TEXTUAL CITE and by nothing else.
// Nothing in a PLAN.md or a SUMMARY.md structurally references a decision - the
// template's `## Context` is free prose, and a structured cite on the write side
// is work this phase excludes - so the only honest edge is the one the author
// actually typed. Three scopes, in order, and each SAYS which one it is:
//
//   task   the body of the task the commits table attributed the commit to
//          names a D-NN. The narrowest true answer.
//   plan   the plan's `## Context` section names one, but that task's body does
//          not. True of the plan, not of the task, and labelled that way.
//   phase  neither does, so the phase's whole decision set is printed under a
//          PHASE-SCOPED label. Never an empty result and never a task-level
//          edge the record does not carry: an empty answer would read as "no
//          decision governed this", which is a claim the corpus cannot support.
//
// THE DECISIONS THEMSELVES START AT `parseContextDecisions`, which already
// reads `## Durable decisions` first with the documented `## Decisions`
// fallback, and whose header states why that fallback must test
// `durable === null` rather than falsiness. That grammar is not restated here.
//
// BUT IT IS NOT THE WHOLE SET, AND THIS COMMAND NEEDS THE WHOLE SET.
// `parseContextDecisions` is the DURABLE-ONLY recall surface: `## Decisions` is
// its LEGACY fallback, read only when the durable heading is absent entirely.
// Measured over this repository on 2026-08-23, that heading is present in 27 of
// 27 CONTEXT files, so the fallback never fires and 243 of the corpus's 435
// decision bullets - 56% - are unreachable through it. They are unreachable by
// design for BM25 recall, where a phase-local decision must not be injected
// into a later phase's planning; they are exactly the wrong thing to drop here,
// where the user asked about ONE file and the phase-local decision is the
// answer. `.planning/_archive-v2.2.0/3/CONTEXT.md` is the case in one file:
// D-01 to D-04 are durable, D-05 to D-16 are phase-local, and the plan's task 3
// cites D-08 - the sibling-manifest rule that is the whole reason
// `release-bump.mjs` reads the way it does.
//
// So `contextDecisions` below UNIONS the two, durable first, de-duplicated by
// id so the legacy single-section file yields each decision once. It adds no
// second spelling of either heading's grammar: the durable half is still
// `parseContextDecisions`, and the `## Decisions` half is bound by the same
// fence-aware `sectionSpan` every other reader in this module uses.
//
// TASK BODIES ARE CUT ON `planTaskTitles`'S OWN BOUNDARIES. The anchored
// `### Task <n>:` grammar already exists in `lib/planning-files.mjs` and a
// second spelling of it is exactly the drift that rule was written against, so
// `planTaskBodies` below uses that function as the AUTHORITY for how many tasks
// a plan has and what they are called, and cuts the text at the heading lines
// it agrees with. When the two disagree about the count - a `### Task foo`, a
// heading inside a fence - it attributes NOTHING rather than attributing
// wrongly, and the caller falls back to the plan scope, which is a true
// statement about a coarser thing.
//
// THE TASK CELL MAPS TO AN ORDINAL ONLY WHEN IT IS A PLAIN INTEGER. `fix 1`,
// `fix 2` and `fix 3` are real cells in shipped summaries and name a review-fix
// round, not a task; they resolve to no body, and the answer degrades to the
// plan scope by saying so.
// ---------------------------------------------------------------------------

/** A decision id as CONTEXT.md and the plans that cite it spell it. */
const DECISION_TOKEN = /\bD-\d+(?:\.\d+)?\b/g;

/** The plan section whose cites are plan-scoped rather than task-scoped. */
export const PLAN_CONTEXT_HEADING = '## Context';

/**
 * Every distinct `D-NN` token in `s`, in first-occurrence order.
 * @param {string} s @returns {string[]}
 */
export function decisionTokens(s) {
  const seen = new Set();
  for (const m of String(s || '').matchAll(DECISION_TOKEN)) seen.add(m[0]);
  return [...seen];
}

/**
 * The `### Task <n>:` chunks of one PLAN file, in file order.
 *
 * `body` runs from the heading to the next task heading, or to the next
 * column-0 `## ` section - `## Notes` after the last task is not part of it -
 * whichever comes first. The `## ` bound comes from `sectionBound`, so a fenced
 * `## ` inside a task body cannot end it early.
 *
 * `[]` when `planTaskTitles` and the heading lines disagree about how many
 * tasks there are: no attribution beats a wrong one.
 *
 * @param {string} text one PLAN file's bytes
 * @returns {Array<{ordinal: number, title: string, heading: string, body: string}>}
 */
export function planTaskBodies(text) {
  const src = normalize(String(text || ''));
  const lines = src.split('\n');
  const titles = planTaskTitles(src);
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('### Task')) starts.push(i);
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

/** The second decision section, phase-local by construction (see the header). */
export const PHASE_DECISIONS_HEADING = '## Decisions';
/** A decision bullet, as `parseContextDecisions` reads one. */
const DECISION_BULLET = /^- (D-\d+(?:\.\d+)?)\b/;

/**
 * Every decision one CONTEXT.md carries: the durable set `parseContextDecisions`
 * returns, then the phase-local `## Decisions` bullets it deliberately does
 * not, de-duplicated by id with the durable spelling winning.
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
 * The CONTEXT lines the cited ids name, in the ids' own cite order. A cited id
 * CONTEXT does not carry is STATED rather than dropped - a plan citing a
 * decision the context file never recorded is a gap in the record, and this
 * command exists to show those.
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

// ---------------------------------------------------------------------------
// THE DEVIATION EDGE, AND THE GAP IT HAS TO NAME (D-09).
//
// A SEPARATE READER FROM `parseSummarySnippets`, which merges `## Deviations`
// with `## Open items` for the BM25 corpus and cannot tell them apart
// afterwards. Both are the right answer for their own caller: recall wants
// every bullet a phase left behind, and this command must never print an open
// item as though the plan had been wrong about something. The `[deviation]`
// tag is stripped exactly as that reader strips it, and the template's own
// placeholder prose (`None...`, `<...>`) is skipped for the same reason it is
// there - it is the template speaking, not the phase.
//
// THE EDGE ITSELF DOES NOT EXIST IN MACHINE-READABLE FORM, AND THE OUTPUT SAYS
// SO BY NAME. `cadence-core/workflows/execute.md`, at the paragraph beginning
// "A deviation that REFUTES a numbered context decision", prescribes appending
// ` [corrected by plan-<k> deviation: ...]` to the refuted `D-NN` line in
// CONTEXT.md. Measured across the archived and git-recovered CONTEXT files: 0
// of 792 D-NN lines carry it, and only 6 of 123 `## Deviations` bullets name
// any D-NN at all. So an entry prints the phase's deviation bullets UNJOINED
// and labelled phase-scoped, plus `MARKER_GAP` - a statement, in the output,
// that the marker the write side prescribes is absent from the record.
//
// REPORTING THIS EDGE AS "none" IS REFUSED. "No deviation corrected a decision
// here" and "nothing in this corpus can express that a deviation corrected a
// decision" are different claims, and only the second one is true. Printing the
// first would hide the write-side gap this phase exists to expose - and fixing
// the write side is explicitly out of scope, which is exactly why the gap has
// to be visible from the read side instead of quietly absorbed by it.
// ---------------------------------------------------------------------------

/** The section whose bullets are deviations and nothing else. */
export const DEVIATIONS_HEADING = '## Deviations';

/**
 * The sentence every entry with a resolved phase carries beside its deviation
 * bullets. It names the marker by its literal spelling so a reader can grep the
 * workflow that prescribes it and see for themselves that nothing emits it.
 */
export const MARKER_GAP = 'the `corrected by plan-<k> deviation:` marker '
  + '`workflows/execute.md` prescribes for a deviation that refutes a decision '
  + 'is absent from the whole record, so no deviation below is joined to a '
  + 'decision - the edge is missing on the WRITE side, not empty here';

/** Template prose, not phase content - the same two shapes
 * `parseSummarySnippets` skips. */
const PLACEHOLDER = /^(?:None\b|<)/;

/**
 * One SUMMARY.md's `## Deviations` bullets, `[deviation]` stripped and the rest
 * byte-exact. Column-0 `- ` bullets only, first line of each: a wrapped
 * continuation is the bullet's own tail and `parseSummarySnippets` reads it the
 * same way, so a reader comparing the two sees one convention.
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

// ---------------------------------------------------------------------------
// THE SURVIVING REVIEW FINDING EDGE (D-11).
//
// SUMMARY PROSE IS NOT A VIABLE SOURCE, which is why this reads the JSON
// records instead. Review sections appear in shipped summaries under five
// different one-off spellings, one file each; `## Commits` appears at 26 of 26.
// A reader built on the prose would be a reader of one summary.
//
// SO THE SOURCE IS THE PHASE DIRECTORY'S `ADJUDICATION-*.json` RECORDS, taking
// only entries whose `ruling` is `survived` and quoting that entry's own
// `claim`, `failure_scenario` and `counter_evidence` VERBATIM. The ruling
// vocabulary is `RULINGS` in `lib/adjudication-record.mjs` and is imported
// rather than restated: a second list of the three rulings is a second thing to
// keep in step with the module that defines what a record IS.
//
// AN ENTRY JOINS TO A COMMIT BY RANGE, `base_id..head_id`, and the range
// resolution is the CALLER's (`lib/why-corpus.mjs`), because it needs git and
// this module has none. What is decided here is the degradation: an entry
// missing either id contributes a STATED ABSENCE and an issue code, never a
// silent drop and never a claim that the finding applies. CONTEXT flags the
// both-fields-present assumption as verified on ONE git-recovered record rather
// than across the corpus, so the degradation path is the one that has to exist.
//
// FAIL SOFT HERE, NOT FAIL CLOSED. `lib/adjudication-record.mjs` refuses a
// malformed record outright, and it is right to: it is the WRITER's validator,
// and a record silently missing one finding is the summarizing it exists to
// end. This is a READER, over records written months ago by earlier versions of
// that writer, and refusing the whole file would delete the other findings'
// evidence to punish one entry's shape. So a bad entry is skipped with an
// issue, and a file that will not parse yields one issue and no findings.
// ---------------------------------------------------------------------------

/**
 * The one ruling this command reads, taken POSITIONALLY from the vocabulary
 * that defines it rather than spelled again here - `RULINGS` is frozen and
 * ordered survived, downgraded, refuted, and its first element is the ruling
 * that means the finding was kept. The literal is pinned in
 * `why-record.test.mjs` instead, the hand-maintained-then-compared shape
 * `route-table.json` states its reason for on `risk_surface_categories`: a
 * reorder of that list turns the test red rather than silently changing which
 * findings this command prints.
 */
export const SURVIVED_RULING = RULINGS[0];

/** A non-empty string, or null - so an absent field and a blank one are the
 * same answer to the only question asked of them. */
const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * The survived findings of one adjudication record.
 *
 * `issues` are CODES, not sentences: this module never names the file it was
 * handed, so the caller that opened it writes the warning.
 *
 * @param {string} text one ADJUDICATION-*.json's bytes
 * @returns {{ok: boolean, baseId: string|null, headId: string|null,
 *   survivors: Array<{claim: string, failure_scenario: string,
 *     counter_evidence: string|null, file: string|null, line: number|null,
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
      file: str(e.file),
      line: Number.isInteger(e.line) ? e.line : null,
      severity: str(e.severity),
      baseId: entryBase,
      headId: entryHead,
    });
  }
  return { ok: true, baseId, headId, survivors, issues };
}
