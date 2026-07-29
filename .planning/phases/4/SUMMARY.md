---
phase: 4
status: complete
completed: 2026-07-29
---

# Phase 4: The computed floor - Summary

A declared-path match over a phase's own PLAN `files:` frontmatter now sets a
stakes FLOOR in `route.mjs resolve`, waivable only per surface through a
persisted `risk.override.<surface>` that the config write face refuses to
misspell.

## What shipped

- Eight risk surfaces (`api_contract`, `auth`, `billing`, `concurrency`,
  `destructive`, `migrations`, `secrets`, `untrusted_input`) plus `stakes_order`
  and `gates` - `cadence-core/route-table.json`
- The pure matcher (path tokenizer, surface match, floor selection) -
  `cadence-core/bin/lib/risk-surfaces.mjs`
- PLAN `files:` frontmatter reader and the STATE cursor reader, both fail-open -
  `cadence-core/bin/lib/phase-plans.mjs`
- `riskFloor()` behind `--phase <N>` with cursor fallback, per-surface waiver
  handling, and reason strings naming surface + path + pattern -
  `cadence-core/bin/route.mjs`
- Write-face refusal of an unknown surface name and of a global-layer waiver,
  plus eight schema keys - `cadence-core/bin/config.mjs`,
  `cadence-core/config.schema.json`
- Surface-vocabulary drift walk in both directions - `cadence-core/bin/self-verify.mjs`
- Gate-enum fallback (`DEFAULT_GATES`) closing the hole the floor's own axis
  rides on - `cadence-core/bin/lib/route-cells.mjs`
- Contract prose - `cadence-core/references/seams.md`,
  `cadence-core/references/review-triggers.md`, `INTERNALS.md`, `CHANGELOG.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 489b081 | declare the eight risk surfaces and the pure match lib |
| 1 | 2 | 9d6ec0b | read the phase's declared PLAN files off disk, failing open |
| 1 | 3 | a52f45a | resolve the risk floor behind --phase and the STATE cursor |
| 1 | 4 | 878956e | declare and refuse the per-surface override at the write face |
| 1 | 5 | 913f031 | waive the risk floor per surface at resolve time |
| 1 | 6 | 43a9cae | walk the risk-surface vocabulary in self-verify, both directions |
| 1 | 7 | 88bcf51 | refuse a review gate outside the table's accepted vocabulary |
| 1 | 8 | 5a4c3e3 | state the computed floor in the seams, the triggers and the docs |

## Deviations

- [deviation] Task 1 (489b081): three new top-level blocks in `route-table.json`
  broke `route.test.mjs`'s top-level key-set assertion, which pins the whole key
  set so a new block cannot appear without a reader. Updated the assertion in
  task 1 rather than leaving the suite red for five tasks; `route.test.mjs` is in
  the plan's own `files:` list.
- [deviation] Task 4 (878956e): the eight new schema keys made
  `self-verify.test.mjs`'s "placeholder keys expand" fixture (which must name
  every family) report eight `inert-config-key` problems. Added
  `` `risk.override.<surface>` `` to that fixture in the task that caused it;
  task 6 added the dedicated reverse-direction row separately.
- [deviation] Task 5 (913f031): `tsc` flagged `riskFloor`'s JSDoc
  `@param {{stakes: string}} cfg` once the function read `cfg.riskOverrides`;
  widened the annotation.
- [deviation] Task 6 (43a9cae): `surfaceIssues` returns `[]` for a table with no
  `surfaces` block, which also skips `stakes-order-drift` and
  `gate-vocabulary-drift`. The plan required the no-surfaces tolerance;
  documented in the lib comment, and the shipped table's key set stays pinned by
  `route.test.mjs`.

## Open items

Findings 1-8 are the adjudicated survivors of the `diff` review trigger
(advisory gate; four reviewers - cad-reviewer, openai/gpt-5.6-terra,
gemini/gemini-3.6-flash, deepseek/deepseek-v4-flash). Each was reproduced by
execution unless noted.

1. **HIGH - a global-layer `risk.override.<surface>` waives the floor in every
   repository on the machine.** `readConfig` takes `riskOverrides` from the
   MERGED config (`route.mjs:107`), so the repo-scope rule exists only at the
   write face. Verified: global config `{"risk":{"override":{"auth":true}}}`,
   repo `stakes: solo`, PLAN declaring `src/auth/session.rs` -> `stakes:"solo"`,
   reason `risk floor: waived by risk.override.auth ... stakes stays solo`.
   Converged by 3 of 4 reviewers.
2. **MEDIUM - the write-face repo-scope refusal is defeated by any path alias.**
   `repoScopedErrors` (`config.mjs:204`) tests `file === GLOBAL_CONFIG` by string
   equality. Verified: `set --global` and `set --file <global>` are both refused,
   but `set --file <global-dir>/./config.json risk.override.auth=true` returns
   `{"ok":true,...,"changed":[{"key":"risk.override.auth","value":true}]}` and
   the waiver lands in the global file. Converged by 3 of 4 reviewers.
3. **MEDIUM/HIGH - the `concurrency` surface's `lock` pattern taxes every
   dependency-bump phase.** Verified: `files: [package-lock.json]` at
   `stakes: solo` -> `stakes:"critical"`, reason
   `surface "concurrency" matched package-lock.json (pattern "lock")`. The only
   escape (`risk.override.concurrency`) disables genuine locking detection
   repo-wide, which is the reflex-waiver failure mode `phase-plans.mjs:56-60`
   argues against. Neighbouring patterns behave the same way (`src/ui/drop-zone.tsx`
   -> `destructive`).
4. **MEDIUM - `cad-plan-checker` floors off the PREVIOUS phase.**
   `PRE_PLAN_ROLES` (`route.mjs:86`) exempts `cad-planner` and
   `cad-assumptions-analyzer` only; `workflows/plan.md` dispatches the checker at
   `:181` and sets the cursor at `:256`, and no shipped call site passes
   `--phase` (`grep -rn -- "--phase" cadence-core/workflows/ references/ skills/
   agents/` matches only `progress.md:54`, a `planning.mjs cursor set`). So
   during `/cad-plan N+1` the checker resolves off phase N's file list - in
   either direction.
5. **MEDIUM - an unusable `stakes_order` produces a flatly false reason.** No
   `DEFAULT_GATES`-style fallback was extended to the ordering
   (`route.mjs:214`). Verified with `stakes_order` deleted from an injected
   table: `stakes:"solo"` with reason
   `surface "auth" detected (floor critical); baseline solo already at or above
   it`. Solo is below critical.
6. **MEDIUM - the path tokenizer misses uppercase acronym runs.** The split
   regex handles lower/digit -> upper only (`risk-surfaces.mjs:43`). Verified:
   `src/APIClient.ts` and `src/GraphQL.ts` both resolve at the `solo` baseline
   while the control `src/api/client.ts` floors to `critical`.
7. **LOW - a trailing valueless `--phase` falls through to the cursor.**
   `parseArgs` stores `a[++i]` unconditionally, so `opts.phase` is `undefined`
   and the `!== undefined` test at `route.mjs:159` passes it to the cursor branch
   with no warning - violating the invariant stated in the comment directly
   above it.
8. **LOW - no symlink containment in `phase-plans.mjs`.** `readdirSync` /
   `readFileSync` follow a symlinked `phases/<N>/` or `PLAN.md` out of the
   planning root. Raised by two reviewers; read from the code, not reproduced.
   Requires write access to `.planning/` and only moves routing.

Killed during adjudication, recorded so they are not re-raised:
`resolve --role cad-executor` with no `--file` does NOT throw (returns
`ok:true`; gemini's blocker is false). The gate-enum claim reproduces only
against an injected table whose own `gates` array carries the typo, which is
the table declaring its vocabulary - against the shipped table task 7's fix
holds (`gate:"blockign"` -> `blocking` stands, with a warning naming the
accepted set). The "frontmatter slip under another key discards a good `files:`
list" finding is the plan's own stated fail-open (one warning naming the file
and line), not a defect.

Carried from the executor:
- Task 7's failing-capable proof used `git stash` to remove the uncommitted fix
  and re-run the repro. Clean on the normal working tree; the stash is shared
  state and would be forbidden under worktree mode.
- The four phase-3 open items CONTEXT lists (raw `cfg.stakes` index into
  `TABLE.cells`, `roles[]` unchecked by the cell walk, the unmapped-rung
  fail-open, rung frontmatter `effort` unverified against its rung) remain open
  and untouched, per scope.

## Goal check

The eight commits deliver the phase goal: the risk signal is computed from the
phase's own PLAN and now reaches the routing bundle instead of being discarded.
All four ROADMAP success criteria were verified by direct execution, not taken
from the executor's report. Criterion 1 - a `solo` baseline with a PLAN
declaring `src/auth/session.rs` resolves `stakes:"critical"`,
`agent:"cad-executor-xhigh"`, `effort:"xhigh"`, `verify:"on"` with the whole
raised bundle, and the reason names surface, path and pattern; the same resolve
with no `--phase` against a STATE cursor pointing at that phase is
byte-identical (`diff` of the two outputs is empty). Criterion 2 - waiving one
of two detected surfaces still floors (`risk.override.auth` set, PLAN declaring
both `src/auth/session.rs` and `db/migrations/001.sql` -> `critical`, reason
carrying both the waiver line and the surviving `migrations` match), and
`config.mjs set risk.override.athu=true` is refused with the eight accepted
surface names listed. Criterion 3 - `raiseTo` never lowers, and a floor at or
below the baseline emits the "already at or above it" line while changing no
knob. Criterion 4 - a phase with no PLAN file returns `ok:true` at the baseline
with no floor warning, and `cad-planner` resolves at the baseline against the
fixture that floors `cad-executor` (D-09). What is NOT delivered, and is the
honest gap: the floor is only as good as its vocabulary and its phase input.
Open item 3 shows the shipped `lock` pattern flooring any lockfile change to
critical, which is the raise-tax criterion 4 exists to prevent, and open item 4
shows `cad-plan-checker` computing its floor from the wrong phase because no
call site passes `--phase` and the cursor lags. Open item 1 is the one that most
undercuts "may raise but not silently lower": the per-surface waiver is honored
from the user-global layer, so a single global key silently lowers the floor in
every repository, and only the write face objects.
