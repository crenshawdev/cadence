// @ts-check
// agile-paths.mjs - the one place that spells where the agile path keeps its files, so a planning store can move them later
// pure: a planning root in, a path out
'use strict';

import { join } from 'node:path';

const AGILE_DIR = 'agile';

/** @param {string} planningRoot */
export function agileDir(planningRoot) {
  return join(planningRoot, AGILE_DIR);
}

/** Where one start builds the files before a rename puts them in place; the pid keeps two starts apart. @param {string} planningRoot */
export function buildDir(planningRoot, pid = process.pid) {
  return join(planningRoot, `${AGILE_DIR}.new.${pid}`);
}

/** The pid a build folder's name carries, or null when the name isn't one. @param {string} name */
export function buildPid(name) {
  const m = new RegExp(`^${AGILE_DIR}\\.new\\.(\\d+)$`).exec(name);
  return m ? Number(m[1]) : null;
}

/** An epic's file, inside whichever agile folder is being read or built. @param {string} agile @param {string} epic */
export function epicFile(agile, epic) {
  return join(agile, 'epics', epic, 'epic.md');
}
