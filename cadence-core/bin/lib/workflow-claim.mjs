// @ts-check
// workflow-claim.mjs - one small file says a workflow is running, so a second one waits when multi-workflow is off.
// The file is made with link(2) from a finished temp file: it either exists whole or not at all, and two racers get one winner.
// No timeout lives here: a timer would free a live run's claim, so a dead holder shows as an age and the caller asks.
// A label can be reused by a later run, so every claim carries its own id and release matches that id, never the label.
'use strict';

import { randomUUID } from 'node:crypto';
import { linkSync, lstatSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CLAIM_FILE = 'cadence-workflow-claim';
/** A label is `<trigger>-<discriminator>` or the analyzer's; this keeps a runaway one out of the file. */
export const MAX_LABEL = 200;

/**
 * Who holds the claim at `file`, or null when nobody does. A file we can't read is still a holder, with no label and no id.
 * @param {string} file
 * @param {number} now
 * @returns {{label: string|null, id: string|null, age_seconds: number}|null}
 */
function holder(file, now) {
  let st;
  try { st = lstatSync(file); } catch { return null; }
  /** @type {any} */
  let body = null;
  if (st.isFile()) { try { body = JSON.parse(readFileSync(file, 'utf8')); } catch { /* unreadable holder */ } }
  const label = body && typeof body.label === 'string' ? body.label : null;
  const id = body && typeof body.id === 'string' ? body.id : null;
  const at = body && typeof body.at === 'number' ? body.at : st.mtimeMs;
  return { label, id, age_seconds: Math.max(0, Math.round((now - at) / 1000)) };
}

/**
 * Take the claim in `gitDir`, or say who has it. A win returns the claim's own id, which release must present.
 * @param {string} gitDir the repository's common git directory
 * @param {string} label
 * @param {number} [now]
 * @returns {{launch: boolean, id?: string, holder?: {label: string|null, id: string|null, age_seconds: number}}}
 */
export function claim(gitDir, label, now = Date.now()) {
  const file = join(gitDir, CLAIM_FILE);
  const id = randomUUID();
  const tmp = `${file}.${id}`;
  writeFileSync(tmp, JSON.stringify({ label, id, at: now }), { flag: 'wx' });
  try {
    linkSync(tmp, file);
    return { launch: true, id };
  } catch (e) {
    if (/** @type {any} */ (e)?.code !== 'EEXIST') throw e;
    return { launch: false, holder: holder(file, now) || { label: null, id: null, age_seconds: 0 } };
  } finally {
    try { unlinkSync(tmp); } catch { /* already gone */ }
  }
}

/**
 * Free the claim only when its id is `id`; with `stale`, only a claim that has no id (one from before ids, or unreadable).
 * An absent file is fine, so a retry stays idempotent.
 * Not strictly compare-and-delete: POSIX has no such call, so this narrows the window with rename + recheck rather than closing it.
 * @param {string} gitDir
 * @param {string|null} id
 * @param {{now?: number, stale?: boolean}} [opts]
 * @returns {{released: boolean, holder?: {label: string|null, id: string|null, age_seconds: number}}}
 */
export function release(gitDir, id, { now = Date.now(), stale = false } = {}) {
  const file = join(gitDir, CLAIM_FILE);
  /** @param {{id: string|null}} h */
  const mine = (h) => (stale ? h.id === null : id !== null && h.id === id);
  const h = holder(file, now);
  if (!h) return { released: false };
  if (!mine(h)) return { released: false, holder: h };
  // rename is won by one racer; the file we hold may not be the one we read, so compare again before deleting it
  const taken = `${file}.release.${randomUUID()}`;
  try { renameSync(file, taken); } catch (e) {
    if (/** @type {any} */ (e)?.code === 'ENOENT') return { released: false };
    throw e;
  }
  try {
    const t = holder(taken, now);
    if (t && mine(t)) return { released: true };
    // we took somebody else's claim: put it back; EEXIST means a newer claim is live, so leave that one alone
    try { linkSync(taken, file); } catch (e) { if (/** @type {any} */ (e)?.code !== 'EEXIST') throw e; }
    return { released: false, ...(t ? { holder: t } : {}) };
  } finally {
    try { unlinkSync(taken); } catch { /* already gone */ }
  }
}
