// Zero-dep tests for `planning.mjs test-checks`. Run:
// node --test cadence-core/bin/planning-test-checks.test.mjs
//
// The parse tests run `parseTestChecks` over strings; the CLI tests spawn the
// seam over fixture plans on disk, since that spawned answer is what /cad-plan
// and the review fire site read.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANNING, isEntryFile } from './planning.test.mjs';
import { parseTestChecks } from './planning/test-checks.mjs';

const test = isEntryFile(import.meta.url) ? nodeTest : () => {};

const MAP_HEAD = '| Criterion | Task | Command | Test file | Function | Expected | Unit and fakes | Break |\n'
  + '|---|---|---|---|---|---|---|---|\n';
const TESTS_HEAD = '| Test | Supplied | Asserts | Catches |\n|---|---|---|---|\n';

/** A plan with two tasks around the given map and tests section bodies. */
function plan({ map, tests } = {}) {
  return '---\nphase: 3\nplan: 1\n---\n\n# Plan\n\n## Context\n\n- context\n\n'
    + (map === undefined ? '' : `## Evidence map\n\n${map}\n`)
    + '## Tasks\n\n### Task 1: first\n\n- **Files:** a.mjs\n\n### Task 2: second\n\n- **Files:** b.mjs\n\n'
    + (tests === undefined ? '' : `## Tests\n\n${tests}\n`)
    + '## Notes\n\n- none\n';
}

/** The 1-based line of the first line of `text` that contains `needle`. */
const lineOf = (text, needle) => text.split('\n').findIndex((l) => l.includes(needle)) + 1;

const FULL = plan({
  map: 'Every criterion is bound to exactly one check.\n\n' + MAP_HEAD
    + '| AC1 | 1 | `node --test a.test.mjs` | `a.test.mjs` | `adds two` | 4 | add(); no fakes | returns a+a |\n'
    + '| AC2 the flag | Task 2 | `grep -c x b.md \\| wc -l` | none | none | 1 | b.md | the line deleted |\n'
    + '| AC3 | 2 | human-verify: the banner reads green | none | none | green | the panel | red banner |\n',
  tests: 'A test not on this list is not written.\n\n'
    + '**Task 1** - `a.test.mjs`, run by `node --test a.test.mjs`\n\n' + TESTS_HEAD
    + '| adds two | 2, 2 | 4 | add returning a+a |\n'
    + '| adds zero | 2, 0 | 2 | add returning 0 |\n\n'
    + '**Task 2**: `b.test.mjs` `node --test b.test.mjs`\n\n' + TESTS_HEAD
    + '| reads b | b.md | one line | an empty read |\n',
});

function cli(paths) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, 'test-checks', ...paths], { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

function onDisk(text) {
  const f = join(mkdtempSync(join(tmpdir(), 'cad-test-checks-')), 'PLAN-1.md');
  writeFileSync(f, text);
  return f;
}

// --- reading a well-formed plan ----------------------------------------------

test('a full plan reads every check and listed test, cell by cell, with its plan line', () => {
  const r = parseTestChecks(FULL);
  assert.deepEqual(r.issues, []);
  assert.equal(r.sections, 'both');
  assert.equal(r.checks.length, 3);
  assert.deepEqual(r.checks[0], {
    criterion: 'AC1', criterion_cell: 'AC1', task: 1, command: 'node --test a.test.mjs',
    test_file: 'a.test.mjs', function: 'adds two', expected: '4', unit_and_fakes: 'add(); no fakes',
    break: 'returns a+a', line: lineOf(FULL, '| AC1 |'), human_verify: false,
  });
  assert.equal(r.checks[2].human_verify, true);
  assert.equal(r.checks[2].command, 'human-verify: the banner reads green');
  assert.deepEqual(r.tests.map((t) => [t.task, t.test_file, t.command, t.test]), [
    [1, 'a.test.mjs', 'node --test a.test.mjs', 'adds two'],
    [1, 'a.test.mjs', 'node --test a.test.mjs', 'adds zero'],
    [2, 'b.test.mjs', 'node --test b.test.mjs', 'reads b'],
  ]);
  assert.deepEqual(r.tests[1], {
    task: 1, test_file: 'a.test.mjs', command: 'node --test a.test.mjs',
    test: 'adds zero', supplied: '2, 0', asserts: '2', catches: 'add returning 0',
    line: lineOf(FULL, '| adds zero |'),
  });
});

test('a Criterion cell with text after its token reports the token alone, and Task 2 reads as 2', () => {
  const c = parseTestChecks(FULL).checks[1];
  assert.equal(c.criterion, 'AC2');
  assert.equal(c.criterion_cell, 'AC2 the flag');
  assert.equal(c.task, 2);
});

test('an MT<n> token reads exactly as an AC<N> one does', () => {
  const r = parseTestChecks(plan({ map: MAP_HEAD + '| MT2 second bullet | 1 | `x` | none | none | y | z | w |\n' }));
  assert.deepEqual(r.issues, []);
  assert.equal(r.checks[0].criterion, 'MT2');
  assert.equal(r.checks[0].criterion_cell, 'MT2 second bullet');
});

test('a \\| inside a command comes back unescaped', () => {
  assert.equal(parseTestChecks(FULL).checks[1].command, 'grep -c x b.md | wc -l');
});

test('a none test file and function read empty', () => {
  const c = parseTestChecks(FULL).checks[1];
  assert.equal(c.test_file, '');
  assert.equal(c.function, '');
});

// --- the lines it cannot read ------------------------------------------------

test('a header other than the two is named with its line, and its rows are not read', () => {
  const text = plan({ map: MAP_HEAD + '| AC1 | 1 | x | none | none | y | z | w |\n\n'
    + '| Criterion | Check |\n|---|---|\n| AC2 | x |\n' });
  const r = parseTestChecks(text);
  assert.equal(r.checks.length, 1);
  assert.deepEqual(r.issues.map((i) => i.line), [lineOf(text, '| Criterion | Check |'), lineOf(text, '| AC2 | x |')]);
  assert.match(r.issues[0].reason, /not the evidence-map header/);
});

test('the header is compared trimmed and case-insensitive', () => {
  const r = parseTestChecks(plan({ map: '|  criterion | TASK | command | test FILE | function | expected | unit and fakes | break  |\n'
    + '|---|---|---|---|---|---|---|---|\n| AC1 | 1 | x | none | none | y | z | w |\n' }));
  assert.deepEqual(r.issues, []);
  assert.equal(r.checks.length, 1);
});

test('a row whose cell count differs from its header is named with its line', () => {
  const text = plan({ map: MAP_HEAD + '| AC1 | 1 | x |\n', tests: '**Task 1** `t.mjs` `node t.mjs`\n\n' + TESTS_HEAD + '| a | b | c |\n' });
  const r = parseTestChecks(text);
  assert.deepEqual(r.issues.map((i) => i.line), [lineOf(text, '| AC1 | 1 | x |'), lineOf(text, '| a | b | c |')]);
  assert.match(r.issues[0].reason, /3 cells where the header has 8/);
  assert.match(r.issues[1].reason, /3 cells where the header has 4/);
});

test('a tests table with no label before it is named, and so is a label without two backtick spans', () => {
  const text = plan({ tests: 'Opening sentence.\n\n' + TESTS_HEAD + '| a | b | c | d |\n\n'
    + '**Task 2** `only-one.mjs`\n\n' + TESTS_HEAD + '| e | f | g | h |\n' });
  const r = parseTestChecks(text);
  assert.equal(r.tests.length, 0);
  const firstHeader = lineOf(text, '| Test | Supplied |');
  assert.deepEqual(r.issues[0], { line: firstHeader, reason: 'table has no **Task <n>** label line before it' });
  const label = r.issues.find((i) => i.line === lineOf(text, '**Task 2**'));
  assert.match(label.reason, /two backtick spans/);
  assert.ok(r.issues.some((i) => i.line === lineOf(text, '| e | f |')));
});

test('a Criterion cell without a token, a reused token and a Task cell naming no task are each named', () => {
  const text = plan({ map: MAP_HEAD
    + '| the flag | 1 | x | none | none | y | z | w |\n'
    + '| AC1 | 1 | x | none | none | y | z | w |\n'
    + '| AC1 again | 2 | x2 | none | none | y | z | w |\n'
    + '| AC4 | 9 | x | none | none | y | z | w |\n' });
  const r = parseTestChecks(text);
  assert.deepEqual(r.checks.map((c) => c.criterion), ['AC1']);
  assert.deepEqual(r.issues.map((i) => i.line),
    [lineOf(text, '| the flag |'), lineOf(text, '| AC1 again |'), lineOf(text, '| AC4 |')]);
  assert.match(r.issues[0].reason, /AC<N> or MT<n>/);
  assert.match(r.issues[1].reason, new RegExp(`AC1 is already carried by line ${lineOf(text, '| AC1 |')}`));
  assert.match(r.issues[2].reason, /names no ### Task <n> heading/);
});

test('an evidence-map section holding no map table is named at its heading', () => {
  const text = plan({ map: 'Only prose here.\n' });
  const r = parseTestChecks(text);
  assert.equal(r.sections, 'evidence_map');
  assert.deepEqual(r.issues, [{ line: lineOf(text, '## Evidence map'), reason: '## Evidence map holds no map table' }]);
});

test('prose lines inside the sections are not issues', () => {
  assert.deepEqual(parseTestChecks(FULL).issues, []);
});

test('a fenced ## Evidence map example is not read as the section', () => {
  const text = plan({}).replace('## Tasks', '```\n## Evidence map\n\n' + MAP_HEAD
    + '| AC1 | 1 | x | none | none | y | z | w |\n```\n\n## Tasks');
  const r = parseTestChecks(text);
  assert.equal(r.sections, 'neither');
  assert.deepEqual(r.checks, []);
  assert.deepEqual(r.issues, []);
});

test('a plan with neither section says so, distinct from sections present and empty', () => {
  assert.equal(parseTestChecks(plan({})).sections, 'neither');
  const empty = parseTestChecks(plan({ map: MAP_HEAD, tests: 'No tests this time.\n' }));
  assert.equal(empty.sections, 'both');
  assert.deepEqual(empty.checks, []);
  assert.deepEqual(empty.tests, []);
});

// --- the CLI -----------------------------------------------------------------

test('two paths come back as two entries, in argument order', () => {
  const a = onDisk(FULL);
  const b = onDisk(plan({}));
  const r = cli([b, a]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.plans.map((p) => [p.plan, p.sections]), [[b, 'neither'], [a, 'both']]);
  assert.equal(r.plans[1].checks.length, 3);
  assert.equal(r.plans[1].tests.length, 3);
});

test('no path given is refused with a hint', () => {
  const r = cli([]);
  assert.equal(r.ok, false);
  assert.equal(r._exit, 1);
  assert.equal(r.reason, 'bad-args');
  assert.ok(r.hint);
});

test('a path it cannot read is refused naming that path, never as internal', () => {
  const r = cli(['/nonexistent/PLAN.md']);
  assert.equal(r.ok, false);
  assert.notEqual(r.reason, 'internal');
  assert.match(r.detail, /\/nonexistent\/PLAN\.md/);
  assert.ok(r.hint);
});

// --- the planner's block and the parser are one grammar ----------------------

test('a plan built from plan.md\'s <test_method> header rows and label line reads with no issue', () => {
  const md = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'workflows', 'plan.md'), 'utf8');
  const block = md.slice(md.indexOf('<test_method>'), md.indexOf('</test_method>')).split('\n');
  const at = (prefix) => {
    const i = block.findIndex((l) => l.startsWith(prefix));
    assert.ok(i >= 0, `plan.md's <test_method> block has no line starting ${prefix}`);
    return i;
  };
  const map = at('| Criterion |');
  const tests = at('| Test |');
  const label = block[at('**Task <n>**')].replace('<n>', '1');
  const text = plan({
    map: `${block[map]}\n${block[map + 1]}\n| AC1 rest | 1 | \`node a.mjs \\| wc\` | a.test.mjs | f | 1 | a | b |\n`,
    tests: `${label}\n\n${block[tests]}\n${block[tests + 1]}\n| t | s | a | c |\n`,
  });
  const r = parseTestChecks(text);
  assert.deepEqual(r.issues, []);
  assert.equal(r.checks.length, 1);
  assert.equal(r.checks[0].command, 'node a.mjs | wc');
  assert.deepEqual([r.tests.length, r.tests[0].test_file], [1, '<test file>']);
});

// --- the report's `Test evidence:` section -----------------------------------
//
// The test-evidence switch has the executor record, in its report, each
// check's red-first run and each listed test's negative control. `test-checks`
// attaches those rows to what the plan lists; `test-evidence` (below) judges
// whether the record is complete.

import { mkdirSync } from 'node:fs';

const RUN_HEAD = '| Check | Command | Red by | Red at | Failing line | Passing line |\n|---|---|---|---|---|---|\n';
const CONTROL_HEAD = '| Task | Test | Break | Failing line | Restore |\n|---|---|---|---|---|\n';

/** FULL's complete red-run rows, at commit `h`. AC3 is human-verify, so it has none. */
const fullRuns = (h) => `| AC1 | node --test a.test.mjs | before | ${h} | not ok 1 - adds two | ok 1 - adds two |\n`
  + `| AC2 the flag | grep -c x b.md \\| wc -l | break | ${h} | 0 | 1 |\n`;
/** FULL's complete control rows: one per listed test, and AC1's (it has a test file). */
const FULL_CONTROLS = '| 1 | adds two | add returns a+a | not ok 1 - adds two | add restored; ok 1 - adds two |\n'
  + '| 1 | adds zero | add returns 0 | not ok 2 - adds zero | add restored; ok 2 - adds zero |\n'
  + '| 2 | reads b | read returns empty | not ok 1 - reads b | read restored; ok 1 - reads b |\n'
  + '| AC1 | adds two | add returns a+a | not ok 1 - adds two | add restored; ok 1 - adds two |\n';

/** An executor report around the given evidence-table bodies; `section: false` writes none. */
function report({ runs = fullRuns('abc1234'), controls = FULL_CONTROLS, status = 'PLAN COMPLETE', section = true } = {}) {
  return `${status}\nPlan: PLAN-1.md\nTasks: 2 of 2\n| Task | Commit | Note |\n|---|---|---|\n`
    + '| 1 - first | abc1234 | done |\n| 2 - second | def5678 | done |\n\n'
    + (section ? `Test evidence:\n\n${RUN_HEAD}${runs}\n${CONTROL_HEAD}${controls}\n` : '')
    + 'Deviations: none\nOpen items: none\n';
}

/** A plan at `<dir>/PLAN-1.md` and, unless `body` is null, its report at `<dir>/reports/plan-1.md`. */
function planWithReport(planText, body, dir = mkdtempSync(join(tmpdir(), 'cad-test-evidence-'))) {
  writeFileSync(join(dir, 'PLAN-1.md'), planText);
  if (body !== null) {
    mkdirSync(join(dir, 'reports'), { recursive: true });
    writeFileSync(join(dir, 'reports', 'plan-1.md'), body);
  }
  return { plan: join(dir, 'PLAN-1.md'), report: join(dir, 'reports', 'plan-1.md'), dir };
}

test('evidence: a full section attaches every row, a check\'s control row included', () => {
  const body = report();
  const { plan: p } = planWithReport(FULL, body);
  const r = cli([p]).plans[0];
  assert.equal(r.report.state, 'read');
  assert.deepEqual([r.report.orphans, r.report.duplicates, r.report.issues], [[], [], []]);
  const [ac1, ac2, ac3] = r.checks;
  assert.deepEqual(ac1.evidence.run, {
    check: 'AC1', command: 'node --test a.test.mjs', red_by: 'before', red_at: 'abc1234',
    failing_line: 'not ok 1 - adds two', passing_line: 'ok 1 - adds two', line: lineOf(body, '| AC1 | node'),
  });
  assert.equal(ac1.evidence.control.line, lineOf(body, '| AC1 | adds two'));
  assert.equal(ac2.evidence.run.red_by, 'break');
  assert.equal(ac2.evidence.control, null);
  assert.deepEqual(ac3.evidence, { run: null, control: null });
  assert.deepEqual(r.tests.map((t) => t.evidence.control.line),
    [lineOf(body, '| 1 | adds two'), lineOf(body, '| 1 | adds zero'), lineOf(body, '| 2 | reads b')]);
  assert.equal(r.tests[1].evidence.control.restore, 'add restored; ok 2 - adds zero');
});

test('evidence: a Check cell reading AC4 then other text attaches to AC4, and an MT2 row to MT2', () => {
  const text = plan({ map: MAP_HEAD + '| AC4 | 1 | `x` | none | none | y | z | w |\n'
    + '| MT2 bullet | 2 | `v` | none | none | y | z | w |\n' });
  const { plan: p } = planWithReport(text, report({
    runs: '| AC4 the switch row | x | before | abc1234 | f | p |\n| MT2 | v | break | abc1234 | f | p |\n', controls: '' }));
  const r = cli([p]).plans[0];
  assert.deepEqual(r.checks.map((c) => [c.criterion, c.evidence.run && c.evidence.run.check]),
    [['AC4', 'AC4 the switch row'], ['MT2', 'MT2']]);
  assert.deepEqual(r.report.orphans, []);
});

test('evidence: a second row for one check is reported as a duplicate with its line', () => {
  const runs = fullRuns('abc1234') + '| AC1 again | node --test a.test.mjs | before | abc1234 | x | y |\n';
  const body = report({ runs });
  const r = cli([planWithReport(FULL, body).plan]).plans[0];
  assert.equal(r.checks[0].evidence.run.line, lineOf(body, '| AC1 | node'));
  assert.deepEqual(r.report.duplicates,
    [{ line: lineOf(body, '| AC1 again'), table: 'red-run', first: lineOf(body, '| AC1 | node') }]);
});

test('evidence: a missing row leaves its entry without evidence', () => {
  const body = report({ runs: fullRuns('abc1234').split('\n')[1] + '\n',
    controls: FULL_CONTROLS.split('\n').filter((l) => !l.includes('adds zero')).join('\n') });
  const r = cli([planWithReport(FULL, body).plan]).plans[0];
  assert.equal(r.checks[0].evidence.run, null);
  assert.ok(r.checks[1].evidence.run);
  assert.equal(r.tests[1].evidence.control, null);
  assert.ok(r.tests[0].evidence.control);
});

test('evidence: an orphan row is named with its line', () => {
  const body = report({ runs: fullRuns('abc1234') + '| AC9 | x | before | abc1234 | f | p |\n',
    controls: FULL_CONTROLS + '| 2 | not listed | b | f | r |\n' });
  const r = cli([planWithReport(FULL, body).plan]).plans[0];
  assert.deepEqual(r.report.orphans, [
    { line: lineOf(body, '| AC9 |'), table: 'red-run' },
    { line: lineOf(body, '| 2 | not listed'), table: 'control' },
  ]);
});

test('evidence: an escaped \\| in a Command reads back unescaped', () => {
  const r = cli([planWithReport(FULL, report()).plan]).plans[0];
  assert.equal(r.checks[1].evidence.run.command, 'grep -c x b.md | wc -l');
});

test('evidence: an absent report is stated, and so is an absent section', () => {
  const absent = cli([planWithReport(FULL, null).plan]).plans[0];
  assert.equal(absent.report.state, 'absent');
  assert.equal(absent.checks[0].evidence.run, null);
  const none = cli([planWithReport(FULL, report({ section: false })).plan]).plans[0];
  assert.equal(none.report.state, 'no_section');
  assert.deepEqual(none.tests.map((t) => t.evidence.control), [null, null, null]);
});

test('evidence: only plan-<k>.md is read when a plan-<k>.1.md sibling also exists', () => {
  const { plan: p, dir } = planWithReport(FULL, report({ section: false }));
  writeFileSync(join(dir, 'reports', 'plan-1.1.md'), report());
  const r = cli([p]).plans[0];
  assert.equal(r.report.path, join(dir, 'reports', 'plan-1.md'));
  assert.equal(r.report.state, 'no_section');
  assert.equal(r.checks[0].evidence.run, null);
});

test('evidence: the report\'s bytes are unchanged after the run', () => {
  const body = report();
  const { plan: p, report: rp } = planWithReport(FULL, body);
  cli([p]);
  assert.equal(readFileSync(rp, 'utf8'), body);
});

// --- `test-evidence`: a short record is not a completed plan -----------------
//
// The fixtures sit in a scratch git repository with real commits, so a **Red
// at** cell can name one HEAD descends from - and one on a branch it does not.

import { makeTree, run } from './planning.test.mjs';

let repoMemo = null;
/** One scratch repository: `head` on the checked-out branch, `side` on a branch HEAD does not contain. */
function scratchRepo() {
  if (repoMemo) return repoMemo;
  const repo = mkdtempSync(join(tmpdir(), 'cad-test-evidence-repo-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  g('init', '-q');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 'T');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(join(repo, 'a.txt'), 'a');
  g('add', 'a.txt');
  g('commit', '-q', '-m', 'one');
  const head = g('rev-parse', '--short', 'HEAD');
  g('checkout', '-q', '-b', 'side');
  writeFileSync(join(repo, 'b.txt'), 'b');
  g('add', 'b.txt');
  g('commit', '-q', '-m', 'side');
  const side = g('rev-parse', '--short', 'HEAD');
  g('checkout', '-q', '-');
  repoMemo = { repo, head, side };
  return repoMemo;
}

/** A plan and report in a fresh directory inside the scratch repository. */
const inRepo = (planText, body) => planWithReport(planText, body, mkdtempSync(join(scratchRepo().repo, 'case-')));

function judge(p) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, 'test-evidence', p], { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** FULL's complete record at the scratch HEAD, with `edit` applied to its text. */
const recordWith = (edit = (s) => s) => edit(report({ runs: fullRuns(scratchRepo().head) }));

/** Judge FULL against a record; assert it was rejected for `rule`, and only line 1 changed. */
function assertRejected(body, rule, planText = FULL) {
  const { plan: p, report: rp } = inRepo(planText, body);
  const r = judge(p);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'evidence-short');
  assert.match(r.detail, rule);
  assert.ok(r.hint);
  const after = readFileSync(rp, 'utf8');
  assert.equal(after.split('\n')[0], 'PLAN CHECKPOINT: blocked');
  assert.equal(after.slice(after.indexOf('\n')), body.slice(body.indexOf('\n')));
  return r;
}

const swapRun = (from, to) => (s) => s.replace(from, to);

test('test-evidence rejects: a Red at that is not hex, or is too short', () => {
  const h = scratchRepo().head;
  assertRejected(recordWith(swapRun(`before | ${h}`, 'before | zzzzzzz')), /AC1 \(Task 1\): Red at "zzzzzzz" is not 7 to 40 hex/);
  assertRejected(recordWith(swapRun(`before | ${h}`, 'before | abc12')), /AC1 \(Task 1\): Red at "abc12" is not 7 to 40 hex/);
});

test('test-evidence rejects: a well-formed Red at naming no commit', () => {
  assertRejected(recordWith(swapRun(`before | ${scratchRepo().head}`, 'before | 0000000')),
    /AC1 \(Task 1\): Red at 0000000 is not a commit HEAD descends from/);
});

test('test-evidence rejects: a Red at naming a commit on a branch HEAD does not contain', () => {
  const { head, side } = scratchRepo();
  assertRejected(recordWith(swapRun(`break | ${head}`, `break | ${side}`)),
    new RegExp(`AC2 \\(Task 2\\): Red at ${side} is not a commit HEAD descends from`));
});

test('test-evidence rejects: a Failing line or Passing line reading -, then NONE, then blank', () => {
  assertRejected(recordWith(swapRun('| not ok 1 - adds two | ok 1 - adds two |\n| AC2',
    '| - | ok 1 - adds two |\n| AC2')), /AC1 \(Task 1\): red-run row has an empty Failing line/);
  assertRejected(recordWith(swapRun('| 0 | 1 |', '| 0 | NONE |')), /AC2 \(Task 2\): red-run row has an empty Passing line/);
  assertRejected(recordWith(swapRun('| 0 | 1 |', '|  | 1 |')), /AC2 \(Task 2\): red-run row has an empty Failing line/);
});

test('test-evidence rejects: a Red by that is neither before nor break', () => {
  assertRejected(recordWith(swapRun('| before |', '| after |')), /AC1 \(Task 1\): Red by "after" is neither before nor break/);
});

test('test-evidence rejects: a control row with an empty Break, and one with an empty Restore', () => {
  assertRejected(recordWith(swapRun('| add returns 0 |', '| - |')), /test "adds zero" \(Task 1\): control row has an empty Break/);
  assertRejected(recordWith(swapRun('read restored; ok 1 - reads b', 'none')), /test "reads b" \(Task 2\): control row has an empty Restore/);
});

test('test-evidence rejects: a check with a test file and Red by before but no control row', () => {
  const r = assertRejected(recordWith((s) => s.split('\n').filter((l) => !l.startsWith('| AC1 | adds two')).join('\n')),
    /AC1 \(Task 1\): no control row/);
  assert.doesNotMatch(r.detail, /AC2/);
});

test('test-evidence rejects: an unreadable plan line, and a duplicate criterion token', () => {
  const bad = FULL.replace('| AC3 | 2 | human-verify', '| AC3 | 2 | human-verify | extra cell');
  assertRejected(recordWith(), new RegExp(`plan line ${lineOf(bad, 'extra cell')}: row has 9 cells`), bad);
  const dup = FULL.replace('| AC3 | 2 | human-verify', '| AC1 | 2 | human-verify');
  assertRejected(recordWith(), /criterion token AC1 is already carried/, dup);
});

test('test-evidence rejects: a missing red run, naming the check and its Task cell', () => {
  assertRejected(recordWith((s) => s.split('\n').filter((l) => !l.startsWith('| AC2 the flag')).join('\n')),
    /AC2 \(Task 2\): no red-run row/);
});

test('test-evidence accepts a complete record and leaves the file byte-identical', () => {
  const body = recordWith();
  const { plan: p, report: rp } = inRepo(FULL, body);
  const r = judge(p);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.state, 'complete');
  assert.deepEqual([r.checks, r.tests], [3, 3]);
  assert.equal(readFileSync(rp, 'utf8'), body);
});

test('test-evidence accepts a Red by: break row standing as its check\'s control', () => {
  const body = recordWith((s) => s.replace('| before |', '| break |')
    .split('\n').filter((l) => !l.startsWith('| AC1 | adds two')).join('\n'));
  const r = judge(inRepo(FULL, body).plan);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('test-evidence accepts a none Test file check with no control row', () => {
  const body = recordWith((s) => s.replace('| break |', '| before |'));
  assert.ok(!body.includes('| AC2 |') && body.includes('| AC2 the flag | grep -c x b.md \\| wc -l | before |'));
  const r = judge(inRepo(FULL, body).plan);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('test-evidence accepts a plan carrying neither section, saying it lists nothing', () => {
  const body = report({ section: false });
  const { plan: p, report: rp } = inRepo(plan({}), body);
  const r = judge(p);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.state, 'lists-nothing');
  assert.equal(readFileSync(rp, 'utf8'), body);
});

test('test-evidence refuses an absent report and a first line other than PLAN COMPLETE, writing nothing', () => {
  const none = judge(inRepo(FULL, null).plan);
  assert.deepEqual([none.ok, none.reason], [false, 'no-report']);
  const body = recordWith((s) => s.replace('PLAN COMPLETE', 'PLAN PARTIAL'));
  const { plan: p, report: rp } = inRepo(FULL, body);
  const r = judge(p);
  assert.deepEqual([r.ok, r.reason], [false, 'not-complete']);
  assert.equal(readFileSync(rp, 'utf8'), body);
  let out;
  try { out = execFileSync('node', [PLANNING, 'test-evidence'], { encoding: 'utf8' }); } catch (e) { out = e.stdout; }
  assert.equal(JSON.parse(out).reason, 'bad-args');
});

test('agreement: a report test-evidence rejects is outstanding to replay-check and status', () => {
  const dir = makeTree({ roadmap: [{ n: 3, name: 'Three' }], phases: { 3: { plan: ['PLAN-1.md'] } } });
  const repo = dirname(dir);
  const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  g('init', '-q');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 'T');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(join(repo, 'a.txt'), 'a');
  g('add', 'a.txt');
  g('commit', '-q', '-m', 'one');
  const h = g('rev-parse', '--short', 'HEAD');
  const pdir = join(dir, 'phases', '3');
  const body = report({ runs: fullRuns(h).split('\n')[1] + '\n' });
  planWithReport(FULL, body, pdir);
  assert.equal(run(['replay-check', '--phase', '3'], dir).replay, true, 'precondition: complete before the check');

  const r = judge(join(pdir, 'PLAN-1.md'));
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.match(r.detail, /AC1 \(Task 1\): no red-run row/);
  const replay = run(['replay-check', '--phase', '3'], dir);
  assert.deepEqual([replay.replay, replay.dispatch_set], [false, ['PLAN-1.md']]);
  const status = run(['status'], dir);
  assert.deepEqual(status.outstanding, [{ phase: 3, plans: ['PLAN-1.md'] }], JSON.stringify(status.outstanding));
});

// --- the executor's block and the report parse are one grammar ---------------

test('a report built from execute.md\'s <test_evidence> header rows attaches its rows with no issue', () => {
  const md = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'workflows', 'execute.md'), 'utf8');
  const block = md.slice(md.indexOf('<test_evidence>\n'), md.indexOf('</test_evidence>')).split('\n');
  const at = (prefix) => {
    const i = block.findIndex((l) => l.startsWith(prefix));
    assert.ok(i >= 0, `execute.md's <test_evidence> block has no line starting ${prefix}`);
    return i;
  };
  assert.ok(block.includes('Test evidence:') || block.some((l) => l.includes('`Test evidence:`')),
    'the block names the section line');
  const runs = at('| Check |');
  const controls = at('| Task |');
  const body = 'PLAN COMPLETE\nTasks: 2 of 2\n\nTest evidence:\n\n'
    + `${block[runs]}\n${block[runs + 1]}\n`
    + '| AC1 rest | node --test a.test.mjs \\| cat | before | abc1234 | not ok 1 | ok 1 |\n\n'
    + `${block[controls]}\n${block[controls + 1]}\n`
    + '| 1 | adds two | add returns a+a | not ok 1 | restored; ok 1 |\n| AC1 | adds two | b | f | r |\n\n'
    + 'Deviations: none\n';
  const r = cli([planWithReport(FULL, body).plan]).plans[0];
  assert.equal(r.report.state, 'read');
  assert.deepEqual([r.report.issues, r.report.orphans, r.report.duplicates], [[], [], []]);
  assert.equal(r.checks[0].evidence.run.command, 'node --test a.test.mjs | cat');
  assert.ok(r.checks[0].evidence.control);
  assert.ok(r.tests[0].evidence.control);
});

// --- a heading, a name, a line and a red run the read once let through -------

test('a near-miss section heading is an issue at its line, never a plan listing nothing', () => {
  const cases = [
    [plan({ map: MAP_HEAD + '| AC1 | 1 | x | none | none | y | z | w |\n' }), '## Evidence map', ['## Evidence Map', '### Evidence map']],
    [plan({ tests: '**Task 1** `t.mjs` `node t.mjs`\n\n' + TESTS_HEAD + '| a | b | c | d |\n' }), '## Tests', ['## tests', '### Tests']],
  ];
  for (const [base, exact, nears] of cases) {
    for (const near of nears) {
      const text = base.replace(`${exact}\n`, `${near}\n`);
      const r = parseTestChecks(text);
      assert.equal(r.sections, 'neither', near);
      assert.deepEqual(r.issues.map((i) => i.line), [lineOf(text, near)], near);
      assert.match(r.issues[0].reason, new RegExp(`not the section heading ${exact}`), near);
      const j = judge(inRepo(text, report({ section: false })).plan);
      assert.deepEqual([j.ok, j.reason], [false, 'evidence-short'], near);
      assert.match(j.detail, new RegExp(`plan line ${lineOf(text, near)}:`), near);
    }
  }
});

test('a plan line the grammar cannot read sends the hint to the plan, not to a continuation', () => {
  // A map written before the switches, in a shape of its own.
  const text = plan({ map: '| Criterion | Evidence | Command |\n|---|---|---|\n| AC6 | red before green | `cargo test` |\n' });
  assert.ok(parseTestChecks(text).issues.length > 0);
  const j = judge(inRepo(text, report({ section: false })).plan);
  assert.deepEqual([j.ok, j.reason], [false, 'evidence-short']);
  assert.match(j.hint, /does not parse at the plan lines named/);
  assert.match(j.hint, /before any continuation$/);
  // A plan that also lists runs nobody recorded gets the record half after it.
  const both = judge(inRepo(FULL.replace('## Tests\n', '## Tests\n\n- a stray list item\n'),
    report({ section: false })).plan);
  assert.equal(both.reason, 'evidence-short');
  assert.match(both.hint, /does not parse at the plan lines named[\s\S]*; then record the missing runs/);
});

test('a test name listed twice within one task is an issue at the second row, since (Task, Test) keys its control', () => {
  const text = plan({ tests: '**Task 1** `a.test.mjs` `node --test a.test.mjs`\n\n' + TESTS_HEAD
    + '| rejects empty | "" | throws | a missing guard |\n\n'
    + '**Task 1** `c.test.mjs` `node --test c.test.mjs`\n\n' + TESTS_HEAD
    + '| rejects empty | [] | throws | a missing guard |\n\n'
    + '**Task 2** `b.test.mjs` `node --test b.test.mjs`\n\n' + TESTS_HEAD
    + '| rejects empty | {} | throws | a missing guard |\n' });
  const r = parseTestChecks(text);
  const second = lineOf(text, '| rejects empty | [] |');
  assert.deepEqual(r.issues.map((i) => i.line), [second]);
  assert.match(r.issues[0].reason, new RegExp(`test "rejects empty" is already listed for Task 1 at line ${lineOf(text, '| rejects empty | "" |')}`));
  assert.deepEqual(r.tests.map((t) => [t.task, t.test_file]), [[1, 'a.test.mjs'], [2, 'b.test.mjs']]);
});

test('a list item or a table row without its leading | inside either section is named as unread, prose and labels are not', () => {
  const bullets = plan({ tests: 'A test not on this list is not written.\n\n- adds zero: supplied 2,0 asserts 2\n1. adds two\n' });
  const b = parseTestChecks(bullets);
  assert.deepEqual(b.tests, []);
  assert.deepEqual(b.issues.map((i) => i.line), [lineOf(bullets, '- adds zero'), lineOf(bullets, '1. adds two')]);
  assert.match(b.issues[0].reason, /not a table row beginning with \|/);

  const pipeless = plan({ map: MAP_HEAD + '| AC1 | 1 | x | none | none | y | z | w |\n\n'
    + 'Criterion | Task | Command | Test file | Function | Expected | Unit and fakes | Break\n'
    + '---|---|---|---|---|---|---|---\n'
    + 'AC2 | 2 | `v` | none | none | y | z | w\n',
  tests: 'Opening sentence, with `a | b` in a span.\n\n**Task 1** `t.mjs` `node t.mjs | cat`\n\n' + TESTS_HEAD + '| t | s | a | c |\n' });
  const p = parseTestChecks(pipeless);
  assert.deepEqual(p.checks.map((c) => c.criterion), ['AC1']);
  assert.deepEqual(p.tests.map((t) => t.command), ['node t.mjs | cat']);
  assert.deepEqual(p.issues.map((i) => i.line),
    ['Criterion | Task', '---|---', 'AC2 | 2'].map((head) => pipeless.split('\n').findIndex((l) => l.startsWith(head)) + 1));
});

test('test-evidence rejects a Red by: before row whose Red at is the commit the task table says delivered its task', () => {
  const { repo, head } = scratchRepo();
  const full = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  for (const commit of [head, full]) {
    const r = assertRejected(recordWith((s) => s.replace('| 1 - first | abc1234 |', `| 1 - first | ${commit} |`)),
      new RegExp(`AC1 \\(Task 1\\): Red by before at ${head} is the commit that delivered Task 1`));
    assert.doesNotMatch(r.detail, /AC2/);
  }
  const body = recordWith((s) => s.replace('| 2 - second | def5678 |', `| 2 - second | ${head} |`));
  const ok = judge(inRepo(FULL, body).plan);
  assert.equal(ok.ok, true, `a Red by: break row at its task's commit stands: ${JSON.stringify(ok)}`);
});
