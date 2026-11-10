// @ts-check
// planning-files.mjs - every .planning grammar lives here (cursor, ROADMAP phases, REQUIREMENTS
// traceability, UAT items), except the cursor parser, which sits in state-cursor.mjs and is re-exported
// a format change is one function here plus its tests, workflow prose never describes file mechanics
'use strict';

import { writeFileSync, renameSync, lstatSync } from 'node:fs';
import { isRefusedSpelling } from './lease-grammar.mjs';
import { parseCursor } from './state-cursor.mjs';
import { fenceScanner } from './text-util.mjs';

// the only Status values the cursor may carry
export const CURSOR_STATUSES = [
  'ready to plan', 'context gathered', 'planned', 'executed',
  'phase complete', 'paused',
];

// STATE.md: the cursor

// re-exported so callers keep importing it from here
export { parseCursor };

/**
 * Render the canonical cursor under `# State`. The optional `Plan:` line sits right after `Phase:`,
 * and with no plan the text is the 3.9.3 four-line form byte for byte.
 * @param {{phase:number,total:number,name:string,status:string,next:string,updated:string,
 *   plan?:{k:number,j:number,name?:string}}} c
 */
export function renderCursor(c) {
  const plan = c.plan
    ? `Plan: ${c.plan.k} of ${c.plan.j}${c.plan.name ? ` (${c.plan.name})` : ''}\n` : '';
  return `# State\n\nPhase: ${c.phase} of ${c.total} (${c.name})\n${plan}` +
    `Status: ${c.status}\nNext: ${c.next}\nUpdated: ${c.updated}\n`;
}

// ROADMAP.md: the `## Phases` checkbox list

const PHASE_LINE = /^- \[( |x)\] \*\*Phase (\d+(?:\.\d+)?): (.+?)\*\*(?:\s*-\s*(.*))?$/;

/**
 * Parse the `## Phases` list, sorted numerically (decimal insertions land between their neighbours), or [] when the
 * section is missing or empty.
 *
 * Uses `normalizeCrlf`, not `normalize`: a CRLF checkout has to parse, but a lone-CR file must stay unparseable
 * or the write paths that split raw bytes on `\n` corrupt it.
 * Both ends come from `sectionSpan`: splitting on the heading read the fenced example in the ROADMAP template as
 * the real section and returned phantom `[Name]` phases. A heading indented up to three spaces matches too.
 * @param {string} text
 */
export function parseRoadmapPhases(text) {
  const lines = normalizeCrlf(text).split('\n');
  const { start, end } = sectionSpan(lines, '## Phases');
  if (start < 0) return [];
  // a fenced example inside the section mints no phase, or classifyPhaseList could say `live` off lines it never flags
  const fenced = fenceScanner();
  const phases = [];
  for (let i = start + 1; i < end; i++) {
    if (fenced(lines[i])) continue;
    const m = lines[i].match(PHASE_LINE);
    if (m) phases.push({ n: Number(m[2]), name: m[3], desc: m[4] || '', checked: m[1] === 'x' });
  }
  return phases.sort((a, b) => a.n - b.n);
}

// the name the cursor carries between milestones, since parseCursor needs a non-empty name group
export const CLOSED_CYCLE_NAME = 'no active cycle';

// only the capitalized `Phase N` counts as a phase reference, lowercase "phase" is prose
const PHASE_TOKEN = /\bPhase (\d+(?:\.\d+)?)\b/;

/**
 * Classify the `## Phases` section; `PHASE_LINE` still decides what counts as a phase. Pure, no I/O.
 * CRLF is normalized for parsing only, so a lone-CR file stays one giant line: `no-section`.
 * Any phase from parseRoadmapPhases is `live`. Otherwise scan to the end, skipping fences: a line matching
 * `PHASE_LINE` is `phase-outside-section`, any other phase token gets a code by shape, no match is `closed`.
 * The scan runs past the next `## ` on purpose, or a wiped checkbox list with its `### Phase N:` details left
 * under `## Phase Details` would read as a cleanly closed milestone.
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
  // scan to the end of the text and skip only fenced lines, so a wiped list with surviving details still reports
  const fenced = fenceScanner();
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
    if (fenced(line)) continue;
    if (!PHASE_TOKEN.test(line)) continue;
    let code = 'phase-prose-line'; // catch-all, never silent
    // a canonical entry down here is in the wrong section, not the wrong shape, so check it before the shape tests
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

// REQUIREMENTS.md: the Traceability table

// first three cells of a Traceability row, shared with shiftPendingReqRows so both agree on what a row is
const REQ_ROW = /^\|([^|]*)\|([^|]*)\|([^|]*)\|/;

/**
 * Parse traceability rows into [{id, phase, status}]. `phase` is null when the cell names none,
 * a dropped requirement that audit deals with.
 *
 * Both ends of the section come from `sectionSpan`, as in setReqStatus and insertReqRows, so the
 * reader and the writers can't disagree about where the table is.
 * The separator skip is a blacklist (a cell of only dashes, colons and spaces), not an id whitelist,
 * so a malformed id still reaches audit as a `no-phase` break instead of vanishing from the count.
 * @param {string} text
 */
export function parseRequirements(text) {
  const lines = text.split('\n');
  // a split on the heading has no fence state, and the shipped REQUIREMENTS template keeps its whole body
  // in a fence, so a seeded project parsed the template's example rows and archiveRequirements then deleted them
  // a heading indented up to three spaces opens the section too, same as the roadmap parser
  const { start, end } = sectionSpan(lines, '## Traceability');
  if (start < 0) return [];
  const rows = [];
  for (let i = start + 1; i < end; i++) {
    const cells = lines[i].match(REQ_ROW);
    if (!cells) continue;
    const id = cells[1].replace(/\*/g, '').trim();
    if (!id || id === 'Requirement' || /^[-:\s]+$/.test(id)) continue;
    const phaseM = cells[2].match(/(\d+(?:\.\d+)?)/);
    rows.push({ id, phase: phaseM ? Number(phaseM[1]) : null, status: cells[3].trim() });
  }
  return rows;
}

// single-line edits, these return the whole text so callers stay pure

// phase numbers can be decimal, and an unescaped dot would match any character
/** @param {string|number} n */
const escN = (n) => String(n).replace(/\./g, '\\.');

/**
 * Flip a phase's `## Phases` checkbox. Returns {text, line} (1-indexed), or null when there's no such phase line.
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
 * Set the Status cell for the given requirement ids. Other rows are byte-preserved.
 * Returns {text, changed:[ids...]}.
 *
 * Same `sectionSpan` as parseRequirements, so this can't edit a table its own reader says isn't there.
 * A fenced `## Traceability` isn't the section: the text comes back unchanged and `changed` is empty.
 * @param {string} text @param {string[]} ids @param {string} status
 */
export function setReqStatus(text, ids, status) {
  const lines = text.split('\n');
  const changed = [];
  // one walk for both ends: the old inTable flag rewrote rows inside a code fence
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

// REQUIREMENTS.md: the Active grammar and the Traceability insert path

// the `## Active` bullet grammar, as before the classifier: it reports lines outside it and never widens it
const ACTIVE_BULLET = /^-\s+(?:\[[ xX]\]\s+)?\*\*([^*]+)\*\*/;

// a requirement id in both shipped forms (`PREFIX-N`, `#41`). Unanchored to scan prose, unlike isRequirementId
const REQ_ID_TOKEN = /\b[A-Z][A-Z0-9]{1,7}-\d+\b|(?:^|[^\w#])#\d+\b/;
const REQ_ID_TOKEN_G = new RegExp(REQ_ID_TOKEN.source, 'g');

// the full-string form of the same two spellings. ACTIVE_BULLET reads any bold span as an id and seed-reqs needs that,
// so the narrowing lives here, where audit asks whether an id can break the verdict
// the letter can sit anywhere in the category: real ids open with a digit, and a head-anchored form refused them
// the 2-8 length is the lookahead's job, since those ids carry digits where a positional letter would have to go
// never drop the letter requirement: it's the only filter between a bolded date or plan reference and audit's counts
const REQ_ID_EXACT = /^(?:(?=[A-Z0-9]{2,8}-)[A-Z0-9]*[A-Z][A-Z0-9]*-\d+|#\d+)$/;

/**
 * Is `id` exactly a requirement id and nothing else? It's the admission test for anything that moves
 * audit's arithmetic. A trailing colon fails (it belongs outside the bold span), and so do plain
 * words (`Note`) and a category with no letter in it (`2026-08`).
 * @param {string} id @returns {boolean}
 */
export function isRequirementId(id) {
  return REQ_ID_EXACT.test(id);
}

/**
 * Every `### Phase <N>:` detail section in `lines` as `{start, end}`: the heading's own line and the next unfenced
 * line opening with one to three `#` and a space (or `lines.length`). Empty when there is none. The one locator for
 * a detail section, so the criteria count, the cut and the milestone prune can't disagree about where it ends.
 * The scanner is fed every line from the top and never restarted, so the fence state is the whole document's: a
 * fenced `# comment` or `### ` line neither ends a section nor starts one. The heading is the escaped number with
 * the colon right after it, then nothing or a space-led name, so a longer number can't match a shorter n.
 * Lines are read, never changed, so a caller that writes them back keeps every byte, `\r` included.
 * @param {string[]} lines @param {string|number} n
 * @returns {Array<{start: number, end: number}>}
 */
export function phaseDetailSpans(lines, n) {
  const head = new RegExp(`^### Phase ${escN(n)}:(?: .*)?\\r?$`);
  const fenced = fenceScanner();
  const spans = [];
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    if (fenced(lines[i])) continue;
    if (open >= 0 && /^#{1,3} /.test(lines[i])) { spans.push({ start: open, end: i }); open = -1; }
    if (open < 0 && head.test(lines[i])) open = i;
  }
  if (open >= 0) spans.push({ start: open, end: lines.length });
  return spans;
}

/**
 * One phase's `### Phase <N>:` detail block verbatim, or null when the roadmap has none.
 * Shared by phaseRequirements and phaseCriteria so they can't disagree about where a block ends,
 * or a criteria count would swallow the next phase's list.
 *
 * @param {string} body ROADMAP bytes, already through `normalizeCrlf`
 * @param {string|number} phase the caller's own spelling
 * @returns {string|null}
 */
function phaseDetailBlock(body, phase) {
  const lines = body.split('\n');
  const [span] = phaseDetailSpans(lines, phase);
  return span ? lines.slice(span.start, span.end).join('\n') : null;
}

/**
 * The requirement ids a phase's ROADMAP detail block names, and its goal line.
 * Reads the `**Requirements:**` line of the detail block, never the `## Phases` checklist, which has no ids.
 * Pure and total. A missing block or line gives `{found: false, ids: []}`: absence is not zero,
 * or a caller gating on a count reads an unwritten roadmap as a small phase.
 *
 * @param {string} text the ROADMAP.md bytes
 * @param {string|number} phase the caller's own spelling
 * @returns {{found: boolean, ids: string[], goal: string}}
 */
export function phaseRequirements(text, phase) {
  const body = normalizeCrlf(String(text || ''));
  const block = phaseDetailBlock(body, phase);
  if (block === null) return { found: false, ids: [], goal: '' };

  const reqLine = block.match(/^\*\*Requirements:\*\*(.*)$/m);
  const goalLine = block.match(/^\*\*Goal:\*\*(.*)$/m);
  if (!reqLine) return { found: false, ids: [], goal: goalLine ? goalLine[1].trim() : '' };
  // deduped, or a typo naming an id twice pushes a phase over a ceiling
  const ids = [...new Set(idTokensIn(reqLine[1]).filter(isRequirementId))];
  return { found: true, ids, goal: goalLine ? goalLine[1].trim() : '' };
}

// both live spellings of the criteria heading: the template's bold form and the bare one this roadmap uses
// matching the template alone would silently report "no criteria declared" for every phase here
// the bold markers stay balanced, a half-written `**Success criteria:` is a spelling nothing writes
const CRITERIA_HEADING = /^(?:\*\*Success Criteria:\*\*|Success Criteria:)[ \t]*$/im;

// column 0 only, since a wrapped criterion continues on an indented line and would count twice
const CRITERIA_ITEM_G = /^\d+[.)]\s+\S/gm;

/**
 * How many success criteria a phase's ROADMAP detail block declares: the numbered items under either heading
 * spelling, up to the next `^#{1,3} ` heading. No heading gives `{found: false, count: 0}`, as phaseRequirements
 * does, so a phase nobody wrote criteria for is never compared against a floor.
 * Fenced lines are dropped first, or a fenced example's items get counted.
 *
 * @param {string} text the ROADMAP.md bytes
 * @param {string|number} phase the caller's own spelling
 * @returns {{found: boolean, count: number}}
 */
export function phaseCriteria(text, phase) {
  const block = phaseDetailBlock(normalizeCrlf(String(text || '')), phase);
  if (block === null) return { found: false, count: 0 };
  // fence delimiters go with their contents, so a fenced example neither mints the heading nor adds items
  const fenced = fenceScanner();
  const defenced = block.split('\n').filter((line) => !fenced(line)).join('\n');
  const heading = defenced.match(CRITERIA_HEADING);
  if (!heading || heading.index === undefined) return { found: false, count: 0 };
  const after = defenced.slice(heading.index + heading[0].length);
  return { found: true, count: (after.match(CRITERIA_ITEM_G) || []).length };
}

/**
 * The `### Task <n>: <name>` headings in one plan's bytes, in file order.
 * Anchored to the heading level the plan template writes, so a `## Tasks` heading or a `#### ` sub-bullet isn't a task.
 * A line inside a fenced block is no heading.
 * @param {string} text @returns {string[]} the task titles
 */
export function planTaskTitles(text) {
  // a fenced line is blanked, not dropped, so a fenced `### Task` example is no task and the rest reads as before
  const fenced = fenceScanner();
  const open = normalizeCrlf(String(text || '')).split('\n').map((l) => (fenced(l) ? '' : l)).join('\n');
  return [...open.matchAll(/^### Task\s+[\d.]+\s*:?\s*(.*)$/gm)].map((m) => m[1].trim());
}

/**
 * The plan name in one plan's first H1 (after any frontmatter), or null. This is the one place a plan
 * heading is parsed, no workflow reads headings.
 * Takes the last ` - Plan ...` part so a phase name holding " - " or "Plan" doesn't cut the name short.
 * Accepted tails: `Plan K: <name>`, `Plan K of J: <name>` and `Plan K (<name>)`, after a hyphen or em dash.
 * The heading's own number is never read back, it disagrees with disk often enough to be no source,
 * and a missing name gets no stand-in. Any non-string returns null.
 * @param {string} text @returns {string|null}
 */
export function planName(text) {
  if (typeof text !== 'string') return null;
  const lines = normalizeCrlf(text).split('\n');
  const bounds = frontmatterBounds(lines);
  const body = (bounds && bounds.close !== -1 ? lines.slice(bounds.close + 1) : lines).join('\n');
  const h1 = /^# (.*)$/m.exec(body);
  if (!h1) return null;
  const parts = [...h1[1].matchAll(/\s[-\u2014]\s+Plan(?!\w)/g)];
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const tail = /^\s+\d+(?:\s+of\s+\d+)?(?:\s*:(.*)|\s*\((.*)\))\s*$/
    .exec(h1[1].slice(last.index + last[0].length));
  const name = tail ? (tail[1] ?? tail[2]).trim() : '';
  return name === '' ? null : name;
}

/** Every requirement-id token in `s`, its leading delimiter stripped. */
function idTokensIn(s) {
  return [...s.matchAll(REQ_ID_TOKEN_G)].map((m) => m[0].slice(m[0].search(/[A-Z#]/)));
}

// every bold span on a line. ACTIVE_BULLET reads only the first, so this is what makes a second one visible
const BOLD_SPAN_G = /\*\*([^*]+)\*\*/g;

/** Every bold span in `s` AFTER the first, trimmed. */
function trailingBoldSpans(s) {
  return [...s.matchAll(BOLD_SPAN_G)].slice(1).map((m) => m[1].trim());
}

/**
 * Classify the `## Active` section: the ids it declares, plus lines that look like they declare one but don't.
 * The raw text is split on `\n`, not normalized, because the REQUIREMENTS.md write paths split raw bytes too.
 * Both ends come from `sectionSpan` and fenced lines are skipped, or the template's example ids get declared.
 * Sharp edge: any bold span reads as an id (`- **Note**: ...` declares `Note`), since narrowing ACTIVE_BULLET would
 * change seed-reqs. It's reported, and audit admits only isRequirementId ids into `unpicked`.
 * @param {string} text
 * @returns {{ids: string[]|null, issues: Issue[]}}
 */
export function classifyActiveSection(text) {
  const lines = text.split('\n');
  // both ends from one scanner: a fence-blind start can't be repaired by a fence-aware end
  const { start: heading, end } = sectionSpan(lines, '## Active');
  if (heading === -1) return { ids: null, issues: [] };

  const ids = [];
  const seen = new Set();
  /** @type {Array<{issue: Issue, prose: string[]|null}>} */
  const found = [];
  const fenced = fenceScanner();
  for (let i = heading + 1; i < end; i++) {
    const line = lines[i];
    if (fenced(line)) continue;
    const m = line.match(ACTIVE_BULLET);
    if (m) {
      const id = m[1].trim();
      if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
      // in grammar but not an id: reported, never counted
      if (id && !isRequirementId(id)) {
        found.push({ issue: { line: i + 1, code: 'active-non-id-bullet', text: issueText(line) }, prose: null });
      }
      // a second id-shaped bold span would vanish silently; only id-shaped extras, or emphasis would mint ids
      const extra = trailingBoldSpans(line).filter(isRequirementId);
      if (extra.length > 0) {
        found.push({ issue: { line: i + 1, code: 'active-multi-id-bullet', text: issueText(line) }, prose: null });
      }
      continue;
    }
    if (!REQ_ID_TOKEN.test(line)) continue;
    let code = 'active-prose-line'; // catch-all, never silent
    if (/^\s*\|/.test(line)) code = 'active-table-row';
    else if (/^\s*[-*+]\s/.test(line)) {
      // name the cause: an indented bullet is unread for the indent, a `*` or `+` one for the marker
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
  // prose candidates survive only where the section declared nothing and the id appears nowhere else in the file,
  // so a closed milestone's "shipped X, Y" paragraph isn't nagged. Filtered last to keep line order
  // narrowed by isRequirementId so "declared ids" means the same here as in audit's arithmetic
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
 * The ids from the `## Active` bullets, trimmed and deduped first-wins, or `null` (not `[]`) when the
 * heading is absent, so a caller can tell "no scope declared" from "declared, nothing matched".
 * A bullet with no bold span declares nothing, by design, and classifyActiveSection's issues make it
 * visible. A bold span that isn't id-shaped is still an id here, and audit filters it out with isRequirementId.
 * Delegates so seed-reqs' declared set can't drift from audit's.
 * @param {string} text @returns {string[]|null}
 */
export function parseActiveIds(text) {
  return classifyActiveSection(text).ids;
}

/**
 * Insert `## Traceability` rows for `rows: [{id, phase}]` with no row yet, at Status `Pending`.
 * Pending is a literal, not a parameter, so no writer but cad-verify can create any other Status.
 *
 * With no separator row the text comes back unchanged with `error: 'no-traceability-table'`.
 * An id that already has a row goes to `skipped`, and to `mismatched` when its Phase cell differs (a stale renumber).
 * The `Phase N` spelling is mandatory: a bare number would desync the table from shiftPhaseTokens.
 * The anchor line's ending is kept, since normalize stays off write paths.
 * @param {string} text @param {Array<{id: string, phase: number}>} rows
 * @returns {{text: string, inserted: string[], skipped: string[], mismatched: Array<{id: string, row_phase: number|null}>, error?: string}}
 */
export function insertReqRows(text, rows) {
  const lines = text.split('\n');
  // both ends from sectionSpan: a fence-blind start took the `## Traceability` in the template's own fence, and
  // seed-reqs then wrote rows into the example. No section outside a fence means text back unchanged, never a new table
  const { start, end } = sectionSpan(lines, '## Traceability');
  if (start === -1) {
    return { text, inserted: [], skipped: [], mismatched: [], error: 'no-traceability-table' };
  }

  // the separator is a `|`-bounded row of only dashes, colons and whitespace, as parseRequirements skips it
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

// recall corpus snippets for BM25. A missing section is data, not a throw; template placeholders are skipped

/**
 * One `## Heading` section's body, cut at the next `## ` outside a fence, or null when the heading is absent outside
 * one. Both ends come from `sectionSpan`: a `## build output` line in a fenced block neither ends the section nor
 * counts as its heading. A present empty section is "", never null, which parseContextDecisions's fallback rests on.
 * @param {string} text @param {string} heading
 * @returns {string|null}
 */
function sectionBody(text, heading) {
  // parse only: none of the callers writes the text back, the condition `normalize` sets, so CRLF reads as its LF twin
  const lines = normalize(text).split('\n');
  const { start, end } = sectionSpan(lines, `## ${heading}`);
  return start < 0 ? null : lines.slice(start + 1, end).join('\n');
}

/**
 * SUMMARY.md snippets: the `## Deviations` and `## Open items` bullets, minus a leading `[deviation]` tag.
 * Placeholder lines (`None...`, `<...>`) are the template's own prose, not content.
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
 * A task record's snippets: the `## What shipped` bullets of one `.planning/tasks/<slug>/RECORD.md`.
 *
 * Its own reader, not parseSummarySnippets: that one indexes only Deviations and Open items, so a query naming
 * exactly what a task did found five hits and none of them the task. Folding the heading into it would change
 * what recall returns for the phase tier.
 * Same rules otherwise: a `^-\s+` bullet, placeholders skipped, and an absent section is `[]`, never a throw,
 * which the empty-corpus contract in cmdRecall rests on. task-record.mjs writes the heading and this reads it.
 * @param {string} text one RECORD.md's bytes @returns {string[]}
 */
export function parseTaskRecordSnippets(text) {
  const out = [];
  const body = sectionBody(text, 'What shipped');
  if (!body) return out;
  for (const line of body.split('\n')) {
    const m = line.match(/^-\s+(.*)$/);
    if (!m) continue;
    const raw = m[1].trim();
    if (!raw || raw.startsWith('None') || raw.startsWith('<')) continue;
    out.push(raw);
  }
  return out;
}

/**
 * The `## ` sections of CAPTURE.md the recall walk visits, in order, without the `## ` prefix.
 *
 * One fact, one home: parseCaptureSnippets iterates this list and capture-file.mjs derives its kind-to-heading
 * map from it. A writer and reader disagreeing about the walk lost five filed bullets, and that only recurs
 * while the names are written in two places.
 * `## Archive` and `## Debt markers` are left out on purpose, walking every section would put 185 bullets
 * a milestone triage retired back into the BM25 corpus.
 * The order is load-bearing, capture-file.mjs maps its three kinds onto these names by position.
 */
export const CAPTURE_WALK_SECTIONS = Object.freeze(['Todos', 'Seeds', 'Notes']);

/**
 * The leading phase tag on a CAPTURE.md bullet, anchored after the checkbox strip. Four shapes and nothing more:
 * `(phase N)`, `(v3.2.0 phase N)`, `(phase N, label)` and the version-plus-label combination.
 *
 * Deliberately not `^\([^)]*\)`. A leading parenthetical outside this pattern is content: live bullets carry
 * `(cadence-wide)` or `(tooling)` as their only scope marker and this feeds BM25, so a greedy strip would eat
 * the only word they can be found by.
 */
const CAPTURE_PHASE_TAG = /^\((?:v\d+(?:\.\d+)*\s)?phase (\d+(?:\.\d+)?)(?:,[^)]*)?\)\s*/;

/**
 * CAPTURE.md snippets: every `- ` bullet under CAPTURE_WALK_SECTIONS, checkbox and phase tag stripped.
 *
 * An admitted tag is stripped whole: keeping the remainder of a version or label inside it would synthesize text.
 * Closed captures stay in the corpus, they carry the reasoning behind the fix, with a literal `[closed] ` prefix so a
 * planner doesn't read a shipped fix as live evidence.
 * The number must round-trip, `String(Number(n)) === n`: a bare Number() put Infinity in the corpus for a 400-digit
 * tag, and isSafeInteger would strip every legal sub-phase tag.
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
        // won't round-trip: no phase, and the tag stays in the text so the bullet keeps its bytes
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
 * Census of every `## ` section in a CAPTURE.md: name, bullet count, and whether parseCaptureSnippets visits it.
 *
 * Unconditional, no allowlist: exempting the sections expected to be out of the walk would have reported nothing on
 * the incident this exists for, where all five lost bullets sat under `## Archive`.
 * `heading` has no `## ` prefix, the spelling CAPTURE_WALK_SECTIONS uses, so `in-walk` is a membership test.
 * Fence-aware, and normalized so a CRLF checkout counts like its LF twin.
 * Limit: a bullet above the first `## ` belongs to no section and counts nowhere.
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
 * The `- D-NN (...): ...` lines under `## Durable decisions` in a context file, the durable-only recall
 * surface. Falls back to `## Decisions` only when the durable heading is absent (a pre-v1.2 legacy file).
 * sectionBody returns null for a missing heading but "" or a residual "\n" for a present one, so the fallback
 * tests `durable === null`. `!durable` or `||` would treat an empty durable section as absent and resurface
 * phase-local decisions.
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

// ARCHIVE.md: the recall residue a milestone close leaves behind
// a close removes `phases/<N>/` and every SUMMARY, UAT and context decision in it, so the residue is written
// before the directories go and carries the same snippets the live walk indexes
// the parser and appender sit together: milestone-prune writes it and recall reads it, and a writer/reader
// pair over one walk is the split-brain that cost five filed bullets

/**
 * One residue row: a column-0 `- `, the origin path in backticks, a colon, a space, then the snippet to end of line.
 * The path is fully constrained (`phases/<n>/` plus one of the three indexed filenames), which lets the snippet
 * carry a backtick, colon or pipe with no second escaping rule: the closing backtick is found by position.
 */
const ARCHIVE_ROW = /^- `(phases\/(\d+(?:\.\d+)?)\/(?:SUMMARY|UAT|CONTEXT)\.md)`: (.*)$/;

/** A column-0 `## ` heading opens a milestone section; its label is the rest. */
const ARCHIVE_SECTION = /^## (.*)$/;

/**
 * The preamble an empty residue file starts with. It names the one writer and one reader because a human
 * finding the file has no other way to learn that. No column-0 `## ` heading, so the parser can't read it
 * as a milestone section.
 */
const ARCHIVE_PREAMBLE = `# Archive: the recall residue of closed milestones

Written by \`planning.mjs milestone-prune\` before it removes a phase directory,
read by \`planning.mjs recall\` beside CAPTURE.md. One section per closed
milestone, one \`- \` row per snippet, each row naming the artifact it came from.
A line that is not a row is skipped, so a note added here mints no recall entry.
`;

/**
 * ARCHIVE.md rows in document order, as the `{text, source, phase}` shape cmdRecall builds its corpus from.
 *
 * `source` joins the milestone label and the origin path (`v3.5.2/phases/1/SUMMARY.md`).
 * Anything that isn't a row is skipped, so a human note can't mint a corpus entry. So is a row above the first `## `
 * heading and one whose phase number doesn't round-trip (`String(Number(n)) !== n`), since a bare Number() put Infinity
 * into the corpus. Not isSafeInteger, which would drop every legal `phases/1.1/` row.
 * Normalized like captureSections.
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
    // label and origin ride alongside the composed `source` so callers never re-split it: a label is free text,
    // and one holding a `/` makes the split ambiguous. A startsWith(label + '/') test then matches a row from a
    // different section (heading `v1/forged` answers `v1/`), which in cmdMilestonePrune suppresses a phase's
    // residue write and then removes its directory
    out.push({ text: m[3], source: `${label}/${m[1]}`, phase: Number(m[2]), label, origin: m[1] });
  }
  return out;
}

/**
 * Land `rows` under `label`'s section in ARCHIVE.md `text` and return the new text. They go after that section's last
 * row, so a resumed close extends its heading instead of minting a second one, or into a new section at the end.
 * Empty text gets ARCHIVE_PREAMBLE first. No I/O, never throws, the rest is byte-preserved.
 * Snippet and label are flattened on write, as renderUat does: an embedded newline becomes its own line on the next
 * parse. A row empty after flattening is dropped, since an empty corpus entry ranks against every query.
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
  // the first row in a section brings a blank line with it, matching the new-section arm
  lines.splice(last === -1 ? start + 1 : last + 1, 0,
    ...(last === -1 ? ['', ...emitted] : emitted));
  return lines.join('\n');
}

// FILED.md: the recall pointer a filed issue leaves behind
// cmdRecall reads no forge, so a finding routed to the tracker would drop out of the corpus
// accepted issues only: a declined title mirrored here would bring back the pile of declined findings
// a pointer, not the finding: no body, just enough to find the issue again
// its own file because CAPTURE.md and ARCHIVE.md both have to stay byte-unchanged

/**
 * One filed row: a column-0 `- `, an ISO date, the provider, the repository slug, the fingerprint token, a colon,
 * a space, then the title to end of line. Everything before the `: ` is constrained, so the title can carry a colon,
 * backtick or pipe with no escaping rule.
 * `unconfirmed` marks a create nobody could confirm: a timeout kill can follow a forge that already made the issue.
 * The row is written anyway so a retry reads "don't file this again". It sits before the colon because that side is
 * grammar, and a marker in the title is one a title could forge.
 */
const FILED_ROW = /^- (\d{4}-\d{2}-\d{2}) ([a-z]+) (\S+) ([0-9a-f]+)( unconfirmed)?: (.*)$/;

/**
 * The preamble an empty FILED.md starts with. It names the one writer and one reader because a human finding
 * the file has no other way to learn that. No column-0 `## ` heading, so nothing in it reads as anything else.
 */
const FILED_PREAMBLE = `# Filed: issues this repository's gates opened

Written by \`issue-filing.mjs file\` when a gate's finding is ACCEPTED and filed
on the tracker, read by \`planning.mjs recall\` beside CAPTURE.md. One \`- \` row
per filed issue: the date, the provider, the repository slug, the finding's
(file, claim) fingerprint and the issue's title. No finding body - a row is a
pointer to an issue, not a copy of it, and NOTHING here is a queue. A declined
finding is never written here; its record is a row in DECLINED.md beside this
file, which is deliberately outside the recall corpus. A line that is not a row
is skipped, so a note added here mints no recall entry.

A row carrying the word \`unconfirmed\` before its colon is a create this
repository could not confirm landed - the forge may hold that issue and may not.
It is kept so a later fire does not file the same finding twice; delete the row
once you have looked, and nothing else here is unverified.
`;

/**
 * The preamble an empty DECLINED.md starts with, same shape rules as FILED_PREAMBLE: a `# ` title, no `## ` heading.
 * A decline has to persist or the gate asks the same question on every fire. It used to persist as a labelled
 * issue on the forge, which put every refusal on a public board and made the tracker unreadable as a statement
 * of real work. The fingerprint is all the dedup needs, so it lives here and the forge never hears of it.
 */
const DECLINED_PREAMBLE = `# Declined: findings this repository said no to

Written by \`issue-filing.mjs file\` when a gate's finding is DECLINED, read by
\`issue-filing.mjs unfixed\` as the set it must never ask about again. Same row
grammar as FILED.md: the date, the provider, the repository slug, the finding's
(file, claim) fingerprint and its title.

NOT part of the recall corpus and not a queue. \`planning.mjs recall\` reads
CAPTURE.md, ARCHIVE.md, the task records and FILED.md by explicit path, and
this file is deliberately absent from that list - a decline is a closed
question, and putting closed questions in front of a planner is the
accumulation the corpus rules exist to prevent. Query it, do not load it.

A line that is not a row is skipped, so a human note added here changes nothing
the seam reads.
`;

/**
 * FILED.md rows in document order, as the `{text, source}` shape cmdRecall builds its corpus from.
 * `text` is the title alone, the only part a query shares words with: date, provider and slug would dilute the score.
 * `source` is the flat `FILED.md`, as the CAPTURE.md walk spells a top-level file.
 * A non-row line is skipped, and so is a blank title, for the reason appendArchiveRows drops an empty snippet.
 * An `unconfirmed` row carries `unconfirmed: true`; the field is absent on a confirmed row, not `false`.
 * @param {string} text
 * @returns {Array<{text: string, source: string, provider: string, slug: string,
 *   fingerprint: string, date: string, unconfirmed?: true}>}
 */
export function parseFiledRows(text) {
  return parseRows(text, 'FILED.md');
}

/**
 * DECLINED.md rows in document order, the same shape parseFiledRows answers with: a decline row is a filed
 * row written to a different file because it means the opposite thing.
 * The consumer is `issue-filing.mjs unfixed`, which wants `fingerprint` alone. `text` and `source` ride along
 * because the shape is shared, not because this file is a recall source.
 * It accepts `unconfirmed` too, since that's one grammar read by two functions. Nothing writes the flag here
 * (see appendDeclinedRow), and refusing it on this file alone would be a second grammar to keep in step.
 * @param {string} text
 * @returns {Array<{text: string, source: string, provider: string, slug: string,
 *   fingerprint: string, date: string, unconfirmed?: true}>}
 */
export function parseDeclinedRows(text) {
  return parseRows(text, 'DECLINED.md');
}

/** The shared body of both parsers. @param {string} text @param {string} source */
function parseRows(text, source) {
  /** @type {Array<{text: string, source: string, provider: string, slug: string,
   *   fingerprint: string, date: string, unconfirmed?: true}>} */
  const out = [];
  for (const line of normalize(text).split('\n')) {
    const m = line.match(FILED_ROW);
    if (!m) continue;
    const title = m[6].trim();
    if (!title) continue;
    out.push({ text: title, source, date: m[1], provider: m[2],
      slug: m[3], fingerprint: m[4], ...(m[5] ? { unconfirmed: true } : {}) });
  }
  return out;
}

/**
 * Land one filed row at the end of FILED.md `text`. Empty text gets FILED_PREAMBLE first. No I/O, never throws.
 * Every field is flattened on write, as appendArchiveRows does, or an embedded newline skips the row's tail.
 * A row that doesn't fit the grammar is refused by returning the text unchanged: this file's own parser couldn't
 * read it back.
 * `unconfirmed: true` writes the marker before the colon; absent means confirmed, same bytes as before.
 * The fingerprint dedup doesn't live here: mirrorFiled reads "returned its input" as "the grammar said no".
 *
 * @param {string} text
 * @param {{date: string, provider: string, slug: string, fingerprint: string,
 *   title: string, unconfirmed?: boolean}} row
 * @returns {string}
 */
export function appendFiledRow(text, row) {
  return appendRow(text, row, FILED_PREAMBLE);
}

/**
 * Land one declined row at the end of DECLINED.md `text` and return the new text. Same discipline as
 * appendFiledRow (flatten on write, refuse a row the parser couldn't read back) because it's the same grammar.
 * It never sets `unconfirmed`: that records a create whose outcome nobody could determine, and no create
 * precedes a decline, so there's no ambiguous remote write to describe. The shared parser still reads the
 * word, one grammar and not a per-file dialect.
 *
 * @param {string} text
 * @param {{date: string, provider: string, slug: string, fingerprint: string, title: string}} row
 * @returns {string}
 */
export function appendDeclinedRow(text, row) {
  return appendRow(text, row, DECLINED_PREAMBLE);
}

/** The shared body of both appenders.
 * @param {string} text @param {any} row @param {string} preamble */
function appendRow(text, row, preamble) {
  const flat = (v) => String(v ?? '').replace(/\s*\n+\s*/g, ' ').trim();
  const r = row && typeof row === 'object' ? row : /** @type {any} */ ({});
  const line = `- ${flat(r.date)} ${flat(r.provider)} ${flat(r.slug)} `
    + `${flat(r.fingerprint)}${r.unconfirmed === true ? ' unconfirmed' : ''}: ${flat(r.title)}`;
  if (!FILED_ROW.test(line)) return typeof text === 'string' ? text : '';
  const base = typeof text === 'string' ? text : '';
  if (!base.trim()) return `${preamble}\n${line}\n`;
  return `${base}${base.endsWith('\n') ? '' : '\n'}${line}\n`;
}

// the context file's `## Acceptance criteria` grammar, whose only consumer is `planning.mjs criteria-coverage`

// the canonical criterion head: column-0 dash, checkbox, bare `AC<N>` token, colon, text
// the id isn't hyphenated on purpose, REQ_ID_EXACT admits a hyphenated one, so a criterion id pasted into a
// plan's `requirements:` would read as a requirement id and mint a phantom `orphans.plan_ids` entry in audit
const CRITERION_HEAD = /^- \[( |x|X)\] (AC\d+):[ \t]*(.*)$/;

// any column-0 checkbox bullet, so `criterion-unidded` catches one naming no id, the legacy shape
const CRITERION_BOX = /^- \[[ xX]\]\s/;

// a checkbox bullet with something id-shaped in head position that CRITERION_HEAD refused: a second space,
// emphasis, a lowercase `ac`, a missing colon. Anchored there on purpose: a later id is an unidded bullet's prose
const CRITERION_HEAD_NEAR = /^- \[[ xX]\]\s*\**\s*AC\d+\b/i;

// an `AC<N>` token anywhere on a line, to decide whether an out-of-grammar line is worth reporting
const CRITERION_TOKEN = /\bAC\d+\b/;

// an indented bullet starting with an `AC<N>` token: a criterion the grammar can't see, so it reports
const CRITERION_SUB = /^\s+[-*+]\s+(?:\[[ xX]\]\s+)?AC\d+\b/;

// an `AC<N>` token in declaration position: head of the line after at most one list or heading marker, a checkbox,
// and any emphasis or code wrapper. It only answers declaresIds, and is wider than CRITERION_HEAD_NEAR on purpose:
// its consumer is an exemption that must not claim "declared nothing" while an id sits in the text
// each run of spaces belongs to exactly one `\s*`, so a long run can't backtrack
const CRITERION_ID_DECLARED = /^\s*(?:(?:[-*+]|#{1,6}|\d+[.)])\s*)?(?:\[[ xX]\]\s*)?(?:[*_`]+\s*)?AC\d+\b/i;

/**
 * Classify the `## Acceptance criteria` section of a context file: the criteria it declares as `{id, text}`, plus
 * lines that look like they declare one but fall outside the canonical head. Pure and total.
 * No exact heading is `{criteria: null, issues: []}`. A near-miss heading (`## Acceptance Criteria`, `###`) reports
 * `criteria-heading-near-miss` and still returns null, or a typo would drop criteria silently.
 * An indented line under an open criterion is a continuation, never classified; `CRITERION_SUB` is the exception.
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
    // no exact heading: look for a line meant to be it (capital C, trailing colon, `###`, up to three spaces of indent), or coverage goes silent
    const nearFenced = fenceScanner();
    for (let i = 0; i < lines.length; i++) {
      if (nearFenced(lines[i])) continue;
      if (/^ {0,3}#{1,6}\s*acceptance\s+criteri/i.test(lines[i])) {
        // 'unknown', never 'none': the section is never walked, so a typo mustn't earn the "declared nothing" exemption
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
  // a duplicate-id bullet isn't pushed but still absorbs its continuation lines, so it reports once
  let absorbing = false;
  // fenced blocks are skipped whole, or the grammar's own docs example parses as a live criterion with a phantom id
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
    // a checkbox bullet that isn't a criterion: tell malformed from unidded, since "add the id" fixes only the latter
    if (CRITERION_BOX.test(line)) {
      issues.push({ line: i + 1, text: issueText(line),
        code: CRITERION_HEAD_NEAR.test(line) ? 'criterion-malformed-id' : 'criterion-unidded' });
      continue;
    }
    if (!CRITERION_TOKEN.test(line)) continue;
    let code = 'criterion-prose-line'; // catch-all, never silent
    if (/^\s*[-*+]\s/.test(line)) {
      if (/^\s/.test(line)) code = 'criterion-indented-bullet';
      else if (/^[*+]\s/.test(line)) code = 'criterion-nondash-bullet';
      else code = 'criterion-unboxed-bullet';
    } else if (/^\s*\d+[.)]\s/.test(line)) code = 'criterion-ordered-item';
    else if (/^#{1,6}\s/.test(line)) code = 'criterion-heading';
    issues.push({ line: i + 1, code, text: issueText(line) });
  }
  // decided against the source lines, not issues[].text, a trimmed display copy. Fenced lines never reach issues,
  // so a documented example declares nothing. An empty `criteria` can mean nothing declared, a refused id or no section
  const declared = criteria.length > 0
    || issues.some((i) => CRITERION_ID_DECLARED.test(lines[i.line - 1]));
  return { criteria, issues, declaresIds: declared ? 'some' : 'none' };
}

// UAT.md: the persistent checklist

// item field order in the rendered file, pinned so rewrites are stable
// a field has to be registered to survive: parseUat takes any `key: value` line but renderUat filters against this
// list, so an unregistered field survives `init` and the first `record` destroys it
// `criterion` and `origin` sit right after `expected`, so a hand-added line there isn't moved by the first rewrite
const UAT_FIELDS = ['expected', 'criterion', 'origin', 'why_human', 'status',
  'job', 'commit', 'first_pass', 'source', 'evidence', 'reported', 'severity', 'cause', 'fix',
  'reason'];

// where a result came from. `user` is implicit and never written, so existing checklists stay byte-identical
// registration isn't optional: `uat record` took any string and silently stored nothing outside `verifier`, so a
// walk-executed pass looked like a user answer with nothing reporting the drop
export const UAT_SOURCES = ['user', 'verifier', 'model'];

// `criterion` marks a criterion-derived item by its presence, so `origin: criterion` only repairs a lost link
// `verifier` and `smoke` are the only origins criteria-coverage exempts from `untraced`
export const UAT_ORIGINS = ['criterion', 'verifier', 'smoke'];

// positive marker that a seam knowing `criterion` and `origin` wrote the checklist. Inferring "pre-field" from the
// absence of both item fields let a post-field checklist with dropped links absolve itself
// its absence is necessary for criteria-coverage's legacy exemption but not sufficient: the exemption also needs the
// phase's context to declare no `AC<N>` ids, since that grammar post-dates the fields. A marker-less checklist beside
// declared ids is a dropped link, reported as a `fieldless-checklist` break
export const UAT_FIELDS_VERSION = '1';
// the commit `test-policy ci-status` last passed every required job for, written only by that seam
const UAT_FM_FIELDS = ['status', 'phase', 'fields_version', 'sources', 'started', 'updated', 'ci'];

// `pending_ci` shows only when an item holds it, so older checklists render as before
// own keys only: `in` walks the prototype, and a hand-written `status: constructor` would make a count NaN
function countStatuses(items) {
  /** @type {Record<string, number>} */
  const counts = { pass: 0, fail: 0, pending: 0, skipped: 0, blocked: 0 };
  let pendingCi = 0;
  for (const it of items) {
    if (it.status === 'pending_ci') pendingCi++;
    else if (Object.prototype.hasOwnProperty.call(counts, String(it.status))) counts[String(it.status)]++;
  }
  if (pendingCi) counts.pending_ci = pendingCi;
  return counts;
}

/**
 * Index of the first `## ` line in `lines` outside a fenced code block, or -1.
 *
 * A bare `/^## /` test cut the section short on a `## build output` line inside a code block, destroying the
 * closing fence and everything after it, and the odd fence count made the regenerated `## Summary` render as
 * code. That broke UAT.md's promise that a hand-added section survives a rewrite verbatim.
 * Exported for `lib/why-record.mjs`, which bounds a task body with it so a fenced `## ` can't end the body early.
 * The debt harvest's CAPTURE.md writer uses `replaceSection`, which is built on `sectionSpan`.
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
 * Both ends of one `## ` section as absolute indices into `lines`: `{start, end}`, the heading's own line and the
 * next `## ` after it (or `lines.length`). Both are -1 when the heading doesn't occur outside a fence.
 *
 * One scanner, one walk, on purpose: a fence-blind `findIndex` took a fenced example of the heading in an earlier
 * section for the real one, and the scan resumed from there read the closing fence as an opener and swallowed every
 * later heading (CAPTURE.md lost `## Seeds` and `## Notes`). A fence-blind start can't be fixed by a fence-aware end.
 * @param {string[]} lines @param {string} heading
 * @returns {{start: number, end: number}}
 */
export function sectionSpan(lines, heading) {
  const fenced = fenceScanner();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    // fed every line in order and never restarted, so the fence state at `start` is the whole document's
    if (fenced(lines[i])) continue;
    if (start < 0) {
      if (lines[i].trim() === heading) start = i;
      continue;
    }
    if (/^## /.test(lines[i])) return { start, end: i };
  }
  return { start, end: start < 0 ? -1 : lines.length };
}

// a UAT `key: value` line and an item's `N. Name` head, written so a long run of spaces can't backtrack
const UAT_FIELD = /^(\w+):\s*(\S(?:.*\S)?|[^\S\n\r\u2028\u2029](?=[\n\r\u2028\u2029]*$))\s*$/;
const UAT_HEAD = /^(\d+)\.\s+(\S(?:.*\S)?|[^\S\n\r\u2028\u2029](?=[\n\r\u2028\u2029]*$))\s*$/;

/**
 * Parse UAT: full frontmatter plus items with their field lines. Counts are recomputed from the items, not Summary.
 *
 * An item head is anchored to the first line of its `### ` chunk. A numbered line deeper in (`1. check the
 * logs` inside a hand-written `### Manual notes`) is prose and must never mint an item.
 * UAT.md is partly user-owned: a `### ` chunk whose first line isn't `N. Name` is a hand-added section, returned
 * verbatim in `extras` and re-emitted by renderUat so the next `uat record` doesn't destroy it. Items stay
 * machine-owned and append-only.
 * @param {string} text
 */
export function parseUat(text) {
  text = normalizeCrlf(text);
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  /** @type {Record<string, string>} */
  const fm = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const f = line.match(UAT_FIELD);
      if (f) fm[f[1]] = f[2];
    }
  }
  const items = [];
  /** @type {string[]} Hand-added `### ` sections, preserved verbatim. */
  const extras = [];
  // one scanner fed every line in order: a `### ` line inside a fence is content, never a chunk start
  const fenced = fenceScanner();
  /** @type {string[][]} */
  const parts = [];
  for (const line of text.split('\n')) {
    const inFence = fenced(line);
    if (!inFence && line.startsWith('### ')) parts.push([line.slice(4)]);
    else if (parts.length) parts[parts.length - 1].push(line);
  }
  for (const lines of parts) {
    // both loops stop at the same fence-aware bound, a `## ` inside a code block is content
    const bound = sectionBound(lines);
    const body = bound === -1 ? lines : lines.slice(0, bound);
    const head = lines[0].match(UAT_HEAD);
    if (!head) {
      // a hand-added section, kept verbatim; trailing whitespace is trimmed so parse/render cycles are byte-stable
      const extra = `### ${body.join('\n')}`.replace(/\s+$/, '');
      if (extra !== '###') extras.push(extra);
      continue;
    }
    /** @type {Record<string, string|number>} */
    const item = { k: Number(head[1]), name: head[2] };
    for (const line of body.slice(1)) {
      const f = line.match(UAT_FIELD);
      if (f) item[f[1]] = f[2];
    }
    items.push(item);
  }
  const counts = countStatuses(items);
  return { status: fm.status || null, phase: fm.phase || null, fm, items, counts, extras };
}

/**
 * Render a UAT file from frontmatter and items, recomputing the Summary from the items (reworked = first_pass is
 * fail). Round-trips with parseUat.
 * `extras` are the hand-added `### ` sections parseUat preserved, emitted verbatim between the item blocks and
 * `## Summary`, never flattened, renumbered or reformatted.
 * @param {{fm: Record<string,string>, items: Array<Record<string,string|number>>, extras?: string[]}} uat
 */
export function renderUat({ fm, items, extras = [] }) {
  // every value is one line by contract: an embedded newline would become its own `field: value` line on the next
  // parse, and last-assignment-wins could flip a recorded verdict (an evidence string holding "\nstatus: pass"
  // must stay inert). Flatten on write, never trust callers
  const flat = (v) => String(v).replace(/\s*\n+\s*/g, ' ').trim();
  const fmLines = UAT_FM_FIELDS.filter((k) => fm[k] !== undefined)
    .map((k) => `${k}: ${flat(fm[k])}`);
  const blocks = items.map((it) => {
    const fields = UAT_FIELDS.filter((k) => it[k] !== undefined)
      .map((k) => `${k}: ${flat(it[k])}`);
    return `### ${it.k}. ${flat(it.name)}\n${fields.join('\n')}\n`;
  });
  const counts = countStatuses(items);
  const reworked = items.filter((i) => i.first_pass === 'fail').length;
  const summary = `total: ${items.length}\npassed: ${counts.pass}\nfailed: ${counts.fail}\n` +
    `pending: ${counts.pending}\n${counts.pending_ci ? `pending_ci: ${counts.pending_ci}\n` : ''}skipped: ${counts.skipped}\nblocked: ${counts.blocked}\nreworked: ${reworked}`;
  const kept = extras.map((e) => `\n${e}\n`).join('');
  return `---\n${fmLines.join('\n')}\n---\n\n## Items\n\n${blocks.join('\n')}${kept}\n## Summary\n\n${summary}\n`;
}

/**
 * The verify completion rule: every item pass, or skipped with a reason, and nothing failed, pending,
 * pending_ci or blocked. An empty checklist isn't complete.
 * @param {{items: Array<Record<string, string|number>>}} uat
 */
export function uatComplete(uat) {
  if (!uat.items.length) return false;
  return uat.items.every((i) =>
    i.status === 'pass' || (i.status === 'skipped' && i.reason));
}

// PLAN.md frontmatter: the `requirements: [..]` and `files: [..]` grammar

/**
 * @typedef {{line: number, code: string, text: string}} Issue
 */

/**
 * Strip one leading U+FEFF byte-order mark and normalize `\r\n` and lone `\r` to `\n`. Parse path only: it's wired
 * into the frontmatter reader, which never writes its text back, and deliberately not into planning.mjs's `read()`,
 * whose text `phase-done` and `renumber` write back verbatim. Doing it there would silently rewrite a user's CRLF
 * ROADMAP.md or REQUIREMENTS.md wholesale on the next edit. The roadmap grammar uses `normalizeCrlf` instead,
 * since it has write paths.
 * @param {string} text
 */
export function normalize(text) {
  const noBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return noBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * The roadmap parse normalizer: BOM and `\r\n` only, leaving a lone `\r` alone. The write paths split the raw bytes
 * on `\n`, so parsing a lone-CR file into real phases hands them one giant line: `renumber remove --n 1` returned
 * `ok:true` while leaving the old phase line in place and deleting its detail sections.
 * CRLF is safe because every write path matches without a `$` anchor or under `/m`, so a CRLF line round-trips byte
 * for byte. A lone-CR file has no such guarantee, so it stays unparseable and the caller bails.
 * @param {string} text
 */
function normalizeCrlf(text) {
  const noBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return noBom.replace(/\r\n/g, '\n');
}

/** Trim and truncate an offending line to 120 chars with a trailing `...`. */
export function issueText(line) {
  const t = line.trim();
  return t.length > 120 ? `${t.slice(0, 120)}...` : t;
}

/**
 * Scan a frontmatter value left to right tracking quote state: a quote opens a span when none is open and closes it
 * on the matching quote. An unquoted `#` ends the value there, with no `# ` vs `#x` rule, quoting decides: both
 * `requirements: #TODO fill this in` and `requirements: #41` scan to empty, and `"#41"` is data. Right-trimmed.
 * Ending inside a quote span yields `unterminated-quote` and an empty value, and callers mustn't fall through to
 * another arm on it: an apostrophe that never closes (`files: [src/it's-a-file.md]`) has no honest item
 * boundary, so yielding nothing beats a half-read.
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
 * Resolve one comment-stripped, trimmed candidate (list element, block-item payload or key remainder).
 *
 * A leading quote ends the value at the next same quote, none found gives `['unterminated-quote']`. Otherwise it
 * ends at the first whitespace, so an unquoted value can't contain a space; a non-whitespace rest pushes
 * `trailing-value-content` with the value still standing: parse, then diagnose.
 * `residual-quote` fires on a value with a backslash (the only way `files: ["a\"]` shows) or the quote that wrapped it.
 * Not a bare "contains a quote" test: it would fire on the grammar's own apostrophe path.
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
  // a backtick at the start or end of a resolved value is markdown that leaked into data. The grammar has no backtick
  // rule, so the value stands byte-exact and is reported, not rewritten (the old strip was a silent path rewrite)
  // a boundary test, not containment or a matched pair: containment fires on a real path like lib/a`b.mjs, and a pair
  // misses every near-miss, sharpest being a backtick-wrapped id where scanValue's unquoted-# rule cuts `#41` to a
  // lone backtick before this runs, minting a one-character phantom id that audit reports as an orphan
  if (value.startsWith('`') || value.endsWith('`')) {
    codes.push('backtick-wrapped-value');
  }
  return { value, codes };
}

/**
 * The four value-level codes scanValue and resolveValue raise about one value's own bytes, not the block around it.
 */
const VALUE_LEVEL_CODES = new Set([
  'unterminated-quote', 'trailing-value-content', 'residual-quote',
  'backtick-wrapped-value',
]);

/**
 * Scope value-level codes to the three list keys the seams read: `requirements`, `files` and `depends_on`. A defect in
 * `goal:` or `plan:` isn't about a list, and would reach plan-overlap's `frontmatter_issues` and the risk-floor bail
 * as if the file list were unreadable. A `depends_on` defect dropped here would read as no dependency, and two plans
 * that build on each other could look independent.
 * A defect under one list key still reaches a read of another. Applied at the push sites.
 * The structural codes own no key and skip this: they must reach every key's read, or a truncated `requirements:`
 * block reaches plan-overlap clean and `choose_path` reads it as proved independence.
 * A `null` key owns no list key, so its value-level codes go too.
 * @param {string|null} key @param {string[]} codes @returns {string[]}
 */
function scopeToListKeys(key, codes) {
  if (key === 'requirements' || key === 'files' || key === 'depends_on') return codes;
  return codes.filter((c) => !VALUE_LEVEL_CODES.has(c));
}

/**
 * Push one issue per distinct code, in first-occurrence order: five annotated elements in an inline list
 * report `trailing-value-content` once for the line, not five times.
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
 * Split a string on commas at quote depth 0, a comma inside a quoted span is literal.
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
 * Parse an inline flow list value, already comment-stripped by scanValue and known to start with `[`. The closing `]`
 * is found at quote depth 0 by the same left-to-right scan, never a `\[(.*)\]` capture: neither the greedy nor the
 * lazy form can see quoting.
 * No closing bracket gives `['unterminated-inline-list']`; non-whitespace after it gives `trailing-inline-content`.
 * The payload splits on commas at depth 0 with no escape state, so an escaped quote still closes at the first match.
 * Element codes follow the bracket-level one, and the caller dedupes per line.
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

// any column-0 `key:` line: a key's anchor, and one of the three things that end a block list
const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_.-]*):(\s|$)/;
const FENCE_LINE = /^---\s*$/;
const BLANK_LINE = /^\s*$/;
const COMMENT_LINE = /^\s*#/;
// a block-list item: any indent, `-`, one or more whitespace characters (a tab counts), then the payload. An empty
// payload contributes nothing, like a comment-only item. The whitespace is required, so a bare `-` falls through to
// `unknown-line` instead of reading as an empty item. There's no indentation or nesting rule
const ITEM_LINE = /^\s*-\s+(.*)$/;
// key-shaped but with no space after the colon (`requirements:["#41"]`); KEY_LINE stays strict so a URL isn't a key
const MALFORMED_KEY_LINE = /^[A-Za-z_][A-Za-z0-9_.-]*:/;

/**
 * Where a text's leading frontmatter block opens and closes, as indices into `lines`: leading blank lines are
 * tolerated, both fences are bare `---` lines, and any other first non-blank line means no block (null).
 * `close` is -1 when the block never closes. The one locator, so no reader can disagree about where a plan's
 * frontmatter is.
 * @param {string[]} lines
 * @returns {{open: number, close: number}|null}
 */
export function frontmatterBounds(lines) {
  let open = 0;
  while (open < lines.length && BLANK_LINE.test(lines[open])) open++;
  if (open >= lines.length || !FENCE_LINE.test(lines[open])) return null;
  let close = open + 1;
  while (close < lines.length && !FENCE_LINE.test(lines[close])) close++;
  return { open, close: close < lines.length ? close : -1 };
}

/**
 * Classify every line of a plan's leading frontmatter block in one pass: each key's value list and the stray lines.
 * One pass, not one scan per key, so the structural diagnostics don't depend on which key the caller asked for.
 * A key with an empty remainder opens a block that runs to another key line, the closing fence or the end of the
 * block. Anything else is `unknown-line` and skipped, never a fourth terminator, or it would truncate a list.
 * An item with no block key open is `item-without-key` and dropped, never attached to the last key.
 * @param {string} text
 * @returns {{keys: Map<string, string[]>, issues: Issue[]}}
 */
export function parseFrontmatter(text) {
  const norm = normalize(text);
  const lines = norm.split('\n');
  const bounds = frontmatterBounds(lines);
  if (!bounds) return { keys: new Map(), issues: [] };
  const { open: i, close: j } = bounds;
  const fenceStartLine = i + 1;
  if (j === -1) {
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
      currentKey = null; // a key line always ends the prior block
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
        if (first) currentKey = key; // block-eligible, items follow
      }
      pushIssues(issues, lineNo, line, scopeToListKeys(key, codes));
      if (first) keys.set(key, items);
      continue;
    }

    if (BLANK_LINE.test(line)) continue; // skipped, never a terminator

    if (COMMENT_LINE.test(line)) {
      // a comment whose body is key-shaped earns `commented-key-line` but isn't promoted to a terminator: with the `#`
      // stripped, an ordinary prose comment (`# TODO: fill this in`) is key-shaped too, and promoting it would let
      // prose truncate a real block
      // accepted cost: `requirements:` / `- "#41"` / `# files:` / `  - src/shared.rs` still folds `src/shared.rs` into
      // `requirements`, but now with the diagnostic beside it and `choose_path` routing sequential
      const body = line.replace(/^\s*#+\s*/, '');
      if (KEY_LINE.test(body)) issues.push({ line: lineNo, code: 'commented-key-line', text: issueText(line) });
      continue; // skipped either way, never a terminator
    }

    const im = line.match(ITEM_LINE);
    if (im) {
      const scanned = scanValue(im[1]);
      if (scanned.code) {
        pushIssues(issues, lineNo, line, scopeToListKeys(currentKey, [scanned.code]));
        // this arm returns before the no-block-key diagnosis below, so it makes that call itself
        if (!currentKey) issues.push({ line: lineNo, code: 'item-without-key', text: issueText(line) });
        continue;
      }
      if (scanned.value === '') continue; // comment-only item or empty `- ` payload, not an issue
      const resolved = resolveValue(scanned.value);
      pushIssues(issues, lineNo, line, scopeToListKeys(currentKey, resolved.codes));
      if (currentKey) {
        if (resolved.value) keys.get(currentKey).push(resolved.value);
      } else {
        // no block key open: the item is diagnosed and dropped, never attached to the latest key
        issues.push({ line: lineNo, code: 'item-without-key', text: issueText(line) });
      }
      continue;
    }

    if (MALFORMED_KEY_LINE.test(line)) {
      // key-shaped at column 0 but missing the whitespace after its colon (`requirements:["#41"]`): names the real
      // repair instead of the generic `unknown-line`. KEY_LINE stays strict, relaxing it would parse a bare
      // `http://example.com` as key `http`
      issues.push({ line: lineNo, code: 'malformed-key-line', text: issueText(line) });
      continue;
    }

    // not an item, comment, blank or key: recorded and skipped, and an active block carries on
    issues.push({ line: lineNo, code: 'unknown-line', text: issueText(line) });
  }

  return { keys, issues };
}

/**
 * Read one frontmatter key as a string list plus the pass's issues: every structural issue whatever key it sits
 * under, and the value-level four only where the owner is `requirements:`, `files:` or `depends_on:` (scopeToListKeys,
 * applied at the push sites). A thin selector over parseFrontmatter.
 * One reader for every list key because copies of the pattern would drift, and audit would accept a plan shape
 * the parallel-safety overlap check rejects.
 * @param {string} text @param {string} key
 * @returns {{items: string[], issues: Issue[]}}
 */
export function readFrontmatterList(text, key) {
  const { keys, issues } = parseFrontmatter(text);
  return { items: keys.get(key) ?? [], issues };
}

/**
 * The requirement ids a plan commits to deliver, plus the grammar issues from the pass that read them.
 * @param {string} text @returns {{ids: string[], issues: Issue[]}}
 */
export function parsePlanRequirements(text) {
  const { items, issues } = readFrontmatterList(text, 'requirements');
  return { ids: items, issues };
}

/**
 * Where the frontmatter `files:` list is written, for a diagnostic that has to name a line: the key line itself
 * (`line`/`text`), plus `lines`, the list's own declaring lines (the key line alone for the inline form, the item
 * lines for a block).
 * A locator, never a second parser: values are parseFrontmatter's to resolve, so the two can't disagree about what
 * a plan declared. It's bounded to one key's region so no other key's value can claim a line.
 * @param {string} text
 * @returns {{line: number, text: string, lines: {line: number, text: string}[]}}
 */
function filesListRegion(text) {
  const empty = { line: 1, text: '', lines: [] };
  const lines = normalize(text).split('\n');
  const bounds = frontmatterBounds(lines);
  if (!bounds || bounds.close === -1) return empty;
  const { open: i, close: j } = bounds;
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
 * The markdown wraps `isDecoratedPath` refuses around a declared `files:` path, as `[open, close]` pairs tested
 * against a value's two ends. Bold and `__` need no entry, they open and close on the single-byte pairs already
 * listed. Entries are single-byte so a wrap is recognised by its boundary bytes, never by counting repeats.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const WRAP_PAIRS = /** @type {const} */ ([
  ['*', '*'], // italic and, by repetition, bold
  ['_', '_'], // italic and, by repetition, __bold__
  ['<', '>'], // the autolink form
  ['[', ']'], // a bare bracket wrap - the link form is tested separately
]);

/**
 * The file paths a plan declares it touches: the frontmatter `files:` list unioned with every task's `- **Files:**`
 * line, plus the frontmatter arm's issues (either alone can go stale).
 * Frontmatter items are grammar-resolved already, so `add()`'s strip would be a second silent route to a wrong
 * `overlaps`: they go in verbatim. The task-line arm also adds its raw form, or plan-overlap could greenlight two
 * plans writing one file; extra entries only fail toward a phantom overlap, the safe direction.
 * `markdown-decorated-path` is reported on the frontmatter arm only and never repaired.
 * @param {string} text @returns {{files: string[], issues: Issue[]}}
 */
export function parsePlanFiles(text) {
  const files = new Set();
  /** The task-line arm's normalization: backticks and one trailing parenthetical. */
  const normalizeTaskItem = (raw) => raw.replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
  /**
   * Markdown decoration around a declared path, every shape under one code: a matched wrap (`WRAP_PAIRS`), the link
   * form (`[src/a.rs](src/a.rs)`), and a matched interior backtick pair (`` src/`a`.rs ``), two or more inside.
   *
   * A wrap is matched or it's nothing: `_` and `[` are legal path bytes. A path that opens and closes on the same
   * emphasis byte (`__main__`) over-fires and stays byte-exact, since a phantom diagnostic routes sequential, the safe
   * way. Backticks stay out of WRAP_PAIRS so a path in backticks keeps reporting `backtick-wrapped-value` alone.
   * @param {string} v @returns {boolean}
   */
  const isDecoratedPath = (v) => {
    // the link form first: it opens `[` and closes `)`, so no wrap pair reaches it
    if (v.startsWith('[') && v.endsWith(')') && v.includes('](')) return true;
    for (const [open, close] of WRAP_PAIRS) {
      if (v.length > open.length + close.length
        && v.startsWith(open) && v.endsWith(close)) return true;
    }
    let interior = 0;
    for (let idx = 1; idx < v.length - 1; idx++) if (v[idx] === '`') interior++;
    return interior >= 2;
  };
  const { items, issues } = readFrontmatterList(text, 'files');

  // refuse the lease spellings on both arms: `./a.txt`, `src/./a.txt` and `src//a.txt` name the same file as the plain
  // spelling, but lease-grammar reads them as different files. One arm alone would let them through the other's door
  // not pushed down into parseFrontmatter or readFrontmatterList: those serve `requirements:` too, where `//` and `./`
  // aren't path syntax
  const region = filesListRegion(text);
  let row = 0;
  let col = 0;
  /**
   * The `files:` list line a refused item was declared on. A cursor advances past each match, so `./a.txt` written
   * twice reports its own line each time. The search stays within the list's item lines, or a `requirements:`
   * value carrying the same text could claim the line.
   */
  const refuseFrontmatter = (item) => {
    for (; row < region.lines.length; row++, col = 0) {
      const at = region.lines[row].text.indexOf(item, col);
      if (at === -1) continue;
      col = at + item.length;
      return region.lines[row];
    }
    return region; // the key line, shouldn't be reachable
  };

  for (const f of items) {
    if (!f) continue;
    if (isRefusedSpelling(f)) {
      const at = refuseFrontmatter(f);
      issues.push({ line: at.line, code: 'redundant-path-segment', text: issueText(at.text) });
      continue;
    }
    // decoration is reported, never dropped or rewritten: the bytes go into `files` as declared so `overlaps` keeps
    // meaning "these two declarations intersect". The gate still moves because execute routes any non-empty
    // `frontmatter_issues` sequential. Same cursor as the refusal arm, so a path written twice reports its own line
    if (isDecoratedPath(f)) {
      const at = refuseFrontmatter(f);
      issues.push({ line: at.line, code: 'markdown-decorated-path', text: issueText(at.text) });
    }
    files.add(f); // verbatim, no rewriting after the grammar
  }
  for (const m of text.matchAll(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm)) {
    // measure to the `**Files:**` marker, not `m.index`: the leading `\s*` matches newlines and names an earlier line
    const line = text.slice(0, (m.index ?? 0) + m[0].indexOf('**Files:**')).split('\n').length;
    for (const raw of m[1].split(',')) {
      const f = normalizeTaskItem(raw); // the normalized form
      const trimmed = raw.trim(); // plus the raw form, the cross-arm bridge
      // one issue per refused comma element whichever form carries the spelling, and neither form is added
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

// renumbering: shift `Phase K` tokens and `phases/K/` paths in one pass; lowercase prose refs are reported only

/**
 * Shift every integer `Phase K` token and `phases/K/` path where K >= from by delta, in a single pass so a shifted
 * number is never re-shifted. Decimal phases are left alone on both forms: the path regex never matched them, and
 * shifting only the integer part of a decimal token desynced tokens from directories. renumber reports them for
 * the caller to re-place with judgment.
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

// a phase number in the cursor's `Next:`: the integer after one of the four commands that take one, or a capital
// `Phase K`. `\b(?!\.\d)` is shiftPhaseTokens's guard so a decimal stays, and the `\b` stops `\d+` backtracking into
// `12.1` and shifting its `1`. Lowercase `phase K`, `phases/K/` paths and other numbers aren't phase numbers
const NEXT_PHASE = /(\/cad-(?:context|plan|execute|verify)\s+|\bPhase )(\d+)\b(?!\.\d)/g;

/**
 * Shift the phase numbers in a cursor `Next:` value: each integer K >= from
 * moves by delta, once. Not `shiftPhaseTokens`, which also moves paths.
 * @param {string} next @param {number} from @param {number} delta
 */
export function shiftNextPhases(next, from, delta) {
  return next.replace(NEXT_PHASE, (m, lead, k) => Number(k) >= from ? `${lead}${Number(k) + delta}` : m);
}

/**
 * Does a cursor `Next:` value name phase n, by the same grammar
 * `shiftNextPhases` shifts?
 * @param {string} next @param {number} n
 */
export function nextNamesPhase(next, n) {
  return [...next.matchAll(NEXT_PHASE)].some((m) => Number(m[2]) === n);
}

/**
 * `renumber`'s REQUIREMENTS.md edit for both ops: `delta` 1 inserts at `at` (K >= at moves up one), -1 removes phase
 * `at` (K >= at+1 moves down). Only `## Traceability` rows whose Status is exactly `Pending` change, the rest comes
 * back byte for byte; section first, then status.
 * On a remove, a Pending row citing `Phase <at>` is an orphan: its Phase cell is blanked to `|  |` so audit sees
 * no-phase, not the shifted neighbour, and its id goes in `orphans`.
 * `movedComplete` holds Complete rows citing a phase this op moves or deletes: left as written for the caller to name.
 * @param {string} text @param {number} at @param {1 | -1} [delta]
 * @returns {{text: string, changes: Array<{line: number, before: string, after: string}>, movedComplete: string[], refs: Array<{line: number, text: string}>, orphans: string[]}}
 */
export function shiftPendingReqRows(text, at, delta = 1) {
  const lines = text.split('\n');
  const changes = [];
  /** @type {string[]} */
  const movedComplete = [];
  const refs = [];
  /** @type {string[]} */
  const orphans = [];
  const from = delta > 0 ? at : at + 1;
  const orphanToken = delta > 0 ? null : new RegExp(`\\bPhase ${at}\\b(?!\\.\\d)`);
  const trace = sectionSpan(lines, '## Traceability');
  const shipped = sectionSpan(lines, '## Shipped');
  // a missing section spans (-1, -1), so nothing is inside it
  const inside = (/** @type {{start: number, end: number}} */ s, /** @type {number} */ i) => i > s.start && i < s.end;
  const prose = new Set(findProsePhaseRefs(text, from).map((r) => r.line));
  const bare = (/** @type {string} */ l) => l.replace(/\r$/, '');
  const rowId = (/** @type {RegExpMatchArray} */ c) => c[1].replace(/\*/g, '').trim();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = inside(trace, i) ? line.match(REQ_ROW) : null;
    const status = cells ? cells[3].trim() : null;
    const moves = shiftPhaseTokens(line, from, delta);
    if (status === 'Pending') {
      if (prose.has(i + 1)) refs.push({ line: i + 1, text: line.trim() });
      let after = moves.text;
      if (orphanToken && orphanToken.test(cells[2])) {
        orphans.push(rowId(cells));
        after = shiftPhaseTokens(`|${cells[1]}|  |${line.slice(cells[1].length + cells[2].length + 3)}`, from, delta).text;
      }
      if (after === line) continue;
      changes.push({ line: i + 1, before: bare(line), after: bare(after) });
      lines[i] = after;
      continue;
    }
    // from `at` on both ops: on a remove that's the removed phase and everything it moves
    const cites = shiftPhaseTokens(line, at, delta).count > 0;
    if (status === 'Complete' && cites) movedComplete.push(rowId(cells));
    const frozen = line.startsWith('|') && (inside(trace, i) || inside(shipped, i));
    if (!frozen && (prose.has(i + 1) || cites)) refs.push({ line: i + 1, text: line.trim() });
  }
  return { text: lines.join('\n'), changes, movedComplete, refs, orphans };
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
 * Cut a phase's `### Phase N: ...` detail section out of ROADMAP text, from its heading to the next unfenced heading
 * of one to three `#`. Returns the text unchanged when it's absent. A name-less heading (exactly `### Phase N:`)
 * matches too, so a bare heading and its body aren't left behind.
 * That tolerance stays in this function: unifying every `Phase N:` matcher would change what counts as a phase for
 * status, audit, phase-done and the cursor's `total`. The locator is `phaseDetailSpans`, working on lines without
 * changing a byte, so a CRLF checkout round-trips.
 * @param {string} text @param {number} n
 */
export function cutPhaseDetail(text, n) {
  const lines = text.split('\n');
  const [span] = phaseDetailSpans(lines, n);
  if (!span) return text;
  // a section running to the end leaves the line before it terminated, as slicing the text at the heading did
  if (span.end === lines.length) return span.start > 0 ? `${lines.slice(0, span.start).join('\n')}\n` : '';
  return [...lines.slice(0, span.start), ...lines.slice(span.end)].join('\n');
}

// atomic write: write a sibling temp file and rename over the target, so a crash never leaves a torn file
// the temp name is unique per call (`<file>.<pid>.<n>.tmp`) and derived, never random
// last-write-wins on the target: a `uat record` racing a `phase-done` loses an edit
// a symlink at the temp path is refused with a throw: a planted `ROADMAP.md.tmp` link used to write bytes anywhere
// only the temp path is guarded, a symlinked target is replaced, which heals a tree an attack already touched
// cost: a planning file symlinked into a dotfiles tree is replaced on the next write

/** Bumped on every atomicWrite call, so no two share a temp path. */
let tmpSeq = 0;

/**
 * @param {string} file
 * @param {string} text
 * @throws when the temp path is a symlink - writing would follow it out of the tree
 */
export function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.${tmpSeq++}.tmp`;
  // lstatSync so the link is classified, not its target. A stale temp from a crashed process is overwritten, no wedge
  let st = null;
  try { st = lstatSync(tmp); } catch { /* ENOENT is the ordinary case */ }
  if (st && st.isSymbolicLink()) {
    throw new Error(`atomicWrite refused: temp path is a symlink: ${tmp}`);
  }
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}
