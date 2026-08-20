// Grammar tests for lib/deferred-queue.mjs - what makes a deferred fire's
// payload a queue member, and what it refuses.
// Run: node --test cadence-core/bin/deferred-queue.test.mjs
//
// ONE test() per rule, deliberately: a table of refusals asserted inside a
// single test() with a sequential loop reports the loop's count, not the rows',
// so a row that never ran still looks green (route-cells.test.mjs states the
// same reason).
//
// PURE HALF ONLY. The module classifies and names; the seam's I/O half - the
// resolved ids, the refusal to overwrite, the written path, the absence of an
// adjudication record beside it - is asserted in planning.test.mjs, where the
// git fixtures live. That is the split adjudication-record.test.mjs already
// takes, for the same reason: these cases need no repository and no subprocess.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, isQueueName, queueIdentity, queueName } from './lib/deferred-queue.mjs';
import { buildEntries, recordName, RAISED_SEVERITIES } from './lib/adjudication-record.mjs';

/** A finding as a reviewer returns one. */
const finding = (over = {}) => ({
  file: 'cadence-core/bin/planning.mjs',
  line: 42,
  severity: 'high',
  claim: 'The handler writes before it validates, so a malformed payload lands on disk.',
  failure_scenario: 'A truncated payload leaves a half-written record no reader can parse.',
  ...over,
});

/** The reviewer's returned object, which IS the payload this seam takes. */
const payload = (...findings) => ({ findings });

test('the queue member and the record that supersedes it differ only in their stem', () => {
  // The pairing is what makes membership a filename comparison rather than a
  // second index: round 2's member is superseded by round 2's record and by
  // nothing else. A round rule that drifted between the two would leave a
  // re-arm's member permanently unadjudicated, or clear it off round one's.
  assert.equal(queueName('diff', 'plan-1', 1), 'DEFERRED-diff-plan-1.json');
  assert.equal(recordName('diff', 'plan-1', 1), 'ADJUDICATION-diff-plan-1.json');
  assert.equal(queueName('diff', 'plan-1', 2), 'DEFERRED-diff-plan-1-r2.json');
  assert.equal(recordName('diff', 'plan-1', 2), 'ADJUDICATION-diff-plan-1-r2.json');
  assert.equal(queueName('plan', 'cad-plan-9d10919', 1), 'DEFERRED-plan-cad-plan-9d10919.json');
});

test('a well-formed payload comes back ok with the findings VERBATIM', () => {
  const p = payload(finding(), finding({ line: 7, severity: 'blocker' }));
  const r = buildQueue(p);
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.detail, '');
  // The reviewer's own objects, identity included: a copy built field by field
  // would be the paraphrase the adjudication record beside it refuses.
  assert.deepEqual(r.findings, p.findings);
  assert.equal(r.findings[0], p.findings[0]);
});

test('an EMPTY findings array is a queue member, not a refusal', () => {
  // What a fire found is the reviewer's answer; which arm the fire settles at
  // is the gate's decision. Refusing here would decide the second from the
  // first, and stall a run whose `deferred` panel came back with nothing.
  const r = buildQueue({ findings: [] });
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(r.findings, []);
});

test('a payload that is not a JSON object is refused, never coerced', () => {
  for (const bad of [null, [], 'findings', 42, true]) {
    const r = buildQueue(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.detail, 'payload is not a JSON object');
    assert.deepEqual(r.findings, []);
  }
});

test('a key beside `findings` is refused - the payload IS the returned object', () => {
  // `additionalProperties: false`, the disposition FINDING_SCHEMA already
  // takes: a payload whose findings are under `results` must be told, not
  // stored as a member with no findings at all.
  const r = buildQueue({ findings: [finding()], survivors: 1 });
  assert.equal(r.ok, false);
  assert.match(r.detail, /^payload carries an unknown key: survivors/);
  assert.match(r.detail, /\{findings: \[\.\.\.\]\}/);
});

test('a non-array `findings` is refused rather than read as one finding', () => {
  for (const bad of [undefined, {}, 'one', 3]) {
    const r = buildQueue({ findings: bad });
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.detail, 'payload.findings must be an array');
  }
});

test('a finding is bounded by the SAME rule the adjudication record bounds it by', () => {
  // The whole reason `findingIssue` is exported. A queue member is triaged
  // later against the record that supersedes it, so a shape the queue stores
  // and the record refuses is a member nobody can ever adjudicate - discovered
  // at land time, when the reviewer's return is long gone.
  const cases = [
    [finding({ line: 0 }), /\.line must be an integer of at least 1$/],
    [finding({ line: 1.5 }), /\.line must be an integer of at least 1$/],
    [finding({ severity: 'critical' }), new RegExp(`${RAISED_SEVERITIES.join(' \\| ')}$`)],
    [finding({ file: '' }), /\.file must be a non-blank path/],
    [finding({ claim: '   ' }), /\.claim must be non-blank/],
    [finding({ failure_scenario: 'x'.repeat(2001) }), /\.failure_scenario must be non-blank/],
    [{ ...finding(), fix_commit: 'abc1234' }, /carries an unknown key: fix_commit$/],
    ['not an object', / is not an object$/],
  ];
  for (const [bad, shape] of cases) {
    const r = buildQueue(payload(bad));
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.match(r.detail, shape);
    assert.match(r.detail, /^payload\.findings\[0\]/, r.detail);
  }
});

test('the two seams give the SAME sentence for the same malformed finding', () => {
  // Not a paraphrase test: the two details differ only in the payload PATH that
  // prefixes them, because both come from one function. A second copy of these
  // bounds would drift by a word and leave two answers to "is this a finding".
  const bad = finding({ line: 0 });
  const queued = buildQueue(payload(bad));
  const built = buildEntries({
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: { findings: [bad] },
      rulings: [],
    }],
  });
  assert.equal(queued.ok, false);
  assert.equal(built.ok, false);
  const rule = '.line must be an integer of at least 1';
  assert.equal(queued.detail, `payload.findings[0]${rule}`);
  assert.equal(built.detail, `voices[0].returned.findings[0]${rule}`);
});

/** A queue member as `deferred record` writes one. */
const member = (over = {}) => ({
  phase: '2',
  trigger: 'diff',
  discriminator: 'plan-1',
  round: 1,
  base: 'abc1234',
  head: 'HEAD',
  base_id: 'a'.repeat(40),
  head_id: 'b'.repeat(40),
  findings: [finding()],
  ...over,
});

test('isQueueName selects a member filename and nothing that merely sits beside one', () => {
  for (const yes of ['DEFERRED-diff-plan-1.json', 'DEFERRED-plan-cad-plan-9d10919.json',
    'DEFERRED-diff-plan-1-r2.json']) {
    assert.equal(isQueueName(yes), true, yes);
  }
  for (const no of ['ADJUDICATION-diff-plan-1.json', 'REVIEW-diff-plan-1.md',
    'DEFERRED-.json', 'DEFERRED-diff-plan-1.json.bak', 'deferred-diff-plan-1.json',
    'SUMMARY.md', '', 'DEFERRED-diff-plan-1', 42, null, undefined]) {
    assert.equal(isQueueName(no), false, JSON.stringify(no));
  }
});

test('queueIdentity answers the fire a member belongs to, and COUNTS its findings', () => {
  // The count and never the bodies: a refusal and a progress line print the
  // number, and a triage reads the bodies out of the file this names.
  const r = queueIdentity('DEFERRED-diff-plan-1.json', member());
  assert.deepEqual(r, {
    ok: true, detail: '', phase: '2', trigger: 'diff', discriminator: 'plan-1',
    round: 1, findings: 1,
  });
  const rearm = queueIdentity('DEFERRED-diff-plan-1-r2.json',
    member({ round: 2, findings: [finding(), finding()] }));
  assert.equal(rearm.ok, true, rearm.detail);
  assert.equal(rearm.round, 2);
  assert.equal(rearm.findings, 2);
});

test('a member whose fields spell ANOTHER filename is refused, never adopted', () => {
  // The rail that keeps the supersession test honest. The caller resolves the
  // superseding `ADJUDICATION` name from these FIELDS, so a member filed under
  // one fire's name while claiming another's would be cleared by an
  // adjudication it has nothing to do with - the queue emptying itself
  // silently, which is the one failure a land refusal cannot survive.
  const r = queueIdentity('DEFERRED-plan-plan-1.json', member());
  assert.equal(r.ok, false);
  assert.equal(r.detail,
    'queue member is filed as DEFERRED-plan-plan-1.json but its own fields spell '
    + 'DEFERRED-diff-plan-1.json');
  // A dropped round suffix is the same defect one field over: round 2 filed as
  // round 1 would be settled by round 1's record.
  const dropped = queueIdentity('DEFERRED-diff-plan-1.json', member({ round: 2 }));
  assert.equal(dropped.ok, false);
  assert.match(dropped.detail, /spell DEFERRED-diff-plan-1-r2\.json$/);
});

test('every field the identity is built from is refused when it cannot bear one', () => {
  const cases = [
    ['not an object', 'queue member is not a JSON object'],
    [null, 'queue member is not a JSON object'],
    [[], 'queue member is not a JSON object'],
    [member({ phase: '' }), 'queue member .phase must be a non-blank string'],
    [member({ phase: 2 }), 'queue member .phase must be a non-blank string'],
    [member({ trigger: null }), 'queue member .trigger must be a non-blank string'],
    [member({ discriminator: '  ' }), 'queue member .discriminator must be a non-blank string'],
    [member({ round: 0 }), 'queue member .round must be an integer of at least 1'],
    [member({ round: 1.5 }), 'queue member .round must be an integer of at least 1'],
    [member({ round: '1' }), 'queue member .round must be an integer of at least 1'],
    [member({ findings: null }), 'queue member .findings must be an array'],
    [member({ findings: { 0: finding() } }), 'queue member .findings must be an array'],
  ];
  for (const [bad, detail] of cases) {
    const r = queueIdentity('DEFERRED-diff-plan-1.json', bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.detail, detail);
    assert.equal(r.findings, 0, 'a refused member must not report a count anyway');
  }
});

test('the finding BODIES are not re-validated on the way out', () => {
  // Deliberate, and stated rather than discovered: the bodies went through
  // `findingIssue` at the write face, and re-running it here would let a later
  // tightening of that shape block every land over a member already on disk,
  // with no route to clear it but a hand edit.
  const r = queueIdentity('DEFERRED-diff-plan-1.json',
    member({ findings: [{ nope: true }, 'not an object'] }));
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.findings, 2);
});

test('the module emits nothing: not one byte on stdout or stderr', () => {
  // The purity claim its header makes, asserted rather than described. A lib
  // that printed would print from inside a seam whose one JSON line is its
  // whole interface.
  const seen = [];
  const outWrite = process.stdout.write;
  const errWrite = process.stderr.write;
  process.stdout.write = (...a) => { seen.push(a[0]); return true; };
  process.stderr.write = (...a) => { seen.push(a[0]); return true; };
  try {
    buildQueue(payload(finding()));
    buildQueue({ findings: [{ nope: true }] });
    buildQueue(null);
    queueName('diff', 'plan-1', 2);
    isQueueName('DEFERRED-diff-plan-1.json');
    queueIdentity('DEFERRED-diff-plan-1.json', member());
    queueIdentity('nope', null);
  } finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
  assert.deepEqual(seen, []);
});

// --- The re-arm cap, keyed to the FIRE and not to a run (CONTEXT D-02). -----
//
// `references/triage-gate.md`'s blocking arm counts `rearm` outcome events
// under the CURRENT run's `corr`, which is right there: the fix and the fire
// are the same run. A deferred fire's triage is not - it happens where
// `/cad-land` refuses, in a session whose `corr` matches no `rearm` the
// deferring run ever wrote, so that count comes back 0 every time, reads as
// "the round is unspent" and re-arms again on this land and the next. The cap
// therefore rides the QUEUE, and this is that rule made mechanical over the
// fields a queue reader actually has.

/**
 * The cap as the deferred triage reads it: the highest round ON DISK for ONE
 * fire, off the directory's own entries. `entries` is [filename, parsed JSON]
 * as a reader gets them; there is no correlation id parameter because there is
 * nothing here for one to key.
 */
const roundOnDisk = (entries, trigger, discriminator) => entries
  .filter(([name]) => isQueueName(name))
  .map(([name, parsed]) => queueIdentity(name, parsed))
  .filter((id) => id.ok && id.trigger === trigger && id.discriminator === discriminator)
  .reduce((hi, id) => Math.max(hi, id.round), 0);

/** One directory entry for a fire's queue member at `round`. */
const entry = (trigger, discriminator, round, over = {}) => [
  queueName(trigger, discriminator, round),
  member({ trigger, discriminator, round, ...over }),
];

test('the deferred re-arm cap is spent by a round-2 member, whatever corr the caller holds', () => {
  const roundOne = [entry('diff', 'plan-1', 1)];
  // One round is available while round one is the only fire on disk - the cap
  // is a cap, not a prohibition.
  assert.equal(roundOnDisk(roundOne, 'diff', 'plan-1'), 1);

  const reArmed = [...roundOne, entry('diff', 'plan-1', 2)];
  assert.ok(roundOnDisk(reArmed, 'diff', 'plan-1') >= 2,
    'a second re-arm was admitted on a fire that already holds a round-2 member - '
    + 'the cap read something other than the queue');

  // "Whatever correlation id the caller holds" has two halves, and both are
  // absences. The reader's own identity carries no corr, so a caller has
  // nowhere to key one...
  assert.deepEqual(Object.keys(queueIdentity('DEFERRED-diff-plan-1.json', member())),
    ['ok', 'detail', 'phase', 'trigger', 'discriminator', 'round', 'findings']);
  // ...and a corr written INTO a member's bytes moves no field it reads, so
  // the answer cannot become run-keyed through the artifact either.
  const withCorr = [entry('diff', 'plan-1', 1, { corr: '01JA-deferring-run' }),
    entry('diff', 'plan-1', 2, { corr: '01JB-triage-session' })];
  assert.equal(roundOnDisk(withCorr, 'diff', 'plan-1'),
    roundOnDisk(reArmed, 'diff', 'plan-1'));

  // Keyed to the FIRE: a re-arm spent on one fire is not spent on another in
  // the same directory, whether the trigger differs or only the discriminator.
  const others = [...reArmed, entry('plan', 'plan-1', 1), entry('diff', 'plan-2', 1)];
  assert.equal(roundOnDisk(others, 'plan', 'plan-1'), 1);
  assert.equal(roundOnDisk(others, 'diff', 'plan-2'), 1);
});

test('a SUPERSEDED round still spends the round it was fired on', () => {
  // The refund hole. A member an adjudication has ruled on drops off `deferred
  // list` - that is what makes the land clearable - so a cap that counted only
  // what is still QUEUED would read round two as never fired at the exact
  // moment its triage clears it, and hand back the round that triage just
  // spent. The round is read off the FILENAMES in the fire's home, which is
  // why a settled member is still an entry here.
  const settled = [
    entry('diff', 'plan-1', 1),
    ['ADJUDICATION-diff-plan-1.json', { ruled: true }],
    entry('diff', 'plan-1', 2),
    ['ADJUDICATION-diff-plan-1-r2.json', { ruled: true }],
  ];
  assert.equal(roundOnDisk(settled, 'diff', 'plan-1'), 2);
  // The records themselves are not queue members and never raise the count on
  // their own: a fire adjudicated at round 1 has one round left.
  assert.equal(roundOnDisk([['ADJUDICATION-diff-plan-1-r2.json', { ruled: true }]],
    'diff', 'plan-1'), 0);
});
