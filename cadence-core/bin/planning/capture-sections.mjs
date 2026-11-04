// @ts-check
// planning/capture-sections.mjs - `capture-sections`: every `## ` section of CAPTURE.md with its bullet count and whether the recall walk visits it
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { CAPTURE_WALK_SECTIONS, captureSections } from '../lib/planning-files.mjs';

// a bullet filed outside the walk is reported and not silent, and /cad-health prints the out-of-walk rows
// standalone and never a drift kind inside status: cmdStatus returns no-planning-dir, no-roadmap or unparseable-roadmap before any drift is computed, which would hand no capture report to exactly the trees most likely to hold a mangled CAPTURE.md
function cmdCaptureSections(dir, opts) {
  // same present-but-unusable refusal as capture and debt-harvest: a flag with nothing usable after it is never silently answered about the default path, which would report on a different file than the caller named
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
    // ENOENT alone is the absent arm, and absence is data: a project with no queue has no out-of-walk sections
    // not the module-level `read`, which flattens every error to null, since a present queue that can't be opened reported as "no sections" is an all-clear about a file nobody read
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
