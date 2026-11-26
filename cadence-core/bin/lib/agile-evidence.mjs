// @ts-check
// agile-evidence.mjs - a finished epic's Evidence, from git, its stories' review records and the run record; no model runs
'use strict';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { agileTasksDir } from './agile-paths.mjs';
import { boundedRun } from './bounded-run.mjs';
import { fingerprint } from './filing-decision.mjs';
import { parseDeclinedRows, parseFiledRows } from './planning-files.mjs';
import { declinedHome, filedHome } from './project-homes.mjs';
import { TERMINAL, rotatedTracePath, tracePath } from './trace.mjs';

const GIT_TIMEOUT_MS = 30000;
const SEVERITIES = Object.freeze(['blocker', 'high', 'medium', 'low']);
const OUTCOMES = Object.freeze(['fixed', 'refuted', 'let stand', 'declined', 'filed', 'open']);

/** @param {string} root @param {string[]} args */
function git(root, args) {
  const r = boundedRun('git', args, { cwd: root, timeout: GIT_TIMEOUT_MS });
  if (!r.ok) throw new Error(`git ${args[0]} failed in ${root}`);
  return r.stdout.trim();
}

/** A ledger's fingerprints, none when it isn't there yet. @param {string} file @param {(t: string) => {fingerprint: string}[]} parse */
function ledger(file, parse) {
  return new Set(existsSync(file) ? parse(readFileSync(file, 'utf8')).map((r) => r.fingerprint) : []);
}

/** Every row of the run record, the rotated half first; a line that isn't a JSON object is passed over. @param {string} planning */
function recordRows(planning) {
  /** @type {any[]} */
  const rows = [];
  for (const file of [rotatedTracePath(planning), tracePath(planning)]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      try { const e = JSON.parse(line); if (e && typeof e === 'object' && !Array.isArray(e)) rows.push(e); } catch { /* not a row */ }
    }
  }
  return rows;
}

/**
 * @typedef {{id: string, title: string, size: string, base: string | null}} DoneStory
 * @typedef {{stories: {id: string, title: string, size: string}[], since: string | null, commits: number, files: number,
 *   insertions: number, deletions: number, findings: {raised: number, severity: Record<string, number>, outcome: Record<string, number>},
 *   tokens: {total: number, role: Record<string, number>}}} Evidence
 */

/**
 * @param {{planning: string, root: string, epic: string, stories: DoneStory[]}} at
 * @returns {Evidence}
 */
export function epicEvidence({ planning, root, epic, stories }) {
  // the earliest Base is the one furthest from HEAD; every story after it began on top of it
  const bases = [...new Set(stories.map((s) => s.base).filter((b) => b !== null))];
  const since = bases.map((b) => ({ b, n: Number(git(root, ['rev-list', '--count', `${b}..HEAD`])) })).sort((x, y) => y.n - x.n)[0] ?? null;
  const stat = since ? git(root, ['diff', '--shortstat', `${since.b}..HEAD`]) : '';
  const count = (/** @type {RegExp} */ re) => Number(re.exec(stat)?.[1] ?? 0);

  const declined = ledger(declinedHome(planning), parseDeclinedRows);
  const filed = ledger(filedHome(planning), parseFiledRows);
  /** @type {Record<string, number>} */
  const severity = {};
  /** @type {Record<string, number>} */
  const outcome = {};
  let raised = 0;
  for (const { id } of stories) {
    const home = join(agileTasksDir(join(planning, 'agile')), id);
    if (!existsSync(home)) continue;
    for (const name of readdirSync(home).filter((n) => /^ADJUDICATION-.*\.json$/.test(n)).sort()) {
      const record = JSON.parse(readFileSync(join(home, name), 'utf8'));
      for (const e of Array.isArray(record?.entries) ? record.entries : []) {
        raised += 1;
        severity[e.severity] = (severity[e.severity] ?? 0) + 1;
        const print = fingerprint(e);
        const came = e.ruling === 'refuted' ? 'refuted' : e.fix_commit ? 'fixed' : e.overridden === true ? 'let stand'
          : declined.has(print) ? 'declined' : filed.has(print) ? 'filed' : 'open';
        outcome[came] = (outcome[came] ?? 0) + 1;
      }
    }
  }

  // a story's build is its own run, so its workers' figures are under that run's id; an unknown read is the epic's own
  const rows = recordRows(planning);
  const ids = new Set(stories.map((s) => s.id));
  const runs = new Set(rows.filter((e) => e.event === 'dispatch' && e.role === 'cad-agile' && ids.has(e.plan)).map((e) => e.corr));
  /** @type {Record<string, number>} */
  const role = {};
  let total = 0;
  for (const e of rows) {
    if (!TERMINAL.includes(e.event) || typeof e.tokens !== 'number' || !(runs.has(e.corr) || e.plan === epic)) continue;
    role[e.role] = (role[e.role] ?? 0) + e.tokens;
    total += e.tokens;
  }

  return { stories: stories.map(({ id, title, size }) => ({ id, title, size })), since: since?.b ?? null,
    commits: since?.n ?? 0, files: count(/(\d+) files? changed/), insertions: count(/(\d+) insertions?/), deletions: count(/(\d+) deletions?/),
    findings: { raised, severity, outcome }, tokens: { total, role } };
}

const n = (/** @type {number} */ v) => v.toLocaleString('en-US');
/** The nonzero counts in their order, as "1 high, 2 low". @param {Record<string, number>} counts @param {readonly string[]} order */
const listed = (counts, order) => [...order, ...Object.keys(counts).filter((k) => !order.includes(k)).sort()]
  .filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`).join(', ');

/** The Evidence as `retro.md` holds it, one line each. @param {Evidence} e @returns {string[]} */
export function renderEvidence(e) {
  /** @type {Record<string, number>} */
  const sizes = {};
  for (const s of e.stories) sizes[s.size] = (sizes[s.size] ?? 0) + 1;
  const { raised, severity, outcome } = e.findings;
  return [
    `- ${e.stories.length} ${e.stories.length === 1 ? 'story' : 'stories'} (${listed(sizes, ['L', 'M', 'S'])}): ${e.stories.map((s) => `${s.id} ${s.title}`).join(', ')}.`,
    e.since ? `- ${e.commits} ${e.commits === 1 ? 'commit' : 'commits'} since ${e.since}; ${e.files} ${e.files === 1 ? 'file' : 'files'}, +${n(e.insertions)} and -${n(e.deletions)}.` : '- No story recorded where it began, so no commits are counted.',
    raised ? `- ${raised} ${raised === 1 ? 'finding' : 'findings'} raised: ${listed(severity, SEVERITIES)}. ${listed(outcome, OUTCOMES)}.` : '- No findings raised.',
    e.tokens.total
      ? `- Recorded agent tokens ${n(e.tokens.total)}: ${Object.entries(e.tokens.role).sort((a, b) => b[1] - a[1]).map(([r, t]) => `${r} ${n(t)}`).join(', ')}. The session's own tokens aren't recorded.`
      : '- No agent tokens recorded. The session\'s own tokens aren\'t recorded.',
  ];
}
