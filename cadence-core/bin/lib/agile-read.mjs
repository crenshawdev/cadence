// @ts-check
// agile-read.mjs - the agile path's own files read back: what release.md lists and the status an epic's file carries
// pure: text in, values out, and null for anything agile-render.mjs wouldn't have written
'use strict';

import { FRONTMATTER_RE } from './frontmatter.mjs';
import { sectionSpan } from './planning-files.mjs';

/** The words a story's or an epic's status can be, in the order they happen. */
export const STATUSES = Object.freeze(['backlog', 'in-progress', 'review', 'done']);

/**
 * The release's title and its epics in build order. Every line under Epics has to be one, or a bad edit would drop an
 * epic and the release would close without it.
 * @param {string} text @returns {{title: string, epics: {id: string, name: string}[]} | null}
 */
export function readReleaseFile(text) {
  const lines = text.split(/\r?\n/);
  const title = /^# Release: (.+)$/.exec(lines[0])?.[1];
  const span = sectionSpan(lines, '## Epics');
  if (!title || span.start < 0) return null;
  const epics = [];
  for (const line of lines.slice(span.start + 1, span.end)) {
    if (line.trim() === '') continue;
    const m = /^- (E-\d{2,}): (.+)$/.exec(line);
    if (!m) return null;
    epics.push({ id: m[1], name: m[2] });
  }
  return epics.length ? { title, epics } : null;
}

/** @param {string} text @returns {string | null} */
export function readEpicStatus(text) {
  const status = /^status:[ \t]*(\S+)[ \t]*$/m.exec(FRONTMATTER_RE.exec(text)?.[1] ?? '')?.[1] ?? '';
  return STATUSES.includes(status) ? status : null;
}
