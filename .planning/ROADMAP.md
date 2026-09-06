# Roadmap: excerpt folds in, the binary owns process

## Overview

**Opened 2026-09-05. This cycle ships as `4.0.0` and it is a rewrite, not a
port.** `cadence-core` becomes a session-resident server in Rust: one
long-running process per session that the main thread and every subagent share.
The binary owns truth about process, the model owns engineering judgment, and
the skill orchestrates between them with no hidden state machine. The design is
`docs/rationale/architecture-v4.md`, written 2026-09-05; this roadmap is the
execution order, not a second copy of it.

**The frozen reference is the tag `v3.7.12`**, an annotated tag whose commit is
`c39bbd8c`. That tree is the reference implementation and the golden-test spec.
It stays frozen until the Rust server reaches parity. The maintenance line is
the branch `3.x`, cut from that same commit; nothing on it is ported forward
automatically.

**Size of what is being replaced, measured 2026-09-05.** 125 non-test `.mjs`
files under `cadence-core/`, 2,514,184 bytes, plus 113 test files at 3,330,036
bytes. Those do not port one to one. The change is architectural, so much of
the JavaScript is prose-adjacent glue with no counterpart in the server design,
and the test bytes become the spec for golden tests against the binary rather
than a port target.

**What is already decided and is not reopened here.** No Bun bridge and no
incremental port: it is rewritten whole, in Rust. No parallel execution in
4.0.0, so worktree dispatch, `worktree-base.mjs`, the `baseRef` preflight, the
`phase_diff` trigger and the four `parallelization.*` keys are dropped rather
than ported. No JavaScript prototype of the state-patch design. excerpt folds
in as the read and search layer, opt-in at setup, with the invariant that a
prompt Cadence emits with excerpt absent is byte-identical to today. The
zero-dependency ethos is revoked for the Rust codebase and replaced by a
Cargo.lock-pinned offline cross-compile from one CI job.

**The order, and why it is this order.** Phase 1 seeds the crate from excerpt,
which already carries rmcp, tree-sitter, the ripgrep crates, the PreToolUse hook
and the cross-compile CI, so the skeleton is a move rather than a greenfield.
Phase 2 builds the golden harness before any domain code, so parity is
measurable from the first module rather than asserted at the end. Phase 3 takes
one vertical slice end to end, and every later module follows its shape.

**The 3.x baseline spike was cut on 2026-09-05.** It was scheduled first on the
claim that it expires, but every task mined the frozen archive at
`/projects/cadence-archive-v3.7.12/.planning/` rather than measuring a running
3.x, and a frozen archive does not expire. It also measured tokens, the axis
section 7 of the design doc explicitly declines to sell the architecture on. The
rewrite decision is already taken, so a before-and-after figure is a scorecard
that can be produced from that archive whenever one is wanted. `BAS-01` is
deferred, not dropped.

**Out of scope, deliberately.** The near-term 3.x prose fixes in section 8 of
the architecture doc are a separate decision and are not scheduled here.
`GH-140`, whether Cadence grows a Codex host adapter, becomes sharper once the
boundary is a binary rather than prose, but the adapter decision is not made in
this cycle. The open GitHub issues filed against the JavaScript tree are being
triaged by hand and are not carried into these phases.

## Open Questions

- **OQ-1 - is a ToolSearch preamble needed at all, and if so does a conditional
  one get skipped when the schema is already loaded.** Moved to phase 1 on
  2026-09-05. The original question assumed the preamble was required and only
  asked what it costs: unconditional, about 900 tokens per skill invocation
  across `/cad-context`, `/cad-task`, `/cad-debug` and `/cad-adopt`, so roughly
  3,600 tokens per run for one useful load. A direct probe on 2026-09-05
  settled it against a purpose-built two-tool MCP server with settings
  isolated: a tool never loaded through `ToolSearch` was called directly and
  returned normally, so deferral is NOT enforced at call time on CLI 2.1.261.
  A paired run showed the agent volunteering a `ToolSearch` anyway, saying it
  had to load the schema first, so the ~900-token load is a convention the
  model follows and not a requirement. The question that remains is whether a
  preamble should exist at all, and if so whether it should tell the model to
  SKIP the load. Phase 1's skeleton binary is no longer needed to answer OQ-1.
- **OQ-2 - do loaded tools survive compaction.** Moved to phase 2 on 2026-09-05.
  The CLI carries `preCompactDiscoveredTools` and a "carried from compact
  boundary" string, which is suggestive and not an observation. A compaction was
  observed on 2026-09-05 and a tool loaded before the boundary was callable
  after it, but the paired negative control failed: a tool never loaded was
  callable too, so the observation does not separate survival from the
  enforcement simply being off. It is answered against the binary in phase 1,
  where an unloaded tool has a defined failure to compare against.

## Phases

- [x] **Phase 1: The crate skeleton** - a named binary that builds, cross-compiles to four targets from one CI job, and serves a minimal MCP tool surface
- [ ] **Phase 2: The golden harness** - fixtures at the frozen tag and a Rust test that diffs the binary against recorded JavaScript output
- [ ] **Phase 3: The L0 persistence kernel** - the four modules every later port depends on, each carrying a design decision rather than a straight port
- [ ] **Phase 4: One vertical slice** - `/cad-execute` end to end, the shape every other command follows
- [ ] **Phase 5: The L1 leaf ports** - 41 modules that import no other lib module, portable in parallel once L0 stands
- [ ] **Phase 6: L2 and the shared planning core** - the ten layered lib modules and `planning/core.mjs`, the gate every handler waits on
- [ ] **Phase 7: G4 stage 1 - the read-only lifecycle handlers** - `cursor-get`, `status`, `audit`, `replay-check` against frozen fixture trees
- [ ] **Phase 8: G4 stage 2 - the planning and verification writers** - `cursor-set`, `seed-reqs`, `uat`, `criteria-coverage`, proven by write/read round trips
- [ ] **Phase 9: G4 stage 3 - the receipt chain** - `trace`, `reads`, `cite-count`, `task-record`, including rotation under competing writers
- [ ] **Phase 10: G4 stage 4 - the risk settlement loop** - `detect-surfaces`, `lease-check`, `adjudication`, `deferred-record`, `deferred-list`, `risk-check`
- [ ] **Phase 11: G4 stage 5 - phase completion** - `phase-done`, with injected second-write failures separating untouched refusal from partial application
- [ ] **Phase 12: G4 stage 6 - the evidence carries** - `risk-carry` and `deferred-carry`, tested for idempotence, collision and carried homes
- [ ] **Phase 13: G4 stage 7 - renumber and prune** - `renumber` and `milestone-prune`, the ordered moves and partial failures that end the lifecycle
- [ ] **Phase 14: The remaining handler clusters** - command discovery, declared-work bounds, and the capture and recall group
- [ ] **Phase 15: The L3 hook and history layer** - `subagent-trace`, `why-corpus`, `why-render`, the three modules that sit above L2
- [ ] **Phase 16: The entry scripts** - the seventeen top-level CLIs that own git, forge, config, routing and review behavior
- [ ] **Phase 17: Contract enforcement** - the obligations that live today as prose instructions to a model, made behavior the binary enforces
- [ ] **Phase 18: The parity gate** - full parity with `v3.7.12` asserted by output diff AND contract assertions, together
- [ ] **Phase 19: The release path** - a tagged release that publishes four checksum-verified archives, and a SessionStart hook that fetches and installs the pinned binary

## Phase Details

### Phase 1: The crate skeleton

**Goal.** A `cadence` binary builds, cross-compiles from one CI job, and serves
a minimal MCP tool surface.

Seeded from excerpt, which already carries the dependency set and the CI. Adds
the binary's name and the typed envelope vocabulary from section 3a of the
design doc. No domain modules yet.

OQ-1 and OQ-2 were dropped from this phase on 2026-09-05: a direct probe against
a throwaway two-tool MCP server answered OQ-1 the same day and reduced OQ-2 to a
question whose answer changes nothing.

**The release path was moved out on 2026-09-05, after the plans were written.**
The original phase 1 carried a second plan for the release workflow, the
checksum pin and the SessionStart bootstrap. Nothing is downloadable until
`4.0.0` is tagged, so that plan's own honest outcome was a bootstrap that
no-ops on every machine and three acceptance criteria that could not be
observed at phase close. It is now phase 19, where a release actually exists.
Phase 1 is the crate skeleton and nothing else.

### Phase 2: The golden harness

**Goal.** Parity against `v3.7.12` is a test that runs, not a claim.

Fixture `.planning` trees captured at the frozen tag, the JavaScript output
recorded for the operations phases 3 through 16 will implement, and a Rust test
that diffs the binary's answers against those recordings. Built before domain
code so that every later module lands against a measurable target.

Sized 2026-09-05 against the frozen tag: **40 fixture bundles over 72 runtime
operations** - 43 planning subcommands and 29 reached through the entry scripts,
plus 4 tooling selectors, 76 inventoried in total.

**This phase validates the measuring instrument, not parity.** Nothing is ported
when it closes, so most assertions are written here and activate per later port
stage. Its close must not be read, by a verifier or by a human, as evidence that
any parity claim holds.

The recording mechanism has to neutralize every source of nondeterminism without
neutering the assertion: timestamps, correlation ids, absolute paths, git SHAs,
hostname, PID, iteration order and locale. Two clock-field normalizations are
not enough - read-side failure outputs carry absolute paths.

### Phase 3: The L0 persistence kernel

**Goal.** The four modules every later port depends on exist in Rust with their
observable behavior preserved exactly.

`lease-grammar` (5,423 B), `planning-files` (143,256 B), `capture-file`
(19,692 B) and `trace` (121,994 B) - 290,365 bytes measured at the frozen tag.
These are the true phase-0 surface: no handler can be ported before they stand.

**All four are hand-rolled, decided 2026-09-05 after a crate survey.** No crate
reproduces the behavior that has to be preserved: `atomicWrite`'s PID/sequence
sibling temp with a deliberate absence of fsync and deliberate target-symlink
replacement; the capture lock's exclusive-create with stale takeover across
separate processes; byte-preserving markdown round-trips that keep fences,
section boundaries, CRLF/BOM asymmetry, ordering and untouched text; and the
domain-specific rotation and carry rules of the event log.

**A known defect must be decided here rather than ported blind.** The capture
lock's stale takeover can admit two simultaneous owners, and ARCHIVE - which
shares that lock - lacks the compensating retries CAPTURE has. Parity would mean
porting a data-loss path. Decide at plan time whether to preserve it or fix it.

Three compatibility rules freeze before any handler lands: JS numeric acceptance
and raw phase spelling, directory-result sort order, and JSON key order with
absent-versus-null handling, where fixed field order has a JS exception that puts
numeric property names ahead of ordinary ones.

### Phase 4: One vertical slice

**Goal.** `/cad-execute` runs end to end against the binary, and its shape is
the template every other command follows.

The five-step loop from section 3c: ask for the next dispatch, refuse with a
reason or hand back a prompt, invoke the executor, return a typed state patch,
repeat. The tool schema is the patch schema, and the BINARY validates
against it: a malformed argument comes back as a `refused` envelope naming
what was wrong, not an MCP-layer rejection (design doc 3e, revised
2026-09-05). Proves the boundary works
before the remaining modules are built against it.

**It runs on a strict subset of the foundation, which is why it sits here rather
than after the ports.** Measured 2026-09-05: roughly 19,004 bytes of foundation
source plus 4,503 bytes of `lease-check` spans and the 756-byte SUMMARY
template. Module-level imports do not bound it - `planning/core.mjs` imports L2,
but the six functions the slice needs (`ok`, `fail`, `read`, `listPlanFiles`,
`planNumber`, `gitLine`) use no L2 symbol, so a function-level port pulls none
of L2 in.

**Six conditions are not stubbable.** Fake any of them and the slice proves
nothing: real host-to-MCP-to-Rust calls including bad patch arguments that come
back `refused` with reasons; binary-owned dispatch selection built from real
files and state; a real executor doing work, running tests and committing;
scoped lossless patch application where a rejection leaves state unchanged;
durability across a restart between dispatches, recovering the same outstanding
work; and binary-owned STATE and SUMMARY rendering with the model's attempts to
bypass that boundary denied.

Legitimately stubbable, and to be reported as stubbed rather than passed: fixed
executor rung and configuration, reviews explicitly disabled, an explicit
integer phase with legacy trees refused, a fixed branch policy, and no trace
rotation - refusing past the bound instead.

### Phase 5: The L1 leaf ports

**Goal.** The 41 lib modules that import no other lib module exist in Rust.

480,634 bytes across 41 modules, of which **40 are ported and one is not**:
`lib/repo-auto-close.mjs` (3,088 B) exists solely as "the ONE read of
`git.auto_close`", and 4.0.0 retires that key (see phase 18), so it is deleted
rather than ported. 477,546 bytes land here.

Two neighbours shrink without disappearing: `close-decision.mjs` loses
`decideGateHalt`, the autonomous-close halt, and keeps `resolveReapBranch` and
`decideCleanup` which serve ordinary land cleanup; `publish-decision.mjs` keeps
deciding whether a mutating action may run and returning the byte-exact git
argv, with the authorization arm simplified to "the engineer authorized it".

Because they are leaves, they carry no ordering constraint among themselves and
can be split across plans freely once L0 stands. This is the largest phase by
module count and the least entangled by dependency.

### Phase 6: L2 and the shared planning core

**Goal.** The ten layered lib modules and `planning/core.mjs` stand, and every
handler cluster is unblocked.

344,432 bytes of L2 plus core's 60,362. This is the gate: `planning/core.mjs`
imports `arg-contract`, `config-merge`, `deferred-queue` and `read-trace` at
`cadence-core/bin/planning/core.mjs:27-31`, and every handler imports core, so
nothing downstream starts until this closes.

### Phase 7: G4 stage 1 - the read-only lifecycle handlers

**Goal.** `cursor-get`, `status`, `audit` and `replay-check` answer correctly
against frozen trees.

Golden reads over complete, incomplete and colliding fixture trees. Writers can
remain absent because the fixtures supply their artifacts, which is what makes
this stage independently green.

### Phase 8: G4 stage 2 - the planning and verification writers

**Goal.** `cursor-set`, `seed-reqs`, `uat` and `criteria-coverage` write what
they should and refuse what they must.

Write-then-read round trips, untouched-byte assertions on everything the write
did not target, and malformed-input refusals. Phase completion and requirement
state changes stay pending until stage 5.

### Phase 9: G4 stage 3 - the receipt chain

**Goal.** `trace`, `reads`, `cite-count` and `task-record` produce and consume
receipts correctly.

Append, render and rotation tests, read joins, and record-to-recall paths.
Rotation must be proven to preserve generations under competing writers, which
`O_APPEND` alone does not guarantee.

**A knowingly half-enforced invariant.** Receipts can be validated here, but the
native risk consumer and the adjudication producers do not arrive until stage 4.
That gap is deliberate and must be recorded, not silently tolerated.

### Phase 10: G4 stage 4 - the risk settlement loop

**Goal.** `detect-surfaces`, `lease-check`, `adjudication`, `deferred-record`,
`deferred-list` and `risk-check` close the loop stage 3 left open.

Synthetic git ranges driving record-to-receipt-to-risk-status sequences, and
deferred-to-adjudicated sequences. Completes G4's risk settlement; integration
with routing, the review provider and landing stays with the parity gate.

### Phase 11: G4 stage 5 - phase completion

**Goal.** `phase-done` transitions a phase and refuses cleanly when it cannot.

Complete and undo transitions, plus injected second-write failures. The
acceptance that matters is telling an untouched refusal apart from a partial
application - the module performs the document transition itself.

### Phase 12: G4 stage 6 - the evidence carries

**Goal.** `risk-carry` and `deferred-carry` move evidence without losing it.

Idempotence, destination collision, symlink and carried-home tests.

**A knowingly half-enforced invariant.** Evidence can survive removal here, but
the carry-before-prune ordering is not exercised until stage 7.

### Phase 13: G4 stage 7 - renumber and prune

**Goal.** `renumber` and `milestone-prune` complete the lifecycle, and the
carry-prune-land ordering finally holds end to end.

Ordered moves, partial failures, archive residue and recall. `renumber`'s stop
discipline and prune's continue discipline stay distinct and must not be
unified. This stage closes the invariants stages 3 and 6 left half-enforced.

**The JavaScript `renumber` carries a defect this port must not reproduce.**
Measured 2026-09-05: `renumber insert` shifts `Phase K` tokens and `phases/K/`
paths inside COMPLETED, shipped requirement rows, not only live ones, silently
rewriting historical evidence into plausible-looking wrong values. Parity here
means parity with the intent, and the deviation must be recorded explicitly.

### Phase 14: The remaining handler clusters

**Goal.** Command discovery, the declared-work bounds and the capture and recall
group all stand.

`detect-commands` (11,257 B), `plan-size` with `criteria-size` (18,850 B), and
the capture cluster of `capture`, `capture-check`, `capture-sections`,
`debt-harvest` and `recall` (33,038 B) - 63,145 bytes over 8 modules. Small
against G4, and independent of it.

### Phase 15: The L3 hook and history layer

**Goal.** `subagent-trace`, `why-corpus` and `why-render` stand on top of L2.

109,084 bytes. These are the only lib modules three edges deep, and they back
the SubagentStop hook and `/cad-why`.

### Phase 16: The entry scripts

**Goal.** The seventeen top-level CLIs behave as they do at the frozen tag.

469,273 bytes across `config`, `forge`, `git-branch`, `git-guard`,
`git-publish`, `issue-check`, `issue-filing`, `land-cleanup`, `planning`,
`read-trace`, `release-bump`, `review-provider`, `route`, `skim`,
`subagent-trace`, `weight` and `why`. `self-verify`, `test` and `worktree-base`
are excluded - the first two are CI support, the third dies with parallel
execution.

### Phase 17: Contract enforcement

**Goal.** Obligations that exist today only as prose instructions to a model
become behavior the binary enforces.

Measured 2026-09-05 across 88 files: **298 command sites** (15 parallel-only,
4 embedded `node -e` programs), **137 prose-only obligation families** and
**70 refusal and formatting contract families**. The 298 command sites are
distributed into the port phases that own them; this phase owns the obligations
and the refusal contracts, which belong to no single module.

**These are the parity breaks a golden-output diff cannot catch**, because their
failure mode is ordering, timing, cross-session concurrency or an absent
refusal. The eight ranked worst: preserving risk and deferred evidence before
prune and land (`cadence-core/workflows/milestone.md:103`); writing completion
only after a green suite (`skills/cad-executor-contract/SKILL.md:92`); staging
the actual fix before scanning the index (`cadence-core/workflows/verify.md:274`);
preserving and consuming re-arm allowances across sessions
(`cadence-core/references/triage-gate.md:160`); authorizing reused MRs and
confirming merge before pull, tag or reap (`skills/cad-land/SKILL.md:202`);
requiring correctly scoped durable evidence before "done"
(`cadence-core/workflows/task.md:208`); preserving artifact identity and the
outer provider timeout (`cadence-core/references/review-cross-model.md:98,120`);
and dispatching exactly the outstanding set including gap plans
(`cadence-core/workflows/execute.md:74`).

### Phase 18: The parity gate

**Goal.** Full parity with `v3.7.12` is asserted, not claimed.

The golden harness from phase 2 running over every ported operation, PLUS the
contract assertions from phase 17. Neither alone is sufficient: output diffs
miss ordering and concurrency and absent refusals, and contract assertions miss
byte-level drift.

The gate includes the workflow ordering that has no import edge anywhere in the
tree - risk carry, then deferred carry, then prune, then land. Individually
correct modules can still delete the evidence that should have blocked a
landing.

**Parity is against `v3.7.12` minus what 4.0.0 deliberately retires.** These are
decisions on record, not shortfalls, and the gate asserts their ABSENCE rather
than their behavior.

*Parallel execution and everything that serves it* - `planning/plan-overlap.mjs`
and `worktree-base.mjs`, 14,145 bytes, and zero whole lib modules.

*`git.auto_close`*, decided 2026-09-05. `README.md:14` promises the engineer
authorizes every push and `:20` says Cadence is deliberately not an autopilot;
`git.auto_close` is the shipped arm that does the thing `:20` disclaims
(GH-247). The JavaScript keeps it - `v3.7.12` is the frozen reference and must
not move - so this is the one place 4.0.0 is deliberately NOT at parity. It
deletes `lib/repo-auto-close.mjs` outright (3,088 B), removes `decideGateHalt`
from `close-decision.mjs`, and simplifies the authorization arm of
`publish-decision.mjs`. The config key joins `stakes` and `parallelization.*`
as a retired key. The gate must assert that no path publishes or merges without
an explicit authorization, which is a contract assertion (phase 17), not an
output diff.

### Phase 19: The release path

**Goal.** A tagged release publishes four checksum-verified archives, and a
machine that starts a session gets the right binary installed without being
asked.

The `publish` job verifies each archive's sha256 against a pin file committed
in the plugin and refuses the release on any mismatch. A POSIX shell
SessionStart hook reads that pin, fetches the platform's archive, verifies it
and installs the binary at a versioned path. The plugin's `.mcp.json` points at
that path.

Scheduled last on purpose. It depends on phase 1's crate, packaging script and
cross-compile matrix, and the pin cannot be filled until the version being
released is the one that will carry the archives - which is the `4.0.0`
landing, not any tag that exists today. Its plan was written as phase 1's
second plan on 2026-09-05 and moved here the same day; it is on disk at
`.planning/phases/19/PLAN.md`.
