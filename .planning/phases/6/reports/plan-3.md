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
