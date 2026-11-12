// @ts-check
// state-views.mjs - the three files generated from a project state: the `## Phases` list, the `## Traceability` table and STATE.md
// pure: a state and a file's current text in, the new text out, no disk
// only the generated span changes; every other byte comes back as it was, including the `### Phase N:` detail sections
// a line the state already agrees with is kept as written, so a project whose files are in step renders to the same bytes
// a missing heading is flagged and never invented
// an entry-shaped line under the heading that opens with a phase but isn't a phase line (`- Phase 3: X`) is view text too, and goes
'use strict';

import { parseRequirements, parseRoadmapPhases, renderCursor, sectionSpan } from './planning-files.mjs';
import { fenceScanner } from './text-util.mjs';

/** @typedef {import('./project-state.mjs').ProjectState} ProjectState */

/**
 * Swap the rows of one generated block. The old rows go, the wanted rows land where the first old one stood (or at
 * `fallback` when there were none), and every line between and around them stays.
 * @param {string[]} lines
 * @param {Map<number, string>} old line index -> the row's key
 * @param {{key: string, line: string}[]} wanted
 * @param {number} fallback where to insert when there are no old rows
 */
function swapRows(lines, old, wanted, fallback) {
  const written = new Map();
  for (const [i, key] of old) if (!written.has(key)) written.set(key, lines[i]);
  const rows = wanted.map((w) => written.get(w.key) ?? w.line);
  const at = old.size ? Math.min(...old.keys()) : fallback;
  const out = [];
  for (let i = 0; i <= lines.length; i++) {
    if (i === at) out.push(...rows);
    if (i < lines.length && !old.has(i)) out.push(lines[i]);
  }
  return out;
}

// an entry-shaped line: a list marker, a table bar, then (after an optional box and bold marks) `Phase N` first
const MALFORMED_ENTRY = /^\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|\|\s*)\*{0,2}Phase \d+(?:\.\d+)?\b/;

const eolOf = (/** @type {string} */ line) => (line.endsWith('\r') ? '\r' : '');

/**
 * Regenerate the `## Phases` checkbox list: one line per phase in numeric order, checked when the phase is complete.
 * @param {ProjectState} state @param {string} text the current ROADMAP.md
 * @returns {{text: string, missing: boolean}} `missing` when the file has no `## Phases` heading, with the text unchanged
 */
export function renderPhasesList(state, text) {
  const lines = text.split('\n');
  const { start, end } = sectionSpan(lines, '## Phases');
  if (start < 0) return { text, missing: true };
  const eol = eolOf(lines[start]);

  // the same parse the reader runs, one line at a time, with the fence state the reader would have
  const fenced = fenceScanner();
  /** @type {Map<number, string>} */
  const old = new Map();
  for (let i = start + 1; i < end; i++) {
    if (fenced(lines[i])) continue;
    const p = parseRoadmapPhases(`## Phases\n${lines[i].replace(/\r$/, '')}`)[0];
    if (p) old.set(i, `${p.n}|${p.name}|${p.desc}|${p.checked}`);
    // a bullet, numbered item or table row that opens with a phase is a malformed entry; the key can't match a wanted row
    else if (MALFORMED_ENTRY.test(lines[i])) old.set(i, `malformed|${i}`);
  }

  const wanted = [...state.phases].sort((a, b) => a.n - b.n).map((p) => {
    const checked = p.status === 'complete';
    return {
      key: `${p.n}|${p.name}|${p.description}|${checked}`,
      line: `- [${checked ? 'x' : ' '}] **Phase ${p.n}: ${p.name}**${p.description ? ` - ${p.description}` : ''}${eol}`,
    };
  });

  if (old.size || !wanted.length) return { text: swapRows(lines, old, wanted, start + 1).join('\n'), missing: false };
  // with no list yet, the first line goes after the heading's blank line, and a blank follows the list when text comes next
  const blank = lines[start + 1] !== undefined && lines[start + 1].trim() === '';
  const base = blank ? lines : [...lines.slice(0, start + 1), eol, ...lines.slice(start + 1)];
  const at = start + 2;
  const out = swapRows(base, old, wanted, at);
  const next = out[at + wanted.length];
  if (next !== undefined && next.trim() !== '') out.splice(at + wanted.length, 0, eol);
  return { text: out.join('\n'), missing: false };
}

/**
 * Regenerate the `## Traceability` rows: one per requirement, in the form `insertReqRows` writes. The header and the
 * separator stay. A section with no table is flagged and left alone, since this never invents one.
 * @param {ProjectState} state @param {string} text the current REQUIREMENTS.md
 * @returns {{text: string, missing: boolean}}
 */
export function renderTraceability(state, text) {
  const lines = text.split('\n');
  const { start, end } = sectionSpan(lines, '## Traceability');
  if (start < 0) return { text, missing: true };

  // the separator is a `|`-bounded row of only dashes, colons and whitespace, as `insertReqRows` finds it
  let sep = -1;
  for (let i = start + 1; i < end; i++) {
    if (!lines[i].startsWith('|')) continue;
    const cells = lines[i].split('|').slice(1, -1);
    if (cells.length >= 2 && cells.every((c) => /^[-:\s]+$/.test(c))) { sep = i; break; }
  }
  if (sep < 0) return { text, missing: true };
  const eol = eolOf(lines[sep]);

  /** @type {Map<number, string>} */
  const old = new Map();
  for (let i = sep + 1; i < end; i++) {
    const r = parseRequirements(`## Traceability\n${lines[i].replace(/\r$/, '')}`)[0];
    if (r) old.set(i, `${r.id}|${r.phase}|${r.status}`);
  }
  const wanted = state.requirements.map((r) => ({
    key: `${r.id}|${r.phase}|${r.status}`,
    line: `| ${r.id} | ${r.phase === null ? '' : `Phase ${r.phase}`} | ${r.status} |${eol}`,
  }));
  return { text: swapRows(lines, old, wanted, sep + 1).join('\n'), missing: false };
}

/**
 * The whole STATE.md. With a cycle open it is the cursor `renderCursor` writes today; with none, a file that says so
 * in words and keeps the `Next:` and `Updated:` lines, never a `Phase: 1 of 0` line.
 * @param {ProjectState} state
 */
export function renderStateMd(state) {
  const c = state.cursor;
  if (!state.cycleOpen) {
    const tail = c ? `\nNext: ${c.next}\nUpdated: ${c.updated}\n` : '';
    return `# State\n\nNo cycle is open: the last milestone is closed and the next one has not started.\n${tail}`;
  }
  if (!c) return '# State\n\nNo cursor is recorded yet.\n';
  const phase = state.phases.find((p) => p.n === c.phase);
  return renderCursor({
    phase: c.phase, total: state.phases.length, name: phase ? phase.name : `Phase ${c.phase}`,
    status: c.status, next: c.next, updated: c.updated, ...(c.plan ? { plan: c.plan } : {}),
  });
}
