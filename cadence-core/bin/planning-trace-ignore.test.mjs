// Zero-dep tests for `planning.mjs trace ignore`. Run:
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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, run } from './planning.test.mjs';
import {
  READS_CLAIM_FILE, READS_EVICT_TEMP_FILE, READS_FILE, READS_ROTATE_TEMP_FILE,
  ROTATED_READS_FILE, readsPath, rotatedReadsPath,
} from './lib/read-trace.mjs';

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

// --- trace ignore: the run record stays out of git by itself (FLD-02) --------
//
// The other `--root` subcommand, tested beside detect-commands for that reason.
// `--root` is the PROJECT root here (that is where `.gitignore` lives), and the
// write arm is scaffold-time only: `--check` is what /cad-health runs, and it
// may not edit a file it did not create (D-03).

/** A scratch PROJECT root, a git repo unless `git:false`. */
function ignoreRoot({ git = true, gitignore = null, planning = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-ignore-'));
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  }
  if (planning) mkdirSync(join(root, '.planning'), { recursive: true });
  if (gitignore !== null) writeFileSync(join(root, '.gitignore'), gitignore);
  return root;
}

/** `trace ignore` against a project root; parse its one JSON line. */
function traceIgnore(root, extra = []) {
  const args = root === null ? ['trace', 'ignore', ...extra]
    : ['trace', 'ignore', '--root', root, ...extra];
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const gitignoreOf = (root) => readFileSync(join(root, '.gitignore'), 'utf8');

/**
 * The reads record's six rules as the writer states them, DERIVED here the
 * same way the writer derives them: a test that copied the strings would stay
 * green on the day the two spellings diverged, which is the only failure the
 * derivation exists to catch.
 */
const READS_RULES = [
  `.planning/${READS_FILE}`,
  `.planning/${ROTATED_READS_FILE}`,
  `.planning/${READS_CLAIM_FILE}`,
  `.planning/${READS_CLAIM_FILE}.*`,
  `.planning/${READS_ROTATE_TEMP_FILE}.*`,
  `.planning/${READS_EVICT_TEMP_FILE}.*`,
];

/**
 * `check-ignore -v`'s SOURCE for one path - the ignore file whose rule matched,
 * relative to `cwd` - or null when nothing matched. The output field is
 * `<source>:<line>:<pattern>`, so the source is everything before its last two
 * colons, the same slice `gitIgnoreState` takes for the same reason.
 */
function ignoreSource(cwd, path) {
  try {
    const out = execFileSync('git', ['check-ignore', '--no-index', '-v', '--', path],
      { cwd, encoding: 'utf8' });
    const left = out.split('\n')[0].split('\t')[0];
    const last = left.lastIndexOf(':');
    const prev = last > 0 ? left.lastIndexOf(':', last - 1) : -1;
    return prev >= 0 ? left.slice(0, prev) : null;
  } catch { return null; }
}

test('trace ignore: a fresh repo with no .gitignore gets the line written', () => {
  const root = ignoreRoot();
  const r = traceIgnore(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.written, true);
  assert.equal(r.ignored, false);         // the state as FOUND
  assert.equal(r.tracked, false);
  assert.equal(r.line, '.planning/trace.jsonl');
  // BOTH rules on one call: the live record and the generation a rotation at
  // its size bound leaves behind, which `git add .planning` would otherwise
  // sweep into the repository.
  assert.equal(r.rotated_line, '.planning/trace.1.jsonl');
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
  assert.match(gitignoreOf(root), /^\.planning\/trace\.1\.jsonl$/m);
  // ...and the READ record's six, on the same call: the live record, the
  // generation its own rotation leaves behind, the shared claim sidecar a
  // completed rotation leaves inert, and the three private paths a killed one
  // strands - its stamps, its unrenamed fresh record and the generation it
  // evicted. Reported on a field of their own beside `line`.
  assert.deepEqual(r.reads_lines, READS_RULES);
  for (const rule of READS_RULES) {
    assert.ok(gitignoreOf(root).split('\n').includes(rule),
      `${rule} was not written: ${gitignoreOf(root)}`);
  }
});

test('trace ignore: a re-run adds no second line and touches no byte', () => {
  const root = ignoreRoot();
  assert.equal(traceIgnore(root).written, true);
  const after = gitignoreOf(root);
  const again = traceIgnore(root);
  assert.equal(again.written, false);
  assert.equal(again.reason, 'already-ignored');
  assert.equal(again.ignored, true);
  assert.equal(gitignoreOf(root), after);
});

test('trace ignore: a brownfield .gitignore keeps every line it had', () => {
  // No trailing newline, deliberately: the shape that would otherwise glue the
  // new line onto the last existing one.
  const root = ignoreRoot({ gitignore: 'node_modules/\ndist/\n*.log' });
  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  const lines = gitignoreOf(root).split('\n');
  for (const kept of ['node_modules/', 'dist/', '*.log']) {
    assert.ok(lines.includes(kept), `lost ${kept}: ${JSON.stringify(lines)}`);
  }
  assert.ok(lines.includes('.planning/trace.jsonl'), JSON.stringify(lines));
  assert.ok(lines.includes('.planning/trace.1.jsonl'), JSON.stringify(lines));
});

test('trace ignore: a project ignoring .planning/ wholesale is already correct', () => {
  const root = ignoreRoot({ gitignore: '.planning/\n' });
  const r = traceIgnore(root, ['--check']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.ignored, true);
  assert.equal(r.method, 'git');          // only git can see a directory rule
  assert.equal(r.written, false);
  // ...and --check never writes, so the file is exactly what it was.
  assert.equal(gitignoreOf(root), '.planning/\n');
  // The write arm agrees: nothing to add.
  assert.equal(traceIgnore(root).written, false);
  assert.equal(gitignoreOf(root), '.planning/\n');
});

test('trace ignore: a non-git root falls back to the literal scan and still writes', () => {
  const root = ignoreRoot({ git: false });
  const r = traceIgnore(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.method, 'file');
  assert.equal(r.written, true);
  assert.equal(r.tracked, false);
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
  // ...and the literal scan reads its own write back on the next run.
  assert.equal(traceIgnore(root).reason, 'already-ignored');
});

test('trace ignore: a tracked run record is REPORTED, never quietly ignored', () => {
  const root = ignoreRoot();
  writeFileSync(join(root, '.planning', 'trace.jsonl'), '{"phase":1}\n');
  execFileSync('git', ['add', '--', '.planning/trace.jsonl'], { cwd: root });
  const r = traceIgnore(root, ['--check']);
  assert.equal(r.tracked, true, JSON.stringify(r));
  assert.equal(r.ignored, false);
});

test('trace ignore: a TRACKED record whose line is present reports ignored and writes nothing', () => {
  // The regression the `--no-index` flag closes. `check-ignore` answers "would
  // this path be ignored if it were untracked", so a path in the INDEX matched
  // nothing at all: `ignored` came back false with the rule sitting right there
  // in `.gitignore`, and the write arm - which keys off that value - appended the
  // comment and the line again on EVERY run. Two runs left three copies.
  const root = ignoreRoot({
    gitignore: `.planning/trace.jsonl\n.planning/trace.1.jsonl\n${READS_RULES.join('\n')}\n`,
  });
  writeFileSync(join(root, '.planning', 'trace.jsonl'), '{"phase":1}\n');
  execFileSync('git', ['add', '-f', '--', '.planning/trace.jsonl'], { cwd: root });
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, true, JSON.stringify(check));
  assert.equal(check.tracked, true, JSON.stringify(check));
  assert.equal(check.method, 'git');
  assert.match(check.source, /\.gitignore$/);
  // Both facts survive together: the rule is there AND the file is still indexed,
  // which is the state whose remedy is `git rm --cached` and not another line.
  const before = gitignoreOf(root);
  assert.equal(traceIgnore(root).written, false);
  assert.equal(traceIgnore(root).written, false);
  assert.equal(gitignoreOf(root), before);
  assert.equal(gitignoreOf(root).match(/^\.planning\/trace\.jsonl$/gm).length, 1);
});

test('trace ignore: a .git/info/exclude match does NOT satisfy the line', () => {
  // The reason `-v` is used instead of `-q`: neither `.git/info/exclude` nor
  // core.excludesFile is cloned, so a machine-local exclusion would report
  // ignored:true and leave the project with no line of its own - and the
  // collaborator who clones it commits the run record.
  const root = ignoreRoot();
  writeFileSync(join(root, '.git', 'info', 'exclude'), '.planning/trace.jsonl\n');
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, false, JSON.stringify(check));
  assert.equal(check.method, 'git');
  assert.match(check.source, /exclude$/);
  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
});

test('trace ignore: a project covered for the record alone is REPORTED, then upgraded', () => {
  // D-07's state: the live record is ignored and the generation its rotation
  // leaves behind is not, so the first rotation drops an untracked file of up
  // to a mebibyte for `git add .planning` to sweep in. Half-covered is not
  // covered, and /cad-health has to say so rather than stay silent.
  const root = ignoreRoot({ gitignore: '.planning/trace.jsonl\n' });
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, false, JSON.stringify(check));
  assert.equal(check.rotated_line, '.planning/trace.1.jsonl');
  // ...and --check still writes nothing at all.
  assert.equal(gitignoreOf(root), '.planning/trace.jsonl\n');

  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  const lines = gitignoreOf(root).split('\n').filter((l) => l && !l.startsWith('#'));
  // ONLY the missing rules were added: the existing one is not written twice.
  assert.deepEqual(lines, ['.planning/trace.jsonl', '.planning/trace.1.jsonl', ...READS_RULES]);
  // ...and now the re-run is the no-op again.
  assert.equal(traceIgnore(root).reason, 'already-ignored');
});

test('trace ignore: the sibling rule names the file the writer actually creates', async () => {
  // The drift this derivation exists to prevent: a rule spelled by hand here
  // and a rotated path spelled in lib/trace.mjs are two statements of one fact,
  // and the day they disagree the ignore rule covers nothing.
  const { ROTATED_TRACE_FILE, rotatedTracePath } = await import('./lib/trace.mjs');
  const root = ignoreRoot();
  const r = traceIgnore(root);
  assert.equal(r.rotated_line, `.planning/${ROTATED_TRACE_FILE}`);
  assert.equal(rotatedTracePath('.planning'), r.rotated_line);
});

test('trace ignore: a project covered for the trace AND the live reads line gains only the rest', () => {
  // The upgrade path for a repository that hand-wrote the live reads line
  // before this seam existed - which is what THIS repository had. Three rules
  // are missing, the fourth is not written a second time.
  const root = ignoreRoot({
    gitignore: `.planning/trace.jsonl\n.planning/trace.1.jsonl\n${READS_RULES[0]}\n`,
  });
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, false, JSON.stringify(check));
  assert.equal(gitignoreOf(root).includes(READS_RULES[1]), false, '--check wrote something');

  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  const lines = gitignoreOf(root).split('\n').filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(lines,
    ['.planning/trace.jsonl', '.planning/trace.1.jsonl', ...READS_RULES]);
  // The trace half was already whole, so its block is not re-emitted either.
  assert.equal(gitignoreOf(root).match(/^\.planning\/trace\.jsonl$/gm).length, 1);

  // A re-run adds no second line and changes no byte.
  const after = gitignoreOf(root);
  assert.equal(traceIgnore(root).reason, 'already-ignored');
  assert.equal(gitignoreOf(root), after);
});

test('trace ignore: the reads rules name the files the writer actually produces', () => {
  // Same drift guard the sibling rule carries, one record over: a rule spelled
  // by hand in planning/trace.mjs and a path spelled in lib/read-trace.mjs are
  // two statements of one fact, and the day they disagree the rule covers
  // nothing at all.
  const r = traceIgnore(ignoreRoot());
  assert.equal(r.reads_lines[0], readsPath('.planning'));
  assert.equal(r.reads_lines[1], rotatedReadsPath('.planning'));
  assert.equal(r.reads_lines[2], `.planning/${READS_CLAIM_FILE}`);
  // The three paths a killed rotation strands - the stamps beside the sidecar,
  // the fresh record that never reached its rename, and the generation it
  // evicted - each carry a pid and a random suffix, so these three and only
  // these three are patterns.
  assert.equal(r.reads_lines[3], `${r.reads_lines[2]}.*`);
  assert.equal(r.reads_lines[4], `${readsPath('.planning')}.rotate.*`);
  assert.equal(r.reads_lines[5], `${rotatedReadsPath('.planning')}.evict.*`);
  assert.equal(r.reads_lines.length, 6);
});

test('trace ignore: git itself answers for the reads record and its sibling, from the repo\'s own .gitignore', () => {
  const root = ignoreRoot();
  assert.equal(traceIgnore(root).written, true);
  for (const path of ['.planning/reads.jsonl', '.planning/reads.1.jsonl']) {
    assert.equal(ignoreSource(root, path), '.gitignore', path);
  }
});

test('trace ignore: THIS repository already covers the reads sibling (D-11)', () => {
  // The rule this repo carries by hand, asserted through git rather than by
  // reading `.gitignore`: its own record measured 93% full on 2026-08-28, so it
  // WILL rotate, and the sibling is what `git add .planning` would sweep in.
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const path of ['.planning/reads.1.jsonl', '.planning/reads.1.jsonl.claim',
    '.planning/reads.1.jsonl.claim.123.abc']) {
    assert.equal(ignoreSource(repo, path), '.gitignore', path);
  }
});

test('trace ignore: a --root present with nothing usable is refused, never the cwd', () => {
  const root = ignoreRoot();
  // A valueless flag: parseArgs renders it as boolean true.
  const bare = traceIgnore(null, ['--root']);
  assert.equal(bare.ok, false, JSON.stringify(bare));
  assert.equal(bare.reason, 'bad-args');
  assert.match(bare.detail, /--root/);
  const empty = traceIgnore('');
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.reason, 'bad-args');
  // ...and the usable form still works, so the guard is not refusing everything.
  assert.equal(traceIgnore(root).ok, true);
});
