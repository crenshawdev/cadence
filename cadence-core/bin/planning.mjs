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
//   replay-check --phase N [--rerun]
//                                   has this phase's work already been
//                                   committed - every plan's
//                                   reports/plan-<k>.md first line reading
//                                   PLAN COMPLETE - and which plans still need
//                                   dispatching. `replay` and `dispatch_set`
//                                   are what cad-execute's locate step acts on;
//                                   --rerun clears the first and widens the
//                                   second to every plan
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

import {
  evaluateRow, evaluatePresence, subcommandKey, CONTRACTS, PRESENCE_RULES,
} from './lib/arg-contract.mjs';
// The shared core every command module under planning/ imports too (D-03). `ok`,
// `fail`, `read` and `HERE` are declared THERE and nowhere else, and a command
// module could not reach them here in any case: importing this file RUNS the
// dispatch at the foot of it. What the door itself needs is the raw argument
// list, the refusal composer and `fail`.
import { ARGV, argRefusal, fail } from './planning/core.mjs';
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
import { cmdReplayCheck } from './planning/replay-check.mjs';
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
import { cmdCaptureCheck } from './planning/capture-check.mjs';
import { cmdDebtHarvest } from './planning/debt-harvest.mjs';
import { cmdMilestonePrune } from './planning/milestone-prune.mjs';
import { cmdTrace } from './planning/trace.mjs';
import { cmdRiskCheck } from './planning/risk-check.mjs';
import { cmdAdjudication } from './planning/adjudication.mjs';
import { cmdDeferredRecord } from './planning/deferred-record.mjs';
import { cmdDeferredList } from './planning/deferred-list.mjs';
import { cmdDeferredCarry } from './planning/deferred-carry.mjs';
import { cmdRenumber } from './planning/renumber.mjs';

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
  'replay-check': (dir, _sub, opts) => cmdReplayCheck(dir, opts),
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
  // ONE WORD, not `capture check`: `subcommandKey` consumes a second word only
  // for the families in `TWO_WORD`, and one operation does not earn widening
  // that Set. Standalone for the same reason its sibling is, and reporting
  // rather than refusing - see cmdCaptureCheck.
  'capture-check': (dir, _sub, opts) => cmdCaptureCheck(dir, opts),
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
  //
  // And the ONE presence question a row cannot state, declared in
  // lib/arg-contract.mjs beside `CONTRACTS` rather than written out here so the
  // flags it names are the flags that same row declares: a `trace append` whose
  // `--event` SETTLES a review fire owes at least one of the settled figures.
  // Without it a `gate_pass` carrying none of them cleared a blocking range
  // while asserting nothing about it (RSK-08, UAT item 3).
  //
  // The refusal is the SECOND arm of the chain below and never the first, so a
  // malformed value keeps naming its own flag: `--survivors abc` stays a
  // `--survivors` refusal rather than becoming a "you owe me a figure" one, and
  // arg-contract-adoption.test.mjs's spawned walk keeps refusing exactly where
  // it already does. It is inside the chain for the reason the whole chain
  // exists: `fail` emits and RETURNS, so a second refusal outside it prints a
  // second JSON line beside the handler's own.
  //
  // The event NAME is knowledge this door is allowed to hold. It is the SEAM -
  // planning/trace.mjs - that states it carries no runtime refusal keyed to an
  // event name, and planning/risk-check.mjs's `if (e.event === 'override')` arm
  // is the shipped precedent for the same knowledge living outside it.
  const key = subcommandKey(words);
  const args = evaluateRow(ARGV, CONTRACTS['planning.mjs'], key);
  const owed = evaluatePresence(ARGV, PRESENCE_RULES['planning.mjs'], key);
  const handler = COMMANDS[cmd];
  if (!args.ok) {
    fail('bad-args', argRefusal(key, args.detail),
      'correct the flag the detail names and re-run - nothing was written. A value that itself'
      + ' starts with `--` cannot be protected by a bare `--` separator here: every `--`-prefixed'
      + ' word is read as a flag that consumes the next one, so send such a value through the'
      + ' matching `--<name>-file` flag where one exists');
  }
  else if (!owed.ok) {
    fail('bad-args', `${key} ${owed.flag} ${owed.value} needs at least one of `
      + `${owed.requires.join(', ')} - the settled figures this receipt reports`,
      'a receipt that settles a review fire carries the counts the `adjudication` envelope'
      + ' returned, zeroes included, so the seam can recount them against the committed record'
      + ' - add them and re-run. A receipt that settles nothing takes no figures: send `--event'
      + ' rearm` or `--event deferral` instead. Nothing was written');
  }
  else if (!handler) fail('usage', `subcommand: ${Object.keys(COMMANDS).join(' | ')} (got: ${cmd || 'none'})`);
  else handler(args.values['--dir'] || '.planning', sub, opts, words.slice(1));
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
