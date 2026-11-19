// @ts-check
// seldon-design.mjs - a Seldon design's four documents parsed into what a handoff writes, with every problem found
// follows Seldon's docs/FORMAT.md with a reader of its own, never Seldon's lib/check.mjs: line by line, every `## ` line
// a heading even inside a code fence, names matched untrimmed. planning-files.mjs's helpers skip fences and trim, so not those.
// pure: text in, a structure and issues out; planning/design-read.mjs reads the files and answers
'use strict';

/** The four documents a design folder holds, in the order the chain builds them; anything else there is ignored. */
export const DESIGN_FILES = Object.freeze(['brief.md', 'prd.md', 'spine.md', 'epics.md']);

const BRIEF_SECTIONS = ['Problem', 'Solution', 'Who it serves', "What's different", 'Success criteria', 'Scope',
  'What it refuses', 'Vision'];

// the tag marks text and isn't text, so a body holding only the tag is empty
const TAG = '[ASSUMPTION]';
const blankLine = (/** @type {string} */ l) => l.replaceAll(TAG, '').trim() === '';

/**
 * @typedef {{file: string, id?: string, section?: string, field?: string, problem: string}} Issue
 * The keys go file, then the ID when there is one, then the section or field, then what's wrong.
 */

/**
 * One issue, its keys in the order the answer names them.
 * @param {string} file @param {string|null} id @param {{section: string}|{field: string}} where @param {string} problem
 * @returns {Issue}
 */
function issue(file, id, where, problem) {
  return { file, ...(id ? { id } : {}), ...where, problem };
}

/**
 * A document's lines and its `## ` sections. The `Built from:` stamp and a `Retired:` line are prose to this: neither
 * starts a section, so each is just a line nothing compares.
 * @param {string} text @returns {{lines: string[], sections: {heading: string, body: string[]}[]}}
 */
function split(text) {
  const lines = text.split(/\r?\n/);
  /** @type {{heading: string, body: string[]}[]} */
  const sections = [];
  /** @type {{heading: string, body: string[]} | null} */
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      cur = { heading: line.slice(3), body: [] };
      sections.push(cur);
    } else if (cur) {
      cur.body.push(line);
    }
  }
  return { lines, sections };
}

/**
 * Each named section's body, checked present and not empty; a name found twice keeps its first body.
 * @param {string} file @param {{heading: string, body: string[]}[]} sections @param {string[]} names
 * @param {Issue[]} issues @returns {Map<string, string[]>} the sections that passed
 */
function namedSections(file, sections, names, issues) {
  /** @type {Map<string, string[]>} */
  const found = new Map();
  for (const s of sections) if (names.includes(s.heading) && !found.has(s.heading)) found.set(s.heading, s.body);
  for (const name of names) {
    const body = found.get(name);
    if (!body) issues.push(issue(file, null, { section: name }, 'missing section'));
    else if (body.every(blankLine)) {
      issues.push(issue(file, null, { section: name }, 'empty section'));
      found.delete(name);
    }
  }
  return found;
}

/** A body as written, less its leading and trailing blank lines. @param {string[]} body @returns {string} */
function keptBody(body) {
  let start = 0;
  let end = body.length;
  while (start < end && body[start].trim() === '') start++;
  while (end > start && body[end - 1].trim() === '') end--;
  return body.slice(start, end).join('\n');
}

/**
 * The brief: the design's title and its eight sections by exact name. Order and extra sections aren't checked.
 * @param {string} text @param {Issue[]} issues
 * @returns {{title: string, brief: Record<string, string>}}
 */
function readBrief(text, issues) {
  const { lines, sections } = split(text);
  const first = lines.find((l) => l.trim() !== '');
  const title = first !== undefined && first.startsWith('# ') ? first.slice(2).trim() : '';
  if (!title) issues.push(issue('brief.md', null, { section: 'title' }, 'the first non-blank line is not a "# " title'));
  const found = namedSections('brief.md', sections, BRIEF_SECTIONS, issues);
  /** @type {Record<string, string>} */
  const brief = {};
  for (const [name, body] of found) brief[name] = keptBody(body);
  return { title, brief };
}

/**
 * Every document a design folder gave, parsed. A file the caller couldn't read comes in as null, is skipped here,
 * and is the caller's issue to report.
 * @param {Record<string, string|null>} texts file name -> its text, or null
 * @returns {{issues: Issue[], design: {title: string, brief: Record<string, string>}}}
 */
export function readDesign(texts) {
  /** @type {Issue[]} */
  const issues = [];
  const { title, brief } = texts['brief.md'] === null ? { title: '', brief: {} } : readBrief(texts['brief.md'], issues);
  return { issues, design: { title, brief } };
}
