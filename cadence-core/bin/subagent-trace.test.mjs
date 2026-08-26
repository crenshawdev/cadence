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

test('stop: a rung-suffixed Cadence type adopts the NEWEST open dispatch of its role', () => {
  // `cadence:cad-executor-xhigh` is a FILE stem in the host's
  // `<plugin>:<agent-file-stem>` spelling; the dispatch event carries the bare
  // ROLE, and `--plan` for an executor is the plan NUMBER rather than the role.
  const r = render([
    open('cad-executor', '1', T(0)),
    open('cad-executor', '2', T(10), { corr: '2-def5678' }),
  ]);
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
  // The hook never invents a dispatch and never OPENS a bracket: with nothing
  // of that role open, there is no identity to quote and nothing to say.
  const r = render([open('cad-executor', '1', T(0))]);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-verifier' }, r), null);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-executor' }, render([])), null);
});

test('stop: a payload with no agent_type at all answers nothing', () => {
  const r = render([open('cad-executor', '1', T(0))]);
  for (const payload of [{}, { agent_type: '' }, { agent_type: 42 }, null, undefined]) {
    assert.equal(closeForStop(payload, r), null, `${JSON.stringify(payload)} produced a close event`);
  }
  // ...and a render that carries no `unpaired` array is the same answer, not a
  // throw: the hook has no stream to report a fault on.
  assert.equal(closeForStop({ agent_type: 'cadence:cad-executor' }, {}), null);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-executor' }, null), null);
});

test('stop: an unreadable timestamp never displaces a row whose clock can be read', () => {
  // The `unpaired` rows come off a file anyone can hand-edit. A row whose `ts`
  // does not parse sorts below every readable one rather than winning the
  // comparison by NaN, and the all-unreadable case resolves to the row written
  // LAST, since the record is append-ordered.
  const r = render([
    open('cad-planner', 'cad-planner', T(5)),
    open('cad-planner', 'cad-planner', 'not-a-timestamp', { corr: 'junk' }),
  ]);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-planner' }, r).corr, '2-abc1234');

  const both = render([
    open('cad-planner', 'first', null, { corr: 'x' }),
    open('cad-planner', 'last', undefined, { corr: 'y' }),
  ]);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-planner' }, both).plan, 'last');
});
