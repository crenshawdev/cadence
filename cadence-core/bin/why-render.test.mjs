// Zero-dep tests for lib/why-render.mjs - the deterministic renderer and the
// entry cap `/cad-why` (phase 1 plan 1) is built on. See that module's header
// for the design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChain, DEFAULT_TOP } from './lib/why-render.mjs';

const OLD = { sha: 'a'.repeat(40), date: '2026-01-01T00:00:00-05:00', subject: 'older commit' };
const NEW = { sha: 'b'.repeat(40), date: '2026-06-01T00:00:00-05:00', subject: 'newer commit' };

test('two entries in ascending date order render newest first', () => {
  const { text } = renderChain([OLD, NEW]);
  assert.ok(text.indexOf(NEW.sha) < text.indexOf(OLD.sha), 'the newer commit must render before the older one');
});

test('two entries sharing one commit date render in descending full-sha order, and reversal is byte-identical', () => {
  const sameDate = '2026-03-01T00:00:00-05:00';
  const low = { sha: '1'.repeat(40), date: sameDate, subject: 'low sha' };
  const high = { sha: 'f'.repeat(40), date: sameDate, subject: 'high sha' };

  const forward = renderChain([low, high]);
  const reversed = renderChain([high, low]);

  assert.equal(forward.text, reversed.text, 'reversing the input array must not change the rendered text');
  assert.ok(forward.text.indexOf(high.sha) < forward.text.indexOf(low.sha),
    'the higher full sha must render first when dates tie');
});

test('a 25-entry chain renders exactly 10 entries while total reads 25', () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({
    sha: String(i).padStart(40, '0'),
    date: new Date(2026, 0, i + 1).toISOString(),
    subject: `commit ${i}`,
  }));
  const { text, shown, total } = renderChain(entries);
  assert.equal(shown, 10);
  assert.equal(total, 25);
  assert.equal(shown, DEFAULT_TOP);
  const commitLines = text.split('\n').filter((l) => l.startsWith('commit '));
  assert.equal(commitLines.length, 10);
});

test('an entry carrying no join data renders one stated-absent line per join field', () => {
  const bare = { sha: 'c'.repeat(40), date: '2026-02-01T00:00:00-05:00', subject: 'no joins yet' };
  const { text } = renderChain([bare]);
  for (const label of ['phase', 'plan task', 'decision', 'deviation', 'review']) {
    assert.ok(text.includes(`${label}: not yet joined`), `expected a stated-absent line for ${label}`);
  }
});

test('an entry carrying join data renders its own text rather than the placeholder', () => {
  const joined = {
    sha: 'd'.repeat(40), date: '2026-04-01T00:00:00-05:00', subject: 'joined',
    phase: 'Phase 1', task: 'Task 3', decision: 'D-02', deviation: 'none logged',
    review: 'no surviving findings',
  };
  const { text } = renderChain([joined]);
  assert.ok(text.includes('phase: Phase 1'));
  assert.ok(!text.includes('phase: not yet joined'));
});
