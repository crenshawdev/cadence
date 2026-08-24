// Zero-dep tests for `planning.mjs task-record`. Run:
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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, run } from './planning.test.mjs';
import { GIT_FIXTURE_ENV } from './planning-audit.test.mjs';

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

// --- task-record: the artifact a `/cad-task` run leaves (FST-01) -------------
//
// Every row builds its OWN scratch repository and runs the seam with that
// repository as the child's cwd, because `resolveRange` asks git for
// `--show-toplevel` from where it stands - a row that ran from this repository's
// own tree would be asserting about Cadence's history rather than a fixture's.

/**
 * A scratch git repository holding `commits`, each a `{file, text, subject}`,
 * plus a `.planning` directory unless `planning` is false. Returns
 * `{root, dir, shas}` - `shas` in the order the commits were made.
 */
export function taskRepo(commits, { planning = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-task-record-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_FIXTURE_ENV }).trim();
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  const shas = [];
  for (const c of commits) {
    writeFileSync(join(root, c.file), c.text);
    git('add', c.file);
    git('commit', '-q', '-m', c.subject);
    shas.push(git('rev-parse', 'HEAD'));
  }
  const dir = join(root, '.planning');
  if (planning) mkdirSync(dir, { recursive: true });
  return { root, dir, shas };
}

/** planning.mjs, run FROM `root` so the seam's git reads resolve there. */
export function runIn(root, args, dir) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, ...args, '--dir', dir],
      { encoding: 'utf8', cwd: root, env: GIT_FIXTURE_ENV });
  } catch (e) {
    stdout = e.stdout; code = e.status;
  }
  return { ...JSON.parse(stdout), _exit: code };
}

export const TASK_COMMITS = [
  { file: 'alpha.txt', text: 'a\n', subject: 'feat: the first thing' },
  { file: 'beta.txt', text: 'b\n', subject: 'fix: the second | thing' },
];

test('task-record: writes the record, with the range\'s own commits and files', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const r = runIn(root, ['task-record', '--slug', 'bound-plan-size',
    '--base', `${shas[0]}^`, '--head', shas[1], '--text', 'What this task shipped.'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  assert.equal(r.commits, 2);
  assert.equal(r.files, 2);
  assert.equal(r.trace.written, true);

  const file = join(dir, 'tasks', 'bound-plan-size', 'RECORD.md');
  assert.equal(r.record, file);
  const text = readFileSync(file, 'utf8');
  // EXACTLY the range's commits, in range order, at full width - `HEX` refuses
  // a non-hexadecimal cell and `shaMatches` prefix-matches, so the widest
  // spelling is the one that joins to every abbreviation.
  assert.deepEqual([...text.matchAll(/^\| 1 \| ([0-9a-f]{40}) \|/gm)].map((m) => m[1]), shas);
  // And exactly the paths it touched. The `|` in the second subject is escaped
  // rather than splitting the row, which would attach its tail to no commit.
  assert.match(text, /^- \*\*Files:\*\* alpha\.txt, beta\.txt$/m);
  assert.match(text, /fix: the second \\\| thing/);
  assert.match(text, /^- What this task shipped\.$/m);
});

test('task-record: a second identical run leaves the file byte-identical', () => {
  // The record is DERIVED from the range and the text, so a re-run rewrites the
  // same bytes rather than accumulating - no Date and no randomness anywhere in
  // the renderer.
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const args = ['task-record', '--slug', 'again', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'Ran twice.'];
  const first = runIn(root, args, dir);
  const file = join(dir, 'tasks', 'again', 'RECORD.md');
  const before = readFileSync(file, 'utf8');
  const second = runIn(root, args, dir);
  assert.equal(readFileSync(file, 'utf8'), before);
  // And the envelope too: only the appended trace LINE differs between runs.
  assert.deepEqual(second, first);
});

test('task-record: no planning root means nothing is created and written:false says why', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS, { planning: false });
  const r = runIn(root, ['task-record', '--slug', 'no-root', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'Nothing to write into.'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.written, false);
  assert.match(r.reason, /no planning root/);
  // NEITHER the root NOR tasks/: the fast path's guarantee is that it scaffolds
  // nothing where nothing exists.
  assert.equal(existsSync(dir), false);
  assert.equal(existsSync(join(root, 'tasks')), false);
});

test('task-record: a slug that is not one path segment is refused, nothing written', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  for (const slug of ['../escape', 'a/b', '/abs', 'Upper', '']) {
    const r = runIn(root, ['task-record', '--slug', slug, '--base', `${shas[0]}^`,
      '--head', shas[1], '--text', 'x'], dir);
    assert.equal(r.ok, false, `--slug ${JSON.stringify(slug)} was not refused`);
    assert.equal(r.reason, 'bad-args');
    assert.equal(r._exit, 1);
  }
  // Not one file anywhere under the planning root, and no escape above it.
  assert.equal(existsSync(join(dir, 'tasks')), false);
  assert.equal(existsSync(join(root, 'escape')), false);
  assert.equal(existsSync(join(dirname(root), 'escape')), false);
});

test('task-record: a tasks/<slug> that is a symlink OUT is refused, nothing written', () => {
  // The slug is a legal one path segment, so `isTaskSlug` passes it - lexical
  // validation cannot see a link that already exists on disk. A cloned planning
  // tree ships symlinks, `mkdirSync(recursive)` follows one without complaint,
  // and `atomicWrite` lstats its own TEMP path so it refuses a symlinked
  // destination FILE and is silent about a symlinked parent DIRECTORY. Without
  // the writer's containment check this writes RECORD.md into `outside`.
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const outside = mkdtempSync(join(tmpdir(), 'cad-task-outside-'));
  mkdirSync(join(dir, 'tasks'), { recursive: true });
  symlinkSync(outside, join(dir, 'tasks', 'escaped'));
  const r = runIn(root, ['task-record', '--slug', 'escaped', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-record');
  assert.match(r.detail, /resolves outside/);
  assert.equal(r.written, false);
  // The point of the row: nothing landed in the tree the link pointed at.
  assert.equal(existsSync(join(outside, 'RECORD.md')), false);
});

test('task-record: a --base that does not resolve is ok:false with nothing written', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const r = runIn(root, ['task-record', '--slug', 'unresolvable',
    '--base', 'no-such-ref-anywhere', '--head', shas[1], '--text', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-range');
  assert.equal(r.written, false);
  assert.equal(r._exit, 1);
  assert.equal(existsSync(join(dir, 'tasks')), false);
  // The attempt is still ON THE RECORD - `cmdRiskCheckRun`'s rule, so a refusal
  // does not read like a run that never happened.
  const events = readFileSync(join(dir, 'trace.jsonl'), 'utf8').trim().split('\n')
    .map((l) => JSON.parse(l));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'task_record');
  assert.equal(events[0].phase, 0);
  assert.equal(events[0].written, false);
  assert.equal(events[0].base_id, null);
  // No role and no tokens: it opens no bracket and bills no worker.
  assert.equal('role' in events[0], false);
  assert.equal('tokens' in events[0], false);
});

test('task-record: --text and --text-file together are refused, and neither is guessed', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const textFile = join(root, 'shipped.md');
  writeFileSync(textFile, 'From a file.\n');
  const both = runIn(root, ['task-record', '--slug', 'both', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'inline', '--text-file', textFile], dir);
  assert.equal(both.ok, false);
  assert.equal(both.reason, 'bad-args');
  assert.equal(existsSync(join(dir, 'tasks')), false);

  const viaFile = runIn(root, ['task-record', '--slug', 'viafile', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text-file', textFile], dir);
  assert.equal(viaFile.ok, true);
  assert.match(readFileSync(join(dir, 'tasks', 'viafile', 'RECORD.md'), 'utf8'),
    /^- From a file\.$/m);
});
