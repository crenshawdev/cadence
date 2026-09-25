# The bootstrap exception (D-156)

On 2026-09-13 the rewrite branch's store refused every write it was asked
for. HEAD's snapshot had dropped the `root` field that state.json carried,
integrity no longer matched, and the binary could not record a repair to
itself. The plan that was supposed to carry that repair, phase 31 plan 5,
needed the store to run. This file is the record of the exception that
broke the loop. It is not read at runtime and carries no rule the binary
enforces; the rule it names lives here and in the six commits that cite it.

## D-156

A defect that stops the binary from recording its own repair, or suite debt
no open plan owns, may be fixed by hand. The gates stay: a red test first,
or the failing test that already exists as the red; one signed conventional
commit per fix naming what it fixes; clippy clean on what it touches; the
full suite once at the end; and the record written here, never into the
store. Everything else waits for the front door.

John, 2026-09-13, after asking whether we were finding bugs or shoehorning:
"Six. Don't send anything to codex. I want you to handle it."

## The six

1. `e05c3824` fix(store): a root whose filesystem identity changed at the
   same path is the same root when its bytes match. Re-lands 9d24bdaf, which
   8ccb543f had reverted so plan 5 could land it. state.json carried `root`,
   the snapshot did not, and every write came back "snapshot integrity or
   version mismatch".
2. `8757b24f` fix(import): keep the import manifest as history and carry the
   current layer paths beside it. One manifest field did two jobs; after any
   accepted relocation of the global config the evidence guard refused every
   gate answer with "evidence proposal must preserve import manifest". The
   session now carries `active` beside the stored manifest, and the guard
   compares the manifest against the manifest. This is phase 35's whole scope.
3. `9c7d5037` chore(34): rerender the executor contract skill after plan 1
   taught the binary to retire a task. Plan 1 added the retire paragraph to
   the compiled role and did not rerender `skills/cad-executor-contract/SKILL.md`;
   `tests/mcp.rs` holds the checked-in bytes to the binary's own rendering.
   The same commit allows dead code on the phase 34 support include, where
   `Completed::project` has no caller.
4. `2e0c9770` test(13): rehearse adoption from the pinned rewrite tree, never
   the live one. The rehearsal read the live `.planning` and asserted it had
   no native store; it has had one since dogfooding began, and the roadmap
   has 35 rows where the rehearsal counts 30. The source is now cea1f28c,
   the phase 13 close, exported from git.
5. `c27ecb61` test(31): ignore the retired T6 red until phase 32 respecifies
   it. P31-3-T1's committed red stays in the tree with the reason on the
   attribute. The four clippy lints in `support/phase31_hosts.rs` wait for
   phase 32 with it.
6. `167f7e39` test(12): bind a provisional publication's null map as the
   empty string in the admission fixture. Plan 6's repair: compact plan-read
   emits `map_revision: null` for a provisional publication, and the fixture
   kept the null, so the provisional control stopped at admission-shape
   before admission-binding could refuse it.

## What the suite said

The gate that stays is the suite once at the end, and it refused commit 1.
Fifteen tests in five targets: `store::crash_tests`, `execution_store`,
`execution_boundary_compat`, `phase7_receipts` and `phase8_dispatch`, every
one green at 97c70fbc, every one red because state.json now carried an
absolute path and a device and inode chain, a legacy store was rewritten at
first open, and a store copied to another path was refused as moved. Neither
9d24bdaf nor its re-landing had ever been run against the full suite; the
plan that would have run it, phase 31 plan 5, was the plan the store could
not execute.

`985022d5` revert(store) takes commit 1 back out. Under it, the reboot
refusal came back, so the cause got fixed instead of the symptom.

## D-157

A record's directory identity is provenance, never the key the next process
must match. Every native record keeps the device and inode chain of the
directory it was written under. Nothing compares a retained record's chain
with the live one. The in-process guard stays: the writer's live observation
of its directory, the transaction's intent checks, and a claim checked
against the directory it was built in during the same commit. A patch must
still echo the dispatched input's chain, because that is a patch against a
retained record.

`7d60cd9c` fix(execution): a record's directory identity is provenance, never
the key the next process must match. The four replay functions lose the
binding argument they no longer read. Red test:
`execution::tests::native_records_outlive_the_directory_identity_they_were_stamped_with`.

The live store carried a `root` field from the unreleased binary, sealed
into the snapshot's integrity. It was stripped by hand with the binary's own
`Snapshot::new` and `with_operations`, on a copy, re-parsed, then copied
over, generation 131 and every record kept; the original is in the session
scratchpad. John said yes to that before it happened.

## What it made moot

Phase 31 plans 5 and 6 are admitted in the store and pending; their
documents stay as written. Plan 5's work landed as commit 1 and was reversed
by D-157; plan 6's is commit 6. Phase 35 has an approved context (D-155, T1)
and no plan; commit 2 is its scope, and its roadmap row stays unchecked.
How the store closes these three is a front-door question. Nothing here
writes a store record for them.

Phase 35's row and section left ROADMAP.md by hand on 2026-09-14. Its
whole scope had shipped as commit 2 the day before, and the binary has no
way to close a phase whose scope shipped outside it: a plan for it would
own a check with no red left, verification refuses a phase with no
admitted plan, and derivation reads the store, never the box, so a checked
row would have kept it the current phase forever
(`crates/cadence/src/derivation/mod.rs:184-190`). Its approved context
(D-155, T1) stays in the store as history. That missing operation is a
candidate beside the others.

Phase 34 plan 1 is recorded failed on suite `p34-1-suite-20260913`, exit
101, on the four targets commits 3 through 6 fix. Commit 3 is plan 1's own
miss. Phase 34 plan 2 goes through the front door on a green suite.

## The seventh

Later the same evening, with phase 34 plan 2 parked on a checkpoint, a new
Claude Code session died on its first message: "tools.15.custom.input_schema:
JSON schema is nested too deeply. Tool schemas may nest at most 64 levels".
Tool 15 was `cadence_apply`. `host_schema` in `server.rs` merged each
variant's shape of a shared field by wrapping the previous union in a fresh
`anyOf`, one level per variant, and the `operation` field had reached 65.
No host session could load the resident, so nothing could reach the front
door. That is D-156's first clause.

7. `0f925a1a` fix(server): keep every host schema union flat so the API
   stops refusing the resident. Distinct shapes collect into one `anyOf` per
   field, 9 levels deep on both tools. The red is
   `tool_schemas_stay_within_host_nesting_limits` in `tests/mcp.rs`, which
   refuses any advertised schema past 32 levels so the next variant cannot
   take a session down. `cargo test --workspace --no-fail-fast` at `0f925a1a`:
   exit 101, 52 targets, 942 passed, 1 failed, 1 ignored. The one failure is
   `phase34_blocked_then_completed_phase_is_derived_executed`, plan 2's own
   committed red at cbe39c4e (`phase_status` null, not `"planned"`), which
   the seventh commit does not touch.

## The suite

`cargo test --workspace --no-fail-fast` at `7d60cd9c` on 2026-09-13:
exit 0, 52 targets, 941 passed, 0 failed, 1 ignored (the T6 red).

## What it taught

Three gaps, all open, none decided here.

D-120 repairs a failed suite through a linked gap plan, never a rerun, and
D-112 says who owns runs. Neither names a vehicle for a closed phase's test
that goes red later with no open plan to own it. Phase 13's rehearsal and
the phase 12 fixture were exactly that, debt with no owner, which is how
a phase 31 gap plan came to own a phase 12 file. The choice is a standing
vehicle for orphan suite debt, or this exception, made once and named each
time it is used.

D-152 retires a task and says nothing about the red test material the task
already committed. P31-3-T1's red is in the tree, and the attribute that
ignores it is a hand decision. Retirement should say what happens to the
material.

D-120 says a blocked plan is repaired by a later approved gap identity, and
the binary enforces the opposite at three sites. On 2026-09-14, phase 34
plan 2 was retired because its admitted check setup admitted both fixture
plans at once, which `history::phase_complete` can never count as a later
repair. Plan 3, published as the gap at `1f32fd7e`, could not carry a
corrected check: the same id with a changed spec is `evidence-item-conflict`
and a new id under T2 is `truth-check-limit`, because a retired plan's
items stay current in the phase union. Its task cannot own the check either:
an extension must keep every prior allocation entry
(`execution/admission.rs:98`) and a check has one owner
(`execution/allocation.rs:52`). And the phase cannot verify at all while
plan 1 is failed and plan 2 retired, because verification inputs demand
every admitted plan complete (`verification/inputs.rs:113`). One decision,
what a retired or failed plan leaves behind in the current union, three
enforcement sites. Plan 3 stays published and unadmitted until it is made.

A fix written by hand ran its own tests and never the suite, twice, and it
was the suite at the end that caught it. The gate held because it was kept;
a plan would have run it at close, and the plan is the thing that could not
run.

D-158 and D-159 went to phase 36's context on 2026-09-14, and D-161 to
phase 37's the same day. The orphan suite debt vehicle and the retirement
material are still candidates, and so is this one, found closing 36 and
37: a check the verifier rejects for an assertion weaker than its expected
value, on code that is right, has no red left, so no gap plan can re-own
it under D-161 and the owner's only exit is a waiver. Both phases closed
complete-with-waivers for exactly that.

## D-160

The store's own staging files are the binary's, never the user's. A source
observation that runs while a commit is between `prepare` and its rename
sees `.planning/.state.json.<pid>.<seq>.tmp` beside the target, and that
file does not make the tree dirty. Every other untracked path, under any
other name, anywhere, still does.

On 2026-09-14, with 34 and 36 both derived executed and the resident
restarted on the rebuilt binary, `verify-next 34` refused
`evidence-source-dirty` on a tree where `git status --porcelain=v1 -z
--untracked-files=all` printed nothing. A fresh stdio process said the same.
strace showed the order: `commit` in `store/transaction.rs` runs
`validate_all` three times, before `prepare`, after it, and again before
each rename, and for a verification intent `validate_all` re-observes the
source through `inputs::reobserve_external`. The second and third passes
ran with the staging files on disk. `.gitignore` names the store's targets
and not the names `prepare` gives them, so Git listed three untracked files
and the binary refused its own write, then unlinked them. Every test fixture
ignores `.planning/` whole, which is why fifty-two targets never saw it, and
execution receipts do no clean check, which is why execution ran all day
and verification failed on its first live call. A project that tracks its
`.planning` documents, which is the shape the design asks for, could not
verify at all.

This is a D-156 case by its first clause: the binary could not record its
own verification, and the plan that would carry the fix needs verification
to run.

8. `ac929d8b` test(store): a commit in flight must not dirty its own source.
   `tests/store_staging_clean.rs` drives the real store with a probe at
   `Stage::Prepared` on a fixture that tracks `.planning` and ignores only
   the store files; `runner::clean` and `inputs::source` must both read the
   tree as clean while the staging file exists. Two more tests: the exact
   names `prepare` writes, by hand, at both places it writes them; and the
   negative control, a user's untracked file under six names and places,
   and a modified tracked file, every one still refused.
9. `8acb3948` fix(store): the store's own staging files never dirty the
   source. `runner::status` is now the one reader of `git status` for both
   clean checks and drops an untracked entry under `.planning/` whose name
   is one `prepare` writes; `filesystem::is_staging_name` owns that shape
   beside the naming. The same reader serves the evidence run's before and
   after observation in `verification/runner.rs`.

Clippy is clean on the library and the new target. The four lints in
`tests/support/phase31_hosts.rs` are commit 5's, still waiting for phase 32.

`cargo test --workspace --no-fail-fast` at `8acb3948` on 2026-09-14:
exit 0, 54 targets, 950 passed, 0 failed, 1 ignored (the T6 red).

The first `verify-next 34` on the rebuilt binary opened attempt `00cd1a1c`
at head `8acb3948`, before this record was written. This commit moves HEAD,
so that attempt's basis is stale and the next `verify-next` opens another;
the store keeps the first as history. Nothing here writes a store record.

## D-162

A stored Complete terminal is history once a later extension admits a plan
with no retained outcome. `execute-next` answers complete only while
`phase_complete` still holds, and `admit_dispatch` clears the terminal as
that later plan goes active. A judgment stop still ends the occurrence.

On 2026-09-14 phase 37 (D-161, a rejected check is released like a retired
one) ran its one task through Codex. Three of the four checks went red then
green. The fourth, `P37-T4-C`, completes a plan for real, has a patch
reject its check, publishes and extends a later plan carrying the corrected
definition, authorizes, and asks `execute-next`. It got
`{"status":"ok","outcome":"complete","phase":37}`. `execution-plan-complete`
stores `occurrence.terminal = Complete` when `phase_complete` holds
(`execution/history.rs:597`); `execution-extend` never clears it;
`execution_service.rs` answers the stored terminal before native selection,
and `dispatch::admit_dispatch` refuses `dispatch-terminal` after that. Phase
34 never met this because its plans were blocked, not complete. Phase 36 is
complete, so its own gap plan, the reason phase 37 exists, would have met
it next.

No plan can carry the fix. The lease is admitted and cannot widen; retiring
the task releases all four checks, and the three that already pass at HEAD
have no red left to give a new owner. This is D-156 by its first clause:
the binary could not record its own repair.

10. `2231fa71` test(execution): a plan admitted after the phase completed
    must dispatch. `tests/execution_terminal_reopen.rs` drives the real
    binary over stdio: plan 1 completes through red, green, attestation,
    close, suite, risk and plan completion; the phase answers complete (the
    control); an artifact-only plan 2 is published, extended at set version
    2 and authorized; `execute-next` must dispatch plan 2 and plan 1 must
    still read complete.
11. `2bacd2a3` fix(execution): a later admission reopens a completed phase.
    `execute-next` consults `history::phase_complete` before answering a
    stored Complete terminal; `admit_dispatch` treats a Complete terminal as
    history for a candidate plan with no retained outcome and clears it as
    the dispatch goes active. Judgment stops are unchanged.

The two commits sit between the executor's red and its completion by
rebase: nothing was pushed. The executor's own check-shape correction
(`698f3e06`) was rebased under them as well, so all four red runs bind to
that commit and all four green runs to the rebased completion `8e8d5e82`.
The close checks the lease only on the evidence commits and the completion,
so the strike between them is what the ancestry rule allows and nothing
more. The executor's earlier runs at commit ids the branch no longer
carries stay in history as observed runs.

Phase 37 then blocked twice on its own suite (plan 1: releasing on the
rejection alone hid the rejection from phase 13; plan 2: eager saved-map
resolution broke an admission unit fixture) and repaired each through a
D-120 gap plan; plan 3 completed and the phase derives executed. The suite
at `f2f9daae` (execution-suite `phase37-plan3-suite`): exit 0, observed by
the binary at plan completion.

## D-170

A completion commit that touches a path outside the admitted lease closes.
The binary keeps the difference, by commit and by path, and the plan record
names each path as a deviation with the commit as its evidence, for the
verifier D-164 sends to read them. The lease is what the planner expected
before the code existed. The binary still refuses what it can see for
itself: a staged path outside the lease at close, and, once D-166 lands, a
hand edit to a file it renders.

On 2026-09-15 phase 38 plan 1 dispatched its first task to Codex, and Codex
stopped before writing a line. The task removes `ActiveDispatch.prompt_bytes`,
and eight files that use it sat outside the lease: `execution/boundary.rs`,
`store/writer.rs`, `store/model.rs`, `store/transaction.rs`,
`import/routing_admission_tests.rs` and three test files. The planner had
listed the files it could think of. Admitted plan bytes cannot change
(`plan-changed`), no operation widens a lease, and retiring the task
released its check, so `execute-next` refused `truth-without-check` and
nothing in the phase could dispatch until a new plan carried the check. One
wrong file list cost a retire, a gap plan, an extension and a dispatch, and
the plan it stopped was the one written to end that kind of stop. A guess is
not a gate.

The count for 2026-09-13 through 15, from the session record: seven
suite-once blocks, three tasks retired for order or lease, one phase retired
and one truth waived by hand, against two real bugs fixed by hand (D-160,
D-162) and one plan blocked by a unit test. Twelve process, three bugs.

D-156's last sentence, "Everything else waits for the front door", is
withdrawn for the rewrite. John set the line on 2026-09-15: those rules are
for a live Cadence on a user's project, not for the binary while it is being
built. While the binary is being built, a defect is fixed the way this file describes, and the front door is
run on one operation at a time to see what it records, never on its own
repair. It comes back as the gate on a user's project when the process can
recover from its own mistake with one owner answer.

12. `d0754518` test(execution): close a commit outside the lease and name it
    on the plan record (D-170 red). The unit test that asserted the refusal
    now asserts the retained paths, and a new stdio test in
    `tests/execution_blocked_path.rs` closes a task whose completion commit
    adds `docs/outside.md`, then retires the next task and reads one
    deviation on the blocked plan's record. The existing retire test gained
    the negative control: an in-lease completion records none.
13. `0a647bfa` test(execution): expect only the out-of-lease side of a
    rename to be named (D-170 red). The fixture lease covers `src/`, so the
    renamed destination was never outside it.
14. `27238429` fix(execution): keep a commit outside the lease and name each
    path on the plan record (D-170). `receipts::observe_source` retains
    `out_of_lease` by commit instead of refusing; `history::end_dispatch`
    writes one `Deviation` per path with the commit as evidence.
    `SourceMaterial.out_of_lease` defaults and is skipped when empty, so
    every retained record and digest reads as before.

Clippy is clean on the two files touched; the two warnings at
`tests/support/host_rounds.rs:375` and `tests/read_layer.rs:35`
are phase 31's. The suite runs once at the end of this batch, after D-171
and D-172, and its result is recorded here.

The executor-patch boundary in `execution/patch.rs` still refuses
`undeclared-files`. It is the 3.x surface and goes when that surface goes.

## D-171

The orchestrator requests `execution-suite` and `execution-plan-complete`.
The executor closes its last task, reports, and stops. The binary ran the
suite and wrote the receipt before this and it does after; what changed is
who asks. No model sits between the request and the tests, and the executor
never holds a gate on its own work.

On 2026-09-15, tracing why the phase 31 live-host test went red under one
runner and green under another, John asked what decided that the suite ran
through Codex at all. Nothing in the binary did. `execution-suite` takes a
plan identity and a version and runs `cargo test --workspace --no-fail-fast`
itself; anyone with the front door can request it. Codex requested it only
because the compiled executor text told the executor to, after its last
close. So every plan's suite since phase 31 ran five layers deep: this
session driving the binary over MCP, the dispatch handed to Codex, Codex
talking to its own Cadence server, that server running the suite, and one
test inside it starting a real Claude with a server and a worker of its own
(that test is D-172). Two of those layers are the design and stay: the
binary runs the suite so the binary records the result, and an executor
exists because something has to write the code. The executor asking for the
gate was neither. It was one sentence in the executor's instructions, and
the sentence moved.

15. `7b55857b` test(execution): hand the suite and plan completion to the
    orchestrator in the compiled text (D-171 red).
    `executor_never_requests_the_gates_the_orchestrator_owns` reads
    `dispatch_text()` and `frontdoor_markdown()`: the executor text must say
    it never requests either operation and must name the D-170 deviation in
    its lease paragraph; the front door text must request the suite and
    then plan completion itself.
16. `a7ecb7e1` feat(execution): let the orchestrator request the suite and
    plan completion, never the executor (D-171). `execution/instructions.rs`
    moves both requests into the front door's step 7: when the executor's
    digest reports the last task closed, request `execution-suite`, wait
    for its receipt, then request `execution-plan-complete` with the
    version the receipt reports. The lease paragraph now says what D-170
    made true. `skills/cad-executor-contract/SKILL.md` and
    `skills/cad-execute/SKILL.md` are the binary's rendered output, compared
    byte for byte after the build.

The one test is green. Nothing has run through the front door this way yet;
the next dispatch is the first that does, and what it records goes here.

## D-172

A check runs only what the repository builds. A test that starts a program
the repository does not build, the installed `claude` here, is a live probe:
it stays in the tree, runs on request with `--ignored`, and is never in a
plan's suite, because its answer depends on a host the plan cannot pin.

On 2026-09-15 the morning suite failed on
`phase31_worker_hosts_receive_main_thread_answers` at
`support/phase31_hosts.rs:73`: zero descendants of the launched Claude with
`cadence serve` in their command line, and most descendants recorded as
`""`. The record for two days had called that test "needs a running
authenticated Claude host", taken from its first assertion's message, not
from any failure. Everything before line 73 had passed: the host launched,
one worker dispatched, and both threads answered as the stdio oracle did.
The same test was green under Codex at `4e5d3f8c` the night before. That
fits a race in the measurement and nothing else: the sampler walks `/proc`
every 20ms until Claude exits, a child that has already exited reads back
an empty command line, and `found.insert` let the last sample replace the
one taken while the child was alive. Keeping the first live command line
per pid and running the test once settled it: 1 passed, 193s, one
`cadence serve` shared by main thread and worker. The resident was shared
all along. The test was lying about the one thing it existed to prove.

Its sibling `phase31_planner_round_reports_reads_and_tokens` starts the
installed Claude the same way and leaves the suite for the same reason.
Whether the binary should refuse such a command at `plan-submit` is a
later phase; today the rule is in the tree as an `#[ignore]` reason.

17. `39b3ee08` fix(tests): keep the command line a sampled child had while
    it was alive (D-172). `sample_process_tree` fills a pid's entry once and
    never with an empty read over a non-empty one. No red test: the live
    probe is the check, and its run is recorded above.
18. `239b7def` test(31): take the two live-host proofs out of the suite
    (D-172). Both carry the same `#[ignore]` reason;
    `--test phase31_read_layer` reports 5 passed, 2 ignored.

Clippy on the touched test binary shows the same two phase 31 warnings as
before. The suite ran at the end of this batch; D-173 records it.

## D-173

Amends D-165. A dispatch prompt is retained per issue, not once per
admission. An issue is the dispatch state the operational input carries
before any prose is rendered: task states, checks, completion, continuation,
suite state, head. `execute-next` compares that state's digest with the last
retained issue. Same state, same bytes, no render, whatever the compiled
renderer now says. Changed state, render under the current renderer, retain
the new prompt, its digest and the state digest on the admitted dispatch,
and answer with it. The prior issue stays in the boundary history it was
already written to. Nothing re-renders an issue; a continuation with
progress is a new issue.

On 2026-09-15 plan 38-1 landed as code on Codex, seven signed commits, with
`prompt_bytes`, `render_prompt_version` and the historical-renderer path
gone and the thirteen rendered skill files leased by rule and guarded. Its
eleven verify commands were green, and the suite, run once afterwards as
D-171 says, failed fourteen tests in files the plan never named. Thirteen
were the fallout the phase 38 context predicted for D-165, D-166 and D-170:
pinned digests, hand-built dispatches without the new fields, two tests
asserting the lease refusal D-170 removed, two asserting the authored lease
alone, the D-147 scope comparison at `read/scope.rs:50` refusing every read
because the active lease now carries the registry, and one assertion of my
own from D-171 that had passed only because a line wrap split the sentence
it was matching. The fourteenth was a design conflict: a continuation
`execute-next` returned the retained admission prompt, whose operational
block listed every task with no progress, and phase 12's truth is that a
continuation dispatches only the unfinished tasks. D-165 read literally
broke that. Two ways out were put to John: keep the admission bytes and
carry state only in the JSON, or retain per issue. The prompt is what an
executor is handed, so a prompt whose operational block lies on every resume
was not a choice. He chose per issue.

19. `05c5e3e3` test(execution): prove admitted prompt survives renderer
    change (P38-1-T1 red); the check builds a second real binary from a
    source copy with one compiled sentence changed, 26 seconds.
20. `a58b9045` feat(execution): retain the admitted prompt and answer with
    it (P38-1-T1). `prompt` and `prompt_digest` on `ActiveDispatch`, set at
    admission; readback clones after a digest check. The eighteen retained
    records on this project written before D-165 still load through a
    read-only `prompt_bytes` field, and a readback of one refuses
    `prompt-not-retained`.
21. `76b263b6` test(execution): prove rendered skills are implicit lease
    material (P38-1-T2 red).
22. `83ffdf1d` feat(execution): lease and protect every binary-rendered file
    (P38-1-T2). One registry in `execution/render.rs`, used by dispatch
    construction and the Write/Edit guard; six stale skill files
    regenerated by the binary in the same commit.
23. `ee93de32`, `337ff725`, `1cb2c709` test fixes on the two tasks; the
    plan's `--lib` selectors named tests mounted from `main.rs`.
24. `d8ddc197` fix(execution): preserve legacy dispatches without flattened
    fields; serde does not honor `deny_unknown_fields` beside `flatten`.
25. `f2f2e05e` test(execution): assert out-of-lease closes retain deviations
    (the D-170 shape in phase 12's close test).
26. `40c17200` feat(execution): reissue prompts when dispatch state changes
    (D-173). `issue_digest` on the dispatch; `BoundaryChange::Reissue`
    writes prompt, prompt digest and issue digest through a recoverable
    `NativeExecutionReissueV1` intent.
27. `0392716b` fix(read): compare task scope with the implicit rendered
    lease (D-147 after D-166).
28. `8501b201` test(execution): align retained dispatch fixtures with
    current rules; `208cc0c8` fix(store): box legacy dispatch operation
    payload (clippy's one new warning).

Suite at `208cc0c8`, `TMPDIR=/tmp cargo test --workspace --no-fail-fast`,
run once in a shell: 57 result lines, 0 failed, 0 panics, 2 ignored (D-172).
Clippy clean but phase 31's two. Nothing pushed.

## D-174

Phase 38 plans 2 and 3 landed as code the same way plan 1 did, and with them
every rule the phase was opened to change is in the binary: D-163 and D-164
(a first red opens one owner question, one repair, one more launch; a second
red blocks; a refused repair blocks; the repair's out-of-lease paths are a
deviation on the record), D-167 (the owner may name the plan `execute-next`
dispatches) and D-168 (a suite receipt keeps every result line past the
65,536-byte prefix). The last decision of the day is not a rule. It is that
Codex is off, for every role, until John says otherwise. The front door's
product path is a Claude host: the Write/Edit guard D-166 installed, the
dispatch prompt handed through the Agent tool, the shared resident a worker
inherits, the per-issue readback D-173 added. Every native run through today
had Codex as the worker and none of that path has been watched. The next pass
runs it as a user would, with subagents, and counts stops.

On 2026-09-15, one Codex session took both plans in order. Plan 2 needed a
second red commit because its first fixture's completion subject did not name
the task. Plan 3 went red and green first time. Its clippy found three
warnings in the new hunks, fixed in one commit. The suite then failed one test,
`phase12_dispatch_contains_admitted_checks_state_and_instructions`, on a
pinned phrase, "runs once", that D-163's prose had replaced; the test now
matches phrases across the hard wrap, since a rewrap is not a change of
instruction, and pins the new sentence. Codex also reported, unasked, that its
T3 check stopped at the blocked outcome and skipped the spec's last clause. A
Claude subagent finished it: a later gap plan completes and `verify-next`
carries plan 1's blocked outcome, its one deviation with the repair commit as
evidence, and the repair event's changed paths. Two things the binary refused
on the way shaped that test: `execution-admit` refuses a set that is already
admitted, so the gap plan enters through `execution-extend`; and a second
check for the same truth is refused `truth-check-limit`, so the gap task is
artifact-only. Both are the rules working.

The CI workflow lost its Node matrix and typecheck the same afternoon. They
ran the 3.x suite against files the 4.0 binary renders and had been red since
the 13th; there is no further 3.x work. The Rust suite is CI. It took 48
minutes on the runner for that push, which is its own problem and is not
solved here.

29. `3cd03a33`, `34bdef83` test(execution): require one owner-gated suite
    repair (P38-2-T1 red); the second names the fixture's completion task.
30. `15025a1f` feat(execution): retain one owner-gated suite repair
    (P38-2-T1). `SuiteRepairQuestion`, `SuiteRepairAnswer` and `SuiteRepair`
    plan events; `execution-suite-repair-answer` and
    `execution-suite-repair`; `Decision::RepairSuite`; the deviation derived
    at terminal projection; verification inputs carry plan outcomes; the
    executor and front-door text and acceptance rule 5; two skills
    regenerated by the binary.
31. `77e760a4` test(execution): require selected plans and lossless results
    (P38-3-T1 red).
32. `bd7b6624` feat(execution): select plans and retain result lines
    (P38-3-T1). `plan` on `execute-next` with the owner-selected marker in
    the answer and history; `Capture.result_lines` scanned past the prefix
    cap.
33. `7079724b` fix(execution): clear phase 38 clippy findings.
34. `4ab1eca7` ci: run the Rust suite alone.
35. `971648ca` test(12): match executor instruction phrases across the hard
    wrap.
36. `af82e299` docs(acceptance): rule 5 as the owner holds it.
37. `bee6496f` test(38): prove verify-next carries the blocked repair outcome
    after a gap plan (P38-T3-C), the Claude subagent's commit.

Suite at `28f116ce`, `TMPDIR=/tmp cargo test --workspace --no-fail-fast`, run
once in a shell: 57 result lines, 0 failed, 0 panics, 2 ignored (D-172).

## D-175

The first query of the live pass refused. On 2026-09-15, with the phase 38
release installed and the resident restarted, `execution-history` and
`execute-next` for every phase came back `invalid immutable boundary record`.
The store had not changed. The binary had.

`a58b9045` (P38-1-T1, item 20 above) replaced `prompt_bytes` on the dispatch
receipt with `prompt_digest`, gave the new field a serde default and dropped
`deny_unknown_fields` so the old records would still parse. They parsed. They
did not re-serialize: a retained receipt `{"dispatch_id":…,"prompt_bytes":63671}`
came back as `{"dispatch_id":…,"prompt_digest":""}`, and the identity check at
`store/model.rs:238` digests exactly those bytes. All twenty-three dispatch
boundaries on this project carry `prompt_bytes`; none yet carry a digest. The
compat suite in `execution_boundary_compat.rs` pins the pre-envelope
`boundary` class and had no `boundary_v1` dispatch receipt in it, so the
"aligned" fixtures in `8501b201` went green over the break.

The rule is the one written above the receipt: omission on older boundaries
preserves their serialized identity preimages. A retained record is bytes with
a name, and a schema change that cannot write those bytes back is a schema
change to the record, which the binary does not get to make. The fix keeps
`prompt_bytes` as an `Option<u64>` that is written only when it was read,
skips `prompt_digest` when empty, restores `deny_unknown_fields`, and refuses
a receipt that carries both. The red test is the generation-11 record from
`.planning/decisions.jsonl`, verbatim, round-tripped and validated, beside a
current-shape receipt that must pass and two that must not.

38. `bb1eb347` test(execution): prove a retained dispatch receipt keeps its
    prompt_bytes identity (red).
39. `b6dae3ca` fix(execution): write a retained dispatch receipt back as the
    bytes it was read from.

Hand fix under [[feedback-build-time-is-not-live-time]]'s rule: no plan owned
it, no front door ran on it, and the probe was the debug binary over stdio
against this project's store, `execution-history 31` answering before the
release was rebuilt. The live pass resumes on the rebuilt release.

Suite at `b6dae3ca`, `TMPDIR=/tmp cargo test --workspace --no-fail-fast`, run
once in a shell: 57 result lines, 971 passed, 0 failed, 0 panics, 2 ignored
(D-172). Four targets hold 76% of the 892 seconds: `execution_store` 296s for
18 tests, `phase12_execution` 162s for 7, `phase13_verification` 147s for 7,
`phase38_suite_gate` 72s for 7. Cargo runs targets one after another; that is
the next thing to fix, and John agreed to nextest first.

**Second site, found the same evening.** `verify-next 31` refused `task event
identity mismatch`: every retained close proof embeds the `ActiveDispatch` it
closed under, and D-165 had made that struct drop `prompt_bytes` and always
write `prompt` and `prompt_digest`. Nine phase-31 closes no longer hashed to
their digests. Worse, the snapshot copy of those records had already been
re-serialized by the day's writes and had lost the byte count outright; the
append-only decisions log, which stores each event as text, still had it.
The fix is the same shape on `ActiveDispatch` (`8ae8c8f6` red, `a658ab87`
fix), and the nine snapshot records were restored from the
log's bytes by a one-off program on the crate's own `Snapshot` parse and
render, generation 499, every task and plan event across every phase then
matching its digest (355 checked). Nothing was invented: the log is the
record of source and the snapshot is its projection. That the binary cannot
do that restoration itself is GH-262.

## D-176

The suite took fifteen minutes and was going to take longer. On 2026-09-15,
with 971 tests across 57 targets, `cargo test --workspace` ran 892 seconds,
and four targets held three quarters of it: `execution_store` 296s,
`phase12_execution` 162s, `phase13_verification` 147s, `phase38_suite_gate`
72s. Cargo runs targets one after another. John: "we have to do something
about these tests we are not remotely thru and the number of tests are going
to increase."

Three moves, each measured on the same sixteen-core machine.

**nextest.** Every test its own process, every binary at once. Same 969
tests, 393 seconds. It is the suite command now, locally and in
`test.yml`, pinned at 0.9.144 and fetched prebuilt. The repository has no
doc-tests, so nothing nextest skips was being run.

**The inventory tests.** Four tests named `*_repair_inventory_runs_registered_evidence`
proved their criterion rows were registered by listing the binary, then ran
every row again inside themselves, serially. The store one ran six tests
including the 256-budget test and took 392 seconds, which was the wall clock
of the whole parallel run. Each row is a test and runs as one; the inventory
test keeps the listing check and the compile-time binding to the function
and no longer calls it. 302 seconds.

**The 256-budget test.** `scoped_budgets_admit_256_plus_terminal_and_reopen_never_grows_either_scope`
ran its two-scope fill in both orders, 2,048 store requests, 223 seconds
alone. One order stays, the production one: the phase scope fills and binds,
root refusals keep their own budget after it. 113 seconds alone. The other
half of that number is the store's: every write re-validates the whole log,
which is why 512 writes cost 110ms each on tmpfs. That is the product fix,
filed as GH-261 with the `4.0-blocker` label John asked for, and parked.

What was refused: a test-only smaller budget. The rule is 256, the test
writes 256.

40. `test.yml`: nextest as the CI suite.
41. the four inventory tests, `execution_store.rs`, `execution_service_tests.rs`,
    `execution/tests.rs`, `execution_boundary_compat.rs`: register, do not
    re-run.
42. `execution_store.rs`: one fill order.

Suite at `3d41ae30`, `TMPDIR=/tmp cargo nextest run --workspace --no-fail-fast`,
run once in a shell: 969 passed, 0 failed, 2 skipped (D-172), 261 seconds
wall. From 892.

Suite at `824bd25a`, `TMPDIR=/tmp cargo nextest run --workspace --no-fail-fast`,
run once in a shell: 969 passed, 0 failed, 2 skipped (D-172), 259 seconds
wall.

## D-177

The first `verify-next` of the live pass answered with an eleven-megabyte
prompt, and the MCP client closed the connection on it. Measured: 164KB of
contract prose; the rest was phase 31's execution history as pretty-printed
JSON, 2.8MB compact, of which 2.3MB was fifty-eight captured stdout and
stderr blobs stored as JSON integer arrays, one integer per line once pretty.
The executor's dispatch is bounded to its plan and came to 23KB; the
verifier's was the whole phase with the bytes in it.

A run's captured output is retained on the record as bytes and is digested
there. The prompt is a rendering of that record, not the record. It now names
each capture by its digest and `byte_length`, the attempt's retained inputs
and every basis digest are untouched, and the contract tells the verifier to
read the bytes through `execution-history` when the run is what it is
inspecting. The compiled sentence changed, so the two rendered skills were
regenerated through the binary and committed with the source.

What stays open, filed as GH-263 with the `4.0-blocker` label: the verifier
input is still the whole phase history. It should be bounded the way the
executor's is, per item with run ids and history on demand, and captures
should be stored as text, which is a schema change that waits on GH-262's
rebuild path. The eleven-megabyte attempt `0cb057de` stays in the store; a
retained record is not deleted.

43. `8fe40e82` test(verification): prove the verifier prompt names captured
    output by identity, never bytes (red).
44. `941e9eae` fix(verification): capture elision in the prompt renderer, the
    contract sentence, the two regenerated skills, and phase 13's dispatch
    test repinned to the elided rendering with the elision asserted.

Suite at `eb4a1e42`, `TMPDIR=/tmp cargo nextest run --workspace --no-fail-fast`,
run once in a shell: 970 passed, 0 failed, 2 skipped (D-172), 256 seconds
wall.
