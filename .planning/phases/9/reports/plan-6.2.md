PLAN CHECKPOINT: suite-red
Plan: .planning/phases/9/PLAN-6.md
Tasks: 4 of 4

| Task | Commit | Signature | Note |
|---|---|---|---|
| P9-6-T1 | 0af835df | G | Native review operations, saved material and all-home acquisition. |
| P9-6-T2 | e7e9910c | G | Retained local dispatch, grouped execution handoff, read-only WAIT contracts and silent stop adapter. |
| P9-6-T3 | 3cb467cc | G | Native pause admission requires staged identity and exposes ordinary five-field delivery. |
| P9-6-T4 | a063ab55 | G | Read historical pause origin and expose original bytes without promotion. |
| Authorized prerequisite repair | f3a8f533 | G | Preserve requested-model absence; isolated model fixture and tests. |

Verification: predicted phase9_model 2 passed and phase9_contract 37 passed; observed exactly those counts, zero failed/ignored/filtered. Command: TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase9_model --test phase9_contract. No existing test or fixture changed.

Resolved checkpoint: owner authorized RequestedVoice.model String -> Option<String>, the two proposed new test/fixture paths, and a standalone fix(review) commit before T1. Exactly that field changed; no other field or structure changed. Explicit repair authorization supplies its three-path lease in place of the unamended Plan 6 frontmatter. Staged paths inspected individually; author John Crenshaw <john@jcrenshaw.dev>, configured signing key 693AB15F91734B0C, signature G, no deletions.

Environment: continuing on cadence/binary-owns-process from c8f07ddd. Existing .planning/STATE.md change and reports preserved. Prior checkpoint report rotated before this write. Nothing under .planning committed. No git configuration changes, attribution trailers, agents, network, installs, hosts or MCP sessions. Clippy reserved for after T4; named regression pending.

Deviations: earlier-plan requested-model representation could not preserve phase-8 absence; repaired under explicit owner authorization.
Lease extensions: three explicitly authorized prerequisite paths (model.rs, tests/phase9_model.rs, tests/fixtures/phase9/requested-voice.json); no Plan 6 task extension.
Open items: final regression is blocked by the phase7_guard SubagentStop assertion; 28 integration targets and the two final selected binary checks remain unrun. Four MANUAL.md items remain untouched and unverified.

T1 verification: forward_ predicted 1 passed and service home_request_ predicted 1 selected passed. First targeted invocation stopped in compilation because mut was attached to the wrong observed binding (no tests ran); corrected only the two bindings and reran the same targets, both matched. After adding typed inner refusals and consumer inventory branches, repeated those same two targets: 1/0 and 1/0, service binary 211 filtered. The earlier cargo check found binary/library SessionFactory and Generation type mismatches; fixed new imports to crate::config and crate::import, and check passed. No earlier-plan file or test was modified for these repairs.

T1 commit lease: ok:true, 12 staged files, all exact T1 Files paths. Signature G, no deletions. Review tests compile production modules directly; forward input uses the existing committed empty-return fixture. Service test calls only the new home-path builder on H1 fixture input. No host, MCP client, current-config read on saved query, or manual substitute was used for verification. Clippy remains unrun.

T2 verification: TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase9_invoking advisory_; predicted 1 passed, observed 1 passed/0 failed/0 ignored/0 filtered. Input manifest ID and advisory gate come from committed H1 and policy fixtures; assertion is the exact AC1 literal. Lease check ok:true, 27 exact T2 paths; signature G, no deletions. Whitespace check found one extra EOF blank line after moving a helper before the existing test module; removed before commit.

T2 retains canonical execution types/receipts and adds only an outer review handoff consultation before and after grouped calls. Native stops use saved launch attribution and append observations, never raw delivery or legacy closure. The legacy handler runs only for an exact positively identified lifecycle agent/correlation binding; unknowns remain silent. Node legacy stdin is used (original hook bytes); other Node checks ignore stdin, TMPDIR=/tmp. No hook command or new skill was invoked. Five agent files retain effort, contract preload and write/edit exclusions, with query access only. The exact Files list contains 13 skill markdown paths including the new shared contract; all were updated at the requested boundaries. No unleased fourteenth skill was invented. No clippy or broader regression yet.

T3 verification: TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --bin cadence phase9_pause_tests::modern_; predicted 1 selected passed, observed 1 passed/0 failed/0 ignored, 212 filtered. The child test constructs ModernDelivery from committed H1 and original-F inputs and asserts only pause_delivery_request's literal output. Lease check ok:true, four exact T3 paths; signature G, no deletions.

Modern pause is identified at the existing grouped review-admit caller=pause boundary. It validates risk_surface plus authored staged target/null head, delegates to ordinary admission/retention and returns binary-issued IDs with the five-field contract. Shared observation/return paths own delivery. The existing unversioned internal pause input and its fix-shaped result decoder remain historical and unchanged; no new enum alternative or raw-result clearance is added to legacy pause. No historical pause regression or live workflow was run. No clippy yet.

T4 verification: TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase9_history history_; predicted 1 passed, observed 1 passed/0 failed/0 ignored/0 filtered. The test compiles history.rs alone with a read-only filesystem boundary; its committed old JSON is independent and the assertion is the exact AC149 literal. Unknown schema reads retain bytes and explicit unverified recovery diagnostics. Lease check ok:true, six exact T4 paths; signature G, no deletions. All four task commits now exist; PLAN PARTIAL remains until the final checks pass.

Final clippy (sole invocation, after T4 a063ab55): TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo clippy -p cadence --tests -- -D warnings. Predicted exit 0/no warnings; observed exit 0/no warnings, Finished dev profile. No second invocation or code changes followed.

Final regression prediction: 501 passed/0 failed/0 ignored across 30 integration targets, plus one selected service test and one selected modern-pause test (503 selected total). Phase-9 baseline counts retained from Plan 5; the added targets have model=2, forward=1, invoking=1, history=1. Phase7_guard=84, phase7_risk=22, phase7_lease=23, phase8_config=14, phase8_routing=44, phase8_interview=40, phase8_global=12, phase8_dispatch=24, mcp=18. Counts include child tests compiled into targets. Full actual table pending.

## Final regression checkpoint

CHECKPOINT: suite-red
Current task: final regression after P9-6-T4.
Need: authorize a narrowly scoped update to the superseded SubagentStop
expectation in crates/cadence/tests/phase7_guard.rs, or revise T2's required
hook registration. No source/test repair or further test run followed this
checkpoint.

The sole final regression command was:

```sh
TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test mcp --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history
```

Exit 101. Cargo ran mcp first (18 passed in 39.53s), then phase7_guard (83 passed,
1 failed in 3.59s), and stopped before the remaining targets. The longer MCP
log-bound test performs up to 260 durable transitions and completed normally;
there was no hang or signing sandbox artifact. Full captured output is at
/tmp/cadence-plan6-regression.log; the decisive output is preserved below.

```
---- shipped_manifest_loads_both_native_arms_and_preserves_unrelated_hooks stdout ----
thread panicked at crates/cadence/tests/phase7_guard.rs:1300:9:
assertion `left == right` failed
left:  [{"hooks":[{"type":"command","command":"cadence review-stop","timeout":10}]}]
right: [{"hooks":[{"type":"command","command":"node \"${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/subagent-trace.mjs\"","timeout":10}]}]
test result: FAILED. 83 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
```

The test loads v3.7.12:hooks/hooks.json via Git and at lines 1299–1300 requires
both PostToolUse and SubagentStop to remain byte-structurally equivalent to the
frozen manifest. T2 expressly requires registering the native silent stop
adapter, while the dispatch requires preserving earlier-phase assertions.
These requirements conflict for SubagentStop. PostToolUse and the phase-7
PreToolUse assertions remain unchanged. Restoring the old hook would remove
the required native attribution adapter and allow the frozen closure path;
adding both commands would also fail the equality assertion and contradict
T2's ban on competing native-attempt legacy closes.

Proposed minimal correction, NOT applied: preserve both PreToolUse assertions,
assert PostToolUse against the frozen manifest exactly as today, and replace
only the SubagentStop frozen comparison with the explicit current native
manifest value shown on the left above. This would verify static registration
only; it would not claim installed-host observation or replace any MANUAL.md
item. The owner must authorize the test path and decide its repair-commit and
post-repair verification allowance. No existing test was changed or weakened.

[deviation] Predicted phase7_guard 84 passed/0 failed; observed 83 passed/1
failed. The test treats SubagentStop as unchanged historical configuration,
contradicting T2's required replacement. Stopped instead of changing an
unleased earlier-phase test or restoring the obsolete hook.

| Target / selector | Predicted pass/fail | Final regression actual |
|---|---|---|
| mcp | 18/0 | 18/0 |
| phase7_guard | 84/0 | 83/1 |
| phase7_risk | 22/0 | not run |
| phase7_lease | 23/0 | not run |
| phase8_config | 14/0 | not run |
| phase8_routing | 44/0 | not run |
| phase8_interview | 40/0 | not run |
| phase8_global | 12/0 | not run |
| phase8_dispatch | 24/0 | not run |
| phase9_contract | 37/0 | not run |
| phase9_stream | 2/0 | not run |
| phase9_material | 20/0 | not run |
| phase9_manifest | 12/0 | not run |
| phase9_context | 13/0 | not run |
| phase9_policy | 21/0 | not run |
| phase9_selection | 30/0 | not run |
| phase9_specialist | 3/0 | not run |
| phase9_admission | 13/0 | not run |
| phase9_binding | 5/0 | not run |
| phase9_observations | 4/0 | not run |
| phase9_returns | 14/0 | not run |
| phase9_recovery | 10/0 | not run |
| phase9_consumers | 10/0 | not run |
| phase9_views | 5/0 | not run |
| phase9_inventory | 3/0 | not run |
| phase9_deferred | 13/0 | not run |
| phase9_model | 2/0 | not run |
| phase9_forward | 1/0 | not run |
| phase9_invoking | 1/0 | not run |
| phase9_history | 1/0 | not run |
| cadence binary review_service::tests::home_request_ | 1/0 selected | not run |
| cadence binary phase9_pause_tests::modern_ | 1/0 selected | not run |

Final regression total actually observed: 101 passed, 1 failed. Task-target
passes earlier in this record are not relabeled as final regression passes.
Clippy remains green from exactly one invocation after the last task commit;
it was not repeated. No code change followed clippy.

## Final disposition

Five atomic conventional commits under John Crenshaw <john@jcrenshaw.dev>, each
rechecked with signature G: f3a8f533 (authorized model repair), 0af835df (T1),
e7e9910c (T2), 3cb467cc (T3), a063ab55 (T4). No unexpected deletions, generated
repository files, attribution trailers or git-config changes. Git status
still contains only the pre-existing .planning/STATE.md modification and
untracked reports. This report remains uncommitted. The original checkpoint
report is retained as plan-6.1.md.

No lease extension beyond the three explicitly authorized model-repair paths
was applied. The newly identified phase7_guard test path remains untouched.
All four MANUAL.md items remain untouched and unverified. This plan is not
complete because its required final regression is red.
