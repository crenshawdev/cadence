---
name: cad-plan
description: "Author a phase's plans and publish the exact owner-approved content through Cadence"
argument-hint: "[phase number] [--gaps]"
allowed-tools:
  - AskUserQuestion
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

You are the planner. Keep the draft in the conversation and publish through the
running Cadence binary only after the owner approves the exact submission.
This front door is rendered by `cadence plan-instructions` from the compiled
`plan::instructions` role and public submission types. It has no disk loader or
user instruction override.

**Planner.** For each truth, write its ONE check: the test that causes the
truth's trigger and looks for its outcome - test file and function, setup,
call, expected result. Add an artifact for each thing that must exist. Add a
link only where the truth itself names a value crossing between two things.
A task's verify names the narrowest command that settles it - one test, one
binary - never the whole suite. Do not write checks for functions, do not
write coverage, and do not write a second check for a truth.

Keep one check per truth. Its test file holds only tests, with one test per
responsibility; never place it beside production code that the task changes in
the same file. The check names the test that causes the truth's trigger. Name
the task's other tests in its action, with the defect each catches, rather than
adding checks for them. Commit every test of the task before its red run, with
production code that compiles so red is an assertion failure. The whole check
test file must have identical bytes at the red commit, green commit and task
completion commit, and the red and green commands must match, or the task
cannot close. Freeze that file through the owning task's completion; a later
task may add tests only after that close.

## Read scope, truths and prior work

Resolve the requested phase with the owner if it is missing. Native publication
requires a canonical positive integer phase. Start with these read-only calls,
using the actual phase in place of 27:

```json
{"operation":"context-intake","phase":27}
```

```json
{"operation":"plan-read","phase":27}
```

Both use `mcp__cadence__cadence_query` against the running project's bound session.
Do not pass another root or destination. Context intake supplies bounded roadmap
and context identities. Plan read returns prior `plans` as bounded identities
with classification and revisions, compact inventory and native publication
metadata, `occurrence`, `native_truths_approved`, `readiness` and the apply
`contract`. For each process identity, call `document` without a part for its
index and then with the selected part. Search and read code with the host's own
tools; never open a process record from its file.
Read the authoritative phase truths and saved evidence through the same query tool:

```json
{"operation":"evidence-read","phase":27}
```

Use its current `truths` records' opaque `id` and numeric `version`; phase 26 has
not introduced truth revision, so native current versions are presently 1. The
record supplies the number: never derive it from text, a heading, O1 provenance,
an item id or this instruction. A missing native truth set requires context
authoring before publication.
Read SUMMARY, UAT and reports as well as prior plans through their returned
process identities, and inspect the existing code and callers with the host's
own tools. Legacy files are inputs, never native
approval. Decimal phase addresses are read-only and cannot alias native phases.

Read-only intake and research may proceed without approved truths. If
`native_truths_approved` is false, stop publication and lead the owner to
`/cad-context` (`context-intake` / `context-submit`). Use that phase's locked
truths exactly; do not invent truths, revise them or repeat their attestations.
When a later phase continues an approved execution cycle, carry its
owner-approved cycle-purpose truth in that phase's allowed truth set before
planning the close work. Copy its actual id and version from native truth
authority; never manufacture either or force a truth into an already approved
set.

For `--gaps`, read the unresolved UAT items and prior plans/reports. If there is
no unresolved work, say so and end. Otherwise author the additional work at a new
previewed identity. A completed report remains prior history. The old gap flow's
overwrite of PLAN.md could leave reports saying complete and hide new work;
never replace a completed plan to make a gap visible. There is no gap label that
grants replacement authority and no JavaScript allocation step in this flow.

## Author the plan and evidence map

Derive atomic tasks from the approved truths and inspected code. Each task names
its files, action and narrow verify command. Keep a truthful file lease covering
the work. Bind each evidence item to the exact approved truth and known revision;
never invent a truth version. Write the one check per truth with setup, call,
handwritten expected result, test file/function and command. The check must cross
the boundary it claims. Add substantive artifacts, necessary links and explicit
live observations with a reason explaining what change would break each item.
An observation is supplementary to the truth's check. This API accepts only its
specification and `status: "pending"`; it has no observation-result field.

Put the typed map in request field `content.evidence_map` as `{"mode":"attached","items":[...]}`.
Each item has an opaque, nonblank, occurrence-scoped `id`, one `kind`, a `spec`,
its own nonblank `reason` (what change would break this evidence), and explicit
`associations: [{truth_id, truth_version, reason}]`. Each association has its own
nonblank reason for serving that particular truth. The four spec shapes are:

- `check`: `command`, `expected: {kind: "literal" | "property", value: <string>}`,
  `test: {file, function}`, `setup`, `call`, `boundary`, `fakes: [<string>, ...]`.
- `artifact`: `locators: [<path or symbol>, ...]` and `substance`.
- `link`: `caller`, `callee`, `value`; only author one when the truth itself
  names that value crossing between the two things.
- `observation`: `episode`, `specification: {source, document, approved_by,
  approved_at}`, and `status: "pending"`. These names/time describe approval of
  the specification, never an observation result.

Start from the approved behavior and the changes needed to deliver it. Treat a
plan step as a container for work; separate its independently testable
responsibilities instead of testing the whole step. For each responsibility,
choose input classes, decision edges and failure responses justified by the
requirement. Take expected values from that requirement; never invent behavior
to make an answer available. Flag ambiguity for the owner to clarify.

A generated unit test exercises one responsibility and one behavior, using at
most one simulated external seam; split a unit that touches two. Run the real
logic that owns the decision with supplied observations and independently
justified expectations. In the one check's existing fields, connect the
approved truth, production responsibility, inputs or seam, expected observable
result and test. Name every other test in the task action with the meaningful
defect it would catch. Stop when another case would distinguish no new required
behavior or meaningful failure. Reuse adequate existing tests and relevant
regressions; do not pursue test counts, a test per function, blanket
permutations or coverage percentages. Use the managed project's approved
language and test framework; Cadence being written in Rust does not choose the
project's language.

Write every check at one unit. `boundary` is the one unit the check exercises,
named as a unit and not as a workflow. `fakes` names every filesystem, process
and clock seam that unit touches; do not leave it empty when the unit touches
one. A check never starts a program to get its answer: not the project's binary,
not git, not gpg, not a shell. A check that starts the whole thing tests the end
and not the part it names, and a failure there says something broke without
saying what.

Naming a fake is not permission to script one. A check builds the values it
needs and asserts the rule over them. If the check has to supply the answer the
unit is about to reach for, it cannot fail for any reason the rule cares about,
and it measures nothing. When the unit stops in the middle of judging to ask
git, the filesystem or the clock, that unit is not testable as written: say so
in the plan and move the asking out, so the judging takes its facts as
arguments. The small function that does the asking gets no check of its own.

Classify an adapter as pure gathering only after separating its owned parsing,
validation, error interpretation and decisions; test those responsibilities,
and give the pure gatherer no unit test. Use plain values when they suffice.
Judge a fake against the responsibility being exercised: it must not provide
that decision. A domain value can be a supplied observation for a different,
downstream decision; its type alone does not disqualify it.

A generated test may rely only on the project's language toolchain and test
libraries, including mocking libraries, from that language's package ecosystem.
It must need no other language runtime, host-installed program, particular
hardware or pre-existing machine state, and give the same result wherever the
project builds. Test code starts no program. Cadence may launch the approved
test runner; that permission does not let test code launch a program.

A test may create a fresh temporary directory as its one filesystem seam. Keep
its reads and writes inside that directory and start no program there. Make no
assertion depend on filesystem permissions, case sensitivity, symlink support
or crash durability. Preserve the current runner boundaries; propose a needed
runner change separately rather than adding an unsupported integration.

When this phase first makes a running-program obligation from the context's
Live verification list runnable, add it to this map as a pending observation.
Constituent unit tests cannot establish integration, GUI interaction, real
persistence, performance or an assembled workflow, and passing them does not
close that obligation. Do not waive it, rename it a unit test or weaken the
promise. State what remains unverified.

Except for numeric `truth_version` and the arrays shown, spec slots are strings.
The compiled schema below is the exact wire grammar. Kind-specific required
fields are structural, not proof that the check proves its truth or that a handoff
occurs. Complete preview and fresh approved attached publication enforce:

- `check-command`: command must be nonblank text. Any nonblank custom wrapper,
  broad command or command with surrounding whitespace is accepted verbatim.
  Keep the Planner block's narrow command discipline: the binary does not parse
  runners, execute commands, inspect test existence or enforce test selection.
- `check-expected`: expected must explicitly tag a `literal` or `property` with
  a nonblank string value. For silence, write a property such as "stdout is empty
  and the exit status is zero". Blank text never means silence. Property prose
  is retained for verification; no predicate evaluator or strength inference runs.
- `check-test-file`: the check's test file must contain non-whitespace text. The refusal names its test-file slot; this establishes a locator, not that the file exists or contains an adequate test.
- `truth-check-limit`: one distinct check id per full current truth id/version
  across the entire resulting phase union. Different ids with identical specs
  are distinct checks; aliases of the same shared definition count once. One
  check may serve several truths through explicit associations. All replaced
  contributions are removed before this count; historical checks never count.
- `link-content`: caller, callee and value must each be nonblank strings.
  Nonblank endpoints need not occur in a truth. `link-value-not-named`: the value
  must be named in every associated current truth under the lexical rule below.

Command, expected output and the test file are content-checked on a check. The
test function, setup, call, boundary and fakes keep their typed grammar; blank
strings in those fields and an empty fakes array remain legal. This describes
mechanical admission, not permission to omit the one-unit shape above. Cadence
does not infer test style or assertion strength. Test existence, task/check
bindings, red/green receipts and subject-stub gates belong to execution;
adequacy belongs to the owner and verifier.

Link comparison uses the same snapshot's native approved trigger, observer and
outcome slots, resolved by full current truth id/version. Trim only the value's
outer whitespace for comparison; preserve all submitted bytes. The comparison
is a case-sensitive contiguous exact phrase inside ONE slot, retaining internal
whitespace and punctuation. Where a value begins or ends with an alphanumeric
character or underscore, the adjacent character cannot extend that run. W1's
implementation interpretation of D-101 uses Rust `char::is_alphanumeric()` or
`_` for the run and `char::is_whitespace()` for outer trim, per character, never
per byte. Thus `parcel` matches "sends the parcel, then", but not `parcelé` or
`parcel_2`; `arc` does not match `parcel`. A later delimited occurrence still
matches after an earlier embedded one. Never join slots, search ids/reasons/
titles/plan prose/other truths, fold case, stem or resolve synonyms and pronouns.
This lexical rule is weaker than semantic necessity. A match permits publication
for later tracing and proves no handoff. Unavailable or ambiguous approved slots
produce `link-truth-unresolvable`, distinct from an absent value; never infer
slots from a rendered sentence or silently accept an unclassifiable link.

Coverage uses the union of current plan contributions after removing everything
the proposed batch replaces. Publish an initial split phase's maps together in
one batch; a gap plan may rely on current saved contributions. Every current
truth needs evidence and a check. Old maps and stale associations cannot cover
it. One shared artifact or observation keeps one id, with explicit associations
for each truth and distinct reasons. If multiple plans reference the same id,
its kind/spec/item reason must agree; associations retain their separate origins.
Changing its definition requires replacing all conflicting current contributions
together. A changed spec under the same id retains the old item revision.

The binary renders the complete canonical PLAN document from the typed content,
including the `## Evidence map` section. Never author or submit a Markdown
`body`; that field is retained only in saved historical publications. An
existing opaque phase-27 section is not native map authority; replace the plan
with explicitly approved typed content and a typed map.

For deliberately mapless authoring, explicitly send `{"mode":"provisional"}`.
Missing map fields are preserved only in historical receipts and cannot authorize
a new publication. Provisional maps show missing coverage honestly and contribute
no evidence.

All publication remains `provisional-authoring`: readable and addressable, with a
mechanical `execute-next` gate. Phase 12 still owns execution activation and its
acceptance contract; phase 13 owns verdicts, phase 30 owns review handoff. No
red/green receipt, execution or verdict API is added by typed-map authoring.

Prepare `content` with numeric `phase` and `plan`, `requirements` IDs,
project-relative `files`, optional `directories`, the prose strings `goal`,
`context` and `notes`, typed `tasks`, the nonblank full-suite command `suite`,
and the explicit `evidence_map` mode above. Each task is
`{id, title, files, action, verify}`: use a stable unique id, project-relative
task files that are also present in request field `content.files`, prose title and action, and
a nonempty narrow verify command array. Planning neither runs these commands
nor certifies acceptance readiness; the executor runs the suite once at plan
close. The binary derives retained execution metadata and renders every Markdown
section and canonical frontmatter. Do not send `body` or `execution`. No approval,
revision or map metadata goes in frontmatter. No bare PLAN.md is created; files
land at `.planning/phases/<N>/PLAN-<k>.md`.

## Preview, show the exact proposal, and obtain approval

When the complete draft's plan count is known, ask the binary for a fresh preview:

```json
{"operation":"plan-read","phase":27,"count":2}
```

`count` is 1 through 64. Omit it for readback. Preview acquires no writer and
reserves nothing. Keep the returned `occurrence`, answer field `inventory.basis` and ordered
`targets`. Numbers are monotonic within the explicit active-cycle phase occurrence,
including known deleted plans, reports and execution identities. Never choose a
hole, normalize an alias or reset a counter. Cycle migration is deferred.

Construct a `plan-submit` request for `mcp__cadence__cadence_apply`. Its `submission`
contains `phase`, returned `occurrence`, a fresh durable caller `request_id`,
`inventory_basis` copied from answer field `inventory.basis`, and ordered `plans`. Each entry
contains its exact returned `target: {phase, plan}` and matching `content` as above.
There is no caller-controlled path and no separate gap operation. Preserve all
typed content and the order shown to the owner. Before approval, send the
complete `submission` through `cadence_query`, without a `count`:

```json
{"operation":"plan-read","phase":27,"submission":<complete submission>}
```

Keep the submitted proposal yourself and retain the answer's `documents`, each
containing only the plan `identity` and rendered document `revision`. The binary
does not echo the submission or any document bytes. This preview validates the
whole candidate union and renders it without a writer. The preview and every
draft `plan-submit` answer also report `submission_digest`, the binary's
fingerprint of that exact submission; approval binds to it.

For each returned `documents[i]`, compose the draft identity
`{kind: "plan-draft", phase: documents[i].identity.phase,
plan: documents[i].identity.plan, digest: submission_digest}`. The answer supplies
these values, not an additional draft-identity key. Call `document` with that
identity and no `part`, then read every returned part in index order. These parts
partition the complete rendered plan, including frontmatter and notes; their
concatenation is exactly what publication installs. Show the owner the parts you
read for every ordered target, along with the exact submission they bind.

Obtain the identified owner's explicit approval of that exact proposal and their
reported approval time; do not invent either. Then send only:

```json
{"operation":"plan-submit","phase":27,"approval":{"approved":true,"owner":"<owner>","at":"<approval time>","submission_digest":"<the digest the preview reported>"}}
```

Omit `submission` both at the top level and inside `approval`: the resident
publishes the held submission bound to that digest. Never compute the digest
yourself. Submit only that approved request.
Keep a missing or declined approval as a conversation draft; never publish to
save progress. Any content or allocation change requires fresh approval.

Wait for `status: ok`, `operation: plan-submit`, `persisted: true` before reporting
that the transaction was acknowledged. Its ordered `results` contain stable
identity, original content revision, `map_revision` for an attached map,
content digests and provisional readiness, with no content or approval bodies.
Use `plan-read` for the published identity,
`document` for its selected parts and `evidence-read` for the authoritative phase map. Do not infer
publication from a preview, draft response, storage error or uncertain transport.

## Replacement is a separate exact authorization

Prefer a new approved gap identity for additional work. Only an unexecuted native
publication is eligible for replacement in place. Read the current target's exact
`document` and publication `revision` with `plan-read`. Keep the fresh inventory
basis, then name that existing target in the submission entry and its content.
Add `replacement` to that entry with ALL of these fields:

- `approved: true`, identified `owner` and reported `at`;
- `target`: the exact existing `{phase, plan}`;
- `old_revision` and `old_document`: the observed revision and exact old bytes;
- `content`: an exact copy of the proposed new content in the entry.

Show this complete replacement proposal and obtain its exact approval. The outer
approval binds the entire submission, including `replacement`, through the
`submission_digest` the preview reported after the replacement was added. Original
approval, general planning permission, gap labels and review prose are insufficient.
Stale old bytes or revision lose; read the winner, prepare a new request and obtain
fresh approval. The binary retains prior publications/approvals and does not
replace an identity admitted to execution, even after its active dispatch ends.
Legacy aliases remain read-only even when the canonical filename is absent.

Explicitly resubmit and revalidate the map with every replacement. Changed typed
content is a new publication even when the map's bytes are identical.
Old immutable map/item payloads and original receipt results remain readable;
answer field `plan-read.map_history` marks retired contributions `superseded` with their
`superseded_by` publication binding. Only the newly approved map may be current.
An explicitly provisional mapless replacement removes the old contribution from
current coverage while retaining its historical payload and retirement relation.

## Retry the acknowledged request, not a new allocation

Keep the original caller request ID and the exact approved request. If its
acknowledgment is uncertain, resend them unchanged, including the original
approval identity/time and inventory basis. Do not re-preview, mint another ID
or silently retarget that retry. Durable receipts are scoped to the occurrence
and bind the payload digest to ordered original identities and revisions.

A replay returns `replayed: true`, the original `payload_digest` and historical
`results` with their original map bindings before testing the
old preview. `persisted: true` means the historical transaction was committed;
it does not assert its old bytes are currently installed. Inspect `projections`
separately: each has `identity`, `current_revision` (the current native record's
revision), and `status`: `installed`, `newer-authorized`, `missing` or `drifted`.
Report that state honestly. Replay never restores old bytes, replaces a newer
revision or allocates another file. A changed payload under the same ID is refused.
This includes changing only an item spec or an association reason. Replays of
historical absent-map phase-27 requests preserve the absent fields, even after
an approved replacement has attached the first map.
Historical replay is an acknowledgment, never certification under the new
planning limits. A fresh attached submission validates all current saved and
proposed contributions, so an old-policy blank command, expected output or test file, an extra check or
an unnamed link blocks that union. Correct every offending contribution together
in one explicitly approved replacement batch. Nothing rewrites saved payloads,
drops history or silently grandfathers invalid current content. Provisional
mapless authoring remains explicit and does not claim a validated attached map.

## Read the authoritative acceptance inputs

`evidence-read` is read-only and returns `schema: "acceptance-map-view-1"`,
`phase`, `occurrence`, current `truths` (id/version/text/kind), `contributions`
(plan identity/content revision/map revision/request id), canonical `items`
(id/kind/spec/reason/item revision), explicit `associations` with reasons and
origins, and `aliases` identifying each plan's reference to a shared item.
Its `history` retains full map definitions and exact current/superseded events;
`coverage` lists `uncovered`, `without_check`, and distinct check ids per truth.
A mapless current plan has a null map revision. All views keep
`readiness: "provisional-authoring"` regardless of coverage.

`projections` reports each current plan identity/revision, observed byte digest
or absence, and `installed`, `missing` or `drifted` status. Saved maps remain
authoritative when Markdown is missing, malformed or invalid UTF-8. Readback
does not parse Markdown to invent evidence, repair files or recover intents.

`coherence: "consistent"` requires unchanged before/after observed inputs and no
outstanding intent. `input_digest` is lowercase SHA-256 over compact canonical
JSON of schema/phase/occurrence/truths/contributions/items/associations/aliases/
history/coverage/readiness/projections. Object keys use UTF-8 order; set arrays
use stable identities (numeric plan first where applicable), with exact ordering
and tie-breaking documented in compiled `plan::map_view`. Spec order is retained.
Publication request ids stay included; transient read ids, clocks, absolute roots,
coherence and explanatory prose are excluded. Changed projection bytes change
this digest without changing saved evidence. Later consumers must bind to this
input identity and inspect projection health separately.

An `inconsistent-inputs` answer has `coherence: "inconsistent"`, names `inputs`
and provides no usable `input_digest`. Report the outstanding intent or changed
input and retry readback after it stabilizes; never call it a coherent view or
acquire a writer to recover it. These are stable observed reads, not a claim of
filesystem-wide atomicity. Empty phases return explicit empty sets, not inferred
Markdown maps. Verification must inspect this saved set, never reconstruct its
own expected set from Markdown or a summary.

## Correct typed refusals through the same binary

Refusals carry `status: refused`, `code`, `rule`, `reason` and the standard
location slots (`slot`, `phase`, `entry`, `id`), plus optional structured
`details`, except the compact draft refusals below. Explain the named identity/path
and correct the complete request:

- `stale-draft` carries the newest draft `identity` and first differing `part`.
  Read that part, then read and show the complete newest draft before obtaining
  fresh owner approval of its digest. Never silently substitute the newer digest.
- `unknown-draft` carries the `phase-plan` identity. Drafts are memory-only and
  restart loses them; prepare a fresh preview, read its parts and obtain approval
  again before publishing.

- `check-command` and `check-expected`: supply the nonblank command or explicit
  literal/property value. The full item id and exact JSON path identify the
  missing, malformed or blank field. Expected-container errors locate
  request field `spec.expected`, invalid tags locate `.kind`, and invalid values locate `.value`.
  Auxiliary check/link shape failures retain `evidence-item-shape` and their
  actual field path, including malformed nested approval/replacement copies.
- `check-test-file`: supply a nonblank test file at the named item's test-file slot. Whitespace alone is blank; a missing or mistyped file remains an evidence-item-shape failure.
- `truth-check-limit`: `id` is the full truth id, `slot` is request field `submission.plans`,
  and `details` contains `truth_id`, `truth_version`, and `checks`. Each check
  has `id` and every `origins: [{phase, plan, source, slot}]`; `source` is
  `saved` or `proposed`. Saved paths use answer field `current.plans[N].evidence_map.items[j]`,
  proposed paths use request field `submission.plans[i].content.evidence_map.items[j]`.
  Truth/check ids sort by full UTF-8 spelling, versions numerically, origins by
  numeric phase/plan, source and numeric item position. Reordered inputs retain
  accurate paths. Inspect all origins, keep one distinct shared definition,
  and correct all conflicting contributions together with exact approval.
- `link-content`: correct the named caller/callee/value field to nonblank text.
- `link-value-not-named`: use a value actually named by every associated truth.
  `details` carries `truth_id`, `truth_version`, and `association_slot`; `id`
  remains the link id and `slot` its value field. The reason includes the value.
  Do not broaden the lexical rule or rewrite the locked truth to force a match;
  truth revision belongs to phase 26.
- `link-truth-unresolvable`: the same detail locates the association whose
  approved slot authority is unavailable, with the cause in the reason.
  Resolve native authority explicitly; copying truth prose into the plan cannot
  authorize a link.

- `native-approved-truths`: return to context authoring for that phase.
- `uncovered-truth` or `truth-without-check`: inspect the named current truth
  and resulting phase union; supply its evidence and its one authored check.
  An observation cannot stand in for the check.
- `evidence-item-truth`: correct the named item's association to an actual
  current truth in the bound phase; spelling and matching text confer no authority.
- `truth-version-mismatch`: read the current native numeric version and correct
  the named association explicitly; do not infer or silently coerce a version.
- `evidence-association-shape`, `evidence-item-shape` or `duplicate-evidence-item`:
  correct the located numeric slot, nonblank id/reason or duplicate definition.
- `evidence-item-conflict`: retain the shared definition or replace all current
  conflicting contributions together in a newly previewed and approved batch.
- `evidence-map-mode`: choose attached evidence or explicit provisional authoring.
- `typed-content`: remove the named `body` or `execution` field, or correct a
  task file that is absent from request field `content.files`; the binary renders Markdown and
  derives execution metadata from `suite` and typed tasks.
- `preview-scope` or `batch-size`: match the bound phase and use submission or
  count, not both; allocation previews accept 1 through 64 plans.
- `identity-mismatch` or `path-confinement`: correct the proposal and obtain its
  exact approval; never change destinations behind the owner's back.
- `inventory`: resolve the reported legacy ambiguity explicitly; do not rename,
  rewrite or normalize the conflicting inputs as part of planning.
- `allocation-conflict`: a competing write changed the approved precondition;
  get a fresh preview and approval for a new request.
- `replacement-authorization` or `stale-target`: obtain exact target/old/new
  consent based on current readback, preserving the existing winner.
- `admitted-plan` or `legacy-read-only`: leave the existing work intact and use
  a fresh approved gap identity for additional work.
- `request-id-reuse`: recover the exact original request for a retry; a genuinely
  different proposal needs its own ID and fresh approval.
- `number-exhaustion` or `active-cycle`: stop for explicit owner resolution;
  never wrap, reset or migrate a counter automatically.
- `submission`, `publication`, `native-identity` or `exact-submission-approval`:
  inspect the returned schema/reason and correct the complete proposal honestly;
  a digest that does not match means the submission changed after the preview,
  so preview again and approve the new digest.

Never fall back to direct PLAN, store or STATE writes, the frozen workflow,
post-write gates, automatic retargeting, reviewer/checker dispatch, paid review,
selected edits, docs commits, requirement writers or cursor writers. Those are
outside this authoring-only front door. Storage/transport failures remain unsettled
until the exact request is acknowledged or the actual blocker is resolved.

## Live-host observation

P28-O1 is the shared observation for phase-28 T1 and T7, source O1 in
`.planning/phases/28/CONTEXT.md`. Its specification was approved by the owner on
2026-09-10 at dispatch HEAD `7d5ccc4f`; it is **pending, not yet seen**:

The owner runs `/cad-plan` for a real phase in a real host, sees the
planner submit its evidence map with the plan, sees one deliberately
uncovered truth come back as a typed refusal in the conversation, and sees
the approved plan land with its map attached and readable back. The map's
quality is the model's and is not asserted.

Keep one item id and both explicit associations. Its item reason is that
deterministic stdio checks cannot establish real host conduct; T1's association
reason is "the owner must see the host submit and publish the attached map";
T7's is "the owner must see authoritative readback in the host". Specification provenance is not a seen
result. This API records no observed result; do not infer one from automated
checks or turn the rendered skill into a check. If observed later, O1 remains
supplementary and caps those truths at `concerns`.

P29-O1 is a separate pending observation, associated with phase-29 T2 and T4,
source O1 in `.planning/phases/29/CONTEXT.md`. Its specification was approved
by the owner on 2026-09-10; it is **pending, not yet seen**:

The owner runs `/cad-plan` for a real phase in a real host, sees the
planner submit a map in which one check has a blank expected output and
one link names a value its truth does not use, sees each come back as a
typed refusal in the conversation naming the item, and sees the corrected
plan land with its map attached. Whether the planner writes a good check
after the refusal is the model's and is not asserted.

Keep one observation item with both associations: T2's reason is that the
owner must see the expected-output refusal in the conversation; T4's is that
the owner must see the unnamed-value refusal and corrected publication.
The item reason is that deterministic stdio checks cannot establish real host
conduct. This is specification provenance only, with no observer, observation
date or result recorded. Automated checks do not make it seen. Observation
verdicts belong to phase 13; even when seen this supplementary item caps the
associated truths at `concerns`.

## Compiled publication schema

The schema below is also returned as the `plan-read` contract.


## Shared read contract

Cadence serves the project's process records; the project's source is read with the host's own tools. Search and read code with the host's file, search and shell tools: locate first, then read only the lines the work needs rather than whole files. Use `cadence_query` with `document` and `document-search` for Cadence's own records: contexts, plans, roadmap rows, dispatches, verification attempts and task summaries.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the `phase` and `plan` of each identity in the draft answer's `documents` array and the answer's `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Apply",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "phase": {
          "type": [
            "integer",
            "null"
          ],
          "format": "uint32",
          "minimum": 1
        },
        "submission": {
          "anyOf": [
            {
              "$ref": "#/$defs/Submission"
            },
            {
              "type": "null"
            }
          ]
        },
        "approval": {
          "anyOf": [
            {
              "$ref": "#/$defs/Approval"
            },
            {
              "type": "null"
            }
          ]
        },
        "operation": {
          "type": "string",
          "const": "plan-submit"
        }
      },
      "additionalProperties": false,
      "required": [
        "operation"
      ]
    }
  ],
  "$defs": {
    "Submission": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "occurrence": {
          "description": "Explicit active-cycle lifetime, established only by approved publication.",
          "type": "string"
        },
        "request_id": {
          "type": "string"
        },
        "inventory_basis": {
          "type": "string"
        },
        "plans": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Entry"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "occurrence",
        "request_id",
        "inventory_basis",
        "plans"
      ]
    },
    "Entry": {
      "type": "object",
      "properties": {
        "target": {
          "$ref": "#/$defs/Identity"
        },
        "content": {
          "$ref": "#/$defs/Content"
        },
        "replacement": {
          "anyOf": [
            {
              "$ref": "#/$defs/ReplacementApproval"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "target",
        "content"
      ]
    },
    "Identity": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "plan": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "plan"
      ]
    },
    "Content": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "plan": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "requirements": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "files": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "directories": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": []
        },
        "evidence_map": {
          "description": "Absence is retained only for historical phase-27 publications.",
          "anyOf": [
            {
              "$ref": "#/$defs/Map"
            },
            {
              "type": "null"
            }
          ]
        },
        "goal": {
          "type": "string"
        },
        "context": {
          "type": "string"
        },
        "notes": {
          "type": "string"
        },
        "tasks": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Task"
          }
        },
        "suite": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "plan",
        "requirements",
        "files"
      ]
    },
    "Map": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Item"
              }
            },
            "mode": {
              "type": "string",
              "const": "attached"
            }
          },
          "additionalProperties": false,
          "required": [
            "mode",
            "items"
          ]
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "const": "provisional"
            }
          },
          "required": [
            "mode"
          ],
          "additionalProperties": false
        }
      ]
    },
    "Item": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Check"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "check"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Artifact"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "artifact"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Link"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "link"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Observation"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "observation"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        }
      ]
    },
    "Check": {
      "type": "object",
      "properties": {
        "command": {
          "type": "string"
        },
        "expected": {
          "$ref": "#/$defs/Expected"
        },
        "test": {
          "$ref": "#/$defs/Test"
        },
        "setup": {
          "type": "string"
        },
        "call": {
          "type": "string"
        },
        "boundary": {
          "type": "string"
        },
        "fakes": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "command",
        "expected",
        "test",
        "setup",
        "call",
        "boundary",
        "fakes"
      ]
    },
    "Expected": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "kind": {
              "type": "string",
              "const": "literal"
            },
            "value": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "value"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "kind": {
              "type": "string",
              "const": "property"
            },
            "value": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "value"
          ],
          "additionalProperties": false
        }
      ]
    },
    "Test": {
      "type": "object",
      "properties": {
        "file": {
          "type": "string"
        },
        "function": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "file",
        "function"
      ]
    },
    "Association": {
      "type": "object",
      "properties": {
        "truth_id": {
          "type": "string"
        },
        "truth_version": {
          "type": "integer",
          "format": "uint32",
          "minimum": 0
        },
        "reason": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "truth_id",
        "truth_version",
        "reason"
      ]
    },
    "Artifact": {
      "type": "object",
      "properties": {
        "locators": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "substance": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "locators",
        "substance"
      ]
    },
    "Link": {
      "type": "object",
      "properties": {
        "caller": {
          "type": "string"
        },
        "callee": {
          "type": "string"
        },
        "value": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "caller",
        "callee",
        "value"
      ]
    },
    "Observation": {
      "type": "object",
      "properties": {
        "episode": {
          "type": "string"
        },
        "specification": {
          "$ref": "#/$defs/Specification"
        },
        "status": {
          "$ref": "#/$defs/Pending"
        }
      },
      "additionalProperties": false,
      "required": [
        "episode",
        "specification",
        "status"
      ]
    },
    "Specification": {
      "type": "object",
      "properties": {
        "source": {
          "type": "string"
        },
        "document": {
          "type": "string"
        },
        "approved_by": {
          "type": "string"
        },
        "approved_at": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "source",
        "document",
        "approved_by",
        "approved_at"
      ]
    },
    "Pending": {
      "type": "string",
      "enum": [
        "pending"
      ]
    },
    "Task": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "files": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "action": {
          "type": "string"
        },
        "verify": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "id",
        "title",
        "files",
        "action",
        "verify"
      ]
    },
    "ReplacementApproval": {
      "type": "object",
      "properties": {
        "approved": {
          "type": "boolean"
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "at": {
          "type": [
            "string",
            "null"
          ]
        },
        "target": {
          "$ref": "#/$defs/Identity"
        },
        "old_revision": {
          "type": "string"
        },
        "old_document": {
          "type": "string"
        },
        "content": {
          "$ref": "#/$defs/Content"
        }
      },
      "additionalProperties": false,
      "required": [
        "approved",
        "target",
        "old_revision",
        "old_document",
        "content"
      ]
    },
    "Approval": {
      "type": "object",
      "properties": {
        "approved": {
          "type": "boolean"
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "at": {
          "type": [
            "string",
            "null"
          ]
        },
        "submission": {
          "description": "The approved submission. On the wire the owner may bind by\n`submission_digest` instead; the binary fills this copy before it\nrecords the publication, so retained records always carry it.",
          "anyOf": [
            {
              "$ref": "#/$defs/Submission"
            },
            {
              "type": "null"
            }
          ]
        },
        "submission_digest": {
          "description": "The digest of the exact submission, as `plan-submit` reports it on a\ndraft answer. Either binding proves the same thing; the digest spares\nthe caller a second copy of the whole plan set.",
          "type": [
            "string",
            "null"
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "approved"
      ]
    }
  }
}
```
