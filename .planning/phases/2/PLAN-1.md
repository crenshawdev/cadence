---
phase: 2
plan: 1
requirements:
  - MSR-01
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/references/seams.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/references/plan-revision.md
  - cadence-core/references/review-triggers.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The record learns to see the run - Plan 1 (MSR-01, the writer half)

## Goal

`trace close` persists the tool-call count the subagent return already carries,
and `trace render` reports turns per dispatch and per role rather than tokens
alone - so one of the two terms the bill is made of stops being absent from
`.planning/trace.jsonl`.

## Must be true when done

- A `planning.mjs trace close` carrying a turn count writes that figure onto the
  closing lifecycle event, and `planning.mjs trace render --phase <N>` shows it
  on that dispatch's bracket row and summed on that role's row.
- A close carrying no turn figure renders that role's turns under a counter of
  their own, never as `0`, and a dispatch that reported tokens but no turns
  stays distinguishable in the render from one that reported turns but no tokens.
- A malformed turn value - negative, non-integer, or the bare flag - is refused
  wholesale: the seam returns `ok:false` and `.planning/trace.jsonl` gains no
  line at all.
- All ten shipped `trace close` sites name the flag, and a check goes red the
  moment any one of them drops it.
- Rendering `cadence-core/bin/fixtures/verbatim.trace.jsonl` returns `counts`,
  `roles` and `unpaired` byte-identical to what it returns today, because the
  new keys are emitted only where a figure exists.
- A check watched failing against the unpatched tree is committed with a header
  naming the SHA it was watched failing at, and running it against that SHA
  exits non-zero.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

CONTEXT D-01/D-02 bind the shape: the count arrives as a NEW structured
non-negative-integer flag validated inside the shared `append|close` body of
`planning.mjs`'s `cmdTrace`, refused wholesale when malformed, OMITTED rather
than sent as `0` when the return carried no figure, and read off the HOST's
subagent return metadata with no new hook, seam or capture mechanism. D-03 gives
turns their OWN unrecorded counter - the existing `roles[].unrecorded` keeps
meaning "no token figure was reported". D-04 converts every close site in this
phase, never a pilot subset. D-07 keeps the value INLINE with no `-file`
sibling, so `cadence-core/bin/lib/text-transport.mjs`'s 36-row register does not
move. D-12 re-pins `weight-budgets.json` and the `'trace close'` row in
`self-verify.mjs` in the same commit as each prose edit.

Out of this plan and in PLAN-2: everything MSR-02 - `report.md`, `suggest.md`'s
seam, `progress.md`, `.planning/DOCS-CLAIMS.md`. Out of the phase entirely:
budgeting a live window (MSR-03) and any figure derived by multiplying these
terms together.

## Tasks

### Task 1: the turn count becomes a structured flag on the shared append|close body

- **Files:** `cadence-core/bin/planning.mjs` (`cmdTrace`, the `sub === 'append'
  || sub === 'close'` body between the `--tokens` and `--raised` blocks),
  `cadence-core/bin/self-verify.mjs` (the `'trace close'` row of `CONTRACTS`),
  `cadence-core/bin/trace.test.mjs`
- **Action:** Add `--turns` as a new structured flag to the ONE shared body that
  serves both `trace append` and `trace close`, beside the existing `--tokens`
  and `--raised` blocks and validated exactly the way `--raised` is: `requireInt`
  plus a non-negative test, and on failure `fail('bad-args', ...)` returning
  before `appendEvent` is ever reached, so a malformed value is a malformed CALL
  and nothing at all is appended (D-01 - a best-effort append with the field
  dropped renders the role turn-unrecorded while the caller believes a count
  landed). Take NO comma-grouping exception: that exception exists on `--tokens`
  because this plugin PRINTS token figures grouped, and a tool-call count never
  is, which is the reason `--raised` states for refusing one. The bare-flag guard
  falls out of `requireInt` refusing a non-string, since `parseArgs` turns
  `--turns` with no value into boolean `true`. Carry the value onto the event
  through the same conditional spread the other optional fields use, so an absent
  figure adds no key rather than a `0` (D-01) - a turn count of `0` from a host
  that reported one stays a recorded `0`, exactly as `--tokens 0` already does.
  Then list `--turns` on the `'trace close'` row in `self-verify.mjs`'s
  `CONTRACTS` table, with a comment stating what the flag is and why it is
  structured rather than parsed out of `--detail` (phase 1 D-12 established that
  `--detail` is not a machine-join surface). Do NOT add it to the `'trace append'`
  row: `--raised` is the precedent for a flag validated in the shared body and
  listed on one subcommand only, and the row is a PROSE allowlist that "never
  widens what a subcommand accepts". `--turns` is the name AC2 uses; do not
  rename it. The flag name is the planner's call per CONTEXT's second flagged
  assumption and it is settled here as `--turns`, writing the event key `turns`.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with new cases
  showing: `trace close --phase 1 --plan 1 --role cad-executor --tokens 12
  --turns 83` writes a line whose `turns` is the NUMBER 83 (`"turns":83` in the
  raw bytes, `typeof === 'number'`); `--turns -1`, `--turns 1.5`, `--turns abc`,
  `--turns 1,234` and a bare `--turns` each return `ok:false` with `bad-args` and
  leave the trace file byte-identical to what it was before the call; a close
  with no `--turns` writes a line with no `turns` key at all; `--turns 0` writes
  `"turns":0`. `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 2: the render reports turns per dispatch and per role, with their own unrecorded counter

- **Files:** `cadence-core/bin/lib/trace.mjs` (`renderTrace` and the
  `TraceRender` typedef), `cadence-core/bin/trace.test.mjs`
- **Action:** Make `renderTrace` account for turns the way it already accounts
  for tokens, and only that way. Each paired `brackets[]` row gains the turn
  figure alongside its `tokens`, preferring the terminal's figure and falling
  back to one the dispatch half carried, and reading `null` rather than `0` when
  neither end carried one - the same posture the `ms` and `tokens` fields already
  state. Each `roles[]` row gains a turn TOTAL emitted only where at least one
  figure landed on that role, plus a SEPARATE unrecorded counter for turns
  (D-03): the existing `unrecorded` must keep meaning "no token figure was
  reported", so collapsing both into one scalar - or letting a figureless-turns
  close increment the existing counter - is the defect this task exists to
  prevent, and it would falsify `progress.md`'s stated absent-prints-`unrecorded`
  rule with no test going red. Use the key names `turns` and `turns_unrecorded`
  on the role row so PLAN-2's readers have a stated field to consume. The per-role
  accumulator needs its own recorded/figures pair matching the comment already
  above `roleTotals` - `figures` alone decides whether a total is emitted, so an
  unmatched terminal's real figure is not silently dropped, and the funded-once
  flag must not let one dispatch be counted twice. A turn figure bills the
  DISPATCH's role, never the terminal's own, for the reason already written at
  the per-role accounting comment. A non-numeric or non-finite value on a
  hand-edited or foreign-producer line contributes NOTHING, exactly as `tokens`
  does. Extend the terminal REPLAY identity so a turn figure discriminates a
  replay the way a token figure already does - two closes differing only in their
  turn count are two closes, not one replay. Update the `TraceRender` typedef and
  the `roles` JSDoc so `tsc -p tsconfig.ci.json` still passes.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with new cases
  showing: two dispatches of one role, one closed with `--tokens 10 --turns 4`
  and one with `--tokens 10` alone, render as that role carrying a turn total of
  4 and `turns_unrecorded: 1` with `unrecorded` absent; the reverse pair (one
  closed with `--turns 4` alone) renders `unrecorded: 1` with no `tokens` key and
  a turn total of 4, so the two are not the same row; a role whose every close
  carried no turn figure renders with NO turn total key and never a `0`; the
  bracket row for a turn-bearing close carries 4 and one for a figureless close
  carries NO turn key at all - `null` there would emit a new key where no figure
  exists, which D-01's omit-not-zero rule and D-12's byte-identical guarantee both
  forbid, and it would contradict the role-level rule stated one clause above. `renderTrace` over
  `cadence-core/bin/fixtures/verbatim.trace.jsonl` still deepEquals the existing
  literal `roles`, `counts` and `unpaired` assertions unchanged. `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 3: `seams.md` states the close-half turn rule once

- **Files:** `cadence-core/references/seams.md` (the paragraph opening **The
  bracket rides the resolve.**, which already states the ONE `trace close` per
  dispatch moment rule and the omit-never-zero rule for `--tokens`),
  `cadence-core/bin/prose-agreement.test.mjs`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Extend the existing ONE statement so it also governs the turn
  count: the close carries the tool-call count the subagent return reported,
  under the same provenance sentence `--tokens` already has, and it is OMITTED
  when the return carries no count rather than sent as zero - a zero would claim
  a dispatch that used no tools. State that a turn-figureless return is ROUTINE
  and renders under a counter of its own, distinct from the token `unrecorded`,
  so a reader can tell a dispatch that reported tokens but no turns from the
  reverse. Add it to the paragraph that already says "This paragraph is the ONE
  statement of that rule; dispatch sites point here rather than restating it" -
  do not open a second paragraph and do not restate the provenance argument,
  which lives in `cadence-core/bin/lib/trace.mjs`'s TOKEN PROVENANCE header and
  is deliberately not duplicated in eager prose. `seams.md` sits at exactly its
  19258-byte pin with zero headroom, so re-pin `weight-budgets.json` in this same
  commit (D-12).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (an over-budget
  surface fails it, so a green run proves the re-pin landed), and `node
  cadence-core/bin/weight.mjs --root .` reports
  `cadence-core/references/seams.md` at a byte count equal to its new
  `weight-budgets.json` entry. `grep -c 'ONE statement'
  cadence-core/references/seams.md` still returns 1, so the rule was extended
  rather than copied. Those three all pass on the UNPATCHED tree today (the file
  sits at its pin, `self-verify` is green, and the paragraph already holds one
  `ONE statement`), so they prove the re-pin and nothing about the prose: add a
  check that goes red without the content. Assert in
  `cadence-core/bin/prose-agreement.test.mjs`, by named anchor the way that
  file's existing prose checks do, that the paragraph opening **The bracket rides
  the resolve.** names the turn count, its omit-when-absent rule and its separate
  counter; `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0 on
  this tree and FAILS when any one of those three sentences is deleted (restore
  it afterwards).

### Task 4: every close site names the turn count

- **Files:** `cadence-core/workflows/context.md`,
  `cadence-core/workflows/plan.md`, `cadence-core/workflows/execute.md`,
  `cadence-core/workflows/decision-review.md`,
  `cadence-core/workflows/minimalism-review.md`,
  `cadence-core/workflows/verify-deep.md`,
  `cadence-core/references/plan-revision.md`,
  `cadence-core/references/review-triggers.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Add the turn flag to all TEN shipped `trace close` invocations, in
  this phase and not a pilot subset (D-04): `context.md` 1, `plan.md` 2,
  `plan-revision.md` 2, `review-triggers.md` 1, `execute.md` 1,
  `decision-review.md` 1, `minimalism-review.md` 1, `verify-deep.md` 1. Each site
  carries it in the same placeholder register its `--tokens` already uses - the
  tool-call count on the subagent return - so a coordinator copying one figure
  copies the other from the same place, and each keeps the surrounding
  omit-when-absent instruction the site already states for `--tokens` rather than
  gaining a new paragraph of its own. A partial rollout would put a second,
  unstated rule in the tree ("some roles report turns") and a per-role total
  would then read as low rather than as partial. Do not restate the provenance
  argument at any site: task 3's `seams.md` paragraph is the one statement and
  the sites point at it. Every one of these eight files sits at or within 40
  bytes of its pin, so re-pin `weight-budgets.json` in the same commit for every
  file whose byte count moved (D-12).
- **Verify:** `grep -c -- --turns <file>` over each of the eight files returns
  exactly the count in D-04's census (context.md 1, plan.md 2, plan-revision.md
  2, review-triggers.md 1, execute.md 1, decision-review.md 1,
  minimalism-review.md 1, verify-deep.md 1), and `grep -rn 'trace close'` across
  `cadence-core/workflows/` and `cadence-core/references/` shows no invocation
  line without it. `node cadence-core/bin/self-verify.mjs` exits 0 - which is the
  falsifiable half, since an unlisted flag reports `unknown-flag` and an
  over-budget surface fails the budget check, so a green run proves both the
  contract row from task 1 and every re-pin here.

### Task 5: the producer census binds the turn flag to every close

- **Files:** `cadence-core/bin/trace.test.mjs` (the `traceCalls` reader and the
  `census: every trace family has a producer...` test's per-close assertions,
  which today assert `--role` and `--plan` on every close)
- **Action:** Teach `traceCalls` to read the turn flag off a close line the way
  it already reads `tokens`, and add an assertion to the existing census test
  that every `trace close` invocation in the shipped prose names it with a
  non-empty value. This is what holds D-04 mechanically: the census already
  requires closes to EQUAL dispatches per file, so it can see a lost bracket, but
  nothing today would see a site quietly shedding the turn flag - and turns per
  role would then read as low rather than as partial, which is the exact
  zero/unrecorded/recorded conflation the separate counter exists to prevent. Put
  the assertion in the same loop that already asserts `--role` and `--plan` on
  every close, with a failure message saying what a missing flag costs, and do
  not add a per-arm or per-file count of its own - the per-file BRACKETING map
  already binds the counts and a second copy of that arithmetic is what the
  census's own header refuses.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes, and deleting
  the turn flag from a single close line in `cadence-core/workflows/context.md`
  makes that same run FAIL naming `context.md` (restore the line afterwards).

### Task 6: the watched FAIL for MSR-01

- **Files:** `cadence-core/bin/trace.test.mjs`
- **Action:** Add one falsifier test, at the end of the file, that exercises
  MSR-01 end to end through the CLI only - `trace close` with a turn figure, a
  close without one, and `trace render` reading both back - and asserts the three
  properties AC1 and AC2 name: the figure persists onto the event and reaches
  both the bracket row and the role row; a figureless close lands under the turns
  counter of its own and never as `0`; a malformed value appends nothing. Reach
  the seams through the CLI and import nothing this phase added, so against the
  unpatched tree the test fails on its ASSERTIONS rather than on a missing
  export. Carry a header comment in the shape
  `cadence-core/bin/milestone-prune.test.mjs`'s RCL-07 falsifier already uses:
  `WATCHED FAILING AT <sha>` naming the tip of the unpatched tree (the commit
  immediately preceding this plan's first implementation commit - `b1364e7` is
  the tip as this plan is written), the observed unpatched output quoted
  verbatim, and the re-watch recipe (`git worktree add --detach <tmp> <sha>`,
  copy this file into that checkout's `cadence-core/bin/`, `node --test` it
  there, remove the worktree). Phase 1 D-17 is the convention and this carries it
  forward.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` exits 0 on this tree.
  Following the header's own re-watch recipe against the SHA the header names,
  the same command exits NON-ZERO with the new test failing on an assertion, and
  the header quotes that observed output.

## Notes

- CONTEXT's second flagged assumption (the flag name and the key it writes) is
  answered in task 1: `--turns`, writing the event key `turns`, which is the
  spelling AC2 already uses. Task 2 settles the render side as `turns` and
  `turns_unrecorded` on the role row, which is the field shape PLAN-2's readers
  are written against.
- CONTEXT's first flagged assumption (that the host surfaces a tool-call count on
  every PLUGIN agent return, not just most) is not designed around beyond D-01's
  omit-not-zero rule and D-03's separate counter, which are exactly what make a
  partially reporting host readable. If it turns out wrong, some roles render
  turns as unrecorded and the per-role view is partial rather than absent; no
  task changes.
- This plan shares TWO paths with PLAN-2: `cadence-core/bin/weight-budgets.json`
  and `cadence-core/bin/prose-agreement.test.mjs`, the second added at the `plan`
  trigger's adjudication so task 3's prose edit carries a check that can fail
  against the unpatched file. Both are leased above. The ordering is unchanged -
  the plans were already sequential - and the two additions to that test file are
  disjoint anchors: PLAN-1 checks `seams.md`, PLAN-2 task 5 checks `report.md`.
- This plan shares `cadence-core/bin/weight-budgets.json` with PLAN-2. That is
  the CONTEXT `Plan shape` directive's explicit instruction - shared surfaces get
  explicit `files:` leases per plan - so `plan-overlap` will report an overlap
  and `/cad-execute` will run the two plans SEQUENTIALLY, which is also the
  ordering the directive requires (writer half before reader half, since the
  readers must be written against the field shape they consume). See PLAN-2's
  Notes for the full deviation record.
