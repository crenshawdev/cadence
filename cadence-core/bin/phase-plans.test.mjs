// Tests for lib/phase-plans.mjs - the disk half of the computed risk floor.
// Run: node --test cadence-core/bin/phase-plans.test.mjs
//
// ONE test() per row (the route-cells.test.mjs convention), and every fixture is
// built in its own mkdtempSync directory so no row can see another's tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cursorPhase, declaredFilesIn, declaredPhaseFiles, declaredPlanFiles, phaseDirsIn,
} from './lib/phase-plans.mjs';
import { renderCursor } from './lib/planning-files.mjs';

/** A fresh planning root. `plans` is keyed `<phase>/<filename>`. */
function planningRoot(plans = {}, stateText = null) {
  const root = mkdtempSync(join(tmpdir(), 'cad-phase-plans-'));
  for (const [rel, text] of Object.entries(plans)) {
    const file = join(root, 'phases', rel);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  if (stateText !== null) writeFileSync(join(root, 'STATE.md'), stateText);
  return root;
}

/** A PLAN.md declaring exactly these frontmatter `files:` paths. */
const plan = (...files) =>
  `---\nphase: 9\nplan: 1\nrequirements:\n  - STK-03\nfiles:\n${
    files.map((f) => `  - ${f}\n`).join('')}---\n\n# Plan\n`;

// --- cursorPhase -------------------------------------------------------------

test('cursorPhase returns the cursor phase', () => {
  const root = planningRoot({}, renderCursor({
    phase: 4, total: 6, name: 'The computed floor',
    status: 'planned', next: '/cad-execute 4', updated: '2026-07-29',
  }));
  assert.equal(cursorPhase(root), 4);
});

test('cursorPhase returns a decimal phase as a Number', () => {
  const root = planningRoot({}, renderCursor({
    phase: 2.1, total: 6, name: 'Inserted',
    status: 'planned', next: '/cad-execute 2.1', updated: '2026-07-29',
  }));
  assert.equal(cursorPhase(root), 2.1);
});

test('a missing STATE.md is null, silently - the ordinary pre-project state', () => {
  assert.equal(cursorPhase(planningRoot({})), null);
  assert.equal(cursorPhase(join(tmpdir(), 'cad-no-such-root-67890')), null);
});

test('a garbled STATE.md is null, never a throw', () => {
  assert.equal(cursorPhase(planningRoot({}, '# State\n\nnot a cursor at all\n')), null);
});

// --- declaredPhaseFiles: the union face --------------------------------------

test('two conforming plans both parse: the union, found 2, clean 2', () => {
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md', 'src/a.mjs'),
    '7/PLAN-2.md': plan('src/b.mjs', 'README.md'),
  });
  const r = declaredPhaseFiles(root, 7);
  // Lexicographic file order, first occurrence kept - `README.md` is declared
  // by both plans and appears once, in PLAN-1's position.
  assert.deepEqual(r.files, ['README.md', 'src/a.mjs', 'src/b.mjs']);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 2);
});

test('a plan out of grammar contributes NO path, warns, and leaves clean below found', () => {
  // The `files:` list here PARSES - `items` comes back holding `src/a.mjs` -
  // and is still dropped whole. Salvaging the half that parsed would floor a
  // phase off a path list the grammar already rejected.
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': '---\nphase: 7\nplan: 2\nfiles:\n  - src/a.mjs\n  a line that is not a key\n---\n\n# Plan\n',
  });
  const r = declaredPhaseFiles(root, 7);
  assert.deepEqual(r.files, ['README.md']);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 1, 'clean below found is what the aggregation rule reads');
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /^risk floor: /);
  assert.match(r.warnings[0], /PLAN-2\.md/);
  assert.match(r.warnings[0], /line 6: unknown-line/);
});

test('an unreadable plan does the same: no path, one warning, clean below found', () => {
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': plan('src/b.mjs'),
  });
  chmodSync(join(root, 'phases', '7', 'PLAN-2.md'), 0o000);
  const r = declaredPhaseFiles(root, 7);
  assert.deepEqual(r.files, ['README.md']);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 1);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /^risk floor: cannot read .*PLAN-2\.md \(EACCES\)/);
  chmodSync(join(root, 'phases', '7', 'PLAN-2.md'), 0o644);
});

test('an absent phase directory is zero found and NO warning - the pre-plan state', () => {
  // Warning here would fire on every /cad-context dispatch of every project.
  const empty = declaredPhaseFiles(planningRoot({}), 7);
  assert.deepEqual(empty, { files: [], warnings: [], found: 0, clean: 0, undeclared: [] });
  const noRoot = declaredPhaseFiles(join(tmpdir(), 'cad-no-such-root-13579'), 7);
  assert.deepEqual(noRoot, { files: [], warnings: [], found: 0, clean: 0, undeclared: [] });
});

test('a phase directory holding no PLAN file is zero found, no warning, no throw', () => {
  const root = planningRoot({ '7/CONTEXT.md': '# Context\n', '7/PLAN-gaps.md': plan('src/x.mjs') });
  const r = declaredPhaseFiles(root, 7);
  // `PLAN-gaps.md` is NON-CONFORMING and is invisible here exactly as it is to
  // listPlanFiles, status, audit and executor dispatch.
  assert.deepEqual(r, { files: [], warnings: [], found: 0, clean: 0, undeclared: [] });
});

// --- a plan that declared NOTHING --------------------------------------------

test('a plan whose `files:` list is empty counts found and clean, and is named undeclared', () => {
  // The shipped cadence-core/templates/PLAN.md ships `files:` with no items, so
  // this is the state a plan copied from the template is in until someone fills
  // it - and it parsed perfectly, which is why the counts alone cannot see it.
  const root = planningRoot({ '7/PLAN-1.md': plan() });
  const r = declaredPhaseFiles(root, 7);
  assert.deepEqual(r.files, []);
  assert.equal(r.found, 1);
  assert.equal(r.clean, 1);
  assert.deepEqual(r.undeclared, [join(root, 'phases', '7', 'PLAN-1.md')]);
  assert.deepEqual(r.warnings, [], 'the judgement is the floor\'s, not this reader\'s');
});

test('a plan with no `files:` key at all takes the same arm as an empty list', () => {
  // ./planning-files.mjs answers `items: []` for a missing block, a missing key
  // and an empty list alike, and all three mean the same thing here: nothing was
  // named, so nothing was scanned.
  const root = planningRoot({
    '7/PLAN-1.md': '---\nphase: 7\nplan: 1\n---\n\n# Plan\n',
    '7/PLAN-2.md': '# Plan\n\nno frontmatter at all\n',
  });
  const r = declaredPhaseFiles(root, 7);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 2);
  assert.deepEqual(r.undeclared, [
    join(root, 'phases', '7', 'PLAN-1.md'),
    join(root, 'phases', '7', 'PLAN-2.md'),
  ]);
});

test('a plan declaring one path is NOT undeclared, even when a sibling declared it first', () => {
  // Judged before the dedup: a path PLAN-1 already contributed is still a
  // declaration by PLAN-2, and reading `files` after `seen` would report the
  // second plan as having named nothing.
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': plan('README.md'),
    '7/PLAN-3.md': plan(),
  });
  const r = declaredPhaseFiles(root, 7);
  assert.deepEqual(r.files, ['README.md']);
  assert.equal(r.clean, 3);
  assert.deepEqual(r.undeclared, [join(root, 'phases', '7', 'PLAN-3.md')]);
});

test('the named-plan face reports undeclared for the plan its key names', () => {
  const root = planningRoot({ '7/PLAN-1.md': plan(), '7/PLAN-2.md': plan('src/a.mjs') });
  const one = declaredPlanFiles(root, 7, '1');
  assert.equal(one.found, 1);
  assert.equal(one.clean, 1);
  assert.deepEqual(one.undeclared, [join(root, 'phases', '7', 'PLAN-1.md')]);
  // The sibling that DID declare is untouched by its neighbour's silence.
  assert.deepEqual(declaredPlanFiles(root, 7, '2').undeclared, []);
});

test('a plan that could not be read is NOT undeclared - it is unclean', () => {
  // The two states stay apart at this level too: an out-of-grammar plan
  // contributes no path and is not clean, so counting it as "declared nothing"
  // would let a later reader report an unreadable plan as an empty one.
  const root = planningRoot({
    '7/PLAN-1.md': '---\nphase: 7\nplan: 1\nfiles:\n  - src/a.mjs\n  not a key line\n---\n\n# Plan\n',
  });
  const r = declaredPhaseFiles(root, 7);
  assert.equal(r.found, 1);
  assert.equal(r.clean, 0);
  assert.deepEqual(r.undeclared, []);
});

test('a `- **Files:**` task line contributes nothing to either face (D-05)', () => {
  const body = '---\nphase: 7\nplan: 1\nfiles:\n  - README.md\n---\n\n# Plan\n\n'
    + '### Task 1\n\n- **Files:** src/auth/session.rs, migrations/001.sql\n';
  const root = planningRoot({ '7/PLAN-1.md': body });
  assert.deepEqual(declaredPhaseFiles(root, 7).files, ['README.md']);
  assert.deepEqual(declaredPlanFiles(root, 7, '1').files, ['README.md']);
});

// --- declaredPlanFiles: the named-plan face ----------------------------------

test('the named-plan face reads ONLY the file its key names', () => {
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': plan('src/auth/session.rs'),
  });
  const one = declaredPlanFiles(root, 7, '1');
  assert.deepEqual(one.files, ['README.md']);
  assert.deepEqual(one.warnings, []);
  assert.equal(one.found, 1);
  assert.equal(one.clean, 1);
  const two = declaredPlanFiles(root, 7, '2');
  assert.deepEqual(two.files, ['src/auth/session.rs']);
  assert.equal(two.clean, 1);
});

test('key `1` reads PLAN.md when PLAN-1.md is absent, and PLAN-1.md when it is not', () => {
  const bare = planningRoot({ '7/PLAN.md': plan('README.md') });
  assert.deepEqual(declaredPlanFiles(bare, 7, '1').files, ['README.md']);
  assert.equal(declaredPlanFiles(bare, 7, '1').found, 1);
  const both = planningRoot({ '7/PLAN.md': plan('bare.md'), '7/PLAN-1.md': plan('numbered.md') });
  assert.deepEqual(declaredPlanFiles(both, 7, '1').files, ['numbered.md']);
});

test('a key naming no plan file is found 0 with a warning - a wrong dispatch, not a pre-plan state', () => {
  const root = planningRoot({ '7/PLAN-1.md': plan('README.md') });
  const r = declaredPlanFiles(root, 7, '4');
  assert.deepEqual(r.files, []);
  assert.equal(r.found, 0);
  assert.equal(r.clean, 0);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /^risk floor: plan 4 names no plan file/);
  // A key outside the PLAN-<k>.md spelling takes the same arm rather than
  // silently widening to the phase union.
  assert.equal(declaredPlanFiles(root, 7, '1-fix').found, 0);
  // ...and so does an absent phase directory, which DOES warn here: the caller
  // named a plan and got nothing back.
  const gone = declaredPlanFiles(planningRoot({}), 7, '1');
  assert.equal(gone.found, 0);
  assert.equal(gone.warnings.length, 1, JSON.stringify(gone.warnings));
});

test('the named face carries the same two failure arms as the union', () => {
  const root = planningRoot({
    '7/PLAN-1.md': '---\nphase: 7\nplan: 1\nfiles:\n  - src/a.mjs\n  not a key line\n---\n\n# Plan\n',
  });
  const bad = declaredPlanFiles(root, 7, '1');
  assert.deepEqual(bad.files, []);
  assert.equal(bad.found, 1);
  assert.equal(bad.clean, 0);
  assert.match(bad.warnings[0], /out of grammar/);
});

// --- declaredFilesIn: the same reader, addressed by PATH ---------------------

test('the by-path reader answers exactly what the phase-keyed face does', () => {
  // The point of the split: `phases/<N>/` is one address this reader can be
  // given, and an archived `_archive-<label>/<N>/` is another. If these two ever
  // disagree there are two readers again, which is what the split removed.
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md', 'src/a.mjs'),
    '7/PLAN-2.md': plan('src/b.mjs'),
    '7/PLAN-3.md': plan(),
  });
  const byPhase = declaredPhaseFiles(root, 7);
  const byPath = declaredFilesIn(join(root, 'phases', '7'));
  assert.deepEqual(byPath, byPhase);
  assert.deepEqual(byPath.files, ['README.md', 'src/a.mjs', 'src/b.mjs']);
  assert.equal(byPath.found, 3);
  assert.equal(byPath.clean, 3);
  // ...and with a key, the named-plan face.
  assert.deepEqual(declaredFilesIn(join(root, 'phases', '7'), '2'), declaredPlanFiles(root, 7, '2'));
});

test('the by-path reader carries the out-of-grammar and unreadable arms too', () => {
  const root = planningRoot({
    '7/PLAN-1.md': '---\nphase: 7\nplan: 1\nfiles:\n  - src/a.mjs\n  not a key line\n---\n\n# Plan\n',
    '7/PLAN-2.md': plan('src/b.mjs'),
  });
  chmodSync(join(root, 'phases', '7', 'PLAN-2.md'), 0o000);
  const byPath = declaredFilesIn(join(root, 'phases', '7'));
  assert.deepEqual(byPath, declaredPhaseFiles(root, 7));
  assert.deepEqual(byPath.files, []);
  assert.equal(byPath.found, 2);
  assert.equal(byPath.clean, 0, 'one out of grammar, one unreadable: neither is clean');
  assert.equal(byPath.warnings.length, 2, JSON.stringify(byPath.warnings));
  chmodSync(join(root, 'phases', '7', 'PLAN-2.md'), 0o644);
});

test('an unreadable directory is silent for the union face and warns for a named plan', () => {
  const gone = join(tmpdir(), 'cad-no-such-dir-24680');
  assert.deepEqual(declaredFilesIn(gone),
    { files: [], warnings: [], found: 0, clean: 0, undeclared: [] });
  const named = declaredFilesIn(gone, '1');
  assert.equal(named.found, 0);
  assert.equal(named.warnings.length, 1, JSON.stringify(named.warnings));
  assert.match(named.warnings[0], /^risk floor: .*is not a readable plan directory/);
});

// --- phaseDirsIn: the locator ------------------------------------------------

test('the locator finds live and archived phase directories, in a stable order', () => {
  // `_archive-<label>/<N>/` is where `milestone-prune --mode archive` moves a
  // closed milestone's phases, and those are 27 of this repository's own 30 -
  // unreachable to a reader that joins `phases/<N>` and nothing else.
  const root = planningRoot({
    '1/PLAN.md': plan('README.md'),
    '2/PLAN-1.md': plan('src/a.mjs'),
    'notes/NOTES.md': '# not a phase\n',
  });
  for (const rel of ['1', '2']) {
    mkdirSync(join(root, '_archive-v1.0.0', rel), { recursive: true });
    writeFileSync(join(root, '_archive-v1.0.0', rel, 'PLAN.md'), plan('old.mjs'));
  }
  const found = phaseDirsIn(root);
  assert.deepEqual(found.map((e) => e.label),
    ['_archive-v1.0.0/1', '_archive-v1.0.0/2', 'phases/1', 'phases/2'],
    'a directory holding no conforming plan file - `phases/notes` - is not a phase');
  assert.deepEqual(found.map((e) => e.path), [
    join(root, '_archive-v1.0.0', '1'),
    join(root, '_archive-v1.0.0', '2'),
    join(root, 'phases', '1'),
    join(root, 'phases', '2'),
  ]);
  // The path is one a reader takes: the union face answers off it directly.
  assert.deepEqual(declaredFilesIn(found[0].path).files, ['old.mjs']);
});

test('an unreadable archive directory is skipped, never a throw', () => {
  const root = planningRoot({ '1/PLAN.md': plan('README.md') });
  mkdirSync(join(root, '_archive-v1.0.0', '1'), { recursive: true });
  writeFileSync(join(root, '_archive-v1.0.0', '1', 'PLAN.md'), plan('old.mjs'));
  chmodSync(join(root, '_archive-v1.0.0'), 0o000);
  assert.deepEqual(phaseDirsIn(root).map((e) => e.label), ['phases/1'],
    'fails OPEN: what could not be read contributes nothing and nothing throws');
  chmodSync(join(root, '_archive-v1.0.0'), 0o755);
});

test('an absent planning root is an empty list - the ordinary pre-project state', () => {
  assert.deepEqual(phaseDirsIn(join(tmpdir(), 'cad-no-such-root-97531')), []);
  assert.deepEqual(phaseDirsIn(planningRoot({})), []);
});

test('the locator does not leave the planning root through a symlink', () => {
  // Raised by the blocking `risk_surface` review on this plan's own range:
  // `readdirSync` FOLLOWS a symlinked directory, so an archive group or a phase
  // entry that is a link puts the replay in another tree, reading PLAN files
  // that are not this project's and scanning what they declare.
  const root = planningRoot({ '1/PLAN.md': plan('README.md') });
  const outside = mkdtempSync(join(tmpdir(), 'cad-outside-'));
  mkdirSync(join(outside, '1'), { recursive: true });
  writeFileSync(join(outside, '1', 'PLAN.md'), plan('secrets.mjs'));

  // A whole archive GROUP that is a link out.
  symlinkSync(outside, join(root, '_archive-escape'));
  // And one phase ENTRY that is a link out, under a real group.
  mkdirSync(join(root, '_archive-v1.0.0'), { recursive: true });
  symlinkSync(join(outside, '1'), join(root, '_archive-v1.0.0', '1'));

  assert.deepEqual(phaseDirsIn(root).map((e) => e.label), ['phases/1'],
    'neither the linked group nor the linked entry is walked, and nothing throws');
});

test('a symlink that stays INSIDE the planning root is still a phase', () => {
  // Containment is judged on what the path RESOLVES to, never on whether it is
  // a link - a project that keeps its archive behind an in-root link is a
  // legitimate layout and its phases still declare files a floor reads.
  const root = planningRoot({ '1/PLAN.md': plan('README.md') });
  mkdirSync(join(root, 'real-archive', '2'), { recursive: true });
  writeFileSync(join(root, 'real-archive', '2', 'PLAN.md'), plan('old.mjs'));
  symlinkSync(join(root, 'real-archive'), join(root, '_archive-v2.0.0'));

  assert.deepEqual(phaseDirsIn(root).map((e) => e.label),
    ['_archive-v2.0.0/2', 'phases/1']);
});
