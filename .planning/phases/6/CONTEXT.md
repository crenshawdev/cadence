# Phase 6: The boundary and the execute slice - Context

Gathered: 2026-09-07
Feeds: /cad-plan 6

## Scope boundary

In: The first public process boundary over the Rust binary: one grouped query
tool, one role-patch tool, and the existing version tool. The execute slice
uses that boundary to select one explicit integer phase from real planning
files and native state, dispatch one plan at a time, accept a typed executor
patch, validate it against the active dispatch and Git, persist it through the
single writer, render the strict slice's SUMMARY, and repeat after process
restart. Malformed arguments to a declared tool are binary-owned refusals, not
MCP input-validation errors. `/cad-execute` and the fixed executor contract are
the only skill surfaces changed. This is the vertical slice assigned at
`.planning/ROADMAP.md:596-639` and the reachability hole handed off at
`.planning/phases/5/SUMMARY.md:118-124`.

In, but deliberately narrow: one fixed executor rung, one fixed branch policy,
reviews disabled, native execution plans only, an explicit integer phase, and
a bounded no-rotation execution log. Those are the roadmap's named stubs
(`.planning/ROADMAP.md:621-624`), not claims about the later general workflow.
The slice proves the five-step ask, dispatch, submit, repeat loop in
`docs/rationale/architecture-v4.md:135-155`.

Out: Phase 7 owns the complete commit rail, Bash guard, protected-branch and
risk-gate behavior (`.planning/ROADMAP.md:641-644`). Phase 8 owns configurable
routing and role selection (`.planning/ROADMAP.md:680-715`). Phase 9 owns
review-provider dispatch (`.planning/ROADMAP.md:716-765`). Phase 11
owns full execution and task behavior: partial attempt history, checkpoints,
the general SUMMARY contract, task records, source leases, `/cad-task`, and
CONTEXT decision amendments (`.planning/ROADMAP.md:810-846`). Phase 17 owns
cycle-level acceptance (`.planning/ROADMAP.md:1009-1057`), and phase 18 owns
installed MCP/bootstrap/plugin wiring (`.planning/ROADMAP.md:1058-1070`). No
other skill is migrated. No JavaScript, Node runtime, redirect
script, legacy report producer, worktree execution, general configuration, log
rotation, or model-authored Cadence state enters this phase.

Phase 4 D-01 through D-07 and phase 5 D-01 through D-14 remain authoritative.
In particular, execution does not add a lifecycle status or put continuation
facts inside the lifecycle memo (`.planning/phases/4/CONTEXT.md:48-60` and
`.planning/phases/4/CONTEXT.md:79-127`); derivation/state conflicts remain hard
refusals (`.planning/phases/4/CONTEXT.md:128-150`); accepted contracted results
still require evidence (`.planning/phases/5/CONTEXT.md:195-204`); and execution
writes preserve unrelated snapshot/import data and wait for store confirmation
(`.planning/phases/5/CONTEXT.md:217-231`). Frozen `cadence-core/`, phase 1-5
artifacts, ROADMAP, REQUIREMENTS and STATE planning documents remain unchanged.

Plan shape: two sequential plans. PLAN-1 owns the execution domain, persistence,
rendering and Rust hook entry point. PLAN-2 owns the public MCP surface, the two
markdown contracts and the real-host proof. Both must edit
`crates/cadence/src/server.rs`, so their `files:` leases require
PLAN-1 -> PLAN-2. There is no parallel plan pair.

## Durable decisions

- D-15 (Three public tools, grouped by boundary role): The public surface is
  exactly `cadence_version`, `cadence_query`, and `cadence_apply` in this phase.
  `cadence_query` is a tagged read/dispatch union whose first public operation
  is `execute-next`; `cadence_apply` is a tagged role-patch union whose first
  role is `executor`. Adding an internal service does not add a tool. This
  leaves room for later operations without paying one tool per module and
  satisfies the three-or-four limit at
  `docs/rationale/architecture-v4.md:124-133`. The current server registers
  only `cadence_version` (`crates/cadence/src/server.rs:144-185`), and the wire
  test asserts exactly one tool (`crates/cadence/tests/mcp.rs:153-170`), so this
  is an intentional public-surface change rather than documentation of what is
  already reachable. If wrong: later clusters either exceed the bounded tool
  surface or tunnel unrelated writes through an untyped catch-all.

- D-16 (Declared schemas describe; raw arguments reach Cadence): Tool listing
  advertises exact JSON Schemas, including the executor patch, but calls to a
  declared tool reach a manual Cadence dispatch as the raw arguments object.
  Cadence then deserializes and validates it and returns `Envelope::Refused`
  with a stable code and actionable reason on any missing, extra, wrong-type,
  malformed-union or semantically invalid field. The tool call completes
  successfully with mirrored structured JSON; it does not set `isError`.
  Invalid JSON-RPC frames and calls to names Cadence never declared remain
  transport errors because no Cadence operation exists to answer them. The
  envelope already defines refusal as a successful call
  (`crates/cadence/src/envelope.rs:9-13`) and proves that conversion at
  `crates/cadence/src/envelope.rs:158-189`; the existing macro handler has not
  yet exercised an argument (`crates/cadence/src/server.rs:162-184`). If wrong:
  the malformed patch case escapes the one vocabulary the skill can recover
  from.

- D-17 (Explicit strict execution identity): The public server binds one
  normalized absolute project root at startup, and `execute-next` requires an
  integer phase greater than zero. Tool arguments cannot switch repositories.
  Phase identity in this boundary is an integer type, not the legacy binary64
  `PhaseId` used for frozen lifecycle compatibility. A missing phase, decimal,
  exponent, nonpositive value, legacy-only tree, lifecycle conflict, unreadable
  controlling input, or phase without the native execution frontmatter returns
  a typed non-`ok` envelope and creates no dispatch. The existing compatibility
  type deliberately stores binary64 numbers (`crates/cadence/src/derivation/model.rs:20-27`)
  and the ROADMAP parser accepts one decimal component
  (`crates/cadence/src/derivation/parse.rs:80-120`); this public restriction does
  not change either phase 4 rule. If wrong: two spellings can address one
  execution subtree, or the slice silently treats an old plan as a validated
  native plan.

- D-18 (Frontmatter owns operational structure): Native execution frontmatter
  retains `phase`, `plan`, `requirements` and `files` and adds a versioned
  `execution` object. It contains stable nonblank task IDs in order, each
  task's nonempty verify-command list, and one nonempty full-suite command. The
  binary uses typed YAML
  deserialization with duplicate-key, unknown-field, type, size and count
  rejection. It derives plan ordering from pairwise `files:` overlap and has no
  `depends_on`. The plan body stays opaque bytes attached to the generated
  engineering prompt; the binary never parses it for task identity, commands,
  dependencies or completion. That is the two-owner plan rule at
  `docs/rationale/architecture-v4.md:374-400`. The present crate has no native
  execution-plan module among its public domain exports
  (`crates/cadence/src/lib.rs:1-5`), while current derivation admits plan names
  and intentionally excludes PLAN contents from its memo
  (`.planning/phases/4/CONTEXT.md:97-120`). If wrong: prose wording becomes
  machine state again, duplicate task identities make patches ambiguous, or a
  planner can declare an ordering the file leases contradict.

- D-19 (One active plan dispatch, one role patch): A dispatch is durable before
  its prompt is returned and contains a stable dispatch ID, execution schema
  version, expected execution-subtree version, phase/plan identity, ordered
  task IDs and verify commands, the suite command, exact `files:` lease, fixed
  rung/branch/review policy, base commit, prompt byte count, and the opaque plan
  body. Only one plan is active
  for this strict slice. The executor patch names `kind: executor`, that
  dispatch ID and expected execution version, and provides exactly one row for
  every dispatched task. A completed row carries a full commit SHA, passed
  verification disposition and typed evidence; a blocked row carries its
  blocker and no commit; rows after a blocker are explicit `not-run` entries.
  Deviations and
  blockers have stable IDs, free text and evidence references; free text is
  permitted there because it is judgment. The model does not submit lifecycle,
  plan number, summary paths, arbitrary state keys or replacement state. This
  formalizes the executor patch described at
  `docs/rationale/architecture-v4.md:162-180` and preserves phase 5's evidence
  rule. If wrong: the model can assert structural state it does not own, or the
  binary cannot tell which outstanding work a return answers.

- D-20 (Lossless application is narrower than acceptance): Before mutation,
  Cadence checks the patch schema, dispatch identity, expected execution
  version,
  exact task-ID set, evidence forms, task order, and Git facts. Every named
  commit must exist, be ordered after the dispatch base, be unique to one task,
  have a conventional subject naming that task, and carry a good signature.
  The strict slice observes but does not yet enforce the phase 11 source lease.
  An accepted patch updates only its active execution subtree and preserves all
  other snapshot namespaces and import provenance. Missing task rows, unknown
  keys, stale versions, foreign dispatch IDs, regressions, nonexistent or
  unsigned commits, reordered commits and unsupported evidence are refused.
  A refusal leaves the execution subtree and rendered SUMMARY byte-identical;
  its boundary refusal record is the one intentional write. The existing store
  snapshot is a generic JSON value (`crates/cadence/src/store/model.rs:88-97`)
  and current evidence persistence already guards generation and import
  provenance (`crates/cadence/src/import/mod.rs:455-499`); neither currently
  supplies this execution contract. If wrong: a lossy retry erases prior truth,
  a patch can complete somebody else's plan, or a refusal's audit write is
  mistaken for forbidden execution-state mutation.

- D-21 (State final, SUMMARY derived, repairable): The source of execution
  truth is a versioned namespace in `.planning/state.json` plus append-only
  semantic records in `.planning/decisions.jsonl`. Acknowledgement waits for
  the existing single writer. The same operation renders a minimal phase
  `SUMMARY.md` from accepted task/commit/deviation/blocker facts using an
  operation-specific phase-summary participant, never an arbitrary path or
  unlimited replacement document. The transaction installs the derived SUMMARY
  before its final semantic `state.json` participant, as the existing store
  protocol requires (`crates/cadence/src/store/transaction.rs:184-199`). If a
  crash admits that intent after SUMMARY installation
  but before final state confirmation, restart recognizes the same logical
  patch, completes or repairs the state participant, and adds no duplicate
  transition. The renderer emits
  only the strict slice's mechanical section and stored judgment references;
  phase 11 may extend the full human summary. Every current store write already
  replaces `items.jsonl`, `decisions.jsonl` and `state.json` together
  (`crates/cadence/src/store/writer.rs:306-333`), and its filesystem currently
  rejects multi-component unregistered targets
  (`crates/cadence/src/store/filesystem.rs:95-123`), so SUMMARY must be a new
  narrowly typed participant rather than a caller-provided pathname. If wrong:
  a model regains document ownership, a crash reports completion with no
  reproducible summary, or the writer becomes an arbitrary filesystem API.

- D-22 (The audit log uses the live 4.0 store vocabulary): Every unique
  `execute-next` and `executor` application answer records a compact boundary
  decision before reply: tool/operation, request digest, outcome arm/code,
  dispatch or patch identity, store generation, prompt bytes when applicable,
  and response digest. It never stores the prompt body in state. Malformed
  arguments are refusal decisions through that same path. A fixed maximum of
  256 unique boundary transitions per execution occurrence plus one terminal
  `log-bound` refusal replaces rotation; later calls replay the stored terminal
  refusal rather than appending. The current native names are
  `decisions.jsonl` and `state.json` (`crates/cadence/src/store/model.rs:8-11`),
  and `Decision::Refusal` already exists (`crates/cadence/src/store/model.rs:57-76`).
  If wrong: the live failure half of the phase is not diagnosable, or a
  no-rotation episode can grow without limit.

- D-23 (One Rust guard, registration deferred): Add one `cadence guard`
  subcommand that consumes the host's PreToolUse JSON on stdin. In this phase it
  handles `Write|Edit` and denies normalized targets for the native store
  participants and every phase `SUMMARY.md`; it allows unrelated project-source
  writes and returns the host's typed deny reason. Tests and live UAT invoke the
  built binary directly from temporary host settings. No shell or JavaScript
  redirect is added, and repository plugin-hook registration waits for the
  phase that replaces the shipped hook surface. The current CLI has only
  `serve` (`crates/cadence/src/main.rs:18-29`), while every committed hook command
  currently launches Node (`hooks/hooks.json:1-38`). If wrong: model code tools
  can bypass the patch validator, or phase 6 installs an unusable path before
  the release binary exists.

- D-24 (The skill is a stateless five-step loop): `/cad-execute N` calls
  `cadence_query`, reports a non-`ok` reason or dispatches exactly the returned
  prompt to the fixed `cad-executor`, submits the returned JSON object
  field-for-field without interpreting its judgment fields to `cadence_apply`,
  and repeats until the binary returns complete or a judgment stop. The main
  skill carries no replay, report discovery, Git,
  rendering or state-write logic and has no `Read`, `Write`, `Edit`, `Bash`,
  `Grep` or `Glob` permission. The executor edits source, runs the dispatched
  verify commands, makes one commit per task, and returns the patch only; it
  never writes reports or Cadence state. The current skill instead grants all
  six local file/shell tools and imports the JavaScript workflow
  (`skills/cad-execute/SKILL.md:5-29`); the current executor contract writes and
  rotates reports and returns a five-field digest
  (`skills/cad-executor-contract/SKILL.md:242-310`). If wrong: the markdown
  becomes a second orchestrator or the old report remains an alternate state
  channel.

- D-25 (OQ-1 is no preamble; OQ-2 has no product branch): Cadence skills name
  the two tools directly and do not spend a ToolSearch preamble. The recorded
  host probe already showed an unloaded tool callable, so loading is convention,
  not enforcement (`.planning/ROADMAP.md:262-273`). For the same reason, phase 6
  does not claim to prove tool survival across compaction: the existing negative
  control cannot distinguish survival from enforcement being absent
  (`.planning/ROADMAP.md:274-282`). OQ-2 settles as non-decision-bearing unless
  the host later supplies a distinguishable failure state. The real-host UAT
  calls Cadence before an explicit load and again after compaction if one occurs,
  recording observations without promoting the second into a causal proof. If
  wrong: every skill pays an unneeded load cost, or an invalid experiment is
  reported as evidence.

- D-26 (Test deterministic machinery, observe the model): Unit, integration and
  child-process tests own schema generation, raw argument refusal, dispatch
  selection, YAML rejection, patch validation, Git inspection, writer
  acknowledgement, crash repair, log bounds and rendered shape. A real host and
  real executor are a separately recorded live UAT, not a mocked Cargo test.
  That UAT asserts only orchestration shape: calls crossed host/MCP/Rust, the
  executor invoked commands, one ordered signed commit exists per task with the
  required subject shape, the returned patch has every required key, the
  SUMMARY names exactly those SHAs, restart retained the dispatch, and protected
  writes were denied. It does not grade source quality, test output prose,
  deviation prose or any other model-produced content. This follows the standing
  split and shape rule at `.planning/ROADMAP.md:176-187` and
  `.planning/ROADMAP.md:202-205`. If wrong: a mock certifies the very boundary
  under test, or a model's prose is mistaken for deterministic evidence.

- D-27 (Cross-format execution resume is UNSUPPORTED, not migrated): A native
  execution record written by an earlier 4.0 development build is not converted
  to the new envelope-digest format. A new binary meeting one refuses as a
  server/store failure and preserves the old bytes; it never fabricates a digest
  or silently reinterprets a record. Ruled by John, 2026-09-07, on PLAN-3's
  flagged assumption A. The conversion is not merely expensive, it is dishonest:
  an old terminal holds only the digest of the literal string
  `execution-log-bound:{phase}` (`crates/cadence/src/store/writer.rs:803,822`),
  ordinary old decisions do not carry the response needed to reverse their
  internal-response hash (`crates/cadence/src/store/model.rs:77`), and the old
  active dispatch records a prompt byte count with no renderer or schema version
  (`crates/cadence/src/execution/model.rs:56`) while replay refuses a length
  mismatch (`crates/cadence/src/execution_service.rs:1062`). No conversion can
  produce a digest of a public envelope from those inputs.
  **What decided it:** the records this migration would serve exist nowhere.
  Verified 2026-09-07 - `.planning/items.jsonl`, `.planning/decisions.jsonl` and
  `.planning/state.json` are all absent from this repository, 4.0.0 has never
  been tagged, and the format was invented three phases ago and has never left
  this tree. Tests build stores in temporary directories and discard them.
  **What this does NOT narrow, stated so a later reader cannot widen it:** the
  v3 compatibility promise at `docs/rationale/architecture-v4.md:23-26` - that
  the Rust server reads a `.planning/` directory from the milestone-close tree
  unchanged, that new frontmatter fields are additive with defaults, and that
  `cadence migrate` covers what cannot be. That promise is about v3 markdown
  artifacts. This decision is about 4.0-dev-native store records. Two different
  compatibility claims that share a directory. D-19, D-21 and D-22 are narrowed
  only in this respect and remain otherwise authoritative. If 4.0.0 ships and a
  user acquires native records, changing that format again is a new decision
  with a real migration obligation. If wrong: a future format change inherits
  this exemption by precedent rather than by argument.

## Acceptance criteria

- [ ] AC1: `tools/list` returns exactly `cadence_version`, `cadence_query` and
      `cadence_apply`, each with input and output schemas. Missing, extra,
      wrong-type and malformed-union arguments to either phase-6 tool return a
      successful `refused` envelope with code and reason, mirrored in
      structured content and text, and a matching boundary refusal decision.
- [ ] AC2: Against a real native-plan fixture, `execute-next` for an explicit
      positive integer phase derives overlap order, selects the first
      outstanding plan, durably records one active dispatch, and returns a
      prompt carrying its opaque body and typed operational fields. Decimal,
      exponent, nonpositive and legacy-only inputs create no dispatch and
      return typed non-`ok` answers.
- [ ] AC3: A real host invokes `/cad-execute` through the configured stdio MCP
      server; a real fixed-rung executor changes source, invokes the dispatched
      task verification and full-suite commands, makes one ordered signed
      conventional commit per task, returns the advertised executor patch, and
      the skill submits it without a report-file or shell fallback.
- [ ] AC4: Applying a valid patch confirms an operation-specific store update,
      preserves unrelated/import/lifecycle/evidence namespaces, verifies Git
      commit shape, and renders a SUMMARY naming exactly the accepted task IDs
      and full SHAs. The next query selects the next overlap-safe plan or returns
      complete after the final accepted plan.
- [ ] AC5: Missing task rows, foreign or stale dispatch identity, unknown state
      keys, unsupported evidence, nonexistent/unsigned/reordered commits and a
      patch for another plan all return `refused`. In every case the execution
      namespace and SUMMARY bytes remain unchanged while one refusal decision
      is durably recorded.
- [ ] AC6: Kill the Rust server after dispatch persistence and before patch
      submission, then start a fresh process with only the project root and
      explicit phase. It returns the same dispatch ID, version, plan, task set,
      base and prompt body; accepting the patch once advances once and replay
      creates no duplicate transition or summary content.
- [ ] AC7: In a real-host run with a temporary PreToolUse registration pointing
      directly to the built Rust binary, model `Write` and `Edit` attempts
      against `.planning/state.json`, `.planning/decisions.jsonl` and a phase
      `SUMMARY.md` are denied, while an authorized project-source write reaches
      the executor. The shipped tree gains no JavaScript or redirect script.
- [ ] AC8: The 257th unique boundary transition records and returns the terminal
      `log-bound` refusal; later calls replay it without log growth. Unit tests
      state that host/model semantics are not proved, and the live UAT records
      the real host and executor observations without assertions on
      model-produced content.

## Flagged assumptions

- **The design's `trace.jsonl` premise is false against the current Rust
  store.** Architecture section 3e still says malformed arguments reach
  `trace.jsonl` (`docs/rationale/architecture-v4.md:217-226`), but the roadmap
  replaced trace and reads with one decisions log
  (`.planning/ROADMAP.md:114-132`), and the shipped native constants are
  `items.jsonl`, `decisions.jsonl` and `state.json`
  (`crates/cadence/src/store/model.rs:8-11`). The honest phase-6 behavior records
  the refusal in `decisions.jsonl`; it does not resurrect `trace.jsonl`.

- **The design's `STATE.md` output premise is stale.** Architecture section 3d
  calls STATE.md and SUMMARY.md rendered outputs
  (`docs/rationale/architecture-v4.md:182-186`), and section 3e names STATE.md in
  the write guard (`docs/rationale/architecture-v4.md:236-239`). The roadmap
  later replaced STATE.md with an internal state snapshot never read by a skill
  (`.planning/ROADMAP.md:133-135`), and phase 4 explicitly forbids a new live
  read of retired STATE.md (`.planning/phases/4/CONTEXT.md:192-201`). Phase 6
  therefore treats `.planning/state.json` as the binary-rendered state and
  renders only the phase SUMMARY markdown. It guards the live files, not a
  retired compatibility name.

- **The roadmap's phrase "finished boundary" is aspirational, not current.**
  The server's sole public tool is `cadence_version`
  (`crates/cadence/src/server.rs:144-185`), its resident accepts six internal
  request variants with no execution request
  (`crates/cadence/src/recall/mod.rs:201-232`), and phase 5 records that no skill
  can reach the implemented internals
  (`.planning/phases/5/SUMMARY.md:122-124`). PLAN-1 must build the strict
  execution producer and PLAN-2 must finish the boundary; this phase is not
  merely registering an existing execute service.

- **Native plan operational data does not exist yet.** Current derivation uses
  plan basenames and excludes PLAN contents from its memo
  (`.planning/phases/4/CONTEXT.md:97-120`), while the design requires stable task
  IDs and verify commands in frontmatter
  (`docs/rationale/architecture-v4.md:385-398`). The strict slice must introduce
  that schema and refuse legacy trees. It cannot run phase 6's own legacy-shaped
  plan files through `/cad-execute`; implementation must use a non-self-hosting
  development process and be proved on a separate native fixture.

- **The full SUMMARY is intentionally not available in phase 6.** The roadmap
  assigns its mechanical-field derivation, attempt history and remaining
  executor behavior to phase 11 (`.planning/ROADMAP.md:810-832`). Phase 6 renders
  the minimum task/commit/deviation/blocker summary needed to prove ownership
  and exact SHA shape. Passing this slice must not be cited as completion of
  phase 11.

- **The live host/model half is not mechanically reproducible by Cargo.** The
  standing constraint requires real usage and written acknowledgement rather
  than a mock model (`.planning/ROADMAP.md:176-183`). An operator-capable live
  run, credentials, signing key and an actual compaction event are environmental
  facts. PLAN-2 separates deterministic tests from UAT and records any missing
  observation as unverified, never as passed.

- **Repository hook registration is not yet a usable Rust path.** The committed
  hook commands all call JavaScript (`hooks/hooks.json:1-38`), and the current
  CLI exposes only `serve` (`crates/cadence/src/main.rs:18-29`). Phase 6 proves
  the Rust guard through temporary live-test settings. Phase 7 extends the one
  Rust guard with the commit rail; phase 18 installs the release path. Editing
  `hooks/hooks.json` now to name an uninstalled binary would make the working
  plugin unusable rather than prove the boundary.

- **A finite append-only log cannot append a fresh refusal forever.** The
  roadmap requires no rotation and refusal past a bound
  (`.planning/ROADMAP.md:621-624`), while the design says every answer reaches
  the audit log (`docs/rationale/architecture-v4.md:217-226`). D-22 makes the
  first over-bound result one persisted terminal refusal and treats later calls
  as replays of that result. If every repeated wire call must instead append a
  new record, the two requirements are mutually exclusive.

- **OQ-2 has no falsifiable negative control on the recorded host.** The roadmap
  says a never-loaded tool remained callable, so a post-compaction call cannot
  prove loaded-tool survival (`.planning/ROADMAP.md:274-282`). D-25 settles the
  product behavior without claiming the missing causal observation. A later
  host that enforces load state can reopen the experiment without changing the
  three-tool boundary.

- **Main-thread context growth is not exposed to the MCP server.** The design
  asks for prompt size and main-thread context growth per phase
  (`docs/rationale/architecture-v4.md:207-210`). The binary can record its prompt
  byte count; no current request shown by the public server carries the host's
  context size (`crates/cadence/src/server.rs:162-184`). The live UAT may record
  host-reported usage when available, but phase 6 cannot make an unavailable
  host metric an acceptance claim.
