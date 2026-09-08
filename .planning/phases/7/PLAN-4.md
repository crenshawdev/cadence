---
phase: 7
plan: 4
requirements:
  - AC7
  - AC8
  - AC9
  - AC10
  - GH-248
files:
  - crates/cadence/src/rail/risk.rs
  - crates/cadence/src/rail/receipts.rs
  - crates/cadence/src/rail/mod.rs
  - crates/cadence/tests/phase7_receipts.rs
  - crates/cadence/tests/phase7_risk.rs
  - crates/cadence/src/rail_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/mcp.rs
  - crates/cadence/src/rail/surfaces.rs
  - crates/cadence/tests/phase7_surfaces.rs
  - crates/cadence/src/pause/risk.rs
  - crates/cadence/src/pause_service.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/pause_service_tests.rs
  - crates/cadence/src/execution_service_tests.rs
  - crates/cadence/tests/phase7_live.rs
  - docs/architecture/boundary.md
  - docs/architecture/commit-rail.md
  - docs/architecture/source-leases.md
  - docs/architecture/risk-rail.md
  - docs/validation/phase-7-live.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P7-4-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_receipts"
    - id: P7-4-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_receipts"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P7-4-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces"
    - id: P7-4-T4
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service"
    - id: P7-4-T5
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_receipts"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service"
    - id: P7-4-T6
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= CADENCE_PHASE7_LIVE=all cargo test -p cadence --test phase7_live -- --ignored --nocapture"
        - "TMPDIR=/tmp npx tsc -p tsconfig.ci.json && TMPDIR=/tmp node --test"
        - "git diff --exit-code v3.7.12 -- cadence-core/"
---

# Phase 7: Risk settlement and structural evidence - Plan 4

## Goal

Risk status distinguishes detection, firing and settled consequence for the exact committed or staged material, and detect-surfaces supplies structural evidence for the user's choice. This plan alone proves GH-248 settlement and the completed phase's three-tool surface on a real host.

## Must be true when done

- AC10: Execution cannot continue or return Complete without current risk evidence and required settlement; a matched successful scan alone, or missing, unchecked, stale and unfired evidence, refuses continuation.
- AC8: A staged fire with head_id null settles by the exact base_id plus index_id; another index tree, base, scope or scan generation cannot settle it.
- AC10: Adjudication, one narrowed re-arm, gate_pass, reasoned override and deferral remain distinct receipt consequences; an override without a reason refuses.
- AC9: detect-surfaces uses names, extensions and manifest dependency names only; it reports evidenced, silent and unspeakable sets, warnings and all-eight recommendation without reading source bodies.
- AC9: Missing root refuses; unreadable child directories/manifests warn and retain the remaining structural evidence; evidence never silently chooses the user's surface set.
- D-38/D-44: Pause and execution-scoped status use the shared material/settlement rail, while provider dispatch stays deferred and the public tool count remains exactly three.
- AC1/AC2/AC10: The final real-host probe loads all three tools and the shipped native hook, including the deliberate guard-failure observations from PLAN-1.

## Context

D-40, D-41, D-43 and D-44 bind this plan. PLAN-3 supplies durable material observations and the shared classifier; pause::risk::Review::parse already matches staged Fire exactly. Extend the common rail rather than rebuilding index identity or importing the broken v3 head-required receipt join.

## Tasks

### Task 1: Define exact-material settlement (P7-4-T1)

- **Files:** `crates/cadence/src/rail/risk.rs`, `crates/cadence/src/rail/receipts.rs`, `crates/cadence/src/rail/mod.rs`, `crates/cadence/tests/phase7_receipts.rs`
- **Action:** Define strict receipt and status algebra over PLAN-3's recorded observations. Preserve detection, review firing and consequence as separate facts: a matched or inconclusive checked scan requires a fire and its matching outcome; a checked clear scan needs no fabricated review. Unchecked scans cannot settle, and no-range is explicitly skipped rather than clean. Match project/cycle/occurrence/phase/worker and signoff/run boundaries before material identity, and require every relevant fired record to be accounted for rather than letting one old receipt clear a later range. Use full resolved base/head identity for committed material and base/index identity for staged material, with head absent; exact equality includes the selected surfaces, fire and re-arm scope. A receipt cannot settle a stale scan after widened material or changed selected surfaces. Represent adjudication, re-arm, gate_pass, override and deferral distinctly: re-arm names its original fire and narrowed material and is allowed once, but does not pass the new review; override needs a nonblank reason and occurrence/material scope; a deferral preserves pending work according to the recorded consequence rather than claiming a review passed. Accept contracted receipt facts, not reviewer prose as an automatic verdict. Reviewer dispatch and adjudication logic remain phase 9.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_receipts` — proves matched-only, missing, unfired, unchecked, stale, wrong-run, pre-signoff and widened-range refusals; exact committed and staged settlement; reasonless override refusal; and one-re-arm exhaustion. A head_id=null staged record settles with its base/index pair and refuses a receipt for different staged bytes. Independently encoded receipt inputs, not production serialization round trips alone, define the expected statuses.

### Task 2: Persist receipt consequences through the existing tools (P7-4-T2)

- **Files:** `crates/cadence/src/rail_service.rs`, `crates/cadence/src/rail/receipts.rs`, `crates/cadence/src/server.rs` (QueryArguments / query_schema / PublicServer::call_tool / list_tools), `crates/cadence/src/recall/mod.rs` (resident::Request / Resident::spawn_with_driver), `crates/cadence/src/store/writer.rs` (Operation / persist), `crates/cadence/src/store/transaction.rs` (Intent::validate), `crates/cadence/tests/phase7_receipts.rs`, `crates/cadence/tests/mcp.rs`
- **Action:** Expose risk status as an operation within cadence_query and strict fire/consequence submissions within cadence_apply. Have the resident service validate Task 1's contract against current durable observations and scoped execution/evidence boundaries before a conditional rail mutation. Bind receipts to actual stored observations; unknown fire IDs, caller-invented material and scope changes refuse. Record a single durable outcome with confirmation/replay identity, preserve the independent scan result and retain the public response's confirmation evidence. Prepare the writer and recovery path for Task 5: narrowly permit validated task evidence to persist with a risk-pending continuation refusal and no terminal completion, then conditionally finalize only against current settled evidence. Other refusal invariants remain unchanged; a receipt submission itself does not complete execution. A persistence failure may report that detection had succeeded but cannot return settled success or claim trace.written. Keep prior store/intent formats readable, scope recovery to admitted participants and preserve execution/SUMMARY on receipt refusals. Do not ingest executor return-bracket prose as new native authority; native dispatch/outcome identities supply those boundaries, while historical evidence lacking material identity stays explicitly insufficient for a new native settlement. This task closes the public record-to-status path by its second task.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_receipts`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — records a scan, queries unfired status, submits the exact contracted fire/outcome, restarts the real stdio server and queries settled status. A second staged tree and a second committed base remain unsettled. Duplicate receipts replay without log growth; changed content under the same identity conflicts. Kill/recovery preserves pending task evidence without installing Complete, and changed evidence refuses conditional finalization. Injected confirmation failure cannot mint settled success; malformed operations remain typed non-successes inside the three-tool boundary.

### Task 3: Detect surfaces from project structure (P7-4-T3)

- **Files:** `crates/cadence/src/rail/surfaces.rs`, `crates/cadence/src/rail/mod.rs`, `crates/cadence/tests/phase7_surfaces.rs`
- **Action:** Port detect-surfaces and scanTree's structural evidence, keeping it distinct from scanDiff and scanDeclared. List the project root and each immediate non-skipped child directory only; collect directory/file basenames, extensions and dependency names from package.json, Cargo.toml, pyproject.toml, go.mod and requirements.txt. Preserve the frozen skip-directory set and conservative manifest extraction, including PEP 621 dependency arrays with extras and dependency tables, without treating package metadata or source keywords as dependencies. Missing or unlistable root refuses; unreadable child directories and unreadable/unparseable manifests add named warnings and keep the rest of the scan. Never read any non-manifest file body or descend through a directory symlink into another tree. Retain the structural signal tables and exact/scoped-last-segment dependency matching, with no substring keyword inference. Report evidenced signals, silent categories and unspeakable categories derived from table coverage; unspeakable is a subset of silent, as scanTree actually returns, not a disjoint third partition. Always recommend all eight. Build the deduplicated at-most-four interview choices from evidence and an optional already-answered set; never save a narrower config answer on the basis of the scan alone.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces` — uses real filesystem fixtures for each manifest family and the two-level walk, plus an I/O observer that fails if any source body is opened. Changing every source body leaves the answer unchanged; changing dependency names or structure changes only supported evidence. Missing root refuses, denied child/manifest reads warn without failing, skipped/deep/symlink trees are not scanned, destructive remains unspeakable, all eight remain recommended and interview option sets are unique.

### Task 4: Expose structural evidence to the one-time choice (P7-4-T4)

- **Files:** `crates/cadence/src/rail_service.rs`, `crates/cadence/src/server.rs` (QueryArguments / query_schema / PublicServer::call_tool), `crates/cadence/src/pause/risk.rs` (surfaces_question), `crates/cadence/src/pause_service.rs` (configured_surfaces / surfaces_from_answer / risk_gate), `crates/cadence/tests/phase7_surfaces.rs`, `crates/cadence/tests/mcp.rs`
- **Action:** Add detect-surfaces within cadence_query, bound to the server's project root and with optional validated already-answered categories; tool arguments cannot choose an arbitrary filesystem root. Return Task 3's evidence, warnings, recommendation and prepared options directly. Make pause's existing unanswered-surfaces question consume the same structural evidence and retain its current explicit-answer config write and repeat-against-new-generation behavior. No source-body read, silent policy update or additional reconfiguration workflow is authorized. Detect-surfaces does not require a successful risk diff or answered config to provide evidence; its missing-root/read warnings are its own domain results. Keep every input schema loadable by the host as variants are added and preserve strict per-operation validators.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service` — calls the real public operation, validates the returned partitions/options and proves source-body changes cannot affect it. The operation changes neither config nor scan/receipt state. Pause asks with the same evidence, only an explicit answer writes surfaces, and an invalid answered set refuses instead of silently narrowing it. Three tools still advertise object roots and no top-level input unions.

### Task 5: Gate execution continuation through shared settlement (P7-4-T5)

- **Files:** `crates/cadence/src/pause/risk.rs` (Fire / Review::parse), `crates/cadence/src/pause_service.rs` (risk_gate / override_review / prior_blocking), `crates/cadence/src/execution_service.rs` (apply / query), `crates/cadence/src/rail_service.rs`, `crates/cadence/tests/phase7_receipts.rs`, `crates/cadence/src/pause_service_tests.rs`, `crates/cadence/src/execution_service_tests.rs`
- **Action:** Make pause's contracted review adapter and execution continuation consume the same exact material-identity and settlement predicates. Preserve pause's established review format, authored-material exclusions, questions, override meaning and one narrowed re-arm through explicit conversion. Gate apply's NextPlan/Complete and execute-next's dispatch/completion paths on current risk evidence for all relevant completed material from PLAN-3's execution adapter, including terminal/replay shortcuts. Missing, unchecked, stale, unfired or unsettled required evidence returns a durable refused envelope naming the pending scope; a matched scan alone cannot pass. Use Task 2's writer path to retain validated task evidence for assessment while withholding terminal completion; state that task evidence was accepted but continuation was refused, so missing accepted material cannot deadlock the scan. The unchanged cad-execute loop displays the refusal and stops. After an exact scan and any required fire/consequence settle, a fresh execute-next reevaluates current evidence and may continue or complete without rerunning tasks or rewriting immutable patch receipts. Checked-clear and explicit no-range/skipped evidence follow Task 1; reject foreign dispatch, cycle or signoff evidence and revalidate settlement before finalization. Keep fixed executor dispatch and disabled provider dispatch unchanged; no reviewer adjudication or pre-commit executor API enters this gate. Do not retain a second head-required or SHA-prefix settlement path.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_receipts`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service` — drives the cad-execute query -> fixed executor -> unchanged patch apply sequence with signed fixture commits: a completion attempt without risk evidence is refused, task evidence remains scannable and no terminal Complete is installed. A matched scan without settlement, stale/wrong-scope receipts and restart/query/replay attempts still refuse; exact settlement permits fresh execute-next to complete without rerunning tasks. A multi-plan fixture cannot dispatch the next plan while prior risk is pending. Checked-clear/no-range cases and existing pause staged-clear/override cases retain their distinct meanings; changed authored index refuses. Task 6 must prove the loaded skill stops on the same gate; direct status-operation assertions alone do not discharge this verification.

### Task 6: Prove the complete phase on a real host (P7-4-T6)

- **Files:** `crates/cadence/tests/phase7_live.rs`, `crates/cadence/tests/mcp.rs` (Client / tool_schemas), `docs/architecture/boundary.md` (Two host constraints the schemas must satisfy / What is proven, and what is not), `docs/architecture/commit-rail.md`, `docs/architecture/source-leases.md`, `docs/architecture/risk-rail.md`, `docs/validation/phase-7-live.md`
- **Action:** Extend PLAN-1's actual-host probe to the final public schemas and rail operations. Load the built server directly as cadence serve --project-root for the disposable fixture, with the final native hook registration. Parse the host's own system init tool list and require exactly the three Cadence names to be present; a raw tools/list handshake alone is insufficient. Load the installed cad-execute skill and fixed cad-executor with their existing tool allowlists. Invoke the skill on a fixture plan with answered risk surfaces and signed task changes that match the detector; observe its real executor patch attempt completion without risk evidence: the binary refuses continuation and the skill displays the reason and stops. Record a matching risk scan through the existing tool and invoke the skill again; matched risk without settlement still refuses. Supply the exact contracted fire/consequence, restart the server and invoke the skill again to prove completion without another executor run. Also exercise structural evidence, HEAD..HEAD, staged scan with null head, unmatched then matched settlement, and refusal of changed staged bytes. The review receipt is a fixture fact, not evidence of model review quality or phase-9 adjudication. Repeat PLAN-1's protected deny, unreadable-Git fail-open, torn-config ask and retained hard-fail denial against the final binary. Record versions, tool/hook and skill events, material/decision IDs, process replacement and mechanical outcomes in the validation document without raw prompts, source prose, credentials or session URLs. Document the public operations and limits, zero lease exemptions, recovery disposition and exact shared identity. Keep AC mappings separate from evidence that a reviewer ran. Execute the final Rust and frozen Node checks with the environment required in Notes.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= CADENCE_PHASE7_LIVE=all cargo test -p cadence --test phase7_live -- --ignored --nocapture`; `TMPDIR=/tmp npx tsc -p tsconfig.ci.json && TMPDIR=/tmp node --test`; `git diff --exit-code v3.7.12 -- cadence-core/` — fails if the loaded cad-execute skill's completion attempt is not refused before settlement, if a matched scan alone permits completion, or if exact settlement cannot permit completion after restart without rerunning tasks. Require the skill's actual query/apply events, stop and absent terminal Complete; a probe calling risk status directly is insufficient. Missing host tools, simulated-only hook input, unrecorded deliberate failures or absent AC8/AC10 identity checks also fail. Host credentials, signing, skill loading, hook access and interactive ask evidence cannot be skipped-as-pass. The frontmatter Rust tests, clippy and format, frozen TypeScript/Node checks and frozen-tree comparison also pass.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-40 / AC9 | P7-4-T3, P7-4-T4 |
| D-41 / AC10 | P7-4-T1, P7-4-T2, P7-4-T5 |
| D-43 / GH-248 / AC8 | P7-4-T1, P7-4-T2, P7-4-T5 |
| D-38 | P7-4-T5 |
| D-44 / AC10 (tool boundary) | P7-4-T2, P7-4-T4, P7-4-T6 |
| AC7 / AC8 (live integration) | P7-4-T6 |

## Notes

Run after PLAN-3; the shared service, resident, store, pause and test files require that order. The owner's instruction overrides the default independent-plan rule. Every file in this plan is an exact files lease, including new test targets and validation documents; no dependencies are added. Fixture assets are embedded in these files or created under /tmp.

The live harness uses the real command established in PLAN-1, with fixture-specific settings/MCP paths and a prompt requesting the final rail probes. It launches the production binary directly, uses ordinary host permission mode and reads the host's own tool list. It must exit nonzero with BLOCKED if host/model access or required observations are unavailable. Run any human-verify interactive ask portion using the same isolated settings and MCP command without -p, record the actual prompt and withheld shell action as structured facts, then rerun the mechanical evidence check. No unit, ignored-test count or copied phase-6 UAT can close the live obligations. command -v established claude, cargo, rustc, node, python3, Git, ssh-keygen, gpg and strace here; runtime authentication and tracing permission still require actual results.

The structural scan's silent and unspeakable lists overlap in the frozen producer; destructive is currently in both. Preserve that exact meaning instead of turning the word partitions into an invented absence claim. Recommendation is always all eight and narrowing belongs to the explicit user choice.

Across the four plans every AC1-AC10 and D-30 through D-44 has an implementing task; GH-229 is PLAN-3 Task 4 and GH-248 is this plan's exact staged settlement. No fourth MCP tool, executor pre-commit round trip, task-commit service, routing subsystem, provider dispatcher or new general execution workflow is included.
