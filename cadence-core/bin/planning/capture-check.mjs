// @ts-check
// planning/capture-check.mjs - `capture-check`: what `.planning/CAPTURE.md`
// holds right now, as a report - the substantive walked count, the bullets
// adjudicated by annotation, and the `## Archive` heading that is no longer
// part of this file's contract (CAP-01, CAP-03).
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { captureHealth, ARCHIVE_HEADING } from '../lib/capture-health.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';

// ---------------------------------------------------------------------------
// capture-check - the one reading `/cad-health` prints and the phase close
// asserts against. CAPTURE.md holds the phase IN FLIGHT: a hand sweep took this
// repository's queue to zero on 2026-08-08 and it regrew to 276 walked bullets
// in sixteen days, so the queue's size, an item settled in place with an
// annotation, and a `## Archive` heading holding retired work are the three
// things that say the file stopped being transient.
//
// NOTHING HERE REFUSES ANYTHING. Every verdict is a REPORT on an `ok:true`
// envelope; the only `ok:false` arms are bad arguments and a file that is
// present and could not be read. A queue over its bound is still a queue, and a
// seam that blocked on one would be a seam every caller learns to route around.
//
// THE BOUND IS CONFIG, and its crossing is the loudest of the three reports.
// `planning.max_capture_bullets` defaults to 40 against this repository's own
// 30 substantive walked bullets (measured 2026-08-25), so it sits above a
// healthy tree and fires on GROWTH: a bound that reddens the day it ships
// teaches its reader to ignore it.
//
// STANDALONE beside `capture-sections`, for the reason that command states
// about itself (D-07): `cmdStatus` returns `no-planning-dir` / `no-roadmap` /
// `unparseable-roadmap` before any drift is computed, so folding a capture
// verdict into `status` would hand no report at all to exactly the trees most
// likely to hold a mangled CAPTURE.md.
// ---------------------------------------------------------------------------
function cmdCaptureCheck(dir, opts) {
  // The same present-but-unusable refusal `capture` and `capture-sections`
  // carry: a flag with nothing usable after it is never silently answered about
  // the default path, which would report on a different file than the caller
  // named.
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture-check --file needs a path after it: --file <path to CAPTURE.md>',
      'name the CAPTURE.md to report on, or drop --file to use the one under --dir');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  // The bound, before the read, so both arms answer with the same number.
  //
  // mergeLayers warnings[]: bound and ridden on the envelope when non-empty,
  // the rule lib/merge-warnings.mjs holds every callsite to. A torn layer reads
  // the bound as unset and this report falls back to the default below, so a
  // project that deliberately raised its bound would otherwise be told it had
  // crossed a number it does not use.
  const { config, warnings } = mergeLayers(join(dir, 'config.json'));
  const bound = usableBound(config?.planning?.max_capture_bullets)
    ? config.planning.max_capture_bullets : DEFAULT_MAX_CAPTURE_BULLETS;
  const rest = warnings.length ? { bound, warnings } : { bound };
  /** @type {string} */
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    // ENOENT alone is the absent arm, and absence is DATA here as everywhere in
    // this seam: a project with no queue has an EMPTY queue, which is exactly
    // the state this command exists to confirm. Not a catch-all, for the reason
    // `capture-sections` states: an unreadable but PRESENT queue reported as
    // "zero items" is a check announcing all clear about a file it could not
    // open.
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
 * The reading, in envelope spelling. Split out so the absent arm answers with
 * the SAME fields as the present one rather than an envelope a caller has to
 * branch on: a project with no CAPTURE.md has an empty queue, and every field
 * below is what "empty" looks like.
 * @param {ReturnType<typeof captureHealth>} health @param {number} bound
 */
function report(health, bound) {
  return {
    substantive: health.substantive,
    // Both numbers ride the same envelope, and the crossing is a BOOLEAN over
    // them rather than a second copy of either: a caller that prints "N over M"
    // reads the two fields it already has.
    over_bound: health.substantive > bound,
    sections: health.sections,
    annotations: health.annotations,
    archive: { heading: `## ${ARCHIVE_HEADING}`, ...health.archive },
  };
}

/**
 * The default bound, and the ONE place the code states it - the schema states
 * it too, and `mergeLayers` applies no defaults, which is the same arrangement
 * `memoryBackend`'s `?? 'builtin'` and the dispatch-window ceilings live under.
 */
export const DEFAULT_MAX_CAPTURE_BULLETS = 40;

/**
 * A bound this report can compare against. `config.mjs` validates the type at
 * the WRITE face, so a value failing here arrived by hand-editing a layer;
 * it reads as unset and the default applies, because a report that compared
 * against `"forty"` would name a crossing nobody can act on.
 * @param {unknown} v
 */
function usableBound(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export { cmdCaptureCheck };
