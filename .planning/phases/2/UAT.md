---
status: testing
phase: 2
fields_version: 1
started: 2026-08-23
updated: 2026-08-23
---

## Items

### 1. cite-count emits both sides with a kind breakdown
expected: `node cadence-core/bin/planning.mjs cite-count --phase 2 --payload <file>` emits one JSON object carrying `surfaced` (count plus ids) and `cited` (count plus an explicit id list, not a number alone), with a `cited_by_kind` breakdown naming the D-NN, CAPTURE and deviation arms separately.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live run over a 6-row fixture: surfaced {count 5, ids [...]}, cited {count 0, ids []}, cited_by_kind with decision {surfaced 2, cited 0} and capture/deviation/uat each marked unjoinable:true. The explicit id list rides the envelope even at count 0, and the four arms sum to surfaced.count.

### 2. Own-phase rows excluded, archived same-numbered rows kept
expected: Given a payload whose results include a row sourced at `phases/2/`, that row is absent from `surfaced`; a row sourced at `_archive-v*/2/` is present.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: phases/2/CONTEXT.md dropped from a 6-row payload (surfaced.count 5) while _archive-v3.5.0/2/CONTEXT.md#D-01 appears in surfaced.ids. Repeated on a real `planning.mjs recall` envelope: all three phases/2/ rows dropped, the archived and root-level rows kept.

### 3. A live /cad-plan run reports the zero case and changes nothing
expected: Running `/cad-plan` on a phase whose plan cites zero of a non-empty surfaced set prints a `Citations:` line naming both counts and saying the zero case in words; `git diff --stat` shows the plan file's bytes unchanged by `count_planned`; the run's trace holds exactly ONE `lifecycle`/`dispatch` for `cad-planner`; and the workflow proceeds to its next step rather than stopping.
criterion: AC3
status: skipped
reported: 2 - skip it
reason: AC3 needs a live host /cad-plan run; deferred deliberately to the next /cad-plan 3, which settles it incidentally

### 4. The count records itself in the run record
expected: After that run, `.planning/trace.jsonl` contains an `outcome`-family event carrying both figures under the run's correlation id, and the seam's envelope carries `written` plus a `reason` when it is false.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Appended trace line family outcome / event cite_count carrying surfaced, cited and cited_by_kind under the phase's corr; envelope trace:{written:true}. With trace.jsonl at the 1 MiB cap the same run returned trace:{written:false, reason:'size-cap'} with every figure unchanged and nothing appended.

### 5. Three runs told apart by their records alone
expected: `memory.backend: none`, a surfaced set of zero, and a non-empty surfaced set cited zero times are distinguishable on disk by their recorded fields alone.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Backend-off run recorded "backend":"none" with surfaced 0; the live empty run omits the field; the third recorded surfaced 5 against cited 0. planning.test.mjs:8097 asserts the pairwise notDeepStrictEqual across all three stripped records before any per-state check, and it passed.

### 6. Repeat invocation is byte-identical and dispatches nothing
expected: Invoking `cite-count` twice over an unchanged plan and payload returns byte-identical stdout, and the run's trace records no `lifecycle/dispatch` event for it.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: cmp of two consecutive stdout captures reported no difference; the resulting trace held two outcome/cite_count lines and zero lifecycle/dispatch events.

### 7. Whole tree green
expected: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify --root . -> ok:true, problems []. test.mjs -> 2842 pass / 0 fail. plan.md measured at 29737 B against its re-pinned budget of 29737, seam census pinned at 11 calls.

### 8. Run /cad-plan on a phase whose plan cites zero of a non-empty surfaced set (UAT item 3, AC3), then read the run's own output and record
expected: The `done` report prints a `Citations:` line naming both counts and saying the zero case in words ("it surfaced S and the plan cited ZERO of them"), not implied by a bare 0; `git diff --stat` after count_planned shows the plan file's bytes unchanged; `.planning/trace.jsonl` for that correlation id holds exactly ONE lifecycle/dispatch for cad-planner (two only if check_gate drove a revision, which is the pre-existing path and not the count); and the workflow continues to check_gate rather than stopping. Two outcome/cite_count events should be on the record for the run, one --point planned and one --point committed.
origin: verifier
why_human: Out-of-reach resource, not an unexercised probe. /cad-plan is a host slash-command whose steps are prose the coordinating session executes; a subagent cannot invoke it, and the run additionally spends a real cad-planner dispatch and writes to the live repository (plan files, STATE.md, a commit, .planning/trace.jsonl). Every part of the item that code can settle already is: the two count steps and their payload wiring are read and pinned by the seam census, the `Citations:` line and its three-state wording are present in workflows/plan.md, and byte-stability of the plan file plus the absence of any dispatch was observed by running cite-count directly. What remains is the host's execution of that prose, which only a live session can show. This is also the one claim the phase SUMMARY itself flags as unconfirmed.
status: skipped
reported: 2 - skip it
reason: Same check as item 3, worded by the deep verifier; deferred to the next /cad-plan 3 run

## Summary

total: 8
passed: 6
failed: 0
pending: 0
skipped: 2
blocked: 0
reworked: 0
