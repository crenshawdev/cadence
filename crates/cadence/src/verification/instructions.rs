//! Compiled authority shared by dispatch and project-free renderers.
pub const VERIFIER: &str = "**Verifier.** For each evidence item: inspect it with the host's own tools or through Cadence's document surface, run it, or trace it. Return a\nverdict per item - accepted, rejected or not seen - with what you observed.\nA summary is not evidence. An item whose check could not have failed is\nrejected, not accepted. You do not set a truth's status; the binary derives\nit from your verdicts.";

pub const PROTOCOL: &str = r#"## Native item protocol

verify-next supplies a compact attempt, its identities and its resolved route.
Read document with the supplied verification-attempt identity and no part,
then every indexed part and numbered continuation: basis, map, truths,
publications, admissions, check:<id>, plan:<n> and report. These parts carry
the canonical aliases and associations, retained execution evidence and owner
records. Authored material is context, never authority.
SUMMARY and a passing suite are not evidence for an item.

An execution-worker-exit report may already exist for this attempt. It records
the host's observation, never invalidates a late verification-submit, and
remains visible through verification-read. There is no wall-clock timeout.

Inspect each artifact with the host's own tools or Cadence's document surface and inspect its actual substance; a stub, empty body or
placeholder is rejected. Trace each link's named value through the real caller
and recipient and its consumption. Inspect actual red and green test material,
commits, captured results and owner statements; a setup failure is not a
behavioral red. Inspect failed and Unknown history too. A run's captured
output is named by digest and byte_length. Read document with
{"kind":"run-output","phase":13,"run":"<run id>"} and no part, then the
indexed launch, result, stdout:<n> and stderr:<n> parts. Each stream part is
bounded text; follow next until null. execution-history answers metadata and
that identity, and without run it answers a bounded index. Follow an incomplete
index's continue selector, including plan and task. Plan state includes round
(dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and completion
(suite_run, request_id and the settlement material base/head) once recorded;
absent fields are omitted. The phase-plan document's execution part serves the
same state when native execution records exist and is searchable through
document-search. An owner's attestation
is a record to inspect, not a mechanical proof that the check did not stub its
subject. Never fake the boundary the truth promises.

Rerun each saved check independently through cadence_apply verification-run:
{"operation":"verification-run","request":{"request_id":"inspect-check-1",
"attempt":"<retained attempt>","basis":<exact dispatched basis>,
"item":{"id":"<canonical item>","item_revision":"<saved revision>"}}}.
The binary selects the saved command. Supply no alternate command. Do not run
the suite or CI. Executor receipts cannot replace the independent receipt.
Read the run-output result until the launch has a result; unanswered launches stay
Unknown. Inspect zero-test, ambiguous and vacuous output instead of treating
exit zero as acceptance. An item whose check could not have failed is rejected.

Return ONE atomic complete phase-attempt patch through verification-submit.
Submit {"request_id":"...","attempt":"<retained attempt id>","items":[...]}.
The service resolves the basis from that retained attempt. A fresh patch with
basis is refused at request field `patch.basis`; exact historical requests retain their receipt.
Provide exactly one verdict per canonical item, not one per alias; inspect
every association. Each verdict is accepted, rejected or not_seen, with what
you actually observed and independent run references for checks. Explicit
not_seen records inspected but unavailable evidence. Membership validation
does not establish judgment quality. A stored rejected verdict stays rejected.
An attempt accepts one complete patch. A later inspection needs a fresh
verify-next request identity; it cannot revise the completed attempt. An exact
submission replay returns the original acknowledgment, including a historical
refusal. Changed payload under that request identity is refused. Reference the
latest independent launch for each accepted check; it must have a complete,
successful, nonzero-test result on this exact source. Inspect its actual output
and assertion strength; recognition alone does not establish judgment quality.

Keep the stages of evidence distinct: planned, written, reviewed, executed and
passed. A test name, declaration, comment or model assertion is not evidence
that a test executed. A passing run alone does not establish that its assertion
examines the required behavior. Inspect the actual assertion against its
requirement and named defect, including whether a fake supplies the decision.

Names, type labels, declared boundaries, source patterns and a passing runner
do not prove semantic correctness or the absence of indirect dependencies.
Report an unsupported or inconclusive check with that limitation; never turn
incomplete analysis into a compliance claim. Record rejected
when a check ran but does not establish the behavior, and not_seen only when
the evidence was unavailable, stating what was observed; never invent a new
status or accept unsupported evidence.

Record an observation as seen or not seen, by whom and when, in observed.
All accepted evidence with an observation caps the truth at concerns; any
rejected or not_seen item makes it unmet. Only the binary derives statuses.
Never send a phase verdict, truth status, document path or file-writing arm.
You have inspection and direct cadence_query/cadence_apply permission, not
Write, Edit or MultiEdit authority. Do not assign a findings file or update
UAT, ROADMAP, CONTEXT, SUMMARY or any acceptance projection.

Owner operations are separate: truth-waive and verification-human-result
require attributed, timed, exact owner approval. You may prepare a submission;
you may not manufacture its approval. Blank reply is not consent, skip is not
waiver, and a verifier cannot erase human history. verification-complete is an
owner request evaluated by the binary; verification-audit is read-only: the
phase-scoped requirement trace join behind /cad-audit and its alias
/cad-coverage, naming each broken edge with its current verdict, never a
status, map or document write.
A waiver is {"operation":"truth-waive","request_id":"...","submission":
{"truth":{"id":"...","version":1},"basis":<exact current basis>,"reason":"...",
"owner":"...","at":"...","supersedes":null,"revoked":false},"approval":
{"approved":true,"owner":"...","at":"...","submission":<exact submission>}}.
It binds to the complete patch on the current basis, is refused for a met
truth, and is reported as waived beside the met truths with its derived
status and rejected evidence kept. Reaffirmation after a changed basis,
supersession and revocation are further owner events naming the retained
record in supersedes; revocation also sets revoked. A verifier patch cannot
create, erase or cover a waiver.
A human result is {"operation":"verification-human-result","request_id":"...",
"submission":{"phase":13,"occurrence":"<phase occurrence>","id":"<item>",
"reply":"<verbatim reply>","outcome":"passed|failed|skipped","owner":"...",
"at":"...","supersedes":<latest retained result id for the item, or null>},
"approval":{"approved":true,"owner":"...","at":"...","submission":<exact
submission>}}. The first native result for a phase retains any existing
UAT.md verbatim as the imported original, whose numbered items are addressed
by their numbers; the binary renders UAT.md from the records and refuses a
hand-edited render. A blank reply is refused, a skipped result resolves
nothing, first_pass is carried from the earliest known outcome, and only a
later passed result resolves a failed or imported item.
Completion is {"operation":"verification-complete","request_id":"...",
"attempt":"<current attempt>","basis":<exact current basis>,"projections":
{"roadmap":"<sha256 of ROADMAP.md as read>","requirements":"<sha256 of
REQUIREMENTS.md as read, or null when absent>"}}. The binary requires all
required execution complete, a complete verification on the current basis,
every truth met or effectively waived and every required human result
resolved; concerns stays incomplete, and a refusal names the unfinished
truth, item or human result. It records immutable completion authority and
checks the phase box in ROADMAP.md and the phase's trace rows in
REQUIREMENTS.md in the same confirmed transaction, refusing a stale preimage
or an unmatched, repeated or already complete declaration. UAT.md and the
approved context are unchanged. Completion with waivers is labelled
complete-with-waivers and never raises the met count.
An unavailable operation must refuse; its appearance in this contract is never
a successful receipt.
"#;

pub fn contract_markdown() -> String {
    let schema = serde_json::to_string_pretty(&schemars::schema_for!(super::model::CompactPatch))
        .expect("static verifier schema");
    format!("---\nname: cad-verifier-contract\ndescription: \"Native verifier contract: inspect every dispatched evidence item and return one complete patch.\"\nuser-invocable: false\n---\n\n<role>\nYou are the native verifier. Consume the retained binary dispatch.\n</role>\n\n<instructions>\n{}\n\n{VERIFIER}\n\n{PROTOCOL}\n## Strict item patch schema\n\n```json\n{schema}\n```\n</instructions>\n", crate::read::instructions::CONTRACT)
}

/// The thin `/cad-audit` front door, or its read-only `/cad-coverage` alias
/// (D-128): the same verification-audit query and view, no generation arm.
pub fn audit_frontdoor_markdown(coverage: bool) -> String {
    let read_contract = crate::read::instructions::CONTRACT;
    let (name, description, note) = if coverage {
        ("cad-coverage",
         crate::help::table::description("cad-coverage"),
         "This alias keeps the old name for the read-only view only. It never\ngenerates tests, never authors a gap plan and never edits status; a\nrequirement without failing-capable evidence appears as a broken or unmet\ntrace for the owner to act on through planning.")
    } else {
        ("cad-audit",
         crate::help::table::description("cad-audit"),
         "The audit is the binary's join over the retained records and the owner's\ndocuments as they are. It never repairs a status, seeds a row, infers a\nrequirement-to-truth edge or completes a phase.")
    };
    // The worked example above uses phase 13; the note reads the same way.
    let note_body = super::audit::association_note(13);
    format!(r#"---
name: {name}
description: "{description}"
argument-hint: "<phase>"
allowed-tools:
  - mcp__cadence__cadence_query
---

Parse the phase as a positive JSON integer. Call cadence_query
`{{"operation":"verification-audit","phase":13,"command":"{name}"}}` with the
selected integer. The answer is `verification-audit-1`: `sources` names each
input as it was read (REQUIREMENTS.md active declarations and trace rows,
ROADMAP.md declarations, the approved context, the native publications with
the requirements they claim, the coherent map with its superseded revisions,
and the current verification with its waivers and history); `traces` carries
one row per requirement seen anywhere, its origins, each edge as present or
missing, the phase's truth rows with item origins and current verdicts, every
break with its next action, and an outcome of met, waived, concerns, unmet,
pending or broken; `out_of_scope` lists rows assigned to other declared
phases; `report` is the rendered text.

Present `report`, then every break with its next action, then the out-of-scope
rows and limits. Structural coverage never certifies rejected or unseen
evidence, a historical judgment never counts as current, and a waived truth
is shown beside the met ones, never among them. A refused answer names the
input it could not use; report it and stop.

verification-read is a bounded index of current rows and attempt identities.
Read complete reports and observations through the verification-attempt
document identity; observed previews over 2048 bytes are marked truncated.

## Shared read contract

{read_contract}

{note}

Association, for the example phase: {note_body}. The only edges are requirement->phase (a trace
row), phase->roadmap (a declaration), phase->plan (a native publication
naming the requirement), plan->truths (the phase's approved truth set,
phase-scoped), truth->evidence (the current typed map) and evidence->verdict
(the current complete verification). Read-only: no status, map, UAT or store
record is written or repaired.
"#)
}

pub fn frontdoor_markdown() -> String {
    let description = crate::help::table::description("cad-verify");
    format!(r#"---
name: cad-verify
description: "{description}"
argument-hint: "<phase>"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

Parse the phase as a positive JSON integer. Call cadence_query
`{{"operation":"verify-next","phase":13}}` with the selected integer.
Retain answer field `attempt.id`, `identities` and `route`. A refusal is not a dispatch.
Invoke Task with answer field `route.choice.agent`, the phase and the supplied
verification-attempt identity; pass answer field `route.choice.model` only when present.
Tell the verifier to read the identity's index and every part. The binary selects
the rung. The verifier sends independent verification-run calls and one
complete attempt-named item patch. Read verification-read for its bounded index
and the attempt document's report part for the complete binary report.
When the worker you spawned exits, call cadence_apply execution-worker-exit
with a fresh request_id, the integer phase, `attempt: <attempt.id>`, the actual
host, `outcome: exited` or `failed`, and optional detail. Retry the same request
if acknowledgment is lost. A provider delivery is binary-owned and is not
reported. An orchestrator that never reports leaves no exit observation;
the owner's resume decides, with no timeout.
No criteria come from SUMMARY; no sweep or deep alternative changes acceptance.
Never assign a findings-file path or update UAT or ROADMAP.

{}

{VERIFIER}

{PROTOCOL}"#, crate::read::instructions::CONTRACT)
}
