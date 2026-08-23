---
phase: 2
status: complete
completed: 2026-08-23
---

# Phase 2: The read-back gate - Summary

`planning.mjs cite-count` counts, per item, what the recall pass surfaced against
what the produced plan cites, `/cad-plan` runs it at both of its points and reports
a plan that cited none of a non-empty set, and the three readings a count alone
cannot separate - backend off, surfaced nothing, cited nothing - are distinct on the
record.

## What shipped

- The surfaced-side reader, own-phase scoped and kinded - `cadence-core/bin/lib/cite-surfaced.mjs`
- The cited-side reader, bare and phase-qualified `D-NN` mentions - `cadence-core/bin/lib/cite-cited.mjs`
- The `cite-count` subcommand and its envelope, with `--point` and the `memory.backend` third state - `cadence-core/bin/planning.mjs`
- Its own `outcome`-family `cite_count` trace event, written in code, with `{written, reason}` on the envelope - `cadence-core/bin/planning.mjs`
- Both count points wired into `/cad-plan` (`count_planned`, `count_committed`) plus the under-threshold `inline_plan` arm - `cadence-core/workflows/plan.md`
- The `done` report's `Citations:` line, which names the zero case in words and does nothing about it - `cadence-core/workflows/plan.md`
- A scratch-path guard at every site that carries an echoed `mktemp` directory into a later shell command - `cadence-core/workflows/plan.md`, `cadence-core/references/review-triggers.md`, `cadence-core/references/triage-gate.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 75269066 | The surfaced set, own-phase scoped and kinded |
| 1 | 2 | ee6738e0 | The cited mentions, bare and phase-qualified |
| 1 | 3 | bfd2180a | The `cite-count` subcommand and its envelope |
| 1 | 4 | 67288e98 | The `memory.backend` third state on `cite-count` |
| 1 | 4b | 696fd59f | One reader for `memory.backend`, not one per command |
| 1 | 5 | c96796bb | The seam's stated behavior, at the CLI |
| 2 | 1 | a234348e | The count records itself in the run record |
| 2 | 2 | 22eede36 | The surfaced set reaches disk as this run's payload |
| 2 | 3 | b0eaab6b | Both count points, advisory at each |
| 2 | 4 | 2eea242c | The under-threshold path counts too |
| 2 | 5 | b419b399 | The report names the zero case, and does nothing about it |
| 2 | 6 | ba076f30 | Re-pin the weight budget and the seam-call census |
| 2 | gate | 054fa9a0 | The carried scratch path refuses what it cannot survive |
| 3 | 1 | 86ad92c4 | Three runs, told apart by their records alone |
| 3 | 2 | 1341e111 | The subcommand block names the write it makes |

## Deviations

- [deviation] Plan 1, task 3: the task's `Verify:` demanded 0 failures from
  `arg-contract.test.mjs`, but that file pins the flag table's total entry count at
  170 and the three new `cite-count` rows move it to 173 - a criterion unachievable
  inside the plan's declared lease, which did not name the file. The executor
  returned a `structural` checkpoint; the user approved widening the lease, the pin
  reads 173, and the whole-tree run went from exactly one failure to none.
- [deviation] Plan 1, task 4b: task 4's inlined `mergeLayers` call pushed
  `self-verify.test.mjs`'s callsite census to 16 over its pin of 15, and that file is
  outside the lease. Rather than checkpoint for a second re-pin, `cmdRecall` and
  `cmdCiteCount` were given one shared `memoryBackend(dir)` reader - the census
  returns to 15, and the off switch cannot come to mean two things at two seams.
- [deviation] Plan 2, task 5: the task's `human-verify:` clause asks for a live
  `/cad-plan` run, which the HOST executes and an executor cannot invoke. The
  mechanical half was completed and asserted against a constructed zero-citation
  fixture; the session half is the first open item below.
- [deviation] Plan 2, gate: the `risk_surface` review raised one `high` against
  `workflows/plan.md:305` - an echoed `mktemp` scratch directory pasted into a later
  command as a literal, injectable through `$TMPDIR`. It was ruled `survived` rather
  than downgraded and fixed at `054fa9a0` across all three sites carrying the
  pattern, two of which predate this phase. The narrowed round-2 re-fire over the
  fix's own diff returned zero findings.

## Open items

- HUMAN-VERIFY (plan 2, task 5): run `/cad-plan` on a live phase whose plan cites
  zero of a non-empty surfaced set and confirm in-session that the `done` report's
  `Citations:` line names both counts and says the zero case in words, that
  `git diff --stat` shows the plan file's bytes unchanged by `count_planned`, and
  that the run's `trace.jsonl` holds exactly ONE `lifecycle`/`dispatch` for
  `cad-planner`. The seam-side comparand is already measured at `ba076f30`.
- `lib/arg-contract.mjs`'s header still says the test walks "all 156" flag rows; the
  table now holds 173. The count was stale before this phase and was deliberately
  left out of the tasks.
- On the `memory.backend: none` arm a `--payload` that IS passed is read by nobody
  and nothing on the envelope says so. Left silent deliberately - `cmdRecall`
  ignores its query on the same arm, and a field saying "payload ignored" is the
  fourth field D-06 forbids.
- A hand-written `_archive-v*/<N>/CONTEXT.md` row carries no `phases/<n>/` segment,
  so it reaches `surfaced` as AC2 requires but is unjoinable. Stated bound, not a
  gap: widening it to "any numeric segment" would join `v2/1/CONTEXT.md` to phase 2
  or phase 1 depending on which end it read from.
- DECLINED a prose-compression pass over `workflows/plan.md`. Tasks 2-5 added
  6,406 B and roughly 1.3 KB of that is the carried-literal rule and the advisory
  restated at three sites. Every one is named by a task `Action`. The lean form, if
  a later task states it: state the carried-literal rule once at `spawn_planner` and
  let both count steps cite it.
- Plan 3's task 2 premise did not hold - nothing was red on arrival, because plans 1
  and 2 closed the five drift surfaces as they went. The fix it actually landed was
  a prose-vs-code disagreement no linter watches: `self-verify` walks `mdFiles(root)`
  only, so `planning.mjs`'s own header block is unlinted prose.

## Goal check

The phase goal is delivered, and the strongest evidence is the seam running against
this repository rather than a fixture: `planning.mjs recall` returned 5 results
(`total: 184`), and `cite-count --phase 2 --point committed` over that envelope
answered `surfaced.count: 4`, `cited.count: 0`, `cited.ids: []`, with
`cited_by_kind` separating the one joinable `decision` arm from the `capture`,
`deviation` and `uat` arms marked `unjoinable: true` - so the Core Value's claim now
has a number behind it, and the number for this very phase is zero of a non-empty
set. The three-state separation is asserted rather than assumed: plan 3's
`planning.test.mjs` case constructs all three runs, strips `corr` and `ts`, and runs
the pairwise `notDeepStrictEqual` BEFORE any per-state check, and its falsifier
(deleting the `backend: 'none'` spread) fails exactly that one test with the message
naming the collapse (`reports/plan-3.md`, task 1). What is NOT yet evidenced is the
workflow wiring end to end: the two count points and the report line were verified
against a constructed fixture and by census regex, never by a live `/cad-plan` run,
because an executor cannot invoke a host command - that is the first open item, and
it is the one claim in this summary a verifier should treat as unconfirmed. Whole
tree at `1341e111`: `node cadence-core/bin/test.mjs` 2842 pass / 0 fail,
`self-verify --root .` `ok:true` with `problems: []`, `npx tsc -p tsconfig.ci.json`
exit 0.
