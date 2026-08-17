# Phase 3: Bounds the review path never stated - Context

Gathered: 2026-08-17
Feeds: /cad-plan 3

## Scope boundary

In: The three places the review path asserts a control it does not hold stop
asserting it. A provider response is bounded by BYTES inside the one
concatenation point, with the request destroyed on a crossing and the HTTP
failure envelope carrying a capped sanitized excerpt rather than the whole body
(RVP-01). Local validation of provider FINDINGS refuses exactly what the
canonical schema refuses - `line <= 0`, empty `file`/`claim`/`failure_scenario`,
unknown keys, and bounded finding counts and field lengths - each with its own
named diagnostic, and both sides of that agreement are machine-evaluated
(RVP-02). `execute.md`'s "timeout or no report" recovery arm names its real
producers instead of a state nothing in the dispatch path can reach, `seams.md`
and the arm agree in the same words under a standing check, and the
`claude-subagent` reviewer stops standing as the one unbounded path beside a
bounded one (WIR-01). Each requirement lands with a check watched failing
against the unpatched code first.

Out: `CONSULT_SCHEMA` / `validateConsult`, which carry the identical validation
gap (D-09) - every stated criterion names findings, and consult output is
dead-end advice rather than triage input. Any config key for the new bounds
(D-03): they are named constants, so no `config-catalog.md` row, no `config.mjs`
write face and no `config-reach` surface moves. The non-streamed-request design
`review-provider.mjs` has carried since the `review.request_timeout_ms` fix, and
the still-open "a reviewer lost to `transport` on a blocking gate is one dropped
line" item beside it in `CAPTURE.md` - both are loudness and transport shape,
not a bound the prose claims. The cost half of this milestone (MSR-03, TRN-02,
PLN-01), which is Phase 4. The one-round re-arm cap `execute.md:286` restates
inline uncapped (phase-2 capture) - the same file, a different claim.

Deferred: None.

Plan shape: multiple plans, same phase - split along the three seams, which
carry no ordering dependency on each other: the `review-provider.mjs` runtime
half (RVP-01), the schema/validator/evaluator half (RVP-02), and the prose plus
`prose-agreement.test.mjs` half (WIR-01). RVP-01 and RVP-02 both touch
`cadence-core/bin/review-provider.mjs` and `review-provider.test.mjs`, so those
two files plus `cadence-core/bin/weight-budgets.json` and
`cadence-core/references/seams.md` get explicit `files:` leases per plan.

## Durable decisions

- D-01 (RVP-01): The byte ceiling is enforced inside the single `request()`
  helper, counting bytes per chunk at the one `data += c` site and calling
  `req.destroy()` once crossed - so `review`, `consult` and `detect-models` are
  all bounded by one change and no second read path can be left half-fixed.
  Evidence: `cadence-core/bin/review-provider.mjs:512-540` (the only body read
  in the file; `req.destroy` is already the established abort mechanism on the
  `timeout` handler at :536), `cadence-core/references/seams.md` (the
  call-review-provider seam names the script as the only HTTP site).
- D-02 (RVP-01): A crossing surfaces as a NEW named `reason` in the seam's
  degradation vocabulary, and `seams.md`'s enumerated reason list gains that
  word in the same edit. Riding `transport` instead would leave the trace and
  the caller unable to distinguish "the provider flooded us" from "the socket
  died", and `config-review.md`'s degradation arm would report the wrong
  condition. `over-cap` is the in-tree precedent for a named bound refusal, and
  a named diagnostic per out-of-grammar input is the v1.4.0 house rule.
  Evidence: `cadence-core/references/seams.md` (the `no-key | transport | http |
  ...` vocabulary and the `over-cap` bound beside it),
  `cadence-core/bin/review-provider.mjs:808-815` (the `fail(reason, detail)`
  pattern and the two reasons already written there).
- D-04 (RVP-01): The HTTP failure envelope carries ONE shape always - a capped
  string excerpt sanitized through the existing shared `lib/redact-url.mjs`
  helper - never a second shape that re-admits a whole small body under another
  name. The three fault-mode tests asserting `detail.body.error.code` are
  rewritten to match on excerpt TEXT; the model-not-found diagnostic they exist
  to protect survives inside the cap, and `config-review.md`'s consumer only
  reports `detail`, so a string still serves it. The rejected alternative was
  cap-then-parse (parsed JSON when the body fits, excerpt when it does not),
  which makes every consumer branch on `typeof detail.body` and satisfies
  "rather than the whole body" only for large bodies. Evidence:
  `cadence-core/bin/review-provider.mjs:813-815` (`fail('http', { status, body:
  res.json || res.raw })` - the whole body today),
  `cadence-core/bin/review-provider.test.mjs` (~:827-873, the three tests and
  their "the user reads WHICH model was refused" comment),
  `cadence-core/bin/lib/redact-url.mjs` (one shared sanitizer, never a per-site
  regex), `cadence-core/workflows/config-review.md:40`.
- D-06 (RVP-02): `FINDING_SCHEMA` ITSELF gains the constraints - `line` minimum
  1, non-empty `file`/`claim`/`failure_scenario`, max field lengths, max
  findings count - and `validateFindings` mirrors every one with its own named
  diagnostic. Both sides move because the criterion is that the refusals are
  "the canonical schema's own"; enforcing bounds only locally while the wire
  schema stays loose leaves the schema decoration in the other direction, which
  is the requirement's exact charge. Evidence:
  `cadence-core/bin/review-provider.mjs:546-568` (schema has
  `additionalProperties:false` and no `minimum`/`minLength`/`max*`),
  `:746-757` (`validateFindings` checks an integer `line`, three string fields
  and `severity`, nothing else), `cadence-core/references/provider-api.md:80-84`
  ("keep the shape we assert on return in sync with the shape we send").
- D-07 (RVP-02): The new constraint keywords RIDE THE WIRE on every adapter, and
  the `stripAdditionalProperties` helper stays the Gemini-only carve-out it is
  today rather than growing a second stripped set. Settled from the provider
  docs 2026-08-17, which is what the analyzer flagged as needing external
  research: OpenAI's structured-output unsupported list is composition keywords
  plus, for objects, `unevaluatedProperties`/`propertyNames`/`minProperties`/
  `maxProperties` and, for arrays, `unevaluatedItems`/`contains`/`minContains`/
  `maxContains`/`uniqueItems` - `minimum`, `minLength`, `maxLength` and
  `maxItems` are supported on base models (fine-tuned models carry extra
  restrictions and Cadence dispatches none). Gemini's JSON-schema page documents
  `minimum`/`maximum` and `minItems`/`maxItems` explicitly. DeepSeek enforces
  nothing server-side and asserts on return, which is what makes local
  validation the guarantee everywhere regardless. Evidence:
  `cadence-core/bin/review-provider.mjs:599-610` (the strip helper),
  `cadence-core/references/provider-api.md:18-21,38-39,57-61` (verified
  2026-07-10, predating this question), OpenAI structured-outputs guide and
  `ai.google.dev/gemini-api/docs/structured-output` (retrieved 2026-08-17).
- D-08 (RVP-02): Agreement between the schema and the validator is proved by a
  keyword-limited JSON-Schema evaluator written in-repo, so BOTH sides of every
  fixture verdict are machine-run and "no third answer" is a green test rather
  than a reviewer's opinion frozen at write time. The repo carries no runtime
  dependency and no `ajv` (`node_modules` holds `typescript`, `@types`,
  `@typescript` and `undici-types` only), and that zero-dep constraint is not
  being spent here. The evaluator covers exactly the keywords `FINDING_SCHEMA`
  uses and nothing more. The rejected alternative was a hand-paired
  (fixture, expected verdict) table in the v1.4.0 grammar-table style, whose
  schema column is asserted by human reading - cheaper, and the drift the
  requirement exists to kill returns unnoticed. Evidence: `node_modules/`
  contents, `cadence-core/bin/review-provider.test.mjs` (the in-process test
  style this joins).
- D-10 (WIR-01): `execute.md`'s recovery arm drops the word "timeout" and names
  its actual producers - the spawn-agent turn cap and a missing or unparseable
  return. User interruption is NOT folded into that arm: the roadmap states it
  is a different condition with a different recovery, so it is named separately
  or left out entirely. Evidence:
  `cadence-core/workflows/execute.md:244-248` (the arm as written),
  `cadence-core/references/seams.md:56-63` ("A turn bound, but no timeout and no
  cancel"; `maxTurns: 200` uniform across all 19 rung files),
  `cadence-core/bin/lib/retired-keys.mjs:58` (`workflow.subagent_timeout`
  retired in v2.7.0 rather than kept as a knob nothing enforces),
  `.planning/spikes/maxturns-cap-behaviour/SPIKE.md:96-115` (C1, measured live:
  a capped executor returns last text, no digest, report file on disk - this
  arm's exact state).
- D-11 (WIR-01): The "same words" agreement between `seams.md` and the arm is
  pinned by a new check in `prose-agreement.test.mjs`, whose charter is exactly
  this class - prose that copies a machine-readable fact must still match that
  fact - and which already pins other `execute.md` phrases and a prior
  `seams.md` spawn-agent misstatement. That check is also the natural
  watched-FAIL-first site for WIR-01, since it reddens against today's "timeout
  or no report" text before a word is changed. A prose-only fix satisfies the
  wording criterion on the day it lands and nothing after. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:1-17` (the charter), `:267-284`
  (execute.md phrases already pinned), `:~531` (a fixed seams.md spawn-agent
  defect already pinned).

## Decisions

- D-03 (RVP-01): The byte ceiling and the excerpt cap are named constants beside
  `DEFAULT_MAX_PROMPT_TOKENS`, not new config keys - no `config-catalog.md` row,
  no `config.mjs` write face, no `config-reach` coverage. A key drags in scope
  the phase goal never states, and v2.7.0's `subagent_timeout` deletion is the
  standing precedent against a knob nothing needs. Evidence:
  `cadence-core/bin/review-provider.mjs:238-249` (the constant-with-resolver
  pattern exists in both styles in this file),
  `cadence-core/bin/lib/retired-keys.mjs:58`,
  `cadence-core/references/config-catalog.md`.
- D-05 (RVP-01): The fail-first proof drives the ceiling through the existing
  `fakeTransport` harness, which grows multi-chunk `data` emission and a
  `res.destroy` the seam can call - today `wire` is `{timeout:true}` or
  `{status, body}` emitted as a single `res.emit('data', wire.body)`, and `res`
  is a bare EventEmitter with destroy only on `req`. Evidence:
  `cadence-core/bin/review-provider.test.mjs:~698-724`, QW-05 (v2.5.0: every
  `review-provider.mjs` failure path fault-injected with a test proving what the
  caller sees).
- D-09 (RVP-02): Scope stays findings-only. `CONSULT_SCHEMA` and
  `validateConsult` have the identical gap in identical code shape, but RVP-02
  and all six stated success criteria name findings, and consult output is
  dead-end advice rather than the triage input this degradation guard protects.
  Mirroring later is a mechanical copy of this phase's shape; it goes to the
  SUMMARY's open items. Evidence: `.planning/REQUIREMENTS.md:22-24`,
  `.planning/ROADMAP.md:223-229`,
  `cadence-core/bin/review-provider.mjs:574-593,760-769`.
- D-12 (WIR-01): The default reviewer's bound is stated where `seams.md` today
  says `claude-subagent` "is exempt" from `over-cap` and "does NOT use this
  seam" - that paragraph gains the sentence naming `maxTurns: 200` as its bound
  - plus the parallel statement in `review-triggers.md`. Stating it anywhere the
  "exempt" wording is not leaves the side-by-side contrast the criterion targets
  intact. Evidence: `cadence-core/references/seams.md` (the `over-cap` bound and
  the exempt sentence in the same passage),
  `cadence-core/references/review-triggers.md:7-11`,
  `agents/cad-executor.md:7` (`maxTurns: 200`, uniform across rung files).

## Acceptance criteria

- [ ] AC1: `node --test cadence-core/bin/review-provider.test.mjs` runs green
      and includes a test where `fakeTransport` emits chunks totalling more than
      the ceiling, whose result is `{ok:false, reason:"<the new word>"}` with
      the request destroyed - not a resolved response carrying the full body.
- [ ] AC2: In the same run, a fault-injected non-2xx response returns
      `detail.body` as a string no longer than the stated cap, containing none
      of the `key=`, `token`, `secret` or `Bearer` substrings planted in the
      injected body.
- [ ] AC3: Calling `validateFindings` on each of `line: 0`, `file: ""`,
      `claim: ""`, `failure_scenario: ""`, an unknown key, a findings array past
      the count bound, and a field past the length bound returns a distinct
      non-null diagnostic string for each - seven different strings, no `null`.
- [ ] AC4: A test runs every fixture through both the in-repo schema evaluator
      and `validateFindings` and asserts the two verdicts match; the run is
      green and the fixture table includes at least one accept case.
- [ ] AC5: `rg -n "timeout or no report" cadence-core/workflows/execute.md`
      returns no match, and the replacement arm's producer wording appears
      verbatim in both `cadence-core/workflows/execute.md` and
      `cadence-core/references/seams.md`.
- [ ] AC6: `node --test cadence-core/bin/prose-agreement.test.mjs` is green and
      contains a check that reddens when either file's wording is changed alone;
      `rg -n "is exempt" cadence-core/references/seams.md` shows the
      `claude-subagent` sentence naming `maxTurns: 200` as its bound.
- [ ] AC7: `.planning/phases/3/SUMMARY.md` records, for each of RVP-01, RVP-02
      and WIR-01, the SHA at which its check was watched failing before the fix
      landed.

## Flagged assumptions

- The model-not-found diagnostic (`error.message` naming the refused model) fits
  inside whichever excerpt cap the plan lands on - Likely; if wrong, D-04's
  rewritten tests pass on a truncated message and the `/cad-config` review arm
  loses the one thing that envelope was read for. The plan sizes the cap against
  the real OpenAI 400 body, not a round number.
- The keyword-limited evaluator (D-08) stays limited: a future
  `FINDING_SCHEMA` keyword it does not implement would silently evaluate as
  "accept" - Likely; if wrong, AC4 goes green on an agreement it never checked.
  The plan makes an unknown keyword throw rather than pass.
