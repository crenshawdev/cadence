// Zero-dep tests for `planning.mjs replay-check`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// These are the fixture tests phase 2's acceptance criteria could not have.
// While the replay decision was prose in `workflows/execute.md`, AC1-AC5 were
// observable only by running `/cad-execute` for real and reading
// `.planning/trace.jsonl` afterwards, so each one shipped unverified. The
// criterion each test settles is named on the test, because that link is the
// reason this file exists.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING } from './planning.test.mjs';

/** True iff this module IS the entry file, so a sibling importing from here
 * registers nothing twice (the rule every test file in this directory keeps). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href
      === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}
const test = isEntryFile() ? nodeTest : () => {};

/**
 * A `.planning` tree for one phase.
 * `plans` names the plan files; `reports` maps plan number -> that report's
 * whole body, and a number left out has NO report file, which is the state a
 * genuine continuation is in.
 */
function tree({ phase = 2, plans = ['PLAN.md'], reports = {} } = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-replay-')), '.planning');
  const pdir = join(dir, 'phases', String(phase));
  mkdirSync(pdir, { recursive: true });
  for (const p of plans) writeFileSync(join(pdir, p), `---\nphase: ${phase}\nfiles: []\n---\n# plan\n`);
  if (Object.keys(reports).length) mkdirSync(join(pdir, 'reports'), { recursive: true });
  for (const [k, body] of Object.entries(reports)) {
    writeFileSync(join(pdir, 'reports', `plan-${k}.md`), body);
  }
  return dir;
}

function check(dir, args = []) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, 'replay-check', ...args, '--dir', dir], { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

// --- AC1: the replay is recognised ------------------------------------------

test('AC1: every plan reporting PLAN COMPLETE is a replay, and nothing is dispatched', () => {
  const dir = tree({ reports: { 1: 'PLAN COMPLETE\nTasks: 3 of 3\n' } });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.ok, true);
  assert.equal(r.replay, true);
  assert.deepEqual(r.dispatch_set, []);
  // The caller composes its stop text from what was READ, so the paths it must
  // name come back rather than being re-derived at the message.
  assert.deepEqual(r.reports_read, ['phases/2/reports/plan-1.md']);
});

test('AC1: a multi-plan phase is a replay only when EVERY plan reports complete', () => {
  const dir = tree({
    plans: ['PLAN-1.md', 'PLAN-2.md'],
    reports: { 1: 'PLAN COMPLETE\n', 2: 'PLAN COMPLETE\n' },
  });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, true);
  assert.deepEqual(r.dispatch_set, []);
  assert.deepEqual(r.reports_read,
    ['phases/2/reports/plan-1.md', 'phases/2/reports/plan-2.md']);
});

// --- AC2: a genuine continuation still dispatches ---------------------------

test('AC2: no reports directory at all is not a replay', () => {
  const r = check(tree(), ['--phase', '2']);

  assert.equal(r.replay, false);
  assert.deepEqual(r.dispatch_set, ['PLAN.md']);
  assert.deepEqual(r.reports_read, []);
  assert.equal(r.reports[0].exists, false);
});

test('AC2: PLAN PARTIAL is a continuation, not a replay', () => {
  const dir = tree({ reports: { 1: 'PLAN PARTIAL\nTasks: 2 of 5\n' } });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, false);
  assert.deepEqual(r.dispatch_set, ['PLAN.md']);
});

test('AC2: PLAN CHECKPOINT is a continuation, not a replay', () => {
  const dir = tree({ reports: { 1: 'PLAN CHECKPOINT: decision\n' } });
  assert.equal(check(dir, ['--phase', '2']).replay, false);
});

test('AC2: the status word is the FIRST LINE ONLY - a quoted one in the body cannot fire it', () => {
  // The exact shape the prose test could not pin: a genuine continuation whose
  // open items happen to quote the words. A whole-file search reads this as a
  // replay and refuses a run that has real work left.
  const dir = tree({
    reports: { 1: 'PLAN PARTIAL\nTasks: 2 of 5\n\nOpen items:\n- the last run said PLAN COMPLETE too early\n' },
  });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, false, 'a PLAN COMPLETE quoted in the body is prose about a status, not a claim of one');
  assert.deepEqual(r.dispatch_set, ['PLAN.md']);
});

test('AC2: the first line must match EXACTLY - a suffixed status is not complete', () => {
  const dir = tree({ reports: { 1: 'PLAN COMPLETE - archived\n' } });
  assert.equal(check(dir, ['--phase', '2']).replay, false);
});

// --- AC3: the per-plan skip -------------------------------------------------

test('AC3: plan 1 complete and plan 2 unreported dispatches ONLY plan 2', () => {
  const dir = tree({
    plans: ['PLAN-1.md', 'PLAN-2.md'],
    reports: { 1: 'PLAN COMPLETE\nTasks: 4 of 4\n' },
  });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, false, 'one plan still has work, so the run proceeds');
  assert.deepEqual(r.dispatch_set, ['PLAN-2.md'], 'plan 1 is not re-dispatched');
});

test('AC3: a partially reported phase skips only the plans that finished', () => {
  const dir = tree({
    plans: ['PLAN-1.md', 'PLAN-2.md', 'PLAN-3.md'],
    reports: { 1: 'PLAN COMPLETE\n', 2: 'PLAN PARTIAL\n', 3: 'PLAN COMPLETE\n' },
  });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, false);
  assert.deepEqual(r.dispatch_set, ['PLAN-2.md']);
});

// --- AC4: --rerun -----------------------------------------------------------

test('AC4: --rerun clears the replay and widens the dispatch set to every plan', () => {
  const dir = tree({
    plans: ['PLAN-1.md', 'PLAN-2.md'],
    reports: { 1: 'PLAN COMPLETE\n', 2: 'PLAN COMPLETE\n' },
  });
  const r = check(dir, ['--phase', '2', '--rerun']);

  assert.equal(r.rerun, true);
  assert.equal(r.replay, false);
  assert.deepEqual(r.dispatch_set, ['PLAN-1.md', 'PLAN-2.md']);
  // The reports are still READ under --rerun, so the run can say what it is
  // running over rather than pretending it did not look.
  assert.equal(r.reports_read.length, 2);
});

// --- the report path the executor actually writes ---------------------------

test('a bare PLAN.md is keyed k=1 and PLAN-<k>.md by its own number', () => {
  const dir = tree({ plans: ['PLAN-3.md'], reports: { 3: 'PLAN COMPLETE\n' } });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.reports[0].k, 3);
  assert.equal(r.reports[0].report, 'phases/2/reports/plan-3.md');
  assert.equal(r.replay, true);
});

test('a rotated sibling plan-<k>.<n>.md never decides the answer', () => {
  // report-rotation.mjs mints these when an executor rotates a prior run's
  // report aside. A glob would let the OLD run's report answer for this one.
  const dir = tree({ reports: { '1.1': 'PLAN COMPLETE\n' } });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, false, 'plan-1.1.md is not plan-1.md');
  assert.deepEqual(r.dispatch_set, ['PLAN.md']);
});

// --- refusals ---------------------------------------------------------------

test('a phase with no plan files is not a replay - that is the unplanned state', () => {
  // `[].every(...)` is true, so without the length guard an unplanned phase
  // reports as already executed and its first real run is refused.
  const dir = tree({ plans: [] });
  const r = check(dir, ['--phase', '2']);

  assert.equal(r.replay, false);
  assert.deepEqual(r.dispatch_set, []);
});

test('a missing phase directory refuses by name and exits non-zero', () => {
  const r = check(tree(), ['--phase', '9']);

  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-phase-dir');
  assert.equal(r._exit, 1);
});

test('no --phase refuses by name rather than guessing a phase', () => {
  const r = check(tree(), []);

  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /replay-check needs --phase/);
  assert.equal(r._exit, 1);
});
