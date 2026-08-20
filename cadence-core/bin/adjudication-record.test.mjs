// Grammar tests for lib/adjudication-record.mjs - what makes a composed
// adjudication payload a record, and what it refuses.
// Run: node --test cadence-core/bin/adjudication-record.test.mjs
//
// ONE test() per rule, deliberately: a table of refusals asserted inside a
// single test() with a sequential loop reports the loop's count, not the rows',
// so a row that never ran still looks green (route-cells.test.mjs states the
// same reason).
//
// Only node: builtins and the module under test - it is pure, so there is no
// fixture tree, no repository and no subprocess here. The seam's I/O half
// (the SHA resolution, the citation check, the written path) is asserted in
// planning.test.mjs, where the git fixtures already live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntries, deriveCounts, RAISED_SEVERITIES, RULINGS } from './lib/adjudication-record.mjs';
import { FINDING_SCHEMA } from './review-provider.mjs';

/** A finding as a reviewer returns one. */
const finding = (over = {}) => ({
  file: 'cadence-core/bin/planning.mjs',
  line: 42,
  severity: 'high',
  claim: 'The handler writes before it validates, so a malformed payload lands on disk.',
  failure_scenario: 'A truncated payload leaves a half-written record no reader can parse.',
  ...over,
});

/**
 * A ruling over `findings[idx]`, restating its two verbatim fields so the
 * module has both sides to compare. `over` is applied last, which is what lets
 * a case paraphrase one field on purpose.
 */
const ruling = (findings, idx, over = {}) => ({
  finding: idx,
  ruling: 'downgraded',
  claim: findings[idx].claim,
  failure_scenario: findings[idx].failure_scenario,
  ...over,
});

/** One voice's block: its returned object verbatim, plus one ruling per finding. */
const voice = (name, model, findings, overs = []) => ({
  voice: name,
  model,
  returned: { findings },
  rulings: findings.map((_f, i) => ruling(findings, i, overs[i] || {})),
});

const payload = (...voices) => ({ voices });

// --- AC1: one entry per finding RAISED per raising voice --------------------

test('AC1: two voices raising one convergent finding produce TWO entries, not one', () => {
  // Byte-identical file, line and claim from two different voices - the exact
  // shape review-triggers.md's panel arm used to dedupe away before any ruling
  // existed. The failure_scenario differs, because two models describe the same
  // defect in their own words and convergence is not a byte-equality test over
  // the whole finding.
  const shared = { file: 'cadence-core/bin/route.mjs', line: 7, claim: 'The gate clears itself.' };
  const a = [finding({ ...shared, failure_scenario: 'A blocking gate reports PASS unfired.' })];
  const b = [finding({ ...shared, failure_scenario: 'The range reads as never fired.' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', a), voice('deepseek', 'deepseek-chat', b)));

  assert.equal(res.ok, true, res.detail);
  assert.equal(res.entries.length, 2,
    'a convergent finding raised by two voices must leave one entry PER VOICE - collapsing them '
    + 'makes "the raising voice" a list and a reviewer\'s individual hit rate underivable');
  assert.deepEqual(res.entries.map((e) => e.voice), ['openai', 'deepseek']);
  assert.deepEqual(res.entries.map((e) => e.model), ['gpt-5', 'deepseek-chat']);
  assert.deepEqual(res.entries.map((e) => e.convergent), [true, true],
    'convergence is marked on BOTH entries, never used to merge them');
  assert.equal(res.counts.raised, 2);
});

test('AC1: a finding only one voice raised is not marked convergent', () => {
  const a = [finding({ file: 'a.mjs', line: 1, claim: 'only mine' })];
  const b = [finding({ file: 'b.mjs', line: 2, claim: 'only theirs' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', a), voice('deepseek', 'ds', b)));
  assert.equal(res.ok, true, res.detail);
  assert.deepEqual(res.entries.map((e) => e.convergent), [false, false]);
});

test('AC1: one voice raising the same finding twice is not convergence', () => {
  // The mark counts distinct VOICES. Counting raw repeats would let a single
  // reviewer manufacture the "two voices agree" signal by itself.
  const f = finding();
  const res = buildEntries(payload(voice('openai', 'gpt-5', [f, { ...f }])));
  assert.equal(res.ok, true, res.detail);
  assert.deepEqual(res.entries.map((e) => e.convergent), [false, false]);
});

test('AC1: a returned finding with no ruling is REFUSED, never silently absent', () => {
  const findings = [finding(), finding({ line: 99, claim: 'second' })];
  const block = voice('openai', 'gpt-5', findings);
  block.rulings = [block.rulings[0]];
  const res = buildEntries(payload(block));
  assert.equal(res.ok, false);
  assert.match(res.detail, /findings\[1\] has no ruling/);
  assert.deepEqual(res.entries, []);
});

test('AC1: a ruling naming no returned finding is REFUSED', () => {
  const findings = [finding()];
  const block = voice('openai', 'gpt-5', findings);
  block.rulings.push({ ...ruling(findings, 0), finding: 5 });
  const res = buildEntries(payload(block));
  assert.equal(res.ok, false);
  assert.match(res.detail, /names no returned finding/);
});

// --- AC2: the verbatim comparison -------------------------------------------

test('AC2: a ruling that paraphrases the claim is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ claim: 'The handler writes before validating.' }])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /claim is not byte-identical/);
  assert.deepEqual(res.entries, []);
});

test('AC2: a one-byte difference in the claim is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ claim: `${findings[0].claim} ` }])));
  assert.equal(res.ok, false, 'a trailing space is a different claim - the comparison is bytes, not words');
  assert.match(res.detail, /claim is not byte-identical/);
});

test('AC2: a paraphrased failure_scenario is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ failure_scenario: 'Something breaks.' }])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /failure_scenario is not byte-identical/);
});

test('AC2: the stored entry is copied from the RETURNED side and carries no restatement', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings)));
  assert.equal(res.ok, true, res.detail);
  assert.equal(res.entries[0].claim, findings[0].claim);
  assert.equal(res.entries[0].failure_scenario, findings[0].failure_scenario);
  assert.equal(res.entries[0].severity, 'high', 'the severity stored is the severity AS RAISED');
  assert.deepEqual(Object.keys(res.entries[0]).filter((k) => k === 'finding'), [],
    'the ruling side\'s index is a pairing device, never a stored field');
});

// --- AC3: the three refusals ------------------------------------------------

test('AC3: a ruling outside survived | downgraded | refuted is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'unadjudicated' }])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /must be one of survived \| downgraded \| refuted/);
});

test('AC3: a refuted entry with no counter-evidence is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'refuted' }])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /refuted and carries no counter_evidence/);
});

test('AC3: refuted counter-evidence must name contradicting CODE', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'refuted', counter_evidence: { note: 'I checked and it is fine.' } }])));
  assert.equal(res.ok, false, 'a bare assertion is not counter-evidence an auditor can open');
  assert.match(res.detail, /counter_evidence\.file must name the contradicting code/);
});

test('AC3: a refuted entry naming contradicting code is accepted and stores it', () => {
  const findings = [finding()];
  const ev = { file: 'cadence-core/bin/planning.mjs', line: 706, note: 'readJsonPayload runs first.' };
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'refuted', counter_evidence: ev }])));
  assert.equal(res.ok, true, res.detail);
  assert.deepEqual(res.entries[0].counter_evidence, ev);
});

test('AC3: a survived entry with no fix commit is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'survived' }])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /survived and carries no usable fix_commit/);
});

test('AC3: a blank or non-hexadecimal fix commit is REFUSED like an absent one', () => {
  // Wider than AC3, which bounds only absence: an auditor has to run `git show`
  // on that value, and a string that cannot be a commit id fails them exactly
  // as an absent one does.
  for (const bad of ['', '   ', 'the fix commit', 'zzzzzzz', 'abc']) {
    const findings = [finding()];
    const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
      [{ ruling: 'survived', fix_commit: bad }])));
    assert.equal(res.ok, false, `fix_commit ${JSON.stringify(bad)} was accepted`);
    assert.match(res.detail, /no usable fix_commit/);
  }
});

test('AC3: an abbreviated or full fix commit is accepted', () => {
  for (const good of ['1b34563', '23121a3f9c0e1d2a3b4c5d6e7f8091a2b3c4d5e6']) {
    const findings = [finding()];
    const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
      [{ ruling: 'survived', fix_commit: good }])));
    assert.equal(res.ok, true, res.detail);
    assert.equal(res.entries[0].fix_commit, good);
  }
});

// --- the derived counts ------------------------------------------------------

test('the counts are DERIVED by counting rulings over a mixed-ruling fixture', () => {
  const findings = [
    finding({ line: 1, claim: 'one' }),
    finding({ line: 2, claim: 'two' }),
    finding({ line: 3, claim: 'three' }),
    finding({ line: 4, claim: 'four' }),
  ];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [
    { ruling: 'survived', fix_commit: '1b34563' },
    { ruling: 'downgraded' },
    { ruling: 'refuted', counter_evidence: { file: 'cadence-core/bin/route.mjs', line: 3 } },
    { ruling: 'survived', fix_commit: '23121a3' },
  ])));
  assert.equal(res.ok, true, res.detail);
  assert.deepEqual(res.counts, { raised: 4, survived: 2, downgraded: 1, refuted: 1 });
});

test('deriveCounts recomputes from the STORED entries, so a reader can recount a record it did not write', () => {
  const findings = [finding({ line: 1, claim: 'one' }), finding({ line: 2, claim: 'two' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [
    { ruling: 'survived', fix_commit: '1b34563' },
    { ruling: 'refuted', counter_evidence: { file: 'a.mjs' } },
  ])));
  assert.equal(res.ok, true, res.detail);
  // The round trip a reader makes: JSON on disk, counted back out.
  const stored = JSON.parse(JSON.stringify(res.entries));
  assert.deepEqual(deriveCounts(stored), res.counts);

  // Flipping ONE ruling in the stored record changes the recomputed count -
  // which is what makes a record whose counts disagree with its trace event
  // detectable at all.
  stored[0].ruling = 'refuted';
  assert.deepEqual(deriveCounts(stored), { raised: 2, survived: 0, downgraded: 0, refuted: 2 });
});

test('deriveCounts counts a hand-invented fourth ruling in raised and in no bucket', () => {
  assert.deepEqual(deriveCounts([{ ruling: 'unadjudicated' }, { ruling: 'survived' }]),
    { raised: 2, survived: 1, downgraded: 0, refuted: 0 });
});

// --- the vocabularies --------------------------------------------------------

test('the severity vocabulary matches FINDING_SCHEMA\'s own enum', () => {
  // The hand-maintained-then-compared shape route-table.json states its reason
  // for on `risk_surface_categories`: the list is carried here so the pure
  // module imports no provider, and THIS is what stops the two drifting.
  const enumInSchema = FINDING_SCHEMA.properties.findings.items.properties.severity.enum;
  assert.deepEqual([...RAISED_SEVERITIES], [...enumInSchema],
    'lib/adjudication-record.mjs RAISED_SEVERITIES has drifted from review-provider.mjs '
    + 'FINDING_SCHEMA - a record would store a severity the review subsystem does not raise, '
    + 'or refuse one it does');
});

test('a severity outside the four is REFUSED', () => {
  const res = buildEntries(payload(voice('openai', 'gpt-5', [finding({ severity: 'critical' })])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /severity must be one of blocker \| high \| medium \| low/);
});

test('the ruling enum is exactly three values - no unadjudicated fourth', () => {
  assert.deepEqual([...RULINGS], ['survived', 'downgraded', 'refuted']);
});

// --- fail closed on every unreadable input -----------------------------------

test('a payload that is not an object is REFUSED', () => {
  for (const bad of [null, 'hello', 42, [], undefined]) {
    const res = buildEntries(bad);
    assert.equal(res.ok, false, `${JSON.stringify(bad)} was accepted`);
    assert.deepEqual(res.entries, []);
    assert.deepEqual(res.counts, { raised: 0, survived: 0, downgraded: 0, refuted: 0 });
  }
});

test('an empty or absent voices array is REFUSED', () => {
  for (const bad of [{}, { voices: [] }, { voices: 'openai' }]) {
    const res = buildEntries(bad);
    assert.equal(res.ok, false, `${JSON.stringify(bad)} was accepted`);
    assert.match(res.detail, /voices/);
  }
});

test('a voice with no name or no model is REFUSED', () => {
  const findings = [finding()];
  const noName = voice('openai', 'gpt-5', findings);
  noName.voice = '  ';
  assert.equal(buildEntries(payload(noName)).ok, false);
  const noModel = voice('openai', 'gpt-5', findings);
  delete noModel.model;
  const res = buildEntries(payload(noModel));
  assert.equal(res.ok, false);
  assert.match(res.detail, /model must name the model/);
});

test('one voice appearing twice is REFUSED', () => {
  const findings = [finding()];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings),
    voice('openai', 'gpt-5', findings)));
  assert.equal(res.ok, false, 'a voice agreeing with itself would double its own hit rate');
  assert.match(res.detail, /appears twice/);
});

test('an unknown key at any level is REFUSED rather than ignored', () => {
  const findings = [finding()];

  const extraTop = payload(voice('openai', 'gpt-5', findings));
  extraTop.survivors = 1;
  assert.match(buildEntries(extraTop).detail, /payload carries an unknown key: survivors/);

  const extraVoice = voice('openai', 'gpt-5', findings);
  extraVoice.convergent = true;
  assert.match(buildEntries(payload(extraVoice)).detail,
    /carries an unknown key: convergent/);

  // The case the strictness exists for: a misspelled `fix_commit` would
  // otherwise store a `survived` entry with no fix commit at all.
  const typo = voice('openai', 'gpt-5', findings, [{ ruling: 'survived', fix_comit: '1b34563' }]);
  assert.match(buildEntries(payload(typo)).detail, /carries an unknown key: fix_comit/);
});

test('a returned object carrying anything but findings is REFUSED', () => {
  const block = voice('openai', 'gpt-5', [finding()]);
  block.returned.usage = { tokens: 10 };
  const res = buildEntries(payload(block));
  assert.equal(res.ok, false, 'the returned half must be the reviewer\'s object and nothing else');
  assert.match(res.detail, /returned carries an unknown key: usage/);
});

test('a malformed finding is REFUSED - the bounds FINDING_SCHEMA states', () => {
  const cases = [
    [{ file: '' }, /file must be a non-blank path/],
    [{ file: 'x'.repeat(1025) }, /at most 1024 characters/],
    [{ line: 0 }, /line must be an integer of at least 1/],
    [{ line: '42' }, /line must be an integer of at least 1/],
    [{ claim: '' }, /claim must be non-blank/],
    [{ failure_scenario: 'x'.repeat(2001) }, /failure_scenario must be non-blank and at most 2000/],
  ];
  for (const [over, re] of cases) {
    const res = buildEntries(payload(voice('openai', 'gpt-5', [finding(over)])));
    assert.equal(res.ok, false, `${JSON.stringify(over)} was accepted`);
    assert.match(res.detail, re);
  }
});

test('a refusal names the entry it is about', () => {
  const findings = [finding(), finding({ line: 2, claim: 'second' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings),
    voice('deepseek', 'ds', findings, [{}, { ruling: 'survived' }])));
  assert.equal(res.ok, false);
  assert.match(res.detail, /voices\[1\]\.rulings\[1\]/,
    'the detail must locate the entry, or a fifty-finding payload refuses with nothing to repair');
});
