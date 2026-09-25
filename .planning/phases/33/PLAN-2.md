---
phase: 33
plan: 2
requirements: ["T3","T7"]
files: ["crates/cadence/src/execution/render.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/execution/model.rs","crates/cadence/src/execution/receipts.rs","crates/cadence/src/execution/runner.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution_runner_service.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/verification/inputs.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase33_summary.rs","crates/cadence/tests/support/phase31.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/apply_routing.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase38_suite_gate.rs","crates/cadence/tests/store_staging_clean.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P33-2-T1","verify":["cargo nextest run -p cadence --test phase33_summary phase33_last_close_installs_binary_rendered_summary","cargo nextest run -p cadence --test store_staging_clean"]},{"id":"P33-2-T2","verify":["cargo nextest run -p cadence --test phase33_summary phase33_round_record_renders_tokens_beside_the_median","cargo nextest run -p cadence --test apply_routing"]},{"id":"P33-2-T3","verify":["cargo nextest run -p cadence --test mcp","cargo nextest run -p cadence --test phase38_suite_gate"]}]}
---
## Goal

The binary renders SUMMARY.md from the retained record when a plan's last task closes, and the owner's record of the executor round's token count is rendered beside the 3.7 median.

## Must be true when done

- T3. When a worker closes the last task of a plan, the owner sees a SUMMARY.md the binary rendered from the retained receipts, with no summary text having crossed the wire.
- T7. When one executor round runs under the boundary, the owner sees that round's token number beside the 3.7 median of 142k.

## Context

D-191 at .planning/phases/33/CONTEXT.md, D-111 (owner inspection at plan completion) and D-131 (installed projections). Today render_phase_summary (crates/cadence/src/execution/render.rs:36) renders from the legacy PlanOutcome patch and only the legacy boundary paths install it (crates/cadence/src/store/writer.rs:1210, :1288); the native task and plan transactions persist with no document participants (writer.rs:941, :959), which is why phases 31 and 32 have no SUMMARY.md. Close.completion is the completion commit id (crates/cadence/src/execution/receipts.rs:266), so no summary prose crosses today either; what is missing is the render and install. The 3.7 baseline is the cad-executor median of 141893 tokens per dispatch over 149 dispatches from .planning/trace.jsonl, locked 2026-08-24, where one dispatch was one plan; the record names that basis so the comparison says what it compares.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P33-T3-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_summary phase33_last_close_installs_binary_rendered_summary",
        "expected": {
          "kind": "literal",
          "value": "After execution-task-close of the plan's last task, .planning/phases/<N>/SUMMARY.md exists, the SHA-256 of its bytes equals summary.revision in the close answer, it contains exactly one row '| <plan> | <task> | completed | <commit> | passed |' per closed task, and no request line the test sent during the round contains any line of the installed file other than a 40-hex commit id."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_summary.rs",
          "function": "phase33_last_close_installs_binary_rendered_summary"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project: submit and approve a native context with one truth, publish one typed plan whose two tasks run python3 -B tests/tiny.py, admit it with a check allocated to the first task, and authorize execution.",
        "call": "Run the plan's two tasks through execution-task-start, execution-run red, green and verify, and execution-task-close, recording every request line sent; after the second close read the installed SUMMARY.md and hash it.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project, then the installed file on disk",
        "fakes": []
      },
      "reason": "A summary written by the worker puts its lines on a request; a summary installed only at plan completion leaves the file absent after the last close; a renderer that differs from the installed bytes fails the digest equality.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The owner sees a SUMMARY.md the binary rendered, with no summary text on the wire; this is T3's outcome."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P33-T7-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase33_summary phase33_round_record_renders_tokens_beside_the_median",
        "expected": {
          "kind": "literal",
          "value": "After execution-round-record with tokens 106259 and host 'codex exec' for a plan whose last task is closed, the answer is {status: ok, receipt: {plan, request_id, version}} with no document, and SUMMARY.md contains the line 'Executor round tokens: 106259 against 141893 (3.7 cad-executor median per dispatch, n=149, .planning/trace.jsonl, locked 2026-08-24); host codex exec; wire bytes unmeasured'."
        },
        "test": {
          "file": "crates/cadence/tests/phase33_summary.rs",
          "function": "phase33_round_record_renders_tokens_beside_the_median"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project: submit and approve a native context with one truth, publish one typed plan whose two tasks run python3 -B tests/tiny.py, admit it with a check allocated to the first task, and authorize execution.",
        "call": "Close both tasks as P33-T3-C does, then send execution-round-record with the plan identity execution-history reports, tokens 106259, host 'codex exec', wire_bytes null and the owner approval; read SUMMARY.md.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project, then the installed file on disk",
        "fakes": []
      },
      "reason": "A number typed anywhere but the record, or a summary that does not re-render on the record, leaves the line absent; a record accepted before the last close breaks D-191's round boundary and is refused by the test's earlier negative call.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The owner sees the round's token number beside the 3.7 median in the summary; this is T7's outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P33-A-native-summary",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/render.rs::render_native_phase_summary",
          "crates/cadence/src/execution/history.rs::PlanEvent"
        ],
        "substance": "The renderer that builds SUMMARY.md from native close proofs, plan events, owner records and round records, and the round-record plan event it reads."
      },
      "reason": "Rendering from the legacy PlanOutcome patch, or letting a caller supply summary text, undoes rule 4 for execution.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The renderer is what the owner's file comes from."
        },
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The round record is where the number lives."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: SUMMARY.md rendered from the record at the plan's last close

- **ID:** P33-2-T1
- **Files:** crates/cadence/src/execution/render.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/execution/model.rs, crates/cadence/src/execution/receipts.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution_runner_service.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/verification/inputs.rs, crates/cadence/tests/phase33_summary.rs, crates/cadence/tests/support/phase31.rs
- **Action:** Red first: add phase33_last_close_installs_binary_rendered_summary and retain its red run. Then add render_native_phase_summary(records, plan_records, admissions, phase): heading, status (executing, complete, blocked), one section per admitted plan with its state and version, a table row per task from its close proof (| plan | task | completed | commit | passed |), retired tasks, deviations and failed attempts by id with their evidence, checkpoints with their answers, suite launches with their results, repairs, completion, and the round lines task 2 adds. The native task-close transaction installs it as the phase-summary:<phase> participant (crates/cadence/src/store/filesystem.rs:123) when the closing task leaves its plan with no executable task; native plan transactions (suite result, repair, completion, retirement, round record) reinstall it so the file is never behind the record. The installed bytes are a confirmed binary-owned projection under D-131: source_accounting reads them as HEAD's bytes so the worker's next run and the verifier's source observation are not dirtied by a file the binary wrote. The close answer gains summary: {identity: {kind: phase-summary, phase}, revision} when it installed one. render_phase_summary stays for the legacy patch path; nothing else calls it.
- **Verify:**
  - cargo nextest run -p cadence --test phase33_summary phase33_last_close_installs_binary_rendered_summary
  - cargo nextest run -p cadence --test store_staging_clean

### Task 2: The executor round's token number on the record and in the summary

- **ID:** P33-2-T2
- **Files:** crates/cadence/src/execution/history.rs, crates/cadence/src/execution/runner.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/execution_runner_service.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase33_summary.rs, crates/cadence/tests/apply_routing.rs
- **Action:** Red first: add phase33_round_record_renders_tokens_beside_the_median and retain its red run. Then add the owner operation execution-round-record in the native plan group: {request_id, plan: PlanIdentity, expected_version, statement: {submission: {dispatch_id, host, tokens, wire_bytes}, approval: {approved, owner, at, submission}}} (D-191). It is accepted only when the plan's last task is closed and refused round-open otherwise; tokens is a positive integer the worker's host reported for the round from dispatch to last close, wire_bytes is optional, and the approval echoes the exact submission like every owner record. It is retained as PlanEvent::RoundRecord and replayed by request id. The summary renders one line per record: 'Executor round tokens: <tokens> against 141893 (3.7 cad-executor median per dispatch, n=149, .planning/trace.jsonl, locked 2026-08-24); host <host>; wire bytes <n or unmeasured>'. The apply routing test lists the operation.
- **Verify:**
  - cargo nextest run -p cadence --test phase33_summary phase33_round_record_renders_tokens_beside_the_median
  - cargo nextest run -p cadence --test apply_routing

### Task 3: Instructions, skills and fixtures for the rendered summary

- **ID:** P33-2-T3
- **Files:** crates/cadence/src/execution/instructions.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase38_suite_gate.rs
- **Action:** The executor protocol's Return section says the binary renders SUMMARY.md from the record and the worker writes no summary; the front door gains the step after the last close: record the host's reported token count for the round through execution-round-record with the owner's approval, before execution-plan-complete. The binary regenerates skills/cad-executor-contract/SKILL.md and skills/cad-execute/SKILL.md (D-166) and tests/mcp.rs pins them. Tests that assert the .planning tree is unchanged across a native close (phase12_execution, phase38_suite_gate) account for the installed SUMMARY.md. The suite is green at the end of this task.
- **Verify:**
  - cargo nextest run -p cadence --test mcp
  - cargo nextest run -p cadence --test phase38_suite_gate

## Notes

Task 1 before task 2 because the round line is a summary line. The live number for phase 33 comes from the Codex host's 'tokens used' report for the round that executes plan 3 or plan 4 under plan 1's answer; the orchestrator records it through the new operation and the summary carries it at close.
