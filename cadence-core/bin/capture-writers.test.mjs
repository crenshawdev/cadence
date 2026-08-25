// Zero-dep tests for lib/capture-writers.mjs - the register of every prose site
// that issues a `.planning/CAPTURE.md` write, and the pure rule self-verify
// runs over it (check 23). Run:
//   node --test cadence-core/bin/capture-writers.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// This file owns the RULE and the register's shape: what counts as issuing a
// write, what counts as merely naming the seam, and the three kinds a site can
// be reported as. self-verify.test.mjs owns the CLI wiring and the assertion
// that the live tree is clean of all three kinds, which is why every fixture
// here is synthetic prose against a synthetic row set - with ONE deliberate
// exception, the REPLAY below, whose whole value is that it is not synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureWriterIssues, CAPTURE_WRITERS, WRITE_FACES, CAPTURE_PATH, CODES,
} from './lib/capture-writers.mjs';

const SURFACE = 'cadence-core/workflows/x.md';

/** A synthetic register row. */
const row = (over = {}) => ({
  surface: SURFACE,
  subcommand: 'capture',
  writes: 'this project\'s .planning/CAPTURE.md',
  durable: false,
  reason: 'a synthetic row',
  ...over,
});

/** Run the rule over one synthetic surface. */
const issues = (text, rows) => captureWriterIssues(SURFACE, text, rows);
const kinds = (text, rows) => issues(text, rows).map((i) => i.kind);

// The retired block, byte-for-byte out of `cadence-core/workflows/execute.md`
// as it shipped at 0169ef62 - the phase close filing every open item into the
// queue, one call per item. It is carried VERBATIM rather than paraphrased
// because the point of the replay is that this exact paragraph, which two
// plans' leases read past, is what the check reports.
const RETIRED = `File each open item into \`.planning/CAPTURE.md\` through the seam, one call per
item - it creates the file when absent and owns the bullet's format, so this
step states neither:
Write the sentence to a scratch file and name the PATH (caller-derived text -
references/conventions.md):
\`node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture --kind todo --text-file <path> --phase <N>\`
SUMMARY is the phase's record; CAPTURE is the live phase-linked queue - a
deferred item routed here resurfaces on its phase instead of surviving only
because the next executor re-notices it. Do not duplicate an item already
present. An \`ok:false\` return is reported in one line, never passed over: an
item that did not land is not queued. This file joins the docs commit in the
state step.`;

// --- the register itself -----------------------------------------------------

test('the register is frozen, rows and all', () => {
  assert.equal(Object.isFrozen(CAPTURE_WRITERS), true);
  assert.throws(() => CAPTURE_WRITERS.push(row()), TypeError);
  for (const r of CAPTURE_WRITERS) {
    assert.equal(Object.isFrozen(r), true, `${r.surface} ${r.subcommand} is a mutable row`);
    assert.throws(() => { r.durable = !r.durable; }, TypeError);
  }
  assert.equal(Object.isFrozen(WRITE_FACES), true);
  assert.deepEqual([...WRITE_FACES], ['capture', 'debt-harvest']);
  assert.equal(CAPTURE_PATH, '.planning/CAPTURE.md');
});

// CADENCE-CENSUS: capture-writers-register | asserts: the register is 4 rows, none of them durable
test('the register pins its row count', () => {
  // The count is the enumeration's own claim: this phase examined these sites
  // and no others. Adding a site without deciding whether its write can
  // accumulate is exactly the drift the register exists against, so the number
  // moves in the commit that adds the row and never on its own. Every live row
  // is non-durable BY CONSTRUCTION - a durable one is a reported problem on the
  // live tree, so a `durable: true` row here would redden self-verify.
  assert.equal(CAPTURE_WRITERS.length, 4);
  assert.equal(CAPTURE_WRITERS.filter((r) => r.durable).length, 0);
});

test('every row is well formed and carries its reason', () => {
  for (const r of CAPTURE_WRITERS) {
    const at = `${r.surface} ${r.subcommand}`;
    assert.ok(r.surface.length > 0 && !r.surface.includes('\\'), `${at}: root-relative POSIX path`);
    assert.ok(WRITE_FACES.includes(r.subcommand), `${at}: not a watched write face`);
    assert.ok(r.writes.length > 0, `${at}: names no file`);
    assert.equal(typeof r.durable, 'boolean', `${at}: unclassified`);
    assert.ok(r.reason.length > 20, `${at}: every row states why, non-durable or not`);
  }
});

// --- the replay: what would have caught this ---------------------------------

test('REPLAY: the retired summary-step block is reported against an empty register', () => {
  const found = issues(RETIRED, []);
  assert.equal(found.length, 1, 'the block that filed every open item reads as no write at all');
  assert.equal(found[0].kind, CODES.unregistered);
  assert.equal(found[0].file, SURFACE);
  assert.match(found[0].detail, /planning\.mjs capture/);
  assert.match(found[0].detail, /## Open items/);
});

test('REPLAY: the same block is reported when a row classifies it as outliving the phase', () => {
  const found = issues(RETIRED, [row({
    durable: true,
    reason: 'one bullet per open item at every phase close, which is what accumulates',
  })]);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, CODES.durable);
  assert.match(found[0].detail, /OUTLIVES the phase in flight/);
  assert.match(found[0].detail, /one bullet per open item at every phase close/);
});

// --- what is NOT a write instruction -----------------------------------------

test('a registered wholesale rewrite is silent', () => {
  const text = 'Then run\n`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" debt-harvest --root .`\n'
    + 'so a marker planted during the phase lands in the queue.';
  assert.deepEqual(kinds(text, [row({ subcommand: 'debt-harvest' })]), []);
  // And the SAME text against no row at all is the unregistered kind, which is
  // what proves the silence above is the row and not a blind spot.
  assert.deepEqual(kinds(text, []), [CODES.unregistered]);
});

test('a read-only subcommand sharing the prefix is not the write face', () => {
  for (const sub of ['capture-check', 'capture-sections']) {
    const text = `\`node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" ${sub} --root .\``;
    assert.deepEqual(kinds(text, []), [], `${sub} tokenized as \`capture\``);
  }
});

test('a backticked mention that instructs nothing is not a call', () => {
  const text = 'The `## Debt markers` section is written by `planning.mjs debt-harvest`,\n'
    + 'rewritten wholesale, and a `capture` of any kind reaches the file only\n'
    + 'through `lib/capture-file.mjs`.';
  assert.deepEqual(kinds(text, []), []);
});

// --- the redirect kind --------------------------------------------------------

test('a shell redirect at the capture path is reported, append or truncate', () => {
  for (const op of ['>>', '>']) {
    const text = `printf '%s\\n' "<item>" ${op} .planning/CAPTURE.md`;
    const found = issues(text, []);
    assert.equal(found.length, 1, `${op} was not read as a redirect`);
    assert.equal(found[0].kind, CODES.redirect);
    assert.match(found[0].detail, /lib\/capture-file\.mjs/);
  }
});

test('a redirect to any other path, and a mention of the bare filename, are silent', () => {
  const text = 'Write it to a scratch file: `printf \'%s\\n\' "<item>" >> "$scratch/notes.md"`,\n'
    + 'and hand the seam its path. The queue itself is `CAPTURE.md`, and the\n'
    + 'sibling queue is at `--file <resolved dir>/CAPTURE.md`.\n'
    + 'This paragraph names `.planning/CAPTURE.md` and writes nothing.';
  assert.deepEqual(kinds(text, []), []);
});

test('one line redirecting the capture path is reported once, not per occurrence', () => {
  const text = 'cat .planning/CAPTURE.md > .planning/CAPTURE.md';
  assert.deepEqual(kinds(text, []), [CODES.redirect]);
});

// --- the surface key ----------------------------------------------------------

test('a row settles its own surface only', () => {
  const text = '`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture --kind todo --text-file <p>`';
  assert.deepEqual(kinds(text, [row()]), []);
  assert.deepEqual(kinds(text, [row({ surface: 'skills/other/SKILL.md' })]), [CODES.unregistered]);
});

test('two rows for one surface and face both have to be non-durable', () => {
  const text = '`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture --kind todo --text-file <p>`';
  const both = [row(), row({ durable: true, reason: 'the second write files an item at a phase boundary' })];
  assert.deepEqual(kinds(text, both), [CODES.durable]);
});
