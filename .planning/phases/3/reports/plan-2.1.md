PLAN CHECKPOINT: structural
Plan: .planning/phases/3/PLAN-2.md
Tasks: 1 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - Self-verify's routing checks re-keyed onto the map and the ladder, cells lib deleted | 6250bca7 | Verify, all four arms: `test -e cadence-core/bin/lib/route-cells.mjs` and `test -e cadence-core/bin/route-cells.test.mjs` both fail; `node --test cadence-core/bin/self-verify.test.mjs` -> tests 162 / pass 162 / fail 0; `node cadence-core/bin/self-verify.mjs` -> `{"ok":true,...,"problems":[]}` with `checked` now naming `rung-ladder`; with `agents/cad-planner-low.md` moved out, exit 1 and exactly one problem, `{"kind":"missing-rung-agent","file":"cadence-core/bin/lib/rung-agent.mjs","detail":"cad-planner at rung low: agents/cad-planner-low.md absent"}` (file moved back, `git status agents/` clean); `node cadence-core/bin/test.mjs routing` -> tests 412 / pass 412 / fail 0. Typecheck `npx tsc -p tsconfig.ci.json` exit 0. |
| 2 - route-table.json deleted, its readers re-keyed | (not committed) | Work is DONE and sitting in the working tree; three of four Verify arms pass, the fourth cannot be met inside this plan's lease. See the checkpoint below. |

## Checkpoint: task 2 needs INTERNALS.md, which is PLAN-3's file

**What is on disk now** (uncommitted, left in place for the continuation):

- staged: `D cadence-core/route-table.json`
- unstaged: `M cadence-core/bin/prose-agreement.test.mjs`, `M cadence-core/bin/risk-diff.test.mjs`, `M cadence-core/bin/rung-agent.test.mjs`
- `INTERNALS.md` is UNTOUCHED and byte-identical to HEAD (a probe edit was made and reverted; `git status INTERNALS.md` is clean).

**Task 2's Verify, arm by arm:**

1. `test -e cadence-core/route-table.json` fails - PASSES.
2. `grep -rn "'route-table.json'" cadence-core/bin` prints nothing - PASSES (exit 1, no output).
3. `node cadence-core/bin/test.mjs prose routing` - FAILS: tests 717 / pass 715 / fail 2. Both failures are
   `the repo itself passes self-verification` and
   `entry: a valueless or empty --root refuses instead of linting the cwd`, and both have the single cause in arm 4.
4. `node cadence-core/bin/self-verify.mjs` reports `ok: true` - FAILS, with exactly one problem:
   `{"kind":"missing-internals-path","file":"INTERNALS.md","detail":"cadence-core/route-table.json"}`

**Cause.** `INTERNALS.md:17` cites the file as a backticked repo path:

> Read the code: `cadence-core/bin/route.mjs` (the resolver), `cadence-core/route-table.json` (the five grids - the 18 cells, the review gates, the cross-model reviewer's tiers and efforts, the verify switch - all editable data, no code change to retune), `cadence-core/bin/lib/rung-agent.mjs` (which file carries which rung), `cadence-core/bin/route.test.mjs`.

Self-verify's check 3b refuses a backticked repo path in `INTERNALS.md` that does not exist, so deleting the table makes the tree red on the very command task 2's Verify runs. PLAN-2's Notes anticipated the prose gap only for `stakes` TOKENS ("Self-verify does not flag them - the tokenizer reads dotted tokens only"); that reasoning is correct for `stakes` and does not cover a cited PATH, which check 3b reads by a different rule.

`INTERNALS.md` is not in PLAN-2's `files:` list and IS in PLAN-3's. Measured, not assumed: with the one-line correction staged,
`node cadence-core/bin/planning.mjs lease-check --phase 3 --plan 2` returns
`{"ok":false,"reason":"undeclared-files",...,"undeclared":["INTERNALS.md"]}`. The probe edit was reverted.

**Blast radius is exactly this one path.** No other out-of-lease file breaks: `grep -rn "'route-table.json'" cadence-core/bin` is empty, no `weight-budgets.json` row and no `.planning/DOCS-CLAIMS.md` row names the file, and every surviving mention under `cadence-core/bin` is comment or fixture prose that reads nothing (the two the plan names as historical fixture text, `planning-files.test.mjs` and `planning-criteria-coverage.test.mjs`, are untouched as instructed).

**Proposed fix** - one sentence, and PLAN-3 still owns the file for its `stakes` sweep afterwards:

> Read the code: `cadence-core/bin/route.mjs` (the resolver), `cadence-core/config.schema.json` (the defaults it answers gates, tiers, efforts and the verify switch from - editable data, no code change to retune), `cadence-core/bin/lib/rung-agent.mjs` (which file carries which rung), `cadence-core/bin/route.test.mjs`.

**What I need:** either (a) `INTERNALS.md` added to PLAN-2's `files:` lease so the correction rides task 2's commit, or (b) a decision that the deletion moves to PLAN-3. (a) is the smaller change and keeps the plan order intact.

Deviations:
- [deviation] Task 2's `Verify:` asserts `node cadence-core/bin/self-verify.mjs` reports `ok: true` after `cadence-core/route-table.json` is deleted. It does not: check 3b files `missing-internals-path` for `INTERNALS.md`'s citation of the deleted file. Correcting it needs a file outside this plan's lease, confirmed by `lease-check` returning `ok:false`, so I stopped instead of widening the lease myself.
- [deviation] Task 2's Action says to reword the header comments in `gate-agreement.test.mjs`. PLAN-1 already did that (its line 3 reads "now that the schema `default` IS the answer and no level-keyed grid decides it") and the file names `route-table.json` nowhere, so there was nothing to change; the file is untouched. Same for "any remaining `route-table.json` remark in `rung-agent.test.mjs`" - there is none. I did correct one stale CELL remark there (`"route normally off the cell"` at the `effort-enum-drift` null row), which is what the cells' deletion made false.

Open items:
- Static analysis: `workflow.lint_command` is null and `planning.mjs detect-commands` reports `lint: null`, so there is no lint command Cadence can find for this project; `typecheck` is `npx tsc -p tsconfig.ci.json` and ran clean after task 1.
- Task 1's map-to-disk arm is gated on `isFullTree`; the plan's Action did not name a gate. RUNG_FILES lives in code, so a `--root` fixture cannot supply its own the way it supplied its own `route-table.json`, and ungated the arm reports thirty absent files against every minimal fixture - including the tree behind the `assert.equal(r.ok, true)` row at self-verify.test.mjs:347. The gate is the same D-03 line every always-expected input already sits on. Not a deviation: the task's `Verify:` is met either way, and the repo carries `.claude-plugin/plugin.json`.
- `fullFixture()` in self-verify.test.mjs now writes the whole 30-file ladder with a budget row each, rather than one `cad-verifier.md`. That removes a pre-existing `rung-effort-mismatch` its single agent file had been producing in every full-tree row (no `effort:` line under a mapped stem), and is what lets the missing-rung-agent row assert exactly ONE problem.
- `cadence-core/bin/route.mjs:78-79` still says the unanswered surface set is "ALL of the table's `risk_surface_categories`". The resolver reads `config.schema.json`'s `review.triggers.risk_surface.surfaces` values (`route.mjs:221`), so the remark names a file that no longer exists. `route.mjs` is in no plan's `files:` list this phase - not PLAN-2's and not PLAN-3's - so it is left as found.
- Not started: task 3 (`config.mjs unset`) and task 4 (`stakes` as a retired key). Neither depends on the blocker.
