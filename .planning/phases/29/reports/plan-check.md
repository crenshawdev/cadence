VERIFICATION PASSED

Reviewed 2026-09-10 in `/code/cadence`, branch `cadence/binary-owns-process`, HEAD `b353f09dba50db20992bd39ae52b0b331168d2f0`. The reviewed PLAN.md is untracked. Its SHA-256 is `857b239686372426c569bc315c4c7b86086c778ecbc66bbeb8fa0a4091c96aef`. Relevant tracked source and the referenced phase-27/28 test files match HEAD. No Cargo command or mutating Git command was run. Only this report was written; no plan, source, historical fixture, reserved temporary root or lock was touched. The concurrent phase-12 analysis file was ignored.

The design, role contract and contexts were read in the requested order, and obligations were derived before reading the plan. Prior phase-27/28 reports were used for review shape, not as evidence that current code works. `P:n` below means `.planning/phases/29/PLAN.md:n`; all other paths are repository-relative unless absolute. Commands below were inspected, not executed.

## Findings by severity

- BLOCKER: 0.
- WARNING: 1.
- NOTE: 0.

### W1 — Define the Unicode character classes; distinguish interpretation from owner wording

**WARNING — `.planning/phases/29/PLAN.md:478` (Task 4), also :265.** Task 4 requires “Unicode-aware character boundaries as in the CONTEXT/draft's stated lexical rule.” The binding text at `.planning/phases/29/CONTEXT.md:123` specifies exact phrase matching and a “letter, digit or underscore” run, but does not explicitly say Unicode, identify character classes, or choose a character predicate. Unicode-aware matching is a reasonable interpretation of that unqualified wording, not an explicitly recorded owner choice. The plan still leaves an executor to choose what counts as a Unicode letter/digit; merely requiring non-ASCII cases does not settle that choice. This matters because different character classifications can change whether the same link is accepted.

**Suggested fix:** state the exact letter/digit/underscore predicate or character categories and the whitespace predicate used for comparison, identify the Unicode reading as an implementation interpretation of D-101, and supply handwritten discriminating examples inside C4. Keep exact case, internal whitespace and punctuation, individual-slot matching and all-association validation unchanged. Do not attribute a more specific rule to CONTEXT than it contains. This is a specification precision warning, not evidence of an incompatible policy or an inability to deliver T4; execution can proceed without a blocking redesign.

## Per-truth evidence table

Every check is one creation-leased function in `crates/cadence/tests/phase29_limits.rs`. The common contract requires exactly one selected test and `1 passed; 0 failed`, with zero selections treated as failure (P:58, P:115). “COMMIT” and “INSTRUCTIONS” below are the shared artifact items, not extra checks.

| Truth | Its one check | Other items | Command |
|---|---|---|---|
| T1 — commandless check refused with its identity | P29-T1-C; `phase29_check_without_command_is_refused` (P:120) | P29-T1-A (P:149), P29-A-COMMIT (P:307), P29-A-INSTRUCTIONS (P:331) | `cargo test -p cadence --test phase29_limits phase29_check_without_command_is_refused -- --exact` (P:144, P:398) |
| T2 — check without expected output refused with its identity | P29-T2-C; `phase29_check_without_expected_output_is_refused` (P:160) | P29-T2-A (P:186), COMMIT, INSTRUCTIONS, P29-O1 (P:343) | `cargo test -p cadence --test phase29_limits phase29_check_without_expected_output_is_refused -- --exact` (P:182, P:422) |
| T3 — phase-wide distinct-check conflict identifies truth and checks | P29-T3-C; `phase29_distinct_checks_across_plans_are_refused` (P:196) | P29-T3-A (P:236), COMMIT, INSTRUCTIONS | `cargo test -p cadence --test phase29_limits phase29_distinct_checks_across_plans_are_refused -- --exact` (P:231, P:453) |
| T4 — link value absent from an associated current truth refused with link identity | P29-T4-C; `phase29_link_value_absent_from_truth_is_refused` (P:247) | P29-T4-A (P:290), COMMIT, INSTRUCTIONS, same P29-O1 | `cargo test -p cadence --test phase29_limits phase29_link_value_absent_from_truth_is_refused -- --exact` (P:284, P:488) |

## Independent goal-backward obligations

Before opening PLAN.md, the following obligations were derived from the design and locked contexts:

1. Missing or malformed check command/output must be located before decoding loses identity, and the same identified refusal must reach complete preview and independently approved publication.
2. Typed blank commands and literal/property values must refuse, while any nonblank authored text remains admissible without command execution or extra check-content policy.
3. Exactly one distinct check id must remain per current full truth id/version across the post-replacement union; a conflict must retain every saved/proposed plan origin.
4. Each link must have nonblank endpoints/value and its comparison value must match inside one approved slot of every associated current truth; unresolved authority must be distinguished from lexical absence.
5. Fresh attached validation must include untouched current contributions and run on the committing snapshot, while retaining exact approval, old records, historical replay, read-only readback, provisional authoring and the execution-admission refusal.

These follow from `docs/architecture/acceptance.md:147`, :166, :207, :224 and :253; `.planning/phases/29/CONTEXT.md:18`, :67 and :93; and the carried decisions in phases 27/28. Tasks 1–4 implement the corresponding domain/public-boundary work; Task 5 delivers the compiled guidance required by the scope at `.planning/phases/29/CONTEXT.md:27`.

## 1. Design refusals and evidence discipline

The requirements frontmatter names exactly T1–T4 (P:4), and the four truth sentences match the approved context (P:31; `.planning/phases/29/CONTEXT.md:57`). Enumeration finds four checks, six artifacts and one observation, each with explicit truth attachment. There is no orphan item, uncovered truth, second check or per-function acceptance expansion. Each check supplies a file/function, setup, public call, handwritten expected result, command and failure reason (P:120, P:160, P:196, P:247).

The no-link claim is correct (P:62). T1/T2 name identified refusals, T3 names a conflict and its identities, and T4 names refusal of a submitted link value. None states that a particular value is handed from one collaborator to another. T4's caller-submitted links are inputs to its one check, not implementation-map link evidence. Adding link tests per internal seam would violate the Planner block (`docs/architecture/acceptance.md:331`).

P29-O1 has exactly the T2/T4 associations, explicit specification source/date, and “Pending; not yet seen” (P:343–358). It supplies no fabricated observer, observed date or outcome and never substitutes for C2/C4. Its future accepted observation caps those truths at concerns; an unobserved item does not make them met (`docs/architecture/acceptance.md:230`). The plan-check verdict certifies neither the observation nor the completed phase.

Task 5's `plan-instructions` invocation is one binary emitting an artifact for substantive inspection, not a fifth acceptance check (P:520). The whole suite appears only in the executor's plan-close instruction, not in any task Verify or verifier command (P:591). Phase-12 red/green APIs and phase-13 verdict gates are not implemented here; writing these four tests red first is the executor discipline already required by the design.

## 2. Real boundaries, controls and durable assertions

The common setup is concrete and shared by all four checks (P:66–116): a real temporary project, isolated global configuration, actual `CARGO_BIN_EXE_cadence serve` over initialized stdio MCP, and real approved `context-submit` authoring before plan publication. It explicitly adapts the phase-28 helper to accept handwritten slots, rather than inheriting its fixed parcel truth. Existing patterns are real: `Client::open` at `crates/cadence/tests/phase28_evidence.rs:22`, `approve` at :92, `fixture` at :98, `native_context` at :117 and `reopened` at :186.

Both complete preview and independently approved publication are mandatory. A preview refusal must not short-circuit publication (P:82). For direct publication the plan requires a canonical section and exact approval/replacement copies while forbidding unrelated invalid setup from masking the intended rule (P:85–91). This is achievable without using the renderer as the oracle: the existing section grammar is explicit at `crates/cadence/src/plan/render.rs:79`, and publication compares approved body bytes with the normalized section at :5. The helper must respect that typed serialization grammar when hand-assembling the section; pretty-printing an arbitrarily ordered raw object is not itself the specified canonical grammar.

After each refused call the server must exit and be reaped. The complete planning tree, snapshot and both JSONL streams are reopened and compared with the saved baseline; journal absence precedes opening the real Store/Filesystem (P:93–106). Final assertions inspect winner bytes, receipts, map revisions and allocations, not just the response or counts. A valid installed baseline prevents a fresh Store open from being confused with refusal-side creation. No direct store seeding, fabricated native context or captured historical fixture is authorized (P:108–113).

| Check | Direction in which it can fail and controls that prevent a vacuous pass |
|---|---|
| C1 (P:124–141) | Missing/null/wrong-shape cases require the promised rule/id/path, and typed empty/whitespace cases fail if a blank command is accepted. Nonzero positions catch hard-coded location. Nonexistent custom commands, broad commands and whitespace-preserving strings must publish; a sentinel command must not run. Blank auxiliary check fields and draft/allocation controls prevent an overbroad gate from passing. |
| C2 (P:163–179) | Both expected tags exercise malformed container/tag/value and blank value cases, so accepting an empty oracle fails. Valid literal/property and whitespace-preserving controls must publish. Exact field paths distinguish generic decode failure from the promised identified refusal. |
| C3 (P:198–228) | A saved check and differently named proposed check with identical specs must refuse. Per-plan counting, spec-based equality or publishing the second check fails. Additional cases exercise all origins, more than two ids, aliases and stable order. Shared single-check, separate-truth and coordinated-replacement controls prevent blanket refusal. Historical replay and changed-current-winner controls reject stale authority and historical counting. |
| C4 (P:249–281) | `invoice` and embedded `arc` against the approved parcel slot must refuse; accepting an unnamed/embedded value fails. Exact parcel, padded parcel, observer/outcome-only matches and a later valid occurrence must publish. Case/space/punctuation, cross-slot and second-association negatives prevent substring/prose/first-association shortcuts. Nonblank endpoints need not occur in truth text. W1 qualifies only the character-class precision. |

Each is explicitly ONE test function containing its cases and controls (P:58), selected by its matching `--test phase29_limits ... -- --exact` Verify. These functions and the target file do not yet exist; their existence and actual one-test output must be verified during execution. No command was run to claim that output now.

## 3. Decisions, public diagnostics and history

| Decision | Delivering tasks and assessment |
|---|---|
| D-99 (`CONTEXT.md:93`) | Task 2 (P:411–421), C2 and T2-A preserve the existing literal/property tag and require nonblank value only. Blank never means silence; property text is retained without evaluation. Task 5 advertises it. |
| D-100 (:104) | Task 1 (P:384–390), C1 and Task 5 enforce only nonblank command text. No runner parsing, file-existence check, execution or narrow-command gate is added. |
| D-101 (:115) | Task 4 (P:466–487), C4 and T4-A use current full id/version and retained approved slots, exact case/internal whitespace/punctuation, outer trim for comparison only, one slot, every association, nonblank endpoints, and a separate unresolved-authority refusal. Unicode classification remains W1; no semantic-necessity claim is added. |
| D-102 (:142) | Tasks 1/2/4 locate raw structural failures before decoding on both public entrypoints; domain rules flow through candidate/contribute and transaction revalidation. Task 1 explicitly preserves draft/allocation/replay behavior and strict schema. Task 3 retains stale-snapshot conflicts. |
| D-103 (:157) | Task 3 (P:435–452) plus Notes (P:533–555) specify the complete distinct-id conflict, every origin, stable ordering and saved/proposed labels, with structured detail beside the standard diagnostic. |
| D-104 (:170) | Tasks 1–4 extend phase-28 seams, preserve existing membership/version/definition/lower-bound validation and add the upper bound only afterward (P:436–444). These are four new promises, not a re-truthing of phase 28. |
| D-105 (:179) | Tasks 1–4 and COMMIT (P:307) inspect all post-replacement current contributions for a fresh attached submission, retain historical deserialization and replay, and allow correction in one approved replacement batch. Task 5 explains correction/history without certifying replay. |
| D-106 (:192) | Task 1 adds location fidelity for already malformed auxiliary fields only (P:380); Task 2 expressly forbids nonblank/semantic rules on locator/setup/call/boundary/fakes (P:418). C1's blank auxiliary strings/empty fakes are legal controls (P:138). No phase-12 subject-stub/test-existence gate appears. |

The decision references in that table are to `.planning/phases/29/CONTEXT.md`.

**Located diagnostics on both paths.** At HEAD, submit decodes at `crates/cadence/src/plan_service.rs:118` and returns an unlocated `submission` reason at :123. Preview decodes `QueryArguments` at `crates/cadence/src/server.rs:634` and collapses failure to `arguments` at :654. Task 1 leases both locations and requires shared raw item/path handling before information loss, preserving `malformed_version` and strict `QueryArguments`; Tasks 2/4 extend it for expected/link fields (P:374–383, P:413, P:468). C1/C2 require matching ids and exact submission paths on both paths; Notes also locate malformed approval/replacement copies under their actual paths without blaming a valid primary submission (P:560). A post-decode domain-only validator would not satisfy these instructions.

**D-103 wire compatibility.** `crates/cadence/src/plan/model.rs:132` currently aliases the context answer, whose refusal has one `id` and no detail slot (`crates/cadence/src/context/model.rs:119`). The plan explicitly recognizes this and requires its own compatible plan answer, preserving standard fields and schemas rather than editing the shared context type (P:445). `Diagnostic` currently has only rule/slot/phase/entry/id/reason (`crates/cadence/src/plan/model.rs:156`). The proposed optional `details` is therefore an explicit new wire design, not a claim that a second-id field exists.

The requested conflict shape is coherent: standard `id` is the full truth id and `slot` is `submission.plans`; `details` contains `truth_id`, current `truth_version`, and distinct `checks[].id` with every `origins[]` entry `{phase, plan, source, slot}` (P:539–550). The reason repeats the full conflict for human readers. Existing candidate provenance is sufficient: `Contribution.plan` plus `entry: None/Some` distinguishes saved/proposed; per-item positions supply exact paths (`crates/cadence/src/plan/associations.rs:35`, :56, :61, :76). Deduplicating ids while retaining origins implements aliases without losing provenance. Sorted ids and numeric origin positions settle output order independently of traversal; reordered inputs may legitimately change their location paths.

All existing `Diagnostic` construction sites are in model, associations, persistence and plan_service, which Task 3 leases. Other consumers already refer to the plan's `Answer` type: server output variants at `crates/cadence/src/server.rs:294` and :306; resident reply/result at `crates/cadence/src/recall/mod.rs:209` and :557; map readback at `crates/cadence/src/plan/map_view.rs:12`; validation at `crates/cadence/src/plan/validation.rs:2`. They do not force an unleased shared-context or resident edit. Derived server output schemas can advertise the new plan refusal detail through the new plan type. No receipt/publication/map schema change is required.

**D-105 reaches saved contributions without rewriting history.** `candidate` excludes every replaced publication before loading untouched current maps from retained history, then adds proposed attached maps (`crates/cadence/src/plan/associations.rs:41–64`). `validate` receives the same snapshot and current context (:132). Task 1 restricts new content policy to a fresh batch containing an attached map and explicitly keeps it out of deserialization (P:384–389); Tasks 2–4 extend that same path. `validate_candidate` calls association validation (`crates/cadence/src/plan/persistence.rs:207`), `contribute` replays first and otherwise calls it (:96–101), and `validate_publication` recomputes the exact contribution from the prior snapshot (:271). The writer and intent both call that algebra. Thus neither a preapproval lookup nor a previously passing preview is the sole authority.

Retention/readback seams support the required distinction: map-history deserialization has no new policy gate (`crates/cadence/src/plan/map_history.rs:55`), new publications append revisions and supersession relations (:84–107), and map readback observes files without ownership/recovery (`crates/cadence/src/plan/map_view.rs:46`). Historical replay returns the retained result before fresh validation (`crates/cadence/src/plan/persistence.rs:79`, :96; `crates/cadence/src/plan_service.rs:125`) and reports current projection state separately (:301). COMMIT explicitly requires inspection of saved maps legal only under pre-29 policy and unresolved-slot branches, without claiming a captured-old-binary runtime experiment (P:327, P:568). These are substantive artifact obligations allowed by the design, not missing fifth/sixth checks or fabricated public test setups.

**Carried decisions remain binding.** D-90 gets the existing lower bound plus Task 3's upper bound; observations remain supplementary. D-91/D-82 retain one typed-map/plan publication and canonical section; D-92/D-93 retain opaque ids, shared definitions and post-replacement union. D-94 retains current native membership/version before lexical resolution. D-95 readback remains authoritative and read-only. D-96 keeps structural field grammar/provenance; D-97 retains old maps and explicit provisional replacements; D-98/D-86 retain exact payload-bound historical replay and conditional publication. D-83/D-84 keep exact approval/replacement authorization; D-88 remains a mechanical refusal at `crates/cadence/src/plan/persistence.rs:40`, including intent admission at `crates/cadence/src/store/transaction.rs:322`. No task activates native execution or edits truths. Relevant plan preservation instructions are P:43–47, P:389, P:420, P:443–452 and P:509–515.

## 4. Existing seams and creation leases

| Cited seam | Verified HEAD anchor and meaning |
|---|---|
| `Contribution`, `candidate` | `crates/cadence/src/plan/associations.rs:35`, :41; provenance-bearing union after removal of replaced current contributions. |
| `validate`, `validate_items`, `malformed_version` | Same file :132, :71, :9; current context/membership/definition/lower-bound validation and pre-decode numeric location. No existing blank/upper-bound/lexical gate is claimed. |
| `validate_candidate`, `contribute`, `validate_publication`, `replay` | `crates/cadence/src/plan/persistence.rs:188`, :90, :241, :79; preview candidate validation, exact approved contribution, commit/recovery recomputation, receipt-first replay. |
| `execute`, `path_error` | `crates/cadence/src/plan_service.rs:19`, :329; public service and located diagnostic extraction. |
| `QueryArguments`, `PublicServer::call_tool` | `crates/cadence/src/server.rs:238`, :585 (trait implementation starts :549); strict typed query grammar and raw public dispatch. Apply plan routing is at :828. |
| `Writer::execute_store` | `crates/cadence/src/store/writer.rs:463`; plan publication validation at :653 against the writer's current snapshot. |
| `Intent::validate` | `crates/cadence/src/store/transaction.rs:154`; retained plan participant algebra at :312. |
| `ApprovedContext.submission.truths`, `TruthSlots` | `crates/cadence/src/context/model.rs:95`, :45, :8; retained authored slots coexist with derived `Truth` at :84. Slots do not carry a separate numeric version: current derived membership/version is checked, then the matching approved slot id resolved. |
| `context::persistence::saved` | `crates/cadence/src/context/persistence.rs:38`; loads the native approved context by phase. Version 1 is authored at :23. |
| `Answer`, `ok`, `refused`, `Diagnostic` | `crates/cadence/src/plan/model.rs:132`, :134, :138, :156; the answer is currently an alias, correctly scheduled for replacement, and Diagnostic is a located one-id record. |
| `Check`, `Expected`, `Link` | `crates/cadence/src/plan/evidence.rs:51`, :63, :84; strict shapes, tagged literal/property, no nonblank spec policy at HEAD. |
| `map_history`, `map_view` | `crates/cadence/src/plan/map_history.rs:44`, :55, :76; `crates/cadence/src/plan/map_view.rs:49`; immutable payload retention, supersession view and authoritative readback. |
| `ROLE`, `markdown`, `plan-instructions` | `crates/cadence/src/plan/instructions.rs:2`, :349; `crates/cadence/src/main.rs:36`, :52. Existing project-free compiled artifact emission; public descriptions at `crates/cadence/src/server.rs:570`, :575. |
| Phase-28 setup/reopen/proposal helpers | `crates/cadence/tests/phase28_evidence.rs:15`, :92, :98, :117, :144, :154, :186, :606, :616, :627. All named helpers exist. The parcel link is at :600 and its native approved slots at :124. |
| Phase-27 test Git helper | `crates/cadence/tests/phase27_plan.rs:193`; the plan's instruction concerns future test-side Git, not this read-only review. |

The Error::Display claim is correct, not a speculative seam: `crates/cadence/src/store/mod.rs:19–22` prints Debug representation. `Diagnostic::error` puts `plan-refusal:` at the start of an Invalid payload (`crates/cadence/src/plan/model.rs:166`), while `path_error` strips that prefix directly from an Invalid/Conflict payload (`crates/cadence/src/plan_service.rs:330`). Writer :660 and transaction :319 wrap `e.to_string()` in another error; the resulting payload starts with a Debug wrapper instead of the prefix. Task 1's instruction to preserve the original diagnostic payload through those plan branches is necessary, and expressly preserves ordinary error dispositions (P:391–395). It does not require modifying global Error::Display or parsing arbitrary nested text.

Only the two expected new files are absent: `crates/cadence/src/plan/limits.rs` and `crates/cadence/tests/phase29_limits.rs`. Both have explicit creation leases at P:364 and P:371; the four new test names are explicitly creation specifications at P:58. All other frontmatter paths exist. New wire choices are expressly delegated by D-103 and identified as new choices, not invented existing Rust symbols (P:533). No falsely cited existing function or incorrect code-line claim was found.

## 5. Task completeness, sequencing, proportionality and scope

There are five sequential tasks, below the ceiling of eight (P:360, P:530). The shared validator, service/server and test files make sequential execution appropriate. Task 1 creates the shared raw/domain location path; Task 2 extends expected content; Task 3 adds aggregation and plan answer detail; Task 4 uses that detail for lexical refusals; Task 5 updates compiled instructions and regenerates the skill. Each Action has a falsifiable narrow Verify and substantive artifact obligations. No split plan or dependency on concurrently written phase-12 material exists.

| Task | Files listed | Lease assessment |
|---|---:|---|
| 1 (P:364) | 8 | Complete. The writer/transaction edits are justified error propagation, not an unnecessarily broad lease. New module registration is leased. |
| 2 (P:406) | 5 | Complete for the expected-content and shared located decoder extension. |
| 3 (P:429) | 6 | Complete for the new plan answer/Diagnostic and every existing Diagnostic construction site; already typed consumers need no forced write. |
| 4 (P:460) | 6 | Complete for approved-slot lookup, lexical limits and public diagnostics. Context files are read dependencies, not required writes. |
| 5 (P:497) | 3 | Complete for compiled role, public descriptions and generated skill output. The existing CLI emits stdout; its output can be written to the leased skill without editing main.rs. |

All task paths are included in the plan frontmatter (P:5–17). No dependency addition is required or planned, so no manifest/lockfile lease is missing (P:583). The four checks group cases of their truth rather than merging unrelated production concerns to evade the ceiling. Temporary projects and test helpers exercise existing public boundaries; no migration, capture/restore apparatus, separate writer, self-policing tool or acceptance multiplier is introduced.

The parked command-selection gate stays parked (P:388, P:509; `.planning/phases/29/CONTEXT.md:76`). Narrow commands are instructions to executor/verifier, not a production runner grammar. Phases 12 (bindings, receipts, subject-stub gate, activation), 13 (verdict/status/waivers), 26 (truth revision) and 30 (review handoff/selected edits) remain excluded (P:47, P:512–515). Existing execution-shaped plan content used in real fixtures is required phase-27 grammar, not new acceptance-aware execution.

## 6. Verdict limits

No blocking omission makes T1–T4 unverifiable as planned. Each has one real-boundary test with both public paths, handwritten outcomes, failure-capable controls and reopened durable assertions, plus inspectable implementation artifacts. W1 should be resolved to prevent character-class interpretation from drifting during Task 4. This passing verdict means the plan can deliver the goal; it is not a build/test result, a claim that historical-policy branches were exercised at runtime, or a seen result for O1.
