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
