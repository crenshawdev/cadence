// Tests for lib/task-record.mjs - where a `/cad-task` run's record lives and
// what its bytes are.
// Run: node --test cadence-core/bin/task-record.test.mjs
//
// ONE test() per row (the route-cells.test.mjs convention), and every fixture is
// built in its own mkdtempSync directory so no row can see another's tree.
//
// The render rows assert the record READS BACK through the shipped parsers -
// `parseCommitRows` and `taskDeclaredFiles` - rather than against a golden
// string. A golden string pins the bytes and proves nothing about the join,
// which is the whole reason the record is written in the corpus's own grammar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_SLUG_LENGTH, RECORD_FILE, TASKS_DIR, isTaskSlug, renderTaskRecord, taskRecordsIn,
} from './lib/task-record.mjs';
import { parseCommitRows, taskDeclaredFiles } from './lib/why-record.mjs';

/** A fresh planning root holding a record per slug. */
function planningRoot(records = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-task-record-'));
  for (const [slug, text] of Object.entries(records)) {
    const dir = join(root, TASKS_DIR, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, RECORD_FILE), text);
  }
  return root;
}

const SHA_A = '093408c9d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0';
const SHA_B = '2c2b1eefd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0';

/** A record with the fields every row here varies from. */
const rec = (over = {}) => renderTaskRecord({
  slug: 'bound-plan-size',
  title: 'Bound plan size',
  body: 'Added a plan-size ceiling.\nRouted TOO BIG to smaller phases.',
  commits: [
    { commit: SHA_A, description: 'feat: declare the ceiling' },
    { commit: SHA_B, description: 'feat: route TOO BIG' },
  ],
  files: ['cadence-core/config.schema.json', 'cadence-core/templates/config.json'],
  ...over,
});

// --- isTaskSlug --------------------------------------------------------------

test('a slug is one path segment of lowercase letters, digits and single hyphens', () => {
  assert.equal(isTaskSlug('bound-plan-size'), true);
  assert.equal(isTaskSlug('task1'), true);
});

test('`..` is refused, never resolved', () => {
  // The VAL-01 lesson: `milestone-prune --label` was only TRIMMED before being
  // joined onto a directory path, and escaped the tree.
  assert.equal(isTaskSlug('..'), false);
  assert.equal(isTaskSlug('.'), false);
  assert.equal(isTaskSlug('../escape'), false);
});

test('a separator is refused on both spellings', () => {
  assert.equal(isTaskSlug('a/b'), false);
  assert.equal(isTaskSlug('a\\b'), false);
});

test('an absolute form is refused', () => {
  assert.equal(isTaskSlug('/abs'), false);
  assert.equal(isTaskSlug('/etc/passwd'), false);
});

test('an empty string is refused', () => {
  assert.equal(isTaskSlug(''), false);
});

test('an over-long slug is refused at the bound', () => {
  assert.equal(isTaskSlug('a'.repeat(MAX_SLUG_LENGTH)), true);
  assert.equal(isTaskSlug('a'.repeat(MAX_SLUG_LENGTH + 1)), false);
});

test('a non-string is refused - parseArgs mints `true` for a valueless flag', () => {
  assert.equal(isTaskSlug(true), false);
  assert.equal(isTaskSlug(undefined), false);
  assert.equal(isTaskSlug(7), false);
});

test('a NUL or a newline is refused', () => {
  assert.equal(isTaskSlug('a\0b'), false);
  assert.equal(isTaskSlug('a\nb'), false);
});

// --- taskRecordsIn -----------------------------------------------------------

test('an absent planning root is an empty list, never a throw', () => {
  assert.deepEqual(taskRecordsIn(join(tmpdir(), 'cad-task-record-nope-does-not-exist')), []);
});

test('a planning root with no tasks/ at all is an empty list', () => {
  assert.deepEqual(taskRecordsIn(planningRoot()), []);
});

test('a slug directory holding no RECORD.md contributes nothing', () => {
  const root = planningRoot();
  mkdirSync(join(root, TASKS_DIR, 'planned-only'), { recursive: true });
  writeFileSync(join(root, TASKS_DIR, 'planned-only', 'PLAN.md'), '# Plan\n');
  assert.deepEqual(taskRecordsIn(root), []);
});

test('the records come back sorted by slug', () => {
  const root = planningRoot({ zebra: rec(), alpha: rec(), middle: rec() });
  assert.deepEqual(taskRecordsIn(root).map((r) => r.slug), ['alpha', 'middle', 'zebra']);
  assert.equal(taskRecordsIn(root)[0].path, join(root, TASKS_DIR, 'alpha', RECORD_FILE));
});

test('a slug DIRECTORY that is a symlink out of the planning root is skipped', () => {
  // `readdirSync` FOLLOWS a symlinked directory, so this walk would otherwise
  // land in another tree entirely - `phaseDirsIn`'s case, one level out.
  const outside = mkdtempSync(join(tmpdir(), 'cad-task-record-outside-'));
  mkdirSync(join(outside, 'stolen'), { recursive: true });
  writeFileSync(join(outside, 'stolen', RECORD_FILE), rec());
  const root = planningRoot({ real: rec() });
  symlinkSync(join(outside, 'stolen'), join(root, TASKS_DIR, 'linked'));
  assert.deepEqual(taskRecordsIn(root).map((r) => r.slug), ['real']);
});

test('an in-root slug directory whose RECORD.md is a symlink OUT is skipped', () => {
  // The directory case passing does not imply the file case does, and this is
  // the one the recall tier reads THROUGH: a cloned repository carrying such a
  // link would surface an arbitrary readable file through `planning.mjs recall`.
  const outside = mkdtempSync(join(tmpdir(), 'cad-task-record-secret-'));
  const secret = join(outside, 'id_rsa');
  writeFileSync(secret, 'PRIVATE KEY\n');
  const root = planningRoot({ real: rec() });
  const dir = join(root, TASKS_DIR, 'leaky');
  mkdirSync(dir, { recursive: true });
  symlinkSync(secret, join(dir, RECORD_FILE));
  assert.deepEqual(taskRecordsIn(root).map((r) => r.slug), ['real']);
});

test('a RECORD.md symlink that stays INSIDE the planning root is still a record', () => {
  const root = planningRoot({ real: rec() });
  const dir = join(root, TASKS_DIR, 'aliased');
  mkdirSync(dir, { recursive: true });
  symlinkSync(join(root, TASKS_DIR, 'real', RECORD_FILE), join(dir, RECORD_FILE));
  assert.deepEqual(taskRecordsIn(root).map((r) => r.slug), ['aliased', 'real']);
});

test('a RECORD.md that is a DIRECTORY is not a record', () => {
  const root = planningRoot();
  mkdirSync(join(root, TASKS_DIR, 'odd', RECORD_FILE), { recursive: true });
  assert.deepEqual(taskRecordsIn(root), []);
});

// --- renderTaskRecord --------------------------------------------------------

test('the same inputs render byte-identical text', () => {
  assert.equal(rec(), rec());
});

test('the `## Commits` table reads back through parseCommitRows', () => {
  const rows = parseCommitRows(rec());
  assert.deepEqual(rows.map((r) => r.commit), [SHA_A, SHA_B]);
  assert.deepEqual(rows.map((r) => r.task), ['1', '1']);
  assert.deepEqual(rows.map((r) => r.description),
    ['feat: declare the ceiling', 'feat: route TOO BIG']);
});

test('the `- **Files:**` line reads back through taskDeclaredFiles', () => {
  const tasks = taskDeclaredFiles(rec());
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].ordinal, 1);
  assert.equal(tasks[0].title, 'Bound plan size');
  assert.deepEqual(tasks[0].files,
    ['cadence-core/config.schema.json', 'cadence-core/templates/config.json']);
});

test('a subject carrying a `|` survives as ONE cell', () => {
  // Unescaped, the row splits and the tail attaches to the wrong commit.
  const text = rec({
    commits: [{ commit: SHA_A, description: 'fix: a|b rails, both halves' }],
  });
  const rows = parseCommitRows(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].commit, SHA_A);
  assert.equal(rows[0].description, 'fix: a|b rails, both halves');
});

test('the body becomes one `- ` bullet per non-empty line, under `## What shipped`', () => {
  const text = rec({ body: 'first line\n\n  second line  \n' });
  assert.match(text, /^## What shipped$/m);
  assert.match(text, /^- first line$/m);
  assert.match(text, /^- second line$/m);
});

test("a body line the caller already bulleted does not render `- - `", () => {
  const text = rec({ body: '- already a bullet' });
  assert.match(text, /^- already a bullet$/m);
  assert.doesNotMatch(text, /^- - /m);
});

test('the record opens with `# Task: <slug>` and ends with the Files section', () => {
  const text = rec();
  assert.match(text, /^# Task: bound-plan-size$/m);
  // LAST, so `sectionBound` lets the task body run to end of file.
  assert.ok(text.indexOf('## Files') > text.indexOf('## Commits'));
  assert.ok(text.indexOf('## Commits') > text.indexOf('## What shipped'));
});

test('an empty commit list and an empty file list still render a readable record', () => {
  const text = rec({ commits: [], files: [], body: '' });
  assert.deepEqual(parseCommitRows(text), []);
  assert.deepEqual(taskDeclaredFiles(text).map((t) => t.files), [[]]);
});
