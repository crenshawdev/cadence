PLAN COMPLETE
Plan: .planning/phases/3/PLAN-3.md
Tasks: 2 of 2
| Task | Commit | Note |
|---|---|---|
| 1: Bound the resolve loop by wall clock | dd30e52 | Deadline taken once at loop start from the same resolved `--timeout-ms`/`DEFAULT_TIMEOUT_MS` value; each call bounded by what remains. Loop comment, header `--timeout-ms` line and the constant's doc rewritten; `MAX_RESOLVES` untouched. Falsifier `WATCHED FAILING AT 1ca00f7`: 5 resolves, 5.07s. Patched: 2 resolves, 2.06s. |
| 2: The two behaviours the budget must not break | 17e58d1 | D-11 case (unanswered number FIRST, later ones answered) and D-15 case (budget spent mid-loop, status 0 / ok:true / action:report, real state behind, `unresolved` ahead). D-11 case watched failing against a mutated `if (!one.ok) break;` loop: 402/403 came back `unresolved`. |
Deviations: none
Open items: harness `stub()` gained one option, `issueSleep`, sleeping only on the unmatched `tea issues <n>` arm - the existing `sleep` slows the list call too, which would have made the budget measurement unfalsifiable (5 slow resolves at 1s under a 2s bound plus a 1s list read is 6s, inside `MAX_RESOLVES x bound`). Declined a per-argv sleep map: no case needs a third slow shape.
