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

// WHY THE FIXTURE CONSTRUCTS ARE ASSEMBLED RATHER THAN WRITTEN OUT. This file
// is scanned by the detector it tests: the census row at the bottom feeds a
// whole-file add of it to `scanDiff`, and a construct spelled plainly in a
// fixture here is a line that detector matches. Nineteen were until v3.5.5,
// evidencing auth, migrations, destructive and untrusted_input on a file that
// only describes them. The RUNTIME bytes are unchanged and have to stay that
// way - a fixture that stopped carrying its construct would stop testing the
// detector, which is the worse failure of the two - so the split is in the
// SOURCE spelling only.
const JWT_CALL = 'jwt.' + 'verify';
/** The auth fixture: a module whose one export checks a token. */
const AUTH_MODULE = `export const verify = (t) => ${JWT_CALL}(t, KEY);\n`;
/** The migrations fixture: one column added to an existing table. */
const MIGRATION_SQL = 'ALTER ' + 'TABLE users ADD ' + 'COLUMN kind text;';
/** The JSON reader under a name the untrusted_input pattern does not read: it
 * matches a CALL, and a binding is not one, so this line carries no match. */
const parseJson = JSON.parse;

/** A path no config layer occupies, so the global layer cannot answer for a fixture. */
const NO_GLOBAL = join(tmpdir(), 'cad-risk-no-global-config.json');

/** A one-file unified diff with the given added lines. */
const diffOf = (path, added) => `diff --git a/${path} b/${path}\n`
  + `index 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n`
  + `@@ -1,2 +1,${1 + added.length} @@\n unchanged context line\n`
  + `${added.map((l) => `+${l}`).join('\n')}\n`;

// --- the pure lib -------------------------------------------------------------

test('a risky range matches a category and names the signal that found it', () => {
  const r = scanDiff(diffOf('src/auth/login.ts',
    [`const claims = ${JWT_CALL}(raw, KEY);`]), ALL);
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
  // A range with content that matched nothing is NOT an empty range: the field
  // rides the scanned return too, so its absence marks a pre-#140 record rather
  // than a fresh `false` (D-03).
  assert.equal(r.empty, false);
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

test('an empty body is a COMPLETED check of an empty range, not an unchecked one', () => {
  // The collapse #140 removed. Reading a zero-byte diff IS a check that ran and
  // matched nothing, so `checked: false` narrows to "there was no body to read
  // at all" - the arm the null and scalar rows below hold. While the two shared
  // one answer, an empty committed range refused `risk-record-missing` at
  // `risk-check status`, which filters on `checked` before its fire predicate,
  // and re-running the detector wrote the same refusal again.
  const r = scanDiff('', ALL);
  assert.equal(r.checked, true);
  assert.equal(r.inconclusive, false);
  assert.equal(r.empty, true);
  assert.deepEqual(r.matches, []);
  assert.deepEqual(r.categories, ALL);

  // Whitespace is not content either: git emits a trailing newline for a range
  // that changed nothing.
  assert.equal(scanDiff('\n', ALL).empty, true);
});

test('a substring is not a path signal: src/authority.rs is not `auth`', () => {
  // The rule cmdLeaseCheck already states for declared paths, held here for
  // detection: whole segments only, or `src/auth` licenses `src/authority.rs`.
  const r = scanDiff(diffOf('src/authority.rs', ['pub fn rank(x: u32) -> u32 { x + 1 }']), ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.checked, true);
});

test('a null body returns a record rather than throwing', () => {
  // `cmdRiskCheckRun`'s own null: `resolveRange` refused, or the `git diff`
  // threw, so nothing was read. Never `empty` - that would report a range
  // nobody looked at as a range that held nothing.
  const r = scanDiff(null, ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.equal(r.empty, false);
  assert.deepEqual(r.matches, []);
});

test('a scalar body returns a record rather than throwing', () => {
  const r = scanDiff(42, ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.equal(r.empty, false);
  assert.deepEqual(r.categories, ALL);
});

test('a partly-binary range that also matched reports BOTH, not one or the other', () => {
  // `inconclusive` is independent of `matches`: collapsing either into the
  // other loses the half the caller has to act on.
  const r = scanDiff(`${diffOf('db/migrations/003_add_column.sql', [MIGRATION_SQL])}`
    + 'diff --git a/logo.png b/logo.png\n'
    + 'Binary files a/logo.png and b/logo.png differ\n', ALL);
  assert.equal(r.inconclusive, true);
  assert.ok(r.matches.some((m) => m.category === 'migrations'));
});

/** The real bytes `git diff` emits for a gitlink, captured from a repository
 * whose `vendor/sdk` entry was written with `update-index --cacheinfo 160000`.
 * The hunk carries commit IDS and not one line of the code they name. */
const GITLINK_BUMP = 'diff --git a/vendor/sdk b/vendor/sdk\n'
  + 'index 1111111..2222222 160000\n'
  + '--- a/vendor/sdk\n+++ b/vendor/sdk\n'
  + '@@ -1 +1 @@\n'
  + '-Subproject commit 1111111111111111111111111111111111111111\n'
  + '+Subproject commit 2222222222222222222222222222222222222222\n';

test('a gitlink bump is inconclusive: git emitted a hunk, the nested code is not in it', () => {
  // The hunk makes the section look READ - `@@` is there - while every line of
  // the submodule's actual change sits in another repository the scan never
  // opened. Reporting `matches: []` with `inconclusive: false` here is a
  // judged-clean verdict over code nothing looked at, which is exactly the
  // collapse criterion 3 forbids.
  const r = scanDiff(GITLINK_BUMP, ALL);
  assert.equal(r.checked, true);
  assert.equal(r.inconclusive, true,
    'a submodule bump read as a judged-clean range');
  assert.deepEqual(r.matches, []);
});

test('a submodule ADD is inconclusive on the same grounds', () => {
  const r = scanDiff('diff --git a/vendor/sdk b/vendor/sdk\n'
    + 'new file mode 160000\n'
    + 'index 0000000..1111111\n'
    + '--- /dev/null\n+++ b/vendor/sdk\n'
    + '@@ -0,0 +1 @@\n'
    + '+Subproject commit 1111111111111111111111111111111111111111\n', ALL);
  assert.equal(r.checked, true);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('a gitlink beside a readable file reports BOTH the match and the unread half', () => {
  const r = scanDiff(GITLINK_BUMP
    + diffOf('db/migrations/004_add_column.sql', [MIGRATION_SQL]), ALL);
  assert.equal(r.inconclusive, true);
  assert.ok(r.matches.some((m) => m.category === 'migrations'), JSON.stringify(r.matches));
});

test('the vocabulary is the CALLER\'s: a category outside it is never reported', () => {
  const r = scanDiff(diffOf('src/auth/login.ts', [`const c = ${JWT_CALL}(raw, KEY);`]),
    ['migrations', 'billing']);
  assert.deepEqual(r.categories, ['migrations', 'billing']);
  assert.deepEqual(r.matches.map((m) => m.category).filter((c) => c === 'auth'), []);
});

test('context lines are not an input - only added and removed lines are read', () => {
  // An SQL table-drop sitting UNCHANGED beside an edit is the code the range did
  // not touch. Matching it would fire the one blocking gate on every neighbour
  // of every edit.
  const body = 'diff --git a/src/report.ts b/src/report.ts\n'
    + 'index 1111111..2222222 100644\n--- a/src/report.ts\n+++ b/src/report.ts\n'
    + '@@ -1,3 +1,3 @@\n const sql = "DROP ' + 'TABLE users";\n-const n = 1;\n+const n = 2;\n';
  const r = scanDiff(body, ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.inconclusive, false);
});

// --- the `risk-check run` seam ------------------------------------------------

/** A scratch repository with its own `.planning/`, so the trace written here is
 * the fixture's and never this project's own record. */
function riskRepo({ answered = true } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-risk-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: repo });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  const dir = join(repo, '.planning');
  mkdirSync(dir, { recursive: true });
  // The one-time surface question, answered at the repo layer for every row
  // that is about DETECTION rather than about the question itself: since the
  // seam refuses `surfaces-unanswered` on an unanswered project, a fixture
  // that skipped this would be asserting the refusal in every row.
  // `answered: false` is the opt-out the two rows below it use.
  if (answered) {
    writeFileSync(join(dir, 'config.json'),
      JSON.stringify({ review: { triggers: { risk_surface: { surfaces: ALL } } } }));
  }
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
      // NO_GLOBAL pins the global layer out: the seam now reads config to
      // decide whether the surface question was answered, so a developer whose
      // own ~/.config/cadence/config.json answers it would otherwise see rows
      // pass here and fail in CI, or the reverse.
      { encoding: 'utf8', cwd: repo, env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL } });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...parseJson(stdout), _exit: code };
}

/** Every parsed line of the fixture's trace file, or [] when it was never written. */
function traceLines(dir) {
  let text;
  try { text = readFileSync(join(dir, 'trace.jsonl'), 'utf8'); } catch { return []; }
  return text.split('\n').filter((l) => l.trim()).map((l) => parseJson(l));
}

/** The `outcome`/`risk_check` lines alone. */
const riskRecords = (dir) => traceLines(dir)
  .filter((e) => e.family === 'outcome' && e.event === 'risk_check');

test('risk-check run: a risky range answers ok:true with matches AND leaves one record', () => {
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
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

test('risk-check run: a SAME-COMMIT range is a completed empty check, not an unchecked one', () => {
  // The deadlock #140 closes, at its narrowest shape: `/cad-execute --rerun`
  // over a phase whose tasks are all already satisfied commits nothing, so the
  // range the gate is handed is `HEAD..HEAD`. It answered `checked: false`,
  // `risk-check status` refused `risk-record-missing`, and re-running the
  // detector wrote the same refusal - no argv could clear it.
  const { repo, dir } = riskRepo();
  commitFile(repo, 'README.md', 'start\n');
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '1', '--base', 'HEAD', '--head', 'HEAD']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.checked, true, JSON.stringify(r));
  assert.equal(r.inconclusive, false);
  assert.equal(r.empty, true);
  assert.deepEqual(r.matches, []);
  assert.equal(r._exit, 0);

  const records = riskRecords(dir);
  assert.equal(records.length, 1, `expected exactly one risk_check line, got ${records.length}`);
  assert.equal(records[0].checked, true);
  assert.equal(records[0].inconclusive, false);
  assert.equal(records[0].empty, true, 'the envelope said empty and the record did not');
  assert.deepEqual(records[0].matches, []);
});

test('risk-check run: a REVERT PAIR is empty too - the ids differ and the net diff does not', () => {
  // Why emptiness is decided from the BODY and never from `base_id ===
  // head_id` (D-01). This range spans two commits and resolves to two different
  // ids; the tree it starts at and the tree it ends at are the same. An id
  // compare would answer `checked: false` here and leave the defect class
  // alive one shape over.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'README.md', 'a line the revert takes back\n');
  const head = commitFile(repo, 'README.md', 'start\n');
  assert.notEqual(base, head, 'the fixture did not produce two distinct commits');

  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '1', '--base', base, '--head', head]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.base_id, base);
  assert.equal(r.head_id, head);
  assert.equal(r.checked, true, JSON.stringify(r));
  assert.equal(r.inconclusive, false);
  assert.equal(r.empty, true);

  const records = riskRecords(dir);
  assert.equal(records.length, 1, `expected exactly one risk_check line, got ${records.length}`);
  assert.equal(records[0].empty, true);
  assert.notEqual(records[0].base_id, records[0].head_id,
    'the record read as empty on identical ids, which is not the case under test');
});

test('risk-check run: a --surfaces token outside the eight is refused, and appends NOTHING', () => {
  // A caller who mistyped the scope of a blocking gate must see a refusal, not
  // a narrowed clean answer - the rule `trace append --tokens` already states.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
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
  // An unresolvable ref reads nothing, so it is the OPPOSITE of empty: the
  // record has to keep saying the check never happened, or the deadlock fix
  // would clear a range git refused.
  assert.equal(r.empty, false, JSON.stringify(r));
  const records = riskRecords(dir);
  assert.equal(records.length, 1, 'a range that could not be read left no record of the attempt');
  assert.equal(records[0].checked, false);
  assert.equal(records[0].inconclusive, true);
  assert.equal(records[0].empty, false);
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

/** One `outcome`/`risk_check` line, as `risk-check run` writes it. `extra`
 * overrides the VERDICT fields, because a record is not the same thing as a
 * check: `run` appends on every path past argument validation, so a
 * `checked:false` line is on disk whenever a git read failed. */
const recordLine = (plan, base, head, extra = {}) => JSON.stringify({
  corr: '1-ae5ca09', phase: '1', ts: '2026-08-15T18:46:00.000Z',
  family: 'outcome', event: 'risk_check', plan, base, head,
  checked: true, categories: ['secrets'], matches: [], inconclusive: false,
  ...extra,
});

/**
 * One `outcome` RECEIPT for the blocking `risk_surface` fire, as
 * references/triage-gate.md and references/review-triggers.md write it: the
 * event NAME is the outcome the fire settled at, and the trigger rides the
 * STRUCTURED field a reader can join on rather than the free-text `detail`
 * (D-12). `extra` overrides the identity fields, which is how the wrong-corr
 * and wrong-trigger rows below are built.
 */
const receiptLine = (event, plan, extra = {}) => JSON.stringify({
  corr: '1-ae5ca09', phase: '1', ts: '2026-08-15T18:47:00.000Z',
  family: 'outcome', event, plan, trigger: 'risk_surface',
  ...extra,
});

/**
 * The four outcome names a blocking fire can settle at, copied here as a
 * LITERAL rather than imported from the seam. The rows below exist to pin this
 * vocabulary; a test that read it out of the implementation would agree with
 * whatever the implementation currently says, including a version that honours
 * `adjudication` alone.
 */
const RECEIPTS = ['adjudication', 'rearm', 'gate_pass', 'override'];

/** `risk-check status` against a fixture; its one JSON line and its exit code.
 * `cwd` matters on the RANGE arm alone: identity is the resolved commit pair,
 * so that arm resolves its refs against the repository it runs in. */
function riskStatus(dir, args, cwd) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'risk-check', 'status', ...args],
      { encoding: 'utf8', ...(cwd ? { cwd } : {}) });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...parseJson(stdout), _exit: code };
}

/** A `.planning` fixture inside a REAL git repo, holding the given trace lines.
 * The range arm of `status` resolves refs to commit ids, so any row naming a
 * range needs commits to resolve against - a fixture with no repo can only
 * exercise the phase-wide arm. */
function repoFixture(lines) {
  const { repo, dir } = riskRepo();
  writeFileSync(join(dir, 'trace.jsonl'), `${lines.join('\n')}\n`);
  return { repo, dir };
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
  assert.deepEqual(r.plans[0].records,
    [{
      base: 'ae5ca09', head: 'HEAD', base_id: null, head_id: null,
      checked: true, inconclusive: false, matches: [], empty: false,
    }]);
});

test('risk-check status: an EMPTY committed range is `recorded`, not `risk-record-missing`', () => {
  // AC2, end to end: the record is written by the SEAM rather than by hand, so
  // reverting the run-side split reddens this row. The deadlock it pins:
  // `/cad-execute --rerun` over a phase whose tasks are all already satisfied
  // commits nothing, the range is `HEAD..HEAD`, and the gate refused
  // `risk-record-missing` on a check that had in fact run - with no argv that
  // could clear it, because re-running the detector wrote the same record.
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  commitFile(repo, 'README.md', 'start\n');
  const run = riskCheck(repo, dir,
    ['run', '--phase', '1', '--plan', '1', '--base', 'HEAD', '--head', 'HEAD']);
  assert.equal(run.ok, true, JSON.stringify(run));
  assert.equal(run.empty, true, JSON.stringify(run));

  const r = riskStatus(dir, ['--phase', '1'], repo);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  assert.equal(r.plans.length, 1, JSON.stringify(r.plans));
  assert.equal(r.plans[0].state, 'recorded', JSON.stringify(r.plans[0]));
  // The row says WHY it is recorded with nothing matched, which is the whole
  // reason the flag is reported rather than only consumed.
  assert.equal(r.plans[0].records[0].empty, true, JSON.stringify(r.plans[0].records));
  assert.equal(r.plans[0].records[0].checked, true);
  assert.equal(r.plans[0].records[0].inconclusive, false);
  // An empty range is not a FIRED range, so no receipt is required for it and
  // none was written: the pass is by not firing, never by inheriting a receipt.
  assert.equal(r.missing, undefined);
});

test('risk-check status: a PRE-FIX empty-range record still refuses - an absent flag is not empty', () => {
  // D-03. The 69 `outcome/risk_check` events already on this repository's trace
  // carry the old shape, and a reader that treated an absent flag as empty
  // would retroactively clear every one of them.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { checked: false, inconclusive: true })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'risk-record-missing');
  assert.equal(r._exit, 1);
  assert.equal(r.plans[0].state, 'unchecked');
  assert.equal(r.plans[0].records[0].empty, false,
    'a record written before the split read as an empty range');
  assert.deepEqual(r.missing, ['1']);
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
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const c = commitFile(repo, 'docs/two.md', 'two\n');
  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, recordLine('1', a, b, { base_id: a, head_id: b })].join('\n')}\n`);

  const stale = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', c], repo);
  assert.equal(stale.ok, false, JSON.stringify(stale));
  assert.equal(stale._exit, 1);
  assert.equal(stale.plans[0].state, 'stale');
  assert.deepEqual(stale.plans[0].wanted, { base: a, head: c, base_id: a, head_id: c });

  const matched = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', b], repo);
  assert.equal(matched.ok, true, JSON.stringify(matched));
  assert.equal(matched._exit, 0);
});

test('risk-check status: a record left under `--head HEAD` does not satisfy a LATER HEAD', () => {
  // Range identity is the resolved COMMIT PAIR, never the ref spelling.
  // workflows/execute.md documents `--head HEAD` for both the run and the
  // status call, so this is the live path: a gate fix or a continuation commit
  // landing between them was never scanned, and a spelling compare would still
  // report `recorded`.
  const { repo, dir } = riskRepo();
  const a = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'docs/one.md', 'one\n');
  const run = riskCheck(repo, dir,
    ['run', '--phase', '1', '--plan', '1', '--base', a, '--head', 'HEAD']);
  assert.equal(run.ok, true, JSON.stringify(run));

  const before = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', 'HEAD'], repo);
  assert.equal(before.ok, true, JSON.stringify(before));

  // The commit the record never saw.
  commitFile(repo, 'src/auth/login.ts', `const c = ${JWT_CALL}(raw, KEY);\n`);
  const after = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', 'HEAD'], repo);
  assert.equal(after.ok, false,
    `a record left under an earlier HEAD satisfied a wider one: ${JSON.stringify(after)}`);
  assert.equal(after._exit, 1);
  assert.equal(after.plans[0].state, 'stale');
});

test('risk-check status: a ref that cannot be resolved is a refusal, never a match', () => {
  const { repo, dir } = riskRepo();
  const a = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'docs/one.md', 'one\n');
  riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '1', '--base', a, '--head', 'HEAD']);
  const r = riskStatus(dir,
    ['--phase', '1', '--plan', '1', '--base', a, '--head', 'no-such-ref'], repo);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unresolved-range', JSON.stringify(r));
  assert.equal(r._exit, 1);
});

test('risk-check run: the record carries the resolved commit ids beside the spellings', () => {
  const { repo, dir } = riskRepo();
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/notes.md', 'text\n');
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--plan', '1', '--base', a, '--head', 'HEAD']);
  assert.equal(r.ok, true, JSON.stringify(r));
  // The caller's spelling stays, for the reader; the id is what identity is.
  assert.equal(r.head, 'HEAD');
  assert.equal(r.base_id, a, JSON.stringify(r));
  assert.equal(r.head_id, b, JSON.stringify(r));
  const rec = riskRecords(dir)[0];
  assert.equal(rec.head, 'HEAD');
  assert.equal(rec.base_id, a);
  assert.equal(rec.head_id, b);
});

test('risk-check status: a record whose git read FAILED is not a check, and does not satisfy', () => {
  // The record `risk-check run` leaves on its git-failure path: `ok:false`,
  // `checked:false`, and the line on disk saying the check was ATTEMPTED. A
  // status that found the ref pair and reported `recorded` would pass
  // completion on a check that never read a diff - the exact state RSK-02
  // exists to refuse.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { checked: false, inconclusive: true })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.plans[0].state, 'unchecked');
  assert.equal(r.plans[0].records[0].checked, false,
    'the verdict fields were dropped off the row, so a reader cannot see why');
  assert.deepEqual(r.missing, ['1']);
});

test('risk-check status: a NAMED range whose only record is unchecked is refused too', () => {
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  writeFileSync(join(dir, 'trace.jsonl'), `${[...FROZEN_PHASE_1,
    recordLine('1', a, b, { base_id: a, head_id: b, checked: false, inconclusive: true })].join('\n')}\n`);
  const r = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', b], repo);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.plans[0].state, 'unchecked',
    'a matching ref pair on an unchecked record read as satisfaction');
});

test('risk-check status: an INCONCLUSIVE record satisfies the RECORD half, with the flag on the row', () => {
  // The deliberate other half, and the opposite call from `checked:false`. A
  // `checked:true, inconclusive:true` record is a COMPLETED check - the seam
  // read the range and honestly reported that part of it cannot be judged - so
  // it satisfies the record half of this gate and rides the row with the flag
  // visible. Refusing it as `unchecked` would make a range holding a binary
  // file or a submodule bump permanently unrecordable.
  // What it does NOT do since GAT-04 is clear the gate on its own: an
  // unjudged range is a FIRED range, so the fire's own receipt is required
  // beside the record and is supplied here. The row below
  // ('an INCONCLUSIVE range still needs the fire receipt') is the same fixture
  // without it.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { inconclusive: true }),
    receiptLine('adjudication', '1')]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  assert.equal(r.plans[0].state, 'recorded');
  assert.equal(r.plans[0].records[0].inconclusive, true,
    'the row hides that the range was never judged');
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
  const { repo, dir } = repoFixture([FROZEN_PHASE_1[0]]);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const r = riskStatus(dir, ['--phase', '1', '--plan', '2', '--base', a, '--head', b], repo);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.deepEqual(r.missing, ['2']);
});

/**
 * FROZEN LITERALS from a PREVIOUS milestone's phase 1, the same way
 * FROZEN_PHASE_1 is frozen. These are the real bytes this repository's record
 * held on 2026-08-14, under the v3.4.x cycle's own `phase_start` anchor
 * (`3a24ad9`): a `cad-executor` bracket for a plan 2 that closed months of
 * commits before the `risk_check` event existed at all, and which no record can
 * ever be written for. `.planning/trace.jsonl` is append-only for the life of
 * the project and phase numbers restart every milestone, so these lines answer
 * to `--phase 1` forever.
 */
const PRIOR_CYCLE_PHASE_1 = [
  '{"corr":"1-3a24ad9","phase":"1","ts":"2026-08-14T18:00:17.706Z","family":"lifecycle","event":"phase_start","sha":"3a24ad9"}',
  '{"corr":"1-3a24ad9","phase":"1","ts":"2026-08-14T18:47:43.071Z","family":"lifecycle","event":"dispatch","plan":"2","role":"cad-executor","read":[".planning/PROJECT.md",".planning/phases/1/CONTEXT.md",".planning/phases/1/PLAN-2.md"]}',
  '{"corr":"1-3a24ad9","phase":"1","ts":"2026-08-14T19:01:45.310Z","family":"lifecycle","event":"return","plan":"2","role":"cad-executor","tokens":164326}',
];

/**
 * The line that CLOSES the prior cycle, frozen from the same record: phase 1's
 * `uat_verdict` `complete` under the v3.4.x anchor. It is a separate const
 * rather than a fourth entry in PRIOR_CYCLE_PHASE_1 because the blanket-pass
 * row below re-stamps that array with `.slice(1)`, and a sign-off carried into
 * THIS run's id would bound the cycle at its own timestamp.
 */
const PRIOR_CYCLE_SIGNOFF =
  '{"corr":"1-3a24ad9","phase":"1","ts":"2026-08-14T20:09:19.374Z","family":"outcome","event":"uat_verdict","detail":"complete"}';

/** A second `/cad-execute` invocation of the SAME cycle: a fresh anchor, taken
 * at whatever HEAD the first invocation's commits left behind, and one
 * completed plan under it. */
const SECOND_INVOCATION = [
  '{"corr":"1-bbbbbbb","phase":"1","ts":"2026-08-15T19:00:00.000Z","family":"lifecycle","event":"phase_start","sha":"bbbbbbb"}',
  '{"corr":"1-bbbbbbb","phase":"1","ts":"2026-08-15T19:02:00.000Z","family":"lifecycle","event":"dispatch","plan":"2","role":"cad-executor","read":[".planning/phases/1/PLAN-2.md"]}',
  '{"corr":"1-bbbbbbb","phase":"1","ts":"2026-08-15T19:10:00.000Z","family":"lifecycle","event":"return","plan":"2","role":"cad-executor","tokens":40000}',
];

test('risk-check status: an EARLIER invocation of the same cycle is still required', () => {
  // The regression the newest-anchor scope introduced. execute.md re-anchors at
  // `git rev-parse --short HEAD` on every invocation, so a phase resumed after
  // a checkpoint or a session death takes a second id once its first commits
  // land. Scoped to that newest id alone, everything the FIRST invocation
  // completed silently stopped being required - the same silence this gate
  // exists to break, arriving as an exemption rather than an absence.
  const dir = traceFixture([
    ...FROZEN_PHASE_1,                              // invocation 1 completed plan 1
    ...SECOND_INVOCATION,                           // invocation 2 completed plan 2
    recordLine('2', 'bbbbbbb', 'HEAD', { corr: '1-bbbbbbb', ts: '2026-08-15T19:11:00.000Z' }),
  ]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.reason, 'risk-record-missing');
  // Plan 1, completed under the SUPERSEDED anchor, and unrecorded. Plan 2 is
  // recorded and is not in the list.
  assert.deepEqual(r.missing, ['1']);
  const late = r.plans.find((/** @type {any} */ p) => p.plan === '2');
  assert.equal(late.state, 'recorded', JSON.stringify(late));
  // Each row names the invocation it belongs to, so a reader can see WHICH run
  // left the range unchecked rather than only that some run did.
  assert.equal(r.plans.find((/** @type {any} */ p) => p.plan === '1').run, '1-ae5ca09');
});

test('risk-check status: a signed-off cycle stops being required, an unsigned one does not', () => {
  // The bound, stated as the pair it is. The ONLY difference between this row
  // and the one above is the phase's own `uat_verdict` `complete` sitting
  // between the two invocations: with it, invocation 1 belongs to a cycle that
  // was already answered for and is not re-litigated; without it, invocation 1
  // is this cycle and stays required.
  const signoff =
    '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:58:40.563Z","family":"outcome","event":"uat_verdict","detail":"complete"}';
  const dir = traceFixture([
    ...FROZEN_PHASE_1, signoff,
    ...SECOND_INVOCATION,
    recordLine('2', 'bbbbbbb', 'HEAD', { corr: '1-bbbbbbb', ts: '2026-08-15T19:11:00.000Z' }),
  ]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  assert.equal(r.plans.length, 1, JSON.stringify(r.plans));
  assert.equal(r.plans[0].plan, '2');
});

test('risk-check status: a PARTIAL verdict is not a bound', () => {
  // A partial UAT session is the MIDDLE of a cycle, not its close. Bounding on
  // one would exempt every range completed before the session that failed -
  // precisely the work a partial verdict says is unfinished.
  const partial =
    '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:58:40.563Z","family":"outcome","event":"uat_verdict","detail":"partial"}';
  const dir = traceFixture([
    ...FROZEN_PHASE_1, partial,
    ...SECOND_INVOCATION,
    recordLine('2', 'bbbbbbb', 'HEAD', { corr: '1-bbbbbbb', ts: '2026-08-15T19:11:00.000Z' }),
  ]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.deepEqual(r.missing, ['1']);
});

test('risk-check status: an UNREADABLE sign-off is not a bound', () => {
  // The fail-OPEN direction, which is the only one that matters on a gate.
  // Comparing raw `ts` strings let a sign-off stamped 'zzzz' sort above every
  // real ISO timestamp, so every completed range in the file fell before the
  // bound and the phase reported clean with no rows at all - the gate answering
  // "nothing to require" because it could not read one line.
  const junk =
    '{"corr":"1-ae5ca09","phase":"1","ts":"zzzz","family":"outcome","event":"uat_verdict","detail":"complete"}';
  const dir = traceFixture([...FROZEN_PHASE_1, junk]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.deepEqual(r.missing, ['1']);
});

test('risk-check status: a return the bound cannot PLACE is still required', () => {
  // A completed range carrying no readable timestamp cannot be shown to belong
  // to a closed cycle, so it stays required. Dropping it instead would let any
  // writer exempt a range by omitting one field.
  const signoff =
    '{"corr":"1-ae5ca09","phase":"1","ts":"2026-08-15T18:58:40.563Z","family":"outcome","event":"uat_verdict","detail":"complete"}';
  // The dispatch half is undated too: a bracket the record cannot place at
  // EITHER end is the case, and renderTrace pairs a return to its dispatch, so
  // a lone return is no bracket at all and would prove nothing.
  const undated = [
    '{"corr":"1-bbbbbbb","phase":"1","family":"lifecycle","event":"dispatch","plan":"2","role":"cad-executor","read":[".planning/phases/1/PLAN-2.md"]}',
    '{"corr":"1-bbbbbbb","phase":"1","family":"lifecycle","event":"return","plan":"2","role":"cad-executor","tokens":40000}',
  ];
  const dir = traceFixture([...FROZEN_PHASE_1, signoff, ...undated]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.deepEqual(r.missing, ['2']);
});

test('risk-check status: a PREVIOUS cycle\'s completed range does not hold this run open', () => {
  // The whole file, as a real project's record actually reads: an old cycle's
  // phase 1 sitting above this run's phase 1. Scanning every bracket the file
  // holds demanded a record for the v3.4.x cycle's plan 2, which nothing can
  // supply, so the gate refused every time on any project with more than one
  // milestone of history - the check that exists to stop "not run" passing as
  // "ran clean" never passing at all.
  const dir = traceFixture([...PRIOR_CYCLE_PHASE_1, PRIOR_CYCLE_SIGNOFF,
    ...FROZEN_PHASE_1, recordLine('1', 'ae5ca09', 'HEAD')]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  // One row, and it is THIS run's plan 1. The prior cycle's plan 2 is not a row
  // at all - not a row that passed, which would be the same forgeable gate
  // wearing a green result.
  assert.equal(r.plans.length, 1, JSON.stringify(r.plans));
  assert.equal(r.plans[0].plan, '1');
  assert.equal(r.plans[0].state, 'recorded');
});

test('risk-check status: scoping to this run is not a blanket pass - the CURRENT corr still refuses', () => {
  // The same two bracket lines, re-stamped under this run's id and nothing
  // else changed, so the correlation id is the only thing between the row
  // above and this refusal. Without this row the scope could be widened to
  // "ignore every bracket" and the suite above would stay green.
  const thisRun = PRIOR_CYCLE_PHASE_1.slice(1).map((l) => l.replaceAll('1-3a24ad9', '1-ae5ca09'));
  const dir = traceFixture([...FROZEN_PHASE_1, ...thisRun, recordLine('1', 'ae5ca09', 'HEAD')]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.reason, 'risk-record-missing');
  assert.deepEqual(r.missing, ['2']);
});

test('risk-check status: a record left under a PREVIOUS cycle does not satisfy this run', () => {
  // The other half of the same scoping, and the reason both scans take it: with
  // the brackets scoped and the records not, a plan-1 record from any earlier
  // cycle would clear this run's plan 1 - an unsatisfiable gate traded for a
  // forgeable one.
  const stale = recordLine('1', 'ae5ca09', 'HEAD').replaceAll('1-ae5ca09', '1-3a24ad9');
  const dir = traceFixture([...PRIOR_CYCLE_PHASE_1, PRIOR_CYCLE_SIGNOFF, stale, ...FROZEN_PHASE_1]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'risk-record-missing');
  assert.deepEqual(r.missing, ['1']);
});

// --- the fire's own receipt (GAT-04) -----------------------------------------
//
// WATCHED FAILING AT d30ed50, this plan's unpatched baseline. Observed there:
// a fixture holding one completed `cad-executor` bracket for plan 1 and one
// `risk_check` record with `checked: true` and `matches: ["secrets",
// "migrations"]`, and no outcome event of any kind, answered
// `{"ok":true,...,"state":"recorded"}` with exit 0. The detector had matched a
// risk surface, nothing said the blocking `risk_surface` fire ever happened,
// and the gate reported success.
//
// The rule these rows pin: proving the range was READ and RECORDED is not
// proving the fire HAPPENED. A coordinator can run the detector, read the
// match, skip the fire and still be cleared - which is the whole of GAT-04.
// So a FIRED range (non-empty `matches`, or `inconclusive: true`) needs a
// second receipt under the same correlation id and plan, naming
// `risk_surface` in the structured `trigger` field.

test('risk-check status: a MATCHED range with no fire receipt is refused', () => {
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.deepEqual(r.missing, ['1']);
  assert.equal(r.plans[0].state, 'unfired');
  // The tokens ride the row, so a reader can see WHY a receipt was demanded
  // rather than only that one was.
  assert.deepEqual(r.plans[0].records[0].matches, ['secrets']);
  // The hint names the FIRE, not `risk-check run`: the record is already there,
  // and sending this caller back to the detector would have it redo the half it
  // did and refuse identically a second time.
  assert.match(r.hint, /risk_surface/);
  assert.doesNotMatch(r.hint, /risk-check run/);
});

// ONE test() per receipt name, generated rather than looped inside a single
// test(): a sequential loop reports the LOOP's count, so a name that never ran
// would still look green - and "an implementation that honours `adjudication`
// alone" is exactly the shape these rows exist to redden.
for (const name of RECEIPTS) {
  test(`risk-check status: an outcome \`${name}\` clears a matched range`, () => {
    // `override` is the one receipt written on the coordinator's own say-so, so
    // it is the one that must carry a reason; the other three are a review's
    // settled outcome and need none.
    const dir = traceFixture([...FROZEN_PHASE_1,
      recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] }),
      receiptLine(name, '1', name === 'override' ? { detail: 'the user cleared it' } : {})]);
    const r = riskStatus(dir, ['--phase', '1']);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r._exit, 0);
    assert.equal(r.plans[0].state, 'recorded');
  });

  test(`risk-check status: an outcome \`${name}\` for ANOTHER trigger clears nothing`, () => {
    // The join is on the trigger, not on the event name: a `diff` fire's
    // adjudication says nothing about whether the blocking `risk_surface` one
    // ever ran, and the two land in the same file minutes apart.
    const dir = traceFixture([...FROZEN_PHASE_1,
      recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] }),
      receiptLine(name, '1', { trigger: 'diff' })]);
    const r = riskStatus(dir, ['--phase', '1']);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r._exit, 1);
    assert.equal(r.plans[0].state, 'unfired');
  });
}

test('risk-check status: a receipt under a PREVIOUS cycle\'s corr clears nothing', () => {
  // The same scoping both other scans take, and for the same reason: a receipt
  // left under an earlier cycle's id would clear this run's matched range, and
  // `.planning/trace.jsonl` is append-only for the life of the project.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] }),
    receiptLine('adjudication', '1', { corr: '1-3a24ad9' })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.plans[0].state, 'unfired');
});

test('risk-check status: a range the detector CLEARED needs no receipt at all', () => {
  // The over-refusal rail. A clean range never obliged anyone to fire the
  // blocking gate, so demanding its receipt would refuse every phase that
  // touched nothing risky - and a gate that cannot be cleared is one that gets
  // bypassed.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: [], inconclusive: false })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  assert.equal(r.plans[0].state, 'recorded');
});

test('risk-check status: an INCONCLUSIVE range still needs the fire receipt', () => {
  // workflows/execute.md fires `risk_surface` on `inconclusive: true` exactly
  // as it does on a match, so the receipt is owed on both - or a range the seam
  // could not judge clears itself by being unjudgeable.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { inconclusive: true })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.plans[0].state, 'unfired');
});

test('risk-check status: a checked:false record reports `unchecked`, never the new state', () => {
  // The new rule sits ON TOP of the four states, never in place of one. A
  // record that never read its range is still not a check, and reporting it as
  // a missing FIRE would send the caller to fire a gate on a range nothing has
  // read.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { checked: false, inconclusive: true })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r._exit, 1);
  assert.equal(r.plans[0].state, 'unchecked');
  assert.equal(r.reason, 'risk-record-missing');
  assert.match(r.hint, /risk-check run/);
});

test('risk-check status: a NAMED range that matched is refused until its fire is recorded', () => {
  // The named-range arm, which is the one workflows/execute.md and
  // references/execute-parallel.md actually call. Identity is the resolved
  // commit pair for the record and `rowKey(corr, plan)` for the receipt, so
  // both halves have to be there for THIS range.
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const matched = recordLine('1', a, b, { base_id: a, head_id: b, matches: ['secrets'] });
  writeFileSync(join(dir, 'trace.jsonl'), `${[...FROZEN_PHASE_1, matched].join('\n')}\n`);
  const before = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', b], repo);
  assert.equal(before.ok, false, JSON.stringify(before));
  assert.equal(before.plans[0].state, 'unfired');

  // A receipt that does not name the range settles nothing: the record carries a
  // resolved `head_id`, so there IS a range identity to bind to.
  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, matched, receiptLine('gate_pass', '1')].join('\n')}\n`);
  const unbound = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', b], repo);
  assert.equal(unbound.ok, false, JSON.stringify(unbound));
  assert.equal(unbound.plans[0].state, 'unfired');

  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, matched, receiptLine('gate_pass', '1', { sha: b, base: a })].join('\n')}\n`);
  const after = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', b], repo);
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(after._exit, 0);
  assert.equal(after.plans[0].state, 'recorded');
});

test('risk-check status: an explicit user OVERRIDE written through the seam clears the range', () => {
  // AC5 end to end, through the CLI the prose actually runs rather than a
  // hand-written fixture line: the reason is the user's own words, so it rides
  // `--detail-file` under the v3.5.2 transport rule (D-13), and the trigger
  // rides the structured `--trigger` flag. A deliberately cleared range is
  // clear - that is what keeps this gate from being an unclearable one.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets', 'migrations'] })]);
  const refused = riskStatus(dir, ['--phase', '1']);
  assert.equal(refused.ok, false, JSON.stringify(refused));

  const reasonFile = join(dir, 'override-reason.txt');
  writeFileSync(reasonFile, 'the secrets hit is a fixture key in a test file; accepted\n');
  const appended = parseJson(execFileSync('node', [PLANNING, '--dir', dir,
    'trace', 'append', '--phase', '1', '--family', 'outcome', '--event', 'override',
    '--plan', '1', '--trigger', 'risk_surface', '--detail-file', reasonFile],
  { encoding: 'utf8' }));
  assert.equal(appended.ok, true, JSON.stringify(appended));
  assert.equal(appended.written, true, JSON.stringify(appended));

  const cleared = riskStatus(dir, ['--phase', '1']);
  assert.equal(cleared.ok, true, JSON.stringify(cleared));
  assert.equal(cleared._exit, 0);
  assert.equal(cleared.plans[0].state, 'recorded');
  // The user's reason is ON the receipt, so the record says why the range was
  // cleared and not only that it was.
  const receipt = traceLines(dir).find((e) => e.event === 'override');
  assert.equal(receipt.trigger, 'risk_surface');
  assert.match(receipt.detail, /fixture key/);
});

// --- the three the blocking risk_surface gate found on plan 2's own range ----

test('risk-check status: an earlier fire\'s receipt does not clear a LATER matched range', () => {
  // The blocker, and it is GAT-04's own defect one level up: keyed on the run
  // and the plan alone, one fire cleared every later matched range for that
  // plan. Run the detector, fire, fix something, re-run on the widened range,
  // skip the second fire - and status still said ok:true.
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const c = commitFile(repo, 'docs/two.md', 'two\n');
  const first = recordLine('1', a, b, { base_id: a, head_id: b, matches: ['secrets'] });
  const widened = recordLine('1', a, c, { base_id: a, head_id: c, matches: ['secrets'] });
  const fired = receiptLine('gate_pass', '1', { sha: b, base: a });

  // The first range is settled by its own receipt.
  writeFileSync(join(dir, 'trace.jsonl'), `${[...FROZEN_PHASE_1, first, fired].join('\n')}\n`);
  const one = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', b], repo);
  assert.equal(one.ok, true, JSON.stringify(one));

  // The widened one is NOT, on the strength of that same receipt.
  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, first, fired, widened].join('\n')}\n`);
  const two = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', c], repo);
  assert.equal(two.ok, false, JSON.stringify(two));
  assert.equal(two.plans[0].state, 'unfired');

  // ...until its own fire is recorded against it.
  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, first, fired, widened, receiptLine('gate_pass', '1', { sha: c, base: a })].join('\n')}\n`);
  const three = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', c], repo);
  assert.equal(three.ok, true, JSON.stringify(three));
});

test('risk-check status: a non-empty matches nothing can name still reads as FIRED', () => {
  // Filtering the array to the strings it could name turned a matched range
  // into a clean one. Widening is the only safe direction on a gate that is
  // blocking at every stakes level.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: [null] })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.plans[0].state, 'unfired');
  // And the reported record still shows only what the trace held.
  assert.deepEqual(r.plans[0].records[0].matches, []);
  assert.ok(!('matched_unnamed' in r.plans[0].records[0]), 'the internal flag stays internal');
});

test('risk-check status: a reasonless override is not a receipt', () => {
  // The one receipt a coordinator writes on its own say-so. With no reason it
  // is indistinguishable from a manufactured clear for a fire nobody made.
  const bare = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] }),
    receiptLine('override', '1')]);
  const r = riskStatus(bare, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.plans[0].state, 'unfired');

  const blank = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] }),
    receiptLine('override', '1', { detail: '   ' })]);
  assert.equal(riskStatus(blank, ['--phase', '1']).ok, false, 'whitespace is not a reason');
});

test('risk-check status: the PHASE-WIDE arm needs a receipt per fired range too', () => {
  // The blocker's second half. The named arm bound the receipt to its range;
  // the unscoped arm still cleared the plan on any one satisfying record, so a
  // later matched range rode in on an earlier fire's receipt.
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const c = commitFile(repo, 'docs/two.md', 'two\n');
  const first = recordLine('1', a, b, { base_id: a, head_id: b, matches: ['secrets'] });
  const widened = recordLine('1', a, c, { base_id: a, head_id: c, matches: ['secrets'] });
  const fired = receiptLine('gate_pass', '1', { sha: b, base: a });

  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, first, fired, widened].join('\n')}\n`);
  const r = riskStatus(dir, ['--phase', '1'], repo);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.plans[0].state, 'unfired');

  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, first, fired, widened,
      receiptLine('gate_pass', '1', { sha: c, base: a })].join('\n')}\n`);
  assert.equal(riskStatus(dir, ['--phase', '1'], repo).ok, true);
});

test('risk-check status: a receipt for another BASE over the same head settles nothing', () => {
  // Two records can share a head and differ at the base; they are different
  // diffs over different surfaces, so one's fire says nothing about the other.
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const c = commitFile(repo, 'docs/two.md', 'two\n');
  const wide = recordLine('1', a, c, { base_id: a, head_id: c, matches: ['secrets'] });
  // The fire judged the NARROW range b..c only.
  const narrowFire = receiptLine('gate_pass', '1', { sha: c, base: b });
  writeFileSync(join(dir, 'trace.jsonl'), `${[...FROZEN_PHASE_1, wide, narrowFire].join('\n')}\n`);
  const r = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', c], repo);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.plans[0].state, 'unfired');
});

test('risk-check status: a receipt with no --base settles nothing when the record has ids', () => {
  // "Matched if supplied" reopened the widened-range bypass under another name:
  // a fire over B..C would settle A..C on the head alone.
  const { repo, dir } = repoFixture(FROZEN_PHASE_1);
  const a = commitFile(repo, 'README.md', 'start\n');
  const b = commitFile(repo, 'docs/one.md', 'one\n');
  const c = commitFile(repo, 'docs/two.md', 'two\n');
  assert.ok(b);
  const wide = recordLine('1', a, c, { base_id: a, head_id: c, matches: ['secrets'] });
  writeFileSync(join(dir, 'trace.jsonl'),
    `${[...FROZEN_PHASE_1, wide, receiptLine('gate_pass', '1', { sha: c })].join('\n')}\n`);
  const r = riskStatus(dir, ['--phase', '1', '--plan', '1', '--base', a, '--head', c], repo);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.plans[0].state, 'unfired');
});

test('risk-check status: a receipt written with no --plan joins nothing', () => {
  // The documented adjudication command in review-triggers.md omitted `--plan`,
  // so a per-plan fire's receipt keyed to no plan and the range stayed unfired.
  // The defect was in the PROSE and the fix is there; this row pins the
  // behaviour that fix relies on, so a later reader cannot decide a plan-less
  // receipt should join loosely and quietly reopen it.
  const dir = traceFixture([...FROZEN_PHASE_1,
    recordLine('1', 'ae5ca09', 'HEAD', { matches: ['secrets'] }),
    JSON.stringify({
      corr: '1-ae5ca09', phase: '1', ts: '2026-08-15T18:47:00.000Z',
      family: 'outcome', event: 'adjudication', trigger: 'risk_surface',
    })]);
  const r = riskStatus(dir, ['--phase', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.plans[0].state, 'unfired');
});

test('risk-check run: an UNANSWERED project is refused rather than detected on a defaulted scope', () => {
  // The teeth on the one-time surface question. references/review-triggers.md
  // says a fire whose resolve reports `surfaces_answered: false` "does not
  // proceed to detection until the project has answered" - and nothing enforced
  // it: route.mjs emitted the flag, every consumer read the surfaces array
  // beside it, and an unanswered project was byte-identical to an answered one
  // at every point after the resolve. Measured on a sibling project 2026-08-19:
  // seven blocking risk_surface fires across three phases, the question never
  // put to the user.
  const { repo, dir } = riskRepo({ answered: false });
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'surfaces-unanswered');
  assert.equal(r._exit, 1);
  assert.match(r.detail, /detect-surfaces/, 'the refusal does not name what settles it');
  assert.deepEqual(traceLines(dir), [],
    'a refused call recorded a detection that never happened');
});

test('risk-check run: an unanswered project with --surfaces named is NOT refused', () => {
  // The refusal is precisely for the caller that let the default stand. A
  // caller that named the scope has already resolved it, and refusing there
  // would break every fire site that passes the resolved set through.
  const { repo, dir } = riskRepo({ answered: false });
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
  const r = riskCheck(repo, dir,
    ['run', '--phase', '1', '--base', base, '--head', 'HEAD', '--surfaces', 'auth,secrets']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.categories, ['auth', 'secrets']);
  assert.equal(riskRecords(dir).length, 1);
});

test('risk-check run: a half-answered list fails SAFE - refused, not narrowed to its valid subset', () => {
  // `["auth", "secret"]` is a typo for `secrets`, not a decision to stop
  // reviewing secret handling. The shared predicate in lib/surface-scan.mjs
  // reads that as unanswered, which is what keeps a mistyped entry from
  // suppressing the question forever while shrinking the only blocking gate.
  const { repo, dir } = riskRepo({ answered: false });
  writeFileSync(join(dir, 'config.json'),
    JSON.stringify({ review: { triggers: { risk_surface: { surfaces: ['auth', 'secret'] } } } }));
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'surfaces-unanswered');
});

test('risk-check run: the ANSWERED set scopes detection, rather than being resolved and dropped', () => {
  // route.mjs:172 states the key IS "the categories the one blocking trigger is
  // scoped to". Before this, `risk-check run` defaulted to all eight whatever
  // the project had answered, so the answer reached the resolve and died there.
  const { repo, dir } = riskRepo({ answered: false });
  writeFileSync(join(dir, 'config.json'),
    JSON.stringify({ review: { triggers: { risk_surface: { surfaces: ['secrets'] } } } }));
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
  const r = riskCheck(repo, dir, ['run', '--phase', '1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.categories, ['secrets'],
    'detection ran on a scope the project did not choose');
  assert.deepEqual(r.matches, [],
    'an auth-only diff matched under a secrets-only scope');
});

test('risk-check run: a TORN config layer is refused even when --surfaces was named', () => {
  // The torn-layer rule is fail-closed or it is not a rule. Placed inside the
  // no-flag arm it would have been a guard an explicit flag stepped around,
  // which the blocking risk_surface gate cannot afford: a syntax error in a
  // config layer must not be readable past on the way to scoping that gate.
  const { repo, dir } = riskRepo({ answered: false });
  writeFileSync(join(dir, 'config.json'), '{"review": {"triggers":');
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth/login.ts', AUTH_MODULE);
  for (const args of [[], ['--surfaces', 'auth']]) {
    const r = riskCheck(repo, dir,
      ['run', '--phase', '1', '--base', base, '--head', 'HEAD', ...args]);
    assert.equal(r.ok, false, `${JSON.stringify(args)}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'surfaces-unanswered', JSON.stringify(args));
  }
  assert.deepEqual(traceLines(dir), [], 'a torn layer recorded a detection anyway');
});

test('risk-check run: the answer is judged against route-table.json\'s vocabulary, not a local list', () => {
  // The divergence the shared predicate exists to prevent, at its one remaining
  // seam: route.mjs judges the configured list against route-table.json's
  // `risk_surface_categories`, so a token outside THAT list is unanswered to
  // the resolve. Reading the module's own CATEGORIES here instead would let
  // this seam accept the same value and narrow a blocking gate to a scope the
  // routing authority rejected.
  const table = parseJson(readFileSync(join(HERE, '..', 'route-table.json'), 'utf8'));
  assert.deepEqual(table.risk_surface_categories, ALL,
    'route-table.json and lib/surface-scan.mjs disagree on the eight categories');
});

// --- the census: neither file matches the detector ----------------------------

/**
 * WATCHED FAILING at 0e7844b, the commit this phase forked from. A whole-file
 * add of `lib/risk-diff.mjs` evidenced SIX categories there - auth, migrations,
 * billing, concurrency, destructive and untrusted_input - and a whole-file add
 * of this file evidenced FOUR - auth, migrations, destructive and
 * untrusted_input. Every one came from a pattern's own source text or from a
 * fixture that has to carry the construct it tests, never from anything either
 * file DOES. The gate fed by that answer is `blocking` at every stakes level,
 * so the cost was a phase editing the detector spending its one re-arm on a
 * self-match, on a range where nothing risky happened.
 *
 * This row is the standing guard, and is load-bearing on its own: the fix is a
 * spelling discipline in two files, and a discipline nothing tests is undone by
 * the next edit under a green suite (phase 1's D-07). It asserts the CATEGORY
 * SET and never a line number, so an unrelated edit to either file cannot
 * redden it, and it reads both files with no try/catch - a file this cannot
 * read is a failed guard, not a skipped one.
 *
 * One test() rather than four, against this file's own one-row-per-test rule,
 * because the hazard that rule names is a loop whose count hides a row that
 * never ran: `ran` is asserted at the end, so a skipped pair fails here.
 */
const wholeFileAdd = (rel, body) => {
  const lines = body.split('\n');
  return `diff --git a/${rel} b/${rel}\nnew file mode 100644\n`
    + `index 0000000..1111111\n--- /dev/null\n+++ b/${rel}\n`
    + `@@ -0,0 +1,${lines.length} @@\n`
    + `${lines.map((l) => `+${l}`).join('\n')}\n`;
};

/** The answered surfaces this repository's gate fires under (`.planning`'s
 * config layer), then all eight. The eight-category pass dominates the three -
 * `scanDiff` only ever filters by the vocabulary it is handed - so a later
 * change to the answer cannot make this row wrong; the three are here because
 * they are what actually fires on this repository. */
const CENSUS_SCOPES = [['secrets', 'destructive', 'untrusted_input'], ALL];

test('the census: neither this file nor the detector matches the detector', () => {
  let ran = 0;
  for (const rel of ['lib/risk-diff.mjs', 'risk-diff.test.mjs']) {
    const body = readFileSync(join(HERE, rel), 'utf8');
    for (const scope of CENSUS_SCOPES) {
      const r = scanDiff(wholeFileAdd(`cadence-core/bin/${rel}`, body), scope);
      assert.equal(r.checked, true, `${rel} was not read as a diff at all`);
      assert.deepEqual(r.matches, [],
        `${rel} matched itself under ${scope.length} categories: ${JSON.stringify(r.matches)}`);
      ran++;
    }
  }
  assert.equal(ran, 4, 'the census skipped a file or a scope');
});
