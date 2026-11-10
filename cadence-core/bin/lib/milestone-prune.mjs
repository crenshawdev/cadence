// @ts-check
// the mechanical half of a milestone close, as pure text transforms
// pure and total: a section that can't be found gets reported, never invented

import { parseRoadmapPhases, parseRequirements, phaseDetailSpans, sectionSpan } from './planning-files.mjs';

/** Decimal-safe: `2.1` must not match `291`.
 * @param {number} n */
const escN = (n) => String(n).replace(/\./g, '\\.');

/** A stray `.` in an id must not become a wildcard.
 * @param {string} id */
const escId = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Remove the completed phases' `- [x]` lines from `## Phases` and their
 * `### Phase N:` detail sections. An unchecked phase stays byte-identical,
 * so a close with deferred work can leave the deferred phase in place.
 *
 * @param {string} text
 * @param {number[]} completed
 * @returns {{text: string, removedLines: number, removedSections: number,
 *            missingSections: number[]}}
 */
export function pruneRoadmap(text, completed) {
  const lines = text.split('\n');
  const keep = new Array(lines.length).fill(true);
  let removedLines = 0;
  let removedSections = 0;
  const missingSections = [];

  for (const n of completed) {
    const lineRe = new RegExp(`^- \\[x\\] \\*\\*Phase ${escN(n)}: `);
    // sections first: a checked line inside a removed section goes with it and isn't counted as a list line
    const spans = phaseDetailSpans(lines, n);
    for (const { start, end } of spans) {
      removedSections++;
      for (let j = start; j < end; j++) keep[j] = false;
    }
    if (!spans.length) missingSections.push(n);
    for (let i = 0; i < lines.length; i++) {
      if (keep[i] && lineRe.test(lines[i])) { keep[i] = false; removedLines++; }
    }
  }
  return {
    text: lines.filter((_, i) => keep[i]).join('\n'),
    removedLines,
    removedSections,
    missingSections,
  };
}

// rows stay rows so shipped-scope trace survives the prune, and they leave Traceability so the next audit starts clean
const SHIPPED_PREAMBLE = [
  '',
  'Delivered and verified. Kept as rows for shipped-scope trace; git history',
  'holds the full requirement text. Archived out of `## Traceability` so a new',
  "milestone's audit starts clean (the audit seam parses only the Traceability",
  'table).',
  '',
  '| Requirement | Phase | Status | Milestone |',
  '|-------------|-------|--------|-----------|',
];

/**
 * Move the shipped milestone's requirements under `## Shipped`. Shipped means
 * a Traceability row whose phase is in `completed` and whose status isn't
 * `Deferred`. A Deferred row keeps its Traceability row and its Active bullet,
 * because recording it as Complete would be this command reporting a drop as a
 * delivery.
 *
 * @param {string} text
 * @param {number[]} completed
 * @param {string} label
 * @returns {{text: string, moved: {id: string, phase: number|null}[],
 *            createdSection: boolean}}
 */
export function archiveRequirements(text, completed, label) {
  const rows = parseRequirements(text);
  const shipped = rows.filter((r) => r.phase !== null && completed.includes(r.phase)
    && r.status !== 'Deferred');
  if (!shipped.length) return { text, moved: [], createdSection: false };

  let lines = text.split('\n');
  const summaries = new Map();

  // pull the whole bullet span, not the lead line: bullets wrap, and the lead line alone left orphaned prose behind
  // the lead match stays the narrow `- **<ID>**:` form, so a `- **Note**:` prose bullet with a colliding id survives
  // bound the scan to `## Active` with sectionSpan, or an id also bulleted under a later hold section is deleted twice
  // sectionSpan is fence-aware at both ends: the template carries a fenced `## Active` example the old findIndex hit
  const { start: activeAt, end: activeEnd } = sectionSpan(lines, '## Active');
  if (activeAt !== -1) {
    let body = lines.slice(activeAt + 1, activeEnd);
    for (const { id } of shipped) {
      // the tracker suffix is `(#<digits>)` and nothing else, so prose bullets still can't match
      const bulletRe = new RegExp(`^- \\*\\*${escId(id)}\\*\\*(?: \\((#\\d+)\\))?:\\s*(.*)$`);
      const kept = [];
      for (let i = 0; i < body.length; i++) {
        const m = body[i].match(bulletRe);
        if (!m) { kept.push(body[i]); continue; }
        // keep the summary byte-faithful apart from the whitespace join: lowercasing the lead word mangles identifiers
        // the tracker ref rides the summary, it's the bullet's only pointer back to the issue
        const parts = [m[1] ? `${m[1]}:` : '', m[2].trim()];
        let j = i + 1;
        while (j < body.length && body[j].trim() && /^\s/.test(body[j])) {
          parts.push(body[j].trim());
          j++;
        }
        summaries.set(id, parts.filter(Boolean).join(' '));
        i = j - 1;
      }
      body = kept;
    }
    lines = [...lines.slice(0, activeAt + 1), ...body, ...lines.slice(activeEnd)];
  }
  // same sectionSpan bound as above; the old inTrace flag deleted rows out of a fenced example
  const { start: traceAt, end: traceEnd } = sectionSpan(lines, '## Traceability');
  const shippedIds = new Set(shipped.map((r) => r.id));
  if (traceAt !== -1) {
    const body = lines.slice(traceAt + 1, traceEnd).filter((line) => {
      const cells = line.match(/^\|([^|]*)\|/);
      if (!cells) return true;
      return !shippedIds.has(cells[1].replace(/\*/g, '').trim());
    });
    lines = [...lines.slice(0, traceAt + 1), ...body, ...lines.slice(traceEnd)];
  }

  // escape `|` here, not at capture: a bullet quoting `panel|single` would shift the table's columns, and --label too
  const cell = (s) => s.replace(/\|/g, '\\|');
  const newRows = shipped.map(({ id, phase }) => {
    const s = summaries.get(id);
    return `| ${id}${s ? ` (${cell(s)})` : ''} | ${phase} | Complete | ${label} |`;
  });

  // a fenced example `## Shipped` isn't the section, so a template-shaped doc gets a real one, not rows in a code block
  const { start: headingAt, end: shippedEnd } = sectionSpan(lines, '## Shipped');
  let createdSection = false;
  if (headingAt === -1) {
    // re-read the span because lines has shifted since the removal
    createdSection = true;
    const { end: afterActive } = sectionSpan(lines, '## Active');
    const insertAt = afterActive === -1 ? lines.length : afterActive;
    lines.splice(insertAt, 0, '## Shipped', ...SHIPPED_PREAMBLE, ...newRows, '');
  } else {
    // the scan ends at the span's end, not a fresh `## ` break, or a fenced `## ` in a preamble cuts it short
    let last = headingAt;
    for (let i = headingAt + 1; i < shippedEnd; i++) {
      if (/^\|/.test(lines[i])) last = i;
    }
    lines.splice(last + 1, 0, ...newRows);
  }

  return {
    text: lines.join('\n'),
    moved: shipped.map(({ id, phase }) => ({ id, phase })),
    createdSection,
  };
}

/**
 * The completed (checked) phases of a roadmap.
 * @param {string} roadmapText
 * @returns {number[]}
 */
export function completedPhases(roadmapText) {
  return parseRoadmapPhases(roadmapText).filter((p) => p.checked).map((p) => p.n);
}
