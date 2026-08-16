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

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(HERE, 'planning.mjs');
// This repository's own root, computed the way prose-agreement.test.mjs
// computes its REPO - the corpus test below reads the live planning documents.
const REPO = join(HERE, '..', '..');

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

// --- wrapped bullets: the shape this repository's own documents have --------
// Every `## Active` bullet in `.planning/REQUIREMENTS.md` wraps, so the wrapped
// path is the common one, not an edge case. The helpers below state D-01's span
// rule and D-04's escape INDEPENDENTLY of lib/milestone-prune.mjs, so what they
// pin is the rule rather than whatever the implementation happens to do.

/** The bullet SPAN (D-01) read out of `## Active`: the lead `- **ID**:` line
 *  plus every following non-blank line beginning with whitespace. A blank line
 *  or a column-0 line ends it. Returns `[]` when the id has no bullet. */
function activeSpan(text, id) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Active');
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start + 1, end);
  const lead = body.findIndex((l) => new RegExp(`^- \\*\\*${id}\\*\\*:`).test(l));
  if (lead === -1) return [];
  const span = [body[lead]];
  for (let i = lead + 1; i < body.length; i++) {
    if (!body[i].trim() || !/^\s/.test(body[i])) break;
    span.push(body[i]);
  }
  return span;
}

/** That span as the archived parenthetical must read: each line trimmed and
 *  joined on single spaces, the `- **ID**: ` marker dropped, every `|` escaped
 *  for the table cell (D-04). No lowercasing - D-05 makes the archived text
 *  byte-faithful to the bullet apart from the whitespace join. */
function parenthetical(span) {
  return span.map((l) => l.trim()).join(' ')
    .replace(/^- \*\*[^*]+\*\*:\s*/, '')
    .replace(/\|/g, '\\|');
}

/** Every `|`-leading line inside `## Shipped`, header and delimiter included. */
function shippedRows(text) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === '## Shipped');
  if (at === -1) return [];
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    if (/^\|/.test(lines[i])) out.push(lines[i]);
  }
  return out;
}

/** Pipes that still divide a GFM cell - a `\|` renders the character instead. */
const unescapedPipes = (row) => (row.match(/(?<!\\)\|/g) || []).length;

// Bullets that WRAP, one carrying a `|` in its text, the section closing with a
// column-0 prose paragraph after a blank line: the exact shape
// `.planning/REQUIREMENTS.md` has.
const WRAPPED = `# Requirements: Fixture

## Active

- **STOR-01**: Bytes survive a restart, and the reader that proves it reads
  the same span the writer wrote, so a partial write is reported rather than
  repaired.
- **STOR-02**: The patch holds under a config union spelled \`mode: fast|slow\`
  in the bullet's own text.
- **REC-01**: bytes are findable
  by the recall walk, which no phase has shipped.

\`/cad-plan\` seeds each requirement's Traceability row as its phase is planned -
rows are never hand-populated here.

## Out of Scope

- Sync.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 2.1 | Complete |
| REC-01 | Phase 3 | Pending |
`;

test('a wrapped bullet is removed whole - no orphaned continuation line survives', () => {
  const r = archiveRequirements(WRAPPED, [1, 2.1], 'v1.2.0');
  const out = r.text.split('\n');
  for (const id of ['STOR-01', 'STOR-02']) {
    const span = activeSpan(WRAPPED, id);
    assert.ok(span.length > 1, `${id} must wrap for this fixture to bite`);
    for (const line of span) {
      assert.ok(!out.includes(line), `orphaned fragment survived: ${line}`);
    }
  }
});

test('a wrapped-bullet prune leaves the section\'s trailing paragraph and the unshipped bullet', () => {
  const r = archiveRequirements(WRAPPED, [1, 2.1], 'v1.2.0');
  const out = r.text.split('\n');
  // The column-0 paragraph after the last bullet is prose, not span.
  assert.ok(r.text.includes("`/cad-plan` seeds each requirement's Traceability row as its phase is planned -"));
  assert.ok(r.text.includes('rows are never hand-populated here.'));
  // ...and an unshipped id keeps its WHOLE wrapped bullet.
  const span = activeSpan(WRAPPED, 'REC-01');
  assert.equal(span.length, 2);
  for (const line of span) {
    assert.ok(out.includes(line), `an unshipped bullet's line was eaten: ${line}`);
  }
});

test('the archived parenthetical is the whole span joined, first letter as authored', () => {
  const r = archiveRequirements(WRAPPED, [1, 2.1], 'v1.2.0');
  const one = parenthetical(activeSpan(WRAPPED, 'STOR-01'));
  // D-05: byte-faithful, so the assertion may NOT expect a lowercased lead word.
  assert.ok(one.startsWith('Bytes survive a restart'), 'the fixture pins the capital');
  assert.ok(r.text.includes(`| STOR-01 (${one}) | 1 | Complete | v1.2.0 |`),
    `expected the whole span: ${one}`);
  const two = parenthetical(activeSpan(WRAPPED, 'STOR-02'));
  assert.ok(r.text.includes(`| STOR-02 (${two}) | 2.1 | Complete | v1.2.0 |`),
    `expected the whole span: ${two}`);
});

test('a `|` inside a bullet is escaped before it reaches the Shipped cell', () => {
  const r = archiveRequirements(WRAPPED, [1, 2.1], 'v1.2.0');
  const rows = shippedRows(r.text);
  assert.equal(rows.length, 4, 'header, delimiter and the two shipped rows');
  for (const row of rows) {
    assert.equal(unescapedPipes(row), 5, `a shifted Shipped column: ${row}`);
  }
  const cell = rows.find((l) => l.startsWith('| STOR-02'));
  assert.ok(cell.includes('fast\\|slow'), 'the character still renders in the cell');
});

// A fenced `## Active` ABOVE the real one - the shape the shipped
// templates/REQUIREMENTS.md has, which made a fence-blind reader operate on a
// template's own example.
const FENCED = `# Requirements: Fixture

## Template

The shipped template carries its own example of the section:

\`\`\`markdown
## Active

- **STOR-01**: an example bullet inside a code fence
\`\`\`

## Active

- **STOR-01**: bytes survive
  across a restart.
- **REC-01**: bytes are findable

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| REC-01 | Phase 3 | Pending |
`;

test('a `## Active` heading inside a code fence is not the section', () => {
  const r = archiveRequirements(FENCED, [1], 'v9.9.0');
  assert.ok(r.text.includes('- **STOR-01**: an example bullet inside a code fence'),
    'a bullet inside a fenced example is documentation, not a bullet');
  assert.ok(!r.text.includes('- **STOR-01**: bytes survive'), 'the real bullet is the one removed');
  // Line-wise: the continuation's text survives inside the archived row, so a
  // substring test here would assert against the fix rather than the defect.
  assert.ok(!r.text.split('\n').includes('  across a restart.'),
    'the real bullet\'s continuation line is gone from ## Active');
  assert.ok(r.text.includes('| STOR-01 (bytes survive across a restart.) | 1 | Complete | v9.9.0 |'),
    'the summary comes from the real section, not the fenced example');
  // Both ends come from the same reader, so the created section lands after the
  // REAL `## Active` span rather than before it.
  assert.ok(r.text.indexOf('## Shipped') > r.text.indexOf('- **REC-01**: bytes are findable'),
    '## Shipped was created inside/above the real Active section');
  assert.ok(r.text.indexOf('## Shipped') < r.text.indexOf('## Traceability'));
});

// --- the corpus: this repository's own planning documents -------------------

test('corpus: pruning this repository\'s own REQUIREMENTS.md needs no hand repair', () => {
  const roadmap = readFileSync(join(REPO, '.planning', 'ROADMAP.md'), 'utf8');
  const reqs = readFileSync(join(REPO, '.planning', 'REQUIREMENTS.md'), 'utf8');
  const r = archiveRequirements(reqs, completedPhases(roadmap), 'v9.9.9');
  assert.ok(r.moved.length > 0, 'the corpus must have a completed phase to move');

  const before = new Set(shippedRows(reqs));
  const out = r.text.split('\n');
  const after = shippedRows(r.text);

  for (const { id, phase } of r.moved) {
    const span = activeSpan(reqs, id);
    assert.ok(span.length > 1, `${id} must be a wrapped bullet for this corpus to bite`);
    // No line of a moved bullet's original span survives anywhere in the text.
    for (const line of span) {
      assert.ok(!out.includes(line), `${id} left an orphan: ${line}`);
    }
    // ...and its new parenthetical is that whole span.
    assert.equal(
      after.find((l) => l.startsWith(`| ${id} `)),
      `| ${id} (${parenthetical(span)}) | ${phase} | Complete | v9.9.9 |`);
  }

  // Every row this run ADDED is five-piped. The rows it did not add are
  // byte-preserved - including `CFG-01` and `RVW-01`, the two scars this phase
  // deliberately leaves unrepaired, which is why the count is scoped to new rows.
  for (const row of after) {
    if (before.has(row)) continue;
    assert.equal(unescapedPipes(row), 5, `a shifted Shipped column: ${row}`);
  }
  for (const row of before) {
    assert.ok(after.includes(row), `a pre-existing Shipped row was rewritten: ${row}`);
  }
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
