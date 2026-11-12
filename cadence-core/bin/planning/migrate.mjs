// @ts-check
// planning/migrate.mjs - every project a seam meets gets its state file, once
// planning.mjs calls this after the arguments pass their contract and before the handler runs
// it writes `records/state.json` (and the records folder's `.gitignore` beside it) and nothing else: the three Markdown
// files, the phase folders and any `.planning/state.json` are left as they were
// a project the importer can't read gets no stamp, and a state file that is there but not valid is never rewritten here
// a seam that reports what the project had BEFORE (`trace ignore`) asks for mode 'before' ahead of its handler, which judges
// everything and writes nothing, and mode 'after' once it has answered, which writes the stamp and says nothing more
'use strict';

import { lstatSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail } from './core.mjs';
import { importState } from './state-import.mjs';
import { readState, statePath, writeState } from '../lib/project-state.mjs';
import { emit } from '../lib/seam-io.mjs';

/**
 * Make sure the planning directory has a valid state file before a handler runs.
 * @param {string} dir the planning directory the call resolved
 * @param {'now' | 'before' | 'after'} [mode] 'now' judges and stamps; 'before' judges only; 'after' stamps with no refusal emitted
 * @returns {boolean} true when the handler may run; false when a refusal has been emitted and the handler must not
 */
export function ensureState(dir, mode = 'now') {
  const quiet = mode === 'after';
  // no directory, or a file where it belongs, is the handler's to report (`no-planning-dir`, or its own best-effort answer)
  let st = null;
  try { st = statSync(dir); } catch { /* absent */ }
  if (!st || !st.isDirectory()) return true;
  // a planning directory that is itself a link may be a repository's way of pointing writes out of the tree, so nothing
  // is stamped through it; the handler keeps whatever refusal it has for that
  // resolve drops a trailing slash, which would make lstat follow the link it is asking about
  try { if (lstatSync(resolve(dir)).isSymbolicLink()) return true; } catch { return true; }
  const got = readState(dir);
  if (got.kind === 'valid') return true;

  if (got.kind === 'invalid') {
    if (quiet) return false;
    fail('invalid-state', `${statePath(dir)}: ${got.reason} - ${got.detail}`,
      got.reason === 'newer-layout'
        ? 'this project was written by a newer Cadence - update the plugin; the file was not touched'
        : '/cad-progress rebuilds the state file from the project\'s files; nothing was changed');
    return false;
  }

  const imported = importState(dir);
  if (imported.ok === false) {
    if (quiet) return false;
    // emitted directly because fail has no channel for the issue list
    const { reason, detail, issues, hint } = imported;
    emit({ ok: false, reason, detail, ...(issues ? { issues } : {}), hint });
    return false;
  }
  if (mode === 'before') return true;
  const wrote = writeState(dir, imported.state);
  if (wrote.ok === false) {
    if (quiet) return false;
    fail('state-write-failed', `${statePath(dir)}: ${wrote.reason} - ${wrote.detail}`,
      'fix the cause the detail names and re-run - no state file was written, and the project files were not changed');
    return false;
  }
  return true;
}
