# Phase 5: What Cadence claims about itself is true - Context

Gathered: 2026-08-14
Feeds: /cad-plan 5

## Scope boundary

In: `DOC-02` across three independent fix sites - the `/cad-docs-verify` sweep
and everything it names in `.planning/DOCS-CLAIMS.md` (the `run` column, the
fourth invocation over the four unswept workflows, the line re-pins for the
seven docs that moved, the seven rows phase 4's `trace close` invalidated by
claim TEXT, and the missing `/cad-capture --cadence` row); the three direct
prose edits the sweep cannot reach (`references/req-traceability.md:50` and
`:150`, `templates/REQUIREMENTS.md:63`, `references/acceptance-criteria.md:248`)
each with its same-commit `weight-budgets.json` re-pin; and two derived
assertions in `bin/prose-agreement.test.mjs` (the README counts, and the
`### Active` version-token structure).

Out: phase 6's tone and audience pass over the same prose - this phase is
accuracy only, and a line may be true and badly voiced when phase 5 closes;
widening `/cad-docs-verify`'s default target set (D-04); any change to
`activeVersion()` / `DECLARED_VERSION_RE` in `lib/branch-decision.mjs` (D-07);
`LINEAGE.md`, which duplicates the README counts and still publishes a stale
`| Agents | 34 | 7 | 21% |` row - it is a historical doc outside the linted
surface and its row stays a queue item (D-06); `README.md:97`'s `trace suggest`
mention, which the sweep may extract as a claim but which no AC here requires
fixed; and the eight ledgered workflow files byte-identical to run 1, whose 55
rows are not re-read (D-08).

Deferred: None.

Plan shape: multiple plans, same phase - three fix sites sharing no files.
AC1-AC3 are the ledger stream (`.planning/DOCS-CLAIMS.md` alone); AC4-AC5 are
three prose edits in three budget-pinned files; AC6 is one test file. AC7 is a
gate on all three.

## Durable decisions

- D-01 (sweep): Run 1's three recorded invocations are re-run BYTE-IDENTICAL
  and a FOURTH is added naming only the four workflows that ship with zero rows
  (`adopt.md`, `minimalism-review.md`, `report.md`, `suggest.md`). Run 1 swept
  21 workflows; `cadence-core/workflows/` now holds 25. Widening an existing
  invocation's glob instead would make run 1's counts (509/18/20 = 547)
  non-comparable against run 2, because the surface would have changed
  underneath them. Two of the four (`report.md`, `suggest.md`) make claims about
  the trace phase 2 rewrote, so a defer would leave them unchecked for a second
  cycle. Evidence: `.planning/DOCS-CLAIMS.md:12-16` (run-1 surface),
  `:26-28` (the three verbatim invocations, "recorded verbatim so the next cycle
  re-runs them unchanged"); 548 rows over 31 docs measured 2026-08-14.
- D-02 (ledger): "A verdict dated this cycle" is carried by a new `run` column
  holding `1` or `2` per row, generated rather than typed - not by a date cell
  and not by a run-scoped section alone. A section split (the
  `## Claims added after run 1` precedent) covers only NEW claims, so the 548
  existing rows would carry no this-cycle verdict and criterion 1 would be met
  by reinterpretation rather than by the file. A `run` column dates by run,
  satisfies "every row" literally, and survives a third cycle without another
  schema change. Evidence: `.planning/DOCS-CLAIMS.md:10`, `:193-196` (six-column
  `id | doc | line | claim | verdict | resolution`, no date cell), `:745-752`.
- D-03 (join): Phase 4's `trace close` invalidated ledger rows by claim TEXT and
  not merely by line, so those rows are re-verdicted `stale` and their claim text
  REWRITTEN under the ledger's stated call-it-out rule - they are not line
  re-pins. Seven rows state the superseded `trace append ... --event
  return/checkpoint` spelling against a live single `trace close` call: PLAN-18,
  PLAN-19, CONTEXT-14, EXECUTE-17, EXECUTE-18, VERIFY-DEEP-05, VERIFY-DEEP-12.
  A silent re-pin makes next cycle's diff join them to nothing and report seven
  brand-new extractions where seven fixes happened. Evidence: the rewrite
  protocol at `.planning/DOCS-CLAIMS.md:130-137`; live calls at
  `cadence-core/workflows/plan.md:196` and `:293`,
  `cadence-core/workflows/context.md:188`,
  `cadence-core/workflows/execute.md:206`,
  `cadence-core/workflows/verify-deep.md:19`.
- D-04 (targets): Criteria AC4 and AC5 are DIRECT edits, not sweep output, and
  `/cad-docs-verify`'s default target set is NOT widened to reach them. Its
  default is `README.md` plus `docs/**` and root `*.md`; all three surfaces
  (`references/req-traceability.md`, `templates/REQUIREMENTS.md`,
  `references/acceptance-criteria.md`) sit outside it, and outside run 1's swept
  surface. A generic default naming `cadence-core/references/**` would be wrong
  prose in the shipped plugin for every other project. The workflow also stops at
  the report and never edits docs, so no arrangement of targets makes the sweep
  produce these fixes. Evidence: `cadence-core/workflows/docs-verify.md:9-10`,
  `:4` and `:50-54`; `.planning/DOCS-CLAIMS.md:32-35` (the prior D-01 this
  upholds).
- D-05 (REQ_ID): The narrower statement AC4 asks for is the `REQ_ID_TOKEN`
  asymmetry, which is LIVE in code - so the remedy prose is rewritten to it,
  never deleted. `REQ_ID_EXACT` now admits a digit-leading category
  (`2FA-01`, `3DS-02`) while `REQ_ID_TOKEN` keeps its letter head, so an
  UNBOLDED `2FA-01` remains invisible to the prose scan. Deleting the three
  false surfaces would remove the only documentation of a real live gap and
  leave a user with a digit-leading category warned by nothing. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:324` vs `:299`, pinned by
  `cadence-core/bin/planning-files.test.mjs:916-932`; the three false surfaces
  at `cadence-core/references/req-traceability.md:50` ("Known limit as of
  v1.4.0") and `:150`, `cadence-core/templates/REQUIREMENTS.md:63`.
- D-06 (count test): The README count assertion lives in
  `cadence-core/bin/prose-agreement.test.mjs` (the `prose` CI group), DERIVES
  both sides from the tree, and covers `README.md` ONLY. That file's whole
  stated subject is prose copying a machine-readable fact; `self-verify.mjs`
  runs against every `--root` fixture and any user tree it is pointed at, where
  a `skills/` count means nothing. `LINEAGE.md` duplicates the same two counts
  and still publishes a stale `| Agents | 34 | 7 | 21% |` row, but it is a
  historical doc that `self-verify` already excludes; it stays a queue item.
  A hardcoded number would pin today's tree and report a correct future count as
  a defect. Evidence: `cadence-core/bin/prose-agreement.test.mjs:1-17`;
  `cadence-core/bin/self-verify.mjs:5-9`; `LINEAGE.md:14` and `:35`;
  `.planning/CAPTURE.md:384`; the derived-never-baselined discipline at
  `cadence-core/bin/seam-calls.test.mjs:12-33`.
- D-07 (version): AC6's assertion is STRUCTURAL - the first LINE-ANCHORED
  version token in `PROJECT.md`'s `### Active` body must also be the first
  version token anywhere in that body - and `activeVersion()`'s parse is NOT
  changed. The roadmap's stated mechanism is measurably wrong: at `81bdb5d` the
  section's first version token WAS `v3.2.0` (correct) yet `activeVersion()`
  returned `v3.0.0`, because a line-anchored token 40 lines down - produced by
  markdown wrapping mid-sentence - won under `DECLARED_VERSION_RE`. An assertion
  phrased as "the first version token" would have PASSED on the broken file. The
  anchor itself is the deliberate v2.4.0 fix for reading a mention as the
  milestone, with four pinned fixtures; loosening it would reopen that ship-gate
  failure and ship a behaviour change to the branch-naming seam and the
  `version_drift` comparand from a docs phase. The structural form names no
  version, so it never needs re-baselining at cycle open. Evidence:
  `cadence-core/bin/lib/branch-decision.mjs:62-68`, `:69`, `:85-95`;
  `cadence-core/bin/branch-decision.test.mjs:237-265`; measured 2026-08-14
  against `git show 81bdb5d:.planning/PROJECT.md`; live file passes
  (`.planning/PROJECT.md:108` = `v3.3.0`).

## Decisions

- D-08 (re-pin scope): Line re-pinning is scoped to docs that actually moved.
  Eight ledgered workflow files are byte-identical to run 1 and their 55 rows
  are not re-read (`config-review` 10, `coverage` 8, `docs-verify` 4, `phase` 13,
  `plan-gaps` 4, `spike` 2, `undo` 8, `verify-sweep` 6). Seven moved and carry
  117 rows: `plan.md` 32, `execute.md` 28, `new-project.md` 22, `verify-deep.md`
  12, `context.md` 11, `decision-review.md` 11, `references/plan-revision.md` 1.
  Run cost is this project's standing second priority; a full re-read of rows
  whose cited lines cannot have moved buys nothing. Evidence: measured
  2026-08-14, `git diff --stat a6b8931 HEAD -- <file>` empty for the eight;
  `git diff --stat 81bdb5d HEAD` for the seven.
- D-09 (budgets): Every file AC4 and AC5 edit sits EXACTLY at its byte budget,
  so each edit commit re-pins `cadence-core/bin/weight-budgets.json` in the same
  commit. Measured 2026-08-14 (`wc -c`): `references/acceptance-criteria.md`
  22506/22506, `references/req-traceability.md` 13725/13725,
  `templates/REQUIREMENTS.md` 2914/2914, `references/COMMANDS.md` 4905/4905
  (`cadence-core/bin/weight-budgets.json:23,24,40,50`). The check is a ceiling,
  not equality (`cadence-core/bin/self-verify.mjs:777-791`), and the same-commit
  re-pin is the convention `bd231ec`'s own message states. Without it CI goes red
  with `budget-overrun` on the first added sentence.
- D-10 (queue): `DOC-02`'s "fourteen queue items" are enumerated nowhere in the
  repo, so this phase defines its own retirement list, the seven ACs are the
  binding subset, and queue bullets are matched by TEXT and never by their
  `(phase N)` tag. Exactly ONE open Todo carries `(phase 5)`; every other
  `(phase 5)` tag sits in `## Archive` and belongs to an earlier milestone's
  phase 5, while this cycle's real items are tagged with the phase that FILED
  them (`.planning/CAPTURE.md:141`, `:177`, `:179`, `:182`, `:183`, `:197`,
  `:200`, `:231`). Evidence: `.planning/REQUIREMENTS.md:54-63` and
  `.planning/ROADMAP.md:39`, `:158` all say "fourteen" and name only exemplars;
  `grep -rn "fourteen" .planning design-notes` finds no enumeration.
- D-11 (--cadence): Two of the roadmap's three registration surfaces ALREADY
  shipped, so the outstanding work is one `DOCS-CLAIMS.md` row and verification
  of the other two, not a re-edit. `cadence-core/references/COMMANDS.md:47` and
  `README.md:124` both describe the arm, landed in `bd231ec`, whose message
  explicitly defers the ledger row to the next sweep. No ledger row mentions
  `--cadence`. This contradicts `.planning/CAPTURE.md:182`, a queue bullet that
  outlived its fix and is itself one of the fourteen to retire. Re-editing either
  file would burn a budget re-pin on both for no change in what a user reads.

## Acceptance criteria

- [ ] AC1: `.planning/DOCS-CLAIMS.md` carries a `run` column with a non-empty
      value on every row; its invocation block records a fourth invocation
      naming `adopt.md`, `minimalism-review.md`, `report.md` and `suggest.md`;
      and the file contains at least one row whose claim text names
      `/cad-capture --cadence`.
- [ ] AC2: For each of the seven ledgered docs that changed since `a6b8931`,
      opening that file at every one of its rows' cited line numbers shows that
      row's claim text.
- [ ] AC3: Rows `PLAN-18`, `PLAN-19`, `CONTEXT-14`, `EXECUTE-17`, `EXECUTE-18`,
      `VERIFY-DEEP-05` and `VERIFY-DEEP-12` each carry a `stale` verdict and a
      resolution naming the rewrite, and
      `grep -c -- "--event return\|--event checkpoint" .planning/DOCS-CLAIMS.md`
      returns 0.
- [ ] AC4: `grep -n "2FA-01" cadence-core/references/req-traceability.md
      cadence-core/templates/REQUIREMENTS.md` returns lines stating that an
      UNBOLDED digit-leading id is invisible to the prose scan, and returns no
      line stating that a digit-leading category fails `/cad-audit` admission.
- [ ] AC5: `cadence-core/references/acceptance-criteria.md`'s env-override
      passage names `CADENCE_TEST_SEAM=1` beside `CADENCE_PLUGIN_MANIFEST`.
- [ ] AC6: `cadence-core/bin/prose-agreement.test.mjs` carries two assertions
      that derive both sides - README's skill/role/rung-file counts against the
      tree, and the first line-anchored version token in `PROJECT.md`'s
      `### Active` against the first version token anywhere in that section -
      and each is shown to redden on a pre-fix input (a README carrying a wrong
      count; `git show 81bdb5d:.planning/PROJECT.md`).
- [ ] AC7: `node cadence-core/bin/test.mjs prose` exits 0 and reports no
      `budget-overrun`, with `cadence-core/bin/weight-budgets.json` re-pinned in
      the same commit as each prose edit.

## Flagged assumptions

- The sweep's output volume is not predictable before it runs: 548 rows over 31
  docs is the input, but how many verdict flips run 2 produces is unknown -
  Likely; if the flip count is large, the ledger stream (AC1-AC3) may need more
  than the one plan the Plan shape anticipates, which is the planner's call at
  /cad-plan.
- `.planning/ROADMAP.md`'s phase 5 criteria 3 and 6 still state the pre-analysis
  premises this pass refuted (registration outstanding; "names the open cycle's
  version as its FIRST version token"). Left standing deliberately - the roadmap
  records what was scoped and CONTEXT.md's ACs are what /cad-verify checks -
  Likely; if wrong, phase 4's `criteria-size` seam or `/cad-audit` reports the
  divergence between the two criteria sets rather than treating it as settled.
