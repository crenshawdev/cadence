# Native provider port

Phase 10, PLAN-1. Contract recorded 2026-09-09.

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
Accounting and identity are saved before return acceptance, including empty
usable results. These numeric observations do not contribute to host-role totals.

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
observation time was supplied. O1 remains **not seen**. An accepted observation
caps T1 at **concerns** under the acceptance design; deterministic tests cannot
make or replace this observation. PLAN-2 completes the failed-call/fallback
portion before the combined live pilot.

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
   returns `state: pending`; poll the same operation until delivery is terminal.
   Repeated polls read the issued attempt and never authorize another spend.
3. Read `{"operation":"review-attempt","attempt":"<returned attempt>"}`,
   then `{"operation":"review-original","original":"<saved original>"}`
   and `{"operation":"review-inventory"}` through `cadence_query`. Compare
   observed provider/model/usage with `requested`, and retain the observation,
   closure and provider response references. Restart the host and repeat these
   reads to confirm recovery.
4. After PLAN-2, make a separate deliberate provider failure with a fresh replay
   key and discriminator. Poll `review-next` through local fallback, execute its
   existing local WAIT/unchanged-return procedure, and inspect the real fallback
   outcome and one closure per issued attempt. The provider failure itself must
   stay visible.

Fill this record only from the owner's actual pilot:

| Observer | Observation time | Project/run reference | Successful fire/attempt | Failed fire/provider attempt | Local fallback attempt | Seen/not-seen result |
|---|---|---|---|---|---|---|
| | | | | | | |
