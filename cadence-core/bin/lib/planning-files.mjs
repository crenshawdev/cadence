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
 * error here). Header and separator rows are skipped.
 * @param {string} text
 */
export function parseRequirements(text) {
  const section = text.split(/^## Traceability\s*$/m)[1];
  if (!section) return [];
  const rows = [];
  for (const line of section.split('\n')) {
    const cells = line.match(/^\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!cells) continue;
    const id = cells[1].replace(/\*/g, '').trim();
    if (!id || id === 'Requirement' || /^-+$/.test(id)) continue;
    const phaseM = cells[2].match(/(\d+(?:\.\d+)?)/);
    rows.push({ id, phase: phaseM ? Number(phaseM[1]) : null, status: cells[3].trim() });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// ROADMAP.md / REQUIREMENTS.md - targeted single-line edits. These return the
// whole rewritten text so callers stay pure; nothing else in the file moves.
// ---------------------------------------------------------------------------

/**
 * Flip phase N's `## Phases` checkbox. Returns {text, line} (1-indexed) or
 * null when the phase line is not found.
 * @param {string} text @param {number} n @param {boolean} checked
 */
export function setPhaseBox(text, n, checked) {
  const lines = text.split('\n');
  const re = new RegExp(`^- \\[( |x)\\] \\*\\*Phase ${n}: `);
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
// UAT.md - the persistent checklist (templates/UAT.md).
// ---------------------------------------------------------------------------

// Item field order in the rendered file - pinned so rewrites are stable.
const UAT_FIELDS = ['expected', 'status', 'first_pass', 'source', 'evidence',
  'reported', 'severity', 'cause', 'fix', 'reason'];
const UAT_FM_FIELDS = ['status', 'phase', 'sources', 'started', 'updated'];

/**
 * Parse UAT: full frontmatter + items with their field lines. Counts are
 * always recomputed from the items, never read from Summary.
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
  const parts = text.split(/^### /m).slice(1);
  for (const part of parts) {
    const head = part.match(/^(\d+)\.\s+(.+?)\s*$/m);
    if (!head) continue;
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
  return { status: fm.status || null, phase: fm.phase || null, fm, items, counts };
}

/**
 * Render a UAT file from frontmatter + items, recomputing the Summary from
 * the items (reworked = items whose first_pass is fail). Round-trips with
 * parseUat.
 * @param {{fm: Record<string,string>, items: Array<Record<string,string|number>>}} uat
 */
export function renderUat({ fm, items }) {
  const fmLines = UAT_FM_FIELDS.filter((k) => fm[k] !== undefined)
    .map((k) => `${k}: ${fm[k]}`);
  const blocks = items.map((it) => {
    const fields = UAT_FIELDS.filter((k) => it[k] !== undefined)
      .map((k) => `${k}: ${it[k]}`);
    return `### ${it.k}. ${it.name}\n${fields.join('\n')}\n`;
  });
  const counts = { pass: 0, fail: 0, pending: 0, skipped: 0, blocked: 0 };
  for (const it of items) if (String(it.status) in counts) counts[String(it.status)]++;
  const reworked = items.filter((i) => i.first_pass === 'fail').length;
  const summary = `total: ${items.length}\npassed: ${counts.pass}\nfailed: ${counts.fail}\n` +
    `pending: ${counts.pending}\nskipped: ${counts.skipped}\nblocked: ${counts.blocked}\nreworked: ${reworked}`;
  return `---\n${fmLines.join('\n')}\n---\n\n## Items\n\n${blocks.join('\n')}\n## Summary\n\n${summary}\n`;
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
 * Extract the requirement IDs a plan commits to deliver.
 * @param {string} text
 */
export function parsePlanRequirements(text) {
  const m = text.match(/^requirements:\s*\[(.*)\]/m);
  if (!m) return [];
  return m[1].split(',').map((s) => s.replace(/["']/g, '').trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Renumbering - shift `Phase K` tokens and `phases/K/` paths in one pass.
// Capital-P `Phase K` is the structured form every template uses (list lines,
// detail headings, Depends on, traceability cells); lowercase prose refs are
// reported to the caller, never rewritten - that edit needs judgment.
// ---------------------------------------------------------------------------

/**
 * Shift every `Phase K` token and `phases/K/` path where K >= from by delta.
 * Single-pass replace, so a shifted number is never re-shifted.
 * @param {string} text @param {number} from @param {number} delta
 */
export function shiftPhaseTokens(text, from, delta) {
  let count = 0;
  const shift = (k) => { count++; return k + delta; };
  const out = text
    .replace(/\bPhase (\d+)\b/g, (m, k) => Number(k) >= from ? `Phase ${shift(Number(k))}` : m)
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
 * the section is absent.
 * @param {string} text @param {number} n
 */
export function cutPhaseDetail(text, n) {
  const re = new RegExp(`^### Phase ${n}: .*$`, 'm');
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
