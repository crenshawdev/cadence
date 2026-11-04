// @ts-check
// phase-plans.mjs - the disk half of the computed risk floor: the cursor phase from `.planning/STATE.md`, and the
// paths a phase's PLAN files declare, so a resolve can raise its level off them
// split from risk-diff.mjs on failure mode: that one is pure and returns matches, this one does guarded I/O and returns warnings
// no category matcher here, risk-diff's `scanDeclared` decides what a path means and a second one is how the two disagreed before
// everything fails open and the caller closes: nothing throws, an unreadable input gives no paths and one warning, and
// `found` and `clean` travel beside the union so route.mjs can stand the floor down only for a scope fully found and read clean
// a hard refusal would be worse, route.mjs answers `ok:false` by dispatching the base agent with no model override,
// which skips the blocking plan review and the deep pass
'use strict';

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { insideRoot } from './contained.mjs';
import { parseCursor, readFrontmatterList } from './planning-files.mjs';

// byte bound a plan file is read under, the same as route.mjs's MAX_BODY_BYTES for declared bodies, so a plan and a file it declares are refused at the same size
const MAX_PLAN_BYTES = 512 * 1024;

// a split phase carries numbered PLAN-<k>.md files that each declare files, an unsplit one carries PLAN.md, and nothing else in a phase directory is a plan
export const PLAN_FILE = /^PLAN(-\d+)?\.md$/;

/**
 * The file in `names` that holds plan `key`: `PLAN-<key>.md`, or the bare `PLAN.md` for the first plan.
 * @param {string[]} names @param {string} key @returns {string|undefined}
 */
export function planFileFor(names, key) {
  return names.find((f) => f === `PLAN-${key}.md`)
    || (key === '1' ? names.find((f) => f === 'PLAN.md') : undefined);
}

// the archive directories `milestone-prune --mode archive` moves a closed milestone's phases into, beside `phases/`. Matched
// by prefix, not a label grammar: the label is whatever version string the close carried
const ARCHIVE_DIR = /^_archive-/;

// prefix on every warning here. route.mjs relays them verbatim onto its own warnings[], so this tells a reader which came from the floor's disk read
const W = 'risk floor: ';

/**
 * The phase the STATE cursor points at, or null when there's no readable cursor. Silent on every failure: a missing
 * STATE.md is the ordinary pre-project state, and warning would fire on every dispatch of a project that hasn't run `/cad-new-project`.
 * The value is parseCursor's own, a Number, decimal (`2.1`) for an inserted phase, which the readers below render back to `phases/2.1/`.
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
 * Read one plan file's declared `files:` list into an accumulator.
 *
 * Two failure arms, both contributing no paths: a read that throws (absent, unreadable, a directory where a file
 * belongs) gets one warning naming the file, and frontmatter out of grammar gets one naming the file plus the first
 * issue's line and code. Salvaging the half that parsed isn't allowed, it would floor a phase off a path list the
 * grammar already rejected.
 * A plan that read clean and declared no path is neither arm. It's reported in `undeclared` and not judged here: what
 * zero paths mean belongs to route.mjs's floor, and minting an issue in planning-files for one caller's question would
 * change every consumer of that grammar (`items: []` is a right answer there for a missing block, key or empty list).
 * @param {string} file @param {{files: string[], warnings: string[], found: number,
 *   clean: number, undeclared: string[]}} acc @param {Set<string>} seen
 */
function readOnePlan(file, acc, seen) {
  acc.found += 1;
  let text;
  // bounded before opened, as route.mjs does for declared bodies: a name says nothing about what the entry is. A plan path
  // that's a symlink to a character device or FIFO reports size 0 through a following stat, passes any byte bound, and is
  // read to an EOF that never comes, hanging a resolve whose whole contract is to fail closed. lstat doesn't follow, and a
  // non-regular entry takes the same arm as an unreadable plan, which raises the floor instead of standing it down
  try {
    const st = lstatSync(file);
    if (!st.isFile()) {
      acc.warnings.push(`${W}cannot read ${file} (not a regular file); `
        + 'no risk surface was computed from it');
      return;
    }
    if (st.size > MAX_PLAN_BYTES) {
      acc.warnings.push(`${W}cannot read ${file} (over ${MAX_PLAN_BYTES} bytes); `
        + 'no risk surface was computed from it');
      return;
    }
  } catch (e) {
    acc.warnings.push(`${W}cannot read ${file} (${e.code || e.message}); `
      + 'no risk surface was computed from it');
    return;
  }
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
  // judged before the seen dedup: a path a sibling already contributed is still this plan's declaration, and counting it undeclared would say a plan that named a file named none
  const declared = items.filter((f) => typeof f === 'string' && f);
  if (!declared.length) acc.undeclared.push(file);
  for (const f of declared) {
    if (seen.has(f)) continue;
    seen.add(f);
    acc.files.push(f);
  }
}

/** The conforming plan files in one directory, sorted, or null when it couldn't be read (the ordinary pre-plan state).
 * A directory that reads but holds no plan is `[]`: nothing was there, as opposed to nothing could be looked at. */
function planFilesIn(dir) {
  try {
    return readdirSync(dir, { encoding: 'utf8' }).filter((e) => PLAN_FILE.test(e)).sort();
  } catch {
    return null;
  }
}

/** Whatever a directory holds, or nothing when it can't be read, so every walk below fails open on an unreadable root, archive or phase directory. */
function entriesIn(dir) {
  try {
    return readdirSync(dir, { encoding: 'utf8' });
  } catch {
    return [];
  }
}

/** `phases/<phase>` under a planning root, the one place the live layout is spelled so the faces below can't drift. */
const phaseDir = (planningRoot, phase) => join(planningRoot, 'phases', String(phase));

/**
 * Every directory under the planning root that holds a conforming plan file: `phases/<name>` for a live phase and
 * `<archive dir>/<name>` for one a milestone close moved, each with the `path` a reader takes and a `label` a report
 * can print, sorted by label so two runs print the same order.
 *
 * A directory is a phase here because it holds a file matching PLAN_FILE, never because its name matches a phase-name
 * grammar. That grammar lives in a top-level script this lib may not import, and restating it would be a second copy.
 * A directory with no plan declares no files, so it adds nothing to a floor whatever it's named.
 * An absent planning root is the ordinary pre-project state: an empty list and no warning, as cursorPhase does.
 * @param {string} planningRoot
 * @returns {Array<{label: string, path: string}>}
 */
export function phaseDirsIn(planningRoot) {
  // contained, as route.mjs does for declared bodies: readdirSync follows a symlinked directory, so a link in an archive
  // group or phase entry would land this walk in another tree and the caller would read plans that aren't this project's.
  // Judged on where the path resolves, not how it's spelled, so a legitimately symlinked archive still works while an escape
  // is skipped. Fails open: an unresolvable path adds nothing and throws nothing
  const inside = (/** @type {string} */ dir) => insideRoot(planningRoot, dir);
  const groups = ['phases', ...entriesIn(planningRoot).filter((e) => ARCHIVE_DIR.test(e))];
  const found = [];
  for (const group of groups) {
    const dir = join(planningRoot, group);
    if (!inside(dir)) continue;
    for (const name of entriesIn(dir)) {
      const path = join(dir, name);
      if (!inside(path)) continue;
      const names = planFilesIn(path);
      if (!names || !names.length) continue;
      found.push({ label: `${group}/${name}`, path });
    }
  }
  // label order, not directory order: readdirSync promises none and a row list that reshuffles between runs is unreadable as a diff
  return found.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

/**
 * The paths the plan files in one directory declare in their frontmatter `files:`, unioned across every conforming
 * plan file (lexicographic, first occurrence kept), plus one warning per plan not read cleanly and the two counts the
 * caller's aggregation needs. Live and archived phases go through the same rules by path.
 *
 * `planKey` narrows to the one plan it names, which is what an executor dispatch floors on. A bare `PLAN.md` is the
 * first plan, and the numbered file wins if both exist. A key naming no plan file gives `found: 0`, the caller's
 * fail-closed arm, and warns unlike an absent directory: naming a plan and getting nothing is a wrong dispatch.
 * Frontmatter list only, never parsePlanFiles' union with the `- **Files:**` task lines: a plan declaring only README.md
 * would floor the whole phase because one task names `src/auth/session.rs`. The union over-approximates safely for a
 * parallel-overlap check but not for a raise, where a false hit costs every role its top rung.
 * `clean < found` is what the caller refuses to discount, and `undeclared` names plans that read clean and declared nothing.
 * @param {string} dir
 * @param {string|number} [planKey]
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredFilesIn(dir, planKey) {
  const acc = { files: [], warnings: [], found: 0, clean: 0, undeclared: [] };
  const names = planFilesIn(dir);
  const key = planKey === undefined ? undefined : String(planKey);
  if (!names) {
    // the pre-plan state for the union face and a wrong dispatch for the named one, so only the second warns
    if (key !== undefined) {
      acc.warnings.push(`${W}${dir} is not a readable plan directory, so plan `
        + `${key} could not be read; no risk surface was computed from it`);
    }
    return acc;
  }
  if (key === undefined) {
    const seen = new Set();
    for (const name of names) readOnePlan(join(dir, name), acc, seen);
    return acc;
  }
  const name = planFileFor(names, key);
  if (!name) {
    acc.warnings.push(`${W}plan ${key} names no plan file in ${dir} `
      + `(found: ${names.length ? names.join(', ') : 'none'}); `
      + 'no risk surface was computed from it');
    return acc;
  }
  readOnePlan(join(dir, name), acc, new Set());
  return acc;
}

/**
 * The union face for a live phase, named by number: declaredFilesIn with `phases/<phase>` joined. What phase-scoped roles
 * (`cad-plan-checker`, `cad-verifier`, reviewer resolution) floor on.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPhaseFiles(planningRoot, phase) {
  return declaredFilesIn(phaseDir(planningRoot, phase));
}

/**
 * The named-plan face for a live phase: declaredFilesIn with the key passed through, so a clean plan in a mixed phase routes below its risky sibling.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @param {string} planKey
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPlanFiles(planningRoot, phase, planKey) {
  return declaredFilesIn(phaseDir(planningRoot, phase), planKey);
}
