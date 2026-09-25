PLAN COMPLETE
Plan: /code/cadence/.planning/phases/4/PLAN-3.md
Tasks: 5 of 5

| Task | Commit | Note |
|---|---|---|
| 1 — Encode the exact captured input key | 4280bfc3 | `derivation::tests::ac3` 1 passed and `::encoding_boundaries` 1 passed, 0 failed. 119 observation pairs distinguished, plus domain and version changes. Both negative controls fire: a SUMMARY-omitting encoder and a reason-omitting encoder each fail the shared assertions. Contributes AC3. |
| 2 — Compare typed memos with fresh answers | 36d0b0cb | `derivation::tests::memo_comparison` 2 passed, 0 failed. Every answer-field mutation under one unchanged key is rejected with its differing field named; malformed memo data likewise. Contributes AC4. |
| 3 — Guarded full-data update through the writer | bfa51ced | `--test store checked_snapshot` 1 passed and `import::tests::derivation_snapshot` 1 passed; full `--test store` 17 passed, 0 failed. Intervening writes, operation receipts, full data, provenance and the top-level import manifest all survive restart. Contributes AC4, D-06. |
| 4 — Compose the resident query and final recheck | 821e9fad | `derivation_service_tests::query_guards` 3 passed and `server::recall::tests` 17 passed, 0 failed. Cold and warm declaration conflicts, injected artifact changes, denials and stale publication all refused. An equal adopted hit still derives freshly and writes nothing. AC5-AC7 regression guards hold. |
| 5 — Prove persistence, exclusions, acknowledgement | 49c01c5b | `derivation_service_tests::ac4` 3 passed, `::ac3_exclusions` 2 passed, `::memo_ack` 2 passed, 0 failed. 20 writer-seeded corruption cases survive fresh-process reopen with byte-identical source and store files after refusal. **Discharges AC3 and AC4.** |

Deviations: one, and it is a correctness call rather than a shortcut. The
frozen numeric phase grammar can overflow binary64 to positive infinity.
`PhaseId` now serializes finite ids as JSON numbers and an overflowing id as
the explicit string `"Infinity"` (`crates/cadence/src/derivation/parse.rs:57`;
`model.rs:305`, `:314`), reproducing frozen `String(Number(x))` addressing.
Serializing it as JSON null would either lose an admitted identity or make it
indistinguishable from "no current phase". Documented at
`docs/architecture/derivation.md:52-59`.

Open items: none for this plan.

## Run details

Executed through Codex rather than `/cad-execute`, continuing the phase 2 and 3
vehicle. Starting HEAD `273ee780`. No checkpoint, no lease expansion, no
unsatisfied Verify gate, and no existing test weakened to make a new one pass.

**The two store additions the plan predicted were both necessary.** PLAN-3
Task 3 declared that the existing operations could not carry this work, and the
code confirmed it:

- `ReadVerified` was added because ordinary `Operation::Read` returns cached
  `View` data before revalidation (`crates/cadence/src/store/writer.rs:192`), so
  a memo comparison against it could read stale bytes.
- `CompareRewriteSnapshot` was added to check generation and integrity on the
  writer thread rather than trusting a caller's earlier observation.
- `Session::derivation_view` and `commit_derivation` were added because ordinary
  snapshot replacement wraps data under `data.current` and retains only the
  import manifest at the top level (`crates/cadence/src/import/mod.rs:402`).
  Sending a full-data memo through that wrapper would have relocated cursor and
  provenance.

This is exactly what the plan told the executor to check first rather than
assume, and the assumption would have been wrong in all three places.

The acknowledgement guarantee inherited from phase 3 was re-proven here rather
than taken on trust: `memo_ack` holds the caller pending while confirmation is
withheld, refuses success under either injected `fsync` failure, and shows the
installed-but-unacknowledged generation recovering on restart.

## Final suite and repository evidence

Independently re-run after the dispatch returned, not taken from its report:

- `cargo test --workspace` - **148 passed, 0 failed**: library 34, binary 65,
  `derivation_consistency` 6, `derivation_inputs` 12, MCP 4, store 17, crash 10.
  All 132 that existed after PLAN-2 still pass; this plan added 16. The AC8
  syscall-ordering test from phase 3 passes, so `strace` remains available here.
- `cargo clippy --workspace --all-targets -- -D warnings` - **exit 0**.
- `rg -n 'Mutex|RwLock|OnceLock|LazyLock|flock|F_SETLK|\.lock\(' crates/cadence/src/store`
  - no matches, exit 1. This plan edited `store/writer.rs` and the store still
  holds zero lock primitives.
- `git diff --exit-code v3.7.12 -- cadence-core/` - **exit 0**, byte-identical.
- Lease exact: 15 files declared in PLAN-3's frontmatter, the same 15 changed.
- All five commits GPG-signed `G` with key `693AB15F91734B0C`, authored
  `John Crenshaw <john@jcrenshaw.dev>`. No AI attribution anywhere.
- Working tree clean.
