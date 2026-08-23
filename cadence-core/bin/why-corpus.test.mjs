// Zero-dep tests for lib/why-corpus.mjs - the storage-tier locator behind
// `/cad-why`'s commit-to-phase index (WHY-01, phase 1 plan 2). See that
// module's header for the design.
//
// Two kinds of fixture, deliberately: this repository's OWN `.planning` for the
// facts the index exists to get right on a real corpus (28 phase directories
// across both tiers, one of them the live phase 1 of a DIFFERENT milestone from
// the archived phase 1 the commit belongs to), and built temp roots for the
// states this corpus does not currently hold - an unreadable summary and a
// genuine prefix ambiguity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCommitIndex, resolveCommit, readArtifact, readAdjudications, rangeMembers,
  findPruneCommits, parsePruneRecords, PRUNE_ARGV,
  buildRecoveredIndex, mergeCommitIndexes, readPhaseRecords, closeOver,
  buildTaskIndex,
} from './lib/why-corpus.mjs';
import {
  decisionsFor, declaringTasks, parseCommitRows, parseDeviations, taskDeclaredFiles,
} from './lib/why-record.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** This repository's own planning root: bin -> cadence-core -> root. */
const REAL = join(HERE, '..', '..', '.planning');

/** The full sha of the commit `_archive-v3.4.0/1/SUMMARY.md` records as 0053735. */
const ISSUE_CORE = '00537356bf14084f3676eeeca1c4747146979bc3';

/**
 * A planning root holding the phase directories `spec` names. Each value is
 * the SUMMARY.md body (or `null` for a directory with plans and no summary);
 * every directory also gets a PLAN.md, because `phaseDirsIn` counts a
 * directory as a phase by the conforming plan file it holds.
 * @param {Record<string, string|null>} spec keyed `<group>/<name>`
 * @returns {string}
 */
function planningRoot(spec) {
  const root = mkdtempSync(join(tmpdir(), 'cad-why-corpus-'));
  for (const [label, summary] of Object.entries(spec)) {
    const dir = join(root, label);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'PLAN.md'), '---\nphase: 1\nplan: 1\n---\n\n# a plan\n');
    if (summary !== null) writeFileSync(join(dir, 'SUMMARY.md'), summary);
  }
  return root;
}

/** A `## Commits` table over `rows` of `[plan, task, commit, description]`. */
const commitsTable = (rows) => [
  '# Summary', '', '## Commits', '',
  '| Plan | Task | Commit | Description |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  '',
].join('\n');

// --- The real corpus, both tiers ------------------------------------------

test('the index over this repository resolves 00537356 to _archive-v3.4.0/1, plan 1, task 2', () => {
  const index = buildCommitIndex(REAL);
  assert.deepEqual(index.warnings, [], 'this repository has no unreadable summary');
  assert.ok(index.rows.length > 0, 'the archived summaries contribute rows');

  const { state, row } = resolveCommit(index, ISSUE_CORE);
  assert.equal(state, 'resolved');
  assert.equal(row.dir.label, '_archive-v3.4.0/1');
  assert.equal(row.dir.milestone, 'v3.4.0');
  assert.equal(row.dir.phase, '1');
  assert.equal(row.plan, '1');
  assert.equal(row.task, '2');
  assert.equal(row.commit, '0053735', 'the abbreviation the record wrote, carried verbatim');
});

test('the same index does NOT resolve it to the live phases/1, which is another milestone entirely', () => {
  const index = buildCommitIndex(REAL);
  const { row, matches } = resolveCommit(index, ISSUE_CORE);
  assert.equal(row.dir.group, '_archive-v3.4.0');
  assert.ok(matches.every((m) => m.dir.label !== 'phases/1'),
    'the live phase 1 legitimately exists and belongs to a different cycle - a scope-keyed read would land there');
  assert.ok(index.dirs.some((d) => d.label === 'phases/1'),
    'and it IS in the walk, so the negative above is a real discrimination rather than an absent directory');
});

test('the live tier and the archive tier are both walked, each labelled by its own group', () => {
  const { dirs } = buildCommitIndex(REAL);
  assert.ok(dirs.some((d) => d.group === 'phases'));
  assert.ok(dirs.filter((d) => d.group.startsWith('_archive-')).length > 1);
  const labels = dirs.map((d) => d.label);
  assert.deepEqual(labels, [...labels].sort(), 'the walk order is label order, so two runs index the same way');
});

// --- Built roots: the states this corpus does not hold ---------------------

test('two archive groups each carrying a phase 1 both index, each under its own label', () => {
  const root = planningRoot({
    '_archive-v9.0.0/1': commitsTable([['1', '1', 'aaaaaaa', 'the older cycle']]),
    '_archive-v9.1.0/1': commitsTable([['1', '1', 'bbbbbbb', 'the newer cycle']]),
  });
  const index = buildCommitIndex(root);
  assert.deepEqual(index.dirs.map((d) => d.label), ['_archive-v9.0.0/1', '_archive-v9.1.0/1']);
  assert.deepEqual(index.warnings, []);

  const older = resolveCommit(index, `aaaaaaa${'0'.repeat(33)}`);
  const newer = resolveCommit(index, `bbbbbbb${'0'.repeat(33)}`);
  assert.equal(older.state, 'resolved');
  assert.equal(older.row.dir.milestone, 'v9.0.0');
  assert.equal(older.row.description, 'the older cycle');
  assert.equal(newer.state, 'resolved');
  assert.equal(newer.row.dir.milestone, 'v9.1.0');
  assert.equal(newer.row.description, 'the newer cycle');
});

test('a SUMMARY.md that cannot be read contributes no rows and exactly one warning, never a throw', () => {
  const root = planningRoot({
    'phases/1': commitsTable([['1', '1', 'ccccccc', 'a readable phase']]),
    'phases/2': null,
  });
  // A directory where the summary should be: present, so not the absent state,
  // and unreadable as a file - the same shape a FIFO or a device node has.
  mkdirSync(join(root, 'phases', '2', 'SUMMARY.md'));

  let index;
  assert.doesNotThrow(() => { index = buildCommitIndex(root); });
  assert.equal(index.rows.length, 1);
  assert.equal(index.rows[0].dir.label, 'phases/1');
  assert.equal(index.warnings.length, 1, `expected exactly one warning, got ${JSON.stringify(index.warnings)}`);
  assert.match(index.warnings[0], /phases\/2\/SUMMARY\.md/);
  assert.match(index.warnings[0], /ENOTREGULAR/);
});

test('an ABSENT SUMMARY.md is silent - a phase with plans and no summary is the ordinary mid-phase state', () => {
  const root = planningRoot({ 'phases/1': null });
  const index = buildCommitIndex(root);
  assert.deepEqual(index.warnings, []);
  assert.deepEqual(index.rows, []);
  assert.equal(index.dirs.length, 1, 'the directory is still in the walk');
});

test('two abbreviations that both prefix one full sha answer ambiguous, naming both', () => {
  const full = `abcdef12${'0'.repeat(32)}`;
  const root = planningRoot({
    '_archive-v9.0.0/3': commitsTable([['1', '4', 'abcdef1', 'the seven-character era']]),
    '_archive-v9.1.0/2': commitsTable([['2', '5', 'abcdef12', 'the eight-character era']]),
  });
  const index = buildCommitIndex(root);
  const answer = resolveCommit(index, full);

  assert.equal(answer.state, 'ambiguous');
  assert.equal(answer.row, null, 'an ambiguous answer picks nobody');
  assert.equal(answer.matches.length, 2);
  assert.deepEqual(answer.matches.map((m) => m.dir.label), ['_archive-v9.0.0/3', '_archive-v9.1.0/2']);
  assert.deepEqual(answer.matches.map((m) => `${m.plan}/${m.task}`), ['1/4', '2/5']);
});

test('a sha no summary names is unresolved, which is a different answer from ambiguous', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '1', 'ddddddd', 'unrelated']]) });
  const answer = resolveCommit(buildCommitIndex(root), `eeeeeee${'0'.repeat(33)}`);
  assert.equal(answer.state, 'unresolved');
  assert.equal(answer.row, null);
  assert.deepEqual(answer.matches, []);
});

test('an absent planning root is the pre-project state: no dirs, no rows, no warning', () => {
  const index = buildCommitIndex(join(tmpdir(), 'cad-why-corpus-nothing-here'));
  assert.deepEqual(index, { dirs: [], rows: [], warnings: [] });
});

// --- The guarded read itself ----------------------------------------------

test('readArtifact tells absent, unreadable and readable apart', () => {
  const root = planningRoot({ 'phases/1': 'text' });
  assert.deepEqual(readArtifact(join(root, 'phases', '1', 'SUMMARY.md')),
    { text: 'text', absent: false, code: null });
  assert.deepEqual(readArtifact(join(root, 'phases', '1', 'nothing.md')),
    { text: null, absent: true, code: null });
  assert.deepEqual(readArtifact(join(root, 'phases', '1')),
    { text: null, absent: false, code: 'ENOTREGULAR' },
    'a non-regular file is refused BEFORE it is opened, so a FIFO cannot block the process');
});

test('readArtifact refuses a symlink resolving outside its own directory', () => {
  const root = planningRoot({ 'phases/1': 'text' });
  const outside = join(root, 'secret.txt');
  writeFileSync(outside, 'a credential the caller never asked for');

  const escape = join(root, 'phases', '1', 'CONTEXT.md');
  symlinkSync(outside, escape);
  assert.deepEqual(readArtifact(escape),
    { text: null, absent: false, code: 'EESCAPE' },
    'the walk is contained per DIRECTORY; a name joined onto a contained directory '
    + 'must be contained too, or the escape returns one level down');

  const inside = join(root, 'phases', '1', 'PLAN-1.md');
  writeFileSync(join(root, 'phases', '1', 'real.md'), 'inside the phase directory');
  symlinkSync(join(root, 'phases', '1', 'real.md'), inside);
  assert.deepEqual(readArtifact(inside),
    { text: 'inside the phase directory', absent: false, code: null },
    'a symlink that stays inside the phase directory still reads');
});

// --- Task 6: the review edge's disk and git half ---------------------------

/** A repository with three commits on `f.txt`, returned oldest first. */
function repoWithThreeCommits() {
  const dir = mkdtempSync(join(tmpdir(), 'cad-why-range-'));
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'cad', GIT_AUTHOR_EMAIL: 'cad@example.invalid',
    GIT_COMMITTER_NAME: 'cad', GIT_COMMITTER_EMAIL: 'cad@example.invalid',
  };
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore', env });
  git('init', '-q', '-b', 'main');
  const shas = [];
  for (const n of ['zero', 'one', 'two']) {
    writeFileSync(join(dir, 'f.txt'), `${n}\n`);
    git('add', '.');
    git('commit', '-q', '-m', n);
    shas.push(execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', env }).trim());
  }
  return { dir, shas };
}

test('rangeMembers answers base..head, so a record covers A and not B', () => {
  const { dir, shas } = repoWithThreeCommits();
  const [base, a, b] = shas;
  const members = rangeMembers(dir, base, a);
  assert.ok(members instanceof Set);
  assert.ok(members.has(a), 'the head of the range is in it');
  assert.ok(!members.has(b), 'a commit after the head is not');
  assert.ok(!members.has(base), 'and base itself is excluded, which is git own reading of base..head');
});

test('a range whose head this clone does not have is unresolvable, not empty', () => {
  const { dir, shas } = repoWithThreeCommits();
  assert.equal(rangeMembers(dir, shas[0], 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'), null);
  assert.equal(rangeMembers(dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', shas[2]), null);
  // Distinguishable from a range that resolves and happens to be empty.
  const empty = rangeMembers(dir, shas[2], shas[2]);
  assert.ok(empty instanceof Set);
  assert.equal(empty.size, 0);
});

test('a base_id that is not hexadecimal never reaches git argv', () => {
  const { dir, shas } = repoWithThreeCommits();
  for (const hostile of ['--upload-pack=touch /tmp/pwned', '-x', 'HEAD', '', '../../etc/passwd']) {
    assert.equal(rangeMembers(dir, hostile, shas[2]), null, `${JSON.stringify(hostile)} must be refused`);
    assert.equal(rangeMembers(dir, shas[0], hostile), null);
  }
});

test('readAdjudications finds records by the one filename rule and skips everything else', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '1', 'aaaaaaa', 'a phase']]) });
  const dir = { label: 'phases/1', path: join(root, 'phases', '1') };
  const record = {
    base_id: 'a'.repeat(40),
    head_id: 'b'.repeat(40),
    entries: [{ ruling: 'survived', claim: 'kept', failure_scenario: 'why', severity: 'high', file: 'x.mjs', line: 1 }],
  };
  writeFileSync(join(dir.path, 'ADJUDICATION-risk_surface-plan-1.json'), JSON.stringify(record));
  writeFileSync(join(dir.path, 'ADJUDICATION-risk_surface-plan-1-r2.json'), JSON.stringify(record));
  writeFileSync(join(dir.path, 'REVIEW-risk_surface-plan-1.md'), 'not a record');
  writeFileSync(join(dir.path, 'notes.json'), '{"also":"not a record"}');

  const { records, warnings } = readAdjudications(dir);
  assert.deepEqual(warnings, []);
  assert.deepEqual(records.map((r) => r.name),
    ['ADJUDICATION-risk_surface-plan-1-r2.json', 'ADJUDICATION-risk_surface-plan-1.json'],
    'sorted, so two runs read them in one order - and the round-2 record is not skipped');
  assert.equal(records[0].survivors[0].claim, 'kept');
});

test('an unparseable record warns by name and code, and the other records still read', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '1', 'aaaaaaa', 'a phase']]) });
  const dir = { label: 'phases/1', path: join(root, 'phases', '1') };
  writeFileSync(join(dir.path, 'ADJUDICATION-plan-good.json'), JSON.stringify({
    base_id: 'a'.repeat(40), head_id: 'b'.repeat(40), entries: [],
  }));
  writeFileSync(join(dir.path, 'ADJUDICATION-plan-bad.json'), '{ truncated');

  const { records, warnings } = readAdjudications(dir);
  assert.equal(records.length, 2);
  assert.deepEqual(warnings, ['phases/1/ADJUDICATION-plan-bad.json: unparseable-json']);
});

test('a phase directory with no record at all is silent', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '1', 'aaaaaaa', 'a phase']]) });
  const { records, warnings } = readAdjudications({ label: 'phases/1', path: join(root, 'phases', '1') });
  assert.deepEqual(records, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(readAdjudications({ label: 'gone/9', path: join(root, 'gone', '9') }),
    { records: [], warnings: [] }, 'and so is a directory that is not there');
});

// --- The git-history tier: the prune search and the label binding (plan 3) --

/** This repository's root: bin -> cadence-core -> root. */
const REPO_ROOT = join(HERE, '..', '..');

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'cad', GIT_AUTHOR_EMAIL: 'cad@example.invalid',
  GIT_COMMITTER_NAME: 'cad', GIT_COMMITTER_EMAIL: 'cad@example.invalid',
};

/** Run git in `dir`, returning stdout and never inheriting a real config. */
const gitIn = (dir, args) => execFileSync('git', ['-C', dir, ...args],
  { encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'ignore'] });

test('the prune search finds every close in this repository, including the three named ones', () => {
  const { prunes, warnings } = findPruneCommits(REPO_ROOT);
  assert.equal(prunes.length, 25, 'this repository has 25 closes that deleted a phase SUMMARY');
  assert.deepEqual(warnings, [], 'every one of them is single-parent, so none is refused');
  const shas = prunes.map((p) => p.commit);
  for (const named of ['72940906', 'a34b0c8a', '8d9bbac9']) {
    assert.ok(shas.some((s) => s.startsWith(named)), `${named} is among the prune commits`);
  }
  assert.ok(prunes.every((p) => p.commit.length === 40), 'full shas travel (D-17)');
});

test('--full-history is load-bearing: without it the same search returns strictly fewer', () => {
  assert.ok(PRUNE_ARGV.includes('--full-history'),
    'the flag is in the shipped argv - this assertion is half of what stops it being dropped');
  const control = PRUNE_ARGV.filter((a) => a !== '--full-history');
  const count = (args) => gitIn(REPO_ROOT, args.map((a) => (a.startsWith('--format=') ? '--format=%H' : a)))
    .split('\n').filter((l) => /^[0-9a-f]{40}$/.test(l.trim())).length;
  const withFlag = count([...PRUNE_ARGV]);
  const without = count(control);
  assert.equal(withFlag, 25);
  assert.ok(without < withFlag,
    `git's default history simplification drops closes: ${without} without the flag, ${withFlag} with it`);
  assert.equal(without, 4, 'measured 2026-08-23: 4 of 25 survive the simplification');
});

test('72940906 binds to the milestone label its own close appended to ARCHIVE.md', () => {
  const { prunes } = findPruneCommits(REPO_ROOT);
  const p = prunes.find((x) => x.commit.startsWith('72940906'));
  assert.equal(p.label, 'v3.5.9');
  assert.deepEqual(p.phases.map((x) => x.phase), ['1', '2']);
  assert.equal(p.parent.length, 40, 'the single parent is the tree the phases are recovered from');
  assert.equal(p.refused, null);
});

test('a close older than ARCHIVE.md itself reports an ABSENT label rather than guessing one', () => {
  const { prunes } = findPruneCommits(REPO_ROOT);
  const old = prunes.find((x) => x.commit.startsWith('8d9bbac9'));
  assert.equal(old.label, null,
    'ARCHIVE.md did not exist at v3.4.0, and the close subject line is not a label source (D-06)');
  const labelled = prunes.filter((p) => p.label !== null);
  assert.equal(labelled.length, 7, 'exactly the closes from v3.5.3 on, when ARCHIVE.md was created');
});

/**
 * A repository with `closes` successive milestone closes, each deleting one
 * phase directory's SUMMARY.md and appending its own `## <label>` heading to
 * `.planning/ARCHIVE.md` - the shape `cmdMilestonePrune` writes.
 * @param {string[]} labels
 * @returns {string}
 */
function repoWithCloses(labels, summaryFor = (label, phase) => `# ${label} phase ${phase}\n`, extraFiles = () => ({})) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-why-prune-'));
  gitIn(dir, ['init', '-q', '-b', 'main']);
  let archive = '# Archive\n';
  labels.forEach((label, i) => {
    const phase = String(i + 1);
    const pdir = join(dir, '.planning', 'phases', phase);
    mkdirSync(pdir, { recursive: true });
    writeFileSync(join(pdir, 'SUMMARY.md'), summaryFor(label, phase));
    for (const [name, body] of Object.entries(extraFiles(label, phase))) {
      writeFileSync(join(pdir, name), body);
    }
    gitIn(dir, ['add', '-A']);
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', `feat: ${label} phase ${phase}`],
      { env: { ...GIT_ENV, GIT_AUTHOR_DATE: `2026-01-0${i + 1}T00:00:00-05:00`, GIT_COMMITTER_DATE: `2026-01-0${i + 1}T00:00:00-05:00` }, stdio: 'ignore' });

    gitIn(dir, ['rm', '-q', '-r', join('.planning', 'phases', phase)]);
    archive += `\n## ${label}\n\n- \`phases/${phase}/SUMMARY.md\`: residue for ${label}\n`;
    // `git rm -r` on the last tracked file under `.planning/` takes the empty
    // directory with it, so the close re-creates it before writing ARCHIVE.md.
    mkdirSync(join(dir, '.planning'), { recursive: true });
    writeFileSync(join(dir, '.planning', 'ARCHIVE.md'), archive);
    gitIn(dir, ['add', '-A']);
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', `chore: prune ${label} completed phases`],
      { env: { ...GIT_ENV, GIT_AUTHOR_DATE: `2026-01-0${i + 1}T12:00:00-05:00`, GIT_COMMITTER_DATE: `2026-01-0${i + 1}T12:00:00-05:00` }, stdio: 'ignore' });
  });
  return dir;
}

test('two closes in one repository each come back under their own label, in a stable order', () => {
  const dir = repoWithCloses(['v9.0.0', 'v9.1.0']);
  const first = findPruneCommits(dir);
  const second = findPruneCommits(dir);
  assert.equal(first.prunes.length, 2);
  assert.deepEqual(first.prunes.map((p) => p.label), ['v9.1.0', 'v9.0.0'], 'newest close first');
  assert.deepEqual(first.prunes.map((p) => p.phases.map((x) => x.phase)), [['2'], ['1']]);
  assert.deepEqual(second, first, 'two runs over an unchanged repository answer identically');
});

test('a merge-shaped prune record is REPORTED, never answered out of an arbitrary parent', () => {
  // The shipped argv cannot produce this record - measured on git 2.55.0, a
  // merge matches no diff filter - so the bytes here are git's own, produced by
  // the same log with --diff-merges=first-parent added, and the refusal is
  // proved over them rather than over an invented string.
  const dir = mkdtempSync(join(tmpdir(), 'cad-why-merge-'));
  gitIn(dir, ['init', '-q', '-b', 'main']);
  mkdirSync(join(dir, '.planning', 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'phases', '1', 'SUMMARY.md'), '# s\n');
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-q', '-m', 'base']);
  gitIn(dir, ['checkout', '-q', '-b', 'side']);
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-q', '-m', 'side']);
  gitIn(dir, ['checkout', '-q', 'main']);
  writeFileSync(join(dir, 'b.txt'), 'b\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-q', '-m', 'main']);
  // `--no-commit` reports "stopped before committing as requested" and its exit
  // status is not the thing under test here.
  try { gitIn(dir, ['merge', '--no-ff', '--no-commit', 'side']); } catch { /* expected */ }
  gitIn(dir, ['rm', '-q', join('.planning', 'phases', '1', 'SUMMARY.md')]);
  gitIn(dir, ['commit', '-q', '-m', 'merge that also deletes the summary']);

  assert.deepEqual(findPruneCommits(dir).prunes, [],
    'the shipped argv does not surface a merge at all - which is why the guard is defensive');

  const stdout = gitIn(dir, [...PRUNE_ARGV.slice(0, 1), '--diff-merges=first-parent', ...PRUNE_ARGV.slice(1)]);
  const records = parsePruneRecords(stdout);
  assert.equal(records.length, 1);
  assert.equal(records[0].parents.length, 2, 'git returned a two-parent prune record');
  assert.equal(records[0].parent, null, 'so no parent tree is named');
  assert.match(records[0].refused, /is a merge with 2 parents/);
  assert.match(records[0].refused, /without picking one arbitrarily/);
});

// --- The reverse commit-to-phase map (plan 3, task 2) ----------------------

/** The full sha `72940906^:.planning/phases/1/SUMMARY.md` records as 73aa7bba. */
const FENCE_AWARE = '73aa7bba503efb228c1b423c3d93cce87494036d';

/** The merged index over this repository: both phase tiers, the off-roadmap
 * tasks tier, then git history - the four `why.mjs` itself builds. */
function mergedHere() {
  const planning = join(REPO_ROOT, '.planning');
  return mergeCommitIndexes(
    buildCommitIndex(planning), buildTaskIndex(planning), buildRecoveredIndex(REPO_ROOT),
  );
}

test('a commit behind a deleted phase directory resolves out of git history alone', () => {
  const merged = mergedHere();
  const { state, row } = resolveCommit(merged, FENCE_AWARE);
  assert.equal(state, 'resolved');
  assert.equal(row.dir.milestone, 'v3.5.9');
  assert.equal(row.dir.phase, '1');
  assert.equal(row.plan, '1');
  assert.equal(row.task, '1');
  assert.equal(row.description, 'Fence-aware heading scans in release-decision.mjs');
  assert.ok(row.dir.recovered.prune.startsWith('72940906'));
  assert.equal(row.dir.recovered.tree, '.planning/phases/1');
  assert.equal(row.dir.path, null, 'there is no directory on disk to open');

  // The same row, read straight out of the command CONTEXT D-05 names.
  const bytes = gitIn(REPO_ROOT, ['show', '72940906^:.planning/phases/1/SUMMARY.md']);
  const direct = parseCommitRows(bytes).find((r) => r.commit === '73aa7bba');
  assert.equal(row.description, direct.description);
  assert.equal(row.task, direct.task);
});

test('the recovered phase 1 is v3.5.9\'s, never the live phases/1 that holds v3.6.0\'s', () => {
  const merged = mergedHere();
  const { row, matches } = resolveCommit(merged, FENCE_AWARE);
  assert.notEqual(row.dir.label, 'phases/1');
  assert.ok(matches.every((m) => m.dir.label !== 'phases/1'),
    'the live phase 1 exists and reuses the number - a directory-keyed read would land there');
});

test('the disk tier still wins for a commit BOTH tiers can claim', () => {
  // A `--mode archive` close deleted `phases/<N>/SUMMARY.md` and added
  // `_archive-v<ver>/<N>/SUMMARY.md` in one commit, so 00537356 is in both
  // tiers. Flat-merged that would read as ambiguous; tiered it reads as the
  // record a person can open.
  const merged = mergedHere();
  const recovered = buildRecoveredIndex(REPO_ROOT);
  assert.ok(recovered.rows.some((r) => r.commit === '0053735'),
    'the recovered tier does carry it, so the tier order is what decides');
  const { state, row } = resolveCommit(merged, ISSUE_CORE);
  assert.equal(state, 'resolved');
  assert.equal(row.dir.label, '_archive-v3.4.0/1');
});

test('an 8-character abbreviation matches its own sha and no neighbour of it', () => {
  const merged = mergedHere();
  assert.equal(resolveCommit(merged, FENCE_AWARE).state, 'resolved');
  const neighbour = `73aa7bbb${FENCE_AWARE.slice(8)}`;
  assert.equal(resolveCommit(merged, neighbour).state, 'unresolved',
    'a one-character-off sha is a different commit, not a near miss');
});

test('building the map twice over the unchanged repository returns deep-equal results', () => {
  assert.deepEqual(buildRecoveredIndex(REPO_ROOT), buildRecoveredIndex(REPO_ROOT));
});

test('a recovered row naming a sha this clone does not have is stated absent, never dropped', () => {
  const table = (label, phase) => [
    `# ${label} phase ${phase}`, '', '## Commits', '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 1 | 1 | deadbeefdeadbeefdeadbeefdeadbeefdeadbeef | a commit this clone has never had |',
    '',
  ].join('\n');
  const dir = repoWithCloses(['v9.0.0'], table);
  const index = buildRecoveredIndex(dir);
  const row = index.rows.find((r) => r.commit.startsWith('deadbeef'));
  assert.ok(row, 'the row is in the map');
  assert.equal(row.present, false, 'and it says the clone cannot show that commit');
  assert.equal(row.dir.milestone, 'v9.0.0');
  assert.equal(row.dir.phase, '1');
  assert.deepEqual(index.warnings, []);
});

// --- The recovered artifacts behind the remaining edges (plan 3, task 4) ---

test('a pruned phase carrying a CONTEXT.md and no record resolves the decision edge and states the review absence', () => {
  const summary = (label, phase) => [
    `# ${label} phase ${phase}`, '', '## Commits', '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 1 | 1 | aaaaaaa | the only task |',
    '', '## Deviations', '', '- the plan said two, it was one', '',
  ].join('\n');
  const extras = () => ({
    'CONTEXT.md': ['# Context', '', '## Durable decisions', '',
      '- D-01 (the one decision): recovered out of a tree, not off a disk', ''].join('\n'),
    'PLAN.md': ['---', 'phase: 1', 'plan: 1', '---', '', '# a plan', '',
      '### Task 1: the only task', '', '- **Files:** src/a.mjs', ''].join('\n'),
  });
  const dir = repoWithCloses(['v9.2.0'], summary, extras);
  const index = buildRecoveredIndex(dir);
  const recovered = index.dirs[0];
  assert.equal(recovered.path, null, 'the directory is gone; only the tree is left');

  const records = readPhaseRecords(recovered, '1', dir);
  assert.deepEqual(records.warnings, []);
  assert.equal(records.planFile, 'PLAN.md');
  assert.match(records.context, /D-01 \(the one decision\)/);
  assert.deepEqual(parseDeviations(records.summary), ['the plan said two, it was one']);

  const decision = decisionsFor({
    planText: records.plan, contextText: records.context, taskCell: '1',
  });
  assert.equal(decision.scope, 'phase', 'no cite in this plan, so the phase set is printed and labelled');
  assert.deepEqual(decision.ids, [], 'the phase arm names no cited id, because none was cited');
  assert.match(decision.lines[0], /^D-01 \(the one decision\)/);

  const review = readAdjudications(recovered, dir);
  assert.deepEqual(review, { records: [], warnings: [] },
    'the tree carries no record - an absence, never a failure of the entry');
});

test('a recovered adjudication record is found by listing the tree, not by guessing its name', () => {
  // The discriminator in `ADJUDICATION-<trigger>-<discriminator>.json` is not
  // predictable, so the read has to ask the tree what is there.
  const summary = (label, phase) => [
    `# ${label} phase ${phase}`, '', '## Commits', '',
    '| Plan | Task | Commit | Description |', '|---|---|---|---|',
    '| 1 | 1 | aaaaaaa | the only task |', '',
  ].join('\n');
  const extras = () => ({
    'ADJUDICATION-risk_surface-plan-e7c1f09.json': JSON.stringify({
      base_id: 'a'.repeat(40),
      head_id: 'b'.repeat(40),
      entries: [{ ruling: 'survived', claim: 'kept out of a tree', failure_scenario: 'why', severity: 'high' }],
    }),
    'REVIEW-risk_surface-plan-e7c1f09.md': 'not a record',
  });
  const dir = repoWithCloses(['v9.3.0'], summary, extras);
  const recovered = buildRecoveredIndex(dir).dirs[0];
  const { records, warnings } = readAdjudications(recovered, dir);
  assert.deepEqual(warnings, []);
  assert.deepEqual(records.map((r) => r.name), ['ADJUDICATION-risk_surface-plan-e7c1f09.json']);
  assert.equal(records[0].survivors[0].claim, 'kept out of a tree');
});

test('the close a gap sits under is the EARLIEST one at or after the commit, never the newest', () => {
  // `findPruneCommits` answers newest-first, so picking the first match would
  // put every old commit under the most recent close.
  const prunes = [
    { commit: 'c'.repeat(40), date: '2026-08-01T00:00:00-04:00', label: 'v3.0.0' },
    { commit: 'b'.repeat(40), date: '2026-06-01T00:00:00-04:00', label: 'v2.0.0' },
    { commit: 'a'.repeat(40), date: '2026-04-01T00:00:00-04:00', label: 'v1.0.0' },
  ];
  assert.equal(closeOver(prunes, '2026-03-01T00:00:00-04:00').label, 'v1.0.0');
  assert.equal(closeOver(prunes, '2026-05-01T00:00:00-04:00').label, 'v2.0.0');
  assert.equal(closeOver(prunes, '2026-07-01T00:00:00-04:00').label, 'v3.0.0');
  assert.equal(closeOver(prunes, '2026-09-01T00:00:00-04:00'), null,
    'a commit newer than every close sits under no milestone label - and is not guessed into one');
  assert.equal(closeOver(prunes, ''), null);
  assert.equal(closeOver([], '2026-05-01T00:00:00-04:00'), null);
});

// --- The off-roadmap tasks tier (phase 3 plan 2, task 1) -------------------
//
// A `/cad-task` run leaves `tasks/<slug>/RECORD.md` and no phase directory at
// all, so this tier's fixtures are built rather than borrowed: this repository
// holds exactly one record today, and the states that matter here - a task
// directory with no record, and a record that cannot be read - are states it
// does not hold.

/** One RECORD.md's bytes, in the grammar `lib/task-record.mjs` renders: a
 * three-column `## Commits` table with no Plan column, and a `- **Files:**`
 * declaration under an anchored `### Task 1:` heading. */
const taskRecord = (rows, files = 'src/a.mjs') => [
  '# Task: a task', '', '## What shipped', '', '- what it did', '',
  '## Commits', '',
  '| Task | Commit | Description |',
  '| --- | --- | --- |',
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  '', '## Files', '', '### Task 1: the title', '', `- **Files:** ${files}`, '',
].join('\n');

/**
 * A planning root holding `tasks/<slug>/`. A `null` body is a task directory
 * with a PLAN.md and NO record - the planned path mid-run, which the lister
 * must not return at all.
 * @param {Record<string, string|null>} spec keyed by slug
 * @returns {string}
 */
function tasksRoot(spec) {
  const root = mkdtempSync(join(tmpdir(), 'cad-why-tasks-'));
  for (const [slug, body] of Object.entries(spec)) {
    const dir = join(root, 'tasks', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'PLAN.md'), '# a task plan\n');
    if (body !== null) writeFileSync(join(dir, 'RECORD.md'), body);
  }
  return root;
}

test('one task record yields one directory and its table rows, each carrying the slug', () => {
  const root = tasksRoot({
    'bound-plan-size': taskRecord([
      ['1', 'aaaaaaa', 'the first commit'],
      ['1', 'bbbbbbb', 'the second commit'],
    ]),
    'never-recorded': null,
  });
  const index = buildTaskIndex(root);

  assert.deepEqual(index.warnings, []);
  assert.deepEqual(index.dirs.map((d) => d.label), ['tasks/bound-plan-size'],
    'a task directory with a plan and no record is not in the walk');
  assert.equal(index.dirs[0].slug, 'bound-plan-size');
  assert.equal(index.dirs[0].group, 'tasks');
  assert.equal(index.dirs[0].phase, null, 'a task is off-roadmap and names no phase number');
  assert.equal(index.dirs[0].milestone, null);
  assert.equal(index.dirs[0].path, join(root, 'tasks', 'bound-plan-size'),
    'the descriptor points at the DIRECTORY, so the artifact readers can open names inside it');

  assert.deepEqual(index.rows.map((r) => r.commit), ['aaaaaaa', 'bbbbbbb'],
    "the table's own order, preserved");
  assert.deepEqual(index.rows.map((r) => r.dir.slug), ['bound-plan-size', 'bound-plan-size']);
  assert.deepEqual(index.rows.map((r) => r.task), ['1', '1']);
  assert.deepEqual(index.rows.map((r) => r.plan), ['', ''],
    'a record carries no Plan column, so the cell is empty rather than invented');

  const answer = resolveCommit(index, `aaaaaaa${'0'.repeat(33)}`);
  assert.equal(answer.state, 'resolved');
  assert.equal(answer.row.description, 'the first commit');
});

test('an absent tasks/ is the never-ran-a-task state: no dirs, no rows, no warning', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '1', 'ccccccc', 'a phase, and no task']]) });
  assert.deepEqual(buildTaskIndex(root), { dirs: [], rows: [], warnings: [] });
  assert.deepEqual(buildTaskIndex(join(tmpdir(), 'cad-why-tasks-nothing-here')),
    { dirs: [], rows: [], warnings: [] }, 'and so is an absent planning root');
});

test('a RECORD.md that cannot be read warns by artifact and errno code, and contributes no rows', () => {
  const root = tasksRoot({ 'escaping-record': taskRecord([['1', 'ddddddd', 'never reached']]) });
  // A record that RESOLVES out of its own directory: the lister contains the
  // walk against a resolve OUT OF THE PLANNING ROOT, and `readArtifact` is
  // what refuses the one level further in.
  writeFileSync(join(root, 'elsewhere.md'), taskRecord([['1', 'eeeeeee', 'a file the caller never asked for']]));
  const record = join(root, 'tasks', 'escaping-record', 'RECORD.md');
  rmSync(record);
  symlinkSync(join(root, 'elsewhere.md'), record);

  let index;
  assert.doesNotThrow(() => { index = buildTaskIndex(root); });
  assert.deepEqual(index.rows, [], 'nothing it could not read reaches the index');
  assert.equal(index.dirs.length, 1, 'the directory is still in the walk');
  assert.equal(index.warnings.length, 1, `expected exactly one warning, got ${JSON.stringify(index.warnings)}`);
  assert.match(index.warnings[0], /tasks\/escaping-record\/RECORD\.md/);
  assert.match(index.warnings[0], /EESCAPE/);
  assert.ok(!/caller never asked for/.test(index.warnings[0]),
    'the warning names a code, never the bytes it refused to read');
});

test('building the tasks tier twice over an unchanged root returns deep-equal results', () => {
  const root = tasksRoot({
    'second-slug': taskRecord([['1', 'fffffff', 'later by name']]),
    'first-slug': taskRecord([['1', 'ggggggg', 'earlier by name']]),
  });
  assert.deepEqual(buildTaskIndex(root), buildTaskIndex(root));
  assert.deepEqual(buildTaskIndex(root).dirs.map((d) => d.label),
    ['tasks/first-slug', 'tasks/second-slug'], 'slug order, never directory order');
});

test("this repository's own tasks tier holds the bound-plan-size record and its three commits", () => {
  const index = buildTaskIndex(REAL);
  assert.deepEqual(index.warnings, []);
  assert.ok(index.dirs.some((d) => d.label === 'tasks/bound-plan-size'));
  assert.ok(index.dirs.every((d) => d.phase === null && d.milestone === null && d.group === 'tasks'));
  const row = index.rows.find((r) => r.commit.startsWith('093408c9'));
  assert.ok(row, 'the record names the commit `/cad-why` has to resolve');
  assert.equal(row.dir.slug, 'bound-plan-size');
});

// --- The tier is merged, ordered, and asked (phase 3 plan 2, task 2) -------

/** An empty tier, for a merge whose git-recovered half is not under test. */
const noTier = () => ({ dirs: [], rows: [], warnings: [] });

test('a sha named by BOTH a phase summary and a task record resolves to the PHASE', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '2', 'abcdef1', 'the phase claims it']]) });
  const tasks = join(root, 'tasks', 'both-name-it');
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, 'RECORD.md'), taskRecord([
    ['1', 'abcdef1', 'and so does the task record'],
    ['1', 'bcdef12', 'this one only the task record names'],
  ]));

  const merged = mergeCommitIndexes(buildCommitIndex(root), buildTaskIndex(root), noTier());
  assert.deepEqual(merged.tiers.map((t) => t.dirs.map((d) => d.label)),
    [['phases/1'], ['tasks/both-name-it'], []], 'three tiers, in the order the header states');

  const shared = resolveCommit(merged, `abcdef1${'0'.repeat(33)}`);
  assert.equal(shared.state, 'resolved');
  assert.equal(shared.row.dir.label, 'phases/1');
  assert.equal(shared.row.description, 'the phase claims it');
  assert.equal(shared.row.dir.slug, undefined,
    'the phase spine is the authority when a commit is named by both - flat-merged this would read ambiguous');

  const only = resolveCommit(merged, `bcdef12${'0'.repeat(33)}`);
  assert.equal(only.state, 'resolved');
  assert.equal(only.row.dir.label, 'tasks/both-name-it');
  assert.equal(only.row.dir.slug, 'both-name-it');
  assert.equal(only.row.description, 'this one only the task record names');
});

test('the tasks tier is asked AHEAD of the git-recovered one, and prunes still come off recovered alone', () => {
  const root = tasksRoot({ 'ahead-of-recovery': taskRecord([['1', 'abc1234', 'the record a reader can open']]) });
  const recovered = {
    dirs: [{ label: 'deadbeef:.planning/phases/9', path: null, group: 'recovered', phase: '9', milestone: 'v9.9.9' }],
    rows: [{ plan: '1', task: '1', commit: 'abc1234', description: 'the tree a reader cannot open',
      dir: { label: 'deadbeef:.planning/phases/9', path: null, group: 'recovered', phase: '9', milestone: 'v9.9.9' } }],
    warnings: ['a recovered warning'],
    prunes: [{ commit: 'f'.repeat(40), date: '2026-01-01T00:00:00-05:00', label: 'v9.9.9' }],
  };
  const merged = mergeCommitIndexes(buildCommitIndex(root), buildTaskIndex(root), recovered);

  const answer = resolveCommit(merged, `abc1234${'0'.repeat(33)}`);
  assert.equal(answer.row.dir.slug, 'ahead-of-recovery');
  assert.equal(answer.row.description, 'the record a reader can open');
  assert.deepEqual(merged.prunes, recovered.prunes, 'the close history belongs to the recovered tier alone');
  assert.deepEqual(merged.warnings, ['a recovered warning']);
  assert.deepEqual(merged.dirs.map((d) => d.label),
    ['tasks/ahead-of-recovery', 'deadbeef:.planning/phases/9']);
});

test("this repository's merged index resolves 093408c9 to the bound-plan-size task, and 00537356 still to its phase", () => {
  const merged = mergedHere();
  const task = resolveCommit(merged, '093408c97560521e1e295ce949ac8beda2f29e50');
  assert.equal(task.state, 'resolved');
  assert.equal(task.row.dir.slug, 'bound-plan-size');
  assert.equal(task.row.dir.label, 'tasks/bound-plan-size');
  assert.equal(task.row.dir.phase, null);

  const phase = resolveCommit(merged, ISSUE_CORE);
  assert.equal(phase.state, 'resolved');
  assert.equal(phase.row.dir.label, '_archive-v3.4.0/1', 'the phase tiers are untouched by the new one');
});

// --- The record's own declaration reaches the join (phase 3 plan 2, task 4) -

test('a task directory holding BOTH a PLAN.md and a RECORD.md declares through the RECORD', () => {
  const root = tasksRoot({ 'planned-then-run': taskRecord([['1', 'abc1234', 'what it did']], 'src/shipped.mjs') });
  // The PLANNED `/cad-task` arm writes this; it states what the run set out to
  // touch, which is not what the `declared by:` edge is asking.
  writeFileSync(join(root, 'tasks', 'planned-then-run', 'PLAN.md'), [
    '# a task plan', '', '### Task 1: the intent', '', '- **Files:** src/intended.mjs', '',
  ].join('\n'));

  const dir = buildTaskIndex(root).dirs[0];
  const records = readPhaseRecords(dir, '');
  assert.deepEqual(records.warnings, []);
  assert.equal(records.planFile, 'RECORD.md', 'the record is tried ahead of the plan, not only as a fallback');
  assert.deepEqual(taskDeclaredFiles(records.plan), [{ ordinal: 1, title: 'the title', files: ['src/shipped.mjs'] }]);
  assert.deepEqual(declaringTasks(records.plan, 'src/intended.mjs'), [],
    "the plan's declaration never reaches the edge for a task directory");
  assert.equal(records.context, '', 'a task directory has no CONTEXT.md, and absent is silent');
  assert.equal(records.summary, '', 'nor a SUMMARY.md');
});

test('a PHASE directory is unaffected: RECORD.md is never tried where there is no slug', () => {
  const root = planningRoot({ 'phases/1': commitsTable([['1', '1', 'abc1234', 'a phase task']]) });
  // A file that would win if the task arm leaked onto the phase tier.
  writeFileSync(join(root, 'phases', '1', 'RECORD.md'), '### Task 1: never read\n\n- **Files:** src/wrong.mjs\n');
  const dir = buildCommitIndex(root).dirs[0];
  const records = readPhaseRecords(dir, '1');
  assert.equal(records.planFile, 'PLAN.md');
  assert.deepEqual(declaringTasks(records.plan, 'src/wrong.mjs'), []);
});
