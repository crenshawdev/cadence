// Zero-dep tests for lib/why-render.mjs - the deterministic renderer and the
// entry cap `/cad-why` (phase 1 plan 1) is built on. See that module's header
// for the design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChain, DEFAULT_TOP } from './lib/why-render.mjs';

const OLD = { sha: 'a'.repeat(40), date: '2026-01-01T00:00:00-05:00', subject: 'older commit' };
const NEW = { sha: 'b'.repeat(40), date: '2026-06-01T00:00:00-05:00', subject: 'newer commit' };

test('two entries in ascending date order render newest first', () => {
  const { text } = renderChain([OLD, NEW]);
  assert.ok(text.indexOf(NEW.sha) < text.indexOf(OLD.sha), 'the newer commit must render before the older one');
});

test('two entries sharing one commit date render in descending full-sha order, and reversal is byte-identical', () => {
  const sameDate = '2026-03-01T00:00:00-05:00';
  const low = { sha: '1'.repeat(40), date: sameDate, subject: 'low sha' };
  const high = { sha: 'f'.repeat(40), date: sameDate, subject: 'high sha' };

  const forward = renderChain([low, high]);
  const reversed = renderChain([high, low]);

  assert.equal(forward.text, reversed.text, 'reversing the input array must not change the rendered text');
  assert.ok(forward.text.indexOf(high.sha) < forward.text.indexOf(low.sha),
    'the higher full sha must render first when dates tie');
});

test('a 25-entry chain renders exactly DEFAULT_TOP entries while total reads 25', () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({
    sha: String(i).padStart(40, '0'),
    date: new Date(2026, 0, i + 1).toISOString(),
    subject: `commit ${i}`,
  }));
  const { text, shown, total } = renderChain(entries);
  // Read off the constant rather than typed out beside it: a second literal
  // here is a second claim about the cap, and the two disagreeing silently is
  // the shape of defect WHY-03 was (v3.6.1 D-02).
  assert.equal(shown, DEFAULT_TOP);
  assert.equal(total, 25);
  const commitLines = text.split('\n').filter((l) => l.startsWith('commit '));
  assert.equal(commitLines.length, DEFAULT_TOP);
});

test('an entry carrying no join data renders one stated-absent line per join field', () => {
  const bare = { sha: 'c'.repeat(40), date: '2026-02-01T00:00:00-05:00', subject: 'no joins yet' };
  const { text } = renderChain([bare]);
  for (const label of ['phase', 'plan task', 'decision', 'deviation', 'review']) {
    assert.ok(text.includes(`${label}: not yet joined`), `expected a stated-absent line for ${label}`);
  }
});

test('an entry carrying join data renders its own text rather than the placeholder', () => {
  const joined = {
    sha: 'd'.repeat(40), date: '2026-04-01T00:00:00-05:00', subject: 'joined',
    phase: 'Phase 1', task: 'Task 3', decision: 'D-02', deviation: 'none logged',
    review: 'no surviving findings',
  };
  const { text } = renderChain([joined]);
  assert.ok(text.includes('phase: Phase 1'));
  assert.ok(!text.includes('phase: not yet joined'));
});

// --- The off-roadmap task arm (phase 3 plan 2, task 3) --------------------
//
// A task directory rendering as `tasks phase <slug>` is the failure CONTEXT
// D-02 rejects: it READS as a phase, so it is a wrong answer rather than a
// missing one, and a reader has no way to tell. These cases pin the task arm
// and pin the three arms beside it as unmoved.

/** The join `brief()` hands the renderer for a commit the tasks tier answered:
 * `slug` set, `phase` and `milestone` null, and an empty Plan cell. */
const TASK_ENTRY = {
  sha: 'e'.repeat(40),
  date: '2026-05-01T00:00:00-05:00',
  subject: 'feat(config): add workflow.max_plan_tasks, the plan-size ceiling',
  join: {
    state: 'resolved',
    label: 'tasks/bound-plan-size',
    slug: 'bound-plan-size',
    milestone: null,
    phase: null,
    plan: '',
    task: '1',
    description: 'feat(config): add workflow.max_plan_tasks, the plan-size ceiling',
  },
};

/** The one rendered line whose label is `name`. */
const lineFor = (text, name) => text.split('\n').find((l) => l.startsWith(`${name}: `));

test('a resolved TASK names its slug and prints no phase number and no milestone', () => {
  const line = lineFor(renderChain([TASK_ENTRY]).text, 'phase');
  assert.equal(line,
    'phase: off-roadmap task bound-plan-size - a /cad-task run, not a roadmap phase (tasks/bound-plan-size)');
  assert.ok(!/phase\s+\d/i.test(line), 'a task directory must never read as a numbered phase');
  assert.ok(!/\bv\d+\.\d+\.\d+\b/.test(line), 'nor as a milestone label');
  assert.ok(!/null/.test(line), 'and never leaks the nulls the descriptor carries in place of both');
});

test('a task record has no Plan column, so its plan task line carries no plan prefix', () => {
  const line = lineFor(renderChain([TASK_ENTRY]).text, 'plan task');
  assert.equal(line,
    'plan task: task 1 - feat(config): add workflow.max_plan_tasks, the plan-size ceiling');
  assert.ok(!line.startsWith('plan task: plan '), 'fieldTask needs no arm of its own');
});

test('the resolved-PHASE arm is unmoved: the milestone and the number, read off the directory', () => {
  const entry = {
    sha: '1'.repeat(40), date: '2026-05-02T00:00:00-05:00', subject: 'a phase commit',
    join: {
      state: 'resolved', label: '_archive-v3.4.0/1', milestone: 'v3.4.0', phase: '1',
      plan: '1', task: '2', description: 'the phase task',
    },
  };
  assert.equal(lineFor(renderChain([entry]).text, 'phase'), 'phase: v3.4.0 phase 1 (_archive-v3.4.0/1)');
  assert.equal(lineFor(renderChain([entry]).text, 'plan task'), 'plan task: plan 1, task 2 - the phase task');
});

test('the RECOVERED arm is unmoved: it still says which tree it was recovered from', () => {
  const entry = {
    sha: '2'.repeat(40), date: '2026-05-03T00:00:00-05:00', subject: 'a recovered commit',
    join: {
      state: 'resolved', label: 'd3313bf7:.planning/phases/1', milestone: 'v3.5.9', phase: '1',
      plan: '1', task: '1', description: 'the recovered task',
      recovered: { prune: '7'.repeat(40), parent: 'd3313bf7' + '0'.repeat(32), tree: '.planning/phases/1' },
    },
  };
  assert.equal(lineFor(renderChain([entry]).text, 'phase'),
    'phase: v3.5.9 phase 1 (recovered from d3313bf7:.planning/phases/1)');
});

test('the AMBIGUOUS arm is unmoved: it names every candidate and picks none', () => {
  const entry = {
    sha: '3'.repeat(40), date: '2026-05-04T00:00:00-05:00', subject: 'a contested commit',
    join: {
      state: 'ambiguous',
      matches: [
        { label: '_archive-v9.0.0/3', milestone: 'v9.0.0', phase: '3', plan: '1', task: '4', description: 'one' },
        { label: 'tasks/a-slug', milestone: null, phase: null, slug: 'a-slug', plan: '', task: '1', description: 'two' },
      ],
    },
  };
  assert.equal(lineFor(renderChain([entry]).text, 'phase'),
    'phase: AMBIGUOUS - 2 records name this commit: '
    + '_archive-v9.0.0/3 (plan 1, task 4); tasks/a-slug (plan -, task 1)');
});

test('the GAP arm is unmoved: an unresolved entry still opens with NOT RESOLVED', () => {
  const entry = {
    sha: '4'.repeat(40), date: '2026-05-05T00:00:00-05:00', subject: 'an unrecorded commit',
    join: { state: 'unresolved', gap: { close: null, scope: null, paths: [], archive: [] } },
  };
  const line = lineFor(renderChain([entry]).text, 'phase');
  assert.ok(line.startsWith('phase: NOT RESOLVED - '), `got: ${line}`);
});

// --- WHY-02 / v3.6.1 D-01: the exclusion block ----------------------------
//
// The bare arm keeps `--follow` and so keeps git's default history
// simplification; the seam measures what that left out and hands it here. The
// block has to live in `text` because D-02 has the skill relay `text` verbatim
// and print no envelope field.

const EXCLUDED = [
  { sha: 'b'.repeat(40), parentCount: 2 },
  { sha: 'c'.repeat(40), parentCount: 2 },
  { sha: 'd'.repeat(40), parentCount: 1 },
];

test('the exclusion block names the count, what dropped them, the merge count and the invocation', () => {
  const { text } = renderChain([OLD, NEW], { excluded: EXCLUDED, path: 'a/b.rs' });
  assert.match(text, /^3 commit\(s\) also touched this path and are NOT listed above\./m);
  assert.match(text, /history simplification/);
  assert.match(text, /--follow/, 'and why this chain keeps it');
  assert.match(text, /2 of them are merges\./, 'counted from the parent lists, not asserted');
  for (const e of EXCLUDED) assert.ok(text.includes(e.sha.slice(0, 8)), `${e.sha.slice(0, 8)} is named`);
  assert.match(text, /see them with: git log --full-history -- a\/b\.rs$/m);
});

test('one excluded merge reads as one, not as a plural', () => {
  const { text } = renderChain([NEW], { excluded: [{ sha: 'e'.repeat(40), parentCount: 2 }], path: 'a/b.rs' });
  assert.match(text, /1 of them is a merge\./);
});

test('a chain with nothing excluded grows no block at all - an absent report and an empty one alike', () => {
  const marker = 'NOT listed above';
  assert.ok(!renderChain([OLD, NEW]).text.includes(marker), 'no report at all renders nothing');
  assert.ok(!renderChain([OLD, NEW], { excluded: [] }).text.includes(marker), 'an empty report renders nothing');
  assert.ok(!renderChain([OLD, NEW], { excluded: null }).text.includes(marker), 'and so does an absent one');
  assert.equal(renderChain([OLD, NEW]).text, renderChain([OLD, NEW], { excluded: [] }).text,
    'byte-identical: a chain with no gap must not pay for the gap block');
});

test('the excluded list is capped with the remainder counted, never dropped', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ sha: String(i).repeat(40).slice(0, 40), parentCount: 2 }));
  const { text } = renderChain([NEW], { excluded: many, path: 'a/b.rs' });
  assert.match(text, /^9 commit\(s\) also touched/m);
  assert.match(text, /^ {2}\.\.\. and 6 more$/m);
});

test('the truncation note stays the LAST line even when the exclusion block renders', () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({
    sha: String(i).padStart(40, '0'),
    date: new Date(2026, 0, i + 1).toISOString(),
    subject: `commit ${i}`,
  }));
  const { text } = renderChain(entries, { excluded: EXCLUDED, path: 'a/b.rs' });
  const lines = text.split('\n');
  assert.match(lines[lines.length - 1], /^Showing \d+ of 25 commit\(s\)\. Pass --top 25 to see the rest\.$/);
  assert.ok(text.indexOf('NOT listed above') < text.indexOf('Pass --top'),
    'the exclusion block renders before the truncation note');
});
