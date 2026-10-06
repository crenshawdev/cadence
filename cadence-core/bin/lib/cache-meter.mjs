// @ts-check
// cache-meter.mjs - the session's prompt-cache hit rate and its cache breaks,
// per loop: the main loop under MAIN, each agent under its id. The Cadence
// module (hooks/cadence-mod.mjs) steps it from every request's usage; the band
// and the pane draw it.
//
// A loop's hit rate is the share of what it sent that the cache served: cache
// read over cache read, cache write and fresh input. A break is a request that
// read back less than the same loop's previous request cached (read plus
// write). A new model, or a message count that dropped (compaction, /clear, a
// rewind), starts a new prefix, so there is nothing to read back and no break.
// A cache that expired between requests is a break, because it was one.
//
// Live and in memory: a session's figures, gone on a module reload. The trace
// keeps none of it yet (#309).
//
// No imports, no Node globals: the hooks module loads this.
'use strict';

/** The main loop's key. Every agent id is non-empty. */
export const MAIN = '';

/**
 * @typedef {{model: string, messages: number, cached: number}} Prefix
 *   what a loop's last request left cached, and on what
 * @typedef {{read: number, write: number, fresh: number, calls: number, last: number | null,
 *   breaks: number, lost: number, prefix: Prefix | null}} Loop
 *   `last`: the last request's hit rate. `lost`: the tokens the last break
 *   failed to read back.
 * @typedef {{loops: ReadonlyMap<string, Loop>, breaks: number}} Meter
 *   `breaks` counts every loop's, a dropped one's included
 */

/** @type {Meter} */
export const EMPTY_METER = Object.freeze({ loops: new Map(), breaks: 0 });

/** @param {unknown} n */
const count = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * The share the cache served, or null when nothing was sent.
 * @param {number} read
 * @param {number} write
 * @param {number} fresh
 * @returns {number | null}
 */
function rate(read, write, fresh) {
  const total = read + write + fresh;
  return total === 0 ? null : read / total;
}

/**
 * A loop's hit rate over the session, or null before it sent anything.
 * @param {Loop | undefined} loop
 * @returns {number | null}
 */
export function hitRate(loop) {
  return loop ? rate(loop.read, loop.write, loop.fresh) : null;
}

/**
 * The meter after one request of `loop`. A usage it cannot read leaves the
 * meter as it was.
 * @param {Meter} meter
 * @param {string} loop MAIN, or the agent id
 * @param {unknown} model the request's model
 * @param {unknown} messages the request's message count
 * @param {unknown} usage the step's usage
 * @returns {Meter}
 */
export function meterStep(meter, loop, model, messages, usage) {
  if (!usage || typeof usage !== 'object') return meter;
  const u = /** @type {Record<string, unknown>} */ (usage);
  const read = u.cache_read_input_tokens;
  const write = u.cache_creation_input_tokens;
  const fresh = u.input_tokens;
  if (!count(read) || !count(write) || !count(fresh)) return meter;
  const r = /** @type {number} */ (read);
  const w = /** @type {number} */ (write);
  const f = /** @type {number} */ (fresh);

  const was = meter.loops.get(loop);
  const before = was ? was.prefix : null;
  const known = typeof model === 'string' && count(messages);
  const broke = known && before !== null && before.model === model
    && /** @type {number} */ (messages) >= before.messages && r < before.cached;

  /** @type {Loop} */
  const next = {
    read: (was ? was.read : 0) + r,
    write: (was ? was.write : 0) + w,
    fresh: (was ? was.fresh : 0) + f,
    calls: (was ? was.calls : 0) + 1,
    last: rate(r, w, f),
    breaks: (was ? was.breaks : 0) + (broke ? 1 : 0),
    lost: broke && before !== null ? before.cached - r : was ? was.lost : 0,
    prefix: known ? { model: /** @type {string} */ (model), messages: /** @type {number} */ (messages), cached: r + w } : null,
  };
  return { loops: new Map(meter.loops).set(loop, next), breaks: meter.breaks + (broke ? 1 : 0) };
}

/**
 * The meter without a stopped agent's loop. Its breaks stay in the session's.
 * @param {Meter} meter
 * @param {unknown} loop
 * @returns {Meter}
 */
export function meterDrop(meter, loop) {
  if (typeof loop !== 'string' || loop === MAIN || !meter.loops.has(loop)) return meter;
  const loops = new Map(meter.loops);
  loops.delete(loop);
  return { loops, breaks: meter.breaks };
}

/**
 * A rate as `87.9%`, or `-` for none.
 * @param {number | null} r
 */
export function percent(r) {
  return r === null ? '-' : `${(r * 100).toFixed(1)}%`;
}

/**
 * Tokens as `850` or `38.5k`.
 * @param {number} n
 */
export function kilo(n) {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`;
}

/**
 * `1 cache break`, `2 cache breaks`.
 * @param {number} n
 */
export function breaksText(n) {
  return `${n} cache break${n === 1 ? '' : 's'}`;
}
