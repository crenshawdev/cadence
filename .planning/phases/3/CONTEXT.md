# Phase 3: The machinery that still assumes one report - Context

Gathered: 2026-08-20
Feeds: /cad-plan 3

## Scope boundary

In: The two seams that still assume the pre-rotation shape stop misreporting.
Concretely: `cmdRiskCheckRun` mints a positive EMPTY state from an empty diff
body (`cadence-core/bin/planning.mjs:3943-3998`, `cadence-core/bin/lib/risk-diff.mjs:303-308`);
`cmdRiskCheckStatus` admits that state through its existing `recorded` arm
(`planning.mjs:4438`, `:4473-4486`); `cmdLeaseCheck`'s single-report exemption
widens to the rotated-name grammar for the same `k` (`planning.mjs:2448-2465`),
consulting `cadence-core/bin/lib/report-rotation.mjs` rather than carrying a
second regex; plus the tests that pin all of it and a UAT transcription of the
live `--rerun` demonstration.

Out: Prose control-flow edits. D-05 keeps the fix entirely in the two seams -
`workflows/execute.md:284-316` reads `matches`/`inconclusive` from the envelope
and then calls `risk-check status`, so both inputs come from the fixed seams,
and `workflows/task.md:73-105` inherits the fix for the `--phase 0` path with no
edit at all. If any prose does move, D-10 applies.

Out: Splitting `inconclusive` into its causes. `risk-check`'s `inconclusive` is
a bare boolean that does not say which half made it true - a binary file, a body
with no readable hunk, or a gitlink - and a `git diff` that THROWS (maxBuffer,
a broken object) writes the same `checked:false, inconclusive:true` as a diff
that simply had nothing in it. D-01 separates EMPTY from that pair and leaves
the pair itself fused; the capture-queue `[latent]` note stays live.

Out: Repairing the receipt join. 47 of 104 outcome receipts carry no `trigger`
and `planning.mjs:4359` drops every one, including the two `gate_pass` events
written during the deadlock this phase owns. D-11 routes around that hole rather
than fixing it - the live re-run must pass by NOT firing, never by inheriting
those receipts.

Deferred: None.

Plan shape: one plan. Two seams in one file, no prose edits under D-05, and the
lease half is an exemption widening plus a regression pin.

## Durable decisions

- D-01 (The empty test): EMPTY is decided from the DIFF BODY being empty and
  written as a positive field on the record - never inferred from
  `base_id === head_id`. Rejected: comparing the resolved ids and
  short-circuiting before the diff read, which is simpler and needs no new
  field, but covers only the literal same-commit case; a revert pair or a
  whitespace-only revert has `base_id !== head_id` with zero net diff and would
  still deadlock, so criterion 3's live demo would pass while the defect class
  survived. Measured 2026-08-20: a same-commit range and a two-commit revert
  pair produce BYTE-IDENTICAL records today (`checked:false, matches:[],
  inconclusive:true`).
  Evidence: `cadence-core/bin/lib/risk-diff.mjs:303-308` (`!text.trim()` is the
  only branch reaching `checked:false` on a successful read);
  `cadence-core/bin/planning.mjs:3943-3962`, `:3978-3998`.

- D-02 (The record shape): An empty range answers `checked: true`,
  `inconclusive: false`, `matches: []`. Reading a zero-byte diff IS a completed
  check, so `checked:false` narrows to "there was no diff to read at all". This
  CORRECTS the roadmap's stated diagnosis: the refusal does not come from the
  inconclusive predicate at all. `cmdRiskCheckStatus` computes
  `usable = found.filter((f) => f.checked)` at `:4438`, BEFORE the
  `fired`/`inconclusive` predicate at `:4465` is ever consulted - so clearing
  `inconclusive` alone changes nothing at the gate and AC2 stays red with the
  run-side fix apparently in place. Rejected: keeping `inconclusive: true` and
  adding an independent `empty: true`, which is more honest that the seam judged
  nothing but forces a third clause (`inconclusive && !empty`) into a fire
  predicate stated identically at three prose surfaces measured at 3, 0 and 0
  bytes of budget headroom, plus status's own `fired` predicate.
  Evidence: `cadence-core/bin/planning.mjs:4438`, `:4465`;
  `cadence-core/bin/lib/risk-diff.mjs:296-298`, `:345-348`;
  `cadence-core/workflows/execute.md:292`; `cadence-core/workflows/task.md:86`;
  `cadence-core/references/review-triggers.md:526-528`;
  `cadence-core/bin/prose-agreement.test.mjs:944-961`.

- D-04 (The status state): An empty range reports through the EXISTING
  `recorded` state rather than a new state string. `cmdRiskCheckStatus` computes
  its refusal as `rows.filter((row) => row.state !== 'recorded')` at `:4486`, so
  a fifth state name not added to that filter is an automatic `ok:false` - AC2
  goes red while the row output looks correct. Rejected: an `empty` state with
  the filter and the two hint arms widened, which reads better for an auditor
  but leaves two readers to keep in step and leaves `risk-fire-missing` /
  `risk-record-missing` naming a step that is not missing.
  Evidence: `cadence-core/bin/planning.mjs:4473-4478`, `:4486`, `:4494-4513`.

- D-06 (The exemption's bound): The exemption becomes `plan-<k>.md` plus the
  rotated-name grammar `plan-<k>.<n>.md` for THAT `k` only - never a directory
  lease, and never another plan's report. A directory lease would swallow
  `plan-<k>-risk.diff` and `plan-<k>-risk-task-<n>.diff`, letting a blocking
  gate's own flagged evidence ride into a task commit; phase 2's D-06 chose its
  record location specifically because this exemption stays bounded.
  Evidence: `cadence-core/bin/planning.mjs:2448-2465`, `:4859-4861`;
  `cadence-core/bin/planning.test.mjs:5607-5616` (the existing pin that
  `plan-2.md` stays `undeclared-files` for plan 1).

- D-08 (Case): The exemption stays byte-exact on the canonical lowercase
  spelling and does NOT adopt `rotationTarget`'s case-insensitive matching. The
  case-insensitivity there exists only so the SCAN cannot overwrite an
  existing file; the name PRODUCED is always canonical lowercase, and the
  staged side is not re-normalized on its way in. If wrong: a staged
  `PLAN-1.1.MD` that no executor produced is exempted, widening a
  parallel-safety gate in the direction a lease gate must not move.
  Evidence: `cadence-core/bin/lib/report-rotation.mjs:121-129`;
  `cadence-core/bin/planning.mjs:2460-2463`;
  `cadence-core/references/plan-frontmatter.md:239`.

## Decisions

- D-03 (Back-compat): The reader tests the new empty field with `=== true`,
  exactly as it does `checked` and `inconclusive`, so records already on disk
  cannot read as empty. Measured 2026-08-20: 69 `outcome/risk_check` events in
  `.planning/trace.jsonl` already carry the old shape.
  Evidence: `cadence-core/bin/planning.mjs:4306-4309` ("an absent verdict is not
  a passing one").

- D-05 (No prose arm): `workflows/execute.md`'s risk arm gets no control-flow
  change; the fix lands entirely in the two seams. `execute.md:284-316` reads
  the envelope's `matches`/`inconclusive` and then calls `risk-check status`,
  and `task.md:73-105` carries the same predicate for the `--phase 0` path and
  inherits the fix without an edit. If wrong: a coordinator reading the empty
  envelope may still hand-fire the blocking review out of caution, reproducing
  the deadlock with the seam already fixed - which is why AC3 is judged on a
  live run rather than on the seam's output.
  Evidence: `cadence-core/workflows/execute.md:284-316`;
  `cadence-core/workflows/task.md:73-105`.

- D-07 (One statement of the grammar): The rotated-name grammar is stated once,
  in `cadence-core/bin/lib/report-rotation.mjs`, and `cmdLeaseCheck` consults it
  rather than carrying a second regex - the rule `planning.mjs:2452-2458`
  already states for exactly this situation ("a second copy here is exactly how
  the two seams came to disagree"). The subtle half is the anchor: the trailing
  `.md` and the dot are what keep `plan-11.md` from reading as plan 1's rotation
  1. The module is pure, takes no CONTRACTS row and no CLI entry (phase 1 D-01 /
  D-02), so consulting it adds no seam surface.
  Evidence: `cadence-core/bin/planning.mjs:2452-2458`;
  `cadence-core/bin/lib/report-rotation.mjs:43-47`, `:104-113`;
  `.planning/phases/1/SUMMARY.md:16-18`.

- D-09 (AC6 is a pin, not new logic): The flagged diffs are already refused and
  stay refused; AC6 is a regression pin over existing behaviour. Measured
  2026-08-20 in a scratch repo: rotation stages as `A plan-1.1.md` +
  `M plan-1.md`, NOT as a rename pair, so the both-sides-of-a-rename handling at
  `planning.mjs:2442-2446` is not the load-bearing path and the destination
  needs its own exemption. `staged` is counted at `:2471` BEFORE the exemption
  filter, so widening the exemption moves no reported count.
  Evidence: `cadence-core/bin/planning.mjs:2442-2446`, `:2471`.

- D-10 (Budget obligation): Any prose edit to a surface this phase touches
  re-pins `weight-budgets.json` in the same commit - none has usable headroom.
  Measured 2026-08-20 with `node cadence-core/bin/weight.mjs --root .`:
  `workflows/execute.md` 29215 B against budget 29218 (3 B free);
  `references/review-triggers.md` 39268/39268; `workflows/task.md` 7822/7822;
  `references/worktree-executor.md` 3941/3941;
  `skills/cad-executor-contract/SKILL.md` 12458/12458 - the last four at zero.
  The check is a ceiling, not an equality.
  Evidence: `cadence-core/bin/self-verify.mjs:706-743`;
  `cadence-core/bin/weight-budgets.json`.

- D-11 (Where AC3's evidence lives): The live `--rerun` demonstration is
  transcribed into `UAT.md`, because the only machine record of it is not in the
  repository. `.planning/trace.jsonl` is gitignored (`.gitignore:29`), and the
  two `gate_pass` events written during the observed deadlock carry no `trigger`
  field, so `planning.mjs:4359` (`if (e.trigger !== RISK_TRIGGER) continue`)
  drops both - they can never settle anything, and the re-run must pass by NOT
  firing rather than by inheriting them.
  Evidence: `.gitignore:29`; `cadence-core/bin/planning.mjs:4359`;
  `.planning/phases/2/CONTEXT.md` (flagged assumptions).

## Acceptance criteria

- [ ] AC1: `risk-check run` over a range whose DIFF BODY is empty writes a
      record carrying the positive empty field with `checked:true`,
      `inconclusive:false`, `matches:[]`; a revert pair whose `base_id` differs
      from its `head_id` but whose net diff is empty reads the same way; and a
      range whose diff read FAILS still writes `checked:false,
      inconclusive:true`. Tests pin all three cases.
- [ ] AC2: `risk-check status` over that empty record returns `ok:true` with the
      row's state `recorded`, where today it refuses `risk-record-missing`;
      reverting the run-side fix reddens the test. A record written under the old
      shape, carrying no empty field, does NOT read as empty.
- [ ] AC3: `/cad-execute <N> --rerun` against a phase whose tasks are all
      already satisfied runs to completion with no user override of a blocking
      gate, and the run's outcome is transcribed into `UAT.md`.
      (human-verify: needs a live /cad-execute run)
- [ ] AC4: An unjudged non-empty range still fires the gate: a range that
      CONTAINS commits but whose diff cannot be read still answers
      `inconclusive: true` and still fires, proven by a test that keeps that arm
      green.
- [ ] AC5: `lease-check` exempts a rotated report - staging `plan-<k>.<n>.md`
      alongside `plan-<k>.md` during a task commit returns no `undeclared-files`
      - and the test fails against the current byte-equality exemption. Staging
      `plan-2.md` or `plan-11.md` under plan 1's lease still reports
      `undeclared-files`.
- [ ] AC6: The exemption stays bounded: staging `plan-<k>-risk.diff` or
      `plan-<k>-risk-task-<n>.diff` still reports `undeclared-files`, and a
      staged `PLAN-1.1.MD` is not exempted.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with an empty `problems` array, with any weight-budget row re-pinned in the
      same commit as the prose edit that moved it; the rotated-name grammar has
      exactly one statement (`cadence-core/bin/lib/report-rotation.mjs`), with no
      second regex in `cmdLeaseCheck`.

## Flagged assumptions

- The roadmap's diagnosis of the deadlock names the wrong arm - Confident; if
  wrong: nothing, but a fix aimed at `inconclusive` alone leaves AC2 red with the
  run-side change apparently in place. `risk-check status` refuses at
  `planning.mjs:4438` on `checked`, before `:4465`'s `fired`/`inconclusive`
  predicate is consulted. D-02 is written against the operative arm.
- The recalled note that "`risk-check status` refuses a fired range with no
  receipt" describes a DIFFERENT arm from the one that deadlocks - Confident; if
  wrong: a fix aimed at the receipt join leaves AC2 red. The empty-range refusal
  is `risk-record-missing` via `state:"unchecked"` (`:4438`, `:4494-4500`); the
  recalled snippet (`v3.5.3/phases/1/UAT.md`) describes the `unfired` arm at
  `:4465-4472`, which an empty record never reaches.
- Phase 1's override flag appears to have landed as `--rerun`, taken from the
  roadmap's own criterion 3 wording rather than from a read of the shipped
  `execute.md` - Likely; if wrong: AC3's command is spelled wrong and the live
  demonstration cannot be run as written. Phase 1's CONTEXT left the spelling to
  the planner. Planner should confirm against `skills/cad-execute/SKILL.md`'s
  `argument-hint` before writing the task.
- This phase carries no seeded requirement id - `.planning/REQUIREMENTS.md`
  `## Active` still reads "No cycle open" while three phases exist and two have
  shipped - Confident; if wrong: nothing, but `/cad-audit` will find this phase
  orphaned in the requirement-to-phase direction, exactly as phase 2 flagged.
  Left uncorrected here: this phase serves no row, and the workflow permits
  correcting only a row the phase serves.
- Whether the empty field's absence should be distinguishable from a diff read
  that BLEW `RISK_DIFF_MAX_BUFFER` is left open - Likely; if wrong: the record
  still cannot separate "nothing to read" from "could not read", and a future
  caller wanting that reason has to widen the record again. D-01 deliberately
  scopes to EMPTY only; the fused pair is a live capture-queue `[latent]` item.
