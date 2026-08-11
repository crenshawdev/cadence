// @ts-check
// phase-plans.mjs - read the cursor phase from `.planning/STATE.md`, for the
// seams that need a phase in hand when none was named on the command line.
//
// It adds NO grammar of its own: `parseCursor` comes from ./planning-files.mjs,
// the one place a `.planning` grammar lives.
//
// Every path here fails OPEN (D-08): a cursor that cannot be read yields null
// rather than an error, because a caller with no phase records nothing rather
// than refusing. Nothing in this file throws: every fs call sits inside its own
// try.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCursor } from './planning-files.mjs';

// A split phase carries PLAN-1.md and PLAN-2.md and BOTH declare files; an
// unsplit one carries PLAN.md. Nothing else in `phases/<N>/` is a plan.
const PLAN_FILE = /^PLAN(-\d+)?\.md$/;

/**
 * The phase the STATE cursor points at, or null when there is no readable
 * cursor. SILENT on every failure: an absent `.planning/STATE.md` is the
 * ordinary pre-project state, so warning about it would fire on every dispatch
 * of every project that has not run `/cad-new-project` yet.
 *
 * The value is `parseCursor`'s own - a Number, and a decimal (`2.1`) for an
 * inserted phase, which callers render back to `phases/2.1/`.
 * @param {string} planningRoot
 * @returns {number|null}
 */
export function cursorPhase(planningRoot) {
  try {
    const cursor = parseCursor(readFileSync(join(planningRoot, 'STATE.md'), 'utf8'));
    return cursor && Number.isFinite(cursor.phase) ? cursor.phase : null;
  } catch {
    return null;
  }
}

