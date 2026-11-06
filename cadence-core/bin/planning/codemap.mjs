// @ts-check
// planning/codemap.mjs - `codemap scan`: the facts layer's spine, every tracked path and its working-tree hash, no model
// --dir names the .planning directory and the project root is its parent, so a root below the repository's top level
// still lists consistent paths; the facts live in .planning/codemap/, which a nested .gitignore keeps out of every commit
'use strict';

import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { readFacts } from '../lib/codemap-facts.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';

const MAP_DIR = 'codemap';
const INDEX_FILE = 'index.json';

/**
 * The map's directory, created when it's missing. A clone can track `.planning` or `.planning/codemap` as a symlink,
 * and a write through one would land outside the repository, so anything there that isn't a real directory is refused.
 * @param {string} dir the planning directory
 * @returns {string|null} the path, or null when it can't be trusted
 */
function mapDir(dir) {
  const real = (p) => {
    try { return lstatSync(p).isDirectory(); } catch (e) { return /** @type {any} */ (e).code === 'ENOENT' ? null : false; }
  };
  if (real(dir) === false) return null;
  const map = join(dir, MAP_DIR);
  const state = real(map);
  if (state === false) return null;
  if (state === null) mkdirSync(map, { recursive: true });
  return map;
}

/** @param {string} dir the planning directory */
function cmdScan(dir) {
  const root = dirname(resolve(dir));
  let rows;
  try {
    rows = readFacts(root);
  } catch {
    return fail('no-git', `${root} is not inside a git repository, so there is nothing to scan`,
      'run from the project\'s repository, or pass --dir naming its .planning directory');
  }
  const map = mapDir(dir);
  if (!map) {
    return fail('unsafe-dir', `${join(dir, MAP_DIR)} or ${dir} exists and is not a real directory`,
      'remove it or replace it with a directory; nothing was written, because a write through a link would leave the repository');
  }
  const ignore = join(map, '.gitignore');
  let held = null;
  try { held = readFileSync(ignore, 'utf8'); } catch { /* absent is the first write */ }
  if (held !== '*\n') atomicWrite(ignore, '*\n');
  atomicWrite(join(map, INDEX_FILE), JSON.stringify({ version: 1, rows }));
  const count = (kind) => rows.filter((r) => r.kind === kind).length;
  return ok({
    action: 'scan', files: rows.length, text: count('text'), binary: count('binary'), over_cap: count('over_cap'),
    symlinks: count('symlink'), gitlinks: count('gitlink'), missing: count('missing'),
  });
}

/**
 * @param {string} dir the planning directory
 * @param {string} sub scan
 * @param {any} _opts
 */
function cmdCodemap(dir, sub, _opts) {
  if (sub === 'scan') return cmdScan(dir);
  return fail('usage', 'codemap <scan>');
}

export { cmdCodemap };
