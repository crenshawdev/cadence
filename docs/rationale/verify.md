# Why /cad-verify is shaped this way

Companion to `cadence-core/workflows/verify.md`. **Not read at runtime** - no
workflow, skill or agent loads this file, and it is outside every budgeted
prose surface (`weight.mjs` measures `cadence-core/workflows/*.md` top-level
only).

Read it before EDITING that workflow. Anchors match the step names.

---

## deep_check - what each term of the run condition holds

`workflow.verifier: false` is the off switch and always wins. Beyond it, two
terms: the FIRST-session term is what keeps the pass to once per phase, so
dropping it re-dispatches cad-verifier on every later UAT session; the resolved
`verify` term is what lets a phase touching no risk surface decline the pass
entirely. `verify` has no config key - it is `on` exactly when the plan-time
floor raised, and `--deep` is the manual override beside it.

## verify-deep.md dispatch, fall_through - no retry, one failure arm, one close

Three rejected designs, all in `cadence-core/workflows/verify-deep.md`.

A verifier retry. The pass is an accelerator, never a gate on the human walk: a
broken dispatch or a refused merge costs speed and the auto-verified items, and
the walk still verifies the phase. So a dispatch has two arms only, `merge` and
`fall_through`.

A failure path per branch. A failed dispatch and an `ok:false` merge both land
in `fall_through`, so neither can grow a private error path.

A close in `fall_through`. `dispatch` closes the bracket the moment the return
is in hand, whichever arm follows, so a second close there would close it twice
when a merge fails after a usable return.

## walk - the defect the two-pass split exists to prevent

Interrogating the user with a command the model can run itself. Pass 1 exists so
that everything executable is executed and cited before the user is asked
anything.

## walk - why `why_human` is not the predicate

The deep pass writes `why_human` for every UNCERTAIN truth as well as every
human-only check (`skills/cad-verifier-contract`), and a truth is UNCERTAIN
whenever no probe was observed - which is precisely a check the model can settle
by running one.

Taking the field's presence as the answer hands the user back exactly the
commands the walk exists to run. The bar is the predicate; the field is only
where the reason is written down.

## walk - why a loosely applied bar costs the user an answer

`blocked` is terminal for the model's own walk, and four separate mechanisms keep
it that way: `next` offers only `pending`, `refresh` appends only unseen names,
`route_failures`' reset is scoped to `status: fail`, and completion refuses it.
The way out is the user's answer on the next run, so an item blocked by a bar
applied loosely enough to attempt an impossible command holds the phase short of
Complete until the user answers it.

Pass 1 records `blocked` only for an item that cleared the bar and then failed on
an environmental cause the bar did not predict.

## walk - why UAT.md is read once at the top of pass 1

`uat status` returns `status`, `counts`, `result` and `first_pending` alone - no
item list, and only the first pending item's `expected` - and on a resumed session nothing has put the
item bodies in context at all. So the read has no substitute, and placing it
once, before the chain starts, is what leaves the "no UAT.md re-reads between
items" rule governing pass 2 unchanged.

## walk - why one `uat record` per item, never `uat merge`

`merge` atomically overwrites `phases/<N>/records/FINDINGS.json` on every success and
would clobber the deep pass's envelope - the file that exists to make a discarded
verifier finding recoverable.

## walk - why pass 2 never phrases an item as already run

An item the deep pass just appended has been in front of the user for one turn.
Phrasing the ask as though they have already tested it invites a reflexive "yes"
on a check nobody performed.

## route_failures - why the fix list is always triaged

That fire names no wiring-table trigger, so it has no resolved gate. Without the
triage step an unpicked finding would reach step 3's "Apply now" on the
reviewer's say-so rather than the user's.

## complete - why a partial verdict is still recorded

It is the phase's own outcome event, and a partial session is exactly the one
worth having in the record: a phase that never completed leaves no other trace
of having been tested at all.
