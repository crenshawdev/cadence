// @ts-check
// planning/debt-harvest.mjs - `debt-harvest`: every debt marker in the tracked tree, collected into CAPTURE.md
// DEBT_MAX_FILE_BYTES and DEBT_HEADING are read here only; planning.mjs applies the --root default at dispatch
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { EMPTY_CAPTURE, replaceSection } from '../lib/capture-file.mjs';
import { withPlanningFileLock } from '../lib/planning-store.mjs';
import { debtMarkersIn, renderDebtSection } from '../lib/debt-markers.mjs';
import { atomicWrite } from '../lib/planning-store.mjs';

// the grammar and rendering live in lib/debt-markers.mjs (pure); this owns the walk, the reads and the write
// --root is the project root and not --dir: this scans source and writes into .planning, same as detect-commands

/** Files larger than this are skipped silently; a marker lives on one line. */
const DEBT_MAX_FILE_BYTES = 1048576;

/** The heading the harvest owns and rewrites wholesale. */
const DEBT_HEADING = '## Debt markers';

function cmdDebtHarvest(root) {
  if (!existsSync(root)) {
    return fail('no-root', `${root} not found`,
      'point --root at the project root - the harvest walks the tracked files git lists from'
      + ' there');
  }
  /** @type {string} */
  let listing;
  try {
    listing = execFileSync('git', ['-C', root, 'ls-files', '-z'],
      { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  } catch (e) {
    // an unenumerable tree must never report zero markers: 0 has to mean "none planted", not "the walk did not happen"
    return fail('no-git', `${root} could not be enumerated with git ls-files`
      + ` (${e && e.message ? e.message.split('\n')[0] : String(e)})`,
      'run this inside a git repository whose index git can read, then re-run - the walk did not'
      + ' happen, so this is not a report that no debt markers are planted');
  }

  const entries = [];
  let files = 0;
  for (const rel of listing.split('\0')) {
    if (!rel) continue;
    const segs = rel.split('/');
    // .planning/ holds the harvest's own output (tracked in some projects) and planning docs quoting the convention
    if (segs.includes('.planning')) continue;
    // ls-files lists a force-added or once-tracked node_modules/ path, which would add third-party markers
    if (segs.includes('node_modules')) continue;
    const abs = join(root, rel);
    let buf;
    try {
      // lstat so a link is classified, not followed: following it put an outside file's marker under an in-tree path
      // a link's target is either listed on its own path or outside the tree, so skipping loses no marker here
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) continue;
      if (st.size > DEBT_MAX_FILE_BYTES) continue;
      buf = readFileSync(abs);
    } catch { continue; } // deleted since ls-files, or unreadable
    if (buf.includes(0)) continue; // binary
    files++;
    for (const m of debtMarkersIn(buf.toString('utf8'))) entries.push({ ...m, path: rel });
  }

  const captureFile = join(root, '.planning', 'CAPTURE.md');
  const body = renderDebtSection(entries);
  /** @type {{ok: true, value: boolean} | {ok: false, reason: string, detail: string}} */
  let guarded;
  try {
    // read and write both sit inside /cad-capture's guard, or a harvest and a capture would erase each other's work
    guarded = withPlanningFileLock(captureFile, () => {
      const existing = read(captureFile);
      const next = existing === null
        // the same three headings /cad-capture creates (same constant, not a copy), so a new queue is as expected
        ? `${EMPTY_CAPTURE}\n${DEBT_HEADING}\n\n${body}`
        : replaceSection(existing, DEBT_HEADING, body);
      // written only when it differs, so a second run reports written:false and leaves the file byte-identical
      if (next === existing) return false;
      atomicWrite(captureFile, next);
      return true;
    });
  } catch (e) {
    return fail('write-failed', `${captureFile}: ${e && e.message ? e.message : String(e)}`,
      'make that file and its directory writable, then re-run - the markers were found and none of'
      + ' them reached CAPTURE.md');
  }
  // a refused lock goes through the existing failure path, since every caller already branches on write-failed
  if (guarded.ok === false) {
    return fail('write-failed', `${captureFile}: ${guarded.detail}`,
      'let the run holding the lock finish and re-run, or clear a stale lock the detail names - the'
      + ' harvest is idempotent, so a second pass costs nothing');
  }
  const written = guarded.value;
  const malformed = entries.filter((e) => e.malformed)
    .map((e) => ({ path: e.path, line: e.line, missing: e.malformed }));
  ok({
    root,
    file: captureFile,
    markers: entries.length,
    files,
    written,
    ...(malformed.length ? { malformed } : {}),
  });
}

export { cmdDebtHarvest };
