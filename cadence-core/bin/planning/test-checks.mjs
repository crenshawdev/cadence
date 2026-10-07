// @ts-check
// planning/test-checks.mjs - `test-checks <plan file>...`: the one list every
// test switch reads. A plan written with any of the four `workflow.*` test
// switches on carries two plan-level sections, `## Evidence map` (one row per
// check, each bound to one criterion token) and `## Tests` (per task, labelled
// tables of Test | Supplied | Asserts | Catches). This reads both, and names
// every line of them it could not read, so a malformed table is a plan defect
// found at plan time instead of a silent hole in what gets checked later.
//
// It reports and refuses nothing about the plan itself: an unreadable row is an
// `issues` entry, never `ok:false`. Only a missing argument or an unreadable
// path refuses.
'use strict';

import { readFileSync } from 'node:fs';
import { fail, ok } from './core.mjs';
import { sectionSpan } from '../lib/planning-files.mjs';

const MAP_HEADER = ['criterion', 'task', 'command', 'test file', 'function', 'expected',
  'unit and fakes', 'break'];
const TESTS_HEADER = ['test', 'supplied', 'asserts', 'catches'];

/**
 * The cells of one GFM table row: split on unescaped `|`, `\|` unescaped, each
 * cell trimmed, and a cell that is exactly one backtick span read as its content.
 * @param {string} line
 */
function cells(line) {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (/(^|[^\\])\|$/.test(body)) body = body.slice(0, -1);
  return body.split(/(?<!\\)\|/).map((c) => {
    const t = c.replace(/\\\|/g, '|').trim();
    const span = t.match(/^`([^`]*)`$/);
    return span ? span[1].trim() : t;
  });
}

const isDelimiter = (/** @type {string[]} */ row) => row.length > 0 && row.every((c) => /^:?-+:?$/.test(c));
const sameHeader = (/** @type {string[]} */ row, /** @type {string[]} */ want) =>
  row.length === want.length && row.every((c, i) => c.toLowerCase() === want[i]);
const noneToEmpty = (/** @type {string} */ c) => (c.toLowerCase() === 'none' ? '' : c);

/**
 * The tables inside lines [from, to): each a run of consecutive `|` lines, with
 * its header row, and its body rows after the delimiter row.
 * @param {string[]} lines
 * @param {number} from
 * @param {number} to
 */
function tablesIn(lines, from, to) {
  /** @type {{header: number, rows: number[]}[]} */
  const out = [];
  let i = from;
  while (i < to) {
    if (!lines[i].trim().startsWith('|')) { i++; continue; }
    const t = { header: i, rows: /** @type {number[]} */ ([]) };
    i++;
    if (i < to && lines[i].trim().startsWith('|') && isDelimiter(cells(lines[i]))) i++;
    while (i < to && lines[i].trim().startsWith('|')) t.rows.push(i++);
    out.push(t);
  }
  return out;
}

/**
 * Read a plan's `## Evidence map` and `## Tests` sections. Pure: text in,
 * structure out, no I/O and no throw. Line numbers are 1-based plan lines.
 * @param {string} text
 */
function parseTestChecks(text) {
  const lines = String(text).split(/\r?\n/);
  /** @type {{line: number, reason: string}[]} */
  const issues = [];
  const issue = (/** @type {number} */ i, /** @type {string} */ reason) => issues.push({ line: i + 1, reason });

  // The task numbers the plan declares, read outside fences the same way
  // sectionSpan reads its headings, so a fenced example task is not one.
  const tasks = new Set();
  let fenceOpen = false;
  for (const l of lines) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(l)) { fenceOpen = !fenceOpen; continue; }
    const m = !fenceOpen && l.match(/^### Task (\d+)\b/);
    if (m) tasks.add(Number(m[1]));
  }
  const taskOf = (/** @type {string} */ cell) => {
    const m = cell.match(/^(?:Task\s+)?(\d+)$/i);
    return m && tasks.has(Number(m[1])) ? Number(m[1]) : null;
  };

  /** Rows of a table that could not be read as a whole. */
  const unread = (/** @type {{rows: number[]}} */ t, /** @type {number} */ at) => {
    for (const r of t.rows) issue(r, `row of the table at line ${at + 1}, which was not read`);
  };

  const mapSpan = sectionSpan(lines, '## Evidence map');
  const testsSpan = sectionSpan(lines, '## Tests');

  /** @type {any[]} */
  const checks = [];
  if (mapSpan.start >= 0) {
    const seen = new Map();
    let mapTables = 0;
    for (const t of tablesIn(lines, mapSpan.start + 1, mapSpan.end)) {
      if (!sameHeader(cells(lines[t.header]), MAP_HEADER)) {
        issue(t.header, 'table header is not the evidence-map header'
          + ' | Criterion | Task | Command | Test file | Function | Expected | Unit and fakes | Break |');
        unread(t, t.header);
        continue;
      }
      mapTables++;
      for (const r of t.rows) {
        const c = cells(lines[r]);
        if (c.length !== MAP_HEADER.length) {
          issue(r, `row has ${c.length} cells where the header has ${MAP_HEADER.length}`);
          continue;
        }
        const token = c[0].match(/^(AC\d+|MT\d+)(?![A-Za-z0-9_])/);
        if (!token) { issue(r, 'Criterion cell does not begin with an AC<N> or MT<n> token'); continue; }
        if (seen.has(token[1])) {
          issue(r, `criterion token ${token[1]} is already carried by line ${seen.get(token[1])}`);
          continue;
        }
        const task = taskOf(c[1]);
        if (task === null) { issue(r, `Task cell "${c[1]}" names no ### Task <n> heading of this plan`); continue; }
        seen.set(token[1], r + 1);
        checks.push({
          criterion: token[1], criterion_cell: c[0], task, command: c[2],
          test_file: noneToEmpty(c[3]), function: noneToEmpty(c[4]), expected: c[5],
          unit_and_fakes: c[6], break: c[7], line: r + 1,
          human_verify: c[2].startsWith('human-verify:'),
        });
      }
    }
    if (mapTables === 0) issue(mapSpan.start, '## Evidence map holds no map table');
  }

  /** @type {any[]} */
  const tests = [];
  if (testsSpan.start >= 0) {
    for (const t of tablesIn(lines, testsSpan.start + 1, testsSpan.end)) {
      if (!sameHeader(cells(lines[t.header]), TESTS_HEADER)) {
        issue(t.header, 'table header is not the tests header | Test | Supplied | Asserts | Catches |');
        unread(t, t.header);
        continue;
      }
      let k = t.header - 1;
      while (k > testsSpan.start && !lines[k].trim()) k--;
      if (k <= testsSpan.start || !/^\*\*Task \d+\*\*/.test(lines[k].trim())) {
        issue(t.header, 'table has no **Task <n>** label line before it');
        unread(t, t.header);
        continue;
      }
      const label = lines[k].trim();
      const spans = [...label.matchAll(/`([^`]*)`/g)].map((m) => m[1].trim());
      const task = taskOf(/** @type {RegExpMatchArray} */ (label.match(/^\*\*Task (\d+)\*\*/))[1]);
      if (spans.length < 2) {
        issue(k, 'label line does not name a test file and a command in two backtick spans');
        unread(t, t.header);
        continue;
      }
      if (task === null) {
        issue(k, 'label names no ### Task <n> heading of this plan');
        unread(t, t.header);
        continue;
      }
      for (const r of t.rows) {
        const c = cells(lines[r]);
        if (c.length !== TESTS_HEADER.length) {
          issue(r, `row has ${c.length} cells where the header has ${TESTS_HEADER.length}`);
          continue;
        }
        tests.push({
          task, test_file: spans[0], command: spans[1],
          test: c[0], supplied: c[1], asserts: c[2], catches: c[3], line: r + 1,
        });
      }
    }
  }

  const has = { map: mapSpan.start >= 0, tests: testsSpan.start >= 0 };
  const sections = has.map && has.tests ? 'both'
    : has.map ? 'evidence_map' : has.tests ? 'tests' : 'neither';
  issues.sort((a, b) => a.line - b.line);
  return { sections, checks, tests, issues };
}

/** @param {string[]} paths */
function cmdTestChecks(paths) {
  if (!paths.length) {
    return fail('bad-args', 'test-checks needs at least one plan file path',
      'pass each PLAN file to read as a positional word after `test-checks`, then re-run');
  }
  const texts = [];
  for (const p of paths) {
    try { texts.push(readFileSync(p, 'utf8')); }
    catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? e.code : 'unreadable';
      return fail('unreadable-plan', `cannot read ${p} (${code})`,
        'check the path names an existing PLAN file and re-run - nothing was read');
    }
  }
  ok({ plans: paths.map((p, i) => ({ plan: p, ...parseTestChecks(texts[i]) })) });
}

export { cmdTestChecks, parseTestChecks };
