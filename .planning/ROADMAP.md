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

**The order, and why it is this order.** Phase 1 is a spike and it runs first
because two of its three questions cannot be answered later. The 3.x baseline
for prompt size per dispatch and main-thread context growth per phase is the
go/no-go the rewrite is judged on, and it can only be measured while 3.x is
still the thing that runs. The two deferral probes decide the shape of a
preamble that would otherwise be written into 28 skill files twice. Phase 2
seeds the crate from excerpt, which already carries rmcp, tree-sitter, the
ripgrep crates, the PreToolUse hook and the cross-compile CI, so the skeleton
is a move rather than a greenfield. Phase 3 builds the golden harness before
any domain code, so parity is measurable from the first module rather than
asserted at the end. Phase 4 takes one vertical slice end to end, and every
later module follows its shape.

**Out of scope, deliberately.** The near-term 3.x prose fixes in section 8 of
the architecture doc are a separate decision and are not scheduled here.
`GH-140`, whether Cadence grows a Codex host adapter, becomes sharper once the
boundary is a binary rather than prose, but the adapter decision is not made in
this cycle. The open GitHub issues filed against the JavaScript tree are being
triaged by hand and are not carried into these phases.

## Open Questions

- **OQ-1 - does a conditional ToolSearch preamble get skipped when the schema
  is already loaded.** The deferral constraint means every command skill needs
  a load preamble, not just one, because users enter at `/cad-context`,
  `/cad-task`, `/cad-debug` and `/cad-adopt`. Unconditional costs about 900
  tokens per skill invocation, so a context to plan to execute to verify run
  would pay roughly 3,600 tokens for one useful load. Phrasing it
  conditionally only helps if the model actually skips. Untested, and it goes
  into 28 files either way, so it is answered in phase 1 before it is written
  anywhere. Measured facts behind it are CLI 2.1.261: a repeat ToolSearch is
  not a no-op, costing 905 tokens against a first load of 914.
- **OQ-2 - do loaded tools survive compaction.** The CLI carries
  `preCompactDiscoveredTools` and a "carried from compact boundary" string,
  which is suggestive and not an observation. If they do not survive, a long
  phase pays the load again mid-run and the preamble has to be reachable rather
  than one-shot. Observe one compaction in phase 1.
- **OQ-3 - what the 3.x baseline actually is.** Prompt size per invocation and
  main-thread context growth per phase, measured on the shipped 3.7.12 tree
  across one real phase. Without it, 4.0.0 has nothing to be judged against and
  the go/no-go in the design doc is unfalsifiable. This is the one question
  that expires: once 3.x stops being what runs, it cannot be answered.

## Phases

- [ ] **Phase 1: The baseline and the two probes** - measure 3.x while it still runs, and answer OQ-1, OQ-2, OQ-3
- [ ] **Phase 2: The crate skeleton** - a named binary that builds, cross-compiles, serves an empty tool surface and installs itself
- [ ] **Phase 3: The golden harness** - fixtures at the frozen tag and a Rust test that diffs the binary against recorded JavaScript output
- [ ] **Phase 4: One vertical slice** - `/cad-execute` end to end, the shape every other command follows

## Phase Details

### Phase 1: The baseline and the two probes

**Goal.** OQ-1, OQ-2 and OQ-3 are answered with observations rather than
guesses, and the answers are written where phase 2 onward can read them.

A spike, not a code change. It measures the shipped 3.7.12 tree on a real
phase, records prompt size per dispatch and main-thread growth per phase, and
runs the two deferral probes against the current CLI. It writes no Rust and
changes no behavior. Its output is a spike record with three verdicts, each
`validated`, `invalidated` or `inconclusive`.

### Phase 2: The crate skeleton

**Goal.** A `cadence` binary builds, cross-compiles from one CI job, serves an
empty MCP tool surface, and installs itself from a release.

Seeded from excerpt, which already carries the dependency set and the CI. Adds
the binary's name, the typed envelope vocabulary from section 3a of the design
doc, and the POSIX shell SessionStart bootstrap that fetches the platform
release and verifies its checksum. No domain modules yet.

### Phase 3: The golden harness

**Goal.** Parity against `v3.7.12` is a test that runs, not a claim.

Fixture `.planning` trees captured at the frozen tag, the JavaScript output
recorded for the operations phase 4 will implement, and a Rust test that diffs
the binary's answers against those recordings. Built before domain code so that
every later module lands against a measurable target.

### Phase 4: One vertical slice

**Goal.** `/cad-execute` runs end to end against the binary, and its shape is
the template every other command follows.

The five-step loop from section 3c: ask for the next dispatch, refuse with a
reason or hand back a prompt, invoke the executor, return a typed state patch,
repeat. The tool schema is the patch schema, so a malformed argument is
rejected by the MCP layer before the binary sees it. Proves the boundary works
before the remaining modules are built against it.
