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
import { deferredReadIssues, DEFERRED_READS, CODES } from './lib/deferred-reads.mjs';

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
