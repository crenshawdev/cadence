---
phase: 9
plan: 2
requirements:
  - AC34
  - AC35
  - AC36
  - AC37
  - AC38
  - AC41
  - AC42
  - AC71
  - AC72
  - AC73
  - AC74
  - AC75
  - AC76
  - AC77
  - AC133
  - AC134
  - AC135
files:
  - crates/cadence/src/review/material.rs
  - crates/cadence/src/review/material_io.rs
  - crates/cadence/tests/phase9_material.rs
  - crates/cadence/tests/fixtures/phase9/material-snapshots.json
  - crates/cadence/tests/fixtures/phase9/material-read.json
  - crates/cadence/src/review/manifest.rs
  - crates/cadence/tests/phase9_manifest.rs
  - crates/cadence/tests/fixtures/phase9/material-sides.json
  - crates/cadence/src/review/targets.rs
  - crates/cadence/tests/phase9_context.rs
  - crates/cadence/tests/fixtures/phase9/material-context.json
  - docs/architecture/review-material.md
---

# Phase 9: Immutable material and specialist targets - Plan 2

## Goal

Retain readable review material, source-side mappings and append-only supporting evidence independently of mutable files, the current index and ordinary Git refs.

## Must be true when done

- Acquire typed material and content identity: the independent criteria mapped to P9-2-T1 return their literal specified values.
- Recover retained bytes and frozen directory membership: the independent criteria mapped to P9-2-T2 return their literal specified values.
- Bind diffs to retained source sides: the independent criteria mapped to P9-2-T3 return their literal specified values.
- Append context without rewriting original views: the independent criteria mapped to P9-2-T4 return their literal specified values.

## Context

D-60 and HANDOFF H2 require retained bytes, not only a digest or diff. Use Plan 1 record and I/O types; scope includes committed ranges, staged work, named files, frozen directories, decisions and diagnosis context.

## Tasks

### Task 1: Acquire typed material and content identity (P9-2-T1)

- **Files:** `crates/cadence/src/review/material.rs`, `crates/cadence/src/review/material_io.rs`, `crates/cadence/tests/phase9_material.rs`, `crates/cadence/tests/fixtures/phase9/material-snapshots.json`
- **Action:** Implement retain_range, retain_staged, retain_file and artifact_content_id. Resolve committed base/head or authored staged tree once using the Git subprocess adapter, then retain source and diff bytes durably with their identities. Named files never consult Git and staged/named-file artifacts have no invented HEAD. Prefer retained source bytes independent of ref reachability; record resolved object IDs as provenance. Capture primary and supporting entries separately with content IDs and retained locations. Implement material_io.rs source-filesystem/Git/clock acquisition adapters using Plan 1 seams and existing dependencies. Retention itself takes the Plan 1 durable-storage interface: its production implementation is the transaction-backed adapter owned by Plan 4, and direct tests supply the stated filesystem boundary observations. Do not introduce a separate authoritative material directory or second journal. Preserve honest missing/unavailable material and failed durable writes. No change to rail or pause Git code is needed; those are read-only examples of acquisition, not substitute snapshot retention.

  Hand-author material-snapshots.json with resolved b1/h1/t1 observations and old/new bytes; production record IDs are not hard-coded to fixture labels. Test each named function separately with filesystem reads/write/sync observations, fixed Git outputs for range/staged, forbidden Git for file, and clock 100. The two SHA-256 expected strings are the literal criteria values, never computed by artifact_content_id as an oracle.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_material retain_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC34: Given resolved base `b1`, head `h1` and retained bytes `old\n`, `retain_range` returns `{"kind":"committed-range", "base":"b1", "head":"h1", "bytes":"old\n"}`. Boundaries: filesystem: reads and durable writes; subprocess: fixed Git observations for range/staged, forbidden for named-file; clock: `100`.

  AC35: Given base `b1`, authored index `t1` and bytes `old\n`, `retain_staged` returns `{"kind":"staged-tree", "base":"b1", "index":"t1", "head":null, "bytes":"old\n"}`. Boundaries: filesystem: reads and durable writes; subprocess: fixed Git observations for range/staged, forbidden for named-file; clock: `100`.

  AC36: Given named file `a.rs` with bytes `old\n`, `retain_file` returns `{"kind":"named-file", "path":"a.rs", "head":null, "bytes":"old\n"}`. Boundaries: filesystem: reads and durable writes; subprocess: fixed Git observations for range/staged, forbidden for named-file; clock: `100`.

  AC41: Given named-file bytes `old\n`, `artifact_content_id` returns `"01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee"`. Boundaries: none.

  AC42: Given named-file bytes `new\n`, `artifact_content_id` returns `"7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c"`. Boundaries: none.

### Task 2: Recover retained bytes and frozen directory membership (P9-2-T2)

- **Files:** `crates/cadence/src/review/material.rs`, `crates/cadence/src/review/material_io.rs`, `crates/cadence/tests/phase9_material.rs`, `crates/cadence/tests/fixtures/phase9/material-read.json`
- **Action:** Implement read_material, material_matches and read_directory_target. Material reads resolve the retained entry/content identity, never today's mutable path or refs. Acquisition of a directory records sorted membership and each member's exact bytes; reading that target uses the recorded listing and contents even when the live listing changes. Keep deleted supporting evidence readable from retained storage. Encode unavailable retained content as unavailable instead of falling back to current HEAD. Compare supplied material bytes directly for material_matches. Hand-author material-read.json with retained e1/e3, old/support bytes and conflicting current observations. Add separate read_ tests per unit; forbid mutable-source, live-directory and Git access where the criterion says so. No restart process, edits on disk, or Git setup is required to supply a saved image.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_material read_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC37: Given retained entry `e1` containing `old\n`, mutable source containing `new\n` and moved refs, `read_material` returns `"old\n"`. Boundaries: filesystem: retained bytes, forbid mutable-source reads; subprocess: forbid Git.

  AC38: Given saved bytes `old\n` and proposed bytes `new\n`, `material_matches` returns `false`. Boundaries: none.

  AC74: Given retained supporting `e3` outside primary paths, bytes `support\n`, deleted sources and unreachable ordinary refs, `read_material` returns `"support\n"`. Boundaries: filesystem: retained e3; subprocess: forbid mutable Git resolution.

  AC133: Given retained listing `["a.rs"]` with bytes `old\n`, live listing `["b.rs"]`, `read_directory_target` returns `{"members":["a.rs"], "contents":{"a.rs":"old\n"}}`. Boundaries: filesystem: retained listing/bytes, forbid live directory reads.

### Task 3: Bind diffs to retained source sides (P9-2-T3)

- **Files:** `crates/cadence/src/review/manifest.rs`, `crates/cadence/tests/phase9_manifest.rs`, `crates/cadence/tests/fixtures/phase9/material-sides.json`
- **Action:** Implement source_reference, material_side and validate_manifest. Record line-to-byte maps for source entries and hunk-to-source maps for diff entries, keeping base/head/snapshot sides and old/new paths distinct. A deleted head side is explicitly absent; a required existing source side missing from the manifest refuses even when diff bytes exist. Do not use a diff line number as a source line or treat an object hash with unavailable bytes as retained content. Store primary/supporting roles and which entries belong to an attempt view without verifying citation relevance. Hand-author material-sides.json including deleted old.rs, renamed new.rs, absent sides and missing required e1. Direct source_ tests operate on supplied manifest values with no I/O.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_manifest source_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC71: Given saved diff hunk line 4 mapped to deleted `old.rs`, entry `e1`, base line 2, `source_reference` returns `{"entry":"e1", "path":"old.rs", "side":"base", "line":2}`. Boundaries: none.

  AC72: Given rename `old.rs` to `new.rs`, hunk line 5 mapped to head entry `e2`, line 3, `source_reference` returns `{"entry":"e2", "path":"new.rs", "side":"head", "line":3}`. Boundaries: none.

  AC73: Given deleted `old.rs` with base entry `e1` and no head entry, `material_side` returns `{"path":"old.rs", "side":"head", "availability":"absent"}`. Boundaries: none.

  AC77: Given saved diff bytes without required source entry `e1`, `validate_manifest` returns `{"code":"missing-source-material", "entry":"e1", "side":"base"}`. Boundaries: none.

### Task 4: Append context without rewriting original views (P9-2-T4)

- **Files:** `crates/cadence/src/review/material.rs`, `crates/cadence/src/review/targets.rs`, `crates/cadence/tests/phase9_context.rs`, `crates/cadence/tests/fixtures/phase9/material-context.json`, `docs/architecture/review-material.md`
- **Action:** Implement append_material and the pure decision_review_target and diagnosis_target constructors. Retain exact decision text/inline context and named diagnosis entries with reported/cause text; do not leave mutable document pointers as the only evidence. Append additional retained entries with acquisition identity/time and either the actual supplied-to-attempt/view binding or explicit later-evidence provenance. Entries added later cannot alter the original immutable view or claim delivery to an earlier attempt. Preserve manifest identity and append history without replacing previous entries.

  Hand-author material-context.json for e3 original-view support, e4 later counter-evidence, selected D-1 and diagnosis e1. Append tests stub filesystem append/sync and clock 100; target constructors have no boundary. Document material retention locations, mapping semantics, source availability, directory/range target acquisition and immutable view references in review-material.md. Include these direct context_ checks as the material-read/append check commands for H2; do not implement phase 10 evidence weighting.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_context context_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC75: Given manifest `m1`, later counter-evidence bytes `counter\n`, next entry `e4`, time `100`, no delivered attempt, `append_material` returns `{"entry":"e4", "acquired_at":100, "provenance":"later-evidence", "attempt":null}`. Boundaries: filesystem: append/sync; clock: `100`.

  AC76: Given supporting bytes `support\n` delivered to `a1/v1`, next entry `e3`, time `100`, `append_material` returns `{"entry":"e3", "acquired_at":100, "provenance":"original-view", "attempt":"a1", "view":"v1"}`. Boundaries: filesystem: append/sync; clock: `100`.

  AC134: Given selected decision `D-1` text `Decision` and inline context `Context`, `decision_review_target` returns `{"decision":"D-1", "text":"Decision", "context":"Context"}`. Boundaries: none.

  AC135: Given named entry `e1`, reported text `Reported` and cause text `Cause`, `diagnosis_target` returns `{"entries":["e1"], "reported":"Reported", "cause":"Cause"}`. Boundaries: none.

## Requirements mapping

| Requirement | Implementing task |
|---|---|
| AC34 | P9-2-T1 |
| AC35 | P9-2-T1 |
| AC36 | P9-2-T1 |
| AC41 | P9-2-T1 |
| AC42 | P9-2-T1 |
| AC37 | P9-2-T2 |
| AC38 | P9-2-T2 |
| AC74 | P9-2-T2 |
| AC133 | P9-2-T2 |
| AC71 | P9-2-T3 |
| AC72 | P9-2-T3 |
| AC73 | P9-2-T3 |
| AC77 | P9-2-T3 |
| AC75 | P9-2-T4 |
| AC76 | P9-2-T4 |
| AC134 | P9-2-T4 |
| AC135 | P9-2-T4 |

## Notes

Run after Plan 1, before Plan 3. Depends on Plan 1 model/io definitions and H4 contract IDs. This plan owns all material implementation and its production I/O adapter; Plan 4 adds the transaction-backed retained-record adapter without modifying these files, and Plan 6 mounts these modules and exposes material-read/append operations. Fixtures are committed compatibility inputs for phase 10, not a producer episode.

All paths in each task's Files line are exact write leases; their union is the frontmatter files list. Read-only prerequisites and references are not leased. Keep fixture helpers embedded in the owning test target; no shared test helper, generated snapshot, source re-export or fixture path is implicitly writable. No manifest/lockfile or frozen cadence-core edit is planned.

Compilation without overlapping leases: Plans 1–5 implement source files under src/review and compile those actual files using explicit #[path = "../src/review/<module>.rs"] declarations at the root of their own integration-test targets. Declare only existing prerequisite sibling modules there, with sibling imports through super::<module> and existing library imports through cadence::<module>. For private units, put assertions in a child test module of the owning source and select its named test prefix through the same target. Do not create public APIs solely for tests or replace missing production code with test implementations. Plan 6 alone creates src/review/mod.rs and registers the identical module graph in lib.rs; earlier targets remain valid without edits. This is direct compilation of production code, not a suite-inventory or workflow harness. New public visibility is for production sibling/service consumers only.

Each Verify command is an instruction for later implementation execution, from the repository root; none is run during plan authoring. Prefix each direct test name with the listed selector. Each criterion below is a separate invocation on its own hand-authored input; do not chain the assertions into a scenario. Use only its named boundary stubs, call deterministic internals for real, and keep literal expected values independent of production serializers. No model call, live host, cargo regression sweep, concurrency scheduling exercise or manual-checklist substitute belongs to these verifies. AC50, AC51 and AC83 use deterministic filesystem commit schedules, not live races. Keep unimplemented criteria pending until their production unit and direct test exist.

Numeric order is mandatory even though the exact file leases do not overlap. Dependencies live only in these Notes. The rewritten AC1–AC150 numbering is authoritative; former AC numbers in CONTEXT/HANDOFF are historical. MANUAL.md is read-only and none of its items is implemented or discharged by a plan verify. Independently authored fixture files are implementation deliverables for phase 10, not proof of the manual native producer episode.
