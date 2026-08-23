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

import {
  contextDecisions, decisionsFor, parseCommitRows, planTaskBodies, shaMatches,
} from './lib/why-record.mjs';
import { parseContextDecisions } from './lib/planning-files.mjs';

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

// --- Task 4: the decision edge --------------------------------------------

const V220_3_PLAN = read('_archive-v2.2.0', '3', 'PLAN.md');
const V220_3_CONTEXT = read('_archive-v2.2.0', '3', 'CONTEXT.md');

test('planTaskBodies cuts a real plan on planTaskTitles own boundaries', () => {
  const bodies = planTaskBodies(V220_3_PLAN);
  assert.equal(bodies.length, 5);
  assert.deepEqual(bodies.map((b) => b.ordinal), [1, 2, 3, 4, 5]);
  assert.equal(bodies[2].title, 'a target that is not a strict upgrade refuses');
  assert.ok(bodies[2].body.startsWith('### Task 3: '));
  assert.ok(!bodies[2].body.includes('### Task 4:'), 'a body stops at the next task heading');
  assert.ok(!bodies[4].body.includes('## Notes'), 'the last body stops at the next ## section, not at end of file');
});

test('planTaskBodies attributes nothing rather than wrongly when the heading count disagrees', () => {
  // `### Task foo` is a heading line this cut would take and `planTaskTitles`
  // would not, because its anchored grammar requires a number. The two counts
  // disagree, so nothing is attributed.
  const mixed = ['### Task 1: real', 'body', '', '### Task foo', 'body'].join('\n');
  assert.deepEqual(planTaskBodies(mixed), []);
  assert.deepEqual(planTaskBodies('# a plan with no tasks'), []);
});

test('contextDecisions unions the durable and the phase-local sections, durable first', () => {
  const durable = parseContextDecisions(V220_3_CONTEXT);
  const all = contextDecisions(V220_3_CONTEXT);
  assert.equal(durable.length, 4, 'the recall surface returns the durable set alone');
  assert.equal(all.length, 16, 'this command needs the phase-local decisions too - they are the answer');
  assert.deepEqual(all.slice(0, 4), durable, 'durable first, verbatim');
  assert.ok(all.some((d) => d.startsWith('D-08 (siblings):')));

  const ids = all.map((d) => d.slice(0, d.indexOf(' ')));
  assert.equal(new Set(ids).size, ids.length, 'no decision is listed twice');
});

test('a legacy CONTEXT with only ## Decisions still yields each decision exactly once', () => {
  const legacy = ['## Decisions', '', '- D-01 (a): first', '- D-02 (b): second', ''].join('\n');
  assert.deepEqual(contextDecisions(legacy), ['D-01 (a): first', 'D-02 (b): second']);
});

test('a task body citing D-08 yields a task-level cite carrying that CONTEXT line verbatim', () => {
  const answer = decisionsFor({
    planText: V220_3_PLAN, contextText: V220_3_CONTEXT, taskCell: '3',
  });
  assert.equal(answer.scope, 'task');
  assert.deepEqual(answer.ids, ['D-02', 'D-05', 'D-06', 'D-07', 'D-08']);
  assert.ok(answer.lines.includes('D-08 (siblings): the sibling-manifest loop inherits the guard through the'),
    `expected the CONTEXT line's own text, got ${JSON.stringify(answer.lines)}`);
});

test("a task cell that names no task falls back to the plan's ## Context cites, labelled plan-scoped", () => {
  // `fix 1` is a real cell in shipped summaries and names a review-fix round,
  // not a task, so there is no body to read and the answer says so by scope.
  const answer = decisionsFor({
    planText: V220_3_PLAN, contextText: V220_3_CONTEXT, taskCell: 'fix 1',
  });
  assert.equal(answer.scope, 'plan');
  assert.ok(answer.ids.includes('D-01'));
  assert.ok(answer.ids.includes('D-05'));
  assert.ok(answer.lines.includes('D-01 (refusal envelope): every refusal in `release-bump.mjs` - downgrade,'));
  assert.ok(answer.lines.includes('D-05 (refusal is a verdict, not a throw): `decideManifestBump` stays total -'));
});

test('a plan naming no D-NN at all yields every decision the CONTEXT carries, phase-scoped', () => {
  const bare = ['# Phase 3 - Plan', '', '## Context', '', 'No decision is cited here.', '',
    '## Tasks', '', '### Task 1: something', '', '- **Action:** do it', ''].join('\n');
  const answer = decisionsFor({ planText: bare, contextText: V220_3_CONTEXT, taskCell: '1' });
  assert.equal(answer.scope, 'phase');
  assert.deepEqual(answer.ids, []);
  assert.deepEqual(answer.lines, contextDecisions(V220_3_CONTEXT));
  assert.equal(answer.lines.length, 16, 'a phase-scoped answer is the whole set, never an empty result');
});

test('a cited decision the CONTEXT does not carry is stated rather than dropped', () => {
  const plan = ['## Context', '', 'This plan turns on D-99.', ''].join('\n');
  const answer = decisionsFor({ planText: plan, contextText: V220_3_CONTEXT, taskCell: '' });
  assert.equal(answer.scope, 'plan');
  assert.deepEqual(answer.ids, ['D-99']);
  assert.deepEqual(answer.lines,
    ["D-99 - cited here, but the phase's CONTEXT.md carries no such decision"]);
});

test('a phase with no CONTEXT.md at all reports absent, not an invented decision', () => {
  const answer = decisionsFor({ planText: V220_3_PLAN, contextText: '', taskCell: '99' });
  assert.equal(answer.scope, 'plan', 'the cites are still real; only their text is missing');
  assert.ok(answer.lines.every((l) => l.includes('carries no such decision')));

  const nothing = decisionsFor({ planText: '# no cites', contextText: '', taskCell: '1' });
  assert.equal(nothing.scope, 'absent');
  assert.deepEqual(nothing.lines, []);
});
