# Phase 7 PLAN-1 run record

Outcome: blocked at P7-1-T7. Completed prefix: P7-1-T1 through P7-1-T6.
Initial branch: `cadence/binary-owns-process`; initial HEAD: `25e453dccc1480a1e9eebe12306dc79c06aa48c7`; initial tree clean.
Final committed HEAD: `06faf708e3f6f8ac9e15fadd0ed984e09f7abcdc`. No push. All six completed-task commits have valid GPG signatures and use the configured author.
This report is the explicit owner-authorized exception to the executor contract report restriction. It is left uncommitted.

| Task | Status | Commit | Verification |
| --- | --- | --- | --- |
| P7-1-T1 | completed | `111f1e326eb8853062e6188af0d2ac2573bc4c71` (signature G) | 4 passed |
| P7-1-T2 | completed | `d4a2cd0a20e9be2ddbda1c7d27240dbdaf2fe6a6` (signature G) | 40 passed |
| P7-1-T3 | completed | `272ef789121f61d2624069e4356563b0eeca340b` (signature G) | 42 integration + 9 binary passed |
| P7-1-T4 | completed | `a502ec162b07c691f8def774f886774f42d83811` (signature G) | 45 integration + 16 config + 22 pause passed |
| P7-1-T5 | completed | `942563bbf8a32f6bd7b2adfb96502533a62d9b01` (signature G) | 48 passed |
| P7-1-T6 | completed | `06faf708e3f6f8ac9e15fadd0ed984e09f7abcdc` (signature G) | 55 passed |
| P7-1-T7 | blocked (B1) | none | prescribed live verify exited 101 |

## B1: required verification did not pass

The first failure was P7-1-T7’s prescribed real-host verify, not authentication or a missing native denial. The probe incorrectly correlates a hook response with the most recent tool call. An intervening Read call clears its match for the still-running Bash hook. Evidence: `crates/cadence/tests/phase7_live.rs:293`, `:299`, `:303`. The response must instead remain correlated through hook identity despite interleaved tool events. No repair or retry was made after this failure, as required by `skills/cad-executor-contract/SKILL.md:32` and `:42`.
Actual capture: `/tmp/cadence-phase7-live/guard-run-ymHvFQ/hard-git-host.jsonl:15` is the required Bash attempt; `:16` starts hook `4f776bb0-bc94-4231-ae56-806cd972de2b`; `:17` is the intervening Read; `:18` contains that same hook’s zero-exit deny JSON; `:19` is the Bash tool refusal. Independent inspection confirmed the fixture snapshot integrity and both log digests, and a durable deny on main naming Git unavailable. The automated criterion nevertheless failed and is not recorded as passed.
Live cases accepted by the probe before stopping: protected deny, protected ask, configured pass with a validly signed new commit, push ask with unchanged fixture-local bare remote, unrelated silent command without a log, Git-unavailable failure pass with a validly signed new commit and durable failure, torn-config ask with the defaults-versus-user-settings reason, and an independently established deny retained through torn config. The hard-Git attempt occurred but its correlation check failed. The subsequent hard-torn and Write/Edit live cases were not run. AC1/AC2 live evidence remains incomplete.
Host was Claude Code 2.1.263; Git was 2.55.0. The exact PLAN-1 Notes command was used with fixture paths. Normal default permission mode and the Bash/Read/Write/Edit registrations were confirmed from real system init events. The native executable ran directly from fixture PATH; failure settings removed Git only from the hook environment. No live operation targeted this checkout or an external remote. Per-attempt versions, exits, content digests and paths are in `docs/validation/phase-7-live.md`.

## Required full suite

Command: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
Exit: 101. Output SHA-256: `6d4d3d4b5b0ba657bfcb81c9bd707d59f767ed52fac4ac1f4c7e1302318f6ee7`. Captured bytes: `/tmp/cadence-p7-plan1-receipts/full-suite.log`.
Actual result: 316 passed, 1 failed across the targets reached. The MCP target ended 15 passed / 1 failed. Cargo stopped before the remaining integration targets; the `&&` chain did not invoke Clippy or cargo fmt.
Failure: `execution_calls_store_failure_never_acknowledges_a_refusal`, `crates/cadence/tests/mcp.rs:1015`: expected error code -32603 on retry, received Null. Task 1’s new recovery/observation at `crates/cadence/src/store/writer.rs:286` returns its error before persist can latch the writer failure. Removing the injected bad intent directory lets the same resident accept the retry, violating the existing persistent-failure expectation. This regression is present in the completed prefix and remains unrepaired because task work had already stopped at B1.
Additional inspection concern, not an executed failure in this suite: `crates/cadence/tests/store.rs:897` expects unverified Read to retain the prior view after externally damaged snapshot bytes. The unconditional observation at `crates/cadence/src/store/writer.rs:288` now rejects that read. The suite stopped before this target, so no test result is claimed for it.

## Plan and implementation observations

- CONTEXT AC2 at `.planning/phases/7/CONTEXT.md:305` still says torn config proceeds. Settled D-30 and PLAN-1 at `.planning/phases/7/PLAN-1.md:141` require ask and retained denial. Implementation and tests follow PLAN-1 and D-30; CONTEXT was not edited.
- Task 1’s compatibility requirement remains incomplete because of the store-failure regression described above. Task 7’s required event correlation and remaining live cases are incomplete. No criterion was weakened.
- The host help omitted default from its permission-mode choices, but the actual required invocation accepted it and reported permissionMode default. No command substitution was needed.
- The preliminary host-command check loaded the hook but withheld its commit attempt itself. It was not counted as commit-rail proof. The actual live fixture explicitly authorized the attempt so the native hook, rather than host prose, decided.
- Task 1 predicted five tests; four ran because the cases were combined. Its stated behavioral coverage passed. Predictions were stated before every task verify and before the suite.
- The native key is `git.guard_hard_fail`, boolean default false. No dependency, frozen JavaScript, historical plan or out-of-lease source file changed.

## Verification receipts

- P7-1-T1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`
  Exit 0; SHA-256 `705bfdf35875587aec719228c64cc9029497c0405ed4f5451658e188e7e60b94`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T1-verify.log`.
- P7-1-T2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`
  Exit 0; SHA-256 `23fd65197677877ae434a19bd1436a2dce410e4429746d442a1d9b32eb4c9c62`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T2-verify.log`.
- P7-1-T3: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`
  Exit 0; SHA-256 `7491e129ed868143c491813b4baf0bbeb33fb8c02627fce6cdc25fd5145880a1`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T3-verify-1.log`.
- P7-1-T3: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence guard`
  Exit 0; SHA-256 `660cfa6bcb96115f8d35b6271fc20ce4a50db5a0456a3711810ffe5861995bac`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T3-verify-2.log`.
- P7-1-T4: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`
  Exit 0; SHA-256 `8e377f429a0edfd9c1c36759a897d90bec8a03594e7e6e00f3f5d9ece071cb4f`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T4-verify-1.log`.
- P7-1-T4: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence config::`
  Exit 0; SHA-256 `5348fd210033becb92bee4688f29020ab9dea7be91db9301076242c75441c47e`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T4-verify-2.log`.
- P7-1-T4: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service`
  Exit 0; SHA-256 `63cf447c23577347471a6572a8528f2388fdd54685dfaae2fb5b9fdd6b162bb8`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T4-verify-3.log`.
- P7-1-T5: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`
  Exit 0; SHA-256 `ae665d1e8396eb7ca01a7bde8fe1ed3c3dfd71472a4a65144fa455521859748d`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T5-verify.log`.
- P7-1-T6: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`
  Exit 0; SHA-256 `88c52e4a42957a595d5018b08e2f756b28af7dee44acfbb6db02f479c0ff8206`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T6-verify.log`.
- P7-1-T7: `TMPDIR=/tmp RUSTC_WRAPPER= CADENCE_PHASE7_LIVE=guard cargo test -p cadence --test phase7_live -- --ignored --nocapture`
  Exit 101; SHA-256 `65f48f57000f2cc6ee90dd3dd8360edbdc3543f29db38936e354a875a99d3460`; output `/tmp/cadence-p7-plan1-receipts/P7-1-T7-verify.log`.

## Lease, frozen reference and remaining tree

Frozen check: `git diff --exit-code v3.7.12 -- cadence-core/` exited 0; output SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Frozen cadence-core bytes are clean.
All changed source paths were checked against PLAN-1 files frontmatter, plus the owner’s explicit report path. The check found no undeclared path.
Uncommitted Task 7 artifacts: `hooks/hooks.json`, `crates/cadence/tests/phase7_guard.rs`, `crates/cadence/tests/phase7_live.rs`, `docs/architecture/commit-rail.md`, `docs/validation/phase-7-live.md`. The run record is also uncommitted. No commit was created for the blocked task.
