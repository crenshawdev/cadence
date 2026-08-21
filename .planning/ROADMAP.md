# Roadmap

## Overview

**`v3.5.7 - measured, and no lever to change it`, opened 2026-08-20.** Scoped
from the tracker milestone `v3.5.7`, which holds five issues: #167, #174, #189,
#193 and #206.

**The theme is one sentence: Cadence measures its own cost and gives you nothing
to spend it with.** `v3.5.6` closed the machinery that records what a run did.
This cycle takes the controls over what a run costs. A read trace that measures
read-set redundancy and no consumer that acts on the number (#167). A security
review invoked 61 times, paying 61 cold prefixes where one process reviewing N
diffs pays one (#174). `stakes` as a single project-level dial, so a README phase
and an auth phase buy the same model, the same effort rung and the same gates
(#189). And the one question Cadence asks on its own, the risk-surface interview,
asked exactly once with no way back to it and a menu that offers the same set
twice (#206). And blocking that blocks the RUN rather than the land, which is the
single constraint stopping Cadence from working while nobody watches (#193).

Three of the five are a control at the wrong granularity or missing outright.
#174 is the bill that granularity runs up, which is why it is scoped here rather
than filed as a cost note. #193 comes at the same sentence from the other end:
the guarantee worth keeping is that unreviewed work never reaches base, and that
guarantee does not require a human present at the moment the finding lands.

**Three phases, and two spikes that are deliberately NOT phases.** #167 and
#174 each carry an unknown their own issue says to resolve before betting on it.
#167: "Record `redundancy` per role across a few real phases before changing
anything... If the recorded per-role redundancy turns out to be near 1.0 on
current contracts, the 7.0x figure is historical and this closes with a note
rather than a change." #174: "whether a batched review over N diffs finds what N
single-diff reviews find. A per-commit review is scoped to one change on purpose,
so this is a real trade rather than free." Both run as `/cad-spike`, and `RDX-01`
and `BCH-01` are held in `## Active` unplanned until their spike returns a
verdict. A spike that comes back `invalidated` closes its issue with a note and
its id moves to Deferred carrying that note - it does not quietly vanish.

That last sentence is the point of writing this down. `v3.5.6` was scoped as
four issues, shipped one, and the other three were never planned into a phase
and never recorded as dropped, so nothing re-asked them. The audit could not
catch it either: that cycle seeded no requirement ids, so its trace arm ran over
zero requirements and returned PASS on an empty set while the coverage arm
carried the whole proof. This cycle seeds ids up front - `RDX-01`, `BCH-01`,
`CER-01`, `IVW-01`, `HLT-01` - so every one of the five is either traced to a
phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.

## Phases

- [x] **Phase 1: The question you cannot ask again** - the risk-surface interview gains a deliberate entry point through `/cad-config`, and its menu stops offering the same set twice
- [x] **Phase 2: Blocking that blocks the land** - a third gate mode `deferred` moves the block from the dispatch boundary to the land boundary, so a phase finishes unattended and `/cad-land` refuses until the queue is triaged
- [x] **Phase 3: Ceremony the change pays for** - `stakes` becomes the floor rather than the level, and the phase's own declared files raise it
- [ ] **Phase 4: The number nobody can spend** - read-set redundancy stops being a figure `/cad-report` prints and becomes a suggestion with a config key behind it
- [ ] **Phase 5: One cold start, N reviews** - the review fires that each pay their own cold prefix batch into one process that pays it once

## Phase Details

### Phase 1: The question you cannot ask again
**Goal:** The only configuration question Cadence asks on its own becomes one a
user can reach deliberately, see the evidence for, and answer again after the
repository has changed shape - and it stops presenting two identical options.
**Depends on:** Nothing
**Requirements:** IVW-01

This is first because it is the smallest, the most completely specified, and the
only one of the three that touches no other phase's code. #206 carries its own
acceptance list and names the exact drift.

The interview fires only from inside a `risk_surface` fire whose step-1
`route.mjs resolve` reports `surfaces_answered: false`. That siting is
deliberate - `/cad-new-project` and `/cad-adopt` both forbid configuration
questions in their own prose AND their own success criteria (D-15) - but the
consequence was not intended. Once answered, `review.triggers.risk_surface.surfaces`
can only change by hand-editing `.planning/config.json` or deleting the key so
the next fire re-asks. A project that adds Stripe six months in has a `billing`
surface its answered set does not cover, and nothing ever revisits the question.

The duplicate option is a prose-versus-code drift, not a bug in either.
`lib/surface-scan.mjs`'s `scanTree` returns `recommended = [...CATEGORIES]`
unconditionally, and the comment above that line is right about why: absence is
not provable from structure, and framework built-in auth (Django `contrib.auth`,
Rails `has_secure_password`) ships no separate dependency, so a narrowed
recommendation would persist a scope that skips the only blocking review the
project has. `review-triggers.md:451` was written against the PREVIOUS contract
and still describes `recommended` as the evidenced set plus `unspeakable`, then
tells the caller to fill the remaining slots with "the evidenced categories
alone, and all eight". Since `recommended` IS all eight, option 1 and the last
option are the same list. Rendered against a demo repo the menu came out as: all
eight (recommended) / the six evidenced only / all eight.

The fix is the prose. The two arms collapse into one: `recommended` is all eight
either way, and `inconclusive` changes only the REASON the option states, never
the set it offers. `evidenced` and `unspeakable` stay in the return and stay in
the ask, because they are what that reason is built from.

Why it drifted silently is the part worth pinning: `prose-agreement.test.mjs:180`
verifies the category LIST agrees across the schema enum, the route table and the
detection list, and verifies nothing about `recommended`.

**Success Criteria:**

1. A user can reach the interview deliberately through `/cad-config`, and that
   arm shows the currently answered set beside what `detect-surfaces` evidences
   NOW, side by side.
2. Re-running is non-destructive: the existing answer survives unless the user
   picks a new one, proven by a run that opens the arm and declines.
3. The option list contains no two identical sets, proven against the #206 demo
   fixture (Express + Stripe + Prisma + Passport, with `auth/`, `migrations/`,
   `api/`, `workers/`, a `.sql` file and an `openapi.yaml`) which today renders
   all eight twice.
4. `review-triggers.md` and `lib/surface-scan.mjs` agree on what `recommended`
   contains, with a `prose-agreement.test.mjs` arm that FAILS when either side is
   edited to disagree - falsified in both directions, not just asserted.
5. The `inconclusive` arm changes the stated REASON only; a test pins that both
   arms offer the same set.
6. The interview renders through the structured-choice seam at the fire site -
   at most four options, recommended first and labelled, never pre-selected -
   checked rather than assumed, since the interview is executed by a model
   reading a reference file and nothing structural enforces the rendering.
7. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.

### Phase 2: Blocking that blocks the land
**Goal:** A blocking finding stops the LAND instead of stopping the RUN. The
gate still fires, still runs the reviewer, still persists its findings; the
phase completes, the commits sit on the integration branch, and `/cad-land`
refuses while any deferred finding is unadjudicated.
**Depends on:** Nothing
**Requirements:** HLT-01

Blocking today means "blocks the run", so a human has to be standing at every
gate, so Cadence can only run while someone is watching it. That is defensible
as a default and it is also the single constraint that stops the tool working
overnight. The guarantee that actually matters is that unreviewed work does not
LAND, not that unreviewed work is not WRITTEN.

The new mode is `deferred`, beside `advisory` and `adjudicated`. Its fire path
is the advisory arm's exactly - reviewer runs, findings persist to the phase
artifacts - and its difference is entirely in what happens next: the run does
not stop, and the cursor lands in a state that NAMES the queue so
`/cad-progress` reports it and `/cad-land` can refuse on it.

Two rails are deliberately untouched, and the phase fails if either moves. The
protected-branch guard stays where it is: that is not a review finding, it is a
question about where commits go, and it has to be answered before the first one
exists. And the one-round re-arm cap in `triage-gate.md` still binds - a
deferred gate that FAILs is adjudicated once, later, not looped.

It goes before phase 3 because both touch the routing and gate axis, and phase
3's "stakes is a floor" changes what a level DECIDES about gates. Doing them in
the other order means doing part of phase 3 twice.

**Success Criteria:**

1. `deferred` resolves as a gate mode beside `advisory`, `blocking` and
   `adjudicated`, and a fire in that mode runs the reviewer and persists its
   findings to the phase artifacts in the same shape the advisory arm writes.
2. A `deferred` fire that raises a blocker does NOT stop the run: the phase
   completes and its commits exist on the integration branch, proven on a live
   run rather than a fixture.
3. The cursor lands in a state naming the queue, and `/cad-progress` reports the
   count of unadjudicated deferred findings.
4. `/cad-land` REFUSES while any deferred finding is unadjudicated, and the
   refusal names the findings; reverting the refusal reddens a test.
5. The protected-branch guard is byte-identical: a test pins that `deferred`
   reaches no arm of `git-guard`.
6. The one-round re-arm cap still binds on a deferred gate that FAILs -
   adjudicated once, later, never looped - pinned by a test that fails on a
   second re-arm.
7. Demonstrated end to end: a multi-phase run completes with nobody watching and
   `/cad-land` refuses until the queue is triaged in one sitting.
8. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.

### Phase 3: Ceremony the change pays for
**Goal:** `stakes` states the minimum a project will accept rather than the
level every phase pays. The phase's own declared files, read at plan time, raise
it - so a phase touching nothing on a risk surface resolves lower than the
project floor allows today, and no phase touching one resolves lower than it
does now.
**Depends on:** Phase 2
**Requirements:** CER-01

This is the philosophy change of the cycle and the issue says so in as many
words: non-trivial, and worth arguing about before writing. Today the routing
axis asks "what kind of project is this". The proposal is "what does this change
put at risk", which is the question the routing table has claimed to ask since
`v2.0.0` (STK-01) and answers once per project instead of once per unit of work.

One value in `config.json` decides the model, the effort rung, every review gate
and whether deep-verify runs, for every phase until someone edits it. The only
lever is editing config between phases, which nobody does, so the level is set
once, high, and every cheap phase pays for the expensive one.

The machinery to do better is already in the tree: `risk-check run` resolves
eight categories over a committed range and `route.mjs resolve` already returns
a `surfaces` list. The cost is structural rather than algorithmic - the resolve
moves from a config read to something that must read the phase's plan, so
`route.mjs` gains a dependency on planning state it does not have today. That
dependency is the thing to argue before a plan exists, and `/cad-decision-review`
is where that argument belongs.

**Success Criteria:**

1. `stakes` is read as a FLOOR: a phase resolves at or above it, never below,
   and a test pins that a project floor of `high` never yields a lower resolve.
2. A phase whose declared `files:` touch no risk surface resolves BELOW what
   today's project floor produces, demonstrated on a real phase.
3. No phase whose files touch a risk surface resolves lower than it does today,
   proven by replaying this project's own shipped phases through both resolvers
   and diffing the levels.
4. Lowering below the computed floor still requires the STK-03 override naming
   the surface, and that rail is byte-identical - pinned by a test.
5. The new `route.mjs` dependency on planning state fails CLOSED: a plan it
   cannot read resolves at the project floor, never below it.
6. Measured rather than asserted: the same milestone run at today's fixed level
   and at the computed one, per-phase `tokens` compared from `trace.jsonl`, with
   the cheap phases demonstrably cheaper.
7. The load-bearing decision - the resolve reading planning state - carries a
   `/cad-decision-review` ruling before the plan is written.
8. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.

### Phase 4: The number nobody can spend
**Goal:** The read-set redundancy `lib/read-trace.mjs` already computes reaches
a consumer that ACTS on it. Today `summarizeReads` returns `redundancy` and
`fileRedundancy` and the only reader is `/cad-report`, which prints them as
narrative. A figure that no decision consults is instrumentation the project
pays for and never spends.
**Depends on:** None
**Requirements:** RDX-01

The measurement is finished work. `summarizeReads` computes two deliberately
separate ratios - `redundancy` over distinct TARGETS and `fileRedundancy` over
distinct FILES - and both already return `null` rather than a fake figure when
there is nothing to measure, which is the hard part of making a number safe to
act on. `joinReads` attributes reads to the dispatch that caused them and
distinguishes `unjoined` from the permanent `floor`, so an attribution gap is
already legible as a limit rather than a failure.

What is missing is the lever. `trace suggest` - the one seam that turns the run
record into a retune with a config key, a value in force, a direction and a
target - reads the joined TRACE and never opens `.planning/reads.jsonl` at all.
So the redundancy figure has no path to `/cad-suggest`, and `/cad-suggest` is
the only place in Cadence where evidence becomes a proposed config change.

The thing to decide before planning: WHICH key a high redundancy should move.
A redundant read-set is evidence about context discipline, and the honest answer
may be that no existing key expresses the remedy - in which case this phase
either names a new one or reports the figure with an explicit "no lever exists",
which is still better than a number nothing reads. Do not invent a key to have
somewhere to point.

**Success Criteria:**

1. `trace suggest` reads `.planning/reads.jsonl` and a high redundancy produces
   a suggestion carrying its config key, the value in force, a direction and a
   target - shown on this repository's own record.
2. A `null` redundancy (no distinct targets, or no reads recorded) produces NO
   suggestion, and a test pins that the null arm is never rendered as zero.
3. The suggestion states the scope it was computed over, since nothing prunes
   `reads.jsonl` at a close and an unscoped run spans every milestone in the
   file.
4. If no existing config key expresses the remedy, the suggestion says so
   explicitly rather than pointing at an unrelated key; whichever arm ships, a
   test pins which one.
5. `/cad-report`'s existing `fileRedundancy` presentation still reads off the
   same seam - one implementation, both faces, no recomputation in prose.
6. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.

### Phase 5: One cold start, N reviews
**Goal:** N review fires over N diffs run in one process paying ONE cold
prefix, rather than N invocations each paying their own. This cycle measured 61
security-review invocations; each one re-establishes the same context before it
reads its first diff.
**Depends on:** None
**Requirements:** BCH-01

The cost is structural and it sits at the dispatch boundary, not inside any
reviewer. Both backends pay it. `claude-subagent` spawns a fresh `cad-reviewer`
per fire, and the cross-model path calls `review-provider.mjs` once per fire -
either way the prefix that describes what a review IS gets re-sent for every
diff in the range.

The constraint to respect: a review's VERDICT must stay per-diff. Batching is a
transport change, not a semantic one, and a batched pass that returns one merged
finding list over N ranges would destroy the per-fire adjudication record that
`risk-check status` joins receipts to. Whatever ships has to keep one
identifiable result per fired range, or the blocking gates that read those
results stop working.

Worth settling before a plan: whether the batch is a real multi-diff request or
a warm process reused across sequential requests. They have different failure
modes - a partial batch failure loses N results where a warm process loses one -
and the second is likely cheaper to make correct.

**Success Criteria:**

1. N review fires over N diffs pay ONE cold prefix, measured against the N-fire
   baseline on this repository's own record and the saving stated as a figure.
2. Each fired range still returns its OWN identifiable result - a test pins that
   N ranges in one batch yield N separately addressable verdicts, not one merged
   list.
3. `risk-check status` still joins a receipt to its record across a batched
   fire, with no change to the correlation-id contract.
4. A failure partway through a batch is reported per range: the ranges that
   completed keep their verdicts and the ones that did not are named, never
   silently dropped.
5. Both backends are covered, or the one that is not is named explicitly with
   the reason - a batching path that silently applies to `claude-subagent` alone
   while the cross-model path still pays N is a half-shipped requirement.
6. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.
