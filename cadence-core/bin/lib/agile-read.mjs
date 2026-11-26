// @ts-check
// agile-read.mjs - the agile path's own files read back: what release.md lists, an epic's status and a story whole
// pure: text in, values out, and null for anything agile-render.mjs wouldn't have written
'use strict';

import { FRONTMATTER_RE } from './frontmatter.mjs';
import { isRequirementId, sectionSpan } from './planning-files.mjs';

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

/** @typedef {{id: string, category: string, text: string}} Requirement */

/** Where an ID's number starts: `CAT-` of `CAT-03`, `#` of `#41`. @param {string} id */
export function requirementPrefix(id) {
  return /^(.+-|#)\d+$/.exec(id)?.[1] ?? null;
}

/**
 * REQUIREMENTS.md's requirements under their categories, then the deferred. Deferred ones stay in the file, since the
 * next ID of a prefix counts them. A line agile-render.mjs wouldn't write is passed over, and `whole` says there was none,
 * since rewriting the file would lose it.
 * @param {string} text
 * @returns {{title: string | null, requirements: Requirement[], deferred: {id: string, text: string}[], whole: boolean}}
 */
export function readRequirementsFile(text) {
  const lines = text.split(/\r?\n/);
  const title = /^# Requirements: (.+)$/.exec(lines[0])?.[1] ?? null;
  let whole = title !== null;
  /** @type {Requirement[]} */
  const requirements = [];
  /** @type {{id: string, text: string}[]} */
  const deferred = [];
  const seen = new Set();
  /** @type {string | null} */
  let part = null;
  /** @type {string | null} */
  let category = null;
  let none = false;
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue;
    if (line === '## Requirements' && part === null) part = 'held';
    else if (line === '## Deferred' && part === 'held') part = 'deferred';
    // Seldon keeps a category it trimmed to nothing, so a bare heading is still one
    else if (part === 'held' && line.startsWith('### ')) category = line.slice(4);
    else if (part === 'deferred' && line === 'None.' && !none) none = true;
    else {
      const m = /^- \*\*([^*]+)\*\*: (.+)$/.exec(line);
      if (!m || !isRequirementId(m[1]) || seen.has(m[1]) || part === null || (part === 'held' && category === null)) {
        whole = false;
        continue;
      }
      seen.add(m[1]);
      if (part === 'held') requirements.push({ id: m[1], category: /** @type {string} */ (category), text: m[2] });
      else deferred.push({ id: m[1], text: m[2] });
    }
  }
  return { title, requirements, deferred, whole: whole && part === 'deferred' && none !== deferred.length > 0 };
}

/** An epic's status, or a story's from a file too broken to read whole. @param {string} text @returns {string | null} */
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

/** @typedef {{requirements: string[], title: string, split_from: string | null, outcome: string, boundaries: string, done_when: string[], spine: string}} EpicRead */

/** What a refinement needs of an epic's file. @param {string} text @returns {EpicRead | null} */
export function readEpicFile(text) {
  const f = fields(text);
  const requirements = listed(f?.get('requirements'));
  if (readEpicStatus(text) === null || !requirements.length || section(text, '## Decisions') === null) return null;
  return { requirements, title: f?.get('title') ?? '', split_from: f?.get('split_from') || null, outcome: section(text, '## Outcome') ?? '',
    boundaries: section(text, '## Boundaries') ?? '', spine: section(text, '## Spine decisions') ?? '',
    done_when: (section(text, '## Done when') ?? '').split('\n').filter((l) => /^[-*] /.test(l)).map((l) => l.slice(2).trim()) };
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

/** One recorded check: its Accepted when line's number, its command and what its last run showed. */
export const CHECK_LINE = /^- Check ([1-9]\d*): `([^`\n]+)` - (.+)$/;

/** @typedef {{n: number, command: string, result: string}} Check */

/** The checks a story's Result records, in the order they're written. @param {string} text @returns {Check[]} */
export function readStoryChecks(text) {
  return (section(text, '## Result') ?? '').split('\n').map((l) => CHECK_LINE.exec(l))
    .filter((m) => m !== null).map((m) => ({ n: Number(m[1]), command: m[2], result: m[3] }));
}

/** What a story's Result says of its build: where it began and what's been noted, each null until it is. @param {string} text */
export function readStoryResult(text) {
  const lines = (section(text, '## Result') ?? '').split('\n');
  const of = (/** @type {string} */ kind) => lines.find((l) => l.startsWith(`- ${kind}: `))?.slice(kind.length + 4) ?? null;
  return { base: of('Base'), commits: of('Commits'), resized: of('Resized'), review: of('Review'), fix_round: of('Fix round'), differently: of('Done differently') };
}

/** A story's plan, one line per task, or null until one is written. @param {string} text */
export function readStoryPlan(text) {
  const held = section(text, '## Plan');
  return held === null || held === '' || held === 'None yet.' ? null : held.split('\n').filter((l) => l.trim() !== '');
}
