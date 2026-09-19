---
phase: 33
plan: 1
requirements: ["T1","T2"]
files: ["crates/cadence/src/execution/boundary.rs","crates/cadence/src/execution/dispatch.rs","crates/cadence/src/execution/model.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution_service_tests.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs","crates/cadence/src/read/instructions.rs","crates/cadence/src/plan/render.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase33_execution.rs","crates/cadence/tests/support/phase31.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase38_suite_gate.rs","crates/cadence/tests/phase13_close.rs","crates/cadence/tests/phase8_dispatch.rs","crates/cadence/tests/phase7_lease.rs","crates/cadence/tests/execution_store.rs","crates/cadence/tests/execution_boundary_compat.rs","crates/cadence/tests/support/phase13.rs","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/phase32_typed_authoring.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P33-1-T1","verify":["cargo nextest run -p cadence --test phase33_execution phase33_dispatch_reads_by_id_as_bounded_parts","cargo nextest run -p cadence --test phase33_execution phase33_superseded_dispatch_read_names_the_changed_part"]},{"id":"P33-1-T2","verify":["cargo nextest run -p cadence --test phase33_execution phase33_execute_next_answers_dispatch_id_and_route","cargo nextest run -p cadence --test mcp"]},{"id":"P33-1-T3","verify":["cargo nextest run -p cadence --test phase12_execution","cargo nextest run -p cadence --test execution_boundary_compat","cargo nextest run -p cadence --test phase8_dispatch"]}]}
---
## Goal

execute-next answers a dispatch id, a route and identities; the worker reads its dispatch by id through document as bounded parts; no prompt and no plan text cross the wire.

## Must be true when done

- T1. When the orchestrator asks execute-next for a phase with an admitted plan, the orchestrator gets a dispatch id and a route and no prompt or plan text in the answer.
- T2. When a worker reads its dispatch by id through document, the worker gets the plan's goal, context, notes, its tasks and its allocated checks as parts, each within the read bound.

## Context

D-185, D-186 and D-192 at .planning/phases/33/CONTEXT.md. Today Success::Dispatch (crates/cadence/src/execution/boundary.rs:61) carries the whole ActiveDispatch and a prompt string, render_native_prompt (crates/cadence/src/execution/render.rs:215) pastes the plan body under a delimiter, and the answer holds the plan text three times: dispatch.body, dispatch.prompt and prompt (34,559 bytes of an 81KB answer on 2026-09-17). DocumentIdentity (crates/cadence/src/read/model.rs:64) has no dispatch arm and phase-plan serves only task parts (crates/cadence/src/read/document.rs:120); the per-dispatch facts already exist as the native operational input (crates/cadence/src/execution/dispatch.rs:149) and admitted_checks (dispatch.rs:115). The resumed dispatch id already hashes the operational state (dispatch.rs:178), which is the binding D-192 names. Eleven test files pin the prompt-bearing answer (Codex grounding 2026-09-17); task 3 moves them in one pass.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P33-T1-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_execution phase33_execute_next_answers_dispatch_id_and_route",
        "expected": {
          "kind": "literal",
          "value": "The execute-next answer for a phase whose admitted plan is authorized is {status: ok, outcome: dispatch, dispatch_id: <64 hex>, expected_execution_version: <n>, route: {choice, inputs}, identities: {dispatch: {kind: dispatch, id}, plan: {kind: phase-plan, phase, plan}, context: {kind: phase-context, phase}}} with no other key; the serialized answer is under 8192 bytes; and no string value in it contains the plan's goal sentinel, the task action sentinel, or the first line of the compiled executor instructions."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_execution.rs",
          "function": "phase33_execute_next_answers_dispatch_id_and_route"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project: submit and approve a native context with one truth, publish one typed plan whose two tasks run python3 -B tests/tiny.py, admit it with a check allocated to the first task, and authorize execution.",
        "call": "Call execute-next with the integer phase; read the answer keys; walk every string value; then call it again and assert the replay answers the same bytes.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project",
        "fakes": []
      },
      "reason": "A prompt, a plan body, a tasks array or an operational copy adds a key or a sentinel and fails the exact-keys or no-sentinel assertion; a re-rendered second answer fails the replay equality.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The orchestrator gets a dispatch id and a route and no prompt or plan text; this is T1's outcome word for word."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P33-T2-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_execution phase33_dispatch_reads_by_id_as_bounded_parts",
        "expected": {
          "kind": "property",
          "value": "For every part the document index of {kind: dispatch, id} lists, the slice body is at most 24576 bytes; the goal, context and notes bodies equal the published plan's typed slots; there is exactly one task:<id> part per executable task whose action and verify equal the plan's task, and exactly one check:<id> part per check allocated to those tasks whose spec and item_revision equal the admitted map's; and the same index read from a second caller on the same resident serves byte-identical parts."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_execution.rs",
          "function": "phase33_dispatch_reads_by_id_as_bounded_parts"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project: submit and approve a native context with one truth, publish one typed plan whose two tasks run python3 -B tests/tiny.py, admit it with a check allocated to the first task, and authorize execution.",
        "call": "Call execute-next to get the dispatch id; call document with {kind: dispatch, id} and no part, then each listed part from caller one and caller two; compare against the plan-submit content and evidence-read.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project; two callers on one process",
        "fakes": []
      },
      "reason": "A part over the bound, a missing task or check part, a goal read from the rendered PLAN.md instead of the typed slot, or a per-caller cache fails one of the equalities.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The worker reads goal, context, notes, its tasks and its allocated checks as parts within the read bound; this is T2's outcome checked for every part."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P33-A-dispatch-identity",
      "spec": {
        "locators": [
          "crates/cadence/src/read/model.rs::DocumentIdentity",
          "crates/cadence/src/read/document.rs::resolve",
          "crates/cadence/src/execution/boundary.rs::Success"
        ],
        "substance": "The dispatch document identity with its parts resolver, the phase-plan goal, context, notes and evidence parts, and the execute-next success payload that carries an id, a route and identities and no prompt field."
      },
      "reason": "Restoring a prompt or body field on the success payload, or serving the dispatch from the rendered PLAN.md, undoes D-185 and D-186.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The payload type is what keeps a prompt off the wire."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The identity is what the worker reads by id."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Dispatch and plan pieces readable by identity

- **ID:** P33-1-T1
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/plan/render.rs, crates/cadence/src/execution/dispatch.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/execution/model.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/tests/phase33_execution.rs, crates/cadence/tests/support/phase31.rs
- **Action:** Red first: add phase33_dispatch_reads_by_id_as_bounded_parts and phase33_superseded_dispatch_read_names_the_changed_part to the new test file and retain the red runs. Then add DocumentIdentity::Dispatch {id} (D-186). The resolver finds the issued dispatch by id in the phase's execution occurrence: the active dispatch's admitted id, or a resumed id the occurrence retains in a new issues map {id -> issue digest, executable task ids, allocated check revisions, plan content_revision, admission_digest, base_sha} written by the same transaction that issues it. Parts, each within the 24,576-byte bound: identity (protocol, instructions version, phase, plan, occurrence, admission_digest, expected_execution_version, set_version, base_sha, head), goal, context, notes (from the published plan's typed slots), task:<id> for each executable task (title, files, action, verify, allocated check ids, current state and checkpoints), check:<id> for each allocated check (spec, item_revision, owning task), completed, continuation, suite, lease, commands, policy and route. A slot longer than the bound is served as numbered continuation parts (notes:2) and the index says so; a part is never refused for size. Phase-plan gains goal, context, notes and one evidence:<item id> part per map item beside its task parts (D-186). D-192: a read of an id whose issue binding no longer matches the current state (a closed or retired task, a later issue over the same admission, a changed content_revision or admission_digest) answers a located refusal dispatch-superseded whose slot names the first changed part and whose value carries the current dispatch id; head and live task state are views and never a mismatch. The support Client gains nothing new; Caller already serves the two-caller reading.
- **Verify:**
  - cargo nextest run -p cadence --test phase33_execution phase33_dispatch_reads_by_id_as_bounded_parts
  - cargo nextest run -p cadence --test phase33_execution phase33_superseded_dispatch_read_names_the_changed_part

### Task 2: execute-next answers a dispatch id, a route and identities

- **ID:** P33-1-T2
- **Files:** crates/cadence/src/execution/boundary.rs, crates/cadence/src/execution/dispatch.rs, crates/cadence/src/execution/model.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/read/instructions.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase33_execution.rs
- **Action:** Red first: add phase33_execute_next_answers_dispatch_id_and_route and retain its red run. Then Success::Dispatch carries {dispatch_id, expected_execution_version, route, identities: {dispatch, plan, context}} and nothing else (D-185): no prompt, no ActiveDispatch, no body. A new native dispatch retains prompt and prompt_digest empty; issue_digest is still retained and compared so a changed operational state issues a new resumed id and supersedes the old one (task 1's binding); the boundary receipt keeps prompt_digest None. Retained records from phases 12, 13, 27 to 30 keep their prompt bytes and digests untouched, and an exact replay of a historical dispatch request answers this shape plus prompt_digest of the retained prompt, never the prompt (D-188). The compiled executor protocol tells the worker that its dispatch id names document {kind: dispatch, id} and lists the parts; the front door step 4 invokes Task with route.choice.agent and a prompt that is the one line 'Cadence dispatch <id>' and nothing more, the agent's own contract being its instructions; the dispatch-answer exemption from the compact-envelope bound in server.rs is removed. The binary regenerates skills/cad-executor-contract/SKILL.md and skills/cad-execute/SKILL.md (D-166).
- **Verify:**
  - cargo nextest run -p cadence --test phase33_execution phase33_execute_next_answers_dispatch_id_and_route
  - cargo nextest run -p cadence --test mcp

### Task 3: Move every prompt-shaped fixture to the identity answer

- **ID:** P33-1-T3
- **Files:** crates/cadence/src/execution_service_tests.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase38_suite_gate.rs, crates/cadence/tests/phase13_close.rs, crates/cadence/tests/phase8_dispatch.rs, crates/cadence/tests/phase7_lease.rs, crates/cadence/tests/execution_store.rs, crates/cadence/tests/execution_boundary_compat.rs, crates/cadence/tests/support/phase13.rs, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/phase32_typed_authoring.rs
- **Action:** Every test that asserts on the execute-next answer's prompt, dispatch.body or dispatch object now asserts on the identity answer and reads the pieces through document {kind: dispatch, id}: phase12_continuation_dispatches_only_unfinished_tasks, phase12_dispatch_contains_admitted_checks_state_and_instructions, phase38_retained_dispatch_prompt_survives_renderer_change (the retained record's prompt bytes, not the answer), phase13_rules_gate_retirement_rehearsal, the phase8_dispatch and phase7_lease exact-digest oracles (legacy renderings keep their retained bytes; the public answer is the new shape), execution_store scoped_writer_confirms_dispatch_complete_blocked_and_observation_public_digests, execution_boundary_compat historical_fixed_dispatch_serialization_omits_route_data, and the execution_service_tests dispatch helpers. mcp.rs assert_decision checks the absence of prompt and body on every answer. The suite is green at the end of this task.
- **Verify:**
  - cargo nextest run -p cadence --test phase12_execution
  - cargo nextest run -p cadence --test execution_boundary_compat
  - cargo nextest run -p cadence --test phase8_dispatch

## Notes

Task 1 lands the identities red then green so task 2 has something for the worker to read before the prompt goes. The worker's host prompt is one line; its instructions are the compiled contract skill, which the Codex preface pastes verbatim until Codex loads skills. Plans 2 to 4 execute under this answer.
