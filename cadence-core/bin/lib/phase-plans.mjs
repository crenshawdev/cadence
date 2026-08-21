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
// `PLAN.md` reading as plan 1 spelled bare. That set is also the LOCATOR's test
// for what a phase directory is (`phaseDirsIn`), which is what reaches the
// phases a milestone close archived: locating and reading are separate here, so
// `route.mjs replay` can ask the same reader about `_archive-<label>/<N>/` that
// a resolve asks about `phases/<N>/`.
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

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCursor, readFrontmatterList } from './planning-files.mjs';

// The byte bound a PLAN file is read under, matching `route.mjs`'s
// `MAX_BODY_BYTES` for the declared bodies one level down - one number for one
// question, so a plan and a file it declares are refused at the same size.
const MAX_PLAN_BYTES = 512 * 1024;

// A split phase carries PLAN-1.md and PLAN-2.md and BOTH declare files; an
// unsplit one carries PLAN.md. Nothing else in `phases/<N>/` is a plan.
const PLAN_FILE = /^PLAN(-\d+)?\.md$/;

// The directories `milestone-prune --mode archive` moves a closed milestone's
// phases into, beside `phases/` under the same planning root. Matched by PREFIX
// and not by a label grammar: the label is whatever version string the close
// carried, and a phase that has been archived still declares the files a floor
// would read.
const ARCHIVE_DIR = /^_archive-/;

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
  // BOUNDED BEFORE OPENED, on route.mjs's `declaredBodies` reasoning and for the
  // same reason: `PLAN_FILE` admits a name, and a name says nothing about what
  // the entry IS. A plan path that is a symlink to a character device or a FIFO
  // reports size 0 through a following stat, passes any byte bound, and is then
  // read to an EOF that never arrives - so the resolve hangs where its whole
  // contract is to fail closed at the configured stakes. `lstatSync` does not
  // follow, and a non-regular entry is an unread plan rather than a clean one:
  // it takes the SAME arm an unreadable plan takes, which withholds the discount
  // instead of earning it. This reader is the floor's first input, so leaving it
  // unguarded while the bodies one level down are guarded is the asymmetry the
  // `risk_surface` review named.
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

/** The conforming plan files in one directory, sorted, or null when the
 * directory could not be read at all - the ordinary pre-plan state. A directory
 * that reads but holds no plan is `[]`, which is a different answer: nothing was
 * there, rather than nothing could be looked at. */
function planFilesIn(dir) {
  try {
    return readdirSync(dir, { encoding: 'utf8' }).filter((e) => PLAN_FILE.test(e)).sort();
  } catch {
    return null;
  }
}

/** Whatever a directory holds, or nothing at all when it could not be read.
 * Every walk below fails OPEN through this: an unreadable planning root, an
 * unreadable archive directory and an unreadable phase directory each contribute
 * no entries and no throw. */
function entriesIn(dir) {
  try {
    return readdirSync(dir, { encoding: 'utf8' });
  } catch {
    return [];
  }
}

/** `phases/<phase>` under a planning root - the ONE place the live layout is
 * spelled, so the two phase-keyed faces below cannot drift from each other. */
const phaseDir = (planningRoot, phase) => join(planningRoot, 'phases', String(phase));

/**
 * Every directory under the planning root that HOLDS a conforming plan file -
 * `phases/<name>` for a live phase and `_archive-<label>/<name>` for one a
 * milestone close moved - each with the `path` a reader takes and a `label` a
 * report can print, sorted by label so two runs print the same order.
 *
 * WHAT MAKES A DIRECTORY A PHASE HERE is that it holds a file matching
 * `PLAN_FILE`, never that its name matches a phase-name grammar. That grammar
 * (`PHASE_DIR_NAME`) lives in `bin/planning.mjs`, a top-level script this lib
 * may not import, and restating it here would be the second copy this file's
 * header refuses to carry. It also answers a question this caller does not have:
 * a directory holding no plan declares no files, so it contributes nothing to a
 * floor whatever it is named.
 *
 * An ABSENT planning root is the ordinary pre-project state and yields an empty
 * list with no warning, on the same argument `cursorPhase` is silent for.
 * @param {string} planningRoot
 * @returns {Array<{label: string, path: string}>}
 */
export function phaseDirsIn(planningRoot) {
  const groups = ['phases', ...entriesIn(planningRoot).filter((e) => ARCHIVE_DIR.test(e))];
  const found = [];
  for (const group of groups) {
    const dir = join(planningRoot, group);
    for (const name of entriesIn(dir)) {
      const names = planFilesIn(join(dir, name));
      if (!names || !names.length) continue;
      found.push({ label: `${group}/${name}`, path: join(dir, name) });
    }
  }
  // Label order, not directory order: `readdirSync` makes no ordering promise
  // and a replay row list that reshuffles between runs is unreadable as a diff.
  return found.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

/**
 * The file paths the PLAN files in ONE directory declare in their frontmatter
 * `files:` list, unioned across every conforming plan file there (read in
 * lexicographic order, first occurrence kept), plus one warning per PLAN this
 * could not read cleanly and the two counts the caller's aggregation needs.
 *
 * BY PATH, so the same rules reach a phase wherever the project keeps it - a
 * live `phases/<N>/` and an archived `_archive-<label>/<N>/` alike, which is what
 * lets the replay measure the 27 phases this repository has already closed. The
 * two phase-keyed faces below are this function with the path joined for them,
 * so there is exactly ONE reader and one set of failure rules.
 *
 * `planKey` narrows the scope from the directory's union to the one plan it
 * names, which is what an executor dispatch floors on (D-06). `PLAN-<key>.md` is
 * the file, and `PLAN.md` is plan 1 spelled bare (the equivalence `listPlanFiles`
 * and planning.mjs's own plan-file lookup already carry), preferring `PLAN-1.md`
 * when a directory somehow holds both. A key that names NO plan file returns
 * `found: 0`, which is the caller's fail-closed arm verbatim: the resolve holds
 * the configured stakes rather than discounting a plan it never read. It is
 * deliberately not a warning-free silence like an absent directory - a caller
 * that NAMED a plan and got nothing is a wrong dispatch, not a pre-plan state -
 * so it says so, and an unreadable directory says so too for the same reason.
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
 * there would fire on every `/cad-context` dispatch of every project. A caller
 * that named a `planKey` is the one exception, above.
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
    // The pre-plan state for the union face and a wrong dispatch for the named
    // one, which is why only the second warns.
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

/**
 * The union face for a LIVE phase, named by its number - `declaredFilesIn` with
 * `phases/<phase>` joined for it. What a phase-scoped role (`cad-plan-checker`,
 * `cad-verifier`, reviewer resolution) floors on.
 * @param {string} planningRoot
 * @param {string|number} phase
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPhaseFiles(planningRoot, phase) {
  return declaredFilesIn(phaseDir(planningRoot, phase));
}

/**
 * The named-plan face for a LIVE phase - `declaredFilesIn` with the same path
 * joined and the key passed through, so a clean plan in a mixed phase routes
 * below its risky sibling (D-06).
 * @param {string} planningRoot
 * @param {string|number} phase
 * @param {string} planKey
 * @returns {{files: string[], warnings: string[], found: number, clean: number,
 *   undeclared: string[]}}
 */
export function declaredPlanFiles(planningRoot, phase, planKey) {
  return declaredFilesIn(phaseDir(planningRoot, phase), planKey);
}
