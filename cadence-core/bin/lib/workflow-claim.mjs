// @ts-check
// workflow-claim.mjs - one small file says a workflow is running, so a second one waits when multi-workflow is off.
// The file is made with link(2) from a finished temp file: it either exists whole or not at all, and two racers get one winner.
// No timeout lives here: a timer would free a live run's claim, so a dead holder shows as an age and the caller asks.
'use strict';

import { linkSync, lstatSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CLAIM_FILE = 'cadence-workflow-claim';
/** A label is `<trigger>-<discriminator>` or the analyzer's; this keeps a runaway one out of the file. */
export const MAX_LABEL = 200;

/**
 * Who holds the claim at `file`, or null when nobody does. A file we can't read is still a holder, with no label.
 * @param {string} file
 * @param {number} now
 * @returns {{label: string|null, age_seconds: number}|null}
 */
function holder(file, now) {
  let st;
  try { st = lstatSync(file); } catch { return null; }
  /** @type {any} */
  let body = null;
  if (st.isFile()) { try { body = JSON.parse(readFileSync(file, 'utf8')); } catch { /* unreadable holder */ } }
  const label = body && typeof body.label === 'string' ? body.label : null;
  const at = body && typeof body.at === 'number' ? body.at : st.mtimeMs;
  return { label, age_seconds: Math.max(0, Math.round((now - at) / 1000)) };
}

/**
 * Take the claim in `gitDir`, or say who has it.
 * @param {string} gitDir the repository's common git directory
 * @param {string} label
 * @param {number} [now]
 * @returns {{launch: boolean, holder?: {label: string|null, age_seconds: number}}}
 */
export function claim(gitDir, label, now = Date.now()) {
  const file = join(gitDir, CLAIM_FILE);
  const tmp = `${file}.${process.pid}.${now}`;
  writeFileSync(tmp, JSON.stringify({ label, at: now }), { flag: 'wx' });
  try {
    linkSync(tmp, file);
    return { launch: true };
  } catch (e) {
    if (/** @type {any} */ (e)?.code !== 'EEXIST') throw e;
    return { launch: false, holder: holder(file, now) || { label: null, age_seconds: 0 } };
  } finally {
    try { unlinkSync(tmp); } catch { /* already gone */ }
  }
}

/**
 * Free the claim only when `label` is the holder's. An absent file is fine, so a retry stays idempotent.
 * @param {string} gitDir
 * @param {string} label
 * @param {number} [now]
 * @returns {{released: boolean, holder?: {label: string|null, age_seconds: number}}}
 */
export function release(gitDir, label, now = Date.now()) {
  const file = join(gitDir, CLAIM_FILE);
  const h = holder(file, now);
  if (!h) return { released: false };
  if (h.label !== label) return { released: false, holder: h };
  try { unlinkSync(file); } catch (e) { if (/** @type {any} */ (e)?.code !== 'ENOENT') throw e; }
  return { released: true };
}
