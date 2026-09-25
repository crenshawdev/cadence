---
phase: 17
plan: 6
requirements: ["T6"]
files: ["crates/cadence/src/git_process.rs","crates/cadence/src/git_process/tests.rs","crates/cadence/src/lib.rs","crates/cadence/src/process.rs","crates/cadence/src/process/tests.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/pause/git.rs","crates/cadence/src/why/git.rs","crates/cadence/src/why/corpus.rs","crates/cadence/src/execution/runner.rs","crates/cadence/src/pause/branch.rs","crates/cadence/src/rail/git.rs","crates/cadence/src/guard/bash.rs","crates/cadence/src/rail/commit.rs","crates/cadence/src/recall/history.rs","crates/cadence/src/read/document.rs","crates/cadence/src/landing/effects.rs","crates/cadence/src/store/mod.rs","crates/cadence/src/derivation_service.rs","crates/cadence/src/rail_service.rs","crates/cadence/src/pause_service.rs","crates/cadence/src/why_service.rs","crates/cadence/src/task_service.rs","crates/cadence/src/guard/audit.rs","docs/architecture/store.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-6-T1","verify":["cargo nextest run -p cadence --lib git_process::tests::git_subprocesses_run_under_a_deadline","cargo nextest run -p cadence --lib git_process::tests::registered_callers_select_their_deadlines","cargo nextest run -p cadence --bin cadence guard::bash::tests::a_branch_timeout_names_the_command_and_bound"]},{"id":"P17-6-T2","verify":["cargo nextest run -p cadence --lib process::tests::git_launches_require_registered_deadlines","cargo nextest run -p cadence --lib process::tests::deadline_expiry_requests_cleanup"]}]}
---
## Goal

Every production git spawn has a registered deadline and returns a named limit after reaping its child.

## Must be true when done

- T6. When a git subprocess exceeds its deadline, the caller sees a limit disposition naming the command and the bound, with the child reaped, and no git subprocess in crates/ left without a registered deadline.

## Context

At HEAD 7d492bf3 all production program starts pass through process.rs::Process. Launch already has timeout: Option<Duration> and a timeout builder; System::run kills and waits after the timeout, but starts its timer after synchronous stdin writing and returns only the exit status, with no explicit timed-out observation. Fourteen literal Launch::new("git") sites in ten files have no timeout: pause/git.rs (run and temporary-index input), execution/runner.rs::git, guard/bash.rs::branch_observation, execution_service.rs (git_output_bytes and git_status), rail/commit.rs (input and optional_config), rail/git.rs::run, pause/branch.rs::observe, why/git.rs (run and run_with_input), recall/history.rs::read_git and read/document.rs::dispatch. landing/effects.rs::run launches invocation.program with a 60-second timeout and own_group; landing/report.rs reaches git through effects::observe. hooks/hooks.json gives cadence guard 10 seconds. why/corpus.rs contains additional consumers that currently discard failed Run values; they must retain a timeout note. Plan 5 supplies acquisition caps to preserve when changing these launch paths.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/git_subprocesses_run_under_a_deadline",
      "spec": {
        "command": "cargo nextest run -p cadence --lib git_process::tests::git_subprocesses_run_under_a_deadline",
        "expected": {
          "kind": "property",
          "value": "A supplied TimedOut observation for GuardBranch and argv symbolic-ref --quiet --short HEAD becomes a limit naming that command and enforced bound 9 seconds; for each of the other fourteen registered caller identities it becomes a limit naming its supplied argv and bound 60 seconds. Ordinary exit 0 preserves its output, an ordinary nonzero exit remains an ordinary failure for the caller to interpret, and a supplied non-timeout signal exit is not mislabeled a deadline. Literal expected bounds and words are handwritten, not read from the registry. This detects lost timeout attribution, swapped bound selection, omitted argv and successful-empty or generic-failure substitution."
        },
        "test": {
          "file": "crates/cadence/src/git_process/tests.rs",
          "function": "git_subprocesses_run_under_a_deadline"
        },
        "setup": "Use independent plain-value rows of registered Caller, representative argv and process completion observation. TimedOut is the external fact; the fake does not supply a limit disposition. Execute the production finish interpreter and its normal deadline-selection helper. No Process implementation, program, repository, live clock or filesystem is used.",
        "call": "Call git_process::finish for each supplied completion observation and inspect that unit's returned result or Limit {command,bound}. Do not call guard, pause, risk, recall, task or landing workflows and do not infer real child death from a value.",
        "boundary": "git_process::finish, the interpretation of one observed git completion under its registered caller deadline",
        "fakes": []
      },
      "reason": "Unit check of git_process::finish's own decision; the running-resident trigger and outcome are left to the phase 18 live gate.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Unit check of git_process::finish's own decision; the running-resident trigger and outcome are left to the phase 18 live gate."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/git-deadline-registry",
      "spec": {
        "locators": [
          "crates/cadence/src/git_process.rs",
          "crates/cadence/src/execution_service.rs",
          "crates/cadence/src/pause/git.rs",
          "crates/cadence/src/why/git.rs",
          "crates/cadence/src/execution/runner.rs",
          "crates/cadence/src/pause/branch.rs",
          "crates/cadence/src/rail/git.rs",
          "crates/cadence/src/guard/bash.rs",
          "crates/cadence/src/rail/commit.rs",
          "crates/cadence/src/recall/history.rs",
          "crates/cadence/src/read/document.rs",
          "crates/cadence/src/landing/effects.rs"
        ],
        "substance": "All fourteen literal git launch sites plus landing use registered Caller deadlines through the existing Process boundary: nominal 10s guard, 60s other git. The adapter reports timeouts explicitly and the interpreter preserves command and bound."
      },
      "reason": "A per-caller registry makes all fourteen former direct git sites plus landing's variable git path use one deadline/reaping runner: nominal 10s guard, 60s every other git caller.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This artifact is required for T6's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/git-deadline-census",
      "spec": {
        "locators": [
          "crates/cadence/src/git_process.rs",
          "crates/cadence/src/process.rs",
          "crates/cadence/src/process/tests.rs"
        ],
        "substance": "A mandatory production validate_launch decision rejects unregistered or deadline-less git before System run/start can spawn it and before Recorded can record it or return a supplied observation. Exhaustive Caller deadline selection and value tests replace a source-convention census. This gate covers only launches through process::System and process::Recorded; direct std::process::Command or tokio::process spawns elsewhere in crates/ bypass it, and only the verifier's trace guards against that bypass. No test scans source."
      },
      "reason": "System and Recorded share the production launch-validation decision; an unregistered git launch fails under cargo test only where a test drives that caller through process::Recorded, which at HEAD is pause/git.rs's commit path (crates/cadence/src/pause/git_tests.rs:281-295); for every other caller it fails only live, while only the verifier's trace guards against direct-spawn bypasses.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This artifact is required for T6's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Route all git callers through registered deadlines and deliver the deadline check

- **ID:** P17-6-T1
- **Files:** crates/cadence/src/git_process.rs, crates/cadence/src/git_process/tests.rs, crates/cadence/src/lib.rs, crates/cadence/src/process.rs, crates/cadence/src/process/tests.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/pause/git.rs, crates/cadence/src/why/git.rs, crates/cadence/src/why/corpus.rs, crates/cadence/src/execution/runner.rs, crates/cadence/src/pause/branch.rs, crates/cadence/src/rail/git.rs, crates/cadence/src/guard/bash.rs, crates/cadence/src/rail/commit.rs, crates/cadence/src/recall/history.rs, crates/cadence/src/read/document.rs, crates/cadence/src/landing/effects.rs, crates/cadence/src/store/mod.rs, crates/cadence/src/derivation_service.rs, crates/cadence/src/rail_service.rs, crates/cadence/src/pause_service.rs, crates/cadence/src/why_service.rs, crates/cadence/src/task_service.rs, crates/cadence/src/guard/audit.rs
- **Action:** Deliver git_subprocesses_run_under_a_deadline red then green. Keep git_process::finish, deadline selection and the rest of the production unit in crates/cadence/src/git_process.rs; declare #[cfg(test)] mod tests; there and put its tests in the tests-only crates/cadence/src/git_process/tests.rs. Commit both T1 tests, git_subprocesses_run_under_a_deadline and registered_callers_select_their_deadlines, and every other T1 test written into that file before T1's red run. The red commit also holds lib.rs's git_process declaration and a git_process.rs whose finish has its final signature, compiles and does not yet meet the check, so the red run ends in a failing test, not a build failure. Do not edit git_process/tests.rs again before T1's completion commit. Add git_process with required Caller values ExecutionOutput, ExecutionStatus, PauseRead, PauseIndex, WhyRead, WhyInput, ExecutionRunner, PauseMergeBase, RailRead, GuardBranch, RailCommitInput, RailConfig, RecallHistory, ReadDocumentHead and LandingGit. Select nominal 10s guard/60s other limits and a 1s guard cleanup reserve through an exhaustive production match. Route the fourteen existing launch builders and landing's git arm through registered launch construction; retain gh's current timeout. Preserve argv, cwd, environment removal/overrides, stdin, temporary-index binding, inheritance, literal-pathspec and no-lazy-fetch rules and plan 5's caps. Keep System as the sole external gatherer. Make it return an explicit timeout observation after cleanup (for example ErrorKind::TimedOut, distinct from an unrelated signal); do not infer timeout from SIGKILL. Start its deadline before stdin delivery and ensure blocking stdin/output cannot bypass it; reuse concurrent pipe drainage and owned-process-group cleanup and never introduce an additional process runner. Extract any newly owned elapsed-time/cleanup-action choice into a function taking values, while actual spawn/signal/wait gets no unit test. git_process::finish interprets completion values and selects the named limit. Carry the typed limit through store::Error and extend derivation_service::store_error's exhaustive classification, then preserve it in guard unavailable/refusal diagnostics, rail, pause/task, recall incomplete notes, read and why answers. Include why/corpus consumers which currently turn failures into empty data; timeouts must become named incomplete coverage or a limit, never successful absence. Write independent one-behavior Rust tests for every changed decision without adequate tests, moving gathering out first. Add guard::bash::tests::a_branch_timeout_names_the_command_and_bound against the extracted branch-answer interpreter with supplied timeout values, not branch_observation's I/O. Minimal Process fakes, if needed for a caller's argument-selection responsibility, may only record Launch and return a raw Output/error; no git simulation, PATH fixture, live clock or whole-handler execution. Test git_process::tests::registered_callers_select_their_deadlines with handwritten caller-to-bound rows, including guard's 9s work limit and 10s nominal limit, others' 60s, and retained process-group/capture choices where this unit owns them. The guard limit disposition and a_branch_timeout_names_the_command_and_bound both assert the actual 9-second enforced bound; 10 seconds describes only the host envelope, never the named child limit.
- **Verify:**
  - cargo nextest run -p cadence --lib git_process::tests::git_subprocesses_run_under_a_deadline
  - cargo nextest run -p cadence --lib git_process::tests::registered_callers_select_their_deadlines
  - cargo nextest run -p cadence --bin cadence guard::bash::tests::a_branch_timeout_names_the_command_and_bound

### Task 2: Enforce registered git deadlines at the process construction boundary

- **ID:** P17-6-T2
- **Files:** crates/cadence/src/git_process.rs, crates/cadence/src/process.rs, crates/cadence/src/process/tests.rs, docs/architecture/store.md
- **Action:** Replace the old source census with an enforced launch invariant. System::run and System::start must pass through one production validate_launch decision before constructing Command, and Recorded::run must call that same decision before recording a launch or consuming a supplied observation; a validated launch's git registration and effective timeout cannot be forged or cleared by public field mutation. Reject generic git or a path whose executable name is git without a Caller, and reject a registered git descriptor with an absent/wrong timeout; include variable-program calls in this same gate. Only git_process construction supplies the private registration and required deadline. Test process::tests::git_launches_require_registered_deadlines over plain launch descriptors for literal and path-form git, a missing registration, altered timeout and valid registered launch; assert the validator's refusal/accepted descriptor, never a source-text match. Test process::tests::deadline_expiry_requests_cleanup at the pure deadline-action decision with supplied elapsed values just before and at expiry; assert the requested cleanup, without claiming it occurred. Manually trace all current production constructions in crates/ and classify sh, gpg and landing gh as stated in Notes. Document the limit and cleanup contract; do not add a census-only check or a second evidence-map check. For any untested logic this task changes, add its own small Rust value test; actual process/clock gathering gets no test. Recorded remains a minimal boundary substitute: after production validation it only records the launch and returns the supplied Output/error, and it supplies no registration or deadline decision. A caller test using Recorded must fail when that caller builds unregistered git or changes its required deadline. Do not write a test of the fake; exercise validate_launch directly and reuse caller tests that assert their production launch selection.
- **Verify:**
  - cargo nextest run -p cadence --lib process::tests::git_launches_require_registered_deadlines
  - cargo nextest run -p cadence --lib process::tests::deadline_expiry_requests_cleanup

## Notes

D-213 and D-216. Reuse Process and System instead of creating another spawn/kill runner. Retain fourteen caller registrations plus LandingGit. GUARD_GIT_DEADLINE=10s, OTHER_GIT_DEADLINE=60s and GUARD_REAP_RESERVE=1s remain unchanged: select 9s of guard work inside the nominal 10s host envelope; the guard limit disposition names 9 seconds, the bound actually enforced. Structural enforcement replaces the forbidden source-convention census: every System run/start and Recorded run must obtain a validated launch; git program identity requires a private registered Caller and that caller's required deadline, and generic or modified git launches are rejected before spawn. The current sites are manually traced through that gate by the executor/verifier; the test never scans source. This cannot constrain arbitrary commands inside a caller-authored shell script. The sh launch in execution/runner.rs is the user's configured command, outside D-213's resident-owned git launches; the gpg.program launch in rail/commit.rs is signing, likewise outside D-213. A configured direct git executable cannot evade the launch gate by entering through that variable program. Landing gh remains at its existing 60 seconds, outside the git registry. Corrected HEAD facts include the existing kill/wait adapter, its missing timeout attribution and stdin timing gap; lease process.rs/process tests and why/corpus.rs for those necessary changes. Shared edits are disjoint and sequential: this plan owns git registration/timeout handling in recall/history.rs and read/document.rs (preserving plan 5 caps), only GitLimit-related error presentation in store/mod.rs, its own lib.rs declaration, and a deadline subsection of store.md. Existing recall/mod.rs aggregates history incomplete notes and needs no timeout-specific edit. Removed PATH shims, sleeping children, source scans and deleted-driver targets; the census artifact keeps its id but its description/reason now state structural enforcement. Replaced on 2026-09-23 so its check follows the owner's 2026-09-22 test rules in place of the context's starting check. The check proves how supplied timeout observations become named limits; real elapsed deadlines, guard delivery before the host cutoff, child/process-group termination and reaping, assembled caller propagation, and live-only rejection of unregistered launches for callers without a Recorded-driven test remain unverified until the phase 18 live acceptance gate. The gate covers launches through process::System and process::Recorded. A direct std::process::Command or tokio::process spawn elsewhere in crates/ bypasses it; only the verifier's trace guards against that bypass, and no test scans source. Recorded calls production validate_launch before recording, so an unregistered git launch fails under cargo test only where a test drives that caller through process::Recorded, which at HEAD is pause/git.rs's commit path (crates/cadence/src/pause/git_tests.rs:281-295); for every other caller it fails only live. The fake supplies only observations, not the asserted decision. Existing process.rs and process/tests.rs leases cover this change.
