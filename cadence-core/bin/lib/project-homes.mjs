// @ts-check
// project-homes.mjs - where a project keeps its tasks, its captures and its two findings ledgers, which the two paths don't share
// the state file's marker says which path, so whatever writes or reads one of them asks here and never spells it
'use strict';

import { lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { agileBacklogFile, agileDeclinedFile, agileDir, agileFiledFile, agileTasksDir } from './agile-paths.mjs';
import { declinedPath, ensureRecordsDir, filedPath, makeDir } from './planning-store.mjs';
import { readState } from './project-state.mjs';

/** The old path's tasks folder: beside `phases/`, not in it, or the next milestone close archives it as a phase. */
export const TASKS_DIR = 'tasks';

/** @param {string} planningRoot */
export function onAgilePath(planningRoot) {
  const state = readState(planningRoot);
  return state.kind === 'invalid' && state.reason === 'agile-path';
}

/**
 * The folder that holds each task's own, and how it reads from the planning root.
 * @param {string} planningRoot @returns {{path: string, rel: string}}
 */
export function tasksHome(planningRoot) {
  const path = onAgilePath(planningRoot) ? agileTasksDir(agileDir(planningRoot)) : join(planningRoot, TASKS_DIR);
  return { path, rel: fromRoot(planningRoot, path) };
}

/** The file a capture is added to. @param {string} planningRoot */
export function captureHome(planningRoot) {
  return onAgilePath(planningRoot) ? agileBacklogFile(agileDir(planningRoot)) : join(planningRoot, 'CAPTURE.md');
}

/** @param {string} planningRoot */
export function filedHome(planningRoot) {
  return onAgilePath(planningRoot) ? agileFiledFile(agileDir(planningRoot)) : filedPath(planningRoot);
}

/** @param {string} planningRoot */
export function declinedHome(planningRoot) {
  return onAgilePath(planningRoot) ? agileDeclinedFile(agileDir(planningRoot)) : declinedPath(planningRoot);
}

/** A path under the planning root with `/` between its parts. @param {string} planningRoot @param {string} path */
export function fromRoot(planningRoot, path) {
  return relative(planningRoot, path).split(sep).join('/');
}

/**
 * Why an agile project has no folder to write into, or null. Nothing but a start may make that folder: one made here
 * would read as a release and the next start would refuse. An old-path project is always null.
 * @param {string} planningRoot @returns {string | null}
 */
export function missingRelease(planningRoot) {
  if (!onAgilePath(planningRoot)) return null;
  const agile = agileDir(planningRoot);
  let st = null;
  try { st = lstatSync(agile); } catch { /* a start never got that far */ }
  if (st && st.isDirectory()) return null;
  return `${agile} is not a real folder, so this project has no release - run /cad-agile, which says how to finish its start`;
}

/**
 * Make the ledgers' folder, or say why it can't be used.
 * @param {string} planningRoot @returns {{ok: true} | {ok: false, reason: string}}
 */
export function ensureLedgerDir(planningRoot) {
  if (onAgilePath(planningRoot)) {
    const missing = missingRelease(planningRoot);
    return missing === null ? { ok: true } : { ok: false, reason: missing };
  }
  makeDir(planningRoot);
  const records = ensureRecordsDir(planningRoot);
  return records.ok ? { ok: true } : { ok: false, reason: `the records folder is not usable (${records.reason})` };
}
