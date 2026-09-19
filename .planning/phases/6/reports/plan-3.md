PLAN PARTIAL
Plan: .planning/phases/6/PLAN-3.md
Tasks: 4 of 6
| Task | Commit | Note |
|---|---|---|
| 1 - Generate the patch schema from its real domain types | `073226dd` | Derived the patch schema from the deserialized domain types, removed the handwritten producer, and added independent nested schema/deserialization and opaque UTF-8 prompt cases. Predicted both V1 test commands would exit 0, execute the named schema/prompt cases and report zero failures, and the source search would find no handwritten patch schema. All held: 40 library tests and 11 service tests passed. Clippy, formatting and TypeScript checks exited 0 before commit. |
| 2 - Define the shared envelope and canonical receipt contract | `119dd749` | Shared the envelope through the library; defined tagged scope, versioned receipts, distinct failures, one terminal constructor, canonical bytes/digests and both size limits. Moved the legacy response representation without changing its persisted hash semantics. Predicted V2 would run 8 boundary tests and 12 service tests with zero failures; both held. Clippy, formatting and TypeScript checks exited 0 before commit. |
| 3 - Persist scoped decisions and return the writer's actual answer | `7275271e` | Added immutable versioned boundary records and exact-decision intents, separate root and execution budgets, canonical terminal receipts, typed confirmation selection, legacy read preservation and intent rejection fixtures. Predicted V3 would report 12 store tests and 3 compatibility tests passed, zero failed; both initial and strengthened reruns held. The strengthened budget case covers both saturation orders and unchanged terminal replay after reopen. Clippy identified an enlarged operation payload; boxing it and updating its test constructors passed the third static-analysis attempt. Clippy, formatting and TypeScript exited 0 before commit. |
| 4 - Make every service exit confirm or fail explicitly | `efe791c3` | Added resident malformed-argument refusal and phase-free apply entries, verified session and terminal lookup before semantic observations, read-only execution lifecycle/continuation checks, canonical confirmation on every service exit, and original-receipt replay after input revalidation. Predicted V4 would report 17 passed, zero failed. The first run reported 16 passed and one failed because the new fixture expected derivation-conflict instead of the existing state-conflict code; correcting that fixture and adding root-terminal coverage produced the predicted 17 passed, zero failed. Clippy, formatting and TypeScript exited 0 before commit. |
Deviations: 1 historical structural contradiction, resolved by D-28 before this continuation. [deviation] V4 predicted 17 passed and zero failed; observed 16 passed and one failed. The fixture code oracle was corrected from derivation-conflict to state-conflict; the rerun passed 17. No acceptance criterion changed.
Open items: none deferred. Tasks 5 and 6 remain outstanding. Public MCP registration, raw argument parsing and live UAT remain PLAN-2 obligations.

Continuation starting HEAD: `6868afa740a3ec2511078fa8ca7a730e8fe0bc04`. The working tree was clean. D-27 and D-28 govern this continuation. No installed-file identity protocol or storage-interface expansion is introduced.

Continuation evidence:
- `node cadence-core/bin/planning.mjs detect-commands --root /code/cadence`: exit 0; lint and typecheck match the commands below.
- Starting baseline `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`: exit 0; 312 passed, 0 failed (103 library, 139 binary, 70 integration, 0 doctests). Prediction of at least 299 passed and zero failed held.
- Starting baseline and Task 3 precommit `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`, and `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`: final exits 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`: exit 0, 12 passed, 0 failed, on both runs; final run 188.85 seconds.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`: exit 0, 3 passed, 0 failed, on both runs.
- `node cadence-core/bin/planning.mjs lease-check --phase 6 --plan 3`: exit 0, `ok:true`, seven staged paths.
- `git log -1 --format='%h %G? %GK %an <%ae>'`: exit 0; `7275271e G 693AB15F91734B0C John Crenshaw <john@jcrenshaw.dev>`.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD`: exit 0, no output.
- `git diff --exit-code 6868afa740a3ec2511078fa8ca7a730e8fe0bc04 -- cadence-core/ .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/phases/1 .planning/phases/2 .planning/phases/3 .planning/phases/4 .planning/phases/5 .planning/phases/6/CONTEXT.md .planning/phases/6/PLAN-1.md .planning/phases/6/PLAN-2.md .planning/phases/6/FALSIFICATION.md .planning/phases/6/FALSIFICATION-3.md`: exit 0, no output before the Task 3 commit.

Task 4 evidence:
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`: first exit 101, 16 passed, 1 failed; corrected rerun exit 0, 17 passed, 0 failed, 100.16 seconds.
- `TMPDIR=/tmp target/debug/deps/cadence-b6965766d460fad3 --exact server::execution_service_tests::execution_service_semantic_failures_confirm_but_log_config_and_queue_failures_do_not --nocapture`: exit 101, 0 passed, 1 failed; confirmed the fixture mismatch was actual state-conflict versus expected derivation-conflict.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0. The first formatting check requested one more formatting pass; final `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check` and `TMPDIR=/tmp npx tsc -p tsconfig.ci.json` exited 0 before commit.
- `node cadence-core/bin/planning.mjs lease-check --phase 6 --plan 3`: exit 0, `ok:true`, four staged paths.
- `git log -1 --format='%h %G? %GK %an <%ae>'`: exit 0; `efe791c3 G 693AB15F91734B0C John Crenshaw <john@jcrenshaw.dev>`.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD`: exit 0, no output.

Prior dispatch and checkpoint history, preserved verbatim below. Its proposed ruling and outstanding-task statements describe that earlier checkpoint; D-28 and the continuation record above supersede them.

PLAN CHECKPOINT: structural
Plan: .planning/phases/6/PLAN-3.md
Tasks: 2 of 6
| Task | Commit | Note |
|---|---|---|
| 1 - Generate the patch schema from its real domain types | `073226dd` | Derived the patch schema from the deserialized domain types, removed the handwritten producer, and added independent nested schema/deserialization and opaque UTF-8 prompt cases. Predicted both V1 test commands would exit 0, execute the named schema/prompt cases and report zero failures, and the source search would find no handwritten patch schema. All held: 40 library tests and 11 service tests passed. Clippy, formatting and TypeScript checks exited 0 before commit. |
| 2 - Define the shared envelope and canonical receipt contract | `119dd749` | Shared the envelope through the library; defined tagged scope, versioned receipts, distinct failures, one terminal constructor, canonical bytes/digests and both size limits. Moved the legacy response representation without changing its persisted hash semantics. Predicted V2 would run 8 boundary tests and 12 service tests with zero failures; both held. Clippy, formatting and TypeScript checks exited 0 before commit. |
Deviations: 1 structural contradiction between V5 file-identity rejection and recoverable legacy intents, detailed below.
Open items: none deferred. Tasks 3 through 6 remain outstanding at this checkpoint. Public MCP registration, raw argument parsing and live UAT remain PLAN-2 obligations.

Starting HEAD: `d32f10f549463afbf74656620fb715ae02fef0bd`. The working tree was clean and no previous PLAN-3 report existed.

Compatibility ruling: phase 6 D-27 resolves Flag A as unsupported cross-format native execution resume with a distinct server/store failure and preservation of old bytes. The v3 markdown compatibility promise remains in force.

Current task: 3 - Persist scoped decisions and return the writer's actual answer
Need: Correct V5's unconditional file-identity rejection requirement for already-installed intended bytes, or decide a different legacy recovery contract and authorize any additional storage-interface lease. No Task 3 implementation was started.

Checkpoint evidence:

1. [deviation] V5 requires that "changed file or directory identities refuse before recovery writes" while also requiring "Old pending intents must finish once with old bytes" (`.planning/phases/6/PLAN-3.md:217`). The compatibility contract keeps old intents exactly encoded (`.planning/phases/6/PLAN-3.md:175`). Actual recovery accepts a participant whenever its bytes equal the intended bytes and its directory identity matches, without comparing its file identity (`crates/cadence/src/store/transaction.rs:225`). This is necessary to recognize the writer's own completed rename from an old intent, but it also accepts an external replacement inode holding the same intended bytes.

2. A real-process diagnostic reproduced the contradiction with the existing `store_crash` harness. The parent observed `Renamed decisions.jsonl`, killed the writer with SIGKILL, then replaced the installed decisions file using identical bytes in a demonstrably different inode. Before recovery, `state.json` was absent. An unrelated reader exited 0, printed `CADENCE_SUCCESS`, installed `state.json` and removed the pending intent. Thus the changed identity did not refuse, and recovery performed semantic writes. This used a legacy `Store` intent, so D-27's native execution-resume exception cannot discharge it. The relevant store implementation is unchanged from the starting HEAD.

3. Old `Participant` records store only the target, pre-write `Observed`, and intended bytes (`crates/cadence/src/store/transaction.rs:60`). They have no intended installed-file identity. Recovery resyncs matching bytes and installs outstanding participants (`crates/cadence/src/store/transaction.rs:340`). The generic storage API exposes an opaque `Prepared` with no prepared-file identity accessor (`crates/cadence/src/store/mod.rs:57`), and the filesystem adapter keeps its prepared paths private (`crates/cadence/src/store/filesystem.rs:42`). These latter two files are outside this plan's lease. Rejecting all changed file identities instead would reject the writer's own successful rename and violate required legacy recovery. Adding future metadata cannot recover an identity absent from an old intent.

Proposed resolution and alternatives:

- Make the intended-byte replay exception explicit for legacy intents: reject unexpected bytes, changed directory ancestry and unexpected pre-install identities, while accepting identical intended bytes under the original directory identity. That would accurately state the existing protocol's evidence limit. This is a proposed criterion correction, not an adopted narrowing.
- If identity rejection after installation is required for new-format intents, separately authorize the prepared-identity storage interface, adapter and test leases, with a persisted identity protocol that also survives repeated recovery. An explicit exception or different compatibility ruling is still needed for old intents.
- Refusing all partially installed old intents would change M6/M7 and V5's recovery promise. It is not authorized by D-27 for the generic store intent demonstrated here.

Impact: Tasks 1 and 2 are committed and verified. The service still uses the legacy persistence format by Task 2's required staging rule. Tasks 3 through 6 and PLAN-2 must not be declared complete. No migration, fabricated digest, recovery change or protected-document edit was used to hide this contradiction.

Final evidence:

- `node cadence-core/bin/planning.mjs detect-commands --root /code/cadence`: exit 0; lint is `cargo clippy --all-targets -- -D warnings`, typecheck is `npx tsc -p tsconfig.ci.json`.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::`: exit 0; 40 passed, 0 failed.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`: exit 0; 11 passed, 0 failed.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`: exit 0.
- `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`: exit 0.
- `node cadence-core/bin/planning.mjs lease-check --phase 6 --plan 3`: exit 0, `ok:true`.
- `git log -1 --format='%h %G? %GK %an <%ae>'`: exit 0; `073226dd G 693AB15F91734B0C John Crenshaw <john@jcrenshaw.dev>`.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD`: exit 0, no output.

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::boundary`: exit 0; 8 passed, 0 failed.
- Task 2 `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`: exit 0; 12 passed, 0 failed.
- Task 2 clippy, formatting, TypeScript and lease checks: all exit 0 using the exact commands above.
- Task 2 `git log -1 --format='%h %G? %GK %an <%ae>'`: exit 0; `119dd749 G 693AB15F91734B0C John Crenshaw <john@jcrenshaw.dev>`.
- Task 2 post-commit deletion check: exit 0, no output. Only this report remained untracked.

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test store_crash --no-run --message-format=json`: exit 0; compiled the production-source crash harness, ran no tests.
- `TMPDIR=/tmp python3 -` with the diagnostic below: exit 0; one producer/reader scenario, not a V5 pass. Prediction: identical intended bytes in a replacement inode would be accepted, recovery would acknowledge, state would be installed and intent removed. All held. Observed JSON: `{"producer_sigkill":true,"barrier":"Renamed decisions.jsonl","intended_bytes_preserved":true,"file_identity_changed":true,"state_existed_before_recovery":false,"recovery_exit":0,"recovery_acknowledged":true,"state_exists_after_recovery":true,"intent_removed":true}`.
- V3, V4, V5 and V6 were not run. The full workspace suite, Node suite and live UAT were not run: this is a structural checkpoint before the contract's final-suite site. The supplied 299-test baseline is not represented as a new measurement.
- `git log --format='%h %G? %GK %an <%ae>' d32f10f549463afbf74656620fb715ae02fef0bd..HEAD`: exit 0; both commits, `073226dd` and `119dd749`, verify `G` with key `693AB15F91734B0C` and author `John Crenshaw <john@jcrenshaw.dev>`.
- `git diff --exit-code v3.7.12 -- cadence-core/`: exit 0, no output.
- `git diff --exit-code d32f10f549463afbf74656620fb715ae02fef0bd -- cadence-core/ .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/phases/1 .planning/phases/2 .planning/phases/3 .planning/phases/4 .planning/phases/5 .planning/phases/6/CONTEXT.md .planning/phases/6/PLAN-1.md .planning/phases/6/PLAN-2.md .planning/phases/6/PLAN-3.md .planning/phases/6/FALSIFICATION.md .planning/phases/6/FALSIFICATION-3.md skills agents hooks .mcp.json`: exit 0, no output. Frozen and protected paths are unchanged.
- `git diff --name-only d32f10f549463afbf74656620fb715ae02fef0bd HEAD`: exit 0; nine paths, all in the PLAN-3 lease: the eight Task 2 paths and `crates/cadence/src/execution/tests.rs`.
- `git diff --exit-code`: exit 0, no output. `git status --short`: exit 0; only this uncommitted report remains, as required for the sequential executor path.

Diagnostic command body, using the executable emitted by the build command above:

```python
import json, os, select, subprocess, tempfile
from pathlib import Path
binary = '/code/cadence/target/debug/deps/store_crash-32ceda8494fe80e9'
with tempfile.TemporaryDirectory(prefix='cadence-plan3-identity-', dir='/tmp') as temp:
    root = Path(temp)
    env = dict(os.environ, CADENCE_CRASH_ROOT=temp,
               CADENCE_CRASH_STAGE='Renamed',
               CADENCE_CRASH_TARGET='decisions.jsonl',
               CADENCE_CRASH_MODE='write')
    args = [binary, '--exact', 'crash_child', '--nocapture']
    producer = subprocess.Popen(args, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                bufsize=0)
    output = b''
    try:
        while b'CADENCE_BARRIER' not in output:
            ready, _, _ = select.select([producer.stdout], [], [], 10)
            if not ready:
                raise RuntimeError('barrier timeout')
            chunk = os.read(producer.stdout.fileno(), 4096)
            if not chunk:
                raise RuntimeError('child exited before barrier')
            output += chunk
    finally:
        producer.kill()
        producer.wait(timeout=10)
    assert producer.returncode == -9
    intent_path = root / '.store-intent.json'
    intent = json.loads(intent_path.read_bytes())
    participant = next(p for p in intent['participants']
                       if p['target'] == 'decisions.jsonl')
    target = root / 'decisions.jsonl'
    intended = bytes(participant['bytes'])
    assert target.read_bytes() == intended
    old_identity = (target.stat().st_dev, target.stat().st_ino)
    replacement = root / 'replacement'
    replacement.write_bytes(intended)
    replacement.replace(target)
    new_identity = (target.stat().st_dev, target.stat().st_ino)
    assert old_identity != new_identity
    state_before = (root / 'state.json').exists()
    env.update(CADENCE_CRASH_MODE='read', CADENCE_CRASH_STAGE='never',
               CADENCE_CRASH_TARGET='never')
    recovered = subprocess.run(args, env=env, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               timeout=15)
    assert recovered.returncode == 0 and b'CADENCE_SUCCESS' in recovered.stdout
    assert not state_before and (root / 'state.json').exists()
    assert not intent_path.exists()
```

## Tasks 5-6 continuation from 02776934

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-3.md
Tasks: 5 of 6

| Task | Commit | Note |
|---|---|---|
| 5 - Prove compatibility and crash recovery at the changed boundary | `880f7712` | Embedded independent baseline-format fixtures; proved old recovery and explicit cross-format refusal, directory/content guarantees, new-format process death, sync/confirmation failures, and immutable lost-reply replay. Only the three leased test modules changed; no production protocol change was required. |

The starting branch was `cadence/binary-owns-process`, HEAD `02776934a445e7984c34bbf62f5a039ced5cade6`, with a clean tree. Tasks 1-4 were read as handoff evidence and were not repeated. The supplied 322-test baseline was not re-run. The executor contract and lean-build reference were read; the user's explicit append-only report, signing, attribution, scope and environment instructions govern this continuation. This existing report is retained intact; there is no rotation or additional report file.

Flag A disposition: RESOLVED by D-27. Cross-format resume of earlier 4.0-dev-native execution records is UNSUPPORTED. It returns the distinct `Failure::LegacyExecution` server/store failure while preserving old native bytes, hashes, receipts, budgets and SUMMARY. Nothing is migrated or relabeled as a canonical-envelope digest. This does not narrow v3 markdown compatibility. D-28 is also applied as decided: recovery proves intended content plus unchanged directory ancestry. Replacement installed-file inodes with identical intended bytes are deliberately admitted, in both old and new intent formats.

Task 5 PREDICTION, stated before V5: compatibility 8 passed / 0 failed, store 17 passed / 0 failed, binary `execution_restart` 6 passed / 0 failed; all exits 0. Each crash parent must observe its named barrier, terminate only its own fixture child, and use a fresh child with original root/request/patch inputs for recovery; expected answers are never child inputs.

Task 5 ACTUAL:

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`: exit 0; 8 passed, 0 failed, 0 ignored, 0 filtered; 0.38 seconds.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`: exit 0; 17 passed, 0 failed, 0 ignored, 0 filtered; 186.86 seconds.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_restart`: first exit 101; 5 passed, 1 failed, 140 filtered; 1.18 seconds. Corrected targeted rerun: exit 0; 6 passed, 0 failed, 0 ignored, 140 filtered; 1.14 seconds, matching the 6/0 prediction.
- [deviation] Expected all six restart cases to pass; observed a missed `RecoverySync:decisions.jsonl` barrier after killing at `Renamed:SUMMARY.md`. The test assumed decisions were already installed at that point. The writer installs SUMMARY first, before decisions and final state. The matrix now observes `RecoverySync:SUMMARY.md` in that scenario and decisions resync after the decisions/state barriers. The corrected run passed. No acceptance criterion or locked decision changed; no production fix was needed.
- `node /claude/.claude/plugins/cache/cadence/cadence/3.7.12/cadence-core/bin/planning.mjs detect-commands --root /code/cadence </dev/null`: exit 0; lint `cargo clippy --all-targets -- -D warnings`, typecheck `npx tsc -p tsconfig.ci.json`.
- Final precommit `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0. `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`: exit 0. `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null`: exit 0. Clippy also passed before the harness correction.
- Before commit, `git diff --exit-code v3.7.12 -- cadence-core/` and `git diff --exit-code 02776934 --` all user-named protected planning paths: both exit 0, no diff. `git diff --check`: exit 0. Only the three Task 5 test paths were staged individually.
- `node /claude/.claude/plugins/cache/cadence/cadence/3.7.12/cadence-core/bin/planning.mjs lease-check --phase 6 --plan 3 </dev/null`: exit 0, `ok:true`, 3 staged paths.
- `git log -1 --format='%h %G? %GK %an <%ae> %cn <%ce>'`: exit 0; `880f7712 G 693AB15F91734B0C John Crenshaw <john@jcrenshaw.dev> John Crenshaw <john@jcrenshaw.dev>`.
- Postcommit deletion check: exit 0, no deletions. Postcommit status before this required report append was clean.

Compatibility and recovery guarantees passed:

- `legacy_native_formats_read_but_cross_format_resume_fails_without_rewriting_bytes`: six independently encoded old fixtures (phase-3/5 store/item/gate history, native dispatch, accepted patch, blocked patch, ordinary refusal, and 256 transitions plus terminal), with provenance to `2aa77d64` store/model, store/transaction and execution/model. The old ordered snapshot-integrity preimage is checked before compatibility interpretation. Original native files survive two unrelated readers exactly, with old operation and patch receipts intact and no new boundary admission. Old nonexecution history remains eligible for new-format work, also covered by the existing mixing/round-trip fixture.
- `legacy_each_pending_intent_recovers_original_bytes_once_after_repeated_process_death`: all four original intent kinds, including accepted/blocked patch SUMMARY, the no-SUMMARY patch form, refusal and terminal. Seven fixtures each survive a death after decisions rename and another during decisions resync. Recovery installs the original participant bytes once, removes the intent only after completion, and preserves subsequent read bytes.
- `execution_restart_cross_format_failure_preserves_legacy_bytes_at_every_service_entry`: a new resident rejects query, phase-free apply and malformed-argument refusal with `Failure::LegacyExecution`; all native and SUMMARY bytes remain exact. This is service-channel evidence in addition to store/read compatibility, and discharges Flag A.
- `recovery_admits_identical_content_replacement_inode_under_original_directory_ancestry`: real process death, a demonstrably different installed inode, unchanged intended bytes, accepted recovery and one final state for both intent formats. This pins D-28's admitted case explicitly.
- `recovery_rejects_foreign_bytes_directory_ancestry_and_legacy_tampering_before_any_write`: both formats reject a foreign final participant, changed directory ancestry, unknown version/kind/field, tampered intent integrity and a tampered snapshot before any participant changes; the pending intent remains exact. Existing new-format intent-negative cases additionally cover scope, generation, codec, receipt, digest and invalid targets.
- `execution_restart_each_dispatch_and_patch_barrier_recovers_one_confirmed_answer`: 13 dispatch/patch barrier scenarios, plus five repeated deaths during recovery. The parent checks pre-intent semantic rollback, recoverable intent after rename even before intent confirmation, SUMMARY before final state, one admitted boundary, stable namespaces, one confirmed digest and identical replay from an unrelated process. Git-signed task fixtures and on-disk SUMMARY independently identify the accepted task commit. The existing SUMMARY test now stops at SUMMARY rename itself, before final state installation.
- `execution_restart_lost_apply_replays_one_immutable_transition`: the replay envelope matches its on-disk digest; after a later second-plan dispatch, the first patch still returns its original NextPlan receipt without changing state/log bytes. Existing dispatch and completion lost-reply cases remain green.
- `scoped_refusal_and_terminal_kills_recover_one_identical_answer_without_semantic_changes`: 12 root-refusal/terminal barrier scenarios plus four repeated recovery deaths. Canonical JSON is computed independently from the returned envelope and compared to the disk receipt digest. One transition/generation is admitted; terminal admission adds no operation receipt; semantic namespaces and prior SUMMARY remain exact. The established root/execution saturation test also passes both saturation orders and restart replay.
- `scoped_intent_and_changed_participant_failures_never_acknowledge`: 56 applicable failure scenarios across new refusal, dispatch, patch and terminal operations. Temporary-file sync, post-rename, directory-sync and confirmation probes cover the intent and every changed semantic participant; intent-removal directory-sync failure is covered on the normal writer path too. Every injected fault is positively observed, every request fails without acknowledgement, and recovery/retry completes exactly once. Refusal/terminal participants are ordinary store files, with no SUMMARY write.
- `scoped_recovery_resync_and_intent_removal_failures_never_acknowledge`: ten recovery failures covering already-installed decisions, state and SUMMARY at file resync, directory sync and confirmation, plus intent-removal directory sync. Installed semantic bytes stay exact. Failed cleanup is unacknowledged even with full state installation; a subsequent open sees the one completed operation. The intent is validated and removed, not treated as a semantic resync participant.
- `scoped_recovery_reloads_policy_before_any_participant_write`: changed policy blocks recovery without writes or acknowledgement and retains the intent; a later allowed recovery completes once.

Open items: Task 6 remains. Hardware power loss is untested: probe ordering/fault evidence and SIGKILL recovery are distinct claims. Installed-file identity is explicitly outside the D-28 guarantee. Public registration, raw MCP parsing, execution-skill/contract changes, guard expansion, PLAN-2 AC1/AC3/AC7 completion and live UAT remain PLAN-2 obligations. No new source/fixture path, dependency, migration or protected-document change was needed.

Task 6 committed; final-suite proof pending:

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-3.md
Tasks: 5 of 6 verified; Task 6 implemented, V6 pending

| Task | Commit | Note |
|---|---|---|
| 5 | `880f7712` | Compatibility and crash/failure evidence; V5 green. |
| 6 - Close only the prerequisite and hand back to PLAN-2 | `49a5193d` | Four new repair inventories check exact test registration and invoke 21 mapped evidence functions spanning M1-M7; existing PLAN-1 inventories remain intact. Awaiting the sole final workspace run. |

Task 6 PREDICTION, stated before V6: 338 workspace tests passed / 0 failed, all suite/static/diff exits 0 (supplied baseline 322 + 12 Task 5 tests + 4 inventory tests). The inventory assertions require every named row to be registered and actually executed. The original one-tool MCP regression must remain green.

Precommit Task 6 ACTUAL:

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`: exit 0.
- `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null`: exit 0.
- `git diff --check`: exit 0. Frozen `cadence-core/` versus `v3.7.12` and all user-named protected planning paths versus `02776934`: both `git diff --exit-code` checks exited 0 before commit.
- Exactly four Task 6 test paths were staged individually. Lease check: exit 0, `ok:true`, 4 staged paths. The existing report remains unstaged under the sequential executor contract.
- Commit `49a5193d` verifies `G`, key `693AB15F91734B0C`, with author and committer `John Crenshaw <john@jcrenshaw.dev>`. No deletions; only the required existing report append remains in status.

PLAN-2 handoff interfaces (already implemented in Tasks 1-4; no public wiring changed here):

- Shared schema producer: `cadence::execution::model::patch_schema()`, derived from `ExecutorPatch` and its reachable domain field types. Prompt generation already uses it; PLAN-2's future tool listing should consume this function.
- Resident entry points: `CadenceServer::refuse_execution_arguments(root, tool, raw, ValidationFailure)` for malformed input with a known root; `CadenceServer::apply_executor_patch(root, patch)` for apply without an independently supplied phase; `CadenceServer::query_execution(root, phase)` for validated execution selection. The root-refusal/apply service entries are `execution_service::refuse_arguments` and `execution_service::apply`.
- Confirmed public answer: library-owned `Envelope<Success>` aliased by `cadence::execution::boundary::ExecutionEnvelope`; the service returns `Answer = Result<ExecutionEnvelope, Failure>`. `Failure::{Store, Closed, Confirmation, LegacyExecution, Encoding}` is the explicit server-failure channel and must not become an acknowledged refusal. `store::writer::confirmed_boundary` and its `ConfirmedBoundary::envelope` verify the selected writer receipt, with terminal selection first.
- Codec v1 digest: SHA-256 of `canonical_bytes` of the exact returned envelope (`envelope_digest`), compact UTF-8 JSON without a newline, recursively sorted object keys in Rust string order, unchanged array order, Serde JSON string escaping, no Unicode normalization, and integral execution numbers. No response digest, transport framing, request ID or current store generation enters its own preimage. Structured output and parsed mirrored text must equal that envelope when PLAN-2 adds the wrapper.
- Compact receipts preserve the original answer. Dispatch receipts persist checked references, byte count and digest, never prompt/body bytes. Controlling inputs must be revalidated before reconstruction or replay. The canonical terminal wins over a candidate or old receipt, and cannot grow log, operation receipts or execution state after admission.

Repair inventory map: core shard M1 (three schema cases); service shard M2 (root refusal), M4 (confirmed semantic failures and terminal precedence), M5 (original receipt replay and changed-input rejection), M6 (D-27 service failure), M7 (dispatch/patch process barriers); store shard M3 (separate persistent budgets), M4 (public digest confirmation), M7 (failure, resync, policy and refusal/terminal process cases); compatibility shard M6 (old formats, mixed history and old intents), M7 (D-28 admission and fail-before-write cases). These are four additional harness tests, containing 21 explicit function registrations/invocations. PLAN-1's core, binary and store inventories were preserved.

Final V6 ACTUAL, after both task commits:

- The global+repo config command returned `workflow.test_command:null`, exit 0. The manifest is a Cargo workspace; the final suite was the explicitly authorized `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`.
- Workspace suite: exit 0; **338 passed, 0 failed, 0 ignored, 0 filtered**, matching the prediction exactly. This was the dispatch's sole full-suite run; no repair or suite rerun was needed.

| Harness | Passed | Failed | Seconds |
|---|---:|---:|---:|
| Library | 104 | 0 | 0.03 |
| Binary | 147 | 0 | 103.97 |
| derivation_consistency | 6 | 0 | 0.06 |
| derivation_inputs | 12 | 0 | 0.00 |
| evidence_store | 4 | 0 | 0.00 |
| execution_boundary_compat | 9 | 0 | 0.44 |
| execution_store | 18 | 0 | 259.05 |
| mcp | 4 | 0 | 0.00 |
| next_action | 7 | 0 | 0.00 |
| store | 17 | 0 | 0.02 |
| store_crash | 10 | 0 | 0.08 |
| Doctests | 0 | 0 | 0.00 |
| Total | 338 | 0 | |

- All four `phase_six_*_repair_inventory_runs_registered_evidence` tests passed. A log audit also confirmed normal harness execution of all 21 mapped leaf tests, not merely source registration. The unchanged PLAN-1 acceptance inventories, phase-5 evidence/next-action/pause inventory, phase-4 derivation regressions, phase-3 store/crash tests and execution/guard regressions passed. MCP's `tools_list_declares_exactly_cadence_version_with_an_output_schema` passed, retaining exactly one public tool.
- A supplemental log-audit script initially overmatched 25 string pairs by including four criterion-set entries after the inventory rows. Its Python assertion failed (script exit 1; the surrounding shell then returned 0 from subsequent status commands). Restricting extraction to the declared row array yielded the intended 21 tests, each found with `... ok` in the completed suite log; corrected audit exit 0. This was an audit-parser correction, not a suite failure, missing inventory row, or acceptance change.
- Final `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0; `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`: exit 0; `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null`: exit 0. These checked the final committed source during V6.
- Final frozen-reference `git diff --exit-code v3.7.12 -- cadence-core/`: exit 0, no diff. All protected planning paths versus `02776934`, plus skills, agents, hooks, MCP wiring, release wiring and Cargo manifests/lockfile: exit 0, no diff.
- Implementation diff versus `02776934`: exactly four files, all in the frontmatter lease and the respective Task 5/6 file lists. No production source, public tool registration, execution skill, executor contract, UAT, guard or protected document changed. The existing report is the sole uncommitted path, as required for the sequential report handoff.
- Both task commits verify `G` with key `693AB15F91734B0C`, author and committer John Crenshaw. No unsigned workaround, new report, source/fixture path, dependency, budget reset or native-record migration was used.

PLAN COMPLETE
Plan: .planning/phases/6/PLAN-3.md
Tasks: 6 of 6

| Task in this continuation | Commit | Final result |
|---|---|---|
| 5 | `880f7712` | V5 compatibility, cross-format failure, content/directory recovery and crash/failure cases green. |
| 6 | `49a5193d` | M1-M7 executable repair inventories and V6 green; prerequisite handed back to PLAN-2. |

Deviations in this continuation: one corrected V5 barrier expectation, detailed above. The supplemental log-audit extraction was also corrected and disclosed. No scope, lease, acceptance criterion or locked decision changed. Earlier historical records above remain historical; D-27 resolves Flag A and D-28 resolves the old identity contradiction.

Open items within Tasks 5-6: none. All M1-M7 prerequisite obligations are supported by the recorded deterministic tests. Flag A is RESOLVED as unsupported 4.0-dev-native cross-format execution resume with explicit server/store failure and unchanged old bytes. V3 markdown compatibility remains un-narrowed; the existing derivation/import/golden regressions pass, without claiming implementation of future migration obligations.

Knowingly unproved and not claimed complete: hardware power loss; installed-file identity (deliberately excluded by D-28); live host execution/permissions, model compliance or output quality, compaction causality, and live UAT. PLAN-2 retains public MCP registration/raw dispatch, root startup binding, the final three-tool surface, execution-skill/contract changes, its AC1/AC3/AC7 obligations and UAT. No full frozen Node suite was run; V6 explicitly authorizes the Rust workspace suite plus TypeScript/static checks. This completion closes only PLAN-3's prerequisite repairs.
