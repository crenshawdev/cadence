// @ts-check
// milestone-prune.mjs - the mechanical half of a milestone close, as pure
// text transforms. `/cad-milestone` steps 3 and 5 were three hand-surgeries
// performed by the orchestrator in prose - remove completed phase lines and
// their detail sections from ROADMAP.md, archive the phase directories, move
// shipped requirement rows out of `## Active`/`## Traceability` into
// `## Shipped` - and every one of them has a recorded failure (a close that
// left the tree failing its own audit). These functions make the surgeries
// deterministic; planning.mjs `milestone-prune` owns the I/O around them.
//
// Pure and total like the rest of lib/planning-files.mjs: no I/O, no throw on
// malformed input - a section that cannot be found is reported, never
// invented. Everything not explicitly removed or inserted is byte-preserved.

import { parseRoadmapPhases, parseRequirements } from './planning-files.mjs';

/** Decimal-safe phase number in a RegExp (`2.1` must not match `291`).
 * @param {number} n */
const escN = (n) => String(n).replace(/\./g, '\\.');

/** Escape a requirement id for use in a RegExp. Ids are `CAT-01` shaped, but
 * escaping costs nothing and a stray `.` in one must not become a wildcard.
 * @param {string} id */
const escId = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Remove the completed phases' `- [x]` lines from `## Phases` and their
 * `### Phase N:` detail sections. Only the phases NAMED are touched - an
 * unchecked phase's line and section survive byte-identical, which is what
 * lets a close with deferred work leave the deferred phase in place.
 *
 * A detail section spans its `### Phase N:` heading to the next `### ` or
 * `## ` heading (exclusive), plus any trailing blank lines it owns, so the
 * removal never leaves a widening run of empty lines behind.
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
    const headRe = new RegExp(`^### Phase ${escN(n)}: `);
    let sectionFound = false;
    for (let i = 0; i < lines.length; i++) {
      if (!keep[i]) continue;
      if (lineRe.test(lines[i])) { keep[i] = false; removedLines++; continue; }
      if (headRe.test(lines[i])) {
        sectionFound = true;
        removedSections++;
        keep[i] = false;
        let j = i + 1;
        while (j < lines.length && !/^###? /.test(lines[j])) {
          keep[j] = false;
          j++;
        }
      }
    }
    if (!sectionFound) missingSections.push(n);
  }
  return {
    text: lines.filter((_, i) => keep[i]).join('\n'),
    removedLines,
    removedSections,
    missingSections,
  };
}

// The preamble written above a `## Shipped` table this transform has to
// CREATE. Matches the convention the dogfood repo already carries: rows stay
// rows so shipped-scope trace survives the phase-dir prune, and they leave
// `## Traceability` so the next milestone's audit starts clean.
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
 * Move the shipped milestone's requirements under `## Shipped`. Shipped =
 * every `## Traceability` row whose phase is in `completed` AND whose status
 * is not `Deferred`. For each id:
 * its `## Active` bullet (`- **ID**: summary`) is removed WHOLE - lead line
 * plus its indented continuation lines - its Traceability row is removed, and
 * one `| ID (summary) | phase | Complete | label |` row
 * lands in `## Shipped` - created after `## Active` when absent, appended
 * after the table's last row when present.
 *
 * The `Deferred` term is the one the siblings at `planning.mjs:317`, `:513`
 * and `:1023` already carry: a row held back on purpose belongs to the NEXT
 * milestone, and recording it here as `Complete` is this command - whose whole
 * job is auditing that nothing was dropped - reporting a drop as a delivery.
 * A Deferred row therefore keeps its Traceability row, keeps its `## Active`
 * bullet, and appears in no `moved` entry; the prose half of the close carries
 * it forward, which is what `phase-done --reqs` already assumes.
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

  // 1. Pull each shipped id's Active bullet (capturing its summary) and its
  //    Traceability row. Bullet form is the seeding convention
  //    (`- **ID**: line`); the row match is bounded to the Traceability
  //    section so a same-shaped row under `## Shipped` is never re-removed.
  //
  //    What is pulled is the bullet's SPAN, never its lead line alone (D-01):
  //    the lead line plus every following non-blank line that begins with
  //    whitespace, ended by a blank line or a column-0 line. Requirement
  //    bullets in a real project WRAP - all four in this repo's own
  //    `## Active` do - and the lead-line reader left the continuation lines
  //    behind as orphaned prose while archiving a row cut mid-sentence. It was
  //    hand-repaired at three consecutive closes before it was made to read the
  //    span. The lead-line match itself stays the narrow `- **<ID>**:` form
  //    built from `escId` (D-03), NOT `ACTIVE_BULLET` from planning-files.mjs,
  //    which reads any bold span as an id and would delete a `- **Note**:`
  //    prose bullet whose id happened to collide with a shipped one.
  //
  //    The bullet scan is bounded the same way, to `## Active` - heading to the
  //    next `^## `, the cut parseRequirements and lib/planning-files.mjs:388-391
  //    already use. Unbounded it read the WHOLE file, so an id carrying a
  //    bullet under `## Active` AND under a later hold section had both
  //    deleted and `summaries.set` ran twice - last write wins, and the
  //    deferral note became the shipped row's summary. The bound is by
  //    PLACEMENT, never by matching a hold section by NAME (D-07): the shipped
  //    template spells it `## v2 Requirements` where this repo spells it
  //    `## Deferred`, and a name match would fix one repository and leave every
  //    template-shaped project broken. A file with no `## Active` heading
  //    removes no bullet and captures no summary - the same answer it already
  //    gives for an id with no bullet.
  const activeAt = lines.findIndex((l) => /^## Active\s*$/.test(l));
  if (activeAt !== -1) {
    let activeEnd = lines.length;
    for (let i = activeAt + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) { activeEnd = i; break; }
    }
    let body = lines.slice(activeAt + 1, activeEnd);
    for (const { id } of shipped) {
      const bulletRe = new RegExp(`^- \\*\\*${escId(id)}\\*\\*:\\s*(.*)$`);
      const kept = [];
      for (let i = 0; i < body.length; i++) {
        const m = body[i].match(bulletRe);
        if (!m) { kept.push(body[i]); continue; }
        // The captured summary is that same span with each line trimmed and
        // joined on single spaces - no length cap (D-09) and no lowercasing of
        // the first letter (D-05), so the archived text is byte-faithful to the
        // bullet apart from the whitespace join. A heuristic that lowercased the
        // lead word to match past hand repairs would mangle a span opening on a
        // proper noun or an identifier, which is the worse failure.
        const parts = [m[1].trim()];
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
  let inTrace = false;
  const shippedIds = new Set(shipped.map((r) => r.id));
  lines = lines.filter((line) => {
    if (/^## Traceability\s*$/.test(line)) { inTrace = true; return true; }
    if (inTrace && /^## /.test(line)) inTrace = false;
    if (!inTrace) return true;
    const cells = line.match(/^\|([^|]*)\|/);
    if (!cells) return true;
    return !shippedIds.has(cells[1].replace(/\*/g, '').trim());
  });

  // 2. Build the shipped rows, summary parenthesized when the bullet had one.
  const newRows = shipped.map(({ id, phase }) => {
    const s = summaries.get(id);
    return `| ${id}${s ? ` (${s})` : ''} | ${phase} | Complete | ${label} |`;
  });

  // 3. Land them under `## Shipped`.
  const headingAt = lines.findIndex((l) => /^## Shipped\s*$/.test(l));
  let createdSection = false;
  if (headingAt === -1) {
    // Create the section right after `## Active`'s span (before the next
    // `## `), or at end of file when there is no Active section at all.
    createdSection = true;
    let insertAt = lines.length;
    const activeAt = lines.findIndex((l) => /^## Active\s*$/.test(l));
    if (activeAt !== -1) {
      insertAt = lines.length;
      for (let i = activeAt + 1; i < lines.length; i++) {
        if (/^## /.test(lines[i])) { insertAt = i; break; }
      }
    }
    lines.splice(insertAt, 0, '## Shipped', ...SHIPPED_PREAMBLE, ...newRows, '');
  } else {
    // Append after the last table row inside the section.
    let last = headingAt;
    for (let i = headingAt + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) break;
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
 * The completed (checked) phases of a roadmap, the seam's one derivation.
 * @param {string} roadmapText
 * @returns {number[]}
 */
export function completedPhases(roadmapText) {
  return parseRoadmapPhases(roadmapText).filter((p) => p.checked).map((p) => p.n);
}
