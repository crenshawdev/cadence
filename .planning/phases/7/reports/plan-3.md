PLAN COMPLETE
Plan: `.planning/phases/7/PLAN-3.md`
Tasks: 5 of 5 committed and satisfied.
Initial HEAD: `354947e93412b77dfb97474ee6910f524660f4ad`.
Branch: `cadence/binary-owns-process`.
This exact run-record path is explicitly authorized by the owner and remains uncommitted. No other `.planning/` path is written.

| Task | Full signed commit SHA | Required verification passed |
| --- | --- | --- |
| P7-3-T1 | `c57201d38d1c97453d77a010d53a2b4f1aea8919` | 4 shared risk; 22 pause service; 5 pause library |
| P7-3-T2 | `f5b2d32176ff61b853c1df56a037592260324fe6` | 7 risk; 16 MCP |
| P7-3-T3 | `80ca6193e601884d713ecc07f36cbdd772d9a1bc` | 18 risk |
| P7-3-T4 | `d0f37f3835c9fba1b2efa51eda07f40005667b73` | 20 risk |
| P7-3-T5 | `9cf989cfbafede0841de7f256a6095d741407aec` | 22 risk; 21 execution service; 22 pause service |

## Implementation and evidence

T1 moved the eight-category vocabulary, selection validation and classifier into rail. Pause retains compatibility re-exports and an explicit material adapter, with no change to Fire's serialized shape or digest tuple. Independently encoded historical fire bytes round-trip exactly and Review::parse rejects different index material. The existing receipt exclusion, staged identity and one-rearm regressions passed. There is one signal-table/classifier implementation.

T2 added the strict risk-check apply operation, resident routing and a conditional writer operation. Public tool count remains three, all schema roots are objects and no input has a root union. The unchanged executor type is retained as its strict derived definition; schema tests now inspect that definition under the combined advertised field inventory. Observations, decision history and confirmation identity are committed together in rail_observations. Scan success and confirmed persistence remain separate, and no review-pass or native continuation receipt is created. Public lost-reply replay is byte-identical, identity reuse refuses, and injected intent/decision/snapshot failures cannot acknowledge success. Reopening recovers exactly one observation and preserves unrelated namespaces.

T3 captures commit IDs independently or captures write-tree once, then reads immutable objects through argv with external diff/textconv disabled. NUL pathname records and disabled rename detection preserve original bytes and both rename endpoints. The exact four frozen reviewer pathspecs are retained. Tests prove real added and removed signals for all eight categories, all existing path-signal categories, Unicode/space/tab paths, unchanged-context negatives, binary and gitlink inconclusiveness, non-UTF-8 paths and partial undecodable text. Readable sections remain classifiable alongside unreadable material. The configured external helper and textconv sentinel remains absent. PLANs, general planning prose, reports, arbitrary docs and lockfiles remain included. Failed refs, missing blobs and unreadable index material persist unchecked/inconclusive observations; invalid or unanswered surfaces, invalid scope/source and torn config refuse without a clean record or policy change.

T4 closes GH-229 before classification. Equal resolved committed endpoints, including different ref spellings, record outcome no-range, scan null and decision outcome risk-skipped-no-range. Validation rejects rewriting that identity as a completed scan. A nonempty excluded-only commit range, an empty commit and an empty staged tree remain checked-and-empty. Resolution is structurally committed (base/head) or staged (base/index, no head field), including partial failures. Captured IDs remain authoritative after refs move or staged bytes change. No mutable-index fingerprint or prefix identity comparison is introduced.

T5 retains the dispatch base with accepted task commits in rail_execution_material in the same native patch transaction, because completion otherwise removes the active dispatch. Pending-intent recovery validates that basis against the prior dispatch and accepted receipt; the optional intent field preserves historical absent-field bytes. The execution service supplies an explicitly selected accepted plan/dispatch range under the exact execution occurrence. A signed two-task public fixture proves later HEAD changes and rewritten report text cannot affect measured material; foreign occurrence/plan/worker/dispatch and unaccepted material refuse. Existing accepted executions without a retained base cannot be reconstructed from prose or guessed HEAD; they refuse this source, while explicit immutable ranges remain available. Pause uses shared object acquisition and classification, builds its authored tree from the captured index tree, and retains provenance exclusions and all guarded branch/HEAD/index/unstaged/result-tree/result-parent checks. Provider dispatch and automatic review authorization remain outside this plan.

## Repairs and plan/code observations

No unresolved acceptance-criterion or locked-decision disagreement. All changes fit the complete files frontmatter lease; task-local file bullets were not treated as a second lease. T5's atomic base retention uses the globally leased rail/risk.rs, store/writer.rs and store/transaction.rs in addition to its named service adapters.

The first T2 verify caught a fixture borrow error, fixed by preserving the borrowed record. The first MCP run passed 15 and failed 1 because another old schema inspection still targeted the combined root; all strict executor-object and malformed-wire assertions were retained against its derived definition. Initial T2 Clippy exposed the process-crash target's separate compilation of the production store and the new output enum's size. Shared domain paths and an explicit wire adapter fixed the former; boxing the new output fixed the latter. No undeclared test or lint suppression was needed. T2's prescribed verifies then passed in order. T5 Clippy caught the new reader after the existing test module; moving it before that module fixed the ordering error. These were repairable implementation/fixture mistakes, not blockers or changed criteria.

The repository native executor contract governs. The installed older contract was read during orientation, but its configuration-detection, lease-check command and report-rotation workflow were not invoked. The owner's explicit report and final-response instructions govern those outputs. No agents, additional workflow, push, checkout configuration edits, unsigned task commits, attribution or frozen-source edits were used. Fixture commits and keyrings are isolated under temporary directories; the execution fixture declares every path its task commits touch.

Deviations: none to criteria or locked decisions.
Open items: none within PLAN-3. PLAN-4 supplies firing, settlement and continuation status; detection here is not authorization.

## Full suite and final checks

The exact supplied full-suite chain ran once, before the final signed task commit, and exited 0: 456 passed, zero failed, one existing real-host guard probe ignored by its ordinary suite annotation. Clippy with warnings denied and fmt passed in that chain. CI typecheck passed separately. No suite failure or repair round occurred. Final HEAD: 9cf989cfbafede0841de7f256a6095d741407aec. All five task commits have valid GPG status G and conventional subjects naming their task IDs. Frozen cadence-core matches v3.7.12. The only uncommitted path is this run record.

Predictions were stated before required task verification and the supplied suite. The final task is committed only after a green supplied suite. Command subprocesses use ignored stdin; tests use TMPDIR=/tmp and the Rust wrapper is cleared. The frozen cadence-core comparison to v3.7.12 passed with empty output. A plan-wide lease check found 16 changed source paths, all declared.

## Captured command receipts

Each digest below covers the exact combined stdout/stderr bytes in the named file, excluding the runner's receipt metadata.

- T1-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 0; SHA-256 `4c16af673b9feb4582c6fa2ba82cb3ad7395d258a78bb3dd97faa0b2a13a8c72`; output `/tmp/cadence-p7-plan3-receipts/T1-verify-1.log`.
- T1-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service`
  Exit 0; SHA-256 `76115fddad27f8d5e1b5f59ced395a64cbf8e48b633e8fc54509c96787c43976`; output `/tmp/cadence-p7-plan3-receipts/T1-verify-2.log`.
- T1-verify-3: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib pause::`
  Exit 0; SHA-256 `9acc64a0de0c7841125e0c94856f0ba3caeafdcc683d48ace8b5c8068bde41c1`; output `/tmp/cadence-p7-plan3-receipts/T1-verify-3.log`.
- T1-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `21a24f4295b75fce9ba9953005ba29edc6b955f7860d8f9f8539dcad112559b8`; output `/tmp/cadence-p7-plan3-receipts/T1-clippy.log`.
- T1-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan3-receipts/T1-fmt.log`.
- T2-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 101; SHA-256 `8353b0a7987627b2258b73d6bc42137cbc5689b079a254c129384d0c945b6344`; output `/tmp/cadence-p7-plan3-receipts/T2-verify-1.log`.
- T2-verify-1-retry: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 0; SHA-256 `fcde64bea9db6484c5d05a0d3a004a18111df190f8d9183da9e36e6ab007d3d7`; output `/tmp/cadence-p7-plan3-receipts/T2-verify-1-retry.log`.
- T2-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 101; SHA-256 `22dc9ce817f67ee11a6adf6cfd44407962d4d5ab5912fcaff258dc6afb93f534`; output `/tmp/cadence-p7-plan3-receipts/T2-clippy.log`.
- T2-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`
  Exit 101; SHA-256 `3609c5a7eff82a89bd5684138ad2185267ed0d93ea815f10b4f7936b295f41e0`; output `/tmp/cadence-p7-plan3-receipts/T2-verify-2.log`.
- T2-verify-1-final: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 0; SHA-256 `6c30878271426520e987c9646fb6976d5cf1b63147ad328cfdb776c026b4b4d1`; output `/tmp/cadence-p7-plan3-receipts/T2-verify-1-final.log`.
- T2-verify-2-retry: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp`
  Exit 0; SHA-256 `614e9ea6c6ffe48e64c2b1f9161e594c0b2a3eb6351a613aa746a3530ea79892`; output `/tmp/cadence-p7-plan3-receipts/T2-verify-2-retry.log`.
- T2-clippy-retry: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `49d12a71d2dabcba658377e071622ead06c06092f3447fe01bb3190400ea730f`; output `/tmp/cadence-p7-plan3-receipts/T2-clippy-retry.log`.
- T2-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan3-receipts/T2-fmt.log`.
- T3-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 0; SHA-256 `bd5c1a2a125ed9eb04321046db7b09c3fdf5ebdab4c4b433bea4f839443096f0`; output `/tmp/cadence-p7-plan3-receipts/T3-verify-1.log`.
- T3-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `ed7631718ac21d4fd17c56ac48d7761c38930c40df8418eb6079739421c84e93`; output `/tmp/cadence-p7-plan3-receipts/T3-clippy.log`.
- T3-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan3-receipts/T3-fmt.log`.
- T4-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 0; SHA-256 `1f011d1c7b315c9fd002f860bb2ac156a72695f1c9cd7a08066e898b939a7299`; output `/tmp/cadence-p7-plan3-receipts/T4-verify-1.log`.
- T4-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `0a4df8ea5d47d97e6274be6045c36910cf147f2e0291fe8fe81190775071b633`; output `/tmp/cadence-p7-plan3-receipts/T4-clippy.log`.
- T4-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan3-receipts/T4-fmt.log`.
- T5-verify-1: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`
  Exit 0; SHA-256 `72cda56a2fd1458cb6788be951f9725658b1e662be83a327c338a7331658f8f7`; output `/tmp/cadence-p7-plan3-receipts/T5-verify-1.log`.
- T5-clippy: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 101; SHA-256 `62c881a1f003e8398e4dbb421a89997cc072142b5166195e96fcd7695fb4b81b`; output `/tmp/cadence-p7-plan3-receipts/T5-clippy.log`.
- T5-clippy-retry: `RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`
  Exit 0; SHA-256 `f3267052c3748bda62961b12f4c632d1d553591563185bbdd2aea98ac68b3ec0`; output `/tmp/cadence-p7-plan3-receipts/T5-clippy-retry.log`.
- T5-fmt: `RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan3-receipts/T5-fmt.log`.
- typecheck: `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`
  Exit 0; SHA-256 `c66a12b6e1cf23424ff7c6a3454c7c2c71c6c44b2ff5ebe6b94d82fe6f3d7713`; output `/tmp/cadence-p7-plan3-receipts/typecheck.log`.
- frozen: `git diff --exit-code v3.7.12 -- cadence-core/`
  Exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; output `/tmp/cadence-p7-plan3-receipts/frozen.log`.
- T5-verify-2: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service`
  Exit 0; SHA-256 `1c32b079751c07c8c9b455e4b061b05695f7f1493ac95050d46c61a349a7fd12`; output `/tmp/cadence-p7-plan3-receipts/T5-verify-2.log`.
- T5-verify-3: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service`
  Exit 0; SHA-256 `96efd66fa55078ae4d431d579d6b5986f024b4fbead56c9df793736dd36c3b91`; output `/tmp/cadence-p7-plan3-receipts/T5-verify-3.log`.
- full-suite: `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`
  Exit 0; SHA-256 `608e32bf1a39fc98cfeb4f4b65180988d49b447b927190b0149140a54e129df3`; output `/tmp/cadence-p7-plan3-receipts/full-suite.log`.
