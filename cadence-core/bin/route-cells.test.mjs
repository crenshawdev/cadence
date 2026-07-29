// Grammar tests for lib/route-cells.mjs - what makes route-table.json's three
// grids well-formed. Run: node --test cadence-core/bin/route-cells.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test() with
// a sequential loop reports the loop's count, not the rows', so a row that never
// ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess - the lib is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellIssues, declaredRoles, routableAgents } from './lib/route-cells.mjs';

const LEVELS = ['solo', 'shipped', 'critical'];
const TRIGGERS = ['plan', 'diff', 'risk_surface', 'phase_diff', 'pre_ship'];
const GATES = ['off', 'advisory', 'blocking', 'adjudicated'];
const VOCAB = { levels: LEVELS, triggers: TRIGGERS, gates: GATES };

/** A well-formed one-role table, deep-cloned per row so a mutation is local. */
function table(role = 'cad-verifier', cell = { model: 'opus', effort: 'high', retry: 'xhigh' }) {
  const t = {
    rung_order: ['low', 'medium', 'high', 'xhigh', 'max'],
    model_aliases: ['opus', 'sonnet', 'haiku', 'fable'],
    role_order: [role],
    cells: {}, review: {}, verify: {},
  };
  for (const level of LEVELS) {
    t.cells[level] = { [role]: { ...cell } };
    t.review[level] = { plan: 'advisory', diff: 'off', risk_surface: 'blocking', phase_diff: 'off', pre_ship: 'advisory' };
    t.verify[level] = 'off';
  }
  return t;
}

const codes = (t) => cellIssues(t, VOCAB).map((i) => i.code);
const find = (t, code) => cellIssues(t, VOCAB).find((i) => i.code === code);

test('a well-formed table has no issues', () => {
  assert.deepEqual(cellIssues(table(), VOCAB), []);
});

// --- missing-cell -------------------------------------------------------------

test('a (level, role) pair with no entry is missing-cell naming the cell', () => {
  const t = table();
  delete t.cells.critical['cad-verifier'];
  const hit = find(t, 'missing-cell');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /critical\/cad-verifier/);
});

test('a level with no review row is missing-cell naming the level', () => {
  const t = table();
  delete t.review.shipped;
  const hit = find(t, 'missing-cell');
  assert.ok(hit);
  assert.match(hit.detail, /^shipped: no review row/);
});

test('a trigger the level omits is missing-cell naming <level>/<trigger>', () => {
  const t = table();
  delete t.review.solo.phase_diff;
  const hit = find(t, 'missing-cell');
  assert.ok(hit);
  assert.match(hit.detail, /solo\/phase_diff/);
});

test('a level with no verify value is missing-cell naming the level', () => {
  const t = table();
  delete t.verify.critical;
  const hit = find(t, 'missing-cell');
  assert.ok(hit);
  assert.match(hit.detail, /^critical: no verify value/);
});

test('a verify value of "off" is present, not absent - falsy is not missing', () => {
  // `off` is a legitimate value and the only two-state one; a truthiness test
  // here would report the shipped solo level as a torn table.
  const t = table();
  assert.deepEqual(cellIssues(t, VOCAB), []);
  assert.equal(t.verify.solo, 'off');
});

// --- missing-rung-agent -------------------------------------------------------

test('a cell rung that maps to no agent file is missing-rung-agent naming the cell', () => {
  const t = table();
  t.cells.shipped['cad-verifier'].retry = 'low'; // cad-verifier has no `low` file
  const hit = find(t, 'missing-rung-agent');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /shipped\/cad-verifier/);
  assert.match(hit.detail, /retry/);
});

test('the starting rung is checked as well as the retry rung', () => {
  const t = table();
  t.cells.solo['cad-verifier'].effort = 'low';
  const hit = find(t, 'missing-rung-agent');
  assert.ok(hit);
  assert.match(hit.detail, /solo\/cad-verifier/);
  assert.match(hit.detail, /effort/);
});

// --- malformed input ----------------------------------------------------------

test('a null cell is missing-cell, never a throw', () => {
  const t = table();
  t.cells.solo['cad-verifier'] = null;
  const hit = find(t, 'missing-cell');
  assert.ok(hit);
  assert.match(hit.detail, /solo\/cad-verifier/);
});

test('a rung of the wrong TYPE reports rather than throwing', () => {
  const t = table();
  t.cells.solo['cad-verifier'].effort = 7;
  assert.ok(codes(t).includes('missing-rung-agent'));
});

test('a table that is null, a string or an array yields issues but never throws', () => {
  for (const bad of [null, undefined, 'nope', [1, 2], 42]) {
    assert.doesNotThrow(() => cellIssues(bad, VOCAB));
  }
  // With no declared roles there are no (level, role) pairs to miss, but every
  // level still owes a review row and a verify value.
  assert.equal(cellIssues(null, VOCAB).length, LEVELS.length * 2);
});

test('an empty vocabulary checks nothing rather than failing everything', () => {
  // The caller supplies the accepted names from config.schema.json; a schema
  // that failed to yield them must not turn into 18 phantom problems.
  assert.deepEqual(cellIssues(table(), {}), []);
});

// --- declaredRoles / routableAgents -------------------------------------------

test('declaredRoles reads the declared array and filters non-strings', () => {
  assert.deepEqual(declaredRoles({ role_order: ['cad-planner', 3, '', 'cad-verifier'] }),
    ['cad-planner', 'cad-verifier']);
  assert.deepEqual(declaredRoles({}), []);
  assert.deepEqual(declaredRoles(null), []);
});

test('routableAgents maps every stem the grids produce to the cell that wants it', () => {
  const m = routableAgents(table());
  assert.deepEqual([...m.keys()].sort(), ['cad-verifier', 'cad-verifier-xhigh']);
  assert.match(m.get('cad-verifier'), /^solo\/cad-verifier$/);
});

test('routableAgents skips a rung with no file rather than inventing a stem', () => {
  const t = table();
  t.cells.solo['cad-verifier'].effort = 'low';
  const m = routableAgents(t);
  assert.equal(m.has('cad-verifier-low'), false);
});

test('routableAgents on a malformed table is empty, never a throw', () => {
  assert.equal(routableAgents(null).size, 0);
  assert.equal(routableAgents({ cells: 'nope' }).size, 0);
  assert.equal(routableAgents({ cells: { solo: null } }).size, 0);
});
