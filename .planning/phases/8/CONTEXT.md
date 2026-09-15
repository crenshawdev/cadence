# Phase 8: Config and routing - Context

Gathered: 2026-09-07
Feeds: /cad-plan 8

## Scope boundary

In: Finish configuration's user-facing operations and implement the routing
that consumes saved choices. Independent inspection confirms the brief's
eleven-capability accounting: FOUR already built, THREE partial, FOUR absent
(`.codex-analysis/phase-8-decision-brief.md:5`). This phase has seven unfinished
capabilities, not a new configuration engine. The source baseline is
`cadence/binary-owns-process`, HEAD `6dffb5c1`. Roadmap citations below refer to
that HEAD's file, readable with `git show 6dffb5c1:.planning/ROADMAP.md`; the
working roadmap is concurrently changing, so its line positions are unstable.

Already built, retained as dependencies and regression coverage:

- Effective global/repo merging, read-only defaults and separate stored
  presence/provenance (`crates/cadence/src/config/merge.rs:34`,
  `crates/cadence/src/config/merge.rs:158`,
  `crates/cadence/src/config/tests.rs:6`).
- Alias collapse toward repo and one versioned destination, with requested
  write scope preserved (`crates/cadence/src/config/reload.rs:134`,
  `crates/cadence/src/config/write.rs:19`,
  `crates/cadence/src/config/tests.rs:772`).
- Synchronous invalidation, including identity/byte rereads and refusal after
  failed reload (`crates/cadence/src/config/reload.rs:126`,
  `crates/cadence/src/config/reload.rs:134`,
  `crates/cadence/src/config/tests.rs:393`,
  `crates/cadence/src/config/tests.rs:483`).
- Fourteen frozen-schema leaf retirements: four `parallelization.*`, three
  `review.triggers.phase_diff.*`, `git.auto_close`, and six per-role
  `workflow.max_dispatch_tokens.*` leaves. Projection, absence of defaults,
  write refusal and import preservation already exist
  (`crates/cadence/src/config/mod.rs:11`,
  `crates/cadence/src/config/tests.rs:71`,
  `crates/cadence/src/config/merge.rs:99`,
  `crates/cadence/src/config/write.rs:94`,
  `crates/cadence/src/import/tests.rs:505`).

In, specifically: complete three partial capabilities. `stakes` already has
no effective value; add named disclosure of its original value/layer and enter
the ordinary interview (D-48). Empty repo initialization exists; finish missing
global-parent creation and reuse of an existing active global file in another
project (D-52). Internal reads and single-key transactional writes exist; expose
them and add the atomic batch the interview requires (D-50)
(`crates/cadence/src/config/merge.rs:110`,
`crates/cadence/src/import/mod.rs:223`,
`crates/cadence/src/import/mod.rs:401`,
`crates/cadence/src/import/mod.rs:509`,
`crates/cadence/src/import/mod.rs:672`,
`crates/cadence/src/import/mod.rs:692`).

In, also: build the four absent capabilities: the shared roles/cost/floor
interview; role model/rung resolution; the surviving review-policy and
plan-time risk-floor answer; and GH-256's presence-aware reset correction,
extended to model by D-45. Their current implementations are frozen workflow
and JavaScript, while native public query exposes only `execute-next` and
native execution fixes its rung (`cadence-core/workflows/config.md:278`,
`cadence-core/bin/route.mjs:967`, `cadence-core/bin/route.mjs:1112`,
`cadence-core/bin/route.mjs:1409`, `crates/cadence/src/server.rs:223`,
`crates/cadence/src/execution/dispatch.rs:75`).

Deliberately narrow: saved model and rung choices reach native execution in
this phase, through the existing grouped tools (D-46). Review-policy answers
are configuration/routing facts, not reviewer dispatch or settlement.
The shared interview and initialization service are ready for the intake
commands and accepted suggestions; their wider workflows remain later work
(`cadence-core/workflows/new-project.md:66`,
`cadence-core/workflows/adopt.md:61`,
`cadence-core/workflows/suggest.md:122`,
`cadence-core/bin/route.mjs:1220`,
`crates/cadence/src/execution/dispatch.rs:78`). Phase 8 depends on phase 7's
adaptation of grouped query/apply construction: adding another query variant
PANICS today's `assert_eq!(variants.len(), 1)`, and apply currently deserializes
`ExecutorPatch` directly (`crates/cadence/src/server.rs:241`,
`crates/cadence/src/server.rs:397`). That prerequisite is not already shipped.

Out: rebuilding the four completed capabilities; a third managed-settings
layer; a startup-only snapshot or watcher as the correctness mechanism;
`stakes` expansion, migration state machines or accepted/dismissed migration
state; legacy-file edits. These would contradict the existing merge/reload
and byte-preservation contracts or D-48
(`crates/cadence/src/config/mod.rs:1`,
`crates/cadence/src/config/reload.rs:134`,
`docs/architecture/config-import.md:41`). Live provider discovery/setup,
review delivery/adjudication, general execution, and landing behavior belong
to their later work; this phase does not claim them on the strength of a
routing answer (`.planning/ROADMAP.md:728`, `.planning/ROADMAP.md:910`,
`.planning/ROADMAP.md:1016`, `skills/cad-config/SKILL.md:16`,
`cadence-core/bin/route.mjs:1220`,
`crates/cadence/src/execution/model.rs:31`,
`crates/cadence/src/execution/model.rs:43`). The frozen `cadence-core/`
reference is never modified (`.planning/REQUIREMENTS.md:11`).

## Durable decisions

- D-45 (BOTH resets defeat older pins): A present
  `roles.<role>.effort: null` selects that role's schema default, without
  consulting `model.effort.<role>`. A present `roles.<role>.model: null`
  inherits the session by omitting the dispatch model parameter, without
  consulting `model.overrides.<role>`. Each reset cancels its corresponding
  older pin; resetting both cancels both. ABSENCE still permits legacy
  fallback. An injected schema default is not a user pin: consult stored
  presence and provenance, not only default-filled effective values
  (`crates/cadence/src/config/mod.rs:54`,
  `crates/cadence/src/config/merge.rs:177`). GH-256 specifically requests the
  effort rule; its issue and triage identify absence/value/null precedence
  ([GH-256](https://github.com/crenshawdev/cadence/issues/256),
  `.planning/FILED.md:39`, `cadence-core/bin/route.mjs:971`,
  `cadence-core/config.schema.json:32`). The owner explicitly extends it to
  model, whose present-null fallthrough also contradicts its schema promise
  (`cadence-core/bin/route.mjs:1321`, `cadence-core/bin/route.mjs:1340`,
  `cadence-core/config.schema.json:25`). If wrong: a reset silently retains
  legacy `max`/`opus`, or default injection suppresses legitimate legacy
  fallback for a role the user never pinned.

- D-46 (EXECUTE consumes saved choices now): Config and route operations
  extend `cadence_query` and `cadence_apply`; the public tool list stays
  `cadence_version`, `cadence_query`, `cadence_apply`
  (`crates/cadence/src/server.rs:330`). Native dispatch and the thin execute
  skill must consume the selected model and mapped rung agent when this phase
  ships; returning an unused route is insufficient. This replaces the fixed
  policy/agent at `crates/cadence/src/execution/dispatch.rs:75` and
  `skills/cad-execute/SKILL.md:14`, while preserving the lossless prompt/patch
  loop at `skills/cad-execute/SKILL.md:15`. Only model/rung selection enters
  execution here; reviews and general execution remain later work. Phase 7
  owns the necessary grouped construction adaptation: today's single-variant
  query assertion PANICS if an operation is added, and apply is a direct
  executor-patch decoder, not a general operation union
  (`crates/cadence/src/server.rs:241`,
  `crates/cadence/src/server.rs:397`). Phase 8 must consume and verify that
  prerequisite against the host, retaining strict runtime validation even if
  advertised schemas are less expressive
  (`docs/architecture/boundary.md:56`,
  `docs/architecture/boundary.md:69`). If wrong: saved settings do not change
  dispatch, or the expanded schema prevents the host from loading the tools.

- D-47 (EMPTY means full floor protection): The explicit answer "Keep it
  for every surface" persists
  `review.triggers.risk_surface.waive_routing_floor: []`, globally on first
  run and in the selected layer later. An already-identical stored array may
  be a no-op. Absence is not this answer, and null is not an explicit-write
  substitute. The frozen "writes nothing" option cannot clear an inherited
  or existing waiver (`cadence-core/workflows/config.md:300`,
  `cadence-core/workflows/config.md:416`). Rust array replacement already
  supplies the override, and explicit validation accepts arrays rather than
  null (`crates/cadence/src/config/merge.rs:34`,
  `crates/cadence/src/config/reload.rs:192`,
  `crates/cadence/src/config/write.rs:97`). A repo `[]` deliberately stops
  inheriting future global waivers. This answer concerns the plan-time floor,
  not the actual-diff review's selected surfaces
  (`cadence-core/workflows/config.md:418`). If wrong: the interview reports
  full protection while a surviving waiver still disables the floor.

- D-48 (REMOVE stakes with visible evidence): Keep the landed exclusion.
  Show the original `stakes` value and its originating layer/path, state
  plainly that the level is retired, and enter the ordinary roles interview
  using current settings. Recognize preserved originals, not just active
  config: translation excludes unknown keys and import retains source bytes
  in snapshot evidence (`crates/cadence/src/config/merge.rs:110`,
  `crates/cadence/src/import/mod.rs:92`,
  `crates/cadence/src/import/mod.rs:223`,
  `crates/cadence/src/import/mod.rs:338`). The owner overrides the brief's
  EXPAND recommendation. There is no expansion table, migration state
  machine, or durable accepted/dismissed state. Rationale: this release is
  removing surface; a migration machine for a deleted key is precisely the
  machinery likely to survive indefinitely. Removal promises no equivalent
  old spending profile. Never copy the destructive legacy unset step
  (`cadence-core/workflows/config.md:474`); original bytes stay unchanged,
  including across replay (`crates/cadence/src/import/tests.rs:505`).
  If wrong: retirement silently loses visible intent, or a deleted key acquires
  permanent migration machinery and destroys its rollback evidence.

- D-49 (Reuse the landed config foundation): Preserve the two layers,
  object recursion, replacement for arrays/scalars/null, absence inheritance,
  read-only defaults, repo alias provenance and requested-layer write scope
  (`crates/cadence/src/config/merge.rs:34`,
  `crates/cadence/src/config/merge.rs:158`,
  `crates/cadence/src/config/write.rs:117`). Reuse synchronous refresh and
  admission/final policy validation; a failed reload makes controlling config
  unavailable rather than reviving cached permission
  (`crates/cadence/src/config/reload.rs:126`,
  `crates/cadence/src/config/reload.rs:235`). The fourteen dead leaves stay
  absent from active values and defaults and remain unwritable
  (`crates/cadence/src/config/tests.rs:71`,
  `crates/cadence/src/config/write.rs:94`). If wrong: phase 8 duplicates
  completed work and introduces a second answer for precedence or permissions.

- D-50 (Binary-owned facts and atomic writes): The binary supplies supported
  config facts, current values, layer/presence information, diagnostics,
  validation and writes; the skill conducts the conversation and relays
  answers. It does not edit JSON or run a terminal interview inside MCP stdio
  (`docs/rationale/architecture-v4.md:64`,
  `docs/rationale/architecture-v4.md:70`,
  `docs/rationale/architecture-v4.md:243`). Extend the existing single-key
  transactional seam with an all-or-nothing validated batch; twelve calls to
  `set_config` are twelve transactions, not one interview write
  (`crates/cadence/src/import/mod.rs:509`,
  `crates/cadence/src/config/write.rs:116`,
  `crates/cadence/src/config/write.rs:172`,
  `cadence-core/workflows/config.md:431`). Accepted suggestion values use
  this same write service, with no write before the answer
  (`cadence-core/workflows/suggest.md:122`). Keep import normalization distinct
  from live validation: invalid preferences can be retained as import
  evidence, whereas unusable supported live values refuse
  (`crates/cadence/src/import/mod.rs:122`,
  `crates/cadence/src/config/reload.rs:206`). If wrong: a failed interview
  partially saves choices, or markdown becomes a second configuration writer.

- D-51 (One layer-aware roles interview): Carry six model questions, six
  starting-effort questions and one floor answer. The binary distinguishes
  raw global `roles` presence from injected effective defaults. First run
  persists all twelve role choices globally, even accepted defaults, plus
  D-47's explicit floor answer. Later normal runs show values and source
  layers and write only repo diffs, except D-47's deliberate empty-array pin;
  explicit global editing reopens the full interview
  (`cadence-core/workflows/config.md:278`,
  `cadence-core/workflows/config.md:294`,
  `cadence-core/workflows/config.md:300`,
  `cadence-core/workflows/config.md:312`). Typed model strings remain verbatim
  settings; host compatibility is a resolution concern
  (`crates/cadence/src/config/schema.json:132`,
  `cadence-core/bin/route.mjs:1330`). Intake reuses this service rather than
  owning another interview (`cadence-core/workflows/new-project.md:66`,
  `cadence-core/workflows/adopt.md:61`). If wrong: default-accepting users
  are repeatedly treated as unanswered, or project answers overwrite global
  choices and diverge between entry points.

- D-52 (Finish global lifecycle without template copying): Reuse native
  first touch, which creates the planning root and writes projected repo
  settings (`crates/cadence/src/store/filesystem.rs:49`,
  `crates/cadence/src/import/mod.rs:744`). Add creation of a legitimately
  missing global parent and reuse of an already-valid active global config
  by a new project. Preserve its bytes and source scope; distinguish shared
  global input from foreign partial repo outputs. Current first touch rejects
  either as "unrelated partial output", omits missing-parent global
  registration, and the writer requires that parent already exist
  (`crates/cadence/src/import/mod.rs:672`,
  `crates/cadence/src/import/mod.rs:692`,
  `crates/cadence/src/config/write.rs:159`,
  `crates/cadence/src/store/filesystem.rs:119`). If wrong: the first machine
  interview cannot save, or configuring one project prevents initializing
  the next; template copying also turns defaults into unrequested pins.

- D-53 (Resolve roles by presence and the explicit rung map): Subject to
  D-45, stored role keys win over their legacy counterparts, then effort uses
  its schema default and model inherits the session. Defaults in
  planner/analyzer/verifier/reviewer/executor/checker order remain
  high/high/high/medium/high/low, with null model defaults
  (`crates/cadence/src/config/schema.json:132`,
  `crates/cadence/src/config/schema.json:162`). Use the explicit role/rung
  agent map; suffix inference is false for analyzer and checker
  (`cadence-core/bin/lib/rung-agent.mjs:49`). Retry escalation is opt-in and
  moves once from the configured starting rung to the next available rung
  for any attempt greater than one; attempts two and three select the same
  rung, and the top holds (`cadence-core/bin/route.mjs:170`,
  `cadence-core/bin/route.mjs:1031`). Unsupported non-null role model strings
  warn and omit the model parameter without reviving a legacy override;
  only a successful legacy model override sets the inherited `pinned` flag
  (`cadence-core/bin/route.mjs:1315`). Return the source and explanation,
  including reset versus absence; do not infer user intent from `pinned`
  alone. If wrong: retries silently increase spending on every attempt,
  dispatch uses the wrong effort file, or an invalid model revives an old pin.

- D-54 (Return the surviving policy bundle): A route answers role, mapped
  agent/rung, optional model and source, attempt/escalation/pin explanation,
  review gates and per-trigger reviewer sets/tiers/efforts, answered risk
  surfaces, deep-verification recommendation, reasons and diagnostics
  (`cadence-core/bin/route.mjs:1409`). Exclude retired `phase_diff` using the
  existing schema disposition (`crates/cadence/src/config/mod.rs:16`).
  Reviewer filtering checks configured model IDs at the selected tier;
  `claude-subagent` always qualifies, and an empty surviving set falls back
  to it with a reason (`cadence-core/bin/route.mjs:1220`). This is not live
  provider availability and does not invoke or settle reviews. If wrong:
  downstream skills reconstruct policy in prose, or configuration claims
  that a reviewer actually ran.

- D-55 (The floor has two effects only): Planner and assumptions-analyzer
  bypass the plan-time floor. With no phase, report not computed; otherwise
  read the named plan's declared scope or the phase union
  (`cadence-core/bin/route.mjs:590`). Missing/unreadable plan scope and
  unreadable existing declared bodies raise conservatively; a declared new
  file contributes its path without a body, not an unreadable marker
  (`cadence-core/bin/route.mjs:473`, `cadence-core/bin/route.mjs:709`). An
  unwaived match raises the deep-verification recommendation and can raise
  the plan gate to blocking. A valid explicitly stored plan gate wins, even
  when equal to its schema default (`cadence-core/bin/route.mjs:1079`,
  `cadence-core/bin/route.mjs:1112`). The floor changes neither model nor
  rung nor actual-diff review selection; waivers affect this floor alone
  (`cadence-core/workflows/config.md:405`,
  `cadence-core/workflows/config.md:418`). If wrong: a clean named plan
  inherits a risky sibling's floor, an unreadable scope gets a discount, or
  the floor overrides a user gate or spending choice.

- D-56 (Record decisions without inventing observations): Compose live
  routing with the existing store's `Decision::Routing`, including config
  provenance and requested effort; observed effort and receipt remain absent
  without evidence (`crates/cadence/src/store/model.rs:60`,
  `crates/cadence/src/store/decisions.rs:11`). Do not resurrect direct trace
  appends or swallowed recording failures (`cadence-core/bin/route.mjs:1365`).
  Preserve the admitted dispatch's route on replay; new settings govern the
  next new dispatch, not a silent rewrite of an in-flight identity
  (`crates/cadence/src/execution_service.rs:241`,
  `crates/cadence/src/execution_service.rs:304`,
  `crates/cadence/src/execution_service.rs:356`). Current config validation
  still applies to resumed operations (`crates/cadence/src/import/mod.rs:407`).
  If wrong: history attributes a worker to settings it never received, or a
  requested effort becomes false proof of what the host actually used.

- D-84 (AC16's refusal is best-effort at the hook boundary, and its limit is
  stated rather than promised away): The config-write denial covers the attempt
  the PreToolUse hook can actually see - ordinary paths, relative and absolute
  spellings, dot segments, aliases and symlinked parents that resolve at check
  time. The lexical-normalization hole IS in scope and is a defect to fix:
  `crates/cadence/src/guard/mod.rs:162` rewrites backslashes and `:172`
  normalizes lexically before resolving, so `jump/../config.v4.json` with
  `jump` a symlink collapses to a path that was never the real target, and a
  POSIX file literally named `raw\alias` becomes a different path entirely.
  What is OUT of scope is the time-of-check/time-of-use window: `guard::run`
  resolves, exits SUCCESS, and the host writes afterward
  (`crates/cadence/src/guard/mod.rs:99`), so a symlink retargeted in between
  evades it and no check that runs beside the write rather than owning it can
  close that. Closing it would mean routing the write through the binary, which
  is a larger rearchitecture than these four gap closures and is not authorized
  here. So: fix the resolution defect, do NOT claim an unconditional guarantee,
  and record the window as a known limit in the plan and in
  `.planning/phases/8/MANUAL.md`. Ruled by the owner 2026-09-08 after the
  blocking plan review on PLAN-6.
  If wrong: AC16 reads as a security guarantee the code does not deliver, and
  the next verify pass catches it as a gap exactly as this one did.

## Acceptance criteria

- [ ] AC2: Public config reads show stored/effective values, presence and
      source layer. A valid multi-key apply saves all answers in one durable
      transaction and reports changed keys and destination; an invalid value,
      retired/unknown key, wrong requested scope, concurrent conflicting edit
      or failed reload saves none of the batch. Byte comparisons before/after
      refusal and session reopen prove this, including aliased destinations
      (`crates/cadence/src/config/write.rs:90`, `crates/cadence/src/config/write.rs:117`, `crates/cadence/src/config/write.rs:159`).

- [ ] AC3: In isolated first-touch fixtures, a missing planning root and
      missing global parent support a saved first global interview; a second
      new project reuses that active global config without refusing or
      changing its bytes. No unchosen schema defaults appear in stored repo
      settings, foreign partial repo outputs still refuse, and legacy source
      bytes remain identical (`crates/cadence/src/import/mod.rs:672`,
      `crates/cadence/src/import/mod.rs:692`,
      `crates/cadence/src/import/mod.rs:744`,
      `crates/cadence/src/import/tests.rs:505`).

- [ ] AC4: A config-facts read returns all thirteen interview subjects - six
      model, six effort and the floor - each carrying its current value and the
      source layer that value came from. A subject with no stored value reports
      the default and names defaults as its layer. Missing, extra or
      wrong-ordered subjects fail.
- [ ] AC5: A native resolver matrix covers BOTH resets independently and
      together, for all six roles: with global legacy effort `max` and model
      `opus`, explicit repo role-effort null selects that role's schema
      default and explicit repo role-model null omits the model parameter.
      With both role leaves absent from stored layers, legacy `max`/`opus`
      still win despite injected defaults. Explicit non-null role values win
      over legacy values, and inherited global role values are not mistaken
      for absence merely because repo lacks them. Assert the selected value
      AND its source/reset explanation (`crates/cadence/src/config/merge.rs:177`).

- [ ] AC6: Starting with a global waiver and then an existing repo waiver,
      choosing protection for every surface stores a literal `[]` in the
      selected layer and leaves no effective waived category. An unwaived
      risky declared scope now raises the floor under default gate policy;
      the actual-diff surface selection remains unchanged. First-global
      acceptance also stores `[]`; a stored identical answer may leave bytes
      unchanged (`crates/cadence/src/config/merge.rs:34`).

- [ ] AC7: Import fixtures with different global/repo `stakes` values,
      including an unrecognized value, show each exact original value and
      layer/path with a plain retirement message and enter the ordinary
      interview using current settings. No old-level expansion pre-fills
      choices; no migration accepted/dismissed state is written. Original
      legacy bytes and stored source evidence survive interview and reopen;
      ordinary reads do not restart a migration cycle
      (`crates/cadence/src/import/mod.rs:223`,
      `crates/cadence/src/import/mod.rs:338`,
      `crates/cadence/src/import/tests.rs:505`).

- [ ] AC8: Resolver fixtures assert the six schema defaults and every shipped
      role/rung mapping; retry off holds, retry on advances one available
      rung, attempts two and three agree, and the top holds. A custom model
      string survives storage verbatim; an unsupported role string warns and
      omits the dispatch model parameter without falling through to legacy.
      Only a supported legacy override sets `pinned`, and source/reasons
      identify every selection.

- [ ] AC9: Routing fixtures distinguish a clean named plan from a risky phase
      union, pre-plan bypass from no-phase/not-computed, and readable new-file
      declarations from unreadable existing scope. Unwaived risk raises only
      deep verification and the non-explicit plan gate; an explicitly stored
      gate equal to its default still wins. Return surviving gate, reviewer,
      tier, effort and surface answers; missing configured provider IDs cause
      a named filter/fallback without a provider invocation. No `phase_diff`
      answer returns (`crates/cadence/src/config/mod.rs:16`).

- [ ] AC10: The boundary advertises exactly `cadence_version`, `cadence_query`
      and `cadence_apply` with input and output schemas, and returns typed refusals for malformed config and route
      calls. With executor model `sonnet` / effort `high` saved, a new dispatch
      resolves to model `sonnet` and agent `cad-executor`; with `opus`/`xhigh`
      saved, a separate new dispatch resolves to `opus` and
      `cad-executor-xhigh`. Resetting model to null omits the model parameter
      rather than substituting a default. Each case asserts the admitted
      dispatch ID, the resolved agent/model/rung with its reason trail, and the
      byte-exact prompt the binary emits. This decides what the binary resolves
      from a saved setting; it does not decide whether any consumer honours
      that resolution.
- [ ] AC11: A recorded dispatch stores routing evidence naming the chosen
      agent, model and rung, the source settings and the requested effort.
      Re-reading an active dispatch after a valid setting change returns its
      originally admitted choice unchanged; the next new dispatch uses the new
      setting. Fields with no recorded observation stay absent rather than
      being inferred from the requested rung. An injected recording failure
      cannot report a successfully recorded dispatch
      (`crates/cadence/src/store/model.rs:60`,
      `crates/cadence/src/store/decisions.rs:11`,
      `crates/cadence/src/execution_service.rs:356`).

- [ ] AC12: Accepting first-run defaults persists all twelve global role leaves
      plus the floor answer in one write, and a reopen of the same global
      address is no longer first run.
- [ ] AC13: Re-answering a role with its existing value creates no repo pin,
      and changing exactly one role leaf writes only that leaf's diff. Byte
      comparison of the untouched leaves proves it.
- [ ] AC14: An answer marked explicit-global writes to the global address and
      leaves the repo layer unchanged.
- [ ] AC15: Intake and accepted-suggestion fixtures resolve through the same
      config service and produce identical stored bytes for identical answers.
      An unanswered suggestion writes nothing.
- [ ] AC16: The native config path obtains its facts and performs its writes
      through the grouped tool operations, with no separate write path. A write
      attempted outside those operations is refused.
## Flagged assumptions

- **The roadmap's startup claim is factually wrong.** At the recorded HEAD,
  `.planning/ROADMAP.md:708` says "merged once at startup". `load()` resolves
  identities and rereads bytes BEFORE considering a cache hit, and session
  config access calls refresh (`crates/cadence/src/config/reload.rs:134`,
  `crates/cadence/src/import/mod.rs:401`). The working copy's line positions
  are changing; the quoted claim and HEAD citation identify the error without
  depending on the concurrent edit. No roadmap edit belongs to this context.

- **The retirement assignment is overbroad and stale.**
  `.planning/ROADMAP.md:713` says "Retired-key migration lands here". All
  fourteen frozen-schema retirements already project out at import, have no
  effective defaults and refuse writes (`crates/cadence/src/config/merge.rs:99`,
  `crates/cadence/src/config/merge.rs:180`,
  `crates/cadence/src/config/write.rs:94`,
  `crates/cadence/src/config/tests.rs:71`). `stakes` is genuinely partial:
  unknown-key exclusion exists, named disclosure does not
  (`crates/cadence/src/config/merge.rs:110`,
  `crates/cadence/src/import/mod.rs:92`). D-48 completes that small remainder.

- **The invalidation assignment is already discharged.**
  `.planning/ROADMAP.md:723` assigns invalidation here, but failed refresh
  clears the current generation and final policy validation refreshes again
  (`crates/cadence/src/config/reload.rs:126`,
  `crates/cadence/src/config/reload.rs:235`). Existing assertions cover
  unchanged size/time, rename, alias retarget, failed reads and policy changes
  after admission (`crates/cadence/src/config/tests.rs:393`,
  `crates/cadence/src/config/tests.rs:431`,
  `crates/cadence/src/config/tests.rs:483`,
  `crates/cadence/src/config/tests.rs:542`). New consumers must use the seam;
  its mechanism is not new phase-8 work.

- **Nothing serializes two projects writing the shared global config.** The
  store takes an exclusive `flock` on its own root directory inode
  (`crates/cadence/src/store/filesystem.rs:157`), which serializes writers
  within one planning root and cannot serialize across roots. Two projects
  editing global settings can therefore race and silently overwrite an accepted
  change. This phase's whole claim is that a saved setting reaches real
  dispatch, and a setting that can vanish under a concurrent project undercuts
  it. Not asked for by any decision or criterion here; name an owner before
  planning, or state deliberately that concurrent global writes stay
  unserialized.

- **GH-256 ownership labels lag its behavioral assignment.** The issue body
  asks for null-as-default effort semantics, including a legacy `low` example;
  its triage explicitly distinguishes absent/value/null. The GitHub issue's own
  labels and a later comment still name phase 7; the roadmap table was corrected
  to agree with the phase-8 detail that assigns the defect here ([GH-256](https://github.com/crenshawdev/cadence/issues/256),
  `.planning/ROADMAP.md:313`, `.planning/ROADMAP.md:718`,
  `cadence-core/bin/route.mjs:971`). Phase 8 owns it by the owner's instruction.
  Model reset is the explicit extension in D-45, not a claim that GH-256
  originally requested model behavior.

- **The two initialization gaps are source deductions, not reproduced runs.**
  Existing empty-root tests prove creation without a template, not a first
  global save or second-project reuse
  (`crates/cadence/src/import/tests.rs:615`). The rejection at
  `crates/cadence/src/import/mod.rs:672`, omitted registration at
  `crates/cadence/src/import/mod.rs:692` and parent requirement at
  `crates/cadence/src/store/filesystem.rs:119` establish the missing paths.
  AC3 must exercise them. The roadmap's template-copy sentence accurately
  describes its frozen workflow reference; it is not native initialization
  guidance (`.planning/ROADMAP.md:704`,
  `crates/cadence/src/import/mod.rs:744`).

- **Four host model aliases and question batching are historical evidence.**
  The frozen resolver lists `opus`, `sonnet`, `haiku`, `fable`; the workflow
  assumes four-question/four-option batches
  (`cadence-core/bin/route.mjs:185`,
  `cadence-core/workflows/config.md:320`). Neither proves what the installed
  host accepts or honors today. Preserve the thirteen answers and verify
  host-compatible delivery. AC10 requires actual calls and cannot infer
  observed effort from the requested rung
  (`docs/architecture/boundary.md:50`,
  `crates/cadence/src/store/decisions.rs:11`).

- **The older retirement registry is a different set.** Its seventeen names
  include `stakes`, old profile/escalation keys, risk overrides and retired
  pre-ship leaves (`cadence-core/bin/lib/retired-keys.mjs:37`,
  `cadence-core/bin/lib/retired-keys.mjs:185`). Rust generically excludes and
  refuses unknown keys, but that is not seventeen bespoke migrations or
  replacement messages (`crates/cadence/src/config/merge.rs:110`,
  `crates/cadence/src/config/write.rs:91`). The four-built count covers the
  fourteen frozen-schema leaves; D-48 names the specific `stakes` disclosure
  owed here without introducing a general migration engine.

- **Policy examples are not routing implementations or test results.**
  Native execution still exposes `ExecutorRung::Fixed` and disabled reviews
  (`crates/cadence/src/execution/model.rs:31`,
  `crates/cadence/src/execution/model.rs:43`); a stored routing record type
  does not select a role (`crates/cadence/src/store/model.rs:60`). This context
  verified implementations, test assertions and the schema census by reading
  them; it did not run builds, fixture tests or a live host. All acceptance
  boxes remain open.
