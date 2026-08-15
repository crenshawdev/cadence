// Tests for lib/repo-auto-close.mjs - the repository-layer-only read of
// `git.auto_close`, the value that says the REPOSITORY authorized an unattended
// publish or merge (phase 1, AUT-01).
// Run: node --test cadence-core/bin/repo-auto-close.test.mjs
//
// ONE test() per row, deliberately, following global-only-keys.test.mjs: a
// table asserted inside a single test() with a sequential loop reports the
// loop's count, not the rows', so a row that never ran still looks green.
// Only node: builtins, no subprocess - the lib does one filesystem read.
//
// What these rows are really pinning is the DIRECTION the read fails in. Every
// arm below that is not an explicit repo-layer `true` answers `false`, because
// `false` is "this repository did not opt in" and that is the only safe default
// for an answer that unlocks a mutation of somebody else's project.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoAutoClose } from './lib/repo-auto-close.mjs';

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

test('an explicit repo-layer true is the one shape that authorizes', () => {
  assert.equal(repoAutoClose(repo('{"git":{"auto_close":true}}')), true);
});

test('an explicit repo-layer false does not authorize', () => {
  assert.equal(repoAutoClose(repo('{"git":{"auto_close":false}}')), false);
});

test('a repo config that never mentions the key does not authorize', () => {
  // The shipped default state: the file exists, the repository simply never
  // opted in.
  assert.equal(repoAutoClose(repo('{"git":{"default_branch":"main"}}')), false);
});

test('an absent .planning/config.json does not authorize', () => {
  assert.equal(repoAutoClose(repo()), false);
});

test('truncated JSON does not authorize - the read fails CLOSED', () => {
  // The failure a merge-derived answer would report as a refusal-worthy warning
  // and this one reports as "no opt-in". Same direction, no exception path.
  assert.equal(repoAutoClose(repo('{"git":{"auto_close":tru')), false);
});

test('a user-global true cannot speak for a repository that stayed silent', () => {
  // The whole point of the read (D-08). CADENCE_GLOBAL_CONFIG is what relocates
  // the user-global layer for the merged readers; this reader must not consult
  // it, so pointing it at a file that sets the key true changes nothing.
  const globalDir = mkdtempSync(join(tmpdir(), 'cad-repo-auto-close-global-'));
  const globalFile = join(globalDir, 'config.json');
  writeFileSync(globalFile, '{"git":{"auto_close":true}}');
  const before = process.env.CADENCE_GLOBAL_CONFIG;
  process.env.CADENCE_GLOBAL_CONFIG = globalFile;
  try {
    assert.equal(repoAutoClose(repo('{"git":{}}')), false);
  } finally {
    if (before === undefined) delete process.env.CADENCE_GLOBAL_CONFIG;
    else process.env.CADENCE_GLOBAL_CONFIG = before;
  }
});
