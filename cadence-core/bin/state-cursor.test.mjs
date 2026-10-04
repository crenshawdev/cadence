// Tests for lib/state-cursor.mjs, the STATE.md cursor parser the Cadence module
// loads. Run: node --test cadence-core/bin/state-cursor.test.mjs
//
// Not named planning-*: test-groups.test.mjs pins the `planning` group to
// exactly those files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCursor } from './lib/state-cursor.mjs';
import * as planningFiles from './lib/planning-files.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));

const LINES = [
  'Phase: 2.1 of 4 (Fixture phase)',
  'Status: planned',
  'Next: /cad-execute 2.1',
  'Updated: 2026-10-04',
];
const STATE = `# State\n\n${LINES.join('\n')}\n`;

test('planning-files re-exports this parseCursor, not a copy', () => {
  assert.equal(planningFiles.parseCursor, parseCursor);
});

test('parses the canonical four lines, decimal phase included', () => {
  assert.deepEqual(parseCursor(STATE), {
    phase: 2.1, total: 4, name: 'Fixture phase',
    status: 'planned', next: '/cad-execute 2.1', updated: '2026-10-04',
  });
});

test('answers null when any one of the four lines is missing', () => {
  for (let i = 0; i < LINES.length; i++) {
    const text = `# State\n\n${LINES.filter((_, j) => j !== i).join('\n')}\n`;
    assert.equal(parseCursor(text), null, `without ${LINES[i]}`);
  }
});

test('agrees with planning.mjs cursor get on a fixture STATE.md', () => {
  const root = mkdtempSync(join(tmpdir(), 'state-cursor-'));
  try {
    mkdirSync(join(root, '.planning'));
    writeFileSync(join(root, '.planning', 'STATE.md'), STATE);
    const out = execFileSync(process.execPath,
      [join(BIN, 'planning.mjs'), '--dir', join(root, '.planning'), 'cursor', 'get'],
      { encoding: 'utf8' });
    const got = JSON.parse(out);
    const parsed = parseCursor(STATE);
    assert.ok(parsed);
    for (const key of /** @type {const} */ (['phase', 'total', 'status', 'next'])) {
      assert.equal(parsed[key], got[key], key);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a Status line with a long run of inner spaces parses in linear time', () => {
  const status = `a${' '.repeat(200000)}b`;
  const text = STATE.replace('Status: planned', `Status: ${status}`);
  const t0 = performance.now();
  const cursor = parseCursor(text);
  const ms = performance.now() - t0;
  assert.ok(ms < 250, `parseCursor took ${ms.toFixed(1)} ms`);
  assert.ok(cursor);
  assert.equal(cursor.status, `Status: ${status}  `.slice('Status:'.length).trim());
  assert.equal(cursor.next, '/cad-execute 2.1');
});

test('a Next value led by a line separator parses as it did before the linear rewrite', () => {
  for (const sep of ['\u2028', '\u2029']) {
    const cursor = parseCursor(STATE.replace('Next: /cad-execute 2.1', `Next: ${sep}/cad-execute 1`));
    assert.ok(cursor);
    assert.equal(cursor.next, '/cad-execute 1');
    assert.equal(parseCursor(STATE.replace('Status: planned', `Status: ${sep}planned`))?.status, 'planned');
  }
});
