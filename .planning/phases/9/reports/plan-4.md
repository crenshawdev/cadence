PLAN COMPLETE
Plan: .planning/phases/9/PLAN-4.md
Tasks: 5 of 5

| Task | Commit | Signature | Verification |
|---|---|---|---|
| P9-4-T1 | 241c5cec | G — John Crenshaw <john@jcrenshaw.dev> | phase9_admission admission_: predicted 8 passing; observed 8 passed, 0 failed, 5 prerequisite tests filtered |
| P9-4-T2 | 20cd68d1 | G — John Crenshaw <john@jcrenshaw.dev> | phase9_binding binding_: predicted 5 passing; observed 5 passed, 0 failed |
| P9-4-T3 | 78b82704 | G — John Crenshaw <john@jcrenshaw.dev> | phase9_observations observation_: predicted 4 passing; observed 4 passed, 0 failed |
| P9-4-T4 | 27a14437 | G — John Crenshaw <john@jcrenshaw.dev> | phase9_returns accept_: predicted 8 passing; observed 8 passed, 0 failed, 6 prerequisite tests filtered |
| P9-4-T5 | 81eadadb | G — John Crenshaw <john@jcrenshaw.dev> | phase9_recovery recover_: predicted 10 passing; observed 10 passed, 0 failed |

Deviations: none in acceptance criteria or locked decisions.
Open items: all four MANUAL.md items remain unverified and require their real host/operator/human evidence. No implementation blocker remains.
Lease extensions: none. T1 lease check returned ok:true (4 staged paths); no deletions.

Environment and execution record:
- Main checkout on cadence/binary-owns-process at initial HEAD 1ceb3be8, not a worktree. Existing .planning/STATE.md modification and untracked reports were present before this dispatch and preserved. No existing plan-4 report required rotation.
- No CLAUDE.md exists; its absence is not a blocker. Full published cad-executor contract, lean-build reference, PLAN-4, CONTEXT, acceptance authoring rules and MANUAL read. Plans 5 and 6 were not opened.
- Author/signing configuration confirmed John Crenshaw <john@jcrenshaw.dev>, key 693AB15F91734B0C, commit.gpgsign=true. No attribution trailers or configuration changes.
- User overrides contract static-analysis ordering: exactly one clippy run after the last task commit. Explicit named regression replaces the contract's whole-project suite/config lookup. No network, installs, hosts, MCP sessions or agents; Cargo uses CARGO_NET_OFFLINE=true and RUSTC_WRAPPER=. Node uses TMPDIR=/tmp and /dev/null stdin.
- T1 implements the Snapshot.data.review namespace, conditional transaction contribution/post-commit acknowledgment, independent occurrence sequence/replay binding, home inventory, H1/H2/H3 insertion, and a transaction-local Storage adapter used by real Plan 2 acquisition/mapping code. It preserves caller snapshot data, provenance and transaction participants.
- Tests directly invoke their named unit on supplied inputs; only filesystem/clock boundaries are stubbed. Store framing may use existing Snapshot serialization, as the plan permits; expected review values are literal. Five filtered tests are private prerequisite manifest tests compiled by the explicit module graph.

- T2 adds pure exact fire/occurrence/artifact/view/attempt/round binding and persistent global host-return identity checks, plus the saved-attempt reader. The H3 Observation vocabulary already carries bridge attempt, launch/return, kind/reference and usage facts separately from requested voice. Lease check ok:true (4 staged); no deletions.

- T3 adds observation persistence and replay/conflict checks, global launch/return bindings, bounded references, unknown-preserving usage/model enrichment and verified-winner reads after revision conflict. AC83 installs the independent winning image at the filesystem ownership boundary of CompareTransact. No threads, sleeps or workflow setup manufacture contention. Lease check ok:true (4 staged); no deletions.

- T4 saves exact raw bytes, content digest, original/index finding identities, original parsed fields, H4-1 interpretation, unverified citation sidecars and one closure in a single conditional transaction. Missing/malformed/host-failed returns close as failure; saved usage remains on their attempt. FIRST follow-up selection uses Plan 3. AC50/51 each supply a competing durable image at the filesystem boundary. Sync failure stays unacknowledged. Lease check ok:true (4 staged); no deletions. Six filtered tests are prerequisite contract unit tests.

- T5 adds recover_attempt/recover_original/read_original/read_roster/read_voice_originals and documents the transaction namespace, contribution and post-commit API, material adapter, operations and compatibility entry points. Interrupted input states never become empty success. Raw Q, IDs and per-voice arrays remain separate; unknown validator contracts are read as unverified without rewriting stored bytes. Lease check ok:true (6 staged); no deletions.


## Final verification

All 28 Plan 4 criteria have direct tests; seven additional direct tests cover
fresh admission, snapshot preservation, unavailable home, conflicting observation
replay, missing/malformed closure and unknown saved interpretation. Every new
test has one assertion, a named independently supplied input and a literal
expected value. No earlier-plan source or test was edited. No task required a
lease extension, checkpoint, repair round, package installation or extra commit.

Task commands (each run once, from /code/cadence):

```
TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_admission admission_
TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_binding binding_
TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_observations observation_
TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_returns accept_
TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_recovery recover_
```

All task predictions matched: 35 selected tests passed, zero failed. Rustfmt ran
only on the current task's declared Rust files. The fixture byte arrays and
content hashes encode independently supplied literal UTF-8 input, using no
production serializer to obtain an expected review value.

After the final task commit 81eadadb and its PLAN PARTIAL report write, the sole
clippy invocation was:

```
TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo clippy -p cadence --tests -- -D warnings
```

Predicted exit 0, no warnings; observed exit 0, no warnings. No second invocation.

The single final named regression command was:

```
TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery
```

| Target | Predicted passed/failed | Actual passed/failed |
|---|---|---|
| phase9_contract | 37/0 | 37/0 |
| phase9_stream | 2/0 | 2/0 |
| phase9_material | 20/0 | 20/0 |
| phase9_manifest | 12/0 | 12/0 |
| phase9_context | 13/0 | 13/0 |
| phase9_policy | 21/0 | 21/0 |
| phase9_selection | 30/0 | 30/0 |
| phase9_specialist | 3/0 | 3/0 |
| phase9_admission | 13/0 | 13/0 |
| phase9_binding | 5/0 | 5/0 |
| phase9_observations | 4/0 | 4/0 |
| phase9_returns | 14/0 | 14/0 |
| phase9_recovery | 10/0 | 10/0 |
| Total | 184/0 | 184/0 |

The original eight targets retain 138 passing tests. The new targets contain
35 new tests plus 11 prerequisite tests compiled through their module graphs.
No test was ignored, no signing sandbox failure occurred, and no whole-workspace
suite or manual substitute ran. PLAN COMPLETE was written only after the green
final regression and clean clippy result.

Final disposition: five atomic conventional commits, each signed G under the
configured John Crenshaw identity. Every commit staged only current-task paths;
no .planning path was committed. The initial .planning/STATE.md modification and
preexisting reports remain untouched; this report remains uncommitted.
