---
phase: 1
status: complete
completed: 2026-09-02
---

# Phase 1: A gate refuses the range it could not resolve - Summary

`risk-check run` and `status` resolve each end of a range on its own and name the end that failed; the staged scope has one machine spelling (`--base <ref> --staged`) bound to the index's own tree id; and every spine caller that would have asked about a range whose two ends are one commit records a `risk_check_skipped` instead.

## What shipped

- `resolveRef` / `resolveRange` resolve each end independently and name the failed end - `cadence-core/bin/planning/core.mjs`
- A `no-diff` refusal keeps the resolved end's id and states its cause on the appended row - `cadence-core/bin/planning/risk-check.mjs`
- `--base <ref> --staged` as the staged scope's one spelling on both `run` and `status`; `--head` beside it is refused - `risk-check.mjs`, `cadence-core/bin/lib/arg-contract.mjs`
- A staged record carries `index_id` from `git write-tree`, and the body is diffed `<base> <tree>` so the id and the bytes are one object - `core.mjs` (`resolveIndex`), `risk-check.mjs`
- `risk-surface.md` states the staged spelling and record shape - `cadence-core/references/risk-surface.md`
- `verify.md` and `debug.md` stage the fix (`git add`) as a step, then ask the seam with `--staged`, and read `empty: true` as not-checked - `cadence-core/workflows/verify.md`, `cadence-core/workflows/debug.md`
- `execute.md`, `task.md` and `execute-parallel.md` skip the self-comparing range and append `risk_check_skipped` - `cadence-core/workflows/execute.md`, `cadence-core/workflows/task.md`, `cadence-core/references/execute-parallel.md`
- Prose-agreement pins for every `risk-check run` invocation line, the staging order at both fire sites, and the shared `risk_check_skipped` event - `cadence-core/bin/prose-agreement.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4a1b31d4 | `resolveRange` resolves each end on its own and names the end that failed |
| 1 | 2 | c41adcaa | a `risk_check` with no diff keeps the resolved end and states its cause |
| 1 | 3 | 75113949 | `risk-check run` takes `--base <ref> --staged` as the staged scope's one spelling |
| 1 | 4 | b7a47569 | `risk-check status` accepts `--base <ref> --staged` and finds the staged record |
| 1 | fix | 740867b7 | a staged `risk_check` binds to the index it read (`index_id`), not to its base - closes the round-1 `diff` blocker |
| 1 | fix | 61c39022 | a staged `risk_check` diffs the tree it named, not the live index - closes the round-2 `diff` blocker (coordinator edit, re-arm cap spent) |
| 2 | 1 | d0045630 | `risk-surface.md` states the staged scope's one spelling |
| 2 | 2 | a785ad3d | `verify.md` and `debug.md` ask the seam over the staged set |
| 2 | 3 | 163339e7 | a plan that landed nothing records a skip, not a clean check |
| 2 | fix | 0fceb073 | stage the fix before the staged risk check - closes both round-1 `diff` highs |

## Deviations

- [deviation] Plan 1 task 4: one pre-existing risk-diff pin deep-equals the whole reported `records` shape, and reading `staged` into a record adds a normalized `staged: false`. Pin updated with the reason; no behaviour changed. (b7a47569)
- [deviation] Plan 2 task 2: the `grep -rn "STAGED"` verify predicted no hits; one pre-existing emphasis-prose hit at `references/worktree-executor.md:37`, outside the lease and not a rev spelling. The criterion the grep stood in for is held by the new prose-agreement test instead. (a785ad3d)
- [deviation] Plan 2 task 3: `prose-agreement.test.mjs:1664` bounds its slice on the first `risk-check status` token in `execute_sequential`, and the plan's literal wording put a second token ahead of the FAIL arm. Reworded to "the `status` call that gates it done below"; the instruction is unchanged. (163339e7)

## Open items

- `references/risk-surface.md`'s staged block does not state that `empty: true` on the staged arm is what an unstaged change produces - the caveat lives only at the two fire sites (`verify.md`, `debug.md`). Declined in the fix dispatch as outside its two findings.
- `prose-agreement.test.mjs:1664` anchors its assertion slice on the first occurrence of two command names in `execute_sequential`, so a future sentence naming `risk-check status` ahead of the FAIL arm silently shortens what it covers. Declined as outside plan 2's tasks; re-anchoring a gate-enforcement test is its own decision.
- In the scratch-repo check this session, a staged line `password = "hunter2"` in `a.txt` answered `matches: []` for `--surfaces secrets`. Not investigated: the plan's scope is range identity, not detector recall, and `.txt` may sit outside `REVIEWER_TEXT_PATHSPECS`. Worth one look before the detector is trusted on that shape.
- Plan 1's declined post-read index agreement check is CLOSED by 61c39022: diffing `<base> <tree>` makes the check unnecessary.

## Goal check

The goal has two halves and the commits cover both. "A partial resolve keeps the end that resolved": 4a1b31d4 resolves each end through `resolveRef` and names the failed end, and c41adcaa carries the resolved end's id onto the `no-diff` row (`git show c41adcaa --stat` touches `risk-check.mjs` and `risk-diff.test.mjs`; the plan-1 report records 105 risk-diff rows passing after it). "No caller hands a blocking check a range that cannot match": 75113949 and b7a47569 give the staged scope one spelling on both `run` and `status`, a785ad3d and d0045630 put that spelling at the two fire sites and the reference, and 163339e7 replaces the self-comparing range at `execute.md`, `task.md` and `execute-parallel.md` with a `risk_check_skipped` event (the plan-2 report's task-3 row names all three sites and the shared constant the test keys on). The two `diff` reviews found what the plan did not name - a staged record with no index identity (740867b7), a window between naming the index and reading it (61c39022), and prose that described the fix as staged without staging it (0fceb073) - and each fix extends the goal rather than reaching past it. What the commits do not deliver: the `empty: true` caveat is stated at the two fire sites and not in the reference, named above as an open item. The suite is green after the last commit (3766 tests, 3765 pass, 1 pre-existing skip, per the plan-2 report) and `tsc -p tsconfig.ci.json` is clean.
