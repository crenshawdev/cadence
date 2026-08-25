---
phase: 3
plan: 2
requirements: [CAP-01, CAP-03]
files:
  - cadence-core/bin/lib/capture-health.mjs
  - cadence-core/bin/capture-health.test.mjs
  - cadence-core/bin/planning/capture-check.mjs
  - cadence-core/bin/planning-capture-check.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/config.schema.json
  - cadence-core/references/config-reach.md
  - cadence-core/references/config-catalog.md
  - cadence-core/references/capture-grammar.md
  - cadence-core/bin/planning/phase-done.mjs
  - cadence-core/bin/planning-phase-done.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/workflows/verify.md
  - skills/cad-health/SKILL.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: CAPTURE is transient - Plan 2 (the file is bounded and asserted)

## Goal

`.planning/CAPTURE.md` holds only the phase in flight, and the tree can say so
in code: the walked queue has a bound that fails loud, an item is resolved by
removal rather than by annotation, `## Archive` is no longer part of the file's
contract, and phase close ASSERTS the queue is empty instead of emptying it.

## Must be true when done

- `planning.mjs capture-check` reports how many SUBSTANTIVE bullets the recall
  walk holds, counting a section whose only line is `- None.` as zero.
- A walked bullet carrying a `KEPT <date>` or `recorded not fixed` annotation is
  reported as a problem naming that bullet, so an item adjudicated by annotation
  rather than by removal cannot pass unnoticed.
- A CAPTURE.md carrying a `## Archive` heading is reported as a problem, and the
  capture grammar no longer admits that heading as part of the file.
- A walked count over the configured bound is REPORTED and nothing is refused.
- `planning.mjs phase-done` names every substantive walked bullet still in the
  queue at close, and still closes the phase.
- `/cad-health` prints those verdicts on every run rather than a printed note.

## Context

No CONTEXT.md exists for this phase; the ROADMAP's 14 success criteria are the
locked decisions.

- Criterion 5 is the shape constraint on all of this: the bound, the annotation
  check and the `## Archive` report are CODE reachable by fixture, not prose
  steps, because `/cad-health` is a skill a model executes and a prose step
  cannot be proved by a fixture over the bound failing and one under it passing.
- Measured 2026-08-25 on this repository after the OQ-2 hand sweep:
  `capture-sections` reports Todos 21, Seeds 9, Notes 0 in the walk and Debt
  markers 1 outside it, 108 lines and 12,232 bytes, no `## Archive` heading, and
  `grep -c` for the two annotation shapes returns 0. A check written against the
  live file therefore passes vacuously - every check here is proved by fixture.
- Run AFTER PLAN-1: the two plans share declared files and PLAN-2's close
  assertion is the check on the filing mechanism PLAN-1 builds.

## Tasks

### Task 1: What the walked queue actually holds, as a pure reading

- **Files:** cadence-core/bin/lib/capture-health.mjs,
  cadence-core/bin/capture-health.test.mjs
- **Action:** Create `lib/capture-health.mjs` as the pure reading of a CAPTURE.md
  body: text in, findings out, no filesystem and no config, in the discipline
  `lib/capture-file.mjs` and `lib/planning-files.mjs` already keep. Take the
  three walked heading names from `CAPTURE_WALK_SECTIONS` in
  `lib/planning-files.mjs` and locate each section with the exported
  `sectionSpan`, which is bounded at both ends and fence-aware - never a bare
  heading scan, which was the destructive half of a fixed bug. It answers three
  things. First, the SUBSTANTIVE bullet count: bullets on the capture grammar's
  own definition - a column-0 `- `, an optional checkbox in any state - minus the
  `- None.` placeholder, which is what `EMPTY_CAPTURE` in `lib/capture-file.mjs`
  writes under all three walked headings, so a freshly created queue must count
  zero. `captureSections` in `lib/planning-files.mjs` counts that placeholder as
  a bullet and keeps doing so - it is a section REPORT and its number is read
  elsewhere; this is a second, differently-defined count and it lives here rather
  than by changing that one. Second, the annotation sites: a walked bullet
  carrying a re-verification annotation - the `KEPT <date>` and `recorded not
  fixed` shapes - returned with the section, the line number and the bullet's
  text, because an item is RESOLVED BY REMOVAL and annotating one made it longer
  rather than removing it, twelve times in this repository. Third, whether the
  body carries a `## Archive` heading at all, and how many bullets sit under it.
  Return findings as data; decide no verdict and read no bound here - the bound
  is configured and belongs to the caller.
- **Verify:** `node --test cadence-core/bin/capture-health.test.mjs` passes over
  fixture bodies, with cases proving: the exact `EMPTY_CAPTURE` string counts
  zero substantive bullets; a section holding `- None.` plus one real bullet
  counts one; a `- [x]` bullet counts; an indented continuation line and a `* `
  line do not; a bullet reading `KEPT 2026-08-08, re-verified against ...` and
  one reading `recorded not fixed` are each returned with their section and line
  while an unannotated bullet is not; a body with `## Archive` reports it with
  its bullet count and a body without reports it absent.

### Task 2: One command the health walk and the close both read

- **Files:** cadence-core/bin/planning/capture-check.mjs,
  cadence-core/bin/planning-capture-check.test.mjs,
  cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs,
  cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/trace.test.mjs,
  cadence-core/bin/planning-lease-check.test.mjs
- **Action:** Add `capture-check` as a planning subcommand in its own module
  under `bin/planning/`, standalone beside `capture-sections` for the reason
  `cmdCaptureSections` states about itself: `cmdStatus` returns early on trees
  with no planning dir or no roadmap, so folding a capture verdict into `status`
  would hand no report at all to exactly the trees most likely to hold a mangled
  CAPTURE.md. It reads the file - `<dir>/CAPTURE.md` by default, with the same
  present-but-unusable `--file` refusal `capture-sections` and `capture` already
  carry, so a flag with nothing after it is never silently answered about a
  different file - runs task 1's reading, and emits the substantive walked count,
  the annotation sites and the `## Archive` presence on one JSON line. ENOENT is
  DATA, as everywhere in this seam: a project with no queue has an empty queue,
  not a failure. An unreadable but PRESENT file is a refusal with a hint, never a
  clean verdict about a file that could not be opened. The verdicts themselves
  are REPORTS on an `ok:true` envelope, not refusals: nothing here refuses
  anything, and the only `ok:false` arms are bad arguments and an unreadable
  file. Wire it into the dispatch table in `planning.mjs` as a one-word command
  (`subcommandKey` widens to a second word only for the `TWO_WORD` families, and
  one operation does not earn that), declare the subcommand and its flags in the
  `CONTRACTS` table in `lib/arg-contract.mjs`, and re-pin the flag-entry and
  top-level counts in `arg-contract.test.mjs`. A new error-detail site in the
  planning seam moves the `planning-detail-sites` census pinned in
  `planning-lease-check.test.mjs` - re-pin it in the same commit, and re-pin
  `trace.test.mjs`'s census if the sentence count it holds moves.
- **Verify:** `node --test cadence-core/bin/planning-capture-check.test.mjs`
  passes: against a fixture tree whose CAPTURE.md is exactly `EMPTY_CAPTURE` the
  command reports zero substantive bullets, no annotations and no archive; with
  three real bullets, two annotated and a `## Archive` section added, it reports
  three, the two annotation sites with their line numbers, and the archive
  heading; an absent CAPTURE.md returns `ok:true` with the queue empty; a
  CAPTURE.md made unreadable returns `ok:false` with a reason and a hint.
  `node --test cadence-core/bin/arg-contract.test.mjs
  cadence-core/bin/trace.test.mjs cadence-core/bin/planning-lease-check.test.mjs`
  passes and `node cadence-core/bin/self-verify.mjs` reports zero problems.

### Task 3: A configured bound that fails loud and refuses nothing

- **Files:** cadence-core/config.schema.json,
  cadence-core/references/config-reach.md,
  cadence-core/references/config-catalog.md,
  cadence-core/bin/planning/capture-check.mjs,
  cadence-core/bin/planning-capture-check.test.mjs,
  cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/lib/census-registry.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** The 2026-08-08 sweep took this queue to zero and it regrew to 276
  walked items in sixteen days because nothing bounded it. Add the bound as
  `planning.max_capture_bullets` - the `planning.*` group is where
  `planning.commit_docs` already puts keys about `.planning/` documents - typed
  `int` with `min: 1`, and give `capture-check` the arm that compares the
  substantive walked count against it and reports the crossing with both numbers.
  Its FAIL consequence is stated against the one int-bound precedent in this
  schema, `workflow.max_dispatch_tokens.*`, and it is the same: **a crossing is
  REPORTED and nothing is refused.** The reach is narrower than universal - one
  command reads it - so the reach row and the key's own `purpose` must carry the
  same narrow phrase VERBATIM or self-verify's `unstated-reach` arm fires; add
  the row under `## Reach rows` in `references/config-reach.md` and put that
  phrase in the `purpose` in the same commit. Add the catalog row in
  `references/config-catalog.md` under the section its key group belongs to, in
  that table's `Key [src] | Type | Purpose (question) | Value → Explanation |
  Default` shape - the key owes both or self-verify reddens. Set the default to
  40, and state the basis in the `purpose`: this repository holds 30 substantive
  walked bullets measured 2026-08-25 after the OQ-2 hand sweep, so the bound sits
  above the live tree and fires on GROWTH rather than on arrival - a bound that
  reddens the moment it ships teaches the user to ignore it. The key and its
  first reader must land in ONE commit: a schema key nothing reads is
  `inert-config-key` and a key a surface names but the schema does not is
  `unknown-config-key`, so splitting them reddens the suite in one direction or
  the other. Reading the merged config here is a new `mergeLayers` callsite:
  destructure `warnings` at the callsite and put it on the envelope (the census
  admits only the two warning-surfacing arms), re-pin the merge-layers census in
  `self-verify.test.mjs`, and add this module to that row's `subjects` in
  `lib/census-registry.mjs`. Re-pin every prose surface this task grows in
  `weight-budgets.json` in the same commit.
- **Verify:** `node --test cadence-core/bin/planning-capture-check.test.mjs`
  passes with the fixture PAIR criterion 8 asks for: a tree whose config sets the
  bound to 2 with three substantive bullets reports the crossing naming 3 and 2
  and still returns `ok:true` with nothing refused, and the same tree with the
  bound at 4 reports no crossing. `node cadence-core/bin/self-verify.mjs` reports
  zero problems across all checks - which is what proves the reach row, the
  catalog row, the purpose phrase and the budgets - and `node --test
  cadence-core/bin/self-verify.test.mjs cadence-core/bin/config.test.mjs` passes.

### Task 4: The close asserts the queue is empty

- **Files:** cadence-core/bin/planning/phase-done.mjs,
  cadence-core/bin/planning-phase-done.test.mjs,
  cadence-core/bin/planning.test.mjs, cadence-core/workflows/verify.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Phase close ASSERTS empty rather than performing a roll-out: the
  ask at the gate is the mechanism, and close is only the check. Have
  `cmdPhaseDone` run task 1's reading over `<dir>/CAPTURE.md` and carry the
  result on its success envelope as a NEW field, on D-04's own precedent for
  `wrote` - nothing existing changes meaning, `roadmap`, `reqs` and `wrote` keep
  the shape and contents nine deep-equal cases already assert. A non-empty walked
  queue at close is a REPORTED PROBLEM naming each item, not a refusal: the close
  still happens, both documents are still written, and the report rides beside
  them. Read the queue BEFORE the transition runs and never let its absence or
  unreadability change the close's outcome - a queue that cannot be read is
  reported as unread, and the phase still closes, because a phase's completion
  does not depend on this file being legible. The field rides the close arm only
  and is omitted under `--undo`, on the omit-optionals convention: reopening a
  phase makes no assertion about the queue. Then state the step in
  `workflows/verify.md` where `phase-done` is already called: print each named
  item and what it means - these are items the phase in flight did not resolve,
  and resolving one means removing it or filing it, never annotating it.
- **Verify:** `node --test cadence-core/bin/planning-phase-done.test.mjs` passes,
  with cases proving: closing a phase in a tree whose CAPTURE.md holds two
  substantive bullets returns `ok:true`, flips the roadmap box, and names both
  items; the same tree with `EMPTY_CAPTURE` names none; an absent CAPTURE.md
  closes cleanly; `--undo` carries no such field. `node --test
  cadence-core/bin/planning.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports zero problems.

### Task 5: /cad-health prints the verdict

- **Files:** skills/cad-health/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** The existing capture step in this skill prints the out-of-walk
  sections `capture-sections` reports and is a printed note by construction -
  step 1's own text says a project that archives inside CAPTURE.md is MEANT to
  have out-of-walk bullets, which is exactly the reading this phase retires. Add
  the `capture-check` call beside it and print what it returns: the substantive
  walked count against the bound with the crossing named when there is one, every
  annotation site with its section and line, and the `## Archive` heading with
  its bullet count when the file carries one. These are ISSUES, not the lower
  note the out-of-walk line is: an annotation is an item adjudicated the wrong
  way, an `## Archive` heading is a section that has left this file's contract,
  and a crossed bound means a filing path stopped filing. Correct the sentence
  that calls archiving inside CAPTURE.md intended, keeping the incident it cites
  - five lost bullets under `## Archive` - because the incident is what the
  out-of-walk print exists for and it is still true. Print the numbers EVERY run,
  never filtered against an expectation list, for the reason this step already
  gives: an allowlist would have hidden the incident it exists for. Re-pin this
  surface's exact byte size in `weight-budgets.json` in the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports zero problems -
  covering the budget entry and validating the `capture-check` invocation and its
  flags against the `CONTRACTS` row task 2 declared, so a mis-spelled subcommand
  fails as `unknown-subcommand`. `node --test cadence-core/bin/weight.test.mjs
  cadence-core/bin/surface-scan.test.mjs` passes, and running `/cad-health`
  against this repository prints the substantive count, the bound, and no
  annotation or archive line (this tree carries neither today).

### Task 6: `## Archive` leaves the capture contract

- **Files:** cadence-core/references/capture-grammar.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Durable records belong on the tracker, and moving settled items to
  a heading inside the same file changes nothing about the bytes - this
  repository had 185 such bullets proving it. Strike `## Archive` from this
  reference's contract at all three sites it appears: the sections table row at
  line 25, the D-03 paragraph that pairs it with `## Debt markers` as
  deliberately-outside-the-walk, and the `Not in this grammar` bullet calling
  retirement into `## Archive` a milestone-close judgment. What replaces them is
  a statement, not a silence: `## Archive` is NOT part of this file, a CAPTURE.md
  carrying one is REPORTED by `capture-check` rather than walked or ignored, and
  an item is resolved by REMOVAL - filed on the tracker or dropped - never by
  annotation or by relocation within the file. The RULE itself has one home and
  it is `references/triage-gate.md`, where PLAN-1 task 5 states it; what this
  file adds is the grammar half - which shapes count as an annotation
  (`KEPT <date>` and `recorded not fixed`) and that `planning.mjs capture-check`
  reports them - pointing at the triage reference for the rule rather than
  restating it, because a rule written down twice is the drift this grammar
  exists to prevent. `## Debt markers` keeps its row and its
  reason unchanged - it is written wholesale by `debt-harvest` and is not a
  queue. Nothing about `EMPTY_CAPTURE` needs editing: it derives its headings
  from `CAPTURE_WALK_SECTIONS` and has never written an Archive heading, and
  there is no `templates/CAPTURE.md`. `.planning/ARCHIVE.md` is a different thing
  and is UNTOUCHED - a live recall surface written by `milestone-prune` and read
  by `recall` - so nothing in this task may read as being about that file.
  Re-pin this surface's byte size in `weight-budgets.json` in the same commit.
- **Verify:** `grep -n "## Archive" cadence-core/references/capture-grammar.md`
  returns only lines that say the heading is NOT part of this file and is
  reported when present - no row admitting it in the sections table, no
  milestone-close instruction to move bullets into it. `node
  cadence-core/bin/self-verify.mjs` reports zero problems, and `node
  cadence-core/bin/test.mjs` runs the whole suite green.

## Notes

- **Why this is PLAN-2 and not a second half of PLAN-1.** The phase's fourteen
  criteria exceed one plan's eight-task ceiling. These two plans share declared
  files (`lib/arg-contract.mjs`, `arg-contract.test.mjs`, `self-verify.test.mjs`,
  `lib/census-registry.mjs`, `weight-budgets.json`, `trace.test.mjs`,
  `planning-lease-check.test.mjs`), so they are not independent slices and
  `plan-overlap` routes them sequential - which is the intended shape, since this
  plan's close assertion checks the mechanism PLAN-1 builds.
- **`cadence-core/bin/planning.test.mjs` is declared as insurance only.** It runs
  `phase-done` and is 418 KB. Do not read it wholesale - grep for the assertion
  that reddens and edit that window. It is in the lease so a surprise there is an
  amendment rather than a halted task.
- **`/cad-execute`'s open-items append and `/cad-capture` still write to
  CAPTURE.md, and neither changes here.** They write about the phase in flight,
  which is exactly what the file is now for; what makes the file transient is
  that the close reports whatever they left. Nothing in this plan retires a
  writer.
- **The live tree cannot prove any of these checks.** After the 2026-08-24 hand
  sweep there are no annotations and no `## Archive` here, so every check is
  proved by fixture and the live tree is only ever a smoke reading. A check
  written against the live file passes vacuously forever.
- The task ceiling in the dispatch (8 per plan) replaces the template's
  "typical 3-10 tasks" line.
