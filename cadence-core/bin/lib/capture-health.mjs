// @ts-check
// lib/capture-health.mjs - the pure reading of a `.planning/CAPTURE.md` body: text in, findings out, no filesystem or verdict
// CAPTURE.md holds the phase in flight and nothing else, and that fails while an item can be settled without leaving the file:
// this repo's queue went to zero on 2026-08-08 and regrew to 276 walked bullets in sixteen days, 185 relocated under a
// `## Archive` heading in the same file and twelve annotated in place. Both moves leave the bytes where they were, so this
// answers three questions: how many substantive bullets the walk holds, which were adjudicated by annotation, and whether
// there's an `## Archive` heading at all
// it decides nothing, the bound is configured and the verdict is the caller's (`planning.mjs capture-check`, `phase-done`)
// pure so it's testable by fixture, which every check needs: the live tree has no annotation or archive heading and would pass them vacuously
'use strict';

import { CAPTURE_WALK_SECTIONS, sectionSpan, normalize } from './planning-files.mjs';

/**
 * The heading that is not part of this file's walk. Retiring a settled item into a section of the same document isn't a
 * resolution: the bytes stay, the recall walk stops seeing them, and five filed bullets were lost to exactly that. Its
 * presence is reported, never walked and never ignored.
 */
export const ARCHIVE_HEADING = 'Archive';

/**
 * The placeholder `EMPTY_CAPTURE` writes under all three walked headings, as it appears after the checkbox strip. A freshly
 * created queue is three of these and must count zero.
 * `captureSections` counts it as an ordinary bullet and keeps doing so, since it's a section report whose numbers are read
 * elsewhere and the walk really does index this line. This is a second count with a different definition, hence its own home.
 */
const PLACEHOLDER = 'None.';

/**
 * The two annotation shapes an in-place adjudication leaves behind. An item is resolved by removal (filed on the tracker or
 * dropped), so a bullet that gained a re-verification note got longer instead of leaving, twelve times in this repo's own queue.
 * `KEPT` is case-sensitive with a date after it, because the hand that keeps an item writes it in caps and lowercase `kept` is
 * ordinary prose. `recorded not fixed` is case-insensitive, nobody writes that phrase by accident.
 */
const ANNOTATIONS = Object.freeze([
  /\bKEPT \d{4}-\d{2}-\d{2}/,
  /recorded not fixed/i,
]);

/** A bullet by the capture grammar's definition: a column-0 `- `. */
const BULLET = /^-\s+(.*)$/;

/** A checkbox in any state, stripped before the text is read. */
const CHECKBOX = /^\[[ xX]\]\s*/;

/** Trim and truncate an offending line to 120 chars, as `issueText` does. */
function short(line) {
  const t = line.trim();
  return t.length > 120 ? `${t.slice(0, 120)}...` : t;
}

/**
 * The bullet's text with its checkbox stripped, or `null` when the line isn't a bullet: anything but a column-0 `- ` (an
 * indented continuation, a `* ` line, a table row, prose) isn't indexed.
 * @param {string} line
 * @returns {string|null}
 */
function bulletText(line) {
  const m = line.match(BULLET);
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw) return null;
  return raw.replace(CHECKBOX, '').trim();
}

/**
 * @typedef {object} CaptureHealth
 * @property {number} substantive total substantive bullets across the walk
 * @property {Array<{section: string, substantive: number}>} sections per walked heading, in walk order
 * @property {Array<{section: string, line: number, text: string}>} items every substantive bullet, in document order
 * @property {Array<{section: string, line: number, text: string}>} annotations walked bullets adjudicated in place
 * @property {{present: boolean, bullets: number}} archive the `## Archive` heading and what sits under it
 */

/**
 * Read a CAPTURE.md body.
 *
 * Sections are located with the exported `sectionSpan`, bounded at both ends by one fence-aware scanner, never a bare heading
 * scan: a fenced example of a heading was taken as the real one and the walk that resumed there read the block's closing
 * fence as an opener, swallowing `## Seeds` and `## Notes` outright.
 * Inside a section the line test is the walk's own, the same `^-\s+` parseCaptureSnippets indexes by with no fence state, so a
 * `- ` line inside a fenced block in someone's bullet counts here as the recall corpus counts it. This number answers "what
 * does the walk hold", not "what would a markdown renderer draw".
 * Line numbers are 1-based into the normalized text (BOM, CRLF, lone CR collapsed), so a CRLF checkout reports its LF twin's numbers.
 * @param {string} text
 * @returns {CaptureHealth}
 */
export function captureHealth(text) {
  const lines = normalize(text).split('\n');
  /** @type {Array<{section: string, substantive: number}>} */
  const sections = [];
  /** @type {Array<{section: string, line: number, text: string}>} */
  const annotations = [];
  // every substantive bullet, named: the count answers /cad-health's bound question, but the list is what the phase close
  // reports, since "the queue has 4 items" names nothing a reader can act on. Uncapped on purpose, the only bound is the queue's own
  /** @type {Array<{section: string, line: number, text: string}>} */
  const items = [];
  let substantive = 0;

  for (const section of CAPTURE_WALK_SECTIONS) {
    const { start, end } = sectionSpan(lines, `## ${section}`);
    let count = 0;
    // an absent heading is data: start < 0 skips the body loop and the section reports zero, as a queue that never had it holds
    for (let i = start + 1; start >= 0 && i < end; i++) {
      const body = bulletText(lines[i]);
      if (body === null) continue;
      if (body !== PLACEHOLDER) {
        count += 1;
        items.push({ section, line: i + 1, text: short(body) });
      }
      if (ANNOTATIONS.some((re) => re.test(body))) {
        annotations.push({ section, line: i + 1, text: short(body) });
      }
    }
    sections.push({ section, substantive: count });
    substantive += count;
  }

  const archiveSpan = sectionSpan(lines, `## ${ARCHIVE_HEADING}`);
  let archiveBullets = 0;
  for (let i = archiveSpan.start + 1; archiveSpan.start >= 0 && i < archiveSpan.end; i++) {
    if (bulletText(lines[i]) !== null) archiveBullets += 1;
  }

  return {
    substantive,
    sections,
    items,
    annotations,
    // every bullet under the heading, placeholder included: an Archive section has no empty state worth exempting
    archive: { present: archiveSpan.start >= 0, bullets: archiveBullets },
  };
}
