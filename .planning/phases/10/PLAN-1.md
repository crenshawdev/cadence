---
phase: 10
plan: 1
requirements:
  - T1
  - T3
  - T4
files:
  - crates/cadence/Cargo.toml
  - Cargo.lock
  - crates/cadence/src/review/mod.rs
  - crates/cadence/src/review_service.rs
  - crates/cadence/src/phase10_provider_tests.rs
  - crates/cadence/src/review/provider/mod.rs
  - crates/cadence/src/review/provider/credentials.rs
  - crates/cadence/src/review/provider/transport.rs
  - crates/cadence/src/review/provider/diagnostics.rs
  - crates/cadence/src/review/provider/openai.rs
  - crates/cadence/src/review/provider/delivery.rs
  - crates/cadence/src/review/provider/payload.rs
  - crates/cadence/src/review/provider/gemini.rs
  - crates/cadence/src/review/provider/deepseek.rs
  - crates/cadence/src/review/provider/usage.rs
  - crates/cadence/src/review/provider/records.rs
  - docs/architecture/provider-port.md
---

# Phase 10: Provider port - Plan 1

## Goal

The cross-model review provider arm runs in the binary: OpenAI, Gemini and
DeepSeek adapters with credential lookup, bounded payloads, transport, sanitized
diagnostics and the outer timeout, every attempt on phase 9's delivery lifecycle,
and GH-237, GH-239 and GH-240 repaired in that code as it lands. This first plan
delivers provider dispatch, retained material, usable results and observed
accounting; PLAN-2 completes failed-call accounting and fallback deadlines.

## Must be true when done

- T1. When a review dispatch goes to a cross-model provider, the run record
  holds the provider's voice, model and usage as observed, never as requested.
- T3. When a provider's usage figures cannot be read as whole numbers, the run
  record marks usage unavailable, never zero. (GH-237, GH-240)
- T4. When a provider returns a usable empty findings list, the run record
  holds an empty result with the provider's voice, distinct from a failure.

## Context

D-75 and D-76 in CONTEXT.md bind this plan unchanged; D-77 is completed by PLAN-2.
Reuse `review_service::next`, `record_observation`, `accept_return`,
`accept_launch_failure` and the `review` namespace in the existing store.
The frozen provider script and wire reference supply port behavior, not a new
trace lifecycle. Settlement, filing and deferred-review completion are outside
this phase. PLAN-2 follows this plan sequentially because it shares files.

## Evidence map

All items bind to the exact truth text in CONTEXT.md rewritten 2026-09-09.
That document supplies no numeric truth version; do not invent one. A subsequent
truth edit requires rebinding the evidence. The five check functions across both
plans are new test names required by the acceptance design, not claims that
production identifiers already exist.

The checks use a temporary project with actual retained source files,
`SessionFactory`, the real review service, `Store` and
`cadence::store::filesystem::Filesystem`. Set up the imported project as in
`gap158_service_tests::fixture`, then admit real material without its admission
or acquisition stubs. Use `execute` with `Apply::Admit`, then `Query::Next` to
cause the dispatch. Read `Query::Attempt`, `Query::Original` and
`Query::Inventory` back through the real store, and reopen its filesystem state
before final assertions. Never construct the expected saved attempt and install
it as a substitute for dispatch, persistence or recovery.

Only the outside world may be controlled: isolated credential environment/file
inputs, provider HTTP responses and the clock. A transport double supplies wire
status, headers and body chunks; it does not return normalized usage, a provider
outcome or a saved record. Admission, adapter selection, request construction,
normalization, delivery and persistence remain real. Preserve this seam through
background work without global environment mutation between concurrent tests.

There are no separate link items: these truths require observed run-record
outcomes, with the complete provider-to-store path exercised by their checks;
they name no additional component handoff to verify independently.

### T1

- **P10-T1-C — check.** File `crates/cadence/src/phase10_provider_tests.rs`,
  function `phase10_provider_records_observed_identity`, registered under
  `server::review_service::phase10_provider_tests`. In one table-driven test,
  admit separate single-reviewer fires for OpenAI, Gemini and DeepSeek. Request
  model alias `requested-alias`; supply response models `served-openai`,
  `served-gemini` and `served-deepseek` respectively (`model`, `modelVersion`,
  `model` on the wire). Each response contains one hand-authored valid finding.
  OpenAI reports input 11/output 5 with reasoning 2 already inside output;
  Gemini reports prompt 13/candidates 3/thoughts 2; DeepSeek reports prompt
  17/completion 7 with reasoning 4 already inside completion. Call the real
  admission/next operations and await the resulting stored closure. Expected:
  the reopened attempts hold the actually contacted provider voice, the served
  model and usage pairs `(11,5)`, `(13,5)`, `(17,7)`; the requested alias remains
  requested evidence only. A row omitting response model and usage leaves those
  observations unavailable, preserving the actual provider voice. No requested
  count, model, effort, token estimate or local-role total becomes observation.
  Boundary real: the complete dispatch and run-record store. Fake: HTTP and
  credential inputs only. Command: `cargo test -p cadence --bin cadence
  server::review_service::phase10_provider_tests::phase10_provider_records_observed_identity -- --exact`.
  Expected command result: exactly one test passes, zero failures; zero selected
  tests is not a pass. Reason: promoting requested identity or dropping actual
  response accounting would change the recovered record.
- **P10-T1-A1 — artifact.**
  `crates/cadence/src/review/provider/credentials.rs`: environment-first lookup
  for all three providers, the explicit-file/XDG/home fallback and non-secret
  missing-key diagnostics. Reason: a configured provider cannot run correctly
  if its credentials come from the wrong source.
- **P10-T1-A2 — artifact.** `crates/cadence/Cargo.toml` and `Cargo.lock`: a native
  async HTTPS dependency and required runtime/JSON features, actually used by
  the binary and compatible with the declared Rust toolchain. Reason: a shell
  or JavaScript dependency would leave the provider arm outside the binary.
- **P10-T1-A3 — artifact.**
  `crates/cadence/src/review/provider/transport.rs`: production HTTPS execution,
  a native request deadline and incremental response acquisition capped at
  4,194,304 bytes. Reason: collecting an unbounded body defeats bounded handling.
- **P10-T1-A4 — artifact.**
  `crates/cadence/src/review/provider/diagnostics.rs`: the shared credential
  fence and bounded diagnostic construction, including cut credential spans.
  Reason: a provider-controlled diagnostic must not persist credentials.
- **P10-T1-A5 — artifact.**
  `crates/cadence/src/review/provider/payload.rs` and its saved material records:
  the fenced instruction/artifact, their content identities, exact delivered
  view, original-material mapping and redaction evidence, retained before
  transport. Reason: a changed payload cannot be attributed to unfenced bytes.
- **P10-T1-A6 — artifact.**
  `crates/cadence/src/review/provider/gemini.rs`: the generateContent adapter,
  Gemini schema dialect, effort, text and observed metadata extraction.
  Reason: a generic OpenAI request cannot execute the Gemini voice.
- **P10-T1-A7 — artifact.**
  `crates/cadence/src/review/provider/deepseek.rs`: the Chat Completions adapter,
  JSON instruction/schema, effort translation and observed metadata extraction.
  Reason: a Responses API request cannot execute the DeepSeek voice.
- **P10-T1-A8 — artifact.**
  `crates/cadence/src/review/provider/records.rs` and recovered provider attempt
  evidence in `Snapshot.data`'s `review` namespace: bounded raw evidence and
  observed identity/accounting tied to the existing attempt and observations.
  Reason: an in-memory result or a second trace cannot establish this run record.
- **P10-T1-O1 — observation, source O1.**
  The owner runs one live review against a real provider account and sees
  in the run record the observed voice, model and usage for that dispatch
  (T1), and one deliberately failed provider call closing through the local
  fallback exactly once (T5). Deterministic tests are necessary but
  insufficient: the phase-6 boundary passed 347 tests and did not load in a
  real host.
  Attribution: the owner, CONTEXT.md dated 2026-09-09. Preserve the owner-seen
  phase-6 evidence; no phase-10 run identifier or observation time is supplied
  there. Record the owner's phase-10 run/attempt references, observer, time and
  seen/not-seen result when available, without inferring them from tests.
  This is the same O1 attached to T5 in PLAN-2, not a second pilot or a check.
  Reason: a deterministic transport cannot establish operation in a real host.
  Accepted O1 still caps T1 at `concerns`; it never makes T1 `met`.

### T3

- **P10-T3-C — check.** Same test file and module; function
  `phase10_invalid_usage_is_unavailable`. Dispatch real provider attempts
  against wire fixtures carrying fractions, negatives, strings, null, booleans
  and out-of-bound numeric values, including 9007199254740992 and a value beyond
  `u64`. Include a fractional numeric lexeme near the integer bound so JSON
  rounding cannot make it valid. For Gemini, put an invalid candidate beside
  valid thoughts and reverse them; also supply two individually valid counts
  whose sum exceeds 9007199254740991. Keep prompt usage 11 in these Gemini rows.
  Include an omitted component beside a valid sibling, entirely absent usage,
  and explicit valid zeros as controls within this one test. Call real
  admission/next and reopen the saved attempts. Expected property: invalid or
  absent counts normalize to unavailable (`null` in `Usage`, not 0); either
  invalid/absent Gemini output component or an overflowed sum makes output
  unavailable while valid input remains 11; explicit valid zeros remain 0.
  Saved accounting evidence distinguishes absent, invalid and valid zero and
  retains safe bounded raw usage when available. Boundary real: parsing,
  normalization, observation persistence and filesystem readback. Fake: wire
  responses/credentials only. Command: `cargo test -p cadence --bin cadence
  server::review_service::phase10_provider_tests::phase10_invalid_usage_is_unavailable -- --exact`.
  Expected: exactly one test passes, zero failures. Reason: unchecked numeric
  conversion or substituting zero for a bad Gemini component changes this record.
- **P10-T3-A1 — artifact.**
  `crates/cadence/src/review/provider/usage.rs`: bounded nonnegative integer
  normalization, checked Gemini addition and separate absent/invalid/zero
  states. Reason: permissive conversion creates plausible but false accounting.
- **P10-T3-A2 — artifact.** `docs/architecture/provider-port.md`, usage contract
  section: the chosen integer bound and omission policy with dated sources.
  Reason: treating omission as zero without a provider guarantee invents usage.

### T4

- **P10-T4-C — check.** Same test file and module; function
  `phase10_empty_provider_result_is_usable`. Configure FIRST with OpenAI before
  Gemini, plus the inherited local fallback. Admit a real retained named file;
  the OpenAI wire response contains `{"findings":[]}` in its normal text
  location. Drive admission/next, wait for durable completion, query again and
  reopen the store. Expected: the OpenAI attempt is `accepted`, its observed
  voice is OpenAI, its saved original contains exactly the empty findings
  envelope, its failure is absent and it has exactly one accepted closure.
  Delivery is `usable-complete`; Gemini and the local fallback were not issued.
  This check causes one usable empty response, rather than fabricating an
  accepted attempt for the selector. Boundary real: adapter, FIRST selection,
  original persistence, closure and store recovery. Fake: HTTP/credentials.
  Command: `cargo test -p cadence --bin cadence
  server::review_service::phase10_provider_tests::phase10_empty_provider_result_is_usable -- --exact`.
  Expected: exactly one test passes, zero failures. Reason: classifying empty
  findings as failure loses the voice and spends on another reviewer.
- **P10-T4-A1 — artifact.**
  `crates/cadence/src/review/provider/openai.rs`: the Responses API request and
  text extraction feeding the existing H4-1 findings validator.
  Reason: a nominal adapter returning a constant empty list proves no review.
- **P10-T4-A2 — artifact.** `crates/cadence/src/review/mod.rs`,
  `crates/cadence/src/review/provider/mod.rs`,
  `crates/cadence/src/review/provider/delivery.rs` and
  `crates/cadence/src/review_service.rs` at `admit`/`next`: a reachable native
  provider branch using saved issuance, observation, return and closure records.
  Reason: an unwired adapter leaves `next` dispatching every voice locally.

## Tasks

### Task 1: Resolve provider credentials

- **Files:** `crates/cadence/src/review/mod.rs`, `crates/cadence/src/review/provider/mod.rs` (new), `crates/cadence/src/review/provider/credentials.rs` (new).
- **Action:** Deliver P10-T1-A1 and register the provider module portion of P10-T4-A2. Port `ENV_VAR`, `providersEnvPath`, `parseEnvFile` and `resolveKey` from the frozen script: nonempty environment values win, otherwise read the explicit `review.key_file` with home expansion, otherwise `${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env`. Preserve comments, optional `export`, quotes and last-assignment behavior. Unreadable/missing files resolve to no key and a diagnostic naming the variable/path, never its contents. Keep secret values out of config snapshots, debug formatting and observations. Make environment and file access replaceable at their outside-world boundary without prescribing a new production interface name.
- **Verify:** `cat crates/cadence/src/review/mod.rs crates/cadence/src/review/provider/mod.rs crates/cadence/src/review/provider/credentials.rs` shows a registered implementation with environment precedence, all three variable names and the actual file fallback; inspect P10-T1-A1 for substance, including absence of secret serialization. This is artifact inspection, not another truth check.

### Task 2: Bound native provider transport

- **Files:** `crates/cadence/Cargo.toml`, `Cargo.lock`, `crates/cadence/src/review/provider/mod.rs`, `crates/cadence/src/review/provider/transport.rs` (new), `crates/cadence/src/review/provider/diagnostics.rs` (new).
- **Action:** Deliver P10-T1-A2, P10-T1-A3 and P10-T1-A4. Add an async Rust HTTPS client compatible with the manifest's Rust 1.90 floor; use reqwest with Rust TLS rather than spawning Node, curl or another program. Enable the Tokio time support and exact JSON-number representation needed at response acquisition; do not round a usage lexeme through floating point before validating it. Port `request`'s bounded acquisition: enforce 4,194,304 received bytes before extending the retained body, stop the wire on overflow, retain status independently from parse success, and expose wire data to the adapter. Disable redirects as in the frozen transport so credentials cannot follow a different endpoint. A real total request deadline must cover connection through body consumption, default 540000 ms; PLAN-2 installs its enclosing operation deadline. Port the shared `redactUrl`/`redactCredentials` behavior once, including authorization echoes, credential names, camelCase names, userinfo and cut spans. Reuse it for outbound fencing and diagnostics. Port `bodyExcerpt`'s 4096-byte sanitization window and 1024-byte final diagnostic cap, with the truncation marker inside the cap and UTF-8-safe cuts. Bound transport errors too; never serialize headers, keys or an unrestricted response/error object. Provide a wire-level test seam, not a fake normalized result. Status-dependent accounting is delivered by PLAN-2, not by an early `error_for_status` inside this transport.
- **Verify:** `cat crates/cadence/Cargo.toml crates/cadence/src/review/provider/transport.rs crates/cadence/src/review/provider/diagnostics.rs` shows the used native dependency, incremental byte accounting before retention, deadline covering body reads, disabled redirects and the shared bounded sanitizer. Inspect the dependency's resolved entry in `Cargo.lock` as P10-T1-A2; a declaration with no production call does not satisfy the artifact.

### Task 3: Dispatch an OpenAI empty review through durable delivery

- **Files:** `crates/cadence/src/review_service.rs` (`admit`, `next`), `crates/cadence/src/review/provider/mod.rs`, `crates/cadence/src/review/provider/openai.rs` (new), `crates/cadence/src/review/provider/delivery.rs` (new), `crates/cadence/src/phase10_provider_tests.rs` (new).
- **Action:** Deliver P10-T4-C, P10-T4-A1 and P10-T4-A2. Write the T4 check first and record its failing run before adding the path. Make `next` branch on the saved provider choice after durable issuance rather than returning `local_dispatch` for a provider. Use the saved admission and retained material, obtain credentials and run a real Responses API request. Port OpenAI's endpoint, authorization, strict finding schema and both text extraction shapes from `ADAPTERS.openai`; use `review::contract`'s existing H4-1 constraints and raw findings acceptance. Bind actual invocation and return observations to the issued attempt, then call the existing return/closure operations before reporting completion. Provider identity is observed only when the provider arm actually runs; no-key is a launch failure with no invented participation. Reuse the existing selector so an accepted empty result stops FIRST. Preserve phase 9's direct `execution_service::review_handoff` caller of `next` as well as the public review query path. Keep the resident request short: start owned async provider work from the durable issued attempt, return a pending/wait result, and let repeated `review-next` read that attempt; do not hold the resident mailbox for an HTTP call. An issued/running attempt is not permission to spend again. Local dispatch still uses the existing WAIT/unchanged-return path. Register the test file as the module named in the evidence map. This is the working end-to-end spine by task 3; subsequent tasks deepen it.
- **Verify:** `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_empty_provider_result_is_usable -- --exact` selects one test and passes with the persisted empty OpenAI original, one closure and no later issued voice specified by P10-T4-C. Record the red and green revisions for this check.

### Task 4: Retain the exact fenced provider payload

- **Files:** `crates/cadence/src/review/provider/mod.rs`, `crates/cadence/src/review/provider/payload.rs` (new), `crates/cadence/src/review/provider/delivery.rs`, `crates/cadence/src/review_service.rs` (`admit`, `next`).
- **Action:** Deliver P10-T1-A5. Compose the provider instruction from the frozen reviewer brief and the admitted review intent, with artifact bytes recovered through `read_material`, never current files/refs. Compile the provider instruction into the Rust source; do not load a user-supplied instruction file. Apply the shared fence to both payload strings before measuring them. Preserve the existing estimate: ceiling of the combined UTF-16 code-unit length divided by four, excluding only the adapters' fixed schema additions. Include the brief inside the measured instruction. Resolve `review.max_prompt_tokens` with default 120000; refuse over-cap material before any HTTP request, never silently truncate it. Snapshot non-secret provider settings at admission alongside the captured route so `next` does not reroute against later configuration. Use the admitted trigger's `Trigger.effort` for provider effort, not the local reviewer's `route.choice.rung`. Persist fenced bytes, content identities, positive redaction evidence whenever text changed, and mapping to the original retained entries/lines before sending. Register transformed entries in the existing retained-material namespace and bind the still-unlaunched attempt's delivered view to them; preserve the immutable source manifest and mapping to it. Record the actual `MaterialDelivery` against those digests. Do not make a saved original claim the unfenced view was delivered, or weaken `delivered_view`'s membership checks. Refuse unavailable/unrepresentable material with an attempt failure instead of sending an invented view.
- **Verify:** `cat crates/cadence/src/review/provider/payload.rs crates/cadence/src/review/provider/delivery.rs` shows recovery of retained bytes, compiled instruction, shared fencing, the complete measured strings and pre-request over-cap refusal, followed by durable transformed content/view/mapping before transport. Inspect P10-T1-A5's saved-record construction against `MaterialView` and `MaterialDelivery`; a redaction count without the delivered bytes/mapping is insufficient.

### Task 5: Add the Gemini review adapter

- **Files:** `crates/cadence/src/review/provider/mod.rs`, `crates/cadence/src/review/provider/gemini.rs` (new).
- **Action:** Deliver P10-T1-A6. Port `ADAPTERS.gemini` using the already wired provider path: fixed Google host, model in the generateContent path, `x-goog-api-key` header, system/user parts, JSON response MIME type and Gemini's schema with `additionalProperties` removed recursively. Preserve the other finding constraints and the configured thinking level. Extract text from the candidate content and observed model from response `modelVersion`, never from the requested path. Carry `usageMetadata` as wire evidence for task 7; do not land the frozen `(answer ?? 0) + (thoughts ?? 0)` arithmetic. Missing/malformed text goes through the same failed-attempt path and no adapter fabricates an empty list. Do not port model discovery or consult commands.
- **Verify:** `cat crates/cadence/src/review/provider/mod.rs crates/cadence/src/review/provider/gemini.rs` shows the reachable generateContent adapter with its real endpoint, header, schema transformation, response text and `modelVersion` source. Inspect P10-T1-A6; a base-URL substitution or constant result is rejected.

### Task 6: Add the DeepSeek review adapter

- **Files:** `crates/cadence/src/review/provider/mod.rs`, `crates/cadence/src/review/provider/deepseek.rs` (new).
- **Action:** Deliver P10-T1-A7. Port `ADAPTERS.deepseek` on the shared delivery/transport path: Chat Completions endpoint, bearer authorization, system/user messages and `response_format` JSON-object mode. Inject the bare finding schema with the instruction requiring JSON; do not wrap it in an object that invites the provider to return the schema itself. Translate `minimal` effort to `low`, preserve the other supported effort values, and read `choices[0].message.content` plus the response's observed `model`. Carry the provider usage object to task 7 without adding reasoning tokens to completion tokens. Keep findings validation in the existing H4-1 path; DeepSeek's JSON mode does not validate the schema for Cadence.
- **Verify:** `cat crates/cadence/src/review/provider/mod.rs crates/cadence/src/review/provider/deepseek.rs` shows the reachable Chat Completions request, bare-schema instruction, effort translation and response extraction. Inspect P10-T1-A7; an OpenAI Responses request is insufficient.

### Task 7: Preserve unavailable usage during normalization

- **Files:** `crates/cadence/src/review/provider/mod.rs`, `crates/cadence/src/review/provider/usage.rs` (new), `crates/cadence/src/review/provider/records.rs` (new), `crates/cadence/src/review/provider/delivery.rs`, `crates/cadence/src/phase10_provider_tests.rs`, `docs/architecture/provider-port.md` (new).
- **Action:** Deliver P10-T3-C, P10-T3-A1 and P10-T3-A2, and the accounting portion of P10-T1-A8. Write the T3 check before normalization and record red; its valid-input/zero controls must prevent a permanently-null implementation from passing. Repair `tokenCount`, `usageOf` and Gemini `extractUsage` as this normalizer lands: require exact whole nonnegative numeric values no greater than 9007199254740991, reject lossy/fractional conversion, and check addition against that same bound. Read OpenAI input/output directly, DeepSeek prompt/completion directly and Gemini prompt plus checked candidate/thought sum. Preserve input when output is unavailable. The chosen omission rule is unavailable for every omitted normalized count; Gemini output requires both components to be present and valid, including explicit zero. The consulted Gemini API contract defines integer fields and their meanings but supplies no omission-equals-zero guarantee. Record that conservative rule, the 2026-09-09 consultation and `https://ai.google.dev/api/generate-content` in the documentation. Keep distinct absent/invalid/valid-zero accounting evidence tied to the existing attempt. Retain raw usage even when normalized values are unavailable if it is safe and within the frozen 2048 UTF-16-code-unit serialized bound; omit oversized or credential-bearing raw objects with an explicit retention reason, preserving any valid normalized values. Use the shared fence for that decision. Persist through existing conditional store transactions and observation operations; do not extend every historical `Attempt` literal or create a separate lifecycle. No prices or request estimates become observed cost. Preserve numeric evidence until validation, including large fractional JSON lexemes.
- **Verify:** `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_invalid_usage_is_unavailable -- --exact` selects one test and passes with the reopened-record property in P10-T3-C. Record its red and green revisions. The source and documented omission rule are also the artifacts this task delivers; do not add a normalizer-function acceptance check.

### Task 8: Record the provider identity actually observed

- **Files:** `crates/cadence/src/review/provider/records.rs`, `crates/cadence/src/review/provider/delivery.rs`, `crates/cadence/src/review_service.rs` (`Query::Attempt`, `Query::Inventory`), `crates/cadence/src/phase10_provider_tests.rs`, `docs/architecture/provider-port.md`.
- **Action:** Deliver P10-T1-C and finish P10-T1-A8; carry P10-T1-O1 into the live-pilot handoff. Write T1's check and observe red before completing model/accounting attribution. Persist the contacted adapter's provider identity and response model/usage as observations on the issued attempt; absence stays absent, while `RequestedVoice` retains the requested model/effort separately. Preserve actual response/invocation references without passing off a binary-generated correlation ID as a provider-supplied ID. Make the bounded provider accounting evidence recoverable through the existing inventory/attempt operations, while actual numeric observations use the existing attempt usage. Save this evidence before accepted-return acknowledgment, including empty accepted results, with no second provider trace or addition into host-role totals. In the documentation carry O1 verbatim, name the actual public admission/next/readback procedure after implementation, and leave observer/time/run references unfilled until the owner supplies them. Treat O1 as observation with the design's `concerns` cap, not an automated check or an executor claim of live success.
- **Verify:** `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_provider_records_observed_identity -- --exact` selects one test and passes with the literal observed model/usage records and absence behavior in P10-T1-C. Record red and green revisions. O1 requires the attributed live record, not this test result.

## Notes

- This is an 8-task plan followed by PLAN-2's 3 tasks. Eleven distinct concerns
  exceed the per-plan ceiling. The dispatch explicitly permits sequential
  shared-file plans, overriding the role contract/template's independence-only
  split wording. Do not run these plans in parallel.
- Artifact-only tasks use a single `cat` invocation to open their exact source
  artifacts and require inspection for the stated substance. They do not create
  more acceptance tests. Test-bearing tasks run only their named truth check;
  the executor records the commit identifiers for red before implementation and
  green afterward in its evidence patch. Zero
  tests selected is a verification failure. Test style beyond these checks is
  the project's stream, not another evidence map.
- Existing phase-9 attempt, observation, retained-material and closure records
  are sufficient for the lifecycle. The additive provider metadata is needed
  because `Usage` has only input/output/cost/currency and no raw evidence or
  omission state. Keeping this metadata in the same `review` namespace is a
  representation addition, not a second lifecycle or acceptance-system port.
- The actual host here is the resident MCP server, not the frozen Bash script.
  `recall::Resident::spawn_with_driver` awaits each request in one mailbox.
  Consequently native provider work must not block that mailbox for minutes.
  The pending/poll path in task 3 uses the existing attempt as its durable job;
  PLAN-2 bounds the background operation and its failure acknowledgment.
- Native HTTP documentation consulted through Context7 on 2026-09-09:
  `https://github.com/seanmonstar/reqwest/blob/master/src/async_impl/request.rs`
  documents a total request deadline through response-body completion;
  `https://github.com/seanmonstar/reqwest/blob/master/_autodocs/response.md`
  documents incremental `chunk` reads. Preserve those properties with the
  dependency version compatible with this tree, rather than selecting an
  incompatible latest release.
- The old `.planning/phases/10/MANUAL.md` describes superseded scope. It is not
  acceptance input and is not expanded or migrated here. O1 stays in this map.
- The planner runs no build, tests or clippy and makes no commit. The executor
  runs the full suite once at this plan's close, as the acceptance design
  requires, outside task Verify. Run `cargo clippy --workspace --all-targets --
  -D warnings` after the last code change; it reads nothing on stdin. The
  verifier runs only the mapped checks and inspects the other evidence.
