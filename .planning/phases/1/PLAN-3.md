---
phase: 1
plan: 3
requirements:
  - TRC-12
  - CST-04
files:
  - cadence-core/references/review-triggers.md
  - cadence-core/references/review-cross-model.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/report.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: Every review fire is bracketed and priced - Plan 3

## Goal

A review fire appears in the routing ledger exactly once and carries what it
cost. This plan fixes the prose that routes a fallback dispatch away from its
close, states that the routing resolve is owed once per fire whichever backend
serves it, and retires every live claim that the cross-model arm records no
tokens.

## Must be true when done

- A cross-model fire whose providers all drop out dispatches `claude-subagent`
  through that arm's own bracket procedure and reaches its close - including
  the checkpoint arm for a dispatch that failed or came back unusable - and
  both `references/review-triggers.md` and `references/review-cross-model.md`
  say so. On a live run, `trace render` lists no entry under `unpaired` for that
  fire and its token total is a number rather than `unrecorded`.
- Every review fire writes one `routing/resolve` for the reviewer role whichever
  backend serves it, and the two references state that rule where a reader on
  the cross-model branch will meet it.
- No live surface still claims the cross-model arm records no tokens: the two
  review references, `workflows/report.md`'s spend caveat, `SPEND_EXCLUDES` and
  `DOCS-CLAIMS.md`'s REPORT-12 row all state what is now true.
- `SPEND_EXCLUDES` no longer names cross-model provider calls, and both of its
  hand-pinned length assertions and the committed-fixture evidence literal match
  the shipped list.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` all pass, with every grown reference's
  `weight-budgets.json` row re-pinned in the commit that grew it.

## Context

CONTEXT.md's decisions bind every task here. The load-bearing ones: the fallback
sentence is duplicated and both copies are load-bearing, and the defect is the
CLOSE, not the dispatch (D-07, D-08); the resolve half is prose, not code, and
its unit is the FIRE (D-05, D-06); five surfaces become false when usage lands
(D-13); `review-triggers.md` and `review-cross-model.md` sit exactly at their
weight ceilings (D-14); provider usage never sums into `roles` (D-01).

Out of scope: the advisory bracket inversion at `review-triggers.md:152-171`
(D-09), the three paths that structurally emit no resolve - `/cad-decision-review`,
`/cad-minimalism-review` and `/cad-verify`'s fix-request fire (D-06) - and
phases 2 and 3. This plan runs after PLAN-1 and PLAN-2: tasks 3 and 4 state
facts that only become true once PLAN-1's usage extraction and PLAN-2's reviewer
row have landed.

## Tasks

### Task 1: Route the empty-set fallback to the arm that brackets it

- **Files:** cadence-core/references/review-triggers.md (the step-4 cross-model
  bullet, at the sentence beginning "And if dropping it EMPTIES the set"),
  cadence-core/references/review-cross-model.md (the `ok:false` bullet, at the
  same sentence), cadence-core/bin/weight-budgets.json
- **Action:** Both copies send the empty-set fallback to step 3's
  reviewer-selection rule, which is where the reviewer SET is composed and not
  where a dispatch is bracketed, so a model on that path dispatches and is never
  routed to a close. Rewrite both so the fallback enters the `claude-subagent`
  arm of step 4 - the arm that appends the `lifecycle/dispatch` keyed
  `--plan cad-reviewer --role cad-reviewer --reviewer claude-subagent` with the
  payload reference on `--read`, then closes that bracket with `trace close` the
  moment the returned object is parsed, and takes the `--detail-file` checkpoint
  arm when the dispatch failed, returned nothing or returned something
  unparseable. The CLOSE is the load-bearing half: the observed failure already
  wrote its dispatch half under that arm's keying, so a sentence that names only
  the dispatch fixes nothing (D-08). Both copies must say the same thing -
  `review-cross-model.md` is the file a model is actually reading when it hits
  the fallback, so fixing `review-triggers.md` alone lands the fix in the file
  the model already left (D-07). Leave the advisory bracket inversion further
  down `review-triggers.md` untouched: the observed fire ran `plan` at
  `critical`, where the gate is `adjudicated` and the fire site itself owes the
  close (D-09). Re-pin whichever `weight-budgets.json` rows the edit pushed over
  their current value in this same commit; the check is a ceiling, so a file
  that shrank needs no row change (D-14).
- **Verify:** `grep -n` for the fallback sentence in both files shows it naming
  the `claude-subagent` arm's bracket procedure, its close, and the failure case
  that arm covers, with neither copy still pointing a dispatching reader at step
  3's selection rule. `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun`. (human-verify: needs a live provider API key and an induced
  provider failure - set a key, force the provider to drop out (an unresolvable
  model id for that tier), fire a `blocking` trigger, then run
  `node cadence-core/bin/planning.mjs trace render --phase <N>` and confirm the
  fire has no entry under `unpaired` and its bracket carries a token figure
  rather than `unrecorded`.)

### Task 2: State that the routing resolve is owed once per fire, whichever backend serves it

- **Files:** cadence-core/references/review-triggers.md (step 1, and the step-4
  cross-model bullet), cadence-core/references/review-cross-model.md (the header
  paragraph listing the rules a caller owes whether or not it reaches the
  procedure), cadence-core/bin/weight-budgets.json
- **Action:** `route.mjs` needs no change - its `routing/resolve` append is
  gated only on the phase being resolvable and is already unconditional on
  backend (D-05). What is missing is the CALL: measured 2026-09-01, `/code/verbatim`
  phase 2 holds five provider reviews against two `cad-reviewer` resolves and
  `/code/smithers` phase 3 holds 39 against 14. The likely cause is prose: the
  step-4 cross-model bullet opens by saying the arm gets no lifecycle bracket
  and no token field, which reads as "this arm writes nothing to the record".
  Make step 1 say the resolve is per FIRE and owed before any backend is chosen,
  that one resolve serves every dispatch of that fire so a panel naming two
  providers still writes exactly one, and that a cross-model-only fire writes
  one too (D-06); and make `review-cross-model.md`'s header name the step-1
  resolve among the rules the caller owes whether or not it reaches the
  procedure, so a reader who jumped straight to the branch still meets it. Do
  not extend the rule to `/cad-decision-review`, `/cad-minimalism-review` or
  `/cad-verify`'s fix-request fire: all three state they resolve no model and
  are out of scope (D-06). Re-pin any row this edit pushed over its value.
- **Verify:** Reading step 1 and the step-4 cross-model bullet of
  `review-triggers.md` and the header of `review-cross-model.md` shows the
  resolve stated as one-per-fire and explicitly owed on the cross-model-only
  path. `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`.
  (human-verify: a phase whose five review fires were all served by a provider
  holds five `routing/resolve` events for the reviewer role in
  `trace render --phase <N>`. This is a COUNT and not a join: the resolve event
  carries no trigger field, so it cannot be tied to a given fire - D-12.)

### Task 3: Correct the two review references' "no token field" claim

- **Files:** cadence-core/references/review-triggers.md (the step-4 cross-model
  bullet's opening sentences), cadence-core/references/review-cross-model.md
  (the header's rule list and "The cross-model arm" bullet's opening),
  cadence-core/bin/weight-budgets.json
- **Action:** Three live sentences became false the moment PLAN-1's task 1
  landed: `review-triggers.md`'s "This arm gets NO lifecycle bracket and no
  token field, deliberately - no adapter extracts the API's own usage figure
  today", and `review-cross-model.md`'s two copies of the same claim including
  "It is the one place a real API-reported usage figure could exist rather than a
  host-reported one, and no adapter extracts one today" (D-13). Correct them to
  what is now true and no further: the arm still gets no lifecycle bracket -
  that has not changed and nothing here should suggest it did - but the call is
  no longer unmeasured, because the seam records the provider's reported usage
  on the `provider/request` event. Keep the consequence honest rather than
  deleting it: `cad-reviewer`'s per-role total in `trace render` still covers
  the claude-subagent voice only, because provider usage is a different
  denomination that never sums into `roles` (D-01) - it is now readable on its
  own, not missing. Tasks 1 and 2 of this plan have already rewritten sentences
  in both of these bullets, so read the live text rather than the quotations
  above before editing. Re-pin any row this edit pushed over its value; both
  files sat exactly at their ceilings before this phase opened.
- **Verify:** `grep -n` over both files returns no surviving sentence claiming
  the cross-model arm records no tokens or that no adapter extracts a usage
  figure, and the replacement text still states that `roles` covers the
  claude-subagent voice alone. `node cadence-core/bin/self-verify.mjs` reports
  no `budget-overrun`, and `node cadence-core/bin/test.mjs` passes.

### Task 4: Retire the cross-model entry from the spend caveat and re-adjudicate its ledger row

- **Files:** cadence-core/bin/lib/trace-suggest.mjs (`SPEND_EXCLUDES` and its
  doc comment), cadence-core/bin/trace-suggest.test.mjs (the committed-fixture
  evidence literal and the exclusion-list length assertion),
  cadence-core/bin/prose-agreement.test.mjs (the same length assertion),
  cadence-core/workflows/report.md (the "Tokens on subagent returns" shape line
  and the "What that token line EXCLUDES" rule), .planning/DOCS-CLAIMS.md
  (the REPORT-12 row)
- **Action:** `SPEND_EXCLUDES` names cross-model provider calls as an excluded
  source because there was "no lifecycle bracket and no token field on that arm
  at all". That reason died with PLAN-1's task 1 and the spend is no longer
  missing from the report - it has its own row, added by PLAN-2's task 2 - so
  drop that entry, leaving the orchestrator's own turns and figureless returns,
  and rewrite the doc comment above it (which counts "three sources") to match.
  The list has one definition and three readers by design, so all three move
  together: the R5 evidence string is a `join` over the array and the
  committed-fixture `deepEqual` in `trace-suggest.test.mjs` pins its literal, and
  both that file's and `prose-agreement.test.mjs`'s length assertions are pinned
  at 3 - re-pin the literal and both counts rather than loosening either
  assertion, since the whole point of reading the export is that prose and seam
  cannot drift apart. In `report.md`, drop the name from the shape line and the
  EXCLUDES rule, and in its place state the true fact where the figure is
  printed: a cross-model provider call's spend IS recorded, in its own
  denomination on the `provider/request` event, and is reported on the reviewer
  line PLAN-2's task 2 added rather than being part of this total (D-01).
  Deleting the name without that sentence would leave a reader to infer this
  total covers provider spend, which is the same class of false claim this phase
  exists to remove. Re-pin `report.md`'s `weight-budgets.json` row if this edit
  grew it. Then re-adjudicate `DOCS-CLAIMS.md`'s REPORT-12 row on the precedent
  that file already sets for a claim the code moved under: rewrite the claim to
  what the live file states, re-pin its line anchor to where the live file states
  it, and record the resolution as corrected against this task's commit, leaving
  the run-1 verdict cell exactly as run 1 recorded it.
- **Verify:** `node cadence-core/bin/test.mjs` passes, including
  `trace-suggest.test.mjs`'s MSR-02 case and committed-fixture `deepEqual` and
  `prose-agreement.test.mjs`'s MSR-02 case, with both length assertions matching
  the shipped list. `grep -n "cross-model provider calls"` over
  `cadence-core/bin/lib/trace-suggest.mjs` and `cadence-core/workflows/report.md`
  returns nothing in the exclusion list or the spend line, while `report.md`
  states where that spend IS reported. `node cadence-core/bin/self-verify.mjs`
  passes and `DOCS-CLAIMS.md`'s REPORT-12 row no longer asserts that a
  cross-model call records no tokens.

## Notes

**Sequencing - this plan runs LAST, and the phase's three plans are sequential,
never parallel.** PLAN-1, then PLAN-2, then PLAN-3. All three declare
`cadence-core/bin/weight-budgets.json` and this plan and PLAN-2 both declare
`cadence-core/workflows/report.md`, so `plan-overlap` reports overlaps and
`/cad-execute` routes sequential on its own. The order is a real dependency and
not a preference: tasks 3 and 4 here correct claims that are still TRUE until
PLAN-1's usage extraction lands, and task 4's replacement sentence in
`report.md` points at the reviewer line PLAN-2 adds. Tasks 1 and 2 depend on
nothing and ride in this plan because they edit the same two reference files as
task 3 - keeping all three edits to `review-triggers.md` and
`review-cross-model.md` under one lease means one executor sequences them
against the live text and re-pins each budget row once.

**Why the tasks are split across three plans at all.** One plan's `files:` list
is the read set a single executor dispatch is handed, and the phase's fifteen
declared paths came to 1,167,416 bytes against a 675,000 ceiling - before the
three census holders `lease-check --plan-time` requires. The split is by byte
capacity first and dependency order second; the task decomposition is unchanged
from the plan the coordinator accepted. This plan declares no census holder
because none of its paths is a census subject: the `weight-budgets` census is
the one its reference edits put at risk, and that census's holder is
`weight-budgets.json` itself, already declared for the re-pins.

**Task 1's live half needs a provider key.** AC2 cannot be proved in this
environment: it needs a real provider API key and an induced provider failure.
The task carries it as a `human-verify` instruction rather than as a command the
executor cannot run.
