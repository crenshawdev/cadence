// Grammar tests for lib/route-relay.mjs - the rule behind self-verify's
// `unrelayed-route-resolve` check. Run:
// node --test cadence-core/bin/route-relay.test.mjs
//
// ONE test() per grammar row, deliberately: a table asserted inside a single
// test() with a sequential loop reports the loop's count, not the rows', so a
// row that never ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess - the lib is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE, relayIssues } from './lib/route-relay.mjs';

/** The plugin-root invocation form, exactly as a workflow writes it. */
const ISSUE = 'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-verifier';

/** A paragraph that states the rule. */
const RELAY = 'Relay every `warnings[]` entry the resolve returns to the user\n'
  + 'before dispatching, each distinct warning once per run (seams.md).';

test('an issuing file with no relay paragraph is one issue, naming the line', () => {
  const text = `# Step\n\nRun it:\n\n\`\`\`\n${ISSUE}\n\`\`\`\n\nThen continue.\n`;
  const issues = relayIssues(text);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].code, CODE);
  assert.equal(issues[0].code, 'unrelayed-route-resolve'); // the literal, pinned
  assert.match(issues[0].detail, /line 6\b/);              // the 1-based line
});

test('the same text plus the relay paragraph is clean', () => {
  const text = `# Step\n\nRun it:\n\n\`\`\`\n${ISSUE}\n\`\`\`\n\n${RELAY}\n`;
  assert.deepEqual(relayIssues(text), []);
});

test('a file that only MENTIONS the resolve inline issues nothing', () => {
  // references/config-reach.md, workflows/plan.md and workflows/execute.md all
  // name `route.mjs resolve` while issuing nothing; a rule that could not tell
  // those apart would demand a relay rule in a reach table.
  const text = 'The `route.mjs resolve` seam picks the cell (see seams.md).\n\n'
    + 'It is delegated to, never issued here.\n';
  assert.deepEqual(relayIssues(text), []);
});

test('`relay` and `warnings` in DIFFERENT paragraphs do not satisfy each other', () => {
  const text = `\`\`\`\n${ISSUE}\n\`\`\`\n\nRelay what the seam says.\n\n`
    + 'The resolve returns `warnings[]` on a torn layer.\n';
  const issues = relayIssues(text);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].code, CODE);
});

test('a paragraph re-wrapped across lines still states the rule', () => {
  // Whitespace-collapsed before the test, so re-wrapping a sentence is free -
  // a CI failure with no fix a maintainer would think of is worse than no check.
  const text = `\`\`\`\n${ISSUE}\n\`\`\`\n\nRelay\nevery\n\`warnings[]\`\nentry.\n`;
  assert.deepEqual(relayIssues(text), []);
});

test('two issuing sites in one unrelayed file report one entry each', () => {
  const text = `\`\`\`\n${ISSUE}\n\`\`\`\n\nand later\n\n\`\`\`\n${ISSUE}\n\`\`\`\n`;
  const issues = relayIssues(text);
  assert.equal(issues.length, 2, JSON.stringify(issues));
  assert.match(issues[0].detail, /line 2\b/);
  assert.match(issues[1].detail, /line 8\b/);
});

test('a quoted and an unquoted plugin-root path both count as issuing', () => {
  const bare = 'node ${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs resolve --role cad-planner';
  assert.equal(relayIssues(`\`\`\`\n${bare}\n\`\`\`\n`).length, 1);
  assert.equal(relayIssues(`\`\`\`\n${ISSUE}\n\`\`\`\n`).length, 1);
});

test('the brace-less $CLAUDE_PLUGIN_ROOT spelling is an issuing site too', () => {
  // `"$CLAUDE_PLUGIN_ROOT/...route.mjs" resolve` expands to the same real
  // invocation as the ${...} house spelling; a checker keyed to one spelling
  // is a rail a rephrase walks around.
  const bare = 'node "$CLAUDE_PLUGIN_ROOT/cadence-core/bin/route.mjs" resolve --role cad-verifier';
  const text = `# Step\n\n\`\`\`\n${bare}\n\`\`\`\n`;
  const issues = relayIssues(text);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].code, CODE);
});

test('the brace-less spelling plus the relay paragraph is clean', () => {
  const bare = 'node "$CLAUDE_PLUGIN_ROOT/cadence-core/bin/route.mjs" resolve --role cad-verifier';
  const text = `# Step\n\n\`\`\`\n${bare}\n\`\`\`\n\n${RELAY}\n`;
  assert.deepEqual(relayIssues(text), []);
});

test('a plugin-root invocation of a DIFFERENT script is not an issuing site', () => {
  const other = 'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get workflow.verifier';
  assert.deepEqual(relayIssues(`\`\`\`\n${other}\n\`\`\`\n`), []);
});

test('route.mjs `table` is not a resolve', () => {
  const dump = 'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" table';
  assert.deepEqual(relayIssues(`\`\`\`\n${dump}\n\`\`\`\n`), []);
});

test('relay is word-bounded: "relayed" alone does not state the rule', () => {
  // A near-miss that would otherwise let a passing mention stand in for the
  // instruction. `relayed` is not `relay`.
  const text = `\`\`\`\n${ISSUE}\n\`\`\`\n\nWarnings are relayed somewhere else.\n`;
  assert.equal(relayIssues(text).length, 1);
});

test('the relay paragraph may sit BEFORE the invocation', () => {
  // Presence in the file is the rule, not position - the check is about the
  // instruction existing where the reader of that file will meet it.
  assert.deepEqual(relayIssues(`${RELAY}\n\n\`\`\`\n${ISSUE}\n\`\`\`\n`), []);
});

test('a non-string input yields [], never a throw', () => {
  for (const bad of [null, undefined, 42, [], {}, '']) {
    assert.deepEqual(relayIssues(bad), [], JSON.stringify(bad));
  }
});
