// @ts-check
// planning/capture-sections.mjs - `capture-sections`: every `## ` section of
// CAPTURE.md with its bullet count and whether the recall walk visits it.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { CAPTURE_WALK_SECTIONS, captureSections } from '../lib/planning-files.mjs';

// ---------------------------------------------------------------------------
// capture-sections - every `## ` section of CAPTURE.md with its bullet count
// and whether the recall walk visits it, so a bullet filed outside the walk is
// REPORTED rather than silent. `/cad-health` prints the out-of-walk rows.
//
// STANDALONE, beside `status`, never a drift kind inside it (D-07). `cmdStatus`
// returns `no-planning-dir` / `no-roadmap` / `unparseable-roadmap` before any
// drift is computed, so folding this in would hand no capture report at all to
// exactly the trees most likely to hold a mangled CAPTURE.md.
// ---------------------------------------------------------------------------
function cmdCaptureSections(dir, opts) {
  // Same present-but-unusable refusal `capture` and `debt-harvest` carry: a
  // flag with nothing usable after it is never silently answered about the
  // default path, which would report on a different file than the caller named.
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture-sections --file needs a path after it: --file <path to CAPTURE.md>',
      'name the CAPTURE.md to report on, or drop --file to use the one under --dir');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  /** @type {string} */
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    // ENOENT alone is the absent arm, and absence is DATA here as everywhere in
    // this seam - a project with no queue has no out-of-walk sections. Not the
    // module-level `read`, which flattens every error to null: an unreadable
    // but PRESENT queue reported as "no sections" is a check announcing all
    // clear about a file it could not open.
    if (e && /** @type {any} */ (e).code === 'ENOENT') {
      return ok({ file, exists: false, walk: CAPTURE_WALK_SECTIONS, sections: [] });
    }
    return fail('unreadable-capture', `${file}: ${e && e.message ? e.message : String(e)}`,
      'make that file readable and re-run - the queue is PRESENT and could not be opened, so this'
      + ' is not a report that no items are filed outside the recall walk');
  }
  ok({
    file,
    exists: true,
    walk: CAPTURE_WALK_SECTIONS,
    sections: captureSections(text)
      .map((s) => ({ heading: s.heading, bullets: s.bullets, in_walk: s.inWalk })),
  });
}

export { cmdCaptureSections };
