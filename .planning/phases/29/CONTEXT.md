# Phase 29: Check and link limits - Context

Written 2026-09-10 under `docs/architecture/acceptance.md`. Phase 29 was
parked from the original phase 11 on 2026-09-09 as candidates T43-T46. It runs
now, after phase 28 and before 12 and 13, under the delivery order the owner
accepted 2026-09-10 (`.planning/ROADMAP.md`, "Delivery order is not phase
number"): phase 28 supplies the typed items and their associations; this
phase completes the planning refusals in the design's "The four refusal
points, together" so that the map phase 12 binds tasks to and phase 13 judges
is one the planner was allowed to publish. Layer 2 of the acceptance design
is complete only when this lands. Research draft:
`.codex-analysis/phase-29-context-draft.md` (gitignored), read against HEAD
`2da6d1af`. Feeds: /cad-plan 29 (planner dispatch carries the design's
Planner block).

## Scope boundary

In: a check whose command is missing or blank is refused with that check
identified; a check whose expected output is missing or blank is refused
with that check identified; a current truth that would end up with two
distinct checks across the phase's current plan contributions is refused
with the truth and the conflicting checks identified; a link whose value the
associated approved truth does not name is refused with that link
identified. Each refusal fires at the complete preview and at approved
publication, validated against the snapshot the publication transaction
commits, on the post-replacement current union, exactly as phase 28's
refusals do. The compiled planner instructions and the rendered skill say
what the binary now refuses and why.

Credited to phase 28, not re-truthed here: a check or link field that is
missing or wrongly typed is already refused at decode; every current truth
already needs at least one check phase-wide on the post-replacement union
(`crates/cadence/src/plan/associations.rs:152`, which says in its own words
that phase 29 owns the distinct-check upper bound); membership, version
equality, duplicate item ids, conflicting shared definitions and
authoritative readback are phase 28's truths. What phase 28 leaves: a blank
command or expectation passes, a decode failure does not identify the check,
two distinct checks on one truth are not refused, and a link's value is never
compared to its truth.

Out: whether a command selects exactly one test (parked; see "Parked"
below); task-to-check bindings, red/green receipts and the no-stub-of-the-
subject gate (12); verdicts, status derivation, the concerns cap and waivers
(13); revising a truth so a link can match it (26); the review handoff and
selected edits (30). Nothing in this phase makes a native plan
execution-ready; D-88's admission refusal stands. Passing these limits is
permission to publish, never proof that a check proves its truth or that a
handoff is real; the design gives that inspection to the verifier ("Inspects
every evidence item for real ... an item whose spec could not have failed is
marked rejected, not passed").

## Truths

At most seven. Each is one trigger, one observer, one outcome. The planner
writes exactly one check per truth. Approved by the owner 2026-09-10.

- T1. When a submitted check has no command, the caller is refused the map
  with that check identified.
- T2. When a submitted check has no expected output, the caller is refused
  the map with that check identified.
- T3. When a proposed map leaves a current truth with two distinct checks
  across the phase's current plan contributions, the caller is refused the
  map with that truth and both checks identified.
- T4. When a submitted link names a value absent from an associated current
  truth, the caller is refused the map with that link identified.

All four are properties over any submission of the stated kind. "No
command" and "no expected output" in T1 and T2 cover a missing, null,
wrongly shaped, empty or whitespace-only value. Expected values are the
handwritten submission, the truth records phase 11 stored with their
approved slots, and the plan identity and revision phase 27 returned, read
back from the reopened filesystem and store after the server exits; a
renderer's own output is not the oracle. A refusal leaves the installed
winner, the retained receipts and the saved maps byte-identical.

## Parked

- A check whose command does not select exactly one test. There is no fixed
  oracle for an arbitrary command string without running it: a string that
  looks like a test invocation can select zero tests, several, or a wrapper
  that runs the whole suite, and "narrowest" also depends on what settles
  the truth. The Planner block's "one test, one binary - never the whole
  suite" stays an instruction the planner obeys and the verifier checks by
  running the command; it is not a planning-time gate. A constrained runner
  grammar could make a syntactic version decidable later, and that would be
  its own decision with its own truth.

## Decisions settled with the owner 2026-09-10

Each is the owner's ruling on an open question from the research draft. The
draft's evidence for every option is at the section named.

- D-99 (What an expected output minimally is; draft O1): a check's expected
  output is either a literal or a property, in the tagged shape phase 28
  already stores, and its value must contain at least one non-whitespace
  character. An empty or whitespace-only value is a missing expected output
  and T2 refuses it. An expectation that a command prints nothing is written
  as a nonblank property such as "stdout is empty and the exit status is
  zero"; a blank value is never read as an implicit expectation of silence.
  A property is authored text retained for the verifier to inspect; the
  binary evaluates no predicate language and infers no strength from any
  nonblank string. If wrong: a literal-only rule rejects the design's own
  properties, and a blank-tolerant rule leaves a check with no oracle.
- D-100 (Whether command shape is validated; draft O2): a command is
  validated as nonblank text and nothing more. Missing, null, wrongly typed,
  empty and whitespace-only commands are all refused with the check
  identified; any nonblank string is accepted at planning time. The binary
  does not recognise runners, parse invocations, check that a test file
  exists or run anything. Guessing a runner grammar would reject legitimate
  wrappers, custom binaries and other languages, and a shape that looks
  right proves nothing about what the command selects. The narrow-command
  instruction stays in the compiled planner text. If wrong: a vacuous or
  broad command is published and only the verifier catches it, which is the
  design's stated division of labour anyway.
- D-101 (How link necessity is decided; draft O3): "names the value" is a
  stated lexical rule over the associated truth's approved slots, and the
  context says plainly that this is weaker than semantic necessity. The
  binary loads the current native context from the same committing
  snapshot, resolves each association by full truth id and version, and
  takes that truth's approved trigger, observer and outcome from the retained
  submission (`crates/cadence/src/context/model.rs:94`); it never parses the
  rendered sentence, never reads the plan's prose, and never trusts a copy of
  the truth the caller supplies. The link's value, with its outer whitespace
  trimmed for comparison only, must occur as a contiguous exact phrase inside
  one individual slot: case-sensitive, exact internal whitespace and
  punctuation, no stemming, folding, synonyms or pronoun resolution, and
  where the value begins or ends with a letter, digit or underscore the
  match must not sit inside a longer such run (so `parcel` is named by "the
  sender sends the parcel", `arc` is not). Slots are never joined, so a
  phrase cannot match across two of them; ids, reasons, other truths and
  titles are never searched. Every associated truth is checked; one truth
  naming the value does not carry an association to a truth that does not.
  A link's caller, callee and value must each be nonblank. A link the binary
  cannot classify, because the approved slots cannot be resolved from the
  snapshot, is refused for attached publication with a located diagnostic
  that says so; it is never treated as unnecessary and never silently
  accepted. A matched value is permission to publish the link for later
  tracing, not proof of the handoff. If wrong: a synonym or a transformed
  value is refused although a person sees the relation, and the fix is to
  name the value the truth uses, or to revise the truth under phase 26,
  never to weaken the rule silently.
- D-102 (Where and when the refusals fire; draft O4): T1 to T4 fire at the
  complete preview and at approved publication or replacement, and the
  domain validation runs against the snapshot the publication transaction
  commits, never a pre-approval lookup that can go stale (D-98). Malformed
  check and link content gets the same located public diagnostic at both
  entrypoints, which means the preview path must stop discarding decode
  detail (`crates/cadence/src/server.rs:633`) and both paths must identify
  the item by its id and the field by its JSON path. The existing candidate
  and contribute seams and the transaction's revalidation are reused; no
  service-only gate and no reliance on an earlier preview result. An
  allocation-only read and an unapproved submit draft are not validated maps
  and are not tightened here. A concurrent winner may still yield the
  existing stale-snapshot conflict before a content refusal; it never lets an
  invalid union publish. If wrong: a preview says yes and the publication
  says no, or a stale preview authorises a bad map.
- D-103 (What the second-check refusal identifies; draft O5): the refusal
  names the truth by full id and current version and every distinct check
  attached to it, each with its plan origin, in a stable order, and it says
  which of them is a saved contribution and which the submission proposes.
  Two is the minimum; more are all listed. Distinctness is by item id: two
  checks with identical commands and specs under different ids are two
  checks, and repeated aliases of one shared definition are one. The
  existing diagnostic carries one id and one slot
  (`crates/cadence/src/plan/model.rs:154`); how the full set travels
  (structured detail beside the standard reason) is the planner's to shape,
  and no second-id field is pretended to exist. If wrong: the caller hunts
  across plans for the other check, or an order-dependent "second" blames a
  saved check arbitrarily.
- D-104 (What is credited to phase 28; draft O6): phase 28 is credited with
  structural decoding of required typed fields, the phase-wide at-least-one-
  check lower bound, membership, version equality, duplicate-id and shared-
  definition rules, and the transaction and readback seams. Phase 29 owns
  blank-content refusals with the check identified (T1, T2), the distinct-
  check upper bound (T3) and link content (T4). D-90's "exactly one check" is
  met only once both bounds hold, and this context does not reopen D-90. If
  wrong: an absent upper bound is claimed delivered, or 28's work is
  re-truthed and the acceptance inflates.
- D-105 (How the new limits meet saved maps, history and replay; draft O7):
  the new validation runs on the post-replacement current union for every
  fresh attached submission. A saved current map with a blank check, a
  second distinct check or an unnamed link value cannot silently validate a
  new attached publication; the owner corrects every offending contribution
  in one approved replacement batch (D-84, D-97). No saved record is
  rewritten, no history is dropped, and a replay of an old receipt stays a
  historical acknowledgment of what committed, not a certification under
  the new policy (D-86, D-98). Readback acquires no writer and mutates
  nothing. Explicitly provisional mapless authoring stays as D-97 left it,
  and phase 12's admission must validate the complete required contract
  rather than infer it from "published". If wrong: an invalid map is handed
  to phase 12 by grandfathering, or exact approval is violated by a rewrite.
- D-106 (Which check fields are content-checked; draft O8): only the
  command and the expected output are content-checked in this phase. Test
  locator, setup, call, boundary and fakes keep the typed shape phase 28
  requires and no nonblank or semantic rule is added to them; an honest "no
  setup" is not forced into filler. Whether a check stubs its own subject or
  whether the named test exists is phase 12's, and whether the assertion is
  adequate is the verifier's. If wrong: structural strings get sold as proof
  of test quality, or red-first development is obstructed by a test-exists
  gate at planning time.

## Durable decisions that bind this phase

Carried verbatim from ROADMAP.md at `2da6d1af` except where marked.

- (`.planning/ROADMAP.md`, "### Phase 29") **Goal.** A check without a
  command or expected output, a second check on one truth, and a link its
  truth does not need are refused. Parked from phase 11 on 2026-09-09
  (candidates T43-T46). Consumes phase 28's map and completes the planning
  refusals before acceptance-aware execution (phase 12) is activated; the
  one-check limit is phase-wide across plans. Layer 2 of the acceptance
  design is complete only when this lands; it is not a prerequisite of
  status derivation itself.
- (`docs/architecture/acceptance.md`, "The four refusal points, together")
  when the evidence map is planned the binary refuses: truth with no item;
  item with no truth; check without command and output; link its truth does
  not need. The first two are phase 28; the last two are this phase, with
  the one-check limit from the Planner block ("do not write a second check
  for a truth").
- (`docs/architecture/acceptance.md`, "Layer 2: The evidence map") a link is
  "A hands B this value", kept "ONLY where a truth depends on the handoff,
  never per call site"; the Planner block: "Add a link only where the truth
  itself names a value crossing between two things."
- (`docs/architecture/acceptance.md`, "Verify: a decision, not a count") the
  verifier "Inspects every evidence item for real. Opens the artifact. Runs
  the check. Traces the link. Records the observation," and "a passing grade
  on a weak assertion is worse than useless, so an item whose spec could not
  have failed is marked rejected, not passed". The planning refusals "read
  records, they do not rerun tests". This is the line between what this
  phase decides and what it leaves to the verifier.
- (`.planning/phases/28/CONTEXT.md`) D-90 to D-98 bind as written: a check
  is always required and an observation is supplementary; the map publishes
  with the plan in one exact approval; item ids are opaque; coverage is on
  the post-replacement union; associations compare to the current native
  truth; readback is the authoritative view; map versions are immutable and
  superseded on republication; the payload is bound to the request receipt
  and validated on the committing snapshot.
- (`.planning/phases/27/CONTEXT.md`) D-82, D-83, D-84, D-86 and D-88 bind as
  written; (`.planning/phases/11/CONTEXT.md`) D-79 binds: the binary refuses
  structure, count and identity, and the owner attests observability and the
  fixed oracle per truth. D-101 is the same kind of honesty about a link.
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

Evidence a person must see; these cap a truth at `concerns`, never `met`.

- O1. The owner runs `/cad-plan` for a real phase in a real host, sees the
  planner submit a map in which one check has a blank expected output and
  one link names a value its truth does not use, sees each come back as a
  typed refusal in the conversation naming the item, and sees the corrected
  plan land with its map attached. Whether the planner writes a good check
  after the refusal is the model's and is not asserted.

## Flagged assumptions

- Phase 28's decode refusal on `plan-submit` and the generic `arguments`
  refusal on preview both lose the item's identity
  (`crates/cadence/src/plan_service.rs:118`, `crates/cadence/src/server.rs:633`);
  giving T1 and T2 their "with that check identified" outcome is real work on
  both public paths, not a validator added after decode.
- The approved truth slots survive in `ApprovedContext.submission.truths`
  beside the derived `Truth` record, which itself has only id, version,
  pattern, text, kind and status (`crates/cadence/src/context/model.rs:83`,
  `:94`); D-101 reads the slots from there and needs no phase 26 operation.
- No hand-written map in this repo contains a link item; the only link at
  HEAD is the phase 28 fixture's `parcel` link
  (`crates/cadence/tests/phase28_evidence.rs:600`). T4's check therefore
  authors its own truths and links; the four existing plans are not its
  oracle.
- No code at HEAD compares a link value to a truth, counts distinct checks
  per truth, or rejects a blank command or expectation; every truth here is
  new production work on the phase 28 seams.
