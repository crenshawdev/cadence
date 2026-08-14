// @ts-check
// capture-file.mjs - the ONE owner of `.planning/CAPTURE.md` file I/O. Every
// product writer of that file (`/cad-capture`, `/cad-execute`'s open-items
// append, `debt-harvest`) reaches the bytes through here, so the bullet format
// is stated once and no surface can name its own heading.
//
// WHY a module and not skill prose. Five filed bullets were lost because the
// writer was a model holding `Write`/`Edit` over the file: it appended below a
// heading the recall walk does not visit, and nothing could fail. A prose
// writer also has no test to redden. So the write is code, and the heading is
// not a parameter.
//
// THE THREE HEADINGS ARE ONE FACT WITH TWO IMPLEMENTATIONS. `CAPTURE_HEADINGS`
// below and the `['Todos', 'Seeds', 'Notes']` list inside `parseCaptureSnippets`
// in lib/planning-files.mjs (the recall walk) must name the same three sections:
// this module is the WRITE side of the walk that module READS. They are not
// unified into one export because the dependency would be circular - this file
// imports `sectionSpan` and `atomicWrite` from planning-files.mjs. If the walk
// there ever gains or drops a section, this map moves with it, and
// capture-file.test.mjs's per-kind rows plus planning.test.mjs's capture->recall
// round trip are what catch the drift.
//
// WHY the kind-to-heading map is FIXED here rather than validated at the entry.
// The structural cause of the lost bullets is that a writer COULD name a
// heading outside the walk. A validated `--section` flag closes that by
// checking; an absent flag closes it by construction, and only the second one
// survives the next caller who has a reason.
//
// WHY never `appendFileSync` at EOF (CONTEXT D-09). CAPTURE.md is sectioned
// markdown whose live heading order ends at `## Debt markers` - outside the
// walk - so an EOF append lands exactly where the lost bullets landed. The
// section is located with the EXPORTED `sectionSpan`, which is bounded at both
// ends and fence-aware; a bare heading scan was already the destructive half of
// a fixed bug (see `replaceSection`'s comment in planning.mjs), and the whole
// file is then written with `atomicWrite`.
//
// WHY `atomicWrite` is not touched (CONTEXT D-08). Its stated contract is
// crash-safety, not mutual exclusion, and 17 call sites across 4 files inherit
// anything added inside it. The guard is built ABOVE it, in this file.
'use strict';

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { atomicWrite, sectionSpan } from './planning-files.mjs';

/**
 * The kind a caller may ask for, and the heading it lands under. Not
 * extensible on purpose - see the header.
 */
export const CAPTURE_HEADINGS = {
  todo: '## Todos',
  seed: '## Seeds',
  note: '## Notes',
};

/** The three words `--kind` admits, in the order they are reported. */
export const CAPTURE_KINDS = Object.keys(CAPTURE_HEADINGS);

/**
 * The body an absent CAPTURE.md is created with - byte-for-byte the three
 * headings `cmdDebtHarvest` writes for that same case, so a queue created by
 * either writer is the one `/cad-capture` expects.
 */
export const EMPTY_CAPTURE = '## Todos\n\n- None.\n\n## Seeds\n\n- None.\n\n## Notes\n\n- None.\n';

/**
 * Render the bullet for one capture. The shapes are exactly the three
 * `skills/cad-capture/SKILL.md` used to restate in prose; they live here now
 * because two statements of one format is how the writer and the reader drifted
 * apart in the first place.
 *
 * The text is flattened to one line: a newline inside it would write a second
 * line that is not a bullet, which the walk drops silently - this phase's
 * headline bug arriving through the front door.
 * @param {string} kind @param {string} text @param {string} [phase]
 * @returns {string}
 */
function renderBullet(kind, text, phase) {
  const flat = text.replace(/\s*\r?\n\s*/g, ' ').trim();
  if (kind === 'seed') return `- ${flat}`;
  if (kind === 'note') return `- ${new Date().toISOString().slice(0, 10)} ${flat}`;
  return `- [ ] ${phase !== undefined ? `(phase ${phase}) ` : ''}${flat}`;
}

/**
 * Insert `bullet` at the END of `heading`'s section body, or append the whole
 * section when the heading is absent.
 *
 * Absent-heading arm: the heading is written WITH the bullet, so the bullet is
 * still inside the walk - which is what separates this from the EOF append D-09
 * refuses, where the bullet would land under whatever heading happened to be
 * last.
 * @param {string} text @param {string} heading @param {string} bullet
 * @returns {string}
 */
function insertBullet(text, heading, bullet) {
  const lines = text.split('\n');
  const { start, end } = sectionSpan(lines, heading);
  if (start < 0) {
    const sep = text === '' || text.endsWith('\n\n') ? '' : (text.endsWith('\n') ? '\n' : '\n\n');
    return `${text}${sep}${heading}\n\n${bullet}\n`;
  }
  // Back up over the blank lines that separate this section from the next, so
  // the bullet joins the section's own list rather than the gap after it.
  let at = end;
  while (at > start + 1 && lines[at - 1].trim() === '') at--;
  // An EMPTY section has no list to join: the bullet needs the blank line after
  // the heading that every other section already has.
  lines.splice(at, 0, ...(at === start + 1 ? ['', bullet] : [bullet]));
  return lines.join('\n');
}

/** Read a file or return null - an absent queue is data, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

/**
 * Append one bullet to `file` under its kind's heading.
 *
 * `kind` and `text` are already validated by the caller; `phase` is the
 * caller's OWN spelling of the phase number (`requirePhaseArg().raw`), so
 * `--phase 1.10` tags `(phase 1.10)` rather than a normalized `1.1`.
 *
 * An existing `- None.` placeholder is left where it is: removing it is a
 * different change with its own blast radius, and the walk reads past it.
 * @param {string} file @param {string} kind @param {string} text @param {string} [phase]
 * @returns {{ok: true, bullet: string, heading: string, created: boolean}
 *   | {ok: false, reason: string, detail: string}}
 */
export function appendCapture(file, kind, text, phase) {
  const heading = CAPTURE_HEADINGS[kind];
  if (!heading) return { ok: false, reason: 'bad-kind', detail: `unknown capture kind: ${kind}` };
  const bullet = renderBullet(kind, text, phase);
  const existing = read(file);
  const base = existing === null ? EMPTY_CAPTURE : existing;
  try {
    // The `--cadence` queue lives in a directory that may not exist yet
    // (`~/.claude/cadence/`), and `atomicWrite` renames a SIBLING temp file
    // into place, so the parent has to be there before the first write.
    if (existing === null) mkdirSync(dirname(file), { recursive: true });
    atomicWrite(file, insertBullet(base, heading, bullet));
  } catch (e) {
    return { ok: false, reason: 'write-failed',
      detail: `${file}: ${e && e.message ? e.message : String(e)}` };
  }
  return { ok: true, bullet, heading, created: existing === null };
}
