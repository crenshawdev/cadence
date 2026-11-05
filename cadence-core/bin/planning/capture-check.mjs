// @ts-check
// planning/capture-check.mjs - `capture-check`: a report on CAPTURE.md's walked count, annotations and `## Archive`
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { captureHealth, ARCHIVE_HEADING } from '../lib/capture-health.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';

// CAPTURE.md should be transient and a hand sweep to zero regrew within weeks: queue size, in-place annotations and an
// archive heading are the three signs it isn't
// nothing here refuses: verdicts ride an ok:true envelope, and a seam that blocks on a big queue gets routed around
// standalone, not a status drift kind: cmdStatus bails early on the trees likeliest to hold a mangled CAPTURE.md
function cmdCaptureCheck(dir, opts) {
  // same refusal as capture and capture-sections: a flag with nothing usable after it never falls to the default
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture-check --file needs a path after it: --file <path to CAPTURE.md>',
      'name the CAPTURE.md to report on, or drop --file to use the one under --dir');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  // mergeLayers warnings[]: bound and ridden on the envelope when non-empty. A torn layer reads the bound as unset,
  // so a project that raised it would be told it crossed a number it doesn't use
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
    // not a catch-all: a queue that can't be opened would report zero items, an all-clear about a file nobody read
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
 * The default bound, the one place the code states it (the schema does too, and `mergeLayers` applies no defaults).
 * It sits above a healthy tree so it fires on growth: a bound that reddens on day one teaches its reader to ignore it.
 */
const DEFAULT_MAX_CAPTURE_BULLETS = 40;

/**
 * A bound this report can compare against. `config.mjs` validates the type on write, so a bad one was hand-edited.
 * It reads as unset and the default applies, since comparing against `"forty"` would name a crossing nobody can act on.
 * @param {unknown} v
 */
function usableBound(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export { cmdCaptureCheck };
