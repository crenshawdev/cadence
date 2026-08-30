# Task: gh-179-gaps-execute

## What shipped

- Gated /cad-execute's already-executed refusal on an empty dispatch set, so a /cad-plan --gaps plan can run (GH-179).
- `cadence-core/workflows/execute.md`'s `locate` step refused a phase whose derived status was `executed` or `complete` in its fourth arm, before the fifth arm asked `replay-check` what was actually outstanding. Since a gap plan closes unresolved UAT items, and UAT exists only after a phase has run, every `--gaps` plan landed on a phase that refusal rejected - and `--rerun`, the only documented way past it, widened `dispatch_set` back over the already-committed plans the refusal existed to protect, so following the instruction overwrote a shipped run's executor report.
- The refusal now sits BELOW the replay call and carries an empty-`dispatch_set` term. A non-empty set is the phase's outstanding work and dispatches whatever the derived status says. `--rerun` keeps its existing meaning of deliberately re-running completed plans.
- Two prose tests moved with it. `#195` found its refusal arm with a bare `arms.find(a => a.includes('/cad-undo'))`, which after the move would have grabbed the replay arm instead, so it now excludes that arm by name; it also gained two assertions requiring the `dispatch_set` term and the word EMPTY in the trigger clause. `EXP-03`'s fifth assertion pinned the replay arm as sitting BELOW the refusal and is inverted, with the reason recorded at the assertion.
- Verified: `node cadence-core/bin/test.mjs` 3563 tests, 3562 pass, 0 fail, 1 skipped; `node cadence-core/bin/self-verify.mjs` ok:true with problems: []; `risk-check run` over the range reports no matches and `written: true`.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | c87bef420ce45c9f06febb67112bcbbe26996abf | fix: gate the already-executed refusal on an empty dispatch set |

## Files

### Task 1: gh-179-gaps-execute

- **Files:** cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/workflows/execute.md
