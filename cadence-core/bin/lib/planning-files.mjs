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
    const head = part.split('\n', 1)[0].match(/^(\d+)\.\s+(.+?)\s*$/);
    if (!head) {
      // A hand-added section. Keep its lines to the same `## ` bound the
      // field loop uses; trailing whitespace is trimmed so repeated
      // parse/render cycles are byte-stable.
      const kept = [];
      for (const line of part.split('\n')) {
        if (/^## /.test(line)) break;
        kept.push(line);
      }
      const extra = `### ${kept.join('\n')}`.replace(/\s+$/, '');
      if (extra !== '###') extras.push(extra);
      continue;
    }
    /** @type {Record<string, string|number>} */
    const item = { k: Number(head[1]), name: head[2] };
    for (const line of part.split('\n').slice(1)) {
      if (/^## /.test(line)) break;
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
// PLAN.md frontmatter - the `requirements: [..]` list (templates/PLAN.md).
// ---------------------------------------------------------------------------

/**
 * Read one frontmatter key as a string list. ONE reader for both
 * `requirements:` and `files:` (D-07) - two copies of the same pattern would
 * drift, and the audit would then accept a plan shape the parallel-safety
 * overlap check rejects, in the very file that declares one grammar per
 * format.
 *
 * The lookup is BOUNDED to the leading `---`-fenced block (D-06). The other
 * parsers here scan the whole body, so this reads as inconsistent without
 * the reason: an unbounded key scan plus a permissive block reader lets a
 * prose `requirements:` line in the plan body swallow the following bullets
 * as ids, surfacing as fabricated `orphans.plan_ids` in audit - trading an
 * under-read for a worse over-read.
 *
 * The grammar is deliberately minimal - no nesting, no flow-in-block, no
 * comment-only lines. Three cases for the remainder after `key:`:
 *   `[a, b]`  inline list, split on commas. Never comment-stripped: the
 *             template writes `requirements: []     # phase requirement IDs`.
 *   (empty)   block list - the contiguous following `- item` lines, stopping
 *             at the first line that is not one. A remainder that is ITSELF
 *             a comment counts as empty.
 *   scalar    anything else non-empty: a one-element list. Explicitly NOT a
 *             fall-through to the block reader, which would discard the value
 *             AND swallow whatever `- ` lines follow it.
 * A trailing comment is stripped only on a WHITESPACE-preceded `#`, never a
 * bare one - this repo's own requirement ids are `#41`-shaped. That rule alone
 * cannot see a remainder that is ENTIRELY a comment: `^key:\s*(.*)$` has
 * already eaten the whitespace before the `#`, so `requirements:   # note`
 * arrives here as `# note` with nothing left to strip. Discriminate on what
 * FOLLOWS the `#` - whitespace or end-of-line is a comment (empty value, fall
 * through to the block reader), a non-space character is a `#41`-shaped id (a
 * scalar). Taking such a remainder as a scalar is the over-read D-06 bounds
 * against: it returns the comment text as a fabricated id AND discards the
 * block list beneath it.
 * @param {string} text @param {string} key @returns {string[]}
 */
function readFrontmatterList(text, key) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const lines = fm[1].split('\n');
  const head = new RegExp(`^${key}:\\s*(.*)$`);
  const at = lines.findIndex((l) => head.test(l));
  if (at === -1) return [];
  const clean = (s) => s.replace(/\s+#.*$/, '').replace(/["']/g, '').trim();
  const remainder = (lines[at].match(head) || ['', ''])[1].trim();

  if (remainder.startsWith('[')) {
    const inline = remainder.match(/\[(.*)\]/);
    // The inline payload is never comment-stripped - the template itself
    // writes `requirements: []     # phase requirement IDs...`.
    return (inline ? inline[1].split(',') : [])
      .map((s) => s.replace(/["']/g, '').trim()).filter(Boolean);
  }

  /** @type {string[]} */
  let raw;
  // `# `/bare `#` is a comment, `#41` is an id (see the note above). The
  // whitespace-preceded strip cannot fire on a remainder that is entirely a
  // comment, so that case is tested first rather than falling to the scalar arm.
  const commentOnly = /^#(\s|$)/.test(remainder);
  const bare = commentOnly ? '' : remainder.replace(/\s+#.*$/, '').trim();
  if (bare === '') {
    raw = [];
    for (const line of lines.slice(at + 1)) {
      const item = line.match(/^\s*-\s+(.+?)\s*$/);
      if (!item) break; // contiguous only; the first non-item line ends it
      raw.push(item[1]);
    }
  } else {
    raw = [bare]; // a scalar value - deliberately NOT a block fall-through
  }
  return raw.map(clean).filter(Boolean);
}

/**
 * Extract the requirement IDs a plan commits to deliver.
 * @param {string} text
 */
export function parsePlanRequirements(text) {
  return readFrontmatterList(text, 'requirements');
}

/**
 * Extract the file paths a plan declares it touches: the frontmatter
 * `files:` list (inline or block, via readFrontmatterList) unioned with
 * every task's `- **Files:** a, b` line
 * (either source alone can go stale; the union is what the parallel-safety
 * overlap check trusts). Trailing parentheticals ("src/a.rs (new)") and
 * backticks are stripped; template placeholders ({...}) are ignored.
 * @param {string} text @returns {string[]}
 */
export function parsePlanFiles(text) {
  const files = new Set();
  const add = (raw) => {
    const f = raw.replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
    if (f && !f.startsWith('{')) files.add(f);
  };
  for (const f of readFrontmatterList(text, 'files')) add(f);
  for (const m of text.matchAll(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm)) {
    for (const f of m[1].split(',')) add(f);
  }
  return [...files];
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
