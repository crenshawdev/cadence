---
phase: 37
plan: 1
requirements: ["T1","T2","T3","T4"]
files: ["crates/cadence/src/plan/associations.rs","crates/cadence/tests/phase37_rejected_checks.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P37-1-T1","verify":["cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact"]}]}
---
# Phase 37: What a rejected check leaves behind - Plan 1

## Goal

Extend the existing released-check projection so a retained accepted verification patch's rejected check definition stops being current through the admission version of its owning plan, while every consumer keeps phase 36's retirement semantics and unchanged record shapes.

## Must be true when done

- T1. When verification rejected a check and a later plan publishes that check id with a changed spec, the owner sees the preview accepted.
- T2. When a later plan's task claims a check that verification rejected, the owner sees the extension admitted.
- T3. When verification rejected a check, the owner sees its rejected definition in evidence-read as retained, not current.
- T4. When a later plan that re-proved a rejected check has completed, the owner gets a fresh verification attempt whose map carries only the later definition.

## Context

D-161 is the exact rule at .planning/phases/37/CONTEXT.md:9. The single projection at crates/cadence/src/plan/associations.rs:49-76 currently derives releases only from Blocked plans and unclosed owning tasks. Extend released_check_revisions there: keep the blocked-plan loop unchanged, then read retained accepted patches through verification::verdicts::patches at crates/cadence/src/verification/verdicts.rs:32-35, match each Verdict::Rejected ItemVerdict by both id and item_revision to the immutable check rows returned for each admitted plan, and merge that owning plan's first admission set version with the existing max-through rule. A verdict alone must not release a different revision with the same id.

The patch accessor is sufficient inside the approved lease. verification-submit stores a patch only when its fully assessed claim answered ok at crates/cadence/src/verification/verdicts.rs:176-180. Assessment requires one verdict per canonical item at crates/cadence/src/verification/verdicts.rs:116-158, while the run rule at crates/cadence/src/verification/verdicts.rs:133-136 requires a run only for an accepted check; a rejected check legitimately carries runs: []. ItemVerdict's retained id, item_revision, verdict, observed and runs fields are at crates/cadence/src/verification/model.rs:43-51. Add no status write: the accepted patch is immutable authority.

Every downstream behavior already consumes released_check_revisions. Complete plan preview filters saved current contributions at crates/cadence/src/plan/associations.rs:78-111 before shared-definition validation reaches evidence-item-conflict at crates/cadence/src/plan/associations.rs:160-164. Execution admission applies the same filter and derives exact historical allocation tuples at crates/cadence/src/execution/admission.rs:221-252; allocation-owner is otherwise raised at crates/cadence/src/execution/allocation.rs:57-59. Evidence-read uses the shared predicate for current items, aliases and associations and changes only the existing history status at crates/cadence/src/plan/map_view.rs:146-150 and crates/cadence/src/plan/map_view.rs:164-233. The status field remains the current/superseded field defined at crates/cadence/src/plan/map_history.rs:44-52. Verification observes that map and derives inputs.checks from its current check items at crates/cadence/src/verification/inputs.rs:137-156. Do not modify those consumers.

The four checks use env!(CARGO_BIN_EXE_cadence) through the real stdio Client at crates/cadence/tests/support/phase13.rs:15-92 and fresh disposable signed Git projects. Factor repeated setup helpers only inside crates/cadence/tests/phase37_rejected_checks.rs. Reuse the complete real plan path demonstrated by phase36_blocked_then_completed_phase_gets_verification_attempt at crates/cadence/tests/phase36_released_checks.rs:343-510, but do not edit, lease, or assert changes in any phase-36 file. Each fixture reaches the retained rejection through context-submit, plan-submit, execution-admit, execution-authorize, execute-next, execution-task-start, real execution-run red/green, execution-owner-attest, execution-task-close, execution-suite, risk-check, execution-plan-complete, verify-next and verification-submit before exercising its truth's final operation. Expected values remain handwritten, and no check fakes its stdio, persistence, execution, Git or verification boundary.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P37-T1-C",
      "spec": {
        "command": "cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact",
        "expected": {
          "kind": "property",
          "value": "After a completed plan's canonical check is rejected by a retained accepted verification patch, a complete plan-read preview for a later plan returns status \"ok\" when the later plan republishes the same check id with a handwritten changed command, expected property and test locator. The preview contains the changed definition and reports coverage.uncovered == [] and coverage.without_check == []; publishing that exact preview and calling evidence-read leaves the old plan's non-check artifact current, makes only the later check definition current, and does not restore the rejected item revision."
        },
        "test": {
          "file": "crates/cadence/tests/phase37_rejected_checks.rs",
          "function": "phase37_rejected_check_can_be_republished_with_changed_spec"
        },
        "setup": "Create a fresh disposable signed Git project and start env!(CARGO_BIN_EXE_cadence) through the real tests/support/phase13.rs Client. Through public stdio, context-submit one approved fixture truth; plan-submit an initial attached map containing one check and one non-check artifact; execution-admit its exact publication/map revisions and allocation; execution-authorize, execute-next and execution-task-start; create and commit the failing acceptance subject, execution-run it red, implement and commit green, execution-run it green plus named verification, execution-owner-attest, execution-task-close, execution-suite, risk-check and execution-plan-complete. Call verify-next, copy its basis exactly, and verification-submit a handwritten complete patch with a rejected verdict and empty runs for the check plus an accepted verdict for the artifact. Allocate a later plan and give the same check id a deliberately changed handwritten definition. Do not seed the store, call internal validators or alter phase 36 fixtures.",
        "call": "Call cadence_query plan-read with the complete later-plan submission. Assert status \"ok\", the normalized changed check and both empty coverage arrays from handwritten values; publish exactly the returned submission, then call evidence-read and assert the old artifact and later check are current while the rejected item revision is absent from current items, aliases and associations.",
        "boundary": "Real binary over MCP stdio -> durable context, publication, admission, completed execution and retained accepted verification patch -> complete plan-union preview and public current-map readback.",
        "fakes": []
      },
      "reason": "If a rejected completed check remains current, today's evidence-item-conflict at submission.plans[0].content.evidence_map.items[0].id fires; if filtering drops non-check evidence, the post-publication current-map assertion fails.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This public preview and current-union result is the owner-visible outcome approved as phase 37 T1."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P37-T2-C",
      "spec": {
        "command": "cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact",
        "expected": {
          "kind": "property",
          "value": "After the retained accepted patch rejects the completed first plan's check, execution-extend returns status \"ok\" and receipt.set_version == 2 for a full contract that preserves the first admission's allocation row byte-for-byte and adds a later plan task claiming the same check id. The receipt retains both exact rows; the first row is historical and the later row is the sole active owner, so no allocation-owner refusal occurs."
        },
        "test": {
          "file": "crates/cadence/tests/phase37_rejected_checks.rs",
          "function": "phase37_extension_reassigns_rejected_check"
        },
        "setup": "Build a separate fresh disposable signed project through the same real public context-submit, initial plan-submit, execution-admit, execution-authorize, execute-next, execution-task-start, committed red/green execution-run pair, named verification run, execution-owner-attest, execution-task-close, execution-suite, risk-check, execution-plan-complete, verify-next and verification-submit sequence. The complete handwritten verification patch copies the attempt basis, names every canonical item, rejects the check with runs: [] and accepts the artifact. Publish a later plan that aliases the rejected check id with the same definition, then construct the version-2 contract from plan-read and evidence-read authority, preserving allocation[0] exactly and adding the later task at allocation[1].",
        "call": "Call cadence_apply execution-extend with expected_set_version 1 and the complete contract. Assert the returned status, set version, exact unchanged allocation[0], exact later allocation[1], and both check rows against handwritten JSON.",
        "boundary": "Real binary over MCP stdio -> retained accepted rejection and first-admission allocation -> execution extension validation and durable version-2 admission receipt.",
        "fakes": []
      },
      "reason": "Without D-161's historical-row projection, allocation::validate returns allocation-owner at contract.allocation[1].checks[0].",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This public execution-extend result is the owner-visible outcome approved as phase 37 T2."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P37-T3-C",
      "spec": {
        "command": "cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact",
        "expected": {
          "kind": "property",
          "value": "Immediately after the complete handwritten verification patch is accepted with a rejected verdict for the check, evidence-read returns schema \"acceptance-map-view-1\" and coherence \"consistent\"; omits the rejected check definition from current items, aliases and associations; retains the old plan's artifact as current; and keeps the exact old map definition in history with the existing status field equal to \"superseded\" and superseded_by null. No new answer field or record is present."
        },
        "test": {
          "file": "crates/cadence/tests/phase37_rejected_checks.rs",
          "function": "phase37_evidence_read_retains_rejected_check_as_superseded"
        },
        "setup": "Create another fresh disposable signed project and drive the real public context-submit, plan-submit, execution-admit, execution-authorize, execute-next, execution-task-start, committed red/green execution-run, named verification, execution-owner-attest, execution-task-close, execution-suite, risk-check and execution-plan-complete path. Request verify-next and verification-submit a complete handwritten patch copied from that attempt: reject the check with nonblank observed evidence and runs: [], accept the non-check artifact with nonblank observed evidence and runs: []. Retain the initial evidence-read item revisions as handwritten comparison inputs; do not manufacture history or status.",
        "call": "Call cadence_query evidence-read for the fixture phase and compare schema, coherence, exact current items/aliases/associations, coverage, and the retained history publication/status to handwritten JSON and the previously observed item revisions.",
        "boundary": "Real binary over MCP stdio -> retained accepted verification patch -> acceptance-map-view-1 current collections and immutable map history serialization.",
        "fakes": []
      },
      "reason": "If the retained rejection is not part of the release projection, the rejected check remains in all three current collections and the old map history stays \"current\".",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This public evidence-read result is the retained-not-current outcome approved as phase 37 T3."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P37-T4-C",
      "spec": {
        "command": "cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact",
        "expected": {
          "kind": "property",
          "value": "After a later plan republishes the rejected check id with a changed definition and re-proves that later item through committed red and green runs, owner attestation, task close, suite, risk settlement and execution-plan-complete, a fresh verify-next returns status \"ok\". Its attempt.inputs.map.items contains the non-check artifact and exactly the later check definition/revision, attempt.inputs.checks contains exactly that later check definition/revision, and the old rejected item revision is absent from both arrays."
        },
        "test": {
          "file": "crates/cadence/tests/phase37_rejected_checks.rs",
          "function": "phase37_fresh_verification_uses_only_reproved_check_definition"
        },
        "setup": "Reuse the phase36_blocked_then_completed_phase_gets_verification_attempt fixture path in crates/cadence/tests/phase36_released_checks.rs by adapting its real stdio completion helpers in the new phase-37 test, without editing phase 36. Build a fresh signed project through public context-submit, initial plan-submit, execution-admit, execution-authorize, execute-next, execution-task-start, real committed red/green execution-run, named verification, execution-owner-attest, execution-task-close, execution-suite, risk-check and execution-plan-complete. Call verify-next and submit the complete copied-basis patch that rejects the first check with no run reference. Then publish a later changed definition, execution-extend with the old row unchanged and the later row owning its fresh revision, and repeat the complete real red/green-to-plan-complete path for the later plan.",
        "call": "Call cadence_query verify-next with a fresh request id after the later plan completes. Assert status \"ok\", then compare attempt.inputs.map.items and attempt.inputs.checks to handwritten later-definition JSON and explicitly assert the old item revision occurs in neither array.",
        "boundary": "Real binary over MCP stdio -> two durable completed executions separated by an accepted rejected verdict and versioned extension -> fresh verification attempt inputs.",
        "fakes": []
      },
      "reason": "If verification consumes the rejected historical definition or the release projection is inconsistent, the fresh attempt is refused or its canonical map/check arrays contain the old revision.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "This fresh public verification attempt is the later-only definition outcome approved as phase 37 T4."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P37-A-REJECTED-RELEASE",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/associations.rs::released_check_revisions",
          "crates/cadence/src/verification/verdicts.rs::patches",
          "crates/cadence/src/verification/model.rs::ItemVerdict"
        ],
        "substance": "The one existing released-check projection merges a second derived source: every rejected (id, item_revision) in retained accepted verification patches is matched to the exact check allocation owned by each admitted plan and releases that canonical revision through the admission set version that first admitted the owning plan. Blocked/unclosed release behavior remains unchanged. Candidate publication validation, execution admission/history, evidence-read current/history assembly and verification inputs continue consuming this single projection without new records, files, operations or answer fields."
      },
      "reason": "If rejected verdicts are not merged by exact id and revision into the shared through-version projection, one or more consumers will keep the old definition current or count its old owner.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The shared projection is necessary for the accepted changed-definition preview in T1."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The shared projection is necessary for the historical old allocation row and sole later owner in T2."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The shared projection is necessary for the retained-not-current evidence-read view in T3."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The shared projection is necessary for the later-only fresh verification inputs in T4."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Release rejected checks across every existing consumer

- **ID:** P37-1-T1
- **Files:** crates/cadence/src/plan/associations.rs, crates/cadence/tests/phase37_rejected_checks.rs.
- **Action:** Before editing production source, add the shared fresh-project fixture and all four final acceptance functions: phase37_rejected_check_can_be_republished_with_changed_spec, phase37_extension_reassigns_rejected_check, phase37_evidence_read_retains_rejected_check_as_superseded and phase37_fresh_verification_uses_only_reproved_check_definition. Commit that test state and run each exact command as this task's red evidence. Each assertion names only its final public outcome, so today's binary exits nonzero for the truth-specific boundary reason: T1 receives evidence-item-conflict at submission.plans[0].content.evidence_map.items[0].id; T2 receives allocation-owner at contract.allocation[1].checks[0]; T3 still finds the rejected definition current; T4 still finds the old revision in the fresh attempt's inputs. Then make the one production change in released_check_revisions: merge retained accepted patches' rejected (id, item_revision) pairs through the first admission set version of the exact owning plan, retaining the existing maximum-through merge and blocked-plan source. Commit that implementation, rerun all four exact commands green, and close this one task with all four red/green pairs. Do not make a test branch on the build under test, weaken existing refusals, change consumer files, or add persisted state.
- **Verify:**
  - cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact

## Notes

This is one executor task because the protocol must capture all four failing checks before the one shared projection change makes every existing consumer green. P37-1-T1 owns all four checks and closes with four pairs. The file lease is only crates/cadence/src/plan/associations.rs and crates/cadence/tests/phase37_rejected_checks.rs. tests/support/phase13.rs is imported unchanged, and no existing test assertion moves. No phase-31, phase-34 or phase-36 file is leased or changed. No new record kind, store file, operation, answer field, observation item or direct phase-36 repair is planned.
