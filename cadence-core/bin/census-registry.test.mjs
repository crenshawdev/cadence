// The census registry's own test (CEN-01, AC1 and AC2). Three arms, and the
// third is the one with teeth: a census site in the live tree carrying the
// marker with no row in lib/census-registry.mjs reddens the suite here.
//
// NO ROW COUNT IS ASSERTED, deliberately (D-04). A length assertion would make
// adding a registry row a census-invalidating act - putting this registry into
// its own table and charging every future phase a lease amendment for the row
// it adds - so what arm (i) pins is the SHAPE of the rows instead. That is the
// same way helper-census.test.mjs:217-224 handles its own self-reference, and
// it is why this file is not itself a census and carries no marker.
//
// Every fixture string in arm (ii) is BUILT from the exported token rather than
// written as a literal marker head, because arm (iii) walks every `.mjs` under
// cadence-core/bin/ including this one: a spelled-out head here would be
// ingested as a real marked site and would need a second exclusion list to
// undo. That is the lib/merge-warnings.mjs discipline helper-census.test.mjs
// states - the fix belongs in the pattern, never in a second list.
//
// No entry in test.mjs's GROUPS: a stem no group names lands in `other`, which
// the default run and CI both execute, and that file's header states this is
// deliberate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRefusedSpelling } from './lib/lease-grammar.mjs';
import {
  CENSUSES, CENSUS_TOKEN, censusMarkersIn, censusIssues,
} from './lib/census-registry.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const REPO = join(BIN, '..', '..');

// --- arm (i): the shape of a row ---------------------------------------------

test('every row names four things, and the ids are distinct', () => {
  for (const e of CENSUSES) {
    const at = e.id || '(a row with no id)';
    assert.equal(typeof e.id, 'string', at);
    assert.ok(e.id.length > 0, 'a row must carry an id to join a marker to');
    assert.equal(typeof e.holder, 'string', `${at}: the file HOLDING the count`);
    assert.ok(e.holder.length > 0, `${at}: no holding file`);
    assert.equal(typeof e.counts, 'string', `${at}: what it counts`);
    assert.ok(e.counts.length > 0, `${at}: a row that does not say what it counts`);
    assert.equal(typeof e.asserted_by, 'string', `${at}: the site that asserts it`);
    assert.ok(e.asserted_by.length > 0, `${at}: no asserting site`);
    assert.ok(Array.isArray(e.subjects), `${at}: subjects must be a list`);
    // An empty subject list is a row that can never fire: D-02's whole point is
    // that the SUBJECT is the predicate, and a row without one is a census the
    // registry names and still cannot protect.
    assert.ok(e.subjects.length > 0, `${at}: no subjects, so the row can never fire`);
  }
  const ids = CENSUSES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids.join(', ')}`);
});

test('every holding file and every subject is a path the lease grammar accepts', () => {
  // Both sides are handed straight to lib/lease-grammar.mjs, so a spelling it
  // REFUSES is a row whose predicate silently answers about nothing.
  for (const e of CENSUSES) {
    for (const [what, p] of [['holder', e.holder], ...e.subjects.map((s) => ['subject', s])]) {
      assert.equal(typeof p, 'string', `${e.id}: ${what}`);
      assert.equal(isRefusedSpelling(p), false, `${e.id}: ${what} "${p}" is a refused spelling`);
      assert.ok(!p.startsWith('/'), `${e.id}: ${what} "${p}" must be repo-relative`);
      assert.ok(!p.includes('\\'), `${e.id}: ${what} "${p}" must be POSIX`);
    }
  }
});

test('the table and every row, subjects included, are frozen', () => {
  assert.equal(Object.isFrozen(CENSUSES), true);
  assert.throws(() => CENSUSES.push({}), TypeError);
  for (const e of CENSUSES) {
    assert.equal(Object.isFrozen(e), true, `${e.id} is a mutable row`);
    assert.throws(() => { e.id = 'x'; }, TypeError, `${e.id}: id is assignable`);
    assert.equal(Object.isFrozen(e.subjects), true, `${e.id}: subjects is a mutable list`);
    assert.throws(() => e.subjects.push('x'), TypeError, `${e.id}: subjects is pushable`);
  }
});

// --- arm (ii): the fixture pair, which is AC2's proof -------------------------

const HEAD = `${CENSUS_TOKEN}:`;
const CLAIM = 'the fixture pins a count over a synthesized tree';

/** One file's worth of source carrying exactly one marker, for `id`. */
const fixture = (id) => ['// a fixture module.', `  // ${HEAD} ${id} | asserts: ${CLAIM}`,
  "assert.equal(n, 41);", ''].join('\n');

test('a marked site whose id no row names is an issue, naming the file and the assertion', () => {
  const path = 'cadence-core/bin/fixture.test.mjs';
  const issues = censusIssues(path, censusMarkersIn(fixture('no-such-census')));
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].line, 2);
  assert.ok(issues[0].message.includes(path), issues[0].message);
  assert.ok(issues[0].message.includes(CLAIM), issues[0].message);
});

test('the same site with a registered id is not an issue', () => {
  // The pair is the proof: the ONLY difference between the two fixtures is the
  // id, so what reddens above is the missing row and nothing else.
  //
  // The id is a LITERAL, not `CENSUSES[0].id`. Reading it off the table would
  // make this arm answer about whichever row happens to be first, so deleting
  // that row would re-point the fixture at its neighbour and green - the arm
  // passing precisely when the registry lost a census.
  assert.deepEqual(censusIssues('cadence-core/bin/fixture.test.mjs',
    censusMarkersIn(fixture('rung-agent-files'))), []);
});

// --- arm (iii): the live tree -------------------------------------------------

/** Every .mjs file under `dir`, recursively, as REPO-relative POSIX paths. */
function everyModule(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...everyModule(full));
    else if (e.name.endsWith('.mjs')) out.push(relative(REPO, full).split('\\').join('/'));
  }
  return out;
}

const MODULES = everyModule(BIN);

test('the walk reaches the whole bin tree - more than 60 modules, lib/ and test files included', () => {
  // A walk that silently reached nothing would make the arm below pass by
  // measuring nothing, which is the exact failure a census exists against.
  assert.ok(MODULES.length > 60, `only ${MODULES.length} .mjs files found`);
  for (const expected of ['cadence-core/bin/lib/census-registry.mjs',
    'cadence-core/bin/census-registry.test.mjs', 'cadence-core/bin/self-verify.mjs',
    'cadence-core/bin/planning/lease-check.mjs']) {
    assert.ok(MODULES.includes(expected), `${expected} missing from the walk`);
  }
});

test('every marked census site in the live tree has a registry row', () => {
  // A census site LIVES in a test file, so `.test.mjs` is walked too. Delete a
  // row from lib/census-registry.mjs and this reddens naming the file and what
  // that assertion pins - which is the whole of D-06's one direction.
  const issues = MODULES.flatMap((rel) => censusIssues(rel,
    censusMarkersIn(readFileSync(join(REPO, rel), 'utf8'))));
  assert.deepEqual(issues.map((i) => i.message), [], issues.map((i) => i.message).join('\n'));
});
