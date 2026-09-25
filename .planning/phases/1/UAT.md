---
status: testing
phase: 1
fields_version: 1
started: 2026-09-05
updated: 2026-09-05
---

## Items

### 1. Cold start from a clean tree
expected: After `cargo clean`, `cargo build --locked` succeeds from scratch and a freshly spawned `cadence serve` completes an initialize + tools/list handshake and exits 0 on stdin close.
origin: smoke
status: pass
first_pass: pass
source: verifier
evidence: Build into an empty CARGO_TARGET_DIR with `cargo build --locked --offline` exited 0 after compiling 101 crates from scratch (tree-sitter, rmcp, grep-searcher among them); the freshly built binary answered initialize with serverInfo name `cadence` version 3.7.12, tools/list with ["cadence_version"], and exited 0 on stdin close. The repo's own target/ was not deleted (a verifier does not mutate the tree), and RUSTC_WRAPPER is set on this machine, so the wall time is not a cold-compiler figure.

### 2. The workspace builds and tests
expected: `cargo build --locked` at the repo root exits 0 and produces an executable named `cadence`; `cargo test --locked` passes.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: `./target/debug/cadence --version` -> `cadence 3.7.12`; `cargo test --locked` -> 10 tests, 10 passed, 0 failed (6 envelope unit tests, 4 spawned-binary mcp tests). Cargo.lock is committed, target/ is ignored at .gitignore:60, and the working tree is clean.

### 3. A tagged release publishes four checksum-pinned archives
expected: A tagged release publishes one .tar.gz per target for the four targets, and each archive's sha256 equals the value pinned in the committed checksum file. (human-verify: needs GitHub Actions)
criterion: AC2
status: skipped
first_pass: fail
source: verifier
evidence: No pin file in the tree (`bin/cadence.pin` absent, no *.sha256* files). The producing half IS built: .github/workflows/release.yml:66-165 carries the four-target matrix behind `needs: guard`, packages with .github/scripts/package.sh and appends each sha256 line to $GITHUB_STEP_SUMMARY; package.sh is reproducible byte-for-byte under changed umask and mtime (probed). What is absent is the pin file and the publish-side comparison, which .planning/phases/4/PLAN.md:159-195 owns and REQUIREMENTS.md:604 maps to Phase 4 as REL-02.
reported: missing - the committed checksum file the criterion compares against does not exist anywhere in the repo, so the item cannot pass even on a live tag run
severity: minor
cause: Not a defect. The pin file and the publish-side sha256 comparison are phase 4's work - .planning/phases/4/PLAN.md:159-195, REQUIREMENTS.md:604 (REL-02). Phase 1 built the producing half only: the four-target matrix and a reproducible package.sh. The criterion was written before the release slice moved out of phase 1 on 2026-09-05.
reason: Moved to phase 4 on 2026-09-05, after the criteria were written. The pin file and the publish-side sha256 comparison are .planning/phases/4/PLAN.md:159-195 (REL-02); phase 1 shipped the producing half only. Phase 4 verifies it against a real release.

### 4. SessionStart lands the binary on a bare machine
expected: On a machine with no binary present, one session runs the SessionStart hook, the binary lands at the documented path outside ${CLAUDE_PLUGIN_ROOT}, and the session finishes with no error shown to the user. (human-verify: needs a live Claude Code session)
criterion: AC3
status: skipped
first_pass: fail
source: verifier
evidence: `grep -c SessionStart hooks/hooks.json` is 0; no bootstrap script exists under bin/ or .github/scripts/. Phase 1's PLAN.md:84-86 lists the bootstrap and hooks.json as out of scope, .planning/phases/4/PLAN.md:46-58 carries the hook as its own must-be-true, and REQUIREMENTS.md:605-606 maps BOT-01/BOT-02 to Phase 4.
reported: missing - no SessionStart hook and no bootstrap script were written in this phase, so a live session on a bare machine would fetch nothing
severity: minor
cause: Not a defect. The SessionStart hook and the bootstrap script are phase 4's work - .planning/phases/4/PLAN.md:46-58, REQUIREMENTS.md:605-606 (BOT-01/BOT-02) - and phase 1's own PLAN.md:84-86 lists them out of scope. Same 2026-09-05 scope move as AC2.
reason: Moved to phase 4 on 2026-09-05, after the criteria were written. The SessionStart hook and bootstrap script are .planning/phases/4/PLAN.md:46-58 (BOT-01/BOT-02) and phase 1's PLAN.md:84-86 lists them out of scope.

### 5. A cadence tool answers with a typed envelope
expected: In a session with the plugin installed, at least one tool named mcp__cadence__* is servable, and calling it returns a response whose structured content carries an envelope tag of ok, refused, unknown or not-applicable. (human-verify: needs a live Claude Code session)
criterion: AC4
status: skipped
first_pass: fail
source: verifier
evidence: Proven locally: spawned `cadence serve` answers tools/call cadence_version with isError false and structuredContent {"status":"ok","version":"3.7.12","os":"linux","arch":"x86_64"}, and the declared outputSchema's oneOf carries all four tags including the hyphenated `not-applicable`. Not wired: there is no `.mcp.json` at the plugin root (git ls-files finds only the spike fixture at .planning/spikes/toolsearch-deferral/mcp.json). PLAN.md:84-86 excludes it; .planning/phases/4/PLAN.md:123-146 creates it.
reported: unwired at the plugin seam - the tool and its envelope are real and were exercised over the wire, but nothing declares the server to a session, so no `mcp__cadence__*` name exists in a plugin-installed session
severity: minor
cause: Not a defect in the binary. The tool and its envelope work over the wire and, as of item 10, in a live headless session reached by --mcp-config. What is missing is the plugin-root .mcp.json that declares the server to a plugin-installed session, which .planning/phases/4/PLAN.md:123-146 creates. Phase 1's PLAN.md:84-86 excludes it.
reason: Moved to phase 4 on 2026-09-05. The envelope over the wire is proven - item 10 called the tool from a live headless session and read back the `ok` tag. What is deferred is the plugin-root .mcp.json that makes the name reachable in a plugin-installed session, created by .planning/phases/4/PLAN.md:123-146.

### 6. self-verify is clean and no ToolSearch preamble shipped
expected: `node cadence-core/bin/self-verify.mjs` reports no issues with the SessionStart row in hooks/hooks.json, and `git grep -l 'ToolSearch' -- skills/ cadence-core/workflows/` returns nothing.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs` -> ok:true, problems:[] over 30 checks; `git grep -l 'ToolSearch' -- skills/ cadence-core/workflows/` returns nothing. The SessionStart row the criterion names does not exist yet (phase 4), so that half is vacuous, not exercised.

### 7. cargo-test runs green beside the Node matrix
expected: A pull request run of .github/workflows/test.yml shows the cargo-test job green alongside the existing Node matrix jobs. (human-verify: needs GitHub Actions)
status: pass
first_pass: pass
source: model
evidence: PR #258 opened from cadence/binary-owns-process; test.yml run 33998192435 -> conclusion success, all 15 jobs green: cargo-test success beside self-verify, typecheck and the twelve node-test legs (22 and 24 x review/routing/git/planning/prose/other).

### 8. Open a pull request from cadence/binary-owns-process and watch the `cargo-test` job in .github/workflows/test.yml
expected: cargo-test green beside node-test, self-verify and typecheck; the toolchain step installs 1.98.1 by name and both `cargo build --locked` and `cargo test --locked` pass on ubuntu-latest
origin: verifier
why_human: Out of reach here: it needs a push to GitHub and a GitHub Actions runner. The workflow's structure was verified by parsing the YAML, and the same two commands pass locally, but no run exists because nothing has been pushed.
status: pass
first_pass: pass
source: model
evidence: PR #258 opened from cadence/binary-owns-process; test.yml run 33998192435 -> conclusion success, all 15 jobs green: cargo-test success beside self-verify, typecheck and the twelve node-test legs (22 and 24 x review/routing/git/planning/prose/other). The toolchain step and both `cargo build --locked` and `cargo test --locked` ran on ubuntu-latest inside that green cargo-test job.

### 9. Dispatch .github/workflows/release.yml by hand (workflow_dispatch) on this branch
expected: guard green with the `tagged commit is reachable from main` step skipped, four build legs green, four artifacts named by target, and four sha256 lines in the run summary
origin: verifier
why_human: Out of reach here: three of the four legs need macOS and arm64 GitHub-hosted runners, and the runner labels ubuntu-24.04-arm, macos-15-intel and macos-latest are excerpt's as of 2026-09 - a deprecated label fails its leg only at run time, which no local check can see.
status: pass
first_pass: fail
source: model
evidence: Re-dispatch after d299ef57: run 33998598770. guard success with the reachability step skipped; ALL FOUR build legs green including aarch64-unknown-linux-musl (ubuntu-24.04-arm), the leg the fix targeted; four artifacts named by target; four sha256 lines in the run summary - aarch64-apple-darwin 49b2df33..., aarch64-unknown-linux-musl b665c9fd..., x86_64-unknown-linux-musl d493cf26..., x86_64-apple-darwin 7d8799da.... Every runner label current, none deprecated. UNPLANNED BONUS: the three targets that also built in run 33998194022 produced BYTE-IDENTICAL archives across the two runs (same three digests), so package.sh's reproducibility holds run-to-run on the shared runner images and not only under the local umask/mtime probe - which is the property phase 4's pin depends on. The run's overall conclusion is still `failure` because `publish` carries `needs: guard` with no tag condition and errors on GITHUB_REF_NAME being a branch; that is pre-existing, outside this item's expected, and the user chose to leave it to phase 4 on 2026-09-05.
reported: one of four cross-compile legs failed and the run is red; three archives instead of four
severity: major
cause: Real defect, phase 1's own code, .github/workflows/release.yml:136-137. `set -euo pipefail` is in force and the last line is `ldd "$bin" 2>&1 | grep -Eq ...`. On aarch64-unknown-linux-musl the binary is a plain static (non-PIE) ELF, so glibc's ldd prints `not a dynamic executable` and EXITS NON-ZERO; pipefail takes ldd's status over grep's, so the step fails even though the grep matched. x86_64-unknown-linux-musl links static-pie, where ldd prints `statically linked` and exits 0, which is why that leg passes. The comment at :124-128 anticipated the STRING difference between the two rows and not the EXIT-STATUS difference. Line 136's `ldd ... || true` is the diagnostic print and is unaffected.
fix: d299ef57, retest

### 10. Point a live Claude Code session at the built binary (--mcp-config declaring `cadence` -> `<path>/cadence serve`) and call cadence_version
expected: the tool appears as mcp__cadence__cadence_version, the call succeeds, and the model can see the envelope tag `ok` - specifically whether the host surfaces structuredContent or only the mirrored text block
origin: verifier
why_human: Needs a live Claude Code session: what the host does with MCP structured content is a property of the CLI, not of this repo, and CONTEXT.md:189-194 flags it as an unverified assumption that D-07 rests on. Nothing in the repo can observe it.
status: pass
first_pass: pass
source: model
evidence: Headless session, the spike's own harness: `claude -p --strict-mcp-config --mcp-config cadmcp.json --setting-sources "" --output-format stream-json --verbose --permission-mode bypassPermissions`, the config declaring cadence -> `/code/cadence/target/debug/cadence serve`. init reported `mcp_servers: [{name: cadence, status: connected}]` and listed `mcp__cadence__cadence_version` by name. The agent called it and the tool_result carried `{"status":"ok","version":"3.7.12","os":"linux","arch":"x86_64"}` - envelope tag `ok`, visible to the model, which echoed it back verbatim. HOW it is surfaced, which is what CONTEXT.md's flagged assumption asked: the tool_result `content` is a STRING, not a structured object - the host mirrors rmcp's structuredContent into the text block and exposes no separate structured channel to the model. D-07's tag reaches the model either way, so the decision holds, but it holds through the mirror and not through a structured field. Transcript: scratchpad/ac4.jsonl. Note the harness declared the server by --mcp-config, not by a plugin-root .mcp.json, which item 5 still fails on.

## Summary

total: 10
passed: 7
failed: 0
pending: 0
skipped: 3
blocked: 0
reworked: 4
