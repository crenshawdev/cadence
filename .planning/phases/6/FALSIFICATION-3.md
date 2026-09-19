# Phase 6: Prerequisite repair falsification

Gathered: 2026-09-07
Code inspected: `2aa77d6422bce52c97943976e50814cfe363b6f9`
Plan inspected and corrected: `.planning/phases/6/PLAN-3.md`

This is a planning pass against the actual current code, including everything
PLAN-1 landed. It does not execute PLAN-3. The initial working tree was clean.
Only PLAN-3 and this document were written. No production code, test code or
file under `crates/` was changed.

## Method and result

Short Rust source citations below are relative to `crates/cadence/src/`.

Each of PLAN-3's eight M bullets and six Verify clauses was challenged against
the source. `FALSE` means current behavior contradicts the criterion or the
required production/test path is absent. `UNVERIFIABLE` means prospective
regression preservation, cross-format behavior or an unresolved decision cannot
be established from this tree. These are classifications at the inspected
HEAD, not failed test executions or predictions that the final implementation
must fail. A partly existing compound criterion is not marked satisfied.

Result: 11 FALSE and 3 UNVERIFIABLE across all 14 criteria. The corrections
below make checks more precise; they do not turn an unimplemented criterion
into evidence. Flag A remains an explicit compatibility checkpoint. No Cargo,
clippy, TypeScript, Node, host or model run was performed during this pass.

The earlier pass inspected `c8a266d8`, before execution modules existed
(`.planning/phases/6/FALSIFICATION.md:4`, `:24`). PLAN-1 subsequently built them
and recorded its results (`.planning/phases/6/reports/plan-1.md:6`). Its current
store and restart tests are real baseline coverage; citing the earlier absence
of execution machinery would now be false. Commit `2aa77d64` and the checkpoint
at `.planning/phases/6/reports/plan-2.md:12` were read, then every cited defect
was checked in the source rather than taken on report.

## Completion-bullet audit

**M1 - FALSE.** `ExecutorPatch` derives Serialize and Deserialize only
(`crates/cadence/src/execution/model.rs:226`). Its reachable evidence/task/
receipt types likewise lack JsonSchema (`:75`, `:82`, `:97`, `:121`).
`parse_executor_patch` deserializes that exact type
(`crates/cadence/src/execution/patch.rs:51`), but `patch_schema()` parses
`PATCH_SCHEMA_JSON` (`crates/cadence/src/execution_service.rs:1102`), and
`render_prompt` inserts it (`:1096`). Existing JsonSchema use in
`crates/cadence/src/envelope.rs:15` and `crates/cadence/src/server.rs:62` proves
the dependency is already available, not that the patch uses it. A generated
schema compared to a retained handwritten producer would leave M1 false.

**M2 - FALSE.** Query phase zero returns before checked derivation/session
acquisition (`crates/cadence/src/execution_service.rs:105`); apply does the same
at `:699`. The private refusal function requires phase at `:1457`.
`BoundaryDecision.phase: u32` at
`crates/cadence/src/execution/model.rs:249` cannot represent missing identity;
the type itself still permits numeric zero. Actual zero rejection occurs at
`crates/cadence/src/store/writer.rs:770`,
`crates/cadence/src/store/model.rs:229` and
`crates/cadence/src/store/transaction.rs:119`. The resident has only typed
execution query/apply requests (`crates/cadence/src/recall/mod.rs:221`). The
existing refusal-preservation test uses phase 6, not a missing phase
(`crates/cadence/tests/execution_store.rs:348`, `:101`). Thus existing scoped
preservation is evidence for a regression obligation, not durable malformed
argument support.

**M3 - FALSE.** The writer counts nonterminal `Decision::Boundary` records by
phase (`crates/cadence/src/store/writer.rs:642`) and finds a terminal by phase
at `:830`. There is no root bucket. The current bound test proves 256 plus one
and fixed log bytes through the store API
(`crates/cadence/tests/execution_store.rs:568`, `:640`), but tests no root
scope and no returned service envelope. On observation success the service
returns the original candidate, discarding the terminal in the returned view
(`crates/cadence/src/execution_service.rs:1501`). A bounded disk log alone does
not prove bounded, correct replies. Unsafe reads must remain failures rather
than forcing terminal success past store revalidation (`store/writer.rs:745`).

**M4 - FALSE.** `Response` has an `outcome` tag and a phase-bearing refusal
(`crates/cadence/src/execution_service.rs:42`), whereas the public envelope has
`status` and only code/reason in its non-success arms
(`crates/cadence/src/envelope.rs:40`). The service hashes the former at
`execution_service.rs:1452`. `terminal_record` reuses the hash of the string
`execution-log-bound:{phase}` as response digest
(`crates/cadence/src/store/writer.rs:804`, `:822`). `store_refusal` converts a
write failure into another normal `Response::Refused`
(`crates/cadence/src/execution_service.rs:1514`), and queue closure does the
same (`crates/cadence/src/recall/mod.rs:584`). Current decisions validate only
digest syntax (`crates/cadence/src/store/model.rs:233`), not correspondence to
the actual returned envelope. Version remains a side-effect-free diagnostic
(`crates/cadence/src/server.rs:194`); preserve that existing behavior.

**M5 - FALSE.** The pure patch replay receipt retains a request digest and
outcome (`crates/cadence/src/execution/model.rs:185`), and replay returns it
without a second application (`crates/cadence/src/execution/patch.rs:82`). But
the service then computes next-plan/complete from `application.data`, which
on replay is the current snapshot (`execution/patch.rs:90`;
`execution_service.rs:966`, `:975`, `:990`). After subsequent work, that may
differ from the first reply. No persisted canonical public receipt can settle
which answer to return. Existing restart tests replay immediately after the
lost apply (`crates/cadence/src/execution_service_tests.rs:815`), without
intervening plan completion. A confirmed terminal can also be obscured by an
existing dispatch/receipt passing membership checks
(`crates/cadence/src/execution_service.rs:395`, `:1022`). Dispatch reconstructs
the current prompt and checks only its recorded length at `:1062`; unchanged
input and same-format restart coverage is not cross-format proof.

**M6 - UNVERIFIABLE.** The current reader understands its own version-1
records and snapshots (`crates/cadence/src/store/model.rs:8`, `:143`, `:252`).
No new-format record or compatibility test exists. More critically, snapshot
integrity hashes typed reserialization (`:136`), and intent integrity hashes
its typed kind and participants
(`crates/cadence/src/store/transaction.rs:75`). Adding defaulted fields that
serialize can invalidate a valid old checksum. Old response hashes cannot be
inverted into missing response data, and old dispatches lack renderer version
(`crates/cadence/src/execution/model.rs:56`, `:248`). Old operation
fingerprints include the decision (`crates/cadence/src/store/writer.rs:423`,
`:495`); swapping digest formats under the same operation ID conflicts at
`:619`. Flag A cannot be settled by claiming Serde backward compatibility or
passing a fixture containing no execution history.

**M7 - FALSE for the added formats; existing recovery is present.** The
production writer recovers before opening its view
(`crates/cadence/src/store/writer.rs:200`), validates all participants before
replacement (`crates/cadence/src/store/transaction.rs:217`), installs durable
intent before semantic files (`:302`), makes state final and includes intent
removal in completion (`:320`), and resyncs already-installed participants on
recovery (`:340`). These are preserved foundations. The intent enum only
admits store and phase-scoped execution variants (`:11`), with positive-phase
checks (`:119`) and generation-matching phase decisions (`:184`). It cannot
recover a root refusal or distinguish new envelope receipt encoding. Current
kill tests cover old dispatch/patch behavior
(`crates/cadence/src/execution_service_tests.rs:750`, `:796`, `:846`), not the
new root, digest and terminal paths. A process kill also cannot establish
hardware power-loss durability, a distinction already recorded in phase 3
(`.planning/phases/3/CONTEXT.md:74`).

**M8 - UNVERIFIABLE as a future-diff claim.** The existing public server still
registers only `cadence_version` (`crates/cadence/src/server.rs:186`), and the
wire test asserts exactly one (`crates/cadence/tests/mcp.rs:153`). Main already
dispatches the Rust guard (`crates/cadence/src/main.rs:34`). Phase 4's memo
boundary remains explicit at `.planning/phases/4/CONTEXT.md:79`, and phase 5
requires acknowledged, provenance-preserving store writes at
`.planning/phases/5/CONTEXT.md:217`. Preserving these through future store
edits needs the full regressions and final lease diff. The new plan explicitly
lists all D decisions and keeps Flag A unresolved; this planning pass cannot
certify a future implementation's preservation or any live behavior.

## Verify-clause audit

**V1 - FALSE.** The named library and binary targets exist, but the current
producer is still the handwritten string
(`crates/cadence/src/execution_service.rs:1102`). A generated-schema
required-key/reference matrix is not present. Existing semantic tests for
failed verification and absent evidence are in
`crates/cadence/src/execution/patch.rs:747`, not solely in `execution::tests`.
The corrected command includes all `execution::` library tests. All variant,
nested field, prompt-schema and negative semantic parts must actually run;
finding a schema function or passing only older tests is insufficient.

**V2 - FALSE.** No `execution::boundary` module is exported
(`crates/cadence/src/execution/mod.rs:1`). Existing envelope tests check tags,
round trips and successful refusal transport
(`crates/cadence/src/envelope.rs:87`, `:134`, `:158`), not canonical ordering,
byte encoding, digest preimages, size limits or pre-persistence public
conversion. `request_digest` serializes its argument directly
(`crates/cadence/src/execution_service.rs:1431`); its reuse on internal
Response is the defect. Running a nonexistent filter can report zero tests
successfully; the inventory must reject that. A second call to the same
production conversion cannot be the expected-answer oracle.

**V3 - FALSE.** The current store fixture's supposed response digest is the
hash of another string (`crates/cadence/tests/execution_store.rs:108`). The
bound case asserts disk count, ID and byte stability at `:613` and `:640`,
without hashing any public envelope. Root scope, independently computed
response digests, scope-isolation cases and mixed new/old format cases cannot
run yet. Existing negative summary fixtures are useful
(`crates/cadence/tests/execution_store.rs:407`), but do not cover root/config
participant exclusion or new receipt/generation identity. Record validation
currently allows sequential revisions in general
(`crates/cadence/src/store/model.rs:252`); the new immutable boundary contract
needs explicit duplicate/second-terminal tests, not only a counter check.

**V4 - FALSE.** Server entry points require typed phase and patch
(`crates/cadence/src/server.rs:150`, `:158`), and the resident has no raw-data
refusal request (`crates/cadence/src/recall/mod.rs:221`). Checked derivation can
return before session acquisition (`crates/cadence/src/execution_service.rs:108`,
`:702`); neither malformed argument nor those errors necessarily reach a log.
Store failure and resident closure still look like ordinary refusals
(`execution_service.rs:1514`; `recall/mod.rs:584`). Terminal propagation is
broken both where views are ignored and where unrelated membership can pass
(`execution_service.rs:1501`, `:395`, `:1022`). Real-Git and continuation tests
already exist (`execution_service_tests.rs:343`, `:400`, `:436`) and must be
retained. This Verify proves the new internal persistence seam using typed
validation failures; proving the future raw parser here would either be
unverifiable or take PLAN-2's work into this lease.

**V5 - FALSE for the repair; Flag A also remains UNVERIFIABLE.** Existing
child-process barriers and kills are real
(`crates/cadence/src/execution_service_tests.rs:581`, `:691`), and old SUMMARY
repair is exercised at `:846`. No cross-format compatibility target, root
refusal child or new-envelope lost-reply/digest check exists. The initial
Verify overpromised recovery-resync injection on the intent: actual recovery
resyncs only semantic participants
(`crates/cadence/src/store/transaction.rs:337`), then removes the intent at
`:358`. Intent removal's directory sync can fail
(`crates/cadence/src/store/filesystem.rs:289`). A failed intent confirmation
also does not prove no intent was installed (`store/transaction.rs:302`).
The corrected clause separates these stages and tests each real failure
boundary. Read-compatible old bytes, mixed histories, all applicable kill/sync
stages, foreign participant conflicts, and absence of acknowledged failures
remain independent required cases, not consequences of a single reopen test.

**V6 - UNVERIFIABLE until the implementation exists.** The supplied current
baseline is 299 workspace tests passed, zero failed, clippy and TypeScript
exit 0. PLAN-1 records the matching workspace baseline at
`.planning/phases/6/reports/plan-1.md:18`; these results were not repeated here.
Its executable inventory exists at
`crates/cadence/src/execution_service_tests.rs:884`, but contains no repair
evidence. Full regression, formatting, typecheck, new inventory execution and
implementation-lease checks must be measured after the change. The existing
syscall test explicitly requires Linux and working tracing
(`crates/cadence/tests/store_crash.rs:488`); do not convert a future tracing
failure into skipped durability evidence. The frozen diff is empty during
planning, but that is no prospective pass. Neither this Verify nor a green
Cargo run can decide Flag A or complete PLAN-2's public/live obligations.

## Corrections made to the draft

1. **Restricted immutable replay to checked inputs.** M5 initially promised
   the original answer unconditionally. The service reobserves inputs before
   returning (`crates/cadence/src/execution_service.rs:316`, `:633`), as phase 4
   D-07 requires (`.planning/phases/4/CONTEXT.md:214`). M5 now distinguishes
   immutable replay when revalidation permits it from a new non-success when
   controlling inputs change. Stale success cannot masquerade as durability.

2. **Put terminal lookup ahead of semantic recomputation, after safe store
   access.** The draft selected the writer's terminal before membership tests
   but did not explicitly order early lifecycle/plan/Git observations. Current
   query begins with checked derivation (`execution_service.rs:108`), and
   current observation returns its own answer (`:1501`). Task 4 now performs
   safe scope/terminal lookup first, and M3 retains the unsafe-store exception.
   Policy/config failure still cannot be converted into successful replay
   (`crates/cadence/src/import/mod.rs:402`).

3. **Prevented the refusal tests from certifying an unimplemented parser.**
   The first V4 list of malformed raw values could be read as a raw argument
   classification test. Existing APIs only accept typed input
   (`crates/cadence/src/recall/mod.rs:221`). V4 now explicitly supplies typed
   validation failures plus raw data to the new persistence entry point, with
   separate phase-zero and dispatch-lookup tests. Raw dispatch/parser and MCP
   mirroring tests remain in unchanged PLAN-2.

4. **Corrected the schema test filter and separated syntax from acceptance.**
   The first V1 filter covered `execution::tests` but omitted the semantic
   negatives in `execution/patch.rs:747`. It now covers `execution::`. The
   schema is generated from the actual Deserialize types; failed verification
   is representable (`execution/model.rs:77`) but refused semantically. The
   test cannot demand the generated structural schema alone prove Git facts
   or dispatch-specific acceptance.

5. **Made size limits preserve facts.** The first draft stated two byte limits
   without defining an oversized payload's disposition. Judgment-stop blocker
   IDs have no length bound in `execution/patch.rs:447`. The final contract
   truncates only binary-owned reason text before hashing, preserves all IDs
   and judgment, and refuses an oversized candidate before execution mutation.
   Task 2's limit tests must cover that branch. The canonical byte rule now
   pins string escaping instead of allowing two different valid JSON encoders
   to disagree about the digest.

6. **Specified immutable new boundary records and distinct identities.**
   Existing record validation admits sequential revisions
   (`store/model.rs:252`), and the old terminal conflates transition ID and
   response digest (`store/writer.rs:804`, `:822`). Task 3 now forbids revisions,
   duplicate identities, second terminals and post-terminal ordinary records
   for the new boundary format, while leaving old record semantics intact.
   It explicitly separates stable transition identity from envelope digest.

7. **Corrected crash and sync claims to match actual stages.** V5 initially
   requested recovery-resync failure for the intent, which is not a semantic
   participant (`store/transaction.rs:337`). It now tests intent
   prepare/install/confirm/removal failures and participant resync separately.
   The added pre-intent-rename versus post-rename/pre-confirm distinction
   follows `store/transaction.rs:302`; a durable or merely installed intent
   can require recovery even when no acknowledgement was sent. State installed
   before intent cleanup is also not an acknowledged success (`:320`).

8. **Retained the compatibility checkpoint rather than claiming it resolved.**
   Adversarial review confirmed Flag A: keeping old typed wire encodings
   preserves checksums but cannot supply absent historical public envelopes or
   an old schema-renderer version (`store/model.rs:77`; `execution/model.rs:56`).
   M6, Task 5 and V6 explicitly prevent fresh-fixture results from closing the
   plan while this conflict remains. The choices and affected D-19/D-21/D-22
   citations are in PLAN-3's flagged assumptions. No decision or acceptance
   criterion in a protected document was edited to manufacture agreement.

9. **Prevented an intermediate mixed digest contract.** Task 2 defines the
   shared types and pure conversion; Task 4 activates them only after Task 3
   can persist a distinguishable record. Writing a new envelope digest into
   the legacy variant would make its semantics undecidable because the old
   record has no codec field (`crates/cadence/src/store/model.rs:77`). The final
   plan explicitly prohibits that transition and states the direction of read
   compatibility, without promising an old binary can read new variants.

## Lease and ownership audit

All Task Files entries are covered by the 16-path frontmatter lease. Both new
files are named exactly. Embedded fixtures stay in the leased test modules.
The pure envelope must be available to the library writer and binary service:
`crates/cadence/src/lib.rs:3` does not export it, while `main.rs:2` currently
owns it, so both wiring files and the existing envelope file are leased.
Changing the shared `View` would also touch literal constructors in
`crates/cadence/src/recall/history.rs:128` and
`crates/cadence/src/recall/tests.rs:21`; the plan deliberately keeps `View`
unchanged and adds a typed selector over it. This is an implementation design
constraint, not permission to edit those unleased files if a broader API is
chosen later.

The resident and its exhaustive current-record match share
`crates/cadence/src/recall/mod.rs:77`, already leased. Session request uses a
wildcard pass-through for specialized operations (`import/mod.rs:407`), so it
needs no edit under this design. Filesystem fault probes and phase-summary
resolution already exist (`store/filesystem.rs:63`, `:95`); new scopes add no
destinations. No Cargo dependency, generic store API rewrite, plan parser,
patch algebra, renderer, guard or public router change is hidden in the lease.
If Flag A's eventual ruling requires different files, the lease must be
corrected before that implementation, not silently widened.

## Knowingly untested and release condition

Model-produced source, test output prose, deviations and blockers are not
assertion oracles. Fixtures assert tags, keys, IDs, task/commit order, signatures,
canonical bytes, digests, preservation and real I/O/process behavior. Live
orchestration, actual host permission denial, skill compliance, compaction
causality and hardware power-loss behavior are not proved here. PLAN-2 retains
its deterministic raw MCP tests and its separately recorded live UAT.

Planning validation checks document structure, criterion coverage, citations,
lease equality and the final diff. No implementation pass or new 299-test run
is claimed. The planning deliverables can be committed while Flag A remains
explicit; implementation completion and PLAN-2 resumption cannot be claimed
until it is resolved.

Observed planning checks: the frontmatter lease has 16 unique paths and equals
the union of all six Task Files lists; all eight M bullets and six Verify
clauses have exactly one audit entry. Full-path source citations resolve to
existing files and valid line numbers. The protected-path diff against
`2aa77d64` and frozen-tree diff against `v3.7.12` were empty; no implementation
test execution is inferred from these document checks.
