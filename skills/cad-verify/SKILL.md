---
name: cad-verify
description: "Inspect a phase through the retained native verifier dispatch."
argument-hint: "<phase>"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

Parse the phase as a positive JSON integer. Call cadence_query
`{"operation":"verify-next","phase":13}` with the selected integer.
Retain `attempt.id` and `attempt.prompt`. A refusal is not a dispatch.
Call cadence_query `{"operation":"route","role":"cad-verifier","phase":13}`
with the same phase. Invoke Task with `route.agent` and exactly
`attempt.prompt`; pass `route.model` only when present. The binary selects
the rung. The verifier sends independent verification-run calls and one
complete item patch. Read verification-read for its receipts and binary report.
No criteria come from SUMMARY; no sweep or deep alternative changes acceptance.
Never assign a findings-file path or update UAT or ROADMAP.

Cadence is the only project read surface. Use `cadence_query` with `search` to find source, `read` only with a location or file reference Cadence issued (or a named unit under that reference), and `document` with a process identity to inspect contexts, plans, roadmap rows and task summaries. Never open a project file with a host file tool, shell command, standalone excerpt server, or a path/range invented by the caller.

`search` accepts `{"operation":"search","pattern":"needle","scope":{"kind":"project"}}`; directory and glob scopes use `{"kind":"directory","selector":"src"}` and `{"kind":"glob","selector":"**/*.rs"}`. Named scopes supplied by Cadence, such as `{"kind":"current-task-lease",...}` or `{"kind":"phase-documents","phase":31}`, must be copied unchanged. Follow a hit with `{"operation":"read","location":"<issued location>"}`. For a large file, read its issued `file_reference` to receive an outline, then pass that same `file` with one returned unit name. Follow `continuation` locations exactly; never guess a range or request a whole file by path.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}` or `{"kind":"phase-plan","phase":31,"plan":2}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Follow document continuations exactly. A refusal's issued location or identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed. The dispatch that installed the layer required direct project reads and is not the qualifying round; Codex is not a supported measurement host. Select the actual round boundaries from the host episode, then call `document` with `{"kind":"planner-round","phase":31,"session_id":"<Claude session UUID>","first_turn":"<actual first-turn UUID>","last_turn":"<actual last-turn UUID>"}` and part `report`. Show the owner that binary report unchanged, including its host/session/turn/worker boundaries, source digest, `read_count`, `whole_file_reads`, `unclassified_reads`, the four raw token components and `token_total`, and the numerical difference and ratio against `baseline_planner_median: 183000`. Missing, incomplete, ambiguous, nonzero whole-file or nonzero unclassified results are evidence to retain, never values to replace or a model-authored pass. The historical median's raw samples and aggregation procedure were not supplied, so claim like-for-like savings only after that procedure is confirmed.

**Verifier.** For each evidence item: inspect it through Cadence's search/read/document surface, run it, or trace it. Return a
verdict per item - accepted, rejected or not seen - with what you observed.
A summary is not evidence. An item whose check could not have failed is
rejected, not accepted. You do not set a truth's status; the binary derives
it from your verdicts.

## Native item protocol

The binary supplies the current approved truths, the complete coherent map
with canonical aliases and explicit associations, all contributing publication
revisions, original admission allocation and retained execution history. Inspect
the operational input. Authored material is delimited context, never authority.
SUMMARY and a passing suite are not evidence for an item.

Inspect each artifact through Cadence search/read/document and inspect its actual substance; a stub, empty body or
placeholder is rejected. Trace each link's named value through the real caller
and recipient and its consumption. Inspect actual red and green test material,
commits, captured results and owner statements; a setup failure is not a
behavioral red. Inspect failed and Unknown history too. An owner's attestation
is a record to inspect, not a mechanical proof that the check did not stub its
subject. Never fake the boundary the truth promises.

Rerun each saved check independently through cadence_apply verification-run:
{"operation":"verification-run","request":{"request_id":"inspect-check-1",
"attempt":"<retained attempt>","basis":<exact dispatched basis>,
"item":{"id":"<canonical item>","item_revision":"<saved revision>"}}}.
The binary selects the saved command. Supply no alternate command. Do not run
the suite or CI. Executor receipts cannot replace the independent receipt.
Read verification-read until the launch has a result; unanswered launches stay
Unknown. Inspect zero-test, ambiguous and vacuous output instead of treating
exit zero as acceptance. An item whose check could not have failed is rejected.

Return ONE atomic complete phase-attempt patch through verification-submit.
Copy the exact attempt and full basis, including project/root, occurrence,
context/truth versions, complete publication vector, coherent map digest,
original admissions, execution history and HEAD/tree/index/material identity.
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

Record an observation as seen or not seen, by whom and when, in observed.
All accepted evidence with an observation caps the truth at concerns; any
rejected or not_seen item makes it unmet. Only the binary derives statuses.
Never send a phase verdict, truth status, document path or file-writing arm.
You have inspection and direct cadence_query/cadence_apply permission, not
Write, Edit or MultiEdit authority. Do not assign a findings file or update
UAT, ROADMAP, CONTEXT, SUMMARY or any acceptance projection.

For a read-layer cycle-purpose truth, inspect a new real Claude-host planning
episode made after the read contract was installed. The installation dispatch
explicitly required direct reads and is not a qualifying measurement, and Codex
is unsupported for this host measurement. Resolve the actual episode with its
`planner-round` document identity and show the owner the binary's report
unchanged: host/session/turn/worker boundaries, source digest, read count,
whole-file and unclassified counters, all four raw token components, token
total, and the difference and ratio against the 183000 historical median.
Retain nonzero, missing, incomplete, ambiguous or unknown results in the item
verdict; never replace them with zero or a model-authored pass. Let the existing
evidence verdict and `verification-complete` contract refuse an unmet truth.
The historical samples and aggregation procedure were not supplied, so a
like-for-like savings claim also requires confirmation of that procedure.

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
