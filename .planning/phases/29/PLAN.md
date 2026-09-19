---
phase: 29
plan: 1
requirements: [T1, T2, T3, T4]
files:
  - crates/cadence/src/plan/mod.rs
  - crates/cadence/src/plan/limits.rs
  - crates/cadence/src/plan/model.rs
  - crates/cadence/src/plan/associations.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/plan_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/plan/instructions.rs
  - crates/cadence/tests/phase29_limits.rs
  - skills/cad-plan/SKILL.md
---

# Phase 29: Check and link limits - Plan

## Goal

A check without a command or expected output, a second check on one truth,
and a link its truth does not need are refused. The one-check limit is
phase-wide across plans; this completes Layer 2's planning refusals before
acceptance-aware execution in phase 12.

## Must be true when done

- T1. When a submitted check has no command, the caller is refused the map
  with that check identified.
- T2. When a submitted check has no expected output, the caller is refused
  the map with that check identified.
- T3. When a proposed map leaves a current truth with two distinct checks
  across the phase's current plan contributions, the caller is refused the
  map with that truth and both checks identified.
- T4. When a submitted link names a value absent from an associated current
  truth, the caller is refused the map with that link identified.

## Context

D-99 through D-106 and every carried decision in CONTEXT.md bind this plan.
Extend phase 28's `candidate`, `validate`, `validate_candidate` and `contribute`; preserve exact approval and conditional publication.
Read native current truth identities and approved slots from the same snapshot's retained context, never Markdown.
Phase 28 owns structural types, membership, versions, identity conflicts, the check lower bound and saved-map readback.
Phase 12 owns task/check bindings, red/green receipt gates, subject-stub refusal and execution activation; D-88 remains enforced.

## Evidence map

These items attach to the four owner-approved truths above, specification
approved 2026-09-10 in `.planning/phases/29/CONTEXT.md`, inspected at
`b353f09dba50db20992bd39ae52b0b331168d2f0`. This handwritten implementation
plan is not a native context or publication. At native publication obtain the
full ids and numeric versions from that occurrence's actual approved records;
never derive a version from a heading, date, item name or observation source.

All four checks are new functions in
`crates/cadence/tests/phase29_limits.rs`. The names below are creation
specifications, not claims that those functions exist. Each truth has exactly
one check; its cases and controls stay inside that function. Shared helpers
are not additional attributed tests. No link evidence items belong in this
implementation map: none of T1-T4 names a particular value handed between two
things. Links submitted inside C4 are caller data, not additional evidence.

### Common setup, public calls and durable oracle

Adapt the real `Client`, `approve`, `fixture`, `native_context`, `snapshot`,
`tree`, `reopened`, `proposal`, `preview` and `replacement` patterns in
`crates/cadence/tests/phase28_evidence.rs`; do not import its attributed tests.
Its `native_context` hard-codes parcel slots: this phase's helper must instead
accept the handwritten slots needed by each case. Use actual temporary
projects with their own ROADMAP/configuration, empty `CADENCE_GLOBAL_CONFIG`,
and `CARGO_BIN_EXE_cadence serve --project-root <project>` over initialized
stdio MCP. Approve truths through real `cadence_apply` / `context-submit`
before publishing any plan. Inspect those stored version-1 truth records and
their retained approved trigger/observer/outcome against the handwritten
submission after the setup server exits.

Allocate through `cadence_query` / `plan-read`. For each refused case, start
from an installed, valid native plan and retain its exact approved request,
returned identity/revision, receipts and map records. Exercise BOTH complete
`plan-read` preview and independently approved `cadence_apply` / `plan-submit`
publication, including explicitly authorized replacement. A failed preview
must not prevent the test from calling publication. Hand-assemble the latter's
canonical Evidence map section using the known phase-28 JSON section grammar
and the caller's map; copy the complete submission into its approval and the
new content into replacement consent. Do not call production rendering or
validation to manufacture expected results. The submission must otherwise be
publishable: no unrelated stale basis, mismatched section, duplicate id or
missing replacement approval may mask the rule being checked.

Stop and reap the server after EACH refused preview and after EACH refused
publication. Reopen the installed PLAN and the full `.planning` tree, including
`state.json`, `items.jsonl` and `decisions.jsonl`; compare bytes to the baseline
taken after the last successful publication, before the refused call. Parse
the actual snapshot with `Snapshot::parse`, assert journal absence before
opening a real `Filesystem` / `Store`, then read `Operation::ReadVerified`.
Compare installed winner, occurrence/publication records, retained receipts,
saved map revisions and JSONL bytes, not merely item counts or a response's
`persisted` field. Refusal creates no new receipt, map revision or allocation.
Check again that reopening did not change the tree. Successful controls use
complete preview and exact approval, exit/reopen, then compare handwritten
specs/associations and original strings with retained records at the returned
identity/revision. A fresh server reads them through `evidence-read`; readback
and replay leave their baseline bytes unchanged.

The public decoder, resident, service, native context authority, candidate
union, queue, conditional transaction, journal, store and filesystem remain
real in every check. Nothing beyond the clock and caller inputs may be faked.
No direct store seeding, fake publication, synthetic approved truth revision,
model oracle or captured fixture is used. Real competing callers may alter
state only through approved public operations. Handwritten expectations plus
the approved setup records and returned plan identities/revisions are the
oracle; the renderer's output is not. Each command below must select exactly
one test and report `1 passed; 0 failed`; zero selected tests is failure.

### T1

- **P29-T1-C — check.** File `crates/cadence/tests/phase29_limits.rs`, function
  `phase29_check_without_command_is_refused`.
  Setup: one native current truth with an opaque full id, a saved winner with
  its single check, then otherwise valid replacements of that contribution.
  Vary only the identified check's `spec.command`: omitted, null, boolean,
  number, object, array, empty string, spaces, tabs/newlines and Unicode
  whitespace. Include an offending check in a nonzero plan/item position in
  an otherwise covered batch so location is not accidentally hard-coded.
  Call: both public paths using the common protocol.
  Expected property: `status: refused`, `code: invalid-plan`, rule
  `check-command`, the full check id, bound phase, submission entry and exact
  `submission.plans[i].content.evidence_map.items[j].spec.command` slot on
  BOTH paths, with all reopened durable bytes unchanged.
  Controls publish a nonblank custom command that has no executable/test file
  in the fixture, a broad command string and a command containing surrounding
  whitespace. They are retained verbatim and never executed during planning.
  Include a command that would create a sentinel if executed and assert that
  no sentinel appears. The test's own Verify remains narrow. With a valid command/expectation,
  blank test locator/setup/call/boundary strings and an empty fakes array are
  structurally valid controls, preserving D-106. A well-typed blank-command
  unapproved draft remains `persisted: false`, `validation: draft`; an
  allocation-only read is still just a read.
  Boundary real: public operations, store and filesystem as above; fakes only
  clock/caller inputs. Command:
  `cargo test -p cadence --test phase29_limits phase29_check_without_command_is_refused -- --exact`.
  Expected command result: one passing test asserting that property.
  Item reason: losing the raw item location or accepting blank text hides the
  commandless check. Association reason for T1: this causes its trigger and
  checks its identified refusal without changing the winner.
- **P29-T1-A — artifact.** New `crates/cadence/src/plan/limits.rs`,
  `plan/mod.rs`, `plan/associations.rs` at `validate`, `plan_service.rs` at
  `execute` / `path_error`, and `server.rs` at `PublicServer::call_tool`:
  substantive located decoding plus nonblank-command validation on both
  public paths and on the committing candidate. Inspect `Check` in
  `plan/evidence.rs` as the retained structural grammar, not a new subject.
  Reason: a service-only or post-decode-only gate misses part of T1.
  Association reason for T1: these paths must refuse the same identified field.

### T2

- **P29-T2-C — check.** File `crates/cadence/tests/phase29_limits.rs`, function
  `phase29_check_without_expected_output_is_refused`.
  Setup: a native truth and saved single-check winner with a valid command.
  Submit replacements with `expected` omitted, null, a bare string, scalar
  or array; an object with missing/null/wrong/unknown `kind`; and each legal
  tag with missing/null/non-string/empty/whitespace-only `value`. Include
  spaces, tabs/newlines and Unicode whitespace, both literal and property,
  and a nonzero plan/item position. Keep the rest of each request valid.
  Call: both public paths, independently, with the common reopen protocol.
  Expected property: `status: refused`, `code: invalid-plan`, rule
  `check-expected`, the full check id and exact field path on BOTH paths:
  `spec.expected` for an absent/non-object container, `spec.expected.kind`
  for an invalid tag, `spec.expected.value` for a missing/invalid/blank value,
  all prefixed by the actual submission plan/item path. Phase and entry match
  the caller's input; installed winner, receipts and maps remain byte-identical.
  Controls accept and preserve a nonblank literal, a nonblank property such
  as `stdout is empty and the exit status is zero`, and surrounding whitespace.
  No property evaluator runs and no strength is inferred from prose. A blank
  string never means an implicit expectation of silence. A well-typed blank
  expectation remains an unpersisted draft without approval.
  Boundary real: public operations, store and filesystem; fakes only
  clock/caller inputs. Command:
  `cargo test -p cadence --test phase29_limits phase29_check_without_expected_output_is_refused -- --exact`.
  Expected command result: one passing test asserting that property.
  Item reason: accepting blank expectations publishes a check with no oracle.
  Association reason for T2: each case isolates the missing-output trigger.
- **P29-T2-A — artifact.** `crates/cadence/src/plan/limits.rs`,
  `plan/associations.rs` at `validate`, and the shared preview/submission
  diagnostic routing in `plan_service.rs` / `server.rs`: the existing
  `Expected` literal/property shape with located malformed-field handling and
  a nonblank value requirement, without a predicate language or extra spec
  constraints. Reason: a generic decode failure loses the promised check id.
  Association reason for T2: command presence cannot substitute for an oracle.

### T3

- **P29-T3-C — check.** File `crates/cadence/tests/phase29_limits.rs`, function
  `phase29_distinct_checks_across_plans_are_refused`.
  Setup: author native truth `truth/full/delivery`; publish plan 1 with check
  `check/saved`. Propose plan 2 with `check/proposed` attached to that SAME
  current full id/version. Give the checks identical specs to prove identity,
  rather than command/spec equality, decides distinctness. Use actual returned
  plan identities in the expected origins.
  Call: complete preview and independently approved publication.
  Expected property: typed `truth-check-limit` refusal with full truth id,
  current version 1 and the complete stable conflict detail specified in Notes:
  saved check from plan 1 and proposed check from plan 2. After server exit the
  installed winner, receipts and saved maps are byte-identical.
  In this SAME test add two checks within one contribution, an initial
  multi-plan batch, more than two distinct checks, reordered item/batch inputs,
  and replacement which leaves a distinct saved check in another plan. Assert
  every distinct id and every origin, stable ordering, and saved/proposed
  labels. Aliases of the same shared definition across plans count once,
  including a conflict where one of the distinct ids has several origins.
  Legal controls: one shared check serves multiple truths; separate truths
  each have one check; replacing the sole old check with a new id leaves one;
  coordinated replacement of all affected contributions removes old aliases
  before adding the new single shared definition. Historical checks do not
  count. Reopen and inspect retained old map payloads/receipts without changes
  to their content, plus the new current binding and supersession relation.
  Replay the original request after replacement: original identity/revision
  and map binding return, the new winner stays installed, and no bytes change.
  Committing-snapshot control: preview a legal new contribution sharing the
  saved check, then let a second real caller replace the sole saved check with
  a different id. Submit the earlier approval unchanged: the existing stale
  allocation/snapshot conflict may win and must preserve that winner. Refresh
  allocation basis and exact approval for the now-conflicting proposal and
  submit directly: the saved/proposed distinct-check refusal must identify
  the new current saved check, not the one in the earlier preview.
  Boundary real: public operations, both callers, native truths, conditional
  publication, store and filesystem; fakes only clock/caller inputs. Command:
  `cargo test -p cadence --test phase29_limits phase29_distinct_checks_across_plans_are_refused -- --exact`.
  Expected command result: one passing test asserting that property.
  Item reason: per-plan counting or counting aliases permits or invents a
  second check. Association reason for T3: the essential case crosses saved
  and proposed plan contributions on the same current truth.
- **P29-T3-A — artifact.** `crates/cadence/src/plan/limits.rs`,
  `plan/associations.rs` at `Contribution` / `candidate` / `validate`,
  `plan/model.rs` at `Answer` / `Diagnostic`, and `plan_service.rs` at
  `path_error`: substantive upper-bound calculation and structured complete
  conflict diagnostics with deterministic order and origin provenance.
  Reason: one id and a generic reason cannot locate all conflicting checks.
  Association reason for T3: the reported conflict must be the resulting phase
  union's distinct ids at the current truth version.

### T4

- **P29-T4-C — check.** File `crates/cadence/tests/phase29_limits.rs`, function
  `phase29_link_value_absent_from_truth_is_refused`.
  Setup: author native truths through phase 11 with handwritten slots that
  isolate value occurrence. One has trigger `the sender sends the parcel`,
  observer `the recipient`, outcome `a receipt`; only its trigger names
  `parcel`. Other cases put a unique value only in observer or only in
  outcome. Every fixture truth has exactly one current check. Install a valid
  winner before each refused replacement. Item ids, reasons, title and body
  deliberately mention absent control values; those must not authorize them.
  Call: both complete preview and independently approved publication, using
  one function for all the following submissions.
  Expected property: `parcel` and outer-whitespace-padded ` parcel ` publish
  against the first truth, preserving the submitted value bytes. `invoice`
  and `arc` refuse with `link-value-not-named`, the full link id, exact
  `spec.value` JSON path, and the particular associated full truth id/version
  and association path in detail. `arc` is inside `parcel`, not a word match.
  Include values adjacent to letters, digits and underscore at either end:
  an embedded run refuses, a punctuation-delimited occurrence accepts. Include
  non-ASCII letters/digits so byte/ASCII-only boundaries cannot pass. Handwritten
  discriminators: with a trigger slot `the sender sends the parcelé`, value
  `parcel` refuses (`é` is alphanumeric and extends the run); with a slot
  `sends the parcel, then`, value `parcel` accepts (`,` ends the run); with a
  slot `sends the parcel_2`, value `parcel` refuses (`_` extends the run). An early
  embedded occurrence followed by a delimited occurrence in the same slot
  accepts; matching cannot stop at the first substring. Compare
  case, exact internal whitespace and punctuation: altered case, collapsed
  spaces, changed punctuation, a synonym and a pronoun substitute refuse.
  A value must occur inside ONE slot: use a native trigger ending in `parcel`
  and observer beginning with `recipient`, then refuse `parcel recipient`.
  Observer-only and outcome-only exact matches accept. A value mentioned only
  in another truth, id, reason, title or plan prose refuses. A shared link
  whose first truth names the value and second does not refuses at the second
  association; a shared link named by every associated truth accepts.
  Also exercise missing/null/non-string/empty/whitespace caller, callee and
  value fields with otherwise valid inputs: `link-content` identifies the
  link and exact malformed field on both public paths. Nonblank caller/callee
  need not themselves occur in a truth; do not add an endpoint-matching rule.
  All refusals preserve reopened winner/receipt/map bytes; controls preserve
  handwritten input and native slots at the returned publication identity.
  Boundary real: public operations, native approval, store and filesystem;
  fakes only clock/caller inputs. Command:
  `cargo test -p cadence --test phase29_limits phase29_link_value_absent_from_truth_is_refused -- --exact`.
  Expected command result: one passing test asserting that property.
  Item reason: substring matching or searching caller prose authorizes links
  whose associated approved truth never names the value.
  Association reason for T4: this causes the absent-value trigger and observes
  the identified refusal beside legal single-slot controls.
- **P29-T4-A — artifact.** `crates/cadence/src/plan/limits.rs` and
  `plan/associations.rs` at `validate`, reading existing
  `context::persistence::saved`, `ApprovedContext.submission.truths` and
  `TruthSlots`: exact individual-slot phrase matching for every current
  association, with nonblank endpoints/value and a separately located
  `link-truth-unresolvable` diagnostic if approved slots cannot be resolved.
  Inspect resolution by full id and current version, unique retained slot
  identity and complete approved slot availability, using the same snapshot.
  Never parse `Truth.text`, join slots or accept an unclassifiable link.
  Reason: rendered text loses the approved slot boundaries and unresolved
  authority is not evidence that a value is absent.
  Association reason for T4: only the associated current approved slots may
  authorize its named value. The unresolved-native-slot safeguard is inspected
  here; no native context is forged to claim a public runtime case.

### Shared artifacts and observation

- **P29-A-COMMIT — artifact; associations T1, T2, T3, T4.**
  `crates/cadence/src/plan/associations.rs` at `candidate` / `validate`,
  `plan/persistence.rs` at `validate_candidate` / `contribute` /
  `validate_publication` / `replay`, `plan_service.rs` at `execute` /
  `path_error`, `store/writer.rs` at `Writer::execute_store`, and
  `store/transaction.rs` at `Intent::validate`: substantive validation of the
  post-replacement current union for every fresh attached submission, including
  untouched saved contributions. Inspect that historical deserialization is
  not tightened, replay precedes new-policy validation, no saved map/receipt is
  rewritten, and explicit provisional authoring retains D-97 behavior.
  Inspect that located diagnostics survive the existing writer/intent error
  conversions into the public answer. `Error::Display` currently adds Debug
  wrappers; simply stringifying a `plan-refusal:` error loses `path_error`'s
  prefix match. Preserve the original diagnostic payload through those plan
  branches rather than interpreting arbitrary nested error text.
  Item reason: preview-only validation, grandfathering saved invalid content
  or rewriting history violates exact publication authority.
  Association reasons: T1 saved blank commands, T2 saved blank expectations,
  T3 saved distinct checks and T4 saved unnamed values must each block a new
  attached union until all offending contributions are corrected in one
  approved replacement batch. These historical-policy branches are artifact
  inspections, not a claimed captured-old-binary experiment. Check the real
  `map_history` retention and `map_view` read-only callers without adding a
  migration, second writer or readback gate.
- **P29-A-INSTRUCTIONS — artifact; associations T1, T2, T3, T4.**
  `crates/cadence/src/plan/instructions.rs` at `ROLE` / `markdown`,
  `server.rs` at query/apply tool descriptions and generated
  `skills/cad-plan/SKILL.md`: compiled guidance states the new refusals, why
  they exist, the precise lexical rule and limits, and how to correct the
  complete candidate with fresh exact approval. The derived public output
  schema advertises conflict detail. Inspect source substance and generated
  provenance; rendered Markdown is not a check subject.
  Item reason: instructions that still defer phase 29 teach an obsolete
  publication contract. Association reasons: T1 needs nonblank commands, T2
  explicit nonblank literal/property oracles, T3 one distinct check phase-wide,
  and T4 a value actually named under the approved lexical rule.
- **P29-O1 — observation; associations T2 and T4; source O1.** The owner runs
  `/cad-plan` for a real phase in a real host, sees the planner submit a map
  in which one check has a blank expected output and one link names a value
  its truth does not use, sees each come back as a typed refusal in the
  conversation naming the item, and sees the corrected plan land with its
  map attached. Whether the planner writes a good check after the refusal is
  the model's and is not asserted. Specification provenance:
  `.planning/phases/29/CONTEXT.md`, Observations / O1, approved by the owner
  2026-09-10. **Pending; not yet seen.**
  Item reason: deterministic stdio checks cannot establish real host conduct.
  Association reason for T2: the owner must see the expected-output refusal
  in the conversation. Association reason for T4: the owner must see the
  unnamed-value refusal and corrected publication. This is one item with two
  associations, supplementary to C2/C4, never another check. No observer,
  observation date or result is fabricated. Observation verdicts are phase
  13; even when seen this item caps the associated truths at `concerns`.

## Tasks

### Task 1: Refuse a commandless check through both public paths

- **Files:** `crates/cadence/src/plan/limits.rs` (new),
  `crates/cadence/src/plan/mod.rs`,
  `crates/cadence/src/plan/associations.rs` (`malformed_version`, `validate`),
  `crates/cadence/src/plan_service.rs` (`execute`, `path_error`),
  `crates/cadence/src/server.rs` (`QueryArguments`, `PublicServer::call_tool`),
  `crates/cadence/src/store/writer.rs` (`Writer::execute_store` plan branch),
  `crates/cadence/src/store/transaction.rs` (`Intent::validate` plan branch),
  `crates/cadence/tests/phase29_limits.rs` (new).
- **Action:** Deliver P29-T1-C, P29-T1-A and the T1 portion of
  P29-A-COMMIT. Write C1 first and observe a behavioral red before adding
  the gate. Give check-command shape failures their raw full item id and
  JSON location before typed decoding discards them. Share the located
  handling between complete preview and submit; stop discarding preview's
  decode error. Retain the advertised strict `QueryArguments` schema and
  unknown-field rejection, and preserve existing `malformed_version`
  diagnostics. Missing or malformed identified check commands now use the
  selected rule/path. Locate other existing check/link structural decode
  failures too, including auxiliary fields and nested objects: preserve the
  actual item id and failing JSON path on both entrypoints without adding
  content constraints to those fields or relaxing their typed grammar.
  Require nonblank commands in the typed domain path over `candidate`'s
  resulting contributions, including saved ones, only when the fresh batch
  contains an attached map. Keep this out of serde deserialization so
  historically retained blank content still loads/replays. Do not trim saved
  strings, execute commands, parse runners or inspect a test's existence.
  Keep replay before content validation and draft/allocation behavior intact;
  raw diagnostics refine existing structural refusal, not draft content policy.
  Reuse `validate_candidate` / `contribute` so the new domain rule reaches
  committing snapshot validation. Preserve plan diagnostics through the two
  inspected writer/intent conversions; change only that error propagation,
  leaving transaction ordering, ownership, confirmation and ordinary error
  dispositions intact. This is one vertical refusal concern; its larger file
  lease is the actual public-to-commit path. No scaffold acknowledgment or
  disconnected validator is acceptable.
- **Verify:** `cargo test -p cadence --test phase29_limits phase29_check_without_command_is_refused -- --exact`
  selects one passing C1 with both located public refusals, legal nonblank
  controls and byte-identical reopened winner/receipts/maps. Record the actual
  behavioral red and green revisions. Inspect P29-A-COMMIT's T1 branches as
  an artifact; the runtime result does not claim an old-policy fixture run.

### Task 2: Require an explicit nonblank expected output

- **Files:** `crates/cadence/src/plan/limits.rs`,
  `crates/cadence/src/plan/associations.rs` (`validate`),
  `crates/cadence/src/plan_service.rs` (`execute`),
  `crates/cadence/src/server.rs` (`PublicServer::call_tool`),
  `crates/cadence/tests/phase29_limits.rs`.
- **Action:** Deliver P29-T2-C, P29-T2-A and the T2 portion of
  P29-A-COMMIT; retain P29-O1 as pending. Write C2 and observe red, then
  extend the shared located input handling to the existing `Expected` tagged
  shape, locating container, tag and value failures as specified in C2.
  Check typed literal/property values for nonblank text across the same
  post-replacement union. Do not move validation into deserialization, turn
  blank into silence, normalize the approved payload or evaluate property
  prose. Both tags accept any nonblank string. Apply no nonblank/semantic
  check to test locator, setup, call, boundary or fakes; their phase-28 typed
  grammar stands. Preserve exact approval, replay, provisional mode and
  unapproved draft behavior established in Task 1.
- **Verify:** `cargo test -p cadence --test phase29_limits phase29_check_without_expected_output_is_refused -- --exact`
  selects one passing C2 with located malformed/blank literal and property
  refusals on both paths, unchanged reopened bytes and successful nonblank
  controls. Inspect P29-A-COMMIT's T2 saved-content/replay branches.

### Task 3: Limit each current truth to one distinct check phase-wide

- **Files:** `crates/cadence/src/plan/limits.rs`,
  `crates/cadence/src/plan/associations.rs` (`Contribution`, `candidate`, `validate`),
  `crates/cadence/src/plan/model.rs` (`Answer`, `ok`, `refused`, `Diagnostic`),
  `crates/cadence/src/plan/persistence.rs` (`validate_candidate`, `contribute`, `validate_publication`),
  `crates/cadence/src/plan_service.rs` (`execute`, `path_error`),
  `crates/cadence/tests/phase29_limits.rs`.
- **Action:** Deliver P29-T3-C, P29-T3-A and the T3 portion of
  P29-A-COMMIT. Write C3 and observe red. After existing item membership,
  version and definition validation, collect every distinct associated check
  id for each full current truth id/version over `candidate`'s union. Refuse
  more than one with complete deterministic diagnostic detail; do not count
  aliases or inspect command equality. Retain every saved/proposed plan origin
  for each distinct id. Remove all replaced contributions before counting,
  never count superseded records, and permit coordinated correction in a
  single approved batch. Keep phase 28's uncovered/no-check and shared-id
  conflict rules distinct, with item errors preceding aggregate limits.
  Implement the D-103 output choice in Notes: give the plan answer its own
  compatible envelope and optional structured detail instead of expanding the
  shared context answer or inventing a second-id slot. Update `Diagnostic`
  construction/serialization and its actual plan callers; preserve existing
  answer fields and schemas through their derived plan type. No publication,
  receipt or saved map type changes. Keep all new validation after replay and
  before a fresh attached commit. Preserve the stale-snapshot refusal when a
  competing writer changes the precondition, without silently rebasing approval.
- **Verify:** `cargo test -p cadence --test phase29_limits phase29_distinct_checks_across_plans_are_refused -- --exact`
  selects one passing C3 with the saved-plan/proposed-plan conflict, all
  origins in stable order, legal aliases/replacements, historical replay and
  current-snapshot controls. Inspect P29-A-COMMIT's T3 union/history branches.

### Task 4: Require link values to occur in each associated truth's approved slots

- **Files:** `crates/cadence/src/plan/limits.rs`,
  `crates/cadence/src/plan/associations.rs` (`validate`, `validate_items`),
  `crates/cadence/src/plan/model.rs` (`Diagnostic`),
  `crates/cadence/src/plan_service.rs` (`execute`),
  `crates/cadence/src/server.rs` (`PublicServer::call_tool`),
  `crates/cadence/tests/phase29_limits.rs`.
- **Action:** Deliver P29-T4-C, P29-T4-A and the T4 portion of
  P29-A-COMMIT; retain P29-O1 as pending. Write C4 and observe red. Extend
  shared raw location handling for malformed link caller/callee/value and
  enforce nonblank strings in the typed domain path. Resolve every associated
  full current truth id/version from the same snapshot's native context and
  get its approved slots from `ApprovedContext.submission.truths`. Require an
  unambiguous matching retained slot record and available approved trigger,
  observer and outcome. Return the distinct located unresolved-authority
  diagnostic when those cannot be resolved; never report that as absence of
  the value, silently accept it or parse the rendered sentence as fallback.
  Compare only the value's outer-whitespace-trimmed form, case-sensitively,
  with exact internal whitespace/punctuation as a contiguous phrase inside
  one individual slot. At either end that is a letter, digit or underscore,
  the adjacent character cannot extend that run. The run predicate is Rust's
  `char::is_alphanumeric()` or the character `_`, applied per `char` and
  never per byte; the outer trim uses `char::is_whitespace()`. That is the
  orchestrator's implementation interpretation of D-101's unqualified
  "letter, digit or underscore" (ruled 2026-09-10 after plan check W1;
  CONTEXT names no character class), not a rule CONTEXT states. Search all possible occurrences in each slot:
  an early embedded occurrence cannot hide a later delimited occurrence.
  Check every association, including saved contributions in a fresh attached
  union. Keep submitted bytes unchanged. Do not search ids, reasons, titles,
  body prose or other truths, join slots, fold case, stem, resolve synonyms or
  infer semantic necessity. Endpoints need only be nonblank. Approval of a
  matched link permits later tracing; it proves no handoff.
- **Verify:** `cargo test -p cadence --test phase29_limits phase29_link_value_absent_from_truth_is_refused -- --exact`
  selects one passing C4 with single-slot accepted values, absent/embedded
  values refused, all-association checks, located content diagnostics and
  unchanged reopened bytes. Inspect P29-T4-A's unresolved-slot safeguard and
  P29-A-COMMIT's saved-link/replay branches; do not claim those were forced
  through a forged native context or captured historical fixture.

### Task 5: Compile the completed planning-refusal guidance

- **Files:** `crates/cadence/src/plan/instructions.rs` (`ROLE`, `markdown`),
  `crates/cadence/src/server.rs` (query/apply tool descriptions),
  `skills/cad-plan/SKILL.md` (generated artifact).
- **Action:** Deliver P29-A-INSTRUCTIONS and carry P29-O1's exact pending
  specification with its T2/T4 associations. Preserve the design's Planner
  block verbatim. Replace language deferring phase-29 refusals with the actual
  rules and located correction guidance: nonblank command only, explicit
  tagged nonblank literal/property output, one distinct id per current truth
  across the post-replacement phase union, and D-101's exact individual-slot
  lexical comparison and its limitations. Explain all conflict origins and
  saved/proposed labels, unresolved authority, every-associated-truth checking,
  correction of offending saved contributions in one exact replacement batch,
  and historical replay without certification or rewriting. Keep the narrow
  command instruction while saying the binary does not enforce runner shape,
  execute tests or inspect other check fields for content. Preserve explicit
  provisional mapless authoring and the mechanical admission refusal until
  phase 12; do not add task bindings, red/green APIs, subject-stub gates,
  verdicts or truth revision. Keep the phase-28 observation provenance intact
  and add this phase's separate pending episode without presenting either as
  observed. Regenerate the leased skill through the existing project-free
  `plan-instructions` command from the updated compiled source; no hand-maintained
  second instruction body or user override. The generated Markdown is an
  artifact, never an acceptance test's subject.
- **Verify:** `cargo run -p cadence --bin cadence -- plan-instructions`
  exits zero and emits the compiled Planner block, actual refusal/correction
  guidance, D-101 lexical limits, unchanged provisional/execution boundary,
  pending P29-O1 and the derived submission schema. Inspect the compiled
  source, public tool descriptions and generated artifact provenance against
  P29-A-INSTRUCTIONS. This is one binary's artifact inspection, not a fifth
  check or a string-comparison test of rendered Markdown.

## Notes

- One sequential plan, five tasks, all below the eight-task ceiling. Shared
  public decoding, candidate and test files make a split unnecessary. This
  uses the requested planner template, not native execution frontmatter.
- Diagnostic wire choices here are explicitly new design decisions under
  D-102/D-103, not invented existing Rust identifiers. New Rust helper/type
  names remain the executor's choice. Rules are `check-command`,
  `check-expected`, `truth-check-limit`, `link-content`,
  `link-value-not-named` and `link-truth-unresolvable`. Retain standard
  `status`, `code`, `rule`, `reason`, `slot`, `phase`, `entry`, `id` fields.
  For aggregate check conflicts `id` is the full truth id and `slot` is
  `submission.plans`. Add optional `details` to the plan-specific refusal
  envelope, omitted when unused. Its check-conflict shape contains
  `truth_id`, `truth_version`, and `checks`: one row per distinct `id`, with
  `origins` listing `{phase, plan, source, slot}`. `source` is `saved` or
  `proposed`; paths use the existing candidate conventions
  `current.plans[N].evidence_map.items[j]` and
  `submission.plans[i].content.evidence_map.items[j]`. Sort truths and check
  ids by full UTF-8 spelling (truth version numerically), origins by numeric
  phase/plan then source and numeric item position; retain every origin once.
  Reordering caller arrays changes their accurate paths, not the identity
  ordering or conflict membership. Say full id/version and all ids/origins in
  the human reason as well. Link-value/unresolved details contain associated
  `truth_id`, `truth_version` and `association_slot`; the standard `id` remains
  the link id. Refused value and unresolved slot cause belong in the reason.
  Unknown truth/version keeps phase 28's existing diagnostic; unresolved
  approved slots after valid membership use the new distinct rule.
- Do not widen raw validation into a second policy gate before approval or
  replay. Missing/wrong shapes already failed decoding in phase 28; locate
  those failures. Blank typed strings, upper bounds and lexical necessity
  belong only to complete preview and fresh approved attached publication.
  Inspect malformed nested replacement/approval copies too when their decode
  error is a check/link field: report the actual JSON path and item's readable
  id, never mislabel a valid primary submission. If no readable id exists,
  retain the exact path and existing item-shape refusal rather than inventing
  identity. Decode failures in other existing check/link fields use the
  existing `evidence-item-shape` rule with the precise field path. This is
  diagnostic fidelity for phase 28's types, not a new content gate. Do not
  relax strict decoding or change stored historical bytes.
- D-105 is enforced by inspecting all candidate contributions, not by a new
  migration or policy marker in receipts. Current valid fixtures exercise
  saved contributions, replacement, replay and fresh-snapshot invalid unions.
  Saved maps that were legal only under pre-29 policy and the unresolved-slot
  fallback are inspected as substantive artifacts, with no claim of a runtime
  historical capture. No fixture capture/restore task is needed. The phase-28
  checker report was read: captured snapshots contain absolute active-config
  paths, so a captured tree must never be casually moved into a new TempDir.
  This plan neither restores nor edits `phase27_absent_map.json` or its root.
- Required seams were checked against this HEAD: `Check` / `Expected` / `Link`,
  `Diagnostic`, `Contribution` / `candidate` / `validate`, preview and approval
  barrier, `CompareTransact` and publication/intent algebra, retained native
  slots and version-1 construction, history/readback, compiled instructions,
  and real-binary/native-context/reopen test patterns. The research draft's
  A/B/C and candidate claims are used only where those sources agree; owner
  D-99 through D-106 supersede its unsettled options. No context/store schema
  migration, dependency or lockfile edit is planned.
- Read the existing phase-28 tests as prior subjects, not extra phase-29
  checks. Their submitted link uses the approved `parcel` slots, their check
  strings are nonblank and their legal shared checks reuse one id. Preserve
  their subjects and historical fixture. No extra phase-29 test functions,
  coverage tables, function criteria or observation tests are authorized by
  this plan.
- Plan check W1 (reports/plan-check.md) asked for the character predicate
  behind D-101's run rule. Ruling, orchestrator 2026-09-10: `char::is_alphanumeric()`
  or `_` for the run, `char::is_whitespace()` for the outer trim, per `char`.
  It is an implementation interpretation of D-101, reversible by the owner,
  and C4 carries handwritten discriminators for it (Evidence map, T4).
- Each C1-C4 is written before its implementation and has an actual observed
  behavioral red then green; compile failures and setup errors are not reds.
  The executor runs only each task's narrow Verify while working and the full
  suite once at plan close under the acceptance design. The verifier runs
  these four checks and inspects artifacts, never the suite. If clippy is
  required at execution close, its command is
  `cargo clippy --workspace --all-targets -- -D warnings`, with no stdin.
  Cargo is present. Every test-side git invocation must supply
  `-c commit.gpgsign=false`, its own `-c user.name=...` and
  `-c user.email=...`, following `phase27_plan.rs` at `git`.
  This planning pass runs no build, test suite or clippy and makes no commit;
  git remains the orchestrator's responsibility. Real-host conduct and model
  check quality remain knowingly untested; O1 is pending.
