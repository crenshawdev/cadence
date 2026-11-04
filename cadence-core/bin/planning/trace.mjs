// @ts-check
// planning/trace.mjs - the `trace` family: the joined run record (.planning/trace.jsonl), its subcommands, and the .gitignore arm that keeps the record out of git.
// both handlers live here because the `ignore` arm of cmdTrace calls cmdTraceIgnore, and splitting them would turn an internal call into an import between two command modules.
// everything else is single-use for one of the two, and the two mergeLayers callers carry the layer warnings into their envelope, so no header marker is needed.
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
import { unfixedFromEntries } from '../lib/filing-decision.mjs';
import { atomicWrite, planTaskTitles } from '../lib/planning-files.mjs';
import { planFileFor } from '../lib/phase-plans.mjs';
import {
  READS_CLAIM_FILE, READS_EVICT_TEMP_FILE, READS_FILE, READS_ROTATE_TEMP_FILE,
  ROTATED_READS_FILE, inDispatchReads, joinReads,
} from '../lib/read-trace.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';
import { RUNG_ORDER } from '../lib/rung-agent.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';
import { parseAdjudication, suggestFromRender } from '../lib/trace-suggest.mjs';
import { FAMILIES, ROTATED_TRACE_FILE, appendEvent, correlationId, renderTrace } from '../lib/trace.mjs';
import { windowBudget } from '../lib/window-budget.mjs';

// the seam is how prose writes the lifecycle and outcome families, since neither has a script to hang a direct write on; scripts that have code (route, review-provider) call lib/trace.mjs directly
// `append` is best effort and says so: a write that didn't happen (file at its cap, planning root unwritable) is ok:true with `written:false` and the reason, and only a malformed call is ok:false
// the trace records what a run did and may never change what it does
// the ignore line a project needs to keep its run record out of git, and the comment written above it so the next reader knows what it is
const TRACE_IGNORE_LINE = '.planning/trace.jsonl';
const TRACE_IGNORE_COMMENT = "# Cadence's joined run record - local diagnostics"
  + " only, one machine's routing/provider/worker events";

/**
 * The second rule: the generation a rotation at the record's size bound leaves behind.
 * Without it the first rotation leaves up to `MAX_TRACE_BYTES` untracked for the next `git add .planning` to sweep into the repo, which on a public repo republishes the diagnostics the line above withholds.
 * A second literal and not a glob on the first, since `line` is what `/cad-health` reports and what `traceTracked` hands `ls-files --error-unmatch` as a pathspec. The basename comes from what `lib/trace.mjs` exports, so the rule and the written file can't drift.
 */
const ROTATED_IGNORE_LINE = `.planning/${ROTATED_TRACE_FILE}`;
const ROTATED_IGNORE_COMMENT = "# ...and the generation Cadence's run record"
  + ' leaves behind when it rotates at its size bound';

/**
 * The reads record's six rules, in one block.
 * Nothing used to ignore this record, so on a scaffolded project the live file and each rotation's leftovers sat untracked for the next `git add .planning` to sweep in.
 * Six and not one glob because each names a different thing: the live record, the one prior generation `rotateReads` keeps, the claim sidecar a completed rotation leaves inert on purpose, and the private stamps and two temps a rotation killed halfway strands. The last three are patterns since each carries the writer's pid and a random suffix.
 * Basenames come from what `lib/read-trace.mjs` exports, for the reason ROTATED_IGNORE_LINE does: a rule spelled by hand here and a path spelled there are two statements of one fact.
 * The trace's own `.rotate` and `.evict` temps get nothing here on purpose, they're the trace's residue and are left out of this block.
 */
const READS_IGNORE_LINES = Object.freeze([
  `.planning/${READS_FILE}`,
  `.planning/${ROTATED_READS_FILE}`,
  `.planning/${READS_CLAIM_FILE}`,
  `.planning/${READS_CLAIM_FILE}.*`,
  `.planning/${READS_ROTATE_TEMP_FILE}.*`,
  `.planning/${READS_EVICT_TEMP_FILE}.*`,
]);
const READS_IGNORE_COMMENT = "# ...and Cadence's per-tool-call read record, the"
  + ' generation ITS rotation leaves behind, and that rotation\'s claim files'
  + ' and killed-mid-rotation temps';

/**
 * Does a `check-ignore -v` match source travel with the repository?
 * That's why `-v` and not `-q`: `check-ignore` also consults `core.excludesFile` and `.git/info/exclude`, neither is cloned, so a machine-local exclusion would answer `ignored:true` and whoever clones commits the run record. Only a `.gitignore` file inside the root counts.
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
 * Git's own answer about the ignore line, with the matching source, or `method: 'file'` when git can't answer at all (not installed, or not a repository). Exit 1 from `check-ignore` is data, nothing matched; only a harder failure falls back.
 * `--no-index` is load-bearing: without it `check-ignore` reports nothing for a path in the index, so a project with the line and the record force-added answered `ignored:false`, `cmdTraceIgnore` appended the line every run, and `/cad-health` reported a missing rule that was right there. Tracked is `traceTracked`'s separate question.
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
  // the output is `<source>:<line>:<pattern>`, a tab, then the pathname; the source is everything before the last two colons of the left half, so a path containing a colon isn't truncated into another file name
  const left = out.split('\n')[0].split('\t')[0];
  const last = left.lastIndexOf(':');
  const prev = last > 0 ? left.lastIndexOf(':', last - 1) : -1;
  const source = prev >= 0 ? left.slice(0, prev) : null;
  return { method: 'git', travels: ignoreSourceTravels(source), source };
}

/** Is the run record tracked? A non-repo tracks nothing, so false there. */
function traceTracked(root) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', TRACE_IGNORE_LINE],
      { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

/**
 * The literal fallback: the line as a project would write it in `<root>/.gitignore`, comments and blank lines skipped.
 * Used only when git couldn't answer, since it can't see a `.planning/` wholesale ignore, which is why the git arm goes first.
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
 * `trace ignore` - the scaffold-time writer of the ignore line, and the read-only reporter `/cad-health` runs.
 * `ignored` and `tracked` are the state as found, before any write, and `written` says what this call changed. `--check` writes nothing: `/cad-health` reports on a project it didn't create and may not edit its `.gitignore`.
 * `/cad-new-project` writes the line at scaffold time and `/cad-health` runs `--check`, so an older project is reported and not edited underneath. Because the record is ignored, nothing a parallel worktree wrote can ride the merge back into phase history, which is half of why a worktree executor emits no trace events.
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
  // the sibling is asked separately by the same two readers: a project covered for the record and not its rotated generation is the half-covered state /cad-health has to report
  const rotatedGit = gitIgnoreState(root, ROTATED_IGNORE_LINE);
  const rotated = rotatedGit.method === 'git'
    ? rotatedGit.travels
    : gitignoreCarriesLine(root, ROTATED_IGNORE_LINE);
  // the reads record's rules go through the same two readers one at a time: git's answer first, the literal scan only where git couldn't answer
  const missingReads = READS_IGNORE_LINES.filter((rule) => {
    const g = gitIgnoreState(root, rule);
    return !(g.method === 'git' ? g.travels : gitignoreCarriesLine(root, rule));
  });
  const common = {
    root,
    file,
    // `line` stays the live record's literal so /cad-health's `ignored` and `tracked` reading is unchanged; the sibling's rule is a field of its own beside it
    line: TRACE_IGNORE_LINE,
    rotated_line: ROTATED_IGNORE_LINE,
    // its own field and never folded into either: `line` is what /cad-health reports and what `traceTracked` passes to `ls-files --error-unmatch` as a pathspec
    reads_lines: [...READS_IGNORE_LINES],
    ignored: live && rotated && missingReads.length === 0,
    tracked: traceTracked(root),
    method: git.method,
    ...(git.source ? { source: git.source } : {}),
  };
  if ('check' in opts) return ok({ ...common, written: false });
  // already covered by lines that travel, which is what makes a re-run safe
  if (common.ignored) return ok({ ...common, written: false, reason: 'already-ignored' });

  // only what's missing is added, so an older project is upgraded on its next non-`--check` run without rewriting rules it has; each record's rules get their own block and comment, and a block with nothing missing isn't emitted
  const missingTrace = [
    ...(live ? [] : [TRACE_IGNORE_LINE]),
    ...(rotated ? [] : [ROTATED_IGNORE_LINE]),
  ];
  const blocks = [
    ...(missingTrace.length
      ? [`${live ? ROTATED_IGNORE_COMMENT : TRACE_IGNORE_COMMENT}\n${missingTrace.join('\n')}\n`]
      : []),
    ...(missingReads.length ? [`${READS_IGNORE_COMMENT}\n${missingReads.join('\n')}\n`] : []),
  ];
  const block = blocks.join('\n');
  // every existing byte survives; the newline is added only when the file lacks a trailing one, so a brownfield .gitignore keeps its lines and ours land on lines of their own
  const existing = read(file);
  const next = existing === null || existing === ''
    ? block
    : `${existing}${existing.endsWith('\n') ? '' : '\n'}\n${block}`;
  atomicWrite(file, next);
  return ok({ ...common, written: true });
}

/**
 * The values the `suggest` arm falls back to for the keys its rules name when no config layer holds one, and only for keys whose schema default is a real value.
 * A key defaulting to `null` stays out on purpose: `null` is the schema's "no layer pins this", and the suggestion reports that as unset instead of inventing a value.
 * `config.schema.json` is the source of truth. This map is the unset-layer fallback and nothing else, the same duplication DISPATCH_WINDOW_DEFAULTS accepts, and the schema isn't parsed at runtime. Change one place and not the other and `/cad-suggest` prints a `current` that disagrees with `/cad-config`, which `prose-agreement.test.mjs` fails on.
 */
const SUGGEST_KEY_DEFAULTS = Object.freeze({
  'workflow.max_plan_tasks': 8,
  'review.reviewers': ['claude-subagent'],
});

/**
 * The gate ladder from the `review.triggers.plan.gate` row, weakest first. `routeLadder` owns the read and the reason the env override isn't honoured, this decides what a suggestion tells a user to set a gate to.
 * An unreadable schema means no ladder, so the gate arm omits `proposed`, and nothing is substituted from memory.
 * @returns {string[]|undefined}
 */
function gateLadder() {
  return routeLadder('gates');
}

/**
 * The task count of the plan a `cad-executor` checkpoint names, or null when it maps to no readable plan: unknown, never under-ceiling.
 * Unknown is the common case: a `plan` that's a worker key (`1-cut`, `1-fix`) names no file, an archived cycle keeps its phase dirs elsewhere, and a delete-mode close removes them.
 * `phase` goes through `requirePhaseArg` as the traversal guard as much as the shape one, since it comes off a record line and becomes a directory component. `plan` needs none, it's only compared against `readdirSync` entries so a `../` matches nothing.
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
  const file = planFileFor(plans, plan);
  if (!file) return null;
  const text = read(join(pdir, file));
  if (text === null) return null;
  return planTaskTitles(text).length;
}

/**
 * Everything the pure rules in `lib/trace-suggest.mjs` need to name a direction, a current value and, where one can be read, a target: the resolved config value behind each key the record's events reach, and the two ladders.
 * Resolved here because that file is pure and stays that way, it owns the rules and this owns the reads.
 * Keyed off the record and not the schema's key space, since a trigger that never fired and a role that never resolved are keys no rule can name.
 * `checkpointTasks` is the file half of the binding check, here because reading a plan file is I/O.
 * @param {string} dir the planning dir
 * @param {any} render
 * @param {any} config the merged config layers
 */
function suggestResolution(dir, render, config) {
  /** @type {Record<string, any>} */
  const values = {};
  // an absent or null value isn't recorded: trace-suggest reads a missing key as unset, which is what it should print
  const set = (key, value) => { if (value !== undefined && value !== null) values[key] = value; };
  const triggers = config?.review?.triggers || {};
  const effort = config?.model?.effort || {};
  const events = Array.isArray(render?.events) ? render.events : [];
  // one entry per counted checkpoint, in record order, so the rule can tell "every one was measured" from "some were"
  /** @type {(number|null)[]} */
  const checkpointTasks = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.family === 'outcome' && e.event === 'adjudication') {
      const parsed = parseAdjudication(e);
      if (parsed) set(`review.triggers.${parsed.trigger}.gate`, triggers?.[parsed.trigger]?.gate);
    } else if (e.family === 'routing' && e.event === 'resolve') {
      if (typeof e.role === 'string' && e.role) set(`model.effort.${e.role}`, effort?.[e.role]);
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint' && e.role === 'cad-executor') {
      checkpointTasks.push(checkpointPlanTasks(dir, e));
    }
  }
  set('review.reviewers', config?.review?.reviewers ?? SUGGEST_KEY_DEFAULTS['review.reviewers']);
  set('workflow.max_plan_tasks',
    config?.workflow?.max_plan_tasks ?? SUGGEST_KEY_DEFAULTS['workflow.max_plan_tasks']);
  const gates = gateLadder();
  // the rung rule compares its target against the rung a config layer set
  return { values, ...(gates ? { gates } : {}), rungs: [...RUNG_ORDER], checkpointTasks };
}

// the grammar the shared `trace append|close` body judges its string flags by, read off arg-contract and not restated as guards below
// the two rows are unioned because one body validates both subcommands: a flag row is a prose allowlist that never widens what a subcommand accepts, so `trace close` declares no `--sha`, `--base`, `--step` or `--trigger` though this body reads them for it
const TRACE_GRAMMAR = {
  ...CONTRACTS['planning.mjs']['trace append'],
  ...CONTRACTS['planning.mjs']['trace close'],
};

// the flags whose whole rule is the value grammar, in the order they're read: the first three declare `fallback` on both axes and the rest `refuse`, the two dispositions this body has always run side by side
const TRACE_STRING_FLAGS = ['--plan', '--sha', '--base', '--role', '--step', '--reviewer',
  '--trigger', '--agent-id', '--anchor', '--authorization-id'];

// the `--duration-ms` grammar, closed to digits and unit letters: a plain non-negative integer (milliseconds) or the host's own rendering, number-plus-unit terms over h, m, s and ms (`1m 23s`, `1h2m3s`, `450ms`)
// `ms` comes first in the alternation or `m` swallows the `m` of `450ms` and reads 450 minutes plus a stray `s`
// closed and not free text because this is a caller-derived figure and not prose, so it needs no `-file` transport
// null means malformed and the caller refuses with nothing appended; the safe-integer test is part of the grammar, since `9999999999999999999h` would otherwise write a float into a field readers sum as an integer
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

// what the providers said this scope's review calls cost, folded and not passed through: this response is read into a model's context, and a summed figure with its call count beats hundreds of `provider/request` objects
// its own denomination, and it never touches `roles`: `roles.tokens` is the host's final-window figure for a dispatch while this is an input+output count off the wire, and summing them would denominate `roles.cad-reviewer.tokens` in nothing
// a call whose event carried no usage raises `unrecorded` and adds no zero to the total, or older events (which carry neither key) would price a whole cycle's reviews at nothing
// the block is absent where the scope holds no provider review call, like `roles` and `coordinator`, so a record without one renders byte-identically for readers already parsing this envelope
// only `command === 'review'` is priced: the seam writes this event for `review`, `detect-models` and `consult` too, and folding them in would price a model listing as review spend. An event with no `command` isn't priced, since this figure may only price a call it can name
// only calls that reached the wire: a call refused before sending (no key, unknown provider, bad payload, over the cap) cost nothing, and counting it would claim an unknown cost. Everything past the send stays counted, degraded outcomes included, since a call that burned its budget and came back unusable is the one whose cost must show
// UNSENT_OUTCOMES is review-provider's vocabulary read back out of a file and not imported, so a refusal reason added there and not here lands as one more unrecorded call, the safe direction: this figure may overstate what's unknown and may never hide what was spent
// no filter on `event`: the seam writes exactly one event per call and they all read `request`, so a second filter would defend against a shape it doesn't produce

/**
 * The `outcome` values `review-provider.mjs` writes for a call it refused before the request was sent.
 * No bytes on the wire, so no spend to price and no call to count.
 */
const UNSENT_OUTCOMES = new Set([
  'bad-provider', 'bad-args', 'no-key', 'bad-payload', 'over-cap',
]);

/**
 * One token count off a provider event, or undefined where the line carries something that isn't one.
 * The trace is a file, and a hand-edited or foreign line must never get string-concatenated onto a numeric total, the same refusal `renderTrace` makes for a string `tokens` on a return.
 * @param {any} v @returns {number|undefined}
 */
function usageCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/**
 * The provider-spend fold for a set of scoped events, spread into the response.
 * `calls` counts `provider/request` events whose `command` is `review` and whose `outcome` isn't one the seam wrote without sending anything. Other provider events stay visible in `counts.provider`.
 * @param {Record<string, any>[]} events the events already scoped to `--phase`
 * @returns {{provider_spend?: {calls: number, tokens?: number, unrecorded?: number}}}
 */
function providerSpend(events) {
  let calls = 0;
  let priced = 0;
  let tokens = 0;
  for (const e of events) {
    if (e.family !== 'provider') continue;
    // a review that was actually sent: the other commands on this family are real provider calls with real costs, but not what the line reading this figure says it counts
    if (e.command !== 'review' || UNSENT_OUTCOMES.has(e.outcome)) continue;
    calls++;
    const u = e.usage;
    if (!u || typeof u !== 'object' || Array.isArray(u)) continue;
    const input = usageCount(u.input);
    const output = usageCount(u.output);
    if (input === undefined && output === undefined) continue;
    priced++;
    tokens += (input ?? 0) + (output ?? 0);
  }
  if (!calls) return {};
  const unrecorded = calls - priced;
  return {
    provider_spend: {
      calls,
      // only when a figure landed, as `roles.tokens` is: a scope where every call reported nothing says `unrecorded` and never `0`
      ...(priced ? { tokens } : {}),
      ...(unrecorded ? { unrecorded } : {}),
    },
  };
}

function cmdTrace(dir, sub, opts) {
  if (sub === 'ignore') {
    // --root is the PROJECT root and not --dir: .gitignore lives there while the line it carries is .planning/trace.jsonl
    // a --root with nothing usable after it is refused by its declared row at the door, or it would edit the cwd's tree and not the caller's (#42/#45)
    return cmdTraceIgnore(typeof opts.root === 'string' ? opts.root : process.cwd(), opts);
  }
  // close is append with the two fields a dispatch site used to restate taken off its hands, so one body validates every flag below: a second copy of the --tokens grammar is a second place to drift
  if (sub === 'append' || sub === 'close') {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) {
      return fail('bad-args', `trace ${sub} needs --phase <N>`,
        `pass --phase <N> for the phase this event belongs to, then re-run the ${sub} - nothing was`
        + ' appended, so exactly one event lands');
    }
    // the tree-aware collision check goes right after the parse and ahead of the other flag rails: append and close are the arms whose raw spelling reaches a phases/ path, so a colliding one would recount one phase's fires under another's name
    // suggest, render and window only filter trace.jsonl and resolve no directory
    const collision = phaseSpellingCollision(dir, parsedPhase);
    if (collision) {
      return fail('bad-args', `trace ${sub} ${collision}`,
        `re-run the ${sub} with one of the two spellings the detail names - nothing was appended`);
    }
    // --detail-file is the safe transport for a detail the caller derived (a verdict, a checkpoint's reason); the reasoning lives in text-flag-file and conventions.md
    // resolved before the close inference below reads the detail: on opts.detail alone, every converted checkpoint site would bill as a clean return
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
      // fixed, never read off the caller: a close site states what it is closing and nothing about how the record spells it
      family = 'lifecycle';
      // the arm is inferred from --detail and never from --tokens: every checkpoint carries --detail and no return does, while some checkpoints carry no --tokens, so a token classifier would bill an unusable worker as a clean close
      // escalation stays out of the inference: it has no prose producer, so a three-way inference is flexibility nothing exercises, and it's still reachable through trace append --event escalation
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

    // --tokens is what the dispatch cost, read off the worker's return. A malformed value is a malformed call and nothing is appended: a dropped field renders the role unrecorded while the caller thinks a figure landed
    // the one exception is a comma-grouped integer, because this plugin prints token figures grouped (146,405) and refusing it strands the worker unpaired with the dispatch half already written
    // grouping is stripped only in the strict 3-digit shape, so 1,2,3 and 146,40 are still refused
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

    // --turns is how many tool calls the dispatch made, off the same return metadata as --tokens; tokens alone can't price a run, since the bill is turns times window
    // structured and never parsed back out of --detail, which isn't a machine-join surface (one trigger was spelled four ways across shipped adjudication events)
    // validated like --raised: a malformed value is a malformed call and nothing is appended, and there's no comma-grouping exception because a tool-call count is never printed grouped
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

    // --duration-ms is how long the dispatch itself took, the third figure off the same return; the dispatch-to-close span renderTrace derives includes the orchestrator's own time, so it says how long the step took and not the worker
    // the grammar is parseDurationMs's, and it takes the host's formatted spelling because that's the only one an orchestrator can copy: refusing 1m 23s would strand the worker unpaired, as with --tokens grouping
    // outside it, it's a malformed call and nothing is appended, same as --tokens and --turns
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

    // --raised is how many findings the reviewers raised before adjudication, so the record can tell a gate that found nothing (0 of 0) from one whose every finding was refuted (0 of 9)
    // structured because a figure parsed back out of --detail prose is only as trustworthy as the substitution that condemned it
    // validated like --tokens, with no comma-grouping exception since a finding count is never printed grouped
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

    // --survivors / --downgraded / --refuted are the settled figures of a fire, the other side of --raised: what survived being argued with, which is the whole of what an adjudication decided
    // validated like --raised, with no comma-grouping exception
    // each key is omitted when its flag was absent and a real --survivors 0 still records a 0: a fire nobody counted and a fire that counted zero are different fires
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

    // --round says which round of a capped re-arm this event belongs to: the record a receipt settles is written at ...-<discriminator>-r<round>.json above round 1, so a settle naming no round would resolve round one's file and check round two's figures against stale rulings, passing whenever they happen to coincide
    // absent means round 1 on both sides, so the write and receipt sides resolve one filename by one rule
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

    // --read is the read-set the site made the worker read, one comma-separated value split like phase-done --reqs splits its ids
    // a repeated flag is impossible, not a choice: parseArgs keeps only the last, so --read a --read b would drop rows while looking complete. Don't "improve" this into a repeatable flag
    // an element is any verbatim string the site made the worker read: a path, a glob, or a non-path reference like a <base>..<head> range. It's stored with no existence check or normalization, so a reader converting to bytes has to resolve each element by kind
    // --read-file is the same value through the path transport, split by the same grammar and refused by the same all-blank test, so the two can't disagree about what an element is
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
      // a bare --read, an empty string or an all-blank value is almost always an unset "$PATHS", and a complete-looking dispatch with no read-set is what this refuses; a file holding only separators reaches the same test
      if (!list.length) {
        return fail('bad-args',
          `trace ${sub} --read${'read-file' in opts ? '-file' : ''} needs a comma-separated path list`,
          'list what this site caused the worker to read as one comma-separated value - paths,'
          + ' globs, or a <base>..<head> range - or leave the flag off; a bare one is almost always'
          + ' an unset "$PATHS", and nothing was appended');
      }
      read = list;
    }

    // the ten string flags, each read through its declared row: one loop where seven hand-written guards used to state the same two rules, and the one place this body's two bare-flag dispositions are decided
    // --plan, --sha and --base declare fallback and read as absent, so every shipped trace close written without them keeps answering ok:true; --role, --step, --reviewer and --trigger refuse
    // --role moved to refuse: a bare one returned ok:true, wrote a line with no role key, and trace render aggregated it under the empty string key, a complete-looking dispatch with its attribution gone
    // --step names the workflow step a coordinator marker is for; a marker without one defeats the per-step attribution it exists for
    // --reviewer is which reviewer actually ran the fire (not the one the trigger asked for), so cross-model and subagent reviews of one trigger stop being one shape; nothing refuses a reviewer outside the resolved set, so this mark is the whole enforcement
    // --trigger is which review trigger the event belongs to, so an outcome event joins to its fire without reading prose, and risk-check status demands one for a matched range; the free-text --detail spelled it four ways, which is the substitution this flag avoids
    // a bare one parses as boolean true in parseArgs, which is why the read is against ARGV: the refusal has to see the spelling
    const flags = {};
    for (const flag of TRACE_STRING_FLAGS) {
      const parsedFlag = evaluateFlag(ARGV, flag, TRACE_GRAMMAR[flag]);
      // the wording comes from the one flag-to-sentence map the dispatch door uses, so a bare trace append --role answers the same whichever refuses it first (the door for flags the resolved row declares, this loop for the ones only the union does)
      if (!parsedFlag.ok) {
        return fail('bad-args', argRefusal(`trace ${sub}`, flag),
          'give the flag the detail names a value, or leave it off entirely - nothing was appended,'
          + ' so a corrected re-run writes exactly one event');
      }
      flags[flag] = parsedFlag.value;
    }
    // trimmed for the four that refuse, since a stored name is a join key and " cad-executor " must not read as a second role; the fallback three are stored verbatim as always
    const trimmed = (flag) => (flags[flag] === undefined ? undefined : String(flags[flag]).trim());
    const step = trimmed('--step');
    const reviewer = trimmed('--reviewer');
    const trigger = trimmed('--trigger');
    const agentId = trimmed('--agent-id');

    // the window this receipt settles when it isn't the window the run is in: correlationId derives a run's id off the phase's newest phase_start, so a settlement written after a re-anchor is stamped with the new window's id and can never settle the fire from the old one (GH-227 Case A, repaired by hand-appending the line)
    // renderEvent already prefers an explicit non-empty corr on the event, so the fix is just a flag that supplies one
    // the flag carries the earlier window's anchor SHA and never a whole correlation id, derived through correlationId, so a receipt can only name a window of the phase it already declares
    // no key when the flag is absent, so existing calls derive as they do today; not coupled to an event name either, since this seam carries no runtime refusal keyed to one and the first would be read as drift and deleted
    const anchor = trimmed('--anchor');
    const corr = anchor === undefined
      ? undefined
      : correlationId(dir, parsedPhase.raw, anchor);

    // the human answer this receipt descends from (GH-220): one authorization applied to two ranges is two receipts, and nothing on either said they came from one decision
    // the id is minted by the coordinator when the engineer answers and never hashed or normalized out of the reason text; grouping shipped overrides by exact --detail collapsed two duplicate pairs and missed three distinct texts written on one standing authorization
    // trimmed like the other refusing flags since a stored id is a join key, and absent and empty stay distinguishable: the key rides the event only when the flag was given, or every older event would read as labelled
    // not keyed to the override event name: the seam is event-agnostic, and the rule that only an override carries an id is held by the prose that writes it
    const authorizationId = trimmed('--authorization-id');

    // the cross-artifact check: the adjudication seam derives the three settled figures from the record's rulings and they're copied onto this line by hand, so a mistyped one is cheapest to catch here. The record is recounted and a disagreeing figure is refused with nothing appended
    // an absent record omits the check and stores the flags as given (a fire predating the format, or an advisory arm that wrote none), or an unrecordable fire would be unrecordable in the trace too
    const recount = recountReceipt(dir, parsedPhase.raw, {
      trigger, plan: flags['--plan'], sha: flags['--sha'], round, settled,
    });
    if (!recount.ok) return fail(recount.reason, recount.detail, recount.hint);

    // the second cross-artifact check, over the same resolved record: a receipt settling a range whose record says a person cleared a blocking halt has to say why. overrideAccounted explains why it runs on any settled figure and not an event name
    const override = overrideAccounted(dir, parsedPhase.raw, {
      trigger, plan: flags['--plan'], sha: flags['--sha'], round, settled, reason: detail,
    });
    if (!override.ok) return fail(override.reason, override.detail, override.hint);

    // nothing below is coupled to an event name, which is what makes return, checkpoint and escalation store tokens identically; the rule that a coordinator marker carries no --role and no --tokens is held by the prose and the census assertion in trace.test.mjs, never by a runtime refusal
    const res = appendEvent(dir, {
      // the caller's spelling, which is what separates 1.10 from 1.1: normalized, both phases shared one trace key and correlation id. lib/trace.mjs stringifies both sides of every comparison, so older traces keep working
      phase: parsedPhase.raw,
      family,
      event,
      // present only when --anchor named an earlier window; absent, renderEvent derives as always
      ...(corr === undefined ? {} : { corr }),
      // no guard of their own: the loop above already applied each flag's disposition, so absent and fallback both arrive as undefined and omit the key
      ...(flags['--plan'] === undefined ? {} : { plan: flags['--plan'] }),
      ...(flags['--sha'] === undefined ? {} : { sha: flags['--sha'] }),
      // --base beside --sha: a fire receipt names both ends of the range it settled, since two ranges can share a head and differ at the base
      ...(flags['--base'] === undefined ? {} : { base: flags['--base'] }),
      ...(typeof detail === 'string' && detail ? { detail } : {}),
      ...(trimmed('--role') === undefined ? {} : { role: trimmed('--role') }),
      ...(tokens === undefined ? {} : { tokens }),
      // omitted when the return carried no count and never sent as 0: zero claims a dispatch that used no tools, an absent key reads as the host reporting none. A real --turns 0 still records 0
      ...(turns === undefined ? {} : { turns }),
      // omitted like --turns, and spelled duration_ms because the provider events already on the record spell it that way
      ...(durationMs === undefined ? {} : { duration_ms: durationMs }),
      ...(raised === undefined ? {} : { raised }),
      // each key only when its flag was: a fire nobody counted stays distinguishable from one that counted zero
      ...settled,
      // only when the caller named a round: an ordinary fire is round 1 by omission, and writing round: 1 onto every event would put a re-arm field on thousands that never re-armed
      ...('round' in opts ? { round } : {}),
      ...(read === undefined ? {} : { read }),
      ...(step === undefined ? {} : { step }),
      ...(reviewer === undefined ? {} : { reviewer }),
      // a dispatch that committed nothing because its tasks were already satisfied in HEAD: otherwise the bracket looks like a real one and a cost read counted two measured replays (30,588 and 24,570 tokens) as execution
      // present only when true, like every optional field here, so replay: false doesn't land on thousands of dispatches that weren't one
      ...(opts.replay === true ? { replay: true } : {}),
      ...(trigger === undefined ? {} : { trigger }),
      // the worker's host id, so the SubagentStop hook can tell a closed worker from a running one; the dispatch half can't carry it (written before the subagent exists), and it's the only identity the hook and orchestrator both hold
      ...(agentId === undefined ? {} : { agent_id: agentId }),
      // the authorization a settle descends from, so a second range settled by one human answer reads differently from a duplicate write of one range
      // it only labels the pair: risk-check status still wants every fired record to carry its own receipt naming both ends, so a shared id never lets one receipt settle a second range
      ...(authorizationId === undefined ? {} : { authorization_id: authorizationId }),
    });
    return ok({
      written: res.written,
      ...(res.corr ? { corr: res.corr } : {}),
      ...(res.reason ? { reason: res.reason } : {}),
    });
  }
  if (sub === 'suggest') {
    // evidence-backed config suggestions off the record: the pure rules live in lib/trace-suggest.mjs and this arm owns scope and envelope. No --phase means the whole record on purpose, since the caller is the milestone close and its evidence spans every phase
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
    // warnings ride the envelope when non-empty, which every mergeLayers caller owes: a torn layer reads every key as unset, so a project that pinned one would be told to move a value the read never saw
    const { config: suggestConfig, warnings } = mergeLayers(join(dir, 'config.json'));
    // the second record this arm opens is .planning/reads.jsonl, folded to the per-role in-dispatch figures; the brackets are the render already computed, so a --phase run scopes itself and only reads inside that phase's dispatches join
    // an absent file yields no rows and so no entry, never an error or a zero (as the ENOENT arm of cmdReads does); an unreadable one yields no entry and names the file in warnings
    const readRecord = readReadsRecords(dir);
    const inDispatch = readRecord.status === 'ok'
      ? inDispatchReads(joinReads(readRecord.records, r.brackets).rows)
      : undefined;
    const suggestWarnings = readRecord.status === 'unreadable'
      ? [...warnings, `cannot read ${readRecord.file}; in-dispatch re-reading was not measured`]
      : warnings;
    const suggestions = suggestFromRender(r, suggestResolution(dir, r, suggestConfig), inDispatch);
    return ok({
      // the record these suggestions were argued off, riding the same renderTrace result as the suggestions so the two can't name different files: a retune argued off a record the reader can't name is just a number
      file: r.file,
      scope: phase === undefined ? 'all' : String(phase),
      events_read: r.events.length,
      ...(r.capped ? { capped: true } : {}),
      // the rotation, as on trace render, so a reader seeing fewer events can tell a cut from a quiet run; not folded into capped, which means this read hit the ceiling
      ...(r.rotated ? { rotated: r.rotated } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      // the reads record, named and dated where cut, on the same nested key reads returns so a reader learns one shape. It comes from the readReadsRecords result already held here, so name and figures can't come off different files
      // not the top-level rotated above, which means the trace was cut, and one key meaning two records is what this nesting prevents
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
    // the bound lives here and not in renderTrace: trace suggest and lib/trace-suggest.mjs read the full array in-process, so bounding the function would make every retune suggestion price a fraction of the run. What's oversized is the CLI response, which is read into a model's context
    // what replaces it is the per-bracket rows plus every outcome event, not a tail-N: triage-gate reads this response for a prior rearm outcome under the current corr, and a truncated payload makes that miss, so the one-re-arm cap on the only blocking trigger fails open
    // --events is a presence flag, like --undo at phase-done: it says "hand me the raw array" and has no value to get wrong
    const full = 'events' in opts;
    return ok({
      file: r.file,
      corr: r.corr,
      capped: r.capped,
      // only where the record carries a rotation marker, so the envelope is byte-identical on a record that never rotated; it names the sibling the cut events are in, which is how a reader learns they aren't missing
      ...(r.rotated ? { rotated: r.rotated } : {}),
      counts: r.counts,
      ...(Object.keys(r.roles).length ? { roles: r.roles } : {}),
      // only when there's something to say, like roles: a trace with no coordinator marker has no residue, and a zeroed block would read as a coordinator that spent nothing
      ...(r.coordinator ? { coordinator: r.coordinator } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      ...(full
        ? { events: r.events }
        : {
          brackets: r.brackets,
          outcomes: r.events.filter((e) => e.family === 'outcome'),
          // the third bounded projection rides the same arm as the other two: --events is an either/or, so a caller asking for the raw array gets the old envelope and folds the spend itself
          ...providerSpend(r.events),
        }),
      unpaired: r.unpaired,
      // only when there's something to say, so a clean trace's envelope is byte-identical to what readers already parse; a bracket closed under a role its dispatch didn't name is a prose defect at one of two sites, reported here and billed nowhere (the dispatch stays the authority)
      ...(r.mismatched.length ? { mismatched: r.mismatched } : {}),
    });
  }
  if (sub === 'window') {
    // scoped as render and suggest are: no --phase is the whole record, since a window ceiling is argued off a milestone's worth of dispatches
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
    // warnings ride the envelope when non-empty, which every mergeLayers caller owes: a torn layer reads every ceiling as unset, so the report falls back to the defaults and a project that raised one sees its crossings come back with nothing said
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
      // the record the crossings were read from, also the file on every problem: a finding that can't name its source is a number
      file: r.file,
      ceilings,
      problems: w.problems,
      // stated at zero and not omitted like render's conditional keys: this envelope has no byte-stable shape to preserve, and an absent count would read as none, hiding how much of the record was compared
      compared: w.compared,
      unbudgeted: w.unbudgeted,
      unrecorded: w.unrecorded,
      ...(warnings.length ? { warnings } : {}),
    });
  }
  return fail('usage', 'trace <append|close|render|suggest|window|ignore>');
}

/**
 * The record a receipt settles, as an absolute path, or '' when this fire has none that can be resolved.
 * A receipt names its fire with `--trigger`, `--sha` and, on a per-plan fire, `--plan <k>`. A per-plan fire's discriminator is `plan-<k>`, so that arm resolves one name. Every other fire's is `<command>-<short head sha>` and no receipt carries the command, so the other arm matches the directory on trigger, round and head and takes a single unambiguous hit. Two candidates answer '' and not a guess, since a check that might read another fire's rulings is worse than none: it refuses a correct receipt.
 * Every arm answers '' instead of throwing, because an unresolvable cross-check omits the check and never fails the append.
 * Two homes, chosen by the phase: `phases/<N>/`, and `.planning/tasks/<slug>/` when the phase is 0. `/cad-task` spells its phase `0` and keeps its record under its slug, so with only the phase join every task settlement's counts were self-asserted (the recount found no record and omitted itself). A task receipt carries no slug, so the phase is the only signal and every task directory is searched.
 * `deferred/<N>/` is deliberately not here: fireHome in core.mjs says why the safe direction differs between the writer and this recount.
 * Candidates are counted across all homes together, so two task directories each holding a match answer '' just as two in one directory do.
 * `trigger` is checked against RECORD_TOKEN before it reaches `join`, the writer's rail, since it reaches a filename and `--trigger ../../etc` must not read outside the phase directory.
 * @param {string} dir @param {string|number} phaseRaw
 * @param {string|undefined} trigger @param {any} plan @param {any} sha
 * @param {number} round
 * @returns {string}
 */
function recordForFire(dir, phaseRaw, trigger, plan, sha, round) {
  if (typeof trigger !== 'string' || !RECORD_TOKEN.test(trigger)) return '';
  /** @type {string[]} */
  let homes = [];
  if (String(phaseRaw) !== '0') {
    homes = [join(dir, 'phases', String(phaseRaw))];
  } else {
    // lstat tasks/ itself before the walk, as fireHome does at the write face: readdirSync follows a symlinked directory, so a symlinked tasks would be enumerated outside the planning tree and the recount would compare a receipt against a record from elsewhere
    // each entry gets the same bar from the dirent's isDirectory, which reads as lstat does and answers false for a symlink to a directory
    const troot = join(dir, 'tasks');
    let root = null;
    try { root = lstatSync(troot); } catch { /* no tasks/ is no candidate */ }
    if (root && root.isDirectory()) {
      try {
        homes = readdirSync(troot, { withFileTypes: true })
          .filter((d) => d.isDirectory()).map((d) => join(troot, d.name));
      } catch { homes = []; }
    }
  }
  /** A regular file at `name` under `home`, or ''. A symlink isn't a record: every reader after it would follow it out of the tree. */
  const regular = (home, name) => {
    const file = join(home, name);
    try { return lstatSync(file).isFile() ? file : ''; } catch { return ''; }
  };

  const planKey = plan === undefined || plan === null ? '' : String(plan).trim();
  if (planKey) {
    const discriminator = `plan-${planKey}`;
    // refused here as the writer refuses it: a discriminator outside this grammar names no record the writer could have written
    if (!RECORD_TOKEN.test(discriminator)) return '';
    const name = recordName(trigger, discriminator, round);
    const found = homes.map((home) => regular(home, name)).filter(Boolean);
    return found.length === 1 ? found[0] : '';
  }

  const head = typeof sha === 'string' ? sha.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{7,40}$/.test(head)) return '';
  const prefix = `ADJUDICATION-${trigger}-`;
  const suffix = round > 1 ? `-r${round}.json` : '.json';
  /** @type {{home: string, name: string}[]} */
  const hits = [];
  for (const home of homes) {
    /** @type {string[]} */
    let names = [];
    // continue and never return: an unreadable home is one candidate source that answered nothing, and on the task arm the others are still to come
    try { names = readdirSync(home); } catch { continue; }
    for (const name of names) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      const discriminator = name.slice(prefix.length, name.length - suffix.length);
      // at round 1 the suffix is a bare .json that every higher round's file also ends with, so a -r<n> tail is another round's record
      if (round === 1 && /-r\d+$/.test(discriminator)) continue;
      // the discriminator's last segment is the short head sha, compared as a prefix in whichever direction is shorter since the receipt may spell the head 7-char or full
      const tail = discriminator.slice(discriminator.lastIndexOf('-') + 1).toLowerCase();
      if (tail.length >= 7 && (head.startsWith(tail) || tail.startsWith(head))) {
        hits.push({ home, name });
      }
    }
  }
  // counted as names and filtered through regular only once one stands alone, the order the single-home walk takes: dropping symlinks first would turn an ambiguous pair into a confident single, the guess this function exists not to make
  return hits.length === 1 ? regular(hits[0].home, hits[0].name) : '';
}

/**
 * Do this receipt's settled figures agree with the rulings in its fire's own record?
 * Asked here because the `adjudication` seam derives the three figures and they're copied onto the receipt by hand, so this is where a mistyped one enters, and once appended the trace and the record disagree with nothing saying which is right. Recounting at write time makes the survivor count recomputable and not asserted.
 * Only when all three are present: a partial set can't be checked against a recount that answers all three, and refusing on one would refuse a shape nothing writes.
 * An absent record omits the check (a fire predating the format, or an advisory arm that wrote none). The trace is gitignored, so it's the local cross-check and the committed record is the custody artifact; a receipt that couldn't be cross-checked isn't thereby wrong.
 * Absent means absent from the two homes `recordForFire` reads, `phases/<N>/` and the task's `tasks/<slug>/`. A fire `deferred carry` moved into `deferred/<N>/` takes this omission by design: the writer widened to that home so a carried finding could still be ruled on, and widening the recount would compare a receipt against a record it may not be for. So a carried fire's counts stay self-asserted, stated and not accidental.
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
    // refused and not skipped: the seam wrote this file as one atomic JSON object, so unparseable means truncated or edited, the tampering the cross-check exists to surface
    // the parse error isn't quoted back, since the detail names the file and that's all a caller acts on, and echoing a caught message is what the redaction census in planning.test.mjs counts
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

/**
 * Does this receipt account for a halt the record says a person cleared?
 * Asked here and only here: `trace append` is the one place where a fire's receipt and its adjudication record are both in hand under a proved key (`recordForFire` resolves it from the same flags the writer used). `risk-check status` reads no records and the `adjudication` seam runs before the receipt exists.
 * It's the contradiction and not an event name. A record holding a survived blocker or high marked `overridden: true` is a halting finding that stood with no commit behind it, and a receipt settling that range while saying nothing reads as a clean settle, with the cleared halt left in a record nobody has to open. The refusal never keys to an event name, because this seam carries no runtime refusal keyed to one and the first would be read as drift and deleted.
 * Whenever any settled figure is present, unlike the recount: this recounts nothing, and the all-three precondition would let a caller discharge the marker by dropping one figure. `rearm` and `deferral` carry none, so they're out of scope without being named.
 * An absent record omits the check, as `recordForFire` and the recount declare, and a fire carried into `deferred/<N>/` clears it by resolving nothing, the same stated posture as the recount.
 * An unreadable record is refused, and that's not the same case as absent: absent is a record nobody wrote, unreadable is one somebody changed. Passing there would hand back the discharge the any-figure rule closes by a second route, since the recount only refuses a bad record once all three figures are present. A receipt that carries a reason is answered before the file is opened, because it has already accounted for whatever the record holds.
 * Accounting for it means the user's own words on the receipt (`--detail-file`, the override transport), and `risk-check` already refuses an empty one, so the test is just whether a reason is there.
 * @param {string} dir @param {string|number} phaseRaw
 * @param {{trigger: string|undefined, plan: any, sha: any, round: number,
 *   settled: Record<string, number>, reason: any}} fire
 * @returns {{ok: boolean, reason: string, detail: string, hint: string}}
 */
function overrideAccounted(dir, phaseRaw, fire) {
  const pass = { ok: true, reason: '', detail: '', hint: '' };
  if (!['survivors', 'downgraded', 'refuted'].some((k) => k in fire.settled)) return pass;
  if (typeof fire.reason === 'string' && fire.reason.trim() !== '') return pass;
  const file = recordForFire(dir, phaseRaw, fire.trigger, fire.plan, fire.sha, fire.round);
  if (!file) return pass;
  const rel = relative(dir, file);

  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch {
    // refused and never passed, see the doc above; the caught message isn't quoted back, the detail names the file and echoing a caught message is what the redaction census counts
    return { ok: false, reason: 'bad-record',
      detail: `${rel} exists but is not readable as JSON, so the rulings this receipt settles `
        + 'cannot be read - a record that was truncated or edited may hold a halting finding '
        + 'that STOOD with a person clearing it, and nothing was appended',
      hint: 'restore or re-write the record for this fire and settle the range again - or, if a '
        + 'halt was let stand, carry the reason on --detail-file' };
  }
  const { haltingSurvivors } = unfixedFromEntries(record && record.entries);
  if (haltingSurvivors.length === 0) return pass;
  const n = haltingSurvivors.length;
  return { ok: false, reason: 'unaccounted-override',
    detail: `${rel} holds ${n} finding${n === 1 ? '' : 's'} raised at blocker or high that STOOD `
      + 'with no fix commit, marked as a halt a person cleared, and this receipt settles the '
      + 'range without carrying a reason at all - the record and the receipt contradict each '
      + 'other, so nothing was appended',
    hint: 'settle this range with the user\'s own words on --detail-file, naming why the halt was '
      + 'let stand; or fix the findings and re-write the record so no cleared halt is left in it' };
}

// only cmdTrace is dispatched; cmdTraceIgnore is exported beside it because it's a handler in its own right and the census counts it, and `trace ignore` reaches it through cmdTrace
export { cmdTrace, cmdTraceIgnore };
