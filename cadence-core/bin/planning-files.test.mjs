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
import {
  normalize, readFrontmatterList, parseActiveIds, insertReqRows,
  classifyPhaseList, cutPhaseDetail, parseRoadmapPhases, setPhaseBox,
  classifyActiveSection, isRequirementId, classifyAcceptanceCriteria,
} from './lib/planning-files.mjs';

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

// --- the roadmap phase-list grammar (classifyPhaseList) ---------------------
// The table cadence-core/references/roadmap-phases.md states in prose: every
// canonical shape, the closed-milestone shapes, and one row per out-of-grammar
// diagnostic code. Parser level, one test() per row - the seam-level tests in
// planning.test.mjs re-assert only a handful, since each of those pays a node
// spawn.

/** A template-shaped roadmap: `## Overview`, then `## Phases`, then `body`. */
const roadmap = (body) =>
  `# Roadmap: Test\n\n## Overview\n\nProse.\n\n## Phases\n\n${body}\n`;

// Each row: {name, text, state, phases?, codes}. `phases` (when present) is
// the expected phase NUMBERS; `codes` is the issue codes in line order.
const PHASE_LIST_ROWS = [
  // --- live: the canonical entry, unchanged (D-01) --------------------------
  {
    name: 'a single canonical entry',
    text: roadmap('- [ ] **Phase 1: Auth** - log in and out'),
    state: 'live', phases: [1], codes: [],
  },
  {
    name: 'several canonical entries mixing checked and unchecked boxes',
    text: roadmap('- [x] **Phase 1: Auth** - done\n- [ ] **Phase 2: Billing** - next'),
    state: 'live', phases: [1, 2], codes: [],
  },
  {
    name: 'a decimal insertion sorts between its neighbours',
    text: roadmap('- [x] **Phase 2: Billing** - done\n- [ ] **Phase 2.1: Hotfix** - urgent\n' +
      '- [ ] **Phase 3: Reports** - later'),
    state: 'live', phases: [2, 2.1, 3], codes: [],
  },
  {
    name: 'a CRLF checkout parses live, not as a near-miss scan',
    text: roadmap('- [ ] **Phase 1: Auth** - log in and out').replace(/\n/g, '\r\n'),
    state: 'live', phases: [1], codes: [],
  },
  {
    name: 'canonical entries plus their ### Phase N: details report no issues (the checkbox list is the phase set)',
    text: roadmap('- [ ] **Phase 1: Auth** - log in and out\n\n## Phase Details\n\n' +
      '### Phase 1: Auth\n**Depends on:** Nothing (first phase)'),
    state: 'live', phases: [1], codes: [],
  },

  // --- closed: a genuinely empty phase list ---------------------------------
  {
    name: 'an empty ## Phases section is a closed milestone',
    text: roadmap(''),
    state: 'closed', phases: [], codes: [],
  },
  {
    name: 'ordinary prose carrying no phase token is still closed',
    text: roadmap('The milestone shipped; the next scope is not set yet.'),
    state: 'closed', phases: [], codes: [],
  },
  {
    name: 'a stray `- [ ] decide scope` bullet carries no number, so it is not a near miss',
    text: roadmap('- [ ] decide scope'),
    state: 'closed', phases: [], codes: [],
  },
  {
    name: 'a bolded **Phase word with no number is prose, not a near miss',
    text: roadmap('The **Phase** column of the table moved.'),
    state: 'closed', phases: [], codes: [],
  },
  {
    name: 'a fully pruned template-shaped roadmap - empty ## Phases and a bare ## Phase Details heading - is closed',
    text: roadmap('## Phase Details'),
    state: 'closed', phases: [], codes: [],
  },

  // --- no-section -----------------------------------------------------------
  {
    name: 'a roadmap with no ## Phases heading at all',
    text: '# Roadmap: Test\n\n## Overview\n\nProse.\n',
    state: 'no-section', phases: [], codes: [],
  },

  // --- out-of-grammar: one row per diagnostic code --------------------------
  {
    name: 'phase-bullet: `- Phase 1: Ship auth` (no checkbox, no bold)',
    text: roadmap('- Phase 1: Ship auth'),
    state: 'out-of-grammar', phases: [], codes: ['phase-bullet'],
  },
  {
    name: 'phase-bullet: `- ✓ Phase 1: Auth` (a tick instead of a checkbox)',
    text: roadmap('- ✓ Phase 1: Auth'),
    state: 'out-of-grammar', phases: [], codes: ['phase-bullet'],
  },
  {
    name: 'phase-bullet: `- [ ] Phase 1: Auth` (checkbox, unbolded)',
    text: roadmap('- [ ] Phase 1: Auth'),
    state: 'out-of-grammar', phases: [], codes: ['phase-bullet'],
  },
  {
    name: 'phase-bullet: `- [ ] **Phase 1 Auth**` (bolded, no colon)',
    text: roadmap('- [ ] **Phase 1 Auth**'),
    state: 'out-of-grammar', phases: [], codes: ['phase-bullet'],
  },
  {
    name: 'phase-heading: a ### Phase 1: detail surviving a wiped checkbox list',
    text: roadmap('## Phase Details\n\n### Phase 1: Auth\n**Goal:** ship it'),
    state: 'out-of-grammar', phases: [], codes: ['phase-heading'],
  },
  {
    name: 'phase-heading: `## Phase 12: Auth` written as a section heading',
    text: roadmap('## Phase 12: Auth'),
    state: 'out-of-grammar', phases: [], codes: ['phase-heading'],
  },
  {
    name: 'phase-ordered-item: `1. Phase 1: Auth`',
    text: roadmap('1. Phase 1: Auth'),
    state: 'out-of-grammar', phases: [], codes: ['phase-ordered-item'],
  },
  {
    name: 'phase-ordered-item: `1) Phase 1: Auth`',
    text: roadmap('1) Phase 1: Auth'),
    state: 'out-of-grammar', phases: [], codes: ['phase-ordered-item'],
  },
  {
    name: 'phase-table-row: `| Phase 1 | Auth |`',
    text: roadmap('| Phase | Name |\n|---|---|\n| Phase 1 | Auth |'),
    state: 'out-of-grammar', phases: [], codes: ['phase-table-row'],
  },
  {
    name: 'phase-prose-line: the catch-all, so a shape outside the grammar is never silent',
    text: roadmap('Phase 2 rolls to the next milestone.'),
    state: 'out-of-grammar', phases: [], codes: ['phase-prose-line'],
  },
  {
    name: 'phase-outside-section: a canonical entry under a LATER ## heading',
    text: roadmap('## Next milestone (draft)\n\n- [ ] **Phase 1: Auth** - log in'),
    state: 'out-of-grammar', phases: [], codes: ['phase-outside-section'],
  },
  {
    name: 'phase-outside-section beats phase-bullet: the shape tests cannot tell them apart',
    text: roadmap('## Draft\n\n- [ ] **Phase 1: Auth** - log in\n- Phase 2: Billing'),
    state: 'out-of-grammar', phases: [],
    codes: ['phase-outside-section', 'phase-bullet'],
  },
  {
    name: 'a canonical entry INSIDE ## Phases is live, never phase-outside-section',
    text: roadmap('- [ ] **Phase 1: Auth** - log in'),
    state: 'live', phases: [1], codes: [],
  },
  {
    name: 'one issue per line, in line order, across mixed shapes',
    text: roadmap('- Phase 1: Ship auth\n\n## Phase Details\n\n### Phase 2: Billing'),
    state: 'out-of-grammar', phases: [], codes: ['phase-bullet', 'phase-heading'],
  },
];

for (const row of PHASE_LIST_ROWS) {
  test(`phase-list: ${row.name}`, () => {
    const res = classifyPhaseList(row.text);
    assert.equal(res.state, row.state, 'state');
    assert.deepEqual(res.phases.map((p) => p.n), row.phases, 'phase numbers');
    assert.deepEqual(res.issues.map((i) => i.code), row.codes, 'issue codes');
  });
}

test('classifyPhaseList: the surviving-detail issue carries its exact line, code and text', () => {
  const text = roadmap('## Phase Details\n\n### Phase 1: Auth\n**Goal:** ship it');
  assert.deepEqual(classifyPhaseList(text).issues,
    [{ line: 11, code: 'phase-heading', text: '### Phase 1: Auth' }]);
});

// --- cutPhaseDetail on CRLF --------------------------------------------------
// Newly reachable: parseRoadmapPhases now normalizes, so `renumber` no longer
// bails with unparseable-roadmap on a CRLF checkout and `/cad-phase remove`
// reaches this cut. `$` under /m matches before `\r` as well as `\n`, so both
// the named and the BARE heading shapes cut - pinned here so a later anchor
// edit cannot orphan a detail section silently.

const DETAILS = '# R\n\n## Phase Details\n\n### Phase 2:\nbare body\n\n' +
  '### Phase 3: Next\nnamed body\n';

test('cutPhaseDetail: a bare `### Phase N:` heading and its body are cut on a CRLF checkout', () => {
  const out = cutPhaseDetail(DETAILS.replace(/\n/g, '\r\n'), 2);
  assert.ok(!out.includes('bare body'));
  assert.ok(out.includes('named body'));
});

test('cutPhaseDetail: a named `### Phase N: Name` heading and its body are cut on a CRLF checkout', () => {
  const out = cutPhaseDetail(DETAILS.replace(/\n/g, '\r\n'), 3);
  assert.ok(!out.includes('named body'));
  assert.ok(out.includes('bare body'));
});

// --- the roadmap parse path is CRLF-only, never lone-CR ----------------------
// The roadmap READS through normalizeCrlf and WRITES raw bytes split on `\n`.
// CRLF survives that round trip because every roadmap write path matches
// without a `$` anchor (setPhaseBox, the renumber list filter) or under /m
// where `$` matches before `\r` (cutPhaseDetail). A lone-CR file does not: it
// is one giant line to every `split('\n')`, so parsing it into real phases
// hands the write paths a file they corrupt. It must stay unparseable.

const ROADMAP_LF = '# Roadmap\n\n## Phases\n\n- [x] **Phase 1: A** - a\n' +
  '- [ ] **Phase 2: B** - b\n\n## Phase Details\n\n### Phase 1: A\n\none\n';
const asCr = (s) => s.replace(/\n/g, '\r');
const asCrlf = (s) => s.replace(/\n/g, '\r\n');

test('parseRoadmapPhases: a CRLF checkout parses to real phases', () => {
  assert.deepEqual(
    parseRoadmapPhases(asCrlf(ROADMAP_LF)).map((p) => p.n), [1, 2],
  );
});

test('parseRoadmapPhases: a lone-CR file stays unparseable, so write paths never see it', () => {
  assert.deepEqual(parseRoadmapPhases(asCr(ROADMAP_LF)), []);
});

test('classifyPhaseList: a lone-CR file is no-section, not live', () => {
  assert.equal(classifyPhaseList(asCr(ROADMAP_LF)).state, 'no-section');
});

test('setPhaseBox: a CRLF line is flipped in place with its `\\r` intact', () => {
  const out = setPhaseBox(asCrlf(ROADMAP_LF), 2, true);
  assert.ok(out.text.includes('- [x] **Phase 2: B** - b\r\n'));
  assert.ok(!out.text.includes('\n\n')); // every terminator still CRLF
});

test('setPhaseBox: a lone-CR file matches nothing - the parse path must not have let it here', () => {
  assert.equal(setPhaseBox(asCr(ROADMAP_LF), 1, true), null);
});

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

// --- classifyActiveSection ---------------------------------------------------
// The `## Active` grammar table cadence-core/references/req-traceability.md
// states in prose: the bullet forms that declare an id, and the id-shaped lines
// outside the grammar that `audit` reports in `active_issues` instead of
// dropping. `parseActiveIds` delegates here, so these rows also pin what
// `seed-reqs` treats as declared.

/** A REQUIREMENTS-shaped doc: `## Active` at line 3, `body` from line 5. */
const activeDoc = (body) =>
  `# Requirements: Test\n\n## Active\n\n${body}\n\n## Traceability\n`;

// The v1.3.1 milestone-ask TABLE - the real shape this repo shipped at 6feef38,
// which parses to zero ids and used to be silent.
const V131_TABLE = '| Requirement | Milestone |\n|-------------|-----------|\n' +
  '| TRI-01 (triage every open bug) | v1.3.1 |\n' +
  '| FIX-01 (each accepted bug fixed) | v1.3.1 |';

// Each row: {name, text, ids, codes}. `ids` is the declared id list (null for
// an absent heading); `codes` is the issue codes in line order.
const ACTIVE_ROWS = [
  // --- in grammar: the bullet forms, never an issue -------------------------
  {
    name: 'a plain bold bullet declares its id',
    text: activeDoc('- **GRM-01**: grammar work'),
    ids: ['GRM-01'], codes: [],
  },
  {
    name: 'an unchecked `- [ ]` bullet declares its id',
    text: activeDoc('- [ ] **SPN-01**: bookkeeping'),
    ids: ['SPN-01'], codes: [],
  },
  {
    name: 'a checked `- [x]` bullet declares its id',
    text: activeDoc('- [x] **SPN-01**: bookkeeping'),
    ids: ['SPN-01'], codes: [],
  },
  {
    name: 'a duplicate id is de-duplicated first-occurrence-wins',
    text: activeDoc('- **GRM-01**: first\n- **GRM-01**: second, dup'),
    ids: ['GRM-01'], codes: [],
  },
  {
    name: 'an absent ## Active heading is ids null, NOT [] and NOT an issue',
    text: '# Requirements: Test\n\n## Shipped\n\n- **GRM-01**: shipped already\n',
    ids: null, codes: [],
  },
  {
    name: 'a present-but-empty ## Active heading is [] with no issues',
    text: '## Active\n\n**None.**\n\n## Shipped\n',
    ids: [], codes: [],
  },
  {
    name: 'an ## Active-shaped list under a LATER ## heading is not read',
    text: '## Active\n\n- **GRM-01**: real\n\n## Shipped\n\n- **OLD-01**: not active scope\n',
    ids: ['GRM-01'], codes: [],
  },
  {
    name: 'a CRLF checkout parses its bold bullet with no issue',
    text: activeDoc('- **GRM-01**: grammar work').replace(/\n/g, '\r\n'),
    ids: ['GRM-01'], codes: [],
  },
  {
    name: 'an indented continuation line naming another id is not an issue',
    text: activeDoc('- **GRM-01**: grammar work, see\n  RDM-01 for the roadmap half'),
    ids: ['GRM-01'], codes: [],
  },

  // --- in grammar, but the bold span is not an id: reported, never counted ---
  // The upgrade-regression pins. `ACTIVE_BULLET` reads ANY bold span as an id,
  // so `ids` still carries these (that is `seed-reqs`' declared set, unchanged);
  // `audit` holds them out of the arithmetic with `isRequirementId`. Without
  // both halves, every existing project with a prose bold-bullet in `## Active`
  // starts FAILing its audit on upgrade, named for an id that does not exist.
  {
    name: 'active-non-id-bullet: a prose bold bullet is STILL an id - the sharp edge, reported',
    text: activeDoc('- **Note**: scope is frozen for AUD-01'),
    ids: ['Note'], codes: ['active-non-id-bullet'],
  },
  {
    name: 'active-non-id-bullet: a prose bold bullet naming NO id token at all still reports',
    text: activeDoc('- **Note**: scope frozen 2026-07-01'),
    ids: ['Note'], codes: ['active-non-id-bullet'],
  },
  {
    name: 'active-non-id-bullet: a colon INSIDE the bold span - the id is not normalized, it is reported',
    text: activeDoc('- **AUD-01:** the colon belongs outside the span'),
    ids: ['AUD-01:'], codes: ['active-non-id-bullet'],
  },
  // A second id-shaped bold span on one bullet. The grammar reads only the
  // first, so without this the rest vanish with `issues: []` - the silent
  // under-read this file exists to prevent. Reported, never counted.
  {
    name: 'active-multi-id-bullet: a second id-shaped bold span is reported, not dropped silently',
    text: activeDoc('- **AUTH-01** and **AUTH-02**: both sides of the login flow'),
    ids: ['AUTH-01'], codes: ['active-multi-id-bullet'],
  },
  {
    name: 'active-multi-id-bullet: three ids report ONCE for the line, not once per extra span',
    text: activeDoc('- **AUTH-01**, **AUTH-02** and **AUTH-03**: the whole flow'),
    ids: ['AUTH-01'], codes: ['active-multi-id-bullet'],
  },
  {
    name: 'active-multi-id-bullet: ordinary emphasis is NOT an extra id - nothing is dropped, nothing reported',
    text: activeDoc('- **GRM-01**: the **core** path stays byte-exact'),
    ids: ['GRM-01'], codes: [],
  },
  {
    name: 'active-multi-id-bullet: the issue-form `#41` counts as an extra id too',
    text: activeDoc('- **GRM-01** and **#41**: the frontmatter reader'),
    ids: ['GRM-01'], codes: ['active-multi-id-bullet'],
  },
  {
    name: 'active-non-id-bullet: a bold span carrying the id plus prose',
    text: activeDoc('- **AUD-01 (the audit gate)**: text'),
    ids: ['AUD-01 (the audit gate)'], codes: ['active-non-id-bullet'],
  },
  {
    name: 'the `#41` issue spelling IS id-shaped in a bold span - no issue',
    text: activeDoc('- **#41**: silent data-file failure'),
    ids: ['#41'], codes: [],
  },
  // The digit-leading category, both halves of the same limit. `isRequirementId`
  // anchors the category's first character as a LETTER, so `2FA-01` is reported
  // and never counted - and `REQ_ID_TOKEN` carries the same anchor, so unbolding
  // it (the remedy the table refuses here) takes it from reported to invisible.
  // Pinned because the limit is STATED in prose
  // (references/req-traceability.md's remedy table, templates/REQUIREMENTS.md):
  // widening either anchor must break these rows deliberately, never silently.
  {
    name: 'active-non-id-bullet: a DIGIT-LEADING category is held out too - the stated v1.4.0 limit',
    text: activeDoc('- **2FA-01**: two-factor auth'),
    ids: ['2FA-01'], codes: ['active-non-id-bullet'],
  },
  {
    name: 'a digit-leading id UNBOLDED is SILENT - the same anchor, in the prose scan',
    text: activeDoc('- 2FA-01: two-factor auth'),
    ids: [], codes: [],
  },
  {
    name: 'a non-id bold bullet BESIDE real ones: the real ids parse, only the phantom reports',
    text: activeDoc('- **GRM-01**: grammar work\n- **Note**: scope is frozen\n- **RDM-01**: roadmap'),
    ids: ['GRM-01', 'Note', 'RDM-01'], codes: ['active-non-id-bullet'],
  },

  // --- out of grammar: one row per diagnostic code --------------------------
  {
    name: 'active-table-row: the v1.3.1 milestone-ask table parses to NO ids and reports every row',
    text: activeDoc(V131_TABLE),
    ids: [], codes: ['active-table-row', 'active-table-row'],
  },
  {
    name: 'active-table-row: that same table BESIDE a real bullet - the id parses AND both rows still report',
    text: activeDoc(`- **GRM-01**: grammar work\n\n${V131_TABLE}`),
    ids: ['GRM-01'], codes: ['active-table-row', 'active-table-row'],
  },
  {
    name: 'active-table-row: the `#41` issue-id spelling is an id token too',
    text: activeDoc('| Requirement | Milestone |\n|---|---|\n| #41 (silent data-file failure) | v1.3.1 |'),
    ids: [], codes: ['active-table-row'],
  },
  {
    name: 'active-unbolded-bullet: `- AUD-01: text` declares nothing and says so',
    text: activeDoc('- AUD-01: an unbolded bullet'),
    ids: [], codes: ['active-unbolded-bullet'],
  },
  {
    name: 'an unbolded bullet carrying NO id token is ordinary prose, no issue',
    text: activeDoc('- see references/req-traceability.md for the grammar'),
    ids: [], codes: [],
  },
  // Each bullet code names why THAT line is unread, so the remedy it implies
  // actually changes something: an indented bullet is unread because it is
  // indented (it is already bolded - bolding it again fixes nothing), and a
  // `*` bullet because the grammar reads `-` only.
  {
    name: 'active-indented-bullet: a BOLDED sub-bullet is unread for its indent, not its bolding',
    text: activeDoc('- **GRM-01**: grammar\n  - **RDM-01**: a sub-bullet, bolded and still unread'),
    ids: ['GRM-01'], codes: ['active-indented-bullet'],
  },
  {
    name: 'active-indented-bullet: an unbolded indented bullet reports the indent too',
    text: activeDoc('- **GRM-01**: grammar\n  - RDM-01: sub-bullet'),
    ids: ['GRM-01'], codes: ['active-indented-bullet'],
  },
  {
    name: 'active-nondash-bullet: a column-0 `*` bullet is legal GFM the grammar does not read',
    text: activeDoc('* **RDM-01**: star-bulleted and bolded'),
    ids: [], codes: ['active-nondash-bullet'],
  },
  {
    name: 'active-nondash-bullet: a `+` marker reports the same way',
    text: activeDoc('+ **RDM-01**: plus-bulleted'),
    ids: [], codes: ['active-nondash-bullet'],
  },
  {
    name: 'active-ordered-item: `1. AUD-01: text`',
    text: activeDoc('1. AUD-01: the audit gate'),
    ids: [], codes: ['active-ordered-item'],
  },
  {
    name: 'active-heading: a `### AUTH-01` sub-heading inside the section',
    text: activeDoc('### AUTH-01\n\nLog in and out.'),
    ids: [], codes: ['active-heading'],
  },
  {
    name: 'active-prose-line: a section authored entirely as prose is never silent',
    text: activeDoc('Scope for v1.4.0: TOK-01 and RDM-01 are planned, AUD-01 is not.'),
    ids: [], codes: ['active-prose-line'],
  },
  {
    name: 'active-prose-line: a CLOSED milestone naming its shipped ids reports NOTHING',
    // The real v1.2.0 shape (`git archive v1.2.0`): a correct-as-written
    // section whose prose names only ids the file already records under
    // `## Shipped`. Nothing is lost, so nothing is reported.
    text: '# Requirements: Test\n\n## Active\n\nNo active milestone. `v1.2.0` shipped its committed\n' +
      'scope (REV-01, SOC-01) - see `## Shipped`.\n\n## Shipped\n\n' +
      '| REV-01 (symlink guard) | 1 | Complete | v1.2.0 |\n' +
      '| SOC-01 (planner nudge) | 2 | Complete | v1.2.0 |\n',
    ids: [], codes: [],
  },
  {
    name: 'active-prose-line: prose naming ONE id the file records nowhere else still reports',
    text: '# Requirements: Test\n\n## Active\n\nNo active milestone. `v1.2.0` shipped REV-01 and\n' +
      'AUD-01 - see `## Shipped`.\n\n## Shipped\n\n| REV-01 (symlink guard) | 1 | Complete | v1.2.0 |\n',
    ids: [], codes: ['active-prose-line'],
  },
  {
    name: 'active-prose-line: a bullet declaring NO ADMISSIBLE id does not silence the prose line',
    // The suppression asks `isRequirementId`, the same question the arithmetic
    // asks. Against the raw bullet list this section "declared an id" (`Note`)
    // and went quiet over two ids nothing carries.
    text: activeDoc('Scope for v1.4.0: TOK-01 and RDM-01 are planned.\n\n- **Note**: scope frozen'),
    ids: ['Note'], codes: ['active-prose-line', 'active-non-id-bullet'],
  },
  {
    name: 'the SAME prose line beside real bullets reports NOTHING - the intro-paragraph guard',
    text: activeDoc('Scope for v1.4.0: TOK-01 and RDM-01 are planned, AUD-01 is not.\n\n' +
      '- **TOK-01**: the tokenizer\n- **RDM-01**: the roadmap grammar'),
    ids: ['TOK-01', 'RDM-01'], codes: [],
  },
  {
    name: 'one issue per line, in line order, across mixed shapes',
    text: activeDoc('1. AUD-01: ordered\n- AUD-02: unbolded\n\n### AUD-03'),
    ids: [], codes: ['active-ordered-item', 'active-unbolded-bullet', 'active-heading'],
  },
];

for (const row of ACTIVE_ROWS) {
  test(`active-section: ${row.name}`, () => {
    const res = classifyActiveSection(row.text);
    assert.deepEqual(res.ids, row.ids, 'ids');
    assert.deepEqual(res.issues.map((i) => i.code), row.codes, 'issue codes');
    // parseActiveIds delegates - the id extraction has ONE implementation.
    assert.deepEqual(parseActiveIds(row.text), row.ids, 'parseActiveIds delegation');
  });
}

// --- the CONTEXT `## Acceptance criteria` grammar ----------------------------
// The table cadence-core/references/acceptance-criteria.md states in prose.
// Every code in that file's out-of-grammar table has a row here and vice versa.

/** A CONTEXT-shaped doc: `## Acceptance criteria` at line 3, `body` from 5. */
const criteriaDoc = (body) =>
  `# Phase 1 Context\n\n## Acceptance criteria\n\n${body}\n\n## Flagged assumptions\n\nnone\n`;

// Each row: {name, text, criteria, codes}. `criteria` is the declared
// `{id, text}` list (null for an ABSENT heading); `codes` is the issue codes in
// line order.
const CRITERION_ROWS = [
  // --- in grammar: never an issue -------------------------------------------
  {
    name: 'the canonical bullet parses to {id, text}',
    text: criteriaDoc('- [ ] AC1: the tests pass'),
    criteria: [{ id: 'AC1', text: 'the tests pass' }], codes: [],
  },
  {
    name: 'a checked `- [x]` bullet is still a criterion',
    text: criteriaDoc('- [x] AC1: the tests pass'),
    criteria: [{ id: 'AC1', text: 'the tests pass' }], codes: [],
  },
  {
    name: 'a capital `- [X]` checkbox is still a criterion',
    text: criteriaDoc('- [X] AC1: the tests pass'),
    criteria: [{ id: 'AC1', text: 'the tests pass' }], codes: [],
  },
  {
    name: 'a two-digit id parses as itself',
    text: criteriaDoc('- [ ] AC12: the twelfth criterion'),
    criteria: [{ id: 'AC12', text: 'the twelfth criterion' }], codes: [],
  },
  {
    name: 'several criteria keep presentation order',
    text: criteriaDoc('- [ ] AC1: one\n- [ ] AC2: two\n- [ ] AC3: three'),
    criteria: [{ id: 'AC1', text: 'one' }, { id: 'AC2', text: 'two' },
      { id: 'AC3', text: 'three' }], codes: [],
  },
  {
    name: 'a wrapped criterion joins its continuation lines with one space',
    text: criteriaDoc('- [ ] AC1: the first line\n      continues here\n      and here'),
    criteria: [{ id: 'AC1', text: 'the first line continues here and here' }], codes: [],
  },
  {
    name: 'a continuation line naming another AC<N> reports NOTHING - the silence the rule buys',
    text: criteriaDoc('- [ ] AC1: unchanged, the same shape\n      AC3 pins elsewhere'),
    criteria: [{ id: 'AC1', text: 'unchanged, the same shape AC3 pins elsewhere' }], codes: [],
  },
  {
    name: 'a trailing (human-verify: ...) suffix stays in the text verbatim (D-11)',
    text: criteriaDoc('- [ ] AC2: the image builds (human-verify: needs docker)'),
    criteria: [{ id: 'AC2', text: 'the image builds (human-verify: needs docker)' }], codes: [],
  },
  {
    name: 'a CRLF checkout parses exactly as its LF twin',
    text: criteriaDoc('- [ ] AC1: the tests pass').replace(/\n/g, '\r\n'),
    criteria: [{ id: 'AC1', text: 'the tests pass' }], codes: [],
  },
  {
    name: 'a lone-CR file parses too - this is a pure reader, so `normalize` applies (D-03)',
    text: criteriaDoc('- [ ] AC1: the tests pass').replace(/\n/g, '\r'),
    criteria: [{ id: 'AC1', text: 'the tests pass' }], codes: [],
  },
  {
    name: 'an absent heading is criteria null, NOT [] and NOT an issue',
    text: '# Phase 1 Context\n\n## Durable decisions\n\n- D-01 (area): a decision\n',
    criteria: null, codes: [],
  },
  {
    name: 'criteria-heading-near-miss: a capital C drops the whole section, so it is reported',
    text: '# Phase 1 Context\n\n## Acceptance Criteria\n\n- [ ] AC1: the tests pass\n',
    criteria: null, codes: ['criteria-heading-near-miss'],
  },
  {
    name: 'criteria-heading-near-miss: a trailing colon',
    text: '# Phase 1 Context\n\n## Acceptance criteria:\n\n- [ ] AC1: the tests pass\n',
    criteria: null, codes: ['criteria-heading-near-miss'],
  },
  {
    name: 'criteria-heading-near-miss: the wrong heading level',
    text: '# Phase 1 Context\n\n### Acceptance criteria\n\n- [ ] AC1: the tests pass\n',
    criteria: null, codes: ['criteria-heading-near-miss'],
  },
  {
    name: 'criteria-heading-near-miss is reported ONCE - the section is singular',
    text: '# Phase 1 Context\n\n## Acceptance Criteria\n\n- [ ] AC1: one\n\n## Acceptance criteria:\n\n- [ ] AC2: two\n',
    criteria: null, codes: ['criteria-heading-near-miss'],
  },
  {
    name: 'the exact heading wins over a near-miss elsewhere in the file',
    text: '# Phase 1 Context\n\n## Acceptance Criteria (draft)\n\nold notes\n\n## Acceptance criteria\n\n- [ ] AC1: the tests pass\n',
    criteria: [{ id: 'AC1', text: 'the tests pass' }], codes: [],
  },
  {
    name: 'a present-but-empty heading is [] with no issues',
    text: '# Phase 1 Context\n\n## Acceptance criteria\n\n## Flagged assumptions\n\nnone\n',
    criteria: [], codes: [],
  },
  {
    name: 'a criterion-shaped bullet under a LATER ## heading is not read',
    text: '## Acceptance criteria\n\n- [ ] AC1: real\n\n## Notes\n\n- [ ] AC2: not a criterion\n',
    criteria: [{ id: 'AC1', text: 'real' }], codes: [],
  },
  {
    name: 'a criterion-shaped bullet inside a fence is an EXAMPLE, not a criterion',
    text: criteriaDoc('- [ ] AC1: real\n\n```markdown\n- [ ] AC9: inside a fence\n```'),
    criteria: [{ id: 'AC1', text: 'real' }], codes: [],
  },
  {
    name: 'an out-of-grammar shape inside a fence reports nothing either',
    text: criteriaDoc('- [ ] AC1: real\n\n```markdown\n- [ ] a bare bullet\n### AC8: heading\n```'),
    criteria: [{ id: 'AC1', text: 'real' }], codes: [],
  },
  {
    name: 'a ## line inside a fence does not bound the section',
    text: criteriaDoc('- [ ] AC1: real\n\n```sh\n## build output\n```\n\n- [ ] AC2: also real'),
    criteria: [{ id: 'AC1', text: 'real' }, { id: 'AC2', text: 'also real' }], codes: [],
  },
  {
    name: 'a tilde fence closes only on tildes at least as long',
    text: criteriaDoc('- [ ] AC1: real\n\n~~~~\n- [ ] AC9: still fenced\n~~~\n- [ ] AC8: also still fenced\n~~~~'),
    criteria: [{ id: 'AC1', text: 'real' }], codes: [],
  },
  {
    name: 'a fenced heading is not the section heading',
    text: '# Phase 1 Context\n\n```markdown\n## Acceptance criteria\n\n- [ ] AC1: an example\n```\n',
    criteria: null, codes: [],
  },
  {
    name: 'ordinary prose naming no AC<N> token is silent',
    text: criteriaDoc('- [ ] AC1: one\n\nTooling probed on this machine: node, npx, git.'),
    criteria: [{ id: 'AC1', text: 'one' }], codes: [],
  },

  // --- out of grammar: one code per row, all nine ----------------------------
  {
    name: 'criterion-unidded: a bare checkbox bullet - the legacy shape, the central diagnostic',
    text: criteriaDoc('- [ ] the tests pass'),
    criteria: [], codes: ['criterion-unidded'],
  },
  {
    name: 'criterion-unidded fires on a bullet naming NO id token at all (checked before the token gate)',
    text: criteriaDoc('- [ ] AC1: one\n- [ ] the linter is clean'),
    criteria: [{ id: 'AC1', text: 'one' }], codes: ['criterion-unidded'],
  },
  {
    name: 'criterion-unidded: a bullet whose PROSE names an id is still unidded, not malformed',
    text: criteriaDoc('- [ ] the AC3 pin still holds'),
    criteria: [], codes: ['criterion-unidded'],
  },
  {
    name: 'criterion-malformed-id: a second space after the checkbox (a list re-indent)',
    text: criteriaDoc('- [ ]  AC1: one thing'),
    criteria: [], codes: ['criterion-malformed-id'],
  },
  {
    name: 'criterion-malformed-id: emphasis around the id token',
    text: criteriaDoc('- [ ] **AC1**: one thing'),
    criteria: [], codes: ['criterion-malformed-id'],
  },
  {
    name: 'criterion-malformed-id: a lowercase ac1 - the token is case-sensitive',
    text: criteriaDoc('- [ ] ac1: one thing'),
    criteria: [], codes: ['criterion-malformed-id'],
  },
  {
    name: 'criterion-malformed-id: the colon is missing',
    text: criteriaDoc('- [ ] AC1 one thing'),
    criteria: [], codes: ['criterion-malformed-id'],
  },
  {
    name: 'criterion-duplicate-id: the second bullet reusing an id is reported and NOT pushed',
    text: criteriaDoc('- [ ] AC3: first\n- [ ] AC3: second, a duplicate'),
    criteria: [{ id: 'AC3', text: 'first' }], codes: ['criterion-duplicate-id'],
  },
  {
    name: 'criterion-empty-text: reported AND still pushed with an empty text (parse-then-diagnose)',
    text: criteriaDoc('- [ ] AC4:'),
    criteria: [{ id: 'AC4', text: '' }], codes: ['criterion-empty-text'],
  },
  {
    name: 'criterion-unboxed-bullet: no checkbox, so not a criterion',
    text: criteriaDoc('- AC1: the tests pass'),
    criteria: [], codes: ['criterion-unboxed-bullet'],
  },
  {
    name: 'criterion-nondash-bullet: legal GFM, but the grammar reads `-` only',
    text: criteriaDoc('* AC1: the tests pass'),
    criteria: [], codes: ['criterion-nondash-bullet'],
  },
  {
    name: 'criterion-indented-bullet: an indented criterion with nothing open',
    text: criteriaDoc('  - [ ] AC2: the linter is clean'),
    criteria: [], codes: ['criterion-indented-bullet'],
  },
  {
    name: 'criterion-indented-bullet: the continuation exception - an indented AC bullet UNDER an open criterion',
    text: criteriaDoc('- [ ] AC1: one\n  - [ ] AC2: swallowed as prose without this'),
    criteria: [{ id: 'AC1', text: 'one' }], codes: ['criterion-indented-bullet'],
  },
  {
    name: 'criterion-ordered-item: a numbered list item',
    text: criteriaDoc('1. AC1: the tests pass'),
    criteria: [], codes: ['criterion-ordered-item'],
  },
  {
    name: 'criterion-heading: a criterion written as a heading',
    text: criteriaDoc('### AC1: the tests pass'),
    criteria: [], codes: ['criterion-heading'],
  },
  {
    name: 'criterion-prose-line: the catch-all - phase 5s own CONTEXT footer',
    text: criteriaDoc('- [ ] AC7: the last one\n\nAC7 is the only human-verify criterion.'),
    criteria: [{ id: 'AC7', text: 'the last one' }], codes: ['criterion-prose-line'],
  },

  // The mixed-authoring case the entry-shaped codes exist for: one idded bullet
  // beside four out-of-grammar lines. `classifyPhaseList`'s near-miss
  // suppression would report NONE of these; suppressing them here is what would
  // hide a half-migrated CONTEXT.
  {
    name: 'one issue per line, in line order, across mixed shapes beside a real criterion',
    text: criteriaDoc('- [ ] AC1: real\n- [ ] a bare bullet\n1. AC2: ordered\n### AC3: heading\nAC4 lives in prose.'),
    criteria: [{ id: 'AC1', text: 'real' }],
    codes: ['criterion-unidded', 'criterion-ordered-item', 'criterion-heading', 'criterion-prose-line'],
  },
];

for (const row of CRITERION_ROWS) {
  test(`acceptance-criteria: ${row.name}`, () => {
    const res = classifyAcceptanceCriteria(row.text);
    assert.deepEqual(res.criteria, row.criteria, 'criteria');
    assert.deepEqual(res.issues.map((i) => i.code), row.codes, 'issue codes');
  });
}

test('classifyAcceptanceCriteria: an issue carries its exact line, code and truncated text', () => {
  assert.deepEqual(
    classifyAcceptanceCriteria(criteriaDoc('- [ ] AC1: one\n- [ ] a bare bullet')).issues,
    [{ line: 6, code: 'criterion-unidded', text: '- [ ] a bare bullet' }]);
});

// `declaresIds` (rule 7), the signal `criteria.length` cannot carry. Every
// `'some'` row below parses to ZERO criteria while naming an id in the same
// text: read as "declared nothing", each one hands `criteria-coverage`'s legacy
// exemption a phase whose CONTEXT declares ids on its face. The `'none'` rows
// are what the exemption is FOR, and they must keep it.
//
// Each row: {name, text, declares}.
const DECLARES_ROWS = [
  // --- in grammar -----------------------------------------------------------
  { name: 'a parsed criterion declares its id',
    text: criteriaDoc('- [ ] AC1: the tests pass'), declares: 'some' },

  // --- refused by the grammar, declared by the author -----------------------
  { name: 'a missing colon is still a declaration',
    text: criteriaDoc('- [ ] AC1 the feature works'), declares: 'some' },
  { name: 'emphasis around the token is still a declaration',
    text: criteriaDoc('- [ ] **AC1**: bolded'), declares: 'some' },
  { name: 'a backticked token is still a declaration, though its code is unidded',
    text: criteriaDoc('- [ ] `AC1`: quoted'), declares: 'some' },
  { name: 'a lowercase ac1 is still a declaration',
    text: criteriaDoc('- [ ] ac1: lowercased'), declares: 'some' },
  { name: 'a second space after the checkbox is still a declaration',
    text: criteriaDoc('- [ ]  AC1: re-indented'), declares: 'some' },
  { name: 'an indented criterion bullet is still a declaration',
    text: criteriaDoc('  - [ ] AC1: indented'), declares: 'some' },
  { name: 'an unboxed bullet is still a declaration',
    text: criteriaDoc('- AC1: no checkbox'), declares: 'some' },
  { name: 'a non-dash marker is still a declaration',
    text: criteriaDoc('* [ ] AC1: nondash'), declares: 'some' },
  { name: 'a criterion written as a heading is still a declaration',
    text: criteriaDoc('### AC1: heading'), declares: 'some' },
  { name: 'an ordered list item is still a declaration',
    text: criteriaDoc('1. AC1: ordered'), declares: 'some' },
  { name: 'a bare `AC1: text` prose line is still a declaration',
    text: criteriaDoc('AC1: no marker at all'), declares: 'some' },

  // --- declares nothing: the exemption's own population ----------------------
  { name: 'bare checkbox bullets declare nothing - the pre-id shape',
    text: criteriaDoc('- [ ] the tests pass\n- [ ] the linter is clean'), declares: 'none' },
  { name: 'a bullet whose PROSE names an id declares nothing - the head is empty',
    text: criteriaDoc('- [ ] the AC3 pin still holds'), declares: 'none' },
  { name: 'a prose line mentioning an id mid-sentence declares nothing',
    text: criteriaDoc('- [ ] the tests pass\n\nThe gate proves AC3 elsewhere.'), declares: 'none' },
  { name: 'a criterion inside a fence is an EXAMPLE and declares nothing',
    text: criteriaDoc('```markdown\n- [ ] AC1: an example\n```'), declares: 'none' },
  { name: 'a present-but-empty section declares nothing',
    text: criteriaDoc(''), declares: 'none' },
  { name: 'an absent heading declares nothing',
    text: '# Phase 1 Context\n\n## Scope boundary\n\nIn: everything.\n', declares: 'none' },

  // --- unreadable: not the same datum as nothing ----------------------------
  { name: 'a near-miss heading is unknown, never none - its section is never walked',
    text: '# Phase 1 Context\n\n## Acceptance Criteria\n\n- [ ] AC1: the tests pass\n',
    declares: 'unknown' },
  { name: 'a near-miss heading is unknown even when nothing under it names an id',
    text: '# Phase 1 Context\n\n## Acceptance criteria:\n\n- [ ] the tests pass\n',
    declares: 'unknown' },
];

for (const row of DECLARES_ROWS) {
  test(`acceptance-criteria declaresIds: ${row.name}`, () => {
    assert.equal(classifyAcceptanceCriteria(row.text).declaresIds, row.declares);
  });
}

// This repo's own four v2.0.0 phases, FROZEN: the fixture no synthetic row can
// replace, because the grammar must keep reading the files it was written
// against - wrapped continuations, backticks, embedded colons and all.
//
// Each entry runs from that phase's `## Acceptance criteria` heading through the
// following `## Flagged assumptions` heading, so the section bound is exercised
// too. Recover any of them verbatim with
// `git show v2.0.0:.planning/phases/<N>/CONTEXT.md`.
//
// Inlined rather than read from disk (D-11): `/cad-milestone`'s prune DELETES
// the live `.planning/phases/<N>/` directories at a milestone close, so the read
// this replaces ENOENTed on phases 2-4 and silently classified a different
// phase 1 where it still resolved. The two alternatives are worse - a committed
// fixtures path under `cadence-core/` re-creates a second copy that drifts, and
// shelling out to `git show` adds a git dependency to a suite that has none.
const V200_CRITERIA_SECTIONS = [
  // Phase 1
  [
    '## Acceptance criteria',
    '',
    '- [ ] AC1: `agents/` holds exactly the 13 files the `rungs` arrays in',
    "      `route-table.json` name (6 base + 7 suffixed), each file's frontmatter",
    '      `effort` equal to the rung in its name; deleting any one makes',
    '      `node --test cadence-core/bin/self-verify.test.mjs` fail with a problem',
    '      naming that agent',
    '- [ ] AC2: Adding a contract-skill section tag (`<process>`, `<guardrails>`,',
    '      ...) to the body of an agent file that declares `skills:` makes',
    '      `node cadence-core/bin/self-verify.mjs` report `ok:false` with that file',
    '      named; removing it returns `ok:true`',
    '- [ ] AC3: `grep -rn "escalate_effort_variant\\|effort-variant" --include="*.md"',
    '      --include="*.json" --include="*.mjs" .` returns matches only under',
    '      `.planning/` and in `CHANGELOG.md`',
    '- [ ] AC4: `route-table.json` carries',
    '      `rung_order: ["low","medium","high","xhigh","max"]`, and a role whose',
    '      `base_effort` or `escalate_to` falls outside its own `rungs` array fails',
    '      self-verify with the role named',
    "- [ ] AC5: `resolve('cad-plan-checker', autoCfg, ['--attempt','2'])` still",
    "      returns `agent: 'cad-plan-checker-high'`, `effort: 'high'`,",
    '      `escalated: true` - the four existing escalation rows in',
    '      `cadence-core/bin/route.test.mjs` (`:88`, `:119`, `:255`, `:339`) pass',
    '      unchanged, plus a new row pinning `escalate_to` as the source of the swap',
    '- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` exits 0 and',
    '      `npx tsc -p tsconfig.ci.json` exits 0',
    '- [ ] AC7: `node cadence-core/bin/self-verify.mjs` reports `ok:true` with',
    '      `agent-skills` still in its `checked` list; all 13 agent files have',
    '      `weight-budgets.json` entries (no `unbudgeted-surface`), and no rung',
    "      file's contract skill sets `disable-model-invocation: true`",
    '',
    '## Flagged assumptions',
  ].join('\n'),
  // Phase 2
  [
    '## Acceptance criteria',
    '',
    '- [ ] AC1: `node cadence-core/bin/config.mjs check model.profile=balanced`',
    '      returns `{ok:false, reason:"invalid"}` whose `detail[].error` names',
    '      `stakes` as the replacement rather than the generic `unknown key`; and a',
    '      retired VALUE (`stakes=quality`) is refused with a message naming the',
    '      three valid ones',
    '- [ ] AC2: Given a repo config still holding `model.profile: "balanced"`, both',
    '      live read faces speak - `node cadence-core/bin/config.mjs get stakes` and',
    '      `node cadence-core/bin/route.mjs resolve --role cad-planner` each emit one',
    '      warning naming `model.profile` and pointing at `stakes`; neither resolves',
    "      silently at the default, and route's reason string does not report",
    '      `config:repo` for a value it never read',
    '- [ ] AC3: `grep -rn "model\\.profile\\|profile_order\\|model\\.auto\\."',
    '      --include="*.md" --include="*.json" --include="*.mjs" .` returns matches',
    "      only under `.planning/`, in `CHANGELOG.md`, and in `DESIGN.md`'s dated",
    '      marker; and `git diff` touches no `review.providers.*.tiers.*` line, no',
    '      `tier_order` line and no `rung_order` line',
    '- [ ] AC4: With NO `stakes` key set anywhere,',
    "      `resolve('cad-plan-checker', cfg, ['--attempt','2'])` returns",
    "      `agent: 'cad-plan-checker-high'`, `escalated: true` - phase 1's rung",
    '      ladder is reachable at the shipped default, which it is not today',
    '- [ ] AC5: `config.schema.json` holds `stakes`',
    '      (`["solo","shipped","critical"]`, default `"shipped"`) and',
    '      `model.escalate_on_failure`, and holds no `model.profile`, no',
    '      `model.auto.ceiling` and no `model.auto.max_escalations`',
    '- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` exits 0 and',
    '      `npx tsc -p tsconfig.ci.json` exits 0',
    '- [ ] AC7: `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no',
    '      `unknown-config-key`, no `inert-config-key` and no budget overage; and',
    "      `CHANGELOG.md`'s `## [Unreleased]` names the break plus the exact command",
    '      a user runs on upgrade',
    '',
    '## Flagged assumptions',
  ].join('\n'),
  // Phase 3
  [
    '## Acceptance criteria',
    '',
    '- [ ] AC1: `node cadence-core/bin/route.mjs resolve --role <role>` returns',
    '      `model`, `effort`, `review` and `verify` for all 18 level-and-role pairs,',
    '      and `cadence-core/bin/route.test.mjs` carries one row per pair with',
    '      literal expected values rather than values derived from the table under',
    '      test',
    '- [ ] AC2: With `--attempt 2`, each cell resolves to the retry rung its grid',
    "      row names and returns that rung's agent file; where retry equals the",
    '      starting rung (level 3 analyzer and executor) the `reason` string says the',
    '      rung was held; and `escalate_to` appears in no shipped `.json`, `.mjs` or',
    '      `.md`',
    "- [ ] AC3: `agents/` holds the 19 files the grids name, each file's frontmatter",
    '      `effort` equals the rung in its name, each has a `weight-budgets.json`',
    '      entry, and `node cadence-core/bin/self-verify.mjs` names the cell when a',
    '      grid names a rung with no file',
    '- [ ] AC4: `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming',
    '      the offending cell for each of four bad-value classes - a model outside',
    '      `model_aliases`, a rung outside `rung_order`, a gate outside',
    '      `off|advisory|blocking|adjudicated`, and a trigger name',
    '      `config.schema.json` does not define',
    "- [ ] AC5: `model.overrides.<role>` replaces a cell's model and leaves its",
    '      effort unchanged; no cell at any level holds `fable`; and',
    "      `cad-executor`'s model comes from its own cells (sonnet / opus / opus)",
    '      rather than from a tier lookup',
    "- [ ] AC6: A config whose `review.triggers.<t>.gate` disagrees with the level's",
    '      gate resolves to the CONFIG value and emits one warning naming the',
    '      trigger, the config value and the level value',
    '- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` exits 0,',
    '      `npx tsc -p tsconfig.ci.json` exits 0, and',
    '      `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no budget',
    '      overage and no `unknown-config-key`',
    '',
    '## Flagged assumptions',
  ].join('\n'),
  // Phase 4
  [
    '## Acceptance criteria',
    '',
    '- [ ] AC1: With `stakes: "solo"` in every config layer,',
    '      `node cadence-core/bin/route.mjs resolve --role <r> --phase <N>` against a',
    '      phase whose PLAN `files:` matches a `surfaces` row returns',
    '      `stakes: "critical"` and that row\'s `model`, `effort`, `review` and',
    '      `verify`, and the `reason` array carries an entry naming the matched',
    '      surface and the path that matched it; the same resolve with no `--phase`',
    '      flag, against a STATE cursor pointing at that phase, returns the identical',
    '      bundle',
    '- [ ] AC2: The floor is absent in every non-detecting state and never blocks - a',
    '      phase whose PLAN `files:` match no surface row, a phase with no PLAN file,',
    '      and a resolve with neither `--phase` nor a cursor all return the baseline',
    "      level's bundle with `ok:true` and no floor entry in `reason`; a PLAN",
    '      present but unreadable returns the same baseline bundle plus one warning',
    '      naming the file',
    '- [ ] AC3: With `stakes: "critical"` configured and a detected surface whose row',
    '      floors below critical, resolve returns `critical` with no override set and',
    '      no refusal - the floor raises and never caps',
    '- [ ] AC4: With `stakes: "solo"` and a phase detecting two surfaces, setting',
    '      `risk.override.<first>` alone still resolves `critical`; setting both',
    '      resolves `solo` with the `reason` array naming each waived surface; and',
    '      `node cadence-core/bin/config.mjs set risk.override.<not-a-surface> true`',
    '      is refused with a message listing the accepted surface names',
    '- [ ] AC5: `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming the',
    '      offending row for each of four classes - a surface whose `floor` is not a',
    '      stakes level, a surface row with an empty pattern list, a surface in',
    '      `route-table.json` with no `risk.override.<surface>` schema key, and a',
    '      `risk.override.<surface>` schema key naming no surface row',
    '- [ ] AC6: A config `review.triggers.<t>.gate` outside',
    '      `off|advisory|blocking|adjudicated`, or not a string, no longer reaches the',
    "      bundle - `resolve` returns the LEVEL's gate for that trigger plus one",
    '      warning naming the rejected value, verified with `{"gate":"blockign"}` on',
    '      `risk_surface` at `critical`, which today resolves `ok:true` carrying',
    '      `"blockign"`',
    '- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` exits 0,',
    '      `npx tsc -p tsconfig.ci.json` exits 0, and',
    '      `node cadence-core/bin/self-verify.mjs` reports `ok:true` with `--phase`',
    '      accepted in the `route.mjs` CONTRACTS entry, no budget overage and no',
    '      `unknown-config-key`',
    '',
    '## Flagged assumptions',
  ].join('\n'),
];

test('classifyAcceptanceCriteria: phases 1-4 of this repo read AC1-AC7 with no issues', () => {
  for (const [i, text] of V200_CRITERIA_SECTIONS.entries()) {
    const res = classifyAcceptanceCriteria(text);
    assert.deepEqual(res.criteria.map((c) => c.id),
      ['AC1', 'AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7'], `phase ${i + 1} ids`);
    assert.deepEqual(res.issues, [], `phase ${i + 1} issues`);
  }
});

// The admission test `audit` asks before an `## Active` id may break the
// verdict. Anchored on purpose - `REQ_ID_TOKEN` beside it is unanchored because
// it SCANS prose; conflating the two is what let `Note` and `AUD-01:` in.
test('isRequirementId: the whole string and nothing else, in both shipped spellings', () => {
  for (const yes of ['AUD-01', 'GRM-01', 'AB-1', 'ABCDEFGH-12', '#41', 'A11Y-01']) {
    assert.equal(isRequirementId(yes), true, yes);
  }
  // `2FA-01`/`3DS-02`: the category's FIRST character must be a letter, though
  // digits are admitted after it (`A11Y-01` passes). A stated limit, not an
  // oversight - `REQ_ID_TOKEN` scans arbitrary prose, where a digit-leading
  // category would make every date (`2026-07-28`) an id token.
  for (const no of ['Note', 'AUD-01:', 'AUD-01 (the gate)', 'aud-01', 'A-01', 'ABCDEFGHI-1',
    'AUD-01 ', '#41.', 'see AUD-01', '', '2FA-01', '3DS-02']) {
    assert.equal(isRequirementId(no), false, no);
  }
});

test('classifyActiveSection: the v1.3.1 table issues carry their exact line, code and text', () => {
  assert.deepEqual(classifyActiveSection(activeDoc(V131_TABLE)).issues, [
    { line: 7, code: 'active-table-row', text: '| TRI-01 (triage every open bug) | v1.3.1 |' },
    { line: 8, code: 'active-table-row', text: '| FIX-01 (each accepted bug fixed) | v1.3.1 |' },
  ]);
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
