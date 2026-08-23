// Zero-dep tests for why.mjs - the `/cad-why` seam (WHY-01, phase 1 plan 1).
// A real, hermetically-configured git repository the fixture below builds
// (GIT_CONFIG_GLOBAL/SYSTEM=/dev/null, identity forced in the env, the
// git-head.test.mjs precedent), never this repository's own history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEAM = join(HERE, 'why.mjs');

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'cad', GIT_AUTHOR_EMAIL: 'cad@example.invalid',
  GIT_COMMITTER_NAME: 'cad', GIT_COMMITTER_EMAIL: 'cad@example.invalid',
};

/**
 * A repo with two commits touching `f.txt`: the first writes three lines, the
 * second changes ONLY the second line - so line 1 has exactly one touching
 * commit and the bare chain has exactly two, newest first.
 * @returns {{dir: string, first: string, second: string}}
 */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cad-why-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore', env: GIT_ENV });
  // Explicit, distinct commit dates (a minute apart) - two commits made back
  // to back in a test otherwise share one second's timestamp, which is a real
  // git resolution limit and not a fixture accident, and it is what a "newest
  // commit first" assertion needs settled to mean chronology rather than the
  // sha tiebreak D-17 falls back to when two entries' commit dates truly tie.
  const commitAt = (msg, iso) => execFileSync('git', ['-C', dir, 'commit', '-q', '-a', '-m', msg],
    { stdio: 'ignore', env: { ...GIT_ENV, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso } });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'f.txt'), 'one\ntwo\nthree\n');
  git('add', '.');
  commitAt('add f', '2026-01-01T00:00:00-05:00');
  const first = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: GIT_ENV }).trim();

  writeFileSync(join(dir, 'f.txt'), 'one\nTWO\nthree\n');
  commitAt('change line 2', '2026-01-01T00:01:00-05:00');
  const second = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: GIT_ENV }).trim();

  return { dir, first, second };
}

/**
 * Run the seam, never throwing on a non-zero exit - several arms here refuse
 * on purpose and this helper reads their envelope like any other.
 * @param {string[]} args
 * @returns {{status: number, stdout: string}}
 */
function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [SEAM, ...args], { encoding: 'utf8', env: GIT_ENV });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status, stdout: e.stdout || '' };
  }
}

/** Every run's stdout must be exactly one JSON object on exactly one line. */
function oneJsonLine(stdout) {
  const lines = stdout.split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 1, `expected exactly one stdout line, got: ${JSON.stringify(stdout)}`);
  return JSON.parse(lines[0]);
}

test('a tracked path returns ok:true, a non-empty text, and the newest commit first', () => {
  const { dir, first, second } = repo();
  const { status, stdout } = run(['f.txt', '--dir', dir]);
  const env = oneJsonLine(stdout);
  assert.equal(status, 0);
  assert.equal(env.ok, true);
  assert.equal(env.result, 'chain');
  assert.ok(env.text.length > 0);
  assert.equal(env.entries.length, 2);
  assert.equal(env.entries[0].sha, second, 'the newest commit renders first');
  assert.equal(env.entries[1].sha, first);
});

test('<path>:<line> on a line only one of two commits touched returns a strict subset of the bare chain', () => {
  const { dir, first } = repo();
  const bare = oneJsonLine(run(['f.txt', '--dir', dir]).stdout);
  const scoped = oneJsonLine(run(['f.txt:1', '--dir', dir]).stdout);

  assert.equal(scoped.ok, true);
  assert.equal(scoped.result, 'chain');
  assert.equal(scoped.entries.length, 1);
  assert.equal(scoped.entries[0].sha, first);
  assert.ok(scoped.entries.length < bare.entries.length);
  const bareShas = new Set(bare.entries.map((e) => e.sha));
  assert.ok(scoped.entries.every((e) => bareShas.has(e.sha)), 'every scoped entry must also be in the bare chain');
});

test('a path git never saw returns ok:true with a stated not-in-history result and no fatal: on stdout', () => {
  const { dir } = repo();
  const { status, stdout } = run(['nope/never.txt', '--dir', dir]);
  const env = oneJsonLine(stdout);
  assert.equal(status, 0);
  assert.equal(env.ok, true);
  assert.equal(env.result, 'not-in-history');
  assert.ok(!stdout.includes('fatal:'));
});

test('a line past end of file returns a stated result rather than a non-zero exit or a crash', () => {
  const { dir } = repo();
  const { status, stdout } = run(['f.txt:9999', '--dir', dir]);
  const env = oneJsonLine(stdout);
  assert.equal(status, 0);
  assert.equal(env.ok, true);
  assert.equal(env.result, 'line-past-end');
  assert.ok(!stdout.includes('fatal:'));
});

test('a valueless --dir returns ok:false naming --dir', () => {
  const { status, stdout } = run(['--dir']);
  const env = oneJsonLine(stdout);
  assert.equal(status, 1);
  assert.equal(env.ok, false);
  assert.ok(env.detail.includes('--dir'));
});

test('a valueless --top with no positional argument refuses on --top rather than the missing query', () => {
  const { dir } = repo();
  const { status, stdout } = run(['--dir', dir, '--top']);
  const env = oneJsonLine(stdout);
  assert.equal(status, 1);
  assert.equal(env.ok, false);
  assert.ok(env.detail.includes('--top'), `expected the refusal to name --top, got ${JSON.stringify(env)}`);
});

test('every run in this file parses as exactly one JSON object', () => {
  const { dir } = repo();
  for (const args of [['f.txt', '--dir', dir], ['nope.txt', '--dir', dir], ['--dir'], []]) {
    const { stdout } = run(args);
    assert.doesNotThrow(() => oneJsonLine(stdout), `${JSON.stringify(args)} did not print one JSON line`);
  }
});

// --- AC6 / D-07: determinism and the record that is not an input -----------

test('two runs over an unchanged tree write byte-identical stdout', () => {
  const { dir } = repo();
  const a = run(['f.txt', '--dir', dir]).stdout;
  const b = run(['f.txt', '--dir', dir]).stdout;
  assert.equal(a, b);
});

test('the answer is unchanged whether .planning/trace.jsonl is present or absent', () => {
  const { dir } = repo();
  const before = run(['f.txt', '--dir', dir]).stdout;
  execFileSync('mkdir', ['-p', join(dir, '.planning')]);
  writeFileSync(join(dir, '.planning', 'trace.jsonl'), '{"not":"read"}\n');
  const after = run(['f.txt', '--dir', dir]).stdout;
  assert.equal(before, after);
});

test('every child-process call in why.mjs names git as its command', () => {
  const source = readFileSync(SEAM, 'utf8');
  const calls = source.matchAll(/\b(?:execFileSync|spawnSync|spawn|exec)\(\s*([^,)]+)/g);
  let found = 0;
  for (const m of calls) {
    found += 1;
    assert.equal(m[1].trim(), "'git'", `expected 'git' as the command argument, got ${m[1]}`);
  }
  assert.ok(found > 0, 'expected at least one child-process call in why.mjs');
});

// --- Plan 2: the phase and plan-task edge ----------------------------------
//
// These run against THIS repository rather than a built fixture, deliberately.
// The index's whole claim is that a phase number is READ off a resolved
// directory rather than guessed from a commit's `(N-M)` scope, and the only
// place that distinction is real is a corpus where both a live `phases/1` and
// an archived `_archive-v3.4.0/1` exist and hold different milestones' work.
// A fixture cannot falsify a guess that would also be right in the fixture.

/** This repository's root: bin -> cadence-core -> root. */
const REPO = join(HERE, '..', '..');
/** The rendered entry for `sha`, cut out of `text` at its own commit line. */
function entryFor(text, sha) {
  const blocks = text.split('\n\n');
  return blocks.find((b) => b.startsWith(`commit ${sha} `));
}

test('a commit an archived summary names joins to that milestone, phase, plan and task', () => {
  // 12 commits touch this path; the one under test is the oldest, so the cap
  // is lifted rather than the assertion narrowed to the newest ten.
  const { stdout } = run(['cadence-core/bin/lib/issue-decision.mjs', '--dir', REPO, '--top', '20']);
  const env = oneJsonLine(stdout);
  assert.equal(env.ok, true);
  assert.equal(env.result, 'chain');
  assert.deepEqual(env.warnings, [], 'no summary in this repository is unreadable');

  const sha = '00537356bf14084f3676eeeca1c4747146979bc3';
  const entry = entryFor(env.text, sha);
  assert.ok(entry, `expected a rendered entry for ${sha} in a chain of ${env.shown}`);
  assert.ok(entry.includes('phase: v3.4.0 phase 1 (_archive-v3.4.0/1)'),
    `expected the archived milestone and the phase read off its directory, got:\n${entry}`);
  assert.ok(entry.includes('plan task: plan 1, task 2 - '), `expected plan 1 task 2, got:\n${entry}`);
  assert.ok(entry.includes('The pure issue-decision core + 15 tests'),
    `expected the commits table's own description verbatim, got:\n${entry}`);

  const data = env.entries.find((e) => e.sha === sha);
  assert.equal(data.join.state, 'resolved');
  assert.equal(data.join.label, '_archive-v3.4.0/1');
  assert.equal(data.join.phase, '1');
  assert.equal(data.join.plan, '1');
  assert.equal(data.join.task, '2');
});

test('the phase printed is the archived one, never the live phases/1 that reuses the number', () => {
  const { stdout } = run(['cadence-core/bin/lib/issue-decision.mjs', '--dir', REPO, '--top', '20']);
  const env = oneJsonLine(stdout);
  assert.ok(!env.text.includes('(phases/1)'),
    'the live phase 1 is a different milestone; a scope-keyed read would print it');
  assert.ok(env.entries.every((e) => e.join.label !== 'phases/1'));
});

test('a commit no summary names keeps its phase and plan-task fields stated absent rather than dropped', () => {
  const { dir, second } = repo();
  const { stdout } = run(['f.txt', '--dir', dir]);
  const env = oneJsonLine(stdout);
  assert.equal(env.ok, true);
  assert.equal(env.entries.length, 2);
  assert.equal(env.entries[0].join.state, 'unresolved');

  const entry = entryFor(env.text, second);
  for (const label of ['phase', 'plan task', 'decision', 'deviation', 'review']) {
    assert.ok(entry.includes(`${label}: not yet joined`),
      `expected a stated-absent line for ${label}, got:\n${entry}`);
  }
});

test('two runs over this repository, with the index in place, write byte-identical stdout', () => {
  const a = run(['cadence-core/bin/lib/issue-decision.mjs', '--dir', REPO, '--top', '20']).stdout;
  const b = run(['cadence-core/bin/lib/issue-decision.mjs', '--dir', REPO, '--top', '20']).stdout;
  assert.equal(a, b, 'a readdir-ordered index build is exactly how this goes non-deterministic');
});

// --- Plan 2 task 4: the decision edge --------------------------------------

test("a task body's D-NN cite reaches the rendered chain with the CONTEXT line's own text", () => {
  const { stdout } = run(['cadence-core/bin/lib/capture-file.mjs', '--dir', REPO, '--top', '30']);
  const env = oneJsonLine(stdout);
  assert.equal(env.ok, true);
  assert.deepEqual(env.warnings, []);

  // v3.3.0 phase 1 plan 1 task 4, whose Action names D-02.
  const entry = entryFor(env.text, '16bd5e130ad970a14635e9466316da8fc6c9cdda');
  assert.ok(entry, 'expected the debt-harvest commit in the chain');
  assert.ok(entry.includes('decision: cited by this task (D-02)'),
    `expected a task-level cite, got:\n${entry}`);
  assert.ok(entry.includes('  D-02 (write path): All three product writers of CAPTURE.md route through that'),
    `expected the CONTEXT line verbatim under it, got:\n${entry}`);
});

test('the fallback arm carries a phase-scoped label rather than passing itself off as task-level', () => {
  const { stdout } = run(['cadence-core/bin/lib/capture-file.mjs', '--dir', REPO, '--top', '30']);
  const env = oneJsonLine(stdout);

  // v3.3.0 phase 1 plan 2 task 4, whose own body cites no decision - so the
  // answer is the PLAN's cites, and it says so before it quotes anything.
  const entry = entryFor(env.text, '8e27033805ac8a5886c07ddd61756106538b22e8');
  assert.ok(entry, 'expected the recall-walk commit in the chain');
  assert.ok(entry.includes("decision: PHASE-SCOPED - cited by the plan's ## Context, not by this task"),
    `expected the phase-scoped label, got:\n${entry}`);

  const data = env.entries.find((e) => e.sha === '8e27033805ac8a5886c07ddd61756106538b22e8');
  assert.equal(data.join.decision.scope, 'plan');
  assert.ok(data.join.decision.lines.length > 0);
});

// --- Plan 2 task 5: the deviation edge, and the gap it has to name ---------

test("the rendered chain carries the phase's deviation bullets under a phase-scoped label", () => {
  const { stdout } = run(['cadence-core/bin/lib/capture-file.mjs', '--dir', REPO, '--top', '30']);
  const env = oneJsonLine(stdout);
  const entry = entryFor(env.text, '8e27033805ac8a5886c07ddd61756106538b22e8');

  assert.ok(entry.includes('deviation: PHASE-SCOPED - '),
    `a deviation is a fact about the phase, not about this commit; got:\n${entry}`);
  assert.ok(entry.includes('  - Plans otherwise executed as written; plan 2 reported zero deviations.'),
    `expected the SUMMARY's own bullet, quoted; got:\n${entry}`);

  const data = env.entries.find((e) => e.sha === '8e27033805ac8a5886c07ddd61756106538b22e8');
  assert.ok(data.join.deviation.bullets.length > 0);
});

test('every joined entry names the absent corrected-by marker rather than reporting "none"', () => {
  for (const path of ['cadence-core/bin/lib/capture-file.mjs', 'cadence-core/bin/lib/issue-decision.mjs']) {
    const env = oneJsonLine(run([path, '--dir', REPO, '--top', '30']).stdout);
    const joined = env.text.split('\n\n').filter((b) => b.includes('phase: ') && !b.includes('phase: not yet joined'));
    assert.ok(joined.length > 0, `expected at least one joined entry for ${path}`);
    for (const entry of joined) {
      assert.ok(entry.includes('corrected by plan-<k> deviation:'),
        `expected the marker named as absent on every joined entry of ${path}; got:\n${entry}`);
      assert.ok(!/deviation: none/i.test(entry), 'the edge is never reported as "none"');
      assert.ok(!/deviation:\s*$/m.test(entry), 'and never as an empty field');
    }
  }
});

// --- Plan 2 task 6: the surviving review finding edge ----------------------
//
// A BUILT fixture, because no `_archive-*` tree in this repository holds an
// adjudication record - they postdate the last archive-mode close. Plan 3
// proves the git-recovered arm; this is the live-and-archive on-disk tier's own
// seam proof, and it is at the SEAM rather than in the module tests because a
// correct reader whose finding never reaches the rendered chain has to fail
// somewhere.

/**
 * A repository whose `.planning` records three commits on `f.txt` and carries
 * an adjudication record covering the middle one alone.
 * @returns {{dir: string, base: string, a: string, b: string}}
 */
function repoWithFinding() {
  const dir = mkdtempSync(join(tmpdir(), 'cad-why-review-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore', env: GIT_ENV });
  git('init', '-q', '-b', 'main');
  const shas = [];
  for (const n of ['zero', 'one', 'two']) {
    writeFileSync(join(dir, 'f.txt'), `${n}\n`);
    git('add', 'f.txt');
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', n], { stdio: 'ignore', env: GIT_ENV });
    shas.push(execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: GIT_ENV }).trim());
  }
  const [base, a, b] = shas;

  const phase = join(dir, '.planning', 'phases', '1');
  mkdirSync(phase, { recursive: true });
  writeFileSync(join(phase, 'PLAN.md'), '---\nphase: 1\nplan: 1\n---\n\n# a plan\n');
  writeFileSync(join(phase, 'SUMMARY.md'), [
    '# Phase 1 - Summary', '', '## Commits', '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    `| 1 | 1 | ${a.slice(0, 8)} | the commit the finding covers |`,
    `| 1 | 2 | ${b.slice(0, 8)} | the commit it does not |`,
    '', '## Deviations', '', '- [deviation] none of consequence', '',
  ].join('\n'));
  writeFileSync(join(phase, 'ADJUDICATION-risk_surface-plan-1.json'), JSON.stringify({
    phase: '1', trigger: 'risk_surface', discriminator: 'plan-1', round: 1,
    base_id: base, head_id: a,
    entries: [
      {
        voice: 'openai', model: 'test', file: 'f.txt', line: 1, severity: 'high',
        claim: 'THE-SURVIVING-CLAIM: the value is read before it is validated.',
        failure_scenario: 'THE-SURVIVING-SCENARIO: a hostile value reaches the sink.',
        counter_evidence: 'THE-COUNTER-EVIDENCE: the guard added at line 9.',
        ruling: 'survived',
      },
      {
        voice: 'openai', model: 'test', file: 'f.txt', line: 2, severity: 'low',
        claim: 'THE-REFUTED-CLAIM: this must never print.',
        failure_scenario: 'nothing', ruling: 'refuted',
      },
    ],
  }));
  return { dir, base, a, b };
}

test("a survived finding reaches the rendered chain on the commit its range covers, and on no other", () => {
  const { dir, a, b } = repoWithFinding();
  const env = oneJsonLine(run(['f.txt', '--dir', dir]).stdout);
  assert.equal(env.ok, true);
  assert.deepEqual(env.warnings, []);

  const covered = entryFor(env.text, a);
  assert.ok(covered.includes('THE-SURVIVING-CLAIM: the value is read before it is validated.'),
    `expected the claim verbatim on the covered commit, got:\n${covered}`);
  assert.ok(covered.includes('THE-SURVIVING-SCENARIO: a hostile value reaches the sink.'),
    `expected the failure scenario verbatim, got:\n${covered}`);
  assert.ok(covered.includes('THE-COUNTER-EVIDENCE: the guard added at line 9.'));
  assert.ok(covered.includes('[high] f.txt:1 (ADJUDICATION-risk_surface-plan-1.json)'));

  const uncovered = entryFor(env.text, b);
  assert.ok(!uncovered.includes('THE-SURVIVING-CLAIM'),
    `a finding outside this commit range must not appear on it, got:\n${uncovered}`);
  assert.ok(uncovered.includes('review: 1 adjudication record(s) read; no surviving finding covers this commit'),
    `and the absence is stated rather than blank, got:\n${uncovered}`);

  assert.ok(!env.text.includes('THE-REFUTED-CLAIM'), 'a refuted finding never prints');
});

test('a finding whose range does not resolve in this clone is stated unknown, never dropped or applied', () => {
  const { dir, a } = repoWithFinding();
  const record = join(dir, '.planning', 'phases', '1', 'ADJUDICATION-risk_surface-plan-1.json');
  const parsed = JSON.parse(readFileSync(record, 'utf8'));
  parsed.head_id = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  writeFileSync(record, JSON.stringify(parsed));

  const env = oneJsonLine(run(['f.txt', '--dir', dir]).stdout);
  const covered = entryFor(env.text, a);
  assert.ok(covered.includes('THE-SURVIVING-CLAIM'), 'the finding is not dropped');
  assert.ok(covered.includes('join UNRESOLVABLE:'), `expected the unknown stated, got:\n${covered}`);
  assert.ok(covered.includes('could not be placed'));
});

// --- Plan 2 task 7: the task-attributed declared-files edge ----------------

test('a joined entry names the task whose Files: line declared the queried path', () => {
  const { stdout } = run(['cadence-core/bin/lib/capture-file.mjs', '--dir', REPO, '--top', '30']);
  const env = oneJsonLine(stdout);
  const entry = entryFor(env.text, '8e27033805ac8a5886c07ddd61756106538b22e8');

  assert.ok(entry.includes('declared by: declared in PLAN-'),
    `expected the declaring plan file named, got:\n${entry}`);
  assert.ok(/declares cadence-core\/bin\/lib\/capture-file\.mjs\)/.test(entry),
    `expected the declaration itself quoted, got:\n${entry}`);

  const data = env.entries.find((e) => e.sha === '8e27033805ac8a5886c07ddd61756106538b22e8');
  assert.ok(data.join.declared.tasks.length > 0);
  assert.ok(data.join.declared.tasks.every((t) => Number.isInteger(t.ordinal) && t.title));
});

test('a path no task in the resolved plan declares says so rather than going blank', () => {
  // `f.txt` is what the built fixture's commits touch; its PLAN.md declares
  // nothing, so the sixth field is a stated absence with a reason.
  const { dir, a } = repoWithFinding();
  const env = oneJsonLine(run(['f.txt', '--dir', dir]).stdout);
  const entry = entryFor(env.text, a);
  assert.ok(entry.includes('declared by: no task in PLAN.md declares this path'),
    `expected a stated absence naming the plan file, got:\n${entry}`);
});

test('every join field is stated on an unjoined entry, including the sixth', () => {
  const { dir, second } = repo();
  const env = oneJsonLine(run(['f.txt', '--dir', dir]).stdout);
  const entry = entryFor(env.text, second);
  for (const label of ['phase', 'plan task', 'decision', 'deviation', 'review', 'declared by']) {
    assert.ok(entry.includes(`${label}: not yet joined`), `expected a stated-absent line for ${label}`);
  }
});

test('two runs over this repository stay byte-identical with all six edges joined', () => {
  const a = run(['cadence-core/bin/lib/capture-file.mjs', '--dir', REPO, '--top', '30']).stdout;
  const b = run(['cadence-core/bin/lib/capture-file.mjs', '--dir', REPO, '--top', '30']).stdout;
  assert.equal(a, b);
});

// --- The git-recovered tier reaching the chain (plan 3, task 3) ------------

test('a commit whose phase directory exists in NO on-disk tier still names its phase', () => {
  // `cadence-core/bin/lib/release-decision.mjs` was last touched by v3.5.9's
  // phase 1, which closed with `--mode delete`: there is no `phases/1` holding
  // it (the live one is v3.6.0's) and no `_archive-v3.5.9/` at all.
  const env = oneJsonLine(run(['cadence-core/bin/lib/release-decision.mjs', '--dir', REPO]).stdout);
  assert.equal(env.ok, true);
  assert.deepEqual(env.warnings, []);
  const entry = entryFor(env.text, '73aa7bba503efb228c1b423c3d93cce87494036d');
  assert.match(entry, /^phase: v3\.5\.9 phase 1 \(recovered from [0-9a-f]{8}:\.planning\/phases\/1\)$/m);
  assert.match(entry, /^plan task: plan 1, task 1 - Fence-aware heading scans in release-decision\.mjs$/m);
  assert.ok(!/_archive-v3\.5\.9/.test(env.text), 'no such archive group exists on disk');
});

test('the recovered tier never overrides an on-disk record a reader could open', () => {
  const env = oneJsonLine(run(['cadence-core/bin/lib/issue-decision.mjs', '--dir', REPO, '--top', '20']).stdout);
  assert.equal(env.ok, true);
  const entry = entryFor(env.text, '00537356bf14084f3676eeeca1c4747146979bc3');
  assert.match(entry, /^phase: v3\.4\.0 phase 1 \(_archive-v3\.4\.0\/1\)$/m,
    'the archived directory answers, not the copy recoverable from the same prune commit');
  assert.ok(!/recovered from/.test(entry));
});

test('two runs over this repository stay byte-identical with the recovered tier in place', () => {
  const a = run(['cadence-core/bin/lib/release-decision.mjs', '--dir', REPO]).stdout;
  const b = run(['cadence-core/bin/lib/release-decision.mjs', '--dir', REPO]).stdout;
  assert.equal(a, b);
});
