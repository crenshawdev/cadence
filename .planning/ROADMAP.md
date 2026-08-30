# Roadmap: v3.7.8 - what Cadence already knows

## Overview

**`v3.7.8`, opened 2026-08-29, closed 2026-08-30.** Five phases, all five
shipped and pruned from the list below; their rows are under `## Shipped` in
REQUIREMENTS.md and their residue in `.planning/ARCHIVE.md`. `/cad-phase add`
opens the next cycle. The source was the scan taken
immediately after the v3.7.7 tag, which produced five `S2-real` issues, plus
three findings filed against the v3.7.7 adjudication work itself and never
triaged.

**The thread.** In every one of these, Cadence already holds the answer and the
code next to it does not consult it. `route.mjs` maintains `stakesSet` for the
sole purpose of telling unset from configured, and the project template writes
`stakes` before the resolver is ever asked. The adjudication record now
distinguishes a fixed survivor from one left standing, and `land-cleanup.mjs`
reads the pre-adjudication artifact. `/cad-task` recognises that a task has
grown phase-sized and hands the user to a command that refuses without a phase.
The rotation writes a mandatory marker line and the admission check reserves
only the pending record. None of these is a missing capability. Each is a fact
on disk that the next step declines to read.

**What is broken.**

`cadence-core/templates/config.json:3` writes `"stakes": "shipped"`, and
`workflows/new-project.md:56` copies that template verbatim before `:65` tells
the user shipped stakes were written. `route.mjs:252` maintains `stakesSet`
solely to distinguish an unset `stakes` from a configured one, and
`config.schema.json:8` documents at length what unset does: it floors at `solo`
when every plan in scope was read clean and holds the `shipped` default when any
of them could not be. `config.mjs` has no unset operation. So the adaptive
routing the README describes cannot occur on any project Cadence itself
initialises, and the recent work letting low-risk phases earn a cheaper route is
unreachable by construction.

`land-cleanup.mjs:36-40` states the gate's input: `cad-land` unions the
`.planning/phases/*/REVIEW-risk_surface*.md` files this branch's fires persisted
plus the `.planning/REVIEW-risk_surface-*.md` files `/cad-milestone` carries
before it prunes the phase dirs. Those are raw review artifacts. They record
what was raised and nothing about what was ruled, so a finding that was fixed,
refuted, downgraded or overridden still reads as a live blocker/high and halts
the unattended close. Measured on the v3.7.7 close itself.

`/cad-task`'s too-big arm routes to `/cad-context`, which refuses an
off-roadmap phase. The command routes the user into a locked door.

The v3.7.7 adjudication rework has three findings standing against it. The
`fix_commit` VALUE check is still scoped inside the `ruling === 'survived'`
branch, so a `downgraded` or `refuted` ruling stores an arbitrary unspendable
string. `overridden: true` is an unverifiable self-assertion that discharges the
module's strongest refusal, and nothing requires the corresponding `override`
trace receipt. The rotation admission check reserves only the pending record,
not the mandatory rotation-marker line written into the fresh generation.

And a contended second trace rotation can lose a racing writer's event from both
the live record and `trace.1.jsonl`. A trace event can be a gate receipt, so a
loss can make completed work look unrecorded and force fail-closed recovery.

**The standard.** Would a user on their own project feel it. Phase 2 changes the
routing every new project gets. Phase 3 is a command that tells the user where to
go and sends them somewhere that refuses. Phase 4 halts an unattended close on
work already done. Phase 1 and phase 5 are the guards under those, and phase 4
cannot be built on phase 1's seam while its guards are wrong.

**Out of scope, deliberately.** `GH-167` - review payloads carry no secret
fence, and the provider cutover sends them off the machine - is not a phase this
cycle. It is opt-in only, it cites no defect, and what a remote reviewer may
receive is a design decision rather than a repair. It goes to `/cad-spike`.
`GH-148`, the executor digest's replay accounting, stays deferred: its
consequence lands in a record users do not read.

## Open Questions

- **OQ-1 - where the `fix_commit` check belongs.** Phase 1 can hoist the VALUE
  check out of the `survived` branch so every ruling's `fix_commit` is validated
  when present, or make the field unrepresentable outside the rulings that may
  carry one. The typo guard the requirement exists to serve must survive either
  way. Whether `overridden: true` becomes conditional on a matching `override`
  trace receipt, or merely records one, is the same phase's call: a receipt that
  is written but never required re-states the problem rather than closing it.
- **OQ-2 - what phase 4 joins against, given pruning.** `/cad-milestone` prunes
  the phase directories before an autonomous close, which is WHY `cad-land`
  reads carried `REVIEW-risk_surface-*.md` copies rather than the phase dirs. A
  join to the adjudication record therefore needs those records carried through
  the same prune, or the derivation resolved before it. Whether the carry grows
  to include the adjudication records, or `/cad-milestone` resolves
  genuinely-unfixed at carry time and carries the verdict, is phase 4 planning's
  call. The rail is one meaning and one seam: `lib/filing-decision.mjs` already
  defines genuinely-unfixed for issue filing, and phase 4 does not write a
  second survivor classifier.

## Phases


## Phase Details
