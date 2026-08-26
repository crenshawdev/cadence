// @ts-check
// subagent-trace.test.mjs - the rule behind the `SubagentStop` hook, driven
// against synthetic payload/render pairs. No hook, no filesystem, no host: the
// rule is pure by construction (lib/subagent-trace.mjs's header) and this is
// what proves it, because the live path can only be exercised by a real
// subagent dispatch inside the host.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeForStop } from './lib/subagent-trace.mjs';

/** One `unpaired[]` row, the shape `renderTrace(...)` returns. */
const open = (role, plan, ts, extra) => ({ corr: '2-abc1234', phase: '2', plan, ts, role, ...extra });
/** A render carrying nothing but the open dispatches a case needs. */
const render = (unpaired) => ({ file: '/x/.planning/trace.jsonl', unpaired, brackets: [] });

const T = (m) => new Date(Date.UTC(2026, 7, 25, 12, m, 0)).toISOString();

/**
 * A stopped worker's transcript, in the host's own line shape. The disk half
 * reads the file; this is the string it injects (D-08), so every case below is
 * a literal rather than a fixture nobody can produce on demand.
 */
const transcript = (stop, timestamp) => `${JSON.stringify({
  type: 'user', agentId: 'a1', timestamp, message: { role: 'user', content: [] },
})}\n${JSON.stringify({
  type: 'assistant', agentId: 'a1', timestamp,
  message: { id: 'msg_01', role: 'assistant', content: [], stop_reason: stop },
})}\n`;

test('stop: a rung-suffixed Cadence type adopts the ONE open dispatch of its role', () => {
  // `cadence:cad-executor-xhigh` is a FILE stem in the host's
  // `<plugin>:<agent-file-stem>` spelling; the dispatch event carries the bare
  // ROLE, and `--plan` for an executor is the plan NUMBER rather than the role.
  const r = render([open('cad-executor', '2', T(10), { corr: '2-def5678' })]);
  const ev = closeForStop({ agent_type: 'cadence:cad-executor-xhigh' }, r);
  assert.ok(ev, 'a live Cadence type with an open dispatch produced nothing');
  // ADOPTED, never derived: every identity field is the open row's own.
  assert.equal(ev.corr, '2-def5678');
  assert.equal(ev.phase, '2');
  assert.equal(ev.plan, '2');
  // The mapped ROLE, not the agent type - `cadence:cad-executor-xhigh` is a row
  // no `workflow.max_dispatch_tokens.<role>` key can ever match.
  assert.equal(ev.role, 'cad-executor');
  assert.equal(ev.family, 'lifecycle');
  assert.equal(ev.event, 'return');
});

test('stop: the event carries NO figure of any kind', () => {
  // The payload carries no token count, no tool-use count and no duration
  // (D-01), and a fabricated figure is strictly worse than an absent one: it
  // would land in `trace suggest`'s share denominator and misprice every other
  // role with it. The hand-written close is what carries the figures.
  const ev = closeForStop(
    { agent_type: 'cadence:cad-verifier-medium', agent_id: 'a1', session_id: 's1' },
    render([open('cad-verifier', 'cad-verifier', T(3))]),
  );
  assert.ok(ev);
  assert.deepEqual(Object.keys(ev).sort(), ['corr', 'event', 'family', 'phase', 'plan', 'role']);
  for (const k of ['tokens', 'turns', 'duration_ms', 'detail']) {
    assert.equal(k in ev, false, `the hook invented a ${k} the payload never carried`);
  }

  // The transcript-backed arm adds exactly ONE key, `ts`, and it is the worker's
  // own stop instant rather than a figure. Every figure stays absent: the
  // transcript answers when the worker stopped and nothing about what it cost.
  const stamped = closeForStop(
    { agent_type: 'cadence:cad-verifier-medium', agent_id: 'a1' },
    render([open('cad-verifier', 'cad-verifier', T(3))]),
    { transcript: transcript('end_turn', T(9)) },
  );
  assert.deepEqual(Object.keys(stamped).sort(),
    ['corr', 'event', 'family', 'phase', 'plan', 'role', 'ts']);
  for (const k of ['tokens', 'turns', 'duration_ms', 'detail']) {
    assert.equal(k in stamped, false, `the hook invented a ${k} off the transcript`);
  }
});

// --- the termination gate and the worker's own clock (TRC-06) ----------------

test('stop: a worker whose transcript shows it has NOT stopped produces nothing', () => {
  // `SubagentStop` carries no field that separates a worker that finished from
  // one handed back mid-turn, so the transcript is the evidence. The gate runs
  // before the render is consulted: an open dispatch of the role is present and
  // is deliberately not enough.
  const r = render([open('cad-executor', '1', T(0))]);
  for (const stop of ['tool_use', null]) {
    assert.equal(
      closeForStop({ agent_type: 'cadence:cad-executor' }, r, { transcript: transcript(stop, T(5)) }),
      null,
      `a transcript stopped ${stop} still produced a close`,
    );
  }
});

test('stop: a terminal transcript stamps the event with the WORKER\'s instant', () => {
  // Without this the renderer stamps `new Date()` at append, so a hook close
  // delayed past the next dispatch of the same worker key would carry an
  // instant LATER than that dispatch - and `renderTrace`'s repeat-close
  // discriminator could never fire in production (D-06).
  const ev = closeForStop(
    { agent_type: 'cadence:cad-executor' },
    render([open('cad-executor', '1', T(0))]),
    { transcript: transcript('end_turn', T(7)) },
  );
  assert.ok(ev);
  // Byte for byte off the entry, never reparsed and reformatted.
  assert.equal(ev.ts, T(7));
  assert.equal(ev.plan, '1', 'the identity is still the adopted row\'s');
});

test('stop: NO transcript evidence produces the same event, with no ts key at all', () => {
  // The gate refuses on NOT-TERMINAL alone. A payload with no
  // `transcript_path`, a file that could not be read, an over-cap file and a
  // layout that changed all arrive as `unknown` and must keep writing the close
  // this hook writes today - folding them into the refusal is how a host-side
  // rename would delete every hook close in the record at once and silently.
  const r = render([open('cad-executor', '1', T(0))]);
  const base = closeForStop({ agent_type: 'cadence:cad-executor' }, r);
  const evidences = {
    'no third argument': undefined,
    'an empty evidence object': {},
    'an unreadable file': { transcript: null },
    'an over-cap file': { transcript: undefined },
    'an empty file': { transcript: '' },
    'a layout this rule cannot read': { transcript: '{"type":"assistant","message":{}}' },
    'user lines only': { transcript: '{"type":"user","message":{"role":"user"}}' },
  };
  for (const [why, evidence] of Object.entries(evidences)) {
    const ev = closeForStop({ agent_type: 'cadence:cad-executor' }, r, evidence);
    assert.deepEqual(ev, base, why);
    // Checked by `in`, never against a null: an absent key and a null one are
    // different things on the record, and `renderEvent` only stamps the append
    // time where the key is absent.
    assert.equal('ts' in ev, false, why);
  }
});

test('stop: a terminal transcript with no readable instant adds no ts key', () => {
  // The two answers are separate: a worker that finished with an unreadable
  // clock has still finished, and the absent key is what lets `renderEvent`
  // fall back to stamping the append the way it does today. OMITTED, not null -
  // the absent-not-zero rule the bracket's own `duration_ms` follows.
  const ev = closeForStop(
    { agent_type: 'cadence:cad-executor' },
    render([open('cad-executor', '1', T(0))]),
    { transcript: '{"type":"assistant","message":{"stop_reason":"end_turn"}}' },
  );
  assert.ok(ev);
  assert.equal('ts' in ev, false);
});

test('stop: a non-Cadence type is still nothing, terminal transcript or not', () => {
  // The self-filter is unmoved by the new gate: a terminal transcript is
  // permission to look at the record, never permission to close a bracket.
  const r = render([open('cad-executor', '1', T(0))]);
  assert.equal(
    closeForStop({ agent_type: 'general-purpose' }, r, { transcript: transcript('end_turn', T(5)) }),
    null,
  );
});

// --- whose stop is this: unambiguous or nothing (TRC-06) ---------------------

/** Two open executor dispatches on one role: plan 1 at T0, plan 2 at T10. */
const twoOpen = () => render([
  open('cad-executor', '1', T(0)),
  open('cad-executor', '2', T(10), { corr: '2-def5678' }),
]);

const AGENT = 'a1852a9b36a6c52b8';
const STOP = { agent_type: 'cadence:cad-executor', agent_id: AGENT };

/** A paired bracket row, the shape `renderTrace(...)` returns for a closed one. */
const bracket = (role, plan, extra) => ({
  corr: '2-abc1234', phase: '2', plan, role, event: 'return', ts: T(0), end: T(5), ...extra,
});
/** A render carrying both halves. */
const withBrackets = (unpaired, brackets) => ({
  file: '/x/.planning/trace.jsonl', unpaired, brackets,
});

test('stop: TWO open dispatches of the role produce NOTHING', () => {
  // TRC-06 forbids the newest-open adoption by name, and there is nothing to
  // put in its place: the parallel path dispatches both executors in ONE
  // message, so no ordering of dispatch instants separates them. Both rows stay
  // `unpaired`, which is the visible defect - a crossed bracket bills one worker
  // for another's run and reads as clean.
  assert.equal(closeForStop(STOP, twoOpen()), null);
  // ...and the transcript half changes nothing: a worker that provably stopped
  // still cannot say WHICH open dispatch is its own.
  assert.equal(
    closeForStop(STOP, twoOpen(), { transcript: transcript('end_turn', T(12)) }),
    null,
  );
});

test('stop: a worker already closed by the orchestrator writes NOTHING', () => {
  // The hand-written close carries `--agent-id`, so a hook stop arriving after
  // it finds its own bracket on the record. Falling through here is the
  // stolen-bracket defect arriving late: plan 2 is open, and adopting it would
  // bill worker A's terminal against worker B's dispatch.
  const r = withBrackets(
    [open('cad-executor', '2', T(10), { corr: '2-def5678' })],
    [bracket('cad-executor', '1', { agent_id: AGENT })],
  );
  assert.equal(closeForStop(STOP, r), null);
});

test('stop: another worker\'s closed bracket does not block this one', () => {
  // The equality test is on THIS payload's id. A sibling's finished bracket is
  // not evidence about this worker, so the single open dispatch is still its.
  const r = withBrackets(
    [open('cad-executor', '2', T(10), { corr: '2-def5678' })],
    [bracket('cad-executor', '1', { agent_id: 'b2963bac47b7d63c9' })],
  );
  assert.equal(closeForStop(STOP, r).plan, '2');
});

test('stop: a close that carried NO id never blocks a later worker', () => {
  // A bracket closed before `--agent-id` existed, or by the hook itself, has no
  // id. It must not match every payload - `row.agent_id === id` is an equality
  // test and `undefined` equals no id anyone can send.
  const r = withBrackets(
    [open('cad-executor', '2', T(10), { corr: '2-def5678' })],
    [bracket('cad-executor', '1')],
  );
  assert.equal(closeForStop(STOP, r).plan, '2');
});

test('stop: a payload with no agent_id still closes an unambiguous dispatch', () => {
  // The id answers "has this worker already closed?". With no id that question
  // is unanswered, not answered NO, and the single-open test stands on its own -
  // so no close this hook writes today is lost to a missing id.
  const r = render([open('cad-executor', '1', T(0))]);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-executor' }, r).plan, '1');
});

test('stop: a render with no usable brackets half is not fatal', () => {
  // `renderTrace` is read from a hook that must never throw, and a record that
  // predates the brackets array or arrives malformed still has to answer.
  for (const [why, brackets] of Object.entries({
    'a missing key': undefined,
    'a non-array': 'nope',
    'rows that are not objects': [null, 42, 'x'],
  })) {
    const r = { file: '/x/.planning/trace.jsonl', unpaired: [open('cad-executor', '1', T(0))], brackets };
    assert.equal(closeForStop(STOP, r).plan, '1', why);
  }
});

test('stop: the rule never crosses roles', () => {
  // Only rows of the mapped role are counted, so another role's open dispatch
  // neither supplies an answer nor makes this one ambiguous.
  const r = render([
    open('cad-verifier', 'cad-verifier', T(2)),
    open('cad-executor', '1', T(0)),
  ]);
  assert.equal(closeForStop(STOP, r).plan, '1');
});

test('stop: the self-filter answers nothing for every non-Cadence agent type', () => {
  // The 2.1.245 `SubagentStop` runner passes no `matchQuery`, so this hook is
  // called for EVERY subagent in the session. All four types below are present
  // in this repository's own `reads.jsonl` corpus.
  const r = render([open('cad-executor', '1', T(0)), open('cad-reviewer', 'cad-reviewer', T(1))]);
  for (const agent_type of ['general-purpose', 'Explore', 'fork', 'claude-code-guide']) {
    assert.equal(closeForStop({ agent_type }, r), null, `${agent_type} produced a close event`);
  }
});

test('stop: a Cadence type with no matching open dispatch answers nothing', () => {
  const r = render([open('cad-executor', '1', T(0))]);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-verifier' }, r), null);
});

test('stop: a payload with no agent_type at all answers nothing', () => {
  const r = render([open('cad-executor', '1', T(0))]);
  for (const payload of [{}, { agent_type: null }, { agent_type: '' }, null]) {
    assert.equal(closeForStop(payload, r), null);
  }
});

// --- the cache figures only this hook can see (TRC-05) -----------------------

/** A stopped worker's transcript whose assistant lines carry a `usage`. */
const billed = (usages) => usages.map((usage, i) => JSON.stringify({
  type: 'assistant', agentId: 'a1', timestamp: T(9),
  message: { id: `msg_0${i}`, role: 'assistant', content: [], stop_reason: 'end_turn', usage },
})).join('\n');

test('stop: the event carries the two CACHE figures and no return figure', () => {
  // The discriminator is where a figure LIVES. `tokens`, `turns` and
  // `duration_ms` are on the host's return, which only the orchestrator sees;
  // the cache sums are in the worker's own transcript, which only this hook
  // holds, so it is the only writer that can ever put them on the record (D-11).
  const ev = closeForStop(
    { agent_type: 'cadence:cad-executor', agent_id: AGENT },
    render([open('cad-executor', '1', T(0))]),
    {
      transcript: billed([
        { cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 },
        { cache_creation_input_tokens: 50, cache_read_input_tokens: 2000 },
      ]),
    },
  );
  assert.ok(ev);
  assert.deepEqual(Object.keys(ev).sort(), [
    'cache_creation_input_tokens', 'cache_read_input_tokens',
    'corr', 'event', 'family', 'phase', 'plan', 'role', 'ts',
  ]);
  // SUMMED across every assistant entry: each `usage` is one billed request.
  assert.equal(ev.cache_creation_input_tokens, 150);
  assert.equal(ev.cache_read_input_tokens, 3000);
  for (const k of ['tokens', 'turns', 'duration_ms', 'detail']) {
    assert.equal(k in ev, false, `the hook invented a ${k} the return alone carries`);
  }
});

test('stop: a transcript reporting no cache traffic leaves BOTH keys off', () => {
  // Omitted, never zero: an absent key says the transcript reported nothing,
  // and a `0` would claim the worker billed no cache traffic. Checked by `in`.
  const evidences = {
    'assistant lines with no usage object': { transcript: transcript('end_turn', T(9)) },
    'a usage carrying neither field': { transcript: billed([{ input_tokens: 12 }]) },
    'a string figure, which contributes nothing':
      { transcript: billed([{ cache_read_input_tokens: '1,000' }]) },
    'no transcript at all': undefined,
  };
  for (const [why, evidence] of Object.entries(evidences)) {
    const ev = closeForStop(
      { agent_type: 'cadence:cad-executor', agent_id: AGENT },
      render([open('cad-executor', '1', T(0))]),
      evidence,
    );
    assert.ok(ev, why);
    assert.equal('cache_creation_input_tokens' in ev, false, why);
    assert.equal('cache_read_input_tokens' in ev, false, why);
  }
  // ...and the figures never buy a close the gates refused: a worker that has
  // not stopped writes nothing whatever its transcript billed.
  assert.equal(
    closeForStop(
      { agent_type: 'cadence:cad-executor', agent_id: AGENT },
      render([open('cad-executor', '1', T(0))]),
      { transcript: '{"type":"assistant","message":{"stop_reason":"tool_use","usage":{"cache_read_input_tokens":9}}}' },
    ),
    null,
  );
});
