---
phase: 2
status: complete
completed: 2026-07-27
---

# Phase 2: The spine's own bookkeeping - Summary

`/cad-plan` now seeds its own REQUIREMENTS traceability rows through a
`planning.mjs seed-reqs` subcommand bounded by a stated `## Active` grammar,
and a worktree-mode executor asserts its own `PLAN-<k>.md` before task 1
instead of silently planning against a stale merge point.

## What shipped

- A stated grammar for `## Active` and a Traceability row-insert path -
  `parseActiveIds` / `insertReqRows` in
  `cadence-core/bin/lib/planning-files.mjs:182-281`, 20 new parser-level tests
- `seed-reqs` subcommand, wired into `/cad-plan` where the plan is written -
  `cadence-core/bin/planning.mjs:630`, `cadence-core/workflows/plan.md:225`
- Additive `unseeded` and `nonconforming_plans` audit signals, verdict
  arithmetic unmoved (D-07) - `cadence-core/bin/planning.mjs:544-568`
- The grammar written down as a durable reference -
  `cadence-core/references/req-traceability.md`
- The single-writer invariant restated as a Status-transition rule across
  5 prose sites (audit.md, cad-audit/SKILL.md, progress.md, verify.md,
  .planning/REQUIREMENTS.md)
- This repo seeded: v1.4.0's `## Active` rows plus the trace they produce -
  `.planning/REQUIREMENTS.md`, phase-1 plans gained `requirements: [GRM-01]`
- The worktree plan-file assertion, with a merge/rebase/fetch ban -
  `agents/cad-executor.md:106-128`
- The honest worktree binding stated, fork-from-HEAD claims retired across
  6 surfaces - `cadence-core/references/seams.md`, `references/git.md`,
  `lib/branch-decision.mjs`, `METHOD.md`, `workflows/config.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 374cc89 | stated grammar for `## Active` and a Traceability row-insert path |
| 1 | 2 | caf334a | `seed-reqs` subcommand, called by `/cad-plan` right where the plan is written |
| 1 | 3 | 68eff5f | loud audit signals for an unseeded table and a non-conforming plan filename |
| 1 | 4 | 1889274 | state the REQUIREMENTS.md traceability grammar; give `## Active` an author |
| 1 | 5 | 4cb5ae6 | restate the single-writer invariant as Status-transition, not row-existence |
| 1 | 6 | 705583e | seed v1.4.0's Active rows and the trace they produce |
| 1 | 7 | 6f94f63 | cad-executor asserts its own plan file exists before task 1 in worktree mode |
| 1 | 8 | 1dedd43 | state the honest worktree binding; retire the fork-from-HEAD claims |

## Deviations

- [deviation] Task 3's Verify text predicted a live `audit` on this repo would
  print `unseeded` with `no_active_section: true`; observed
  `unseeded: {"active_ids":[]}` and no `no_active_section`, because this repo's
  `## Active` heading was already present (prose, no bulleted ids) rather than
  absent, so `parseActiveIds` correctly returned `[]` not `null`. Correct
  behavior per the null-vs-`[]` distinction task 1 built; the plan's prediction
  about the repo's file state was wrong, not the code. No code changed. (68eff5f)
- [deviation] Task 4 removed the sample Traceability row and the
  `**Coverage:** [X]...` placeholder from `cadence-core/templates/REQUIREMENTS.md`
  and corrected `workflows/new-project.md:220-221`'s "(filled by the roadmap
  step)" parenthetical, neither named in the task. As originally worded the
  template and new-project.md would have contradicted the same task's
  "left as bare headers" fix, and D-04 forbids hand-authoring that table -
  the exact two-places-disagree failure the task exists to close. (1889274)

## Open items

Seven adjudicated survivors from the `diff` review panel (claude-subagent +
openai `gpt-5.4-mini` + deepseek `deepseek-v4-flash`, mode `adjudicated`,
gate `advisory`). Three further findings were killed as false positives or
overstatements: the phase-union read in `seed-reqs` (documented intent, and
`## Active`-bounded), `parseActiveIds`' silent duplicate-id dedup (documented
first-occurrence-wins), and the `-**ID**` no-space non-match (correct per the
stated grammar - a bullet with no bold span declares no id by design).

- (high) `unseeded` fires only on a zero-row table
  (`cadence-core/bin/planning.mjs:554`), so once any phase of a milestone is
  planned, an `## Active` id no phase has picked up is invisible to `audit`:
  `counts.total` is `rows.length`, so an unseeded requirement is never counted
  and never breaks. Narrower than the pre-diff hole (an empty table PASSed
  vacuously, which is how v1.2.0 and v1.3.1 closed) but not closed - and this
  phase removed the hand-authored table that used to cover the partially-planned
  state. Scope gap, not a build error: the plan's acceptance criterion specified
  the zero-row condition.
- (medium) `cadence-core/templates/ROADMAP.md:52-53` still says "the Traceability
  table in REQUIREMENTS.md mirrors this mapping", contradicting this phase's own
  `workflows/new-project.md:248` and `templates/REQUIREMENTS.md:4,68` ("left as
  bare headers"). A missed surface of exactly the class task 5 exists to close.
- (medium) `mismatched` is computed and documented as load-bearing
  (`planning-files.mjs:214-216`: a stale phase cell "must not pass as a clean
  skip") but no caller surfaces it - `workflows/plan.md:231,261,290` name only
  `seeded` / `orphan_ids` / `no_active_section`. A moved or renumbered
  requirement reports as a clean skip in the user-visible report.
- (low-medium) Reader/writer heading drift: `insertReqRows`
  (`planning-files.mjs:236`) targets the LAST `## Traceability` heading while
  `parseRequirements` (`:95`) reads the FIRST, so with a duplicated heading the
  docstring's "the reader and the writer of this one table cannot drift" is
  false and rows grow unbounded on repeated seeding.
- (low) No id validation on the write path: `parseActiveIds` accepts any
  non-`*` text and `insertReqRows` interpolates it verbatim
  (`planning-files.mjs:279`), so an id containing `|` writes a structurally
  broken row that is re-inserted on every run. All three reviewers converged on
  the mechanism; realism is low, since every template gives `ABC-01`-shaped ids.
- (low) A Traceability row indented up to 3 spaces (legal GFM) is invisible to
  both `parseRequirements`' `^\|` anchor and the anchor scan, so a duplicate
  `Pending` row can shadow an existing `Complete` one. Pre-existing parser
  limitation, not introduced by this phase.
- (low) A `blocked` worktree halt has no described remedy: `execute.md`'s
  `execute_parallel` has no worktree-refresh step, and `handle_checkpoint`
  re-dispatches into the same worktree. The no-self-repair halt is D-08/D-09/D-12
  by design, so the gap is the missing orchestrator-side path, not the ban.

Acceptance criterion 6 (a live parallel `/cad-execute` halting `blocked` under
host worktree isolation) remains human-verify by construction, as the plan states.

## Goal check

The eight commits plausibly deliver the phase goal, and the headline claim is
verified rather than asserted: `node cadence-core/bin/planning.mjs audit` on
this repo now returns `counts: {total: 2, traced: 1, broken: 1}` with GRM-01
traced to phase 1 and SPN-01 pending on phase 2, against the `total: 0` vacuous
PASS that let the v1.2.0 and v1.3.1 closes through - the exact criterion the
plan named. Idempotency holds live: a second and third `seed-reqs --phase 2`
each return `{"seeded":[],"skipped":["SPN-01"]}` and leave
`.planning/REQUIREMENTS.md` byte-unchanged (`git status --short` empty). The
executor-side half is in place at `agents/cad-executor.md:108-116` (halt with a
`blocked` checkpoint naming the missing PLAN path and the worktree HEAD, repair
nothing) with the merge/rebase/fetch ban at `:121-128`, though it is prose in an
agent definition, so only a live parallel run proves it fires - the plan already
booked that as human-verify. All three green checks pass: `node --test
cadence-core/bin/*.test.mjs` reports 449/449, `npx tsc -p tsconfig.ci.json`
exits 0, and `node cadence-core/bin/self-verify.mjs` returns
`{"ok":true,...,"problems":[]}` with no budget overrun despite three budget
bumps. What is missing is the residual audit blind spot named first under open
items: the phase closes the empty-table hole and the per-phase seeding path, but
in the normal partially-planned milestone state an `## Active` requirement that
no phase has picked up still passes `audit` silently - and this phase retired
the hand-populated table that previously covered that case. The goal's own words
are "a milestone close never again needs a hand-populated table before
`/cad-audit` passes", which is now true; whether `/cad-audit` FAILs when it
should is the part left open.
