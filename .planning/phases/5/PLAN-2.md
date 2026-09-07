---
phase: 5
plan: 2
requirements:
  - AC2
  - AC4
files:
  - crates/cadence/src/evidence/mod.rs
  - crates/cadence/src/evidence/overrides.rs
  - crates/cadence/src/evidence/authority.rs
  - crates/cadence/src/evidence/material.rs
  - crates/cadence/src/evidence/persistence.rs
  - crates/cadence/src/evidence/tests.rs
  - crates/cadence/src/evidence_service.rs
  - crates/cadence/src/evidence_service_tests.rs
---

# Phase 5: The evidence record and what comes next - Plan 2

## Goal

An operator exception remains usable after restart for exactly the work it authorized. One durable override contract retains the four frozen meanings, while changed checked material requires a fresh verdict or an explicit recorded override.

## Must be true when done

- AC4: Rerun, checker bypass, paused Next and review override use one native record contract with reason, occurrence and durable readback.
- Review settlement retains both range endpoints, finding relationships and authorization identity; one answer spanning two ranges remains two receipts, not wider permission.
- An override authorizes its still-pending occurrence after restart, stops authorizing once fulfilled or superseded, and remains available as history.
- The exact pause sentence survives as its own action; saving the pause does not itself fulfill the still-pending resume occurrence.
- AC2/D-06: A changed checked plan leaves the prior verdict visible as history but inapplicable to continuation until a fresh check or explicit recorded override exists. Neither restart nor edits refund a spent revision.

## Context

Phase 5 CONTEXT D-02, D-03, D-05 and D-06 are locked; B3 at `.codex-analysis/phase-5-context-analysis.md:149` enumerates the four authorities and their fields.
PLAN-1 supplies typed evidence validation, the checked history/state transaction and the internal producer/read service; inspect that implemented handoff before editing it.
Existing review receipt scope is `cadence-core/references/triage-gate.md:105`, `:111`, `:120`; legacy originals already survive in `SourceEvidence` (`crates/cadence/src/import/mod.rs:20`).
This plan runs after PLAN-1 and before the selector in PLAN-3. It does not add public dispatch, reopen lifecycle conflicts or alter the frozen workflows.

## Tasks

### Task 1: Record the four override meanings through one contract

- **Files:** `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/overrides.rs`, `crates/cadence/src/evidence/persistence.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Add one versioned override information contract and connect submission/readback through PLAN-1's real service. Require the operator's nonblank reason, named work occurrence, scope and originating question/answer or explicit invocation authorization. Represent the four spellings without inventing new lifecycle statuses: rerun means all admitted plans of the selected run; bypass identifies the skipped check or actual failed/unusable result being bypassed; paused Next retains the exact one-line sentence, applicable phase and pending resume; review retains a range-specific receipt. Keep outcome and exception separate so bypass cannot rewrite fail as pass. Configuration disabling a check is policy rather than an invented operator answer. A requested pause may carry its own sentence as the operator-supplied reason when explicitly used that way, but do not generate a historical reason for a legacy cursor. Evidence: `cadence-core/workflows/execute.md:25`; `cadence-core/bin/planning/replay-check.mjs:50`; `cadence-core/workflows/plan.md:29`, `:381`, `:439`; `skills/cad-pause/SKILL.md:38`; B3 (D-02, D-05).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` writes and reopens all four forms through the same native entry point, rejects absent/blank reasons without changes, and preserves exact pause text and explicit bypass outcome. A rerun record identifies every admitted plan even when reports are already complete. Unset invocation flags or durable config alone produce no override record. New library round trips also pass under `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib`.

### Task 2: Preserve review receipt identity during consolidation

- **Files:** `crates/cadence/src/evidence/overrides.rs`, `crates/cadence/src/evidence/persistence.rs`, `crates/cadence/src/evidence/tests.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Carry both review range endpoints, trigger, plan scope when applicable, occurrence/correlation, round, anchor when present, finding-record reference, settled counts and authorization identity through the unified record. Keep the operator's reason verbatim. One answer covering two ranges has two receipts sharing the answer identity; each receipt still binds its own endpoints. Preserve the distinction between receipt counts and the full finding record. Retain already-recorded legacy review evidence and its original bytes through the existing import provenance; do not require the current import translator to have turned ordinary override events into native Gate outcomes. If exposing a legacy receipt through compatibility intake, preserve only its actually recorded fields and historical scope, without fabricating a reason, authorization ID or missing endpoint. Apply required native fields to new native receipts. Evidence: E41-E42; `cadence-core/references/triage-gate.md:105`, `:111`, `:120`; `cadence-core/bin/planning/risk-check.mjs:945`, `:990`; `crates/cadence/src/import/mod.rs:20`, `:338`; `.codex-analysis/phase-5-context-analysis.md:160`.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` persists two receipts for different base/head pairs under one authorization identity and reopens both unchanged, including reason, findings reference and optional metadata. A receipt for B..C must not settle A..C or another plan/trigger. A missing native reason or endpoint refuses. Legacy source bytes and established historical receipts remain readable without being rewritten or promoted into wider permission. Merely retaining aggregate counts cannot satisfy the finding-reference assertions (AC4).

### Task 3: Limit active permission to the named occurrence

- **Files:** `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/authority.rs`, `crates/cadence/src/evidence/overrides.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Add a pure applicability decision over persisted occurrence state and overrides, and wire its read through the internal evidence service. Fulfillment/supersession is an explicit scoped transition through the existing guarded write, retaining both the transition history and the original answer. An unchanged pending occurrence keeps permission across restart; a later occurrence, even with the same phase/plan and wording, needs a fresh answer. For pause, distinguish completing preservation from fulfilling the resume instruction: committing the resume record leaves that resume pending. Keep historical settlement of an already-reviewed range available after the work occurrence ends; historical settlement does not become authority to rerun unrelated work. Do not expire by session lifetime, elapsed time or broad phase completion alone. Do not make any override suppress phase 4's derivation/state conflict. These are owner decisions at `.planning/phases/5/CONTEXT.md:88`, `:205`, informed by `cadence-core/workflows/execute.md:25` and `cadence-core/references/triage-gate.md:111` (D-03, D-11).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` grants an occurrence, restarts, and obtains permission for the same pending occurrence; after fulfillment and separately after supersession it obtains no active permission while retaining history. A second occurrence with the same phase/plan is not authorized. Saving a pause leaves its resume permission pending, and completing that resume ends it. Existing range-settlement history stays queryable. The assertions call production applicability and the real record service, not a test-only lifetime rule (AC4).

### Task 4: Invalidate verdict applicability when checked material changes

- **Files:** `crates/cadence/src/evidence/mod.rs`, `crates/cadence/src/evidence/material.rs`, `crates/cadence/src/evidence/authority.rs`, `crates/cadence/src/evidence_service.rs`, `crates/cadence/src/evidence_service_tests.rs`
- **Action:** Compare the checker record's observation-time checked-material identities and bytes/digests with fresh reads of that same material. Keep this evidence outside phase 4's lifecycle capture/hash, which deliberately excludes PLAN bodies. The pure applicability decision consumes observations; filesystem reads and their failure distinction stay in the adapter. A changed checked plan requires a fresh applicable result or an explicit recorded override for that changed work; a bypass for an older occurrence/material cannot silently clear it. Preserve the old verdict as history and the spent revision across edits/restarts. A failed read supplies no current approval. Respect the initial full input set versus the narrowed revision diff and blocker list instead of claiming the second check examined everything again. Evidence: `cadence-core/workflows/plan.md:407`; `cadence-core/references/plan-revision.md:34`, `:65`; `.planning/phases/4/CONTEXT.md:117`; `.planning/phases/5/CONTEXT.md:139` (D-06, D-08).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` records a checked plan, restarts, and initially finds its verdict applicable; changing its body while retaining its PLAN filename leaves the old result readable but makes continuation ineligible. A fresh result for changed material or explicit corresponding override permits it. A wrong-occurrence override does not. Injected read failure never reuses the earlier approval. A spent revision stays spent under every edit/restart case. Do not assert lifecycle status changes for a PLAN-body edit: the opened `derive` at `crates/cadence/src/derivation/mod.rs:63` reads admitted names, SUMMARY presence and UAT, not that body.

### Task 5: Prove authority survives restart without widening

- **Files:** `crates/cadence/src/evidence_service_tests.rs`, `crates/cadence/src/evidence/tests.rs`
- **Action:** Extend PLAN-1's child-process harness with all four override forms, shared authorization over distinct review ranges, pending/fulfilled/superseded occurrences and changed checked material. Let children call the actual internal producer and applicability consumer; the reader receives only the root and the identity it is querying. Exercise a lost reply followed by the same logical submission, and confirm no duplicate grant or restored expired permission. Keep imported pause provenance and unrelated lifecycle memo data unchanged. Tests assert schema, scope and transitions rather than whether an authored engineering opinion is correct, consistent with `.planning/ROADMAP.md:175` (AC2, AC4; D-02, D-03, D-05, D-06, D-12).
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` runs fresh-child authority cases and proves durable reasons, exact scope, retained history, exhausted permission and verdict freshness. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib` retains all record-validation cases. A test-only broad phase-wide grant or automatic reuse of the old verdict must fail the same applicability assertions; none of those controls enters production code.

## Notes

- AC4 is covered by every task; AC2 is carried for Tasks 4-5's applicability and spent-revision proof. PLAN-1 already supplies checkpoint, checker, question/answer and accepted-evidence records; PLAN-3 must consume these implemented results, not duplicate their decision rules.
- Execute after PLAN-1 and before PLAN-3. Shared evidence/service leases are intentional sequential dependencies, authorized by the dispatch's eight-tasks-per-plan rule. No independent/parallel execution is claimed and no deviation from the multiple-plans directive is taken.
- New paths here are overrides.rs, authority.rs and material.rs. Other leases are explicit PLAN-1 outputs and must be opened after that prerequisite lands. The existing storage surfaces and source-provenance implementation were read; no native function names or signatures are prescribed for files not yet implemented.
- Run every Cargo check with `TMPDIR=/tmp RUSTC_WRAPPER=`; sccache is denied, and temporary repositories must live outside this checkout. The phase's final checks are `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`, `npx tsc -p tsconfig.ci.json` and `TMPDIR=/tmp node --test`, owned by PLAN-4. No tool in these checks needs a human-only verification tag.
- No runtime invocation of frozen JS, public tool, review-provider dispatch, new lifecycle vocabulary or historical-answer fabrication belongs here. The required context is in the cited planning files; no CLAUDE.md exists or is required. Add no attribution marks, and keep cursor/roadmap/requirements and frozen sources outside the write lease.
