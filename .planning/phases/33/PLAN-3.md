---
phase: 33
plan: 3
requirements: ["T4","T5"]
files: ["crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs","crates/cadence/src/execution_runner_service.rs","crates/cadence/src/execution/receipts.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/verification/persistence.rs","crates/cadence/src/verification/dispatch.rs","crates/cadence/src/verification/inputs.rs","crates/cadence/src/verification/instructions.rs","crates/cadence/src/verification/model.rs","crates/cadence/src/verification/verdicts.rs","crates/cadence/src/verification/status.rs","crates/cadence/src/verification/render.rs","crates/cadence/src/verification_service.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase33_verification.rs","crates/cadence/tests/support/phase31.rs","crates/cadence/tests/support/phase13.rs","crates/cadence/tests/phase13_verification.rs","crates/cadence/tests/phase13_support.rs","crates/cadence/tests/phase13_close.rs","crates/cadence/tests/phase37_rejected_checks.rs","crates/cadence/tests/refusal_shape.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase38_suite_gate.rs","crates/cadence/tests/phase34_blocked_path.rs","crates/cadence/tests/phase36_released_checks.rs","crates/cadence/tests/execution_terminal_reopen.rs","crates/cadence/tests/phase31_read_layer.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P33-3-T1","verify":["cargo nextest run -p cadence --test phase33_verification phase33_run_output_reads_as_bounded_text_slices"]},{"id":"P33-3-T2","verify":["cargo nextest run -p cadence --test phase33_verification phase33_verify_next_answers_attempt_id_and_identities"]},{"id":"P33-3-T3","verify":["cargo nextest run -p cadence --test phase13_verification","cargo nextest run -p cadence --test phase37_rejected_checks","cargo nextest run -p cadence --test mcp"]}]}
---
## Goal

verify-next answers an attempt id and identities, run output is read by identity as bounded text, verification-submit names the attempt, and history and verification-read answer bounded indexes.

## Must be true when done

- T4. When the verifier asks verify-next, the verifier gets an attempt id and identities and no attempt inputs or captures in the answer.
- T5. When any caller reads a retained run's output by identity, the caller gets a bounded text slice that says where to continue.

## Context

D-187, D-188 and D-189 at .planning/phases/33/CONTEXT.md; GH-262 and GH-263 closed 2026-09-16 (captures are text from now on, old runs stay arrays). Today verify-next answers the whole Attempt (crates/cadence/src/verification_service.rs:130): 2,816,672 bytes on phase 31, of which inputs.execution is 2,117,384 and the prompt 502,127; dispatch::prompt compacts only its copy (crates/cadence/src/verification/dispatch.rs:6). verification-submit requires the full Basis (crates/cadence/src/verification/model.rs:39) and twelve tests build it. execution-history with run answers the whole capture as text with no slice (crates/cadence/src/execution_runner_service.rs:88) and without run answers 1.7MB of events; the runner caps a capture at 65,536 bytes (crates/cadence/src/execution/runner.rs:379), under three parts. The document slice answer has no next field today (crates/cadence/src/read/document.rs:340).

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P33-T4-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_verification phase33_verify_next_answers_attempt_id_and_identities",
        "expected": {
          "kind": "literal",
          "value": "The verify-next answer for a phase whose admitted plans are complete is {status: ok, attempt: {schema, id: <64 hex>, request_id}, identities: {attempt: {kind: verification-attempt, phase, attempt}, context: {kind: phase-context, phase}, plans: [{kind: phase-plan, phase, plan}]}, route: {choice, inputs}} with no other key; the serialized answer is under 8192 bytes; and the exact replay of the same request_id answers the same bytes."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_verification.rs",
          "function": "phase33_verify_next_answers_attempt_id_and_identities"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project: submit and approve a native context with one truth, publish one typed plan whose two tasks run python3 -B tests/tiny.py, admit it with a check allocated to the first task, and authorize execution. Then close both tasks, record the owner inspection, run execution-suite and execution-plan-complete so the phase is complete.",
        "call": "Call verify-next with a request_id; read the answer keys and size; call it again with the same request_id.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project",
        "fakes": []
      },
      "reason": "An attempt with inputs or a prompt, or a capture anywhere in the answer, adds a key or exceeds the size; a re-observed second answer fails the replay equality.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The verifier gets an attempt id and identities and no inputs or captures; this is T4's outcome word for word."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P33-T5-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_verification phase33_run_output_reads_as_bounded_text_slices",
        "expected": {
          "kind": "property",
          "value": "For any retained run, every stdout:<n> and stderr:<n> part the run-output index lists has a body of at most 24576 bytes, every part but the last carries next naming the following part, the last carries next null, and the concatenation of the parts equals the capture's bytes decoded as UTF-8 with replacement; including a run whose stdout capture is the runner's 65,536-byte maximum."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_verification.rs",
          "function": "phase33_run_output_reads_as_bounded_text_slices"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project: submit and approve a native context with one truth, publish one typed plan whose two tasks run python3 -B tests/tiny.py, admit it with a check allocated to the first task, and authorize execution. The plan's second task verify command prints 70,000 bytes to stdout before its unittest summary.",
        "call": "Run a red, a green and the large verify run; for each run id call document with {kind: run-output, phase, run} and then each listed part; concatenate and compare with the capture read back from the store snapshot.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project; the store snapshot on disk",
        "fakes": []
      },
      "reason": "A part over the bound, a missing next, or a capture served as an integer array or with bytes dropped fails the size, chaining or equality assertion.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Any caller gets a bounded text slice that says where to continue; this is T5's outcome checked for every part of every run."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P33-A-attempt-identity",
      "spec": {
        "locators": [
          "crates/cadence/src/read/model.rs::DocumentIdentity",
          "crates/cadence/src/verification/model.rs::Patch",
          "crates/cadence/src/execution_runner_service.rs"
        ],
        "substance": "The run-output and verification-attempt identities with their parts, the verification-submit patch that names the attempt and carries verdicts only, and the bounded execution-history and verification-read indexes."
      },
      "reason": "A submit that copies the basis, or a history answer that carries event bodies, puts the attempt back on the wire.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The attempt identity is what the verifier reads instead of the inputs."
        },
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The run-output identity is the slice's address."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Run output by identity as bounded text

- **ID:** P33-3-T1
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/execution_runner_service.rs, crates/cadence/src/execution/receipts.rs, crates/cadence/src/execution/history.rs, crates/cadence/tests/phase33_verification.rs, crates/cadence/tests/support/phase31.rs
- **Action:** Red first: add phase33_run_output_reads_as_bounded_text_slices and retain its red run. Then add DocumentIdentity::RunOutput {phase, run} (D-186, D-187): the index lists launch, result and stdout:1..n, stderr:1..n where each chunk is at most the bound, cut at a UTF-8 boundary, in order; launch and result carry the retained metadata (stage, check, material, disposition, observation, digests, byte lengths, completeness) and never a capture; a capture retained as an integer array is decoded with replacement, one retained as text is served as is, and the retained bytes are untouched. Every document-slice answer gains next: the following part's name or null, so any part says where to continue; the existing identities answer next null except a numbered continuation. execution-history with run answers launch and result metadata and the run-output identity, never the capture.
- **Verify:**
  - cargo nextest run -p cadence --test phase33_verification phase33_run_output_reads_as_bounded_text_slices

### Task 2: verify-next answers an attempt id; verification-submit names it

- **ID:** P33-3-T2
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/verification/persistence.rs, crates/cadence/src/verification/dispatch.rs, crates/cadence/src/verification/inputs.rs, crates/cadence/src/verification/model.rs, crates/cadence/src/verification/verdicts.rs, crates/cadence/src/verification_service.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase33_verification.rs
- **Action:** Red first: add phase33_verify_next_answers_attempt_id_and_identities and retain its red run. Then verify-next answers {attempt: {schema, id, request_id}, identities, route} where route is the cad-verifier resolution the front door queried separately until now (D-189); the retained Attempt keeps inputs for its digests, records from phases 12, 13 and 27 to 30 are unchanged, and a new attempt retains no prompt (prompt empty, prompt_digest of the empty string; contribute accepts that for new attempts and the retained prompt for old ones). Exact replay of a historical verify-next request answers this shape with the retained attempt id, not the attempt (D-188). DocumentIdentity::VerificationAttempt {phase, attempt} serves basis, truths, publications, admissions (ids and digests), check:<id> (spec, item_revision, and the pairs, owner statements and classifications that bear on it), plan:<n> (that plan's execution view: tasks, runs by id with run-output identities, close, suite runs, outcome) and report (the rendered verification report) as parts within the bound. verification-submit takes {request_id, attempt, items} and binds the basis from the retained attempt; a basis on the wire is refused typed-content naming slot patch.basis.
- **Verify:**
  - cargo nextest run -p cadence --test phase33_verification phase33_verify_next_answers_attempt_id_and_identities

### Task 3: Bounded history and verification-read; verifier contract and fixtures

- **ID:** P33-3-T3
- **Files:** crates/cadence/src/execution_runner_service.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/verification_service.rs, crates/cadence/src/verification/status.rs, crates/cadence/src/verification/render.rs, crates/cadence/src/verification/instructions.rs, crates/cadence/tests/support/phase31.rs, crates/cadence/tests/support/phase13.rs, crates/cadence/tests/phase13_verification.rs, crates/cadence/tests/phase13_support.rs, crates/cadence/tests/phase13_close.rs, crates/cadence/tests/phase37_rejected_checks.rs, crates/cadence/tests/refusal_shape.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase38_suite_gate.rs, crates/cadence/tests/phase34_blocked_path.rs, crates/cadence/tests/phase36_released_checks.rs, crates/cadence/tests/execution_terminal_reopen.rs, crates/cadence/tests/phase31_read_layer.rs
- **Action:** D-188: execution-history without run answers a bounded index: schema, phase, plans with state and version, each plan's tasks with state, version, run ids, close request id and checkpoint ids, the active dispatch id, repaired ids, and identities for document; no event bodies, no prompt, no captures; the answer stays under the 65,536-byte read bound and says incomplete with a plan selector when it would not. verification-read answers the current rows, counts, waivers, advice, humans and completion plus attempt ids with their verification-attempt identities; the report and the runs are read through the identity. The verifier contract and front door tell the verifier to read the attempt's parts and run outputs by identity and to submit {request_id, attempt, items}; the binary regenerates skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-audit/SKILL.md and skills/cad-coverage/SKILL.md (D-166). The twelve tests that build a full-basis patch (phase13_verification, phase13_support, phase13_close, phase37_rejected_checks and the two support helpers), Client::wait_for_event and every test that reads history events or attempt.inputs move to the index, the identities and the attempt-named patch. The suite is green at the end of this task.
- **Verify:**
  - cargo nextest run -p cadence --test phase13_verification
  - cargo nextest run -p cadence --test phase37_rejected_checks
  - cargo nextest run -p cadence --test mcp

## Notes

Task 1 first because the attempt identity's plan parts name run outputs. The verifier's route joins the answer so the front door stops issuing its own route query. The phase 32 owner-record rule holds: the verifier's patch is verdicts only.
