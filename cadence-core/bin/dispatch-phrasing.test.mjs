// Zero-dep tests for lib/dispatch-phrasing.mjs (the `unbatched-dispatch` rule).
// One test per arm of the rule, each title naming the arm it pins. Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchPhrasingIssues } from './lib/dispatch-phrasing.mjs';

test('the exact sentence #88 filed is one issue, and the detail carries its line', () => {
  const text = 'Some prose.\n\n### 4. Run the reviewers\n'
    + 'For each reviewer in the set, in parallel where the host allows:\n';
  const issues = dispatchPhrasingIssues(text);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'unbatched-dispatch');
  // The block starts at the heading, which is the line a maintainer opens.
  assert.match(issues[0].detail, /^line 3: /);
  assert.match(issues[0].detail, /where the host allows/);
});

test('the batch-shaped rewrite that replaced it yields nothing', () => {
  const text = '### 4. Run the reviewers\n'
    + 'Issue the resolved set in ONE message (seams concurrent dispatch);\n'
    + "serialize only when one dispatch consumes another's output, which a\n"
    + 'reviewer set never does. Per backend:\n';
  assert.deepEqual(dispatchPhrasingIssues(text), []);
});

test('a host hedge with no loop head still trips it', () => {
  const issues = dispatchPhrasingIssues('Dispatch the set concurrently if the host supports it.\n');
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /^line 1: /);
});

test('a concurrency word only inside code spans or a fence is not prose', () => {
  const text = 'Bound the fan-out with the max concurrent agents key,\n'
    + 'reading `for each reviewer, in parallel` as the setting name.\n'
    + '\n'
    + '```\n'
    + 'for each reviewer in the set, in parallel where the host allows\n'
    + '```\n';
  assert.deepEqual(dispatchPhrasingIssues(text), []);
});

test('prose that serializes on purpose is legal - no concurrency claim', () => {
  const text = 'For each plan in order: dispatch ONE cad-executor with that\n'
    + "plan's file, and wait for it to finish before the next.\n";
  assert.deepEqual(dispatchPhrasingIssues(text), []);
});

test('a compliant list item does not excuse the next one (block boundary)', () => {
  const text = '- For each reviewer in the set, dispatch them concurrently in one message.\n'
    + '- For every reviewer in the set, dispatch in parallel where the host allows.\n';
  const issues = dispatchPhrasingIssues(text);
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /^line 2: /);
  assert.match(issues[0].detail, /For every reviewer/);
});

test('`in one batch` satisfies the phrasing as well as `in ONE message`', () => {
  assert.deepEqual(
    dispatchPhrasingIssues('For each reviewer, dispatch in parallel, in one batch.\n'), []);
  assert.deepEqual(
    dispatchPhrasingIssues('For each reviewer, dispatch in parallel, in ONE message.\n'), []);
});

test('a non-string input returns [] rather than throwing', () => {
  for (const bad of [undefined, null, 42, {}, ['in parallel for each']]) {
    assert.deepEqual(dispatchPhrasingIssues(bad), []);
  }
});

// --- the widened rule (UAT item 5 / AC5) ------------------------------------
// Everything above pins the rule as first shipped. Everything below pins the
// three arms it grew: a sentence that dispatches a set concurrently without
// saying "in one message" at all, per-SENTENCE evaluation so a compliant
// sentence stops excusing its neighbour, and the segmentation and vocabulary
// that keep the widening at zero cost on the repo's own prose.

test('the eager arm: a bare concurrent set-dispatch with no loop head and no hedge', () => {
  // The UAT reproduction. Neither a serial shape nor a host hedge, so the
  // first-shipped rule returned [] on the exact sentence AC5 describes.
  const issues = dispatchPhrasingIssues('Dispatch each reviewer concurrently.');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].code, 'unbatched-dispatch');
  assert.equal(issues[0].detail, 'line 1: Dispatch each reviewer concurrently.');
});

// workflows/execute.md item 1 as it read BEFORE this phase rewrote it
// (`git show 58ab673^:cadence-core/workflows/execute.md`, lines 185-192): the
// regression this check exists to prevent. Inlined rather than read off disk so
// the row keeps testing the sentence after the file moves again.
const PRE_PHASE_ITEM = '1. In batches of `parallelization.max_concurrent_agents`: dispatch one\n'
  + '   cad-executor per plan, each in its own git worktree on branch\n'
  + '   `cadence/phase-<N>-plan-<k>` (spawn-agent seam, worktree isolation), one\n'
  + '   dispatch per message, in the background. Resolve the route ONCE for\n'
  + '   (cad-executor, attempt 1) and reuse it for every executor in the batch -\n'
  + '   identical role and attempt, so re-resolving per dispatch is wasted (seams.md\n'
  + '   concurrent dispatch). Same prompt as sequential except the mode line:\n'
  + '   "Worktree executor on branch {branch} - worktree rules apply."\n';

// The same item as it reads at HEAD - one sentence changed, nothing else.
const SHIPPED_ITEM = PRE_PHASE_ITEM
  .replace('isolation), one\n   dispatch per message, in the background.',
    'isolation), the\n   whole batch issued in ONE message.');

test('the serialization arm: "one dispatch per message" is named, at its own line', () => {
  // Padded so item 1 sits back at its source line 185, which is what the line
  // map has to reproduce. The detail must BEGIN at the offending sentence -
  // reporting the block start would quote "Resolve the route ONCE" instead,
  // and the phrase that failed sits at character 131 of a 175-character
  // sentence, past the quote length the first-shipped rule used.
  const issues = dispatchPhrasingIssues('\n'.repeat(184) + PRE_PHASE_ITEM);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /^line 185: /);
  assert.match(issues[0].detail, /one dispatch per message/);
  assert.doesNotMatch(issues[0].detail, /Resolve the route ONCE/);
});

test('the batch-affirming vocabulary: the shipped rewrite of that item yields nothing', () => {
  // "reuse it for every executor in the batch" is a second sentence that
  // ELABORATES on a batch the first sentence already stated. Per-sentence
  // evaluation without `in the batch` in the mandated phrasing reports it.
  assert.deepEqual(dispatchPhrasingIssues('\n'.repeat(184) + SHIPPED_ITEM), []);
});

test('a batch affirmation does not excuse a serialization in the same sentence', () => {
  // The regression this whole check exists to prevent, restored INTO the
  // shipped sentence that already names the batch. A `BATCHED` vocabulary that
  // accepts the affirmation as proof returns [] here, so the guard goes blind
  // to the one edit it was built to catch.
  const issues = dispatchPhrasingIssues('\n'.repeat(184) + SHIPPED_ITEM
    .replace('the\n   whole batch issued in ONE message.',
      'the\n   whole batch issued one dispatch per message, in the background.'));
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /one dispatch per message/);
});

test('a batch affirmation does not excuse a host hedge', () => {
  const issues = dispatchPhrasingIssues('For each reviewer in the batch,'
    + ' in parallel where the host allows:');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /^line 1: For each reviewer in the batch/);
});

test('a batch affirmation opening a sentence does not excuse its serialization', () => {
  const issues = dispatchPhrasingIssues('In the batch, dispatch each reviewer'
    + ' concurrently, one dispatch per message.');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /one dispatch per message/);
});

test('an `e.g.` inside a compliant sentence is not a sentence end', () => {
  // `e.g. ` is house style in both scoped directories. Splitting on it strands
  // the mandated phrasing in a fragment the rule never sees, and reports the
  // half that lost it - CI red on correct prose.
  assert.deepEqual(dispatchPhrasingIssues('Dispatch each reviewer in parallel,'
    + ' e.g. all four of them, in one message.'), []);
  assert.deepEqual(dispatchPhrasingIssues('Dispatch each reviewer in parallel,'
    + ' i.e. all of them, in one message.'), []);
});

test('a ``` shown inside a ```` container cannot close it early', () => {
  const text = '````\n```\nFor each reviewer in the set, in parallel where the'
    + ' host allows:\n```\n````\n\nFor every reviewer, dispatch in parallel'
    + ' where the host allows.\n';
  const issues = dispatchPhrasingIssues(text);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /^line 7: /);
});

test('a `~~~ not a closing fence` line is content, not a boundary', () => {
  assert.deepEqual(dispatchPhrasingIssues('~~~\nExample:\n~~~ not a closing fence\n'
    + 'For each reviewer, dispatch in turn, in parallel where the host allows.\n~~~\n'), []);
});

test('an indented ~~~ sample opens no fence, so the rest of the file is still read', () => {
  const issues = dispatchPhrasingIssues('Intro paragraph.\n\n    ~~~\n    some sample\n\n'
    + 'For each reviewer in the set, in parallel where the host allows:\n');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /^line 6: /);
});

test('a compliant sentence no longer excuses a non-compliant one in the same block', () => {
  const issues = dispatchPhrasingIssues('- Dispatch the reviewer set in one message.'
    + ' Then dispatch a verifier per doc, in parallel where the host allows.');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /^line 1: Then dispatch a verifier per doc/);
  assert.doesNotMatch(issues[0].detail, /Dispatch the reviewer set/);
});

test('the line map: an offender on the third line of a block reports line 3', () => {
  const text = 'Some setup prose about the parallel path.\n'
    + 'It continues here with no instruction in it.\n'
    + 'For each reviewer, dispatch in turn.\n';
  const issues = dispatchPhrasingIssues(text);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].detail, 'line 3: For each reviewer, dispatch in turn.');
});

test('a table row is its own block, so two cells never glue into one sentence', () => {
  // Without the pipe boundary the whole table collapses to one block whose
  // masked cells read as a single sentence claiming concurrency, dispatching,
  // and distributing - and two real catalog tables report as instructions.
  const text = '| phase_diff | adjudicated | parallel path only |\n'
    + '| diff | advisory | dispatch each reviewer |\n';
  assert.deepEqual(dispatchPhrasingIssues(text), []);
});

test('a ~~~ fence masks its example, and a nested ``` fence cannot close it early', () => {
  const text = '~~~\n'
    + 'Do not write it this way:\n'
    + '```\n'
    + 'For each reviewer in the set, in parallel where the host allows:\n'
    + '```\n'
    + 'and never hedge on the host per reviewer, in parallel.\n'
    + '~~~\n';
  assert.deepEqual(dispatchPhrasingIssues(text), []);
});

// --- the imperative gate ----------------------------------------------------
// A sentence that ISSUES work reads in the imperative: a bare-form dispatch
// verb in clause-initial position. Rationale, negation, description and catalog
// rows all carry the rule's vocabulary in an inflected or non-initial shape and
// issue nothing, so without this gate a compliant block reports its own reasons.

test('a rationale sentence beside a compliant mandate is not an instruction', () => {
  // The mandate excuses itself by carrying the phrasing; the sentence that
  // EXPLAINS why serializing is wrong carries "one dispatch per message" too.
  assert.deepEqual(dispatchPhrasingIssues('Issue the whole set in ONE message.'
    + ' Serializing it - one dispatch per message - only adds latency on the'
    + ' parallel path.'), []);
});

test('a negation forbidding the serial shape is not an instruction to use it', () => {
  // `never` is not a clause-initial dispatch verb, so a negation excludes
  // itself: the shape it names is the one it rules out.
  assert.deepEqual(dispatchPhrasingIssues('Dispatch all reviewers in one message;'
    + ' never for each reviewer in turn, and never in parallel where the host'
    + ' allows.'), []);
});

test('an inflected dispatch verb describing the parallel path issues nothing', () => {
  // `issues` is a third-person verb here and `all of them` a back-reference;
  // the eager arm read the pair as a fresh concurrent set-dispatch.
  assert.deepEqual(dispatchPhrasingIssues('On the parallel path every worktree'
    + ' issues its own findings, and all of them land in one report.'), []);
});

test('a catalog table row naming the parallel path instructs nothing', () => {
  // Both rows are shaped like `references/review-triggers.md`'s wiring table:
  // a past participle (`sent`, `fired`) and a distributive, no verb in the
  // imperative anywhere.
  assert.deepEqual(dispatchPhrasingIssues('| `phase_diff` | `cad-execute` (parallel'
    + ' path only) | after all worktree batches are sent |'
    + ' `git diff <PHASE_START>..HEAD` | off / off / adjudicated |'), []);
  assert.deepEqual(dispatchPhrasingIssues('| `plan` | `cad-plan` | fired for every'
    + ' plan on the parallel path | adjudicated |'), []);
});

test('a table row that DOES issue the set concurrently is still named', () => {
  // The cost of one row per block is that a row can instruct; a table pipe is
  // a clause opening, so an imperative in a cell still reads as one.
  const issues = dispatchPhrasingIssues(
    '| review.fanout | bool | Dispatch all reviewers in parallel | true |');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /Dispatch all reviewers in parallel/);
});

test('prose that serializes a non-dispatch thing is not this rule\'s business', () => {
  assert.deepEqual(dispatchPhrasingIssues('Parallel workers make one request per'
    + ' second to stay below the rate limit.'), []);
});

test('a semicolon inside a citation is not a sentence end', () => {
  // Splitting at depth 0 only: the citation used to be cut in half, stranding
  // the mandated phrasing in the first fragment and reporting the second.
  assert.deepEqual(dispatchPhrasingIssues('Dispatch the whole provider set in ONE'
    + ' message (conventions.md Parallel work; seams.md concurrent dispatch)'
    + ' - not one at a time, or three full timeouts run back to back.'), []);
});

test('an unclosed bracket swallows no sentence boundary', () => {
  // Only a CLOSED bracket span suppresses a split, so one stray `(` in prose
  // cannot glue a block into a single sentence and let a compliant clause
  // whitewash the offender after it.
  const issues = dispatchPhrasingIssues('- Dispatch the reviewer set (see seams'
    + ' in one message. Then dispatch a verifier per doc, in parallel where the'
    + ' host allows.');
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].detail, /Then dispatch a verifier per doc/);
});
