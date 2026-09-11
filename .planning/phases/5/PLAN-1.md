---
phase: 5
plan: 1
requirements:
  - AC1
  - AC2
  - AC3
  - AC7
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/evidence/mod.rs
  - crates/cadence/src/evidence/checkpoint.rs
  - crates/cadence/src/evidence/checker.rs
  - crates/cadence/src/evidence/gates.rs
  - crates/cadence/src/evidence/results.rs
  - crates/cadence/src/evidence/persistence.rs
  - crates/cadence/src/evidence/tests.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/tests/evidence_store.rs
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/evidence_service.rs
  - crates/cadence/src/evidence_service_tests.rs
---

# Phase 5: The evidence record and what comes next - Plan 1

## Goal

Checkpoint payloads, checker results and gate answers survive conversation loss because the binary records them before continuation relies on them. Accepted contracted results identify their supporting evidence. Establish the internal producer/write/read path that subsequent plans consume.

## Must be true when done

- AC1: After killing a process stopped at a checkpoint, a fresh process recovers its type, current task number and name, and byte-exact Need from disk.
- AC2: Restart retains the checker disposition, blocker/warning findings, unusable-return distinction, checked material and whether its one revision is spent; a trace terminal supplies none of these missing facts.
- AC3: A fresh process reads the question, actual answer and disposition together; an unanswered question remains unanswered.
- AC7: Native acceptance refuses a contracted result without a commit SHA, file-and-line or criterion reference. Legacy opaque evidence remains legacy evidence rather than acquiring native acceptance.
- Native record writes preserve existing snapshot namespaces and import provenance, refuse a stale proposal, and acknowledge only after the existing store confirms the write.
- By Task 3, a checkpoint traverses the actual internal server, resident, session and writer and reads back through that same service. No public MCP tool or host executor is added.

## Context

Phase 5 CONTEXT D-07 through D-12 bind this plan; AC/D ids refer to `.planning/phases/5/CONTEXT.md`, and E ids to the carried audit.
B2 at `.codex-analysis/phase-5-context-analysis.md:133` supplies the producer/consumer and storage map; its missing-source findings are settled.
`Decision::Gate`, `DecisionRecord` and `Snapshot.data` already provide durable capacity; `Session::request` wraps replacements under `current`, while `commit_derivation` preserves full data (`crates/cadence/src/import/mod.rs:402`, `:425`).
Run this plan before PLAN-2, PLAN-3 and PLAN-4; their shared leases are sequential. Phase 6 owns the public tool boundary; phase 4's lifecycle and memo remain unchanged.

## Tasks

### Task 1: Define the recoverable checkpoint contract

- **Files:** `crates/cadence/src/lib.rs` (module exports), `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/checkpoint.rs`, `crates/cadence/src/evidence/persistence.rs`, `crates/cadence/src/evidence/tests.rs`
- **Action:** Create a synchronous domain module for versioned native evidence, beginning with the checkpoint contract. Retain project/planning-root and cycle/work-occurrence identity, phase, exact plan/report identity, checkpoint type, task number and name, exact Need, completed-work references and unresolved/resolved/superseded state. A phase number alone is not a repeated work occurrence. Keep suite-red's failing-output reference and absence of a required human answer. Use typed serialization and validation before native records enter the existing `Snapshot.data` and `DecisionRecord` surfaces; the historical payload can use `Decision::Gate` with versioned structured text in its existing evidence field. Distinguish that native payload from uninterpreted legacy Gate text without changing the store-wide version or retroactively validating old records. Preserve unrelated data when projecting current evidence. Do not infer Current task/Need from report counts or treat an absent record as an answered checkpoint. Existing computation/evidence: `skills/cad-executor-contract/SKILL.md:213`, `:217`, `:270`; `cadence-core/workflows/execute.md:455`; `crates/cadence/src/store/model.rs:69`, `:80`, `:89` (D-07, D-12; E24).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib` runs new checkpoint round-trip and invalid-record cases: every checkpoint type, non-ASCII and whitespace-preserving Need/task names, repeated phase with distinct occurrences, each missing required routing field, and suite-red retaining its output reference without requiring an operator answer. The same projection preserves seeded derivation/import/cursor and arbitrary unrelated keys. Zero new assertions is not verification; no test may derive task identity from a completed-task count.

### Task 2: Commit evidence history and current state as one guarded write

- **Files:** `crates/cadence/src/store/writer.rs` (`Operation`, `Writer::execute`), `crates/cadence/src/import/mod.rs` (`Session::request`, `Session::commit_derivation`), `crates/cadence/tests/evidence_store.rs`
- **Action:** Extend the existing owner-serialized operation path so an evidence update can append decision history and replace its current-state projection together, conditional on the checked `View` generation and integrity. Reuse `Transaction` and its existing journal, confirmation and operation-identity behavior; do not create a second writer or add locks. Add a session entry for this full-data operation that refreshes config and preserves the import manifest, source_evidence, archive, raw cursor, lifecycle memo/intake and all unrelated data. Do not send full data through `Session::request`'s `current` wrapper or weaken `commit_derivation` to authorize evidence changes. A stale proposal refuses before mutation; retries of an already-recorded logical input return its recorded outcome without adding another history entry, while identity reuse with changed content refuses. Preserve the existing transaction fingerprint/recovery distinction between logical content and attempt preconditions. Evidence: `crates/cadence/src/store/writer.rs:203`, `:217`, `:244`, `:308`; `crates/cadence/src/store/transaction.rs:17`, `:27`; `crates/cadence/src/import/mod.rs:402`, `:425` (D-12).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test evidence_store` proves one acknowledged update exposes both history and projection after reopen, an intervening item or snapshot update makes the proposal stale without erasing the winning write, and replay adds no duplicate. Reusing an identity with changed content refuses. Hold `Stage::Confirmation` and assert the caller remains pending; inject `Stage::TemporarySync` and `Stage::DirectorySync` failures and assert no success, following the real behavior at `crates/cadence/tests/store.rs:91` and `:121`. Recovery may complete an admitted unacknowledged transaction; do not assert unconditional rollback after persistence starts.

### Task 3: Wire checkpoint recording through the resident service

- **Files:** `crates/cadence/src/server.rs` (`CadenceServer`, internal impl), `crates/cadence/src/recall/mod.rs` (`resident::Request`, `Resident::spawn_with_driver`), `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`, `crates/cadence/src/evidence/persistence.rs`
- **Action:** Connect typed checkpoint submission and verified recovery to the existing internal `CadenceServer` and `Resident` request owner, using `SessionFactory::first_touch` and Task 2's session write. Include the new binary adapter/tests from server.rs by the existing explicit-path pattern. The pure record transformation receives data; blocking observation stays at the adapter edge. Await validation, the guarded transaction and its own confirmation before returning the recovered fact. Add cancellation/closed-channel handling consistent with existing requests. Do not enqueue a second request onto the resident from inside its own handler and wait for it; invoke the underlying service with the factory directly, as the lifecycle handler does. Keep the public tool router unchanged. First-touch import is a separate existing write; initialize fixture stores before measuring no-write refusal. This is the working checkpoint path, not a test-only producer (`crates/cadence/src/server.rs:58`, `:67`; `crates/cadence/src/recall/mod.rs:208`, `:332`; `crates/cadence/src/import/mod.rs:519`; D-07, D-12).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` exercises the new internal server submission/read through the resident and real session, rejects an invalid checkpoint without native evidence changes, preserves provenance and handles a canceled reply without canceling admitted persistence. The test calls the production adapter rather than directly seeding JSON. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` retains the existing public tool-list assertion; phase 5 adds no tool registration.

### Task 4: Record actual checker results

- **Files:** `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/checker.rs`, `crates/cadence/src/evidence/persistence.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Extend the established producer/read path with typed checker results, preserving raw verdict, pass/fail disposition, numbered findings with blocker/warning severity, location, claim and fix, and an explicit unusable-return state. Retain checked material identities/content evidence, initial versus narrowed revision attempt, previous blocker list, remaining blockers and whether the one revision is spent. Bind observations to their work occurrence, not the latest phase-wide text. A warning-only result allows continuation without spending a revision; a blocker result fails and an empty/unmarked return is unusable, not a pass. Preserve the original result when a later override is recorded. Store observation-time checked material so PLAN-2 can enforce D-06 freshness; do not use lifecycle's memo hash, which excludes PLAN bodies. Do not manufacture a result from a closed trace bracket. Frozen verdict computation is `cadence-core/workflows/plan.md:417`, `:427` and `cadence-core/references/plan-revision.md:30`, `:34`, `:65` (D-08; E37-E38).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` records and reopens pass, warning-only, blocker, mixed and unusable results through the production service. Assertions distinguish all outcomes, preserve every finding and checked input, and retain spent revision after reopening. A closed-bracket-only legacy fixture must yield no native checker verdict. A second revision request for the same exhausted occurrence refuses rather than resetting its budget.

### Task 5: Persist questions and their actual answers

- **Files:** `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/gates.rs`, `crates/cadence/src/evidence/persistence.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Add native question and answer inputs to the same service. Persist exact question/Need/options and scope before presenting a pending gate; bind selected option, free-text adjustments, acceptance/stop disposition and any authorization identity to that question. Missing answer remains unanswered. Refuse an answer naming a different or superseded question, and retain the historical answer when later work asks something similar. Persist acceptance before continuation relies on it. Do not make the normal suggestion itself an acceptance or auto-answer suite-red. Cover structural approve/adjust/stop, decision/blocked answers, unusable-check proceed/stop, and progress Continue now/Stop here with one question/answer information contract. Evidence: `cadence-core/workflows/execute.md:448`, `:455`; `cadence-core/workflows/plan.md:439`; `cadence-core/workflows/progress.md:233`, `:257` (D-09; E65).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` writes answered and unanswered questions through production entry points, reopens the service, and asserts exact question, options, answer and disposition or explicit unanswered state. Same prose under another occurrence cannot reuse the answer; a rejected association leaves the persisted question unchanged. Holding confirmation leaves the answer request pending and supplies no accepted continuation.

### Task 6: Refuse unsupported contracted acceptance

- **Files:** `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/results.rs`, `crates/cadence/src/evidence/persistence.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Put acceptance validation on the native contracted-result producer, before its state/history write. Require at least one explicit relevant reference of the locked forms: commit SHA, file plus positive line, or nonblank criterion ID. Preserve the submitted references for readback and reject empty or unusable reference entries rather than counting an arbitrary prose evidence string. A reference identifies support; this phase does not adjudicate the truth of model-generated claims or add a repository-wide reference resolver. Apply this requirement to new accepted contracted results, not every old imported Gate record and not a pending question. Integrate with checker acceptance while retaining warning/blocker/unusable distinctions. Evidence: `.planning/ROADMAP.md:556`; `crates/cadence/src/store/model.rs:13`, `:69`; Phase 5 D-10.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` submits accepted results with each permitted reference kind and observes durable readback. Empty collections, blank IDs, missing file/line, and a tag plus free prose but no reference are refused before native state/history changes. Existing legacy `Evidence::Missing`, `Null` and uninterpreted text still import/read without being promoted to accepted native results. Removing the acceptance validator must make the no-reference case fail (AC7).

### Task 7: Prove evidence recovery after process death

- **Files:** `crates/cadence/src/evidence_service_tests.rs`, `crates/cadence/tests/evidence_store.rs`
- **Action:** Add real child-process tests using the existing binary-test child pattern and real store probes. In one child, call the production checkpoint producer, wait for acknowledged pending-checkpoint state, then block while still at the checkpoint. The parent kills it and starts a different child with only the planning-root address. Read via production recovery and compare all AC1 fields, including exact Need. Use fresh children for checker results and answered/unanswered gates too. Exercise retry after an admitted write loses its reply; distinguish this from an input never recorded. Seed unrelated lifecycle memo and import data and retain them throughout. Model dispatch is not simulated; only durable records and deterministic read/validation behavior are under test. Existing process-kill mechanics are `crates/cadence/tests/store_crash.rs:86`, `:128`; internal fresh-process composition is `crates/cadence/src/derivation_service_tests.rs:477`, `:508` (AC1-AC3; D-12).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` runs a parent assertion that the checkpoint child actually reached its barrier, died by process kill, and was replaced by a fresh reader with no answer/Need supplied in arguments or environment. Readback satisfies AC1, AC2 and AC3 and replay leaves one logical record. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test evidence_store` passes its stale-write and acknowledgement cases. A same-process reopen or direct JSON seed cannot discharge AC1.

## Notes

- Ownership: AC1 is proved by Tasks 1, 3 and 7; AC2 by Tasks 4 and 7, with changed-material applicability added in PLAN-2; AC3 by Tasks 5 and 7; AC7 by Task 6. D-07 through D-12 are implemented here; PLAN-3 consumes these records without changing phase 4's bounded lifecycle.
- Structure: execute PLAN-1 -> PLAN-2 -> PLAN-3 -> PLAN-4. These are dependency-ordered, shared-file plans, not parallel slices. The dispatch explicitly authorizes additional sequential plans under the eight-task ceiling, overriding the cached contract's independent-only split rule. No deviation from the owner's multiple-plans/same-phase directive is taken.
- The new `evidence/` files and service files do not exist at planning time. Their names declare leases, not pre-existing symbols or guessed signatures. Existing write targets were opened: lib.rs, writer.rs, import/mod.rs, server.rs and recall/mod.rs. Later plans must inspect these implemented handoffs before editing them. No dependency or manifest change is needed; existing serde, serde_json, sha2, tokio and tempfile cover this plan.
- All checks run from `/code/cadence`; use `RUSTC_WRAPPER=` because sccache is denied and keep `TMPDIR=/tmp` outside the repository. The final phase check in PLAN-4 also runs `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`, `npx tsc -p tsconfig.ci.json` and `TMPDIR=/tmp node --test`. All seven ACs are machine-checkable. Cargo target syntax was checked against the current Cargo documentation through Context7: https://doc.rust-lang.org/cargo/commands/cargo-test.html.
- The required project guide files are PROJECT, REQUIREMENTS, ROADMAP and Phase 5 CONTEXT; this checkout has no CLAUDE.md and requires none. Fixtures and subprocess repositories belong under external temporary directories. Do not edit frozen `cadence-core/`, planning cursor/roadmap/requirements or add attribution trailers. This plan reports required future verification, not checks run during planning.
