#!/usr/bin/env node
// @ts-check
// planning.mjs - the .planning state-machine seam. Deterministic reads and
// writes of the planning file set, so workflow prose keeps judgment and this
// script keeps invariants. The JSON shapes asserted in planning.test.mjs ARE
// the interface contract; there is no spec file beyond them.
//
// Seam contract (shared with route/config/review-provider):
//   - exactly ONE JSON object on stdout; {ok:true,...} exit 0,
//     {ok:false, reason, detail?, hint?} exit 1 (hint = recovery command).
//   - never blocks the spine: every parse problem degrades to ok:false.
//   - --dir <path> overrides the default `.planning` (hermetic-test hook).
//   - output is deterministic (phases sorted, fixed key order) and compact
//     (empty arrays / absent optionals are omitted). Fields are additive-only.
//
// Subcommands (this file grows by dispatch-table entry, never by if-chain):
//   status                          derived phase states + cursor + drift
//   cursor get                      parse the STATE.md 4-line cursor
//   cursor set --phase N --status s --next cmd [--name s] [--total N]
//                                   canonical overwrite; derives name/total
//                                   from ROADMAP when omitted; stamps today
//   plan-overlap --phase N          pairwise intersection of the phase's
//                                   plans' declared file lists (parallel gate)
//   cite-count --phase N [--payload <file>] [--point planned|committed]
//                                   the read-back count: how many of the prior
//                                   decisions, captures and deviations the
//                                   memory pass surfaced does that phase's
//                                   PLAN*.md actually cite, per item and per
//                                   kind. --payload is the surfaced set as a
//                                   FILE (the envelope the planner was handed);
//                                   --point names which of the two count points
//                                   is being recorded. REPORTS and never gates,
//                                   and WRITES: the pair it answers with is
//                                   appended onto .planning/trace.jsonl as an
//                                   outcome event, so the rate is readable
//                                   across phases and not only in the session.
//                                   `trace: {written, reason?}` on the envelope
//                                   is the only place a dropped record is said
//   seed-reqs --phase N             insert Traceability rows for a phase's
//                                   plan-declared, ## Active-bounded req ids
//   criteria-coverage               every CONTEXT `## Acceptance criteria` id
//                                   against its phase's UAT items, both
//                                   directions; uncovered and
//                                   fieldless-checklist break, untraced and
//                                   legacy {phase, reason} report
//                                   (references/acceptance-criteria.md)
//   criteria-size [--phase N] [--context-min N] [--context-max N]
//                 [--roadmap-min N] [--roadmap-max N]
//                                   the criteria-count ceilings three workflows
//                                   state in prose, counted: CONTEXT's
//                                   `## Acceptance criteria` and ROADMAP's
//                                   per-phase criteria list, each against the
//                                   CALLER's literal bounds (no config keys).
//                                   --phase scopes to one; absent walks every
//                                   phase the roadmap declares. A source that
//                                   declared nothing reports *_found:false and
//                                   is never compared, so `within` is null
//                                   when nothing was compared at all
//   task-record --slug <s> --base <ref> --head <ref>
//               [--text "<what shipped>" | --text-file <path>]
//                                   the record a `/cad-task` run leaves:
//                                   .planning/tasks/<slug>/RECORD.md, written in
//                                   the corpus's own grammar so `recall` indexes
//                                   it and `/cad-why` joins a commit back to it.
//                                   The commits table and the declared-files
//                                   line are DERIVED from the range, never
//                                   retyped onto a flag. A slug that is not one
//                                   safe path segment is refused with nothing
//                                   written, and a tree with no planning root
//                                   gets neither one nor a record - `written:
//                                   false` with a reason, ok:true
//   recall "<query>"                BM25 over .planning artifacts (SUMMARY
//                                   deviations and open items, CAPTURE, UAT,
//                                   CONTEXT decisions, ARCHIVE rows, and each
//                                   tasks/<slug>/RECORD.md's `## What shipped`
//                                   bullets); memory.backend-gated.
//                                   Bare words after `recall` are joined into
//                                   one query, so an unquoted multi-word call
//                                   searches all of it, not just the first word
//   lease-check --phase N --plan k  every staged path against that plan's own
//                                   declared files: list (the executor's
//                                   commit-step gate)
//   detect-commands [--root <path>]  the project's own lint/typecheck commands,
//                                   read from its manifests AND offered only
//                                   when their binaries resolve - an
//                                   unreachable arm is null with the tool named
//                                   in warnings[], never a fall-through to a
//                                   lower one (NOT --dir: --root is the
//                                   PROJECT root, one level deep only)
//   detect-surfaces [--root <path>] [--answered <a,b,c>]
//                                   which of the eight risk-surface categories
//                                   the project's STRUCTURE evidences - dirs,
//                                   manifests, file types, never source text
//                                   (NOT --dir: --root is the PROJECT root,
//                                   two levels deep)
//   risk-check run --phase N --base <ref> --head <ref> [--plan k]
//                  [--surfaces <a,b,c>]
//                                   whether a COMMITTED range touched a risk
//                                   surface, recorded on the trace whatever the
//                                   answer - so "the check was skipped" stops
//                                   reading like "it ran and matched nothing".
//                                   --plan is the WORKER key, not a plan
//                                   number: `1-fix` is a key a dispatch is
//                                   bracketed under and is recorded verbatim
//   risk-check status --phase N [--plan k --base <ref> --head <ref>]
//                                   every COMPLETED executor range in that
//                                   phase against the records, refusing by plan
//                                   when one carries none; the optional triple
//                                   requires a record for THAT range, so an
//                                   earlier narrower one does not satisfy it.
//                                   --plan is the same WORKER key `run` takes,
//                                   read through the same grammar; a bracketed
//                                   key that grammar refuses is reported in
//                                   malformed[] rather than demanded in
//                                   missing[], since no run could record it
//   trace append --phase N --family <f> --event <e> [--plan k] [--base b] [--sha s]
//               [--detail "<text>"] [--role <name>] [--tokens <n>]
//               [--read "<a,b,c>"] [--step <name>]
//                                   one line onto .planning/trace.jsonl.
//                                   --role groups the per-role totals (--plan
//                                   stays the pairing key), --tokens is what
//                                   the dispatch cost as a non-negative
//                                   integer, --read is ONE comma-separated
//                                   read-set stored verbatim, --step is the
//                                   workflow step a coordinator marker names
//   trace close --phase N [--plan k] [--role <name>] [--tokens <n>]
//               [--detail "<text>"] [--reviewer <name>]
//                                   the CLOSE half of a worker bracket, in one
//                                   subcommand rather than two restated
//                                   `trace append` spellings per dispatch site.
//                                   --family is fixed to lifecycle and the arm
//                                   is inferred from --detail: present means
//                                   `checkpoint` (the worker came back empty,
//                                   unmarked or unusable), absent means
//                                   `return`. `escalation` is NOT inferred and
//                                   stays reachable through `trace append`
//   trace render [--phase N] [--events]
//                                   the four families, the derived id, every
//                                   worker dispatch paired to its
//                                   return/checkpoint/escalation, the per-role
//                                   dispatch/token totals, and - where markers
//                                   were written - the coordinator's own
//                                   per-step residue between those brackets,
//                                   scoped per RUN by `corr` so no window spans
//                                   two runs that share a phase number.
//                                   By default the response carries the paired
//                                   `brackets` rows and every `outcome` event
//                                   in place of the raw event array; --events
//                                   asks for that array instead
//   debt-harvest [--root <path>]    every CADENCE-DEBT marker in the tracked
//                                   tree, collected into .planning/CAPTURE.md's
//                                   own `## Debt markers` section (NOT --dir:
//                                   it scans source and writes into .planning)
//   milestone-prune --label <l> --mode <delete|archive>
//                                   the mechanical half of a milestone close:
//                                   checked phases leave ROADMAP (line +
//                                   detail section), their dirs delete
//                                   (tagged release) or move to
//                                   _archive-<label>/ (untagged), and their
//                                   requirements move from Active/Traceability
//                                   into ## Shipped rows carrying the label
//   trace window [--phase N]        every paired bracket's terminal `tokens`
//                                   figure against its role's
//                                   workflow.max_dispatch_tokens ceiling, as
//                                   budget-overrun problems. A REPORT about a
//                                   run that already finished - nothing on the
//                                   dispatch path reads a ceiling - plus the
//                                   rows it could not compare: roles with no
//                                   ceiling, and terminals that carried no
//                                   figure
//   trace ignore [--root <path>] [--check]
//                                   keep .planning/trace.jsonl out of git:
//                                   append-if-absent at scaffold time, or
//                                   REPORT ONLY under --check (NOT --dir:
//                                   --root is the PROJECT root, where
//                                   .gitignore lives)
'use strict';

import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname, isAbsolute, relative, resolve as resolvePath } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renameSync, rmSync, mkdirSync } from 'node:fs';
import {
  parseCursor, renderCursor, parseRoadmapPhases, parseRequirements, atomicWrite,
  shiftPhaseTokens, findProsePhaseRefs, cutPhaseDetail, planTaskTitles,
} from './lib/planning-files.mjs';
import { mergeLayers, isPlainObject } from './lib/config-merge.mjs';
import { appendEvent, renderTrace, FAMILIES } from './lib/trace.mjs';
import { joinReads, inDispatchReads } from './lib/read-trace.mjs';
import { suggestFromRender, parseAdjudication } from './lib/trace-suggest.mjs';
import { windowBudget } from './lib/window-budget.mjs';
import { emit } from './lib/seam-io.mjs';
import { requireInt, requirePhaseArg } from './lib/require-int.mjs';
import { resolveTextFlag } from './lib/text-flag-file.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { requirePlanKey } from './lib/plan-key.mjs';
import { runTransition } from './lib/file-transition.mjs';
import { CATEGORIES, answeredSurfaces } from './lib/surface-scan.mjs';
import { scanDiff } from './lib/risk-diff.mjs';
import { buildEntries, deriveCounts, recordName } from './lib/adjudication-record.mjs';
import { buildQueue, queueName } from './lib/deferred-queue.mjs';
import { evaluateFlag, evaluateRow, subcommandKey, CONTRACTS } from './lib/arg-contract.mjs';
// The shared core the command modules under planning/ import too (D-03). `ok`,
// `fail`, `read` and `HERE` are declared there and nowhere else; this file is one
// more consumer of them, not their home.
import {
  ARGV, DISPATCH_WINDOW_DEFAULTS, RECORD_TOKEN, RISK_DIFF_MAX_BUFFER, argRefusal,
  fail, fireHome, fireIdentity, listPlanFiles, ok,
  planKey, read, readJsonPayload, readQueue,
  readReadsRecords, resolveRange, riskRef, routeLadder,
} from './planning/core.mjs';
// The command modules. Static imports and synchronous handlers, so the
// `COMMANDS` arrows below keep their exact form and the `fail('internal', ...)`
// catch-all at the foot of this file still turns every parse problem into an
// ok:false envelope rather than a stack trace (D-02).
import { cmdStatus } from './planning/status.mjs';
import { cmdCursorGet } from './planning/cursor-get.mjs';
import { cmdCursorSet } from './planning/cursor-set.mjs';
import { cmdPhaseDone } from './planning/phase-done.mjs';
import { cmdUat } from './planning/uat.mjs';
import { cmdAudit } from './planning/audit.mjs';
import { cmdCriteriaCoverage } from './planning/criteria-coverage.mjs';
import { cmdCriteriaSize } from './planning/criteria-size.mjs';
import { cmdPlanSize } from './planning/plan-size.mjs';
import { cmdPlanOverlap } from './planning/plan-overlap.mjs';
import { cmdCiteCount } from './planning/cite-count.mjs';
import { cmdSeedReqs } from './planning/seed-reqs.mjs';
import { cmdRecall } from './planning/recall.mjs';
import { cmdLeaseCheck } from './planning/lease-check.mjs';
import { cmdTaskRecord } from './planning/task-record.mjs';
import { cmdDetectCommands } from './planning/detect-commands.mjs';
import { cmdDetectSurfaces } from './planning/detect-surfaces.mjs';
import { cmdReads } from './planning/reads.mjs';
import { cmdCapture } from './planning/capture.mjs';
import { cmdCaptureSections } from './planning/capture-sections.mjs';
import { cmdDebtHarvest } from './planning/debt-harvest.mjs';
import { cmdMilestonePrune } from './planning/milestone-prune.mjs';

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
 * @returns {{method: 'git'|'file', travels: boolean, source: string|null}}
 */
function gitIgnoreState(root) {
  const noGit = { method: /** @type {'file'} */ ('file'), travels: false, source: null };
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--git-dir'], { stdio: 'pipe' });
  } catch { return noGit; }
  let out = '';
  try {
    out = execFileSync('git',
      ['-C', root, 'check-ignore', '--no-index', '-v', '--', TRACE_IGNORE_LINE],
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
 */
function gitignoreCarriesLine(root) {
  const text = read(join(root, '.gitignore'));
  if (text === null) return false;
  return text.split('\n').some((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return false;
    return line === TRACE_IGNORE_LINE || line === `/${TRACE_IGNORE_LINE}`;
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
  const git = gitIgnoreState(root);
  const ignored = git.method === 'git' ? git.travels : gitignoreCarriesLine(root);
  const common = {
    root,
    file,
    line: TRACE_IGNORE_LINE,
    ignored,
    tracked: traceTracked(root),
    method: git.method,
    ...(git.source ? { source: git.source } : {}),
  };
  if ('check' in opts) return ok({ ...common, written: false });
  // Already covered by a line that travels: the no-op that makes a re-run safe.
  if (ignored) return ok({ ...common, written: false, reason: 'already-ignored' });

  // Every existing byte survives. The newline is added only when the current
  // contents lack a trailing one, so a brownfield `.gitignore` keeps every line
  // it had and the new line still lands on a line of its own.
  const existing = read(file);
  const next = existing === null || existing === ''
    ? `${TRACE_IGNORE_COMMENT}\n${TRACE_IGNORE_LINE}\n`
    : `${existing}${existing.endsWith('\n') ? '' : '\n'}\n${TRACE_IGNORE_COMMENT}\n${TRACE_IGNORE_LINE}\n`;
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
 * The risk-surface vocabulary `route-table.json` states - the SAME list
 * `route.mjs` hands `answeredSurfaces`, read here so the seam that REFUSES on
 * the one-time surface question and the resolve that REPORTS it cannot
 * disagree about which tokens are a valid answer. A table naming a proper
 * subset is the case that separates them: a configured category outside it is
 * unanswered to `route.mjs`, and reading `CATEGORIES` here instead would let
 * this seam accept that same value and narrow a blocking gate's scope to a set
 * the routing authority had rejected.
 *
 * An unreadable or malformed table falls back to the eight rather than to
 * nothing: no vocabulary at all would read every configured answer as invalid
 * and refuse every call.
 * @returns {readonly string[]}
 */
function surfaceVocabulary() {
  return routeLadder('risk_surface_categories') || CATEGORIES;
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
const TRACE_STRING_FLAGS = ['--plan', '--sha', '--base', '--role', '--step', '--reviewer', '--trigger'];

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
      scope: phase === undefined ? 'all' : String(phase),
      events_read: r.events.length,
      ...(r.capped ? { capped: true } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
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

// ---------------------------------------------------------------------------
// risk-check - the detection the blocking `risk_surface` gate fires on, and the
// record that proves it ran (RSK-01/RSK-02).
//
// The defect it closes: detection was `workflows/execute.md` telling a model to
// check a diff against the eight-category prose list in
// references/review-triggers.md. A fire wrote a lifecycle event and a NON-match
// wrote nothing, so the run record could not tell "the detection step was
// skipped" from "it ran and matched nothing", and an omitted check was
// indistinguishable from a clean one.
//
// What changed is not the heuristics - those stay heuristics, in lib/
// risk-diff.mjs - it is that the answer is computed by something that always
// returns one and always appends it. `run` records on EVERY invocation that got
// past argument validation, including the no-match path and the git-failure
// path; `status` refuses a phase holding a completed executor range with no
// record.
// ---------------------------------------------------------------------------

function cmdRiskCheckRun(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check run needs --phase <N>',
      'pass --phase <N> for the phase whose committed range is being checked, then re-run');
  }
  const n = parsedPhase.value;

  // THE WORKER KEY, through the one grammar both faces read (RSK-03, D-02).
  // Not `requireInt`: `status` derives what it demands from the lifecycle
  // brackets, where `references/seams.md` permits a non-numeric worker key, so
  // a fix pass bracketed `1-fix` used to leave a blocking gate no argv could
  // satisfy - `run --plan 1-fix` answered `bad-args`. The VAL-01 rail
  // `requireInt` was standing for survives inside the predicate: a VALUELESS
  // flag arrives as the boolean `true`, `Number(true)` is `1`, and a non-string
  // is refused first.
  let plan;
  if ('plan' in opts) {
    const parsedPlan = requirePlanKey(opts.plan);
    if (!parsedPlan.ok) {
      return fail('bad-args', 'risk-check run --plan needs the worker key after it - a plan number '
        + 'or the key the dispatch was bracketed under (`1-fix`): --plan <k>',
      'send the key this dispatch was bracketed under - the number for PLAN-<k>.md, or the'
      + ' non-numeric key a fix pass used - then re-run');
    }
    plan = parsedPlan.key;
  }

  // BOTH required, and neither defaulted: a defaulted head is a range the
  // caller never stated, and this record is the evidence of what was checked.
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    return fail('bad-args', 'risk-check run needs --base <ref> and --head <ref>, neither opening with `-`',
      'name both ends of the range this check covers, as refs this repository can resolve, then'
      + ' re-run this check');
  }

  // The scope of the check, narrowed only by what the caller named. A token
  // outside the eight is a malformed CALL - refused, with NOTHING appended, the
  // rule `trace append --tokens` already states - because a caller who mistyped
  // the scope of a blocking gate must see a refusal rather than a narrowed
  // clean answer.
  // THE ONE-TIME SURFACE QUESTION, read BEFORE the `--surfaces` branch so both
  // arms see the same two facts.
  //
  // mergeLayers warnings[]: a layer that did not PARSE is refused here whatever
  // the caller passed - this envelope is the surfacing, and the detail names
  // what tore. It sits ahead of the branch deliberately: a torn layer that only
  // an unflagged call noticed would be a fail-closed rule an explicit flag
  // could step around, which is not a rule.
  const { config: surfaceConfig, warnings: surfaceWarnings } = mergeLayers(join(dir, 'config.json'));
  if (surfaceWarnings.length) {
    return fail('surfaces-unanswered',
      `a config layer did not parse, so the surface question cannot be read as answered: ${surfaceWarnings.join('; ')}`,
      'repair the config layer the detail names so it parses as JSON, then re-run - this gate is'
      + ' blocking and there is no arm that proceeds while the answer cannot be read');
  }
  const surfaceTriggers = isPlainObject(surfaceConfig.review)
    && isPlainObject(surfaceConfig.review.triggers) ? surfaceConfig.review.triggers : {};
  const wrote = isPlainObject(surfaceTriggers.risk_surface)
    ? surfaceTriggers.risk_surface.surfaces : undefined;

  let categories = [...CATEGORIES];
  if ('surfaces' in opts) {
    const raw = typeof opts.surfaces === 'string' ? opts.surfaces : '';
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) {
      return fail('bad-args', 'risk-check run --surfaces needs a comma-separated list after it: --surfaces <a,b,c>',
        "list this run's scope as one comma-separated value, or drop --surfaces to use the set the"
        + ' project already answered');
    }
    const unknown = tokens.filter((t) => !CATEGORIES.includes(t));
    if (unknown.length) {
      return fail('bad-args',
        `risk-check run --surfaces names ${unknown.join(', ')}, which is not one of ${CATEGORIES.join(', ')}`,
        'correct the token(s) the detail names against the list beside them, then re-run - dropping'
        + ' one instead would narrow a blocking gate to a scope nobody chose');
    }
    categories = [...new Set(tokens)];
  } else {
    // THE TEETH ON THE ONE-TIME SURFACE QUESTION.
    // `references/review-triggers.md` states that a `risk_surface` fire whose
    // resolve reports `surfaces_answered: false` "does not proceed to detection
    // until the project has answered". Detection is THIS subcommand, and until
    // now that sentence was enforced by nothing: `route.mjs` emitted the flag,
    // every consumer read the surfaces array beside it, and an unanswered
    // project was byte-identical to an answered one at every point after the
    // resolve. Measured on a sibling project 2026-08-19: seven blocking
    // `risk_surface` fires across three phases, the question never put to the
    // user, found only because the user asked why no scan had happened.
    //
    // A caller that NAMED `--surfaces` has already resolved the scope and is
    // untouched by this arm - the refusal is precisely for the caller that
    // let the default stand, because that default is the all-eight set nobody
    // chose. `detail` names the two commands that settle it rather than only
    // reporting the state, since the ask lives on this path alone
    // (`detect-surfaces` has no other caller in the tree).
    const decided = answeredSurfaces(wrote, surfaceVocabulary());
    if (!decided.answered) {
      return fail('surfaces-unanswered',
        'no config layer answered review.triggers.risk_surface.surfaces, so detection would run '
        + `on the ${CATEGORIES.length} categories nobody chose. Run \`detect-surfaces --root .\` `
        + 'and put the choice to the user (references/review-triggers.md), or pass '
        + '--surfaces <a,b,c> to state this run\'s scope explicitly',
        'do one of the two the detail names: put the question to the user and save the answer at'
        + ' review.triggers.risk_surface.surfaces, or pass --surfaces for this run alone. Answering'
        + ' it is what clears this gate - there is no arm that skips the scan');
    }
    categories = [...new Set(decided.surfaces)];
  }

  let body = null;
  let diffError = null;
  // The IDS the caller's refs name, resolved before anything is read: they are
  // this record's range identity, and `risk-check status` compares them rather
  // than the spellings (see resolveRange). Null when the refs did not resolve,
  // in which case nothing was read either and the record says so.
  let baseId = null;
  let headId = null;
  const range = resolveRange(base, head);
  if (!range.ok) {
    diffError = range.error;
  } else {
    baseId = range.base;
    headId = range.head;
    try {
      // `-C top`, the way cmdLeaseCheck reads its staged set, so the range is
      // the repository's and not the cwd's, and the resolved IDS rather than
      // the spellings, so the body read is exactly the range recorded. The
      // trailing `--` ends the revision list: a ref that also names a path
      // cannot turn into a pathspec here.
      //
      // `--no-ext-diff --no-textconv` are what make the EMPTY answer mean what
      // scanDiff reports it to mean. A `diff=<driver>` attribute in a checked-in
      // `.gitattributes` binds to a `diff.<driver>.command` or `.textconv` in
      // the reader's OWN git config, so a repository the user merely cloned can
      // route this read through a helper that prints nothing and exits 0 - and
      // no attacker is needed for it, since a `textconv` for pdf/docx in
      // `~/.gitconfig` does it by accident. `git diff <base> <head> --` then
      // emits zero bytes for a file whose changed line is a recursive delete, and
      // scanDiff answers `checked: true, empty: true, matches: []`: a COMPLETED
      // clear on the one gate that is blocking at every stakes level. Both flags
      // are diff-generation switches only - they change no id, no range and no
      // exit status, so the empty/unreadable split above is untouched.
      body = execFileSync('git',
        ['-C', range.top, 'diff', '--no-ext-diff', '--no-textconv', baseId, headId, '--'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: RISK_DIFF_MAX_BUFFER });
    } catch (e) {
      // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set`
      // applies: a git failure detail can carry a remote URL with credentials.
      diffError = redactUrl(e && e.message ? e.message : String(e));
    }
  }

  const scan = scanDiff(body, categories);

  // Appended BEFORE the envelope is emitted, and on every path past argument
  // validation - the no-match path and the git-failure path included - so even
  // a refusal leaves the record saying the check was ATTEMPTED. `appendEvent`
  // never throws and never speaks; its `{written, reason}` rides the envelope
  // so a trace that could not be written is reported rather than silently
  // dropped, and it may NOT change the verdict.
  //
  // `plan` is the caller's OWN spelling, verbatim, exactly as a prose
  // `trace append --plan` stores it - the two must be one string or the receipt
  // settles nothing (D-01's stated cost). `risk-check status` stringifies both
  // sides before comparing, the way lib/trace.mjs's own `key()` does, so a
  // record written `1` and a bracket written `"1"` still join.
  const res = appendEvent(dir, {
    phase: parsedPhase.raw,
    family: 'outcome',
    event: 'risk_check',
    ...(plan === undefined ? {} : { plan }),
    // Both spellings AND both ids, always: the spelling is what the reader
    // recognises, the id is the range's identity. Written even when null, so a
    // record from a run that resolved nothing is visibly unidentifiable rather
    // than silently absent a field.
    base,
    head,
    base_id: baseId,
    head_id: headId,
    checked: scan.checked,
    categories: scan.categories,
    // TOKENS on the record, the `{category, signal}` pairs on the envelope: the
    // record is joined and counted, the envelope is read by the fire site that
    // has to state a reason.
    matches: scan.matches.map((m) => m.category),
    inconclusive: scan.inconclusive,
    // The range was READ and held nothing - a completed check, not an
    // unchecked one (D-01/D-02). Written beside `checked` on the record and on
    // the envelope both, so the record a later `status` joins and the envelope
    // the coordinator reads cannot disagree about it.
    empty: scan.empty,
  });

  const envelope = {
    phase: n,
    ...(plan === undefined ? {} : { plan }),
    base,
    head,
    base_id: baseId,
    head_id: headId,
    checked: scan.checked,
    categories: scan.categories,
    matches: scan.matches,
    inconclusive: scan.inconclusive,
    empty: scan.empty,
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
  };

  // A range that could not be READ is never ok: a caller must not be able to
  // take "git refused" for "clean".
  if (diffError !== null) {
    return emit({ ok: false, reason: 'no-diff', detail: diffError, ...envelope,
      hint: 'name a --base and --head this repository can resolve, then re-run this check - git'
        + ' could not read the range, so nothing here says the diff is clean' });
  }
  return ok(envelope);
}

/** The trigger a risk RECEIPT has to name. One constant, because the detector
 * that writes the record and the gate that fires on it are the same trigger,
 * and a second spelling is how the two halves start clearing each other. */
const RISK_TRIGGER = 'risk_surface';

/**
 * The five `outcome` event names a `risk_surface` fire can settle at, and the
 * whole vocabulary `risk-check status` accepts as proof the fire HAPPENED
 * (GAT-04):
 *   - `adjudication` - the adjudicated arm reported its survivors
 *   - `rearm`        - the one-round re-arm fired a narrowed second round
 *   - `gate_pass`    - the fire came back with nothing blocker/high
 *   - `override`     - the user cleared a FAIL deliberately, reason on file
 *   - `deferral`     - a gate resolved `deferred` queued what it found
 * `gate_pass` is here because the roadmap's stated acceptance set has no arm
 * for a clean pass and a blocking PASS wrote nothing: without it, every matched
 * range whose fire found no blocker would be permanently unclearable, and this
 * tree has already stated its verdict on that shape - an unclearable gate is
 * one that gets bypassed.
 *
 * `deferral` is the FIFTH name this list once said nothing produces, and what
 * produces it is the `deferred` gate mode: that arm runs the reviewer, persists
 * the findings and writes a queue member, then lets the run continue - it
 * settles by QUEUING rather than by adjudicating, so none of the four names
 * above describes it. It cannot borrow one either: `gate_pass` reads as a clean
 * gate in every downstream recount, and `override` is the coordinator's own
 * say-so, which is the manufactured clear the receipt machinery exists to
 * refuse. Without an accepted receipt of its own, `cmdRiskCheckStatus` reports
 * the matched range `unfired` forever and the run halts at exactly the step
 * deferring it was meant to let through.
 *
 * The producers are references/triage-gate.md and references/review-triggers.md.
 */
const FIRE_RECEIPTS = ['adjudication', 'rearm', 'gate_pass', 'override', 'deferral'];

function cmdRiskCheckStatus(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check status needs --phase <N>',
      'pass --phase <N> for the phase whose fires are being reported, then re-run');
  }
  const n = parsedPhase.value;

  // The triple is all three or none. A plan number alone is NOT a range
  // identity, and two of the three would let a caller ask about a range it only
  // half named - which reads as the phase-wide arm and passes on a record left
  // by some other range.
  const given = ['plan', 'base', 'head'].filter((f) => f in opts);
  /** @type {{plan: string, base: string, head: string, base_id: string, head_id: string} | null} */
  let wanted = null;
  if (given.length) {
    if (given.length !== 3) {
      return fail('bad-args',
        'risk-check status takes --plan <k> --base <ref> --head <ref> together, or none of the three',
        'send all three to ask about ONE range, or none of them for the phase-wide answer - two of'
        + ' the three would report on a record some other range left');
    }
    // The SAME predicate `risk-check run` reads (D-02). One consultation each,
    // so the face that enforces the question and the face that reports it
    // cannot disagree about which spellings are keys at all.
    const parsedPlan = requirePlanKey(opts.plan);
    if (!parsedPlan.ok) {
      return fail('bad-args', 'risk-check status --plan needs the worker key after it - a plan '
        + 'number or the key the dispatch was bracketed under (`1-fix`): --plan <k>',
      'send the key the dispatch was bracketed under - the number for PLAN-<k>.md, or the'
      + ' non-numeric key a fix pass used - then re-run');
    }
    const base = riskRef(opts.base);
    const head = riskRef(opts.head);
    if (!base || !head) {
      return fail('bad-args', 'risk-check status needs --base <ref> and --head <ref>, neither opening with `-`',
        'name both ends of the range you are asking about, as refs this repository can resolve,'
        + ' then re-run this check');
    }
    // The COMMIT PAIR is the identity, not the spelling (see resolveRange), so
    // the asked range is resolved here and compared as ids below. A ref that
    // cannot be resolved is a REFUSAL and never a match: a gate that shrugged
    // at an unresolvable range would answer about a range nobody can point at,
    // and the only safe answer to "which commits are these" is the one git
    // gives.
    const resolved = resolveRange(base, head);
    if (!resolved.ok) {
      return emit({
        ok: false,
        reason: 'unresolved-range',
        phase: n,
        plan: parsedPlan.key,
        base,
        head,
        detail: resolved.error,
        hint: 'name a --base and --head this repository can resolve, then re-run this check',
      });
    }
    wanted = { plan: parsedPlan.key, base, head, base_id: resolved.base, head_id: resolved.head };
  }

  // ONE reader of the record, through renderTrace and nothing else: a second
  // reader is how two readers of one record start disagreeing about what
  // closed, which is the reason renderTrace exposes its paired `brackets` at
  // all.
  const r = renderTrace(dir, parsedPhase.raw);

  /**
   * THIS RUN, not every cycle that ever used this phase number.
   *
   * `.planning/trace.jsonl` is append-only across the whole project and phase
   * numbers restart every milestone, so `--phase 1` reaches every previous
   * cycle's phase 1 - on this repository, seven prior runs' executor brackets,
   * two of them for a plan 2 that predates this seam. Scanning all of them
   * demanded a risk record for ranges committed under a v3.4.x cycle and made
   * the gate unsatisfiable on any project with more than one milestone of
   * history: the check built to stop "not run" passing as "ran clean" never
   * passed at all.
   *
   * The scope is `renderTrace`'s own `corr` - the id derived from the phase's
   * NEWEST anchor - which is the same identity the ONE-round re-arm cap in
   * references/triage-gate.md keys on ("a `rearm` outcome for this trigger
   * already recorded under that same id"), and the same id `appendEvent`
   * stamped on the record `risk-check run` wrote moments earlier. Both scans
   * take it, for one reason: a record left under a previous cycle's id must not
   * satisfy this cycle's range either, or scoping the brackets alone would
   * trade an unsatisfiable gate for a forgeable one.
   *
   * A trace with no readable id to scope by (`corr` null or empty, which
   * `requirePhaseArg` should already have made impossible) keeps the unscoped
   * behaviour: requiring MORE is the safe direction here, and silently matching
   * nothing would turn the whole gate into a blanket pass.
   */
  /**
   * THIS CYCLE, bounded by the phase's own last sign-off - not the newest
   * anchor alone.
   *
   * Scoping to `renderTrace`'s `corr` alone was too narrow in the other
   * direction. `workflows/execute.md` anchors each invocation at
   * `git rev-parse --short HEAD`, so a phase run across more than one
   * /cad-execute - a resumed session, a continuation after a checkpoint - takes
   * a DIFFERENT id the moment its first commits land, and every range the
   * earlier invocation completed fell outside the filter. That is the same
   * silence this gate exists to break, arriving as an exemption rather than an
   * absence.
   *
   * The bound is the phase's own `uat_verdict` `complete` outcome, which
   * `workflows/verify.md` appends when the phase passes: everything after the
   * newest one is the cycle in hand, everything at or before it belongs to a
   * cycle that was already signed off. `partial` is deliberately not a bound -
   * a partial UAT session is the middle of a cycle, and cutting there would
   * exempt the work that preceded it. A phase with no sign-off at all has
   * never completed, so its whole history IS the current cycle and nothing is
   * dropped.
   */
  // EPOCH MILLISECONDS, never the raw string. A lexicographic compare over
  // whatever `ts` happens to hold is a gate that opens on a typo: a sign-off
  // stamped `"zzzz"` sorts above every real ISO timestamp, so every completed
  // range in the file falls before the bound and the phase reports clean with
  // no rows at all. An unparseable timestamp is not a later one.
  const stamp = (/** @type {any} */ v) => {
    if (typeof v !== 'string') return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };

  let signoff = null;
  for (const e of r.events) {
    if (e.family !== 'outcome' || e.event !== 'uat_verdict' || e.detail !== 'complete') continue;
    // An unreadable sign-off is NOT a bound. It cannot say when the cycle
    // closed, and the only safe reading of "I do not know" here is that no
    // cycle closed - which requires more, never less.
    const ts = stamp(e.ts);
    if (ts === null) continue;
    if (signoff === null || ts > signoff) signoff = ts;
  }
  /**
   * Everything is in the cycle unless it can be PROVED to sit at or before a
   * readable sign-off. The direction is the whole point: an event carrying no
   * `ts`, an unparseable one, or one written by a clock that moved backwards
   * stays REQUIRED rather than silently exempt, because a completed range this
   * gate cannot place is exactly the range it must not clear. `>=`, not `>`,
   * for the same reason - an event sharing the sign-off's own instant is
   * ambiguous, and ambiguity resolves toward requiring the record.
   */
  const inCycle = (/** @type {{ts?: any}} */ e) => {
    if (signoff === null) return true;
    const ts = stamp(e.ts);
    return ts === null || ts >= signoff;
  };

  /** A row identity is the RUN and the plan together. Pairing a bracket with a
   * record under its own `corr` is what makes a multi-invocation phase answer
   * per invocation: the ranges invocation 1 completed need invocation 1's
   * records, and invocation 2 cannot clear them by checking its own. */
  const rowKey = (/** @type {any} */ corr, /** @type {any} */ plan) =>
    `${planKey(corr)}\u0000${planKey(plan)}`;

  /** Completed ranges, keyed by plan. A COMPLETED range is an executor bracket
   * whose terminal is a `return`; a `checkpoint` closed a dispatch that came
   * back unfinished and requires nothing. Grouping by plan is what makes a
   * checkpoint-then-return continuation count once rather than twice. */
  /** @type {Map<string, {run: string|null, plan: string|null, completed: number}>} */
  const completed = new Map();
  const planRow = (/** @type {any} */ corr, /** @type {any} */ plan) => {
    const k = rowKey(corr, plan);
    let row = completed.get(k);
    if (!row) {
      row = {
        run: planKey(corr) === '' ? null : planKey(corr),
        plan: planKey(plan) === '' ? null : planKey(plan),
        completed: 0,
      };
      completed.set(k, row);
    }
    return row;
  };
  /**
   * A bracket carrying a key the worker-key grammar REFUSES (RSK-03).
   *
   * The ONE bounded exception to "status does not narrow" (D-01), and it is the
   * opposite of the exclusion arm that decision rejected. A key `lib/plan-key.mjs`
   * refuses is not a legal worker key at all, so `risk-check run --plan <it>`
   * can never write the record this gate would demand: requiring one leaves a
   * gate that is blocking at every stakes level permanently unsatisfiable, with
   * no exit but an `override`. So it is REPORTED, on its own `malformed` list,
   * rather than silently dropped - which is exactly what made the excluded-key
   * arm fail-open. A key the predicate ACCEPTS is never dropped.
   *
   * An ABSENT plan is NOT malformed and keeps its row: `risk-check run` with no
   * `--plan` writes a record that keys to '' and joins it, so an unidentified
   * completed range stays required, exactly as the row comment above says.
   * Nothing in the tree mints a refused key today - `workflows/execute.md` now
   * states the continuation key - so this guards the write face D-03 leaves
   * open on purpose, where `trace append --plan` still stores any non-empty
   * string.
   * @type {Set<string>}
   */
  const malformed = new Set();
  for (const b of r.brackets) {
    if (!inCycle(b)) continue;
    if (b.role !== 'cad-executor' || b.event !== 'return') continue;
    const spelled = planKey(b.plan);
    if (spelled !== '' && !requirePlanKey(b.plan).ok) { malformed.add(spelled); continue; }
    planRow(b.corr, b.plan).completed++;
  }
  // A named range is required whether or not its return has landed yet: the
  // caller states the range it just committed, and a bracket that never paired
  // must not turn the gate off. It rides THIS invocation's id, which is the
  // one the caller is reporting for.
  if (wanted) planRow(r.corr, wanted.plan);

  /**
   * Every record the phase holds, keyed by plan, carrying its VERDICT fields
   * beside its refs - because a record is not the same thing as a check.
   * `risk-check run` appends on every path past argument validation, the
   * git-failure path included, so a `checked:false` line means the check was
   * ATTEMPTED and read no diff at all. Matching a ref pair off one of those and
   * reporting `recorded` is the exact state RSK-02 exists to refuse: completion
   * would pass on a check that never saw the range.
   *
   * `inconclusive` is the OPPOSITE call, deliberately. A `checked:true,
   * inconclusive:true` record IS a completed check - the seam read the range
   * and honestly reported that part of it cannot be judged - so it satisfies
   * this gate and rides the row with the flag visible rather than collapsed.
   * "An unjudged range is not a cleared one" is enforced at the FIRE site,
   * which is where a response to it exists: `workflows/execute.md` fires
   * `risk_surface` on `inconclusive: true` exactly as it does on a match.
   * Refusing here instead would make a range holding a binary file or a
   * submodule bump permanently unclearable - the caller cannot make git render
   * it - and an unclearable gate is one that gets bypassed.
   * @type {Map<string, {base: any, head: any, base_id: string|null, head_id: string|null,
   *   checked: boolean, inconclusive: boolean}[]>}
   */
  const records = new Map();
  /** The same records keyed by PLAN alone, for the named-range arm. That arm
   * identifies a range by its resolved commit pair, which is a stronger
   * identity than the invocation that wrote it, so a record for exactly those
   * two commits satisfies it wherever in the cycle it was written.
   * @type {Map<string, any[]>} */
  const byPlan = new Map();
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || e.event !== 'risk_check') continue;
    const k = rowKey(e.corr, e.plan);
    if (!records.has(k)) records.set(k, []);
    const p = planKey(e.plan);
    if (!byPlan.has(p)) byPlan.set(p, []);
    const rec = {
      base: e.base === undefined ? null : e.base,
      head: e.head === undefined ? null : e.head,
      // The resolved ids the range is IDENTIFIED by, null when the record does
      // not carry them - a record written before `run` resolved its refs, or by
      // a run whose refs did not resolve. Null never matches, so such a record
      // reports `stale` and the range is re-run: the safe direction, and the
      // only one available, since the spelling it does carry cannot say which
      // commits it meant.
      base_id: typeof e.base_id === 'string' && e.base_id ? e.base_id : null,
      head_id: typeof e.head_id === 'string' && e.head_id ? e.head_id : null,
      // `=== true`, never truthiness: a record written by an older seam carries
      // neither field, and an absent verdict is not a passing one.
      checked: e.checked === true,
      inconclusive: e.inconclusive === true,
      // WHY a range with nothing in it is `recorded` and not a refusal. An
      // empty committed range is a check that RAN, so it arrives here
      // `checked: true, inconclusive: false, matches: []` and reaches
      // `recorded` through the arms below unaided - no fifth state name, which
      // `offending` (`row.state !== 'recorded'`) would turn into an automatic
      // `ok:false`, and no extra clause in `fired`. The flag is read for the
      // reader's sake alone: it rides the reported `records` array so an
      // auditor can see WHY a row is `recorded` with nothing matched.
      //
      // `=== true` for the reason stated two fields up: 69 `outcome/risk_check`
      // events on this repository's own trace were written before the seam
      // separated an empty range from an unread one, and an absent field is not
      // an empty range.
      empty: e.empty === true,
      // The category TOKENS `cmdRiskCheckRun` writes onto every record and this
      // reader used to drop. They are what makes a range FIRED: a record
      // carrying one is a range workflows/execute.md was obliged to fire the
      // blocking `risk_surface` gate on. A non-array (an older seam, a
      // hand-edited line) reads as no tokens, never as a match nobody can name.
      matches: Array.isArray(e.matches) ? e.matches.filter((m) => typeof m === 'string') : [],
      // A non-empty `matches` whose elements are not strings is a range the
      // detector MATCHED and this reader cannot name. Filtering it to `[]`
      // silently turned a fired range into a clean one, so the two cases are
      // separated: `matches` stays the tokens that can be reported, and this
      // flag carries "something matched" independently. Widening is the only
      // safe direction on the one gate that is blocking at every stakes level,
      // which is the same rule `inconclusive` already encodes.
      matched_unnamed: Array.isArray(e.matches) && e.matches.length > 0
        && e.matches.filter((m) => typeof m === 'string').length === 0,
    };
    records.get(k).push(rec);
    byPlan.get(p).push(rec);
  }

  /**
   * THE FIRE'S OWN RECEIPTS, keyed the same way the records are (GAT-04).
   *
   * The defect: `risk-check status` proved a range was READ and RECORDED, and
   * stopped there. A coordinator could run the detector, watch it match
   * `secrets`, skip the blocking `risk_surface` fire entirely and still be told
   * `ok:true` - the gate reporting success for the one thing it exists to make
   * unskippable. "The detector ran" and "the fire happened" are two different
   * claims, so they are two different receipts and this reader demands both.
   *
   * Five event names, because those are the five outcomes a fire can reach: the
   * adjudicated arm's `adjudication`, the capped re-arm's `rearm`,
   * references/triage-gate.md's two settle points - `gate_pass` when nothing
   * blocker/high survived, `override` when the user cleared a FAIL deliberately
   * - and `deferral`, which the `deferred` gate mode writes when it queues what
   * it found instead of halting. The list itself is FIRE_RECEIPTS, one
   * consultation, and its block comment states why each name is on it.
   *
   * The trigger is read off the STRUCTURED `trigger` field and never parsed out
   * of `detail` (D-12): measured on this repository's 35 `outcome/adjudication`
   * events the trigger is spelled four different ways in that free text, so a
   * reader that parsed it would clear a range on a spelling and refuse an
   * identical one on another.
   * Each receipt carries the row identity it was written under plus the RANGE
   * it settled, so a later matched range cannot ride in on an earlier fire.
   * @type {{key: string, sha: string|null, base: string|null}[]}
   */
  const receipts = [];
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || !FIRE_RECEIPTS.includes(e.event)) continue;
    if (e.trigger !== RISK_TRIGGER) continue;
    // An `override` is the one receipt a coordinator writes on its OWN say-so
    // rather than as the settled outcome of a review, so it is the one that has
    // to carry a reason. Without this, `trace append --family outcome --event
    // override --trigger risk_surface --plan k` with no detail at all mints a
    // clear for a fire nobody made - the same manufactured-receipt shape the
    // structured `--trigger` field exists to refuse (D-12).
    if (e.event === 'override') {
      const why = typeof e.detail === 'string' ? e.detail.trim() : '';
      if (!why) continue;
    }
    receipts.push({ key: rowKey(e.corr, e.plan), sha: typeof e.sha === 'string' ? e.sha : null, base: typeof e.base === 'string' ? e.base : null });
  }

  /**
   * Does a receipt settle THIS range?
   *
   * The join used to be `rowKey(corr, plan)` alone, and that cleared every later
   * matched range for the plan on the strength of one earlier fire: run the
   * detector, fire once, fix something, re-run the detector on the widened
   * range, skip the second fire - and status still answered `ok:true`. That is
   * the defect GAT-04 exists to close, one level up inside the control itself.
   *
   * So a receipt names the range it settles, with `trace append --sha <head>`.
   * Short and full spellings both resolve to the same commit, so the comparison
   * is prefix-wise in whichever direction is shorter, exactly as a caller who
   * passed `git rev-parse --short HEAD` would expect.
   *
   * A receipt carrying NO sha settles nothing. That is the transition cost,
   * stated rather than hidden: a receipt that cannot say which range it judged
   * is the ambiguity this fix removes, and accepting it as a wildcard would
   * leave the hole open under a different name.
   */
  const shaMatches = (/** @type {string|null} */ a, /** @type {string|null} */ b) => {
    if (!a || !b) return false;
    const [x, y] = a.length <= b.length ? [a, b] : [b, a];
    return x.length >= 7 && y.startsWith(x);
  };
  /**
   * Does a receipt settle THIS ONE record?
   *
   * Both ends of the range, not the head alone: two records can share a head
   * and differ at the base, and they are then different diffs over different
   * risk surfaces. A receipt for `B..C` must not settle `A..C`.
   *
   * A record that carries no resolved ids has no range identity to bind to - it
   * predates those fields, or its refs did not resolve - so the join falls back
   * to the run and the plan for THAT record alone. The alternative is a range
   * no receipt can ever settle, and an unclearable gate is one that gets
   * bypassed. Every record `risk-check run` writes today carries the ids, so
   * this is the legacy arm, exactly as wide as the records that lack them.
   */
  const settledBy = (/** @type {any} */ rc, /** @type {any} */ f) => (
    f.head_id === null && f.base_id === null
      ? true
      // Both ends REQUIRED, never "matched if supplied". Letting a receipt with
      // no `--base` pass on the head alone reopened the widened-range bypass
      // under a different name: a fire over `B..C` would settle `A..C`, which
      // is a different diff over a different surface.
      : shaMatches(rc.sha, f.head_id) && shaMatches(rc.base, f.base_id));
  /**
   * EVERY fired record this row answers for needs its own receipt.
   *
   * `.some()` here was the blocker's second half: on the phase-wide arm
   * `satisfying` is every usable record for the plan, so one receipted range
   * cleared a later unreceipted one - the same defect the range binding closed
   * on the named arm, still open one branch over.
   */
  const settles = (/** @type {string} */ k, /** @type {any[]} */ satisfying) =>
    satisfying
      .filter((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed)
      .every((f) => receipts.some((rc) => rc.key === k && settledBy(rc, f)));

  const rows = [...completed.entries()].map(([k, row]) => {
    const asked0 = wanted && planKey(wanted.plan) === planKey(row.plan)
      && row.run === (planKey(r.corr) === '' ? null : planKey(r.corr));
    const found = asked0 ? (byPlan.get(planKey(row.plan)) || []) : (records.get(k) || []);
    // Only a record whose read SUCCEEDED can satisfy the gate; the rest are
    // reported so the reader sees an attempt rather than an absence.
    const usable = found.filter((f) => f.checked);
    const asked = asked0
      ? { base: wanted.base, head: wanted.head, base_id: wanted.base_id, head_id: wanted.head_id }
      : null;
    // COMMIT IDS on both sides. Comparing the spellings is what let a record
    // left under `--head HEAD` satisfy a later, wider `--head HEAD` - the very
    // spelling workflows/execute.md documents for both calls.
    const sameRange = (/** @type {{base_id: string|null, head_id: string|null}} */ f) =>
      f.base_id !== null && f.head_id !== null
      && f.base_id === asked.base_id && f.head_id === asked.head_id;
    // STALE, not satisfied: a plan re-dispatched over a widened range
    // (execute.md's "re-dispatch the remainder" arm) is exactly the case that
    // would otherwise pass on the record its earlier, narrower range left. Both
    // ref pairs are named so the reader can see which one it has. UNCHECKED is
    // the third state: the range was named and attempted, and nothing was read.
    //
    // The records that actually SATISFY the row, which is a narrower set than
    // `usable` on the named-range arm: only a record for the asked commit pair
    // answers there. Both the state below and the fire receipt read this same
    // set, so the row cannot be `recorded` on one record and judged fired on
    // another.
    const satisfying = asked ? usable.filter(sameRange) : usable;
    // A FIRED range: the detector read it and came back with category tokens or
    // with `inconclusive: true`, which is the pair of conditions
    // workflows/execute.md fires the blocking `risk_surface` gate on. Anything
    // else is a range the gate had no reason to fire on, and demanding a
    // receipt for it would refuse a clean phase.
    const fired = satisfying.some((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed);
    // UNFIRED is the fifth state, and it sits ON TOP of the four above rather
    // than in place of any of them: a record that never read its range is still
    // `unchecked`, a stale one is still `stale`. This one is reached only where
    // the range WAS read and recorded, matched, and no receipt says the fire
    // that had to follow ever happened. The join is the row's own identity -
    // `rowKey(corr, plan)`, which for the asked row is the
    // `planRow(r.corr, wanted.plan)` this invocation registered.
    const state = asked
      ? (usable.some(sameRange) ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : found.some(sameRange) ? 'unchecked'
          : found.length ? 'stale' : 'missing')
      : (usable.length ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : (found.length ? 'unchecked' : 'missing'));
    // `matched_unnamed` is this reader's own conservative flag, not part of the
    // record a caller wrote, so it stays out of the reported shape - the rows
    // report what the trace holds.
    const pub = found.map(({ matched_unnamed: _u, ...rest }) => rest);
    return { ...row, state, records: pub, ...(asked ? { wanted: asked } : {}) };
  });

  const offending = rows.filter((row) => row.state !== 'recorded');
  if (offending.length) {
    // The hint names the step that is actually MISSING. Every offending row in
    // the `unfired` state has its record already: telling that caller to re-run
    // the detector would send it to re-do the half it did, and leave the gate
    // refusing for the same reason a second time. Where the offending set is
    // mixed, the record hint leads - the fire cannot be recorded for a range
    // nothing has read.
    const unfiredOnly = offending.every((row) => row.state === 'unfired');
    // Emitted directly rather than through fail(): its reason/detail/hint shape
    // has no channel for the list, and the list is the whole point of the
    // refusal - exactly as cmdLeaseCheck's `undeclared-files` arm reasons.
    return emit({
      ok: false,
      reason: unfiredOnly ? 'risk-fire-missing' : 'risk-record-missing',
      phase: n,
      plans: rows,
      missing: offending.map((row) => row.plan),
      // Never folded into `missing`: these are not ranges awaiting a record,
      // they are keys no record can be written for, and a caller sent to
      // `risk-check run --plan <one of them>` would be sent to a refusal.
      ...(malformed.size ? { malformed: [...malformed] } : {}),
      hint: unfiredOnly
        ? `fire the blocking ${RISK_TRIGGER} review for each plan listed and record its outcome`
          + ` (one of ${FIRE_RECEIPTS.join(', ')}) under this phase's correlation id and that plan,`
          + ' then re-run this check'
        : `run risk-check run --phase ${parsedPhase.raw} --plan <k> --base <ref> --head <ref>`
          + ' for each plan listed, then re-run this check',
    });
  }
  // Nothing to require is not a failure: a phase with no completed executor
  // range at all is ok:true with an empty list, or a gate here would block the
  // first plan of every phase. A malformed key rides the PASS too, for the
  // reason it exists: the reader has to be able to see that a bracket was
  // skipped rather than judged, and a pass that said nothing about it would be
  // the silent exclusion D-01 refused.
  ok({ phase: n, plans: rows, ...(malformed.size ? { malformed: [...malformed] } : {}) });
}

function cmdRiskCheck(dir, sub, opts) {
  if (sub === 'run') return cmdRiskCheckRun(dir, opts);
  if (sub === 'status') return cmdRiskCheckStatus(dir, opts);
  return fail('usage', 'risk-check <run|status>');
}

// ---------------------------------------------------------------------------
// adjudication - the record a blocking or adjudicated gate fire leaves beside
// its sibling REVIEW-<trigger>-<discriminator>.md.
//
// THE DEFECT IT CLOSES. A gate settled its findings and then summarized itself:
// the trace kept `<n> survivors of <m> raised`, the finding BODIES were never
// written anywhere, and a refutation - the ruling that DELETES a finding -
// could not be checked against the code it claimed to refute, because the claim
// was gone by the time anyone asked. This seam writes one entry per finding
// RAISED per raising voice, carrying the reviewer's own words, so the auditor
// path `git checkout <head_id>` then open `file:line` is mechanical.
//
// THE GRAMMAR IS lib/adjudication-record.mjs's; THE I/O IS THIS FUNCTION'S.
// The module classifies a composed payload and derives the counts, and every
// decision it cannot make without touching the world - reading the payload
// file, resolving the range, choosing the path, refusing to overwrite - is made
// here. That split is why the module can be tested without a repository.
//
// THE PAYLOAD IS A FILE, never inline JSON (D-03), read through
// `readJsonPayload` - the reader `uat merge` already uses, whose
// `no-payload`/`bad-payload` split is exactly what a truncated or never-written
// file looks like. The record's whole content is verbatim reviewer text with
// arbitrary quoting, so one unescaped quote in a heredoc would make the payload
// unparseable after the adjudication was already done and could not be redone.
//
// THE IDS ARE RESOLVED HERE AND THE CALLER'S SPELLING IS NOT TRUSTED (D-08):
// measured on this repository, 44 of the 52 outcome receipts carrying a `base`
// spell it 7-char, and `workflows/execute.md` passes the literal `HEAD`, which
// is not a commit id at all. An unresolvable range is a REFUSAL rather than a
// record with null ids - a record whose head cannot be checked out is not the
// artifact this subcommand exists to produce.
// ---------------------------------------------------------------------------

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

/**
 * Which of these entries cite a `file` that does not EXIST at `headId` (D-09,
 * AC5) - and whether the question could be asked at all.
 *
 * WHY IT IS ASKED. The auditor path this record exists to buy is `git checkout
 * <head_id>` then open `file:line`, and NOTHING upstream checks either field:
 * review-provider.mjs's `FINDING_SCHEMA` bounds `file` only as a non-empty
 * string of at most 1024 characters, and skills/cad-reviewer-contract/SKILL.md
 * calls `line` best-effort in as many words. So the citation is checked here,
 * once, while the head is already resolved - which buys the auditor path
 * instead of demonstrating it.
 *
 * A MARKED ENTRY IS STILL STORED, NEVER DROPPED. The mark is the auditor's
 * warning that the citation cannot be opened; dropping the entry would delete
 * the very finding whose grounding is in question, which is the summarizing
 * this whole record exists to end.
 *
 * THE PROBE FIRST, and this is the load-bearing part. `git cat-file -e
 * <sha>:<path>` exits 128 both for a path absent at that commit and for "this
 * is not a repository" (measured - it is NOT the documented exit 1 on this
 * git), so the two are indistinguishable per entry. The probe asks one question
 * whose answer cannot be about any path - can this repository read the head
 * commit object - and only once it says yes is a later nonzero exit
 * attributable to the citation. A check that could not run AT ALL is reported
 * ONCE by the caller and marks NOTHING: an unprovable citation set is not a bad
 * one, and marking every entry there is the collapsed-stdin defect
 * `land-cleanup.mjs` already cost this project once, rewritten.
 *
 * `-C top` - the repository top `resolveRange` returned - the way
 * `cmdRiskCheckRun` reads its diff, so the answer is the repository's and not
 * the process cwd's.
 *
 * @param {string} top the repository top
 * @param {string} headId the resolved 40-character head id
 * @param {any[]} entries
 * @returns {{checked: boolean, missing: Set<number>, reason: string}}
 *   `checked: false` carries an EMPTY `missing` by construction, so a caller
 *   cannot mark entries against a check that never ran.
 */
function groundCitations(top, headId, entries) {
  const git = (/** @type {string} */ arg) => execFileSync('git',
    ['-C', top, 'cat-file', '-e', arg], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    git(`${headId}^{commit}`);
  } catch (e) {
    // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set` applies:
    // a git failure detail can carry a remote URL with credentials in it.
    return { checked: false, missing: new Set(),
      reason: redactUrl(e && e.message ? e.message : String(e)) };
  }
  /** @type {Set<number>} */
  const missing = new Set();
  for (let i = 0; i < entries.length; i += 1) {
    // The path is the SECOND half of one `<sha>:<path>` argument, so a citation
    // opening with `-` can never be read by git as an option.
    try { git(`${headId}:${entries[i].file}`); } catch { missing.add(i); }
  }
  return { checked: true, missing, reason: '' };
}

function cmdAdjudication(dir, opts) {
  const id = fireIdentity('adjudication', opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head } = id;

  // Absent `--payload` is refused rather than fed to stdin: the declared row
  // says required, `evaluateRow` is a VALUE door and not a presence one, and
  // `readJsonPayload()` with no argument would sit reading a stdin no gate site
  // opens.
  if (opts.payload === undefined) {
    return fail('bad-args',
      'adjudication needs --payload <file> - the composed payload is a FILE, never '
      + 'inline JSON and never stdin',
      'write the composed rulings to a file and pass --payload <path> - reviewer text carries'
      + ' arbitrary quoting, which is why it never rides the command line');
  }
  const payload = readJsonPayload(opts.payload);
  if (!payload.ok) return;
  const built = buildEntries(payload.value);
  if (!built.ok) {
    return fail('bad-payload', built.detail,
      'repair the payload file at the point the detail names, then re-run - nothing was written,'
      + ' so the fire is still unrecorded');
  }

  const range = resolveRange(base, head);
  if (!range.ok) {
    return emit({
      ok: false,
      reason: 'unresolved-range',
      phase: n,
      base,
      head,
      detail: range.error,
      hint: 'name a --base and --head this repository can resolve, then re-run this record',
    });
  }

  const pdir = fireHome(dir, n, 'record');
  if (!pdir) return;

  // The ONE filename rule, shared with the receipt recount in `cmdTrace`: two
  // spellings of it is two files, and the recount would read the wrong fire.
  const name = recordName(trigger, discriminator, round);
  const file = join(pdir, name);
  // DERIVED from the home that was chosen, never the literal `phases/<N>/`: a
  // carried fire is adjudicated in `deferred/<N>/`, and an envelope naming a
  // path the record is not at is a path an auditor cannot open.
  const rel = relative(dir, file);
  // REFUSED, never overwritten. A caller that forgot `--round` on a re-arm is
  // the failure the flag exists FOR, and replacing the file there lands in
  // exactly the state it was added to prevent: the first round's rulings gone,
  // silently, with ok:true. `lstatSync` again - a symlink at the target is
  // something already there, whatever it points at.
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s rulings - this seam never `
      + 'overwrites a record',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  // EVERY CITATION GROUNDED AT THE HEAD (D-09, AC5), before the record is
  // written and after every refusal above, so a refused call does no git work.
  const cites = groundCitations(range.top, range.head, built.entries);

  // ONE COPY OF THE RESOLVED PAIR PER ENTRY, deliberately, on top of the pair
  // on the record's own header: an entry is what gets quoted, copied into a
  // report and argued about, and an entry that cannot say which head it was
  // judged at sends the auditor back to the file it came from to find out.
  const record = {
    phase: n,
    trigger,
    discriminator,
    round,
    // Both spellings AND both ids, the shape `risk-check run` records: the
    // spelling is what the caller recognises, the id is the range's identity.
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // The ROSTER of voices that ran, which the entries alone cannot carry: a
    // fire where every voice returned nothing has no entries at all, and a
    // record that cannot say which voices ran is not evidence that any did.
    voices: built.voices,
    // WHETHER THE GROUNDING RAN, on the record itself: the absence of a
    // `citation_missing` mark below means "checked and found" only when this
    // says the check happened, and means nothing at all when it did not. No
    // COUNT rides it - the record stores none of its own, and a reader recounts
    // the marks the same way it recounts the rulings.
    citations: cites.checked ? { checked: true } : { checked: false, reason: cites.reason },
    entries: built.entries.map((e, i) => ({
      ...e,
      // MARKED, never dropped: the mark is the auditor's warning that this
      // citation cannot be opened at `head_id`, and the finding whose grounding
      // is in question is the last one a record may lose.
      ...(cites.missing.has(i) ? { citation_missing: true } : {}),
      base_id: range.base,
      head_id: range.head,
    })),
  };
  atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);

  // The counts ride the ENVELOPE and never the record (the record stores no
  // count of its own): a stored count is a second place for the record to
  // disagree with itself, and the cross-check that matters is between the
  // record and the trace receipt. `deriveCounts` recomputes these from the
  // stored entries for any later reader.
  return ok({
    phase: n,
    trigger,
    discriminator,
    round,
    record: rel,
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    voices: built.voices.length,
    counts: built.counts,
    // The count lives HERE and not on the record, where every figure is derived.
    citations: cites.checked
      ? { checked: true, missing: cites.missing.size }
      : { checked: false, reason: cites.reason },
  });
}

// ---------------------------------------------------------------------------
// deferred record - the QUEUE MEMBER a gate resolved `deferred` leaves behind.
//
// The sibling of the record above, and its opposite: that file says a fire was
// judged, this one says it was not yet. A `deferred` gate runs its reviewer,
// persists what came back and lets the run continue, so the finding stops the
// LAND rather than the RUN - and the only thing that makes that true is this
// artifact still being there, in the tree, at land time.
//
// COMMITTED, unlike the REVIEW file it sits beside (CONTEXT D-01).
// `.planning/trace.jsonl` is gitignored and `renderTrace` drops a phase's
// events at its `uat_verdict complete`, so a trace-resident queue evaporates on
// a fresh clone and again at sign-off while every in-session test stays green.
// Membership is this file EXISTING with no superseding `ADJUDICATION-*.json`
// beside it, never absence-of-record alone: every advisory fire also leaves a
// REVIEW file with no record.
//
// THE FINDINGS ARE STORED VERBATIM, not counted (lib/deferred-queue.mjs states
// why): `/cad-milestone` deletes the sibling REVIEW file, and a queue member
// whose bodies lived only there names a number nobody can triage.
//
// IT WRITES NO ADJUDICATION RECORD AND ADDS NO FOURTH RULING (D-09). `RULINGS`
// is frozen at three and a finding with no ruling is a refusal, so a record at
// fire time is impossible by construction rather than by convention.
// ---------------------------------------------------------------------------
function cmdDeferredRecord(dir, opts) {
  const id = fireIdentity('deferred record', opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head } = id;

  // The payload is a FILE for the reason the adjudication record's is: it is
  // verbatim reviewer text with arbitrary quoting, and one unescaped quote in a
  // heredoc makes it unparseable after the fire is over. It is the SAME file
  // the fire wrote to the sibling REVIEW-<trigger>-<discriminator>.md.
  if (opts.payload === undefined) {
    return fail('bad-args',
      'deferred record needs --payload <file> - the reviewer\'s returned object is a '
      + 'FILE, never inline JSON and never stdin',
      'pass --payload <path> naming the file the fire already wrote - the same object that went'
      + ' into the sibling REVIEW-<trigger>-<discriminator>.md');
  }
  const payload = readJsonPayload(opts.payload);
  if (!payload.ok) return;
  const queued = buildQueue(payload.value);
  if (!queued.ok) {
    return fail('bad-payload', queued.detail,
      'repair the payload file at the point the detail names, then re-run - nothing was queued, and'
      + ' an unqueued finding is one /cad-land will never see');
  }

  // RESOLVED, never the caller's spelling (D-08): a queue member is read at
  // land time, in another session, and `HEAD` will name a different commit by
  // then. An unresolvable range is a refusal rather than a member with null
  // ids - a queue entry whose head cannot be checked out cannot be triaged.
  const range = resolveRange(base, head);
  if (!range.ok) {
    return emit({
      ok: false,
      reason: 'unresolved-range',
      phase: n,
      base,
      head,
      detail: range.error,
      hint: 'name a --base and --head this repository can resolve, then re-run this record',
    });
  }

  const pdir = fireHome(dir, n, 'queue member');
  if (!pdir) return;

  const name = queueName(trigger, discriminator, round);
  const file = join(pdir, name);
  // Same derivation as the record's, and the same reason: a capped re-arm's
  // round-2 member is written into whichever home the round-1 member is in.
  const rel = relative(dir, file);
  // REFUSED, never overwritten, exactly as the record beside it is: a caller
  // that forgot `--round` on a re-arm would otherwise drop the round the land
  // refusal is still holding, silently, with ok:true. `lstatSync` - a symlink
  // at the target is something already there, whatever it points at.
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s deferred findings - this seam `
      + 'never overwrites a queue member',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  const record = {
    phase: n,
    trigger,
    discriminator,
    round,
    // Both spellings AND both ids, the shape the adjudication record and
    // `risk-check run` both use: the spelling is what the caller recognises,
    // the id is the range's identity.
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // VERBATIM, and no count beside them: a stored count is a second place for
    // the member to disagree with itself, and every reader of this file
    // recounts the array the way `deriveCounts` recounts an entry list.
    findings: queued.findings,
  };
  atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);

  return ok({
    phase: n,
    trigger,
    discriminator,
    round,
    record: rel,
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    findings: queued.findings.length,
  });
}

// ---------------------------------------------------------------------------
// deferred list - WHAT IS STILL QUEUED, and the one derivation every reader of
// that question runs.
//
// MEMBERSHIP IS A FILE EXISTING (CONTEXT D-01), never absence-of-record: a
// `DEFERRED-<trigger>-<discriminator>[-r<round>].json` whose `ADJUDICATION`
// sibling - the name `recordName` resolves for the SAME trigger, discriminator
// and round - is not beside it. Absence alone cannot be the test because every
// advisory fire also leaves a REVIEW file with no record beside it, so "no
// record here" describes the whole advisory arm as well as the queue.
//
// TWO HOMES AND NO THIRD. `.planning/phases/<N>/` is where a fire writes, and
// `.planning/deferred/<N>/` is where `deferred carry` moves what a milestone
// close is about to prune. An `_archive-<label>/` tree is deliberately out of
// reach: `milestone-prune --mode archive` puts it at the planning ROOT rather
// than under either home, and what it holds is a closed milestone's copy of
// work that was already carried - counting it would refuse every land after a
// close over findings that are no longer in the live tree.
//
// AN UNPROVABLE QUEUE IS NOT AN EMPTY ONE. A directory this cannot read, a
// member whose bytes do not parse, a symlink wearing a member's name: each
// lands on `unreadable` and the envelope answers `ok:false`, because the one
// caller that matters is a REFUSAL and reporting "nothing deferred" about input
// it could not read is the fail-open arm `decideGateHalt` already names for an
// unreadable findings payload. The counts still ride the refusal, so the
// operator sees what WAS provable beside what was not.
//
// NO FINDING BODIES CROSS THIS SEAM, only counts and identities - so the land
// refusal and the progress line print the answer directly instead of routing
// bulk reviewer text through a scratch file (RES-03). A triage reads the bodies
// out of the member file itself, whose path this names.
// ---------------------------------------------------------------------------

function cmdDeferredList(dir, opts) {
  let wantPhase = null;
  if ('phase' in opts) {
    const parsed = requirePhaseArg(opts.phase);
    if (!parsed.ok) {
      return fail('bad-args', 'deferred list --phase needs a phase number (N or N.M)',
        'send a plain phase number, or drop --phase to list every finding still queued across the'
        + ' milestone');
    }
    // The caller's OWN spelling, the way every other phase-addressed read in
    // this file works: the value is a directory component before it is
    // anything arithmetic, and `String(Number('08'))` names a different phase.
    wantPhase = parsed.raw;
  }
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  const q = readQueue(dir, wantPhase);
  const answer = {
    ...(wantPhase !== null ? { phase: wantPhase } : {}),
    members: q.members,
    findings: q.findings,
    unreadable: q.unreadable,
  };
  if (q.unreadable.length) {
    // ok:false, carrying the counts anyway. The question this seam answers is
    // "is anything still queued", and it could not answer it - so it says so
    // rather than handing a refusal surface a number that is only a floor.
    return emit({
      ok: false,
      reason: 'unprovable-queue',
      detail: `${q.unreadable.length} path(s) under ${dir} could not be read, so the queue `
        + `cannot be proven empty: ${q.unreadable.map((u) => u.path).join(', ')}`,
      hint: 'make them readable and re-run - an unreadable queue refuses a land exactly as a member does',
      ...answer,
    });
  }
  return ok(answer);
}

// ---------------------------------------------------------------------------
// deferred carry - the queue OUT of the phase directory a close is about to
// delete, so the refusal it feeds still has something to read.
//
// WHY A SEAM AND NOT A PROSE INSTRUCTION (D-10). The `risk_surface` union
// beside it in `workflows/milestone.md` is prose because it composes a
// TRANSIENT file the same close deletes at step 7. This one MOVES committed
// artifacts during a close that runs completely unattended - `/cad-milestone`
// chains `/cad-land` after the prune - and a prose step that half-ran there
// leaves the only thing stopping that land in a directory `milestone-prune` is
// about to remove.
//
// A MOVE AND NOT A COPY. `milestone-prune --mode archive` puts the phase
// directory under `_archive-<label>/`, which no reader here walks; a COPY would
// leave a second member inside it and, if that tree were ever read, one fire
// would be counted twice. A move also means the carried member is the only
// copy, which is what makes it clear when it is adjudicated.
//
// THE PHASE STAYS A DIRECTORY LEVEL, never folded into the filename: two phases
// routinely defer the same trigger on the same `plan-<k>` discriminator, so a
// flat carry would collide, and the collision would be one queue member
// silently replacing another's.
//
// A SETTLED MEMBER IS LEFT BEHIND to be pruned with its phase. It has its
// `ADJUDICATION` sibling, so it is not in the queue at all - carrying it would
// put a cleared finding in front of every later land.
// ---------------------------------------------------------------------------
function cmdDeferredCarry(dir, opts) {
  const parsed = requirePhaseArg(opts.phase);
  if (!parsed.ok) {
    return fail('bad-args', 'deferred carry needs --phase <N>',
      'pass --phase <N> for the phase whose queue is being carried out, then re-run - this runs'
      + ' BEFORE milestone-prune, which deletes the directory the members sit in');
  }
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // THE DESTINATION FIRST, before this seam has read a single member.
  // `lstatSync` and `isDirectory`, the rail `milestone-prune --mode archive`
  // states for its own archive root: a symlink or a regular file squatting the
  // destination is FOLLOWED by `renameSync`, which would deposit committed
  // artifacts wherever it points. Asked ahead of the queue read deliberately -
  // it is a fact about where things go, not about what is queued, and its
  // refusal is the actionable one. Absent is the ordinary case; the mkdir
  // below creates it.
  // EVERY component this seam creates, not only the last one. `lstatSync` does
  // not follow the FINAL component and follows every one before it, so a check
  // aimed at `deferred/<N>` alone answers "absent, go ahead" while the parent
  // is already a link out of the tree - and the `mkdirSync(recursive)` below
  // then builds `<wherever>/<N>` and `renameSync` fills it. `milestone-prune`'s
  // archive root escapes this because it sits ONE level under the planning root
  // and its single lstat therefore IS the intermediate check; this destination
  // sits two levels down, so it takes two.
  const carryRoot = join(dir, 'deferred');
  const rootStat = lstatSync(carryRoot, { throwIfNoEntry: false });
  if (rootStat && !rootStat.isDirectory()) {
    return fail('carry-dest-unusable',
      'deferred/ exists and is not a real directory'
      + `${rootStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
      + ' - move or remove it, then re-run',
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

  const dest = join(dir, 'deferred', n);
  const destStat = lstatSync(dest, { throwIfNoEntry: false });
  if (destStat && !destStat.isDirectory()) {
    return fail('carry-dest-unusable',
      `deferred/${n} exists and is not a real directory`
      + `${destStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
      + ' - move or remove it, then re-run',
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

  const q = readQueue(dir, n);
  // REFUSED before anything moves, and for a sharper reason than the reader
  // has: this call is the last thing that runs before `milestone-prune`
  // DELETES the directory. Carrying what was provable and saying nothing about
  // the rest would destroy exactly the members it could not read.
  if (q.unreadable.length) {
    return emit({
      ok: false,
      reason: 'unprovable-queue',
      phase: n,
      moved: [],
      unreadable: q.unreadable,
      detail: `${q.unreadable.length} path(s) under ${dir} could not be read, so this carry `
        + `cannot prove what phase ${n} has queued: ${q.unreadable.map((u) => u.path).join(', ')}`,
      hint: 'make them readable and re-run BEFORE milestone-prune, which deletes the directory',
    });
  }

  // Only what is still in the phase directory. A member already under
  // `deferred/<N>/` is where this face puts things, so a re-run after a partial
  // carry finishes the job instead of refusing it.
  const src = join(dir, 'phases', n);
  const moving = q.members.filter((m) => m.path.startsWith(`phases/${n}/`));
  if (!moving.length) {
    return ok({ phase: n, moved: [], carried: 0, findings: 0 });
  }

  // ALL destinations checked BEFORE the first rename, so a collision refuses
  // the whole carry rather than leaving half the queue in each home. Never
  // overwritten: a destination already holding this name is a member from an
  // earlier carry, and it is another fire's only copy.
  for (const m of moving) {
    const name = queueName(m.trigger, m.discriminator, m.round);
    if (lstatSync(join(dest, name), { throwIfNoEntry: false })) {
      return fail('carry-exists',
        `deferred/${n}/${name} already exists - this seam never overwrites a carried queue member`,
        'adjudicate or move it first; it is another fire\'s only copy of what was deferred');
    }
  }

  mkdirSync(dest, { recursive: true });
  const moved = [];
  for (const m of moving) {
    const name = queueName(m.trigger, m.discriminator, m.round);
    // The BASENAME is preserved so `deferred list` reads a carried member by
    // exactly the rule it reads a fresh one - the name is part of the identity.
    renameSync(join(src, name), join(dest, name));
    moved.push({
      trigger: m.trigger,
      discriminator: m.discriminator,
      round: m.round,
      from: m.path,
      to: `deferred/${n}/${name}`,
      findings: m.findings,
    });
  }
  return ok({
    phase: n,
    moved,
    carried: moved.length,
    findings: moved.reduce((t, m) => t + m.findings, 0),
  });
}

// ---------------------------------------------------------------------------
// renumber - phase insert/remove mechanics. Structured edits (Phase tokens,
// phases/K/ paths, dirs, cursor) are automated; lowercase prose refs are
// reported for the model to repair with judgment. --dry-run computes the full
// operation plan and touches nothing - it is what the confirmation gate shows.
// ---------------------------------------------------------------------------
function gitMv(from, to) {
  try { execFileSync('git', ['mv', from, to], { stdio: 'pipe' }); return 'git'; }
  catch { renameSync(from, to); return 'fs'; }
}

/**
 * Is there a `.git` entry at `from` or at any ancestor? A FILESYSTEM answer,
 * and deliberately not git's own: a `.git` at mode 000 makes `git status` and
 * `git rev-parse` alike exit 128 with `fatal: not a git repository`, byte-
 * identical to a directory that genuinely has no repository above it. So git's
 * exit code and its stderr cannot separate "unreadable" from "absent" at all,
 * and reading the message to try would be a parser over free text - the thing
 * `review-provider.mjs`'s "a diagnostic string never decides control flow" ban
 * exists to stop. The precedent for probing rather than parsing is
 * `gitIgnoreState` above.
 *
 * `lstatSync`, never `existsSync`: a dangling or unreadable symlink named
 * `.git` is still a repository this process could not read, and must count as
 * PRESENT. `existsSync` follows the link, finds nothing, and answers with the
 * permissive arm - the same failure mode `occupied` below was written for.
 *
 * Two states this walk cannot see on its own, both of which would otherwise
 * report ABSENT for a repository that is present:
 *   - `GIT_DIR`/`GIT_WORK_TREE` in the environment select a repository with no
 *     lexical `.git` anywhere above the work tree. The walk finds nothing while
 *     an object store holding the only copy of the work is very much there.
 *   - a probe that ERRORS - EACCES on an ancestor we may not stat, EIO, ESTALE -
 *     is a repository we could not rule OUT, never one we ruled out.
 * Both answer PRESENT. This gate's permissive arm ends in `rmSync`, so
 * "could not tell" and "definitely none" must not share it: the whole point of
 * the check is that an unread git state never reads as a clean one.
 * @param {string} from @returns {boolean}
 */
function gitDirAbove(from) {
  if (process.env.GIT_DIR || process.env.GIT_WORK_TREE) return true;
  try {
    let cur = resolvePath(from);
    for (;;) {
      if (lstatSync(join(cur, '.git'), { throwIfNoEntry: false })) return true;
      const up = dirname(cur);
      if (up === cur) return false;
      cur = up;
    }
  } catch { return true; }
}

/**
 * Is there a `.git` entry anywhere INSIDE `target`? The companion to
 * `gitDirAbove`, which starts at the planning root and looks UP - so a
 * repository rooted inside `phases/<N>` is invisible to it, an otherwise
 * non-repository tree answers ABSENT, and `rmSync` takes that nested object
 * store along with the directory. It is the same failure the caller's refusal
 * exists to stop, reached from the other side.
 *
 * Bounded by the phase directory's own size - a handful of markdown files and
 * a reports dir. A subtree we cannot read answers PRESENT for `gitDirAbove`'s
 * reason; a target that is not there at all answers ABSENT, since there is
 * nothing under it to protect. That is an errno test and not a message parse:
 * `review-provider.mjs`'s ban is on a diagnostic STRING deciding control flow.
 *
 * `lstatSync` per directory, never `e.name === '.git'` over the readdir: a
 * name comparison is case-SENSITIVE while the filesystem underneath may not be,
 * so an admin directory stored as `.GIT` on APFS or NTFS still resolves for git
 * and would be scanned straight past. Probing inherits the filesystem's own
 * case semantics, which is what `gitDirAbove` has always done - a guard whose
 * two halves disagree about what `.git` matches is one half open.
 *
 * Directory recursion is by `isDirectory()`, which is lstat-shaped, so a
 * symlink is never followed and the scan cannot leave the phase directory.
 * @param {string} target @returns {boolean}
 */
function gitDirUnder(target) {
  let entries;
  try {
    if (lstatSync(join(target, '.git'), { throwIfNoEntry: false })) return true;
    entries = readdirSync(target, { withFileTypes: true });
  } catch (e) { return !(e && e.code === 'ENOENT'); }
  for (const e of entries) {
    if (e.isDirectory() && gitDirUnder(join(target, e.name))) return true;
  }
  return false;
}

/**
 * Every path under `relPath` carrying uncommitted state - untracked (`??`),
 * ignored (`!!`), modified, staged, or deleted. All of them make a `remove`
 * unsafe, for two different reasons:
 *   - `??`/`!!`: `git rm -r` exits 0 and LEAVES them, so the directory
 *     survives a removal that reported success and the next move nests into
 *     it.
 *   - modified/staged: `git rm -r` REFUSES ("file has local modifications")
 *     and the caller's `rmSync` fallback then deletes the work anyway, with
 *     no copy in the object store to recover from.
 * Refusing on any porcelain output covers both, and leaves git's own
 * safety check intact instead of overriding it.
 *
 * Return shape: `{paths, unreadable}`, because a failed `git status` is TWO
 * states and answering `[]` for both is a fail-open that deletes. Outside a git
 * repo the call fails and `paths` is empty with `unreadable:false` - correctly,
 * since nothing is tracked there, the `rmSync` fallback removes the directory
 * whole, and no residue can survive to be nested into. But when `gitDirAbove`
 * finds a `.git` the call still failed against, the state is UNREADABLE: the
 * directory may hold tracked work whose only copy is in an object store this
 * process cannot open, and `[]` would classify it as clean and delete it.
 * `unreadable:true` is that third answer, and the caller refuses on it.
 * A record rather than a bare array costs nothing: this has exactly one caller.
 * `relPath` is relative to `cwd`, so this works whether the caller's `--dir`
 * is absolute or relative.
 * @param {string} cwd @param {string} relPath
 * @returns {{paths: string[], unreadable: boolean}}
 */
function uncommittedUnder(cwd, relPath) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--ignored', '--', relPath],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return {
      paths: out.split('\n').filter((l) => l.trim()).map((l) => l.slice(3).trim()),
      unreadable: false,
    };
  } catch {
    return { paths: [], unreadable: gitDirAbove(cwd) };
  }
}

// `existsSync` alone follows a symlink and reads a DANGLING one as free -
// the pre-flight would then pass and the apply dies mid-flight (renameSync
// onto a dangling symlink throws ENOTDIR). `lstatSync` catches the link
// itself even when its target is gone.
function occupied(p) { return existsSync(p) || !!lstatSync(p, { throwIfNoEntry: false }); }

function cmdRenumber(dir, sub, opts) {
  if (sub !== 'insert' && sub !== 'remove') return fail('usage', 'renumber <insert --at N | remove --n N> [--dry-run]');
  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmapText = read(roadmapFile);
  if (roadmapText === null) {
    return fail('no-roadmap', `${roadmapFile} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md - renumbering is computed FROM'
      + ' the roadmap, so there is nothing to renumber against without it');
  }
  const phases = parseRoadmapPhases(roadmapText);
  if (!phases.length) {
    return fail('unparseable-roadmap', 'no phase lines under ## Phases',
      'give ROADMAP.md at least one phase line spelled'
      + ' `- [ ] **Phase <n>: <name>** - <description>` under `## Phases`, then re-run - nothing was'
      + ' moved');
  }
  const total = phases.length;
  // Dir-move ceiling: integer phases only. Decimals are never shifted (see
  // below), and a decimal ceiling would walk fractional ks (2.1, 1.1, ...)
  // past every integer dir - moving nothing it should and the one dir it
  // must not (#36).
  const maxN = Math.max(...phases.filter((p) => Number.isInteger(p.n)).map((p) => p.n));

  const flag = sub === 'insert' ? 'at' : 'n';
  const rawAt = sub === 'insert' ? opts.at : opts.n;
  // A valueless flag parses as the boolean `true` and `Number(true)` is 1, so
  // `renumber remove --n` with no value cut phase 1's line, its detail section
  // and shifted its directory away - ok:true, and only the NaN screen stood
  // between the flag and the apply. requireInt refuses that shape and every
  // non-numeric one.
  //
  // The decimal answer stays a SEPARATE diagnostic (renumbering is integer
  // arithmetic; a decimal insertion like 2.1 neither displaces integers nor is
  // displaced by them, so operating ON one would only half-shift the tree).
  // requireInt refuses `2.1` and `--n` alike, and those are different repairs,
  // so a well-formed decimal is re-tested here and keeps its own wording.
  const parsedAt = requireInt(rawAt);
  // ABSENT only: a PRESENT `--at`/`--n` was already judged by its declared row
  // at the dispatch door, decimal wording included (see `decimalRefusal`), so
  // the well-formed-decimal re-test that used to sit here can no longer be
  // reached and is not left behind as a second home for that sentence.
  if (!parsedAt.ok) {
    return fail('bad-args', `renumber ${sub} needs --${flag} <N>`,
      `pass --${flag} <N> as a whole phase number, then re-run - nothing was moved; a valueless`
      + ' flag arrives here as `true` and would otherwise have meant phase 1');
  }
  const at = parsedAt.value;
  if (sub === 'insert' && (at < 1 || at > total + 1)) {
    return fail('out-of-range', `--at must be 1..${total + 1}`,
      `pick a position inside that range - ${total + 1} appends after the last phase - then re-run;`
      + ' nothing was moved');
  }
  if (sub === 'remove' && !phases.some((p) => p.n === at)) {
    return fail('unknown-phase', `phase ${at} is not in ROADMAP.md`,
      "re-run with a phase number that appears in ROADMAP.md's `## Phases` list; nothing was"
      + ' moved');
  }

  const delta = sub === 'insert' ? 1 : -1;
  const shiftFrom = sub === 'insert' ? at : at + 1;

  // Directory moves, in collision-safe order.
  const dirMoves = [];
  const existingDir = (k) => existsSync(join(dir, 'phases', String(k)));
  if (sub === 'insert') {
    for (let k = maxN; k >= at; k--) if (existingDir(k)) dirMoves.push([k, k + 1]);
  } else {
    for (let k = at + 1; k <= maxN; k++) if (existingDir(k)) dirMoves.push([k, k - 1]);
  }

  // Pre-flight: refuse before any write if a move's destination is occupied
  // by something this renumber does not itself vacate (D-04). `vacated`
  // tracks numbers freed by moves already checked (plus `at` on a remove,
  // freed by the rm before any move runs) - without it, an ordinary insert's
  // OWN chain of destinations (e.g. 3->4 then 2->3, where phases/3 exists at
  // check time as move 1's still-unmoved source) would refuse itself. This
  // must run before the `git rm` below: on a remove, the rm destroys a phase
  // directory before the first move, so a check placed after it would report
  // the collision only once the data is already gone.
  // Seeded only when the rm will actually RUN: `existingDir` is existsSync,
  // which is false for a dangling symlink at phases/<at>, so seeding
  // unconditionally waved through exactly the occupant `occupied()`/lstatSync
  // was added to catch - the apply then died on the first move and reported a
  // half-renumbered tree when nothing had been written at all.
  const vacated = new Set(sub === 'remove' && existingDir(at) ? [String(at)] : []);
  for (const [f, t] of dirMoves) {
    const dest = join(dir, 'phases', String(t));
    if (occupied(dest) && !vacated.has(String(t))) {
      return fail('collision',
        `phases/${t} already exists and is not a phase this renumber vacates - move or delete it first`,
        'ls .planning/phases');
    }
    vacated.add(String(f));
  }

  // The `vacated` seeding above assumes the rm actually FREES phases/<at>.
  // `git rm -r -q` breaks that assumption silently: it exits 0 while leaving
  // untracked and ignored files behind, so the directory survives, the first
  // move NESTS the next phase inside it (phases/1/2/PLAN.md), and the command
  // still exits ok:true with ROADMAP naming a phase whose dir has no plan -
  // the exact D-04 nesting hazard, reached through the rm rather than a stray
  // dir. Verified live. Refuse before any write instead of deleting the
  // residue: it is the caller's uncommitted work, and `remove` is not a
  // licence to discard it.
  if (sub === 'remove' && existingDir(at)) {
    const dirty = uncommittedUnder(dir, join('phases', String(at)));
    // A git that could not ANSWER is its own refusal, never `uncommitted-work`:
    // that reason's remedy is "commit or discard them first", which is the one
    // thing a caller whose repository is unreadable cannot do. This sits above
    // the dry-run return below, so both arms refuse - the dry-run is what the
    // workflow's confirmation gate shows, and a gate that displays a clean plan
    // is what talks the caller into the apply.
    if (dirty.unreadable) {
      return fail('unreadable-git-state',
        `phases/${at} sits under a git repository whose state could not be read, so whether it holds uncommitted work is unknown - removing it could destroy work only git can recover`,
        `restore read access to the repository's git directory (ls -ld .git), then re-run; the removal stays refused until git can answer for .planning/phases/${at}`);
    }
    if (dirty.paths.length) {
      return fail('uncommitted-work',
        `phases/${at} holds ${dirty.paths.length} file(s) with uncommitted state (e.g. ${dirty.paths[0]}) - commit or discard them first; removing the phase would destroy work git cannot recover`,
        `git status --porcelain --ignored -- .planning/phases/${at}`);
    }
  }

  // File edits, computed up front.
  let newRoadmap = roadmapText;
  if (sub === 'remove') {
    newRoadmap = newRoadmap.split('\n')
      .filter((l) => !new RegExp(`^- \\[( |x)\\] \\*\\*Phase ${at}: `).test(l)).join('\n');
    newRoadmap = cutPhaseDetail(newRoadmap, at);
  }
  const roadmapShift = shiftPhaseTokens(newRoadmap, shiftFrom, delta);
  newRoadmap = roadmapShift.text;

  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  const orphanedReqs = [];
  let newReqText = null;
  if (reqText !== null) {
    let t = reqText;
    if (sub === 'remove') {
      for (const r of parseRequirements(t)) if (r.phase === at) orphanedReqs.push(r.id);
      // Blank the orphaned rows' Phase cell so they surface as no-phase in
      // audit rather than silently pointing at the shifted neighbor.
      t = t.split('\n').map((line) => {
        const cells = line.match(/^(\|[^|]*\|)([^|]*)(\|[^|]*\|.*)$/);
        if (cells && new RegExp(`\\bPhase ${at}\\b`).test(cells[2])) return `${cells[1]}  ${cells[3]}`;
        return line;
      }).join('\n');
    }
    newReqText = shiftPhaseTokens(t, shiftFrom, delta).text;
  }

  const stateFile = join(dir, 'STATE.md');
  const cursor = parseCursor(read(stateFile) || '');
  let newCursor = null;
  let warn;
  if (cursor) {
    newCursor = { ...cursor, total: total + delta };
    // The phase NUMBER only ever shifts for an integer cursor. A decimal
    // cursor's own ROADMAP token and phases/<phase>/ dir are never shifted
    // either (see decimalPhases below), so moving just the cursor's number
    // would desync it from the phase it actually names - shifting nowhere
    // else is exactly why the number stays put here too. total still moves:
    // the roadmap genuinely gained or lost a phase, so the denominator is
    // still true even while the numerator is left for the caller to re-point.
    if (cursor.phase >= shiftFrom) {
      if (Number.isInteger(cursor.phase)) {
        newCursor.phase = cursor.phase + delta;
      } else {
        warn = `cursor sits on decimal phase ${cursor.phase}, which renumber ` +
          `never shifts (its ROADMAP token and phases/${cursor.phase}/ did not ` +
          `move either); total is now ${total + delta} - re-point it (cursor set)`;
      }
    }
    if (sub === 'remove' && cursor.phase === at) {
      warn = `cursor points at removed phase ${at}; number left as-is - re-point it (cursor set)`;
    }
  }

  // Prose refs the shift leaves alone - the model repairs these with judgment.
  const inTextRefs = [];
  for (const f of ['ROADMAP.md', 'REQUIREMENTS.md', 'STATE.md', 'PROJECT.md']) {
    const t = read(join(dir, f));
    if (t === null) continue;
    for (const ref of findProsePhaseRefs(t, shiftFrom)) inTextRefs.push({ file: f, ...ref });
  }

  // Decimal phases are never shifted (see shiftPhaseTokens) - report them so
  // the caller re-places them deliberately instead of discovering the gap.
  const decimalPhases = phases.filter((p) => !Number.isInteger(p.n)).map((p) => p.n);

  const ops = [
    ...dirMoves.map(([f, t]) => ({ git_mv: [`phases/${f}`, `phases/${t}`] })),
    ...(sub === 'remove' && existingDir(at) ? [{ rm: `phases/${at}` }] : []),
    { edit: 'ROADMAP.md', changes: roadmapShift.count + (sub === 'remove' ? 1 : 0) },
    ...(newReqText !== null ? [{ edit: 'REQUIREMENTS.md', changes: orphanedReqs.length ? orphanedReqs.length : undefined }] : []),
    ...(newCursor ? [{ edit: 'STATE.md', changes: 1 }] : []),
  ];

  const result = {
    ops,
    ...(inTextRefs.length ? { in_text_refs: inTextRefs } : {}),
    ...(orphanedReqs.length ? { orphaned_reqs: orphanedReqs } : {}),
    ...(decimalPhases.length ? { decimal_phases: decimalPhases } : {}),
    ...(warn ? { warn } : {}),
    ...(sub === 'insert' ? { slot: `add the new "- [ ] **Phase ${at}: ...**" line and its detail section` } : {}),
  };
  if ('dry-run' in opts) return ok({ dry_run: true, ...result });

  // Apply: an ordered step list, run under one guard. NOTE the order is the
  // rm first, then the moves - which is NOT the order `ops` above displays
  // (it lists moves first, and a shipped test pins that). `ops` is the plan
  // shown at the dry-run gate; `completed` below is the record of what
  // actually ran, and it is the authority when the two disagree. Replaying
  // the printed `ops` order by hand on a remove would `git mv` onto a
  // still-present directory and NEST it (the D-04 hazard). This is a
  // partial-state REPORT, not a rollback - `remove` destroys phases/<at>
  // before the first move runs, so step one can never be undone. Advertising
  // a rollback the code lacks would be worse than a generic failure, because
  // the caller would stop checking the tree by hand (D-03).
  /** @type {Array<[Record<string, any>, () => void]>} */
  const steps = [];
  if (sub === 'remove' && existingDir(at)) {
    steps.push([{ rm: `phases/${at}` }, () => {
      // `cwd: dir`, matching the pre-flight's own `git status` call. Without it
      // git discovers the repository from the CALLER's cwd, which for any
      // `--dir` outside it is a different repository or none - git answers
      // `'<path>' is outside repository` and every remove fell through to the
      // `rmSync` below, tracked work and all. The pre-flight has always read
      // the right repo; this step did not, so the two disagreed about which
      // repository the phase belongs to.
      try { execFileSync('git', ['rm', '-r', '-q', join(dir, 'phases', String(at))], { cwd: dir, stdio: 'pipe' }); }
      catch {
        // The recursive delete is the destructive act this whole command is
        // built around, so it gets its OWN gate rather than trusting the
        // pre-flight's. The guard is repeated here deliberately: the pre-flight
        // ran before the roadmap was even computed, and a git state can become
        // unreadable between the two - and this arm also fires on a `git rm`
        // failure the pre-flight did not predict at all, which inside a
        // repository means git disagrees with the clean answer the pre-flight
        // got. Either way the object store is the only copy of what is about to
        // go, and `rmSync` is a delete with nothing behind it. With no
        // repository at, above OR inside the target there is no object store to
        // consult and no residue that could survive to be nested into, so the
        // fallback stays the only remover - the bare-tree path every renumber
        // fixture runs on. `gitDirUnder` carries the "inside" half: looking up
        // from the planning root cannot see a repository rooted in the very
        // directory this is about to delete recursively.
        const target = join(dir, 'phases', String(at));
        if (gitDirAbove(dir) || gitDirUnder(target)) {
          // Worded to what is actually known. `git rm` failing does not prove
          // the repository is unreadable - it proves the git state this delete
          // depends on went UNREAD, which covers both a `.git` we cannot open
          // and an answer we did not predict. Claiming the stronger fact would
          // be this milestone's own defect: a verdict the check did not earn.
          throw new Error(`git rm -r failed for phases/${at} and a git repository sits at, above or inside it, so the git state this delete depends on is unread - refusing the recursive fallback, since the object store may hold the only copy; run \`git rm -r -- .planning/phases/${at}\` from the repository to see git's own answer`);
        }
        rmSync(target, { recursive: true });
      }
    }]);
  }
  for (const [f, t] of dirMoves) {
    steps.push([{ git_mv: [`phases/${f}`, `phases/${t}`] },
      () => gitMv(join(dir, 'phases', String(f)), join(dir, 'phases', String(t)))]);
  }
  steps.push([{ edit: 'ROADMAP.md' }, () => atomicWrite(roadmapFile, newRoadmap)]);
  if (newReqText !== null) steps.push([{ edit: 'REQUIREMENTS.md' }, () => atomicWrite(reqFile, newReqText)]);
  if (newCursor) steps.push([{ edit: 'STATE.md' }, () => atomicWrite(stateFile, renderCursor(newCursor))]);

  // Stop at the FIRST throw: once a step fails the tree no longer matches the
  // plan every later step was computed from, so running them on would compound
  // the disagreement rather than salvage anything. lib/file-transition.mjs
  // keeps the ordering and the completed/failed record; the envelope below is
  // this seam's own, because prune's is a different shape entirely (D-02).
  const applied = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!applied.ok) {
    const { key: op, error: e } = applied.failures[0];
    // Bypasses the dispatch-level catch (which flattens to `internal`) and
    // fail()'s reason/detail/hint-only shape - a completed-ops list needs
    // its own emit (D-11).
    return emit({
      ok: false, reason: 'partial-apply', completed: applied.completed, failed: op,
      detail: e && e.message ? e.message : String(e),
      // Deliberately does NOT say "re-run". The half-applied tree no longer
      // matches ROADMAP, and a re-run recomputes its plan FROM ROADMAP: on
      // a remove it would rm phases/<at>, which now holds the NEXT phase's
      // work, and exit ok:true having destroyed it. Verified live.
      hint: applied.completed.length
        ? 'the tree is partly renumbered and no longer matches ROADMAP - reconcile the completed ops by hand before any further renumber; re-running this command against the half-applied tree can destroy a phase directory'
        : 'nothing was written - the first step failed, so the tree is unchanged and safe to re-run once the cause is fixed',
    });
  }

  // Sanity recount: every ROADMAP phase maps to at most one dir, none stray.
  const after = parseRoadmapPhases(read(roadmapFile) || '');
  ok({ ...result, total: after.length });
}

function parseArgs(argv) {
  const words = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      // A flag followed by another flag (or nothing) is boolean, e.g. --undo.
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { opts[a.slice(2)] = true; }
      else { opts[a.slice(2)] = next; i++; }
    } else words.push(a);
  }
  return { words, opts };
}

// Handlers take the trailing positional words as a 4th argument; only
// `recall` needs it (its query is free text, not a fixed subcommand), and
// widening the signature beats special-casing one command in the dispatcher.
/** @type {Record<string, (dir: string, sub: string, opts: any, rest: string[]) => void>} */
const COMMANDS = {
  status: (dir, _sub, _opts) => cmdStatus(dir),
  cursor: (dir, sub, opts) => {
    if (sub === 'get') return cmdCursorGet(dir);
    if (sub === 'set') return cmdCursorSet(dir, opts);
    return fail('usage', 'cursor <get|set>');
  },
  'phase-done': (dir, _sub, opts) => cmdPhaseDone(dir, opts),
  uat: (dir, sub, opts) => cmdUat(dir, sub, opts),
  reads: (dir, _sub, opts) => cmdReads(dir, opts),
  audit: (dir, _sub, _opts) => cmdAudit(dir),
  'criteria-coverage': (dir, _sub, _opts) => cmdCriteriaCoverage(dir),
  'criteria-size': (dir, _sub, opts) => cmdCriteriaSize(dir, opts),
  'plan-overlap': (dir, _sub, opts) => cmdPlanOverlap(dir, opts),
  'plan-size': (dir, _sub, opts) => cmdPlanSize(dir, opts),
  // The read-back count (RBK-01). ONE word, never a two-word spelling, for the
  // reason the `adjudication` arm below states: `subcommandKey` consumes a
  // second word only for the `TWO_WORD` families.
  'cite-count': (dir, _sub, opts) => cmdCiteCount(dir, opts),
  'seed-reqs': (dir, _sub, opts) => cmdSeedReqs(dir, opts),
  // Bare words are JOINED, never rejected: every workflow caller quotes, so
  // rejecting extras would turn a today-degraded interactive call into a hard
  // failure. tokenize() splits on non-alphanumerics, so the separator is
  // immaterial; `[].join(' ')` is '', which still trips the bad-args guard.
  recall: (dir, _sub, opts, rest) => cmdRecall(dir, rest.join(' '), opts),
  // The record a `/cad-task` run leaves (FST-01). ONE word, never a two-word
  // spelling, for the reason the `adjudication` arm below states:
  // `subcommandKey` consumes a second word only for the `TWO_WORD` families.
  'task-record': (dir, _sub, opts) => cmdTaskRecord(dir, opts),
  'lease-check': (dir, _sub, opts) => cmdLeaseCheck(dir, opts),
  // --root, never --dir: this one names the PROJECT root. A `--root` with
  // nothing usable after it is refused rather than silently answered about the
  // cwd, which would report a different tree than the caller named (#42/#45) -
  // and the refusal is the DECLARED row's now, applied at the dispatch door
  // below, rather than a predicate this arm restates. The row says the same
  // thing the predicate did, trim clause included: `--root ""` answered
  // `ok:true` about the cwd and `--root "   "` fell through to a `no-root`
  // ENOENT, one refusal vocabulary answering in two.
  'detect-commands': (_dir, _sub, opts) =>
    cmdDetectCommands(typeof opts.root === 'string' ? opts.root : process.cwd()),
  // Same --root row, same refusal, same door. `--answered` carries the set a
  // config layer already holds, so the re-entrant ask reaches the same option
  // rule the first fire does; absent means nobody has answered.
  'detect-surfaces': (_dir, _sub, opts) =>
    cmdDetectSurfaces(typeof opts.root === 'string' ? opts.root : process.cwd(),
      'answered' in opts ? opts.answered : undefined),
  trace: (dir, sub, opts) => cmdTrace(dir, sub, opts),
  'risk-check': (dir, sub, opts) => cmdRiskCheck(dir, sub, opts),
  // The gate fire's per-finding rulings, beside the sibling REVIEW file. ONE
  // word, never a two-word spelling: `subcommandKey` consumes a second word only
  // for the `TWO_WORD` families, and one operation does not earn widening it.
  adjudication: (dir, _sub, opts) => cmdAdjudication(dir, opts),
  // The DEFERRED gate's queue member, beside that same REVIEW file. TWO words,
  // unlike `adjudication` above: this is one of three operations on the queue,
  // which is the `risk-check run|status` precedent for widening `TWO_WORD`
  // rather than the single-operation `adjudication` one.
  deferred: (dir, sub, opts) => {
    if (sub === 'record') return cmdDeferredRecord(dir, opts);
    if (sub === 'list') return cmdDeferredList(dir, opts);
    if (sub === 'carry') return cmdDeferredCarry(dir, opts);
    return fail('usage', 'deferred record|list|carry');
  },
  // `--file` overrides `<dir>/CAPTURE.md` for `/cad-capture --cadence`'s global
  // queue, which sits beside the global config layer and not in any `.planning`.
  capture: (dir, _sub, opts) => cmdCapture(dir, opts),
  // Same `--file` override, and STANDALONE beside `status` rather than a
  // drift kind inside it (D-07) - see cmdCaptureSections.
  'capture-sections': (dir, _sub, opts) => cmdCaptureSections(dir, opts),
  // --root, never --dir, for the reason stated above cmdDebtHarvest: it scans
  // SOURCE and writes into `.planning`. Same declared row, same door.
  'debt-harvest': (_dir, _sub, opts) =>
    cmdDebtHarvest(typeof opts.root === 'string' ? opts.root : process.cwd()),
  renumber: (dir, sub, opts) => cmdRenumber(dir, sub, opts),
  'milestone-prune': (dir, _sub, opts) => cmdMilestonePrune(dir, opts),
};

try {
  const { words, opts } = parseArgs(ARGV);
  const [cmd, sub] = words;
  // EVERY flag the resolved row declares is judged here, at the door, before
  // any handler runs - not just `--dir`, and not at the two sites this file
  // used to consult its own table from. 98 of the table's entries are this
  // script's, and while only two of them were read, a row could say `refuse`
  // while the CLI wrote the value through: `cursor set --name` (bare) answered
  // ok:true and wrote `Phase: 1 of 5 (true)` into STATE.md.
  //
  // It is read from raw ARGV on purpose: parseArgs mints the boolean `true` for
  // a bare flag, so by the time a value reaches `opts` the three spellings a
  // declared row separates - bare, empty and flag-shaped - have collapsed into
  // one. A bare `--dir` reached `existsSync(true)` that way and printed a
  // DEP0187 deprecation warning on STDERR beside the answer, and stdout is the
  // single channel the seam layer parses.
  //
  // The door judges PRESENCE-free: an absent flag is left to the handler that
  // owns its wording, so `cursor set` with no `--phase` still answers `cursor
  // set needs --phase <N>` and `capture` with no `--kind` still names its three
  // kinds. The `'*'` row is evaluated first, which keeps `--dir`'s refusal the
  // one that answers ahead of an unknown subcommand exactly as it did.
  //
  // `opts` is deliberately NOT mutated. The handlers pass their own values to
  // `requireInt`, `requirePhaseArg` and `resolveTextFlag`, and overwriting or
  // deleting a key here would change what `resolveTextFlag` sees and silently
  // drop its "takes --x or --x-file, never both" refusal.
  //
  // The refusal is `fail('bad-args', ...)` and never the `missing-flag-value`
  // throw the seam-input readers raise (D-07): this file has ONE refusal
  // vocabulary and no `e.seam` catch arm to render that throw as anything but
  // `internal`.
  const args = evaluateRow(ARGV, CONTRACTS['planning.mjs'], subcommandKey(words));
  const handler = COMMANDS[cmd];
  if (!args.ok) {
    fail('bad-args', argRefusal(subcommandKey(words), args.detail),
      'correct the flag the detail names and re-run - nothing was written. A value that itself'
      + ' starts with `--` cannot be protected by a bare `--` separator here: every `--`-prefixed'
      + ' word is read as a flag that consumes the next one, so send such a value through the'
      + ' matching `--<name>-file` flag where one exists');
  }
  else if (!handler) fail('usage', `subcommand: ${Object.keys(COMMANDS).join(' | ')} (got: ${cmd || 'none'})`);
  else handler(args.values['--dir'] || '.planning', sub, opts, words.slice(1));
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
