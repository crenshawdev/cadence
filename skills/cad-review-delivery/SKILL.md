---
name: cad-review-delivery
description: "Internal invoking contract for retained native review delivery and typed consumers."
user-invocable: false
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

<contract>
This contract governs review admission, dispatch, delivery and consumption in
place of frozen workflow instructions at those boundaries. Keep the workflow's
other steps, diagnosis fix selection and explicit landing authorization.

Admit through `cadence_apply` operation `review-admit`, with `request` carrying
replay_key, caller, project, cycle, home {kind,id}, discriminator, phase/plan or
null, anchor or null, round, target, trigger or specialist (exactly one), and
decision payload or null. Keep one replay key for retries of this occurrence;
a new review gets a new key. Never supply fire, occurrence or attempt IDs.
Use the workflow's actual target: named-file for plans, committed-range for a
completed diff, staged-tree with base/index and null head for staged fixes.
Do not substitute HEAD for staged identity. The binary retains the material.

Ordinary caller names are manual-plan, automatic-plan, execute, task, debug,
verify and pause. The trigger is plan, diff or risk_surface; all ordinary
callers use the binary's configured gate, including deferred. Do not invent a
manual adjudicated default or replace a task's deferred gate with blocking.
Minimalism uses specialist minimalism and a named-file, frozen directory or
phase-range target; it has one base reviewer. Decision uses specialist decision,
selected decision/text/context. Diagnosis uses specialist diagnosis, named
source paths and reported/cause text. Keep the user's later fix selection.

An off response has no dispatch. Otherwise call `cadence_query review-next`
with the admitted fire. Follow only the returned saved dispatch. Invoke Task
with dispatch.agent and exactly dispatch.prompt; pass dispatch.model only when
present. Its absence means omit the model argument and inherit the session.
Never resolve routing again, fan out FIRST choices or substitute another agent.

Bind actual host events, not guessed IDs: submit `review-observation` with the
issued attempt, actual Task launch identifier, a unique observation ID, kind
launch, a bounded event reference, observed_at, and H3 contract. The launch
identifier must be the host's agent_id so SubagentStop can attribute it. Submit
kind return with the actual launch and return identifiers when the host exposes
that event. Unreported model/host/usage stays null. Usage has input, output,
cost and currency, each nullable. Contract is
{schema:"review-1",interpretation:"H1-H5",validator:"H4-1"}.
If the host cannot expose a binding, stop with the attempt pending; never invent
origin. Unknown stop attribution does not close anything.

WAIT for the local return. Submit `review-return` with identity
{fire,occurrence,artifact,view,attempt,round}, launch, host_return, raw,
host_failure and citations. Copy raw text byte-for-byte, preserving whitespace,
quotations, newlines and Unicode. Escape it only for the tool's JSON transport;
never parse/reserialize, summarize or filter the finding payload. Keep missing
text null. Supply citation sidecars only when actually reported; otherwise use
an empty citations array. Do not manufacture observed usage or empty success.
For a definite failed launch or unavailable provider (`dispatch.local:false`),
submit `review-return` with the issued attempt's full identity, launch null,
host_return null, raw null, citations [], the actual reason in host_failure,
and failure_event containing the actual event: kind `launch-failure`, its
bounded observation ID/reference, attempt, observed_at, contract and observed
usage. Unobserved launch, host_return, host and model fields stay null. This
single submission records the observation and terminal failure together; do
not submit it separately as review-observation. An uncertain stop or missing
host facts alone is not definite failure. Never run an unavailable provider's
request under a local voice. Phase 10 owns remote transport.

WAIT for durable acknowledgment. A delivery-write-failed, conflict or refusal
is not completion. Retry the identical return when appropriate, retaining its
identity and bytes. A SubagentStop observation alone cannot deliver missing
raw text or close a review. Neither coordinator nor reviewer writes findings,
review lifecycle records, traces or queue members.

Then query review-next again. Follow its saved next choice or wait state.
Advisory findings remain raw and unruled regardless of severity or combination.
Before continuation under deferred, call review-enqueue and wait for its durable
member receipt. Blocking/adjudicated settlement stays pending for phase 10;
receiving raw findings cannot grant clearance. Do not announce completion,
prepare a commit or dispatch the next plan while delivery/enqueue is owed.

Consumers use review-inventory/review-deferred for saved identities and
review-consumer for their typed inputs: plan-completion, execute-completion,
report, deferred-enqueue, specialist, landing or milestone. Execute/planned-task
fix inputs use the supplied provisional-selected view via execute-fix or
planned-task-fix. Keep raw, provisional-selected and settled separate. Do not
reconstruct joins from REVIEW/ADJUDICATION filenames or hide modern records
because a rendering is absent. Historical records retain their historical
origin; their old filenames are not modern settlement evidence.
</contract>
