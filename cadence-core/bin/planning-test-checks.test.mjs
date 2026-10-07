// Zero-dep tests for `planning.mjs test-checks`. Run:
// node --test cadence-core/bin/planning-test-checks.test.mjs
//
// The parse tests run `parseTestChecks` over strings; the CLI tests spawn the
// seam over fixture plans on disk, since that spawned answer is what /cad-plan
// and the review fire site read.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING } from './planning.test.mjs';
import { parseTestChecks } from './planning/test-checks.mjs';

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
