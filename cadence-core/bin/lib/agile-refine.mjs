// @ts-check
// agile-refine.mjs - the rules a list of stories meets before it's written, so an approved list is one that can be built
// pure: a payload in, stories or issues out
'use strict';

import { readStoryFile } from './agile-read.mjs';
import { renderStoryFile } from './agile-render.mjs';

/** @typedef {import('./agile-read.mjs').Story} Story */
/** @typedef {{story?: string, field: string, problem: string}} Issue */

const PAYLOAD = Object.freeze(['epic', 'decisions', 'stories']);
const STORY = Object.freeze(['title', 'size', 'builds_on', 'requirements', 'delivers', 'accepted_when']);

/** Is it text that fits on one line of a file as it stands? Half an emoji doesn't survive the write. @param {unknown} v @returns {v is string} */
const oneLine = (v) => typeof v === 'string' && v !== '' && v === v.trim() && !/[\p{Cc}\p{Cs}\u2028\u2029]/u.test(v);

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {unknown} v */
const lines = (v) => Array.isArray(v) && v.every(oneLine) && new Set(v).size === v.length;

/** What's wrong with one story's own values. @param {Record<string, unknown>} s @param {string[]} wanted @param {Set<string>} earlier */
function storyProblems(s, wanted, earlier) {
  /** @type {Issue[]} */
  const found = [];
  const bad = (/** @type {string} */ field, /** @type {string} */ problem) => { found.push({ field, problem }); };
  for (const key of Object.keys(s)) if (!STORY.includes(key)) bad(key, `is not a story's field - those are ${STORY.join(', ')}`);
  for (const field of ['title', 'delivers']) if (!oneLine(s[field])) bad(field, 'is one line of text');
  if (s.size === 'L') bad('size', 'is L, and an L is never built - split it into smaller stories');
  else if (s.size !== 'S' && s.size !== 'M') bad('size', 'is S or M');
  const checks = s.accepted_when;
  if (!lines(checks) || !(/** @type {string[]} */ (checks).length)) bad('accepted_when', 'is a list of at least one check, each on one line');
  const on = s.builds_on;
  if (!lines(on)) bad('builds_on', 'is a list of story or epic IDs, empty when it builds on nothing');
  else for (const id of /** @type {string[]} */ (on)) if (!earlier.has(id)) bad('builds_on', `names ${id}, which isn't an earlier story, an earlier epic or one of its stories`);
  const requirements = s.requirements;
  if (!lines(requirements) || !(/** @type {string[]} */ (requirements).length)) bad('requirements', 'is a list of at least one of the epic\'s requirements');
  else for (const id of /** @type {string[]} */ (requirements)) if (!wanted.includes(id)) bad('requirements', `names ${id}, which isn't one of the epic's - those are ${wanted.join(', ')}`);
  return found;
}

/**
 * The stories a payload holds, numbered in its order, or every reason it can't be written.
 * @param {unknown} payload @param {{id: string, requirements: string[], earlier: string[]}} epic `earlier` is what a story may build on besides this list
 * @returns {{issues: Issue[], decisions: string[], stories: Story[]}}
 */
export function judgeStories(payload, epic) {
  /** @type {Issue[]} */
  const issues = [];
  /** @type {Story[]} */
  const stories = [];
  if (!isObject(payload) || !Array.isArray(payload.stories) || !payload.stories.length) {
    return { issues: [{ field: 'stories', problem: 'is a list of at least one story' }], decisions: [], stories };
  }
  for (const key of Object.keys(payload)) if (!PAYLOAD.includes(key)) issues.push({ field: key, problem: `is not a field here - those are ${PAYLOAD.join(', ')}` });
  if (payload.epic !== epic.id) issues.push({ field: 'epic', problem: `is ${epic.id}, the epic up for refinement` });
  if (!lines(payload.decisions)) issues.push({ field: 'decisions', problem: 'is a list of decisions, each on one line, empty when there are none' });
  const earlier = new Set(epic.earlier);
  const covered = new Set();
  payload.stories.forEach((s, i) => {
    const id = `${epic.id}-${i + 1}`;
    const found = isObject(s) ? storyProblems(s, epic.requirements, earlier) : [{ field: 'stories', problem: 'is not a story' }];
    earlier.add(id);
    if (Array.isArray(s?.requirements)) for (const q of s.requirements) covered.add(q);
    if (!found.length) {
      const story = /** @type {Story} */ ({ id, title: s.title, size: s.size, status: 'backlog', builds_on: s.builds_on,
        requirements: s.requirements, delivers: s.delivers, accepted_when: s.accepted_when });
      stories.push(story);
      // what the file can't hand back, a build would read as something else
      if (JSON.stringify(readStoryFile(renderStoryFile(story))) !== JSON.stringify(story)) {
        found.push({ field: 'stories', problem: 'would not read back from its own file - reword a line that opens a code fence or reads as a heading' });
      }
    }
    issues.push(...found.map((f) => ({ story: id, ...f })));
  });
  for (const q of epic.requirements) if (!covered.has(q)) issues.push({ field: 'requirements', problem: `${q} is on no story` });
  return { issues, decisions: issues.length ? [] : /** @type {string[]} */ (payload.decisions), stories };
}
