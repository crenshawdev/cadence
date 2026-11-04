#!/usr/bin/env node
// @ts-check
// why.mjs - "why is this code like this", answered from the record already on disk.
// Its own script, not a planning.mjs subcommand: the main argument is a repository path, and planning.mjs runs every git call as `-C <root>` against `.planning` itself.
//
// Usage: why.mjs <path>[:<line>] [--dir <repo>] [--top <n>]
//   <path>[:<line>]  a repository-relative path, or that path with a 1-based
//                     line appended after the LAST colon (lib/why-query.mjs's
//                     `parseQuery` states the grammar and its five refusals).
//   --dir             the repository the query runs against. ABSENT means
//                      `process.cwd()`; empty, valueless or flag-shaped
//                      REFUSES (issue-check.mjs's disposition).
//   --top              the entry cap, default 6 (DEFAULT_TOP in
//                      lib/why-render.mjs).
//
// The flags are read before the positional is checked: arg-contract-adoption.test.mjs spawns this with a refusing flag last and no positional, and checking the query first would answer "missing-query" and never name the flag under test.
// One JSON object on stdout and never a subagent; git is the only child process, which why.test.mjs asserts by reading this source.
// The index is built once per invocation, not once per entry, so a long chain doesn't re-read every phase summary for each commit. The join hangs off each entry as a single `join` object, the one attach point why-render.mjs reads.
// The index has four tiers: live phase directories, archived trees, off-roadmap /cad-task records (a RECORD.md and no phase directory) and git history alone for closes that left neither on disk. They're merged in that order, disk first, so an archived phase both tiers could claim resolves to a copy a reader can open.
// The bare arm asks git twice. The chain keeps --follow, which brings git's history simplification along, and a second --full-history query (without --follow, since the two don't compose) measures what that left out. It runs on the bare arm only, only after the chain succeeded, and a failing second query reports absent instead of failing the first.
// An unreadable planning artifact never fails the query: the index fails open with warnings[] beside the answer, since git log already says what the commits are and a bad summary only thins the join.
'use strict';

import { join as joinPath } from 'node:path';
import { execFileSync } from 'node:child_process';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import {
  parseQuery, probeArgv, bareArgv, lineArgv, comparandArgv, classifyResult, excludedFrom,
} from './lib/why-query.mjs';
import { renderChain } from './lib/why-render.mjs';
import {
  buildCommitIndex, buildTaskIndex, buildRecoveredIndex, mergeCommitIndexes,
  resolveCommit, readPhaseRecords, readAdjudications, rangeMembers,
  touchedPaths, closeOver, archiveSections,
} from './lib/why-corpus.mjs';
import { decisionsFor, declaringTasks, parseDeviations } from './lib/why-record.mjs';

/**
 * Run `git <args>` in `dir` without throwing, so a non-zero exit or spawn failure becomes a result classifyResult can turn into a stated outcome and no raw `fatal:` reaches stdout.
 * @param {string} dir @param {string[]} args
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function runGit(dir, args) {
  try {
    const stdout = execFileSync('git', ['-C', dir, ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = /** @type {any} */ (e);
    return { status: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

/**
 * Split raw `git log` stdout into chain entries: one record per line, `\x1f`-joined (LOG_FORMAT in lib/why-query.mjs).
 * @param {string} stdout @returns {{sha: string, date: string, subject: string}[]}
 */
function parseEntries(stdout) {
  return stdout.split('\n').filter((l) => l.trim() !== '').map((line) => {
    const [sha, date, ...rest] = line.split('\x1f');
    return { sha, date, subject: rest.join('\x1f') };
  });
}

/**
 * Split raw `git log` stdout into comparand records: the full sha, then the space-separated parents, which is empty on a root commit (COMPARAND_FORMAT in lib/why-query.mjs).
 * @param {string} stdout @returns {{sha: string, parents: string[]}[]}
 */
function parseComparand(stdout) {
  return stdout.split('\n').filter((l) => l.trim() !== '').map((line) => {
    const [sha, parents] = line.split('\x1f');
    return { sha, parents: String(parents || '').split(' ').filter((p) => p !== '') };
  });
}

/**
 * What git's default history simplification left out of the bare arm's answer. A second query, not a flag on the first, because --follow and --full-history don't compose.
 * It fails open and silent, returning null: git log already said what the commits are, so a comparand that can't run makes the answer thinner, not wrong.
 * @param {string} dir @param {string} path
 * @param {{sha: string}[]} entries the chain the bare arm already answered
 * @returns {{sha: string, parentCount: number}[]|null}
 */
function simplificationReport(dir, path, entries) {
  const res = runGit(dir, comparandArgv(path));
  if (res.status !== 0) return null;
  return excludedFrom(entries.map((e) => e.sha), parseComparand(res.stdout));
}

/**
 * One index row as the entry carries it: the directory's own label, milestone and phase, plus the commits table's plan, task and description cells verbatim. Flat and serializable since it rides the JSON envelope.
 * @param {any} m @returns {any}
 */
function brief(m) {
  const out = {
    label: m.dir.label,
    milestone: m.dir.milestone,
    phase: m.dir.phase,
    plan: m.plan,
    task: m.task,
    description: m.description,
  };
  // a git-recovered row carries the tree it came from, so the renderer can say so instead of printing a directory name that no longer opens
  if (m.dir.recovered) out.recovered = { ...m.dir.recovered };
  // a task-tier row carries its slug, which is how the renderer tells a task directory from a phase one (never the label); phase and milestone are null there since a placeholder would print as a number
  if (m.dir.slug) out.slug = m.dir.slug;
  return out;
}

/**
 * The one attach point: every later edge adds a key to the object this returns.
 * @param {any} index @param {string} sha @returns {any}
 */
function joinFor(index, sha) {
  const { state, row, matches } = resolveCommit(index, sha);
  if (state === 'resolved') return { state, ...brief(row) };
  if (state === 'ambiguous') return { state, matches: matches.map(brief) };
  return { state: 'unresolved' };
}

/**
 * Resolve every commit in `raws` against the index and hang the record edges off it: one pass over the chain and one read per phase directory, memoized by directory and plan cell, so a long chain doesn't turn into a walk per commit.
 * @param {string} dir @param {string} path the queried repo-relative path
 * @param {any} index @param {{sha: string, date: string, subject: string}[]} raws
 * @returns {{entries: any[], warnings: string[]}}
 */
function joinChain(dir, path, index, raws) {
  /** @type {Map<string, any>} */
  const memo = new Map();
  /** @type {Map<string, any>} */
  const reviews = new Map();
  /** @type {Map<string, Set<string>|null>} */
  const ranges = new Map();
  /** @type {Set<string>} */
  const warnings = new Set();

  /** The survivors of one phase directory, read once. */
  const reviewsIn = (/** @type {any} */ d) => {
    if (!reviews.has(d.label)) {
      const read = readAdjudications(d, dir);
      for (const w of read.warnings) warnings.add(w);
      reviews.set(d.label, read.records);
    }
    return reviews.get(d.label);
  };

  /** `base..head` resolved once per distinct range, for the whole chain. */
  const membersOf = (/** @type {string} */ base, /** @type {string} */ head) => {
    const key = `${base}..${head}`;
    if (!ranges.has(key)) ranges.set(key, rangeMembers(dir, base, head));
    return ranges.get(key);
  };

  /** Which surviving findings cover `sha`, and which couldn't be decided: a finding whose range doesn't resolve is carried in `unresolved` instead of being dropped or claimed. */
  const reviewFor = (/** @type {any} */ d, /** @type {string} */ sha) => {
    const records = reviewsIn(d);
    const findings = [];
    const unresolved = [];
    for (const record of records) {
      for (const s of record.survivors) {
        const members = s.baseId && s.headId ? membersOf(s.baseId, s.headId) : null;
        if (members === null) unresolved.push({ ...s, record: record.name });
        else if (members.has(sha)) findings.push({ ...s, record: record.name });
      }
    }
    return { records: records.length, findings, unresolved };
  };

  const entries = raws.map((e) => {
    const join = joinFor(index, e.sha);
    if (join.state !== 'resolved') return { ...e, join };

    const key = `${join.label}\x1f${join.plan}`;
    if (!memo.has(key)) {
      const phaseDir = index.dirs.find((/** @type {any} */ d) => d.label === join.label);
      memo.set(key, readPhaseRecords(phaseDir, join.plan, dir));
    }
    const records = memo.get(key);
    for (const w of records.warnings) warnings.add(w);

    join.decision = decisionsFor({
      planText: records.plan, contextText: records.context, taskCell: join.task,
    });
    join.deviation = { bullets: parseDeviations(records.summary) };
    join.review = reviewFor(
      index.dirs.find((/** @type {any} */ d) => d.label === join.label), e.sha,
    );
    join.declared = {
      planFile: records.planFile,
      tasks: records.plan ? declaringTasks(records.plan, path) : [],
    };
    return { ...e, join };
  });

  // the named gap, one more pass after resolution because its git facts come for the whole unresolved set at once: one `git show --name-only` and the closes the index already carries
  const open = /** @type {any[]} */ (entries).filter((e) => e.join.state === 'unresolved');
  if (open.length) {
    const paths = touchedPaths(dir, open.map((e) => e.sha));
    const archive = archiveSections(joinPath(dir, '.planning'));
    for (const e of open) {
      const close = closeOver(index.prunes || [], e.date);
      e.join.gap = {
        close,
        scope: commitScope(e.subject),
        paths: paths.get(e.sha) || [],
        archive: (close && close.label && archive.get(close.label)) || [],
      };
    }
  }
  return { entries, warnings: [...warnings] };
}

/** A conventional commit's scope as the subject spells it, `1-3` out of `feat(1-3): ...`.
 * Corroboration only: phase numbers reset every milestone, so reading it as the phase key fails invisibly, and it's absent or uninformative on a good share of commits anyway.
 * @param {string} subject @returns {string|null} */
function commitScope(subject) {
  const m = String(subject || '').match(/^[a-zA-Z]+\(([^)\n]*)\)!?:/);
  return m && m[1].trim() ? m[1].trim() : null;
}

/**
 * The one non-flag token, skipping the value after `--dir` or `--top` so a flag's own value is never read as the query.
 * @param {string[]} argv @returns {string|undefined}
 */
function positionalQuery(argv) {
  const skip = new Set();
  argv.forEach((a, i) => { if (a === '--dir' || a === '--top') skip.add(i + 1); });
  for (let i = 0; i < argv.length; i++) {
    if (skip.has(i)) continue;
    if (!argv[i].startsWith('--')) return argv[i];
  }
  return undefined;
}

/** Next step for `git-failed`, written once since the probe and the chain query both reach it. classifyResult collapses every non-clean exit into that outcome, so the hint names the repo state the command needs instead of guessing a cause. */
const GIT_FAILED_HINT = 'this query needs a readable git repository: run it inside one, or point --dir at a working tree where `git log` answers, then re-run';

const argv = process.argv.slice(2);
const ROWS = CONTRACTS['why.mjs'];
/** One flag read through its declared row: the `''` row if it declares the flag, else the script-global `'*'` row. */
const arg = (name) => requireFlag(argv, name, ROWS[''][name] || ROWS['*'][name]);

try {
  const dir = arg('--dir') || process.cwd();
  const top = arg('--top');

  const query = positionalQuery(argv);
  // cast because `strict: false` won't narrow this JSDoc union
  const parsed = /** @type {any} */ (parseQuery(query));
  if (!parsed.ok) {
    emit({ ok: false, reason: 'bad-query', detail: parsed.reason,
      hint: 'pass ONE path, optionally with a line after a colon - `why.mjs cadence-core/bin/route.mjs:144` - and re-run' });
  } else {
    const { path, line } = parsed;

    // the not-in-history probe runs before either chain query, so a mistyped path gets the smallest invocation that can answer it and an empty chain is never silently reported
    const probe = runGit(dir, probeArgv(path));
    const probeResult = classifyResult({
      status: probe.status, stderr: probe.stderr, stdoutEmpty: probe.stdout.trim() === '',
    });

    if (probeResult.outcome === 'not-in-history') {
      emit({
        ok: true, path, line, result: 'not-in-history',
        text: `No commits: git has never seen "${path}" in this repository's history.`,
      });
    } else if (probeResult.outcome === 'git-failed') {
      emit({ ok: false, reason: 'git-failed', detail: 'the not-in-history probe',
        hint: GIT_FAILED_HINT });
    } else {
      const chain = line === undefined ? runGit(dir, bareArgv(path)) : runGit(dir, lineArgv(path, line));
      const result = classifyResult({
        status: chain.status, stderr: chain.stderr, stdoutEmpty: chain.stdout.trim() === '',
      });

      if (result.outcome === 'not-in-history') {
        emit({
          ok: true, path, line, result: 'not-in-history',
          text: `No commits: git has never seen "${path}" at the point this query resolves against.`,
        });
      } else if (result.outcome === 'line-past-end') {
        emit({
          ok: true, path, line, result: 'line-past-end',
          text: `Line ${line} is past the end of "${path}" (or the path is absent at the commit this query resolves against) - no diffs to report.`,
        });
      } else if (result.outcome === 'git-failed') {
        emit({ ok: false, reason: 'git-failed',
          detail: line === undefined ? 'the bare-path chain query' : 'the line-scoped chain query',
          hint: GIT_FAILED_HINT });
      } else {
        // one merged index per invocation over four tiers: live phase directories, archived trees, off-roadmap task records, and git history
        // alone for closes that left neither. They're ordered, not flattened, so the disk record wins when both claim a phase.
        const index = mergeCommitIndexes(
          buildCommitIndex(joinPath(dir, '.planning')),
          buildTaskIndex(joinPath(dir, '.planning')),
          buildRecoveredIndex(dir),
        );
        const raws = parseEntries(chain.stdout);
        // bare arm only, since -L carries its own simplification, and only after the chain query succeeded so a failed one doesn't pay for a second
        const excluded = line === undefined ? simplificationReport(dir, path, raws) : null;
        const joined = joinChain(dir, path, index, raws);
        const rendered = renderChain(joined.entries, { top, excluded, path });
        emit({
          ok: true, path, line, result: 'chain',
          text: rendered.text, shown: rendered.shown, total: rendered.total, entries: rendered.entries,
          excluded,
          warnings: [...index.warnings, ...joined.warnings],
        });
      }
    }
  }
} catch (e) {
  const err = /** @type {any} */ (e);
  if (err && err.seam) emit({ ok: false, reason: err.seam, detail: err.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: String(err && err.message ? err.message : err) });
}
