// Grammar tests for lib/rung-agent.mjs - the rung->agent-file mapping rule
// route.mjs and self-verify.mjs share. Run:
// node --test cadence-core/bin/rung-agent.test.mjs
//
// ONE test() per grammar row, deliberately: a table asserted inside a single
// test() with a sequential loop reports the loop's count, not the rows', so a
// row that never ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess - the lib is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentForRung, rungAgents, rungIssues } from './lib/rung-agent.mjs';

const ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
/** The shipped shape of a well-formed role spec. */
const CHECKER = { base_effort: 'low', rungs: ['low', 'high'], escalate_to: 'high' };

// --- agentForRung ------------------------------------------------------------

test('the base rung resolves to the UNSUFFIXED agent name', () => {
  assert.equal(agentForRung('cad-plan-checker', CHECKER, 'low'), 'cad-plan-checker');
});

test('a non-base rung resolves to <role>-<rung>', () => {
  assert.equal(agentForRung('cad-plan-checker', CHECKER, 'high'), 'cad-plan-checker-high');
});

// --- rungAgents --------------------------------------------------------------

test('rungAgents preserves the declared order of the rungs array', () => {
  const spec = { base_effort: 'high', rungs: ['xhigh', 'high', 'max'], escalate_to: 'max' };
  assert.deepEqual(rungAgents('cad-planner', spec),
    ['cad-planner', 'cad-planner-xhigh', 'cad-planner-max']);
});

test('rungAgents de-duplicates when escalate_to equals base_effort', () => {
  const spec = { base_effort: 'high', rungs: ['high', 'xhigh'], escalate_to: 'high' };
  assert.deepEqual(rungAgents('cad-planner', spec), ['cad-planner', 'cad-planner-xhigh']);
});

test('a missing rungs key still yields the base name, never a throw', () => {
  assert.deepEqual(rungAgents('cad-planner', { base_effort: 'high' }), ['cad-planner']);
});

test('an empty rungs array still yields the base name', () => {
  assert.deepEqual(rungAgents('cad-planner', { base_effort: 'high', rungs: [] }), ['cad-planner']);
});

// --- rungIssues --------------------------------------------------------------

test('a well-formed role spec has no issues', () => {
  assert.deepEqual(rungIssues('cad-plan-checker', CHECKER, ORDER), []);
});

test('a missing rungs array is rung-not-declared naming the role', () => {
  const issues = rungIssues('cad-planner', { base_effort: 'high', escalate_to: 'high' }, ORDER);
  assert.ok(issues.some((i) => i.code === 'rung-not-declared'
    && i.detail.startsWith('cad-planner')), JSON.stringify(issues));
});

test('an empty rungs array is rung-not-declared naming the role', () => {
  const issues = rungIssues('cad-planner', { base_effort: 'high', rungs: [], escalate_to: 'high' }, ORDER);
  assert.ok(issues.some((i) => i.code === 'rung-not-declared'
    && i.detail.startsWith('cad-planner')), JSON.stringify(issues));
});

test('a base_effort outside its own rungs is rung-not-declared', () => {
  const issues = rungIssues('cad-planner', { base_effort: 'max', rungs: ['high', 'xhigh'], escalate_to: 'high' }, ORDER);
  assert.ok(issues.some((i) => i.code === 'rung-not-declared'
    && /base_effort "max"/.test(i.detail) && i.detail.startsWith('cad-planner')),
  JSON.stringify(issues));
});

test('an escalate_to outside its own rungs is rung-not-declared', () => {
  const issues = rungIssues('cad-planner', { base_effort: 'high', rungs: ['high', 'xhigh'], escalate_to: 'max' }, ORDER);
  assert.ok(issues.some((i) => i.code === 'rung-not-declared'
    && /escalate_to "max"/.test(i.detail) && i.detail.startsWith('cad-planner')),
  JSON.stringify(issues));
});

test('an absent escalate_to is rung-not-declared, not silently a no-op', () => {
  const issues = rungIssues('cad-planner', { base_effort: 'high', rungs: ['high', 'xhigh'] }, ORDER);
  assert.ok(issues.some((i) => i.code === 'rung-not-declared'
    && /escalate_to/.test(i.detail) && i.detail.startsWith('cad-planner')),
  JSON.stringify(issues));
});

test('a rung outside rung_order is unknown-rung naming the value', () => {
  const issues = rungIssues('cad-planner', { base_effort: 'high', rungs: ['high', 'ludicrous'], escalate_to: 'high' }, ORDER);
  assert.ok(issues.some((i) => i.code === 'unknown-rung'
    && /ludicrous/.test(i.detail) && i.detail.startsWith('cad-planner')),
  JSON.stringify(issues));
});

test('an absent rung_order is one unknown-rung naming rung_order, not one per value', () => {
  const issues = rungIssues('cad-plan-checker', CHECKER, undefined);
  const unknown = issues.filter((i) => i.code === 'unknown-rung');
  assert.equal(unknown.length, 1, JSON.stringify(issues));
  assert.match(unknown[0].detail, /rung_order/);
  assert.ok(unknown[0].detail.startsWith('cad-plan-checker'));
});
