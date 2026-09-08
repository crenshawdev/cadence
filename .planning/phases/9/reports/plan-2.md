PLAN COMPLETE
Plan: .planning/phases/9/PLAN-2.md
Tasks: 4 of 4

| Task | Commit | Note |
|---|---|---|
| P9-2-T1 | a74a7452 | Retained typed range/staged/file material, SHA-256 content identity and source/Git/clock adapters. `phase9_material retain_`: 8 passed/0 failed, twice. Signature G; John Crenshaw <john@jcrenshaw.dev>. |
| P9-2-T2 | e2c7f822 | Retained-only reads, content validation, direct byte comparison and frozen directory acquisition/read. `phase9_material read_`: 7 passed/0 failed. Signature G; John Crenshaw <john@jcrenshaw.dev>. |
| P9-2-T3 | e9728abb | Source-side reads/validation and mapping construction before persistence, using the granted task-local lease extension. Final direct verification: `phase9_manifest source_` 12/0; `phase9_material` 20/0. Signature G; John Crenshaw <john@jcrenshaw.dev>. |
| P9-2-T4 | cf6e1600 | Append-only supporting evidence, supplied-view binding, exact specialist payload constructors and architecture documentation. `phase9_context context_` 9/0. Signature G; John Crenshaw <john@jcrenshaw.dev>. |

Deviations:
- [deviation] Task 3 required recording source/diff mappings, but Task-1/2 acquisition already persisted manifests with empty maps and Task 3's exact task lease excluded that acquisition code. Stopped at a structural checkpoint. The user inspected the code and explicitly extended Task 3 to material.rs, material_io.rs and phase9_material.rs. All three paths were already in PLAN-2's frontmatter. Implemented mapping before persistence; no frozen Plan-1 type or prior assertion was changed. No further checkpoint occurred.
- [deviation] The first Task-3 prediction was phase9_manifest source_ 11/0 and phase9_material 19/0; actual results were 10/1 and 18/1. Both failures were the same new direct octal-path decoding test, caused by an intermediate u8 addition overflow. Repaired the production arithmetic in one bounded repair; no test expectation changed. Added a direct path-with-spaces check while completing the parser. The final predicted and observed counts were 12/0 and 20/0.
- [deviation] Task 4 predicted phase9_context context_ 8/0; observed 9/0. The substring selector also matched the shared parser test source_context_line_has_both_source_sides. This was an extra passing test, not a changed criterion or hidden failure.
- Dispatch instructions override the executor contract's full-suite/per-task lint requirements: named targets only and at most one clippy invocation. The one clippy run passed at the first checkpoint, after Task 2. The continuation explicitly prohibited another; Task-3/4 changes were compiled and tested but were not rerun through clippy. No claim of clippy coverage for those later changes is made.
- Initial status showed pre-existing .planning/STATE.md changes and an untracked reports directory despite the clean-checkout premise. Preserved both. Used the installed TypeScript compiler directly instead of npx to avoid package/network resolution.

Open items: All four MANUAL.md items remain human-owned and unverified. No test substitutes were added. Production transaction composition, public registration, host observation admission and consumer enumeration remain with their declared owners; phase-10 evidence weighting/settlement was not implemented. These are scope boundaries, not uncompleted PLAN-2 tasks.

Environment and authority:
- Applied the published cad-executor-contract SKILL.md and lean-build reference from /claude/.claude/plugins/cache/cadence/cadence/3.7.12. Read PLAN-2, CONTEXT, PROJECT, the seven AC authoring rules and MANUAL. No worktree contract applies. Plans 3–6 were not opened or implemented.
- Main checkout on cadence/binary-owns-process, initial HEAD 34b80fe2, final HEAD cf6e1600. No CLAUDE.md exists or is required. No Plan-1 frozen file was changed. Read-only caller searches preceded new implementations.
- Git configuration remained John Crenshaw <john@jcrenshaw.dev>, signing key 693AB15F91734B0C, commit.gpgsign=true. Each commit was immediately checked with git log -1 signature formatting and returned G. A final four-commit signature check also returned G for all four. No authorship trailers were added.
- No network, installs, hosts/MCP sessions, sub-agents, pushes, history rewrites, ref moves/deletions, GC, pruning or object-discarding commands. Git acquisition code uses cadence::rail::git. Tests supply subprocess observations and do not start Git.
- Node subprocesses used TMPDIR=/tmp and stdin=DEVNULL. Cargo commands cleared RUSTC_WRAPPER and set CARGO_NET_OFFLINE=true. No signing sandbox artifact occurred.
- This run wrote PLAN PARTIAL after each task commit, including Task 4. PLAN COMPLETE was written only after final named-target verification passed. No previous report existed at the initial dispatch. Before the continuation's first write, the checkpoint report was rotated to plan-2.1.md under the published lowest-free-suffix rule. The historical checkpoint evidence remains there.

Resolved checkpoint and lease:
- The previous checkpoint was structural, at P9-2-T3. Its evidence was empty lines/hunks and absent old/new path metadata in acquisition, immutable manifest persistence, and Task 3's narrower exact Files line. The user explicitly verified and authorized the extension in the continuation message.
- The extension was used only to add a mapping call immediately before manifest persistence, retain Git rename headers with stable diff indicators, and add the production manifest sibling declaration to phase9_material. No acquisition restructuring, H1–H5 vocabulary change or T1/T2 test change was made.
- The final diff from e2c7f822 for phase9_material.rs contains only the added three-line sibling declaration. Both prior fixture files and all 15 T1/T2 test bodies are unchanged.
- No frontmatter extension was needed. No further lease extension or checkpoint was needed. No task-local lease was exceeded.

Verification record, repository root:
1. `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_material retain_`: predicted 8/0; observed 8/0, exit 0, no ignored tests.
2. Published config get workflow.lint_command returned null. Published detect-commands returned cargo clippy --all-targets -- -D warnings and npx tsc -p tsconfig.ci.json. The dispatch's exact clippy invocation and one-run ceiling took precedence.
3. `node node_modules/typescript/bin/tsc -p tsconfig.ci.json`, TMPDIR=/tmp and stdin=DEVNULL: exit 0, no diagnostics. No npx package resolution.
4. Repeated the retain_ command after a local diff-entry identity/provenance correction: predicted and observed 8/0, exit 0. No test failure preceded this repeat.
5. `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_material read_`: predicted and observed 7/0, exit 0, 8 filtered out, no ignored tests.
6. Single clippy invocation, before the first checkpoint: `RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo clippy -p cadence --tests -- -D warnings`. Predicted exit 0 without warnings; observed exit 0 without warnings. Not repeated during continuation.
7. Initial `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_manifest source_`: predicted 11/0; observed 10/1, exit 101. New source_quoted_git_path_decodes_octal_bytes panicked at the decoder arithmetic.
8. Initial `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_material`: predicted 19/0; observed 18/1, exit 101. Same new parser test failed; all 15 existing T1/T2 tests passed unchanged.
9. After the one arithmetic repair and added space-path check, the same two named commands returned the predicted 12/0 and 20/0, exit 0, no ignored tests. The five private parser tests compile directly with manifest.rs in each target; their repeated execution is not additional independent acceptance criteria.
10. `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_context context_`: predicted 8/0; observed 9/0, exit 0, 4 filtered out. The selector matched one shared parser test in addition to eight context tests.
11. Final post-commit verification: `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --test phase9_material --test phase9_manifest --test phase9_context`. Predicted and observed material 20/0, manifest 12/0, context 13/0; exit 0. No ignored or filtered tests. No whole-project/workspace suite was run.
12. rustfmt and git diff --check passed. Tests each use one assertion, named inputs and literal expectations, with only filesystem/clock/subprocess boundaries supplied. The two SHA-256 criteria use their literal independent values. A local bool-assert lint allowance preserves AC38's literal false assertion. No model-generated prose is asserted.

Commit protocol:
- T1 staged exactly material.rs, material_io.rs, phase9_material.rs and material-snapshots.json. Published lease-check --phase 9 --plan 2: ok=true, staged=4. Commit a74a7452; signature G; no deleted files.
- T2 staged exactly material.rs, phase9_material.rs and material-read.json. Same gate: ok=true, staged=3. Commit e2c7f822; signature G; no deleted files.
- T3 staged exactly manifest.rs, phase9_manifest.rs, material-sides.json and the three explicitly authorized extension paths. Same gate: ok=true, staged=6. Commit e9728abb; signature G; no deleted files.
- T4 staged exactly material.rs, targets.rs, phase9_context.rs, material-context.json and docs/architecture/review-material.md. Same gate: ok=true, staged=5. Commit cf6e1600; signature G; no deleted files.
- Exactly four atomic conventional task commits. Their aggregate changed-path list is exactly PLAN-2's twelve frontmatter paths. No .planning path was committed. Final uncommitted paths are the existing .planning/STATE.md change and reports directory; no production/test changes remain unstaged.

Implementation and evidence limits:
- RetainedMaterial returns the canonical typed manifest and byte observations. AC34–AC36 project the requested target/source observation directly from that result. They do not call a read unit to prove acquisition. Named-file acquisition has no Git capability. Missing and unavailable sources remain distinct; durable-sync failure is an error.
- Retention uses supplied Storage logical content/manifest keys. The production adapter owns physical transaction composition. No separate material directory or journal was introduced. Content identity is SHA-256 over exact bytes.
- Source mapping is constructed before manifest persistence. Source lines use one-based numbers and half-open byte offsets including terminators. Diff mappings preserve base/head/snapshot sides and distinct rename paths. Context lines can reference both sides; absent sides are distinguished from source-read failure. Validation requires readable source-entry metadata, and retained reads separately verify bytes against content identity.
- Directory reads use saved membership and retained source entries. They have no source-filesystem, directory-enumeration or Git capability. Their fixtures are supplied images, not restart episodes.
- append_material saves exact bytes and an immutable MaterialAppend with the same manifest identity, contract and acquired entry metadata. It does not replace the base manifest or earlier append records. A supplied delivery binding must name the same manifest and an immutable view already containing the entry. No binding means later-evidence with no attempt/view claim. This check does not authenticate host participation; the caller supplies its actual delivery observation.
- Decision/diagnosis constructors own exact serializable inline payloads, alongside the canonical Plan-1 target/source records. The append operation can retain these payload bytes; the direct inline-byte test supplies them independently and does not chain the constructor through acquisition. The constructors do not redefine the H1–H5 vocabulary or implement specialist judgment.
- Compatibility fixtures and direct unit checks do not discharge any MANUAL.md item or claim a live native producer/restart episode. PLAN COMPLETE means this plan's four tasks and their named direct verification are complete.
