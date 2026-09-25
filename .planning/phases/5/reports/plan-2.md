PLAN COMPLETE
Plan: /code/cadence/.planning/phases/5/PLAN-2.md
Tasks: 5 of 5

| Task | Commit | Note |
|---|---|---|
| 1 - Unified override contract | 74cf479709b0b9dbcc97f7f4ab81519a47396d95 | Added reasoned invocation/answer authorization and rerun, bypass, exact paused Next and review meanings through the existing guarded service. Rerun requires every admitted plan, including plans with completed reports. Bypass preserves the actual failed result. Missing/blank reasons refuse without changes; config and unset flags create no override. Verify prediction: binary 80 passed, library 38 passed, zero failures. Both held, exit 0. |
| 2 - Review receipt identity | d81a06eea936afa763766c3f3e954fede08d0680 | Preserved both endpoints, trigger, plan, correlation, optional round/anchor, finding reference, counts and shared answer identity. Two receipts reopen unchanged; wrong range/trigger/plan never settles. Original legacy trace bytes and the established imported outcome remain unchanged and unpromoted. Verify prediction: binary 81 passed and library 39 passed, zero failures. Both held, exit 0. |
| 3 - Occurrence lifetime | cf1afcb0b7c83b2f0014d87f3e0d0c4d735bf98a | Added pure occurrence permission and a real service consumer that retains lifecycle conflict refusal. Guarded fulfillment/supersession ends grants for exactly that work scope. Saving a pause leaves resume pending; replay cannot resurrect ended permission. Historical range settlements remain queryable. Verify prediction: binary 83 passed, zero failures. Held, exit 0. |
| 4 - Checked-material freshness | 18b9c2cdc89c7c8d05d9b9cba1fa124623ce7cd8 | Added pure freshness/applicability over fresh adapter reads and material-bound bypasses. PLAN-body changes preserve lifecycle and historical verdicts but deny old approval. Fresh checks or corresponding overrides permit changed work; wrong occurrences and read failures do not. Narrowed revisions preserve prior blockers/diff and inherited initial observations; the spent budget never refunds. Verify prediction: binary 85 passed, zero failures. Held, exit 0. |
| 5 - Process-death authority proof | a90a2f3d24fa925a57390febb478bec9af07476e | Extended the existing child harness with all forms, two ranges sharing one answer, pending/fulfilled/superseded work, changed material and lost-reply retry. Three additional writer kills assert barriers and SIGKILL. Fresh readers query production applicability using only root and identity. Imported pause provenance and lifecycle memo remain unchanged. Shared applicability assertions reject test-only phase-wide grants and automatic stale-verdict reuse. Verify prediction: binary 87 passed, library 41 passed, zero failures. Both held, exit 0. |

Deviations: none. Every task's Verify prediction held; no acceptance criterion or locked decision changed.

Open items: one unrelated workspace item. Untracked `docs/diagrams/dispatch-layers.md` and `docs/diagrams/execute-loop.md` appeared during the dispatch and were left untouched. No remaining PLAN-2 implementation work or checkpoint.

## Run details

Starting HEAD: `b1850af05061688215f273416e6709027740e95c`, branch `cadence/binary-owns-process`. Sequential PLAN-2 only. PLAN-1 was consumed as the implemented prerequisite; PLAN-3 and PLAN-4 were not started. No prior PLAN-2 report existed to rotate. The report was rewritten after every task commit with partial status, including after Task 5, and marked complete only after both final suites passed. It remains uncommitted for the phase documentation commit.

Every task passed its lease gate and both static checks before its commit. Detection returned `cargo clippy --all-targets -- -D warnings` and `npx tsc -p tsconfig.ci.json`. Task 1's first clippy invocation found one collapsible conditional and exited 101; the conditional was corrected and clippy passed before commit. Tasks 2-5 passed both static checks without repairs. There were no targeted test failures or suite repairs.

Only the plan's declared files and this report were written. The occurrence transition hook uses the existing persistence file; material-bound bypass fields use the existing override file, both within the declared plan lease. No dependencies were installed, no persistent git configuration was changed, and no push occurred. Test temporary directories used `/tmp`, every Cargo invocation cleared `RUSTC_WRAPPER`, and Node subprocesses ignored unused stdin. TypeScript used `npx --no-install` to prohibit package installation.

## Verification details and negative controls

Task 1 exercised all four forms through `CadenceServer::evidence` and the existing resident/session writer. Rerun scope is checked against admitted PLAN names without filtering completed reports. Actual checker outcome and operator exception remain separate. A missing originating answer, an unanswered gate, a narrowed rerun set, blank reasons and an attempted fail-to-pass rewrite all refuse. Durable policy alone and an unset invocation flag produce no grant.

Task 2 recorded two range receipts under one recorded answer. Exact reasons, finding references, counts and optional metadata survive reopening. B..C does not settle A..C, another trigger or another plan. Counts without a finding reference refuse. A mixed legacy trace retained its exact source bytes and already-imported historical decision; no compatibility receipt or historical authorization was fabricated.

Task 3 tested pending permission across restart, fulfillment and supersession separately, later occurrences with identical phase/plan, terminal-state replay and attempted regrant. A review receipt remains historical settlement after permission ends. The production applicability service independently refuses an actual lifecycle StateConflict.

Task 4 initially reopens an applicable narrowed revision, edits the PLAN body under the same filename, and proves the lifecycle answer and memo are unchanged while approval becomes inapplicable. A fresh result or corresponding material-bound override permits the changed work. An older-material grant and a wrong-occurrence grant cannot clear it. Both a real missing CONTEXT file through the service and injected PermissionDenied through the production material adapter yield no approval. Initial inputs inherited by a narrowed revision retain their original observation; the revision still records only its own material, diff and previous blockers. Edits, restart, a fresh initial check and explicit overrides never refund the spent revision; a second revision and an attempted refund refuse without writes.

Task 5 adds three writer kills to the existing harness: two acknowledged writers for independent fulfillment/supersession cases and one writer held at store confirmation before its reply. Fresh readers use persisted records and production permission/material consumers. Replaying the same lost-reply submission does not add another grant, change the generation or restore expired permission. Original imported pause provenance, unrelated snapshot data and the lifecycle memo remain intact.

The library's two negative-control tests run the same assertions with production decisions and deliberately incorrect test-only alternatives. A phase-wide grant fails occurrence isolation; automatic old-verdict reuse fails changed-material approval. Each failure is required by the test. Neither alternative appears in production code.

## Handoff for later plans

`Fact::Override` uses the existing versioned `Record` and full work `Scope`. `overrides::Authorization` identifies an explicit invocation or a persisted authorizing gate answer. `Meaning` preserves rerun's admitted plan set, skipped/result bypass distinction, exact paused sentence and complete review receipt. Result bypasses retain the original disposition and the full material set explicitly authorized by the operator.

A persisted grant establishes pending work. `Fact::Occurrence` is the explicit fulfilled/superseded transition for its full scope, written through the same guarded transaction. It preserves the original grant and appends transition history. `authority::permission` is pure; `Command::Permission` exposes it through the resident service after the independent lifecycle check. `Recovery::review_settlements` queries historical settlement with exact scope and both endpoints, trigger and optional plan.

`material::basis` preserves observation lineage from an initial check through its narrowed revision. `observe_material` performs fresh reads in the adapter and preserves failures; `material::compare` and `authority::checker_applicability` consume those observations without filesystem access. `Command::CheckerApplicability` returns freshness, verdict applicability, continuation eligibility, spent revision and the applicable override identity, together with material observations and unchanged evidence history. Occurrence permission alone does not establish checker freshness; consumers use checker applicability for that decision.

PLAN-3 can consume these decisions without reimplementing lifetime or material comparisons. The committed resume record and git-preservation workflow remain PLAN-4's work. No public dispatch, new lifecycle vocabulary or runtime use of frozen sources was added.

## Final evidence

`workflow.test_command` resolved to null through `node cadence-core/bin/config.mjs get workflow.test_command`, exit 0. After Task 5's commit and partial report write, the Cargo workspace and requested Node suite each ran once. Final prediction: Cargo 181 passed with zero failures, Node exit 0. Both held.

| Exact command | Pass counts and exit codes |
|---|---|
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | Tasks 1-5 respectively: 80, 81, 83, 85 and 87 passed; every run 0 failed, exit 0. |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib` | Tasks 1, 2 and 5 respectively: 38, 39 and 41 passed; every run 0 failed, exit 0. |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace` | 181 passed, 0 failed, exit 0. Library 41, binary 87, derivation consistency 6, derivation inputs 12, evidence store 4, MCP 4, store 17, crash 10; doc tests 0. |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings` | Exit 0 before each of the five commits, no warnings. Task 1's initial exit 101 was corrected before commit. Test count not applicable. |
| `TMPDIR=/tmp npx --no-install tsc -p tsconfig.ci.json` | Exit 0 before each of the five commits, unused stdin ignored. Test count not applicable. |
| `TMPDIR=/tmp node --test` | 3,753 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo, exit 0; unused stdin ignored and inherited `RUSTC_WRAPPER` cleared. |

`git log b1850af05061688215f273416e6709027740e95c..HEAD --reverse --format='%H %G? %GK %an <%ae>%n%s%n%b'` exited 0. All five task commits, in order, verify **G** with key **693AB15F91734B0C** and author **John Crenshaw <john@jcrenshaw.dev>**. Their exact SHAs are in the task table. Every per-commit deletion check was empty.

`git diff --exit-code b1850af05061688215f273416e6709027740e95c -- cadence-core/ .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md` exited 0: the frozen reference and all three protected planning files are unchanged from the dispatch HEAD. `git diff --check b1850af05061688215f273416e6709027740e95c..HEAD` also exited 0.

Only this uncommitted report and the two unrelated untracked diagram files remain outside the committed task changes.
