---
phase: 1
plan: 1
requirements:
  - BIN-01
  - BIN-02
  - REL-01
files:
  - Cargo.toml
  - Cargo.lock
  - rust-toolchain.toml
  - .gitignore
  - crates/cadence/Cargo.toml
  - crates/cadence/src/main.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/envelope.rs
  - crates/cadence/tests/mcp.rs
  - .github/workflows/test.yml
  - .github/workflows/release.yml
  - .github/scripts/package.sh
---

# Phase 1: The crate skeleton - Plan 1 (the crate and its CI)

## Goal

A `cadence` binary builds from a Cargo workspace at the repo root, serves an
MCP tool surface over stdio in which one tool answers with the typed envelope
vocabulary, and cross-compiles for four targets from the existing release
workflow. Plan 2 (sequential, after this one) adds the release pinning and the
SessionStart bootstrap on top of the build job this plan creates.

## Must be true when done

- `cargo build --locked` at the repo root produces `target/debug/cadence`, and
  `cargo test --locked` passes, with `Cargo.lock` committed and `target/`
  ignored.
- A JSON-RPC `initialize` sent to `cadence serve` on stdin is answered with a
  server named `cadence`; `tools/list` names exactly one tool,
  `cadence_version`, and `tools/call` on it returns a result whose
  `structuredContent.status` is `ok` and whose `isError` is not `true`.
- The four envelope tags serialize as the exact strings `ok`, `refused`,
  `unknown` and `not-applicable` under one `status` key, and a `refused`
  envelope passed through rmcp's structured-output path is a successful call
  (D-07), proven by a unit test.
- `.github/workflows/test.yml` carries a job that builds and tests the crate
  with `--locked` beside the untouched Node matrix.
- `.github/workflows/release.yml` carries a `build` matrix of exactly the four
  excerpt targets, gated on the existing `guard` job, runnable from a tag push
  or a manual dispatch, that packages each binary with a byte-reproducible
  script and reports the archive sha256 in the run summary.
- `git grep -l 'ToolSearch' -- skills/ cadence-core/workflows/` still returns
  nothing (AC5).

## Context

- Locked: D-01 workspace at the root with the binary under `crates/`; D-03 no
  crates.io publish, crate name `cadence`; D-07 the envelope is a serde-tagged
  enum sent as MCP structured content, `refused` is a successful call; D-08 at
  least one declared tool; D-09 binary, CLI, directory and server key are all
  `cadence`; D-10 copy only excerpt's process-level scaffolding (the
  `[dependencies]` block, the clap shell, the rmcp handler shape, the spawned
  JSON-RPC harness) and none of its domain modules; D-11 one workspace member;
  D-12 four targets, no Windows; D-13 offline means `Cargo.lock` plus
  `--locked`, not vendoring; D-14 the matrix joins the existing release
  workflow behind `guard`; D-15 a `cargo test` job is ADDED to `test.yml`,
  `.gitignore` gains `target/`.
- Seed files, read 2026-09-05: `/code/excerpt/Cargo.toml` (dependency block,
  rmcp 3.2.0 with `server`, `macros`, `transport-io`), `/code/excerpt/src/main.rs`
  (`Cli`/`Command` clap shell, `run_serve` runtime + `serve(rmcp::transport::stdio())`
  + `waiting()`), `/code/excerpt/src/server.rs` (`#[tool_router]` impl,
  `#[tool_handler(name = "excerpt")] impl ServerHandler`),
  `/code/excerpt/tests/mcp.rs` lines 1-135 (`Client` with `spawn_with_args`,
  `send`, `recv`, `handshake`, `tools_list`, `tools_call`, `finish`, plus
  `is_error` and `result_text`), `/code/excerpt/.github/workflows/release.yml`
  (matrix, musl-tools, `CC_<target>` env, static-link check, packaging).
- rmcp 3.2.0 facts verified in the vendored source: `CallToolResult::structured(value)`
  sets `structured_content` and `is_error: Some(false)`; the
  `rmcp::handler::server::wrapper::Json<T>` return wrapper routes a value
  through that constructor and the `#[tool]` macro derives the tool's
  `outputSchema` from a `Result<Json<T>, _>` return type; `#[tool_handler(name = "...")]`
  sets the `serverInfo` name with the crate version.
- Out of scope here: the pin file, publish-side verification, the bootstrap,
  `.mcp.json`, `hooks.json` and docs - all phase 4. Nothing under `cadence-core/`
  changes in this plan. No `.cargo/config.toml`, no `cargo vendor`, no
  ToolSearch preamble in any skill.

## Tasks

### Task 1: The workspace builds a `cadence` binary that serves MCP on stdio

- **Files:** Cargo.toml, Cargo.lock, rust-toolchain.toml, crates/cadence/Cargo.toml, crates/cadence/src/main.rs, crates/cadence/src/server.rs, .gitignore
- **Action:** Create a virtual workspace manifest at the repo root whose only
  member is `crates/cadence` (D-01, D-11), with an explicit `resolver` so the
  edition-2024 member and the virtual root agree. The member manifest names the
  package `cadence`, edition 2024, `rust-version` 1.90 (excerpt's floor), MIT,
  and a version equal to the `version` in `.claude-plugin/plugin.json` - read
  it, do not guess - because phase 4's release check requires the tag, the
  plugin manifest and the crate to agree. Copy excerpt's `[dependencies]` block
  verbatim from `/code/excerpt/Cargo.toml` (rmcp, tokio, serde, serde_json,
  schemars, clap, libc, the tree-sitter crates, the grep crates, ignore,
  globset) - the phase goal is "seeded from excerpt, which already carries the
  dependency set", and D-10 names the block as scaffolding to copy; rewrite
  the comments that explain excerpt-specific reasons (the `excerpt install`
  rewrite of settings files) so they do not describe code this crate does not
  have. Do not add a `[[bin]]` rename and do not add any dependency excerpt
  does not carry. `src/main.rs` is excerpt's clap shell reduced to what this
  crate has: a `Cli` with `#[command(name = "cadence", version)]` and one
  `serve` subcommand with no arguments, and a `run_serve` that builds the
  tokio runtime, calls `serve(rmcp::transport::stdio())` on the handler and
  awaits `waiting()` exactly as `/code/excerpt/src/main.rs` `run_serve` does,
  minus `hook::announce_serving` and minus every policy argument. `src/server.rs`
  is the handler shape from `/code/excerpt/src/server.rs`: a `Clone` handler
  struct with a `#[tool_router]` impl block that declares no tools yet, and a
  `#[tool_handler(name = "cadence")] impl ServerHandler` so the initialize
  response names the server `cadence` (D-09). Run `cargo build --locked` after
  a first `cargo build` generates the lockfile, and commit `Cargo.lock`
  (D-13). Add `target/` to `.gitignore` under a short comment naming the
  reason (D-15: excerpt's build dir measured 8.0G). Pin the toolchain in a
  root `rust-toolchain.toml` to one exact stable version (the local toolchain
  is 1.98.1, measured 2026-09-05; pin that or the current stable, never a
  floating `stable`), with the minimal profile: phase 4's pin file is committed
  BEFORE the tag from a dispatch build and the tag's own build must reproduce
  the same bytes, which a floating channel cannot promise. The file is inert
  on this machine (Arch rustc, no rustup) and binding on CI, and it lands in
  this task so task 5's workflow never references a file missing at its own
  commit. Do not copy `read`, `search`, `outline`, `memory`, `diff`, `hook`
  or `install` from excerpt.
- **Verify:** `cargo build --locked` at the repo root exits 0 and
  `./target/debug/cadence --version` prints `cadence ` followed by the exact
  `version` string in `.claude-plugin/plugin.json`; piping a single
  `initialize` JSON-RPC request line (protocolVersion `2025-06-18`) into
  `./target/debug/cadence serve` prints one response line containing
  `"serverInfo"` with `"name":"cadence"`, and the process exits when stdin
  closes; `git status --porcelain` after a build shows no `target/` entry and
  `git ls-files Cargo.lock` lists the lockfile; `grep -c 'channel = "1\.' rust-toolchain.toml`
  prints 1.

### Task 2: The typed envelope vocabulary as one serde-tagged enum

- **Files:** crates/cadence/src/envelope.rs, crates/cadence/src/main.rs
- **Action:** Add an `envelope` module, declared from `main.rs`, holding one
  generic enum that is the section-3a vocabulary and nothing more: an `ok` arm
  carrying an operation's payload, and `refused`, `unknown` and
  `not-applicable` arms each carrying a human-readable `reason` string. It
  derives `Serialize`, `Deserialize` and schemars `JsonSchema`, and serializes
  internally tagged under the key `status` with the tag values spelled exactly
  `ok`, `refused`, `unknown`, `not-applicable` (kebab-case, the hyphen is
  load-bearing - the design doc spells it with a hyphen and every later skill
  will match on that string). The `ok` arm's payload fields sit beside the tag
  at the top level, mirroring the JavaScript `{ok, ...fields}` envelopes the
  model already reads, which means a payload is always a struct; state that in
  the type's doc comment. Include unit tests in the module: one per arm
  asserting the exact JSON (`{"status":"refused","reason":"..."}` and so on),
  a round trip through `serde_json`, and one test for D-07 that takes a
  `refused` envelope through rmcp's structured-output path - either
  `rmcp::handler::server::wrapper::Json` plus
  `rmcp::handler::server::tool::IntoCallToolResult`, or the
  `CallToolResult::structured` constructor that wrapper calls - and asserts
  the resulting `structured_content` carries `"status":"refused"` while
  `is_error` is not `Some(true)`. Avoid `CallToolResult::error` or
  `structured_error` anywhere in this module: a refusal that arrives as
  `isError` is indistinguishable from a crash and the informed-retry loop
  would have nothing to branch on (D-07). Do not add `hint`, `detail` or any
  second field to the non-ok arms; the vocabulary is the phase's scope and the
  fields underneath belong to the operations that come later.
- **Verify:** `cargo test --locked envelope` passes and its output lists at
  least five tests from the `envelope` module, including one whose name
  contains `refused` and one whose name contains `not_applicable`; `grep -n
  'not-applicable' crates/cadence/src/envelope.rs` finds the hyphenated tag
  either in a serde attribute or in an assertion; `grep -c 'structured_error\|CallToolResult::error' crates/cadence/src/envelope.rs` prints 0.

### Task 3: One declared tool, `cadence_version`, answers with an `ok` envelope as structured content

- **Files:** crates/cadence/src/server.rs
- **Action:** Declare exactly one tool on the router from task 1, named
  `cadence_version` (wire name `mcp__cadence__cadence_version`, D-09), taking
  no parameters, whose description says it reports which cadence binary is
  serving this session. It returns the envelope from task 2 wrapped in
  `rmcp::handler::server::wrapper::Json` so that rmcp places the value in
  `structured_content` on a successful result and derives an `outputSchema`
  from the envelope's `JsonSchema` (both verified in the vendored rmcp 3.2.0
  source). The `ok` payload is a struct with three fields: `version` from
  `CARGO_PKG_VERSION`, `os` from `std::env::consts::OS` and `arch` from
  `std::env::consts::ARCH`, so a user can see which release archive is running
  without leaving the session. Keep the handler's `Clone` derive and the
  `#[tool_handler(name = "cadence")]` from task 1. Do not declare a second tool
  (the paired-control reason for one is gone with `TSL-02`, D-08) and do not
  return `CallToolResult::success` with a text block - a text convention is
  what D-07 rejects.
- **Verify:** `cargo build --locked` exits 0; piping three lines -
  `initialize`, the `notifications/initialized` notification, and a
  `tools/call` for `cadence_version` with empty `arguments` - into
  `./target/debug/cadence serve` prints a `tools/call` response whose
  `result.structuredContent` object has `"status":"ok"` and a `"version"`
  equal to the crate version, and whose `result.isError` is absent or `false`;
  a `tools/list` request answered the same way lists one tool named
  `cadence_version` carrying an `outputSchema` object.

### Task 4: The spawned-binary JSON-RPC harness proves the surface over the wire

- **Files:** crates/cadence/tests/mcp.rs
- **Action:** Copy the harness half of `/code/excerpt/tests/mcp.rs` (lines
  1-135: the `Client` struct with `spawn_with_args`, `send`, `recv`,
  `handshake`, `tools_list`, `tools_call`, `finish`, and the `is_error` and
  `result_text` helpers) pointed at `env!("CARGO_BIN_EXE_cadence")` and
  spawning `serve`, and none of excerpt's fixture helpers (`plant_tree`,
  `write_temp_file`, the outline parsers). Write four tests against it: the
  initialize response's `serverInfo.name` is `cadence` and its version is the
  crate version; `tools/list` returns exactly one tool, named `cadence_version`,
  with a non-null `outputSchema`; `tools/call` on `cadence_version` returns
  `structuredContent.status == "ok"` with `version`, `os` and `arch` present
  and `isError` not `true`; and closing stdin makes the server exit 0. Keep
  stderr inherited as excerpt does so a panic is visible in the test output.
  This file is the seed of phase 2's golden harness, so keep the client free
  of any assumption about which tools exist beyond the assertions themselves.
- **Verify:** `cargo test --locked --test mcp` passes with four tests listed,
  and `grep -c 'CARGO_BIN_EXE_cadence' crates/cadence/tests/mcp.rs` prints a
  number greater than 0.

### Task 5: The test workflow builds and tests the crate beside the Node matrix

- **Files:** .github/workflows/test.yml
- **Action:** Add a job to `.github/workflows/test.yml` that checks out the
  repo (same pinned `actions/checkout` SHA the other jobs use), installs the
  toolchain named by the repo's `rust-toolchain.toml` explicitly rather than
  relying on rustup's auto-install (its default changed in rustup 1.28), then
  runs `cargo build --locked` and `cargo test --locked` on `ubuntu-latest`.
  The `rust-toolchain.toml` file is already in the tree from task 1; this job
  reads whatever channel it pins. Leave `node-test`, `self-verify` and `typecheck`
  byte-for-byte as they are (D-15: added, nothing replaced) and keep the
  workflow's `concurrency` block. Add a two-line comment in the style of the
  existing jobs saying why `--locked` (D-13: the lockfile is the offline
  guarantee, and an unlocked resolve on CI would silently test a different
  graph). No cache action: the repo pins every action by commit SHA and no
  SHA for a cache action was verified during planning, so caching is left for
  a later change rather than pinned by guess.
- **Verify:** `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/test.yml')); j=d['jobs']; print(sorted(j))"` prints the three existing
  job names plus one new job, and `grep -c -- '--locked' .github/workflows/test.yml`
  prints 2 or more; `git diff --stat .github/workflows/test.yml` shows only
  additions (no deleted lines). Human-verify: the next pull request run shows
  the new job green alongside the Node matrix.

### Task 6: A byte-reproducible release archive

- **Files:** .github/scripts/package.sh
- **Action:** Write a POSIX shell `.github/scripts/package.sh` that takes the
  built binary path, the archive name (`cadence-<tag>-<triple>`), the output
  directory, and produces `<name>.tar.gz` containing exactly `<name>/cadence`
  and `<name>/LICENSE` (the repo root `LICENSE`), then prints one line in
  `sha256sum` output form (`<sha256>  <name>.tar.gz`) - that line is what
  phase 4 pastes into the pin file, so its format is fixed here. The reason
  for what follows is phase 4's pinning flow: the pin is committed BEFORE the
  tag from a dispatch build and the tag's own build must reproduce the same
  bytes; task 1's `rust-toolchain.toml` is the compiler half of that promise
  and this script is the packaging half. The archive must be byte-identical
  for identical inputs regardless of wall clock, uid, umask or the host's tar
  flavour: fixed entry mtime, uid and gid 0, fixed modes (0755 for the
  binary, 0644 for the license), entries in a fixed order, and gzip with no
  embedded name or timestamp. GitHub's Linux runners carry GNU tar and the
  macOS runners bsdtar, which lacks `--sort`, so either drive a mechanism
  present on both (python3's `tarfile` with explicit metadata and
  `gzip.GzipFile(mtime=0)` is on every runner image) or detect and normalise
  per flavour - the choice is the executor's, the property is not. Compute the
  digest with `sha256sum` where it exists and `shasum -a 256` otherwise, since
  macOS has only the latter.
- **Verify:** After `cargo build --release --locked`, running the script twice
  on `target/release/cadence` with `touch` altering the binary's mtime and
  `umask 077` set between runs prints the same `<sha256>  <name>.tar.gz` line
  both times; `tar tzf` on the archive lists exactly two entries,
  `<name>/cadence` and `<name>/LICENSE`; `sha256sum -c` on the printed line,
  run in the output directory, reports OK.

### Task 7: The release workflow cross-compiles the four targets behind its guard

- **Files:** .github/workflows/release.yml
- **Action:** Add a `workflow_dispatch` trigger beside the existing `v*` tag
  trigger, so the matrix can be run by hand to produce the checksums phase 4
  pins before a tag exists; in the `guard` job, run the "tagged commit is
  reachable from main" step only on a tag push (`github.event_name == 'push'`)
  and keep the test suite and self-verify steps running on both events, so a
  dispatch build is still a tested build. Add a `build` job with
  `needs: guard` (D-14: behind the guard, in the same workflow) whose matrix
  is exactly excerpt's four rows from `/code/excerpt/.github/workflows/release.yml`
  lines 34-47 - `x86_64-unknown-linux-musl` on `ubuntu-latest`,
  `aarch64-unknown-linux-musl` on `ubuntu-24.04-arm`, `x86_64-apple-darwin` on
  `macos-15-intel`, `aarch64-apple-darwin` on `macos-latest` - with
  `fail-fast: false`, the `musl-tools` install and the `CC_<target>=musl-gcc`
  export on the Linux rows, `rustup target add` for the row's target on the
  toolchain `rust-toolchain.toml` pins, `cargo build --release --locked --target`,
  excerpt's static-link check on the Linux rows (accepting both
  `statically linked` and `static-pie linked`), then `.github/scripts/package.sh`
  from task 6 naming the archive `cadence-<tag>-<triple>` where `<tag>` is
  `GITHUB_REF_NAME` on a tag push and `v` plus the crate version on a
  dispatch. Append the script's printed sha256 line to `$GITHUB_STEP_SUMMARY`
  inside a fenced block, and upload the archive as an artifact named by the
  target with the pinned `actions/upload-artifact` the repo would otherwise
  lack - use the same SHA-pinning convention the file already applies to
  `actions/checkout` and `actions/setup-node`, resolving the SHA with `gh api`
  against the action's current release tag rather than typing one from
  memory. Keep the workflow-level `permissions: contents: read`; the build
  needs no write. Leave the `publish` job exactly as it is - phase 4 rewires it.
- **Verify:** `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/release.yml')); on=d.get(True, d.get('on')); print(sorted(d['jobs']), 'workflow_dispatch' in on)"` prints `['build', 'guard', 'publish'] True` (PyYAML reads the bare `on:` key as boolean `True`, hence the lookup);
  `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/release.yml')); print(sorted(r['target'] for r in d['jobs']['build']['strategy']['matrix']['include']))"`
  prints the four excerpt targets and nothing else, and
  `d['jobs']['build']['needs']` is `guard`; every `uses:` line in the file
  carries a 40-hex SHA. Human-verify: dispatching the workflow from GitHub
  Actions on this branch shows `guard` green with the reachability step
  skipped, four `build` legs green, four artifacts, and four sha256 lines in
  the run summary.

## Notes

- **The release path moved to phase 4.** This phase was originally two plans;
  the second carried the release, the checksum pin and the SessionStart
  bootstrap. It was moved out on 2026-09-05 because there is nothing to
  download until `4.0.0` is tagged, so every one of its verifications would
  have been a no-op at phase close. It is now `.planning/phases/4/PLAN.md` and
  it runs after this phase, still sharing `.github/workflows/release.yml`
  (this plan adds the `build` matrix, phase 4 rewires `publish`). Leave
  `publish` untouched here.
- **CONTEXT's third slice is not planned.** The "two live observations" were
  closed on 2026-09-05 (`TSL-01` answered, `TSL-02` deferred; CONTEXT `Out`
  line and D-19), so there is nothing left to observe against the surface.
- **The dependency block is copied whole, including crates no phase-1 code
  calls.** That is what the phase goal ("seeded from excerpt, which already
  carries the dependency set") and D-10 say; it costs a tree-sitter C compile
  on every cold build. If the human would rather trim to what phase 1 uses and
  re-add per module, that is a decision for CONTEXT, not a deviation to take
  here.
- **Local toolchain is Arch's rustc 1.98.1 without rustup**, so
  `rust-toolchain.toml` is inert locally and binding on CI. Cross targets are a
  CI concern only (CONTEXT flagged assumptions).
- **Runner labels** `ubuntu-24.04-arm`, `macos-15-intel`, `macos-latest` are
  taken from excerpt as of 2026-09; a deprecated label fails the leg at run
  time and is fixed by editing one matrix row.
- **`cadence_version` is the one declared tool** (D-08). It reports real
  information the JavaScript side cannot (which binary serves), and it can be
  folded away once the section-3b operations exist; it is not a probe fixture.
- **No caching on the cargo CI job yet.** Every action in this repo is pinned
  by commit SHA and no cache action SHA was verified during planning; a cold
  build is the cost until someone pins one.
