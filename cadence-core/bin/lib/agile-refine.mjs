// @ts-check
// agile-refine.mjs - the rules a refinement's answers and its list of stories meet before they're written, so an approved
// list is one that can be built
// pure: a payload in, stories or issues out
'use strict';

import { readStoryFile } from './agile-read.mjs';
import { renderStoryFile } from './agile-render.mjs';

/** @typedef {import('./agile-read.mjs').Story} Story */
/** @typedef {{story?: string, field: string, problem: string}} Issue */

const PAYLOAD = Object.freeze(['epic', 'decisions', 'stories', 'backlog', 'defer', 'add']);
const ANSWERS = Object.freeze(['epic', 'answers']);
const ANSWER = Object.freeze(['question', 'answer']);
const STORY = Object.freeze(['title', 'size', 'builds_on', 'requirements', 'delivers', 'accepted_when']);
const ADDED = Object.freeze(['id', 'text']);

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

/** What's wrong with a payload's own fields. @param {Record<string, unknown>} payload @param {readonly string[]} known @param {string} epic @returns {Issue[]} */
function payloadProblems(payload, known, epic) {
  return [...Object.keys(payload).filter((key) => !known.includes(key)).map((field) => ({ field, problem: `is not a field here - those are ${known.join(', ')}` })),
    ...(payload.epic === epic ? [] : [{ field: 'epic', problem: `is ${epic}, the epic up for refinement` }])];
}

/**
 * The answers a payload holds, or every reason they can't be saved.
 * @param {unknown} payload @param {string} epic @returns {{issues: Issue[], answers: {question: string, answer: string}[]}}
 */
export function judgeAnswers(payload, epic) {
  if (!isObject(payload) || !Array.isArray(payload.answers) || !payload.answers.length) {
    return { issues: [{ field: 'answers', problem: 'is a list of at least one answer' }], answers: [] };
  }
  const issues = payloadProblems(payload, ANSWERS, epic);
  const asked = new Set();
  for (const a of payload.answers) {
    if (!isObject(a) || !ANSWER.every((key) => oneLine(a[key])) || Object.keys(a).length !== ANSWER.length) {
      issues.push({ field: 'answers', problem: `${JSON.stringify(a)} is not a question and an answer, each on one line` });
    // the file sets a question off with those marks, so one of its own would read as another question
    } else if (String(a.question).includes('**') || asked.has(a.question)) {
      issues.push({ field: 'answers', problem: `${JSON.stringify(a.question)} holds ** or is there twice` });
    } else asked.add(a.question);
  }
  return { issues, answers: issues.length ? [] : payload.answers };
}

/** Each prefix's highest number in the file, deferred ones counted, and how many digits it's written with. @param {{id: string}[]} all */
function highest(all) {
  /** @type {Map<string, {n: number, width: number}>} */
  const top = new Map();
  for (const { id } of all) {
    const m = /^(.+)-(\d+)$/.exec(id);
    if (m && Number(m[2]) >= (top.get(m[1])?.n ?? -1)) top.set(m[1], { n: Number(m[2]), width: m[2].length });
  }
  return top;
}

/**
 * The requirements the epic's stories must carry once the payload's `defer` and `add` are applied, or every reason
 * they can't be. What's under Deferred is off every epic, whatever an epic's line still says.
 * @param {unknown} payload
 * @param {{own: string[], file: {requirements: {id: string, text: string}[], deferred: {id: string, text: string}[]}, named: Set<string>}} ask
 *   `own` is the epic's requirements line, `named` every ID on any epic's line
 * @returns {{issues: Issue[], defer: string[], add: {id: string, text: string}[], requirements: string[]}}
 */
export function judgeAsk(payload, { own, file, named }) {
  /** @type {Issue[]} */
  const issues = [];
  const off = new Set(file.deferred.map((d) => d.id));
  const p = isObject(payload) ? payload : {};
  const defer = p.defer ?? [];
  if (!lines(defer)) issues.push({ field: 'defer', problem: 'is a list of the epic\'s requirement IDs, empty when none is deferred' });
  else for (const id of /** @type {string[]} */ (defer)) if (!own.includes(id)) issues.push({ field: 'defer', problem: `names ${id}, which isn't one of the epic's - those are ${own.join(', ')}` });
  const held = new Map(file.requirements.map((q) => [q.id, q.text]));
  const top = highest([...file.requirements, ...file.deferred]);
  /** @type {{id: string, text: string}[]} */
  const add = [];
  const given = Array.isArray(p.add) ? p.add : null;
  if (given === null && p.add !== undefined) issues.push({ field: 'add', problem: 'is a list of {"id", "text"} requirements, empty when none is added' });
  for (const a of given ?? []) {
    if (!isObject(a) || !ADDED.every((key) => oneLine(a[key])) || Object.keys(a).length !== ADDED.length || add.some((q) => q.id === a.id)) {
      issues.push({ field: 'add', problem: `${JSON.stringify(a)} is not an "id" and a "text", each on one line, with an ID given once` });
      continue;
    }
    const q = { id: String(a.id), text: String(a.text) };
    // a refinement cut short after REQUIREMENTS.md wrote it there, and no epic has it yet
    if (held.get(q.id) === q.text && !named.has(q.id)) { add.push(q); continue; }
    const m = /^(.+)-\d+$/.exec(q.id);
    const at = m ? top.get(m[1]) : undefined;
    const want = m && at ? `${m[1]}-${String(at.n + 1).padStart(at.width, '0')}` : null;
    if (want === null) issues.push({ field: 'add', problem: `${q.id} has no prefix REQUIREMENTS.md uses - those are ${[...top.keys()].join(', ')}` });
    else if (q.id !== want) issues.push({ field: 'add', problem: `is ${q.id}, and the next ${m?.[1]} is ${want}` });
    else { /** @type {{n: number}} */ (at).n += 1; add.push(q); }
  }
  // judged from the entries that hold, so a bad one isn't reported again by every story carrying a good one
  const out = lines(defer) ? /** @type {string[]} */ (defer).filter((id) => own.includes(id)) : [];
  const requirements = [...own.filter((id) => !off.has(id) && !out.includes(id)), ...add.map((q) => q.id)];
  if (!requirements.length) issues.push({ field: 'defer', problem: 'leaves the epic no requirement, so no story could carry one' });
  return { issues, defer: out, add, requirements };
}

/**
 * The stories a payload holds, numbered in its order, or every reason it can't be written.
 * @param {unknown} payload
 * @param {{id: string, requirements: string[], earlier: string[], backlog: string[]}} epic `earlier` is what a story may
 *   build on besides this list, `backlog` the lines it may take from there
 * @returns {{issues: Issue[], decisions: string[], stories: Story[], backlog: string[]}}
 */
export function judgeStories(payload, epic) {
  /** @type {Story[]} */
  const stories = [];
  if (!isObject(payload) || !Array.isArray(payload.stories) || !payload.stories.length) {
    return { issues: [{ field: 'stories', problem: 'is a list of at least one story' }], decisions: [], stories, backlog: [] };
  }
  const issues = payloadProblems(payload, PAYLOAD, epic.id);
  if (!lines(payload.decisions)) issues.push({ field: 'decisions', problem: 'is a list of decisions, each on one line, empty when there are none' });
  const taken = payload.backlog ?? [];
  // whatever an item holds, being one of that file's lines is the whole rule
  if (!Array.isArray(taken)) issues.push({ field: 'backlog', problem: 'is a list of lines of backlog.md, each as it stands there' });
  else for (const line of taken) if (!String(line).startsWith('- ') || !epic.backlog.includes(line)) issues.push({ field: 'backlog', problem: `${JSON.stringify(line)} is not an item in backlog.md` });
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
  if (issues.length) return { issues, decisions: [], stories, backlog: [] };
  return { issues, decisions: /** @type {string[]} */ (payload.decisions), stories, backlog: /** @type {string[]} */ (taken) };
}
