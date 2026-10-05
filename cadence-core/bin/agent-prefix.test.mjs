// @ts-check
// Tests for lib/agent-prefix.mjs, the Agent half of the Cadence module's one
// `tool.call` handler (phase 5, D-07), and the `agent.offer` observer that
// leaves a user's own bare agent alone (MOD-04).
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

// --- a user's own agent keeps its bare name (MOD-04) --------------------------

/**
 * ONE `register` call, so an offer and a later call share the module's state:
 * the `agent.offer` and `tool.call` handlers with their matchers.
 */
function session() {
  /** @type {{matcher: any, handler: Function}[]} */
  const offers = [];
  /** @type {Function[]} */
  const calls = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    const entry = b === undefined ? { matcher: undefined, handler: a } : { matcher: a, handler: b };
    if (pattern === 'agent.offer') offers.push(entry);
    if (pattern === 'tool.call') calls.push(entry.handler);
  });
  assert.equal(offers.length, 1);
  assert.equal(calls.length, 1);
  const $ = only('cadence');
  return {
    offers,
    /** Feed one offer; it must call `next` once with `e` and answer `next`'s object. */
    async offer(/** @type {any} */ e) {
      const r = recording();
      const answer = await offers[0].handler($, e, r.next);
      assert.equal(r.seen.length, 1);
      assert.equal(r.seen[0], e);
      assert.equal(answer, r.result);
    },
    /** One Agent call: the event `next` saw. */
    async call(/** @type {string} */ type) {
      const r = recording();
      const e = agentCall(type);
      await calls[0]($, e, r.next);
      assert.equal(r.seen.length, 1);
      return { e, sent: r.seen[0] };
    },
  };
}

const offer = (/** @type {string} */ agent, /** @type {string} */ source) =>
  ({ agent, description: 'd', source, provider: { plugin: 'x', tier: 'y' } });

test('a project agent named cad-reviewer keeps a bare cad-reviewer call as the very event', async () => {
  const s = session();
  await s.offer(offer('cad-reviewer', 'projectSettings'));
  const { e, sent } = await s.call('cad-reviewer');
  assert.equal(sent, e);
});

test('a user-level agent named cad-reviewer does the same', async () => {
  const s = session();
  await s.offer(offer('cad-reviewer', 'userSettings'));
  const { e, sent } = await s.call('cad-reviewer');
  assert.equal(sent, e);
});

test('with no offer, a bare cad-reviewer is rewritten', async () => {
  const { sent } = await session().call('cad-reviewer');
  assert.equal(sent.subagent_type, 'cadence:cad-reviewer');
});

test('plugin-sourced offers own nothing, so the call is rewritten', async () => {
  const s = session();
  await s.offer(offer('cadence:cad-reviewer', 'plugin'));
  await s.offer(offer('cad-reviewer', 'plugin'));
  const { sent } = await s.call('cad-reviewer');
  assert.equal(sent.subagent_type, 'cadence:cad-reviewer');
});

test('an offer whose getters throw still reaches next once, and records nothing', async () => {
  const s = session();
  await s.offer({ get agent() { throw new Error('boom'); }, source: 'projectSettings' });
  await s.offer({ agent: 'cad-reviewer', get source() { throw new Error('boom'); } });
  const { sent } = await s.call('cad-reviewer');
  assert.equal(sent.subagent_type, 'cadence:cad-reviewer');
});

test('owning cad-reviewer leaves a bare cad-reviewer-low rewritten', async () => {
  const s = session();
  await s.offer(offer('cad-reviewer', 'projectSettings'));
  const { sent } = await s.call('cad-reviewer-low');
  assert.equal(sent.subagent_type, 'cadence:cad-reviewer-low');
});

test('exactly one agent.offer registration, and it carries no matcher', () => {
  const { offers } = session();
  assert.equal(offers[0].matcher, undefined);
});
