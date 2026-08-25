// Zero-dep tests for lib/capture-health.mjs - the CAPTURE.md reading behind
// `planning.mjs capture-check` and the phase-close assertion (CAP-01, CAP-03).
// Run: node --test cadence-core/bin/capture-health.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// EVERY case here is a FIXTURE, and that is not a style choice. Measured on
// this repository 2026-08-25 after the hand sweep: no `## Archive` heading and
// zero bullets carrying either annotation shape, so a check written against the
// live file passes vacuously forever. The bound-crossing pair lives in
// planning-capture-check.test.mjs, where the config layer is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureHealth } from './lib/capture-health.mjs';
import { EMPTY_CAPTURE } from './lib/capture-file.mjs';

test('a freshly created queue counts ZERO substantive bullets', () => {
  // The exact bytes `appendCapture` writes when CAPTURE.md is absent. Three
  // `- None.` placeholders are three bullets to `captureSections` and to the
  // recall walk, and must be zero here or a new project opens over its bound.
  const r = captureHealth(EMPTY_CAPTURE);
  assert.equal(r.substantive, 0);
  assert.deepEqual(r.sections, [
    { section: 'Todos', substantive: 0 },
    { section: 'Seeds', substantive: 0 },
    { section: 'Notes', substantive: 0 },
  ]);
  assert.deepEqual(r.annotations, []);
  assert.deepEqual(r.archive, { present: false, bullets: 0 });
});

test('the placeholder does not hide a real bullet beside it', () => {
  const r = captureHealth('## Todos\n\n- None.\n- [ ] (phase 2) wire the path\n\n## Seeds\n\n- None.\n');
  assert.equal(r.substantive, 1);
  assert.deepEqual(r.sections, [
    { section: 'Todos', substantive: 1 },
    { section: 'Seeds', substantive: 0 },
    { section: 'Notes', substantive: 0 },
  ]);
});

test('a checked bullet counts, and a continuation line and a `* ` line do not', () => {
  // The grammar's own definition: a column-0 `- `, an optional checkbox in any
  // state. A closed capture is still an item sitting in the queue - it is
  // resolved by REMOVAL, not by ticking its box.
  const body = [
    '## Todos',
    '',
    '- [x] the shipped one',
    '- [ ] the live one',
    '  - an indented continuation line',
    '  more prose under the bullet',
    '* a star bullet',
    '| a | table row |',
    '',
  ].join('\n');
  const r = captureHealth(body);
  assert.equal(r.substantive, 2);
});

test('an annotated bullet is named with its section, line and text', () => {
  const body = [
    '## Todos',            // 1
    '',                    // 2
    '- [ ] KEPT 2026-08-08, re-verified against the seam and still open', // 3
    '- [ ] an ordinary open item',  // 4
    '',                    // 5
    '## Seeds',            // 6
    '',                    // 7
    '- the finding was recorded not fixed, so it stays', // 8
    '',
  ].join('\n');
  const r = captureHealth(body);
  assert.equal(r.substantive, 3);
  assert.deepEqual(r.annotations, [
    { section: 'Todos', line: 3, text: 'KEPT 2026-08-08, re-verified against the seam and still open' },
    { section: 'Seeds', line: 8, text: 'the finding was recorded not fixed, so it stays' },
  ]);
});

test('an unannotated queue reports no annotation sites at all', () => {
  // The negative arm the live tree gives for free and therefore proves nothing
  // about: `kept` in ordinary prose and a date elsewhere in the sentence are
  // not an adjudication.
  const r = captureHealth('## Todos\n\n- [ ] the run kept the 2026-08-08 branch alive\n');
  assert.equal(r.substantive, 1);
  assert.deepEqual(r.annotations, []);
});

test('a `## Archive` heading is reported with its bullet count', () => {
  const body = [
    '## Todos',
    '',
    '- [ ] the live one',
    '',
    '## Archive',
    '',
    '- a settled item that never left the file',
    '- another one',
    '',
  ].join('\n');
  const r = captureHealth(body);
  assert.deepEqual(r.archive, { present: true, bullets: 2 });
  // The archived bullets are NOT substantive: the walk cannot see them, which
  // is the whole defect - they are reported instead.
  assert.equal(r.substantive, 1);
});

test('a body without the heading reports it absent, not empty', () => {
  const r = captureHealth('## Todos\n\n- [ ] the live one\n');
  assert.deepEqual(r.archive, { present: false, bullets: 0 });
});

test('a fenced heading does not mint a section, and a CRLF body counts the same', () => {
  // sectionSpan is fence-aware at BOTH ends, which is what stops a fenced
  // example of `## Seeds` inside a Todos bullet from ending the Todos section
  // early - the bug that cost this file two headings.
  const body = [
    '## Todos',
    '',
    '- [ ] the live one, whose example reads:',
    '',
    '  ```markdown',
    '## Seeds',
    '  ```',
    '',
    '- [ ] the second live one',
    '',
  ].join('\n');
  // Asserted per SECTION, not on the total: a fence-blind reader ends Todos at
  // the fenced line and hands the second bullet to a phantom `## Seeds`, which
  // leaves the TOTAL at 2 either way. The split is what tells the two apart.
  assert.deepEqual(captureHealth(body).sections, [
    { section: 'Todos', substantive: 2 },
    { section: 'Seeds', substantive: 0 },
    { section: 'Notes', substantive: 0 },
  ]);
  assert.equal(captureHealth(body.replace(/\n/g, '\r\n')).substantive, 2);
});
