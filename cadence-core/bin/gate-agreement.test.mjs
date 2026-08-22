// Grammar tests for lib/gate-agreement.mjs - what makes a
// `review.triggers.<t>.gate` row in config.schema.json agree with the gate
// cadence-core/route-table.json's `review` grid fires.
// Run: node --test cadence-core/bin/gate-agreement.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test()
// with a sequential loop reports the loop's count, not the rows', so a row that
// never ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess, no disk - the lib is pure.
//
// PRE_PATCH and SHIPPED_REVIEW below are FROZEN LITERALS, not reads of the live
// files, and that is the point of them. The first is what the four schema rows
// held on 2026-08-15, before this phase moved them onto the grid; the second is
// the `review` grid they were measured against. Reading either from disk would
// make the evidence arm - "this rule reports the drift that was actually
// there" - evaporate the moment the drift is fixed, and would re-red the whole
// file the day the grid legitimately moves, which it is the authority to do.
// The LIVE agreement is asserted from the CLI in self-verify.test.mjs instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateAgreementIssues, gateTriggers } from './lib/gate-agreement.mjs';

const LEVELS = ['solo', 'shipped', 'critical'];
const GATES = ['off', 'advisory', 'deferred', 'blocking', 'adjudicated'];
const VOCAB = { levels: LEVELS, gates: GATES };

/** The `review` grid as cadence-core/route-table.json shipped it on 2026-08-15. */
const SHIPPED_REVIEW = {
  solo: { plan: 'advisory', diff: 'off', risk_surface: 'blocking', phase_diff: 'off' },
  shipped: { plan: 'blocking', diff: 'off', risk_surface: 'blocking', phase_diff: 'off' },
  critical: { plan: 'adjudicated', diff: 'blocking', risk_surface: 'blocking', phase_diff: 'adjudicated' },
};

/** A table carrying that grid, deep-cloned per row so a mutation stays local. */
const shippedTable = () => ({ review: JSON.parse(JSON.stringify(SHIPPED_REVIEW)) });

/**
 * The four gate rows EXACTLY as config.schema.json held them before this phase:
 * three scalar defaults the grid fires at no level between them, and three
 * purposes that state no level at all. This is the AC1 fixture.
 */
const PRE_PATCH = {
  'review.triggers.plan.gate': {
    type: 'enum', values: GATES, default: 'adjudicated', src: 'repo',
    purpose: 'How the plan review gates',
  },
  'review.triggers.diff.gate': {
    type: 'enum', values: GATES, default: 'advisory', src: 'repo',
    purpose: 'How the diff review gates',
  },
  'review.triggers.risk_surface.gate': {
    type: 'enum', values: GATES, default: 'blocking', src: 'repo',
    purpose: 'How the risk-surface review gates',
  },
  'review.triggers.phase_diff.gate': {
    type: 'enum', values: GATES, default: 'advisory', src: 'repo',
    purpose: 'Aggregate review of the merged phase diff after parallel execution '
      + '(per-plan reviews never see cross-plan interactions). Leave it UNSET and the '
      + 'stakes level decides - off at solo, advisory at shipped, adjudicated at '
      + 'critical; writing any value pins it at every level and warns',
  },
};

/** The four rows in agreement with SHIPPED_REVIEW: null defaults, complete prose. */
function clean(overrides = {}) {
  const rows = {
    plan: 'advisory at solo, blocking at shipped, adjudicated at critical',
    diff: 'off at solo, off at shipped, blocking at critical',
    risk_surface: 'blocking at solo, blocking at shipped, blocking at critical',
    phase_diff: 'off at solo, off at shipped, adjudicated at critical',
  };
  /** @type {Record<string, any>} */
  const keys = {};
  for (const [trigger, clauses] of Object.entries(rows)) {
    keys[`review.triggers.${trigger}.gate`] = {
      type: 'enum', values: GATES, default: null, src: 'repo',
      purpose: `How the ${trigger} review gates. Leave it UNSET and the stakes level `
        + `decides - ${clauses}; writing any value pins it at every level and warns`,
      ...(overrides[trigger] || {}),
    };
  }
  return keys;
}

const issues = (keys, table = shippedTable()) => gateAgreementIssues(keys, table, VOCAB);
const codes = (keys, table = shippedTable()) => issues(keys, table).map((i) => i.code);

// --- the trigger list is DERIVED (D-09) --------------------------------------

test('gateTriggers reads the trigger names off the schema, in key order', () => {
  assert.deepEqual(gateTriggers(PRE_PATCH), ['plan', 'diff', 'risk_surface', 'phase_diff']);
});

test('gateTriggers ignores tier/effort/surfaces keys and any non-gate leaf', () => {
  assert.deepEqual(gateTriggers({
    'review.triggers.plan.gate': {},
    'review.triggers.plan.tier': {},
    'review.triggers.risk_surface.surfaces': {},
    'review.reviewers': {},
    'review.triggers.gate': {},
    'review.triggers.deep.nested.gate': {},
  }), ['plan']);
});

test('a fifth trigger is walked the day its key lands, with no edit here', () => {
  const keys = clean();
  keys['review.triggers.spike.gate'] = {
    type: 'enum', values: GATES, default: 'blocking', purpose: 'How the spike review gates',
  };
  const t = shippedTable();
  for (const level of LEVELS) t.review[level].spike = 'off';
  const found = issues(keys, t);
  assert.ok(found.some((i) => i.code === 'gate-default-drift' && /spike/.test(i.detail)),
    JSON.stringify(found));
});

test('a schema with no gate rows at all yields nothing', () => {
  assert.deepEqual(gateAgreementIssues({ 'review.reviewers': {} }, shippedTable(), VOCAB), []);
});

// --- AC1: the pre-patch schema against the grid it shipped beside -------------

test('AC1: the pre-patch rows report plan, diff and phase_diff as disagreeing', () => {
  const found = issues(PRE_PATCH);
  const drift = found.filter((i) => i.code === 'gate-default-drift');
  for (const trigger of ['plan', 'diff', 'phase_diff']) {
    assert.ok(drift.some((i) => i.detail.includes(`review.triggers.${trigger}.gate`)),
      `${trigger}: ${JSON.stringify(found)}`);
  }
});

test('AC1: at least one pre-patch detail names phase_diff AND shipped', () => {
  // The #134 cell by name: v3.2.0 moved shipped/phase_diff advisory -> off and
  // left the schema saying advisory, in the default AND in the prose.
  const found = issues(PRE_PATCH);
  assert.ok(found.some((i) => /phase_diff/.test(i.detail) && /shipped/.test(i.detail)),
    JSON.stringify(found));
  assert.ok(found.some((i) => i.code === 'gate-prose-drift'
    && /phase_diff/.test(i.detail) && /"advisory at shipped"/.test(i.detail)),
  JSON.stringify(found));
});

test('AC1: risk_surface, whose default agrees at every level, files no default drift', () => {
  const drift = issues(PRE_PATCH).filter((i) => i.code === 'gate-default-drift');
  assert.equal(drift.filter((i) => /risk_surface/.test(i.detail)).length, 0,
    JSON.stringify(drift));
});

test('AC1: the three level-less purposes are held anyway - the prose half is mandatory', () => {
  // D-03. risk_surface is the row that proves it: its default agrees at every
  // level, so an opt-in prose rule would report nothing at all about it.
  const missing = issues(PRE_PATCH).filter((i) => i.code === 'gate-prose-missing');
  for (const trigger of ['plan', 'diff', 'risk_surface']) {
    for (const level of LEVELS) {
      assert.ok(missing.some((i) => i.detail.includes(`review.triggers.${trigger}.gate`)
        && i.detail.includes(level)), `${trigger}/${level}: ${JSON.stringify(missing)}`);
    }
  }
});

// --- the reconciled rows are clean -------------------------------------------

test('a null default with complete, correct prose yields no problem at all', () => {
  assert.deepEqual(gateAgreementIssues(clean(), shippedTable(), VOCAB), []);
});

// --- the prose half ----------------------------------------------------------

test('deleting ONE level clause from ONE purpose is exactly one problem, naming both', () => {
  const keys = clean();
  const key = 'review.triggers.plan.gate';
  keys[key].purpose = keys[key].purpose.replace('blocking at shipped, ', '');
  const found = issues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-prose-missing');
  assert.match(found[0].detail, /review\.triggers\.plan\.gate/);
  assert.match(found[0].detail, /shipped/);
});

test('a purpose naming the wrong gate at a level is gate-prose-drift naming both gates', () => {
  const keys = clean({ diff: { purpose: 'How the diff review gates - off at solo, '
    + 'advisory at shipped, blocking at critical' } });
  const found = issues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-prose-drift');
  assert.match(found[0].detail, /"advisory at shipped"/);
  assert.match(found[0].detail, /"off" at shipped/);
});

test('a purpose that is not a string reports per level, and says that is why', () => {
  const keys = clean({ diff: { purpose: 42 } });
  const found = issues(keys);
  assert.equal(found.length, 3, JSON.stringify(found));
  assert.ok(found.every((i) => i.code === 'gate-prose-missing'));
  assert.match(found[0].detail, /not a string/);
});

test('the clause grammar is case-insensitive, so a sentence-opening clause counts', () => {
  const keys = clean({ diff: { purpose: 'Off at solo. OFF AT SHIPPED. Blocking at critical.' } });
  assert.deepEqual(issues(keys), []);
});

test('"blocking at every level" is not a level clause - the grammar names levels', () => {
  const keys = clean({ risk_surface: { purpose: 'It is blocking at every level' } });
  const found = issues(keys);
  assert.equal(found.length, 3, JSON.stringify(found));
  assert.ok(found.every((i) => i.code === 'gate-prose-missing'));
});

// --- the default half --------------------------------------------------------

test('a non-gate NON-null default is its own code, naming the trigger and the value', () => {
  // The typo class no other check in the tree can see: nothing validates a
  // schema `default` against its own key's `values` enum, and config.mjs get
  // answers whatever is written there.
  const keys = clean({ diff: { default: 'adivsory' } });
  const found = issues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-default-invalid');
  assert.match(found[0].detail, /review\.triggers\.diff\.gate/);
  assert.match(found[0].detail, /"adivsory"/);
});

test('a boolean default is gate-default-invalid too, not a silent pass', () => {
  const found = issues(clean({ plan: { default: false } }));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-default-invalid');
  assert.match(found[0].detail, /false/);
});

test('an absent default reads as invalid, never as the null sentinel', () => {
  const keys = clean();
  delete keys['review.triggers.plan.gate'].default;
  const found = issues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-default-invalid');
});

test('a scalar default that agrees at EVERY level still passes - only drift is reported', () => {
  // risk_surface today. It is legal, and D-01 moves it to null anyway: the
  // agreement is an accident of the grid, and goes quiet the day a cell moves.
  const found = issues(clean({ risk_surface: { default: 'blocking' } }));
  assert.deepEqual(found, []);
});

test('one gate-default-drift per trigger, naming every level it disagrees at', () => {
  const found = issues(clean({ diff: { default: 'advisory' } }));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-default-drift');
  for (const level of LEVELS) assert.match(found[0].detail, new RegExp(level));
});

test('a row with two faults reports both, rather than short-circuiting', () => {
  const keys = clean({ diff: { default: 'advisory',
    purpose: 'How the diff review gates - off at solo, off at shipped' } });
  assert.deepEqual(codes(keys).sort(), ['gate-default-drift', 'gate-prose-missing']);
});

// --- an unvalidated table ----------------------------------------------------

test('no review grid is ONE problem naming the triggers, never a throw', () => {
  const found = gateAgreementIssues(clean(), { cells: {} }, VOCAB);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-grid-missing');
  assert.match(found[0].detail, /plan, diff, risk_surface, phase_diff/);
});

test('a level with no row is ONE problem naming the level, not one per trigger', () => {
  const t = shippedTable();
  delete t.review.shipped;
  const found = gateAgreementIssues(clean(), t, VOCAB);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-grid-missing');
  assert.match(found[0].detail, /^shipped: /);
});

test('a cell that is not a gate is gate-grid-missing naming the trigger and level', () => {
  const t = shippedTable();
  t.review.critical.diff = 'blockign';
  const found = gateAgreementIssues(clean(), t, VOCAB);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-grid-missing');
  assert.match(found[0].detail, /review\.triggers\.diff\.gate/);
  assert.match(found[0].detail, /critical/);
});

test('an unusable cell is reported ONCE - the halves do not re-file it', () => {
  const t = shippedTable();
  delete t.review.critical.diff;
  const keys = clean({ diff: { purpose: 'off at solo, off at shipped' } });
  const found = gateAgreementIssues(keys, t, VOCAB);
  assert.deepEqual(found.map((i) => i.code), ['gate-grid-missing']);
});

test('a table that is not an object is gate-grid-missing, never a throw', () => {
  for (const bad of [null, undefined, 'x', 7, []]) {
    const found = gateAgreementIssues(clean(), bad, VOCAB);
    assert.deepEqual(found.map((i) => i.code), ['gate-grid-missing'], JSON.stringify(bad));
  }
});

test('a schema row that is not an object is gate-row-malformed, never a throw', () => {
  const keys = clean();
  keys['review.triggers.diff.gate'] = 'advisory';
  const found = issues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-row-malformed');
  assert.match(found[0].detail, /review\.triggers\.diff\.gate/);
});

test('a caller with no vocabulary yields nothing - the names come from the schema', () => {
  assert.deepEqual(gateAgreementIssues(PRE_PATCH, shippedTable(), {}), []);
  assert.deepEqual(gateAgreementIssues(PRE_PATCH, shippedTable(), { levels: LEVELS }), []);
  assert.deepEqual(gateAgreementIssues(PRE_PATCH, shippedTable(), { gates: GATES }), []);
});

test('a non-object schema map yields nothing, never a throw', () => {
  for (const bad of [null, undefined, 'x', 7, []]) {
    assert.deepEqual(gateAgreementIssues(bad, shippedTable(), VOCAB), [], JSON.stringify(bad));
  }
});
