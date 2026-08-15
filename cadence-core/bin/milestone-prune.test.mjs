// Zero-dep tests for the milestone-prune seam: the pure transforms in
// lib/milestone-prune.mjs and the planning.mjs wrapper's I/O around them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, readFileSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneRoadmap, archiveRequirements, completedPhases } from './lib/milestone-prune.mjs';

const PLANNING = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

const ROADMAP = `# Roadmap: Fixture

## Overview

Prose that must survive byte-identical.

## Phases

- [x] **Phase 1: Store** - the archive
- [x] **Phase 2.1: Patch** - a decimal insertion
- [ ] **Phase 3: Recall** - stays open

## Phase Details

### Phase 1: Store
**Goal:** Hold bytes.
**Requirements:** STOR-01

### Phase 2.1: Patch
**Goal:** Fix the store.
**Requirements:** STOR-02

### Phase 3: Recall
**Goal:** Find bytes.
**Requirements:** REC-01
`;

const REQUIREMENTS = `# Requirements: Fixture

## Active

- **STOR-01**: bytes survive
- **STOR-02**: the patch holds
- **REC-01**: bytes are findable

## Out of Scope

- Sync.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 2.1 | Complete |
| REC-01 | Phase 3 | Pending |
`;

// --- the pure transforms -----------------------------------------------------

test('completedPhases reads only the checked boxes', () => {
  assert.deepEqual(completedPhases(ROADMAP), [1, 2.1]);
});

test('pruneRoadmap removes checked lines and their detail sections, nothing else', () => {
  const r = pruneRoadmap(ROADMAP, [1, 2.1]);
  assert.equal(r.removedLines, 2);
  assert.equal(r.removedSections, 2);
  assert.deepEqual(r.missingSections, []);
  assert.ok(!r.text.includes('Phase 1: Store'));
  assert.ok(!r.text.includes('Phase 2.1: Patch'));
  assert.ok(!r.text.includes('Hold bytes'));
  // The open phase survives whole: line, section, and the section heading.
  assert.ok(r.text.includes('- [ ] **Phase 3: Recall**'));
  assert.ok(r.text.includes('### Phase 3: Recall'));
  assert.ok(r.text.includes('**Goal:** Find bytes.'));
  assert.ok(r.text.includes('## Phase Details'));
  assert.ok(r.text.includes('Prose that must survive byte-identical.'));
});

test('a decimal phase is matched exactly - 2.1 never consumes 21 or 291', () => {
  const road = ROADMAP.replace('- [ ] **Phase 3: Recall** - stays open',
    '- [x] **Phase 21: Wide** - checked\n- [ ] **Phase 3: Recall** - stays open');
  const r = pruneRoadmap(road, [2.1]);
  assert.ok(r.text.includes('**Phase 21: Wide**'), 'Phase 21 must survive a 2.1 prune');
  assert.ok(!r.text.includes('**Phase 2.1: Patch**'));
});

test('a phase with no detail section is reported, not invented', () => {
  const r = pruneRoadmap(ROADMAP.replace('### Phase 1: Store\n**Goal:** Hold bytes.\n**Requirements:** STOR-01\n\n', ''), [1]);
  assert.deepEqual(r.missingSections, [1]);
  assert.equal(r.removedLines, 1);
});

test('archiveRequirements moves shipped rows to a created ## Shipped and cleans both sources', () => {
  const r = archiveRequirements(REQUIREMENTS, [1, 2.1], 'v1.2.0');
  assert.equal(r.createdSection, true);
  assert.deepEqual(r.moved, [{ id: 'STOR-01', phase: 1 }, { id: 'STOR-02', phase: 2.1 }]);
  // Landed rows carry the bullet summary, the phase, and the label.
  assert.ok(r.text.includes('| STOR-01 (bytes survive) | 1 | Complete | v1.2.0 |'));
  assert.ok(r.text.includes('| STOR-02 (the patch holds) | 2.1 | Complete | v1.2.0 |'));
  // Sources are clean; the unshipped requirement is untouched in both places.
  assert.ok(!r.text.includes('- **STOR-01**:'));
  assert.ok(!r.text.includes('| STOR-01 | Phase 1 |'));
  assert.ok(r.text.includes('- **REC-01**: bytes are findable'));
  assert.ok(r.text.includes('| REC-01 | Phase 3 | Pending |'));
  // The created section sits before ## Out of Scope (right after Active's span).
  assert.ok(r.text.indexOf('## Shipped') < r.text.indexOf('## Out of Scope'));
});

test('an existing ## Shipped table is appended to, never duplicated', () => {
  const first = archiveRequirements(REQUIREMENTS, [1], 'v1.0.0');
  const second = archiveRequirements(first.text, [2.1], 'v1.1.0');
  assert.equal(second.createdSection, false);
  assert.equal(second.text.match(/^## Shipped$/gm).length, 1);
  const one = second.text.indexOf('| STOR-01');
  const two = second.text.indexOf('| STOR-02');
  assert.ok(one !== -1 && two !== -1 && one < two, 'appended after the existing row');
});

test('no shipped rows means no text change at all', () => {
  const r = archiveRequirements(REQUIREMENTS, [9], 'v9');
  assert.equal(r.text, REQUIREMENTS);
  assert.deepEqual(r.moved, []);
});

// A completed phase carrying one Complete row and one Deferred row - the shape
// that made the audit command report a deliberate hold as a delivery.
const HELD = `# Requirements: Fixture

## Active

- **STOR-01**: bytes survive
- **HELD-01**: held back for the next cycle

## Deferred

- **HELD-01**: deliberately not shipped this cycle

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| HELD-01 | Phase 1 | Deferred |
`;

test('archiveRequirements never ships a Deferred row, whatever phase it names', () => {
  const r = archiveRequirements(HELD, [1], 'v9.9.0');
  // Only the Complete row moves; the held one is not in `moved` at all.
  assert.deepEqual(r.moved, [{ id: 'STOR-01', phase: 1 }]);
  assert.ok(r.text.includes('| STOR-01 (bytes survive) | 1 | Complete | v9.9.0 |'));
  assert.ok(!/^\| HELD-01.*\| Complete \|/m.test(r.text),
    'a Deferred row must never land under ## Shipped as Complete');
  // It keeps its Traceability row, its status, and its Active bullet.
  assert.ok(r.text.includes('| HELD-01 | Phase 1 | Deferred |'));
  assert.ok(r.text.includes('- **HELD-01**: held back for the next cycle'));
  // ...and its Deferred bullet survives the prune byte-identical.
  assert.ok(r.text.includes('- **HELD-01**: deliberately not shipped this cycle'));
});

/** A shipped-eligible id carrying a bullet under `## Active` AND a
 *  differently-worded one under a later hold section, whose heading name is the
 *  parameter - this repo spells it `## Deferred`, the shipped template spells
 *  it `## v2 Requirements`, and the bound is by placement so both hold. */
const twoBullets = (holdHeading) => `# Requirements: Fixture

## Active

- **STOR-01**: bytes survive

${holdHeading}

- **STOR-01**: a v2 rewrite of the store, not this milestone

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
`;

for (const heading of ['## Deferred', '## v2 Requirements']) {
  test(`the Active-bullet scan is bounded to ## Active, not the whole file (${heading})`, () => {
    const src = twoBullets(heading);
    const r = archiveRequirements(src, [1], 'v9.9.0');
    // The hold section's bullet is untouched...
    assert.ok(r.text.includes('- **STOR-01**: a v2 rewrite of the store, not this milestone'),
      'a bullet outside ## Active is somebody else\'s data');
    assert.ok(r.text.includes(heading));
    // ...the Active one is gone...
    assert.ok(!r.text.includes('- **STOR-01**: bytes survive'));
    // ...and the shipped row's summary is the ACTIVE wording, not the one the
    // second `summaries.set` used to overwrite it with.
    assert.ok(r.text.includes('| STOR-01 (bytes survive) | 1 | Complete | v9.9.0 |'));
  });
}

test('no ## Active heading: no bullet removed, no summary captured, the row still ships', () => {
  const noActive = `# Requirements: Fixture

## Backlog

- **STOR-01**: bytes survive

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
`;
  const r = archiveRequirements(noActive, [1], 'v9.9.0');
  assert.ok(r.text.includes('- **STOR-01**: bytes survive'), 'the out-of-section bullet stays');
  assert.ok(r.text.includes('| STOR-01 | 1 | Complete | v9.9.0 |'), 'no summary to parenthesize');
});

// --- the seam ---------------------------------------------------------------

function scaffold() {
  const root = mkdtempSync(join(tmpdir(), 'cad-prune-'));
  const dir = join(root, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  mkdirSync(join(dir, 'phases', '2.1'), { recursive: true });
  mkdirSync(join(dir, 'phases', '3'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'SUMMARY.md'), 'shipped');
  writeFileSync(join(dir, 'phases', '2.1', 'SUMMARY.md'), 'patched');
  writeFileSync(join(dir, 'phases', '3', 'CONTEXT.md'), 'open');
  writeFileSync(join(dir, 'ROADMAP.md'), ROADMAP);
  writeFileSync(join(dir, 'REQUIREMENTS.md'), REQUIREMENTS);
  return dir;
}

function run(dir, extra) {
  try {
    return JSON.parse(execFileSync('node',
      [PLANNING, 'milestone-prune', '--dir', dir, ...extra], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('seam: archive mode prunes docs and moves completed dirs, leaves the open phase', () => {
  const dir = scaffold();
  const r = run(dir, ['--label', 'v1.2.0', '--mode', 'archive']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'pruned');
  assert.deepEqual(r.phases, [1, 2.1]);
  assert.deepEqual(r.dirs.archived, [1, 2.1]);
  assert.ok(existsSync(join(dir, '_archive-v1.2.0', '1', 'SUMMARY.md')));
  assert.ok(existsSync(join(dir, '_archive-v1.2.0', '2.1', 'SUMMARY.md')));
  assert.ok(existsSync(join(dir, 'phases', '3', 'CONTEXT.md')), 'open phase dir stays');
  const road = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(!road.includes('Phase 1: Store') && road.includes('Phase 3: Recall'));
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.ok(reqs.includes('| STOR-01 (bytes survive) | 1 | Complete | v1.2.0 |'));
});

test('seam: delete mode removes the dirs and a second run is a clean skip', () => {
  const dir = scaffold();
  const first = run(dir, ['--label', 'v1.2.0', '--mode', 'delete']);
  assert.deepEqual(first.dirs.deleted, [1, 2.1]);
  assert.ok(!existsSync(join(dir, 'phases', '1')));
  const again = run(dir, ['--label', 'v1.2.0', '--mode', 'delete']);
  assert.equal(again.action, 'skip');   // idempotent: nothing checked remains
});

test('seam: a missing phase dir is reported in dirs.missing, never a failure', () => {
  const dir = scaffold();
  rmDirHack(join(dir, 'phases', '1'));
  const r = run(dir, ['--label', 'v1', '--mode', 'delete']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.dirs.missing, [1]);
  assert.deepEqual(r.dirs.deleted, [2.1]);
});

test('seam: missing REQUIREMENTS.md degrades to a warning, roadmap half still lands', () => {
  const dir = scaffold();
  rmDirHack(join(dir, 'REQUIREMENTS.md'));
  const r = run(dir, ['--label', 'v1', '--mode', 'delete']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.requirements.moved, []);
  assert.ok(r.warnings.some((w) => /REQUIREMENTS\.md/.test(w)));
  assert.ok(!readFileSync(join(dir, 'ROADMAP.md'), 'utf8').includes('Phase 1: Store'));
});

// --- partial application: the arm that used to answer ok:true ---------------
// Both tests below redden on the pre-fix seam, which caught a directory failure
// into `warnings` and then pruned the documents for every completed phase
// regardless. Forcing the failure needs no chmod and no root check: a
// destination that already exists as a NON-EMPTY directory makes renameSync
// throw ENOTEMPTY on any platform this ships to.

test('seam: a phase whose directory move fails is refused, and keeps its docs', () => {
  const dir = scaffold();
  // Occupy _archive-v1.2.0/1 with a non-empty directory. Phase 1 cannot move
  // there; phase 2.1 is untouched and must still clear.
  mkdirSync(join(dir, '_archive-v1.2.0', '1', 'squatter'), { recursive: true });

  const r = run(dir, ['--label', 'v1.2.0', '--mode', 'archive']);

  assert.equal(r.ok, false, 'a partial application is a refusal, never ok:true');
  assert.equal(r.reason, 'partial-prune');
  assert.equal(r.action, 'partial');
  assert.deepEqual(r.failed, [1]);
  assert.deepEqual(r.phases, [2.1], 'only the phase that cleared is reported applied');
  assert.deepEqual(r.dirs.archived, [2.1]);
  assert.ok(r.warnings.some((w) => /phase 1: directory archive failed/.test(w)));

  // The tree and the documents agree: phase 1 is still on disk AND still in
  // both documents; phase 2.1 left both.
  assert.ok(existsSync(join(dir, 'phases', '1', 'SUMMARY.md')), 'the failed phase dir stays');
  const road = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(road.includes('Phase 1: Store'), 'the failed phase keeps its roadmap line');
  assert.ok(road.includes('### Phase 1: Store'), 'and its detail section');
  assert.ok(!road.includes('Phase 2.1: Patch'), 'the phase that cleared is pruned');
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.ok(!reqs.includes('| STOR-01 (bytes survive) | 1 | Complete | v1.2.0 |'),
    'the failed phase does not get a Shipped row');
});

test('seam: when every phase fails, neither document is written at all', () => {
  const dir = scaffold();
  const before = {
    road: readFileSync(join(dir, 'ROADMAP.md'), 'utf8'),
    reqs: readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'),
  };
  for (const n of ['1', '2.1']) {
    mkdirSync(join(dir, '_archive-v1.2.0', n, 'squatter'), { recursive: true });
  }

  const r = run(dir, ['--label', 'v1.2.0', '--mode', 'archive']);

  assert.equal(r.ok, false);
  assert.deepEqual(r.failed, [1, 2.1]);
  assert.deepEqual(r.phases, []);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before.road, 'roadmap byte-identical');
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before.reqs, 'requirements byte-identical');
});

// --- archive containment: the symlink the lexical check could not see -------

test('seam: an _archive-<label> that is a symlink is refused before anything moves', () => {
  const dir = scaffold();
  // The escape hatch: a writable directory OUTSIDE the planning root, reached
  // through a link whose own path resolves lexically inside it.
  const outside = mkdtempSync(join(tmpdir(), 'cad-prune-outside-'));
  symlinkSync(outside, join(dir, '_archive-v1.2.0'), 'dir');

  const r = run(dir, ['--label', 'v1.2.0', '--mode', 'archive']);

  assert.equal(r.ok, false);
  assert.equal(r.reason, 'archive-root-unusable');
  assert.match(r.detail, /symlink/);
  // Nothing left the tree, and nothing arrived outside it.
  assert.deepEqual(readdirSync(outside), [], 'no phase directory escaped the planning root');
  assert.ok(existsSync(join(dir, 'phases', '1', 'SUMMARY.md')));
  assert.ok(existsSync(join(dir, 'phases', '2.1', 'SUMMARY.md')));
  assert.ok(readFileSync(join(dir, 'ROADMAP.md'), 'utf8').includes('Phase 1: Store'),
    'a refusal before the loop writes nothing');
});

test('seam: a regular file squatting _archive-<label> is refused the same way', () => {
  const dir = scaffold();
  writeFileSync(join(dir, '_archive-v1.2.0'), 'not a directory');
  const r = run(dir, ['--label', 'v1.2.0', '--mode', 'archive']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'archive-root-unusable');
  assert.doesNotMatch(r.detail, /symlink/, 'the symlink clause is conditional on it being one');
});

test('seam: delete mode builds no archive root, so the type check does not apply', () => {
  const dir = scaffold();
  symlinkSync(mkdtempSync(join(tmpdir(), 'cad-prune-outside-')), join(dir, '_archive-v1.2.0'), 'dir');
  const r = run(dir, ['--label', 'v1.2.0', '--mode', 'delete']);
  assert.equal(r.ok, true, 'delete never touches _archive-<label>');
  assert.deepEqual(r.dirs.deleted, [1, 2.1]);
});

test('seam: bad args are refused - label required, mode must be delete|archive', () => {
  const dir = scaffold();
  assert.equal(run(dir, ['--mode', 'delete']).reason, 'bad-args');
  assert.equal(run(dir, ['--label', 'v1']).reason, 'bad-args');
  assert.equal(run(dir, ['--label', 'v1', '--mode', 'prune']).reason, 'bad-args');
  // ...and a refusal writes nothing.
  assert.ok(readFileSync(join(dir, 'ROADMAP.md'), 'utf8').includes('Phase 1: Store'));
});

// rm helper without importing rmSync at top (test file stays minimal).
function rmDirHack(p) {
  execFileSync('rm', ['-rf', p]);
}
