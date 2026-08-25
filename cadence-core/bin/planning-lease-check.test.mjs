// Zero-dep tests for `planning.mjs lease-check`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, realpathSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, seamSource, run } from './planning.test.mjs';
import { CENSUSES, censusesAtRisk } from './lib/census-registry.mjs';
import { parsePlanFiles } from './lib/planning-files.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// --- lease-check: the declared file lease, enforced (QW-03) ------------------

/**
 * A scratch GIT repo whose `.planning/phases/<n>/` holds one plan declaring
 * `files`. Returns {repo, dir} - the seam is run with cwd inside the repo,
 * because it resolves the staged set from `git rev-parse --show-toplevel`.
 */
export function leaseRepo({ phase = 1, plan = 'PLAN.md', files = ['a.txt'], body = '' } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-lease-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: repo });
  const dir = join(repo, '.planning');
  const pdir = join(dir, 'phases', String(phase));
  mkdirSync(pdir, { recursive: true });
  const fm = files === null ? '' : `---\nphase: ${phase}\nfiles:\n${files.map((f) => `  - ${f}\n`).join('')}---\n`;
  writeFileSync(join(pdir, plan), `${fm}# Plan\n${body}`);
  return { repo, dir, pdir };
}

/** Run the seam inside a repo; parse its one JSON line and its exit code.
 * `env` is merged over the inherited environment, which is how the AC8 arm
 * below points the seam's own `git rev-parse` at an unreadable GIT_DIR. */
export function leaseCheck(repo, dir, args, env) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'lease-check', ...args],
      { encoding: 'utf8', cwd: repo, ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

export const stage = (repo, name, body = 'x') => {
  const file = join(repo, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  execFileSync('git', ['add', '--', name], { cwd: repo });
};

test('lease-check: a clean lease is ok:true', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt', 'src/b.js'] });
  stage(repo, 'a.txt');
  stage(repo, 'src/b.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 2);
  assert.equal(r.declared, 2);
  assert.equal(r._exit, 0);
});

test('lease-check: an undeclared staged path is refused and NAMED', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'a.txt');
  stage(repo, 'b.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['b.txt']);
  assert.match(r.hint, /files: list/);
  assert.equal(r._exit, 1);
});

test('lease-check: the plan\'s OWN report file is the one exemption', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, '.planning/phases/1/reports/plan-1.md');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
  // ...and nothing else under reports/ is: another plan's report is undeclared.
  stage(repo, '.planning/phases/1/reports/plan-2.md');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.undeclared, ['.planning/phases/1/reports/plan-2.md']);
});

test('lease-check: the ROTATED report is exempt too, beside the canonical one', () => {
  // AC5. Since #195 an executor rotates the previous run's report aside before
  // its first write, so a re-run holds `plan-1.md` and `plan-1.1.md` at once and
  // stages both on the same task commit. Under byte equality the rotated
  // sibling read as an undeclared file, blocking the executor for obeying its
  // own contract - the one place SUMMARY.md named the two halves as able to
  // collide.
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, '.planning/phases/1/reports/plan-1.md');
  stage(repo, '.planning/phases/1/reports/plan-1.1.md');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  // The count is taken BEFORE the exemption filter, so widening the exemption
  // moves no reported number (D-09).
  assert.equal(r.staged, 2);
  assert.equal(r.undeclared, undefined);

  // A two-digit suffix is the same name shape; the picker mints one once nine
  // are taken.
  stage(repo, '.planning/phases/1/reports/plan-1.12.md');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
});

test('lease-check: the widened exemption is still THIS plan\'s, not the directory\'s', () => {
  // AC5's second half and AC6. `plan-2.md` is another plan's record and
  // `plan-11.md` is plan eleven's, neither of them plan 1 rotated; the two risk
  // diffs live in this same directory and a `risk_surface` checkpoint
  // deliberately leaves them staged, so a directory lease would let a blocking
  // gate's own flagged evidence ride into a task commit. `PLAN-1.1.MD` is a
  // name no executor produces (D-08), and a nested `reports/old/plan-1.1.md` is
  // not directly in the directory the exemption names.
  for (const name of ['plan-2.md', 'plan-11.md', 'plan-1-risk.diff',
    'plan-1-risk-task-2.diff', 'PLAN-1.1.MD', 'old/plan-1.1.md']) {
    const { repo, dir } = leaseRepo({ files: ['a.txt'] });
    stage(repo, '.planning/phases/1/reports/plan-1.md');
    stage(repo, `.planning/phases/1/reports/${name}`);
    const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
    assert.equal(r.ok, false, `${name} was exempted: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'undeclared-files');
    assert.deepEqual(r.undeclared, [`.planning/phases/1/reports/${name}`]);
    assert.equal(r._exit, 1);
  }
});

test('lease-check: a declared directory ends in / and matches by PREFIX', () => {
  const { repo, dir } = leaseRepo({ files: ['src/auth/'] });
  stage(repo, 'src/auth/session.js');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
  // A non-slashed declaration never licenses a sibling by substring.
  const b = leaseRepo({ files: ['src/auth'] });
  stage(b.repo, 'src/authority.js');
  assert.equal(leaseCheck(b.repo, b.dir, ['--phase', '1', '--plan', '1']).ok, false);
});

// Both readers now reach containment through lib/lease-grammar.mjs. These two
// pin the half that must NOT have moved: for a declaration that was already
// unambiguous, the verdict and both counts are what they were before the
// shared predicate existed, and an empty lease still licenses nothing.

test('lease-check: a two-file clean lease still reports staged: 2, declared: 2 through the shared predicate', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt', 'src/b.js'] });
  stage(repo, 'a.txt');
  stage(repo, 'src/b.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 2);
  assert.equal(r.declared, 2);
  assert.equal(r.undeclared, undefined);
  assert.equal(r._exit, 0);
});

test('lease-check: a plan whose files: list is empty is still refused as undeclared-files, exit 1', () => {
  const { repo, dir } = leaseRepo({ files: [] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['a.txt']);
  assert.equal(r.declared, 0);
  assert.equal(r._exit, 1);
});

test('lease-check: PLAN-<k>.md is selected by --plan', () => {
  const { repo, dir, pdir } = leaseRepo({ plan: 'PLAN-1.md', files: ['a.txt'] });
  writeFileSync(join(pdir, 'PLAN-2.md'), '---\nphase: 1\nfiles:\n  - b.txt\n---\n# Plan 2\n');
  stage(repo, 'b.txt');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '2']).ok, true);
  const one = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(one.ok, false);
  assert.deepEqual(one.undeclared, ['b.txt']);
});

test('lease-check: a sole declaration of ./a.txt licenses nothing - the spelling reached neither reader', () => {
  // The other half of the two-door refusal, at the enforcement end: the
  // declaration is dropped before this seam sees it, so staging the file it
  // MEANT is undeclared, and the named diagnostic rides the same envelope that
  // tells the author why.
  const { repo, dir } = leaseRepo({ files: ['./a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['a.txt']);
  assert.equal(r.declared, 0);
  assert.deepEqual(r.frontmatter_issues.map((i) => [i.line, i.code]),
    [[4, 'redundant-path-segment']], JSON.stringify(r.frontmatter_issues));
  assert.equal(r._exit, 1);
});

test('lease-check: a missing plan is ok:false, never an empty-lease pass', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '9', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-plan');
  assert.equal(r._exit, 1);
});

test('lease-check: an unreadable staged set is ok:false, never a pass', () => {
  // Outside any git repo `rev-parse --show-toplevel` fails, and an unprovable
  // lease must refuse rather than report a clean one.
  const outside = mkdtempSync(join(tmpdir(), 'cad-lease-nogit-'));
  const dir = join(outside, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'), '---\nphase: 1\nfiles:\n  - a.txt\n---\n');
  const r = leaseCheck(outside, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-staged-set');
});

test('lease-check: the no-staged-set detail names the failure without a credential', () => {
  // The fourth emit site EXP-01 covers, end to end rather than by source read:
  // `GIT_DIR` at an unreadable path makes the seam's own `git rev-parse
  // --show-toplevel` fail with `fatal: not a git repository: '<path>'`, and git
  // quotes the path back verbatim - so a path carrying userinfo puts a
  // credential straight into `detail`. Measured 2026-08-13 on git 2.55.0. No
  // network: the path does not exist and `.invalid` is reserved.
  const outside = mkdtempSync(join(tmpdir(), 'cad-lease-leak-'));
  const dir = join(outside, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'), '---\nphase: 1\nfiles:\n  - a.txt\n---\n');
  const r = leaseCheck(outside, dir, ['--phase', '1', '--plan', '1'],
    { GIT_DIR: '/nonexistent/cad:s3cr3t-tok@host.invalid/g' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-staged-set');
  assert.ok(r.detail && r.detail.length > 0, JSON.stringify(r));
  assert.equal(r.detail.includes('s3cr3t-tok'), false, r.detail);
  assert.equal(r.detail.includes('cad:'), false, r.detail);
  // The rest of the message survives, or the redaction has traded one useless
  // envelope for another: the host, the path, and the seam's own wording.
  assert.ok(r.detail.includes('could not read the staged set'), r.detail);
  assert.ok(r.detail.includes('host.invalid'), r.detail);
  assert.ok(r.detail.includes('/nonexistent/'), r.detail);
});

test('source: planning.mjs\'s no-staged-set detail goes through redactUrl', () => {
  // The census, so a site added later fails here rather than shipping a
  // credential. planning.mjs carries SEVEN other caught-error details this
  // requirement does not cover - partial-apply, phase-done's partial-flip,
  // write-failed, the dispatch-level internal catch, `capture --text-file`'s
  // read failure, `capture-sections`' unreadable-capture and `uat record
  // --fields-file`'s JSON parse failure - so the pin is by COUNT: twelve uses
  // exactly five of them wrapped. Adding a site moves the first number whether
  // or not the author remembered the helper.
  //
  // The first four wrapped sites, all git failures on the same EXP-01 rail:
  // `cmdLeaseCheck`'s `no-staged-set` detail; `resolveRange`, where a failing
  // `git rev-parse` quotes back a remote URL that can carry credentials in its
  // userinfo, and whose redacted error is the detail BOTH `risk-check run`
  // (`no-diff`) and `risk-check status` (`unresolved-range`) emit;
  // `risk-check run`'s own `git diff` catch; and `groundCitations`' probe,
  // whose failure is the one the adjudication record reports as a grounding
  // check that could not run. A git failure detail is exactly the string EXP-01
  // covers, so a git call added to this file arrives wrapped or this row goes
  // red - which is how this row answered the tenth site.
  //
  // The FIFTH wrapped site is not a git failure: it is `readQueue`'s, shared by
  // its scandir, lstat and JSON.parse arms. The parse arm is why it is wrapped
  // at all - a queue member's bytes are what a REVIEW PROVIDER returned, so
  // V8's parse message quotes text this repository did not author, and that
  // detail is printed straight at a human by the land refusal. One helper
  // covers all three arms rather than the parse arm alone, because splitting
  // them would leave the next arm added there to guess which class it is in.
  //
  // Why `capture --text-file`, `capture-sections` and phase-done's
  // partial-flip are NOT wrapped: each
  // detail is an `fs` error over a path the CALLER just named, so the only
  // string it can echo is one the caller already holds - partial-flip's is
  // whatever atomicWrite threw over `--dir`'s own ROADMAP.md or
  // REQUIREMENTS.md, and this seam makes no network call at all. `redactUrl` targets a
  // credential arriving from a remote the user never typed, which a local path
  // read cannot be. `uat record --fields-file`'s parse failure is the same
  // class one step further in: a JSON syntax error over the caller's own file.
  // The `-file` transports' READ failures are not counted here at all - they
  // live in lib/text-flag-file.mjs, which this file-scoped census does not
  // walk, and they are the same caller-named-path class.
  //
  // `task-record` added BOTH classes at once, which is what this row is for: its
  // `git log`/`git diff` catch is wrapped, on the same argument as `risk-check
  // run`'s, and its `mkdirSync`/`atomicWrite` catch is NOT - that detail is an
  // `fs` error over the path `--dir` just named, the caller-named-path class
  // `capture --text-file` and phase-done's partial-flip already sit in.
  // `capture-check`'s unreadable-but-present arm is the same caller-named-path
  // class, unwrapped for the same reason `capture-sections`' is: an `fs` error
  // over the path `--file` or `--dir` just named carries no remote credential.
  // CADENCE-CENSUS: planning-detail-sites | asserts: 15 error-detail sites across the whole planning seam, 6 of them wrapped in redactUrl
  const IDIOM = /e && e\.message \? e\.message : String\(e\)/g;
  const WRAPPED = /redactUrl\(e && e\.message \? e\.message : String\(e\)\)/g;
  const src = seamSource();
  assert.equal((src.match(IDIOM) || []).length, 15, 'the planning seam gained or lost a detail site');
  assert.equal((src.match(WRAPPED) || []).length, 6,
    'a git-failure detail (no-staged-set, resolveRange, risk-check run\'s diff catch, '
    + 'task-record\'s range read or groundCitations\' probe) or readQueue\'s '
    + 'provider-authored parse detail is unredacted');
  assert.match(src, /could not read the staged set: \$\{redactUrl\(/);
});

test('lease-check: nothing staged is a clean lease, not a refusal', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true);
  assert.equal(r.staged, 0);
});

test('lease-check: a plan declaring nothing licenses nothing', () => {
  const { repo, dir } = leaseRepo({ files: [] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.undeclared, ['a.txt']);
});

test('lease-check: bad flags are refused before any read', () => {
  const { repo, dir } = leaseRepo({});
  assert.equal(leaseCheck(repo, dir, ['--plan', '1']).reason, 'bad-args');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1']).reason, 'bad-args');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', 'x']).reason, 'bad-args');
});

/**
 * A git call inside a scratch lease repo with the user's own global/system
 * config neutralized - `commit.gpgsign` in a developer's global config would
 * otherwise make the seed commit prompt for a passphrase in CI.
 */
const leaseGit = (repo, args) => execFileSync('git', args, {
  cwd: repo,
  stdio: 'pipe',
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
});

test('lease-check: a rename is checked on BOTH sides, so another plan\'s file is not renamed away', () => {
  // src/other.js belongs to some OTHER plan: committed, and NOT declared here.
  // Renaming it onto this plan's declared `a.txt` destroys it, and a
  // destination-only read reports a clean lease.
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  const src = join(repo, 'src', 'other.js');
  mkdirSync(dirname(src), { recursive: true });
  writeFileSync(src, 'module.exports = 1;\n');
  leaseGit(repo, ['add', '--', 'src/other.js']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  leaseGit(repo, ['mv', 'src/other.js', 'a.txt']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.ok(r.undeclared.includes('src/other.js'),
    `the rename SOURCE must be named: ${JSON.stringify(r)}`);
});

test('lease-check: a declared non-ASCII path is admitted, not refused for its bytes', () => {
  // At default `core.quotePath` git returns `"src/caf\303\251.js"` - quoted and
  // octal-escaped - and the lease refuses a path it was itself handed.
  const { repo, dir } = leaseRepo({ files: ['src/café.js'] });
  stage(repo, 'src/café.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 1);
});

/**
 * An absolute path under `repo` whose basename carries ONE byte that is not
 * valid UTF-8 (`src/caf<byte>.js`). Two different such bytes produce two
 * DIFFERENT paths that a utf8 decode renders identically as `src/caf<U+FFFD>.js`
 * - which is the whole point of the two cases below.
 */
const rawLeasePath = (repo, byte) => Buffer.concat([
  Buffer.from(`${repo}/src/caf`), Buffer.from([byte]), Buffer.from('.js'),
]);

/** A plan file written BYTE-EXACTLY, so `files:` can name a non-UTF-8 path. */
const rawPlan = (pdir, byte) => writeFileSync(join(pdir, 'PLAN.md'), Buffer.concat([
  Buffer.from('---\nphase: 1\nfiles:\n  - src/caf'), Buffer.from([byte]),
  Buffer.from('.js\n---\n# Plan\n'),
]));

test('lease-check: a rename between two un-decodable paths is never a clean lease', () => {
  // `git mv src/caf<0xE9>.js src/caf<0xFF>.js` with only the DESTINATION
  // declared destroys another plan's file. git reports it correctly
  // (`R100\0src/caf\351.js\0src/caf\377.js\0`), but reading that stream as a
  // utf8 STRING maps both invalid bytes to U+FFFD, the two paths collapse to
  // one, and the source is licensed by the destination's declaration.
  const { repo, dir, pdir } = leaseRepo({ files: [] });
  rawPlan(pdir, 0xFF);
  const src = rawLeasePath(repo, 0xE9);
  const dst = rawLeasePath(repo, 0xFF);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(src, 'module.exports = 1;\n');
  leaseGit(repo, ['add', '-A']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  renameSync(src, dst);
  leaseGit(repo, ['add', '-A']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.notEqual(r.ok, true,
    `a rename destroying an undeclared file must not pass: ${JSON.stringify(r)}`);
  assert.equal(r.reason, 'unrepresentable-paths', JSON.stringify(r));
  assert.deepEqual(r.unrepresentable, ['"src/caf\\351.js"', '"src/caf\\377.js"']);
});

test('lease-check: a staged path that is not valid UTF-8 is refused BY NAME, never guessed at', () => {
  // The declared side is read from a utf8 plan file, so it cannot represent
  // this path either. Neither side of the comparison can be honest about it and
  // the gate says so, rather than matching two replacement characters and
  // licensing every sibling that differs only in its invalid bytes.
  const { repo, dir, pdir } = leaseRepo({ files: [] });
  rawPlan(pdir, 0xE9);
  leaseGit(repo, ['add', '-A']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(rawLeasePath(repo, 0xE9), 'x');
  leaseGit(repo, ['add', '-A']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unrepresentable-paths');
  assert.deepEqual(r.unrepresentable, ['"src/caf\\351.js"']);
  assert.equal(r._exit, 1);
});

// --- the commit-time refusal, split by whether the path HOLDS a count --------
//
// Criterion 6 is carried BOTH ways, on the `planning/risk-check.mjs` pattern:
// a distinct reason on the ENVELOPE, which is what the caller in front of the
// refusal acts on, and an appended `outcome` event on the RECORD, which is what
// a later reader joins on. The two halves are different on purpose - the
// envelope carries the file list and the hint, the record carries the census
// identity - so the pair below asserts each half is where it belongs and not in
// the other.

test('lease-check: a staged census FILE is refused by a reason of its own, and leaves a record', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'cadence-core/bin/trace.test.mjs');

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-census-files');
  assert.notEqual(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['cadence-core/bin/trace.test.mjs']);
  assert.deepEqual(r.census_files, ['cadence-core/bin/trace.test.mjs']);
  assert.equal(r.trace.written, true, JSON.stringify(r.trace));
  assert.equal(r._exit, 1);

  const lines = readFileSync(join(dir, 'trace.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1, lines.join(' | '));
  const ev = JSON.parse(lines[0]);
  assert.equal(ev.family, 'outcome');
  assert.equal(ev.event, 'census_undeclared');
  assert.deepEqual(ev.censuses, ['trace-refusal-sentences']);
  // The halves, each asserted absent from the other side.
  assert.equal(r.censuses, undefined, 'the census identity belongs to the record');
  assert.equal(ev.undeclared, undefined, 'the offending file list belongs to the envelope');
});

test('lease-check: an undeclared path holding no count keeps the old reason, and writes nothing', () => {
  // The append IS the distinguishing signal. Widening it to every refusal would
  // destroy the distinction criterion 6 asks for, so this arm asserts the trace
  // file was never created at all - not merely that it holds no census line.
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'src/other.js');

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['src/other.js']);
  assert.equal(r.census_files, undefined);
  assert.equal(r.trace, undefined);
  assert.equal(existsSync(join(dir, 'trace.jsonl')), false);
  assert.equal(r._exit, 1);
});

// --- lease-check --plan-time: the same lease question, asked BEFORE the run ---
//
// The commit-time arms above ask "did this commit stage a path the plan never
// named". These ask "will the declared work move a hand-maintained count whose
// holding file the plan never named" - the same defect one executor earlier,
// while the remedy is still an edit to the plan rather than a lease amendment
// mid-run.
//
// Every arm below builds its tree with `planTimeTree` and NOT with `leaseRepo`:
// there is deliberately no git repository around these fixtures, because the
// claim is that this arm reads none. A fixture with a repo around it would let
// a `git` call pass unnoticed.

/**
 * A `.planning` tree holding one plan, and NO git repository around it.
 *
 * Returns the containing directory as `cwd` so a caller can run the seam from
 * inside it, and `pdir` so the "reads paths, never instructions" arm can
 * rewrite the SAME plan file - two runs over one path are what make their two
 * stdouts comparable byte for byte.
 */
function planTimeTree(files, body = '') {
  const cwd = mkdtempSync(join(tmpdir(), 'cad-plantime-'));
  const dir = join(cwd, '.planning');
  const pdir = join(dir, 'phases', '1');
  mkdirSync(pdir, { recursive: true });
  writePlanTimePlan(pdir, files, body);
  return { cwd, dir, pdir };
}

/** One plan file: frontmatter from `files`, then `body` verbatim. */
function writePlanTimePlan(pdir, files, body = '') {
  const fm = files === null ? ''
    : `---\nphase: 1\nfiles:\n${files.map((f) => `  - ${f}\n`).join('')}---\n`;
  writeFileSync(join(pdir, 'PLAN.md'), `${fm}# Plan\n${body}`);
}

/** The arm's RAW stdout and exit code. Raw, because the "reads paths, never
 *  instructions" arm compares two runs byte for byte and a parse would hide a
 *  difference in field order. `process.execPath` and not `node`, because the
 *  no-git arm hands the child a PATH holding one stub and nothing else. */
function planTimeRaw(cwd, dir, env) {
  let stdout;
  let code = 0;
  const argv = [PLANNING, '--dir', dir, 'lease-check', '--phase', '1', '--plan', '1', '--plan-time'];
  try {
    stdout = execFileSync(process.execPath, argv,
      { encoding: 'utf8', cwd, ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { stdout, code };
}

/** planTimeRaw's one JSON line, parsed, with its exit code alongside. */
function planTime(cwd, dir, env) {
  const r = planTimeRaw(cwd, dir, env);
  return { ...JSON.parse(r.stdout), _exit: r.code };
}

// Phase 5's PLAN-1 lease EXACTLY as that plan was written - the run that halted
// at task 1 with 0 of 8 tasks, having leased five paths and named neither
// `trace.test.mjs` nor `self-verify.test.mjs` anywhere in the plan body.
// Transcribed here rather than shelled out to
// `git show 6645ce4b:.planning/phases/4/PLAN-1.md`, so a shallow clone still
// runs this test.
const PHASE5_LEASE = [
  'cadence-core/bin/planning.mjs',
  'cadence-core/bin/planning/',
  'cadence-core/bin/helper-census.test.mjs',
  'cadence-core/bin/prose-agreement.test.mjs',
  'cadence-core/bin/planning.test.mjs',
];

// The holding files that lease puts at risk and never declares. Criterion 3
// names the first two of them and does not say ONLY those two: the others
// follow from registry rows whose subjects that lease also covers -
// `planning-detail-sites`, whose subject pair is the same `planning.mjs` +
// `planning/` union the `trace-refusal-sentences` row carries, and
// `phase-spelling-callsites`, whose single subject `cadence-core/bin/planning/`
// that lease declares outright. Asserted as a SET, so an extra name and a
// missing one both redden - which is how a newly registered census reaches this
// row rather than sliding past it.
const PHASE5_AT_RISK = [
  'cadence-core/bin/phase-spelling.test.mjs',
  'cadence-core/bin/planning-lease-check.test.mjs',
  'cadence-core/bin/self-verify.test.mjs',
  'cadence-core/bin/trace.test.mjs',
];

const missingFiles = (r) => (r.censuses_at_risk || []).map((c) => c.missing).sort();

test('lease-check --plan-time: phase 5\'s own lease names every census its work would move', () => {
  const { cwd, dir } = planTimeTree(PHASE5_LEASE);

  const r = planTime(cwd, dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.notEqual(r.reason, 'undeclared-files');
  assert.equal(r.reason, 'census-at-risk');
  assert.deepEqual(missingFiles(r), PHASE5_AT_RISK);
  assert.equal(r.declared, PHASE5_LEASE.length);
  assert.equal(r._exit, 1);
  // Each name arrives beside what its count counts and where it is asserted -
  // the half that makes the refusal actionable rather than merely correct.
  for (const c of r.censuses_at_risk) {
    assert.ok(c.id && c.counts && c.asserted_by, JSON.stringify(c));
  }
  assert.match(r.hint, /files:/);
});

test('lease-check --plan-time: the answer needs no repository, and spawns no git', () => {
  // The commit-time arm cannot answer at all outside a repository - it refuses
  // `no-staged-set` - so a census refusal here settles that this arm read none.
  // The stub is the belt to that suspenders: it shadows `git` on the child's
  // PATH and records every argv it is handed, so a call would leave a file
  // behind even if its output changed nothing.
  const { cwd, dir } = planTimeTree(PHASE5_LEASE);
  const stubDir = mkdtempSync(join(tmpdir(), 'cad-plantime-bin-'));
  const argvLog = join(stubDir, 'argv.log');
  writeFileSync(join(stubDir, 'git'),
    `#!/bin/sh\necho "git $*" >> '${argvLog}'\nexit 0\n`, { mode: 0o755 });

  const r = planTime(cwd, dir, { PATH: stubDir });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'census-at-risk');
  assert.notEqual(r.reason, 'no-staged-set');
  assert.equal(existsSync(argvLog), false,
    `the plan-time arm spawned git: ${existsSync(argvLog) ? readFileSync(argvLog, 'utf8') : ''}`);
});

test('lease-check --plan-time: the arm reads declared PATHS, never the plan\'s instructions', () => {
  // Same tree, same plan file, two different bodies: byte-identical stdout is
  // what proves the Action prose reached nothing. `- **Files:**` appears in
  // neither body on purpose - that IS a path declaration to `parsePlanFiles`,
  // and a body carrying one would be testing the union rather than the prose.
  const { cwd, dir, pdir } = planTimeTree(PHASE5_LEASE,
    '### Task 1: split the seam\n\n- **Action:** re-pin every census in the tree'
    + ' and delete the registry row that watches it.\n');
  const first = planTimeRaw(cwd, dir);

  writePlanTimePlan(pdir, PHASE5_LEASE, 'lorem ipsum dolor sit amet\n');
  const second = planTimeRaw(cwd, dir);

  assert.equal(second.stdout, first.stdout);
  assert.equal(second.code, first.code);
  assert.equal(JSON.parse(first.stdout).reason, 'census-at-risk');
});

test('lease-check --plan-time: a lease declaring the holding files is a PASS, not a silence', () => {
  const { cwd, dir } = planTimeTree([...PHASE5_LEASE, ...PHASE5_AT_RISK]);

  const r = planTime(cwd, dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.declared, PHASE5_LEASE.length + PHASE5_AT_RISK.length);
  assert.equal(r.censuses_at_risk, undefined);
  assert.equal(r._exit, 0);
});

test('lease-check --plan-time: a phase with no plan file is still no-plan on this arm', () => {
  // The plan resolution is SHARED with the commit-time arm and stays above the
  // branch: an unreadable lease is never a plan-time pass either.
  const cwd = mkdtempSync(join(tmpdir(), 'cad-plantime-'));
  mkdirSync(join(cwd, '.planning', 'phases', '1'), { recursive: true });

  const r = planTime(cwd, join(cwd, '.planning'));
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-plan');
  assert.equal(r._exit, 1);
});

// --- the replay: every plan this repository has ever written -----------------
//
// D-03 accepts that each registry row's subject expression is hand-written and
// can drift. This is the bound that keeps the drift from turning the gate into
// noise: replayed over every PLAN in this repository's own record, no single
// entry may refuse more than HALF of the plans it could speak to. An entry over
// that line is narrowed again or removed, never tuned, for the reason
// `planning/lease-check.mjs`'s own header gives - a rail that fires wrong gets
// deleted.
//
// The PREDICATE is replayed, not the seam: `censusesAtRisk` is pure and takes
// the declared list, so 40-odd plans cost one process instead of 40. That is
// the whole reason the predicate lives in `lib/` and not inside the handler.
//
// The live `.planning` tree is the corpus, deliberately: `phases/`, every
// `_archive-v*/` and every `tasks/<slug>/`. A fixture corpus would measure a
// corpus someone chose, and the claim is about the plans this project actually
// wrote.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLAN_FILE = /^PLAN(-[1-9][0-9]*)?\.md$/;

/** Every plan file under `dir`, recursively, in a stable order. */
function everyPlanFile(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    if (e.isDirectory()) everyPlanFile(full, out);
    else if (PLAN_FILE.test(e.name)) out.push(full);
  }
  return out;
}

// The same "declares at least one path under cadence-core/bin/" filter the
// CONTEXT measurement used, spelled as containment rather than as a prefix
// test alone so a bare `cadence-core/bin/` directory lease counts itself.
const underBin = (files) => files.some((f) => f === 'cadence-core/bin/'
  || f.startsWith('cadence-core/bin/'));

test('lease-check --plan-time: no registry entry refuses more than half of this repository\'s own plans', () => {
  const plans = everyPlanFile(join(REPO_ROOT, '.planning'))
    .map((f) => parsePlanFiles(readFileSync(f, 'utf8')).files)
    .filter(underBin);
  // Non-vacuous, and by a wide margin: an empty corpus would pass every bound
  // below while measuring nothing. 40 were measured while the CONTEXT was
  // gathered, before this phase's own plans landed.
  assert.ok(plans.length > 30,
    `the replay found only ${plans.length} plans declaring under cadence-core/bin/`);

  const refusals = new Map(CENSUSES.map((e) => [e.id, 0]));
  for (const files of plans) {
    for (const at of censusesAtRisk(files)) refusals.set(at.id, refusals.get(at.id) + 1);
  }
  for (const [id, n] of refusals) {
    assert.ok(n * 2 <= plans.length,
      `registry entry ${id} refuses ${n} of ${plans.length} plans, over half. `
      + 'Narrow its subjects or remove the row - a rail that fires wrong gets '
      + 'deleted, not tuned. Then re-run and update '
      + '.planning/phases/2/census-replay.md with the new counts.');
  }
});
