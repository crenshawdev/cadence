---
phase: 31
plan: 7
requirements: ["T6"]
files: ["crates/cadence/src/read/instructions.rs","crates/cadence/src/read/mod.rs","crates/cadence/src/server.rs","crates/cadence/src/main.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/context/instructions.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/verification/instructions.rs","crates/cadence/src/review/instructions.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/review/invoking.rs","crates/cadence/src/review/provider/payload.rs","docs/architecture/read-layer-hosts.md","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/support/phase31_hosts.rs","crates/cadence/tests/support/phase31.rs","skills/cad-context/SKILL.md","skills/cad-plan/SKILL.md","skills/cad-executor-contract/SKILL.md","skills/cad-execute/SKILL.md","skills/cad-verifier-contract/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-review/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-plan-review/SKILL.md","skills/cad-audit/SKILL.md","skills/cad-coverage/SKILL.md","skills/cad-read-contract/SKILL.md","agents/cad-assumptions-analyzer-high.md","agents/cad-assumptions-analyzer-low.md","agents/cad-assumptions-analyzer-max.md","agents/cad-assumptions-analyzer-medium.md","agents/cad-assumptions-analyzer.md","agents/cad-executor-low.md","agents/cad-executor-max.md","agents/cad-executor-medium.md","agents/cad-executor-xhigh.md","agents/cad-executor.md","agents/cad-plan-checker-high.md","agents/cad-plan-checker-max.md","agents/cad-plan-checker-medium.md","agents/cad-plan-checker-xhigh.md","agents/cad-plan-checker.md","agents/cad-planner-low.md","agents/cad-planner-max.md","agents/cad-planner-medium.md","agents/cad-planner-xhigh.md","agents/cad-planner.md","agents/cad-reviewer-low.md","agents/cad-reviewer-max.md","agents/cad-reviewer-medium.md","agents/cad-reviewer-xhigh.md","agents/cad-reviewer.md","agents/cad-verifier-low.md","agents/cad-verifier-max.md","agents/cad-verifier-medium.md","agents/cad-verifier-xhigh.md","agents/cad-verifier.md","crates/cadence/tests/mcp.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-7-T1","verify":["cargo test -p cadence --test phase31_read_layer phase31_worker_hosts_receive_main_thread_answers -- --exact","cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact"]}]}
---
# Phase 31: The read layer - Plan 7

## Goal

Repair the D-120 gap left by blocked plan 3 and re-establish T6 with the genuine installed host boundary that can satisfy it: one actual Claude child worker and its main thread read through one shared Cadence resident and agree with the direct stdio oracle.

## Must be true when done

- T6. When a worker calls the read layer from its own host, the worker gets the same answer the main thread gets.

## Context

Phase 31 plan 3 is the blocked plan this gap plan repairs. P31-3-T1 stopped at checkpoint `p31-3-t1-codex-worker-unavailable` after the installed Codex 0.154.0 host produced no spawn event under supported isolation and multi-agent settings. A separate genuine-host probe then established that Codex workers start their own `cadence serve`, so the original parent-shared-resident premise is false for Codex. The owner retired P31-3-T1 on 2026-09-14 through `execution-task-retire` event version 8, releasing P31-T6-C from the current evidence union. The committed test is correspondingly ignored at crates/cadence/tests/phase31_read_layer.rs:11.

This plan republishes P31-T6-C under a Claude-host-only specification. The subject is the real installed Claude host, its main thread, and an actual named child agent that inherits the parent's configured Cadence MCP connection. An inline agent/server definition, manufactured worker answer, transcript stub, or second worker server cannot satisfy the check. The direct stdio client is only the handwritten oracle. The test must explicitly fail when the Claude executable, authentication, child-worker event, raw tool results, or one-resident process evidence is absent.

Codex is not a second test leg. The check must refuse to invoke a Codex worker, and docs/architecture/read-layer-hosts.md must record that the installed Codex host does not support this boundary because each spawned worker starts a separate Cadence resident. That limitation is host support documentation, not a skipped or silently passing acceptance path.

The two existing plan 3 artifacts P31-A-COMPILED-READ-INSTRUCTIONS and P31-A-CALLER-ADAPTERS remain current and are not republished here. P31-3-T2's scope—removing the remaining direct-file read instructions across the rest of the skill surface—is NOT carried by this gap plan and stays with the owner. The executor's starting implementation material is the uncommitted `stash@{0}` diff named `plan-3 T1 green`; inspect it with `git stash show -p stash@{0}` and reconstruct only the in-scope changes without popping or applying the stash.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P31-T6-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_worker_hosts_receive_main_thread_answers -- --exact",
        "expected": {
          "kind": "property",
          "value": "The actual Claude child worker discovers search, read and document and returns the same handwritten search units, exact slice text and ranges, outline rows, process slice, truncation and continuation semantics, and named refusals as the Claude host main thread and the direct stdio oracle. Within the Claude host session the named worker follows the main thread's issued location on the same resident, repeated main-thread reads stay stable after worker use, and process evidence contains exactly one cadence serve. Only opaque ids belonging to the independently initialized direct-oracle episode may differ; no within-session location failure, content, bounds, omission or refusal rule is normalized away. Actual Claude host tool results, not final model prose, establish success. Absent Claude executable, authentication, actual child-worker evidence, complete tool results or one-resident evidence makes the run explicitly unsuccessful, never skipped or passed. Codex is explicitly unsupported for this check because observed spawned Codex workers start a separate cadence serve rather than inheriting the parent's resident; the test refuses to invoke any Codex worker leg and the host-support document records that mechanism."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_worker_hosts_receive_main_thread_answers"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client to launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC, and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinels, and a Rust file larger than 24,576 bytes. Author a native context and plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered process records; do not seed native records or use renderers as expected-value generators. Keep the direct stdio resident alive only as the handwritten oracle. Configure the real installed Claude host against env!(CARGO_BIN_EXE_cadence) as the sole named cadence MCP server in isolated fixture settings. Install a named Claude child agent whose metadata inherits that parent server connection and permits only the generated Cadence read contract; do not pass an inline agent or define an inline/private server. Capture actual Claude MCP request/results with parent, worker, session and process identities. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. Do not configure, launch or call a Codex worker; the installed Codex host is unsupported because its spawned workers start a second resident.",
        "call": "Have the genuine Claude main thread search and read the handwritten beta unit, then dispatch the named actual child agent. Pass the main thread's issued beta location to that child. Through the inherited cadence_query connection the child reads that location and independently calls search, read and document for the beta slice, large-file outline, cut slice with continuation, handwritten process record, and foreign/unknown-token refusal. After the child returns, repeat the main-thread search and complete the remaining main-thread requests. Compare raw main, child and direct-stdio payloads and assert one cadence serve. The scripted caller instructions control requests only; actual model/host behavior and tool results are not faked. Any attempted Codex worker call is a test-harness error, not an optional leg.",
        "boundary": "Actual Claude main caller and named child agent -> inherited named MCP connection -> one startup-bound cadence serve resident -> real disposable project records/source -> serialized public answers, compared with a separate direct stdio handwritten oracle. Actual host tool invocation, child identity and sampled one-resident process evidence are part of the subject; Codex is outside the supported worker boundary and must not be invoked.",
        "fakes": []
      },
      "reason": "A worker that uses built-in reads, an inline/private server, a manufactured result, or a second resident can disagree with its main thread while appearing to satisfy the read API.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The real Claude child-worker episode directly observes whether a worker and its host main thread receive the same read-layer answers from one resident."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-HOST-SUPPORT",
      "spec": {
        "locators": [
          "docs/architecture/read-layer-hosts.md"
        ],
        "substance": "An installed-host support record states that Claude named child agents inherit the parent's configured Cadence MCP connection and share its single resident, while spawned Codex workers do not share the parent resident and instead start another cadence serve. It explains the observed mechanisms, the genuine-host prerequisites and evidence requirements, and why P31-T6-C executes only the Claude leg and explicitly refuses a Codex worker leg."
      },
      "reason": "Without a durable host support boundary, an unsupported Codex worker or second resident could be reintroduced as if it proved T6.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The support record distinguishes the installed host mechanism that can satisfy the same-resident worker property from the installed host mechanism that cannot."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Re-specify and land the genuine Claude worker boundary

- **ID:** P31-7-T1
- **Files:** crates/cadence/src/read/instructions.rs, crates/cadence/src/read/mod.rs, crates/cadence/src/server.rs, crates/cadence/src/main.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/context/instructions.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/verification/instructions.rs, crates/cadence/src/review/instructions.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/review/invoking.rs, crates/cadence/src/review/provider/payload.rs, docs/architecture/read-layer-hosts.md, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31_hosts.rs, crates/cadence/tests/support/phase31.rs, skills/cad-context/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-execute/SKILL.md, skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-review/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-plan-review/SKILL.md, skills/cad-audit/SKILL.md, skills/cad-coverage/SKILL.md, skills/cad-read-contract/SKILL.md, agents/cad-assumptions-analyzer-high.md, agents/cad-assumptions-analyzer-low.md, agents/cad-assumptions-analyzer-max.md, agents/cad-assumptions-analyzer-medium.md, agents/cad-assumptions-analyzer.md, agents/cad-executor-low.md, agents/cad-executor-max.md, agents/cad-executor-medium.md, agents/cad-executor-xhigh.md, agents/cad-executor.md, agents/cad-plan-checker-high.md, agents/cad-plan-checker-max.md, agents/cad-plan-checker-medium.md, agents/cad-plan-checker-xhigh.md, agents/cad-plan-checker.md, agents/cad-planner-low.md, agents/cad-planner-max.md, agents/cad-planner-medium.md, agents/cad-planner-xhigh.md, agents/cad-planner.md, agents/cad-reviewer-low.md, agents/cad-reviewer-max.md, agents/cad-reviewer-medium.md, agents/cad-reviewer-xhigh.md, agents/cad-reviewer.md, agents/cad-verifier-low.md, agents/cad-verifier-max.md, agents/cad-verifier-medium.md, agents/cad-verifier-xhigh.md, agents/cad-verifier.md, crates/cadence/tests/mcp.rs.
- **Action:** First rewrite the committed red so the Claude leg alone is the acceptance subject and the Codex leg is an explicit documented refusal. Remove the ignore attribute. Launch the real installed Claude host against the disposable fixture's sole Cadence stdio server and dispatch an actual named child agent that inherits the parent's named `cadence` MCP connection; do not use an inline agent definition or inline/private server. Preserve raw host request/result events, distinct parent/worker identities, process sampling, the direct stdio oracle, handwritten search units, exact short and cut slices, outline rows, process slice, continuation behavior, issued-location handoff, repeat-read stability, and named refusal assertions. Assert exactly one `cadence serve` for the Claude episode. Do not launch Codex anywhere in the function or helper path; encode that refusal in the helper and the host-support document.

Commit the rewritten check red before landing worker exposure. Its exact command must exit nonzero because the named Claude worker is not yet wired to the shared read contract, not because the host, authentication, transport, or worker evidence is absent. Retain that red receipt. The green run must use the identical test-file digest and the same P31-T6-C command; do not weaken, skip, ignore, conditionally pass, manufacture a return, or normalize away a location/content/bounds/refusal mismatch.

Then use the uncommitted plan 3 T1 stash only as read-only starting material for the green implementation. Add the single compiled read instruction fragment, include it in MCP `ServerInfo` instructions and the advertised `cadence_query` contract, and compose it into context, planner, executor, verifier, and review role outputs plus execution/review dispatch text. Add the project-free `read-instructions` renderer. Make every assumptions-analyzer, executor, plan-checker, planner, reviewer, and verifier agent rung permit `cadence_query` through the named configured server, preload `cad-read-contract`, and remove its built-in/standalone reader permissions while preserving existing engineering write authority and routing/model policy. Regenerate the affected native skills, including `skills/cad-read-contract/SKILL.md`, from the binary rather than hand-authoring their generated bytes. Update the existing MCP metadata regression only as needed to pin the compiled fragment, generated bytes, and agent permissions; do not absorb P31-3-T2's remaining-skill cleanup.

Write docs/architecture/read-layer-hosts.md as the installed-host support record: Claude workers inherit the parent named server and share one resident; Codex workers do not share it and instead start another `cadence serve`, so Codex is unsupported and the acceptance helper refuses that leg. Finally resolve the four Clippy lints in crates/cadence/tests/support/phase31_hosts.rs without changing the evidence boundary or test digest, run both narrow verification commands, and leave the full workspace suite to plan close.
- **Verify:** `cargo test -p cadence --test phase31_read_layer phase31_worker_hosts_receive_main_thread_answers -- --exact`; `cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact`.

## Notes

Plan 3 remains retained as blocked, P31-3-T1 remains retired, and P31-3-T2 remains not-run. This gap plan neither rewrites those execution records nor claims their unfinished scope. Run `cargo test --workspace --no-fail-fast` once at plan close.
