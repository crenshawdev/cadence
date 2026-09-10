PLAN COMPLETE
Plan: .planning/phases/28/PLAN-2.md
Tasks: 4 of 4

| Task | Commit(s) | %G? | Verify command and literal result |
|---|---|---|---|
| 1 — Retain superseded publication maps | 262a8af20595e7cd7275154b21acc2c1cfa026e3 (red); 6e15f6da7ccb54d02a4aedff7e60c2a4eb49e949 (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_republication_supersedes_previous_map -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 5 filtered out; finished in 0.61s`; exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 2.43s`; exit 0. |
| 2 — Preserve replay bindings | ef08df473559dfa973661a6a4aec2c073b475736 (red); 501d69449a09e769681cd4d9e5973a685866fc0f (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_republication_supersedes_previous_map -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 5 filtered out; finished in 0.66s`; exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 5.28s`; exit 0. |
| 3 — Authoritative readback | 821c4d8c2f5848c1d068ca6549a8895b92a68a81 (red); 8b24bfa34ccfc37730fcce067237316b8bb2cdf8 (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_readback_returns_authoritative_map_with_input_digest -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 6 filtered out; finished in 0.01s`; exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out; finished in 1.13s`; exit 0. |
| 4 — Compiled instructions | a4bd64c03a1b109057054d1b826408618d07849e | G | `cat crates/cadence/src/plan/instructions.rs crates/cadence/src/server.rs`: exit 0; substantive artifact inspection passed. `cargo check`: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.30s``; exit 0. `cargo run --quiet -p cadence --bin cadence -- plan-instructions`: exit 0; rendered 34,267 bytes. |

C6 Task 1 red failure: `phase28_evidence.rs:738:9`, ``assertion `left == right` failed: retained supersession relation``; `left: Null`. Expected successor named request `replacement`, phase 27 plan 1, content revision `6f7527d2e7626e8f6e5b570c8557939d0c49f65c554e1e1903dcd50c93c75f71`, map revision `6ef67db01ca4f25ff8e8f8c59324d5e69920b03d94e068cc8ea63bcb4d6fe0ec`.

C6 Task 2 red failure: `phase28_evidence.rs:786:13`, ``assertion `left == right` failed: replay returns original payload digest``; `left: Null`, `right: String("7742cc41571241f1e4358ad3f0e3853d5b2798a001e046deb281a56c33c4781b")`.

C7 red failure: `phase28_evidence.rs:1071:5`, ``assertion `left == right` failed: authoritative evidence-read operation``; `left: Null`, `right: "acceptance-map-view-1"`.

Task 4 artifact inspection: compiled typed four-kind schema, explicit native version lookup, complete preview and combined approval, current phase union/shared-item rules, exact replacement with resubmission, immutable history, historical replay and original digest, authoritative `evidence-read`, separate projection health, located refusal corrections, provisional readiness and pending O1 are substantive. The design's Planner block is retained verbatim. `skills/cad-plan/SKILL.md` was written from the actual project-free render entrypoint output using the file-editing tool; its compiled-source provenance and schema were inspected. No string-comparison acceptance test was added.

Full suite: exactly one `cargo test --workspace --no-fail-fast` invocation, after Task 4's commit and clean clippy; exit 0. Totals across Cargo's 42 top-level test/doc-test targets: **877 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out**. The two nested one-test subprocess summaries with `238 filtered out` are included in the binary target's 239 passed and are not double-counted. No full-suite repair or rerun was needed.
Clippy: exactly one invocation after Task 4 commit, `cargo clippy --workspace --all-targets -- -D warnings`; exit 0; ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.68s``. No warnings or errors.
Deviations:
- [deviation] Task 2 first green attempt expected one pass but failed in fixture setup at `phase28_evidence.rs:935:13`: `assertion failed: relative.starts_with(".planning")`. Literal result: `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 5 filtered out; finished in 4.86s`; exit 101. The captured keys are planning-root-relative; corrected only the test's destination to the original canonical planning root. No captured bytes, identity, expected result or authority changed.
Historical C6 case restored all ten entries byte-for-byte at `/tmp/cadence-phase27-absent-map-df43af15/.planning`, verified canonical roots and exact import active mapping, and used empty `CADENCE_GLOBAL_CONFIG` for every launch. Both replays and the approved first-map replacement passed. Original receipt serialization, absent fields and payload digest were unchanged; old replay reported `newer-authorized` after replacement and left the full post-replacement tree unchanged. All children were stopped/reaped and the owned root removed before releasing the sibling OS lock. Fixture source file was read only.

C7 compares the entire expected authority input and transport response. Expected PLAN documents and event/item digests are assembled independently from caller inputs; no production rendering, canonicalization or map-view helper builds the oracle. The empty phase's complete canonical input is pinned to literal SHA-256 `58ce66f04952ef63b152c07d5b3e4d0d1250d3176556d6911b319cc14a6a8d45`. A real Python companion atomically alternates complete PLAN bytes across 12 reads; each response must match one entire expected input or identify changed inputs without a digest. The separate actual-file presence sentinel is labelled as such and preserved byte-for-byte; it is inspected with `Snapshot::parse` and never opened with a recovering writer. It proves presence handling only, not transaction retention/recovery.

Open items: O1 remains pending, specification approved by owner 2026-09-10; host conduct has not been observed.

Literal full-suite target results:

- `Running unittests src/lib.rs`: `test result: ok. 170 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s`
- `Running unittests src/main.rs`: `test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 127.14s`
- `Running tests/derivation_consistency.rs`: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s`
- `Running tests/derivation_inputs.rs`: `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/evidence_store.rs`: `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`
- `Running tests/execution_boundary_compat.rs`: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.77s`
- `Running tests/execution_store.rs`: `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 279.25s`
- `Running tests/mcp.rs`: `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 41.24s`
- `Running tests/next_action.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase11_context.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.06s`
- `Running tests/phase27_plan.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.10s`
- `Running tests/phase28_evidence.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.79s`
- `Running tests/phase7_guard.rs`: `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.62s`
- `Running tests/phase7_lease.rs`: `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.52s`
- `Running tests/phase7_receipts.rs`: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s`
- `Running tests/phase7_risk.rs`: `test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.31s`
- `Running tests/phase7_surfaces.rs`: `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase8_config.rs`: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s`
- `Running tests/phase8_dispatch.rs`: `test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s`
- `Running tests/phase8_global.rs`: `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase8_interview.rs`: `test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase8_routing.rs`: `test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 5.95s`
- `Running tests/phase9_admission.rs`: `test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_binding.rs`: `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_consumers.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_context.rs`: `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_contract.rs`: `test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_deferred.rs`: `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`
- `Running tests/phase9_history.rs`: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_inventory.rs`: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_invoking.rs`: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_material.rs`: `test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_model.rs`: `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_observations.rs`: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_policy.rs`: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_recovery.rs`: `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_returns.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`
- `Running tests/phase9_selection.rs`: `test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_specialist.rs`: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_stream.rs`: `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s`
- `Running tests/store.rs`: `test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s`
- `Doc-tests cadence`: `test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`

Final repository audit: seven commits, all authored by `John Crenshaw <john@jcrenshaw.dev>` and signed with key `693AB15F91734B0C`; every `%G?` is `G`. Every staged lease gate returned `ok:true`. No committed deletion or path outside the plan lease. The captured fixture source is unchanged and its restored owned root is absent after cleanup. Only the reports directory remains untracked. Existing `plan-check.md` and `plan-1.md` were left untouched and uncommitted; this report is also uncommitted. Exactly one final clippy invocation and one full-suite invocation were run.
