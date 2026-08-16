// Unit tests for lib/text-flag-file.mjs - the ONE reader behind every
// `--<field>-file` flag on the seam.
//
// The load-bearing arm is the VERBATIM one: the whole reason a path transport
// exists is that a value carrying `$(...)` or a backtick inside a double-quoted
// shell word executes before Node starts. Everything else here is the refusal
// set, and each refusal is asserted to NAME its flag - the seams above this
// module hand the detail straight to their caller, so a refusal that said
// "--file" would send a workflow author looking at the wrong flag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, accessSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTextFlag } from './lib/text-flag-file.mjs';

/** A temp file holding `body`, and its path. */
function fixture(body) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-textflag-')), 'value.txt');
  writeFileSync(file, body);
  return file;
}

/** True when mode 000 still reads - i.e. the suite is running as root. */
function accessibleAsRoot(file) {
  try { accessSync(file, constants.R_OK); return true; } catch { return false; }
}

test('an ABSENT --<field>-file says nothing at all about the inline flag', () => {
  // The contract that keeps every caller's inline handling byte-for-byte: this
  // module answers about the FILE flag only, so an untrimmed, empty or
  // valueless inline value is still the caller's own business.
  for (const opts of [{}, { detail: '  padded  ' }, { detail: true }]) {
    assert.deepEqual(resolveTextFlag(opts, 'detail', 'trace append'),
      { ok: true, value: undefined, detail: '' }, JSON.stringify(opts));
  }
});

test('the file contents reach the caller trimmed and VERBATIM - no expansion', () => {
  // The payload that used to be dangerous inline. Nothing between the file and
  // the caller may touch it: this is the whole point of the transport.
  const payload = 'guard $(touch /tmp/cad-text-flag-should-not-exist) and `id` stay literal';
  const r = resolveTextFlag({ 'detail-file': fixture(`\n${payload}\n\n`) },
    'detail', 'trace append');
  assert.equal(r.ok, true);
  assert.equal(r.value, payload);
});

test('a newline INSIDE the value survives - only the ends are trimmed', () => {
  // A multi-line detail is a legitimate value (a checkpoint's reason can wrap);
  // the flags that cannot hold one refuse it at their own site, never here.
  const r = resolveTextFlag({ 'detail-file': fixture('first\nsecond\n') },
    'detail', 'trace append');
  assert.equal(r.ok, true);
  assert.equal(r.value, 'first\nsecond');
});

test('a VALUELESS --<field>-file is a refusal, never the literal "true"', () => {
  // parseArgs mints boolean `true` for a flag with nothing after it, which is
  // exactly the shape `--detail-file "$FILE"` produces with FILE unset.
  for (const raw of [true, '', '   ']) {
    const r = resolveTextFlag({ 'detail-file': raw }, 'detail', 'trace append');
    assert.equal(r.ok, false, `${JSON.stringify(raw)} was accepted as a path`);
    assert.match(r.detail, /trace append --detail-file needs a path after it/);
  }
});

test('a path that does not exist is a refusal NAMING the read error', () => {
  const r = resolveTextFlag({ 'label-file': join(tmpdir(), 'cad-absent-value.txt') },
    'label', 'milestone-prune');
  assert.equal(r.ok, false);
  assert.match(r.detail, /milestone-prune --label-file could not be read/);
  assert.match(r.detail, /ENOENT/, 'the read error was swallowed');
});

test('an UNREADABLE path is a refusal naming the read error, not an empty value', () => {
  const file = fixture('a real value');
  chmodSync(file, 0o000);
  try {
    // Running as root defeats the mode bits; the row would then assert nothing,
    // so it says so rather than passing vacuously.
    if (accessibleAsRoot(file)) return;
    const r = resolveTextFlag({ 'next-file': file }, 'next', 'cursor set');
    assert.equal(r.ok, false);
    assert.match(r.detail, /cursor set --next-file could not be read/);
    assert.match(r.detail, /EACCES/, 'the read error was swallowed');
  } finally {
    chmodSync(file, 0o600);
  }
});

test('a file that is EMPTY once trimmed is a refusal', () => {
  for (const body of ['', '\n\n', '   \t\n']) {
    const r = resolveTextFlag({ 'detail-file': fixture(body) }, 'detail', 'trace close');
    assert.equal(r.ok, false, `${JSON.stringify(body)} was accepted as a value`);
    assert.match(r.detail, /trace close --detail-file names an empty file/);
  }
});

test('the inline and the file form together is a refusal, never a precedence rule', () => {
  // A precedence rule silently discards one of two values the caller believed
  // was recorded - and which one it discards is invisible in an ok:true
  // envelope. The refusal fires before the path is even read, so a valid file
  // beside an inline value is still refused.
  const r = resolveTextFlag({ detail: 'from the flag', 'detail-file': fixture('from the file') },
    'detail', 'trace append');
  assert.equal(r.ok, false);
  assert.equal(r.detail, 'trace append takes --detail or --detail-file, never both');
});

test('an inline flag present but VALUELESS still counts as both forms given', () => {
  // `--detail --detail-file <path>` parses `detail` as boolean `true`. Reading
  // that as "no inline value, use the file" would answer a call whose two flags
  // contradict each other; presence is the test, not usability.
  const r = resolveTextFlag({ detail: true, 'detail-file': fixture('x') },
    'detail', 'trace append');
  assert.equal(r.ok, false);
  assert.match(r.detail, /never both/);
});
