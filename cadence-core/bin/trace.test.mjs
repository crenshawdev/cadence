// Zero-dep tests for lib/trace.mjs and the `planning.mjs trace` seam.
// Run: node --test 'cadence-core/bin/*.test.mjs'
//
// Two layers, matching the rest of the suite: the lib is exercised directly on
// scratch planning roots (it does guarded I/O, so a fixture directory IS the
// input), and the CLI is exercised through planning.mjs so the one JSON line
// and the exit code a caller actually sees are what get asserted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, readdirSync,
  copyFileSync, symlinkSync, lstatSync, existsSync, chmodSync, accessSync, constants,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvent, correlationId, renderTrace, tracePath, MAX_TRACE_BYTES, FAMILIES,
  ANCHOR, DISPATCH, TERMINAL, COORDINATOR,
} from './lib/trace.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(HERE, 'planning.mjs');
const REPO = join(HERE, '..', '..');

/** A fresh, empty planning root. */
function root() {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-trace-')), '.planning');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Run the seam and parse its one JSON line, ok:false included. */
function run(dir, args) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, '--dir', dir, ...args],
      { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const lines = (dir) => readFileSync(tracePath(dir), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

// --- the derived correlation id (D-06) ---------------------------------------

test('correlationId: two calls in the same phase with an anchor derive the same id', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  assert.equal(correlationId(dir, 1), '1-abc1234');
  assert.equal(correlationId(dir, 1), correlationId(dir, 1));
  // The string spelling a CLI producer might hold is the same worker key.
  assert.equal(correlationId(dir, '1'), '1-abc1234');
});

test('correlationId: with NO anchor both calls fall back to the phase alone', () => {
  const dir = root();
  assert.equal(correlationId(dir, 2), '2');
  appendEvent(dir, { phase: 2, family: 'routing', event: 'resolve' });
  assert.equal(correlationId(dir, 2), '2');
  assert.equal(correlationId(dir, 2), correlationId(dir, 2));
});

test('correlationId: the id changes when the anchor sha changes (a re-run)', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'aaa1111' });
  const first = correlationId(dir, 1);
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'bbb2222' });
  const second = correlationId(dir, 1);
  assert.equal(first, '1-aaa1111');
  assert.equal(second, '1-bbb2222');
  assert.notEqual(first, second);
});

test('correlationId: another phase\'s anchor never answers for this phase', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  assert.equal(correlationId(dir, 2), '2');
});

test('the anchor event carries the id it anchors, not the phase-only fallback', () => {
  // Otherwise the lifecycle family splits across two ids and "all four families
  // under ONE correlation id" is unreachable by construction.
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve' });
  const corrs = [...new Set(lines(dir).map((e) => e.corr))];
  assert.deepEqual(corrs, ['1-abc1234']);
});

// --- the append contract (D-07) ----------------------------------------------

test('appendEvent: keys land in the fixed order, one JSON object per line', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1' });
  const [e] = lines(dir);
  assert.deepEqual(Object.keys(e), ['corr', 'phase', 'ts', 'family', 'event', 'plan']);
  assert.match(e.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('appendEvent: an interleaved write sequence keeps every event, in order', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  // Two "concurrent producers" writing between each other's appends: the append
  // mode is what makes this lossless, where a read-modify-write would drop one.
  for (let i = 0; i < 10; i++) {
    appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve', role: `a${i}` });
    appendEvent(dir, { phase: 1, family: 'provider', event: 'request', role: `b${i}` });
  }
  const got = lines(dir);
  assert.equal(got.length, 21);
  assert.deepEqual(got.filter((e) => e.family === 'routing').map((e) => e.role),
    Array.from({ length: 10 }, (_, i) => `a${i}`));
  assert.equal(new Set(got.map((e) => e.corr)).size, 1);
});

test('appendEvent: a file at the bound accepts nothing more and renders capped', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  const before = lines(dir).length;
  appendFileSync(tracePath(dir), 'x'.repeat(MAX_TRACE_BYTES));
  const res = appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve' });
  assert.deepEqual(res, { written: false, reason: 'size-cap' });
  const r = renderTrace(dir, 1);
  assert.equal(r.capped, true);
  assert.equal(r.counts.routing, 0);
  assert.equal(r.counts.lifecycle, before);
  // The padding runs past the read ceiling, so the bounded read truncates it
  // and drops the trailing partial line rather than parsing it: a line only
  // partly read cannot honestly be called malformed. `capped` carries the
  // signal instead, and it is asserted above.
  assert.equal(r.malformed, 0);
});

test('renderTrace: an oversized file is read bounded, not whole', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  // Four times the cap of syntactically VALID events. Whole-file reads count
  // them all; a bounded read cannot, because it never sees past the ceiling.
  // The writer would refuse these - this is the corrupted / hand-edited /
  // foreign-producer file the read side has to survive on its own.
  const fat = JSON.stringify({ phase: 1, family: 'routing', event: 'resolve', corr: '1-abc1234' }) + '\n';
  appendFileSync(tracePath(dir), fat.repeat(Math.ceil((MAX_TRACE_BYTES * 4) / fat.length)));
  const onDisk = readFileSync(tracePath(dir), 'utf8').split('\n').length;
  assert.ok(onDisk > (MAX_TRACE_BYTES * 3) / fat.length, 'fixture must exceed the cap severalfold');

  const r = renderTrace(dir, 1);
  assert.equal(r.capped, true, 'an over-cap file must report capped');
  // The falsifier: unbounded, routing counts every line on disk. Bounded, it
  // cannot exceed what fits under the ceiling.
  assert.ok(r.counts.routing < onDisk - 1,
    `bounded read must not count every line: got ${r.counts.routing} of ${onDisk}`);
  assert.ok(r.counts.routing <= Math.ceil(MAX_TRACE_BYTES / fat.length),
    'bounded read must not exceed the byte ceiling');
  assert.equal(r.counts.lifecycle, 1, 'the head is kept, so the anchor survives');
});

test('appendEvent: an unwritable planning root returns written:false and throws nothing', () => {
  // .planning is a REGULAR FILE, so every fs call under it fails ENOTDIR for
  // any uid - deterministic where a chmod is not (a root test runner ignores it).
  const base = mkdtempSync(join(tmpdir(), 'cad-trace-bad-'));
  const dir = join(base, '.planning');
  writeFileSync(dir, 'not a directory');
  const res = appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve' });
  assert.equal(res.written, false);
  assert.equal(res.reason, 'ENOTDIR');
  // ...and the reader is just as quiet about it.
  const r = renderTrace(dir, 1);
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.counts, { routing: 0, provider: 0, lifecycle: 0, outcome: 0 });
});

test('appendEvent: a non-object event is refused rather than written', () => {
  const dir = root();
  assert.deepEqual(appendEvent(dir, null), { written: false, reason: 'bad-event' });
  assert.deepEqual(appendEvent(dir, ['x']), { written: false, reason: 'bad-event' });
});

// --- the reader ---------------------------------------------------------------

test('renderTrace: an absent trace file is an empty render, never an error', () => {
  const dir = root();
  const r = renderTrace(dir, 1);
  assert.deepEqual(r.counts, { routing: 0, provider: 0, lifecycle: 0, outcome: 0 });
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.unpaired, []);
  assert.equal(r.capped, false);
  assert.equal(r.corr, '1');
});

test('renderTrace: an unpaired dispatch is reported, a paired one is not', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '2' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'return', plan: '2' });
  const r = renderTrace(dir, 1);
  assert.deepEqual(r.unpaired.map((u) => u.plan), ['1']);
});

test('renderTrace: checkpoint and escalation close a bracket too', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'checkpoint', plan: '1' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: 'cad-verifier' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'escalation', plan: 'cad-verifier' });
  assert.deepEqual(renderTrace(dir, 1).unpaired, []);
});

test('renderTrace: a role-keyed worker pairs on its own key, not with a plan number', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'return', plan: 'cad-verifier' });
  assert.deepEqual(renderTrace(dir, 1).unpaired.map((u) => u.plan), ['1']);
});

test('renderTrace: a re-run never pairs across runs, and unpaired names the run', () => {
  // Phase 1 runs TWICE at different shas. Run 1 strands plan 1; run 2 brackets
  // plan 1 cleanly. The header promises a re-run starts a NEW id, so run 2's
  // `return` may not reach back and close run 1's dispatch.
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'aaa' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'bbb' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'return', plan: '1' });
  const r = renderTrace(dir, 1);
  assert.equal(r.unpaired.length, 1);
  assert.equal(r.unpaired[0].corr, '1-aaa');
  assert.equal(r.unpaired[0].plan, '1');
  assert.deepEqual(r.unpaired.map((u) => u.corr).filter((c) => c === '1-bbb'), []);
});

test('renderTrace: a PRE-ANCHOR event joins its phase\'s next anchor at read time', () => {
  const dir = root();
  // /cad-plan's resolves are written before /cad-execute writes the anchor, so
  // they took the bare `<phase>` form while everything after it took
  // `<phase>-<sha>` - one phase, two ids, and the record joined nothing across
  // the moment a phase begins. The repair is READ-time (D-01): the line on disk
  // still says `"corr":"1"`.
  appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve', role: 'cad-planner' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-planner' });
  appendEvent(dir, { phase: 2, family: 'routing', event: 'resolve', role: 'cad-planner' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR, sha: 'abc1234' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-planner', tokens: 7 });
  assert.deepEqual(lines(dir).map((e) => e.corr), ['1', '1', '2', '1-abc1234', '1-abc1234'],
    'the file is untouched by the repair - it is a reader change, not a rewrite');

  const r = renderTrace(dir, 1);
  assert.deepEqual(r.events.map((e) => e.corr), ['1-abc1234', '1-abc1234', '1-abc1234', '1-abc1234'],
    'every phase-1 event renders under the anchor ahead of it, bare form gone');
  assert.deepEqual(r.unpaired, [], 'the pre-anchor dispatch and its post-anchor return are ONE bracket');
  assert.deepEqual(r.roles, { 'cad-planner': { dispatches: 1, tokens: 7 } });
  // Phase 2 never got an anchor, so its event has nothing to join to and keeps
  // the bare form - the same state a head-truncated read leaves behind.
  assert.deepEqual(renderTrace(dir, 2).events.map((e) => e.corr), ['2']);
});

test('renderTrace: events after a NO-SHA anchor stay with that run, never the next', () => {
  // A no-sha anchor derives the bare form, so its run's events legitimately
  // carry `"1"` - indistinguishable at the corr field from the NEXT run's
  // pre-anchor events. Repairing them forward would let run 2's terminal pair
  // with and fund run 1's dispatch; the fence is that a bare event whose most
  // recent PRECEDING anchor is bare is already correct as written.
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR, sha: 'bbb' });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 9 });
  const r = renderTrace(dir, 1);
  assert.deepEqual(r.events.map((e) => e.corr), ['1', '1', '1-bbb', '1-bbb'],
    'the no-sha run keeps the bare id; only genuinely pre-anchor events repair forward');
  assert.equal(r.unpaired.length, 1, "run 2's return may not reach back and close run 1's dispatch");
  assert.equal(r.unpaired[0].corr, '1');
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 1, tokens: 9, unrecorded: 1 } },
    "the stray terminal funds no bracket - run 1's dispatch stays unrecorded");
});

test('renderTrace: the U+0000 worker separator keeps two SHIFTED brackets apart', () => {
  // The source of that separator was two literal NUL bytes until DFC-01 turned
  // them into `\0` escapes, and nothing pinned it: deleting the separator, or
  // swapping it for a character a corr/phase/plan value may itself contain,
  // changes the key only for inputs whose parts CONCATENATE alike. Both rows
  // below join to "abcp", so an unseparated key pairs a dispatch with a foreign
  // return and reports a clean run; a separated one leaves the dispatch open.
  const dir = root();
  appendFileSync(tracePath(dir),
    `${JSON.stringify({ corr: 'a', phase: 'bc', plan: 'p', family: 'lifecycle', event: DISPATCH })}\n`
    + `${JSON.stringify({ corr: 'ab', phase: 'c', plan: 'p', family: 'lifecycle', event: TERMINAL[0] })}\n`);
  const r = renderTrace(dir);
  assert.deepEqual(r.unpaired.map((u) => [u.corr, u.phase, u.plan]), [['a', 'bc', 'p']]);
});

test('renderTrace: a malformed line is skipped and counted, the rest still read', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve' });
  appendFileSync(tracePath(dir), 'not json\n');
  appendEvent(dir, { phase: 1, family: 'outcome', event: 'uat_verdict' });
  const r = renderTrace(dir, 1);
  assert.equal(r.malformed, 1);
  assert.equal(r.counts.routing, 1);
  assert.equal(r.counts.outcome, 1);
});

test('renderTrace: --phase restricts the record to that phase', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve' });
  appendEvent(dir, { phase: 2, family: 'routing', event: 'resolve' });
  assert.equal(renderTrace(dir, 1).counts.routing, 1);
  assert.equal(renderTrace(dir).counts.routing, 2);
  assert.equal(renderTrace(dir).corr, null);
});

// --- the seam -----------------------------------------------------------------

test('seam: append then render joins both events under the derived id', () => {
  const dir = root();
  const a = run(dir, ['trace', 'append', '--phase', '1', '--family', 'lifecycle',
    '--event', 'phase_start', '--sha', 'abc1234']);
  assert.equal(a.ok, true);
  assert.equal(a.written, true);
  assert.equal(a.corr, '1-abc1234');
  const b = run(dir, ['trace', 'append', '--phase', '1', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', '1']);
  assert.equal(b.corr, '1-abc1234');
  const r = run(dir, ['trace', 'render', '--phase', '1', '--events']);
  assert.equal(r.ok, true);
  assert.equal(r.corr, '1-abc1234');
  assert.equal(r.capped, false);
  assert.equal(r.counts.lifecycle, 2);
  assert.deepEqual(r.events.map((e) => e.corr), ['1-abc1234', '1-abc1234']);
  assert.deepEqual(r.unpaired.map((u) => u.plan), ['1']);
});

test('seam: every family is accepted and nothing else is', () => {
  const dir = root();
  for (const family of FAMILIES) {
    assert.equal(run(dir, ['trace', 'append', '--phase', '1',
      '--family', family, '--event', 'e']).ok, true, family);
  }
  const bad = run(dir, ['trace', 'append', '--phase', '1', '--family', 'routign', '--event', 'e']);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'bad-args');
});

test('seam: a malformed call is ok:false, an unwritten append is ok:true', () => {
  const dir = root();
  assert.equal(run(dir, ['trace', 'append', '--family', 'routing', '--event', 'e']).reason,
    'bad-args');
  assert.equal(run(dir, ['trace', 'append', '--phase', '1', '--family', 'routing']).reason,
    'bad-args');
  assert.equal(run(dir, ['trace', 'nonsense']).reason, 'usage');

  const base = mkdtempSync(join(tmpdir(), 'cad-trace-seam-'));
  const bad = join(base, '.planning');
  writeFileSync(bad, 'not a directory');
  const r = run(bad, ['trace', 'append', '--phase', '1', '--family', 'routing', '--event', 'e']);
  assert.equal(r.ok, true);      // best effort: the record may not block the run
  assert.equal(r.written, false);
  assert.equal(r.reason, 'ENOTDIR');
});

test('seam: 1.1 and 1.10 are two phases, not one trace key (D-02)', () => {
  // The defect recalled from phase 1's queue: `--phase` was read as a NUMBER, so
  // `1.10` normalized to `1.1` and both sub-phases shared one key and one
  // correlation id - the record joined two phases into one story.
  const dir = root();
  const a = run(dir, ['trace', 'append', '--phase', '1.1', '--family', 'lifecycle',
    '--event', 'phase_start', '--sha', 'aaa1111']);
  const b = run(dir, ['trace', 'append', '--phase', '1.10', '--family', 'lifecycle',
    '--event', 'phase_start', '--sha', 'bbb2222']);
  assert.equal(a.corr, '1.1-aaa1111');
  assert.equal(b.corr, '1.10-bbb2222');

  const ten = run(dir, ['trace', 'render', '--phase', '1.10', '--events']);
  assert.equal(ten.corr, '1.10-bbb2222');
  assert.equal(ten.events.length, 1, JSON.stringify(ten.events));
  assert.equal(ten.events[0].phase, '1.10');

  const one = run(dir, ['trace', 'render', '--phase', '1.1', '--events']);
  assert.equal(one.corr, '1.1-aaa1111');
  assert.equal(one.events.length, 1, JSON.stringify(one.events));
  assert.equal(one.events[0].phase, '1.1');
});

test('seam: render on an absent trace file is ok:true with an empty record', () => {
  const dir = root();
  const r = run(dir, ['trace', 'render', '--phase', '1']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.brackets, []);
  assert.deepEqual(r.outcomes, []);
  assert.deepEqual(r.unpaired, []);
  assert.ok(!('events' in r));
  // ...and the raw array is still reachable, still empty.
  assert.deepEqual(run(dir, ['trace', 'render', '--phase', '1', '--events']).events, []);
});

// --- the bounded render (D-08, D-09) -----------------------------------------
//
// The CLI response is what gets read into a model's context; the FUNCTION's
// return is what `trace suggest` prices a run from. So the bound is on the
// response alone, and what replaces `events` is the paired bracket rows plus
// every `outcome` event - never a tail-N, because triage-gate's one-re-arm cap
// looks up a `rearm` outcome in this payload and a truncated one makes it miss.

/** A dispatch/terminal pair `a`..`b` minutes apart, with a token figure. */
function billed(dir, plan, role, a, b, tokens, event = 'return') {
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: DISPATCH, plan, role, ts: at(a) });
  appendEvent(dir, { phase: 9, family: 'lifecycle', event, plan, role, tokens, ts: at(b) });
}

test('renderTrace: every PAIRED bracket is exposed as a row, unpaired ones are not', () => {
  const dir = root();
  billed(dir, '1', 'cad-executor', 0, 4, 100);
  billed(dir, '2', 'cad-reviewer', 2, 5, 50, 'checkpoint');
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: DISPATCH, plan: '3', role: 'cad-planner', ts: at(6) });
  const r = renderTrace(dir, 9);
  assert.deepEqual(r.brackets.map((b) => [b.plan, b.role, b.event, b.ms, b.tokens]), [
    ['1', 'cad-executor', 'return', 4 * MIN, 100],
    ['2', 'cad-reviewer', 'checkpoint', 3 * MIN, 50],
  ]);
  // The third dispatch never closed, so it is `unpaired` and has no row - the
  // same split the accounting already makes, exposed rather than re-derived.
  assert.deepEqual(r.unpaired.map((u) => u.plan), ['3']);
});

test('renderTrace: a bracket row bills the DISPATCH\'s role, like `roles` does', () => {
  const dir = root();
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: DISPATCH, plan: '1', role: 'cad-executor', ts: at(0) });
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-reviewer', tokens: 7, ts: at(1) });
  const r = renderTrace(dir, 9);
  assert.equal(r.brackets[0].role, 'cad-executor');
  // ...and the disagreement is still reported where it always was.
  assert.equal(r.mismatched.length, 1);
});

test('renderTrace: a bracket whose timestamps cannot be read reports ms null, never 0', () => {
  const dir = root();
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: DISPATCH, plan: '1', role: 'r', ts: 'not-a-time' });
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: 'return', plan: '1', role: 'r', ts: at(3) });
  const r = renderTrace(dir, 9);
  assert.equal(r.brackets[0].ms, null);
  // A figureless close reports null too - the same absent-is-not-zero rule the
  // token accounting already holds.
  assert.equal(r.brackets[0].tokens, null);
});

test('seam: the DEFAULT render carries bracket rows and outcomes, never the event array', () => {
  const dir = root();
  billed(dir, '1', 'cad-executor', 0, 4, 100);
  appendEvent(dir, { phase: 9, family: 'outcome', event: 'gate', detail: 'risk_surface', ts: at(5) });
  appendEvent(dir, { phase: 9, family: 'routing', event: 'resolve', ts: at(6) });
  const r = run(dir, ['trace', 'render', '--phase', '9']);
  assert.equal(r.ok, true);
  assert.ok(!('events' in r), JSON.stringify(Object.keys(r)));
  assert.deepEqual(r.brackets.map((b) => b.plan), ['1']);
  assert.deepEqual(r.outcomes.map((e) => e.event), ['gate']);
  // Everything else is exactly what it was: the counts still price the WHOLE
  // scoped record, not the bounded payload.
  assert.deepEqual(r.counts, { routing: 1, provider: 0, lifecycle: 2, outcome: 1 });
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 1, tokens: 100 } });
});

test('seam: triage-gate\'s `rearm` lookup still finds its event in the bounded response', () => {
  const dir = root();
  // The one-re-arm cap on the only BLOCKING trigger reads this payload for a
  // `rearm` outcome under the current `corr`. A tail-N bound would drop it
  // behind the phase's lifecycle traffic and the cap would fail OPEN.
  appendEvent(dir, { phase: 9, family: 'lifecycle', event: ANCHOR, sha: 'abc1234', ts: at(0) });
  appendEvent(dir, { phase: 9, family: 'outcome', event: 'rearm', detail: 'risk_surface', ts: at(1) });
  for (let i = 0; i < 40; i++) billed(dir, `p${i}`, 'cad-executor', 2 + i, 3 + i, 1000);
  const r = run(dir, ['trace', 'render', '--phase', '9']);
  const rearm = r.outcomes.filter((e) => e.event === 'rearm' && e.corr === r.corr);
  assert.equal(rearm.length, 1);
  assert.equal(rearm[0].detail, 'risk_surface');
});

test('seam: --events hands back the raw array the two in-process readers use', () => {
  const dir = root();
  billed(dir, '1', 'cad-executor', 0, 4, 100);
  appendEvent(dir, { phase: 9, family: 'outcome', event: 'gate', ts: at(5) });
  const full = run(dir, ['trace', 'render', '--phase', '9', '--events']);
  assert.deepEqual(full.events.map((e) => e.event), [DISPATCH, 'return', 'gate']);
  // The flag is an EITHER/OR: asking for the array is asking for today's
  // envelope, so the bounded keys do not ride along and re-buy the bytes.
  assert.ok(!('brackets' in full));
  assert.ok(!('outcomes' in full));
});

// --- what a dispatch COST: --tokens, --role, --read --------------------------

/** The trace file's exact bytes, or null when it does not exist yet. */
function traceBytes(dir) {
  try { return readFileSync(tracePath(dir), 'utf8'); } catch { return null; }
}

test('seam: --role and --tokens ride one lifecycle event, tokens as a NUMBER', () => {
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'return', '--plan', '1', '--role', 'cad-executor', '--tokens', '12345']);
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  const [e] = lines(dir);
  assert.equal(e.role, 'cad-executor');
  assert.equal(e.tokens, 12345);
  // A NUMBER, not the string the flag arrived as: a reader must be able to sum
  // the field without type-checking it first.
  assert.equal(typeof e.tokens, 'number');
  assert.match(traceBytes(dir), /"tokens":12345/);
});

test('seam: --plan and --role are two separate fields on the same event', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', '2', '--role', 'cad-executor', '--read', 'PLAN.md']);
  const [e] = lines(dir);
  // `--plan` stays the PAIRING key; `--role` is the grouping key. Collapsing
  // them would key executors by plan NUMBER while every other worker keys by
  // role NAME.
  assert.equal(e.plan, '2');
  assert.equal(e.role, 'cad-executor');
});

test('seam: --tokens accepts the comma grouping this plugin prints figures in', () => {
  // lib/trace.mjs's TOKEN PROVENANCE contract prints `cad-planner 146,405` in
  // the grouped form, and that header is the one surface stating what a real
  // figure looks like, so the grouped form is the transcription the prose
  // models. Refusing it dropped the whole append and stranded the worker
  // unpaired, which is worse than the recording error it was refusing.
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'return', '--plan', '1', '--role', 'cad-planner', '--tokens', '146,405']);
  assert.equal(r.ok, true);
  const [e] = lines(dir);
  assert.equal(e.tokens, 146405);
  assert.equal(typeof e.tokens, 'number');
});

test('seam: a malformed --tokens appends NOTHING at all', () => {
  const dir = root();
  for (const bad of ['abc', '-1', '1.5', '', '1,2,3', '146,40']) {
    const before = traceBytes(dir);
    const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
      '--event', 'return', '--plan', '1', '--role', 'cad-executor', '--tokens', bad]);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    // Byte-identical (or still absent): a best-effort append with the field
    // dropped would render the role `unrecorded` while the caller believed a
    // figure was recorded.
    assert.equal(traceBytes(dir), before, bad);
  }
  assert.equal(traceBytes(dir), null);
  // A bare `--tokens` (parsed as boolean true) is refused the same way.
  const bare = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'return', '--tokens']);
  assert.equal(bare.ok, false);
  assert.equal(bare.reason, 'bad-args');
  assert.equal(traceBytes(dir), null);
});

test('seam: --tokens lands identically on return, checkpoint and escalation', () => {
  const dir = root();
  for (const event of TERMINAL) {
    const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
      '--event', event, '--plan', 'cad-planner', '--role', 'cad-planner', '--tokens', '7']);
    assert.equal(r.ok, true, event);
  }
  const written = lines(dir);
  assert.deepEqual(written.map((e) => e.event), TERMINAL);
  // No flag is coupled to an event name, which is what makes all three store
  // the figure the same way.
  assert.deepEqual(written.map((e) => e.tokens), TERMINAL.map(() => 7));
});

test('seam: --tokens 0 is a recorded figure, not an omission', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'return', '--plan', '1', '--role', 'cad-executor', '--tokens', '0']);
  const [e] = lines(dir);
  assert.equal(e.tokens, 0);
  assert.ok('tokens' in e);
});

test('seam: --raised rides an adjudication event as a NUMBER', () => {
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'adjudication', '--detail', 'plan: 0 survivors; voices openai', '--raised', '9']);
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  const [e] = lines(dir);
  assert.equal(e.raised, 9);
  // A NUMBER for the same reason `--tokens` is one: the kill count is summed
  // by trace suggest without type-checking it first.
  assert.equal(typeof e.raised, 'number');
  assert.match(traceBytes(dir), /"raised":9/);
});

test('seam: --raised 0 is a recorded figure, not an omission', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'adjudication', '--detail', 'plan: 0 survivors', '--raised', '0']);
  const [e] = lines(dir);
  assert.equal(e.raised, 0);
  // `0 of 0` and "nobody recorded it" are different fires, and this key is what
  // separates them: an omitted `raised` reads downstream as UNKNOWN.
  assert.ok('raised' in e);
});

test('seam: an append with no --raised is byte-identical to today\'s', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'adjudication', '--detail', 'plan: 2 survivors']);
  const [e] = lines(dir);
  assert.equal('raised' in e, false, JSON.stringify(e));
});

test('seam: a malformed --raised appends NOTHING at all', () => {
  const dir = root();
  // No comma-grouping exception here, unlike `--tokens`: a finding count is
  // never PRINTED grouped, so `1,234` is a typo rather than a transcription.
  for (const bad of ['abc', '-1', '1.5', '', '1,234']) {
    const before = traceBytes(dir);
    const r = run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
      '--event', 'adjudication', '--detail', 'plan: 0 survivors', '--raised', bad]);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(traceBytes(dir), before, bad);
  }
  assert.equal(traceBytes(dir), null);
  // A bare `--raised` (parsed as boolean true) is refused the same way.
  const bare = run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'adjudication', '--raised']);
  assert.equal(bare.ok, false);
  assert.equal(bare.reason, 'bad-args');
  assert.equal(traceBytes(dir), null);
});

// --- the settled counts, and the record they are recounted against (AC4) -----
//
// D-01's cross-check is between two INDEPENDENT artifacts: the committed
// `ADJUDICATION-*.json` and this receipt. The figures on the receipt are
// DERIVED by the `adjudication` seam and copied here by hand, so the receipt is
// where a mistyped one enters the record - and `.planning/trace.jsonl` is
// gitignored, so the trace is the local cross-check and the record is what
// carries custody. Every fixture below therefore builds its record by running
// the REAL seam rather than hand-writing the JSON: a check against a shape the
// writer never emits proves nothing about the writer.

/** A scratch git repo with `.planning/phases/<phase>/` and two commits. */
function fireRepo(phase = 2) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-fire-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  const dir = join(repo, '.planning');
  mkdirSync(join(dir, 'phases', String(phase)), { recursive: true });
  writeFileSync(join(repo, 'src.js'), 'let x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  writeFileSync(join(repo, 'src.js'), 'let x = 2;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'head');
  return { repo, dir, head: git('rev-parse', 'HEAD') };
}

/** One voice, one finding per ruling, each ruling carrying what its arm needs. */
function firePayload(rulings) {
  const findings = rulings.map((_, i) => ({
    file: 'src.js', line: i + 1, severity: 'high',
    claim: `claim ${i}`, failure_scenario: `scenario ${i}`,
  }));
  return {
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: { findings },
      rulings: rulings.map((ruling, i) => ({
        finding: i,
        ruling,
        claim: `claim ${i}`,
        failure_scenario: `scenario ${i}`,
        ...(ruling === 'survived' ? { fix_commit: 'abcdef1' } : {}),
        ...(ruling === 'refuted'
          ? { counter_evidence: { file: 'src.js', line: 1, note: 'the branch is unreachable' } }
          : {}),
      })),
    }],
  };
}

/** Write one record through the REAL seam and answer its envelope. */
function fireRecord(repo, dir, { phase = 2, trigger = 'plan', discriminator = 'plan-1',
  round = 1, rulings }) {
  const payload = join(repo, `payload-${trigger}-${discriminator}-${round}.json`);
  writeFileSync(payload, `${JSON.stringify(firePayload(rulings))}\n`);
  const args = ['adjudication', '--phase', String(phase), '--trigger', trigger,
    '--discriminator', discriminator, '--base', 'HEAD~1', '--head', 'HEAD',
    '--payload', payload, ...(round > 1 ? ['--round', String(round)] : [])];
  let stdout;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, ...args],
      { encoding: 'utf8', cwd: repo });
  } catch (e) { stdout = e.stdout; }
  const r = JSON.parse(stdout);
  assert.equal(r.ok, true, stdout);
  return r;
}

/** The receipt a settle point copies, minus the counts. */
const receipt = (extra) => ['trace', 'append', '--phase', '2', '--family', 'outcome',
  '--event', 'adjudication', '--trigger', 'plan', '--plan', '1',
  '--base', 'HEAD~1', '--sha', 'deadbee', ...extra];

test('seam: the three settled counts ride an outcome event as NUMBERS', () => {
  const dir = root();
  const r = run(dir, receipt(['--survivors', '2', '--downgraded', '1', '--refuted', '6']));
  assert.equal(r.ok, true, JSON.stringify(r));
  const [e] = lines(dir);
  assert.deepEqual([e.survivors, e.downgraded, e.refuted], [2, 1, 6]);
  // NUMBERS, for the reason `--raised` beside them is one: a reader sums these
  // without type-checking them first.
  assert.deepEqual([typeof e.survivors, typeof e.downgraded, typeof e.refuted],
    ['number', 'number', 'number']);
  assert.match(traceBytes(dir), /"survivors":2/);
});

test('seam: a settled count of 0 is a recorded figure, an absent one omits the key', () => {
  const dir = root();
  run(dir, receipt(['--survivors', '0', '--downgraded', '0', '--refuted', '9']));
  const [e] = lines(dir);
  // `0 survivors of 9` and "nobody counted" are different fires, and the key is
  // what separates them - the same distinction `--turns` and `--raised` state.
  assert.equal(e.survivors, 0);
  assert.ok('survivors' in e);

  const other = root();
  run(other, receipt([]));
  const [bare] = lines(other);
  for (const key of ['survivors', 'downgraded', 'refuted', 'round']) {
    assert.equal(key in bare, false, `${key}: ${JSON.stringify(bare)}`);
  }
});

test('seam: a malformed settled count appends NOTHING at all', () => {
  for (const flag of ['--survivors', '--downgraded', '--refuted', '--round']) {
    const dir = root();
    // No comma-grouping exception, unlike `--tokens`: a finding count is never
    // PRINTED grouped, so `1,234` is a typo rather than a transcription.
    for (const bad of ['abc', '-1', '1.5', '', '1,234']) {
      const r = run(dir, receipt([flag, bad]));
      assert.equal(r.ok, false, `${flag} ${bad}`);
      assert.equal(r.reason, 'bad-args', `${flag} ${bad}`);
      assert.equal(traceBytes(dir), null, `${flag} ${bad}`);
    }
    // `--round 0` is malformed for a flag whose rounds start at 1.
    if (flag === '--round') {
      assert.equal(run(dir, receipt([flag, '0'])).ok, false);
      assert.equal(traceBytes(dir), null);
    }
    // A bare flag (parsed as boolean true) is refused the same way.
    const r = run(dir, receipt([flag]));
    assert.equal(r.ok, false, flag);
    assert.equal(r.reason, 'bad-args', flag);
    assert.equal(traceBytes(dir), null, flag);
  }
});

test('recount: counts matching the record\'s rulings append normally', () => {
  const { repo, dir } = fireRepo();
  const written = fireRecord(repo, dir, { rulings: ['survived', 'refuted', 'downgraded', 'refuted'] });
  assert.deepEqual(written.counts, { raised: 4, survived: 1, downgraded: 1, refuted: 2 });
  const r = run(dir, receipt(['--survivors', '1', '--downgraded', '1', '--refuted', '2']));
  assert.equal(r.ok, true, JSON.stringify(r));
  const [e] = lines(dir);
  assert.deepEqual([e.survivors, e.downgraded, e.refuted], [1, 1, 2]);
});

test('recount: a --survivors one higher than the rulings is REFUSED, trace untouched', () => {
  const { repo, dir } = fireRepo();
  fireRecord(repo, dir, { rulings: ['survived', 'refuted', 'downgraded', 'refuted'] });
  // One receipt already on disk, so the assertion is that the file is
  // byte-identical afterwards rather than merely absent.
  run(dir, ['trace', 'append', '--phase', '2', '--family', 'lifecycle', '--event', 'phase_start']);
  const before = traceBytes(dir);

  const r = run(dir, receipt(['--survivors', '2', '--downgraded', '1', '--refuted', '2']));
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'count-disagreement');
  // BOTH figures named: the one typed and the one the rulings count.
  assert.match(r.detail, /--survivors says 2/);
  assert.match(r.detail, /gives 1/);
  assert.match(r.detail, /ADJUDICATION-plan-plan-1\.json/);
  assert.equal(traceBytes(dir), before);
});

test('recount: the same call against a fire with NO record appends and stores the flags', () => {
  const { dir } = fireRepo();
  // The check is a cross-artifact guard, never a requirement that a record
  // exist: a fire predating the format, and the advisory arm that writes none,
  // both reach this arm.
  const r = run(dir, receipt(['--survivors', '2', '--downgraded', '1', '--refuted', '2']));
  assert.equal(r.ok, true, JSON.stringify(r));
  const [e] = lines(dir);
  assert.deepEqual([e.survivors, e.downgraded, e.refuted], [2, 1, 2]);
});

test('recount: a partial count set is stored unchecked - there is nothing to recount', () => {
  const { repo, dir } = fireRepo();
  fireRecord(repo, dir, { rulings: ['survived', 'refuted'] });
  const r = run(dir, receipt(['--survivors', '9']));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(lines(dir)[0].survivors, 9);
});

test('recount: the ROUND decides which record is read, so a re-arm cannot pass on round one', () => {
  const { repo, dir } = fireRepo();
  // DIFFERENT rulings per round, which is what makes the round load-bearing:
  // against identical rounds a wrong resolution passes on a coincidence.
  fireRecord(repo, dir, { rulings: ['survived', 'refuted', 'refuted'] });
  fireRecord(repo, dir, { round: 2, rulings: ['downgraded', 'refuted'] });
  assert.deepEqual(
    readdirSync(join(dir, 'phases', '2')).filter((f) => f.startsWith('ADJUDICATION')).sort(),
    ['ADJUDICATION-plan-plan-1-r2.json', 'ADJUDICATION-plan-plan-1.json']);

  const two = ['--survivors', '0', '--downgraded', '1', '--refuted', '1'];
  const ok2 = run(dir, receipt([...two, '--round', '2']));
  assert.equal(ok2.ok, true, JSON.stringify(ok2));
  assert.equal(lines(dir)[0].round, 2);

  // The SAME figures with no --round resolve round ONE's record, whose rulings
  // are different - so the settle that forgot its round reddens instead of
  // passing against stale rulings.
  const before = traceBytes(dir);
  const bad = run(dir, receipt(two));
  assert.equal(bad.ok, false, JSON.stringify(bad));
  assert.equal(bad.reason, 'count-disagreement');
  assert.equal(traceBytes(dir), before);
});

test('recount: a fire with no --plan resolves its record by trigger and head sha', () => {
  const { repo, dir, head } = fireRepo();
  // `/cad-debug`, `/cad-task` and `/cad-verify` fire without a plan, and their
  // discriminator is `<command>-<short head sha>` - so the receipt matches on
  // the trigger, the round and the head the discriminator ends with.
  fireRecord(repo, dir,
    { trigger: 'risk_surface', discriminator: `cad-task-${head.slice(0, 7)}`, rulings: ['refuted'] });
  const args = ['trace', 'append', '--phase', '2', '--family', 'outcome',
    '--event', 'gate_pass', '--trigger', 'risk_surface', '--base', 'HEAD~1', '--sha', head];
  const bad = run(dir, [...args, '--survivors', '1', '--downgraded', '0', '--refuted', '0']);
  assert.equal(bad.ok, false, JSON.stringify(bad));
  assert.equal(bad.reason, 'count-disagreement');
  assert.equal(traceBytes(dir), null);

  const good = run(dir, [...args, '--survivors', '0', '--downgraded', '0', '--refuted', '1']);
  assert.equal(good.ok, true, JSON.stringify(good));
});

test('recount: a record that is not readable as JSON is refused, never appended past', () => {
  const { repo, dir } = fireRepo();
  const written = fireRecord(repo, dir, { rulings: ['survived'] });
  // Truncated or edited - which is the tampering the cross-check exists to
  // surface, so appending a figure nothing can check would bury it.
  const file = join(dir, written.record);
  writeFileSync(file, readFileSync(file, 'utf8').slice(0, 40));
  const r = run(dir, receipt(['--survivors', '1', '--downgraded', '0', '--refuted', '0']));
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-record');
  assert.equal(traceBytes(dir), null);
});

test('seam: a bare or blank --role appends NOTHING at all', () => {
  // REVERSES this row's earlier guarantee, which was that a bare `--role` wrote
  // the event with no `role` key rather than the literal `true`. Dropping the
  // key was the wrong half of the fix: measured 2026-08-19, `trace append
  // --phase 1 --family lifecycle --event dispatch --role --tokens 5` returned
  // `{"ok":true,"written":true}` and `trace render` then aggregated that
  // dispatch under the EMPTY STRING key - `"roles":{"":{"dispatches":2,...}}` -
  // so a complete-looking dispatch with a token figure landed against no role
  // at all. `--role` is a per-role JOIN KEY, which is the same thing `--step`,
  // `--reviewer` and `--trigger` are, and it now carries their disposition:
  // ARG-06/D-05 declares `bare: 'refuse'` for all four on this subcommand and
  // this body reads that declaration rather than restating it.
  const dir = root();
  for (const args of [['--role'], ['--role', ''], ['--role', '  ']]) {
    const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
      '--event', 'return', '--plan', '1', ...args]);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.equal(r.reason, 'bad-args', JSON.stringify(args));
  }
  assert.equal(traceBytes(dir), null);
});

test('seam: a bare --plan, --sha or --base still appends, key omitted', () => {
  // The OTHER half of D-05, pinned beside the refusal above so the two
  // dispositions this one body runs cannot silently collapse into each other.
  // These three declare `bare: 'fallback'`: the flag reads as absent and the
  // caller's own key-omission answers. Making them refuse would start refusing
  // every shipped `trace close` written without them.
  const dir = root();
  const closed = run(dir, ['trace', 'close', '--phase', '4', '--role', 'cad-executor',
    '--tokens', '12', '--plan']);
  assert.equal(closed.ok, true, JSON.stringify(closed));
  assert.equal(closed.written, true);
  assert.equal('plan' in lines(dir)[0], false, JSON.stringify(lines(dir)[0]));

  const appended = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'return', '--role', 'cad-executor', '--sha', '--base']);
  assert.equal(appended.ok, true, JSON.stringify(appended));
  const [, e] = lines(dir);
  assert.equal('sha' in e, false, JSON.stringify(e));
  assert.equal('base' in e, false, JSON.stringify(e));
  // The role still rides both, so this is the fallback arm and not a refusal
  // that happened to write nothing.
  assert.equal(e.role, 'cad-executor');
});

test('seam: --reviewer stores the reviewer that ACTUALLY ran, as a string', () => {
  // RVW-02: two fires of one trigger - one cross-model, one subagent - were the
  // same shape in the record. Nothing refuses a dispatch to a reviewer outside
  // the resolved set (D-07), so this field is the whole enforcement.
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', 'cad-reviewer', '--role', 'cad-reviewer',
    '--reviewer', 'claude-subagent']);
  assert.equal(r.ok, true);
  const [e] = lines(dir);
  assert.equal(e.reviewer, 'claude-subagent');
  assert.equal(typeof e.reviewer, 'string');
  // Beside `--role`, never instead of it: the role groups the worker, the
  // reviewer names which backend answered.
  assert.equal(e.role, 'cad-reviewer');
});

test('seam: a bare or blank --reviewer appends NOTHING at all', () => {
  // A bare flag parses as boolean `true` and would store the literal `true` as
  // a reviewer name - a complete-looking record naming a backend that does not
  // exist, which is worse than the missing field it was standing in for.
  const dir = root();
  for (const args of [['--reviewer'], ['--reviewer', ''], ['--reviewer', '  ']]) {
    const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
      '--event', 'dispatch', '--plan', 'cad-reviewer', '--role', 'cad-reviewer', ...args]);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.equal(r.reason, 'bad-args', JSON.stringify(args));
  }
  assert.equal(traceBytes(dir), null);
});

test('seam: --trigger stores the review trigger an event belongs to, as a string', () => {
  // GAT-04/D-12: an `outcome` receipt is only joinable to the fire that
  // produced it if the trigger it names is STRUCTURED. Measured on this
  // repository's 35 `outcome/adjudication` events the trigger is spelled four
  // different ways inside the free-text `--detail`, and lib/trace-suggest.mjs
  // discards that text entirely.
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'adjudication', '--plan', '2', '--trigger', 'risk_surface',
    '--detail', 'risk_surface plan-2: 1 survivor']);
  assert.equal(r.ok, true, JSON.stringify(r));
  const [e] = lines(dir);
  assert.equal(e.trigger, 'risk_surface');
  assert.equal(typeof e.trigger, 'string');
  // Beside `--detail`, never instead of it: the detail stays the human's line
  // and lib/trace-suggest.mjs still parses its own trigger out of it.
  assert.equal(e.detail, 'risk_surface plan-2: 1 survivor');
  assert.equal(e.plan, '2');
});

test('seam: --trigger is stored VERBATIM, trimmed, with no vocabulary of its own', () => {
  // Event-agnostic like every other flag on this seam: no coupling to an event
  // NAME and no refusal keyed to one. A trigger the seam does not recognise is
  // the caller's business, exactly as `--reviewer` treats a backend name.
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'gate_pass', '--trigger', '  risk_surface  ']);
  assert.equal(lines(dir)[0].trigger, 'risk_surface');
});

test('seam: a bare or blank --trigger appends NOTHING at all', () => {
  // A bare flag parses as boolean `true` and would store the literal `true` as
  // a trigger name - a receipt that joins to a fire nobody made, which is worse
  // than the missing field it stands in for. Nothing is appended, the rule
  // `--tokens`, `--raised` and `--reviewer` already hold.
  const dir = root();
  for (const args of [['--trigger'], ['--trigger', ''], ['--trigger', '  ']]) {
    const r = run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
      '--event', 'adjudication', '--plan', '2', ...args]);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.equal(r.reason, 'bad-args', JSON.stringify(args));
  }
  assert.equal(traceBytes(dir), null);
});

test('seam: an append with no --trigger is byte-identical to today\'s', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'adjudication', '--detail', 'plan: 2 survivors']);
  const [e] = lines(dir);
  assert.equal('trigger' in e, false, JSON.stringify(e));
});

test('seam: --read stores a comma-separated set as an array, verbatim', () => {
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', 'cad-planner', '--role', 'cad-planner',
    '--read', 'a.md,b.md,c.md']);
  assert.equal(r.ok, true);
  const rendered = run(dir, ['trace', 'render', '--phase', '4', '--events']);
  assert.deepEqual(rendered.events[0].read, ['a.md', 'b.md', 'c.md']);
});

test('seam: --read trims whitespace and drops empty segments', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', 'p', '--read', 'a.md, ,b.md,']);
  assert.deepEqual(lines(dir)[0].read, ['a.md', 'b.md']);
});

test('seam: an empty --read appends nothing', () => {
  const dir = root();
  // A bare `--read` (boolean true) and an empty string are both almost always
  // an unset `"$PATHS"`; recording a complete-looking dispatch with no
  // read-set is the failure this refusal exists against.
  for (const args of [['--read'], ['--read', ''], ['--read', ' , ,']]) {
    const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
      '--event', 'dispatch', '--plan', 'p', ...args]);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.equal(r.reason, 'bad-args', JSON.stringify(args));
  }
  assert.equal(traceBytes(dir), null);
});

test('seam: --read stores what it was handed, existence unchecked', () => {
  const dir = root();
  // The grammar admits a path, a glob, or a non-path reference the worker
  // resolves for itself - stored verbatim, with no existence check, no
  // normalization and no byte measurement.
  const set = '.planning/does-not-exist.md,.planning/phases/*/PLAN*.md,abc1234..def5678';
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', 'cad-reviewer', '--role', 'cad-reviewer',
    '--read', set]);
  assert.deepEqual(lines(dir)[0].read, set.split(','));
});

// --- trace close: the CLOSE half in one subcommand ---------------------------
//
// Ten dispatch moments used to restate two alternative `trace append` spellings
// each - twenty lines of prose stating the family and picking the event name.
// `trace close` takes both off the site: the family is fixed and the arm is
// inferred from `--detail`.

test('seam: a close with no --detail writes the `return` arm', () => {
  const dir = root();
  const r = run(dir, ['trace', 'close', '--phase', '4', '--plan', '1',
    '--role', 'cad-executor']);
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  const [e] = lines(dir);
  assert.equal(e.family, 'lifecycle');
  assert.equal(e.event, 'return');
  assert.equal(e.role, 'cad-executor');
  // The renderer counts it as a lifecycle event, which is what makes it close
  // a bracket rather than sit in the record unread.
  assert.equal(run(dir, ['trace', 'render', '--phase', '4']).counts.lifecycle, 1);
});

test('seam: a close carrying --detail writes the `checkpoint` arm', () => {
  const dir = root();
  const r = run(dir, ['trace', 'close', '--phase', '4', '--plan', '1',
    '--role', 'cad-executor', '--detail', 'x']);
  assert.equal(r.ok, true);
  const [e] = lines(dir);
  assert.equal(e.event, 'checkpoint');
  assert.equal(e.detail, 'x');
});

test('seam: a close with --tokens and no --detail is still a `return` (D-06)', () => {
  const dir = root();
  // The inference may NOT key on `--tokens`: 6 of the 10 shipped checkpoint
  // sites carry a figure and 4 do not, so a token-presence classifier would
  // bill four unusable workers as clean closes. `--detail` is the only
  // discriminator, and this is the case that proves it.
  run(dir, ['trace', 'close', '--phase', '4', '--plan', '1',
    '--role', 'cad-executor', '--tokens', '146,405']);
  const [e] = lines(dir);
  assert.equal(e.event, 'return');
  assert.equal(e.tokens, 146405);
  // ...and the mirror: a figure-carrying checkpoint stays a checkpoint.
  run(dir, ['trace', 'close', '--phase', '4', '--plan', '2',
    '--role', 'cad-executor', '--tokens', '900', '--detail', 'came back empty']);
  assert.equal(lines(dir)[1].event, 'checkpoint');
});

test('seam: a malformed --tokens on a close appends NOTHING at all', () => {
  const dir = root();
  for (const bad of ['abc', '-1', '1.5', '1,2,3']) {
    const r = run(dir, ['trace', 'close', '--phase', '4', '--plan', '1',
      '--role', 'cad-executor', '--tokens', bad]);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    // The same rail `trace append` holds: a malformed value is a malformed
    // CALL, never a best-effort append with the figure dropped.
    assert.equal(traceBytes(dir), null, bad);
  }
});

// --- the OTHER term the bill is made of: --turns (MSR-01) --------------------
//
// A run's price is turns times window, and the record carried only what a
// worker RETURNED. `--turns` is the tool-call count on the same subagent return
// `--tokens` is read off, so the two travel together at every close site.

test('seam: --turns rides a close beside --tokens, as a NUMBER', () => {
  const dir = root();
  const r = run(dir, ['trace', 'close', '--phase', '1', '--plan', '1',
    '--role', 'cad-executor', '--tokens', '12', '--turns', '83']);
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  const [e] = lines(dir);
  assert.equal(e.turns, 83);
  // A NUMBER for the same reason `--tokens` is one: the per-role render sums
  // the field without type-checking it first.
  assert.equal(typeof e.turns, 'number');
  assert.match(traceBytes(dir), /"turns":83/);
  assert.equal(e.tokens, 12);
});

test('seam: --turns lands on a `trace append` through the same shared body', () => {
  // One body serves both subcommands, so the flag cannot be validated twice and
  // cannot drift between them. `append` is where a hand-written or replayed
  // event still enters the record.
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '1', '--family', 'lifecycle',
    '--event', 'return', '--plan', '1', '--role', 'cad-planner', '--turns', '7']);
  assert.equal(r.ok, true);
  assert.equal(lines(dir)[0].turns, 7);
});

test('seam: a malformed --turns appends NOTHING at all', () => {
  const dir = root();
  // No comma-grouping exception, unlike `--tokens`: a tool-call count is never
  // PRINTED grouped, so `1,234` is a typo rather than a transcription - the
  // same rule `--raised` states.
  for (const bad of ['abc', '-1', '1.5', '', '1,234']) {
    const before = traceBytes(dir);
    const r = run(dir, ['trace', 'close', '--phase', '1', '--plan', '1',
      '--role', 'cad-executor', '--tokens', '12', '--turns', bad]);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    // Byte-identical (or still absent): a best-effort append with the count
    // dropped would render the role turn-unrecorded while the caller believed
    // a figure was recorded.
    assert.equal(traceBytes(dir), before, bad);
  }
  assert.equal(traceBytes(dir), null);
  // A bare `--turns` (parsed as boolean true) is refused the same way -
  // `requireInt` refuses a non-string, so the guard falls out of it.
  const bare = run(dir, ['trace', 'close', '--phase', '1', '--plan', '1',
    '--role', 'cad-executor', '--turns']);
  assert.equal(bare.ok, false);
  assert.equal(bare.reason, 'bad-args');
  assert.equal(traceBytes(dir), null);
});

test('seam: a close with no --turns writes no turns key at all', () => {
  const dir = root();
  run(dir, ['trace', 'close', '--phase', '1', '--plan', '1',
    '--role', 'cad-executor', '--tokens', '12']);
  const [e] = lines(dir);
  // OMITTED, never `0`: a zero would claim a dispatch that used no tools, and
  // a trace written before this flag existed must stay byte-identical.
  assert.equal('turns' in e, false, JSON.stringify(e));
});

test('seam: --turns 0 is a recorded figure, not an omission', () => {
  const dir = root();
  run(dir, ['trace', 'close', '--phase', '1', '--plan', '1',
    '--role', 'cad-executor', '--turns', '0']);
  const [e] = lines(dir);
  assert.equal(e.turns, 0);
  assert.ok('turns' in e);
  assert.match(traceBytes(dir), /"turns":0/);
});

test('seam: a close pairs with the dispatch of the same --plan', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', '1', '--role', 'cad-executor',
    '--read', '.planning/phases/4/PLAN-1.md']);
  run(dir, ['trace', 'close', '--phase', '4', '--plan', '1',
    '--role', 'cad-executor', '--tokens', '12']);
  const r = run(dir, ['trace', 'render', '--phase', '4']);
  assert.deepEqual(r.unpaired, []);
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 1, tokens: 12 } });
});

test('seam: a close with no --phase is refused and names the subcommand', () => {
  const dir = root();
  const r = run(dir, ['trace', 'close', '--plan', '1', '--role', 'cad-executor']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(String(r.detail), /trace close/);
  assert.equal(traceBytes(dir), null);
});

// --- --detail-file: the path transport for a caller-derived detail -----------
//
// `--detail "<text>"` puts the value inside a double-quoted shell word, so a
// detail carrying `$(...)` or a backtick executes before Node starts - and a
// close detail is exactly the caller-derived kind (a reviewer's verdict, a
// worker's reason for coming back). The path transport is the fix; the inline
// form stays for a human typing at a shell. The reader and its four refusals
// live in lib/text-flag-file.mjs and are unit-tested there; these rows assert
// what the SEAM does with them - above all that a refusal appends nothing.

/** A file holding `body` inside the planning root, and its path. */
function valueFile(dir, body, name = 'detail.txt') {
  const file = join(dir, name);
  writeFileSync(file, body);
  return file;
}

test('seam: --detail-file carries a detail no shell could expand', () => {
  const dir = root();
  const payload = 'reviewer said $(touch /tmp/cad-trace-should-not-exist) and `id`';
  const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'outcome',
    '--event', 'adjudication', '--detail-file', valueFile(dir, `${payload}\n`)]);
  assert.equal(r.ok, true);
  // Byte-equal to the file's trimmed contents: nothing between the file and the
  // record may touch the value.
  assert.equal(lines(dir)[0].detail, payload);
  assert.equal(existsSync('/tmp/cad-trace-should-not-exist'), false, 'the payload executed');
});

test('seam: --detail-file and --detail write the SAME record for the same value', () => {
  const dir = root();
  const text = 'came back empty';
  run(dir, ['trace', 'close', '--phase', '4', '--plan', '1', '--role', 'cad-executor',
    '--detail', text]);
  run(dir, ['trace', 'close', '--phase', '4', '--plan', '2', '--role', 'cad-executor',
    '--detail-file', valueFile(dir, text)]);
  const [inline, viaFile] = lines(dir);
  assert.equal(viaFile.detail, inline.detail);
  assert.equal(viaFile.event, inline.event);
});

test('seam: a close carrying --detail-file writes the `checkpoint` arm', () => {
  const dir = root();
  // The inference reads the RESOLVED detail. Left on `opts.detail` alone, every
  // converted checkpoint site would bill as a clean `return` - the one arm the
  // record exists to keep separate.
  const r = run(dir, ['trace', 'close', '--phase', '4', '--plan', '1',
    '--role', 'cad-executor', '--detail-file', valueFile(dir, 'blocked on a package install')]);
  assert.equal(r.ok, true);
  assert.equal(lines(dir)[0].event, 'checkpoint');
  // ...and the mirror still holds: a close carrying NEITHER form is a `return`.
  run(dir, ['trace', 'close', '--phase', '4', '--plan', '2', '--role', 'cad-executor']);
  assert.equal(lines(dir)[1].event, 'return');
});

test('seam: every --detail-file refusal is bad-args and appends NOTHING at all', () => {
  const dir = root();
  const present = valueFile(dir, 'a real detail');
  const cases = [
    // valueless: `--detail-file "$F"` with F unset parses as boolean true
    { name: 'valueless', args: ['--detail-file'] },
    { name: 'missing path', args: ['--detail-file', join(dir, 'absent.txt')] },
    { name: 'empty file', args: ['--detail-file', valueFile(dir, '\n \n', 'blank.txt')] },
    { name: 'both forms', args: ['--detail', 'from the flag', '--detail-file', present] },
  ];
  for (const c of cases) {
    const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
      '--event', 'return', '--plan', '1', ...c.args]);
    assert.equal(r.ok, false, c.name);
    assert.equal(r.reason, 'bad-args', c.name);
    assert.equal(traceBytes(dir), null, `${c.name} wrote to the record`);
  }
});

test('seam: an UNREADABLE --detail-file is refused and NAMES the read error', () => {
  const dir = root();
  const file = valueFile(dir, 'a real detail');
  chmodSync(file, 0o000);
  try {
    // Running as root defeats the mode bits; the row would then assert nothing.
    try { accessSync(file, constants.R_OK); return; } catch { /* not root, carry on */ }
    const r = run(dir, ['trace', 'close', '--phase', '4', '--plan', '1', '--detail-file', file]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(String(r.detail), /EACCES/, 'the read error was swallowed');
    assert.equal(traceBytes(dir), null);
  } finally {
    chmodSync(file, 0o600);
  }
});

// --- --read-file: the same comma grammar through the path transport ----------

test('seam: --read-file produces the identical array the same value produces inline', () => {
  const dir = root();
  const set = 'a.md, ,b.md,';
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', '1', '--read', set]);
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', '2', '--read-file', valueFile(dir, `${set}\n`, 'reads.txt')]);
  const [inline, viaFile] = lines(dir);
  // The same grammar, including the trim-and-drop of blank segments: one
  // list-builder, so the two transports cannot disagree about what an element is.
  assert.deepEqual(viaFile.read, inline.read);
  assert.deepEqual(viaFile.read, ['a.md', 'b.md']);
});

test('seam: --read-file stores a ref range and a glob verbatim, existence unchecked', () => {
  const dir = root();
  const set = '.planning/does-not-exist.md,.planning/phases/*/PLAN*.md,abc1234..def5678';
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', 'cad-reviewer', '--role', 'cad-reviewer',
    '--read-file', valueFile(dir, set, 'reads.txt')]);
  assert.deepEqual(lines(dir)[0].read, set.split(','));
});

test('seam: every --read-file refusal is bad-args and appends NOTHING at all', () => {
  const dir = root();
  const present = valueFile(dir, 'a.md,b.md', 'reads.txt');
  const cases = [
    { name: 'valueless', args: ['--read-file'] },
    { name: 'missing path', args: ['--read-file', join(dir, 'absent.txt')] },
    { name: 'empty file', args: ['--read-file', valueFile(dir, '\n \n', 'blank.txt')] },
    // The all-blank arm the inline `--read` already refuses: a file holding
    // only separators is non-empty to the reader and still names no element.
    { name: 'all-blank file', args: ['--read-file', valueFile(dir, ' , ,', 'blanks.txt')] },
    { name: 'both forms', args: ['--read', 'a.md', '--read-file', present] },
  ];
  // The unreadable arm, unless the suite runs as root (where mode bits assert
  // nothing) - built here so it rides the same nothing-was-written assertion.
  const locked = valueFile(dir, 'a.md', 'locked.txt');
  chmodSync(locked, 0o000);
  try {
    try { accessSync(locked, constants.R_OK); } catch {
      cases.push({ name: 'unreadable path', args: ['--read-file', locked] });
    }
    for (const c of cases) {
      const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
        '--event', 'dispatch', '--plan', '1', ...c.args]);
      assert.equal(r.ok, false, c.name);
      assert.equal(r.reason, 'bad-args', c.name);
      assert.equal(traceBytes(dir), null, `${c.name} wrote to the record`);
    }
  } finally {
    chmodSync(locked, 0o600);
  }
});

// --- per-role totals ----------------------------------------------------------

test('render: a fully-recorded role carries a total and NO unrecorded key', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 900 });
  const r = renderTrace(dir, 4);
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 1, tokens: 900 } });
});

test('render: a half-recorded role shows BOTH a total and an unrecorded count', () => {
  const dir = root();
  for (const n of [1, 2, 3]) {
    appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: String(n), role: 'cad-executor' });
  }
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 100 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '2', role: 'cad-executor', tokens: 200 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '3', role: 'cad-executor' });
  // A half-recorded role has no honest representation as a single number: 2 of
  // 3 dispatches reported, so 300 is a real total AND one dispatch is missing.
  assert.deepEqual(renderTrace(dir, 4).roles,
    { 'cad-executor': { dispatches: 3, tokens: 300, unrecorded: 1 } });
});

test('render: a role whose dispatches carried nothing shows no tokens key at all', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: 'cad-reviewer', role: 'cad-reviewer' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: 'cad-reviewer', role: 'cad-reviewer' });
  const row = renderTrace(dir, 4).roles['cad-reviewer'];
  // `unrecorded` is a COUNT beside an absent total, never a zero total: zero,
  // unrecorded and recorded are three different states.
  assert.deepEqual(row, { dispatches: 1, unrecorded: 1 });
  assert.equal('tokens' in row, false);
});

test('render: two roles in one phase are grouped separately', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: 'cad-planner', role: 'cad-planner' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: 'cad-planner', role: 'cad-planner', tokens: 900 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: 'cad-reviewer', role: 'cad-reviewer' });
  assert.deepEqual(renderTrace(dir, 4).roles, {
    'cad-planner': { dispatches: 1, tokens: 900 },
    'cad-reviewer': { dispatches: 1, unrecorded: 1 },
  });
});

// --- per-role TURNS, and their own unrecorded counter (MSR-01, D-03) ---------

test('render: a role\'s turn total rides beside its tokens with a counter of its own', () => {
  const dir = root();
  for (const n of [1, 2]) {
    appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: String(n), role: 'cad-executor' });
  }
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 10, turns: 4 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '2', role: 'cad-executor', tokens: 10 });
  const row = renderTrace(dir, 4).roles['cad-executor'];
  // Both dispatches reported TOKENS, so `unrecorded` is absent - and exactly
  // one reported TURNS, so the turn counter is 1. One shared counter could only
  // have said one of those two things.
  assert.deepEqual(row, { dispatches: 2, tokens: 20, turns: 4, turns_unrecorded: 1 });
  assert.equal('unrecorded' in row, false);
});

test('render: reporting tokens without turns is a different row from the reverse', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'tokens-only' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'tokens-only', tokens: 10 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '2', role: 'turns-only' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '2', role: 'turns-only', turns: 4 });
  const r = renderTrace(dir, 4);
  assert.deepEqual(r.roles['tokens-only'], { dispatches: 1, tokens: 10 });
  assert.deepEqual(r.roles['turns-only'], { dispatches: 1, turns: 4, unrecorded: 1 });
  // The whole point of the second counter: these two are not the same row, and
  // with one shared `unrecorded` they would have been.
  assert.notDeepEqual(r.roles['tokens-only'], r.roles['turns-only']);
});

test('render: a role whose every close carried no turn figure shows NO turn keys', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-planner' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-planner', tokens: 900 });
  const row = renderTrace(dir, 4).roles['cad-planner'];
  // Never a `0`, and never a `turns_unrecorded` either: a role absent from the
  // turn accounting is what makes a record written before the flag render
  // exactly as it always did (D-12).
  assert.deepEqual(row, { dispatches: 1, tokens: 900 });
  assert.equal('turns' in row, false);
  assert.equal('turns_unrecorded' in row, false);
});

test('render: a bracket carries the turn figure only where one exists', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 10, turns: 4 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '2', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '2', role: 'cad-executor', tokens: 10 });
  const [withTurns, without] = renderTrace(dir, 4).brackets;
  assert.equal(withTurns.turns, 4);
  // NO key rather than `null`: a null would put a new key on every bracket of
  // every trace written before the flag existed.
  assert.equal('turns' in without, false, JSON.stringify(without));
  assert.equal(without.tokens, 10, 'the token half of the same row is untouched');
});

test('render: a bracket falls back to a turn figure the DISPATCH half carried', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor', turns: 7 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor' });
  const [b] = renderTrace(dir, 4).brackets;
  assert.equal(b.turns, 7);
  // ...and it funds the dispatch exactly once, so the terminal cannot re-fund it.
  assert.deepEqual(renderTrace(dir, 4).roles,
    { 'cad-executor': { dispatches: 1, turns: 7, unrecorded: 1 } });
});

test('render: two closes differing ONLY in their turn count are two closes', () => {
  const dir = root();
  const at1 = '2026-08-16T10:00:00.000Z';
  const at2 = '2026-08-16T11:00:00.000Z';
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor', ts: at1 });
  const close = { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', ts: at2 };
  appendEvent(dir, { ...close, turns: 4 });
  appendEvent(dir, { ...close, turns: 5 });
  // The replay identity discriminates on the turn figure the way it already
  // does on the token figure: folding these two would drop a real figure.
  assert.deepEqual(renderTrace(dir, 4).roles,
    { 'cad-executor': { dispatches: 1, turns: 9, unrecorded: 1 } });
  // ...and the byte-identical repeat IS still a replay.
  const same = root();
  appendEvent(same, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor', ts: at1 });
  appendEvent(same, { ...close, turns: 4 });
  appendEvent(same, { ...close, turns: 4 });
  assert.deepEqual(renderTrace(same, 4).roles,
    { 'cad-executor': { dispatches: 1, turns: 4, unrecorded: 1 } });
});

test('render: a non-numeric turn figure contributes NOTHING', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  // A hand-edited or foreign-producer line: the same posture `tokens` takes,
  // never string-concatenated onto a total.
  appendFileSync(tracePath(dir), `${JSON.stringify({
    ts: '2026-08-16T10:00:00.000Z', corr: '4', phase: 4, family: 'lifecycle',
    event: 'return', plan: '1', role: 'cad-executor', turns: '4',
  })}\n`);
  const row = renderTrace(dir, 4).roles['cad-executor'];
  assert.deepEqual(row, { dispatches: 1, unrecorded: 1 });
  assert.equal('turns' in row, false);
});

test('render: tokens on checkpoint and escalation aggregate as on return', () => {
  for (const event of TERMINAL) {
    const dir = root();
    appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
    appendEvent(dir, { phase: 4, family: 'lifecycle', event, plan: '1', role: 'cad-executor', tokens: 5 });
    // A checkpointed worker did the work twice; closing on `return` alone would
    // leave exactly the runs that burned most reported as `unrecorded`.
    assert.deepEqual(renderTrace(dir, 4).roles,
      { 'cad-executor': { dispatches: 1, tokens: 5 } }, event);
  }
});

test('render: a bracket with no role lands under the "" key rather than vanishing', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', tokens: 42 });
  assert.deepEqual(renderTrace(dir, 4).roles, { '': { dispatches: 1, tokens: 42 } });
});

test('render: a phase with no lifecycle events renders an empty roles map', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'routing', event: 'resolve' });
  assert.deepEqual(renderTrace(dir, 4).roles, {});
  // ...and the seam omits the key entirely, per the absent-optionals convention.
  assert.equal('roles' in run(dir, ['trace', 'render', '--phase', '4']), false);
});

test('render: the ANCHOR event invents no role row', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: ANCHOR, sha: 'abc1234' });
  // `phase_start` is the correlation-id anchor, not a worker: keying it into
  // the role table would invent a role that never ran.
  assert.deepEqual(renderTrace(dir, 4).roles, {});
});

test('render: a string tokens value contributes 0 and counts as unrecorded', () => {
  const dir = root();
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendFileSync(tracePath(dir), `${JSON.stringify({
    corr: '4', phase: 4, ts: 'x', family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: '12345',
  })}\n`);
  // A hand-edited or foreign-producer line must never be string-concatenated
  // onto a numeric total.
  assert.deepEqual(renderTrace(dir, 4).roles, { 'cad-executor': { dispatches: 1, unrecorded: 1 } });
});

test('render: per-role grouping did not become a second pairing rule', () => {
  const dir = root();
  // Two plans, one role: pairing stays keyed on (corr, phase, plan), so both
  // brackets close, while the role table sums them into one row.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '2', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 10 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '2', role: 'cad-executor', tokens: 20 });
  const r = renderTrace(dir, 4);
  assert.deepEqual(r.unpaired, []);
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 2, tokens: 30 } });
});

test('render: a terminal is billed to the role that DISPATCHED, not its own', () => {
  const dir = root();
  // The two halves of a bracket are written by two separate prose lines, so
  // they can disagree. Billing each half to whatever it names is the worst
  // available answer: the worker that really ran reads as unmeasured while a
  // role that never dispatched carries its bill.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-reviewer', tokens: 500 });
  const r = renderTrace(dir, 4);
  assert.deepEqual(r.unpaired, []);
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 1, tokens: 500 } },
    'the dispatch role owns the figure, and the mistyped closing role invents no row');
});

test('render: a bracket closed under a DIFFERENT role is reported, not absorbed', () => {
  const dir = root();
  // The billing above is right and stays right - and it is also the reason the
  // disagreement is invisible, so the prose defect at one of the two sites
  // survives every render. `mismatched` is where it surfaces; nothing about the
  // accounting moves.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-reviewer', tokens: 500, ts: '2026-08-14T10:00:00.000Z' });
  // ...and two brackets that are NOT mismatches: one closed by the same role,
  // one whose close carries no `--role` at all. An omitted flag is already
  // visible as an unkeyed row, and reporting it here would raise a false alarm
  // on every bracket in the existing record.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '2', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '2', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '3', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'checkpoint', plan: '3' });
  const r = renderTrace(dir, 4);
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 3, tokens: 500, unrecorded: 2 } },
    'the dispatch role still owns every figure - the report changes no accounting');
  assert.deepEqual(r.mismatched, [{
    corr: '4', phase: 4, plan: '1', ts: '2026-08-14T10:00:00.000Z', event: 'return',
    dispatched: 'cad-executor', closed: 'cad-reviewer',
  }]);
});

test('seam: trace render shows mismatched only where a bracket disagreed', () => {
  const dir = root();
  const base = ['trace', 'append', '--phase', '4', '--family', 'lifecycle'];
  run(dir, [...base, '--event', 'dispatch', '--plan', '1', '--role', 'cad-executor',
    '--read', '.planning/phases/4/PLAN-1.md']);
  const clean = run(dir, ['trace', 'render', '--phase', '4']);
  assert.equal(clean.ok, true);
  assert.equal('mismatched' in clean, false,
    'a trace with nothing to report keeps the envelope every reader already parses');
  run(dir, [...base, '--event', 'return', '--plan', '1', '--role', 'cad-reviewer', '--tokens', '500']);
  const shown = run(dir, ['trace', 'render', '--phase', '4']);
  assert.deepEqual(shown.mismatched.map((m) => [m.plan, m.dispatched, m.closed]),
    [['1', 'cad-executor', 'cad-reviewer']]);
  assert.deepEqual(shown.roles, { 'cad-executor': { dispatches: 1, tokens: 500 } });
});

test('render: an UNMATCHED terminal shows its tokens but funds no dispatch', () => {
  const dir = root();
  // No dispatch to speak for it, so it falls back to its own role - and must
  // not drive any role's `unrecorded` below zero.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '7', role: 'cad-verifier', tokens: 42 });
  assert.deepEqual(renderTrace(dir, 4).roles, { 'cad-verifier': { dispatches: 0, tokens: 42 } });
});

test('render: a duplicated terminal cannot fund a second dispatch', () => {
  const dir = root();
  // Two dispatches, one genuine close, then a replayed close for the SAME
  // worker. Counting token-bearing EVENTS would report both workers funded and
  // hide the one that never came back with a figure.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '2', role: 'cad-executor' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 100 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'checkpoint', plan: '1', role: 'cad-executor', tokens: 100 });
  const r = renderTrace(dir, 4);
  assert.equal(r.unpaired.length, 1, 'plan 2 never closed');
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 2, tokens: 200, unrecorded: 1 } },
    'both figures are summed, but plan 2 stays unrecorded');
});

test('render: a REPLAYED terminal funds nothing, even with a dispatch still open', () => {
  const dir = root();
  // Both dispatches are on ONE worker key, which is where the `funded` flag
  // cannot help: the FIFO pairing hands the replay the second, genuinely open
  // dispatch and marks IT funded, so a worker that came back with no figure
  // reads as measured and the token total is billed twice.
  const at1 = '2026-08-14T10:00:00.000Z';
  const at2 = '2026-08-14T11:00:00.000Z';
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor', ts: at1 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: 'cad-executor', ts: at1 });
  const close = { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: 'cad-executor', tokens: 100, ts: at2 };
  appendEvent(dir, close);
  appendEvent(dir, close);
  const r = renderTrace(dir, 4);
  assert.deepEqual(r.roles, { 'cad-executor': { dispatches: 2, tokens: 100, unrecorded: 1 } },
    'the figure is counted ONCE and the second dispatch stays unrecorded');
  assert.deepEqual(r.unpaired.map((u) => u.plan), ['1'], 'the second dispatch never closed');
  assert.equal(r.events.length, 4, 'the replay is still reported - the render reads the file, it does not edit it');
  assert.deepEqual(r.mismatched, []);
});

test('render: a role named __proto__ is an own row, not a prototype write', () => {
  const dir = root();
  // Plain assignment of this one key hits the prototype setter, so the row
  // silently does not exist and the seam's omit-when-empty gate can drop the
  // WHOLE block - one hostile role name erasing every other role's accounting.
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '1', role: '__proto__' });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'return', plan: '1', role: '__proto__', tokens: 5 });
  appendEvent(dir, { phase: 4, family: 'lifecycle', event: 'dispatch', plan: '2', role: 'cad-executor' });
  const r = renderTrace(dir, 4);
  assert.ok(Object.prototype.hasOwnProperty.call(r.roles, '__proto__'),
    '__proto__ is an OWN property of roles');
  assert.deepEqual(r.roles['__proto__'], { dispatches: 1, tokens: 5 });
  assert.deepEqual(Object.keys(r.roles).sort(), ['__proto__', 'cad-executor'],
    'the sibling role survives - the block is not dropped');
});

test('seam: trace render surfaces the roles block through the CLI', () => {
  const dir = root();
  const base = ['trace', 'append', '--phase', '4', '--family', 'lifecycle'];
  run(dir, [...base, '--event', 'dispatch', '--plan', 'cad-planner', '--role', 'cad-planner',
    '--read', '.planning/ROADMAP.md']);
  run(dir, [...base, '--event', 'return', '--plan', 'cad-planner', '--role', 'cad-planner',
    '--tokens', '900']);
  run(dir, [...base, '--event', 'dispatch', '--plan', 'cad-reviewer', '--role', 'cad-reviewer',
    '--read', 'HEAD~1..HEAD']);
  assert.deepEqual(run(dir, ['trace', 'render', '--phase', '4']).roles, {
    'cad-planner': { dispatches: 1, tokens: 900 },
    'cad-reviewer': { dispatches: 1, unrecorded: 1 },
  });
});

// --- the producer census ------------------------------------------------------
//
// THIS IS A REGRESSION GUARD, NOT A CLOSURE. It closes no UAT item and fixes no
// defect that exists today: the tree already satisfies every assertion below, so
// a green run here is evidence that nothing REGRESSED, never evidence that
// something was repaired. Do not read it as proof that a trace was produced -
// it proves only that the producers are still WRITTEN DOWN and still speak the
// renderer's vocabulary. Whether a model obeys that prose is a UAT question and
// this test cannot reach it.
//
// What it does catch, which nothing else did: two of the four families
// (`lifecycle`, `outcome`) are written ONLY from prose surfaces, so a prose edit
// could delete their writers or rename a lifecycle event the renderer pairs on,
// and every one of the 1279 tests would stay green while `counts.lifecycle`
// silently became 0 forever. That is the D-09 shape - "a check is what makes the
// instruction's ABSENCE visible" (lib/route-relay.mjs:14-19) - applied to the
// trace's producers. The names come from lib/trace.mjs's own exports, never a
// copy, so a rename there fails here instead of drifting.

/** Every shipped prose surface a `trace append` invocation may live in. */
function proseSurfaces() {
  /** @param {string[]} parts @param {(n: string) => boolean} keep */
  const filesIn = (parts, keep) => {
    const dir = join(REPO, ...parts);
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    return entries.filter((d) => d.isFile() && keep(d.name)).map((d) => join(dir, d.name));
  };
  const md = (n) => n.endsWith('.md');
  const skillDirs = (() => {
    try {
      return readdirSync(join(REPO, 'skills'), { withFileTypes: true })
        .filter((d) => d.isDirectory()).map((d) => join(REPO, 'skills', d.name, 'SKILL.md'));
    } catch { return []; }
  })();
  return [
    ...filesIn(['cadence-core', 'workflows'], md),
    ...filesIn(['cadence-core', 'references'], md),
    ...filesIn(['agents'], md),
    ...skillDirs,
  ].filter((f) => { try { readFileSync(f, 'utf8'); return true; } catch { return false; } });
}

/**
 * The files that MUST bracket a worker, mapped to the number of dispatch
 * moments each one carries. Deliberately per-FILE, which REVERSES the note
 * `.planning/_archive-v2.5.0/1/reports/plan-2.md` left when it called a
 * per-file producer assertion "overfitting to today's file layout": the bracket
 * set stopped being an accident of layout the day it became a stated
 * requirement, so binding the test to it is now the point. A file dropping to
 * zero brackets, or `plan.md` quietly shedding one of its two, is a paid
 * dispatch whose cost never reaches the record - which a global "somebody
 * writes a dispatch somewhere" check cannot see.
 *
 * A moved dispatch moves its ROW. `plan.md` carried four until its BLOCKER
 * revision - the revision-mode planner spawn and the narrowed checker
 * re-dispatch - moved to `references/plan-revision.md`; it is 2 and 2 now, not
 * 4 and unwatched. A file absent from this map is checked by nothing, so the
 * row travels with the prose.
 */
const BRACKETING = new Map([
  [join('cadence-core', 'workflows', 'context.md'), 1],
  [join('cadence-core', 'workflows', 'plan.md'), 2],
  [join('cadence-core', 'references', 'plan-revision.md'), 2],
  [join('cadence-core', 'references', 'review-triggers.md'), 1],
  [join('cadence-core', 'workflows', 'execute.md'), 1],
  [join('cadence-core', 'workflows', 'decision-review.md'), 1],
  [join('cadence-core', 'workflows', 'minimalism-review.md'), 1],
  [join('cadence-core', 'workflows', 'verify-deep.md'), 1],
  [join('cadence-core', 'workflows', 'task.md'), 1],
]);

/**
 * The ONE close in the tree that bills the COORDINATOR rather than a subagent,
 * keyed on the FILE and the ROLE together (phase-3 D-03). `/cad-task` does its
 * work in the coordinator's own context, so there is no subagent return to read
 * `--tokens` or `--turns` off, and `lib/trace.mjs` states that an invented
 * figure is strictly worse than an absent one: it would land in `trace
 * suggest`'s share denominator and misprice every other role with it. The role
 * is half the key and not a spare word - `task.md`'s planned path may still
 * dispatch a `cad-executor`, and THAT close has a return to read, so it stays
 * under the rule.
 */
const COORDINATOR_BILLED_CLOSE = {
  where: join('cadence-core', 'workflows', 'task.md'),
  role: 'cad-task',
};

/**
 * Every `trace <verb>` INVOCATION in one text, as
 * `{family, event, plan, role, read, tokens, step, detail}`. Shell line
 * continuations are joined first so a wrapped invocation is read whole rather
 * than read as a flagless fragment.
 *
 * An invocation is a line that also names `planning.mjs`. Prose MENTIONING a
 * subcommand in backticks is not one, and the difference is load-bearing now
 * that the close half has a subcommand of its own: `seams.md` states where
 * `escalation` still lives and `plan-revision.md` states what the per-file
 * census asserts, and counting either sentence as a call would make the
 * equality below fail on prose that is exactly right.
 * @param {string} text
 * @param {'append'|'close'} verb
 */
function traceCalls(text, verb) {
  const joined = text.replace(/\\\r?\n\s*/g, ' ');
  const out = [];
  // Quoted form FIRST for --read: its value is a comma-separated list that may
  // contain spaces, and a bare `\S+` would truncate it at the first one - a
  // populated read-set would then read as a one-element one, and `--read ""`
  // would read as the two-character value `""` rather than as empty.
  const flag = (line, name, quotable) => {
    if (quotable) {
      const quoted = new RegExp(`--${name}\\s+"([^"]*)"`).exec(line);
      if (quoted) return quoted[1];
    }
    const bare = new RegExp(`--${name}\\s+(\\S+)`).exec(line);
    return bare ? bare[1] : null;
  };
  const call = new RegExp(`\\btrace\\s+${verb}\\b`);
  for (const line of joined.split('\n')) {
    if (!call.test(line) || !line.includes('planning.mjs')) continue;
    out.push({
      family: flag(line, 'family', false),
      event: flag(line, 'event', false),
      plan: flag(line, 'plan', false),
      role: flag(line, 'role', false),
      // `--read-file <path>` carries the same read-set through the path
      // transport (references/conventions.md), so it satisfies every rule
      // this census states about `--read` - the invariant is that a dispatch
      // NAMES what it caused, not which spelling named it. The fallback is
      // unambiguous because the inline reader requires whitespace after
      // `read` and so can never match `--read-file`.
      read: flag(line, 'read', true) ?? flag(line, 'read-file', false),
      tokens: flag(line, 'tokens', false),
      turns: flag(line, 'turns', false),
      step: flag(line, 'step', true),
      detail: flag(line, 'detail', true),
    });
  }
  return out;
}

test('census: every trace family has a producer, and every producer speaks the renderer\'s vocabulary', () => {
  /** @type {Map<string, string[]>} family -> the producers that write it */
  const producers = new Map(FAMILIES.map((f) => [f, []]));
  /** @type {{family: string|null, event: string|null, where: string}[]} */
  const prose = [];
  /** @type {{plan: string|null, role: string|null, tokens: string|null, detail: string|null, where: string}[]} */
  const closes = [];

  for (const file of proseSurfaces()) {
    const where = relative(REPO, file);
    const text = readFileSync(file, 'utf8');
    for (const a of traceCalls(text, 'append')) {
      prose.push({ ...a, where });
      assert.ok(a.family, `${where}: a \`trace append\` with no --family`);
      assert.ok(a.event, `${where}: a \`trace append\` with no --event`);
      assert.ok(FAMILIES.includes(String(a.family)),
        `${where}: --family ${a.family} is not one of ${FAMILIES.join(', ')}`);
      producers.get(String(a.family)).push(where);
    }
    // `trace close` states neither, by construction: the seam fixes the family
    // to `lifecycle` and picks the TERMINAL arm off `--detail`. So it is a
    // lifecycle producer on the strength of the subcommand alone, and a close
    // line that stated a family would be caught by self-verify's flag lint
    // rather than here.
    for (const c of traceCalls(text, 'close')) {
      closes.push({ ...c, where });
      producers.get('lifecycle').push(where);
    }
  }

  // The two seam producers write their family in code, not through the CLI.
  for (const seam of ['route.mjs', 'review-provider.mjs']) {
    const text = readFileSync(join(REPO, 'cadence-core', 'bin', seam), 'utf8');
    for (const m of text.matchAll(/family:\s*'([a-z_]+)'/g)) {
      assert.ok(FAMILIES.includes(m[1]),
        `cadence-core/bin/${seam}: family: '${m[1]}' is not one of ${FAMILIES.join(', ')}`);
      producers.get(m[1]).push(`cadence-core/bin/${seam}`);
    }
  }

  for (const family of FAMILIES) {
    assert.ok(producers.get(family).length > 0,
      `family \`${family}\` lost its writer - no producer left in the shipped surfaces. `
      + `Found: ${[...producers].map(([f, w]) => `${f}=[${w.join(' ')}]`).join(' ')}`);
  }

  // A lifecycle event the renderer does not know is a bracket that never pairs.
  const known = [ANCHOR, DISPATCH, ...TERMINAL, COORDINATOR];
  const lifecycle = prose.filter((p) => p.family === 'lifecycle');
  for (const p of lifecycle) {
    assert.ok(known.includes(String(p.event)),
      `${p.where}: lifecycle --event ${p.event} is not one of ${known.join(', ')}`);
  }
  // ...and a record missing any one of the three ROLES can never show a paired
  // bracket at all, so each must be written down somewhere in the prose.
  const events = lifecycle.map((p) => String(p.event));
  const found = () => `lifecycle events written down: ${events.join(', ') || '(none)'}`;
  assert.ok(events.includes(ANCHOR), `no prose producer writes the anchor \`${ANCHOR}\`. ${found()}`);
  assert.ok(events.includes(DISPATCH),
    `no prose producer writes \`${DISPATCH}\`, so no bracket ever opens. ${found()}`);
  // ...and the close half, now that no prose writes a TERMINAL event NAME at
  // all. The assertion is the same one - some producer must close a bracket or
  // none of them ever pairs - stated against the spelling that closes it. Which
  // TERMINAL member lands is the SEAM's guarantee (`--detail` present ->
  // `checkpoint`, absent -> `return`, both proved at the seam tests above), so
  // the prose can no longer get the arm wrong and there is nothing per-arm left
  // for a prose census to count.
  assert.ok(closes.length > 0,
    'no prose producer writes a `trace close`, so no bracket ever closes. '
    + `${found()}`);

  // --- per-FILE bracket coverage (see BRACKETING) -----------------------------
  //
  // Both halves are counted, and that is what makes this mean "every bracket in
  // this file is CLOSED" rather than "this file brackets something". A file
  // carrying four dispatches and three closes satisfies any presence check
  // while one bracket hangs open forever - and a hanging bracket is precisely
  // the dispatch whose cost never reaches the record.
  for (const [file, minDispatch] of BRACKETING) {
    const own = lifecycle.filter((p) => p.where === file);
    // The open half of a bracket has two spellings: a prose `--event dispatch`
    // append, and the `--bracket-read` flag riding a site's route.mjs resolve
    // (seams.md's spawn-agent routing step), which writes the same lifecycle
    // event from code. Both count as opens, or folding a site onto the resolve
    // would read here as a paid worker whose cost never reaches the record.
    const folded = (readFileSync(join(REPO, file), 'utf8')
      .match(/--bracket-read\s/g) || []).length;
    const dispatched = own.filter((p) => String(p.event) === DISPATCH).length + folded;
    const closed = closes.filter((c) => c.where === file);
    assert.ok(dispatched >= minDispatch,
      `${file}: expected at least ${minDispatch} written \`--event ${DISPATCH}\` bracket(s), `
      + `found ${dispatched}. A dispatch site with no bracket is a paid worker whose `
      + 'cost never reaches the run record.');
    // EQUALS, never "at least". The close half used to be two alternative
    // prose lines per dispatch moment - a `return` form and a `checkpoint`
    // form - so the census had to count each arm separately to notice a site
    // that lost one. `trace close` collapses those into ONE line whose arm the
    // seam picks, which makes the honest count exact: one close per dispatch
    // moment. An "at least" here would pass a mechanical conversion that left
    // both old lines as two closes, and two closes on one moment is a runtime
    // branch appending duplicate terminals - `renderTrace`'s replay guard
    // drops the byte-identical second one and PAIRS the merely-similar one,
    // funding a dispatch twice or stranding the next worker in `unpaired`.
    assert.equal(closed.length, dispatched,
      `${file}: ${dispatched} \`${DISPATCH}\` bracket(s) but ${closed.length} `
      + '`trace close` call(s). Exactly one close per dispatch moment: fewer leaves a '
      + 'paid worker unbilled, more appends a duplicate terminal.');
    // ...and ZERO raw appends of a terminal. This is the assertion that keeps
    // the eight converted files converted: putting a
    // `trace append --family lifecycle --event return` line back into any of
    // them reddens this row, whatever the counts above say. It replaces the
    // deleted per-arm counts, and it is why the FAILURE arm no longer needs
    // one of its own - a worker that burned its budget and came back unusable
    // still reaches the record because `trace close --detail` is the same
    // line as the success close, and the seam, not the prose, picks
    // `checkpoint`.
    const raw = own.filter((p) => TERMINAL.includes(String(p.event)));
    assert.deepEqual(raw.map((p) => p.event), [],
      `${file}: ${raw.length} raw \`trace append --family lifecycle --event `
      + `${TERMINAL.join('|')}\` invocation(s) left. The close half is `
      + '`trace close`; a restated raw append is the spelling this census exists to refuse.');
  }

  // --- every bracket half is keyed, and every dispatch names what it caused ---
  //
  // The terminal half of the role assertion is not decoration: terminal lines
  // are the ones carrying `--tokens`, so a prose edit dropping `--role` from a
  // terminal ALONE would file every token figure under the "" key while
  // dispatch counts stayed keyed by role - each role reported fully
  // `unrecorded` beside a nonzero unkeyed total, with the whole suite green.
  for (const c of closes) {
    assert.ok(c.role && c.role.trim(),
      `${c.where}: a \`trace close\` with no \`--role\` - its worker cannot be grouped `
      + 'into the per-role totals at all.');
    assert.ok(c.plan && c.plan.trim(),
      `${c.where}: a \`trace close\` with no \`--plan\` - the worker key is what pairs it `
      + 'with its dispatch, so without one the bracket never closes.');
    // ...and the TURN count, which is what holds the all-ten conversion (D-04)
    // mechanically. The per-file map above already requires closes to EQUAL
    // dispatches, so it sees a lost bracket - but nothing saw a site quietly
    // shedding this flag, and turns per role would then read as LOW rather than
    // as partial, which is the zero/unrecorded/recorded conflation the separate
    // `turns_unrecorded` counter exists to prevent.
    // The one STATED exception, and it is self-limiting: an exempted close must
    // carry NEITHER figure, exactly as the COORDINATOR marker block below
    // refuses `--tokens`. So this arm cannot become the door an invented number
    // walks in through, and it admits nothing but the file and role named.
    if (c.where === COORDINATOR_BILLED_CLOSE.where && c.role === COORDINATOR_BILLED_CLOSE.role) {
      assert.ok(!c.tokens,
        `${c.where}: the coordinator-billed \`${c.role}\` close carries \`--tokens ${c.tokens}\` `
        + '- a coordinator has no subagent return to read a figure off, so that number was invented.');
      assert.ok(!c.turns,
        `${c.where}: the coordinator-billed \`${c.role}\` close carries \`--turns ${c.turns}\` `
        + '- same reason as `--tokens`: the figure does not exist to report, and an `unrecorded` '
        + 'role row is the honest render.');
      continue;
    }
    assert.ok(c.turns && c.turns.trim(),
      `${c.where}: a \`trace close\` with no \`--turns\` - its dispatch's tool-call count `
      + 'never reaches the record, and the role\'s turn total then reads as low rather '
      + 'than as partial. Every close site carries it but the ONE stated exception - the '
      + `coordinator-billed \`${COORDINATOR_BILLED_CLOSE.role}\` close in `
      + `${COORDINATOR_BILLED_CLOSE.where}, which has no subagent return to read one off.`);
  }
  for (const p of lifecycle) {
    const event = String(p.event);
    if (event === ANCHOR) continue;   // the correlation-id anchor is not a worker
    if (event === COORDINATOR) continue;   // ...and neither is the coordinator
    if (event !== DISPATCH && !TERMINAL.includes(event)) continue;
    assert.ok(p.role && p.role.trim(),
      `${p.where}: \`--event ${event}\` with no \`--role\` - its worker cannot be grouped `
      + 'into the per-role totals at all.');
    if (event !== DISPATCH) continue;
    assert.ok(p.read && p.read.trim(),
      `${p.where}: \`--event ${DISPATCH}\` with an empty or absent \`--read\` - the record `
      + 'would show a dispatch that caused no reads.');
  }

  // --- the coordinator marker carries the step and nothing else ---------------
  //
  // The `--tokens` half is the static half of "no marker anywhere in this tree
  // carries a token figure": a coordinator has no subagent return to read a
  // figure off, so any number on one of these lines was invented, and an
  // invented figure lands in trace suggest's share denominator. The `--role`
  // half keeps the marker out of the per-role totals, where it would either bill
  // a worker that never ran or render a nameless row. Both are prose rules, so
  // this is where they are enforced.
  for (const p of lifecycle.filter((x) => String(x.event) === COORDINATOR)) {
    assert.ok(!p.tokens,
      `${p.where}: \`--event ${COORDINATOR}\` carrying \`--tokens ${p.tokens}\` - a coordinator `
      + 'has no subagent return to read a figure off, so that number was invented.');
    assert.ok(!p.role,
      `${p.where}: \`--event ${COORDINATOR}\` carrying \`--role ${p.role}\` - the marker is not a `
      + 'worker and must never reach the per-role totals.');
    assert.ok(p.step && p.step.trim(),
      `${p.where}: \`--event ${COORDINATOR}\` with an empty or absent \`--step\` - a marker naming `
      + 'no step defeats the per-step attribution it exists for.');
  }
});

// --- the committed fixture: what the readers say about it TODAY -------------
//
// `fixtures/verbatim.trace.jsonl` is verbatim's own run record, copied
// byte-for-byte out of a Rust project with no Cadence history and committed
// unredacted (D-12). It is the calibration input for every reader change in
// this phase, and this test is what makes "a trace written before this phase is
// unchanged in both readers" falsifiable rather than hopeful.
//
// The values are LITERALS, measured before the coordinator work landed. Deriving
// them from the fixture would be a self-comparison: it would go green on the day
// the renderer started reading the file differently, which is the one day it
// exists to fail. Scoped to phase 1 because that is the phase every acceptance
// criterion in this phase names.
//
// Two of these values are load-bearing beyond their arithmetic. The unpaired
// `cad-reviewer` row is what the read-time pre-anchor repair MOVED, and is the
// only rendered figure it moved: 17 of these events were written before the
// phase's anchor and carried the bare `1`, so their worker keys sat in a
// namespace of their own, and the 12:24:57 dispatch was stranded there. Joined
// to `1-573f325`, that dispatch pairs with the first post-anchor reviewer close
// and the 13:51:44 dispatch is the one left open instead - same count, same
// role, same tokens. Every `roles` figure above is byte-identical to what it was
// before the repair, and a changed one would mean the repair moved accounting,
// which it must not (D-06). And the one `unrecorded` reviewer dispatch is the
// bracket that contributes no span at all to any residue, because it never
// closed.

const FIXTURE = join(HERE, 'fixtures', 'verbatim.trace.jsonl');

/** The committed fixture, in a scratch planning root of its own. */
function fixtureRoot() {
  const dir = root();
  copyFileSync(FIXTURE, tracePath(dir));
  return dir;
}

test('fixture: the committed verbatim trace renders exactly as it did before this phase', () => {
  const r = renderTrace(fixtureRoot(), '1');
  assert.equal(r.corr, '1-573f325');
  assert.equal(r.capped, false);
  assert.equal(r.malformed, 0);
  assert.equal(r.events.length, 28);
  assert.deepEqual(r.counts, { routing: 8, provider: 0, lifecycle: 18, outcome: 2 });
  assert.deepEqual(r.roles, {
    'cad-assumptions-analyzer': { dispatches: 1, tokens: 75100 },
    'cad-planner': { dispatches: 1, tokens: 93882 },
    'cad-reviewer': { dispatches: 4, tokens: 297506, unrecorded: 1 },
    'cad-executor': { dispatches: 2, tokens: 423846 },
    'cad-verifier': { dispatches: 1, tokens: 78371 },
  });
  assert.deepEqual(r.unpaired, [
    { corr: '1-573f325', phase: '1', plan: 'cad-reviewer', ts: '2026-08-12T13:51:44.001Z' },
  ]);
});

// --- the coordinator's own time (D-01) ---------------------------------------
//
// The residue is what is LEFT of a step's wall span after the worker brackets
// inside it are subtracted. Every case below fixes one rule of that arithmetic
// against a hand-built trace with known durations, because a residue is a
// derived number and a derived number that nothing pins drifts silently.

const MIN = 60000;
/** An ISO timestamp `m` minutes after a fixed origin. */
const at = (m) => new Date(Date.UTC(2026, 7, 12, 10, 0, 0) + m * MIN).toISOString();
/** One coordinator marker. */
const mark = (dir, step, m, phase = 1) =>
  appendEvent(dir, { phase, family: 'lifecycle', event: COORDINATOR, step, ts: at(m) });
/** One worker bracket, opened at `a` minutes and closed at `b`. */
function bracket(dir, plan, a, b, phase = 1) {
  appendEvent(dir, { phase, family: 'lifecycle', event: DISPATCH, plan, role: plan, ts: at(a) });
  appendEvent(dir, { phase, family: 'lifecycle', event: 'return', plan, ts: at(b) });
}

test('coordinator: a step\'s residue is its wall span minus the bracket inside it', () => {
  const dir = root();
  mark(dir, 'analyze', 0);
  bracket(dir, 'cad-planner', 2, 6);          // 4 minutes of worker time
  mark(dir, 'write_plan', 10);
  appendEvent(dir, { phase: 1, family: 'outcome', event: 'gate', ts: at(12) });
  const c = renderTrace(dir, 1).coordinator;
  // Ten minutes of wall on the first step, four of them a worker's: 360000 ms
  // belong to the coordinator, and the second step runs to the phase's last
  // event with nothing dispatched inside it.
  assert.deepEqual(c.steps, [
    { phase: 1, step: 'analyze', ts: at(0), residue_ms: 6 * MIN },
    { phase: 1, step: 'write_plan', ts: at(10), residue_ms: 2 * MIN },
  ]);
  assert.equal(c.steps[0].residue_ms, 360000);
  assert.deepEqual(
    { wall_ms: c.wall_ms, bracket_ms: c.bracket_ms, residue_ms: c.residue_ms },
    { wall_ms: 12 * MIN, bracket_ms: 4 * MIN, residue_ms: 8 * MIN },
  );
});

test('coordinator: one phase spanning two corr ids is TWO coordinator streams (D-01)', () => {
  const dir = root();
  // A phase can hold more than one id even after the read-time repair: a RE-RUN
  // starts a new one. Every /cad-context marker fires before any anchor, so
  // `load_priors` joins the first anchor ahead of it and `git_guard` joins the
  // second - two ids, and each one's last marker closes at ITS OWN run's last
  // event rather than at the phase's.
  //
  // The arithmetic, and what moved it: this fixture used to report 9 minutes,
  // because `git_guard`'s window ran to the phase's newest timestamp - the
  // 9-minute routing resolve, which belongs to `1-def5678`. It now reports 6.
  // `1-abc1234` holds both markers and ends at `git_guard` itself, so
  // `load_priors` keeps its 0..6 window and `git_guard` closes at itself for a
  // zero-length one; `1-def5678` carries no marker at all and contributes
  // nothing. The pairing rule is what changed, not the clipping arithmetic.
  mark(dir, 'load_priors', 0);
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR, sha: 'abc1234', ts: at(4) });
  mark(dir, 'git_guard', 6);
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR, sha: 'def5678', ts: at(7) });
  appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve', ts: at(9) });
  const r = renderTrace(dir, 1);
  const corrs = new Set(r.events.map((e) => e.corr));
  assert.deepEqual([...corrs].sort(), ['1-abc1234', '1-def5678']);
  assert.deepEqual(r.coordinator.steps.map((s) => s.step), ['load_priors', 'git_guard']);
  // Both rows still report the PHASE they were marked in - the key moved, the
  // row's field did not.
  assert.deepEqual(r.coordinator.steps.map((s) => s.phase), [1, 1]);
  assert.deepEqual(r.coordinator.steps.map((s) => s.residue_ms), [6 * MIN, 0]);
  assert.equal(r.coordinator.residue_ms, 6 * MIN);
});

test('coordinator: two workers running at once subtract their overlap ONCE', () => {
  const dir = root();
  mark(dir, 'dispatch_plans', 0);
  bracket(dir, '1', 1, 7);
  bracket(dir, '2', 3, 9);   // overlaps the first from 3 to 7
  mark(dir, 'collect', 10);
  const c = renderTrace(dir, 1).coordinator;
  // The union is 1..9, eight minutes, not the twelve the two spans sum to.
  assert.equal(c.steps[0].residue_ms, 2 * MIN);
  assert.equal(c.bracket_ms, 8 * MIN);
  assert.equal(c.residue_ms, 2 * MIN);
});

test('coordinator: an UNPAIRED dispatch subtracts nothing', () => {
  const dir = root();
  mark(dir, 'review', 0);
  appendEvent(dir, {
    phase: 1, family: 'lifecycle', event: DISPATCH, plan: 'cad-reviewer', role: 'cad-reviewer', ts: at(2),
  });
  mark(dir, 'triage', 10);
  const r = renderTrace(dir, 1);
  assert.equal(r.unpaired.length, 1);
  // A worker that never came back has no known end, so the whole ten minutes
  // stay on the coordinator's bill rather than being written off against a
  // bracket nobody closed.
  assert.equal(r.coordinator.steps[0].residue_ms, 10 * MIN);
  assert.equal(r.coordinator.bracket_ms, 0);
});

test('coordinator: a marker with an unparseable ts contributes nothing, never NaN', () => {
  const dir = root();
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: COORDINATOR, step: 'broken', ts: 'not-a-date' });
  mark(dir, 'analyze', 0);
  bracket(dir, 'cad-planner', 1, 3);
  mark(dir, 'write_plan', 5);
  const c = renderTrace(dir, 1).coordinator;
  assert.deepEqual(c.steps.map((s) => s.step), ['analyze', 'write_plan']);
  for (const n of [c.wall_ms, c.bracket_ms, c.residue_ms]) assert.equal(Number.isFinite(n), true);
  assert.equal(c.residue_ms, 3 * MIN);
});

test('coordinator: a trace with no marker renders no coordinator block at all', () => {
  const dir = root();
  bracket(dir, 'cad-planner', 0, 4);
  const r = renderTrace(dir, 1);
  assert.equal('coordinator' in r, false);
  // And the committed fixture, which is what AC1 actually rides on.
  assert.equal('coordinator' in renderTrace(fixtureRoot(), '1'), false);
  assert.equal('coordinator' in renderTrace(fixtureRoot()), false);
});

test('seam: trace render emits the coordinator block only where markers were written', () => {
  const dir = root();
  mark(dir, 'analyze', 0);
  bracket(dir, 'cad-planner', 2, 6);
  mark(dir, 'write_plan', 10);
  const shown = run(dir, ['trace', 'render', '--phase', '1']);
  assert.equal(shown.ok, true);
  assert.equal(shown.coordinator.residue_ms, 6 * MIN);
  assert.deepEqual(shown.coordinator.steps.map((s) => s.step), ['analyze', 'write_plan']);
  const bare = run(fixtureRoot(), ['trace', 'render', '--phase', '1']);
  assert.equal(bare.ok, true);
  assert.equal('coordinator' in bare, false);
});

// --- appendEvent: a symlinked run record is refused, never followed (D-04) ---

test('appendEvent: a symlinked trace path is refused and nothing is appended', () => {
  const outside = join(mkdtempSync(join(tmpdir(), 'cad-outside-')), 'stolen.jsonl');
  writeFileSync(outside, 'ORIGINAL\n');
  const dir = root();
  symlinkSync(outside, tracePath(dir));

  const res = appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  // A reason, not a throw: the caller's envelope must not move (D-04).
  assert.deepEqual(res, { written: false, reason: 'symlinked-trace' });
  assert.equal(readFileSync(outside, 'utf8'), 'ORIGINAL\n');
  // Nothing replaced the link either - the refusal writes nowhere at all.
  assert.equal(lstatSync(tracePath(dir)).isSymbolicLink(), true);
});

test('appendEvent: an ordinary trace file still appends and reports written', () => {
  const dir = root();
  const first = appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  assert.equal(first.written, true);
  const second = appendEvent(dir, { phase: 1, family: 'routing', event: 'resolve' });
  assert.equal(second.written, true);
  assert.equal(lines(dir).length, 2);
  assert.equal(lstatSync(tracePath(dir)).isSymbolicLink(), false);
});

// --- the falsifier: a run's turns reach the record end to end (MSR-01) -------
//
// WATCHED FAILING AT 97eaf03, the tip of this plan's unpatched tree. Observed
// there:
//
//   $ node cadence-core/bin/planning.mjs --dir <tmp>/.planning \
//       trace close --phase 1 --plan 1 --role cad-executor --tokens 154523 --turns 83
//   {"ok":true,"written":true,"corr":"1"}
//
//   $ tail -1 <tmp>/.planning/trace.jsonl
//   {"corr":"1","phase":"1","ts":"...","family":"lifecycle","event":"return",
//    "plan":"1","role":"cad-executor","tokens":154523}
//
//   $ node cadence-core/bin/planning.mjs --dir <tmp>/.planning trace render --phase 1
//   ..."roles":{"cad-executor":{"dispatches":1,"tokens":154523}}...
//
// The seam ACCEPTED `--turns 83` and reported `written:true`, the line it wrote
// carries no `turns` key at all, and the render prices the dispatch by tokens
// alone. The same silence swallows a malformed value: `--turns -1` returned
// `ok:true` there, which is the assertion this test dies on first
// (`true !== false` at the `-1` case).
//
// The record priced a run from what a worker RETURNED, which is one of the two
// terms the bill is made of; the other, the tool-call count the host already
// puts on that return, was discarded at every one of the ten close sites.
//
// The case below is that absence as a check: the seams are reached through the
// CLI ONLY and nothing this plan added is imported, so against 97eaf03 it fails
// on its assertions rather than on a missing export - the unpatched seam
// silently IGNORES `--turns`, writes the close anyway, and renders a role row
// with no turn figure and no counter. To re-watch it:
// `git worktree add --detach <tmp> 97eaf03`, copy this file into that
// checkout's `cadence-core/bin/`, `node --test` it there, then remove the
// worktree.

test('falsifier: turns persist onto the close and reach both the bracket and the role row (MSR-01)', () => {
  const dir = root();
  for (const k of ['1', '2']) {
    run(dir, ['trace', 'append', '--phase', '1', '--family', 'lifecycle',
      '--event', 'dispatch', '--plan', k, '--role', 'cad-executor',
      '--read', `.planning/phases/1/PLAN-${k}.md`]);
  }

  // 1. A close carrying a turn figure is accepted and persists it.
  const closed = run(dir, ['trace', 'close', '--phase', '1', '--plan', '1',
    '--role', 'cad-executor', '--tokens', '154523', '--turns', '83']);
  assert.equal(closed.ok, true);
  assert.equal(closed.written, true);

  // 2. ...and a close carrying none is the ROUTINE case, not an error.
  const bare = run(dir, ['trace', 'close', '--phase', '1', '--plan', '2',
    '--role', 'cad-executor', '--tokens', '47717']);
  assert.equal(bare.ok, true);

  // 3. A malformed value is a malformed CALL: nothing at all is appended.
  const before = readFileSync(tracePath(dir), 'utf8');
  for (const bad of ['-1', '1.5', 'abc', '1,234']) {
    const r = run(dir, ['trace', 'close', '--phase', '1', '--plan', '3',
      '--role', 'cad-executor', '--tokens', '900', '--turns', bad]);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(readFileSync(tracePath(dir), 'utf8'), before,
      `a malformed --turns ${bad} still wrote to the record`);
  }

  const r = run(dir, ['trace', 'render', '--phase', '1']);

  // The BRACKET row carries the figure, and the figureless close carries no
  // turn key at all rather than a zero.
  assert.equal(r.brackets.length, 2);
  const [withTurns, without] = r.brackets;
  assert.equal(withTurns.turns, 83);
  assert.equal('turns' in without, false, JSON.stringify(without));

  // The ROLE row carries the total and its OWN unrecorded counter. Both
  // dispatches reported tokens, so the token `unrecorded` is absent - which is
  // the whole point of the second counter: one shared counter could not have
  // said "measured for cost, unmeasured for turns" about the same pair.
  assert.deepEqual(r.roles, {
    'cad-executor': { dispatches: 2, tokens: 202240, turns: 83, turns_unrecorded: 1 },
  });
});

// --- the falsifier: a step window closes inside its own run (MSR-04) ---------
//
// WATCHED FAILING AT d94c79d, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/trace.test.mjs
//   x falsifier: every step window closes inside the corr that opened it (MSR-04)
//     AssertionError [ERR_ASSERTION]: `commit`: a 18180000 ms window opened by
//     `1-aaa1111`, whose own record ends 120000 ms after the marker - the window
//     closed at another run's event.
//   i pass 108
//   i fail 2
//
// 18,180,000 ms is 303 minutes: run A's last marker paired with run B's last
// event, five hours of clock across a boundary nobody worked over, reported as
// coordinator time. Run A's own record ends 120,000 ms after that marker.
//
// The second failure in that run is `coordinator: one phase spanning two corr
// ids is TWO coordinator streams (D-01)`, which is the same fact read from the
// other end - the shipped fixture whose arithmetic task 1 moved from 9 minutes
// to 6 - and it is expected there.
//
// The subject is the RULE and not a figure: this repository's trace grows while
// the phase runs and no residue is ever stored, so the check asserts that no
// window outruns the tail of the `corr` that opened it, over a fixture built by
// this file's own `at`/`mark`/`bracket` helpers.
//
// To re-watch: `git worktree add --detach <tmp> d94c79d`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/trace.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
test('falsifier: every step window closes inside the corr that opened it (MSR-04)', () => {
  const dir = root();
  // Run A: its anchor, a marker, a worker bracket, the run's LAST marker, and
  // one outcome event two minutes after it.
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR, sha: 'aaa1111', ts: at(0) });
  mark(dir, 'dispatch_plans', 1);
  bracket(dir, '1', 2, 5);
  mark(dir, 'commit', 10);
  appendEvent(dir, { phase: 1, family: 'outcome', event: 'gate', ts: at(12) });
  // Five hours of clock nobody was working, then run B - a re-run filed under
  // the same phase NUMBER, which is what a phase-keyed rollup pairs run A's
  // last marker against.
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: ANCHOR, sha: 'bbb2222', ts: at(312) });
  mark(dir, 'replan', 313);
  appendEvent(dir, { phase: 1, family: 'outcome', event: 'gate', ts: at(320) });

  const r = renderTrace(dir, 1);
  const markers = r.events.filter((e) => e.family === 'lifecycle' && e.event === COORDINATOR);
  assert.equal(new Set(markers.map((m) => String(m.corr))).size, 2,
    'the fixture must hold two runs, or there is nothing here to close early');

  // The newest timestamp carrying each `corr` - the only end that run's own
  // record offers for its last marker.
  /** @type {Map<string, number>} */
  const lastByCorr = new Map();
  for (const e of r.events) {
    const t = Date.parse(e.ts);
    if (!Number.isFinite(t)) continue;
    const c = String(e.corr === undefined || e.corr === null ? '' : e.corr);
    const seen = lastByCorr.get(c);
    if (seen === undefined || t > seen) lastByCorr.set(c, t);
  }

  // The INVARIANT AC5 pins, asserted rather than a figure: the record grows
  // while this phase runs and no residue is ever stored, so a number measured
  // off the live trace would rot. A window may be shorter than its run's tail -
  // the next marker closes it - but it can never be longer, because the only
  // thing past that tail belongs to somebody else's run.
  for (const s of r.coordinator.steps) {
    const m = markers.find((x) => x.ts === s.ts && x.step === s.step);
    assert.ok(m, `no marker event behind the steps[] row ${JSON.stringify(s)}`);
    const own = lastByCorr.get(String(m.corr)) - Date.parse(m.ts);
    assert.ok(s.residue_ms <= own,
      `\`${s.step}\`: a ${s.residue_ms} ms window opened by \`${m.corr}\`, whose own `
      + `record ends ${own} ms after the marker - the window closed at another run's event.`);
  }

  // And the row that pairing rule used to stretch, named: run A's last marker
  // carries run A's own two-minute gap, not the five hours to run B's end.
  const commit = r.coordinator.steps.find((s) => s.step === 'commit');
  assert.equal(commit.residue_ms, 2 * MIN);
});


// --- one sentence per refusal, not two -----------------------------------------

// CADENCE-CENSUS: trace-refusal-sentences | asserts: each of the four refusing trace flags carries exactly one sentence across the whole planning seam
test('the four refusing trace flags carry ONE sentence each, in one map', () => {
  // The trap this pins. The dispatch door refuses these four for `trace
  // append` off the declared row, and the shared `append|close` body refuses
  // them again for the subcommands whose row does not declare them - the
  // `trace close` row deliberately declares no `--step` or `--trigger`,
  // because a flag row is a prose allowlist that never widens what a
  // subcommand accepts. Two refusers is fine; two SENTENCES is not, and a
  // second copy is what silently drifts until one side says something the
  // other does not.
  // The WHOLE seam, not the entry file: phase 4 moved the map into
  // planning/core.mjs and the 32 handlers into one module per subcommand, so a
  // read of planning.mjs alone would now find zero copies and pass by measuring
  // nothing - and would stop seeing the second copy pasted into a command
  // module, which is the drift this row exists to catch.
  const dir = new URL('./planning/', import.meta.url);
  const src = [readFileSync(new URL('./planning.mjs', import.meta.url), 'utf8')]
    .concat(readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()
      .map((f) => readFileSync(new URL(f, dir), 'utf8')))
    .join('\n');
  for (const sentence of ['needs a role name after it', 'needs a step name after it',
    'needs a reviewer name after it', 'needs a trigger name after it']) {
    const n = src.split(sentence).length - 1;
    assert.equal(n, 1, `"${sentence}" is written ${n} times across the planning seam; `
      + 'the flag->sentence map beside the dispatch door is its one home');
  }
});
