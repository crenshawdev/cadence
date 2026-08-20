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
import { buildQueue, queueName } from './lib/deferred-queue.mjs';
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
  } finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
  assert.deepEqual(seen, []);
});
