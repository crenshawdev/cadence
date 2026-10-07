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
//
// It also reads the plan's executor report, `reports/plan-<k>.md`, for its
// `Test evidence:` section (the red-first runs and negative controls the
// test-evidence switch asks for), and attaches each recorded row to the check
// or listed test it is for. The report path comes from core.mjs's
// `readPlanReports`, the one derivation `replay-check` and `status` read, so a
// rotated `plan-<k>.<n>.md` sibling is never what gets read.
'use strict';

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fail, ok, readPlanReports } from './core.mjs';
import { atomicWrite, sectionSpan } from '../lib/planning-files.mjs';

const MAP_HEADER = ['criterion', 'task', 'command', 'test file', 'function', 'expected',
  'unit and fakes', 'break'];
const TESTS_HEADER = ['test', 'supplied', 'asserts', 'catches'];
const RUN_HEADER = ['check', 'command', 'red by', 'red at', 'failing line', 'passing line'];
const CONTROL_HEADER = ['task', 'test', 'break', 'failing line', 'restore'];
/** The criterion token a cell begins with, or null - the token alone matches. */
const tokenOf = (/** @type {string} */ cell) => {
  const m = cell.match(/^(AC\d+|MT\d+)(?![A-Za-z0-9_])/);
  return m ? m[1] : null;
};

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
  // The same pass names a near-miss section heading (`## Evidence Map`,
  // `### Tests`): the sections are read only under their exact headings, and a
  // near miss would otherwise read as a plan listing nothing.
  const tasks = new Set();
  let fenceOpen = false;
  for (const [i, l] of lines.entries()) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(l)) { fenceOpen = !fenceOpen; continue; }
    if (fenceOpen) continue;
    const m = l.match(/^### Task (\d+)\b/);
    if (m) tasks.add(Number(m[1]));
    const h = l.trim();
    const near = h.match(/^#{1,6}\s+(evidence\s+map|tests)\s*$/i);
    if (near && h !== '## Evidence map' && h !== '## Tests') {
      issue(i, `heading "${h}" is not the section heading ${/^t/i.test(near[1]) ? '## Tests' : '## Evidence map'}, so nothing under it was read`);
    }
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
        const token = tokenOf(c[0]);
        if (!token) { issue(r, 'Criterion cell does not begin with an AC<N> or MT<n> token'); continue; }
        if (seen.has(token)) {
          issue(r, `criterion token ${token} is already carried by line ${seen.get(token)}`);
          continue;
        }
        const task = taskOf(c[1]);
        if (task === null) { issue(r, `Task cell "${c[1]}" names no ### Task <n> heading of this plan`); continue; }
        seen.set(token, r + 1);
        checks.push({
          criterion: token, criterion_cell: c[0], task, command: c[2],
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

/**
 * Read a report's `Test evidence:` section: from a line reading exactly that at
 * column 0, up to the first line that is neither blank nor table-shaped. Pure.
 * Line numbers are 1-based report lines.
 * @param {string} text
 */
function parseEvidence(text) {
  const lines = String(text).split(/\r?\n/);
  /** @type {{line: number, reason: string}[]} */
  const issues = [];
  /** @type {any[]} */
  const runs = [];
  /** @type {any[]} */
  const controls = [];
  const start = lines.indexOf('Test evidence:');
  if (start < 0) return { section: false, runs, controls, issues };
  let end = start + 1;
  while (end < lines.length && (!lines[end].trim() || lines[end].trim().startsWith('|'))) end++;
  for (const t of tablesIn(lines, start + 1, end)) {
    const head = cells(lines[t.header]);
    const want = sameHeader(head, RUN_HEADER) ? RUN_HEADER : sameHeader(head, CONTROL_HEADER) ? CONTROL_HEADER : null;
    if (!want) {
      issues.push({ line: t.header + 1, reason: 'table header is neither the red-run header'
        + ' | Check | Command | Red by | Red at | Failing line | Passing line | nor the control header'
        + ' | Task | Test | Break | Failing line | Restore |' });
      for (const r of t.rows) issues.push({ line: r + 1, reason: `row of the table at line ${t.header + 1}, which was not read` });
      continue;
    }
    for (const r of t.rows) {
      const c = cells(lines[r]);
      if (c.length !== want.length) {
        issues.push({ line: r + 1, reason: `row has ${c.length} cells where the header has ${want.length}` });
        continue;
      }
      if (want === RUN_HEADER) {
        runs.push({ check: c[0], command: c[1], red_by: c[2], red_at: c[3],
          failing_line: c[4], passing_line: c[5], line: r + 1 });
      } else {
        controls.push({ task: c[0], test: c[1], break: c[2], failing_line: c[3], restore: c[4], line: r + 1 });
      }
    }
  }
  return { section: true, runs, controls, issues };
}

/**
 * Attach a report's evidence rows to the plan's checks and listed tests. A
 * check takes the first red-run row whose Check cell begins with its token, and
 * the first control row whose Task cell does; a listed test takes the first
 * control row whose Task and Test equal its own. A later row for the same entry
 * is a duplicate, and a row for no entry an orphan, each named by report line.
 * @param {{checks: any[], tests: any[]}} parsed
 * @param {{runs: any[], controls: any[]}} ev
 */
function attachEvidence(parsed, ev) {
  const checks = parsed.checks.map((c) => ({ ...c, evidence: { run: null, control: null } }));
  const tests = parsed.tests.map((t) => ({ ...t, evidence: { control: null } }));
  /** @type {{line: number, table: string}[]} */
  const orphans = [];
  /** @type {{line: number, table: string, first: number}[]} */
  const duplicates = [];
  const place = (/** @type {any} */ entry, /** @type {string} */ slot, /** @type {any} */ row, /** @type {string} */ table) => {
    if (!entry) orphans.push({ line: row.line, table });
    else if (entry.evidence[slot]) duplicates.push({ line: row.line, table, first: entry.evidence[slot].line });
    else entry.evidence[slot] = row;
  };
  for (const row of ev.runs) {
    const token = tokenOf(row.check);
    place(token && checks.find((c) => c.criterion === token), 'run', row, 'red-run');
  }
  for (const row of ev.controls) {
    const token = tokenOf(row.task);
    const n = row.task.match(/^(?:Task\s+)?(\d+)$/i);
    const entry = token ? checks.find((c) => c.criterion === token)
      : n ? tests.find((t) => t.task === Number(n[1]) && t.test === row.test) : null;
    place(entry, 'control', row, 'control');
  }
  return { checks, tests, orphans, duplicates };
}

/**
 * A plan's report and its evidence, read and attached. `report.state` is
 * `absent`, `no_section` or `read`. Writes nothing.
 * @param {string} planPath
 * @param {{checks: any[], tests: any[]}} parsed
 */
function readEvidence(planPath, parsed) {
  const pdir = dirname(planPath);
  const [r] = readPlanReports(pdir, [basename(planPath)]);
  const path = join(pdir, r.report);
  let text = null;
  if (r.exists) { try { text = readFileSync(path, 'utf8'); } catch { text = null; } }
  const ev = text === null ? null : parseEvidence(text);
  const state = ev === null ? 'absent' : ev.section ? 'read' : 'no_section';
  const at = attachEvidence(parsed, ev || { runs: [], controls: [] });
  return {
    checks: at.checks, tests: at.tests,
    report: { path, state, status: r.status, orphans: at.orphans, duplicates: at.duplicates,
      issues: ev ? ev.issues : [] },
    text,
  };
}

/**
 * Read each plan file, or refuse naming the first one that cannot be read.
 * @param {string[]} paths
 * @returns {string[]|null}
 */
function readPlans(paths) {
  const texts = [];
  for (const p of paths) {
    try { texts.push(readFileSync(p, 'utf8')); }
    catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? e.code : 'unreadable';
      fail('unreadable-plan', `cannot read ${p} (${code})`,
        'check the path names an existing PLAN file and re-run - nothing was read');
      return null;
    }
  }
  return texts;
}

/** @param {string[]} paths */
function cmdTestChecks(paths) {
  if (!paths.length) {
    return fail('bad-args', 'test-checks needs at least one plan file path',
      'pass each PLAN file to read as a positional word after `test-checks`, then re-run');
  }
  const texts = readPlans(paths);
  if (!texts) return;
  ok({ plans: paths.map((p, i) => {
    const parsed = parseTestChecks(texts[i]);
    const { checks, tests, report } = readEvidence(p, parsed);
    return { plan: p, ...parsed, checks, tests, report };
  }) });
}

// ---------------------------------------------------------------------------
// test-evidence <plan file> - is a `PLAN COMPLETE` report's evidence record
// complete? With the test-evidence switch on, /cad-execute runs this on every
// complete return before recording it. A short record rewrites the report's
// FIRST line to `PLAN CHECKPOINT: blocked` and nothing else, so `replay-check`
// and `status` (which read that line through `readPlanReports`) agree the plan
// is not complete, and the orchestrator takes handle_checkpoint's existing
// `blocked` arm. `blocked` because a new checkpoint type would be a new arm.
// ---------------------------------------------------------------------------

/** Blank, `-` or `none`, any case, after trimming. */
const isEmpty = (/** @type {string} */ c) => ['', '-', 'none'].includes(String(c).trim().toLowerCase());

/**
 * Is `hash` a commit HEAD descends from, in the repository holding `cwd`? A
 * hash naming no commit, or no repository at all, answers false.
 * @param {string} hash
 * @param {string} cwd
 */
const isAncestor = (hash, cwd) =>
  spawnSync('git', ['merge-base', '--is-ancestor', hash, 'HEAD'], { cwd, stdio: 'ignore' }).status === 0;

/**
 * What a check's red-run row fails, or null when it is whole.
 * @param {any} run
 * @param {string} cwd
 */
function runFault(run, cwd) {
  if (!run) return 'no red-run row';
  const by = run.red_by.trim().toLowerCase();
  if (by !== 'before' && by !== 'break') return `Red by "${run.red_by}" is neither before nor break`;
  if (!/^[0-9a-f]{7,40}$/i.test(run.red_at)) return `Red at "${run.red_at}" is not 7 to 40 hex characters`;
  if (!isAncestor(run.red_at, cwd)) return `Red at ${run.red_at} is not a commit HEAD descends from`;
  if (isEmpty(run.failing_line)) return 'red-run row has an empty Failing line';
  if (isEmpty(run.passing_line)) return 'red-run row has an empty Passing line';
  return null;
}

/** What a control row fails, or null when it is whole. @param {any} control */
function controlFault(control) {
  if (!control) return 'no control row';
  for (const [key, name] of [['break', 'Break'], ['failing_line', 'Failing line'], ['restore', 'Restore']]) {
    if (isEmpty(control[key])) return `control row has an empty ${name}`;
  }
  return null;
}

/** @param {string[]} paths */
function cmdTestEvidence(paths) {
  if (paths.length !== 1) {
    return fail('bad-args', `test-evidence needs exactly one plan file path (got ${paths.length})`,
      'pass the one PLAN file whose report to judge as a positional word after `test-evidence`, then re-run');
  }
  const texts = readPlans(paths);
  if (!texts) return;
  const planPath = paths[0];
  const parsed = parseTestChecks(texts[0]);
  const { checks, tests, report, text } = readEvidence(planPath, parsed);
  if (text === null) {
    return fail('no-report', `${report.path} does not exist, so there is no record to judge`,
      'this judges a report an executor returned PLAN COMPLETE on - nothing was written');
  }
  if (report.status !== 'PLAN COMPLETE') {
    return fail('not-complete', `${report.path} reads "${report.status}" on its first line, not PLAN COMPLETE`,
      'only a PLAN COMPLETE report is judged - nothing was written');
  }
  const counts = { checks: checks.length, tests: tests.length };
  if (parsed.sections === 'neither' && !parsed.issues.length) {
    return ok({ plan: planPath, report: report.path, state: 'lists-nothing', ...counts,
      note: 'the plan carries neither ## Evidence map nor ## Tests, so there is nothing to require' });
  }

  const cwd = dirname(planPath);
  const short = [];
  for (const c of checks) {
    if (c.human_verify) continue;
    const at = `${c.criterion} (Task ${c.task})`;
    const fault = runFault(c.evidence.run, cwd);
    if (fault) short.push(`${at}: ${fault}`);
    const byBreak = c.evidence.run && c.evidence.run.red_by.trim().toLowerCase() === 'break';
    if (!isEmpty(c.test_file) && !byBreak) {
      const cf = controlFault(c.evidence.control);
      if (cf) short.push(`${at}: ${cf}`);
    }
  }
  for (const t of tests) {
    const cf = controlFault(t.evidence.control);
    if (cf) short.push(`test "${t.test}" (Task ${t.task}): ${cf}`);
  }
  for (const i of parsed.issues) short.push(`plan line ${i.line}: ${i.reason}`);
  const orphans = report.orphans.map((o) => o.line);

  if (!short.length) {
    return ok({ plan: planPath, report: report.path, state: 'complete', ...counts,
      orphans: report.orphans, duplicates: report.duplicates });
  }
  const nl = text.indexOf('\n');
  const eol = nl === -1 ? text.length : nl > 0 && text[nl - 1] === '\r' ? nl - 1 : nl;
  try { atomicWrite(report.path, `PLAN CHECKPOINT: blocked${text.slice(eol)}`); }
  catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : 'unwritable';
    return fail('unwritable-report', `the record is short but ${report.path} could not be rewritten (${code})`,
      'make the report writable and re-run - its first line still reads PLAN COMPLETE');
  }
  return fail('evidence-short',
    `${report.path} now reads PLAN CHECKPOINT: blocked - ${short.join('; ')}`
      + (orphans.length ? `; evidence rows matching nothing the plan lists (not counted against it) at report lines ${orphans.join(', ')}` : ''),
    'record the missing runs with a continuation dispatch of this plan: each check red before its behaviour'
      + ' or under its Break, each listed test and each check with a test file broken, failed and restored');
}

export { cmdTestChecks, cmdTestEvidence, parseEvidence, parseTestChecks };
