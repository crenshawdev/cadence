PLAN CHECKPOINT: structural
Plan: /code/cadence/.planning/phases/2/PLAN-1.md
Tasks: 2 of 6

| Task | Commit | Note |
|---|---|---|
| 1 | 11054d2c | Frozen live-cycle builder and 28 fixture files; prior verified and staged set committed with required author and GPG key. |
| 2 | c8041775 | Hermetic recorder and five recordings; all Task 2 predictions passed; Clippy/typecheck green; seven individually staged files passed lease gate. |

Deviations: 2
- [deviation] Task 1 specified a one-entry ROADMAP and total:1, but preserving all 16 archived files derives phase 1 complete and current:null. Hypothesis D was proposed and approved by the dispatching orchestrator after the falsifying test, not by the human owner: synthesize two ROADMAP entries, phase 1 checked with its complete archive and phase 2 unchecked with no directory. The agreeing STATE cursor is Phase: 2 of 2. All 16 archived files remain byte-identical to v3.7.12; status is current:2,total:2 with phase 2 unplanned, and phase 1 replay remains true. This is the single approved fixture adjustment.


- [deviation] Task 3 requires every operation's refusal invocation to reach a fail('<code>') arm of its own handler, excluding the dispatch door, and its Verify requires a per-operation success/refusal table. The frozen CLI cannot reach the sole handler refusal for trace render, trace suggest or trace window: all three reject an invalid optional --phase through requirePhaseArg, but the dispatch door evaluates that same classifier first and returns bad-args before calling the handler. No Task 3 manifest entries were added; stopped for a structural decision instead of pretending a door refusal reached the handler.

Open items: 1
- Task 3 is blocked on correcting the refusal-coverage requirement for operations whose handler refusals are unreachable through the frozen CLI. Tasks 3 through 6 remain uncommitted and unimplemented.

Task 1 verification and lease evidence is preserved in plan-1.4.md. This dispatch confirmed the 30 staged paths and did not rebuild, re-verify or re-stage Task 1. Signing succeeded. Full-suite allowance remains unused. Reports are uncommitted for the orchestrator.

Task 2 verification: two complete runs byte-identical; --only rewrote exactly the selected two files (mtime checks), with bytes unchanged; empty ambient environment (only PATH and workspace TMPDIR) reproduced all bytes; all five recordings carry the 13 contract keys in order and node 26; no absolute path pattern matched; status current=2, ok=true; missing phase exit=1, reason=no-phase-dir. Temporary verification directories were removed. Frozen cadence-core diff exited 0. Command detection matched the handoff; RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings and npx --no-install tsc -p tsconfig.ci.json exited 0. npm cache redirected inside the workspace; no installs.

Current task: 3 - The manifest covers planning.mjs's 43 arms
Need: Approve a narrowly scoped correction allowing a dispatch-door bad-args refusal for trace render, trace suggest and trace window, while keeping handler refusals mandatory wherever the frozen CLI can reach one.

Structural evidence:
- cadence-core/bin/planning/trace.mjs:1123-1196 (suggest), 1197-1261 (render), 1262-1308 (window): each arm has exactly one fail call, conditioned on invalid requirePhaseArg(opts.phase). Absent phase is allowed; all normal paths return ok.
- cadence-core/bin/lib/arg-contract.mjs:1068-1084 declares optional --phase with type phase, value refuse, bare refuse for all three. Its phase classifier at line 199 uses requirePhaseArg; evaluateFlag checks every occurrence (including duplicate flags).
- cadence-core/bin/planning.mjs evaluates the argument contract before calling the handler; invalid phase returns the door's fail('bad-args', ...) first.
- Bounded CLI probes were predicted before execution. Each of trace render|suggest|window --phase invalid --dir crates/cadence/tests/golden/fixtures/slice/.planning exited 1 with stdout.ok=false, reason=bad-args, detail='trace <arm> --phase needs a phase number: --phase <N>', and the door's 'correct the flag the detail names and re-run' hint. Each handler's own detail would instead be 'trace <arm> --phase must be a phase number'. All three probes matched the prediction. They were read-only and used ignored stdin and a workspace-local HOME/global override.

Proposal: Record success plus the actually observable CLI door refusal for these three operations; mark the refusal source explicitly in the per-operation report table. Keep all 43 planning operation ids, at least two invocations per id, the remaining coverage requirements, and the frozen reference unchanged. Apply the same exception only if later handler inspection proves another arm's refusal unreachable.
Impact: This changes the refusal-source acceptance requirement, not the operation inventory, the recording contract or frozen runtime behavior. Plans 2 and 3 retain CLI-level recordings.
Alternatives: (1) success-only recordings for these arms would also relax the two-invocation/refusal requirement and provide less coverage; (2) directly importing handlers would bypass the CLI contract being measured and change the harness shape; (3) changing cadence-core to expose the handler refusals violates the frozen-reference boundary and is outside this lease.

Checkpoint state: 11054d2c and c8041775 are the two signed task commits from this dispatch, author John Crenshaw <john@jcrenshaw.dev>, requested signing key 693AB15F91734B0C, subject only and no attribution trailers. Both post-commit glances showed no deletions and only the exempt reports directory untracked. The report is unstaged and uncommitted. No full suite was run because the plan is checkpointed before its last task; the allowance remains unused. No git config changes, installs, branches, worktrees or pushes were performed.
