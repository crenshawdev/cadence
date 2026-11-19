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
const EPIC_ID = /^(E-\d{2,}):/;
const EPIC_HEAD = /^E-\d{2,}: (.*)$/;
const EPIC_REF = /^E-\d{2,}$/;
const SPINE_REF = /^S-\d{2,}$/;
const FIELDS = ['Outcome', 'Boundaries', 'Done when', 'Depends on', 'Requirements', 'Spine decisions'];
const LABEL = new RegExp(`^\\*\\*(${FIELDS.join('|')}):\\*\\*(.*)$`);
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
 * @typedef {{epic: string, number: number, name: string, description: string, goal: string, success_criteria: string[],
 *   depends_on: string, requirements: string[], spine_decisions: Decision[]}} Phase
 */

/**
 * An epic's fields: each label line's rest plus every line below it to the next label line, first occurrence kept.
 * Order and text before the Outcome aren't checked.
 * @param {string[]} body @returns {Map<string, string[]>}
 */
function epicFields(body) {
  /** @type {Map<string, string[]>} */
  const fields = new Map();
  /** @type {string[] | null} */
  let cur = null;
  for (const line of body) {
    const m = LABEL.exec(line);
    if (m) {
      cur = [m[2]];
      if (!fields.has(m[1])) fields.set(m[1], cur);
    } else if (cur) {
      cur.push(line);
    }
  }
  return fields;
}

/**
 * The done-when items, one success criterion each: column-0 `- ` lines below the label, an indented line joined to the
 * item above it. Text on the label line is no item.
 * @param {string[]} value @returns {string[]}
 */
function criteria(value) {
  /** @type {string[][]} */
  const items = [];
  for (const line of value.slice(1)) {
    if (line.startsWith('- ')) items.push([line.slice(2)]);
    else if (items.length && /^\s/.test(line)) items[items.length - 1].push(line);
  }
  return items.map(oneLine);
}

/**
 * The epics in file order, each one phase numbered by its position from `first`, never by its E- number.
 * A null `requirements` or `decisions` set means that document couldn't be read, so nothing is checked against it.
 * @param {string} text @param {Issue[]} issues
 * @param {{first: number, title: string, requirements: Set<string>|null, declared: Set<string>|null,
 *   decisions: Map<string, Decision>}} ctx
 * @returns {Phase[]}
 */
function readEpics(text, issues, ctx) {
  const { sections } = split(text);
  if (!sections.length) issues.push(issue('epics.md', null, { section: 'epics' }, 'no epic, so a handoff writes no phase'));
  /** @type {Map<string, number>} */
  const position = new Map();
  /** @type {Phase[]} */
  const phases = [];
  for (const [i, { heading, body }] of sections.entries()) {
    const number = ctx.first + i;
    const id = EPIC_ID.exec(heading)?.[1];
    const head = { section: 'heading' };
    if (id && position.has(id)) {
      issues.push(issue('epics.md', id, head, 'ID appears more than once'));
      continue;
    }
    if (id) position.set(id, number);
    const name = EPIC_HEAD.exec(heading)?.[1].trim() ?? '';
    if (!id || name === '') {
      issues.push(issue('epics.md', id ?? null, head, `${quote('## ' + heading)} is not a "## E-01: name" heading`));
      continue;
    }
    const fields = epicFields(body);
    /** @param {string} field @returns {string[] | null} the value, or null once its issue is out */
    const valueOf = (field) => {
      const value = fields.get(field);
      if (value && !value.every(blankLine)) return value;
      issues.push(issue('epics.md', id, { field }, value ? 'empty field' : 'missing field'));
      return null;
    };
    /**
     * An ID list split on commas; a malformed item and one the design never declares are one issue each.
     * @param {string} field @param {(item: string) => boolean} form @param {boolean} none whether `None` is allowed
     * @param {(item: string) => string|null} known why a well-formed item is refused, or null
     * @param {string} what
     */
    const idList = (field, form, none, known, what) => {
      const value = valueOf(field);
      if (value === null) return [];
      const joined = oneLine(value);
      if (none && joined === 'None') return [];
      /** @type {string[]} */
      const out = [];
      for (const item of joined.split(',').map((x) => x.trim())) {
        const refused = !form(item) ? `${quote(item)} is not ${what}` : known(item);
        if (refused) issues.push(issue('epics.md', id, { field }, refused));
        else out.push(item);
      }
      return out;
    };
    const outcome = valueOf('Outcome');
    const boundaries = valueOf('Boundaries');
    const doneWhen = valueOf('Done when');
    const depends = idList('Depends on', (x) => EPIC_REF.test(x), true,
      (x) => ((position.get(x) ?? number) < number ? null : `${quote(x)} is not an epic earlier in the file`), 'an epic ID');
    const requirements = idList('Requirements', isRequirementId, false,
      (x) => (!ctx.requirements || ctx.requirements.has(x) ? null : `${quote(x)} is not a requirement prd.md declares`),
      'a requirement ID');
    const decisions = idList('Spine decisions', (x) => SPINE_REF.test(x), true,
      (x) => (!ctx.declared || ctx.declared.has(x) ? null : `${quote(x)} is not a decision spine.md declares`),
      'a spine ID');
    const description = oneLine(outcome ?? []);
    phases.push({
      epic: id,
      number,
      name,
      description,
      goal: oneLine([description, oneLine(boundaries ?? []), `It's epic ${id} of the Seldon design "${ctx.title}".`]),
      success_criteria: criteria(doneWhen ?? []),
      depends_on: depends.length ? depends.map((x) => `Phase ${position.get(x)}`).join(', ') : 'Nothing',
      requirements,
      // repeated in full in every phase that names one; a declared decision that didn't parse already has its issue
      spine_decisions: decisions.flatMap((x) => (ctx.decisions.has(x) ? [{ ...ctx.decisions.get(x) }] : [])),
    });
  }
  return phases;
}

/**
 * Every document a design folder gave, parsed and mapped. A file the caller couldn't read comes in as null, is
 * skipped here, and is the caller's issue to report. A requirement no epic names is no issue: it comes back uncovered.
 * Staleness is never checked, so a stamp that no longer matches its parent changes nothing.
 * @param {Record<string, string|null>} texts file name -> its text, or null
 * @param {number} [first] the number the first epic's phase takes
 * `decisions` is held for the phases that name them and never answered as a list of its own.
 * @returns {{issues: Issue[], decisions: Map<string, Decision>, design: {title: string, brief: Record<string, string>,
 *   requirements: Requirement[], phases: Phase[], uncovered: string[]}}}
 */
export function readDesign(texts, first = 1) {
  /** @type {Issue[]} */
  const issues = [];
  const { title, brief } = texts['brief.md'] === null ? { title: '', brief: {} } : readBrief(texts['brief.md'], issues);
  const prd = texts['prd.md'] === null ? null : readPrd(texts['prd.md'], issues);
  const spine = texts['spine.md'] === null ? null : readSpine(texts['spine.md'], issues);
  const decisions = spine ? spine.decisions : new Map();
  const phases = texts['epics.md'] === null ? [] : readEpics(texts['epics.md'], issues, { first, title,
    requirements: prd ? prd.declared : null, declared: spine ? spine.declared : null, decisions });
  const requirements = prd ? prd.requirements : [];
  const named = new Set(phases.flatMap((p) => p.requirements));
  return { issues, decisions,
    design: { title, brief, requirements, phases, uncovered: requirements.filter((q) => !named.has(q.id)).map((q) => q.id) } };
}
