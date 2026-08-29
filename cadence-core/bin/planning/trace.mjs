// @ts-check
// planning/trace.mjs - the `trace` family: the joined run record
// (.planning/trace.jsonl), its six subcommands, and the .gitignore arm that
// keeps the record out of git.
//
// BOTH handlers live here rather than one file each, because `cmdTrace`'s
// `ignore` arm CALLS `cmdTraceIgnore` - one of only two handler-to-handler call
// edges the single-file layout had, and splitting them would turn an internal
// call into an import between two command modules (D-07).
//
// Everything else here is single-use for one of those two (D-05): the ignore
// line and its comment with the four .gitignore readers, the unset-layer
// fallback map and the two route-table ladders the `suggest` arm reports
// against, the checkpoint plan-task count, the resolver, the string-flag
// grammar, and the receipt recount `close` cross-checks a fire with.
//
// The two `mergeLayers(` callsites below both destructure `warnings` and carry
// it into their envelope, which is arm (a) of self-verify check 12 - no header
// marker, because nothing here drops a layer's warnings on the floor (D-11).
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import {
  ARGV, DISPATCH_WINDOW_DEFAULTS, RECORD_TOKEN, argRefusal, fail, listPlanFiles, ok,
  phaseSpellingCollision, read, readReadsRecords, routeLadder,
} from './core.mjs';
import { deriveCounts, recordName } from '../lib/adjudication-record.mjs';
import { CONTRACTS, evaluateFlag } from '../lib/arg-contract.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';
import { atomicWrite, planTaskTitles } from '../lib/planning-files.mjs';
import { inDispatchReads, joinReads } from '../lib/read-trace.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';
import { parseAdjudication, suggestFromRender } from '../lib/trace-suggest.mjs';
import { FAMILIES, ROTATED_TRACE_FILE, appendEvent, renderTrace } from '../lib/trace.mjs';
import { windowBudget } from '../lib/window-budget.mjs';

// ---------------------------------------------------------------------------
// trace - the joined run record (.planning/trace.jsonl). This subcommand family
// is how PROSE writes the lifecycle and outcome families: two of the four have
// no script of their own to hang a direct write on (lifecycle lives in
// workflows/execute.md, outcomes in references/review-triggers.md and
// workflows/verify.md), so the seam is the writer everything shares. The seam
// scripts that DO have code (route.mjs, review-provider.mjs) call lib/trace.mjs
// directly rather than shelling out to this.
//
// `append` is BEST EFFORT and says so in its envelope: a write that did not
// happen - the file is at its size cap, the planning root is unwritable -
// returns ok:true with `written:false` and the reason, the same
// successful-check-with-a-negative-answer shape plan-overlap uses. Only a
// malformed CALL is ok:false. The trace records what a run did; it may never be
// able to change what a run does.
// ---------------------------------------------------------------------------
// The ignore line a project needs so its run record stays out of git, and the
// comment written above it so the next reader knows what it is.
const TRACE_IGNORE_LINE = '.planning/trace.jsonl';
const TRACE_IGNORE_COMMENT = "# Cadence's joined run record - local diagnostics"
  + " only, one machine's routing/provider/worker events";

/**
 * The SECOND rule: the generation a rotation at the record's size bound leaves
 * behind. Without it the first rotation leaves a file of up to
 * `MAX_TRACE_BYTES` untracked for the next `git add .planning` to sweep into
 * the repository - the same failure the line above exists to prevent, one
 * filename over, and on a public repo it republishes exactly the local
 * diagnostics that line withholds.
 *
 * A SECOND LITERAL and not a glob on the first. `line` is what `/cad-health`
 * reports and what `traceTracked` passes to `ls-files --error-unmatch` as a
 * pathspec, and a glob would change the meaning of both. Its basename is
 * DERIVED from the spelling `lib/trace.mjs` exports, so the rule and the file
 * the writer actually creates cannot drift apart.
 */
const ROTATED_IGNORE_LINE = `.planning/${ROTATED_TRACE_FILE}`;
const ROTATED_IGNORE_COMMENT = "# ...and the generation Cadence's run record"
  + ' leaves behind when it rotates at its size bound';

/**
 * Does a `check-ignore -v` match source TRAVEL with the repository?
 *
 * This is why `-v` is used instead of `-q`. `check-ignore` also consults
 * `core.excludesFile` and `.git/info/exclude`, and NEITHER is cloned: a machine-
 * local exclusion would answer `ignored:true` and leave the project with no
 * ignore line of its own, so the collaborator who clones it commits the run
 * record on the next `git add .planning` - exactly the failure this subcommand
 * exists to close. Only a `.gitignore` file inside the root counts.
 * @param {string|null} source the first field of `check-ignore -v` output
 * @returns {boolean}
 */
function ignoreSourceTravels(source) {
  if (!source) return false;
  if (isAbsolute(source)) return false;            // core.excludesFile
  const parts = source.split(/[/\\]/);
  if (parts.includes('..') || parts.includes('.git')) return false; // outside, or info/exclude
  return parts[parts.length - 1] === '.gitignore';
}

/**
 * Git's own answer about the ignore line, with the matching SOURCE, or
 * `method: 'file'` when git cannot answer at all (not installed, or the root is
 * not a repository). Exit 1 from `check-ignore` is DATA - nothing matched - and
 * only a harder failure falls back.
 *
 * `--no-index` is load-bearing, not a tidy-up. Without it `check-ignore` reports
 * nothing for a path that is in the INDEX, because git's own contract is "would
 * this path be ignored if it were untracked" and a tracked path is already past
 * that question. The two states then become indistinguishable: a project whose
 * `.gitignore` carries the line AND has the record force-added answered
 * `ignored:false`, so `cmdTraceIgnore` appended the line again on every run and
 * `/cad-health` reported a missing rule that was right there. `--no-index` asks
 * the question this seam actually has - does a rule cover this path - and leaves
 * TRACKED to `traceTracked`, which is the separate fact and the one that needs
 * `git rm --cached`.
 * @param {string} root
 * @param {string} path the ignore rule to ask about, as a repo-relative path
 * @returns {{method: 'git'|'file', travels: boolean, source: string|null}}
 */
function gitIgnoreState(root, path) {
  const noGit = { method: /** @type {'file'} */ ('file'), travels: false, source: null };
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--git-dir'], { stdio: 'pipe' });
  } catch { return noGit; }
  let out = '';
  try {
    out = execFileSync('git',
      ['-C', root, 'check-ignore', '--no-index', '-v', '--', path],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (e && e.status === 1) return { method: 'git', travels: false, source: null };
    return noGit;
  }
  // `<source>:<line>:<pattern>\t<pathname>`. The source is everything before
  // the LAST two colons of the left half, so a source path containing a colon
  // is not silently truncated into a different file name.
  const left = out.split('\n')[0].split('\t')[0];
  const last = left.lastIndexOf(':');
  const prev = last > 0 ? left.lastIndexOf(':', last - 1) : -1;
  const source = prev >= 0 ? left.slice(0, prev) : null;
  return { method: 'git', travels: ignoreSourceTravels(source), source };
}

/** Is the run record TRACKED? A non-repo tracks nothing, so it is false there. */
function traceTracked(root) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', TRACE_IGNORE_LINE],
      { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

/**
 * The literal fallback: the line as a project would write it, in `<root>/.gitignore`.
 * Comments and blank lines are skipped. Used only when git could not answer -
 * it cannot see a `.planning/` wholesale ignore, which is why the git arm is
 * tried first and is not decoration.
 * @param {string} root
 * @param {string} path the ignore rule to look for, as a repo-relative path
 */
function gitignoreCarriesLine(root, path) {
  const text = read(join(root, '.gitignore'));
  if (text === null) return false;
  return text.split('\n').some((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return false;
    return line === path || line === `/${path}`;
  });
}

/**
 * `trace ignore` - the scaffold-time writer of the ignore line, and the
 * read-only reporter `/cad-health` runs (D-03).
 *
 * `ignored` and `tracked` are the state AS FOUND, before any write; `written`
 * says what this call changed. `--check` writes nothing at all: /cad-health
 * reports on a project it did not create and may not edit its `.gitignore`.
 *
 * WHO calls which arm, and what the ignore buys (moved out of
 * `workflows/execute.md`, v2.6.2): `/cad-new-project` writes the line through
 * `trace ignore` at scaffold time, and `/cad-health` runs the `--check` arm, so
 * a project scaffolded before this seam existed is REPORTED rather than having
 * its `.gitignore` edited underneath it. Because `.planning/trace.jsonl` is
 * ignored, nothing a parallel worktree wrote to the run record could ride the
 * merge back into phase history - which is half of why a worktree executor
 * emits no trace events of its own; the other half is that its return is a
 * frozen five-field digest with no room for one.
 * @param {string} root @param {any} opts
 */
function cmdTraceIgnore(root, opts) {
  if (!existsSync(root)) {
    return fail('no-root', `${root} not found`,
      'point --root at the PROJECT root, the directory holding .gitignore - it is deliberately not'
      + ' --dir, which names .planning/');
  }
  const file = join(root, '.gitignore');
  const git = gitIgnoreState(root, TRACE_IGNORE_LINE);
  const live = git.method === 'git' ? git.travels : gitignoreCarriesLine(root, TRACE_IGNORE_LINE);
  // The SIBLING is asked about separately and by the same two readers: a
  // `.planning/` wholesale rule covers both, a line-per-file `.gitignore`
  // covers whichever lines it carries, and a project covered for the record and
  // not for its rotated generation is exactly the half-covered state
  // /cad-health has to report rather than pass over.
  const rotatedGit = gitIgnoreState(root, ROTATED_IGNORE_LINE);
  const rotated = rotatedGit.method === 'git'
    ? rotatedGit.travels
    : gitignoreCarriesLine(root, ROTATED_IGNORE_LINE);
  const common = {
    root,
    file,
    // `line` stays the LIVE record's literal, so /cad-health's `ignored` and
    // `tracked` reading is unchanged and that surface needs no edit; the
    // sibling's rule is a field of its own beside it.
    line: TRACE_IGNORE_LINE,
    rotated_line: ROTATED_IGNORE_LINE,
    ignored: live && rotated,
    tracked: traceTracked(root),
    method: git.method,
    ...(git.source ? { source: git.source } : {}),
  };
  if ('check' in opts) return ok({ ...common, written: false });
  // Already covered by lines that travel: the no-op that makes a re-run safe.
  if (live && rotated) return ok({ ...common, written: false, reason: 'already-ignored' });

  // Only what is MISSING is added, so a project scaffolded before the rotated
  // generation existed is upgraded on its next non-`--check` run without its
  // existing rule being written a second time. The comment above the block
  // names whichever half is being added.
  const missing = [
    ...(live ? [] : [TRACE_IGNORE_LINE]),
    ...(rotated ? [] : [ROTATED_IGNORE_LINE]),
  ];
  const block = `${live ? ROTATED_IGNORE_COMMENT : TRACE_IGNORE_COMMENT}\n${missing.join('\n')}\n`;
  // Every existing byte survives. The newline is added only when the current
  // contents lack a trailing one, so a brownfield `.gitignore` keeps every line
  // it had and the new lines still land on lines of their own.
  const existing = read(file);
  const next = existing === null || existing === ''
    ? block
    : `${existing}${existing.endsWith('\n') ? '' : '\n'}\n${block}`;
  atomicWrite(file, next);
  return ok({ ...common, written: true });
}

/**
 * The values the `suggest` arm falls back to for the keys its rules NAME when
 * no config layer holds one - and only for the keys whose schema default is a
 * real value. A key defaulting to `null` is not in here on purpose: `null` is
 * the schema's sentinel for "no layer pins this, the stakes level decides it",
 * and the suggestion reports that state as unset rather than inventing the
 * value the level would fire (D-06).
 *
 * `cadence-core/config.schema.json` IS THE SOURCE OF TRUTH for these values -
 * its rows carry the defaults and the argument behind them. This map is the
 * unset-layer fallback and nothing else, the same duplication
 * `DISPATCH_WINDOW_DEFAULTS` above already accepts: this seam reads the merged
 * config, not the schema, so an unset key has to resolve to something here. The
 * schema is deliberately NOT parsed at runtime (D-15) - neither this file nor
 * `lib/trace-suggest.mjs` reads it today. A value changed in one place and not
 * the other makes `/cad-suggest` print a `current` that disagrees with the row
 * `/cad-config` shows, which `prose-agreement.test.mjs` fails on.
 */
const SUGGEST_KEY_DEFAULTS = Object.freeze({
  'workflow.max_plan_tasks': 8,
  'review.reviewers': ['claude-subagent'],
});

/**
 * The gate ladder `cadence-core/route-table.json` states, resolved against THIS
 * file's own directory the way `route.mjs` resolves the same file - and without
 * honouring `CADENCE_ROUTE_TABLE`: an env-supplied ladder is the ungated
 * override class EXP-01 closed, and this one decides what a suggestion tells a
 * user to set a review gate to.
 *
 * A table that cannot be read or parsed degrades to NO ladder, which makes the
 * gate arm omit `proposed`. That omission is the report; no ladder is
 * substituted from memory here.
 * @returns {string[]|undefined}
 */
function gateLadder() {
  return routeLadder('gates');
}

/**
 * The rung ladder `route-table.json` states, on the same terms as the gate one:
 * R3 compares its target against the rung a config layer set, and an absent
 * ladder omits the target rather than substituting an order from memory.
 * @returns {string[]|undefined}
 */
function rungLadder() {
  return routeLadder('rung_order');
}

/**
 * The task count of the plan a `cad-executor` checkpoint names, or `null` when
 * the checkpoint maps to no readable plan - UNKNOWN, never under-ceiling
 * (D-09). Unknown is the common case and stays so: a `plan` that is a WORKER
 * key rather than a plan number (`1-cut`, `1-fix`) names no file, an archived
 * cycle keeps its phase dirs under a different milestone dir and filename
 * shape, and a delete-mode close removes them outright.
 *
 * The `phase` is read through `requirePhaseArg`, which is the traversal guard
 * as much as the shape one: this value comes off a RECORD line rather than a
 * flag, and it is about to be a directory component. The `plan` needs no such
 * guard - it is only ever compared against `readdirSync` entries, so a `../`
 * in it matches nothing.
 * @param {string} dir the planning dir
 * @param {any} event a `lifecycle/checkpoint` event
 * @returns {number|null}
 */
function checkpointPlanTasks(dir, event) {
  const phase = requirePhaseArg(typeof event.phase === 'number' ? String(event.phase) : event.phase);
  if (!phase.ok) return null;
  const plan = typeof event.plan === 'string' || typeof event.plan === 'number'
    ? String(event.plan).trim()
    : '';
  if (!plan) return null;
  const pdir = join(dir, 'phases', phase.raw);
  const { plans } = listPlanFiles(pdir);
  // `PLAN.md` is plan 1 spelled bare - the same equivalence `listPlanFiles`'s
  // own conforming set carries.
  const file = plans.find((f) => f === `PLAN-${plan}.md`)
    || (plan === '1' ? plans.find((f) => f === 'PLAN.md') : undefined);
  if (!file) return null;
  const text = read(join(pdir, file));
  if (text === null) return null;
  return planTaskTitles(text).length;
}

/**
 * Everything the pure rules in `lib/trace-suggest.mjs` need to name a
 * direction, a current value and - where one can be READ - a target: the
 * resolved config value behind each key the record's own events reach, the gate
 * ladder, and the stakes level the record carries. Resolved HERE because that
 * file is pure and stays that way (D-05); it owns the rules, this owns the
 * reads.
 *
 * Keyed off the RECORD rather than the schema's key space: a trigger that never
 * fired and a role that never resolved are keys no rule can name, so resolving
 * them would read config nothing asked about.
 *
 * `checkpointTasks` is the FILE half of R4's binding check, here for the same
 * reason as everything else in this function: reading a plan file is I/O.
 * @param {string} dir the planning dir
 * @param {any} render
 * @param {any} config the merged config layers
 */
function suggestResolution(dir, render, config) {
  /** @type {Record<string, any>} */
  const values = {};
  // An absent or null value is NOT recorded: `lib/trace-suggest.mjs` reads a
  // missing key as unset, which is the state D-06 makes it print.
  const set = (key, value) => { if (value !== undefined && value !== null) values[key] = value; };
  const triggers = config?.review?.triggers || {};
  const effort = config?.model?.effort || {};
  const events = Array.isArray(render?.events) ? render.events : [];
  // The level the most recent `routing/resolve` event in scope carries, and
  // nothing when the scope holds none - never a level the record does not
  // carry.
  let stakes = null;
  // One entry per counted checkpoint, in record order, so the rule can tell
  // "every one of them was measured" from "some were".
  /** @type {(number|null)[]} */
  const checkpointTasks = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.family === 'outcome' && e.event === 'adjudication') {
      const parsed = parseAdjudication(e);
      if (parsed) set(`review.triggers.${parsed.trigger}.gate`, triggers?.[parsed.trigger]?.gate);
    } else if (e.family === 'routing' && e.event === 'resolve') {
      if (typeof e.role === 'string' && e.role) set(`model.effort.${e.role}`, effort?.[e.role]);
      if (typeof e.stakes === 'string' && e.stakes.trim()) stakes = e.stakes.trim();
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint' && e.role === 'cad-executor') {
      checkpointTasks.push(checkpointPlanTasks(dir, e));
    }
  }
  set('review.reviewers', config?.review?.reviewers ?? SUGGEST_KEY_DEFAULTS['review.reviewers']);
  set('workflow.max_plan_tasks',
    config?.workflow?.max_plan_tasks ?? SUGGEST_KEY_DEFAULTS['workflow.max_plan_tasks']);
  const gates = gateLadder();
  const rungs = rungLadder();
  return { values, ...(gates ? { gates } : {}), ...(rungs ? { rungs } : {}), stakes, checkpointTasks };
}

// The grammar the SHARED `trace append|close` body judges its string flags by,
// read off lib/arg-contract.mjs rather than restated as seven guards below.
//
// The two rows are UNIONED because ONE body validates both subcommands. A flag
// row is a prose allowlist that never widens what a subcommand accepts, so
// `trace close` declares no `--sha`, `--base`, `--step` or `--trigger` row even
// though this body reads them for it; every key both rows do declare, they
// declare identically, so the union states no grammar either row denies.
const TRACE_GRAMMAR = {
  ...CONTRACTS['planning.mjs']['trace append'],
  ...CONTRACTS['planning.mjs']['trace close'],
};

// The flags whose whole rule is the value grammar, in the order they are read.
// The first four declare `fallback` on both axes and the last four `refuse` -
// the two dispositions this one body has always run side by side (D-05), now
// stated once in the table instead of seven times here.
const TRACE_STRING_FLAGS = ['--plan', '--sha', '--base', '--role', '--step', '--reviewer', '--trigger', '--agent-id'];

// The `--duration-ms` grammar, CLOSED to digits and unit letters.
//
// Two accepted spellings and nothing else: a plain non-negative integer, which
// is a millisecond count, and the host's own formatted rendering - one or more
// number-plus-unit terms over hours, minutes, seconds and milliseconds,
// optionally space-separated (`1m 23s`, `1h2m3s`, `450ms`). `ms` is first in
// the alternation because `m` would otherwise swallow the `m` of `450ms` and
// read it as 450 minutes plus a stray `s`.
//
// CLOSED rather than free text on purpose: this flag carries a caller-derived
// FIGURE, not caller-derived prose, so it stays out of
// lib/text-transport.mjs's `TEXT_FLAGS` - whose header excludes `--tokens` on
// exactly this ground - and needs no `-file` transport to be safe.
//
// `null` means malformed, which the caller turns into a refusal with NOTHING
// appended. The safe-integer test is part of the grammar and not a paranoia
// arm: `9999999999999999999h` parses term by term and would otherwise write a
// float into a field a reader sums as an integer.
const DURATION_UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000 };
const DURATION_TERMS = /^\d+(?:ms|h|m|s)(?:\s*\d+(?:ms|h|m|s))*$/;

/** @param {any} raw @returns {number|null} milliseconds, or null when malformed */
function parseDurationMs(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  if (!DURATION_TERMS.test(v)) return null;
  let total = 0;
  for (const [, n, unit] of v.matchAll(/(\d+)(ms|h|m|s)/g)) {
    total += Number(n) * DURATION_UNITS[unit];
  }
  return Number.isSafeInteger(total) ? total : null;
}

function cmdTrace(dir, sub, opts) {
  if (sub === 'ignore') {
    // `--root` is the PROJECT root, deliberately not `--dir`: `.gitignore` lives
    // there while the line it carries is `.planning/trace.jsonl`. A `--root`
    // present with nothing usable after it is REFUSED by its declared row at
    // the dispatch door rather than falling through to the cwd, which would
    // edit a different tree than the caller named (the `#42/#45` rail).
    return cmdTraceIgnore(typeof opts.root === 'string' ? opts.root : process.cwd(), opts);
  }
  // `close` is `append` with the two fields a dispatch site used to restate
  // taken off its hands, so every flag below is validated by ONE body: a second
  // copy of the `--tokens` grammar is a second place for it to drift, and the
  // close half is exactly where the token figure lands.
  if (sub === 'append' || sub === 'close') {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) {
      return fail('bad-args', `trace ${sub} needs --phase <N>`,
        `pass --phase <N> for the phase this event belongs to, then re-run the ${sub} - nothing was`
        + ' appended, so exactly one event lands');
    }
    // The tree-aware collision check, right after the parse and ahead of every
    // other flag rail below. `append` and `close` are the two arms whose
    // `parsedPhase.raw` leaves this file: it reaches `recountReceipt` and then
    // `recordForFire`'s `join(dir, 'phases', ...)`, so a colliding spelling
    // would recount one phase's fires under another phase's name. The
    // `suggest`, `render` and `window` arms take no wire - their raw spelling
    // scopes a `.planning/trace.jsonl` filter and resolves no directory.
    const collision = phaseSpellingCollision(dir, parsedPhase);
    if (collision) {
      return fail('bad-args', `trace ${sub} ${collision}`,
        `re-run the ${sub} with one of the two spellings the detail names - nothing was appended`);
    }
    // `--detail-file` is the SAFE transport for a detail the CALLER derived -
    // a reviewer's verdict, a checkpoint's reason - and the reasoning lives in
    // lib/text-flag-file.mjs and references/conventions.md, not restated here.
    // Resolved BEFORE the close arm's inference below, which reads the detail:
    // left on `opts.detail` alone, every converted checkpoint site would bill
    // as a clean `return`, the one arm the record exists to keep separate.
    const resolvedDetail = resolveTextFlag(opts, 'detail', `trace ${sub}`);
    if (!resolvedDetail.ok) {
      return fail('bad-args', resolvedDetail.detail,
        'pass --detail or --detail-file, never both, and point --detail-file at a readable,'
        + ' non-empty file - nothing was appended');
    }
    const detail = resolvedDetail.value !== undefined ? resolvedDetail.value : opts.detail;
    let family;
    let event;
    if (sub === 'close') {
      // Fixed, never read off the caller: the whole point of the subcommand is
      // that a close site states WHAT it is closing and nothing about how the
      // record spells it.
      family = 'lifecycle';
      // The arm is inferred from `--detail` and NEVER from `--tokens` (D-06).
      // Measured across all twenty shipped close lines: 6 of the 10 checkpoint
      // sites carry `--tokens` and 4 do not, while every checkpoint carries
      // `--detail` and no return does. A token-presence classifier would
      // therefore write `return` for four shipped checkpoint sites - billing a
      // worker that came back unusable as a clean close, which is the one arm
      // the record exists to keep separate.
      //
      // `escalation` stays OUTSIDE this inference (D-13): it is a TERMINAL
      // member with zero prose producers, so a three-way inference would be
      // flexibility nothing exercises. It stays reachable through
      // `trace append --event escalation`.
      event = typeof detail === 'string' && detail.trim() ? 'checkpoint' : 'return';
    } else {
      family = typeof opts.family === 'string' ? opts.family : '';
      if (!FAMILIES.includes(family)) {
        return fail('bad-args', `trace append --family must be one of ${FAMILIES.join(' | ')}`,
          'send one of the families the detail lists; a coordinator closing a bracket calls `trace'
          + ' close` instead, which picks the family itself - nothing was appended');
      }
      event = typeof opts.event === 'string' && opts.event ? opts.event : '';
      if (!event) {
        return fail('bad-args', 'trace append needs --event <name>',
          'add --event <name> for what happened - dispatch, outcome, adjudication - or call `trace'
          + ' close`, which names the event itself; nothing was appended');
      }
    }

    // --tokens: what the dispatch COST, read by the orchestrator off the
    // worker's return metadata. A malformed value is a malformed CALL, not a
    // best-effort append with the field dropped: a dropped field renders the
    // role `unrecorded` while the caller believes a figure was recorded, which
    // is exactly the zero/unrecorded/recorded conflation the per-role block
    // exists to prevent. So nothing at all is appended here.
    // One exception to "malformed value, nothing appended": a COMMA-GROUPED
    // integer. This plugin prints token figures grouped (context.md's measured
    // block reads `cad-planner 146,405`) three lines from the `--tokens` order
    // that copies them, so `--tokens 146,405` is the transcription the prose
    // itself models. Refusing it drops the append, and the `dispatch` half is
    // already written, so the worker is stranded in renderTrace's unpaired[]
    // forever - escalating a recording error into loss of the bracket it was
    // recording. Grouping is stripped only in the strict 3-digit shape, so
    // `1,2,3` and `146,40` are still malformed CALLS and still refused.
    let tokens;
    if ('tokens' in opts) {
      const raw = typeof opts.tokens === 'string' && /^\d{1,3}(?:,\d{3})+$/.test(opts.tokens.trim())
        ? opts.tokens.trim().replace(/,/g, '')
        : opts.tokens;
      const parsed = requireInt(raw);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --tokens needs a non-negative integer`,
          "copy the token figure off the worker's return as a whole number - grouped as this plugin"
          + ' prints it (146,405) or plain; nothing was appended, so a corrected re-run writes'
          + ' exactly one event');
      }
      tokens = parsed.value;
    }

    // --turns: how many TOOL CALLS the dispatch made, read off the same subagent
    // return metadata `--tokens` is (lib/trace.mjs's TOKEN PROVENANCE header
    // states that provenance once, for both). Tokens alone cannot price a run -
    // the bill is turns times window - so a record carrying only the token half
    // can describe what a worker returned and never what it cost to get there.
    // Structured, and never parsed back out of `--detail`: that slot is not a
    // machine-join surface (one trigger was spelled four different ways across
    // 35 shipped `outcome/adjudication` events), so a figure recovered from it
    // is exactly as trustworthy as the substitution that condemned it.
    // Validated the way `--raised` is, and for the same reason: a malformed
    // value is a malformed CALL and NOTHING is appended, never a best-effort
    // append with the field dropped - a dropped count renders the role
    // turn-unrecorded while the caller believes a figure landed, which is the
    // zero/unrecorded/recorded conflation the per-role block exists to prevent.
    // No comma-grouping exception: that one exists because this plugin PRINTS
    // token figures grouped, and a tool-call count never is, so accepting
    // `1,234` would only widen what can be mistyped.
    let turns;
    if ('turns' in opts) {
      const parsed = requireInt(opts.turns);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --turns needs a non-negative integer`,
          "copy the tool-call count off the worker's return as a plain whole number, ungrouped;"
          + ' nothing was appended, so a corrected re-run writes exactly one event');
      }
      turns = parsed.value;
    }

    // --duration-ms: how long the dispatch itself TOOK, the third figure on the
    // same subagent return `--tokens` and `--turns` are read off. Distinct from
    // the dispatch-to-close span `renderTrace` already derives off the two
    // timestamps: that one includes the orchestrator's own time between the two
    // writes, so a bracket carrying only it can say how long the STEP took and
    // never how long the WORKER did.
    // The value grammar is the one `parseDurationMs` above states, and it
    // accepts the host's formatted spelling because that is the only one an
    // orchestrator can copy: refusing `1m 23s` would drop the append with the
    // `dispatch` half already written, stranding the worker in renderTrace's
    // unpaired[] forever - the same escalation the `--tokens` comma-grouping
    // exception exists to prevent.
    // Outside that grammar it is a malformed CALL and NOTHING is appended, the
    // posture `--tokens` and `--turns` both take: a dropped field renders the
    // bracket duration-less while the caller believes a figure landed.
    let durationMs;
    if ('duration-ms' in opts) {
      const parsed = parseDurationMs(opts['duration-ms']);
      if (parsed === null) {
        return fail('bad-args', `trace ${sub} --duration-ms needs a duration`,
          "copy the wall clock off the worker's return as the host prints it (1m 23s, 450ms) or as"
          + ' a plain whole number of milliseconds; nothing was appended, so a corrected re-run'
          + ' writes exactly one event');
      }
      durationMs = parsed;
    }

    // --raised: how many findings the reviewers RAISED before adjudication, so
    // the record can tell a gate that found nothing (0 of 0) from a reviewer
    // whose every finding was refuted (0 of 9). Structured, because the
    // free-text `--detail` slot is the one already condemned for carrying the
    // voice list - a figure parsed back out of prose is exactly as trustworthy
    // as the substitution that condemned it (D-01).
    // Validated the way `--tokens` is, and for the same reason: a malformed
    // value is a malformed CALL and NOTHING is appended, never a best-effort
    // append with the field dropped, because a dropped figure reads downstream
    // as UNKNOWN while the caller believes a count was recorded.
    // No comma-grouping exception here: that one exists because this plugin
    // PRINTS token figures grouped, and a finding count never is, so accepting
    // `1,234` would only widen what can be mistyped.
    let raised;
    if ('raised' in opts) {
      const parsed = requireInt(opts.raised);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --raised needs a non-negative integer`,
          'send the number of findings the reviewers raised before adjudication as a plain whole'
          + ' number, ungrouped; nothing was appended');
      }
      raised = parsed.value;
    }

    // --survivors / --downgraded / --refuted: the SETTLED figures of a fire,
    // the other side of the `--raised` count above. `9 raised` says what the
    // reviewers found; these three say what survived being argued with, which
    // is the whole of what an adjudication decided.
    // Structured for the reason `--raised` is, and validated the same way: a
    // malformed value is a malformed CALL and NOTHING is appended, never a
    // best-effort append with the field dropped, because a dropped figure reads
    // downstream as UNKNOWN while the caller believes a count landed. No
    // comma-grouping exception, for the reason `--raised` and `--turns` both
    // give - a finding count is never PRINTED grouped, so accepting `1,234`
    // would only widen what can be mistyped.
    // Each key is OMITTED when its flag was absent and a real `--survivors 0`
    // still records a 0: a fire nobody counted and a fire that counted zero are
    // different fires, and the key is what separates them.
    const settled = {};
    for (const flag of ['survivors', 'downgraded', 'refuted']) {
      if (!(flag in opts)) continue;
      const parsed = requireInt(opts[flag]);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --${flag} needs a non-negative integer`,
          `send --${flag} as a plain whole number, ungrouped - the settled figures come off the`
          + " adjudication seam's own return rather than being typed; nothing was appended");
      }
      settled[flag] = parsed.value;
    }

    // --round: WHICH round of a capped re-arm this event belongs to. Not
    // decoration - the record a receipt settles is written at
    // `...-<discriminator>-r<round>.json` above round 1, so a settle that names
    // no round resolves ROUND ONE's filename and would check round two's
    // figures against round one's stale rulings, passing whenever the two
    // happen to coincide. Absent means round 1 on both sides, so the write side
    // and the receipt side resolve one filename by one rule.
    let round = 1;
    if ('round' in opts) {
      const parsed = requireInt(opts.round);
      if (!parsed.ok || parsed.value < 1) {
        return fail('bad-args',
          `trace ${sub} --round needs the re-arm round after it, a whole number of at least 1`,
          'send --round as the re-arm round this event belongs to - 2 for the first re-arm - or'
          + ' leave it off for an ordinary round-1 fire; nothing was appended');
      }
      round = parsed.value;
    }

    // --read: the read-set the SITE caused the worker to read, as ONE
    // comma-separated value split the way `phase-done --reqs` splits its ids.
    // A repeated flag is impossible by construction rather than by choice -
    // `parseArgs` does `opts[a.slice(2)] = next`, so `--read a --read b` would
    // keep only `b` and the record would drop most of its rows while looking
    // complete. Do not "improve" this into a repeatable flag.
    //
    // GRAMMAR: an element is any VERBATIM string naming something the site
    // caused the worker to read - a path, a glob, or a non-path reference (a
    // `<base>..<head>` ref range) the worker resolves for itself. Stored with
    // no existence check, no normalization and no byte measurement, so a reader
    // converting the set to bytes must resolve each element BY KIND rather than
    // assume a plain path.
    //
    // `--read-file` is the same value through the path transport, for a site
    // whose read-set is composed from what the worker was handed rather than
    // typed by a human. It is split by the SAME grammar and refused by the SAME
    // all-blank test - one list-builder below, so the two transports cannot
    // disagree about what an element is.
    let read;
    const resolvedRead = resolveTextFlag(opts, 'read', `trace ${sub}`);
    if (!resolvedRead.ok) {
      return fail('bad-args', resolvedRead.detail,
        'pass --read or --read-file, never both, and point --read-file at a readable, non-empty'
        + ' file - nothing was appended');
    }
    if ('read' in opts || 'read-file' in opts) {
      const raw = resolvedRead.value !== undefined ? resolvedRead.value : opts.read;
      const list = typeof raw === 'string'
        ? raw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      // A bare `--read`, an empty string, or an all-blank value is almost
      // always an unset `"$PATHS"`, and a complete-looking dispatch with no
      // read-set is the failure this refusal exists against. The file form
      // reaches this same test with a file holding only separators - a
      // whitespace-only file is already refused by the reader as empty.
      if (!list.length) {
        return fail('bad-args',
          `trace ${sub} --read${'read-file' in opts ? '-file' : ''} needs a comma-separated path list`,
          'list what this site caused the worker to read as one comma-separated value - paths,'
          + ' globs, or a <base>..<head> range - or leave the flag off; a bare one is almost always'
          + ' an unset "$PATHS", and nothing was appended');
      }
      read = list;
    }

    // The seven string flags, each read through its DECLARED row. One loop
    // where seven hand-written guards used to state the same two rules, and
    // the ONE place this body's two bare-flag dispositions are decided (D-05):
    // `--plan`, `--sha` and `--base` declare `fallback` and read as absent, so
    // every shipped `trace close` written without them keeps answering ok:true,
    // while `--role`, `--step`, `--reviewer` and `--trigger` REFUSE.
    //
    // `--role` MOVED to refuse, and that is the behaviour change. Measured
    // 2026-08-19, `trace append --phase 1 --family lifecycle --event dispatch
    // --role --tokens 5` returned `{"ok":true,"written":true}`, wrote a line
    // carrying no `role` key, and `trace render` then aggregated it under the
    // EMPTY STRING key - `"roles":{"":{"dispatches":2,...}}`, a
    // complete-looking dispatch whose attribution is gone. `--role ''` was
    // identical. The other direction - extending the drop arm to the three
    // refusals beside it - was the alternative, and those three are written
    // against exactly this shape.
    //
    // What each of the four refusing flags IS:
    //   --step      the workflow step a COORDINATOR marker names. A marker
    //               naming no step defeats the per-step attribution it exists
    //               for.
    //   --reviewer  WHICH reviewer actually ran this fire, so a cross-model
    //               review and a subagent review of one trigger stop being one
    //               shape in the record (RVW-02). It names the reviewer that
    //               RAN, never the one the trigger asked for - nothing refuses
    //               a dispatch to a reviewer outside the resolved set (D-07),
    //               so this mark is the whole enforcement.
    //   --trigger   WHICH review trigger this event belongs to, so an `outcome`
    //               event JOINS to the fire that produced it without reading
    //               prose; `risk-check status` demands one for a matched range
    //               (D-12). Measured across this repository's 35
    //               `outcome/adjudication` events the trigger is spelled four
    //               different ways inside the free-text `--detail`, and
    //               lib/trace-suggest.mjs discards that text entirely, so
    //               parsing it back out is the substitution this flag exists to
    //               avoid.
    //   --role      the role the per-role token block aggregates under.
    // A bare one of them parses as boolean `true` in `parseArgs`, which is why
    // the read is against ARGV: the refusal has to see the spelling.
    const flags = {};
    for (const flag of TRACE_STRING_FLAGS) {
      const parsedFlag = evaluateFlag(ARGV, flag, TRACE_GRAMMAR[flag]);
      // The wording comes from the ONE flag->sentence map the dispatch door
      // composes from, so `trace append --role` (bare) answers with the same
      // sentence whichever of the two refuses it first - the door for the flags
      // the resolved row declares, this loop for the ones only the UNION does.
      if (!parsedFlag.ok) {
        return fail('bad-args', argRefusal(`trace ${sub}`, flag),
          'give the flag the detail names a value, or leave it off entirely - nothing was appended,'
          + ' so a corrected re-run writes exactly one event');
      }
      flags[flag] = parsedFlag.value;
    }
    // Trimmed for the four that refuse, because a stored name is a JOIN KEY and
    // ` cad-executor ` must not read as a second role. The `fallback` three are
    // stored VERBATIM, exactly as they always were.
    const trimmed = (flag) => (flags[flag] === undefined ? undefined : String(flags[flag]).trim());
    const step = trimmed('--step');
    const reviewer = trimmed('--reviewer');
    const trigger = trimmed('--trigger');
    const agentId = trimmed('--agent-id');

    // THE CROSS-ARTIFACT CHECK (AC4). The three settled figures are DERIVED by
    // the `adjudication` seam from the record's own rulings and copied onto
    // this line by hand, so this is where a mistyped one is still cheap: the
    // record for this fire is recounted and a figure that disagrees is a
    // malformed CALL, refused with NOTHING appended. Left to a later test, the
    // wrong count has already shipped on the fire's own receipt.
    //
    // ABSENT RECORD OMITS THE CHECK and stores the flags as given - a fire
    // predating the format, or an advisory arm that wrote none. This is a
    // cross-check between two artifacts, never a requirement that one exist:
    // making a receipt depend on a record would make an unrecordable fire
    // unrecordable in the trace as well.
    const recount = recountReceipt(dir, parsedPhase.raw, {
      trigger, plan: flags['--plan'], sha: flags['--sha'], round, settled,
    });
    if (!recount.ok) return fail(recount.reason, recount.detail, recount.hint);

    // No flag below is coupled to an event NAME: the seam stays event-agnostic
    // exactly as it is today, which is what makes `return`, `checkpoint` and
    // `escalation` store tokens identically. `--step` does not change that: the
    // rule that a coordinator marker carries no `--role` and no `--tokens` is
    // held by the prose that writes it and by the census assertion in
    // trace.test.mjs, never by a runtime refusal keyed to an event name.
    const res = appendEvent(dir, {
      // The caller's SPELLING, which is what separates `1.10` from `1.1`:
      // normalized, both phases shared one trace key and one correlation id, so
      // the record joined two phases into one story. `lib/trace.mjs`'s `key()`
      // stringifies both sides of every comparison, so the derived id, the
      // render filter and the dispatch/terminal pairing all keep working
      // against traces written before this change and lib/trace.mjs needs no
      // edit.
      phase: parsedPhase.raw,
      family,
      event,
      // The four below carry no guard of their own any more: the loop above
      // already applied each flag's declared disposition, so an absent flag and
      // a `fallback` one both arrive here as `undefined` and omit their key.
      ...(flags['--plan'] === undefined ? {} : { plan: flags['--plan'] }),
      ...(flags['--sha'] === undefined ? {} : { sha: flags['--sha'] }),
      // `--base` beside `--sha`: a fire RECEIPT names both ends of the range it
      // settled, because two ranges can share a head and differ at the base and
      // are then different diffs over different surfaces.
      ...(flags['--base'] === undefined ? {} : { base: flags['--base'] }),
      ...(typeof detail === 'string' && detail ? { detail } : {}),
      ...(trimmed('--role') === undefined ? {} : { role: trimmed('--role') }),
      ...(tokens === undefined ? {} : { tokens }),
      // OMITTED when the return carried no count, never sent as `0`: a zero
      // claims a dispatch that used no tools, while an absent key is readable
      // as "this host reported none". A real `--turns 0` still records a 0,
      // exactly as `--tokens 0` already does.
      ...(turns === undefined ? {} : { turns }),
      // OMITTED for the reason `--turns` is, and spelled `duration_ms` because
      // the 232 `provider` events already on the record spell it that way - one
      // reader parses one field name.
      ...(durationMs === undefined ? {} : { duration_ms: durationMs }),
      ...(raised === undefined ? {} : { raised }),
      // The settled figures, each key present only when its flag was: a fire
      // nobody counted stays distinguishable from one that counted zero.
      ...settled,
      // The round, only when the caller named one: an ordinary fire is round 1
      // by omission on both sides, and writing a `round: 1` onto every event
      // would put a re-arm field on the thousands that never re-armed.
      ...('round' in opts ? { round } : {}),
      ...(read === undefined ? {} : { read }),
      ...(step === undefined ? {} : { step }),
      ...(reviewer === undefined ? {} : { reviewer }),
      ...(trigger === undefined ? {} : { trigger }),
      // The worker's host id, carried so the `SubagentStop` hook can tell a
      // worker that has ALREADY been closed from one still running. It is the
      // only identity the hook and the orchestrator both hold: the `dispatch`
      // half cannot carry it (that event is written before the subagent
      // exists), and the orchestrator learns it the moment the host returns.
      ...(agentId === undefined ? {} : { agent_id: agentId }),
    });
    return ok({
      written: res.written,
      ...(res.corr ? { corr: res.corr } : {}),
      ...(res.reason ? { reason: res.reason } : {}),
    });
  }
  if (sub === 'suggest') {
    // Evidence-backed config suggestions off the record - the pure rules live
    // in lib/trace-suggest.mjs, this arm owns only scope and envelope. No
    // `--phase` means the WHOLE record on purpose: the caller is the milestone
    // close, and a milestone's evidence spans every phase it shipped.
    let phase;
    if (opts.phase !== undefined) {
      const parsedPhase = requirePhaseArg(opts.phase);
      if (!parsedPhase.ok) {
        return fail('bad-args', 'trace suggest --phase must be a phase number',
          "send a plain phase number, or drop --phase to read the whole record - a milestone's"
          + ' evidence spans every phase it shipped');
      }
      phase = parsedPhase.raw;
    }
    const r = renderTrace(dir, phase);
    // warnings[] BOUND and ridden on the envelope when non-empty, the rule
    // lib/merge-warnings.mjs holds every mergeLayers callsite to (D-13): a torn
    // layer reads every key as unset, so every suggestion would report an unset
    // `current` and a project that deliberately pinned one would be told to
    // move a value the read never saw.
    const { config: suggestConfig, warnings } = mergeLayers(join(dir, 'config.json'));
    // The SECOND record this arm opens (RDX-01): `.planning/reads.jsonl`, folded
    // to the per-role in-dispatch figures R7 reads. The brackets are the render
    // ALREADY computed above - a second `renderTrace` call would re-read the
    // trace for nothing - so a `--phase N` run scopes itself without a new flag:
    // only reads landing inside that phase's dispatches join at all.
    //
    // An ABSENT file yields no rows and therefore no entry, never an error and
    // never a zero, which is the posture `cmdReads`'s own ENOENT arm already
    // states for a project that has not run since the hook was installed. An
    // UNREADABLE one yields no entry AND names the file in `warnings[]`, the
    // channel this envelope already carries for exactly this class of partial
    // read (D-13).
    const readRecord = readReadsRecords(dir);
    const inDispatch = readRecord.status === 'ok'
      ? inDispatchReads(joinReads(readRecord.records, r.brackets).rows)
      : undefined;
    const suggestWarnings = readRecord.status === 'unreadable'
      ? [...warnings, `cannot read ${readRecord.file}; in-dispatch re-reading was not measured`]
      : warnings;
    const suggestions = suggestFromRender(r, suggestResolution(dir, r, suggestConfig), inDispatch);
    return ok({
      // The record these suggestions were argued off, which this arm did not
      // name at all until TRC-08: a retune argued off a record the reader
      // cannot name is a number. It rides the SAME `renderTrace` result the
      // suggestions do, so the two can never name different files.
      file: r.file,
      scope: phase === undefined ? 'all' : String(phase),
      events_read: r.events.length,
      ...(r.capped ? { capped: true } : {}),
      // The rotation, on the same footing it rides `trace render`: a reader
      // seeing fewer events than it expected can tell a cut from a quiet run
      // without inferring it from what is missing. NOT folded into `capped` -
      // that one still means this READ was truncated at the ceiling, and a
      // rotated record is not capped.
      ...(r.rotated ? { rotated: r.rotated } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      // The SECOND record this arm read, named and - where it was cut - dated,
      // on the SAME nested key `reads` returns so a reader has one shape to
      // learn (D-04). Sourced from the `readReadsRecords` result this arm
      // already holds, so the name here and the figures below can never come
      // off different files. NOT the top-level `rotated` above: that one means
      // the TRACE was cut, `workflows/suggest.md:29-30` ties it to that record
      // specifically, and one key meaning two records is the thing this nesting
      // exists to prevent.
      reads: {
        file: readRecord.file,
        ...(readRecord.rotated ? { rotated: readRecord.rotated } : {}),
      },
      suggestions,
      ...(suggestWarnings.length ? { warnings: suggestWarnings } : {}),
    });
  }
  if (sub === 'render') {
    let phase;
    if (opts.phase !== undefined) {
      const parsedPhase = requirePhaseArg(opts.phase);
      if (!parsedPhase.ok) {
        return fail('bad-args', 'trace render --phase must be a phase number',
          'send a plain phase number, or drop --phase to render the whole record');
      }
      phase = parsedPhase.raw;
    }
    const r = renderTrace(dir, phase);
    // The BOUND, and it lives here rather than in `renderTrace` (D-08). Two
    // in-process consumers read the full array off the function - `trace
    // suggest` above reads `r.events.length`, and lib/trace-suggest.mjs reads
    // `render.events` directly - so bounding the function would make every
    // evidence-backed retune suggestion price a fraction of the run. What is
    // oversized is the CLI RESPONSE, which is read into a model's context:
    // 36,916 B for `--phase 3` on this repo's own record, nearly all of it the
    // raw event array.
    //
    // What replaces it is NOT a tail-N of `events`. It is the per-bracket rows
    // plus EVERY `outcome` event, because references/triage-gate.md reads this
    // response to find a prior `rearm` outcome under the current `corr` before
    // firing the narrowed round - a truncated payload makes that lookup miss,
    // and the one-re-arm cap on the only BLOCKING trigger fails open. The
    // second reader, workflows/report.md, needs one row per dispatch/return
    // pair and one line per review fire, which is the same shape.
    // PRESENCE, the `--undo` precedent at `phase-done`: the flag says "hand me
    // the raw array" and has no value to get wrong.
    const full = 'events' in opts;
    return ok({
      file: r.file,
      corr: r.corr,
      capped: r.capped,
      // Emitted only where the record carries a rotation marker, so an envelope
      // every reader already parses is byte-identical on a record that never
      // rotated. It names the sibling the cut events are in; nothing reads that
      // file, and this field is how a reader learns they are not missing.
      ...(r.rotated ? { rotated: r.rotated } : {}),
      counts: r.counts,
      ...(Object.keys(r.roles).length ? { roles: r.roles } : {}),
      // Emitted the way `roles` is: only when there is something to say. A
      // trace carrying no coordinator marker has no residue to report, and a
      // zeroed block would read as a coordinator that spent nothing.
      ...(r.coordinator ? { coordinator: r.coordinator } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      ...(full
        ? { events: r.events }
        : { brackets: r.brackets, outcomes: r.events.filter((e) => e.family === 'outcome') }),
      unpaired: r.unpaired,
      // Emitted the way `roles` and `coordinator` are - only when there is
      // something to say, so a clean trace's envelope is byte-identical to the
      // one every reader already parses. A bracket closed under a role its
      // dispatch did not name is a prose defect at one of the two sites; it is
      // reported here and billed nowhere (the dispatch stays the authority).
      ...(r.mismatched.length ? { mismatched: r.mismatched } : {}),
    });
  }
  if (sub === 'window') {
    // Scope exactly as `render` and `suggest` take it: no `--phase` is the
    // WHOLE record, because a window ceiling is argued off a milestone's worth
    // of dispatches rather than one phase's.
    let phase;
    if (opts.phase !== undefined) {
      const parsedPhase = requirePhaseArg(opts.phase);
      if (!parsedPhase.ok) {
        return fail('bad-args', 'trace window --phase must be a phase number',
          'send a plain phase number, or drop --phase to argue the window ceilings off the whole'
          + ' record');
      }
      phase = parsedPhase.raw;
    }
    const r = renderTrace(dir, phase);
    // warnings[] BOUND and ridden on the envelope when non-empty, the rule
    // lib/merge-warnings.mjs holds every mergeLayers callsite to: a torn layer
    // reads every ceiling as unset, so the report silently falls back to the
    // defaults below and a project that deliberately raised one would see its
    // crossings come back with nothing said.
    const { config: windowConfig, warnings } = mergeLayers(join(dir, 'config.json'));
    const set = windowConfig?.workflow?.max_dispatch_tokens;
    /** @type {Record<string, number>} */
    const ceilings = {};
    for (const [role, fallback] of Object.entries(DISPATCH_WINDOW_DEFAULTS)) {
      const v = set?.[role];
      ceilings[role] = v === undefined || v === null ? fallback : v;
    }
    const w = windowBudget(r.file, r.brackets, ceilings);
    return ok({
      checked: 'dispatch-window',
      scope: phase === undefined ? 'all' : String(phase),
      // The record the crossings were read from, which is also the `file` on
      // every problem: a finding that cannot name its source is a number.
      file: r.file,
      ceilings,
      problems: w.problems,
      // Stated at zero rather than omitted, unlike `render`'s conditional keys.
      // This subcommand has no byte-stable envelope to preserve, and the whole
      // point of the two counters is that a reader can tell how much of the
      // record was actually compared - an absent count would read as none.
      compared: w.compared,
      unbudgeted: w.unbudgeted,
      unrecorded: w.unrecorded,
      ...(warnings.length ? { warnings } : {}),
    });
  }
  return fail('usage', 'trace <append|close|render|suggest|window|ignore>');
}

/**
 * The record a receipt SETTLES, as an absolute path, or '' when this fire has
 * none that can be resolved.
 *
 * A receipt names its fire with `--trigger`, `--sha` and - on a per-plan fire -
 * `--plan <k>`, which is the D-06 discriminator grammar minus the spelling: a
 * per-plan fire's discriminator IS `plan-<k>`, and every other fire's is
 * `<command>-<short head sha>`, whose command half no receipt carries. So the
 * per-plan arm resolves ONE name and the other arm matches the directory on the
 * trigger, the round and the head the discriminator ends with, taking a single
 * unambiguous hit and nothing else. Two candidates answer '' rather than a
 * guess: a check that might be reading another fire's rulings is worse than no
 * check, because it refuses a correct receipt.
 *
 * EVERY ARM ANSWERS '' RATHER THAN THROWING. This resolves a cross-check, and
 * an unresolvable one omits the check - it never fails the append.
 *
 * `trigger` is validated against `RECORD_TOKEN` before it reaches `join`, the
 * same rail the writer applies for the same reason (VAL-01): it reaches a
 * FILENAME, and a `--trigger ../../etc` that resolved anything at all would be
 * reading outside the phase directory.
 *
 * @param {string} dir @param {string|number} phaseRaw
 * @param {string|undefined} trigger @param {any} plan @param {any} sha
 * @param {number} round
 * @returns {string}
 */
function recordForFire(dir, phaseRaw, trigger, plan, sha, round) {
  if (typeof trigger !== 'string' || !RECORD_TOKEN.test(trigger)) return '';
  const pdir = join(dir, 'phases', String(phaseRaw));
  /** A regular FILE at `name` under the phase directory, or ''. A symlink is
   * not a record: it is followed out of the tree by every reader after it. */
  const regular = (name) => {
    const file = join(pdir, name);
    try { return lstatSync(file).isFile() ? file : ''; } catch { return ''; }
  };

  const planKey = plan === undefined || plan === null ? '' : String(plan).trim();
  if (planKey) {
    const discriminator = `plan-${planKey}`;
    // Refused here for the reason the writer refuses it: a discriminator
    // outside this grammar names no record the writer could ever have written.
    if (!RECORD_TOKEN.test(discriminator)) return '';
    return regular(recordName(trigger, discriminator, round));
  }

  const head = typeof sha === 'string' ? sha.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{7,40}$/.test(head)) return '';
  const prefix = `ADJUDICATION-${trigger}-`;
  const suffix = round > 1 ? `-r${round}.json` : '.json';
  /** @type {string[]} */
  let names = [];
  try { names = readdirSync(pdir); } catch { return ''; }
  const hits = names.filter((name) => {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false;
    const discriminator = name.slice(prefix.length, name.length - suffix.length);
    // At round 1 the suffix is bare `.json`, which every higher round's file
    // also ends with - so a `-r<n>` tail is another round's record, not this
    // fire's discriminator.
    if (round === 1 && /-r\d+$/.test(discriminator)) return false;
    // The discriminator's last segment is the short head sha. Compared as a
    // PREFIX in whichever direction is shorter, because the receipt may spell
    // the head 7-char or full while the filename is abbreviated.
    const tail = discriminator.slice(discriminator.lastIndexOf('-') + 1).toLowerCase();
    return tail.length >= 7 && (head.startsWith(tail) || tail.startsWith(head));
  });
  // Through `regular` like the per-plan arm above: the glob found a NAME, and a
  // symlink wearing that name is followed out of the tree by every reader after
  // it, which is the disposition this function already declares.
  return hits.length === 1 ? regular(hits[0]) : '';
}

/**
 * Do this receipt's settled figures agree with the rulings in its fire's own
 * record (AC4/D-01)?
 *
 * WHY IT IS ASKED HERE. The three figures are DERIVED by the `adjudication`
 * seam and copied onto the receipt line by hand, so the receipt is where a
 * mistyped one enters the record - and once appended, the trace and the record
 * disagree forever with nothing saying which is right. Recounting at write time
 * is what makes the survivor count recomputable rather than asserted.
 *
 * ONLY WHEN ALL THREE ARE PRESENT: a partial set cannot be checked against a
 * recount that answers all three, and refusing on one of them would refuse a
 * receipt shape nothing writes.
 *
 * An ABSENT record omits the check - a fire predating the format, or an
 * advisory arm that wrote none. The trace is gitignored, so it is the local
 * cross-check and the committed record is the custody artifact; a receipt that
 * could not be cross-checked is not thereby wrong.
 *
 * @param {string} dir @param {string|number} phaseRaw
 * @param {{trigger: string|undefined, plan: any, sha: any, round: number,
 *   settled: Record<string, number>}} fire
 * @returns {{ok: boolean, reason: string, detail: string, hint: string}}
 */
function recountReceipt(dir, phaseRaw, fire) {
  const keys = ['survivors', 'downgraded', 'refuted'];
  const pass = { ok: true, reason: '', detail: '', hint: '' };
  if (!keys.every((k) => k in fire.settled)) return pass;
  const file = recordForFire(dir, phaseRaw, fire.trigger, fire.plan, fire.sha, fire.round);
  if (!file) return pass;
  const rel = relative(dir, file);

  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch {
    // REFUSED, not skipped. This file exists and was written by the seam as
    // one atomic JSON object, so unparseable means truncated or edited - which
    // is precisely the tampering the cross-check exists to surface, and
    // appending a figure nothing can check against it would bury it.
    // The parse error itself is deliberately NOT quoted back: the detail names
    // the file, which is the whole of what a caller acts on here, and echoing a
    // caught message is the idiom planning.test.mjs's redaction census counts.
    return { ok: false, reason: 'bad-record',
      detail: `${rel} exists but is not readable as JSON, so this receipt's counts cannot be `
        + 'checked against its rulings and nothing was appended',
      hint: 'restore or re-write the record for this fire, then append the receipt' };
  }
  const counts = deriveCounts(record && record.entries);
  for (const [flag, counted] of [['survivors', counts.survived],
    ['downgraded', counts.downgraded], ['refuted', counts.refuted]]) {
    if (fire.settled[flag] !== counted) {
      return { ok: false, reason: 'count-disagreement',
        detail: `--${flag} says ${fire.settled[flag]}, but counting the rulings in ${rel} gives `
          + `${counted} - the count is DERIVED from the record, never typed beside it, so `
          + 'nothing was appended',
        hint: `pass the figures the adjudication seam returned for this fire (round ${fire.round})`
          + ', or fix the record if the receipt is the one that is right' };
    }
  }
  return pass;
}

// Only `cmdTrace` is dispatched. `cmdTraceIgnore` is exported beside it because
// it is a subcommand handler in its own right and the census counts it as one -
// what makes it internal is that `trace ignore` reaches it through `cmdTrace`.
export { cmdTrace, cmdTraceIgnore };
