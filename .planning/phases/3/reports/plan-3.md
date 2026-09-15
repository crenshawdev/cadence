PLAN COMPLETE
Plan: /code/cadence/.planning/phases/3/PLAN-3.md
Tasks: 5 of 5

| Task | Commit | Note |
|---|---|---|
| 1 — Deterministic recall core | ff5d0be7ae44800f376c6f8ae4e94419b91855a7 | Predicted and observed 41 binary tests passed, zero failed. Clippy and TypeScript passed. Lease accepted 4 paths. Required signature verified G; no deletions. |
| 2 — Authored prose adapter | 13f83a20902b3edb61ece220ebe06a1fe7058a04 | Predicted and observed 45 binary tests passed, zero failed. AC7 response inspected directly. Clippy/TypeScript green; lease accepted 3 paths; signature G; no deletions. |
| 3 — Git retained memory | 68120332002654a9590e896ec0cc9ee84d2ecec6 | Predicted and observed 49 binary tests passed, zero failed. Clippy/TypeScript green; lease accepted 4 paths; signature G; no deletions. |
| 4 — Resident owner and invalidation | ee2823331b1d2bc8aca4c43cc7a8e9a537ee0712 | Fresh prediction and observation: 52 binary tests and 4 MCP tests passed, zero failed. Clippy/TypeScript passed; lease accepted 3 paths; required signature G; no deletions. |
| 5 — Import and process continuity | 16c69f0bea75b8a8a7fd75077ccbcb4654a38039 | Predicted and observed 54 binary tests passed, zero failed, including three production-service child processes. Clippy/TypeScript passed; lease accepted 2 paths; required signature G; no deletions. |

Deviations: 2 historical entries, both resolved — the missing Sync bound and the no-lock wording corrected by John in fb0146c3. No Verify criterion was changed.
Open items: none. All five tasks and the final full workspace suite are complete.

Read the published executor contract and lean-build reference, PLAN-3, CONTEXT, PROJECT, and both prior plan reports. The supplied 72-test green baseline supersedes historical checkpoints; prior work was not replayed. No CLAUDE.md dependency. The pre-existing PLAN-2 report modification is preserved. No prior PLAN-3 report existed to rotate.

All Cargo commands use RUSTC_WRAPPER= CARGO_NET_OFFLINE=true CARGO_HOME=/code/cadence/target/store-cargo-home TMPDIR=/tmp. Test fixtures and scratch trees are external. Published workflow.lint_command returned null; detect-commands selected Clippy and TypeScript. Node subprocesses use ignored stdin; TypeScript runs through the installed executable, without npx/install. Commit author and committer are John Crenshaw <john@jcrenshaw.dev>, signed with 693AB15F91734B0C. No configuration writes, installations or pushes.

Task 1 reads the eligible item projection, uses identity-only decline metadata to filter supplied historical candidates before indexing, and includes semantic decision fields without indexing raw item events or origin quarantine. BM25/tokenization/rendering are pure. Frozen bm25.mjs and planning/recall.mjs were read with git show. Four tests cover controlled ties, repeated terms, frozen suffix relationships and raw-stopword ordering, default five and full totals, zero hits, invalid limits, disabled/unknown backends, and decline exclusion including identical scores against a corpus with the declined candidate removed. The module is explicitly mounted in server.rs; its internal surface awaits production composition in Task 4 and public tool selection in phase 5.

Task 2 adds PROJECT/ROADMAP/CONTEXT/SUMMARY, phase UAT, task RECORD, and explicitly shaped retained archive homes, including this repository's _archive-* layout. Source selection never scans arbitrary markdown. Stable heading/paragraph snippets retain continuation text and phase spelling; an empty durable heading suppresses local Decisions and its nested headings. Links are conservatively skipped with a coverage reason, directory/read failures are explicit, and forbidden operational/quarantine/config sources are excluded. Four new tests prove one actual response with a real imported capture and CONTEXT.md:5, unchanged after legacy CAPTURE deletion; all other source classes; durable fallback rules; escaping links/forbidden names; and injected PermissionDenied coverage. No public MCP tools added.

Task 3 adds read-only HEAD-reachable git tree/blob traversal, explicit unborn/shallow/unavailable/missing-object coverage, identity-based history exclusion, and legacy ARCHIVE compatibility. Exact path/blob pairs parse once and candidate deduplication uses provenance, retaining independent equal prose. Residue preserves label, phase spelling and origin separately; its citation names the actual ARCHIVE file, with no invented source document or commit. Four new tests use external git repositories, required signed fixture commits, and a real depth-one clone. They inspect actual response hits for a removed decision's exact containing commit/path/line, retained archives, unchanged blob deduplication, residue-only input with unavailable git, unborn/shallow/failed-blob coverage, and current decline suppression through historical FILED and items.jsonl. Unrelated matching prose survives. Context7 git documentation consulted. The git adapter disables optional locks, prompts and lazy fetching; it never scans unrelated branches or reads historical DECLINED as evidence.

## Task 4 draft and checkpoint

CHECKPOINT: blocked
Current task: 4 — Attach queries to the resident owner
Need: Resume the existing three-file Task 4 draft. Add Sync to the ConfigIo + Clone generic bounds on Resident::spawn in crates/cadence/src/recall/mod.rs and CadenceServer::with_factory in crates/cadence/src/server.rs. State a fresh prediction, then rerun the unchanged Task 4 binary Verify. If green, run the MCP Verify, Clippy, TypeScript, lease gate, and required signed atomic Task 4 commit. Then implement/verify/commit Task 5 and run the final workspace suite. Do not replay Tasks 1–3 or weaken any criterion.

The draft composes SessionFactory into CadenceServer::new and adds internal store/recall methods backed by an mpsc owner with per-request oneshot replies. It resolves the frozen global config address convention without first-touch I/O. The owner holds the derived-index cache, reads sources through spawn_blocking, compares store/config generations and document/git inputs, and rechecks the store/config after preparation before rendering. Requests drain on sender closure and the factory releases session handles. The version-only public catalog is unchanged in source. These are implementation intentions, not verified Task 4 results.

Three drafted tests invoke the production handler through clones; exercise append, warm query, decline, document edit, backend changes and checkout; inject config PermissionDenied/malformed input; and test version laziness plus owner shutdown. No tests ran in this Task 4 attempt because compilation failed.

Prediction stated before Verify: cargo test -p cadence --bin cadence reports 52 passed, zero failed, followed by cargo test -p cadence --test mcp reporting 4 passed, zero failed.

Executed binary command:
`RUSTC_WRAPPER= CARGO_NET_OFFLINE=true CARGO_HOME=/code/cadence/target/store-cargo-home TMPDIR=/tmp cargo test -p cadence --bin cadence`

Observed: exit 101, error `future cannot be sent between threads safely` at recall/mod.rs:317, the tokio::spawn call. The compiler points to SessionFactory::first_touch awaiting sessions.lock() with a borrowed SessionFactory<I>; that reference is not Send because I is not constrained Sync. It proposes adding std::marker::Sync to Resident::spawn's I bound. The forwarding CadenceServer::with_factory bound must carry the same requirement. Production FileIo and the test switch adapter support Sync; the correction is local to the three-file draft's leased composition paths and does not require changing PLAN-2's service.

[deviation] Expected 52 binary tests passed and zero failed; observed compilation failure before tests executed. Stopped immediately without applying the compiler's suggested fix or changing the criterion, per the user's explicit prediction-first checkpoint rule. This is an implementation-bound defect; it does not disprove AC7 or a locked decision.

Task 4 MCP verification, Clippy and TypeScript were not run after this failed Verify. No Task 4 commit exists. Task 5 has not started. The full workspace suite was not run because the contract places it after the final task commit; the supplied green baseline remains 72 tests, while the latest successful run in this execution is Task 3's 49 binary tests. No new full-suite count or no-regression claim is made.

## Final checkpoint evidence

Task 1 ff5d0be7ae44800f376c6f8ae4e94419b91855a7, Task 2 13f83a20902b3edb61ece220ebe06a1fe7058a04, and Task 3 68120332002654a9590e896ec0cc9ee84d2ecec6 all verify signature G with key 693AB15F91734B0C and John Crenshaw <john@jcrenshaw.dev> as author and committer. Each passed its task's predicted binary count, required static checks and lease gate before commit. No deletions occurred across the committed range. The Task 4 draft's whitespace check passes. Nothing is staged.

The remaining source modifications are exactly crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, and crates/cadence/src/recall/tests.rs. The pre-existing PLAN-2 report modification is untouched, and this report is intentionally uncommitted under the sequential contract. Both the tracked diff against v3.7.12 and the untracked-file query for cadence-core return no paths. No installs, persistent git configuration changes, pushes or unauthorized real-path writes occurred. All fixture repositories and scratch trees used external TMPDIR.

AC7 evidence already committed in Task 2 inspects a single actual response with two hits: the imported capture identity and authored CONTEXT path/line, persisting after legacy CAPTURE deletion. Task 3 reinforces AC2 through the actual history-backed result collection: declined FILED/items identity yields zero matches, while independent matching prose remains. Pure-core tests also show declined candidates cannot alter scores or totals. Warm resident and process-restart proofs remain pending Tasks 4–5.

When git is unavailable, the implemented history adapter appends an explicit history-incomplete reason beside available live hits; residue-only evidence likewise remains citable with no fabricated commit. Shallow history and failed object reads are explicitly distinguished in coverage reasons. This behavior is verified in Task 3; the resident composition remains unverified.

## Authorized continuation: ownership check before the Sync change

The user authorized the two Sync bounds within the existing PLAN-3 lease and required checking whether they express legitimate cross-thread use or conceal a violation of locked decision 7. The existing report is extended in place as explicitly requested; no rotation discards or relocates the earlier run record. Re-read the published executor contract and lean-build reference, the task plan, phase context, and the relevant standing design constraint at ROADMAP.md:159-164. Read the concrete factory, session, config and writer ownership paths without rerunning or changing PLAN-1/PLAN-2 work. The published lint getter remains unset; command detection again selects Clippy and TypeScript. No static-analysis or Verify command was run in this continuation.

Sync verdict: the bound is genuine for the shared factory borrow retained across an await in a Tokio task that can migrate between workers, and does not share the uniquely owned writer or recall index, but it cannot resolve the separate existing violation of the stated no-lock constraint.

The narrow compiler explanation remains correct: Resident::spawn moves the factory into one owner task, first_touch borrows it as &self across await, and a Send future carrying &SessionFactory<I> requires that referent to be Sync. The concrete FileIo adapter is stateless. Handler clones contain only mpsc sender handles. The recall cache remains a local BTreeMap in the receiver task. Store handles likewise contain only senders; Writer<S, P>, its storage and mutable View remain owned by the dedicated store thread. No unsafe implementation or additional shared writable store is proposed. Context7's Tokio spawn documentation confirms the Send requirement on spawned futures.

The broader required check found lock primitives already on the production path:

- crates/cadence/src/import/mod.rs:447 stores the session registry in tokio::sync::Mutex<BTreeMap<PathBuf, Arc<Session<I>>>>; first_touch locks it at :475 and keeps the guard during initialization.
- crates/cadence/src/config/reload.rs:217 defines Shared<I> as Arc<Mutex<Reload<I>>>. Session::config in import/mod.rs:396-400 acquires it; the session and writer policy share that mutable reload cache.
- crates/cadence/src/import/mod.rs:353-355 gives SessionPolicy an Arc<Mutex<Option<ImportInputs>>>; first_touch constructs that guard at :507 and the shared config guard at :525.
- The Task 4 draft invokes factory.first_touch from both request arms and session.request/session.config from recall preparation. These are active dependencies of the proposed production composition, not unused imports.

The single writer and single recall-index owner are intact. The finding is the additional lock-backed factory/config state, so it would be false to describe the full composed path as having no lock primitive anywhere. These locks predate PLAN-3 and are outside its seven-path lease. The user explicitly repeated the no-lock rule; this continuation does not silently narrow it to store data alone or treat passing tests as permission to reinterpret it.

[deviation] The restated locked constraint says the single consumer is mutual exclusion with no lock primitive anywhere; the existing factory/config composition necessarily acquires Tokio and standard-library mutexes. Stopped before adding Sync, running Task 4 Verify, or committing. The defect is separate from the validity of the proposed Sync bound.

## Current structural checkpoint

CHECKPOINT: structural
Current task: 4 — Attach queries to the resident owner
Need: Resolve the inherited factory/config ownership conflict before resuming. To enforce the literal no-lock rule, authorize a separately scoped repair of the PLAN-2 factory/config ownership interfaces and their callers/tests, which are outside PLAN-3's lease; then resume Task 4 with a fresh prediction, unchanged Verify and required signed commit, followed by Task 5 and the final workspace suite. Alternatively, explicitly clarify that the rule is limited to store and recall-index mutual exclusion and that the existing factory/config locks are accepted; under that interpretation the already-authorized Sync bounds are sufficient to resume without a lease expansion.

Proposed direction if the literal rule governs: put the mutable session registry and reload/import state under their owning consumers and route requests/replies through those owners, preserving admission/final-policy checks and confirmed-write acknowledgements. This requires coordinating the existing factory, config reader/writer and policy interfaces; it cannot be honestly accomplished by a two-bound change in PLAN-3. No exact repair design or expanded lease is claimed to be approved. Impact is on service initialization and config policy ownership, not ranking semantics or the currently proven AC7/AC2 pure/history behavior.

Continuation outcome: no source edit, no new commit, no task Verify, no MCP test, and no full workspace suite. Tasks 1–3 remain committed; Task 4's prior three-file draft remains unchanged and uncommitted; Task 5 is not started. The most recent passing binary run remains 49 tests from Task 3, and the supplied full-workspace baseline remains 72 green tests. AC2's warm resident/restart proof is still pending and is not claimed. The pre-existing PLAN-2 report modification is preserved. No installs, git configuration changes, pushes or unauthorized writes occurred; this continuation wrote only this requested report.

## Ruling applied: Task 4 resumed

John's 2026-09-06 ruling in fb0146c33a0c25cc11ab71fabff5b90fa8e04fa7 resolves the structural checkpoint: the prohibition applies to the store and recall index; PLAN-2's synchronization for config, import and the session map stands. The earlier finding and checkpoint remain above solely as history, not an outstanding contradiction. No PLAN-2 locks are removed or reconsidered. This continuation appends in place as requested.

Sync verdict: the bound is genuine for the factory borrow held across an await in a migratable Tokio future, while the writer and recall index remain uniquely owned and serialized by their request consumers.

Added Sync only to CadenceServer::with_factory and Resident::spawn within PLAN-3's lease; no unsafe implementation or new lock was introduced. The published lint getter is unset; command detection again selected Clippy and TypeScript. Existing dependency documentation and published executor/lean-build guidance remain applicable. Tasks 1–3 are not replayed.

### Task 4 verification and signed commit

Fresh prediction: 52 binary tests pass with zero failures, then 4 MCP tests pass with zero failures. Observed exactly 52/0 (2.98 seconds) and 4/0. The Sync correction compiled successfully. No criterion was changed. Production handler clones share one import/store service; a read after the other clone's append observes the same generation. Warm recall initially returns the capture plus prose, then excludes the declined identity and its total contribution. A document edit replaces its live hit, memory.backend none returns explicit disabled output, restoring builtin restores hits, and checkout changes a historical citation into a live citation. Injected config PermissionDenied and malformed config refuse recall instead of using cached enablement. Version remains storage-lazy; accepted work completes and owners release after the last handle closes.

The MCP suite retains exactly cadence_version, its structured response and clean stdin-close behavior. Clippy with RUSTC_WRAPPER cleared and TypeScript through the installed executable with ignored stdin both passed. The lease accepted the three individually staged paths, and the commit verified G with key 693AB15F91734B0C and John Crenshaw <john@jcrenshaw.dev> as author and committer. No deletions or uncommitted source changes remain. The report is intentionally uncommitted. Status remains PLAN PARTIAL until Task 5 and the final green suite.

## Task 5: mixed recall and warm declines across process restarts

Prediction: 54 binary tests passed, zero failed; child generations 5, 6, 6. Observed exactly 54 passed, zero failed (7.05 seconds), including assertions for all three generations. The new child entrypoint and parent scenario are the two additional tests; the entrypoint returns immediately without its fixture environment during normal in-process enumeration.

The fixture extracts actual v3.7.12 .planning bytes with git archive into external TMPDIR and checks the four principal frozen inputs against git show before use. It adds a distinct authored tasks/recall-continuity/CONTEXT.md paragraph. Synthetic matching FILED rows are committed to fixture history, then the exact frozen FILED bytes are restored before first touch. Thus import sees the frozen originals, while history retains real earlier FILED evidence. Fixture commits use the required GPG key and identity. Child environments relocate global config into the same temporary tree; no real user config is written.

Each child invokes CadenceServer::new and its production store/recall methods. The first imports automatically, appends the native restart-mixed capture and two eligible filed identities through the owner, and commits their eligible items.jsonl revisions in the fixture. It queries the first item's unique term twice and inspects the returned identity, proving it reached a warm response. It then appends a decline through the owner and repeats the query twice: total zero, empty results. The unchanged earlier FILED and items.jsonl revisions remain reachable in git.

The second child is a fresh process. It verifies the first decline is durable and absent from recall after warming mixed-source recall. It then queries the second, still-eligible identity twice, confirms its single returned hit, declines it through the owner, and requires zero hits and total on repeated queries. This is a second warm-index transition performed after restart, not a cold-start-only test. A new authored document exercises document invalidation too. The third fresh process verifies that both declines remain absent. Distinct process IDs and generations 5, 6, 6 establish actual process reopening and no repeated import or duplicate append.

AC7 is checked in each child's actual response collection: exactly two hits for saffronotter cobaltnebula, one native record restart-mixed at revision 1, one authored tasks/recall-continuity/CONTEXT.md at line 3, both with live provenance. Full serialized answers are read back by the parent. Before/after restart comparisons require identical result order, score, snippet, citation, total and coverage for unchanged inputs. Combined mixed/declined queries also exclude the declined identity. The parent separately reads the fixture's historical items.jsonl commit and confirms both eligible filed revisions still exist, so their post-decline absence cannot be explained by deleting history. Original frozen config/STATE/FILED/DECLINED bytes remain equal at the end.

The architecture note documents ownership, the accepted synchronization scope, generation/source invalidation, source-read costs, unavailable-config behavior, and the process regression. Existing source eligibility, archive, provenance, limits and disabled/unknown semantics remain documented. No public MCP surface was expanded. Both static checks passed without repairs. Lease accepted the two individually staged files; the Task 5 signature verified G with the required owner/key, and no deletion occurred. Status remains PLAN PARTIAL until the full suite passes.

## Final validation: PLAN COMPLETE

The published workflow.test_command getter returned null. Selected cargo test --workspace from the Cargo workspace manifest and ran it once after Task 5's signed commit and partial report write. Prediction: 89 passed, zero failed, comprising the supplied 72-test baseline plus 17 PLAN-3 tests. Observed exactly 89 passed, zero failed: library 5, binary 54, MCP 4, store integration 16, crash/recovery integration 10, doc-tests 0. The full suite includes ac8_syscall_order and passes without a baseline regression. The binary group completed in 7.06 seconds. No repair round or repeated full-suite run was needed.

Command environment: RUSTC_WRAPPER= CARGO_NET_OFFLINE=true CARGO_HOME=/code/cadence/target/store-cargo-home TMPDIR=/tmp. Both resumed tasks passed cargo clippy --all-targets -- -D warnings with the wrapper cleared and TypeScript through the existing installed executable with ignored stdin before their commits. No implementation changed after those static checks.

Task 4 commit ee2823331b1d2bc8aca4c43cc7a8e9a537ee0712 and Task 5 commit 16c69f0bea75b8a8a7fd75077ccbcb4654a38039 both verify signature G with key 693AB15F91734B0C and John Crenshaw <john@jcrenshaw.dev> as author and committer. The explicit resumed implementation range passes git diff --check. No deletions occurred. Both tracked comparison against v3.7.12 and untracked-file checks for cadence-core returned no paths: the frozen tree remains byte-identical.

Final working-tree status contains only this cumulative report modification, intentionally left for the orchestrator's documentation commit. All requested implementation changes are committed atomically. The old blocked/structural checkpoint sections above are historical records, resolved by the authorized Sync fix and John's committed synchronization ruling; they are not current resume instructions. No outstanding checkpoint remains. No installs, persistent git configuration changes, pushes, attribution trailers, or unauthorized real-path writes occurred.

AC2's outstanding half is now proven in the production resident path: eligible hits were returned from warm queries before each of two durable declines, immediate repeated post-decline queries had empty results and zero totals, a second process preserved the first decline while performing the second warm transition, and a third process preserved both declines despite historical FILED and eligible items.jsonl revisions. AC7's actual mixed responses were inspected before and after process restart with exact live record and authored-file citations. Unavailable/shallow git continues to report explicit incomplete history alongside available evidence, as established by the committed Task 3 tests and preserved by the green suite.
