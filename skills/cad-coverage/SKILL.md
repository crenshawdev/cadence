---
name: cad-coverage
description: "Read-only alias of /cad-audit: the phase-scoped requirement-to-evidence trace over the retained map and current verdicts; the test-generation arm is removed."
argument-hint: "<phase>"
allowed-tools:
  - mcp__cadence__cadence_query
---

Parse the phase as a positive JSON integer. Call cadence_query
`{"operation":"verification-audit","phase":13,"command":"cad-coverage"}` with the
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

## Shared read contract

Cadence is the only project read surface. Use `cadence_query` with `search` to find source, `read` only with a location or file reference Cadence issued (or a named unit under that reference), and `document` with a process identity to inspect contexts, plans, roadmap rows and task summaries. Never open a project file with a host file tool, shell command, standalone excerpt server, or a path/range invented by the caller.

`search` accepts `{"operation":"search","pattern":"needle","scope":{"kind":"project"}}`; directory and glob scopes use `{"kind":"directory","selector":"src"}` and `{"kind":"glob","selector":"**/*.rs"}`. Named scopes supplied by Cadence, such as `{"kind":"current-task-lease",...}` or `{"kind":"phase-documents","phase":31}`, must be copied unchanged. Follow a hit with `{"operation":"read","location":"<issued location>"}`. For a large file, read its issued `file_reference` to receive an outline, then pass that same `file` with one returned unit name. Follow `continuation` locations exactly; never guess a range or request a whole file by path.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}` or `{"kind":"phase-plan","phase":31,"plan":2}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Follow document continuations exactly. A refusal's issued location or identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed. The dispatch that installed the layer required direct project reads and is not the qualifying round; Codex is not a supported measurement host. Select the actual round boundaries from the host episode, then call `document` with `{"kind":"planner-round","phase":31,"session_id":"<Claude session UUID>","first_turn":"<actual first-turn UUID>","last_turn":"<actual last-turn UUID>"}` and part `report`. Show the owner that binary report unchanged, including its host/session/turn/worker boundaries, source digest, `read_count`, `whole_file_reads`, `unclassified_reads`, the four raw token components and `token_total`, and the numerical difference and ratio against `baseline_planner_median: 183000`. Missing, incomplete, ambiguous, nonzero whole-file or nonzero unclassified results are evidence to retain, never values to replace or a model-authored pass. The historical median's raw samples and aggregation procedure were not supplied, so claim like-for-like savings only after that procedure is confirmed.

This alias keeps the old name for the read-only view only. It never
generates tests, never authors a gap plan and never edits status; a
requirement without failing-capable evidence appears as a broken or unmet
trace for the owner to act on through planning.

Association, for the example phase: a requirement assigned to phase 13 is joined to every current truth of phase 13 through the phase's typed map; no direct requirement-to-truth edge is authored or inferred. The only edges are requirement->phase (a trace
row), phase->roadmap (a declaration), phase->plan (a native publication
naming the requirement), plan->truths (the phase's approved truth set,
phase-scoped), truth->evidence (the current typed map) and evidence->verdict
(the current complete verification). Read-only: no status, map, UAT or store
record is written or repaired.
