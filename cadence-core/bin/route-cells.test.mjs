// Grammar tests for lib/route-cells.mjs - what makes route-table.json's five
// grids well-formed. Run: node --test cadence-core/bin/route-cells.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test() with
// a sequential loop reports the loop's count, not the rows', so a row that never
// ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess - the lib is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellIssues, declaredRoles, routableAgents, vocabularyIssues } from './lib/route-cells.mjs';

const LEVELS = ['solo', 'shipped', 'critical'];
const TRIGGERS = ['plan', 'diff', 'risk_surface', 'phase_diff'];
const GATES = ['off', 'advisory', 'blocking', 'adjudicated'];
const CATEGORIES = ['auth', 'migrations', 'billing', 'concurrency', 'destructive',
  'secrets', 'api_contract', 'untrusted_input'];
const VOCAB = { levels: LEVELS, triggers: TRIGGERS, gates: GATES };

/** A well-formed one-role table, deep-cloned per row so a mutation is local. */
function table(role = 'cad-verifier', cell = { model: 'opus', effort: 'high', retry: 'xhigh' }) {
  const t = {
    rung_order: ['low', 'medium', 'high', 'xhigh', 'max'],
    model_aliases: ['opus', 'sonnet', 'haiku', 'fable'],
    roles: [role],
    tier_names: ['flagship', 'balanced', 'cheap'],
    effort_names: ['high', 'medium', 'low', 'minimal'],
    cells: {}, review: {}, tiers: {}, efforts: {}, verify: {},
  };
  for (const level of LEVELS) {
    t.cells[level] = { [role]: { ...cell } };
    t.review[level] = { plan: 'advisory', diff: 'off', risk_surface: 'blocking', phase_diff: 'off' };
    // DENSE by construction, like the shipped grids: every level names every
    // trigger, so a row deleted below is the only sparseness in the fixture.
    t.tiers[level] = { plan: 'flagship', diff: 'balanced', risk_surface: 'flagship', phase_diff: 'flagship' };
    t.efforts[level] = { plan: 'high', diff: 'medium', risk_surface: 'high', phase_diff: 'high' };
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
  const hit = find(t, 'unknown-rung');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /solo\/cad-verifier/);
});

test('a model, gate or verify value of the wrong TYPE reports rather than throwing', () => {
  const t = table();
  t.cells.solo['cad-verifier'].model = { alias: 'opus' };
  t.review.shipped.diff = 3;
  t.verify.critical = null;
  const c = codes(t);
  assert.ok(c.includes('unknown-model'), JSON.stringify(cellIssues(t, VOCAB)));
  assert.ok(c.includes('unknown-gate'));
  assert.ok(c.includes('unknown-rung')); // the verify value's code
});

// --- the value vocabulary -----------------------------------------------------

test('a model outside model_aliases is unknown-model naming the cell and the set', () => {
  const t = table();
  t.cells.solo['cad-verifier'].model = 'gpt-5';
  const hit = find(t, 'unknown-model');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /solo\/cad-verifier/);
  assert.match(hit.detail, /model_aliases \[opus, sonnet, haiku, fable\]/);
});

test('a rung outside rung_order is unknown-rung, naming which of the two it was', () => {
  const t = table();
  t.cells.critical['cad-verifier'].retry = 'ludicrous';
  const hit = find(t, 'unknown-rung');
  assert.ok(hit);
  assert.match(hit.detail, /critical\/cad-verifier/);
  assert.match(hit.detail, /retry rung "ludicrous"/);
  assert.match(hit.detail, /rung_order \[low, medium, high, xhigh, max\]/);
});

test('a verify value outside on/off is unknown-rung naming the level', () => {
  const t = table();
  t.verify.shipped = 'maybe';
  const hit = find(t, 'unknown-rung');
  assert.ok(hit);
  assert.match(hit.detail, /^shipped: verify "maybe"/);
});

test('a gate outside the four gate values is unknown-gate naming the cell', () => {
  const t = table();
  t.review.solo.diff = 'maybe';
  const hit = find(t, 'unknown-gate');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /solo\/diff/);
  assert.match(hit.detail, /\[off, advisory, blocking, adjudicated\]/);
});

test('a review key that is not a schema trigger is unknown-trigger naming the cell', () => {
  const t = table();
  t.review.solo.frobnicate = 'blocking';
  const hit = find(t, 'unknown-trigger');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /solo\/frobnicate/);
  assert.match(hit.detail, /plan, diff, risk_surface, phase_diff/);
});

test('an unknown trigger reports ONCE, not also as a bad gate value', () => {
  const t = table();
  t.review.solo.frobnicate = 'maybe';
  const c = codes(t);
  assert.deepEqual(c, ['unknown-trigger']); // the gate is the wrong thing to fix
});

// --- the tiers and efforts grids, both keyed on (level, trigger) --------------
//
// WATCHED FAILING AT 478b1ff, the tip of this plan's unpatched tree. Observed
// there: `tiers` keyed on the trigger alone, so a LEVEL could omit a trigger -
// or the whole grid could omit a level - with nothing reported, and `efforts`
// did not exist, so every check below either passed vacuously or reported the
// wrong locator (`tiers/<trigger>`, which since RVW-03 names no cell).
//
// The two grids are the same shape, so every row runs against BOTH: a rule that
// held for one and not the other would be a difference in what a maintainer is
// told, not in what is true.
const GRIDS = [
  { grid: 'tiers', field: 'tier', vocabKey: 'tier_names', code: 'unknown-tier',
    bad: 'premium', set: '[flagship, balanced, cheap]' },
  { grid: 'efforts', field: 'effort', vocabKey: 'effort_names', code: 'unknown-effort',
    bad: 'ludicrous', set: '[high, medium, low, minimal]' },
];

for (const g of GRIDS) {
  test(`a (level, trigger) pair ${g.grid} omits is missing-cell naming grid, level and trigger`, () => {
    const t = table();
    delete t[g.grid].critical.risk_surface;
    const hit = find(t, 'missing-cell');
    assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
    assert.match(hit.detail, new RegExp(`^${g.grid}/critical/risk_surface`));
    assert.match(hit.detail, new RegExp(`review\\.triggers\\.risk_surface\\.${g.field}`));
  });

  test(`a level ${g.grid} omits entirely is ONE missing-cell naming grid and level`, () => {
    const t = table();
    delete t[g.grid].solo;
    const c = cellIssues(t, VOCAB).filter((i) => i.code === 'missing-cell');
    assert.equal(c.length, 1, JSON.stringify(c));
    assert.match(c[0].detail, new RegExp(`^${g.grid}/solo: no row`));
  });

  test(`an entry ${g.grid} carries for a non-trigger is unknown-trigger naming the cell`, () => {
    const t = table();
    t[g.grid].shipped.frobnicate = t[g.grid].shipped.plan;
    const hit = find(t, 'unknown-trigger');
    assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
    assert.match(hit.detail, new RegExp(`^${g.grid}/shipped/frobnicate`));
    assert.match(hit.detail, /plan, diff, risk_surface, phase_diff/);
  });

  test(`a ${g.grid} value outside ${g.vocabKey} is ${g.code} naming the cell and the set`, () => {
    const t = table();
    t[g.grid].shipped.plan = g.bad;
    const hit = find(t, g.code);
    assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
    assert.match(hit.detail, new RegExp(`^${g.grid}/shipped/plan`));
    assert.ok(hit.detail.includes(g.set), hit.detail);
  });

  test(`a ${g.grid} value of the wrong TYPE reports rather than throwing`, () => {
    const t = table();
    t[g.grid].solo.diff = 7;
    const hit = find(t, g.code);
    assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
    assert.match(hit.detail, new RegExp(`^${g.grid}/solo/diff`));
  });

  test(`an absent ${g.grid} block is ONE missing-cell, not one per cell`, () => {
    const t = table();
    delete t[g.grid];
    const c = cellIssues(t, VOCAB).filter((i) => i.code === 'missing-cell');
    assert.equal(c.length, 1, JSON.stringify(c));
    assert.match(c[0].detail, new RegExp(`^${g.grid}: no ${g.grid} block`));
  });

  test(`an absent ${g.vocabKey} is ONE problem, not one per cell`, () => {
    const t = table();
    delete t[g.vocabKey];
    const c = cellIssues(t, VOCAB).filter((i) => i.code === g.code);
    assert.equal(c.length, 1, JSON.stringify(c));
    assert.match(c[0].detail, new RegExp(`${g.vocabKey} is absent or empty`));
  });
}

test('a sparse grid is a fault, not a silent inheritance of another level (D-02)', () => {
  // The defect this requirement closes, one indirection further in: a level
  // that names no tier would read as "use whatever the level above resolved".
  const t = table();
  t.tiers.solo = { plan: 'cheap' };
  const c = cellIssues(t, VOCAB).filter((i) => i.code === 'missing-cell');
  assert.equal(c.length, 3, JSON.stringify(c));
  for (const trigger of ['diff', 'risk_surface', 'phase_diff']) {
    assert.ok(c.some((i) => i.detail.startsWith(`tiers/solo/${trigger}`)), trigger);
  }
});

// --- rung-demotion, the direction no membership check can see -----------------

test('a retry BELOW its effort is rung-demotion naming the cell and both rungs', () => {
  const t = table();
  t.cells.critical['cad-verifier'] = { model: 'opus', effort: 'xhigh', retry: 'medium' };
  const hit = find(t, 'rung-demotion');
  assert.ok(hit, JSON.stringify(cellIssues(t, VOCAB)));
  assert.match(hit.detail, /critical\/cad-verifier/);
  assert.match(hit.detail, /"medium"/);
  assert.match(hit.detail, /"xhigh"/);
});

test('a demoting retry passes every membership check - only direction catches it', () => {
  // `medium` is in rung_order AND has an agent file, so unknown-rung and
  // missing-rung-agent both stay silent. Without rung-demotion the table would
  // be green while a retry dispatched WEAKER and reported escalated: true.
  const t = table();
  t.cells.critical['cad-verifier'] = { model: 'opus', effort: 'xhigh', retry: 'medium' };
  assert.deepEqual(codes(t), ['rung-demotion']);
});

test('a retry EQUAL to its effort is not a demotion - two shipped cells hold', () => {
  const t = table();
  t.cells.critical['cad-verifier'] = { model: 'opus', effort: 'xhigh', retry: 'xhigh' };
  assert.deepEqual(cellIssues(t, VOCAB), []);
});

// --- no short-circuiting ------------------------------------------------------

test('two faults in different cells report two problems, not the first one', () => {
  const t = table();
  t.cells.solo['cad-verifier'].model = 'gpt-5';
  t.review.critical.plan = 'maybe';
  const c = codes(t);
  assert.ok(c.includes('unknown-model'), JSON.stringify(cellIssues(t, VOCAB)));
  assert.ok(c.includes('unknown-gate'));
});

test('two faults in ONE cell report two problems', () => {
  const t = table();
  t.cells.solo['cad-verifier'] = { model: 'gpt-5', effort: 'ludicrous', retry: 'xhigh' };
  const c = codes(t);
  assert.ok(c.includes('unknown-model'));
  assert.ok(c.includes('unknown-rung'));
});

test('an absent rung_order or model_aliases is ONE problem, not one per cell', () => {
  const t = table();
  delete t.rung_order;
  delete t.model_aliases;
  const c = cellIssues(t, VOCAB);
  assert.equal(c.filter((i) => i.code === 'unknown-rung').length, 1, JSON.stringify(c));
  assert.equal(c.filter((i) => i.code === 'unknown-model').length, 1);
  assert.match(c.find((i) => i.code === 'unknown-rung').detail, /rung_order is absent or empty/);
});

test('a table that is null, a string or an array yields issues but never throws', () => {
  for (const bad of [null, undefined, 'nope', [1, 2], 42]) {
    assert.doesNotThrow(() => cellIssues(bad, VOCAB));
  }
  // With no declared roles there are no (level, role) pairs to miss, but every
  // level still owes a review row and a verify value - plus the two each of
  // `tiers` and `efforts` owes ONCE: its block and its vocabulary array.
  assert.equal(cellIssues(null, VOCAB).length, LEVELS.length * 2 + 4);
});

test('an empty vocabulary checks nothing rather than failing everything', () => {
  // The caller supplies the accepted names from config.schema.json; a schema
  // that failed to yield them must not turn into 18 phantom problems.
  assert.deepEqual(cellIssues(table(), {}), []);
});

// --- declaredRoles / routableAgents -------------------------------------------

test('declaredRoles reads the declared array and filters non-strings', () => {
  assert.deepEqual(declaredRoles({ roles: ['cad-planner', 3, '', 'cad-verifier'] }),
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

// --- vocabularyIssues: the table's shared vocabulary arrays -------------------

const VOCAB_ARRAYS = { levels: LEVELS, gates: GATES };

/** A well-formed vocabulary table, deep-cloned per row. */
function vocabTable() {
  return { stakes_order: LEVELS, gates: GATES, risk_surface_categories: [...CATEGORIES] };
}

const vFind = (t, code, v = VOCAB_ARRAYS) => vocabularyIssues(t, v).find((i) => i.code === code);

test('a well-formed vocabulary block has no issues', () => {
  assert.deepEqual(vocabularyIssues(vocabTable(), VOCAB_ARRAYS), []);
});

test('a malformed table reports rather than throwing', () => {
  for (const t of [null, 'nope', 7, []]) {
    assert.doesNotThrow(() => vocabularyIssues(t, VOCAB_ARRAYS), JSON.stringify(t));
  }
});

test('a drifted stakes_order is stakes-order-drift naming both lists', () => {
  const t = vocabTable();
  t.stakes_order = ['solo', 'critical', 'shipped'];
  const hit = vFind(t, 'stakes-order-drift');
  assert.ok(hit, JSON.stringify(vocabularyIssues(t, VOCAB_ARRAYS)));
  assert.match(hit.detail, /solo, shipped, critical/);
});

test('an absent stakes_order is stakes-order-drift too - the ladder compares by index', () => {
  const t = vocabTable();
  delete t.stakes_order;
  assert.ok(vFind(t, 'stakes-order-drift'));
});

test('a drifted gates list is gate-vocabulary-drift naming both lists', () => {
  const t = vocabTable();
  t.gates = ['off', 'advisory', 'blocking'];
  const hit = vFind(t, 'gate-vocabulary-drift');
  assert.ok(hit, JSON.stringify(vocabularyIssues(t, VOCAB_ARRAYS)));
  assert.match(hit.detail, /off, advisory, blocking, adjudicated/);
});

test('an empty vocabulary checks nothing rather than failing everything', () => {
  // The caller supplies the accepted names; a schema that failed to yield them
  // must not turn into phantom problems.
  assert.deepEqual(vocabularyIssues(vocabTable(), {}), []);
});

// --- surface-vocabulary-missing ----------------------------------------------
//
// The one vocabulary check that takes NO caller list: route.mjs returns this
// array verbatim as the risk_surface scope when no config layer answered, so
// its well-formedness is the whole subject and there is nothing to compare it
// against here. It is checked even under an empty caller vocabulary, which is
// why the row below passes `{}`.

test('an absent risk_surface_categories is surface-vocabulary-missing', () => {
  const t = vocabTable();
  delete t.risk_surface_categories;
  const hit = vFind(t, 'surface-vocabulary-missing');
  assert.ok(hit, JSON.stringify(vocabularyIssues(t, VOCAB_ARRAYS)));
  assert.match(hit.detail, /review\.triggers\.risk_surface\.surfaces/);
});

test('an empty risk_surface_categories is surface-vocabulary-missing - an empty scope fires on nothing', () => {
  const t = vocabTable();
  t.risk_surface_categories = [];
  assert.ok(vFind(t, 'surface-vocabulary-missing'));
});

test('a non-string entry in risk_surface_categories is surface-vocabulary-missing', () => {
  for (const bad of [['auth', 7], ['auth', ''], ['auth', null], 'auth', { auth: true }]) {
    const t = vocabTable();
    t.risk_surface_categories = bad;
    assert.ok(vFind(t, 'surface-vocabulary-missing'), JSON.stringify(bad));
  }
});

test('risk_surface_categories is checked even when the caller supplies no vocabulary', () => {
  const t = vocabTable();
  delete t.risk_surface_categories;
  assert.deepEqual(vocabularyIssues(t, {}).map((i) => i.code), ['surface-vocabulary-missing']);
});
