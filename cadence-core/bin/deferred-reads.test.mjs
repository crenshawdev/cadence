// Zero-dep tests for lib/deferred-reads.mjs - the deferred-read register and
// its region grammar as a pure function. Run:
//   node --test cadence-core/bin/deferred-reads.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// self-verify.test.mjs already owns the four SHIPPED rows and the CLI wiring.
// This file owns the grammar and the row shape: the surfaces a row may anchor
// against (workflow files, contract skills), the labels those surfaces produce,
// and the falsifiers proving a Read sentence in the wrong region never answers
// for the right one. Every fixture is a `cpSync` byte-copy of a REAL shipped
// surface, because a synthetic file proves the rule against prose that no one
// has to keep true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deferredReadIssues, regionLabels, DEFERRED_READS, CODES,
} from './lib/deferred-reads.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** One Read sentence for a reference, in the shape the rule wants. */
const readSentence = (ref) =>
  `Read \`\${CLAUDE_PLUGIN_ROOT}/cadence-core/${ref}\` at this step, not preloaded.`;

/** An empty temp root. */
function emptyRoot() {
  return mkdtempSync(join(tmpdir(), 'cad-deferred-'));
}

/**
 * Copy a real shipped file into a fixture root at the SAME root-relative path,
 * optionally transforming its text on the way in.
 * @param {string} root @param {string} rel @param {(t: string) => string} [edit]
 */
function copyReal(root, rel, edit = (t) => t) {
  const src = join(REPO, ...rel.split('/'));
  const dst = join(root, ...rel.split('/'));
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  const text = readFileSync(dst, 'utf8');
  const edited = edit(text);
  if (edited !== text) writeFileSync(dst, edited);
  return edited;
}

// --- the register itself ------------------------------------------------------
// The phase-wide claim "the four existing register rows are unchanged
// byte-for-byte" is asserted HERE, on the source text, because
// `DEFERRED_READS.length === 4` alone passes an edited, reordered or retargeted
// row. A `git diff` cannot stand in for it: this file legitimately changes in
// the same commits, and `git diff` exits 0 whether or not it prints anything.

/** The register block as it must appear in the lib source, byte for byte. */
const REGISTER_SOURCE = `export const DEFERRED_READS = Object.freeze([
  Object.freeze({
    skill: 'cad-land',
    reference: 'references/review-triggers.md',
    anchors: Object.freeze(['3']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    // ONE consult site under seams.md's rule (step 4a or step 4b, never both),
    // but TWO anchors here - each arm carries its own Read and deleting either
    // silently loses that arm's rails.
    skill: 'cad-land',
    reference: 'references/git-publish.md',
    anchors: Object.freeze(['4(a)', '4(b)']),
    read_paragraphs: 2,
  }),
  Object.freeze({
    skill: 'cad-land',
    reference: 'references/triage-gate.md',
    anchors: Object.freeze(['3']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-plan-review',
    reference: 'references/review-triggers.md',
    anchors: Object.freeze(['2']),
    read_paragraphs: 1,
  }),
]);`;

test('register: the four shipped rows are byte-identical in source', () => {
  const src = readFileSync(join(HERE, 'lib', 'deferred-reads.mjs'), 'utf8');
  const start = src.indexOf('export const DEFERRED_READS');
  assert.ok(start >= 0, 'the register export must be findable by name');
  const end = src.indexOf(']);', start);
  assert.ok(end > start, 'the register export must close with `]);`');
  assert.equal(src.slice(start, end + 3), REGISTER_SOURCE);
  assert.equal(DEFERRED_READS.length, 4);
});

// --- AC3: a contract skill's own step ------------------------------------------
// D-07: covering contract skills needs no new code path, because the exclusion
// was a header paragraph and never a branch. The proof is a real contract file.

const CONTRACT = 'skills/cad-executor-contract/SKILL.md';
const STEP_4 = '4. Commit per the commit protocol below.';
const SEAMS = 'references/seams.md';

/** The contract copied in, with the Read sentence at the END of `<process>` step 3. */
function contractRoot({ withRead }) {
  const root = emptyRoot();
  copyReal(root, CONTRACT, (t) => (withRead
    ? t.replace(`\n${STEP_4}`, `\n${readSentence(SEAMS)}\n${STEP_4}`)
    : t));
  return root;
}

/** A register row anchored inside the contract skill. */
const contractRow = (anchors) => ({
  skill: 'cad-executor-contract',
  reference: SEAMS,
  anchors,
  read_paragraphs: anchors.length,
});

test('AC3: a contract skill anchor is clean while its Read sentence stands', () => {
  // Guard the fixture itself: if the insertion did not land, the "clean" arm
  // below would be measuring an unedited file.
  const root = contractRoot({ withRead: true });
  const text = readFileSync(join(root, ...CONTRACT.split('/')), 'utf8');
  assert.ok(text.includes(readSentence(SEAMS)), 'fixture must carry the inserted sentence');
  assert.deepEqual(deferredReadIssues(root, [contractRow(['3'])]), []);
});

test('AC3: deleting that one sentence reports exactly one deferred-read-unread', () => {
  const root = contractRoot({ withRead: false });
  const issues = deferredReadIssues(root, [contractRow(['3'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.equal(issues[0].file, CONTRACT);
  assert.match(issues[0].detail, /step\(s\) 3 /);
  assert.match(issues[0].detail, /references\/seams\.md/);
});

test('AC3: the sentence in the WRONG step of the contract does not answer for step 3', () => {
  // Same file, same sentence, same count - only the region changed. That is the
  // whole rule, restated on a contract surface rather than a command one.
  const root = emptyRoot();
  copyReal(root, CONTRACT, (t) =>
    t.replace('\n5. Record the short hash for your report.',
      `\n${readSentence(SEAMS)}\n5. Record the short hash for your report.`));
  const issues = deferredReadIssues(root, [contractRow(['3'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
});

// --- a row's `file` and how it degrades ----------------------------------------
// D-06: the same partial-fixture degradation the skills level already uses, one
// level down. A root that simply lacks the branch is a fixture, not a break.

/** A row anchored in a workflow file rather than in its own SKILL.md. */
const workflowRow = {
  skill: 'cad-executor-contract',
  reference: SEAMS,
  anchors: ['locate'],
  read_paragraphs: 1,
  file: 'cadence-core/workflows/execute.md',
};

test('file: an absent PARENT directory is a partial fixture and reports nothing', () => {
  const root = emptyRoot();
  copyReal(root, CONTRACT);
  assert.deepEqual(deferredReadIssues(root, [workflowRow]), []);
});

test('file: a present parent with the file absent is one deferred-read-missing-file', () => {
  const root = emptyRoot();
  copyReal(root, CONTRACT);
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  const issues = deferredReadIssues(root, [workflowRow]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.missingFile]);
  assert.equal(issues[0].file, 'cadence-core/workflows/execute.md');
  assert.match(issues[0].detail, /cad-executor-contract/);
  assert.match(issues[0].detail, /references\/seams\.md/);
});

// --- the four shipped rows still denote the regions they always denoted -------
// A direct snapshot rather than an inference from absence. The "relocated
// ELSEWHERE", "wrong STEP" and "deleting the ARM" tests in self-verify.test.mjs
// only establish that SOME qualifying Read is still found; they cannot see an
// old anchor starting to denote a DIFFERENT region while another sentence
// happens to satisfy it. This rewrite turned plain tags from transparent into
// labelled frames and resets item/arm state on every open AND close, so that is
// exactly the drift worth pinning.

test('grammar: every shipped row\'s Read line still carries that row\'s anchor', () => {
  for (const row of DEFERRED_READS) {
    const rel = row.file || `skills/${row.skill}/SKILL.md`;
    const text = readFileSync(join(REPO, ...rel.split('/')), 'utf8');
    const labelOf = regionLabels(text);
    const full = `\${CLAUDE_PLUGIN_ROOT}/cadence-core/${row.reference}`;
    const found = text.split('\n')
      .map((line, i) => (line.includes(full) ? labelOf(i) : null))
      .filter((l) => l !== null)
      .sort();
    assert.deepEqual(found, [...row.anchors].sort(),
      `${rel} / ${row.reference}: every line naming the path must sit in one of the row's anchored regions`);
  }
});

// --- AC1/AC4: a named step in a real workflow ---------------------------------

const EXECUTE_WF = 'cadence-core/workflows/execute.md';
const PARALLEL_OPEN = '<step name="execute_parallel">';
const PARALLEL_ITEM_2 = '\n2. Wait for every executor in the batch (same timeout).';

/**
 * `skills/cad-execute/SKILL.md` plus `workflows/execute.md`, with one Read
 * sentence placed either in the `execute_parallel` step body (before its first
 * numbered item), inside its item 1, or nowhere.
 * @param {'body'|'item1'|'none'} where
 */
function executeRoot(where) {
  const root = emptyRoot();
  copyReal(root, 'skills/cad-execute/SKILL.md');
  copyReal(root, EXECUTE_WF, (t) => {
    if (where === 'body') {
      return t.replace(PARALLEL_OPEN, `${PARALLEL_OPEN}\n${readSentence(SEAMS)}`);
    }
    if (where === 'item1') {
      return t.replace(PARALLEL_ITEM_2, `\n${readSentence(SEAMS)}${PARALLEL_ITEM_2}`);
    }
    return t;
  });
  return root;
}

/** A register row anchored in `workflows/execute.md`. */
const executeRow = (anchors) => ({
  skill: 'cad-execute',
  reference: SEAMS,
  anchors,
  read_paragraphs: anchors.length,
  file: EXECUTE_WF,
});

test('AC1: a <step name="..."> anchor is clean while its Read sentence stands', () => {
  const root = executeRoot('body');
  const text = readFileSync(join(root, ...EXECUTE_WF.split('/')), 'utf8');
  assert.ok(text.includes(readSentence(SEAMS)), 'fixture must carry the inserted sentence');
  assert.deepEqual(deferredReadIssues(root, [executeRow(['execute_parallel'])]), []);
});

test('AC1: deleting that sentence reports exactly one deferred-read-unread', () => {
  const issues = deferredReadIssues(executeRoot('none'), [executeRow(['execute_parallel'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.equal(issues[0].file, EXECUTE_WF);
  assert.match(issues[0].detail, /execute_parallel/);
});

test('AC4: a Read in item 1 of a named step does not satisfy item 6 of the same step', () => {
  // The nested-label precedence rule. `execute.md:343-402` puts `1.`-`6.` at
  // column 0 INSIDE `execute_parallel`; bare numbers there would let this
  // sentence answer for any `6` anywhere in the file.
  const root = executeRoot('item1');
  const issues = deferredReadIssues(root, [executeRow(['execute_parallel(6)'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.match(issues[0].detail, /execute_parallel\(6\)/);
  // And the sentence really is where the fixture put it - otherwise the
  // falsifier above would be passing on a sentence that landed nowhere.
  assert.deepEqual(deferredReadIssues(root, [executeRow(['execute_parallel(1)'])]), []);
});

test('AC4: the named step is not a PREFIX match for its own numbered items', () => {
  // `execute_parallel` and `execute_parallel(1)` are distinct regions, the same
  // way `4` and `4(a)` always were.
  const issues = deferredReadIssues(executeRoot('item1'), [executeRow(['execute_parallel'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
});

test('D-04: a <step name="..."> with NO <process> wrapper is still a region', () => {
  // `workflows/verify-deep.md` carries three `<step name=` tags and no wrapper.
  // Requiring the wrapper would leave a second unwatchable file behind.
  const wf = 'cadence-core/workflows/verify-deep.md';
  const row = (anchors) => ({
    skill: 'cad-verify', reference: SEAMS, anchors, read_paragraphs: 1, file: wf,
  });
  const mk = (withRead) => {
    const root = emptyRoot();
    copyReal(root, 'skills/cad-verify/SKILL.md');
    copyReal(root, wf, (t) => (withRead
      ? t.replace('<step name="merge">', `<step name="merge">\n${readSentence(SEAMS)}`)
      : t));
    return root;
  };
  assert.deepEqual(deferredReadIssues(mk(true), [row(['merge'])]), []);
  const issues = deferredReadIssues(mk(false), [row(['merge'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.match(issues[0].detail, /merge/);
  // A sibling step is a different region, not a looser one.
  assert.deepEqual(deferredReadIssues(mk(true), [row(['dispatch'])]).map((i) => i.kind),
    [CODES.unread]);
});

// --- D-07: the real uncovered spot is a plain tag block -----------------------
// `<worktree_mode>` carries no numbered step and no `name=` attribute, so
// nothing but a tag-name label reaches it - and ROADMAP phase 3 criterion 3
// moves exactly that block. A `<process>`-step pair alone would pass against an
// implementation that never grew the plain-tag branch at all.

test('D-07: a Read inside <worktree_mode> is anchorable at `worktree_mode`', () => {
  const root = emptyRoot();
  copyReal(root, CONTRACT, (t) =>
    t.replace('<worktree_mode>', `<worktree_mode>\n${readSentence(SEAMS)}`));
  assert.deepEqual(deferredReadIssues(root, [contractRow(['worktree_mode'])]), []);
});

test('D-07: deleting it reports one deferred-read-unread naming worktree_mode', () => {
  const root = emptyRoot();
  copyReal(root, CONTRACT);
  const issues = deferredReadIssues(root, [contractRow(['worktree_mode'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.match(issues[0].detail, /worktree_mode/);
});

test('D-07: label EXACTNESS, not null-ness, is what blocks a relocation', () => {
  // The cost of labelling plain tags: `<guardrails>` stops being `null`. The
  // relocation attack the shipped tests pin still fails, because `guardrails`
  // is not `worktree_mode`.
  const root = emptyRoot();
  copyReal(root, CONTRACT, (t) =>
    t.replace('<never>', `<never>\n${readSentence(SEAMS)}`));
  const issues = deferredReadIssues(root, [contractRow(['worktree_mode'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  // ... and the sentence is genuinely inside `<never>`, so the falsifier is
  // about the REGION and not about a sentence that failed to land.
  assert.deepEqual(deferredReadIssues(root, [contractRow(['never'])]), []);
});

test('grammar: a nested close does not switch the enclosing frame off', () => {
  // `execute.md:13` opens `<process>`, `:15` opens `<step name="locate">` and
  // `:47` closes the step. With the old scalars that close cleared `<process>`
  // for the rest of the file, so every later step went regionless and the whole
  // workflow yielded zero labelled lines.
  const text = readFileSync(join(REPO, ...EXECUTE_WF.split('/')), 'utf8');
  const labelOf = regionLabels(text);
  const labels = new Set(text.split('\n').map((_, i) => labelOf(i)));
  for (const name of ['locate', 'git_guard', 'choose_path', 'execute_parallel', 'done']) {
    assert.ok(labels.has(name), `${name} must be a labelled region`);
  }
  assert.ok(labels.has('execute_parallel(6)'), 'nested items take nested labels');
  assert.ok(!labels.has('6'), 'a nested item must never take a bare number');
});

test('grammar: a numbered item with an EMPTY frame stack stays regionless', () => {
  // Without this clause a column-0 `1.` outside every block would newly label
  // bare `1`, and a bare number outside `<process>` can collide with a live
  // anchor - `cad-land` anchors at `3` and `4(a)`, `cad-plan-review` at `2`.
  const labelOf = regionLabels('preamble\n\n1. A step with no block around it.\n');
  assert.equal(labelOf(2), null);
  // Inside `<process>` the same line is the bare label the shipped rows use.
  const inProcess = regionLabels('<process>\n1. A step.\n</process>\n');
  assert.equal(inProcess(1), '1');
});

test('file: still-eager watches the SKILL.md even when the anchor is a workflow', () => {
  // D-05. The `@`-include line always lives in the SKILL.md, so `skill` stays
  // the target of this arm whatever `file` says - a workflow-anchored row that
  // stopped watching for re-promotion would lose half of what check 13 does.
  const root = emptyRoot();
  copyReal(root, CONTRACT, (t) =>
    `@\${CLAUDE_PLUGIN_ROOT}/cadence-core/${SEAMS}\n${t}`);
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  copyReal(root, 'cadence-core/workflows/execute.md');
  const kinds = deferredReadIssues(root, [workflowRow]).map((i) => i.kind);
  assert.ok(kinds.includes(CODES.stillEager), JSON.stringify(kinds));
  assert.equal(deferredReadIssues(root, [workflowRow])
    .find((i) => i.kind === CODES.stillEager).file, CONTRACT);
});
