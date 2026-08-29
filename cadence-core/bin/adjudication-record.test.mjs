// Grammar tests for lib/adjudication-record.mjs - what makes a composed
// adjudication payload a record, and what it refuses.
// Run: node --test cadence-core/bin/adjudication-record.test.mjs
//
// ONE test() per rule, deliberately: a table of refusals asserted inside a
// single test() with a sequential loop reports the loop's count, not the rows',
// so a row that never ran still looks green (route-cells.test.mjs states the
// same reason).
//
// The GRAMMAR half below takes only node: builtins and the module under test -
// it is pure, so those cases need no fixture tree, no repository and no
// subprocess. The seam's I/O half (the SHA resolution, the citation check, the
// written path) is asserted in planning.test.mjs, where the git fixtures live.
//
// THE RECOUNT SECTION AT THE END IS THE ONE EXCEPTION, deliberately. It asserts
// that counting a RECORD's rulings reproduces the figures its fire's trace
// event carries, and that claim is only worth anything against a record the
// SEAM actually wrote: a fixture assembled by hand here would pin the shape
// this test file imagines rather than the one on disk, which is the failure
// design-brief.test.mjs was cited for at the v3.2.0 audit. So it spawns the
// real subcommand against a scratch repository and reads back what landed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEntries, deriveCounts, RAISED_SEVERITIES, RULINGS, HALTING_SEVERITIES,
} from './lib/adjudication-record.mjs';
import { HALTING_SEVERITIES as FILING_HALTING_SEVERITIES } from './lib/filing-decision.mjs';
import { FINDING_SCHEMA } from './review-provider.mjs';

const PLANNING = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

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

test('the voice ROSTER survives a fire where every voice returned nothing', () => {
  // The `gate_pass` case D-02 names: a blocking fire that raised nothing still
  // writes a record, and a record that cannot say which voices ran is not
  // evidence that anything ran.
  const res = buildEntries(payload(voice('openai', 'gpt-5', []), voice('deepseek', 'ds', [])));
  assert.equal(res.ok, true, res.detail);
  assert.deepEqual(res.entries, []);
  assert.deepEqual(res.voices, [
    { voice: 'openai', model: 'gpt-5' },
    { voice: 'deepseek', model: 'ds' },
  ]);
  assert.deepEqual(res.counts, { raised: 0, survived: 0, downgraded: 0, refuted: 0 });
});

test('the roster carries no per-voice COUNT - every figure is derived', () => {
  const res = buildEntries(payload(voice('openai', 'gpt-5', [finding()])));
  assert.equal(res.ok, true, res.detail);
  assert.deepEqual(Object.keys(res.voices[0]).sort(), ['model', 'voice']);
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

test('AC3: a survived BLOCKER or HIGH with no fix commit is REFUSED', () => {
  // NARROWED to the two halting severities, never deleted: the refusal locked
  // in v3.5.6 still fires wherever a blocking gate is halting to fix. The
  // severity is spelled out at each call site rather than riding finding()'s
  // default, so the narrowing is visible in the row instead of in a default
  // that could change under it.
  for (const severity of ['blocker', 'high']) {
    const findings = [finding({ severity })];
    const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'survived' }])));
    assert.equal(res.ok, false, `a survived ${severity} with no fix commit was accepted`);
    assert.match(res.detail, /carries neither a usable fix_commit nor overridden: true/);
    assert.match(res.detail, /raised at blocker or high/,
      'the refusal has to name the severity gate, or a coordinator settling a medium goes '
      + 'hunting a commit id it was never being asked for');
    assert.match(res.detail, /marks the user override/,
      'and it has to name the other way out, or a coordinator settling an OVERRIDE - who has '
      + 'no commit to offer and never will - reads a demand it cannot meet');
  }
});

// --- the override marker: the second way a survived blocker settles ----------

test('an OVERRIDDEN survived blocker with no fix commit is accepted, and stores no commit id', () => {
  // The run `.planning/ARCHIVE.md` records: an `override` receipt was written
  // and no `ADJUDICATION-*.json` existed beside it, because the only ruling the
  // adjudicator held was one this module refused.
  const findings = [finding({ severity: 'blocker' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'survived', overridden: true }])));
  assert.equal(res.ok, true, res.detail);
  assert.equal(res.entries[0].overridden, true);
  assert.equal('fix_commit' in res.entries[0], false,
    'the override settle point produces a reason on the receipt and no commit at all, so a '
    + 'SHA on this entry could only have been fabricated');
  assert.equal(res.entries[0].ruling, 'survived');
});

test('the override marker is the boolean true and nothing else', () => {
  // A truthy string would buy a clear nobody stated; `false` says the finding
  // was NOT overridden, which absence already says without adding a key.
  for (const bad of ['yes', 'true', 1, 0, false, null, {}]) {
    const findings = [finding({ severity: 'blocker' })];
    const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
      [{ ruling: 'survived', overridden: bad }])));
    assert.equal(res.ok, false, `overridden ${JSON.stringify(bad)} was accepted`);
    assert.match(res.detail, /overridden must be the boolean true or be absent/);
  }
});

test('the override marker buys no exemption from the fix_commit VALUE check', () => {
  // The combination the existing 'zzzzzzz' row cannot catch, because it carries
  // no marker: an auditor runs `git show` on whatever the entry holds, so a
  // junk id stored beside an override fails them exactly as one stored alone.
  const findings = [finding({ severity: 'blocker' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'survived', overridden: true, fix_commit: 'zzzzzzz' }])));
  assert.equal(res.ok, false, 'the marker let a malformed commit id through');
  assert.match(res.detail, /no usable fix_commit/);
});

test('an overridden survived blocker citing a VALID fix commit carries both keys', () => {
  // Legal, and deliberately not refused: a fix landed and the halt was also
  // overridden. Only the value check governs the id.
  const findings = [finding({ severity: 'blocker' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'survived', overridden: true, fix_commit: '1b34563' }])));
  assert.equal(res.ok, true, res.detail);
  assert.equal(res.entries[0].overridden, true);
  assert.equal(res.entries[0].fix_commit, '1b34563');
});

test('the marker is not restricted to survived, nor to a severity', () => {
  // `counter_evidence` is likewise carried with no severity or ruling
  // condition. One locked decision does not license a second check beside it.
  const findings = [finding({ severity: 'medium' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'downgraded', overridden: true }])));
  assert.equal(res.ok, true, res.detail);
  assert.equal(res.entries[0].overridden, true);
});

test('an ordinary entry gains no overridden key', () => {
  const findings = [finding({ severity: 'medium' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'survived' }])));
  assert.equal(res.ok, true, res.detail);
  assert.equal('overridden' in res.entries[0], false);
});

test('the marker added no fourth RULING - a survived high with neither is still REFUSED', () => {
  const findings = [finding({ severity: 'high' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'survived' }])));
  assert.equal(res.ok, false);
  assert.deepEqual([...RULINGS], ['survived', 'downgraded', 'refuted'],
    'the override is a MARKER on a survived ruling, never a fourth value - a fourth would need '
    + 'a fourth receipt flag in planning/trace.mjs and would break the "no fourth ruling" '
    + 'invariant lib/deferred-queue.mjs states');
});

test('a survived MEDIUM or LOW with no fix commit is ACCEPTED, and stores no such key', () => {
  // The state GH-159 reports: a blocking gate's below-blocker/high remainder,
  // confirmed and moved past with nothing to cite. Before this it could only
  // be stored by downgrading the finding, which records a pass.
  for (const severity of ['medium', 'low']) {
    const findings = [finding({ severity })];
    const res = buildEntries(payload(voice('openai', 'gpt-5', findings, [{ ruling: 'survived' }])));
    assert.equal(res.ok, true, res.detail);
    assert.equal(res.entries[0].ruling, 'survived');
    assert.equal(res.entries[0].severity, severity);
    assert.equal('fix_commit' in res.entries[0], false,
      'an unfixed survivor must carry no fix_commit key at all - an empty string there is a '
      + 'value an auditor would try to run git show on');
    assert.deepEqual(res.counts, { raised: 1, survived: 1, downgraded: 0, refuted: 0 });
  }
});

test('a survived MEDIUM that does cite a fix commit is accepted and stores it', () => {
  // D-07: the requirement is gated, the CAPABILITY is not - a voluntary fix on
  // a medium can still name the commit that made it.
  const findings = [finding({ severity: 'medium' })];
  const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
    [{ ruling: 'survived', fix_commit: '1b34563' }])));
  assert.equal(res.ok, true, res.detail);
  assert.equal(res.entries[0].fix_commit, '1b34563');
});

test('a survived MEDIUM citing an unusable fix commit is still REFUSED', () => {
  // The VALUE check is not severity-gated: a junk id on a medium fails an
  // auditor exactly as one on a blocker does.
  for (const bad of ['zzzzzzz', '', null, 0]) {
    const findings = [finding({ severity: 'medium' })];
    const res = buildEntries(payload(voice('openai', 'gpt-5', findings,
      [{ ruling: 'survived', fix_commit: bad }])));
    assert.equal(res.ok, false, `fix_commit ${JSON.stringify(bad)} was accepted on a medium`);
    assert.match(res.detail, /no usable fix_commit/);
  }
});

test('AC3: a blank or non-hexadecimal fix commit is REFUSED like an absent one', () => {
  // Wider than AC3, which bounds only absence: an auditor has to run `git show`
  // on that value, and a string that cannot be a commit id fails them exactly
  // as an absent one does.
  // PRESENT means the key is SET, never that its value is truthy: the falsy
  // members below are exactly the ones a truthiness read would let through.
  for (const bad of ['', '   ', 'the fix commit', 'zzzzzzz', 'abc', null, 0, false]) {
    const findings = [finding({ severity: 'high' })];
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
    assert.equal(res.entries[0].severity, 'high', 'finding() raises at high by default, which is '
      + 'what makes this row exercise the severity-gated presence requirement');
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

test('the halting severities match lib/filing-decision.mjs\'s own list', () => {
  // Hand-maintained here and compared THERE, for the reason the row above
  // states: lib/filing-decision.mjs imports buildEntries from the module under
  // test, so importing its list back would be a cycle. This is what stops the
  // two drifting - a fix_commit the record demands at a severity the filing
  // decision does not halt over, or the reverse.
  assert.deepEqual([...HALTING_SEVERITIES], [...FILING_HALTING_SEVERITIES],
    'lib/adjudication-record.mjs HALTING_SEVERITIES has drifted from '
    + 'lib/filing-decision.mjs HALTING_SEVERITIES - the record and the filing decision would '
    + 'disagree about which survivors the gate is halting to fix');
  assert.equal(HALTING_SEVERITIES.every((s) => RAISED_SEVERITIES.includes(s)), true,
    'every halting severity has to be one a finding can be RAISED at');
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

  // The same guard over the override marker: RULING_KEYS grew by one key, and a
  // misspelling of THAT one must be told rather than quietly stored as a
  // survived blocker with no override on it.
  const markerTypo = voice('openai', 'gpt-5', findings, [{ ruling: 'survived', overriden: true }]);
  assert.match(buildEntries(payload(markerTypo)).detail, /carries an unknown key: overriden/);
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

// --- AC4: the recount, against a record the SEAM wrote ----------------------
//
// D-01's cross-check compares two INDEPENDENT artifacts: the committed record
// and the fire's trace event. What makes the survivor count recomputable rather
// than asserted is that counting the record's rulings answers the same three
// figures, from the record alone - no third source, and nothing stored on the
// record that a tamperer could edit to agree with itself.

/** A scratch git repo with `.planning/phases/2/` and two commits. */
function scratchRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'cad-recount-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  const dir = join(repo, '.planning');
  mkdirSync(join(dir, 'phases', '2'), { recursive: true });
  writeFileSync(join(repo, 'src.js'), 'let x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  writeFileSync(join(repo, 'src.js'), 'let x = 2;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'head');
  return { repo, dir };
}

/**
 * Run the REAL `planning.mjs adjudication` over one voice ruled as `rulings`
 * says, and answer `{file, record, envelope}` - the bytes that landed plus the
 * counts the seam derived, which are the figures a receipt copies.
 */
function seamRecord(rulings) {
  const { repo, dir } = scratchRepo();
  const findings = rulings.map((_r, i) => finding({
    line: i + 1,
    claim: `The ${i}th call writes before it validates.`,
    failure_scenario: `A truncated ${i}th payload leaves a half-written record.`,
  }));
  const payloadFile = join(repo, 'payload.json');
  writeFileSync(payloadFile, JSON.stringify({
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: { findings },
      rulings: rulings.map((r, i) => ruling(findings, i, {
        ruling: r,
        ...(r === 'survived' ? { fix_commit: 'abcdef1' } : {}),
        ...(r === 'refuted'
          ? { counter_evidence: { file: 'src.js', line: 1, note: 'the branch is unreachable' } }
          : {}),
      })),
    }],
  }));
  const envelope = JSON.parse(execFileSync('node', [PLANNING, '--dir', dir, 'adjudication',
    '--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', 'HEAD~1', '--head', 'HEAD', '--payload', payloadFile],
  { encoding: 'utf8', cwd: repo }));
  assert.equal(envelope.ok, true, JSON.stringify(envelope));
  const file = join(dir, envelope.record);
  return { file, record: JSON.parse(readFileSync(file, 'utf8')), envelope };
}

/** The outcome event a settle receipt writes, built from the seam's own counts. */
const outcomeEvent = (envelope) => ({
  family: 'outcome',
  event: 'adjudication',
  trigger: envelope.trigger,
  plan: '1',
  raised: envelope.counts.raised,
  survivors: envelope.counts.survived,
  downgraded: envelope.counts.downgraded,
  refuted: envelope.counts.refuted,
});

test('AC4: counting a written record\'s rulings reproduces the figures on its trace event', () => {
  const { record, envelope } = seamRecord(['survived', 'refuted', 'downgraded', 'refuted']);
  const event = outcomeEvent(envelope);
  // The RECORD stores no count of its own, so this is a recount and not a read.
  assert.equal(record.counts, undefined);
  const counted = deriveCounts(record.entries);
  assert.deepEqual(
    [counted.survived, counted.downgraded, counted.refuted],
    [event.survivors, event.downgraded, event.refuted]);
  assert.equal(counted.raised, record.entries.length);
});

test('AC4: flipping ONE entry\'s ruling makes the record and its event disagree', () => {
  const { record, envelope } = seamRecord(['survived', 'refuted', 'downgraded', 'refuted']);
  const event = outcomeEvent(envelope);
  const before = deriveCounts(record.entries);

  // The tampering the record exists to make visible: one `refuted` restated as
  // `survived` after the fact, which is the ruling that DELETES a finding
  // turned into one that kept it.
  const tampered = { ...record, entries: record.entries.map((e, i) =>
    (i === 1 ? { ...e, ruling: 'survived' } : e)) };
  const after = deriveCounts(tampered.entries);

  assert.notDeepEqual(after, before);
  assert.equal(after.survived, before.survived + 1);
  assert.equal(after.refuted, before.refuted - 1);
  // DECIDABLE FROM THE TWO ARTIFACTS ALONE: the record's rulings and the
  // event's figures, with no third source consulted to break the tie.
  const agrees = (r, e) => {
    const c = deriveCounts(r.entries);
    return c.survived === e.survivors && c.downgraded === e.downgraded && c.refuted === e.refuted;
  };
  assert.equal(agrees(record, event), true);
  assert.equal(agrees(tampered, event), false);
  // The raised total is UNCHANGED by the flip, which is why a receipt carrying
  // `--raised` alone could never have caught this.
  assert.equal(after.raised, before.raised);
});

test('AC4: the recount reads the STORED entries, so an edited record answers differently', () => {
  const { file, record, envelope } = seamRecord(['refuted', 'refuted']);
  assert.deepEqual(envelope.counts, { raised: 2, survived: 0, downgraded: 0, refuted: 2 });
  // Written back to disk and re-read, because the claim is about the file an
  // auditor opens rather than an object this test happens to hold.
  writeFileSync(file, `${JSON.stringify({ ...record,
    entries: record.entries.map((e) => ({ ...e, ruling: 'survived', fix_commit: 'abcdef1' })) },
  null, 2)}\n`);
  const reread = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(deriveCounts(reread.entries),
    { raised: 2, survived: 2, downgraded: 0, refuted: 0 });
});
