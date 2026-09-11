# Phase 28: Evidence associations - Context

Written 2026-09-10 under `docs/architecture/acceptance.md`. Phase 28 was
parked from the original phase 11 on 2026-09-09 as candidates T38-T42. It runs
now, after phase 27 and before 29, 12 and 13, under the delivery order the
owner accepted 2026-09-10 (`.planning/ROADMAP.md`, "Delivery order is not
phase number"): execution refuses a task close without red-then-green for an
identified check, and verification refuses a verdict on an item not in the
map, so the map has to exist as typed, attached items before either. Research
draft: `.codex-analysis/phase-28-context-draft.md` (gitignored), read against
HEAD `202bddaa`. Feeds: /cad-plan 28 (planner dispatch carries the design's
Planner block).

## Scope boundary

In: the evidence map a planner authors becomes typed items - check, artifact,
link, observation - each attached to one or more of the phase's current
approved truths at their current version, published together with the plan
under phase 27's one exact approval, bound to that plan's identity and
content revision, and readable back as the authoritative item set. The binary
refuses a map that leaves a current truth uncovered, gives a current truth no
check, has an item naming no truth in the bound phase, or has an item naming
a truth version other than the current one. A later republication of the plan
at a different revision marks the old map superseded; old maps are retained.
This is the acceptance subsystem's second layer as far as attachment goes
(`docs/architecture/acceptance.md`, "Layer 2: The evidence map").

Out: a check without a command or expected output, a second check on one
truth, and a link its truth does not need (phase 29 - though where a typed
field mechanically rejects a malformed value in this phase, that is credited
accurately without claiming 29); task-to-check bindings and red/green
receipts (12); verdicts, status derivation and waivers (13); truth revision
and versions beyond 1 (26); the review handoff (30). Nothing in this phase
makes a native plan execution-ready; D-88's admission refusal stands.

## Truths

At most seven. Each is one trigger, one observer, one outcome. The planner
writes exactly one check per truth. Approved by the owner 2026-09-10.

- T1. When a valid evidence map is accepted for a plan publication, the owner
  sees the submitted items attached to the phase's current truths in that
  plan.
- T2. When a submitted evidence map leaves a current phase truth uncovered,
  the caller is refused the map with that truth identified.
- T3. When a submitted evidence map gives a current phase truth no check, the
  caller is refused the map with that truth identified.
- T4. When a submitted evidence item names no truth in the bound phase, the
  caller is refused the map with that item identified.
- T5. When a submitted evidence item names a truth version different from
  the current approved version, the caller is refused the map with the stale
  association identified.
- T6. When a plan is republished at a different content revision, the caller
  sees its previous evidence map marked as superseded.
- T7. When a caller reads a phase's saved evidence map, the caller gets the
  authoritative item set with its truth associations and publication
  revisions.

All seven are properties over any submission of the stated kind. Expected
values are the handwritten submission, the truth records phase 11 stored and
the plan identity and revision phase 27 returned, read back from the reopened
filesystem and store after the server exits; a renderer's own output is not
the oracle. T3 is the owner's ruling on the former T40, recorded as D-90.

## Decisions settled with the owner 2026-09-10

Each is the owner's ruling on an open question from the research draft. The
draft's evidence for every option is at the section named.

- D-90 (A check is always required; draft O1, the former T40): every current
  truth must have exactly one check in the phase's map. An observation is
  supplementary evidence attached beside the check; it never stands in for
  it. This keeps the design's settled wording - "one truth, one check; the
  check IS the truth", and an observation "can never make a truth met, only
  concerns". A truth that cannot honestly have a runnable check is a scope
  conversation with the owner at context time; the planner never invents a
  command that certifies host conduct. If wrong: a live-only truth cannot be
  authored at all and its visibility is lost.
- D-91 (Plan and map are published together; draft O2): the typed map is
  part of phase 27's exact submission, preview and approval, and publishes
  with the plan in the same transaction; there is no separate attach
  operation and no map stored without its plan. D-82's opaque section
  becomes the binary-rendered `## Evidence map` section of that
  publication; the surrounding authored body is preserved and the replaced
  section is shown before approval. An existing phase-27 publication gains a
  map only through an explicitly approved replacement (D-84). Hand-written
  maps in shipped Markdown are never retrofitted or inferred as approved.
  The approved payload and snapshot contribution are extended for this; the
  resulting plan digest is computed without embedding that digest in its own
  bytes. If wrong: two writers own the map section.
- D-92 (Item identity; draft O3): item ids are caller-chosen, stable and
  unique within the phase occurrence; the readable spelling such as
  `P27-T1-C` is retained as the id but treated as opaque - the binary never
  parses an embedded truth number as authority. Full ids and association
  references are validated and preserved across replay. A spec change under
  a stable id is an item revision. No second allocator. If wrong: a renamed
  label silently becomes a new item and its history is lost.
- D-93 (Shared items and phase-wide coverage; draft O4): an item may be
  attached to more than one truth through explicit per-truth associations,
  each carrying its own reason; a shared observation is one item, never a
  second check. Each plan's map contribution is bound to that plan's
  publication and revision, and the phase view is the union of current
  contributions. Coverage is computed on the resulting set after the
  proposed batch replaces what it replaces: every current approved truth
  needs at least one current association, and under D-90 exactly one check.
  Plans that split a phase publish their first maps together; a later gap
  plan may rely on current saved contributions. Retired maps and stale
  references do not count. Two conflicting definitions of one shared id in
  the same current set are refused, never last-write-wins. If wrong: a phase
  split across plans can never pass coverage, or a duplicate id overwrites.
- D-94 (Current truth version; draft O5): an association is compared to the
  bound phase's current native approved truth record, which is version 1
  until phase 26 lands. Missing native context, an unknown truth id and a
  version inequality are each refused, with the requested and current values
  in the refusal. Matching text is not matching identity. The lifetime is
  phase 27's active-cycle occurrence; no global truth lifetime is invented.
  If wrong: a map attaches to a truth the owner no longer holds.
- D-95 (Verifier readback; draft O6): the saved map is read back as a
  binary-owned phase view: schema identifier; the occurrence; the current
  truth records with id, version, text and kind; every contributing plan
  identity and content revision; the retained map revision; every item with
  id, kind, spec and reason; every association with its reason; shared-item
  aliases; coverage state and the provisional-readiness flag; and the
  projection's installed, missing or drifted state kept distinct from stored
  authority. The view carries a deterministic digest of its inputs so a
  verification attempt can be bound to exactly what it read. A read that
  observes an inconsistent snapshot says so; it never claims coherence across
  changed inputs. The verifier never reconstructs the expected set from
  Markdown. If wrong: a verdict is judged against a set the verifier chose.
- D-96 (Item grammar; draft O7): input is structured by kind with explicit
  associations, and the map section is rendered by the binary. A check
  carries its command, its expected literal or property, and the test
  locator, setup and call; an artifact carries its locator and what must be
  there with substance; a link carries caller, callee and value; an
  observation carries its episode text and its specification provenance,
  never a fabricated result. Every item and association carries a reason.
  Exact field names are the planner's, consistently advertised in the
  schema, service and instructions. Ambiguous duplicate sections and a typed
  versus prose disagreement are refused at preview. Numeric versions are
  never derived from headings, "source O1" or id spelling. Whether a truth
  needs a link is a phase 29 decision; a filled value field does not prove
  it. If wrong: the rendered section and the stored items disagree.
- D-97 (Replacement and history; draft O8): map versions are immutable and
  retained; a plan republished at a new content revision marks the old
  contribution superseded and requires an explicit resubmission and
  revalidation of the map for the new revision. Matching section bytes or
  truth versions never carry a map forward automatically. A mapless
  replacement is permitted only as explicitly provisional authoring. A
  rejected verdict in a later phase must always be able to point at the
  evidence it judged. If wrong: a map silently applies to plan content it
  was never written for.
- D-98 (Replay and preconditions; draft O9): the complete map and
  association payload is bound to phase 27's occurrence-scoped request
  receipt and its conditional transaction; a replay returns the original
  result and historical binding without reinstalling it as current, and the
  same request id with a different item payload is refused. Coverage and
  version validation run against the same snapshot the publication
  transaction commits, never a pre-approval lookup that can go stale. The
  existing queue and confirmed transaction are reused; no new writer, no
  reader-start guard. If wrong: a retry lands a second map or validates
  against a truth set that changed.

## Durable decisions that bind this phase

Carried verbatim from ROADMAP.md at `202bddaa` except where marked.

- (`.planning/ROADMAP.md`, "### Phase 28") **Goal.** A plan's evidence map
  attaches to the phase's current truths; a map that leaves a truth
  uncovered, an item naming no truth, or an item naming a stale truth
  version is refused. Parked from phase 11 on 2026-09-09 (candidates
  T38-T42). Must land before phase 12 records a check's red-then-green or
  phase 13 accepts a verdict on an evidence item; depends on phase 11's
  approved truths and phase 27's persisted plan. T40 (whether an observation
  may stand in for a required check) stays open until this phase is
  contexted. - Settled here as D-90.
- (`docs/architecture/acceptance.md`, "The record") `evidence { id,
  truth_id, truth_version, kind, spec, reason }` where `spec` is the path,
  the command and expected output, the caller/callee/value, or the
  observation text; and `reason` is the one-line why. Under D-93 one item may
  hold more than one association; the record's shape per association is
  this one.
- (`docs/architecture/acceptance.md`, "The four refusal points, together")
  when the evidence map is planned the binary refuses: truth with no item;
  item with no truth; check without command and output; link its truth does
  not need. The first two are this phase (T2, T4); the last two are phase 29.
- (`.planning/phases/27/CONTEXT.md`) D-82, D-83, D-84, D-86 and D-88 bind as
  written: the map section publishes through the plan publication
  mechanism; approval is exact; replacement needs its own authorization;
  replay is by request receipt; nothing here makes a plan execution-ready.
- (`.planning/ROADMAP.md:155-158`) **Write, confirm, return.** A write is
  acknowledged only after it is done and confirmed. This RAISES the bar over
  `v3.7.12`, where `planning-files.mjs:2747` deliberately has no fsync and
  the promise is only "never torn". Cost is irrelevant at cadence's write
  rates.
- (`.planning/ROADMAP.md:29-41`) **The model thinking and working** - PLAN,
  CONTEXT, SUMMARY, REVIEW, UAT. Authored prose, read back by humans and
  models. Markdown is correct here and stays. The governing principle for the
  boundary, settled 2026-09-06: **user-facing is what a person reads or acts
  on, not what produces it.**
- (`.planning/ROADMAP.md:64-68`) **Cross-session concurrency**, stated
  plainly rather than half-supported. John's habit is one writer plus
  read-only sessions, so exclusivity is owed on WRITES only and is satisfied
  by construction (phase 3). Do not propose a refuse-to-start guard; it would
  block the readers he actually uses.
- (`.planning/ROADMAP.md:176-183`) **Test what is testable, acknowledge the
  rest, rely on live usage.** Anything with a model in the loop is
  acknowledged as untested rather than scaffolded around. **Write down what
  is knowingly untested.**

## Observations

None at this phase. Nothing this phase builds can be run live until the
binary is installed; the owner's live-host observation for it is held by
phase 18, the acceptance gate (moved 2026-09-11, see
docs/architecture/acceptance.md).

## Flagged assumptions

- Phase 27's plan record keeps the `## Evidence map` section as opaque bytes
  under the content revision (`crates/cadence/src/plan/persistence.rs`,
  `digest` over the rendered bytes) and the validator compares the whole
  proposed snapshot to the contribution; extending the approved payload is
  real work in the plan modules, not a service-only change.
- The existing `crates/cadence/src/evidence/` records are routing facts
  (gates, answers, overrides) and are not the acceptance map; this phase
  adds its own namespace and never repurposes them.
- The design's record sketch reads as one association per item; the three
  hand-written maps share O1 across two truths and across two plans. D-93
  resolves that in favour of explicit multiple associations; the design
  text is not amended in this phase.
- No code at HEAD types an evidence item, attaches one to a truth, computes
  coverage or checks a version; every truth here is new production work on
  the phase 11 and 27 seams.
