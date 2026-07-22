---
phase: 2
plan: 1
requirements: [SOC-01]
files: [agents/cad-planner.md, cadence-core/bin/weight-budgets.json]
---

# Phase 2: Planner separation-of-concerns heuristic - Plan

## Goal

`cad-planner` carries a standing separation-of-concerns nudge so every plan it
writes prefers small, single-purpose tasks over a shared core - splitting
responsibilities that differ on trigger, size, lifecycle, failure-resume,
freshness, or ownership - without any per-phase restatement and without ever
forcing a split that does not earn itself.

## Must be true when done

- Opening `agents/cad-planner.md` shows a separation-of-concerns heuristic block
  that names all six split axes (trigger, size, lifecycle, failure-resume,
  freshness, ownership) and explicitly frames splitting as a nudge that never
  forces an unearned split.
- The heuristic is standing prose in the cached agent definition only: grepping
  the cad-plan workflow dispatch payload and the CONTEXT/PLAN templates for its
  distinctive phrasing returns nothing, so it applies to every plan with no
  per-phase restatement.
- Neither `agents/cad-plan-checker.md` nor `agents/cad-plan-checker-high.md`
  gains a rule that flags or blocks a plan for insufficient task splitting - the
  heuristic stays a planner nudge, not a checker gate.
- `node cadence-core/bin/self-verify.mjs` exits 0: the `agents/cad-planner.md`
  entry in `weight-budgets.json` equals the file's new exact byte size (no
  budget-overrun), with no CONTRACTS or tools-declaration drift.
- `node --test cadence-core/bin/*.test.mjs` and `node_modules/.bin/tsc -p
  tsconfig.ci.json` stay green.

## Context

Locked decisions from `phases/2/CONTEXT.md` bind this plan: D-01 (heuristic is
standing prose inside `agents/cad-planner.md`, never injected per-phase); D-02
(the file sits at exactly its 7714 B budget, so the budget must move in this
same change); D-03 (rebudget by raising the entry, do NOT compress existing
planner prose to fit); D-04 (do not touch either plan-checker); D-05 (this
governs task/artifact-level decomposition, distinct from the existing
`<plan_output>` PLAN-file split guidance, which must stay untouched). Out of
scope: any edit to `cadence-core/workflows/plan.md`, `plan-gaps.md`, the
`cadence-core/templates/` files, the two checkers, or any config/seam/script.

## Tasks

### Task 1: Add the separation-of-concerns heuristic to cad-planner and rebudget in lockstep

- **Files:** agents/cad-planner.md, cadence-core/bin/weight-budgets.json
- **Action:** In `agents/cad-planner.md`, add a new `<separation_of_concerns>`
  block immediately after the closing `</task_anatomy>` tag (currently line 99)
  and before the `<plan_output>` block, so it reads as an extension of the
  atomic-task guidance. The block is a standing nudge, not a gate: it directs
  the planner to prefer small, single-purpose tasks and artifacts over one
  shared core, and to treat a difference on any of six axes between two
  responsibilities as a signal to give them separate tasks/artifacts. Name all
  six axes explicitly, each with a one-clause gloss: trigger (what invokes the
  responsibility), size (its context cost / how much it carries), lifecycle (how
  often it changes and on what cadence), failure-resume (how it fails and how it
  recovers), freshness (how current its data must be), ownership (which
  actor/layer is responsible for it). State plainly that this is a nudge to
  weigh, not a hard rule, and that it never forces a split that does not earn
  itself - a genuinely single-concern phase stays one task, and combining
  responsibilities that share all six axes is correct, not a defect. Add one
  sentence distinguishing this task/artifact-level decomposition from the
  PLAN-file split in `<plan_output>` (parallel PLAN-1/PLAN-2 slices), so the two
  are not conflated. Do NOT compress or delete any existing planner prose to
  make room (D-03), do NOT add this as a rule/dimension to either plan-checker
  (D-04), and do NOT restate it in the workflow dispatch payload or any template
  (D-01). Then measure the file's new size with `wc -c agents/cad-planner.md`
  and, in the SAME change, set the `"agents/cad-planner.md"` entry in
  `cadence-core/bin/weight-budgets.json` to that exact new byte count (replacing
  7714) - the budget must equal the file size, matching the exact-byte
  convention every other entry follows; both edits land together so CI never
  sees an over-budget intermediate state.
- **Verify:** `node cadence-core/bin/self-verify.mjs; echo exit=$?` prints
  `exit=0` (no `budget-overrun`, no CONTRACTS/tools drift), and `wc -c
  agents/cad-planner.md` matches the new `weight-budgets.json` entry exactly.
  Confirm all six axes are named inside the new block only (bare words like
  "size", "trigger", and "lifecycle" occur elsewhere in the file, so scope the
  check to the block):
  `for w in trigger size lifecycle failure-resume freshness ownership; do awk '/<separation_of_concerns>/,/<\/separation_of_concerns>/' agents/cad-planner.md | grep -qw "$w" || echo "MISSING: $w"; done`
  prints nothing (every axis present), and
  `awk '/<separation_of_concerns>/,/<\/separation_of_concerns>/' agents/cad-planner.md | grep -qiE "separation[ -]of[ -]concerns"`
  exits 0 (the block carries its distinctive framing, matching the hyphenated
  or spaced form). The same distinctive
  phrasing is
  absent everywhere else:
  `grep -rn "failure-resume\|freshness\|separation of concerns" cadence-core/workflows/plan.md cadence-core/workflows/plan-gaps.md cadence-core/templates/ agents/cad-plan-checker.md agents/cad-plan-checker-high.md`
  returns no matches. `node --test cadence-core/bin/*.test.mjs` reports all tests
  passing and `node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

## Notes

This phase is a single coupled concern - one prose addition to the cached
planner plus its exact-byte budget bump - so it is one task and one plan. The
prose and the `weight-budgets.json` entry share a commit because
`agents/cad-planner.md` sits at exactly its 7714 B budget (D-02): adding text
without moving the budget trips self-verify's budget-overrun check, and moving
the budget without the text would not match the exact-byte convention. They
cannot be independently committable, so they are not separate tasks. Forcing a
further split here would itself be an unearned split - the exact behavior the
heuristic being added tells the planner to avoid.

Acceptance criterion 5 from CONTEXT is human-verify only (a live `/cad-plan` run
on a phase whose goal bundles responsibilities differing on at least one axis,
confirming the plan separates them while a single-concern phase is not
force-split). It is intentionally not an automated task; nothing in this plan
contradicts it.
