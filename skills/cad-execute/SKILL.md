---
name: cad-execute
description: "Execute a native phase: the binary composes each executor dispatch from state and owns every task, run and suite receipt."
argument-hint: "[phase number]"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

This front door is rendered by `cadence executor-instructions --frontdoor`
from the compiled `execution::instructions` role. The binary is the only
continuation authority: keep no local execution state, inspect no project
files, reconstruct no task list and approve no evidence on the owner's behalf.

<process>
1. Read the native plan/map identities and complete admission/allocation as described below. Parse the phase into a positive JSON integer and call `mcp__cadence__cadence_query` with `operation: "execute-next"` and that integer as `phase`; never pass an unchanged slash-command string. Do not round, infer, default or repair it.
2. Read the structured envelope. For `complete`, report completion and stop. For `judgment-stop`, display the stop identifiers and stop. For `refused`, `unknown` or `not-applicable`, display `code` and `reason`; when the code is `continuation-refusal` or `reconciliation-required` continue at step 3; when it is `suite-failed`, the one repair launch failed and the next repair is a newly approved gap plan admitted through `execution-extend`, so stop and say so; otherwise stop. For `dispatch`, continue at step 4.
3. Collect the owner's actual answer in the conversation and submit exactly what the owner states, then repeat from step 1: an unanswered plan suite-repair question is answered through `execution-suite-repair-answer`; an unanswered task checkpoint is answered through `execution-task-answer`; a linked Stop is continued or declined through `execution-authorize` naming the same retained `checkpoint`; an unlinked Stop needs later owner approval with `checkpoint` omitted or null; unacknowledged commits are reconciled through `execution-task-progress`. A restart, a summary or an old report is never an answer.
4. Invoke `Task` with `route.choice.agent` and the one-line prompt `Cadence dispatch <dispatch_id>`, substituting only the returned id. Pass `route.choice.model` only when present; otherwise omit the model argument for session inheritance. Use this admitted selection and issue no fresh route query. The agent's own contract supplies its instructions; it reads the dispatch parts through `document`.
5. When the worker you spawned exits, call cadence_apply execution-worker-exit with a fresh request_id, the integer phase, `dispatch: <dispatch_id>`, the actual host, `outcome: exited` or `failed`, and optional detail. Retry the same request if acknowledgment is lost. The binary decides whether the plan is interrupted; do not infer completion from the worker's exit. An unanswered interruption needs the owner's actual execution-authorize answer with `dispatch` naming that id, or owner retirement, before redispatch. A provider delivery is binary-owned and is not reported. An orchestrator that never reports leaves the dispatch issued with no exit or return; the owner's resume decides, with no timeout. Read the executor's digest without interpreting it. The binary holds the closed tasks and receipts; the executor's reply is a digest, not a patch, and a refusal or an Unknown run it reports is displayed and retained, never converted into completion.
6. After the plan's last task closes, the orchestrator collects the owner's exact inspections for every delivered check before requesting `execution-plan-complete`; an exact inspection already recorded after green needs no extra record. Record the host's reported token count for this round through `execution-round-record` with the owner's actual approval before plan completion, using the request described below. Owner records are actual round trips through `mcp__cadence__cadence_apply`, each submitted exactly as the owner states it and shown with the retained bytes it names: the no-subject-stub inspection (`execution-owner-attest`), the separate classification of an Unknown custom-check run (`execution-classify-run`), and the dead-launch absence attestation for a suite launch with no recognized result (`execution-suite-relaunch`). The owner's interpretation is shown beside the binary's observation class and never replaces it.
7. When the executor's digest reports the plan's last task closed, request `execution-suite` with the plan identity and version that `execution-history` reports under `plans` plus the executor's project-relative `proposed_paths`, and wait for its receipt. If it passes, ensure the orchestrator has collected the inspections for the plan's delivered checks as described in step 6, then request `execution-plan-complete` with the version the suite receipt reports; completion needs every delivered check's owner inspection, that passing suite receipt and the existing exact risk settlement (`risk-check` on the plan's dispatch), and passing one gate does not erase another pending gate. If the first launch fails, read its generated plan question, collect and submit the owner's attributed `execution-suite-repair-answer`, and repeat from step 1; the approved answer produces a new retained issue for the repair executor. After that executor reports its `execution-suite-repair` receipt and stops, request the one second suite launch. The executor never requests the suite or completion. Then repeat from step 1.
</process>

The old whole-plan executor patch, and the old rule to run the suite before
committing the final task, are gone: tasks close one at a time through the
binary, the suite is available only after the last task is acknowledged, and
the orchestrator, not the executor, requests it (D-171).

<review_delivery>
Handle a grouped review response before any execution response: run the saved review dispatch through cad-review-delivery and wait for durable return/enqueue acknowledgment. Then retry the original execution query; retain its original bytes. Review dispatch is the only additional agent permitted by this skill. A delivered review is findings, never proof that its fixes are complete; use execute-completion and supplied execute-fix consumer inputs.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</review_delivery>

## Shared read contract

Cadence is the only project read surface. Use `cadence_query` with `search` to find source, `read` only with a location or file reference Cadence issued (or a named unit under that reference), and `document` with a process identity to inspect contexts, plans, roadmap rows and task summaries. Never open a project file with a host file tool, shell command, standalone excerpt server, or a path/range invented by the caller.

`search` accepts `{"operation":"search","pattern":"needle","scope":{"kind":"project"}}`; directory and glob scopes use `{"kind":"directory","selector":"src"}` and `{"kind":"glob","selector":"**/*.rs"}`. A named scope supplied by Cadence, such as `{"kind":"current-task-lease",...}`, must be copied unchanged. `list` takes the same `scope` and no pattern, and returns the files in it, each with a `file_reference`. Follow a hit with `{"operation":"read","location":"<issued location>"}`. For a large file, read its issued `file_reference` to receive an outline, then pass that same `file` with one returned unit name; a file at or under 24KB, or one with no grammar, comes back whole from its `file_reference`. A bounded search answer carries a `cursor`; repeat the identical search with that cursor to continue. Follow `continuation` locations exactly; never guess a range or request a whole file by path.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued location or identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the draft answer's `documents[i].identity.phase`, `documents[i].identity.plan` and `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.

For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed. The dispatch that installed the layer required direct project reads and is not the qualifying round; Codex is not a supported measurement host. Select the actual round boundaries from the host episode, then call `document` with `{"kind":"planner-round","phase":31,"session_id":"<Claude session UUID>","first_turn":"<actual first-turn UUID>","last_turn":"<actual last-turn UUID>"}` and part `report`. Show the owner that binary report unchanged, including its host/session/turn/worker boundaries, source digest, `read_count`, `whole_file_reads`, `unclassified_reads`, the four raw token components and `token_total`, and the numerical difference and ratio against `baseline_planner_median: 183000`. Missing, incomplete, ambiguous, nonzero whole-file or nonzero unclassified results are evidence to retain, never values to replace or a model-authored pass. The historical median's raw samples and aggregation procedure were not supplied, so claim like-for-like savings only after that procedure is confirmed.

## Admission, continuation and owner records

Wire phases are positive JSON integers. Parse a canonical digit spelling into
an integer, preserving its value; refuse decimals, fractions, signs and missing
input instead of rounding or defaulting. Send `"phase":13`, never `"phase":"13"`.
The read-only authoring operation `plan-read` takes the same `"phase":13`;
a decimal legacy address such as `"phase":"27.1"` is its one string form.

Before execute-next, read `plan-read` and `evidence-read` with the integer
phase. Copy the occurrence and each current publication's
plan number, `approval.submission.request_id`, content `revision` and
`map_revision`. Copy canonical check ids and `item_revision` from evidence-read.
Explicitly allocate every ordered task, including tasks delivering no checks
with `checks:[]`; allocate each current canonical check exactly once across
the entire phase. Shared aliases do not create additional closing owners.

Minimal complete admission example (replace every saved identity with the
acknowledged value; include every current plan and task):
```json
{"operation":"execution-admit","request":{"request_id":"admit-13",
"expected_set_version":0,"contract":{"phase":13,"occurrence":"<saved occurrence>",
"plans":[{"plan":1,"publication_request":"<saved publication request>",
"content_revision":"<saved content revision>","map_revision":"<saved map revision>"}],
"allocation":[{"plan":1,"task":"task-A","checks":[{"id":"check/A",
"item_revision":"<saved item revision>"}]},{"plan":1,"task":"task-B","checks":[]}]}}}
```
Initial admission uses expected_set_version 0. A new approved gap identity
needs execution-extend with the current expected_set_version and the complete
expanded contract BEFORE execute-next; preserve prior allocations and outcomes.
An admission or located refusal never repairs state or manufactures approval.

A retained checkpoint id differs from a question/gate id, authorization id and
task id. Read execution-history's checkpoint_history. A linked Stop continues
only with later owner approval naming that same checkpoint. An unlinked Stop
has no checkpoint: later execution-authorize needs actual owner approval with
checkpoint omitted or null. Stop itself never authorizes either continuation.
An execution-worker-exit report may already exist when you return. It never
invalidates a late task close or plan completion; the exit stays in history.
An unanswered interruption requires the owner's execution-authorize answer
with `dispatch` naming that exact issued id before execute-next re-serves it.
There is no timeout or lease expiry; progress shows generations since issue.
The authorization fields are phase, request_id, owner, at, response,
optional checkpoint or dispatch and disposition `approve` or `stop`; preserve the owner's
actual response. A task's question is answered through execution-task-answer.

Use a conventional completion subject with the actual task token, for example
`feat: deliver task-A`. Completion commits must be signed. Git signing and
verify-commit use repository configuration and the server's environment,
including its signing program and key material; there is no Cadence keyring.

The exact Inspection payload is
`{check:{id,item_revision},test_digest,evidence:[red_run,green_run],no_subject_stub}`.
execution-owner-attest takes request_id, task, attempt, expected_version and
`statement:{submission:Inspection,approval:{approved,owner,at,submission:Inspection},supersedes}`.
The approval's submission must echo the exact Inspection; approved is true,
owner and at are nonblank, and supersedes is an optional prior statement id.
Only the owner's actual attributed, timed approval supplies this record.
A prepared payload and the executor's no_subject_stub assertion are not approval.

After the plan's last task closes, the orchestrator records the host's reported
token count through `execution-round-record` with the owner's actual approval,
before `execution-plan-complete`. The request is
`{request_id, plan, expected_version, statement: {submission: {dispatch_id,
host, tokens, wire_bytes}, approval: {approved, owner, at, submission}}}`.
Use the plan identity and current version from `execution-history`; the approval
must echo the exact submission. `tokens` is a positive integer reported by the
host for the real executor round, `host` is nonblank, and `wire_bytes` is optional.
The operation refuses `round-open` before the last task closes and also accepts
a report after plan completion. The binary renders that attributed report beside
the fixed 3.7 median; a mechanism test's literal is never the live measurement.
If the host report is unavailable, retain that absence rather than invent a count.

A malformed wire request reports a bounded supplied field/value; a lifecycle
state-conflict retains source, field, declared and derived. Display the exact
located reason. A JSON-RPC transport error is not an acknowledged domain
refusal; neither result repairs state, and a replay keeps its original receipt.
