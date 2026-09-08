# Phase 7 PLAN-2 run record

> **Note, 2026-09-08.** This report records a suite run that SKIPPED the ignored
> real-host probe. That probe (`crates/cadence/tests/phase7_live.rs`) has since been
> deleted and its evidence withdrawn phase-wide; see the PLAN-1 and PLAN-4 records.
> Nothing this report claims rested on it, and its counts are unaffected.

Outcome: blocked at P7-2-T3 (B1). Completed prefix: P7-2-T1 and P7-2-T2. P7-2-T4 through P7-2-T6 were not run.
Initial branch: `cadence/binary-owns-process`; initial HEAD: `248bd8c668815e11c23e06cdc70c1d505eb82586`; initial tree clean excluding the concurrently owned `.codex-analysis/`, which was not inspected or changed.
Final committed HEAD: `128921fa1bcdc4a93a863a3d0a4f96414776b8af`. Both task commits have valid GPG signatures (G), using the configured project author and signing configuration. No push.
This report is the owner's explicit exact-path exception to the executor contract's report restriction. It is left uncommitted.

| Task | Status | Full commit SHA | Required verification |
| --- | --- | --- | --- |
| P7-2-T1 | completed | `03bf2649682f398ddb455ca11f19f641c00a3a05` | 6 lease tests and 49 execution library tests passed |
| P7-2-T2 | completed | `128921fa1bcdc4a93a863a3d0a4f96414776b8af` | 9 lease tests passed |
| P7-2-T3 | blocked (B1) | none | 11 lease tests passed, 2 failed; remaining prescribed execution_store check passed all 18 tests |
| P7-2-T4 | not-run | none | not run |
| P7-2-T5 | not-run | none | not run |
| P7-2-T6 | not-run | none | not run |

## B1: new native-writer fixture bypasses required dispatch admission

The first failed task verification was `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease` for T3, exit 101. The two failing tests were `both_writers_refuse_ordinary_new_lockfile_and_report_paths_in_commits_and_index` and `both_writers_require_both_staged_rename_endpoints_and_accept_complete_coverage`. Both failed at `crates/cadence/tests/phase7_lease.rs:636`: expected an undeclared-files refusal, received `Invalid("cross-format native execution resume is unsupported")`.

The new shared fixture is wrong. It directly seeds an execution occurrence with `Operation::RewriteSnapshot` at `crates/cadence/tests/phase7_lease.rs:623`, without a matching native boundary decision. The current writer calls `require_current_execution` before patch admission at `crates/cadence/src/store/writer.rs:515`; that check requires a BoundaryV1 decision for each execution occurrence at `:1247` and rejects the fixture at `:1252`. The legacy-writer iterations complete before the native-writer iteration fails, but the combined tests are failed tests, not proof of both writers.

A continuation should construct the native fixture through `BoundaryChange::Dispatch`, following the existing pattern at `crates/cadence/tests/execution_store.rs:957`, rather than weakening the format guard or the lease assertion. This is a fixture setup defect, not an unsatisfiable plan criterion or a need for an undeclared file. No repair or retry was made after the failure. The repository contract requires stopping task work at the first blocker (`skills/cad-executor-contract/SKILL.md:32`, `:42`). The remaining prescribed T3 verify and mandatory final checks were diagnostic only; no T3 commit was made.

## Completed and pending implementation

T1 adds the sole production `covers()` definition in `execution/lease.rs`. Files remain required and exact; files may be empty when directories is nonempty. Trailing slash and backslash in files refuse before normalization, naming files. Directories normalize to roots with component-boundary coverage, including their roots for structural overlap. Empty total leases, malformed fields, duplicate normalized declarations within each field and excessive total declarations refuse. Admission calls covers. ExecutionPlan and ActiveDispatch carry directories. Empty directories are omitted from plan identity and dispatch serialization, preserving the historical preimage.

T1 tests independently encode the old exact-file fingerprint preimage and ActiveDispatch JSON, verify identical bytes through store reopen, and exercise exact-file and directory-only prompts over public stdio through a server restart. Changed directory coverage changes plan identity. Current official Serde documentation was fetched through Context7 for default/skip_serializing_if compatibility (https://serde.rs/attr-default.html and https://serde.rs/attr-skip-serializing.html).

T2 replaces plain file equality in PlanGraph with shared coverage in both directions over files and directory roots. Tests prove the exact AC4 pair, reversed inputs and plan-number assignments, nested and equal directory roots, file/root overlap, transitive readiness, deterministic selection, and independence of textual prefix collisions and exact-file descendants.

Uncommitted T3 binds the active dispatch lease privately to proposed applications, checks both committed and staged binary-owned observations with covers after the existing shape checks, and aggregates complete undeclared observations into typed error evidence. Both writer APIs accept staged paths separately from executor patches. Historical empty-staged operation serialization is preserved; accepted receipt replay skips new coverage enforcement. Tests cover aggregate evidence, malformed observations, historical receipts, committed/staged ordinary/new/report/lockfile paths, blocked prefixes and staged rename endpoints. The new native-writer fixture still needs the B1 correction before that test coverage can be claimed.

The service has only the T3 API wiring and still supplies an empty staged set. Actual Git staged reads, explicit rename/merge observation, durable complete refusal evidence, bounded refusal reasons and corrected-resubmission recovery remain T4/T5 work. No AC5/AC6 completion is claimed. Planner/checker guidance and ROADMAP are unchanged because T6 was not reached.

## Required suite and final checks

The exact supplied suite was invoked once. It exited 101 in workspace tests: the library target passed 104; the binary target passed 140 and failed 8. Total reached: 244 passed, 8 failed. Cargo stopped before the integration targets, and the `&&` chain did not invoke Clippy or fmt. The two new T3 failures were observed in the task verification, not reached in this suite.

All eight suite failures are existing execution-service cases or inventories that expected acceptance of fixture commits. Their helper commits `work/{name}.txt` (`crates/cadence/src/execution_service_tests.rs:229`), while plans commonly declare `src/a.rs` (`:407`). The new enforcement correctly refuses those paths, so acceptance and downstream persistence-barrier assertions fail (`:414`, `:750`, `:1451`). PLAN-2 T4 explicitly assigns the fixture lease corrections; it was not started. No assertion was weakened.

Clippy was run separately after the suite's test failures were visible. It exited 101 on `clippy::large_enum_variant` at `crates/cadence/src/recall/mod.rs:205`: Request's Store variant is at least 528 bytes versus Pause's 304. The expanded execution/store types increase the enclosing operation size. This additional diagnostic is not repaired. `recall/mod.rs` is outside the lease; a continuation must keep the operation compact within leased types rather than edit the unleased consumer or suppress the warning. The diagnostic has not been isolated between the completed prefix and pending T3 edits.

`cargo fmt --check` separately exited 0 with no output. `TMPDIR=/tmp npx tsc -p tsconfig.ci.json` exited 0 (two normal npm invocation notices). All command subprocesses used ignored stdin; test TMPDIR was /tmp and the Rust wrapper was cleared.

Predictions were stated before task verifies and final checks. T1's 6 and 49 tests and T2's 9 tests matched. T3 predicted 13 lease tests passed; actual was 11 passed / 2 failed. The remaining execution_store prediction passed (18 tests). Workspace failure was predicted from the existing fixture mismatch and occurred. Formatting and typecheck predictions passed; the Clippy-pass prediction was wrong.

## Plan and code observations

- T1 explicitly requires directories in the binary prompt but omits `execution_service.rs` from its task-local Files bullet. That file is in the exhaustive plan frontmatter lease. Its minimal prompt edit was necessary for T1 and committed there; existing exact-file prompt text was preserved. The T3 API wiring also touches this globally leased caller so the staged-parameter change compiles.
- The current native writer requires a durable matching boundary decision; the new T3 fixture overlooked it. The production format check is authoritative and should remain intact.
- Existing execution_store fixtures declared only `src/lib.rs` but deliberately submit `src/one.rs` and `src/two.rs`; their declared files now name all three, as T3 authorizes. Those changes are uncommitted.
- Existing service fixtures likewise have undeclared work paths, exactly the discrepancy T4 anticipated. They remain unchanged because task work stopped at T3.
- No plan criterion was treated as unsatisfiable. No frozen source, historical plan, roadmap paragraph, project Git configuration or unleased source was changed. No new agents or secondary workflow were used.

## Verification receipts

- P7-2-T1-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 0; SHA-256 `a92e407946310ac37d85161a0c40171a59dd5ca60344ab979d28d677c3b732f3`; captured output `/tmp/cadence-p7-plan2-receipts/P7-2-T1-verify-1.log`.
- P7-2-T1-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::`
  Exit 0; SHA-256 `e598ac75bf5a15dd2187e8ec1b20009a5376b9febca7c523a15ace0efdf82deb`; captured output `/tmp/cadence-p7-plan2-receipts/P7-2-T1-verify-2.log`.
- P7-2-T2-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 0; SHA-256 `f29b0655ac92fb508a7d619f763dd552800ac009a8dcf01fade0b303d6c07475`; captured output `/tmp/cadence-p7-plan2-receipts/P7-2-T2-verify-1.log`.
- P7-2-T3-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 101; SHA-256 `1761445067cb49abd320c0f97689d2992627df5df8db0a26e0d5398f80e7a0c8`; captured output `/tmp/cadence-p7-plan2-receipts/P7-2-T3-verify-1.log`.
- historical-phase2: `git diff --exit-code 248bd8c668815e11c23e06cdc70c1d505eb82586 -- .planning/phases/2/`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; captured output `/tmp/cadence-p7-plan2-receipts/historical-phase2.log`.
- frozen: `git diff --exit-code v3.7.12 -- cadence-core/`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; captured output `/tmp/cadence-p7-plan2-receipts/frozen.log`.
- typecheck: `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`
  Exit 0; SHA-256 `c66a12b6e1cf23424ff7c6a3454c7c2c71c6c44b2ff5ebe6b94d82fe6f3d7713`; captured output `/tmp/cadence-p7-plan2-receipts/typecheck.log`.
- fmt: `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; captured output `/tmp/cadence-p7-plan2-receipts/fmt.log`.
- clippy: `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 101; SHA-256 `b9a6ca9814b0170336fc78a3d2996f50099a0a552ac0f9c2ba720733e914ccca`; captured output `/tmp/cadence-p7-plan2-receipts/clippy.log`.
- P7-2-T3-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`
  Exit 0; SHA-256 `a9c199f1d855e7b85133497b2ff2b212187d0c5efcb45ddcc5f78b05d11036e1`; captured output `/tmp/cadence-p7-plan2-receipts/P7-2-T3-verify-2.log`.
- full-suite: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
  Exit 101; SHA-256 `6f93e1ee3c13b6c4b5e34c1fba3d19816e8f36ca567d823ceeb31ac5ca8ac2d7`; captured output `/tmp/cadence-p7-plan2-receipts/full-suite.log`.

## Lease and remaining tree

Frozen check `git diff --exit-code v3.7.12 -- cadence-core/` passed with empty output. Historical phase-2 bytes match the starting revision. A path audit of all changes since initial HEAD found 10 changed source paths and no path outside PLAN-2's files frontmatter. The only additional path is this explicitly authorized uncommitted run record.

Uncommitted T3 source files:
- `crates/cadence/src/execution/patch.rs`
- `crates/cadence/src/execution_service.rs`
- `crates/cadence/src/store/writer.rs`
- `crates/cadence/tests/execution_store.rs`
- `crates/cadence/tests/phase7_lease.rs`

No task work continued after B1. The completed signed prefix is preserved. No T3, T4, T5 or T6 commit exists. This report is intentionally uncommitted.


## Continuation after lease amendment 1631b7c2

PLAN CHECKPOINT: blocked
Plan: `.planning/phases/7/PLAN-2.md`
Tasks satisfied: 2 of 6. No new task commit in this continuation.
Starting and final committed HEAD: `1631b7c243bd17e6a3fdd2ac70c1d117ad42c0dd`.
Branch: `cadence/binary-owns-process`.
The previous run record above is preserved verbatim. This continuation is appended and remains uncommitted by explicit owner instruction.

| Task | Status | Commit or blocker |
| --- | --- | --- |
| P7-2-T1 | completed in previous session; not redone | `03bf2649682f398ddb455ca11f19f641c00a3a05` |
| P7-2-T2 | completed in previous session; not redone | `128921fa1bcdc4a93a863a3d0a4f96414776b8af` |
| P7-2-T3 | blocked | B2 below; no commit |
| P7-2-T4 | not-run | stopped at T3 |
| P7-2-T5 | not-run | stopped at T3 |
| P7-2-T6 | not-run | stopped at T3 |

### B2: continuation fixture admission uses the wrong native operation

The original fixture was wrong, not the admission path. Its direct `RewriteSnapshot` installed an execution occurrence without a native boundary decision. `store/writer.rs:515` invokes `require_current_execution`; `:1247` requires a matching BoundaryV1 decision and `:1252` rejects a missing one. Neither that guard nor the lease assertions was weakened.

This continuation changed the native arm of `check_writer` to seed only unrelated data, then submit `BoundaryChange::Dispatch`. However, the new boundary construction at `crates/cadence/tests/phase7_lease.rs:645` incorrectly supplies `new-dispatch` as its operation. The native operation contract at `crates/cadence/src/execution/boundary.rs:346-353` requires `execute-next` for `CadenceQuery` and rejects this at admission. The resulting unwrap at `phase7_lease.rs:664` fails with `Invalid("execution envelope encoding is invalid")`. This is a mistake in the continuation's fixture repair, not evidence that production admission rejects valid material.

Prediction: `phase7_lease` would pass all 13 tests. Actual: exit 101, 11 passed and 2 failed. The two failures are again `both_writers_refuse_ordinary_new_lockfile_and_report_paths_in_commits_and_index` and `both_writers_require_both_staged_rename_endpoints_and_accept_complete_coverage`; they still do not prove the native writer's lease behavior. No retry or further task edit followed. The repository contract `skills/cad-executor-contract/SKILL.md:32` treats a failed verify as a blocker and `:42` says to stop task work at the first blocker. Subsequent verifies and scope checks are diagnostic only.

A continuation needs to use the admitted query operation `execute-next` in this fixture and rerun the unchanged prescribed T3 verifies. No additional leased path or criterion change is needed for that correction. The production format/operation guards remain authoritative.

### Uncommitted changes and constraints

The lease amendment is justified by the owner's clean-before-plan clippy comparison: plan growth reaches the resident Request enum. This continuation changes only `Request::Store.operation` to `Box<Operation>`, constructs the box at its send site, and dereferences it at its receive site in `crates/cadence/src/recall/mod.rs`. It adds no allow attribute, changes no public operation type and does not alter plan serialization or fingerprints. This fix remains uncommitted with blocked T3.

The other continuation edit is the native fixture admission attempt above. The five inherited T3 source files remain uncommitted. No T4 service fixture correction, Git staged reader, durable refusal/recovery implementation, T5 instruction change or T6 documentation change was started. The accepted zero-exemption requirement remains intact; existing service plans still omit the work files their helper commits at `execution_service_tests.rs:229`.

Plan/code discrepancies remain the previously identified T1 task-local omission of globally leased `execution_service.rs`, the service fixture declarations, and the stale ROADMAP exemption/universal-coverage claims assigned to T6. The amended recall path is globally leased even though task-local bullets were not expanded. The global lease governs. No acceptance criterion was weakened or declared unsatisfiable.

The repository executor contract was read and used. The installed older executor contract was also read during orientation; its retry/configuration-detection workflow was not invoked. Explicit owner instructions govern the report and ROADMAP authorization. No agents, attribution, push, git configuration edits, frozen edits or additional workflow were used.

### Continuation diagnostics and receipts

The supplied full suite was invoked once and exited 101: library 104 passed; binary 140 passed and 8 failed. Cargo stopped before integration targets; the suite chain therefore did not reach clippy or fmt. Total reached: 244 passed, 8 failed. The same eight execution-service fixture/inventory failures were predicted and occurred; they remain the T4 declaration repairs identified by the previous session. No full-suite repair was attempted after the T3 blocker.

Clippy was run separately with the wrapper cleared and passed, confirming the minimal recall boxing change clears the lint. Typecheck passed with TMPDIR=/tmp and ignored stdin. Fmt was predicted to pass but exited 1: rustfmt requires wrapping the new `RewriteSnapshot(seed)` request at `phase7_lease.rs:633`. This additional diagnostic is recorded without a post-checkpoint edit. No lint allowance or formatting criterion change was used.

Frozen and historical-phase-2 checks passed with empty output. A global lease audit passed: all six changed source paths are declared in the amended plan; the only additional working-tree path is the owner-authorized uncommitted report. `git diff --check` was clean. No new commits, staged source or configuration changes were made.

- P7-2-T3-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 101; SHA-256 `552c8aaf66f331207bc5bdfd623a8d31bb348ee7415b8505ce0ed9e6c9efb564`; captured output `/tmp/cadence-p7-plan2-resume-receipts/P7-2-T3-verify-1.log`.
- full-suite: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
  Exit 101; SHA-256 `6ca53f30d9272e1097956cb2197379a780e80768758ce690baefd370234cdc6a`; captured output `/tmp/cadence-p7-plan2-resume-receipts/full-suite.log`.
- clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `8189c182663e5819c687ad242b806bb133a771999684926f46dec3091c9126a2`; captured output `/tmp/cadence-p7-plan2-resume-receipts/clippy.log`.
- fmt: `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
  Exit 1; SHA-256 `ff3fd9550c20f7acc1b7d6853d27aec6e239b7044517c4ff46422ffd5b5774fa`; captured output `/tmp/cadence-p7-plan2-resume-receipts/fmt.log`.
- typecheck: `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`
  Exit 0; SHA-256 `c66a12b6e1cf23424ff7c6a3454c7c2c71c6c44b2ff5ebe6b94d82fe6f3d7713`; captured output `/tmp/cadence-p7-plan2-resume-receipts/typecheck.log`.
- frozen: `git diff --exit-code v3.7.12 -- cadence-core/`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; captured output `/tmp/cadence-p7-plan2-resume-receipts/frozen.log`.
- historical-phase2: `git diff --exit-code 248bd8c668815e11c23e06cdc70c1d505eb82586 -- .planning/phases/2/`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; captured output `/tmp/cadence-p7-plan2-resume-receipts/historical-phase2.log`.
- P7-2-T3-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`
  Exit 0; SHA-256 `08a7060cabeff2aa41a0833074f105f9eabce3cc489dfd0e2c55f299ab404e02`; captured output `/tmp/cadence-p7-plan2-resume-receipts/P7-2-T3-verify-2.log`.

The remaining prescribed T3 verify completed as predicted: all 18 execution_store tests passed. This does not override the failed phase7_lease verify. Final continuation status remains PLAN CHECKPOINT: blocked at P7-2-T3, with T4 through T6 not-run. All diagnostic subprocesses completed. The previous signed prefix and amended plan commit remain intact; HEAD is unchanged. The report and all six changed source files remain uncommitted.


## Third session: finish T3–T6

Starting HEAD: `1631b7c243bd17e6a3fdd2ac70c1d117ad42c0dd`; branch `cadence/binary-owns-process`. Prior entries are preserved. The owner clarified that a repairable fixture or formatting mistake is not a blocker. The repository native executor contract governs; the installed older contract was read for orientation only and its extra workflow was not invoked. The owner explicitly authorizes this appended, uncommitted report and the leased ROADMAP edit.

T3 fixture repairs: native dispatch admission now uses `execute-next`, and the wrapped seed call is formatted. The first predicted 13/13 lease run instead passed 11 and failed 2 at the fixture snapshot assertion: native persistence intentionally omits the dispatch body. The fixture now independently removes that body from its expected native snapshot. Production admission and enforcement are unchanged by these repairs. The retry passed all 13. This was a fixture defect resolved within the lease, not a plan/code blocker. Execution-store verification is in progress. Pre-commit fmt, Clippy with warnings denied and CI typecheck passed. The existing recall operation boxing remains part of T3 with no lint suppression.

P7-2-T3 completed: `dfdf339ddc063d32cda4004ec09d60e8cda34065`. Lease tests 13/13 and execution-store tests 18/18 passed; fmt, Clippy and CI typecheck passed. All six committed source paths are in the amended lease. PLAN PARTIAL: 3 of 6 tasks satisfied.


T4 verification in progress. The Git reader uses explicit NUL name-status records with `-M`, no path filters or provenance exemptions, and explicit comparison against every merge parent. Staged paths and raw object identities are observed consistently and reobserved before acceptance. A versioned optional `lease_refusal` field preserves absent-field historical boundary bytes; its full paths, task SHAs, recovery disposition, public digest and boundary identity belong to one immutable decision. The writer and pending-intent recovery validate the refusal against the unchanged open lease. Long reasons reference the complete evidence digest and count instead of truncating durable evidence.

The new wire helper initially assumed a nonexistent `data` wrapper (13/18 passed); fixing it yielded 17/18. An unreadable-index injection then fired before commit validation, so it was moved to the staged read it was designed to test. After that correction plus a pending-intent recovery test, all 19 lease tests passed. All 10 compatibility tests passed, including independently encoded historical boundary bytes. The binary target then exposed the new parser test's sibling-module visibility mistake; `pub(super)` fixed it. Clippy passed on retry. These were implementation/fixture mistakes repaired inside the lease; no criterion was weakened and no plan/code blocker was discovered.

Service fixture declarations now explicitly include their committed work paths (`one`, `two`, `lost`, `summary`, `barrier`, `T1`, and the commit-validation fixtures), before dispatch/fingerprinting. Existing MCP fixture commits already modify their declared `src/shared.txt`; no exemption or wire-fixture widening was needed. T4's service tests are still running their budget inventories. Official Git documentation was fetched through Context7 for NUL pathname/status output, rename endpoints and per-parent merge observations (https://git-scm.com/docs/git-diff and https://git-scm.com/docs/git-diff-index).

P7-2-T4 completed: `d7ffda84baa855faf8a80e8ac75de441cccbc80a`. Required verifies passed in order: lease 19/19, compatibility 10/10, execution service 21/21, MCP 16/16. Clippy and fmt passed. All eight source paths are leased; patch.rs exposes its existing safe-path validator for the Git reader, avoiding another pathname validator. PLAN PARTIAL: 4 of 6 tasks satisfied.

P7-2-T5 completed: `3af58d1ad3b24a2de71bc6a4b29ded40cc72cd58`. Required verifies passed: lease 22/22; MCP skill contract 1/1. Clippy and fmt passed. The first test compile exposed an assertion moving its SHA string; borrowing it fixed the in-lease mistake and the retry passed. New prompts and both executor/execute contracts state zero exemptions and operator-controlled repair. The executor contract also incorporates the owner's distinction between repairable mistakes and real blockers.

The history-repair fixture preserves the original object under a fixture ref, replaces unpublished local history with a signed in-lease commit, and resubmits the full patch using the identical dispatch/version. Changed lease/body and reused offending SHA remain refused; acceptance retains the old refusal and names only corrected SHAs. A staged-only fixture repairs the index and accepts its original in-lease commit. Production code performs no Git mutation. An independently encoded historical prompt and matching boundary digest reopen twice with identical answers and no new state. The known historical renderer is selected by the admitted byte count and checked against the confirmed answer digest; no serialization defaults or historical fingerprint changes are introduced. PLAN PARTIAL: 5 of 6 tasks satisfied.


T6 implementation and targeted verification complete, final task not yet committed: lease 23/23 passed. Native planner/checker guidance now describes exact files, optional directories, field-specific trailing-separator refusal, complete declaration obligations, one covers predicate and zero exemptions. The native frontmatter example is parsed by the test. Only the Phase 7 roadmap section was changed: bounded Bash coverage, shipped Write/Edit and executor behavior, reported-commit plus staged enforcement, retained native overlap-derived ordering, zero exemptions and GH-229's actual pointers. Historical phase-2 PLAN bytes and the separate Phase 12 section compare byte-for-byte to the starting revision.

The supplied full suite is running before the final task commit. Prediction: every test target green, Clippy green with warnings denied, fmt clean. CI typecheck and the frozen `git diff --exit-code v3.7.12 -- cadence-core/` check already passed. PLAN PARTIAL remains 5 of 6 pending the suite and final signed commit.


P7-2-T6 completed: `056afb8163cdb09a3af25bbb981a6dac0f44fddb`. The required 23/23 lease tests passed. The supplied full suite ran once before this signed commit and exited 0: 434 tests passed, zero failed, one existing real-host guard test ignored by its normal suite annotation. Clippy with warnings denied and fmt passed in that same chain. CI typecheck passed separately. There was no full-suite failure or repair run.

PLAN COMPLETE: 6 of 6 tasks satisfied. T1 and T2 remain the original signed commits; this session created one signed conventional commit for each of T3, T4, T5 and T6. No unresolved plan/code contradiction or genuine blocker was encountered. The anticipated undeclared fixture paths and stale Phase 7 roadmap claims were corrected. No enforcement exemption, caller/test special case, lint suppression, Git configuration change in this repository, push or frozen-source edit was made. No agent delegation or secondary execution workflow was used. All implementation and fixture mistakes above were repaired within the lease; none changed a criterion.

### Third-session verification receipts

All captures below contain the actual command output bytes; the digest does not include the receipt metadata printed by the capturing process. All subprocesses received ignored stdin. Test runs used TMPDIR=/tmp and the wrapper was cleared as supplied.

- P7-2-T3-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 101; SHA-256 `c7128e521723a132ad5718ddc1cfc6836d02948b861bc8a8e895ae49dbd570d7`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T3-verify-1.log`.

- P7-2-T3-verify-1-retry: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 0; SHA-256 `fef025039b0ae419d7ab80ee5380a3814aa49a2f39fa9cc307aacc4302ccf660`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T3-verify-1-retry.log`.

- P7-2-T3-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`
  Exit 0; SHA-256 `39f3a176ee8fd13590023774ff1ec3d1f0b411e6c2e99e8af62192608d3da02e`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T3-verify-2.log`.

- T3-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan2-session3-receipts/T3-fmt.log`.

- T3-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `ffe12b74271e0966d69c0a5fe6921591801be0344aa77ca29d9c8f841c5eae2b`; output `/tmp/cadence-p7-plan2-session3-receipts/T3-clippy.log`.

- T3-typecheck: `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`
  Exit 0; SHA-256 `c66a12b6e1cf23424ff7c6a3454c7c2c71c6c44b2ff5ebe6b94d82fe6f3d7713`; output `/tmp/cadence-p7-plan2-session3-receipts/T3-typecheck.log`.

- P7-2-T4-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 101; SHA-256 `dca22c085791aa57fca4344448394ce814833dcc31a9b79120f8a4830c0b67c6`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-1.log`.

- P7-2-T4-verify-1-retry: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 101; SHA-256 `4a722ffb5c029d56df8639ad587e14dc5f4b46d8a246f444db6759f51b10f3c0`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-1-retry.log`.

- P7-2-T4-verify-1-retry2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 0; SHA-256 `1072abba502a00e636d7fb70cbf0c2a0fcb8feb8aff51eaa6178578d7c79bc43`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-1-retry2.log`.

- P7-2-T4-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`
  Exit 0; SHA-256 `5e1bb57c66e51ba52af0e2614f5e0ce3a6a0950ce27ce8206ed4376c40193e92`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-2.log`.

- P7-2-T4-verify-3: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`
  Exit 101; SHA-256 `6935f83a5761b3210da47bcbcf6411f2eb863061a9b67d0dfcc6066f5ff600fc`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-3.log`.

- P7-2-T4-verify-3-retry: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`
  Exit 0; SHA-256 `adad735a5553733f691e2c49b935694240c2a4198690a33ce24ec402a40c5adb`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-3-retry.log`.

- P7-2-T4-verify-4: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`
  Exit 0; SHA-256 `98334a4368bb343fdeb4672783649310f11c9cfd9f120e2cf4fc133405a1b8fd`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T4-verify-4.log`.

- T4-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 101; SHA-256 `c6f0adf0c449333c085a9d7d58c9e1823793b2f869ccbee4bd4c9f70e922b945`; output `/tmp/cadence-p7-plan2-session3-receipts/T4-clippy.log`.

- T4-clippy-retry: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `538149f93540f9266c5a654d0761563ce6ed6ff074e64634ef18a63511436d4a`; output `/tmp/cadence-p7-plan2-session3-receipts/T4-clippy-retry.log`.

- T4-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan2-session3-receipts/T4-fmt.log`.

- P7-2-T5-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 101; SHA-256 `257eef2e7cb88a2eb205c1d2605a11738ed6ebdef6be89d00a8187a66c075274`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T5-verify-1.log`.

- P7-2-T5-verify-1-retry: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 0; SHA-256 `5ebb10969fa98ff4a2c7907b2faa7216f3a6896b3559f04f9ceadb564d130085`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T5-verify-1-retry.log`.

- P7-2-T5-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp skill_contract`
  Exit 0; SHA-256 `1da214306e083cf24798ecf0855212d77447ac4be23391624cf0bc7a116493d4`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T5-verify-2.log`.

- T5-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `cb5b8bc7d347009244f93a0b111306270b1c54cd19422c9e9811b717ffe6cc78`; output `/tmp/cadence-p7-plan2-session3-receipts/T5-clippy.log`.

- T5-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan2-session3-receipts/T5-fmt.log`.

- P7-2-T6-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`
  Exit 0; SHA-256 `f1cf531b67f400da7c2a75e33a9ffbba00873ecf01fb1b8ee0b02e73fce1c722`; output `/tmp/cadence-p7-plan2-session3-receipts/P7-2-T6-verify-1.log`.

- full-suite: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `f3c4a58aa651feb9628a0da10f910d10f601a033b98c37d9c8cb2b765170e22e`; output `/tmp/cadence-p7-plan2-session3-receipts/full-suite.log`.

- final-typecheck: `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`
  Exit 0; SHA-256 `c66a12b6e1cf23424ff7c6a3454c7c2c71c6c44b2ff5ebe6b94d82fe6f3d7713`; output `/tmp/cadence-p7-plan2-session3-receipts/final-typecheck.log`.

- frozen: `git diff --exit-code v3.7.12 -- cadence-core/`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan2-session3-receipts/frozen.log`.

### Final result of third session

PLAN COMPLETE — 6 of 6 tasks satisfied.

| Task | Full signed commit SHA | Passed verification |
| --- | --- | --- |
| P7-2-T1 | `03bf2649682f398ddb455ca11f19f641c00a3a05` | prior session; unchanged |
| P7-2-T2 | `128921fa1bcdc4a93a863a3d0a4f96414776b8af` | prior session; unchanged |
| P7-2-T3 | `dfdf339ddc063d32cda4004ec09d60e8cda34065` | 13 lease; 18 execution store |
| P7-2-T4 | `d7ffda84baa855faf8a80e8ac75de441cccbc80a` | 19 lease; 10 compatibility; 21 service; 16 MCP |
| P7-2-T5 | `3af58d1ad3b24a2de71bc6a4b29ded40cc72cd58` | 22 lease; 1 MCP skill contract |
| P7-2-T6 | `056afb8163cdb09a3af25bbb981a6dac0f44fddb` | 23 lease; full suite green before commit |

Full supplied suite: exit 0, 434 passed, zero failed, one existing live-host guard probe ignored; Clippy and fmt passed. CI typecheck: exit 0. Final audit: current branch preserved; all four new commits have GPG status G; all 16 changed paths since 1631b7c2 are leased; no deletions; frozen cadence-core matches v3.7.12; historical phase-2 bytes unchanged. The Phase 12 roadmap section is also byte-identical to the starting revision, proved by the T6 test.

No unresolved plan/code disagreement. No genuine blockers. Expected fixture declarations and stale Phase 7 documentation were repaired as planned. This report is the only uncommitted file and is intentionally left for the owner. Previous run records above remain intact.
