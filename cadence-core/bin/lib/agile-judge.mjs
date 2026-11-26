// @ts-check
// agile-judge.mjs - why a design's own words would not survive in the agile path's files, found before one is written
// the old path reads past some of these, so they're judged here and not in the shared reader
// pure: a read design in, issues out
'use strict';

import { renderEpicFile, renderProjectFile, renderReleaseFile } from './agile-render.mjs';
import { BRIEF_SECTIONS, PRD_SECTIONS } from './seldon-design.mjs';
import { fenceScanner } from './text-util.mjs';

/** @typedef {import('./seldon-design.mjs').Issue} Issue */

/** Seldon's six kinds of spine decision (its docs/FORMAT.md, "The Kind line"); the shared reader takes any. */
const KINDS = ['design approach', 'boundaries', 'how state changes', 'who owns shared data', 'stack', 'hosting'];

const TAG = '[ASSUMPTION]';

/** A stand-in for every other value, so a verdict is about one value alone. */
const PLAIN = 'plain';

const UNREADABLE = 'would not read back from the file it goes into - it opens a code fence that never closes, or holds a line that'
  + ' reads as one of that file\'s own headings; close the fence or reword that line';

/**
 * The headings a reader finds in a file: every `#` and `##` line outside a code fence, and any line that spells one of the
 * file's own, so a brief section may hold deeper ones. The fences are the readers' own, or a start writes what they can't read.
 * @param {string} text @param {Set<string>} own @returns {string}
 */
function outline(text, own) {
  const fenced = fenceScanner();
  const found = [];
  for (const line of text.split('\n')) {
    if (!fenced(line) && (/^ {0,3}#{1,2} /.test(line) || own.has(line.trim()))) found.push(line.trim());
  }
  return JSON.stringify([found, fenced('')]);
}

/** @param {string} plain @param {string} real */
function readsBack(plain, real) {
  const own = new Set(plain.split('\n').filter((l) => /^#+ /.test(l)));
  return outline(plain, own) === outline(real, own);
}

/**
 * Also what Seldon's own check refuses and the shared reader passes, since a design the interview wrote has met no
 * check of Seldon's: a kind it doesn't have, the tag on a heading, more than five requirements on an epic, sections out
 * of order.
 * @param {import('./seldon-design.mjs').Phase[]} epics @param {{epic: string, line: string}[]} lost
 * @param {string} title @param {Record<string, string>} brief @param {import('./seldon-design.mjs').Decision[]} decisions
 * @param {Record<string, string | null>} [texts] the design's files as read, by name
 * @returns {Issue[]}
 */
export function judgeDesign(epics, lost, title, brief, decisions, texts = {}) {
  /** @type {Issue[]} */
  const issues = [];
  for (const d of decisions) {
    if (!KINDS.includes(d.kind)) issues.push({ file: 'spine.md', id: d.id, section: 'Kind', problem: `${JSON.stringify(d.kind)} is not one of Seldon's kinds: ${KINDS.join(', ')}` });
    if (d.title.includes(TAG)) issues.push({ file: 'spine.md', id: d.id, problem: `its heading carries ${TAG}, which goes only in free text` });
  }
  for (const e of epics) {
    if (e.name.includes(TAG)) issues.push({ file: 'epics.md', id: e.epic, problem: `its heading carries ${TAG}, which goes only in free text` });
    if (e.requirements.length > 5) issues.push({ file: 'epics.md', id: e.epic, field: 'Requirements', problem: `names ${e.requirements.length} requirements, and an epic takes at most 5` });
  }
  for (const [file, names] of /** @type {[string, string[]][]} */ ([['brief.md', BRIEF_SECTIONS], ['prd.md', PRD_SECTIONS]])) {
    const order = (texts[file] ?? '').split(/\r?\n/).filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim()).filter((n) => names.includes(n));
    if (JSON.stringify(order) !== JSON.stringify(names.filter((n) => order.includes(n)))) {
      issues.push({ file, problem: `its sections run ${order.join(', ')}, and Seldon's order is ${names.join(', ')}` });
    }
  }
  for (const { epic, line } of lost) {
    issues.push({ file: 'epics.md', id: epic, field: 'Done when',
      problem: `${JSON.stringify(line)} is in no item - an item opens with "- " at the start of its line, and its other lines are indented` });
  }
  for (const e of epics) {
    const n = e.success_criteria.length;
    if (n < 2 || n > 5) {
      issues.push({ file: 'epics.md', id: e.epic, field: 'Done when', problem: `holds ${n} item${n === 1 ? '' : 's'}, and an epic takes 2 to 5` });
    }
    const plain = { ...e, description: PLAIN, boundaries: PLAIN };
    const file = renderEpicFile(plain);
    if (!readsBack(file, renderEpicFile({ ...plain, description: e.description }))) {
      issues.push({ file: 'epics.md', id: e.epic, field: 'Outcome', problem: UNREADABLE });
    }
    if (!readsBack(file, renderEpicFile({ ...plain, boundaries: e.boundaries }))) {
      issues.push({ file: 'epics.md', id: e.epic, field: 'Boundaries', problem: UNREADABLE });
    }
  }
  const blank = Object.fromEntries(Object.keys(brief).map((name) => [name, PLAIN]));
  for (const name of Object.keys(brief)) {
    const one = { ...blank, [name]: brief[name] };
    const reads = readsBack(renderProjectFile(title, blank, epics, decisions), renderProjectFile(title, one, epics, decisions))
      && readsBack(renderReleaseFile(title, blank, epics), renderReleaseFile(title, one, epics));
    if (!reads) issues.push({ file: 'brief.md', section: name, problem: UNREADABLE });
  }
  return issues;
}
