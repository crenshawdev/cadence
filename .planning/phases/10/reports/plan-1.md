PLAN COMPLETE
Plan: .planning/phases/10/PLAN-1.md
Tasks: 8 of 8
Branch: cadence/binary-owns-process
Base: e5e4640e
Author for all commits: John Crenshaw <john@jcrenshaw.dev>
Signing key: 693AB15F91734B0C

| Task | Commit hash(es) | %G? | Verify command | Literal result |
|---|---|---|---|---|
| 1 — Resolve provider credentials | `494efa49d7f0cb9e008967514f7f061a70706b40` | G | `cat crates/cadence/src/review/mod.rs crates/cadence/src/review/provider/mod.rs crates/cadence/src/review/provider/credentials.rs`; `cargo check` | Source displayed; inspected environment precedence, three credential names, dotenv parsing, explicit/XDG/home fallback and no secret serialization. ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 3.70s``; exit 0. |
| 2 — Bound native transport | `8d47baa643747da571269fb94a43687cc2247202` | G | `cat crates/cadence/Cargo.toml crates/cadence/src/review/provider/transport.rs crates/cadence/src/review/provider/diagnostics.rs`; `cargo check`; inspect resolved reqwest entry in Cargo.lock | Source displayed; inspected native HTTPS, disabled redirects, total timeout, pre-append byte cap, exact-number feature and bounded shared sanitizer. Lockfile: `name = "reqwest"`, `version = "0.12.28"`, Rust TLS dependencies. ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 12.14s``; exit 0. |
| 3 — OpenAI durable empty review | red `60c80b341966248fe4b5354034887c5f218f01d0`; green `9f97fa32b0173b2b63bd81b2632f0d2ef328f055` | G / G | `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_empty_provider_result_is_usable -- --exact` | Red: `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 234 filtered out; finished in 0.02s`; exit 101. Green: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 234 filtered out; finished in 0.12s`; exit 0. |
| 4 — Retain fenced payload | `74d14317ed741d4cd1d7be192fc5b8c056b666a5` | G | `cat crates/cadence/src/review/provider/payload.rs crates/cadence/src/review/provider/delivery.rs`; `cargo check` | Source displayed; inspected retained bytes, compiled brief, fencing, UTF-16 estimate/cap, frozen settings/trigger effort, transformed view/digests, original entry/line mapping and MaterialDelivery. Initial ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.14s``; after completing label-redaction evidence, repeated the named verification: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.59s``; both exit 0. |
| 5 — Gemini adapter | `d89743886f1a43f3325067df9aa642dfd840dcc7` | G | `cat crates/cadence/src/review/provider/mod.rs crates/cadence/src/review/provider/gemini.rs`; `cargo check` | Source displayed; inspected reachable fixed-host generateContent, key header, recursive schema conversion, thinking level, candidate text and response modelVersion. ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.72s``; exit 0. |
| 6 — DeepSeek adapter | `fbffabdfa0f7197abe2396c1072d8eb3f5dd5f24` | G | `cat crates/cadence/src/review/provider/mod.rs crates/cadence/src/review/provider/deepseek.rs`; `cargo check` | Source displayed; inspected reachable Chat Completions, bearer auth, system/user messages, JSON-object mode with bare schema, minimal-to-low translation and observed response extraction. ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.71s``; exit 0. |
| 7 — Preserve unavailable usage | red `4408a71745846c63ce2fea3abaad5c906285f708`; green `e82a24043a56a12152d67bf1ba1ae9f780a6a611` | G / G | `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_invalid_usage_is_unavailable -- --exact` | Red: `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 235 filtered out; finished in 0.22s`; exit 101. Green: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 235 filtered out; finished in 13.69s`; exit 0. |
| 8 — Record observed provider identity | red `f98e6d980de7a166c764ee5d98951dce8e99a0b8`; green `c395fbadb958f9e3e437db157a7332a8b05f3879` | G / G | `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_provider_records_observed_identity -- --exact` | Red: `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 236 filtered out; finished in 0.31s`; exit 101. Green: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 236 filtered out; finished in 1.90s`; exit 0. |

Every commit passed the lease check. Every post-commit signature check printed G. No unexpected file deletions were present. The report remains uncommitted.

## Red-then-green evidence

P10-T4-C red: `60c80b341966248fe4b5354034887c5f218f01d0` (G). Failure at `phase10_provider_tests.rs:98:5`:

```text
assertion `left == right` failed: provider dispatch must be owned background work
  left: String("dispatch")
 right: "pending"
```

Green: `9f97fa32b0173b2b63bd81b2632f0d2ef328f055` (G), exactly one test passed. Reopened original: literal empty findings envelope, OpenAI voice, one accepted closure, no Gemini or local fallback issuance.

P10-T3-C red: `4408a71745846c63ce2fea3abaad5c906285f708` (G). Failure at `phase10_provider_tests.rs:234:13`:

```text
assertion `left == right` failed: input row 0
  left: Null
 right: Number(0)
```

Green: `e82a24043a56a12152d67bf1ba1ae9f780a6a611` (G), exactly one test passed. Recovered counts distinguish invalid/absent/valid zero, preserve valid input despite unavailable Gemini output, reject overflow and exact fractional lexemes, and bound/fence retained raw usage. The normalizer and dated Gemini omission contract were inspected.

P10-T1-C red: `f98e6d980de7a166c764ee5d98951dce8e99a0b8` (G). Failure at `phase10_provider_tests.rs:279:13`:

```text
assertion `left == right` failed: served identity for openai
  left: Null
 right: String("served-openai")
```

Green: `c395fbadb958f9e3e437db157a7332a8b05f3879` (G), exactly one test passed. OpenAI/Gemini/DeepSeek observed usage pairs are (11,5), (13,5), (17,7), with served response models; omitted model/usage stays unavailable for each provider. Requested alias/effort and native correlation references remain distinct from provider observations and provider-supplied IDs.

## Full-plan verification

Clippy: passed with no warnings. Command: `cargo clippy --workspace --all-targets -- -D warnings`. Literal completion: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 9.41s``.
Full suite: passed, exit 0. Command: `cargo test --workspace --no-fail-fast`. Run once after Task 8's green commit. Workspace target totals: **854 passed / 0 failed**, with 0 ignored tests, across 38 test binaries and the doc-test target. No repair or rerun was needed.

| Cargo target | Passed | Failed | Literal result |
|---|---|---|---|
| unittests src/lib.rs | 170 | 0 | `test result: ok. 170 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s` |
| unittests src/main.rs | 237 | 0 | `test result: ok. 237 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 126.65s` |
| tests/derivation_consistency.rs | 6 | 0 | `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s` |
| tests/derivation_inputs.rs | 12 | 0 | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/evidence_store.rs | 4 | 0 | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| tests/execution_boundary_compat.rs | 11 | 0 | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.75s` |
| tests/execution_store.rs | 18 | 0 | `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 277.43s` |
| tests/mcp.rs | 18 | 0 | `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.63s` |
| tests/next_action.rs | 7 | 0 | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase7_guard.rs | 23 | 0 | `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.60s` |
| tests/phase7_lease.rs | 23 | 0 | `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.80s` |
| tests/phase7_receipts.rs | 11 | 0 | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s` |
| tests/phase7_risk.rs | 22 | 0 | `test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.40s` |
| tests/phase7_surfaces.rs | 4 | 0 | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase8_config.rs | 6 | 0 | `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s` |
| tests/phase8_dispatch.rs | 24 | 0 | `test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s` |
| tests/phase8_global.rs | 12 | 0 | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase8_interview.rs | 40 | 0 | `test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase8_routing.rs | 44 | 0 | `test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.08s` |
| tests/phase9_admission.rs | 8 | 0 | `test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_binding.rs | 4 | 0 | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_consumers.rs | 7 | 0 | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_context.rs | 5 | 0 | `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_contract.rs | 31 | 0 | `test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_deferred.rs | 12 | 0 | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| tests/phase9_history.rs | 1 | 0 | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_inventory.rs | 3 | 0 | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_invoking.rs | 1 | 0 | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_material.rs | 14 | 0 | `test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_model.rs | 2 | 0 | `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_observations.rs | 3 | 0 | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_policy.rs | 11 | 0 | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_recovery.rs | 10 | 0 | `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_returns.rs | 7 | 0 | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| tests/phase9_selection.rs | 21 | 0 | `test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_specialist.rs | 3 | 0 | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_stream.rs | 2 | 0 | `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s` |
| tests/store.rs | 17 | 0 | `test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s` |
| Doc-tests cadence | 0 | 0 | `test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |

The main binary's tests also launched two internal child-process invocations. Their literal summaries are retained separately from the per-target aggregate:

```text
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 236 filtered out; finished in 0.02s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 236 filtered out; finished in 0.59s
```

Adding every printed summary, including those child invocations, yields 856 passed / 0 failed. The workspace target total above is 854 passed / 0 failed.
No full-suite run occurred during the eight tasks.

## Deviations

None.

## Open items

O1 remains not seen for phase 10. The documentation preserves the owner's phase-6 evidence verbatim and supplies the actual public admission/next/readback procedure. Phase-10 observer, time, project/run and fire/attempt references remain blank until the owner supplies them. O1 is an observation capped at concerns, not an automated pass. PLAN-2 remains responsible for failed-status accounting, enclosing operation deadlines and the failed-call/fallback portion of the shared live pilot; its work was not started.
