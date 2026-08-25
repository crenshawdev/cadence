---
phase: 3
plan: 3
requirements: [CAP-01]
files:
  - cadence-core/workflows/execute.md
  - cadence-core/references/capture-grammar.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/capture-writers.mjs
  - cadence-core/bin/capture-writers.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - .planning/CAPTURE.md
---

# Phase 3: CAPTURE is transient - Plan 3 (nothing durable is routed into it)

## Goal

The workflow that closes a phase stops writing into the file the close reports
on. A phase's open items are recorded once, in `phases/<N>/SUMMARY.md`, and
`.planning/CAPTURE.md` holds only the phase in flight - which the tree can now
prove, because a prose surface that instructs a durable write into that file is
reported by name.

## Must be true when done

- Closing a phase adds nothing to `.planning/CAPTURE.md`. The phase's open items
  are written once, to `phases/<N>/SUMMARY.md`'s `## Open items`, and that is
  the record.
- A phase open item is still surfaced by `/cad-plan`'s recall after the change,
  from SUMMARY.md, without a second copy anywhere.
- Adding a `.planning/CAPTURE.md` write instruction back to any prose surface in
  the plugin makes `self-verify.mjs` report a problem naming that surface, so
  this defect cannot return silently.
- Every prose surface that is still allowed to write the file is one register
  row carrying the reason it cannot accumulate.
- `planning.mjs capture-check` on this repository reports 31 substantive
  bullets - the 30 that `phases/3/SUMMARY.md`'s own goal check recorded on
  2026-08-25, plus one Seed captured that same day after the plan was written
  (the `review-triggers.md` split) - and the seven bullets phase 3's close copied out of its own
  `## Open items` are gone from the queue while still present in that SUMMARY.
- The whole suite is green and `self-verify.mjs` reports zero problems.

## Context

- GAPS mode. This plan closes UAT item 20 only. Item 21 is already fixed
  (`c7e16ddf`) and item 22 is `skipped` with a `why_human` reason - live
  authenticated forge writes - and gets no task here.
- The phase's locked decisions are the ROADMAP's 14 success criteria; there is
  no CONTEXT.md. Criterion 3 binds this plan: **phase close ASSERTS empty
  rather than performing a roll-out.** `workflows/verify.md`'s phase-done step
  already says exactly that and needs no change; `workflows/execute.md`'s
  summary step is the half that contradicts it.
- PLAN-2's Notes stated that "`/cad-execute`'s open-items append ... still
  write[s] to CAPTURE.md, and neither changes here", on the reading that an open
  item is "the phase in flight". The verifier falsified that reading and this
  plan reverses it: an open item is by definition what did NOT finish inside the
  phase, so routing it into the queue at the close is the durable write the
  goal's third clause forbids.
- OQ-2 is untouched. This repository's 30 pre-existing walked bullets are a hand
  sweep outside the phase work (`ROADMAP.md`, Open Questions). The seven this
  plan removes are not part of that set - they were written after it, by the
  step this plan retires.

## Tasks

### Task 1: The phase close stops routing open items into the transient queue

- **Files:** cadence-core/workflows/execute.md,
  cadence-core/bin/weight-budgets.json, .planning/CAPTURE.md,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** At the `summary` step (start reading at the paragraph beginning
  "File each open item into `.planning/CAPTURE.md` through the seam"), retire
  the whole open-items filing instruction: the sentence, the scratch-file
  transport line, the `planning.mjs capture --kind todo` invocation, and the
  "SUMMARY is the phase's record; CAPTURE is the live phase-linked queue"
  justification with it. What replaces it is a statement of where an open item
  lives: `phases/<N>/SUMMARY.md`'s `## Open items`, written by this same step,
  and nowhere else. State the reason from the code rather than asserting it -
  `parseSummarySnippets` in `cadence-core/bin/lib/planning-files.mjs` indexes
  `## Deviations` and `## Open items` bullets into the recall corpus, so the
  item is already reachable by `/cad-plan` and the CAPTURE copy was a second,
  lower-scoring row for the same sentence. Measured on this repository
  2026-08-25: `planning.mjs recall "execute.md summary step routes open items
  into CAPTURE"` returns the SUMMARY row at 42.4677 and the CAPTURE duplicate at
  31.1468, the same item twice, and that duplication is live in this planning
  run's own recalled memory (`phases/3/SUMMARY.md` and `CAPTURE.md`, phase 3).
  Say what happens to an item that must outlive the phase, and say it as the
  close's job, not this step's: `planning.mjs phase-done`'s `capture` field
  names whatever is left in the queue and `workflows/verify.md` already prints
  it, so the disposition is the user's - filed on the tracker or dropped -
  because OQ-3 settled that nothing files automatically. Do NOT add a filing
  call, an ask, or a forge dependency at this step; the gate that declines a
  finding is the only automatic filer this phase built, and widening it to phase
  open items is scope this phase's criteria do not carry. **Keep the
  `debt-harvest --root .` call exactly as it stands** - it rewrites its own
  `## Debt markers` section wholesale, that section sits outside the recall walk
  by design (D-03, `references/capture-grammar.md`), and a wholesale rewrite
  cannot accumulate. Then correct the `state` step's staging sentence, which
  currently stages `.planning/CAPTURE.md` "if the summary step appended open
  items to it": that condition can no longer happen, and the file can still
  change at this step because `debt-harvest` ran, so restate the condition
  against the harvest - its envelope already reports whether it wrote
  (`written`). Finally, remove from `.planning/CAPTURE.md` the seven `(phase 3)`
  bullets under `## Todos` that phase 3's close copied there: every one of them
  is present verbatim in `.planning/phases/3/SUMMARY.md`'s `## Open items`, so
  the removal loses nothing and the SUMMARY row is the one recall already ranks
  first. Check that property per bullet before deleting it rather than deleting
  by line number. Note that `.planning/CAPTURE.md` is gitignored here
  (`.gitignore:26`, "local recall only"), so this task's commit carries the
  workflow and budget changes and the queue edit rides untracked - do not force
  it into the commit. Re-pin `cadence-core/workflows/execute.md`'s exact byte
  size in `weight-budgets.json` in the same commit.
  `prose-agreement.test.mjs` is declared as insurance only: it reads execute.md
  and asserts other steps, so a surprise there is an amendment rather than a
  halted task.
- **Verify:** `grep -n "capture --kind" cadence-core/workflows/execute.md`
  returns nothing, and `grep -n "debt-harvest" cadence-core/workflows/execute.md`
  still returns its invocation line. `node cadence-core/bin/planning.mjs
  capture-check` reports `substantive: 31` with Todos 21, Seeds 10, Notes 0 -
  down from the 38 measured before this task - and `grep -c "(phase 3)"
  .planning/CAPTURE.md` returns 0. For each of the seven removed bullets, a
  `grep -F` of a distinctive clause from it against
  `.planning/phases/3/SUMMARY.md` still returns a hit, which is what proves the
  removal lost nothing. `node cadence-core/bin/self-verify.mjs` reports zero problems
  (which is what proves the budget re-pin), and `node --test
  cadence-core/bin/prose-agreement.test.mjs cadence-core/bin/self-verify.test.mjs`
  passes.

### Task 2: The check that would have caught it

- **Files:** cadence-core/bin/lib/capture-writers.mjs,
  cadence-core/bin/capture-writers.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/lib/census-registry.mjs
- **Action:** A prose edit alone leaves this reachable by the next person who
  writes a workflow step, which is exactly how it survived two plans' leases.
  Create `lib/capture-writers.mjs` as a pure rule in the shape
  `lib/text-transport.mjs` already holds - no disk, no `emit`, no exit, no
  clock - carrying two exports: a frozen REGISTER of every prose site that
  ISSUES a `.planning/CAPTURE.md` write, and a function taking a surface path,
  its text and the rows (rows defaulted to the register, so a fixture can pass
  its own set - `textTransportIssues` is the signature precedent) and returning
  the `{kind, file, detail}` issues that surface carries. Key the scan on the
  INVOCATION form, not on prose: `lib/capture-file.mjs` is the one owner of this
  file's bytes and it has exactly two faces reachable from prose, the `capture`
  subcommand and the `debt-harvest` subcommand of `planning.mjs`. Match the
  script-plus-subcommand shape `self-verify.mjs`'s script-invocations check -
  check 2, the arm that files `unknown-subcommand` - already tokenizes, so
  `capture-check` and `capture-sections` do not match `capture`, and so a
  mention inside backticks that instructs nothing is not a call. File two kinds: a site no register row settles at all, and a site whose
  row classifies the write as outliving the phase in flight. Both kinds carry a
  detail naming the surface, the subcommand and what to do - register the site
  with its reason, or route the item to `phases/<N>/SUMMARY.md`. State the
  a SECOND shape as well: a shell redirect (`>` or `>>`) whose target is
  `.planning/CAPTURE.md`, filed as its own third kind. The plan review raised
  this as the gap that would let the defect return - a prose step reading
  `printf '%s\n' ... >> .planning/CAPTURE.md` is a durable CAPTURE write
  instruction that names no seam, so keying only on the invocation would leave
  this plan's own "Must be true" guarantee false as written. Its detail says the
  surface writes the file without going through `lib/capture-file.mjs`, the one
  owner of its format, and that the write belongs on the seam or nowhere. Then
  state the cost that REMAINS in the module header, narrowed to what it actually
  is: prose instructing a hand write in WORDS alone, with no redirect and no
  subcommand - "append the item to CAPTURE.md" as English - stays invisible, and
  widening to that is the unbounded-grammar problem phase 2 closed, not an
  oversight. Seed
  the register with the three live sites and their reasons, each of which cannot
  accumulate for a stated reason: `skills/cad-capture/SKILL.md`'s two sites (the
  user's own explicit capture, one bullet per deliberate act, and its
  `--cadence` sibling, which writes a different file entirely beside the global
  config layer) and `cadence-core/workflows/execute.md`'s `debt-harvest` call
  (a wholesale rewrite of one out-of-walk section). Wire it into
  `self-verify.mjs` as the next numbered check after 22, inside the per-surface
  loop beside the existing `textTransportIssues(rel, text)` call and applying
  to EVERY surface that walk yields for the reason check 11 states about its own
  scope, then append its name to the `checked` string the CLI emits, the way
  `refusal-hints` carries both. Register the register: add a `CENSUSES` row in
  `lib/census-registry.mjs` pinning the register's row count with a
  `CADENCE-CENSUS` marker in the test file, subjects the new module alone - the
  `text-transport-register` row is the exact shape, and a single-module subject
  keeps it clear of the breadth rail in `planning-lease-check.test.mjs` that
  cost plan 1 its census row.
- **Verify:** `node --test cadence-core/bin/capture-writers.test.mjs` passes,
  including the REPLAY that would have caught this: the retired summary-step
  block from `cadence-core/workflows/execute.md` as it shipped at `0169ef62`,
  carried verbatim as a fixture string, is reported against an empty row set,
  and reported again against a row set that classifies it as outliving the
  phase - while `debt-harvest --root .` against its own row is silent, a
  `capture-check` invocation is silent, and a backticked mention of `capture` is
  silent. The redirect arm carries its own fixtures: `>> .planning/CAPTURE.md`
  and `> .planning/CAPTURE.md` are each reported under the third kind, while a
  redirect to any other path and a backticked mention of the bare filename are
  both silent. `node cadence-core/bin/self-verify.mjs` reports zero problems on the
  live tree, and `node --test cadence-core/bin/self-verify.test.mjs
  cadence-core/bin/census-registry.test.mjs
  cadence-core/bin/planning-lease-check.test.mjs` passes with the CLI's
  `checked` string naming the new check.

### Task 3: The capture contract names who may write the file

- **Files:** cadence-core/references/capture-grammar.md,
  cadence-core/bin/weight-budgets.json
- **Action:** The sections table at `## The sections, and which three are
  walked` still credits `/cad-execute`'s open items as a writer of `## Todos`,
  which is now false in the tree. Correct that cell, and add the missing half of
  this grammar: WHO may write this file. State that the writer set has one home
  and it is the register in `cadence-core/bin/lib/capture-writers.mjs`, that
  `self-verify.mjs` reports any prose surface issuing a write face no row
  settles, and that the test for a row is whether the write can accumulate - a
  user's deliberate one-bullet capture and a wholesale section rewrite cannot,
  a per-item append at a phase boundary can. State where a phase's open items
  live instead - `phases/<N>/SUMMARY.md`'s `## Open items`, which
  `parseSummarySnippets` already indexes into the recall corpus - so a reader
  arriving here from the retired instruction lands on the answer rather than on
  a silence. Follow this reference's own discipline about single homes: the RULE
  that an item is resolved by REMOVAL stays owned by
  `references/triage-gate.md` and is pointed at, never restated, exactly as the
  annotation paragraph already does. Do not touch the `## Debt markers` row, the
  D-03 paragraph, the `## Archive` paragraph or anything below `## The bullet` -
  they are this phase's shipped work and are correct. Re-pin this surface's
  exact byte size in `weight-budgets.json` in the same commit.
- **Verify:** `grep -n "cad-execute" cadence-core/references/capture-grammar.md`
  returns nothing - it has exactly one occurrence today, the `## Todos` writer
  cell - and `grep -n "capture-writers"
  cadence-core/references/capture-grammar.md` returns the line naming the
  register as the writer set's one home. `node
  cadence-core/bin/self-verify.mjs` reports zero problems (the budget re-pin),
  `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/test.mjs`
  runs the whole suite green.

## Notes

- **Task order is forced, not stylistic.** Task 2's `Verify` requires
  `self-verify.mjs` to report zero problems on the LIVE tree, and it cannot
  until task 1 has removed the site the new check reports. Landing the check
  first would redden the suite between two commits.
- **What "where do the open items go" was decided from.** Three facts in the
  code, not a preference. `parseSummarySnippets`
  (`cadence-core/bin/lib/planning-files.mjs`) already indexes `## Open items`
  into the recall corpus, so the CAPTURE write was a duplicate rather than a
  route - measured live at 42.4677 (SUMMARY) against 31.1468 (CAPTURE) for the
  same sentence. `workflows/verify.md`'s phase-done step already prints the
  remaining queue and states the two dispositions, so the close is already the
  ask. And OQ-3 settled that nothing files automatically, which rules out
  routing open items onward through `issue-filing.mjs` at the summary step: that
  would need a batched ask and a configured forge, and this repository has
  neither (`issue-filing.mjs unfixed` answers `no-forge` here today).
- **Item 22 gets no task**, per the dispatch: live authenticated `tea`/`gh`/`glab`
  writes against three operator-owned scratch repositories are out of a plan's
  reach. The procedure stays at `.planning/phases/3/live-forge-check.md`.
- **`.planning/DOCS-CLAIMS.md`'s `EXECUTE-46` row is deliberately not touched.**
  It records a claim verified during the v2.6.0 doc sweep, against line numbers
  (`execute.md:383-388`) that were already stale before this plan; that ledger is
  a record of what a sweep found, not an instruction the tree follows, and
  rewriting a past sweep's findings is a different change with its own reasons.
- **One plan, not a split.** All three tasks share
  `cadence-core/bin/weight-budgets.json` and task 2 depends on task 1's edit, so
  the independence test refuses a split. No CONTEXT `Plan shape` directive
  exists for this phase.
- The task ceiling in the dispatch (8 per plan) replaces the template's
  "typical 3-10 tasks" line.
