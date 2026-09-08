PLAN CHECKPOINT: structural
Plan: .planning/phases/9/PLAN-7.md
Tasks: 0 of 7

| Task | Commit | Note |
|---|---|---|
| P9-7-T1 | none | Checkpoint before implementation: required service-stub composition case conflicts with the dispatch's explicit prohibition on internal collaborator mocks. |
| P9-7-T2 | none | Not started; sequential execution stopped at T1. |
| P9-7-T3 | none | Not started; sequential execution stopped at T1. |
| P9-7-T4 | none | Not started; its required composition case has the same testing-instruction conflict. |
| P9-7-T5 | none | Not started; sequential execution stopped at T1. |
| P9-7-T6 | none | Not started; recursive resolver test shape remains unchanged. |
| P9-7-T7 | none | Not started; counting-reader test shape remains unchanged. |

## Checkpoint

Current task: P9-7-T1 — Admit execution-boundary review before continuation.

Need: resolve the conflicting test instructions before implementing the
required public composition tests. Either expressly permit internal service
stubs for the two thin public composition cases in Tasks 1 and 4, or revise
those Verify clauses to require real services with stubs only at I/O
boundaries. No criterion was rewritten during this dispatch.

The dispatch explicitly states: "Stub at real boundaries only; do not mock
internal collaborators." PLAN-7.md:86 instead requires calling the public
execute-next handler "with its service collaborators stubbed". Its Notes at
line 142 expressly state: "Internal collaborators may be stubbed to keep a new
adapter's unit test isolated." Task 4's Verify at line 110 likewise requires
stubbed material, routing and persistence collaborators.

The distinction matters in the current implementation: server.rs:675 calls
PublicServer::review_handoff and CadenceServer::query_execution. These are
internal services, not filesystem, clock, subprocess or network boundaries.
Replacing their results with the two specified responses would implement the
plan's thin composition test while violating the dispatch's additional rule.
Calling them for real with I/O stubs would change the expressly required test
shape. Neither change was assumed authorized.

The verbatim replacement rule 4 itself permits a few thin public composition
tests. docs/rationale/acceptance-criteria.md:52 records that the old rule about
not mocking internal collaborators was replaced. The conflict arises because
the dispatch separately makes that old prohibition binding again; the local
document cannot override the current instruction.

Proposed resolution: explicitly authorize internal service stubs only for
these two required composition cases. This preserves the plan's literal
inputs and outputs, its prohibition on call-chain setup, the direct unit
tests, and the existing-test freeze. The alternative is an owner-approved
revision of those two Verify clauses. No production prerequisite repair has
been established, and no earlier-plan implementation or test was changed.

## Inspection record

Read the published executor contract, PLAN-7, phase context and UAT items
151–157 in order, followed by the lean-build reference, project context and
Plan 6 report. Inspected Task 1's named source anchors and their callers.

The retained execution range lookup exists in
execution_service.rs::risk_material. It checks the accepted receipt against
the retained ExecutionBasis and requires confirmed patch acceptance.
execution_service.rs::review_handoff currently delegates only to
review_service.rs::pending_execution, which enumerates existing admissions;
the fresh-admission gap remains open. These are source observations, not
verification of a new implementation.

## Verification and counts

No task Verify command ran: no new production unit or test was implemented.
No test result or acceptance criterion is claimed satisfied by inspection.

Before: 523 selected passing tests reported by reports/plan-6.md, comprising
521 integration tests and two binary selectors. This is inherited evidence,
not a baseline rerun. The recorded commands were:

```sh
TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test mcp --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history
TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --bin cadence review_service::tests::home_request_
TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --bin cadence phase9_pause_tests::modern_
```

After: not measured; zero tests added or modified and zero tests executed in
this dispatch. No full-suite allowance was consumed.

Clippy: zero invocations. The required position after the final task's commit
was never reached. No Node suite or typecheck ran for this report-only change.

Report validation: predicted no whitespace diagnostics and lease `ok:true`
with one staged file. Observed `git diff --cached --check` exit 0 with no
output; the published `planning.mjs lease-check --phase 9 --plan 7` exited 0
with `ok:true` and `staged:1`. The staged path was only this report.

## Scope and deviations

Deviations: 1 — the required service-stub test shape conflicts with the
dispatch's explicit internal-mocking prohibition; checkpointed without
redefining verification or implementing an exception.

Open items: resolve that testing conflict; all seven production gaps remain
unclosed by this dispatch. The four manual items remain outside scope.

Branch at intake: cadence/binary-owns-process; HEAD 77045e82.
The only pre-existing worktree modification was .planning/STATE.md, which was
left untouched. The sole new file is this report, committed separately under
the dispatch's explicit report-commit instruction. No previous plan-7 report
existed to rotate. No source, test, fixture, plan or configuration was edited.
No agent delegation, package install, network operation or push was performed.
