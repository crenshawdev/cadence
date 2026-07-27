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
import { normalize, readFrontmatterList } from './lib/planning-files.mjs';

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
