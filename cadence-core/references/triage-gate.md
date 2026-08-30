# The consequence gate (triage)

What each gate arm does once a review's findings are in hand. The gate is one of
`off | advisory | deferred | blocking | adjudicated`, resolved from the routing
bundle at `references/review-triggers.md` step 1 - `off` returned before any
reviewer ran.

- **advisory** - report the findings, continue. Nothing halts.
- **deferred** - the reviewer RAN and what it found stops the LAND instead of
  the RUN. Persist the findings exactly as the `risk_surface` persistence rule
  in `references/review-triggers.md` step 5 already specifies - the settled
  `{ "findings": [...] }` object written to
  `.planning/phases/<N>/REVIEW-<trigger>-<discriminator>.md`, on the same
  discriminator grammar (`plan-<k>` for a per-plan fire, `<command>-<short HEAD
  sha>` otherwise, and no unsuffixed path). Then pass THAT SAME FILE as the
  queue member's payload:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" deferred record --phase <N> --trigger <trigger> --discriminator <discriminator> --base <base> --head <head> --payload .planning/phases/<N>/REVIEW-<trigger>-<discriminator>.md [--round <round>]
```

  then leave the receipt that says this fire happened:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event deferral --trigger <trigger> --plan <k> --base <base> --sha <head> [--round <round>]
```

  Then the run CONTINUES. No halt, no ask, no re-arm here, and nothing is fixed
  at the fire - the finding is answered at `/cad-land`, which refuses while any
  queue member is unadjudicated. The queue member is COMMITTED, unlike the
  REVIEW file beside it: stage it with the next commit this run makes.
  `.planning/trace.jsonl` is gitignored and a REVIEW file left untracked
  evaporates on a fresh clone, so a queue that lived in either is a queue that
  is gone by the time the land reads it. This arm writes NO adjudication record
  - `RULINGS` has three values and none of them is "not yet" - so a member
  reads as unruled until a real adjudication supersedes it.
- **blocking** - PASS if no `blocker`/`high` finding survives, else FAIL. On
  FAIL, halt and surface the findings; resume only after they are fixed or the
  user explicitly overrides. A reviewer that could not run does not silently
  PASS - report that the gate could not be evaluated and ask. The re-arm on that
  fix is CAPPED - see below. Its below-blocker/high REMAINDER - the findings it
  reports and moves past - is settled in the same step, by "What happens to a
  finding this fire will not fix" below. That remainder is RECORDABLE: a
  `survived` finding raised below blocker/high is one that was confirmed and
  NOT fixed, so the record holds it as it happened instead of forcing a
  downgrade. How the entry is composed is `references/review-record.md`'s.

**Every blocking settle leaves a JOINABLE receipt.** `planning.mjs risk-check
status` refuses a range its detector matched until an outcome event says the
fire happened, so all five settle points append one: `adjudication`
(`references/review-triggers.md` step 5), `rearm` below, the `deferral` above,
and the two here. Each
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
nothing. Pass the same head the fire's own artifact was built from.

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
ordinary fire and carries the round on a re-armed one, since the re-arm below
writes its own record and a settle naming no round is checked against round
one's stale rulings. The `rearm` and `deferral` receipts gain none of the four:
one marks a round opening and the other a fire nobody has ruled on yet, and a
count there would describe a fire still in flight either way. `deferral` keeps
`--round` for the same reason every other receipt does - a re-armed fire's queue
member is a second file, and a receipt naming no round points at the first.

Nothing `blocker`/`high` survives - PASS, and record it, or every matched range
whose fire found no blocker becomes permanently unclearable:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event gate_pass --trigger <trigger> --plan <k> --base <base> --sha <head> --survivors <n> --downgraded <n> --refuted <n> [--round <round>]
```

The user explicitly overrides a FAIL - record that instead. The reason is the
user's own words, so it rides `--detail-file <path>` and never an inline
`--detail` (references/conventions.md states the transport). An `override` is
the one receipt written on the coordinator's own say-so rather than as a
review's settled outcome, so it is REFUSED as a receipt when that reason is
empty - a blank override is indistinguishable from a manufactured clear:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event override --trigger <trigger> --plan <k> --base <base> --sha <head> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] --detail-file <path>
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

**The blocking re-arm is capped at ONE round.** A fix made to clear a blocking
FAIL is itself reviewable work, so the trigger re-arms on it; unbounded, that is
a loop with no terminal state. It is bounded in the vocabulary the spine's other
blocking loop already uses (`workflows/plan.md`'s ONE revision, maximum):

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
   `blocking` bullet above already says a reviewer that could not run does.
   Read the return's SHAPE and never a host-side stop signal - the shape test
   holds whatever the host emits. This arm exists because the two-way reading
   sends a shapeless return down the resume branch as "nothing survived", which
   skips the terminal ask entirely; it is how the executor family already reads
   its own workers (`workflows/execute.md`'s timeout-or-no-report arm).

The round count PERSISTS in the trace, so a `/clear` between rounds cannot
reset it. Before firing the narrowed round, read that count in ONE chained
step - the render is bulk output, so it rides this RUN's own scratch directory
and only the ANSWER reaches the transcript
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/conventions.md` states the
rule; the scratch file is the model's own, never a phase artifact):

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-rearm-XXXXXX")" \
  && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D holds a character a carried literal cannot survive" >&2; exit 1;; esac \
  && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <N> > "$D/render.json" \
  && node -e 'const f=require("fs");let r;try{r=JSON.parse(f.readFileSync(process.argv[1],"utf8"))}catch(e){console.error("scratch-unreadable: "+process.argv[1]+": "+e.message);process.exit(1)}if(!r||typeof r!=="object"){console.error("scratch-shape: "+process.argv[1]+" is not an object");process.exit(1)}if(!Array.isArray(r.outcomes)){console.error("scratch-shape: outcomes is not an array in "+process.argv[1]);process.exit(1)}if(!r.outcomes.every((o)=>o&&typeof o==="object")){console.error("scratch-shape: outcomes has a non-object entry in "+process.argv[1]);process.exit(1)}console.log(r.outcomes.filter((o)=>o.event==="rearm"&&o.trigger===process.argv[2]&&o.corr===r.corr&&(o.plan??"")===(process.argv[3]??"")).length)' "$D/render.json" "<trigger>" "<k>"
```

A carried literal is pasted into a later command unquoted-by-construction, so the guard REFUSES the directory at creation rather than trying to quote it defensively at every use site: `mktemp` builds the path from `$TMPDIR`, which the operator does not always own (a cloned repo's `.envrc`, a devcontainer, a CI runner), and one `"` in it closes the argument and runs the rest as commands. The character class is deliberately narrow - a `TMPDIR` holding a space is refused too, and fixing that is one `export` away, where a path that executes is not.

The directory is made for this run and the two calls are `&&`-chained to it,
which is what makes the count this run's OWN. A fixed shared scratch name is
one file that every concurrent run on the machine writes and reads, so a
render taken in another repository could spend or refund the one round this
gate has - and the chaining is what stops the read-back running on a render
that failed.

A NON-ZERO EXIT from that read-back is NEITHER answer. It names
`scratch-unreadable` when the render could not be read or parsed and
`scratch-shape` when `outcomes` is not an array, and in both cases the cap
could not be EVALUATED, which is not the zero arm and not the non-zero arm.
Treat it exactly as the `blocking` bullet above treats a reviewer that could
not run: STOP and ask the user. The shape this replaced defaulted a missing
array to `[]` and printed `0`, which reads as "the round is unspent" and
re-fires a blocking gate off a file it never managed to read.

The count is keyed on FOUR things - the event name, the trigger FIELD, this
run's `corr` and the PLAN `<k>` - which is the same key the append below
writes, so that one number is the whole answer: non-zero means a `rearm`
outcome for this trigger UNDER THIS PLAN is already recorded under that same id
and the one round is SPENT - do not fire again, go straight to the STOP-and-ask
arm above. The match is on the event's `trigger` FIELD and never on its detail
text, for the reason the receipt paragraph above states.

The plan key rides as the THIRD argument beside the trigger, so the block stays
the one line a coordinator copies and runs. Without that term a `rearm` written
for plan 1 reads as SPENT for plan 2 on the same trigger, and plan 2's fix can
never be reviewed at all. OMIT the argument on a fire that carries no plan
(`/cad-debug`, `/cad-verify`, `/cad-task`'s inline path - the discriminator
grammar in `references/review-triggers.md` names them): the append writes a
`plan` field only when `--plan` was passed, so those events carry none, and an
omitted key is what matches them.

Zero -> record the round as you fire it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event rearm --trigger <trigger> --plan <k> --base <base> --sha <head> --detail "<trigger>"
```

The `--sha` is what makes this round a receipt for the range it re-armed on as
well as the marker that spends the round; without it the narrowed round leaves
that range looking unfired.

A fresh `phase_start` (a genuine re-run) derives a new id and gets a fresh
round. The append is best-effort by the trace seam's own contract: when the
record cannot be written or read, the count falls back to what this context
remembers - the pre-persistence behavior, not a new failure mode.

**The DEFERRED queue is triaged later, and its cap rides the QUEUE.** A deferred
fire ruled nothing - it QUEUED, and the triage happens where `/cad-land`
refuses, in a session that can be days and a `/clear` away from the run that
deferred. Work the queue MEMBER BY MEMBER: rule each one through the
adjudication seam `references/review-triggers.md` step 5 states, at that
member's own trigger, discriminator and round. The record SUPERSEDES its member
- same round, sibling filename - so a member with no record beside it is still
queued and the refusal clears one ruling at a time, never all at once.

Where a `blocker`/`high` survives that ruling, the fix re-arms the trigger for
ONE narrowed round: the same cap, the same narrowed artifact and the same
terminal STOP-and-ask the blocking re-arm above already states, and this arm
restates none of them. What differs is WHERE THE ROUND COUNT IS READ. Read it
off the QUEUE - the highest round on disk for THAT fire - and never by counting
`rearm` outcome events under this run's `corr`. The corr-keyed count above is
right where the fix and the fire are the same run; here the triage runs under a
`corr` that matches no `rearm` the deferring run wrote, so it comes back 0 every
time, reads as "the round is unspent", and re-arms again on this land and the
next one - the unbounded loop the cap exists to forbid. The fire is what is
still true in a session that has forgotten everything else, so the fire is what
the count is keyed to.

On disk means the FILENAMES in the fire's home
(`.planning/phases/<N>/`, or `.planning/deferred/<N>/` once a close has carried
it there): the highest `-r<n>` suffix among that fire's
`DEFERRED-<trigger>-<discriminator>*.json`, an unsuffixed name being round one.
Count a member an adjudication has already SUPERSEDED - a settled round is a
round spent, and a cap that read only what is still queued would refund the
round at the exact moment the triage clears it. The re-armed round records
itself the same way it was queued: fire narrowed, then write its own member
through the `deferred record` call above with `--round 2`, which mints
`DEFERRED-<trigger>-<discriminator>-r2.json` beside round one on the
round-suffixed naming `ADJUDICATION-<trigger>-<discriminator>-r2.json` already
uses. The cap is then answered by reading what is on disk rather than by
remembering it, whoever asks and from whichever session. A `blocker`/`high`
still surviving round two is the terminal STOP-and-ask, never a round three.
- **adjudicated** - the survivors are already grounded, so what remains is the
  USER's choice, not the model's. Present them as a NUMBERED list, one line per
  survivor: severity, `file:line`, claim. Then ask which to act on through
  `AskUserQuestion` with `multiSelect: true`, and END THE TURN on that question.
  NONE is the first option in every question and the default. Nothing is
  applied, committed, published or re-planned against a survivor the user did
  not name. When nothing survives, say the review RAN and adjudication killed
  everything, not a bare "no findings". A return that is not the
  `{ "findings": [...] }` object `skills/cad-reviewer-contract/SKILL.md`'s
  `<returns>` block specifies is not that state at all: the gate
  could not be evaluated - say so and ask, the same arm the `blocking` bullet
  states, and never present it as adjudication having killed everything. Here
  too the test is the return's SHAPE, never a host-side stop signal. The
  NON-SURVIVORS, and every survivor the user did not name, are settled in the
  same step, by "What happens to a finding this fire will not fix" below.

**Two caps, two different numbers.** One question carries at most four options
and NONE occupies one of them, so N survivors become `ceil(N/3)` questions - at
most three survivors per question, NONE first in every one. Those questions then
batch at most four per `AskUserQuestion` call. Options per question and questions
per call are separate caps; collapsing them is what produces the wrong batch
size.

## What happens to a finding this fire will not fix

**Stated once, here, and both arms above point at it.** A gate that produces
findings it will not fix NOW asks the user about them IN THE STEP THAT DECIDED,
and every answer is recorded - an ACCEPTED one as an issue on this repository's
own tracker, a DECLINED one as a row in `.planning/DECLINED.md` and nowhere
else. Nothing is written to `.planning/CAPTURE.md` on either answer, nothing is
annotated, and nothing is carried to a later batch.

**The tracker states real work, so a decline stays off it.** A refusal still has
to persist or this gate re-asks it forever, but the fingerprint is the whole of
what that needs and a local file holds it.

**The set is READ, never judged.** It is not a list the model assembles and it
is never re-parsed out of the REVIEW file's prose. Run:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/issue-filing.mjs" unfixed --payload <path>
```

`<path>` is THE SAME composed payload file the adjudication record was written
from - the `{voices: [...]}` object, not the rendered findings. It reads
`.planning/DECLINED.md`, spawns nothing, and has no page to fill. What comes back
is exactly the same set on all three arms that reach here: the `blocking` arm's
below-blocker/high remainder, the `adjudicated` arm's non-survivors, and any
`recorded not fixed` disposition. THREE things are held back, and one case that
reads like a fourth is not. A survived `blocker` or `high` is NOT in it - that
one is what the gate is halting over - UNLESS it carries `overridden: true`, and
an overridden one IS in the set: the user has already chosen to ship past it, so
nothing is halting, and holding it back would drop the one finding the override
exists to surface. An entry naming its `fix_commit` is not in it, because the
work it would ask about is already committed. A finding already declined on a
previous fire is not in it either, so the same question is never asked twice.

**ONE ask STEP for the fire, however many findings it holds.** Present what
comes back through `AskUserQuestion` under the two caps this file already states
above and does not restate here. Fifteen findings are not fifteen prompts: the
friction of asking per finding is exactly what made the old silent-write path
attractive, and it is the thing this replaces.

**Say plainly what each answer does**, in the question itself:

- a finding the user NAMES becomes an issue on the tracker;
- a finding the user does NOT name is written to `.planning/DECLINED.md`, which
  is what stops a later fire asking the same question forever, and it never
  reaches the tracker in any form;
- either way NOTHING is written to `.planning/CAPTURE.md`, and no finding is
  annotated, parked or carried.

Then make ONE call with the dispositions and report what was filed:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/issue-filing.mjs" file --payload <path>
```

`<path>` here holds `{"entries": [{"finding": ..., "disposition": "accept" |
"decline"}, ...]}` - the findings the call above returned, each paired with what
the user chose. Only the accepts cross the network. A refusal from EITHER call is reported and the findings are
STILL IN HAND: an unreachable tracker is not a reason to drop a finding, and a
refusal names which ones were not filed. Add no receipt and no trace event -
this is a step inside a fire that already leaves one.

**An item is RESOLVED BY REMOVAL - filed on the tracker or dropped - never by
annotation and never by relocation within the file.** A queue where the way to
settle an item is to write more text into it cannot shrink: adjudicating an item
makes it longer. The `KEPT <date>` and `recorded not fixed` shapes are what
adjudication-by-annotation looks like, and both are refused. There is no third
answer where an item stays and gains a note.

**A contradictory answer re-asks, once.** A multi-select question can come back
with NONE selected TOGETHER with one or more survivors. That answer is
contradictory and is not resolved by guessing which half the user meant:
re-present that single question on its own and take the second answer as final.
Only that question re-asks - the rest of the batch stands.

**The `git.auto_close` carve-out is a READ inside `/cad-land`, not a suppressed
ask.** `/cad-land` fires no review of its own - v3.2.0 removed the one it had -
so there is no triage prompt there to switch off. What the key still governs is
the unattended close's halt: with it true, `/cad-land` reads what this branch's
own `risk_surface` fires ADJUDICATED - the `ADJUDICATION-risk_surface*.json`
records under `.planning/phases/*/` and under `.planning/risk-carry/*/`, where
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

Adjudicated does not auto-halt like `blocking`, and it is not the auto-replan
convergence loop (cut in DESIGN §6) - it grounds once and asks. Use it for the
deep, rare gates - `plan` and `phase_diff` at `critical`.

`cad-verify` routes fix requests through fire() (a review producing the fix
list), not its own fixer loop. That fire names no wiring-table trigger and has
no resolved gate: its list is always triaged through the `adjudicated` rule
above, before any of it is proposed as a fix.
