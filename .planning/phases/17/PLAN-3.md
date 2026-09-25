---
phase: 17
plan: 3
requirements: ["T3"]
files: ["crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution/boundary.rs","crates/cadence/src/envelope.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/why_service.rs","crates/cadence/src/why/mod.rs","crates/cadence/src/why/corpus.rs","crates/cadence/src/why/render.rs","crates/cadence/src/why/instructions.rs","skills/cad-why/SKILL.md","crates/cadence/tests/refusal_log.rs","crates/cadence/tests/support/refusal_fixtures.rs","crates/cadence/tests/support/serve.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/help/table.rs","crates/cadence/tests/execution_lifecycle.rs","crates/cadence/tests/verification.rs","crates/cadence/tests/verification_receipts.rs","crates/cadence/tests/evidence_limits.rs","crates/cadence/tests/execution_summary.rs","crates/cadence/tests/typed_authoring.rs","crates/cadence/tests/evidence_map.rs","crates/cadence/tests/context_submission.rs","crates/cadence/src/debug_consult_tests.rs","crates/cadence/src/execution_service_tests.rs","cadence-core/bin/weight-budgets.json","crates/cadence/src/store/model.rs","crates/cadence/tests/plan_publication.rs","crates/cadence/tests/risk_check.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-3-T1","verify":["cargo nextest run -p cadence --test refusal_log native_refusals_reach_the_log"]},{"id":"P17-3-T2","verify":["cargo nextest run -p cadence --test refusal_log native_refusals_reach_the_log","cargo nextest run -p cadence --test execution_lifecycle phase12_incomplete_execution_contract_is_refused","cargo nextest run -p cadence --test verification phase13_mismatched_verdict_patch_is_refused","cargo nextest run -p cadence --test evidence_limits phase29_check_without_command_is_refused","cargo nextest run -p cadence --test execution_summary phase33_round_record_renders_tokens_beside_the_median","cargo nextest run -p cadence --test verification_receipts phase13_publication_seeds_only_missing_trace_rows","cargo nextest run -p cadence --test plan_publication phase27_unauthorized_replacement_is_refused","cargo nextest run -p cadence --test risk_check public_range_records_exact_material_without_a_review_pass_and_replays_lost_reply","cargo nextest run -p cadence --test risk_check strict_scope_source_and_surface_validation_refuse_without_a_scan_or_policy_change","cargo nextest run -p cadence --test risk_check public_execution_source_uses_only_the_retained_dispatch_base_and_accepted_task_range","cargo nextest run -p cadence --test mcp risk_receipts_cross_stdio_restart_and_bind_current_staged_and_committed_material"]}]}
---
## Goal

Record each refused native apply once through the existing boundary path, and let why list those journal refusals.

## Must be true when done

- T3. When any native apply is refused, the owner sees that refusal on the log as one boundary decision with its code, rule and slot, listed by the why query, with every other record unchanged.

## Context

At HEAD crates/cadence/src/execution_service.rs:94 gates recording to one lease refusal; :131 records through boundary() and Response::Refused. The V1 writer path is crates/cadence/src/store/writer.rs:1227, not the older boundary_record helper. Reason truncation at crates/cadence/src/execution/boundary.rs:307 is silent. Why currently joins Markdown decisions at crates/cadence/src/why/corpus.rs:229 and :272; crates/cadence/src/why_service.rs:27 has no journal reader. Thus flagged assumption 3 is false and this plan adds that reader. After tasks exist, this plan handles their rooted refusals too; before shutdown it establishes the final refusal-write path to drain.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/native_refusals_reach_the_log",
      "spec": {
        "command": "cargo nextest run -p cadence --test refusal_log native_refusals_reach_the_log",
        "expected": {
          "kind": "property",
          "value": "Five answers say refused; five distinct request identities each have exactly one matching BoundaryV1 row with that answer's code, rule and slot. Why lists those five in journal order. Every execution, evidence, plan and verification record stays byte-identical before and after, with their projections unchanged. Preserve all pre-existing replay receipts; an operation's own replay receipt for the refused request_id is retained under its existing behavior and is not one of those records. Do not assert that no namespace changed. The long-reason row is <=1024 UTF-8 bytes, ends '[cut] cap=1024 bytes', and remains one row after replay. Expected statuses/counts/marker/cap are handwritten; code/rule/slot equality is the truth's literal answer-to-journal property."
        },
        "test": {
          "file": "crates/cadence/tests/refusal_log.rs",
          "function": "native_refusals_reach_the_log"
        },
        "setup": "Start with Completed::new at crates/cadence/tests/support/serve.rs:636 (real completed native phase). Extend a support/refusal_fixtures.rs builder from published_shaped at :661 to prepare an additional real phase with two plans through approved fixture publication/admission, not JSON store seeding. Authorize it and start its first task; retain the second task not started/not next. Baseline all execution/evidence/plan/verification/task records and projections after that successful preparation. The journal is read by reopened at crates/cadence/tests/support/serve.rs:224 after the server has actually exited.",
        "call": "Through real cadence_apply submit five distinct invalid requests: start the non-next task, run the unstarted task, complete the plan whose first task is open, re-admit the stale set, and submit a replacement of an already-admitted plan with otherwise valid fixture approval/basis. Each must reach the named semantic gate, not fail JSON decoding or missing fixture setup. Exit/restart; query why for that active phase's refusals and inspect the actual journal. Add a sixth real refused request whose caller-controlled malformed field yields a reason longer than 1024 bytes; replay it once to verify no duplicate.",
        "boundary": "Real serve applies and real why, followed by actual process restart and verified journal read; no fabricated refused Value or in-memory journal.",
        "fakes": []
      },
      "reason": "This one check causes T3's trigger and inspects its stated outcome.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The trigger and outcome are exercised at the real boundary for T3."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/all-native-refusals",
      "spec": {
        "locators": [
          "crates/cadence/src/server.rs",
          "crates/cadence/src/execution_service.rs",
          "crates/cadence/src/store/writer.rs",
          "crates/cadence/src/store/model.rs"
        ],
        "substance": "Every refused native apply reaches the existing BoundaryV1 refusal path exactly once, including non-execution families and root-scoped refusals. D-210: a refusal changes no execution, evidence, plan or verification record, and the journal gains exactly one refusal decision. An operation's own replay receipt for the refused request_id is not one of those records and stays; the journal decision is added beside it. Admission and retained-history validation distinguish new native refusal observations while preserving historical boundary validation."
      },
      "reason": "Removing the shared refusal append hides an answered refusal; changing domain records violates D-210, removing replay receipts breaks same-request replay, and changing admission without history validation makes expanded histories invalid.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact is required for T3's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/visible-reason-cap",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/boundary.rs"
        ],
        "substance": "New recorded refusal reasons have a named 1024-byte cap with a UTF-8-safe [cut] marker and cap value inside that bound."
      },
      "reason": "New recorded refusal reasons have a named 1024-byte cap with a UTF-8-safe [cut] marker and cap value inside that bound.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact is required for T3's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/why-journal-refusals",
      "spec": {
        "locators": [
          "crates/cadence/src/why_service.rs",
          "crates/cadence/src/why/corpus.rs",
          "crates/cadence/src/why/render.rs",
          "crates/cadence/src/server.rs"
        ],
        "substance": "The existing why query has a phase/refusals selector reading verified Decision::BoundaryV1 journal rows and listing each refusal's code, rule and slot."
      },
      "reason": "The existing why query has a phase/refusals selector reading verified Decision::BoundaryV1 journal rows and listing each refusal's code, rule and slot.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact is required for T3's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Widen refusal recording and add journal readback to why

- **ID:** P17-3-T1
- **Files:** crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution/boundary.rs, crates/cadence/src/envelope.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/why_service.rs, crates/cadence/src/why/mod.rs, crates/cadence/src/why/corpus.rs, crates/cadence/src/why/render.rs, crates/cadence/src/why/instructions.rs, skills/cad-why/SKILL.md, crates/cadence/tests/refusal_log.rs, crates/cadence/tests/support/refusal_fixtures.rs, crates/cadence/tests/support/serve.rs, crates/cadence/tests/mcp.rs, crates/cadence/src/help/table.rs, crates/cadence/src/store/model.rs
- **Action:** Deliver native_refusals_reach_the_log red then green. Centralize refused cadence_apply result handling across every native apply family in server/service routing, including malformed/unknown applies and early returns, while retaining record_native_refusal -> boundary -> Response::Refused -> Operation::BoundaryV1. Remove the single-operation records_refusal gate and duplicate recording at inner handlers. Use the answer's code verbatim, its rule separately in Located, and its slot/id; recorded_code must no longer substitute rule for invalid-plan. Handle positive phase and root-scoped refusals explicitly, without creating a planning root for treeless tasks. Existing boundary identities deduplicate replay; new refused request identities each get one decision. Refusal observations must not silently disappear at the existing 256-record scope terminal cap: distinguish new native refusal observations from historical dispatch-loop boundary records in admission AND retained-history validation. Update store/model.rs::validate_decisions alongside writer admission and transaction validation; its scope counter at crates/cadence/src/store/model.rs:348 and invalid boundary budget history rejection at :349 otherwise reject expanded histories. Keep historical boundary identity, digest, generation, count and terminal-order validation intact, including the old 256-plus-terminal contract for historical records; explicitly classify new native refusal observations so they neither consume that old budget nor disappear after its terminal. The writer alone cannot make the expanded histories valid. Bound new recorded reasons to MAX_REASON_BYTES=1024 UTF-8 bytes inclusive of a literal '[cut] cap=1024 bytes' suffix; apply the cut before constructing the decision digest and preserve old hashes on read. Recording is best effort when the existing store cannot take it, never replacing the already-decided refusal. Apply D-210 literally: a refusal changes no execution, evidence, plan or verification record, and the journal gains exactly one refusal decision. Preserve every operation's own replay receipt for its refused request_id: that receipt is not one of those records, and the same request_id must continue answering the same refusal. Keep verification refusal replay history and undo_requests, milestones and landings refusal receipts as they are; add the boundary decision beside them, never migrate, remove or replace them with journal-only replay. Preserve land-read returning its retained refusal. Do not require whole-namespace equality when the namespace contains that operation's replay receipt; validate existing records and receipts individually and allow only the exact newly refused request's existing receipt behavior plus the boundary append. Preserve successful operations. Add why phase/refusals readback via the verified store view's Decision::BoundaryV1 records, filter by requested phase and refused response, and render code/rule/slot/reason/id in journal order. Add the selector to the existing why schema and instructions, retaining the path/line behavior. Do not mistake Markdown D- decisions for journal records. Regenerate only the why front door. Spell the new selector as cadence_query {"operation":"why","phase":14,"part":"refusals"}; make path optional only for this mutually exclusive arm. Reuse the existing query phase/part field vocabulary, so minimal tools/list has no new property or operation. Update the why argument-hint, help description and their existing mcp expectations to show both path and phase-refusals forms.
- **Verify:**
  - cargo nextest run -p cadence --test refusal_log native_refusals_reach_the_log

### Task 2: Restate refusal regressions without weakening unrelated invariants

- **ID:** P17-3-T2
- **Files:** crates/cadence/tests/execution_lifecycle.rs, crates/cadence/tests/verification.rs, crates/cadence/tests/verification_receipts.rs, crates/cadence/tests/evidence_limits.rs, crates/cadence/tests/execution_summary.rs, crates/cadence/tests/typed_authoring.rs, crates/cadence/tests/evidence_map.rs, crates/cadence/tests/context_submission.rs, crates/cadence/src/debug_consult_tests.rs, crates/cadence/src/execution_service_tests.rs, crates/cadence/tests/support/refusal_fixtures.rs, cadence-core/bin/weight-budgets.json, crates/cadence/tests/plan_publication.rs, crates/cadence/tests/risk_check.rs, crates/cadence/tests/mcp.rs
- **Action:** Use a shared refusal-delta assertion: stop the real server, re-open the real journal, compare every pre-existing record and projection byte-for-byte, and assert exactly one new matching boundary refusal decision with no other domain-record change, allowing only the append's integrity/generation/idempotency bookkeeping. The owner's replay-receipt ruling applies: preserve existing verification refusal replay history and undo_requests/milestones/landings receipts, compare every prior receipt exactly, and when a handler retains a new refusal receipt allow and assert only that exact request/answer receipt beside the one boundary decision. Do not omit an entire namespace. Apply this to the four named phase 12/13/29/33 regression functions and their adjacent refused-apply helper users; keep read-only query previews, successful idempotent replays, and replays of already logged refusals on strict unchanged-byte assertions. Replace verification's broad acceptance_bytes omission with record-by-record preservation plus the precise replay-receipt delta; do not demand equality of a namespace that legitimately retains the refused request. Restate crates/cadence/tests/plan_publication.rs::phase27_unauthorized_replacement_is_refused (whole .planning tree comparison at :821, including state and journal via tree at :148), including the stale-loser/admitted/legacy refused applies in that function, using a fresh baseline for each distinct refusal: pre-existing records byte-identical, exactly one new boundary refusal decision, nothing else. In the same module distinguish refused applies from query/count/full-submission previews and successful publication replay; convert every refused-apply whole-tree comparison, retaining strict previews/replays. Restate crates/cadence/tests/risk_check.rs::public_range_records_exact_material_without_a_review_pass_and_replays_lost_reply (request-reused at :331, whole view at :332) with the same delta and leave its successful/lost-reply replay equalities strict. Also restate that module's strict_scope_source_and_surface_validation_refuse_without_a_scan_or_policy_change and public_execution_source_uses_only_the_retained_dispatch_base_and_accepted_task_range for each refused apply that can reach an available store, refreshing each baseline; retain the deliberate unavailable-store best-effort controls without inventing a logged acknowledgment. Restate crates/cadence/tests/mcp.rs::risk_receipts_cross_stdio_restart_and_bind_current_staged_and_committed_material at :2187 after request-reused, preserving its earlier successful-replay equality at :2180. Audit the already leased execution_lifecycle, verification, verification_receipts, evidence_limits, execution_summary, typed_authoring, evidence_map and context_submission modules for the same distinction. Preserve historical generic-boundary cap/replay tests and direct-service/read-only assertions described in Notes; do not blanket-normalize records or alter unrelated success expectations. Refresh only the changed compiled why skill budget.
- **Verify:**
  - cargo nextest run -p cadence --test refusal_log native_refusals_reach_the_log
  - cargo nextest run -p cadence --test execution_lifecycle phase12_incomplete_execution_contract_is_refused
  - cargo nextest run -p cadence --test verification phase13_mismatched_verdict_patch_is_refused
  - cargo nextest run -p cadence --test evidence_limits phase29_check_without_command_is_refused
  - cargo nextest run -p cadence --test execution_summary phase33_round_record_renders_tokens_beside_the_median
  - cargo nextest run -p cadence --test verification_receipts phase13_publication_seeds_only_missing_trace_rows
  - cargo nextest run -p cadence --test plan_publication phase27_unauthorized_replacement_is_refused
  - cargo nextest run -p cadence --test risk_check public_range_records_exact_material_without_a_review_pass_and_replays_lost_reply
  - cargo nextest run -p cadence --test risk_check strict_scope_source_and_surface_validation_refuse_without_a_scan_or_policy_change
  - cargo nextest run -p cadence --test risk_check public_execution_source_uses_only_the_retained_dispatch_base_and_accepted_task_range
  - cargo nextest run -p cadence --test mcp risk_receipts_cross_stdio_restart_and_bind_current_staged_and_committed_material

## Notes

D-210 and D-216. Named restatements: crates/cadence/tests/execution_lifecycle.rs::phase12_incomplete_execution_contract_is_refused (admission_refusal's unchanged bytes); crates/cadence/tests/verification.rs::phase13_mismatched_verdict_patch_is_refused (acceptance_bytes currently excludes the entire verification history); crates/cadence/tests/evidence_limits.rs::phase29_check_without_command_is_refused (refusals helper); crates/cadence/tests/execution_summary.rs::phase33_round_record_renders_tokens_beside_the_median (refused round records). Also audit phase13_publication_seeds_only_missing_trace_rows in verification_receipts.rs. D-210's invariant is literal: a refusal changes no execution, evidence, plan or verification record, and the journal gains exactly one refusal decision. The owner's correction ruling (option b) retains an operation's own replay receipt for the refused request_id; it is not one of those records. All pre-existing receipts also remain byte-identical. No whole-namespace or state.json byte-equality claim replaces these record-level assertions. Why gets an existing-operation phase selector with part=refusals, no new operation name and no tools/list ceiling increase (6245 has already been replaced only in plan 1). No issue-close tool action is part of this executor dispatch; T3 supplies GH-265's acceptance.

Correction run: store/model.rs::validate_decisions at :348-349 rejects expanded boundary histories independently of writer admission; the writer alone cannot make them valid. Lease and update both, preserving historical budget/terminal validation while distinguishing new native refusal observations. Drop verification_service.rs, verification/persistence.rs and undo_service.rs from this lease: their only proposed edit was receipt removal, now expressly forbidden. Verification replay behavior (crates/cadence/src/verification/persistence.rs:60), undo_requests (crates/cadence/src/undo_service.rs:27), milestones (crates/cadence/src/milestone_service.rs:145), landings (crates/cadence/src/landing_service.rs:136), and shared receipt persistence (crates/cadence/src/milestone/model.rs:126) stay intact. crates/cadence/tests/landing.rs:397 continues pinning land-read's retained refusal.

Refusal-assertion sweep at HEAD: searched every crates/cadence/tests/*.rs and crates/cadence/src/*_tests.rs for tree(, reopened(, .view(), snapshot( and before, then read the surrounding comparisons and their helpers. Added plan_publication.rs and risk_check.rs; mcp.rs was already leased for why and is now also leased by P17-3-T2 for its request-reused whole-view comparison. Existing leased refusal comparisons in execution_lifecycle.rs, verification.rs, verification_receipts.rs, evidence_limits.rs, execution_summary.rs, typed_authoring.rs, evidence_map.rs and context_submission.rs stay in the sweep. Per-request baselines matter for table-driven refusals; a single baseline before a refusal loop cannot assert one decision after each iteration.

Checked and left strict (no refusal-delta edit needed):
- tests/landing.rs: document snapshots exclude store files; its release snapshot contains release.json, HEAD, index and tags, and undo compares retained domain namespaces. Refusal receipts and land-read refusal readback stay. tests/debug_record.rs likewise uses Markdown/config-only documents; tests/debug_review.rs pins review/domain state and git material, not whole-store equality. tests/spike_record.rs takes the generation baseline after the refusals, then compares only successful open/verdict/close replays.
- tests/lease.rs: native lease refusals already assert unchanged data plus one boundary decision; the whole-view equality is successful historical dispatch replay. tests/execution_store.rs and tests/execution_boundary_compat.rs: direct writer operations and historical generic-boundary budget/replay/recovery encodings retain their old semantics; new native refusal observations must be distinguished rather than relaxing these pins.
- tests/evidence_store.rs, tests/risk_receipts.rs and tests/store.rs: direct writer transactions, fault recovery, or successful logical replay, not newly refused native apply envelopes. tests/store_staging_clean.rs compares successful task-close recovery/replay after its direct writer fault.
- tests/derivation_consistency.rs and src/derivation_service_tests.rs: direct derivation/query, input-failure and memo assertions. src/evidence_service_tests.rs: direct evidence service/recovery and query/logical replay; preserved namespace rows are domain records. src/phase10_provider_tests.rs: provider attempt/state observations. src/pause_service_tests.rs: git/worktree observations. src/next_action_service_tests.rs: derived query decisions. These are not new native apply refusal whole-store equalities.
- tests/query_surfaces.rs: strict suggest/read-only store comparisons and authored-document comparisons, which must remain unchanged. tests/read_layer.rs and tests/verification_wire.rs: queries/document reads preserve stored bytes. tests/execution_blocked_path.rs compares execution events/plan state, not journal growth; tests/evidence_released_checks.rs, tests/execution_suite_gate.rs and tests/execution_terminal_reopen.rs pin execution state/closure, not refusal journal equality.
- tests/adoption_import.rs and tests/adoption_retirement.rs: import provenance, source/copy preservation, read-only reopen, and standalone retirement/recovery files. tests/guard.rs: separate hook audit and process/recovery contracts, not cadence_apply. tests/surfaces.rs and tests/config_interview.rs: detector/config value or no-op assertions. tests/config_global.rs: direct config writer/recovery. tests/review_contract.rs and tests/review_wire.rs: findings/material shape and bounded transport, not whole-journal equality.
- Already leased src/debug_consult_tests.rs retains provider call counts, replay answers and debug records; src/execution_service_tests.rs retains successful historical patch replay and semantic-data comparisons. No blanket change to those assertions is authorized merely because their files remain leased.
Within risk_check.rs keep successful observation/lost-reply replay strict, and public_persistence_failure_never_returns_a_recorded_success strict: its obstructed intent produces an RPC store failure, not a journaled refused success. Preserve the corrupt-config/unavailable-store best-effort case when recording cannot acquire the store. Within mcp.rs keep execution_calls_log_bound_replay_preserves_terminal_bytes as the historical dispatch-loop cap contract; new native refusal observations have their own classification. Keep cadence_version/root-isolation and successful replay comparisons strict.
