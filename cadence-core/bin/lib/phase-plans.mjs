// @ts-check
// phase-plans.mjs - the disk half of the computed risk floor: the cursor phase from STATE.md, and declared paths
// split from risk-diff.mjs on failure mode: that one is pure and returns matches, this one does guarded I/O
// no category matcher here: risk-diff's `scanDeclared` decides what a path means, and two of them disagreed before
// everything fails open and the caller closes: `found` and `clean` travel with the union so route.mjs stands the
// floor down only for a scope fully found and read clean. A hard refusal would skip plan review and the deep pass
'use strict';

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { insideRoot } from './contained.mjs';
import { parseCursor, readFrontmatterList } from './planning-files.mjs';

// byte bound for reading a plan, same as route.mjs's MAX_BODY_BYTES so a plan and a file it declares refuse together
const MAX_PLAN_BYTES = 512 * 1024;

// numbered PLAN-<k>.md files in a split phase, PLAN.md in an unsplit one, and nothing else in the directory is a plan
export const PLAN_FILE = /^PLAN(-\d+)?\.md$/;

/** `PLAN-<k>.md` is k and a bare `PLAN.md` is 1, matching the path the executor writes its report to. */
export const planNumber = (/** @type {string} */ f) => Number(/^PLAN-(\d+)\.md$/.exec(f)?.[1] ?? 1);

/** Sort comparator for plan filenames: by plan number, then by name so `PLAN.md` beside `PLAN-1.md` stays fixed. */
export const byPlanNumber = (/** @type {string} */ a, /** @type {string} */ b) =>
  planNumber(a) - planNumber(b) || (a < b ? -1 : a > b ? 1 : 0);

/**
 * The file in `names` that holds plan `key`: `PLAN-<key>.md`, or the bare `PLAN.md` for the first plan.
 * @param {string[]} names @param {string} key @returns {string|undefined}
 */
export function planFileFor(names, key) {
  return names.find((f) => f === `PLAN-${key}.md`)
    || (key === '1' ? names.find((f) => f === 'PLAN.md') : undefined);
}

// the archive dirs `milestone-prune --mode archive` moves closed phases into, beside `phases/`. Matched by prefix,
// since the label is whatever version string the close carried
const ARCHIVE_DIR = /^_archive-/;

// prefix on every warning; route.mjs relays them verbatim, so this says which came from the floor's disk read
const W = 'risk floor: ';

/**
 * The phase the STATE cursor points at, or null when there's no readable cursor. Silent on every failure: a missing
 * STATE.md is the ordinary pre-project state, and warning would fire on every dispatch before `/cad-new-project`.
 * The value is parseCursor's own, a Number, decimal (`2.1`) for an inserted phase, rendered back to `phases/2.1/`.
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
 * Two failure arms, both contributing no paths: a read that throws gets one warning naming the file, and frontmatter
 * out of grammar gets one with the first issue's line and code. No salvaging the half that parsed, or the floor would
 * rest on a path list the grammar already rejected.
 * A plan that read clean and declared no path is neither arm: it goes in `undeclared`, and what zero paths mean is
 * route.mjs's call, not a new issue in planning-files that every consumer of that grammar would see.
 * @param {string} file @param {{files: string[], warnings: string[], found: number,
 *   clean: number, undeclared: string[]}} acc @param {Set<string>} seen
 */
function readOnePlan(file, acc, seen) {
  acc.found += 1;
  let text;
  // bounded before opened, like route.mjs's declared bodies: a symlink to a device or FIFO stats as size 0, passes any
  // byte bound and is read to an EOF that never comes, hanging a resolve that has to fail closed. lstat doesn't follow,
  // and a non-regular entry takes the unreadable-plan arm, which raises the floor
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
  // judged before the seen dedup: a path a sibling already contributed is still this plan's, not "undeclared"
  const declared = items.filter((f) => typeof f === 'string' && f);
  if (!declared.length) acc.undeclared.push(file);
  for (const f of declared) {
    if (seen.has(f)) continue;
    seen.add(f);
    acc.files.push(f);
  }
}

/** The conforming plan files in one directory, in plan-number order, or null when it couldn't be read (the ordinary pre-plan state).
 * A directory that reads but holds no plan is `[]`: nothing was there, as opposed to nothing could be looked at. */
function planFilesIn(dir) {
  try {
    return readdirSync(dir, { encoding: 'utf8' }).filter((e) => PLAN_FILE.test(e)).sort(byPlanNumber);
  } catch {
    return null;
  }
}

/** What a directory holds, or nothing when unreadable, so every walk below fails open. */
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
 * `<archive dir>/<name>` for one a milestone close moved, each with a `path` and a printable `label`, sorted by label.
 *
 * A directory is a phase here because it holds a file matching PLAN_FILE, never because of its name: that grammar lives
 * in a top-level script this lib may not import, and restating it would be a second copy.
 * An absent planning root is the ordinary pre-project state: an empty list and no warning, as cursorPhase does.
 * @param {string} planningRoot
 * @returns {Array<{label: string, path: string}>}
 */
export function phaseDirsIn(planningRoot) {
  // contained, as route.mjs does for declared bodies: readdirSync follows a symlinked directory, so a link in an
  // archive or phase entry would land this walk in another tree. Judged on where the path resolves, so a legitimately
  // symlinked archive still works. Fails open: an unresolvable path adds nothing and throws nothing
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
  // label order, not directory order: readdirSync promises none and a reshuffling row list is unreadable as a diff
  return found.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

/**
 * The paths the plan files in one directory declare in their frontmatter `files:`, unioned across every conforming
 * plan file, plus a warning per plan not read cleanly and the two counts the caller needs.
 * `planKey` narrows to one plan, which is what an executor dispatch floors on. A key naming no plan gives `found: 0`
 * and warns: that's a wrong dispatch.
 * Frontmatter list only, never the `- **Files:**` task lines: a plan declaring only README.md would floor the whole
 * phase because one task names `src/auth/session.rs`.
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
 * The union face for a live phase, named by number: declaredFilesIn with `phases/<phase>` joined. What phase-scoped
 * roles (`cad-plan-checker`, `cad-verifier`, reviewer resolution) floor on.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPhaseFiles(planningRoot, phase) {
  return declaredFilesIn(phaseDir(planningRoot, phase));
}

/**
 * The named-plan face for a live phase: declaredFilesIn with the key passed through, so a clean plan can route lower.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @param {string} planKey
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPlanFiles(planningRoot, phase, planKey) {
  return declaredFilesIn(phaseDir(planningRoot, phase), planKey);
}
