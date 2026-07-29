// @ts-check
// phase-plans.mjs - the disk half of the computed risk floor (STK-03): read the
// paths a phase's PLAN files DECLARE, and read the cursor phase when no phase
// was named. Split from lib/risk-surfaces.mjs on trigger and failure mode - that
// one is pure and returns matches, this one does guarded I/O against `.planning/`
// and returns warnings - the same split lib/config-merge.mjs already carries for
// the two seams that share it.
//
// It adds NO grammar of its own: `parseCursor` and `readFrontmatterList` come
// from ./planning-files.mjs, the one place a `.planning` grammar lives.
//
// Every path here fails OPEN (D-08). route.mjs answers `{ok:false}` by
// dispatching the base agent at the session default with no model override
// (references/seams.md), so a hard refusal would route a risky phase LOWER than
// its own baseline - the inversion the floor exists to prevent. Nothing in this
// file throws: every fs call sits inside its own try.
'use strict';

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCursor, readFrontmatterList } from './planning-files.mjs';

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
 * inserted phase, which `declaredPhaseFiles` renders back to `phases/2.1/`.
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

/**
 * The file paths a phase's PLAN files declare in their frontmatter `files:`
 * list, unioned across every `PLAN.md` / `PLAN-<k>.md` in `phases/<phase>/`
 * (read in lexicographic order, first occurrence kept), plus one warning per
 * PLAN this could not read cleanly.
 *
 * The FRONTMATTER list only - never `parsePlanFiles`'s union with the
 * `- **Files:**` task lines. D-01 names "the phase's declared PLAN `files:`
 * frontmatter" specifically: under the union a PLAN whose frontmatter declares
 * only `README.md` would floor the whole phase because one implementation task
 * happens to name `src/auth/session.rs`, making detection a function of
 * incidental task prose rather than of the curated declaration. Over-flooring is
 * not the safe direction here - it trains the user to waive the floor by reflex,
 * which is the failure mode that makes a floor worthless.
 *
 * Fail-open rules (D-08), all of them:
 *   - a missing planning root, a missing `phases/<phase>/`, or a directory
 *     holding no PLAN file -> `{files: [], warnings: []}`. A phase with no plan
 *     yet is the normal pre-plan state; warning would fire on every
 *     `/cad-context` dispatch of every project.
 *   - a PLAN whose read THROWS -> no paths, ONE warning naming the file.
 *   - a PLAN whose frontmatter is out of grammar (a non-empty `issues` array)
 *     -> NO paths, ONE warning naming the file and the first issue. Salvaging
 *     the half that parsed is a third behaviour neither D-08 nor the plan
 *     allows: it floors a phase off a path list the grammar already rejected. A
 *     half-parsed `files:` list is an unresolvable input, not a shorter one.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @returns {{files: string[], warnings: string[]}}
 */
export function declaredPhaseFiles(planningRoot, phase) {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const warnings = [];
  const dir = join(planningRoot, 'phases', String(phase));

  /** @type {string[]} */
  let entries;
  try {
    entries = readdirSync(dir, { encoding: 'utf8' });
  } catch {
    return { files, warnings }; // no phase directory: the pre-plan state
  }

  const seen = new Set();
  for (const name of entries.filter((e) => PLAN_FILE.test(e)).sort()) {
    const file = join(dir, name);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      warnings.push(`risk floor: cannot read ${file} (${e.code || e.message}); `
        + 'no risk surface was computed from it');
      continue;
    }
    const { items, issues } = readFrontmatterList(text, 'files');
    if (issues && issues.length) {
      const first = issues[0];
      warnings.push(`risk floor: ${file} frontmatter is out of grammar `
        + `(line ${first.line}: ${first.code}); no risk surface was computed from it`);
      continue;
    }
    for (const f of items) {
      if (typeof f !== 'string' || !f || seen.has(f)) continue;
      seen.add(f);
      files.push(f);
    }
  }
  return { files, warnings };
}
