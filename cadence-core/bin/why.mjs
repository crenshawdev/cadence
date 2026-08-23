#!/usr/bin/env node
// @ts-check
// why.mjs - "why is this code like this", answered from the record already on
// disk (WHY-01, CONTEXT phase 1 plan 1 D-01). A new top-level script rather
// than a `planning.mjs` subcommand: its primary argument is a REPOSITORY
// PATH, where every one of `planning.mjs`'s 16 git calls is `-C <root>`
// against `.planning` itself.
//
// Usage: why.mjs <path>[:<line>] [--dir <repo>] [--top <n>]
//   <path>[:<line>]  a repository-relative path, or that path with a 1-based
//                     line appended after the LAST colon (lib/why-query.mjs's
//                     `parseQuery` states the grammar and its five refusals).
//   --dir             the repository the query runs against. ABSENT means
//                      `process.cwd()`; empty, valueless or flag-shaped
//                      REFUSES (issue-check.mjs's disposition).
//   --top              task 2's entry cap, default 10 (lib/why-render.mjs).
//
// THE FLAG DOOR RUNS BEFORE THE POSITIONAL REFUSAL, deliberately, and this is
// the first bin in this tree that needs the ordering stated (D-01 continued).
// `arg-contract-adoption.test.mjs` spawns this script with a refusing flag
// LAST and NO positional argument at all, to prove the declared refusal fires
// - so a dispatch that checked the missing query first would answer every one
// of those probes with "missing-query" and never name the flag the census is
// actually testing. Reading `--dir` and `--top` FIRST, through the declared
// row, is what keeps that provable.
//
// ONE JSON OBJECT ON STDOUT (lib/seam-io.mjs), never a subagent: `git` is the
// only child process this script spawns, structurally asserted by
// why.test.mjs reading its own source.
//
// ONE INDEX BUILD PER INVOCATION (plan 2). `lib/why-corpus.mjs` walks the live
// and archived phase directories ONCE and every entry in the chain resolves
// against that one index - never a per-entry walk, which on a 144-commit chain
// would re-read 28 summaries 144 times. The join hangs off the entry as a
// single `join` object, which is the ONE attach point `lib/why-render.mjs`
// reads and every later edge extends.
//
// AN UNREADABLE PLANNING ARTIFACT NEVER FAILS THE QUERY. The index fails open
// with `warnings[]`, and those warnings ride the envelope beside the answer:
// `git log` already told this seam what the commits are, and a summary nobody
// can read makes the join thinner, not the chain wrong.
'use strict';

import { join as joinPath } from 'node:path';
import { execFileSync } from 'node:child_process';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { parseQuery, probeArgv, bareArgv, lineArgv, classifyResult } from './lib/why-query.mjs';
import { renderChain } from './lib/why-render.mjs';
import { buildCommitIndex, resolveCommit } from './lib/why-corpus.mjs';

/**
 * Run `git <args>` in `dir`, never throwing: a non-zero exit or a spawn
 * failure comes back as a classifiable result instead of an uncaught error,
 * because `classifyResult` (lib/why-query.mjs) is what turns that into a
 * stated outcome without a raw `fatal:` reaching this seam's stdout.
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
 * Split raw `git log --format=<LOG_FORMAT>` stdout into chain entries. One
 * record per line, `\x1f`-joined (lib/why-query.mjs's `LOG_FORMAT`).
 * @param {string} stdout @returns {{sha: string, date: string, subject: string}[]}
 */
function parseEntries(stdout) {
  return stdout.split('\n').filter((l) => l.trim() !== '').map((line) => {
    const [sha, date, ...rest] = line.split('\x1f');
    return { sha, date, subject: rest.join('\x1f') };
  });
}

/**
 * One index row as the entry carries it: the directory's OWN label, milestone
 * and phase number, plus the commits table's plan, task and description cells
 * verbatim. Flat and serializable, because it rides the JSON envelope beside
 * the rendered text.
 * @param {any} m @returns {any}
 */
function brief(m) {
  return {
    label: m.dir.label,
    milestone: m.dir.milestone,
    phase: m.dir.phase,
    plan: m.plan,
    task: m.task,
    description: m.description,
  };
}

/**
 * The ONE attach point (see the header). Every later edge adds a key to the
 * object this returns.
 * @param {any} index @param {string} sha @returns {any}
 */
function joinFor(index, sha) {
  const { state, row, matches } = resolveCommit(index, sha);
  if (state === 'resolved') return { state, ...brief(row) };
  if (state === 'ambiguous') return { state, matches: matches.map(brief) };
  return { state: 'unresolved' };
}

/**
 * The one non-flag token, skipping any value that immediately follows `--dir`
 * or `--top` so a flag's OWN value can never be misread as the query - the
 * hazard skim.mjs's simpler `.find(a => !a.startsWith('--'))` does not carry
 * because none of its flags take a value.
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

const argv = process.argv.slice(2);
const ROWS = CONTRACTS['why.mjs'];
/** One flag, read through its DECLARED row - the `''` row wins when it
 * declares the flag, else the script-global `'*'` row. */
const arg = (name) => requireFlag(argv, name, ROWS[''][name] || ROWS['*'][name]);

try {
  const dir = arg('--dir') || process.cwd();
  const top = arg('--top');

  const query = positionalQuery(argv);
  // Cast rather than let `strict: false` fail to narrow this JSDoc union
  // (arg-contract.mjs's own header measures the same TS2339 on this pattern).
  const parsed = /** @type {any} */ (parseQuery(query));
  if (!parsed.ok) {
    emit({ ok: false, reason: 'bad-query', detail: parsed.reason });
  } else {
    const { path, line } = parsed;

    // The explicit not-in-history probe (D-16), run BEFORE either chain query
    // so a mistyped path is answered by the smallest invocation that can
    // answer it, and an empty chain is never silently reported as one.
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
      emit({ ok: false, reason: 'git-failed', detail: 'the not-in-history probe' });
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
        emit({ ok: false, reason: 'git-failed', detail: line === undefined ? 'the bare-path chain query' : 'the line-scoped chain query' });
      } else {
        const index = buildCommitIndex(joinPath(dir, '.planning'));
        const joined = parseEntries(chain.stdout)
          .map((e) => ({ ...e, join: joinFor(index, e.sha) }));
        const rendered = renderChain(joined, { top });
        emit({
          ok: true, path, line, result: 'chain',
          text: rendered.text, shown: rendered.shown, total: rendered.total, entries: rendered.entries,
          warnings: index.warnings,
        });
      }
    }
  }
} catch (e) {
  const err = /** @type {any} */ (e);
  if (err && err.seam) emit({ ok: false, reason: err.seam, detail: err.detail });
  else emit({ ok: false, reason: 'internal', detail: String(err && err.message ? err.message : err) });
}
