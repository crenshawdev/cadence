// @ts-check
// task-record.mjs - where a `/cad-task` record lives and what its bytes look like, for the three readers that share it
// one home: five capture bullets were lost when a writer and the recall walk each had their own idea of the heading
// each section is one a shipped reader already parses: `## What shipped` for recall snippets, `## Commits` for
// parseCommitRows (it maps columns by header name), `## Files` last so the body runs to end of file
// pure past the one guarded lister, so a re-run over an unchanged range rewrites a byte-identical file
'use strict';

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { insideRoot } from './contained.mjs';

/** Beside `phases/`, not in it, or the next milestone close archives it and `phaseDirsIn` lists it as a phase. */
export const TASKS_DIR = 'tasks';

/** The record file in `<planningRoot>/tasks/<slug>/`. No plan beside it, so /cad-why reaches it by its own tier. */
export const RECORD_FILE = 'RECORD.md';

/** Slug length ceiling: too long a name fails the write after the caller was told the argument was fine. */
export const MAX_SLUG_LENGTH = 64;

/**
 * One path segment: lowercase letters and digits in hyphen-separated groups, no leading, trailing or doubled hyphen.
 * Refused, never sanitised: `milestone-prune --label` was only trimmed before joining to a path and escaped the tree.
 * `.`, `..`, slashes, absolute forms, empty, NUL and newline are refused with nothing written, since a repaired slug
 * is a record the caller can't find again.
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
 * Fails open like phaseDirsIn in phase-plans.mjs: a missing root or `tasks/` is an empty list, not an ENOENT that
 * becomes `fail('internal')` on a tree that hasn't run a task yet.
 * Contained one level further in: recall reads snippets straight out of this file, so a clone with `RECORD.md`
 * symlinked out of the tree would surface any readable file. It is resolved and must land inside the root.
 * An entry that isn't a slug this module would write is skipped first, since the slug travels on as rendered text.
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
    // same predicate the writer is held to: containment judges where a path resolves, not how the name reads, and a
    // directory called `\n## Commits` would be rendered verbatim by /cad-why and forge lines in a diagnostic
    if (!isTaskSlug(slug)) continue;
    const dir = join(group, slug);
    if (!inside(dir)) continue;
    const path = join(dir, RECORD_FILE);
    if (!inside(path)) continue;
    try {
      // judge the resolved path, so a link inside the root is judged on its target. A FIFO or device named RECORD.md
      // would hang recall's read, the hazard readOnePlan in phase-plans.mjs bounds its read against
      if (!statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    found.push({ slug, path });
  }
  // slug order, not directory order: readdirSync promises none, and the same query has to emit the same bytes
  return found.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** A table cell's bytes. parseCommitRows splits on unescaped `|`, so a pipe in a subject is escaped here. Line breaks
 * fold to spaces so a row stays one line. */
const cell = (/** @type {unknown} */ raw) =>
  String(raw === undefined || raw === null ? '' : raw)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();

/**
 * One task record's bytes. Pure: no disk, Date or randomness, so a re-run over an unchanged range is a no-op diff.
 *
 * `body` becomes one `- ` bullet per non-empty line, with any leading bullet marker stripped first: the text comes from
 * a `--text-file`, and `- - x` would index with the marker inside the snippet.
 * The commit cell is verbatim and expected to be a full 40-character sha: `HEX` in why-record.mjs refuses a non-hex
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
