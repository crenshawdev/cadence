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

/** Where a start builds the files before one rename puts them in place. @param {string} planningRoot */
export function agileNewDir(planningRoot) {
  return join(planningRoot, `${AGILE_DIR}.new`);
}

/** An epic's file, inside whichever agile folder is being read or built. @param {string} agile @param {string} epic */
export function epicFile(agile, epic) {
  return join(agile, 'epics', epic, 'epic.md');
}
