---
phase: 38
plan: 1
requirements: ["T4","T5"]
files: ["crates/cadence/src/execution/model.rs","crates/cadence/src/execution/dispatch.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution/tests.rs","crates/cadence/src/execution_service_tests.rs","crates/cadence/src/guard/mod.rs","crates/cadence/src/guard/tests.rs","crates/cadence/tests/phase7_lease.rs","crates/cadence/tests/phase8_dispatch.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase13_verification.rs","crates/cadence/tests/phase38_suite_gate.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P38-1-T1","verify":["cargo test -p cadence --test phase38_suite_gate phase38_retained_dispatch_prompt_survives_renderer_change -- --exact","cargo test -p cadence --lib server::execution_service_tests::phase8_gap_active_dispatch_returns_original_choice_under_new_config -- --exact","cargo test -p cadence --test phase7_lease historical_exact_file_prompt_reconstructs_with_original_admitted_answer_digest -- --exact","cargo test -p cadence --test phase8_dispatch dispatch_renderer_matches_independent_exact_byte_oracles_for_both_renderings -- --exact"]},{"id":"P38-1-T2","verify":["cargo test -p cadence --test phase38_suite_gate phase38_regenerated_skill_is_implicit_lease_material -- --exact","cargo test -p cadence --lib guard::tests::rendered_skill_files_are_protected -- --exact","cargo test -p cadence --test phase7_lease native_guidance_and_phase_seven_roadmap_match_parser_without_migrating_history -- --exact","cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact","cargo test -p cadence --test mcp execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch -- --exact","cargo test -p cadence --test phase13_verification phase13_review_surface_selects_target_and_intent -- --exact","cargo test -p cadence --test phase13_verification phase13_dispatch_carries_current_verification_inputs -- --exact"]}]}
---
# Phase 38: The suite is a gate, not a guillotine - Plan 1

## Goal

Make dispatch prompts durable data instead of renderer reconstructions, and make every compiled-text render target binary-owned, automatically leased material.

## Must be true when done

- T4. When the binary's renderer has changed after a dispatch was admitted, the owner gets the admitted dispatch's retained prompt byte for byte from execute-next, never prompt-mismatch.
- T5. When a task's commit changes text the binary renders into a skill file, the owner sees the regenerated skill file accepted inside the task's lease with the suite green.

## Context

D-165 and D-166 are the approved rules at .planning/phases/38/CONTEXT.md:11-12. ActiveDispatch currently retains only prompt_bytes at crates/cadence/src/execution/model.rs:64-84. Admission renders a prompt and saves only its length, while dispatch_response reconstructs with the current renderer and then render_prompt_version's historical boolean before returning prompt-mismatch at crates/cadence/src/execution_service.rs:1791-1823. Replace that with prompt: String and prompt_digest: String on ActiveDispatch, computed from the exact UTF-8 bytes once at admission. Remove prompt_bytes, render_prompt_version and the historical-renderer path; render_dispatch_prompt at crates/cadence/src/execution/render.rs:167-187 remains the admission-time renderer, and readback clones retained text after at most checking its digest.

D-166 applies to the complete render table asserted in crates/cadence/tests/mcp.rs:1243-1266, not just executor text. Define one compiled registry of those binary-rendered project paths and use it both when dispatch construction builds ActiveDispatch.files and when the Write/Edit guard decides protected targets. Because native_operational emits admitted.files at crates/cadence/src/execution/dispatch.rs:145-164 and task close validates against the active lease, the augmentation must happen in the retained dispatch, not only in response JSON. The guard entry starts at crates/cadence/src/guard/mod.rs:49 and protected_target currently recognizes only planning-owned outputs at crates/cadence/src/guard/mod.rs:284-315. Existing renderer commands produce the bytes; the planner-authored files and directories stay free of rendered skill paths.

Repair all eight renderer-coupled regressions by asserting the new rules: server::execution_service_tests::phase8_gap_active_dispatch_returns_original_choice_under_new_config; historical_exact_file_prompt_reconstructs_with_original_admitted_answer_digest and native_guidance_and_phase_seven_roadmap_match_parser_without_migrating_history in crates/cadence/tests/phase7_lease.rs; dispatch_renderer_matches_independent_exact_byte_oracles_for_both_renderings; skill_contract_matches_wire_patch_and_direct_tool_permissions; execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch; phase13_review_surface_selects_target_and_intent; and phase13_dispatch_carries_current_verification_inputs. Regenerate every affected checked-in skill with its binary command in the same implementation commit; do not hand-edit it or list it in this plan's lease.

Both acceptance checks use the real stdio Client at crates/cadence/tests/support/phase13.rs:15-92 and complete fresh signed projects. T4 uses two genuinely different compiled renderers over one durable project. T5 changes compiled text, regenerates with that built binary, proves the implicit lease at close, runs the full suite green, and proves the guard denies direct editing. No observation item or mocked boundary is used.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P38-T4-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_retained_dispatch_prompt_survives_renderer_change -- --exact",
        "expected": {
          "kind": "property",
          "value": "After admission under the first compiled renderer and readback through a separately built binary whose compiled renderer text differs, execute-next returns status \"ok\", never prompt-mismatch, and its prompt UTF-8 bytes and prompt digest equal the exact values captured from the admitting response byte for byte."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_retained_dispatch_prompt_survives_renderer_change"
        },
        "setup": "Create a fresh disposable signed Git project and start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase13.rs. Through public calls, context-submit the fixture truths, plan-submit the exact attached plan map, execution-admit its publication and map revisions, execution-authorize, execute-next, execution-task-start, create and commit the test subject, execution-run the admitted red and green check stages, execution-owner-attest, execution-task-close, and execution-suite. Expected payloads and result values are handwritten; do not seed the store or call an internal projection, renderer, runner, or history function. Keep the plan active after its green suite. Build a second real cadence executable from a disposable source copy with one compiled-in executor-renderer sentence changed, using a separate target directory, so admission and readback genuinely use different compiled renderers rather than a mock or test branch.",
        "call": "Admit and exercise the plan with the first executable, retain the exact dispatch prompt and digest from its public answer, then reopen the same project through the changed-renderer executable and call cadence_query execute-next for the still-active plan. Compare the returned prompt bytes and digest to the handwritten retained values and assert no refusal.",
        "boundary": "Two real Cadence stdio executables with different compiled renderer text -> one durable admitted ActiveDispatch -> public execute-next readback.",
        "fakes": []
      },
      "reason": "A re-render, a length-only identity, or a historical-renderer fallback changes/refuses this response and fails the exact byte and digest assertions.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The real stdio boundary assertion is the owner-visible outcome approved as phase 38 T4."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P38-T5-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_regenerated_skill_is_implicit_lease_material -- --exact",
        "expected": {
          "kind": "property",
          "value": "A task whose authored lease omits rendered skills accepts a same-commit skill-file change only when that file exactly equals the changed binary's generated bytes; execution-task-close retains the regenerated path as in-lease material, the full plan suite reports a recognized passing result, and a direct Write/Edit hook request for that rendered path is denied."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_regenerated_skill_is_implicit_lease_material"
        },
        "setup": "Create a fresh disposable signed Git project and start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase13.rs. Through public calls, context-submit the fixture truths, plan-submit the exact attached plan map, execution-admit its publication and map revisions, execution-authorize, execute-next, execution-task-start, create and commit the test subject, execution-run the admitted red and green check stages, execution-owner-attest, execution-task-close, and execution-suite. Expected payloads and result values are handwritten; do not seed the store or call an internal projection, renderer, runner, or history function. In the disposable source copy, change one compiled-in instruction sentence, build the real binary, invoke that binary's matching renderer to regenerate its checked-in skill file, and commit the source plus generated file while the admitted plan lists neither that skill path nor a skills directory. Also prepare a direct guard hook request naming the rendered file.",
        "call": "Run the public task close and suite path with the changed source and binary-generated skill bytes. Assert the close accepts the regenerated file through the implicit lease and the suite receipt is green; invoke the real guard entry point with the direct edit request and assert denial. A hand-authored substitute is never used.",
        "boundary": "Compiled instruction source -> real binary renderer -> checked-in skill bytes -> implicit native task lease, receipt validation, full suite, and Write/Edit guard.",
        "fakes": []
      },
      "reason": "If regeneration is not binary-owned, implicit lease composition is missing, or the guard permits hand edits, one of the exact close, suite, byte-equality, or denial assertions fails.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The real stdio boundary assertion is the owner-visible outcome approved as phase 38 T5."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P38-A-PROMPT-AND-RENDERED-MATERIAL",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/model.rs::ActiveDispatch",
          "crates/cadence/src/execution_service.rs::dispatch_response",
          "crates/cadence/src/execution/dispatch.rs::native_operational",
          "crates/cadence/src/guard/mod.rs::protected_target"
        ],
        "substance": "ActiveDispatch stores the exact admitted UTF-8 prompt as prompt: String and its SHA-256 identity as prompt_digest: String; prompt_bytes and render_prompt_version are removed, and dispatch_response returns the retained text after at most verifying its digest. One compiled registry of binary-rendered project files augments every ActiveDispatch file lease before native_operational exposes it and before close validation, while the same registry makes direct Write/Edit guard requests fail. Existing binary render commands remain the only regeneration source; plan-authored files and directories never name rendered skills."
      },
      "reason": "If prompt identity or rendered-material ownership is split across reconstruction, lease display, close validation, and the guard, an upgrade can strand a dispatch or a generated file can remain unreachable/drifted.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The retained prompt fields and readback path are the durable mechanism required by T4."
        },
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The shared rendered-file registry, implicit lease, generator ownership, and guard are the mechanism required by T5."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Retain and return the admitted prompt

- **ID:** P38-1-T1
- **Files:** crates/cadence/src/execution/model.rs, crates/cadence/src/execution/dispatch.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution/tests.rs, crates/cadence/src/execution_service_tests.rs, crates/cadence/tests/phase7_lease.rs, crates/cadence/tests/phase8_dispatch.rs, crates/cadence/tests/phase38_suite_gate.rs.
- **Action:** First add phase38_retained_dispatch_prompt_survives_renderer_change and revise the three prompt-history regression assertions named above; commit and retain their exact red runs. Then add prompt: String and prompt_digest: String to ActiveDispatch, set them from the one admission rendering, remove prompt_bytes and render_prompt_version, and make dispatch_response return the retained prompt with only a retained-byte digest integrity check. Update fixtures as UTF-8 strings, never integer arrays. Commit the implementation and rerun every exact command green.
- **Verify:**
  - cargo test -p cadence --test phase38_suite_gate phase38_retained_dispatch_prompt_survives_renderer_change -- --exact
  - cargo test -p cadence --lib server::execution_service_tests::phase8_gap_active_dispatch_returns_original_choice_under_new_config -- --exact
  - cargo test -p cadence --test phase7_lease historical_exact_file_prompt_reconstructs_with_original_admitted_answer_digest -- --exact
  - cargo test -p cadence --test phase8_dispatch dispatch_renderer_matches_independent_exact_byte_oracles_for_both_renderings -- --exact

### Task 2: Regenerate and implicitly lease every binary-rendered file

- **ID:** P38-1-T2
- **Files:** crates/cadence/src/execution/dispatch.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/guard/mod.rs, crates/cadence/src/guard/tests.rs, crates/cadence/tests/phase7_lease.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase13_verification.rs, crates/cadence/tests/phase38_suite_gate.rs.
- **Action:** First add phase38_regenerated_skill_is_implicit_lease_material, the guard unit, and revise the five generated-text regression assertions named above; retain exact red evidence. Then add the compiled render-target registry, augment the retained ActiveDispatch lease, enforce the same registry in the guard, and regenerate every affected skill through the binary. Commit source and generated bytes together, then rerun all exact commands green. Never add a rendered skill path to authored files/directories or hand-edit generated prose.
- **Verify:**
  - cargo test -p cadence --test phase38_suite_gate phase38_regenerated_skill_is_implicit_lease_material -- --exact
  - cargo test -p cadence --lib guard::tests::rendered_skill_files_are_protected -- --exact
  - cargo test -p cadence --test phase7_lease native_guidance_and_phase_seven_roadmap_match_parser_without_migrating_history -- --exact
  - cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact
  - cargo test -p cadence --test mcp execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch -- --exact
  - cargo test -p cadence --test phase13_verification phase13_review_surface_selects_target_and_intent -- --exact
  - cargo test -p cadence --test phase13_verification phase13_dispatch_carries_current_verification_inputs -- --exact

## Notes

This plan has two sequential executor tasks because prompt persistence and generated-file ownership have separate red/green boundaries, while each remains one coherent commit. D-169 requires hand execution under the executor block and native verification afterward. The phase31_worker_hosts_receive_main_thread_answers check is deliberately not planned or leased: crates/cadence/tests/support/phase31_hosts.rs:38-41 requires a running authenticated Claude Code host and line 73 asserts its live worker-host process observation. No phase 31, 34, 36 or 37 file is leased. The actual historical prompt test is in crates/cadence/tests/phase7_lease.rs:1445-1513; no phase-31 plan is a dependency.
