---
phase: 8
plan: 5
requirements:
  - AC2
  - AC8
  - AC10
  - AC11
files:
  - crates/cadence/src/store/mod.rs
  - crates/cadence/src/config/tests.rs
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
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests"
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

# Phase 8: Admission, replay and binary dispatch proof - Plan 5

## Goal

A saved model/rung choice determines binary dispatch and remains accurately attributable after changed inputs, interruption and replay. This plan closes the final config-generation admission check. Live-host consumption is routed to `.planning/phases/8/MANUAL.md` and is not an obligation here.

## Must be true when done

- AC11/D-56: A genuinely new dispatch is admitted against the same config inputs that selected it; valid external edits during admission cannot leave a stale accepted choice.
- AC11/D-56: Reopen and replay preserve an active dispatch's admitted route, exact prompt and matching durable routing evidence; new settings govern the next new dispatch.
- AC11/D-56: Interrupted recording cannot expose an active route-bearing dispatch without its routing decision, and missing host effort/receipt evidence stays absent.
- AC10/D-46: The binary returns the three tool schemas, resolves a saved model/agent choice into an admitted dispatch, and emits the byte-exact prompt. Whether a host honours that resolution is not asserted here.
- AC8/AC10: Installed rung files and actual requested parameters are verified separately from any observed host effort; no observation is inferred from frontmatter.

## Context

D-45, D-46, D-49, D-53 and D-56 bind this plan. Use the routed dispatch from Plan 1, shared global ownership from Plan 2 and final policy bundle from Plan 4. Existing RoutingObserved/BeforeCommit probes, SessionPolicy and the writer's final prospective snapshot validation are the race seams. AC10's host-consumption half is routed to `.planning/phases/8/MANUAL.md`; the binary-side resolution it names is asserted by this plan's tests.

## Tasks

### Task 1: Bind new admission to the observed configuration (P8-5-T1)

- **Files:** `crates/cadence/src/import/mod.rs` (SessionPolicy::validate / Session::request / Session::config), `crates/cadence/src/config/reload.rs` (Generation / Input / Reload::refresh), `crates/cadence/src/config_service.rs` (route observation from prior plans), `crates/cadence/src/execution_service.rs` (query / reobserve / dispatch_response / RoutingObserved hook), `crates/cadence/src/execution/model.rs` (route data on ActiveDispatch from Plan 1), `crates/cadence/src/execution/dispatch.rs` (route identity from Plan 1), `crates/cadence/src/store/writer.rs` (boundary_v1 / persist / MutationContext construction), `crates/cadence/src/store/transaction.rs` (final policy validation / recover), `crates/cadence/src/execution_service_tests.rs` (Driver / Event race fixtures), `crates/cadence/tests/phase8_dispatch.rs` (new-dispatch freshness integration), `crates/cadence/tests/phase8_config.rs` (public read/route freshness), `crates/cadence/src/store/mod.rs` (final routing policy precondition), `crates/cadence/src/execution/boundary.rs` (typed changed-input failure), `crates/cadence/src/config/tests.rs` (repair stale alias-intent expectations exposed by the required binary target)
- **Action:** Capture the resolved config inputs used by a proposed new route, including resolved layer identities, exact byte digests/presence and selection provenance; Generation.number alone is neither a cross-session identity nor evidence of unchanged bytes. Carry a binary-owned precondition through dispatch preparation and the writer's admission unit. At the final prospective-state policy validation before durable intent installation, refresh with the existing Reload seam and compare the same captured inputs. Compare after production ownership is acquired, including Plan 2's shared destination ownership for cooperating writes. Do not rely solely on execution_service::reobserve's plan/HEAD/store checks or on config remaining schema-valid.

  Choose refusal on a changed routing input, not silent recomputation inside a partially prepared dispatch. Return a typed changed-input refusal without an active candidate, routing-success record or worker prompt usable as an admitted dispatch; the next query may prepare from current inputs. Test the whole observation-to-final-validation interval, including an edit after the service's last reobserve but before intent admission. Preserve a current policy refusal when reload fails.

  Apply the equality precondition only to genuinely new dispatch admission. Recovery of an admitted intent validates its stored route/evidence unit and current config usability but never resolves that historical route again. Replaying an already-active dispatch also validates current controlling config yet keeps the admitted route, prompt and identity even after a valid settings change. A config-route fact query refreshes the same generation through all components; it must not combine current role values with a cached waiver/policy answer. Do not rebuild Reload, add a watcher or introduce a third config layer.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Reload::refresh_expected returns a supplied Generation for identical captured identities, presence, exact bytes and stamps, or Conflict("routing inputs changed before admission") for independently supplied changed model, equal-size bytes, replacement identity, alias, global reset or waiver inputs; failed reads preserve their Io refusal. The final transaction policy consumes the proposed route inputs after preparation under writer ownership. Independent recovery/replay fixtures retain historical inputs without equality checks, and resolve_route returns one supplied generation for role and policy. No edit/query/restart/completion chain is required.

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
| D-50 / AC2 (consumption freshness) | P8-5-T1 |
| D-53 / AC8 (binary parameter proof) | P8-5-T3 |
| D-45 / D-46 / AC10 | P8-5-T3 |
| D-56 / AC11 | P8-5-T1, P8-5-T2, P8-5-T3 |

## Notes

Run after Plan 4; all preceding plans are transitively required through real file overlaps. This plan shares execution_service.rs and phase8_dispatch.rs with Plan 4, writer/import with Plans 1-2, and the grouped schema contract with Plan 3. It cannot run in parallel with any unfinished predecessor.

The final admission comparison linearizes selection at the final validated inputs; common ownership protects that interval from cooperating Cadence writers. It does not claim to freeze arbitrary external filesystem editors forever. A later valid change is a new input for the next new dispatch, never retrospective authority to change an active one. Store generation alone cannot detect an external config edit, so a positive configuration identity/byte comparison is required.

This plan writes no live test. AC4's observed interview and AC10's host consumption are routed to `.planning/phases/8/MANUAL.md` under the Overflow rule; the named binary test targets do not close them and no ignored live command path is added to stand in for them.

The only final lint is `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests`, once after task tests; fix any warnings. Only the exact task Verify commands run, sequentially. No new dependencies or checked-in fixture directories are needed; all fixture artifacts remain embedded in leased test files or created under temporary test roots.

