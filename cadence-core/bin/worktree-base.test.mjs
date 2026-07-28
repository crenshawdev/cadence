// Zero-dep tests for worktree-base.mjs (the parallel-path preflight). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Every run is hermetic: the
// managed and user layers are relocated onto temp paths so the dev's real
// settings can never decide a test's verdict, and fixtures are plain temp
// dirs (no git repo), so the seam falls back to --dir as the root.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'worktree-base.mjs');
const ABSENT = join(mkdtempSync(join(tmpdir(), 'cad-wb-')), 'absent.json');

/** A project fixture; `files` maps a .claude/<name> to its raw contents. */
function fixture(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-wb-repo-'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, '.claude', name), body);
  }
  return dir;
}

/** `{"worktree":{"baseRef":<v>}}` plus an unrelated key, as a real file has. */
function settings(v) {
  return JSON.stringify({ model: 'sonnet', worktree: { baseRef: v } });
}

/** Run `worktree-base.mjs resolve` with both outer layers relocated. */
function resolveIn(dir, { managed = ABSENT, user = ABSENT } = {}) {
  const env = { ...process.env, CADENCE_MANAGED_SETTINGS: managed, CADENCE_USER_SETTINGS: user };
  try {
    return JSON.parse(execFileSync('node', [SEAM, 'resolve', '--dir', dir],
      { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

/** A standalone settings file at <tmp>/<label>.json. */
function loose(label, v) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-wb-layer-')), `${label}.json`);
  writeFileSync(file, settings(v));
  return file;
}

test('unset everywhere: the fresh default applies and parallel is refused', () => {
  const r = resolveIn(fixture());
  assert.equal(r.ok, true);
  assert.equal(r.baseRef, 'fresh');
  assert.equal(r.source, 'default');
  assert.equal(r.parallelSafe, false);
  assert.match(r.reason, /unset everywhere/);
});

test('user layer head: parallel is safe, source names the file', () => {
  const user = loose('user', 'head');
  const r = resolveIn(fixture(), { user });
  assert.equal(r.baseRef, 'head');
  assert.equal(r.source, user);
  assert.equal(r.parallelSafe, true);
});

test('project settings.json beats the user layer', () => {
  const r = resolveIn(fixture({ 'settings.json': settings('head') }), { user: loose('user', 'fresh') });
  assert.equal(r.baseRef, 'head');
  assert.equal(r.parallelSafe, true);
  assert.match(r.source, /settings\.json$/);
});

test('settings.local.json beats project settings.json', () => {
  const dir = fixture({ 'settings.json': settings('head'), 'settings.local.json': settings('fresh') });
  const r = resolveIn(dir);
  assert.equal(r.baseRef, 'fresh');
  assert.equal(r.parallelSafe, false);
  assert.match(r.source, /settings\.local\.json$/);
});

test('managed policy wins over every lower layer', () => {
  const dir = fixture({ 'settings.local.json': settings('head') });
  const r = resolveIn(dir, { managed: loose('managed', 'fresh'), user: loose('user', 'head') });
  assert.equal(r.baseRef, 'fresh');
  assert.equal(r.parallelSafe, false);
  assert.match(r.source, /managed\.json$/);
});

test('a malformed layer is skipped, not fatal - the cascade below it answers', () => {
  const dir = fixture({ 'settings.local.json': '{ not json at all', 'settings.json': settings('head') });
  const r = resolveIn(dir);
  assert.equal(r.ok, true);
  assert.equal(r.baseRef, 'head');
  assert.match(r.source, /settings\.json$/);
});

test('a layer without the key falls through to the next one', () => {
  const dir = fixture({ 'settings.local.json': JSON.stringify({ model: 'opus' }) });
  const r = resolveIn(dir, { user: loose('user', 'head') });
  assert.equal(r.baseRef, 'head');
  assert.match(r.source, /user\.json$/);
});

test('an unrecognized value refuses parallel and says the setting takes two values', () => {
  const r = resolveIn(fixture({ 'settings.json': settings('main') }));
  assert.equal(r.ok, true);
  assert.equal(r.baseRef, 'main');
  assert.equal(r.parallelSafe, false);
  assert.match(r.reason, /only "fresh" or "head"/);
});

test('a non-string baseRef is ignored like an absent one', () => {
  const dir = fixture({ 'settings.json': JSON.stringify({ worktree: { baseRef: true } }) });
  const r = resolveIn(dir);
  assert.equal(r.baseRef, 'fresh');
  assert.equal(r.source, 'default');
});

test('unknown subcommand: usage, never a fabricated verdict', () => {
  const env = { ...process.env, CADENCE_MANAGED_SETTINGS: ABSENT, CADENCE_USER_SETTINGS: ABSENT };
  let out;
  try {
    out = execFileSync('node', [SEAM, 'nope'], { encoding: 'utf8', env });
  } catch (e) {
    out = e.stdout;
  }
  const r = JSON.parse(out);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
  assert.equal(r.baseRef, undefined);
});
