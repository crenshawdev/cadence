---
phase: 9
plan: 6
requirements:
  - AC1
  - AC2
  - AC148
  - AC149
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/review/mod.rs
  - crates/cadence/src/review_service.rs
  - crates/cadence/src/review_service_tests.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/next_action/observations.rs
  - crates/cadence/src/next_action_service.rs
  - crates/cadence/src/review/forward.rs
  - crates/cadence/tests/phase9_forward.rs
  - docs/architecture/review-operations.md
  - agents/cad-reviewer.md
  - agents/cad-reviewer-low.md
  - agents/cad-reviewer-medium.md
  - agents/cad-reviewer-xhigh.md
  - agents/cad-reviewer-max.md
  - crates/cadence/src/review/invoking.rs
  - crates/cadence/tests/phase9_invoking.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/main.rs
  - crates/cadence/src/review_hook.rs
  - hooks/hooks.json
  - skills/cad-review-delivery/SKILL.md
  - skills/cad-reviewer-contract/SKILL.md
  - skills/cad-plan/SKILL.md
  - skills/cad-plan-review/SKILL.md
  - skills/cad-execute/SKILL.md
  - skills/cad-task/SKILL.md
  - skills/cad-debug/SKILL.md
  - skills/cad-verify/SKILL.md
  - skills/cad-report/SKILL.md
  - skills/cad-land/SKILL.md
  - skills/cad-milestone/SKILL.md
  - skills/cad-minimalism-review/SKILL.md
  - skills/cad-decision-review/SKILL.md
  - crates/cadence/src/pause_service.rs
  - crates/cadence/src/pause/risk.rs
  - crates/cadence/src/phase9_pause_tests.rs
  - crates/cadence/src/review/history.rs
  - crates/cadence/tests/phase9_history.rs
  - crates/cadence/tests/fixtures/phase9/historical-pause.json
  - docs/architecture/review-history.md
---

# Phase 9: Callable delivery, invoking adapters and pause origin - Plan 6

## Goal

Mount the completed review modules, expose native operations through the existing grouped tools, ship the read-only WAIT contract, and adapt modern pause deliveries while retaining historical origin.

## Must be true when done

- Register native review operations and unchanged forwarding: the independent criteria mapped to P9-6-T1 return their literal specified values.
- Ship the retained-target WAIT contract and local invocation: the independent criteria mapped to P9-6-T2 return their literal specified values.
- Route modern pause through the ordinary delivery shape: the independent criteria mapped to P9-6-T3 return their literal specified values.
- Expose historical pause origin without promotion: the independent criteria mapped to P9-6-T4 return their literal specified values.

## Context

D-57, D-58 and D-62–D-65 require a callable local delivery surface. Plans 1–5 supply its implemented units. This final plan owns every shared registration and caller file so no predecessor needs an overlapping lease.

## Tasks

### Task 1: Register native review operations and unchanged forwarding (P9-6-T1)

- **Files:** `crates/cadence/src/lib.rs`, `crates/cadence/src/review/mod.rs`, `crates/cadence/src/review_service.rs`, `crates/cadence/src/review_service_tests.rs`, `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`, `crates/cadence/src/import/mod.rs`, `crates/cadence/src/next_action/observations.rs`, `crates/cadence/src/next_action_service.rs`, `crates/cadence/src/review/forward.rs`, `crates/cadence/tests/phase9_forward.rs`, `docs/architecture/review-operations.md`
- **Action:** Create review/mod.rs declaring all Plan 1–5 modules and forward, and register review once in lib.rs. Tasks 2 and 4 add their own invoking/history declarations when those implementations exist. Add server module declarations for review_service and its child test file. Complete each task's registration before its Verify; do not leave declarations pointing at absent files. Add resident requests and service dispatch using the phase-7/8 grouped query/apply union that actually landed; extend its input/output schemas and malformed-operation routing without introducing another public tool or decoding review returns as ExecutorPatch.

  Expose these concrete operations: query review-next, review-admission, review-material, review-original, review-attempt, review-roster, review-inventory, review-deferred and review-consumer; apply review-admit, review-observation, review-return, review-material-append and review-enqueue. review-admit supports ordinary and specialist input variants and uses Plan 4's composable admission, home allocation and saved phase-8 routing values. review-next uses the saved roster and Plan 3 selection and never treats an uncertain attempt as a new dispatch. review-return consumes Plan 1 bounded bytes and Plan 4 durable acceptance; delivery completion and deferred continuation are decided by the existing new units. Query operations preserve raw/provisional/settled type tags and all H1–H4 joins. Document exact operation arguments, typed results and the native admission/observation/return/material/enumeration commands in review-operations.md, with the Plan 1–5 task-specific cargo check commands. No producer transcript is generated.

  Implement forward_return in forward.rs as unchanged byte transport into a raw-return request; wire it into the operation boundary without parse/reserialize or coordinator distillation. Add direct forward_ tests in phase9_forward.rs. Service tests are private unit tests in review_service_tests.rs, registered by server.rs; any additional checks call a single new decoder/request builder with supplied values and literal results, not PublicServer through a spawned MCP client. Mount Plan 5 all-home enumeration in next-action's acquisition path and public inventory query, preserving modern entries regardless of rendering/sibling absence; legacy filtering remains a separate historical adapter until phase 10. Keep errors/unknowns visible. Add only necessary Session access for saved review reads and conditional writes in import/mod.rs; retain admission's current-config validation but never recompute saved policy on a read. No existing neighboring test file is leased or run.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_forward forward_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC2: Given raw bytes `{"findings":[]}`, `forward_return` returns `submitted_bytes = "{\"findings\":[]}"`. Boundaries: none.

### Task 2: Ship the retained-target WAIT contract and local invocation (P9-6-T2)

- **Files:** `crates/cadence/src/review/mod.rs`, `crates/cadence/src/review_service.rs`, `crates/cadence/src/server.rs`, `agents/cad-reviewer.md`, `agents/cad-reviewer-low.md`, `agents/cad-reviewer-medium.md`, `agents/cad-reviewer-xhigh.md`, `agents/cad-reviewer-max.md`, `crates/cadence/src/review/invoking.rs`, `crates/cadence/tests/phase9_invoking.rs`, `crates/cadence/src/execution_service.rs`, `crates/cadence/src/main.rs`, `crates/cadence/src/review_hook.rs`, `hooks/hooks.json`, `skills/cad-review-delivery/SKILL.md`, `skills/cad-reviewer-contract/SKILL.md`, `skills/cad-plan/SKILL.md`, `skills/cad-plan-review/SKILL.md`, `skills/cad-execute/SKILL.md`, `skills/cad-task/SKILL.md`, `skills/cad-debug/SKILL.md`, `skills/cad-verify/SKILL.md`, `skills/cad-report/SKILL.md`, `skills/cad-land/SKILL.md`, `skills/cad-milestone/SKILL.md`, `skills/cad-minimalism-review/SKILL.md`, `skills/cad-decision-review/SKILL.md`
- **Action:** Implement advisory_contract in invoking.rs with the exact criterion string for retained m1/advisory, register invoking in review/mod.rs and connect its prompt builder in review_service.rs. Build the local dispatch instructions from saved attempt/agent/model/routing and retained view references; inherit the session model when the admitted model is absent. Preserve specialist prompt intent, with minimalism's one base reviewer. The host bridge binds actual launch/return identifiers to the issued attempt and submits bounded observations via review-observation; unreported model/usage stays unknown and supplied voice labels never manufacture origin.

  Add cad-review-delivery as the thin shared invoking contract and update the leased live skills only at review/consumer boundaries. Manual/automatic plan, execution, task, debug and verify use the shared ordinary request constructors; minimalism/decision/diagnosis use retained specialist targets. Wait for the local return, forward exact bytes via review-return, and wait for durable acknowledgment before completion, commit preparation or next-plan dispatch. Do not freshly resolve routing after admission, fan out FIRST choices or write findings/lifecycle artifacts from a skill. Consumers request Plan 5 typed inputs instead of reconstructing joins from filenames. Keep each workflow's remaining behavior with its later owner, including diagnosis fix selection and explicit landing authorization. Add review-aware service entry helpers in execution_service.rs and wire the outer grouped response in server.rs/review_service.rs. Before exposing next-plan, complete or a new executor dispatch, consult pending delivery and deferred enqueue state, including replay responses. Return the grouped review response while delivery is owed; after durable acknowledgment expose the existing execution response. Keep ExecutionEnvelope, ExecutorPatch, ActiveDispatch and their canonical receipt bytes unchanged: the new grouped review branch wraps the service handoff instead of adding execution-model variants. Consume Plan 3 policy and the admitted review response, without altering the execution/store implementations or their tests.

  Remove the reviewer contract's Bash heredoc/trace-append tail and its advisory write exception. Reviewers read the retained target through the binary material query, return the bounded five-field JSON and do not write artifacts. Update all five leased reviewer agent tool lists to permit cadence_query for retained-material reads; retain their existing effort, contract preload and write/edit restrictions. Do not grant cadence_apply to reviewers; the invoking adapter submits observations and returns. Add the grouped query/apply tools to each invoking/consumer skill that now needs them. Make the live contract take precedence over the frozen workflow descriptions without editing cadence-core. Add a native SubagentStop adapter in review_hook.rs and register its silent hook command in main.rs/hooks.json: native-bound stops submit observations through the binary and cannot perform a legacy lifecycle close; retain the existing frozen handler only for positively identified legacy work, with the legacy subprocess boundary explicit. Unknown attribution cannot attach a stop to another attempt. Hook observations never imply delivery of missing raw text. This is production adapter work, not an installed-host exercise or a shell-write prohibition. Direct advisory_ tests call advisory_contract on literal inputs; do not assert over a model transcript or source-text grep.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_invoking advisory_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC1: Given retained target `m1` and advisory mode, `advisory_contract` returns `"Review retained target m1. Return raw JSON findings. Do not write files or append lifecycle records."`. Boundaries: none.

### Task 3: Route modern pause through the ordinary delivery shape (P9-6-T3)

- **Files:** `crates/cadence/src/pause_service.rs`, `crates/cadence/src/pause/risk.rs`, `crates/cadence/src/phase9_pause_tests.rs`, `crates/cadence/src/server.rs`
- **Action:** Implement pause_delivery_request in pause_service.rs using binary-issued f1/a1 and the ordinary five-field finding contract. Add the necessary modern branch in pause/risk.rs without coercing failure_scenario into fix. New pause admissions use the shared occurrence, retained staged identity, dispatch/observation and immutable-result paths. The modern request carries exactly file, line, severity, claim and failure_scenario; return shape alone never manufactures observed dispatch or verified settlement. Preserve old pause input decoding as a historical branch. Phase 10 D-70 still owns the mandatory settlement-clearance cutover; do not broaden the legacy raw-result clearance to modern reviews.

  Register phase9_pause_tests.rs as a child test module of pause_service.rs using an explicit sibling-file path. A child can call the private pause_delivery_request directly; server.rs retains the pause_service registration and any necessary modern response-schema wiring. No visibility is widened for tests. Construct modern f1/a1 and F directly and call pause_delivery_request. No pause/resume/Git/evidence workflow, old pause_service_tests regression target or manual live probe is part of Verify.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence phase9_pause_tests::modern_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC148: Given modern pause `f1/a1`, ordinary finding F, `pause_delivery_request` returns `{"fire":"f1", "attempt":"a1", "fields":["file", "line", "severity", "claim", "failure_scenario"]}`. Boundaries: none.

### Task 4: Expose historical pause origin without promotion (P9-6-T4)

- **Files:** `crates/cadence/src/review/mod.rs`, `crates/cadence/src/review_service.rs`, `crates/cadence/src/review/history.rs`, `crates/cadence/tests/phase9_history.rs`, `crates/cadence/tests/fixtures/phase9/historical-pause.json`, `docs/architecture/review-history.md`
- **Action:** Implement read_pause_origin over saved historical bytes and register history in review/mod.rs. A fix-shaped finding without a dispatch is historical with dispatch null and verified false; keep the old bytes and prohibit rewrites. Unknown/older schema records remain readable with an explicit unverified diagnostic and a new-review/recovery path, not an inferred modern voice or accepted obligation. Expose this reader through the review-consumer/original service branch created in Task 1. Hand-author historical-pause.json as the old input and add the direct history_ test with filesystem old-byte input and forbidden writes. Document the historical/modern distinction and phase-10 recovery/settlement ownership in review-history.md. Do not backfill host observations or amend the phase-9 compatibility fixtures to make historical bytes appear newly validated.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_history history_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC149: Given saved old finding with `fix:"S"` and no dispatch, `read_pause_origin` returns `{"provenance":"historical", "dispatch":null, "verified":false}`. Boundaries: filesystem: old bytes, forbid rewrite.

## Requirements mapping

| Requirement | Implementing task |
|---|---|
| AC2 | P9-6-T1 |
| AC1 | P9-6-T2 |
| AC148 | P9-6-T3 |
| AC149 | P9-6-T4 |

## Notes

Run last, after Plans 1–5. Phase 8 must be finished before execution; re-locate the landed grouped query/apply schemas, Resident and Session symbols by name. This plan owns all library/server/resident/next-action/pause/skill/hook registrations; predecessor files remain read-only. The broad Task 1 and Task 2 are production integration of already-tested units, not new acceptance workflows. Register new modules as their owning task implements them, so each task compiles without requiring a future source file. Local tests demonstrate only each stated unit result. All MANUAL.md items remain operator-owned and untouched, including actual grouped-tool loading, installed hook observation, lost-process episodes, historical regression runs and producer transcripts.

All paths in each task's Files line are exact write leases; their union is the frontmatter files list. Read-only prerequisites and references are not leased. Keep fixture helpers embedded in the owning test target; no shared test helper, generated snapshot, source re-export or fixture path is implicitly writable. No manifest/lockfile or frozen cadence-core edit is planned.

Compilation without overlapping leases: Plans 1–5 implement source files under src/review and compile those actual files using explicit #[path = "../src/review/<module>.rs"] declarations at the root of their own integration-test targets. Declare only existing prerequisite sibling modules there, with sibling imports through super::<module> and existing library imports through cadence::<module>. For private units, put assertions in a child test module of the owning source and select its named test prefix through the same target. Do not create public APIs solely for tests or replace missing production code with test implementations. Plan 6 alone creates src/review/mod.rs and registers the identical module graph in lib.rs; earlier targets remain valid without edits. This is direct compilation of production code, not a suite-inventory or workflow harness. New public visibility is for production sibling/service consumers only.

Each Verify command is an instruction for later implementation execution, from the repository root; none is run during plan authoring. Prefix each direct test name with the listed selector. Each criterion below is a separate invocation on its own hand-authored input; do not chain the assertions into a scenario. Use only its named boundary stubs, call deterministic internals for real, and keep literal expected values independent of production serializers. No model call, live host, cargo regression sweep, concurrency scheduling exercise or manual-checklist substitute belongs to these verifies. AC50, AC51 and AC83 use deterministic filesystem commit schedules, not live races. Keep unimplemented criteria pending until their production unit and direct test exist.

Numeric order is mandatory even though the exact file leases do not overlap. Dependencies live only in these Notes. The rewritten AC1–AC150 numbering is authoritative; former AC numbers in CONTEXT/HANDOFF are historical. MANUAL.md is read-only and none of its items is implemented or discharged by a plan verify. Independently authored fixture files are implementation deliverables for phase 10, not proof of the manual native producer episode.
