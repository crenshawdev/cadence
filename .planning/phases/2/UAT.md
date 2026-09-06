---
status: testing
phase: 2
fields_version: 1
started: 2026-09-06
updated: 2026-09-06
---

Walked conversationally with John on 2026-09-06, outside `/cad-verify`, because
the phase executed through Codex rather than `cad-executor` and the workflow has
no live dispatcher in this cycle. Every mechanical claim below was re-checked
against HEAD at walk time rather than read from the executor's reports.

## Items

### 1. Fixture bundles rebuild to identical bytes
expected: A committed script builds the fixture `.planning` bundles from the frozen tag `v3.7.12`, and a rebuild changes no tracked byte.
criterion: HAR-01
status: pass
first_pass: pass
source: verifier
evidence: `node crates/cadence/tests/golden/build-fixtures.mjs` exited 0 and `git status --porcelain crates/cadence/tests/golden/fixtures` returned empty, so the rebuild reproduced every tracked byte. 17 bundles on disk: closed, config, config-unknown, deferred, forge-configured, hooks, incomplete, malformed, multi, planning-inputs, plugin, project, protected, publish-authorized, risk-recorded, slice, unreadable-reads.

### 2. The slice bundle answers as a live cycle
expected: The slice bundle's re-rooted archived subtrees answer `status` as a live cycle rather than the tag's own closed-milestone answer.
criterion: HAR-01
status: pass
first_pass: pass
source: verifier
evidence: `planning.mjs status --dir crates/cadence/tests/golden/fixtures/slice/.planning` returns `ok:true current:2 total:2` - a non-null current phase, which a closed milestone cannot produce.

### 3. The recorder runs the frozen surface over every operation
expected: A committed recorder runs the frozen JavaScript over every runtime operation the parity surface names, writing one recording per invocation with exit status, stdout envelope and post-run file bytes.
criterion: HAR-02
status: skipped
first_pass: pass
source: user
evidence: It was built and it worked - 156 recordings over 74 distinct operations, 47 of them `git: true`, refusal sources classified 61 handler / 10 door / 3 none. It was then deleted in `7d64c4c9` along with `record.mjs`, `operations.json` and the recordings.
reason: RETIRED by John's rearchitecture ruling the same day. Parity is owed at the user-facing skill surface, so "every runtime operation" is the unit 4.0.0 abandoned. The row is removed from `## Traceability`; nothing is owed against it.

### 4. Recordings are deterministic by construction
expected: Two consecutive recorder runs, and runs from another working directory, temp root, timezone and locale, produce byte-identical recordings, with every clock-derived field covered by a named rule carried as data.
criterion: HAR-03
status: skipped
first_pass: pass
source: user
evidence: Six normalization rules shipped as data - trace `ts`, reads `ts`, `cursor.updated` on stdout, `STATE.md` `Updated:`, UAT `started` and `updated` - and `record.mjs --check` exited 0 on a fresh run with the hostname, GPG and absolute-path leak greps all empty. Deleted with the recorder in `7d64c4c9`.
reported: the check list this row specifies is incomplete, and its own gap shipped a defect
severity: minor
cause: The four local determinism checks varied working directory, temp root, timezone and locale, and never the REPO PATH. Ten fixture files carried the literal string `/code/cadence` in their prose, and `record.mjs:285`'s unconditional `text.replaceAll(repo, '<REPO>')` rewrote it, so the committed goldens only reproduced on a machine rooted at `/code/cadence`. Caught by CI, not by this criterion, and fixed in `460c9e43`.
reason: RETIRED with the goldens. The DISCIPLINE carries to phase 16 as a roadmap-level constraint, sharpened by the gap above: any determinism criterion must relocate the repository - `git archive HEAD | tar -x` into a scratch dir, `git init`, run the check there.

### 5. A drift check fails on changed bytes, and CI runs it
expected: A drift check regenerates every recording into scratch, exits non-zero naming each recording whose bytes differ, refuses a run under the wrong Node major, and the test workflow runs it.
criterion: HAR-04
status: skipped
first_pass: pass
source: user
evidence: `golden-drift` ran green on CI (run 34041291596, commit `460c9e43`) beside `cargo-test`, `typecheck`, `self-verify` and the Node matrix, and it caught a real defect on its first run. Removed from `.github/workflows/test.yml` in `7d64c4c9`; four jobs remain, confirmed at HEAD.
reason: RETIRED with the goldens. Row removed from `## Traceability`.

### 6. The envelope's non-ok arms carry a machine code
expected: The Rust envelope's `refused`, `unknown` and `not-applicable` arms serialize a machine `code` beside the prose `reason`, in the JavaScript seam's kebab-case spelling, with the `ok` arm and the D-07 successful-call property unchanged.
criterion: HAR-05
status: pass
first_pass: pass
source: verifier
evidence: `crates/cadence/src/envelope.rs:49,57,66` carry `code` on all three non-`ok` arms. `cargo test --locked` is green at HEAD - 10 tests, 0 failed - including `refused_carries_a_code_and_prose_reason`, `unknown_carries_a_code_and_prose_reason`, `not_applicable_keeps_its_hyphen`, `ok_puts_the_payload_fields_beside_the_tag` and `refused_is_a_successful_call_carrying_its_refusal`, which is D-07. This survived `7d64c4c9` because it is crate code, not harness code.

### 7. Comparison fails on a wrong answer, and everything is accounted for
expected: A Rust test compares each operation's answer field-by-field on its declared decision-bearing keys, fails on a deliberately wrong answer naming the differing field, and accounts for every recording by name as compared or pending, failing rather than skipping on any gap.
criterion: HAR-06, HAR-07
status: skipped
first_pass: pass
source: user
evidence: Built and green - 25 golden tests proving the instrument by its negative controls. The honest number at close was `compared=0 pending=156`: the binary implemented no recorded operation, so nothing here was ever a parity claim. `golden.rs` deleted in `7d64c4c9`.
reason: CARRIED to phase 16, not retired. The need is real and unmet - this is acceptance itself, and it moves from the CLI-invocation boundary to the scenario boundary. Both rows are `Deferred` against Phase 16 in `## Traceability`. The half worth protecting in the rebuild is HAR-07's principle: account for everything by name and fail rather than skip.

### 8. The frozen reference did not move
expected: `cadence-core/` stays byte-identical to the tag `v3.7.12` across the whole phase.
origin: smoke
status: pass
first_pass: pass
source: verifier
evidence: `git diff --stat v3.7.12 HEAD -- cadence-core` is empty at HEAD, after all seventeen task commits and the deletion.
