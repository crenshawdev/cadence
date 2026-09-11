# Phase 27: Plan persistence and allocation - Context

Written 2026-09-10 under `docs/architecture/acceptance.md`. Phase 27 was parked
from the original phase 11 on 2026-09-09 as candidates T31-T37. It runs now,
before phases 28, 29, 12 and 13, because the owner accepted on 2026-09-10 the
delivery order 27, 28, 29, 12, 13 (`.planning/ROADMAP.md`, "Delivery order is
not phase number"): the evidence map phase 28 attaches lives in a saved plan,
and both execution and verification consume that map. Research draft:
`.codex-analysis/phase-27-context-draft.md` (gitignored), read against HEAD
`f34b32bb`. Feeds: /cad-plan 27 (planner dispatch carries the design's
Planner block).

## Scope boundary

In: a plan is published through the binary at a safe, distinct identity, on
the owner's approval of the exact submission, and nothing touches disk
before that approval. The binary refuses a submission whose identity differs
from its publication target, refuses a path outside the bound phase,
allocates plan numbers inside the publication transaction so a retry cannot
double-allocate, returns the original identity on replay, and refuses to
replace an existing plan without the owner's authorization. The published
file is `.planning/phases/<N>/PLAN-<k>.md`, authored Markdown, written by the
binary as a transaction participant the way phase 11 writes CONTEXT.md.

Out: the evidence map as typed items and their attachment to truths (phase
28); the check and link refusals (29); task-to-check bindings, red/green
receipts and the execution of native plans (12); verdicts and status (13);
the review handoff and selected plan edits (30); truth revision (26); the
PROJECT, REQUIREMENTS and ROADMAP writers (22). A native plan published in
this phase is authoring-only: readable and addressable, and mechanically not
execution-ready until 28, 29 and 12 land (D-88).

## Truths

At most seven. Each is one trigger, one observer, one outcome. The planner
writes exactly one check per truth. Approved by the owner 2026-09-10.

- T1. When the owner approves a valid plan submission, the owner sees its
  approved content at the returned phase and plan identity.
- T2. When a plan submission names an identity different from its
  publication target, the caller is refused persistence with the mismatch
  identified.
- T3. When a plan submission targets a path outside its bound phase, the
  caller is refused persistence at that path.
- T4. When the owner publishes multiple plans for one phase, the owner sees
  distinct plan identities in ascending plan-number order.
- T5. When gap planning publishes an additional plan, the owner sees that
  plan at a previously unused identity beside the phase's existing plans.
- T6. When a caller retries an acknowledged plan-allocation request, the
  caller gets the originally allocated plan identity.
- T7. When a plan replacement lacks owner authorization, the caller is
  refused replacement of the existing plan.

All seven are properties over any submission of the stated kind. Expected
values are the handwritten submission and the identity rules in D-82 and
D-85, read back from the reopened filesystem and store after the server
exits; an in-memory plan or a renderer's own output is not the oracle.

## Decisions settled with the owner 2026-09-10

Each is the owner's ruling on an open question from the research draft. The
draft's evidence for every option is at the section named.

- D-80 (Planning needs approved truths; draft O1, the decision the roadmap
  assigns to this phase): read-only plan intake and research may run for a
  phase without approved truths, but publishing a native plan is refused
  until the phase has native approved truths in the store. A hand-written
  CONTEXT.md is not native approval. The refusal leads to context
  authoring; the planner never invents locked truths. The binary rechecks
  the prerequisite at publication against the bound phase; phase 11's
  intake does not perform this membership check, so this phase adds it.
  If wrong: a plan lands for a phase whose truths were never approved, and
  phase 28 has nothing to attach its map to.
- D-81 (Native filename and schema; draft O2): a native publication writes
  `PLAN-<k>.md` with a positive-integer phase and a positive-integer `k`
  without leading zeros, in the strict frontmatter schema the Rust execution
  reader already enforces (`crates/cadence/src/execution/plan.rs`,
  `deny_unknown_fields`); the record holds typed structural fields plus the
  preserved authored body, the identity is rendered from the approved
  allocation, and publication round-trips through the native reader before
  it is acknowledged. No new bare `PLAN.md` is written. Existing files,
  including bare `PLAN.md` and decimal-phase files, stay readable inputs
  and occupied identities; they are never renamed, rewritten or executed by
  this phase. Approval, revision and map metadata never go into
  frontmatter; they live in the native record. This is a parity break with
  the frozen parser's flat-list grammar, accepted by the owner. If wrong: a
  legacy plan is silently rewritten, or a native plan carries fields the
  reader refuses.
- D-82 (What the evidence map is in this phase; draft O3): an authored
  `## Evidence map` section in the plan body is preserved as opaque bytes
  under the plan's content revision. No typed evidence items, associations
  or validity claim are created; phase 28 owns those and publishes its
  rendered map through this same mechanism. This phase exposes a stable plan
  identity plus a content revision or digest so phase 28 can refuse
  attachment to a different publication. Absent map data never means
  execution-ready. If wrong: two writers own the map section.
- D-83 (Initial plan approval; draft O4): approval is phase 11's
  exact-submission mechanism with a plan-specific payload - an identified
  owner, a caller-reported time, and the exact content and proposed
  identities being approved - checked before `first_touch` and before any
  writer request. A changed allocation needs a fresh preview and approval.
  Truth attestations are not repeated for plan prose; no external reviewer
  approval is a prerequisite in this phase. Missing or declined approval
  stays a non-persisted draft. If wrong: a plan is published from a preview
  the owner never saw.
- D-84 (Replacement authorization; draft O5): replacing an unexecuted plan
  in place needs an approval that names the target, the observed old
  revision or bytes, and the proposed new content; stale old bytes
  invalidate it. Authorization is never inferred from the original approval,
  gap mode, checker success or a general permission to plan. A plan already
  admitted to execution is never replaced in place; additional work gets a
  new gap identity, and reconciling execution history is phase 12. An alias
  that resolves to an occupied identity is refused even when the proposed
  filename is absent. Publication history is retained across a replacement.
  If wrong: an executed plan's record changes under its commits.
- D-85 (Allocation; draft O6): plan numbers are a monotonic high-water mark
  per phase occurrence, seeded conservatively from the files on disk and
  every known consumed identity, never recycled. One approved publication
  transaction allocates and stores its plans in the approved order. A
  read-only preview may propose numbers and is not a reservation; if another
  write consumes a proposed number the stale preview is refused and the
  changed identity goes back for approval. No reservation-only drafts and
  no expiry machinery. Number exhaustion is refused, never wrapped. If
  wrong: two plans share a number, or a retry lands a second copy.
- D-86 (Replay; draft O7): a replay is identified by a durable caller
  request id scoped to the plan's phase occurrence, bound to the exact
  approved payload digest and the ordered assigned identities and
  revisions. Same id with a different payload is refused. The saved result
  is read before any number is chosen or a stale-preview precondition is
  tested. A replay returns the historical allocation and original
  publication revision; it never restores old content over a newer
  authorized revision, and if the current projection is missing or drifted
  it reports that state rather than claiming the bytes are installed or
  allocating a replacement number. The existing `Snapshot.operations` map
  holds only operation id to fingerprint, so the allocation result record
  is new. If wrong: a host retry double-allocates or resurrects old bytes.
- D-87 (Identity lifetime and legacy numbers; draft O8): a native plan
  record and its request receipts are bound to an explicit phase occurrence
  within the project cycle, addressed visibly as (phase, plan number). A
  mutable plan-set digest is not the owner identity. Legacy numbers on disk,
  in reports and in native execution records are reserved as occupied
  without claiming their Markdown was owner-approved; a bare `PLAN.md`
  reserves 1. Ambiguous aliases or conflicting frontmatter are refused for
  explicit resolution. Evidence of a consumed number survives deletion of
  its file. If the lifetime is narrowed to the active cycle, that is stated
  and cycle migration is deferred, never a silent counter reset. If wrong:
  a phase that recurs across milestones reuses a number.
- D-88 (Activation; draft O9): this phase exposes authoring-only
  publication and readback with explicit provisional readiness, and a
  mechanical check prevents a new native publication from being treated as
  acceptance-ready or dispatched by `execute-next` until phases 28, 29 and
  12 land. A warning in instructions alone is not that check; the planner
  names the concrete admission check. Legacy execution behaviour stays
  separately identified. Gap publication preserves prior history; changing
  the admitted execution set is phase 12. If wrong: the executor dispatches
  a plan whose map was never validated.
- D-89 (Colliding approvals; draft O10): concurrent approved requests go
  through the existing store queue, filesystem ownership and conditional
  transaction, and the loser gets a precise conflict naming the changed
  target or precondition, then re-previews for fresh approval. No automatic
  reallocation, no refuse-to-start guard for readers, no new writer and no
  cross-session authoring service. A read-only query never acquires a
  writer to list or preview plans. If wrong: a collision silently retargets
  an approved plan.

## Durable decisions that bind this phase

Carried verbatim from ROADMAP.md at `f34b32bb` except where marked.

- (`.planning/ROADMAP.md`, "### Phase 27") **Goal.** Plans are stored at
  safe, distinct identities; a mismatched identity or an out-of-phase path
  is refused; number allocation is a transaction that a retry cannot
  double-allocate; replacement needs owner authorization. Parked from phase
  11 on 2026-09-09 (candidates T31-T37). Whether `/cad-plan` may run without
  approved truths is decided here.
- (`.planning/ROADMAP.md`, "Delivery order is not phase number") the order
  after phase 11 is 27, 28, 29, 12, 13; numbers are identities, not
  sequence; nothing is renumbered.
- (`docs/architecture/acceptance.md`, "Layer 2: The evidence map") the
  binary stores the map and the plan shows it. In this phase the shown
  section is opaque (D-82); the stored typed map is phase 28.
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

- Phase 11's context persistence is a vertical pattern, not a document
  service: the transaction admits one context participant
  (`crates/cadence/src/store/writer.rs`, `ContextPublication`), maps
  `phase-context:<N>` to one canonical path
  (`crates/cadence/src/store/filesystem.rs`), and hashes the approved
  context for an operation id. Publishing several plan files in one
  approval needs an explicitly scoped plan participant, not writable paths.
- The store already has filesystem ownership and a queued writer
  (`crates/cadence/src/store/filesystem.rs`, `crates/cadence/src/store/writer.rs`);
  the older draft's claim that no locking exists is false, and D-89 reuses
  what is there.
- The native execution reader keys an occurrence by phase string and binds
  a mutable plan-set fingerprint
  (`crates/cadence/src/execution_service.rs`); D-87 and D-88 must not
  borrow that fingerprint as the plan's identity or as execution readiness.
- No code at HEAD writes a plan, allocates a number or records an
  allocation result; every truth here is new production work on the
  phase 11 seams.
