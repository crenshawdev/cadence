// Unit tests for lib/seam-input.mjs (COR-01, AC4) - the shared argv/file input
// helpers. Pure functions; the only fixtures are real paths for readText.
//
// There is ONE flag reader here now. This file used to carry a load-bearing
// DIVERGENCE arm, because two readers answered differently for the same
// present-but-valueless flag and both answers were contracts. ARG-06 collapsed
// the permissive one into lib/arg-contract.mjs's `fallback` disposition, so
// there is no second answer left to disagree with and the arm went with it -
// the same commit as the collapse, the discipline phase 2 set when it edited
// the header rather than leaving it to go red. What a defaulting flag does when
// it is given with nothing after it is now arg-contract.test.mjs's question,
// asked of the declaration.
//
// The arms below are spelled on `--root`, the flag weight.mjs and
// self-verify.mjs read: `--dir` moved to this reader at every seam in phase 2
// (D-01), so spelling an arm with it no longer teaches the divergence either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flagValue, missingFlagValue, readText } from './lib/seam-input.mjs';

// --- flagValue: the one flag reader ------------------------------------------

test('flagValue: absent flag is undefined so the caller default applies', () => {
  assert.equal(flagValue(['resident'], '--root'), undefined);
});

test('flagValue: a real value comes back', () => {
  assert.equal(flagValue(['resident', '--root', '/srv/tree'], '--root'), '/srv/tree');
});

test('flagValue: missing, empty and flag-shaped values each throw missing-flag-value', () => {
  for (const argv of [['resident', '--root'], ['resident', '--root', ''],
    ['resident', '--root', '--command']]) {
    assert.throws(() => flagValue(argv, '--root'), (e) => {
      // BOTH fields: the callers emit {reason:e.seam, detail:e.detail}, and a
      // thrown object without them surfaces as detail "[object Object]".
      assert.equal(e.seam, 'missing-flag-value');
      assert.equal(e.detail, '--root');
      return true;
    }, JSON.stringify(argv));
  }
});

test('missingFlagValue: one construction, and both fields are on it', () => {
  // lib/arg-contract.mjs's requireFlag raises this same object for a row that
  // refuses on the VALUE axis, so two files throw it and exactly one builds it.
  // An object without both fields surfaces at a caller as "[object Object]".
  assert.deepEqual(missingFlagValue('--root'), { seam: 'missing-flag-value', detail: '--root' });
});

// --- readText: '' on any failure ---------------------------------------------

test('readText: a real file comes back verbatim', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-si-'));
  const file = join(dir, 'PROJECT.md');
  writeFileSync(file, '# Project\n');
  assert.equal(readText(file), '# Project\n');
});

test('readText: a missing path and a DIRECTORY are both "" (never a throw)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-si-'));
  assert.equal(readText(join(dir, 'absent.md')), '');
  assert.equal(readText(dir), '');
});
