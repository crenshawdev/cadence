// @ts-check
// planning/debt-harvest.mjs - `debt-harvest`: every CADENCE-DEBT marker in the
// tracked tree, collected into CAPTURE.md's own section.
//
// `DEBT_MAX_FILE_BYTES` and `DEBT_HEADING` are read here and nowhere else
// (D-05). The `--root` default is the declared row's, applied at the dispatch
// door in planning.mjs.
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { EMPTY_CAPTURE, replaceSection, withPlanningFileLock } from '../lib/capture-file.mjs';
import { debtMarkersIn, renderDebtSection } from '../lib/debt-markers.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';

// ---------------------------------------------------------------------------
// debt-harvest - every `CADENCE-DEBT` marker in the tracked tree, collected into
// `.planning/CAPTURE.md`'s own section. The grammar and the rendering live in
// lib/debt-markers.mjs (pure); this owns the walk, the reads and the write.
//
// `--root` is the PROJECT root, not `--dir`: this scans SOURCE and writes into
// `.planning`, the same reason `detect-commands` states for its own flag.
// ---------------------------------------------------------------------------

/** Files larger than this are skipped silently - a marker lives on one line. */
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
    // An UNENUMERABLE tree must never report zero markers: `markers: 0` is the
    // answer a caller acts on, and it has to mean "none planted", never "the
    // walk did not happen".
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
    // `.planning/` holds the harvest's OWN OUTPUT, which is TRACKED in some
    // projects (hindsight, assistant) even though it is gitignored here - so
    // scanning it would make the harvest ingest itself and destroy the
    // idempotence the whole design rests on. It also holds every planning doc
    // that quotes the convention.
    if (segs.includes('.planning')) continue;
    // `git ls-files` omits UNTRACKED files, which is what keeps an ignored
    // `node_modules/` out in the ordinary case. It is NOT "every ignored file
    // for free": an ignore rule does not remove an ALREADY TRACKED path from
    // `ls-files`, so a force-added (`git add -f`) or historically tracked
    // `node_modules/pkg/x.js` is still enumerated and would contribute
    // third-party markers. Hence the explicit skip, here beside the other one.
    if (segs.includes('node_modules')) continue;
    const abs = join(root, rel);
    let buf;
    try {
      // `lstatSync`, so a SYMLINK is classified as a link rather than as whatever
      // it points at. `statSync` followed it and the read followed it too, so a
      // tracked `src/link.js -> /tmp/outside.js` put the external file's marker in
      // the queue under the in-tree path - the harvest reporting a corner-cut at a
      // line that does not contain one, sourced from a file the project does not
      // contain. A tracked symlink's TARGET is either in the tree (enumerated on
      // its own path, and reported there) or outside it, so skipping links loses
      // no marker that belongs here.
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
    // The whole read-modify-write is inside the SAME guard `/cad-capture`'s
    // append takes (D-02), and the read is inside it with the write: a harvest
    // and a capture running at the same moment would otherwise each read the
    // same bytes and the second rename would erase the first one's work. That
    // is the whole point of naming all three writers.
    guarded = withPlanningFileLock(captureFile, () => {
      const existing = read(captureFile);
      const next = existing === null
        // Created with the same three headings /cad-capture creates - the same
        // constant, not a second copy of them - so a harvest on a project with
        // no queue yet leaves the file /cad-capture expects.
        ? `${EMPTY_CAPTURE}\n${DEBT_HEADING}\n\n${body}`
        : replaceSection(existing, DEBT_HEADING, body);
      // Written ONLY when it differs, so a second run reports written:false and
      // leaves the file byte-identical - the idempotence AC6 asks for.
      if (next === existing) return false;
      atomicWrite(captureFile, next);
      return true;
    });
  } catch (e) {
    return fail('write-failed', `${captureFile}: ${e && e.message ? e.message : String(e)}`,
      'make that file and its directory writable, then re-run - the markers were found and none of'
      + ' them reached CAPTURE.md');
  }
  // A refused lock is reported through the EXISTING failure path, not a new
  // one: every caller of this seam already branches on `write-failed`.
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
