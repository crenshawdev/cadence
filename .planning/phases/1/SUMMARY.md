---
phase: 1
status: complete
completed: 2026-09-05
---

# Phase 1: The crate skeleton - Summary

A `cadence` Rust binary at `crates/cadence/`, serving one MCP tool
(`cadence_version`) over stdio with a four-tag typed envelope, tested by a
spawned-binary JSON-RPC harness, built on CI beside the Node matrix and
cross-compiled to four targets from the release workflow's guarded `build` job.

## What shipped

- Cargo workspace at the repo root, binary crate `cadence` - `Cargo.toml`, `rust-toolchain.toml`, `crates/cadence/`
- The typed answer vocabulary as one serde-tagged enum, tags `ok` / `refused` / `unknown` / `not-applicable` - `crates/cadence/src/envelope.rs`
- `cadence serve`: an rmcp stdio server declaring exactly one tool, `cadence_version`, answering with an `ok` envelope as structured content - `crates/cadence/src/server.rs`, `crates/cadence/src/main.rs`
- Over-the-wire test harness driving a spawned binary by JSON-RPC - `crates/cadence/tests/mcp.rs`
- A `cargo-test` CI job beside the untouched Node matrix - `.github/workflows/test.yml`
- A byte-reproducible packaging script and a four-target `build` matrix gated on `guard` - `.github/scripts/package.sh`, `.github/workflows/release.yml`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 1c82ce5d | The workspace builds a `cadence` binary that serves MCP on stdio |
| 1 | 2 | d186df60 | The typed answer vocabulary as one serde-tagged enum |
| 1 | 3 | 45f9ded8 | `cadence_version` answers with an `ok` envelope as structured content |
| 1 | 4 | 8726c7ee | Drive the surface over the wire from a spawned binary |
| 1 | 5 | 7a916038 | Build and test the crate beside the Node matrix |
| 1 | 6 | 2b941124 | A byte-reproducible release archive |
| 1 | 7 | 9e25ffff | Cross-compile the four targets behind the release guard |

## Deviations

- [deviation] Task 1's Action said `run_serve` follows excerpt's exactly; task 4's Action said closing stdin makes the server exit 0. Copied verbatim, both cannot hold: excerpt unwraps `serve()`, and a stdin close before `initialize` returns `ServerInitializeError::ConnectionClosed("initialize request")`, so the process panicked with exit 101. Fixed in `crates/cadence/src/main.rs` (inside the plan's `files:` lease): that variant and `Cancelled` return `ExitCode::SUCCESS`, every other startup failure still panics. Task 1's own Verify re-ran green. Commit 8726c7ee.

## Open items

- Human-verify, task 5: the next pull request run showing `cargo-test` green beside the Node matrix. Nothing is pushed, so it cannot be observed from here.
- Human-verify, task 7: a live `workflow_dispatch` showing `guard` green with the reachability step skipped, four `build` legs green, four artifacts and four sha256 lines in the run summary. The runner labels `ubuntu-24.04-arm`, `macos-15-intel` and `macos-latest` are excerpt's as of 2026-09; a deprecated one fails its leg at run time.
- No Rust lint is configured. `workflow.lint_command` is unset and `detect-commands` reports `typecheck: npx tsc -p tsconfig.ci.json`, a Node-only pair that sees none of the Rust. `cargo clippy --locked --all-targets -- -D warnings` ran clean before every commit, but nothing configures it, so nothing enforces it.
- The crate version is `3.7.12`, read from `.claude-plugin/plugin.json` as task 1 directs, so `cadence --version` prints `cadence 3.7.12` on a branch whose cycle ships as `4.0.0`. Phase 4 moves the tag, the plugin manifest and the crate together.
- `package.sh` promises identical bytes for identical inputs on ONE runner image, not across two. Each target builds on one label, so a dispatch build and a tag build of a given target agree - the property the pin needs - but a Linux archive built on macOS would not be expected to match.
- The dependency block is copied whole per D-10, so tree-sitter, the grep crates, `ignore` and `globset` are compiled by every cold build and no phase-1 code calls them. Trimming is a CONTEXT decision, not an executor's.
- `PLAN.md`'s Goal paragraph still names "Plan 2 (sequential, after this one)" for the release pinning and SessionStart bootstrap. That plan became phase 4 on 2026-09-05; the sentence is stale text in the plan, and no work is missing from this phase.

## Goal check

The phase goal - a `cadence` binary that builds, cross-compiles from one CI job,
and serves a minimal MCP tool surface - is delivered by these seven commits, and
I checked the load-bearing half myself rather than taking the digest's word.
`cargo build --locked` exits 0 and `target/debug/cadence` is on disk (63 MB,
built 18:57). Piping `initialize` + `notifications/initialized` + `tools/list`
into `./target/debug/cadence serve` returns exactly one tool, `cadence_version`,
whose `outputSchema` is a `oneOf` over all four envelope tags with the
`not-applicable` hyphen intact - so the typed vocabulary reaches the wire, not
just the unit tests. `.github/workflows/release.yml:76-88` carries the four
excerpt targets as a `matrix.include`, `jobs.build.needs` is `guard`, and the
whole file is 112 insertions with zero deletions, so the existing `publish` job
is untouched. What is NOT observable from here: both CI claims are structural
reads of YAML, not green runs. Nothing is pushed and no workflow has been
dispatched, so "cross-compiles from one CI job" is proven as far as a local
check can take it and no further - that is what the two human-verify open items
above are for, and they are phase 1's honest gap at close.
