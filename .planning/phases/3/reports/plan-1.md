PLAN CHECKPOINT: structural
Plan: .planning/phases/3/PLAN-1.md
Tasks: 4 of 5
| Task | Commit | Note |
|---|---|---|
| 1: one reachability predicate in `lib/` | 4cd2a0f | `onPath` moved to `lib/on-path.mjs` with a `PATHEXT` arm and a one-directory half; `issue-check.mjs` imports it; census row added. 48/48 tests pass, `grep -rn X_OK cadence-core/bin` names only the new module. |
| 2: `detect-commands` names only reachable commands | bc16856 | Driver + npx-delegated probe, null-and-warn with no fall-through, `CADENCE_DETECT_REACHABLE` behind the `CADENCE_TEST_SEAM` sentinel. 402/402 planning rows pass both with `ruff`/`mypy`/`eslint`/`tsc`/`go` absent and with all five stubbed onto PATH. |
| 3: one plan-key grammar in `lib/`, with its table | ad0abbc | `lib/plan-key.mjs` + a 16-row stated table + a census row; `require-int.test.mjs` still green (its callers untouched). |
| 4: both risk-check faces reach that grammar | 9d7c4a5 | One `requirePlanKey` consultation per face, the key recorded verbatim, a refused bracket key reported in `malformed[]` rather than `missing[]`. 588/588 across plan-key, risk-diff, planning and trace, with `risk-diff.test.mjs` untouched. |
| 5: `execute.md` states the continuation key | (not committed) | Prose written and sitting UNCOMMITTED in the worktree. Blocked on the byte budget - see the checkpoint below. |

CHECKPOINT: structural
Current task: 5 - `workflows/execute.md` states the key a continuation or fix-pass dispatch carries

What I found. `cadence-core/bin/weight-budgets.json` pins
`cadence-core/workflows/execute.md` at 26928 B, which is EXACTLY the file's
pre-change size. The budget has zero headroom, so ANY prose addition to that
file fails self-verify's `budget-overrun` check - and task 5's `Verify:` and the
plan's `## Must be true when done` both require `self-verify.mjs` to pass. The
file is not in this plan's `files:` lease, and `lease-check --phase 3 --plan 1`
refuses a commit that stages it.

What I propose. Add `cadence-core/bin/weight-budgets.json` to PLAN-1's `files:`
list and set `"cadence-core/workflows/execute.md": 27834` (the exact post-edit
size; the manifest's own `_comment` says to regenerate from `weight.mjs` when
intentional surface growth is accepted). Then task 5 commits as one change:
the prose plus the accepted budget.

Why it is needed. D-12 names `workflows/execute.md` as the file that must gain
the missing worker-key statement, and the omission there is what minted `1-fix`,
`1-cut` and `1-cut-b`. There is no in-lease way to state it: the only
alternative is deleting 906 B of other workflow prose to pay for it, which
trades a stated rule for a stated rule.

Impact. One manifest line, +906 B on one workflow surface. No other plan in this
phase declares `weight-budgets.json` (PLAN-2 declares `lib/risk-diff.mjs` and
`risk-diff.test.mjs`; PLAN-3 declares the two `planning-files`/`milestone-prune`
pairs), so widening this lease collides with nothing.

Alternatives considered. (a) Trim 906 B of existing execute.md prose - rejected,
it pays for one rule by deleting others and would move the return-handling list
`prose-agreement.test.mjs` parses positionally. (b) Commit the prose and leave
self-verify red for the continuation to fix - rejected, it merges a branch whose
ship gate fails. (c) State the rule in another file - rejected, D-12 names this
one, and `references/triage-gate.md` already carries the receipt half.

The uncommitted work. `cadence-core/workflows/execute.md` in this worktree
already carries the edit, verified green except for the budget:
`prose-agreement.test.mjs` passes 31/31, and `grep -n "worker key"` returns line
205 (the bracket paragraph) plus lines 257/265 (a new `**The worker key of a
SECOND dispatch.**` paragraph after the four return-handling arms, outside the
block that check parses) and line 378 (inside `handle_checkpoint`'s re-dispatch
sentence). It states both halves D-12 asks for: a continuation or fix pass for
plan `k` is bracketed under `k` itself, and the risk record and the fire receipt
must carry that same spelling. It deliberately does NOT say the seam requires a
number, which after task 4 it does not.

Deviations: [deviation] task 2 Verify asserts `detect-commands --root .` prints `"typecheck":"npx tsc -p tsconfig.ci.json"` on this machine "where `node_modules/.bin/tsc` exists". In this git worktree it does not exist - `node_modules` is ignored and lives only in the main checkout - so the command answers `typecheck: null` with the warning naming `tsc`. The premise is false here rather than the behaviour wrong: the same tree shape is asserted hermetically by the `node_modules/.bin` fixture row, which passes, and the main checkout still has `node_modules/.bin/tsc`. No criterion redefined.
[deviation] the dispatch names branch `cadence/phase-3-plan-1`; the host created this worktree on `worktree-agent-a01e700fa0bd68654`, forked at the right base (`0e7844b`). I created `cadence/phase-3-plan-1` at that base and committed every task onto it, so the branch the orchestrator merges exists and carries the work. The host's own branch still points at `0e7844b` and was not moved.
Open items: declined an ancestor walk for `node_modules/.bin` (what `npx` actually does) - D-04 names `<root>/node_modules/.bin/<tool>` and the fixture rows meet the Verify with it. Stated cost, measured in this worktree: a Cadence executor running on the parallel path gets `typecheck: null` for this repository, where `npx tsc -p tsconfig.ci.json` does run, because npx resolves through the main checkout's `node_modules` one directory up. Promote by walking parent directories in `reachable()` if a task states it.
