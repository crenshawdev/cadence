# Repo scan — 2026-08-14

Six axes: separation of concerns, reuse, tool-call enforcement, redundant
steps, process flow, subscription token burn. Three sonnet scan agents (bin /
workflows+references+templates / skills+agents), every surviving claim
re-verified against the cited code in the main session before entering this
list. Scan spend: 434k tokens. Dropped in adjudication: B7 (reference-reload
token estimate assumed a model re-reads what it already holds).

Status key: CONFIRMED = reproduced at the cited line in the main session.

## Cluster 1 — Prose ceilings with no count behind them (enforcement)
The measured failure shape (plan-size exists because two model gates passed an
8-task plan against a ceiling of 4) repeats at three sites:
- context.md:287 "3-7 criteria", new-project.md:292 / adopt.md:192 "2-5
  falsifiable success criteria" - no seam counts either. CONFIRMED.
- Read-discipline/batching prose in 5 contracts with zero mechanism; skim.mjs
  is voluntary. CONFIRMED. (Positive precedent to copy: the executor
  report-file contract - a mechanism, not a request.)
- plan-size `requirements_found:false` no-op'd on live phase 1 (4 criteria,
  measured this session) - the rail compared nothing and reported ok:true.
Fix site: counting subcommand(s) beside plan-size; a read-census field in the
executor report schema.

## Cluster 2 — Round-trip waste on the happy path (~2k tokens per call)
- Return/checkpoint close prose restated in 6 files / 8+ sites; a single
  `trace close` inferring the event from the return shape removes the model's
  classification judgment entirely. CONFIRMED.
- plan.md commit step: seed-reqs + cursor set unbatched (no dependency).
  CONFIRMED (batched by hand this session; the prose never says to).
- context.md reads memory.backend alone at spend_gate, needs
  planning.commit_docs later - sibling workflows batch all keys up front.
  CONFIRMED.
- execute.md instructs RE-READ of triage-gate.md twice in one run
  (:252, :285-287). CONFIRMED.
- Happy-path seam-call counts: plan.md ~10, execute.md ~8 round-trips
  excluding dispatches (~16-20k tokens/cycle overhead).
- git-branch/git-guard decide are advice-only by design - a standing ~2k tax
  per transition; tradeoff to weigh, not a bug.
Fix site: workflow prose edits + one new trace subcommand.

## Cluster 3 — Oversized seam outputs
- trace render returns the full unbounded events array (39.6KB measured live
  this session); the 1MB cap bounds the file, not the response; suggest
  discards most of what renderTrace computed. CONFIRMED.
- weight.mjs resident bare emits 19.5KB (maintainer path only). Agent-measured.
Fix site: renderTrace tail-N/summary mode; resident totals-only default.

## Cluster 4 — bin duplication, two live correctness gaps
- protected_branches parsed 4x: git-guard.mjs:142 and git-publish.mjs:94 accept
  string form; git-branch.mjs:56 and land-cleanup.mjs:103 silently drop it -
  same key, same repo, guard honors what land ignores. No string-form test.
  CONFIRMED.
- rev-parse --abbrev-ref reader triplicated verbatim (git-guard:75,
  git-publish:51, git-branch:41). CONFIRMED.
- flag/flagValue/readText duplicated ~10x across 7 files; flagValue's twin
  carries the identical doc comment (weight.mjs:33, self-verify.mjs:1289).
  CONFIRMED.
- --root validation inconsistent: planning.mjs:2570 rejects blank,
  detect-commands/detect-surfaces accept `--root ""`. CONFIRMED.
Fix site: lib/seam-io.mjs + a shared git-read helper.

## Cluster 5 — Fence-blind section scanners (correctness)
classifyPhaseList (planning-files.mjs:124) and classifyActiveSection (:439)
scan headings with no fence guard; classifyAcceptanceCriteria (:994) and
sectionSpan are guarded - the guard exists because this exact corruption
shipped once (fenced CAPTURE.md swallowing sections). No regression test for
the two unguarded scanners; ~3x reimplementation of the same walk. CONFIRMED.
Trigger shape confirmed IN-TREE: templates/ROADMAP.md wraps `## Phases` inside
a ```markdown fence (lines 9-39, heading at 17) - one copied example block away
from a real project's file. VERIFIED 2026-08-14.
Fix site: planning-files.mjs - route through fenceScanner, extract one
combinator.

## Cluster 6 — Contract/skill hygiene
- 377-byte skim paragraph pasted in 4 contracts, batching sentence in 5;
  extract to references/read-discipline.md (the @-include pattern already used
  by the same files). CONFIRMED.
- Copy-paste defect: verifier and assumptions-analyzer - roles that never edit
  - both told "Read the exact range you will change". CONFIRMED.
- cad-land: 189 lines/11KB inline in SKILL.md, no workflows/land.md; every
  peer is 31-38 lines thin. CONFIRMED.
- Always-loaded frontmatter: 4,823 bytes total; 6 internal contracts ride the
  listing (702B); trims worth ~350-450B. CONFIRMED.
Fix site: skills/ + one new reference.

## Cluster 7 — Trace fidelity (phase 2's territory; session-measured additions)
- trace render --phase 1 aggregates every cycle's phase 1 (2026-08-07 events
  beside today's) - cross-CYCLE mixing beyond phase 2's stated cross-fire join.
- Roles table carries an empty-name role (4 dispatches, all unrecorded) and
  reviewer rows with dispatches but no tokens.
- resolve --bracket-read on a gate-read resolve writes a dispatch event for a
  worker that never runs (done by hand this session); no read-only resolve.
- Bracket read-sets unvalidated: a nonexistent path (CLAUDE.md) recorded as
  read this session.
- Cross-model reviewer arm unpriced by design while provider events grew
  3 -> 16 -> 2 across v3.1-v3.3; the growing spend is the unmeasured one.
- read-trace.mjs emits a stat block its own comment calls superseded. Agent-
  verified, bounded output.
- CORRECTION (verified): the read instrumentation of ledger item 1 ALREADY
  SHIPS - bin/read-trace.mjs is registered PostToolUse hook glue
  (hooks/hooks.json:21), lib/read-trace.mjs computes, planning.mjs `reads`
  consumes, read-trace.test.mjs pins. topFiles/fileRedundancy/fileCalls are
  its output, not dead figures. Remaining phase-4 scope: whether the hook
  fires inside SUBAGENT dispatches (the expensive path), and joining its
  records to the fire - not building the emitter.
Fix site: phase 2 CONTEXT additions.

## Cluster 8 — Test/dead-code minor
- self-verify.test.mjs re-proves route-cells' fault matrix via 14 fixture-tree
  tests; route-cells.test.mjs already pins it with 46 unit tests. Scale
  CONFIRMED; keep 1-2 wiring tests.
- phase-plans.test.mjs: dead plan() helper under a section header naming a
  declaredPhaseFiles export that does not exist (lib/phase-plans.mjs exports
  cursorPhase only). CONFIRMED.
- review-provider.mjs: 1028 lines, five responsibilities in a bin file against
  the tree's own bin->lib convention. CONFIRMED (size); split is structural.

## Recommended routing (decision pending)
- Cluster 7 -> phase 2 CONTEXT additions (already its ground).
- Clusters 4+5 -> new correctness phase this cycle (small, self-contained).
- Clusters 1+2+3 -> new enforcement/burn phase this cycle (priority #2
  alignment); absorb the already-filed instrumentation todo (ledger item 1)
  and executor-surfaces todo.
- Cluster 6 -> fold the prose halves into phase 3 (docs truth); cad-land
  extraction its own small task.
- Cluster 8 -> CAPTURE only, unscheduled.
