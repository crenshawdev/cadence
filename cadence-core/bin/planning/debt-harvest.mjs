// @ts-check
// planning/debt-harvest.mjs - `debt-harvest`: every debt marker in the tracked tree, collected into CAPTURE.md's own section
// DEBT_MAX_FILE_BYTES and DEBT_HEADING are read here and nowhere else. The --root default is applied at the dispatch door in planning.mjs
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { EMPTY_CAPTURE, replaceSection, withPlanningFileLock } from '../lib/capture-file.mjs';
import { debtMarkersIn, renderDebtSection } from '../lib/debt-markers.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';

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
    // an unenumerable tree must never report zero markers: `markers: 0` is what a caller acts on, so it has to mean "none planted" and never "the walk did not happen"
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
    // .planning/ holds the harvest's own output, which is tracked in some projects even though it's gitignored here, so scanning it would make the harvest ingest itself and break the idempotence the design rests on
    // it also holds every planning doc that quotes the convention
    if (segs.includes('.planning')) continue;
    // ls-files omits untracked files, which keeps an ignored node_modules/ out, but an ignore rule doesn't remove an already tracked path
    // so a force-added or historically tracked node_modules/pkg/x.js is still listed and would add third-party markers, hence the explicit skip
    if (segs.includes('node_modules')) continue;
    const abs = join(root, rel);
    let buf;
    try {
      // lstat so a symlink is classified as a link and not whatever it points at: following it put an outside file's marker in the queue under the in-tree path
      // a tracked link's target is either in the tree (listed on its own path) or outside it, so skipping links loses no marker that belongs here
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
    // the whole read-modify-write sits inside the same guard /cad-capture's append takes, read included: a harvest and a capture at the same moment would read the same bytes and the second rename would erase the first's work
    guarded = withPlanningFileLock(captureFile, () => {
      const existing = read(captureFile);
      const next = existing === null
        // created with the same three headings /cad-capture creates (the same constant, not a copy), so a project with no queue yet gets the file /cad-capture expects
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
