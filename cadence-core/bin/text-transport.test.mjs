// Zero-dep tests for lib/text-transport.mjs - the caller-derived-text register
// and the pure rule self-verify runs over it (check 19). Run:
//   node --test cadence-core/bin/text-transport.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// This file owns the RULE and the register's shape: what counts as a
// prescribed value, what counts as merely naming a flag, and the three kinds a
// site can be reported as. self-verify.test.mjs owns the CLI wiring and, from
// the plan's last task, the assertion that the live tree is clean of all three
// kinds - which is why nothing here reads a shipped surface. Every fixture is a
// synthetic row against synthetic prose, so a test failure here is a failure of
// the rule and never of someone's paragraph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textTransportIssues, TEXT_TRANSPORT, TEXT_FLAGS, CODES } from './lib/text-transport.mjs';

/** A synthetic register row. */
const row = (over = {}) => ({
  surface: 'cadence-core/workflows/x.md',
  flag: '--detail',
  value: '<what failed>',
  derived: true,
  ...over,
});

/** Run the rule over one synthetic surface. */
const issues = (text, rows) => textTransportIssues('cadence-core/workflows/x.md', text, rows);

// --- the register itself ------------------------------------------------------

test('the register is frozen, rows and all', () => {
  assert.equal(Object.isFrozen(TEXT_TRANSPORT), true);
  assert.throws(() => TEXT_TRANSPORT.push(row()), TypeError);
  for (const r of TEXT_TRANSPORT) {
    assert.equal(Object.isFrozen(r), true, `${r.surface} ${r.flag} is a mutable row`);
    assert.throws(() => { r.derived = !r.derived; }, TypeError);
  }
});

// CADENCE-CENSUS: text-transport-register | asserts: the register is 36 rows, 20 of them derived
test('the register pins its row count', () => {
  // The count is the enumeration's own claim: the phase examined these sites
  // and no others. Adding a site without deciding whether it is caller-derived
  // is exactly the drift the register exists against, so the number moves in
  // the commit that adds the row and never on its own.
  assert.equal(TEXT_TRANSPORT.length, 36);
  assert.equal(TEXT_TRANSPORT.filter((r) => r.derived).length, 20);
});

test('every out-of-scope row carries a reason, and every row is well formed', () => {
  for (const r of TEXT_TRANSPORT) {
    const at = `${r.surface} ${r.flag}`;
    assert.equal(typeof r.surface, 'string', at);
    assert.ok(r.surface.length > 0 && !r.surface.includes('\\'), `${at}: root-relative POSIX path`);
    assert.ok(r.flag === '-m' || r.flag.startsWith('--'), `${at}: flag as written`);
    assert.equal(typeof r.value, 'string', at);
    assert.equal(typeof r.derived, 'boolean', at);
    if (!r.derived) {
      // AC2's clause. A row saying "out of scope" and nothing else is a
      // judgement with no argument behind it, which the next reader cannot
      // check and therefore cannot correct.
      assert.equal(typeof r.reason, 'string', `${at}: an out-of-scope row needs a reason`);
      assert.ok(r.reason.length > 20, `${at}: the reason must say something`);
    }
  }
});

test('no two rows share a surface, flag and value', () => {
  // The lookup key. Two identical rows would make the classification depend on
  // which one a reader happened to edit.
  const keys = TEXT_TRANSPORT.map((r) => `${r.surface} | ${r.flag} | ${r.value}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('the watched flag set is exactly the free-text flags', () => {
  // Enum- and integer-validated flags are out by construction (D-01): a value
  // that must survive CURSOR_STATUSES.includes() or requireInt cannot be
  // arbitrary repository prose, so watching them would report sites no
  // transport could improve.
  for (const enumFlag of ['phase', 'status', 'result', 'severity', 'origin',
    'family', 'event', 'tokens']) {
    assert.equal(TEXT_FLAGS.includes(enumFlag), false, `--${enumFlag} is enum- or int-validated`);
  }
  assert.equal(Object.isFrozen(TEXT_FLAGS), true);
});

// --- kind 1: the site still prescribes the inline form ------------------------

test('a caller-derived row reports the inline site', () => {
  const found = issues('run it with --detail "<what failed>" on the same line\n', [row()]);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.inline);
  assert.equal(found[0].file, 'cadence-core/workflows/x.md');
  assert.match(found[0].detail, /--detail/);
  assert.match(found[0].detail, /conventions\.md/);
});

test('the file transport is not reported - and the flag boundary is why', () => {
  // `--detail-file` must never match as `--detail`, or converting a site would
  // leave it reported forever and the check would be uncorrectable.
  assert.deepEqual(issues('pass --detail-file <path> instead\n', [row()]), []);
  assert.deepEqual(issues('pass --label-file <path>\n',
    [row({ flag: '--label', value: '<label>' })]), []);
  // Nor may a longer flag ENDING in a watched name match: --bracket-read is a
  // different flag with a different grammar.
  assert.deepEqual(issues('--bracket-read "CLAUDE.md,.planning/PROJECT.md"\n',
    [row({ flag: '--read', value: 'x' })]), []);
});

// --- kind 2: site seventeen ---------------------------------------------------

test('a prescribed value no row classifies is reported, never passed over', () => {
  const found = issues('adds --detail "<the new thing>" here\n', [row()]);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.unregistered);
  assert.match(found[0].detail, /<the new thing>/);
});

test('a value is matched on the value, not on the flag', () => {
  // Two uses of one flag in one surface stay distinguishable: the literal is
  // silent and the composed one is reported, from the same two rows.
  const rows = [
    row({ flag: '--next', value: '<routed action from below>', derived: true }),
    row({ flag: '--next', value: '/cad-phase add', derived: false, reason: 'a literal this workflow authors, stated here' }),
  ];
  const found = issues('--next "/cad-phase add"\n--next "<routed action from below>"\n', rows);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.inline);
  assert.match(found[0].detail, /routed action from below/);
});

// --- kind 3: what the scan cannot delimit -------------------------------------

test('an unquoted placeholder with no row is reported as its own kind', () => {
  const found = issues('  --label <label> --mode <delete|archive>\n', []);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.unclear);
  assert.match(found[0].detail, /unquoted placeholder/);
});

test('a value that opens a quote and never closes it on the line is reported', () => {
  const found = issues('   --next "<next phase\'s /cad-context, or /cad-milestone if\n   this was the last>"\n', []);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.unclear);
  assert.match(found[0].detail, /never closes/);
});

test('a flag ending its line is reported rather than read as a mention', () => {
  const found = issues('carry --detail\n"<what failed>"\n', []);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.unclear);
});

test('a register row settles an undelimitable occurrence, in both directions', () => {
  const undelimited = '  --label <label> --mode <delete|archive>\n';
  // Derived: the row is the authority, so the site is reported as still
  // prescribing the inline form - not as a shape nobody could read.
  const bad = issues(undelimited, [row({ flag: '--label', value: '<label>', derived: true })]);
  assert.equal(bad.length, 1, JSON.stringify(bad));
  assert.equal(bad[0].kind, CODES.inline);
  // Out of scope with a reason: silent.
  assert.deepEqual(issues(undelimited, [row({
    flag: '--label', value: '<label>', derived: false,
    reason: 'the label is a literal this workflow authors, stated here',
  })]), []);
});

// --- silence: reasoned rows, and prose that merely names a flag ---------------

test('a reasoned out-of-scope row is silent', () => {
  assert.deepEqual(issues('run --detail "<what failed>" here\n',
    [row({ derived: false, reason: 'the value is one of two literals this workflow authors' })]), []);
});

test('prose that NAMES a flag needs no row and is never reported', () => {
  // The discriminator (D-10). Without it, a sentence written to FORBID the
  // inline form would itself be reported for naming it - and the register would
  // have to grow a row for every paragraph that mentions a flag.
  for (const line of [
    'OMIT `--detail` for a `PLAN COMPLETE` or `PLAN PARTIAL` return.',
    'it takes no `--role`, `--tokens` or `--read`: keying it in would invent a role.',
    'The RAISED count travels on the `--raised` FLAG and never inside `--detail`: a figure',
    'picks the arm off `--detail`: absent means `return`, present means `checkpoint`',
    '`--text` remains for a human at a shell.',
  ]) {
    assert.deepEqual(issues(`${line}\n`, []), [], line);
  }
});

// --- the git-tag arm ----------------------------------------------------------

test('`git tag -m` is watched, and `git commit -m` is not', () => {
  const rows = [row({ surface: 'skills/x/SKILL.md', flag: '-m', value: '<milestone label>' })];
  const at = (text) => textTransportIssues('skills/x/SKILL.md', text, rows);
  const found = at('cut it HERE: `git tag -a <version> -m "<milestone label>"` on the base\n');
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.inline);
  // A commit message is the workflow's own sentence and every prose surface in
  // the tree names one; watching `-m` outside `git tag` would report them all.
  assert.deepEqual(at('commit `wip: <short description>` via `git commit -m "<subject>"`\n'), []);
  // And the `-F` form the swap produces is not a `-m` at all.
  assert.deepEqual(at('`git tag -a <version> -F <path>` on the now-current base\n'), []);
});

// --- the surface key ----------------------------------------------------------

test('a row classifies its own surface only', () => {
  // Otherwise one workflow's reasoned exemption would silence the identical
  // value everywhere else, which is how a per-site judgement becomes a global
  // one nobody voted for.
  const rows = [row({ derived: false, reason: 'out of scope at this one site, for a stated reason' })];
  const found = textTransportIssues('cadence-core/workflows/other.md',
    'run --detail "<what failed>" here\n', rows);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].kind, CODES.unregistered);
  assert.equal(found[0].file, 'cadence-core/workflows/other.md');
});
