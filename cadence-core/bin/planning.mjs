#!/usr/bin/env node
// @ts-check
// planning.mjs - the .planning state-machine seam: invariants live here so workflow prose keeps the judgment
// The JSON shapes asserted in planning.test.mjs are the interface, there is no spec file beyond them
// One JSON object on stdout: {ok:true,...} exit 0, or {ok:false, reason, detail?, hint?} exit 1
// Every parse problem degrades to ok:false, so this never blocks the spine
// Fields are additive-only, so don't rename one
// --dir overrides `.planning` for tests; --root names the project root for commands that read source
// A new subcommand is a COMMANDS entry, never an if-chain
// Before a handler runs, planning/migrate.mjs gives the project its state file (records/state.json) if it has none
'use strict';

import {
  evaluateRow, evaluatePresence, subcommandKey, CONTRACTS, PRESENCE_RULES,
} from './lib/arg-contract.mjs';
// ok, fail, read and HERE live in core.mjs; importing this file runs the dispatch, so modules can't take them from here
import { ARGV, argRefusal, fail } from './planning/core.mjs';

function parseArgs(argv) {
  const words = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      // a flag with no value after it is boolean, like --undo
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { opts[a.slice(2)] = true; }
      else { opts[a.slice(2)] = next; i++; }
    } else words.push(a);
  }
  return { words, opts };
}

// handlers get the trailing positional words as a 4th argument; only `recall` uses it, for its free-text query
// each arrow imports on call, inside the try, so a load failure is still ok:false internal
/** @type {Record<string, (dir: string, sub: string, opts: any, rest: string[]) => Promise<unknown>>} */
const COMMANDS = {
  status: async (dir, _sub, _opts) => (await import('./planning/status.mjs')).cmdStatus(dir),
  cursor: async (dir, sub, opts) => {
    if (sub === 'get') return (await import('./planning/cursor-get.mjs')).cmdCursorGet(dir);
    if (sub === 'set') return (await import('./planning/cursor-set.mjs')).cmdCursorSet(dir, opts);
    return fail('usage', 'cursor <get|set>');
  },
  'phase-done': async (dir, _sub, opts) =>
    (await import('./planning/phase-done.mjs')).cmdPhaseDone(dir, opts),
  uat: async (dir, sub, opts) => (await import('./planning/uat.mjs')).cmdUat(dir, sub, opts),
  reads: async (dir, _sub, opts) => (await import('./planning/reads.mjs')).cmdReads(dir, opts),
  audit: async (dir, _sub, _opts) => (await import('./planning/audit.mjs')).cmdAudit(dir),
  'criteria-coverage': async (dir, _sub, _opts) =>
    (await import('./planning/criteria-coverage.mjs')).cmdCriteriaCoverage(dir),
  'criteria-size': async (dir, _sub, opts) =>
    (await import('./planning/criteria-size.mjs')).cmdCriteriaSize(dir, opts),
  'plan-overlap': async (dir, _sub, opts) =>
    (await import('./planning/plan-overlap.mjs')).cmdPlanOverlap(dir, opts),
  'replay-check': async (dir, _sub, opts) =>
    (await import('./planning/replay-check.mjs')).cmdReplayCheck(dir, opts),
  'plan-size': async (dir, _sub, opts) =>
    (await import('./planning/plan-size.mjs')).cmdPlanSize(dir, opts),
  'cite-count': async (dir, _sub, opts) =>
    (await import('./planning/cite-count.mjs')).cmdCiteCount(dir, opts),
  'seed-reqs': async (dir, _sub, opts) =>
    (await import('./planning/seed-reqs.mjs')).cmdSeedReqs(dir, opts),
  // bare words are joined, not rejected: rejecting extras would turn a soft degrade into a hard failure
  recall: async (dir, _sub, opts, rest) =>
    (await import('./planning/recall.mjs')).cmdRecall(dir, rest.join(' '), opts),
  'task-record': async (dir, _sub, opts) =>
    (await import('./planning/task-record.mjs')).cmdTaskRecord(dir, opts),
  'lease-check': async (dir, _sub, opts) =>
    (await import('./planning/lease-check.mjs')).cmdLeaseCheck(dir, opts),
  brief: async (dir, _sub, opts) => (await import('./planning/brief.mjs')).cmdBrief(dir, opts),
  // --root, never --dir, since it names the PROJECT root
  // a --root with nothing usable after it is refused at the door, or it answers about the cwd and not the tree named
  'detect-commands': async (_dir, _sub, opts) =>
    (await import('./planning/detect-commands.mjs'))
      .cmdDetectCommands(typeof opts.root === 'string' ? opts.root : process.cwd()),
  // same --root row and refusal; --answered carries what a config layer already holds, absent means nobody answered
  'detect-surfaces': async (_dir, _sub, opts) =>
    (await import('./planning/detect-surfaces.mjs'))
      .cmdDetectSurfaces(typeof opts.root === 'string' ? opts.root : process.cwd(),
        'answered' in opts ? opts.answered : undefined),
  trace: async (dir, sub, opts) => (await import('./planning/trace.mjs')).cmdTrace(dir, sub, opts),
  'risk-check': async (dir, sub, opts) =>
    (await import('./planning/risk-check.mjs')).cmdRiskCheck(dir, sub, opts),
  // --root, never --dir, same as detect-commands
  'test-policy': async (dir, sub, opts) =>
    (await import('./planning/testing-policy.mjs')).cmdTestPolicy(dir, sub, opts),
  // per-finding rulings from a gate fire, kept beside the sibling REVIEW file
  adjudication: async (dir, _sub, opts) =>
    (await import('./planning/adjudication.mjs')).cmdAdjudication(dir, opts),
  // the adjudicated gate's Markdown review file; the other gates keep their JSON
  'review-file': async (dir, _sub, opts) =>
    (await import('./planning/review-file.mjs')).cmdReviewFile(dir, opts),
  // makes a phase's records folder for a writer that cannot, such as the advisory reviewer's heredoc
  'records-dir': async (dir, _sub, opts) =>
    (await import('./planning/records-dir.mjs')).cmdRecordsDir(dir, opts),
  // a finished review-panel run, read from its run file, becomes the record's payload and the review file's input
  'workflow-run': async (dir, _sub, opts) =>
    (await import('./planning/workflow-run.mjs')).cmdWorkflowRun(dir, opts),
  // may a workflow launch now: take answers launch or names the holder, release frees only the caller's own claim
  'workflow-claim': async (dir, sub, opts) =>
    (await import('./planning/workflow-claim.mjs')).cmdWorkflowClaim(dir, sub, opts),
  // the facts layer, two words like `workflow-claim`; --dir names .planning and the project root is its parent
  codemap: async (dir, sub, opts) => (await import('./planning/codemap.mjs')).cmdCodemap(dir, sub, opts),
  // moves the risk_surface rulings out of a phase directory before a milestone close deletes it
  'risk-carry': async (dir, _sub, opts) =>
    (await import('./planning/risk-carry.mjs')).cmdRiskCarry(dir, opts),
  // three operations, so two words, like `risk-check run|status`
  deferred: async (dir, sub, opts) => {
    if (sub === 'record') {
      return (await import('./planning/deferred-record.mjs')).cmdDeferredRecord(dir, opts);
    }
    if (sub === 'list') return (await import('./planning/deferred-list.mjs')).cmdDeferredList(dir, opts);
    if (sub === 'carry') {
      return (await import('./planning/deferred-carry.mjs')).cmdDeferredCarry(dir, opts);
    }
    return fail('usage', 'deferred record|list|carry');
  },
  // --file overrides `<dir>/CAPTURE.md` for the global queue, which sits beside the global config, not in a `.planning`
  capture: async (dir, _sub, opts) => (await import('./planning/capture.mjs')).cmdCapture(dir, opts),
  // same --file override, and standalone beside `status` instead of a drift kind inside it
  'capture-sections': async (dir, _sub, opts) =>
    (await import('./planning/capture-sections.mjs')).cmdCaptureSections(dir, opts),
  // standalone like its sibling, and it reports instead of refusing
  'capture-check': async (dir, _sub, opts) =>
    (await import('./planning/capture-check.mjs')).cmdCaptureCheck(dir, opts),
  // --root, never --dir: it scans source and writes into `.planning`
  'debt-harvest': async (_dir, _sub, opts) =>
    (await import('./planning/debt-harvest.mjs'))
      .cmdDebtHarvest(typeof opts.root === 'string' ? opts.root : process.cwd()),
  renumber: async (dir, sub, opts) =>
    (await import('./planning/renumber.mjs')).cmdRenumber(dir, sub, opts),
  'milestone-prune': async (dir, _sub, opts) =>
    (await import('./planning/milestone-prune.mjs')).cmdMilestonePrune(dir, opts),
};

try {
  const { words, opts } = parseArgs(ARGV);
  const [cmd, sub] = words;
  // every flag the row declares is judged before any handler runs, or a row saying `refuse` could still write through
  // it reads raw ARGV on purpose: parseArgs turns a bare flag into `true`, and the row tells those spellings apart
  // an absent flag is left to its handler, and opts isn't mutated or resolveTextFlag stops seeing its "never both" case
  const key = subcommandKey(words, CONTRACTS['planning.mjs']);
  const args = evaluateRow(ARGV, CONTRACTS['planning.mjs'], key);
  // the one presence rule a row can't state: a trace append settling a review fire owes at least one settled figure
  // without it a gate_pass carrying none cleared a blocking range while asserting nothing about it
  const owed = evaluatePresence(ARGV, PRESENCE_RULES['planning.mjs'], key);
  const handler = COMMANDS[cmd];
  // fail emits and returns, so the refusals chain here, and a second one outside would print a second JSON line
  // owed is the second arm so a malformed value still names its own flag; bad-args because this file has no e.seam arm
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
  else {
    // a project without a state file gets one here, once, before any handler reads or writes; a refusal is its own answer
    const planningDir = args.values['--dir'] || '.planning';
    // `trace ignore` reports what the project had before, so its stamp (which creates the records folder) waits for its answer
    // `--check` is the read-only report cad-health runs and writes nothing, so it leaves the stamp to the next seam
    const late = cmd === 'trace' && sub === 'ignore';
    const { ensureState } = await import('./planning/migrate.mjs');
    if (ensureState(planningDir, late ? 'before' : 'now')) {
      await handler(planningDir, sub, opts, words.slice(1));
      if (late && !('check' in opts)) ensureState(planningDir, 'after');
    }
  }
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
