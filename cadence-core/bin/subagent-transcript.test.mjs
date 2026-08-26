// @ts-check
// subagent-transcript.test.mjs - the rule that reads a worker's own transcript,
// driven against injected text. No filesystem, no host, no real transcript: the
// rule is pure by construction (lib/subagent-transcript.mjs's header) and takes
// the file's bytes as an argument, which is what lets every shape below - an
// absent file, a truncated tail, a layout that changed - be an ordinary string
// literal rather than a fixture nobody can produce on demand.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terminalOf, cacheOf, STOP_STATE } from './lib/subagent-transcript.mjs';

/** One transcript line, in the host's own shape. */
const line = (o) => JSON.stringify(o);
/** An assistant line: one content block, its stop reason, its own instant. */
const asst = (stop, timestamp) => line({
  type: 'assistant', agentId: 'a1852a9b36a6c52b8', timestamp,
  message: { id: 'msg_01', role: 'assistant', content: [], stop_reason: stop },
});
/** A user line - a prompt or a tool result. Carries no `message.stop_reason`. */
const user = (timestamp) => line({
  type: 'user', agentId: 'a1852a9b36a6c52b8', timestamp,
  message: { role: 'user', content: [] },
});

const T1 = '2026-08-26T11:31:20.000Z';
const T2 = '2026-08-26T11:31:26.226Z';

test('transcript: a last assistant line stopped end_turn is TERMINAL, with its own instant', () => {
  const text = [user(T1), asst(null, T1), asst('end_turn', T2)].join('\n') + '\n';
  const answer = terminalOf(text);
  assert.equal(answer.state, STOP_STATE.TERMINAL);
  // Quoted BYTE FOR BYTE off the entry, never reparsed and reformatted: the
  // caller stamps this onto the record as the worker's own stop time, and a
  // round trip through Date would silently renormalize a spelling the host
  // chose.
  assert.equal(answer.ts, T2);
});

test('transcript: any stop reason other than tool_use is terminal', () => {
  // The rule is an EXCLUSION, not `=== "end_turn"`. Measured over 303
  // transcripts older than a day: 254 `end_turn`, 14 `tool_use`, 34 `null` and
  // one `stop_sequence` - which an equality test would have called unfinished.
  for (const stop of ['end_turn', 'stop_sequence', 'max_tokens', 'refusal']) {
    assert.equal(terminalOf(asst(stop, T2)).state, STOP_STATE.TERMINAL, stop);
  }
});

test('transcript: a last assistant line stopped tool_use is NOT terminal', () => {
  // The worker is blocked on a tool result, so it has not finished. Every
  // earlier line in the file is irrelevant: only the LAST assistant line
  // answers, which is why an earlier `end_turn` does not carry the file.
  const text = [asst('end_turn', T1), user(T2), asst('tool_use', T2)].join('\n');
  const answer = terminalOf(text);
  assert.equal(answer.state, STOP_STATE.NOT_TERMINAL);
  assert.equal(answer.ts, null, 'a worker that has not stopped has no stop time');
});

test('transcript: a last assistant line stopped null is NOT terminal', () => {
  // `null` is the value the host records on a content block INSIDE a turn - an
  // assistant message is written one line per block and only the block that
  // ends the message carries a real stop reason.
  const text = [asst('end_turn', T1), asst(null, T2)].join('\n');
  assert.equal(terminalOf(text).state, STOP_STATE.NOT_TERMINAL);
});

test('transcript: nothing to read at all answers UNKNOWN, never not-terminal', () => {
  // The third state is the whole point: `unknown` lets the caller degrade to
  // what it does today. Folding these into `not-terminal` would delete every
  // hook close in the record the first time the host stopped supplying the file.
  const cases = {
    'an absent file': undefined,
    'a null read': null,
    'an empty file': '',
    'whitespace only': '\n\n  \n',
    'a non-string': 42,
    'unparseable lines': 'not json\n{oops\n',
    'user lines only': [user(T1), user(T2)].join('\n'),
    'no assistant among foreign lines': line({ type: 'summary', timestamp: T1 }),
  };
  for (const [why, input] of Object.entries(cases)) {
    assert.equal(terminalOf(input).state, STOP_STATE.UNKNOWN, why);
    assert.equal(terminalOf(input).ts, null, why);
  }
});

test('transcript: an assistant line whose SHAPE changed answers UNKNOWN', () => {
  // An unrecognized shape is not a worker mid-turn. The Claude Code sub-agents
  // documentation states the layout carries no stability guarantee, so a moved
  // or retyped field must degrade rather than suppress every close silently.
  const noMessage = line({ type: 'assistant', timestamp: T2 });
  const noStopKey = line({ type: 'assistant', timestamp: T2, message: { role: 'assistant' } });
  const oddStop = line({ type: 'assistant', timestamp: T2, message: { stop_reason: 7 } });
  const emptyStop = line({ type: 'assistant', timestamp: T2, message: { stop_reason: '' } });
  for (const [why, text] of Object.entries({ noMessage, noStopKey, oddStop, emptyStop })) {
    assert.equal(terminalOf(text).state, STOP_STATE.UNKNOWN, why);
  }
});

test('transcript: a truncated final line does not change the answer before it', () => {
  // The host appends while the hook may already be reading, so a partial tail
  // is SKIPPED rather than fatal - the posture `planning/core.mjs`'s
  // `readReadsRecords` states for the same hazard.
  const complete = [user(T1), asst('end_turn', T2)].join('\n');
  const truncated = `${complete}\n{"type":"assistant","timest`;
  assert.deepEqual(terminalOf(truncated), terminalOf(complete));
  assert.equal(terminalOf(truncated).state, STOP_STATE.TERMINAL);
  assert.equal(terminalOf(truncated).ts, T2);
  // ...and the same holds where the complete lines answered not-terminal.
  const open = [user(T1), asst('tool_use', T2)].join('\n');
  assert.deepEqual(terminalOf(`${open}\n{"type":`), terminalOf(open));
});

test('transcript: a terminal entry with no readable timestamp still answers terminal', () => {
  // The state and the instant are two separate answers. A worker that finished
  // with an unreadable clock has still finished, and `ts: null` is what lets
  // the caller fall back to stamping the append the way it does today.
  const text = line({ type: 'assistant', message: { stop_reason: 'end_turn' } });
  assert.deepEqual(terminalOf(text), { state: STOP_STATE.TERMINAL, ts: null });
});

test('transcript: the rule never throws, whatever it is handed', () => {
  // The only caller is a hook that emits nothing on any stream, so a thrown
  // error is just a close the record silently lost.
  for (const input of [undefined, null, 0, [], {}, Symbol('x'), ' ', 'null', '[]', '{}']) {
    assert.doesNotThrow(() => terminalOf(/** @type {any} */ (input)));
  }
});

// --- the worker's own cache traffic (TRC-05) ---------------------------------

/** An assistant line carrying a `message.usage`, the host's own shape. */
const billed = (usage, timestamp = T2) => line({
  type: 'assistant', agentId: 'a1852a9b36a6c52b8', timestamp,
  message: { id: 'msg_01', role: 'assistant', content: [], stop_reason: 'end_turn', usage },
});

test('transcript: the cache figures are SUMMED across every assistant entry', () => {
  // Each `message.usage` describes ONE billed request, so the sum is the
  // worker's total billed cache traffic - the quantity a prompt-cache claim is
  // argued in. A max would answer how big the prefix got and could not be
  // compared across two workers with different turn counts.
  const text = [
    user(T1),
    billed({ cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }, T1),
    user(T2),
    billed({ cache_creation_input_tokens: 50, cache_read_input_tokens: 2000 }),
  ].join('\n') + '\n';
  assert.deepEqual(cacheOf(text), {
    cache_creation_input_tokens: 150,
    cache_read_input_tokens: 3000,
  });
  // ...and reading the file for cache traffic did not change what it says about
  // the worker having finished, or when.
  assert.deepEqual(terminalOf(text), { state: STOP_STATE.TERMINAL, ts: T2 });
});

test('transcript: a figure no entry reported is ABSENT, never 0', () => {
  // An absent key and a zero are different claims: one says the transcript
  // never reported the figure, the other claims the worker billed no cache
  // traffic. Checked by key presence throughout, never against 0.
  const cases = {
    'assistant entries with no usage object at all':
      [user(T1), asst('end_turn', T2)].join('\n'),
    'a usage object carrying neither field': billed({ input_tokens: 12 }),
    'nothing readable at all': '',
    'user lines only': user(T1),
  };
  for (const [why, text] of Object.entries(cases)) {
    const answer = cacheOf(text);
    assert.equal('cache_creation_input_tokens' in answer, false, why);
    assert.equal('cache_read_input_tokens' in answer, false, why);
  }
  // The two figures answer INDEPENDENTLY: one reported and one not is one key.
  assert.deepEqual(cacheOf(billed({ cache_creation_input_tokens: 7 })),
    { cache_creation_input_tokens: 7 });
  // ...and a figure the host really reported as zero is RECORDED as zero.
  assert.deepEqual(cacheOf(billed({ cache_read_input_tokens: 0 })),
    { cache_read_input_tokens: 0 });
});

test('transcript: a non-numeric cache figure contributes NOTHING', () => {
  // The guard `lib/trace.mjs` already puts on `tokens`, `turns` and
  // `duration_ms`, for the identical hazard: `"1,000"` string-concatenated onto
  // a numeric field a caller sums is worse than no figure at all.
  const text = [
    billed({ cache_creation_input_tokens: 10, cache_read_input_tokens: '1,000' }, T1),
    billed({ cache_creation_input_tokens: NaN, cache_read_input_tokens: null }),
  ].join('\n');
  const answer = cacheOf(text);
  assert.deepEqual(answer, { cache_creation_input_tokens: 10 });
  assert.equal('cache_read_input_tokens' in answer, false,
    'a string figure left a key behind rather than contributing nothing');
  // A usage that is not an object at all, and a line the parse skipped, are the
  // same nothing - the rule never throws whatever the file holds.
  for (const input of [undefined, null, 42, billed('nope'), billed(null), '{"type":"assis']) {
    assert.doesNotThrow(() => cacheOf(/** @type {any} */ (input)));
    assert.deepEqual(cacheOf(/** @type {any} */ (input)), {});
  }
});
