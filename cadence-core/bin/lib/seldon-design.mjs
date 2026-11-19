// @ts-check
// seldon-design.mjs - a Seldon design's four documents parsed into what a handoff writes, with every problem found
// follows Seldon's docs/FORMAT.md with a reader of its own, never Seldon's lib/check.mjs: line by line, every `## ` line
// a heading even inside a code fence, names matched untrimmed. planning-files.mjs's helpers skip fences and trim, so not those.
// pure: text in, a structure and issues out; planning/design-read.mjs reads the files and answers
'use strict';

import { isRequirementId } from './planning-files.mjs';

/** The four documents a design folder holds, in the order the chain builds them; anything else there is ignored. */
export const DESIGN_FILES = Object.freeze(['brief.md', 'prd.md', 'spine.md', 'epics.md']);

const BRIEF_SECTIONS = ['Problem', 'Solution', 'Who it serves', "What's different", 'Success criteria', 'Scope',
  'What it refuses', 'Vision'];
const PRD_SECTIONS = ['Requirements', 'Non-functional requirements', 'User journeys', 'Non-goals', 'MVP scope'];
const REQUIREMENT_SECTIONS = ['Requirements', 'Non-functional requirements'];

// the ID alone first, so a bullet whose ID is good declares it even when the rest of the line is wrong
const BULLET_ID = /^- \*\*([^*]*)\*\*/;
const BULLET = /^- \*\*[^*]*\*\*: (.*)$/;
const SPINE_ID = /^(S-\d{2,}):/;
const SPINE_HEAD = /^S-\d{2,}: (.*)$/;
const KIND = 'Kind: ';
const QUOTE_LINE = /^\s*>(?:\s|$)/;
const SOURCE_LINE = /^\s*\(.*\)\s*$/;

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

// JSON quoting, so a stray control character in a document never reaches the answer raw
const quote = (/** @type {string} */ s) => JSON.stringify(s);

/** Lines trimmed and joined with single spaces, blank ones dropped: every free-text value is one line. @param {string[]} lines */
const oneLine = (lines) => lines.map((l) => l.trim()).filter((l) => l !== '').join(' ');

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
 * @typedef {{id: string, category: string, text: string}} Requirement
 * @typedef {{id: string, title: string, kind: string, text: string}} Decision
 */

/**
 * The PRD's five sections and its requirements in file order, Requirements then Non-functional requirements.
 * `declared` holds every ID a bullet declares, a malformed bullet's too, so a fault there is one issue and not a
 * second one in epics.md.
 * @param {string} text @param {Issue[]} issues
 * @returns {{requirements: Requirement[], declared: Set<string>}}
 */
function readPrd(text, issues) {
  const found = namedSections('prd.md', split(text).sections, PRD_SECTIONS, issues);
  /** @type {Requirement[]} */
  const requirements = [];
  /** @type {Set<string>} */
  const declared = new Set();
  for (const section of REQUIREMENT_SECTIONS) {
    const body = found.get(section);
    if (!body) continue;
    const where = { section };
    // only `## Requirements` takes its category from a `### ` line; every non-functional bullet is Non-functional
    let category = section === 'Requirements' ? null : 'Non-functional';
    for (const line of body) {
      if (section === 'Requirements' && line.startsWith('### ')) category = line.slice(4).trim();
      if (!line.startsWith('- ')) continue;
      const id = BULLET_ID.exec(line)?.[1];
      const known = id !== undefined && isRequirementId(id);
      if (known && declared.has(id)) {
        issues.push(issue('prd.md', id, where, 'ID appears more than once'));
        continue;
      }
      if (known) declared.add(id);
      const said = BULLET.exec(line)?.[1].trim() ?? '';
      if (!known || said === '') {
        issues.push(issue('prd.md', known ? id : null, where, `${quote(line)} is not a "- **CAT-01**: text" requirement`));
      } else if (category === null) {
        issues.push(issue('prd.md', id, where, `${quote(line)} comes before the first ### category`));
      } else {
        requirements.push({ id, category, text: said });
      }
    }
  }
  return { requirements, declared };
}

/**
 * The spine's decisions by ID. A decision's text is its body less the Kind line, the `> ` quote lines and the
 * `(path)` source line under a quote, in one line with the tag kept. The kind is taken as written, never checked.
 * @param {string} text @param {Issue[]} issues
 * @returns {{decisions: Map<string, Decision>, declared: Set<string>}}
 */
function readSpine(text, issues) {
  /** @type {Map<string, Decision>} */
  const decisions = new Map();
  /** @type {Set<string>} */
  const declared = new Set();
  for (const { heading, body } of split(text).sections) {
    const id = SPINE_ID.exec(heading)?.[1];
    const head = { section: 'heading' };
    if (id && declared.has(id)) {
      issues.push(issue('spine.md', id, head, 'ID appears more than once'));
      continue;
    }
    if (id) declared.add(id);
    const title = SPINE_HEAD.exec(heading)?.[1].trim() ?? '';
    if (!id || title === '') {
      issues.push(issue('spine.md', id ?? null, head, `${quote('## ' + heading)} is not a "## S-01: decision" heading`));
      continue;
    }
    const kindLine = body.find((l) => l.startsWith(KIND));
    /** @type {string[]} */
    const kept = [];
    let underQuote = false;
    for (const line of body) {
      if (QUOTE_LINE.test(line)) underQuote = true;
      else if (underQuote && SOURCE_LINE.test(line)) underQuote = false;
      else {
        underQuote = false;
        if (!line.startsWith(KIND)) kept.push(line);
      }
    }
    const said = oneLine(kept);
    if (blankLine(said)) issues.push(issue('spine.md', id, { section: 'decision' }, 'empty section'));
    else if (kindLine === undefined) issues.push(issue('spine.md', id, { section: 'Kind' }, 'missing line'));
    else decisions.set(id, { id, title, kind: kindLine.slice(KIND.length), text: said });
  }
  return { decisions, declared };
}

/**
 * Every document a design folder gave, parsed. A file the caller couldn't read comes in as null, is skipped here,
 * and is the caller's issue to report.
 * @param {Record<string, string|null>} texts file name -> its text, or null
 * `decisions` is held for the phases that name them and never answered as a list of its own.
 * @returns {{issues: Issue[], decisions: Map<string, Decision>,
 *   design: {title: string, brief: Record<string, string>, requirements: Requirement[]}}}
 */
export function readDesign(texts) {
  /** @type {Issue[]} */
  const issues = [];
  const { title, brief } = texts['brief.md'] === null ? { title: '', brief: {} } : readBrief(texts['brief.md'], issues);
  const prd = texts['prd.md'] === null ? null : readPrd(texts['prd.md'], issues);
  const spine = texts['spine.md'] === null ? null : readSpine(texts['spine.md'], issues);
  return { issues, decisions: spine ? spine.decisions : new Map(),
    design: { title, brief, requirements: prd ? prd.requirements : [] } };
}
