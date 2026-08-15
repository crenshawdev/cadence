PLAN COMPLETE
Plan: .planning/phases/2/PLAN-1.md
Tasks: 3 of 3
| Task | Commit | Note |
|---|---|---|
| 1 - Attribute a pre-anchor event to its phase's next anchor at read time | 8fb4110 | `renderTrace` split into a parse pass, a backward repair pass and the existing accounting pass, so the repair costs no second `JSON.parse`. New test proved failing against the pre-fix reader (checked out HEAD's `trace.mjs`, ran the test alone: fail 1). Fixture re-baselined on `unpaired` only - all five `roles` rows byte-identical, as the plan measured. Also re-pointed `coordinator: a marker before phase_start joins the same phase across both corr ids`, which pinned the pre-fix two-id render; it now holds the same phase-keying guard with a re-run supplying the second id. |
| 2 - Report a bracket closed under a different role | b7a92c5 | `mismatched` always present on the render, relayed omit-when-empty through `trace render`. Accounting untouched: the four `roles` deep-equal tests are green unedited. Two new tests - the lib-level report (including the two non-mismatch shapes: same role, and a close with no `--role`) and the CLI's present/absent envelope. |
| 3 - Make a replayed terminal unable to fund a second dispatch | 5855efe | Identity tuple = worker key (corr after task 1's repair, phase, plan) + event name + role + ts + tokens. New test proved failing against the pre-fix FIFO pairing: it rendered `{dispatches:2, tokens:200}` with no `unrecorded`. The existing `a duplicated terminal cannot fund a second dispatch` test uses two different event names, so it is not a replay under this rule and its assertions are unedited. |
Deviations: none
Open items: none

Verification beyond the per-task Verify:
- `node --test cadence-core/bin/*.test.mjs`: 1706 pass, 0 fail.
- `node cadence-core/bin/self-verify.mjs`: `ok:true`, `problems: []` across all 21 checks (no `unbudgeted-surface`, no `budget-overrun`).
- `npx tsc -p tsconfig.ci.json` (the only static-analysis command `detect-commands` finds; `lint` is null): exit 0.
- Live-corpus smoke check, `planning.mjs trace render` over `.planning/trace.jsonl`: 533 events, 0 malformed, ZERO bare-form corr ids left (all 18 ids are `<phase>-<sha>`), `mismatched` absent (0 mismatches, matching D-05's measurement), 5 unpaired.
