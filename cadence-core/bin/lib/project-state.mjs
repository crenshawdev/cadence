// @ts-check
// project-state.mjs - the one reader and writer of `.planning/records/state.json`, where a project's phase, plan and
// requirement status, its cursor and whether a cycle is open live
// node: builtins plus the write module, on purpose: route.mjs and the log writers read the stamp through this file
// the stamp is `layout`, a number of this file's own, never the plugin version and never `UAT_FIELDS_VERSION`
// `version` and `generation` are the two keys the Rust-era `.planning/state.json` opens with, so neither is used here,
// and nothing in this file opens that path: a file at that name is a leftover, never state and never a stamp
// a read answers with a value and never throws; a write validates, takes the lock and replaces the file atomically
'use strict';

import { readFileSync } from 'node:fs';
import { atomicWrite, ensureRecordsDir, statePath, withPlanningFileLock } from './planning-store.mjs';

export { statePath };

/** The layout this code writes and reads. Bump it when the file's shape changes. */
export const STATE_LAYOUT = 1;

/** The key the stamp sits under. Not `version`, not `generation`. */
export const STAMP_KEY = 'layout';

// the six lifecycle words a cursor may carry; planning-files.mjs owns the list and this file can't import it, so a test pins them equal
export const CURSOR_WORDS = Object.freeze([
  'ready to plan', 'context gathered', 'planned', 'executed', 'phase complete', 'paused',
]);

/** The four words `status` gives a phase. */
export const PHASE_STATUSES = Object.freeze(['unplanned', 'planned', 'executed', 'complete']);

/**
 * @typedef {{phase: number, status: string, next: string, updated: string, plan?: {k: number, j: number, name?: string}}} StateCursor
 * @typedef {{n: number, name: string, description: string, status: string, plans: {file: string, finished: boolean}[]}} StatePhase
 * @typedef {{id: string, phase: number | null, status: string}} StateRequirement
 * @typedef {{cycleOpen: boolean, cursor: StateCursor | null, phases: StatePhase[], requirements: StateRequirement[]}} ProjectState
 */

const isObj = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isLine = (/** @type {unknown} */ v) => typeof v === 'string' && !/[\r\n]/.test(v);
const isWord = (/** @type {unknown} */ v) => isLine(v) && /** @type {string} */ (v).trim() !== '';

/**
 * Check a state's shape and rebuild it in the file's key order, or say which field is wrong.
 * Rebuilding is what makes a rewrite of an unchanged state byte-identical, and drops anything this layout doesn't name.
 * @param {unknown} raw
 * @returns {{ok: true, state: ProjectState} | {ok: false, detail: string}}
 */
function shapeOf(raw) {
  const bad = (/** @type {string} */ what) => ({ ok: /** @type {const} */ (false), detail: what });
  if (!isObj(raw)) return bad('the state is not an object');
  const s = /** @type {Record<string, any>} */ (raw);
  if (typeof s.cycleOpen !== 'boolean') return bad('cycleOpen is not true or false');

  /** @type {StateCursor | null} */
  let cursor = null;
  if (s.cursor !== null) {
    const c = s.cursor;
    if (!isObj(c)) return bad('cursor is neither an object nor null');
    if (!isNum(c.phase)) return bad('cursor.phase is not a phase number');
    if (!CURSOR_WORDS.includes(c.status)) return bad('cursor.status is not one of the six lifecycle words');
    if (!isWord(c.next)) return bad('cursor.next is not one non-empty line');
    if (typeof c.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.updated)) {
      return bad('cursor.updated is not a YYYY-MM-DD date');
    }
    cursor = { phase: c.phase, status: c.status, next: c.next, updated: c.updated };
    if (c.plan !== undefined) {
      const p = c.plan;
      if (!isObj(p) || !Number.isInteger(p.k) || !Number.isInteger(p.j) || p.k < 1 || p.j < 1
        || (p.name !== undefined && !isWord(p.name))) {
        return bad('cursor.plan is not {k, j, name?}');
      }
      cursor.plan = { k: p.k, j: p.j, ...(p.name !== undefined ? { name: p.name } : {}) };
    }
  }

  if (!Array.isArray(s.phases)) return bad('phases is not a list');
  /** @type {StatePhase[]} */
  const phases = [];
  for (const [i, p] of s.phases.entries()) {
    const at = `phases[${i}]`;
    if (!isObj(p)) return bad(`${at} is not an object`);
    if (!isNum(p.n)) return bad(`${at}.n is not a phase number`);
    if (!isWord(p.name)) return bad(`${at}.name is not one non-empty line`);
    if (!isLine(p.description)) return bad(`${at}.description is not one line`);
    if (!PHASE_STATUSES.includes(p.status)) return bad(`${at}.status is not one of ${PHASE_STATUSES.join(', ')}`);
    if (!Array.isArray(p.plans)) return bad(`${at}.plans is not a list`);
    const plans = [];
    for (const [j, pl] of p.plans.entries()) {
      if (!isObj(pl) || !isWord(pl.file) || /[/\\]/.test(pl.file) || typeof pl.finished !== 'boolean') {
        return bad(`${at}.plans[${j}] is not {file, finished}`);
      }
      plans.push({ file: pl.file, finished: pl.finished });
    }
    phases.push({ n: p.n, name: p.name, description: p.description, status: p.status, plans });
  }

  if (!Array.isArray(s.requirements)) return bad('requirements is not a list');
  /** @type {StateRequirement[]} */
  const requirements = [];
  for (const [i, r] of s.requirements.entries()) {
    const at = `requirements[${i}]`;
    if (!isObj(r)) return bad(`${at} is not an object`);
    if (!isWord(r.id)) return bad(`${at}.id is not one non-empty line`);
    if (r.phase !== null && !isNum(r.phase)) return bad(`${at}.phase is neither a phase number nor null`);
    if (!isLine(r.status)) return bad(`${at}.status is not one line`);
    requirements.push({ id: r.id, phase: r.phase, status: r.status });
  }
  return { ok: true, state: { cycleOpen: s.cycleOpen, cursor, phases, requirements } };
}

/**
 * The file's bytes for a state already through `shapeOf`: stable key order, two-space indent, trailing newline.
 * @param {ProjectState} state
 */
function serialize(state) {
  return `${JSON.stringify({ [STAMP_KEY]: STATE_LAYOUT, ...state }, null, 2)}\n`;
}

/**
 * @typedef {{kind: 'absent'} | {kind: 'valid', state: ProjectState}
 *   | {kind: 'invalid', reason: 'not-json' | 'no-stamp' | 'newer-layout' | 'bad-shape' | 'unreadable', detail: string}} StateRead
 */

/**
 * Judge a file's text. Order matters: the stamp is looked for before the shape, so a Rust-era file reads as
 * `no-stamp` and not as a field that is wrong.
 * @param {string} text
 * @returns {StateRead}
 */
function judge(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) {
    return { kind: 'invalid', reason: 'not-json', detail: `it does not parse as JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isObj(raw) || !(STAMP_KEY in raw)) {
    return { kind: 'invalid', reason: 'no-stamp', detail: `it carries no \`${STAMP_KEY}\` number` };
  }
  const layout = raw[STAMP_KEY];
  if (!Number.isInteger(layout) || layout < 1) {
    return { kind: 'invalid', reason: 'bad-shape', detail: `\`${STAMP_KEY}\` is not a positive whole number` };
  }
  if (layout > STATE_LAYOUT) {
    return { kind: 'invalid', reason: 'newer-layout',
      detail: `it is layout ${layout} and this Cadence reads up to layout ${STATE_LAYOUT} - update Cadence` };
  }
  const shaped = shapeOf(raw);
  if (shaped.ok === false) return { kind: 'invalid', reason: 'bad-shape', detail: shaped.detail };
  return { kind: 'valid', state: shaped.state };
}

/**
 * The state file, as a value: absent, a valid state, or invalid with the reason.
 * @param {string} planningRoot
 * @returns {StateRead}
 */
export function readState(planningRoot) {
  let text;
  try { text = readFileSync(statePath(planningRoot), 'utf8'); } catch (e) {
    const code = e && /** @type {any} */ (e).code;
    // no records folder at all (or a file where it belongs) is the same answer as no file: nothing was ever stamped here
    if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'absent' };
    return { kind: 'invalid', reason: 'unreadable', detail: `it could not be read: ${code || String(e)}` };
  }
  return judge(text);
}

/**
 * @typedef {{ok: true, changed: boolean} | {ok: false, reason: 'bad-shape' | 'newer-layout' | 'records-unwritable'
 *   | 'state-locked' | 'write-failed', detail: string}} StateWrite
 */

/**
 * Write the state to disk while the lock is held. An unchanged state writes nothing, so a second identical write
 * leaves the same bytes and the same mtime. A newer layout on disk is never replaced; any other invalid file is,
 * since that is how a damaged one is rebuilt.
 * @param {string} file @param {ProjectState} state
 * @returns {StateWrite}
 */
function commit(file, state) {
  const next = serialize(state);
  let prior = null;
  try { prior = readFileSync(file, 'utf8'); } catch { /* absent, the first write */ }
  if (prior !== null) {
    const was = judge(prior);
    if (was.kind === 'invalid' && was.reason === 'newer-layout') return { ok: false, reason: 'newer-layout', detail: was.detail };
    if (prior === next) return { ok: true, changed: false };
  }
  atomicWrite(file, next);
  return { ok: true, changed: true };
}

/**
 * Run a body holding the state file's lock, turning a refused lock and a throwing write into values.
 * @param {string} planningRoot @param {(file: string) => StateWrite} body
 * @returns {StateWrite}
 */
function locked(planningRoot, body) {
  const made = ensureRecordsDir(planningRoot);
  if (made.ok === false) return { ok: false, reason: 'records-unwritable', detail: `the records folder cannot be used: ${made.reason}` };
  const file = statePath(planningRoot);
  try {
    const run = withPlanningFileLock(file, () => body(file), 'state-locked');
    return run.ok === false ? { ok: false, reason: 'state-locked', detail: run.detail } : run.value;
  } catch (e) {
    return { ok: false, reason: 'write-failed', detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Validate and write a whole state under the lock.
 * @param {string} planningRoot @param {ProjectState} state
 * @returns {StateWrite}
 */
export function writeState(planningRoot, state) {
  const shaped = shapeOf(state);
  if (shaped.ok === false) return { ok: false, reason: 'bad-shape', detail: shaped.detail };
  return locked(planningRoot, (file) => commit(file, shaped.state));
}

/**
 * Read, change and write with the lock held across all three, so two seams updating different facts can't erase each
 * other. `change` gets a copy and returns the next state. A file that is absent or invalid is a refusal, not a
 * rebuild: this is for a project that already has a state.
 * @param {string} planningRoot @param {(state: ProjectState) => ProjectState} change
 * @returns {(StateWrite & {ok: true, state: ProjectState}) | Exclude<StateWrite, {ok: true}> | {ok: false, reason: 'state-absent' | 'state-invalid', detail: string}}
 */
export function updateState(planningRoot, change) {
  // an unlocked look first, so a project with no state gets its refusal without a records folder appearing
  if (readState(planningRoot).kind === 'absent') return { ok: false, reason: 'state-absent', detail: 'there is no state file to update' };
  // one holder, so the body's assignments aren't narrowed away from the code after it
  const box = /** @type {{result: ProjectState | null, refused: {reason: 'state-absent' | 'state-invalid', detail: string} | null}} */ ({ result: null, refused: null });
  const wrote = locked(planningRoot, (file) => {
    const now = readState(planningRoot);
    if (now.kind === 'absent') { box.refused = { reason: 'state-absent', detail: 'there is no state file to update' }; return { ok: true, changed: false }; }
    if (now.kind === 'invalid') { box.refused = { reason: 'state-invalid', detail: `${file}: ${now.detail}` }; return { ok: true, changed: false }; }
    const next = shapeOf(change(structuredClone(now.state)));
    if (next.ok === false) return { ok: false, reason: 'bad-shape', detail: next.detail };
    box.result = next.state;
    return commit(file, next.state);
  });
  if (box.refused) return { ok: false, ...box.refused };
  return wrote.ok && box.result ? { ...wrote, state: box.result } : /** @type {Exclude<StateWrite, {ok: true}>} */ (wrote);
}
