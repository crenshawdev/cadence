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
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvent, correlationId, renderTrace, tracePath, MAX_TRACE_BYTES, FAMILIES,
  ANCHOR, DISPATCH, TERMINAL,
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
  const r = run(dir, ['trace', 'render', '--phase', '1']);
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

  const ten = run(dir, ['trace', 'render', '--phase', '1.10']);
  assert.equal(ten.corr, '1.10-bbb2222');
  assert.equal(ten.events.length, 1, JSON.stringify(ten.events));
  assert.equal(ten.events[0].phase, '1.10');

  const one = run(dir, ['trace', 'render', '--phase', '1.1']);
  assert.equal(one.corr, '1.1-aaa1111');
  assert.equal(one.events.length, 1, JSON.stringify(one.events));
  assert.equal(one.events[0].phase, '1.1');
});

test('seam: render on an absent trace file is ok:true with empty events', () => {
  const dir = root();
  const r = run(dir, ['trace', 'render', '--phase', '1']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.unpaired, []);
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

test('seam: a malformed --tokens appends NOTHING at all', () => {
  const dir = root();
  for (const bad of ['abc', '-1', '1.5', '']) {
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

test('seam: a bare --role writes no role key rather than the literal true', () => {
  const dir = root();
  run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'return', '--plan', '1', '--role']);
  const [e] = lines(dir);
  assert.equal('role' in e, false, JSON.stringify(e));
});

test('seam: --read stores a comma-separated set as an array, verbatim', () => {
  const dir = root();
  const r = run(dir, ['trace', 'append', '--phase', '4', '--family', 'lifecycle',
    '--event', 'dispatch', '--plan', 'cad-planner', '--role', 'cad-planner',
    '--read', 'a.md,b.md,c.md']);
  assert.equal(r.ok, true);
  const rendered = run(dir, ['trace', 'render', '--phase', '4']);
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
 * zero brackets, or `plan.md` quietly shedding three of its four, is a paid
 * dispatch whose cost never reaches the record - which a global "somebody
 * writes a dispatch somewhere" check cannot see.
 */
const BRACKETING = new Map([
  [join('cadence-core', 'workflows', 'context.md'), 1],
  [join('cadence-core', 'workflows', 'plan.md'), 4],
  [join('cadence-core', 'references', 'review-triggers.md'), 1],
  [join('cadence-core', 'workflows', 'execute.md'), 1],
  [join('cadence-core', 'workflows', 'verify-deep.md'), 1],
]);

/**
 * Every `trace append` invocation in one text, as
 * `{family, event, plan, role, read}`. Shell line continuations are joined
 * first so a wrapped invocation is read whole rather than read as a flagless
 * fragment.
 * @param {string} text
 */
function traceAppends(text) {
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
  for (const line of joined.split('\n')) {
    if (!/\btrace\s+append\b/.test(line)) continue;
    out.push({
      family: flag(line, 'family', false),
      event: flag(line, 'event', false),
      plan: flag(line, 'plan', false),
      role: flag(line, 'role', false),
      read: flag(line, 'read', true),
    });
  }
  return out;
}

test('census: every trace family has a producer, and every producer speaks the renderer\'s vocabulary', () => {
  /** @type {Map<string, string[]>} family -> the producers that write it */
  const producers = new Map(FAMILIES.map((f) => [f, []]));
  /** @type {{family: string|null, event: string|null, where: string}[]} */
  const prose = [];

  for (const file of proseSurfaces()) {
    const where = relative(REPO, file);
    for (const a of traceAppends(readFileSync(file, 'utf8'))) {
      prose.push({ ...a, where });
      assert.ok(a.family, `${where}: a \`trace append\` with no --family`);
      assert.ok(a.event, `${where}: a \`trace append\` with no --event`);
      assert.ok(FAMILIES.includes(String(a.family)),
        `${where}: --family ${a.family} is not one of ${FAMILIES.join(', ')}`);
      producers.get(String(a.family)).push(where);
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
  const known = [ANCHOR, DISPATCH, ...TERMINAL];
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
  assert.ok(events.some((e) => TERMINAL.includes(e)),
    `no prose producer writes any of ${TERMINAL.join(', ')}, so no bracket ever closes. ${found()}`);

  // --- per-FILE bracket coverage (see BRACKETING) -----------------------------
  //
  // Both halves are counted, and that is what makes this mean "every bracket in
  // this file is CLOSED" rather than "this file brackets something". A file
  // carrying four dispatches and three closes satisfies any presence check
  // while one bracket hangs open forever - and a hanging bracket is precisely
  // the dispatch whose cost never reaches the record.
  for (const [file, minDispatch] of BRACKETING) {
    const own = lifecycle.filter((p) => p.where === file);
    const dispatched = own.filter((p) => String(p.event) === DISPATCH);
    const closed = own.filter((p) => TERMINAL.includes(String(p.event)));
    assert.ok(dispatched.length >= minDispatch,
      `${file}: expected at least ${minDispatch} written \`--event ${DISPATCH}\` bracket(s), `
      + `found ${dispatched.length}. A dispatch site with no bracket is a paid worker whose `
      + 'cost never reaches the run record.');
    assert.ok(closed.length >= dispatched.length,
      `${file}: ${dispatched.length} \`${DISPATCH}\` bracket(s) but only ${closed.length} closing `
      + `event(s) (${TERMINAL.join(' / ')}). At least one bracket is left open.`);
    // ...and the PRIMARY close counted on its own. A site writes its arms as
    // alternatives - a `return` form AND a `checkpoint` form for the same one
    // dispatch - so a file with four dispatches carries eight closing lines,
    // and the count above keeps passing while a whole site loses both of its
    // arms. Every dispatch moment in every bracketing file writes exactly one
    // `return` form, so counting that form is what actually says "no bracket
    // here is left open".
    const returned = own.filter((p) => String(p.event) === 'return');
    assert.ok(returned.length >= dispatched.length,
      `${file}: ${dispatched.length} \`${DISPATCH}\` bracket(s) but only ${returned.length} `
      + '`--event return` close(s). Each dispatch moment writes its own; one of them is '
      + 'unclosed on its success path.');
    // ...and the FAILURE arm counted the same way. The two assertions above
    // both stay green when every `checkpoint` close is deleted - four
    // dispatches, four returns, four terminals - so neither of them protects
    // the arm that closes a dispatch which came back unusable. That arm is the
    // load-bearing one for this phase's whole point: a worker that burned its
    // budget and returned nothing parseable is exactly the cost that must
    // still reach the record, and its `return` form never fires.
    const checkpointed = own.filter((p) => String(p.event) === 'checkpoint');
    assert.ok(checkpointed.length >= dispatched.length,
      `${file}: ${dispatched.length} \`${DISPATCH}\` bracket(s) but only ${checkpointed.length} `
      + '`--event checkpoint` close(s). Each dispatch moment writes its own; one of them is '
      + 'unclosed on its FAILURE path, so a worker that came back unusable goes unbilled.');
  }

  // --- every bracket half is keyed, and every dispatch names what it caused ---
  //
  // The terminal half of the role assertion is not decoration: terminal lines
  // are the ones carrying `--tokens`, so a prose edit dropping `--role` from a
  // terminal ALONE would file every token figure under the "" key while
  // dispatch counts stayed keyed by role - each role reported fully
  // `unrecorded` beside a nonzero unkeyed total, with the whole suite green.
  for (const p of lifecycle) {
    const event = String(p.event);
    if (event === ANCHOR) continue;   // the correlation-id anchor is not a worker
    if (event !== DISPATCH && !TERMINAL.includes(event)) continue;
    assert.ok(p.role && p.role.trim(),
      `${p.where}: \`--event ${event}\` with no \`--role\` - its worker cannot be grouped `
      + 'into the per-role totals at all.');
    if (event !== DISPATCH) continue;
    assert.ok(p.read && p.read.trim(),
      `${p.where}: \`--event ${DISPATCH}\` with an empty or absent \`--read\` - the record `
      + 'would show a dispatch that caused no reads.');
  }
});
