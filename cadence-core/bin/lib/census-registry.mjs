// @ts-check
// census-registry.mjs - the ONE table naming every HAND-MAINTAINED census this
// repository carries (CEN-01). A census is a count a human wrote down that the
// code must keep true: `assert.equal(entries, 184)` is the enumeration's own
// claim that the phase examined these sites and no others, and an edit that
// adds a site moves the number whether or not the author knew the number
// existed. Until this table, that class was invisible - each census was watched
// by exactly one test and by nothing that knew the others were the same kind of
// thing.
//
// WHY THE TABLE IS HAND-MAINTAINED. Nothing in a tree snapshot distinguishes a
// pinned count from an incidental one: `assert.equal(n, 17)` reads identically
// whether 17 is a claim about this repository or the length of a fixture the
// test just built. Measured 2026-08-24 over `cadence-core/bin/*.test.mjs`, 73
// `assert.equal(..., <2+ digit literal>)` calls and 147 on a looser shape, the
// large majority fixture-derived rather than tree-derived. So the register IS
// the record, the same species of stated table as `lib/deferred-reads.mjs`'s
// register, self-verify's CONTRACTS and `lib/rung-agent.mjs`'s RUNG_FILES.
//
// WHAT A ROW COSTS. A row is added in the commit that plants the marker at the
// asserting site, and it is not deleted without deleting the census. Deleting
// the row alone leaves the marker behind and unwatches the count, which is why
// a marked site with no row REDDENS the suite instead of passing quietly - the
// one direction `censusIssues` below checks. The reverse direction is not
// checked here (D-06): a row whose marker someone removed is a census that
// stopped being findable, and inferring censushood from assertion shape is what
// the measurement above rules out.
//
// SUBJECTS ARE NARROW, and hand-written per row (D-03). A row's `subjects` are
// scoped to what the assertion actually PINS, never to whatever the census
// really scans. The wider reading is more honest and unusable: measured
// 2026-08-24 over `git ls-files .planning`, 46 PLAN files carry a `files:`
// block and 40 declare at least one path under `cadence-core/bin/`, and a
// `cadence-core/bin/` subject for the whole-tree `helper-census.test.mjs` walk
// (`helper-census.test.mjs:216`) would have refused 38 of those 40, while
// `self-verify.test.mjs` check 12's own `walk(binDir)` gives 22 of 40. Both are
// a rail that fires wrong, and `cadence-core/bin/planning/lease-check.mjs`'s
// header states what happens to one of those: it gets deleted, not tuned. The
// narrowing is itself hand-maintained and can drift. That cost is accepted, and
// it is the price of the rail firing at all rather than being overridden on
// sight - `.planning/phases/1/SUMMARY.md:46` already records the commit-time
// arm being overridden twice rather than obeyed.
//
// WHAT IS NOT A CENSUS (D-05). A DERIVED number - one the test computes from
// the tree at run time and checks against another thing it computed - is a
// MEASUREMENT, and no plan can invalidate it: change the tree and both sides
// move together. `cadence-core/bin/seam-calls.test.mjs:12-27` states its own
// numbers are "DERIVED, never baselined" and carries the arithmetic that makes
// that true. It is deliberately absent from this table and owes no marker.
//
// THIS TABLE'S OWN LENGTH IS NEVER ASSERTED (D-04), and there is no count
// export to assert it with. A length assertion would make adding a row a
// census-invalidating act - putting this registry inside its own table and
// charging every future phase a lease amendment for the row it adds - and
// exempting the registry from itself instead would leave a census nothing
// watches, which is the exact class this table enumerates. The rows' SHAPE is
// what `census-registry.test.mjs` asserts in its place, the way
// `helper-census.test.mjs:217-224` already handles its own self-reference. Do
// NOT add a length or count export.
//
// Pure in the sense `lib/lease-grammar.mjs` and `lib/debt-markers.mjs` are:
// classify, never emit, no fs, no git, no envelope. The caller owns the tree
// walk, the file reads and the verdict. It takes no CONTRACTS row and no CLI
// entry point, for the reason self-verify.mjs check 14 states about
// `lib/*.mjs`: they are modules prose never invokes.
'use strict';

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
 * `holder` is where the number LIVES; `subjects` is what moving a file under
 * them would MOVE it. The two are different paths on purpose (D-02): a plan
 * that edits a subject and never names the holder is exactly the plan this
 * registry exists to catch, and it is the shape phase 5's own PLAN-1 had.
 *
 * @type {readonly CensusEntry[]}
 */
export const CENSUSES = Object.freeze([
  entry({
    id: 'self-verify-merge-layers',
    holder: 'cadence-core/bin/self-verify.test.mjs',
    // `mergeLayers` is written here WITHOUT its opening paren on purpose. The
    // merge-warnings rule matches the name followed by `(` on any non-comment
    // line, so spelling the callsite out in this row's prose made the registry
    // itself the thirteenth file carrying a callsite - self-verify red, and
    // check 12 red at seventeen over thirteen. The fix belongs at the MENTION,
    // which is the discipline lib/merge-warnings.mjs states and the same one
    // that keeps this file's own marker head built rather than written.
    counts: 'seventeen `mergeLayers` callsites over thirteen files, each in one '
      + 'of the two warning-surfacing arms',
    asserted_by: 'the test named `check 12: the live tree is SEVENTEEN callsites '
      + 'over THIRTEEN files, each in an arm`',
    // The thirteen files that carry a callsite today. lib/config-merge.mjs is
    // deliberately NOT a subject: that test's own `skip` excludes it, so
    // editing it cannot move the count.
    subjects: [
      'cadence-core/bin/config.mjs',
      'cadence-core/bin/forge.mjs',
      'cadence-core/bin/git-branch.mjs',
      'cadence-core/bin/git-guard.mjs',
      'cadence-core/bin/git-publish.mjs',
      'cadence-core/bin/issue-check.mjs',
      'cadence-core/bin/issue-filing.mjs',
      'cadence-core/bin/land-cleanup.mjs',
      'cadence-core/bin/planning/core.mjs',
      'cadence-core/bin/planning/risk-check.mjs',
      'cadence-core/bin/planning/trace.mjs',
      'cadence-core/bin/review-provider.mjs',
      'cadence-core/bin/route.mjs',
    ],
  }),
  entry({
    id: 'arg-contract-flag-entries',
    holder: 'cadence-core/bin/arg-contract.test.mjs',
    counts: 'the flag entries the `CONTRACTS` table declares and its top-level row count',
    asserted_by: 'the test named `every flag in every row declares a complete grammar`',
    subjects: ['cadence-core/bin/lib/arg-contract.mjs'],
  }),
  entry({
    id: 'trace-refusal-sentences',
    holder: 'cadence-core/bin/trace.test.mjs',
    counts: "each of the four refusing trace flags' sentences appearing exactly "
      + 'once across the whole planning seam',
    asserted_by: 'the test named `the four refusing trace flags carry ONE '
      + 'sentence each, in one map`',
    // A directory lease beside the entry file: that test deliberately reads the
    // whole seam, so a second copy pasted into any command module is what it
    // catches and any narrower subject would miss.
    subjects: ['cadence-core/bin/planning.mjs', 'cadence-core/bin/planning/'],
  }),
  entry({
    id: 'weight-budgets',
    holder: 'cadence-core/bin/weight-budgets.json',
    counts: 'the exact UTF-8 byte size of each budgeted prose surface',
    // Row (d) stretches criterion 1's "the test that asserts it" to a non-test
    // asserting site on purpose (D-08). It is the one census every
    // prose-editing plan in this repository invalidates.
    asserted_by: "`cadence-core/bin/self-verify.mjs`'s budget check, the "
      + '`budget-overrun` arm',
    // Five directory leases, measured 2026-08-24 to cover all 111 budgeted
    // keys. Copying the key list in would be a second copy of
    // weight-budgets.json, and is refused for the reason lib/lease-grammar.mjs
    // exists.
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
    holder: 'cadence-core/bin/text-transport.test.mjs',
    counts: "the register's own row count and its derived-row count - 36 and 20",
    asserted_by: 'the test named `the register pins its row count`',
    subjects: ['cadence-core/bin/lib/text-transport.mjs'],
  }),
  entry({
    id: 'bulk-output-register',
    holder: 'cadence-core/bin/bulk-output.test.mjs',
    counts: "the register's row count and its two transport splits - 17, 4 "
      + 'redirect and 3 file',
    asserted_by: 'the test named `the register pins its row count`',
    subjects: ['cadence-core/bin/lib/bulk-output.mjs'],
  }),
  entry({
    id: 'rung-agent-files',
    holder: 'cadence-core/bin/rung-agent.test.mjs',
    counts: 'the 19 rung file stems across the six roles, each serving exactly one rung',
    asserted_by: 'the test named `RUNG_FILES names 19 files across the six '
      + 'roles, and is frozen`',
    subjects: ['cadence-core/bin/lib/rung-agent.mjs'],
  }),
  entry({
    id: 'deferred-reads-register',
    holder: 'cadence-core/bin/deferred-reads.test.mjs',
    counts: "the register's 10 rows, pinned alongside a byte-identical slice of "
      + "the export's own source",
    asserted_by: 'the test named `register: the surviving cut rows are '
      + 'byte-identical, and the register is exactly the rows the cuts made`',
    subjects: ['cadence-core/bin/lib/deferred-reads.mjs'],
  }),
  entry({
    id: 'planning-detail-sites',
    holder: 'cadence-core/bin/planning-lease-check.test.mjs',
    counts: 'the 14 error-detail sites across the whole planning seam and the 6 '
      + 'of them wrapped in `redactUrl`',
    asserted_by: "the test named `source: planning.mjs's no-staged-set detail "
      + 'goes through redactUrl`',
    // Wide by NECESSITY, not by choice: this census is taken over the
    // concatenated seam `seamSource()` reads (`planning.test.mjs:53-55`), so a
    // narrower subject would not be what the assertion pins. The same subject
    // pair `trace-refusal-sentences` carries, and its refusal cost is measured
    // against the same bound every other row answers to rather than assumed.
    subjects: ['cadence-core/bin/planning.mjs', 'cadence-core/bin/planning/'],
  }),
]);

// --- discovery: the marker grammar, and the one rule over it -----------------
//
// D-06. A census that lives in a test but has no row above is invisible, and
// inferring censushood from assertion shape is what the measurement in this
// file's header rules out. So the census site carries a LEXICAL MARKER, on the
// `CADENCE-DEBT` model, and the suite fails on any marked site with no row.
//
// The stated cost, which is real: a census written WITHOUT the marker stays
// invisible. That is a statement about counts nobody has found yet, not a
// licence to skip a known one - every census this tree carries as of 2026-08-24
// is above, and each one is marked.
//
// ONE DIRECTION ONLY. A marked site with no row is an issue; a row whose marker
// someone deleted is not checked here. The reverse direction would need this
// module to know where every asserting site is, which is the disk half the
// caller owns.
//
// Pure over TEXT, the split `lib/debt-markers.mjs` states: no `fs`, no walk, no
// throw. The caller owns the tree walk, the file reads and the envelope; this
// owns the grammar.

/**
 * The marker token. Namespaced so it cannot collide with another tool's, and
 * distinct from `DEBT_TOKEN` so the debt harvest cannot pick these up. Verified
 * 2026-08-24: `git grep -w` finds it nowhere else in this tree.
 */
export const CENSUS_TOKEN = 'CADENCE-CENSUS';

// Built rather than written as a literal so this file does not itself contain
// the token-followed-by-a-colon sequence it recognizes. The walk in
// census-registry.test.mjs reads every `.mjs` under cadence-core/bin/, this one
// included, so a spelled-out head here would be ingested as a real marked site
// and would need an exclusion list to undo - the second-list failure
// `lib/merge-warnings.mjs` and `helper-census.test.mjs` both refuse.
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
 * The grammar: the token followed IMMEDIATELY by a colon, then the registry
 * `id`, then ` | `, then `asserts` and a colon, then one line naming what the
 * assertion pins. The immediate colon is what keeps documentation ABOUT the
 * convention from being ingested - prose naming the token in backticks is not a
 * marker and never becomes one.
 *
 * A marker missing its id or its `asserts` field is RETURNED with `malformed`
 * naming the part, never dropped, for `lib/debt-markers.mjs`'s stated reason:
 * dropping it makes an incomplete marker invisible, which is strictly worse
 * than the marker - the site is still a census and now nothing says so. An
 * empty id also matches no registry row, so it reaches `censusIssues` as an
 * issue rather than passing as registered.
 *
 * @param {string} text @returns {CensusMarker[]}
 */
export function censusMarkersIn(text) {
  if (typeof text !== 'string' || !text.includes(MARKER_HEAD)) return [];
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const seg of markerBodies(lines[i])) {
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
 * One line's marker bodies, in order: everything after each marker head up to
 * the next one's head, or the end of the line for the last.
 *
 * Bounded at the next head rather than read to end of line, for the reason
 * `lib/debt-markers.mjs` records as reproduced rather than theorised: an
 * unbounded read lets a second marker's `asserts` overwrite the first's, and
 * one entry comes back carrying another census's claim. A wrong claim is a
 * wrong answer; a missing entry is only a gap.
 *
 * The head is not spelled out here for the same reason it is not spelled out
 * above.
 * @param {string} line @returns {string[]}
 */
function markerBodies(line) {
  /** @type {number[]} */
  const heads = [];
  for (let at = line.indexOf(MARKER_HEAD); at >= 0;
    at = line.indexOf(MARKER_HEAD, at + MARKER_HEAD.length)) heads.push(at);
  return heads.map((at, k) => line.slice(at + MARKER_HEAD.length,
    k + 1 < heads.length ? heads[k + 1] : line.length));
}

// Trailing comment closers, stripped from the LAST field only: a marker in a
// `/* ... */` or `<!-- ... -->` comment would otherwise carry `*/` into the
// assertion text and report it that way.
const TRAILERS = [/\s*\*\/\s*$/, /\s*-->\s*$/, /\s*}}\s*$/];

/** @param {string} s @returns {string} */
function stripTrailer(s) {
  let out = s;
  for (const re of TRAILERS) out = out.replace(re, '');
  return out.trim();
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
 * The marked sites in one file that no registry row accounts for.
 *
 * A marker whose `id` matches a row is NOT an issue - the row is the record and
 * the marker is the site claiming it. Everything else is: an id no row uses, an
 * id someone deleted the row for, and a marker that stated no id at all.
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
// D-10. Path intersection is the ONLY relation available at plan time. Nothing
// in a PLAN declares what it will CHANGE other than paths:
// `cadence-core/references/plan-frontmatter.md` documents the whole frontmatter
// grammar and `files:` is its only path-bearing key, unioned by `parsePlanFiles`
// with the `- **Files:**` task lines. Reading the plan's Action prose, or
// opening a census test to see what it scans, both reach past "the lease and
// the registry only" - so neither is reachable from here by construction.
//
// Both halves go through `lib/lease-grammar.mjs`. Re-implementing either would
// redden `helper-census.test.mjs`'s `covers` row, and would be the
// two-readers-one-rule divergence that module exists to close, reproduced
// inside the phase meant to close it.

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
 * An entry qualifies on two conditions together: some declaration INTERSECTS
 * one of its subject paths - the work will reach what the count is taken over -
 * and no declaration COVERS the entry's own holding file, so nothing in the
 * plan can move the number back into agreement. Declaring the holder is
 * therefore the whole remedy, which is what makes the refusal actionable rather
 * than merely correct.
 *
 * Intersection is the right half on the subject side and containment on the
 * holder side, and they are not interchangeable: a declaration may be a
 * DIRECTORY lease that contains a subject, or a subject may be a directory
 * lease containing the declaration, and either reaches the count - while the
 * holder is one named file, and a lease amendment has to actually reach it.
 *
 * Pure: no `fs`, no git, no envelope, no throw. The caller owns those and owns
 * the verdict. Living here rather than in the seam is what lets a replay ask
 * the question once per historical plan without a seam invocation each time.
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
