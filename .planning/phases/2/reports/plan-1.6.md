PLAN CHECKPOINT: structural
Plan: /code/cadence/.planning/phases/2/PLAN-1.md
Tasks: 3 of 6

| Task | Commit | Note |
|---|---|---|
| 1 | 11054d2c | Prior dispatch; independently verified. Not rebuilt, re-verified or staged in this dispatch. |
| 2 | c8041775 | Prior dispatch; independently verified. Recorder and recordings untouched. |
| 3 | 36eca1c4 | 43 planning operations, 92 invocations. All 43 refusal probes matched. Clippy/typecheck green; one-path lease gate green; signed subject-only commit. |

Deviations:
- [deviation] Prior approved Task 1 adjustment: the complete archived phase derives current:null with a one-entry roadmap. The slice has a checked phase 1 and unchecked unplanned phase 2, giving current:2,total:2. Prior evidence and authorization history remain in the rotated checkpoint.
- [deviation] Task 3 handler-only refusal coverage is impossible for trace render, trace suggest and trace window. Human owner approved Option A in this dispatch: record the door's bad-args for these three, explicitly labeled below. No additional exception was used.
- [deviation] Verification prediction: expected uat-init-refused to reach uat-exists; first probe observed no-payload because init/refresh read stdin only. Corrected those manifest entries from --payload to JSON stdin. The second bounded run matched all 43 expected refusal branches. No acceptance criterion changed for this correction.

- [deviation] Task 4 inherits Task 3's success-plus-handler-refusal rule for every offline operation, but config keys has no reachable refusal under the frozen CLI. Even malformed --file arguments return success; its only shared bad-schema failure requires a damaged frozen schema or the prohibited test seam. Stopped before adding Task 4 entries. This is not covered by Option A.

Open items: 2
1. Task 4 is structurally blocked: config keys exposes no refusal with the frozen schema and closed test seam; the approved door-refusal exception cannot apply because this arm has no door refusal either. Tasks 4–6 remain unimplemented and uncommitted.
2. Plan 2 owns git repository setup, remaining recordings, file capture, normalization and drift. The manifest marks adjudication, deferred record and applied renumbering git:true as required by their frozen handlers, in addition to the plan's named git operations. Task 3 success invocations that depend on future bundles have not been executed; Tasks 5–6 supply those bundles.

Environment: no CLAUDE.md exists or is required. Writes confined to /code/cadence. No installs, git config writes, branches, worktrees or pushes. Unused Node stdin ignored; payload stdin piped only when consumed. Reports unstaged and uncommitted. Frozen cadence-core diff exits 0. Tasks 1–2 were not re-run.

Task 3 verification: the inventory check compared sorted operation ids with the task list and printed `inventory: 43 ids, 92 invocations, unique and structurally valid`; required keys, minimum two per id, actual script paths and SHA tokens passed. Disposable fixture copies produced `refusals: 43 matched; handler=40, door=3`. Full raw refusal envelopes: resume-work/refusal-probes.json. Each handler refusal's hint was checked against the door's distinct hint. The three approved exceptions matched the door detail `trace <arm> --phase needs a phase number: --phase <N>`, rather than each handler's `--phase must be a phase number`. Their contract rows are cadence-core/bin/lib/arg-contract.mjs:1068–1084 and dispatch emission is cadence-core/bin/planning.mjs:406. The previous checkpoint preserves the complete unreachability proof. Static checks: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings` and `npx --no-install tsc -p tsconfig.ci.json`, both exit 0. Post-commit glance: no deletions, only exempt reports untracked. Full suite not yet run.

## Planning operation refusal sources

Summary: **40 handler-sourced, 3 door-sourced**. All rows have a success invocation and a separate refusal invocation. Source paths below are relative to cadence-core/bin/planning/ unless otherwise stated. Bundle construction and success-side exercises follow in Tasks 5–6; git recording belongs to Plan 2.

| Operation | Success invocation | Refusal invocation | Reason | Refusal source | Frozen source |
|---|---|---|---|---|---|
| status | status-slice | status-refused | no-planning-dir | handler | status.mjs:131 |
| cursor get | cursor-get-slice | cursor-get-refused | no-cursor | handler | cursor-get.mjs:19 |
| cursor set | cursor-set-ok | cursor-set-refused | no-planning-dir | handler | cursor-set.mjs:22 |
| phase-done | phase-done-ok | phase-done-refused | unknown-phase | handler | phase-done.mjs:65 |
| uat init | uat-init-ok | uat-init-refused | uat-exists | handler | uat.mjs:117 |
| uat refresh | uat-refresh-ok | uat-refresh-refused | bad-payload | handler | uat.mjs:87 |
| uat record | uat-record-ok | uat-record-refused | unknown-item | handler | uat.mjs:169 |
| uat merge | uat-merge-ok | uat-merge-refused | bad-payload | handler | uat.mjs:346 |
| uat status | uat-status-ok | uat-status-refused | no-uat | handler | uat.mjs:26 |
| reads | reads-ok | reads-refused | read-failed | handler | reads.mjs:38 |
| audit | audit-ok | audit-refused | no-requirements | handler | audit.mjs:41 |
| criteria-coverage | criteria-coverage-ok | criteria-coverage-refused | no-roadmap | handler | criteria-coverage.mjs:91 |
| criteria-size | criteria-size-ok | criteria-size-refused | no-roadmap | handler | criteria-size.mjs:65 |
| plan-overlap | plan-overlap-slice | plan-overlap-missing-phase | no-phase-dir | handler | plan-overlap.mjs:47 |
| replay-check | replay-check-slice | replay-check-refused | no-phase-dir | handler | replay-check.mjs:29 |
| plan-size | plan-size-ok | plan-size-refused | bad-args | handler | plan-size.mjs:89 |
| cite-count | cite-count-ok | cite-count-refused | bad-args | handler | cite-count.mjs:76 |
| seed-reqs | seed-reqs-ok | seed-reqs-refused | no-phase-dir | handler | seed-reqs.mjs:58 |
| recall | recall-ok | recall-refused | bad-args | handler | recall.mjs:44 |
| task-record | task-record-ok | task-record-refused | bad-args | handler | task-record.mjs:53 |
| lease-check | lease-check-ok | lease-check-refused | no-plan | handler | lease-check.mjs:238 |
| detect-commands | detect-commands-ok | detect-commands-refused | no-root | handler | detect-commands.mjs:59 |
| detect-surfaces | detect-surfaces-ok | detect-surfaces-refused | no-root | handler | detect-surfaces.mjs:212 |
| trace append | trace-append-ok | trace-append-refused | bad-args | handler | trace.mjs:693 |
| trace close | trace-close-ok | trace-close-refused | bad-args | handler | trace.mjs:782 |
| trace render | trace-render-ok | trace-render-refused | bad-args | door | trace.mjs:1202; ../planning.mjs:406 |
| trace window | trace-window-ok | trace-window-refused | bad-args | door | trace.mjs:1270; ../planning.mjs:406 |
| trace suggest | trace-suggest-ok | trace-suggest-refused | bad-args | door | trace.mjs:1132; ../planning.mjs:406 |
| trace ignore | trace-ignore-ok | trace-ignore-refused | no-root | handler | trace.mjs:240 |
| risk-check run | risk-check-run-ok | risk-check-run-refused | bad-args | handler | risk-check.mjs:172 |
| risk-check status | risk-check-status-ok | risk-check-status-refused | bad-args | handler | risk-check.mjs:530 |
| adjudication | adjudication-ok | adjudication-refused | bad-payload | handler | adjudication.mjs:131 |
| deferred record | deferred-record-ok | deferred-record-refused | bad-payload | handler | deferred-record.mjs:58 |
| risk-carry | risk-carry-ok | risk-carry-refused | no-planning-dir | handler | risk-carry.mjs:91 |
| deferred list | deferred-list-ok | deferred-list-refused | no-planning-dir | handler | deferred-list.mjs:69 |
| deferred carry | deferred-carry-ok | deferred-carry-refused | no-planning-dir | handler | deferred-carry.mjs:60 |
| capture | capture-ok | capture-refused | bad-args | handler | capture.mjs:23 |
| capture-sections | capture-sections-ok | capture-sections-refused | unreadable-capture | handler | capture-sections.mjs:43 |
| capture-check | capture-check-ok | capture-check-refused | unreadable-capture | handler | capture-check.mjs:74 |
| debt-harvest | debt-harvest-ok | debt-harvest-refused | no-root | handler | debt-harvest.mjs:35 |
| renumber insert | renumber-insert-ok | renumber-insert-refused | out-of-range | handler | renumber.mjs:210 |
| renumber remove | renumber-remove-ok | renumber-remove-refused | unknown-phase | handler | renumber.mjs:215 |
| milestone-prune | milestone-prune-ok | milestone-prune-refused | bad-args | handler | milestone-prune.mjs:83 |


## Task 4 structural checkpoint

Current task: 4 - The manifest covers the entry-script arms and worktree-base resolve
Need: Authorize a coverage classification for operations that expose no refusal at all under the frozen CLI, starting with config keys. Proposed concrete case: keep two invocations, `keys` and `keys --file` (the latter deliberately ignored by the frozen implementation), mark both successful, and label refusal coverage `not exposed` rather than claiming either is a refusal. The existing three trace exceptions remain door-sourced; handler refusals remain mandatory wherever reachable.

Evidence:
- cadence-core/bin/config.mjs:591 is the entire keys arm: `out({ ok: true, keys: SCHEMA })`. It reads no argv, stdin or fixture data and contains no fail call.
- cadence-core/bin/config.mjs:530–534 explicitly says check and keys declare no --file row and never reach optFile. The actual dispatch at :565–591 only calls optFile for validate, set, unset and get. There is no global argument evaluator ahead of keys.
- cadence-core/bin/lib/arg-contract.mjs:1130 has an empty wildcard row; :1165 has `keys: {}`. Thus no bad-args/usage door can be reached by malformed keys arguments.
- cadence-core/bin/config.mjs:558–563 loads the schema before dispatch and can fail('bad-schema'), but :36–47 pins it relative to the frozen script unless CADENCE_TEST_SEAM is open. Editing cadence-core/config.schema.json would violate the frozen-tree boundary; opening the sentinel would violate D-13. Neither was attempted. Existing config.test.mjs:828 and :852 demonstrate the gated and ignored override cases; these tests were read, not run.
- Predicted before the bounded probe: `keys`, `keys --file`, and `keys --file ""` each return exit 0, ok:true and byte-identical schema output with no reason or detail. Observed exactly that: 94 keys, empty stderr, no reason and no detail on all three. This is the decisive difference from the trace cases: there is no door detail to substitute for a handler detail. Probe ran with an empty PATH, workspace-local empty HOME and the three pinned empty settings overrides, ignored stdin and a ten-second timeout; the scratch directory was deleted. Raw concise evidence: resume-work/config-keys-probes.json. Reproduction: resume-work/config-keys-probe.mjs.

Related known contract shape to resolve before redispatch: read-trace.mjs:10–15 and :54–58 explicitly emit nothing and exit 0 even on failure; subagent-trace.mjs:11–17 and its terminal catch/exit do the same. Task 4 itself acknowledges their silent protocol but also inherits the fail-literal rule. A `not exposed` / silent no-op classification is appropriate to assess for those hooks too; they have not been represented as refusals or added to the manifest. No exception was silently applied to them.

Impact: this changes the inherited refusal-coverage criterion for an intrinsically success-only arm; it does not change the 74-operation inventory, the frozen runtime or the recorder contract. Two recorded success invocations preserve the frozen behavior of ignored extra arguments and make that absence of validation observable. Alternatives: (1) one keys invocation gives less coverage and also changes the two-invocation requirement; (2) relabeling an unknown-subcommand usage failure as keys would falsely name the operation; (3) altering the frozen schema or opening the test sentinel violates explicit boundaries. Stopped rather than choosing any of these.

Checkpoint completion state: only Task 3 was committed in this dispatch, as 36eca1c4, with John Crenshaw's requested author identity and GPG signing key, subject only. No Task 4 edits were made. Tasks 1 and 2 were neither rebuilt, re-verified nor re-staged. The prior report was rotated to plan-1.5.md using the contract's rotationTarget function before this dispatch's first report write. Final frozen cadence-core diff exited 0; git status showed only the exempt reports directory untracked, with no staged changes. Full-suite allowance is unused because the structural checkpoint precedes the last task; this is not PLAN COMPLETE. All reports and probe evidence remain unstaged and uncommitted for the orchestrator.
