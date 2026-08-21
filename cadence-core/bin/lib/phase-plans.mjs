// @ts-check
// phase-plans.mjs - the DISK half of the computed risk floor (CER-01): read the
// cursor phase from `.planning/STATE.md` for the seams that need a phase in hand
// when none was named, and read the paths a phase's PLAN files DECLARE so a
// resolve can raise its level off them. Split from lib/risk-diff.mjs on trigger
// and failure mode - that one is pure and returns matches, this one does guarded
// I/O against `.planning/` and returns warnings - the same split
// lib/config-merge.mjs already carries for the two seams that share it. NO
// category matcher lives here: what a declared path or body MEANS is
// lib/risk-diff.mjs's `scanDeclared`, and a second matcher beside the reader is
// how the two came to disagree before.
//
// It adds NO grammar of its own: `parseCursor` and `readFrontmatterList` come
// from ./planning-files.mjs, the one place a `.planning` grammar lives, and the
// conforming plan-file set is `listPlanFiles`'s (`PLAN.md`, `PLAN-<k>.md`) with
// `PLAN.md` reading as plan 1 spelled bare.
//
// Every path here fails OPEN, and the caller closes: nothing throws, an
// unreadable input yields no paths plus one warning, and the COUNTS (`found`,
// `clean`) travel beside the union so route.mjs can apply D-04's aggregation
// rule - the discount below the configured stakes is earned only by a scope
// every member of which was found and read clean - without re-reading a byte.
// A hard refusal here would be worse than useless: route.mjs answers `ok:false`
// by dispatching the base agent at the host session default with no model
// override (references/seams.md), which is BELOW every floor.
'use strict';

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCursor, readFrontmatterList } from './planning-files.mjs';

// A split phase carries PLAN-1.md and PLAN-2.md and BOTH declare files; an
// unsplit one carries PLAN.md. Nothing else in `phases/<N>/` is a plan.
const PLAN_FILE = /^PLAN(-\d+)?\.md$/;

// The `risk floor: ` prefix every warning here carries. route.mjs relays these
// strings VERBATIM onto its own `warnings[]`, so the prefix is what tells a
// reader of a resolve envelope which of its diagnostics came from the floor's
// disk read rather than from a config layer or a gate disagreement.
const W = 'risk floor: ';

/**
 * The phase the STATE cursor points at, or null when there is no readable
 * cursor. SILENT on every failure: an absent `.planning/STATE.md` is the
 * ordinary pre-project state, so warning about it would fire on every dispatch
 * of every project that has not run `/cad-new-project` yet.
 *
 * The value is `parseCursor`'s own - a Number, and a decimal (`2.1`) for an
 * inserted phase, which the two readers below render back to `phases/2.1/`.
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
 * Read ONE plan file's declared `files:` list into an accumulator.
 *
 * The two failure arms are the whole point, and both contribute NO paths:
 *   - a read that THROWS (absent, unreadable mode, a directory where a file
 *     belongs) -> one warning naming the file.
 *   - frontmatter out of grammar (a non-empty `issues` array) -> one warning
 *     naming the file and the first issue's line and code. Salvaging the half
 *     that parsed is a third behaviour nothing here allows: it would floor a
 *     phase off a path list the grammar already rejected, and a half-parsed
 *     `files:` list is an unresolvable input, not a shorter one.
 *
 * A plan that read CLEAN and declared NO path at all is neither of those arms
 * and is not a failure here: it is a fact the caller needs, so it is reported
 * rather than judged. `undeclared` names those files. What zero declared paths
 * MEAN belongs to route.mjs's floor - it is the difference between "the scope
 * was read and touches no surface" and "the scope proved nothing" - and it is
 * deliberately not decided in ./planning-files.mjs either: `items: []` is a
 * correct answer there for a missing block, a missing key and an empty list
 * alike, and minting an issue for one caller's question would change every
 * consumer of that grammar.
 * @param {string} file @param {{files: string[], warnings: string[], found: number,
 *   clean: number, undeclared: string[]}} acc @param {Set<string>} seen
 */
function readOnePlan(file, acc, seen) {
  acc.found += 1;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    acc.warnings.push(`${W}cannot read ${file} (${e.code || e.message}); `
      + 'no risk surface was computed from it');
    return;
  }
  const { items, issues } = readFrontmatterList(text, 'files');
  if (issues && issues.length) {
    const first = issues[0];
    acc.warnings.push(`${W}${file} frontmatter is out of grammar `
      + `(line ${first.line}: ${first.code}); no risk surface was computed from it`);
    return;
  }
  acc.clean += 1;
  // Judged before the `seen` dedup, deliberately: a path a SIBLING plan already
  // contributed is still a declaration by this one, and counting it as
  // undeclared would report a plan that named a file as having named none.
  const declared = items.filter((f) => typeof f === 'string' && f);
  if (!declared.length) acc.undeclared.push(file);
  for (const f of declared) {
    if (seen.has(f)) continue;
    seen.add(f);
    acc.files.push(f);
  }
}

/** The conforming plan files in `phases/<phase>/`, sorted, or null when the
 * directory could not be read at all - the ordinary pre-plan state. */
function planFilesIn(planningRoot, phase) {
  const dir = join(planningRoot, 'phases', String(phase));
  try {
    return { dir, names: readdirSync(dir, { encoding: 'utf8' }).filter((e) => PLAN_FILE.test(e)).sort() };
  } catch {
    return { dir, names: null };
  }
}

/**
 * The file paths a phase's PLAN files declare in their frontmatter `files:`
 * list, unioned across every conforming plan file in `phases/<phase>/` (read in
 * lexicographic order, first occurrence kept), plus one warning per PLAN this
 * could not read cleanly and the two counts the caller's aggregation needs.
 *
 * The FRONTMATTER list only - never `parsePlanFiles`'s union with the
 * `- **Files:**` task lines (D-05). Under that union a PLAN whose frontmatter
 * declares only `README.md` would floor the whole phase because one
 * implementation task happens to name `src/auth/session.rs`, making detection a
 * function of incidental task prose rather than of the curated declaration. The
 * union is a safe OVER-approximation for a parallel-overlap check, where a
 * false overlap costs a sequential run; it is unsafe as a RAISE, where a false
 * hit costs every role its top rung and trains the user to waive the floor by
 * reflex - which is the failure mode that makes a floor worthless.
 *
 * `found` counts the conforming plan files this SAW; `clean` counts the ones it
 * read and parsed. `clean < found` is exactly the state D-04's aggregation rule
 * refuses to discount, and `found === 0` (no phase directory, or a directory
 * holding no plan) is the same arm for the same reason: nothing was read, so
 * nothing is evidence. `undeclared` names the plans that read clean and declared
 * no path at all - the same argument one step further in, since a plan that
 * named no file scanned no file. An absent planning root or an absent phase
 * directory is the ordinary pre-plan state and carries NO warning - warning
 * there would fire on every `/cad-context` dispatch of every project.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPhaseFiles(planningRoot, phase) {
  const acc = { files: [], warnings: [], found: 0, clean: 0, undeclared: [] };
  const { dir, names } = planFilesIn(planningRoot, phase);
  if (!names) return acc; // no phase directory: the pre-plan state
  const seen = new Set();
  for (const name of names) readOnePlan(join(dir, name), acc, seen);
  return acc;
}

/**
 * The same answer for ONE plan of a phase, named by its plan KEY - the face an
 * executor dispatch floors on, so a clean plan in a mixed phase routes below its
 * risky sibling (D-06). `PLAN-<key>.md` is the file, and `PLAN.md` is plan 1
 * spelled bare (the equivalence `listPlanFiles` and planning.mjs's own plan-file
 * lookup already carry), preferring `PLAN-1.md` when a phase somehow holds both.
 *
 * A key that names NO plan file returns `found: 0`, which is the caller's
 * fail-closed arm verbatim: the resolve holds the configured stakes rather than
 * discounting a plan it never read. It is deliberately not a warning-free
 * silence like an absent phase directory - a caller that NAMED a plan and got
 * nothing is a wrong dispatch, not a pre-plan state - so it says so.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @param {string} planKey
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPlanFiles(planningRoot, phase, planKey) {
  const acc = { files: [], warnings: [], found: 0, clean: 0, undeclared: [] };
  const { dir, names } = planFilesIn(planningRoot, phase);
  const key = String(planKey);
  if (!names) {
    acc.warnings.push(`${W}phase ${phase} has no readable plan directory, so plan `
      + `${key} could not be read; no risk surface was computed from it`);
    return acc;
  }
  const name = names.find((f) => f === `PLAN-${key}.md`)
    || (key === '1' ? names.find((f) => f === 'PLAN.md') : undefined);
  if (!name) {
    acc.warnings.push(`${W}plan ${key} names no plan file in ${dir} `
      + `(found: ${names.length ? names.join(', ') : 'none'}); `
      + 'no risk surface was computed from it');
    return acc;
  }
  readOnePlan(join(dir, name), acc, new Set());
  return acc;
}
