// Zero-dep tests for `planning.mjs uat`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, chmodSync, accessSync, constants, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run } from './planning.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// --- uat -----------------------------------------------------------------------

const UAT_ITEMS = JSON.stringify([
  { name: 'Login works', expected: 'user lands on dashboard' },
  { name: 'Logout works', expected: 'session cleared' },
]);

function uatTree() {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true, summary: true } } });
  run(['uat', 'init', '--phase', '1'], dir, UAT_ITEMS);
  return dir;
}

test('uat init: writes all-pending checklist and returns the first item', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  const r = run(['uat', 'init', '--phase', '1'], dir, UAT_ITEMS);
  assert.equal(r.ok, true);
  assert.equal(r.items, 2);
  assert.deepEqual(r.next, { k: 1, name: 'Login works', expected: 'user lands on dashboard' });
  const text = readFileSync(join(dir, '.'.replace('.', ''), 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /status: testing/);
  assert.match(text, /### 1\. Login works/);
  // init refuses to clobber an existing checklist
  const again = run(['uat', 'init', '--phase', '1'], dir, UAT_ITEMS);
  assert.equal(again.reason, 'uat-exists');
});

test('uat init: refuses a malformed payload, writes nothing', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  assert.equal(run(['uat', 'init', '--phase', '1'], dir, 'not json {').reason, 'bad-payload');
  assert.equal(run(['uat', 'init', '--phase', '1'], dir, '{"name":"not an array"}').reason, 'bad-payload');
  assert.equal(run(['uat', 'init', '--phase', '1'], dir,
    JSON.stringify([{ name: 'expected missing' }])).reason, 'bad-payload');
  assert.equal(existsSync(join(dir, 'phases', '1', 'UAT.md')), false); // nothing written
});

test('uat record: unknown item and bad result refuse without writing', () => {
  const dir = uatTree();
  assert.equal(run(['uat', 'record', '--phase', '1', '--item', '9', '--result', 'pass'], dir)
    .reason, 'unknown-item');
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'maybe'], dir);
  assert.equal(r.reason, 'bad-result');
  assert.match(r.detail, /pass \| fail \| skipped \| blocked \| pending/);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 1\. Login works\nexpected: user lands on dashboard\nstatus: pending/);
});

// `--item "$K"` with K unset: parseArgs mints `true`, `Number(true)` is 1, and
// item 1 was recorded pass - permanently, once first_pass is set.
for (const [name, arg] of [['valueless', null], ['abc', 'abc'], ['empty string', '']]) {
  test(`uat record: a ${name} --item refuses; UAT.md is byte-unchanged`, () => {
    const dir = uatTree();
    const before = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
    const r = run(['uat', 'record', '--phase', '1',
      ...(arg === null ? ['--item'] : ['--item', arg]), '--result', 'pass'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /--item/);
    assert.equal(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), before);
  });
}

test('uat record: a clean integer naming no item still answers unknown-item', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '99', '--result', 'pass'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-item');
});

test('uat record: a normal --item still records, with counts and first_pass', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.item, { k: 1, status: 'pass' });
  assert.equal(r.counts.pass, 1);
  assert.match(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), /first_pass: pass/);
});

// --- uat record --fields-file: the free-text fields through the path transport
//
// Every one of the five is caller-derived - a failing item's reason, what the
// user reported, the cause, the fix, the evidence - so the inline form puts
// that prose in a double-quoted shell word where `$(...)` executes before Node
// starts. ONE flag holding a JSON object, never per-field files (D-05).

/** The five free-text fields, as one object and as inline flag pairs. */
const FIVE_FIELDS = {
  reason: 'the redirect never fires',
  reported: 'user sees a blank page',
  cause: 'the session cookie is dropped',
  fix: 'abc1234, retest',
  evidence: '.planning/phases/1/FINDINGS.json',
};
const FIVE_INLINE = Object.entries(FIVE_FIELDS).flatMap(([k, v]) => [`--${k}`, v]);
const uatBytes = (dir) => readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');

test('uat record: --fields-file writes the SAME UAT.md the five inline flags write', () => {
  const inlineDir = uatTree();
  const fileDir = uatTree();
  const a = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    ...FIVE_INLINE], inlineDir);
  const src = join(fileDir, 'fields.json');
  writeFileSync(src, JSON.stringify(FIVE_FIELDS));
  const b = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--fields-file', src], fileDir);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  // Byte-identical, so a field the reader silently dropped fails this row
  // rather than passing it.
  assert.equal(uatBytes(fileDir), uatBytes(inlineDir));
  for (const value of Object.values(FIVE_FIELDS)) {
    assert.ok(uatBytes(fileDir).includes(value), `"${value}" never reached the file`);
  }
});

test('uat record: a --fields-file value no shell could expand lands verbatim', () => {
  const dir = uatTree();
  const src = join(dir, 'fields.json');
  const reason = 'it printed $(touch /tmp/cad-uat-should-not-exist) and `id`';
  writeFileSync(src, JSON.stringify({ reason }));
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--fields-file', src], dir);
  assert.equal(r.ok, true);
  assert.ok(uatBytes(dir).includes(reason), 'the reason did not land verbatim');
  assert.equal(existsSync('/tmp/cad-uat-should-not-exist'), false, 'the payload executed');
});

test('uat record: every --fields-file refusal is bad-args, UAT.md byte-unchanged', () => {
  const dir = uatTree();
  const before = uatBytes(dir);
  const write = (name, body) => {
    const f = join(dir, name);
    writeFileSync(f, body);
    return f;
  };
  const good = write('good.json', JSON.stringify({ reason: 'from the file' }));
  const cases = [
    { name: 'valueless', args: ['--fields-file'] },
    { name: 'missing path', args: ['--fields-file', join(dir, 'absent.json')] },
    { name: 'empty file', args: ['--fields-file', write('blank.json', '\n \n')] },
    { name: 'not JSON', args: ['--fields-file', write('bad.json', 'reason: x')] },
    // A JSON ARRAY parses, and `typeof [] === 'object'` - the arm that catches it.
    { name: 'a JSON array', args: ['--fields-file', write('arr.json', '[{"reason":"x"}]')] },
    { name: 'a non-string value', args: ['--fields-file', write('num.json', '{"reason":3}')] },
    // Refused rather than dropped: `severity` is enum-validated at its own
    // guard, so admitting it here would route it around that guard.
    { name: 'an out-of-set key', args: ['--fields-file', write('sev.json', '{"severity":"high"}')] },
    { name: 'a field given both ways', args: ['--reason', 'from the flag', '--fields-file', good] },
  ];
  // The unreadable arm, unless the suite runs as root (mode bits assert nothing).
  const locked = write('locked.json', JSON.stringify({ reason: 'x' }));
  chmodSync(locked, 0o000);
  try {
    try { accessSync(locked, constants.R_OK); } catch {
      cases.push({ name: 'unreadable path', args: ['--fields-file', locked] });
    }
    for (const c of cases) {
      const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
        ...c.args], dir);
      assert.equal(r.ok, false, c.name);
      assert.equal(r.reason, 'bad-args', c.name);
      assert.equal(uatBytes(dir), before, `${c.name} wrote to UAT.md`);
    }
  } finally {
    chmodSync(locked, 0o600);
  }
});

test('uat merge: matches by k, and a verifier pass never rewrites first_pass', () => {
  const dir = uatTree();
  // Item 1 fails, the fix lands, it resets to pending - first_pass is fail.
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail', '--reported', 'broken'], dir);
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pending', '--fix', 'abc1234'], dir);
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ k: 1, evidence: 'redirect asserted' }],  // by k, not name
    gaps: [{ k: 2, reason: 'session not cleared' }],    // matches pending item 2
  }));
  assert.equal(r.auto_passed, 1);
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 0); // both matched existing items - nothing appended
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  // set-once invariant: the verifier pass keeps the original fail verdict
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: pass\nfirst_pass: fail/);
  // matched-gap branch: fail + default severity, first_pass set on first verdict
  assert.match(text, /### 2\. Logout works\nexpected: [^\n]*\nstatus: fail\nfirst_pass: fail/);
  assert.match(text, /reported: session not cleared/);
  assert.match(text, /severity: major/);
});

test('uat record: sets status, first_pass once, returns next pending (zero re-reads)', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--reported', 'error on submit', '--severity', 'major'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { pass: 0, fail: 1, pending: 1, skipped: 0, blocked: 0 });
  assert.equal(r.next.k, 2); // the walk continues without re-reading UAT.md

  // fix lands, retest passes - status flips but first_pass stays fail
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /first_pass: fail/);
  assert.match(text, /reworked: 1/);
  const done = run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  assert.equal(done.next, null); // nothing pending left
});

test('uat record: fixed failure resets to pending, first_pass survives', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--reported', 'broken'], dir);
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pending',
    '--fix', 'abc1234, retest'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.counts.pending, 2); // back in the walk
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /first_pass: fail/);
  assert.match(text, /fix: abc1234, retest/);
});

test('uat record: verifier source cannot overwrite a recorded result', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--source', 'verifier'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'would-overwrite');
});

// The walk's own provenance. `source` accepted any string and stored nothing
// outside `verifier`, so a check the MODEL ran and cited was written to disk as
// a user answer with nothing reporting the drop - registration is what makes
// the value survive, not merely writing it.
test('uat record --source model: stores the provenance and it survives a later record', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--evidence', 'node --test x.test.mjs -> 12 pass 0 fail', '--source', 'model'], dir);
  assert.equal(r.ok, true);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: pass\nfirst_pass: pass\nsource: model/);
  // ...and the whole-file rewrite a record on a DIFFERENT item performs keeps it
  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  const after = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(after, /source: model/);
  assert.equal(after.match(/source:/g).length, 1); // item 2's user answer wrote none
});

test('uat record: an out-of-enum --source is refused with the file byte-unchanged', () => {
  const dir = uatTree();
  const before = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--source', 'bogus'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /user \| verifier \| model/);
  assert.equal(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), before);
});

test('uat record --source user: writes no source line - user stays implicit', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--source', 'user'], dir);
  assert.equal(r.ok, true);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.equal(/source:/.test(text), false);
});

// `why_human` is the verifier's per-item reason the walk reads as already
// judged. It reached UAT.md through no path at all before: `merge` appended the
// human check without it, so the walk had to re-judge every item the deep pass
// had already ruled on.
test('uat merge: a human_checks why_human is carried onto the appended item and survives', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    human_checks: [
      { name: 'Card charges', expected: 'receipt emailed', why_human: 'moves real money' },
      { name: 'Prints on the label printer', expected: 'label ejects' }, // no reason given
    ],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.added, 2);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Card charges\nexpected: receipt emailed\norigin: verifier\nwhy_human: moves real money\nstatus: pending/);
  // no default is invented for the entry that carried none
  assert.match(text, /### 4\. Prints on the label printer\nexpected: label ejects\norigin: verifier\nstatus: pending/);
  // ...and the first `record` rewrite preserves it - registration, not luck
  run(['uat', 'record', '--phase', '1', '--item', '3', '--result', 'pass'], dir);
  const after = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(after, /why_human: moves real money/);
});

test('uat refresh: appends only new names, never touches recorded results', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const r = run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Login works', expected: 'reworded criterion' },  // name exists - skipped
    { name: 'Password reset', expected: 'email arrives' },     // new - appended
  ]));
  assert.equal(r.added, 1);
  assert.equal(r.total, 3);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Password reset/);
  assert.match(text, /expected: user lands on dashboard/); // original wording kept
});

test('uat merge: fills pending only, appends unmatched gaps and human checks', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir); // user result
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ name: 'Login works', evidence: 'src/auth.ts:42 asserts redirect' },
             { name: 'Logout works', evidence: 'would overwrite - must be ignored' }],
    gaps: [{ name: 'Rate limiting', reason: 'no limiter found on /login' }],
    human_checks: [{ name: 'Email renders in dark mode', expected: 'readable' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.auto_passed, 1); // only the pending item; user result untouched
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 2); // the gap + the human check
  assert.equal(r.skipped, 1); // the `Logout works` pass conflicts with a user result
  assert.equal(r.rejected, 0);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Rate limiting/);
  assert.match(text, /### 4\. Email renders in dark mode/);
  assert.doesNotMatch(text, /would overwrite/);
});

// --- uat: the criterion / origin carrier (registration is what makes it last)
// Registration in UAT_FIELDS is the whole mechanism: parseUat accepts any
// `field: value` line, so an UNregistered field survives init and is destroyed
// by the first record, which rewrites the whole file. Every assertion here
// reads the raw bytes rather than the envelope for that reason.

const LINKED_ITEMS = JSON.stringify([
  { name: 'Login works', expected: 'user lands on dashboard', criterion: 'AC3' },
  { name: 'Logout works', expected: 'session cleared', criterion: 'AC4' },
  { name: 'The plugin loads at all', expected: 'no error on startup', origin: 'smoke' },
]);

/** The raw bytes of a fixture's UAT.md - never the envelope. */
const uatText = (dir) => readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');

function linkedTree() {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  run(['uat', 'init', '--phase', '1'], dir, LINKED_ITEMS);
  return dir;
}

test('uat: a criterion written by init is byte-present after a refresh AND after a record', () => {
  const dir = linkedTree();
  assert.match(uatText(dir), /### 1\. Login works\nexpected: user lands on dashboard\ncriterion: AC3\nstatus: pending/);
  // The refresh payload carries a NEW item name, so the file is actually
  // rewritten (`if (fresh.length) writeUat`) - re-sending the identical payload
  // would leave it untouched and prove nothing about the refresh arm.
  const r = run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Password reset', expected: 'email arrives', criterion: 'AC5' },
  ]));
  assert.equal(r.added, 1);
  assert.equal(uatText(dir).match(/^criterion: AC3$/gm).length, 1);
  assert.match(uatText(dir), /### 4\. Password reset\nexpected: email arrives\ncriterion: AC5\nstatus: pending/);
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(uatText(dir).match(/^criterion: AC3$/gm).length, 1);
  assert.equal(uatText(dir).match(/^criterion: AC5$/gm).length, 1);
});

// The marker is written before any item is looked at, so it cannot be lost by
// a payload that carries no links - which is the whole point of moving the
// legacy test off the item fields and onto the file.
test('uat init: writes fields_version unconditionally, and it survives refresh and record', () => {
  const dir = linkedTree();
  assert.match(uatText(dir), /^---\nstatus: testing\nphase: 1\nfields_version: 1\n/);
  run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Password reset', expected: 'email arrives', criterion: 'AC5' },
  ]));
  assert.equal(uatText(dir).match(/^fields_version: 1$/gm).length, 1);
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(uatText(dir).match(/^fields_version: 1$/gm).length, 1);
});

test('uat init: a payload with no criterion and no origin still gets the marker', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  run(['uat', 'init', '--phase', '1'], dir, JSON.stringify([
    { name: 'Bare item', expected: 'something observable' },
  ]));
  assert.match(uatText(dir), /^fields_version: 1$/m);
});

test('uat: an origin written by init survives refresh and record the same way', () => {
  const dir = linkedTree();
  assert.match(uatText(dir), /### 3\. The plugin loads at all\nexpected: [^\n]*\norigin: smoke\nstatus: pending/);
  run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'A deliverable', expected: 'ships', origin: 'verifier' },
  ]));
  run(['uat', 'record', '--phase', '1', '--item', '3', '--result', 'pass'], dir);
  assert.equal(uatText(dir).match(/^origin: smoke$/gm).length, 1);
  assert.equal(uatText(dir).match(/^origin: verifier$/gm).length, 1);
});

test('uat refresh: carries source, criterion and origin onto an appended item, in lockstep with init', () => {
  const dir = linkedTree();
  run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Deep-pass find', expected: 'observable', criterion: 'AC6', origin: 'criterion', source: 'verifier' },
  ]));
  assert.match(uatText(dir),
    /### 4\. Deep-pass find\nexpected: observable\ncriterion: AC6\norigin: criterion\nstatus: pending\nsource: verifier/);
});

test('uat record --origin: sets provenance after the fact on an existing item', () => {
  const dir = uatTree(); // no field on either item
  const r = run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass',
    '--origin', 'verifier'], dir);
  assert.equal(r.ok, true);
  assert.match(uatText(dir), /### 2\. Logout works\nexpected: session cleared\norigin: verifier\nstatus: pass/);
});

test('uat record: an out-of-enum --origin is refused with the file byte-unchanged', () => {
  const dir = linkedTree();
  const before = uatText(dir);
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--origin', 'verifer'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /criterion \| verifier \| smoke/);
  assert.equal(uatText(dir), before);
});

// The repair the `fieldless-checklist` diagnostic routes users to. `--origin` is
// not a substitute: on a fieldless checklist it writes `origin: criterion`,
// which names no id, disqualifies the phase from the legacy rule and converts
// zero breaks into one per criterion with no seam able to add the link back.
test('uat record --criterion: restores a dropped link in the registered field position', () => {
  const dir = uatTree(); // no criterion on either item
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--criterion', 'AC9'], dir);
  assert.equal(r.ok, true);
  assert.match(uatText(dir),
    /### 1\. Login works\nexpected: user lands on dashboard\ncriterion: AC9\nstatus: pass/);
  assert.equal(uatText(dir).match(/^criterion: AC9$/gm).length, 1); // no duplicate line
});

test('uat record: an out-of-shape --criterion is refused by name, file byte-unchanged', () => {
  const dir = linkedTree();
  for (const bad of ['AC-1', 'ac1']) {
    const before = uatText(dir);
    const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
      '--criterion', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.match(r.detail, /AC<N>/);
    assert.ok(r.detail.includes(bad), `detail names the received value ${bad}`);
    assert.equal(uatText(dir), before, bad);
  }
  // A flag given with no value parses as boolean `true`, and the same test
  // refuses it - the value never reaches the file as the string "true".
  const before = uatText(dir);
  const bare = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--criterion'], dir);
  assert.equal(bare.ok, false);
  assert.equal(bare.reason, 'bad-args');
  assert.equal(uatText(dir), before);
});

test('uat init: an out-of-shape criterion or origin is bad-payload, nothing written', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  const badId = run(['uat', 'init', '--phase', '1'], dir,
    JSON.stringify([{ name: 'X', expected: 'y', criterion: 'AC-01' }]));
  assert.equal(badId.reason, 'bad-payload');
  assert.match(badId.detail, /AC<N>/);
  assert.equal(existsSync(join(dir, 'phases', '1', 'UAT.md')), false);
  const badOrigin = run(['uat', 'init', '--phase', '1'], dir,
    JSON.stringify([{ name: 'X', expected: 'y', origin: 'verified' }]));
  assert.equal(badOrigin.reason, 'bad-payload');
  assert.match(badOrigin.detail, /criterion \| verifier \| smoke/);
  assert.equal(existsSync(join(dir, 'phases', '1', 'UAT.md')), false);
});

test('uat merge: both append paths write origin verifier - the item-level provenance source cannot carry', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [{ name: 'Rate limiting', reason: 'no limiter found on /login' }],
    human_checks: [{ name: 'Email renders in dark mode', expected: 'readable' }],
  }));
  assert.equal(r.added, 2);
  // The gap append.
  assert.match(uatText(dir), /### 3\. Rate limiting\nexpected: [^\n]*\norigin: verifier\nstatus: fail/);
  // The human_checks append, which wrote no provenance of any kind before.
  assert.match(uatText(dir), /### 4\. Email renders in dark mode\nexpected: readable\norigin: verifier\nstatus: pending/);
});

test('uat merge: a MATCHED pending item gets source verifier and no origin - it was not verifier-added', () => {
  const dir = linkedTree();
  run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ name: 'Login works', evidence: 'src/auth.ts:42' }],
  }));
  // Item 1 keeps its criterion and gains no origin: source records where the
  // RESULT came from, origin where the ITEM came from (D-12).
  assert.match(uatText(dir), /### 1\. Login works\nexpected: [^\n]*\ncriterion: AC3\nstatus: pass\nfirst_pass: pass\nsource: verifier/);
  assert.equal(uatText(dir).match(/^origin: verifier$/gm), null);
});

test('uat merge: an entry with no usable name is rejected, never written (#46.2)', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [
      { reason: 'no k, no name' },              // nothing to name a heading with
      { k: 99, reason: 'k matches nothing' },   // a k that resolves to no item
      { name: 'Rate limiting', reason: 'no limiter' }, // the one valid entry
    ],
    human_checks: [{ expected: 'nameless' }],   // appends the identical phantom
  }));
  assert.equal(r.ok, true);          // partial success: merge the rest (D-03)
  assert.equal(r.added, 1);
  assert.equal(r.rejected, 3);
  assert.equal(r.gaps, 1);           // gaps counts what was actually recorded
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Rate limiting/);
  assert.doesNotMatch(text, /undefined/); // `### N. undefined` can never be written
});

test('uat merge: an untrimmed name fills the pending item, never appends a duplicate', () => {
  const dir = uatTree();
  // A trailing space is routine in verifier output. The append path trims, so
  // matching untrimmed appended `### 3. Login works` alongside the existing
  // `### 1. Login works` - unreachable by name on every later merge, so its
  // fail status blocked uatComplete permanently.
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [{ name: 'Login works ', reason: 'no redirect' }],
    human_checks: [{ name: '  Logout works', expected: 'session cleared' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 0);    // both matched an existing item; nothing appended
  assert.equal(r.rejected, 0);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.equal(text.match(/^### \d+\. Login works$/gm)?.length, 1);
  assert.equal(text.match(/^### \d+\. Logout works$/gm)?.length, 1);
});

test('uat merge: a finding conflicting with a recorded result is skipped and counted (#46.3)', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir); // user result
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ k: 1, evidence: 'x' }],
    gaps: [{ k: 1, reason: 'y' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 2);     // the drop stops being silent
  assert.equal(r.auto_passed, 0); // the invariant still stands
  assert.equal(r.gaps, 0);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: pass/);
  assert.doesNotMatch(text, /reported:/);
});

// --- FINDINGS.json: the discarded half of the merge, made recoverable --------
// The verifier is contractually read-only and its dispatch ends with its
// report, so the envelope has to be persisted by the seam that computed it
// (D-09) or it is gone. A NEW file, not a UAT.md section: a `## ` block is cut
// by the next `uat record` and a `### ` extra is promised user-owned (D-05).

const findingsFile = (dir) => join(dir, 'phases', '1', 'FINDINGS.json');
const readFindings = (dir) => JSON.parse(readFileSync(findingsFile(dir), 'utf8'));

test('uat merge: FINDINGS.json holds the five counters plus every discarded entry', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ k: 1, evidence: 'x' }],          // conflicts with the user result
    gaps: [{ reason: 'no k, no name' }],        // nothing to name a heading with
    human_checks: [{ expected: 'nameless' }],   // the identical phantom
  }));
  assert.equal(r.ok, true);
  assert.equal(r.findings, 'phases/1/FINDINGS.json'); // observable in the transcript
  const found = readFindings(dir);
  assert.deepEqual(Object.keys(found), ['auto_passed', 'gaps', 'added', 'skipped',
    'rejected', 'rejected_entries', 'skipped_entries']);
  assert.deepEqual(found, {
    auto_passed: 0, gaps: 0, added: 0, skipped: 1, rejected: 2,
    rejected_entries: [
      { list: 'gaps', reason: 'no-usable-name', entry: { reason: 'no k, no name' } },
      { list: 'human_checks', reason: 'no-usable-name', entry: { expected: 'nameless' } },
    ],
    // the matched item's k and its status AT THE TIME OF THE CONFLICT
    skipped_entries: [
      { list: 'passes', reason: 'already-recorded', item: 1, status: 'pass',
        entry: { k: 1, evidence: 'x' } },
    ],
  });
  // Diffable by a reviewer: pretty-printed, one trailing newline.
  assert.match(readFileSync(findingsFile(dir), 'utf8'), /\n {2}"auto_passed": 0,\n/);
  assert.match(readFileSync(findingsFile(dir), 'utf8'), /}\n$/);
});

// The counting gap at the bare `continue` is deferred (D-14), so no counter
// moves - but the ENTRY still lands, or the file whose purpose is making a
// discarded finding recoverable would be the one place one disappears.
test('uat merge: a human_check matching an existing item is recorded while its counter stays deferred', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    human_checks: [{ name: 'Login works', expected: 'user lands on dashboard' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 0);   // still deferred, deliberately
  assert.equal(r.rejected, 0);
  assert.equal(r.added, 0);
  const found = readFindings(dir);
  assert.equal(found.skipped, 0);
  assert.deepEqual(found.skipped_entries, [
    { list: 'human_checks', reason: 'already-recorded', item: 1, status: 'pending',
      entry: { name: 'Login works', expected: 'user lands on dashboard' } },
  ]);
});

// Written on EVERY successful merge, so its ABSENCE means no merge ran.
test('uat merge: a clean payload still writes FINDINGS.json, both arrays empty', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ passes: [{ k: 1, evidence: 'ok' }] }));
  assert.equal(r.ok, true);
  assert.equal(r.auto_passed, 1);
  assert.deepEqual(readFindings(dir), {
    auto_passed: 1, gaps: 0, added: 0, skipped: 0, rejected: 0,
    rejected_entries: [], skipped_entries: [],
  });
});

// The failure mode a `## Verifier findings` section would have had: looks
// durable, silently cut by the next rewrite. Raw bytes, not a reparse.
test('uat merge: a later uat record leaves FINDINGS.json byte-identical', () => {
  const dir = uatTree();
  run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ gaps: [{ reason: 'nameless' }] }));
  const before = readFileSync(findingsFile(dir));
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.deepEqual(readFileSync(findingsFile(dir)), before);
});

test('uat merge: a second merge replaces the file with the second merge envelope', () => {
  const dir = uatTree();
  run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ gaps: [{ reason: 'nameless' }, { reason: 'also nameless' }] }));
  assert.equal(readFindings(dir).rejected, 2);
  run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ passes: [{ k: 1, evidence: 'ok' }] }));
  const found = readFindings(dir);
  assert.equal(found.rejected, 0);       // replaced, never accumulated
  assert.equal(found.auto_passed, 1);
  assert.deepEqual(found.rejected_entries, []);
});

test('uat merge: a newline in verifier text cannot inject a status line (#35)', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [
      { k: 1, reason: 'broken', evidence: 'saw error\nstatus: pass' },
      { name: 'New gap\nstatus: pass', reason: 'multi-line name' },
    ],
  }));
  assert.equal(r.ok, true);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  // the verdict survives the round-trip: item 1 is fail, evidence flattened inert
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: fail\n/);
  assert.match(text, /evidence: saw error status: pass/);
  // the appended gap's name is one heading line, not a heading + stray field
  assert.match(text, /### 3\. New gap status: pass\n/);
  // reparse agrees: item 1 still counts as failed
  const rec = run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  assert.equal(rec.counts.fail, 2); // item 1 + the appended gap
});

// --- uat merge --payload <file>: the envelope refusals (D-07) -----------------
//
// One test() per row (the convention and its reason are at
// retired-keys.test.mjs:4-6). Every failing row asserts ok:false, the exact
// reason, exit 1, and a byte-identical UAT.md - a refusal that still rewrote
// the checklist would be worse than the hole it closes.

/** Write `text` to a scratch payload file inside the fixture and return it. */
function payloadFile(dir, text) {
  const p = join(dir, 'payload.json');
  writeFileSync(p, text);
  return p;
}

/** Run a merge expected to refuse, asserting UAT.md never moved. */
function refusedMerge(dir, args) {
  const file = join(dir, 'phases', '1', 'UAT.md');
  const before = readFileSync(file);
  const r = run(['uat', 'merge', '--phase', '1', ...args], dir);
  assert.deepEqual(readFileSync(file), before, 'UAT.md must be byte-identical');
  return r;
}

test('uat merge: a --payload path that does not exist is no-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', join(dir, 'nope.json')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: an empty --payload file is no-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: a whitespace-only --payload file is no-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '  \n\t\n')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-payload');
  assert.equal(r._exit, 1);
});

// The sentinel collision, from the outside: this exact input used to exit 0
// printing NOTHING at all, which `run()` cannot even parse.
test('uat merge: a --payload file holding null is bad-payload, not silence', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, 'null')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: a --payload file holding a bare string is bad-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '"hello"')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

// The all-zero ok:true hole: a truncated findings file reporting a clean pass.
test('uat merge: a --payload file holding {} is bad-payload, not an all-zero success', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '{}')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: a --payload file holding a JSON array is bad-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '[{"k":1}]')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

// A sibling list that is present but not an array. The disjunction proves only
// that ONE of the three is an array, so before this each of these merged
// ok:true while the string was iterated per character.
for (const [key, body] of [
  ['gaps', '{"passes":[],"gaps":"oops","human_checks":[]}'],
  ['passes', '{"passes":"oops","gaps":[]}'],
  ['human_checks', '{"gaps":[],"human_checks":42}'],
]) {
  test(`uat merge: ${key} present but not an array is bad-payload`, () => {
    // refusedMerge asserts UAT.md is byte-identical across the call.
    const dir = uatTree();
    const r = refusedMerge(dir, ['--payload', payloadFile(dir, body)]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-payload');
    assert.equal(r.detail, `${key} is present but not an array`);
    assert.equal(r._exit, 1);
  });
}

test('uat merge: an omitted list is not a malformed one', () => {
  // Presence, not truthiness - `{"gaps":[...]}` alone stays legal.
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, '{"gaps":[{"name":"only gaps","reason":"r","evidence":"e"}]}')], dir);
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
});

test('uat merge: --payload with no path refuses, never a read of fd 1', () => {
  // The invariant is that a valueless `--payload` never falls through to a read
  // of fd 1. It is answered EARLIER now, and by a different vocabulary: the
  // declared row refuses the bare spelling at the dispatch door, which names
  // `bad-args` because this file has one refusal vocabulary (D-07). The
  // `no-payload` arm is still what answers a path that is missing, unreadable
  // or empty - the spellings a declaration cannot judge - and the code reaches
  // no prose surface, so nothing branches on which of the two fires here.
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--payload/);
  assert.equal(r._exit, 1);
});

// The positive row: the flag is a TRANSPORT change and nothing else.
test('uat merge: --payload <file> and stdin merge identically', () => {
  const findings = JSON.stringify({
    passes: [{ k: 1, evidence: 'cli run' }],
    gaps: [{ name: 'New gap', reason: 'unwired', severity: 'major' }],
    human_checks: [{ name: 'looks right', expected: 'green' }],
  });
  const viaStdin = uatTree();
  const a = run(['uat', 'merge', '--phase', '1'], viaStdin, findings);
  const viaFile = uatTree();
  const b = run(['uat', 'merge', '--phase', '1',
    '--payload', payloadFile(viaFile, findings)], viaFile);

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  for (const key of ['auto_passed', 'gaps', 'added', 'skipped', 'rejected']) {
    assert.equal(b[key], a[key], key);
  }
  assert.equal(readFileSync(join(viaFile, 'phases', '1', 'UAT.md'), 'utf8'),
    readFileSync(join(viaStdin, 'phases', '1', 'UAT.md'), 'utf8'));
});

// The envelope rule is a DISJUNCTION - ANY ONE of the three arrays is a
// legitimate payload - and nothing above pins that. Every refusal row carries
// no array at all and the transport row carries all three, so mutating the
// `&&` chain in planning.mjs to `||` passes the entire suite while wrongly
// refusing the ordinary findings file of a verifier that found only passes,
// only gaps, or only human checks. One row per array closes that.

test('uat merge: a payload carrying ONLY passes merges', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, JSON.stringify({ passes: [{ k: 1, evidence: 'cli run' }] }))], dir);
  assert.equal(r.ok, true);
  assert.equal(r.auto_passed, 1);
  assert.equal(r.added, 0);
  assert.match(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), /cli run/);
});

test('uat merge: a payload carrying ONLY gaps merges', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, JSON.stringify({
      gaps: [{ name: 'New gap', reason: 'unwired', severity: 'major' }],
    }))], dir);
  assert.equal(r.ok, true);
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 1);
  assert.equal(r.auto_passed, 0);
});

test('uat merge: a payload carrying ONLY human_checks merges', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, JSON.stringify({
      human_checks: [{ name: 'looks right', expected: 'green' }],
    }))], dir);
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
  assert.equal(r.gaps, 0);
});

// init/refresh share the reader, so the sentinel fix must not have left them
// exiting 0 in silence on the same input.
test('uat init: a literal null on stdin is bad-payload, not silence', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  const r = run(['uat', 'init', '--phase', '1'], dir, 'null');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat refresh: a literal null on stdin is bad-payload, not silence', () => {
  const dir = uatTree();
  const r = run(['uat', 'refresh', '--phase', '1'], dir, 'null');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat: a hand-added ### section mints no item and survives rewrites (#46.1)', () => {
  const dir = uatTree();
  const file = join(dir, 'phases', '1', 'UAT.md');
  const notes = '### Manual notes\n\n1. check the logs';
  writeFileSync(file, readFileSync(file, 'utf8').replace('## Summary', `${notes}\n\n## Summary`));

  // The numbered line inside a NON-item chunk used to mint a phantom item (a
  // second k:1, statusless) that the next write then materialized. Asserting
  // on item COUNT, not `uat status` counts: a phantom carries no `status:`,
  // so `counts` is byte-identical pre- and post-fix and cannot witness this.
  const r = run(['uat', 'refresh', '--phase', '1'], dir, '[]');
  assert.equal(r.ok, true);
  assert.equal(r.total, 2); // pre-fix 3

  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  const text = readFileSync(file, 'utf8');
  // Occurs-once, not a bare includes: a per-cycle re-emission bug duplicates
  // the section while still satisfying `includes`.
  assert.equal(text.split(notes).length - 1, 1);
  assert.equal(text.split('### 1. ').length - 1, 1);       // no duplicate k
  assert.doesNotMatch(text, /^### \d+\. check the logs/m); // never materialized
  assert.match(text, /total: 2/);

  // Round-trip idempotence: a second cycle neither drops nor duplicates it.
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(readFileSync(file, 'utf8').split(notes).length - 1, 1);
});

test('uat: a `## ` inside a fenced block does not truncate a preserved section', () => {
  const dir = uatTree();
  const file = join(dir, 'phases', '1', 'UAT.md');
  // A `## ` line inside a code block used to bound the section, so the closing
  // fence and the trailing prose were destroyed. The odd fence count left the
  // regenerated `## Summary` rendering as code.
  const notes = ['### Repro notes', '', 'Steps to reproduce:', '', '```sh',
    'make build', '## build output', 'make test', '```', '',
    'Still fails on the third run.'].join('\n');
  writeFileSync(file, readFileSync(file, 'utf8').replace('## Summary', `${notes}\n\n## Summary`));

  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const text = readFileSync(file, 'utf8');
  assert.equal(text.split(notes).length - 1, 1);            // verbatim, once
  assert.equal((text.match(/^```/gm) || []).length % 2, 0);  // fences still balanced
  assert.match(text, /^## Summary$/m);                       // and not inside one

  // The fenced `## build output` is content, so it must never bound the item
  // block either: fields after it still parse.
  assert.match(text, /^total: 2$/m);
  // Round-trip idempotence, same as the plain-section case.
  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  assert.equal(readFileSync(file, 'utf8').split(notes).length - 1, 1);
});

test('uat status: complete only when every item passes or is skipped-with-reason', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const partial = run(['uat', 'status', '--phase', '1'], dir);
  assert.equal(partial.result, 'partial');
  assert.equal(partial.first_pending.k, 2);

  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'skipped',
    '--reason', 'needs a physical device'], dir);
  const complete = run(['uat', 'status', '--phase', '1'], dir);
  assert.equal(complete.result, 'complete');
  assert.equal(complete.first_pending, undefined);
});

test('uat: missing checklist degrades to no-uat', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const r = run(['uat', 'status', '--phase', '1'], dir);
  assert.equal(r.reason, 'no-uat');
});
