# Phase 13 PLAN-3 execution report

Starting checkout: `/code/cadence`, `cadence/binary-owns-process`, HEAD
`5082bf2d` (PLAN-2's task 2 green), clean tree apart from the two untracked
earlier executor reports. This report is intentionally uncommitted. All five
tasks are committed; clippy and the full workspace suite were run at the close.

All commits are authored by John Crenshaw <john@jcrenshaw.dev>, signed with
key 693AB15F91734B0C; `git log -1 --format=%G?` printed `G` after each.

## Tasks

| Task | Commit(s), signature | Named verification and literal result |
| --- | --- | --- |
| P13-3-T1 | red `7a337777cb1ae690dca36c97dc6f5bb5b1f657e5`, G; green `1589adfbffc0957bb12088ed2379f149bb88ed7c`, G | `cargo test -p cadence --test phase13_verification phase13_owner_waiver_is_distinct_from_met -- --exact`: red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 3 filtered out; finished in 11.23s`; green exit 0, `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 56.04s`. Exactly one function selected in both. |
| P13-3-T2 | `b402ebf46464b932972a113130191f73c3f065d7`, G | `cargo test -p cadence --test phase13_support phase13_human_results_preserve_first_pass -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 10.35s`. |
| P13-3-T3 | `a95b282407a1750171c279043e3dc9649236a998`, G | `cargo test -p cadence --test phase13_support phase13_publication_seeds_only_missing_trace_rows -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.91s`. |
| P13-3-T4 | `4568642796f4842ee863389ac0268cec0b4d7a1e`, G | `cargo test -p cadence --test phase13_support phase13_completion_projection_transaction_recovers -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 21.08s`. |
| P13-3-T5 | red `b2c1da4e6c93caf9fb623de31ed0651eb302f4d3`, G; green `8588090746b8fbe150c1ab923e52b14dfd5f8d6d`, G | `cargo test -p cadence --test phase13_verification phase13_incomplete_verification_cannot_complete_phase -- --exact`: red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 4 filtered out; finished in 17.34s`; green exit 0, `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out; finished in 40.97s`. Exactly one function selected in both. |
| close repair | `09b3c0eb39bb8128ccbf99da071d7da163c3b37b`, G | clippy findings from the close run; see "Plan-close quality". |

## Red evidence

P13-T4-C (task 1), at `7a337777`: the fixture completed execution, a real
patch rejecting `check/B` was submitted, and the first assertion of the check
failed at `crates/cadence/tests/phase13_verification.rs:543`:

```text
assertion `left == right` failed
  left: Null
 right: Object {"met": Number(1), "concerns": Number(0), "unmet": Number(1), "pending": Number(0), "waived": Number(0)}
```

The report carried no waived-beside-met distinction and `truth-waive` was the
PLAN-1 "unavailable" stub: missing production behavior, not a setup failure.

P13-T5-C (task 5), at `b2c1da4e`: publication, execution, an open attempt and
a partial verdict were all refused as the check expects (the completion
operation from task 4 already existed), then the assertion at
`crates/cadence/tests/phase13_verification.rs:793` failed:

```text
assertion `left == right` failed
  left: [{"kind":"truth","id":"truth/B",...,"items":[{"id":"check/B","verdict":"rejected"}]}]
 right: [{"kind":"truth","id":"truth/B",...}, {"kind":"human","id":"1","status":"fail","source":"imported","first_pass":"fail"}]
```

The refusal did not name the unfinished imported human failure, and (later in
the same function) the lifecycle still derived completion from SUMMARY/UAT.
Both are missing production behavior. Neither check's cases, controls or
expected values were changed to pass; one handwritten expectation in T5 was
corrected after the green run showed the lifecycle answer `phase-not-current`
(phase 13 complete, phase 28 current) where I had guessed `outcome: complete`,
and a whole-tree equality after a lifecycle query was narrowed to the
projections, human material and completion authority because such a query
records its own refusal and memo (bookkeeping, not completion).

## Delivered behavior

- Task 1, `verification/waivers.rs`: `truth-waive` is an owner-only event
  (waive, reaffirm, revoke) bound to a truth version, the exact current basis
  and the reviewed attempt/patch. Refused: unapproved, mismatched or
  unattributed approval, blank reason/name/date, stale basis field, a truth
  not in the basis or met, an orphan supersession, a duplicate waiver. Records
  are immutable; refusals are not retained. `verification-read` overlays
  effective waivers as `status: waived` with `derived`, `waiver` and the
  rejected items kept, adds `counts`, `waivers` (with effectiveness reasons),
  `advice` ("revisit the plan" past one waiver) and the rendered lines. A
  waiver is effective only against the attempt it reviewed; a later patch or
  changed basis needs owner reaffirmation. Writer/transaction: claim detection
  generalised (`verification_claim`), `IntentKind::VerificationWaiverV1`,
  shared `validate_claim_transition`, commit/recovery reobservation.
- Task 2, `verification/human.rs`, `projections.rs`: `verification-human-result`
  with exact approval, phase/occurrence/root provenance, immutable reply chain
  (`supersedes` must name the latest record), `first_pass` carried from the
  imported original or first native result, blank reply refused, skipped
  never resolves. The first native write retains the caller-owned UAT.md
  verbatim in `verification.uat_originals`; UAT.md is rendered as original
  plus `## Native human results` and installed in the same transaction as the
  `phase-uat:N` participant against the observed preimage; a hand-edited
  render refuses. Guard protects `phases/N/UAT.md`. The report lists `humans`.
- Task 3: publication seeds `| id | Phase N | Pending |` for declared ids that
  have an `## Active` bullet and no `## Traceability` row, appended after the
  last row, in the publication transaction as the `requirements` participant;
  `IntentKind::PlanPublication` gained a versioned optional `requirements`
  field so old intents reconstruct unchanged. No file, no table or no active
  bullet seeds nothing; a non-file preimage refuses before anything installs.
- Task 4, `verification/completion.rs`: `verification-complete` requires the
  current basis, the current complete patch, every truth met or effectively
  waived, every required human result resolved, and the caller's projection
  preimage digests; refusals name the first unfinished item with the full
  `unfinished` list. It records `verification.completions` (label
  `complete`/`complete-with-waivers`, authority digest, truths, humans,
  projections) and installs `- [x]` on the phase line and `Complete` on the
  phase's declared trace rows in one transaction; unmatched, repeated or
  already-complete declarations refuse. `inputs::source_accounting` treats a
  tracked projection whose working bytes equal the installed bytes as HEAD's,
  so the transaction's own install is not a source change (exercised with
  tracked `.planning/ROADMAP.md` and `REQUIREMENTS.md`).
- Task 5, `derivation`: `AcceptanceOverlay` observed from the store snapshot
  (native phases: published, executed via admissions/history, applicable
  completion with met/waived counts, disagreement reason); `derive_with`
  replaces SUMMARY/UAT for native phases; `derive` keeps the legacy table;
  `prepare_query` reads the overlay beside the artifacts, `recheck` compares
  it, `checked_query` and `checked_execution` compare it with the owned view
  and use `input_key_with` (legacy key unchanged when the overlay is empty).
  Completion applicability excludes source: later commits do not uncheck a
  completed phase; a later publication makes it inapplicable and the
  lifecycle names `ROADMAP.md:<line>` as the disagreement.

Unit tests added: projection grammar (`projections::tests`), roadmap and
requirement renders (`completion::tests`), imported item grammar
(`human::tests`), overlay derivation and memo key (`derivation::overlay_tests`).

## Plan-close quality

- `cargo clippy --workspace --all-targets -- -D warnings` (stdin null), first
  run: three findings in my code (`too_many_arguments` in
  `store/transaction.rs`, `filter_next` in `waivers.rs`, `needless_range_loop`
  in `projections.rs`). Fixed; second run found one further finding in my T4
  test text (`useless_format` at `tests/phase13_verification.rs:631`), which
  the first run could not reach because the library failed first. Fixed in
  `09b3c0eb` and NOT run a third time, as the dispatch requires; the fix is
  the literal replacement clippy printed. The library, binary and all other
  targets were clean on the second run.
- `cargo test --workspace --no-fail-fast` (stdin null): run once after the
  close repair, exit 0. 49 `test result:` lines, every one `ok`; totals
  summed from cargo's output: 915 passed, 0 failed, 0 ignored. The harness
  moved the run to the background at its 600 s limit without killing it; the
  process ran to completion. Longest targets: `tests/execution_store.rs`
  (18 passed, 298.62s), `tests/phase12_execution.rs` (7 passed, 121.74s),
  `tests/phase13_verification.rs` (5 passed, 87.83s); `tests/mcp.rs`
  (18 passed, 45.32s) keeps both rendered verifier skills byte-equal to the
  binary. No linker crash; nothing relaunched.

## Deviations

- Edits: the T4 and T5 check bodies, the three support regressions, the
  support helpers and the unit-test modules were appended with shell heredocs,
  and four small multi-line replacements (status.rs report, writer.rs plan
  intent wiring, query.rs overlay fields, completion.rs claim fields) were
  applied with a python string replacement; every other edit used the editing
  tools. One python replacement left a malformed match arm in completion.rs
  that `cargo check` caught and the editing tool repaired.
- Human item identity: imported UAT items are addressed by their item number
  (`### N.`), native items by the caller-supplied id; an imported pass is
  classification only (neither required nor adopted), an imported fail,
  pending, blocked or skipped item is unfinished human work until a native
  passed result supersedes it. Before any native write, the on-disk document
  is read for classification; after the first native write, the retained
  original is the authority.
- Completion applicability for lifecycle deliberately excludes the source
  identity (see completion.rs doc comment); verification readback keeps the
  full basis including source.
- Guard: `protected_target` was extended for `phases/N/UAT.md` only.
  ROADMAP.md and REQUIREMENTS.md remain shared documents the binary changes
  narrowly through the completion and publication transactions; protecting
  the whole files would claim more than the binary owns.
- Task 4's "interrupt/reopen": the server is SIGKILLed after the completion
  request is sent, up to three times, and the reopened store is asserted to be
  wholly confirmed or wholly unconfirmed each time; the race outcome is not
  controlled, so the positive control then follows normally. No fault
  injection was added to the binary.
- The task-2 regression's first expectation was revised in task 5 (the
  report now classifies an unretained historical document instead of listing
  nothing), consistent with the T5 red.
- No linker crash occurred. No test touched the owner's Claude settings or
  hooks, the protected phase-27 path, the phase-12 pre-29 fixture, or
  `.codex-analysis/`. `reports/plan-1.md` and `plan-2.md` were not touched.
