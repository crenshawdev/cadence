// Zero-dep tests for lib/why-record.mjs - the record readers `/cad-why` joins
// a commit through (WHY-01, phase 1 plan 2). See that module's header for the
// design. The fixtures are this repository's OWN archived artifacts, read
// verbatim: the grammar facts these readers are built against were measured on
// them, so a fixture typed out by hand here would be a test of the transcript
// rather than of the corpus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCommitRows, shaMatches } from './lib/why-record.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** This repository's root: bin -> cadence-core -> root. */
const ROOT = join(HERE, '..', '..');
const planning = (...parts) => join(ROOT, '.planning', ...parts);
const read = (...parts) => readFileSync(planning(...parts), 'utf8');

// --- Task 1: the SUMMARY commits-table reader ------------------------------

const V340_1 = read('_archive-v3.4.0', '1', 'SUMMARY.md');

test('every row of a real archived ## Commits table returns with its four cells byte-exact', () => {
  const rows = parseCommitRows(V340_1);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], {
    plan: '1',
    task: '1',
    commit: '97cf861',
    description: 'Register `git.issue_check` as a config key (schema, template, catalog row, reach row, three weight budgets re-pinned)',
  });
  assert.deepEqual(rows[1], {
    plan: '1',
    task: '2',
    commit: '0053735',
    description: 'The pure issue-decision core + 15 tests; `gh`/`tea` rows confirmed against installed `--help`, `glab` against published docs',
  });
  assert.deepEqual(rows[9], {
    plan: '1',
    task: 'fix 3',
    commit: 'ada2659',
    description: '`risk_surface` blocker: reject a control character in the parsed origin hostname',
  });
});

test('the fix 1 / fix 2 / fix 3 task cells survive as the strings the record wrote', () => {
  const tasks = parseCommitRows(V340_1).map((r) => r.task);
  assert.deepEqual(tasks, ['1', '2', '3', '4', '5', '6', '6', 'fix 1', 'fix 2', 'fix 3']);
  // The point of the assertion above, stated as the thing that must not happen:
  // Number('fix 1') is NaN, so an integerizing reader attributes three review
  // fixes to no task at all.
  for (const t of tasks) assert.equal(typeof t, 'string');
});

test('the separator row yields no entry', () => {
  const rows = parseCommitRows(V340_1);
  assert.ok(rows.every((r) => !/^[\s|:-]*$/.test(r.commit)), 'no row may come from |---|---|---|---|');
  assert.ok(rows.every((r) => r.plan !== 'Plan'), 'the header row is not a data row either');
});

test('a 7-character abbreviation matches its own full sha by prefix and not a neighbour', () => {
  const full = '00537356bf14084f3676eeeca1c4747146979bc3';
  const neighbour = `0053736${full.slice(7)}`;
  assert.equal(shaMatches('0053735', full), true);
  assert.equal(shaMatches('0053735', neighbour), false);
  assert.equal(shaMatches(full, '0053735'), true, 'the prefix test runs in either direction');
  assert.equal(shaMatches(full.toUpperCase(), '0053735'), true, 'and is case-insensitive');
});

test('an 8-character abbreviation matches its own full sha and not a 7-character neighbour of it', () => {
  const summary = [
    '## Commits',
    '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 2 | 1 | 5bcf4a8c | an eight-character era row |',
    '',
  ].join('\n');
  const [row] = parseCommitRows(summary);
  assert.equal(row.commit, '5bcf4a8c');

  const own = '5bcf4a8c0000000000000000000000000000cafe';
  const neighbour = '5bcf4a8d0000000000000000000000000000cafe';
  assert.equal(shaMatches(row.commit, own), true);
  assert.equal(shaMatches(row.commit, neighbour), false);
  // The 7-character neighbour that a fixed-width slice would confuse it with:
  // `5bcf4a8` prefixes BOTH, which is exactly why an abbreviation is never
  // widened or truncated to a fixed length before it is compared.
  assert.equal(shaMatches('5bcf4a8', own), true);
  assert.equal(shaMatches('5bcf4a8', neighbour), true);
});

test('a blank or non-hexadecimal commit cell matches nothing and mints no row', () => {
  assert.equal(shaMatches('', '00537356bf14084f3676eeeca1c4747146979bc3'), false);
  assert.equal(shaMatches('   ', '00537356bf14084f3676eeeca1c4747146979bc3'), false);
  assert.equal(shaMatches('not-a-sha', '00537356bf14084f3676eeeca1c4747146979bc3'), false);

  const summary = [
    '## Commits',
    '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 1 | 1 | deadbee | a real row |',
    '| 1 | 2 | (reverted) | a note somebody typed into the table |',
    '',
  ].join('\n');
  assert.deepEqual(parseCommitRows(summary).map((r) => r.commit), ['deadbee']);
});

test('a fenced ## line inside the section does not end the table early', () => {
  const summary = [
    '# Phase 9 - Summary',
    '',
    '## Commits',
    '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 1 | 1 | aaaaaaa | before the fence |',
    '',
    'The task quoted the heading it rewrote:',
    '',
    '```markdown',
    '## Deviations',
    '```',
    '',
    '| 1 | 2 | bbbbbbb | after the fence |',
    '',
    '## Deviations',
    '',
    '- [deviation] not a commit row',
    '',
  ].join('\n');
  const rows = parseCommitRows(summary);
  assert.deepEqual(rows.map((r) => r.commit), ['aaaaaaa', 'bbbbbbb'],
    'a fence-blind section bound would drop every row after the fenced ## line');
});

test('the three-column era table maps its cells by header name, never by position', () => {
  // `_archive-v2.5.0/2/SUMMARY.md` predates the Plan column. Read by position
  // its Task cell would be read as a plan and its Commit cell as a task - a
  // wrong join rather than a missing one.
  const rows = parseCommitRows(read('_archive-v2.5.0', '2', 'SUMMARY.md'));
  assert.ok(rows.length > 0, 'the three-column table still yields rows');
  for (const r of rows) {
    assert.equal(r.plan, '', 'an absent Plan column reads empty rather than shifting the other cells');
    assert.match(r.commit, /^[0-9a-f]{7,40}$/, `the commit cell must hold a commit id, got ${JSON.stringify(r.commit)}`);
    assert.ok(r.description.length > 0);
  }
});

test('a summary with no ## Commits section returns no rows rather than throwing', () => {
  assert.deepEqual(parseCommitRows(read('_archive-v2.2.0', '1', 'SUMMARY.md')), []);
  assert.deepEqual(parseCommitRows(''), []);
  assert.deepEqual(parseCommitRows(undefined), []);
});
