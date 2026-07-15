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
// UAT.md - the persistent checklist (templates/UAT.md).
// ---------------------------------------------------------------------------

/**
 * Parse UAT: frontmatter status/phase + items with their field lines.
 * Counts are always recomputed from the items, never read from Summary.
 * @param {string} text
 */
export function parseUat(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const fmField = (k) => {
    const m = fm && fm[1].match(new RegExp(`^${k}:\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : null;
  };
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
  return { status: fmField('status'), phase: fmField('phase'), items, counts };
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
