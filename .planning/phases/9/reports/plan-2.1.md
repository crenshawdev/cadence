PLAN CHECKPOINT: structural
Plan: .planning/phases/9/PLAN-2.md
Tasks: 2 of 4

| Task | Commit | Note |
|---|---|---|
| P9-2-T1 | a74a7452 | Typed range/staged/file retention, SHA-256 content identity, source/Git/clock adapters, hand-authored material-snapshots fixture. `phase9_material retain_`: predicted and observed 8 passed, 0 failed, twice. Signature G, John Crenshaw <john@jcrenshaw.dev>. |
| P9-2-T2 | e2c7f822 | Retained-only reads with content validation, byte comparison, frozen directory acquisition and read, hand-authored material-read fixture. `phase9_material read_`: predicted and observed 7 passed, 0 failed. Signature G, John Crenshaw <john@jcrenshaw.dev>. |
| P9-2-T3 | none | Pending at structural checkpoint before implementation. Supplied-map lookup/validation tests would not establish that acquisition actually records maps. No substitute tests were written. |
| P9-2-T4 | none | Pending; not started because execution stops at Task 3. |

Deviations: [deviation] Task 3 requires recording source line/byte and diff/source maps, but the current Task-1/2 acquisition implementation already persists manifests with empty maps and Task 3 excludes the acquisition files from its exact task write lease. Integrating the recording behavior now requires changing those files. Stopped rather than claiming supplied-map fixture checks complete the recording obligation. No acceptance criterion or locked decision was redefined. The dispatch's named-target-only and single-clippy rules override the executor contract's full-suite and per-task lint instructions. Initial status showed existing .planning/STATE.md changes and an untracked reports directory despite the clean-checkout premise; both were preserved.

Open items: (1) Task 3 mapping integration and Task 4 remain pending. (2) All four MANUAL.md items remain human-owned and unverified; no test substitutes were added.

Checkpoint: structural
Current task: P9-2-T3 — Bind diffs to retained source sides
Need: Revise Task 3's exact write lease to permit crates/cadence/src/review/material.rs, crates/cadence/src/review/material_io.rs and crates/cadence/tests/phase9_material.rs, or specify another recording boundary that satisfies D-60/H2 without changing already retained manifests. These paths already belong to PLAN-2's frontmatter; no frontmatter extension has been made or is requested.

Evidence and proposed continuation:
- PLAN-2 line 91 requires recording line-to-byte maps and hunk-to-source maps, preserving old/new paths and explicitly absent deleted sides. Its line 90 task lease contains only manifest.rs, phase9_manifest.rs and material-sides.json. Line 144 says each task Files line is an exact write lease.
- material.rs lines 66–69 initialize old_path/new_path to None and lines/hunks to empty vectors. The acquisition paths persist that manifest through save (line 105 and calls at 221, 263, 381). retain_record rejects a different payload at an existing logical key (line 30). Thus adding a pure reader over hand-authored maps does not make the acquired H2 records contain those maps, and adding them after retention would conflict with the immutable-record write rule.
- material_io.rs currently requests --no-renames and exposes source-read failures as unavailable. Task 3 must preserve old/new associations and distinguish genuinely absent sides without converting all failures into absence. That is an acquisition concern in the current implementation, not something source_reference can infer from an empty saved map.
- Proposed continuation: implement pure mapping construction in manifest.rs; invoke it during acquisition before the manifest is persisted; adjust Git acquisition only as needed to preserve path/side observations; add the production sibling declaration to phase9_material so its actual source files still compile. Implement Task 3's named direct criteria independently, then proceed to Task 4. No Plan-1 frozen type change is currently proposed; checkpoint again if one proves necessary.
- Impact: expands Task 3's task-local lease by three paths, all already declared by PLAN-2. No broader phase plan is needed. Existing two signed commits remain intact. No history rewriting or extra repair commit was attempted.
- Alternative: change acquisition to retain bytes and return a draft manifest, with a clearly specified later finalization boundary before dispatch. This also changes the present acquisition implementation and needs a plan decision; it was not silently substituted.
- This is a coupling issue exposed by the current Task-1/2 implementation, not a claim that the four pure Task-3 fixture assertions are intrinsically impossible. Passing those alone would leave the stated recording behavior incomplete.
- The published [executor contract](/claude/.claude/plugins/cache/cadence/cadence/3.7.12/skills/cad-executor-contract/SKILL.md) says: “Stop instead of proceeding ... when meeting the criterion needs something outside this plan's `files:` lease” and “Never continue past a checkpoint condition.” The plan's more specific exact task leases govern these edits. Work stopped at that boundary; no approval is inferred.

Environment and scope:
- Applied the published cad-executor-contract SKILL.md and lean-build reference from /claude/.claude/plugins/cache/cadence/cadence/3.7.12. Main checkout on cadence/binary-owns-process, initial HEAD 34b80fe2. No worktree contract applies. No CLAUDE.md exists or is required.
- Read PLAN-2, CONTEXT, PROJECT, acceptance-criteria rules and MANUAL. Plans 3–6 were not opened. No Plan-1 frozen file was changed. Read-only caller searches found no pre-existing implementations of the new named units.
- Signing configuration remained John Crenshaw <john@jcrenshaw.dev>, key 693AB15F91734B0C, commit.gpgsign=true. No configuration changes or authorship trailers. Every commit was checked with git log -1 signature formatting and returned G.
- No network, installs, host sessions, MCP sessions, sub-agents, pushes, ref moves/deletions, history rewrites, GC, pruning or object-discarding commands. Git acquisition code calls the repository's own rail::git abstraction. Tests do not start Git.
- Every Node subprocess used TMPDIR=/tmp and stdin=DEVNULL. Cargo runs used CARGO_NET_OFFLINE=true and cleared RUSTC_WRAPPER. No signing sandbox artifact occurred.
- No previous plan-2 report existed, so rotation was unnecessary after reading the published rotation rule. Wrote PLAN PARTIAL after each task commit; this final rewrite records CHECKPOINT. Reports and all other .planning paths remain uncommitted.

Verification record:
1. `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_material retain_`: predicted 8 passed / 0 failed; observed exactly that, exit 0, no ignored or filtered tests.
2. Published config get workflow.lint_command returned null. Published detect-commands returned cargo clippy --all-targets -- -D warnings and npx tsc -p tsconfig.ci.json. The user-specified clippy invocation and one-run ceiling took precedence.
3. `node node_modules/typescript/bin/tsc -p tsconfig.ci.json`, TMPDIR=/tmp and stdin=DEVNULL: exit 0, no diagnostics. Used the installed compiler directly to avoid npx package/network resolution.
4. Repeated the named retain_ command after separating diff identity from a possible source file named diff and marking initial material as original-view without a delivery binding. Predicted 8 passed / 0 failed; observed 8 / 0, exit 0. No test failure preceded this rerun.
5. `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_material read_`: predicted 7 passed / 0 failed; observed 7 / 0, exit 0, 8 filtered out, no ignored tests.
6. Single clippy invocation at the checkpoint: `RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo clippy -p cadence --tests -- -D warnings`. Predicted exit 0 with no warnings; observed exit 0 with no warnings. It was run once, not repeated. No full suite or regression sweep was run.
7. rustfmt and git diff --check passed for the task changes. Tests each contain one assertion, named inputs and literal expected values. SHA-256 criteria use the specified literal strings, not the production function as an oracle. One bool-assert lint is locally allowed to retain AC38's literal false assertion.

Lease and commit record:
- Task 1 staged exactly material.rs, material_io.rs, phase9_material.rs and material-snapshots.json. Published lease-check --phase 9 --plan 2 returned ok=true, staged=4. Commit a74a7452; signature G; no deleted files.
- Task 2 staged exactly material.rs, phase9_material.rs and material-read.json. Same lease gate returned ok=true, staged=3. Commit e2c7f822; signature G; no deleted files.
- No file outside the frontmatter lease was edited except this explicitly requested uncommitted report. No task-local lease was exceeded. The requested Task-3 lease revision was not enacted.
- Final HEAD e2c7f822. Worktree changes consist of the pre-existing .planning/STATE.md modification and the untracked reports directory containing the existing Plan-1 report and this report. No uncommitted production/test changes remain.

Implementation limits:
- RetainedMaterial returns the typed manifest and acquired bytes. AC34–AC36 project the specified target/source observation directly from that result; they do not invoke read_material to prove acquisition. Named-file acquisition has no Git capability. Missing source observations and failed reads remain distinct; failed durable sync returns an error.
- Storage logical content/manifest keys are interpreted by the supplied durable adapter. No separate authoritative material directory or journal was introduced. The transaction-backed production adapter remains its stated owner's work.
- Retained reads use only supplied storage and verify content identity. Saved directory reads have no source-filesystem or Git access. Acquisition freezes the observed sorted membership and retains each member observation.
- Source maps, old/new path associations, append-only supporting evidence and specialist target constructors are not complete. No plan-complete, phase-complete or manual-acceptance claim is made.
