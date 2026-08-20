// Zero-dep tests for lib/report-rotation.mjs, the free-suffix picker an
// executor consults before its first write to `<plandir>/reports/plan-<k>.md`.
// Run: node --test 'cadence-core/bin/*.test.mjs' - CI's own glob.
//
// The module is pure, but the property that matters is a filesystem one: after
// the caller acts on its answer, the previous run's bytes are still readable.
// So these tests build REAL directories under `mkdtempSync` (the pattern
// planning.test.mjs uses), feed the module exactly what `readdirSync` returns,
// and then rename and re-read. A test that only compared strings would agree
// with a picker that answers a name the caller is about to overwrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync, existsSync, globSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { rotationTarget, isReportName } from './lib/report-rotation.mjs';

/** A fresh `<plandir>/reports/` holding `files` (name -> contents). */
function makeReports(files = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-rotate-')), 'reports');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

/** What an executor does with the module's answer: rotate, then write. */
function rotateThenWrite(dir, planKey, body) {
  const answer = rotationTarget(planKey, readdirSync(dir));
  if (answer.rotate) renameSync(join(dir, answer.from), join(dir, answer.to));
  writeFileSync(join(dir, `plan-${planKey}.md`), body);
  return answer;
}

test('fixture state 1 - no report present: nothing to rotate', () => {
  const dir = makeReports({});
  assert.deepEqual(rotationTarget(1, readdirSync(dir)), { rotate: false });

  // And not because the directory is empty: a report for ANOTHER plan, and the
  // transient risk diff that lives in this same directory, are not this plan's
  // record and must not be mistaken for one.
  const busy = makeReports({
    'plan-2.md': 'other plan',
    'plan-1-risk-task-3.diff': 'staged diff',
    'plan-11.md': 'plan eleven, not plan one suffixed',
  });
  assert.deepEqual(rotationTarget(1, readdirSync(busy)), { rotate: false });
});

test('fixture state 2 - one report present: rotates to the first free suffix', () => {
  const dir = makeReports({ 'plan-1.md': 'run A' });
  const answer = rotationTarget(1, readdirSync(dir));
  assert.deepEqual(answer, { rotate: true, from: 'plan-1.md', to: 'plan-1.1.md' });

  // The answer names a name nothing holds, which is what makes the caller's
  // rename non-destructive.
  assert.ok(!readdirSync(dir).includes(answer.to));

  // A bare `PLAN.md` is plan 1; `PLAN-2.md` is plan 2, and its own report is
  // the one that rotates.
  const two = makeReports({ 'plan-1.md': 'run A', 'plan-2.md': 'run A of plan 2' });
  assert.deepEqual(rotationTarget(2, readdirSync(two)),
    { rotate: true, from: 'plan-2.md', to: 'plan-2.1.md' });
});

test('fixture state 3 - several already rotated: takes the lowest free suffix', () => {
  const dir = makeReports({
    'plan-1.md': 'run D',
    'plan-1.1.md': 'run A',
    'plan-1.2.md': 'run B',
    'plan-1.3.md': 'run C',
  });
  assert.deepEqual(rotationTarget(1, readdirSync(dir)),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.4.md' });

  // A gap a hand-deleted report left is filled, not stepped over: the rule is
  // the lowest FREE suffix, which is total and needs no history.
  const gapped = makeReports({
    'plan-1.md': 'run D',
    'plan-1.1.md': 'run A',
    'plan-1.3.md': 'run C',
  });
  assert.deepEqual(rotationTarget(1, readdirSync(gapped)),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.2.md' });

  // Two-digit suffixes sort as numbers, not as strings: with 1..9 taken the
  // answer is 10, and a picker comparing text would answer a taken name.
  const many = makeReports(Object.fromEntries([
    ['plan-1.md', 'newest'],
    ...Array.from({ length: 9 }, (_, i) => [`plan-1.${i + 1}.md`, `run ${i}`]),
  ]));
  assert.deepEqual(rotationTarget(1, readdirSync(many)),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.10.md' });
});

test('the rotate-twice round trip leaves three readable reports, the earliest byte-identical', () => {
  const dir = makeReports({});

  // Run A writes the first report - nothing to rotate.
  assert.deepEqual(rotateThenWrite(dir, 1, 'RUN A\nPLAN COMPLETE\n'), { rotate: false });
  const runA = readFileSync(join(dir, 'plan-1.md'));

  // Run B rotates A aside, run C rotates B aside.
  assert.deepEqual(rotateThenWrite(dir, 1, 'RUN B\nPLAN PARTIAL\n'),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.1.md' });
  assert.deepEqual(rotateThenWrite(dir, 1, 'RUN C\nPLAN COMPLETE\n'),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.2.md' });

  assert.deepEqual(readdirSync(dir).sort(), ['plan-1.1.md', 'plan-1.2.md', 'plan-1.md']);
  assert.deepEqual(readFileSync(join(dir, 'plan-1.1.md')), runA,
    "the earliest run's report is not byte-identical to its pre-rotation content");
  assert.equal(readFileSync(join(dir, 'plan-1.2.md'), 'utf8'), 'RUN B\nPLAN PARTIAL\n');
  assert.equal(readFileSync(join(dir, 'plan-1.md'), 'utf8'), 'RUN C\nPLAN COMPLETE\n');
});

test('a base report stored in another case is FOUND, not read as absent', () => {
  // The half the suffix scan already protected and this one did not. On a
  // case-folding filesystem `PLAN-1.MD` and `plan-1.md` are one file, so an
  // exact-name miss answers `rotate: false` about a directory that holds a
  // report - and the caller acts on `false` by writing the canonical spelling
  // straight over it. Pure-string fixtures, deliberately: the property is the
  // module's answer about a NAME, and a case-sensitive test filesystem cannot
  // produce the collision the answer has to survive.
  assert.deepEqual(rotationTarget(1, ['PLAN-1.MD']),
    { rotate: true, from: 'PLAN-1.MD', to: 'plan-1.1.md' });
  assert.deepEqual(rotationTarget(1, ['Plan-1.Md']),
    { rotate: true, from: 'Plan-1.Md', to: 'plan-1.1.md' });

  // `from` is the entry's OWN spelling: the canonical name would not resolve
  // for the caller's rename on a case-SENSITIVE filesystem, where the two names
  // are two different files and only one of them exists.
  assert.deepEqual(rotationTarget(1, ['PLAN-1.MD', 'PLAN-1.1.MD']),
    { rotate: true, from: 'PLAN-1.MD', to: 'plan-1.2.md' });

  // Both spellings present - a case-sensitive tree - rotates the CANONICAL one,
  // because that is the name the caller is about to write over.
  assert.deepEqual(rotationTarget(1, ['PLAN-1.MD', 'plan-1.md']),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.1.md' });

  // Still nothing to widen to: another plan's report in any case is not this
  // plan's, and the transient risk diff is not a report at all.
  assert.deepEqual(rotationTarget(1, ['PLAN-2.MD', 'PLAN-11.MD', 'plan-1-risk.diff']),
    { rotate: false });
});

test('unreadable inputs throw rather than answering "nothing to rotate"', () => {
  // Fail-open is the destructive arm: the caller acts on `rotate: false` by
  // writing over the file, so a malformed input must stop it, not license it.
  const dir = makeReports({ 'plan-1.md': 'run A' });
  for (const bad of [0, -1, 1.5, '08', '', ' 1', null, undefined, '1; rm -rf /']) {
    assert.throws(() => rotationTarget(bad, readdirSync(dir)), TypeError,
      `plan number ${JSON.stringify(bad)} was accepted`);
  }
  assert.throws(() => rotationTarget(1, 'plan-1.md'), TypeError);
  // What `readdirSync(dir, {withFileTypes:true})` returns: names that are not
  // strings would compare false against every candidate and answer `false`.
  assert.throws(() => rotationTarget(1, readdirSync(dir, { withFileTypes: true })), TypeError);
});

// --- AC6: the rotated report is still visible to the reader that lists reports

test('AC6: both names rotation produces are matched by /cad-report\'s own glob', () => {
  // What makes rotation SAFE rather than merely non-destructive. The reader
  // that consumes per-task reports is `workflows/report.md`, which opens
  // `.planning/phases/<N>/reports/plan-*.md` ONLY when SUMMARY.md is absent -
  // so a SUMMARY-less phase is the observable form of the criterion, and that
  // glob is the property under test. A per-run SUBDIRECTORY would satisfy every
  // other test in this file and still hide the older record from the only
  // reader that looks: `reports/<key>/plan-1.md` does not match it.
  //
  // /cad-report itself is deliberately NOT invoked: the workflow is prose an
  // agent runs, not a callable, so the test targets the glob it names.
  const root = mkdtempSync(join(tmpdir(), 'cad-ac6-'));
  const phase = join(root, 'phases', '1');
  const reports = join(phase, 'reports');
  mkdirSync(reports, { recursive: true });
  writeFileSync(join(reports, 'plan-1.md'), 'RUN A\nPLAN PARTIAL\n');
  const runA = readFileSync(join(reports, 'plan-1.md'));

  // The second run: rotate by the module's answer, then write at the base name.
  // The parent of `to` is created first, so a module answering a subdirectory
  // fails at the GLOB below rather than at a rename - the assertion that
  // actually states the property.
  const answer = rotationTarget(1, readdirSync(reports));
  assert.equal(answer.rotate, true);
  const to = join(reports, answer.to);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(join(reports, answer.from), to);
  writeFileSync(join(reports, 'plan-1.md'), 'RUN B\nPLAN COMPLETE\n');

  // The premise: no SUMMARY.md, which is what makes report.md read this glob.
  assert.ok(!existsSync(join(phase, 'SUMMARY.md')));

  const matched = globSync('phases/1/reports/plan-*.md', { cwd: root }).sort();
  assert.deepEqual(matched.map((m) => m.split(sep).pop()).sort(),
    ['plan-1.1.md', 'plan-1.md'],
    'the glob workflows/report.md names does not resolve to both records, so rotation '
    + 'hid the previous run from the only reader that lists reports');
  assert.deepEqual(readFileSync(join(reports, 'plan-1.1.md')), runA,
    "the rotated record's bytes changed");
});

// --- isReportName: the LEASE side of the same grammar (#195 -> #140's sibling)

test('isReportName: this plan\'s canonical report and its rotated siblings', () => {
  // What `cmdLeaseCheck` has to exempt once rotation is real: an executor holds
  // both names at once, and staging the rotated one during a task commit was
  // read as an undeclared file - the gate refusing the executor for obeying its
  // own contract.
  assert.equal(isReportName(1, 'plan-1.md'), true);
  assert.equal(isReportName(1, 'plan-1.1.md'), true);
  assert.equal(isReportName(1, 'plan-1.12.md'), true);
  // A bare `PLAN.md` is plan 1, and every other plan answers about its own.
  assert.equal(isReportName(2, 'plan-2.md'), true);
  assert.equal(isReportName(2, 'plan-2.3.md'), true);
});

test('isReportName: the anchors are load-bearing - plan-11 is not plan 1 rotated', () => {
  // The dot before the suffix and the trailing `.md` are the whole bound. A
  // lease gate that lost either would exempt another plan's report, which is
  // the parallel-safety property this exemption exists inside of.
  for (const name of ['plan-11.md', 'plan-11.1.md', 'plan-2.md', 'plan-2.1.md',
    'plan-1.md.bak', 'plan-1.mdx', 'plan-1.0.md', 'plan-1.01.md', 'plan-1..md',
    'plan-1.1.2.md', 'plan-1.md ', ' plan-1.md', 'plan-1', 'plan-1.1']) {
    assert.equal(isReportName(1, name), false, `${name} was read as plan 1's report`);
  }

  // The transient risk-diff evidence lives in this same directory and must NOT
  // be exempt: a `risk_surface` checkpoint deliberately leaves flagged changes
  // staged, so exempting them would let a blocking gate's own evidence ride
  // into a task commit.
  for (const name of ['plan-1-risk.diff', 'plan-1-risk-task-2.diff']) {
    assert.equal(isReportName(1, name), false, `${name} was read as plan 1's report`);
  }
});

test('isReportName: byte-exact on case, unlike the rename scan above it', () => {
  // The deliberate split from `rotationTarget`'s `'i'`. There, case-insensitive
  // matching stops the SCAN from renaming onto a report stored as `PLAN-1.MD`;
  // the name PRODUCED is always canonical lower-case. Here the question is
  // whether a STAGED name may ride a task commit undeclared, and a
  // `PLAN-1.1.MD` no executor wrote is not an executor's report - exempting it
  // widens a parallel-safety gate in the one direction it must not move.
  for (const name of ['PLAN-1.MD', 'PLAN-1.1.MD', 'Plan-1.Md', 'plan-1.1.MD']) {
    assert.equal(isReportName(1, name), false, `${name} was exempted`);
  }
});

test('isReportName: a malformed plan number throws rather than answering', () => {
  // Through the module's own `planDigits`, so `08` is refused outright instead
  // of silently answering about plan 8 - the same refusal `rotationTarget`
  // makes, from the same reader.
  for (const bad of [0, -1, 1.5, '08', '', ' 1', null, undefined, '1; rm -rf /']) {
    assert.throws(() => isReportName(bad, 'plan-1.md'), TypeError,
      `plan number ${JSON.stringify(bad)} was accepted`);
  }
  // A name it cannot read is fail-CLOSED - `false`, never an exemption.
  for (const bad of [null, undefined, 42, {}, ['plan-1.md']]) {
    assert.equal(isReportName(1, bad), false);
  }
});

test('isReportName: every name rotation PRODUCES is one it recognises', () => {
  // The two halves cannot drift apart silently: the picker's answer is the
  // lease's input, so a suffix minted in a spelling the exemption did not match
  // would refuse the executor's own next commit.
  let entries = ['plan-1.md'];
  for (let i = 0; i < 12; i++) {
    const answer = rotationTarget(1, entries);
    assert.equal(answer.rotate, true);
    assert.equal(isReportName(1, answer.to), true, `${answer.to} is not recognised as a report`);
    entries = [...entries.filter((e) => e !== answer.from), answer.to, 'plan-1.md'];
  }
});
