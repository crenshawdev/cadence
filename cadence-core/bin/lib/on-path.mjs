// @ts-check
// on-path.mjs - the ONE statement of "does this NAME resolve as an executable",
// asked by two seams that must not answer it differently. `issue-check.mjs`
// asks it about a forge CLI before it spawns one; `planning.mjs`'s
// `detect-commands` asks it about the driver of a lint or typecheck command
// before it NAMES that command to an executor. The second caller is why the
// rule left issue-check.mjs: a seam that tells an executor to run `ruff check .`
// on a machine with no ruff has answered about a project's manifests rather
// than about a command anyone can run, and two seams deciding "reachable"
// their own way is how an advisory arm and an enforcing arm start disagreeing.
//
// PURE fs. No subprocess, ever: `detect-commands` probes up to two names per
// slot on the path an executor runs before EVERY commit, and `command -v` per
// arm would put child processes there where the seam has none today
// (phase 3 D-10). No `emit`, no envelope, no I/O beyond `accessSync` - callers
// own their own warning text, the way `lib/require-int.mjs` leaves the reason
// string to its callers.
//
// NO CADENCE ENV OVERRIDE IS READ HERE, and that omission is load-bearing.
// `issue-check.mjs`'s header promises that a test injects a stub by prepending
// a directory to the CHILD's PATH so the PRODUCTION resolver is what runs, and
// an override honoured inside this module would break that promise for both
// callers at once. `detect-commands` needs one for its own fixtures, so it
// keeps it at ITS call site, behind the `CADENCE_TEST_SEAM` sentinel.
//
// WIN32 IS NOT A DIFFERENT ANSWER, it is a different spelling (phase 3 D-09).
// `npm`, `npx` and `tsc` ship on Windows as `.cmd`/`.ps1` shims, so a bare
// `join(dir, bin)` finds nothing for any of them and both callers would report
// every tool unreachable on a platform no file in this tree excludes. The
// lookup therefore tries `PATHEXT`'s extensions after the bare name, which is
// the OS's own rule, and nowhere else does the platform change what is asked.
'use strict';

import { accessSync, constants } from 'node:fs';
import { delimiter, extname, join } from 'node:path';

/** What `cmd.exe` uses when PATHEXT is unset. Not consulted off win32. */
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * The filenames `bin` may be spelled as on this platform, in probe order: the
 * name itself first everywhere, then - on win32 only - the name plus each
 * PATHEXT extension. A name that ALREADY carries one of those extensions is
 * probed as itself alone, so `tsc.cmd` is never probed as `tsc.cmd.cmd`.
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
 * Does `bin` resolve as an executable inside THIS ONE directory?
 *
 * The half `detect-commands` needs for an `npx`-delegated arm, which resolves
 * its tool out of `<root>/node_modules/.bin` rather than off PATH at all.
 * Anything that is not a non-empty string on either side is false rather than
 * a throw: the callers hand this whatever their own inputs held.
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
 * Is `bin` an executable on the CHILD's PATH? The one resolution site.
 *
 * PATH is read at CALL time, never captured at import: `issue-check.mjs` is a
 * short-lived seam either way, but a module-load capture would make the value a
 * test prepends depend on import order rather than on the environment.
 * @param {unknown} bin @returns {boolean}
 */
export function onPath(bin) {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    if (executableIn(dir, bin)) return true;
  }
  return false;
}
