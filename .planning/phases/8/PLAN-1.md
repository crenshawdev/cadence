---
phase: 8
plan: 1
requirements:
  - AC1
  - AC2
  - AC5
  - AC8
  - AC10
  - AC11
  - GH-256
files:
  - crates/cadence/src/config/write.rs
  - crates/cadence/src/config/tests.rs
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/config_service.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/server.rs
  - crates/cadence/tests/phase8_config.rs
  - crates/cadence/tests/mcp.rs
  - crates/cadence/src/config/mod.rs
  - crates/cadence/src/config/roles.rs
  - crates/cadence/tests/phase8_routing.rs
  - crates/cadence/src/execution/model.rs
  - crates/cadence/src/execution/dispatch.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase8_dispatch.rs
  - crates/cadence/tests/execution_boundary_compat.rs
  - crates/cadence/src/execution_service_tests.rs
  - skills/cad-execute/SKILL.md
  - skills/cad-executor-contract/SKILL.md
  - agents/cad-executor.md
  - agents/cad-executor-low.md
  - agents/cad-executor-medium.md
  - agents/cad-executor-xhigh.md
  - agents/cad-executor-max.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P8-1-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence"
    - id: P8-1-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P8-1-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence"
---

# Phase 8: Saved choices reach the executor - Plan 1

## Goal

Effective config and role routing serve the skills before intake depends on them. This plan alone proves a durable public config save reaches a native route and the shipped execute consumer, with an admitted route retained on replay.

## Must be true when done

- AC2/D-50: Grouped config operations expose supported facts and save a validated batch in one confirmed transaction with destination, requested scope and changed keys.
- AC5/D-45: Present-null defeats its corresponding legacy pin in either layer; absent role leaves still permit legacy fallback, independently for model and effort.
- AC8/D-53: All six roles resolve through the explicit shipped rung map; retries, unsupported model strings and source explanations follow the locked rules.
- AC10/D-46: The advertised tool list remains exactly cadence_version, cadence_query and cadence_apply; the execute skill consumes the returned agent and optional model with the exact prompt.
- AC11/D-56: New dispatch admission includes its routing decision in the same recoverable transaction, while historical dispatch bytes and choices remain readable.
- AC1/D-49: New consumers use synchronous config refresh; the existing merge, collapse, invalidation and fourteen-retirement regressions remain authoritative.

## Context

D-45, D-46, D-49, D-50, D-53 and D-56 bind this plan. Reuse Session::config, Session::set_config, ConfigWriter, Effective::sources, build_dispatch and BoundaryChange::Dispatch. Phase 7 owns grouped-tool construction and source-lease enforcement; consume its finished implementation. Review-policy depth and the interview follow in Plans 3 and 4.

## Tasks

### Task 1: Expose the transactional config boundary (P8-1-T1)

- **Files:** `crates/cadence/src/config/mod.rs` (Layer / Effective / Diagnostics), `crates/cadence/src/config/write.rs` (ConfigWriter::set / validate_update), `crates/cadence/src/config/tests.rs` (config_updates_are_durable_visible_and_leave_legacy_bytes_unchanged), `crates/cadence/src/import/mod.rs` (Session::config / Session::set_config), `crates/cadence/src/config_service.rs` (new service), `crates/cadence/src/recall/mod.rs` (resident::Request / Resident::spawn_with_driver), `crates/cadence/src/server.rs` (QueryArguments / query_schema / PublicServer::call_tool / list_tools), `crates/cadence/tests/phase8_config.rs` (new integration target), `crates/cadence/tests/mcp.rs` (advertised schemas and runtime validation)
- **Action:** Apply the predecessor gate in Notes before editing. Add supported-config facts and batch-apply operations to the grouped construction phase 7 actually delivered, including resident requests, service execution, typed output envelopes and advertised output schemas. Do not change phase 7's union construction or choose its operation tags again. The binary supplies schema-supported keys, values, raw stored presence, effective values, source layers, requested-layer restrictions, diagnostics and destination identities; a skill never reconstructs these facts. Extend ConfigWriter's existing transaction seam to validate the entire selected-layer batch before mutation, reject duplicate/conflicting entries rather than silently choosing one, prepare one destination from one captured input and submit one transaction. Keep the single-key entry as delegation to that implementation. Validate each update, the proposed merged supported configuration, current controlling policy and destination identity; proposed permissions cannot authorize their own installation. Preserve unknown stored evidence and all unmentioned keys. An empty batch is a no-op; an identical explicitly stored value may be a no-op, but an absent leaf is not identical stored intent.

  Create the integration target with real stdio fixtures and add failure-injection cases to the leased config tests. Public refusal cases include invalid values, unknown/retired keys, wrong requested scope, alias scope, stale destination bytes, retargeted identity and failed refresh; no batch prefix may be saved. Return exact changed keys and the actual destination after confirmation, then refresh facts. Preserve phase 7 operations and typed malformed-call behavior, including malformed config operations that must not be decoded as an executor patch. A read-only diagnostic failure may name an unusable active key and layer/path without returning cached effective policy. Deliberately retain the existing repair limitation: supported live invalid values must be corrected by the operator in the named active file before normal config apply or execution can resume. Do not add a repair writer or let invalid current config authorize a replacement; the skill will disclose this limitation in Plan 3.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — The new target runs successful multi-key public writes, read/provenance assertions, byte-exact precommit refusals and reopened-session assertions. Existing binary tests exercise reload and final policy failures. tools/list loads all three tools with phase 7's operations retained, and malformed operation-specific calls return typed refusals. Distinguish a pre-intent refusal, which changes no config bytes, from an interrupted durable intent, which recovers forward; do not assert rollback after admission.

### Task 2: Resolve the saved role selection (P8-1-T2)

- **Files:** `crates/cadence/src/config/mod.rs` (schema / Effective), `crates/cadence/src/config/roles.rs` (new resolver), `crates/cadence/src/config_service.rs` (service added by Task 1), `crates/cadence/src/recall/mod.rs` (resident request routing), `crates/cadence/src/server.rs` (grouped query registration from phase 7), `crates/cadence/tests/phase8_routing.rs` (new integration target)
- **Action:** Add the native role resolver and expose its answer through the inherited grouped query. Start with the stored projected layers and Effective::sources, never default-filled values alone. A winning roles effort leaf selects its stored rung, or its own schema default when null; a winning roles model leaf selects its supported model, or session inheritance when null. Neither null consults its corresponding legacy key. Only absence permits model.effort or model.overrides fallback. Apply this to inherited GLOBAL null even when REPO has an older pin and no role leaf. Preserve the six schema defaults in planner/analyzer/verifier/reviewer/executor/checker order: high/high/high/medium/high/low, with inherited session model.

  Encode the explicit role/rung map in the native resolver using the read-only RUNG_FILES and RUNG_ORDER reference in cadence-core/bin/lib/rung-agent.mjs. Do not derive names from suffixes. Validate all thirty mapped installed agent files, their effort frontmatter and their preloaded contract references in the new target; analyzer high is suffixed and analyzer xhigh is unsuffixed, checker low is unsuffixed. Resolve model compatibility at this boundary using an explicit documented host vocabulary, initially the reference aliases opus/sonnet/haiku/fable, with the installed-host obligation retained for Plan 5; never discover providers. Preserve typed model strings verbatim in storage. An unsupported non-null role model warns and omits the model argument without reviving legacy; an unsupported legacy model warns and omits it too. Only a successful legacy model override sets pinned. Return chosen values, exact winning layer/key, reset versus absence, ignored older pin and requested starting rung as explanations. Validate role, phase/plan scope and positive integral attempt input without coercion. With escalation opted in, any attempt greater than one moves once from the configured starting rung to the next available rung; attempts two and three agree and the top holds. Config reload failure refuses this consumer instead of reusing its previous answer. Do not claim a completed policy bundle or computed floor until Plan 4 supplies them.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — For every role, the target covers repo-null/global-legacy and global-null/repo-legacy with each null independently, both nulls together, both role leaves absent, explicit values, inherited values and source/reset explanations. It checks all thirty real agent mappings, all defaults, retry off/on at every rung, attempts 2=3, top holding, custom model byte preservation, unsupported-string non-fallback and pinned provenance. Repeated public route calls after external config edits observe the changed inputs or refuse unavailable ones.

### Task 3: Dispatch the admitted role choice (P8-1-T3)

- **Files:** `crates/cadence/src/execution/model.rs` (ActiveDispatch / DispatchPolicy / ExecutorRung), `crates/cadence/src/execution/dispatch.rs` (DispatchIdentity / build_dispatch / admit_dispatch), `crates/cadence/src/execution/boundary.rs` (PreparedAnswer / Receipt / historical canonical fixtures), `crates/cadence/src/execution_service.rs` (query / dispatch_response / render_prompt_version), `crates/cadence/src/store/writer.rs` (BoundaryChange::Dispatch / boundary_v1 / admit_execution), `crates/cadence/src/store/transaction.rs` (IntentKind / Intent::validate_boundary_v1), `crates/cadence/tests/phase8_dispatch.rs` (new integration target), `crates/cadence/tests/execution_boundary_compat.rs` (old_data / old wire dispatch), `crates/cadence/src/execution_service_tests.rs` (dispatch / Fixture), `crates/cadence/tests/mcp.rs` (skill_contract_matches_wire_patch_and_direct_tool_permissions / execute_restart_preserves_dispatch_and_advances_overlapping_signed_plans), `skills/cad-execute/SKILL.md` (process), `skills/cad-executor-contract/SKILL.md` (role / process / return), `agents/cad-executor.md` (description), `agents/cad-executor-low.md` (description), `agents/cad-executor-medium.md` (description), `agents/cad-executor-xhigh.md` (description), `agents/cad-executor-max.md` (description)
- **Action:** Use Task 2's resolver in genuinely new execution dispatches. Carry the selected agent, optional model, rung and stored config provenance including the resolved layer identities and input byte digests required for Plan 5's final admission comparison in backward-compatible dispatch data; bind the new selection into dispatch identity, prompt construction and the public answer's confirmation. Preserve the existing build_dispatch entry and old serialization/digest preimages for historical callers; add the routed admission path without changing every existing constructor or retroactively labeling old fixed dispatches as newly resolved. Keep fixed decoding and both historical prompt renderings readable. Optional new data must be omitted from historical serialization when absent. Historical fixed dispatches retain cad-executor and session inheritance; current settings never silently reroute them.

  Compose Decision::Routing with the admitted dispatch and its BoundaryV1 record in ONE writer persistence/recovery unit, not an AppendDecision after admission. Use the existing decision vocabulary and normalization; include agent/model/rung, source key/layer, reset/absence explanation and requested effort without inventing observed_effort or receipt. The writer and recovery validator must agree that a new route-bearing dispatch cannot become confirmed or replayable without its matching routing evidence. Preserve the already-supported legacy admission path and its historical records. Plan 5 extends the adversarial admission/recovery proof; this task already establishes atomic admission.

  Change cad-execute to take the mapped agent and optional model from the returned admitted dispatch, pass the returned prompt exactly and omit the model argument on inheritance. The skill must not issue a fresh route query that could disagree with an active dispatch. Preserve unchanged phase forwarding, all stop/continuation envelopes and field-for-field patch submission. Update the preloaded executor contract's fixed-rung assertions to accept the binary-selected rung while preserving current-branch behavior, native patch judgment text, signatures, phase 7 leases and continuation authority. Do not disable or rewrite phase 7's already-shipped rail behavior. This phase adds no reviewer dispatch. Correct the five executor agent descriptions; retain their effort frontmatter, tool permissions and shared preloaded contract. Update the existing mcp assertions for selected default high without erasing historical fixed-wire compatibility fixtures.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Public config apply followed by execute-next produces sonnet/cad-executor/high and a separate opus/cad-executor-xhigh dispatch with matching durable decisions and exact prompt digests. A third new dispatch after model null omits model. Reopen retains the admitted answer; old fixed dispatch wire bytes and prompt digests remain exact. Native signed patches still pass unchanged lease/judgment checks. Contract checks cover all five executor agents and forbid a fixed agent choice in the execute skill. These deterministic tests establish the runnable spine by task 3; real host consumption remains open until Plan 5.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-49 / AC1 | P8-1-T1, P8-1-T2, P8-1-T3 |
| D-50 / AC2 | P8-1-T1 |
| D-45 / D-53 / AC5 / GH-256 | P8-1-T2 |
| D-53 / AC8 | P8-1-T2, P8-1-T3 |
| D-46 / AC10 | P8-1-T1, P8-1-T2, P8-1-T3; live closure in P8-5-T3 |
| D-56 / AC11 | P8-1-T3; adversarial closure in Plan 5 |

## Notes

Execution prerequisite: phase 7 must be finished before this plan is admitted. During authoring, server.rs still contains query_schema's single-variant assertion and PublicServer::call_tool still decodes ExecutorPatch directly; the parser already accepts directories. Do not add a query variant to that observed baseline. After phase 7 completes, re-locate QueryArguments, query_schema, list_tools, call_tool and resident request handling by symbol; read the resulting grouped request/response construction and predecessor tests, then extend the delivered design. Require successful phase 7 grouped-operation tests and its real-host schema-loading evidence. Task 1's new tests must prove the existing phase 7 operations survive. A missing prerequisite stops admission and names phase 7; it is not authorization to implement or guess its adaptation here.

Run Plan 1 before Plans 2-5. Exact-path overlap on import/mod.rs, config_service.rs, server.rs, tests and execution/store files supplies the parser's dependency edges; no invented depends_on frontmatter is used. The owner's ordered-split instruction overrides the planner skill's independent-only default. The broad third task is one atomic dispatch contract across persistence, replay, consumer and existing assertions: separating those changes would leave an admitted route unconsumed or unrecoverable.

All fixture material is embedded in the leased Rust targets or constructed under their temporary roots. Existing signing helpers and frozen references are read-only. Keep the old build_dispatch API available so its existing execution_store, phase7_lease and patch-module call sites need no gratuitous edits; an actually necessary unlisted source/fixture change requires a corrected lease before execution. Use existing dependencies; no manifest or lockfile change is planned.

The eleven corrected ACs are the phase requirements; GH-256 names the same effort-reset work, extended to model by D-45. Read-only config diagnostics explicitly state the invalid-active-config repair limitation; they must never present stale settings as valid. Scope excludes provider setup, new review delivery, general execution and rebuilding landed config mechanisms.
