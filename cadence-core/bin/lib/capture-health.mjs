// @ts-check
// lib/capture-health.mjs - the pure reading of a CAPTURE.md body: text in, findings out, no filesystem, no verdict
// an item can be settled without leaving the file: the queue regrew from zero to 276 bullets in sixteen days,
// 185 moved under `## Archive` and twelve annotated in place, so this counts what the walk holds
// it decides nothing: the bound is configured and the verdict is the caller's (`planning.mjs capture-check`)
// pure so a fixture can test it, since the live tree has no annotation or archive heading and would pass vacuously
'use strict';

import { CAPTURE_WALK_SECTIONS, sectionSpan, normalize } from './planning-files.mjs';

/**
 * The heading that is not part of this file's walk. Retiring a settled item into a section of the same document isn't a
 * resolution: the bytes stay, the recall walk stops seeing them, and five filed bullets were lost to exactly that. Its
 * presence is reported, never walked and never ignored.
 */
export const ARCHIVE_HEADING = 'Archive';

/**
 * The placeholder `EMPTY_CAPTURE` writes under all three walked headings, after the checkbox strip. A fresh queue is
 * three of these and must count zero.
 * `captureSections` still counts it as a bullet, because other numbers read from that and the walk indexes this line.
 */
const PLACEHOLDER = 'None.';

/**
 * The two annotation shapes an in-place adjudication leaves behind. Items are resolved by removal, so a bullet that
 * grew a re-verification note instead of leaving is the tell (twelve in this repo's own queue).
 * `KEPT` is case-sensitive with a date after it: whoever keeps an item writes caps, and lowercase `kept` is prose.
 * `recorded not fixed` is case-insensitive, nobody writes that phrase by accident.
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
 * The bullet's text with its checkbox stripped, or `null` when the line isn't a bullet: only a column-0 `- ` counts
 * (indented continuations, `* ` lines, table rows and prose aren't indexed).
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
 * Sections are located with the exported `sectionSpan`, bounded by one fence-aware scanner, never a bare heading scan:
 * a fenced example of a heading was taken as the real one, and the walk read its closing fence as an opener and
 * swallowed `## Seeds` and `## Notes`.
 * Inside a section the line test is the walk's own (the `^-\s+` parseCaptureSnippets indexes by, no fence state), so
 * this answers "what does the walk hold", not "what would a markdown renderer draw".
 * Line numbers are 1-based into the normalized text (BOM, CRLF, lone CR collapsed), so CRLF gets its LF twin's numbers.
 * @param {string} text
 * @returns {CaptureHealth}
 */
export function captureHealth(text) {
  const lines = normalize(text).split('\n');
  /** @type {Array<{section: string, substantive: number}>} */
  const sections = [];
  /** @type {Array<{section: string, line: number, text: string}>} */
  const annotations = [];
  // every substantive bullet, named: "the queue has 4 items" is nothing a reader can act on, so the close lists them
  // uncapped on purpose, the only bound is the queue's own
  /** @type {Array<{section: string, line: number, text: string}>} */
  const items = [];
  let substantive = 0;

  for (const section of CAPTURE_WALK_SECTIONS) {
    const { start, end } = sectionSpan(lines, `## ${section}`);
    let count = 0;
    // an absent heading is data: start < 0 skips the loop and the section reports zero
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
