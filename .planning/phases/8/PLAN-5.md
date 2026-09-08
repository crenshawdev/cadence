---
phase: 8
plan: 5
requirements:
  - AC1
  - AC2
  - AC8
  - AC10
  - AC11
files:
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/config/reload.rs
  - crates/cadence/src/config_service.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/execution/model.rs
  - crates/cadence/src/execution/dispatch.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/execution_service_tests.rs
  - crates/cadence/tests/phase8_dispatch.rs
  - crates/cadence/tests/phase8_config.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/tests/execution_boundary_compat.rs
  - crates/cadence/tests/mcp.rs
  - docs/architecture/boundary.md
  - docs/architecture/config-routing.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P8-5-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence"
    - id: P8-5-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P8-5-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
---

# Phase 8: Admission, replay and real skill proof - Plan 5

## Goal

A saved model/rung choice reaches real dispatch through the shipped skill and remains accurately attributable after races, interruption and replay. This plan alone closes the final config-generation admission check and produces the required live-host evidence.

## Must be true when done

- AC11/D-56: A genuinely new dispatch is admitted against the same config inputs that selected it; valid external edits during admission cannot leave a stale accepted choice.
- AC11/D-56: Reopen and replay preserve an active dispatch's admitted route, exact prompt and matching durable routing evidence; new settings govern the next new dispatch.
- AC11/D-56: Interrupted recording cannot expose an active route-bearing dispatch without its routing decision, and missing host effort/receipt evidence stays absent.
- AC10/D-46: The actual cad-execute skill loads the three tools, consumes saved model/agent choices and relays exact prompt and patch bytes through real host calls.
- AC8/AC10: Installed rung files and actual requested parameters are verified separately from any observed host effort; no observation is inferred from frontmatter.
- AC1/D-49: Existing config and phase 7 execution/lease/rail behavior remains covered by the full suite.

## Context

D-45, D-46, D-49, D-53 and D-56 bind this plan. Use the routed dispatch from Plan 1, shared global ownership from Plan 2 and final policy bundle from Plan 4. Existing RoutingObserved/BeforeCommit probes, SessionPolicy and the writer's final prospective snapshot validation are the race seams. AC10 is a mandatory human-verify obligation.

## Tasks

### Task 1: Bind new admission to the observed configuration (P8-5-T1)

- **Files:** `crates/cadence/src/import/mod.rs` (SessionPolicy::validate / Session::request / Session::config), `crates/cadence/src/config/reload.rs` (Generation / Input / Reload::refresh), `crates/cadence/src/config_service.rs` (route observation from prior plans), `crates/cadence/src/execution_service.rs` (query / reobserve / dispatch_response / RoutingObserved hook), `crates/cadence/src/execution/model.rs` (route data on ActiveDispatch from Plan 1), `crates/cadence/src/execution/dispatch.rs` (route identity from Plan 1), `crates/cadence/src/store/writer.rs` (boundary_v1 / persist / MutationContext construction), `crates/cadence/src/store/transaction.rs` (final policy validation / recover), `crates/cadence/src/execution_service_tests.rs` (Driver / Event race fixtures), `crates/cadence/tests/phase8_dispatch.rs` (new-dispatch freshness integration), `crates/cadence/tests/phase8_config.rs` (public read/route freshness)
- **Action:** Capture the resolved config inputs used by a proposed new route, including resolved layer identities, exact byte digests/presence and selection provenance; Generation.number alone is neither a cross-session identity nor evidence of unchanged bytes. Carry a binary-owned precondition through dispatch preparation and the writer's admission unit. At the final prospective-state policy validation before durable intent installation, refresh with the existing Reload seam and compare the same captured inputs. Compare after production ownership is acquired, including Plan 2's shared destination ownership for cooperating writes. Do not rely solely on execution_service::reobserve's plan/HEAD/store checks or on config remaining schema-valid.

  Choose refusal on a changed routing input, not silent recomputation inside a partially prepared dispatch. Return a typed changed-input refusal without an active candidate, routing-success record or worker prompt usable as an admitted dispatch; the next query may prepare from current inputs. Test the whole observation-to-final-validation interval, including an edit after the service's last reobserve but before intent admission. Preserve a current policy refusal when reload fails.

  Apply the equality precondition only to genuinely new dispatch admission. Recovery of an admitted intent validates its stored route/evidence unit and current config usability but never resolves that historical route again. Replaying an already-active dispatch also validates current controlling config yet keeps the admitted route, prompt and identity even after a valid settings change. A config-route fact query refreshes the same generation through all components; it must not combine current role values with a cached waiver/policy answer. Do not rebuild Reload, add a watcher or introduce a third config layer.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Deterministic hooks change sonnet to opus with both generations valid between route calculation and admission, and separately after service reobserve but before final policy validation. Both attempts refuse with no admitted candidate; a fresh query selects opus. Repeat equal-size/equal-mtime edits, rename/alias-retarget, inherited global reset, waiver edits and failed-I/O invalidation at new public consumers. After a successful admission, valid edits plus restart preserve its exact route/prompt; completing it lets the next new dispatch select current settings. Invalid current config still refuses resume.

### Task 2: Falsify partial routing admission on recovery (P8-5-T2)

- **Files:** `crates/cadence/src/store/writer.rs` (boundary_v1 / confirmed_boundary / require_current_execution), `crates/cadence/src/store/transaction.rs` (Intent::validate_boundary_v1 / commit / recover), `crates/cadence/src/execution/boundary.rs` (canonical_bytes / PreparedAnswer / historical digest fixtures), `crates/cadence/src/execution_service.rs` (dispatch_response / historical render_prompt_version), `crates/cadence/tests/phase8_dispatch.rs` (failure and replay fixtures), `crates/cadence/tests/execution_boundary_compat.rs` (independent old dispatch / intent bytes)
- **Action:** Complete the adversarial proof of Plan 1's atomic routing admission. Independently encode persisted fixtures rather than constructing every expected record through current serializers. Inject failures at routing-record preparation, intent sync, decision installation, snapshot installation, confirmation and removal of the durable intent, plus a killed process between decision and snapshot replacement. Reopen through the production factory/writer. A new route-bearing admitted dispatch, its Routing decision and its confirmed boundary must be one validated recovery unit; either the exact unit becomes confirmed once or the operation remains explicitly unconfirmed/refused. A generic late AppendDecision that fails after dispatch admission must be unable to satisfy the tests. Exercise duplicate request identity and recovery without duplicate Routing decisions.

  Validate the join among dispatch identity, chosen model/agent/rung, config provenance, requested effort and routing decision before a recovered dispatch can be returned. Detect a missing/mismatched decision even if a fixture recomputes the containing JSON/snapshot digest; mere integrity consistency is weaker than semantic completeness. Leave observed effort and receipt absent without host evidence, including retries, recovery and default rungs.

  Preserve the fixed-shape dispatches and both renderings that the pre-phase-8 current boundary already supports. Keep literal fixed records, empty/absent directories, prior integrity preimages and exact public answer digest fixtures; optional route data cannot alter them. Older boundary generations that already receive an explicit legacy-execution refusal retain that existing refusal and unchanged bytes, rather than becoming silently supported or rerouted. Do not weaken prompt byte/digest validation or retroactively invent route observations to make old fixtures pass. Correct only defects exposed in these same admission/replay seams.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — Every injected interruption either recovers the same complete admission once or returns a failure with no confirmed orphan dispatch. Recomputed-digest fixtures with missing/mismatched Routing evidence are rejected. Duplicate calls and process replacement retain one routing decision, exact agent/model/rung/provenance and prompt digest. No fixture with absent host evidence serializes observed_effort or receipt. Independent historical fixed/current-codec fixtures replay byte-exactly; already-unsupported old codecs keep their explicit compatibility refusal without mutation.

### Task 3: Prove saved settings reach the dispatch decision (P8-5-T3)

- **Files:** `crates/cadence/tests/phase8_dispatch.rs`, `crates/cadence/tests/mcp.rs` (grouped boundary / skill contract), `docs/architecture/config-routing.md` (saved settings reach dispatch / evidence limits)
- **Action:** Test that saved configuration determines the dispatch decision, against the binary, with no host, no skill invocation and no Task call. Through native config apply save executor sonnet/high and assert the routing decision names sonnet and cad-executor. Save opus/xhigh before a separate new dispatch and assert opus and cad-executor-xhigh. Reset only model to null before a third genuinely new dispatch and assert the model parameter is omitted; re-reading the opus dispatch is not that check. For each case assert the admitted dispatch ID, the routing decision and its reason trail, and the byte-exact prompt the binary emits. Separately assert the boundary advertises exactly cadence_version, cadence_query and cadence_apply with their schemas, retains phase 7 operations, and returns typed refusals for malformed calls. Keep requested effort distinct from resolved effort. Document in `config-routing.md` what this proves and what it does not: it proves the binary's decision given a saved config, not that any consumer honours that decision.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — proves each saved config yields its expected agent, model and rung, that a null model omits the parameter, and that the prompt and dispatch ID are exact. Three tools with schemas and typed malformed-call refusals still hold. A routing answer that matches only because the expectation was derived from the same code path does not pass.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-49 / AC1 | P8-5-T1, P8-5-T3 |
| D-50 / AC2 (consumption freshness) | P8-5-T1 |
| D-53 / AC8 (installed consumer proof) | P8-5-T3 |
| D-45 / D-46 / AC10 | P8-5-T3 |
| D-56 / AC11 | P8-5-T1, P8-5-T2, P8-5-T3 |

## Notes

Run after Plan 4; all preceding plans are transitively required through real file overlaps. This plan shares execution_service.rs and phase8_dispatch.rs with Plan 4, writer/import with Plans 1-2, and the live harness/document with Plan 3. It cannot run in parallel with any unfinished predecessor.

The final admission comparison linearizes selection at the final validated inputs; common ownership protects that interval from cooperating Cadence writers. It does not claim to freeze arbitrary external filesystem editors forever. A later valid change is a new input for the next new dispatch, never retrospective authority to change an active one. Store generation alone cannot detect an external config edit, so a positive configuration identity/byte comparison is required.

Authoring established that cargo, node and the host executables are on PATH, not that authentication, dispatch or host effort observation works. The real-host tasks remain human-verify when those capabilities are unavailable. Their ignored command paths must fail, not skip successfully, when their selected stage, required events or observed work are absent. The ordinary workspace suite excludes live tests and cannot close AC4's observed interview or AC10.

The suite is test --workspace, clippy --all-targets with warnings denied and fmt --check, with TMPDIR=/tmp and RUSTC_WRAPPER empty. No new dependencies or checked-in fixture directories are needed; all fixture artifacts remain embedded in leased test files or created under temporary test roots.

