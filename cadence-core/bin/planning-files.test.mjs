// Parser-level tests for the PLAN.md frontmatter grammar in
// lib/planning-files.mjs. Run: node --test cadence-core/bin/planning-files.test.mjs
// This is the grammar table cadence-core/references/plan-frontmatter.md
// states in prose - every shipped form, every closed defect, and the three
// review-flagged unterminated-quote cases, ALONGSIDE (not instead of) the
// seam-level audit/plan-overlap tests in planning.test.mjs that prove the
// same defects reach an observable. Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, readFrontmatterList, parseActiveIds, insertReqRows } from './lib/planning-files.mjs';

/** Wrap a frontmatter body in a bare `---` fence, the grammar's anchor. */
const fence = (body) => `---\n${body}\n---\n# Plan\n`;

// Each row: {name, text, key, items, issues}. `items` and `issues` (issue
// CODES, in order) are asserted with assert.deepEqual against
// readFrontmatterList(text, key).
const ROWS = [
  // --- the template's own two lines (D-07's minimal accepted set) ---------
  {
    name: 'template requirements: [] with its trailing comment',
    text: fence('requirements: []     # phase requirement IDs this plan covers - never empty'),
    key: 'requirements', items: [], issues: [],
  },
  {
    name: 'template files: [] with its trailing comment',
    text: fence('files: []            # files this plan touches; split plans must not overlap'),
    key: 'files', items: [], issues: [],
  },

  // --- inline flow list -----------------------------------------------------
  {
    name: 'inline quoted',
    text: fence('requirements: ["#41", "#46"]'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'inline unquoted',
    text: fence('requirements: [CWT-01, CWT-02]'),
    key: 'requirements', items: ['CWT-01', 'CWT-02'], issues: [],
  },
  {
    name: 'inline with a bracketed trailing comment',
    text: fence('requirements: ["#41", "#46"]  # ids, see [D-06]'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'inline mixing a quoted #-shaped id with an unquoted one',
    text: fence('requirements: ["#41", CWT-02]'),
    key: 'requirements', items: ['#41', 'CWT-02'], issues: [],
  },
  {
    name: 'unterminated inline list (no closing bracket)',
    text: fence('requirements: ["#41", "#46"'),
    key: 'requirements', items: [], issues: ['unterminated-inline-list'],
  },
  {
    name: 'trailing content after the closing bracket',
    text: fence('requirements: ["#41"] stray'),
    key: 'requirements', items: ['#41'], issues: ['trailing-inline-content'],
  },

  // --- block list -----------------------------------------------------------
  {
    name: 'a two-space block list',
    text: fence('requirements:\n  - "#41"\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'a block list with a comment heading it',
    text: fence('requirements:\n  # heading comment\n  - "#41"\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'a comment splitting a block list',
    text: fence('requirements:\n  - "#41"\n  # splitting comment\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'a blank line inside a block list',
    text: fence('requirements:\n  - "#41"\n\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'termination at the next key line',
    text: fence('requirements:\n  - "#41"\nfiles: []'),
    key: 'requirements', items: ['#41'], issues: [],
  },
  {
    name: 'termination at the closing fence',
    text: fence('requirements:\n  - "#41"'),
    key: 'requirements', items: ['#41'], issues: [],
  },
  {
    name: 'a block item that is entirely a comment',
    text: fence('requirements:\n  - "#41"\n  - # stray\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'a block item `- "#41"`',
    text: fence('requirements:\n  - "#41"'),
    key: 'requirements', items: ['#41'], issues: [],
  },
  {
    name: 'a bare `-` item',
    text: fence('requirements:\n  - "#41"\n  - \n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },

  // --- scalar -----------------------------------------------------------
  {
    name: 'a quoted scalar',
    text: fence('requirements: "#41"'),
    key: 'requirements', items: ['#41'], issues: [],
  },
  {
    name: 'an unquoted scalar',
    text: fence('requirements: CWT-01'),
    key: 'requirements', items: ['CWT-01'], issues: [],
  },

  // --- the comment rule (D-01) -----------------------------------------
  {
    name: 'a key line whose remainder is entirely a `# ` comment',
    text: fence('requirements:   # phase requirement IDs\n  - "#41"\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'the #TODO no-space comment form',
    text: fence('requirements: #TODO fill this in\n  - "#41"\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },

  // --- normalization at the fence/text level ------------------------------
  {
    name: 'a whole-file CRLF variant',
    text: fence('requirements: ["#41", "#46"]').replace(/\n/g, '\r\n'),
    key: 'requirements', items: ['#41', '#46'], issues: [],
  },
  {
    name: 'a leading blank line before the fence',
    text: `\n${fence('requirements: ["#41"]')}`,
    key: 'requirements', items: ['#41'], issues: [],
  },
  {
    name: 'a BOM before the fence',
    text: `﻿${fence('requirements: ["#41"]')}`,
    key: 'requirements', items: ['#41'], issues: [],
  },

  // --- degenerate/absent shapes ------------------------------------------
  {
    name: 'an unterminated fence',
    text: '---\nrequirements: ["#41"]\n# no closing fence\n',
    key: 'requirements', items: [], issues: ['unterminated-frontmatter'],
  },
  {
    name: 'a missing key',
    text: fence('files: []'),
    key: 'requirements', items: [], issues: [],
  },
  {
    name: 'a file with no frontmatter at all',
    text: '# just prose\nrequirements: nope\n',
    key: 'requirements', items: [], issues: [],
  },
  {
    name: 'a prose requirements: line below the closing fence contributes nothing',
    text: `${fence('requirements: ["#41"]')}\nrequirements: these prose ids:\n\n- NOT-AN-ID\n`,
    key: 'requirements', items: ['#41'], issues: [],
  },

  // --- pinned: the three under-specified unterminated-quote cases ---------
  {
    name: 'unterminated quote INLINE (an apostrophe with no closing quote)',
    text: fence("files: [src/it's-a-file.md]"),
    key: 'files', items: [], issues: ['unterminated-quote'],
  },
  {
    name: 'unterminated quote as a SCALAR',
    text: fence("files: some/path'"),
    key: 'files', items: [], issues: ['unterminated-quote'],
  },
  {
    name: 'unterminated quote as a BLOCK ITEM',
    text: fence("files:\n  - 'unclosed"),
    key: 'files', items: [], issues: ['unterminated-quote'],
  },

  // --- pinned: skip-don't-terminate (D-04) --------------------------------
  {
    name: 'a stray line BETWEEN two block items - both survive, plus one issue',
    text: fence('requirements:\n  - "#41"\n  a stray line\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: ['unknown-line'],
  },
  {
    name: 'a stray line between two inline keys - items unaffected, issue still reported',
    text: fence('requirements: ["#41"]\na stray line\nfiles: []'),
    key: 'requirements', items: ['#41'], issues: ['unknown-line'],
  },

  // --- Task 1: value resolution - trailing content and residual quotes ----
  {
    name: 'a quoted block item with a trailing annotation',
    text: fence('files:\n  - "src/shared.rs" (new)'),
    key: 'files', items: ['src/shared.rs'], issues: ['trailing-value-content'],
  },
  {
    name: 'an unquoted block item with a trailing annotation (D-18 symmetry)',
    text: fence('files:\n  - src/a.rs (new)'),
    key: 'files', items: ['src/a.rs'], issues: ['trailing-value-content'],
  },
  {
    name: 'a quoted #-shaped block item with stray trailing content',
    text: fence('requirements:\n  - "#41" stray'),
    key: 'requirements', items: ['#41'], issues: ['trailing-value-content'],
  },
  {
    name: 'a quoted #-shaped scalar with stray trailing content',
    text: fence('requirements: "#41" stray'),
    key: 'requirements', items: ['#41'], issues: ['trailing-value-content'],
  },
  {
    name: 'an inline list element with stray trailing content dedupes to one issue',
    text: fence('requirements: ["#41" stray, "#46"]'),
    key: 'requirements', items: ['#41', '#46'], issues: ['trailing-value-content'],
  },
  {
    name: 'an apostrophe inside a double-quoted value is in the grammar - no residual-quote',
    text: fence("files: [\"src/it's-a-file.md\"]"),
    key: 'files', items: ["src/it's-a-file.md"], issues: [],
  },
  {
    name: 'a one-element backslash escape is detected, not silently fabricated (D-20)',
    text: fence('files: ["a\\"]'),
    key: 'files', items: ['a\\'], issues: ['residual-quote'],
  },
  {
    name: 'an unquoted value containing either quote character (D-20)',
    text: fence("requirements: [\"#41\", a'b'c]"),
    key: 'requirements', items: ['#41', "a'b'c"], issues: ['residual-quote'],
  },
  {
    name: 'the D-20 two-element escape case reports both codes on the one fabricated fragment',
    text: fence('files: ["a\\"b.md", "c\\"d.md"]'),
    key: 'files', items: ['a\\'], issues: ['trailing-value-content', 'residual-quote'],
  },
  {
    name: 'a backtick-WRAPPED value is reported, payload kept byte-exact (UAT-21)',
    text: fence('files:\n  - `src/shared.rs`'),
    key: 'files', items: ['`src/shared.rs`'], issues: ['backtick-wrapped-value'],
  },
  {
    name: 'a backtick INSIDE a value is a legal path character - no diagnostic (UAT-21 over-fire guard)',
    text: fence('files:\n  - lib/a`b.mjs'),
    key: 'files', items: ['lib/a`b.mjs'], issues: [],
  },
  // The near-miss wraps: each is just as unmatchable and just as silent as the
  // matched pair, so the test is a BOUNDARY test, not a matched-pair test.
  {
    name: 'a half-wrapped value (leading backtick only) is reported (UAT-21)',
    text: fence('files:\n  - `src/shared.rs'),
    key: 'files', items: ['`src/shared.rs'], issues: ['backtick-wrapped-value'],
  },
  {
    name: 'a half-wrapped value (trailing backtick only) is reported (UAT-21)',
    text: fence('files:\n  - src/shared.rs`'),
    key: 'files', items: ['src/shared.rs`'], issues: ['backtick-wrapped-value'],
  },
  {
    name: 'a backtick wrap followed by punctuation is reported (UAT-21)',
    text: fence('files:\n  - `src/shared.rs`,'),
    key: 'files', items: ['`src/shared.rs`,'], issues: ['backtick-wrapped-value'],
  },
  {
    name: 'a backtick-wrapped id survives the # rule as a lone backtick and is reported, not minted silently (UAT-21)',
    text: fence('requirements:\n  - `#41`'),
    key: 'requirements', items: ['`'], issues: ['backtick-wrapped-value'],
  },
  {
    name: 'a backtick-wrapped path containing a space reports both its codes (UAT-21)',
    text: fence('files:\n  - `src/my file.rs`'),
    key: 'files', items: ['`src/my'], issues: ['trailing-value-content', 'backtick-wrapped-value'],
  },
  {
    name: 'a bare `-` with no trailing whitespace is not an item - unknown-line (UAT-12)',
    text: fence('files:\n  -\n  - src/a.rs'),
    key: 'files', items: ['src/a.rs'], issues: ['unknown-line'],
  },
  {
    name: 'a `- ` with a trailing space is an empty item - contributes nothing, no issue (UAT-12)',
    text: fence('files:\n  - \n  - src/a.rs'),
    key: 'files', items: ['src/a.rs'], issues: [],
  },
  {
    name: 'a `-` followed by a TAB is an empty item too - any whitespace serves (UAT-12)',
    text: fence('files:\n  -\t\n  - src/a.rs'),
    key: 'files', items: ['src/a.rs'], issues: [],
  },
  {
    name: 'a dash followed directly by non-whitespace is not an item either - unknown-line (UAT-12)',
    text: fence('files:\n  -src/a.rs\n  - src/b.rs'),
    key: 'files', items: ['src/b.rs'], issues: ['unknown-line'],
  },

  // --- Task 2: an item with no open key is diagnosed and dropped (D-13) ---
  {
    name: 'items under an inline [] key report item-without-key, one per line',
    text: fence('files: []            # files this plan touches\n  - src/shared.rs\n  - src/a.rs'),
    key: 'files', items: [], issues: ['item-without-key', 'item-without-key'],
  },
  {
    name: 'a block item with no key at all',
    text: fence('- "#41"'),
    key: 'requirements', items: [], issues: ['item-without-key'],
  },
  {
    name: 'a non-empty inline list key followed by a block item still opens no block',
    text: fence('files: [src/a.rs]  # comment\n  - src/shared.rs'),
    key: 'files', items: ['src/a.rs'], issues: ['item-without-key'],
  },

  // --- Task 3: the two key-line near-misses (D-14, D-16) ------------------
  {
    name: 'a no-space key line is malformed-key-line, not silently parsed or unknown-line',
    text: fence('requirements:["#41"]'),
    key: 'requirements', items: [], issues: ['malformed-key-line'],
  },
  {
    name: 'a commented-out key line folds the next key\'s items into the previous key (D-14 accepted cost), pinned exactly',
    text: fence('requirements:\n- "#41"\n# files:\n  - src/shared.rs'),
    key: 'requirements', items: ['#41', 'src/shared.rs'], issues: ['commented-key-line'],
  },
  {
    name: 'an ordinary prose comment that happens to be key-shaped reports commented-key-line too, accepted noise',
    text: fence('requirements:\n  - "#41"\n  # TODO: fill this in\n  - "#46"'),
    key: 'requirements', items: ['#41', '#46'], issues: ['commented-key-line'],
  },
  {
    name: 'a column-0 bare URL is malformed-key-line, never parsed as key http value //example.com',
    text: fence('http://example.com'),
    key: 'requirements', items: [], issues: ['malformed-key-line'],
  },
  {
    name: 'a comment-only line that is NOT key-shaped does not over-fire commented-key-line',
    text: fence('files:\n  - "#41"\n  # shared with plan 2\n  - "#46"'),
    key: 'files', items: ['#41', '#46'], issues: [],
  },
];

// One test() per row, not one loop inside one test(): a row that fails
// reports its own name and does not abort the rows below it.
for (const row of ROWS) {
  test(`grammar: ${row.name}`, () => {
    const { items, issues } = readFrontmatterList(row.text, row.key);
    assert.deepEqual(items, row.items, 'items');
    assert.deepEqual(issues.map((i) => i.code), row.issues, 'issue codes');
  });
}

test('planning-files: unknown-line issue carries the correct line number and text', () => {
  const text = fence('requirements:\n  - "#41"\n  a stray line\n  - "#46"');
  const { issues } = readFrontmatterList(text, 'requirements');
  assert.deepEqual(issues, [{ line: 4, code: 'unknown-line', text: 'a stray line' }]);
});

test('planning-files: malformed-key-line issue carries the correct line number and text', () => {
  const text = fence('requirements:["#41"]');
  const { issues } = readFrontmatterList(text, 'requirements');
  assert.deepEqual(issues, [{ line: 2, code: 'malformed-key-line', text: 'requirements:["#41"]' }]);
});

test('planning-files: unterminated-frontmatter issue carries the opening fence line number', () => {
  const text = '---\nrequirements: ["#41"]\n# no closing fence\n';
  const { issues } = readFrontmatterList(text, 'requirements');
  assert.deepEqual(issues, [{ line: 1, code: 'unterminated-frontmatter', text: '---' }]);
});

// --- the shipped template reads to exactly what it declares (Task 2) -------

test('planning-files: the shipped templates/PLAN.md frontmatter reads empty and clean', () => {
  const text = readFileSync(new URL('../templates/PLAN.md', import.meta.url), 'utf8');
  assert.deepEqual(readFrontmatterList(text, 'requirements'), { items: [], issues: [] });
  assert.deepEqual(readFrontmatterList(text, 'files'), { items: [], issues: [] });
});

test('planning-files: a path added under the template\'s bare files: block key is read, not dropped', () => {
  const text = readFileSync(new URL('../templates/PLAN.md', import.meta.url), 'utf8')
    .replace(/^(files:.*)$/m, '$1\n  - src/a.rs');
  assert.deepEqual(readFrontmatterList(text, 'files'), { items: ['src/a.rs'], issues: [] });
});

// --- normalize alone ---------------------------------------------------------

const NORMALIZE_ROWS = [
  { name: 'CRLF to LF', input: 'a\r\nb\r\n', expected: 'a\nb\n' },
  { name: 'a lone CR to LF', input: 'a\rb\r', expected: 'a\nb\n' },
  { name: 'a BOM is stripped', input: '﻿abc', expected: 'abc' },
  { name: 'plain LF text is returned unchanged', input: 'a\nb\n', expected: 'a\nb\n' },
];

for (const row of NORMALIZE_ROWS) {
  test(`normalize: ${row.name}`, () => {
    assert.equal(normalize(row.input), row.expected);
  });
}

// --- parseActiveIds ----------------------------------------------------------

test('parseActiveIds: a plain bullet', () => {
  const text = '## Active\n\n- **GRM-01**: grammar work\n';
  assert.deepEqual(parseActiveIds(text), ['GRM-01']);
});

test('parseActiveIds: a checkbox bullet', () => {
  const text = '## Active\n\n- [ ] **SPN-01**: bookkeeping\n';
  assert.deepEqual(parseActiveIds(text), ['SPN-01']);
});

test('parseActiveIds: an unbolded bullet is ignored, no fallback guess', () => {
  const text = '## Active\n\n- SPN-01: bookkeeping (not bolded)\n';
  assert.deepEqual(parseActiveIds(text), []);
});

test('parseActiveIds: a duplicate id is de-duplicated first-occurrence-wins', () => {
  const text = '## Active\n\n- **GRM-01**: first\n- **GRM-01**: second, dup\n';
  assert.deepEqual(parseActiveIds(text), ['GRM-01']);
});

test('parseActiveIds: an absent ## Active heading returns null, not []', () => {
  const text = '## Shipped\n\n- **GRM-01**: shipped already\n';
  assert.equal(parseActiveIds(text), null);
});

test('parseActiveIds: a present-but-empty ## Active heading returns []', () => {
  const text = '## Active\n\n**None.**\n\n## Shipped\n';
  assert.deepEqual(parseActiveIds(text), []);
});

test('parseActiveIds: a ## Active-shaped list under a later heading is not read', () => {
  const text = '## Active\n\n- **GRM-01**: real\n\n## Shipped\n\n- **OLD-01**: not active scope\n';
  assert.deepEqual(parseActiveIds(text), ['GRM-01']);
});

// --- insertReqRows -----------------------------------------------------------

const TABLE = (rows) => '## Traceability\n\n' +
  '| Requirement | Phase | Status |\n|-------------|-------|--------|\n' +
  rows + '\nEmpty: prose paragraph after the table.\n';

test('insertReqRows: insertion into an empty table lands directly under the separator, prose byte-identical after', () => {
  const text = TABLE('');
  const res = insertReqRows(text, [{ id: 'SPN-01', phase: 2 }]);
  assert.deepEqual(res.inserted, ['SPN-01']);
  assert.deepEqual(res.skipped, []);
  assert.deepEqual(res.mismatched, []);
  assert.equal(res.text, '## Traceability\n\n' +
    '| Requirement | Phase | Status |\n|-------------|-------|--------|\n' +
    '| SPN-01 | Phase 2 | Pending |\n\nEmpty: prose paragraph after the table.\n');
});

test('insertReqRows: insertion after existing rows appends below the last one', () => {
  const text = TABLE('| GRM-01 | Phase 1 | Complete |\n');
  const res = insertReqRows(text, [{ id: 'SPN-01', phase: 2 }]);
  assert.deepEqual(res.inserted, ['SPN-01']);
  assert.equal(res.text, '## Traceability\n\n' +
    '| Requirement | Phase | Status |\n|-------------|-------|--------|\n' +
    '| GRM-01 | Phase 1 | Complete |\n| SPN-01 | Phase 2 | Pending |\n\n' +
    'Empty: prose paragraph after the table.\n');
});

test('insertReqRows: a re-insert of the same id reports skipped and returns byte-identical text', () => {
  const text = TABLE('| SPN-01 | Phase 2 | Pending |\n');
  const res = insertReqRows(text, [{ id: 'SPN-01', phase: 2 }]);
  assert.deepEqual(res.inserted, []);
  assert.deepEqual(res.skipped, ['SPN-01']);
  assert.deepEqual(res.mismatched, []);
  assert.equal(res.text, text);
});

test('insertReqRows: a differing phase is reported in mismatched, and the row is still skipped', () => {
  const text = TABLE('| SPN-01 | Phase 1 | Pending |\n');
  const res = insertReqRows(text, [{ id: 'SPN-01', phase: 2 }]);
  assert.deepEqual(res.skipped, ['SPN-01']);
  assert.deepEqual(res.mismatched, [{ id: 'SPN-01', row_phase: 1 }]);
  assert.equal(res.text, text);
});

test('insertReqRows: a CRLF fixture gets a CRLF row', () => {
  const text = TABLE('').replace(/\n/g, '\r\n');
  const res = insertReqRows(text, [{ id: 'SPN-01', phase: 2 }]);
  assert.deepEqual(res.inserted, ['SPN-01']);
  assert.ok(res.text.includes('| SPN-01 | Phase 2 | Pending |\r\n'));
});

test('insertReqRows: a table with no separator returns no-traceability-table, text unchanged', () => {
  const text = '## Traceability\n\n| Requirement | Phase | Status |\n\nno separator here\n';
  const res = insertReqRows(text, [{ id: 'SPN-01', phase: 2 }]);
  assert.equal(res.error, 'no-traceability-table');
  assert.deepEqual(res.inserted, []);
  assert.deepEqual(res.skipped, []);
  assert.deepEqual(res.mismatched, []);
  assert.equal(res.text, text);
});
