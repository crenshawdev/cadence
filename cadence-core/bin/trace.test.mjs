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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvent, correlationId, renderTrace, tracePath, MAX_TRACE_BYTES, FAMILIES,
} from './lib/trace.mjs';

const PLANNING = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

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
  assert.equal(r.malformed, 1); // the padding line, skipped and counted
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

test('seam: render on an absent trace file is ok:true with empty events', () => {
  const dir = root();
  const r = run(dir, ['trace', 'render', '--phase', '1']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.unpaired, []);
});
