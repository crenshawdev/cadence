PLAN COMPLETE
Plan: .planning/phases/3/PLAN-1.md
Tasks: 7 of 7
| Task | Commit | Note |
|---|---|---|
| 1: A phase's plans, read for what they declare | a9bbffa | `declaredPhaseFiles` (union) + `declaredPlanFiles` (named key) with `found`/`clean`; 10 new cases, 14 pass. |
| 2: What a declared file set touches | bf10430 | `scanDeclared` beside `scanDiff` over one extracted signal walk; 6 new cases, 80 pass (every pre-existing `scanDiff` case unchanged). |
| 3: The resolve returns a floored level | b87d5e2 | `riskFloor` in route.mjs + header rewrite + schema `stakes` purpose; config-seams retired-override case re-pointed with a no-key control. routing group 384 pass. |
| 4: A plan it cannot read fails closed | 78854e6 | Three-way split of the no-hit arm + the aggregation predicate stated; 6 new cases (5 fail-closed + the paired positive). routing group 390 pass. |
| 5: An executor floors on its own plan | b70e217 | `resolve --plan` typed `plan-key`, refusing both axes; census pin 166 -> 167 and a PINNED row added; 5 new cases. Full suite 2561 pass. |
| 6: A malformed `--phase` is refused | 77e53de | `warn` -> `refuse` on both axes, `phaseWarning` relay deleted, every prose site naming it as the `warn` exemplar rewritten; PINNED row flipped. Full suite 2561 pass. |
| 7: The call sites pass what the floor needs | 1c2c45c | `--plan <k>` at execute.md's executor resolve, `--phase {N}` at plan.md's check_gate, seams.md's floor rule + the executor exception to resolve-ONCE; three `weight-budgets.json` rows re-pinned from weight.mjs. `test.mjs routing prose` 667 pass; self-verify ok:true, problems []. |

Deviations: [deviation] Task 2's Verify asserts "the real bytes of cadence-core/bin/lib/risk-diff.mjs supplied as that same path yield no content match while the identical bytes supplied under another path do". Measured: risk-diff.mjs matches NOTHING under either path - v3.5.5's mention-level respelling already removed every self-matching line, which risk-diff.test.mjs's own census independently pins, so the "under another path do" half is not true of what ships. The exemption is proved on the OTHER named signal-table file instead: cadence-core/bin/lib/surface-scan.mjs self-matches auth, billing and untrusted_input by construction, reports [] under its own path and those three under any other. risk-diff.mjs keeps a row of its own pinning [] under both paths, so the criterion's property - the exemption works and is not vacuous - is proved rather than assumed.

Open items:
- `milestone-prune.test.mjs:557` ("corpus: pruning this repository's own REQUIREMENTS.md needs no hand repair") FAILS on a clean tree at 23fb76d, before any commit in this plan - verified by stashing and re-running. Pre-existing, outside this plan's lease, untouched.
- No `lint` command exists for this project (`planning.mjs detect-commands` answers `lint: null`); static analysis ran as `npx tsc -p tsconfig.ci.json`, clean before every commit.
- `lib/retired-keys.mjs`'s eight `risk.override.*` detail strings say "there is no floor for a waiver to lower", which stopped being true at b87d5e2. D-03 locks that file byte-identical and PLAN-2 pins it with a test, so the sentence stays - flagged for the human, as the plan's Notes state.
- The plan's Notes record a measurement of "path signals 0/48, body pass 39/48" over this repo's PLAN files. Re-measuring the same shape through `scanDeclared` gives 0/49 and 9/49. Nothing in this plan rests on the figure - the detector reads the DECLARED files' bodies, never the PLAN bodies - but the note is not reproducible as written.
