// Zero-dep tests for lib/refusal-hints.mjs - the refusal-hint rule as a pure
// function. Run:
//   node --test cadence-core/bin/refusal-hints.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// self-verify.test.mjs owns the CLI wiring and the live-tree assertion. This
// file owns the RULE: which calls are refusals, what counts as carrying a hint,
// which lines a comment-stripped scan reports, and - the load-bearing one -
// that the exclusion register is READ as a parameter rather than compiled in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { refusalHintIssues, refusalSites, REGISTER, CODES } from './lib/refusal-hints.mjs';

/**
 * A fixture root whose `cadence-core/bin` holds the given `{relative-path:
 * source}` files. Paths are `/`-spelled and may name a `lib/` child.
 * @param {Record<string, string>} files
 * @returns {string}
 */
function binRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'cad-refusal-hints-'));
  const binDir = join(root, 'cadence-core', 'bin');
  mkdirSync(binDir, { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const dst = join(binDir, ...rel.split('/'));
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, text);
  }
  return root;
}

/** The details this rule filed against one fixture file, in order. */
const detailsFor = (root, rel) =>
  refusalHintIssues(root)
    .filter((i) => i.file.split(/[\\/]/).join('/') === `cadence-core/bin/${rel}`)
    .map((i) => i.detail);

const HEAD = "// @ts-check\n// seam.mjs - a fixture seam.\n'use strict';\n";

// --- the two spellings a refusal is written in --------------------------------

test('a two-argument fail() is reported and a three-argument one is not', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}if (!a) fail('no-input', 'nothing to read');\n`
      + "if (!b) fail('no-target', 'nothing to write', 'name a target with --to <path>');\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 4: no-input']);
});

test('an emit({ok:false, reason}) object literal is reported and a hinted one is not', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}emit({ ok: false, reason: 'no-input', detail: 'nothing to read' });\n`
      + "emit({ ok: false, reason: 'no-target', detail: 'x', hint: 'name a target' });\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 4: no-input']);
});

test('the conditional-spread hint spelling counts as hinted', () => {
  // `planning.mjs`'s own widened wrapper writes it this way: the object carries
  // no top-level `hint` property, so a property-name test alone would report
  // the one wrapper in the tree that already does the right thing.
  const root = binRoot({
    'seam.mjs': `${HEAD}const fail = (reason, detail, hint) =>\n`
      + '  out({ ok: false, reason, detail, ...(hint ? { hint } : {}) });\n',
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), []);
});

test('an emit({ok:true, ...}) is never reported', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}emit({ ok: true, reason: 'not-a-refusal', detail: 'a report' });\n`
      + 'emit({ ok: problems.length === 0, checked: "x", problems });\n',
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), []);
});

// --- what the register excludes ----------------------------------------------

test('a `usage` and an `internal` refusal are not reported', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}if (!sub) fail('usage', 'subcommand: resolve [--dir <path>]');\n`
      + "catchArm(() => emit({ ok: false, reason: 'internal', detail: e.message }));\n"
      + "if (!c) fail('no-input', 'nothing to read');\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 6: no-input']);
});

test('a file the register excludes by name contributes nothing, hintless refusal and all', () => {
  const src = `${HEAD}fail('no-input', 'nothing to read');\n`;
  const excluded = REGISTER.files[0].file;
  assert.equal(typeof excluded, 'string');
  const root = binRoot({ [excluded]: src, 'seam.mjs': src });
  assert.deepEqual(detailsFor(root, excluded), []);
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 4: no-input']);
});

test('every register row carries a one-line reason', () => {
  // AC6's other half: the register is the ONLY exclusion mechanism, so a row
  // arriving without its reason is an undocumented hole in the check.
  for (const row of REGISTER.tokens) {
    assert.equal(typeof row.token, 'string');
    assert.ok(row.reason && row.reason.length > 20, JSON.stringify(row));
  }
  for (const row of REGISTER.files) {
    assert.equal(typeof row.file, 'string');
    assert.ok(row.reason && row.reason.length > 20, JSON.stringify(row));
  }
});

// --- AC6: the register is READ, not compiled in -------------------------------

test('AC6: a substitute register excluding one more token shrinks the set by exactly that token\'s sites', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}fail('no-input', 'nothing to read');\n`
      + "fail('write-failed', 'could not write');\n"
      + "fail('write-failed', 'could not write either');\n",
  });
  const shipped = refusalHintIssues(root);
  assert.deepEqual(shipped.map((i) => i.detail),
    ['line 4: no-input', 'line 5: write-failed', 'line 6: write-failed']);

  // `write-failed` is a token the SHIPPED register does not exclude.
  assert.ok(!REGISTER.tokens.some((t) => t.token === 'write-failed'));
  const substitute = {
    tokens: [...REGISTER.tokens, { token: 'write-failed', reason: 'the substitute register this test injects' }],
    files: REGISTER.files,
  };
  const narrowed = refusalHintIssues(root, substitute);
  assert.deepEqual(narrowed.map((i) => i.detail), ['line 4: no-input']);
  assert.equal(shipped.length - narrowed.length, 2);
});

test('AC6: a substitute register excluding one more FILE drops that file alone', () => {
  const src = `${HEAD}fail('no-input', 'nothing to read');\n`;
  const root = binRoot({ 'seam.mjs': src, 'lib/other.mjs': src });
  const substitute = {
    tokens: REGISTER.tokens,
    files: [...REGISTER.files, { file: 'lib/other.mjs', reason: 'the substitute register this test injects' }],
  };
  assert.deepEqual(refusalHintIssues(root, substitute).map((i) => i.file.split(/[\\/]/).join('/')),
    ['cadence-core/bin/seam.mjs']);
});

// --- D-08: comments are stripped, and the line numbers survive it -------------

test('D-08: a refusal inside a // comment or a /** */ block is not reported', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}// A refusal in prose: fail('no-input', 'nothing to read');\n`
      + '/**\n'
      + " * The design record: emit({ ok: false, reason: 'no-target', detail: 'x' });\n"
      + ' */\n'
      + "fail('the-only-real-one', 'a refusal a user can reach');\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 8: the-only-real-one']);
});

test('D-08: the reported line is the line in the ORIGINAL source, not the stripped one', () => {
  // The whole point of stripping with `skim`: a comment is replaced by its own
  // newlines, so line N of the scan is line N of the file. A stripper that
  // collapsed those lines reddens here rather than silently misdirecting every
  // entry the sweep has to act on.
  const comment = '// A four-line block comment above the refusal,\n'
    + '// whose only job is to sit between the file head\n'
    + '// and the call below it, so a collapsed line count\n'
    + '// shifts the answer by exactly four.\n';
  const root = binRoot({ 'seam.mjs': `${HEAD}${comment}fail('no-input', 'nothing to read');\n` });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 8: no-input']);
});

// --- the reasons a shape rule could not read ----------------------------------

test('a reason that is an EXPRESSION is reported, with the expression named in the detail', () => {
  // D-02 rejected the kebab-shape rule partly for missing exactly these, and
  // they are the refusals a user is most likely to hit.
  const root = binRoot({
    'seam.mjs': `${HEAD}emit({ ok: false, reason: e.seam, detail: e.detail });\n`
      + 'emit({ ok: false, reason: decision.reason, detail: null });\n'
      + "fail(reason, 'from a variable');\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'),
    ['line 4: e.seam', 'line 5: decision.reason', 'line 6: reason']);
});

test('a site emitting ok:false with NO reason key is reported and its detail says so', () => {
  // `config.mjs` emits one such envelope, carrying only `file`, `checked` and
  // `errors`; the detail names the absence rather than inventing a token.
  const root = binRoot({
    'seam.mjs': `${HEAD}return out({ ok: false, file, checked: 0,\n`
      + "  errors: [{ key: '(root)', error: 'top-level config must be a JSON object' }] });\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 4: (no reason key)']);
});

test('a call written inside a string or a regex character class is not a call', () => {
  // The scan tracks the same three literal kinds `skim` does. Dropping regex
  // tracking alone lost 29 real `planning.mjs` refusals to a `/['"]/` that
  // opened a phantom string and swallowed the rest of the file.
  const root = binRoot({
    'seam.mjs': `${HEAD}const doc = "call fail('no-input', 'x') to refuse";\n`
      + 'const quoted = /[\'"]/;\n'
      + "fail('the-only-real-one', 'a refusal a user can reach');\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 6: the-only-real-one']);
});

test('a `function fail(...)` DECLARATION is a signature, not a site - its BODY still is', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}function fail(reason, detail) {\n`
      + '  emit({ ok: false, reason, detail });\n'
      + '  throw DONE;\n'
      + '}\n',
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), ['line 5: reason']);
});

test('a method call reached through a dot is somebody else\'s emit', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}bus.emit({ ok: false, reason: 'not-ours', detail: 'x' });\n`
      + "self.fail('not-ours-either', 'x');\n",
  });
  assert.deepEqual(detailsFor(root, 'seam.mjs'), []);
});

// --- the walk -----------------------------------------------------------------

test('a *.test.mjs under the fixture bin is not walked - a test may write any shape', () => {
  const root = binRoot({
    'seam.test.mjs': `${HEAD}fail('no-input', 'nothing to read');\n`,
  });
  assert.deepEqual(refusalHintIssues(root), []);
});

test('a lib/ child IS walked', () => {
  const root = binRoot({ 'lib/helper.mjs': `${HEAD}fail('no-input', 'nothing to read');\n` });
  assert.deepEqual(detailsFor(root, 'lib/helper.mjs'), ['line 4: no-input']);
});

test('a non-.mjs file under bin is off the walk', () => {
  const root = binRoot({ 'data.json': '{"reason":"no-input"}\n' });
  assert.deepEqual(refusalHintIssues(root), []);
});

test('an ABSENT cadence-core/bin reports nothing rather than throwing', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-refusal-hints-bare-'));
  assert.deepEqual(refusalHintIssues(root), []);
  assert.deepEqual(refusalSites(root), []);
});

test('an UNREADABLE cadence-core/bin reports nothing rather than throwing', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0
    ? 'root bypasses mode bits' : false,
}, () => {
  const root = binRoot({ 'seam.mjs': `${HEAD}fail('no-input', 'nothing to read');\n` });
  const binDir = join(root, 'cadence-core', 'bin');
  chmodSync(binDir, 0o000);
  try {
    assert.deepEqual(refusalHintIssues(root), []);
  } finally {
    chmodSync(binDir, 0o755);
  }
});

// --- the census AC2 reads -----------------------------------------------------

test('refusalSites is the census refusalHintIssues is built on: hinted sites are counted, not filed', () => {
  const root = binRoot({
    'seam.mjs': `${HEAD}fail('no-input', 'nothing to read');\n`
      + "fail('no-target', 'nothing to write', 'name a target with --to <path>');\n",
  });
  const sites = refusalSites(root);
  assert.equal(sites.length, 2);
  assert.deepEqual(sites.map((s) => s.hinted), [false, true]);
  assert.deepEqual(sites.map((s) => s.token), ['no-input', 'no-target']);
  assert.deepEqual(sites.map((s) => s.line), [4, 5]);
  assert.equal(refusalHintIssues(root).length, 1);
});

test('every issue carries the uniform {kind, file, detail} shape and the one code', () => {
  const root = binRoot({ 'seam.mjs': `${HEAD}fail('no-input', 'nothing to read');\n` });
  const issues = refusalHintIssues(root);
  assert.equal(issues.length, 1);
  assert.deepEqual(Object.keys(issues[0]).sort(), ['detail', 'file', 'kind']);
  assert.equal(issues[0].kind, CODES.hintless);
  assert.equal(issues[0].kind, 'hintless-refusal');
  assert.match(issues[0].detail, /^line \d+: /);
});
