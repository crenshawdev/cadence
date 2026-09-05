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

- [ ] **Phase 1: The crate skeleton** - a named binary that builds, cross-compiles to four targets from one CI job, and serves a minimal MCP tool surface
- [ ] **Phase 2: The golden harness** - fixtures at the frozen tag and a Rust test that diffs the binary against recorded JavaScript output
- [ ] **Phase 3: One vertical slice** - `/cad-execute` end to end, the shape every other command follows
- [ ] **Phase 4: The release path** - a tagged release that publishes four checksum-verified archives, and a SessionStart hook that fetches and installs the pinned binary

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
observed at phase close. It is now phase 4, where a release actually exists.
Phase 1 is the crate skeleton and nothing else.

### Phase 2: The golden harness

**Goal.** Parity against `v3.7.12` is a test that runs, not a claim.

Fixture `.planning` trees captured at the frozen tag, the JavaScript output
recorded for the operations phase 4 will implement, and a Rust test that diffs
the binary's answers against those recordings. Built before domain code so that
every later module lands against a measurable target.

### Phase 3: One vertical slice

**Goal.** `/cad-execute` runs end to end against the binary, and its shape is
the template every other command follows.

The five-step loop from section 3c: ask for the next dispatch, refuse with a
reason or hand back a prompt, invoke the executor, return a typed state patch,
repeat. The tool schema is the patch schema, and the BINARY validates
against it: a malformed argument comes back as a `refused` envelope naming
what was wrong, not an MCP-layer rejection (design doc 3e, revised
2026-09-05). Proves the boundary works
before the remaining modules are built against it.

### Phase 4: The release path

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
`.planning/phases/4/PLAN.md`.
