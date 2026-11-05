// @ts-check
// reads a worker's own transcript for what only it says: terminal or not and when, cache traffic, and effort
// the SubagentStop payload can't tell finished from handed back mid-turn, and closing an unfinished worker poisons
// every figure denominated in that row's `ms`
// terminal = the last "assistant" line has a non-empty stop_reason but `tool_use`, since stop_sequence is finished too
// three states, not two: unknown lets the caller fall back, or one renamed host field deletes every hook close
// pure: no fs, no emit, no Date, and it never throws, since the only caller is a hook
'use strict';

/**
 * The three answers, grouped under one name because `lib/trace.mjs` already exports a `TERMINAL` and the hook
 * imports from both files.
 */
export const STOP_STATE = Object.freeze({
  TERMINAL: 'terminal',
  NOT_TERMINAL: 'not-terminal',
  UNKNOWN: 'unknown',
});

/** The `stop_reason` that means the worker is blocked on a tool result. */
const TOOL_USE = 'tool_use';

/**
 * The transcript's `"assistant"` lines, in file order. One copy of the walk, so two readers of one transcript can't
 * disagree about which lines are in it. Anything but a non-empty string yields nothing.
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
    try { o = JSON.parse(t); } catch { continue; } // a truncated tail (host still appending) or a foreign line
    if (o && typeof o === 'object' && o.type === 'assistant') yield o;
  }
}

/**
 * The assistant entries parsed once, so a caller asking all three questions below walks the file one time. Each
 * takes this array or the raw text.
 * @param {unknown} text @returns {any[]}
 */
export function transcriptEntries(text) {
  return [...assistantEntries(text)];
}

/** @param {unknown} input transcript text, or what `transcriptEntries` returned */
function entriesOf(input) {
  return Array.isArray(input) ? input : assistantEntries(input);
}

// the host's own spelling, so a figure joins back to its transcript line
const CACHE_FIELDS = ['cache_creation_input_tokens', 'cache_read_input_tokens'];

/**
 * The two cache figures a worker billed, summed across its whole transcript. Each `usage` is one billed request, and
 * the read sum counts a cached prefix once per turn, so it isn't a window and never reaches the `roles` bill.
 * @param {any} text the transcript's bytes, the same argument `terminalOf` takes
 * @returns {{cache_creation_input_tokens?: number, cache_read_input_tokens?: number}}
 * Each key is present only where an assistant entry carried a finite numeric value, never 0: absent says the figure
 * was never reported, and 0 would claim no traffic.
 */
export function cacheOf(text) {
  /** @type {Record<string, number>} */
  const sums = {};
  // a message is one line per content block, each repeating the same id and usage: summing per line over-bills it
  const billed = new Set();
  for (const entry of entriesOf(text)) {
    const message = entry.message && typeof entry.message === 'object'
      ? entry.message : null;
    const usage = message ? message.usage : null;
    if (!usage || typeof usage !== 'object') continue;
    // no usable id can't be folded into anything, so it's counted: dropping it loses real traffic
    const id = typeof message.id === 'string' && message.id ? message.id : null;
    if (id !== null) {
      if (billed.has(id)) continue;
      billed.add(id);
    }
    for (const field of CACHE_FIELDS) {
      const v = usage[field];
      // only non-negative integers count: a string like "1,000" would concatenate, a negative would cancel real traffic
      if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) continue;
      sums[field] = (sums[field] || 0) + v;
    }
  }
  return sums;
}

/**
 * Whether a worker reached a terminal entry, and when.
 * @param {any} text the transcript's bytes; anything but a non-empty string answers `unknown`
 * @returns {{state: 'terminal'|'not-terminal'|'unknown', ts: string|null}}
 * `ts` is the terminal entry's own `timestamp`, byte for byte, and null on every other answer and on a terminal
 * entry with no readable timestamp.
 */
export function terminalOf(text) {
  if (!Array.isArray(text) && (typeof text !== 'string' || !text)) {
    return { state: STOP_STATE.UNKNOWN, ts: null };
  }

  /** @type {any} */
  let last = null;
  for (const entry of entriesOf(text)) last = entry;
  // a user-only transcript, an unparseable file or a layout we don't recognize: nothing to decide on
  if (!last) return { state: STOP_STATE.UNKNOWN, ts: null };

  const message = last.message;
  if (!message || typeof message !== 'object') return { state: STOP_STATE.UNKNOWN, ts: null };
  // no stop_reason key is a shape change, not a worker mid-turn; calling it not-terminal would suppress every close
  if (!('stop_reason' in message)) return { state: STOP_STATE.UNKNOWN, ts: null };

  const stop = message.stop_reason;
  // `null` is the recorded in-turn value and a real answer
  if (stop === null) return { state: STOP_STATE.NOT_TERMINAL, ts: null };
  if (typeof stop !== 'string' || !stop) return { state: STOP_STATE.UNKNOWN, ts: null };
  if (stop === TOOL_USE) return { state: STOP_STATE.NOT_TERMINAL, ts: null };

  const ts = typeof last.timestamp === 'string' && last.timestamp ? last.timestamp : null;
  return { state: STOP_STATE.TERMINAL, ts };
}
/**
 * The effort the worker actually ran at, off its own transcript. `closeForStop` puts it on both writes the hook
 * makes, the `return` and the `worker_cache` fact. It is the top-level `effort` on assistant lines, what the host
 * actually served, and is never checked against the rung enum.
 * @param {any} text the transcript's bytes, the same argument `cacheOf` and `terminalOf` take
 * @returns {string|null}
 * The host's spelling, byte for byte, when every assistant line that reported an effort reported the same one. Null
 * when two differ, when none reported one, and for anything unreadable; the caller omits the key on null.
 */
export function effortOf(text) {
  /** @type {string|null} */
  let agreed = null;
  for (const entry of entriesOf(text)) {
    const v = entry.effort;
    // a line with no readable effort is missing, not ambiguous, so skip it the way cacheOf skips an entry with no usage
    if (typeof v !== 'string' || !v) continue;
    if (agreed === null) { agreed = v; continue; }
    // two lines, two answers: the transcript hasn't said what the worker ran at, so neither do we
    if (v !== agreed) return null;
  }
  return agreed;
}
