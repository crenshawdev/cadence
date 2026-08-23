// Zero-dep tests for lib/why-query.mjs - the query grammar, the git argument
// vectors, the exclusion measure and the failure classifier `/cad-why`
// (phase 1 plan 1, widened by v3.6.1's WHY-02) is built on. See that module's
// header for the design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuery, probeArgv, bareArgv, lineArgv, comparandArgv, classifyResult, excludedFrom,
} from './lib/why-query.mjs';

// --- parseQuery: the accepted shapes ----------------------------------------

test('a bare path with no colon parses to that path and no line', () => {
  const r = parseQuery('a/b.rs');
  assert.deepEqual(r, { ok: true, path: 'a/b.rs', line: undefined });
});

test('a path with a trailing :<digits> parses to that path and the line', () => {
  const r = parseQuery('a/b.rs:42');
  assert.deepEqual(r, { ok: true, path: 'a/b.rs', line: 42 });
});

test('a colon whose suffix does not start with a digit, -, or + stays inside the path', () => {
  const r = parseQuery('a/b:c.rs');
  assert.deepEqual(r, { ok: true, path: 'a/b:c.rs', line: undefined });
});

test('a drive-letter-shaped colon stays inside the path', () => {
  const r = parseQuery('C:/src/a.rs');
  assert.deepEqual(r, { ok: true, path: 'C:/src/a.rs', line: undefined });
});

// --- parseQuery: the five distinct refusals ---------------------------------

test('a.rs:0 refuses as zero-line', () => {
  assert.deepEqual(parseQuery('a.rs:0'), { ok: false, reason: 'zero-line' });
});

test('a.rs:-1 refuses as negative-line', () => {
  assert.deepEqual(parseQuery('a.rs:-1'), { ok: false, reason: 'negative-line' });
});

test('a.rs:4x refuses as non-integer-line', () => {
  assert.deepEqual(parseQuery('a.rs:4x'), { ok: false, reason: 'non-integer-line' });
});

test('a.rs: refuses as trailing-colon', () => {
  assert.deepEqual(parseQuery('a.rs:'), { ok: false, reason: 'trailing-colon' });
});

test('the empty string refuses as empty-path', () => {
  assert.deepEqual(parseQuery(''), { ok: false, reason: 'empty-path' });
});

test('all five refusal reasons are distinct', () => {
  const reasons = [
    parseQuery('a.rs:0'), parseQuery('a.rs:-1'), parseQuery('a.rs:4x'),
    parseQuery('a.rs:'), parseQuery(''),
  ].map((r) => r.reason);
  assert.equal(new Set(reasons).size, 5, `expected 5 distinct reasons, got ${reasons.join(', ')}`);
});

test('a colon-only path half refuses as empty-path even with a valid line', () => {
  assert.deepEqual(parseQuery(':5'), { ok: false, reason: 'empty-path' });
});

// --- the git argument vectors -----------------------------------------------

test('the bare argv carries -M, --follow and a -- separator', () => {
  const argv = bareArgv('a/b.rs');
  assert.ok(argv.includes('-M'));
  assert.ok(argv.includes('--follow'));
  assert.ok(argv.includes('--'));
  assert.ok(argv.includes('a/b.rs'));
});

test('the line argv carries -M and a -L term, and neither --follow nor --', () => {
  const argv = lineArgv('a/b.rs', 42);
  assert.ok(argv.includes('-M'));
  assert.ok(argv.some((a) => a.startsWith('-L')));
  assert.ok(!argv.includes('--follow'));
  assert.ok(!argv.includes('--'));
});

test('only the bare argv carries --follow and a -- separator', () => {
  assert.ok(!lineArgv('a/b.rs', 1).includes('--follow'));
  assert.ok(!lineArgv('a/b.rs', 1).includes('--'));
  assert.ok(bareArgv('a/b.rs').includes('--follow'));
  assert.ok(bareArgv('a/b.rs').includes('--'));
});

test('only the line argv carries a -L term', () => {
  assert.ok(!bareArgv('a/b.rs').some((a) => a.startsWith('-L')));
  assert.ok(lineArgv('a/b.rs', 1).some((a) => a.startsWith('-L')));
});

test('the probe argv is capped at one result and names the path', () => {
  const argv = probeArgv('a/b.rs');
  assert.ok(argv.includes('-1'));
  assert.ok(argv.includes('a/b.rs'));
});

// --- the comparand arm and the exclusion it measures (WHY-02, D-01) --------

test('the comparand argv carries --full-history, -M and a -- separator, and NEVER --follow', () => {
  const argv = comparandArgv('a/b.rs');
  assert.ok(argv.includes('--full-history'));
  assert.ok(argv.includes('-M'));
  assert.ok(argv.includes('--'));
  assert.ok(argv.includes('a/b.rs'));
  // The whole reason this is a second query rather than a flag on `bareArgv`:
  // measured on git 2.55.0, `--follow` defeats `--full-history` and the pair
  // returns exactly the `--follow` answer.
  assert.ok(!argv.includes('--follow'), '--follow here would silently return the answer this arm exists to widen');
});

test('the comparand format asks for the parent list, which is what makes a merge count evidence', () => {
  const format = comparandArgv('a/b.rs').find((a) => a.startsWith('--format='));
  assert.ok(format.includes('%H'), 'the full sha');
  assert.ok(format.includes('%P'), 'and the parent list');
});

test('the bare arm is unmoved: it still carries --follow and still does not carry --full-history', () => {
  const argv = bareArgv('a/b.rs');
  assert.ok(argv.includes('--follow'));
  assert.ok(!argv.includes('--full-history'), 'the flags do not compose - widening the chain is a second query');
});

test('excludedFrom names the comparand records the chain does not carry, with their parent counts', () => {
  const chain = ['a'.repeat(40), 'b'.repeat(40)];
  const records = [
    { sha: 'm'.repeat(40), parents: ['a'.repeat(40), 'z'.repeat(40)] },
    { sha: 'b'.repeat(40), parents: ['a'.repeat(40)] },
    { sha: 'a'.repeat(40), parents: [] },
  ];
  assert.deepEqual(excludedFrom(chain, records), [{ sha: 'm'.repeat(40), parentCount: 2 }]);
});

test("excludedFrom keeps the comparand's own newest-first order and never re-sorts", () => {
  const records = [
    { sha: '3'.repeat(40), parents: ['x'] },
    { sha: '1'.repeat(40), parents: ['x', 'y'] },
    { sha: '2'.repeat(40), parents: [] },
  ];
  assert.deepEqual(excludedFrom([], records).map((r) => r.sha),
    ['3'.repeat(40), '1'.repeat(40), '2'.repeat(40)]);
});

test('a chain carrying every comparand record excludes nothing - the ordinary state', () => {
  const records = [{ sha: 'a'.repeat(40), parents: [] }, { sha: 'b'.repeat(40), parents: ['a'.repeat(40)] }];
  assert.deepEqual(excludedFrom(records.map((r) => r.sha), records), []);
  assert.deepEqual(excludedFrom([], []), [], 'and an empty comparand is empty, never a throw');
  assert.deepEqual(excludedFrom(undefined, undefined), []);
});

test('a record with no sha is a parse artifact and is dropped, never counted as a commit', () => {
  assert.deepEqual(excludedFrom([], [{ sha: '', parents: ['a'] }, { parents: ['a'] }, {}]), []);
});

test('a root commit reads as zero parents rather than one, so it can never be counted a merge', () => {
  assert.deepEqual(excludedFrom([], [{ sha: 'r'.repeat(40) }]), [{ sha: 'r'.repeat(40), parentCount: 0 }]);
});

// --- classifyResult: the two measured failure shapes ------------------------

test('exit 128 with a "has only N lines" fatal classifies as line-past-end, no stderr bytes carried', () => {
  const stderr = 'fatal: file cadence-core/bin/lib/seam-io.mjs has only 28 lines';
  const r = classifyResult({ status: 128, stderr, stdoutEmpty: true });
  assert.deepEqual(r, { outcome: 'line-past-end' });
  const rendered = JSON.stringify(r);
  assert.ok(!rendered.includes('fatal:'));
  assert.ok(!rendered.includes('seam-io.mjs'));
});

test('exit 0 with empty stdout classifies as not-in-history, no stderr bytes carried', () => {
  const r = classifyResult({ status: 0, stderr: '', stdoutEmpty: true });
  assert.deepEqual(r, { outcome: 'not-in-history' });
  const rendered = JSON.stringify(r);
  assert.ok(!rendered.includes('fatal:'));
});

test('the two failure shapes classify to two distinct outcomes', () => {
  const a = classifyResult({ status: 128, stderr: 'fatal: file x has only 3 lines', stdoutEmpty: true });
  const b = classifyResult({ status: 0, stderr: '', stdoutEmpty: true });
  assert.notEqual(a.outcome, b.outcome);
});

test('exit 128 with an unknown-path fatal classifies as not-in-history', () => {
  const r = classifyResult({
    status: 128, stderr: 'fatal: There is no path no/such/file in the commit', stdoutEmpty: true,
  });
  assert.deepEqual(r, { outcome: 'not-in-history' });
});

test('exit 0 with non-empty stdout classifies as ok', () => {
  assert.deepEqual(classifyResult({ status: 0, stderr: '', stdoutEmpty: false }), { outcome: 'ok' });
});

test('an unrecognized non-zero exit classifies as git-failed rather than crashing', () => {
  const r = classifyResult({ status: 1, stderr: 'fatal: something else entirely', stdoutEmpty: true });
  assert.deepEqual(r, { outcome: 'git-failed' });
});
