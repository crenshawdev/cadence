// Unit tests for lib/seam-input.mjs (COR-01, AC4) - the shared argv/file input
// helpers. Pure functions; the only fixtures are real paths for readText.
//
// The load-bearing arm is the DIVERGENCE one: the two flag readers answer
// differently for the same input and both answers are contracts, so a future
// harmonization reddens here rather than silently changing what a defaulting
// flag does when it is given with nothing after it.
//
// The optionalFlag arms below are spelled on `--branch`, not on `--dir`: phase
// 2 D-01 moved `--dir` to flagValue at all six seams, so `--dir` no longer
// reaches this reader anywhere and spelling its arms with it would teach a
// contributor the reversed rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { optionalFlag, flagValue, readText } from './lib/seam-input.mjs';

// --- optionalFlag: never throws ---------------------------------------------

test('optionalFlag: absent flag is undefined', () => {
  assert.equal(optionalFlag(['decide', '--dir', 'x'], '--branch'), undefined);
  assert.equal(optionalFlag([], '--branch'), undefined);
});

test('optionalFlag: the value positionally after the flag', () => {
  assert.equal(optionalFlag(['cleanup', '--branch', 'topic'], '--branch'), 'topic');
  assert.equal(optionalFlag(['--branch', 'topic', '--base', 'main'], '--base'), 'main');
});

test('optionalFlag: present-and-valueless is undefined, NOT a throw', () => {
  // This is the whole reason the defaulting flags keep this contract: each
  // resolves through `|| <its default>` at its seam, so a valueless `--branch`
  // reads as the absent one and the seam's own fallback answers.
  assert.equal(optionalFlag(['cleanup', '--branch'], '--branch'), undefined);
});

test('optionalFlag: an empty or flag-shaped value is returned as-is', () => {
  // Positional, not validating - the caller's `|| fallback` turns '' into its
  // default, and `--base` after `--branch` is the caller's own spelling to
  // answer for. Stated so the divergence from flagValue is visible in both
  // directions.
  assert.equal(optionalFlag(['cleanup', '--branch', ''], '--branch'), '');
  assert.equal(optionalFlag(['cleanup', '--branch', '--base'], '--branch'), '--base');
});

// --- flagValue: refuses what optionalFlag waves through ----------------------

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

test('the two readers DISAGREE on a present-but-valueless flag, deliberately', () => {
  const argv = ['resident', '--root'];
  assert.equal(optionalFlag(argv, '--root'), undefined);
  assert.throws(() => flagValue(argv, '--root'), (e) => e.seam === 'missing-flag-value');
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
