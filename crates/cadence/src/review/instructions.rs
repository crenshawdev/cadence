//! Compiled review intent, shared by the local dispatch and the provider
//! payload, and the project-free renderer of the merged `/cad-review` front
//! door and its three aliases. There is no disk loader and no user override.
use super::model::{Admission, Specialist};
use super::selection::Kind;

/// Decision: refute, never amend.
pub const DECISION: &str = "Refute the selected decision: argue against it from the retained decision text and its retained inline context, name the claim each objection rests on, and apply no amendment.";
/// Minimalism: a ranked delete-list, nothing applied.
pub const MINIMALISM: &str = "Rank code that should not exist, as a deletion list ordered by severity: reinvented standard library or dependency, an abstraction with one implementation, unused flexibility and configuration nobody sets. Propose deletions; apply nothing.";
/// Plan: goal-backward, against the locked decisions.
pub const PLAN: &str = "Work backward from the phase goal and its locked decisions: for each task ask which truth it serves, whether the retained plan can deliver it as written, and whether any step contradicts a locked or durable decision. For each proposed test, ask: does it serve the approved requirement, can its assertion catch the defect it names, and does a fake provide the very decision being tested? Judge the fake relative to the responsibility the test exercises, using plain inputs where they suffice. These questions are advisory to plan submission and add no plan-submit gate. The owner's exact check inspection at execution-plan-complete and the verifier's item verdicts at verification-complete remain required completion judgments. Return findings; edit nothing.";
/// Diagnosis: the reported symptom and proposed cause, fix selection left to the user.
pub const DIAGNOSIS: &str = "Examine retained named source files with the reported symptom and proposed cause. Return findings; leave fix selection to the user.";
/// Every other review: falsify correctness.
pub const CORRECTNESS: &str = "Try to falsify correctness against the retained artifact and supporting evidence.";

/// The intent for a saved admission: a specialist names it, the `plan`
/// trigger names it, and everything else is a correctness review.
pub fn intent(admission: &Admission) -> &'static str {
    match (&admission.specialist, admission.trigger.as_deref()) {
        (Some(Specialist::Decision), _) => DECISION,
        (Some(Specialist::Minimalism), _) => MINIMALISM,
        (Some(Specialist::Diagnosis), _) => DIAGNOSIS,
        (None, Some("plan")) => PLAN,
        (None, _) => CORRECTNESS,
    }
}

/// The intent a selection will dispatch with, before anything is admitted.
pub fn intent_for(kind: Kind) -> &'static str {
    match kind {
        Kind::Decision => DECISION,
        Kind::Minimalism => MINIMALISM,
        Kind::Plan => PLAN,
    }
}

const MERGED_HINT: &str = "decision <document> <decision-id> | minimalism <file|directory|phase> | plan <phase|plan-path>";

/// The merged front door or one of its aliases, rendered from this module.
/// None for a name that is not a review command.
pub fn frontdoor_markdown(command: &str) -> Option<String> {
    let read_contract = crate::read::instructions::CONTRACT;
    let (name, description, hint, selection) = match command {
        "cad-review" => (
            "cad-review",
            crate::help::table::description("cad-review"),
            MERGED_HINT,
            "The first token selects the kind: `decision`, `minimalism` or `plan`; the rest is the target.",
        ),
        "cad-decision-review" => (
            "cad-decision-review",
            crate::help::table::description("cad-decision-review"),
            "<document> <decision-id>",
            "This alias selects the `decision` kind; the arguments are the document path and the decision id.",
        ),
        "cad-minimalism-review" => (
            "cad-minimalism-review",
            crate::help::table::description("cad-minimalism-review"),
            "<file|directory|phase>",
            "This alias selects the `minimalism` kind; the argument is a file, a directory or a phase number (`file:`, `dir:` and `phase:` disambiguate).",
        ),
        "cad-plan-review" => (
            "cad-plan-review",
            crate::help::table::description("cad-plan-review"),
            "<phase|plan-path>",
            "This alias selects the `plan` kind; the argument is a phase number or a plan document path.",
        ),
        _ => return None,
    };
    Some(format!(r#"---
name: {name}
description: "{description}"
argument-hint: "{hint}"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

<objective>
Deliver exactly the review the owner selected. The binary resolves the target,
retains its exact bytes, compiles the kind-specific intent into the dispatch
and records every delivery event; this front door only relays. Nothing here
applies a finding: no file is changed, deleted, staged or committed.
</objective>

<read-contract>
{read_contract}
</read-contract>

<process>
1. Select. Split `$ARGUMENTS` on whitespace and call cadence_query
   `{{"operation":"review-select","command":"{name}","arguments":[<tokens>]}}`.
   {selection}
   A refused answer names what is missing, ambiguous or unresolvable in its
   reason: report that request and stop. Never widen a target to its parent
   directory, the whole phase or the tree, and never substitute a paragraph of
   your own for the resolved document. Retain answer field `result.kind`, answer field `result.target`,
   answer field `result.material`, answer field `result.intent` and answer field `result.admission`.
2. Admit. Call cadence_apply `{{"operation":"review-admit","request":<result.admission, unchanged>}}`.
   Only an answer with an admitted fire proceeds; a replayed answer names the
   review already admitted for this selection.
3. Deliver. Call cadence_query `{{"operation":"review-next","fire":<fire>}}` and
   follow only the saved dispatch: invoke Task with dispatch field `dispatch.agent` and exactly
   dispatch field `dispatch.prompt`, passing dispatch field `dispatch.model` only when present. Forward the
   actual launch and return events with review-observation. Read retained
   material with document identity `{{kind: review-entry, attempt, entry}}`:
   read its index, compact entry metadata, lines:<n> and text:<n> parts, following
   next. review-material supplies this identity and metadata, never bytes.
   Additional material uses review-material-append with manifest, acquisition
   and the material's `path`; never send bytes.
   Submit the reviewer's unchanged five-field findings array as findings on
   review-return under the issued identity, launch and host_return. Never send
   raw JSON text. The receipt carries only the findings digest and count;
   review-original reads the retained parsed findings and identity. The digest
   hashes the canonical retained object envelope {{"findings":[...]}} with
   fields file, line, severity, claim, failure_scenario in that order.
   Missing or malformed host output uses host_failure without findings;
   definite launch failure uses failure_event and host_failure. Wait for the
   durable acknowledgment, then poll review-next again until delivery is
   usable-complete or complete-with-failure. Provider work stays with the
   resident binary; missing or malformed output is failure, never an empty
   clean result.
   When the local worker you spawned exits, call cadence_apply
   execution-worker-exit with a fresh request_id, the integer phase,
   `review: <attempt.attempt>`, the actual host, `outcome: exited` or `failed`,
   and optional detail. Retry the same request if acknowledgment is lost.
   A provider delivery is binary-owned and is not reported. The report records
   an Interrupted observation; late returns are accepted.
   An orchestrator that never reports leaves no exit observation; the owner's
   resume decides, with no timeout. Use the selected phase; for a target with
   no phase, retain the review's ordinary launch/return observations.
4. Present. Show the reviewer's findings unedited - file, line, severity, claim
   and failure scenario - beside the retained target and the selected kind. A
   clean pass names the target that was read; it is never a bare "no findings".
   The owner decides what to change and does it; this command edits nothing.
</process>

<intent>
The binary compiles the intent for the selected kind into the local dispatch
and the provider payload alike:

- decision: {DECISION}
- minimalism: {MINIMALISM}
- plan: {PLAN}

A decision review takes the exact decision line and the whole document as its
inline context. A minimalism review retains the named file, the frozen
directory membership or the native phase range and dispatches the one base
reviewer with no provider and no gate. A plan review by phase retains every
native plan slice with the approved locked context and uses the ordinary
manual-plan trigger with its configured gate; by path it retains that one
document.
</intent>
"#))
}
