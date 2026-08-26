---
phase: 1
plan: 1
requirements:
  - BUD-03
files:
  - cadence-core/config.schema.json
  - cadence-core/references/config-catalog.md
  - cadence-core/references/config-reach.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/planning/plan-size.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/planning-plans.test.mjs
  - cadence-core/workflows/plan.md
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/seam-calls.test.mjs
---

# Phase 1: Bound what a dispatch is handed - Plan 1

## Goal

A plan cannot silently hand its executor an unbounded read set. This plan is the
BUD-03 half: the bytes a plan's `files:` frontmatter declares become a measured
number with a configured ceiling, reported at plan time in the same shape the
task ceiling is already reported in.

## Must be true when done

- `planning.mjs plan-size --phase <N>` reports, for every plan file in that
  phase, how many bytes its `files:` frontmatter declares and how many of those
  declared paths contributed no bytes.
- A plan declaring more bytes than the ceiling comes back as one `over[]` entry
  naming the plan file, its measured bytes and the ceiling; a plan under the
  ceiling produces no byte entry at all.
- A plan declaring a path that does not exist on disk shows a non-zero absent
  count, so a creation-heavy plan cannot read as "under the ceiling" while the
  number is measuring something smaller.
- `workflow.max_plan_bytes` is a real config key with a stated default of
  675,000, registered in `config.schema.json`, `references/config-catalog.md`
  and `references/config-reach.md`.
- `/cad-plan`'s `check_size` step hands `plan-size` that ceiling and says both
  numbers out loud when a plan crosses it, and refuses nothing.
- `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs`
  reports no problems.

## Context

Locked: the ceiling bounds DECLARED BYTES and defaults to 675,000 (D-06); it is
one more `over[]` entry at the existing `check_size` step, never a new seam call
(D-07); `plan-size` still reads no config, so the ceiling arrives as a
caller-resolved CLI flag (D-08); the check REPORTS and refuses nothing (D-09);
the measurement sums on-disk sizes and reports the absent count beside the total
(D-10); a new key lands in four places and `workflows/plan.md` is pinned at
exactly its current byte budget (D-12).

Out of scope here: anything in `route.mjs`, `lib/risk-diff.mjs` or the risk
floor - that is PLAN-2, which shares no file with this one.

## Tasks

### Task 1: Register `workflow.max_plan_bytes` as a config key

- **Files:** cadence-core/config.schema.json, cadence-core/references/config-catalog.md, cadence-core/references/config-reach.md, cadence-core/bin/weight-budgets.json
- **Action:** Add `workflow.max_plan_bytes` to the schema as `type: int`,
  `min: 1`, `default: 675000`, immediately after `workflow.max_plan_tasks`. Its
  `purpose` states three things: what it bounds (the BYTES a single plan's
  `files:` frontmatter declares, measured as the sum of the on-disk sizes of
  those paths, per plan and not per phase, the same reading `max_plan_tasks`
  carries); that a crossing is REPORTED and nothing is refused, which is
  `planning.max_capture_bullets`'s disposition and D-09's decision, so the
  narrowing phrase `plan-size report only` must appear in the `purpose`
  VERBATIM; and where the default came from - the 75th percentile of the
  declared-byte distribution over this repository's 43 archived plans rounded up
  to the next 25,000 (p25 207,298, p50 401,107, p75 667,580, p90 933,283, max
  1,282,083, measured 2026-08-26; it fires on 10 of the 43), which is the
  derivation rule the six `workflow.max_dispatch_tokens.*` keys already state.
  Add the catalog row in the same column shape the neighbouring rows use, and
  the reach row with reach `plan-size report only` and an `Honoured by` cell
  naming `workflows/plan.md`'s `check_size` step and `planning.mjs plan-size
  --max-bytes` as the one reader; add that phrase to the reading-aid list of
  phrases at the top of config-reach.md, which is currently stale the moment a
  new one arrives. Re-pin the `cadence-core/references/config-catalog.md` and
  `cadence-core/references/config-reach.md` entries in
  `cadence-core/bin/weight-budgets.json` to their new sizes: both are pinned at
  exactly today's bytes (12,020 and 22,998) and the budget check is a ceiling,
  so any prose added goes over it. Do NOT give the key a refusing reader, and do
  NOT write the value into `.planning/config.json` - the default is the whole
  delivery.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no problems - in
  particular no `inert-config-key` for the new key, no reach-table finding and
  no weight-budget overage - and `node cadence-core/bin/config.mjs get
  workflow.max_plan_bytes` returns `675000`.

### Task 2: `plan-size` measures the bytes each plan declares

- **Files:** cadence-core/bin/planning/plan-size.mjs, cadence-core/bin/planning-plans.test.mjs
- **Action:** Start at `cmdPlanSize`. Each entry of the `plans` array `cmdPlanSize` builds gains the two
  facts D-10 names: how many bytes that plan's `files:` frontmatter declares, and
  how many of those declared paths contributed none. Read the list with
  `readFrontmatterList(text, 'files')` from `../lib/planning-files.mjs` off the
  SAME plan text `planTaskTitles` is already handed, so a plan is still read
  once. What counts as a declared path is `readOnePlan`'s filter in
  `lib/phase-plans.mjs` - a non-empty string - and never `parsePlanFiles`'s union
  with the `- **Files:**` task lines, which would measure a file no frontmatter
  declared. Declared paths are repo-relative and the repo root is the planning
  root's PARENT, the derivation `route.mjs`'s `replay` states for its own
  `repoRoot`. Size each path with `lstatSync` and count its bytes only when
  `isFile()` is true: a path the plan has yet to create, a directory, a symlink
  or any other non-regular entry contributes zero bytes and increments the absent
  count, because each of them makes the total measure something smaller than what
  was declared, which is D-10's whole reason for reporting the count beside it
  (12 of 43 archived plans declare at least one path that is not there). A path
  that is absolute or carries a `..` segment is not stat'd at all and increments
  the same count - a resolve is not a place to walk out of the repository. When
  `readFrontmatterList` reports a non-empty `issues` array for a plan, report
  both figures as null rather than 0, on `readOnePlan`'s no-salvage rule: a
  half-parsed `files:` list is an unresolvable input and not a shorter one, and a
  0 there would say the plan declares nothing - the "absence of evidence reported
  as absence of surface" shape the v3.5.7 phase 3 UAT refuted. Nothing is
  compared and no `over[]` entry is added by this task.
- **Verify:** `node --test cadence-core/bin/planning-plans.test.mjs` passes with
  new cases proving (a) a plan whose two declared files both exist reports a byte
  figure equal to their summed on-disk sizes and an absent count of 0, (b) a plan
  declaring a path that does not exist reports a non-zero absent count and counts
  zero bytes for that path, and (c) a plan whose `files:` frontmatter is out of
  grammar reports null rather than 0. `node cadence-core/bin/planning.mjs
  plan-size --phase 1` against this repository prints a `plans` array whose every
  entry carries an integer byte figure.

### Task 3: `--max-bytes` reports the crossing as an `over[]` entry

- **Files:** cadence-core/bin/planning/plan-size.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/planning-plans.test.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/planning-lease-check.test.mjs, cadence-core/bin/phase-spelling.test.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start at `cmdPlanSize` and at the `plan-size` row of `CONTRACTS`
  under the `planning.mjs` key. Add `--max-bytes` to that row carrying
  exactly the disposition `--max-tasks` carries there (`required: false`,
  `type: 'int'`, `value: 'refuse'`, `bare: 'refuse'`), so the adoption census
  exercises both refusal arms without being told to. In `cmdPlanSize`, resolve
  the flag through `requireInt` at the boundary to a plain number the way
  `--max-tasks` and `--max-reqs` are resolved, refusing with `bad-args` and a
  hint that says this seam reads no config so the value is the one the caller
  already resolved (D-08). Push one entry per over-ceiling plan onto `over`, kind
  `plan-too-many-bytes`, carrying the same five fields `plan-too-many-tasks`
  uses - the plan file, the measured bytes, the ceiling, and a `detail` sentence
  naming the phase, the plan and both numbers. Compare only when the flag was
  passed AND that plan has a measurable byte figure: a plan whose frontmatter is
  out of grammar is not compared, on the rule the `requirements_found: false` arm
  already follows - something nobody could read is not a small one. Name the
  ceiling in `compared` when the comparison ran, so `within` keeps meaning "every
  comparison that ran came back clean", and echo the resolved ceiling in the
  envelope beside the other two. Four hand-maintained counts are at risk from
  this change and `lease-check --plan-time` named each of them: the flag-entry
  count in `arg-contract.test.mjs` MOVES (a new flag row), and the 14
  error-detail sites in `planning-lease-check.test.mjs` MOVE if this task's
  refusal adds one; re-pin whichever moved in this same commit, which is what
  declaring them undertakes. The phase-argument callsite count in
  `phase-spelling.test.mjs` and the refusing-trace-flag sentence count in
  `trace.test.mjs` should NOT move - this task adds no phase argument and no
  trace flag - so re-run them and leave their numbers alone.
- **Verify:** `node --test cadence-core/bin/planning-plans.test.mjs` passes with
  new cases proving a plan whose declared bytes exceed `--max-bytes` yields
  exactly one `plan-too-many-bytes` entry naming the plan file, its measured
  bytes and the ceiling; that the same call with a ceiling above the measurement
  yields no byte entry and `within: true`; and that a bare `--max-bytes` and a
  non-integer `--max-bytes` are each refused as `bad-args` naming the flag.
  `node --test cadence-core/bin/arg-contract-adoption.test.mjs` passes with the
  new flag counted rather than skipped, and `node --test
  cadence-core/bin/arg-contract.test.mjs cadence-core/bin/planning-lease-check.test.mjs
  cadence-core/bin/phase-spelling.test.mjs cadence-core/bin/trace.test.mjs`
  passes on the four censuses this change leases.

### Task 4: `/cad-plan` hands `check_size` the ceiling

- **Files:** cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/seam-calls.test.mjs
- **Action:** The two edit sites are the batched `config.mjs get` at the `parse`
  step and the `check_size` step. Add `workflow.max_plan_bytes` to the key
  list at the `parse` step, and add `--max-bytes {workflow.max_plan_bytes}` to
  the `check_size` step's existing `plan-size` command, substituted exactly the
  way `{workflow.max_plan_tasks}` already is on that line (D-08: a second reader
  in the seam would be a second place for the resolved ceiling to disagree with
  the one the planner was handed). The `parse`-step `plan-size` call does NOT get
  the flag - there is no written plan to measure at that point. Extend the
  `check_size` prose so `plan-too-many-bytes` gets the same treatment
  `plan-too-many-tasks` has: name the PLAN file and both numbers out loud, and
  the remedy is the same split into more plans; and leave the step's existing
  "Not a hard halt" paragraph governing both kinds, because the user may have
  chosen option 3 at `too_big` and a check that refused what they just
  authorized would be arguing with them (D-09). Add NO new command block and no
  new step: `seam-calls.test.mjs` pins this file at 14 literal command blocks
  with an enumerating note, so a new flag on an existing call is free and a
  fifteenth call turns it red (D-07). Re-pin
  `cadence-core/workflows/plan.md` in `cadence-core/bin/weight-budgets.json` to
  its new size - it sits at exactly its pinned 28,764 B today, so any prose added
  here goes over the ceiling (D-12). `seam-calls.test.mjs` holds the count this
  step is leased against; it should stay at 14, so re-run it and leave its number
  and its enumerating note alone unless a call genuinely became literal.
- **Verify:** `node --test cadence-core/bin/seam-calls.test.mjs` still reports 14
  calls for `cadence-core/workflows/plan.md`; `node cadence-core/bin/self-verify.mjs`
  reports no problems, including no unknown-flag finding for `--max-bytes` and no
  weight-budget overage; the `check_size` command block reads `plan-size --phase
  {N} --max-tasks {workflow.max_plan_tasks} --max-bytes {workflow.max_plan_bytes}`;
  and `node cadence-core/bin/test.mjs` is green.

## Notes

- The archived corpus this plan's numbers come from was measured 2026-08-26 over
  43 `PLAN*.md` files in 28 phase directories under `.planning/_archive-*`: p75
  657,770 by nearest-rank and 667,580 by the interpolation CONTEXT used, both
  rounding up to the 675,000 D-06 fixes; 10 of 43 plans are over it; 12 of 43
  declare at least one path that is not on disk. The largest is
  `_archive-v2.5.0/1/PLAN.md` at 1,282,083 B across 43 declared paths.
- `plan-size` addresses a phase as `phases/<raw>/`, so it cannot be pointed at an
  archived phase directly. A UAT witness for the over-ceiling arm comes from
  either a scratch planning root via `--dir` or a low `--max-bytes` against this
  phase's own plans.
