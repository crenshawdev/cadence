// Tests for lib/repo-auto-close.mjs - the both-layer read of `git.auto_close`
// that says the unattended close is authorized (D-02): true only when the
// repository's .planning/config.json AND the user-global config both set it.
// Run: node --test cadence-core/bin/repo-auto-close.test.mjs
//
// ONE test() per row, deliberately, following global-only-keys.test.mjs: a
// table asserted inside a single test() with a sequential loop reports the
// loop's count, not the rows', so a row that never ran still looks green.
//
// What these rows are really pinning is the DIRECTION the read fails in. Every
// arm below that is not an explicit `true` in both layers answers `false`,
// because that is the only safe default for an answer that unlocks a push.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** A repo root; `body` written verbatim to .planning/config.json when given,
 * and the file left absent otherwise. Raw text, not JSON.stringify, so a row
 * can hand the reader bytes that are not JSON at all. */
function repo(body) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-repo-auto-close-'));
  if (body !== undefined) {
    mkdirSync(join(dir, '.planning'));
    writeFileSync(join(dir, '.planning', 'config.json'), body);
  }
  return dir;
}

// ---------------------------------------------------------------------------
// autoCloseLayers - the both-layer read (D-02). GLOBAL_CONFIG is fixed when
// config-merge.mjs loads, so each arm runs the read in a child whose
// CADENCE_GLOBAL_CONFIG is set before that import: the env var relocates the
// user-global layer exactly as it does for every other reader.

const LIB = pathToFileURL(join(import.meta.dirname, 'lib', 'repo-auto-close.mjs')).href;

/** A user-global file holding `body` verbatim; its path. */
function globalText(body) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-repo-auto-close-global-')), 'config.json');
  writeFileSync(file, body);
  return file;
}

/** Run autoCloseLayers(dir) with CADENCE_GLOBAL_CONFIG=globalFile. */
function layers(dir, globalFile) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { autoCloseLayers } from ${JSON.stringify(LIB)};
     process.stdout.write(JSON.stringify(autoCloseLayers(${JSON.stringify(dir)})));`],
  { encoding: 'utf8', env: { ...process.env, CADENCE_GLOBAL_CONFIG: globalFile } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const ON = '{"git":{"auto_close":true}}';

test('autoCloseLayers: both layers true authorizes', () => {
  const g = globalText(ON);
  const a = layers(repo(ON), g);
  assert.deepEqual([a.authorized, a.repo, a.global, a.globalFile], [true, 'set', 'set', g]);
});

test('autoCloseLayers: repo-only does not authorize, and the global half reads unset', () => {
  // The cloned-repository case: the committed config cannot speak for the user.
  const a = layers(repo(ON), globalText('{"git":{}}'));
  assert.deepEqual([a.authorized, a.repo, a.global], [false, 'set', 'unset']);
});

test('autoCloseLayers: global-only does not authorize, and the repo half reads unset', () => {
  // D-08: a home-directory value cannot speak for a repository that stayed silent.
  const a = layers(repo('{"git":{}}'), globalText(ON));
  assert.deepEqual([a.authorized, a.repo, a.global], [false, 'unset', 'set']);
});

test('autoCloseLayers: a torn user-global file withholds, and reads unreadable, not unset', () => {
  // Fails CLOSED: the opt-in the torn file may carry cannot be proven. The
  // third state is what lets the refusal name the file as broken rather than
  // tell the user to set a key that may already be set.
  const a = layers(repo(ON), globalText('{"git":{"auto_close":tru'));
  assert.deepEqual([a.authorized, a.repo, a.global], [false, 'set', 'unreadable']);
});

test('autoCloseLayers: CADENCE_GLOBAL_CONFIG naming the repo file is ONE layer', () => {
  // One file cannot be both halves - and a cloned repository cannot set the
  // environment variable that would make its own file count twice.
  const dir = repo(ON);
  const a = layers(dir, join(dir, '.planning', 'config.json'));
  assert.deepEqual([a.authorized, a.repo, a.global, a.shared], [false, 'set', 'unset', true]);
  // Two separate files are never reported as one.
  assert.equal(layers(repo(ON), globalText(ON)).shared, false);
});

test('autoCloseLayers: a non-object layer reads unreadable and never throws on a bad dir', () => {
  const a = layers(repo('[true]'), globalText(ON));
  assert.deepEqual([a.authorized, a.repo, a.global], [false, 'unreadable', 'set']);
  const b = layers(join(tmpdir(), 'cad-no-such-dir-' + process.pid), globalText(ON));
  assert.deepEqual([b.authorized, b.repo, b.global], [false, 'unset', 'set']);
});
