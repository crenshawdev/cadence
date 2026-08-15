// Grammar tests for lib/risk-diff.mjs and the `risk-check` seam that feeds it -
// whether a committed RANGE touched a risk surface, and the record that says so
// was written.
// Run: node --test cadence-core/bin/risk-diff.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test()
// with a sequential loop reports the loop's count, not the rows', so a row that
// never ran still looks green (prior-project finding, CAPTURE.md).
//
// The subject is one rule (RSK-01/RSK-02): the answer is always computed and
// always recorded, so "the detection step was skipped" stops being readable as
// "it ran and matched nothing". Several rows below are about the states the
// scan declines to collapse - a binary file, an unreadable body - because those
// are the half a later "simplification" would fold into `matches: []`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDiff } from './lib/risk-diff.mjs';
import { CATEGORIES } from './lib/surface-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(HERE, 'planning.mjs');
const ALL = [...CATEGORIES];

/** A one-file unified diff with the given added lines. */
const diffOf = (path, added) => `diff --git a/${path} b/${path}\n`
  + `index 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n`
  + `@@ -1,2 +1,${1 + added.length} @@\n unchanged context line\n`
  + `${added.map((l) => `+${l}`).join('\n')}\n`;

// --- the pure lib -------------------------------------------------------------

test('a risky range matches a category and names the signal that found it', () => {
  const r = scanDiff(diffOf('src/auth/login.ts',
    ['const claims = jwt.verify(raw, KEY);']), ALL);
  assert.equal(r.checked, true);
  assert.ok(r.matches.length >= 1, 'a JWT verify under src/auth matched nothing');
  for (const m of r.matches) {
    assert.ok(ALL.includes(m.category), `${m.category} is not one of the eight tokens`);
    assert.ok(typeof m.signal === 'string' && m.signal,
      `the ${m.category} match names no signal`);
  }
  assert.ok(r.matches.some((m) => m.category === 'auth'));
});

test('a clean range is judged clean: no matches, and not inconclusive', () => {
  const r = scanDiff(diffOf('docs/notes.md', ['A paragraph about the roadmap.']), ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.inconclusive, false);
  assert.equal(r.checked, true);
  assert.deepEqual(r.categories, ALL);
});

test('a binary-only range is inconclusive, never collapsed into a clean answer', () => {
  // The state this seam exists for. Git rendered the change as bytes, so the
  // scan cannot judge it - reporting `matches: []` alone would hand the caller
  // a cleared range it never read.
  const r = scanDiff('diff --git a/logo.png b/logo.png\n'
    + 'index 1111111..2222222 100644\n'
    + 'Binary files a/logo.png and b/logo.png differ\n', ALL);
  assert.equal(r.checked, true);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('an empty body is `checked: false`, and that implies inconclusive', () => {
  const r = scanDiff('', ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('a substring is not a path signal: src/authority.rs is not `auth`', () => {
  // The rule cmdLeaseCheck already states for declared paths, held here for
  // detection: whole segments only, or `src/auth` licenses `src/authority.rs`.
  const r = scanDiff(diffOf('src/authority.rs', ['pub fn rank(x: u32) -> u32 { x + 1 }']), ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.checked, true);
});

test('a null body returns a record rather than throwing', () => {
  const r = scanDiff(null, ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('a scalar body returns a record rather than throwing', () => {
  const r = scanDiff(42, ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.categories, ALL);
});

test('a partly-binary range that also matched reports BOTH, not one or the other', () => {
  // `inconclusive` is independent of `matches`: collapsing either into the
  // other loses the half the caller has to act on.
  const r = scanDiff(`${diffOf('db/migrations/003_add_column.sql', ['ALTER TABLE users ADD COLUMN kind text;'])}`
    + 'diff --git a/logo.png b/logo.png\n'
    + 'Binary files a/logo.png and b/logo.png differ\n', ALL);
  assert.equal(r.inconclusive, true);
  assert.ok(r.matches.some((m) => m.category === 'migrations'));
});

test('the vocabulary is the CALLER\'s: a category outside it is never reported', () => {
  const r = scanDiff(diffOf('src/auth/login.ts', ['const c = jwt.verify(raw, KEY);']),
    ['migrations', 'billing']);
  assert.deepEqual(r.categories, ['migrations', 'billing']);
  assert.deepEqual(r.matches.map((m) => m.category).filter((c) => c === 'auth'), []);
});

test('context lines are not an input - only added and removed lines are read', () => {
  // A `DROP TABLE` sitting UNCHANGED beside an edit is the code the range did
  // not touch. Matching it would fire the one blocking gate on every neighbour
  // of every edit.
  const body = 'diff --git a/src/report.ts b/src/report.ts\n'
    + 'index 1111111..2222222 100644\n--- a/src/report.ts\n+++ b/src/report.ts\n'
    + '@@ -1,3 +1,3 @@\n const sql = "DROP TABLE users";\n-const n = 1;\n+const n = 2;\n';
  const r = scanDiff(body, ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.inconclusive, false);
});

// --- the `risk-check run` seam ------------------------------------------------

/** A scratch repository with its own `.planning/`, so the trace written here is
 * the fixture's and never this project's own record. */
function riskRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'cad-risk-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: repo });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  const dir = join(repo, '.planning');
  mkdirSync(dir, { recursive: true });
  return { repo, dir };
}

/** Write, add and commit one file; return the new HEAD sha. */
function commitFile(repo, rel, body) {
  const file = join(repo, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  execFileSync('git', ['add', '--', rel], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', `add ${rel}`], { cwd: repo });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
}

/** Run the seam inside a repo; parse its one JSON line and its exit code. */
function riskCheck(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'risk-check', ...args],
      { encoding: 'utf8', cwd: repo });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** Every parsed line of the fixture's trace file, or [] when it was never written. */
function traceLines(dir) {
  let text;
  try { text = readFileSync(join(dir, 'trace.jsonl'), 'utf8'); } catch { return []; }
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** The `outcome`/`risk_check` lines alone. */
const riskRecords = (dir) => traceLines(dir)
  .filter((e) => e.family === 'outcome' && e.event === 'risk_check');

test('risk-check run: a risky range answers ok:true with matches AND leaves one record', () => {
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', 'export const verify = (t) => jwt.verify(t, KEY);\n');
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.matches.length >= 1, JSON.stringify(r));
  assert.equal(r.trace.written, true, JSON.stringify(r.trace));
  const records = riskRecords(dir);
  assert.equal(records.length, 1, `expected exactly one risk_check line, got ${records.length}`);
  assert.equal(records[0].family, 'outcome');
  assert.equal(records[0].event, 'risk_check');
  assert.equal(records[0].checked, true);
  assert.ok(records[0].matches.length >= 1);
});

test('risk-check run: a CLEAN range leaves the same record - the whole point of the seam', () => {
  // The defect RSK-01 closes. A fire used to write a lifecycle event and a
  // non-match wrote nothing, so "the detection step was skipped" and "it ran
  // and matched nothing" were the same bytes on disk: none.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'docs/notes.md', 'A paragraph about the roadmap.\n');
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.matches, []);
  assert.equal(r.inconclusive, false);
  const records = riskRecords(dir);
  assert.equal(records.length, 1, `expected exactly one risk_check line, got ${records.length}`);
  assert.deepEqual(records[0].matches, []);
  assert.equal(records[0].inconclusive, false);
});

test('risk-check run: a --surfaces token outside the eight is refused, and appends NOTHING', () => {
  // A caller who mistyped the scope of a blocking gate must see a refusal, not
  // a narrowed clean answer - the rule `trace append --tokens` already states.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', 'export const verify = (t) => jwt.verify(t, KEY);\n');
  const r = riskCheck(repo, dir,
    ['run', '--phase', '1', '--base', base, '--head', 'HEAD', '--surfaces', 'secrets,authz']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.equal(r._exit, 1);
  assert.deepEqual(traceLines(dir), [], 'a malformed call appended a record anyway');
});

test('risk-check run: an unreadable range is ok:false, and STILL leaves its record', () => {
  const { repo, dir } = riskRepo();
  commitFile(repo, 'README.md', 'start\n');
  const r = riskCheck(repo, dir,
    ['run', '--phase', '1', '--plan', '1', '--base', 'no-such-ref', '--head', 'HEAD']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.checked, false);
  assert.equal(r._exit, 1);
  const records = riskRecords(dir);
  assert.equal(records.length, 1, 'a range that could not be read left no record of the attempt');
  assert.equal(records[0].checked, false);
});

test('risk-check run: --base and --head are required, and a flag-shaped ref is refused', () => {
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  const missing = riskCheck(repo, dir, ['run', '--phase', '1', '--base', base]);
  assert.equal(missing.ok, false, JSON.stringify(missing));
  assert.equal(missing.reason, 'bad-args');
  // A ref opening with `-` would reach git as an OPTION, so a gate could be
  // told to look somewhere other than the range it was given.
  const flagged = riskCheck(repo, dir, ['run', '--phase', '1', '--base', base, '--head', '--output=/tmp/x']);
  assert.equal(flagged.ok, false, JSON.stringify(flagged));
  assert.equal(flagged.reason, 'bad-args');
  assert.deepEqual(traceLines(dir), [], 'a malformed call appended a record anyway');
});

test('risk-check run: --plan with nothing after it is refused, never read as plan 1', () => {
  // The VAL-01 rail: `parseArgs` gives a valueless flag the boolean `true`, and
  // `Number(true)` is 1, so the record would land on a plan nobody named.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'docs/notes.md', 'text\n');
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
});

// --- the `risk-check status` gate ---------------------------------------------

/**
 * FROZEN LITERALS, not a read of `.planning/trace.jsonl`, and that is the point
 * of them. These are the real bytes this repository's record held for phase 1 on
 * 2026-08-15 - one `cad-executor` dispatch closed by a CHECKPOINT, a second
 * closed by a RETURN, under one `phase_start` anchor - at a commit where no
 * `risk_check` event existed anywhere, because the seam did not exist. Reading
 * them from disk would make the evidence arm ("this check reports the omission
 * that was actually there") evaporate the moment task 4's wiring starts writing
 * records, which is exactly what it must survive.
 */
const FROZEN_PHASE_1 = [
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:13:18.573Z","family":"lifecycle","event":"phase_start","sha":"ae5ca09"}',
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:13:21.869Z","family":"lifecycle","event":"dispatch","plan":"1","role":"cad-executor","read":["CLAUDE.md",".planning/PROJECT.md",".planning/phases/1/CONTEXT.md",".planning/phases/1/PLAN.md"]}',
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:13:21.873Z","family":"routing","event":"resolve","role":"cad-executor","stakes":"shipped","agent":"cad-executor","model":"opus","effort":"high","escalated":false,"pinned":false,"attempt":1,"warning_count":1}',
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:22:22.335Z","family":"lifecycle","event":"checkpoint","plan":"1","detail":"structural checkpoint at task 2: verify clauses mutually exclusive","role":"cad-executor","tokens":133860}',
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:34:27.371Z","family":"lifecycle","event":"dispatch","plan":"1","role":"cad-executor","read":[".planning/PROJECT.md",".planning/phases/1/CONTEXT.md",".planning/phases/1/PLAN.md",".planning/phases/1/reports/plan-1.md"]}',
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:34:27.372Z","family":"routing","event":"resolve","role":"cad-executor","stakes":"shipped","agent":"cad-executor","model":"opus","effort":"high","escalated":false,"pinned":false,"attempt":1,"warning_count":1}',
  '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:45:06.939Z","family":"lifecycle","event":"return","plan":"1","role":"cad-executor","tokens":136898}',
];

/** A `.planning` fixture holding the given trace lines. No git repo: `status`
 * reads the record and nothing else. */
function traceFixture(lines) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-risk-status-')), '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'trace.jsonl'), `${lines.join('\n')}\n`);
  return dir;
}

/** One `outcome`/`risk_check` line, as `risk-check run` writes it. */
const recordLine = (plan, base, head) => JSON.stringify({
  corr: '1-ae5ca09', phase: '1', ts: '2026-08-15T18:46:00.000Z',
  family: 'outcome', event: 'risk_check', plan, base, head,
  checked: true, categories: ['secrets'], matches: [], inconclusive: false,
});

/** `risk-check status` against a fixture; its one JSON line and its exit code. */
function riskStatus(dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'risk-check', 'status', ...args],
      { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

test('risk-check status: a completed range with no record refuses, naming the plan', () => {
  // The evidence arm. These are the bytes the record actually held, and the
  // omission this check reports is the one that was actually there.
  const dir = traceFixture(FROZEN_PHASE_1);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'risk-record-missing');
  assert.equal(r._exit, 1);
  assert.deepEqual(r.missing, ['1']);
  assert.match(r.hint, /risk-check run/);
});

test('risk-check status: appending the plan-1 record makes the identical call pass', () => {
  const dir = traceFixture([...FROZEN_PHASE_1, recordLine('1', 'ae5ca09', 'HEAD')]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  assert.equal(r.plans.length, 1);
  assert.equal(r.plans[0].state, 'recorded');
  // The record's own refs ride the row, so a stale one is visible rather than
  // silently counted on the phase-wide arm.
  assert.deepEqual(r.plans[0].records, [{ base: 'ae5ca09', head: 'HEAD' }]);
});

test('risk-check status: a checkpoint AND a return for one plan report it once, not twice', () => {
  const dir = traceFixture([...FROZEN_PHASE_1, recordLine('1', 'ae5ca09', 'HEAD')]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.plans.length, 1, JSON.stringify(r.plans));
  assert.equal(r.plans[0].plan, '1');
  assert.equal(r.plans[0].completed, 1, 'the checkpoint was counted as a completed range');
});

test('risk-check status: a record from an earlier, narrower range is STALE, not satisfaction', () => {
  // execute.md's "re-dispatch the remainder" arm is exactly the case: the plan
  // number matches, the range does not, and passing on it would clear a range
  // nothing ever checked.
  const dir = traceFixture([...FROZEN_PHASE_1, recordLine('1', 'refA', 'refB')]);
  const stale = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', 'refA', '--head', 'refC']);
  assert.equal(stale.ok, false, JSON.stringify(stale));
  assert.equal(stale._exit, 1);
  assert.equal(stale.plans[0].state, 'stale');
  assert.deepEqual(stale.plans[0].wanted, { base: 'refA', head: 'refC' });
  assert.deepEqual(stale.plans[0].records, [{ base: 'refA', head: 'refB' }]);

  const matched = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', 'refA', '--head', 'refB']);
  assert.equal(matched.ok, true, JSON.stringify(matched));
  assert.equal(matched._exit, 0);
});

test('risk-check status: a phase with no completed executor range is ok:true and empty', () => {
  // Nothing to require is not a failure - a gate that refused here would block
  // the first plan of every phase.
  const dir = traceFixture([FROZEN_PHASE_1[0]]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.plans, []);
});

test('risk-check status: the range triple is all three or none', () => {
  const dir = traceFixture([...FROZEN_PHASE_1, recordLine('1', 'refA', 'refB')]);
  const half = riskStatus(dir, ['--phase', '1', '--plan', '1']);
  assert.equal(half.ok, false, JSON.stringify(half));
  assert.equal(half.reason, 'bad-args');
});

test('risk-check status: a named range is required even when its return never landed', () => {
  const dir = traceFixture([FROZEN_PHASE_1[0]]);
  const r = riskStatus(dir, ['--phase', '1', '--plan', '2', '--base', 'refA', '--head', 'refB']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.deepEqual(r.missing, ['2']);
});
