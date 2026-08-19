// Zero-dep tests for lib/on-path.mjs - the one executable-resolution site
// (RCH-01). Run: node --test cadence-core/bin/on-path.test.mjs.
//
// The module reads `process.env.PATH` at CALL time, so every row here builds a
// real directory of real files and points PATH at it. That is deliberate: the
// two callers resolve real binaries off a real PATH, and a mocked `accessSync`
// would prove the test's own stub rather than the OS's answer - the same
// reasoning issue-check.test.mjs states for injecting stubs on the child's
// PATH instead of branching inside the seam.
//
// PATH is restored after each row rather than left set, because a leaked PATH
// would change what every LATER row in this process resolves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { executableIn, onPath } from './lib/on-path.mjs';

/** A temp directory holding `files` as `{name: mode}`. */
function binDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-onpath-'));
  for (const [name, mode] of Object.entries(files)) {
    writeFileSync(join(dir, name), '#!/bin/sh\nexit 0\n', { mode });
  }
  return dir;
}

/** Run `fn` with PATH set to exactly `value`, restoring it afterwards. */
function withPath(value, fn) {
  const before = process.env.PATH;
  process.env.PATH = value;
  try { return fn(); } finally { process.env.PATH = before; }
}

// --- onPath: the PATH walk --------------------------------------------------

test('onPath: a name made reachable by a stub directory prepended to PATH', () => {
  const dir = binDir({ 'cad-stub-tool': 0o755 });
  withPath(dir + delimiter + (process.env.PATH || ''), () => {
    assert.equal(onPath('cad-stub-tool'), true);
  });
});

test('onPath: a name nothing on PATH provides is false, never a throw', () => {
  const dir = binDir({ 'cad-stub-tool': 0o755 });
  withPath(dir, () => {
    assert.equal(onPath('cad-absent-tool'), false);
  });
});

test('onPath: an EMPTY PATH entry is skipped, not read as the cwd', () => {
  // `:/some/dir:` is how a shell spells "and also the current directory". A
  // walk that joined '' with the name would resolve a file in whatever
  // directory the process happens to sit in - a different answer per caller.
  const dir = binDir({ 'cad-stub-tool': 0o755 });
  withPath(delimiter + dir + delimiter, () => {
    assert.equal(onPath('cad-stub-tool'), true);
    assert.equal(onPath('cad-absent-tool'), false);
  });
});

test('onPath: a PATH entry that does not exist is skipped, not a throw', () => {
  const dir = binDir({ 'cad-stub-tool': 0o755 });
  const gone = join(tmpdir(), 'cad-onpath-does-not-exist');
  withPath(gone + delimiter + dir, () => {
    assert.equal(onPath('cad-stub-tool'), true);
  });
});

test('onPath: a same-named file with no execute bit does not resolve', () => {
  // The whole question is whether the name can be RUN. A readable file of the
  // right name is what a tool config leaves behind, and answering true for it
  // would tell an executor to run something that exits 126.
  const unreadable = binDir({ 'cad-stub-tool': 0o644 });
  withPath(unreadable, () => {
    assert.equal(onPath('cad-stub-tool'), false);
  });
  // And the same name IS found once a directory holding an executable copy is
  // on PATH - so the row above proves the mode and not the harness.
  const runnable = binDir({ 'cad-stub-tool': 0o755 });
  withPath(unreadable + delimiter + runnable, () => {
    assert.equal(onPath('cad-stub-tool'), true);
  });
});

test('onPath: an unset PATH answers false rather than throwing', () => {
  const before = process.env.PATH;
  delete process.env.PATH;
  try {
    assert.equal(onPath('cad-stub-tool'), false);
  } finally { process.env.PATH = before; }
});

// --- executableIn: the one-directory half -----------------------------------

test('executableIn: answers about ONE named directory, ignoring PATH', () => {
  // The `npx`-delegated arm's question: `node_modules/.bin/<tool>` is where npx
  // resolves a tool, and it is not on PATH at all.
  const nm = binDir({ tsc: 0o755 });
  withPath(join(tmpdir(), 'cad-onpath-does-not-exist'), () => {
    assert.equal(executableIn(nm, 'tsc'), true);
    assert.equal(executableIn(nm, 'eslint'), false);
    assert.equal(onPath('tsc'), false);
  });
});

test('executableIn: a non-string or empty side is false, never a throw', () => {
  const dir = binDir({ 'cad-stub-tool': 0o755 });
  for (const bad of [undefined, null, true, 42, '']) {
    assert.equal(executableIn(dir, bad), false, `bin ${String(bad)}`);
    assert.equal(executableIn(bad, 'cad-stub-tool'), false, `dir ${String(bad)}`);
  }
});

// A DIRECTORY named like the tool still resolves here, and that is the
// PRE-EXISTING answer being preserved rather than an oversight: a directory
// carries the execute bit as "searchable", and this module moved
// issue-check.mjs's rule without changing what it answers (phase 3, task 1).
// Nothing in either caller's tree puts a directory at `node_modules/.bin/tsc`
// or at a PATH entry named `gh`, so tightening it would be a behaviour change
// bought for no case that exists.
