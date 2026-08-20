---
phase: 1
status: complete
completed: 2026-08-20
---

# Phase 1: The question you cannot ask again - Summary

The risk-surface interview's option list moved out of model-composed prose and
into `lib/surface-scan.mjs`'s `interviewOptions()`, `/cad-config --surfaces`
opens that interview on demand against a fresh scan, and the menu that rendered
all eight categories twice on the #206 demo tree now renders two distinct sets.

## What shipped

- `interviewOptions()` and `OPTION_CAP`, the pure builder of the question's
  ordered choices - `cadence-core/bin/lib/surface-scan.mjs`
- `options` on the `detect-surfaces` envelope plus an `--answered` flag and its
  `CONTRACTS` row - `cadence-core/bin/planning.mjs`,
  `cadence-core/bin/lib/arg-contract.mjs`
- The ask that RENDERS those options instead of composing them; the two
  recommendation arms collapsed into one, and the fill-a-slot sentence that put
  all eight in two slots is gone - `cadence-core/references/review-triggers.md`
- `/cad-config --surfaces`, a deliberate entry point showing the answered set
  beside what the scan evidences now, writing only on an explicit pick -
  `cadence-core/workflows/config.md`, `skills/cad-config/SKILL.md`,
  `cadence-core/references/config-catalog.md`,
  `cadence-core/references/COMMANDS.md`
- Two `prose-agreement.test.mjs` arms: one pinning what `recommended` contains
  across the prose and the lib, one pinning the ask-user rendering contract at
  both interview sites - both falsified live in both directions

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 30253ab | `interviewOptions()` + `OPTION_CAP` in the pure lib; 6 new test rows |
| 1 | 2 | 7a360b6 | `options` on the `detect-surfaces` envelope, `--answered` flag, `CONTRACTS` row, #206 demo-tree fixture |
| 1 | 3 | dc231fe | `review-triggers.md`'s ask renders the seam's options; one recommendation arm, no fill-a-slot sentence |
| 1 | 4 | 48b170e | `/cad-config --surfaces` across skill, workflow, catalog and COMMANDS |
| 1 | - | 7691b1d | (orchestrator) lease widened to `arg-contract.test.mjs` for the census pin |
| 1 | 5 | faa957a | `prose-agreement.test.mjs` arm pinning `recommended`, falsified both directions |
| 1 | 6 | 76bb106 | `prose-agreement.test.mjs` arm pinning the rendering contract at both sites; census pin 156 -> 157; whole-tree gate |

## Deviations

- [deviation] Task 4's Verify asserts `node --test 'cadence-core/bin/*.test.mjs'`
  reports zero failures; it reported 1 failure. `arg-contract.test.mjs:297` pins
  the `CONTRACTS` table at 156 flag entries and task 2's `detect-surfaces
  --answered` row made it 157 - which is exactly what that census pin exists to
  catch. The bump lives in a file plan 1's `files:` lease did not declare, so
  the executor checkpointed `structural` rather than commit an out-of-lease path
  or quietly redefine the criterion. Resolved by the orchestrator: the lease was
  widened at `7691b1d` and the one-line bump landed with task 6 (`76bb106`),
  whose Verify runs the whole-tree gate.
- [deviation] Task 4's Verify has a human-verify half needing a live
  `/cad-config --surfaces` run, which no executor can dispatch. The
  deterministic half was done in full; the five manual steps stand unrun and are
  an open item below.

## Open items

- Task 4's human-verify is unrun and is the only evidence for Success Criteria 1
  and 2 that comes from a real run: reinstall the plugin from this branch,
  `/clear`, run `/cad-config --surfaces` in `/code/cadence`, expect the answered
  `["secrets","destructive","untrusted_input"]` shown beside an `inconclusive`
  scan with `evidenced: []` and two options (all eight first and labelled
  `(recommended)`, the current three second), decline, then confirm
  `git status --porcelain .planning/config.json` prints nothing and the key still
  returns those three. The seam half was confirmed directly.
- `PLAN.md` task 3's first rail opens with a prohibition broader than it means -
  "no line in this section may take the form of a hyphen, a backticked
  lower-case token and a hyphen" - while the same task's Verify requires the
  eight existing category bullets kept in exactly that form. Raised by the plan
  review at low severity; the executor read it correctly, but the wording should
  say "no NEW line".
- The `/cad-config --surfaces` evidence-gap callout - naming every evidenced
  category the current answer does not cover - is required by the plan's Must-be-true
  list and by task 4's Action, but nothing verifies it: task 4's only live
  scenario is this repo, where zero categories are evidenced, so it passes with
  the callout absent. Raised by the plan review at medium.
- The `options` envelope entries carry `{surfaces, reason}` and no
  `recommended: true` flag: the recommendation is the FIRST entry by
  construction and both prose sites say so, so a boolean would be a second
  statement of one fact for a check to drift against.

## Goal check

The commits plausibly deliver the goal, and the phase's sharpest criterion is
verified directly rather than asserted: rendered against a freshly built #206
demo tree (express + stripe + prisma + passport, with `auth/`, `migrations/`,
`api/`, `workers/`, a `.sql` file and an `openapi.yaml`), `detect-surfaces`
now returns exactly two options - all eight, then the six evidenced
(`auth, migrations, billing, concurrency, api_contract, untrusted_input`) - where
the same tree previously rendered all eight, the six, and all eight again. The
whole-tree gate is green on this tree: `self-verify --root .` returns
`ok:true` with `problems: []`, and `node --test 'cadence-core/bin/*.test.mjs'`
reports 2477 tests, 2476 pass, 0 fail, 1 skipped (pre-existing). The
deliberate entry point exists as prose in `cadence-core/workflows/config.md`'s
`## Risk surfaces (--surfaces)` section and is reachable from
`skills/cad-config/SKILL.md`'s routing list, and the drift that started this
phase is now pinned in both directions by the two `prose-agreement.test.mjs`
arms, each falsified live and reverted. What is NOT proven by any of that:
Success Criteria 1 and 2 are statements about what a live `/cad-config
--surfaces` run does - that it shows the answered set beside current evidence,
and that declining leaves `.planning/config.json` byte-identical - and no
executor can invoke a skill, so both rest on prose plus a directly-confirmed
seam half rather than on a run. The evidence-gap callout inside criterion 1 is
weaker still: it is required by the plan and implemented in prose, and the only
scenario anyone will run against it (this repo) evidences nothing, so nothing
would notice if it were missing. Both are open items above and both are
`/cad-verify`'s to close.
