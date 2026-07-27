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
 * @param {string} text
 */
export function parseRoadmapPhases(text) {
  const section = text.split(/^## Phases\s*$/m)[1];
  if (!section) return [];
  const body = section.split(/^## /m)[0];
  const phases = [];
  for (const line of body.split('\n')) {
    const m = line.match(PHASE_LINE);
    if (m) phases.push({ n: Number(m[2]), name: m[3], desc: m[4] || '', checked: m[1] === 'x' });
  }
  return phases.sort((a, b) => a.n - b.n);
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
// UAT.md - the persistent checklist (templates/UAT.md).
// ---------------------------------------------------------------------------

// Item field order in the rendered file - pinned so rewrites are stable.
const UAT_FIELDS = ['expected', 'status', 'first_pass', 'source', 'evidence',
  'reported', 'severity', 'cause', 'fix', 'reason'];
const UAT_FM_FIELDS = ['status', 'phase', 'sources', 'started', 'updated'];

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
  /** @type {{char: string, len: number}|null} */
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*(.*)$/);
    if (f) {
      const char = f[1][0], len = f[1].length;
      if (fence === null) fence = { char, len };
      else if (char === fence.char && len >= fence.len && !f[2].trim()) fence = null;
      continue;
    }
    if (fence === null && /^## /.test(lines[i])) return i;
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
 * to touch surgically. Phase 4 adopts this for the roadmap grammar it owns.
 * @param {string} text
 */
export function normalize(text) {
  const noBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return noBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
// A block-list item: any indent, then `-`, one or more spaces, then payload
// (payload may be empty - a bare `-` line contributes nothing, same as a
// comment-only item). No indentation/nesting rule - the grammar has none.
const ITEM_LINE = /^\s*-\s+(.*)$/;

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

    if (BLANK_LINE.test(line) || COMMENT_LINE.test(line)) continue; // skip, never a terminator

    const im = line.match(ITEM_LINE);
    if (im) {
      const scanned = scanValue(im[1]);
      if (scanned.code) {
        pushIssues(issues, lineNo, line, [scanned.code]);
        continue;
      }
      if (scanned.value === '') continue; // comment-only item / bare `-`: D-01 cost, not an issue
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

    // Neither item, comment, blank, nor terminator: recorded and SKIPPED -
    // it does not stop an active block, so nothing below it is lost (D-04).
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
 * `files:` list (via `readFrontmatterList`) unioned with every task's
 * `- **Files:** a, b` line (either source alone can go stale; the union is
 * what the parallel-safety overlap check trusts) - plus the frontmatter arm's
 * issues (D-09: the task-line arm is untouched this phase and reported
 * nowhere). Trailing parentheticals ("src/a.rs (new)") and backticks are
 * stripped; template placeholders ({...}) are ignored.
 * @param {string} text @returns {{files: string[], issues: Issue[]}}
 */
export function parsePlanFiles(text) {
  const files = new Set();
  const add = (raw) => {
    const f = raw.replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
    if (f && !f.startsWith('{')) files.add(f);
  };
  const { items, issues } = readFrontmatterList(text, 'files');
  for (const f of items) add(f);
  for (const m of text.matchAll(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm)) {
    for (const f of m[1].split(',')) add(f);
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
