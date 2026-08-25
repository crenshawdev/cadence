// Zero-dep tests for `planning.mjs capture-check` - the report `/cad-health`
// prints and the phase close asserts against (CAP-01, CAP-03). Run:
// node --test cadence-core/bin/planning-capture-check.test.mjs
//
// FIXTURES, not the live tree. Measured on this repository 2026-08-25 after the
// hand sweep: 30 substantive walked bullets, zero annotations and no
// `## Archive` heading, so every check below would pass vacuously against the
// real file forever.
//
// The shared harness comes from planning.test.mjs and is imported, never
// copied - two copies of `makeTree` is how two fixtures drift apart. The `test`
// binding is a no-op unless this module IS the entry file.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, chmodSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run } from './planning.test.mjs';
import { EMPTY_CAPTURE } from './lib/capture-file.mjs';

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

/** A tree with a roadmap and a CAPTURE.md written verbatim. */
function tree(capture) {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  if (capture !== undefined) writeFileSync(join(dir, 'CAPTURE.md'), capture);
  return dir;
}

// A queue in the state this phase says a file should never reach: three live
// bullets, two of them settled IN PLACE with an annotation, and a section of
// retired work that never left the document. Line numbers are asserted, so the
// layout below is load-bearing.
const MANGLED = [
  '# Capture',                                                   // 1
  '',                                                            // 2
  '## Todos',                                                    // 3
  '',                                                            // 4
  '- [ ] KEPT 2026-08-08, re-verified against the seam',         // 5
  '- [ ] (phase 1) a live one',                                  // 6
  '',                                                            // 7
  '## Seeds',                                                    // 8
  '',                                                            // 9
  '- the reviewer finding was recorded not fixed',               // 10
  '',                                                            // 11
  '## Notes',                                                    // 12
  '',                                                            // 13
  '- None.',                                                     // 14
  '',                                                            // 15
  '## Archive',                                                  // 16
  '',                                                            // 17
  '- retired a',                                                 // 18
  '- retired b',                                                 // 19
  '',
].join('\n');

test('capture-check: a freshly created queue is zero, unannotated and archive-free', () => {
  // The exact bytes `appendCapture` writes when CAPTURE.md is absent. Three
  // `- None.` placeholders are three bullets to `capture-sections`, and must be
  // zero here or a new project opens over its bound on day one.
  const r = run(['capture-check'], tree(EMPTY_CAPTURE));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, true);
  assert.equal(r.substantive, 0);
  assert.deepEqual(r.sections, [
    { section: 'Todos', substantive: 0 },
    { section: 'Seeds', substantive: 0 },
    { section: 'Notes', substantive: 0 },
  ]);
  assert.deepEqual(r.annotations, []);
  assert.deepEqual(r.archive, { heading: '## Archive', present: false, bullets: 0 });
});

test('capture-check: the annotated bullets and the archived section are all named', () => {
  const r = run(['capture-check'], tree(MANGLED));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.substantive, 3);
  assert.deepEqual(r.sections, [
    { section: 'Todos', substantive: 2 },
    { section: 'Seeds', substantive: 1 },
    { section: 'Notes', substantive: 0 },
  ]);
  assert.deepEqual(r.annotations, [
    { section: 'Todos', line: 5, text: 'KEPT 2026-08-08, re-verified against the seam' },
    { section: 'Seeds', line: 10, text: 'the reviewer finding was recorded not fixed' },
  ]);
  // The archived bullets are NOT in the substantive count: the walk cannot see
  // them, which is the defect - they are reported instead of counted.
  assert.deepEqual(r.archive, { heading: '## Archive', present: true, bullets: 2 });
});

test('capture-check: an absent CAPTURE.md is an EMPTY queue, never a failure', () => {
  const r = run(['capture-check'], tree());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, false);
  assert.equal(r._exit, 0);
  // The same fields the present arm carries, so no caller branches on absence.
  assert.equal(r.substantive, 0);
  assert.deepEqual(r.annotations, []);
  assert.deepEqual(r.archive, { heading: '## Archive', present: false, bullets: 0 });
});

test('capture-check: a PRESENT but unreadable queue refuses, and says what it is not claiming', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  const dir = tree(MANGLED);
  const file = join(dir, 'CAPTURE.md');
  chmodSync(file, 0o000);
  const r = run(['capture-check'], dir);
  chmodSync(file, 0o644);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unreadable-capture');
  assert.match(r.detail, /CAPTURE\.md/);
  // A clean verdict about a file that could not be opened is the failure this
  // arm exists for, so the hint says which claims are NOT being made.
  assert.match(r.hint, /not a report that the queue is empty/);
  assert.equal(r._exit, 1);
  rmSync(file);
});

test('capture-check: a VALUELESS --file is bad-args, never silently the --dir default', () => {
  const r = run(['capture-check', '--file'], tree(MANGLED));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
});
