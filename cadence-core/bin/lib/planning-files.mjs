// @ts-check
// planning-files.mjs - format-pinned parsers/writers for the .planning file
// set. This is the ONLY place a .planning grammar lives (cursor, ROADMAP
// phases, REQUIREMENTS traceability, UAT items). A format change is one
// function here + its tests; workflow prose never describes file mechanics.
// Zero-dep: node: builtins only. Consumed by bin/planning.mjs and its tests.
'use strict';

import { writeFileSync, renameSync, lstatSync } from 'node:fs';
import { isRefusedSpelling } from './lease-grammar.mjs';

// The cursor's only permitted Status values (references/conventions.md).
export const CURSOR_STATUSES = [
  'ready to plan', 'context gathered', 'planned', 'executed',
  'phase complete', 'paused',
];

// ---------------------------------------------------------------------------
// STATE.md - the 4-line cursor.
// ---------------------------------------------------------------------------

/**
 * Parse the canonical 4-line cursor. Returns null when any line is missing
 * or malformed - callers degrade, never guess.
 * @param {string} text
 */
export function parseCursor(text) {
  const m = (re) => { const r = text.match(re); return r ? r : null; };
  const phase = m(/^Phase:\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)\s+\((.+)\)\s*$/m);
  const status = m(/^Status:\s*(.+?)\s*$/m);
  const next = m(/^Next:\s*(.+?)\s*$/m);
  const updated = m(/^Updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!phase || !status || !next || !updated) return null;
  return {
    phase: Number(phase[1]), total: Number(phase[2]), name: phase[3],
    status: status[1], next: next[1], updated: updated[1],
  };
}

/**
 * Render the canonical cursor - exactly four lines under `# State`.
 * @param {{phase:number,total:number,name:string,status:string,next:string,updated:string}} c
 */
export function renderCursor(c) {
  return `# State\n\nPhase: ${c.phase} of ${c.total} (${c.name})\n` +
    `Status: ${c.status}\nNext: ${c.next}\nUpdated: ${c.updated}\n`;
}

// ---------------------------------------------------------------------------
// ROADMAP.md - the `## Phases` checkbox list.
// ---------------------------------------------------------------------------

const PHASE_LINE = /^- \[( |x)\] \*\*Phase (\d+(?:\.\d+)?): (.+?)\*\*(?:\s*-\s*(.*))?$/;

/**
 * Parse the `## Phases` list. Returns phases sorted numerically (decimal
 * insertions like 2.1 sort between 2 and 3), or [] when the section is
 * missing/empty - the caller decides whether that is fatal.
 *
 * The text is normalized on the way in (parse path only - `normalize`'s own
 * comment reserves this for the roadmap grammar): a CRLF checkout parses to
 * real phases instead of to `[]`. Nothing is written back here; `setPhaseBox`
 * and `phase-done` still rewrite the raw bytes. That asymmetry is why this
 * uses `normalizeCrlf` and NOT `normalize`: a lone-CR file must stay
 * unparseable, or the write paths that split raw bytes on `\n` corrupt it.
 *
 * BOTH ends come from `sectionSpan` (D-02/D-10), never from a `split` on the
 * heading: the fence-blind form read the FENCED example in the shipped
 * `templates/ROADMAP.md` as the real section and returned two phantom `[Name]`
 * phases, and with a fenced example ABOVE a real section it stopped at the
 * example's closing `## `, making the real phases invisible rather than merely
 * joined. Fixing only the end bound cannot repair a start found inside a fence,
 * which is why `sectionSpan` returns the two together and why the fix has to
 * land HERE and not only in `classifyPhaseList`, which delegates its canonical
 * parse to this function. A fenced heading is skipped silently and the walk
 * continues to the next unfenced `## Phases` (D-12) - no new issue code, the
 * `classifyAcceptanceCriteria` precedent.
 *
 * One accepted widening: `sectionSpan` matches a heading by TRIMMED equality
 * where `/^## Phases\s*$/m` allowed trailing whitespace only, so a heading
 * indented up to three spaces now matches. CommonMark reads that as a heading
 * and no shipped grammar document forbids it.
 * @param {string} text
 */
export function parseRoadmapPhases(text) {
  const lines = normalizeCrlf(text).split('\n');
  const { start, end } = sectionSpan(lines, '## Phases');
  if (start < 0) return [];
  // Fresh scanner from the heading: the heading itself was matched outside a
  // fence, so nothing is open here. A fenced example INSIDE the real section
  // mints no phase - the same silence D-12 gives a fenced heading, and the only
  // reading under which `classifyPhaseList` cannot report `live` off lines it
  // simultaneously refuses to raise an issue for.
  const fenced = fenceScanner();
  const phases = [];
  for (let i = start + 1; i < end; i++) {
    if (fenced(lines[i])) continue;
    const m = lines[i].match(PHASE_LINE);
    if (m) phases.push({ n: Number(m[2]), name: m[3], desc: m[4] || '', checked: m[1] === 'x' });
  }
  return phases.sort((a, b) => a.n - b.n);
}

// The name the cursor carries between milestones - `parseCursor` requires a
// non-empty name group, so the closed state needs a stated spelling rather
// than an empty string. Lives here with the rest of the cursor grammar.
export const CLOSED_CYCLE_NAME = 'no active cycle';

// The phase TOKEN: capitalized `Phase` plus a number, the same token
// shiftPhaseTokens/findProsePhaseRefs already treat as THE phase reference in
// this codebase. Lowercase `phase 2` is prose and stays prose.
const PHASE_TOKEN = /\bPhase (\d+(?:\.\d+)?)\b/;

/**
 * Classify the `## Phases` section. This is a CLASSIFIER over the section,
 * NOT a wider phase parser: `PHASE_LINE` above is byte-identical and still
 * decides what counts as a phase for `status`, `audit`, `phase-done` and the
 * cursor's `total` (D-01). Stated in full at
 * `cadence-core/references/roadmap-phases.md`.
 *
 * Pure and total: no I/O, no throw, no filesystem (D-05) - a surviving
 * `phases/<N>/` directory is corroboration `cmdStatus` computes, never part
 * of this verdict. Rules, in order:
 *
 *   1. `normalizeCrlf(text)` first - parse path only, never written back, and
 *      CRLF only: a lone-CR file stays one giant line and falls out at
 *      `no-section`, which is what keeps the roadmap write paths from
 *      corrupting a file they cannot split.
 *   2. No `## Phases` heading OUTSIDE a fence -> `no-section`. The heading is
 *      located by `sectionSpan`, the same call `parseRoadmapPhases` makes, so
 *      the two cannot disagree about which occurrence is the real one; a
 *      fenced heading is skipped silently and the walk continues (D-12).
 *   3. Parse the CANONICAL extent (heading to the next `## `, today's bound)
 *      with `parseRoadmapPhases`; one or more matches -> `live` with those
 *      phases and no issues. A near-miss beside a real checkbox list is
 *      deliberately NOT reported: the checkbox list is the phase set.
 *   4. Otherwise scan the CLASSIFICATION extent - the heading to END OF TEXT,
 *      deliberately wider than the canonical bound (D-03) - for the phase
 *      token, SKIPPING fenced lines: a phase token inside somebody's code
 *      block is an example, and reporting it would make every project whose
 *      ROADMAP carries a formatting example fail a check it passes (D-12).
 *      Any match -> `out-of-grammar`, at most one issue per line, code
 *      by the line's shape, EXCEPT a line that already matches `PHASE_LINE`,
 *      which is `phase-outside-section` (right shape, wrong section - it can
 *      only reach here from past the canonical bound). No match -> `closed`.
 *
 * The two extents differ on purpose: bounding the scan at the next `## ` is
 * what would let a wiped checkbox list with intact `### Phase N:` details
 * under `## Phase Details` read as a cleanly closed milestone.
 * @param {string} text
 * @returns {{state: string, phases: ReturnType<typeof parseRoadmapPhases>, issues: Issue[]}}
 */
export function classifyPhaseList(text) {
  const lines = normalizeCrlf(text).split('\n');
  const { start: heading } = sectionSpan(lines, '## Phases');
  if (heading === -1) return { state: 'no-section', phases: [], issues: [] };

  const phases = parseRoadmapPhases(text);
  if (phases.length) return { state: 'live', phases, issues: [] };

  /** @type {Issue[]} */
  const issues = [];
  // Fresh scanner from the heading, exactly as `classifyAcceptanceCriteria`
  // does and for the same reason: the heading was matched outside a fence, so
  // nothing is open here. The extent still runs to END OF TEXT - only the
  // fenced lines inside it are skipped, so the wiped-list-with-surviving-
  // details case D-03 protects still reports.
  const fenced = fenceScanner();
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
    if (fenced(line)) continue;
    if (!PHASE_TOKEN.test(line)) continue;
    let code = 'phase-prose-line'; // the catch-all: out of grammar, never silent
    // A byte-perfect canonical entry reaching here is in the WRONG SECTION, not
    // the wrong shape - the canonical extent above found no phases, so this line
    // sits past the next `## `. Shape-only classification would call it
    // `phase-bullet`, whose fix ("rewrite as the canonical entry") is a no-op on
    // a line that already is one. Checked first: shape tests cannot tell these
    // apart.
    if (PHASE_LINE.test(line)) code = 'phase-outside-section';
    else if (/^#{1,6}\s/.test(line)) code = 'phase-heading';
    else if (/^\s*[-*+]\s/.test(line)) code = 'phase-bullet';
    else if (/^\s*\d+[.)]\s/.test(line)) code = 'phase-ordered-item';
    else if (/^\s*\|/.test(line)) code = 'phase-table-row';
    issues.push({ line: i + 1, code, text: issueText(line) });
  }
  if (issues.length) return { state: 'out-of-grammar', phases: [], issues };
  return { state: 'closed', phases: [], issues: [] };
}

// ---------------------------------------------------------------------------
// REQUIREMENTS.md - the Traceability table.
// ---------------------------------------------------------------------------

/**
 * Parse traceability rows: [{id, phase, status}]. `phase` is null when the
 * cell names no phase (a dropped requirement - audit's concern, not an
 * error here).
 *
 * BOTH ends of the section come from `sectionSpan` (D-08), the same
 * fence-aware reader `parseRoadmapPhases` and `classifyActiveSection` already
 * take their spans from, and exactly the extent `setReqStatus` and
 * `insertReqRows` now write with, so the reader and the two writers of this one
 * table cannot disagree about where it is. A table under any later `## `
 * section is somebody else's data.
 *
 * Header and separator rows are skipped. The separator skip is deliberately
 * a BLACKLIST - a cell made only of dashes, colons and spaces, a strict
 * superset of every legal GFM delimiter spelling (`---`, `:---`, `:--:`,
 * `---:`) - and NOT a positive requirement-id whitelist: a genuinely
 * malformed id must still reach audit as a `no-phase` break rather than be
 * silently dropped from the count.
 * @param {string} text
 */
export function parseRequirements(text) {
  const lines = text.split('\n');
  // The LOCATOR is the whole change here (D-08); everything below it - the row
  // regex, the separator blacklist, the phase-cell scan - is untouched.
  //
  // A `split` on the heading carries no fence state, so a FENCED
  // `## Traceability` was read as the real section. That is not a hypothetical
  // shape: the shipped `templates/REQUIREMENTS.md` puts its whole body inside a
  // markdown fence, `## Traceability` included, so a template-seeded project
  // parsed its own documentation's example rows - and `archiveRequirements`,
  // which reads this function, then removed them from inside the code block.
  // Fixing the `split(/^## /m)` end alone could not help: a start found
  // fence-blind cannot be repaired by a fence-aware end, which is why both ends
  // come from one `sectionSpan` walk.
  //
  // One accepted widening (D-14): `sectionSpan` matches a heading by TRIMMED
  // equality where `/^## Traceability\s*$/m` allowed trailing whitespace only,
  // so a heading indented up to three spaces now begins the section. CommonMark
  // reads that as a heading and no shipped grammar document forbids it - the
  // same widening `parseRoadmapPhases` already states as accepted.
  const { start, end } = sectionSpan(lines, '## Traceability');
  if (start < 0) return [];
  const rows = [];
  for (let i = start + 1; i < end; i++) {
    const cells = lines[i].match(/^\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!cells) continue;
    const id = cells[1].replace(/\*/g, '').trim();
    if (!id || id === 'Requirement' || /^[-:\s]+$/.test(id)) continue;
    const phaseM = cells[2].match(/(\d+(?:\.\d+)?)/);
    rows.push({ id, phase: phaseM ? Number(phaseM[1]) : null, status: cells[3].trim() });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// ROADMAP.md / REQUIREMENTS.md - targeted single-line edits. These return the
// whole rewritten text so callers stay pure; nothing else in the file moves.
// ---------------------------------------------------------------------------

// Phase numbers can be decimal (2.1 insertions); a bare `${n}` in a RegExp
// would make the dot a wildcard (`Phase 2.1` matching `Phase 291`).
/** @param {number} n */
const escN = (n) => String(n).replace(/\./g, '\\.');

/**
 * Flip phase N's `## Phases` checkbox. Returns {text, line} (1-indexed) or
 * null when the phase line is not found.
 * @param {string} text @param {number} n @param {boolean} checked
 */
export function setPhaseBox(text, n, checked) {
  const lines = text.split('\n');
  const re = new RegExp(`^- \\[( |x)\\] \\*\\*Phase ${escN(n)}: `);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      lines[i] = lines[i].replace(/^- \[( |x)\]/, `- [${checked ? 'x' : ' '}]`);
      return { text: lines.join('\n'), line: i + 1 };
    }
  }
  return null;
}

/**
 * Set the traceability Status cell for the given REQ-IDs. Only rows whose id
 * is in `ids` change; everything else is byte-preserved. Returns
 * {text, changed:[ids...]}.
 *
 * The section is located by `sectionSpan` (D-08), the same call
 * `parseRequirements` makes, so this writer cannot edit a table its own reader
 * says is not there. A fenced `## Traceability` is not the section: with no
 * unfenced one the text comes back unchanged and `changed` is empty - the
 * answer a document with no Traceability table already got.
 * @param {string} text @param {string[]} ids @param {string} status
 */
export function setReqStatus(text, ids, status) {
  const lines = text.split('\n');
  const changed = [];
  // BOTH ends from one walk. The hand-rolled `inTable` flag this replaces set
  // itself on a fenced heading and then rewrote rows inside somebody's code
  // block; bounding it fence-aware while still finding the start fence-blind
  // would have moved the damage, not stopped it. The D-14 widening rides along:
  // a heading indented up to three spaces now opens the section, where the
  // anchored `/^## Traceability\s*$/` refused it.
  const { start, end } = sectionSpan(lines, '## Traceability');
  if (start < 0) return { text, changed };
  for (let i = start + 1; i < end; i++) {
    const cells = lines[i].match(/^(\|[^|]*\|[^|]*\|)([^|]*)(\|.*)$/);
    if (!cells) continue;
    const id = cells[1].split('|')[1].replace(/\*/g, '').trim();
    if (ids.includes(id)) {
      lines[i] = `${cells[1]} ${status} ${cells[3]}`;
      changed.push(id);
    }
  }
  return { text: lines.join('\n'), changed };
}

// ---------------------------------------------------------------------------
// REQUIREMENTS.md - the `## Active` grammar and the Traceability insert
// path. Stated in full at cadence-core/references/req-traceability.md; this
// section is that grammar's single implementation, the same relationship
// plan-frontmatter.md has to the block above.
// ---------------------------------------------------------------------------

// THE `## Active` bullet grammar - `- **<ID>**: ...`, an optional leading
// checkbox tolerated. Byte-identical to the regex `parseActiveIds` carried
// before `classifyActiveSection` existed: the classifier below REPORTS lines
// outside this grammar, it never widens it (phase-5 D-05).
const ACTIVE_BULLET = /^-\s+(?:\[[ xX]\]\s+)?\*\*([^*]+)\*\*/;

// A requirement id as this project spells one, in both shipped forms: the
// `PREFIX-N` form (`TRI-01`, `GRM-01`) and the v1.3.1 issue form (`#41`). Used
// ONLY to decide whether an out-of-grammar line is worth reporting - a line
// with no id token declares nothing and is ordinary section prose. Deliberately
// UNanchored: it SCANS arbitrary prose, and `isRequirementId` below is the
// anchored question. Do not add anchors here.
const REQ_ID_TOKEN = /\b[A-Z][A-Z0-9]{1,7}-\d+\b|(?:^|[^\w#])#\d+\b/;
const REQ_ID_TOKEN_G = new RegExp(REQ_ID_TOKEN.source, 'g');

// The FULL-STRING form of the same two spellings. `ACTIVE_BULLET` reads any
// bold span as an id (`- **Note**: ...` declares `Note`) and must keep doing
// so - that is what `seed-reqs` treats as declared, and narrowing it would
// change the writer's behavior, the mirror of the reason D-05 refuses to widen
// it. So the narrowing lives HERE instead, as a question `audit` asks before
// letting an id break the verdict: a bold bullet whose span is not id-shaped is
// REPORTED (`active-non-id-bullet`) and never counted.
//
// A letter is required SOMEWHERE in the category, not at its head (PRS-02): a
// real project spells requirements `2FA-01`, `3DS-02` and `A11Y-01`, and the
// head-anchored form refused all three. The 2-8 character length window is
// preserved exactly as it was, by the lookahead rather than by counting inside
// the alternation - `A11Y` carries digits at both of the positions a
// `[A-Z0-9]{1,2}[A-Z][A-Z0-9]{0,6}` form would need the letter to fall in, so
// the length has to be asserted separately from where the letter sits.
//
// A bare `[A-Z0-9]` lead - no letter required at all - stays REFUSED and must
// not be reintroduced. `ACTIVE_BULLET` reads ANY bold span as an id and
// narrowing it is off the table, so this is the ONLY filter standing between a
// bolded date or plan reference (`- **2026-08**: ...`, `- **14-01**: ...`) and
// `audit`'s counts, `unpicked`, and a phantom `orphans.plan_ids` break already
// paid for once.
const REQ_ID_EXACT = /^(?:(?=[A-Z0-9]{2,8}-)[A-Z0-9]*[A-Z][A-Z0-9]*-\d+|#\d+)$/;

/**
 * Is `id` exactly a requirement id, the whole string and nothing else? The
 * admission test for anything that moves `audit`'s arithmetic: `AUTH-01` yes,
 * `2FA-01` yes, `AUTH-01:` no (the colon belongs outside the bold span), `Note`
 * no, `2026-08` no (a category with no letter in it at all).
 * @param {string} id @returns {boolean}
 */
export function isRequirementId(id) {
  return REQ_ID_EXACT.test(id);
}

/**
 * One phase's `### Phase <N>:` detail block, verbatim, or null when the roadmap
 * has no such block.
 *
 * Extracted so the roadmap block readers - `phaseRequirements` and
 * `phaseCriteria` - cannot disagree about where a phase's block ENDS. Two
 * copies of this walk is how a criteria count would silently absorb the next
 * phase's list while the requirement count stopped at the right line.
 *
 * @param {string} body ROADMAP bytes, already through `normalizeCrlf`
 * @param {string|number} phase the caller's own spelling (D-02)
 * @returns {string|null}
 */
function phaseDetailBlock(body, phase) {
  const head = new RegExp(`^### Phase ${String(phase).replace('.', '\\.')}:`, 'm');
  const at = body.search(head);
  if (at < 0) return null;
  const rest = body.slice(at);
  // Search from AFTER this block's own heading line, never from `rest[1]`:
  // `^` under /m matches at index 0, so slicing by one character finds the
  // heading we just matched and yields a one-character block.
  const afterHeading = rest.indexOf('\n') + 1;
  const tail = afterHeading > 0 ? rest.slice(afterHeading) : '';
  const nextHeading = tail.search(/^#{1,3} /m);
  return nextHeading < 0 ? rest : rest.slice(0, afterHeading + nextHeading);
}

/**
 * The requirement ids a phase's ROADMAP detail block names, and its goal line.
 *
 * The grammar is the one `/cad-new-project` writes and `references/roadmap-phases.md`
 * states: a `### Phase <N>: <name>` heading, then a `**Requirements:** ID, ID, ...`
 * line inside that block. Reads the DETAIL section, never the `## Phases`
 * checklist, because the checklist line carries a one-line description and no
 * ids at all.
 *
 * Pure and total: no I/O, no throw. A phase with no detail block, or a block
 * with no `**Requirements:**` line, yields `{found: false, ids: []}` - absence
 * is not zero, and a caller that gated on a count would otherwise read an
 * unwritten roadmap as a small phase.
 *
 * @param {string} text the ROADMAP.md bytes
 * @param {string|number} phase the caller's own spelling (D-02)
 * @returns {{found: boolean, ids: string[], goal: string}}
 */
export function phaseRequirements(text, phase) {
  const body = normalizeCrlf(String(text || ''));
  const block = phaseDetailBlock(body, phase);
  if (block === null) return { found: false, ids: [], goal: '' };

  const reqLine = block.match(/^\*\*Requirements:\*\*(.*)$/m);
  const goalLine = block.match(/^\*\*Goal:\*\*(.*)$/m);
  if (!reqLine) return { found: false, ids: [], goal: goalLine ? goalLine[1].trim() : '' };
  // Deduped: a block naming one id twice is one requirement, and a count that
  // said two would push a phase over a ceiling for a typo.
  const ids = [...new Set(idTokensIn(reqLine[1]).filter(isRequirementId))];
  return { found: true, ids, goal: goalLine ? goalLine[1].trim() : '' };
}

// BOTH live spellings of the roadmap criteria heading, and no third (D-02).
// `templates/ROADMAP.md:28,36` writes the bold, capital-C form; this repo's own
// `.planning/ROADMAP.md` writes the bare lower-c form at all five of its phase
// blocks (10 hits tree-wide, measured 2026-08-14). A parser anchored to the
// template alone reports "no criteria declared" for every phase of the repo
// whose dogfooding proves the seam - and because absence is not zero, it
// reports nothing rather than failing, so that regression would be invisible.
// The bold markers are balanced by construction: `**Success criteria:` is a
// half-written heading, and admitting it would be inventing a third spelling
// nothing writes.
const CRITERIA_HEADING = /^(?:\*\*Success Criteria:\*\*|Success Criteria:)[ \t]*$/im;

// A criterion is a TOP-LEVEL ordered item under that heading. Anchored at
// column 0 on purpose: every wrapped criterion in this repo's roadmap continues
// on an indented line, and a pattern that admitted leading whitespace would
// count a two-line criterion twice and an indented sub-list as criteria.
const CRITERIA_ITEM_G = /^\d+[.)]\s+\S/gm;

/**
 * How many success criteria a phase's ROADMAP detail block declares.
 *
 * The second reader of the roadmap's per-phase grammar, beside
 * `phaseRequirements` and sharing its block extraction exactly. Both heading
 * spellings above are admitted; the items are the numbered list under the
 * heading, bounded with the block at the next `^#{1,3} ` heading, so the
 * following phase's criteria are never counted into this one.
 *
 * Pure and total: no I/O, no throw. Absence is not zero - a block with no
 * criteria heading yields `{found: false, count: 0}`, the same contract
 * `phaseRequirements` states above, because a phase nobody wrote criteria for
 * is not a phase with zero criteria and must never be compared against a floor.
 * A heading carrying its first item on the same line is out of grammar and
 * reads as not-found for the same reason.
 *
 * Fenced lines INSIDE the block are dropped before either the heading or the
 * items are matched. A roadmap that SHOWS the criteria grammar in a fenced
 * example - the shape every template and every doc page writes - would
 * otherwise have the example's numbered items counted as the phase's own and
 * report a compliant phase over its ceiling, which is exactly the false
 * out-of-range this counter exists to make meaningful. The BLOCK BOUNDARY is
 * still `phaseRequirements`'s and still fence-blind (phase 3 D-02): a fenced
 * `### Phase N:` heading can still end a block early, unchanged here.
 *
 * @param {string} text the ROADMAP.md bytes
 * @param {string|number} phase the caller's own spelling (D-02)
 * @returns {{found: boolean, count: number}}
 */
export function phaseCriteria(text, phase) {
  const block = phaseDetailBlock(normalizeCrlf(String(text || '')), phase);
  if (block === null) return { found: false, count: 0 };
  // One scanner over the block, fence delimiters dropped with their contents,
  // so a fenced example neither mints the heading nor contributes items.
  const fenced = fenceScanner();
  const defenced = block.split('\n').filter((line) => !fenced(line)).join('\n');
  const heading = defenced.match(CRITERIA_HEADING);
  if (!heading || heading.index === undefined) return { found: false, count: 0 };
  const after = defenced.slice(heading.index + heading[0].length);
  return { found: true, count: (after.match(CRITERIA_ITEM_G) || []).length };
}

/**
 * The `### Task <n>: <name>` headings in one PLAN's bytes, in file order.
 *
 * Anchored to the heading level `templates/PLAN.md` writes, so a `## Tasks`
 * section heading is not a task and a `#### ` sub-bullet under one is not
 * either. Pure and total.
 * @param {string} text @returns {string[]} the task titles
 */
export function planTaskTitles(text) {
  return [...normalizeCrlf(String(text || '')).matchAll(/^### Task\s+[\d.]+\s*:?\s*(.*)$/gm)]
    .map((m) => m[1].trim());
}

/** Every requirement-id token in `s`, its leading delimiter stripped. */
function idTokensIn(s) {
  return [...s.matchAll(REQ_ID_TOKEN_G)].map((m) => m[0].slice(m[0].search(/[A-Z#]/)));
}

// Every bold span on a line, in order. `ACTIVE_BULLET` reads only the FIRST,
// so this is what makes a second one visible rather than silent.
const BOLD_SPAN_G = /\*\*([^*]+)\*\*/g;

/** Every bold span in `s` AFTER the first, trimmed. */
function trailingBoldSpans(s) {
  return [...s.matchAll(BOLD_SPAN_G)].slice(1).map((m) => m[1].trim());
}

/**
 * Classify the `## Active` section: the ids it declares, plus the lines that
 * LOOK like they declare one but fall outside `ACTIVE_BULLET`. This is a
 * CLASSIFIER, not a wider parser - `ACTIVE_BULLET` above is byte-identical to
 * the shipped regex and still decides what `seed-reqs` and `audit` treat as a
 * declared id (D-05). Pure and total: no I/O, no throw.
 *
 * Rules, in order:
 *
 *   1. Split the RAW text on `\n` - deliberately NOT through
 *      `normalize`/`normalizeCrlf`, unlike the roadmap grammar. REQUIREMENTS.md
 *      has write paths (`insertReqRows`, `setReqStatus`) that split raw bytes,
 *      the same asymmetry `normalizeCrlf`'s own comment states, and a CRLF file
 *      already parses here because every bold span closes before the `\r`.
 *   2. No `## Active` line OUTSIDE a fence -> `{ids: null, issues: []}`. An
 *      absent heading is NOT an out-of-grammar report: it is the datum
 *      `audit`'s `no_active_section` already carries, and every project
 *      scaffolded before v1.4.0 is in that state (D-06). A FENCED heading is
 *      skipped silently and the walk continues to the next unfenced one (D-12),
 *      never a new issue code - the shipped `templates/REQUIREMENTS.md` has no
 *      `## Active` but the one inside its own template block, and read
 *      fence-blind it declared the example's `[CAT]-01`/`[CAT]-02` and reported
 *      three `active-non-id-bullet` issues against its own documentation.
 *   3. Otherwise walk from that heading to the next `^## ` - BOTH ends from
 *      `sectionSpan`, so a fenced `## ` inside the section can no longer end it
 *      early, and `## Deferred` is still never read (D-07). Fenced lines in
 *      between are skipped whole: a fenced example bullet neither declares an
 *      id nor raises an `active-prose-line`/`active-non-id-bullet`. A line
 *      matching `ACTIVE_BULLET` contributes its trimmed bold span as an id
 *      (de-duplicated first-occurrence-wins, empty skipped). It produces an
 *      issue ONLY when that span is not id-shaped by `isRequirementId`
 *      (`active-non-id-bullet`) - see the sharp edge below.
 *   4. Every other line is scanned for `REQ_ID_TOKEN`. No token, no issue. A
 *      token yields at most ONE issue for that line, code by the line's shape,
 *      each naming the actual cause and implying a remedy that changes it:
 *        - `^\s*\|`            -> `active-table-row`
 *        - a bullet marker with LEADING WHITESPACE -> `active-indented-bullet`
 *          (a sub-bullet or continuation; the grammar reads column-0 bullets
 *          only, so bolding it changes nothing - it has to move to column 0)
 *        - a column-0 `*`/`+` marker -> `active-nondash-bullet` (legal GFM,
 *          but the grammar reads `-` only)
 *        - a column-0 `-` bullet whose id is not in a bold span immediately
 *          after the marker -> `active-unbolded-bullet`
 *        - `^\s*\d+[.)]\s`     -> `active-ordered-item`
 *        - `^#{1,6}\s`         -> `active-heading`
 *        - anything else       -> `active-prose-line`
 *   5. The entry-shaped codes fire REGARDLESS of how many bullets parsed -
 *      deliberately unlike `classifyPhaseList`'s near-miss suppression, because
 *      a table row or an unbolded bullet beside real bullets is the mixed
 *      authoring case this diagnostic exists to catch (an id half-declared).
 *      `active-prose-line` is the one conditional code, on two counts: the
 *      section must declare ZERO ids ADMISSIBLE to `isRequirementId` - the same
 *      question the arithmetic asks, so a section whose only bullet declares no
 *      admissible id cannot silence its own prose (an ordinary intro paragraph
 *      beside a REAL bullet list still stays quiet) - AND the line must name at least
 *      one id that appears NOWHERE else in the file. A closed milestone's
 *      `## Active` ("No active milestone. `v1.2.0` shipped its scope (REV-01,
 *      ...) - see `## Shipped`") names only ids the file already records, so
 *      nothing is lost and nothing is reported; a section that opens a
 *      milestone in prose names ids the file records nowhere, and is still
 *      never silent.
 *
 * The sharp edge the unchanged grammar keeps, and where it is now blunted: a
 * BOLD span that is not id-shaped is still READ as an id - `- **Note**: ...`
 * declares `Note` - because narrowing `ACTIVE_BULLET` would change what
 * `seed-reqs` treats as declared, the mirror of the reason D-05 refuses to
 * widen it. So `ids` still carries it and `parseActiveIds` is unchanged, but it
 * is reported as `active-non-id-bullet`, and `audit` admits only `isRequirementId`
 * ids into its `unpicked` break. Without that admission test every project with
 * a prose bold-bullet in `## Active` (`- **Note**: scope frozen`) would start
 * FAILing its audit on upgrade, by a phantom id name.
 * @param {string} text
 * @returns {{ids: string[]|null, issues: Issue[]}}
 */
export function classifyActiveSection(text) {
  const lines = text.split('\n');
  // Both ends from one never-restarted scanner: a start found fence-blind
  // cannot be repaired by a fence-aware end, and `elsewhere` below slices on
  // exactly these two indices, so recomputing either would let the prose filter
  // disagree with the walk about where the section is.
  const { start: heading, end } = sectionSpan(lines, '## Active');
  if (heading === -1) return { ids: null, issues: [] };

  const ids = [];
  const seen = new Set();
  /** @type {Array<{issue: Issue, prose: string[]|null}>} */
  const found = [];
  // Fresh scanner from the heading: it was matched outside a fence, so nothing
  // is open here.
  const fenced = fenceScanner();
  for (let i = heading + 1; i < end; i++) {
    const line = lines[i];
    if (fenced(line)) continue;
    const m = line.match(ACTIVE_BULLET);
    if (m) {
      const id = m[1].trim();
      if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
      // In grammar, but the span is not an id: reported, never counted.
      if (id && !isRequirementId(id)) {
        found.push({ issue: { line: i + 1, code: 'active-non-id-bullet', text: issueText(line) }, prose: null });
      }
      // A SECOND id-shaped bold span on the same bullet. `ACTIVE_BULLET` reads
      // only the first, so the rest would vanish with `issues: []` - the silent
      // under-read this grammar exists to prevent. Reported, never counted:
      // widening the grammar to take every bold span is the fix that looks
      // obvious and mints an id out of ordinary emphasis
      // (`- **GRM-01**: the **core** path` would declare `core`), which is the
      // same silent failure pointed the other way. Only id-SHAPED extra spans
      // are reported, so emphasis costs nothing.
      const extra = trailingBoldSpans(line).filter(isRequirementId);
      if (extra.length > 0) {
        found.push({ issue: { line: i + 1, code: 'active-multi-id-bullet', text: issueText(line) }, prose: null });
      }
      continue;
    }
    if (!REQ_ID_TOKEN.test(line)) continue;
    let code = 'active-prose-line'; // the catch-all: outside the grammar, never silent
    if (/^\s*\|/.test(line)) code = 'active-table-row';
    else if (/^\s*[-*+]\s/.test(line)) {
      // Name the cause, not the family: an indented bullet is unread because it
      // is indented (bolding it changes nothing), and a `*`/`+` bullet because
      // the grammar reads `-` only. Only a column-0 `-` bullet is genuinely a
      // bullet whose id is not bolded where the grammar looks for it.
      if (/^\s/.test(line)) code = 'active-indented-bullet';
      else if (/^[*+]\s/.test(line)) code = 'active-nondash-bullet';
      else code = 'active-unbolded-bullet';
    } else if (/^\s*\d+[.)]\s/.test(line)) code = 'active-ordered-item';
    else if (/^#{1,6}\s/.test(line)) code = 'active-heading';
    found.push({
      issue: { line: i + 1, code, text: issueText(line) },
      prose: code === 'active-prose-line' ? idTokensIn(line) : null,
    });
  }
  // Prose candidates survive only in a section that declared nothing AND only
  // when they name an id the rest of the file does not already record - a
  // closed milestone's "shipped X, Y - see `## Shipped`" paragraph is correct
  // as written and must not be nagged at. The filter runs at the end, so the
  // surviving issues stay in line order.
  // Narrowed by `isRequirementId` deliberately: "the section declared ids" has
  // to mean the same thing here as in the arithmetic. Against the raw bullet
  // list a single `- **Note**: scope frozen` declares an id, and silenced the
  // whole section's prose - a section carrying no admissible id at all went
  // quiet on the strength of a prose bullet.
  const declared = ids.filter(isRequirementId);
  const elsewhere = declared.length === 0
    ? new Set(idTokensIn(lines.slice(0, heading).concat(lines.slice(end)).join('\n')))
    : null;
  const issues = found
    .filter((f) => !f.prose || (elsewhere !== null && f.prose.some((id) => !elsewhere.has(id))))
    .map((f) => f.issue);
  return { ids, issues };
}

/**
 * Parse the `## Active` section's committed-scope bullets: every
 * `- **<ID>**: ...` line (an optional leading checkbox tolerated), ids
 * trimmed and de-duplicated first-occurrence-wins. Returns `null` - NOT
 * `[]` - when the heading is ABSENT, so a caller can tell "no milestone
 * scope declared" from "declared, nothing matched": the same
 * `=== null`-not-`!body` warning `parseContextDecisions` carries above,
 * because a present-but-empty heading yields `[]`, which is falsy-adjacent
 * but not absent. A bullet with no bold span declares no id BY DESIGN - no
 * fallback that guesses an id out of unbolded prose; `classifyActiveSection`'s
 * `issues` is what makes such a line visible instead of silent. A bold span
 * that is not id-shaped IS still an id here (`- **Note**: ...` -> `Note`) -
 * this is `seed-reqs`' declared-id set and it does not change; the
 * `active-non-id-bullet` issue reports it, and `audit` filters it out of the
 * arithmetic with `isRequirementId`.
 *
 * Delegates so the id extraction has exactly ONE implementation and
 * `seed-reqs`' declared-id set cannot drift from `audit`'s.
 * @param {string} text @returns {string[]|null}
 */
export function parseActiveIds(text) {
  return classifyActiveSection(text).ids;
}

/**
 * Insert `## Traceability` rows for `rows: [{id, phase}]` that have no row
 * yet, at Status `Pending` - the literal string, NOT a parameter: the seam
 * must be incapable of creating a row at any other status, which is what
 * keeps "no writer but cad-verify ever writes a non-`Pending` Status" true
 * by construction.
 *
 * The section is located and bounded by `sectionSpan`, exactly as
 * `parseRequirements`/`setReqStatus` already do - a table under a later
 * section is somebody else's data, and a table inside a code FENCE is
 * documentation rather than data. Inside that bound, the header row's
 * all-dashes/colons separator is located; with no separator found, the text
 * is returned UNCHANGED alongside `error: 'no-traceability-table'` - never
 * fabricate a table.
 *
 * Existing ids are read through `parseRequirements(text)`, so the reader and
 * the writer of this one table cannot drift. An id that already has a row is
 * pushed to `skipped`; when that row's Phase cell differs from the requested
 * one, it is ALSO pushed to `mismatched` as `{id, row_phase}` - a renumber or
 * a moved requirement leaving the row pointing elsewhere must not pass as a
 * clean skip.
 *
 * New rows land after the LAST contiguous line starting with `|` at or below
 * the separator (the empty-table case lands directly under the separator
 * itself), so a trailing prose paragraph under the table survives byte
 * identical. Each row renders as `| ${id} | Phase ${phase} | Pending |` -
 * the `Phase N` spelling is mandatory: `shiftPhaseTokens` shifts only
 * `Phase K` tokens and `phases/K/` paths, and `renumber remove`'s
 * orphan-blanking regex tests `\bPhase ${at}\b`, so a bare-number phase cell
 * would silently desync the whole table on the next phase insert or removal.
 * The anchor line's line ending is preserved - a CRLF anchor gets a CRLF row -
 * since this is a write path and normalize() stays off write paths (D-05).
 * @param {string} text @param {Array<{id: string, phase: number}>} rows
 * @returns {{text: string, inserted: string[], skipped: string[], mismatched: Array<{id: string, row_phase: number|null}>, error?: string}}
 */
export function insertReqRows(text, rows) {
  const lines = text.split('\n');
  // BOTH ends from `sectionSpan` (D-08) rather than this function's own
  // heading test plus `/^## /` bound: the fence-blind start took the
  // `## Traceability` inside `templates/REQUIREMENTS.md`'s own markdown fence
  // for the section and `seed-reqs` then wrote rows into the example. The
  // absent-outside-a-fence case is the one this function already answers -
  // text back unchanged, carrying `no-traceability-table` - and it must stay
  // that answer: this seam never fabricates a table. D-14's widening applies
  // here too, an indented heading now being admissible.
  const { start, end } = sectionSpan(lines, '## Traceability');
  if (start === -1) {
    return { text, inserted: [], skipped: [], mismatched: [], error: 'no-traceability-table' };
  }

  // The separator: a `|`-bounded row whose every cell is only dashes,
  // colons and whitespace - a strict superset of every legal GFM delimiter
  // spelling, the same blacklist parseRequirements uses to skip it.
  let sepLine = -1;
  for (let i = start + 1; i < end; i++) {
    if (!lines[i].startsWith('|')) continue;
    const cells = lines[i].split('|').slice(1, -1);
    if (cells.length >= 2 && cells.every((c) => /^[-:\s]+$/.test(c))) { sepLine = i; break; }
  }
  if (sepLine === -1) {
    return { text, inserted: [], skipped: [], mismatched: [], error: 'no-traceability-table' };
  }

  const existing = new Map(parseRequirements(text).map((r) => [r.id, r]));
  const inserted = [], skipped = [], mismatched = [];
  const toInsert = [];
  for (const { id, phase } of rows) {
    const row = existing.get(id);
    if (row) {
      skipped.push(id);
      if (row.phase !== phase) mismatched.push({ id, row_phase: row.phase });
      continue;
    }
    inserted.push(id);
    toInsert.push({ id, phase });
  }
  if (!toInsert.length) {
    return { text, inserted, skipped, mismatched };
  }

  let anchor = sepLine;
  for (let i = sepLine + 1; i < end; i++) {
    if (lines[i].startsWith('|')) anchor = i;
    else break;
  }
  const eol = lines[anchor].endsWith('\r') ? '\r' : '';
  const newLines = toInsert.map(({ id, phase }) => `| ${id} | Phase ${phase} | Pending |${eol}`);
  lines.splice(anchor + 1, 0, ...newLines);
  return { text: lines.join('\n'), inserted, skipped, mismatched };
}

// ---------------------------------------------------------------------------
// Recall corpus snippets - item-level strings pulled from SUMMARY/CAPTURE/
// CONTEXT for BM25 indexing (bin/planning.mjs cmdRecall). Absence of a
// section is data, never a throw; template placeholders (`None...`, `<...>`)
// are not indexable content and are skipped.
// ---------------------------------------------------------------------------

/**
 * Isolate one `## Heading` section's body, cut at the next `## ` heading -
 * the same idiom parseRoadmapPhases uses. Null when the heading is absent.
 * @param {string} text @param {string} heading
 */
function sectionBody(text, heading) {
  const parts = text.split(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (parts.length < 2) return null;
  return parts[1].split(/^## /m)[0];
}

/**
 * SUMMARY.md item-level snippets: the `## Deviations` and `## Open items`
 * bullets, stripped of a leading `[deviation]` tag. Placeholder lines
 * (`None...`, `<...>`) are the template's own prose, not real content.
 * @param {string} text @returns {string[]}
 */
export function parseSummarySnippets(text) {
  const out = [];
  for (const heading of ['Deviations', 'Open items']) {
    const body = sectionBody(text, heading);
    if (!body) continue;
    for (const line of body.split('\n')) {
      const m = line.match(/^-\s+(.*)$/);
      if (!m) continue;
      const raw = m[1].trim();
      if (!raw || raw.startsWith('None') || raw.startsWith('<')) continue;
      out.push(raw.replace(/^\[deviation\]\s*/, ''));
    }
  }
  return out;
}

/**
 * The `## ` sections of CAPTURE.md the recall walk visits, in order, WITHOUT
 * the `## ` prefix.
 *
 * ONE fact, ONE home. `parseCaptureSnippets` below iterates this list and
 * `lib/capture-file.mjs` derives its kind-to-heading map from it instead of
 * restating the names: the writer and the reader disagreeing about which
 * sections are the walk is this queue's headline defect - five filed bullets
 * were lost to exactly that - and it can only recur while the fact is written
 * down in two places.
 *
 * `## Archive` and `## Debt markers` are deliberately NOT here (D-03). The fix
 * for a lost bullet is never "walk every section": that would re-admit 185
 * bullets a milestone triage retired into the BM25 corpus and undo the v2.6.0
 * reconciliation in full.
 *
 * The ORDER is load-bearing - `capture-file.mjs` maps its three kinds onto
 * these three names positionally, and its per-kind rows are what turn red if
 * the order moves.
 */
export const CAPTURE_WALK_SECTIONS = Object.freeze(['Todos', 'Seeds', 'Notes']);

/**
 * The leading phase tag on a CAPTURE.md bullet, anchored at the head of the
 * text AFTER the checkbox strip. Four admitted shapes and nothing more:
 * `(phase N)`, `(v3.2.0 phase N)`, `(phase N, label)` and their combination
 * `(v3.2.0 phase N, label)`, where the version prefix is a `v` and
 * dot-separated digits, `N` is an integer or a decimal `N.M`, and the label is
 * everything after the comma up to the closing paren.
 *
 * DELIBERATELY NOT `^\([^)]*\)` (D-05). A leading parenthetical that does not
 * match this pattern is CONTENT: 24 live bullets carry `(cadence-wide)` or
 * `(tooling)` as their only scope marker, `(v3.2.0 close)` names a milestone
 * rather than a phase, and `parseCaptureSnippets` feeds BM25 directly - so a
 * greedy strip would eat the only word those bullets can be found by.
 *
 * The prose home of this grammar is `cadence-core/references/capture-grammar.md`
 * (the same way `parseRoadmapPhases` points at `references/roadmap-phases.md`),
 * and every shape it states - admitted and out-of-grammar - is pinned by a row
 * in the `CAPTURE_TAG_ROWS` table in `cadence-core/bin/planning-files.test.mjs`.
 */
const CAPTURE_PHASE_TAG = /^\((?:v\d+(?:\.\d+)*\s)?phase (\d+(?:\.\d+)?)(?:,[^)]*)?\)\s*/;

/**
 * CAPTURE.md item-level snippets: every `- ` bullet under the sections
 * `CAPTURE_WALK_SECTIONS` names, with a leading checkbox and phase tag
 * stripped - the
 * tag becomes the numeric `phase` field (omitted when the bullet carries no
 * tag; decimal phase numbers are legal). `CAPTURE_PHASE_TAG` above states
 * which parentheticals are tags and which are content.
 *
 * An admitted tag is stripped WHOLE - tag and trailing space - so a version
 * token or a label riding inside a real tag leaves the indexed text. That is
 * the trade, not an oversight: the alternative keeps the remainder and so
 * synthesizes bullet text nobody wrote, needing a second rule for the case
 * where the remainder is empty. 32 bullets tagged `(vX.Y.Z phase N)` stop
 * carrying their version as a BM25 term and gain a correct phase field, which
 * is what recall renders and what a planner filters on.
 *
 * ANY checkbox state is stripped (`[ ]`, `[x]`, `[X]`), and stripped BEFORE
 * the `(phase N)` extraction, which a checked box used to block - a closed
 * capture lost its phase attribution and kept `[x]` in the indexed text.
 * Completed captures stay in the corpus rather than being skipped or
 * de-weighted (D-04): a closed item carries the reasoning that produced the
 * fix, which is exactly the prior evidence recall exists to surface.
 *
 * A closed capture is marked with a literal `[closed] ` prefix on the text
 * (D-05). The signal rides the string rather than growing a `done` field on
 * the result shape: without a marker a planner reads a shipped fix as live
 * prior evidence and re-plans closed work.
 *
 * THE NUMBER MUST ROUND-TRIP: `String(Number(n)) === n`, or the tag emits no
 * `phase` AND stays in the indexed text, byte-identical, exactly as an
 * out-of-grammar parenthetical does. A bare `Number()` put `Infinity` into the
 * recall corpus for a 400-digit tag and a NEIGHBOURING phase's number for
 * `9007199254740993` or `1.10` - the same collision `requirePhaseArg` carries
 * a `raw` field for (D-07). The round trip is the predicate rather than
 * `Number.isSafeInteger`, which would strip every legal `1.1` sub-phase tag,
 * and rather than a magnitude bound, which still admits `9007199254740990.1`
 * -> `9007199254740990`, a different phase. Leaving the tag in the text is
 * what keeps the bullet whole in the corpus: it loses no bytes to a
 * parenthetical that named no phase.
 * @param {string} text @returns {Array<{text:string, phase?:number}>}
 */
export function parseCaptureSnippets(text) {
  const out = [];
  for (const heading of CAPTURE_WALK_SECTIONS) {
    const body = sectionBody(text, heading);
    if (!body) continue;
    for (const line of body.split('\n')) {
      const m = line.match(/^-\s+(.*)$/);
      if (!m) continue;
      let raw = m[1].trim();
      if (!raw) continue;
      const box = raw.match(/^\[([ xX])\]\s*/);
      const closed = box ? box[1] !== ' ' : false;
      if (box) raw = raw.slice(box[0].length);
      /** @type {number|undefined} */
      let phase;
      raw = raw.replace(CAPTURE_PHASE_TAG, (whole, n) => {
        // Out of range or otherwise not round-tripping: no phase, and the tag
        // stays in the text rather than the bullet losing bytes to it.
        if (String(Number(n)) !== n) return whole;
        phase = Number(n);
        return '';
      });
      out.push({ text: closed ? `[closed] ${raw}` : raw, ...(phase !== undefined ? { phase } : {}) });
    }
  }
  return out;
}

/**
 * Census of EVERY `## ` section in a CAPTURE.md: its name, its bullet count,
 * and whether `parseCaptureSnippets` visits it. In document order.
 *
 * UNCONDITIONAL, with NO allowlist (D-06). The obvious shape - exempt the two
 * sections everyone expects to be out of the walk - would have reported nothing
 * on the incident this exists for: all five lost bullets sat under `## Archive`.
 * A section being out of the walk by design is the READER's judgment to make
 * from a stated count, not this function's to suppress.
 *
 * `heading` is the section name WITHOUT its `## ` prefix, the same spelling
 * `CAPTURE_WALK_SECTIONS` uses, so `in-walk` is a membership test and not a
 * string transform. A bullet is the same line shape `parseCaptureSnippets`
 * indexes - a column-0 `- ` with something after it - so the count of an
 * in-walk section is the number of snippets that section contributes.
 *
 * Fence-aware, because a fenced `## Debt markers` inside somebody's `## Todos`
 * bullet is an EXAMPLE, and minting a section from it would report a phantom
 * out-of-walk heading on a healthy queue. Pure reader, so it normalizes through
 * the shared `normalize` (BOM, CRLF and lone CR): nothing here writes text back,
 * and a CRLF checkout must count exactly as its plain-LF twin.
 *
 * Stated limit: a bullet ABOVE the first `## ` heading belongs to no section
 * and is not counted anywhere. The walk cannot see it either, but there is no
 * heading to name it under, and no writer in this codebase can produce one.
 * @param {string} text
 * @returns {Array<{heading: string, bullets: number, inWalk: boolean}>}
 */
export function captureSections(text) {
  /** @type {Array<{heading: string, bullets: number, inWalk: boolean}>} */
  const out = [];
  const fenced = fenceScanner();
  /** @type {{heading: string, bullets: number, inWalk: boolean}|null} */
  let cur = null;
  for (const line of normalize(text).split('\n')) {
    if (fenced(line)) continue;
    const h = line.match(/^## (.*)$/);
    if (h) {
      const heading = h[1].trim();
      cur = { heading, bullets: 0, inWalk: CAPTURE_WALK_SECTIONS.includes(heading) };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const b = line.match(/^-\s+(.*)$/);
    if (b && b[1].trim()) cur.bullets++;
  }
  return out;
}

/**
 * CONTEXT.md item-level snippets: the `- D-NN (...): ...` lines under
 * `## Durable decisions` - the durable-only recall surface (D-02). Falls
 * back to `## Decisions` ONLY when the durable heading is absent entirely
 * (a pre-v1.2 legacy file, D-03): `sectionBody` returns `null` when a
 * heading is missing but can return `""` when it is present-but-empty (the
 * empty string arises only when the heading is the last thing in the file;
 * otherwise it returns at least a residual `"\n"`, which is still truthy).
 * The fallback must test `durable === null` (or use `??`, which coalesces
 * only nullish) - NOT `!durable` / `durable || ...`, which would wrongly
 * treat a present-but-empty `""` durable section as absent and fall through
 * to `## Decisions`, resurfacing phase-local decisions.
 * @param {string} text @returns {string[]}
 */
export function parseContextDecisions(text) {
  const durable = sectionBody(text, 'Durable decisions');
  const body = durable === null ? sectionBody(text, 'Decisions') : durable;
  if (!body) return [];
  const out = [];
  for (const line of body.split('\n')) {
    if (/^- D-\d+(?:\.\d+)?\b/.test(line)) out.push(line.replace(/^- /, ''));
  }
  return out;
}

// ---------------------------------------------------------------------------
// ARCHIVE.md - the recall residue a milestone close leaves behind (RCL-07).
//
// A close removes `.planning/phases/<N>/`, and with it every SUMMARY deviation,
// UAT item and CONTEXT decision that phase produced: the corpus above is
// reachable only while the phase directory is live, so the record Cadence
// writes in order to be remembered stopped being reachable at exactly the
// moment the work retired. The residue is a top-level `.planning/ARCHIVE.md`
// written BEFORE the directories go (D-01), carrying the SAME snippets the live
// walk indexes rather than a distillation of them (D-03).
//
// The grammar has ONE home, here, in the module that already owns every other
// corpus parser - and for the reason `CAPTURE_WALK_SECTIONS` above states in
// full. `cmdMilestonePrune` writes this file and `cmdRecall` reads it: that is
// a writer/reader pair over one walk, which is the exact arrangement whose
// split-brain cost five filed bullets. So the parser and the appender sit
// beside each other and share the two patterns below.
// ---------------------------------------------------------------------------

/**
 * One residue row: a column-0 `- `, the ORIGIN path in backticks, a colon, a
 * space, then the snippet to end of line.
 *
 * The path is fully constrained - `phases/<n>/` and one of the three indexed
 * filenames, `<n>` an integer or a decimal `N.M`, the same phase-number shape
 * `cmdRecall`'s directory filter admits - and that is what lets the snippet
 * carry a backtick, a colon or a pipe with no second escaping rule: the closing
 * backtick is found by position, and nothing after `: ` is parsed at all.
 */
const ARCHIVE_ROW = /^- `(phases\/(\d+(?:\.\d+)?)\/(?:SUMMARY|UAT|CONTEXT)\.md)`: (.*)$/;

/** A column-0 `## ` heading opens a milestone section; its label is the rest. */
const ARCHIVE_SECTION = /^## (.*)$/;

/**
 * The preamble an empty residue file is created with. It names the writer and
 * the reader because this file has exactly one of each, and a human who finds
 * it in a repository has no other way to learn that. It carries a `# ` title
 * and deliberately NO column-0 `## ` heading, so no part of it can be read as a
 * milestone section by the parser below.
 */
const ARCHIVE_PREAMBLE = `# Archive: the recall residue of closed milestones

Written by \`planning.mjs milestone-prune\` before it removes a phase directory,
read by \`planning.mjs recall\` beside CAPTURE.md. One section per closed
milestone, one \`- \` row per snippet, each row naming the artifact it came from.
A line that is not a row is skipped, so a note added here mints no recall entry.
`;

/**
 * ARCHIVE.md rows in document order, as the `{text, source, phase}` shape
 * `cmdRecall` already builds its corpus from.
 *
 * `source` is the milestone label and the origin path joined by a slash
 * (`v3.5.2/phases/1/SUMMARY.md`), so one result names both the artifact that
 * produced the snippet (D-04) and the milestone that retired it, while the
 * rendered contract stays exactly four fields wide - `phase` keeps the meaning
 * every live row gives it rather than being spent on the label.
 *
 * A line that does not match `ARCHIVE_ROW` is not a row and is skipped, the
 * posture `parseContextDecisions` takes on a non-`D-NN` line, so a human note in
 * this file cannot mint a corpus entry. A row above the first `## ` heading
 * belongs to no milestone and is skipped for the same reason. A row whose phase
 * number does not ROUND-TRIP (`String(Number(n)) !== n`) is skipped by the same
 * rule: `phases/<400 digits>/` and `phases/9007199254740990.1/` name a
 * directory nothing in this tree can address, and a bare `Number()` put
 * `Infinity` and a NEIGHBOURING phase's number into the corpus instead. The
 * round trip rather than `Number.isSafeInteger`, which would drop every legal
 * `phases/1.1/` row, and the declared `phase: number` return shape stays as it
 * is rather than widening to `number|null`, which `cmdRecall`'s corpus and the
 * `alreadyArchived` set would both have to learn.
 *
 * Pure reader, so it normalizes through the shared `normalize` (BOM, CRLF, lone
 * CR) exactly as `captureSections` does: a CRLF checkout must index as its
 * plain-LF twin.
 * @param {string} text
 * @returns {Array<{text: string, source: string, phase: number, label: string, origin: string}>}
 */
export function parseArchiveRows(text) {
  const out = [];
  /** @type {string|null} */
  let label = null;
  for (const line of normalize(text).split('\n')) {
    const h = line.match(ARCHIVE_SECTION);
    if (h) { label = h[1].trim(); continue; }
    if (label === null) continue;
    const m = line.match(ARCHIVE_ROW);
    if (!m) continue;
    if (String(Number(m[2])) !== m[2]) continue;
    // `label` and `origin` ride ALONGSIDE the composed `source` rather than
    // being recovered from it by the caller. A milestone label is free text, so
    // a label carrying a `/` makes `source` ambiguous about where the label
    // ends and the path begins, and a caller testing membership with
    // `source.startsWith(label + '/')` then matches a row from a DIFFERENT
    // section (heading `v1/forged` answers a `v1/` test). That test is the
    // containment guard in `cmdMilestonePrune`, and a false positive there
    // suppresses a phase's residue write and then removes its directory. Give
    // the caller the two fields whole; never make it re-split a composed one.
    out.push({ text: m[3], source: `${label}/${m[1]}`, phase: Number(m[2]), label, origin: m[1] });
  }
  return out;
}

/**
 * Land `rows` under `label`'s section in ARCHIVE.md `text` and return the new
 * text. Rows go after that section's LAST row when the label already has a
 * section, so a resumed close extends its own heading instead of minting a
 * second one; otherwise they go into a new section at end of text. Text that is
 * empty gets `ARCHIVE_PREAMBLE` first. Everything not inserted is byte-
 * preserved, and nothing here does I/O or throws.
 *
 * Snippet and label are FLATTENED on write, the discipline `renderUat` states
 * for the same reason: an embedded newline becomes its own line on the next
 * parse, where a snippet's tail is silently skipped and a label's tail splits
 * the heading. Flatten on write, never trust callers. A row whose text is empty
 * after the flatten is dropped rather than written as a row with no snippet -
 * an empty corpus entry ranks against every query and says nothing.
 *
 * @param {string} text @param {string} label
 * @param {Array<{origin: string, text: string}>} rows
 * @returns {string}
 */
export function appendArchiveRows(text, label, rows) {
  const flat = (v) => String(v ?? '').replace(/\s*\n+\s*/g, ' ').trim();
  const emitted = (rows || [])
    .filter((r) => r && flat(r.text))
    .map((r) => `- \`${flat(r.origin)}\`: ${flat(r.text)}`);
  if (!emitted.length) return text;
  const head = flat(label);
  const base = typeof text === 'string' ? text : '';
  if (!base.trim()) return `${ARCHIVE_PREAMBLE}\n## ${head}\n\n${emitted.join('\n')}\n`;

  const lines = base.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(ARCHIVE_SECTION);
    if (h && h[1].trim() === head) { start = i; break; }
  }
  if (start === -1) {
    return `${base}${base.endsWith('\n') ? '' : '\n'}\n## ${head}\n\n${emitted.join('\n')}\n`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (ARCHIVE_SECTION.test(lines[i])) { end = i; break; }
  }
  let last = -1;
  for (let i = start + 1; i < end; i++) if (ARCHIVE_ROW.test(lines[i])) last = i;
  // A section with no row yet takes a blank line with its first one, so the
  // heading keeps the blank the new-section arm gives it.
  lines.splice(last === -1 ? start + 1 : last + 1, 0,
    ...(last === -1 ? ['', ...emitted] : emitted));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CONTEXT.md - the `## Acceptance criteria` grammar. Stated in full at
// cadence-core/references/acceptance-criteria.md; this section is that
// grammar's single implementation, and `planning.mjs criteria-coverage` is its
// only consumer.
// ---------------------------------------------------------------------------

// The canonical criterion head: a column-0 dash, a checkbox, the bare `AC<N>`
// token, a colon, then the text. The id is deliberately NOT hyphenated: `AC-01`
// is admitted by `REQ_ID_EXACT` above, so a criterion id pasted into a plan's
// `requirements:` frontmatter would read as a requirement id and mint a phantom
// `orphans.plan_ids` entry in `audit` (D-01). `AC1` is structurally disjoint.
const CRITERION_HEAD = /^- \[( |x|X)\] (AC\d+):[ \t]*(.*)$/;

// A column-0 checkbox bullet, whatever it carries. The `criterion-unidded`
// gate for a bullet that names no id at all - the legacy shape this grammar
// exists to catch.
const CRITERION_BOX = /^- \[[ xX]\]\s/;

// A checkbox bullet whose HEAD POSITION holds something id-shaped that
// `CRITERION_HEAD` refused: a second space, emphasis around the token, a
// lowercase `ac`, a missing colon. Anchored after the checkbox on purpose - an
// id named later in the text (`- [ ] the AC3 pin holds`) is an UNIDDED bullet
// whose prose mentions one, and telling its author to fix a malformed id would
// send them looking for a fault that is not there.
const CRITERION_HEAD_NEAR = /^- \[[ xX]\]\s*\**\s*AC\d+\b/i;

// An `AC<N>` token anywhere on a line. Used ONLY to decide whether an
// out-of-grammar line is worth reporting - a line naming no id declares
// nothing and is ordinary section prose. Unanchored on purpose, the same
// division of labour `REQ_ID_TOKEN` / `isRequirementId` carries above.
const CRITERION_TOKEN = /\bAC\d+\b/;

// An INDENTED bullet whose content starts with an `AC<N>` token (a checkbox
// tolerated between). The one exception to the continuation rule below: a
// criterion bullet that got indented is a criterion the grammar cannot see, so
// it must report rather than be swallowed as continuation prose.
const CRITERION_SUB = /^\s+[-*+]\s+(?:\[[ xX]\]\s+)?AC\d+\b/;

// An `AC<N>` token in DECLARATION POSITION: at the head of the line, after at
// most one list or heading marker, an optional checkbox, and any emphasis or
// code wrapper around the token. This is NOT part of the criterion grammar -
// it pushes nothing and admits nothing - it answers the one narrower question
// `declaresIds` below reports: did the author write an id on this line at all?
//
// Deliberately WIDER than `CRITERION_HEAD_NEAR`, which inspects checkbox
// bullets only. Every out-of-grammar shape can carry a refused id (`### AC1:`,
// `1. AC1:`, `- AC1:`, a backtick-wrapped token), and the only consumer is an
// EXEMPTION that must not claim "this phase declared nothing" while an id sits
// in the text - so this errs toward "declared".
//
// Anchored at the head for the same reason `CRITERION_HEAD_NEAR` is: an id
// named later in a line (`- [ ] the AC3 pin holds`) is prose that mentions an
// id, not a declaration of one, and that bullet is `criterion-unidded`.
const CRITERION_ID_DECLARED = /^\s*(?:[-*+]|#{1,6}|\d+[.)])?\s*(?:\[[ xX]\]\s*)?[*_`]*\s*AC\d+\b/i;

/**
 * A stateful line filter: `true` while the line is a fence marker or sits
 * inside a fenced code block, `false` when it is content. One scanner per walk,
 * fed every line in order.
 *
 * Fence rules follow CommonMark closely enough for the job: up to three spaces
 * of indent, a run of three or more backticks or tildes, and a closer that
 * matches the opener's character, is at least as long, and carries no info
 * string. Shared by `sectionBound` and the acceptance-criteria walk, which had
 * the same bug in two places - a documentation example inside a fence read as
 * live content.
 */
function fenceScanner() {
  /** @type {{char: string, len: number}|null} */
  let fence = null;
  return (/** @type {string} */ line) => {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})\s*(.*)$/);
    if (!f) return fence !== null;
    const char = f[1][0], len = f[1].length;
    if (fence === null) fence = { char, len };
    else if (char === fence.char && len >= fence.len && !f[2].trim()) fence = null;
    return true;
  };
}

/**
 * Classify the `## Acceptance criteria` section of a CONTEXT.md: the criteria
 * it declares as `{id, text}`, plus the lines that LOOK like they declare one
 * and fall outside the canonical head. Pure and total: no I/O, no throw.
 *
 * Rules, in order:
 *
 *   1. Normalize through the shared `normalize` (BOM, CRLF and lone CR) rather
 *      than `normalizeCrlf`. This is a PURE READER: CONTEXT.md has no writer
 *      anywhere in this codebase (D-03) - no seam creates or edits one, only
 *      `parseContextDecisions` reads it - so the roadmap's write-path carve-out
 *      (a lone-CR file must stay unparseable because `setPhaseBox` and friends
 *      split raw bytes) does not apply. Nothing here writes text back.
 *   2. No `^## Acceptance criteria$` line -> `{criteria: null, issues: []}`.
 *      An absent heading is the datum "nothing declared", NOT an
 *      out-of-grammar report - the same absent-heading rule
 *      `classifyActiveSection` uses. CONTEXT.md is itself optional.
 *      The ONE exception: a line that was meant to be that heading and missed
 *      (`## Acceptance Criteria`, `## Acceptance criteria:`, `### Acceptance
 *      criteria`) reports `criteria-heading-near-miss` and still returns
 *      `criteria: null`. Unlike an absent heading, a typo'd one silently drops
 *      declared criteria out of the coverage domain - the section-level twin
 *      of the in-section near-misses below, and reported for the same reason.
 *   3. Otherwise walk from that heading to the next `^## ` or end of text.
 *      A line matching `CRITERION_HEAD` opens a criterion, ids de-duplicated
 *      first-occurrence-wins.
 *   4. An INDENTED, non-blank line while a criterion is open is a
 *      CONTINUATION: appended to that criterion's text joined with one space
 *      and never classified on its own, which is what keeps a wrapped
 *      criterion that happens to name another id silent (the same silence
 *      `classifyActiveSection`'s continuation row pins). The one exception is
 *      `CRITERION_SUB`, reported as `criterion-indented-bullet`. A blank line
 *      or any non-indented line closes the open criterion.
 *   5. Every other line: at most ONE issue, in line order, each
 *      `{line, code, text}` through `issueText`'s trim-and-truncate.
 *        - a column-0 `- [ ]` bullet with no `AC<N>` head -> `criterion-unidded`
 *          (the legacy shape and the central diagnostic)
 *        - the same bullet when the HEAD POSITION does hold an id the canonical
 *          head refused - `- [ ]  AC1: x`, `- [ ] **AC1**: x`, `- [ ] ac1: x`,
 *          `- [ ] AC1 no colon` -> `criterion-malformed-id`. An id named later
 *          in the text is not this: that bullet is unidded and its prose
 *          happens to mention an id
 *        - a second bullet reusing an id -> `criterion-duplicate-id`, reported
 *          and NOT pushed
 *        - an id with no text after the colon -> `criterion-empty-text`, and
 *          the criterion IS still pushed with `text: ''` (parse-then-diagnose,
 *          the `trailing-value-content` precedent: the id is real and must
 *          still reach a UAT item)
 *        - `- AC1: ...` with no checkbox -> `criterion-unboxed-bullet`
 *        - a column-0 `*`/`+` marker -> `criterion-nondash-bullet`
 *        - an indented bullet outside a continuation -> `criterion-indented-bullet`
 *        - `^\s*\d+[.)]\s`  -> `criterion-ordered-item`
 *        - `^#{1,6}\s`      -> `criterion-heading`
 *        - anything else naming an `AC<N>` token -> `criterion-prose-line`
 *   6. The entry-shaped codes fire REGARDLESS of how many criteria parsed -
 *      deliberately unlike `classifyPhaseList`'s near-miss suppression, and
 *      unlike `active-prose-line`'s conditional arm. One idded bullet beside
 *      six bare ones is exactly the mixed-authoring migration case this exists
 *      to catch, and suppressing the codes once anything parsed would hide it.
 *   7. `declaresIds` answers what `criteria` cannot: did this section DECLARE
 *      an `AC<N>` id, whether or not this grammar could read it? `'some'` when
 *      a criterion parsed OR a reported line carries an id in declaration
 *      position (`CRITERION_ID_DECLARED`); `'none'` when nothing did, an
 *      absent heading included; `'unknown'` on a near-miss heading, whose
 *      section is never walked, so what it declares is not known here.
 *      An empty `criteria` is three different data - nothing declared, an id
 *      the grammar REFUSED, or a section it never read - and every consumer
 *      that reasons about "declared nothing" needs them separated. Reported
 *      here rather than re-derived by the caller, which holds only
 *      `issueText`'s truncated copy of each line.
 *
 * Trailing prose after the criterion text, `(human-verify: needs <tool>)`
 * included, is IN grammar and stays in `text` verbatim (D-11): the classifier
 * admits and ignores it, and `workflows/verify.md` keeps its current prose read
 * of that suffix.
 * @param {string} text
 * @returns {{criteria: Array<{id: string, text: string}>|null, issues: Issue[],
 *            declaresIds: 'none'|'some'|'unknown'}}
 */
export function classifyAcceptanceCriteria(text) {
  const lines = normalize(text).split('\n');
  let heading = -1;
  const headingFenced = fenceScanner();
  for (let i = 0; i < lines.length; i++) {
    if (headingFenced(lines[i])) continue;
    if (/^## Acceptance criteria\s*$/.test(lines[i])) { heading = i; break; }
  }
  if (heading === -1) {
    // No exact heading. Before returning "nothing declared", look for a line
    // that was MEANT to be it: a capital C, a trailing colon, a `###`. Without
    // this arm the whole section leaves the coverage domain in silence - every
    // criterion under a typo'd heading is undeclared, every item pointing at
    // one lands in the additive `unknown_criterion`, and the gate stays green.
    // Reported once, on the first near-miss: the section is singular.
    const nearFenced = fenceScanner();
    for (let i = 0; i < lines.length; i++) {
      if (nearFenced(lines[i])) continue;
      if (/^#{1,6}\s*acceptance\s+criteri/i.test(lines[i])) {
        // `declaresIds: 'unknown'`, never `'none'`: the section under that
        // heading is never walked, so this reader has no idea what it declares.
        // An exemption that means "declared nothing" must not be handed a typo.
        return { criteria: null, declaresIds: 'unknown',
          issues: [{ line: i + 1, code: 'criteria-heading-near-miss', text: issueText(lines[i]) }] };
      }
    }
    return { criteria: null, issues: [], declaresIds: 'none' };
  }

  /** @type {Array<{id: string, text: string}>} */
  const criteria = [];
  /** @type {Issue[]} */
  const issues = [];
  const seen = new Set();
  /** @type {{id: string, text: string}|null} The criterion continuations extend. */
  let open = null;
  // A head-shaped bullet whose criterion was NOT pushed (a duplicate id) still
  // absorbs its continuation lines, so a wrapped duplicate reports once for the
  // bullet rather than once more for every line under it.
  let absorbing = false;
  // Fresh scanner from the heading: the heading itself was matched outside a
  // fence, so nothing is open here. A fenced block inside the section is
  // skipped whole - it neither declares a criterion nor bounds the section nor
  // closes an open one. Without this the `- [ ] AC1: ...` line in the grammar's
  // own documentation example parses as a live criterion, minting a phantom id
  // no UAT item can cover: a false FAIL out of a code block.
  const fenced = fenceScanner();
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
    if (fenced(line)) continue;
    if (/^## /.test(line)) break;
    const head = line.match(CRITERION_HEAD);
    if (head) {
      const id = head[2];
      const body = head[3].trim();
      if (seen.has(id)) {
        issues.push({ line: i + 1, code: 'criterion-duplicate-id', text: issueText(line) });
        open = null;
        absorbing = true;
        continue;
      }
      seen.add(id);
      if (!body) {
        issues.push({ line: i + 1, code: 'criterion-empty-text', text: issueText(line) });
      }
      open = { id, text: body };
      criteria.push(open);
      absorbing = false;
      continue;
    }
    if ((open || absorbing) && /^\s/.test(line) && line.trim()) {
      if (CRITERION_SUB.test(line)) {
        issues.push({ line: i + 1, code: 'criterion-indented-bullet', text: issueText(line) });
        continue;
      }
      if (open) open.text = open.text ? `${open.text} ${line.trim()}` : line.trim();
      continue;
    }
    open = null;
    absorbing = false;
    // A checkbox bullet that is not a criterion. Which fault it is depends on
    // whether the head position holds an id at all: reporting `- [ ] **AC1**: x`
    // as `criterion-unidded` names a fix - "add the phase-local id" - that is a
    // no-op on a line whose id is right there.
    if (CRITERION_BOX.test(line)) {
      issues.push({ line: i + 1, text: issueText(line),
        code: CRITERION_HEAD_NEAR.test(line) ? 'criterion-malformed-id' : 'criterion-unidded' });
      continue;
    }
    if (!CRITERION_TOKEN.test(line)) continue;
    let code = 'criterion-prose-line'; // the catch-all: outside the grammar, never silent
    if (/^\s*[-*+]\s/.test(line)) {
      if (/^\s/.test(line)) code = 'criterion-indented-bullet';
      else if (/^[*+]\s/.test(line)) code = 'criterion-nondash-bullet';
      else code = 'criterion-unboxed-bullet';
    } else if (/^\s*\d+[.)]\s/.test(line)) code = 'criterion-ordered-item';
    else if (/^#{1,6}\s/.test(line)) code = 'criterion-heading';
    issues.push({ line: i + 1, code, text: issueText(line) });
  }
  // Rule 7. Every issue in this walk carries `line: i + 1`, so `lines[line - 1]`
  // is its source line as written. Deciding it HERE, against the source, is what
  // keeps the answer independent of `issueText`: `issues[].text` is a display
  // copy, trimmed and capped at 120 characters, so a caller re-scanning it for
  // an id would be reading the report rather than the file. Fenced lines never
  // reach `issues`, so a documented example inside a code block declares nothing
  // here either - exactly as it declares no criterion above.
  const declared = criteria.length > 0
    || issues.some((i) => CRITERION_ID_DECLARED.test(lines[i.line - 1]));
  return { criteria, issues, declaresIds: declared ? 'some' : 'none' };
}

// ---------------------------------------------------------------------------
// UAT.md - the persistent checklist (templates/UAT.md).
// ---------------------------------------------------------------------------

// Item field order in the rendered file - pinned so rewrites are stable.
//
// Registration is what makes a field SURVIVE: `parseUat` accepts any
// `^(\w+):\s*(.+?)\s*$` line, but `renderUat` filters against this whitelist
// and every `uat record` rewrites the whole file, so an unregistered field
// survives `init` and is destroyed by the first `record` (D-05). `criterion`
// and `origin` sit directly after `expected` because that is where a hand-added
// line has to be for the first rewrite not to move it.
const UAT_FIELDS = ['expected', 'criterion', 'origin', 'why_human', 'status',
  'first_pass', 'source', 'evidence', 'reported', 'severity', 'cause', 'fix',
  'reason'];

// The one place the `source` enum lives - where a RESULT came from. `user` is
// IMPLICIT and never written onto an item (an existing checklist stays
// byte-identical), so the two values that ever render are `verifier` (a deep
// pass merged the result) and `model` (the walk ran the check itself and cited
// its command and output). Registration is not optional: `uat record` accepted
// any string and silently stored nothing outside `verifier`, so a
// walk-executed pass was indistinguishable from a user answer with nothing
// reporting the drop.
export const UAT_SOURCES = ['user', 'verifier', 'model'];

// The one place the `origin` enum lives. `criterion` is the criterion-derived
// marker by its own presence, so `origin: criterion` is only ever a repair for
// an item whose link is known-lost; `verifier` and `smoke` are the values that
// declare an item legitimately built from no criterion, and they are the only
// two `criteria-coverage` exempts from `untraced`.
export const UAT_ORIGINS = ['criterion', 'verifier', 'smoke'];

// The POSITIVE marker that a checklist was written by a seam that knows
// `criterion` and `origin`. Inferring "pre-field" from the ABSENCE of both item
// fields is what let a post-field checklist whose links were dropped absolve
// itself, and `.planning/phases/3/UAT.md` (7 `criterion`, 0 `origin`) is the
// file that falsified the old two-field conjunction. Absence of this marker is
// NECESSARY for `criteria-coverage`'s legacy exemption and no longer sufficient:
// the exemption also requires the phase's CONTEXT to declare no `AC<N>` ids,
// because the AC-id grammar post-dates the fields, so a marker-less checklist
// beside declared ids is a dropped link rather than an old file - reported as a
// `fieldless-checklist` break. No writer here can produce the absence either way.
export const UAT_FIELDS_VERSION = '1';
const UAT_FM_FIELDS = ['status', 'phase', 'fields_version', 'sources', 'started', 'updated'];

/**
 * Index of the first `## ` line in `lines` that sits OUTSIDE a fenced code
 * block, or -1 if there is none.
 *
 * The bound cannot be a bare `/^## /` test: a `## build output` line inside a
 * ```sh block truncated the section mid-fence, destroying the closing fence
 * and everything after it, and left an odd fence count so the regenerated
 * `## Summary` rendered as code - contradicting UAT.md's promise (D-02) that a
 * hand-added section survives a seam rewrite verbatim.
 *
 * Fence rules follow CommonMark closely enough for the job: up to three spaces
 * of indent, a run of three or more backticks or tildes, and a closer that
 * matches the opener's character, is at least as long, and carries no info
 * string.
 * EXPORTED for the debt harvest's `CAPTURE.md` section writer (D-12), which
 * rewrites one `## ` section wholesale and needs exactly this rule. A second
 * fence scanner there would drift from this one, and the defect it would
 * reintroduce is the one described above: a bullet whose text carries a fenced
 * block with a `## ` line inside it, truncated mid-fence.
 * @param {string[]} lines
 * @returns {number}
 */
export function sectionBound(lines) {
  const fenced = fenceScanner();
  for (let i = 0; i < lines.length; i++) {
    if (fenced(lines[i])) continue;
    if (/^## /.test(lines[i])) return i;
  }
  return -1;
}

/**
 * BOTH ends of one `## ` section, as absolute indices into `lines`:
 * `{start, end}`, where `start` is the heading's own line and `end` is the next
 * `## ` heading after it (or `lines.length` when the section runs to the end).
 * `start` is -1 when the heading does not occur outside a fence, and `end` is
 * then -1 too.
 *
 * Both ends, one scanner, ONE walk - which is the whole point. `sectionBound`
 * fixed the END only, so a caller still had to find the heading itself, and the
 * obvious `lines.findIndex((l) => l.trim() === heading)` carries no fence state:
 * a fenced EXAMPLE of the heading in an earlier section was taken as the real
 * one, and the rewrite then started inside somebody's code block. Worse than the
 * end-boundary bug it mirrors, because the scan that resumed at that false start
 * read the block's CLOSING fence as an opener and swallowed every heading after
 * it - `.planning/CAPTURE.md` lost `## Seeds` and `## Notes` outright. A start
 * found by a fence-blind test cannot be repaired by a fence-aware end, so the
 * two ends belong in one function and callers get them together.
 * @param {string[]} lines @param {string} heading
 * @returns {{start: number, end: number}}
 */
export function sectionSpan(lines, heading) {
  const fenced = fenceScanner();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    // The scanner is fed EVERY line in order and never restarted, so the fence
    // state at `start` is the state a reader of the whole document would have.
    if (fenced(lines[i])) continue;
    if (start < 0) {
      if (lines[i].trim() === heading) start = i;
      continue;
    }
    if (/^## /.test(lines[i])) return { start, end: i };
  }
  return { start, end: start < 0 ? -1 : lines.length };
}

/**
 * Parse UAT: full frontmatter + items with their field lines. Counts are
 * always recomputed from the items, never read from Summary.
 *
 * An item head is anchored to the FIRST line of its `### ` chunk. A numbered
 * line deeper in a chunk (`1. check the logs` inside a hand-written
 * `### Manual notes`) is prose, not an item, and must never mint one.
 *
 * UAT.md is therefore partly USER-owned (D-02): a `### ` chunk whose first
 * line is not `N. Name` is a hand-added section, returned verbatim in
 * `extras` and re-emitted by renderUat, so the next `uat record` does not
 * destroy it. Items themselves stay machine-owned and append-only.
 * @param {string} text
 */
export function parseUat(text) {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  /** @type {Record<string, string>} */
  const fm = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const f = line.match(/^(\w+):\s*(.+?)\s*$/);
      if (f) fm[f[1]] = f[2];
    }
  }
  const items = [];
  /** @type {string[]} Hand-added `### ` sections, preserved verbatim. */
  const extras = [];
  const parts = text.split(/^### /m).slice(1);
  for (const part of parts) {
    const lines = part.split('\n');
    // Both loops stop at the same bound, and it is fence-aware: a `## ` inside
    // a code block is content, not the start of the next section.
    const bound = sectionBound(lines);
    const body = bound === -1 ? lines : lines.slice(0, bound);
    const head = lines[0].match(/^(\d+)\.\s+(.+?)\s*$/);
    if (!head) {
      // A hand-added section, kept verbatim; trailing whitespace is trimmed so
      // repeated parse/render cycles are byte-stable.
      const extra = `### ${body.join('\n')}`.replace(/\s+$/, '');
      if (extra !== '###') extras.push(extra);
      continue;
    }
    /** @type {Record<string, string|number>} */
    const item = { k: Number(head[1]), name: head[2] };
    for (const line of body.slice(1)) {
      const f = line.match(/^(\w+):\s*(.+?)\s*$/);
      if (f) item[f[1]] = f[2];
    }
    items.push(item);
  }
  const counts = { pass: 0, fail: 0, pending: 0, skipped: 0, blocked: 0 };
  // Own keys only, the idiom lib/trace.mjs's counts loop uses for the same
  // job: `in` walks the prototype, so a hand-written `status: constructor`
  // would pass the guard and turn that count into NaN.
  for (const it of items) if (Object.prototype.hasOwnProperty.call(counts, String(it.status))) counts[String(it.status)]++;
  return { status: fm.status || null, phase: fm.phase || null, fm, items, counts, extras };
}

/**
 * Render a UAT file from frontmatter + items, recomputing the Summary from
 * the items (reworked = items whose first_pass is fail). Round-trips with
 * parseUat.
 *
 * `extras` are the hand-added `### ` sections parseUat preserved (D-02):
 * emitted verbatim between the item blocks and `## Summary`, never
 * flattened, renumbered or reformatted. UAT.md is partly user-owned this
 * way; items remain machine-owned and append-only.
 * @param {{fm: Record<string,string>, items: Array<Record<string,string|number>>, extras?: string[]}} uat
 */
export function renderUat({ fm, items, extras = [] }) {
  // Every value is one line by contract: an embedded newline would become its
  // own `field: value` line on the next parse, where last-assignment-wins
  // could flip a recorded verdict (a verifier evidence string containing
  // "\nstatus: pass" must stay inert). Flatten on write, never trust callers.
  const flat = (v) => String(v).replace(/\s*\n+\s*/g, ' ').trim();
  const fmLines = UAT_FM_FIELDS.filter((k) => fm[k] !== undefined)
    .map((k) => `${k}: ${flat(fm[k])}`);
  const blocks = items.map((it) => {
    const fields = UAT_FIELDS.filter((k) => it[k] !== undefined)
      .map((k) => `${k}: ${flat(it[k])}`);
    return `### ${it.k}. ${flat(it.name)}\n${fields.join('\n')}\n`;
  });
  const counts = { pass: 0, fail: 0, pending: 0, skipped: 0, blocked: 0 };
  for (const it of items) if (Object.prototype.hasOwnProperty.call(counts, String(it.status))) counts[String(it.status)]++;
  const reworked = items.filter((i) => i.first_pass === 'fail').length;
  const summary = `total: ${items.length}\npassed: ${counts.pass}\nfailed: ${counts.fail}\n` +
    `pending: ${counts.pending}\nskipped: ${counts.skipped}\nblocked: ${counts.blocked}\nreworked: ${reworked}`;
  const kept = extras.map((e) => `\n${e}\n`).join('');
  return `---\n${fmLines.join('\n')}\n---\n\n## Items\n\n${blocks.join('\n')}${kept}\n## Summary\n\n${summary}\n`;
}

/**
 * The verify.md completion rule: every item pass, or skipped WITH a reason;
 * nothing failed, pending, or blocked. An empty checklist is not complete.
 * @param {{items: Array<Record<string, string|number>>}} uat
 */
export function uatComplete(uat) {
  if (!uat.items.length) return false;
  return uat.items.every((i) =>
    i.status === 'pass' || (i.status === 'skipped' && i.reason));
}

// ---------------------------------------------------------------------------
// PLAN.md frontmatter - the `requirements: [..]` / `files: [..]` grammar
// (templates/PLAN.md). Stated in full at
// cadence-core/references/plan-frontmatter.md; this section is that
// grammar's single implementation.
// ---------------------------------------------------------------------------

/**
 * @typedef {{line: number, code: string, text: string}} Issue
 */

/**
 * Strip one leading U+FEFF byte-order mark and normalize line endings
 * (`\r\n` and lone `\r`) to `\n`. PARSE PATH ONLY (D-05): wired into the
 * frontmatter reader below, deliberately NOT into planning.mjs's `read()`,
 * whose text is written back verbatim by `phase-done` and `renumber` - doing
 * it there would silently rewrite a user's CRLF ROADMAP.md/REQUIREMENTS.md
 * wholesale on the next edit, a byte-level rewrite of files Cadence promises
 * to touch surgically. Used by the frontmatter reader, which never writes its
 * text back; the ROADMAP grammar takes `normalizeCrlf` below instead, because
 * it DOES have write paths and a lone-CR file is one giant line to all of them.
 * @param {string} text
 */
export function normalize(text) {
  const noBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return noBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * The ROADMAP parse normalizer: BOM and `\r\n` only, deliberately leaving a
 * lone `\r` alone. `normalize` above collapses lone CR too, which is right for
 * a pure reader but wrong for the roadmap, because the roadmap's WRITE paths
 * (`setPhaseBox`, `cutPhaseDetail`, `cmdRenumber`'s list filter) split the RAW
 * bytes on `\n`. Making a lone-CR file parse into real phases therefore hands
 * those paths one giant line: `renumber remove --n 1` returned `ok:true` while
 * leaving two `**Phase 1:**` lines and deleting both `### Phase N:` detail
 * sections. CRLF is safe here and lone CR is not, and the difference is not
 * incidental - every roadmap write path matches either without a `$` anchor
 * (`setPhaseBox:197`, the renumber filter) or under `/m`, where `$` matches
 * before `\r` (`cutPhaseDetail:1153`), so a CRLF line round-trips byte for
 * byte. A lone-CR file has no such guarantee, so it stays unparseable and the
 * caller bails - the pre-phase-4 behavior, and the only safe answer for a
 * format this file cannot write back without corrupting.
 * @param {string} text
 */
function normalizeCrlf(text) {
  const noBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return noBom.replace(/\r\n/g, '\n');
}

/** Trim and truncate an offending line to 120 chars with a trailing `...`. */
function issueText(line) {
  const t = line.trim();
  return t.length > 120 ? `${t.slice(0, 120)}...` : t;
}

/**
 * Scan a frontmatter value left to right tracking quote state: a quote
 * character (`"` or `'`) opens a span when none is open and closes it when
 * it matches the open quote; an UNQUOTED `#` ends the value at that index
 * (D-01: quoting decides, with no `# ` vs `#x` discrimination and no
 * whitespace-preceded rule - `requirements: #TODO fill this in` and
 * `requirements: #41` both scan to an empty value, `"#41"` is data); end of
 * string also ends the value. The result is right-trimmed. Ending the scan
 * still inside a quote span yields code `unterminated-quote` and an empty
 * value - callers must not fall through to any other arm on that code: an
 * apostrophe that never closes (`files: [src/it's-a-file.md]`) has no honest
 * item boundary, so yielding nothing (not a half-read) is the only sound
 * result.
 * @param {string} s @returns {{value: string, code: string|null}}
 */
function scanValue(s) {
  let quote = null;
  let cut = s.length;
  for (let idx = 0; idx < s.length; idx++) {
    const c = s[idx];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '#') { cut = idx; break; }
  }
  if (quote) return { value: '', code: 'unterminated-quote' };
  return { value: s.slice(0, cut).replace(/\s+$/, ''), code: null };
}

/**
 * Resolve one already-comment-stripped, trimmed candidate (an inline list
 * element, a block-item payload, or a key line's scalar remainder) at its
 * own boundary (D-17/D-18/D-20), superseding `unwrap` (deleted - no dead
 * helper, no second resolution path).
 *
 * An empty `raw` resolves to `{value:'', codes:[]}`. When `raw[0]` is a
 * quote character, the value ends at the NEXT occurrence of that SAME
 * character (`raw.indexOf(raw[0], 1)`) - none found yields
 * `{value:'', codes:['unterminated-quote']}` (mirroring `scanValue`'s own
 * fail-loud rule, since a caller can pass a whole-value scan result unwound
 * one boundary further in). Otherwise the value ends at the first whitespace
 * character (`raw.search(/\s/)`, the whole string when there is none) - the
 * accepted cost stated plainly: an unquoted value can no longer contain a
 * space, so quote a value that does (checked against 21 commits of plan
 * frontmatter - every shipped value is a single token, so no shipped form
 * regresses).
 *
 * Whatever follows the value (D-17, symmetric with D-18 on the unquoted
 * form) is the "rest"; when the rest is non-whitespace, `trailing-value-
 * content` is pushed and the value BEFORE it still stands (parse-then-
 * diagnose, matching `trailing-inline-content`'s precedent).
 *
 * Finally, per D-20, the residual test: a resolved value that could only
 * have been written with an escape rule this grammar does not have gets
 * `residual-quote`, payload KEPT. It fires on a value containing a
 * backslash (the only way a ONE-element escape like `files: ["a\"]` is
 * detectable at all - it has no trailing rest and no surviving quote, so the
 * other two codes both miss it), OR the SAME quote character that wrapped
 * it (for an unquoted value, either quote character) - deliberately NOT a
 * bare "contains a quote" test, which would fire on the grammar's own
 * prescribed spelling of an apostrophe-bearing path
 * (`"src/it's-a-file.md"`, `references/plan-frontmatter.md:96-99`) and
 * leave that conforming file with no diagnostic-free form.
 *
 * No escape state is added here or at any of this function's three call
 * sites' surrounding scanners (`scanValue`, `splitDepth0`, `parseInlineList`
 * stay untouched) - this is a test on the RESOLVED value, detection, not an
 * escape rule.
 * @param {string} raw @returns {{value: string, codes: string[]}}
 */
function resolveValue(raw) {
  if (!raw) return { value: '', codes: [] };
  const codes = [];
  const quoted = raw[0] === '"' || raw[0] === "'";
  let value, rest;
  if (quoted) {
    const q = raw[0];
    const close = raw.indexOf(q, 1);
    if (close === -1) return { value: '', codes: ['unterminated-quote'] };
    value = raw.slice(1, close);
    rest = raw.slice(close + 1);
  } else {
    const ws = raw.search(/\s/);
    if (ws === -1) { value = raw; rest = ''; }
    else { value = raw.slice(0, ws); rest = raw.slice(ws); }
  }
  if (rest.trim()) codes.push('trailing-value-content');
  const residual = value.includes('\\') ||
    (quoted ? value.includes(raw[0]) : (value.includes('"') || value.includes("'")));
  if (residual) codes.push('residual-quote');
  // A backtick at the START or END of a resolved value is markdown formatting
  // that leaked into data. The grammar has no backtick rule, so the value
  // stands byte-exact (D-19) and is reported rather than rewritten - `add()`'s
  // old backtick strip is exactly the silent path rewriting D-19 removed.
  //
  // Boundary, not containment, and not a matched pair. Containment would fire
  // on a real path like lib/a`b.mjs, which overlaps correctly today - the same
  // over-fire the same-quote restriction above exists to prevent. But requiring
  // a MATCHED pair misses every near-miss spelling, each of which is just as
  // silent and just as unmatchable: a half wrap (`src/a.rs), a wrap plus
  // punctuation (`src/a.rs`,), a wrap the whitespace rule already cut in half
  // (`src/my file.rs -> `src/my), and - the sharpest one - a backtick-wrapped
  // ID, where scanValue's unquoted-# rule (D-01) cuts `#41` down to a lone
  // backtick BEFORE this runs, minting a one-character phantom id that audit
  // reports as an orphan. Boundary catches all four; a matched-pair test
  // catches none of them.
  if (value.startsWith('`') || value.endsWith('`')) {
    codes.push('backtick-wrapped-value');
  }
  return { value, codes };
}

/**
 * The four VALUE-LEVEL codes - the ones `scanValue`/`resolveValue` raise about
 * one value's own bytes, as opposed to the structure of the block around it.
 */
const VALUE_LEVEL_CODES = new Set([
  'unterminated-quote', 'trailing-value-content', 'residual-quote',
  'backtick-wrapped-value',
]);

/**
 * Scope value-level codes to the two LIST KEYS the seams actually read
 * (D-01). A defect in the bytes of `goal:` or `plan:` is a defect in a value
 * NOTHING reads as a list, and letting it reach `readFrontmatterList` put it
 * in `plan-overlap`'s `frontmatter_issues` and `phase-plans`' risk-floor bail
 * as though the plan's FILE LIST were unreadable - the gate answering
 * "sequential, this declaration cannot be trusted" on evidence about a
 * different key entirely.
 *
 * Deliberately NOT "only the key the caller asked for": a `requirements:`
 * defect still reaches a `files:` read and vice versa, because a plan whose
 * one list is misparsed is a plan whose frontmatter the author should fix
 * before anything routes off the other one.
 *
 * Applied at the PUSH SITES, where the owning key is in scope, so no field is
 * added to `Issue` and `readFrontmatterList` filters nothing - the five
 * readers of that envelope (risk floor, audit, plan-overlap, seed-reqs,
 * lease-check) all keep the shape they have, and an attribute-and-filter route
 * would have to blind a `files:`-key read to `files:`-key defects to do it.
 *
 * The five STRUCTURAL codes (`unterminated-frontmatter`, `malformed-key-line`,
 * `unknown-line`, `item-without-key`, `commented-key-line`) own no key and are
 * never routed through here: under D-02 they must reach EVERY key's read, or a
 * `requirements:` block truncated by a stray line reaches `plan-overlap` clean
 * and `choose_path` reads a half-parsed file as proved independence. The two
 * bracket-level codes (`unterminated-inline-list`, `trailing-inline-content`)
 * are about the list container, not one value, and pass through untouched.
 *
 * A key of `null` - an item arriving while no block key is open - owns no list
 * key, so its value-level codes are suppressed as well; `item-without-key`
 * still fires on that same line, so nothing about it goes silent.
 * @param {string|null} key @param {string[]} codes @returns {string[]}
 */
function scopeToListKeys(key, codes) {
  if (key === 'requirements' || key === 'files') return codes;
  return codes.filter((c) => !VALUE_LEVEL_CODES.has(c));
}

/**
 * Push one `{line, code, text}` issue per DISTINCT code in `codes`, in
 * first-occurrence order - a five-element inline list with five annotated
 * elements reports `trailing-value-content` once for its line, not five
 * times.
 * @param {Issue[]} issues @param {number} lineNo @param {string} lineText @param {string[]} codes
 */
function pushIssues(issues, lineNo, lineText, codes) {
  const seen = new Set();
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    issues.push({ line: lineNo, code, text: issueText(lineText) });
  }
}

/**
 * Split a string on commas at quote depth 0 - a comma inside a quoted span
 * is literal, never a separator.
 * @param {string} s @returns {string[]}
 */
function splitDepth0(s) {
  const out = [];
  let quote = null, start = 0;
  for (let idx = 0; idx < s.length; idx++) {
    const c = s[idx];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === ',') { out.push(s.slice(start, idx)); start = idx + 1; }
  }
  out.push(s.slice(start));
  return out;
}

/**
 * Parse an inline flow list value - already comment-stripped by `scanValue`
 * and confirmed by the caller to start with `[`. Finds the closing `]` at
 * quote depth 0 (a quoted `]` is literal, never the closer) by the same
 * left-to-right scan, never a `\[(.*)\]` capture (greedy or not - neither
 * can see quoting, and the greedy form is the defect three reviewers found
 * independently). No closing bracket yields no items plus codes
 * `['unterminated-inline-list']`. Non-whitespace after the closing bracket
 * yields `trailing-inline-content` (bracket-level, pushed first), with the
 * payload still parsed - never a fall-through that discards it. The payload
 * is split on commas at quote depth 0 (a comma inside a quoted span is
 * literal - and per D-20, no escape state, so a quote span an escaped quote
 * was meant to keep open still closes at the FIRST matching character) and
 * each trimmed, non-empty element is resolved by `resolveValue`; every
 * element's codes are appended after the bracket-level code, in order,
 * un-deduplicated here (the caller dedupes per line).
 * @param {string} value @returns {{items: string[], codes: string[]}}
 */
function parseInlineList(value) {
  let quote = null, closeIdx = -1;
  for (let idx = 1; idx < value.length; idx++) {
    const c = value[idx];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === ']') { closeIdx = idx; break; }
  }
  if (closeIdx === -1) return { items: [], codes: ['unterminated-inline-list'] };
  const payload = value.slice(1, closeIdx);
  const trailing = value.slice(closeIdx + 1);
  const codes = trailing.trim() ? ['trailing-inline-content'] : [];
  const items = [];
  for (const raw of splitDepth0(payload)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const resolved = resolveValue(trimmed);
    codes.push(...resolved.codes);
    if (resolved.value) items.push(resolved.value);
  }
  return { items, codes };
}

// Any line at column 0 shaped like `key:` or `key: value` - the anchor for a
// key's value AND one of the block-list terminator set's three members
// (D-04): fence, key line, end of block.
const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_.-]*):(\s|$)/;
const FENCE_LINE = /^---\s*$/;
const BLANK_LINE = /^\s*$/;
const COMMENT_LINE = /^\s*#/;
// A block-list item: any indent, then `-`, one or more WHITESPACE characters
// (a space or a tab - `\s+`, not a literal space), then payload. An empty
// payload contributes nothing, same as a comment-only item. Note the
// whitespace is REQUIRED: a bare `-` with nothing after it does not match
// here at all, so it falls through to `unknown-line` rather than reading as
// an empty item. The distinction is the whitespace, and it is stated in
// references/plan-frontmatter.md the same way. No indentation/nesting rule -
// the grammar has none.
const ITEM_LINE = /^\s*-\s+(.*)$/;
// A column-0 line that is key-SHAPED (D-16) but fails KEY_LINE's `(\s|$)`
// requirement after the colon - `requirements:["#41"]` matches this, not
// KEY_LINE. Never widened to require the space: that would parse every
// stray colon-bearing column-0 line (a bare `http://example.com`) as a
// key/value pair.
const MALFORMED_KEY_LINE = /^[A-Za-z_][A-Za-z0-9_.-]*:/;

/**
 * Classify every line of a PLAN.md's leading frontmatter block in ONE pass
 * and return every key's resolved value list alongside every line that fell
 * outside the grammar (D-02, D-03). This is the single implementation
 * `references/plan-frontmatter.md` names; `readFrontmatterList` below is a
 * thin selector over it, never a second scan.
 *
 * ONE pass over the whole block, not one scan per key, because the
 * structural diagnostics must not depend on which key the caller asked for:
 * `audit` reads only `requirements` and `plan-overlap` reads only `files`, so
 * a per-key scan could report a stray line to only ONE of the two envelopes -
 * and under the shipped template's inline `requirements: []` / `files: []`
 * form, no block scan runs at all, so a stray line would reach NEITHER.
 *
 * The fence is normalized first (D-05): a leading BOM is stripped, `\r\n`/
 * lone `\r` become `\n`, and leading blank lines are tolerated before the
 * opening `---`. Anything other than a bare `---` as the first non-blank
 * line means the file has no frontmatter at all - empty items and NO issue,
 * since `audit`'s `no-plan` and `plan-overlap`'s `undeclared` already make
 * that loud. An opening fence with no closing fence returns empty items plus
 * one issue `unterminated-frontmatter` at the opening fence's line.
 *
 * A key line is an exact column-0 match (`KEY_LINE`), never an interpolated
 * per-key regex; the first occurrence of a given key wins. The value arms
 * (inline list / block / scalar) and block-item payloads are resolved by
 * `scanValue` + `resolveValue` (+ `parseInlineList` for the inline form) -
 * the quote-aware scanner D-01 requires, so the two paths cannot drift and
 * every code either arm produces reaches `issues` with its line number - the
 * value-level four through `scopeToListKeys`, so a defect in the bytes of a
 * key no seam reads as a list does not arrive as evidence about the file list.
 *
 * A key whose remainder is empty opens a block: `currentKey` stays set while
 * we walk forward, SKIPPING blank and comment-only lines and pushing each
 * item's scanned/resolved value (D-04) - until the stated terminator set:
 * another key line, the closing fence, or the end of the block. Anything
 * else is recorded as an `unknown-line` issue and SKIPPED, never treated as
 * a fourth terminator - an unknown line must not truncate a list any item
 * below it still belongs to (the phase-3 regression this grammar closes).
 * An item arriving while NO block key is open - either before any key line,
 * or under a key that took the inline/scalar arm - is diagnosed
 * `item-without-key` and its payload DROPPED (D-13): it never back-attaches
 * to the most recent key line whatever arm that key took, since merging an
 * inline value with a following block would fuse two separate statements
 * under a merge rule this grammar does not state. A repeated key line does
 * not reopen a block either (first occurrence wins, above), so items under a
 * second `files:` line report the same code.
 * @param {string} text
 * @returns {{keys: Map<string, string[]>, issues: Issue[]}}
 */
export function parseFrontmatter(text) {
  const norm = normalize(text);
  const lines = norm.split('\n');
  let i = 0;
  while (i < lines.length && BLANK_LINE.test(lines[i])) i++;
  if (i >= lines.length || !FENCE_LINE.test(lines[i])) {
    return { keys: new Map(), issues: [] };
  }
  const fenceStartLine = i + 1;
  let j = i + 1;
  while (j < lines.length && !FENCE_LINE.test(lines[j])) j++;
  if (j >= lines.length) {
    return {
      keys: new Map(),
      issues: [{ line: fenceStartLine, code: 'unterminated-frontmatter', text: issueText(lines[i]) }],
    };
  }

  const keys = new Map();
  const issues = [];
  /** @type {string|null} the key currently accepting block items, or null */
  let currentKey = null;

  for (let k = i + 1; k < j; k++) {
    const line = lines[k];
    const lineNo = k + 1;

    const km = line.match(KEY_LINE);
    if (km) {
      currentKey = null; // a key line is always a terminator for the prior block
      const key = km[1];
      const first = !keys.has(key);
      const remainder = line.slice(key.length + 1).trim();
      const scanned = scanValue(remainder);

      if (scanned.code) {
        pushIssues(issues, lineNo, line, scopeToListKeys(key, [scanned.code]));
        if (first) keys.set(key, []);
        continue;
      }

      const value = scanned.value;
      let items, codes = [];
      if (value.startsWith('[')) {
        const r = parseInlineList(value);
        items = r.items;
        codes = r.codes;
      } else if (value !== '') {
        const r = resolveValue(value);
        items = r.value ? [r.value] : [];
        codes = r.codes;
      } else {
        items = [];
        if (first) currentKey = key; // block-eligible; items collected below
      }
      pushIssues(issues, lineNo, line, scopeToListKeys(key, codes));
      if (first) keys.set(key, items);
      continue;
    }

    if (BLANK_LINE.test(line)) continue; // skip, never a terminator

    if (COMMENT_LINE.test(line)) {
      // D-14: a comment-only line whose body - after stripping leading
      // whitespace, the run of `#` characters, and any following spaces - is
      // itself key-shaped earns `commented-key-line` but is NOT promoted to
      // a terminator: once the `#` is stripped, an ordinary prose comment
      // (`# TODO: fill this in`) also satisfies KEY_LINE, so promoting would
      // let prose truncate a real block - the exact silent under-read D-04
      // exists to close. Accepted cost, stated plainly: `requirements:` /
      // `- "#41"` / `# files:` / `  - src/shared.rs` still folds
      // `src/shared.rs` into `requirements` and audit still mints it as an
      // orphan - but now with this diagnostic beside it and `choose_path`
      // routing sequential, so it is no longer silent.
      const body = line.replace(/^\s*#+\s*/, '');
      if (KEY_LINE.test(body)) issues.push({ line: lineNo, code: 'commented-key-line', text: issueText(line) });
      continue; // skip either way, never a terminator
    }

    const im = line.match(ITEM_LINE);
    if (im) {
      const scanned = scanValue(im[1]);
      if (scanned.code) {
        pushIssues(issues, lineNo, line, scopeToListKeys(currentKey, [scanned.code]));
        // This arm returns early, BEFORE the no-block-key diagnosis below, so
        // it has to make that call itself: with no key open the value-level
        // code above is scoped away (D-01) and the line would otherwise leave
        // the pass reporting NOTHING - a frontmatter line gone silent, the one
        // outcome D-02 exists to prevent.
        if (!currentKey) issues.push({ line: lineNo, code: 'item-without-key', text: issueText(line) });
        continue;
      }
      if (scanned.value === '') continue; // comment-only item / empty `- ` payload: D-01 cost, not an issue
      const resolved = resolveValue(scanned.value);
      pushIssues(issues, lineNo, line, scopeToListKeys(currentKey, resolved.codes));
      if (currentKey) {
        if (resolved.value) keys.get(currentKey).push(resolved.value);
      } else {
        // No block key is open (D-13): an item under an inline/scalar key,
        // or before any key at all, is diagnosed and DROPPED - never
        // back-attached to the most recent key line whatever arm that key
        // took, whether or not a REPEATED key name reopens it (it does not,
        // `:690` first-occurrence-wins).
        issues.push({ line: lineNo, code: 'item-without-key', text: issueText(line) });
      }
      continue;
    }

    if (MALFORMED_KEY_LINE.test(line)) {
      // D-16: key-shaped at column 0 but missing the whitespace-or-EOL after
      // its colon (`requirements:["#41"]`) - names the actual repair (add a
      // space) instead of falling through to the generic `unknown-line`.
      // KEY_LINE itself stays strict; dropping its `(\s|$)` group would read
      // this form at the cost of parsing a bare `http://example.com` as key
      // `http`, value `//example.com`.
      issues.push({ line: lineNo, code: 'malformed-key-line', text: issueText(line) });
      continue;
    }

    // Neither item, comment, blank, key, malformed key, nor terminator:
    // recorded and SKIPPED - it does not stop an active block, so nothing
    // below it is lost (D-04).
    issues.push({ line: lineNo, code: 'unknown-line', text: issueText(line) });
  }

  return { keys, issues };
}

/**
 * Read one frontmatter key as a string list plus the pass's issues - every
 * STRUCTURAL issue the pass raised whatever key it sits under (D-02: never a
 * subset scoped to the key the CALLER asked for), and the value-level four
 * only where the key that owns them is `requirements:` or `files:`
 * (`scopeToListKeys`, D-01, applied at the push sites so nothing is filtered
 * here). A thin selector over
 * `parseFrontmatter`, the single implementation this grammar has (D-03). ONE
 * reader for both `requirements:` and `files:`: two copies of the same
 * pattern would drift, and audit would then accept a plan shape the
 * parallel-safety overlap check rejects, in the file that declares one
 * grammar per format.
 *
 * See `cadence-core/references/plan-frontmatter.md` for the full stated
 * grammar (normalization, fence, key line, the three value forms, block-list
 * skip/terminator rules, quoting, and every diagnostic code).
 * @param {string} text @param {string} key
 * @returns {{items: string[], issues: Issue[]}}
 */
export function readFrontmatterList(text, key) {
  const { keys, issues } = parseFrontmatter(text);
  return { items: keys.get(key) ?? [], issues };
}

/**
 * Extract the requirement IDs a plan commits to deliver, plus the frontmatter
 * grammar issues from the pass that read them - `readFrontmatterList`'s set,
 * so every structural issue in the block and the value-level codes owned by
 * `requirements:` or `files:`, never a value-level defect under some other
 * key.
 * @param {string} text @returns {{ids: string[], issues: Issue[]}}
 */
export function parsePlanRequirements(text) {
  const { items, issues } = readFrontmatterList(text, 'requirements');
  return { ids: items, issues };
}

/**
 * Where the frontmatter `files:` list is written, for a diagnostic that has to
 * name a line: the key line itself (`line`/`text`), plus `lines`, the list's
 * own declaring lines - the key line alone for the inline form
 * (`files: [a, b]`), the block's ITEM lines for the block form.
 *
 * A LOCATOR and never a second parser: values are `parseFrontmatter`'s to
 * resolve and this returns none, so the two cannot disagree about what a plan
 * declared. It answers only "which line was that written on", which
 * `parseFrontmatter` does not expose per item, and it is bounded to one key's
 * region so no other key's value can claim a line.
 * @param {string} text
 * @returns {{line: number, text: string, lines: {line: number, text: string}[]}}
 */
function filesListRegion(text) {
  const empty = { line: 1, text: '', lines: [] };
  const lines = normalize(text).split('\n');
  let i = 0;
  while (i < lines.length && BLANK_LINE.test(lines[i])) i++;
  if (i >= lines.length || !FENCE_LINE.test(lines[i])) return empty;
  let j = i + 1;
  while (j < lines.length && !FENCE_LINE.test(lines[j])) j++;
  if (j >= lines.length) return empty;
  for (let k = i + 1; k < j; k++) {
    const km = lines[k].match(KEY_LINE);
    if (!km || km[1] !== 'files') continue; // first occurrence wins, as the parse does
    const here = { line: k + 1, text: lines[k] };
    // A non-empty remainder is the inline or scalar arm: one line holds it all.
    if (lines[k].slice(km[1].length + 1).trim() !== '') return { ...here, lines: [here] };
    const block = [];
    for (let m = k + 1; m < j && !KEY_LINE.test(lines[m]); m++) {
      if (ITEM_LINE.test(lines[m])) block.push({ line: m + 1, text: lines[m] });
    }
    return { ...here, lines: block };
  }
  return empty;
}

/**
 * Extract the file paths a plan declares it touches: the frontmatter
 * `files:` list unioned with every task's `- **Files:** a, b` line (either
 * source alone can go stale; the union is what the parallel-safety overlap
 * check trusts) - plus the frontmatter arm's issues (`plan-overlap` reports
 * nowhere else; the task-line arm is a separate, already CRLF-tolerant regex
 * outside this grammar).
 *
 * The two arms normalize DIFFERENTLY (D-19; D-09 superseded). The
 * frontmatter arm's items are already grammar-resolved - comment-stripped,
 * quote-resolved, trailing content diagnosed - so re-processing them through
 * `add()`'s parenthetical/backtick strip is a second, silent route to a
 * wrong `overlaps`: `src/x(1)` -> `src/x`, `` a`b.mjs `` -> `ab.mjs`, each a
 * phantom or missed overlap reported as authoritative with no
 * `frontmatter_issues` entry. The frontmatter arm therefore adds its items
 * VERBATIM, byte for byte as the plan declared them (skipping only the
 * empty string); the task-line arm keeps `add()`'s parenthetical strip,
 * backtick strip and `{`-placeholder filter exactly as before.
 *
 * The task-line arm ALSO adds its raw, un-normalized trimmed form (skipping
 * empties and `{`-placeholders on both forms) - the cross-arm bridge this
 * narrowing requires: once the two arms normalize differently, the SAME
 * declared path would otherwise reach the shared `Set` as two different
 * strings depending on which arm a plan used (PLAN-1 declaring `src/x(1)`
 * in frontmatter, PLAN-2 declaring it only on a `- **Files:**` task line,
 * would yield `src/x(1)` vs `src/x` - no overlap, no `undeclared`, no
 * `frontmatter_issues`, and `plan-overlap` would greenlight two plans
 * writing one file). Adding both forms can only ADD Set entries, never
 * remove one, so its failure direction is a phantom overlap routing
 * sequential - the safe direction for a parallel-safety gate. Accepted
 * cost: an annotated task line contributes a non-path string
 * (`src/a.rs (edit)`) to that plan's files list, which can appear in
 * `overlaps` output as a duplicate beside its normalized twin.
 *
 * The frontmatter arm ALSO reports `markdown-decorated-path` on a declaration
 * wearing markdown (`isDecoratedPath` below states the three shapes). Reported,
 * not repaired: the declaration stays in `files` byte-exact (D-04/D-19), the
 * same reason the arm adds items verbatim at all - a decorated path and its
 * plain sibling genuinely do not intersect, and rewriting one to match the
 * other would make `overlaps` mean "intersect after repair". The diagnostic is
 * what moves the gate, since `workflows/execute.md` routes any non-empty
 * `frontmatter_issues` to the sequential path. FRONTMATTER ARM ONLY (D-06):
 * the task-line arm already strips backticks and contributes both its
 * normalized and its raw form, so a backticked task path already matches a
 * sibling's plain one and a both-arms rule would turn committed, correctly
 * matching plans into issue carriers.
 * @param {string} text @returns {{files: string[], issues: Issue[]}}
 */
export function parsePlanFiles(text) {
  const files = new Set();
  /** The task-line arm's normalization, D-19: backticks and one trailing parenthetical. */
  const normalizeTaskItem = (raw) => raw.replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
  /**
   * Markdown decoration around a declared path (D-03/D-08), three shapes under
   * ONE code: bold (`**src/a.rs**`), the link form (`[src/a.rs](src/a.rs)`),
   * and a MATCHED INTERIOR backtick pair (`` src/`a`.rs ``) - two or more
   * backticks at indices strictly inside the value.
   *
   * The interior COUNT is the whole of the backtick arm (D-05), and it is what
   * keeps this additive to `resolveValue`'s unchanged boundary rule rather than
   * a second opinion about the same bytes: `` `src/a.rs` `` has zero interior
   * backticks and a wrap-plus-punctuation `` `src/a.rs`, `` has exactly one, so
   * both keep reporting `backtick-wrapped-value` alone instead of
   * double-reporting, and a real path carrying ONE interior backtick
   * (`` lib/a`b.mjs ``) stays diagnostic-free - the over-fire guard UAT-21
   * pinned.
   * @param {string} v @returns {boolean}
   */
  const isDecoratedPath = (v) => {
    if (v.length > 4 && v.startsWith('**') && v.endsWith('**')) return true;
    if (v.startsWith('[') && v.endsWith(')') && v.includes('](')) return true;
    let interior = 0;
    for (let idx = 1; idx < v.length - 1; idx++) if (v[idx] === '`') interior++;
    return interior >= 2;
  };
  const { items, issues } = readFrontmatterList(text, 'files');

  // The lease-spelling refusal, on BOTH arms of the union (D-02). `./a.txt`,
  // `src/./a.txt` and `src//a.txt` each name the same file as their plain
  // spelling, and lib/lease-grammar.mjs reads them as different files - so they
  // are dropped here, before either reader sees them, and the author is told by
  // name. Refusing on the frontmatter arm alone would leave the spelling
  // reaching `lease-check` through the task-line door with no diagnostic.
  //
  // NOT pushed down into parseFrontmatter or readFrontmatterList: those serve
  // `requirements:` too, where `//` and a leading `./` are not path syntax at
  // all, and `cmdAudit` reads requirement ids through the same pass.
  const region = filesListRegion(text);
  let row = 0;
  let col = 0;
  /**
   * The `files:` list line a refused item was declared on. A cursor advances
   * past each match, so `./a.txt` written TWICE reports its OWN line each time
   * instead of both diagnostics pointing at the first occurrence. The search is
   * bounded to the list's own item lines: scanning the whole frontmatter block
   * would let a `requirements:` value carrying the same text claim the line.
   */
  const refuseFrontmatter = (item) => {
    for (; row < region.lines.length; row++, col = 0) {
      const at = region.lines[row].text.indexOf(item, col);
      if (at === -1) continue;
      col = at + item.length;
      return region.lines[row];
    }
    return region; // the `files:` key line - D-19 makes this unreachable
  };

  for (const f of items) {
    if (!f) continue;
    if (isRefusedSpelling(f)) {
      const at = refuseFrontmatter(f);
      issues.push({ line: at.line, code: 'redundant-path-segment', text: issueText(at.text) });
      continue;
    }
    // Decoration is REPORTED, never dropped and never rewritten (D-04): the
    // bytes go into `files` exactly as declared, so `overlaps` keeps meaning
    // "these two declarations intersect" and never "intersect after repair".
    // The gate still moves, because `execute.md` routes ANY non-empty
    // `frontmatter_issues` to the sequential path. Same cursor as the refusal
    // arm above, so a decorated path written twice reports its own line each
    // time.
    if (isDecoratedPath(f)) {
      const at = refuseFrontmatter(f);
      issues.push({ line: at.line, code: 'markdown-decorated-path', text: issueText(at.text) });
    }
    files.add(f); // verbatim - no post-grammar rewriting (D-19)
  }
  for (const m of text.matchAll(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm)) {
    // Measured to the `**Files:**` MARKER, not to `m.index`: the pattern's
    // leading `\s*` matches newlines too, so the match begins at the start of
    // whatever blank run precedes the task line and `m.index` names an earlier
    // line than the one the declaration is written on.
    const line = text.slice(0, (m.index ?? 0) + m[0].indexOf('**Files:**')).split('\n').length;
    for (const raw of m[1].split(',')) {
      const f = normalizeTaskItem(raw); // the normalized form, D-19's task-line arm
      const trimmed = raw.trim(); // + the raw form, the cross-arm bridge
      // ONE issue per refused comma element, whichever of its two forms carries
      // the spelling - and neither form is added, so the second door is shut on
      // the same declaration the first one refused.
      if (isRefusedSpelling(f) || isRefusedSpelling(trimmed)) {
        issues.push({ line, code: 'redundant-path-segment', text: issueText(m[0]) });
        continue;
      }
      if (f && !f.startsWith('{')) files.add(f);
      if (trimmed && !trimmed.startsWith('{')) files.add(trimmed);
    }
  }
  return { files: [...files], issues };
}

// ---------------------------------------------------------------------------
// Renumbering - shift `Phase K` tokens and `phases/K/` paths in one pass.
// Capital-P `Phase K` is the structured form every template uses (list lines,
// detail headings, Depends on, traceability cells); lowercase prose refs are
// reported to the caller, never rewritten - that edit needs judgment.
// ---------------------------------------------------------------------------

/**
 * Shift every INTEGER `Phase K` token and `phases/K/` path where K >= from by
 * delta. Single-pass replace, so a shifted number is never re-shifted.
 * Decimal phases (2.1 insertions) are deliberately left alone on BOTH forms:
 * the path regex never matched them, so shifting the integer part of the
 * token (`Phase 2.1` -> `Phase 3.1`) desynced tokens from directories. The
 * renumber command reports decimal phases for the caller to re-place with
 * judgment instead.
 * @param {string} text @param {number} from @param {number} delta
 */
export function shiftPhaseTokens(text, from, delta) {
  let count = 0;
  const shift = (k) => { count++; return k + delta; };
  const out = text
    .replace(/\bPhase (\d+)\b(?!\.\d)/g, (m, k) => Number(k) >= from ? `Phase ${shift(Number(k))}` : m)
    .replace(/\bphases\/(\d+)\//g, (m, k) => Number(k) >= from ? `phases/${shift(Number(k))}/` : m);
  return { text: out, count };
}

/**
 * Find lowercase `phase K` prose references (K >= from) the shift above
 * deliberately leaves alone. Returns [{line, text}] for the caller to repair
 * with judgment.
 * @param {string} text @param {number} from
 */
export function findProsePhaseRefs(text, from) {
  const refs = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/\bphase (\d+)\b/g)) {
      if (Number(m[1]) >= from) { refs.push({ line: i + 1, text: lines[i].trim() }); break; }
    }
  }
  return refs;
}

/**
 * Cut phase N's `### Phase N: ...` detail section out of ROADMAP text (from
 * its heading to the next ### / ## heading). Returns the text unchanged when
 * the section is absent. A name-less heading (exactly `### Phase N:`) is
 * matched too, so a bare heading and its body are not left behind.
 *
 * That tolerance is scoped to THIS function only (D-08). `PHASE_LINE`,
 * `setPhaseBox` and the `renumber remove` list-line filter keep requiring a
 * name: unifying every `Phase N:` matcher "for consistency" would change what
 * counts as a phase for `status`, `audit`, `phase-done` and the cursor's
 * `total` - a state-machine change smuggled in as a parser fix. The colon
 * stays immediately after the escaped number, so `### Phase 21:` still cannot
 * match n = 2.
 * @param {string} text @param {number} n
 */
export function cutPhaseDetail(text, n) {
  const re = new RegExp(`^### Phase ${escN(n)}:(?: .*)?$`, 'm');
  const start = text.search(re);
  if (start === -1) return text;
  const headingEnd = text.indexOf('\n', start);
  if (headingEnd === -1) return text.slice(0, start);
  const rest = text.slice(headingEnd + 1);
  const endRel = rest.search(/^#{2,3} /m);
  const end = endRel === -1 ? text.length : headingEnd + 1 + endRel;
  return text.slice(0, start) + text.slice(end);
}

// ---------------------------------------------------------------------------
// Atomic write - STATE/UAT are rewritten constantly; a crash must never
// leave a torn file. Write a sibling temp file, then rename over the target.
//
// The temp name is UNIQUE PER CALL - `<file>.<pid>.<n>.tmp`, where `n` is a
// module-level counter - and stays a sibling of `file`, so the rename is still
// same-filesystem and still atomic. What that buys: two writers of one target
// no longer share one temp path, so the second writer's bytes can no longer
// land under the first writer's rename. What it does NOT buy (D-05): the two
// writers still last-write-wins the TARGET, so a `uat record` racing a
// `phase-done` on one file still loses an edit. There is no lock, no `O_EXCL`
// retry and no `fsync` here - the promise is only that a crash never leaves a
// torn file.
//
// The suffix is DERIVED, never random: a test has to be able to name the temp
// paths this process will use before it uses them.
//
// A symlink SITTING AT that temp path is refused, by throwing (D-02). The read
// side has defended against this exact shape for a while (`planning.mjs`
// lstats and skips a link rather than reading through it); the write side never
// got it, so a planted `ROADMAP.md.tmp` link wrote the caller's bytes wherever
// it pointed. Refusal is a throw because no call site assigns this function's
// result, and a throw is the failure mode all 15 already tolerate through their
// dispatch-level catch.
//
// The guard covers the TEMP path only (D-03). The TARGET is still replaced by
// the rename even when it is itself a symlink - that is what heals a tree an
// attack already touched. Stated cost: a planning file a user deliberately
// symlinked into a dotfiles tree is replaced on the next write.
// ---------------------------------------------------------------------------

/** Bumped on every atomicWrite call, so no two share a temp path. */
let tmpSeq = 0;

/**
 * @param {string} file
 * @param {string} text
 * @throws when the temp path is a symlink - writing would follow it out of the tree
 */
export function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.${tmpSeq++}.tmp`;
  // `lstatSync`, so the LINK is what gets classified rather than whatever it
  // points at. An ordinary existing file here is still overwritten: a stale
  // temp from a crashed process must not wedge every future write.
  let st = null;
  try { st = lstatSync(tmp); } catch { /* ENOENT is the ordinary case */ }
  if (st && st.isSymbolicLink()) {
    throw new Error(`atomicWrite refused: temp path is a symlink: ${tmp}`);
  }
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}
