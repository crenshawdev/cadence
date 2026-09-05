# risk_surface review - task excerpt-telemetry

Fired: 2026-09-04, blocking gate, range 6ffa5b1c..8fadf4bb
Detection: `secrets` matched - "changed line: a credential-named assignment"
Reviewer: openai / gpt-5.6-sol, flagship tier, effort high
Findings returned: 3 (2 high, 1 medium). Survivors after adjudication: 0.

## F1 (high) - REFUTED, with one part adopted

Claim: the error path can persist an entire non-string `tool_response` instead
of a one-line cause, so a failing tool's `{request: {authorization: "Bearer
<live-token>"}}` would land in `reads.jsonl`.

Ruling: refuted by the reviewer's own scenario, run verbatim. `errorTextOf`
reads exactly three string fields - `resp.error`, `resp.text`, or the first
`content[].text` - and returns null when none is a string. The object is never
serialized into the record; `bytes` takes `JSON.stringify(resp).length`, a
LENGTH and not the text. The scenario produced
`{"error":"request failed"}` and the token was absent.

Adopted anyway, the part that survived: one of those three strings can itself
carry a credential, and the line is text this process did not author landing in
a durable record. `redactCause` now masks credential-shaped VALUES, keeping the
name, using the same `token|password|passwd|secret|key|api|bearer` vocabulary
the risk detector uses. Not because the claim held, but because the residual it
pointed at is real.

## F2 (high) - REFUTED

Claim: `excerpt_search` routes its complete input through the generic recorder
without the pattern omission `Grep` gets, so a sensitive literal pattern is
stored.

Ruling: refuted. The `excerpt_search` branch copies `ti.path` and nothing else -
it was written as a deliberate mirror of the `Grep` branch and carries that
reason in a comment. The reviewer's own scenario, pattern
`api_key = sk-live-ABC`, produced `{"target":"src"}` with the pattern absent. A
test added before this review already asserts the pattern never appears in the
serialized record.

## F3 (medium) - ACCEPTED AS INTENDED, no change

Claim: recording the two excerpt tools broadens the population behind the
existing record count without a schema version, so a consumer counting records
reports three reads where it used to report one.

Ruling: true, and it is the change's purpose rather than a defect. Before it, a
dispatch that read entirely through excerpt recorded ZERO reads and was
indistinguishable from one that read nothing. Three reads did happen in the
reviewer's example. `summarizeReads` reports `byTool`, so any consumer that
needs the old population can still take it. Recorded here rather than fixed.

## Detection itself

The `secrets` match that fired this gate is the string `JWT_SECRET=(\S+)` in a
new test fixture, written to mirror the existing "Grep records its SCOPE and
never its pattern" test. The reviewer independently reached the same reading. No
credential is committed.
