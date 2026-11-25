// @ts-check
// agile-judge.mjs - why a design's own words would not survive in the agile path's files, found before one is written
// the old path reads past some of these, so they're judged here and not in the shared reader
// pure: a read design in, issues out
'use strict';

import { renderEpicFile, renderProjectFile, renderReleaseFile } from './agile-render.mjs';

/** @typedef {import('./seldon-design.mjs').Issue} Issue */

/** A stand-in for every other value, so a verdict is about one value alone. */
const PLAIN = 'plain';

const UNREADABLE = 'would not read back from the file it goes into - it opens a code fence that never closes, or holds a line that'
  + ' reads as one of that file\'s own headings; close the fence or reword that line';

/**
 * The headings a reader finds in a file: every `#` line outside a code fence. Level 3 and deeper count only when the file
 * has that heading itself, so a brief section may hold its own.
 * @param {string} text @param {Set<string>} own @returns {string}
 */
function outline(text, own) {
  /** @type {string | null} */
  let fence = null;
  const found = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const mark = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence !== null) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length && line === mark) fence = null;
    } else if (mark) fence = mark;
    else if (/^#{1,2} /.test(line) || own.has(line)) found.push(line);
  }
  return JSON.stringify([found, fence !== null]);
}

/** @param {string} plain @param {string} real */
function readsBack(plain, real) {
  const own = new Set(plain.split('\n').filter((l) => /^#{3,} /.test(l)));
  return outline(plain, own) === outline(real, own);
}

/**
 * @param {import('./seldon-design.mjs').Phase[]} epics @param {{epic: string, line: string}[]} lost
 * @param {string} title @param {Record<string, string>} brief @param {import('./seldon-design.mjs').Decision[]} decisions
 * @returns {Issue[]}
 */
export function judgeDesign(epics, lost, title, brief, decisions) {
  /** @type {Issue[]} */
  const issues = [];
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
