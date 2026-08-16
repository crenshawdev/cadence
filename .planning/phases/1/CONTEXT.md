# Phase 1: The controls that never reached their path - Context

Gathered: 2026-08-16
Feeds: /cad-plan 1

## Scope boundary

In: Three controls Cadence already holds stop being unreachable from the path
that needs them - the recall corpus survives a milestone close on both prune
arms (RCL-07), the parallel execute branch runs the same detector/fire/status
risk sequence the sequential one does (PAR-01), and `risk-check status` refuses
a matched or inconclusive range carrying no outcome event under the same
correlation id and plan (GAT-04). Each lands with a check watched failing
against the unpatched code first.

Out: The three ranking-depth wins recorded beside RCL-07 in `CAPTURE.md`
(stemming in `lib/bm25.mjs`, multi-phrasing union per call, folding
`reports/plan-<k>.md` and `REVIEW-*.md` into the corpus walk) - all are ranking
quality over a corpus this phase is repairing, not reachability. The
absent-vs-unmatched corpus marker (2026-07-27 capture). Any `_archive-*` walk
arm. The cost half of this milestone (MSR-01/02/03, TRN-02, PLN-01), which is
scoped to its own phases. The `/cad-task`, `/cad-debug` and `/cad-verify` fire
sites, which stay outside the status gate (D-14).

Deferred: None.

Plan shape: multiple plans, same phase - split along the three seams, with
GAT-04 landing before PAR-01's new `risk-check status` caller so the new caller
is written against the rule it must satisfy. Shared surfaces
(`weight-budgets.json`, the three tree-wide count pins) get explicit `files:`
leases per plan.

## Durable decisions

- D-01 (RCL-07): The residue is written at prune time, BEFORE the directories
  go; the corpus walk gains no `_archive-*` arm. Every `v3.5.x`, `v2.4`, `v2.7`
  and `v3.0-v3.2` close used `--mode delete` and left zero on disk, so an
  `_archive-*` walk would pass its own fixtures and still return nothing for the
  `v3.5.2` close the requirement was reproduced against. Evidence:
  `cadence-core/bin/planning.mjs:4283-4308`, `.planning/ROADMAP.md:120-124`,
  `.planning/DOCS-CLAIMS.md:798`.
- D-02 (RCL-07): The residue is a NEW tracked top-level `.planning/ARCHIVE.md`
  read beside `CAPTURE.md`, not a fourth section inside `CAPTURE.md`.
  `CAPTURE_WALK_SECTIONS` is frozen and positionally consumed by
  `lib/capture-file.mjs`, and this repo gitignores `.planning/CAPTURE.md` while
  the residue's sources are tracked, so a CAPTURE section would land in a file
  git will not take. Evidence:
  `cadence-core/references/capture-grammar.md:35-40`,
  `cadence-core/bin/lib/planning-files.mjs:788-807`, `.gitignore:26`.
- D-03 (RCL-07): The residue carries the SAME snippets the walker already
  indexes, produced by the same three parsers INSIDE the `milestone-prune` seam
  over the `applied` set - never a model-authored distillation and never the
  whole SUMMARY/UAT/CONTEXT text. A prose-authored write puts it back in the
  fallible coordinator's hands, where an interrupted close writes nothing and
  the reachability hole reopens silently. Measured 2026-08-16: 721 snippets =
  193 KB for the project's entire history, against a `CAPTURE.md` already at
  261 KB, with a 9 ms BM25 index build over the combined corpus. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:771-785,945-954,1354`,
  `cadence-core/bin/planning.mjs:4268-4327`,
  `cadence-core/workflows/milestone.md:88-94`.
- D-05 (RCL-07): Recall keeps ONE flat BM25 ranking - archived rows compete
  with live ones on score, with no recency term and no per-source cap, each row
  labelled by its origin (D-04) so the caller discounts retired work itself.
  Measured 2026-08-16 by rebuilding the index as `cmdRecall` does with archives
  folded in (265 -> 986 snippets): archived rows took 2, 1, 3 and 3 of the top 5
  on four representative queries and displaced the live `CAPTURE.md` hit from
  rank 1 twice. That crowding is the accepted cost; a cap's N has no measured
  basis. Evidence: `cadence-core/bin/planning.mjs:2068-2082`,
  `cadence-core/bin/lib/bm25.mjs`.
- D-06 (PAR-01): The parallel path reaches the sequence by pointing at
  `workflows/execute.md`'s own risk step - already resident, since
  `execute_parallel` is the only step that reads the reference - rather than by
  a new shared `references/risk-sequence.md`. A new reference costs a
  deferred-reads registry row (pinned at 10), a `weight-budgets.json` row and a
  new read anchor, and puts a third file on the load path of the branch that
  already loads two. Evidence: `cadence-core/workflows/execute.md:363-374`,
  `cadence-core/bin/lib/deferred-reads.mjs:207-214`,
  `cadence-core/bin/self-verify.test.mjs:1696`,
  `cadence-core/bin/lib/surface-weight.mjs:117-125`.
- D-11 (GAT-04): Every blocking `risk_surface` fire records an outcome event of
  its own, PASS included, so "the detector ran" and "the fire happened" are two
  separate receipts `risk-check status` can demand together. The roadmap's
  stated acceptance set (adjudication / re-arm / explicit override) has no arm
  for a clean pass, and a blocking PASS writes nothing today; without a pass
  event, status would refuse every matched range whose fire found no blocker,
  and this tree already states its verdict on that outcome - "an unclearable
  gate is one that gets bypassed". Measured on all 836 events of
  `.planning/trace.jsonl`: 25 `provider/request` events carrying
  `trigger: risk_surface` against 11 `outcome/adjudication` events naming it,
  with `corr 1-8c79af6` holding a matched `risk_check` record and no outcome at
  all. Evidence: `cadence-core/references/review-triggers.md:273-277,349`,
  `cadence-core/references/triage-gate.md:8-12`,
  `cadence-core/bin/planning.mjs:3562-3571`.
- D-12 (GAT-04): The event `risk-check status` matches on carries STRUCTURED
  trigger and plan identity; the free-text `--detail` slot is never parsed to
  join an event to a trigger or a range. Measured on this repo's 35
  `outcome/adjudication` events, the trigger is spelled four different ways in
  `detail` (`risk_surface`, `risk_surface re-arm`, `risk_surface rearm`,
  `risk_surface plan-1`), and neither the `adjudication` nor the `rearm` field
  set carries `plan` or refs. `trace append` already accepts `--plan` and
  `rowKey(corr, plan)` is already the status row identity. Evidence:
  `cadence-core/references/review-triggers.md:291-294`,
  `cadence-core/bin/planning.mjs:2958-2977,3066,3516-3521`.
- D-14 (GAT-04): The `/cad-task`, `/cad-debug` and `/cad-verify` fire sites stay
  outside the status gate; GAT-04 changes only what `risk-check status` accepts
  on the execute path. `task.md` states the deliberate absence and the
  `written: false` guard that stands in for it, and `prose-agreement.test.mjs`
  pins that arrangement; a widened rule would give `/cad-task` a gate it has no
  `status` call to clear. Evidence: `cadence-core/workflows/task.md:97-105`,
  `cadence-core/bin/prose-agreement.test.mjs:832-843`.

## Decisions

- D-04 (RCL-07): Each residue row names its ORIGIN artifact, so `recall`'s
  `source` still distinguishes a SUMMARY deviation from a UAT item from a
  CONTEXT decision after the close. One flat `source: "ARCHIVE.md"` would
  collapse provenance and stale the `{score, source, phase?, snippet}` contract
  `/cad-debug` reads. Evidence: `.planning/ROADMAP.md:121`,
  `cadence-core/references/recall.md:18-39,54-59`,
  `cadence-core/bin/planning.mjs:2040-2064`, `.planning/DOCS-CLAIMS.md:667,691`.
- D-07 (PAR-01): A parallel plan's risk range is the pre-merge/post-merge HEAD
  pair `execute-parallel.md` step 3 already records - not `{pre-plan HEAD,
  HEAD}` and not `{PHASE_START, HEAD}`. Otherwise every parallel plan after the
  first fires the blocking gate on a range containing other plans' work.
  Evidence: `cadence-core/references/execute-parallel.md:18-25,30-33`,
  `cadence-core/bin/planning.mjs:3194-3237,3619-3634`.
- D-08 (PAR-01): Detection and the fire run AFTER step 3's merges, in the main
  tree, beside step 5's `diff` fire, with the range diff written to a file
  outside any worktree (review-triggers artifact shape (c)). A fire issued
  before the merge asks git for a commit the tree does not hold, and
  `risk-check run` returns `ok:false, reason:"no-diff"`. Evidence:
  `cadence-core/references/execute-parallel.md:34-37`,
  `cadence-core/references/review-triggers.md:60-64,349`,
  `cadence-core/workflows/execute.md:263-271`.
- D-09 (PAR-01): The parallel path's `risk-check status` uses the same
  named-range triple the sequential path uses, not the phase-wide arm. The
  phase-wide arm passes on `usable.length` alone and never compares the range,
  so a parallel plan would clear on a record left by an earlier, narrower one.
  Evidence: `cadence-core/workflows/execute.md:273-282`,
  `cadence-core/bin/planning.mjs:3609-3636`,
  `cadence-core/bin/risk-diff.test.mjs:400-446`.
- D-10 (PAR-01): Each parallel plan's `risk_surface` survivor file keeps the
  `plan-<k>` discriminator, so the milestone carry-forward glob still finds it
  and a later empty settle cannot overwrite an earlier survivor. Evidence:
  `cadence-core/references/review-triggers.md:304-329`,
  `cadence-core/workflows/milestone.md:76-86`,
  `.planning/_archive-v3.3.0/1/REVIEW-risk_surface-plan-1.md`.
- D-13 (GAT-04): The explicit user override records its event from
  `references/triage-gate.md`'s blocking arm, and its reason is caller-derived
  text that rides `--detail-file` under the v3.5.2 transport rule. An inline
  `--detail` would trip self-verify's `text-transport-inline` problem and make a
  37th site exist against a register that says 36. Evidence:
  `cadence-core/references/triage-gate.md:8-12`,
  `cadence-core/workflows/execute.md:268-269`,
  `cadence-core/bin/lib/text-transport.mjs:110-113,129-178`,
  `cadence-core/bin/text-transport.test.mjs:45`.
- D-15 (pins): Re-pinning `cadence-core/bin/weight-budgets.json` is part of this
  phase's work and that file belongs in the plan's `files:` lease. Measured
  2026-08-16, bytes vs budget: `references/execute-parallel.md` 4242/4242,
  `workflows/milestone.md` 10797/10797, `references/review-triggers.md`
  29413/29413, `references/triage-gate.md` 6261/6261, `references/recall.md`
  2831/2831, `workflows/task.md` 7295/7295 and `workflows/verify.md`
  17388/17388 all sit at ZERO headroom; `workflows/execute.md` has 40 bytes and
  `workflows/debug.md` 9. Evidence: `cadence-core/bin/self-verify.mjs:884-893`.
- D-16 (pins): The tree-wide count pins in reach of this phase are
  `text-transport.test.mjs:45` (36 register rows),
  `self-verify.test.mjs:1696` (`DEFERRED_READS.length === 10`) and
  `self-verify.test.mjs:1591-1592` (12 `mergeLayers(` callsites across 9 files).
  `seam-calls.test.mjs`'s census covers only `context.md` and `plan.md`, so a
  new seam invocation in `execute.md` or `execute-parallel.md` moves nothing
  there. Any re-pin carries its arithmetic in the test file's header. Evidence:
  `cadence-core/bin/seam-calls.test.mjs:62-79`,
  `cadence-core/bin/self-verify.test.mjs:1591-1592,1696`,
  `cadence-core/bin/text-transport.test.mjs:45`.
- D-17 (evidence): The watched FAIL is recorded as a header comment in each new
  test naming the SHA it was watched failing at - beside the check permanently,
  matching the tree's habit of documenting derived arithmetic in the test file's
  own header, and surviving the milestone close because a test file is source
  rather than a phase artifact. Baseline captured at HEAD `a32704e`:
  `grep -c risk-check` = 2 for `workflows/execute.md` and 0 for
  `references/execute-parallel.md`, `.planning/phases/` empty, a live `recall`
  returning `CAPTURE.md`-only hits, `node --test
  cadence-core/bin/risk-diff.test.mjs` green at 40/40. Evidence:
  `.planning/ROADMAP.md:131-132`, `METHOD.md:107-119`,
  `cadence-core/bin/seam-calls.test.mjs:1-33`.

## Acceptance criteria

- [ ] AC1: After `milestone-prune --mode delete` over a phase, `planning.mjs
      recall` for a term appearing only in that phase's SUMMARY deviation
      returns it, with `source` naming the SUMMARY origin rather than a flat
      residue filename. Repeating under `--mode archive` returns the same
      result.
- [ ] AC2: `grep -c risk-check cadence-core/references/execute-parallel.md`
      returns non-zero, and a check fails when the detector/fire/status sequence
      is restated there as a second copy of `workflows/execute.md`'s.
- [ ] AC3: A check asserts `execute-parallel.md` gates reporting a plan done on
      the `risk-check status` call, and fails when that gating sentence is
      removed.
- [ ] AC4: `risk-check status` returns `ok:false` for a range recorded with
      `matches` non-empty or `inconclusive: true` that carries no outcome event
      under the same correlation id and plan, and `ok:true` once an
      adjudication, re-arm, clean-pass or override event exists under that
      corr+plan.
- [ ] AC5: An explicit user override appends its own outcome event with its
      reason carried by `--detail-file`, after which `risk-check status` returns
      `ok:true` for that range.
- [ ] AC6: Each of the three new checks carries a header comment naming the SHA
      it was watched failing at, and running that check against that SHA exits
      non-zero.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and `node
      cadence-core/bin/self-verify.mjs` both exit 0 with the moved count pins
      and `weight-budgets.json` re-pinned.

## Flagged assumptions

- The residue's row format beyond naming its origin (D-04) - whether the
  milestone label rides its own field or the `phase` slot - is the planner's
  call; Likely, and if wrong a later milestone's rows are indistinguishable from
  this one's in a recall result.
- `milestone-prune`'s residue write is assumed idempotent across a re-run and a
  `partial-prune` return, matching the seam's existing applied-set discipline;
  Likely, and if wrong a resumed close duplicates every row it already wrote.
- Whether D-11's clean-pass receipt is a NEW outcome event kind or reuses an
  existing family under a new detail shape is left to the planner; Likely, and
  if wrong `/cad-report`'s existing outcome rendering gains a kind it does not
  recognise.
- The residue grows unbounded across future milestones. Measured today at 193 KB
  / 721 snippets for the project's entire history with a 9 ms index build, so
  nothing is due this phase; Confident, and if wrong the cost surfaces as recall
  latency several milestones out rather than as a defect here.
