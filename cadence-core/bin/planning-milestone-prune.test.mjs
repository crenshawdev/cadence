// Zero-dep tests for `planning.mjs milestone-prune - the seam's own --label guard, not lib/milestone-prune.mjs`. Run:
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
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run } from './planning.test.mjs';
import { archive } from './planning-recall.test.mjs';

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

// --- milestone-prune: the --label guard -----------------------------------------
// The seam's transforms and its happy paths live in milestone-prune.test.mjs;
// what is here is the argument face, which is planning.mjs's own.
//
// Reproduced 2026-08-13: `--label '../../../outside-tree'` moved phases/1 clean
// out of the planning root and answered {"ok":true,"action":"pruned"}.

function pruneTree() {
  return makeTree({
    roadmap: [{ n: 1, name: 'One', checked: true }, { n: 2, name: 'Two' }],
    phases: { 1: { plan: true }, 2: { plan: true } },
    reqs: [['REQ-1', 1, 'Complete']],
  });
}

for (const mode of ['archive', 'delete']) {
  test(`milestone-prune --mode ${mode}: a --label escaping the tree is refused before any mkdir or rename`, () => {
    const dir = pruneTree();
    const escapee = resolve(dir, '_archive-../../../outside-tree');
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const r = run(['milestone-prune', '--label', '../../../outside-tree', '--mode', mode], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /inside the planning root/);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
    assert.equal(existsSync(escapee), false, `created ${escapee} outside the planning root`);
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
  });
}

// archiveRequirements writes the label into a markdown table cell, where either
// character silently rewrites the row it lands in.
for (const [name, label] of [['a pipe', 'v2|Complete|'], ['a newline', 'v2\nrogue row'],
  ['a carriage return', 'v2\rrogue row']]) {
  test(`milestone-prune: a --label containing ${name} is refused`, () => {
    const dir = pruneTree();
    const r = run(['milestone-prune', '--label', label, '--mode', 'archive'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /"\|" or a newline/);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
  });
}

// The guard is NOT publish-decision.mjs's REMOTE_NAME shape (D-13): an untagged
// close labels the archive with the milestone NAME from PROJECT.md, spaces and
// all, so a no-spaces regex would refuse this very milestone.
test('milestone-prune: a spaced milestone-name label still prunes normally', () => {
  const dir = pruneTree();
  const label = 'the controls that reported success';
  const r = run(['milestone-prune', '--label', label, '--mode', 'archive'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'pruned');
  assert.deepEqual(r.phases, [1]);
  assert.equal(existsSync(join(dir, `_archive-${label}`, '1', 'PLAN.md')), true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['2']);
  assert.match(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), new RegExp(label));
});
