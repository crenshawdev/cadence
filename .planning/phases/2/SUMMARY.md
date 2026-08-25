---
phase: 2
status: complete
completed: 2026-08-25
---

# Phase 2: Census registry and plan-time lease check - Summary

A frozen registry of the repository's nine hand-maintained census counts, plus a `lease-check --plan-time` arm that reads a PLAN's `files:` lease against it and refuses, from `/cad-plan`, before an executor is dispatched.

## What shipped

- Census registry, nine deeply frozen rows (holder, counts, asserted-by, subjects) - `cadence-core/bin/lib/census-registry.mjs`
- `CADENCE-CENSUS` marker grammar plus the unregistered-census rule, so a census live in a test but absent from the registry reddens the suite - same module, asserted by `cadence-core/bin/census-registry.test.mjs`
- `censusesAtRisk()` over `lease-grammar.mjs`'s `intersects`/`covers`, no second containment rule - same module
- Nine live census sites marked, one comment line each
- `lease-check --plan-time`: reads lease and registry only, spawns no `git`, executes nothing from the plan - `cadence-core/bin/planning/lease-check.mjs:255-282`
- Commit-time refusals split: `undeclared-census-files` (with `census_files` and a trace event) vs the byte-identical old `undeclared-files`
- `<step name="check_census">` firing the arm once per plan on both the dispatched and `--inline` paths - `cadence-core/workflows/plan.md:303-341`
- 43-plan historical replay with per-entry counts - `.planning/phases/2/census-replay.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 520761da | Name every hand-maintained census in one frozen registry |
| 1 | 2 | ab4a7d37 | A marked census site with no registry row is an issue |
| 1 | 3 | 7fdfa445 | Answer which registered censuses a declared file list puts at risk |
| 1 | 4 | c6c20ae5 | A marked census with no row reddens, proved by a fixture pair |
| 1 | 5 | 54520d22 | Mark the nine census sites with their registry ids |
| 2 | 1 | 90578bcb | Declare the plan-time flag on lease-check |
| 2 | 2 | ba3a6723 | Answer the lease question before an executor runs, not after |
| 2 | 3 | 55c8ec1f | Phase 5's own lease, replayed, names the three counts it would move |
| 2 | 4 | 61856a09 | Replay the arm over 43 of this repository's own plans |
| 2 | 5 | 5eff71c6 | A staged census file refuses under its own name and leaves a record |
| 2 | 6 | 4051e3b3 | /cad-plan refuses a plan that would redden a count it never declared |
| 2 | 7 | b04c7e5a, 6e7fca8b | Re-pin the EXECUTE-10 citation and plan.md's seam-call census |

## Deviations

- [deviation] Plan 1 task 1: the `self-verify-merge-layers` row's `counts` prose spelled `` `mergeLayers(` `` literally, and self-verify's merge-warnings rule matches name-plus-paren on any non-comment line, so the registry became a thirteenth callsite and three tests failed at task 4. Fixed at the mention by dropping the paren, in c6c20ae5.
- [deviation] Plan 2 task 2: the plan's `Verify:` predicted `ok:true` for a lease declaring `cadence-core/bin/planning/` plus `trace.test.mjs`; observed `ok:false` with two entries left, because the registry has THREE rows whose subjects intersect `planning/`. Run C (all three holders) returned `ok:true`. Taken as the criterion's substance; no code changed. The plan's own task 3 already states the three-name answer.
- [deviation] Plan 2 task 7: the full suite went 3090/1 on `seam-calls.test.mjs`'s `plan.md` row (`12 !== 11`), because task 6's `check_census` is a genuinely new seam invocation - the count was right and the pin was stale. That file sat outside the lease and CONTEXT D-05 excluded it from the registry. Dispatch 2 raised a structural checkpoint rather than editing outside its lease. Resolved both ways between dispatches: the lease was amended to declare it, and **D-05 was corrected** - the "DERIVED, never baselined" header covers the header arithmetic and NOT the assertion, which compares `seamCalls(text)` against a literal `calls: 11` at `seam-calls.test.mjs:86`. Re-pinned to 12 with its derivation in 6e7fca8b.

## Open items

- `cadence-core/bin/seam-calls.test.mjs` warrants a registry row the corrected D-05 implies, and plan 2 did not add one (`lib/census-registry.mjs` is plan 1's module and PLAN-2 never edits it). The same commit must also rewrite that module's header at `:44-49`, which still carries the pre-correction D-05 text naming this file as the worked example of what is NOT a census, and add its missing `CADENCE-CENSUS` marker - row and marker are one act.
- `lease-check --plan-time` fails OPEN on unparsed frontmatter: `lease-check.mjs:267`'s `if (!atRisk.length) return ok(base)` returns a PASS when `parsePlanFiles()` yields `declared: []` with `frontmatter_issues` carried as informational output only. `execute.md`'s `choose_path` already treats a `frontmatter_issues` entry as grounds to refuse; the two gates read one signal two ways. Raised by the `risk_surface` review, ruled `downgraded` (reach, not truth - no such plan exists in the 43-plan replay).
- `cadence-core/references/conventions.md` documents `CADENCE-DEBT` in `## Deliberate shortcuts` and has no counterpart for `CADENCE-CENSUS`, so the marker grammar has no prose home outside its own module header.
- `seam-calls.test.mjs`'s header paragraph beginning "PLAN-2 task 6 stated 5 for `context.md`" refers to a PHASE 5 plan and now reads as if it were about this phase's PLAN-2.

## Goal check

The fifteen commits deliver the goal. Criterion 1 holds: `lib/census-registry.mjs` carries nine frozen rows and `census-registry.test.mjs` proves a deleted row reddens, run as nine separate suites (plan 1 task 5). Criterion 2 holds and is proven negatively as well as positively - the no-git arm shadows `git` on the child PATH with an argv-recording stub and asserts the log was never created, and the executes-nothing arm rewrites the same plan's Action prose and asserts byte-identical stdout (55c8ec1f). Criterion 3 holds against phase 5's PLAN-1 lease transcribed with its `git show 6645ce4b:` citation, naming exactly three at-risk holders (55c8ec1f). Criterion 4 holds: `check_census` sits at `plan.md:303-341`, strictly between `check_size` (:277) and `count_planned` (:342), with `--plan-time` at :314 and zero `AskUserQuestion` inside the block (4051e3b3). Full suite 3091 pass / 0 fail, `self-verify.mjs` `problems: []`, `npx tsc -p tsconfig.ci.json` exit 0, all verified after the final commit.

The strongest evidence is not in the criteria: at task 6 this phase's own plan moved a census it had not declared, and task 7 halted on it rather than editing outside its lease. That is the failure CEN-02 names, reproduced by the phase that closes it, and caught. What is genuinely short is the registry's completeness - `seam-calls.test.mjs` is now known to be a census and has no row, so the very count that caught this plan is still unprotected for the next one. That is the first open item and it is a small follow-up, not a gap in the machinery.
