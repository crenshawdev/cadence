// Grammar tests for lib/gate-agreement.mjs - what makes one of the twelve
// `review.triggers.<t>.{gate,tier,effort}` rows in config.schema.json a usable
// answer, now that the schema `default` IS the answer and no level-keyed grid
// decides it.
// Run: node --test cadence-core/bin/gate-agreement.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test()
// with a sequential loop reports the loop's count, not the rows', so a row that
// never ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess, no disk - the lib is pure.
//
// PRE_PATCH below is a FROZEN LITERAL, not a read of the live file, and that is
// the point of it: it is what the gate rows held on 2026-08-15, before the
// agreement rule existed at all, so the evidence arm - "this rule reports the
// drift that was actually there" - does not evaporate the day the shipped
// schema is fixed. The LIVE agreement is asserted from the CLI in
// self-verify.test.mjs instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateAgreementIssues, gateTriggers } from './lib/gate-agreement.mjs';

const GATES = ['off', 'advisory', 'deferred', 'blocking', 'adjudicated'];
const TIERS = ['flagship', 'balanced', 'cheap'];
const EFFORTS = ['minimal', 'low', 'medium', 'high'];

/** The enum each field is judged against - the row's OWN `values`, per the lib. */
const VALUES = { gate: GATES, tier: TIERS, effort: EFFORTS };

/**
 * The four gate rows EXACTLY as config.schema.json held them on 2026-08-15:
 * scalar defaults nothing checked, and purposes that state no default at all.
 * The AC1 fixture. Only `.gate` rows, which is what the file carried then, so
 * the tier and effort rows below are absent and read as malformed.
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
      + '(per-plan reviews never see cross-plan interactions)',
  },
};

/** The defaults the shipped rows carry, keyed the way `clean` walks them. */
const SHIPPED_DEFAULTS = {
  plan: { gate: 'advisory', tier: 'cheap', effort: 'low' },
  diff: { gate: 'off', tier: 'cheap', effort: 'minimal' },
  risk_surface: { gate: 'blocking', tier: 'cheap', effort: 'low' },
  phase_diff: { gate: 'off', tier: 'cheap', effort: 'low' },
};

/**
 * All twelve rows in agreement: a real default that is a member of the row's
 * own `values`, and a purpose carrying the `defaults to <value>` clause naming
 * it. `overrides` is keyed `"<trigger>.<field>"`, so one row is disturbed at a
 * time and every other row stays clean.
 * @param {Record<string, any>} [overrides]
 */
function clean(overrides = {}) {
  /** @type {Record<string, any>} */
  const keys = {};
  for (const [trigger, fields] of Object.entries(SHIPPED_DEFAULTS)) {
    for (const [field, dflt] of Object.entries(fields)) {
      keys[`review.triggers.${trigger}.${field}`] = {
        type: 'enum', values: VALUES[field], default: dflt, src: 'repo',
        purpose: `How the ${trigger} review's ${field} answers. Defaults to \`${dflt}\`; `
          + 'write any value here and that is what fires',
        ...(overrides[`${trigger}.${field}`] || {}),
      };
    }
  }
  return keys;
}

/** @param {Record<string, any>} keys */
const codes = (keys) => gateAgreementIssues(keys).map((i) => i.code);

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
    type: 'enum', values: GATES, default: 'nonesuch', purpose: 'How the spike review gates',
  };
  const found = gateAgreementIssues(keys);
  assert.ok(found.some((i) => i.code === 'gate-default-invalid' && /spike/.test(i.detail)),
    JSON.stringify(found));
});

test('a schema with no gate rows at all yields nothing', () => {
  assert.deepEqual(gateAgreementIssues({ 'review.reviewers': {} }), []);
});

test('all THREE fields of a trigger are walked, not the gate alone', () => {
  // The tier and effort rows carry real defaults now too, so the check that
  // used to see four rows sees twelve.
  const keys = clean();
  delete keys['review.triggers.plan.tier'];
  delete keys['review.triggers.plan.effort'];
  const found = gateAgreementIssues(keys);
  assert.deepEqual(found.map((i) => i.code), ['gate-row-malformed', 'gate-row-malformed']);
  assert.match(found[0].detail, /review\.triggers\.plan\.tier/);
  assert.match(found[1].detail, /review\.triggers\.plan\.effort/);
});

// --- AC1: the pre-patch schema, held to the rule that did not exist yet -------

test('AC1: every pre-patch purpose states no default, so each is reported', () => {
  const missing = gateAgreementIssues(PRE_PATCH).filter((i) => i.code === 'gate-prose-missing');
  for (const trigger of ['plan', 'diff', 'risk_surface', 'phase_diff']) {
    assert.ok(missing.some((i) => i.detail.includes(`review.triggers.${trigger}.gate`)),
      `${trigger}: ${JSON.stringify(missing)}`);
  }
});

test('AC1: the pre-patch defaults are all real gates, so none is invalid', () => {
  const bad = gateAgreementIssues(PRE_PATCH).filter((i) => i.code === 'gate-default-invalid');
  assert.deepEqual(bad, []);
});

// --- the reconciled rows are clean -------------------------------------------

test('a real default with a purpose naming it yields no problem at all', () => {
  assert.deepEqual(gateAgreementIssues(clean()), []);
});

// --- the prose half ----------------------------------------------------------

test('a purpose naming NO member is gate-prose-missing, naming the key', () => {
  const keys = clean({ 'plan.gate': { purpose: 'How the plan review gates' } });
  const found = gateAgreementIssues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-prose-missing');
  assert.match(found[0].detail, /review\.triggers\.plan\.gate/);
});

test('a purpose naming a DIFFERENT member is gate-prose-drift, naming both values', () => {
  const keys = clean({ 'diff.gate': {
    purpose: 'How the diff review gates. Defaults to `blocking`',
  } });
  const found = gateAgreementIssues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-prose-drift');
  assert.match(found[0].detail, /"blocking"/);
  assert.match(found[0].detail, /"off"/);
});

test('the prose half is MANDATORY - a correct default does not excuse silent prose', () => {
  // The opt-in version of this rule is silenced by deleting one sentence, which
  // is the hole check 14 closes for CONTRACTS rows.
  const keys = clean({ 'risk_surface.gate': {
    purpose: 'How the risk-surface review gates - it fires only on a detection match',
  } });
  assert.deepEqual(codes(keys), ['gate-prose-missing']);
});

test('a purpose that is not a string is gate-prose-missing, and says that is why', () => {
  const found = gateAgreementIssues(clean({ 'diff.tier': { purpose: 42 } }));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-prose-missing');
  assert.match(found[0].detail, /not a string/);
});

test('the clause grammar is case-insensitive and takes an unwrapped value', () => {
  const keys = clean({ 'diff.gate': { purpose: 'DEFAULTS TO off, and it fires nothing' } });
  assert.deepEqual(gateAgreementIssues(keys), []);
});

test('the clause grammar takes "default to" and a quoted value too', () => {
  const keys = clean({ 'plan.effort': { purpose: 'Reasoning effort. Default to "low".' } });
  assert.deepEqual(gateAgreementIssues(keys), []);
});

test('naming a member OUTSIDE the clause is free prose, not a claim', () => {
  // A purpose is allowed to list the other members and say what they do; only a
  // `defaults to <value>` clause states what the row answers.
  const keys = clean({ 'plan.gate': {
    purpose: 'How the plan review gates. Defaults to `advisory`; set `blocking` to stop '
      + 'execution, `off` to skip it, `adjudicated` to demand a panel',
  } });
  assert.deepEqual(gateAgreementIssues(keys), []);
});

test('a member that only PREFIXES a word in the purpose does not count as a clause', () => {
  // `off` inside `offset`: the value has to end where the clause does, or the
  // rule reports agreement it never read.
  const keys = clean({ 'diff.gate': { purpose: 'How the diff review defaults to offsets' } });
  assert.deepEqual(codes(keys), ['gate-prose-missing']);
});

// --- the default half --------------------------------------------------------

test('a NULL default is gate-default-invalid - the sentinel is gone', () => {
  // It used to be exempt, meaning "the stakes level decides". With no level, a
  // null default is a value the resolver cannot answer.
  const found = gateAgreementIssues(clean({ 'plan.gate': { default: null } }));
  assert.ok(found.some((i) => i.code === 'gate-default-invalid'), JSON.stringify(found));
  assert.match(found[0].detail, /review\.triggers\.plan\.gate/);
  assert.match(found[0].detail, /null/);
});

test('a default OUTSIDE its own values is gate-default-invalid, naming the value', () => {
  // The typo class no other check in the tree can see: nothing else validates a
  // schema `default` against its own key's `values` enum, and config.mjs get
  // answers whatever is written there.
  const found = gateAgreementIssues(clean({ 'diff.gate': { default: 'adivsory' } }));
  assert.ok(found.some((i) => i.code === 'gate-default-invalid'), JSON.stringify(found));
  assert.match(found[0].detail, /review\.triggers\.diff\.gate/);
  assert.match(found[0].detail, /"adivsory"/);
});

test('a boolean default is gate-default-invalid too, not a silent pass', () => {
  const found = gateAgreementIssues(clean({ 'plan.tier': { default: false } }));
  assert.ok(found.some((i) => i.code === 'gate-default-invalid'), JSON.stringify(found));
  assert.match(found[0].detail, /false/);
});

test('an absent default reads as absent, never as null', () => {
  const keys = clean();
  delete keys['review.triggers.plan.gate'].default;
  const found = gateAgreementIssues(keys);
  assert.ok(found.some((i) => i.code === 'gate-default-invalid'), JSON.stringify(found));
  assert.match(found[0].detail, /\(absent\)/);
});

test('a default valid for ANOTHER field is still invalid here - each row has its own enum', () => {
  // `low` is an effort, not a tier: the vocabulary is the ROW's `values`, so a
  // value borrowed from a sibling row is refused.
  const found = gateAgreementIssues(clean({ 'plan.tier': { default: 'low' } }));
  assert.ok(found.some((i) => i.code === 'gate-default-invalid'), JSON.stringify(found));
  assert.match(found[0].detail, /flagship, balanced, cheap/);
});

// --- two faults, two problems -------------------------------------------------

test('a row with two faults reports both, rather than short-circuiting', () => {
  // A wrong default AND prose that names nothing: two edits, so two problems.
  const keys = clean({ 'diff.gate': {
    default: 'adivsory', purpose: 'How the diff review gates',
  } });
  assert.deepEqual(codes(keys).sort(), ['gate-default-invalid', 'gate-prose-missing']);
});

test('an invalid default whose prose names a real member reports invalid AND drift', () => {
  // The prose half never stands down because the default half spoke: the
  // purpose really does disagree with the row, and fixing one leaves the other.
  const keys = clean({ 'plan.gate': { default: null } });
  assert.deepEqual(codes(keys).sort(), ['gate-default-invalid', 'gate-prose-drift']);
});

// --- malformed input ----------------------------------------------------------

test('a schema row that is not an object is gate-row-malformed, never a throw', () => {
  const keys = clean();
  keys['review.triggers.diff.gate'] = 'advisory';
  const found = gateAgreementIssues(keys);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'gate-row-malformed');
  assert.match(found[0].detail, /review\.triggers\.diff\.gate/);
});

test('a non-object schema map yields nothing, never a throw', () => {
  for (const bad of [null, undefined, 'x', 7, []]) {
    assert.deepEqual(gateAgreementIssues(bad), [], JSON.stringify(bad));
  }
});

test('a row with no values enum reports rather than passing green', () => {
  const keys = clean();
  delete keys['review.triggers.plan.gate'].values;
  assert.ok(codes(keys).includes('gate-default-invalid'), JSON.stringify(codes(keys)));
});
