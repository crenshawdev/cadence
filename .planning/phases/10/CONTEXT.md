# Phase 10: Provider port - Context

Rewritten 2026-09-09 under `docs/architecture/acceptance.md`. The previous
CONTEXT (187 function-level criteria over eleven capabilities) is in git at
`998f2187:.planning/phases/10/CONTEXT.md`; it is history, not input.
Feeds: /cad-plan 10 (planner dispatch carries the design's Planner block).

## Scope boundary

In: the cross-model review provider arm moves from frozen JavaScript
(`cadence-core/bin/review-provider.mjs`) into the binary - OpenAI, Gemini and
DeepSeek adapters with credential lookup, bounded payloads, transport,
sanitized diagnostics and the outer timeout - using phase 9's delivery
lifecycle for every attempt. GH-237, GH-239 and GH-240 are repaired in that
code as it lands.

Out, parked by the owner's "slow add" rule (2026-09-09): the settlement
verification layer (rulings against originals, fix-commit and citation
checks) is dropped - new behaviour nobody has hit. The filing port with
GH-250/GH-251 is Phase 20. Deferred-review completion (carry, retention,
re-arm) is Phase 21. GitLab is not supported; GitHub is the first-class forge.

## Truths

At most seven. Each is one trigger, one observer, one outcome. The planner
writes exactly one check per truth.

- T1. When a review dispatch goes to a cross-model provider, the run record
  holds the provider's voice, model and usage as observed, never as requested.
- T2. When a provider answers with an error status and usage figures in the
  body, the run record holds those figures and the failure. (GH-239)
- T3. When a provider's usage figures cannot be read as whole numbers, the run
  record marks usage unavailable, never zero. (GH-237, GH-240)
- T4. When a provider returns a usable empty findings list, the run record
  holds an empty result with the provider's voice, distinct from a failure.
- T5. When a provider fails and the local fallback runs, the dispatch closes
  exactly once, with the fallback outcome recorded.

## Durable decisions that bind this phase

Carried verbatim from the 2026-09-07 context; still the owner's decisions.

- D-75 (Provider arms use the delivery lifecycle): Introduce the OpenAI,
  Gemini and DeepSeek review adapters with environment-first credential lookup,
  file fallback, credential fencing, bounded payload/response handling and
  sanitized diagnostics. Refuse over-cap payloads before spending rather than
  silently truncating what a voice reviewed; record the fenced view and its
  material mapping. The native request and outer operation deadlines must
  leave time for a durable failure acknowledgment in the actual host
  (`cadence-core/bin/review-provider.mjs:275`,
  `cadence-core/bin/review-provider.mjs:480`,
  `cadence-core/bin/review-provider.mjs:504`,
  `cadence-core/bin/review-provider.mjs:705`,
  `cadence-core/bin/review-provider.mjs:1055`,
  `cadence-core/references/review-cross-model.md:120`). FIRST is inherited:
  sequential configured attempts stop at the first usable review, including
  an empty array; all failures lead to the local fallback and its actual
  outcome. Reuse phase 9's pending/return/closure records for every attempt,
  including no-key, timeout, malformed response and failed fallback. No second
  trace lifecycle and no invented observed usage or participation
  (`.planning/ROADMAP.md:768`, `.planning/ROADMAP.md:783`,
  `.planning/ROADMAP.md:829`,
  `cadence-core/references/review-cross-model.md:131`). If wrong: one configured
  reviewer spends for a panel, a dead provider leaves an open dispatch, or a
  sanitized fragment is reported as a review of bytes it never received.

- D-76 (GH-237 and GH-240 preserve unavailable usage): The frozen defect is
  precise: tokenCount accepts any finite nonnegative number, including fractions
  and unsafe integers; Gemini converts an invalid component to undefined and
  then adds zero for it when the other component is usable, without a checked
  sum (`cadence-core/bin/review-provider.mjs:988`,
  `cadence-core/bin/review-provider.mjs:1142`). Require bounded nonnegative
  integers and checked addition. Track absent, invalid and valid zero
  separately; an invalid or overflowed candidate/thought count makes the
  normalized Gemini output unavailable, even if its sibling is valid. Omission
  is not evidence of zero unless the provider contract establishes that meaning;
  record the chosen omission rule and its evidence. Valid input usage can still
  survive unavailable output. Keep bounded, sanitized raw usage when available
  (`cadence-core/bin/review-provider.mjs:981`,
  `cadence-core/bin/review-provider.mjs:1005`, `.planning/ROADMAP.md:838`). These
  repairs belong here with the normalizer, under the settled NINE allocation
  now embodied in phase 10 (`.planning/ROADMAP.md:796`,
  `.planning/ROADMAP.md:838`). If wrong: malformed accounting becomes a plausible
  low bill or arithmetic overflow becomes a recorded token count.

- D-77 (GH-239 preserves usage before HTTP refusal): The frozen non-2xx branch
  exits before extractUsage, despite already having the response. Extract valid
  available response usage before status-dependent refusal and retain it on the
  same failed attempt. Still refuse the review; usage does not make error text
  into findings. A response with no usable usage and a pre-request failure both
  retain absence, never a fabricated zero; do not expose unbounded response or
  credential-bearing diagnostics (`cadence-core/bin/review-provider.mjs:1335`,
  `cadence-core/bin/review-provider.mjs:1350`,
  `cadence-core/bin/review-provider.mjs:981`, `.planning/ROADMAP.md:847`).
  If wrong: charged failed calls disappear from accounting or a failed provider
  acquires a false successful review.

## Observations

Evidence a person must see; these cap a truth at `concerns`, never `met`.

- O1. The owner runs one live review against a real provider account and sees
  in the run record the observed voice, model and usage for that dispatch
  (T1), and one deliberately failed provider call closing through the local
  fallback exactly once (T5). Deterministic tests are necessary but
  insufficient: the phase-6 boundary passed 347 tests and did not load in a
  real host.

## Flagged assumptions

- The phase-9 delivery lifecycle records (pending / return / closure per
  attempt) are sufficient to hold every provider outcome named in T1-T5
  without a second trace lifecycle. If wrong, the planner records the gap as
  a deviation rather than widening scope.
