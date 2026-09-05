# Phase 1: The crate skeleton - Context

Gathered: 2026-09-05
Feeds: /cad-plan 1

## Scope boundary

In: A Cargo workspace at the repo root with one member, `crates/cadence`, that
builds, cross-compiles to four targets from the existing release workflow,
serves a minimal MCP tool surface over rmcp stdio, and is fetched onto a
machine by a POSIX shell SessionStart hook that verifies a pinned checksum.
The typed envelope vocabulary from section 3a of
`docs/rationale/architecture-v4.md`. Two observations against that surface,
recorded as `TSL-01` and `TSL-02`.
Out: Any domain module - project state, planning, dispatch, git, routing,
trace, forge, retrieval. Vendoring excerpt's read/search layer. Removing or
altering any of `cadence-core/`. Writing a ToolSearch preamble into any skill
file. Publishing to crates.io. Any Windows target.
Deferred: None.
Plan shape: multiple plans, same phase - the crate and its CI, the release
plus bootstrap plus checksum pinning, and the two live observations, which
cannot start until the tool surface serves.

## Durable decisions

- D-01 (Layout): The Rust code is a Cargo WORKSPACE at `/code/cadence` - a
  workspace `Cargo.toml` at the repo root with the binary under `crates/`.
  Chosen over a single root crate so a second member can be added without a
  move. Evidence: user decision 2026-09-05.
- D-02 (Coexistence): The JavaScript `cadence-core/` stays in place on
  `cadence/binary-owns-process` until parity. The plugin keeps working and
  phase 2's golden harness can run the JavaScript to record its output.
  Evidence: user decision 2026-09-05; `.planning/ROADMAP.md` phase 2 detail.
- D-03 (Distribution): No crates.io publish in 4.0.0. The name `cadence` is
  TAKEN - `https://crates.io/api/v1/crates/cadence` returns HTTP 200 for an
  existing crate, `updated_at` 2026-04-11, 28+ published versions. The crate is
  named `cadence` locally and distributed only as a GitHub release artifact.
  Reversible later by choosing a published name with `[[bin]] name = "cadence"`.
  Evidence: crates.io API, checked 2026-09-05; `.planning/ROADMAP.md` phase 1
  goal ("installs itself from a release" names no registry).
- D-04 (Integrity): The expected sha256 per target triple is PINNED in a file
  committed to the plugin repo, so the plugin tag pins the binary. The
  bootstrap does not trust a `.sha256` sidecar fetched from the same server as
  the artifact - that proves the download was not corrupted in transit, not
  that it is the artifact Cadence built. Rejected: excerpt's sidecar model and
  minisign/cosign signing. Evidence:
  `/code/excerpt/.github/workflows/release.yml:83-99` (the sidecar model being
  rejected); user decision 2026-09-05.
- D-05 (Install): The binary does NOT port `excerpt install`. excerpt rewrites
  `~/.claude.json` and `settings.json` because it has no plugin manifest to
  declare its server and hook in; Cadence has one. The bootstrap's only job is
  to place a verified binary where the plugin's committed manifests already
  point. Evidence: `/code/excerpt/src/install.rs:1-24`, `:96-135`, `:179-213`,
  `:243-250`, `:359-386`; `/code/cadence/hooks/hooks.json`.
- D-06 (Install path): The fetched binary is installed OUTSIDE
  `${CLAUDE_PLUGIN_ROOT}`, at a versioned path under the user's data directory.
  The plugin cache is keyed per plugin version - `/claude/.claude/plugins/cache/cadence/cadence/`
  currently holds sibling `3.5.3` and `3.7.12` directories - so anything written
  into a plugin root is orphaned on the next update. Evidence: that cache path,
  observed 2026-09-05.
- D-07 (Envelope): The `ok | refused | unknown | not-applicable` vocabulary is a
  serde-tagged Rust enum serialized as MCP STRUCTURED CONTENT, not a text
  convention, and `refused` is a SUCCESSFUL tool call carrying a refusal rather
  than `CallToolResult::error`. A `refused` arriving as `is_error: true` is
  indistinguishable from a crashed tool, and the informed-retry loop in section
  3e:2 would have nothing to branch on. excerpt has no precedent - every tool
  answers with one text block. Evidence:
  `/code/excerpt/src/server.rs:157-173`, `:164-171`, `:230-245`;
  `rmcp-3.2.0/src/model/content.rs:210`;
  `docs/rationale/architecture-v4.md:111-122`, `:217-221`.
- D-08 (Tool surface): "Empty tool surface" means TWO declared tools, not zero.
  `TSL-02` needs a paired never-loaded control, so the surface must carry one
  tool the probe loads and calls and one it never loads. A one-tool surface
  reproduces the 2026-09-05 failure exactly. Evidence:
  `.planning/REQUIREMENTS.md:23`; `docs/rationale/architecture-v4.md:290-291`.
- D-09 (Naming): The binary, the CLI, the `crates/` directory and the MCP
  server key are all `cadence`, giving wire names `mcp__cadence__<tool>`. Those
  names are hard-coded by every later subagent definition, `allowed-tools`
  block and hook matcher, so renaming after the probes invalidates their
  observations. Evidence: `.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`; `/code/cadence/hooks/hooks.json` already
  carries `mcp__excerpt__excerpt_read` as a matcher.

## Decisions

- D-10 (Seeding): Phase 1 copies excerpt's PROCESS-level scaffolding only - the
  `[dependencies]` block, the `clap` subcommand shell in `src/main.rs`, the rmcp
  handler shape in `src/server.rs`, and the spawned-binary JSON-RPC harness in
  `tests/mcp.rs`. It copies none of excerpt's domain modules (`read`, `search`,
  `outline/*`, `memory`, `diff`, `hook`). Evidence:
  `/code/excerpt/src/main.rs:1-8`, `/code/excerpt/src/server.rs:107-124`,
  `/code/excerpt/tests/mcp.rs:1-45`, `/code/excerpt/Cargo.toml:26-46`.
- D-11 (Seeding): The workspace has ONE member in phase 1. excerpt is not
  vendored as a second member here; the fold-in is later work. Evidence:
  `/code/excerpt/Cargo.toml:2-10`, `/code/excerpt/README.md:21-25`.
- D-12 (CI): The release matrix is excerpt's four targets and no more -
  `x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`,
  `x86_64-apple-darwin`, `aarch64-apple-darwin`. No Windows. Evidence:
  `/code/excerpt/.github/workflows/release.yml:34-47`,
  `/code/excerpt/README.md:33-41`.
- D-13 (CI): "Builds offline" is satisfied by a committed `Cargo.lock` plus
  `--locked`, which is what excerpt already does. It does not mean `cargo
  vendor` or a `.cargo/config.toml` source replacement in this phase. Evidence:
  `/code/excerpt/.github/workflows/release.yml:66`; no `.cargo/` directory
  exists in `/code/excerpt`.
- D-14 (CI): The binary build matrix is added to the EXISTING
  `.github/workflows/release.yml` behind its `guard` job, not shipped as a
  second workflow on the same tag. The guard exists because tags once published
  from commits no CI had seen. Evidence:
  `.github/workflows/release.yml:14-53`, `:64-74`, `:94-105`.
- D-15 (CI): A `cargo test` job is ADDED to `.github/workflows/test.yml`
  alongside the existing Node matrix; nothing is replaced. `.gitignore` gains
  `target/` and `Cargo.lock` is committed. Evidence:
  `.github/workflows/test.yml:16-63`; `/code/cadence/.gitignore` has no
  `target/` entry; `/code/excerpt/target` measured at 8.0G on 2026-09-05.
- D-16 (Self-verify): Adding `SessionStart` to `hooks/hooks.json` requires a
  matching row in `cadence-core/bin/lib/hook-events.mjs`, or `self-verify`
  reports `unregistered-hook-event` and both the test workflow and the release
  guard go red. The bootstrap script is a COMMITTED file referenced as a
  `${CLAUDE_PLUGIN_ROOT}/...` path, because check 3 requires every such path
  named in prose to exist in-repo. Evidence:
  `cadence-core/bin/lib/hook-events.mjs:60-76`, `:120-135`;
  `cadence-core/bin/self-verify.mjs:21`, `:683`, `:1351-1355`, `:1383`.
- D-17 (First run): Install-then-restart is DOCUMENTED, not engineered around.
  SessionStart fetches the binary; the MCP server is live from the next
  session. This is the instruction `excerpt install` already prints, and it
  removes any dependency on the CLI's ordering of `.mcp.json` startup against
  SessionStart. Evidence: `/code/excerpt/README.md:74-77`; user decision
  2026-09-05.
- D-18 (Failure posture): A bootstrap that fails leaves the session working,
  matching excerpt's "no server, no deny" posture. During phase 1 the
  JavaScript is still doing all the work, so a missing binary costs the user
  nothing. Evidence: `/code/excerpt/README.md:284-301`,
  `/code/excerpt/src/main.rs:177-181`; D-02.
- D-19 (TSL-01 shape): The preamble question is settled by decision, not by
  this phase's measurement: deferral was observed on CLI 2.1.261 on
  2026-09-05, so a preamble IS needed, and the shape is ONE unconditional
  `ToolSearch` at skill entry with its ~900-token cost accepted. Phase 1
  CONFIRMS that against the binary's own surface rather than re-deciding it,
  and writes the preamble into no skill file. Evidence:
  `docs/rationale/architecture-v4.md:253-261`, `:264-266`; user decision
  2026-09-05.
- D-20 (Record): `.planning/REQUIREMENTS.md:22` and `.planning/ROADMAP.md:66-68`
  both assert that deferred tools were callable with no `ToolSearch` at all. No
  transcript of that check exists in the session archive across four searches,
  and the claim contradicts the deferral observation recorded the same day.
  Both are corrected to state what is actually recorded. Evidence: verbatim
  searches 2026-09-05; `docs/rationale/architecture-v4.md:253-256`.
- D-21 (Probe method): The two observations are taken from OUTSIDE the agent
  under test, by reading its transcript, and any probe run isolates settings
  (`--setting-sources ""`) with a canary proving the isolation took effect. A
  model cannot observe its own skipping. `tools/list` over stdio proves only
  that the server DECLARES a tool, which is not what either question asks.
  Evidence: `/code/excerpt/tests/mcp.rs:792`;
  `/code/excerpt/scripts/grep-deny-check.sh`.

## Acceptance criteria

- [ ] AC1: `cargo build --locked` at the repo root succeeds and produces an
      executable named `cadence`; `cargo test --locked` passes.
- [ ] AC2: A tagged release publishes one `.tar.gz` for each of the four
      targets, and each archive's sha256 equals the value pinned in the
      committed checksum file. (human-verify: needs GitHub Actions)
- [ ] AC3: On a machine with no binary present, one session runs the
      SessionStart hook, the binary lands at the documented path outside
      `${CLAUDE_PLUGIN_ROOT}`, and the session finishes with no error shown to
      the user. (human-verify: needs a live Claude Code session)
- [ ] AC4: In a session with the plugin installed, at least two tools named
      `mcp__cadence__*` are servable, and calling one returns a response whose
      structured content carries an envelope tag of `ok`, `refused`, `unknown`
      or `not-applicable`. (human-verify: needs a live Claude Code session)
- [ ] AC5: A transcript read from outside the agent under test shows, for the
      `mcp__cadence__*` control tool never loaded via `ToolSearch`, either a
      `ToolSearch` the agent had to issue or an `InputValidationError` naming
      `ToolSearch`; and shows the loaded tool called successfully in the same
      run. (human-verify: needs a live Claude Code session)
- [ ] AC6: A transcript covering one compaction shows whether the
      `mcp__cadence__*` tool loaded before the boundary was callable after it
      with no reload, and states the control tool's outcome in the same
      post-boundary window. (human-verify: needs a live Claude Code session
      that compacts)
- [ ] AC7: `node cadence-core/bin/self-verify.mjs` reports no issues with the
      `SessionStart` row added to `hooks/hooks.json`, and
      `git grep -l 'ToolSearch' -- skills/ cadence-core/workflows/` returns
      nothing.

## Flagged assumptions

- A plugin-root `.mcp.json` is read for a marketplace-installed plugin -
  Unclear; no enabled plugin on this machine ships one (checked across
  burnrate, obsidian, claude-hud, codex, rust-analyzer-lsp, typescript-lsp),
  and every local example is an external plugin that does not fetch its own
  binary. If wrong, the binary's tool surface is unreachable to plugin users
  and AC4-AC6 have to run against a hand-written `--mcp-config`, which is not
  the shipping path.
- The CLI surfaces MCP `structured_content` to the model rather than only text
  blocks - Unclear; rmcp 3.2.0 emits the field
  (`rmcp-3.2.0/src/model/content.rs:210`) and nothing in either repo observes
  what the host does with it. If wrong, a refusal reason encoded structurally
  is invisible where it matters and D-07 falls back to JSON inside one text
  block.
- The runner labels excerpt pins - `ubuntu-24.04-arm`, `macos-15-intel`,
  `macos-latest` - are still current - Likely; recorded 2026-09 at
  `/code/excerpt/.github/workflows/release.yml:36-47`. Deprecations are
  announced outside both repos. If wrong, the release job fails at tag time.
- The design doc's 914/905 first-vs-repeat ToolSearch figures are a
  CONTAMINATED PRIOR, not a measurement - Confident; a controlled pair in the
  same session returned 1,759 and 560, and the gap was prose riding the first
  call rather than schema cost. D-19 does not rest on either pair, only on the
  qualitative fact that a repeat returns the full schema again.
- Local toolchain is `rustc`/`cargo` 1.98.1 with only
  `x86_64-unknown-linux-gnu` installed - Confident, measured 2026-09-05.
  Cross-target builds are a CI concern, not a local one; excerpt's
  `rust-version` floor is 1.90.
