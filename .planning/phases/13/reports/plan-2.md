# Phase 13 PLAN-2 execution report

Starting checkout: `/code/cadence`, `cadence/binary-owns-process`, HEAD
`dedf770c` (task 1's red, committed by the interrupted Codex executor) with
that executor's task 1 green work uncommitted in the tree. This report is
intentionally uncommitted. Both tasks are committed; the plan-close suite and
clippy were run once each after task 2.

All commits are authored by John Crenshaw <john@jcrenshaw.dev>, signed with
key 693AB15F91734B0C; `git log -1 --format=%G?` printed `G` after each.

## Inherited task 1 work

Read against PLAN-2 task 1's Action and lease before anything else:

- Changed paths: `crates/cadence/src/{server.rs, store/transaction.rs,
  store/writer.rs, verification/instructions.rs, verification/mod.rs,
  verification/runner.rs, verification_service.rs}`, new
  `crates/cadence/src/verification/verdicts.rs`, `skills/cad-verifier-contract/SKILL.md`,
  `skills/cad-verify/SKILL.md`. Every path is in the plan's `files:` lease and
  in task 1's Files list.
- Design conformance: submission goes through writer `CompareTransact`; the
  writer recomputes the claim against the committing snapshot (map digest,
  inventory, source, execution evidence and owner statements reobserved) and
  refuses with a conflict when it differs; recovery (`Intent` validation)
  recomputes the same transaction and checks exact participants; refusals are
  retained as `verification.claims`, effective patches separately as
  `verification.patches`; exact replay returns the original answer, changed
  payload under the same request id refuses; non-verification intents can
  neither change `verification-*` journal records nor seed the namespace;
  accepted checks need the latest independent launch with a complete,
  successful, nonzero-test result on the exact source. Nothing was discarded.
- Rendered skills: `cargo run -p cadence -- verifier-instructions` and
  `--frontdoor` output diffed byte-equal against both skill files.
- `cargo check -p cadence --all-targets`: no warnings.

## Tasks

| Task | Commit(s), signature | Named verification and literal result |
| --- | --- | --- |
| P13-2-T1 | red `dedf770c405cd213e88fae840c121c7a9e21bd42`, G (inherited); green `e1def106a207e0c86b353a97f6f6cae4ee8056b1`, G | `cargo test -p cadence --test phase13_verification phase13_mismatched_verdict_patch_is_refused -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 51.31s`. Exactly one function selected. |
| P13-2-T2 | red `f6c2b060f602c0db737f1a977b04242e2f39ed34`, G; green `5082bf2d2758b8d57b1b3649637705b9cd63ba70`, G | `cargo test -p cadence --test phase13_verification phase13_report_derives_truth_status_from_every_item -- --exact`: red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 2 filtered out; finished in 6.67s`; green exit 0, `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 84.89s`. Exactly one function selected in both. |

## Red evidence

P13-T2-C (task 1): the red at `dedf770c` was recorded by the prior executor;
its stated failure was the real stdio path answering
`verification-unavailable` at `operation`, no mismatched item identified. I
did not rerun the red; the green above ran on the inherited tree before commit.

P13-T3-C (task 2): at `f6c2b060` the completed native fixture built (two plans,
admission, red/green receipts, attestations, closes, suites, risk, plan
completion), then the first assertion of the check failed at
`crates/cadence/tests/phase13_verification.rs:328`:

```text
assertion `left == right` failed: {"status":"refused","code":"invalid-plan","reason":"retained attempt absent","rule":"verification-attempt","slot":"attempt","phase":13,"entry":null,"id":null}
  left: String("refused")
 right: "ok"
```

No derived truth status existed: `verification-read` refused instead of
reporting pending rows over the approved truths. That is missing production
behavior, not a setup failure. The check's cases and controls stay in one
function; no expected value was changed to make it pass.

## Delivered behavior (task 2)

`verification/status.rs`: per-truth rows over every canonical item the exact
truth version is associated with in the attempt's retained map, reduced by the
design table (any rejected or not_seen -> unmet; else any observation ->
concerns; else met; no items -> pending). Shared items reach every association
that names them and no other. The current judgment is the latest complete patch
whose full basis equals the basis observed now through `inputs::observe`;
every other attempt is `historical` (reason: differing basis fields such as
`basis.source`, superseded by a later attempt on the same basis, or current
inputs unavailable) or `open` (no complete patch). Historical rows keep their
verdicts, observed text, association reasons and old basis. When nothing is
current, truths come from the approved context as `pending`; an uncommitted
tree makes the current inputs unavailable with the located `verification-source`
refusal and nothing current. `legacy` reports SUMMARY/UAT presence as
classification only. `verification/render.rs` renders the report text from the
derived rows. `verification_service.rs` returns the report from
`verification-read` alongside the selected attempt's raw record, runs,
unknown runs and claim history; a read with no attempt and native truths
succeeds with pending rows, a named absent attempt still refuses. Readback
writes nothing; the approved context bytes are unchanged after every read.
A unit test for `reduce` is in `status.rs`.

Test support: `Completed::with_observation()` builds the separate generic
fixture whose second plan carries a supplementary observation; the handwritten
section grammar learned the observation spec field order.

Compiled verifier instructions and the patch schema did not change in task 2,
so the two rendered skills needed no regeneration (verified byte-equal after
task 1; unchanged since).

## Plan-close quality

- `cargo clippy --workspace --all-targets -- -D warnings` (stdin null): run
  once after task 2; no warnings, no errors; `Finished dev profile`.
  A second invocation of the identical command was made only to capture the
  summary line after the first run's output had been filtered; it compiled
  nothing (`0.05s`, cached) and changed no result.
- `cargo test --workspace --no-fail-fast`: run once after task 2, exit 0.
  49 `test result:` lines, every one `ok`; totals summed from cargo's output:
  902 passed, 0 failed, 0 ignored. Longest targets: `tests/execution_store.rs`
  (18 passed, 298.76s), lib unit tests (239 passed, 136.60s),
  `tests/phase12_execution.rs` (7 passed, 120.03s), `tests/phase13_verification.rs`
  (3 passed, 87.10s); `tests/mcp.rs` (18 passed, 45.43s) keeps both rendered
  verifier skills byte-equal. No linker crash; nothing relaunched.

## Deviations

- Task 2 changed one word outside its own Files list but inside the plan's
  lease: `verification/verdicts.rs` `fn error_answer` became `pub(crate)` so
  `status.rs` reuses the same located-refusal decoding instead of copying it.
- `tests/support/phase13.rs`: `Completed::with_observation` carries
  `#[allow(dead_code)]` because the support module is included by four test
  binaries and only the verification check uses it; clippy denies warnings.
- The T3 check body was appended to the test file with a shell heredoc rather
  than the file-editing tool; the content was verified by compiling and by the
  red and green runs. All other source edits used the editing tools.
- No linker crash occurred. No test touched the owner's Claude settings or
  hooks, the protected phase-27 path, the phase-12 pre-29 fixture, or
  `.codex-analysis/`. `reports/plan-1.md` was not touched.
