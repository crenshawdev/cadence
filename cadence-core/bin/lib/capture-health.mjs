// @ts-check
// lib/capture-health.mjs - the pure reading of a `.planning/CAPTURE.md` body:
// text in, findings out. No filesystem, no config, no verdict (CAP-01, CAP-03).
//
// CAPTURE.md holds the phase IN FLIGHT and nothing else. It cannot do that
// while an item can be settled without leaving the file: this repository's
// queue went to zero on 2026-08-08 and regrew to 276 walked bullets in sixteen
// days, 185 of them relocated under a `## Archive` heading inside the same file
// and twelve annotated in place with a re-verification date. Both moves leave
// the bytes exactly where they were. So this module answers the three questions
// a caller needs in order to say the file is transient:
//
//   1. how many SUBSTANTIVE bullets the recall walk holds,
//   2. which walked bullets were adjudicated by ANNOTATION rather than removal,
//   3. whether the body carries a `## Archive` heading at all.
//
// It decides nothing. The bound is configured and the verdict is the caller's -
// `planning.mjs capture-check` reads both, and `phase-done` reads (1) alone.
// The discipline is the one `lib/capture-file.mjs` and `lib/planning-files.mjs`
// already keep: a pure function over text is testable by fixture, and every
// check here HAS to be, because the live tree carries no annotation and no
// archive heading and would pass all of them vacuously.
'use strict';

import { CAPTURE_WALK_SECTIONS, sectionSpan, normalize } from './planning-files.mjs';

/**
 * The heading that is NOT part of this file (CAP-03). Retiring a settled item
 * into a section of the same document is not a resolution: the bytes stay, the
 * recall walk stops seeing them, and five filed bullets were lost to exactly
 * that. Its presence is REPORTED, never walked and never ignored.
 */
export const ARCHIVE_HEADING = 'Archive';

/**
 * The placeholder `EMPTY_CAPTURE` in `lib/capture-file.mjs` writes under all
 * three walked headings, as it appears AFTER the checkbox strip. A freshly
 * created queue is three of these and must count ZERO.
 *
 * `captureSections` in `lib/planning-files.mjs` counts it as an ordinary
 * bullet and keeps doing so: that function is a section REPORT whose numbers
 * are read elsewhere, and the walk it describes really does index this line.
 * This is a second count with a different definition, which is why it lives
 * here rather than as a change to that one.
 */
const PLACEHOLDER = 'None.';

/**
 * The two annotation shapes an in-place adjudication leaves behind. An item is
 * RESOLVED BY REMOVAL - filed on the tracker or dropped - so a bullet that
 * gained a re-verification note got LONGER instead of leaving, twelve times in
 * this repository's own queue.
 *
 * `KEPT` is matched case-SENSITIVELY with a date after it, because the word is
 * written in caps by the hand that keeps an item and lowercase `kept` is
 * ordinary prose in a bullet's sentence. `recorded not fixed` is matched
 * case-insensitively: it is a phrase nobody writes by accident.
 */
const ANNOTATIONS = Object.freeze([
  /\bKEPT \d{4}-\d{2}-\d{2}/,
  /recorded not fixed/i,
]);

/** A bullet on the capture grammar's own definition: a COLUMN-0 `- `. */
const BULLET = /^-\s+(.*)$/;

/** A checkbox in any state, stripped before the text is read. */
const CHECKBOX = /^\[[ xX]\]\s*/;

/** Trim and truncate an offending line to 120 chars, as `issueText` does. */
function short(line) {
  const t = line.trim();
  return t.length > 120 ? `${t.slice(0, 120)}...` : t;
}

/**
 * The bullet's text with its checkbox stripped, or `null` when the line is not
 * a bullet. Anything but a column-0 `- ` is not a bullet and is not indexed:
 * an indented continuation line, a `* ` line, a table row, prose.
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
 * Sections are located with the exported `sectionSpan`, which is bounded at
 * BOTH ends by one fence-aware scanner - never a bare heading scan, which was
 * the destructive half of a fixed bug: a fenced example of a heading was taken
 * as the real one and the walk that resumed there read the block's closing
 * fence as an opener, swallowing `## Seeds` and `## Notes` outright.
 *
 * Inside a located section the line test is the WALK's own - the same
 * `^-\s+` `parseCaptureSnippets` indexes by, with no fence state - so a `- `
 * line inside a fenced block in somebody's bullet counts here exactly as the
 * recall corpus counts it. That is the stated limit: this number answers "what
 * does the walk hold", not "what would a markdown renderer draw".
 *
 * Line numbers are 1-based into the NORMALIZED text (BOM, CRLF and lone CR
 * collapsed), because a CRLF checkout must report the same numbers as its
 * plain-LF twin.
 * @param {string} text
 * @returns {CaptureHealth}
 */
export function captureHealth(text) {
  const lines = normalize(text).split('\n');
  /** @type {Array<{section: string, substantive: number}>} */
  const sections = [];
  /** @type {Array<{section: string, line: number, text: string}>} */
  const annotations = [];
  // Every substantive bullet, named. The COUNT answers `/cad-health`'s bound
  // question; the LIST is what the phase close reports, because "the queue has
  // 4 items in it" at close names nothing a reader can act on. Uncapped on
  // purpose: the only bound on this list is the queue's own, which is the
  // thing being asserted.
  /** @type {Array<{section: string, line: number, text: string}>} */
  const items = [];
  let substantive = 0;

  for (const section of CAPTURE_WALK_SECTIONS) {
    const { start, end } = sectionSpan(lines, `## ${section}`);
    let count = 0;
    // An absent heading is DATA: `start < 0` skips the body loop and the
    // section reports zero, which is what a queue that never had that heading
    // holds.
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
    // Every bullet under the heading, placeholder included: an `## Archive`
    // section has no empty state worth exempting, and the number's job is to
    // say how much settled work is sitting in a file that holds the phase in
    // flight.
    archive: { present: archiveSpan.start >= 0, bullets: archiveBullets },
  };
}
