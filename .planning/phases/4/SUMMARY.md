---
phase: 4
status: complete
completed: 2026-08-27
---

# Phase 4: A killed rotation must not disable rotation - Summary

A rotation claim now dates itself with a sidecar next to it, and a claim whose sidecar has aged past 30 s is evicted and rotated by the next append, so a SIGKILL or host timeout mid-rotation costs one rotation instead of every rotation that follows.

## What shipped

- `ROTATION_CLAIM_FILE` / `rotationClaimPath()` - the sidecar's name, derived once from `ROTATED_TRACE_FILE` and spelled nowhere else (`cadence-core/bin/lib/trace.mjs`)
- The reclaim arm in `rotateTrace` - an `EEXIST` on a sidecar older than `CLAIM_STALE_MS` (30,000 ms) reaches the module's existing single-winner eviction, with a confirm-after-claiming that puts the sibling back where a second reclaimer won the race (`cadence-core/bin/lib/trace.mjs`)
- The stamp is written PRIVATE and published only by an arm that owns the claim, so an append that loses the link never touches the shared sidecar (`cadence-core/bin/lib/trace.mjs`)
- Six new rows in `cadence-core/bin/trace.test.mjs` covering both sides of the discriminator, the reclaim, the cost stopping, and the losing-append arms
- `.gitignore` rules for the sidecar and its private stamp

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | c3fd6eca | The claim dates itself with a sidecar spelled once |
| 1 | 2 | 430659a2 | Ignore the claim sidecar, and prove the claim is released |
| 1 | 3 | 593a343b | An abandoned rotation claim is aged out and the record rotates |
| 1 | 4 | 913b0495 | Prove the reclaim on a claim built directly, and that the cost stops |
| 1 | 5 | 252ba5a9 | Both sides of the discriminator leave the claim standing |
| 1 | gate | aa68aa6a | Keep a losing append from restarting the abandoned-claim clock |

## Deviations

- [deviation] The plan's `Must be true when done` asserts a completed rotation leaves no sidecar behind; task 1's Action and the plan's Notes state the opposite and give the reason - `held` is already false at `renameSync(temp, file)` while the carry-back loop runs, so an unconditional unlink in the `finally` would delete the FRESH sidecar of a second process that legitimately took the claim in that window, leaving a standing claim with no sidecar, which D-02 reads as live forever. Built task 1's side: the release is guarded by `held`, a completed rotation leaves an inert sidecar, and the root holds three files. Every `siblings()` expectation asserts the three-file set through the imported constant. `c3fd6eca`
- [deviation] Task 1's construction (write the sidecar immediately before every `linkSync`) and task 3's (read the sidecar's age in the `EEXIST` arm) are mutually exclusive as literally written - the pre-write overwrites the evidence `claimAbandoned` reads. Kept the pre-write and moved the age read to immediately before it, on each attempt. `593a343b`
- [deviation] The blocking `risk_surface` gate refuted the second half of that: keeping the pre-write at the SHARED path meant every append that lost the link refreshed a dead claimant's sidecar, so on a record appended more often than 30 s the claim never aged into a reclaim at all - reproduced at three consecutive appends reading the sidecar at ~252 ms old with `nlink` stuck at 2. The stamp now goes to `${claim}.${priv}` and is renamed into place only by the arm whose `linkSync` won or the arm that read ABANDONED and is about to evict; a loser unlinks a file nothing else can see. `aa68aa6a`

## Open items

- The scaffold-time ignore surface still does not name the sidecar: `TRACE_IGNORE_LINE` and `ROTATED_IGNORE_LINE` in `cadence-core/bin/planning/trace.mjs`, which `cmdTraceIgnore` writes at `/cad-new-project` time and `/cad-health --check` reports on, cover only the two record files - so a killed rotation strands the sidecar in a USER's working tree exactly as it would in this one. This repository's own `.gitignore` was in scope (D-06); the user-facing one was not.
- Still deferred by CONTEXT and untouched: `.gitignore` rules for the `trace.jsonl.rotate.<pid>.<rand>` temps and the `trace.1.jsonl.evict.<pid>.<rand>` files a killed rotation also strands.
- The put-back branch inside the abandoned eviction is not deterministically reachable from a single-threaded in-process test - the only thing between the age read and the confirming re-read is the rename itself - so it is carried by inspection against `cadence-core/bin/lib/capture-file.mjs:254-272`, which it mirrors. D-08 rules out a spawned holder for this phase, so no test pretends to cover it.
- The age-only lease still cannot tell a SIGKILLed claimant from a live one suspended past 30 s, and breaking a live claim costs the whole record rather than one rotation. Raised by the `risk_surface` reviewer and REFUTED as re-litigation: CONTEXT D-01 rejects the alternative by name for exactly this reason and chooses the age-only sidecar anyway, and D-03 prices the bound at about 4,600x the slowest measured rotation. Recorded here because it is the residual the decision accepted, not because it is unsettled.
- `detect-commands` reports `lint:null` for this repository, so no lint command was run at any task; `npx tsc -p tsconfig.ci.json` is the whole static-analysis surface and was clean at every commit.

## Goal check

The commits deliver the goal. The failing state the phase named - a claim standing forever after a killed rotation, with every append paying the full budget - is closed and measured on both sides: the executor recorded 259 ms per append with `sameIno:true` and `nlink:2` on a live record at 1,048,675 bytes before the change, and 1 ms with `sameIno:false`, `nlink:1` and a 354-byte live record after it (`.planning/phases/4/reports/plan-1.md`, task 3). `cadence-core/bin/trace.test.mjs` pins both sides of the discriminator - a 60 s sidecar reclaims, a fresh one and an absent one each leave the claim standing at `nlink:2` - and the blocking `risk_surface` gate caught the one way the bound was still escapable in practice: the sidecar was refreshed by every append that lost the claim, so a record appended more often than the 30 s bound never reclaimed at all. That is fixed in `aa68aa6a` and pinned by two rows that fail against the pre-fix module (verified by reverting `trace.mjs` alone: 2 tests, 0 pass, 2 fail). `node cadence-core/bin/test.mjs` is 3,490 pass / 0 fail and `node cadence-core/bin/self-verify.mjs` reports `{"ok":true,...,"problems":[]}` over 30 checks, which is AC6. What is NOT delivered is the user-facing half of the ignore surface: a killed rotation on someone else's project still strands `trace.1.jsonl.claim` in their working tree, because the scaffolder's ignore lines were outside CONTEXT's stated scope. That is the first open item above, not a gap in the goal as written.
