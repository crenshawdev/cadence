# Native provider port

Phase 10, PLAN-1 and PLAN-2. Contract recorded 2026-09-09.

## Usage contract

Each observed count must be an exact whole nonnegative JSON number no greater
than **9007199254740991** (the frozen wire contract's safe-integer bound).
Acquisition uses serde_json `arbitrary_precision`; normalization examines the
decimal digits and exponent without converting through floating point. Strings,
booleans, null, fractions and out-of-bound numbers are invalid. Exact numeric
zeros remain zero. Missing fields remain absent. `Usage` exposes absent and
invalid values as null; provider accounting evidence distinguishes their states.

OpenAI input/output use `input_tokens` and `output_tokens`. DeepSeek uses
`prompt_tokens` and `completion_tokens`. Reasoning tokens are already included in
both output counts and are never added again. Gemini input is `promptTokenCount`;
output is a checked sum of `candidatesTokenCount` and `thoughtsTokenCount` under
the same bound. Invalid components and overflow make output unavailable without
discarding valid input.

**Omission policy:** every omitted normalized count is unavailable. Gemini output
requires both components to be present and valid, including explicit zero. The
Gemini API contract consulted through Context7 on **2026-09-09** defines integer
fields and their meanings, but supplies no guarantee that omission means zero:
<https://ai.google.dev/api/generate-content>. Therefore a present sibling cannot
substitute zero for an absent candidate or thought count.

Other wire sources consulted on 2026-09-09:

- OpenAI Responses: <https://developers.openai.com/api/reference/resources/responses/methods/create>.
- DeepSeek Chat Completions: <https://api-docs.deepseek.com/api/create-chat-completion>.
- Reqwest total deadline and incremental acquisition:
  <https://github.com/seanmonstar/reqwest/blob/master/src/async_impl/request.rs>.

Bounded raw usage is retained even if every normalized count is unavailable.
Its serialized representation must fit **2048 UTF-16 code units** and remain
unchanged under the shared credential fence. Otherwise it is omitted with the
reason `oversized`, `credential-bearing`, `invalid-shape`, or `absent`. Valid
normalized numbers survive raw omission. No price, prompt estimate or requested
value supplies observed usage or cost.

Numeric usage uses the existing attempt and observation operations. The additive
`review.provider_evidence[attempt]` record names its actual usage observation and
stores accounting states, component evidence and bounded raw usage. It shares
`Snapshot.data` and conditional store transactions with the phase-9 lifecycle;
there is no separate provider trace.

## Payload retention

The frozen reviewer brief is compiled into the executable. Admission captures
non-secret provider settings and the trigger's requested effort alongside the
route. Dispatch recovers retained source bytes, fences instruction and artifact,
and measures the combined UTF-16 length with ceiling division by four. The
120000-token default cap excludes only fixed adapter schema additions.

Before transport, `review.provider_payloads[attempt]` records the immutable source
view, exact transformed view, instruction/artifact content identities, original
entry and line maps, delivered byte ranges and positive redaction evidence.
Transformed bytes live in the existing retained-material namespace. Redactions
that can collapse source lines use an explicit entry-range mapping, with both
line maps preserved; they do not assert a false one-to-one line correspondence.
Composition that cannot preserve the fenced mapping is refused before spending.
MaterialDelivery records those transformed digests and the accepted original
names that delivered view.

## Observed identity and recovery

The contacted adapter supplies observed provider identity. Response `model`
(OpenAI/DeepSeek) or `modelVersion` (Gemini) supplies observed model; a missing
model stays null. Requested model and trigger effort remain in `RequestedVoice`.
Accounting and identity are saved before HTTP status refusal and return
acceptance, including charged errors and empty usable results. A non-2xx response
always fails, even if its text contains valid findings. Bounded sanitized raw
usage is independent of the bounded sanitized error excerpt. Missing accounting
stays unavailable. These numeric observations do not contribute to host-role totals.

`review.provider_evidence[attempt].identity` retains bounded, credential-fenced
provider `response_id` and HTTP `request_id` when supplied. The separately named
`native_invocation` and `native_return` identify actual native host events; they
are binary correlation references, never claimed as provider-supplied IDs.
Identity strings over 1024 bytes, blank strings, malformed values and strings
changed by the shared fence remain unavailable. Headers and full response/error
objects are never serialized as evidence.

`cadence_query` with `review-attempt` returns the existing attempt fields plus
`provider_evidence` when available. `review-inventory` exposes the same record in
its `records.provider_evidence` collection, alongside the original phase-9
admissions, attempts, observations, closures and retained material. Reopening
the filesystem store recovers that same namespace.

## Resident deadlines and acknowledgment

These effective, non-secret limits are saved at admission in
`review.provider_settings[fire]`, visible through `review-inventory`:

| Saved field | Effective value |
|---|---|
| `request_timeout_ms` | Positive configured timeout capped at **540000 ms**; default **540000 ms** |
| `provider_work_timeout_ms` | **570000 ms** |
| `acknowledgment_budget_ms` | **30000 ms** |
| `attempt_budget_ms` | **600000 ms** |

The request deadline covers HTTP send and bounded body acquisition. The outer
deadline begins before reading attempt inputs and preparing credentials/payload,
and includes response handling. Expiry drops the actual HTTP read. Preparation
and JSON parsing run off the resident executor; any computation still finishing
after expiry has no authority to send a request or write the store.

Failure acknowledgment runs outside the canceled work future, with the store
owner alive and 30000 ms reserved after the outer deadline. It rereads the saved
attempt, preserves observed usage, and closes through the existing launch-failure
or return operation. A timer alone never acknowledges closure. A genuinely
unavailable store returns a delivery error and remains unacknowledged.
These are Cadence's internal limits; MCP does not inherit a Bash timeout.

`cadence_query review-next` returns provider `state: pending` promptly, then
`state: delivery` with `delivery: pending` while the resident owns the work.
Poll the same fire; later responses may express pending as
`state: delivery, delivery: pending`. The resident owns the worker independently
of any polling request. Closing a poll's reply receiver neither stops work nor
authorizes another request, and the mailbox remains available for other calls.
FIRST visits the saved configured order once, then issues the saved local
fallback once if all providers fail. Only durable closure advances selection.
A killed binary retains phase 9's interrupted/uncertain recovery: never infer a
return or automatically resend a possibly charged request.

Local `state: dispatch` carries the existing dispatch and compiled WAIT guidance.
The host runs it and forwards actual events and unchanged output, then waits for
the durable return receipt. An empty valid findings envelope is usable; missing
or malformed output and definite launch failure are failed outcomes.
Repeated next/return calls reuse immutable closures and originals.

Tokio cancellation behavior was consulted through Context7 on 2026-09-09:
<https://docs.rs/tokio/latest/tokio/macro.select.html> and
<https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html>.

## O1 live-pilot handoff

O1 is carried verbatim from CONTEXT.md dated 2026-09-09, attributed there to the
owner:

> O1. The owner runs one live review against a real provider account and sees
> in the run record the observed voice, model and usage for that dispatch
> (T1), and one deliberately failed provider call closing through the local
> fallback exactly once (T5). Deterministic tests are necessary but
> insufficient: the phase-6 boundary passed 347 tests and did not load in a
> real host.

The owner-seen phase-6 evidence above is preserved. No phase-10 live run or
The phase-10 run is recorded in the table at the end of this section and was
seen by the owner on 2026-09-09. O1 is **seen**; it caps T1 and T5 at
**concerns** under the acceptance design; deterministic tests cannot make or
replace this observation.

Use the resident MCP host opened on the real project. Configure `review.mode`
as `single`, place the desired provider first in `review.reviewers`, and configure
its model at the tier selected by `review.triggers.diff.tier`. Supply credentials
through that host's environment or the supported global `review.key_file`.
Then use these actual public operations:

1. Call `cadence_apply` with an admission for a real retained file, replacing the
   project/cycle/home identifiers and source path with the pilot's values:

   ```json
   {
     "operation": "review-admit",
     "request": {
       "replay_key": "owner-provider-pilot-1",
       "caller": "task",
       "trigger": "diff",
       "specialist": null,
       "project": "pilot-project",
       "cycle": "pilot-cycle",
       "home": {"kind": "phase", "id": "10"},
       "discriminator": "owner-provider-pilot-1",
       "phase": 10,
       "plan": 1,
       "anchor": "owner-provider-pilot",
       "round": 1,
       "target": {"kind": "named-file", "path": "src/example.rs", "head": null}
     }
   }
   ```

2. Take the returned `fire` and `attempt`. Call `cadence_query` with
   `{"operation":"review-next","fire":"<returned fire>"}`. The provider arm
   returns `state: pending`, then `state: delivery` with `delivery: pending`;
   poll the same operation until `delivery` is terminal (`usable-complete` or
   `complete-with-failure`, mirrored in `completion`).
   Repeated polls read the issued attempt and never authorize another spend.
3. Read `{"operation":"review-attempt","attempt":"<returned attempt>"}`,
   then `{"operation":"review-original","original":"<saved original>"}`
   and `{"operation":"review-inventory"}` through `cadence_query`. Compare
   observed provider/model/usage with `requested`, and retain the observation,
   closure and provider response references. Restart the host and repeat these
   reads to confirm recovery.
4. Read `records.provider_settings[fire]` from `review-inventory` and retain
   the effective request, work, acknowledgment and attempt limits from the table
   above. Make a separate deliberate provider failure with a fresh replay key
   and discriminator. Poll `review-next` until it returns `state: dispatch`.
   Run that exact `dispatch` once in the local review host.
5. Forward each actual launch/return event with `cadence_apply` operation
   `review-observation`, putting the event in `observation`. Read retained
   entries with `review-material` using the dispatch's attempt and entry IDs.
   WAIT for the local host's actual return. Call `cadence_apply review-return`
   with `identity: {fire, occurrence, artifact, view, attempt, round}` copied
   from the returned admission/attempt, observed `launch` and `host_return`,
   unchanged `raw`, `failure_event: null`, `host_failure: null` and
   `citations: []`. For a definite launch failure, forward its actual
   `failure_event` and `host_failure` with null launch/host_return/raw. For a
   launched host that produces no return, retain the launch and submit null
   raw/host_return; never invent an empty successful review.
6. Wait for `review-return`'s durable receipt (`durable_terminal_count: 1`).
   Repeat that identical return and confirm `replayed: true`. Poll
   `review-next` for `usable-complete` or `complete-with-failure` according
   to the actual fallback result. Read every issued `review-attempt`, the
   successful fallback's `review-original` if present, and
   `review-inventory`. Confirm exactly one `records.closures[attempt]` for
   each issued provider/fallback, saved provider failures, and the actual local
   voice/findings. Restart the resident and repeat those readbacks and next
   calls: no second fallback, request, original or closure.

Fill this record only from the owner's actual pilot:

| Observer | Observation time | Project/run reference | Successful fire/attempt | Failed fire/provider attempt | Local fallback attempt | Seen/not-seen result |
|---|---|---|---|---|---|---|
| John Crenshaw | 2026-09-09 19:52-19:54 UTC | scratchpad pilot project, `.planning/phases/10/reports/pilot.md`, binary at `ad24e085` | f1 / f1-a1 (openai, observed `gpt-5-mini-2025-08-07`, usage 921/718, one closure) | f2 / f2-a1 (HTTP 401 `invalid_api_key`, usage absent, one closure) | f2 / f2-a2 (host codex, two findings, one closure, replay `true`, equal after restart) | seen |
