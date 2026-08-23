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
