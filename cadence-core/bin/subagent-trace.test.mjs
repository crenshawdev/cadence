// @ts-check
// subagent-trace.test.mjs - the rule behind the `SubagentStop` hook, driven
// against synthetic payload/render pairs. No hook, no filesystem, no host: the
// rule is pure by construction (lib/subagent-trace.mjs's header) and this is
// what proves it, because the live path can only be exercised by a real
// subagent dispatch inside the host.
//
// The answer is a LIST of events in append order (D-08), never `{...}|null`:
// one stop can owe the record more than one event, and DO NOTHING is the
// empty list. So every do-nothing case below asserts `[]` rather than null,
// and every case that expects an answer reads it out of the list.
//
// Two kinds of event can be in it. A `return` CLOSES a bracket and only the
// unambiguous terminal path writes one. A `worker_cache` fact closes nothing
// and states the two cache figures a withholding gate would otherwise have
// thrown away - so a case titled "produces nothing" means the fixture gave the
// hook no cache evidence either, and the cases at the foot of this file are
// where each gate's fact is pinned.
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
  const events = closeForStop({ agent_type: 'cadence:cad-executor-xhigh' }, r);
  // EXACTLY ONE, and the rest of this file reads the same way: the contract is a
  // list, so "produced an answer" is a length rather than a truthiness test.
  assert.equal(events.length, 1, 'a live Cadence type with an open dispatch produced nothing');
  const [ev] = events;
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
  const [ev] = closeForStop(
    { agent_type: 'cadence:cad-verifier-medium', agent_id: 'a1', session_id: 's1' },
    render([open('cad-verifier', 'cad-verifier', T(3))]),
  );
  assert.ok(ev);
  // `agent_id` is on the list because the PAYLOAD carried one and this writer
  // quotes it - it is neither invented nor a figure, and without it a bracket
  // the hook closed could never be joined to a later fact.
  assert.deepEqual(Object.keys(ev).sort(),
    ['agent_id', 'corr', 'event', 'family', 'phase', 'plan', 'role']);
  for (const k of ['tokens', 'turns', 'duration_ms', 'detail']) {
    assert.equal(k in ev, false, `the hook invented a ${k} the payload never carried`);
  }

  // The transcript-backed arm adds exactly ONE key, `ts`, and it is the worker's
  // own stop instant rather than a figure. Every figure stays absent: the
  // transcript answers when the worker stopped and nothing about what it cost.
  const [stamped] = closeForStop(
    { agent_type: 'cadence:cad-verifier-medium', agent_id: 'a1' },
    render([open('cad-verifier', 'cad-verifier', T(3))]),
    { transcript: transcript('end_turn', T(9)) },
  );
  assert.deepEqual(Object.keys(stamped).sort(),
    ['agent_id', 'corr', 'event', 'family', 'phase', 'plan', 'role', 'ts']);
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
    assert.deepEqual(
      closeForStop({ agent_type: 'cadence:cad-executor' }, r, { transcript: transcript(stop, T(5)) }),
      [],
      `a transcript stopped ${stop} still produced a close`,
    );
  }
});

test('stop: a terminal transcript stamps the event with the WORKER\'s instant', () => {
  // Without this the renderer stamps `new Date()` at append, so a hook close
  // delayed past the next dispatch of the same worker key would carry an
  // instant LATER than that dispatch - and `renderTrace`'s repeat-close
  // discriminator could never fire in production (D-06).
  const [ev] = closeForStop(
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
  // `agent_transcript_path`, a file that could not be read, an over-cap file and a
  // layout that changed all arrive as `unknown` and must keep writing the close
  // this hook writes today - folding them into the refusal is how a host-side
  // rename would delete every hook close in the record at once and silently.
  const r = render([open('cad-executor', '1', T(0))]);
  const [base] = closeForStop({ agent_type: 'cadence:cad-executor' }, r);
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
    const [ev] = closeForStop({ agent_type: 'cadence:cad-executor' }, r, evidence);
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
  const [ev] = closeForStop(
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
  assert.deepEqual(
    closeForStop({ agent_type: 'general-purpose' }, r, { transcript: transcript('end_turn', T(5)) }),
    [],
  );
});

// --- whose stop is this: unambiguous or nothing (TRC-06) ---------------------

/**
 * Two open executor dispatches on one role, in ONE run: plan 1 at T0, plan 2 at
 * T10, both under `2-abc1234`. The shared `corr` is the point - the parallel
 * path dispatches both executors in one message, so they belong to one run by
 * construction, and gate 2b's run scope leaves both of them standing.
 */
const twoOpen = () => render([
  open('cad-executor', '1', T(0)),
  open('cad-executor', '2', T(10)),
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

test('stop: the close carries the worker\'s own agent_id, or no id key at all', () => {
  // A bracket this writer closes has to be JOINABLE. `lib/trace.mjs`'s
  // post-pass matches `corr` AND `agent_id`, and `closedBracket` recognises a
  // worker that stops twice by the same equality - so a close carrying no id is
  // a dead end for both, and the eleven-site `--agent-id` spread would only
  // ever reach the brackets the ORCHESTRATOR closed.
  const r = () => render([open('cad-verifier', 'cad-verifier', T(3))]);
  const [carried] = closeForStop(
    { agent_type: 'cadence:cad-verifier', agent_id: AGENT }, r(),
    { transcript: transcript('end_turn', T(9)) },
  );
  assert.equal(carried.event, 'return');
  assert.equal(carried.agent_id, AGENT);

  // OMITTED, never null, when the payload carried none - the same rule `ts`
  // follows one clause away. Quoted off the payload, so there is nothing to
  // derive and nothing to fall back to.
  const [bare] = closeForStop(
    { agent_type: 'cadence:cad-verifier' }, r(),
    { transcript: transcript('end_turn', T(9)) },
  );
  assert.equal(bare.event, 'return');
  assert.equal('agent_id' in bare, false, JSON.stringify(bare));
});

test('stop: TWO open dispatches of the role produce NOTHING', () => {
  // TRC-06 forbids the newest-open adoption by name, and there is nothing to
  // put in its place: the parallel path dispatches both executors in ONE
  // message, so no ordering of dispatch instants separates them. Both rows stay
  // `unpaired`, which is the visible defect - a crossed bracket bills one worker
  // for another's run and reads as clean. Neither transcript here billed any
  // cache traffic, so nothing is the WHOLE answer; the gate's cache-only fact
  // is pinned at the foot of this file.
  assert.deepEqual(closeForStop(STOP, twoOpen()), []);
  // ...and the transcript half changes nothing: a worker that provably stopped
  // still cannot say WHICH open dispatch is its own.
  assert.deepEqual(
    closeForStop(STOP, twoOpen(), { transcript: transcript('end_turn', T(12)) }),
    [],
  );
});

test('stop: a worker already closed by the orchestrator writes NOTHING', () => {
  // The hand-written close carries `--agent-id`, so a hook stop arriving after
  // it finds its own bracket on the record. Falling through here is the
  // stolen-bracket defect arriving late: plan 2 is open, and adopting it would
  // bill worker A's terminal against worker B's dispatch. No transcript here,
  // so there are no figures for the gate's fact to state either.
  //
  // Both rows share a `corr` because both plans belong to ONE phase run, which
  // is the only arrangement in which this gate is reached at all: the match is
  // scoped to the run the candidate set names, and the test below pins what
  // happens when a bracket wearing this id belongs to some other run.
  const r = withBrackets(
    [open('cad-executor', '2', T(10))],
    [bracket('cad-executor', '1', { agent_id: AGENT })],
  );
  assert.deepEqual(closeForStop(STOP, r), []);
});

test('stop: a REUSED id does not reach back into a dead run', () => {
  // The id is the host's, not Cadence's, and it repeats: measured over 1,333
  // transcripts, 7 of 1,323 distinct ids appear in two or more transcripts of
  // one project. Unscoped, this stop matches the old bracket, and gate 2a then
  // quotes ITS `corr` and `phase` onto the fact - so the figures fold onto a
  // bracket in another phase and a `--phase` render never shows it. Scoped, the
  // old bracket is not this worker's close, and the single open dispatch of the
  // current run is.
  const r = withBrackets(
    [open('cad-executor', '2', T(10))],
    [bracket('cad-executor', '1', { agent_id: AGENT, corr: '1-dead9999', phase: '1' })],
  );
  const [ev] = closeForStop(STOP, r);
  assert.equal(ev.event, 'return');
  assert.equal(ev.plan, '2');
  assert.equal(ev.corr, '2-abc1234', 'the close took a dead run\'s corr');
});

test('stop: another worker\'s closed bracket does not block this one', () => {
  // The equality test is on THIS payload's id. A sibling's finished bracket is
  // not evidence about this worker, so the single open dispatch is still its.
  const r = withBrackets(
    [open('cad-executor', '2', T(10), { corr: '2-def5678' })],
    [bracket('cad-executor', '1', { agent_id: 'b2963bac47b7d63c9' })],
  );
  assert.equal(closeForStop(STOP, r)[0].plan, '2');
});

test('stop: a close that carried NO id never blocks a later worker', () => {
  // A bracket closed before `--agent-id` existed, or by the hook itself, has no
  // id. It must not match every payload - `row.agent_id === id` is an equality
  // test and `undefined` equals no id anyone can send.
  const r = withBrackets(
    [open('cad-executor', '2', T(10), { corr: '2-def5678' })],
    [bracket('cad-executor', '1')],
  );
  assert.equal(closeForStop(STOP, r)[0].plan, '2');
});

test('stop: a payload with no agent_id still closes an unambiguous dispatch', () => {
  // The id answers "has this worker already closed?". With no id that question
  // is unanswered, not answered NO, and the single-open test stands on its own -
  // so no close this hook writes today is lost to a missing id.
  const r = render([open('cad-executor', '1', T(0))]);
  assert.equal(closeForStop({ agent_type: 'cadence:cad-executor' }, r)[0].plan, '1');
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
    assert.equal(closeForStop(STOP, r)[0].plan, '1', why);
  }
});

test('stop: the rule never crosses roles', () => {
  // Only rows of the mapped role are counted, so another role's open dispatch
  // neither supplies an answer nor makes this one ambiguous.
  const r = render([
    open('cad-verifier', 'cad-verifier', T(2)),
    open('cad-executor', '1', T(0)),
  ]);
  assert.equal(closeForStop(STOP, r)[0].plan, '1');
});

test('stop: the self-filter answers nothing for every non-Cadence agent type', () => {
  // The 2.1.245 `SubagentStop` runner passes no `matchQuery`, so this hook is
  // called for EVERY subagent in the session. All four types below are present
  // in this repository's own `reads.jsonl` corpus.
  const r = render([open('cad-executor', '1', T(0)), open('cad-reviewer', 'cad-reviewer', T(1))]);
  for (const agent_type of ['general-purpose', 'Explore', 'fork', 'claude-code-guide']) {
    assert.deepEqual(closeForStop({ agent_type }, r), [], `${agent_type} produced a close event`);
  }
});

test('stop: a Cadence type with no matching open dispatch answers nothing', () => {
  const r = render([open('cad-executor', '1', T(0))]);
  assert.deepEqual(closeForStop({ agent_type: 'cadence:cad-verifier' }, r), []);
});

test('stop: a payload with no agent_type at all answers nothing', () => {
  const r = render([open('cad-executor', '1', T(0))]);
  for (const payload of [{}, { agent_type: null }, { agent_type: '' }, null]) {
    assert.deepEqual(closeForStop(payload, r), []);
  }
});

// --- gate 2b counts ONE RUN, not the whole file (D-03) -----------------------

test('stop: a stranded dispatch from an EARLIER run no longer blocks this one', () => {
  // `unpaired` accumulates for the life of the trace file, so before the run
  // scope every dispatch of the role ever left open counted as a live worker
  // forever and this gate refused unconditionally. Measured 2026-08-26 on this
  // repository: 11 such rows survived back to 2026-08-09, one of them a
  // `cad-verifier`. This exact fixture answered nothing before the scope
  // existed, because it held two rows of the role.
  const r = render([
    open('cad-verifier', 'cad-verifier', T(0), { corr: '1-dead000' }),
    open('cad-verifier', 'cad-verifier', T(10), { corr: '2-abc1234' }),
  ]);
  const events = closeForStop({ agent_type: 'cadence:cad-verifier' }, r);
  assert.equal(events.length, 1, 'the dead run\'s leftover still voted');
  assert.equal(events[0].corr, '2-abc1234', 'the close adopted the stranded row');
});

test('stop: two dispatches of one RUN still answer nothing', () => {
  // The scope is not the heuristic TRC-06 bans, and this is the assertion that
  // holds the line: two workers dispatched in one message share a `corr`, so
  // both survive the scope and the rule below it refuses exactly as it did.
  assert.deepEqual(
    closeForStop({ agent_type: 'cadence:cad-verifier' }, render([
      open('cad-verifier', 'cad-verifier', T(0)),
      open('cad-verifier', 'cad-verifier', T(10)),
    ])),
    [],
  );
});

test('stop: with no readable instant anywhere, the whole set stands', () => {
  // An undated row contributes NO clock and is treated as oldest - the posture
  // every arithmetic path in this record takes for an unreadable instant - so a
  // role whose rows are all undated is counted exactly as it was before the
  // scope existed: two rows refuse, one row closes.
  const undated = [
    open('cad-verifier', 'cad-verifier', undefined, { corr: '1-dead000' }),
    open('cad-verifier', 'cad-verifier', 'not-a-date', { corr: '2-abc1234' }),
  ];
  assert.deepEqual(closeForStop({ agent_type: 'cadence:cad-verifier' }, render(undated)), []);
  assert.equal(
    closeForStop({ agent_type: 'cadence:cad-verifier' }, render([undated[0]]))[0].corr,
    '1-dead000',
  );
});

test('stop: an undated row of the CURRENT run is still counted', () => {
  // Contributing no clock is not the same as being dropped. The scope filters on
  // `corr`, so an undated row carrying the current run's id is still an open
  // worker this rule cannot separate from the dated one beside it - which is the
  // conservative direction and the one the whole record prefers.
  assert.deepEqual(
    closeForStop({ agent_type: 'cadence:cad-verifier' }, render([
      open('cad-verifier', 'cad-verifier', undefined),
      open('cad-verifier', 'cad-verifier', T(10)),
    ])),
    [],
  );
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
  const [ev] = closeForStop(
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
    'agent_id', 'cache_creation_input_tokens', 'cache_read_input_tokens',
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
    const [ev] = closeForStop(
      { agent_type: 'cadence:cad-executor', agent_id: AGENT },
      render([open('cad-executor', '1', T(0))]),
      evidence,
    );
    assert.ok(ev, why);
    assert.equal('cache_creation_input_tokens' in ev, false, why);
    assert.equal('cache_read_input_tokens' in ev, false, why);
  }
  // ...and the figures never buy a CLOSE the gates refused. A worker that has
  // not stopped still writes no `return` whatever its transcript billed - the
  // termination gate is unchanged, not relaxed - and what it does write is the
  // cache-only fact, which closes nothing.
  const notTerminal = closeForStop(
    { agent_type: 'cadence:cad-executor', agent_id: AGENT },
    render([open('cad-executor', '1', T(0))]),
    { transcript: '{"type":"assistant","message":{"stop_reason":"tool_use","usage":{"cache_read_input_tokens":9}}}' },
  );
  assert.equal(notTerminal.length, 1);
  assert.equal(notTerminal[0].event, 'worker_cache');
  assert.equal(notTerminal[0].cache_read_input_tokens, 9);
});

// --- every withholding gate still states the figures (TRC-07, D-07) ----------
//
// Three gates refuse the close, and all three used to throw the worker's cache
// figures away with it. Nothing else on the record can recover them: the host
// renders no cache figure on a return, so the transcript this hook holds is the
// only evidence there will ever be. Each gate now answers ONE `worker_cache`
// fact instead - and still no `return`, because the termination gate is
// unchanged rather than relaxed.

/** A transcript that billed cache traffic and stopped the way you name. */
const billedStop = (stop) => JSON.stringify({
  type: 'assistant', agentId: 'a1', timestamp: T(9),
  message: {
    id: 'msg_01',
    role: 'assistant',
    content: [],
    stop_reason: stop,
    usage: { cache_creation_input_tokens: 150, cache_read_input_tokens: 3000 },
  },
});

const VSTOP = { agent_type: 'cadence:cad-verifier', agent_id: AGENT };

/**
 * The three gates, each arranged so IT is the one that fires, with the `corr`
 * and `phase` the fact must quote and where they have to come from.
 */
const gates = {
  'gate 0, not terminal': {
    payload: { ...VSTOP, transcript: billedStop('tool_use') },
    render: () => render([open('cad-verifier', 'cad-verifier', T(3))]),
    corr: '2-abc1234',
    phase: '2',
    // With no id the gate still fires - a worker that has not stopped has not
    // stopped whoever it is - and the fact is the only thing lost.
    idless: [],
  },
  'gate 2a, already closed': {
    // The identity comes off the BRACKET, which is the row the fact will fold
    // onto and the only evidence this gate has: an already-closed dispatch is
    // not in `unpaired` at all. The open row beside it carries a different
    // `phase`, so quoting the wrong source is visible. It can no longer carry a
    // different `corr` to show that: the match is scoped to the run in flight,
    // so a bracket outside it is a reused id rather than this worker's close,
    // which `stop: a REUSED id does not reach back into a dead run` pins.
    payload: { ...VSTOP, transcript: billedStop('end_turn') },
    render: () => withBrackets(
      [open('cad-verifier', 'cad-verifier', T(3))],
      [bracket('cad-verifier', 'cad-verifier', { agent_id: AGENT, phase: '9' })],
    ),
    corr: '2-abc1234',
    phase: '9',
    // The id IS this gate, so an id-less payload is not an already-closed stop
    // at all: it falls through to the single open dispatch and closes it, which
    // is the behaviour `stop: a payload with no agent_id still closes an
    // unambiguous dispatch` already pins. What matters here is what is NOT in
    // the answer.
    idless: ['return'],
  },
  'gate 2b, two open dispatches of one run': {
    payload: { ...VSTOP, transcript: billedStop('end_turn') },
    render: () => render([
      open('cad-verifier', 'cad-verifier', T(3)),
      open('cad-verifier', 'cad-verifier', T(4)),
    ]),
    corr: '2-abc1234',
    phase: '2',
    idless: [],
  },
};

for (const [why, g] of Object.entries(gates)) {
  test(`stop: ${why} states the cache figures and closes nothing`, () => {
    const { transcript: text, ...payload } = g.payload;
    const events = closeForStop(payload, g.render(), { transcript: text });
    assert.equal(events.length, 1, why);
    const [ev] = events;
    assert.equal(ev.event, 'worker_cache', why);
    assert.equal(ev.family, 'lifecycle');
    assert.equal(ev.cache_creation_input_tokens, 150);
    assert.equal(ev.cache_read_input_tokens, 3000);
    assert.equal(ev.agent_id, AGENT, 'the fold\'s only join key is missing');
    assert.equal(ev.role, 'cad-verifier', 'the fact took the host type, not the role');
    // Taken off the render, never invented: an unreadable `corr` is a row no
    // reader can join, and an invented `phase` is one `--phase` filters out.
    assert.equal(ev.corr, g.corr);
    assert.equal(ev.phase, g.phase);
    // NO `plan`: with two open dispatches of one role there is no single plan to
    // name, and one shape for the event whatever gate wrote it is worth more
    // than a field that would sometimes be a guess.
    assert.equal('plan' in ev, false, JSON.stringify(ev));
    // ...and NOTHING in the answer closes a bracket.
    for (const e of events) {
      assert.equal(['return', 'checkpoint', 'escalation'].includes(e.event), false, why);
    }
  });

  test(`stop: ${why} writes no FACT for a payload with no agent_id`, () => {
    // `corr` plus `agent_id` is the fold's only key (D-10). A worker-key
    // fallback of that shape was refuted in `v3.7.3` phase 1 and reverted at
    // `4fbf7280`, so an id-less fact is a row that could never reach a bracket
    // and is not written at all.
    const { transcript: text, agent_id: _id, ...payload } = g.payload;
    const events = closeForStop(payload, g.render(), { transcript: text });
    assert.deepEqual(events.map((e) => e.event), g.idless, why);
  });
}

test('stop: a withholding gate whose transcript billed NOTHING writes no fact', () => {
  // Absent, never zero, and never an event carrying both keys omitted (D-12):
  // an empty fact would claim this worker was measured and found to bill
  // nothing, which is not what an unread transcript says.
  assert.deepEqual(
    closeForStop(VSTOP, render([open('cad-verifier', 'cad-verifier', T(3))]), {
      transcript: JSON.stringify({
        type: 'assistant',
        message: { id: 'm1', role: 'assistant', stop_reason: 'tool_use', usage: { input_tokens: 12 } },
      }),
    }),
    [],
  );
});

test('stop: a withholding gate with no bracket and no candidate row writes nothing', () => {
  // The identity has two sources and no third. With neither, an invented `corr`
  // would be a row no reader could ever join back to a worker.
  assert.deepEqual(
    closeForStop(VSTOP, render([open('cad-executor', '1', T(3))]),
      { transcript: billedStop('tool_use') }),
    [],
  );
});

test('stop: the UNAMBIGUOUS terminal path still answers one return and no fact', () => {
  // Untouched, and deliberately so: a fact beside the close would put one
  // worker's traffic on the record twice.
  const events = closeForStop(VSTOP, render([open('cad-verifier', 'cad-verifier', T(3))]),
    { transcript: billedStop('end_turn') });
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'return');
  assert.equal(events[0].cache_creation_input_tokens, 150);
  assert.equal(events[0].cache_read_input_tokens, 3000);
  assert.equal(events[0].plan, 'cad-verifier', 'the close still quotes the adopted row');
});
