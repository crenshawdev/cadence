PLAN COMPLETE

# Phase 8 PLAN-4 run record

Outcome: complete. Completed tasks: P8-4-T1 through P8-4-T3.

Executed on 2026-09-08 under the owner's direct instructions, outside native
dispatch. No dispatch identity, trace event or live-host observation is invented.
Branch: `cadence/binary-owns-process`; initial HEAD
`afd6c7e88a50c52bea86c1c769d74aa274d8acbb`; initial tree clean.
Final implementation commit: `85a9381339699238a31c7d59d74caf8ae76c86f2`.
All three task commits have valid GPG signatures and name
John Crenshaw <john@jcrenshaw.dev> as both author and committer, using key
`693AB15F91734B0C`. No push. Each task's Verify rewrite is in its own commit.
The owner explicitly authorized this report and its separate signed commit.

| Task | Status | Commit | Verification |
| --- | --- | --- | --- |
| P8-4-T1 | completed | `f01e25e971fb00753b324f02b355588026d165f9` (signature G) | phase8_routing: 16 passed after fixture corrections; mcp: 18 passed |
| P8-4-T2 | completed | `1e2c6429a29b8000dad963ff63abf731bbf16aa8` (signature G) | phase8_routing: 37 passed; phase7_risk: 22 passed; phase7_surfaces: 4 passed |
| P8-4-T3 | completed | `85a9381339699238a31c7d59d74caf8ae76c86f2` (signature G) | phase8_routing: 44 passed; phase8_dispatch: 9 passed; phase8_interview: 40 passed; permitted clippy passed without warnings |

## Required full suite

Not run. The owner's command limit overrides the historical workspace suite
and executor-contract suite requirement. PLAN-4's suite metadata now names only
`TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests`, run exactly once
after the task tests and before the T3 commit. Neither `cargo test --workspace`
nor `cargo clippy --all-targets` was run. All named test commands ran one at a
time, in task order. Only the failed T1 routing command was rerun. No test target
was run again after a successful invocation within the same task.

## Plan and implementation observations

- P8-4-T1 completes the public route with one supplied configuration generation,
  role spending selection and the surviving schema gate rows: diff, plan and
  risk_surface. Each row retains its explicit gate layer, reviewers, tier and
  effort. Filtering happens at each trigger's tier; diagnostics name dropped
  providers and missing model settings. The subagent always qualifies, and an
  empty surviving set names its fallback. No provider is invoked. Surface facts
  reuse phase 7's unanswered/invalid/answered semantics. Invalid live policy
  refuses through existing validation. The initial floor explicitly reports
  uncomputed scope; later tasks complete it.
- Existing resident command forwarding and grouped output derivation already
  carry the completed response type. Recall and server therefore require no
  edits. The permitted MCP target confirms the three-tool boundary and its
  existing schema checks. The completed refresh mechanism remains a dependency;
  removed AC1 was deleted from PLAN-4's stale requirements and mapping rather
  than resurrected as new work.
- P8-4-T2 adds declared-scope acquisition through the native parse_plan grammar,
  preserving exact file and directory leases. Named-plan reads never scan a
  sibling; phase scope uses a deterministic numeric-order union. Pre-plan roles
  and absent phase perform no scope I/O. Invalid or missing plans, empty scope,
  listing failures and unreadable required material yield Incomplete. New files
  retain path evidence only after checking parent containment.
- Metadata EACCES/ELOOP/ENOTDIR, canonicalization and body failures are injected
  at the production filesystem observation seam. Outside symlink parents with
  present and missing leaves, final symlinks to a device, FIFOs, replacement,
  growth, invalid UTF-8, size bounds and directory enumeration have independent
  fixtures. Nonregular bodies are refused before opening. Regular bodies open
  through contained directory handles with no-follow flags and identity checks.
  Sorted directory walking includes ignored paths and deduplicates overlaps.
  Bounds are 512 KiB per body, 4096 entries and 16 MiB of source reads; failed
  reads that consumed bytes count against the budget. Incomplete observations
  cannot become clean evidence through an exclusion or waiver.
- The declared-body adapter extends phase 7's existing signal logic, with no
  second category/pattern table and no fabricated Git diff. Document and named
  signal-table bodies are excluded with reasons; paths remain evidence. Import
  and literal-constant-only hits are withheld by category. Executable initializers
  still count. The existing pause compatibility wildcard automatically exposes
  the adapter, so its file needs no edit. Actual-diff and structural classifier
  targets remain unchanged and passed.
- P8-4-T3 composes the two effects: unwaived selected risk or incomplete required
  scope recommends deep verification and raises only a non-explicit plan gate.
  Explicit Global/Repo gates win, including default-equal advisory, and gates
  already at least blocking are retained. The returned reasons distinguish
  incomplete, waived and unwaived evidence and explicit-gate precedence. Model,
  starting/escalated rung, agent, other gates and actual-diff surfaces stay fixed.
  Independent layer fixtures establish [] replacement and stronger repo waivers.
- New execution admission now calls the same completed route_at resolver as the
  public route and consumes its saved spending choice. Existing active-dispatch
  replay remains unchanged and retains admitted spending; no replay chain was
  added. Configuration diagnostics also travel in the completed route. Review
  dispatch remains disabled, and deep verification is only a recommendation.
- T3 inspection found that the broad CommonJS import pattern could swallow a
  require initializer followed by an executable call. Its lease was extended,
  the import-only arm was restricted to a literal module load, and a direct
  declared-scan assertion proves JSON.parse inside the initializer remains a
  body hit. This fixes the phase's declared-body distinction without changing
  the actual-diff table.
- New tests call one production unit and make one assertion on its returned
  values. Pure collaborators are real; filesystem-adapter tests use isolated
  temporary roots with literal plan/body fixtures and injected I/O failures.
  No new model, subprocess or live-host test was added. Existing tests within
  the explicitly authorized targets also ran. No ignored live test was added.
- The executor contract was applied with the owner's explicit overrides for
  Verify repairs, lease extensions, reporting, command limits and final output.
  No task was skipped, no additional workflow was invoked, and PLAN-5 was not
  started. No other plan or MANUAL.md was changed.

## Verification receipts

Digests below are SHA-256 over the captured UTF-8 command output, including
failed attempts. Counts refer to each named target, not unique tests across
commands. Output captures remain under `/tmp/cadence-plan4-receipts/` for this
workspace session; the durable record is this table.

| Task / attempt | Exact command | Exit | Result | Output SHA-256 |
| --- | --- | --- | --- | --- |
| P8-4-T1 / initial | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing` | 101 | compile failed; 0 tests executed | `647b3c4431c2ec41778aa05895e7fc62e1373766c8a6b514ae39332af77f04e6` |
| P8-4-T1 / retry 1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing` | 101 | 14 passed; 2 failed | `02398b85c8a549de737d0813e37f0224ea16f953ac25fa70387a0446a3b5b288` |
| P8-4-T1 / retry 2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing` | 0 | 16 passed; 0 failed | `b410c2e14f71d2ef8afd631496f6314c348dcf903390a676a071da01d45e6666` |
| P8-4-T1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` | 0 | 18 passed; 0 failed | `882d61d2b6ed4fbde18c3a8b5295cc813de02d34e96ea1896e15aa2c7fa19134` |
| P8-4-T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing` | 0 | 37 passed; 0 failed | `b5af01594c7cb2923c4d0408a2c66827756d6569b7ab85176047a0c1900a7d50` |
| P8-4-T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk` | 0 | 22 passed; 0 failed | `debe2a7b34d1b9d6c1f3c5c4bf857b55407d74678816bbf0fb1fb7b08f1bd81c` |
| P8-4-T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces` | 0 | 4 passed; 0 failed | `1c71ffd8a63712b0faa473ad20c2313039b2fd9ca896d8f91f3768d513465e1e` |
| P8-4-T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing` | 0 | 44 passed; 0 failed | `a31f3cf3e8952502f69a4ad24d92f75cbf4a0855c91ad0dda0312de09bdd8760` |
| P8-4-T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch` | 0 | 9 passed; 0 failed | `b1b82dc66509585db51a1e22743fe7ec5d20ebeefa921c3c6669bf50a8962c4c` |
| P8-4-T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview` | 0 | 40 passed; 0 failed | `a111fa624b6e9f60544b31ab6550407c99df3934ea23f43a50a6b9c964da59d8` |
| Final lint | `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests` | 0 | passed; no warnings; no tests executed | `307d45e66e30ce13c44d2321fc1c04aa5d0e8987d7c7bc0c15a7e55a13a8db32` |

T1's initial compilation identified borrowed Value fixtures where merge takes
owned values and a mixed string-vector tuple expectation. After correcting
those fixtures, 14 tests passed and two literal error expectations failed: native
Error display uses its Debug spelling, and invalid gate values produce the named
unusable-key Policy error. Only those expectations and the matching Verify text
were corrected. The next routing run passed all 16 tests.

T2's routing run passed all 37 tests with one unused fixture import warning.
That import was removed. Inspection also removed the extra one-byte read probe
so aggregate source reads stay within the exact budget; post-read metadata and
identity comparisons still detect growth. Remaining T2 commands passed, and
T3's required routing target later passed all 44 tests on the final reader.
The one final clippy run exited 0 without warnings. No second lint run occurred.

## Verify rewrites

Each complete old/new line is recorded verbatim below. All original cargo
targets are retained. T1 and T3 remove repeated-call/resident-edit sequences;
T2 names its independent production units and promotes the two phase-7 commands
already present in execution metadata into the prose Verify line.

### P8-4-T1

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — For each surviving trigger, fixtures assert the exact gate, reviewer set, tier and effort values/types, with intentionally different tier assignments that cause different filtering outcomes. Cover mixed eligible/ineligible lists, empty fallback, always-eligible claude-subagent, empty/nonblank provider IDs and answered/unanswered surfaces. phase_diff is absent from all maps. Repeated public calls share one current config generation and a failed reload refuses. No provider process/network invocation or review receipt is produced.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — policy::resolve over supplied Effective values returns literal diff/plan/risk_surface gates, reviewer arrays, tiers, efforts and explicit gate layers; phase_diff is absent. Independent fixtures return named dropped-provider diagnostics and claude-subagent fallback, and Unanswered, Invalid { reason: "Invalid(\"invalid risk surface answer\")" } or Answered { categories } surface facts. resolve_route over a supplied Generation returns that generation number, saved role choice and policy; invalid effective policy returns Policy("config unavailable: unusable review.triggers.plan.gate"). No repeated public-call sequence or provider boundary is required; the existing grouped output schema derives the completed bundle.

Why: The repeated public-call/reload sequence becomes supplied-generation policy and route assertions. Existing synchronous refresh remains the production dependency; no fresh regression criterion replaces removed AC1.

### P8-4-T2

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing` — Fixtures distinguish clean named plan/risky union, bypass/no-phase, genuine absent new file, missing plan, malformed lease, empty scope and unreadable sibling. Independently inject metadata EACCES/ELOOP/ENOTDIR and body-read failures on neutral paths hiding risky content; all raise. Cover outside symlinked parents including missing leaves, final symlinks/devices, growth/size/read-budget limits, directory leases, overlap deduplication and unreadable directory enumeration. Reference whole-body exclusions retain path hits and withheld reasons; executable initializer calls count. Existing phase 7 diff and structural-surface tests remain unchanged and passing.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces` — floor::read_observed over literal native plans and filesystem observations returns Complete with exact paths/matches, Incomplete with named read diagnostics, Bypassed for planner/analyzer, or NotComputed without phase. Independent fixtures cover named plan versus union, missing/malformed/empty plans, metadata EACCES/ELOOP/ENOTDIR, read/canonicalization/listing failures, outside parents and final nonregular bodies, replacement/growth, UTF-8, 512 KiB bodies, 4096 entries and 16 MiB reads, directory traversal and overlap deduplication. risk_diff::scan_declared returns literal path/body matches and withheld document, signal-table or import/literal-constant reasons; executable initializer calls retain body matches. Filesystem is the only stubbed boundary. The two already-named phase 7 targets remain regression commands, not new criteria.

Why: The fixture requirements become literal Scope and DeclaredScan results at the filesystem adapter and pure classifier. The two phase-7 targets already named in task metadata are made explicit in the Verify line, with no new target.

### P8-4-T3

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview` — A metamorphic matrix changes only plan risk or waiver values and asserts model, rung/agent, non-plan gates and actual-diff selected surfaces remain identical. It asserts the exact deep recommendation and plan gate for defaults, explicit-default-equal gates in both layers, explicit advisory/off/blocking, mixed waived/unwaived hits and unreadable scope. Repo [] clears inherited/existing waivers and permits the expected raise; global [] with a repo waiver reports the remaining winning waiver accurately. Public route and new dispatch use the same saved spending choice, and current config edits are observed by the resident.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview` — Route::with_scope takes independently encoded role/policy and Complete, Incomplete, Bypassed or NotComputed scope values and returns literal model, starting/escalated rung, agent, non-plan gates and actual-diff surfaces unchanged, with deep_verification true/false and plan gate blocking/advisory/off/adjudicated as specified. Independent cases cover explicit Global/Repo default-equal and other gates, waived/unwaived hits and failed scope. policy::resolve over independently supplied global/repo values returns the exact winning [] or category waiver; no write/read chain. resolve_route returns literal saved spending choices from separate supplied generations, and new execution admission calls the same route_at resolver. Existing replay and interview targets remain the named regression commands; no resident edit sequence or live host is required.

Why: The metamorphic and resident-edit wording becomes independent Route::with_scope, policy::resolve and saved-generation assertions. The existing new-admission caller uses the shared resolver; no edit/route/dispatch chain is added.

## Lease, frozen reference and remaining tree

P8-4-T1 and P8-4-T2 needed no lease extensions. Listed paths already served by
existing generic forwarding, schema derivation or wildcard re-export were left
unchanged rather than edited without a functional need.

P8-4-T3's Files line was extended before editing
`crates/cadence/src/rail/risk_diff.rs` to retain executable CommonJS initializer
evidence. That path was already present in the plan's top-level files list.

Old Files line:

- **Files:** `crates/cadence/src/config/floor.rs` (scope result from Task 2), `crates/cadence/src/config/policy.rs` (stored gate provenance from Task 1), `crates/cadence/src/config_service.rs` (completed route bundle), `crates/cadence/src/execution_service.rs` (new-dispatch selection from Plan 1), `crates/cadence/tests/phase8_routing.rs` (floor effect matrix), `crates/cadence/tests/phase8_dispatch.rs` (saved spending selection regression), `docs/architecture/config-routing.md` (floor contract)

New Files line:

- **Files:** `crates/cadence/src/config/floor.rs` (scope result from Task 2), `crates/cadence/src/config/policy.rs` (stored gate provenance from Task 1), `crates/cadence/src/config_service.rs` (completed route bundle), `crates/cadence/src/execution_service.rs` (new-dispatch selection from Plan 1), `crates/cadence/tests/phase8_routing.rs` (floor effect matrix), `crates/cadence/tests/phase8_dispatch.rs` (saved spending selection regression), `docs/architecture/config-routing.md` (floor contract), `crates/cadence/src/rail/risk_diff.rs` (retain executable CommonJS initializer evidence)

PLAN-4 edits accompanied the task they belong to. All files were staged by
explicit path; no blanket staging was used. The frozen cadence-core reference
was read only and was not modified. No other plan was read for execution or
changed. No unrelated working-tree changes appeared during this run.

The tree was clean after the T3 commit. This separate report commit changes only
`.planning/phases/8/reports/plan-4.md`.

PLAN COMPLETE
Plan: `.planning/phases/8/PLAN-4.md`
Tasks: 3 of 3 completed in separate signed commits.
Deviations: Verify lines restated as independent function assertions; T3's
classifier lease extended; prohibited suite replaced by the owner's single
permitted clippy invocation; stale AC1 references removed; fixture errors and
an unused import repaired; source read probing tightened to the exact budget.
Open items: none within PLAN-4. No later plan was started.
