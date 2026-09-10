# Roadmap: excerpt folds in, the binary owns process

## Overview

**Opened 2026-09-05. This cycle ships as `4.0.0`.** `cadence-core` becomes a
session-resident server in Rust: one long-running process per session that the
main thread and every subagent share. The binary owns truth about process, the
model owns engineering judgment, and the skill orchestrates between them. The
design is `docs/rationale/architecture-v4.md`; this roadmap is the execution
order, not a second copy of it.

**It is a REARCHITECTURE, not a port. John's ruling, 2026-09-06:** "cadence up
to three dot seven was an excellent learning experience, it's now time to take
all of that knowledge and really do a rearchitecture and a redesign around
cadence four dot o. the only thing literally that needs to keep in parity at
this point is the user facing part as much as possible." That ruling replaced
the roadmap this file used to carry, whose phases 5 through 16 were each "port
module cluster X" and existed only under the port model.

**The frozen reference is the tag `v3.7.12`**, an annotated tag whose commit is
`c39bbd8c`. It remains the reference for what a USER experiences and stops
being the specification for internals. The maintenance line is the branch `3.x`,
cut from that same commit; nothing on it is ported forward automatically.

### Where parity is owed, and where it is not

The three-way cut John drew, and it decides every phase below:

- **Project source code** - the project's own. Cadence reads it, never owns it.
  The executor writing Rust and tests is untouched by any rule here.
- **The model thinking and working** - PLAN, CONTEXT, SUMMARY, REVIEW, UAT.
  Authored prose, read back by humans and models. Markdown is correct here and
  stays.
- **Everything else stored** - CAPTURE, STATE, ARCHIVE, FILED, DECLINED, trace,
  reads, config. Designed by accretion under premises that have expired. This
  is the bucket the rewrite rethinks, and phase 3 is where it lands.

The governing principle for the boundary, settled 2026-09-06: **user-facing is
what a person reads or acts on, not what produces it.** `/cad-why`'s narrative
and `/cad-progress`'s receipts are owed byte-for-byte where they promise
identity; the store behind them is free.

**The durable unit of parity is a scenario-bounded workflow episode**, not a CLI
invocation: given repository and persisted state, an invocation and mode,
effective user policy, scripted user decisions, controlled worker and provider
outcomes, and interruption history, the skill reaches the specified observable
state, presents the required evidence or refusal, and produces no unauthorized
effects. Phase 18 is where that is asserted. It must also name its stop point -
refusal, checkpoint, awaiting-user-decision, or completion - because "the skill
returned" and "all its effects are durable" are different claims.

### What 4.0.0 stops doing

These are decisions on record, not shortfalls. The acceptance gate asserts their
ABSENCE rather than their behavior.

- **Parallel and worktree execution**, dropped outright. Worktree dispatch,
  `worktree-base.mjs`, the `baseRef` preflight, the `phase_diff` trigger and the
  four `parallelization.*` keys go. Evidence it costs little: phase 3 of
  `v3.7.12` found collisions between all three plan pairs and routed sequential
  anyway. The lease is NOT collateral - `planning/lease-check.mjs:32-37` says
  in its own words that it covers sequential execution, and declared-scope
  enforcement over source work survives.
- **Cross-session concurrency**, stated plainly rather than half-supported.
  John's habit is one writer plus read-only sessions, so exclusivity is owed on
  WRITES only and is satisfied by construction (phase 3). This deletes the
  capture lock and its stale-takeover defect. Do not propose a refuse-to-start
  guard; it would block the readers he actually uses.
- **`git.auto_close`.** `README.md:14` promises the engineer authorizes every
  push and `:20` says Cadence is deliberately not an autopilot; `auto_close` is
  the shipped arm that does what `:20` disclaims (GH-247). The JavaScript keeps
  it, because `v3.7.12` must not move. The key joins `stakes` and
  `parallelization.*` as retired. John loses that workflow at 4.0.0 by choice.
- **The reads log**, entirely. The host's own session transcripts already hold
  reads; the log was a third copy.
- **`ARCHIVE.md`**, dropped. Recall reads git history for pruned phases instead
  of a hand-copied snippet index. Accepted cost: recall gets slower and more
  complex for archived material and gains a git dependency in a read path that
  has none today.
- **Two of the three hooks.** `subagent-trace` and `read-trace` OBSERVE, and
  observation moves into the binary once the binary is the channel. `git-guard`
  DECIDES - a `PreToolUse` gate returning deny or allow on a Bash command the
  model issues on its own - so it cannot become a tool call and it stays.
- **`cad-docs-verify`**, dropped. It needs zero operations; it is a prompt, not
  a skill.

### The skill surface after the fold

28 user-facing skills become **21 distinct implementations**. A fold PRESERVES
the existing command alias, so nothing disappears from the prompt: the user
types the old name and it routes.

- **Merged 3 into 1:** `cad-decision-review` + `cad-minimalism-review` +
  `cad-plan-review` become `/cad-review <target>`. All three point a reviewer at
  an artifact and adjudicate; only the prompt and the target differ.
- **Folded:** `cad-coverage` into `cad-verify` (coverage is a verification
  question), `cad-health` and `cad-report` into `cad-progress` (same question at
  different depth, and both render from the log), `cad-pause` into an EVENT
  rather than a workflow (the binary tracks state, so a pause is an intent in
  the log and resuming is the binary knowing it).
- **Kept despite zero recorded use:** `cad-adopt` and `cad-new-project` (they
  bootstrap OTHER repos, so absence here proves nothing), `cad-undo` (zero use
  is what you want from a safety net), `cad-debug` (episodic value, kept on
  judgment), `cad-help` - John's reversal, "if a user can't issue that, we're
  gonna get dinged for it". Discoverability at the prompt is a product
  requirement and the MCP tool list being self-describing does not replace it.

Weak calls flagged at decision time, so a later phase can reopen them on
evidence rather than rediscovering the doubt: `cad-debug` is kept on no
evidence, and `cad-report` may be underrated - it was never run here, but the
receipts it renders are what `/cad-suggest` mines, and suggest is the fifth
most-used skill.

### The store, after the rearchitecture

Nine operational files become three, plus config. This is phase 3.

- `CAPTURE.md` + `FILED.md` + `DECLINED.md` -> **one item store** (captured ->
  filed | declined). The three-file split existed because, under a CLI, anything
  could `cat` a file and a filter could be forgotten, so exclusion was made
  structural. The binary is now the sole reader, so the guarantee moves from
  "the file is not named" to "the query excludes declined" - testable in ONE
  place. That exclusion is now a filter rather than a structural fact, so it
  owes a test that fails if a declined item ever reaches recall.
- `trace.jsonl` + `trace.1` + `reads.jsonl` + `reads.1` -> **one decisions log**
  carrying routing decisions, gate outcomes and refusals, and nothing that is an
  activity feed. Routing is the one thing nothing else holds:
  `{role, agent, model, model_source, effort, escalated, warning_count}` is
  cadence's own decision AND the config key that decided it. Git does not know
  it; a transcript shows the result and never the reasoning. Consequence: at 113
  lines per full cycle there is little left to rotate, so the rotation machinery
  mostly evaporates.
- `STATE.md` -> **a state snapshot**, an internal detail, never read by a skill.
  State becomes a QUESTION the binary answers, not a file a model interprets.
  Today's stale-cursor failure becomes impossible by construction.
- `ARCHIVE.md` -> **dropped**, as above.
- config -> **global + repo**, merged once at startup. Managed settings are an
  admin-imposed layer for enterprise deployment, which is not this tool's
  audience. Carry forward the collapse rule, which is load-bearing:
  `config-merge.mjs` collapses toward REPO, never global, because resolving the
  other way would silently revoke a permission the repo granted.

The five markdown-stored records become JSON or JSONL. Append-only JSONL also
diffs better than a markdown read-modify-write, because every change is a pure
addition rather than a whole-file re-serialize.

### Standing design constraints

- **Modular and convertible to async.** The Rust discipline that delivers this
  against the function-coloring problem: keep the core SYNC and PURE, push all
  I/O to the edge. Domain logic takes data and returns data; I/O sits behind a
  trait; **no tokio types in the core**. The moment `tokio::fs` or a
  `JoinHandle` appears in domain logic that module is colored and the conversion
  cost is back.
- **Write, confirm, return.** A write is acknowledged only after it is done and
  confirmed. This RAISES the bar over `v3.7.12`, where
  `planning-files.mjs:2747` deliberately has no fsync and the promise is only
  "never torn". Cost is irrelevant at cadence's write rates.
- **Concurrent writes queue to an async handler.** One writer task owns the
  store; callers send work plus a reply channel and await their own completion.
  In tokio terms `mpsc` for the queue and `oneshot` per reply. **The single
  consumer IS the mutual exclusion** - no lock primitive in the STORE or the
  recall INDEX - and it composes with write-then-ack because the caller still
  blocks until its own write is on disk.
  **Scoped 2026-09-06, on John's ruling**, after phase 3 found the original
  "no lock primitive anywhere" contradicted by working code. The argument above
  is about the store's write path: the queue serializes, therefore the store
  needs no lock. It never reached shared state outside the store. Config and
  the session map DO need synchronization, because the resident process is
  shared by the main thread and every subagent by design, so concurrent
  requests inside one process are real even though decision 5 removed
  cross-session concurrency. Verified at the ruling: `crates/cadence/src/store/`
  contains zero lock primitives, and the three that exist are
  `import/mod.rs:447` (session map), `import/mod.rs:355` (first-touch import)
  and `config/reload.rs:217` (shared config).
- **Test what is testable, acknowledge the rest, rely on live usage.** John's
  call, explicitly without the model involved and WITHOUT A MOCKUP. Real
  coverage is owed on the pure core, the store's append/read/snapshot/crash
  behavior, and anything reaching a decision without dispatching. Anything with
  a model in the loop is acknowledged as untested rather than scaffolded around.
  The discipline that keeps this honest: **write down what is knowingly
  untested.** An acknowledged gap is a decision; an unnoticed one is a bug found
  later.
- **The log must be good enough to DIAGNOSE A LIVE FAILURE**, not merely to feed
  `/cad-suggest`. If live usage is the test, the system must be observable in
  live usage, which makes the decisions log the verification instrument for the
  half that cannot be tested.
- **Zero JavaScript ships.** John's ruling, 2026-09-07, asked for the `.mjs`
  surface to be as light as possible and floated a script that only calls the
  binary. A redirect is the one shape that does not qualify: it puts the model
  back in Bash, the free-form channel with no typed arguments, no validation and
  no structured refusal that this design exists to close, and it keeps node a
  runtime dependency for no gain (`docs/rationale/architecture-v4.md:241`). So
  the target is not a thin shim but none. Measured 2026-09-07, `cadence-core`
  holds 238 `.mjs` files, of which 125 are non-test source at 47,884 lines; all
  of them leave with it. Skills are markdown calling MCP tools directly and the
  binary is the only executable cadence ships. The single non-Rust survivor is
  the SessionStart bootstrap, POSIX shell rather than node, which fetches the
  platform release and verifies its checksum on first run
  (`docs/rationale/architecture-v4.md:248-252`; its own size estimate is tagged
  a guess and untested).
- **Assert on SHAPE, never on the content the model produced.** One commit per
  task in order, each signed, subjects naming their tasks, the SUMMARY listing
  exactly those SHAs, the cursor moved, the log holding the routing decision.
  Cadence's job is orchestration, so orchestration is what gets asserted.

### The order, and why it is this order

**Machinery first, then the skills that fire it.** An earlier draft of this
roadmap ordered phases 6 onward by the lifecycle a USER walks - intake,
execution, verification, landing - and a falsification pass against the frozen
tree killed it: **23 ordering violations across 18 skill surfaces, with every
proposed cluster depending on a later one.** The dependency order is not the
lifecycle order, because three subsystems cut across every cluster:

- **The commit rail.** Sixteen commit-capable or risk-gated skills consume the
  protected-branch guard, and it can ask, refuse or abort
  (`references/git-guard.md:6-20`). Scheduling it late lets a cluster's
  acceptance run pass while protected-branch behavior is simply absent.
- **The review subsystem.** `cad-plan` does not "own plan review" - it FIRES
  `references/review-triggers.md` and obeys that subsystem's gate
  (`workflows/plan.md:442-478`). The same is true of `cad-execute`
  (`workflows/execute.md:412-438`), `cad-task` (`workflows/task.md:197-206`) and
  `cad-debug` (`workflows/debug.md:120-136`).
- **Config.** `cad-new-project` and `cad-adopt` do not own their own role and
  cost intake; both explicitly follow the Roles interview arm of
  `workflows/config.md` (`workflows/new-project.md:66-75`,
  `workflows/adopt.md:61-74`), and `cad-suggest` writes no key itself - the
  write on "yes" happens inside `/cad-config` (`workflows/suggest.md:122-138`).

So phases 6, 7 and 8 build the boundary, commit rail and config; phases 9
and 10 build review delivery and evidence verification; and phases 11 through
15 build the skill surfaces that compose them. Phase 3 is the store, because
John named it as the next step and everything later writes through it. Phase 4
derives state from the store, because no skill cluster can be built until the
binary can answer where the work stands. Phase 6 takes one vertical slice through
the finished boundary, so the tool schema, the typed refusal and the patch shape
are proven before ten surfaces are built against them. Phase 17 collects what
belongs to no cluster, phase 18 is the gate, and phase 19 ships.

**Delivery order is not phase number (decided 2026-09-10).** When phase 11 was
rescoped to the first approved context, its evidence-map slices were parked as
phases 27, 28 and 29 - and the acceptance design makes both execution and
verification consumers of that map. The binary refuses a task close without
red-then-green for every identified check, and refuses a verdict on an item
not in the map (`docs/architecture/acceptance.md`, "The four refusal points,
together"). A check is only an identified item once the map is persisted (phase
28), and the map lives in a saved plan (phase 27). Phase 29's limits gate the
activation of acceptance-aware execution, not the status arithmetic. So the
order after phase 11 is **27, 28, 29, 12, 13**, then 14 onward as listed. The
numbers stay: phase 25 forbids `/cad-phase insert` on this repository until
completed-row protection lands, and every commit subject, report and memory
cites the numbers as they are. The
analysis is `.codex-analysis/phase-13-needs-from-28-29.md`.

**A phase is a unit of work with a plan and a gate; it is not an acceptance
unit.** Those two boundaries are allowed to differ, and here they do: phases 6
through 16 implement, and phase 18 accepts. Do not go hunting for an independent
acceptance unit inside a single cluster.

**The enum workflow spine stays INTERNAL in 4.0.0** (John, 2026-09-06: "agreed
only internal at this point"). The enum types the OUTPUT of the derivation and
is not an authoritative store, because cadence's load-bearing property is that a
human edits the markdown and the tool agrees with them; a store makes every hand
edit into drift and grows a repair command. It is also not one enum - state is a
product of independent axes and one flat enum multiplies them out until the
exhaustiveness is noise. Phase 4 owns it.

**Out of scope, deliberately.** The near-term 3.x prose fixes in section 8 of
the architecture doc are a separate decision. `GH-140`, whether Cadence grows a
Codex host adapter, gets sharper once the boundary is a binary rather than
prose, but the adapter decision is not made in this cycle. The 3.x baseline
spike (`BAS-01`) is deferred, not dropped: every task mined the frozen archive
rather than measuring a running 3.x, and a frozen archive does not expire.

## Open Questions

- **OQ-1 - should a ToolSearch preamble exist at all, and if so should it tell
  the model to SKIP the load.** Re-homed to phase 6 on 2026-09-06 (it sat on
  phase 1, which has closed). The cost half is answered: unconditional, about
  900 tokens per skill invocation across `/cad-context`, `/cad-task`,
  `/cad-debug` and `/cad-adopt`, roughly 3,600 tokens per run for one useful
  load. The enforcement half is answered too - a direct probe on 2026-09-05
  against a purpose-built two-tool MCP server with settings isolated called a
  tool that had never been loaded through `ToolSearch` and it returned normally,
  so deferral is NOT enforced at call time on CLI 2.1.261, and a paired run
  showed the agent volunteering a `ToolSearch` anyway. So the ~900-token load is
  a convention the model follows, not a requirement. What remains is a product
  decision about cadence's own tool surface, which is phase 6's subject.
- **OQ-2 - do loaded tools survive compaction.** Re-homed to phase 6 on
  2026-09-06, same reason. The CLI carries `preCompactDiscoveredTools` and a
  "carried from compact boundary" string, which is suggestive and not an
  observation. A compaction was observed on 2026-09-05 and a tool loaded before
  the boundary was callable after it, but **the paired negative control
  failed**: a tool never loaded was callable too, so the observation does not
  separate survival from the enforcement simply being off. It needs the binary's
  own tool surface, where an unloaded tool has a defined failure to compare
  against.
- **OQ-3 - does the item store's recall exclusion hold under a hand edit.**
  New, 2026-09-06, and owned by phase 3. Dropping the three-file split moves the
  declined-item guarantee from structure to a query filter. The test that fails
  when a declined item reaches recall is named as an obligation above; the open
  question is what happens when a human edits the store directly, which the
  three-file layout made visible and a single store does not.

## The `4.0-port-decision` issues, re-homed

Thirteen open issues were each tagged to a phase number the restructure
invalidated. Re-mapped 2026-09-06 from the frozen defect site rather than from
the old label, so each surfaces when its phase is planned. **The GitHub labels
still carry the old numbers and have not been updated.**

The owner assigned GH-237, GH-239, GH-240, GH-250 and GH-251 to review work,
so phase 10 owns them, resolving the earlier conflict between phase 8 in this
table and phase 9 in the detail.

Three further table cells disagreed with their own detail paragraphs and are
corrected here. GH-229 and GH-248 are described inside the commit rail section
and are planned there, not in the closed boundary phase. GH-256 is described
inside config and routing, which is where the reset behaviour it asks for is
settled.

| Issue | Frozen defect site | Phase |
|---|---|---|
| GH-241 | `lib/trace.mjs:1752-1757` accepts any nonempty observed effort string, whitespace included | 3 |
| GH-229 | `planning/core.mjs:519-524`, with the no-commit skip at `workflows/execute.md:338-346` and `workflows/task.md:154-164` | 7 |
| GH-248 | `planning/risk-check.mjs:949-997` stores ref-only receipts needing a head/base pair; a staged record has no head (`:395-402`) | 7 |
| GH-256 | `route.mjs:967-983` treats an explicit role-effort `null` as unset, against `config.schema.json:32-37` | 8 |
| GH-237 | `review-provider.mjs:1142-1148` zeroes one invalid Gemini output component when the other is usable | 10 |
| GH-239 | `review-provider.mjs:1335-1350` exits on non-2xx before extracting usage | 10 |
| GH-240 | `review-provider.mjs:988-989` accepts any finite nonnegative number, summed without a checked bound | 10 |
| GH-250 | `issue-filing.mjs:727-763` refuses on the local FILED read before forge resolution | 10 |
| GH-251 | `lib/filing-decision.mjs:730-755` leaves GitLab lookup unmeasured and space-joins fingerprints | 10 |
| GH-202 | `planning/risk-carry.mjs:119-127` does a source `lstatSync` outside carry error handling; the dispatcher maps it to generic `internal` (`planning.mjs:420-423`) | 14 |
| GH-230 | No source defect: dispatch cache read grows with the SQUARE of turn count and nothing bounds dispatch length | 5 |

The last three had no local record naming a source site and were left unhomed by
the falsification pass rather than guessed. Read off the tracker 2026-09-06 and
settled:

- **`GH-230` goes to phase 5**, the phase that owns dispatch selection. It is a
  DECISION, not a defect: cache read grows with the square of a dispatch's turn
  count (median k of 1,118 to 1,348 across 129 paired workers on three
  projects), because every turn re-reads the accumulated window, and nothing
  bounds how long a dispatch runs. The most expensive single worker in the
  corpus is one 114-turn executor at 22,234,463 cache-read tokens. The lever is
  dispatch LENGTH for any role, not the executor specifically -
  `cad-assumptions-analyzer` has the lowest k anywhere. If the binary owns
  dispatch selection, a bound is expressible there for the first time.
- **`GH-178` is ELIMINATED, not re-homed.** It reports that
  `lib/read-trace.mjs:332` stores a Bash call's PROGRAM rather than its shape,
  so `reads.jsonl` cannot tell a bare suite run from a targeted one. 4.0.0
  drops the reads log entirely, so the defect has no surface left. This is the
  third instance of the category that keeps being missed: **ask what 4.0.0 stops
  doing, not only what Rust makes unrepresentable.** One real consequence
  survives for phase 14: `lib/trace-suggest.mjs:601` folds `reads.jsonl` for
  `/cad-suggest`'s R7 in-dispatch re-reading signal, so that signal goes with
  the log and suggest must not silently report a conflated count as a clean one.
- **`GH-140` is out of scope for 4.0.0 and stays open.** Whether Cadence grows a
  Codex host adapter is a keep/cut call, and its own text says the Codex host
  primitives it rests on are Codex describing itself, unverified against a real
  install. Deciding it now would adapt a prose surface that is being replaced.

## Phases

Delivery order after phase 11 is 27, 28, 29, 12, 13, then 14 onward; see
"Delivery order is not phase number" above. Numbers are identities, not sequence.

- [x] **Phase 1: The crate skeleton** - a named binary that builds, cross-compiles to four targets from one CI job, and serves a minimal MCP tool surface
- [x] **Phase 2: The golden harness** - fixtures at the frozen tag and a recorder that captures the JavaScript surface's behavior deterministically
- [x] **Phase 3: The store and its queries** - the item store, the decisions log, the state snapshot, two-layer config, the `v3.7.12` import, and recall
- [x] **Phase 4: Derivation and the internal spine** - phase state derived from disk, the evidence set enumerated, and a memo that makes disagreement a hard error
- [x] **Phase 5: The evidence record and what comes next** - the facts routing depends on written down when they happen, and the binary selecting the next action from them
- [x] **Phase 6: The boundary and the execute slice** - the typed tool schema, typed refusals, and `/cad-execute` proven end to end through it
- [x] **Phase 7: The commit rail and the risk gates** - `git-guard`, the protected-branch decision, the lease and the risk check: what sixteen skills commit through
- [x] **Phase 8: Config and routing** - two-layer effective config, the roles interview, retired-key migration, and `route resolve`
- [x] **Phase 9: Review delivery and identity** - raw reviewer returns persisted by the binary, shared gate settings, first usable review, and durable snapshot identity
- [x] **Phase 10: Provider port** - the cross-model provider arm in the binary, on phase 9's delivery lifecycle, with GH-237/239/240 repaired
- [x] **Phase 11: First approved context** - truths authored through the binary as typed slots, refused at authoring, persisted only on approval
- [ ] **Phase 12: Execution and tasks** - `cad-execute` in full, and `cad-task`
- [ ] **Phase 13: Verification and audit** - `cad-verify`, the merged `cad-review` command surface, `cad-audit`
- [ ] **Phase 14: Receipts and retune** - `cad-progress`, `cad-why`, `cad-suggest`, `cad-capture`
- [ ] **Phase 15: Landing and milestones** - `cad-land`, `cad-milestone`, `cad-undo`
- [ ] **Phase 16: Support** - `cad-debug`, `cad-spike`, `cad-help`
- [ ] **Phase 17: Contract enforcement** - the residual obligations that live today as prose instructions and belong to no single cluster
- [ ] **Phase 18: The acceptance gate** - scenario-bounded workflow episodes, asserted with contract checks rather than an output diff
- [ ] **Phase 19: The release path** - a tagged release that publishes four checksum-verified archives, and a SessionStart hook that fetches and installs the pinned binary
- [ ] **Phase 20: Filing port** - human-chosen issue filing on GitHub with fingerprint deduplication and ambiguous-create reconciliation, GH-250/251 repaired
- [ ] **Phase 21: Deferred review completion** - carry, retention and verified supersession for deferred reviews, and durable re-arm across restart
- [ ] **Phase 22: Structured planning documents** - PROJECT, REQUIREMENTS and ROADMAP sections validated and persisted by the binary
- [ ] **Phase 23: Bootstrap front doors** - `cad-new-project` and `cad-adopt`, idempotent, on the document operations and phase 8's interview
- [ ] **Phase 24: Small roadmap changes** - `cad-phase` add and edit through the structured roadmap boundary
- [ ] **Phase 25: Structural phase changes** - `cad-phase` insert and remove with historical-row protection, GH-259 repaired, previews and recovery
- [ ] **Phase 26: Context revision** - truth versions on changed text, and the approved requirement-correction write
- [x] **Phase 27: Plan persistence and allocation** - plans stored at distinct identities with replay-safe number allocation
- [x] **Phase 28: Evidence associations** - the evidence map attached to current phase truths, orphans refused
- [x] **Phase 29: Check and link limits** - a check needs a command and expected output, one check per truth, links only where the truth names a value
- [ ] **Phase 30: Plan review handoff** - `cad-plan` fires the review trigger and persists only selected review edits

## Phase Details

### Phase 1: The crate skeleton

**Goal.** A `cadence` binary builds, cross-compiles from one CI job, and serves
a minimal MCP tool surface.

Seeded from excerpt, which already carries the dependency set and the CI. Adds
the binary's name and the typed envelope vocabulary from section 3a of the
design doc. No domain modules yet.

**The release path was moved out on 2026-09-05, after the plans were written.**
The original phase 1 carried a second plan for the release workflow, the
checksum pin and the SessionStart bootstrap. Nothing is downloadable until
`4.0.0` is tagged, so that plan's own honest outcome was a bootstrap that
no-ops on every machine and three acceptance criteria that could not be
observed at phase close. It is now phase 19, where a release actually exists.
Phase 1 is the crate skeleton and nothing else.

### Phase 2: The golden harness

**Goal.** The behavior of the frozen surface is recorded deterministically, so
a later claim about it is measured rather than asserted.

**Closed 2026-09-06.** Three plans, seventeen signed commits. Result: 156
recordings over 74 distinct operations, 17 fixture bundles, 6 normalization
rules, 25 golden tests, 35 Rust tests. The `golden-drift` CI job is green.

**It validated the measuring instrument, and it proved no parity.** The honest
number at close was `compared=0 pending=156`: the binary implements no recorded
operation, so the harness is proven by its negative controls and never by
agreement. Its close must not be read, by a verifier or by a human, as evidence
that any parity claim holds.

**The goldens were then DELETED in `7d64c4c9`; the fixtures were kept.** Under
the rearchitecture ruling the 156 recordings pin the WRONG UNIT - each is one
CLI invocation, an internal operation a redesign may delete outright. What
survives is the fixture corpus, the normalization rules, and the lesson below.
Phase 18 rebuilds acceptance at the scenario boundary instead.

**The harness caught a real defect on its first CI run and the defect is the
phase's most durable output.** `golden-drift` went red on one recording.
Ten committed fixture files carried the literal string `/code/cadence` in their
PROSE, inherited from the real `.planning/` history at the tag, and
`record.mjs:285` does an unconditional `text.replaceAll(repo, '<REPO>')` applied
to the whole serialized recording, so it reached captured file bytes. **The
committed goldens only reproduced on a machine rooted at `/code/cadence`.**
Fixed by sanitizing the path in `build-fixtures.mjs` rather than in the fixture
tree, because the fixtures are BUILT from the tag and a sed over the tree would
be undone by the next rebuild.

**The lesson every later phase inherits: four local determinism checks missed
this because they varied `TMPDIR`, `TZ`, `LC_ALL` and `HOME` but never the REPO
PATH.** Any determinism criterion from here on must relocate the repository -
`git archive HEAD | tar -x` into a scratch dir, `git init`, run the check there.

### Phase 3: The store and its queries

**Goal.** The basic data functions live in the binary. Nine operational files
become three plus config, and every one of them is written by the binary alone.

This is the step John named after the design closed, and it is first because
every later phase writes through it. It covers the item store, the decisions
log, the state snapshot, the two-layer config merge, the `v3.7.12` import, and
recall as a query over the store plus git.

**The shape is settled and is not reopened at plan time.** Sync pure core, I/O
at the edge behind a trait, no tokio types in domain logic. One writer task owns
the store; callers send work plus a reply channel and await their own
completion, so the single consumer is the mutual exclusion and no lock primitive
appears in the STORE or the recall INDEX (scoped 2026-09-06 - see the decision
above; config and the session map are outside it and may synchronize). A write
is acknowledged only after it is confirmed on disk.

**What is genuinely testable here, and is therefore owed real coverage:** the
pure core (parsing, classification, derivation, rendering - plain functions, no
fixtures, no runtime, no server); the store's round trip (append then read
returns what was appended in order, a rewritten snapshot survives); and crash
behavior (a crash mid-write leaves the old value or the new one, never a torn
one). That last one is newly testable BECAUSE of write-then-ack;
`v3.7.12`'s `atomicWrite` promises only "never torn".

**Three obligations this phase creates for itself.**

1. **A declined item must never reach recall**, and that is now a filter rather
   than a structural fact. Write the test that fails if one does. It is the
   whole cost of collapsing the three files, and OQ-3 asks what a hand edit does
   to it.
2. **Config read once into memory must be invalidated when the file changes
   underneath.** A resident process merges once at startup, which deletes the
   2,903 bytes of per-invocation reconstruction `config-merge.mjs:187` pays, but
   it introduces external edits, `git checkout` and rebase as new failure modes.
   A failed reload must not silently preserve old permission-like settings as if
   current, and the policy must say which changes require revalidation before a
   mutating request commits rather than after.
3. **The `v3.7.12` import is a one-way migration and it must be lossless in the
   directions that matter.** Old config keys are handled explicitly rather than
   left as dead effective settings. A pre-4.0 `.planning/` must import without
   the user hand-editing anything.

**What residency does NOT fix, and must still be designed for.** A resident
server can still crash between syscalls, so single-file replacement, operation
journaling and recoverable partial transitions all remain. A single process does
not make a multi-file action atomic. Other writers - humans, editors, `git
checkout` - do not honor the binary's ownership, so file identity must be
revalidated before mutation and conflicts reported rather than assumed away.
ENOENT can mean initialize; EACCES cannot mean empty data, and that distinction
matters MORE when stale cached content tempts the server to continue writing.

### Phase 4: Derivation and the internal spine

**Goal.** The binary answers "where did I leave off" and "what comes next"
from the store and the repository, and the model stops interpreting a cursor.

**Half the premise is already true and half is new behavior, and the difference
decides what this phase owes.** Phase STATUS is already derived mechanically.
Next-ACTION selection is not: `planning/status.mjs:315-332` returns `current`,
`outstanding`, phase facts, the cursor and drift, and no next action at all -
the first-match action table and the handoff that invokes it live in PROSE, at
`workflows/progress.md:188-203` and `:233-240`. So "the binary answers what
comes next" is a MOVE of behavior out of prose, not an extension of something
the binary already does, and it needs its own acceptance assertion for route
SELECTION rather than only for phase status. Without that assertion the
ownership move can silently omit the behavior and every status test still
passes.

**The half that is already true.** Phase state is derived mechanically in
`v3.7.12`, not held in prose: `planning/core.mjs:192` (`derivePhases`) reads
PLAN, SUMMARY and UAT off disk to get `unplanned | planned | executed |
complete`, `planning/status.mjs:160` takes `current` as the first non-complete
phase, and `:164-170` already reports drift when a ROADMAP checkbox disagrees.
What IS prose is `STATE.md`'s `Status:` and `Next:` cursor and the checkpoint
and blocked overlays that live in report text. So the question was never
"replace prose with an enum"; it is whether the enum is STORED or DERIVED, and
the answer is derived.

**Enumerate the evidence set before writing any transition.** In
`(current_state, evidence) -> next`, evidence is the whole design: today it is
filesystem and git facts - plan files, SUMMARY, UAT pass state, commits, trace
brackets. The transition function cannot be written until that set is
enumerated, and `.codex-analysis/frozen-surface-derivation-map.md` is the
starting inventory.

**Shape: a struct of small enums, with transitions as a function over the
tuple.** The axes are phase id, derived phase status, plan and task position,
gate outcomes (plan-check, review, UAT, verification) and an overlay (paused,
checkpointed-awaiting-decision). Stated explicitly because "the enum is the
contractual workflow spine" will otherwise be built literally as one flat enum.

**Store at most a memo keyed by a hash of the derivation's inputs, and make
disagreement a hard error** rather than a silent recompute. A human editing the
markdown and the tool agreeing with them is the property being protected.

**A concrete instance of the failure class this deletes**, hit while closing
phase 2: the cursor and the derivation use two different vocabularies for the
same fact - `AGREE` at `planning/status.mjs:121-125` maps a derived `unplanned`
to the legal cursor phrases `ready to plan` and `context gathered` - so a
`STATE.md` written with the derived word produced the drift report "cursor says
phase 3 unplanned; derived phase 3 unplanned". Two identical strings, no
difference named, and the reader is left to discover the vocabularies differ.
When state is a question the binary answers there is only one vocabulary and
this cannot be written down wrong.

**Scoped 2026-09-06 to the half that is grounded.** A source audit
(`.codex-analysis/phase-4-evidence-set.md`, 70 evidence rows) ruled five of this
entry's six frozen-code claims TRUE and one IMPRECISE, but found the stronger
premise unestablished: the proposed tuple's next-ACTION half reads three
evidence classes that have no durable home - the checkpoint payload (E24),
checker verdicts, since a completed trace bracket does not encode pass or fail
(E37-E38), and the operator's answer at a gate (E65). They live in worker
returns and the conversation. **Next-action selection, the operator override and
the `cad-pause` collapse therefore move to phase 5**, which gives those facts a
home first. What stays here is what every input already supports from disk:
derived phase status, the memo, drift as a hard error, and one vocabulary.

**The IMPRECISE claim, corrected.** `derivePhases` does not read PLAN and SUMMARY
contents: it globs PLAN filenames, tests SUMMARY with `existsSync`, and parses
only UAT (`planning/core.mjs:192-205`). Because `if (summary)` runs
unconditionally after the plans check, a phase carrying a SUMMARY and a passing
UAT derives `complete` with NO PLAN at all. Whatever replaces it inherits that
credulity unless the port decides otherwise.

### Phase 5: The evidence record and what comes next

**Goal.** The facts that routing depends on get written down when they happen,
and the binary selects the next action from them.

**Why this is its own phase.** Split out of phase 4 on 2026-09-06. Phase 4's
entry assumed `(current_state, evidence) -> next` could be derived from the
repository. Half of it can: phase STATUS is mechanical and every input is a file
on disk. The other half cannot. `.codex-analysis/phase-4-evidence-set.md`
enumerated 70 evidence rows and found three classes with no durable source - the
current checkpoint task and its exact Need (E24), checker verdicts, because a
completed trace bracket encodes that a check RAN and not what it decided
(E37-E38), and the operator's answer at a gate (E65). All three exist only in
worker returns and the live conversation, and are gone when it is. A transition
function cannot be written over evidence that does not survive a restart, so the
records come first and the selection reads them.

**It sits BEFORE the boundary, not after.** The frozen roadmap put dispatch
selection after the derivation "because binary-owned dispatch selection IS the
derivation", while the derivation's next-action half needs evidence only the
boundary produces. That is circular. Breaking it costs one ordering decision:
the durable records exist before either side consumes them.

**Not new design throughout.** Override paths already exist in the frozen
implementation - rerun, checker bypass, the paused `Next` cursor, and recorded
review overrides carrying reasons and range-bound receipts
(`references/triage-gate.md:105`). What is new is ONE durable override contract
over them, rather than four spellings the model has to know by heart.

**Evidence refs on contracted results** - commit SHAs, `file:line`, criterion
ids - because a typed `Accepted` carrying none of those is a rubber stamp: prose
ambiguity moved into a field, minus the prose that let a human catch a wrong
call.

**`cad-pause` collapses here, and the collapse is not free.** Pause today is not
an intent: it makes a WIP commit of in-flight work, writes AND commits the
paused cursor, and runs the git guards (`skills/cad-pause/SKILL.md:25`).
Recording an intent in the decisions log drops all three plus the existing
resume semantics. Whatever replaces it either keeps preserving work or says
plainly that it does not.

**Success criteria.**

- Killing the session mid-checkpoint and restarting recovers the current task
  and its exact Need from disk, with no conversation.
- A checker verdict is readable as pass or fail after a restart, not merely as
  a bracket that closed.
- An operator override is recorded with its reason and survives a restart, and
  one contract covers rerun, bypass, paused-Next and review overrides.
- Next-action selection returns the same answer as the frozen first-match prose
  table (`workflows/progress.md:188-203`) for every state the golden harness
  covers.
- A pause preserves in-flight work as durably as the frozen `/cad-pause` does,
  or the entry says which guarantee was dropped and why.

### Phase 6: The boundary and the execute slice

**Goal.** One vertical slice runs end to end through the finished boundary, and
its shape is the template every cluster follows.

The five-step loop from section 3c of the design doc: ask for the next dispatch,
refuse with a reason or hand back a prompt, invoke the executor, return a typed
state patch, repeat. **The tool schema is the patch schema and the BINARY
validates against it** - a malformed argument comes back as a `refused` envelope
naming what was wrong, not an MCP-layer rejection.

It sits after the store and the derivation rather than before them because
binary-owned dispatch selection IS the derivation, and durability across a
restart IS the store. It sits before the clusters because ten of them built
against an unproven schema is the expensive way to discover the schema is wrong.

**Six conditions are not stubbable. Fake any of them and the slice proves
nothing:** real host-to-MCP-to-Rust calls including bad patch arguments that
come back `refused` with reasons; binary-owned dispatch selection built from
real files and state; a real executor doing work, running tests and committing;
scoped lossless patch application where a rejection leaves state unchanged;
durability across a restart between dispatches, recovering the same outstanding
work; and binary-owned STATE and SUMMARY rendering with the model's attempts to
bypass that boundary denied.

**Legitimately stubbable, and to be reported as stubbed rather than passed:**
fixed executor rung and configuration, reviews explicitly disabled, an explicit
integer phase with legacy trees refused, a fixed branch policy, and no log
rotation - refusing past the bound instead.

**What the slice still cannot prove**, and should not be read as proving: that a
small state patch carries enough history for the planning and debugging roles
later; cross-domain lifecycle conflicts (UAT, gap plans, deferred reviews,
reruns) that break a simple "all tasks done" transition; and that one executor
schema scales to three or four tools.

**OQ-1 and OQ-2 settle here**, because both are questions about cadence's own
tool surface and this is the phase that first has one.

**A typed writer API is not enough on its own.** Writers must not accept
arbitrary file paths and unlimited replacement content as their sole interface -
that moves the syscall into the binary while preserving most model-authored
structural corruption. Use operation-specific structure, content validation and
expected versions, and allow free text only where judgment belongs.

### Phase 7: The commit rail and the risk gates

**Goal.** Add the bounded Bash commit/push arm and enforce source leases at
patch application. The native Write/Edit ownership guard and the executor's
signed task commits already shipped in phase 6; this phase complements both.

**Sixteen skills consume these gates.** The Bash detector covers simple command
segments whose first command is `git` or a path ending `/git`. Wrappers and
substitutions are outside its coverage; branch observation uses hook cwd rather
than following `-C` targets or earlier checkouts. It does not promise universal
commit coverage. Protected-branch policy can ask or refuse on this bounded arm.
The already-shipped Write/Edit guard continues protecting binary-owned state.

**`git-guard` stays a hook and cannot be anything else.** It is a `PreToolUse`
gate that returns a DECISION synchronously on a Bash command, guarding the one
channel the binary does not mediate: the model running arbitrary shell. It
cannot become a tool call, because the point is catching commands the model
issues on its own. It needs no resident state to answer "is this branch
protected", so it needs no transport to the server.

**The risk gates come with it**, because they sit on the same path and the same
consumers: `risk-check` over a commit range, `detect-surfaces`, and the lease.
Source-scope enforcement compares every patch's reported-commit paths and the
whole staged set against the admitted lease at patch time, including both
rename endpoints. `files` declares exact paths; optional `directories` declares
roots and descendants by path-component boundary. A trailing separator in files
is refused. One `covers()` predicate serves admission, retained native
overlap-derived ordering and patch enforcement. There are zero exemptions:
new files, dependency lockfiles and reports must all be covered. Undeclared or
unprovable observations refuse the whole patch while retaining byte-exact Git
path handling. The commits remain in Git, the index is untouched, and the
dispatch stays open for operator-controlled repair and a corrected full patch
under the unchanged lease; no automatic history rewrite occurs.

**Two open GitHub issues land here**, and both are range-identity defects:
`GH-229`, where a caller hands the check a `HEAD..HEAD` range and the record
reads as a completed clean check (`planning/core.mjs:650` and `lib/risk-diff.mjs:391`, with the
no-commit skip at `workflows/execute.md:338-346` and
`workflows/task.md:154-164`), and `GH-248`, where receipts are stored ref-only
and require a head/base pair while a staged record has no head
(`planning/risk-check.mjs:949-997`, `:395-402`).

### Phase 8: Config and routing

**Goal.** Effective config and role routing exist before the skills that read
them, and before the two intake commands that delegate their whole interview to
config.

**It is here because intake depends on it, not the reverse.**
`cad-new-project` and `cad-adopt` do not own their role and cost intake - both
explicitly follow the Roles interview arm of `workflows/config.md`
(`workflows/new-project.md:66-75`, `workflows/adopt.md:61-74`). `cad-suggest`
likewise proposes tokens and writes no key; the write on "yes" happens inside
`/cad-config` (`workflows/suggest.md:122-138`). Standalone config can also
bootstrap a missing repo config by copying the template
(`workflows/config.md:10-15`), which is another call site for the same
initialize family phase 11 uses.

Two layers, global and repo, merged once at startup. **Carry forward the
collapse rule, which is load-bearing:** the merge collapses toward REPO, never
global, because resolving the other way would silently revoke a permission the
repo granted. Managed settings are dropped.

**Retired-key migration lands here**: `stakes`, the four `parallelization.*`
keys and `git.auto_close` are expanded or removed rather than left as dead
effective settings. If the migration runs once at import, the behavior is still
owed even though the `config unset` operation can disappear.

**`GH-256` is a real defect in this surface**: `route.mjs:967-983` treats an
explicit role-effort `null` as unset and then falls through to the legacy key,
contrary to the schema contract at `config.schema.json:32-37`. Decide it at plan
time rather than reproducing it.

**The invalidation obligation from phase 3 is discharged here.** Config read
once into memory must be invalidated when the file changes underneath - external
edits, `git checkout`, rebase - and a failed reload must not silently preserve
old permission-like settings as if current.

### Phase 9: Review delivery and identity

**Goal.** Reviewers return raw findings, the binary persists them before
completion, and every fire has durable artifact identity and one configured
gate meaning.

**Split from review and settlement on 2026-09-07.** The audit at
`.codex-analysis/phase-9-decision-brief.md` found 2 capabilities built, 5 partial
and 11 absent, making this the largest remaining phase. The owner chose delivery
and identity first, evidence verification second. Both halves retain their
obligations; the split adds a phase rather than weakening acceptance.

**It follows the commit rail and config because review consumes both.** The
frozen plan, execute, task, debug and verify workflows fire shared review
machinery; manual plan review uses the same ordinary trigger policy. Milestone
consumes settlement and preserved evidence. Delivery and identity must exist
before evidence verification and before the skill clusters compose either half.

**The advisory delivery decision is WAIT.** The reviewer is read-only and
returns raw findings. The invoking skill waits for that return and forwards it
unchanged to a binary result operation. The binary persists the findings and
closes the dispatch before acknowledging completion. This accepts the lost
overlap with next-plan work and commit preparation. Advisory findings remain
raw and unruled, even under an adjudicated combination mode; their severity does
not halt work or require immediate adjudication.

The current reviewer contract instructs a Bash heredoc
(`skills/cad-reviewer-contract/SKILL.md:114`). The native guard passes through
Bash (`crates/cadence/src/guard/mod.rs:78`), so denying Write never established
binary ownership. Neither the reviewer nor the invoking skill writes the
permanent findings file. The binary retains exact original finding strings and
supplies queries or recoverable renderings for completion reports, deferred
consumers, reports and milestone preservation.

**A saved gate setting has one meaning.** Manual and automatic plan and risk
entry points honor the same effective settings, including task reviews and
deferred gates. Decision review and minimalism retain their specialist
contracts. A gate requiring settlement remains pending until the evidence
verification half accepts it; receiving findings alone cannot clear it.

**Single-reviewer mode stops at the first usable review.** Try the configured
order sequentially, stop after one usable response, and record failed attempts
and their cost. An empty findings array can be usable. If the configured choices
all fail, use the local fallback and record its actual outcome. Do not dispatch
a full panel and then discard all but one result. The provider arm added in the
next phase obeys this same selection and delivery contract.

**Every fire has an immutable identity and a durable home before dispatch.**
Generalize pause's `Fire` (`crates/cadence/src/pause/risk.rs:44`) to typed
committed-range, staged-tree and named-file snapshots. Retain reviewed bytes or
object identities, scope, occurrence and round rather than only mutable paths.
Reuse phase/task homes and add binary-owned root occurrences for inline, debug
and diagnosis work, enumerated for unsettled and deferred reviews. A repeated
filename cannot identify a repeated fire.

Persist the pending fire first, bind the return to it, make duplicate acceptance
idempotent, and close every dispatch exactly once, including failures and
fallbacks. Pending or interrupted work never reports clean. Reuse pause's gate,
findings and identity machinery without treating its staged-only contract as a
general review transaction.

**Acceptance requires an owner-reviewed live pilot.** Record a real local
advisory return, unchanged forwarding, binary persistence before completion,
failed-attempt closure and an uncommitted snapshot whose identity survives later
edits. The owner inspects those episodes and accepts the stated semantic
limitations. A valid JSON fixture cannot establish that a real review happened;
deterministic identity, persistence and replay checks do not replace this pilot.

### Phase 10: Provider port

**Goal.** The cross-model review provider arm runs in the binary: OpenAI,
Gemini and DeepSeek adapters with credential lookup, bounded payloads,
transport, sanitized diagnostics and the outer timeout, every attempt on
phase 9's delivery lifecycle, and GH-237, GH-239 and GH-240 repaired in that
code as it lands.

**Truths** (`.planning/phases/10/CONTEXT.md`): the run record holds the
provider's voice, model and usage as observed, never as requested; an error
status with usage in the body keeps the usage and the failure (GH-239); usage
that cannot be read as whole numbers is unavailable, never zero (GH-237,
GH-240); a usable empty findings list is an empty result with its voice,
distinct from a failure; a failed provider with the local fallback closes the
dispatch exactly once. Five truths, five checks.

**Rescoped 2026-09-09 under the acceptance design and the owner's "slow add"
rule.** The original phase carried eleven capabilities and 187 criteria and
was refused by its own planner. The settlement-verification layer is dropped
as new behaviour nobody has hit. The filing port is Phase 20; deferred-review
completion is Phase 21. GitLab is out; GitHub is the first-class forge.

**Acceptance still requires the owner to see it live.** One real provider
call and one deliberately failed one, observed in the run record; that is an
observation in the evidence map and caps its truths at `concerns` until seen.

### Phase 11: First approved context

**Goal.** A phase's truths are authored through the binary and persisted only
on the owner's approval. Seven truths in `.planning/phases/11/CONTEXT.md`,
approved 2026-09-09: an approved submission lands as CONTEXT.md; a truth that
breaks the sentence shape, names an internal outcome, rests on a model
answer, or is the eighth in its set is refused at authoring with the rule and
slot named; an identity collision is refused; and ending without approval
leaves the prior context unchanged.

**Rescoped 2026-09-09.** The original "Planning intake" phase below overflowed
the seven-truth cap: fifty candidate truths in ten slices. The first slice is
this phase; the other nine are phases 22-30, appended in dependency order
under the owner's "slow add" rule. The text below is kept because phases
22-30 are contexted from it; where a paragraph names phase 11 it now means
the slice that owns it.

**How a truth is submitted (D-79).** Typed slots - trigger, observer, verb,
outcome, kind - rendered by the binary into the one sentence. The binary
refuses structure it can decide: an "or" in the trigger, a second observer,
a verb outside sees / gets / is refused, an empty slot, more than seven, a
reused identity. The internal-name and prose-oracle refusals are the owner's
attestation on each truth, recorded with the approval; the binary refuses a
truth without it. This amends the sentence "the binary refuses a set that ...
names no observer, rests on model prose" below.

---

*Original phase text, now the source for phases 22-30:*

**Goal.** `cad-new-project`, `cad-adopt`, `cad-phase`, `cad-context` and
`cad-plan` run against the binary, and none of them writes a permanent file.

**Builds the acceptance subsystem's first two layers**
(`docs/architecture/acceptance.md`). `cad-context` authors the phase's
truths with the owner - at most seven, each "When <trigger>, <observer>
sees / gets / is refused <outcome>" - and the binary refuses a set that is
not in that shape, names no observer, rests on model prose, or exceeds seven.
`cad-plan` builds the evidence map: one check per truth, artifacts for what
must exist, links only where a truth names a value crossing; the binary
refuses a truth with no check, an item with no truth, a check without a
command and expected output, and a link its truth does not need. Each task's
verify names the narrowest command that settles it. Every instruction these
roles see is compiled into the binary; the `.md` Claude Code requires is
rendered from it; there is no user override. The hand-run
`.planning/tools/plan-gate.mjs` is retired, not ported.

This is the largest concentration of prose-owned permanent writes in the frozen
tree, and it is therefore where the "only the binary writes" rule is actually
tested. The families it must cover: idempotent initialize and adopt with typed
`created` fields, created atomically rather than check-then-copy; PROJECT,
REQUIREMENTS and ROADMAP content, where the model supplies structured sections
and the binary validates and persists; CONTEXT creation with criterion and
decision identity checks; and PLAN identity, path and multi-plan numbering.

**Plan-number allocation needs transaction semantics.** Sequential execution
inside one session does not prevent a second session choosing the same next
number, and the gap-plan lookup makes "next free" a real query rather than
`n+1`.

**`cad-phase` is the sharp one, and it carries a known live bug.** Its structural
mutations and the cursor update become one binary operation, with the model
supplying decisions about ambiguous prose references and orphaned requirements.
"Reconcile by hand" becomes a recovery tool with inspected state rather than an
instruction. The bug: **`renumber insert` shifts `Phase K` tokens and
`phases/K/` paths inside COMPLETED shipped requirement rows, not only live
ones** (GH-259). One insert at 3 corrupted six historical records; exactly one
hunk was correct, and the dry-run cannot show it because it reports
`{"edit":"REQUIREMENTS.md"}` with no change count. Until this phase lands, do
NOT use `/cad-phase insert` on this repository - hand-edit instead.

**Two permanent-write paths an earlier inventory missed, both landing here.**
Context intake can directly correct a REQUIREMENTS row on user approval
(`workflows/context.md:394-397`), and an adjudicated plan review can edit
surviving findings straight into the PLAN files (`workflows/plan.md:471-474`).
Both are skills writing permanent workflow files and both must go through the
binary; the second one takes its decision from phase 10 and its persistence from
here.

**What this cluster does NOT own, corrected against the frozen tree.**
`cad-new-project` and `cad-adopt` do not own their role and cost intake - they
follow config's Roles interview, which is phase 8. `cad-plan` does not own plan
review - it fires the trigger from phase 9 and obeys the settlement from phase
10. Crediting either to this phase would hide a dependency rather than remove it.

**Truths are refused at authoring, never audited later.** A malformed truth
comes back as a typed refusal naming the rule it broke and the slot it is
missing, in the same envelope as every other answer, and nothing is
persisted until the owner approves the set. An item that needs a person or a
live system is an `observation` in the evidence map, visible, never routed
out of sight; the frozen tree's `(human-verify: ...)` tag is not reintroduced.

**The falsification pass stays on Claude.** The plan is the verification
instrument, so if the same agent authors the evidence map and executes
against it there is no independent check left. A falsification pass reads a
finished plan against the frozen tree and reports which evidence items make
a FALSE claim about code that already exists.

### Phase 12: Execution and tasks

**Owns the executor's side of the acceptance design.** For every check a
task delivers, the executor writes the test first, records the commit where
it failed, implements, and records the commit where it passed; the binary
refuses a task close with either missing, or with a check that stubs its own
subject. The executor runs only what the task names while working and the
full suite once per plan, at the close. When the project has set no test
style it is given the classical default as guidance - test a unit through
what it exposes, fake only files, clock, other programs and network, skip
trivial code, write the expected value by hand - and nothing about style is
ever refused or counted. **Deletes `~/.claude/hooks/rules-gate.mjs` at
close.** That hook guards hand-assembled dispatch prompts; once this phase's
executor dispatches are built by the binary from state, the role text is
carried by construction and the guard has nothing to catch.

**Depends on phases 27, 28 and 29 (decided 2026-09-10).** The close gate
above refuses a task without red-then-green for every check it delivers, and
a check is an identified item only once phase 28 has persisted the evidence
map against a plan phase 27 stored. Phase 29's refusals complete the planning
contract before acceptance-aware execution is switched on. This phase owns
the task-to-check bindings and the red/green receipts; it does not create
check identities of its own. Hook retirement follows the state-composed
executor dispatch, not partial task-history delivery.

**Goal.** `cad-execute` in full and `cad-task` run against the binary, with the
receipts they produce owned by the binary rather than assembled by a
coordinator.

Phase 6 proved the loop on a strict subset. This phase is the rest: the
executor contract's report progression, the SUMMARY, the task record, the lease,
and `cad-task`'s treeless arm.

**Report rotation becomes durable attempt history.** Today the executor contract
renames a report and then overwrites it whole after each task commit. The
replacement is typed task-progress, checkpoint and completion operations where
previous attempts survive, because completed work must not replay accidentally
and partial progress must outlive a stop.

**The SUMMARY's mechanical fields derive from stored execution facts** - tasks,
commits - rather than being assembled by the coordinator, while deviations and
open items stay authored and stay reachable from recall.

**A third missed write path lands here:** execute can directly amend a refuted
`D-NN` decision inside CONTEXT (`workflows/execute.md:520-527`). Same rule - the
model supplies the ruling, the binary applies it.

**`cad-task` uses the task executor contract, not the phase one**: its non-phase
plan directory explicitly disables `lease-check`. Its treeless arm must keep
finishing honestly - a repository with no `.planning/` reports done with the
risk check's disposition stated and the record called unrecorded, and creates no
`.planning/` and no `tasks/<slug>/`.

**Source-scope enforcement survives the loss of parallel execution.** The lease
catches a staged file outside the plan's declared scope, includes both sides of
a rename, and protects exactly the source work that the binary-writes rule
leaves outside its ownership. Delete the pairwise overlap check and the
concurrency narration; keep declared-scope enforcement, unprovable-lease
refusal, byte-exact pathname handling and the intentional lockfile and report
exceptions.

### Phase 13: Verification and audit

**Owns the verdict.** The verifier is handed the phase's truths and their
evidence map, inspects every item for real - opens the artifact, runs the
check, traces the link, records the observation - and returns one verdict
per item: accepted, rejected or not seen, with what it observed. The binary
derives each truth's status from the verdicts: all accepted and no
observation is `met`; all accepted with an observation is `concerns`; any
rejected or unseen is `unmet`. The verifier has no field for a phase-level
pass. The owner may waive a truth with a reason, a name and a date, reported
as waived beside the met ones and never among them. Rejected evidence stays
visible with why. CI status is shown at landing as information in its own
column, never as evidence. The hand-run `.planning/tools/tree-gate.mjs` is
retired, not ported; the evidence map's artifact and link inspection is what
replaces "does this function have a caller".

**Goal.** `cad-verify` (with `cad-coverage` folded in), the merged `cad-review`,
and `cad-audit` run against the binary.

**Only the COMMAND SURFACE of the merge lands here; the subsystem belongs to
phases 9 and 10.**
`cad-decision-review`, `cad-minimalism-review` and `cad-plan-review` all point a
reviewer at an artifact and adjudicate a ruling, with near-identical operation
sets, so they become `/cad-review <target>` with the three old commands kept as
aliases. What this phase adds is the target selection and the prompt per target;
the trigger, the dispatch, the provider arm and the adjudication were built in
phases 9 and 10 and are fired, not reimplemented.

**The verifier stops writing its own findings file.** It submits verdicts to
the binary as a patch, and the binary stores input provenance and the
accepted or rejected result per item. What was claimed and what was rejected
both remain on the record; "two files, two writers" is the obsolete part,
not the evidence.

**A human UAT result must never be overwritten by a verifier**, and only full
completion advances status. Binary persistence does not turn a model claim into
a trusted fact, and the exact code and index that were reviewed remain part of
the record.

**Status authority spans skills and the tests must say so:** plan seeds Pending,
verify alone advances completion, undo legitimately resets it, and progress
derives truth and only repairs the cursor. A per-skill suite can otherwise pass
while producing inconsistent shared state.

### Phase 14: Receipts and retune

**Goal.** `cad-progress` (with `cad-health` and `cad-report` folded in),
`cad-why`, `cad-suggest` and `cad-capture` run against the binary, and the
decisions log is good enough to diagnose a live failure.

**This phase owns the log's content bar.** Decisions and outcomes only - routing
decisions, gate outcomes, refusals - and each record must carry enough to
explain what went WRONG, not merely enough to count. If live usage is the test,
the system has to be observable in live usage, which is why this is a
correctness requirement and not analytics.

**`read-trace` and `subagent-trace` are removed here.** Reads are dropped
entirely. The subagent hook's replacement is that every dispatch returns a state
patch, so the binary learns a subagent finished by being TOLD. **The residual
risk to design for, explicitly: a subagent that dies or returns nothing never
reports, and today the hook catches that because `SubagentStop` fires
regardless. The hook's real value is detecting the FAILURE to report, not the
happy path.** Do not close this phase without an answer to that.

**`cad-why`'s rendered text is byte-exact** (`skills/cad-why/SKILL.md:24-28`).
It is one of the few places identity is promised to the user, so it is asserted
as identity. Its corpus join must also read git history for pruned phases now
that `ARCHIVE.md` is gone.

**`cad-suggest` is the log's highest-value consumer** - seventeen invocations,
the fifth most-used skill - and it needs the REASONING rather than the history,
which is why routing is the one log category nothing else can supply. Its
accepted-suggestion handoff writes config keys directly, and it must relay
figures unchanged, show the exact proposed tokens, and write nothing before
acceptance.

**`cad-capture` keeps its accumulation policy even though its lint retires.**
`lib/capture-writers.mjs` is not only policing direct file writes: it classifies
capture-producing sites by whether they accumulate durable queue material. A
binary-only system can still accumulate one unwanted capture per close forever,
so the retention and accumulation policy survives even though the shell and
subcommand recognizers do not.

### Phase 15: Landing and milestones

**Goal.** `cad-land`, `cad-milestone` and `cad-undo` run against the binary,
with the ordering that protects evidence enforced rather than instructed.

**The ordering is the whole phase, and it has no import edge anywhere in the
frozen tree.** Risk carry, then deferred carry, then prune, then land - it
exists only as prose at `workflows/milestone.md:103,128`. Individually correct
modules can still delete the evidence that should have blocked a landing.

**Milestone prune loses its archive mode with `ARCHIVE.md`.** What survives is
the transaction discipline underneath it: dedup by actual artifact, preserve the
unreadable-versus-missing distinction, and persist enough before deleting. A
crash or retry during prune remains possible.

**Landing is where external effects stop being transactional with local
storage.** A tracker create or a publish can succeed remotely while the reply or
the local record is lost. Preserve idempotency and reconciliation, avoid blind
retries of paid or mutating actions, and keep the title-scoped fingerprint
lookup that stops an already-filed finding being filed twice.

**Authorize before publishing, and confirm the merge before pull, tag or reap.**
With `git.auto_close` retired, no path publishes or merges without an explicit
authorization, and phase 18 asserts that absence.

**`cad-undo` mutates permanent workflow files through a prose-directed `git
revert`**, not an operation-specific writer (`workflows/undo.md:26-38`) - the
committing and `--no-commit` paths both. That is the last of the missed
prose-mutation paths and it needs a binary-owned equivalent.

**`cad-undo` uses protected-branch checks only**, not integration advice, and
rolls back from the SUMMARY's commit manifest. Exact shown hashes only, reverse
order, no status reset in `--no-commit` mode, and stop on conflict.

### Phase 16: Support

**Goal.** `cad-debug`, `cad-spike` and `cad-help` run against the binary.

`/cad-config`'s command surface is NOT here - it moved to phase 8 with the
config layer itself, because `cad-new-project` and `cad-adopt` delegate their
whole Roles interview to it and would otherwise depend on a later phase.

`cad-debug` fires the shared risk-surface reviewer and imports the shared triage
and re-arm semantics (`workflows/debug.md:120-136`); it does not own review, and
phases 9 and 10 supply it. `cad-debug` and `cad-spike` persist hypotheses, state and
verdicts through the binary. Do not lose interruption recovery or the falsifiable criteria recorded
BEFORE an experiment - that ordering is what makes a spike a spike. Temporary
experiment material keeps its own lifecycle and is not a permanent write.

`cad-help` is a product requirement, not a nicety, and it is here because John
reversed its proposed deletion: "if a user can't issue that, we're gonna get
dinged for it." A self-describing MCP tool list does not replace it.

### Phase 17: Contract enforcement

**Goal.** Obligations that exist today only as prose instructions to a model
become behavior the binary enforces.

Measured 2026-09-05 across 88 files: **298 command sites** (15 parallel-only, 4
embedded `node -e` programs), **137 prose-only obligation families** and **70
refusal and formatting contract families**. Most of those distribute into the
cluster that owns them; this phase owns what belongs to no single cluster, plus
`git-guard`.

**These are the parity breaks an output diff cannot catch**, because their
failure mode is ordering, timing, cross-session state or an ABSENT refusal. The
ranked worst: preserving risk and deferred evidence before prune and land
(`workflows/milestone.md:103`); writing completion only after a green suite
(`skills/cad-executor-contract/SKILL.md:92`); staging the actual fix before
scanning the index (`workflows/verify.md:274`); preserving and consuming re-arm
allowances across sessions (`references/triage-gate.md:160`); authorizing reused
MRs and confirming merge before pull, tag or reap (`skills/cad-land/SKILL.md:202`);
requiring correctly scoped durable evidence before "done" (`workflows/task.md:208`);
preserving artifact identity and the outer provider timeout
(`references/review-cross-model.md:98,120`); and dispatching exactly the
outstanding set including gap plans (`workflows/execute.md:74`).

**`git-guard` is NOT here - it moved to phase 7**, ahead of the sixteen skills
that commit through it. What remains in this phase is the residue: the
obligations whose consumer is spread across clusters and which no single one can
own.

**The self-verify checks are regenerated, not deleted.** Several recognizers
become obsolete when MCP calls replace shell invocations, but product grammar,
risk and gate tests, evidence-provenance checks, config reachability and
supported-skill references all remain useful. Deleting the module because some
recognizers retired would discard unrelated guarantees.

**Resource limits are more important under residency, not less.** A hand-edited
log, a huge project, a broken provider or a repeated call can exhaust memory,
and a child process that exited used to reclaim descriptors and memory for free.
Bounded reads, observable truncation, per-operation deadlines, backpressured
queues and explicit shutdown behavior replace what process exit used to do.

### Phase 18: The acceptance gate

**Goal.** Parity at the user-facing surface is asserted, not claimed - and it is
asserted at the scenario boundary, because the CLI-invocation boundary died with
the port model.

**Three complementary levels, and none of them is an operation-output diff.**

1. **Scenario acceptance contracts**, keyed by skill plus mode plus user
   decisions plus the evidence or failure path. These own public parity. Each
   names its stop point, because "the skill returned" and "all its effects are
   durable" are different claims.
2. **Deterministic domain invariants and state-transition tests** for acceptance
   ids, UAT first-pass and human ownership, cursor derivation, scoped review and
   ruling identity, replay, item append and dedup, and safe publish
   authorization. **Select each invariant because a consumer depends on it, not
   because a JavaScript function once existed.**
3. **A small live-model evaluation suite** for plan quality, actual code
   behavior, question quality and adversarial review grounding. Record evidence
   and budgets, and do not claim deterministic parity for reasoning quality.

**Where the naive one-skill-one-test unit fails, and the gate must handle it:**
interactive inputs decide the output, so scripted decisions are part of the
fixture; model work is nondeterministic, so pin change scope, evidence, commit
separation and SUMMARY coverage rather than source text; resumption crosses
invocations and sessions, so pause-then-progress, verify-clear-verify,
execute-timeout-replay and milestone-then-land are single episodes; advisory
completion waits for binary persistence, so test interrupted delivery, replay
and durable acknowledgment before completion; and external effects are not
in the fixtures, so stub the forge and keep a small isolated integration suite
for successful effects.

**Maintain exact identity only where identity is promised** - `cad-why`'s text,
verbatim finding bodies, `issue-check`'s skip reason. A semantic judge would
miss those failures; a byte-diff everywhere else pins transport that has
deliberately changed.

**The gate asserts ABSENCE for what 4.0.0 retired**, which no output diff can
do because a retired feature produces no output: no parallel path, no
`git.auto_close`, no reads log, no `ARCHIVE.md`, no `cad-docs-verify`, and no
JavaScript anywhere in the shipped plugin.

**Phase 2's fixtures and normalization rules are the seed corpus.** For each
assertion carried forward, name its public consumer and translate it into a
domain or scenario invariant; drop the ones that only pin obsolete transport.

**Write down what is knowingly untested before this phase closes.** An
acknowledged gap is a decision; an unnoticed one is a bug found later.

### Phase 19: The release path

**Goal.** A tagged release publishes four checksum-verified archives, and a
machine that starts a session gets the right binary installed without being
asked.

The `publish` job verifies each archive's sha256 against a pin file committed in
the plugin and refuses the release on any mismatch. A POSIX shell SessionStart
hook reads that pin, fetches the platform's archive, verifies it and installs
the binary at a versioned path. The plugin's `.mcp.json` points at that path.

Scheduled last on purpose. It depends on phase 1's crate, packaging script and
cross-compile matrix, and the pin cannot be filled until the version being
released is the one that will carry the archives - which is the `4.0.0` landing,
not any tag that exists today. An earlier draft plan was written as phase 1's second plan on 2026-09-05,
moved out the same day, and deleted on 2026-09-08: it predated the phase
renumbering, declared the wrong phase, and had no executable task block. It
is recoverable from git history if wanted; this phase gets a plan written
against the roadmap as it now stands.

### Phase 20: Filing port

**Goal.** Issue filing moves from frozen JavaScript
(`cadence-core/bin/issue-filing.mjs`, `lib/filing-decision.mjs`) into the
binary, GitHub first-class, GH-250 and GH-251 repaired as it lands. Parked
here 2026-09-09 under the owner's "slow add" rule; it was the second
deliverable inside the original phase 10.

**Truths, approved by the owner 2026-09-09:** the tracker gets a new
issue only after a person has chosen to file it; an issue whose exact
fingerprint already exists on the tracker gets no second issue (GH-251); when
the local filed record cannot be read, filing still looks up the tracker
before deciding (GH-250); an ambiguous create marks the item uncertain and a
later reconciliation resolves it. GitLab lookup is not owed.

### Phase 21: Deferred review completion

**Goal.** Complete the half-built deferred-review capability: carry and
retention across every admitted home, supersession only by matching valid
settlement (never a sibling file), and a one-extra-round allowance consumed
durably so a restart cannot re-arm an exhausted fire. Parked here 2026-09-09
under the owner's "slow add" rule; binding decision D-78 from the 2026-09-07
phase-10 context (`998f2187:.planning/phases/10/CONTEXT.md`) carries forward
when this phase is contexted.

**Truths, approved by the owner 2026-09-09:**

- T1. When a deferred review has no settlement that matches its fire, round
  and recorded voices, the next-action reader still lists it, whatever files
  sit beside it.
- T2. When a fix answer has used its one extra review round, a restarted
  session is refused a further round for that fire.
- T3. When a deferred review is admitted in any home the binary knows, a
  later session in that home finds it with its originals and lifecycle state
  intact.

Three truths, three checks. The two known holes - a sibling file hiding a
member (`crates/cadence/src/pause_service.rs:711`) and the extra round
re-arming after restart - are T1 and T2.

### Phase 22: Structured planning documents

**Goal.** Approved PROJECT, REQUIREMENTS and ROADMAP sections are validated
and persisted by the binary; a submission that breaks its section schema or
leaves an active requirement without exactly one roadmap assignment is
refused with the offender named. Parked from phase 11 on 2026-09-09; the
first of its nine slices, and the shared write boundary for 23-25. Truths are
authored when the phase is contexted (candidates T07-T12 in the research
draft).

### Phase 23: Bootstrap front doors

**Goal.** `cad-new-project` and `cad-adopt` initialize and adopt through the
phase-22 document operations and phase 8's roles interview, idempotently,
with typed creation receipts; an unreadable brief or a non-repository root is
refused. Parked from phase 11 on 2026-09-09 (candidates T01-T06, T12).

### Phase 24: Small roadmap changes

**Goal.** `cad-phase` add and edit go through the structured roadmap
boundary. Parked from phase 11 on 2026-09-09 (candidates T13-T14).

### Phase 25: Structural phase changes

**Goal.** `cad-phase` insert and remove with approved reference decisions,
completed-row protection so an insert never rewrites a shipped requirement's
history (GH-259), an exact preview, and recovery of an interrupted mutation.
Parked from phase 11 on 2026-09-09 (candidates T15-T20). Until this lands, do
NOT use `/cad-phase insert` on this repository.

### Phase 26: Context revision

**Goal.** Approved changed truth text yields a new version of the same truth,
and context intake's approved requirement-wording correction goes through the
binary, refusing an unserved row. Parked from phase 11 on 2026-09-09
(candidates T28-T30).

### Phase 27: Plan persistence and allocation

**Goal.** Plans are stored at safe, distinct identities; a mismatched
identity or an out-of-phase path is refused; number allocation is a
transaction that a retry cannot double-allocate; replacement needs owner
authorization. Parked from phase 11 on 2026-09-09 (candidates T31-T37).
Whether `/cad-plan` may run without approved truths is decided here.

### Phase 28: Evidence associations

**Goal.** A plan's evidence map attaches to the phase's current truths; a
map that leaves a truth uncovered, an item naming no truth, or an item
naming a stale truth version is refused. Parked from phase 11 on 2026-09-09
(candidates T38-T42). Must land before phase 12 records a check's red-then-green
or phase 13 accepts a verdict on an evidence item; depends on phase 11's approved
truths and phase 27's persisted plan. T40 (whether an observation may stand in
for a required check) stays open until this phase is contexted.

### Phase 29: Check and link limits

**Goal.** A check without a command or expected output, a second check on
one truth, and a link its truth does not need are refused. Parked from phase
11 on 2026-09-09 (candidates T43-T46). Consumes phase 28's map and completes
the planning refusals before acceptance-aware execution (phase 12) is
activated; the one-check limit is phase-wide across plans. Layer 2 of the
acceptance design is complete only when this lands; it is not a prerequisite
of status derivation itself.

### Phase 30: Plan review handoff

**Goal.** A completed plan reaches the enabled review trigger with its
reference material, and only owner-selected review edits are persisted into
the PLAN files, refused against a plan changed since review. Parked from
phase 11 on 2026-09-09 (candidates T47-T50). Blocked on an explicit
replacement for the settlement dependency phase 10 dropped.
