---
phase: 3
plan: 4
requirements:
  - CER-01
files:
  - METHOD.md
  - INTERNALS.md
  - README.md
  - docs/WORKFLOW.md
  - .planning/DOCS-CLAIMS.md
  - .planning/phases/3/MEASUREMENT.md
---

# Phase 3: Ceremony the change pays for - Plan 4 (what the documents say, and what the run cost)

## Goal

Cadence's own account of itself matches the resolver it ships: no user-facing
document still says detection sets no floor, the claims ledger records the
reversal, and what the computed level costs a real milestone is measured off the
record rather than asserted.

## Must be true when done

- No live document states the pre-floor world: `METHOD.md`, `INTERNALS.md`,
  `README.md` and `docs/WORKFLOW.md` describe the plan-time floor that ships -
  what raises it, that it fails closed, and the one key that lowers it (UAT item
  12).
- The eight `risk.override.<surface>` keys are still described as retired
  wherever they are mentioned, and no document tells a reader to set one.
- `.planning/DOCS-CLAIMS.md`'s `METHOD-59` and `INTERNALS-13` rows record the
  re-correction and name the cycle that made it, with their run-1 claim text
  left as the provenance the ledger's own reading rules require.
- `.planning/phases/3/MEASUREMENT.md` carries the per-phase level diff this
  phase's replay produces and the per-phase `tokens` figures the run record
  already holds, so the milestone comparison has a baseline and a stated
  prediction to falsify (AC6).
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array (AC7's mechanical half).

## Context

Closes UAT item 12 - the prose and claims-ledger half, D-11's scope - and
carries AC6's measurement and AC7's green check. D-11 names the statements that
must move: `METHOD.md`'s "Detection sets no floor" paragraph, `INTERNALS.md:13`,
`README.md`, and the `DOCS-CLAIMS.md` rows re-reversing METHOD-59 and
INTERNALS-13; `references/seams.md` and `references/config-reach.md` were
corrected in PLAN-1 and PLAN-3. D-12 fixes AC6's method: per-phase `tokens` read
off `trace.jsonl` as it already ships, no new instrumentation. D-13 bounds what
the prose may claim: this is NOT the deleted name-keyed detector returning.

Sequential, last: every sentence written here describes behaviour PLAN-2 and
PLAN-3 must already have shipped, and the measurement reads PLAN-3's replay.

None of these files is budgeted by `weight-budgets.json`, so no byte row moves in
this plan.

## Tasks

### Task 1: METHOD.md states the floor it ships

- **Files:** METHOD.md (the "Detection sets no floor" paragraph in the
  risk-surface section, between the once-per-plan-range paragraph above it and
  the pre-filter paragraph below)
- **Action:** The paragraph tells a reader the opposite of what the code does:
  "Detection sets no floor. What a plan declares raises no level: the `stakes`
  you set is the whole of it." Rewrite it as the mechanism that now ships, in the
  document's own register and at about its current length. What it must say: the
  configured `stakes` is the MINIMUM a project accepts and the phase's own
  declared `files:`, read at plan time, are what raise it; what the detector
  reads - the same anchored construct patterns and whole-path segments the
  commit-time `risk_surface` gate fires on, over the file's current body, scoped
  to the surfaces the project answered, with a DOCUMENT contributing its path and
  not its prose; that it fails CLOSED, so a plan Cadence cannot read holds the
  configured level and never drops below it; and that lowering below the computed
  floor takes the waiver key inside `review.triggers.risk_surface` naming the
  surface, which lowers the routing level only and never the blocking review.
  Keep the history the paragraph already carries and keep it TRUE: the
  dispatch-time detector cut in v2.7.0 judged a file by its NAME, one path token
  put six roles on their top rung, and the eight `risk.override.<surface>` keys
  it was waived with are still retired - what returned is a different detector
  with a different input, and the paragraph should let a reader who remembers the
  cut see why this one is not it. Say what the raise targets: a matched phase
  routes at `shipped`, not at the top row, because raising every match to
  `critical` is the tax the old floor died of. Do not restate the seam's full
  rule set here - `references/seams.md` is where the mechanism lives - and do not
  name a config key that does not exist in `cadence-core/config.schema.json`,
  which self-verify checks token by token.
- **Verify:** `grep -n "sets no floor" METHOD.md` returns nothing, the rewritten
  paragraph names the waiver key exactly as `config.schema.json` spells it, and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`. Read back against the code: every claim in the new paragraph
  is one `node cadence-core/bin/route.mjs resolve --role cad-executor --phase 3`
  and `node --test cadence-core/bin/route.test.mjs` demonstrate.

### Task 2: The two narrative documents stop calling `stakes` the last word

- **Files:** INTERNALS.md (the routing section's long paragraph at `:13`),
  README.md ("What a break costs")
- **Action:** Both documents tell a reader their answer is final.
  `INTERNALS.md:13` says "Your answer is the last word, and no detection moves
  it", then explains the v2.7.0 cut; rewrite that CLAUSE and leave every other
  clause of the line standing - the ledger row for it is scoped to the floor
  clause, and the surrounding sentences about cells, aliases, gates and
  escalation are all still accurate. What the clause must now say: the answer is
  the FLOOR rather than the last word, the phase's own declared files read at
  plan time can raise it, an unset key floors at `solo` when every plan in scope
  read clean, a plan that cannot be read holds the configured level, and lowering
  below a computed raise takes the named waiver - with the v2.7.0 name-keyed
  detector still described as cut and its `risk.override.*` waivers still
  retired, since that history is what makes the new floor's shape legible.
  `README.md`'s "What a break costs" section presents `stakes` as the one value
  that routes everything and never mentions that a phase can route above it; add
  the floor sentence there, at the register README uses - short, no mechanism -
  saying that the level you set is the MINIMUM a phase pays rather than a fixed
  price, that a phase whose declared files touch a risk surface routes ABOVE it,
  and that leaving `stakes` unset is what lets a phase touching none of them
  route below the old default, then pointing at `INTERNALS.md` for the mechanism.
  Do NOT write that a surfaceless phase routes below "the level you set": D-02
  makes an EXPLICIT `stakes` a floor nothing resolves under, so that sentence is
  false for every project that set one and AC1 pins the opposite. The discount
  belongs to the UNSET key, and README must not spell the two cases as one -
  writing a claim the resolver contradicts is the defect this plan exists to
  remove, not one to introduce in a new document. Leave README's controls
  table alone: its "Risk surface" row describes the commit-time review on a
  completed range, which is unchanged and still true.
- **Verify:** `grep -n "no detection moves it" INTERNALS.md` returns nothing;
  README's "What a break costs" section contains the floor sentence, contains no
  sentence claiming the configured level is what every phase pays, and contains
  no sentence claiming a phase routes below a level the user SET - the discount
  it describes is scoped to an unset `stakes`, which `node
  cadence-core/bin/route.mjs resolve` demonstrates both ways (unset, and with
  `stakes: critical` in a fixture config, where a surfaceless phase still returns
  `critical`); `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []` (which covers check 3b's INTERNALS path citations and check 1's
  config tokens over both files).

### Task 3: The workflow figure's risk callout stops claiming one detector

- **Files:** docs/WORKFLOW.md (the "One risk detector, and it reads the diff"
  callout under the review-trigger table)
- **Action:** The callout says a dispatch-time path match against the phase's
  declared `files:` "was a second detector until v2.7.0: it judged a file by its
  NAME, so one token floored a whole phase to `critical`, and it is gone." A
  plan-time detector ships again, so the callout's heading and its last sentence
  are both false as written. Restate it as the two detectors that now exist and
  what each reads: the plan-time floor reads the phase's declared files' paths
  and current bodies before any code is written and moves the LEVEL, and the
  commit-time `risk_surface` gate reads the plan's completed range and fires the
  blocking review - one moves what a dispatch buys, the other decides whether a
  review runs, and neither substitutes for the other. Keep the v2.7.0 history
  and keep it accurate: the detector that is gone judged a file by its NAME, and
  what replaced it reads constructs in the declared bodies with documents
  contributing their path alone. Leave the commit-time pre-filter paragraph
  beneath it untouched - both of its drop rules are unchanged. This file is not
  named in D-11's list of statements that must move; it is in scope under
  CONTEXT.md's scope boundary, which admits "the prose and claims-ledger rows
  that currently state 'detection sets no floor'", and this is one of them.
- **Verify:** `grep -n "it is gone" docs/WORKFLOW.md` returns nothing for the
  dispatch-time detector sentence; the callout names both detectors and what each
  one reads; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`.

### Task 4: The claims ledger records the reversal

- **Files:** .planning/DOCS-CLAIMS.md (the `METHOD-59` and `INTERNALS-13` rows)
- **Action:** Both rows carry a resolution written in the no-floor direction -
  `corrected - fa0d4b4 - the paragraph now states detection sets no floor and
  names the v2.7.0 cut`, and its INTERNALS twin - which is now a record of a
  correction that has itself been reversed. Extend each row's RESOLUTION cell
  with the re-correction: what the sentence says now, and the requirement and
  cycle that changed it (CER-01, this milestone), keeping the earlier
  `corrected - fa0d4b4` clause in place so the row reads as the two-step history
  it is. Do NOT rewrite either row's claim TEXT and do not chase the line
  numbers: this ledger's own reading rules say a corrected row's claim text is
  what run 1 read BEFORE the fix and its line is provenance rather than an
  address, and rewriting it would overwrite a recorded correction with a verdict
  about different words. Leave the run column as it stands - this is a re-pin by
  hand, not a new extraction - and add no new rows: the next `/cad-docs-verify`
  sweep extracts the rewritten sentences on its own terms, which is what the
  ledger exists to make comparable. Leave `README-28` and `CONFIG-29` alone:
  both are divergence rows about the retired `risk.override` family, and both
  are still true - the family stays retired and the new waiver key is a different
  key with a different name.
- **Verify:** `grep -n "METHOD-59\|INTERNALS-13" .planning/DOCS-CLAIMS.md` shows
  both rows carrying the earlier `corrected - fa0d4b4` clause AND the CER-01
  re-correction, with the claim text and the run column byte-identical to what
  they were before this task - provable with `git diff .planning/DOCS-CLAIMS.md`
  touching the resolution cells of exactly two rows and nothing else.

### Task 5: What the computed level actually costs, measured

- **Files:** .planning/phases/3/MEASUREMENT.md
- **Action:** AC6 asks for the same milestone run at today's fixed level and at
  the computed one with per-phase `tokens` compared, and no executor can dispatch
  a live milestone - the orchestrator or the user runs it, which is what the
  human-verify tag on the criterion means. Write the file that makes that run
  worth doing and reads its result. It carries four things. First, the per-phase
  level diff: the rows `node cadence-core/bin/route.mjs replay` returns on this
  tree, rendered as a table - the directory, today's level, the computed level,
  and the surface and file behind each raise - with the command and the date of
  the run above it, so a reader can re-derive it rather than trust it. Second,
  the distribution before and after this phase, stated as counts over the same 30
  phase directories: what raised before the detector stopped reading
  documentation as code and what raises now. Third, the per-phase `tokens`
  baseline for the phases of this milestone, read off the record that already
  ships through `node cadence-core/bin/planning.mjs trace render --phase <N>`
  (D-12 - no new instrumentation, and the figure is what the seam already
  records, so name it as the seam names it rather than calling it the run's
  cost). Fourth, the PREDICTION the live comparison would falsify, stated
  honestly enough to be wrong: which phases the computed level moves at all,
  therefore where a saving can appear, and the caveat the verifier already
  recorded - most phases of THIS repository still raise, because its declared
  source files genuinely parse JSON and delete paths, so a milestone of this
  project is a weak test of the economics and a documentation-heavy project is
  where the discount shows. No new instrumentation, no new seam, and no claim
  about a run that has not happened.
- **Verify:** `.planning/phases/3/MEASUREMENT.md` exists and its level-diff table
  matches a fresh `node cadence-core/bin/route.mjs replay` row for row - re-run
  it and diff the two - and its token figures match `node
  cadence-core/bin/planning.mjs trace render --phase <N>` for each phase named.
  human-verify: the user (or the orchestrator) runs a milestone of a project with
  `stakes` unset, once with the floor in force and once with `stakes` pinned to
  the level it used to pay, and compares the per-phase `tokens` in
  `.planning/trace.jsonl` against this file's prediction - what to observe is
  that the phases the table marks as moving cost measurably less and that no
  phase the table marks as raised costs more than it did.

## Notes

- Plan mapping: this plan closes UAT item 12 and carries AC6 and AC7. PLAN-2
  closes items 13, 14, 11 and the `declaredBodies` symlink open item; PLAN-3
  closes items 3 (AC3) and 4 (AC4) and implements D-08.
- STRUCTURE DEVIATION, recorded in all three plans of this round: CONTEXT.md's
  `Plan shape` named three plan groupings, of which the first shipped as PLAN-1,
  so this round writes PLAN-2 (the gap items belonging to that shipped
  grouping), PLAN-3 (the replay + override rail) and PLAN-4 (the prose +
  measurement close). Every plan in this phase shares declared files with at
  least one other, so all of them are SEQUENTIAL in number order and none may be
  dispatched in parallel.
- This plan declares only documents, so once PLAN-2 lands its executor resolves
  at `solo` on sonnet where every phase of this project has paid `opus` - the
  live demonstration of AC2 on a real plan rather than a fixture, and worth
  quoting in the phase SUMMARY beside the criterion.
- `docs/WORKFLOW.md` (task 3) is NOT one of the six surfaces D-11 enumerates. It
  is in scope under CONTEXT.md's scope boundary rather than under D-11, and it is
  flagged here because the enumeration and the boundary disagree about it: the
  boundary admits every prose row stating detection sets no floor, and this
  callout is one.
