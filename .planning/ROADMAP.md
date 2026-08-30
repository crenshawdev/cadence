# Roadmap: v3.7.8 - what Cadence already knows

## Overview

**`v3.7.8`, opened 2026-08-29.** Five phases. The source is the scan taken
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

- [x] **Phase 1: The record's guards hold for every ruling** - the `fix_commit` value check and the `overridden` escape are validated on the rulings that can carry them, not only inside the `survived` branch
- [x] **Phase 2: Adaptive routing is reachable** - a project Cadence initialises can reach the unset `stakes` behaviour its own schema documents
- [x] **Phase 3: The too-big arm opens a door** - `/cad-task` routes a phase-sized task through phase creation before context
- [x] **Phase 4: Land reads rulings, not raw findings** - the autonomous close halts on genuinely-unfixed findings, using the derivation issue filing already uses
- [x] **Phase 5: A contended rotation loses no event** - the second rotation and its admission check account for every writer and for the marker line

## Phase Details

### Phase 1: The record's guards hold for every ruling
**Goal:** `lib/adjudication-record.mjs` validates a `fix_commit` value wherever one is stored rather than only under `ruling === 'survived'`, and `overridden: true` no longer discharges the module's strongest refusal on an unverifiable self-assertion.
**Depends on:** nothing
**Requirements:** RSK-08
**Success Criteria:**
1. A `downgraded` or `refuted` entry carrying a malformed `fix_commit` is refused by the same value check that refuses one on a `survived` entry, with the refusal naming the field and the ruling. The typo guard's existing behaviour on `survived` is unchanged, proved by the tests that already cover it.
2. `overridden: true` on a survived blocker or high is accepted only against a corresponding `override` receipt in the trace record, or is refused by name. Whichever OQ-1 resolves to, the accepted shape is stated in `references/triage-gate.md` and the refused shape has a test.
3. The ruling vocabulary is unchanged: `survived | downgraded | refuted`, no fourth value.
4. Reproduced end to end: `risk-check run` through adjudication to receipt to `risk-check status` over a fixture carrying one entry of each ruling, at least one with a bad `fix_commit`, and the refusals land where criteria 1 and 2 say.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 2: Adaptive routing is reachable
**Goal:** A project initialised by `/cad-new-project` or `/cad-adopt` reaches the unset-`stakes` resolution `config.schema.json` documents, instead of being pinned to `shipped` by the template before the resolver is consulted.
**Depends on:** nothing
**Requirements:** RNG-04
**Success Criteria:**
1. `cadence-core/templates/config.json` no longer writes `stakes`, and a config merged from that template reports `stakesSet: false` from `route.mjs`.
2. `workflows/new-project.md:65` and the `/cad-adopt` equivalent no longer tell the user shipped stakes were written; they state that `stakes` is unset and what unset resolves to, in the schema's own terms.
3. A phase whose plans all read clean resolves at `solo` on a freshly initialised project, and a phase with an unreadable plan resolves at the `shipped` default. Both proved from `route.mjs resolve` output on a fixture, not from prose.
4. Setting `stakes` explicitly still floors resolution at the configured level and is never resolved below it; the existing floor tests are unchanged and green.
5. The README's adaptive-routing claim is true of a new project, checked by `self-verify` or by a test that initialises from the template rather than by reading the sentence.
6. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 3: The too-big arm opens a door
**Goal:** When `/cad-task` finds an off-roadmap task has grown phase-sized, the action it names creates the phase the next command requires, so the user is never routed to a command that will refuse.
**Depends on:** nothing
**Requirements:** PHS-02
**Success Criteria:**
1. `/cad-task`'s too-big arm names phase creation as the next action, and the sequence it prints ends at a command that accepts an off-roadmap phase.
2. Following the printed sequence from a repo with no matching roadmap phase reaches a planned phase without any command refusing, reproduced end to end.
3. The arm carries the task's gathered context forward rather than making the user restate it, or states plainly that it does not; it does not silently drop it.
4. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 4: Land reads rulings, not raw findings
**Goal:** `land-cleanup.mjs gate` halts an autonomous close on findings that are genuinely unfixed, using the derivation `lib/filing-decision.mjs` already applies to issue filing, so a finding that was fixed, refuted, downgraded or overridden does not stop a close.
**Depends on:** Phase 1
**Requirements:** LND-02
**Success Criteria:**
1. The gate's halt decision consumes adjudicated state. No second survivor classifier is added: the genuinely-unfixed meaning has exactly one definition in the tree, proved by a test that would fail if a second one appeared.
2. Whatever OQ-2 resolves to, the adjudicated state survives `/cad-milestone`'s prune of the phase directories, and the gate's contract comment states what it reads and where that comes from.
3. The v3.7.7 close is reproduced as a fixture: an already-fixed high finding does not halt, and an unfixed high finding still does.
4. The four unreadable-payload states the gate reports by name are unchanged, and each still halts under `auto_close`.
5. An overridden blocker is surfaced in the gate's output rather than passing silently.
6. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 5: A contended rotation loses no event
**Goal:** A second rotation under contention neither loses a racing writer's event nor admits a record it has no room for, so the trace record's tail is complete or the shortfall is stated.
**Depends on:** nothing
**Requirements:** TRC-11
**Success Criteria:**
1. Under a reproduced contended second rotation, a racing writer's event appears in exactly one of the live record or `trace.1.jsonl`, never in neither. The reproduction fails against the current code.
2. The rotation admission check reserves the mandatory rotation-marker line along with the pending record, so the fresh generation cannot exceed its bound on the first write.
3. The marker remains filtered from read paths and is never counted as an event, unchanged from v3.7.7.
4. A rotation that happened is still visible to `planning.mjs reads` and `trace suggest`; nothing stitches generations together silently.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.
