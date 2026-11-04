// @ts-check
// task-record.mjs - where a `/cad-task` record lives and what its bytes look like, for the three readers that
// have to agree: the `task-record` subcommand that writes one, the recall walk that indexes it, and /cad-why's task tier
// one fact, one home: five filed capture bullets were lost when a writer and the recall walk each held their own idea
// of which heading the content sat under. Directory, file name, slug grammar and section order are exported from here
// each section is one a shipped reader already parses: `## What shipped` for the recall snippets (parseSummarySnippets
// indexes only Deviations and Open items), `## Commits` for parseCommitRows in why-record.mjs, which maps columns by
// header name, and `## Files` last so the task body runs to end of file, with the exact `- **Files:**` spelling
// pure past the one guarded lister, so a re-run over an unchanged range rewrites a byte-identical file
'use strict';

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { insideRoot } from './contained.mjs';

/** The directory a task's artifacts live under, beside `phases/`. A tracked tree, and not a phase directory, which the next milestone close would archive and hand to `phaseDirsIn` as a phase. */
export const TASKS_DIR = 'tasks';

/** The record file inside `<planningRoot>/tasks/<slug>/`. Not the PLAN.md beside it: the inline path writes no plan, which is why /cad-why reaches the record through its own tier and not through `phaseDirsIn`. */
export const RECORD_FILE = 'RECORD.md';

/** A slug's length ceiling: it's joined onto a directory path, and a name no filesystem will hold fails the write after the caller was told the argument was accepted. */
export const MAX_SLUG_LENGTH = 64;

/**
 * One path segment: lowercase letters and digits in hyphen-separated groups, no leading, trailing or doubled hyphen.
 * Refused, never sanitised: `milestone-prune --label` was only trimmed before being joined onto a directory path and escaped
 * the tree. `.`, `..`, any slash, an absolute form, an empty string, a NUL or a newline all fall outside this and are refused
 * with nothing written, because a repaired slug is a record filed under a name the caller can't find again.
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
 * Fails open like phaseDirsIn in phase-plans.mjs: an absent planning root, absent `tasks/` or unreadable directory is
 * an empty list, never a throw. Recall's empty-corpus contract rests on that, an ENOENT here would become `fail('internal')`
 * on a tree that just hasn't run a task yet.
 * Contained one level further in. readdirSync follows a symlinked directory, and unlike phaseDirsIn this hands back a file
 * the recall tier reads snippets straight out of, so a cloned repository with `RECORD.md` symlinked out of the tree would
 * surface an arbitrary readable file through `planning.mjs recall`. So RECORD.md itself is resolved, must land inside the
 * planning root and must be a regular file.
 * Named the same way: an entry that isn't a slug this module would write is skipped before it's joined onto anything,
 * since the slug travels onward as rendered text and containment says nothing about what a name reads as.
 * @param {string} planningRoot
 * @returns {Array<{slug: string, path: string}>}
 */
export function taskRecordsIn(planningRoot) {
  const inside = (/** @type {string} */ p) => insideRoot(planningRoot, p);
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
    // the same predicate the writer is held to. Containment judges where a path resolves, not how the name reads: a
    // directory called `\n## Commits` or one with a terminal escape resolves fine inside the root, and its slug is rendered
    // verbatim by /cad-why and indexed verbatim by recall. A name this module wouldn't write isn't one it hands back, so a
    // cloned planning tree can't forge lines in a diagnostic
    if (!isTaskSlug(slug)) continue;
    const dir = join(group, slug);
    if (!inside(dir)) continue;
    const path = join(dir, RECORD_FILE);
    if (!inside(path)) continue;
    try {
      // through the resolved path, so a link that resolves inside the root is judged on what it points at. A directory, FIFO
      // or device named RECORD.md isn't a record: recall would read it to an EOF that never arrives, the hazard readOnePlan
      // in phase-plans.mjs guards its bounded read against
      if (!statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    found.push({ slug, path });
  }
  // slug order, not directory order: readdirSync promises none and recall must assemble its corpus in a fixed order or the same query stops emitting the same bytes
  return found.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** A table cell's bytes. parseCommitRows splits on unescaped `|` and unescapes `\|`, so a pipe in a subject line is escaped
 * here and doesn't split into two cells on the wrong commit. Line breaks fold to spaces so a row stays one line. */
const cell = (/** @type {unknown} */ raw) =>
  String(raw === undefined || raw === null ? '' : raw)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();

/**
 * One task record's bytes. Pure: no disk, Date or randomness, so a re-run over an unchanged range is a no-op diff and not an accumulating artifact.
 *
 * `body` becomes one `- ` bullet per non-empty line, with a leading bullet marker the caller's text already carried stripped
 * first. The text arrives from a `--text-file` written by a human or coordinator, and `- - x` would index with the marker inside the snippet.
 * The commit cell is written verbatim and expected to be a full 40-character sha: `HEX` in why-record.mjs refuses a non-hex
 * cell, and shaMatches prefix-matches both ways, so the widest spelling joins to every abbreviation.
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
