# Task: declines-off-the-tracker

## What shipped

- Declined gate findings stop reaching the tracker.
- A declined finding used to be created as a labelled issue on the forge, because
- that label was the only place a decline persisted. On crenshawdev/cadence that
- was 49 issues - 23 closed, 26 still open - against 16 anybody would call real
- work. The record moves to .planning/DECLINED.md and the forge never hears about
- a decline again.
- Three planned tasks plus one review round:
- 1. planning-files.mjs grows DECLINED.md's grammar - parseDeclinedRows and
- appendDeclinedRow sharing FILED_ROW and the append discipline with their
- FILED.md siblings, both pairs now running one shared body. DECLINED_PREAMBLE
- states that the file is deliberately outside the recall corpus.
- 2. issue-filing.mjs reads the decline set locally and stops creating an issue
- for a declined disposition. The incomplete-lookup refusal goes with the
- paginated lookup that needed it.
- 3. references/triage-gate.md stops telling the gate that every answer becomes a
- tracker issue.
- The blocking risk_surface fire on the range raised five findings (openai,
- gpt-5.6-sol, high). Four survived and are fixed in 1cce9cec: an unreadable
- existing file read as empty and then overwritten, a grammar-rejected row
- reported as recorded, a dangling symlink read as absence, and a conflicted
- record read past. One was refuted - a decline ahead of a failed create IS
- mirrored, because the create-failure branch mirrors before it emits.
- 3654 tests pass, self-verify clean. triage-gate.md's weight ceiling was raised
- 460B in the same commit as the prose that grew it.
- The adjudication record was written BY HAND: planning.mjs adjudication refuses
- --phase 0 with no-phase-dir, and a task has no phase directory by design.
- Captured as its own todo.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | e1b048953ee550dae43bcd0fbdaf9d4ed1d034f2 | feat(planning-files): DECLINED.md gets the FILED.md row grammar |
| 1 | 5f4bcb9780512519055e8c43f7ee0c8044a1a76d | fix(issue-filing): a declined finding never reaches the forge |
| 1 | 1f439167c2f88fc8b38aa6177641779b557a2f9f | docs(triage-gate): the gate stops sending declines to the tracker |
| 1 | e9cdb95dff4f89fce81858fa5c52e522ac6ddea0 | docs: task plan declines-off-the-tracker |
| 1 | 1cce9cec283e793fa542795a43d9cf9a0239efba | fix(issue-filing): close four ways a decline row could go missing |

## Files

### Task 1: declines-off-the-tracker

- **Files:** .planning/DECLINED.md, .planning/tasks/declines-off-the-tracker/PLAN.md, cadence-core/bin/issue-filing.mjs, cadence-core/bin/issue-filing.test.mjs, cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/references/triage-gate.md
