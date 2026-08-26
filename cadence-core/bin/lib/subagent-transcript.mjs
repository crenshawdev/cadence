// @ts-check
// subagent-transcript.mjs - the pure rule that reads a worker's OWN transcript
// and answers what only that file can say: did the worker reach a terminal
// entry, what instant does that entry carry, and how much cache traffic did the
// worker bill along the way.
//
// WHY IT EXISTS. `SubagentStop` fires when the host says a subagent stopped,
// and the payload carries no field that distinguishes "finished" from "handed
// back mid-turn" - `stop_hook_active` is documented for `Stop` and is not a
// `SubagentStop` field (D-09), so there is nothing on the payload to gate on.
// A close written for a worker that has NOT finished ends a bracket early: the
// hand-written close that arrives later folds into a row whose `end` is wrong,
// and every figure denominated in that row's `ms` is wrong with it. The one
// piece of evidence the payload DOES point at is the worker's own transcript,
// through its documented `transcript_path`.
//
// THE SHAPE, measured 2026-08-26 over the 1,289 subagent transcripts on this
// machine at `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`.
// Every line is a JSON object carrying `type`, an ISO-8601 `timestamp` and
// `agentId`. An assistant MESSAGE is written as one line per content block, and
// only the block that ends the message carries a real `message.stop_reason`;
// the blocks before it carry `null`. So the question is answered by the LAST
// `"assistant"` line in the file and by nothing else.
//
// TERMINAL is: that line's `message.stop_reason` is a non-empty string OTHER
// than `tool_use`. Stated as an exclusion rather than as `=== 'end_turn'` on
// purpose - a 303-file sample of transcripts older than a day answers
// `end_turn` 254 times, `tool_use` 14, `null` 34 and `stop_sequence` once, and
// an equality test would have called that `stop_sequence` worker unfinished.
// `tool_use` means the worker is blocked on a tool result and `null` means the
// last recorded block is inside a turn the host never closed out, so neither is
// a worker that finished.
//
// THE ACCEPTED COST, stated rather than discovered later: 48 of those 303
// finished transcripts, 16%, end on `tool_use` or `null`. A worker whose
// transcript ends that way gets NO hook close, so if its session also dies
// before the hand-written close it stays `unpaired` - which is the pre-hook
// behaviour, visible on the record rather than silently mispriced. That is the
// trade this rule makes: an absent close is a gap a reader can see, an early
// close is a figure a reader cannot tell from a real one.
//
// THREE STATES, not two. `unknown` is the answer for a transcript that is
// absent, empty, unparseable, carries no assistant line, or carries an
// assistant line whose shape this rule does not recognize. It exists so the
// caller can degrade to what it does today rather than delete the closes it
// writes today: a two-state answer would fold "the worker did not finish"
// together with "there was nothing to read", and the first time the host stops
// supplying the file, or renames a field inside it, every hook close in the
// record would disappear at once and silently. The Claude Code sub-agents
// documentation states the transcript layout carries no stability guarantee,
// which is exactly why an unrecognized shape answers `unknown` instead of
// guessing at a rule for it.
//
// THE CACHE FIGURES, and why they are SUMMED. Every assistant entry carries a
// `message.usage`, and on it `cache_creation_input_tokens` and
// `cache_read_input_tokens`. Each `usage` describes ONE billed request, so the
// SUM across a worker's entries is that worker's total billed cache traffic -
// the quantity a prompt-cache claim is argued in, and the only one that can be
// compared between two dispatches. A MAX would answer how large the cached
// prefix got at its biggest, which says nothing about what the dispatch cost and
// cannot be compared across two workers with different turn counts. The figures
// are not on the host's return, so no hand-written close can ever carry them
// (D-11): this file is the only place they exist.
//
// AND WHAT THEY ARE NOT. The read figure counts one cached prefix ONCE PER TURN,
// so it is not a window size and is denominated differently from a bracket's
// `tokens`, which behaves like the dispatch's FINAL window. Measured 2026-08-26
// on this machine, one 292-assistant worker sums to 33,033,480 cache-read tokens
// against a six-figure bracket `tokens`; a reader that took the two for the same
// kind of number would misprice every role it touched. That is why they ride the
// bracket row and never reach the `roles` block's token bill (D-03).
//
// A TRUNCATED LINE IS SKIPPED, never fatal: the host appends to this file while
// the hook may already be reading it, so a partial tail must not cost the
// caller every complete line ahead of it. That is the posture
// `planning/core.mjs`'s `readReadsRecords` states for the same hazard.
//
// NEVER THROWS. The only caller is a hook that emits nothing on any stream, so
// there is no reader for a fault and a thrown error would just be a close the
// record silently lost.
//
// Pure rule: no fs, no emit, no process, no Date, no randomness. The disk half
// - resolving `transcript_path` and reading it under a byte ceiling - lives in
// `bin/subagent-trace.mjs`, the same split `lib/subagent-trace.mjs` uses.
'use strict';

/**
 * The three answers, so no caller spells one of them as a bare string. Grouped
 * under one name rather than exported as three bare constants because
 * `lib/trace.mjs` already exports a `TERMINAL` - its list of terminal EVENT
 * names - and the hook's disk half imports from both files.
 */
export const STOP_STATE = Object.freeze({
  TERMINAL: 'terminal',
  NOT_TERMINAL: 'not-terminal',
  UNKNOWN: 'unknown',
});

/** The `stop_reason` that means the worker is blocked on a tool result. */
const TOOL_USE = 'tool_use';

/**
 * The transcript's `"assistant"` lines, in file order. ONE copy of the line
 * walk, because both answers below read the same file for the same worker on
 * the same trigger and a second copy of the skip rules is how two readers of one
 * transcript start disagreeing about which lines are in it.
 *
 * Anything that is not a non-empty string yields nothing at all, which is what
 * lets an absent, empty or over-cap file arrive here as an ordinary argument.
 * @param {any} text
 * @returns {Generator<any>}
 */
function* assistantEntries(text) {
  if (typeof text !== 'string' || !text) return;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    /** @type {any} */
    let o;
    try { o = JSON.parse(t); } catch { continue; } // a partial or foreign line
    if (o && typeof o === 'object' && o.type === 'assistant') yield o;
  }
}

/** The two `message.usage` fields `cacheOf` sums, in the host's own spelling. */
const CACHE_FIELDS = ['cache_creation_input_tokens', 'cache_read_input_tokens'];

/**
 * The two cache figures a worker billed, summed across its whole transcript.
 *
 * @param {any} text the transcript's own bytes, INJECTED - the whole file as a
 *   string, the same argument `terminalOf` takes.
 * @returns {{cache_creation_input_tokens?: number, cache_read_input_tokens?: number}}
 *   Each key is present only where at least one assistant entry carried a
 *   NUMERIC, finite value for it, and ABSENT otherwise - never 0. An absent key
 *   says the transcript never reported the figure; a zero would claim the worker
 *   billed no cache traffic, and this record keeps those two claims apart
 *   everywhere. The keys take the host's OWN spelling so a bracket figure joins
 *   back to the transcript line it was summed from with no translation table.
 */
export function cacheOf(text) {
  /** @type {Record<string, number>} */
  const sums = {};
  // ONE MESSAGE IS BILLED ONCE, however many LINES it occupies. This file's own
  // header states the shape: an assistant message is written as one line per
  // content block, and every one of those lines repeats the SAME `message.id`
  // and the SAME `usage` object. Summing per LINE therefore bills a
  // six-block message six times. Measured 2026-08-26 over 199 real subagent
  // transcripts on this machine: 1,119,841,751 cache-read tokens summed per
  // line against 585,293,789 summed per message - the shipped figure was 1.91x
  // the traffic that actually happened, on the one number TRC-05 exists to make
  // measurable.
  const billed = new Set();
  for (const entry of assistantEntries(text)) {
    const message = entry.message && typeof entry.message === 'object'
      ? entry.message : null;
    const usage = message ? message.usage : null;
    if (!usage || typeof usage !== 'object') continue;
    // An entry with no usable id cannot be folded into anything, so it is
    // counted: dropping it would lose real traffic, and the repeated-line shape
    // this guards against always carries an id.
    const id = typeof message.id === 'string' && message.id ? message.id : null;
    if (id !== null) {
      if (billed.has(id)) continue;
      billed.add(id);
    }
    for (const field of CACHE_FIELDS) {
      const v = usage[field];
      // The guard `lib/trace.mjs` already puts on `tokens`, `turns` and
      // `duration_ms`, for the identical hazard: a host or hand-edited line
      // carrying `"cache_read_input_tokens": "1,000"` must contribute NOTHING
      // rather than be string-concatenated onto a numeric field a caller sums.
      // A token count is additionally a NON-NEGATIVE INTEGER: a negative value
      // would cancel real traffic recorded elsewhere in the same file, and a
      // fractional one would record a token that cannot exist.
      if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) continue;
      sums[field] = (sums[field] || 0) + v;
    }
  }
  return sums;
}

/**
 * Whether a worker reached a terminal entry, and when.
 *
 * @param {any} text the transcript's own bytes, INJECTED - the whole file as a
 *   string. Anything that is not a non-empty string answers `unknown`, which is
 *   what an absent, empty or over-cap file arrives as.
 * @returns {{state: 'terminal'|'not-terminal'|'unknown', ts: string|null}}
 *   `ts` is the terminal entry's own `timestamp`, quoted byte for byte and
 *   never reformatted, and is null on every other answer and on a terminal
 *   entry that carried no readable timestamp.
 */
export function terminalOf(text) {
  if (typeof text !== 'string' || !text) return { state: STOP_STATE.UNKNOWN, ts: null };

  /** @type {any} */
  let last = null;
  for (const entry of assistantEntries(text)) last = entry;
  // No assistant line at all: a user-only transcript, an unparseable file, or a
  // layout this rule does not recognize. Nothing to decide on.
  if (!last) return { state: STOP_STATE.UNKNOWN, ts: null };

  const message = last.message;
  if (!message || typeof message !== 'object') return { state: STOP_STATE.UNKNOWN, ts: null };
  // An assistant message with NO `stop_reason` key is a shape change, not a
  // worker mid-turn: every message in the measured corpus carries the key, with
  // `null` as its in-turn value. Reporting `not-terminal` here would suppress
  // every close the first time the field moved.
  if (!('stop_reason' in message)) return { state: STOP_STATE.UNKNOWN, ts: null };

  const stop = message.stop_reason;
  // `null` is the recorded in-turn value and is a real answer: not terminal.
  if (stop === null) return { state: STOP_STATE.NOT_TERMINAL, ts: null };
  // Any other non-string is a shape this rule cannot read.
  if (typeof stop !== 'string' || !stop) return { state: STOP_STATE.UNKNOWN, ts: null };
  if (stop === TOOL_USE) return { state: STOP_STATE.NOT_TERMINAL, ts: null };

  const ts = typeof last.timestamp === 'string' && last.timestamp ? last.timestamp : null;
  return { state: STOP_STATE.TERMINAL, ts };
}
