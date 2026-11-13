// @ts-check
// planning/trace.mjs - the `trace` family: the joined run record (.planning/records/trace.jsonl) and its .gitignore arm
// both handlers live here: cmdTrace's `ignore` arm calls cmdTraceIgnore, and a split makes it a cross-command import
// everything else serves one of the two, and both mergeLayers callers carry the layer warnings, so no header marker
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import {
  ARGV, DISPATCH_WINDOW_DEFAULTS, RECORD_TOKEN, argRefusal, fail, intFlag, listPlanFiles, ok,
  phaseGuard, read, readReadsRecords, routeLadder,
} from './core.mjs';
import { deriveCounts, recordName } from '../lib/adjudication-record.mjs';
import { CONTRACTS, evaluateFlag } from '../lib/arg-contract.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';
import { unfixedFromEntries } from '../lib/filing-decision.mjs';
import { planTaskTitles } from '../lib/planning-files.mjs';
import { ensureRecordsDir, ensureRecordsIgnore, makeDir, phaseRecordsDir, recordsPath } from '../lib/planning-store.mjs';
import { planFileFor } from '../lib/phase-plans.mjs';
import {
  READS_CLAIM_FILE, READS_EVICT_TEMP_FILE, READS_FILE, READS_ROTATE_TEMP_FILE,
  ROTATED_READS_FILE, inDispatchReads, joinReads,
} from '../lib/read-trace.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { RUNG_ORDER } from '../lib/rung-agent.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';
import { parseAdjudication, suggestFromRender } from '../lib/trace-suggest.mjs';
import { FAMILIES, ROTATED_TRACE_FILE, TRACE_FILE, appendEvent, correlationId, renderTrace } from '../lib/trace.mjs';
import { windowBudget } from '../lib/window-budget.mjs';

// prose writes the lifecycle and outcome events through this seam; scripts with code call lib/trace.mjs directly
// `append` is best effort and says so: a write that didn't happen is ok:true with `written:false` and a reason
// the trace records what a run did and may never change what it does
// the ignore rules that keep the logs out of git live in the records folder's own `.gitignore`, which the write module
// creates with the folder (lib/planning-store.mjs); this arm reports on them and writes that file when it is missing
// `.planning` under the project root is where the rules are asked about, whatever `--dir` says, as it always was
const PLANNING_NAME = '.planning';

/**
 * A log's path under the project root as git is asked about it, with forward slashes.
 * Basenames come from lib/trace.mjs and lib/read-trace.mjs, so a path asked about here and a path written there can't
 * drift; the folder's name comes from the write module.
 * @param {string} base
 */
const logPath = (base) => recordsPath(PLANNING_NAME, base).split(sep).join('/');

/** The live run record's path. `line` in the answer, and the pathspec `traceTracked` asks `ls-files` about. */
const TRACE_IGNORE_LINE = logPath(TRACE_FILE);

/**
 * The generation a rotation at the record's size bound leaves behind.
 * Without it a rotation leaves up to `MAX_TRACE_BYTES` untracked for the next `git add .planning` to sweep up.
 * A second literal, not a glob: `line` is what `/cad-health` reports and `traceTracked` passes as a pathspec.
 */
const ROTATED_IGNORE_LINE = logPath(ROTATED_TRACE_FILE);

/**
 * The reads record's six paths, each a different thing: the live file, the prior generation, the claim sidecar,
 * and the stamps and temps a killed rotation strands (patterns, since they carry a pid and a random suffix).
 * The trace's own `.rotate` and `.evict` temps are left out on purpose; they're the trace's residue.
 */
const READS_IGNORE_LINES = Object.freeze([
  logPath(READS_FILE),
  logPath(ROTATED_READS_FILE),
  logPath(READS_CLAIM_FILE),
  `${logPath(READS_CLAIM_FILE)}.*`,
  `${logPath(READS_ROTATE_TEMP_FILE)}.*`,
  `${logPath(READS_EVICT_TEMP_FILE)}.*`,
]);

/**
 * Does a `check-ignore -v` match source travel with the repository?
 * That's why `-v`, not `-q`: `check-ignore` also reads `core.excludesFile` and `.git/info/exclude`, neither cloned.
 * A machine-local exclusion says `ignored:true` and a clone commits the run record. Only a root `.gitignore` counts.
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
 * Git's own answer about the ignore line, with the matching source, or `method: 'file'` when git can't answer at all.
 * Exit 1 from `check-ignore` is data (nothing matched); only a harder failure falls back.
 * `--no-index` is load-bearing: without it an indexed path reports nothing and the line was appended on every run.
 * Tracked is `traceTracked`'s separate question.
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
  // output is `<source>:<line>:<pattern>`, a tab, the path; split from the right so a colon inside the source survives
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
 * The literal fallback: does the records folder's `.gitignore` carry the rule for `path`, or does the root one carry
 * the path itself? Comments and blank lines skipped.
 * Used only when git couldn't answer, since it can't see a wholesale `.planning/` ignore, which is why git goes first.
 * @param {string} root
 * @param {string} path the ignore rule to look for, as a repo-relative path
 */
function gitignoreCarriesLine(root, path) {
  const wanted = [
    [join(root, '.gitignore'), [path, `/${path}`]],
    [recordsPath(join(root, PLANNING_NAME), '.gitignore'), [`/${basename(path)}`, basename(path)]],
  ];
  return wanted.some(([file, lines]) => {
    const text = read(/** @type {string} */ (file));
    if (text === null) return false;
    return text.split('\n').some((raw) => {
      const line = raw.trim();
      return line && !line.startsWith('#') && /** @type {string[]} */ (lines).includes(line);
    });
  });
}

/**
 * `trace ignore` - the scaffold-time writer of the ignore line, and the read-only reporter `/cad-health` runs.
 * `ignored` and `tracked` are the state as found, before any write; `written` says what this call changed.
 * `--check` writes nothing: `/cad-health` reports on projects it didn't create and may not edit their `.gitignore`.
 * `/cad-new-project` writes the line at scaffold time, so an older project gets reported, not edited underneath.
 * @param {string} root @param {any} opts
 */
function cmdTraceIgnore(root, opts) {
  if (!existsSync(root)) {
    return fail('no-root', `${root} not found`,
      'point --root at the PROJECT root, the directory holding .gitignore - it is deliberately not'
      + ' --dir, which names .planning/');
  }
  const planning = join(root, PLANNING_NAME);
  const file = recordsPath(planning, '.gitignore');
  const git = gitIgnoreState(root, TRACE_IGNORE_LINE);
  const live = git.method === 'git' ? git.travels : gitignoreCarriesLine(root, TRACE_IGNORE_LINE);
  // the sibling is asked separately; covering the record but not its rotated generation is a half-covered state
  const rotatedGit = gitIgnoreState(root, ROTATED_IGNORE_LINE);
  const rotated = rotatedGit.method === 'git'
    ? rotatedGit.travels
    : gitignoreCarriesLine(root, ROTATED_IGNORE_LINE);
  // the reads rules go through the same readers one at a time: git first, the literal scan only where git can't answer
  const missingReads = READS_IGNORE_LINES.filter((rule) => {
    const g = gitIgnoreState(root, rule);
    return !(g.method === 'git' ? g.travels : gitignoreCarriesLine(root, rule));
  });
  const common = {
    root,
    file,
    // `line` stays the live record's literal so /cad-health's `ignored` and `tracked` readings don't change
    line: TRACE_IGNORE_LINE,
    rotated_line: ROTATED_IGNORE_LINE,
    // its own field, never folded into `line`, which `traceTracked` hands to `ls-files --error-unmatch` as a pathspec
    reads_lines: [...READS_IGNORE_LINES],
    ignored: live && rotated && missingReads.length === 0,
    tracked: traceTracked(root),
    method: git.method,
    ...(git.source ? { source: git.source } : {}),
  };
  if ('check' in opts) return ok({ ...common, written: false });
  // already covered by lines that travel, which is what makes a re-run safe
  if (common.ignored) return ok({ ...common, written: false, reason: 'already-ignored' });

  // the records folder carries its own file, so the write is the write module's: the folder, then the file if none is
  // there. An existing file is never edited, hand-written rules included; that is reported, not repaired
  const had = existsSync(file);
  makeDir(planning);
  const records = ensureRecordsDir(planning);
  if (!records.ok) {
    return fail(records.reason, `the records folder could not be prepared under ${planning}`,
      'a symlinked records folder is refused: replace it with a real directory and re-run `trace ignore`');
  }
  ensureRecordsIgnore(planning);
  if (had) return ok({ ...common, written: false, reason: 'records-gitignore-kept' });
  return ok({ ...common, written: existsSync(file) });
}

/**
 * What `suggest` falls back to for the keys its rules name when no layer holds one, where the schema default is real.
 * A key defaulting to `null` stays out: `null` means "no layer pins this", and the suggestion reports it as unset.
 * `config.schema.json` is the source of truth and this map isn't parsed from it. Change one place and not the other and
 * `/cad-suggest` prints a `current` that disagrees with `/cad-config`, which `prose-agreement.test.mjs` fails on.
 */
const SUGGEST_KEY_DEFAULTS = Object.freeze({
  'workflow.max_plan_tasks': 8,
  'review.reviewers': ['claude-subagent'],
});

/**
 * The task count of the plan a `cad-executor` checkpoint names, or null (unknown, never under-ceiling).
 * Unknown is the common case: a worker key like `1-cut` names no file, and an archived or deleted cycle has no dirs.
 * `phase` goes through `requirePhaseArg` as a traversal guard: it comes off a record line and becomes a path part.
 * `plan` needs none, it's only compared against `readdirSync` entries.
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
 * What the pure rules in `lib/trace-suggest.mjs` need: the config behind each key the events reach, plus the ladders.
 * Resolved here because that file is pure and owns the rules; this owns the reads.
 * Keyed off the record, not the schema's key space: a trigger that never fired is a key no rule can name.
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
      if (typeof e.role === 'string' && e.role) set(`roles.${e.role}.effort`, config?.roles?.[e.role]?.effort);
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint' && e.role === 'cad-executor') {
      checkpointTasks.push(checkpointPlanTasks(dir, e));
    }
  }
  set('review.reviewers', config?.review?.reviewers ?? SUGGEST_KEY_DEFAULTS['review.reviewers']);
  set('workflow.max_plan_tasks',
    config?.workflow?.max_plan_tasks ?? SUGGEST_KEY_DEFAULTS['workflow.max_plan_tasks']);
  // the gate ladder, weakest first: `routeLadder` owns the read and why the env override isn't honoured
  // an unreadable schema means no ladder, so the gate arm omits `proposed`, and nothing is substituted from memory
  const gates = routeLadder('gates');
  // the rung rule compares its target against the rung a config layer set
  return { values, ...(gates ? { gates } : {}), rungs: [...RUNG_ORDER], checkpointTasks };
}

// the grammar the shared `trace append|close` body judges string flags by, read off arg-contract, not restated below
// unioned because one body validates both: `trace close` declares no `--sha`, `--base`, `--step` or `--trigger`
const TRACE_GRAMMAR = {
  ...CONTRACTS['planning.mjs']['trace append'],
  ...CONTRACTS['planning.mjs']['trace close'],
};

// flags whose whole rule is the value grammar, in read order: the first three `fallback`, the rest `refuse`
const TRACE_STRING_FLAGS = ['--plan', '--sha', '--base', '--role', '--step', '--reviewer',
  '--trigger', '--agent-id', '--anchor', '--authorization-id'];

// the `--duration-ms` grammar: a plain integer of milliseconds or the host's rendering (`1m 23s`, `1h2m3s`, `450ms`)
// `ms` comes first in the alternation or `m` swallows the `m` of `450ms` and reads 450 minutes plus a stray `s`
// closed and not free text because this is a caller-derived figure and not prose, so it needs no `-file` transport
// null means malformed and nothing is appended; the safe-integer test keeps `9999999999999999999h` from writing a float
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

// provider spend is one summed figure and a call count, not hundreds of `provider/request` objects in a model's context
// its own denomination, never added to `roles`: wire tokens and the host's final-window figure aren't the same unit
// a call with no usage raises `unrecorded` and adds no zero, or older events would price a cycle's reviews at nothing
// only `command === 'review'` that reached the wire is priced; a refused call cost nothing, a degraded one did
// UNSENT_OUTCOMES is read back from review-provider, not imported: a missing reason shows as unrecorded, the safe way

/**
 * The `outcome` values `review-provider.mjs` writes for a call it refused before the request was sent.
 * No bytes on the wire, so no spend to price and no call to count.
 */
const UNSENT_OUTCOMES = new Set([
  'bad-provider', 'bad-args', 'no-key', 'bad-payload', 'over-cap',
]);

/**
 * One token count off a provider event, or undefined where the line carries something that isn't one.
 * The trace is a file, so a hand-edited line mustn't get string-concatenated onto a numeric total.
 * @param {any} v @returns {number|undefined}
 */
function usageCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/**
 * The provider-spend fold for a set of scoped events, spread into the response.
 * `calls` counts `review` events not refused before sending; other provider events stay visible in `counts.provider`.
 * @param {Record<string, any>[]} events the events already scoped to `--phase`
 * @returns {{provider_spend?: {calls: number, tokens?: number, unrecorded?: number}}}
 */
function providerSpend(events) {
  let calls = 0;
  let priced = 0;
  let tokens = 0;
  for (const e of events) {
    if (e.family !== 'provider') continue;
    // a review that was actually sent: other commands here cost real money but aren't what this figure says it counts
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
      // only when a figure landed, as `roles.tokens` is: all-silent calls say `unrecorded`, never `0`
      ...(priced ? { tokens } : {}),
      ...(unrecorded ? { unrecorded } : {}),
    },
  };
}

function cmdTrace(dir, sub, opts) {
  if (sub === 'ignore') {
    // --root is the PROJECT root, not --dir: git is asked about the project's own .planning/records/ paths
    // a --root with nothing usable is refused at the door, or it would edit the cwd's tree, not the caller's (#42/#45)
    return cmdTraceIgnore(typeof opts.root === 'string' ? opts.root : process.cwd(), opts);
  }
  // close is append minus two fields a site used to restate, so one body validates every flag
  if (sub === 'append' || sub === 'close') {
    // collision check right after the parse: append and close reach a phases/ path, so a clash recounts another phase
    // suggest, render and window only filter the trace record and resolve no directory
    const parsedPhase = phaseGuard(`trace ${sub}`, dir, opts.phase, `trace ${sub} needs --phase <N>`,
      `pass --phase <N> for the phase this event belongs to, then re-run the ${sub} - nothing was`
      + ' appended, so exactly one event lands',
      `re-run the ${sub} with one of the two spellings the detail names - nothing was appended`);
    if (!parsedPhase) return;
    // --detail-file is the safe transport for a derived detail (a verdict, a checkpoint's reason); see text-flag-file
    // resolved before the close inference reads the detail, or every converted checkpoint would bill as a clean return
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
      // fixed, never read off the caller: a close site says what it closes, not how the record spells it
      family = 'lifecycle';
      // inferred from --detail, never --tokens: some checkpoints carry none, and a token classifier bills them as clean
      // escalation stays out of the inference: no prose producer, and `trace append --event escalation` reaches it
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

    // --tokens is what the dispatch cost; malformed is refused, since a dropped field renders the role unrecorded
    // 146,405 is accepted because the plugin prints figures grouped, and refusing it strands the worker unpaired
    // grouping is stripped only in the strict 3-digit shape, so 1,2,3 and 146,40 are still refused
    let tokens;
    if ('tokens' in opts) {
      const raw = typeof opts.tokens === 'string' && /^\d{1,3}(?:,\d{3})+$/.test(opts.tokens.trim())
        ? opts.tokens.trim().replace(/,/g, '')
        : opts.tokens;
      const parsed = intFlag(raw, 0, `trace ${sub} --tokens needs a non-negative integer`,
        "copy the token figure off the worker's return as a whole number - grouped as this plugin"
        + ' prints it (146,405) or plain; nothing was appended, so a corrected re-run writes'
        + ' exactly one event');
      if (!parsed.ok) return;
      tokens = parsed.value;
    }

    // --turns is the tool-call count off the same return; tokens alone can't price a run (bill is turns times window)
    // structured, never parsed out of --detail, which isn't a machine-join surface (one trigger got spelled four ways)
    // validated like --raised, with no comma-grouping exception since a call count is never printed grouped
    let turns;
    if ('turns' in opts) {
      const parsed = intFlag(opts.turns, 0, `trace ${sub} --turns needs a non-negative integer`,
        "copy the tool-call count off the worker's return as a plain whole number, ungrouped;"
        + ' nothing was appended, so a corrected re-run writes exactly one event');
      if (!parsed.ok) return;
      turns = parsed.value;
    }

    // --duration-ms is how long the dispatch itself took; the dispatch-to-close span includes the orchestrator's time
    // it takes the host's spelling (1m 23s), the only one an orchestrator can copy, or the worker is stranded unpaired
    // anything outside parseDurationMs's grammar is refused with nothing appended, like --tokens and --turns
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

    // --raised counts findings before adjudication: 0 of 0 found nothing, 0 of 9 refuted every one
    // structured, since a figure parsed back out of --detail prose can't be trusted
    // validated like --tokens, with no comma-grouping exception since a finding count is never printed grouped
    let raised;
    if ('raised' in opts) {
      const parsed = intFlag(opts.raised, 0, `trace ${sub} --raised needs a non-negative integer`,
        'send the number of findings the reviewers raised before adjudication as a plain whole'
        + ' number, ungrouped; nothing was appended');
      if (!parsed.ok) return;
      raised = parsed.value;
    }

    // --survivors / --downgraded / --refuted are the settled figures of a fire, the other side of --raised
    // validated like --raised, with no comma-grouping exception
    // omitted when absent, but a real --survivors 0 records 0: an uncounted fire isn't one that counted zero
    const settled = {};
    for (const flag of ['survivors', 'downgraded', 'refuted']) {
      if (!(flag in opts)) continue;
      const parsed = intFlag(opts[flag], 0, `trace ${sub} --${flag} needs a non-negative integer`,
        `send --${flag} as a plain whole number, ungrouped - the settled figures come off the`
        + " adjudication seam's own return rather than being typed; nothing was appended");
      if (!parsed.ok) return;
      settled[flag] = parsed.value;
    }

    // --round names the re-arm round: without it a settle resolves round one's record and checks stale rulings
    // absent means round 1 on both sides, so the write and receipt sides resolve one filename by one rule
    let round = 1;
    if ('round' in opts) {
      const parsed = intFlag(opts.round, 1,
        `trace ${sub} --round needs the re-arm round after it, a whole number of at least 1`,
        'send --round as the re-arm round this event belongs to - 2 for the first re-arm - or'
        + ' leave it off for an ordinary round-1 fire; nothing was appended');
      if (!parsed.ok) return;
      round = parsed.value;
    }

    // --read is the read-set the worker was made to read, one comma-separated value split like phase-done --reqs
    // not a repeatable flag: parseArgs keeps only the last, so --read a --read b would silently drop rows
    // an element is any verbatim string (path, glob, <base>..<head>), stored unchecked; readers resolve each by kind
    // --read-file is the same value through the path transport, split and refused by the same rules
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
      // bare, empty or all-blank is almost always an unset "$PATHS", and a read-less dispatch must not look complete
      if (!list.length) {
        return fail('bad-args',
          `trace ${sub} --read${'read-file' in opts ? '-file' : ''} needs a comma-separated path list`,
          'list what this site caused the worker to read as one comma-separated value - paths,'
          + ' globs, or a <base>..<head> range - or leave the flag off; a bare one is almost always'
          + ' an unset "$PATHS", and nothing was appended');
      }
      read = list;
    }

    // the string flags, each read through its declared row: the one place the two bare-flag dispositions are decided
    // --plan, --sha and --base fall back to absent so older trace closes keep answering ok:true; the others refuse
    // --role refuses because a bare one wrote a line with no role key, aggregated under the empty string
    // --reviewer is who ran the fire, and this mark is the only enforcement against one outside the resolved set
    // a bare flag parses as boolean true in parseArgs, which is why the read is against ARGV
    const flags = {};
    for (const flag of TRACE_STRING_FLAGS) {
      const parsedFlag = evaluateFlag(ARGV, flag, TRACE_GRAMMAR[flag]);
      // same flag-to-sentence map as the dispatch door, so a bare --role answers the same whichever refuses it first
      if (!parsedFlag.ok) {
        return fail('bad-args', argRefusal(`trace ${sub}`, flag),
          'give the flag the detail names a value, or leave it off entirely - nothing was appended,'
          + ' so a corrected re-run writes exactly one event');
      }
      flags[flag] = parsedFlag.value;
    }
    // trimmed for the four that refuse: a stored name is a join key and " cad-executor " mustn't be a second role
    const trimmed = (flag) => (flags[flag] === undefined ? undefined : String(flags[flag]).trim());
    const step = trimmed('--step');
    const reviewer = trimmed('--reviewer');
    const trigger = trimmed('--trigger');
    const agentId = trimmed('--agent-id');

    // --anchor names an earlier window: correlationId derives from the newest phase_start, so after a re-anchor
    // a settlement was stamped with the new window and could never settle the old fire
    // renderEvent already prefers an explicit non-empty corr on the event, so the fix is just a flag that supplies one
    // it carries that window's anchor SHA, never a whole correlation id, so a receipt only names its own phase's window
    // no key when the flag is absent, so existing calls derive as before
    const anchor = trimmed('--anchor');
    const corr = anchor === undefined
      ? undefined
      : correlationId(dir, parsedPhase.raw, anchor);

    // the human answer this receipt descends from: one authorization over two ranges is two receipts, now linked
    // minted by the coordinator, not hashed from the reason text: grouping by exact --detail missed distinct wordings
    // trimmed like the other refusing flags; the key rides the event only when the flag was given
    // not keyed to the override event name: the seam is event-agnostic, and the prose holds that rule
    const authorizationId = trimmed('--authorization-id');

    // the settled figures are typed in by hand, so the record is recounted here and a disagreeing figure refused
    // an absent record skips the check (an old fire, an advisory arm), or those fires would be unrecordable here too
    // one lookup and one parse of the fire's record, shared by both checks and made only if one of them needs it
    const loadRecord = fireRecordLoader(dir, parsedPhase.raw, {
      trigger, plan: flags['--plan'], sha: flags['--sha'], round,
    });
    const recount = recountReceipt(loadRecord, { round, settled });
    if (!recount.ok) return fail(recount.reason, recount.detail, recount.hint);

    // second check over the same record: a receipt settling a range a person cleared past a blocking halt must say why
    const override = overrideAccounted(loadRecord, { settled, reason: detail });
    if (!override.ok) return fail(override.reason, override.detail, override.hint);

    // nothing below is coupled to an event name, so return, checkpoint and escalation store tokens identically
    // the no --role, no --tokens rule for coordinator markers is held by prose and trace.test.mjs, not a runtime check
    const res = appendEvent(dir, {
      // the caller's spelling is what separates 1.10 from 1.1; normalized, both phases shared one trace key and corr id
      // lib/trace.mjs stringifies both sides of every comparison, so older traces keep working
      phase: parsedPhase.raw,
      family,
      event,
      // present only when --anchor named an earlier window; absent, renderEvent derives as always
      ...(corr === undefined ? {} : { corr }),
      // no guard here: the loop above already applied each disposition, so absent and fallback both arrive undefined
      ...(flags['--plan'] === undefined ? {} : { plan: flags['--plan'] }),
      ...(flags['--sha'] === undefined ? {} : { sha: flags['--sha'] }),
      // --base beside --sha: two ranges can share a head and differ at the base, so a receipt names both ends
      ...(flags['--base'] === undefined ? {} : { base: flags['--base'] }),
      ...(typeof detail === 'string' && detail ? { detail } : {}),
      ...(trimmed('--role') === undefined ? {} : { role: trimmed('--role') }),
      ...(tokens === undefined ? {} : { tokens }),
      // omitted when the return carried no count, never sent as 0, which would claim a dispatch with no tools
      ...(turns === undefined ? {} : { turns }),
      // omitted like --turns, and spelled duration_ms because the provider events already spell it that way
      ...(durationMs === undefined ? {} : { duration_ms: durationMs }),
      ...(raised === undefined ? {} : { raised }),
      // each key only when its flag was: a fire nobody counted stays distinguishable from one that counted zero
      ...settled,
      // only when the caller named a round: an ordinary fire is round 1 by omission, not a re-arm field on every event
      ...('round' in opts ? { round } : {}),
      ...(read === undefined ? {} : { read }),
      ...(step === undefined ? {} : { step }),
      ...(reviewer === undefined ? {} : { reviewer }),
      // a dispatch that committed nothing because HEAD already satisfied its tasks, or cost reads count it as execution
      // present only when true, like every optional field here
      ...(opts.replay === true ? { replay: true } : {}),
      ...(trigger === undefined ? {} : { trigger }),
      // the worker's host id, so SubagentStop can tell a closed worker from a running one; dispatch predates it
      ...(agentId === undefined ? {} : { agent_id: agentId }),
      // the authorization a settle descends from, so a second range under one answer isn't read as a duplicate write
      // it only labels: risk-check status still wants each fired record's own receipt, so a shared id settles nothing
      ...(authorizationId === undefined ? {} : { authorization_id: authorizationId }),
    });
    return ok({
      written: res.written,
      ...(res.corr ? { corr: res.corr } : {}),
      ...(res.reason ? { reason: res.reason } : {}),
    });
  }
  if (sub === 'suggest') {
    // config suggestions off the record: the pure rules live in lib/trace-suggest.mjs, this arm owns scope and envelope
    // no --phase means the whole record on purpose: the milestone close is the caller, and it spans every phase
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
    // warnings ride the envelope when non-empty, which every mergeLayers caller owes
    // a torn layer reads every key as unset, so a pinned one would get a suggestion off a value the read never saw
    const { config: suggestConfig, warnings } = mergeLayers(join(dir, 'config.json'));
    // reads.jsonl folds to per-role in-dispatch figures on the render's brackets, so a --phase run scopes itself
    // absent means no entry, never an error or a zero; unreadable means no entry and the file named in warnings
    const readRecord = readReadsRecords(dir);
    const inDispatch = readRecord.status === 'ok'
      ? inDispatchReads(joinReads(readRecord.records, r.brackets).rows)
      : undefined;
    const suggestWarnings = readRecord.status === 'unreadable'
      ? [...warnings, `cannot read ${readRecord.file}; in-dispatch re-reading was not measured`]
      : warnings;
    const suggestions = suggestFromRender(r, suggestResolution(dir, r, suggestConfig), inDispatch);
    return ok({
      // the record these suggestions came off, from the same renderTrace result, so the two can't name different files
      file: r.file,
      scope: phase === undefined ? 'all' : String(phase),
      events_read: r.events.length,
      ...(r.capped ? { capped: true } : {}),
      // the rotation, as on trace render, so fewer events reads as a cut and not a quiet run; capped means the ceiling
      ...(r.rotated ? { rotated: r.rotated } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      // the reads record, on the same nested key `reads` returns, from the readReadsRecords result already held here
      // nested so `rotated` doesn't mean two records: the top-level one above is the trace being cut
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
    // bounded here, not in renderTrace: suggest reads the full array in-process and would price a fraction of the run
    // per-bracket rows plus every outcome event, not a tail-N: a truncated payload makes triage-gate miss a prior rearm
    // and the one-re-arm cap on the only blocking trigger would fail open
    // --events is a presence flag, like --undo at phase-done: "hand me the raw array", no value to get wrong
    const full = 'events' in opts;
    return ok({
      file: r.file,
      corr: r.corr,
      capped: r.capped,
      // only where a rotation marker is present, so the envelope stays byte-identical for a record that never rotated
      ...(r.rotated ? { rotated: r.rotated } : {}),
      counts: r.counts,
      ...(Object.keys(r.roles).length ? { roles: r.roles } : {}),
      // only when there's something to say, like roles: a zeroed block would read as a coordinator that spent nothing
      ...(r.coordinator ? { coordinator: r.coordinator } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      ...(full
        ? { events: r.events }
        : {
          brackets: r.brackets,
          outcomes: r.events.filter((e) => e.family === 'outcome'),
          // the third bounded projection; --events is an either/or, so the raw-array caller folds the spend itself
          ...providerSpend(r.events),
        }),
      unpaired: r.unpaired,
      // only when there's something to say, so a clean trace stays byte-identical for existing readers
      // a bracket closed under a role its dispatch didn't name is a prose defect: reported here, billed nowhere
      ...(r.mismatched.length ? { mismatched: r.mismatched } : {}),
    });
  }
  if (sub === 'window') {
    // scoped like render and suggest: no --phase is the whole record, since a ceiling is argued off many dispatches
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
    // warnings ride the envelope when non-empty, as every mergeLayers caller owes
    // a torn layer reads every ceiling as unset, so a project that raised one sees its crossings come back unexplained
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
      // the record the crossings were read from; a finding that can't name its source is just a number
      file: r.file,
      ceilings,
      problems: w.problems,
      // stated at zero, not omitted like render's conditional keys: an absent count would read as none
      compared: w.compared,
      unbudgeted: w.unbudgeted,
      unrecorded: w.unrecorded,
      ...(warnings.length ? { warnings } : {}),
    });
  }
  return fail('usage', 'trace <append|close|render|suggest|window|ignore>');
}

/**
 * The record a receipt settles, as an absolute path, or '' (never a throw) when none can be resolved.
 * A per-plan fire resolves by `plan-<k>`; every other fire matches the directory on trigger, round and head prefix.
 * Two candidates answer '', not a guess: a check that might read another fire's rulings refuses a correct receipt.
 * Homes by phase: `phases/<N>/records/`, or every `.planning/tasks/<slug>/` for a task's 0, since a receipt carries no slug.
 * `deferred/<N>/` is deliberately left out (see fireHome); `trigger` goes through RECORD_TOKEN before `join`.
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
    homes = [phaseRecordsDir(join(dir, 'phases', String(phaseRaw)))];
  } else {
    // lstat tasks/ first, as fireHome does: readdirSync follows a symlink and would walk outside the planning tree
    // each entry's isDirectory reads as lstat does, so a symlink to a directory is false
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
  /** A regular file at `name` under `home`, or ''. A symlink isn't a record, and later readers would follow it out. */
  const regular = (home, name) => {
    const file = join(home, name);
    try { return lstatSync(file).isFile() ? file : ''; } catch { return ''; }
  };

  const planKey = plan === undefined || plan === null ? '' : String(plan).trim();
  if (planKey) {
    const discriminator = `plan-${planKey}`;
    // refused as the writer refuses it: a discriminator outside this grammar names no record it could have written
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
    // continue, never return: an unreadable home answered nothing, and the task arm still has other homes to try
    try { names = readdirSync(home); } catch { continue; }
    for (const name of names) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      const discriminator = name.slice(prefix.length, name.length - suffix.length);
      // at round 1 the bare .json suffix also ends every higher round's file, so a -r<n> tail is another round's record
      if (round === 1 && /-r\d+$/.test(discriminator)) continue;
      // the last segment is the short head sha, compared as a prefix either way: a receipt may spell it 7-char or full
      const tail = discriminator.slice(discriminator.lastIndexOf('-') + 1).toLowerCase();
      if (tail.length >= 7 && (head.startsWith(tail) || tail.startsWith(head))) {
        hits.push({ home, name });
      }
    }
  }
  // count names first and run regular only on a lone hit: dropping symlinks first would turn a tie into a guess
  return hits.length === 1 ? regular(hits[0].home, hits[0].name) : '';
}

/**
 * The fire's record file, looked up and parsed on the first call and remembered for the second.
 * `null` is an absent record. An unreadable one comes back with `record: undefined` and the file's name, so each check
 * words its own refusal; the parse error isn't quoted back, since the redaction census counts echoes.
 * @param {string} dir @param {string|number} phaseRaw
 * @param {{trigger: string|undefined, plan: any, sha: any, round: number}} fire
 * @returns {() => {rel: string, record: any, readable: boolean}|null}
 */
function fireRecordLoader(dir, phaseRaw, fire) {
  /** @type {{rel: string, record: any, readable: boolean}|null|undefined} */
  let loaded;
  return () => {
    if (loaded !== undefined) return loaded;
    const file = recordForFire(dir, phaseRaw, fire.trigger, fire.plan, fire.sha, fire.round);
    if (!file) return (loaded = null);
    const rel = relative(dir, file);
    try {
      return (loaded = { rel, record: JSON.parse(readFileSync(file, 'utf8')), readable: true });
    } catch {
      return (loaded = { rel, record: undefined, readable: false });
    }
  };
}

/**
 * Do this receipt's settled figures agree with the rulings in its fire's own record?
 * The `adjudication` seam derives the three figures and they're copied by hand, so a mistyped one enters here.
 * Only when all three are present: a partial set can't be checked against a recount that answers all three.
 * An absent record omits the check (a fire predating the format, or an advisory arm that wrote none).
 * A fire `deferred carry` moved to `deferred/<N>/` is absent by design, so its counts stay self-asserted.
 * @param {ReturnType<typeof fireRecordLoader>} loadRecord
 * @param {{round: number, settled: Record<string, number>}} fire
 * @returns {{ok: boolean, reason: string, detail: string, hint: string}}
 */
function recountReceipt(loadRecord, fire) {
  const keys = ['survivors', 'downgraded', 'refuted'];
  const pass = { ok: true, reason: '', detail: '', hint: '' };
  if (!keys.every((k) => k in fire.settled)) return pass;
  const loaded = loadRecord();
  if (!loaded) return pass;
  const { rel, record } = loaded;

  if (!loaded.readable) {
    // refused, not skipped: the seam wrote one atomic JSON object, so unparseable means truncated or edited
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
 * A survived blocker or high marked `overridden: true` stood with no commit; settling it silently reads as clean.
 * It runs on any settled figure, unlike the recount, or dropping one figure would discharge the marker.
 * Absent omits the check, but unreadable is refused: nobody wrote the first, somebody changed the second.
 * A receipt carrying a reason (`--detail-file`) is answered before the file is opened.
 * @param {ReturnType<typeof fireRecordLoader>} loadRecord
 * @param {{settled: Record<string, number>, reason: any}} fire
 * @returns {{ok: boolean, reason: string, detail: string, hint: string}}
 */
function overrideAccounted(loadRecord, fire) {
  const pass = { ok: true, reason: '', detail: '', hint: '' };
  if (!['survivors', 'downgraded', 'refuted'].some((k) => k in fire.settled)) return pass;
  if (typeof fire.reason === 'string' && fire.reason.trim() !== '') return pass;
  const loaded = loadRecord();
  if (!loaded) return pass;
  const { rel, record } = loaded;

  if (!loaded.readable) {
    // refused, never passed, as above
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

// only cmdTrace is dispatched; cmdTraceIgnore is exported beside it, though nothing imports it and no census names it
// fireRecordLoader is risk-check run's too: a carry reads its source fire's record by the same lookup a receipt does
export { cmdTrace, cmdTraceIgnore, fireRecordLoader };
