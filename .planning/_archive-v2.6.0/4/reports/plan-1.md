PLAN COMPLETE
Plan: .planning/phases/4/PLAN.md
Tasks: 7 of 7
| Task | Commit | Note |
|---|---|---|
| 1: Token, role and read-set flags on `trace append` | db9301b | `--tokens` via `requireInt` (negative refused under the same `bad-args`), `--role` under the `--plan`/`--sha` guard shape, `--read` one comma-separated value split like `phase-done --reqs`. No flag coupled to an event name. CONTRACTS row + header usage line updated in the same commit. 11 new tests. |
| 2: Per-role aggregation inside `renderTrace` | 219cc22 | `roles` on the `TraceRender` typedef and computed in the lib, never in `cmdTrace`; token total omitted when nothing was recorded, `unrecorded` a dispatch COUNT omitted at zero. `phase_start` invents no row. Pairing loop untouched. 11 new tests; scratch render printed the plan's expected string byte-for-byte. |
| 3: Brackets at `context.md` and `plan.md` | a02f4d0 | context.md 3 `trace append` lines (1 dispatch, 2 terminals); plan.md 12 (4 dispatches, 8 terminals) across spawn_planner, handle_return, check_gate and BOTH revision re-dispatches, each closed at its own step. Every dispatch line carries `--role` and a non-empty `--read`; every terminal carries `--role`. Budgets regenerated: context.md 16615->18825, plan.md 16225->21606. |
| 4: `review-triggers.md` bracket + role/token/read on the two shipped brackets | 602545e | review-triggers.md claude-subagent arm bracketed (1 dispatch, 2 terminals); cross-model arm states its own carve-out in prose. execute.md and verify-deep.md brackets gained `--role`, `--tokens` and `--read`; `execute.md`'s `phase_start` anchor left with none of the three and said so in prose. Budgets: review-triggers.md 15376->17733, execute.md 26210->27526, verify-deep.md 3650->4337. |
| 5: `/cad-progress --trace` prints the per-role totals | c4e0a98 | `roles` block instruction added inside the `trace` step between the family counts and `unpaired`, with the absent-total-is-`unrecorded`-never-`0` reading rule stated. No new flag, no other step touched. Budget 7864->8570, equal to the file's byte count. |
| 6: Per-file bracket coverage in the producer census | ffd73e7 | `traceAppends` now captures `--plan`, `--role` and `--read`, quoted form tried first for `--read`. `BRACKETING` maps the five files to their dispatch minimums (context 1, plan 4, review-triggers 1, execute 1, verify-deep 1) with the comment reversing the archived per-file note. Per file: dispatches >= minimum, terminals >= dispatches, AND returns >= dispatches. Globally: `--role` on every non-anchor dispatch/terminal, non-empty `--read` on every dispatch. All six patch-and-rerun proofs recorded below; `git status --short` clean of prose files after. |
| 7: Whole-tree gate sweep and end-to-end token evidence | (no commit) | Gate-only task with nothing to change: `weight-budgets.json` reported ZERO stale entries, which is the plan's stated condition for touching it, so no file was modified and no commit was made. Gate output below. AC6's dispatch half is human-verify and was NOT run - see below. |

Task 7 gates, run from `/data/code/cadence`:
1. `node --test cadence-core/bin/*.test.mjs` -> `tests 1451 / pass 1451 / fail 0`.
2. `npx tsc -p tsconfig.ci.json` -> no output (exit 0).
3. `node cadence-core/bin/self-verify.mjs --root .` -> `{"ok":true,"checked":"config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, rung-effort, verifier-write-grant, routing-cells, effort-enums, risk-surfaces, config-reach, dispatch-phrasing, route-relay, merge-warnings, deferred-reads, script-contracts","problems":[]}` - no `budget-overrun`, no `unbudgeted-surface`.

AC6 (human-verify) NOT RUN - it is outside the executor's reach, exactly as the
plan states: the executor holds no `Task` tool, so step 3 of the walk (dispatch
one subagent and read the token figure off its return metadata) cannot be
performed, and steps 2, 4 and 5 were deliberately NOT simulated - appending an
invented token figure to `.planning/trace.jsonl` would manufacture the very
evidence the criterion exists to obtain. The five numbered steps in the plan's
Task 7 Verify remain for the orchestrator, which holds `Task`.

AC5 patch-and-rerun (each restored with `git checkout -- <file>`; the run command was `node --test cadence-core/bin/trace.test.mjs` every time, `fail 1` on each):
1. Deleted `context.md`'s `--event dispatch` line -> `cadence-core/workflows/context.md: expected at least 1 written \`--event dispatch\` bracket(s), found 0. A dispatch site with no bracket is a paid worker whose cost never reaches the run record.`
2. Deleted ONE of `plan.md`'s four `--event dispatch` lines -> `cadence-core/workflows/plan.md: expected at least 4 written \`--event dispatch\` bracket(s), found 3. ...` (the COUNT binding, not merely presence)
3. Deleted `review-triggers.md`'s `--event return` line -> `cadence-core/references/review-triggers.md: 1 \`dispatch\` bracket(s) but only 0 \`--event return\` close(s). Each dispatch moment writes its own; one of them is unclosed on its success path.`
4. Deleted ONE of `plan.md`'s four `--event return` closes, leaving all four dispatches and the other three closes -> `cadence-core/workflows/plan.md: 4 \`dispatch\` bracket(s) but only 3 \`--event return\` close(s). ...` (a presence-only assertion passes this)
5. Dropped `--role cad-executor` from `execute.md`'s `--event return` line -> `cadence-core/workflows/execute.md: \`--event return\` with no \`--role\` - its worker cannot be grouped into the per-role totals at all.`
6. Blanked `verify-deep.md`'s dispatch `--read` to `--read ""` -> `cadence-core/workflows/verify-deep.md: \`--event dispatch\` with an empty or absent \`--read\` - the record would show a dispatch that caused no reads.`

Deviations:
[deviation] Task 4 as written names one terminal bracket for `review-triggers.md` (after "Parse the JSON object it returns"). A failed, empty or unparseable reviewer return would then leave the bracket open forever, so a second `--event checkpoint` arm was written beside it, carrying `--tokens` per the task's own verify rule - a reviewer that burned its budget and came back unusable is exactly the dispatch whose cost must still reach the record.
[deviation] Task 6's proof (4) assumes `plan.md` carries four closing lines; it carries EIGHT, because every dispatch moment writes two mutually exclusive closing ARMS (a `return` form and a `checkpoint` form), which is also true of `execute.md` (1 dispatch, 2 terminals), `verify-deep.md` (1, 2), `context.md` (1, 2) and `review-triggers.md` (1, 2). Under the plan's stated `TERMINAL >= dispatches` assertion alone, deleting one closing line from `plan.md` leaves 7 >= 4 and the suite stays GREEN - proof (4) could not land, and a whole site could lose BOTH its arms undetected. Fixed inline by adding a second, sharper per-file assertion beside the stated one: `--event return` closes >= dispatches, since every dispatch moment in every bracketing file writes exactly one `return` form. Proof (4) then lands verbatim, printing 4 dispatches / 3 returns. The stated `TERMINAL >= dispatches` assertion is kept as written.
Open items:
[open] The cross-model review arm is unmeasured by design (CONTEXT D-12). Under a panel, `cad-reviewer`'s per-role total covers the claude-subagent voice only and is short by the provider call(s) that ran beside it, by an unstated amount. `review-triggers.md` now says so in its own prose; the honest fix is a per-adapter `extractUsage`, and no provider response body has been confirmed to carry a usage block. Worth a CAPTURE item.
