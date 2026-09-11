VERIFICATION PASSED

Rechecked 2026-09-10 in /code/cadence, branch cadence/binary-owns-process, HEAD b99f2fed37282af1189b10ba2f804e2cd7b4ee75. Both revised plans were read at their current bytes. No tracked source changes are present. No cargo command or mutating git command was run; no plan or source was edited. Only this report was overwritten.

Reviewed plan SHA-256 digests:

- PLAN-1.md: 801526da35a6e6f63c976ba6ebfac8d23b7e84abd3c693f663b68d46b7eaf0f2
- PLAN-2.md: 9db156a10ab6d23a225bd629d9c18e41cbdd8c7120d86ec499d115f32f10edfc

## Findings by severity

- BLOCKER: 0. Previous B1 is resolved under the orchestrator's explicit prerequisite-setup ruling.
- WARNING: 0. Previous W1 is resolved by the pending observation and specification-provenance wording.
- NOTE: 0.

No new finding arose from the revision or the six requested checks. This is a plan-check verdict, not a claim that the future implementation or acceptance tests have passed. O1 remains not yet seen.

Citation shorthand: P1:n means .planning/phases/27/PLAN-1.md:n; P2:n means .planning/phases/27/PLAN-2.md:n; CONTEXT:n means .planning/phases/27/CONTEXT.md:n. All other paths are repository-relative unless absolute.

## Per-truth evidence table

Every check is in the creation-leased crates/cadence/tests/phase27_plan.rs. Every command must select exactly one test and report 1 passed; 0 failed, with zero selections rejected (P1:78; P2:68). Grouped artifact IDs below share the truth prefix; the two O1 entries attach the same observation.

| Truth | Its one check | Other items | Command |
|---|---|---|---|
| T1: approved content at returned identity | P27-T1-C; phase27_approved_plan_is_published_at_returned_identity (P1:99) | P27-T1-A1/A2/A3/A4; P27-T1-O1 (P1:137,143,149,153,159) | cargo test -p cadence --test phase27_plan phase27_approved_plan_is_published_at_returned_identity -- --exact (P1:134) |
| T2: mismatched identity refused and identified | P27-T2-C; phase27_identity_mismatch_is_refused (P1:174) | P27-T2-A1 (P1:190) | cargo test -p cadence --test phase27_plan phase27_identity_mismatch_is_refused -- --exact (P1:187) |
| T3: outside-phase path refused | P27-T3-C; phase27_out_of_phase_target_is_refused (P1:198) | P27-T3-A1 (P1:214) | cargo test -p cadence --test phase27_plan phase27_out_of_phase_target_is_refused -- --exact (P1:212) |
| T4: distinct ascending identities | P27-T4-C; phase27_multiple_plans_have_distinct_numeric_order (P1:222) | P27-T4-A1 (P1:243) | cargo test -p cadence --test phase27_plan phase27_multiple_plans_have_distinct_numeric_order -- --exact (P1:240) |
| T5: unused gap identity beside prior plans | P27-T5-C; phase27_gap_plan_uses_previously_unused_identity (P2:84) | P27-T5-A1/A2 (P2:112,117) | cargo test -p cadence --test phase27_plan phase27_gap_plan_uses_previously_unused_identity -- --exact (P2:109) |
| T6: replay returns original allocation | P27-T6-C; phase27_acknowledged_allocation_replays_original_identity (P2:125) | P27-T6-A1 (P2:150) | cargo test -p cadence --test phase27_plan phase27_acknowledged_allocation_replays_original_identity -- --exact (P2:147) |
| T7: unauthorized replacement refused | P27-T7-C; phase27_unauthorized_replacement_is_refused (P2:160) | P27-T7-A1/A2; P27-T7-O1 (P2:190,196,203) | cargo test -p cadence --test phase27_plan phase27_unauthorized_replacement_is_refused -- --exact (P2:187) |

## Recheck of B1 and W1

### B1 resolved: real prerequisite authoring, real execution admission

The orchestrator expressly permits handwritten owner gate/answer records committed through the real SessionFactory / Session::commit_evidence path before launching the stdio process. Revised P2:383 specifies that path in detail, and C1/C5/C7 explicitly consume it at P1:111, P2:98 and P2:175. It does not authorize invented execution occurrences, dispatches or receipts (P2:407).

The revised setup is supported by the actual source:

| Revised instruction | HEAD evidence |
|---|---|
| Construct SessionFactory with isolated global configuration and cadence::config::planning_policy | crates/cadence/src/import/mod.rs:705 accepts global and policy; crates/cadence/src/config/mod.rs:93 supplies the real planning policy. Existing real test usage is at crates/cadence/tests/phase11_context.rs:243. |
| Open the real planning root through first_touch | crates/cadence/src/import/mod.rs:844 resolves the root and creates/reuses the policy-controlled session. |
| Read current view using Session::request(Operation::ReadVerified) before each commit | crates/cadence/src/import/mod.rs:484 refreshes controlling config and forwards the operation; crates/cadence/src/store/writer.rs:491 revalidates stored bytes. |
| Commit handwritten version-1 progress gate unanswered, then answered, with distinct operation IDs | crates/cadence/src/import/mod.rs:553 writes history and projection through CompareTransact; crates/cadence/src/evidence/persistence.rs:157 requires the pending question before an answer and rejects changing it. |
| Exact project/planning-root/live/phase occurrence/native-execution/SUMMARY scope | Matches crates/cadence/src/execution_service.rs:54. The new prose does not guess an unsupported occurrence key. |
| Gate and answer fields, Proceed/approve, null optional values | Existing schema at crates/cadence/src/evidence/gates.rs:29 and crates/cadence/src/evidence/gates.rs:45; fields are the handwritten inputs already shown at crates/cadence/tests/mcp.rs:770. |
| Use the answered progress gate as continuation authority | crates/cadence/src/next_action/continuation.rs:140 selects progress gates; lines 194 and 230 allow Continue when an answer exists. |
| Release setup handles before launching stdio | P2:406 respects the real writer's lifetime ownership; acquisition occurs at crates/cadence/src/store/writer.rs:283. |
| execute-next itself must return and persist admission in C5/C7 | P2:100 and P2:179 explicitly require both; real admission paths remain crates/cadence/src/store/writer.rs:736 and crates/cadence/src/store/writer.rs:879. |

The replacement of the old forbidden setup is precise: reuse its handwritten caller inputs, but use Session::commit_evidence with real policy instead of AllowFixture/direct-store transactions (P2:389). The setup does not construct a returned allocation or an expected admission record. Native approved truths still come through real context-submit (P1:74; P2:61); caller continuation authority does not substitute for D-80 approval.

C1 still requires its named provisional-publication refusal with the other execution prerequisites established (P1:127; P2:409). C5/C7 still require actual dispatch admission, not any refusal. The direction to report an additional blocking prerequisite, if one is encountered, does not permit a passing assertion in its absence: their command/result requirements and affirmative dispatch conditions remain binding (P2:100,179,409). No known unavailable authoring prerequisite remains under the ruling. No new public authorization API, production dependency, or phase-12 activation is introduced (P2:411).

### W1 resolved: pending observation with specification provenance

P1:165 and P2:209 now say the specification was approved on 2026-09-10 and the observation is not yet seen. Both explicitly keep O1 pending, attached only to T1/T7, and require supplied observer, time and result before recording a seen episode. The task that compiles the authoring instructions carries the same restriction (P2:352), as do both final Notes (P1:479; P2:426). No residual owner-seen claim remains.

This matches CONTEXT:204 and the design's seen/not-seen evidence requirement at docs/architecture/acceptance.md:160. O1 is not a check; accepting an actual future episode can cap T1/T7 at concerns, never met (P1:170; P2:214). Passing this review does not mark that episode seen.

## 1. Planning refusals and evidence-map discipline

The review retains the goal-backward obligations derived before reading the original plans: exact approved publication; identified mismatch refusal; path confinement; ordered distinct batch allocation; unused gap identity with retained history; stable historical replay; and refusal of unauthorized replacement. These follow from CONTEXT:15, CONTEXT:38 and CONTEXT:170. Both revised plans were read in full against those obligations, the acceptance design and the previously read checker role contract. The user-authorized second review and setup ruling supersede the contract's one-pass process limit and the old plan's setup prohibition.

Requirements frontmatter covers T1–T4 in P1:4 and T5–T7 in P2:4. All seven approved truths are repeated without changing their outcomes (P1:35; P2:33). Mechanical enumeration again found seven check items, twelve artifact items and two attachments of the same observation, with no orphan, missing truth, second check or additional attributed test. The truth binding remains the approved CONTEXT text at b99f2fed, without inventing an unavailable numeric version (P1:55; P2:50).

Every check names its file/function, trigger setup, public call, handwritten expected outcome and exact command. No link items are introduced (P1:93; P2:79); no truth names a collaborator handoff that needs a separate link test. Persistence destinations are observed directly by the checks. This satisfies docs/architecture/acceptance.md:147 and docs/architecture/acceptance.md:166.

The four lifecycle refusal points stay separate (docs/architecture/acceptance.md:253): phase 11 supplies native truth authoring; these plans obey the planning evidence-map rules without implementing phase 28/29 records/refusals; execution must record actual red and green for each check with no subject fake (P1:471; P2:420); model verdict/status machinery remains phase 13. Task verifies are either one mapped test or one cat command opening specified artifacts with substantive inspection criteria (P1:284,310; P2:355). The whole suite is prescribed only at plan close, not in task verify (P1:473; P2:421).

**PASS:** all planning refusals, one-check-per-truth discipline and O1 attachment are satisfied.

## 2. Real boundaries, handwritten oracles and falsifiability

The shared contract still requires the actual cadence serve binary over stdio against a real temporary project, public plan query/apply operations, native approved truths, and real decoder/resident/service/policy/store/journal/filesystem (P1:64; P2:58). Only clock and caller inputs may be supplied as controlled inputs. The orchestrator-authorized owner-input setup writes through real production machinery; the publication and execution-admission boundaries remain real.

Final persistence assertions follow server exit, dropped handles and reopened PLAN paths, directory listings, state.json, items.jsonl and decisions.jsonl. Snapshot::parse checks the actual snapshot against both JSONL streams. Successful publications additionally reopen the real Store/Filesystem; intent absence is checked before writer recovery could mask early acknowledgment (P1:84; P2:70). Refused/absent/retained-intent cases reopen read-only bytes because writer startup itself can create directories and recover state (crates/cadence/src/store/filesystem.rs:52; crates/cadence/src/store/writer.rs:283).

| Check | Trigger, observable outcome and falsifying behavior |
|---|---|
| T1, P1:99 | Varied handwritten body bytes and strict structural values; missing/declined/changed approval controls; valid approval returns exact content/identity/revision after reopen. Provisional readback and identity-named execution refusal remain mandatory. Preapproval writing, byte normalization, incorrect identity or syntax-based readiness fails it. |
| T2, P1:174 | Independently mismatched phase/number versus target must identify both and preserve storage; matching control publishes. Silent normalization or refusing all requests fails it. |
| T3, P1:198 | Forbidden raw destination inputs plus real target/ancestor symlinks must name path/rule and leave outside sentinels and store unchanged; safe target succeeds. String-only confinement fails it. |
| T4, P1:222 | After occupied 8, ordered three-plan batch must return 9/10/11 with matching bodies and numeric listing; stale competitor cannot silently become 12; final-target conflict and u32 exhaustion refuse. Independent allocation, lexical order or partial precondition-failing publication fails it. |
| T5, P2:84 | Bare 1, plan 3, missing-plan report 8, deleted native 9 and restart yield new 10 then 11; aliases/conflicting identities refuse; real legacy dispatch supplies an execution-consumed identity. Recycled holes, lost history or manufactured admission fails it. |
| T6, P2:125 | Retry across acknowledgment, unrelated writes, replacement and restart must return original ordered identities/revisions; changed payload refuses; missing/drifted/newer projection is reported without restoration. Reallocation or resurrected bytes fails it. |
| T7, P2:160 | Absent/declined/original/stale/wrong-target/new-content authority must refuse replacement; exact native unexecuted replacement preserves history; actually admitted legacy and occupied aliases remain protected. Original approval as new authority, stale overwrite or simulated admission fails it. |

All structural values, bodies, identity rules and revision relations are handwritten (P1:78; P2:68). No renderer, allocator or constructed result is its own oracle. D-80's deliberately unapproved controls in T1 are prerequisite-refusal cases, not substitutes for the native-approved positive setup. No specified check could pass independently of its claimed behavior. Durability and recovery protocol are additionally inspected through artifacts; successful reopen alone is not claimed to prove every crash interleaving (P1:143,344).

**PASS:** revised setup removes B1 without weakening the real subject, control or oracle.

## 3. Exact D-80 through D-89 delivery and D-88 admission

| Decision | Implementing tasks and evidence | Result |
|---|---|---|
| D-80, CONTEXT:64 | P1 task 1 permits read-only intake/research without truths (P1:272); task 3 checks saved native approval for the bound phase and rechecks current snapshot (P1:331). C1 includes handwritten-only and wrong-phase controls. | Delivered; no fabricated truths or extra reviewer gate. |
| D-81, CONTEXT:74 | P1 tasks 1/3/4 preserve readable legacy inputs, canonical positive-integer identity, strict mandatory execution block and native parse before acknowledgment (P1:273,337,369). | Delivered; metadata remains native, no bare PLAN writer or legacy rewrite. |
| D-82, CONTEXT:89 | P1 tasks 1/3 preserve authored body and opaque map under revision with stable readback (P1:265,335,354); future map publishing uses the same mechanism (P2:380). | Delivered; no typed evidence, associations or map-validity claim. |
| D-83, CONTEXT:97 | P1 tasks 1/3 require owner/time/exact full content and identities before first touch or writer requests (P1:278,332); task 6 requires fresh approval after changed allocation (P1:423); P2 task 4 compiles the procedure (P2:339). | Delivered; drafts do not persist, no repeated truth attestations. |
| D-84, CONTEXT:106 | P2 task 2 requires target/observed-old/new-content approval, serialized stale check, retained publication history, and refusal after any execution admission (P2:262). C7 supplies real admission under the revised setup. | Delivered without legacy conversion or execution-history reconciliation. |
| D-85, CONTEXT:116 | P1 task 6 uses one approved ordered transaction, checked high-water arithmetic and inventory/file revalidation (P1:414); P2 task 1 retains legacy/execution consumption (P2:230). | Delivered; no reservations, expiry, wrapping or automatic reassignment. |
| D-86, CONTEXT:125 | P1 task 3 atomically stores exact payload digest and assigned result (P1:341); P2 task 3 resolves historical results before allocation/stale/replacement checks and separately reports current projection (P2:295). | Delivered; original revisions survive replacement and replay does not restore old content. |
| D-87, CONTEXT:137 | P1 task 1 defines explicit occurrence with active-cycle lifetime (P1:278,442); P2 task 1 retains disk/report/execution identities and ambiguity refusal (P2:230). | Delivered; no mutable-set identity, deleted-number reuse or silent cycle reset. |
| D-88, CONTEXT:148 | P1 task 2 installs provisional native identity admission refusal before publication is enabled (P1:296); task 3 exposes provisional readback; P2 task 1 preserves the admitted set (P2:245). | Delivered by a mechanical check, detailed below. |
| D-89, CONTEXT:157 | P1 tasks 1/3/6 retain read-only previews, existing queue/ownership/conditional transaction and precise changed-precondition conflict (P1:268,347,421); P2 task 2 applies stale-target protection (P2:269). | Delivered; no new writer, reader-start guard, authoring service or silent reallocation. |

**Concrete D-88 check:** consult native publication records for the bound occurrence and visible phase/plan identities; refuse any provisional native member of the candidate execution set before active dispatch return, new dispatch or changed-set admission. Repeat against the writer's current snapshot in Writer::boundary_v1's BoundaryChange::Dispatch arm and Writer::admit_execution, and validate dispatch intents at recovery (P1:296). Stable identity remains authoritative when file bytes/fingerprints drift; execution.schema, opaque map text, old SUMMARY/UAT and plan-set hashes cannot imply readiness (P1:304). This is mechanical and separately preserves legacy execution behavior. It does not implement later map validation or native execution activation.

**PASS:** every decision has a delivering task; no production action adds or removes a locked requirement. The added prerequisite records are explicitly authorized test caller inputs, not extra production publication requirements.

## 4. Existing symbols, paths, seam claims and creation leases

Tracked source is unchanged at the same HEAD, so the first pass's direct tree inspection remains applicable to unchanged anchors. Newly cited SessionFactory/policy/request/commit_evidence and gate fields were re-read in this pass and are individually confirmed in the B1 resolution table. Both current plans were read in full; their production edit targets remain existing seams or explicit creation leases. Fixture IDs and request fields added by the revision are handwritten test inputs in an existing schema, not invented production symbols.

The existing seam inventory is retained below against unchanged HEAD source. The MCP fixture distinction is governed by the resolved B1 setup documented above.

| Claimed existing symbol/path/seam | Confirmed source anchor and substance |
|---|---|
| Library registration `lib.rs` | `crates/cadence/src/lib.rs:1`; context is a library module at line 6. |
| `main.rs`, `Command`, `run_command`, `Command::ContextInstructions` | `crates/cadence/src/main.rs:25`, `crates/cadence/src/main.rs:45`, `crates/cadence/src/main.rs:50`; project-free compiled markdown rendering pattern. |
| Actual serve entrypoint / root option | `crates/cadence/src/main.rs:20`, `crates/cadence/src/main.rs:28`, `crates/cadence/src/main.rs:68`. |
| Binary service module registration in `server.rs` | `crates/cadence/src/server.rs:74`; a new plan service can follow this leased path without adding a main module in P1. |
| `QueryArguments`, `ApplyArguments`, `QueryOutput`, `ApplyOutput` | `crates/cadence/src/server.rs:235`, `crates/cadence/src/server.rs:267`, `crates/cadence/src/server.rs:289`, `crates/cadence/src/server.rs:278`. |
| Query/apply schema generation | `crates/cadence/src/server.rs:360`, `crates/cadence/src/server.rs:385`. |
| `PublicServer`, bound planning root, `call_tool` | `crates/cadence/src/server.rs:400`, `crates/cadence/src/server.rs:390`, `crates/cadence/src/server.rs:568`. |
| Real context query/apply before generic fallback | `crates/cadence/src/server.rs:591`, `crates/cadence/src/server.rs:780`. |
| `Request`, `Resident`, `Resident::spawn_with_driver`, context mailbox, `Resident::context` | `crates/cadence/src/recall/mod.rs:205`, `crates/cadence/src/recall/mod.rs:280`, `crates/cadence/src/recall/mod.rs:390`, `crates/cadence/src/recall/mod.rs:399`, `crates/cadence/src/recall/mod.rs:538`. |
| `SessionFactory::first_touch` | `crates/cadence/src/import/mod.rs:844`; context approval barrier precedes it at `crates/cadence/src/context_service.rs:81`. |
| Context exact replay | `crates/cadence/src/context_service.rs:63`, `crates/cadence/src/context_service.rs:109`; verifies installed context after matching saved approval. |
| `context::persistence::saved` | `crates/cadence/src/context/persistence.rs:38`; phase-keyed native approved record. |
| `context::persistence::read_snapshot` | `crates/cadence/src/context/persistence.rs:110`; read-only actual snapshot/JSONL validation. |
| Context publication semantic validation and operation digest | `crates/cadence/src/context/persistence.rs:78`, `crates/cadence/src/context/persistence.rs:101`. |
| `context::instructions::markdown` | `crates/cadence/src/context/instructions.rs:180`; compiled role begins at line 4. |
| `Snapshot.data`, `Snapshot.operations`, `Snapshot::parse` | `crates/cadence/src/store/model.rs:110`, `crates/cadence/src/store/model.rs:116`, `crates/cadence/src/store/model.rs:164`; operations hold string fingerprints, not allocation results. |
| `Store::open`, queued writer | `crates/cadence/src/store/writer.rs:139`, `crates/cadence/src/store/writer.rs:163`; ownership and recovery at line 283. |
| `Operation::ReadVerified`, `ObserveContext`, `CompareTransact` | `crates/cadence/src/store/writer.rs:81`, `crates/cadence/src/store/writer.rs:54`, `crates/cadence/src/store/writer.rs:87`. |
| `Writer::execute_store`; context participant restriction | `crates/cadence/src/store/writer.rs:458`, `crates/cadence/src/store/writer.rs:575`; one context participant with validated snapshot delta and config-only alternatives. |
| Replay before stale snapshot condition | `crates/cadence/src/store/writer.rs:513`, `crates/cadence/src/store/writer.rs:524`; existing generic receipt behavior is real. |
| `Writer::persist` / snapshot last / confirmed return | `crates/cadence/src/store/writer.rs:1287`, `crates/cadence/src/store/writer.rs:1306`, `crates/cadence/src/store/writer.rs:1313`. |
| `IntentKind::ContextPublication`, dispatch variants | `crates/cadence/src/store/transaction.rs:13`, `crates/cadence/src/store/transaction.rs:36`, `crates/cadence/src/store/transaction.rs:47`. |
| `ExternalChange`, `ExternalChange::validate` | `crates/cadence/src/store/transaction.rs:83`, `crates/cadence/src/store/transaction.rs:90`; expected-file checks exist for replacement. |
| `Intent`, `Intent::validate` | `crates/cadence/src/store/transaction.rs:134`, `crates/cadence/src/store/transaction.rs:150`; closed participant set, snapshot-last and semantic validation. |
| Existing context intent validation | `crates/cadence/src/store/transaction.rs:185`, `crates/cadence/src/store/transaction.rs:275`. |
| `commit`, `recover` | `crates/cadence/src/store/transaction.rs:835`, `crates/cadence/src/store/transaction.rs:927`; both validate intent, confirm installed bytes and remove intent. |
| `Filesystem::target`, `phase_context_target` | `crates/cadence/src/store/filesystem.rs:101`, `crates/cadence/src/store/filesystem.rs:205`; context maps to canonical phase CONTEXT path, not arbitrary document destinations. |
| `ensure_directory`, ancestor identity, ownership | `crates/cadence/src/store/filesystem.rs:171`, `crates/cadence/src/store/filesystem.rs:159`, `crates/cadence/src/store/filesystem.rs:234`; no symlink parents, inode/device checks and existing filesystem lock. |
| `Filesystem::read` | `crates/cadence/src/store/filesystem.rs:274`; binds context parents, checks ancestors and regular-file identity. |
| `prepare`, `install`, `confirm`, recovery sync | `crates/cadence/src/store/filesystem.rs:350`, `crates/cadence/src/store/filesystem.rs:388`, `crates/cadence/src/store/filesystem.rs:406`, `crates/cadence/src/store/filesystem.rs:416`; sync helpers at lines 83/92. |
| Strict execution frontmatter / `deny_unknown_fields` | `crates/cadence/src/execution/plan.rs:42`, `crates/cadence/src/execution/plan.rs:54`; mandatory execution block at line 50. |
| `execution::plan::parse_plan`, mismatch and canonical number validation | `crates/cadence/src/execution/plan.rs:91`, `crates/cadence/src/execution/plan.rs:141`, `crates/cadence/src/execution/plan.rs:296`. |
| Authored body preserved by native reader | `crates/cadence/src/execution/plan.rs:191`, `crates/cadence/src/execution/plan.rs:198`; CRLF delimiter handling and body slicing do not normalize body bytes. |
| Execution `query`, `observe_plans`, `plan_number`, `reobserve` | `crates/cadence/src/execution_service.rs:66`, `crates/cadence/src/execution_service.rs:1307`, `crates/cadence/src/execution_service.rs:1371`, `crates/cadence/src/execution_service.rs:1392`. |
| Mutable execution set / active dispatch return | `crates/cadence/src/execution_service.rs:211`, `crates/cadence/src/execution_service.rs:254`, `crates/cadence/src/execution_service.rs:379`. |
| `Writer::boundary_v1`, `BoundaryChange::Dispatch`, `Writer::admit_execution` | `crates/cadence/src/store/writer.rs:613`, `crates/cadence/src/store/writer.rs:736`, `crates/cadence/src/store/writer.rs:879`. |
| Dispatch intent validation paths | `crates/cadence/src/store/transaction.rs:254`, `crates/cadence/src/store/transaction.rs:565`, `crates/cadence/src/store/transaction.rs:656`. |
| `ExecutionOccurrence.plan_set_fingerprint`, phase-keyed map, active/outcomes/receipts | `crates/cadence/src/execution/model.rs:206`, `crates/cadence/src/execution/model.rs:218`; no permanent authoring occurrence identity. |
| `Cycle` is only Live/Closed | `crates/cadence/src/derivation/model.rs:15`. |
| `Client`, `approve`, `tree`, reopen reference | `crates/cadence/tests/phase11_context.rs:10`, `crates/cadence/tests/phase11_context.rs:228`, `crates/cadence/tests/phase11_context.rs:128`, `crates/cadence/tests/phase11_context.rs:391`; real binary starts at line 18, finishes at line 71. |
| MCP `Client`, `envelope`, `isolated_client` | `crates/cadence/tests/mcp.rs:25`, `crates/cadence/tests/mcp.rs:488`, `crates/cadence/tests/mcp.rs:498`; its caller inputs are reused only through the revised real setup; execution admission remains public. |
| Existing `skills/cad-plan/SKILL.md` | `skills/cad-plan/SKILL.md:5`, `skills/cad-plan/SKILL.md:28`, `skills/cad-plan/SKILL.md:35`; currently grants direct writing and loads frozen workflow/review instructions. P2 task 4 leases replacement. |
| Frozen plan `load_phase`, `spawn_planner`, `too_big`, `review` | `cadence-core/workflows/plan.md:70`, `cadence-core/workflows/plan.md:98`, `cadence-core/workflows/plan.md:245`, `cadence-core/workflows/plan.md:442`. Sequential shared-file splits are expressly supported at line 253. |
| Frozen gap steps 3/4 and lost-gap example | `cadence-core/workflows/plan-gaps.md:19`, `cadence-core/workflows/plan-gaps.md:30`, `cadence-core/workflows/plan-gaps.md:38`. |
| `planNumber`, `readPlanReports`, report path | `cadence-core/bin/planning/core.mjs:345`, `cadence-core/bin/planning/core.mjs:358`, `cadence-core/bin/planning/core.mjs:363`; bare PLAN maps to 1; old reader only visits supplied plans, so orphan-report inventory is explicitly new work. |
| Frozen PLAN template and prior phase shapes | `cadence-core/templates/PLAN.md:1`, `.planning/phases/10/PLAN-1.md:1`, `.planning/phases/10/PLAN-2.md:1`, `.planning/phases/11/PLAN.md:1`; implementation-plan shape, not native schema examples. |

Creation leases: crates/cadence/src/plan_service.rs, plan/mod.rs, plan/model.rs, plan/inventory.rs and plan/persistence.rs are created by P1 task 1 (P1:257); plan/render.rs and crates/cadence/tests/phase27_plan.rs by task 3 (P1:319); plan/validation.rs by task 4 (P1:363); plan/instructions.rs by P2 task 4 (P2:321). Plan-relative module paths in this sentence use crates/cadence/src/. None exists at HEAD. P2's other absent plan-domain/test paths are created by P1 first. Seven test function names are explicitly new specifications; new production names remain executor choices (P1:58; P2:53).

No cited existing symbol is missing, and no newly added citation claims a behavior its source does not provide. Session::commit_evidence really preserves import provenance, commits native history/projection and uses conditional generation/integrity checks (crates/cadence/src/import/mod.rs:578). The revised instructions do not mislabel direct-store seeding as that method.

**PASS:** all relied-on existing/new distinctions remain sound, including the additional setup seams.

## 5. Task ceiling, sequencing, file leases and phase scope

| Plan/task | Files anchor | Task file count | Outside plan frontmatter |
|---|---|---:|---|
| P1/1 | P1:254 | 8 | None |
| P1/2 | P1:291 | 4 | None |
| P1/3 | P1:317 | 9 | None |
| P1/4 | P1:362 | 6 | None |
| P1/5 | P1:383 | 6 | None |
| P1/6 | P1:407 | 7 | None |
| P2/1 | P2:220 | 7 | None |
| P2/2 | P2:255 | 7 | None |
| P2/3 | P2:289 | 6 | None |
| P2/4 | P2:320 | 5 | None |

Mechanical enumeration confirms P1 has six tasks and fifteen leased files; P2 has four tasks and thirteen leased files. Both remain within the supplied ceiling of eight per plan. Shared files are explicitly sequential, P1 then P2 (P1:438; P2:42,364). P2's replacement task precedes replay cases requiring a newer authorized revision (P2:383). Reading P2 Notes for the C1 fixture does not depend on implementing P2: the specified setup uses code already at HEAD.

All actions fit their source/test/skill leases. The added setup can live in the already-leased integration test and use the public library SessionFactory/Session APIs; it does not require editing import, policy or evidence source. Test writes target temporary projects. The generated host skill is leased. There is no planned dependency change (P2:412); existing dependencies already provide runtime, serialization, schema, hashing and temporary directories (crates/cadence/Cargo.toml:21,64), so no manifest/lockfile write is necessary. P1 task 4 can strengthen validation through its leased model/validation module used by publication semantics without requiring an unleased transaction edit.

No task combines unrelated work merely to meet the ceiling. The persistence task is one vertical publication transaction. There is no new self-policing apparatus, coverage target, acceptance-test multiplier or suite-valued task verify.

Exclusions still match CONTEXT:25: no typed evidence associations (28), check/link refusal implementation (29), native execution activation, task/check bindings or execution reconciliation (12), verdicts/status (13), truth revision (26), or selected review edits/handoff (30). Mandatory execution-shaped frontmatter is D-81's schema requirement and remains blocked by D-88. The compiled authoring front door does not port the deferred reviewer/checker workflow (P2:318,348). The added fixture gate/answer uses existing pre-acceptance continuation records in native_evidence; it is not phase 28's new typed evidence map.

**PASS:** ceiling, ordering, write leases and scope remain satisfied; the revision creates no new implementation dependency.

## 6. Remaining verifiability and claim limits

Each truth retains one test causing its trigger and observing its outcome, with substantive artifacts and explicit failure conditions. The red/green requirement remains future executor work; missing test targets or zero selected tests are not red evidence (P1:471). C5/C7 cannot pass their admission controls without the real execute-next dispatch and persisted admission; C1 cannot replace its required provisional-rule assertion with an unrelated prerequisite refusal (P1:117,128; P2:100,179,409).

O1 is intentionally pending and visible. It does not prevent this plan from being reviewable/executable, and this passing plan-check verdict does not make T1 or T7 met. A future verifier must record actual seen/not-seen evidence and apply the observation rules; a not-seen item yields unmet, and an accepted observation caps the truth at concerns (docs/architecture/acceptance.md:234). Host conduct and model plan quality remain knowingly outside automated checks (P1:479; P2:426).

**PASS:** B1 and W1 are resolved in the revised plan text under the supplied rulings. No remaining omission makes a truth unverifiable as planned, and no new BLOCKER or WARNING was found. Actual implementation, targeted check execution, artifact inspection and any live observation remain subsequent work.
