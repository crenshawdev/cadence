// Zero-dep tests for `planning.mjs phase-done`. Run:
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
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

// --- phase-done ----------------------------------------------------------------

test('phase-done: flips the box and the phase rows; Deferred untouched; --undo reverses', () => {
  const spec = {
    roadmap: [{ n: 1, name: 'Done' }, { n: 2, name: 'Open' }],
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Deferred'], ['REQ-3', 2, 'Pending']],
  };
  const dir = makeTree(spec);
  const r = run(['phase-done', '--n', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.roadmap.now, '[x]');
  assert.deepEqual(r.reqs, ['REQ-1']); // Deferred and other-phase rows untouched

  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 1: Done\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 2: Open\*\*/);
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-1 \| Phase 1 \| Complete /);
  assert.match(reqs, /REQ-2 \| Phase 1 \| Deferred /);
  assert.match(reqs, /REQ-3 \| Phase 2 \| Pending /);

  const u = run(['phase-done', '--n', '1', '--undo'], dir);
  assert.equal(u.roadmap.now, '[ ]');
  assert.deepEqual(u.reqs, ['REQ-1']);
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /- \[ \] \*\*Phase 1: Done\*\*/);
  assert.match(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), /REQ-1 \| Phase 1 \| Pending /);
});

test('phase-done: decimal phase flips its own box and rows only', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2.1, name: 'Hotfix' }],
    reqs: [['REQ-1', 2.1, 'Pending'], ['REQ-2', 1, 'Pending']],
  });
  const r = run(['phase-done', '--n', '2.1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reqs, ['REQ-1']);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 2\.1: Hotfix\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 1: One\*\*/);
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-1 \| Phase 2\.1 \| Complete /);
  assert.match(reqs, /REQ-2 \| Phase 1 \| Pending /);
});

test('phase-done --reqs: explicit ids override the phase filter (even Deferred)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Deferred'], ['REQ-3', 2, 'Pending']],
  });
  const r = run(['phase-done', '--n', '1', '--reqs', 'REQ-2, REQ-3'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reqs, ['REQ-2', 'REQ-3']); // exactly the named rows
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-1 \| Phase 1 \| Pending /);   // phase row NOT auto-flipped
  assert.match(reqs, /REQ-2 \| Phase 1 \| Complete /);  // Deferred flipped when named
  assert.match(reqs, /REQ-3 \| Phase 2 \| Complete /);
});

test('phase-done: valueless --reqs is bad-args, not internal (#45.1)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    reqs: [['REQ-1', 1, 'Pending']],
  });
  const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const reqsBefore = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  const r = run(['phase-done', '--n', '1', '--reqs'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.notEqual(r.reason, 'internal');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), reqsBefore);
});

// `--reqs "$IDS"` with IDS unset used to pass the shape guard and then fall
// through the truthiness test to the bulk phase-filter branch, flipping every
// non-Deferred row it was never told to touch.
for (const empty of ['', '   ', ',', ',,']) {
  test(`phase-done: --reqs "${empty}" refuses instead of flipping the phase`, () => {
    const dir = makeTree({
      roadmap: [{ n: 1, name: 'Only' }],
      reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Pending']],
    });
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const reqsBefore = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
    const r = run(['phase-done', '--n', '1', '--reqs', empty], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
    assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), reqsBefore);
  });
}

test('phase-done: --reqs names exactly the rows it flips; omitting it closes the phase', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Pending'], ['REQ-3', 1, 'Deferred']],
  });
  const named = run(['phase-done', '--n', '1', '--reqs', 'REQ-1'], dir);
  assert.equal(named.ok, true);
  assert.deepEqual(named.reqs, ['REQ-1']);

  const all = run(['phase-done', '--n', '1'], dir);
  assert.equal(all.ok, true);
  assert.deepEqual(all.reqs, ['REQ-1', 'REQ-2']); // Deferred still exempt
});

test('phase-done: unknown phase refuses; nothing written', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['phase-done', '--n', '9'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-phase');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

// `--n "$PHASE"` with PHASE unset: parseArgs mints `true`, `Number(true)` is 1,
// and phase 1 was boxed complete with its rows flipped, ok:true.
for (const [name, arg] of [['valueless', null], ['abc', 'abc'], ['empty string', '']]) {
  test(`phase-done: a ${name} --n refuses; neither doc is written`, () => {
    const dir = makeTree({
      roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
      reqs: [['REQ-1', 1, 'Pending']],
    });
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const reqsBefore = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
    const r = run(['phase-done', ...(arg === null ? ['--n'] : ['--n', arg])], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /--n/);
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
    assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), reqsBefore);
  });
}

// The guard reads `.value`, not `.raw` (D-11): a zero-padded phase must stay
// the phase it names rather than regressing to unknown-phase.
test('phase-done: --n 02 still boxes phase 2', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
    reqs: [['REQ-2', 2, 'Pending']],
  });
  const r = run(['phase-done', '--n', '02'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reqs, ['REQ-2']);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 2: Two\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 1: One\*\*/);
});

// `read()` answered null for BOTH "no REQUIREMENTS.md" and "a directory at that
// path", so an unreadable one closed the phase with its traceability rows
// silently unwritten (measured 2026-08-22: ok:true, reqs:[], the box flipped).
// The refusal has to land BEFORE the first write, so ROADMAP.md's bytes are the
// assertion - "refused" and "flipped, then reported as an error" are different
// trees. No chmodSync anywhere: it is a silent no-op under a root test runner,
// and a directory at the path is uid-independent.
test('phase-done: an unreadable REQUIREMENTS.md refuses whole; ROADMAP.md is byte-identical', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
    reqs: [['REQ-1', 1, 'Pending']],
  });
  rmSync(join(dir, 'REQUIREMENTS.md'));
  mkdirSync(join(dir, 'REQUIREMENTS.md'));
  const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
  const before = sha(join(dir, 'ROADMAP.md'));
  const r = run(['phase-done', '--n', '1'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable-requirements');
  assert.equal(r._exit, 1);
  assert.match(r.detail, /REQUIREMENTS\.md/); // names the file to repair
  assert.equal(sha(join(dir, 'ROADMAP.md')), before);
});

// The other half of the same distinction: absence is legitimate data, not a
// refusal - verify.md's phase-done step is a hard step, so a project that never
// kept a REQUIREMENTS.md must still be able to close a phase.
test('phase-done: an ABSENT REQUIREMENTS.md still boxes the phase, ok:true', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  assert.equal(existsSync(join(dir, 'REQUIREMENTS.md')), false);
  const r = run(['phase-done', '--n', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r._exit, 0);
  assert.equal(r.roadmap.now, '[x]');
  assert.deepEqual(r.reqs, []);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 1: One\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 2: Two\*\*/);
});

// The case the DIRECTORY fixture above cannot reach. A directory throws EISDIR,
// so `read()`'s catch arm alone answers it; a character device does not throw at
// all - readFileSync on /dev/null returns '', a SUCCESSFUL read of a path that
// is not a requirements document. Deciding "unreadable" from whether reading
// threw let that '' through as genuine content: the run boxed the phase, wrote
// a 0-byte regular file over the symlink and reported REQUIREMENTS.md in
// `wrote`. A FIFO is the same class and worse - it blocks the seam forever
// before any envelope - which is why the check is on the file's SHAPE, and why
// no FIFO case is driven here: a regression would hang this suite rather than
// redden it. Same defect and same fix as the CHANGELOG arm one seam over
// (`release-bump.test.mjs`, 'a NON-REGULAR CHANGELOG that reads CLEANLY').
test('phase-done: a non-regular REQUIREMENTS.md that reads CLEANLY still refuses', () => {
  if (!existsSync('/dev/null')) return;
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
    reqs: [['REQ-1', 1, 'Pending']],
  });
  rmSync(join(dir, 'REQUIREMENTS.md'));
  symlinkSync('/dev/null', join(dir, 'REQUIREMENTS.md'));
  const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
  const before = sha(join(dir, 'ROADMAP.md'));

  const r = run(['phase-done', '--n', '1'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unreadable-requirements',
    'a path that is not a regular file is unreadable, whatever readFileSync answered');
  assert.equal(r._exit, 1);
  assert.equal(sha(join(dir, 'ROADMAP.md')), before,
    'the refusal lands before the first write - the box never flipped');
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), '',
    'and the symlink target was never overwritten by a scaffolded document');
});

// The success envelope has to SAY which documents moved, on both shapes - the
// one-document run is not a failure and must not be reported by mutating
// `reqs`, so the roadmap-only arm pins `reqs` and the box in the same block: a
// future change that expresses "not written" through `reqs` reddens here.
test('phase-done: `wrote` names the documents that moved, on both shapes', () => {
  const both = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    reqs: [['REQ-1', 1, 'Pending']],
  });
  const r = run(['phase-done', '--n', '1'], both);
  assert.equal(r.ok, true);
  assert.deepEqual(r.wrote, ['ROADMAP.md', 'REQUIREMENTS.md']);

  const roadmapOnly = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const o = run(['phase-done', '--n', '1'], roadmapOnly);
  assert.equal(o.ok, true);
  assert.deepEqual(o.wrote, ['ROADMAP.md']);
  assert.deepEqual(o.reqs, []);
  assert.equal(o.roadmap.now, '[x]');
});

// --- the close ASSERTS the queue is empty (CAP-03) ---------------------------
// It does not empty it. An item leaves CAPTURE.md at the gate that declined to
// fix it; this is the check that it did, and it is a REPORT - the phase still
// closes, both documents are still written, and the report rides beside them.

/** A one-phase tree whose CAPTURE.md is written verbatim. */
function captureTree(text) {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  if (text !== undefined) writeFileSync(join(dir, 'CAPTURE.md'), text);
  return dir;
}

const TWO_LEFT = '## Todos\n\n- [ ] (phase 1) the one nobody filed\n\n'
  + '## Seeds\n\n- an idea that outlived the phase\n\n## Notes\n\n- None.\n';

test('phase-done: a non-empty queue is NAMED at close, and the phase still closes', () => {
  const dir = captureTree(TWO_LEFT);
  const r = run(['phase-done', '--n', '1'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0, 'a leftover queue is a report - the close is not refused');
  // The close really happened: the box flipped and the document was written.
  assert.equal(r.roadmap.now, '[x]');
  assert.deepEqual(r.wrote, ['ROADMAP.md']);
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /- \[x\] \*\*Phase 1:/);
  // Named, not counted: "2 items" at close names nothing anybody can act on.
  assert.equal(r.capture.substantive, 2);
  assert.deepEqual(r.capture.items, [
    { section: 'Todos', line: 3, text: '(phase 1) the one nobody filed' },
    { section: 'Seeds', line: 7, text: 'an idea that outlived the phase' },
  ]);
});

test('phase-done: a queue holding only the placeholders names nothing', () => {
  const r = run(['phase-done', '--n', '1'], captureTree(EMPTY_CAPTURE));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.capture.substantive, 0);
  assert.deepEqual(r.capture.items, []);
});

test('phase-done: an absent CAPTURE.md is an EMPTY queue, and closes cleanly', () => {
  const r = run(['phase-done', '--n', '1'], captureTree());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.roadmap.now, '[x]');
  assert.deepEqual(r.capture, { substantive: 0, items: [] });
});

test('phase-done: a queue that cannot be READ closes anyway, reported unread', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  // A phase's completion does not depend on this file being legible. The
  // REASON lives in `capture-check`, which refuses that file with a hint.
  const dir = captureTree(TWO_LEFT);
  const file = join(dir, 'CAPTURE.md');
  chmodSync(file, 0o000);
  const r = run(['phase-done', '--n', '1'], dir);
  chmodSync(file, 0o644);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.roadmap.now, '[x]');
  assert.deepEqual(r.capture, { unread: true });
});

test('phase-done --undo: reopening a phase makes NO assertion about the queue', () => {
  const dir = captureTree(TWO_LEFT);
  run(['phase-done', '--n', '1'], dir);
  const u = run(['phase-done', '--n', '1', '--undo'], dir);
  assert.equal(u.ok, true, JSON.stringify(u));
  assert.equal(u.roadmap.now, '[ ]');
  assert.equal('capture' in u, false, 'the field rides the close arm only');
});
