// @ts-check
// Tests for lib/agent-prefix.mjs and the Agent half of the Cadence module's one
// `tool.call` handler (phase 5, D-07).
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefixedAgent } from './lib/agent-prefix.mjs';
import { register } from '../../hooks/cadence-mod.mjs';

test('a bare Cadence stem gains the plugin name it is given', () => {
  assert.equal(prefixedAgent('cad-reviewer-low', 'cadence'), 'cadence:cad-reviewer-low');
  assert.equal(prefixedAgent('cad-planner', 'cadence-dev'), 'cadence-dev:cad-planner');
});

test('anything else stays as sent', () => {
  for (const value of ['cadence:cad-planner', 'other:cad-planner', 'general-purpose', 'Explore',
    'cad-something-mine', '', undefined, 42]) {
    assert.equal(prefixedAgent(value, 'cadence'), null, String(value));
  }
  assert.equal(prefixedAgent('cad-planner', ''), null);
});

/** The module's `tool.call` handler and its matcher, if it registered one. */
function toolCall() {
  /** @type {{matcher: any, handler: Function}[]} */
  const found = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    if (pattern === 'tool.call') found.push(b === undefined ? { matcher: undefined, handler: a } : { matcher: a, handler: b });
  });
  assert.equal(found.length, 1);
  return found[0];
}

/** A `next` that records every event it receives and resolves one fixed object. */
function recording() {
  /** @type {any[]} */
  const seen = [];
  const result = { result: 'ok' };
  const next = async (/** @type {any} */ e) => { seen.push(e); return result; };
  return { next, seen, result };
}

/** A stand-in `$` holding only `plugin`. */
const only = (/** @type {string} */ name) => ({ plugin: { name } });

/** Drive the handler once: the events `next` saw, and whether it answered `next`'s object. */
async function drive(/** @type {any} */ $, /** @type {any} */ e) {
  const { handler } = toolCall();
  const r = recording();
  const answer = await handler($, e, r.next);
  assert.equal(r.seen.length, 1);
  assert.equal(answer, r.result);
  return r.seen[0];
}

const agentCall = (/** @type {any} */ type) =>
  ({ tool: 'Agent', tool_use_id: 'tu1', subagent_type: type, description: 'd', prompt: 'say OK' });

test('a bare-stem Agent call reaches next with only subagent_type prefixed', async () => {
  const e = agentCall('cad-reviewer-low');
  const sent = await drive(only('cadence'), e);
  assert.notEqual(sent, e);
  assert.deepEqual(sent, { ...e, subagent_type: 'cadence:cad-reviewer-low' });
  assert.equal(e.subagent_type, 'cad-reviewer-low');
});

test('the prefix is the plugin name $ carries', async () => {
  const e = agentCall('cad-reviewer-low');
  const sent = await drive(only('cadence-dev'), e);
  assert.deepEqual(sent, { ...e, subagent_type: 'cadence-dev:cad-reviewer-low' });
});

test('a prefixed or non-Cadence Agent call reaches next as the very event', async () => {
  for (const type of ['cadence:cad-reviewer-low', 'general-purpose']) {
    const e = agentCall(type);
    assert.equal(await drive(only('cadence'), e), e, type);
  }
});

test('a Bash call carrying a subagent_type field reaches next as the very event', async () => {
  const e = { tool: 'Bash', tool_use_id: 'tu2', command: 'echo hi', subagent_type: 'cad-reviewer-low' };
  assert.equal(await drive(only('cadence'), e), e);
});

test('a throwing subagent_type or plugin sends the very event', async () => {
  const e = { tool: 'Agent', tool_use_id: 'tu3', get subagent_type() { throw new Error('boom'); } };
  assert.equal(await drive(only('cadence'), e), e);
  const bare = agentCall('cad-reviewer-low');
  const $ = { get plugin() { throw new Error('boom'); } };
  assert.equal(await drive($, bare), bare);
});

// The rewrite lives in the module's one `tool.call` handler, which also serves
// Bash, so that registration carries no matcher.
test('the one tool.call registration is unnarrowed', () => {
  assert.equal(toolCall().matcher, undefined);
});
