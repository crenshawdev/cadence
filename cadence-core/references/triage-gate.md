# The consequence gate (triage)

What each gate arm does once a review's findings are in hand. The gate is one of
`off | advisory | deferred | blocking | adjudicated`, resolved from the routing
bundle at `references/review-triggers.md` step 1 - `off` returned before any
reviewer ran.

- **advisory** - report the findings, continue. Nothing halts.
- **deferred** - Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate-deferred.md`. The
  triage of a deferred queue at `/cad-land` reads it too.
- **blocking** - Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate-blocking.md`. It
  holds the one-round cap on a blocking re-arm, so a fire site that re-reads
  this file before a fix lands reads that file too.
- **adjudicated** - Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate-adjudicated.md`.
  `/cad-verify`'s fire, which has no gate of its own, reads it too.

A gate that holds a finding it will not fix now - the `blocking` arm's
below-blocker/high remainder, the `adjudicated` arm's non-survivors, a
`recorded not fixed` disposition - also Reads
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate-unfixed.md`. No gate
reads another gate's file.

**A return that is not the findings object is NEITHER outcome, at any arm.**
Prose, a fragment or an empty return in place of the `{ "findings": [...] }`
object `skills/cad-reviewer-contract/SKILL.md`'s `<returns>` block specifies
means the gate could not be evaluated: say so and ask, as the `blocking` bullet
does. Read the return's SHAPE, never a host-side stop signal.

**Every blocking settle leaves a JOINABLE receipt.** `planning.mjs risk-check
status` refuses a range its detector matched until an outcome event says the
fire happened, so all five settle points append one: `adjudication`
(`references/review-triggers.md` step 5), `rearm`
(`references/triage-gate-blocking.md`), the `deferral`
(`references/triage-gate-deferred.md`), and the two here. Each
carries `--trigger <trigger>` in that structured flag rather than inside a
detail, where one spelling clears a range and another refuses it, plus
`--plan <k>` when the fire is per-plan, omitted when it is not (`/cad-debug`,
`/cad-task`, `/cad-verify`).

**Every receipt names the RANGE it settles**, on `--base <base> --sha <head>` -
BOTH ends, since two ranges can share a head and differ at the base.
`risk-check status` joins on both ends, so a receipt missing either settles
nothing. Pass the same head the fire's own artifact was built from. A settle
for a window the run has already moved PAST names that window on `--anchor <sha>`,
the sha that window's own `phase_start` recorded: without it the receipt is
stamped with the phase's NEWEST anchor and joins nothing the earlier window
fired. An ordinary same-window receipt omits the flag.

**Every blocking settle also leaves the ADJUDICATION RECORD.** The receipt says
a fire HAPPENED; the record says what was raised and how each finding was ruled,
and the `gate_pass` and `override` below carry no finding body without it. A
blocking fire writes it at the same settle point, from the payload, the path and
the discriminator `references/review-triggers.md` step 5 states. This file is
re-read at the gate step without that one, so it holds the obligation and the
pointer only. The ADVISORY arm writes no record and reads as unrecorded, for the
reason step 5 gives.

**A settle receipt carries the counts the RECORD SEAM derived**, on
`--survivors`, `--downgraded` and `--refuted`, with `--round <round>` on a
re-armed fire; `references/review-record.md` states what each flag means and
when `--round` is omitted. A `gate_pass` where nothing survived still carries
three zeroes. The `rearm` and `deferral` receipts carry none of the four, except
that `deferral` keeps `--round`: a re-armed fire's queue member is a second file.

Nothing `blocker`/`high` survives - PASS, and record it, or every matched range
whose fire found no blocker becomes permanently unclearable:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event gate_pass --trigger <trigger> --plan <k> --base <base> --sha <head> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] [--anchor <sha>]
```

The user explicitly overrides a FAIL - record that instead. The reason is the
user's own words, so it rides `--detail-file <path>` and never an inline
`--detail` (references/conventions.md states the transport). An `override` with
an empty reason is REFUSED: a blank override is indistinguishable from a
manufactured clear. One human answer covering two ranges is two receipts, so
MINT one `--authorization-id <id>` when the engineer answers and carry it on
every receipt written on that answer. A receipt written on its own answer
carries a fresh id, one with no authorization behind it omits the flag, and a
shared id LABELS the pair without widening what either receipt settles - each
range still needs a receipt naming its own two ends:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event override --trigger <trigger> --plan <k> --base <base> --sha <head> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] [--anchor <sha>] [--authorization-id <id>] --detail-file <path>
```

When the record this fire wrote holds a `survived` `blocker` or `high` marked
`overridden: true` - a halting finding cleared by a person rather than by a
fix - the seam REFUSES a settle receipt carrying no reason, whatever its event
name, and appends nothing. The accepted shape is the fenced one above: the user's own
words on `--detail-file <path>` with the three settled figures, and omitting one
of the figures does not discharge it either.

**The narrowed round and its terminal STOP-and-ask.** The blocking re-arm's
one-round cap is `references/triage-gate-blocking.md`'s, and the deferred
queue's triage takes these two steps from here:

1. The fix lands -> fire ONCE more, NARROWED: the artifact is the fix's own diff
   plus the blocker list it is confirming, NOT the whole artifact again, and it
   asks one question - is each blocker actually closed, and did the fix introduce
   anything new?
2. Nothing `blocker`/`high` survives that pass -> resume. One still survives ->
   STOP and ask the user (ask-user seam): proceed anyway, or stop and fix by
   hand. That hand is the USER's, outside Cadence, and this point comes only
   after round two's narrowed re-fire, strictly LATER than the FAIL-branch fix
   dispatch, which it neither replaces nor licenses the coordinator to perform.
   Name the reason in the ask - "`<trigger>` re-armed once on its own fix and
   still reports N blocker/high findings" - and never fire that trigger again in
   this loop. A non-findings return is neither (the SHAPE rule above).

**Two caps, two different numbers.** One question carries at most four options
and NONE occupies one of them, so N survivors become `ceil(N/3)` questions - at
most three survivors per question, NONE first in every one. Those questions then
batch at most four per `AskUserQuestion` call.

**A contradictory answer re-asks, once.** A multi-select answer with NONE
selected TOGETHER with one or more survivors is contradictory; don't guess which
half the user meant. Re-present that single question on its own and take the
second answer as final; the rest of the batch stands. The "Unfixed" ask
re-asks with its own question and options (the repository, its visibility and
what each answer does), after the first sentence of the block below.

- header: "Pick again"
- question: "You picked None of them and also picked findings, and those can't both stand. Which findings do you want to act on?"
- options:
  - "None of them - act on none of these findings"
  - "Finding {number} - {severity}, {file and line}" - one option for each finding in this question, up to three

**The `git.auto_close` carve-out is a READ inside `/cad-land`, not a suppressed
ask.** `/cad-land` fires no review of its own, so there is no triage prompt there
to switch off. The key governs the unattended close's halt: with it true,
`/cad-land` reads the `ADJUDICATION-risk_surface*.json` records this branch's
own `risk_surface` fires wrote, under `.planning/phases/*/records/` and under
`.planning/records/risk-carry/*/`, where `/cad-milestone` copies them before
pruning, unions every round's `entries[]`, and pipes that to
`land-cleanup.mjs gate`. Only three things follow: an entry the record leaves genuinely unfixed
halts the merge, a `REVIEW-risk_surface*.md` with no sibling record halts it by
name, and an entry a person cleared with `overridden: true` is surfaced beside
the halt without causing one. It never halts on the reviewer's raw claim - a
finding fixed, refuted or downgraded during adjudication is answered work. No
other command reads that key and `land-cleanup.mjs gate` does not run outside
`/cad-land`, so a `plan`, `diff` or `phase_diff` fire keeps both its ask and its
survivors whatever `auto_close` says.

`cad-verify` routes fix requests through fire() (a review producing the fix
list), not its own fixer loop. That fire names no wiring-table trigger and has
no resolved gate: its list is always triaged through the `adjudicated` rule
(`references/triage-gate-adjudicated.md`), before any of it is proposed as a fix.
