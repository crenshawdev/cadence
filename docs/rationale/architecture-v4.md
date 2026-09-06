# Cadence 4.0.0: excerpt folds in, the binary owns process

Working notes from 2026-09-05. Pick this up with cadence after the current
milestone closes (relabeled v3.7.12 on 2026-09-05; last tag v3.7.11). The data behind every number here is in the excerpt usage report of the same
date (rounds 1-7), kept in private working notes.

## 1. What was decided today

- excerpt is not viable as a standalone product. Its tools arrive deferred on
  every main thread, and the only user-side override costs +57,959 tokens per
  session. It works only where a harness names its tools in agent
  definitions. That harness is cadence, in 42 files, today.
- excerpt folds into cadence as its read/search layer. Opt-in at setup,
  `tools.excerpt` config key with `on | off | auto`, default `auto`. Invariant:
  with excerpt absent, every prompt cadence emits is byte-identical to today.
- The current milestone ships as v3.7.12 with the new rungs, then the 3.x
  line freezes. The rewrite is 4.0.0: an architectural change, not a port. Sections 3-6 describe it.
- Nothing lands until cadence phase 3 and the milestone close. Two
  injection points found today sit inside live plan leases.
- It is cadence 4.0.0, not a new product (John, 2026-09-05). 3.x freezes as
  a maintenance branch. Same mental model: the `/cad-*` vocabulary, the
  `.planning/` layout and the phase-plan-execute-verify rhythm stay unless a
  specific reason to change one is found and decided. The hard line that
  keeps it a version and not a fork: the Rust server reads a `.planning/`
  directory from the milestone-close tree unchanged; new frontmatter fields are additive with defaults;
  `cadence migrate` covers anything that cannot be.

## 2. The evidence, compressed

Full tables in the usage report. The numbers that drive the design:

- Main threads since excerpt 0.0.6: 0% excerpt use in every cadence-driven
  session measured. Preloaded subagents: 20-77%. Cause confirmed against
  transcripts: subagents whose agent definition names the tools call excerpt
  on tool call #1 with zero ToolSearch; main threads get the tools deferred.
- Clean A/B (same task, same role, same rung, cadence phase 3 analyzer):
  74 -> 64 tool calls with excerpt, tokens 162,866 -> 180,526 (+11% total,
  +28% per call). Built-in Read 19 -> 5. Shell read verbs 81 -> 52.
- The deny works where it reaches. Built-in Read fell to 0 in every
  weathervane session post-0.0.6. The nudge does not: it fires after
  the call is composed, and roughly 25 of 33 main-thread shell calls it fired
  on were things excerpt cannot serve (node orchestration, heredocs, multi-range
  sed, grep with -A/-B).
- A wrong belief about a tool's capability is not corrected by nudging toward
  its use. The weathervane main thread declined excerpt_read because it
  believed excerpt_read returns outlines and cannot serve a range. It can
  (`start`+`count`); its own subagent used that 11 times in the same session.
  The belief came from the only description of excerpt in its context, and
  eight later nudges changed nothing because the question was already closed.
- Cadence's own prose has the same defect. `cad-executor-contract/SKILL.md:47`
  says "Skim to find, Read to change" and never names excerpt_read as a range
  tool. Six contracts carry conditional excerpt wording; 25 workflows and 28
  command skills carry zero mentions of excerpt.
- Cross-subagent redundancy: one pre-excerpt weathervane phase, 16 subagents,
  144 file reads of 57 distinct files (2.53x). 106 of 144 reads hit a file
  another subagent had already read. CONTEXT.md read by 7 of 16 agents.
  This is NOT deduplicable by a read cache (each agent is its own context);
  only a smaller dispatch payload or a shared digest addresses it.

## 3. The architecture: a session-resident server

Three parties, one authority each.

The binary owns truth about process. If it can be derived from disk, git,
configuration or prior records, the model does not decide it.

The model owns engineering judgment. It interprets intent, code, plans,
evidence and failures. The binary does not pretend to understand them.

The skill owns orchestration. It asks the binary what is true, asks the model
what something means, and passes each answer to the other. It contains no
hidden state machine.

Plan files follow the same boundary. Frontmatter is machine state. The body
is engineering intent. Neither side parses the other's language to recover
facts it should have been given explicitly.

Retrieval boundary, sharpened: the binary owns retrieval, the model owns what
it is trying to learn. "Find all plan files", "read the current git range",
"enumerate changed files" are binary. "Find the code responsible for auth
refresh" is the model choosing terms and call paths, then requesting the
search through the binary. Deterministic without being secretly semantic.

Cadence becomes one long-running process per session, the process excerpt's
MCP server already is. The main thread and every subagent share it. The
prose shrinks to orchestration; the binary owns process.

What moves into the server:

- Reads and searches (excerpt_read, excerpt_search). Telemetry becomes a
  counter in the server, not a transcript parser.
- The 14 scripts the prose currently invokes via `node bin/x.mjs` (158 call
  sites). They become tool operations. Bash stops being the channel cadence
  pushes the model into, so it stops carrying `cat`/`sed`/`grep` along.
- Dispatch composition. `dispatch(role, phase, plan)` returns the stable-first
  prompt, injects the excerpt block when present, omits it when absent. The
  byte-identical invariant becomes a unit test.
- Trace. PostToolUse and SubagentStop hooks in the same binary record every
  dispatch and digest. The model stops hand-writing trace.jsonl lines.
- State rendering. trace.jsonl + git is the truth. STATE.md and SUMMARY.md
  are rendered from it. `/cad-progress` becomes `cadence status`.

What stays with the model: planning, reviewing, verifying, executing code.
Everything that needs judgment about content. The binary owns bookkeeping
about process.

Disk stays the truth. `.planning/` and trace.jsonl persist; the server is a
cache a `--resume` rebuilds. (excerpt NOTES.md: one server process per
session, CLAUDE_CODE_SESSION_ID in env, fresh process on resume.)

### 3a. The binary's external contract is boring on purpose

Every operation returns a typed envelope with a small vocabulary: `ok`,
`refused`, `unknown`, `not-applicable`, structured fields underneath.
"Couldn't determine" never collapses into `false`; v3.7.11 spent a release
learning that in comments, and the rewrite bakes it into the type system.

Rust makes illegal states unpleasant to represent. A range check is one enum,
not five JSON shapes: `ResolvedRange | UnresolvedBase | UnresolvedHead |
NoRange`, and callers handle each arm. Lifecycle likewise: `Unplanned |
Planned | Dispatchable | Executing | NeedsVerification | Complete | Blocked`,
not strings sprinkled through workflow markdown.

### 3b. Internal modules vs external tool surface - do not conflate

Internally: hard domain modules. Project state, planning, dispatch, git,
routing, evidence/trace, forge, retrieval. The CLI is a shell over them.
One binary, not one blob.

Externally, over MCP: three or four tools, because of section 4. A domain
module is not a tool. If each module became its own MCP tool the main thread
would pay ~900 tokens and a working-set slot per module, which is the
problem this design exists to remove.

### 3c. What a skill looks like afterwards

`/cad-execute`, conceptually:
1. Ask the binary for the next dispatch.
2. If refused, tell the user why.
3. If dispatchable, invoke the executor with the prompt the binary produced.
4. Give the executor's result back to the binary.
5. Repeat until the binary says execution is complete or judgment is needed.

No replay algorithm in markdown. No report-file discovery. No deciding
whether a plan already committed. No reconstructing the next plan number. No
prompt built from twelve prose rules. `/cad-progress` becomes: ask, render,
offer the action.

The dispatch the binary produces carries the operational part from
frontmatter - "you own these files; these dependencies are satisfied; this is
attempt 2; report here" - and attaches the plan body as the engineering
assignment. The model never reasons about frontmatter to understand the job.
A different model could execute the body tomorrow knowing nothing of
cadence's state machinery, and replay detection could change entirely without
touching how a plan is understood.

### 3d. Design changes forced by SKILL.state (2026-09-05)

The paper (section 7, external evidence) confirms the shape. These six are
what it CHANGES, not what it restates.

1. Every dispatch returns a state PATCH, not a report. The binary owns one
   state schema per role, authored once. An executor's return is a typed patch
   against its plan's subtree (task ids done, commits, deviations, blockers);
   a verifier's is a patch of verdicts per acceptance criterion. The binary
   validates the patch, merges it, and on an invalid or lossy patch returns
   `refused` carrying the validation error so the retry is informed. The
   model never writes state. Today's five-field executor digest is the
   proto-patch; formalize it. Reason: their 68% failure mode on a 31B model
   was the model dropping keys when allowed to write state freely, and
   constrained decoding is not available to us through Claude Code, so
   validate-and-retry is the only lever.

2. Patch scope equals dispatch scope. A plan's executor may patch only its
   own plan's subtree; the validator rejects anything outside it. Cross-plan
   facts (shared files, ordering) are decided by the binary before dispatch,
   which is what overlap-derived sequencing already does. This answers the
   paper's open multi-agent problem by construction: parallel worktree
   executors produce disjoint patches, so the merge never has to resolve a
   conflict.

3. State and trace are different things, said explicitly. State is a small
   sufficient statistic, mutable, the only thing the model is shown. Trace is
   append-only, complete, the audit log and the rendering source for
   STATE.md/SUMMARY.md, and it is never fed back to the model. Raw tool
   output goes to trace; what survives into state is what the patch keeps.
   That is how their distractor test held 0.98 where a transcript fell to
   0.53: noise never re-enters a later prompt.

4. State carries references, not content. Commit hashes, decision ids,
   deviation ids, report paths. A `recall(ref)` operation retrieves the
   record when judgment needs history. This is their named limitation (an
   earlier observation whose relevance was not recognized at the time) turned
   into a design rule: the planner and the debugger DO need history, so the
   binary owns retrieving it on request rather than the state carrying it.
   Cadence already has the records (CONTEXT.md decisions, /cad-why, verbatim
   recall); this makes them addressable from state.

5. The skill loop carries nothing between steps. `next` returns a small
   envelope; the dispatch prompt is built by the binary from state; the
   executor's result goes to the binary as a patch, not into the main thread's
   reasoning. Report bodies stay on disk (already a 3.x rule: "never back
   into a dispatch prompt"). The main thread's context still grows with tool
   results because the harness appends them, so the lever is envelope size.
   Keep every `next` answer small.

6. Two metrics added to trace per dispatch: prompt size per invocation and
   main-thread context growth per phase. Those are the paper's axes. They
   give a same-phase 3.x-vs-4.0.0 comparison, which is the go/no-go the
   rewrite is judged on.

### 3e. Enforcement: the boundary is the only path

The rules in 3d are not enforced on the model. The boundary is built so there
is nothing to enforce.

1. The tool schema IS the patch schema. `cadence_report` (or whatever the
   report op is named) takes a JSON object shaped as the role's patch: task
   ids, commits, deviations, blockers, lifecycle as an enum. The BINARY
   validates it, not the MCP layer. The schema's job is to DESCRIBE the call
   so the model knows how to make it; the binary is the only authority on
   whether an argument is valid. A malformed argument comes back as a
   `refused` envelope naming what was wrong, in the same vocabulary as every
   other answer and reaching `trace.jsonl` like every other answer. An
   MCP-layer rejection would be neither: an `InputValidationError` in a shape
   the envelope does not cover, thrown by a layer the binary never sees, so
   the one failure the type system exists to handle would be the one failure
   that escapes it. Validation also moves inward as the tool count falls -
   section 4 forces three or four tools over many ops, and a union schema
   validates less the more it covers. Prose is still not a valid argument and
   still cannot become state; that is enforced one layer in. Decided
   2026-09-05, revising this item's original claim that the MCP layer rejects.
2. The validator checks scope. A patch from plan 2's dispatch touching plan
   1's subtree returns `refused` with the reason. The skill loop re-asks
   `next`; the retry is informed.
3. The hook guards the files. Excerpt's PreToolUse hook already ships in the
   binary (matcher `Read|Grep|Bash`). Extend the matcher to `Write|Edit` and
   deny writes to `.planning/STATE.md`, `SUMMARY.md`, `trace.jsonl`. Those
   are rendered outputs. The model's only route to state is the tool.

No JavaScript remains and there is no shim. A redirect script that calls the
binary would put the model back in Bash, the channel this design removes.
Skills call MCP tools directly. Subagent definitions list the cadence tools,
excerpt's two, and the code tools. Skill frontmatter `allowed-tools` lists the
same so users not on bypass get no permission prompts (verified 2026-09-05:
`allowed-tools` grants permission; it does not preload).

The one non-Rust piece is a bootstrap. A plugin is a git repo, so the binary
must be fetched on first run: a short POSIX shell SessionStart hook that
downloads the platform release, verifies the checksum, installs it. After
that the binary handles everything including its own updates. [guess] under
40 lines; untested.

### 3f. Scope guard

The binary encodes cadence's methodology, not infrastructure for hypothetical
methodologies. No generalized workflow engine, no plugin DSL, no arbitrary
agent graphs. The existing command loop is the migration spine; rebuild only
what it exercises. Afterwards: docs explain why, skills orchestrate, Rust
decides, models judge, and no duplicated process rule is left to drift.

### 3g. The enum workflow spine, and why 4.0 keeps it internal (2026-09-06)

Source: `cadence-rust-rewrite-architecture-handoff.md`, John's notes plus a
Codex conversation. Its thesis is that workflow stages become Rust enums so the
binary KNOWS state rather than a model interpreting prose, transitions read
`(current_state, evidence) -> valid next state`, and the orchestrator shrinks to
ask / dispatch / return. The direction is accepted. Three corrections and one
scope ruling apply.

**Its premise is half wrong, and that changes the shape.** Phase state is
already derived mechanically, not held in prose. `bin/planning/core.mjs:192`
(`derivePhases`) reads PLAN / SUMMARY / UAT off disk to get `unplanned |
planned | executed | complete`; `bin/planning/status.mjs:160` takes `current`
as the first non-complete phase; `status.mjs:164-170` already reports drift
when a ROADMAP checkbox disagrees with the derived status. What IS prose is
STATE.md's `Status:` / `Next:` cursor and the checkpoint and blocked overlays
that live in report text. So the question is not "replace prose with an enum",
it is whether the enum is STORED or DERIVED.

**Derived. The enum types the output of the derivation; it is not an
authoritative store.** Cadence's load-bearing property is that a human edits
the markdown and the tool agrees with them. A store makes every hand edit into
drift and grows a repair command to reconcile it. Keep the derivation as truth
and store at most a memo keyed by a hash of its inputs, where disagreement is a
hard error rather than a silent recompute.

**It is not one enum.** State is a product of independent axes: phase id, the
derived phase status, plan and task position, gate outcomes (plan-check,
review, UAT, verification) and an overlay (paused, checkpointed-awaiting-
decision). Flattened into one enum those multiply out and the exhaustiveness
being paid for turns into noise. The shape is a struct of small enums with
transitions as a function over the tuple. Stated explicitly because "the enum
is the contractual workflow spine" will otherwise be built literally.

**`evidence` is undefined and load-bearing.** In `(current_state, evidence) ->
next`, evidence is the whole design: today it is filesystem and git facts -
plan files, SUMMARY, UAT pass state, commits, trace brackets. The transition
function cannot be written until that set is enumerated. Enumerate before code.

**Derive the variants from phase 2's recordings, not from a design session.**
The handoff doc's own rule - only states justified by observed behavior, and a
new variant requires evidence that the existing model cannot represent a real
condition - enforces itself if the enum is sequenced after the golden harness,
whose recordings ARE the observed behavior of the frozen surface. Sequenced
before it, the rule is an assertion.

**Design elements the doc omits.** (1) An operator override: a machine that
permits only legal transitions must carry a RECORDED override, because "skip
that, do this" is most of Cadence's day-to-day value; designed in, or it
arrives later as an undocumented flag. (2) Evidence refs on contracted results:
a typed `Accepted` carrying no commit SHAs, `file:line` or criterion ids is a
rubber stamp - prose ambiguity moved into a field, minus the prose that let a
human catch a wrong call. (3) Code anchors verified at read time: the
`CodeAnchor { path, symbol, start_line, end_line, source_revision }` idea is
the strongest in the doc, but anchors rot silently unless the symbol is checked
to still exist at that path and the content hash of the range still matches.
(4) Retrieval scope: "LSP/compiler-backed" implies a language server per
project, and cadence is language-agnostic; the cheap deterministic retrieval is
git, tree-sitter and grep, which is excerpt's territory, so compiler-backed
lookup is an optional accelerator and not the mechanism.

**Scope ruling, John 2026-09-06: internal only at this point.** The handoff doc
named enum-backed workflow state as a 4.0 goal; the nineteen-phase roadmap has
no such phase and is parity-only (`ROADMAP.md:9` states "no hidden state
machine"). The ruling settles it in the roadmap's favour. In 4.0 the spine is
INTERNAL: the enum types the derivation, every JSON answer stays byte-identical
to `v3.7.12`, and authoritative state defers to a later stage. No phases are
inserted; the nineteen stand. The reason is that new behavior in the same
release whose golden tests pin the old behavior fights itself.

## 4. The deferral constraint, and the rules it forces

Measured facts (CLI 2.1.261):

- MCP tools arrive deferred on the main thread. Mode is decided by `YJe()` in
  the CLI: default is `tst` (deferred). `standard` (no deferral) is reached
  only by the `ENABLE_TOOL_SEARCH` env var (`false` or `auto:100`), which is
  all-or-nothing across every MCP server. Cost measured: 29,859 -> 87,818
  tokens per session with a full MCP server set; 28,088 -> 46,100 with excerpt
  alone. ~42K of the delta is other servers. Not a shippable instruction.
- `non_deferrable_builtins` is read from a GrowthBook flag and from
  server-delivered client data. Nothing a user writes reaches it.
- Skill frontmatter `allowed-tools` grants permission; it does NOT preload
  the schema. Tested: ToolSearch preceded excerpt_read with and without it.
- A repeat ToolSearch is not a no-op. First load cost 914 tokens
  (cache_creation on the next turn), repeat cost 905. The model receives the
  full schema again with no already-loaded notice.
- Bash was used without ToolSearch in every transcript read today.
- Subagents whose definition names the tools have them at call #1. Cadence
  writes every one of those definitions, so subagents are solved.
- The CLI carries `preCompactDiscoveredTools` and "carried from compact
  boundary" strings. [guess] loaded tools survive compaction; not observed.

Design rules that follow:

1. Expose FEW tools. Three or four grouped by domain plus excerpt_read and
   excerpt_search. Not fourteen. Each schema is ~900 tokens to load and the
   working-set problem is per tool.
2. The load is a preamble in EVERY command skill, not one. Users enter at
   `/cad-context`, `/cad-task`, `/cad-debug`, `/cad-adopt`. Phrase it
   conditionally: "if excerpt_read is not in your loaded tools, ToolSearch
   `select:` it". Unconditional would cost ~900 tokens per skill invocation;
   a context->plan->execute->verify run would pay ~3,600 for one useful load.
   [guess] the model skips when told conditionally; untested, one run needed
   before it goes into 28 files.
3. Give the prose NO shell path to the same work. Keep `cadence <op>` as a
   CLI for humans and CI; skills never name it. The weathervane trace showed
   the model avoids ToolSearch only when Bash is a free substitute. Remove
   the substitute and the calculus flips.
4. Failure mode is soft: calling a deferred tool unloaded returns an
   InputValidationError that names ToolSearch. One wasted call.

## 5. Where a decision lives, and what it does to plan files

Rule: a decision that is a function of disk, git and config belongs in the
binary. A decision that needs reading code or prose for meaning stays with
the model.

Binary: what's next, the dispatch set, sequential vs parallel, which rung,
replay needed, which tasks already have commits, the dispatch prompt.
Model: is this plan sound, does the diff meet acceptance, what does this
failure mean.

The example that shows the line: `.planning/phases/3/PLAN-1.md` frontmatter
carries `phase`, `plan`, `requirements`, `files`. The parser reads `files:`
only. The body then says in prose "Sequential plans. This plan runs FIRST;
PLAN-2 and PLAN-3 share declared paths with it" and lists nine files by hand.
That ordering is a pure function of the three `files:` lists.

Plan file changes, one direction only - frontmatter grows, body stays free:

- Stable task ids, so the binary reads `git log` and knows which tasks are
  done without the model's report.
- Verify commands as data, so the verifier gets them from the binary.
- No `depends_on`; overlap derives ordering.
- The body remains what the planner writes for the executor. The binary never
  parses it. Two owners, two regions, neither reads the other's.

State inversion: trace.jsonl + git is truth; STATE.md / SUMMARY.md rendered.

## 6. Rust, all of it

Decided 2026-09-05: no Bun bridge. If cadence is rewritten, it is rewritten
whole, in Rust, as the section-3 server. A Bun-compiled interim was
considered and rejected: it would ship a 61 MB binary, port 114 node:test
files onto a partial implementation, and still leave excerpt as a second
process because `bun:ffi` is not production-grade. Two migrations for one
outcome.

What Rust is for here:
- One static binary carrying the server, the hooks, excerpt's tree-sitter
  and ripgrep, and the CLI. 11 MB-class.
- `skim.mjs` becomes a real tree-sitter comment strip; `bm25.mjs` becomes
  ripgrep-backed search.
- The undeclared Node dependency is gone. Claude Code ships as a Bun binary
  and does not need system Node; cadence today needs it on all 158 call sites.
- Cross-compile from one CI job, already the excerpt setup.

Size of the job: cadence-core is 48,196 lines of non-test JS in 126 files
plus 65,995 lines of tests. Those do not port 1:1. The rewrite is
architectural, so much of the JS is prose-adjacent glue that has no
counterpart in the server design. The 66K lines of tests become the spec for
golden tests against the binary, not a port target.

The JS codebase at the close of the v3.7.12 milestone is the reference
implementation and stays frozen until the Rust server reaches parity on the
golden tests. Pin it to a commit, not a version string: the planning docs say
this cycle may not tag or publish, so `v3.7.12` may never exist as a tag.
Record the commit hash here when the milestone closes: ____________

Zero-dependency ethos revoked for the Rust codebase (John, 2026-09-05). It
existed to keep `node bin/x.mjs` runnable on nothing but Node builtins. A
static binary makes that moot: dependencies compile in and the user never
sees them. Use crates where they earn their place (rmcp, tree-sitter,
grep-searcher/ripgrep crates, serde, clap already do in excerpt). The
constraint that replaces it is the one that matters for a shipped binary:
every dependency is vendored by Cargo.lock, builds offline, and
cross-compiles from the one CI job.

## 7. Expectations (no data; tagged)

Performance: process spawns are not the lever (tens of ms [guess] against a
440,000 ms dispatch). Turn count is. Expect 10-20% fewer main-thread turns
[guess], scaled from the A/B's 74->64.

Tokens: modest, possibly net-negative early (excerpt is at +11%). The one
sizable lever is prose: `/cad-execute` loads SKILL.md + execute.md + the
executor contract, 53,774 bytes, ~13K tokens [estimate, 4 chars/token],
mostly procedure. Half of that moving into the server is ~6K off every
request's cache read for the session. Workflows total 324 KB; references
311 KB (read on demand).

Costs: ~900 tokens per tool schema loaded; excerpt's +28% per call until
outline sizing is tuned on real reads.

Do not sell the architecture as a token win until trace proves one. It is a
determinism and turn-count win.

External evidence for the same shape (read 2026-09-05): arXiv 2608.26263,
"SKILL.state" (Badhe, Tiwari, Chung; Google/Purdue). The model receives only
(immutable spec, structured state, latest observation) each step; reasoning is
discarded after it yields a validated state patch plus an action; a
deterministic runtime owns the schema, validates and merges the patch, and
rolls back on an invalid one. That is this design with different names: P is
the plan body and contract, state is what the binary renders from trace + git,
O is the latest tool result.

Their numbers, which are the expectations section 7 could not give:
- Warehouse task, T=100 steps, Gemini-3-Flash: 65,408 tokens vs 1,062,387 for
  a LangGraph-style stateful-plus-transcript runtime (16.2x). Prompt stays
  ~1,800 chars at every horizon. Accuracy 0.94 vs 0.91.
- T=200: accuracy 0.94 vs 0.74 (ReAct) / 0.88 (stateful); 122K tokens vs
  2.6M / 5.0M.
- Noise: distractors never re-enter later prompts. 0.98 at 50 events/turn
  where ReAct falls to 0.53.
- External state drift: 0 recovery steps vs 5-8, because stale history no
  longer outvotes a fresh observation.
- Budget-matched controls at ~1,800 tokens: sliding window 0.18, capped
  summary 0.52, LLMLingua 0.22, structured state 0.94. Structure wins, not
  brevity.
- Real tasks: InterCode CTF pass@1 54.2% vs 43.2% ReAct with 60% fewer tokens;
  tau-bench retail 58.3%, lowest token cost.

Two of their findings are design constraints here, not just encouragement:
1. On Gemma-4-31B the dominant failure (68%) was the model DROPPING existing
   state keys when emitting a patch. Their fix is ours: the runtime owns the
   schema, the model only proposes a patch, an invalid or lossy patch is
   rolled back and retried. The binary must never let the model write state
   directly. (Section 3a's typed envelope is the same instinct.)
2. Limitations they name that cadence hits: the state must be a sufficient
   statistic, which fails when an earlier observation's relevance was not
   recognized at the time, and their runtime is single-agent; concurrent
   writes to shared state need conflict semantics in the merge they do not
   exercise. Sequential dispatch is fine. Parallel worktree execution writing
   to one shared state is the case the 4.0.0 server has to define.

## 8. Near-term integration work (before the rewrite, after the milestone)

CANCELLED as a measurement programme (John, 2026-09-05): excerpt is absorbed
into 4.0.0 regardless of adoption numbers, so the phase 4/5 A/B sequencing
below no longer decides anything. The findings stand as design input for
4.0.0. Whether any of the 3.x prose fixes are still worth landing before the
rewrite is a cadence decision at milestone close.


Held by a parallel working session until phase 3 and the milestone close. It
has notes including "one correction that would change what you build" - get
those first.

- `workflows/execute.md`, step `execute_sequential`, the "Shared files to
  read first" list in the stable-first head. One line naming excerpt_read
  with `start`+`count`. Cached across the phase.
- `lib/deferred-reads.mjs` register rows: eleven main-thread sentences that
  say Read a reference. `references/review-triggers.md` is one; the
  weathervane main thread read it with `cat`. Constraint: self-verify check
  13 tests `/\bRead\b/` case-sensitively, so "excerpt_read" alone fails it.
  "Read `path`, via excerpt_read when it is on your tool list" satisfies both.
- Fix `cad-executor-contract/SKILL.md:47` and the planner equivalent: name
  excerpt_read as the range tool.
- trace.jsonl: excerpt present/absent plus read-tool mix per dispatch. This
  turns the +11% A/B into a continuous number.
- Verified: cad-plan-checker dispatches cleanly with zero MCP servers on CLI
  2.1.261, so the absent path holds for at least that agent.

Sequencing agreed and recorded in that project's own `.planning/CAPTURE.md`
(later corrected): preload experiment
(ENABLE_TOOL_SEARCH=false + trimmed servers) alone after weathervane phase 3
execution; read phase 4 against it; excerpt nudge-text change after phase 4;
read phase 5 against that. Never two interventions in one phase.

## 9. Open and untested

Items marked (design) still matter for 4.0.0. Others were measurement-only
and are moot.


- (design) Does the model skip a conditional ToolSearch preamble when the
  schema is already loaded? One run.
- (design) Do loaded tools survive compaction? Observe one.
- Within-agent re-read rate (the part served memory CAN help). Not separated
  from cross-agent yet.
- (design) Whether a wildcard-tools subagent (Explore, general-purpose) gets
  MCP tools preloaded or deferred. Only explicit-list agents were measured.
- (design) Re-verify `YJe()` on any CLI upgrade; releases land several times a day.

## 10. Files

- The excerpt usage report, 2026-09-05 - all measurements, rounds 1-7. Private
  working notes, not in this repository.
- `excerpt-toolmix.py` - the transcript counter
  (usage: `python3 excerpt-toolmix.py label=path ...`). Same.
- excerpt `NOTES.md:74` - deferral was already observed 2026-09-03 and filed
  as a reason to keep the tool count at two, not as the adoption barrier.
