---
phase: 5
plan: 6
requirements: [DOC-02]
files:
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - cadence-core/references/config-catalog.md
  - cadence-core/references/recall.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 5: What Cadence claims about itself is true - Plan 6 (the budgeted plugin surfaces)

## Goal

The four shipped plugin surfaces that describe a review gate, a written config,
a knob category and a seam's callers say what the code actually does, each
landing under its byte budget with the budget re-pinned in the same commit when
the edit grows the file.

## Must be true when done

- `cadence-core/workflows/plan.md`'s `review` step names the gate each stakes
  level resolves for the `plan` trigger, tells a run at the `shipped` default
  what to do there, and contains no sentence calling advisory the shipped
  default or claiming the per-plan `diff` review runs at advisory.
- `/cad-new-project` and `/cad-adopt` report the config they just copied
  accurately - plan check OFF, verifier on - in a sentence that is identical
  in both files.
- `cadence-core/references/config-catalog.md` publishes no knob category header
  with zero rows behind it.
- `cadence-core/references/recall.md` names every command that calls
  `planning.mjs recall` and the step each of them calls it at.
- `node cadence-core/bin/test.mjs prose` exits 0 with no `budget-overrun`, and
  `node cadence-core/bin/self-verify.mjs --root .` prints `problems:[]`, at
  every commit this plan makes rather than only at the last one.

## Context

Closes four of the twelve `stale` + `divergence` ledger rows UAT item 9 reports
(PLAN-27, PLAN-49, NEW-PROJECT-27, ADOPT-09, CONFIG-CATALOG-07, RECALL-01 - six
rows over four files). Accuracy only: phase 6 owns tone and audience over the
same prose (CONTEXT scope boundary), and no task here changes
`cadence-core/route-table.json`, `cadence-core/config.schema.json` or
`cadence-core/templates/config.json` - the code is right and the prose is what
is wrong. D-09 binds every file this plan touches: all five sit EXACTLY at their
`cadence-core/bin/weight-budgets.json` entry today (`plan.md` 21788,
`new-project.md` 18547, `adopt.md` 15627, `config-catalog.md` 8542, `recall.md`
2638, all measured 2026-08-15), so any edit that grows one re-pins its key in
the SAME commit. The check is a CEILING, not equality
(`cadence-core/bin/self-verify.mjs:808`), so an edit that shrinks a file needs
no re-pin and may leave the headroom.

PLAN-7 runs after this plan: it fixes the remaining six rows in the unbudgeted
narrative docs and then closes every one of these rows in
`.planning/DOCS-CLAIMS.md`. No task here touches the ledger - a row's
resolution names the sha that fixed it, and that sha does not exist until the
commit lands.

## Tasks

### Task 1: State the gate each level resolves in `plan.md`'s review step

- **Files:** cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json
- **Action:** In the `review` step, the gate bullet list opens
  `- **advisory** (the `shipped` default)` and that bullet closes by justifying
  the overlap with "(the same overlap the per-plan `diff` review runs at
  advisory)". Both are false. Establish the true statement by reading
  `cadence-core/route-table.json`'s `review` grid: `plan` resolves `advisory` at
  `solo`, `off` at `shipped` and `adjudicated` at `critical`, while `diff`
  resolves `off`, `off`, `blocking`, so no level resolves `diff` to advisory at
  all. Cross-check `cadence-core/references/review-triggers.md`'s Wiring table
  (the `plan` row reads `advisory / off / adjudicated`, the `diff` row
  `off / off / blocking`) and its step 1, which says a gate of `off` returns
  immediately as a no-op. Relabel the advisory bullet as the `solo` gate, keep
  the adjudicated bullet's `critical` sense, and state in the step that at the
  `shipped` default this trigger resolves `off` and the step no-ops - deleting
  the parenthetical alone would leave the gate that actually fires for most
  users undescribed, which is the same defect one level quieter. Drop the false
  `diff`-at-advisory comparand rather than substituting another trigger; the
  advisory arm's reason to overlap stands on its own (advisory findings gate
  nothing downstream). Change nothing in `route-table.json`: `off` at `shipped`
  is the deliberate decision `review-triggers.md:351-355` states and gives its
  reason for, and this task documents it. Then, if the file's `wc -c` now
  exceeds 21788, re-pin the `cadence-core/workflows/plan.md` key in
  `cadence-core/bin/weight-budgets.json` to the new count in this same commit.
- **Verify:** `grep -n "advisory" cadence-core/workflows/plan.md` returns no
  line pairing advisory with `shipped` and no line pairing the `diff` review
  with advisory; `grep -n "off" cadence-core/workflows/plan.md` returns a line
  inside the `review` step naming `off` as what `shipped` resolves and what to
  do at it; `node cadence-core/bin/self-verify.mjs --root .` prints
  `problems:[]`; `node cadence-core/bin/test.mjs prose` exits 0 and prints no
  `budget-overrun`.

### Task 2: Report the written config's real defaults in `new-project.md` and `adopt.md`

- **Files:** cadence-core/workflows/new-project.md, cadence-core/workflows/adopt.md, cadence-core/bin/weight-budgets.json
- **Action:** Both workflows copy `cadence-core/templates/config.json` verbatim
  and then tell the user, in the same one-line sentence, "Config written with
  defaults (standard granularity, shipped stakes, research off, plan check and
  verifier on). /cad-config changes any of it." Read that template to establish
  what was actually written: `granularity` `standard`, `stakes` `shipped`,
  `workflow.research` `false`, `workflow.plan_check` **false**,
  `workflow.verifier` `true` - so only the plan-check clause is wrong, and
  `cadence-core/config.schema.json:27` carries the same `false` default with its
  reason ("opt-in; the plan review trigger remains the default second opinion").
  Correct both sentences to name plan check as off while keeping verifier on,
  and keep the corrected sentence byte-identical between the two files: the
  ADOPT-09 ledger row records them as the same defect stated verbatim twice, and
  a wording split between them re-opens it as two defects. Keep it one line of
  user-facing report inside the step it already sits in, keep the
  "/cad-config changes any of it." tail, and add no configuration question -
  "ask no configuration questions" is the rule both steps state. Do not touch
  `templates/config.json` or the schema: the default is the shipped decision.
  Then re-pin the `cadence-core/workflows/new-project.md` (18547) and
  `cadence-core/workflows/adopt.md` (15627) keys in
  `cadence-core/bin/weight-budgets.json` in this same commit for whichever of
  the two now exceeds its entry by `wc -c`.
- **Verify:** `for f in cadence-core/workflows/new-project.md
  cadence-core/workflows/adopt.md; do tr -s ' \n' ' ' < $f | grep -o "Config
  written with defaults ([^)]*)"; done | sort -u | wc -l` returns 1, and that
  one string names plan check as off and verifier as on and does not read "plan
  check and verifier on"; `node cadence-core/bin/self-verify.mjs --root .`
  prints `problems:[]`; `node cadence-core/bin/test.mjs prose` exits 0 with no
  `budget-overrun`.

### Task 3: Drop the empty `Risk` knob category from the config catalog

- **Files:** cadence-core/references/config-catalog.md, cadence-core/bin/weight-budgets.json
- **Action:** Line 51 is the category header `| **Risk** |||||` and the very
  next line is the `**Review**` header, so the catalog publishes a knob category
  a user cannot configure. Establish that nothing belongs under it by reading
  `cadence-core/config.schema.json`: no `risk.*` key survives, the only
  risk-named keys are `review.triggers.risk_surface.{gate,tier,effort,surfaces}`
  at `:76-79`, and those already have their rows under **Review**. The eight
  `risk.override.*` keys were retired with the dispatch-time floor
  (`cadence-core/bin/route.mjs:64-76`, `lib/retired-keys.mjs`), which
  `cadence-core/bin/config-seams.test.mjs:615-630` pins by asserting a set
  `risk.override.auth` is named in `warnings` and routes nothing. Delete the
  empty header row. Do not invent rows to fill it, do not move or re-word any
  surviving row - the neighbouring rows carry their own ledger entries - and do
  not delete any other line: CONFIG-16 and CONFIG-29 also cite this file, but
  both are disclosed orphans whose claim was already dropped from the catalog
  and neither is in this plan's scope. A deletion shrinks the file, and the
  budget check is a ceiling, so no re-pin is required; re-pin the
  `cadence-core/references/config-catalog.md` key (8542) only if `wc -c` comes
  back higher.
- **Verify:** `grep -c "Risk" cadence-core/references/config-catalog.md` returns
  no line that is a bare category header with no rows under it (inspect the
  matches); the catalog still lists
  `review.triggers.risk_surface.surfaces`; `node
  cadence-core/bin/self-verify.mjs --root .` prints `problems:[]` - in
  particular no `inert-config-key`, the check at
  `cadence-core/bin/self-verify.mjs:772-775` that fires when a schema key loses
  its last prose mention; `node cadence-core/bin/test.mjs prose` exits 0.

### Task 4: Name every caller of `planning.mjs recall`, at the step each calls it

- **Files:** cadence-core/references/recall.md, cadence-core/bin/weight-budgets.json
- **Action:** The opening paragraph (`:3-6`) says "Two commands call
  `planning.mjs recall` - `/cad-context` at `analyze`, `/cad-debug` at
  Hypothesize - and the return is identical for both, so the contract is stated
  here once instead of drifting in two workflows." Three of its clauses are
  wrong, and every correction is established by reading a call site:
  `cadence-core/workflows/context.md:97` runs the call inside the `spend_gate`
  step (that file's steps run `resolve_phase`, `check_existing`, `load_priors`,
  `spend_gate` at `:73`, then `analyze` at `:149`), not in `analyze`;
  `cadence-core/workflows/debug.md:83` runs it at Hypothesize, step 1 of "The
  method loop", which is correct as written; and
  `cadence-core/workflows/plan.md:117` runs the same call in `spawn_planner`
  while the `inline_plan` step at `:176-186` instructs the same gated recall on
  the under-threshold path - a third command. Rewrite the paragraph to state
  three commands and to place `/cad-context`'s call at `spend_gate`: the
  deferred-read register at
  `cadence-core/bin/lib/deferred-reads.mjs:194-197` anchors it there on purpose
  and `cadence-core/bin/prose-agreement.test.mjs:417-427` asserts that anchor is
  not `analyze`, so `analyze` is contradicted by a live test as well as by the
  file. The closing clause is also no longer true - `/cad-plan` does not Read
  this file, it restates the return shape inline at `plan.md:120`, and the
  register carries exactly two rows for this reference (`cad-context`,
  `cad-debug`) - so state that plainly: three commands call the seam, two of
  them read this contract here and `/cad-plan` restates it at its own step.
  Keep it to the one opening paragraph, so the register's `read_paragraphs: 1`
  still describes what a caller actually reads, and leave the "What is
  deliberately NOT here" paragraph and `## The return` untouched (CONTEXT-05 and
  DEBUG-04 cite `:15-25` as accurate). Then re-pin the
  `cadence-core/references/recall.md` key (2638) in
  `cadence-core/bin/weight-budgets.json` in this same commit if `wc -c` grew.
- **Verify:** `grep -n "commands call" cadence-core/references/recall.md` names
  three and the paragraph lists `/cad-context`, `/cad-debug` and `/cad-plan`;
  `grep -c "analyze" cadence-core/references/recall.md` returns 0; `node
  cadence-core/bin/test.mjs prose` exits 0 with no `budget-overrun` (the
  `prose` group runs `prose-agreement`, whose recall-anchor assertion reads the
  same register this text now agrees with); `node
  cadence-core/bin/self-verify.mjs --root .` prints `problems:[]`.

## Notes

**Twelve, not eight.** The phase-5 SUMMARY open item and the `.planning/CAPTURE.md`
bullet both say eight stale claims remain stated falsely and then enumerate seven
sites. Measured against the live ledger on 2026-08-15: 20 rows carry a `stale`
verdict with a `divergence` resolution, of which exactly 12 carry the deferral
marker "Prose fix beyond this phase" - README-25, PLAN-27, PLAN-49,
NEW-PROJECT-27, ADOPT-09, CONFIG-CATALOG-07, RECALL-01, METHOD-59, METHOD-87,
METHOD-93, METHOD-97, INTERNALS-13. The other 8 (README-28, CONFIG-16, CONFIG-29,
CONTEXT-06, CONTEXT-07, PLAN-12, VERIFY-DEEP-01, VERIFY-DEEP-02) are the
disclosed orphans whose claim was deleted from its doc outright, so there is no
prose left to fix. The verifier's twelve is the right count and its enumeration
of eleven sites omitted METHOD-59 (`METHOD.md:421-428`, the retired risk floor);
the recalled "eight" undercounted by the five METHOD/INTERNALS rows and
miscounted its own list. This plan closes six of the twelve; PLAN-7 closes the
other six and two more the same edits invalidate.

Sequential with PLAN-7, which must run second: it re-pins the ledger cites these
commits move and resolves these rows by sha. The two plans share no file.
