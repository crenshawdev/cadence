---
name: cad-audit
description: "Read-only verification audit: every requirement's phase-scoped trace to its plans, truths, evidence and current verdicts, with each broken edge named."
argument-hint: "<phase>"
allowed-tools:
  - mcp__cadence__cadence_query
---

Parse the phase as a positive JSON integer. Call cadence_query
`{"operation":"verification-audit","phase":13,"command":"cad-audit"}` with the
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

Cadence is the only project read surface. Use `cadence_query` with `search` to find source, `read` only with a location or file reference Cadence issued (or a named unit under that reference), and `document` with a process identity to inspect contexts, plans, roadmap rows and task summaries. Never open a project file with a host file tool, shell command, standalone excerpt server, or a path/range invented by the caller.

`search` accepts `{"operation":"search","pattern":"needle","scope":{"kind":"project"}}`; directory and glob scopes use `{"kind":"directory","selector":"src"}` and `{"kind":"glob","selector":"**/*.rs"}`. A named scope supplied by Cadence, such as `{"kind":"current-task-lease",...}`, must be copied unchanged. `list` takes the same `scope` and no pattern, and returns the files in it, each with a `file_reference`. Follow a hit with `{"operation":"read","location":"<issued location>"}`. For a large file, read its issued `file_reference` to receive an outline, then pass that same `file` with one returned unit name; a file at or under 24KB, or one with no grammar, comes back whole from its `file_reference`. A bounded search answer carries a `cursor`; repeat the identical search with that cursor to continue. Follow `continuation` locations exactly; never guess a range or request a whole file by path.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued location or identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the draft answer's `documents[i].identity.phase`, `documents[i].identity.plan` and `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.

For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed. The dispatch that installed the layer required direct project reads and is not the qualifying round; Codex is not a supported measurement host. Select the actual round boundaries from the host episode, then call `document` with `{"kind":"planner-round","phase":31,"session_id":"<Claude session UUID>","first_turn":"<actual first-turn UUID>","last_turn":"<actual last-turn UUID>"}` and part `report`. Show the owner that binary report unchanged, including its host/session/turn/worker boundaries, source digest, `read_count`, `whole_file_reads`, `unclassified_reads`, the four raw token components and `token_total`, and the numerical difference and ratio against `baseline_planner_median: 183000`. Missing, incomplete, ambiguous, nonzero whole-file or nonzero unclassified results are evidence to retain, never values to replace or a model-authored pass. The historical median's raw samples and aggregation procedure were not supplied, so claim like-for-like savings only after that procedure is confirmed.

The audit is the binary's join over the retained records and the owner's
documents as they are. It never repairs a status, seeds a row, infers a
requirement-to-truth edge or completes a phase.

Association, for the example phase: a requirement assigned to phase 13 is joined to every current truth of phase 13 through the phase's typed map; no direct requirement-to-truth edge is authored or inferred. The only edges are requirement->phase (a trace
row), phase->roadmap (a declaration), phase->plan (a native publication
naming the requirement), plan->truths (the phase's approved truth set,
phase-scoped), truth->evidence (the current typed map) and evidence->verdict
(the current complete verification). Read-only: no status, map, UAT or store
record is written or repaired.
