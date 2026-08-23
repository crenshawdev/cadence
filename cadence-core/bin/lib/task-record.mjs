// @ts-check
// task-record.mjs - the ONE statement of where a `/cad-task` run's record lives
// and what its bytes look like, for the three readers that have to agree about
// it: the `task-record` subcommand that WRITES one (planning.mjs), the recall
// corpus walk that INDEXES one (cmdRecall, through parseTaskRecordSnippets),
// and `/cad-why`'s task tier that JOINS a commit back to one (lib/why-corpus.mjs).
//
// ONE FACT, ONE HOME, on the reasoning `CAPTURE_WALK_SECTIONS` in
// lib/planning-files.mjs already carries and lib/capture-file.mjs's header
// records the cost of: five filed capture bullets were lost because the writer
// and the recall walk each held their own idea of which heading the content sat
// under, and nothing could fail. A task record is that shape again - a writer,
// an indexer and a join, three files apart - so the directory name, the file
// name, the slug grammar and the section order are exported from here and never
// re-spelled by a caller.
//
// THE SECTIONS ARE NOT A STYLE CHOICE. Each one exists because a SHIPPED reader
// already parses it, and the record is written in the corpus's own grammar
// rather than a new one:
//   `## What shipped`   the recall walk's snippets (D-09). `parseSummarySnippets`
//                       indexes `## Deviations` and `## Open items` ALONE, so
//                       even a SUMMARY-shaped record's headline is invisible
//                       through it - the tasks tier gets its own reader.
//   `## Commits`        `parseCommitRows` in lib/why-record.mjs, which finds the
//                       section by heading and maps columns by header NAME. The
//                       three-column `| Task | Commit | Description |` era is
//                       one it already reads, and a task carries no plan number.
//   `## Files`          `planTaskBodies` anchors `^### Task` and
//                       `taskDeclaredFiles` requires the exact `- **Files:**`
//                       bold-field spelling. It is LAST so that task body runs
//                       to end of file, the way `sectionBound` cuts it.
//
// PURE past the one guarded lister: no Date, no randomness, no env. The same
// inputs render the same bytes, which is what lets a re-run over an unchanged
// range rewrite a byte-identical file instead of accumulating one.
'use strict';

import { readdirSync, realpathSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

/** The directory a task's artifacts live under, beside `phases/` (D-01). A
 * TRACKED tree: `.gitignore` withholds `CAPTURE.md` outright, and `phases/0/`
 * is what the next milestone close archives and then hands to route.mjs's
 * risk-floor replay as a phase. */
export const TASKS_DIR = 'tasks';

/** The record file inside `<planningRoot>/tasks/<slug>/`. `PLAN.md` beside it
 * is the PLANNED path's own artifact and is not this file: the inline path
 * writes no plan at all, which is why `/cad-why` reaches the record through its
 * own tier rather than through `phaseDirsIn` (D-02). */
export const RECORD_FILE = 'RECORD.md';

/** A slug's length ceiling. A bound rather than a taste: the slug is joined
 * onto a directory path and a name no filesystem will hold is a write that
 * fails after the caller was told the argument was accepted. */
export const MAX_SLUG_LENGTH = 64;

/**
 * ONE path segment: lowercase letters and digits in hyphen-separated groups,
 * with no leading, trailing or doubled hyphen.
 *
 * REFUSED, never sanitised - the VAL-01 lesson from `milestone-prune --label`,
 * which was only TRIMMED before being joined onto a directory path and so
 * escaped the tree. `.`, `..`, any `/` or `\`, any absolute form, an empty
 * string, a NUL and a newline all fall outside this pattern and are refused
 * with nothing written, rather than being repaired into some nearby name the
 * caller never asked for. A repaired slug is a record filed under a name the
 * caller cannot find again.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Is `raw` a slug this module will join onto a path?
 * @param {unknown} raw a `--slug` value as argv delivered it
 * @returns {boolean}
 */
export function isTaskSlug(raw) {
  if (typeof raw !== 'string') return false;
  if (!raw || raw.length > MAX_SLUG_LENGTH) return false;
  return SLUG.test(raw);
}

/**
 * Every `<planningRoot>/tasks/<slug>/RECORD.md` on disk, sorted by slug.
 *
 * FAILS OPEN exactly as `phaseDirsIn` in lib/phase-plans.mjs does: an absent
 * planning root, an absent `tasks/` and an unreadable directory are each an
 * empty list and never a throw. Recall's empty-corpus contract rests on that -
 * an ENOENT here would reach the dispatcher's catch and become
 * `fail('internal')` on a tree that has simply not run a task yet.
 *
 * CONTAINED the same way, and ONE LEVEL FURTHER IN. `readdirSync` follows a
 * symlinked directory, so a slug entry that is a link lands this walk in
 * another tree - that is `phaseDirsIn`'s case and is handled the same way, by
 * judging what a path RESOLVES to rather than how it is spelled. But
 * `phaseDirsIn` contains DIRECTORY entries and hands back a directory, while
 * this lister hands back a FILE that task 3's recall tier reads snippets
 * straight out of. A walk that stopped at the slug directory would still return
 * `tasks/<slug>/RECORD.md` symlinked out of the tree, and a cloned repository
 * carrying one would surface an arbitrary readable file through
 * `planning.mjs recall`. So `RECORD.md` ITSELF is resolved and required to land
 * inside the planning root, and required to be a regular file.
 *
 * @param {string} planningRoot
 * @returns {Array<{slug: string, path: string}>}
 */
export function taskRecordsIn(planningRoot) {
  let root;
  try {
    root = realpathSync(planningRoot);
  } catch {
    root = planningRoot;
  }
  const inside = (/** @type {string} */ p) => {
    try {
      const real = realpathSync(p);
      return real === root || real.startsWith(root.endsWith(sep) ? root : root + sep);
    } catch {
      return false;
    }
  };
  const group = join(planningRoot, TASKS_DIR);
  if (!inside(group)) return [];
  let names;
  try {
    names = readdirSync(group, { encoding: 'utf8' });
  } catch {
    return [];
  }
  const found = [];
  for (const slug of names) {
    const dir = join(group, slug);
    if (!inside(dir)) continue;
    const path = join(dir, RECORD_FILE);
    if (!inside(path)) continue;
    try {
      // Through the RESOLVED path, so a link that resolves inside the root is
      // still judged on what it points at. A directory, a FIFO or a device
      // named RECORD.md is not a record: the recall tier would read it to an
      // EOF that never arrives, which is the same hazard `readOnePlan` in
      // lib/phase-plans.mjs guards its bounded read with.
      if (!statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    found.push({ slug, path });
  }
  // Slug order, not directory order: `readdirSync` makes no ordering promise,
  // and the recall corpus must be assembled in a fixed traversal order or the
  // same query stops emitting the same bytes.
  return found.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** A table cell's bytes. `parseCommitRows`' `cells()` splits on UNESCAPED `|`
 * and unescapes `\|`, so a subject line carrying a pipe is escaped here rather
 * than split into two cells and attached to the wrong commit. Line breaks are
 * folded to spaces for the same reason one row is one line. */
const cell = (/** @type {unknown} */ raw) =>
  String(raw === undefined || raw === null ? '' : raw)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();

/**
 * One task record's bytes.
 *
 * PURE: no disk, no `Date`, no randomness, so the same inputs give the same
 * file. That is what makes a re-run over an unchanged range a no-op diff rather
 * than an accumulating artifact, and it is the property task 4's `git diff
 * --stat` check reads.
 *
 * `body` becomes one `- ` bullet per non-empty line, with a leading bullet
 * marker the caller's own text already carried stripped first - the text
 * arrives from a `--text-file` written by a human or a coordinator, and `- - x`
 * would index with the marker inside the snippet.
 *
 * The commit cell is written VERBATIM and is expected to be a full
 * 40-character sha: `HEX` in lib/why-record.mjs refuses a cell that is not
 * hexadecimal, and `shaMatches` prefix-matches in either direction, so the
 * widest spelling is the one that joins to every abbreviation.
 *
 * @param {{slug: string, title: string, body: string,
 *   commits: Array<{commit: string, description: string}>, files: string[]}} rec
 * @returns {string}
 */
export function renderTaskRecord(rec) {
  const slug = String(rec.slug || '');
  const bullets = String(rec.body || '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);
  const rows = (rec.commits || []).map((c) => `| 1 | ${cell(c.commit)} | ${cell(c.description)} |`);
  const files = (rec.files || []).filter(Boolean).join(', ');
  const lines = [
    `# Task: ${slug}`,
    '',
    '## What shipped',
    '',
    ...bullets,
    ...(bullets.length ? [''] : []),
    '## Commits',
    '',
    '| Task | Commit | Description |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '## Files',
    '',
    `### Task 1: ${String(rec.title || slug)}`,
    '',
    `- **Files:** ${files}`,
    '',
  ];
  return lines.join('\n');
}
