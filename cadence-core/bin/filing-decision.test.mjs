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

import {
  DECLINE_LABEL, FILING_TABLE, FINGERPRINT_CHARS, LOOKUP_CHUNK, fingerprint,
  fingerprintInTitle, HALTING_SEVERITIES, issueBody, issueTitle, normalizeDeclines,
  unfixedFindings, unfixedFromEntries, usableFixCommit,
} from './lib/filing-decision.mjs';
import { PROVIDER_TABLE } from './lib/forge-decision.mjs';

/** One finding, at the raised severity the case cares about. */
const finding = (file, line, severity, claim) => ({
  file, line, severity, claim, failure_scenario: `what breaks: ${claim}`,
});

/** The ruling for finding `i`, restating the two texts VERBATIM - which is what
 *  `buildEntries` demands, and the reason a fixture builder exists here rather
 *  than 30 hand-written literals that would drift from their findings.
 *
 *  The fix commit rides a `survived` ruling only at the two HALTING severities,
 *  because that is the only place `buildEntries` asks for one. A survived low
 *  carrying a commit id would say the gate fixed a finding it never halted
 *  over - the shape this fixture built before the requirement was gated, and
 *  the reason the `remainder` finding below is worth reading twice. */
const ruling = (i, f, verdict) => ({
  finding: i,
  ruling: verdict,
  claim: f.claim,
  failure_scenario: f.failure_scenario,
  ...(verdict === 'survived' && HALTING_SEVERITIES.includes(f.severity)
    ? { fix_commit: 'a1b2c3d' }
    : {}),
  ...(verdict === 'refuted'
    ? { counter_evidence: { file: 'src/other.mjs', line: 4, note: 'the guard is already there' } }
    : {}),
});

/** A one-voice payload over `[finding, ruling-verdict, extra]` pairs.
 *
 *  `extra` is merged onto the built ruling and a key set to `undefined` is
 *  DELETED rather than left present-and-undefined, so a case can both add the
 *  `overridden` marker and take the builder's default `fix_commit` back off -
 *  which is the whole shape of an override, a halting finding that stood with
 *  no commit behind it. */
const payload = (pairs, voice = 'sonnet') => ({
  voices: [{
    voice,
    model: 'claude-sonnet-4-5',
    returned: { findings: pairs.map(([f]) => f) },
    rulings: pairs.map(([f, verdict, extra], i) => {
      const r = { ...ruling(i, f, verdict), ...(extra || {}) };
      for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k];
      return r;
    }),
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

test('an OVERRIDDEN survived blocker is in the set - nobody is fixing that one', () => {
  // The state the marker exists for, and the one place "survived at a halting
  // severity" stops meaning "a commit is coming". Reading `ruling` and
  // `severity` alone answers `{ok: true, findings: []}` here, which reports
  // `raised: 0` and loses the blocker with no refusal anywhere - the collapse of
  // "nothing to ask about" into "this payload is unreadable" that the header
  // above says must never happen, arriving from the other direction.
  const f = finding('src/secrets/vault.ts', 1, 'blocker', 'the token is written to the log');
  const out = unfixedFindings(payload([[f, 'survived', { overridden: true, fix_commit: undefined }]]));
  assert.equal(out.ok, true);
  assert.equal(out.detail, '');
  assert.deepEqual(out.findings.map((x) => x.claim), [f.claim]);
  assert.equal(out.findings[0].overridden, true);
  assert.equal('fix_commit' in out.findings[0], false);
});

test('an overridden survived HIGH is in the set too - the marker is not blocker-only', () => {
  const f = finding('src/a.mjs', 7, 'high', 'the write is not atomic');
  const out = unfixedFindings(payload([[f, 'survived', { overridden: true, fix_commit: undefined }]]));
  assert.deepEqual(out.findings.map((x) => x.severity), ['high']);
});

test('a survived blocker WITHOUT the marker still stays behind', () => {
  // The narrowing has to be exactly one case wide: the same finding, the same
  // ruling, no marker, and the fix commit the builder attaches at a halting
  // severity - still the thing the gate is halting over, so still not filed.
  const f = finding('src/secrets/vault.ts', 1, 'blocker', 'the token is written to the log');
  const out = unfixedFindings(payload([[f, 'survived']]));
  assert.equal(out.ok, true);
  assert.deepEqual(out.findings, []);
});

test('the marker beside a real fix commit is in NO set - the commit wins (D-05)', () => {
  // Legal and unremarkable per lib/adjudication-record.mjs, which refuses an
  // entry only when NEITHER marker is present: a fix landed and the halt was
  // also overridden. The commit decides that entry, HERE, in the one pass that
  // answers all three sets. It used to be in this set and dropped one layer up
  // by issue-filing.mjs's `cmdUnfixed`, and that split is exactly what left the
  // precedence to the order two filters happened to run in (CONTEXT D-04).
  const f = finding('src/a.mjs', 3, 'blocker', 'the lock is never released');
  const out = unfixedFindings(payload([[f, 'survived', { overridden: true }]]));
  assert.equal(out.ok, true);
  assert.deepEqual(out.findings, []);
});

test('the marker on a medium changes nothing - that entry was already in the set', () => {
  const f = finding('src/a.mjs', 1, 'medium', 'the retry count is 3 with no reason stated');
  const marked = unfixedFindings(payload([[f, 'survived', { overridden: true }]]));
  const plain = unfixedFindings(payload([[f, 'survived']]));
  assert.deepEqual(marked.findings.map((x) => x.claim), [f.claim]);
  assert.deepEqual(plain.findings.map((x) => x.claim), [f.claim]);
});

test('an unreadable payload carrying the marker is still a REFUSAL, not an empty set', () => {
  // `overridden` is a boolean marker in lib/adjudication-record.mjs and only the
  // literal `true` is accepted, so a truthy string is a refused payload - and
  // the refusal has to reach the caller rather than reading as "nothing to ask
  // about", which is the same distinction the row above turns on.
  const f = finding('src/a.mjs', 1, 'blocker', 'the lock is never released');
  const out = unfixedFindings(payload([[f, 'survived', { overridden: 'yes', fix_commit: undefined }]]));
  assert.equal(out.ok, false);
  assert.deepEqual(out.findings, []);
  assert.match(out.detail, /overridden must be the boolean true/);
});

// --- the entries face: three answers, one pass (LND-02) ----------------------
//
// `unfixedFromEntries` is the primitive, and these arms drive it DIRECTLY with
// stored entries rather than through the payload wrapper. That is the shape a
// gate reading a written ADJUDICATION-*.json holds, and it is the only way to
// express the `halting` set at all: `buildEntries` REFUSES the entry that lands
// there, so no payload-built fixture can produce one.

/** One stored entry, at the raised severity the case cares about; `over`
 *  carries the ruling-side keys the case is actually about. */
const entry = (severity, over) => ({
  file: 'src/a.mjs', line: 1, severity, claim: 'the lock is never released',
  failure_scenario: 'the next caller blocks forever', ruling: 'survived', ...over,
});

/** The three sets as their sizes, so each case below reads as one comparison
 *  against all three at once - a case that named only the set it cared about
 *  would pass while the entry was ALSO in one of the other two. */
const sets = (e) => {
  const out = unfixedFromEntries([e]);
  return {
    filing: out.filing.length,
    haltingSurvivors: out.haltingSurvivors.length,
    halting: out.halting.length,
  };
};

test('a survived blocker naming a fix commit is FIXED, and is in none of the three', () => {
  assert.deepEqual(sets(entry('blocker', { fix_commit: 'a1b2c3d' })),
    { filing: 0, haltingSurvivors: 0, halting: 0 });
});

test('an OVERRIDDEN survived blocker with no commit is filed and named, never halting', () => {
  assert.deepEqual(sets(entry('blocker', { overridden: true })),
    { filing: 1, haltingSurvivors: 1, halting: 0 });
});

test('D-05: both markers on one entry is FIXED - the commit beats the override', () => {
  // Without a stated precedence this one entry becomes a permanent unfixed
  // override, re-surfaced at every close that reads the record again.
  assert.deepEqual(sets(entry('blocker', { overridden: true, fix_commit: 'a1b2c3d' })),
    { filing: 0, haltingSurvivors: 0, halting: 0 });
});

test('a survived blocker with NEITHER marker is `halting` alone - the fail-closed rail', () => {
  // The shape lib/adjudication-record.mjs refuses outright, so it reaches this
  // function only off a record something else wrote or a person hand-edited.
  // Not filed, not an override: the entry a close has to stop on.
  assert.deepEqual(sets(entry('blocker', {})),
    { filing: 0, haltingSurvivors: 0, halting: 1 });
});

test('a survived MEDIUM naming a fix commit is FIXED too - the exclusion is not severity-gated', () => {
  // A voluntary fix below the halting pair is legal and cites its commit.
  // Opening a tracker issue asking a user about work that is already committed
  // is the defect the two-face split produced.
  assert.deepEqual(sets(entry('medium', { fix_commit: 'a1b2c3d' })),
    { filing: 0, haltingSurvivors: 0, halting: 0 });
});

test('a survived medium with no commit is `filing` alone - confirmed and not fixed', () => {
  assert.deepEqual(sets(entry('medium', {})),
    { filing: 1, haltingSurvivors: 0, halting: 0 });
});

test('a BLANK fix_commit is not a usable one, so that entry still halts', () => {
  assert.deepEqual(sets(entry('blocker', { fix_commit: '   ' })),
    { filing: 0, haltingSurvivors: 0, halting: 1 });
});

// --- RSK-08 fix pass: the rail is not defeated by a string that is not an id -
//
// The `halting` rail exists over records lib/adjudication-record.mjs NEVER
// validated - one another tool wrote, one a person hand-edited, one older than
// the requirement - so its composition-time VALUE check cannot cover them.
// While `usable` meant "non-blank string", `fix_commit: 'not-a-commit'` on an
// unoverridden blocker that stood came back in NONE of the three sets and a
// close-time caller read that as nothing to stop for.

test('an unoverridden survived blocker citing a NON-COMMIT string still halts', () => {
  assert.deepEqual(sets(entry('blocker', { fix_commit: 'not-a-commit' })),
    { filing: 0, haltingSurvivors: 0, halting: 1 });
});

test('every unusable fix_commit shape leaves the fail-closed rail closed', () => {
  // The falsifying table. Each member is a value an auditor cannot run
  // `git show` on, so none of them may empty all three sets on the one entry
  // shape the rail exists for.
  for (const bad of ['', '   ', 'not-a-commit', 'the fix commit', 'zzzzzzz', 'abc',
    'a1b2c3', 'a1b2c3d ', '0123456789abcdef0123456789abcdef012345678', 'g1b2c3d',
    null, 0, false, true, {}, ['a1b2c3d']]) {
    assert.deepEqual(sets(entry('blocker', { fix_commit: bad })),
      { filing: 0, haltingSurvivors: 0, halting: 1 },
      `fix_commit ${JSON.stringify(bad)} read as a landed fix and opened the rail`);
  }
});

test('an abbreviated id through a full one reads as a landed fix', () => {
  for (const good of ['a1b2c3d', '4a1af326', 'ABCDEF1',
    '23121a3f9c0e1d2a3b4c5d6e7f8091a2b3c4d5e6']) {
    assert.equal(usableFixCommit(good), true, `${good} is a commit id an auditor can spend`);
    assert.deepEqual(sets(entry('blocker', { fix_commit: good })),
      { filing: 0, haltingSurvivors: 0, halting: 0 });
  }
});

test('usableFixCommit asks the SHAPE and never whether the object exists', () => {
  // The bound stated deliberately: the module does no I/O, so a well-formed id
  // naming no commit in this repository is still usable here. Widening this
  // into a git call is what would make lib/filing-decision.mjs impure.
  assert.equal(usableFixCommit('ffffff0'), true);
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

// --- the pinned vectors: one create argv and one lookup argv per provider ----
//
// Byte-exact arrays, not shape assertions. A flag this table gets wrong is a
// child that prompts, opens an editor or filters on nothing - and none of those
// is visible in a `.includes()` check.

test('the forgejo create and lookup vectors are exactly these', () => {
  const row = FILING_TABLE.forgejo;
  assert.deepEqual(
    row.create('acme/widget', { title: 'T', body: 'B', declined: false }, 'my-login'),
    ['issues', 'create', '--repo', 'acme/widget', '--login', 'my-login',
      '--title', 'T', '--description', 'B'],
  );
  assert.deepEqual(
    row.create('acme/widget', { title: 'T', body: 'B', declined: true }, 'my-login'),
    ['issues', 'create', '--repo', 'acme/widget', '--login', 'my-login',
      '--title', 'T', '--description', 'B', '--labels', DECLINE_LABEL],
  );
  assert.deepEqual(
    row.lookup('acme/widget', row.limit, ['aaaabbbbccccdddd', '1111222233334444'], 'my-login'),
    ['issues', 'list', '--repo', 'acme/widget', '--login', 'my-login',
      '--keyword', 'aaaabbbbccccdddd 1111222233334444', '--state', 'all',
      '--fields', 'index,title', '--output', 'json', '--limit', '50'],
  );
  assert.equal(row.limit, 50);
  assert.equal(row.needsLogin, true);
});

test('the github create and lookup vectors are exactly these', () => {
  const row = FILING_TABLE.github;
  assert.deepEqual(
    row.create('acme/widget', { title: 'T', body: 'B', declined: false }),
    ['issue', 'create', '--repo', 'acme/widget', '--title', 'T', '--body', 'B'],
  );
  assert.deepEqual(
    row.create('acme/widget', { title: 'T', body: 'B', declined: true }),
    ['issue', 'create', '--repo', 'acme/widget', '--title', 'T', '--body', 'B',
      '--label', DECLINE_LABEL],
  );
  assert.deepEqual(
    row.lookup('acme/widget', row.limit, ['aaaabbbbccccdddd', '1111222233334444']),
    ['issue', 'list', '--repo', 'acme/widget',
      '--search', 'in:title aaaabbbbccccdddd OR 1111222233334444',
      '--state', 'all', '--json', 'number,title', '--limit', '200'],
  );
  assert.equal(row.limit, 200);
  assert.equal(row.needsLogin, false);
});

test('the gitlab create vector carries -y, and its lookup is exactly this', () => {
  // `-y` is the hang criterion 9 would otherwise have to report as a timeout:
  // without it `glab issue create` blocks on a confirmation prompt inside a
  // gate step.
  const row = FILING_TABLE.gitlab;
  const created = row.create('acme/widget', { title: 'T', body: 'B', declined: false });
  assert.deepEqual(created,
    ['issue', 'create', '--repo', 'acme/widget', '--title', 'T', '--description', 'B', '-y']);
  assert.ok(created.includes('-y'));
  assert.deepEqual(
    row.create('acme/widget', { title: 'T', body: 'B', declined: true }),
    ['issue', 'create', '--repo', 'acme/widget', '--title', 'T', '--description', 'B',
      '-y', '--label', DECLINE_LABEL],
  );
  assert.deepEqual(
    row.lookup('acme/widget', row.limit, ['aaaabbbbccccdddd', '1111222233334444']),
    ['issue', 'list', '--repo', 'acme/widget',
      '--search', 'aaaabbbbccccdddd 1111222233334444', '--in', 'title',
      '--all', '--output', 'json', '--per-page', '100'],
  );
  assert.equal(row.limit, 100);
  assert.equal(row.needsLogin, false);
});

test('every row supplies a body/description on create, on all three providers', () => {
  // gh PROMPTS for a body when `--body` is absent and glab opens an EDITOR
  // without `--description`. A row that stopped supplying one would hang.
  for (const [provider, row] of Object.entries(FILING_TABLE)) {
    const argv = row.create('a/b', { title: 'T', body: 'B', declined: false }, 'login');
    assert.ok(argv.includes('--body') || argv.includes('--description'), provider);
    assert.ok(argv.includes('B'), provider);
  }
});

test('the three keys are PROVIDER_TABLE\'s own, so a persisted provider is the key', () => {
  assert.deepEqual(Object.keys(FILING_TABLE), Object.keys(PROVIDER_TABLE));
});

test('no row names a binary: PROVIDER_TABLE already says which drives which', () => {
  for (const [provider, row] of Object.entries(FILING_TABLE)) {
    const argv = [
      ...row.create('a/b', { title: 'T', body: 'B', declined: true }, 'login'),
      ...row.lookup('a/b', row.limit, ['aaaabbbbccccdddd'], 'login'),
    ];
    for (const bin of Object.values(PROVIDER_TABLE)) {
      assert.ok(!argv.includes(bin), `${provider} argv names the binary ${bin}`);
    }
  }
});

test('a github chunk of six is five OR operators, and the query opens with in:title', () => {
  // Five is GitHub's DOCUMENTED boolean ceiling, and `LOOKUP_CHUNK` is set from
  // it rather than from the seven measured working on 2026-09-03 (D-09): a
  // limit the index starts enforcing later truncates silently, and a silent
  // truncation here re-files an issue that already exists.
  const six = Array.from({ length: LOOKUP_CHUNK }, (_, i) => `${i}`.repeat(FINGERPRINT_CHARS));
  const argv = FILING_TABLE.github.lookup('a/b', FILING_TABLE.github.limit, six);
  const q = argv[argv.indexOf('--search') + 1];
  assert.ok(q.startsWith('in:title '), q);
  assert.equal(q.split(' OR ').length - 1, 5);
  for (const token of six) assert.ok(q.includes(token), token);
});

test('no provider\'s lookup vector carries DECLINE_LABEL - an ACCEPTED issue has none', () => {
  // The label-filtered lookup could not see the set a create must not
  // duplicate, which is the whole reason the query moved to the title (D-07).
  for (const [provider, row] of Object.entries(FILING_TABLE)) {
    const argv = row.lookup('a/b', row.limit, ['aaaabbbbccccdddd'], 'login');
    assert.ok(!argv.includes(DECLINE_LABEL), `${provider} still filters on the decline label`);
    assert.ok(!argv.includes('--label') && !argv.includes('--labels'),
      `${provider} still passes a label flag`);
  }
});

test('the chunk constant is six, and it is what the builders are exercised with', () => {
  assert.equal(LOOKUP_CHUNK, 6);
});

test('the decline label is one frozen literal with no separator a forge reads', () => {
  // GitLab reads `::` as a SCOPED label; a label a forge interprets behaves
  // differently per provider, which is the one thing a shared literal may not do.
  assert.equal(DECLINE_LABEL, 'cadence-declined');
  assert.doesNotMatch(DECLINE_LABEL, /[\s:]/);
});

// --- the lookup normalizer ---------------------------------------------------

/** `n` rows whose titles carry real fingerprints. */
const page = (n) => JSON.stringify(
  Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    title: issueTitle(finding(`src/f${i}.mjs`, 1, 'low', `claim ${i}`)),
  })),
);

test('a response of exactly the page size is INCOMPLETE and carries no records', () => {
  const out = normalizeDeclines(page(50), 50);
  assert.equal(out.complete, false);
  assert.deepEqual(out.fingerprints, []);
  assert.match(out.detail, /filled the 50-row page/);
});

test('one row under the page size is COMPLETE and carries its tokens', () => {
  const out = normalizeDeclines(page(49), 50);
  assert.equal(out.complete, true);
  assert.equal(out.detail, null);
  assert.equal(out.fingerprints.length, 49);
  assert.equal(out.fingerprints[0], fingerprint(finding('src/f0.mjs', 1, 'low', 'claim 0')));
});

test('a response that is not a JSON array reports incomplete rather than throwing', () => {
  for (const junk of ['not json at all', '{"issues": []}', '42', '"a string"', '', null, 7]) {
    const out = normalizeDeclines(junk, 50);
    assert.equal(out.complete, false, JSON.stringify(junk));
    assert.deepEqual(out.fingerprints, []);
    assert.notEqual(out.detail, null);
  }
});

test('an empty page is a COMPLETE read of nothing - the first fire on a tracker', () => {
  const out = normalizeDeclines('[]', 50);
  assert.equal(out.complete, true);
  assert.deepEqual(out.fingerprints, []);
});

test('a row with no readable title fails the WHOLE read: the output shape moved', () => {
  const out = normalizeDeclines(JSON.stringify([{ number: 1 }]), 50);
  assert.equal(out.complete, false);
  assert.match(out.detail, /no readable title/);
});

test('a hand-labelled issue is SKIPPED, not a failure - a human can apply a label', () => {
  const rows = JSON.stringify([
    { number: 1, title: 'someone filed this by hand and labelled it' },
    { number: 2, title: issueTitle(finding('src/a.mjs', 1, 'low', 'a real one')) },
  ]);
  const out = normalizeDeclines(rows, 50);
  assert.equal(out.complete, true);
  assert.deepEqual(out.fingerprints, [fingerprint(finding('src/a.mjs', 1, 'low', 'a real one'))]);
});

// --- the title carries the token the lookup reads back -----------------------

test('a title round-trips to the fingerprint the finding digests to', () => {
  const f = finding('cadence-core/bin/lib/a.mjs', 12, 'medium', 'the retry loop is capped at three');
  assert.equal(fingerprintInTitle(issueTitle(f)), fingerprint(f));
});

test('a claim long enough to clip the title still round-trips', () => {
  // The digest is over the claim's own bytes, so clipping the TITLE cannot
  // change the token - which is why the token goes first.
  const f = finding('src/a.mjs', 1, 'low', 'x'.repeat(4000));
  const title = issueTitle(f);
  assert.ok(title.length <= 200);
  assert.equal(fingerprintInTitle(title), fingerprint(f));
});

test('a claim with newlines becomes one line', () => {
  const f = finding('src/a.mjs', 1, 'low', 'first line\nsecond line\n\tthird');
  assert.equal(issueTitle(f), `[cadence ${fingerprint(f)}] first line second line third`);
});

test('a title carrying no token, or a non-string, recovers null', () => {
  for (const t of ['plain title', '[cadence zzzz] x', `[cadence ${'a'.repeat(15)}] x`, null, 42, undefined]) {
    assert.equal(fingerprintInTitle(t), null, JSON.stringify(t));
  }
});

test('the body names the finding and never a CLI response', () => {
  const f = { ...finding('src/a.mjs', 12, 'medium', 'the retry loop is capped'), voice: 'sonnet', ruling: 'downgraded' };
  const body = issueBody(f);
  assert.match(body, /src\/a\.mjs:12/);
  assert.match(body, /\*\*medium\*\*/);
  assert.match(body, /by sonnet/);
  assert.match(body, /ruled downgraded/);
  assert.match(body, /the retry loop is capped/);
  assert.match(body, /what breaks: the retry loop is capped/);
  assert.match(body, new RegExp(fingerprint(f)));
});

test('the body is never empty, whatever the finding is missing', () => {
  // gh prompts and glab opens an editor on an absent body, so an empty string
  // here is the hang the flag rules exist to prevent.
  for (const junk of [{}, null, { file: 'a' }]) {
    assert.ok(issueBody(junk).trim().length > 0, JSON.stringify(junk));
  }
});
