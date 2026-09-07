---
phase: 5
plan: 3
requirements:
  - AC1
  - AC2
  - AC3
  - AC4
  - AC5
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/next_action/mod.rs
  - crates/cadence/src/next_action/observations.rs
  - crates/cadence/src/next_action/select.rs
  - crates/cadence/src/next_action/continuation.rs
  - crates/cadence/src/next_action/tests.rs
  - crates/cadence/tests/next_action.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/derivation_service.rs
  - crates/cadence/src/next_action_service.rs
  - crates/cadence/src/next_action_service_tests.rs
---

# Phase 5: The evidence record and what comes next - Plan 3

## Goal

The binary selects the frozen progress answer and determines the selected work's continuation from recorded checkpoints, checker results, answers and overrides. Its oracle is an authored set of states exercising the nine prose rules, independent of the selector implementation.

## Must be true when done

- AC5: Every authored winning-rule case and adjacent-rule precedence pair below returns the literal answer specified by the frozen table, including the exact free-text resume instruction.
- AC1-AC4: After restart, continuation uses the recorded task/Need, actual checker verdict and revision budget, gate answer and occurrence-scoped override; missing evidence is never invented.
- A suggestion and permission to invoke it remain distinct. An unanswered gate waits, an answered stop stops, and a scoped acceptance permits only its named continuation.
- Extra routing observations come from their actual report, queue, directory and effective-config sources; they do not become extra lifecycle statuses or lifecycle memo inputs.
- Both warm and cold lifecycle conflicts prevent successful selection; a retained historical pause cannot suppress them or reactivate the retired cursor assertion.

## Context

Phase 5 CONTEXT D-01, D-05, D-06, D-09, D-11 and D-13 bind selection; PLAN-1 and PLAN-2 must already provide their real record producers and applicability reader.
B1 at `.codex-analysis/phase-5-context-analysis.md:96` supplies the ordered rules and each input source; B2 supplies continuation facts. These inventories are carried forward.
`derive` supplies only `Lifecycle` (`crates/cadence/src/derivation/mod.rs:63`); `derivation_service::query` composes consistency, memo and store guards (`crates/cadence/src/derivation_service.rs:68`). Reuse that composition.
The golden comparison was removed in `7d64c4c9`; fixture bundles are not expected answers (`.planning/phases/2/SUMMARY.md:61`). Phase 6 owns public registration and host dispatch.

## Tasks

### Task 1: Capture the additional routing observations

- **Files:** `crates/cadence/src/lib.rs` (module exports), `crates/cadence/src/next_action/mod.rs`, `crates/cadence/src/next_action/observations.rs`, `crates/cadence/tests/next_action.rs`
- **Action:** Add the separate read-only routing observation layer from B1, consuming the already-derived ordered phase IDs and admitted PLAN names. Read only each exact current `reports/plan-k.md`, where bare PLAN.md maps to 1; complete means the trimmed first line is exactly PLAN COMPLETE. Missing/unreadable/other status means outstanding, and rotated reports cannot decide it. Capture deferred membership/unreadability from both phases and deferred homes using the frozen queue identity/type rules; a regular matching adjudication sibling suppresses a valid member without parsing the sibling's contents. Retain unreadability rather than zeroing it. Capture closed-cycle residue using the legal phase-name grammar and keep this distinct from lifecycle state. Keep root/path resolution explicit and filesystem I/O behind a synchronous boundary. Do not widen `ArtifactIo`, `CapturedInputs` or the lifecycle key merely to store these extra observations. Computations opened: `cadence-core/bin/planning/core.mjs:345`, `:358`, `:966`, `:1024`, `:1042`; `cadence-core/bin/planning/status.mjs:177`; existing capture boundary `crates/cadence/src/derivation/capture.rs:8`, `:124` (D-11, D-13; E06, E17-E20).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test next_action` covers exact versus rotated reports, missing/unreadable reports, trimmed PLAN COMPLETE versus other first lines, both queue homes, malformed members, directory/member symlinks, unreadable homes, and valid-member suppression by a regular adjudication sibling even with malformed sibling contents. Missing homes are empty; unreadable homes remain explicit. A closed roadmap with legal phase residue produces the residue input, while an ordinary live phase directory does not. Assertions concern this opened observation computation, not guessed phase status.

### Task 2: Implement the pure first-match selection table

- **Files:** `crates/cadence/src/next_action/mod.rs`, `crates/cadence/src/next_action/select.rs`, `crates/cadence/src/next_action/tests.rs`
- **Action:** Implement synchronous selection over `Lifecycle`, the separate observations, an applicable pause and effective workflow.skip_discuss. Preserve exactly the nine answers at `cadence-core/workflows/progress.md:194-202`, in that order: matching pause; lowest planned; lowest executed named in outstanding; lowest executed; current unplanned with the config alternative; nonzero/unreadable queue; phase-dir residue; closed cycle; null current. Scan all phases for the planned/executed rules. Retain a resume sentence as its own action without requiring a command parser. Queue triage is its own answer and never cad-land. Translate native `Cycle::Closed` to the frozen cycle:none condition without adding statuses. Author the explicit expected-answer fixtures in Notes before comparing the production selector; never use the selector or a second implementation to compute expectations. Code/evidence: `cadence-core/workflows/progress.md:194`, `:204`, `:221`, `:225`; `crates/cadence/src/derivation/model.rs:6`, `:15`, `:61` (D-01, D-05, D-13).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib` runs all nine named winning-rule cases and all eight named adjacent pairs from Notes, reporting a missing case as failure. The two planned/executed candidates in P23 must return execute 2, and P34 must select the outstanding executed phase 2 rather than verify phase 1. Include both skip_discuss values and an unreadable queue with zero findings. Swapping each adjacent rule in test-only negative controls must fail its paired fixture; equal command spellings must still compare the selected phase or exact resume text. No production code receives test-only mutation switches (AC5).

### Task 3: Connect selection to verified lifecycle and store inputs

- **Files:** `crates/cadence/src/server.rs` (`CadenceServer`, internal impl), `crates/cadence/src/recall/mod.rs` (`resident::Request`, `Resident::spawn_with_driver`), `crates/cadence/src/derivation_service.rs` (`query`), `crates/cadence/src/next_action_service.rs`, `crates/cadence/src/next_action_service_tests.rs`
- **Action:** Add the internal next-action request to the existing resident and server, using the same `SessionFactory`, verified store view and active config generation. Reuse the lifecycle preparation/consistency/memo/recheck composition; factor its internal adapter if the selector needs its checked capture, keeping the public `Lifecycle` answer and existing lifecycle method behavior unchanged. Acquire workflow.skip_discuss explicitly from `Session::config` and `config::merge::get`; do not read retired config directly or rely on a conversation value. Read the native pending pause from PLAN-2, or preserved valid legacy pause provenance when no native occurrence supersedes it. Retirement makes the cursor assertion historical; it does not erase its resume text. Recheck consumed observations/config/store state before publishing an answer so one request does not combine changed inputs. Keep that consistency check outside the lifecycle hash. Return lifecycle/derivation/store failures without overriding them. Dispatch internally through the factory rather than recursively awaiting the resident queue. Evidence: `crates/cadence/src/derivation_service.rs:75`, `:89`, `:106`, `:116`; `crates/cadence/src/derivation/intake.rs:65`, `:95`; `crates/cadence/src/import/mod.rs:397`; `crates/cadence/src/config/merge.rs:158`; `crates/cadence/src/config/reload.rs:122` (D-05, D-11, D-13).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` calls production internal selection against real planning trees, native records and repo/global config. Switching effective skip_discuss switches only the unplanned answer; an unavailable controlling config yields no successful selection. Seed cold and warm declaration/memo conflicts through the real store and assert selection does not suppress them, even with a pause or override. Reordering directory observations must not change the winning numeric phase. Inject a consumed-input change and assert no successful mixed-input answer. Existing lifecycle service tests continue to pass. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` still lists exactly cadence_version (`crates/cadence/tests/mcp.rs:154`).

### Task 4: Select the recorded continuation of named work

- **Files:** `crates/cadence/src/next_action/mod.rs`, `crates/cadence/src/next_action/continuation.rs`, `crates/cadence/src/next_action_service.rs`, `crates/cadence/src/next_action_service_tests.rs`, `crates/cadence/src/next_action/tests.rs`
- **Action:** Wire the selected work's continuation to PLAN-1's recovered records and PLAN-2's applicability decision. Keep the normal progress answer from Task 2 intact; continuation is the separate decision for an explicitly selected work occurrence, not extra predicates inserted above the frozen nine rules. Select the unresolved checkpoint's type/task/Need, wait for its unanswered operator gate, retain an answered stop, or continue with its recorded answer. Suite-red carries its failing-output reference without an invented question. A checker blocker, unusable return or stale checked material requires the corresponding existing revision/check/answer or applicable override; warnings alone neither block nor spend a revision. An accepted suggestion can authorize only the same work occurrence; absence of acceptance does not invoke it. Rerun covers all admitted plans, bypass preserves the failed result, and expired/superseded overrides grant nothing. Use the existing record producer for a new pending question or consumed/fulfilled transition rather than constructing unpersisted permissions. Evidence: B2/B3; `cadence-core/workflows/execute.md:442`, `:448`, `:455`; `cadence-core/workflows/plan.md:427`; `cadence-core/references/plan-revision.md:65`; `cadence-core/workflows/progress.md:233`, `:239` (D-03, D-06 through D-09, D-13).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` seeds facts through the production producers, restarts and calls the production continuation consumer. Assert exact checkpoint task/Need; unanswered wait versus answered stop versus accepted continuation; suite-red without a question; warnings without revision spend; blockers and unusable results retaining their actual disposition; changed material requiring fresh check/override; and a fulfilled/superseded or wrong-occurrence grant authorizing nothing. A normal suggestion alone must produce no invocation or consumed permission. The nine normal answers remain identical with and without unrelated continuation history (AC1-AC5).

### Task 5: Prove the authored oracle through fresh-process selection

- **Files:** `crates/cadence/src/next_action_service_tests.rs`, `crates/cadence/tests/next_action.rs`, `crates/cadence/src/next_action/tests.rs`
- **Action:** Build real artifact fixtures for the authored states below and assert them through the internal binary service in fresh children. Compute their lifecycle using production derivation, but keep each expected next answer as an authored literal from the frozen prose. Set checkboxes consistently with the intended complete/incomplete state so phase 4's conflict guard does not invalidate an unrelated routing fixture. An executed phase needs SUMMARY without qualifying UAT; removing reports alone from an archived complete phase cannot make it executed. An all-complete live case needs a nonempty live list with SUMMARY plus qualifying UAT; an empty closed list is a different case. Add consumed-input controls for native and retained legacy pause, unrelated history and reports outside the current phase. Reuse existing child-process and read-denial patterns without adding public commands. Source of derived answers: `crates/cadence/src/derivation/mod.rs:88`, `:100`, `:119`; source of expectations: `cadence-core/workflows/progress.md:194-202`; failure of the old fixture assumption: `.codex-analysis/phase-5-context-analysis.md:206` (AC5; D-01, D-11, D-13).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` proves the authored answers after fresh-process selection and keeps all existing lifecycle conflict/intake tests passing. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test next_action` and `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib` pass the observation and pure-oracle suites, including all eight ordering negative controls. Replacing expected answers with a call to production selection is prohibited; the fixture inventory must fail if any W1-W9 or P12-P89 obligation is removed.

## Notes

- Execute PLAN-1 -> PLAN-2 -> PLAN-3 -> PLAN-4. Shared server/resident and evidence dependencies require sequential execution under the dispatch's explicit rule; no parallel independence is claimed and there is no plan-shape deviation. The next-action files are new leases. Existing lib.rs, server.rs, recall/mod.rs and derivation_service.rs were opened; keep their current callers working. Earlier plans' evidence APIs must be inspected after implementation; their signatures are not guessed here.
- AC5's explicit authored oracle follows. Unmentioned queues are empty/readable, pauses absent, config skip_discuss false and lifecycle declarations consistent. A named executed phase with complete reports still lacks qualifying UAT. All-complete means a live, nonempty complete list. For adjacent pairs, no rule above the named pair applies; other lower rules may apply. Cases may share the same physical state while proving different named obligations.

| Case | Authored condition | Literal expected answer / source |
|---|---|---|
| W1 | Current 1 has a paused Next equal to "verify the fix on the device" | Resume "verify the fix on the device" — progress.md:194 |
| W2 | Phase 1 is planned | /cad-execute 1 — progress.md:195 |
| W3 | Phase 1 is executed with an outstanding plan | /cad-execute 1 — progress.md:196 |
| W4 | Phase 1 is executed with all current plan reports complete | /cad-verify 1 — progress.md:197 |
| W5 | Current 1 is unplanned; exercise skip_discuss false and true | /cad-context 1; /cad-plan 1 respectively — progress.md:198 |
| W6 | Live all-complete with findings; separately zero findings but an unreadable queue home | Triage the deferred queue; never /cad-land — progress.md:199 |
| W7 | Closed cycle with legal phases/1 residue | /cad-milestone — progress.md:200 |
| W8 | Closed cycle with no phase residue | /cad-phase add — progress.md:201 |
| W9 | Live all-complete with no queue | /cad-milestone — progress.md:202 |
| P12 | Current 1 planned and paused at the exact free-text Next | Resume that exact Next — progress.md:194 |
| P23 | Phase 1 executed/outstanding; phase 2 planned | /cad-execute 2 — progress.md:195 |
| P34 | Phase 1 executed/reports complete; phase 2 executed/outstanding | /cad-execute 2 — progress.md:196 |
| P45 | Current 1 unplanned; phase 2 executed/reports complete | /cad-verify 2 — progress.md:197 |
| P56 | Current 1 unplanned with a nonempty queue | /cad-context 1 — progress.md:198 |
| P67 | Closed cycle with a queued finding and legal phase residue | Triage the deferred queue — progress.md:199 |
| P78 | Closed cycle with legal phase residue | /cad-milestone — progress.md:200 |
| P89 | Closed cycle, null current and no phase residue | /cad-phase add — progress.md:201 |

- Every progress.md citation in the table means `cadence-core/workflows/progress.md`. Preserve the triage answer's reference to `cadence-core/references/triage-gate.md`, deferred arm, as B1 states. The 17 surviving golden bundles have no expected-answer side and are not this oracle; D-01 supersedes the roadmap's obsolete golden-harness phrase on evidence.
- Selection consumes lifecycle with its original four statuses, exact memo key and conflict rules. Retained pause provenance is resume data, not a revived writable lifecycle cursor. Observation consistency is a final check rather than an atomic filesystem snapshot. An independently successful lifecycle query may update its memo before a later selection observation fails; do not assert rollback of that separate successful query or of first-touch import.
- All Cargo commands carry `TMPDIR=/tmp RUSTC_WRAPPER=`. Final lint/typecheck/Node validation is in PLAN-4: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`, `npx tsc -p tsconfig.ci.json`, `TMPDIR=/tmp node --test`. No CLAUDE.md exists or is required. No attribution marks, frozen-source writes, cursor edits or new public tool belong to this plan.
