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
