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
Cadence is the only project read surface. Use `cadence_query` with `search` to find source, `read` only with a location or file reference Cadence issued (or a named unit under that reference), and `document` with a process identity to inspect contexts, plans, roadmap rows and task summaries. Never open a project file with a host file tool, shell command, standalone excerpt server, or a path/range invented by the caller.

`search` accepts `{"operation":"search","pattern":"needle","scope":{"kind":"project"}}`; directory and glob scopes use `{"kind":"directory","selector":"src"}` and `{"kind":"glob","selector":"**/*.rs"}`. A named scope supplied by Cadence, such as `{"kind":"current-task-lease",...}`, must be copied unchanged. `list` takes the same `scope` and no pattern, and returns the files in it, each with a `file_reference`. Follow a hit with `{"operation":"read","location":"<issued location>"}`. For a large file, read its issued `file_reference` to receive an outline, then pass that same `file` with one returned unit name; a file at or under 24KB, or one with no grammar, comes back whole from its `file_reference`. A bounded search answer carries a `cursor`; repeat the identical search with that cursor to continue. Follow `continuation` locations exactly; never guess a range or request a whole file by path.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued location or identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the draft answer's `documents[i].identity.phase`, `documents[i].identity.plan` and `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.

For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed. The dispatch that installed the layer required direct project reads and is not the qualifying round; Codex is not a supported measurement host. Select the actual round boundaries from the host episode, then call `document` with `{"kind":"planner-round","phase":31,"session_id":"<Claude session UUID>","first_turn":"<actual first-turn UUID>","last_turn":"<actual last-turn UUID>"}` and part `report`. Show the owner that binary report unchanged, including its host/session/turn/worker boundaries, source digest, `read_count`, `whole_file_reads`, `unclassified_reads`, the four raw token components and `token_total`, and the numerical difference and ratio against `baseline_planner_median: 183000`. Missing, incomplete, ambiguous, nonzero whole-file or nonzero unclassified results are evidence to retain, never values to replace or a model-authored pass. The historical median's raw samples and aggregation procedure were not supplied, so claim like-for-like savings only after that procedure is confirmed.
</read-contract>

<process>
1. Select. Split `$ARGUMENTS` on whitespace and call cadence_query
   `{"operation":"review-select","command":"cad-review","arguments":[<tokens>]}`.
   The first token selects the kind: `decision`, `minimalism` or `plan`; the rest is the target.
   A refused answer names what is missing, ambiguous or unresolvable in its
   reason: report that request and stop. Never widen a target to its parent
   directory, the whole phase or the tree, and never substitute a paragraph of
   your own for the resolved document. Retain `result.kind`, `result.target`,
   `result.material`, `result.intent` and `result.admission`.
2. Admit. Call cadence_apply `{"operation":"review-admit","request":<result.admission, unchanged>}`.
   Only an answer with an admitted fire proceeds; a replayed answer names the
   review already admitted for this selection.
3. Deliver. Call cadence_query `{"operation":"review-next","fire":<fire>}` and
   follow only the saved dispatch: invoke Task with `dispatch.agent` and exactly
   `dispatch.prompt`, passing `dispatch.model` only when present. Forward the
   actual launch and return events with review-observation. Read retained
   material with document identity `{kind: review-entry, attempt, entry}`:
   read its index, compact entry metadata, lines:<n> and text:<n> parts, following
   next. review-material supplies this identity and metadata, never bytes.
   Additional material uses review-material-append with manifest, acquisition
   and an issued location or file reference; never send bytes.
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
   A provider delivery is binary-owned and is not reported. The report uses
   the same Interrupted observation as review-stop; late returns are accepted.
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
- plan: Work backward from the phase goal and its locked decisions: for each task ask which truth it serves, whether the retained plan can deliver it as written, and whether any step contradicts a locked or durable decision. Return findings; edit nothing.

A decision review takes the exact decision line and the whole document as its
inline context. A minimalism review retains the named file, the frozen
directory membership or the native phase range and dispatches the one base
reviewer with no provider and no gate. A plan review by phase retains every
native plan slice with the approved locked context and uses the ordinary
manual-plan trigger with its configured gate; by path it retains that one
document.
</intent>
