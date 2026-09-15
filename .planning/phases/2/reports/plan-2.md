PLAN CHECKPOINT: human-verify
Plan: /code/cadence/.planning/phases/2/PLAN-2.md
Tasks: 5 of 5

| Task | Commit | Note |
|---|---|---|
| 1 | ac1f7df4 | 47 git invocations, pinned repositories and structured setup; all Verify clauses pass. |
| 2 | d88dc0f1 | Discovered created/changed/deleted files for every invocation; all Verify clauses pass. |
| 3 | c2376bdb | Six shared clock rules and 14-invocation subset; all Verify clauses pass. |
| 4 | e571d9c3 | Full 156 recordings, taint assertion, environment/clock controls; all Verify clauses pass after support-directory correction. |
| 5 | 0f0fa9a0 | Scratch drift comparison, Node-major guards, Node 26 CI; all local Verify clauses pass, next PR human observation pending. |

Deviations: no acceptance criterion or locked decision changed. One unexpected verification result and its in-scope correction are recorded below.
Open items: 1 — next pull request must show golden-drift green beside existing jobs. A real cross-major run is unavailable by environment and explicitly replaced by the metadata-skew proof in the plan.

## Dispatch discipline
Read executor contract, HEAD plan (fa82602e), plan-1 report and CONTEXT in the requested order. Accepted plan 1 COMPLETE per current dispatch despite its stale report status; never rebuilt or reverified it. Read the correction diff before interpreting surprising prose. No network, runtime changes, fixture changes, repository config changes, pushes, repository tags or attribution. Git local configuration is only inside disposable repositories as Task 1 explicitly requires. Reports are uncommitted and exempt from lease. Report rotation consulted; no previous plan-2.md existed. Context7 instructions were read but external documentation was unnecessary for this script extension and unavailable under the no-network instruction.

## Task 1
Prediction: 47 git invocation pairs byte-identical; alternate TMPDIR preserves both 40-hex risk SHAs; risk/debt exit 0 and stdout.ok true; written CAPTURE marker with stdout count; forge configured github; no gpgsig/GPG hits.
Observed: all passed. SHA pair d13361766710e28b272adcd3fc8b0b220c6f4bc2 / e0e0f7c8b6ed7e26f96185aaba2bd891e8b4c70a. Debt markers=1, files=2; CAPTURE names `literal policy fixture`. Forge action=configured, provider=github. Raw output and reproduction: plan-2-work/task1-results.json and verify1.py.
Initial implementation probe failed before any recording write because git init --template= does not create .git/info. Created that directory before writing exclude; one bounded repair, same prediction and full targeted re-run passed. This was an implementation defect, not a false plan criterion.
Task 1 Verify requires the written debt artifact ahead of Task 2, so it includes narrow debt capture. Task 2 will replace this with discovered tree-wide mutation capture; no final per-operation mutation list is intended.
Static command detection: workflow.lint_command null; detect-commands returned cargo clippy --all-targets -- -D warnings and npx tsc -p tsconfig.ci.json. Spawned both, with RUSTC_WRAPPER= and --no-install for offline execution, exit 0. Lease gate ok:true/staged:49. Signed commit by John Crenshaw with requested key. Post-commit no deletions, only exempt reports untracked, frozen diff exit 0. 52 recordings now exist (5 inherited + 47 git).

## Task 2
Prediction and observation matched: trace append writes exactly .planning/trace.jsonl, original seed prefix plus one line with the argv event; cursor set writes Status: planned; status and cursor get have empty files/deleted; read-trace stdout null, exit 0, reads.jsonl written; archive-mode milestone-prune records 18 resulting files and 16 deletions. Cite-count and risk-check append trace events, both route resolve arms write nothing. cursor-get-slice retains its frozen exit 1; this Verify requires only its empty mutation map, not success. No fixture repairs or plan-1 verification.
Reproduction and per-invocation results: plan-2-work/verify2.py and task2-results.json. Snapshots exclude git internals and recorder-owned .golden-env support; symlinks elsewhere fail rather than follow escapes. The temporary task-1 debt capture is removed. Pre-run Buffer map remains available for Task 3's tree-wide line union.
Clippy and typecheck exit 0; staged paths individually and lease ok:true. Signed atomic commit, no deleted repository files, no unexpected untracked paths, frozen diff exit 0. No full-suite run yet.

## Task 3
Prediction and observation matched: six named-fields rules; cursor stdout and STATE updated become <TODAY>; original seeded trace lines retain their literal ts and appended line gets <NOW>; --no-normalize changes both recordings. Scratch absent file, invalid JSON and invalid regex each exit 1 with exactly one diagnostic and unchanged recordings. Scratch rule matching twice on the cursor date produces 20<TODAY>-<TODAY>-06, proving global replacement. Moved UAT started/updated lines retain original dates through tree-wide line union. Reproduction and raw evidence: plan-2-work/verify3.py and task3-results.json.
Only 14 invocations recorded, through --only: cursor set, trace append, read-trace, four UAT writers, milestone-prune and all six provider arms. No full manifest run. All six provider arms have empty files; config has neither STATE.md nor trace.jsonl. beginProviderCall is reached but traceProvider returns at review-provider.mjs:602 on null cursor, so no duration_ms rule. Capture selects todo/invalid, never note: no unused capture rule. Rotation and mirrorFiled remain unreachable under the manifest. renderUat at lib/planning-files.mjs:1889 emits bare started:/updated: frontmatter lines.
Pipeline is scratch-to-<FIXTURE>, repository-to-<REPO>, then named rules, with the same path substitution on pre-run lines. Rule loader validates names, targets, sites, required fields, shared regex restrictions and literal replacements without $. All current patterns use [0-9], never \d. File rules split and rejoin newline text and skip the union across all pre-run paths. stdout dotted keys are no-ops when absent or non-string.
Clippy/typecheck exit 0, lease ok:true, signed atomic commit, post-commit no repository deletions or unexpected artifacts, frozen diff exit 0.

## Task 4
Prediction: tainted stderr refuses before writing, two consecutive full runs and alternate cwd/TMPDIR/TZ/LC_ALL/HOME and settings overrides are identical, no unexplained paths/dates/hostname/duration fields, 156 recordings, negative clock run differs on cursor/trace.
[deviation] Expected no unexplained absolute-path matches; the first full sweep found /home/.config/cadence/providers.env inside the already-substituted <FIXTURE>/.golden-env/home/.config/cadence/providers.env. Frozen review-provider.mjs:250 derives that suffix from recorder HOME. Renamed the recorder-owned directory from home to user-home, preserving the exact grep criterion and all normalization rules. No fixture or frozen code changed. This is a corrected recorder implementation choice; no definition of done changed and no structural checkpoint was needed. Prior evidence: plan-2-work/task4-first-results.json.
Repeated the affected full verification after that one correction with prediction stated again. All passed: two full runs identical, root / with alternate TMPDIR/TZ=Asia/Tokyo/LC_ALL=de_DE.UTF-8/HOME identical, three overrides pointed at separate empty files identical. One absolute path remains in the raw recording sweep, sourced verbatim from fixture prose. Date-shaped values all occur in fixtures, manifest or recorder constants; the intentionally malformed 2026-13-45 is a fixture input. Seven recordings carry <NOW>, six carry <TODAY>. Decoded files scan finds no numeric duration_ms. Six provider arms remain file-free due to absent cursor at review-provider.mjs:602, not an early beginProviderCall return.
Full --no-normalize scratch run differs on 13 recordings, including cursor-set-ok and trace-append-ok. --taint-stderr exited 1 with `status-slice: captured hostname and pid taint` before any write, with empty recording git status against the committed set. It checks hostname over the recording while excluding supplied paths and checks only whole decimal pid tokens in stdout/stderr, preserving unexpected temp suffixes as detectable. No rule was added.
Reproduction/evidence: plan-2-work/verify4.py and task4-results.json. 156 invocation files over 74 operation values and the 17 inherited bundles. SUMMARY is orchestrator-owned; these counts are handed off here instead of writing it. Clippy/typecheck exit 0, lease ok:true, signed task commit. No repository deletions or unexpected untracked artifacts; frozen diff exit 0.

## Task 5
Prediction and observation matched for every local clause. --check exits 0 without output or recording writes. Appending x to status-slice.json yields exit 1 naming crates/cadence/tests/golden/recordings/status-slice.json: different, leaves the damage intact and is then restored from git. Scratch node:24 against runtime 26 makes both --check and default emit exactly one major-mismatch line with both values and CI migration explanation, exit 1, with no per-file comparison lines and clean scratch git status. --allow-node-change fully regenerates that scratch copy byte-identically to all 156 committed answers. Additional bounded missing/extra test names both files and leaves them unchanged.
CI parse yields cargo-test, golden-drift, node-test, self-verify, typecheck. The golden job's Node 26 equals every recording node value. All nine uses lines carry 40-hex SHAs. Old workflow is an exact byte prefix of new workflow; diff stat is 12 additions, no deletions; concurrency retained and new job has no fetch-depth or install dependency.
Evidence/reproduction: plan-2-work/verify5.py and task5-results.json. Clippy/typecheck exit 0, lease ok:true/staged:2. Signed atomic task commit; post-commit no deleted paths or unexpected untracked artifacts; frozen diff exit 0. Human-verify clause at PLAN-2.md requires the next pull request's golden-drift job to appear green. No push/PR run performed, as dispatch prohibits pushes. Local implementation is finished; final suite follows before digest.

## Final suite and handoff
Resolved workflow.test_command with the required config.mjs reader after task 5 commit; result null. Ran the repository's declared Node runner `TMPDIR=/tmp node cadence-core/bin/test.mjs` and `RUSTC_WRAPPER= cargo test --locked`, with unused stdin ignored. Prediction: both exit 0. Observed: Node exit 0, 3751 tests passed, 0 failed, 0 skipped; Rust exit 0, six unit tests and four MCP tests passed. Exactly one full-suite run; no repair or confirmation needed. Logs: plan-2-work/node-suite.log (totals at 3754) and rust-suite.log. These are Plan 2 final checks, not a replay of plan 1.
All five task commits verified by git verify-commit with exit 0 and the requested signing identity/key. Full SHAs and signature output: plan-2-work/signatures.json. No further repository edits after the task commits. Final counts: 156 recordings, 74 distinct operations, 17 inherited bundles, 6 named normalization rules. Default and check Node pin is 26. The only working-tree artifacts outside the committed work are exempt reports and their scratch evidence. No staged changes. No fixture builder/bundle, Rust source/manifest, release-path or cadence-core changes. No plan criteria were rewritten.

## Cheap spot checks
| Path:line | What to check |
|---|---|
| crates/cadence/tests/golden/record.mjs:27 | Disposable git setup with fixed identity, dates and manifest history. |
| crates/cadence/tests/golden/record.mjs:66 | Sorted before/after tree capture, with no per-operation mutation declaration. |
| crates/cadence/tests/golden/normalization.json:5 | Named trace clock rule and frozen source site; six total rules. |
| crates/cadence/tests/golden/recordings/cursor-set-ok.json:39 | stdout cursor.updated is <TODAY>; line 44 contains normalized written STATE. |
| crates/cadence/tests/golden/recordings/trace-append-ok.json:38 | Seeded ts values remain literal and appended ts is <NOW>. |
| .github/workflows/test.yml:94 | Added golden-drift job; line 103 pins Node 26. |

CHECKPOINT: human-verify
Current task: 5 — observe golden-drift on the next pull request
Need: orchestrator/human confirmation that the next PR shows golden-drift green beside the existing jobs (PLAN-2.md:485–486). No push is authorized in this dispatch, so that observation cannot be produced locally. All five implementation tasks and every local Verify are satisfied, and the final suite is green. This is not a code/criterion disagreement. Executor contract SKILL.md:207 requires a checkpoint when “the plan marks a task as human-verify”; therefore this report does not claim PLAN COMPLETE before the remaining observation.
