// @ts-check
// every hand-maintained census in the repo: a count a human wrote down that the code must keep true
// a census is a count someone typed into a test; a number the test derives from the tree is a measurement
// hand-maintained because a tree snapshot can't tell a pinned count from a fixture's length
// a row's `subjects` are narrower than what the census scans: the wider reading refuses most plans and gets deleted
// the table's length is never asserted, or adding a row would invalidate a census nothing watches
// pure: no fs, no git; the caller owns the walk, and this takes no CONTRACTS row or CLI entry
'use strict';

import { markerSegments, stripTrailer } from './debt-markers.mjs';
import { covers, intersects } from './lease-grammar.mjs';

/**
 * @typedef {object} CensusEntry
 * @property {string} id stable join key between a marked site and its row
 * @property {string} holder repo-relative path of the file HOLDING the count
 * @property {string} counts what the count is a count OF, in one sentence
 * @property {string} asserted_by the site that ASSERTS it, named as a reader would find it
 * @property {readonly string[]} subjects the narrow path set the count is taken OVER
 */

/** @param {CensusEntry} e @returns {CensusEntry} */
function entry(e) {
  return Object.freeze({ ...e, subjects: Object.freeze([...e.subjects]) });
}

/**
 * Every hand-maintained census in this tree, one row each.
 *
 * `holder` is where the number lives; `subjects` is what moving a file under
 * them would move. They differ on purpose: a plan that edits a subject and never
 * names the holder is exactly the plan this registry exists to catch.
 *
 * @type {readonly CensusEntry[]}
 */
export const CENSUSES = Object.freeze([
  entry({
    id: 'self-verify-merge-layers',
    holder: 'tests/self-verify.test.mjs',
    // no paren after mergeLayers here, or the merge-warnings rule reads this row as a callsite
    counts: 'eighteen `mergeLayers` callsites over fourteen files, each in one '
      + 'of the two warning-surfacing arms',
    asserted_by: 'the test named `check 12: the live tree is SEVENTEEN callsites '
      + 'over THIRTEEN files, each in an arm`',
    // lib/config-merge.mjs isn't a subject: that test skips it, so editing it can't move the count
    subjects: [
      'cadence-core/bin/config.mjs',
      'cadence-core/bin/forge.mjs',
      'cadence-core/bin/git-branch.mjs',
      'cadence-core/bin/git-guard.mjs',
      'cadence-core/bin/git-publish.mjs',
      'cadence-core/bin/issue-check.mjs',
      'cadence-core/bin/issue-filing.mjs',
      'cadence-core/bin/land-cleanup.mjs',
      'cadence-core/bin/planning/capture-check.mjs',
      'cadence-core/bin/planning/core.mjs',
      'cadence-core/bin/planning/risk-check.mjs',
      'cadence-core/bin/planning/trace.mjs',
      'cadence-core/bin/review-provider.mjs',
      'cadence-core/bin/route.mjs',
    ],
  }),
  entry({
    id: 'arg-contract-flag-entries',
    holder: 'tests/arg-contract.test.mjs',
    counts: 'the flag entries the `CONTRACTS` table declares and its top-level row count',
    asserted_by: 'the test named `every flag in every row declares a complete grammar`',
    subjects: ['cadence-core/bin/lib/arg-contract.mjs'],
  }),
  entry({
    id: 'trace-refusal-sentences',
    holder: 'tests/trace.test.mjs',
    counts: "each of the four refusing trace flags' sentences appearing exactly "
      + 'once across the whole planning seam',
    asserted_by: 'the test named `the four refusing trace flags carry ONE '
      + 'sentence each, in one map`',
    // a directory lease beside the entry file: that test reads the whole seam to catch a copy in any command module
    subjects: ['cadence-core/bin/planning.mjs', 'cadence-core/bin/planning/'],
  }),
  entry({
    id: 'weight-budgets',
    holder: 'cadence-core/bin/weight-budgets.json',
    counts: 'a UTF-8 byte ceiling for each budgeted prose surface',
    // a non-test asserting site on purpose; every plan that edits prose invalidates this census
    asserted_by: "`cadence-core/bin/self-verify.mjs`'s budget check, the "
      + '`budget-overrun` arm',
    // five directory leases cover all the budgeted keys; listing the keys would be a second copy of weight-budgets.json
    subjects: [
      'agents/',
      'cadence-core/references/',
      'cadence-core/templates/',
      'cadence-core/workflows/',
      'skills/',
    ],
  }),
  entry({
    id: 'text-transport-register',
    holder: 'tests/text-transport.test.mjs',
    counts: "the register's own row count and its derived-row count - 36 and 20",
    asserted_by: 'the test named `the register pins its row count`',
    subjects: ['cadence-core/bin/lib/text-transport.mjs'],
  }),
  entry({
    id: 'capture-writers-register',
    holder: 'tests/capture-writers.test.mjs',
    counts: "the register's 4 rows, none of them durable - a durable row is a "
      + 'reported problem on the live tree, so the second figure is the '
      + "classification's own floor rather than a tally",
    asserted_by: 'the test named `the register pins its row count`',
    subjects: ['cadence-core/bin/lib/capture-writers.mjs'],
  }),
  entry({
    id: 'bulk-output-register',
    holder: 'tests/bulk-output.test.mjs',
    counts: "the register's row count and its two transport splits - 20, 5 "
      + 'redirect and 3 file',
    asserted_by: 'the test named `the register pins its row count`',
    subjects: ['cadence-core/bin/lib/bulk-output.mjs'],
  }),
  entry({
    id: 'rung-agent-files',
    holder: 'tests/rung-agent.test.mjs',
    counts: 'the 30 rung file stems across the six roles, each serving exactly one rung',
    asserted_by: 'the test named `RUNG_FILES names 30 files across the six '
      + 'roles, and is frozen`',
    subjects: ['cadence-core/bin/lib/rung-agent.mjs'],
  }),
  entry({
    id: 'deferred-reads-register',
    holder: 'tests/deferred-reads.test.mjs',
    counts: "the register's 9 rows, pinned alongside a byte-identical slice of "
      + "the export's own source",
    asserted_by: 'the test named `register: the surviving cut rows are '
      + 'byte-identical, and the register is exactly the rows the cuts made`',
    subjects: ['cadence-core/bin/lib/deferred-reads.mjs'],
  }),
  entry({
    id: 'planning-detail-sites',
    holder: 'tests/planning-lease-check.test.mjs',
    counts: 'the 14 error-detail sites across the whole planning seam and the 6 '
      + 'of them wrapped in `redactUrl`',
    asserted_by: "the test named `source: planning.mjs's no-staged-set detail "
      + 'goes through redactUrl`',
    // wide by necessity: the census is taken over the concatenated seam, so a narrower subject wouldn't be pinned
    subjects: ['cadence-core/bin/planning.mjs', 'cadence-core/bin/planning/'],
  }),
  entry({
    id: 'phase-spelling-callsites',
    holder: 'tests/phase-spelling.test.mjs',
    counts: 'the 21 phase-argument callsites under `cadence-core/bin/planning/` and the 12 '
      + 'of them that resolve a `phases/<N>/` path, each with its disposition',
    asserted_by: 'the test named `census: every phase-argument callsite under planning/ '
      + 'carries a disposition`',
    // narrow on purpose: this walks the directory alone, and planning.mjs for symmetry would refuse plans for nothing
    subjects: ['cadence-core/bin/planning/'],
  }),
  entry({
    id: 'reference-router-branches',
    holder: 'tests/reference-routers.test.mjs',
    counts: "the register's row count and the number of ROUTERS those rows "
      + 'span - 7 over 2',
    asserted_by: 'the test named `the register pins its row count and its router count`',
    // the module, not the references directory: both numbers are read off ROUTERS, so a reference split moves no count
    subjects: ['cadence-core/bin/lib/reference-routers.mjs'],
  }),
  entry({
    id: 'seam-call-counts',
    holder: 'tests/seam-calls.test.mjs',
    counts: 'the happy-path seam invocations each measured workflow instructs - '
      + '16 for `workflows/plan.md` and 6 for `workflows/context.md`',
    asserted_by: 'the generated test named `<file> instructs exactly <N> seam '
      + 'invocations`, one per row of that file\'s `CENSUS` array',
    // only these two workflows carry a row and the count is per file, so the rest would refuse plans for nothing
    subjects: [
      'cadence-core/workflows/plan.md',
      'cadence-core/workflows/context.md',
    ],
  }),
  entry({
    id: 'planning-group-stems',
    holder: 'tests/test-groups.test.mjs',
    // a set, not a number: equality against the tree both ways, and it takes a row since a human types one side
    counts: "the `planning` group's membership in test.mjs's hand-typed "
      + '`GROUPS` - the SET of stems, never a count of them',
    asserted_by: 'the test named `GROUPS.planning is exactly the '
      + 'planning-*.test.mjs files on disk, both directions`',
    // `tests/test.mjs` alone, never a directory: the typed list lives in that file; a directory would refuse most plans
    subjects: ['tests/test.mjs'],
  }),
]);

// --- discovery: the marker grammar, and the one rule over it -----------------
//
// a census with no row is invisible, so the site carries a marker and the suite fails on a marked site with no row
// a census written without the marker stays invisible; that's the stated cost, and every census here is marked
// one direction only: a row whose marker was deleted isn't checked, because that needs the disk half the caller owns
// pure over text: the caller owns the walk and the envelope

/**
 * The marker token. Namespaced so it can't collide with another tool's, and
 * distinct from `DEBT_TOKEN` so the debt harvest doesn't pick these up.
 */
export const CENSUS_TOKEN = 'CADENCE-CENSUS';

// built, not written as a literal: the test walk reads every .mjs under cadence-core/bin, this one included, so a
// spelled-out head would be ingested as a real marked site
const MARKER_HEAD = `${CENSUS_TOKEN}:`;

/** The one named field a marker carries after its id. */
const ASSERTS = 'asserts';

/**
 * @typedef {object} CensusMarker
 * @property {number} line 1-based line number within the file
 * @property {string} id the registry row this site claims
 * @property {string|null} asserts one line naming what the assertion pins
 * @property {string[]} [malformed] the REQUIRED parts that are missing
 */

/**
 * Every census marker in one file's contents, in line order.
 *
 * The grammar: the token, an immediate colon, the registry `id`, ` | `, then
 * `asserts` and a colon and one line naming what the assertion pins. The
 * immediate colon keeps prose that names the token in backticks from being
 * ingested.
 *
 * A marker missing its id or its `asserts` comes back with `malformed` naming
 * the part, never dropped, or the site is still a census and nothing says so. An
 * empty id matches no row, so it reaches `censusIssues` as an issue.
 *
 * @param {string} text @returns {CensusMarker[]}
 */
export function censusMarkersIn(text) {
  if (typeof text !== 'string' || !text.includes(MARKER_HEAD)) return [];
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const seg of markerSegments(lines[i], MARKER_HEAD)) {
      const parts = seg.split('|');
      const id = parts[0].trim();
      let asserts = null;
      for (let j = 1; j < parts.length; j++) {
        const m = parts[j].trim().match(/^asserts\s*:\s*([\s\S]*)$/i);
        if (m) asserts = stripTrailer(m[1]);
      }
      const malformed = [];
      if (!id) malformed.push('id');
      if (!asserts) malformed.push(ASSERTS);
      out.push({
        line: i + 1,
        id,
        asserts: asserts || null,
        ...(malformed.length ? { malformed } : {}),
      });
    }
  }
  return out;
}

/**
 * @typedef {object} CensusIssue
 * @property {string} path the file the marked site lives in
 * @property {number} line 1-based line of the marker
 * @property {string} id the id the marker claimed, `''` when it stated none
 * @property {string|null} asserts the marker's own one-line claim
 * @property {string} message the whole finding, renderable as-is
 */

/**
 * The marked sites in one file that no registry row accounts for: an id no row
 * uses, an id whose row was deleted, and a marker that stated no id. A marker
 * whose id matches a row is the site claiming its record, not an issue.
 *
 * @param {string} path the file's own path, repo-relative
 * @param {CensusMarker[]} markers what `censusMarkersIn` returned for it
 * @returns {CensusIssue[]}
 */
export function censusIssues(path, markers) {
  if (!Array.isArray(markers)) return [];
  const known = new Set(CENSUSES.map((e) => e.id));
  return markers.filter((m) => !known.has(m.id)).map((m) => ({
    path,
    line: m.line,
    id: m.id,
    asserts: m.asserts || null,
    message: `${path}:${m.line} marks a census as \`${m.id || '(no id)'}\`, `
      + `which no row in lib/census-registry.mjs names. It asserts: `
      + `${m.asserts || '(unstated)'}. Add the row, or delete the marker and the `
      + 'count with it.',
  }));
}

// --- the lease predicate: what a declared file list puts at risk -------------
//
// paths are the only relation at plan time: a plan declares changes only through `files:` and the task `Files` lines
// both halves go through lease-grammar, or the covers row of the helper census goes red and two readers disagree

/**
 * @typedef {object} CensusAtRisk
 * @property {string} id the registry row
 * @property {string} missing the file the lease does not declare
 * @property {string} counts what that file's count is a count of
 * @property {string} asserted_by the site that asserts it
 */

/**
 * The registered censuses a declared file list puts at risk.
 *
 * An entry qualifies when some declaration intersects one of its subjects (the work will reach what the count is
 * taken over) and no declaration covers its holder, so nothing in the plan can move the number back into agreement.
 *
 * Intersection on the subject side and containment on the holder side aren't interchangeable: the holder is one named
 * file and the lease has to actually reach it.
 *
 * Pure, so a replay can ask once per historical plan.
 *
 * @param {readonly string[]} declared the plan's declared file list
 * @returns {CensusAtRisk[]}
 */
export function censusesAtRisk(declared) {
  const decls = Array.isArray(declared) ? declared : [];
  return CENSUSES
    .filter((e) => e.subjects.some((s) => decls.some((d) => intersects(d, s)))
      && !decls.some((d) => covers(d, e.holder)))
    .map((e) => ({
      id: e.id,
      missing: e.holder,
      counts: e.counts,
      asserted_by: e.asserted_by,
    }));
}
