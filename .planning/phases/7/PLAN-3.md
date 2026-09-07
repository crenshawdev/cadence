---
phase: 7
plan: 3
requirements:
  - AC7
  - AC8
  - AC10
  - GH-229
files:
  - crates/cadence/src/rail/mod.rs
  - crates/cadence/src/rail/risk.rs
  - crates/cadence/src/rail/risk_diff.rs
  - crates/cadence/src/pause/risk.rs
  - crates/cadence/src/pause/risk_diff.rs
  - crates/cadence/src/pause_service.rs
  - crates/cadence/tests/phase7_risk.rs
  - crates/cadence/src/rail/git.rs
  - crates/cadence/src/rail_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/mcp.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/pause/git.rs
  - crates/cadence/src/execution_service_tests.rs
  - crates/cadence/src/pause_service_tests.rs
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P7-3-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib pause::"
    - id: P7-3-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P7-3-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk"
    - id: P7-3-T4
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk"
    - id: P7-3-T5
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service"
---

# Phase 7: The shared diff classifier - Plan 3

## Goal

A native risk-check records deterministic evidence over an immutable committed or staged diff, using the same classifier as pause. This plan alone proves all eight categories and the GH-229 no-range distinction through the public boundary.

## Must be true when done

- AC7: Auth, migrations, billing, concurrency, destructive, secrets, api_contract and untrusted_input are classified from changed paths and added/removed lines using the existing signal tables.
- AC7: A readable empty diff is checked-and-empty; binary, submodule and unreadable material is inconclusive; failed observation cannot report clean.
- AC7: Effective configured surfaces or an explicit per-run selection control the scan; invalid scope, conflicting committed/staged selection, invalid categories or torn config refuse.
- AC8: Equal resolved commit endpoints return no-range and never persist a completed clean scan; a real commit range filtered to no material remains checked-and-empty.
- AC8: Committed observations retain resolved base/head identity; staged observations retain base/index identity with null head and diff those captured immutable objects.
- D-38/D-44: Pause and the execution range consumer use the shared rail, exposed as operations within the same three tools; detection success is not a review-pass receipt.

## Context

D-38, D-39, D-42 and D-44 bind this plan. pause::risk_diff::scan already implements most detector logic; pause::git::staged and Fire are staged, pause-specific adapters. Generalize those primitives and preserve pause's provenance-based receipt filtering at its own call site. Frozen risk-check and risk-diff are semantic references, not runtime dependencies.

## Tasks

### Task 1: Extract the shared risk primitives (P7-3-T1)

- **Files:** `crates/cadence/src/rail/mod.rs`, `crates/cadence/src/rail/risk.rs`, `crates/cadence/src/rail/risk_diff.rs`, `crates/cadence/src/pause/risk.rs` (CATEGORIES / Fire / validate_surfaces), `crates/cadence/src/pause/risk_diff.rs` (scan / signal / changed_lines), `crates/cadence/src/pause_service.rs` (configured_surfaces / risk_gate), `crates/cadence/tests/phase7_risk.rs`
- **Action:** Lift the eight-category vocabulary, deterministic detector and shared surface-selection validation into the rail created by PLAN-1. Move the implementation rather than copy it; keep pause's current module paths as compatibility re-exports or small adapters where existing consumers need them. Extract immutable material-identity primitives from Fire without widening its Wip/ResumeRecord commit-kind enum into a workflow dispatcher. Keep pause question construction, review interpretation and authored-receipt exclusion as pause orchestration. Preserve historical pause record bytes and exact Review::parse matching through explicit conversion; no serializing default may alter an old fire digest. The risk detector remains a pure classifier and never reads source trees, dispatches reviewers or filters harmless-looking secrets by model judgment. Use existing dependencies.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib pause::` — runs the shared classifier through the new target and the existing pause regressions, including staged identity, exact review matching, receipt-only changes and one narrowed re-arm. Independently encoded prior pause fires remain readable and match their historical contract; only one active detector implementation remains.

### Task 2: Expose a recorded risk-check spine (P7-3-T2)

- **Files:** `crates/cadence/src/rail/mod.rs`, `crates/cadence/src/rail/risk.rs`, `crates/cadence/src/rail/git.rs`, `crates/cadence/src/rail_service.rs`, `crates/cadence/src/server.rs` (QueryArguments / query_schema / PublicServer::call_tool / list_tools), `crates/cadence/src/recall/mod.rs` (resident::Request / Resident::spawn_with_driver), `crates/cadence/src/store/writer.rs` (Operation / CompareTransact / persist), `crates/cadence/src/store/transaction.rs` (IntentKind / Intent::validate), `crates/cadence/tests/phase7_risk.rs`, `crates/cadence/tests/mcp.rs`
- **Action:** Build a working real-repository scan through the public boundary in this task: a strict operation in cadence_apply resolves a committed range, calls the shared detector and confirms its observation before returning. Recording is an apply operation because it writes evidence. Add rail requests to the existing resident and a small rail service; do not call the resident recursively. Keep the existing kind: executor patch wire object accepted exactly as before and derive any added tagged-operation schemas from their deserialized types. Extend query_schema beyond its current one-operation assertion with a host-loadable object/properties input description while retaining strict internal per-variant validation. Persist compact versioned rail observations under a separately owned snapshot namespace through the common conditional writer, preserving execution, evidence, import, pause and SUMMARY. Record scan/decision evidence and confirmation identity together; successful classification and successful persistence remain distinct facts. No generic caller-supplied snapshot or output path is admitted. Scope records by the existing project/cycle/occurrence/phase/worker boundaries and retain endpoint provenance. Keep the tools/list count exactly three, every schema root object-shaped and every input free of top-level union keywords. This is the second task's runnable public-to-store path; later tasks deepen its material cases.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — drives a real temporary Git range through raw stdio and reopens the store to find the exact observed identity and classifier result. A matched scan returns successful detection without a passing-review receipt. Lost replies replay one observation; persistence faults cannot return recorded success. All three tools remain listed with host-compatible input/output roots and the old executor-patch tests pass.

### Task 3: Classify real changed material (P7-3-T3)

- **Files:** `crates/cadence/src/rail/git.rs`, `crates/cadence/src/rail/risk_diff.rs`, `crates/cadence/src/rail_service.rs`, `crates/cadence/tests/phase7_risk.rs`
- **Action:** Complete deterministic changed-material acquisition and classification. Validate phase/worker scope and exclusive committed-versus-staged selection; resolve each supplied commit ref independently and retain whichever endpoint resolved on failure. For staged input capture write-tree once, then diff the immutable tree against the resolved base; never label a later live index diff with an earlier tree ID. Run Git through argv with external diff and textconv disabled. Retain exactly the four reviewer-text exclusions from REVIEWER_TEXT_PATHSPECS: phase ADJUDICATION-*.json, REVIEW-*.md, FINDINGS.json and verifier-findings.json. Do not exclude PLANs, general planning prose, reports, arbitrary docs or lockfiles. Parse paths without losing quoted/escaped bytes or rename endpoints, and added/removed hunk lines without treating unchanged context as changed content. Carry the existing signal tables and ordering for all eight categories. Binary, gitlink/submodule, undecodable and unreadable sections are inconclusive; an unavailable diff is unchecked/inconclusive, not clean. Effective review.triggers.risk_surface.surfaces must be answered unless the caller supplies a valid explicit per-run list; torn config refuses even with that list. Explicit per-run selection does not write project policy. A scan reaching diff acquisition records its success or failure observation, while invalid scope/config never fabricates a completed scan.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk` — uses real Git diffs with positive changed-path and changed-line cases across all eight categories, removed-line positives, unchanged-context negatives, Unicode/space/tab paths, binaries and gitlinks. A configured external diff/textconv helper leaves a sentinel absent. PLAN text is scanned and each of the four precise reviewer paths is excluded. Failed Git/diff reads persist unchecked observations; invalid or unanswered category selection and torn config refuse without a clean receipt.

### Task 4: Distinguish no range from an empty filtered diff (P7-3-T4)

- **Files:** `crates/cadence/src/rail/git.rs`, `crates/cadence/src/rail/risk.rs`, `crates/cadence/src/rail_service.rs`, `crates/cadence/tests/phase7_risk.rs`
- **Action:** Close GH-229 at the native material-resolution seam: equal resolved commit endpoints, including different ref spellings for the same commit, produce a distinct no-range result with resolved identity and a skipped/no-range observation, never a completed clean detection. Preserve independently resolved endpoints on invalid refs. A genuine nonempty commit range whose only paths match the four exclusions still produces a checked-and-empty scan. An empty readable staged diff is also checked-and-empty, not no-range merely because its tree equals the base tree. Persist committed versus staged identity structurally: committed uses full base/head IDs; staged uses full base/index IDs with head absent. Do not create another fingerprint from mutable index metadata, and do not reintroduce ref-prefix comparison into this identity.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk` — compares HEAD..HEAD, two refs resolving to HEAD, a real excluded-only commit range, an empty staged tree and an ordinary empty readable diff. Only the first two are no-range and neither writes a completed-clean record. Staging different bytes changes index identity; moving a ref after resolution cannot change the already-measured material.

### Task 5: Connect existing execution material to the shared rail (P7-3-T5)

- **Files:** `crates/cadence/src/execution_service.rs` (apply / validate_commits_blocking), `crates/cadence/src/rail_service.rs`, `crates/cadence/src/rail/git.rs`, `crates/cadence/src/pause/git.rs` (staged / authored_index_id / commit_guarded), `crates/cadence/src/pause_service.rs` (risk_gate), `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/src/pause_service_tests.rs`, `crates/cadence/tests/phase7_risk.rs`
- **Action:** Provide the native risk-check operation with an execution-scoped material source obtained through the execution service: use the durable dispatch base and accepted completed task commits for the specified plan/occurrence, rather than caller-written report prose or a freshly guessed HEAD. Execute that assessment through the shared rail and store it under that exact execution scope. Retain an explicit range/staged source for other consumers; do not claim sixteen workflows are already wired. Pause calls the same immutable material and classifier primitives but retains its provenance-derived authored tree so its own binary receipts do not recursively fire risk. Preserve commit_guarded's branch, HEAD, index, unstaged and resulting tree/parent checks. Do not add an executor pre-commit round trip or task-commit ownership to Cadence. The execution-scoped operation is an explicit completed-range assessment; this phase does not change fixed reviews: disabled into automatic provider dispatch. A lease-accepted patch is execution evidence, not a risk pass; risk status is the separate continuation evidence supplied by PLAN-4.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service` — completes a real signed fixture execution then scans its recorded base/task range through the public operation, proving changing report text cannot change material. A foreign occurrence/plan or missing accepted material refuses. Pause's existing receipt exclusion and guarded-commit races remain covered, and both consumers exercise the one classifier.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-38 | P7-3-T1, P7-3-T5 |
| D-39 / AC7 | P7-3-T2, P7-3-T3 |
| D-42 / GH-229 / AC8 | P7-3-T4 |
| D-44 / AC10 (tool boundary) | P7-3-T2 |
| D-41 (detection distinction) | P7-3-T2, P7-3-T5 |

## Notes

Run after PLAN-2 and before PLAN-4. Shared execution_service, store, server, resident, rail and test paths prohibit parallel execution. The owner explicitly requested ordered plans; no depends_on frontmatter is introduced. These plans are intentionally files-only so today's parser can admit the whole phase before directories is implemented.

A persisted observation records that the detector ran, what immutable objects it read, which surfaces it used and whether persistence was confirmed. It does not assert reviewer firing, settlement or permission to continue. PLAN-4 adds the consumer of those facts. Reviewer provider dispatch/adjudication and full execution workflow behavior stay outside this phase.

Keep the shared domain synchronous and separate from resident/filesystem adapters. The record and public wiring task spans multiple files because one observation must be confirmed from request to response by the second task. Use the existing serde, schemars, hashing and regex dependencies; test assets live in the leased targets and external temporary repositories, not an undeclared fixture directory.

The four exclusions are exact pathspec shapes from cadence-core/bin/planning/risk-check.mjs:96-100; they are risk-material exclusions, never lease exemptions. The GH-229 references in the CONTEXT identify the real gap: independently resolved equal endpoints reach scanDiff's empty-body success. The native fix deliberately preserves the different excluded-only and staged-empty cases.
