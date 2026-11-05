// @ts-check
// on-path.mjs - the one statement of "does this name resolve as an executable", shared by `issue-check.mjs` and
// `detect-commands`, because two answers is how an advisory arm and an enforcing arm drift.
// Pure fs, no subprocess: `detect-commands` runs before every executor commit, so `command -v` would spawn each time.
// No env override is read here, on purpose: tests prepend a directory to PATH so the production resolver runs.
// Win32 is a different spelling, not a different answer: tools ship there as `.cmd` shims, so `PATHEXT` is tried too.
'use strict';

import { accessSync, constants } from 'node:fs';
import { delimiter, extname, join } from 'node:path';

/** What `cmd.exe` uses when PATHEXT is unset; not consulted off win32. */
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * The filenames `bin` may be spelled as on this platform, bare name first, then on win32 each PATHEXT extension.
 * A name already carrying one is probed as itself, so `tsc.cmd` never becomes `tsc.cmd.cmd`.
 * @param {string} bin @returns {string[]}
 */
function spellings(bin) {
  if (process.platform !== 'win32') return [bin];
  const exts = (process.env.PATHEXT || DEFAULT_PATHEXT)
    .split(';').map((e) => e.trim()).filter(Boolean);
  const carried = extname(bin).toLowerCase();
  if (carried && exts.some((e) => e.toLowerCase() === carried)) return [bin];
  return [bin, ...exts.map((e) => bin + e)];
}

/**
 * Does `bin` resolve as an executable inside this one directory?
 * `detect-commands` asks this first for eslint and tsc, which sit in `<root>/node_modules/.bin` and needn't be on PATH.
 * Anything that isn't a non-empty string is false, not a throw.
 * @param {unknown} dir @param {unknown} bin @returns {boolean}
 */
export function executableIn(dir, bin) {
  if (typeof dir !== 'string' || !dir || typeof bin !== 'string' || !bin) return false;
  for (const name of spellings(bin)) {
    try { accessSync(join(dir, name), constants.X_OK); return true; } catch { /* next spelling */ }
  }
  return false;
}

/**
 * Is `bin` an executable on the child's PATH? The one resolution site.
 * PATH is read at call time, not at import, or a test's prepended directory would depend on import order.
 * @param {unknown} bin @returns {boolean}
 */
export function onPath(bin) {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    if (executableIn(dir, bin)) return true;
  }
  return false;
}
