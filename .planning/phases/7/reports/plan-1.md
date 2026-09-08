# Phase 7 PLAN-1 run record

> **Correction, 2026-09-08 - the live-probe evidence in this report is withdrawn.**
> `crates/cadence/tests/phase7_live.rs` and `docs/validation/phase-7-live.md` were
> deleted, and every plan verify that ran them was removed. The probe launched a
> real Claude Code session and asserted over its transcript, so its result was one
> sample of a model's behaviour rather than a measurement: the same test failed and
> then passed on the same code, and the only change between the runs was prose in a
> contract file. It was a full end-to-end run, which this project does not test.
> Everything below is a true record of what was RUN on the date shown. What changed
> is what the phase CLAIMS from it: no assertion here that depends on a host loading
> a skill, a model obeying a refusal, or an executor's returned text is claimed by
> phase 7 any more. Guard behaviour is claimed only through
> `cargo test -p cadence --test phase7_guard`, which feeds the binary the exact
> input a hook sends and asserts the returned decision. Host obedience is observed
> by a person and asserted by no test in this repository.

Outcome: blocked at P7-1-T7. Completed prefix: P7-1-T1 through P7-1-T6.

> **Resolution:** the blocked task P7-1-T7 was later completed and committed as
> `41f16a9c`. Its live-probe verify was removed on 2026-09-08 and replaced with

> `cargo test -p cadence --test phase7_guard`.
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

## Continuation run: store repair and live-probe completion

Initial HEAD: `e0db1ca1`; branch `cadence/binary-owns-process`. The prior record above is preserved. The owner explicitly authorizes this append and requires it to remain uncommitted; no other planning file is changed. The applicable contract is the repository's `skills/cad-executor-contract/SKILL.md`, not the older installed plugin contract (consulted initially). No configuration detection, delegation or extra review is used.

Status: PLAN PARTIAL; P7-1-T1 regression repaired, P7-1-T7 pending.

### Regression diagnosis and repair

The store implementation was wrong; the boundary test remains unchanged. Task 1 moved recovery into every operation at `111f1e32:crates/cadence/src/store/writer.rs:287` but propagated errors without setting the resident writer's failed latch. The existing persist path at `e0db1ca1:crates/cadence/src/store/writer.rs:1022` latches commit failure. Recovery can itself install transaction participants (`crates/cadence/src/store/transaction.rs:583`), so its failure must also require a replacement owner. Removing the injected intent directory must not revive the resident: the unchanged boundary test explicitly requires another -32603 at `crates/cadence/tests/mcp.rs:1015` and then proves a replacement can record the refusal at lines 1017-1023.

The same unconditional refresh also erased the distinction between Read and ReadVerified. The unchanged `crates/cadence/tests/store.rs:897` requires the prior confirmed view after foreign snapshot damage. Read now returns that cached view after checking the failed latch; verified reads and writes still lock, recover and observe before admission. Recovery failure now sets the same failed latch as commit failure. No unleased source or test was edited.

Signed correction: `2701801ee9b1c3e7353322738c382b5bb82cda45`, `fix(store): retain failure and cached-read contracts P7-1-T1`, signature G. Only `crates/cadence/src/store/writer.rs` committed. Lease check passed, no deletions. Frozen check exited 0 with empty output.

Prediction: unchanged MCP regression 1 passed, cached-read regression 1 passed, guard target 56 passed; typecheck exit 0 without diagnostics. Observed exactly those test results and typecheck exit 0 (npm emitted its two normal invocation notices).

| Verification command | Exit | Output SHA-256 | Captured output |
| --- | --- | --- | --- |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp execution_calls_store_failure_never_acknowledges_a_refusal` | 0 | `098538128b8ae4c634d93a59e241b5eec6a5f8252ecb27d3ec4655f71d9a84e1` | `/tmp/cadence-p7-resume-receipts/mcp-regression.log` |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test store checked_snapshot_verified_read_and_conditional_replacement` | 0 | `f55a030bf358456f2a87b8545b65e187e7bf4ecee8996029c6a380f75519b09a` | `/tmp/cadence-p7-resume-receipts/store-cached-read.log` |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` | 0 | `57862ca351c6b48421d0eb3df35cf974b41f6cdb100e44a1671debea42040937` | `/tmp/cadence-p7-resume-receipts/P7-1-T1-verify.log` |
| `TMPDIR=/tmp npx tsc -p tsconfig.ci.json` | 0 | `c66a12b6e1cf23424ff7c6a3454c7c2c71c6c44b2ff5ebe6b94d82fe6f3d7713` | `/tmp/cadence-p7-resume-receipts/typecheck.log` |

### P7-1-T7: real-host proof

Kept the previous native hook registration, manifest compatibility test, scanner/policy documentation and disposable fixture structure. Corrected `crates/cadence/tests/phase7_live.rs:322` to bind an unambiguous pending tool call to its hook_started identity and then join hook_response by hook_id and session; an intervening Read or another hook response cannot clear that match. Missing, unstarted or ambiguous evidence fails. Two ordinary tests cover that correlator and explicitly do not claim live evidence.

The probe now also requires actual tool results (`phase7_live.rs:219`), joins durable records by host event identity plus command digest (`:240`), verifies input-specific diagnostics and torn-layer host reasons, checks protected main in the durable record, and captures confirmed state/items/decisions digests. Write and Edit require both native deny JSON and actual tool refusals with unchanged state bytes (`:601`). No criterion or assertion was weakened.

Context7 current official host documentation confirmed zero-exit PreToolUse JSON and streamed hook lifecycle events (https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/cli-reference). Installed help was rechecked. Registered Bash/Read/Write/Edit tools and default permission mode were read from each actual system init event. The exact PLAN-1 Notes invocation was used, with isolated settings/MCP paths and stdout plus stderr captured together. No debug-output inference or permission bypass was used.

Prediction: 2 correlator tests pass, live test ignored in ordinary target; prescribed ignored live verify passes 11 cases. Observed: 2 passed / 1 ignored, then 1 live test passed in 166.31 seconds, all 11 cases completed. After that ordinary run, its two fixed event arrays were changed from Vec literals to arrays; the required full suite validates that final test source. No live-case logic changed after its invocation.

- Correlator: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_live`; exit 0; SHA-256 `c2afca02c0c8490bdd6d492a80c07800a92e308647261b78cea0c1336d5226c5`; `/tmp/cadence-p7-resume-receipts/live-correlator.log`.
- P7-1-T7: `TMPDIR=/tmp RUSTC_WRAPPER= CADENCE_PHASE7_LIVE=guard cargo test -p cadence --test phase7_live -- --ignored --nocapture`; exit 0; SHA-256 `e7520f8c0cd5d164ff41142486ce1be60929a5e2fd21677f09a330256eeb453b`; `/tmp/cadence-p7-resume-receipts/P7-1-T7-verify.log`.

Live host: Claude Code 2.1.263, Git 2.55.0. Captures: `/tmp/cadence-phase7-live/guard-run-yUJz4N`; versions, binary/help/settings/host-stream/store digests and before/after Git identities are recorded in `docs/validation/phase-7-live.md`.

Observed against that real host:
- Protected refuse produced native deny, a tool refusal, unchanged HEAD and a confirmed Deny record. Protected ask produced native ask, an unapproved tool result, unchanged HEAD and a confirmed Ask record. Configured pass executed a validly signed new commit.
- Push produced native ask; the fixture-local bare remote's refs stayed unchanged. The unrelated printf ran successfully, returned silent hook stdout and created no decision log.
- Git was deliberately removed only from the hook PATH. Default policy let the host's Bash Git command create a validly signed commit, with loud Git stderr and a confirmed FailurePass record naming Git.
- Deliberately torn default config produced native ask and the defaults-versus-user-settings reason in both hook output and durable record. Readable refuse from the other layer retained deny through the tear with that reason appended.
- Hard-fail on provably protected main denied with Git missing. A subsequent deliberate config tear plus missing Git also denied, recording both unavailable inputs. Neither command changed HEAD.
- Write and Edit both reached the native guard, returned deny and actual tool refusals; state bytes stayed identical.

All live operations targeted disposable repositories and a local bare remote under /tmp. Audit validation opened a fresh store after each host and hook process exited, confirming the persisted generation and record integrity. Hook ask is recorded as ask; no interactive approval or publication is claimed. AC1/AC2 live evidence is now complete for this plan. T7 commit remains pending the required full suite.

### Required full suite and final disposition

Prediction: every workspace target passes; Clippy exits 0 with warnings denied; fmt reports no differences. Observed: exact supplied chain exited 0. Workspace total 409 passed, 0 failed, 1 deliberately ignored real-host test (separately passed above). MCP target: 16 passed, including the unchanged persistent-failure assertion. Store target: 17 passed, including the unchanged cached-read assertion. Clippy finished successfully with `-D warnings`; fmt emitted no differences. Typecheck separately passed as recorded above.

Command: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
Exit: 0. Output SHA-256: `6d4a7fb1ce114eef4dbbbfafc1072f903b88780f230a5fa0285b008cf8f1f63a`. Captured output: `/tmp/cadence-p7-resume-receipts/full-suite.log`. One full-suite invocation this continuation, before the final task commit. No failed verification was bypassed or weakened.

Final signed commits from this continuation:

| Task | Status | Full commit SHA | Signature |
| --- | --- | --- | --- |
| P7-1-T1 regression correction | completed | `2701801ee9b1c3e7353322738c382b5bb82cda45` | G |
| P7-1-T7 live-host proof | completed | `41f16a9cadfdcb4aa76d9b77ef47efc42ef19bb3` | G |

Final gates matched prediction: only declared source files committed; original report bytes preserved as a prefix; no unexpected deletions or generated files; no boundary-test edits. `git diff --exit-code v3.7.12 -- cadence-core/` exited 0 with empty output (SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). Final HEAD: `41f16a9cadfdcb4aa76d9b77ef47efc42ef19bb3`. Only this appended report remains modified and uncommitted. No push, git-config changes, dependency changes, extra agents or attribution were introduced.

PLAN COMPLETE
Plan: `.planning/phases/7/PLAN-1.md`
Tasks: 7 of 7 satisfied; previously verified tasks retained, T1 regression corrected and T7 completed.
Deviations: none to the settled decisions, lease or acceptance criteria.
Open items: none within PLAN-1. Print-mode asks prove hook ask and withheld execution, not a human approval; the probe and validation document preserve that distinction.
