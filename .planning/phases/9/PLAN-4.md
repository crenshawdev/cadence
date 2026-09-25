---
phase: 9
plan: 4
requirements:
  - AC5
  - AC39
  - AC40
  - AC43
  - AC44
  - AC45
  - AC46
  - AC47
  - AC48
  - AC49
  - AC50
  - AC51
  - AC52
  - AC68
  - AC69
  - AC70
  - AC78
  - AC79
  - AC80
  - AC81
  - AC82
  - AC83
  - AC108
  - AC109
  - AC110
  - AC126
  - AC127
  - AC129
files:
  - crates/cadence/src/review/admission.rs
  - crates/cadence/src/review/persistence.rs
  - crates/cadence/tests/phase9_admission.rs
  - crates/cadence/tests/fixtures/phase9/h1-admission.json
  - crates/cadence/src/review/binding.rs
  - crates/cadence/src/review/attempts.rs
  - crates/cadence/tests/phase9_binding.rs
  - crates/cadence/tests/fixtures/phase9/h3-bindings.json
  - crates/cadence/tests/phase9_observations.rs
  - crates/cadence/tests/fixtures/phase9/h3-observations.json
  - crates/cadence/src/review/returns.rs
  - crates/cadence/tests/phase9_returns.rs
  - crates/cadence/tests/fixtures/phase9/h4-returns.json
  - crates/cadence/tests/fixtures/phase9/original-q.json
  - crates/cadence/src/review/recovery.rs
  - crates/cadence/src/review/originals.rs
  - crates/cadence/tests/phase9_recovery.rs
  - crates/cadence/tests/fixtures/phase9/h3-rosters.json
  - crates/cadence/tests/fixtures/phase9/h4-originals.json
  - docs/architecture/review-lifecycle.md
---

# Phase 9: Durable admission, attempts and immutable originals - Plan 4

## Goal

Commit pending identity before dispatch and originals plus one terminal outcome before acknowledgment, with replay-safe observations and recoverable H1–H4 joins.

## Must be true when done

- Compose admission and allocate durable occurrences: the independent criteria mapped to P9-4-T1 return their literal specified values.
- Bind return identities and distinguish observed origin: the independent criteria mapped to P9-4-T2 return their literal specified values.
- Record idempotent and late host observations: the independent criteria mapped to P9-4-T3 return their literal specified values.
- Accept unchanged originals and close exactly once: the independent criteria mapped to P9-4-T4 return their literal specified values.
- Recover interrupted work and per-voice originals: the independent criteria mapped to P9-4-T5 return their literal specified values.

## Context

D-61–D-63 and HANDOFF H1/H3/H4 require conditional persistence, exact identity binding and observed participation distinct from requested routing. Reuse store::writer::Operation::CompareTransact and Transaction over Snapshot.data; do not create a second journal.

## Tasks

### Task 1: Compose admission and allocate durable occurrences (P9-4-T1)

- **Files:** `crates/cadence/src/review/admission.rs`, `crates/cadence/src/review/persistence.rs`, `crates/cadence/tests/phase9_admission.rs`, `crates/cadence/tests/fixtures/phase9/h1-admission.json`
- **Action:** Implement admit_pending, read_admission and allocate_occurrence. Persist the complete H1 record, replay key binding, independent occurrence sequence, home inventory, retained manifest references, required roster and initial attempt identities in one conditional transaction. Allocate phase/task/root-inline/root-debug/root-diagnosis homes before exposing dispatch. Repeated material, filename or task slug does not reuse an independent occurrence; replay of the admitted key does. Unavailable durable storage is an honest admission refusal, not treeless success or implicit project scaffolding.

  Provide a reusable admission contribution that joins an existing caller Transaction before commit, with a post-commit acknowledgment step; admit_pending uses this same primitive. A rejected revision comparison emits no dispatch. Preserve the whole snapshot and import/source provenance when inserting a namespaced review record collection, and preserve other transaction participants. The existing public CompareTransact, View and Snapshot.data APIs support this; implement the adapter in persistence.rs without modifying store/import modules. Put retained bytes/content records under the same authoritative store namespace so H1–H5 need no new external transaction participant. Logical homes retain their owner/path/occurrence identity in the all-home index. Use Plan 2 acquisition/mapping code for real and implement its storage adapter here. Read admitted values without current config/cursor reads.

  Hand-author h1-admission.json with H, replay and sequence cases. Tests use real Store/Transaction internals over a stub store::Storage filesystem and a fixed clock, with direct admit_pending/read_admission/allocate_occurrence calls. No lifecycle setup chain, restart process or model dispatch is required.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_admission admission_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC48: Given replay key `k1` inside a caller transaction with failed revision comparison, `admit_pending` returns `{"code":"revision-conflict", "replay_key":"k1", "dispatch":null}`. Boundaries: filesystem: reject conditional commit; clock: `100`.

  AC49: Given committed admission `k1/f1/a1` with acknowledgment lost, `admit_pending` returns `{"fire":"f1", "attempt":"a1", "replayed":true}`. Boundaries: filesystem: committed image; clock: `100`.

  AC68: Given saved admission H, current gate `off`, routing `remote` and phase cursor `99`, `read_admission` returns `{"fire":"f1", "replay_key":"k1", "scope":{"project":"p1", "root":"r1", "cycle":"c1"}, "home":{"kind":"task", "id":"h1", "occurrence":"occ1"}, "caller":"task", "trigger":"risk_surface", "specialist":null, "discriminator":"d1", "plan":null, "anchor":null, "round":1, "artifact":"m1", "gate":"deferred", "selection":{"mode":"single", "choices":["A", "B"], "fallback":"local"}, "routing":{"answer":"local", "evidence":"route1"}, "roster":{"required":["A"], "completion":"all-required-terminal"}, "contract":{"schema":"review-1", "interpretation":"H1-H5", "validator":"H4-1"}, "settlement":"pending"}`. Boundaries: filesystem: H, forbid current-config/cursor reads.

  AC69: Given independent admission, saved sequence `1`, and material already used by `occ1`, `allocate_occurrence` returns `"occ2"`. Boundaries: filesystem: sequence read/write; clock: `100`.

  AC70: Given replay key `k1` already bound to `occ1`, `allocate_occurrence` returns `"occ1"`. Boundaries: filesystem: saved replay binding.

### Task 2: Bind return identities and distinguish observed origin (P9-4-T2)

- **Files:** `crates/cadence/src/review/binding.rs`, `crates/cadence/src/review/attempts.rs`, `crates/cadence/tests/phase9_binding.rs`, `crates/cadence/tests/fixtures/phase9/h3-bindings.json`
- **Action:** Implement bind_return, bind_host_return and read_attempt. Match fire, occurrence, retained artifact/view, attempt and round; reject mismatched artifact/round with the literal field diagnostics. Maintain the global host-return-to-attempt binding so reuse by a second attempt refuses before and after acceptance. A caller-supplied voice label cannot establish participation. Read requested model/agent/effort/routing separately from observed model, launch and return IDs; an unknown observed model stays null.

  Expose the binding input needed by Plan 6's host bridge: binary-issued attempt, actual launch/return IDs, bounded observation reference/kind and available usage. Plan 6 forwards observed facts without inventing host support; missing facts stay unknown. Hand-author h3-bindings.json and direct binding_ tests. bind_return/bind_host_return are pure; read_attempt uses the saved filesystem image only. Do not call observation or admission first to obtain these inputs.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_binding binding_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC39: Given fire `f1/m1/round1` and return whose `artifact` is `m2`, `bind_return` returns `{"code":"artifact-mismatch", "fire":"f1", "field":"artifact"}`. Boundaries: none.

  AC40: Given fire `f1/m1/round1` and return whose `round` is `2`, `bind_return` returns `{"code":"round-mismatch", "fire":"f1", "field":"round"}`. Boundaries: none.

  AC78: Given saved `a1` requested `model-A`, observed model unknown, launch `launch1`, return `return1`; `a2` requests `model-B`, `read_attempt` returns `{"requested_model":"model-A", "observed_model":null, "launch":"launch1", "host_return":"return1"}`. Boundaries: filesystem: saved attempts.

  AC79: Given return1 submitted for a2 instead of bound a1, `bind_host_return` returns `{"code":"host-return-conflict", "return":"return1", "bound_attempt":"a1", "submitted_attempt":"a2"}`. Boundaries: none.

  AC80: Given return1 reused after acceptance for a1, now submitted for a2, `bind_host_return` returns `{"code":"host-return-conflict", "return":"return1", "bound_attempt":"a1", "submitted_attempt":"a2"}`. Boundaries: none.

### Task 3: Record idempotent and late host observations (P9-4-T3)

- **Files:** `crates/cadence/src/review/attempts.rs`, `crates/cadence/src/review/persistence.rs`, `crates/cadence/tests/phase9_observations.rs`, `crates/cadence/tests/fixtures/phase9/h3-observations.json`
- **Action:** Implement record_observation using the same conditional store adapter. Preserve observation IDs and bindings; an identical event replays, conflicting bindings refuse, and late host/model/usage facts enrich the same terminal attempt without changing originals, reopening it, adding a terminal event or billing usage twice. Unavailable usage remains null. Hand-author h3-observations.json with duplicate obs1, late obs2 and terminal a1/o1.

  For AC83, script the real filesystem conditional-commit boundary: the competing identical obs2 image is installed at that boundary, the attempted stale commit loses, and the function reads the saved winner and returns one durable usage observation. This is one direct record_observation invocation with a supplied boundary schedule, not two live workers. Run real in-process Store/recovery logic on the stub Storage image, not a mock of record_observation or its transaction collaborator. Clock is 100. Add observation_ tests after the function exists.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_observations observation_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC81: Given accepted `a1` and duplicate observation `obs1`, `record_observation` returns `{"attempt":"a1", "observation":"obs1", "replayed":true}`. Boundaries: filesystem: saved observation and conditional write; clock: `100`.

  AC82: Given late `obs2` with model `observed-A`, input usage 7, on terminal `a1/o1`, `record_observation` returns `{"attempt":"a1", "terminal_count":1, "original":"o1", "observed_model":"observed-A", "input_usage":7}`. Boundaries: filesystem: append/sync; clock: `100`.

  AC83: Given two identical `obs2` usage observations racing at conditional commit, `record_observation` returns `durable_usage_observation_count = 1`. Boundaries: filesystem: conditional-write barrier; clock: `100`.

### Task 4: Accept unchanged originals and close exactly once (P9-4-T4)

- **Files:** `crates/cadence/src/review/returns.rs`, `crates/cadence/src/review/persistence.rs`, `crates/cadence/tests/phase9_returns.rs`, `crates/cadence/tests/fixtures/phase9/h4-returns.json`, `crates/cadence/tests/fixtures/phase9/original-q.json`
- **Action:** Implement accept_return with the real H4-1 validator, identity/host bindings and conditional persistence. Retain raw input bytes, exact original fields/order, content/record ID, stable original:index finding IDs, schema/validator interpretation and unverified citation sidecar in one durable result-plus-attempt-close transaction. Acknowledge only after confirmed sync; preserve a failed write as unacknowledged. Missing/malformed/failed returns close as their actual failure, retaining known usage, and Plan 3 selection supplies subsequent fallback work. Identical replay returns the original acknowledgment; conflicting content cannot overwrite accepted bytes or add a second terminal outcome.

  Hand-author original-q.json as Q's literal UTF-8 envelope and h4-returns.json as independent pending/accepted/failed-sync input images; preserve quote, newline and Unicode strings exactly. For AC50/AC51, use a scripted filesystem commit barrier with a supplied winning F/a1/o1 durable image, then a stale conditional outcome for the tested submission. Assert one terminal result or the literal conflicting-return respectively. Do not create threads, coordinate task scheduling, sleep, kill/restart a process or submit a workflow to manufacture contention. Direct accept_ tests use real deterministic internals and only filesystem/clock boundaries.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_returns accept_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC5: Given bound attempt `a1` and raw return Q, `accept_return` returns `originals[0].claim = "quote: \"\n雪"`. Boundaries: filesystem: durable write/sync success; clock: `100`.

  AC45: Given pending `a1`, F and a result-store sync failure, `accept_return` returns `{"code":"delivery-write-failed", "attempt":"a1", "acknowledged":false}`. Boundaries: filesystem: fail result sync; clock: `100`.

  AC46: Given accepted `a1/o1`, identical F and lost prior acknowledgment, `accept_return` returns `{"attempt":"a1", "original":"o1", "terminal":"accepted", "replayed":true}`. Boundaries: filesystem: accepted image and conditional writes; clock: `100`.

  AC47: Given accepted `a1/o1` and conflicting claim `Changed`, `accept_return` returns `{"code":"conflicting-return", "attempt":"a1", "original":"o1"}`. Boundaries: filesystem: accepted image, forbid original overwrite; clock: `100`.

  AC50: Given two identical submissions for pending `a1`, with a barrier at conditional commit, `accept_return` returns `durable_terminal_count = 1`. Boundaries: filesystem: conditional-write barrier and durable image; clock: `100`.

  AC51: Given F and conflicting claim `Changed` for `a1`, with F committed first at a boundary barrier, `accept_return` returns `{"code":"conflicting-return", "attempt":"a1", "original":"o1"}`. Boundaries: filesystem: conditional-write barrier; clock: `100`.

### Task 5: Recover interrupted work and per-voice originals (P9-4-T5)

- **Files:** `crates/cadence/src/review/recovery.rs`, `crates/cadence/src/review/originals.rs`, `crates/cadence/tests/phase9_recovery.rs`, `crates/cadence/tests/fixtures/phase9/h3-rosters.json`, `crates/cadence/tests/fixtures/phase9/h4-originals.json`, `docs/architecture/review-lifecycle.md`
- **Action:** Implement recover_attempt, recover_original, read_original, read_roster and read_voice_originals. Supplied durable pending-admission or host-return-before-submission without saved originals becomes interrupted with original null; never invent an empty review or automatically redispatch uncertain work. Read saved originals without their disposable rendering and preserve contract/finding IDs, raw bytes and exact Q strings. Keep A's accepted empty original distinct from B's pending state and keep per-voice original IDs and arrays distinct in panel/adjudicated mode.

  Hand-author h3-rosters.json and h4-originals.json with these saved states, using original-q.json read-only. Each recover_ test starts from its own supplied image, calls only its named production unit and stubs the stated filesystem/clock boundaries. These tests do not run a producer/restart sequence. Document H1–H4 transaction namespace, admission contribution/post-commit API, observation/return operations, replay/closure rules and material storage adapter in review-lifecycle.md. Document the read operations as phase 10's compatibility entry points under the saved H4-1 interpretation, not today's validator defaults.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_recovery recover_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC43: Given durable attempt `a1` in state `pending-admission` without accepted originals, `recover_attempt` returns `{"attempt":"a1", "delivery":"interrupted", "original":null}`. Boundaries: filesystem: supplied durable image; clock: `100`.

  AC44: Given durable attempt `a1` in state `host-return-before-submission` without accepted originals, `recover_attempt` returns `{"attempt":"a1", "delivery":"interrupted", "original":null}`. Boundaries: filesystem: supplied durable image; clock: `100`.

  AC52: Given durable accepted `o1` and missing disposable rendering, `recover_original` returns `{"file":"a.rs", "line":1, "severity":"high", "claim":"C", "failure_scenario":"S"}`. Boundaries: filesystem: durable F, rendering absent.

  AC108: Given saved Q under `o1/H4-1` with IDs `o1:0` and `o1:1`, `read_original` returns `identity = {"original":"o1", "contract":"H4-1", "finding_ids":["o1:0", "o1:1"]}`. Boundaries: filesystem: saved Q.

  AC109: Given saved raw Q, `read_original` returns `findings[0].claim = "quote: \"\n雪"`. Boundaries: filesystem: saved Q.

  AC110: Given saved literal return bytes `{"findings":[]}` under o1, `read_original` returns `raw_bytes = "{\"findings\":[]}"`. Boundaries: filesystem: saved original bytes.

  AC126: Given saved empty A and pending B after a lost process, `read_roster` returns `{"required":["A", "B"], "pending":["B"]}`. Boundaries: filesystem: saved roster.

  AC127: Given A has `o1:[]`, B has `o2:[F]`, `read_voice_originals` returns `{"A":"o1", "B":"o2"}`. Boundaries: filesystem: saved originals.

  AC129: Given committed A/o1 with F and B/o2 with empty findings, `read_voice_originals` returns `findings = {"A":[{"file":"a.rs", "line":1, "severity":"high", "claim":"C", "failure_scenario":"S"}], "B":[]}`. Boundaries: filesystem: saved per-voice originals.

## Requirements mapping

| Requirement | Implementing task |
|---|---|
| AC48 | P9-4-T1 |
| AC49 | P9-4-T1 |
| AC68 | P9-4-T1 |
| AC69 | P9-4-T1 |
| AC70 | P9-4-T1 |
| AC39 | P9-4-T2 |
| AC40 | P9-4-T2 |
| AC78 | P9-4-T2 |
| AC79 | P9-4-T2 |
| AC80 | P9-4-T2 |
| AC81 | P9-4-T3 |
| AC82 | P9-4-T3 |
| AC83 | P9-4-T3 |
| AC5 | P9-4-T4 |
| AC45 | P9-4-T4 |
| AC46 | P9-4-T4 |
| AC47 | P9-4-T4 |
| AC50 | P9-4-T4 |
| AC51 | P9-4-T4 |
| AC43 | P9-4-T5 |
| AC44 | P9-4-T5 |
| AC52 | P9-4-T5 |
| AC108 | P9-4-T5 |
| AC109 | P9-4-T5 |
| AC110 | P9-4-T5 |
| AC126 | P9-4-T5 |
| AC127 | P9-4-T5 |
| AC129 | P9-4-T5 |

## Notes

Run after Plans 1–3, before Plan 5. This plan owns all transactional review persistence and H1–H4 readers. Public store::Storage, CompareTransact and Session::request are the inspected prerequisites; the store and import implementations stay read-only. Tests may use independent outer store framing to supply a durable image, but expected review records and bytes are hand-authored. All-home index and record-update interfaces must be complete here so Plan 5 can add H5 members through the same transaction adapter without extending this lease. Parent allowance, lineage, cross-round settlement and re-arm remain phase 10.

All paths in each task's Files line are exact write leases; their union is the frontmatter files list. Read-only prerequisites and references are not leased. Keep fixture helpers embedded in the owning test target; no shared test helper, generated snapshot, source re-export or fixture path is implicitly writable. No manifest/lockfile or frozen cadence-core edit is planned.

Compilation without overlapping leases: Plans 1–5 implement source files under src/review and compile those actual files using explicit #[path = "../src/review/<module>.rs"] declarations at the root of their own integration-test targets. Declare only existing prerequisite sibling modules there, with sibling imports through super::<module> and existing library imports through cadence::<module>. For private units, put assertions in a child test module of the owning source and select its named test prefix through the same target. Do not create public APIs solely for tests or replace missing production code with test implementations. Plan 6 alone creates src/review/mod.rs and registers the identical module graph in lib.rs; earlier targets remain valid without edits. This is direct compilation of production code, not a suite-inventory or workflow harness. New public visibility is for production sibling/service consumers only.

Each Verify command is an instruction for later implementation execution, from the repository root; none is run during plan authoring. Prefix each direct test name with the listed selector. Each criterion below is a separate invocation on its own hand-authored input; do not chain the assertions into a scenario. Use only its named boundary stubs, call deterministic internals for real, and keep literal expected values independent of production serializers. No model call, live host, cargo regression sweep, concurrency scheduling exercise or manual-checklist substitute belongs to these verifies. AC50, AC51 and AC83 use deterministic filesystem commit schedules, not live races. Keep unimplemented criteria pending until their production unit and direct test exist.

Numeric order is mandatory even though the exact file leases do not overlap. Dependencies live only in these Notes. The rewritten AC1–AC150 numbering is authoritative; former AC numbers in CONTEXT/HANDOFF are historical. MANUAL.md is read-only and none of its items is implemented or discharged by a plan verify. Independently authored fixture files are implementation deliverables for phase 10, not proof of the manual native producer episode.
