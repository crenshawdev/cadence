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
