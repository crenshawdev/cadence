// Zero-dep tests for lib/filing-decision.mjs - the pure core of the filing
// question (CAP-01, CAP-02).
// Run: node --test cadence-core/bin/filing-decision.test.mjs.
//
// No temp directory, no spawn and no fixture file on disk: the module under
// test does no I/O, so every case here is an object in, an object out. The one
// place a FILE appears is the prose fixture below, and it is a string this file
// holds precisely to prove nothing reads it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { fingerprint, unfixedFindings, FINGERPRINT_CHARS } from './lib/filing-decision.mjs';

/** One finding, at the raised severity the case cares about. */
const finding = (file, line, severity, claim) => ({
  file, line, severity, claim, failure_scenario: `what breaks: ${claim}`,
});

/** The ruling for finding `i`, restating the two texts VERBATIM - which is what
 *  `buildEntries` demands, and the reason a fixture builder exists here rather
 *  than 30 hand-written literals that would drift from their findings. */
const ruling = (i, f, verdict) => ({
  finding: i,
  ruling: verdict,
  claim: f.claim,
  failure_scenario: f.failure_scenario,
  ...(verdict === 'survived' ? { fix_commit: 'a1b2c3d' } : {}),
  ...(verdict === 'refuted'
    ? { counter_evidence: { file: 'src/other.mjs', line: 4, note: 'the guard is already there' } }
    : {}),
});

/** A one-voice payload over `[finding, ruling-verdict]` pairs. */
const payload = (pairs, voice = 'sonnet') => ({
  voices: [{
    voice,
    model: 'claude-sonnet-4-5',
    returned: { findings: pairs.map(([f]) => f) },
    rulings: pairs.map(([f, verdict], i) => ruling(i, f, verdict)),
  }],
});

// --- the selection: two fields decide it ------------------------------------

test('a survived blocker stays behind; a downgraded high and a survived low are the set', () => {
  // The plan's own case, and the one that proves BOTH halves of the rule at
  // once: `ruling` alone would drop the survived low, and `severity` alone
  // would drop the downgraded high.
  const halting = finding('src/a.mjs', 10, 'blocker', 'the lock is never released');
  const lowered = finding('src/b.mjs', 20, 'high', 'the timeout is unbounded');
  const remainder = finding('src/c.mjs', 30, 'low', 'the comment says 30 and the code says 60');
  const out = unfixedFindings(payload([
    [halting, 'survived'], [lowered, 'downgraded'], [remainder, 'survived'],
  ]));
  assert.equal(out.ok, true);
  assert.equal(out.detail, '');
  assert.deepEqual(out.findings.map((f) => f.claim), [lowered.claim, remainder.claim]);
});

test('a survived high is the thing the gate halts over, so it is not in the set', () => {
  const out = unfixedFindings(payload([
    [finding('src/a.mjs', 1, 'high', 'the write is not atomic'), 'survived'],
  ]));
  assert.equal(out.ok, true);
  assert.deepEqual(out.findings, []);
});

test('a refuted blocker IS in the set - the ruling, not the severity, decides that one', () => {
  const f = finding('src/a.mjs', 1, 'blocker', 'the token is logged');
  const out = unfixedFindings(payload([[f, 'refuted']]));
  assert.equal(out.ok, true);
  assert.deepEqual(out.findings.map((x) => x.claim), [f.claim]);
});

test('a survived medium and a survived low are both the blocking arm remainder', () => {
  const med = finding('src/a.mjs', 1, 'medium', 'the retry count is 3 with no reason stated');
  const low = finding('src/b.mjs', 2, 'low', 'the header names a file that moved');
  const out = unfixedFindings(payload([[med, 'survived'], [low, 'survived']]));
  assert.deepEqual(out.findings.map((f) => f.severity), ['medium', 'low']);
});

// --- criterion 2: the ask follows the PAYLOAD, never the prose ---------------

test('the payload and a prose fixture disagree, and the answer is the payload', () => {
  // The falsifying shape criterion 2 asks for. The prose below is a REVIEW file
  // as a reviewer would have rendered it, carrying a different claim for the
  // same finding - and it is never passed to anything, because there is no
  // parameter to pass it to. That is the assertion: the module's signature
  // takes one payload, so a caller cannot make the prose win.
  const PROSE_FIXTURE = [
    '# Review findings',
    '',
    '- **medium** `src/a.mjs:12` - the retry loop never terminates',
  ].join('\n');
  const f = finding('src/a.mjs', 12, 'medium', 'the retry loop is capped at three');
  const out = unfixedFindings(payload([[f, 'survived']]));
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].claim, 'the retry loop is capped at three');
  assert.ok(PROSE_FIXTURE.includes('never terminates'));
  assert.ok(!out.findings[0].claim.includes('never terminates'));
});

// --- the fingerprint: (file, claim), and nothing else ------------------------

test('two findings differing only in LINE share one fingerprint', () => {
  // The decline that must survive an edit above it: same file, same claim, the
  // file shifted by 30 lines.
  const a = finding('src/a.mjs', 10, 'low', 'the header names a file that moved');
  const b = finding('src/a.mjs', 40, 'low', 'the header names a file that moved');
  assert.equal(fingerprint(a), fingerprint(b));
});

test('two findings differing in CLAIM do not', () => {
  const a = finding('src/a.mjs', 10, 'low', 'the header names a file that moved');
  const b = finding('src/a.mjs', 10, 'low', 'the header names a file that never existed');
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test('two findings differing in FILE do not', () => {
  const a = finding('src/a.mjs', 10, 'low', 'the header names a file that moved');
  const b = finding('src/b.mjs', 10, 'low', 'the header names a file that moved');
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test('severity is outside the fingerprint: a downgrade does not mint a new one', () => {
  const a = finding('src/a.mjs', 10, 'high', 'the timeout is unbounded');
  const b = finding('src/a.mjs', 10, 'low', 'the timeout is unbounded');
  assert.equal(fingerprint(a), fingerprint(b));
});

test('the token is fixed-width lowercase hex', () => {
  const t = fingerprint(finding('src/a.mjs', 1, 'low', 'x'));
  assert.equal(t.length, FINGERPRINT_CHARS);
  assert.match(t, /^[0-9a-f]+$/);
});

test('the NUL join cannot be forged by moving the boundary', () => {
  // `("a b", "c")` and `("a", "b c")` are different findings and must not
  // digest alike; a space or a colon separator would let a claim produce the
  // collision on purpose.
  assert.notEqual(
    fingerprint({ file: 'a b', claim: 'c' }),
    fingerprint({ file: 'a', claim: 'b c' }),
  );
});

test('a finding missing both fields fingerprints rather than throwing', () => {
  // Total over anything: the seam derives a fingerprint before it has decided
  // the input is good, so a throw here would take the caller down.
  assert.equal(fingerprint({}), fingerprint({ file: '', claim: '' }));
  assert.equal(fingerprint(null).length, FINGERPRINT_CHARS);
  assert.equal(fingerprint('a string').length, FINGERPRINT_CHARS);
});

// --- an unreadable payload is a refusal, never an empty set ------------------

test('a payload buildEntries refuses comes back ok:false naming the entry', () => {
  // The two answers that must never collapse: "nothing to ask about" ends the
  // step and "this payload is unreadable" stops it. An empty `findings` on an
  // `ok:true` envelope is the first, so the second may not look like it.
  const f = finding('src/a.mjs', 1, 'low', 'x');
  const bad = payload([[f, 'survived']]);
  bad.voices[0].rulings[0].ruling = 'not-a-ruling';
  const out = unfixedFindings(bad);
  assert.equal(out.ok, false);
  assert.deepEqual(out.findings, []);
  assert.match(out.detail, /voices\[0\]\.rulings\[0\]\.ruling/);
  assert.match(out.detail, /not-a-ruling/);
});

test('an unruled finding refuses by index rather than being dropped from the set', () => {
  const f = finding('src/a.mjs', 1, 'low', 'x');
  const g = finding('src/b.mjs', 2, 'low', 'y');
  const bad = payload([[f, 'survived'], [g, 'survived']]);
  bad.voices[0].rulings.pop();
  const out = unfixedFindings(bad);
  assert.equal(out.ok, false);
  assert.match(out.detail, /voices\[0\]\.returned\.findings\[1\] has no ruling/);
});

test('a non-object payload refuses with the grammar detail, not an empty answer', () => {
  for (const junk of [null, undefined, 'a string', 42, []]) {
    const out = unfixedFindings(junk);
    assert.equal(out.ok, false, JSON.stringify(junk));
    assert.notEqual(out.detail, '');
    assert.deepEqual(out.findings, []);
  }
});
