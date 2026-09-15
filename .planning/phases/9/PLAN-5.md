---
phase: 9
plan: 5
requirements:
  - AC53
  - AC54
  - AC55
  - AC56
  - AC57
  - AC58
  - AC59
  - AC60
  - AC61
  - AC62
  - AC63
  - AC64
  - AC65
  - AC66
  - AC67
  - AC136
  - AC137
  - AC138
  - AC139
  - AC140
  - AC141
  - AC142
  - AC143
  - AC144
  - AC145
  - AC146
  - AC147
  - AC150
files:
  - crates/cadence/src/review/consumers.rs
  - crates/cadence/tests/phase9_consumers.rs
  - crates/cadence/tests/fixtures/phase9/h5-raw-views.json
  - crates/cadence/src/review/views.rs
  - crates/cadence/tests/phase9_views.rs
  - crates/cadence/tests/fixtures/phase9/h5-selected-views.json
  - crates/cadence/src/review/inventory.rs
  - crates/cadence/tests/phase9_inventory.rs
  - crates/cadence/tests/fixtures/phase9/h5-inventories.json
  - docs/architecture/review-consumers.md
  - crates/cadence/src/review/deferred.rs
  - crates/cadence/tests/phase9_deferred.rs
  - crates/cadence/tests/fixtures/phase9/h5-all-homes.json
  - crates/cadence/tests/fixtures/phase9/handoff-index.json
---

# Phase 9: Recovered consumer views and deferred discovery - Plan 5

## Goal

Supply every existing reader with recoverable typed inputs and enqueue deferred obligations atomically across all admitted homes before continuation.

## Must be true when done

- Recover raw completion, report and specialist inputs: the independent criteria mapped to P9-5-T1 return their literal specified values.
- Transport typed provisional and settled views: the independent criteria mapped to P9-5-T2 return their literal specified values.
- Expose risk-only preservation and landing inventories: the independent criteria mapped to P9-5-T3 return their literal specified values.
- Enqueue once and enumerate every durable home: the independent criteria mapped to P9-5-T4 return their literal specified values.

## Context

D-61, D-64 and HANDOFF H5 preserve seven consumer edges. Raw, provisional-selected and settled are separate views; phase 9 originates raw/delivery only and transports supplied phase-10 selections without ruling on them.

## Tasks

### Task 1: Recover raw completion, report and specialist inputs (P9-5-T1)

- **Files:** `crates/cadence/src/review/consumers.rs`, `crates/cadence/tests/phase9_consumers.rs`, `crates/cadence/tests/fixtures/phase9/h5-raw-views.json`
- **Action:** Implement plan_completion_input, execute_completion_input, report_review_input, deferred_enqueue_input, completion_review_state and read_specialist_result. Read authoritative H1–H4 joins via Plan 4 rather than requiring a REVIEW filename; rendering absence cannot erase originals. Preserve fire/round/original/finding IDs and expose pending, failed, accepted-empty and raw distinctly. Specialist raw/empty/failed results use the same immutable original identity without claiming a specialist ruling. Hand-author h5-raw-views.json and direct raw_ tests for each named unit, with supplied saved records and absent renderings as filesystem observations; pure completion-state cases have no boundaries. Do not invoke reporting, execution, a specialist reviewer or deferred enqueue to prove a reader.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_consumers raw_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC53: Given saved `f1/round1/o1` containing F, with disposable rendering absent, `plan_completion_input` returns `{"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries: filesystem: saved record, rendering absent.

  AC54: Given saved `f1/round1/o1` containing F, with disposable rendering absent, `execute_completion_input` returns `{"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries: filesystem: saved record, rendering absent.

  AC55: Given saved `f1/round1/o1` containing F, with disposable rendering absent, `report_review_input` returns `{"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries: filesystem: saved record, rendering absent.

  AC56: Given saved `f1/round1/o1` containing F, with disposable rendering absent, `deferred_enqueue_input` returns `{"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries: filesystem: saved record, rendering absent.

  AC64: Given saved delivery state `pending`, `completion_review_state` returns `{"state":"pending", "findings":null}`. Boundaries: none.

  AC65: Given saved delivery state `failed`, `completion_review_state` returns `{"state":"failed", "findings":null}`. Boundaries: none.

  AC66: Given saved delivery state `accepted-empty`, `completion_review_state` returns `{"state":"accepted", "findings":[]}`. Boundaries: none.

  AC136: Given saved specialist result `raw`, `read_specialist_result` returns `{"kind":"raw", "original":"o1"}`. Boundaries: filesystem: saved specialist record.

  AC137: Given saved specialist result `empty`, `read_specialist_result` returns `{"kind":"raw", "findings":[]}`. Boundaries: filesystem: saved specialist record.

  AC138: Given saved specialist result `failed`, `read_specialist_result` returns `{"kind":"failed", "findings":null}`. Boundaries: filesystem: saved specialist record.

### Task 2: Transport typed provisional and settled views (P9-5-T2)

- **Files:** `crates/cadence/src/review/views.rs`, `crates/cadence/tests/phase9_views.rs`, `crates/cadence/tests/fixtures/phase9/h5-selected-views.json`
- **Action:** Implement execute_fix_input, planned_task_fix_input and consumer_view. Carry supplied view kind/revision, original-finding IDs, source fire/round and optional fix identity without converting raw findings to survivors. A supplied provisional revision 2 can select o1:0 and refute o1:1 before any fix commit exists. Accept the typed settled slot for later consumers without producing settlement or clearance. Hand-author h5-selected-views.json with revision 2 and each typed kind. Direct view_ tests use supplied values only, no adjudicator, Git, fix executor or earlier admission chain.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_views view_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC57: Given supplied provisional revision 2 selecting `o1:0`, refuting `o1:1`, and no fix commit, `execute_fix_input` returns `{"kind":"provisional-selected", "revision":2, "finding_ids":["o1:0"], "fix":null}`. Boundaries: none.

  AC58: Given supplied provisional revision 2 selecting `o1:0`, refuting `o1:1`, and no fix commit, `planned_task_fix_input` returns `{"kind":"provisional-selected", "revision":2, "finding_ids":["o1:0"], "fix":null}`. Boundaries: none.

  AC59: Given supplied typed view `raw` at revision 2, `consumer_view` returns `kind = "raw"`. Boundaries: none.

  AC60: Given supplied typed view `provisional-selected` at revision 2, `consumer_view` returns `kind = "provisional-selected"`. Boundaries: none.

  AC61: Given supplied typed view `settled` at revision 2, `consumer_view` returns `kind = "settled"`. Boundaries: none.

### Task 3: Expose risk-only preservation and landing inventories (P9-5-T3)

- **Files:** `crates/cadence/src/review/inventory.rs`, `crates/cadence/tests/phase9_inventory.rs`, `crates/cadence/tests/fixtures/phase9/h5-inventories.json`, `docs/architecture/review-consumers.md`
- **Action:** Implement landing_inventory, milestone_review_inputs and deferred_members over supplied saved inventory values. Preserve risk_surface-only REVIEW/ADJUDICATION rounds and filenames for landing/milestone inputs, keeping raw unruled inventory separate from supplied adjudicated entries. A plan review does not enter that edge, and advisory REVIEW presence without a deferred obligation creates no queue member. These adapters enumerate inputs; they do not implement pruning, carry, merging, verified settlement filtering or landing authorization.

  Hand-author h5-inventories.json with independent risk/plan and advisory cases. Document all seven consumer adapters, native query operation names, regenerable rendering addresses, view revisions and authoritative ID joins in review-consumers.md. Include supplied provisional fix inputs as well as raw completion/report and risk preservation edges. Every inventory_ test calls the named pure function with literal input; do not exercise a whole downstream workflow.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_inventory inventory_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC62: Given risk_surface rounds `f1/1` unruled and `f2/2` adjudicated, plus plan review `f3`, `landing_inventory` returns `{"unruled":["f1/1"], "adjudicated":["f2/2"]}`. Boundaries: none.

  AC63: Given risk_surface REVIEW/ADJUDICATION rounds 1 and 2, plus plan review, `milestone_review_inputs` returns `["REVIEW-risk_surface-1.md", "ADJUDICATION-risk_surface-1.md", "REVIEW-risk_surface-2.md", "ADJUDICATION-risk_surface-2.md"]`. Boundaries: none.

  AC67: Given an advisory REVIEW record with no deferred obligation, `deferred_members` returns `[]`. Boundaries: none.

### Task 4: Enqueue once and enumerate every durable home (P9-5-T4)

- **Files:** `crates/cadence/src/review/deferred.rs`, `crates/cadence/tests/phase9_deferred.rs`, `crates/cadence/tests/fixtures/phase9/h5-all-homes.json`, `crates/cadence/tests/fixtures/phase9/handoff-index.json`
- **Action:** Implement enqueue_deferred and the unfiltered enumerate_deferred over Plan 4's durable all-home index. Atomically commit the initial unruled member and H1 fire/H2 manifest/H3 attempt/H4 original references before returning continuation allowed. Cover phase, task, root-inline, root-debug and root-diagnosis; queue sync failure returns continuation wait. Advisory/off with no obligation writes nothing. Discovery reads authoritative records even if every rendering is absent; it must not depend on mutable cursor, phase-only directory scans or ADJUDICATION sibling existence. Phase 10 owns verified filtering/carry using this exact enumerator.

  Hand-author h5-all-homes.json with five home variants, f1/f2/f3 enumeration, explicit f1/m1/a1/o1 joins and failed-sync/no-write variants. Use persistence.rs's existing generic review-record transaction contribution; do not add a second queue file transaction. Hand-author handoff-index.json listing every Plan 1–5 fixture, its contract IDs and record/content joins, including boundary returns, material sides, specialists, panel states and every home. Compute inventory hashes from the authored fixture bytes independently of production serializers if hashes are included. The fixtures are committed implementation assets for phase 10; no producer run is required. Direct deferred_ tests use saved filesystem images, sync outcomes and clock 100, never a dispatch/return/enqueue workflow.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_deferred deferred_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC139: Given deferred fire `f1` in `phase` home with H1-H4 references, `enqueue_deferred` returns `{"member":"f1", "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem: atomic member commit; clock: `100`.

  AC140: Given deferred fire `f1` in `task` home with H1-H4 references, `enqueue_deferred` returns `{"member":"f1", "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem: atomic member commit; clock: `100`.

  AC141: Given deferred fire `f1` in `root-inline` home with H1-H4 references, `enqueue_deferred` returns `{"member":"f1", "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem: atomic member commit; clock: `100`.

  AC142: Given deferred fire `f1` in `root-debug` home with H1-H4 references, `enqueue_deferred` returns `{"member":"f1", "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem: atomic member commit; clock: `100`.

  AC143: Given deferred fire `f1` in `root-diagnosis` home with H1-H4 references, `enqueue_deferred` returns `{"member":"f1", "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem: atomic member commit; clock: `100`.

  AC144: Given deferred fire `f1` with failed queue sync, `enqueue_deferred` returns `{"code":"enqueue-write-failed", "fire":"f1", "continuation":"wait"}`. Boundaries: filesystem: fail queue sync; clock: `100`.

  AC145: Given saved phase `f1`, task `f2`, root `f3` members, all disposable renderings absent, `enumerate_deferred` returns `["f1", "f2", "f3"]`. Boundaries: filesystem: all-home saved inventory.

  AC146: Given gate `advisory` and no deferred obligation, `enqueue_deferred` returns `{"member":null}`. Boundaries: filesystem: forbid member writes.

  AC147: Given gate `off` and no deferred obligation, `enqueue_deferred` returns `{"member":null}`. Boundaries: filesystem: forbid member writes.

  AC150: Given saved f1 with H1 f1, H2 m1, H3 a1 and H4 o1 references, `enumerate_deferred` returns `members[0].references = {"fire":"f1", "manifest":"m1", "attempt":"a1", "original":"o1"}`. Boundaries: filesystem: saved all-home inventory.

## Requirements mapping

| Requirement | Implementing task |
|---|---|
| AC53 | P9-5-T1 |
| AC54 | P9-5-T1 |
| AC55 | P9-5-T1 |
| AC56 | P9-5-T1 |
| AC64 | P9-5-T1 |
| AC65 | P9-5-T1 |
| AC66 | P9-5-T1 |
| AC136 | P9-5-T1 |
| AC137 | P9-5-T1 |
| AC138 | P9-5-T1 |
| AC57 | P9-5-T2 |
| AC58 | P9-5-T2 |
| AC59 | P9-5-T2 |
| AC60 | P9-5-T2 |
| AC61 | P9-5-T2 |
| AC62 | P9-5-T3 |
| AC63 | P9-5-T3 |
| AC67 | P9-5-T3 |
| AC139 | P9-5-T4 |
| AC140 | P9-5-T4 |
| AC141 | P9-5-T4 |
| AC142 | P9-5-T4 |
| AC143 | P9-5-T4 |
| AC144 | P9-5-T4 |
| AC145 | P9-5-T4 |
| AC146 | P9-5-T4 |
| AC147 | P9-5-T4 |
| AC150 | P9-5-T4 |

## Notes

Run after Plans 1–4, before Plan 6. Depends on the complete persistence/index API from Plan 4 and typed views from Plan 1. This plan owns native all-home discovery and initial enqueue. Plan 6 wires this enumerator into next-action/public queries and exposes consumer views; phase 10 will not need to extend discovery. Hand-authored compatibility fixtures are explicitly allowed by the rewritten CONTEXT and are not evidence for the manual producer episode.

All paths in each task's Files line are exact write leases; their union is the frontmatter files list. Read-only prerequisites and references are not leased. Keep fixture helpers embedded in the owning test target; no shared test helper, generated snapshot, source re-export or fixture path is implicitly writable. No manifest/lockfile or frozen cadence-core edit is planned.

Compilation without overlapping leases: Plans 1–5 implement source files under src/review and compile those actual files using explicit #[path = "../src/review/<module>.rs"] declarations at the root of their own integration-test targets. Declare only existing prerequisite sibling modules there, with sibling imports through super::<module> and existing library imports through cadence::<module>. For private units, put assertions in a child test module of the owning source and select its named test prefix through the same target. Do not create public APIs solely for tests or replace missing production code with test implementations. Plan 6 alone creates src/review/mod.rs and registers the identical module graph in lib.rs; earlier targets remain valid without edits. This is direct compilation of production code, not a suite-inventory or workflow harness. New public visibility is for production sibling/service consumers only.

Each Verify command is an instruction for later implementation execution, from the repository root; none is run during plan authoring. Prefix each direct test name with the listed selector. Each criterion below is a separate invocation on its own hand-authored input; do not chain the assertions into a scenario. Use only its named boundary stubs, call deterministic internals for real, and keep literal expected values independent of production serializers. No model call, live host, cargo regression sweep, concurrency scheduling exercise or manual-checklist substitute belongs to these verifies. AC50, AC51 and AC83 use deterministic filesystem commit schedules, not live races. Keep unimplemented criteria pending until their production unit and direct test exist.

Numeric order is mandatory even though the exact file leases do not overlap. Dependencies live only in these Notes. The rewritten AC1–AC150 numbering is authoritative; former AC numbers in CONTEXT/HANDOFF are historical. MANUAL.md is read-only and none of its items is implemented or discharged by a plan verify. Independently authored fixture files are implementation deliverables for phase 10, not proof of the manual native producer episode.
