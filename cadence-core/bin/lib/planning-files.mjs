// @ts-check
// planning-files.mjs - format-pinned parsers/writers for the .planning file
// set. This is the ONLY place a .planning grammar lives (cursor, ROADMAP
// phases, REQUIREMENTS traceability, UAT items). A format change is one
// function here + its tests; workflow prose never describes file mechanics.
// Zero-dep: node: builtins only. Consumed by bin/planning.mjs and its tests.
'use strict';

import { writeFileSync, renameSync } from 'node:fs';

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
 * @param {string} text
 */
export function parseRoadmapPhases(text) {
  const section = normalizeCrlf(text).split(/^## Phases\s*$/m)[1];
  if (!section) return [];
  const body = section.split(/^## /m)[0];
  const phases = [];
  for (const line of body.split('\n')) {
    const m = line.match(PHASE_LINE);
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
 *   2. No `^## Phases$` heading -> `no-section`.
 *   3. Parse the CANONICAL extent (heading to the next `## `, today's bound)
 *      with `parseRoadmapPhases`; one or more matches -> `live` with those
 *      phases and no issues. A near-miss beside a real checkbox list is
 *      deliberately NOT reported: the checkbox list is the phase set.
 *   4. Otherwise scan the CLASSIFICATION extent - the heading to END OF TEXT,
 *      deliberately wider than the canonical bound (D-03) - for the phase
 *      token. Any match -> `out-of-grammar`, at most one issue per line, code
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
  let heading = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Phases\s*$/.test(lines[i])) { heading = i; break; }
  }
  if (heading === -1) return { state: 'no-section', phases: [], issues: [] };

  const phases = parseRoadmapPhases(text);
  if (phases.length) return { state: 'live', phases, issues: [] };

  /** @type {Issue[]} */
  const issues = [];
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
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
 * The section is BOUNDED at the next `## ` heading - the same idiom
 * parseRoadmapPhases/sectionBody use, and exactly the extent setReqStatus
 * already writes with, so the reader and the writer of this one table agree.
 * A table under any later `## ` section is somebody else's data.
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
  const section = text.split(/^## Traceability\s*$/m)[1];
  if (!section) return [];
  const body = section.split(/^## /m)[0];
  const rows = [];
  for (const line of body.split('\n')) {
    const cells = line.match(/^\|([^|]*)\|([^|]*)\|([^|]*)\|/);
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
 * @param {string} text @param {string[]} ids @param {string} status
 */
export function setReqStatus(text, ids, status) {
  const lines = text.split('\n');
  const changed = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Traceability\s*$/.test(lines[i])) { inTable = true; continue; }
    if (inTable && /^## /.test(lines[i])) inTable = false;
    if (!inTable) continue;
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
const REQ_ID_EXACT = /^(?:[A-Z][A-Z0-9]{1,7}-\d+|#\d+)$/;

/**
 * Is `id` exactly a requirement id, the whole string and nothing else? The
 * admission test for anything that moves `audit`'s arithmetic: `AUTH-01` yes,
 * `AUTH-01:` no (the colon belongs outside the bold span), `Note` no.
 * @param {string} id @returns {boolean}
 */
export function isRequirementId(id) {
  return REQ_ID_EXACT.test(id);
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
 *   2. No `^## Active$` line -> `{ids: null, issues: []}`. An absent heading is
 *      NOT an out-of-grammar report: it is the datum `audit`'s
 *      `no_active_section` already carries, and every project scaffolded before
 *      v1.4.0 is in that state (D-06).
 *   3. Otherwise walk from that heading to the next `^## ` - the same bound
 *      `sectionBody` cuts at, so `## Deferred` is never read (D-07). A line
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
  let heading = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Active\s*$/.test(lines[i])) { heading = i; break; }
  }
  if (heading === -1) return { ids: null, issues: [] };

  const ids = [];
  const seen = new Set();
  /** @type {Array<{issue: Issue, prose: string[]|null}>} */
  const found = [];
  let end = lines.length;
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) { end = i; break; }
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
 * The section is bounded at the next `## ` heading, exactly as
 * `parseRequirements`/`setReqStatus` already do - a table under a later
 * section is somebody else's data. Inside that bound, the header row's
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
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Traceability\s*$/.test(lines[i])) { start = i; continue; }
    if (start !== -1 && i > start && /^## /.test(lines[i])) { end = i; break; }
  }
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
 * CAPTURE.md item-level snippets: every `- ` bullet under `## Todos`,
 * `## Seeds`, `## Notes`, with a leading checkbox and `(phase N)` tag
 * stripped - the tag becomes the numeric `phase` field (omitted when the
 * bullet carries no tag; decimal phase numbers are legal).
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
 * @param {string} text @returns {Array<{text:string, phase?:number}>}
 */
export function parseCaptureSnippets(text) {
  const out = [];
  for (const heading of ['Todos', 'Seeds', 'Notes']) {
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
      raw = raw.replace(/^\(phase (\d+(?:\.\d+)?)\)\s*/, (_m, n) => { phase = Number(n); return ''; });
      out.push({ text: closed ? `[closed] ${raw}` : raw, ...(phase !== undefined ? { phase } : {}) });
    }
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
 * @param {string[]} lines
 * @returns {number}
 */
function sectionBound(lines) {
  const fenced = fenceScanner();
  for (let i = 0; i < lines.length; i++) {
    if (fenced(lines[i])) continue;
    if (/^## /.test(lines[i])) return i;
  }
  return -1;
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
  for (const it of items) if (it.status in counts) counts[String(it.status)]++;
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
  for (const it of items) if (String(it.status) in counts) counts[String(it.status)]++;
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
 * every code either arm produces reaches `issues` with its line number.
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
        pushIssues(issues, lineNo, line, [scanned.code]);
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
      pushIssues(issues, lineNo, line, codes);
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
        pushIssues(issues, lineNo, line, [scanned.code]);
        continue;
      }
      if (scanned.value === '') continue; // comment-only item / empty `- ` payload: D-01 cost, not an issue
      const resolved = resolveValue(scanned.value);
      pushIssues(issues, lineNo, line, resolved.codes);
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
 * Read one frontmatter key as a string list plus the WHOLE pass's issues
 * (never a key-scoped subset, D-02) - a thin selector over
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
 * Extract the requirement IDs a plan commits to deliver, plus any
 * frontmatter grammar issues from the pass that read them.
 * @param {string} text @returns {{ids: string[], issues: Issue[]}}
 */
export function parsePlanRequirements(text) {
  const { items, issues } = readFrontmatterList(text, 'requirements');
  return { ids: items, issues };
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
 * @param {string} text @returns {{files: string[], issues: Issue[]}}
 */
export function parsePlanFiles(text) {
  const files = new Set();
  const add = (raw) => {
    const f = raw.replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
    if (f && !f.startsWith('{')) files.add(f);
  };
  const { items, issues } = readFrontmatterList(text, 'files');
  for (const f of items) if (f) files.add(f); // verbatim - no post-grammar rewriting (D-19)
  for (const m of text.matchAll(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm)) {
    for (const raw of m[1].split(',')) {
      add(raw); // the normalized form, D-19's task-line arm
      const trimmed = raw.trim();
      if (trimmed && !trimmed.startsWith('{')) files.add(trimmed); // + the raw form, the cross-arm bridge
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
// ---------------------------------------------------------------------------

/**
 * @param {string} file
 * @param {string} text
 */
export function atomicWrite(file, text) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}
