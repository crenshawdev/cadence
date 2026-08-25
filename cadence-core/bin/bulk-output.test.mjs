// Zero-dep tests for lib/bulk-output.mjs - the bulk-tool-output register and
// the pure rule self-verify runs over it (check 20). Run:
//   node --test cadence-core/bin/bulk-output.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// This file owns the RULE and the register's shape: what counts as a
// prescribed call, what counts as merely naming one, and the three kinds a
// site can be reported as. self-verify.test.mjs owns the CLI wiring and the
// assertion that the live tree is clean of all three kinds - which is why
// nothing here reads a shipped surface. Every fixture is a synthetic row
// against synthetic prose, so a failure here is a failure of the rule and
// never of someone's paragraph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulkOutputIssues, BULK_OUTPUT, BULK_SHAPES, CODES } from './lib/bulk-output.mjs';

const X = 'cadence-core/workflows/x.md';

/** A synthetic register row. */
const row = (over = {}) => ({
  surface: X,
  shape: 'trace render',
  call: 'trace render --phase <N>',
  bytes: 14857,
  measured: '2026-08-17',
  transport: 'redirect',
  ...over,
});

/** Run the rule over one synthetic surface. */
const issues = (text, rows) => bulkOutputIssues(X, text, rows);

/** A prescribing line for the two `planning.mjs` shapes. */
const seamLine = (args) => `node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" ${args}`;

// --- the register itself -----------------------------------------------------

test('the register and the shape list are frozen, rows and all', () => {
  assert.equal(Object.isFrozen(BULK_OUTPUT), true);
  assert.equal(Object.isFrozen(BULK_SHAPES), true);
  assert.throws(() => BULK_OUTPUT.push(row()), TypeError);
  for (const r of BULK_OUTPUT) {
    assert.equal(Object.isFrozen(r), true, `${r.surface} ${r.call} is a mutable row`);
    assert.throws(() => { r.transport = 'none'; }, TypeError);
  }
  for (const s of BULK_SHAPES) assert.equal(Object.isFrozen(s), true, `${s.shape} is a mutable shape`);
});

// CADENCE-CENSUS: bulk-output-register | asserts: the register is 17 rows, 4 redirect and 3 file
test('the register pins its row count', () => {
  // The count is the enumeration's own claim: this phase examined these sites
  // and no others. Adding a site without deciding whether it owes the file
  // transport is exactly the drift the register exists against, so the number
  // moves in the commit that adds the row and never on its own.
  assert.equal(BULK_OUTPUT.length, 17);
  assert.equal(BULK_OUTPUT.filter((r) => r.transport === 'redirect').length, 4);
  assert.equal(BULK_OUTPUT.filter((r) => r.transport === 'file').length, 3);
});

test('every row is well formed, and every row owing no redirect carries a reason', () => {
  const shapes = new Set(BULK_SHAPES.map((s) => s.shape));
  for (const r of BULK_OUTPUT) {
    const at = `${r.surface} ${r.call}`;
    assert.ok(r.surface.length > 0 && !r.surface.includes('\\'), `${at}: root-relative POSIX path`);
    assert.ok(shapes.has(r.shape), `${at}: ${r.shape} is not a watched shape`);
    assert.ok(r.call.length > 0, at);
    assert.ok(r.bytes === 'unbounded' || Number.isInteger(r.bytes),
      `${at}: bytes is a measured integer or the stated 'unbounded'`);
    assert.match(r.measured, /^\d{4}-\d{2}-\d{2}$/, `${at}: the date the figure was measured`);
    assert.ok(['redirect', 'file', 'none'].includes(r.transport), `${at}: ${r.transport}`);
    if (r.transport !== 'redirect') {
      // A row saying "no transport owed" and nothing else is a judgement with
      // no argument behind it, which the next reader cannot check and
      // therefore cannot correct.
      assert.equal(typeof r.reason, 'string', `${at}: a non-redirect row needs a reason`);
      assert.ok(r.reason.length > 30, `${at}: the reason is a sentence, not a word`);
    }
  }
});

test('no two rows share a surface, shape and call', () => {
  const keys = BULK_OUTPUT.map((r) => `${r.surface}|${r.shape}|${r.call}`);
  assert.equal(new Set(keys).size, keys.length,
    'a duplicate row is indistinguishable from a mistake');
});

// --- the rule ----------------------------------------------------------------

test('a converted row reports the site that goes back to riding the transcript', () => {
  const rows = [row()];
  // The redirect is written in the per-run form `references/conventions.md`
  // states, so the tree holds no illustration of the fixed shared path SCR-01
  // removed - check 21 (lib/scratch-path.mjs) is what enforces that shape, and
  // this check is blind to it either way.
  const clean = issues(seamLine('trace render --phase <N> > "$D/render.json"'), rows);
  assert.deepEqual(clean, [], JSON.stringify(clean));
  const back = issues(seamLine('trace render --phase <N>'), rows);
  assert.equal(back.length, 1, JSON.stringify(back));
  assert.equal(back[0].kind, CODES.inline);
  assert.match(back[0].detail, /conventions\.md/);
});

test('a prescribed call no row classifies is reported, never passed over', () => {
  const out = issues(seamLine('trace render --phase <current>'), []);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.equal(out[0].kind, CODES.unregistered);
  assert.match(out[0].detail, /--phase <current>/);
});

test('a call is matched on the call, not on the shape alone', () => {
  // Two prescriptions of one shape in one surface: the redirected one is
  // registered, the other is not, and the register must tell them apart.
  const rows = [row({ call: 'trace render --phase <N>' })];
  const out = issues(seamLine('trace render --all'), rows);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.equal(out[0].kind, CODES.unregistered);
});

test('a reasoned no-transport row is silent, redirect or not', () => {
  const rows = [row({ transport: 'none', reason: 'measured under the threshold' })];
  assert.deepEqual(issues(seamLine('trace render --phase <N>'), rows), []);
});

test('a `file` row settles a site whose destination is named off the call line', () => {
  const rows = [row({
    shape: 'git diff', call: 'git diff <a>..<b>', bytes: 'unbounded',
    transport: 'file', reason: 'the step writes it to a path named on the next line',
  })];
  assert.deepEqual(issues('On a fire, write `git diff <a>..<b>` to\n`<plandir>/x.diff`.\n', rows), []);
});

test('an occurrence the scan cannot delimit is reported as its own kind', () => {
  const out = issues('and independent; only the `git diff\n<a>..<b>` waits, since\n', []);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.equal(out[0].kind, CODES.unclear);
  assert.match(out[0].detail, /cannot delimit/);
});

test('a register row for that surface and shape settles an undelimitable one', () => {
  const rows = [row({
    shape: 'git diff', call: 'git diff <a>..<b>', bytes: 'unbounded',
    transport: 'none', reason: 'a prose mention wrapped across two lines, issuing nothing',
  })];
  assert.deepEqual(issues('and independent; only the `git diff\n<a>..<b>` waits, since\n', rows), []);
});

test('prose that merely NAMES a call needs no row and is never reported', () => {
  // Both discriminators at once: a sentence with no `planning.mjs` on it, and
  // one that has it but closes the call with a backtick.
  assert.deepEqual(issues('a worker with none of them is what `trace render` reports as unpaired\n', []), []);
  assert.deepEqual(issues('| `memory.backend` | universal | `bin/planning.mjs recall` - BM25 |\n', []), []);
  assert.deepEqual(issues('`planning.mjs recall`. Every claim below about the TAG is pinned.\n', []), []);
});

test('a `git diff` its own flags already bound is never reported', () => {
  for (const bounded of ['--stat', '--shortstat', '--numstat', '--quiet', '--name-only', '--name-status']) {
    assert.deepEqual(issues(`run \`git diff <a>..<b> ${bounded}\` first\n`, []), [],
      `${bounded} bounds the response, so the form cannot break the rule`);
    assert.deepEqual(issues(`run \`git diff --cached ${bounded}\` first\n`, []), [], bounded);
  }
});

test('a `git diff` that is neither a range nor --cached is out of the watched set', () => {
  assert.deepEqual(issues('its own diff (`git diff -- .planning/phases/{N}/PLAN*.md`, or the\n', []), []);
});

test('a row classifies its own surface only', () => {
  const out = bulkOutputIssues('cadence-core/workflows/y.md',
    seamLine('trace render --phase <N>'), [row()]);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.equal(out[0].kind, CODES.unregistered);
  assert.equal(out[0].file, 'cadence-core/workflows/y.md');
});

test('an angle-bracket placeholder is not read as a redirect', () => {
  // The whole reason the redirect test demands whitespace before the `>`:
  // `--phase <N>` closes a placeholder, and reading that as a redirect would
  // make every converted site pass without one.
  const out = issues(seamLine('trace render --phase <N>'), [row()]);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.equal(out[0].kind, CODES.inline);
});

test('two occurrences of one registered call are one row, not a second site', () => {
  const rows = [row({
    shape: 'git diff', call: 'git diff --cached', bytes: 'unbounded',
    transport: 'none', reason: 'the reviewer re-runs it in the cwd it inherits',
  })];
  assert.deepEqual(issues('shape (b) is `git diff --cached` plus the paths\nand `git diff --cached` again below\n', rows), []);
});
