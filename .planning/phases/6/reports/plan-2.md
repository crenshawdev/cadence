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
