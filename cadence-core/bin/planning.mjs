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

import { readdirSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname, relative, resolve as resolvePath } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renameSync, rmSync, mkdirSync } from 'node:fs';
import {
  parseCursor, renderCursor, parseRoadmapPhases, parseRequirements, atomicWrite,
  shiftPhaseTokens, findProsePhaseRefs, cutPhaseDetail,
} from './lib/planning-files.mjs';
import { emit } from './lib/seam-io.mjs';
import { requireInt, requirePhaseArg } from './lib/require-int.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { runTransition } from './lib/file-transition.mjs';
import { buildEntries, recordName } from './lib/adjudication-record.mjs';
import { buildQueue, queueName } from './lib/deferred-queue.mjs';
import { evaluateRow, subcommandKey, CONTRACTS } from './lib/arg-contract.mjs';
// The shared core the command modules under planning/ import too (D-03). `ok`,
// `fail`, `read` and `HERE` are declared there and nowhere else; this file is one
// more consumer of them, not their home.
import {
  ARGV, argRefusal, fail, fireHome, fireIdentity, ok, read, readJsonPayload,
  readQueue, resolveRange,
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
import { cmdTrace } from './planning/trace.mjs';
import { cmdRiskCheck } from './planning/risk-check.mjs';

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
