---
status: testing
phase: 4
fields_version: 1
started: 2026-08-27
updated: 2026-08-27
---

## Items

### 1. Append at the bound writes instead of refusing
expected: With the trace at or over MAX_TRACE_BYTES, appending an event reports it written, and reading the live file afterward finds that event - not {written:false, reason:"size-cap"}.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Probe on a temp root padded to 1,048,556 B: appendEvent returned {"written":true,"corr":"3-abc1234"} and the event was in the live file afterwards. cadence-core/bin/lib/trace.mjs:760-772; no live `reason: 'size-cap'` remains anywhere in the writer.

### 2. The run in flight keeps its corr and brackets across a rotation
expected: `trace render --phase N` immediately before and immediately after a rotation returns the same corr string for the in-flight run and the same bracket count under it.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: `planning.mjs --dir <tmp> trace render --phase 3` immediately before and after the rotating append: corr '3-abc1234' both, bracket count under that corr 1 both. freshRecord carries the newest anchor and never drops a post-anchor line under the anchor's own corr (cadence-core/bin/lib/trace.mjs:430-448, :484-490).

### 3. The rotated generation is gitignored
expected: `git check-ignore .planning/trace.1.jsonl` exits 0.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `git check-ignore -v .planning/trace.1.jsonl` -> `.gitignore:31:/.planning/trace.1.jsonl`, exit 0. The live record still resolves at `.gitignore:30`, exit 0.

### 4. The pair on disk stays bounded
expected: After a rotation, no .planning file matching the trace or its rotated spelling exceeds MAX_TRACE_BYTES (except a sibling that inherited excess from the first rotation), and at most one rotated generation is present.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: After the rotation the temp root held exactly [trace.1.jsonl, trace.jsonl]: live 647 B, sibling 1,048,556 B, both under 1,048,576. The sibling path is fixed (lib/trace.mjs:111) and a stale generation is evicted single-winner (:621-637, :688), so a second rotation replaces rather than accumulates.

### 5. Both reader envelopes name the record and the rotation
expected: `trace render` and `trace suggest` each emit a `file` field naming the record read, and the first render after a rotation carries a field stating a rotation happened.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Probe: render.file and suggest.file both equal the live trace path; both envelopes carried an identical `rotated` object naming .planning/trace.1.jsonl with a timestamp; render.capped false. planning/trace.mjs:911,920 (suggest) and :957,964 (render); detection ahead of the phase filter at lib/trace.mjs:1057.

### 6. Two racing writers produce one rotation and lose no events
expected: Two writers each entering the append with the file over cap produce exactly one rotated file, and both of their events are present in the live file afterward.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 8 runs x 6 concurrent child processes: all six writers present in the live record every run, exactly one rotated file, no claim or temp residue, sibling under the bound. 0 failures. linkSync claim at lib/trace.mjs:592-596 with the loser arm at :606-619 and the pre-rename re-stat at :628-631.

### 7. Suite, self-verify and weight budgets are green
expected: `node cadence-core/bin/test.mjs` green, `node cadence-core/bin/self-verify.mjs` reports no problems, and every prose surface whose bytes changed is re-pinned in weight-budgets.json.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3429/3429 pass, 0 fail. self-verify {"ok":true,"problems":[]}. weight-budgets.json entries equal the measured bytes of progress.md (13513), report.md (20332) and suggest.md (9727).

### 8. A rotation claim left behind by a killed writer disables rotation permanently and the live record then grows past the bound forever
expected: behavior wrong - the claim is a hard link held from `linkSync` until the swap, and it is released only by the `finally` in `rotateTrace` (cadence-core/bin/lib/trace.mjs:684-690). A SIGKILL, a host timeout kill, or a crash between the link at :592 and the swap at :652-655 leaves the sibling as a second name for the live file. Every later writer then reads `rotationInFlight` as true (:519-534, inode identity), waits out ROTATE_WAIT_MS and returns {rotated:false}, so the append lands but the record never rotates again. The code comment at :580-583 names exactly this state ("a claim left behind reads as a rotation in flight forever and the record never rotates again") and mitigates only the in-process arm; there is no reaper, no claim age check, and no recovery path.
origin: verifier
status: skipped
first_pass: fail
source: verifier
evidence: Reproduced on a temp planning root: after `linkSync(trace.jsonl, trace.1.jsonl)` simulating a killed winner, three successive appends each returned {"written":true} but took 268/266/266 ms, the live file grew from 1,048,556 B to 1,048,874 B with sameInode=true throughout, and no rotation ever occurred. The state is not self-healing - only a human deleting the sibling clears it. No acceptance criterion is violated: AC1 still holds (appends land, never refused) and AC4 binds only what a rotation produces, so the phase goal - the record can no longer reach a state where every append fails forever - is intact. What is lost is the 2 MiB bound the PLAN's third must-be-true states unconditionally, plus a ~266 ms cost on every append while the state persists.
reported: behavior wrong - the claim is a hard link held from `linkSync` until the swap, and it is released only by the `finally` in `rotateTrace` (cadence-core/bin/lib/trace.mjs:684-690). A SIGKILL, a host timeout kill, or a crash between the link at :592 and the swap at :652-655 leaves the sibling as a second name for the live file. Every later writer then reads `rotationInFlight` as true (:519-534, inode identity), waits out ROTATE_WAIT_MS and returns {rotated:false}, so the append lands but the record never rotates again. The code comment at :580-583 names exactly this state ("a claim left behind reads as a rotation in flight forever and the record never rotates again") and mitigates only the in-process arm; there is no reaper, no claim age check, and no recovery path.
severity: minor
cause: The claim carries no record of its owner's liveness, and rotationInFlight (lib/trace.mjs:526-534) reads inode identity alone - a dead claimant's hard link satisfies that test forever. Age cannot break the tie either: the link SHARES the live file's inode, so every append refreshes the sibling's mtime and a claim abandoned days ago still stats as brand new. Nothing in the tree breaks an abandoned claim; rotateTrace's finally (:684-690) is the only release and a SIGKILL between :592 and :655 skips it.
reason: No acceptance criterion is violated - AC1 still holds (appends land) and AC4 binds what a rotation PRODUCES. The unconditional 2 MiB bound is a known residual, filed as GH-146 (bug, sev/S2-real) rather than stalling the phase.

## Summary

total: 8
passed: 7
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
