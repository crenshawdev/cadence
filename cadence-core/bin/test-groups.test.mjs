// @ts-check
// test-groups.test.mjs - the census over `GROUPS.planning` in
// `cadence-core/bin/test.mjs` (CEN-03).
//
// WHAT IS PINNED, and why it is a census at all. `GROUPS.planning` is a list a
// human TYPED, and `node cadence-core/bin/test.mjs planning` - the documented
// way to run the planning seam, and the CI matrix cell of that name - runs
// exactly what that list names. A `planning-*.test.mjs` file nobody added to it
// still runs, in `other`, so nothing goes unrun; what silently stops being true
// is the claim that the `planning` cell covers the seam. That drift was live
// when this file was written: 23 such files on disk, 22 of them named.
//
// A SET, NEVER A COUNT (D-01). The pin is set equality against the tree in both
// directions - a `planning-*.test.mjs` file on disk that the list does not name
// fails, and an entry of the list with no `<stem>.test.mjs` file on disk fails -
// and no stem count is written down anywhere here. So a legitimate new planning
// test costs ONE list edit and not two, while a forgotten one still reddens.
// The shipped precedent for this hand-list-versus-tree shape is
// `rung-agent.test.mjs`'s `rung-agent-files` row.
//
// Direction one is scoped to `planning-*.test.mjs` files ONLY. This is not a
// coverage check over the `bin` tree: a stem in no group is a supported
// disposition, this file's own included.
//
// READ AS SOURCE TEXT, never imported. `cadence-core/bin/test.mjs` ends in the
// `spawnSync` that runs the suite, so importing it would run the whole suite
// from inside a test, and the alternative - a run-as-script guard on the
// repository's suite entrypoint - puts a silent `exit 0` between CI and every
// test in the tree, which is the failure `review-provider.mjs` already cost this
// repo (REV-01). A text read's failure mode is a red test; the guard's is a
// green one. The parse is guarded against vacuity below, because a regex that
// matched nothing would make the census pass over an empty set.
//
// No entry in `test.mjs`'s GROUPS: this stem is not a `planning-*` one, so it
// lands in `other`, which the default run and CI both execute - the same
// disposition `census-registry.test.mjs` and `phase-spelling.test.mjs` state
// for themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = dirname(fileURLToPath(import.meta.url));
const SUITE = join(BIN, 'test.mjs');
const SUFFIX = '.test.mjs';

/**
 * The stems `GROUPS.planning` names, read out of `test.mjs`'s SOURCE.
 *
 * Bounded by the `planning: [` key and the first `]` after it - the array holds
 * string literals and nothing nested, so the first close bracket is its own.
 * @returns {string[]}
 */
function groupPlanningStems() {
  const src = readFileSync(SUITE, 'utf8');
  const groups = src.indexOf('const GROUPS');
  assert.notEqual(groups, -1, 'no `const GROUPS` declaration in cadence-core/bin/test.mjs');
  const open = src.indexOf('planning: [', groups);
  assert.notEqual(open, -1, 'no `planning: [` entry inside GROUPS in cadence-core/bin/test.mjs');
  const close = src.indexOf(']', open);
  assert.notEqual(close, -1, 'the `planning` group array in cadence-core/bin/test.mjs is unterminated');
  const body = src.slice(open + 'planning: ['.length, close);
  const stems = [];
  for (const m of body.matchAll(/'([^']*)'/g)) stems.push(m[1]);
  return stems;
}

/** The `planning-*.test.mjs` stems actually on disk in `cadence-core/bin/`. */
function planningStemsOnDisk() {
  return readdirSync(BIN)
    .filter((f) => f.startsWith('planning-') && f.endsWith(SUFFIX))
    .map((f) => f.slice(0, -SUFFIX.length))
    .sort();
}

const NAMED = groupPlanningStems();
const ON_DISK = planningStemsOnDisk();

test('the parse reads a real list out of test.mjs, never an empty one', () => {
  // A parse that matched nothing would make the census below pass over an
  // empty set, which is the exact failure a census exists against. These four
  // are in `GROUPS.planning` today and are named here as anchors, not as a
  // count: adding or removing OTHER stems does not touch this arm.
  assert.ok(NAMED.length > 0, 'parsed no stems at all out of GROUPS.planning');
  for (const anchor of ['planning', 'planning-lease-check', 'trace', 'debt-markers']) {
    assert.ok(NAMED.includes(anchor), `expected \`${anchor}\` among the parsed GROUPS.planning stems, got: ${NAMED.join(', ')}`);
  }
  assert.ok(ON_DISK.length > 0, 'found no planning-*.test.mjs files in cadence-core/bin/');
});

// CADENCE-CENSUS: planning-group-stems | asserts: GROUPS.planning is exactly the set of planning-*.test.mjs stems in cadence-core/bin/, in both directions, plus its non-planning members, with no count written down
test('GROUPS.planning is exactly the planning-*.test.mjs files on disk, both directions', () => {
  const named = new Set(NAMED);
  const unnamed = ON_DISK.filter((s) => !named.has(s));
  assert.deepEqual(unnamed, [],
    `planning-*.test.mjs on disk that GROUPS.planning does not name: ${unnamed.join(', ')}`
    + ' - add the stem to the `planning` array in cadence-core/bin/test.mjs, or'
    + ' `node cadence-core/bin/test.mjs planning` leaves it running in `other`');

  const fileless = NAMED.filter((s) => !existsSync(join(BIN, `${s}${SUFFIX}`)));
  assert.deepEqual(fileless, [],
    `GROUPS.planning entries with no <stem>.test.mjs file in cadence-core/bin/: ${fileless.join(', ')}`
    + ' - delete the entry, or restore the file it names');
});
