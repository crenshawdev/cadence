---
phase: 9
plan: 3
requirements:
  - AC3
  - AC4
  - AC6
  - AC7
  - AC8
  - AC9
  - AC10
  - AC11
  - AC12
  - AC13
  - AC14
  - AC15
  - AC16
  - AC17
  - AC18
  - AC19
  - AC20
  - AC21
  - AC22
  - AC23
  - AC24
  - AC25
  - AC26
  - AC29
  - AC30
  - AC31
  - AC32
  - AC33
  - AC118
  - AC119
  - AC120
  - AC121
  - AC122
  - AC123
  - AC124
  - AC125
  - AC128
  - AC130
  - AC131
  - AC132
files:
  - crates/cadence/src/review/policy.rs
  - crates/cadence/tests/phase9_policy.rs
  - crates/cadence/tests/fixtures/phase9/policy-requests.json
  - crates/cadence/tests/fixtures/phase9/policy-actions.json
  - crates/cadence/src/review/selection.rs
  - crates/cadence/tests/phase9_selection.rs
  - crates/cadence/tests/fixtures/phase9/selection-first.json
  - crates/cadence/tests/fixtures/phase9/selection-panel.json
  - crates/cadence/src/review/specialist.rs
  - crates/cadence/tests/phase9_specialist.rs
  - crates/cadence/tests/fixtures/phase9/specialist-requests.json
  - docs/architecture/review-policy.md
---

# Phase 9: Shared policy and ordered reviewer selection - Plan 3

## Goal

Give ordinary callers one admitted gate meaning, stop FIRST at the first usable return, and preserve complete panel rosters and specialist routing.

## Must be true when done

- Build ordinary requests from the resolved policy: the independent criteria mapped to P9-3-T1 return their literal specified values.
- Separate delivery permission from settlement: the independent criteria mapped to P9-3-T2 return their literal specified values.
- Select FIRST attempts and preserve observed cost: the independent criteria mapped to P9-3-T3 return their literal specified values.
- Keep every required panel slot in completion: the independent criteria mapped to P9-3-T4 return their literal specified values.
- Preserve minimalism specialist admission: the independent criteria mapped to P9-3-T5 return their literal specified values.

## Context

D-58, D-59 and D-65 define deterministic policy decisions over supplied phase-8 route/policy values. These functions select or describe work; no test dispatches a model or rebuilds phase-8 configuration.

## Tasks

### Task 1: Build ordinary requests from the resolved policy (P9-3-T1)

- **Files:** `crates/cadence/src/review/policy.rs`, `crates/cadence/tests/phase9_policy.rs`, `crates/cadence/tests/fixtures/phase9/policy-requests.json`
- **Action:** Implement ordinary_request and the six manual-plan, automatic-plan, task, execute, debug and verify request constructors. Consume the effective phase-8 gate, routing answer, applicable floor result and admitted home unchanged; caller identity is the only caller-specific difference in the deferred/local/h1 cases. Do not resolve defaults independently, create a milestone trigger, revive phase_diff or reinterpret deferred as blocking for a small task. Use explicit trigger/specialist types from Plan 1. Hand-author policy-requests.json for all six caller labels and the supplied plan advisory/risk_surface blocking/diff off cases. Each request_ test calls the criterion's constructor directly, with no filesystem/config reload or parent workflow.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_policy request_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC6: Given ordinary review input with effective gate `deferred`, routing `local` and home `h1`, `manual_plan_request` returns `{"caller":"manual-plan", "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.

  AC7: Given ordinary review input with effective gate `deferred`, routing `local` and home `h1`, `automatic_plan_request` returns `{"caller":"automatic-plan", "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.

  AC8: Given ordinary review input with effective gate `deferred`, routing `local` and home `h1`, `task_review_request` returns `{"caller":"task", "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.

  AC9: Given ordinary review input with effective gate `deferred`, routing `local` and home `h1`, `execute_review_request` returns `{"caller":"execute", "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.

  AC10: Given ordinary review input with effective gate `deferred`, routing `local` and home `h1`, `debug_review_request` returns `{"caller":"debug", "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.

  AC11: Given ordinary review input with effective gate `deferred`, routing `local` and home `h1`, `verify_review_request` returns `{"caller":"verify", "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.

  AC17: Given trigger `plan`, phase-8 resolved gate `advisory` and no plan-floor elevation, `ordinary_request` returns `gate = "advisory"`. Boundaries: none.

  AC18: Given trigger `risk_surface`, phase-8 resolved gate `blocking` and no plan-floor elevation, `ordinary_request` returns `gate = "blocking"`. Boundaries: none.

  AC19: Given trigger `diff`, phase-8 resolved gate `off` and no plan-floor elevation, `ordinary_request` returns `gate = "off"`. Boundaries: none.

### Task 2: Separate delivery permission from settlement (P9-3-T2)

- **Files:** `crates/cadence/src/review/policy.rs`, `crates/cadence/tests/phase9_policy.rs`, `crates/cadence/tests/fixtures/phase9/policy-actions.json`
- **Action:** Implement delivery_permission, ordinary_gate_action, risk_review_action and settlement_state as pure decisions. Pending advisory delivery waits; durable accepted advisory delivery continues even for blocker severity under adjudicated combination. Deferred delivery requests enqueue before continuation; blocking/adjudicated remain settlement-pending after raw acceptance. Off produces no review obligation. Consume supplied detector match/nonmatch/inconclusive/unanswered observations for dispatch/no-review/wait-for-evidence/ask-surfaces; do not re-run the detector or infer a clean scan from missing input. Hand-author policy-actions.json and direct action_ tests, one function per criterion. Phase 10 alone supplies accepted settlement and clearance; no raw-result shortcut is added here.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_policy action_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC3: Given advisory fire `f1` with delivery `pending`, `delivery_permission` returns `"wait-for-delivery"`. Boundaries: none.

  AC4: Given advisory fire `f1`, durable delivery `accepted`, severity `blocker` and combination `adjudicated`, `delivery_permission` returns `"continue"`. Boundaries: none.

  AC12: Given gate `off` and delivery `accepted` without settlement, `ordinary_gate_action` returns `"off"`. Boundaries: none.

  AC13: Given gate `advisory` and delivery `accepted` without settlement, `ordinary_gate_action` returns `"continue"`. Boundaries: none.

  AC14: Given gate `deferred` and delivery `accepted` without settlement, `ordinary_gate_action` returns `"enqueue-before-continuation"`. Boundaries: none.

  AC15: Given gate `blocking` and delivery `accepted` without settlement, `ordinary_gate_action` returns `"wait-for-settlement"`. Boundaries: none.

  AC16: Given gate `adjudicated` and delivery `accepted` without settlement, `ordinary_gate_action` returns `"wait-for-settlement"`. Boundaries: none.

  AC20: Given supplied detector observation `match` with blocking risk gate, `risk_review_action` returns `"dispatch"`. Boundaries: none.

  AC21: Given supplied detector observation `nonmatch` with blocking risk gate, `risk_review_action` returns `"no-review"`. Boundaries: none.

  AC22: Given supplied detector observation `inconclusive` with blocking risk gate, `risk_review_action` returns `"wait-for-evidence"`. Boundaries: none.

  AC23: Given supplied detector observation `unanswered` with blocking risk gate, `risk_review_action` returns `"ask-surfaces"`. Boundaries: none.

  AC128: Given usable-complete adjudicated delivery without settlement, `settlement_state` returns `"pending"`. Boundaries: none.

### Task 3: Select FIRST attempts and preserve observed cost (P9-3-T3)

- **Files:** `crates/cadence/src/review/selection.rs`, `crates/cadence/tests/phase9_selection.rs`, `crates/cadence/tests/fixtures/phase9/selection-first.json`
- **Action:** Implement select_next over saved ordered choices, terminal outcomes and the admitted local fallback rule. After one usable result, including an empty array, stop and label later choices not_selected; never select a full panel then discard results. Exhausted configured choices select local once, and its actual success/failure determines usable-complete versus complete-with-failure. Missing/malformed classification consumes Plan 1's real validator, with no provider transport added. Implement attempt_usage as a projection of supplied observations, preserving failed-attempt costs and explicit null for unobserved input/output usage. Hand-author each independent state in selection-first.json. first_ tests call select_next or attempt_usage directly; they must not obtain B's input by running A first.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_selection first_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC24: Given FIRST choices `["A", "B", "C"]` and terminal failure for A, `select_next` returns `{"request":"B"}`. Boundaries: none.

  AC25: Given FIRST choices `["A", "B", "C"]`, failed A and usable B with finding F, `select_next` returns `{"request":null, "not_selected":["C"]}`. Boundaries: none.

  AC26: Given FIRST choices `["A", "B", "C"]` and usable empty A, `select_next` returns `{"request":null, "not_selected":["B", "C"]}`. Boundaries: none.

  AC29: Given FIRST choices `["A", "B"]`, both failed, and fallback `local`, `select_next` returns `{"request":"local"}`. Boundaries: none.

  AC30: Given exhausted FIRST choices and `usable empty` local fallback, `select_next` returns `{"state":"usable-complete", "request":null}`. Boundaries: none.

  AC31: Given exhausted FIRST choices and `failed` local fallback, `select_next` returns `{"state":"complete-with-failure", "request":null}`. Boundaries: none.

  AC32: Given failed attempt `a1` with `{"input":7, "output":3}` usage, `attempt_usage` returns `{"input":7, "output":3}`. Boundaries: none.

  AC33: Given failed attempt `a1` with absent usage, `attempt_usage` returns `{"input":null, "output":null}`. Boundaries: none.

### Task 4: Keep every required panel slot in completion (P9-3-T4)

- **Files:** `crates/cadence/src/review/selection.rs`, `crates/cadence/tests/phase9_selection.rs`, `crates/cadence/tests/fixtures/phase9/selection-panel.json`
- **Action:** Implement dispatch_roster and delivery_completion for panel and adjudicated combination. Freeze all required voices and per-slot fallback rules at admission; success in A cannot drop pending/interrupted B. Every required slot must reach its actual terminal outcome before completion. Distinguish failed-no-fallback, fallback-success and fallback-failed; complete-with-failure never means usable empty success or settled. Hand-author selection-panel.json with A/B states, including empty A and each B variant. panel_ tests supply these records directly and call one pure function; no concurrent panel run or model output is involved.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_selection panel_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC118: Given panel admission with required voices A and B, `dispatch_roster` returns `required_requests = ["A", "B"]`. Boundaries: none.

  AC119: Given adjudicated admission with required voices A and B, `dispatch_roster` returns `required_requests = ["A", "B"]`. Boundaries: none.

  AC120: Given roster `["A", "B"]`, usable empty A and B state `pending`, `delivery_completion` returns `"incomplete"`. Boundaries: none.

  AC121: Given roster `["A", "B"]`, usable empty A and B state `interrupted`, `delivery_completion` returns `"incomplete"`. Boundaries: none.

  AC122: Given roster `["A", "B"]`, usable empty A and B state `success`, `delivery_completion` returns `"usable-complete"`. Boundaries: none.

  AC123: Given roster `["A", "B"]`, usable empty A and B state `failed-no-fallback`, `delivery_completion` returns `"complete-with-failure"`. Boundaries: none.

  AC124: Given roster `["A", "B"]`, usable empty A and B state `failed-fallback-success`, `delivery_completion` returns `"usable-complete"`. Boundaries: none.

  AC125: Given roster `["A", "B"]`, usable empty A and B state `failed-fallback-failed`, `delivery_completion` returns `"complete-with-failure"`. Boundaries: none.

### Task 5: Preserve minimalism specialist admission (P9-3-T5)

- **Files:** `crates/cadence/src/review/specialist.rs`, `crates/cadence/tests/phase9_specialist.rs`, `crates/cadence/tests/fixtures/phase9/specialist-requests.json`, `docs/architecture/review-policy.md`
- **Action:** Implement minimalism_request for already-retained file, frozen directory and resolved phase-range targets, always requesting the one base reviewer and explicit null ordinary_routing. Ordinary panel configuration must not select a panel for this specialist. Use Plan 2's target descriptions and retained identities; decision/diagnosis keep their specialist kind and context instead of becoming ordinary configured triggers. Hand-author specialist-requests.json and direct minimalism_ tests. Document ordinary policy adapters, FIRST terminal vocabulary, full roster completion, specialist exceptions and phase-8 routing input in review-policy.md, including the provider adapter seam reserved for phase 10. No specialist judgment or evidence verification is implemented.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_specialist minimalism_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC130: Given retained `file` target `m1` and ordinary routing `panel`, `minimalism_request` returns `{"specialist":"minimalism", "target":"m1", "reviewers":["base"], "ordinary_routing":null}`. Boundaries: none.

  AC131: Given retained `directory` target `m1` and ordinary routing `panel`, `minimalism_request` returns `{"specialist":"minimalism", "target":"m1", "reviewers":["base"], "ordinary_routing":null}`. Boundaries: none.

  AC132: Given retained `phase-range` target `m1` and ordinary routing `panel`, `minimalism_request` returns `{"specialist":"minimalism", "target":"m1", "reviewers":["base"], "ordinary_routing":null}`. Boundaries: none.

## Requirements mapping

| Requirement | Implementing task |
|---|---|
| AC6 | P9-3-T1 |
| AC7 | P9-3-T1 |
| AC8 | P9-3-T1 |
| AC9 | P9-3-T1 |
| AC10 | P9-3-T1 |
| AC11 | P9-3-T1 |
| AC17 | P9-3-T1 |
| AC18 | P9-3-T1 |
| AC19 | P9-3-T1 |
| AC3 | P9-3-T2 |
| AC4 | P9-3-T2 |
| AC12 | P9-3-T2 |
| AC13 | P9-3-T2 |
| AC14 | P9-3-T2 |
| AC15 | P9-3-T2 |
| AC16 | P9-3-T2 |
| AC20 | P9-3-T2 |
| AC21 | P9-3-T2 |
| AC22 | P9-3-T2 |
| AC23 | P9-3-T2 |
| AC128 | P9-3-T2 |
| AC24 | P9-3-T3 |
| AC25 | P9-3-T3 |
| AC26 | P9-3-T3 |
| AC29 | P9-3-T3 |
| AC30 | P9-3-T3 |
| AC31 | P9-3-T3 |
| AC32 | P9-3-T3 |
| AC33 | P9-3-T3 |
| AC118 | P9-3-T4 |
| AC119 | P9-3-T4 |
| AC120 | P9-3-T4 |
| AC121 | P9-3-T4 |
| AC122 | P9-3-T4 |
| AC123 | P9-3-T4 |
| AC124 | P9-3-T4 |
| AC125 | P9-3-T4 |
| AC130 | P9-3-T5 |
| AC131 | P9-3-T5 |
| AC132 | P9-3-T5 |

## Notes

Run after Plans 1–2, before Plan 4. Phase 8 must have finished policy/routing and the shared risk detector before phase 9 execution begins; consume their landed public types via a narrow conversion at Plan 6 admission. All tests here supply policy/detector values and call deterministic internals for real. This plan owns policy/selection/specialist modules; Plan 6 owns invoking skills and the production caller conversion.

All paths in each task's Files line are exact write leases; their union is the frontmatter files list. Read-only prerequisites and references are not leased. Keep fixture helpers embedded in the owning test target; no shared test helper, generated snapshot, source re-export or fixture path is implicitly writable. No manifest/lockfile or frozen cadence-core edit is planned.

Compilation without overlapping leases: Plans 1–5 implement source files under src/review and compile those actual files using explicit #[path = "../src/review/<module>.rs"] declarations at the root of their own integration-test targets. Declare only existing prerequisite sibling modules there, with sibling imports through super::<module> and existing library imports through cadence::<module>. For private units, put assertions in a child test module of the owning source and select its named test prefix through the same target. Do not create public APIs solely for tests or replace missing production code with test implementations. Plan 6 alone creates src/review/mod.rs and registers the identical module graph in lib.rs; earlier targets remain valid without edits. This is direct compilation of production code, not a suite-inventory or workflow harness. New public visibility is for production sibling/service consumers only.

Each Verify command is an instruction for later implementation execution, from the repository root; none is run during plan authoring. Prefix each direct test name with the listed selector. Each criterion below is a separate invocation on its own hand-authored input; do not chain the assertions into a scenario. Use only its named boundary stubs, call deterministic internals for real, and keep literal expected values independent of production serializers. No model call, live host, cargo regression sweep, concurrency scheduling exercise or manual-checklist substitute belongs to these verifies. AC50, AC51 and AC83 use deterministic filesystem commit schedules, not live races. Keep unimplemented criteria pending until their production unit and direct test exist.

Numeric order is mandatory even though the exact file leases do not overlap. Dependencies live only in these Notes. The rewritten AC1–AC150 numbering is authoritative; former AC numbers in CONTEXT/HANDOFF are historical. MANUAL.md is read-only and none of its items is implemented or discharged by a plan verify. Independently authored fixture files are implementation deliverables for phase 10, not proof of the manual native producer episode.
