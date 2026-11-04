// @ts-check
// planning/capture-check.mjs - `capture-check`: what .planning/CAPTURE.md holds right now, as a report: the substantive walked count, the annotated bullets, and the `## Archive` heading that's no longer part of this file's contract
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { captureHealth, ARCHIVE_HEADING } from '../lib/capture-health.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';

// CAPTURE.md holds the phase in flight and a hand sweep to zero regrew within weeks, so queue size, an item settled in place by annotation and an archive heading holding retired work are the three signs the file stopped being transient
// nothing here refuses: every verdict is a report on an ok:true envelope, and the only ok:false arms are bad arguments and a present file that couldn't be read. A seam that blocked on a big queue is one every caller learns to route around
// standalone and not folded into status: cmdStatus returns no-planning-dir, no-roadmap or unparseable-roadmap before any drift is computed, which would hand no report to exactly the trees most likely to hold a mangled CAPTURE.md
function cmdCaptureCheck(dir, opts) {
  // same present-but-unusable refusal as capture and capture-sections: a flag with nothing usable after it is never silently answered about the default path
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture-check --file needs a path after it: --file <path to CAPTURE.md>',
      'name the CAPTURE.md to report on, or drop --file to use the one under --dir');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  // mergeLayers warnings[]: bound and ridden on the envelope when non-empty, which lib/merge-warnings.mjs holds every callsite to. A torn layer reads the bound as unset and falls back to the default, so a project that raised its bound would be told it crossed a number it doesn't use
  const { config, warnings } = mergeLayers(join(dir, 'config.json'));
  const bound = usableBound(config?.planning?.max_capture_bullets)
    ? config.planning.max_capture_bullets : DEFAULT_MAX_CAPTURE_BULLETS;
  const rest = warnings.length ? { bound, warnings } : { bound };
  /** @type {string} */
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    // ENOENT alone is the absent arm, and absence is data: a project with no queue has an empty queue
    // not a catch-all, since a present queue that can't be opened reported as zero items is an all-clear about a file nobody read
    if (e && /** @type {any} */ (e).code === 'ENOENT') {
      return ok({ file, exists: false, ...rest, ...report(captureHealth(''), bound) });
    }
    return fail('unreadable-capture', `${file}: ${e && e.message ? e.message : String(e)}`,
      'make that file readable and re-run - the queue is PRESENT and could not be opened, so this'
      + ' is not a report that the queue is empty, carries no annotated item and holds no'
      + ` \`## ${ARCHIVE_HEADING}\` heading`);
  }
  ok({ file, exists: true, ...rest, ...report(captureHealth(text), bound) });
}

/**
 * The reading, in envelope spelling. Split out so the absent arm answers with the same fields as the present one
 * and not an envelope a caller has to branch on.
 * @param {ReturnType<typeof captureHealth>} health @param {number} bound
 */
function report(health, bound) {
  return {
    substantive: health.substantive,
    // both numbers ride the envelope and the crossing is a boolean over them, not a second copy of either
    over_bound: health.substantive > bound,
    sections: health.sections,
    annotations: health.annotations,
    archive: { heading: `## ${ARCHIVE_HEADING}`, ...health.archive },
  };
}

/**
 * The default bound, and the one place the code states it: the schema states it too, and `mergeLayers` applies no defaults.
 * It sits above a healthy tree so it fires on growth, since a bound that reddens the day it ships teaches its reader to ignore it.
 */
const DEFAULT_MAX_CAPTURE_BULLETS = 40;

/**
 * A bound this report can compare against. `config.mjs` validates the type at the write face, so a value failing here was hand-edited into a layer.
 * It reads as unset and the default applies, since comparing against `"forty"` would name a crossing nobody can act on.
 * @param {unknown} v
 */
function usableBound(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export { cmdCaptureCheck };
