// @ts-check
// on-path.mjs - the one statement of "does this name resolve as an executable", for two seams that must not answer it
// differently: `issue-check.mjs` asks about a forge CLI before spawning one, and `planning.mjs`'s `detect-commands` asks
// about a lint or typecheck driver before naming it to an executor. Two answers is how advisory and enforcing arms drift.
// Pure fs, no subprocess: `detect-commands` probes on the path an executor runs before every commit, and `command -v`
// per arm would put child processes there.
// No Cadence env override is read here, on purpose: tests stub a CLI by prepending a directory to the child's PATH so
// the production resolver runs, and an override in this module would break that for both callers. `detect-commands`
// keeps its own behind the `CADENCE_TEST_SEAM` sentinel.
// Win32 is a different spelling, not a different answer: npm, eslint and tsc ship there as `.cmd`/`.ps1` shims, so we
// also try `PATHEXT`'s extensions after the bare name.
'use strict';

import { accessSync, constants } from 'node:fs';
import { delimiter, extname, join } from 'node:path';

/** What `cmd.exe` uses when PATHEXT is unset; not consulted off win32. */
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * The filenames `bin` may be spelled as on this platform, in probe order: the bare name first, then on win32 the name
 * plus each PATHEXT extension. A name already carrying one is probed as itself, so `tsc.cmd` never becomes `tsc.cmd.cmd`.
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
 * `detect-commands` asks this first for eslint and tsc, which a project installs into `<root>/node_modules/.bin` and
 * which needn't be on PATH. Anything that isn't a non-empty string is false, not a throw: callers pass whatever they held.
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
 * PATH is read at call time, not captured at import: a module-load capture would make a test's prepended directory
 * depend on import order.
 * @param {unknown} bin @returns {boolean}
 */
export function onPath(bin) {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    if (executableIn(dir, bin)) return true;
  }
  return false;
}
