PLAN COMPLETE

# Phase 8 PLAN-5 run record

Outcome: complete. Completed tasks: P8-5-T1 through P8-5-T3.

Executed on 2026-09-08 under the owner's direct instructions, outside native
dispatch. No dispatch identity, trace event or live-host observation is invented.
Branch: `cadence/binary-owns-process`; initial HEAD
`fd7c07fa0e7729ace577559e6912f1b2cda9a0fb`; initial tree clean.
Final implementation commit: `4197b9504b068b36b18f7a6b860af08e756af1fa`.
All three task commits have valid GPG signatures and name
John Crenshaw <john@jcrenshaw.dev> as both author and committer, using key
`693AB15F91734B0C`. No push. Each task's Verify rewrite is in its own commit.
The owner explicitly authorized this report and its separate signed commit.

| Task | Status | Commit | Verification |
| --- | --- | --- | --- |
| P8-5-T1 | completed | `fecdd8188b2a74bbee85810796e0c842c755e7f0` (signature G) | phase8_dispatch: 12 passed; phase8_config: 34 passed; cadence binary: 191 passed after compile and stale alias-fixture repairs |
| P8-5-T2 | completed | `43d545182f8ed4b2e30b25328fd52f07e6b9ff23` (signature G) | phase8_dispatch: 18 passed after filesystem-probe repairs; execution_boundary_compat: 11 passed; execution_store: 18 passed; mcp: 18 passed |
| P8-5-T3 | completed | `4197b9504b068b36b18f7a6b860af08e756af1fa` (signature G) | phase8_dispatch: 24 passed on three invocations with intervening fixes; mcp: 18 passed; permitted clippy exited 0 with one warning subsequently fixed |

## Required full suite

Not run. The owner's command limit overrides the historical workspace suite
and executor-contract suite requirement. PLAN-5's suite metadata now names only
`TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests`, run exactly once
after the task tests and before the T3 commit. Neither `cargo test --workspace`
nor `cargo clippy --all-targets` was run. Only the named task test commands ran,
one at a time and in task order. On failures, only the failed command was rerun.
T3's successful dispatch target was repeated for the subsequent resident-reuse
fix and then the lint repair; no unchanged-code repetition or extra target was
added. Clippy was not repeated.

## Plan and implementation observations

- P8-5-T1 moves the existing routing-input capture onto Generation so library
  and binary consumers share one definition. Captured inputs include resolved
  paths, exact byte digests/presence, file stamps and alias status. Reload's
  refresh_expected compares those values after a real refresh; generation
  numbers are not identity. Separate fixtures cover changed model, equal-size
  bytes, replacement identity, presence, alias, global reset, waiver and I/O
  failure. Existing reload mechanics remain dependencies, not a restored AC1.
- The writer carries the proposed route through its validated prospective
  snapshot into the final routing policy method, after participant and intent
  preparation and before durable intent installation. Existing root/shared
  destination ownership encloses that comparison. SessionPolicy refreshes and
  compares before evaluating current policy. A filesystem probe editing config
  at intent preparation returns the literal changed-input conflict. The service
  exposes it as the typed unconfirmed RoutingInputsChanged failure, without an
  admitted worker prompt or successful routing record.
- Recovery uses its existing current-config validation and never applies the
  new-admission equality check to historical inputs. Config-route facts retain
  the supplied-generation resolver from prior plans. The required binary target
  exposed two stale alias expectations left after P8-3-T1: shared global intent
  correctly retains repo-command and trusted intent instead of null. Only those
  expected values changed; alias behavior itself was not changed again.
- P8-5-T2 strengthens require_current_execution: a routed active dispatch must
  join its exact Routing record to a matching confirmed dispatch boundary,
  including phase, tool, subject, receipt and bounded store generation. Existing
  transaction recovery already rejects missing or mismatched routing records;
  independent current-wire fixtures now establish that semantic check even when
  snapshot and intent digests are recomputed consistently.
- Seven separate filesystem failure cases exercise routing-record preparation,
  intent sync, decision replacement, snapshot replacement, state and intent
  confirmation, and intent-removal directory sync. Every request returns the
  named Io failure. Independently encoded pre-install, decision-installed and
  snapshot-installed states recover exact participant bytes through Store::open.
  The middle state represents loss between decision and snapshot installation;
  no new killed-process choreography was added. A pre-encoded duplicate request
  returns generation 1 with exactly one Routing decision. Model, requested
  effort, provenance, invented observation and invented receipt mismatches refuse.
- Existing fixed-wire/legacy compatibility and store tests ran unchanged within
  their named targets. No route observations were invented for historical fixed
  dispatches, and unsupported old codecs retain their explicit refusal. Existing
  process-boundary tests in those targets ran; new plan-5 tests introduce no
  subprocess, host, ignored live test or model-text assertion.
- P8-5-T3 independently supplies sonnet/high, opus/xhigh, and a model-only null
  reset retaining xhigh. ConfigWriter::batch returns exact stored bytes and the
  expected changed keys; separate resolve_route assertions return complete source
  and reason trails. Independent Python encoding of the documented identity and
  canonical-envelope preimages supplies literal dispatch and answer digests.
  Store::request consumes independently supplied route fixtures and returns each
  admitted ID plus its exact Routing record, with requested effort and Missing
  observed effort/receipt. No save/resolve/dispatch workflow manufactures inputs.
- The existing prompt construction is extracted into render_dispatch_prompt over
  dispatch, schema value and rendering version. The service supplies the real
  executor patch schema to that function. Independent literal SHA-256 and length
  oracles cover both renderings for all three supplied dispatches; the renderer
  fixtures supply schema data directly. The MCP target separately checks actual
  tool schemas, retained operations, malformed calls and installed executor rung
  files. This proves binary decisions and rendering, not consumer compliance.
- Final T3 inspection found that the pre-intent routing conflict still poisoned
  the writer through generic commit-error handling. That specific pre-admission
  refusal now leaves the resident reusable; other failed persistence remains
  poisoned. T3's lease was extended for this correction and its dispatch target
  passed again. This is not a new external edit/retry workflow test.
- T2 also replaces the T1 fixture's permissive evaluation closures with the real
  planning_policy. Final fixtures use production internal collaborators; only
  filesystem observations/failures are supplied. The final clippy pass compiles
  the private binary fixtures too.
- AC1's stale requirement, must-be-true row and mapping were removed. Residual
  real-skill/live-harness wording is restated below; the AC4 and AC10 host halves
  stay in MANUAL.md. The executor contract was applied with the owner's explicit
  overrides for Verify repairs, lease extensions, reporting, command limits and
  final output. No task was skipped and no additional workflow was invoked.

## Verification receipts

Digests below are SHA-256 over the captured command output bytes, including
failed attempts. Counts refer to each named target, not unique tests across
commands. Output captures and the independent oracle encoder remain under
`/tmp/cadence-plan5-receipts/` for this workspace session; the durable record is
this table and the literal fixture values committed with T3.

| Task / attempt | Exact command | Exit | Result | Output SHA-256 |
| --- | --- | --- | --- | --- |
| P8-5-T1 / initial | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 101 | compile failed; 0 tests executed | `65e4cbcc053b4308a27ca79ebcc1d513e58be213c8aaa6261f63d61acd9d6923` |
| P8-5-T1 / retry 1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 0 | 12 passed; 0 failed | `c223e19e747a3800c4efd64e850386269a9171df0c90c4695c5e44304fe7b2b6` |
| P8-5-T1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config` | 0 | 34 passed; 0 failed | `93f392d6639426b6fcfd49ef93eb8e603a17eab89e25dd7d24f997b5cd98c8e1` |
| P8-5-T1 / initial | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 101 | compile failed; 0 tests executed | `3da06faf0ccd0fff421fd14b68915ed3f7817e28f251da5601235c062b61a7e3` |
| P8-5-T1 / retry 1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 101 | 189 passed; 2 failed | `cafa25f0e27cb710b35e7edfc69b43ecaed8b70983ceaed391d0c70349708ead` |
| P8-5-T1 / retry 2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 0 | 191 passed; 0 failed | `68b6225edbbb303023009b315f1e169489a4513a841fa905eeef28a4cc0c24ca` |
| P8-5-T2 / initial | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 101 | 17 passed; 1 failed | `9e069e7d035b403179d470b465b6095c7f37283db3f65975cde768683de7f217` |
| P8-5-T2 / retry 1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 101 | 17 passed; 1 failed; unused fixture variable warning | `350ff10de75b0091990df76aebc09adbff801b6dd70225e457e8c119df5589c3` |
| P8-5-T2 / retry 2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 0 | 18 passed; 0 failed | `b44a07395ecd1d164fd7bb126ab747986d2277e3e19a67bdc117ea85e0d20579` |
| P8-5-T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat` | 0 | 11 passed; 0 failed | `842db65b9d28d07d603d05bff91cac1f1c2fefdefe2df26d008120217c93b79c` |
| P8-5-T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store` | 0 | 18 passed; 0 failed | `f3f418893acd4e20ab9a46a26c29521bbd6ea8658e60f3dfddbfcbe4b627bde7` |
| P8-5-T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` | 0 | 18 passed; 0 failed | `213b007aaa7e61f9ebf35d0d6fc61566c3b20f36d6720d82f7f5d0a352ad42a7` |
| P8-5-T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 0 | 24 passed; 0 failed | `23289115ccc972f03af7cb55f451298b7e771195c1ae496b6e8bdae037181732` |
| P8-5-T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` | 0 | 18 passed; 0 failed | `af01d7eec0fbf9adbd47589324224b844d4231401d00c96ce98df282920d35c4` |
| P8-5-T3 / resident-reuse repair | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 0 | 24 passed; 0 failed | `e040a0863ad1d6533f7608ad0ba2f217660e9a7465cdcdd426fb887b3a148e34` |
| Final lint | `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests` | 0 | passed; one replace_box warning; no tests executed | `5a2794474b6437f15216f610af4ef8d9ea452b9d4c732f86582f14d71a7560e7` |
| P8-5-T3 / lint repair | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 0 | 24 passed; 0 failed | `3d478dcab610d798ad19c2ae713eae0eb04c90bd8eb5f1c8afab8c3fdbcc69aa` |

T1's first compile found a binary/library module-path mismatch, repaired by
putting input capture on Generation; the binary test compile then found a
missing Filesystem fixture import. Its first executed binary run found the two
stale alias expectations described above. The next binary run passed all 191.

T2's first dispatch run found that TemporarySync names the temporary path,
whereas removal's DirectorySync names the parent. The first scripted repair
missed the formatted predicate and left an unused variable; the second repair
matched those filesystem boundaries correctly. Both failed attempts ran 18 tests
with 17 passes, and the next run passed all 18 without warnings.

T3's one clippy invocation exited 0 and reported one replace_box warning in a
fixture. Assigning through the existing Box repairs the needless allocation.
The post-repair dispatch target passed all 24 tests without compiler warnings;
no second lint result is claimed.

## Verify rewrites

Each complete old/new line is recorded verbatim below. All original cargo
targets are retained. Workflow, concurrency and process-replacement wording is
replaced with independent function assertions and supplied filesystem states.

### P8-5-T1

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Deterministic hooks change sonnet to opus with both generations valid between route calculation and admission, and separately after service reobserve but before final policy validation. Both attempts refuse with no admitted candidate; a fresh query selects opus. Repeat equal-size/equal-mtime edits, rename/alias-retarget, inherited global reset, waiver edits and failed-I/O invalidation at new public consumers. After a successful admission, valid edits plus restart preserve its exact route/prompt; completing it lets the next new dispatch select current settings. Invalid current config still refuses resume.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Reload::refresh_expected returns a supplied Generation for identical captured identities, presence, exact bytes and stamps, or Conflict("routing inputs changed before admission") for independently supplied changed model, equal-size bytes, replacement identity, alias, global reset or waiver inputs; failed reads preserve their Io refusal. The final transaction policy consumes the proposed route inputs after preparation under writer ownership. Independent recovery/replay fixtures retain historical inputs without equality checks, and resolve_route returns one supplied generation for role and policy. No edit/query/restart/completion chain is required.

Why: The observation/edit/restart/completion chain becomes captured-input comparison, final prospective admission and independently supplied historical inputs. Existing reload behavior remains a dependency.

### P8-5-T2

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — Every injected interruption either recovers the same complete admission once or returns a failure with no confirmed orphan dispatch. Recomputed-digest fixtures with missing/mismatched Routing evidence are rejected. Duplicate calls and process replacement retain one routing decision, exact agent/model/rung/provenance and prompt digest. No fixture with absent host evidence serializes observed_effort or receipt. Independent historical fixed/current-codec fixtures replay byte-exactly; already-unsupported old codecs keep their explicit compatibility refusal without mutation.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — Store::request returns Io("injected routing persistence failure") for separate filesystem preparation, intent-sync, decision-install, snapshot-install, confirmation and intent-removal failures. Store::open over independently encoded intent/participant bytes returns Ok with the exact complete unit, or Invalid("dispatch lacks its exact routing decision") for missing/mismatched evidence even with recomputed digests. Separate fixtures supply pre-install, decision-replaced, snapshot-replaced and already-confirmed states, representing interruption without a process dance. require_current_execution returns RoutingEvidence for an orphan route; duplicate request admission returns the existing generation and single Routing record. Historical fixed dispatch serialization and canonical answer digests remain literal, with absent observed_effort/receipt preserved as missing evidence. Existing compatibility targets retain legacy refusal and both prompt renderings; no live host is required.

Why: Interruption and duplicate/replacement sequences become single writer request/open results over independent persistent states. The decision-installed state supplies the crash boundary without a new process dance.

### P8-5-T3

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — proves each saved config yields its expected agent, model and rung, that a null model omits the parameter, and that the prompt and dispatch ID are exact. Three tools with schemas and typed malformed-call refusals still hold. A routing answer that matches only because the expectation was derived from the same code path does not pass.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — ConfigWriter::batch returns exact saved sonnet/high and opus/xhigh bytes, or changes only model to null while retaining xhigh, from separate filesystem fixtures. resolve_route returns literal role/model/effort sources and reasons from independently supplied saved generations. build_routed_dispatch returns the independently encoded dispatch ID; Store::request returns that admitted ID and its exact Routing record with requested effort and Missing observed effort/receipt. render_dispatch_prompt returns byte-exact current and historical prompt text for supplied dispatch/schema values, checked against independent literal digests and lengths. The existing MCP assertions retain exactly three tools with schemas, installed executor rungs, phase-7 operations and typed malformed-call refusals. No save/dispatch/replay chain, host or model output is used.

Why: The saved-setting obligation is split into independent batch, resolver, builder, admission and renderer assertions. Model-only reset retains xhigh, and the host half stays manual.

## Residual live-host wording

The positive live-skill implication and stale harness reference were corrected:

Old:

# Phase 8: Admission, replay and real skill proof - Plan 5

New:

# Phase 8: Admission, replay and binary dispatch proof - Plan 5

Old:

A saved model/rung choice reaches real dispatch through the shipped skill and remains accurately attributable after races, interruption and replay. This plan closes the final config-generation admission check. Live-host consumption is routed to `.planning/phases/8/MANUAL.md` and is not an obligation here.

New:

A saved model/rung choice determines binary dispatch and remains accurately attributable after changed inputs, interruption and replay. This plan closes the final config-generation admission check. Live-host consumption is routed to `.planning/phases/8/MANUAL.md` and is not an obligation here.

Old:

Run after Plan 4; all preceding plans are transitively required through real file overlaps. This plan shares execution_service.rs and phase8_dispatch.rs with Plan 4, writer/import with Plans 1-2, and the live harness/document with Plan 3. It cannot run in parallel with any unfinished predecessor.

New:

Run after Plan 4; all preceding plans are transitively required through real file overlaps. This plan shares execution_service.rs and phase8_dispatch.rs with Plan 4, writer/import with Plans 1-2, and the grouped schema contract with Plan 3. It cannot run in parallel with any unfinished predecessor.

The already-correct manual-routing statements remain. Notes now say the named
binary targets do not close those items, replacing the stale ordinary-workspace
suite reference. No live-host obligation survives as a test requirement.
MANUAL.md was not changed; neither routed item was substituted with a harness.

## Lease, frozen reference and remaining tree

Every extension was made in the task's Files line before editing the path:

- P8-5-T1: store/mod.rs for the policy precondition, execution/boundary.rs for
  the typed failure, and config/tests.rs for the exposed stale alias assertions.
- P8-5-T2: import/mod.rs to use production policy in admission fixtures.
- P8-5-T3: execution/render.rs and execution_service.rs for the shared renderer,
  then store/writer.rs for the final resident-reuse correction.

New top-level paths were added as needed. Full task lease lines follow.

### P8-5-T1

Old Files line:

- **Files:** `crates/cadence/src/import/mod.rs` (SessionPolicy::validate / Session::request / Session::config), `crates/cadence/src/config/reload.rs` (Generation / Input / Reload::refresh), `crates/cadence/src/config_service.rs` (route observation from prior plans), `crates/cadence/src/execution_service.rs` (query / reobserve / dispatch_response / RoutingObserved hook), `crates/cadence/src/execution/model.rs` (route data on ActiveDispatch from Plan 1), `crates/cadence/src/execution/dispatch.rs` (route identity from Plan 1), `crates/cadence/src/store/writer.rs` (boundary_v1 / persist / MutationContext construction), `crates/cadence/src/store/transaction.rs` (final policy validation / recover), `crates/cadence/src/execution_service_tests.rs` (Driver / Event race fixtures), `crates/cadence/tests/phase8_dispatch.rs` (new-dispatch freshness integration), `crates/cadence/tests/phase8_config.rs` (public read/route freshness)

New Files line:

- **Files:** `crates/cadence/src/import/mod.rs` (SessionPolicy::validate / Session::request / Session::config), `crates/cadence/src/config/reload.rs` (Generation / Input / Reload::refresh), `crates/cadence/src/config_service.rs` (route observation from prior plans), `crates/cadence/src/execution_service.rs` (query / reobserve / dispatch_response / RoutingObserved hook), `crates/cadence/src/execution/model.rs` (route data on ActiveDispatch from Plan 1), `crates/cadence/src/execution/dispatch.rs` (route identity from Plan 1), `crates/cadence/src/store/writer.rs` (boundary_v1 / persist / MutationContext construction), `crates/cadence/src/store/transaction.rs` (final policy validation / recover), `crates/cadence/src/execution_service_tests.rs` (Driver / Event race fixtures), `crates/cadence/tests/phase8_dispatch.rs` (new-dispatch freshness integration), `crates/cadence/tests/phase8_config.rs` (public read/route freshness), `crates/cadence/src/store/mod.rs` (final routing policy precondition), `crates/cadence/src/execution/boundary.rs` (typed changed-input failure), `crates/cadence/src/config/tests.rs` (repair stale alias-intent expectations exposed by the required binary target)

### P8-5-T2

Old Files line:

- **Files:** `crates/cadence/src/store/writer.rs` (boundary_v1 / confirmed_boundary / require_current_execution), `crates/cadence/src/store/transaction.rs` (Intent::validate_boundary_v1 / commit / recover), `crates/cadence/src/execution/boundary.rs` (canonical_bytes / PreparedAnswer / historical digest fixtures), `crates/cadence/src/execution_service.rs` (dispatch_response / historical render_prompt_version), `crates/cadence/tests/phase8_dispatch.rs` (failure and replay fixtures), `crates/cadence/tests/execution_boundary_compat.rs` (independent old dispatch / intent bytes)

New Files line:

- **Files:** `crates/cadence/src/store/writer.rs` (boundary_v1 / confirmed_boundary / require_current_execution), `crates/cadence/src/store/transaction.rs` (Intent::validate_boundary_v1 / commit / recover), `crates/cadence/src/execution/boundary.rs` (canonical_bytes / PreparedAnswer / historical digest fixtures), `crates/cadence/src/execution_service.rs` (dispatch_response / historical render_prompt_version), `crates/cadence/tests/phase8_dispatch.rs` (failure and replay fixtures), `crates/cadence/tests/execution_boundary_compat.rs` (independent old dispatch / intent bytes), `crates/cadence/src/import/mod.rs` (use the production planning policy in admission fixtures)

### P8-5-T3

Old Files line:

- **Files:** `crates/cadence/tests/phase8_dispatch.rs`, `crates/cadence/tests/mcp.rs` (grouped boundary / skill contract), `docs/architecture/config-routing.md` (saved settings reach dispatch / evidence limits)

New Files line:

- **Files:** `crates/cadence/tests/phase8_dispatch.rs`, `crates/cadence/tests/mcp.rs` (grouped boundary / skill contract), `docs/architecture/config-routing.md` (saved settings reach dispatch / evidence limits), `crates/cadence/src/execution/render.rs` (pure dispatch renderer with supplied schema), `crates/cadence/src/execution_service.rs` (use the shared renderer), `crates/cadence/src/store/writer.rs` (keep a pre-intent changed-input refusal reusable)

PLAN-5 edits accompanied their task. Listed paths already served by existing
implementations were left unchanged when no functional edit was needed. Files
were staged by explicit path; no blanket staging was used. The frozen
cadence-core reference was not modified. No UAT.md, STATE.md, ROADMAP box or
MANUAL.md was touched, and /cad-verify was not invoked.

Unrelated untracked `.planning/phases/9/PLAN-1.md` through `PLAN-6.md` appeared
during T2 and remain outside these commits. This separate report commit changes
only `.planning/phases/8/reports/plan-5.md`. The separately authorized phase
summary follows; it records binary scope and the manual evidence limits.

PLAN COMPLETE
Plan: `.planning/phases/8/PLAN-5.md`
Tasks: 3 of 3 completed in separate signed commits.
Deviations: Verify lines restated as independent function assertions; leases
extended; prohibited suite replaced by one permitted clippy run; stale AC1 and
live-skill/harness wording removed; compile/probe/alias fixtures repaired; final
pre-intent refusal made reusable; one lint warning repaired and named dispatch
checks repeated only for intervening changes.
Open items: none within PLAN-5's binary scope. AC4/AC10 host observations remain
in MANUAL.md. No later phase plan was executed.
