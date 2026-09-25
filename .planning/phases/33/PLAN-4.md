---
phase: 33
plan: 4
requirements: ["T6"]
files: ["crates/cadence/src/review_service.rs","crates/cadence/src/review/returns.rs","crates/cadence/src/review/contract.rs","crates/cadence/src/review/model.rs","crates/cadence/src/review/material.rs","crates/cadence/src/review/material_io.rs","crates/cadence/src/review/originals.rs","crates/cadence/src/review/instructions.rs","crates/cadence/src/review/invoking.rs","crates/cadence/src/review_ingress.rs","crates/cadence/src/phase10_provider_tests.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase33_review.rs","crates/cadence/tests/support/phase31.rs","crates/cadence/tests/phase9_returns.rs","crates/cadence/tests/phase9_material.rs","crates/cadence/tests/phase9_context.rs","crates/cadence/tests/phase9_consumers.rs","crates/cadence/tests/phase13_verification.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/refusal_shape.rs","crates/cadence/tests/apply_routing.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P33-4-T1","verify":["cargo nextest run -p cadence --test phase33_review phase33_review_return_answers_digest_and_count"]},{"id":"P33-4-T2","verify":["cargo nextest run -p cadence --test phase33_review phase33_review_entry_reads_as_bounded_parts"]},{"id":"P33-4-T3","verify":["cargo nextest run -p cadence --test phase9_returns","cargo nextest run -p cadence --test mcp"]}]}
---
## Goal

review-return takes typed findings and answers a digest and a count; review material is read by entry identity as bounded slices and appended by issued location, never as bytes on the wire.

## Must be true when done

- T6. When a reviewer returns findings for a plan, the reviewer gets a digest and a count for the typed findings and no findings echoed back.

## Context

D-190 and D-193 at .planning/phases/33/CONTEXT.md. Today the return request carries raw: Option<String> up to 4 MiB (crates/cadence/src/review_service.rs:60, :975), classify_return collapses the parser's indexed finding errors into malformed-return (crates/cadence/src/review/contract.rs:64), and ReturnReceipt echoes every parsed finding in originals (crates/cadence/src/review/returns.rs:68). Finding already has the five fields (crates/cadence/src/review/model.rs:342). review-material answers the whole retained entry as a JSON integer array (review_service.rs:1172) and review-material-append takes bytes: Vec<u8> (review_service.rs:70). phase13_review_surface_selects_target_and_intent shows the stdio path from review-select through review-admit to a local review-next dispatch on a fixture.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P33-T6-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_review phase33_review_return_answers_digest_and_count",
        "expected": {
          "kind": "literal",
          "value": "For a local review attempt returned with three typed findings, the review-return answer is {status: ok, operation: review-return, result: {attempt, terminal, replayed: false, findings: {digest: <64 hex>, count: 3}, durable_terminal_count, next_selection}} with no other key, the digest equals the SHA-256 of the canonical JSON of the three findings, and a return whose second finding lacks severity is refused with slot findings[1].severity."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_review.rs",
          "function": "phase33_review_return_answers_digest_and_count"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project; select a minimalism review of src/lease.rs through review-select, admit it through review-admit and take the local dispatch from review-next.",
        "call": "Send review-return with the attempt identity, the launch and findings: [three five-field findings]; read the answer keys; hash the findings; send a second return for a fresh attempt with a malformed finding.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project",
        "fakes": []
      },
      "reason": "An echoed originals array adds a key; a raw string return is refused before the receipt; a collapsed malformed-return code fails the slot assertion.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The reviewer gets a digest and a count and no findings echoed back; this is T6's outcome word for word."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P33-A-typed-return",
      "spec": {
        "locators": [
          "crates/cadence/src/review_service.rs::Return",
          "crates/cadence/src/review/returns.rs::ReturnReceipt",
          "crates/cadence/src/read/model.rs::DocumentIdentity"
        ],
        "substance": "The typed review-return request with findings: Vec<Finding>, the receipt with a findings digest and count and no originals, and the review-entry identity that serves retained material as bounded slices."
      },
      "reason": "Restoring raw on the request or originals on the receipt undoes D-193; serving material as integer arrays undoes D-190.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The receipt type is what keeps findings off the return wire."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Typed findings in, digest and count out

- **ID:** P33-4-T1
- **Files:** crates/cadence/src/review_service.rs, crates/cadence/src/review/returns.rs, crates/cadence/src/review/contract.rs, crates/cadence/src/review/model.rs, crates/cadence/src/review/originals.rs, crates/cadence/src/review_ingress.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase33_review.rs, crates/cadence/tests/support/phase31.rs
- **Action:** Red first: add phase33_review_return_answers_digest_and_count and retain its red run. Then the review-return request takes findings: Vec<Finding> (file, line, severity, claim, failure_scenario; the same limits contract.rs enforces today) beside identity, launch, citations and the failure fields; raw on the wire is refused typed-content naming slot raw; a malformed finding is refused with slot findings[<index>].<field> instead of the collapsed malformed-return class (D-193). The binary serializes the typed findings canonically as the retained original bytes, so originals, consumers and history records read exactly as before. ReturnReceipt drops originals and gains findings: {digest, count}; the public answer is {status, operation, result} with nothing else. review-original answers the parsed findings and the entry identity, never raw_bytes.
- **Verify:**
  - cargo nextest run -p cadence --test phase33_review phase33_review_return_answers_digest_and_count

### Task 2: Review material by entry identity

- **ID:** P33-4-T2
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/review_service.rs, crates/cadence/src/review/material.rs, crates/cadence/src/review/material_io.rs, crates/cadence/src/review/invoking.rs, crates/cadence/src/review/instructions.rs, crates/cadence/tests/phase33_review.rs
- **Action:** Add DocumentIdentity::ReviewEntry {attempt, entry} (D-186, D-190): the index lists the entry's metadata part and text:1..n parts of the retained, digest-checked material, each at most the bound with next naming the following part and a title carrying its line range; the attempt-view authorization material.rs applies today is the same gate. review-material answers the entry metadata and the identity, never bytes. review-material-append takes {manifest, acquisition, location} where location is a read location or file reference the binary issued through search or list; the binary reads the bytes itself, retains them as today, and refuses bytes on the wire as typed-content. The local review dispatch prompt and the compiled review instructions tell the reviewer to read entries through document; the paid-provider artifact wire is out of scope (D-190).
- **Verify:**
  - cargo nextest run -p cadence --test phase33_review phase33_review_entry_reads_as_bounded_parts

### Task 3: Review skills and fixtures on the typed wire

- **ID:** P33-4-T3
- **Files:** crates/cadence/src/review/instructions.rs, crates/cadence/src/phase10_provider_tests.rs, crates/cadence/tests/phase9_returns.rs, crates/cadence/tests/phase9_material.rs, crates/cadence/tests/phase9_context.rs, crates/cadence/tests/phase9_consumers.rs, crates/cadence/tests/phase13_verification.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/refusal_shape.rs, crates/cadence/tests/apply_routing.rs
- **Action:** The binary regenerates skills/cad-review/SKILL.md and its three aliases (D-166); tests/mcp.rs pins them. The six raw-return tests in phase9_returns.rs, phase10_fallback_closes_once, the review-material byte readers in phase13_verification (deliver) and phase9_material, and the consumer and context tests that read raw_bytes move to typed findings and the review-entry identity. The suite is green at the end of this task.
- **Verify:**
  - cargo nextest run -p cadence --test phase9_returns
  - cargo nextest run -p cadence --test mcp

## Notes

The paid-provider payload keeps its artifact wire (D-190); nothing in this plan touches review/provider/. Plan 4 runs last and is one of the two candidate rounds for the T7 measurement.
