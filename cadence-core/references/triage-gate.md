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

**Every blocking settle leaves a JOINABLE receipt.** `planning.mjs risk-check
status` refuses a range its detector matched until an outcome event says the
fire happened, so all five settle points append one: `adjudication`
(`references/review-triggers.md` step 5), `rearm`
(`references/triage-gate-blocking.md`), the `deferral`
(`references/triage-gate-deferred.md`), and the two here. Each
carries `--trigger <trigger>` in that structured flag rather than inside a
detail - a trigger parsed back out of free text clears a range on one spelling
and refuses an identical one on another - plus `--plan <k>` when the fire is
per-plan, omitted when it is not (`/cad-debug`, `/cad-task`, `/cad-verify`).

**Every receipt names the RANGE it settles**, on `--base <base> --sha <head>` -
BOTH ends, since two ranges can share a head and differ at the base, and they
are then different diffs over different surfaces. A receipt keyed on the run and the plan alone clears every LATER
matched range for that plan in the same cycle, so a coordinator could fire once,
re-run the detector on a widened range after a fix, skip the second fire, and
still be told the gate was satisfied. `risk-check status` therefore joins a
receipt to a record by head commit, and a receipt carrying no `--sha` settles
nothing. Pass the same head the fire's own artifact was built from. A settle for
a window the run has already moved PAST names that window too, on `--anchor
<sha>` carrying the sha that window's own `phase_start` recorded: without it the
receipt is stamped with the phase's NEWEST anchor and joins nothing the earlier
window fired. An ordinary same-window receipt omits the flag.

**Every blocking settle also leaves the ADJUDICATION RECORD.** The receipt says
a fire HAPPENED; the record says what was raised and how each finding was ruled,
and both settle points below - a `gate_pass` and an `override` - carry no
finding body at all without it. So a blocking fire writes it at the same settle
point, from the payload, the path and the discriminator
`references/review-triggers.md` step 5 states - and this file deliberately does
not restate any of them: it is re-read at the gate step WITHOUT loading that one,
so what it owes a coordinator is the obligation plus the pointer, and a copy
here is a second statement that can drift. The ADVISORY arm writes no record and
reads as unrecorded, for the reason step 5 gives.

**A settle receipt carries the counts the RECORD SEAM derived**, on
`--survivors`, `--downgraded` and `--refuted` - the figures that seam returned
on its envelope, never a number counted by hand off the survivor list and never
folded into `--detail`, the slot a trigger was already spelled four ways inside.
The seam recounts the record's own rulings against them and refuses a receipt
that disagrees, so the survivor count is recomputable rather than asserted. A
`gate_pass` where nothing survived still carries three zeroes: `0 of 9 refuted`
and "nobody counted" are different fires. `--round <round>` is omitted on an
ordinary fire and carries the round on a re-armed one, since the re-arm
(`references/triage-gate-blocking.md`) writes its own record and a settle naming no round is checked against round
one's stale rulings. The `rearm` and `deferral` receipts gain none of the four:
one marks a round opening and the other a fire nobody has ruled on yet, and a
count there would describe a fire still in flight either way. `deferral` keeps
`--round` for the same reason every other receipt does - a re-armed fire's queue
member is a second file, and a receipt naming no round points at the first.

Nothing `blocker`/`high` survives - PASS, and record it, or every matched range
whose fire found no blocker becomes permanently unclearable:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event gate_pass --trigger <trigger> --plan <k> --base <base> --sha <head> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] [--anchor <sha>]
```

The user explicitly overrides a FAIL - record that instead. The reason is the
user's own words, so it rides `--detail-file <path>` and never an inline
`--detail` (references/conventions.md states the transport). An `override` is
the one receipt written on the coordinator's own say-so rather than as a
review's settled outcome, so it is REFUSED as a receipt when that reason is
empty - a blank override is indistinguishable from a manufactured clear. One
human answer covering two ranges is two receipts, so MINT one
`--authorization-id <id>` when the engineer answers and carry it on every
receipt written on that answer: a reader can then tell a second range settled by
one decision from a duplicate write of one range. A receipt written on its own
answer carries a fresh id, one written with no authorization behind it omits the
flag, and a shared id LABELS the pair rather than widening what either receipt
settles - each range still needs a receipt naming its own two ends:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event override --trigger <trigger> --plan <k> --base <base> --sha <head> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] [--anchor <sha>] [--authorization-id <id>] --detail-file <path>
```

The settle receipt is where that reason becomes CHECKABLE. When the record this
fire wrote holds a `survived` `blocker` or `high` marked `overridden: true` - a
halting finding that STOOD with no fix commit, cleared by a person rather than
by a fix - the seam reads that record beside the receipt and REFUSES a receipt
carrying no reason at all, appending nothing. The accepted shape is the fenced
one above: the user's own words on `--detail-file <path>`, alongside the three
settled figures. What is refused is the record and the receipt CONTRADICTING
each other rather than any particular event name, so omitting one of the three
figures does not discharge it either.

**The narrowed round and its terminal STOP-and-ask.** The blocking re-arm's
one-round cap is `references/triage-gate-blocking.md`'s, and the deferred
queue's triage takes these two steps from here and restates neither:

1. The fix lands -> fire ONCE more, NARROWED: the artifact is the fix's own diff
   plus the blocker list it is confirming, NOT the whole artifact again, and it
   asks one question - is each blocker actually closed, and did the fix introduce
   anything new?
2. Nothing `blocker`/`high` survives that pass -> resume. One still survives ->
   STOP and ask the user (ask-user seam): proceed anyway, or stop and fix by
   hand. That hand is the USER's, outside Cadence, and this point is reached
   only after round two's narrowed re-fire still reports a `blocker`/`high` -
   strictly LATER than the FAIL-branch fix dispatch, which it neither replaces
   nor licenses the coordinator to perform. Name the reason in the ask -
   "`<trigger>` re-armed once on its own fix and still reports N blocker/high
   findings" - and never fire that trigger again in this loop. A return that is not the `{ "findings": [...] }` object
   `skills/cad-reviewer-contract/SKILL.md`'s `<returns>` block specifies - prose
   where that object was expected, a fragment, an empty return - is NEITHER
   outcome: the gate could not be evaluated, so STOP and ask, exactly as the
   `blocking` bullet (`references/triage-gate-blocking.md`) already says a
   reviewer that could not run does.
   Read the return's SHAPE and never a host-side stop signal - the shape test
   holds whatever the host emits. This arm exists because the two-way reading
   sends a shapeless return down the resume branch as "nothing survived", which
   skips the terminal ask entirely; it is how the executor family already reads
   its own workers (`workflows/execute.md`'s timeout-or-no-report arm).

**Two caps, two different numbers.** One question carries at most four options
and NONE occupies one of them, so N survivors become `ceil(N/3)` questions - at
most three survivors per question, NONE first in every one. Those questions then
batch at most four per `AskUserQuestion` call. Options per question and questions
per call are separate caps; collapsing them is what produces the wrong batch
size.

**A contradictory answer re-asks, once.** A multi-select question can come back
with NONE selected TOGETHER with one or more survivors. That answer is
contradictory and is not resolved by guessing which half the user meant:
re-present that single question on its own and take the second answer as final.
Only that question re-asks - the rest of the batch stands. The "Unfixed" ask
re-asks with its own question and options (the repository, its visibility and
what each answer does), after the first sentence of the block below.

- header: "Pick again"
- question: "You picked None of them and also picked findings, and those can't both stand. Which findings do you want to act on?"
- options:
  - "None of them - act on none of these findings"
  - "Finding {number} - {severity}, {file and line}" - one option for each finding in this question, up to three

**The `git.auto_close` carve-out is a READ inside `/cad-land`, not a suppressed
ask.** `/cad-land` fires no review of its own - v3.2.0 removed the one it had -
so there is no triage prompt there to switch off. What the key still governs is
the unattended close's halt: with it true, `/cad-land` reads what this branch's
own `risk_surface` fires ADJUDICATED - the `ADJUDICATION-risk_surface*.json`
records under `.planning/phases/*/records/` and under `.planning/records/risk-carry/*/`, where
`/cad-milestone` copies them before pruning - unions every round's `entries[]`,
and pipes that to `land-cleanup.mjs gate`. Three consequences follow, and only
these three: an entry the record leaves genuinely unfixed halts the merge, a
`REVIEW-risk_surface*.md` with no sibling record halts it by name because
nothing ruled that fire at all, and an entry a person cleared with
`overridden: true` is surfaced beside the halt without causing one. What it
never halts on is the reviewer's raw claim - a finding that was fixed, refuted
or downgraded during adjudication is answered work, and halting on it is what
this arm stopped doing. The scope is load-bearing rather than stylistic - no
other command reads that key and `land-cleanup.mjs gate` does not run outside
`/cad-land`, so a `plan`, `diff` or `phase_diff` fire keeps both its ask and its
survivors whatever `auto_close` says.

`cad-verify` routes fix requests through fire() (a review producing the fix
list), not its own fixer loop. That fire names no wiring-table trigger and has
no resolved gate: its list is always triaged through the `adjudicated` rule
(`references/triage-gate-adjudicated.md`), before any of it is proposed as a fix.
