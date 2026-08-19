// Zero-dep tests for the milestone-prune seam: the pure transforms in
// lib/milestone-prune.mjs and the planning.mjs wrapper's I/O around them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, readFileSync, existsSync, symlinkSync, readdirSync, chmodSync, accessSync, constants } from 'node:fs';
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
  // The id may carry its tracker number before the colon - `- **GRD-01** (#219):`
  // - which is the convention this milestone's `## Active` bullets are written in.
  const lead = body.findIndex((l) => new RegExp(`^- \\*\\*${id}\\*\\*(?: \\(#\\d+\\))?:`).test(l));
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
  // The lead marker is stripped the way the seam strips it, tracker suffix
  // included - and the suffix is KEPT, as `#219:`, because the seam carries the
  // bullet's only pointer back to its issue into the archived row rather than
  // dropping it on the colon split.
  return span.map((l) => l.trim()).join(' ')
    .replace(/^- \*\*[^*]+\*\*(?: \((#\d+)\))?:\s*/, (_m, ref) => (ref ? `${ref}: ` : ''))
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

// --- the OTHER two locators in the same function (D-08/D-13) ----------------
//
// `## Active` was read fence-aware while `## Shipped` and the Traceability row
// filter, both a few lines below it in the same function, were not. The
// document that makes all three matter at once is the one this plugin ships:
// `templates/REQUIREMENTS.md` carries its whole body inside a markdown fence,
// so a template-seeded project's only `## Active`, `## Shipped` and
// `## Traceability` headings are EXAMPLES of them.

// The template's own example. Asserted as one substring: the transform must
// leave every byte of it exactly where it was.
const FENCED_EXAMPLE = `\`\`\`markdown
## Active

- **STOR-01**: an example bullet inside a code fence

## Shipped

| Requirement | Phase | Status | Milestone |
|-------------|-------|--------|-----------|
| EXA-09 | 9 | Complete | v0.0.1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
\`\`\``;

const REAL_SHIPPED = `## Shipped

| Requirement | Phase | Status | Milestone |
|-------------|-------|--------|-----------|
| OLD-01 | 0 | Complete | v0.1.0 |

`;

/** The fenced example above real sections, with or without a real `## Shipped`. */
const fencedDoc = (realShipped) => `# Requirements: Fixture

## Template

The shipped template carries its whole body as an example:

${FENCED_EXAMPLE}

## Active

- **STOR-01**: bytes survive
- **REC-01**: bytes are findable

${realShipped ? REAL_SHIPPED : ''}## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| REC-01 | Phase 3 | Pending |
`;

/** Occurrences of `needle` in `hay`, as whole lines. */
const lineCount = (hay, needle) => hay.split('\n').filter((l) => l === needle).length;

test('a fenced `## Shipped` is not the section - the row lands under the real one', () => {
  const r = archiveRequirements(fencedDoc(true), [1], 'v9.9.0');
  assert.equal(r.createdSection, false, 'the real section exists, so none is created');
  assert.ok(r.text.includes(FENCED_EXAMPLE), 'the template example survives byte-identical');
  // The archived row is inside the REAL `## Shipped`: below its existing last
  // row, above `## Traceability`. `lastIndexOf` because the fenced heading
  // comes first in the document.
  const row = r.text.indexOf('| STOR-01 (bytes survive) | 1 | Complete | v9.9.0 |');
  assert.ok(row > -1, 'the row was archived');
  assert.ok(row > r.text.indexOf('| OLD-01 | 0 | Complete | v0.1.0 |'));
  assert.ok(row < r.text.lastIndexOf('## Traceability'));
  assert.ok(row > r.text.lastIndexOf('## Shipped'));
  // Nothing was taken out of the fenced table: the example's Traceability row
  // is the ONLY `| STOR-01 | Phase 1 | Complete |` left, the real one having
  // been removed.
  assert.equal(lineCount(r.text, '| STOR-01 | Phase 1 | Complete |'), 1);
  assert.equal(lineCount(r.text, '| EXA-09 | 9 | Complete | v0.0.1 |'), 1);
  assert.ok(!r.text.split('\n').includes('- **STOR-01**: bytes survive'),
    'the real bullet is the one removed');
});

test('a document whose only `## Shipped` is fenced gets a REAL section created', () => {
  const r = archiveRequirements(fencedDoc(false), [1], 'v9.9.0');
  assert.equal(r.createdSection, true);
  assert.ok(r.text.includes(FENCED_EXAMPLE), 'the template example survives byte-identical');
  // Two headings now: the example's, and the one this call created.
  assert.equal(lineCount(r.text, '## Shipped'), 2);
  const created = r.text.lastIndexOf('## Shipped');
  assert.ok(created > r.text.indexOf('- **REC-01**: bytes are findable'),
    'created after the REAL ## Active span, not inside the fenced example');
  assert.ok(created < r.text.lastIndexOf('## Traceability'));
  assert.ok(r.text.includes('| STOR-01 (bytes survive) | 1 | Complete | v9.9.0 |'));
});

// D-13: the append scan's END. A fenced `## ` line inside `## Shipped` broke
// the loop, so new rows landed above rows already in the table.
const FENCED_INSIDE_SHIPPED = `# Requirements: Fixture

## Active

- **STOR-01**: bytes survive

## Shipped

| Requirement | Phase | Status | Milestone |
|-------------|-------|--------|-----------|
| OLD-01 | 0 | Complete | v0.1.0 |

The next section is spelled:

\`\`\`markdown
## Traceability
\`\`\`

| OLD-02 | 0 | Complete | v0.1.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
`;

test('a fenced `## ` inside ## Shipped does not cut the append scan short', () => {
  const r = archiveRequirements(FENCED_INSIDE_SHIPPED, [1], 'v9.9.0');
  assert.equal(r.createdSection, false);
  const lines = r.text.split('\n');
  assert.equal(lines[lines.indexOf('| OLD-02 | 0 | Complete | v0.1.0 |') + 1],
    '| STOR-01 (bytes survive) | 1 | Complete | v9.9.0 |',
    'the new row follows the LAST row of the table, not the last one before the fence');
  assert.ok(r.text.includes('```markdown\n## Traceability\n```'),
    'the fenced example survives byte-identical');
});

// --- the corpus: this repository's own planning documents -------------------

// This arm reads the LIVE planning documents, so its subject exists only while
// the cycle holds a completed phase. Between a close and the next verified
// phase the roadmap is legitimately empty - `milestone.md` step 3 prunes it -
// and there is nothing to transform. That is a state of the repository, not a
// result, so it SKIPS with the reason said out loud rather than asserting a
// precondition the milestone cycle owns. Asserting it made the suite red at
// every close and kept it red until the next phase was verified, which is
// exactly when someone installs the release and runs the tests.
test('corpus: pruning this repository\'s own REQUIREMENTS.md needs no hand repair', (t) => {
  const roadmap = readFileSync(join(REPO, '.planning', 'ROADMAP.md'), 'utf8');
  const reqs = readFileSync(join(REPO, '.planning', 'REQUIREMENTS.md'), 'utf8');
  const completed = completedPhases(roadmap);
  if (completed.length === 0) {
    t.skip('no completed phase in the live roadmap: between milestones, nothing to archive');
    return;
  }
  const r = archiveRequirements(reqs, completed, 'v9.9.9');
  assert.ok(r.moved.length > 0,
    'the roadmap names a completed phase, so its requirements must move');

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

// --- --label-file: the path transport for a label the repo supplies ----------
//
// An untagged close takes the label from PROJECT.md's milestone NAME, so this
// is repository content going into a double-quoted shell word. The transport
// changes only how the label ARRIVES: both terms still run on the resolved
// value, before any read, mkdir or rename.

/** A file holding `body` beside the planning root, and its path. */
function labelFile(dir, body, name = 'label.txt') {
  const file = join(dirname(dir), name);
  writeFileSync(file, body);
  return file;
}

test('seam: a label from a file archives exactly where the inline label does', () => {
  const inlineDir = scaffold();
  const fileDir = scaffold();
  const a = run(inlineDir, ['--label', 'v1.2.0', '--mode', 'archive']);
  const b = run(fileDir, ['--label-file', labelFile(fileDir, 'v1.2.0\n'), '--mode', 'archive']);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.ok(existsSync(join(fileDir, '_archive-v1.2.0', '1', 'SUMMARY.md')));
  assert.ok(existsSync(join(fileDir, '_archive-v1.2.0', '2.1', 'SUMMARY.md')));
  // The same `## Shipped` rows, byte for byte - the label reaches the table
  // cell through the same code either way.
  assert.equal(readFileSync(join(fileDir, 'REQUIREMENTS.md'), 'utf8'),
    readFileSync(join(inlineDir, 'REQUIREMENTS.md'), 'utf8'));
});

test('seam: both label terms still run on a label that arrived in a FILE', () => {
  for (const [name, body, pattern] of [
    ['the containment term', '../../../outside-tree', /must stay inside the planning root/],
    ['the table term', 'v1.2.0 | rc', /"\|" or a newline/],
  ]) {
    const dir = scaffold();
    const r = run(dir, ['--label-file', labelFile(dir, body), '--mode', 'archive']);
    assert.equal(r.ok, false, name);
    assert.equal(r.reason, 'bad-args', name);
    assert.match(String(r.detail), pattern, name);
    // Refused before any read, mkdir or rename.
    assert.ok(readFileSync(join(dir, 'ROADMAP.md'), 'utf8').includes('Phase 1: Store'), name);
    assert.ok(existsSync(join(dir, 'phases', '1', 'SUMMARY.md')), name);
  }
});

test('seam: every --label-file refusal is bad-args and leaves the tree untouched', () => {
  const dir = scaffold();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const good = labelFile(dir, 'v1.2.0');
  const cases = [
    { name: 'valueless', args: ['--label-file'] },
    { name: 'missing path', args: ['--label-file', join(dirname(dir), 'absent.txt')] },
    { name: 'empty file', args: ['--label-file', labelFile(dir, '\n \n', 'blank.txt')] },
    { name: 'both forms', args: ['--label', 'v1.2.0', '--label-file', good] },
  ];
  const locked = labelFile(dir, 'v1.2.0', 'locked.txt');
  chmodSync(locked, 0o000);
  try {
    // Running as root defeats the mode bits, so that arm is added only when it
    // can assert something.
    try { accessSync(locked, constants.R_OK); } catch {
      cases.push({ name: 'unreadable path', args: ['--label-file', locked] });
    }
    for (const c of cases) {
      const r = run(dir, [...c.args, '--mode', 'archive']);
      assert.equal(r.ok, false, c.name);
      assert.equal(r.reason, 'bad-args', c.name);
      assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before, `${c.name} wrote`);
      assert.ok(existsSync(join(dir, 'phases', '1', 'SUMMARY.md')), c.name);
    }
  } finally {
    chmodSync(locked, 0o600);
  }
});

// --- the recall residue: what a close leaves behind (RCL-07) ----------------
// The residue is written BEFORE the directories go, so every assertion here is
// about ordering as much as content: the rows have to be on disk in the arm
// where the removal FAILED, and they have to be there exactly once after the
// re-run that clears it.
//
// This block reads ARCHIVE.md with a local regex and imports nothing new. That
// is deliberate: the end-to-end falsifier below runs this same FILE against the
// unpatched tree, where an import of a not-yet-written export would fail the
// file on load instead of on its assertion.

/** The origin paths an ARCHIVE.md carries, in document order. */
const originsIn = (text) => [...text.matchAll(/^- `([^`]+)`: /gm)].map((m) => m[1]);

/** The `## ` milestone headings an ARCHIVE.md carries, in document order. */
const labelsIn = (text) => [...text.matchAll(/^## (.*)$/gm)].map((m) => m[1]);

const PHASE1_SUMMARY = `---
phase: 1
status: complete
---

## Deviations

- [deviation] the zarquon guard fired on a range it did not own

## Open items

- None.
`;

const PHASE1_UAT = `---
status: complete
phase: 1
---

## Items

### 1. Walk the zarquon install
expected: a cold clone reaches the plugin
status: pass

## Summary

total: 1
`;

const PHASE1_CONTEXT = `# Phase 1 Context

## Durable decisions

- D-01 (RCL-07): the zarquon residue is written before the dirs go

## Decisions

- D-02 (RCL-07): a phase-local note that is not durable
`;

/**
 * The scaffold, with phase 1 carrying one real artifact of each indexed kind.
 * Phase 2.1 keeps its section-less `patched` SUMMARY, which is how these rows
 * assert that only a parsed snippet lands - not every completed phase.
 */
function scaffoldWithArtifacts() {
  const dir = scaffold();
  writeFileSync(join(dir, 'phases', '1', 'SUMMARY.md'), PHASE1_SUMMARY);
  writeFileSync(join(dir, 'phases', '1', 'UAT.md'), PHASE1_UAT);
  writeFileSync(join(dir, 'phases', '1', 'CONTEXT.md'), PHASE1_CONTEXT);
  return dir;
}

const RESIDUE_ORIGINS = ['phases/1/SUMMARY.md', 'phases/1/UAT.md', 'phases/1/CONTEXT.md'];

test('seam: a delete-mode close writes its residue before the directories go', () => {
  const dir = scaffoldWithArtifacts();
  const r = run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  assert.equal(r.ok, true);
  assert.equal(r.residue_rows, 3, 'the envelope states the count, so a no-op is legible');
  const text = readFileSync(join(dir, 'ARCHIVE.md'), 'utf8');
  assert.deepEqual(labelsIn(text), ['v3.5.2'], 'one heading for one milestone');
  assert.deepEqual(originsIn(text), RESIDUE_ORIGINS,
    'SUMMARY then UAT then CONTEXT, the order the live walk uses');
  assert.match(text, /- `phases\/1\/SUMMARY\.md`: the zarquon guard fired on a range it did not own$/m,
    'the `[deviation]` tag is stripped exactly as the live walk strips it');
  assert.match(text, /- `phases\/1\/UAT\.md`: Walk the zarquon install a cold clone reaches the plugin$/m);
  assert.match(text, /- `phases\/1\/CONTEXT\.md`: D-01 \(RCL-07\): the zarquon residue/m);
  assert.ok(!/D-02/.test(text), 'a phase-local ## Decisions row is not durable and does not land');
  // And the directories the rows describe are gone, which is the whole point.
  assert.ok(!existsSync(join(dir, 'phases', '1')));
});

test('seam: the archive arm writes the same rows the delete arm does', () => {
  const dir = scaffoldWithArtifacts();
  const r = run(dir, ['--label', 'v3.5.2', '--mode', 'archive']);
  assert.equal(r.ok, true);
  assert.equal(r.residue_rows, 3);
  const text = readFileSync(join(dir, 'ARCHIVE.md'), 'utf8');
  assert.deepEqual(originsIn(text), RESIDUE_ORIGINS);
  assert.ok(existsSync(join(dir, '_archive-v3.5.2', '1', 'SUMMARY.md')));
});

test('seam: a second identical run adds no row and leaves ARCHIVE.md byte-identical', () => {
  const dir = scaffoldWithArtifacts();
  run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  const before = readFileSync(join(dir, 'ARCHIVE.md'), 'utf8');
  const again = run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  assert.equal(again.action, 'skip');
  assert.equal(readFileSync(join(dir, 'ARCHIVE.md'), 'utf8'), before);
});

test('seam: an interrupted close keeps its rows, and the re-run neither duplicates nor drops them', () => {
  const dir = scaffoldWithArtifacts();
  // Block phase 1's move the way the partial-prune tests above do. The residue
  // is written before that failure, which is exactly the interrupt D-01 exists
  // for: the directory is still live and its rows are already on disk.
  mkdirSync(join(dir, '_archive-v3.5.2', '1', 'squatter'), { recursive: true });
  const first = run(dir, ['--label', 'v3.5.2', '--mode', 'archive']);
  assert.equal(first.ok, false);
  assert.equal(first.reason, 'partial-prune');
  assert.deepEqual(first.failed, [1]);
  assert.equal(first.residue_rows, 3, 'the rows were written ahead of the removal that failed');
  const after = readFileSync(join(dir, 'ARCHIVE.md'), 'utf8');
  assert.deepEqual(originsIn(after), RESIDUE_ORIGINS);
  assert.ok(existsSync(join(dir, 'phases', '1', 'SUMMARY.md')), 'the failed phase is still live');

  // Clear what blocked it and re-run: phase 1 is a candidate again and its
  // artifacts are readable again, so without the containment guard this run
  // writes a second copy of all three rows.
  rmDirHack(join(dir, '_archive-v3.5.2', '1'));
  const second = run(dir, ['--label', 'v3.5.2', '--mode', 'archive']);
  assert.equal(second.ok, true);
  assert.deepEqual(second.phases, [1]);
  assert.equal(second.residue_rows, 0, 'a phase already under this heading is skipped, not re-read');
  assert.equal(readFileSync(join(dir, 'ARCHIVE.md'), 'utf8'), after, 'byte-identical after the re-run');
  assert.deepEqual(originsIn(after), RESIDUE_ORIGINS, 'present exactly once');
  assert.ok(existsSync(join(dir, '_archive-v3.5.2', '1', 'SUMMARY.md')), 'and the phase finally moved');
});

test('seam: phases holding no readable artifact write no ARCHIVE.md at all', () => {
  // The bare scaffold: both completed SUMMARYs are section-less prose, so the
  // three parsers return nothing and there is no residue to write.
  const dir = scaffold();
  const r = run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  assert.equal(r.ok, true);
  assert.equal(r.residue_rows, 0);
  assert.ok(!existsSync(join(dir, 'ARCHIVE.md')), 'no rows, no file');
});

// --- the falsifier: close a milestone, then recall out of it (RCL-07) -------
//
// WATCHED FAILING AT 182d2e1, the tip of this plan's unpatched tree. Observed
// there, on this repository's own live corpus:
//
//   $ node cadence-core/bin/planning.mjs recall --root . b912d06
//   {"ok":true,"results":[],"total":0}
//
// `b912d06` is a commit hash that appears only in the v3.5.2 phase-1 SUMMARY
// this project pruned at its close - a deviation Cadence wrote down in order to
// remember it, unreachable from the corpus the moment the phase retired. Every
// hit `recall` returned on that tree, for any query, came from CAPTURE.md.
//
// The two cases below are that observation as a check: the seams are reached
// through the CLI ONLY and nothing task 1 exported is imported, so against
// 182d2e1 these fail on their assertion rather than on a missing export. To
// re-watch it: `git worktree add --detach <tmp> 182d2e1`, copy this file into
// that checkout's `cadence-core/bin/`, `node --test` it there, then remove the
// worktree.

const FALSIFIER_ROADMAP = `# Roadmap: Falsifier

## Overview

Prose.

## Phases

- [x] **Phase 1: Closed** - the milestone that retired
- [ ] **Phase 2: Open** - still live

## Phase Details

### Phase 1: Closed
**Goal:** retire

### Phase 2: Open
**Goal:** continue
`;

/**
 * A `.planning` holding one completed phase with one artifact of each indexed
 * kind. `quixotrope` appears in the SUMMARY deviation and NOWHERE else in the
 * fixture; `zarquon` appears once in each of the three, which is what makes the
 * three sources separable in one result list.
 */
function falsifierTree() {
  const root = mkdtempSync(join(tmpdir(), 'cad-rcl07-'));
  const dir = join(root, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  mkdirSync(join(dir, 'phases', '2'), { recursive: true });
  writeFileSync(join(dir, 'ROADMAP.md'), FALSIFIER_ROADMAP);
  writeFileSync(join(dir, 'phases', '1', 'SUMMARY.md'),
    '---\nphase: 1\nstatus: complete\n---\n\n## Deviations\n\n'
    + '- [deviation] the quixotrope guard fired on a zarquon range it did not own\n');
  writeFileSync(join(dir, 'phases', '1', 'UAT.md'),
    '---\nstatus: complete\nphase: 1\n---\n\n## Items\n\n'
    + '### 1. Walk the zarquon install\nexpected: a cold clone reaches the plugin\nstatus: pass\n'
    + '\n## Summary\n\ntotal: 1\n');
  writeFileSync(join(dir, 'phases', '1', 'CONTEXT.md'),
    '# Phase 1 Context\n\n## Durable decisions\n\n'
    + '- D-01 (RCL-07): the zarquon residue is written before the directories go\n');
  writeFileSync(join(dir, 'phases', '2', 'CONTEXT.md'), '# Phase 2 Context\n');
  return dir;
}

/**
 * `planning.mjs recall` over a fixture. The global config layer is pinned off a
 * nonexistent path the way planning.test.mjs pins it: a developer's real
 * ~/.claude/cadence/config.json setting `memory.backend: none` would otherwise
 * empty these results locally while CI stayed green.
 */
function recallIn(dir, query) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, 'recall', query, '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-no-such-global.json') },
    }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

for (const mode of ['delete', 'archive']) {
  test(`falsifier: a close in \`${mode}\` mode leaves its phase recallable (RCL-07)`, () => {
    const dir = falsifierTree();

    // It is recallable BEFORE the close - otherwise this case could pass on a
    // fixture that never had a corpus at all.
    assert.equal(recallIn(dir, 'quixotrope').results.length, 1, 'live before the close');

    const pruned = run(dir, ['--label', 'v9.9.9', '--mode', mode]);
    assert.equal(pruned.ok, true, JSON.stringify(pruned));
    assert.ok(!existsSync(join(dir, 'phases', '1')),
      'the phase directory is out of the live walk, whichever arm ran');

    // The SUMMARY deviation, by a term that exists nowhere else in the fixture.
    const one = recallIn(dir, 'quixotrope');
    assert.equal(one.ok, true);
    assert.equal(one.results.length, 1, JSON.stringify(one.results));
    assert.equal(one.results[0].source, 'v9.9.9/phases/1/SUMMARY.md',
      'the milestone that retired it AND the artifact it came from');
    assert.equal(one.results[0].phase, 1);
    assert.match(one.results[0].snippet, /the quixotrope guard fired/);

    // And the three artifacts stay separable from each other in one result set.
    const all = recallIn(dir, 'zarquon');
    assert.deepEqual(all.results.map((r) => r.source).sort(), [
      'v9.9.9/phases/1/CONTEXT.md',
      'v9.9.9/phases/1/SUMMARY.md',
      'v9.9.9/phases/1/UAT.md',
    ], JSON.stringify(all.results));
  });
}

// rm helper without importing rmSync at top (test file stays minimal).
function rmDirHack(p) {
  execFileSync('rm', ['-rf', p]);
}

// --- the two containment defects the risk_surface gate caught ----------------
//
// Both are data-loss shapes rather than dirty-output shapes: a false "already
// archived" suppresses the residue write, and the directory removal right after
// it makes the omission permanent. Both assert on ORIGINS, because the phase
// number alone is exactly the resolution that was too coarse.

test('seam: a foreign heading that prefixes this label does not suppress the write', () => {
  const dir = scaffoldWithArtifacts();
  // A section this close does not own, named so the old
  // `source.startsWith(label + "/")` test answers true for it.
  writeFileSync(join(dir, 'ARCHIVE.md'),
    '## v3.5.2/forged\n\n- `phases/1/SUMMARY.md`: a row from somewhere else\n');
  const r = run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  assert.equal(r.ok, true);
  assert.equal(r.residue_rows, 3, 'phase 1 is unarchived under THIS label, so all three land');
  const text = readFileSync(join(dir, 'ARCHIVE.md'), 'utf8');
  assert.deepEqual(labelsIn(text), ['v3.5.2/forged', 'v3.5.2'], 'the foreign section is untouched');
  const own = text.slice(text.indexOf('## v3.5.2\n'));
  assert.deepEqual(originsIn(own), RESIDUE_ORIGINS);
});

test('seam: a partial section re-runs the artifacts it is missing, not the phase whole', () => {
  const dir = scaffoldWithArtifacts();
  // What a close that landed SUMMARY and CONTEXT but could not read UAT.md
  // leaves behind. Keyed on the phase number, the retry skips all three.
  writeFileSync(join(dir, 'ARCHIVE.md'),
    '## v3.5.2\n\n- `phases/1/SUMMARY.md`: already landed\n'
    + '- `phases/1/CONTEXT.md`: already landed\n');
  const r = run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  assert.equal(r.ok, true);
  assert.equal(r.residue_rows, 1, 'only the missing artifact is re-read');
  const text = readFileSync(join(dir, 'ARCHIVE.md'), 'utf8');
  assert.deepEqual(originsIn(text),
    ['phases/1/SUMMARY.md', 'phases/1/CONTEXT.md', 'phases/1/UAT.md'],
    'the UAT row lands; neither pre-existing row is duplicated');
  assert.equal(originsIn(text).filter((o) => o === 'phases/1/SUMMARY.md').length, 1);
});

test('seam: a held ARCHIVE.md lock refuses the close before any directory moves', () => {
  // The blocking `diff` gate's finding: unserialized, two closes clobber each
  // other's rows and then remove the directories that were the only other copy.
  // A refused lock must therefore stop BEFORE the removal, not after it.
  const dir = scaffoldWithArtifacts();
  writeFileSync(join(dir, 'ARCHIVE.md.lock'), ''); // a fresh mtime: a live writer holds it
  const r = run(dir, ['--label', 'v3.5.2', '--mode', 'delete']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'archive-locked');
  assert.match(r.detail, /ARCHIVE\.md\.lock/, 'the reason must name the lock');
  assert.ok(existsSync(join(dir, 'phases', '1')), 'the phase directory must survive a refused close');
  assert.ok(!existsSync(join(dir, 'ARCHIVE.md')), 'and nothing was written');
});

test('a bullet carrying its tracker suffix is removed WHOLE, and keeps the ref', () => {
  // The regression the live corpus caught the moment phase 1 completed: the
  // lead-line form was the bare `- **<ID>**:`, so a `- **GRD-01** (#219): ...`
  // bullet matched nothing. It was never removed - its whole span survived as
  // orphaned prose - and its Shipped row was built with no parenthetical at
  // all, silently losing the requirement text AND the issue pointer.
  const reqs = [
    '## Active',
    '',
    '- **AAA-01** (#219): a wrapped bullet whose lead line carries the tracker',
    '  number the milestone opened it with, continuing here.',
    '- **BBB-01**: a bullet in the older form, with no tracker suffix.',
    '',
    '## Traceability',
    '',
    '| Requirement | Phase | Status |',
    '|-------------|-------|--------|',
    '| AAA-01 | Phase 1 | Complete |',
    '| BBB-01 | Phase 1 | Complete |',
    '',
  ].join('\n');
  const r = archiveRequirements(reqs, [1], 'v9.9.9');
  const out = r.text;
  // Scoped to `## Active`: the span's WORDS survive on purpose, inside the
  // archived row's parenthetical - what must not survive is the bullet.
  const active = out.split('## Shipped')[0];
  assert.ok(!active.includes('- **AAA-01**'), 'the suffixed bullet survived the prune');
  assert.ok(!active.includes('number the milestone opened it with'),
    'the suffixed bullet left its continuation line behind as orphaned prose');
  assert.match(out,
    /\| AAA-01 \(#219: a wrapped bullet whose lead line carries the tracker number the milestone opened it with, continuing here\.\) \| 1 \| Complete \| v9\.9\.9 \|/,
    'the archived row lost the summary or the tracker ref');
  // The older form is untouched by the widening.
  assert.match(out,
    /\| BBB-01 \(a bullet in the older form, with no tracker suffix\.\) \| 1 \| Complete \| v9\.9\.9 \|/);
});
