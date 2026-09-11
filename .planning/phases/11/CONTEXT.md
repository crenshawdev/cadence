# Phase 11: First approved context - Context

Written 2026-09-09 under `docs/architecture/acceptance.md`. The roadmap's
original phase 11, "Planning intake", overflowed the seven-truth cap: the
research draft found fifty candidate truths across ten slices
(`.codex-analysis/phase-11-context-draft.md`, gitignored). Under the owner's
"slow add" rule the first slice is this phase and the other nine are parked
as phases 22-30, in dependency order, at the end of ROADMAP.md.
Feeds: /cad-plan 11 (planner dispatch carries the design's Planner block).

## Scope boundary

In: a phase's truths are authored through the binary and persisted only on
the owner's approval. The binary takes each truth as typed slots - trigger,
observer, verb, outcome, kind - renders the one sentence, refuses the
structural faults it can decide, refuses a set over seven, refuses identity
collisions among truths and decisions, and writes the approved set together
with the phase's decisions into `.planning/phases/<N>/CONTEXT.md`. Nothing
touches disk before approval. This is the acceptance subsystem's first layer
(`docs/architecture/acceptance.md`, "Layer 1: Truths"), the one we simulate
today by hand with `~/.claude/hooks/rules-gate.mjs` and pasted role blocks.

Out, parked 2026-09-09: the PROJECT, REQUIREMENTS and ROADMAP document
writers (phase 22); initialize and adopt (23); adding and editing phases
(24); insert, remove and the GH-259 repair (25); context revision, truth
versions and the requirement-correction write (26); plan persistence and
number allocation (27); evidence-map attachment (28); check and link refusals
(29); the plan-review handoff and selected edits (30). Truth versions are
phase 26, so this phase persists version 1 only. The evidence map, "one check
per truth", is layer 2 and is phases 28 and 29, not this one.

## Truths

At most seven. Each is one trigger, one observer, one outcome. The planner
writes exactly one check per truth. Approved by the owner 2026-09-09.

- T1. When the owner approves a valid context submission, the owner sees its
  truths and decisions together in the phase's CONTEXT.md.
- T2. When a submitted truth violates the required sentence shape, the caller
  is refused authoring with the broken rule and slot identified.
- T3. When a submitted truth makes its outcome an implementation internal,
  the caller is refused authoring as unobservable.
- T4. When a submitted truth depends on a model-generated expected answer,
  the caller is refused authoring for a prose oracle.
- T5. When the owner submits eight truths for one phase, the owner is refused
  authoring with "split the phase".
- T6. When a context submission reuses an identity within its identity scope,
  the caller is refused authoring with the collision identified.
- T7. When context authoring ends without owner approval, the owner sees the
  prior persisted context unchanged.

T1, T7 and the refusals are properties over any submission of the stated
kind; T5 is literal. For T3 and T4 the refusal is the owner's, on record: see
D-79.

## Durable decisions that bind this phase

Carried verbatim from ROADMAP.md at `603c7e6b` except where marked.

- D-79 (How a truth is submitted, settled with the owner 2026-09-09): a truth
  is submitted as typed slots - trigger, observer, verb (`sees`, `gets`,
  `is refused`), outcome, kind (`literal` or `property`) - and the binary
  renders the one sentence. The binary refuses, mechanically: a trigger
  containing " or ", an observer naming more than one party, a verb outside
  the three, an empty slot, more than seven truths, and a truth or decision
  identity already used in its scope. The internal-name refusal (T3) and the
  prose-oracle refusal (T4) cannot be decided by code without false
  positives, so each truth carries two owner attestations, `observable` and
  `fixed_oracle`, and the binary refuses a truth whose attestation is absent
  or `false`, naming the rule; the approval record holds who attested and
  when. This is weaker than the roadmap sentence "the binary refuses a set
  that ... names no observer, rests on model prose"; the roadmap phase-11
  text is amended in the same commit to say so. If wrong: a truth naming a
  struct passes on a checkbox, and the verifier finds it only at the check.
- (`.planning/ROADMAP.md:884-889`) **Truths are refused at authoring, never
  audited later.** A malformed truth comes back as a typed refusal naming the
  rule it broke and the slot it is missing, in the same envelope as every
  other answer, and nothing is persisted until the owner approves the set. An
  item that needs a person or a live system is an `observation` in the
  evidence map, visible, never routed out of sight; the frozen tree's
  `(human-verify: ...)` tag is not reintroduced.
- (`.planning/ROADMAP.md:832-844`, the part this phase owns) `cad-context`
  authors the phase's truths with the owner - at most seven, each "When
  <trigger>, <observer> sees / gets / is refused <outcome>" - and the binary
  refuses a set that is not in that shape or exceeds seven. Every instruction
  these roles see is compiled into the binary; the `.md` Claude Code requires
  is rendered from it; there is no user override.
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
- (`docs/architecture/acceptance.md`, "The record") `truth { id, phase,
  version, pattern, text, kind: literal | property, status: pending | met |
  concerns | unmet | waived }`. JSON in the store, like every other 4.0
  record. This phase writes version 1; bumping is phase 26.

## Observations

None at this phase. Nothing this phase builds can be run live until the
binary is installed; the owner's live-host observation for it is held by
phase 18, the acceptance gate (moved 2026-09-11, see
docs/architecture/acceptance.md).

## Flagged assumptions

- CONTEXT.md is not an input to cursor derivation
  (`crates/cadence/src/derivation/model.rs:112-128`, per the research
  draft); the frozen skill set `Status: context` in STATE by hand. This
  phase does not add a derivation source; the planner records the gap as a
  deviation if a truth needs it rather than widening scope.
- The store's transaction participants do not include CONTEXT.md
  (`crates/cadence/src/store/transaction.rs:151-180`); adding one document
  participant is in scope, a general document layer is phase 22.
- The frozen `context.md` workflow makes CONTEXT optional before planning
  (`cadence-core/workflows/context.md:410-411`); whether `/cad-plan` may run
  without approved truths is phase 27's question, not this one's.
