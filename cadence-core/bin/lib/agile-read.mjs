// @ts-check
// agile-read.mjs - the agile path's own files read back: what release.md lists, an epic's status and a story whole
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

/** How big a story is; an L is never built. */
export const SIZES = Object.freeze(['S', 'M', 'L']);

/** @typedef {{id: string, title: string, size: string, status: string, builds_on: string[], requirements: string[], delivers: string, accepted_when: string[]}} Story */

/** A frontmatter block's fields, or null when there's no block or a line that isn't one field once. @param {string} text */
function fields(text) {
  const block = FRONTMATTER_RE.exec(text)?.[1];
  if (block === undefined) return null;
  /** @type {Map<string, string>} */
  const found = new Map();
  for (const line of block.split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at < 1 || found.has(line.slice(0, at))) return null;
    found.set(line.slice(0, at), line.slice(at + 1).trim());
  }
  return found;
}

/** @param {string | undefined} value @returns {string[]} */
const listed = (value) => (value && value !== 'None' ? value.split(',').map((v) => v.trim()) : []);

/** A section's text, or null when the file doesn't have it. @param {string} text @param {string} heading */
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const { start, end } = sectionSpan(lines, heading);
  return start < 0 ? null : lines.slice(start + 1, end).join('\n').trim();
}

/** What a refinement needs of an epic's file. @param {string} text @returns {{requirements: string[]} | null} */
export function readEpicFile(text) {
  const requirements = listed(fields(text)?.get('requirements'));
  return readEpicStatus(text) !== null && requirements.length && section(text, '## Decisions') !== null ? { requirements } : null;
}

/** @param {string} text @returns {Story | null} */
export function readStoryFile(text) {
  const f = fields(text);
  const at = (/** @type {string} */ key) => f?.get(key) ?? '';
  const delivers = section(text, '## Delivers');
  const checks = section(text, '## Accepted when')?.split('\n').filter((l) => l.trim() !== '');
  if (!f || !delivers || !checks?.length || !checks.every((l) => l.startsWith('- '))) return null;
  if (!/^E-\d{2,}-[1-9]\d*$/.test(at('story')) || !at('title') || !SIZES.includes(at('size')) || !STATUSES.includes(at('status'))) return null;
  const requirements = listed(at('requirements'));
  if (!requirements.length || section(text, '## Result') === null) return null;
  return { id: at('story'), title: at('title'), size: at('size'), status: at('status'), builds_on: listed(at('builds_on')), requirements,
    delivers, accepted_when: checks.map((l) => l.slice(2)) };
}
