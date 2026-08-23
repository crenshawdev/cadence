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

import { normalize, sectionSpan } from './planning-files.mjs';

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
