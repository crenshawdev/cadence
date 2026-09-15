PLAN COMPLETE
Plan: /code/cadence/.planning/phases/2/PLAN-3.md
Tasks: 6 of 6

| Task | Commit | Note |
|---|---|---|
| 1 | 74268389 | Dev-only harness tools; all Verify clauses pass. |
| 2 | 9dc8b48c | Machine code on non-ok arms; all Verify clauses pass. |
| 3 | 3e35298b | Typed loader and corrupt-copy controls; all Verify clauses pass. |
| 4 | 43bf5610 | Intact disposable bundles; all Verify clauses pass. |
| 5 | cd0c18bd | Named comparisons, normalization, fatal insta rendering and controls; all Verify clauses pass. |
| 6 | a4fa407e | Complete compared/pending accounting; all Verify clauses pass after one implementation repair. |

Deviations: no acceptance criterion or locked decision changed; one unexpected verification failure and its implementation correction are documented under Task 6.
Open items: 2 — incidental milestone-prune source note is inaccurate; a constructed root/rule intersection order control is declined because Verify requires substitution presence, which the committed stdout control proves. Implementation performs roots first.

## Dispatch
Read contract, HEAD plan at 6c920588, CONTEXT amendment and plan-2 report in order. Plans 1 and 2 accepted complete per dispatch. Frozen diff clean before changes. No network; Context7 skill read, cached crate source used under explicit offline constraint. No package.json exists at root; final runner will use the established repository Node runner after resolving workflow.test_command. No prior work re-run. Reports exempt and uncommitted.

## Task 1 prediction
Normal graph insta/tempfile count 0; dev edges contain insta/tempfile/regex; new regex package count 0; locked build and tests exit 0; only dev block added and lock gains additions.

Task 1 observed: normal count 0; dev insta 1.48.0/tempfile 3.27.0/regex 1.13.1; new regex packages 0; lock +103/-11; dependencies block unchanged. Offline build, locked build/test (6 envelope + 4 MCP), clippy and typecheck exit 0. Offline resolver also downgraded js-sys 0.3.105 to 0.3.104 and wasm-bindgen family 0.2.128 to 0.2.127; no criterion forbids resolver-selected versions. Lease ok:true, signed commit, no deletions or stray artifacts, frozen diff clean. Task-level cargo test runs explicitly required by Verify; the final project suite remains unrun.

## Task 2
Prediction: six envelope/four MCP tests pass, >=3 code literals, zero error constructors. Observed: six envelope tests plus one name-matching MCP test pass; separate MCP target four pass. Counts 5 and 0 (grep zero-match exit 1 expected). Exact JSON asserted on all three arms, structured code retained with is_error != true. Clippy/typecheck exit 0. Caller search found only Ok construction in server, no other production callers to edit. Lease ok:true, signed atomic commit, no deletions/strays, frozen diff clean.

## Task 3
Prediction/observed match: 3 tests pass, recordings=156 invocations=156 rules=6; independent ls and Node rule count 156/6; source counts node literal=0, deny_unknown_fields=4, normalization.json=3. Manifest inspection confirmed ELEVEN keys including string offline/global_config/refusal_source and object setup. Nullable fields are required in recordings, stdout accepts only object/null, node is decimal string. Bad target returns normalization.json plus rule id; truncated recording returns filename. Generic copy helper is needed now for negative controls and reused by Task 4. Clippy/typecheck exit 0; lease ok:true, signed commit, frozen diff clean and no deletions/strays.

## Task 4
Prediction/observed match: 5 golden tests green, bundles_materialized=17, independent manifest count 17. Every copied path and file byte compared; nonexistent-bundle error names bundle. Materializer returns owned TempDir, refuses traversal and non-directory names, reuses copy helper. Clippy/typecheck exit 0; lease ok:true, signed commit, frozen diff clean, no deletions/strays.

## Task 5
Prediction/observed match: 17 golden tests pass. Source counts insta::=2, set_snapshot_path=1, Regex=3. Targeted should_panic run shows insta -/+ lines naming replay and child snapshot assertion failure, then the parent expected panic. Logs: plan-3-work/task5-tests.log and insta-diff.log. The final renderer run inherited INSTA_UPDATE=always, INSTA_FORCE_PASS=1 and INSTA_OUTPUT=none; it still rendered the diff and failed as intended, because the isolated self-test worker clears ambient environment and pins update=no, force_pass=0, output=diff. No unsafe global environment mutation, no runtime operation driver, and no Node subprocess. Snapshot and actual text files remain in TempDir; no repository snapshot artifacts.

One shared adapter explicitly converts ok:true to status:ok and ok:false reason to code plus prose. Raw unadapted JS success is a negative status control. Refusal code control tests all three allowed non-ok tags. Null read-trace/subagent-trace/git-guard recordings use the reserved files-only path; the git-guard object branch projects hookSpecificOutput.permissionDecision and rejects allow. Every branch compares files and deleted, including absent/extra file names. Presence markers distinguish missing from null. Projection fields inserted in table order and all nested objects rebuilt in sorted order; reversing nested map insertion order gives identical serialized text.

Seven D-06 seed keys map to replay-check (replay, dispatch_set), plan-overlap (overlaps, frontmatter_issues), status (phases.*.status, cursor.agrees), worktree-base resolve (parallelSafe). Additional narrow control rows are trace append (written, corr), cursor set (cursor.status, cursor.updated), capture (file); hook rows explicitly reserve null/decision shapes. Empty keys fail construction by operation. No drift/undeclared search or invented holder.

Normalization substitutes fixture then repository roots in stdout strings/keys, file names/bytes and deleted; before-tree lines receive the same substitution. File rules skip the UNION of all pre-run tree lines and use replace_all with NoExpand. Real appended trace instant and cursor day normalize back and pass. A non-clock byte and a re-stamped seed each fail files[.planning/trace.jsonl]; the seed control verifies the changed first line became <NOW>, which differs from its recorded literal timestamp. Committed moved UAT files in milestone-prune remain unchanged, proving tree-wide skip. Root-presence control uses capture-ok stdout.file, verifies it contains <FIXTURE>, injects a real TempDir path, passes with substitution, fails file with identity roots. It makes no claim to prove ordering.

Source finding (not a changed acceptance criterion): PLAN-3.md:285-286 says milestone-prune-ok carries frontmatter_issues. Read correction commit 6c920588 before interpreting it. milestone-prune-ok.json stdout at lines 28-52 has no such key; matches elsewhere are prose in captured file bytes. plan-overlap-malformed.json:56 does carry the decision key. Assigned it there, satisfying Action's controlling instruction to use actual stdout and all Verify/locked criteria. No recording edited, no checkpoint needed for this incidental source attribution.

Clippy/typecheck exit 0 after rendering adjustment; lease ok:true, signed atomic commit, frozen diff clean, no deletions/strays, golden directory diff stat empty. No criteria weakened or rewritten.

## Task 6 initial verification
Prediction: 25 golden tests and 35 total Rust tests pass, summary compared=0 pending=156. Observed: 20 golden passed and 5 failed before comparison at task-record-ok.json metadata check; the following Verify-required root Rust run repeated those failures. Clippy/typecheck were green. [deviation] Expected direct argv equality between manifest and recording, observed eight invocations with <BASE>/<HEAD> expanded to fixed fixture SHAs. This was an extra implementation check, not a plan criterion. record.mjs:286 maps argv through substitute. Removed only that invalid extra check; invocation/operation/bundle/script/stdin binding checks remain, and argv stays typed provenance for future drivers. No recording defect, no recording edit, no criterion change. One bounded implementation repair, retaining initial logs under task6-first-*.

## Task 6 final verification
Repeated prediction unchanged after argv repair. Observed: 25 golden tests pass, compared=0 pending=156, 74 pending operation ids printed; reference recording count 156. Full Verify-required Rust test command passes 6 envelope + 25 golden + 4 MCP = 35 tests. Four required negative controls pass and name missing/extra recording, unknown operation and empty activated projection. Additional controls refuse an absent projection, account for all replay-check invocations through an intact materialized bundle, and force a wrong driver's replay through the fatal insta path. The two FAILED snapshot_worker summaries inside nocapture output are deliberate child failures asserted by should_panic controls; outer suite result is 25 passed, zero failed. Logs: plan-3-work/task6-golden.log and task6-rust.log.

Production activations remain empty. The walker receives both tables, validates the entire manifest/recording bijection and all activation keys before invoking drivers, and retains compared/pending invocation names. No test name contains parity; the only occurrence is the opening comment explicitly denying a parity claim. No Rust integration test spawns Node. Static analysis passes, lease ok:true, sixth signed atomic commit, no deletions/strays, frozen diff clean. Report remains PLAN PARTIAL until the final project suite after this commit succeeds.

## Final suite and completion
Resolved workflow.test_command through the required config.mjs reader after Task 6 commit/report write: null. Invoked repository runner TMPDIR=/tmp node cadence-core/bin/test.mjs with stdin /dev/null, plus RUSTC_WRAPPER= cargo test --offline --locked. Prediction both exit 0. Rust completed exit 0: 6 envelope, 25 golden, 4 MCP tests. Node completed exit 0: 3751 tests passed, zero failed/cancelled/skipped/todo. Exactly one final project-suite run, no repair needed. PLAN COMPLETE written only after both runners passed. All six git verify-commit calls already passed with requested RSA key fingerprint 904A3ED971D189EBDEABCCA6693AB15F91734B0C and John Crenshaw identity; exact SHAs/subjects/signature output in plan-3-work/signatures.json. Scope diff includes only four leased files. Working tree contains only exempt reports. No git config file writes, push, tags, attribution or delegated work.

## Spot checks
| Path:line | What to check |
|---|---|
| crates/cadence/Cargo.toml:60 | All three comparison crates are dev-only. |
| crates/cadence/src/envelope.rs:49 | Machine code precedes prose reason on refusal; other arms follow. |
| crates/cadence/tests/golden.rs:354 | Seven decision keys assigned to operations; reserved hook entries. |
| crates/cadence/tests/golden.rs:468 | Root substitution precedes rules; pre-run skip is tree-wide. |
| crates/cadence/tests/golden.rs:606 | Temp snapshot renderer pins update/force-pass in an isolated worker. |
| crates/cadence/tests/golden.rs:1033 | Manifest bijection and activation validation before compared/pending walk. |

Final boundary check after suite: git diff --quiet v3.7.12 -- cadence-core/ exits 0; git diff --stat 6c920588 -- crates/cadence/tests/golden/ emits nothing. Exactly the four leased paths changed from starting HEAD. Branch cadence/binary-owns-process. Only exempt reports are untracked, index clean. Evidence: plan-3-work/final-checks.json, node-suite.log and rust-suite.log. All six tasks satisfied, no criterion checkpointed, no outstanding approval. The only incidental plan source finding is the milestone-prune stdout attribution above; it does not prevent fulfilling any criterion. compared=0 pending=156 remains the honest instrument result; no binary operation is activated and no agreement claim is made.
