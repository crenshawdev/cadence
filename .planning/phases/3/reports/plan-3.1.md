PLAN CHECKPOINT: human-verify
Plan: .planning/phases/3/PLAN-3.md
Tasks: 5 of 6
| Task | Commit | Note |
|---|---|---|
| 1: Read the stopped worker's own transcript, not the session's | 68cfeddc | Hook now reads `agent_transcript_path`, no fallback. Field confirmed present in the installed 2.1.246 binary before editing. Fixture: with the field, one `worker_cache` line carrying the AGENT file's 333/4444 and neither of the session file's 11/22, no `return`; without it, one `return` carrying no cache key. Both runs silent on both streams, exit 0. Also corrected the same falsified premise in `lib/subagent-trace.mjs`'s GATE 0 header and one test comment. 3411 tests pass, tsc clean. |
| 2: The hook's own close carries the worker's id | 66550c0d | `agent_id` on the GATE 3 `return`, omitted when the payload carries none. New case pins both arms; the two exact-key-set cases extended, not weakened. End to end, a hook-written close now renders a bracket carrying `agent_id` where it rendered none. 3412 tests pass, tsc clean. |
| 3: A stop whose bracket is already closed stops adopting a dead run | f31aa766 | `currentRun` now takes the candidate rows plus bracket clocks and answers `{corr, rows}`; both gates read that one value. New case green; the same fixture run against HEAD's pre-task code answered a `return` at corr `1-dead000` phase `1`, which is the defect. The four named regression cases pass unchanged. 3413 tests pass, tsc clean. |
| 4: The larger cache read wins, and the first one stops being final | 2adf3166 | One shared `moreComplete` predicate at all three sites. `render: a fact never overwrites a figure the close already carried` reddened as expected and was rewritten to pin the new rule with its supersession stated; the two-facts case now runs both orders plus a per-key-independent pair; the repeat-close case gained the shorter-first arm; new idempotence case renders one fixture twice. `roles` byte-identity still asserted on every folded case. 3414 tests pass, `self-verify` `problems: []`, tsc clean. |
| 5: The record states which file the hook reads | 45faf4da | Seam paragraph edited in place (no blank line added, three `--turns` clauses intact, `ONE statement` count still 1); ceiling moved 24,748 -> 25,299 in the same commit. CONTEXT.md flagged assumption and D-11 each carry a dated correction naming `agent_transcript_path`. ROADMAP criterion 2 amended, `git diff` touches that one line and nothing else. The NOT-TERMINAL figures were re-measured rather than copied: 1,310 transcripts, 33 of 34 written 2026-08-26 not-terminal, 1,071 terminal corpus-wide (the plan said 1,309 / 31 of 32 / 1,071 - two transcripts were added by this session). prose-agreement 47 pass, 3414 tests pass, `problems: []`, tsc clean. |
| 6: Record what phase 2's shared prefix recovered, after side | 32f6518a (method half only) | The half the Action says "does not wait on any dispatch" is committed: the two sides are now stated as the same arithmetic over the same kind of file, the before figures are marked unchanged and not re-measured, and `### After` names which stops its brackets will come from. The FIGURES are not written - `### After` still reads PENDING. HELD for human-verify. |
Deviations: none
Open items:
- `cadence-core/bin/lib/subagent-transcript.mjs:15` and `:83` still say the disk half resolves `transcript_path`. That file is not in this plan's `files:` lease, so the two stale clauses are left as-is rather than edited outside the lease.
- Task 4's Action says all three cache-folding sites "keep the FIRST value that arrives". Two did; the `cacheFacts` map was LAST-wins (`Map.set`, and its own comment said so). The fix and the task's `Verify:` are unaffected - larger-wins replaces both directions - but the plan text mis-describes the starting state at that one site.
- The two cache-bearing brackets already on `.planning/trace.jsonl` carry the ORCHESTRATOR's traffic and are not corrected by this plan: a fact is written at stop time, so no already-closed bracket can gain one. `cad-verifier` at `3-a0fd304f` reads 52,918 / 528,568 where the worker's own transcript sums 100,439 / 2,115,871; `cad-planner` beside it reads 50,428 / 527,186 against 240,156 / 10,405,827. Any reader of those two rows is reading a wrong number, and only rotation or a hand edit removes them.
- Task 6's live check does not pin AC5's two-open-dispatch pair; that stays unpinned live, as the plan's Notes already record.

CHECKPOINT: human-verify
Current task: 6 - Record what phase 2's shared prefix recovered, after side
Need: `cad-verifier` dispatched at least twice in the MAIN tree with these
commits live, then `node cadence-core/bin/planning.mjs trace render --dir .planning`
showing at least one `cad-verifier` bracket carrying both cache keys, each
equal to `cacheOf` over that worker's own
`subagents/agent-<agent_id>.jsonl`. Those figures, their dispatch count and the
delta against the committed before side (1,635,645 and 83,790 per dispatch,
n=33) are what fill `### After` in
`.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md`. Baseline at this
plan's tip: 409 brackets, 2 carrying a cache key, both of them the mis-sourced
pre-fix rows named above.
