---
phase: 1
status: complete
completed: 2026-08-28
---

# Phase 1: The fix pass is a dispatch - Summary

A blocking-gate FAIL now names a `cad-executor` continuation under the failing plan's own worker key as the fixer at every FAIL site that has one, `execute.md` forbids the coordinator any `Edit`/`Write` outside `.planning/`, and four tests redden if the instruction, its guardrail, the lease widening or the second bracket is lost.

## What shipped

- The FAIL-arm dispatch rule - `cadence-core/workflows/execute.md`'s `risk_surface` arm names the continuation `cad-executor`, worker key `<k>`, the persisted `REVIEW-risk_surface-plan-<k>.md` path and the return arm (`a5659870`)
- The coordinator write ban - one `<guardrails>` bullet in `execute.md`, by path, no exception clause (`4272c41b`)
- Lease widening as the unblock - a finding outside the plan's `files:` is cleared by amending `PLAN-<k>.md`, never by exempting `lease-check` (`5ca8d964`)
- The same dispatch named at every other plan-key FAIL site - `execute.md`'s `diff`-at-`adjudicated` arm (`a225ec1d`), `references/execute-parallel.md`'s per-plan risk sequence, stated to run in the main tree (`2c6ffc6d`), and `workflows/task.md`'s `--plan` path (`d5d28b05`)
- The inline carve-out - `task.md`'s inline path mints no worker key, so its FAIL stays with the user (`2e1e8731`)
- The re-arm cap keyed per plan - `references/triage-gate.md`'s read-back filter gained `(o.plan??"")===(process.argv[3]??"")`, so a second plan's fix still gets its narrowed round (`18881df8`), proven against a fixture record written by the real `trace` seam (`b2cebcaa`)
- "Fix by hand" disambiguated - the hand is the user's, outside Cadence, strictly later than the FAIL-branch dispatch (`c5491d20`)
- Four enforcement tests - `prose-agreement.test.mjs` reddens separately on the FAIL arm and on the guardrail (`9be1aa68`), `planning-lease-check.test.mjs` proves the widened lease is what clears the fix commit (`7fff7d92`), `trace.test.mjs` proves the fix lands inside a second `cad-executor` bracket (`853aa3dd`)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | a5659870 | `execute.md`'s `risk_surface` FAIL arm names the `cad-executor` continuation, worker key `<k>`, the findings path and the return arm |
| 1 | 2 | 4272c41b | `<guardrails>` bullet: coordinator issues no `Edit`/`Write` outside `.planning/`, no exception clause |
| 1 | 3 | 5ca8d964 | A finding outside the lease amends `PLAN-<k>.md`'s `files:` before dispatch; both rejected alternatives named |
| 1 | 4 | a225ec1d | The `diff`-at-`adjudicated` arm points at the same continuation under worker key `<k>` |
| 1 | 5 | 2c6ffc6d | `execute-parallel.md` step 5 names the fix dispatch and states it runs in the MAIN tree |
| 1 | 6 | d5d28b05 | `task.md`'s `--plan` path names the fix as a `cad-executor` dispatch under plan key `1`, no lease gate |
| 1 | 7 | 2e1e8731 | `task.md`'s INLINE path mints no worker key, so its FAIL stays with the user |
| 2 | 1 | 18881df8 | Re-arm read-back keyed on the plan, not `corr` alone; `??""` on both sides matches the `--plan`-less fires |
| 2 | 2 | b2cebcaa | The fenced block executed via `sh -c` against a real-seam fixture record: plan 1 -> `1`, plan 2 -> `0` |
| 2 | 3 | c5491d20 | `triage-gate.md`'s terminal "fix by hand" is the user's hand, outside Cadence, later than the FAIL dispatch |
| 2 | 4 | 9be1aa68 | Two `prose-agreement` slices redden independently on the FAIL arm and on the guardrail |
| 2 | 5 | 7fff7d92 | `undeclared-files` refusal asserted first, then the `files:` amendment alone flips the same call to `ok:true` |
| 2 | 6 | 853aa3dd | Fixture record shows two dispatches, two closes, and the fix commit inside the second `cad-executor` bracket |

## Deviations

None - plans executed as written.

## Open items

- No lint ran on any task: `workflow.lint_command` is unset and `planning.mjs detect-commands` returns `lint: null` for this project. `typecheck` (`npx tsc -p tsconfig.ci.json`) ran clean before every commit.
- Only `workflows/execute.md`'s FAIL arm is pinned by a prose-agreement assertion. The two other plan-key sites PLAN-1 wrote - `references/execute-parallel.md`'s per-plan risk sequence and `workflows/task.md`'s `--plan` path - carry the same dispatch instruction with no check that reddens if it is lost. AC6 names `execute.md` only, so this is a scope boundary rather than a miss, but the two arms can silently regress.
- `risk_surface` review of plan 2's range (`2e1e8731..853aa3dd`, cross-model `openai`/`gpt-5.6-terra`) raised one finding, adjudicated `downgraded`: the re-arm read-back compares `o.plan` strictly against `process.argv[3]`, so a trace record carrying a numeric `plan` would read as no prior re-arm and let an uncapped round through. Downgraded on reachability - every writer of that field is a CLI seam emitting a string - but `trace.mjs` types the field `any` and normalizes nothing, so the guard is type-fragile in a block whose siblings already fail closed. Record at `.planning/phases/1/ADJUDICATION-risk_surface-plan-2.json`.

## Goal check

The commits plausibly deliver the goal. The goal has three halves and each has a commit behind it. WHO fixes is named: `execute.md`'s FAIL arm carries the continuation `cad-executor` under worker key `<k>` (`a5659870`), and the same instruction reaches the three other plan-key FAIL sites (`a225ec1d`, `2c6ffc6d`, `d5d28b05`) with the keyless inline path carved out explicitly (`2e1e8731`). What the coordinator may NOT do is stated by path with no exception clause (`4272c41b`), and the obvious way around it - exempting the fix from `lease-check` - is closed in favour of amending the plan's `files:` (`5ca8d964`, proven at `7fff7d92`). That the fix is a worker's reviewed-shape commit rather than the orchestrator's is the half that could have stayed prose, and it did not: `trace.test.mjs` drives a fixture record through the real seams and asserts the fix commit's `%ct` falls inside a SECOND `cad-executor` bracket (`853aa3dd`). Two gaps are named rather than claimed closed. The enforcement is asymmetric - only `execute.md`'s arm reddens on loss, so `execute-parallel.md` and `task.md` can regress silently (plan 2's own open item). And the per-plan re-arm cap that makes a second plan's fix reviewable (`18881df8`) rests on a strict comparison over a field `trace.mjs` types `any`, which the cross-model review found and this run downgraded rather than fixed, the finding being below the blocking gate's blocker/high bar.
