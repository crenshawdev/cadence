---
name: cad-review
description: "Review one explicitly selected target - a decision, a minimalism delete-list over code, or a plan - through the native review subsystem."
argument-hint: "decision <document> <decision-id> | minimalism <file|directory|phase> | plan <phase|plan-path>"
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
Cadence serves the project's process records; the project's source is read with the host's own tools. Search and read code with the host's file, search and shell tools: locate first, then read only the lines the work needs rather than whole files. Use `cadence_query` with `document` and `document-search` for Cadence's own records: contexts, plans, roadmap rows, dispatches, verification attempts and task summaries.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the `phase` and `plan` of each identity in the draft answer's `documents` array and the answer's `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.
</read-contract>

<process>
1. Select. Split `$ARGUMENTS` on whitespace and call cadence_query
   `{"operation":"review-select","command":"cad-review","arguments":[<tokens>]}`.
   The first token selects the kind: `decision`, `minimalism` or `plan`; the rest is the target.
   A refused answer names what is missing, ambiguous or unresolvable in its
   reason: report that request and stop. Never widen a target to its parent
   directory, the whole phase or the tree, and never substitute a paragraph of
   your own for the resolved document. Retain answer field `result.kind`, answer field `result.target`,
   answer field `result.material`, answer field `result.intent` and answer field `result.admission`.
2. Admit. Call cadence_apply `{"operation":"review-admit","request":<result.admission, unchanged>}`.
   Only an answer with an admitted fire proceeds; a replayed answer names the
   review already admitted for this selection.
3. Deliver. Call cadence_query `{"operation":"review-next","fire":<fire>}` and
   follow only the saved dispatch: invoke Task with dispatch field `dispatch.agent` and exactly
   dispatch field `dispatch.prompt`, passing dispatch field `dispatch.model` only when present. Forward the
   actual launch and return events with review-observation. Read retained
   material with document identity `{kind: review-entry, attempt, entry}`:
   read its index, compact entry metadata, lines:<n> and text:<n> parts, following
   next. review-material supplies this identity and metadata, never bytes.
   Additional material uses review-material-append with manifest, acquisition
   and the material's `path`; never send bytes.
   Submit the reviewer's unchanged five-field findings array as findings on
   review-return under the issued identity, launch and host_return. Never send
   raw JSON text. The receipt carries only the findings digest and count;
   review-original reads the retained parsed findings and identity. The digest
   hashes the canonical retained object envelope {"findings":[...]} with
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

- decision: Refute the selected decision: argue against it from the retained decision text and its retained inline context, name the claim each objection rests on, and apply no amendment.
- minimalism: Rank code that should not exist, as a deletion list ordered by severity: reinvented standard library or dependency, an abstraction with one implementation, unused flexibility and configuration nobody sets. Propose deletions; apply nothing.
- plan: Work backward from the phase goal and its locked decisions: for each task ask which truth it serves, whether the retained plan can deliver it as written, and whether any step contradicts a locked or durable decision. For each proposed test, ask: does it serve the approved requirement, can its assertion catch the defect it names, and does a fake provide the very decision being tested? Judge the fake relative to the responsibility the test exercises, using plain inputs where they suffice. These questions are advisory to plan submission and add no plan-submit gate. The owner's exact check inspection at execution-plan-complete and the verifier's item verdicts at verification-complete remain required completion judgments. Return findings; edit nothing.

A decision review takes the exact decision line and the whole document as its
inline context. A minimalism review retains the named file, the frozen
directory membership or the native phase range and dispatches the one base
reviewer with no provider and no gate. A plan review by phase retains every
native plan slice with the approved locked context and uses the ordinary
manual-plan trigger with its configured gate; by path it retains that one
document.
</intent>
