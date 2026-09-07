PLAN CHECKPOINT: structural
Plan: .planning/phases/6/PLAN-2.md
Tasks: 0 of 6
| Task | Commit | Note |
|---|---|---|
| 1 - Publish three schemas while keeping validation inside Cadence | none | Stopped during interface inspection before implementation. No Verify command was run and no verification prediction or pass is claimed. |
Deviations: 3 structural contradictions in the landed interfaces and declared lease, detailed below.
Open items: none deferred; tasks 1 through 6 remain outstanding at this checkpoint.

Current task: 1 - Publish three schemas while keeping validation inside Cadence
Need: Revise the lease and boundary contract to support shared schema generation, refusals without a validated phase, and persisted response digests that match public answers. Continue only after that scope is assigned.

Checkpoint evidence:

1. [deviation] Task 1 requires schemas generated from the same types Cadence deserializes (`.planning/phases/6/PLAN-2.md:82`). The landed `ExecutorPatch` derives Serialize and Deserialize, but not JsonSchema (`crates/cadence/src/execution/model.rs:226`); its nested patch types likewise lack schema derivation. The parser deserializes that domain type (`crates/cadence/src/execution/patch.rs:52`). The prompt instead obtains a handwritten JSON constant through `patch_schema()` (`crates/cadence/src/execution_service.rs:1102` and `crates/cadence/src/execution_service.rs:1106`). Neither source file is in PLAN-2's lease. No duplicate patch model or replacement service was introduced to evade this boundary.

2. [deviation] AC1 and Task 2 require malformed arguments, including an omitted phase, to produce a durable boundary refusal through the bound root's execution service (`.planning/phases/6/PLAN-2.md:34`, `.planning/phases/6/PLAN-2.md:88` and `.planning/phases/6/PLAN-2.md:121`). Root binding locates the store but does not supply a validated phase. The execution boundary decision requires `phase: u32` (`crates/cadence/src/execution/model.rs:248`), the writer rejects phase zero (`crates/cadence/src/store/writer.rs:769`), decision validation rejects phase zero (`crates/cadence/src/store/model.rs:229`), and execution-refusal intents reject phase zero (`crates/cadence/src/store/transaction.rs:119`). The service's phase-zero path returns before acquiring a session or recording anything (`crates/cadence/src/execution_service.rs:105`). Its refusal helper is private and requires a phase (`crates/cadence/src/execution_service.rs:1457`), while the resident exposes only typed execution query and apply requests (`crates/cadence/src/recall/mod.rs:227`). There is no root-scoped malformed-request operation. No phase was invented, and no alternate audit channel was added.

3. [deviation] Task 2 Verify requires each public response, including terminal log-bound replay, to have its matching persisted response digest (`.planning/phases/6/PLAN-2.md:89`). Ordinary service decisions hash the internal `Response`, before public envelope conversion (`crates/cadence/src/execution_service.rs:1435` and `crates/cadence/src/execution_service.rs:1452`). More conclusively, the terminal record sets `response_digest` to the hash of `execution-log-bound:{phase}`, not serialized response JSON (`crates/cadence/src/store/writer.rs:803` and `crates/cadence/src/store/writer.rs:822`). The writer can replace an observation with that terminal record (`crates/cadence/src/store/writer.rs:587`), but `record_observation` discards the returned view and returns its original response on every successful write (`crates/cadence/src/execution_service.rs:1501`). The public adapter cannot truthfully claim that record hashes its returned envelope. No digest assertion was weakened to accept a different value.

Proposed resolution:

- Extend the lease to the shared patch types and service schema producer. Generate the prompt and public patch schema from one type definition, retaining the strict semantic constraints.
- Define a root-scoped refusal identity for requests without a validated phase and its bounded-log policy. Extend the execution model, resident request, service, store decision validation, writer and transaction intent together so admission remains owned by the resident and single writer.
- Define the canonical public response representation before the service records its digest, including the terminal log-bound response. Propagate the writer's confirmed terminal outcome to the caller.
- Assign corresponding targeted test files with those changes. The additional production paths are `crates/cadence/src/execution/model.rs`, `crates/cadence/src/execution_service.rs`, `crates/cadence/src/recall/mod.rs`, `crates/cadence/src/store/model.rs`, `crates/cadence/src/store/writer.rs` and `crates/cadence/src/store/transaction.rs`.

Impact: this is additional work on PLAN-1's interfaces, not a replay of its completed tasks. Persistence changes need explicit compatibility and recovery checks. PLAN-2 cannot remain an adapter-only implementation under its current lease while claiming these criteria.

Alternatives: assign a prerequisite repair plan, or explicitly revise the acceptance criteria and ownership decisions. Reusing the handwritten schema, guessing a phase, recording an unrelated refusal, or comparing against a non-response hash would weaken the stated contract and was not done.

Final evidence:

- Inspection baseline: `679afd7b`. No production, test, skill, agent or UAT file was changed. Only this report was written.
- `node cadence-core/bin/planning.mjs detect-commands --root /code/cadence`: exit 0; reported lint `cargo clippy --all-targets -- -D warnings` and typecheck `npx tsc -p tsconfig.ci.json`.
- No task Verify, Cargo test, clippy, format, typecheck, Node suite or live UAT ran in this dispatch. Pass counts and exit codes for those checks are not claimed. The supplied 299-test baseline remains supplied evidence, not an independently repeated result here.
- No commits were created, so there are no task signatures to verify. `git log -1 --format='%h %G? %GK %an <%ae>'`: exit 0; existing HEAD reported `679afd7b G 693AB15F91734B0C John Crenshaw <john@jcrenshaw.dev>`.
- `git diff --exit-code v3.7.12 -- cadence-core/`: exit 0 with no output.
- `git diff --exit-code 679afd7b -- cadence-core/ .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/phases/1 .planning/phases/2 .planning/phases/3 .planning/phases/4 .planning/phases/5 .planning/phases/6/CONTEXT.md .planning/phases/6/PLAN-1.md`: exit 0 with no output; the frozen reference and protected planning paths are unchanged.
- Before the report write, `git status --short`: exit 0 with no output. The report directory contained only `plan-1.md`; there was no previous PLAN-2 report to rotate.

## Tasks 1-4 continuation from ac08af5a

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-2.md
Tasks: 1 of 6 (dispatch scope: Tasks 1-4 only)

The starting branch was `cadence/binary-owns-process`, HEAD `ac08af5a`, with a clean tree. The installed executor contract and lean-build reference were read in full, followed by the prior checkpoint, unchanged plan, project/context instructions and PLAN-3 handoff. User overrides govern: append this existing report, no rotation or attribution, GPG-sign each task under John Crenshaw, preserve the named files, and stop before Tasks 5-6. D-27 and D-28 are accepted as decided. No baseline full suite was repeated.

| Task | Commit | Note |
|---|---|---|
| 1 - Publish three schemas while keeping validation inside Cadence | `c0623e63` | Root-bound manual MCP handler lists exactly three typed tools and deserializes raw optional arguments inside Cadence; patch schema and confirmed execution envelopes come from the repaired domain/service. Existing internal constructors and version diagnostic remain usable. |

Task 1 PREDICTION before each Verify: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp tool_schemas` would report 2 passed, 0 failed, 3 filtered, exit 0. ACTUAL:

1. 1 passed, 1 failed, 3 filtered; exit 101. [deviation] The test evaluator expected an object `properties` map even for the derived empty version schema. Corrected the evaluator to allow the absent empty map.
2. 1 passed, 1 failed, 3 filtered; exit 101. [deviation] rmcp returned JSON-RPC `-32601`, not the predicted `-32600`, for a `tools/call` frame whose arguments were an array. Corrected the protocol-code oracle; this remains an error without a Cadence result, not a malformed arguments object. Unknown declared-name lookup separately returns `-32602`.
3. 1 passed, 1 failed, 3 filtered; exit 101. [deviation] Fresh external fixtures inherited an ambient global config with a versioned participant, producing a non-acknowledged store failure at first touch. Set `CADENCE_GLOBAL_CONFIG` to empty in the fixture child environment to select no user-global layer. No global config cleanup or workaround was performed.
4. 2 passed, 0 failed, 3 filtered; exit 0, 4.97 seconds. This was the confirmation after the third bounded fix. The wire schema contains 13 fully enumerated nested patch objects; required fields, extras, null types, union tags, noninteger/nonpositive phases, unsupported schema and omitted arguments all refuse successfully. Mirrored text equals structured content. The raw-call malformed cases would fail if deserialization escaped to rmcp parameter errors.

Initial static analysis exited 101 because existing internal tests construct the unit `Command::Serve` and resident-only `CadenceServer` directly. The public adapter now owns the bound root separately, and the optional CLI argument preserves those internal call sites without editing outside the task lease. Final clippy, fmt check and TypeScript checks all exited 0, including after fixture isolation. `cargo check -p cadence --bin cadence` had also exited 0 during implementation. Every Cargo invocation used `TMPDIR=/tmp RUSTC_WRAPPER=`; TypeScript used `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null`.

Precommit: frozen `cadence-core/` versus `v3.7.12` and every user-named protected planning path versus `ac08af5a` were checked separately with `git diff --exit-code`, both exit 0 with no output. `git diff --check` exit 0. Three task files staged individually; lease check exit 0, `ok:true`, staged 3. Commit signature verified `G`, key `693AB15F91734B0C`, author and committer John Crenshaw <john@jcrenshaw.dev>; no deletions or unexpected artifacts.

Open items: Tasks 2-4 remain in this dispatch. Live host/model execution, protected host writes and compaction remain unproved and reserved for the separately arranged Task 5. Task 6 and UAT.md are untouched.

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-2.md
Tasks: 2 of 6 (dispatch scope: Tasks 1-4 only)

| Task | Commit | Note |
|---|---|---|
| 2 - Route public execution answers through resident and audit log | `7478e18c` | Production routing already landed with Task 1's raw handler. Added external native fixtures, signed source commits, independent verified store reads and canonical digest calculation, semantic preservation, server-failure and terminal replay checks through stdio. |

Task 2 PREDICTION before Verify: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp execution_calls` would report 4 passed, 0 failed, 5 filtered, exit 0. ACTUAL first run: 3 passed, 1 failed, 5 filtered; exit 101, 29.94 seconds. [deviation] The refusal-log fault was correctly unacknowledged, but the fixture expected a repaired filesystem to revive the existing writer. The writer deliberately retains its failed state. A diagnostic single-test run also failed (0 passed, 1 failed, 9 filtered, exit 101); it was a diagnostic, not a claimed Verify pass. Corrected the test to require continued server failure from that resident and then successful retry through a replacement process.

Task 2 rerun PREDICTION: 4 passed, 0 failed, 6 filtered, exit 0. ACTUAL: exactly those counts, exit 0, 29.96 seconds. The extra filtered test is Task 3's strict markdown contract check, installed in Task 2's permitted `mcp.rs` path to leave Task 3's markdown-only lease intact. It is intentionally unsatisfied by the old markdown until Task 3; no full-suite pass is claimed at this intermediate commit.

Evidence: successful dispatch, complete and judgment-stop envelopes; missing task field, foreign dispatch, stale execution version, unsupported patch schema, changed plan set and Git ancestry refusals; immutable execution namespace/SUMMARY during refusals; exact replay after apply; refusal-log failure with `-32603` and stable `failure:store`; separate terminal receipt at the 256-transition limit; process replacement and byte-exact terminal decision/state replay. Every successful execution response is joined to exactly one decision by request identity (or its terminal receipt) and independently computed canonical response SHA-256. Compact responses are at most 16384 bytes and reasons at most 1024, with no prompt/body. Dispatch prompt length matches its admitted byte count. Tests create and invoke actual fixture verification/suite commands and signed commits, without invoking a model or an execution service helper. Continuation authority is explicit store fixture setup; it is not a simulated host/operator claim. Fixture-local Git configuration uses John Crenshaw and the required GPG key; this test environment must have that key available.

The earlier Task 1 ambient-config side effect was traced and undone: first successful import necessarily created the previously absent `/home/john/.claude/cadence/config.v4.json` (later fresh imports reject an existing participant). Its unchanged timestamp was checked before moving just that test-created file to `/tmp/cadence-plan2-global-restore-yvbs39dj/config.v4.json`; the original global `config.json` was not edited. This corrects the prior entry's provisional statement that no cleanup had been performed. All child tests now explicitly disable the ambient global config layer.

Final precommit clippy, fmt and TypeScript exits: 0 each. Frozen reference and every protected planning path checked separately with `git diff --exit-code`: 0 each. Whitespace check exit 0. Only `mcp.rs` staged; lease check exit 0, `ok:true`, staged 1. Signature verified `G`, required key and author/committer; no deletions. The report remains unstaged.

Open items: Tasks 3-4 remain. No production-service expansion was needed. Unknown/not-applicable are retained in the shared output vocabulary, but this strict service currently chooses explicit refusal codes for its negative execution cases; the tests do not invent those service outcomes. Tasks 5-6 and UAT.md remain untouched.

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-2.md
Tasks: 3 of 6 (dispatch scope: Tasks 1-4 only)

| Task | Commit | Note |
|---|---|---|
| 3 - Replace reports with the stateless skill and patch-return contract | `d082ff9a` | Five-step direct query/Task/apply loop with the exact three permissions; fixed executor consumes the prompt, verifies and signs task commits, and returns only the advertised JSON patch. Only the three task markdown files changed. |

Task 3 PREDICTION before Verify: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp skill_contract` would report 1 passed, 0 failed, 9 filtered, exit 0. ACTUAL: exactly those counts, exit 0, 0.01 seconds. The check parses all frontmatters, asserts both permission inventories, direct dispatch order and five numbered steps, checks the complete nested patch example against the actual wire schema, and rejects the old script/report/state channels. It checks tokens and permissions, not the quality of generated engineering prose. The test was added in Task 2's leased `mcp.rs`; Task 3 changed no Rust file.

The executor runs the supplied suite before the final task commit on its successful path. A suite failure can therefore truthfully leave a blocked final task, retaining the completed prefix and typed not-run suffix, without inventing a second patch representation. The main loop displays the actual judgment-stop identifiers and any structured reason; that service arm carries blocker IDs rather than invented prose. Fixed policy values are recorded without configuration detection or extra agents. Later executor rungs were not edited.

Final clippy, fmt and TypeScript: exit 0 each. Frozen reference and protected planning diffs: exit 0 each, no output. `git diff --check`: exit 0. Exactly three markdown files staged, lease exit 0, `ok:true`. Commit `d082ff9a` verifies `G`, key `693AB15F91734B0C`, with the required author and committer. No file deletions or unexpected artifacts; report remains unstaged.

Deviations in Task 3: none. Open items: Task 4 remains; actual model compliance and host enforcement remain unproved and reserved for Task 5. No UAT file was created or edited.

Task 4 implemented; commit pending the final workspace gate.

Task 4 PREDICTION before Verify: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp execute_restart` would report 2 passed, 0 failed, 10 filtered, exit 0. ACTUAL: exactly those counts, exit 0, 0.37 seconds. Clippy, fmt and TypeScript also exited 0. Two overlapping native plans contain four tasks; independently authored malformed requests omit a required task, add a foreign state key and name another dispatch. Refusals preserve execution/SUMMARY bytes, dispatch bytes survive refusal and a new PID, two accepted patches advance in overlap order, and four distinct children end at complete. Git object reads prove four distinct signed commits, exact parent chain, order, author/key, task subjects and changed source path. SUMMARY contains exactly those four task SHAs. A second case proves explicit symlink-root normalization, working-directory binding, version's lack of state effects and rejection of tool-supplied repository selection.

Final-suite sequence: the user's instruction to write the report and stop after the Task 4 commit takes precedence over the installed contract's post-commit suite order. The sole initial final workspace run is therefore before the final task commit. This is the executor's regression gate, not Task 6's acceptance-map work. Global+repo `workflow.test_command` lookup exited 0 with null; the Cargo workspace manifest selects `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`. No Node suite or live UAT is invoked.

Final-suite PREDICTION before the initial run: 346 passed, 0 failed, exit 0 (baseline 338 plus eight added tests). [deviation] The run reported a failure in `server::next_action_service_tests::phase_five_acceptance_inventory_names_executable_obligations`: it pins the old version-test registration name, which the three-tool test had renamed. Task 4's permitted `mcp.rs` now restores that registration as a real raw-stdio test of the unique version entry and its output schema, while the separate schema test continues to require exactly three public tools. No assertion or inventory outside the lease was edited, and no fake source token was inserted. The new registration adds one test; full repair confirmation will predict 347 passes. Final run counts and exit codes follow when available.

Final regression ACTUAL:

- Initial workspace run: exit 101; library 104 passed, binary 146 passed / 1 failed, for 250 passed / 1 failed total before Cargo stopped. Integration harnesses did not run in that failed invocation. Log: `/tmp/cadence-plan2-final-workspace.log`.
- Repair targeted checks, predicted to pass before invocation: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence phase_five_acceptance_inventory` reported 1 passed, 0 failed, 146 filtered, exit 0; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp tools_list_declares_exactly_cadence_version_with_an_output_schema` reported 1 passed, 0 failed, 12 filtered, exit 0.
- Full repair PREDICTION, stated before invocation: 347 passed, 0 failed, exit 0. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace` ACTUAL: **347 passed, 0 failed, 0 ignored, 0 filtered; exit 0**, matching exactly. This was the one allowed repair confirmation, not an additional exploratory suite run. Log: `/tmp/cadence-plan2-final-repair.log`. A separate log audit counted all 12 completed harnesses and exited 0.

| Harness | Passed | Failed |
|---|---:|---:|
| Library | 104 | 0 |
| Binary | 147 | 0 |
| derivation_consistency | 6 | 0 |
| derivation_inputs | 12 | 0 |
| evidence_store | 4 | 0 |
| execution_boundary_compat | 9 | 0 |
| execution_store | 18 | 0 |
| mcp | 13 | 0 |
| next_action | 7 | 0 |
| store | 17 | 0 |
| store_crash | 10 | 0 |
| Doctests | 0 | 0 |
| Total | 347 | 0 |

The repaired binary harness took 103.32 seconds, execution_store 262.91 seconds and MCP 31.01 seconds. The original initialize/version/EOF checks, restored Phase 5 registration, new strict schema/contract/restart checks and existing prerequisite compatibility/recovery inventories all passed. No test was skipped, ignored, filtered or weakened in the final workspace run.

Final-source static checks after the repair: `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`, and `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null` all exited 0. The Node suite was not run; it is not claimed green. No Task 6 acceptance map or Task 5 observation was produced.

Before the Task 4 commit, `git diff --exit-code v3.7.12 -- cadence-core/` exited 0 with no output. A separate `git diff --exit-code ac08af5a --` covering every user-named protected planning path and UAT.md also exited 0 with no output. Both working and staged whitespace checks exited 0. An independent audit proved the original report remains an exact byte prefix, the complete changed-path inventory is exactly the six authorized implementation paths plus this existing report, only `mcp.rs` was staged, and the accidental versioned global config remains absent. No new executable script, MCP config or undeclared repository path was added. Task 4 lease check exited 0, `ok:true`, staged 1.

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-2.md
Tasks: 4 of 6; all 4 authorized tasks completed

| Task | Commit | Final result |
|---|---|---|
| 1 - Publish three schemas with Cadence-owned validation | `c0623e63` | Three tools, root-bound raw dispatch, shared schemas and successful typed refusals. |
| 2 - Confirm public execution answers through the resident | `7478e18c` | Independent decision/digest checks, semantic preservation, explicit server failure and bounded terminal replay. |
| 3 - Replace reports with the stateless patch contract | `d082ff9a` | Direct five-step loop, exact permissions and JSON patch inventory; no local orchestration/state path. |
| 4 - Prove raw stdio execution across process replacement | `7fe0b6f6` | Two overlapping plans, four ordered signed task commits, identical outstanding dispatch after refusal/restart, exact final SUMMARY; regression repair included in this task's test-only commit. |

All four task commits verify `G` with key `693AB15F91734B0C`, authored and committed by John Crenshaw <john@jcrenshaw.dev>. Subjects use `feat(6):` and no trailers. No commit deletes a file. After the last commit, the existing report was the sole modified path; it remains unstaged for the sequential report handoff.

Deviations in this dispatch: five verification mismatches, all corrected and recorded above: empty-object schema evaluation, rmcp protocol-error code, ambient-config fixture isolation, failed-writer restart semantics and the historical executable test registration. The ambient versioned-config artifact was restored to its prior absence, retaining the test-created bytes under `/tmp` rather than discarding them. No acceptance criterion, locked decision, protected planning document or source lease was changed. Task 3's test was installed under Task 2's allowed test-file lease, and the final suite ran before the final commit to honor the user's explicit stop instruction.

Open items within authorized Tasks 1-4: none. Deliberately unperformed: Tasks 5 and 6; UAT.md was neither created nor edited. A green deterministic suite does not prove live host permissions, actual executor compliance, model-produced content quality or compaction causality. Hardware power loss and installed-file identity are not claimed; D-28's content/directory guarantee remains unchanged. Fixture-signing portability without the specified locally available GPG key was not established. The full Node suite, later general workflow/commit/review rails and live AC3/AC7 clauses remain outside this dispatch. The complete six-task plan therefore remains PARTIAL.


## Tasks 5–6 continuation from ad6da6ba — live host checkpoint

PLAN CHECKPOINT: structural
Plan: .planning/phases/6/PLAN-2.md
Tasks: 4 of 6 satisfied; Task 5 partial observation record committed, Task 6 not started

| Task | Commit | Result |
|---|---|---|
| 5 - Run the actual host, executor and denial UAT | `c8277afe1a65fb7f79745c18b55c4190ad5995e4` | Partial UAT record only. Actual host/model access, direct Rust startup and guard Write outcomes observed; host rejects tool schemas before any Cadence call. Task is not satisfied. |
| 6 - Close the phase boundary without overstating the slice | none | Not started because Task 5 reached the user-directed stop condition. No new machine acceptance map or suite result is claimed. |

Current task: 5 - Run the actual host, executor and denial UAT
Need: Widen the continuation lease to `crates/cadence/src/server.rs` to repair the advertised root schema shape, with a regression check in `crates/cadence/tests/mcp.rs`, then resume the live UAT before Task 6. The query input schema and all three output schemas need the host-required root object type while retaining their generated discriminators and fields. A host-side shim or modified fixture copy would avoid testing the shipped boundary and was not substituted.

The cached contract at
`/claude/.claude/plugins/cache/cadence/cadence/3.7.12/skills/cad-executor-contract/SKILL.md`
was read in full, including its lean-build reference. The repository's rewritten
contract was read as an artifact under test only. The cached contract says:
“Stop instead of proceeding when the task's `Verify:` cannot be met as written,
when a locked CONTEXT decision is contradicted by what you found, or when
meeting the criterion needs something outside this plan's `files:` lease.”
The user's narrower remaining lease and explicit “record exactly what was and
was not observed and STOP” instruction determine this checkpoint. No additional
permission flow was inferred. The existing report is appended, not rotated or
rewritten, per the dispatch override.

Starting state was independently checked: branch `cadence/binary-owns-process`,
HEAD `ad6da6baacdd73416b97c9c279a63a65489f2d8d`, clean tree. The Task 1–4 handoff
was read. Their green deterministic suite is prior evidence, not a new run.
D-29 was read and accepted: preserve the frozen tree, run/report Node honestly
when Task 6 is reached, and expect exactly the known 16 failures. No deferred
worktree or lean-build Read sentence was restored to the new contract.

### Task 5 prediction and actual live observations

PREDICTION before the initial live probe: actual host direct MCP without
ToolSearch, successful typed malformed-patch refusal, three protected denials,
one authorized source write. ACTUAL: host `2.1.263 (Claude Code)`, selected
model `claude-opus-5`, process exit 0, eight turns, seven tool calls (three Read,
four Write), four actual hook responses, **zero MCP calls and zero Task calls**.
The three protected Write attempts were denied and the source Write succeeded.
The predicted malformed-patch refusal was not observed.

[deviation] Task 5 requires a real host to call the three-tool boundary, dispatch
and apply executor patches. The host establishes stdio transport but rejects
`tools/list` because exactly four advertised schemas lack root `type: object`:
`cadence_version.outputSchema`, `cadence_query.inputSchema`,
`cadence_query.outputSchema`, and `cadence_apply.outputSchema`. Host validation
reports `invalid_value`, expected `object`, at those four paths and exposes no
Cadence tools to the model. This contradicts host usability, despite prior raw
JSON-RPC test passes. The responsible producer is the leased-out
`server.rs::PublicServer::list_tools` / `tool` path. No production file was
changed; the observation was committed with blocked/unverified labels.

The initial probe supplied `--tools Read,Write,Edit`; a provisional explanation
attributed the missing tools to that restriction. A separate real-model probe
without it established the schema rejection. The restriction's separate effect
was not proved. The corrective probe's prediction was restated after launch,
before inspecting the result; it is not counted as prediction-first Verify.
ACTUAL retry: host exit 0, one turn, zero tool calls, identical schema failures.
Normal host completion is not a UAT pass.

The planned `/cad-execute 6` invocation was not reached. No first plan dispatch
was produced, so there was no between-plan termination or execution-session
resume. The continuation authority helper was compiled in parallel with the
boundary probe but never run; the UAT records its exact intended stub values
and marks them unapplied. No missing authority was inferred to be a passed gate.

Observed host/server PIDs:

| Probe | Host | Rust server | Evidence limit |
|---|---:|---:|---|
| Guard/preflight | 2592420 | 2592479 | Real direct startup and hook observations; not a dispatched plan |
| Unrestricted boundary | 2592982 | 2593019 | Real direct startup and schema rejection; not plan replacement |
| Raw schema inspection | none | 2594652 | Independent schema diagnostic only |

Both hosts closed their own MCP children during normal shutdown. None was
intentionally killed after a plan or patch, and these two different PIDs must
not be counted as the required replacement evidence. The harness inspected
only descendants of its own fixture host. No unrelated process was monitored,
killed or waited upon.

Actual Write denials, from host `hook_response` events (each hook exit 0):

- `.planning/state.json`: hook `99224db1-d3ba-4fb0-85e8-013c50e0dada`,
  `permissionDecision: deny`, host tool result error.
- `.planning/decisions.jsonl`: hook `07a4bcd6-adf2-4293-baf5-cf66406c6750`,
  `permissionDecision: deny`, host tool result error.
- `.planning/phases/6/SUMMARY.md`: hook `ee1ba904-547d-4018-859d-aa7de3368f5d`,
  `permissionDecision: deny`, host tool result error.
- `src/probe.txt`: hook `b564e8de-43d6-4462-863e-750dfd50c0f7`, empty stdout and
  stderr, exit 0; host Write succeeds and independent file inspection confirms
  the file exists. This is guard passthrough, not an explicit JSON allow reply.

All mutation attempts used Write. Edit was permitted but not called, so live
Edit behavior remains unverified. The UAT includes tool-use IDs, hook IDs,
actual denial reason shape, file hashes and the exact MCP/settings JSON. No
assertion evaluates the probe file's content.

### Independent inspection, commands and counts

The external fixture is `/tmp/cadence-uat-20260907-aanq22_e/fixture`; all host
configuration and evidence are in that temporary UAT root. Two native plans
share `src/lib.rs`, with task IDs T1/T2 and the exact supplied verification and
suite commands recorded in UAT.md. Three project-local skill/agent copies were
compared byte-for-byte and by SHA-256, without changing any copy. Both host init
records show `plugins: []`, only the explicitly configured Cadence MCP server,
and zero ToolSearch calls. Native built-in host skills remain visible.

Independent Git/object/file inspection found:

- Fixture baseline and final HEAD are
  `45d9414bd86b0a1375ec02963962b638116db1c5`, signature `G`, key
  `693AB15F91734B0C`, author John Crenshaw <john@jcrenshaw.dev>.
- Exactly **0 new task commits**; Git status clean; `src/lib.rs` unchanged.
- Native state, decisions and phase SUMMARY are absent. There are **no observed
  decision IDs, dispatch IDs, accepted patch IDs or task SHAs**.
- All three protected paths are absent both before and after the Write probes.
  The authorized source file exists at 12 bytes; its hash is recorded in UAT.md,
  not its content.
- No real compaction event appears in either stream. There is no before/after
  or new never-loaded control observation; causal conclusion INCONCLUSIVE.

PREDICTION before the independent raw stdio diagnostic: three tool names,
exactly four missing root types, server exit 0. ACTUAL: exactly those counts and
exit 0. The diagnostic sends only initialize and tools/list and does not seed
state, dispatch a plan or manufacture a malformed-patch refusal. Its raw
response is retained under the temporary evidence directory.

Build/setup commands: `TMPDIR=/tmp RUSTC_WRAPPER= cargo build -p cadence`, exit 0
(the one host binary build); fixture `cargo generate-lockfile --offline` with
the required prefix, exit 0; temporary authority-helper build with the same
prefix and explicit external manifest, exit 0, helper never executed. Binary
SHA-256 remains
`3c781ecfd6d29321eed011b66f3f5b5f3d533daac5f4d223b646a4d0e9eae19e`
before and after the probes. Full command lines, versions and exact stub
frontmatter are in UAT.md. Authentication was available and passed only in
process memory; no credentials or signing secrets are recorded. All fixture
children explicitly set `CADENCE_GLOBAL_CONFIG` empty and ignore unused stdin.

Static command detection through the cached `planning.mjs detect-commands
--root /code/cadence` exited 0, selecting clippy and TypeScript. PREDICTION
before the closing static checks: all exit 0. ACTUAL:

| Command | Exit | Counts |
|---|---:|---|
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings` | 0 | no warnings/errors |
| `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check` | 0 | no formatting changes |
| `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null` | 0 | no diagnostics |

The npm debug log created by that specific typecheck invocation was moved into
the temporary UAT evidence directory; no such log is left outside the allowed
locations. `/home/john/.claude/cadence/config.v4.json` remains absent.

### Commit and preservation gates

Before commit, `git diff --exit-code v3.7.12 -- cadence-core/` exited 0, empty.
A separate `git diff --exit-code ad6da6baacdd73416b97c9c279a63a65489f2d8d --`
covering every protected planning path named by the user exited 0, empty.
`git diff --check` exited 0. The prior report remained byte-identical before
this append. Only `.planning/phases/6/UAT.md` was staged; the cached lease check
exited 0 with `ok:true`, staged 1. No executable script or `.mcp.json` was added
to the repository.

Commit `c8277afe1a65fb7f79745c18b55c4190ad5995e4` has subject
`feat(6): record blocked live host UAT`, signature `G` from
`693AB15F91734B0C`, author and committer John Crenshaw
<john@jcrenshaw.dev>, and no trailers. It contains the partial observation
record only. No deletions; postcommit tree was clean before appending this
existing report. This append remains unstaged for the sequential handoff.

### Unproved obligations and stop

Task 5 remains incomplete: direct pre-load MCP success; actual malformed-patch
refusal and durable decision; `/cad-execute` invocation; a real fixed executor
Task call carrying the exact prompt; executor source change; dispatched verify
and suite tool calls/receipts; signed ordered task commits; lossless patch
submission and acceptance; exact SUMMARY task/full-SHA shape; real-host dispatch
identity after intentional server replacement; and session resume are all
unverified. Live Edit behavior is also unverified. Guard Write results prove
only their recorded subset of AC7. AC3 and the full AC7 criterion are not
rounded up from deterministic tests or host exit status.

Task 6 was not started. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence` and
`TMPDIR=/tmp node --test` were not run in this dispatch; no final full-suite pass
is claimed. The Node suite's exact comparison against the known 16 is therefore
**unverified**, not skipped-as-pass. No expected failure was repaired, removed
or absorbed, and no seventeenth failure is claimed without execution. The
Task 6 AC1–AC8 machine/live acceptance map remains outstanding. The static and
preservation checks above do not substitute for it.

OQ-1 stays no-preamble by D-25; the failed live startup proves no new direct
callability. OQ-2 remains non-decision-bearing under the previously failed
negative control, with compaction causality INCONCLUSIVE. Later phase 7–9 rails
and phase 11 attempt history, checkpoints, general SUMMARY/task/lease behavior
remain unimplemented by this slice. No claim grades model-produced source,
test output or judgment prose.

Deviations: one structural live-host/schema contradiction; the provisional
`--tools` explanation and retry prediction timing are recorded explicitly above.
Open items: the schema repair needs a widened source lease, then the remaining
Task 5 observations and all Task 6 closure work. No source outside the remaining
lease was changed, no suite was fabricated, and no further execution proceeded
past this checkpoint.


## Task 7 continuation from 98e52cf5 - object schema roots

PLAN PARTIAL
Plan: .planning/phases/6/PLAN-2.md
Dispatch scope: Task 7 only; Tasks 5 and 6 are not resumed.

Starting branch `cadence/binary-owns-process`, HEAD
`98e52cf5ee6006d469841e85a814fffe1e9c22d0`, tree clean. The installed 3.7.12
executor contract and lean-build reference were read; the repository contract
is an artifact under test. The dispatch overrides report rotation/rewrite:
this record is appended to the existing report and remains unstaged.

PREDICTION stated before V7: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence
--test mcp` will report 14 passed, 0 failed, 0 ignored, 0 filtered, exit 0.
The new `tool_schemas_all_inputs_and_outputs_have_object_roots` test reads the
real child's tool list and checks both schemas of every returned tool, without
a fixed tool-name or tool-count inventory. Existing assertions are unchanged.

Negative-control PREDICTION: disabling only the root-type insertion and running
the new test will report 0 passed, 1 failed, 13 filtered, exit 101, with
`cadence_version.outputSchema` lacking root `type` (actual None, expected
Some(String("object"))). Restoring the insertion will make the named test pass.
Raw-probe PREDICTION: the rebuilt binary will handshake and advertise exactly
three tools, with all six input/output roots equal to `object`, and exit 0.

Static-command discovery through the installed `config.mjs` and
`planning.mjs detect-commands --root /code/cadence` exited 0: lint override null,
detected clippy and TypeScript. Node invocations ignored unused stdin.
Static-check PREDICTION: clippy, fmt and TypeScript each exit 0.
Evidence files for this dispatch are under `/tmp/cadence-task7-b_w5vrct/`.


Task 7 V7 ACTUAL: 14 passed, 0 failed, 0 ignored, 0 filtered, exit 0
(30.23 seconds). The existing exact-three-tool, query-discriminator and full
executor-patch assertions passed unchanged; only the new named test was added.

Negative control ACTUALLY RUN: the root insertion was replaced temporarily by
`let _ = Arc::make_mut(schema);`, retaining schema generation and removing
only the root-type mutation. The new named test reported 0 passed, 1 failed,
0 ignored, 13 filtered, exit 101. Its assertion reported
`"cadence_version".outputSchema must have root type object`, left `None`, right
`Some(String("object"))`. The complete fixed source bytes were restored; the
same named test then reported 1 passed, 0 failed, 13 filtered, exit 0.
Logs: `v7.log`, `negative-control.log`, `restored-control.log` in the evidence
fixture. The negative failure was expected and proves the test detects the
missing-root regression.

Raw probe ACTUAL: `/code/cadence/target/debug/cadence serve --project-root
/tmp/cadence-task7-b_w5vrct/wire-project` ran directly as PID 2636842. The probe
sent `initialize`, waited for its successful response, sent
`notifications/initialized`, then `tools/list`, and read the actual response.
Both the probe and its own server exited 0; closing stdin ended the server.
No host or executor was launched. All fixture children had
`CADENCE_GLOBAL_CONFIG` empty. Transcript, tool list and root summary are in
`wire-transcript.json`, `wire-tools-list.json` and `wire-summary.json`.

| Wire-observed schema | Root type |
|---|---|
| cadence_version.inputSchema | object |
| cadence_version.outputSchema | object |
| cadence_query.inputSchema | object |
| cadence_query.outputSchema | object |
| cadence_apply.inputSchema | object |
| cadence_apply.outputSchema | object |

Six of six roots are `object`. This clears Task 7's schema prerequisite for a
later Task 5 retry; it does not turn the historical BLOCKED UAT into a pass.

Initial clippy and TypeScript ACTUAL: exit 0 each, no diagnostics. npm cache
and logs were directed into the temporary evidence fixture.
[deviation] Static-check prediction expected fmt exit 0; actual exit 1 asked
only to wrap the new test's nonempty-list assertion. Applied that formatting
change inside `mcp.rs`. Fmt recheck PREDICTION: exit 0. No acceptance criterion,
locked decision or lease changed.


PLAN PARTIAL
Tasks: 5 of 7 satisfied (Tasks 1-4 and 7); Tasks 5 and 6 remain outstanding.

| Task | Commit | Result |
|---|---|---|
| 7 - Make every advertised schema loadable by a real host | `b6bff7a4787a43afcc092d668ecc8a04df376705` | Derived input/output schemas gain only root `type: object` at shared tool construction. V7, the required negative control/restoration and raw six-of-six probe passed. Final regression suite pending. |

Commit subject: `feat(6): declare object roots for every tool schema`.
Signature verified `G` with key `693AB15F91734B0C`; author and committer are
John Crenshaw <john@jcrenshaw.dev>. Exactly `server.rs` and `mcp.rs` are in the
commit; no body/trailers or file deletions. Only this report remains modified
and unstaged for the sequential handoff. One task, one signed atomic commit.

Before commit, `git diff --exit-code v3.7.12 -- cadence-core/` exited 0,
and the separate `git diff --exit-code 98e52cf5 --` covering all user-protected
planning paths exited 0. Working and staged whitespace checks exited 0.
The installed lease check exited 0 with `ok:true`, staged 2. An independent
byte comparison confirmed every pre-existing MCP test/helper unchanged and
this report's original bytes retained as a prefix. No new file, executable
script, `.mcp.json` or untracked repository artifact was added.

Fmt recheck ACTUAL: exit 0, no diagnostics. Final clippy/fmt/TypeScript exits
are 0/0/0. The only intervening change after clippy was the fmt-required line
wrap in the new test; TypeScript inputs never changed.

Final-suite PREDICTION before invocation: 348 passed, 0 failed, 0 ignored,
0 filtered, exit 0 (the supplied 347-test baseline plus the new regression).
The installed `config.mjs get workflow.test_command` exited 0 with null;
`Cargo.toml` therefore selects `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`.
This is the dispatch's single final regression suite, run after its task commit
and report append as required by the installed contract. It is not Task 6's
acceptance-map work. No Node suite or Task 5 live UAT is invoked.


Final-suite ACTUAL: **348 passed, 0 failed, 0 ignored, 0 filtered; exit 0**.
All 12 harnesses completed in the single final workspace invocation; no repair
or second full-suite run was needed. Counts match the prediction exactly.

| Harness | Passed | Failed |
|---|---:|---:|
| Library | 104 | 0 |
| Binary | 147 | 0 |
| derivation_consistency | 6 | 0 |
| derivation_inputs | 12 | 0 |
| evidence_store | 4 | 0 |
| execution_boundary_compat | 9 | 0 |
| execution_store | 18 | 0 |
| mcp | 14 | 0 |
| next_action | 7 | 0 |
| store | 17 | 0 |
| store_crash | 10 | 0 |
| Doctests | 0 | 0 |
| Total | 348 | 0 |

The binary harness took 97.96 seconds, execution_store 251.22 seconds and MCP
30.01 seconds. `workspace.log` contains the complete output. The final MCP
run again passed both the new root assertion and every unchanged pre-existing
assertion. Wire inspection also retained one query `oneOf` variant and four
`oneOf` variants in each output envelope; the root insertion preserved these
unions and their derived constraints.

Final command exits: V7 0; negative control 101 (expected); restored named
test 0; raw probe 0 and server 0; workspace 0; clippy 0; fmt 0 after the recorded
initial formatting exit 1; TypeScript 0. No Node-suite result is claimed.

Task 7 COMPLETE. PLAN PARTIAL: 5 of 7 tasks satisfied (Tasks 1-4 and 7).
Commit: `b6bff7a4787a43afcc092d668ecc8a04df376705`.
Deviations in this dispatch: one prediction mismatch, the corrected fmt line
wrap; no acceptance criterion, locked decision or lease deviation.
Open items within Task 7: none. The six-of-six raw schema prerequisite is
proved, but actual host loading and the remaining live executor/UAT obligations
were not rerun or proved here. Task 5's historical BLOCKED UAT stays unchanged;
Task 6 was not attempted. Full PLAN-2 completion is not claimed.

The source commit remains the sole commit in this dispatch. This report append
is left unstaged for the sequential handoff; its entire prior content is
preserved. All scratch evidence is within the one temporary fixture under
`/tmp`; no unrelated process was monitored or killed.


Closing-audit correction: after the suite, HEAD was observed at
`23b278c3c7a0a6671a9a1aefe9c289c04ffe9915` (`docs: tick phase 5 complete in the
roadmap`), a later commit not created by this dispatch. Its only change marks
Phase 5 complete in `.planning/ROADMAP.md`. The Task 7 commit remains
`b6bff7a4787a43afcc092d668ecc8a04df376705`, with exactly the two leased source
paths and no planning changes.

[deviation] The closing audit expected the starting protected planning bytes
and one commit since the supplied HEAD; it observed this later ROADMAP commit
and two commits in the branch range. The current-HEAD protected-path diff
therefore exited 1. The source lease remains unchanged, and no later change
was reverted or edited. The precommit preservation checks had passed, and an
explicit recheck of `98e52cf5..b6bff7a4` against every protected planning path
exited 0. The frozen-tree comparison of `v3.7.12..b6bff7a4` also exited 0.
Current leased source bytes still equal the Task 7 commit (diff exit 0), so the
suite's tested implementation is unchanged. Whitespace check exited 0; only
the existing report is modified and unstaged.

Final clarification: this dispatch created exactly one signed source commit;
the branch additionally contains the later ROADMAP-only commit. Task 7 and all
its validation remain complete. Current branch-wide preservation against the
supplied HEAD cannot be claimed for ROADMAP because of that subsequent change.
The dispatch records two verification prediction mismatches in total: the
corrected fmt wrap and this later protected-path drift. Neither required a
change to Task 7's acceptance criteria or implementation. No Task 5 or Task 6
work was performed by this dispatch.


## Tasks 5-6 continuation from 636d2447 - live UAT retry

PLAN PARTIAL. This dispatch follows the installed 3.7.12 executor contract,
with the user's explicit append-only report and reporting-format overrides.
Starting HEAD: `636d2447bec532108acfb2afde53ca89aa4089a2`; branch
`cadence/binary-owns-process`; initial tree clean. No CLAUDE.md is expected.
The earlier UAT will remain intact as a labelled prior attempt.
Evidence root: `/tmp/cadence-uat-20260907-5yt3jjm7`.

Task 5 PREDICTION before Verify: three host tools available without ToolSearch;
`cadence_apply({})` returns a successful typed refusal; two real executor
dispatches change source, call their prescribed verification and suite commands,
return lossless patches and produce two ordered signed task commits. Six
protected attempts (Write and Edit for each of three paths) are denied and one
source Write succeeds. The first fixture server is intentionally terminated
between dispatches and the resumed session uses a distinct server PID.
No prediction grades model-produced source, test prose or judgment text.
Compaction causality remains inconclusive.

Prerequisite ACTUAL: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`
returned 14 passed, 0 failed, 0 ignored, 0 filtered, exit 0 (30.04 seconds).
This is the targeted prerequisite, not the dispatch's final full suite.
Its individual count was not separately predicted before invocation.
`TMPDIR=/tmp RUSTC_WRAPPER= cargo build -p cadence` exited 0. The temporary
authority helper build also exited 0; it is a setup stub, never a server proxy.
Installed config lookup returned null lint override; command detection returned
clippy and TypeScript, both subprocess exits 0 with unused stdin ignored.
D-29: no Node test suite will be run or used as a gate.


### Task 5 ACTUAL and blocked checkpoint

PLAN CHECKPOINT: blocked. Tasks 5 and 6: 0 of 2 satisfied. The earlier plan
tasks remain as previously reported; no completion status is changed.

Both real hosts ran Claude Code 2.1.263, model alias opus resolved to
claude-opus-5, isolated MCP/settings, no plugin and no ToolSearch calls. The
boundary host (PID 2757430, server 2757470) exited 0 after 2 turns and 1 tool
call. The actual malformed apply input was `{"dispatch_id":"null"}`, not `{}`.
It received successful `refused:invalid-patch`. Independent JSON hashing
confirmed the request and response digests against the unique durable decision
`9418fc503a3dff8646f6eb53e684e200e0df92d8c78fc7c4954b4236c2139a37`.
The temporary authority helper then actually wrote its two declared fixture
records; those are setup stubs, not live execution or operator-answer proof.

The actual `claude -p "/cad-execute 6"` host (PID 2758322, server 2758359)
exited 0 after 2 turns and one diagnostic cadence_version call. There were
zero query/apply calls in this execution invocation and zero Task/Agent calls,
source mutations, task verification/suite calls, task commits or accepted
patches. Both hosts exposed only cadence_apply and cadence_version. Both logs
state: `Skipping tool "cadence_query": its input schema uses top-level oneOf,
which the Anthropic API does not accept. Other tools from this server remain
available.` This is a second host restriction, after the fixed root-type one.

[deviation] Expected all three tools callable and the loop to dispatch; actual
query input is filtered for root oneOf. The required producer change is outside
the lease, so work stopped without a workaround or changed acceptance rule.
[deviation] Expected the probe's exact empty object; actual model arguments were
`{"dispatch_id":"null"}`. The first progress claim of exact `{}` success was
corrected after independent stream inspection. A successful malformed refusal
is proved; the empty-object live input is not.

Closing Verify PREDICTION: three raw tool names, six object schema roots, root
query oneOf retained; zero task commits, dispatch decisions and SUMMARY; static
and preservation command exits all 0. ACTUAL: all matched. The raw probe ran
directly as server PID 2761289, exit 0. Its root-oneOf variant counts are
version input/output 0/4, query 1/4, apply 0/4. This verifies Task 7's root fix
in passing; no old negative control was re-derived or repeated.

Independent fixture Git inspection: clean, HEAD unchanged at signed baseline
`9ed495ed128d88dd8838979396fd8a46d029d6d5`, zero source diff and task commits.
Native state has no execution namespace. Exactly three decisions exist: the
malformed refusal plus native-evidence:fixture-authority-0 and -1. SUMMARY is
absent. There are no dispatch IDs, accepted patch IDs or executor task SHAs.

Neither PID pair is replacement between plan dispatches. No intentional server
termination or host resume occurred; every owned PID was absent on closing
inspection. The separate guard probe was not launched after the blocker, as
the user explicitly required STOP. This retry has zero Write/Edit attempts,
zero denials/allowances and zero compaction events. Earlier three Write denials
and one source allowance are preserved only as prior observations; live Edit
denial remains unverified in both attempts. Causal compaction conclusion is
INCONCLUSIVE. No model-produced source, test output or judgment prose is graded.

Static ACTUAL: clippy exit 0, fmt exit 0, TypeScript exit 0. Frozen cadence-core
comparison and the full user-protected planning-path comparison both exit 0.
All children explicitly had CADENCE_GLOBAL_CONFIG empty; all Node invocations
ignored unused stdin. npm cache/logs and host artifacts stayed inside the
temporary fixture root. Global config.v4.json remains absent.

Task 6 was NOT STARTED; no final Cargo suite or Node suite was run. D-29 uses
the frozen-tree diff, never the incompatible Node grammar as a gate. AC3/full
AC7 and the acceptance map remain unverified/outstanding. Phase 11 attempt
history, checkpoints, general SUMMARY/task/lease behavior and phase 7-9 rails
remain unimplemented. OQ-1 has a direct pre-load malformed-apply observation;
OQ-2 remains non-decision-bearing under its failed negative control.

Need: a host-loadable query input schema that preserves typed discriminator
constraints, regression coverage of this host restriction, then a new Task 5
run and Task 6. That producer is outside the Task 5/6 leases. No permission
question or unauthorized repair is attempted in this checkpoint.

Commit-gate PREDICTION before Verify: only UAT.md staged; lease-check ok:true,
all protected diffs and whitespace checks exit 0; signed Task 5 observation
commit has author/committer John Crenshaw, key 693AB15F91734B0C, no trailers,
no deletions. The existing report remains unstaged and preserves its entire
prior content as a prefix.


PLAN CHECKPOINT: blocked
Plan: `.planning/phases/6/PLAN-2.md`
Tasks: 0 of 2 requested tasks satisfied; Task 5 partial observation committed,
Task 6 not started.

| Task | Commit | Result |
|---|---|---|
| 5 - Run actual host, executor and denial UAT | `89723fb99f1a045dc0dfe8d29eeaa10277529c91` | Partial, BLOCKED: real host filters query input union; records actual malformed refusal and preserves prior attempt verbatim. |
| 6 - Acceptance map | none | Not started under the explicit Task 5 stop condition. |

Commit gate ACTUAL: lease-check exit 0, ok:true, 1 staged UAT path; protected
planning and frozen-tree comparisons exit 0 immediately before commit; staged
whitespace exit 0. Commit subject `feat(6): record live query schema rejection`.
Author and committer John Crenshaw <john@jcrenshaw.dev>; signature status G, key
693AB15F91734B0C; verify-commit exit 0. Exactly UAT.md is in this commit, no
body/trailers and no deletions. The existing report remains unstaged.

[deviation] Closing audit predicted only this dispatch's two paths would differ
from the supplied HEAD. It observed two concurrent commits,
`1ffe5f17979b877f9e7d9989da7b5f5055023bdc` and
`d61f33deae8077cdd8f165b76ac0cbb41b3af5ba`, modifying only
`.github/workflows/test.yml`. Those commits were not created or changed by this
dispatch. An audit assertion over the whole branch range exited 1 as a result;
this is recorded rather than attributed to the UAT commit or reverted. The
UAT commit's parent is d61f33de. Its own path list remains exactly UAT.md.
Repeated protected-path and frozen-tree comparisons after this observation
both exited 0. The CI-only changes did not alter the tested Rust/skill bytes.

Closing audit recheck PREDICTION: own commit contains only UAT.md; original
report bytes remain its prefix and original UAT bytes remain the new UAT's
suffix; no untracked artifacts, no global config.v4.json, and only the report
is modified in the worktree. No new .mcp.json or executable script is added.

Deviations: 3 - host query filtering, actual malformed input differing from
the requested empty object, concurrent CI commits invalidating a range audit.
Open items: Task 5 live dispatch/executor/verify/suite/commit/patch/SUMMARY proof,
intentional between-dispatch replacement and resume, protected Edit and retry
Write/source-allow observations, exact empty-object live input, and Task 6
acceptance map/final suite. Compaction was not observed and causality remains
INCONCLUSIVE. The later phase 7-9 and phase 11 obligations remain unimplemented.
No final full suite is invoked after this blocked checkpoint.

Closing audit recheck ACTUAL: every stated check passed, exit 0. The full
prior report is retained, the full prior blocked UAT is preserved verbatim,
only the report is modified/unstaged, and no untracked repository artifact
exists. No push was performed. Final status remains CHECKPOINT: blocked.


## Task 8 continuation from 2756546e - host-listed input schemas

PLAN PARTIAL. Scope: Task 8 only; Tasks 5 and 6 are not executed.
Starting HEAD: `2756546e63af23bbbbac3ddf9746a2a0bb0220eb`; branch
`cadence/binary-owns-process`; initial worktree clean. Installed 3.7.12 executor
contract applies with the explicit append-only report, final digest and D-29
overrides. This existing report is appended, not rotated or committed.
Evidence fixture: `/tmp/cadence-task8-3n0oqvpj`.

PREDICTION before V8: the MCP integration command returns 15 passed, 0 failed,
0 ignored, 0 filtered, exit 0. Every pre-existing schema, discriminator and
refusal assertion remains unchanged; Task 7's general object-root test remains.
The new general test rejects top-level oneOf/anyOf/allOf and requires properties
for every returned input schema. Temporarily restoring the query union root
will produce 0 passed, 1 failed, 14 filtered, exit 101, with
`"cadence_query".inputSchema must not use top-level oneOf`; restoring the fix
will make the named test pass (1 passed, 14 filtered, exit 0).
The wire probe will list exactly three tools with root type object and
properties, no top-level union, and query's required operation and phase.
Claude Code 2.1.263, run noninteractively with explicit MCP and strict MCP
configuration, will expose exactly three Cadence tools in its own init output,
including cadence_query, without a skip message. A third host restriction
will stop the task with the host's message.

Implementation: promote the sole derived QueryArguments variant to the
advertised root, retaining generated operation const, phase bounds, required
fields and additionalProperties:false. Empty version input gains properties:{}
at shared tool construction. Runtime deserialization, raw dispatch and executor
patch schema are untouched. Additional query variants require a deliberate
advertisement update; no generic union-flattening facility is added.

Static-analysis discovery ACTUAL: installed config get workflow.lint_command
returns null, exit 0; installed planning detect-commands returns
`cargo clippy --all-targets -- -D warnings` and `npx tsc -p tsconfig.ci.json`,
exit 0. Node children ignore unused stdin. Current Context7 Schemars and host
CLI documentation consulted; installed host version/help both exit 0.

### V8 ACTUAL

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`: 15 passed,
  0 failed, 0 ignored, 0 filtered, exit 0 (30.14 seconds). The existing MCP
  file minus the newly added test is byte-identical to starting HEAD, including
  every schema/discriminator/refusal assertion and Task 7's object-root test.
- Negative control actually run: temporarily wrapped the promoted query object
  in a root oneOf. The named new test returned 0 passed, 1 failed, 14 filtered,
  exit 101, reporting `"cadence_query".inputSchema must not use top-level oneOf`.
  The failure printed the union and its generated operation const, phase,
  required fields and additionalProperties:false. A finally block restored the
  fixed source byte-for-byte. Full output: `negative-control.txt` in the fixture.
- Restored named test: 1 passed, 0 failed, 14 filtered, exit 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo build -p cadence`: exit 0.
- Raw direct binary probe sent initialize, notifications/initialized and
  tools/list to `cadence serve --project-root /tmp/cadence-task8-3n0oqvpj/fixture`.
  Exactly 3 tools; server exit 0 after closing stdin. All six schema roots are
  object; all three inputs have properties and none has a root union. Query
  required is `["operation","phase"]`, operation const is `execute-next`, and
  additionalProperties is false. Wire top-level input keys (sorted):

```text
cadence_version: ["$schema", "additionalProperties", "properties", "title", "type"]
cadence_query: ["$schema", "additionalProperties", "properties", "required", "title", "type"]
cadence_apply: ["$defs", "$schema", "additionalProperties", "properties", "required", "title", "type"]
WIRE_EXIT=0
```

Real host ACTUAL: `2.1.263 (Claude Code)`, model alias opus resolved to
`claude-opus-5`; exit 0, successful result, 2 turns, exactly 1 tool call. The
command is preserved in fixture `host-command.json`; it uses `-p`,
`--mcp-config /tmp/cadence-task8-3n0oqvpj/mcp-config.json`,
`--strict-mcp-config`, isolated `--settings`, empty `--setting-sources`,
`--no-session-persistence`, `--disable-slash-commands`, empty built-in `--tools`,
`--permission-mode dontAsk`, `--output-format stream-json`, `--verbose`,
`--debug-file`, and no ToolSearch. MCP config launches the built Rust binary
directly, with no wrapper. Host's own system init output, projected to the
relevant fields without changing their values:

```json
{
  "type": "system",
  "subtype": "init",
  "tools": [
    "mcp__cadence__cadence_apply",
    "mcp__cadence__cadence_query",
    "mcp__cadence__cadence_version"
  ],
  "mcp_servers": [
    {
      "name": "cadence",
      "status": "connected"
    }
  ],
  "model": "claude-opus-5"
}
```

Host tool_use: `mcp__cadence__cadence_query` with exactly
`{"operation":"execute-next","phase":6}`. The successful tool response is
`refused:missing-roadmap`, expected for this deliberately empty planning
fixture; no executor was requested or dispatched. The host debug output
contains no `Skipping tool "cadence_` entry. No third restriction was observed.
This proves Task 8's actual host exposure, not Tasks 5/6's executor/UAT loop.
Evidence: fixture `host-output.jsonl`, `host-debug.log`, `host-stderr.txt`,
`host-exit.txt`, `wire-transcript.json`, `wire-tools.json`, `wire-summary.txt`.
Credentials were used only in child environment, never copied into evidence.
All fixture child environments set CADENCE_GLOBAL_CONFIG empty; all Node
children ignore unused stdin; host config, npm cache and evidence stay in this
/tmp fixture. Only the wire server owned by this probe was awaited.

Static checks ACTUAL: clippy `--all-targets -- -D warnings` exit 0;
`cargo fmt --check` exit 0; `TMPDIR=/tmp npx tsc -p tsconfig.ci.json` exit 0.
Every cargo invocation used `TMPDIR=/tmp RUSTC_WRAPPER=`.
Preservation gates ACTUAL: `git diff --exit-code v3.7.12 -- cadence-core/`
exit 0; `git diff --exit-code 2756546e --` all protected planning paths
listed in the dispatch exit 0; `git diff --check` exit 0. The only changed
paths are the two leased Rust files and this report append. No .mcp.json or
new JS executable was added; .github/ is untouched.

Deviations from V8 prediction: none. Open items in Task 8: none. The single
query variant is promoted without a general multiple-operation schema adapter;
the strict slice has one operation and V8 needs no broader mechanism.

PREDICTION before the final post-commit regression suite: workspace Cargo tests
return 349 passed, 0 failed, exit 0 (the supplied baseline 348 plus this one
new general assertion test). The frozen Node suite is not a gate per D-29 and
the explicit dispatch instruction. Full suite remains pending at this point.

### Task 8 commit and final regression

PLAN PARTIAL (final suite pending). Task 8 V8 satisfied; only Task 8 was
executed in this dispatch.

| Task | Commit | Note |
|---|---|---|
| 8 - Advertise an input schema the host will actually list | `313a8492dae2838d7e80851b94949031bca54090` | Derived query object promotion, explicit input properties and general regression assertion; V8 wire, negative control and real host proof passed. |

Installed lease-check: ok:true, staged:2, declared:14, exit 0. Both staged
paths match the narrower dispatch lease. Required preservation diffs and
staged whitespace check were repeated immediately before commit, all exit 0.
The atomic commit contains only server.rs and mcp.rs; this append remains
uncommitted for the orchestrator, per the installed sequential report contract.

Final suite ACTUAL: installed config get workflow.test_command returned null,
exit 0, so the repository's Cargo workspace manifest selected
`TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`. This was the one
post-commit full-suite run. Result: 349 passed, 0 failed, 0 ignored, 0 filtered,
exit 0, matching the prediction. Counts by target: lib 104; binary 147;
derivation_consistency 6; derivation_inputs 12; evidence_store 4;
execution_boundary_compat 9; execution_store 18; mcp 15; next_action 7;
store 17; store_crash 10; doc tests 0. Full output: fixture
`workspace-test.txt`; exit/count summary: `final-exits.json`. No Node test
suite ran and no repair or second full-suite run was needed.

Commit verified: `313a8492dae2838d7e80851b94949031bca54090`,
`feat(6): advertise query inputs with object properties`; author AND committer
John Crenshaw <john@jcrenshaw.dev>. `git verify-commit` exit 0, good signature;
`%G? %GK` is `G 693AB15F91734B0C`. Post-commit deletion check empty, exit 0;
no generated/untracked repository files. The prior report content remains an
exact byte prefix, and only this report is dirty after the commit.

PLAN PARTIAL: 6 of 8 tasks satisfied (1-4, 7, 8). This Task 8-only dispatch
completed 1 of 1 authorized task and its final regression suite is green.
Task 8 deviations: 0. Task 8 open items: 0. All V8 obligations are proved,
including actual host exposure and direct query use. Tasks 5 and 6 remain
unperformed here; live executor dispatch, executor commits/patches, guard UAT,
process replacement and compaction claims are not newly proved. UAT.md and
all other protected planning artifacts remain untouched.

Final exits: MCP 0; negative control 101 (required failure); restored test 0;
build 0; wire 0; host 0; clippy 0; fmt 0; tsc 0; workspace tests 0; lease 0;
signature verification 0; preservation diffs 0. Report append is intentionally
uncommitted under the installed sequential executor contract.
