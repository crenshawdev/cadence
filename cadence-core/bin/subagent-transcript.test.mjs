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
import { terminalOf, cacheOf, effortOf, STOP_STATE } from './lib/subagent-transcript.mjs';

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
  message: { id: nextId(), role: 'assistant', content: [], stop_reason: 'end_turn', usage },
});

// A DISTINCT message id per `billed(...)` call, because one message is billed
// once however many lines it occupies. A test that means "two messages" has to
// say so; the repeated-line shape gets its own explicit id below.
let idSeq = 0;
const nextId = () => `msg_${(idSeq += 1)}`;

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

test('transcript: ONE message is billed once, however many lines it occupies', () => {
  // The shape this file's own header states: an assistant message is written as
  // one line per content block, and every line repeats the same `message.id`
  // and the same `usage`. Summing per LINE bills a six-block message six times.
  // Measured over 199 real subagent transcripts on this machine, the per-line
  // sum was 1.91x the per-message one - on the single figure TRC-05 exists to
  // make measurable.
  const block = (usage, timestamp) => JSON.stringify({
    type: 'assistant', agentId: 'a1852a9b36a6c52b8', timestamp,
    message: { id: 'msg_repeat', role: 'assistant', content: [], stop_reason: null, usage },
  });
  const usage = { cache_creation_input_tokens: 12128, cache_read_input_tokens: 61501 };
  const text = [block(usage, T1), block(usage, T1), block(usage, T1)].join('\n') + '\n';
  assert.deepEqual(cacheOf(text), {
    cache_creation_input_tokens: 12128,
    cache_read_input_tokens: 61501,
  }, 'a three-block message was billed three times');

  // A SECOND, genuinely different message still adds - the fold is by id, never
  // a cap on how much one transcript may report.
  const two = text + billed({ cache_read_input_tokens: 1000 }, T2) + '\n';
  assert.deepEqual(cacheOf(two).cache_read_input_tokens, 62501);
});

test('transcript: an entry with no usable message id is still counted', () => {
  // The fold is an id equality test, so an entry carrying no id cannot be
  // folded into anything. Counting it is the safe direction: dropping it would
  // lose real traffic, and the repeated-line shape always carries an id.
  const noId = (usage) => JSON.stringify({
    type: 'assistant', agentId: 'a1', timestamp: T1,
    message: { role: 'assistant', content: [], stop_reason: 'end_turn', usage },
  });
  const text = [noId({ cache_read_input_tokens: 5 }), noId({ cache_read_input_tokens: 7 })].join('\n');
  assert.deepEqual(cacheOf(text), { cache_read_input_tokens: 12 });
});

test('transcript: a cache figure that is not a non-negative integer is DROPPED', () => {
  // A token count cannot be negative or fractional. A negative one would cancel
  // real traffic recorded elsewhere in the same file - the worst shape, because
  // the total still looks plausible - and a value past the safe-integer range
  // cannot be summed without the total going non-finite, which serializes to
  // `null` and records a figure no line ever carried.
  for (const bad of [-100, 1.5, Number.MAX_VALUE, 2 ** 53]) {
    const answer = cacheOf(billed({ cache_read_input_tokens: bad }, T1));
    assert.equal('cache_read_input_tokens' in answer, false, `${bad} was recorded`);
  }
  // A negative on one message does not eat a real figure on another.
  const text = [
    billed({ cache_read_input_tokens: -100 }, T1),
    billed({ cache_read_input_tokens: 100 }, T2),
  ].join('\n');
  assert.deepEqual(cacheOf(text), { cache_read_input_tokens: 100 });
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
// --- the effort the worker actually ran at (TRC-13) --------------------------

/** An assistant line carrying a TOP-LEVEL `effort`, the host's own shape. */
const ran = (effort, timestamp = T2) => line({
  type: 'assistant', agentId: 'a1852a9b36a6c52b8', timestamp, effort,
  message: { id: nextId(), role: 'assistant', content: [], stop_reason: 'end_turn' },
});

test('transcript: every line agreeing answers that value, in the host spelling', () => {
  // The value is the TOP-LEVEL `effort` string - measured 2026-09-02, 5,701 of
  // 5,701 recent assistant lines carry it there. It is what the host actually
  // SERVED, which on a downgraded run is not what the dispatch asked for.
  const text = [user(T1), ran('high', T1), ran('high'), ran('high')].join('\n') + '\n';
  assert.equal(effortOf(text), 'high');
  // Recorded VERBATIM against no enum: a spelling Cadence does not use is the
  // signal, not the error. Validating here would erase a renamed host rung at
  // exactly the moment its appearance matters.
  assert.equal(effortOf([ran('xhigh', T1), ran('xhigh')].join('\n')), 'xhigh');
  assert.equal(effortOf(ran('P4-turbo')), 'P4-turbo');
});

test('transcript: two lines reporting DIFFERENT efforts answer absent', () => {
  // TRC-06's unambiguous-or-nothing, never last-line-wins and never
  // first-line-wins: a transcript reporting two efforts has not said what the
  // worker ran at. 0 of 368 measured transcripts mix values, so this arm is a
  // refusal rather than a merge rule.
  assert.equal(effortOf([ran('high', T1), ran('max')].join('\n')), null);
  assert.equal(effortOf([ran('max', T1), ran('high')].join('\n')), null);
  // ...and a third line agreeing with the first does not break the tie.
  assert.equal(effortOf([ran('high', T1), ran('max'), ran('high')].join('\n')), null);
});

test('transcript: a transcript reporting no effort at all answers absent', () => {
  // 6 of 368 measured transcripts carry no `effort` on any assistant line, so
  // this is an observed state and not a defensive one. Absent is the answer the
  // caller OMITS the key on - the record never stores a placeholder.
  const cases = {
    'assistant lines with no effort key': [user(T1), asst('end_turn', T2)].join('\n'),
    'user lines only': [user(T1), user(T2)].join('\n'),
    'nothing readable at all': '',
    'unparseable lines': 'not json\n{oops\n',
  };
  for (const [why, text] of Object.entries(cases)) assert.equal(effortOf(text), null, why);
});

test('transcript: an effort that is not a non-empty string is not an answer', () => {
  // Anything unreadable is a line reporting nothing, which is the same as a
  // line with no key at all.
  for (const bad of ['', 7, null, true, [], {}, { level: 'max' }]) {
    assert.equal(effortOf(ran(/** @type {any} */ (bad))), null, JSON.stringify(bad));
  }
});

test('transcript: a line reporting NO effort is SKIPPED, not a disagreement', () => {
  // The posture `cacheOf` takes for an entry with no usable `usage`: a missing
  // value is not an ambiguity. The mixed-PRESENCE case is unmeasured in both
  // directions, so the direction chosen keeps a real observation. If this is
  // ever shown wrong the flip is toward absent - losing an observation rather
  // than inventing one - and it is this assertion that flips.
  const text = [ran('high', T1), asst('end_turn', T2), ran('high')].join('\n');
  assert.equal(effortOf(text), 'high');
  // An unreadable value between two agreeing lines is the same skip.
  assert.equal(effortOf([ran('high', T1), ran(''), ran('high')].join('\n')), 'high');
});

test('transcript: an effort nested under `message` is NOT read', () => {
  // 0 of 5,701 measured assistant lines carry it there. Reaching inside the
  // message for a value the host puts at the top level would invent a shape.
  const nested = line({
    type: 'assistant', agentId: 'a1', timestamp: T2,
    message: { id: 'msg_nested', role: 'assistant', content: [], stop_reason: 'end_turn', effort: 'max' },
  });
  assert.equal(effortOf(nested), null);
  // ...and it does not disturb a top-level value on another line either.
  assert.equal(effortOf([ran('high', T1), nested].join('\n')), 'high');
});

test('transcript: the effort rule never throws, whatever it is handed', () => {
  // Same contract as its two siblings: the only caller is a hook that emits
  // nothing on any stream, so a thrown error is just an observation the record
  // silently lost.
  for (const input of [undefined, null, 0, [], {}, Symbol('x'), ' ', 'null', '[]', '{}']) {
    assert.doesNotThrow(() => effortOf(/** @type {any} */ (input)));
    assert.equal(effortOf(/** @type {any} */ (input)), null);
  }
  // A truncated final line is skipped rather than fatal, so it cannot change
  // the answer the complete lines ahead of it already gave.
  const complete = [user(T1), ran('high', T2)].join('\n');
  assert.equal(effortOf(`${complete}\n{"type":"assistant","eff`), 'high');
  assert.equal(effortOf(`${complete}\n{"type":"assistant","eff`), effortOf(complete));
});
