// @ts-check
// agile-evidence.mjs - a finished epic's Evidence, from git, its stories' review records and the run record; no model runs
'use strict';

import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { agileTasksDir } from './agile-paths.mjs';
import { boundedRun } from './bounded-run.mjs';
import { fingerprint } from './filing-decision.mjs';
import { parseDeclinedRows, parseFiledRows } from './planning-files.mjs';
import { declinedHome, filedHome } from './project-homes.mjs';
import { isPlainObject } from './text-util.mjs';
import { MAX_TRACE_BYTES, TERMINAL, rotatedTracePath, tracePath } from './trace.mjs';

const GIT_TIMEOUT_MS = 30000;
const SEVERITIES = Object.freeze(['blocker', 'high', 'medium', 'low']);
const SHOWN_SEVERITIES = Object.freeze([...SEVERITIES, 'unrated']);
const OUTCOMES = Object.freeze(['fixed', 'refuted', 'let stand', 'declined', 'filed', 'open']);

/** @param {string} root @param {string[]} args */
function git(root, args) {
  const r = boundedRun('git', args, { cwd: root, timeout: GIT_TIMEOUT_MS });
  if (!r.ok) throw new Error(`git ${args[0]} failed in ${root}`);
  return r.stdout.trim();
}

/** A Base the story file holds, if it's a commit here: hex only, so nothing in it reaches git as an option. @param {string} root @param {string} b */
const isCommit = (root, b) => /^[0-9a-f]{4,40}$/.test(b)
  && boundedRun('git', ['rev-parse', '--verify', '--quiet', '--end-of-options', `${b}^{commit}`], { cwd: root, timeout: GIT_TIMEOUT_MS }).ok;

/** Counts keyed by text from the files, with no prototype a key like `__proto__` could reach. */
const tally = () => /** @type {Record<string, number>} */ (Object.create(null));

/** A ledger's fingerprints, none when it isn't there yet. @param {string} file @param {(t: string) => {fingerprint: string}[]} parse */
function ledger(file, parse) {
  return new Set(existsSync(file) ? parse(readFileSync(file, 'utf8')).map((r) => r.fingerprint) : []);
}

/** A record file's lines, its first MAX_TRACE_BYTES as the record's own reader takes them, a cut last line dropped. @param {string} file */
function recordLines(file) {
  if (!existsSync(file)) return [];
  if (statSync(file).size <= MAX_TRACE_BYTES) return readFileSync(file, 'utf8').split('\n');
  const buf = Buffer.alloc(MAX_TRACE_BYTES);
  const fd = openSync(file, 'r');
  let got = 0;
  try { got = readSync(fd, buf, 0, MAX_TRACE_BYTES, 0); } finally { closeSync(fd); }
  const lines = buf.subarray(0, got).toString('utf8').split('\n');
  lines.pop();
  return lines;
}

/** Every row of the run record, the rotated half first; a line that isn't a JSON object is passed over. @param {string} planning */
function recordRows(planning) {
  /** @type {any[]} */
  const rows = [];
  for (const file of [rotatedTracePath(planning), tracePath(planning)]) {
    for (const line of recordLines(file)) {
      try { const e = JSON.parse(line); if (e && typeof e === 'object' && !Array.isArray(e)) rows.push(e); } catch { /* not a row */ }
    }
  }
  return rows;
}

/**
 * @typedef {{id: string, title: string, size: string, base: string | null}} DoneStory
 * @typedef {{stories: {id: string, title: string, size: string}[], since: string | null, commits: number, files: number,
 *   insertions: number, deletions: number, findings: {raised: number, severity: Record<string, number>, outcome: Record<string, number>},
 *   tokens: {total: number, role: Record<string, number>}, unread: string[]}} Evidence
 */

/**
 * @param {{planning: string, root: string, epic: string, stories: DoneStory[]}} at
 * @returns {Evidence}
 */
export function epicEvidence({ planning, root, epic, stories }) {
  /** @type {string[]} */
  const unread = [];
  // the earliest Base is the one furthest from HEAD; every story after it began on top of it
  const bases = [...new Set(stories.map((s) => s.base).filter((b) => b !== null))].filter((b) => isCommit(root, b) || !unread.push(`Base ${JSON.stringify(b)}, not a commit here`));
  const since = bases.map((b) => ({ b, n: Number(git(root, ['rev-list', '--count', '--end-of-options', `${b}..HEAD`])) })).sort((x, y) => y.n - x.n)[0] ?? null;
  const stat = since ? git(root, ['diff', '--shortstat', '--end-of-options', `${since.b}..HEAD`]) : '';
  const count = (/** @type {RegExp} */ re) => Number(re.exec(stat)?.[1] ?? 0);

  const declined = ledger(declinedHome(planning), parseDeclinedRows);
  const filed = ledger(filedHome(planning), parseFiledRows);
  const severity = tally();
  const outcome = tally();
  let raised = 0;
  for (const { id } of stories) {
    const home = join(agileTasksDir(join(planning, 'agile')), id);
    /** @type {any[]} */
    let records = [];
    try {
      if (!existsSync(home)) continue;
      records = readdirSync(home).filter((n) => /^ADJUDICATION-.*\.json$/.test(n)).sort().map((name) => join(home, name));
    } catch { unread.push(`${id}'s review folder`); continue; }
    for (const file of records) {
      /** @type {any[] | null} */
      let entries = null;
      // a damaged record is named and left out, so the Evidence of the rest still comes back
      try { const r = JSON.parse(readFileSync(file, 'utf8')); entries = Array.isArray(r?.entries) ? r.entries : null; } catch { /* unread */ }
      if (entries === null) { unread.push(`${id}'s ${basename(file)}`); continue; }
      for (const e of entries.filter(isPlainObject)) {
        raised += 1;
        const level = SEVERITIES.includes(e.severity) ? e.severity : 'unrated';
        severity[level] = (severity[level] ?? 0) + 1;
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
  const role = tally();
  let total = 0;
  // a byte-identical repeat of a close is a replay, which the record's own renderer counts once
  const seen = new Set();
  for (const e of rows) {
    if (!TERMINAL.includes(e.event) || !Number.isSafeInteger(e.tokens) || e.tokens < 0 || !(runs.has(e.corr) || e.plan === epic)) continue;
    const identity = [e.corr, e.plan, e.event, e.role, e.ts, e.tokens, e.turns].map((v) => JSON.stringify(v ?? null)).join('\0');
    if (seen.has(identity)) continue;
    seen.add(identity);
    const who = typeof e.role === 'string' && e.role ? e.role : 'unnamed';
    role[who] = (role[who] ?? 0) + e.tokens;
    total += e.tokens;
  }

  return { stories: stories.map(({ id, title, size }) => ({ id, title, size })), since: since?.b ?? null,
    commits: since?.n ?? 0, files: count(/(\d+) files? changed/), insertions: count(/(\d+) insertions?/), deletions: count(/(\d+) deletions?/),
    findings: { raised, severity: { ...severity }, outcome: { ...outcome } }, tokens: { total, role: { ...role } }, unread };
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
    raised ? `- ${raised} ${raised === 1 ? 'finding' : 'findings'} raised: ${listed(severity, SHOWN_SEVERITIES)}. ${listed(outcome, OUTCOMES)}.` : '- No findings raised.',
    e.tokens.total
      ? `- Recorded agent tokens ${n(e.tokens.total)}: ${Object.entries(e.tokens.role).sort((a, b) => b[1] - a[1]).map(([r, t]) => `${r} ${n(t)}`).join(', ')}. The session's own tokens aren't recorded.`
      : '- No agent tokens recorded. The session\'s own tokens aren\'t recorded.',
    ...(e.unread.length ? [`- Left out, since they couldn't be read: ${e.unread.join('; ')}.`] : []),
  ];
}
