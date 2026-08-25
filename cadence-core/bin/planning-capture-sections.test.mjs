// Zero-dep tests for `planning.mjs capture-sections`. Run:
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
import { writeFileSync, readFileSync, realpathSync } from 'node:fs';
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

// --- capture-sections: the out-of-walk census (AC4) --------------------------
// D-07: a STANDALONE subcommand, not a drift kind inside `status`, whose early
// returns would starve exactly the trees most likely to hold a mangled
// CAPTURE.md. D-06: unconditional, no allowlist - an `Archive` + `Debt markers`
// exemption would have reported nothing on the incident this exists for.

/** A queue with both walked and out-of-walk sections, written by hand. */
const QUEUE = '# Capture\n\n## Todos\n\n- [ ] (phase 1) live one\n- [ ] live two\n\n'
  + '## Seeds\n\n- a seed\n\n## Notes\n\n- None.\n\n'
  + '## Archive\n\n- retired a\n- retired b\n\n## Debt markers\n\n- a marker\n';

test('capture-sections: every section is named with its count and its walk membership', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'), QUEUE);
  const r = run(['capture-sections'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, true);
  assert.deepEqual(r.walk, ['Todos', 'Seeds', 'Notes']);
  assert.deepEqual(r.sections, [
    { heading: 'Todos', bullets: 2, in_walk: true },
    { heading: 'Seeds', bullets: 1, in_walk: true },
    { heading: 'Notes', bullets: 1, in_walk: true },
    { heading: 'Archive', bullets: 2, in_walk: false },
    { heading: 'Debt markers', bullets: 1, in_walk: false },
  ]);
});

test('capture-sections: a bullet appended to an out-of-walk section raises THAT count and no other (AC4)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const file = join(dir, 'CAPTURE.md');
  writeFileSync(file, QUEUE);
  const before = run(['capture-sections'], dir).sections;
  writeFileSync(file, readFileSync(file, 'utf8')
    .replace('- retired b\n', '- retired b\n- retired c\n'));
  const after = run(['capture-sections'], dir).sections;
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i].heading, before[i].heading);
    assert.equal(after[i].in_walk, before[i].in_walk);
    assert.equal(after[i].bullets, before[i].bullets + (before[i].heading === 'Archive' ? 1 : 0),
      `${before[i].heading} moved unexpectedly`);
  }
});

test('capture-sections: an absent CAPTURE.md is ok:true with no sections, never a failure', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const r = run(['capture-sections'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, false);
  assert.deepEqual(r.sections, []);
  assert.equal(r._exit, 0);
});

test('capture-sections: a VALUELESS --file is bad-args, never silently the --dir default', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'), QUEUE);
  const r = run(['capture-sections', '--file'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
});
