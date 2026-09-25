---
phase: 6
plan: 1
requirements:
  - AC2
  - AC4
  - AC5
  - AC6
  - AC7
  - AC8
files:
  - crates/cadence/Cargo.toml
  - Cargo.lock
  - crates/cadence/src/lib.rs
  - crates/cadence/src/execution/mod.rs
  - crates/cadence/src/execution/model.rs
  - crates/cadence/src/execution/plan.rs
  - crates/cadence/src/execution/dispatch.rs
  - crates/cadence/src/execution/patch.rs
  - crates/cadence/src/execution/render.rs
  - crates/cadence/src/execution/tests.rs
  - crates/cadence/src/store/model.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/execution_service_tests.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/guard/mod.rs
  - crates/cadence/src/guard/tests.rs
  - crates/cadence/src/main.rs
  - crates/cadence/tests/execution_store.rs
---

# Phase 6: The boundary and the execute slice - Plan 1

## Goal

Build the strict execution producer behind the boundary: typed native plan and
executor-patch schemas, binary-owned selection and Git validation, lossless
acknowledged state application, derived SUMMARY rendering, restart recovery,
bounded boundary decisions, and the Rust file-ownership guard. This plan leaves
the public tool list unchanged until PLAN-2 exposes the completed path.

## Must be true when done

- AC2: A strict native plan is parsed from frontmatter without interpreting its
  body. Stable task IDs, verify commands and `files:` overlap determine the
  dispatch; legacy or non-integer execution input is refused.
- AC4/AC5: The executor patch is a role-specific operation against one durable
  dispatch and expected execution-subtree version. Acceptance validates its
  exact task scope,
  evidence and Git commits; refusal changes neither the execution namespace nor
  the rendered SUMMARY and records one refusal decision.
- AC4: The single writer confirms the accepted execution transition and its
  operation-specific phase SUMMARY while preserving import, derivation,
  evidence, pause and unrelated snapshot data. It never accepts an arbitrary
  output path or whole-state replacement from the caller.
- AC6: A dispatch acknowledged before reply survives process death. A fresh
  process reconstructs the byte-identical outstanding dispatch, while a lost
  patch reply replays one logical transition and repairs any incomplete derived
  render without duplicate history.
- AC8: One occurrence admits at most 256 unique boundary transitions and one
  terminal `log-bound` refusal; all later calls replay that persisted refusal
  without growing the decisions log.
- AC7: `cadence guard` consumes actual PreToolUse JSON, denies Write/Edit access
  to native state/decision files and phase SUMMARY documents, allows project
  source, and requires no JavaScript or redirect executable.
- The phase 4 lifecycle and phase 5 evidence/next-action/pause behavior remain
  unchanged, and no public MCP tool is added by this plan.

## Context

Phase 6 CONTEXT D-17 through D-23 and D-26 bind this plan. The current resident
has no execution request (`crates/cadence/src/recall/mod.rs:201-232`), the
current store writes its three fixed participants on every mutation
(`crates/cadence/src/store/writer.rs:306-333`), and the current CLI exposes only
`serve` (`crates/cadence/src/main.rs:18-29`). Build on those owners rather than
adding a second store, runtime or process.

Run this plan before PLAN-2. Both plans edit `crates/cadence/src/server.rs`, so
their file leases are intentionally sequential. PLAN-2 must inspect the
implemented execution service before replacing the macro-only public router.

## Tasks

### Task 1: Define and parse strict native execution plans

- **Files:** `crates/cadence/Cargo.toml`, `Cargo.lock`, `crates/cadence/src/lib.rs`, `crates/cadence/src/execution/mod.rs`, `crates/cadence/src/execution/model.rs`, `crates/cadence/src/execution/plan.rs`, `crates/cadence/src/execution/tests.rs`
- **Action:** Add the synchronous execution domain and a maintained typed YAML deserializer. Define a versioned frontmatter contract containing the existing `phase`, `plan`, `requirements` and `files` fields plus `execution.schema`, one nonempty full-suite command, and ordered tasks with stable IDs and nonempty verify-command lists. Use strict Serde structs and parser limits: reject duplicate and unknown keys, aliases/tags, multiple documents, invalid UTF-8, missing delimiters, mismatched phase/plan identity, duplicate or blank task IDs, blank commands, absolute/upward/traversal lease paths, duplicate normalized paths, over-limit documents/fields/tasks/commands and any unsupported schema version. Accept only canonical positive integer phase and plan numbers. Preserve the exact post-frontmatter body bytes as opaque assignment data; do not search it for headings, commands, task counts or dependencies. Compute a plan-set fingerprint from normalized operational fields and body bytes. Build the overlap graph solely from normalized `files:` lists, orient each shared-path edge from lower plan number to higher, and use plan number only as the deterministic tie-break among independent ready plans. Add no `depends_on` field. `serde-saphyr`'s typed `from_str_with_options` path was selected from current crate documentation because it supports resource and duplicate-key policy; do not introduce generic YAML `Value` as a second schema.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::plan` accepts Unicode body bytes without interpreting them and proves every validation arm above with a named negative case. Three-plan fixtures prove shared-path ordering, transitive overlap, and independence of disjoint leases; renames are not inferred from prose. Changing only the body changes the plan-set fingerprint but not parsed operational fields. The suite command and task verify commands come only from frontmatter. A test that derives either from markdown headings must fail review.

### Task 2: Make dispatch and executor-patch validation pure

- **Files:** `crates/cadence/src/execution/model.rs`, `crates/cadence/src/execution/dispatch.rs`, `crates/cadence/src/execution/patch.rs`, `crates/cadence/src/execution/tests.rs`
- **Action:** Define the versioned execution snapshot, active dispatch, terminal outcome, task outcome, verification receipt, evidence reference, deviation and blocker types. Produce at most one active plan dispatch containing a stable content-derived dispatch ID, expected execution-subtree version, phase/plan identity, ordered task/verify data, suite command, lease, fixed policy, base SHA, prompt byte count and opaque body. Define the advertised `kind: executor` patch as a narrow change to that dispatch. Require exactly one row per task in dispatch order. A completed row requires a full commit SHA, passed verification receipt and at least one D-10 evidence reference; a blocked row requires a blocker reference and no commit; after the first blocked row all remaining rows are explicit `not-run` with neither commit nor invented verification. Deviations and blockers require stable IDs, nonblank judgment text and typed evidence. Reject duplicate/unknown tasks or IDs, arbitrary state/lifecycle/summary fields, lossy omission, status/field mismatches, foreign dispatch, stale execution version, unsupported evidence and a completed plan with any blocked/not-run task. Merge an accepted complete patch only into its dispatch subtree, preserving every unrelated JSON value exactly. A blocked patch records the judgment stop but does not advance or render completion. Keep this algebra synchronous and free of filesystem, Git, Tokio and rmcp types.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::patch` exercises every tagged task state and pairwise invalid field combination, exact task-set/order enforcement, foreign/stale identity, evidence forms, prefix blocking and preservation of seeded unrelated namespaces. Property-style table cases remove or add each patch key in turn and must refuse rather than default. Applying the same accepted logical patch twice yields the same state transition identity; changing content under the same identity conflicts. No test treats model prose as proof that a commit or verification occurred.

### Task 3: Add operation-specific execution persistence and bounded decisions

- **Files:** `crates/cadence/src/store/model.rs`, `crates/cadence/src/store/writer.rs`, `crates/cadence/src/store/filesystem.rs`, `crates/cadence/src/store/transaction.rs`, `crates/cadence/src/import/mod.rs`, `crates/cadence/src/execution/model.rs`, `crates/cadence/src/execution/render.rs`, `crates/cadence/tests/execution_store.rs`
- **Action:** Extend the existing owner-serialized writer with typed operations for (a) admitting an execution dispatch plus boundary decision, (b) applying an accepted or blocked execution patch plus boundary decision and optional derived SUMMARY, and (c) recording a refusal without changing the execution projection. Persist the execution namespace under snapshot data while preserving import and every unrelated namespace. Extend the transaction participant vocabulary only with a validated `phase-summary:<positive-integer>` target whose filesystem destination is derived under `.planning/phases/<N>/SUMMARY.md`; callers never submit a path, template or arbitrary bytes. Validate persisted intents by operation kind, render version and phase identity before recovery. Render a deterministic minimal SUMMARY from state: schema/status, ordered plans/tasks, full commit SHAs, verification dispositions, and stored deviation/blocker references. Record compact boundary decisions with request/response digests and prompt bytes, never the body in state. Enforce 256 unique transitions plus one content-addressed terminal refusal per occurrence; a later request returns the existing terminal record. Preserve write-then-confirm and recovery semantics, and keep operation identity separate from attempt preconditions. A refused patch writes only its decision and the consequent normal store generation/integrity changes; its execution value and prior SUMMARY bytes remain exact.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store` uses the real filesystem writer to prove dispatch, accepted patch, blocked patch and refusal persistence after reopen; unrelated import/lifecycle/evidence/pause/arbitrary namespaces survive. It compares execution JSON values and SUMMARY bytes before and after every refusal while allowing the expected decisions/generation/integrity change. Unknown phase-summary targets, traversal, caller-supplied bytes, wrong render version and summary-only transactions refuse before mutation. Inject temporary sync, directory sync, rename and confirmation failures for store and SUMMARY participants; no unconfirmed success returns, and normal recovery finishes an admitted operation exactly once. Transition 257 records `log-bound`; 258 and later return its ID with byte-identical decisions log length.

### Task 4: Select and apply execution through the resident service

- **Files:** `crates/cadence/src/execution_service.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`, `crates/cadence/src/import/mod.rs`, `crates/cadence/src/execution/plan.rs`, `crates/cadence/src/execution/dispatch.rs`, `crates/cadence/src/execution/patch.rs`
- **Action:** Add one execution request family to the existing resident owner and internal `CadenceServer`: query-next from root/explicit phase and apply-executor-patch. At query time use phase 4's checked derivation, phase 5's continuation authority, real phase-directory/plan bytes, effective store view and real Git HEAD. Refuse lifecycle/store/input conflicts without hiding them. Parse every admitted plan, compute overlap readiness, and choose the lowest-numbered ready outstanding plan; an existing active dispatch wins and is returned unchanged after re-observation. Persist a new dispatch before its prompt is returned. Build the prompt in the binary from Task 1 operational fields plus the opaque body and the exact patch schema/instructions; record byte count. At apply time re-observe plan fingerprint, store generation, active dispatch and Git. Resolve each full SHA through Git, verify ancestry and strict order from the recorded base, verify a good signature and a conventional subject containing the stable task ID, and reject a commit reused for two tasks. Submit only Task 3 typed operations and await confirmation. Return next-plan/complete/judgment-stop outcomes without extending phase 4's lifecycle enum. Do not enforce source paths yet; record the observed commit path set for phase 11. Do not call the resident queue recursively from its own handler.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service` drives production server methods through the resident against real temporary repositories and strict plan files. It proves overlap selection, independent tie-break, durable-before-reply dispatch, active-dispatch replay, lifecycle and changed-input refusal, valid signed ordered commits, bad/missing/unsigned/reused/reordered commits, subject mismatch, blocked stop and final completion. Fixtures initialize through the real session and derive lifecycle rather than seeding an answer. Removing reports or reading their bodies cannot change the selected plan. Tests configure repository-local Git identity/signing and never change global Git configuration.

### Task 5: Prove restart, lost replies and render repair

- **Files:** `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/tests/execution_store.rs`, `crates/cadence/src/execution/render.rs`
- **Action:** Add child-process barriers at the real points after dispatch confirmation/before reply, after derived SUMMARY installation/before final `state.json` confirmation, and after complete patch confirmation/before reply. The parent must kill the producer and start an unrelated process that receives only root, explicit phase and, for apply replay, the original patch. Inspect through production query/apply methods and Git object reads. A dispatch kill recovers exactly the same ID/execution-version/plan/task set/base/body. A partially installed accepted operation recovers and confirms its final state participant. A lost success reply replays the immutable receipt, does not add a decision or duplicate summary row, and then returns the next plan or complete. Distinguish an admitted transaction from a request killed before admission; do not promise rollback after an intent is durable.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_restart` asserts the child reached each named barrier and died by process kill. Fresh readers receive no expected dispatch or summary data through arguments/environment, compare production answers to disk/Git, and prove one logical dispatch/transition after replay. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store` proves the matching crash-recovery participant behavior. A same-process reopen, direct JSON seed or mocked Git result cannot satisfy AC6.

### Task 6: Deny direct writes through one Rust hook entry point

- **Files:** `crates/cadence/src/guard/mod.rs`, `crates/cadence/src/guard/tests.rs`, `crates/cadence/src/main.rs`
- **Action:** Add `cadence guard`, reading exactly one bounded PreToolUse event as JSON from stdin and writing the host's documented hook decision JSON to stdout. For `Write|Edit`, resolve the event cwd and target without requiring the target to exist, reject NUL/non-UTF-8/ambiguous or escaping paths conservatively, and deny `.planning/state.json`, `.planning/decisions.jsonl`, `.planning/items.jsonl` and any `.planning/phases/<positive-integer>/SUMMARY.md` reached by relative, absolute, normalized, symlink-parent or alternate-separator spelling. Allow unrelated source targets. Other tool names return no decision in this phase so phase 7 can add the Bash arm to the same command. Malformed/bound-exceeding hook input fails closed for matched Write/Edit with a useful reason and never performs a write. Keep `serve` unchanged and add no script, hook registration or Node call.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence guard` pipes real hook JSON shapes into the compiled subcommand and asserts valid host deny output for every protected spelling, missing targets, symlink parents, malformed fields and oversized input. Source paths inside and outside `.planning/` that are not owned outputs are allowed. `cadence serve` still handshakes. Tests invoke the binary directly, not through a shell shim; no test-only path matcher differs from production.

### Task 7: Pin deterministic phase-6 acceptance evidence

- **Files:** `crates/cadence/src/execution/tests.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/src/guard/tests.rs`, `crates/cadence/tests/execution_store.rs`
- **Action:** Add an executable acceptance inventory mapping AC2, AC4, AC5, AC6, AC7's deterministic guard half and AC8's log-bound half to the named tests above. The inventory must assert that each evidence test is registered and then run those tests; it may not treat names in source as execution evidence. Preserve all phase 1-5 suites and the exact frozen-tree diff. Record in test/module documentation that a real host, real model executor, actual tool permission denial and model-produced work remain PLAN-2 UAT, not Cargo claims. Do not register a public MCP tool in this plan.
- **Verify:** From `/code/cadence`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence` passes the new inventory and all existing crate tests; `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings` and `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check` pass. `git diff --exit-code v3.7.12 -- cadence-core/` is empty. `crates/cadence/tests/mcp.rs` still passes its one-tool assertion at `crates/cadence/tests/mcp.rs:153-170`. Report actual results and any unproved live obligation; authored test names alone are not a pass.

## Notes

- Execute PLAN-1 -> PLAN-2. The shared `server.rs` lease makes the order
  mandatory. Within this plan, Tasks 1-2 establish the pure contract; Task 3
  adds its only writer; Tasks 4-5 compose the service and restart proof; Task 6
  is independent in behavior but shares the final binary entry point; Task 7
  closes deterministic evidence.
- New execution and guard files do not exist at planning time. Their names are
  leases for coherent modules, not claims about current symbols. Existing
  `server.rs`, `recall/mod.rs`, store files, import session and `main.rs` were
  opened; PLAN-2 must inspect the landed interfaces rather than guessing them.
- This phase's own PLAN files are legacy-shaped by design and cannot self-host
  the native parser. Use strict native fixtures under external temporary
  repositories. Do not rewrite phase 1-6 artifacts to manufacture acceptance.
- Every Cargo invocation clears `RUSTC_WRAPPER` and uses `TMPDIR=/tmp`. Test Git
  identities and signing material are fixture-local. Nothing changes operator
  or global Git configuration. Frozen `cadence-core/` remains read-only.
- Current `serde-saphyr` and rmcp behavior was checked through Context7 before
  choosing typed YAML parsing and raw manual tool dispatch. Implementation must
  recheck the locked crate APIs after dependency resolution rather than copying
  examples blindly.
