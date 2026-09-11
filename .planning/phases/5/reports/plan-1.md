PLAN COMPLETE
Plan: /code/cadence/.planning/phases/5/PLAN-1.md
Tasks: 7 of 7

| Task | Commit | Note |
|---|---|---|
| 1 — Recoverable checkpoint contract | 44ab83ea | Library: 37 passed, including 3 new checkpoint tests. All types/states, exact Unicode/whitespace, missing routing fields, occurrence separation, suite-red semantics and namespace preservation verified. |
| 2 — Guarded evidence transaction | 0ab3b79c | evidence_store: 4 passed. Atomic history/projection reopen, replay without duplicates, changed-content refusal, stale item/snapshot competitors, held confirmation/cancellation and both sync failures verified. |
| 3 — Resident checkpoint service | 724b8220 | Binary: 68 passed; MCP: 4 passed. Real server/resident/session write/read, invalid scope/Need no-write refusal, preserved provenance, canceled reply and closed owner. Public tool list unchanged. |
| 4 — Actual checker results | bf4fc3a6 | Binary: 69 passed. Six result cases retain finding/material fields, narrowed revision diff/prior blockers and spent budget. Second revision and budget refund refuse unchanged. Closed trace alone gives no native verdict. |
| 5 — Gate questions and answers | 13e9b9fa | Binary: 71 passed. Six gate purposes × approve/adjust/stop, plus unanswered state. Wrong question/occurrence, changed prose and superseded answers refuse unchanged. Held answer confirmation supplies no acknowledged acceptance. |
| 6 — Supported contracted acceptance | a2b02a47 | Binary: 74 passed. Three reference forms persist; missing/blank/invalid references and prose-only acceptance refuse unchanged. Checker-linked receipts preserve dispositions. Actual validator-removal mutant fails AC7; restored test passes. Imported opaque trace and legacy Missing/Null/Text remain non-native. |
| 7 — Real process death and recovery | 037f854d | Four child kills assert barriers and SIGKILL; different-reader PIDs and address-only recovery prove exact AC1 fields, AC2 findings/material/revision and AC3 answered/unanswered state. Lost-reply recovery/replay stays one record; never-submitted input stays absent until submitted. After one fixture repair, all 13 service tests and 4 evidence-store tests passed. Final full Cargo run: all 78 binary tests passed. |

Deviations: one verification-only fixture correction, detailed below. No acceptance criterion or locked decision changed.

Open items: one unrelated workspace item. Untracked `docs/diagrams/v4-boundary.mmd` appeared during this dispatch, was not created or staged by it, and was left untouched. No remaining PLAN-1 implementation work and no checkpoint.

## Run details

Starting HEAD `60d94a5a1b36d59dfe49a116f6b6b2073d15442e`, branch `cadence/binary-owns-process`. Sequential PLAN-1 only; PLAN-2, PLAN-3 and PLAN-4 were not started. No override, next-action or pause module was created. No prior report existed to rotate. This report stays uncommitted for the orchestrator.

Every task passed its lease gate and both detected static checks before commit: `cargo clippy --all-targets -- -D warnings` and `npx tsc -p tsconfig.ci.json`. Initial clippy findings in Tasks 3 and 5 were redundant test clones and a collapsible condition; fixed within those tasks, followed by passing targeted tests and static checks. No dependencies installed. Npx used `--no-install`, with unused stdin ignored.

All checks used `TMPDIR=/tmp` outside the repository and cleared `RUSTC_WRAPPER`. Fixtures and child repositories were external temporary directories. No git configuration was changed, no push occurred, and no attribution trailers or authorship marks were added.

## Verification correction and negative controls

[deviation] Task 7's first Verify predicted 78 passing binary tests; observed 75 passed and 3 failed before process barriers. The fixture declared phase 5 planned while phases 1–4 remained unplanned, making phase 1 the actual current phase. Production lifecycle correctly refused with `StateConflict` (`declared: planned`, `derived: unplanned`). The fixture was corrected to give phases 1–4 completed summaries and passing UAT with matching roadmap checkboxes. The first bounded repair passed all 13 evidence-service tests, all 4 evidence-store tests and both static checks. The later full Cargo suite passed all 78 binary tests. Lifecycle code was unchanged; no criterion was relaxed.

Task 6 removed the actual `validate_references` invocation temporarily and ran `ac7_no_reference_refuses_before_native_state_or_history_write`. It failed with `no-reference acceptance must refuse`, as predicted. The source was restored in a finally block and the same test passed. This was an expected negative control, not a regression or suite run.

The closed-bracket fixture filename was corrected from `TRACE.jsonl` to importer-owned `trace.jsonl` in Task 6 and reverified. A separate imported legacy outcome explicitly asserts its decision and source-evidence presence before verifying no native promotion.

## Handoff for later plans

`evidence::Record` carries schema version 1, full `Scope` (project, planning root, cycle, work occurrence, phase, exact plan and report identities), and typed `Fact`. Current facts live under `Snapshot.data.native_evidence`, keyed by scope, fact kind and identity. Native decision history uses an explicit origin/outcome marker and structured serialized evidence; legacy Gate text remains opaque. The store-wide version is unchanged.

`persistence::{project,read,history,decode_history}` perform synchronous validation and projection while preserving every unrelated namespace. `Operation::CompareTransact` checks the expected generation/integrity after recognizing a replay and reuses the existing Transaction fingerprint, journal, confirmations and owner thread. `Session::commit_evidence` recognizes immutable logical receipts before rebuilding a projection, so retries after recovery or later unrelated writes do not append again; changed content under the same operation identity refuses. `commit_derivation` is unchanged. No second writer or production lock was added.

`CadenceServer::evidence(root, Command::{Read,Submit})` goes through the resident to `evidence_service::execute`, invoking the factory directly rather than recursively enqueueing. Submission uses an operation identity and boxed typed Record. Recovery returns validated current records and native history. Reads use verified store data; submissions await their own durable write. Scope must match the selected absolute planning root and its parent project. This is an internal service, with no new MCP registration or model executor.

`Fact::Checkpoint` retains task number/name and byte-exact Need independently of completed-task counts, plus unresolved/resolved/superseded state. Suite-red retains its output reference and has no required operator answer.

`Fact::Checker` retains raw return, pass/fail/unusable disposition, numbered findings, checked paths/content digests, initial/revision attempt, original blockers, narrowed diff and spent budget. `Checker::blockers` exposes remaining blockers. Projection enforces one revision per full work scope and refuses budget refunds. PLAN-2 owns freshness applicability against those observation-time material digests.

`Fact::Gate` carries immutable question/Need/options, optional checkpoint link and explicit unanswered/answered/superseded state. Submit the pending record first, then the identical question with its answer under a new operation identity. The answer retains actual response, selection, adjustments, disposition and optional authorization identity. Wrong/superseded associations and links to suite-red checkpoints refuse.

`Fact::AcceptedResult` requires validated commit, positive file-and-line or nonblank criterion references. Optional checker linkage must name an existing same-scope observation and preserve its disposition. Acceptance supports a contracted return; it does not convert a failed/unusable checker into permission. Reference truth adjudication and repository-wide resolution are outside this plan.

## Final suite and repository evidence

`workflow.test_command` resolved to null through the plugin config CLI. Ran the Cargo workspace suite and the user-specified Node suite once, after Task 7's commit and partial report write.

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`: **168 passed, 0 failed**, exit 0. Library 37, binary 78, derivation consistency 6, derivation inputs 12, evidence store 4, MCP 4, store 17 and crash 10; doc tests 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: **exit 0**, no warnings, before every commit including the final code state.
- `npx tsc -p tsconfig.ci.json`: **exit 0**, before every commit including the final code state.
- `TMPDIR=/tmp node --test`: **exit 0**, full suite passed with ignored stdin. The output wrapper retained failures and TAP totals; this Node reporter emitted neither, so no numeric Node test total is claimed.
- All seven commits verify `G` with key `693AB15F91734B0C`, author `John Crenshaw <john@jcrenshaw.dev>`, one per task in order.
- Frozen `cadence-core/` and `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` are unchanged from the dispatch HEAD (`git diff --exit-code` passed).
- Only this uncommitted report and the unrelated untracked diagram remain outside the committed task changes.
