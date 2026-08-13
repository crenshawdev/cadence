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
  Object.freeze({
    skill: 'cad-context',
    reference: 'templates/CONTEXT.md',
    anchors: Object.freeze(['write_context']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/context.md',
  }),
  Object.freeze({
    // TWO rows, one reference. seams.md's "consulted at more than one distinct
    // STEP stays eager" rule is per COMMAND: \`/cad-context\` and \`/cad-debug\`
    // each reach recall at exactly one step of their own, so these are two
    // independent one-site deferrals rather than one two-site reference. A
    // maintainer who merges them into a single row loses one command's anchor.
    skill: 'cad-context',
    reference: 'references/recall.md',
    // Anchored at \`spend_gate\`, not \`analyze\`: the recall substep moved ahead of
    // the analyzer buy/skip decision because BOTH of its arms consume recalled
    // memory, and the skip arm never enters \`analyze\` at all.
    anchors: Object.freeze(['spend_gate']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/context.md',
  }),
  Object.freeze({
    skill: 'cad-debug',
    reference: 'references/recall.md',
    anchors: Object.freeze(['The method loop/1']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/debug.md',
  }),
  Object.freeze({
    skill: 'cad-execute',
    reference: 'references/execute-parallel.md',
    anchors: Object.freeze(['execute_parallel']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/execute.md',
  }),
  Object.freeze({
    skill: 'cad-executor-contract',
    reference: 'references/worktree-executor.md',
    anchors: Object.freeze(['worktree_mode']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-executor-contract',
    reference: 'references/lean-build.md',
    anchors: Object.freeze(['1']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-plan',
    reference: 'references/plan-revision.md',
    anchors: Object.freeze(['check_gate']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/plan.md',
  }),
  Object.freeze({
    skill: 'cad-config',
    reference: 'references/config-catalog.md',
    anchors: Object.freeze(['Interactive menu (no args)/The walk/2']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/config.md',
  }),
]);`;

test('register: the original four rows are byte-identical, and the register is exactly the rows the cuts made', () => {
  // Two claims in one assertion, because the byte-exact literal carries both:
  // the four rows the v2.5.0 cuts made are untouched, in order, and every row
  // added since is one this repo's own prose moves account for. A length check
  // alone passes an edited, reordered or retargeted row.
  const src = readFileSync(join(HERE, 'lib', 'deferred-reads.mjs'), 'utf8');
  const start = src.indexOf('export const DEFERRED_READS');
  assert.ok(start >= 0, 'the register export must be findable by name');
  const end = src.indexOf(']);', start);
  assert.ok(end > start, 'the register export must close with `]);`');
  assert.equal(src.slice(start, end + 3), REGISTER_SOURCE);
  assert.equal(DEFERRED_READS.length, 12);
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
// `git_guard`, not `execute_parallel`: that step's numbered body moved to
// `references/execute-parallel.md`, so its item needles no longer exist and a
// fixture built on them would silently no-op against an unedited file. The
// grammar under test is unchanged - a named step whose column-0 items take
// nested labels - and `git_guard` is the surviving instance of it.
const GUARD_OPEN = '<step name="git_guard">';
const GUARD_ITEM_2 = "\n2. Commit it now as the user's own commit, message theirs, then continue";

/**
 * `skills/cad-execute/SKILL.md` plus `workflows/execute.md`, with one Read
 * sentence placed either in the `git_guard` step body (before its first
 * numbered item), inside its item 1, or nowhere.
 * @param {'body'|'item1'|'none'} where
 */
function executeRoot(where) {
  const root = emptyRoot();
  copyReal(root, 'skills/cad-execute/SKILL.md');
  copyReal(root, EXECUTE_WF, (t) => {
    if (where === 'body') {
      return t.replace(GUARD_OPEN, `${GUARD_OPEN}\n${readSentence(SEAMS)}`);
    }
    if (where === 'item1') {
      return t.replace(GUARD_ITEM_2, `\n${readSentence(SEAMS)}${GUARD_ITEM_2}`);
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
  assert.deepEqual(deferredReadIssues(root, [executeRow(['git_guard'])]), []);
});

test('AC1: deleting that sentence reports exactly one deferred-read-unread', () => {
  const issues = deferredReadIssues(executeRoot('none'), [executeRow(['git_guard'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.equal(issues[0].file, EXECUTE_WF);
  assert.match(issues[0].detail, /git_guard/);
});

test('AC4: a Read in item 1 of a named step does not satisfy item 3 of the same step', () => {
  // The nested-label precedence rule. `git_guard` puts `1.`-`3.` at column 0
  // inside a named step; bare numbers there would let this sentence answer for
  // any `3` anywhere in the file - and `cad-land` really does anchor at `3`.
  const root = executeRoot('item1');
  const issues = deferredReadIssues(root, [executeRow(['git_guard(3)'])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.match(issues[0].detail, /git_guard\(3\)/);
  // And the sentence really is where the fixture put it - otherwise the
  // falsifier above would be passing on a sentence that landed nowhere.
  assert.deepEqual(deferredReadIssues(root, [executeRow(['git_guard(1)'])]), []);
});

test('AC4: the named step is not a PREFIX match for its own numbered items', () => {
  // `git_guard` and `git_guard(1)` are distinct regions, the same way `4` and
  // `4(a)` always were.
  const issues = deferredReadIssues(executeRoot('item1'), [executeRow(['git_guard'])]);
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

// --- AC2: a heading-scoped walk step in a tagless workflow --------------------
// `workflows/config.md` has zero `<process>` and zero `<step name=`, and
// `debug.md` and `phase.md` are the same style. Without the heading family the
// largest single move phase 3 declares - `config.md:71-133`, 8,052 B - would
// ship with no anchorable region at all.

const CONFIG_WF = 'cadence-core/workflows/config.md';
const WALK_STEP_3 = '\n3. A page whose knobs the user leaves unchanged is a no-op;';
const WALK_STEP_2 = '\n2. Walk the catalog **in order, 4 knobs per';
const DIRECT_SET = '## Direct set\n';
const WALK_ANCHOR = 'Interactive menu (no args)/The walk/2';

/**
 * `skills/cad-config/SKILL.md` plus `workflows/config.md`, with one Read
 * sentence placed at the end of the Interactive-menu walk's step 2, at the end
 * of its step 1, under `## Direct set`, or nowhere.
 * @param {'step2'|'step1'|'direct'|'none'} where
 */
function configRoot(where) {
  const root = emptyRoot();
  copyReal(root, 'skills/cad-config/SKILL.md');
  copyReal(root, CONFIG_WF, (t) => {
    const s = readSentence(SEAMS);
    if (where === 'step2') return t.replace(WALK_STEP_3, `\n${s}${WALK_STEP_3}`);
    if (where === 'step1') return t.replace(WALK_STEP_2, `\n${s}${WALK_STEP_2}`);
    if (where === 'direct') return t.replace(DIRECT_SET, `${DIRECT_SET}\n${s}\n`);
    return t;
  });
  return root;
}

/** A register row anchored in `workflows/config.md`. */
const configRow = (anchors) => ({
  skill: 'cad-config',
  reference: SEAMS,
  anchors,
  read_paragraphs: anchors.length,
  file: CONFIG_WF,
});

test('AC2: a heading-scoped walk step is clean while its Read sentence stands', () => {
  const root = configRoot('step2');
  const text = readFileSync(join(root, ...CONFIG_WF.split('/')), 'utf8');
  assert.ok(text.includes(readSentence(SEAMS)), 'fixture must carry the inserted sentence');
  assert.deepEqual(deferredReadIssues(root, [configRow([WALK_ANCHOR])]), []);
});

test('AC2: deleting it reports exactly one deferred-read-unread naming the walk step', () => {
  const issues = deferredReadIssues(configRoot('none'), [configRow([WALK_ANCHOR])]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.equal(issues[0].file, CONFIG_WF);
  assert.match(issues[0].detail, /Interactive menu \(no args\)\/The walk\/2/);
});

test('AC2: the same sentence in walk step 1 does not answer for walk step 2', () => {
  const root = configRoot('step1');
  assert.deepEqual(deferredReadIssues(root, [configRow([WALK_ANCHOR])]).map((i) => i.kind),
    [CODES.unread]);
  // ... and it really did land in step 1, so the falsifier is about the region.
  assert.deepEqual(
    deferredReadIssues(root, [configRow(['Interactive menu (no args)/The walk/1'])]), []);
});

test('AC2: the same sentence under another `##` heading does not answer either', () => {
  const root = configRoot('direct');
  assert.deepEqual(deferredReadIssues(root, [configRow([WALK_ANCHOR])]).map((i) => i.kind),
    [CODES.unread]);
  assert.deepEqual(deferredReadIssues(root, [configRow(['Direct set'])]), []);
});

test('grammar: a heading path truncates, and a new heading ends the old numbering', () => {
  const labelOf = regionLabels([
    '# Title',                 // 0 - H1, ignored
    '## Alpha',                // 1
    'under alpha',             // 2
    '### Beta',                // 3
    '1. first',                // 4
    'still first',             // 5
    '## Gamma',                // 6 - replaces the whole path
    'under gamma',             // 7
  ].join('\n'));
  assert.equal(labelOf(0), null, 'an H1 is the document title, never a path segment');
  assert.equal(labelOf(2), 'Alpha');
  assert.equal(labelOf(4), 'Alpha/Beta/1');
  assert.equal(labelOf(5), 'Alpha/Beta/1');
  assert.equal(labelOf(7), 'Gamma', 'a level-2 replaces the path and clears the item');
});

test('grammar: a heading INSIDE an open block does not compete with the frame', () => {
  const labelOf = regionLabels([
    '## Alpha',        // 0
    '<process>',       // 1
    '## Beta',         // 2 - inside a block: ignored entirely
    '3. third',        // 3
    '</process>',      // 4
    'after',           // 5
  ].join('\n'));
  assert.equal(labelOf(3), '3', 'block frames win over headings');
  assert.equal(labelOf(5), 'Alpha', 'and the in-block heading never touched the path');
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
  assert.ok(labels.has('git_guard(3)'), 'nested items take nested labels');
  assert.ok(!labels.has('3'), 'a nested item must never take a bare number');
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

// --- AC4: every PROMOTED row, falsified against its real surface -------------
// A promoted row (lib/deferred-reads.mjs, "TWO KINDS OF ROW") has no
// `stillEager` arm to protect it - the anchor is all there is - so each one is
// falsified here against the SHIPPED row and the REAL surface it anchors in,
// never a synthetic copy. The fixture deletes the sentence by the reference PATH
// rather than by a quoted literal, so a reworded Read cannot make the deletion
// silently no-op and leave the falsifier passing against an unedited file.

/** The shipped register row for a `{skill, reference}` pair. */
function shippedRow(skill, reference) {
  const row = DEFERRED_READS.find((r) => r.skill === skill && r.reference === reference);
  assert.ok(row, `no shipped register row for ${skill} / ${reference}`);
  return row;
}

/**
 * `text` with the one sentence naming `full` removed, sentence-split exactly as
 * the rule splits, separators preserved so the rest of the file is untouched.
 * Asserts it removed exactly one: zero means the fixture no-op'd, more than one
 * means the deletion is not the single-sentence falsifier it claims to be.
 */
function stripReadSentence(text, full) {
  const parts = text.split(/((?<=[.!?])\s+)/);
  const kept = [];
  let removed = 0;
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i].includes(full)) { removed += 1; continue; }
    kept.push(parts[i], parts[i + 1] ?? '');
  }
  assert.equal(removed, 1, `expected exactly one sentence naming ${full}`);
  return kept.join('');
}

/** The real surfaces a shipped row needs, with its Read sentence kept or cut. */
function rowRoot(row, { withRead }) {
  const root = emptyRoot();
  const skillRel = `skills/${row.skill}/SKILL.md`;
  const rel = row.file || skillRel;
  const full = `\${CLAUDE_PLUGIN_ROOT}/cadence-core/${row.reference}`;
  const edit = (t) => (withRead ? t : stripReadSentence(t, full));
  if (rel !== skillRel) copyReal(root, skillRel);
  copyReal(root, rel, edit);
  return root;
}

/**
 * Both halves of one promoted row's falsifier: the real tree is clean, and the
 * same tree minus that one sentence is exactly one `deferred-read-unread`.
 */
function assertPromotedRow(skill, reference, anchor) {
  const row = shippedRow(skill, reference);
  const rel = row.file || `skills/${row.skill}/SKILL.md`;
  assert.deepEqual(deferredReadIssues(rowRoot(row, { withRead: true }), [row]), [],
    `${rel} must satisfy ${reference} as shipped`);
  const issues = deferredReadIssues(rowRoot(row, { withRead: false }), [row]);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.unread]);
  assert.equal(issues[0].file, rel);
  assert.match(issues[0].detail, new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('AC4: cad-context / templates/CONTEXT.md is unread without its one sentence', () => {
  assertPromotedRow('cad-context', 'templates/CONTEXT.md', 'write_context');
});

test('AC4: cad-context / references/recall.md is unread without its one sentence', () => {
  assertPromotedRow('cad-context', 'references/recall.md', 'spend_gate');
});

test('AC4: cad-debug / references/recall.md is unread without its one sentence', () => {
  // The other half of the per-COMMAND site rule: one reference, two rows, and
  // each command's anchor falsified on its own. If these were merged into one
  // row, deleting either sentence would still leave the other satisfying it.
  assertPromotedRow('cad-debug', 'references/recall.md', 'The method loop/1');
});

test('AC4: cad-execute / references/execute-parallel.md is unread without its one sentence', () => {
  assertPromotedRow('cad-execute', 'references/execute-parallel.md', 'execute_parallel');
});

test('AC4: cad-executor-contract / references/worktree-executor.md is unread without its one sentence', () => {
  // The first row on a `user-invocable: false` skill, anchored on the row's
  // DEFAULT `file` - the contract's own SKILL.md, no `file` field at all.
  assertPromotedRow('cad-executor-contract', 'references/worktree-executor.md', 'worktree_mode');
});

test('AC4: cad-plan / references/plan-revision.md is unread without its one sentence', () => {
  // Anchored at the WHOLE step `check_gate`: the revision's `1.`/`2.`/`3.` are
  // indented four spaces and take no item label, so `check_gate(1)` names no
  // region at all. Coarse, and stated as such in the phase's D-08.
  assertPromotedRow('cad-plan', 'references/plan-revision.md', 'check_gate');
});

test('AC4: cad-config / references/config-catalog.md is unread without its one sentence', () => {
  // The anchor is the VERBATIM heading path, parenthetical included:
  // `regionLabels` takes heading text with no normalization, so the shorthand
  // `Interactive menu/The walk/2` resolves to no region at all.
  assertPromotedRow('cad-config', 'references/config-catalog.md',
    'Interactive menu (no args)/The walk/2');
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
