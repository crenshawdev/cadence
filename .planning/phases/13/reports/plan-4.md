# Phase 13 PLAN-4 execution report

Starting checkout: `/code/cadence`, `cadence/binary-owns-process`, HEAD
`09b3c0eb` (PLAN-3's close repair), clean tree apart from the three untracked
earlier executor reports. This report is intentionally uncommitted. All three
tasks are committed; clippy and the full workspace suite were run at the close.

All commits are authored by John Crenshaw <john@jcrenshaw.dev>, signed with
key 693AB15F91734B0C; `git log -1 --format=%G?` printed `G` after each.

## Tasks

| Task | Commit(s), signature | Named verification and literal result |
| --- | --- | --- |
| P13-4-T1 | red `459c60e3c8b4ba6f94f5e9bdf99ecf5e1c72d415`, G; green `4abb9da55a91cd31269ce39fb596c6d0fd9a58b9`, G | `cargo test -p cadence --test phase13_verification phase13_review_surface_selects_target_and_intent -- --exact`: red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 5 filtered out; finished in 6.69s`; green exit 0, `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 18.55s`. Exactly one function selected in both. |
| P13-4-T2 | red `743967fb653574f887c7749aa37c2d05c2442bc3`, G; green `8b0717cbc67871eebaba10c336fc1a84cfbab1bf`, G | `cargo test -p cadence --test phase13_verification phase13_audit_reports_broken_verification_traces -- --exact`: red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 6 filtered out; finished in 6.78s`; green exit 0, `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out; finished in 23.53s`. Exactly one function selected in both. |
| P13-4-T3 | `cea1f28c192d868995fd74167bb81f936263dc8c`, G | `cargo test -p cadence --test phase13_close phase13_adoption_copy_preserves_history_and_recovers -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 18.10s`. The recorded run's two uncaptured records are quoted in `reports/adoption-readiness.md`. |
| close repair | `99126c45fe8e36b244752d059f5ba9ad2d04cd68`, G | clippy findings from the close run; see "Plan-close quality". |

## Red evidence

P13-T6-C (task 1), at `459c60e3`: the completed native fixture built, then
the first selection call failed behaviorally at
`crates/cadence/tests/phase13_verification.rs:997`: the review subsystem had
no selection by kind and answered the unknown operation with its generic
refusal instead of the selection's own:

```text
assertion `left == right` failed: cad-review []: {"status":"refused","code":"invalid-review-operation","reason":"unknown variant `review-select`, expected one of `review-next`, `review-admission`, `review-material`, `review-original`, `review-attempt`, `review-roster`, `review-inventory`, `review-deferred`, `review-consumer`"}
  left: String("invalid-review-operation")
 right: "review-kind-required"
```

P13-T7-C (task 2), at `743967fb`: the shaped fixture published two plans
(plan 1 claiming T1, plan 2 claiming T2 and T7), executed both, and the first
audit failed at `crates/cadence/tests/phase13_verification.rs:1309` because the
audit returned no trace at all:

```text
assertion `left == right` failed: {"status":"refused","code":"invalid-plan","reason":"verification-audit is not implemented","rule":"verification-unavailable","slot":"operation","phase":13,"entry":null,"id":null}
  left: String("refused")
 right: "ok"
```

An earlier run of the same test text had failed one line earlier on a
transport-shape refusal (`unknown field command`); before committing the red
I made the helper omit the `command` key when none is named, so the recorded
red is the missing audit, not the missing field. Neither check's cases,
controls or expected values were changed after its red commit, with one
exception in task 1 noted under Deviations (the fixture's gate configuration
and the availability of range entries).

## Delivered behavior

- Task 1, review selection (D-133). `cadence_query review-select {command,
  arguments, replay_key?}` resolves `cad-review <kind> <target...>` or one of
  the three alias names into one canonical kind and one exactly resolved
  target, and answers with the target, the material identities (path, line
  span, digest), the compiled intent and the exact `review-admit` request to
  submit unchanged. `review/selection.rs` (EDIT; `select_next`,
  `dispatch_roster`, `delivery_completion` and `attempt_usage` untouched) adds
  `Kind`, `command_kind`, `decision_lines` (one `- <id>` bullet and its
  indented continuation, ambiguous when declared twice), `directory_members`,
  `phase_range` (first task attempt's base commit to the last close's
  completion commit), `plan_material` (the phase's approved CONTEXT.md and
  every native slice, each checked against its publication revision) and
  `select`. Missing input refuses `review-target-required` naming the
  argument shape; more than one candidate (`13` that is both a phase and a
  file, two tokens, a duplicated decision id) refuses `review-target-ambiguous`
  naming the choices (`file:`, `dir:`, `phase:` disambiguate); nothing found
  refuses `review-target-unresolvable`; nothing widens. A decision selection
  carries a `selection` binding (document, digest, lines) into the admission
  request; `review_service::validate_selection` re-reads the document and
  refuses a supplied paragraph that differs (`selected decision differs from
  the resolved document`). A plan-by-phase selection targets
  `inline-text` `plan:<n>`; `acquire_target` resolves the slices again through
  `plan_material` so the caller supplies no bytes. Minimalism keeps the
  base reviewer (`specialist::minimalism_selection`, no provider, no gate);
  plan uses caller `manual-plan`, trigger `plan` and the configured gate.
  `review/instructions.rs` (CREATE) holds the compiled intents; both
  `invoking::local_dispatch` and `provider::payload::prepare` call
  `instructions::intent(admission)`. `cadence review-instructions
  [--alias <name>]` renders `skills/cad-review/SKILL.md` and the three alias
  skills; the check asserts byte equality.
- Task 2, read-only audit (D-128, D-132). `verification/audit.rs` joins
  REQUIREMENTS.md active bullets and trace rows (with lines), ROADMAP.md
  declarations, the approved context, the native publications with the
  requirements they claim, the coherent map (items, associations, superseded
  revisions) and the current verification report (verdicts, waivers,
  history). One trace per requirement id seen anywhere: origins, edges
  `requirement->phase`, `phase->roadmap`, `phase->plan`, `plan->truths`
  (labelled `phase-scoped`), `truth->evidence`, `evidence->verdict`, each
  present or missing; truth rows with item origins; breaks with next
  actions; outcome broken / pending / unmet / concerns / waived / met. Rows
  assigned to other declared phases are `out_of_scope`; unknown plan
  requirements, orphan active requirements and absent phases stay visible.
  `verification-audit {phase, command?}` accepts `cad-audit` or the
  read-only alias `cad-coverage` and refuses anything else
  (`verification-audit`/`command`). `render::audit_text` renders the
  report. `cadence audit-instructions [--coverage]` renders
  `skills/cad-audit` and `skills/cad-coverage` (query-only tool list, no
  generation arm). The verifier PROTOCOL gained one sentence on the audit, so
  both verifier skills were regenerated in the same commit.
- Task 3, close. `close/readiness.md` is the reviewed procedure;
  `phase13_close::phase13_adoption_copy_preserves_history_and_recovers`
  hashes and copies the live `.planning` tree, backs it up, classifies all 30
  declared phases through the real binary (16 imported, 14 unavailable, 0
  native), lists unretained inputs, exercises `verify-next`, `execute-next`
  and `verification-audit` on the copy, checks first touch created only the
  four store files with every copied byte intact, drives two concurrent
  writers, interrupts three writes and recovers, restores from the backup to
  the same identity, checks the live tree unchanged, then runs the full
  native path (verify, complete, audit) on a separately authored fixture and
  prints `ADOPTION_COPY` and `ADOPTION_NATIVE`. `reports/adoption-readiness.md`
  records those results under their producers and subjects and leaves the
  orchestrator's sections (outer reruns, installed state, hook retirement,
  go/no-go) explicitly pending with the exact inputs owed;
  `reports/hook-retirement.md` gained the PLAN-4 handoff section and its
  installed section is unchanged and pending.

Unit tests added: `audit::tests` (active-line grammar, phase-cell parsing).

## Plan-close quality

- `cargo clippy --workspace --all-targets -- -D warnings` (stdin null), first
  run after task 3: two findings in `verification/audit.rs`
  (`cmp_owned` at :75, `redundant_closure` at :256). Fixed in `99126c45`; the
  second and last run was clean (`Finished dev profile`). Not run a third time.
- `cargo test --workspace --no-fail-fast` (stdin null): run once after the
  close repair. Exit 0. 49 `test result:` lines, every one `ok`; totals summed from cargo's
  output: **920 passed, 0 failed, 0 ignored** (the main unit target prints two
  child-test summaries of 1 passed each inside its 239-passed summary, so the
  distinct count is 918). Longest targets: `tests/execution_store.rs`
  (18 passed, 292.82s), lib unit tests (239 passed, 130.35s),
  `tests/phase12_execution.rs` (7 passed, 116.08s), `tests/phase13_verification.rs`
  (7 passed, 85.94s), `tests/mcp.rs` (18 passed, 44.04s; keeps both rendered
  verifier skills byte-equal to the binary), `tests/phase13_support.rs`
  (4 passed, 20.59s), `tests/phase13_close.rs` (2 passed, 18.10s). The harness
  moved the run to the background at its 600 s limit without killing it; the
  process ran to completion. No linker crash; nothing relaunched.

## Deviations

- Two source files were appended with a shell heredoc (`review/selection.rs`
  in task 1, the T7 check text was added with the editing tool) and several
  small replacements (`verification/mod.rs`, `model.rs`, `verification_service.rs`,
  `server.rs` wiring; three lines in `phase13_close.rs`; two clippy fixes in
  `audit.rs`) were applied with python string replacement instead of the
  editing tool. Every result was compiled and run; no content differs from
  what the tool would have written.
- Task 1, after the red commit, two test-side corrections that do not change
  any expected value: the delivery helper reads only `available` entries of
  a range manifest (a base-side entry for a file the phase added is absent
  by phase-9 design and reading it is an I/O error), and the plan gate is
  configured through the real `config-apply` operation instead of a stray
  write to `.planning/config.json` (the active repo layer is the migrated
  `config.v4.json`). The check still expects the configured `blocking` gate.
- Task 1, `Target::InlineText` was already declared by phase 9 and unused;
  it carries the plan-by-phase selection as `plan:<n>` because
  `review/model.rs` is outside this plan's lease and no new variant could be
  added.
- Task 3, the close regression's record initially carried whole legacy plan
  bodies (1.2 MB) and, through a shadowed local, the native fixture's audit
  instead of the copy's; both were corrected and the named command rerun
  before the recorded run. The three interruptions all observed the
  rollback branch (no write landed); the landed branch was not observed.
- The `## Active` section of the live REQUIREMENTS.md declares its ids in
  prose, so the copy's phase-13 audit has no in-scope trace (10 rows out of
  scope, 0 broken); this is recorded as observed.
- No linker crash occurred. No test touched the owner's Claude settings or
  hooks, the protected phase-27 path, the phase-12 pre-29 fixture, or
  `.codex-analysis/`. `reports/plan-1.md`, `plan-2.md` and `plan-3.md` were
  not touched. `review/model.rs`, `projections.rs`, `store/*` and every
  earlier phase's test are unchanged.
