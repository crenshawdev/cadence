PLAN COMPLETE
Plan: .planning/phases/4/PLAN-1.md
Tasks: 8 of 8
| Task | Commit | Note |
|---|---|---|
| 1: Add the `trace close` subcommand | cebee9c | `close` shares `append`'s validation body; family fixed to `lifecycle`, arm inferred from `--detail` (never `--tokens`, D-06). `escalation` stays on `trace append` (D-13). `'trace close'` CONTRACTS row added. |
| 2: Convert all eight close sites, re-express the census | 4110fde | 20 lines -> 10, one per dispatch moment, across the eight files plus `references/seams.md`'s canonical rule statement. Census asserts close count EQUALS dispatch count and ZERO raw terminal appends per file; both falsified live (raw append back -> FAIL, restored -> PASS; a second close -> FAIL). 9 budget rows re-pinned. |
| 3: Bound `trace render`'s default response | 5519161 | `--phase 3` on this repo's record: 36,916 B -> 9,890 B (3.7x), no `events` key, 31 bracket rows + 15 outcomes including the `rearm` triage-gate looks up. `--events` returns 36,916 B byte-for-byte. `renderTrace` gained `brackets`; every key the two in-process consumers read is unchanged, and the `verbatim.trace.jsonl` fixture test still reports the same corr/counts/roles/unpaired. |
| 4: Point `report.md` at the bounded render | 4778c14 | `read_record` and `compose` name `brackets`/`outcomes`; the step is told NOT to ask for the raw array. Budget 5,850 -> 6,149. |
| 5: Join a read record to its bracket, as a pure function | 4b69e68 | `joinReads(records, brackets)` - role normalization through `lib/rung-agent.mjs`'s `RUNG_FILES` rather than a suffix regex, containment on `ts`, ambiguous on overlapping same-role brackets (D-11). 8 new cases. |
| 6: Wire the join into the `reads` seam, on committed fixtures | b723905 | `reads --join`, whole-record; `CONTRACTS` row moved. Fixtures `join.trace.jsonl` / `join.reads.jsonl` measure 2 joined / 1 ambiguous / 2 unjoined / 2 floor / 1 coordinator, asserted as a partition of all 8 records. Without the flag the envelope is byte-identical, and the `no reads recorded yet` arm returns before the join. |
| 7: Move `report.md`'s reads prose with the flag | 90150f8 | "no phase scoping and no flag" gone, the flag named at the call, the unjoinable floor stated as a permanent limit. Silence rule and no-recompute rule intact. Budget 6,149 -> 6,935. |
| 8: Hand the executor the surfaces it will be judged on | e04dcc2 | Dispatch prompt carries the resolve's `surfaces` on the phase-level stable-first half (parallel path inherits); states that `surfaces_answered: false` means all categories stand. Contract states the bar with NO halt condition. prose-agreement check asserts both halves and refuses a category `config.schema.json` does not carry; falsified live. Budget rows re-pinned. |

Final state: `node --test cadence-core/bin/*.test.mjs` 1776 pass / 0 fail; `node cadence-core/bin/self-verify.mjs` ok:true, 0 problems; `npx tsc -p tsconfig.ci.json` clean. Zero raw `trace append --event return|checkpoint` invocations left in any prose surface.

Deviations: none

Open items:
- Declined a runtime refusal of `--family`/`--event` on `trace close`. The task's `Verify:` does not exercise it, and self-verify's new `'trace close'` CONTRACTS row already reports `unknown-flag` on any shipped prose that states either, so the only uncovered caller is a hand-typed one. Add the refusal if a task ever states it.
- `verify-deep.md`'s close MOVED step, from `merge` and `fall_through` into `dispatch`. Those two are alternative endings in two different steps reached from one dispatch, so "exactly one close per dispatch moment" is only expressible at the point the return is read. `fall_through` now states the bracket is already closed.
- `joinReads` and `reads --join` report two buckets beyond the four the plan names: `coordinator` (1,006 of 2,725 live records - the main thread, which has no worker bracket by construction) and `unresolved` (no readable `agent`). Folding either into `unjoined` would report a limit as a failure, and without them the four figures do not partition `calls`.
- `references/plan-revision.md`'s trailing paragraph claimed an open bracket there "is invisible to a census that counts SOME terminal in the file". The re-expressed census makes that false, so the sentence was corrected in the same commit - one sentence past what task 2 enumerated, flagged here for the same reason the plan flagged `seams.md`.
