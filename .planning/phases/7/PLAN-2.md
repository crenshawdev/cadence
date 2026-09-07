---
phase: 7
plan: 2
requirements:
  - AC3
  - AC4
  - AC5
  - AC6
files:
  - crates/cadence/src/execution/mod.rs
  - crates/cadence/src/execution/lease.rs
  - crates/cadence/src/execution/model.rs
  - crates/cadence/src/execution/plan.rs
  - crates/cadence/src/execution/dispatch.rs
  - crates/cadence/tests/phase7_lease.rs
  - crates/cadence/src/execution/patch.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/tests/execution_store.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/store/model.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/execution_boundary_compat.rs
  - crates/cadence/src/execution_service_tests.rs
  - crates/cadence/tests/mcp.rs
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-execute/SKILL.md
  - docs/architecture/source-leases.md
  - skills/cad-planner-contract/SKILL.md
  - skills/cad-plan-checker-contract/SKILL.md
  - .planning/ROADMAP.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P7-2-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::"
    - id: P7-2-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
    - id: P7-2-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store"
    - id: P7-2-T4
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P7-2-T5
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp skill_contract"
    - id: P7-2-T6
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease"
---

# Phase 7: The enforced source lease - Plan 2

## Goal

Native admission, plan ordering and patch application agree on one lease meaning, and out-of-lease executor commits cannot become accepted execution evidence. This plan alone proves zero-exemption refusal with an explicit, durable recovery disposition.

## Must be true when done

- AC3: Native plans accept exact files plus optional directories; trailing slash in files is a typed field-specific refusal, and malformed or empty total leases cannot be admitted.
- AC3/AC4: One covers() implementation serves admission, dependency ordering and patch enforcement; directory/file and nested-directory overlap create prerequisite edges.
- AC5: Covered signed commits are accepted; an undeclared path in any reported commit, including either rename endpoint, refuses the entire patch.
- AC5: Refusal preserves execution namespace, active dispatch identity/version and SUMMARY bytes, and records one replayable decision with the rejected SHAs and complete undeclared path evidence.
- AC6: Reports and lockfiles receive zero exemptions. The roadmap's claimed exceptions are corrected.
- D-31: The existing Git commit remains present; automatic execution stops, the dispatch remains open for a corrected signed resubmission against its unchanged lease, and no automatic history rewrite occurs.

## Context

D-31 through D-33 and D-37 bind this plan. Reuse parse_plan, PlanGraph::build, attach_commit_paths and validate_commits_blocking. The current store calls attach_commit_paths on both patch paths; enforcement must reach those callers too. The prior plan supplies safe concurrent audit persistence, not lease semantics.

## Tasks

### Task 1: Admit the two-field lease grammar (P7-2-T1)

- **Files:** `crates/cadence/src/execution/mod.rs`, `crates/cadence/src/execution/lease.rs`, `crates/cadence/src/execution/model.rs` (ExecutionPlan / ActiveDispatch), `crates/cadence/src/execution/plan.rs` (Frontmatter / FingerprintPlan / parse_plan / normalize_lease_path), `crates/cadence/src/execution/dispatch.rs` (build_dispatch), `crates/cadence/tests/phase7_lease.rs`
- **Action:** Implement the sole covers() predicate in the new lease module and expose it through execution. Keep files required as an exact-path list and add optional directories as a structural prefix-coverage list; files may be empty only when directories supplies a valid nonempty lease. Check for a trailing separator in file spelling before normalization, including the alternate separator already recognized by the normalizer, and refuse with a typed error naming files. Preserve other normalization rules rather than adopting v3's path spelling rules. Normalize directory roots and match by path-component boundary: src covers descendants under src/, never src-other; a directory and an exact file naming its root overlap structurally. Refuse malformed fields, unknown keys, duplicate normalized declarations and over-limit or empty total leases. Admission must call the shared predicate to validate coverage of admitted declarations, rather than independently implementing containment. Carry both fields into ExecutionPlan, ActiveDispatch and the binary prompt's operational input. Fingerprint directories as operational data. Preserve the prior serialization/fingerprint preimage when directories is absent or empty, so old exact-file active dispatches remain reconstructable; do not insert defaults into historical hashes. New directory declarations change identity and cannot silently widen an existing active dispatch.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::` — accepts files-only and directory-only native fixtures, rejects files: [src/] with a field-specific error, and proves normalization, bounds, root boundaries and malformed declarations. An independently encoded old exact-file dispatch retains its fingerprint and bytes after reopen; changing directories changes the fingerprint and prompt. One production covers definition is asserted and exercised, not merely counted in source.

### Task 2: Order plans by shared coverage (P7-2-T2)

- **Files:** `crates/cadence/src/execution/plan.rs` (PlanGraph::build / prerequisites / ready), `crates/cadence/tests/phase7_lease.rs`
- **Action:** Replace PlanGraph::build's plain file-equality condition with overlap derived through the shared covers() predicate in both directions over declared roots and files. Keep lower-plan-number to higher-plan-number edge orientation, transitive readiness and the existing deterministic tie-break. Exact files do not acquire recursive coverage. Explicitly test directories: [src/] versus files: [src/shared.txt], nested and equal directory roots, files that merely share a textual prefix, and the reverse plan-number order. This is dependency ordering within native execution, not resurrection of the retired v3 parallel-safety interview.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease` — asserts the exact AC4 pair is dependent and checks its prerequisite edge, the reverse pair and transitive readiness. Disjoint and prefix-collision fixtures remain independent. Replacing overlap with the old files.contains comparison must fail the AC4 test.

### Task 3: Enforce coverage at the patch writer (P7-2-T3)

- **Files:** `crates/cadence/src/execution/patch.rs` (attach_commit_paths / apply_executor_patch), `crates/cadence/src/store/writer.rs` (boundary_v1 / apply_execution_patch), `crates/cadence/tests/phase7_lease.rs`, `crates/cadence/tests/execution_store.rs`
- **Action:** Bind observed commit paths and the whole observed staged set to the active dispatch's lease before any accepted execution mutation or SUMMARY render. Make attach_commit_paths and every writer caller apply the same covers() implementation after existing exact commit-key, sorted unique path and safe-relative-path validation; carry Task 4's staged observations separately as binary-owned input, retaining both rename endpoints. Preserve the existing patch shape: executors cannot assert their own observed path sets. Refuse the whole patch if any reported completed-task commit or staged path is out of scope, including a completed prefix in a blocked patch; never accept its in-scope rows partially. Apply zero exemptions to staged and committed source, new paths, dependency lockfiles and the plan's own legacy reports. Keep already-confirmed pre-enforcement completion receipts immutable on replay; new applications against outstanding exact-file dispatches use the new enforcement. Do not reclassify old accepted commits as refused after the fact. Update existing writer fixtures only where their declared files must accurately describe the paths they deliberately submit.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store` — drives both production writer patch paths and rejects undeclared ordinary files, new files, Cargo.lock and the plan's own reports in both committed and staged observations, with execution data and SUMMARY unchanged. A fully covered commit plus a staged rename whose destination is declared but source is undeclared refuses naming the source; test the reverse violation too. Exact-file and directory-covered patches with covered staged sets pass. Covered-plus-uncovered multi-task and blocked-prefix cases refuse atomically; immutable historical accepted receipts still replay.

### Task 4: Record complete Git-backed lease refusals (P7-2-T4)

- **Files:** `crates/cadence/src/execution_service.rs` (validate_commits_blocking / apply / record_refusal), `crates/cadence/src/execution/boundary.rs` (BoundaryV1 / PreparedAnswer / Receipt), `crates/cadence/src/store/writer.rs` (boundary_v1), `crates/cadence/src/store/model.rs` (BoundaryRecordV1), `crates/cadence/src/store/transaction.rs` (Intent::validate), `crates/cadence/tests/phase7_lease.rs`, `crates/cadence/tests/execution_boundary_compat.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/tests/mcp.rs`
- **Action:** Reuse execution_service's existing commit existence, strict ancestry/order, HEAD ancestry, signature, distinct-SHA and subject/task checks. Make its Git path reader independent of rename-detection configuration: use explicit NUL-delimited name-status records with rename detection and preserve both endpoints; reject malformed records and invalid UTF-8 without lossy conversion or normalizing Git bytes. Read the whole staged set at patch time with git diff --cached --name-status -z -M, without a path filter or provenance exemption, and retain both rename endpoints through the same reader. An unreadable or malformed staged set refuses; reobserve it before acceptance and refuse changed inputs. For a merge collect the union of changed paths against every parent, retaining both rename endpoints, so diff-tree's default omission of merge comparisons cannot yield a false empty scope; keep the current commit-shape contract rather than adding a new ban on merges. Feed both observations through Task 3. On undeclared-files produce one confirmed boundary refusal containing dispatch/phase/plan, rejected task SHAs, complete sorted undeclared path evidence distinguishing staged from committed paths, and the recovery disposition in Notes. Extend that same decision's typed evidence, not a second appended refusal or execution receipt. Preserve old record/intent decoding and digest preimages; distinguish new evidence encoding and validate it during recovery. Respect existing response-size limits: normal reasons enumerate the offending paths; if evidence exceeds the reason bound, the bounded reason names the evidence identity and count while the full list remains in that decision, never silently truncated out of the durable record. Keep replay identity stable for the same refusal. Adapt existing service and wire fixtures to declare the actual paths their signed test commits modify.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — creates real signed commits and applies them through public stdio. It checks committed and staged rename source-only/destination-only violations with Git rename config enabled and disabled: a covered commit with a staged rename into a declared destination still refuses its undeclared source. Covered directories, merge observations, unreadable/malformed/non-UTF-8 staged input, changed staged sets and staged/committed report/lockfile violations are covered. For a lease refusal, git cat-file still finds each rejected commit, the index is untouched, exactly one decision exists after duplicate submission/restart, and execution namespace plus SUMMARY bytes remain exact. A long-path fixture proves complete evidence survives compact response limits.

### Task 5: Define corrected-resubmission recovery (P7-2-T5)

- **Files:** `crates/cadence/src/execution_service.rs` (dispatch_response / render_prompt / record_refusal), `crates/cadence/tests/phase7_lease.rs`, `skills/cad-executor-contract/SKILL.md` (process / return), `skills/cad-execute/SKILL.md` (process), `docs/architecture/source-leases.md`
- **Action:** Implement the refusal and recovery contract in Notes in binary-owned prompt/reason text and executor instructions. Keep cad-execute's refused-envelope behavior as display-and-stop; it must not invent a repair loop, interpret paths, grant an MCP tool to the executor or rewrite history. The executor is told to stop, preserve the rejected SHAs and request operator-controlled repair; a subsequent corrected full patch uses the same dispatch ID and expected execution version while the lease/fingerprint remains unchanged. A planning correction that changes the lease is not a corrected resubmission to that active dispatch and must retain the existing changed-plan refusal. Do not add an occurrence-reset, cancellation or history-rewrite operation. Prove actual recovery with a disposable unpublished fixture where its operator replaces the offending commit with a signed in-lease task commit, retains the original object for inspection, and resubmits the full patch. Check the already-existing signature/order/subject rules again; do not weaken them to make recovery pass.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp skill_contract` — refuses an out-of-lease commit, restarts the server, queries the identical open dispatch and accepts a corrected signed full patch after fixture-operator repair. Reusing the offending SHA still refuses; changed lease/body still refuses; no production call mutates Git. The original refusal decision remains and the accepted outcome names only corrected task SHAs. Skill allowlists and field-for-field patch submission remain intact.

### Task 6: Publish the exact lease contract (P7-2-T6)

- **Files:** `skills/cad-planner-contract/SKILL.md` (task_anatomy / plan_output), `skills/cad-plan-checker-contract/SKILL.md` (dimensions), `.planning/ROADMAP.md`, `docs/architecture/source-leases.md`, `crates/cadence/tests/phase7_lease.rs` (new integration target)
- **Action:** Update native planner/checker guidance to teach exact files, optional directories, rejected trailing file separators, the sole coverage predicate and zero exemptions. Spell out the current execution frontmatter and complete lease obligation without changing unrelated planning methodology. Correct the Phase 7 roadmap paragraph that claims lockfile and report exceptions: name zero exemptions, patch-time reported-commit-path enforcement and retained native overlap-derived ordering. In that same Phase 7 section replace the universal-hook/commits-before-skills claim with the bounded Bash arm plus already-shipped Write/Edit and executor behavior, and fix GH-229's stale implementation pointer. Do not rewrite the separate Phase 12 execution scope or historical phase-2 PLAN files. This task's ROADMAP edit is the project owner's explicit, exact-path documentation authorization; it does not broaden the executor's ordinary .planning ownership permissions or introduce a lease exemption. The roadmap path is fully leased and its commit is checked like every other path.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease` — checks the native planner/checker contract against parser fixtures and asserts the Phase 7 roadmap section states zero exemptions and patch-time enforcement without the old exception or universal-coverage claim. It compares the historical phase-2 plan bytes to the starting revision and confirms they were not migrated.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-33 / AC3 | P7-2-T1, P7-2-T2, P7-2-T3, P7-2-T6 |
| D-33 / AC4 | P7-2-T2 |
| D-31 / AC5 | P7-2-T3, P7-2-T4, P7-2-T5 |
| D-32 / AC6 | P7-2-T3, P7-2-T4, P7-2-T6 |
| D-37 | P7-2-T4, P7-2-T5 |

## Notes

Run after PLAN-1 and before PLAN-3. The writer and later service/test leases are shared. The explicit owner instruction permits these ordered splits; they are not parallel slices. The wider file set in Task 4 is one refusal's end-to-end Git, durable-record and wire contract. Tests and fixture repairs are leased explicitly; use existing dependencies and existing signing support read-only, and embed extra fixtures inside the leased tests.

D-31 disposition: The refusal says `undeclared-files`, identifies the affected paths and SHAs, and states: `The commits already exist in Git and were not removed or accepted as execution evidence. Stop execution and have the operator repair or split the offending local history into signed task commits entirely within this dispatch's unchanged lease; do not push, reset, amend, revert or force-push automatically. This dispatch remains open for a corrected full patch with the same dispatch ID and execution version.` For staged-only violations, name the staged paths and require operator-controlled index repair before resubmission; leave the index and commits untouched and do not prescribe a history repair for in-lease commits. The operator chooses a safe recovery appropriate to whether history is shared; the fixture uses unpublished local replacement, never a production recovery command. Cadence does not make task commits. No failed patch becomes a blocked terminal outcome or consumes the dispatch's accepted-patch receipt. The durable refusal includes complete path evidence, the original SHAs, unchanged-dispatch disposition and the public answer digest; a later accepted patch preserves that history. An unanticipated necessary file requires a planning correction under the owner's planning workflow, not a secret expansion on retry. Current changed-plan protection remains authoritative and no new reset workflow is promised.

Admission does not consult whether a leased file exists: a new file is declared before creation. File normalization is unchanged except the explicit trailing-separator rejection; Git-observed bytes are never normalized to match a declaration. Directory overlap uses the same covers predicate rather than a copied prefix matcher. Empty total leases now refuse deliberately at admission.

Historical phase-2 directory-shaped files declarations remain unchanged as historical records; new native admission rejects that spelling and any future re-execution needs deliberate replanning. Already-confirmed phase-6 completions and commits before enforcement are not retroactively invalidated. These phase-7 plans themselves use files only, with every new source/test/document path explicitly enumerated.
