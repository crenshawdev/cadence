---
phase: 8
plan: 3
requirements:
  - AC2
  - AC4
  - AC6
  - AC7
  - AC10
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/config/mod.rs
  - crates/cadence/src/config/reload.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/config/interview.rs
  - crates/cadence/src/config_service.rs
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/config/write.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/tests/phase8_interview.rs
  - skills/cad-config/SKILL.md
  - docs/architecture/config-routing.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests"
  tasks:
    - id: P8-3-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
    - id: P8-3-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P8-3-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview"
---

# Phase 8: One ordinary roles interview - Plan 3

## Goal

Users answer one layer-aware roles and floor interview backed by the native config service. This plan proves first-run persistence, later diffs, explicit empty protection and the shipped config skill's deterministic native contracts. Live conversation observation remains in MANUAL.md.

## Must be true when done

- AC4/D-51: The ordinary interview obtains six model choices, six effort choices and one floor choice while showing current values and source layers.
- AC4/D-50: First run persists all twelve role leaves globally, including accepted defaults, in the same transaction as the floor answer; later normal runs save only repo diffs.
- AC6/D-47: Keep it for every surface writes a literal empty waiver array to the selected layer, including when a prior waiver exists.
- AC7/D-48: Original stakes disclosure leads directly into the ordinary interview using current settings and creates no migration state.
- AC4/D-50: Intake and accepted-suggestion callers share the service; declining or not answering never writes settings.
- AC4/D-46: The shipped config skill uses grouped native tools for facts and writes, retains its entry modes, and neither edits JSON nor runs the frozen workflow.

## Context

D-47, D-48, D-50, D-51 and D-52 bind this plan. Plans 1-2 provide facts, atomic writes, initialization and retirement evidence. Reuse phase 7's detect-surfaces operation for structural evidence; actual-diff selection is separate from a plan-floor waiver. Wider intake, suggestions and live provider setup remain later workflows.

## Tasks

### Task 1: Define the shared interview answers (P8-3-T1)

- **Files:** `crates/cadence/src/lib.rs` (shared native config service exports), `crates/cadence/src/config/mod.rs` (schema / Effective), `crates/cadence/src/config/reload.rs` (live alias identity), `crates/cadence/src/store/writer.rs` (owned interview preconditions), `crates/cadence/src/config/interview.rs` (new interview service logic), `crates/cadence/src/config_service.rs` (public facts and batch operation from Plan 1), `crates/cadence/src/import/mod.rs` (Session::config / manifest active paths), `crates/cadence/src/config/write.rs` (batch input preconditions from Plan 1), `crates/cadence/src/server.rs` (inherited config request and answer schemas), `crates/cadence/src/recall/mod.rs` (resident config request routing), `crates/cadence/tests/phase8_interview.rs` (new integration target)
- **Action:** Have the binary prepare the thirteen ordinary role/floor subjects from current facts, including all six role purposes, model/rung cost explanations, schema defaults, stored presence, source layers, target layer and validation constraints. Carry interview mode, literal answers and captured-input preconditions through the existing grouped config schema, resident request and batch writer; validation must reach the writer's owned transaction rather than stop at a service-side precheck. Keep raw global roles-key presence distinct from injected defaults. D-51's first-run classification is raw roles absence at the global address; when that address aliases repo, inspect the same physical raw repo input while retaining repo provenance. Report coverage of the twelve stored role leaves separately: roles:{} or a one-leaf object is not evidence that all answers were collected. Every ordinary invocation still obtains all thirteen answers; do not silently skip missing subjects or invent a completion marker. In the later-run classification, unchanged answers remain no-ops even if their value came from a default.

  First-run acceptance sends all twelve explicit role values and the explicit floor choice globally in one batch, including model null and accepted default rungs. Later ordinary acceptance uses the captured effective values to form repo role diffs only; explicit global editing reopens all thirteen against the global layer. Calculate diffs in the binary, bind the answer set to the observed inputs, and refuse an intervening config change rather than apply stale conversational intent. Do not let host question batching change the count or meaning of the answers. Preserve literal model text, including spaces, quotes, equals signs and Unicode, through service storage; compatibility belongs to the resolver.

  Implement EMPTY as a deliberate exception to diff-only writing: the protection answer stores [] in the selected layer even when effective protection already looks identical but no stored pin exists. An identical already-stored [] may be a no-op. Never use absence or null as the answer. Keep actual-diff selected surfaces unchanged. A global [] does not override a stronger repo waiver: report the actual effective waiver and its repo source instead of saying every surface is protected or silently clearing repo. Provide shared service entry fixtures for both intake callers and accepted suggestions; no write occurs before an explicit accepted answer, and an accepted suggestion uses the same validated batch implementation. The service is reusable without implementing those later workflows.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config` — interview::prepare returns thirteen ordered subjects with literal values, defaults, presence, source, constraints and first/later/global target from independently supplied generations, including absent, empty, partial and aliased roles. interview::answers returns the thirteen literal first-global updates, later role diffs, explicit [] pin or identical-pin no-op, and unchanged custom model text. Separate assertions return Error::Conflict("interview config inputs changed"), Error::Invalid("interview requires exactly thirteen ordered answers"), or no updates for declined/unanswered acceptance. ConfigWriter validates captured inputs inside owned admission and final transaction policy; supplied filesystem observations establish stale-input refusal and one accepted batch. No save/reopen chain; reopened input is independently encoded.

### Task 2: Connect the shipped config conversation (P8-3-T2)

- **Files:** `crates/cadence/src/config/interview.rs` (literal entry parsing), `crates/cadence/src/config_service.rs` (prepared entry operation), `crates/cadence/src/server.rs` (grouped entry schema and routing), `skills/cad-config/SKILL.md` (objective / execution_context / process), `crates/cadence/tests/phase8_interview.rs` (skill and answer-relay fixtures), `docs/architecture/config-routing.md` (new configuration/routing contract)
- **Action:** Replace the config skill's frozen-workflow execution path with thin grouped-tool orchestration using the operations delivered by Plans 1-2 and phase 7. Allow the grouped query/apply tools and the host question mechanism needed to relay answers; remove direct JSON write/edit, shell configuration and terminal interviews over MCP stdio. The binary owns first-touch initialization, facts, selection of target layer, validation and batch persistence. The skill displays original stakes values and layer/path with the plain retirement message, then conducts the ordinary interview without translating the old level or tracking accepted/dismissed retirement state.

  Retain --roles and --roles --global, the no-argument supported-knob walk, explicit key/value tokens including the accepted-suggestion entry, and --surfaces. Relay tokens/literal answer values without shell evaluation, trimming or reconstructing custom model strings. Submit only after the applicable explicit answer and make one atomic batch call; show changed keys, destination and effective source information from the binary response. For --surfaces, consume phase 7's current structural evidence and prepared options, then write only the actual-diff surface selection on explicit acceptance; declining preserves the prior bytes. Do not conflate that selection with the roles interview's floor waiver.

  Keep --review [redetect] recognizable and state plainly that native live-provider setup belongs to the later review-delivery phase; report its current unavailable/not-applicable behavior without invoking frozen code, discovering models or claiming provider readiness. An invalid active config displays the binary's named key/layer/path and repair-required diagnostic; the skill cannot repair JSON and must not retry a setter against invalid controlling config. Preserve phase 7's schema/envelope spelling as actually shipped. Document model/rung reset behavior, first/later/global modes, EMPTY shadowing, static retirement facts, the existing invalid-config repair limitation, and the distinction between requested and observed effort.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — interview::entry returns literal Knobs, Roles { mode: Roles }, Roles { mode: Global }, Surfaces, ReviewUnavailable { reason: "Native live-provider setup is unavailable until the review-delivery phase." }, or Values { layer: Repo, updates } for independent retained-mode tokens. Apply deserialization returns exactly the supplied literal string, null and [] answers and captured inputs. prepare_batch returns literal persisted values for those updates. Static skill-contract assertions check the grouped-tool allowlist and prohibit frozen execution and direct setters; detect-surfaces has its own explicit acceptance path. Review entry preparation returns the named unavailable result without opening a session; invalid active input validation returns the named error. No host, answer/apply/persist chain or observed-conversation claim.

### Task 3: Prove the ordinary interview against the binary (P8-3-T3)

- **Files:** `crates/cadence/tests/phase8_interview.rs`, `crates/cadence/src/config/write.rs` (filesystem observation seam for the production batch), `crates/cadence/src/config_service.rs` (facts from supplied generation and preserved evidence), `crates/cadence/src/config/mod.rs` (reuse the existing role module export after lint)
- **Action:** Test the config interview through the binary's own native operations, with no host, no skill invocation and no model dispatch. Cover all thirteen subjects and their answers, current values shown with their source layers, first-run default acceptance, later unchanged and one-leaf changes, explicit global editing, a custom model string carrying literal spaces, quotes, equals and Unicode, and the explicit full-protection answer. Assert one accepted batch performs exactly one write, that reopening returns byte-identical values with correct provenance, and that the stakes-original case returns the retirement statement followed by the same ordinary questions. Construct question and answer payloads as fixtures and call the operations directly; a value must be carried through, never reconstructed. Extra writes, a substituted value or missing provenance is failure.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview` — ConfigWriter::batch_observed, supplied literal thirteen-answer updates and filesystem observations, returns thirteen named changed keys, Global destination, generation 1 and exactly one config replacement with independently encoded expected bytes. Separate calls prove explicit-global repo preservation, custom model bytes, [] replacement preserving actual-diff surfaces and identical [] no-op. config_service::observed_facts returns thirteen ordered values and exact source layers from independently encoded reopened inputs, including later-run classification and preserved stakes originals followed by the ordinary subjects. interview::answers returns a single changed role leaf when the selected floor pin already exists. Each test calls one production unit and makes one assertion on its returned value and observable write result; no save/reopen sequence or live host.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-50 / D-51 / AC4 | P8-3-T1, P8-3-T2, P8-3-T3 |
| D-50 / AC2 | P8-3-T1, P8-3-T3 |
| D-47 / AC6 | P8-3-T1, P8-3-T2, P8-3-T3; floor consequence in P8-4-T3 |
| D-48 / AC7 | P8-3-T2, P8-3-T3 |
| D-46 / AC10 (config half) | P8-3-T2, P8-3-T3 |

## Notes

Run after Plan 2 and before Plan 4. Shared config_service.rs, import/mod.rs and config/mod.rs supply real prerequisites; Plan 5 also shares the live target/document and configuration contract. These are ordered slices, not parallel interview and routing implementations.

Two adversarial cases need explicit interpretation. First, D-51 locks raw global roles presence as the layer-selection rule; presence does not certify complete answers. Empty/partial roles objects are later-run inputs whose missing subjects still appear in all thirteen questions, and unchanged later answers do not create unrequested global or repo pins. Second, D-47 writes exactly the selected layer: global [] with a repo waiver cannot make the effective waiver empty. AC6's no-effective-waiver proof uses repo [] or global [] without a stronger repo waiver; the stronger-repo case proves honest reporting and no cross-layer write.

The live host executable was found during authoring, but credentials, question delivery, installed schemas and model behavior were not tested. Live interview observation is not an acceptance obligation of this plan; it is routed to `.planning/phases/8/MANUAL.md`. No ignored live test is written here. Read the existing signing helper without editing it if later dispatch-stage scaffolding needs it.
