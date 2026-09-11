PLAN CHECKPOINT: blocked
Plan: .planning/phases/29/PLAN.md
Tasks: 5 of 5 implemented; plan completion blocked at Task 5's final workspace verification.

| Task | Commit hash(es) | %G? | Verify command and literal result |
|---|---|---|---|
| 1 — Commandless check | 0d832da3f2709d8991d03133bae843a36e99793d (red); c815904b7504c6016b2726d05482db9dde7fa6c0 (green) | G, G | `cargo test -p cadence --test phase29_limits phase29_check_without_command_is_refused -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.29s`, exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.25s`, exit 0. |
| 2 — Expected output | 67d8e8c419a05cd3913b68b6f7edfc658b58e97b (red); b29dde4f9fba7a4aac7d849815813f7efd7f1ca7 (green) | G, G | `cargo test -p cadence --test phase29_limits phase29_check_without_expected_output_is_refused -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.22s`, exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 4.85s`, exit 0. |
| 3 — Distinct checks | b42e24794f3891d229f0ef3d556376d3ef20542f (red); ffd595668e2ec89b8ba30369fe41c6ec1edc460b (green) | G, G | `cargo test -p cadence --test phase29_limits phase29_distinct_checks_across_plans_are_refused -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.22s`, exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 2.55s`, exit 0. |
| 4 — Named link value | bde7da9cac80a8162e05808dd666f5891e48e7cb (red); 359923ba3235266cf29f777f8ffda45227eddf50 (green) | G, G | `cargo test -p cadence --test phase29_limits phase29_link_value_absent_from_truth_is_refused -- --exact`: red `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.30s`, exit 101. Green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 16.34s`, exit 0. |
| 5 — Compiled instructions | 9c3df4c2d18bc4ce29816cd7b0295a1f21983f9e | G | `cargo run -p cadence --bin cadence -- plan-instructions`: exit 0; `Finished dev profile [unoptimized + debuginfo] target(s) in 12.27s`; `Running target/debug/cadence plan-instructions`. Rendered 40,700 UTF-8 bytes into the leased skill using the file-editing tool. |

## Red failure lines

- C1, red commit `0d832da3`, `phase29_limits.rs:367:5`: `assertion left == right failed: identified refusal`; `left: String("arguments")`, `right: "check-command"`. The response had null phase, entry and id. Native approval and initial publication succeeded before the behavioral failure.
- C2, red commit `67d8e8c4`, `phase29_limits.rs:367:5`: `assertion left == right failed: identified refusal`; `left: String("evidence-item-shape")`, `right: "check-expected"`. The check-specific refusal was absent for the missing expected container.
- C3, red commit `b42e2479`, `phase29_limits.rs:360:5`: `assertion left == right failed: publication must refuse`; `left: String("ok")`, `right: "refused"`. The real approved publication persisted the second distinct check at plan 2.
- C4, red commit `bde7da9c`, `phase29_limits.rs:360:5`: `assertion left == right failed: publication must refuse`; `left: String("ok")`, `right: "refused"`. The real approved replacement persisted `invoice` against the associated parcel-only truth.

All four red revisions compiled and failed behaviorally. Every green command selected exactly one test and passed. No zero-test, setup-error or compile-error red is claimed.

## Check scope and artifact inspections

All four checks drive the real initialized stdio MCP server in temporary projects with empty CADENCE_GLOBAL_CONFIG. Native truths are approved through context-submit with handwritten slots, then compared to their actual version-1 retained records after the server exits. Every refused preview and independent approved publication is stopped/reaped and followed by full .planning tree, Snapshot::parse, journal-absence and real Filesystem/Store ReadVerified comparisons. Successful controls compare handwritten map/spec strings, returned identities/revisions, installed body, retained approval/receipt/map, fresh evidence-read and replay. No production renderer or validator manufactures expected data. The handwritten section serializer follows the existing phase-28 grammar.

C1 exercises missing/null/non-string/empty/ASCII and Unicode whitespace commands, nonzero batch/item positions, custom nonexistent commands, broad commands, surrounding whitespace, a sentinel command that never runs, blank auxiliary check strings/empty fakes, and unapproved draft/allocation behavior. Its draft uses a new contribution so it does not require replacement approval.

C2 exercises malformed expected containers/tags/values, both legal tags and whitespace forms, nonzero positions, literal/property/surrounding-whitespace controls and an unapproved blank draft. No predicate evaluator or auxiliary-field content constraint was added.

C3 exercises the saved/proposed conflict with equal specs and distinct ids; two and three checks; reordered items and replacement batches; multiple origins of one alias; partial and coordinated replacement; first attached multi-plan batch after an installed valid provisional winner; shared and separate truths; immutable history and old receipts; supersession and original historical replay; and a second real caller replacing the sole saved check between legal preview and submission. The stale allocation refuses; refreshed direct submission names the actual current saved check.

C4 exercises absent values beside values mentioned only in metadata/another truth; exact trigger/observer/outcome matches; outer-whitespace preservation; all-association refusal and acceptance; malformed/blank caller/callee/value; Unicode letters/digits and underscore at either end; the exact W1 parcelé/comma/parcel_2 discriminators; a later delimited occurrence after an embedded one; exact case/internal whitespace/punctuation; synonym/pronoun refusal; and a phrase crossing slot boundaries.

P29-A-COMMIT inspection: candidate removes every replaced contribution before loading/unioning current maps. Attached fresh validation includes untouched saved contributions. Membership/definition checks precede new content and aggregate limits. The service, validate_candidate, contribute, writer and intent reuse the same policy. Writer/intent preserve raw typed diagnostic payload while maintaining ordinary Conflict/Invalid dispositions. Replay precedes new policy; retained types, map_history and map_view are unchanged. Old-policy saved blanks/extra checks/unnamed values are inspected as substantive policy paths, not claimed as captured-old-binary experiments. No migration, receipt rewrite, second writer, readback gate or admission activation was added.

P29-T4-A inspection: approved_slots requires matching native exact approval, bound phase, unique full current truth identity/version, current version-1 slot provenance, unique retained slot identity and available nonblank trigger/observer/outcome. It emits located link-truth-unresolvable with associated truth/version/path and a cause separately from lexical absence. No corrupt native context was forged to claim a public runtime case. names searches every character offset, preserving exact case/internal bytes and using char::is_whitespace outer trim plus char::is_alphanumeric() or underscore runs. It never parses Truth.text or joins/searches other slots/prose.

Task 5 output's inspected key lines:
- `**Planner.** For each truth, write its ONE check: the test that causes the` — complete design block retained verbatim.
- `- check-command: command must be nonblank text.`
- `- check-expected: expected must explicitly tag a literal or property with` — followed by nonblank-value and explicit silence guidance.
- `- truth-check-limit: one distinct check id per full current truth id/version`.
- `implementation interpretation of D-101 uses Rust char::is_alphanumeric() or` — followed by underscore/whitespace predicates and exact individual-slot limits.
- `produce link-truth-unresolvable, distinct from an absent value`.
- `mechanical execute-next gate. Phase 12 still owns execution activation`.
- `P29-O1 is a separate pending observation, associated with phase-29 T2 and T4,`.
- `## Compiled publication schema` followed by the derived strict submission schema.

Compiled source and public query/apply descriptions were inspected for all refusal/correction rules, saved/proposed origins, exact replacement of every offending contribution, historical replay without certification, no command execution/runner gate, unchanged provisional boundary and both pending observations. QueryOutput and ApplyOutput derive the plan-specific answer schema including optional structured details. The skill was rendered through the existing project-free command; no second instruction body or Markdown acceptance check was introduced.

## Final checks

Clippy: exactly one `cargo clippy --workspace --all-targets -- -D warnings` invocation, after Task 5's commit; exit 0. Literal result: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.90s``. No warnings or errors.
Full suite: exactly one `cargo test --workspace --no-fail-fast` invocation after Task 5's commit and clean clippy; exit 101 during test-binary linking. Cargo emitted no `running N tests` or `test result:` lines. Passed/failed test totals are unavailable because no tests ran; this is not a 0/0 passing suite. No rerun was made.

Literal failure output (same linker error for both named targets):

```text
error: linking with `cc` failed: exit status: 1
  = note: mold: failed to write to an output file. Disk full?
          collect2: fatal error: ld terminated with signal 7 [Bus error], core dumped
          compilation terminated.
error: could not compile `cadence` (test "phase9_deferred") due to 1 previous error
warning: build failed, waiting for other jobs to finish...
error: linking with `cc` failed: exit status: 1
  = note: mold: failed to write to an output file. Disk full?
          collect2: fatal error: ld terminated with signal 7 [Bus error], core dumped
          compilation terminated.
error: could not compile `cadence` (test "evidence_store") due to 1 previous error
```

Read-only environment confirmation: `readlink -f target` returned `/code/cadence/target`. Both `df -h /code/cadence` and `df -h target/debug/deps` reported `/dev/nvme1n1p1`, 3.7T size, 457G used, 3.2T available, 13% used, mounted at `/code`. `df -i` reported zero inode counters and no percentage for this filesystem. The linker's question does not establish disk exhaustion; the output-write/SIGBUS cause remains unresolved. There was no Rust compile diagnostic or executed-test regression to repair. Following the dispatch's unrelated-failure stop rule, no cleanup, package/configuration change, repair commit or further test/clippy invocation was attempted.

CHECKPOINT: blocked
Current task: 5 — final workspace verification after compiled instructions commit
Need: resolve the linker output-write/SIGBUS failure and authorize a subsequent full-suite invocation. Clippy already passed its single authorized invocation.

Final repository inspection: nine task/check commits, each authored by John Crenshaw <john@jcrenshaw.dev> and verified G after commit; every staged lease check returned ok:true. All twelve changed source/artifact paths are in the plan lease. No committed deletion, earlier phase test/fixture change, or planning-document change. Only this report is untracked and it remains uncommitted. The reserved phase-27 fixture root/lock were not accessed by this execution; the full-suite command failed before executing its tests.

Deviations: 1 — expected the final full-suite command to exit zero; observed exit 101 from linker output-write/SIGBUS failures before tests ran. No requested truth, check name, expected result, policy decision or lease was changed. The plan is not declared complete.
Open items: P29-O1 remains pending, with owner-approved specification provenance dated 2026-09-10 in .planning/phases/29/CONTEXT.md and T2/T4 associations. Real host conduct and model check quality have not been observed. P28-O1 provenance and pending status remain intact.

## Orchestrator control run (2026-09-10, after the executor stopped)

The executor's single `cargo test --workspace --no-fail-fast` failed in mold
before any test ran (`mold: failed to write to an output file. Disk full?`,
`ld terminated with signal 7 [Bus error]`) with 3.2 TB free on `/code` and
31 GB free on `/tmp`. The orchestrator reran the same command twice at HEAD
`9c3df4c2`: both linked cleanly. Second run, full log retained:
883 passed, 0 failed across 45 `test result:` lines, exit 0. The linker
failure is treated as transient and unexplained; no source, config or
fixture was changed to work around it. The plan's checkpoint is lifted on
this control run; clippy's single clean invocation stands as the executor
recorded it.
