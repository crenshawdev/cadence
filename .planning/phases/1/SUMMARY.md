---
phase: 1
status: complete
completed: 2026-07-28
---

# Phase 1: The rung ladder - Summary

The effort ladder is declared as data in `route-table.json` (per-role `rungs` +
`escalate_to`, replacing the deleted `escalate_effort_variant`), materialized as
13 agent rung files over 6 roles, and enforced in both directions by CI.

## What shipped

- **The mapping stated once** - `cadence-core/bin/lib/rung-agent.mjs`, a pure
  zero-I/O module exporting `agentForRung` / `rungAgents` / `rungIssues`,
  consumed by both `route.mjs` and `self-verify.mjs` so neither spells the rule
  for itself. 14 per-row tests in `cadence-core/bin/rung-agent.test.mjs`.
- **13 rung files on one template** - `agents/` went from 7 files to 13
  (`ls agents/*.md | wc -l` = 13), each frontmatter + a rung line + a pointer at
  its contract skill. `grep -L 'Your rung is' agents/*.md` is empty. All 13 carry
  `weight-budgets.json` entries at their exact measured byte count.
- **The ladder as data** - `cadence-core/route-table.json` carries
  `rung_order: ["low","medium","high","xhigh","max"]` beside `tier_order` and
  `profile_order`, and each of the six roles carries its own `rungs` array and
  `escalate_to`. `grep -c escalate_effort_variant` returns 0 for the table,
  `route.mjs` and `route.test.mjs`.
- **Escalation resolves through `escalate_to`** - `route.mjs` reads
  `role.escalate_to` and names the agent via `agentForRung`, keeping the
  fail-open posture (no rung-membership or file-existence validation, no throw on
  a malformed spec). Pinned by `route.test.mjs` row "escalate_to is the SOURCE of
  the swap - repointing it moves the resolved agent", and today's observable
  escalation is preserved: `cad-plan-checker` under `auto` at `--attempt 2` still
  returns `cad-plan-checker-high` / `high` / `escalated: true`.
- **Two new CI checks** - `self-verify.mjs` check 7 (`agent-carries-behaviour`:
  a `skills:`-declaring agent whose BODY carries a contract section tag) and
  check 8 (`missing-rung-agent`, `rung-not-declared`, `unknown-rung`, plus the
  reverse disk->table `undeclared-rung-agent`). `self-verify.test.mjs` went
  28 -> 40 tests.
- **Prose sweep** - the retired vocabulary is gone from `references/seams.md`,
  `workflows/plan.md`, `config.schema.json`, `INTERNALS.md`, `README.md` (agent
  figure now "6 agent roles across 13 rung files") and the five contract
  `SKILL.md` descriptions, with their budgets updated.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 6f9d080 | state the rung->agent-file mapping once as a pure lib |
| 1 | 2 | a70bc6b | materialize 13 rung agent files on one template, with budgets |
| 1 | 3 | b6225b7 | declare the rung ladder as data and escalate through escalate_to |
| 1 | 4 | 145626b | fail CI on a rung file with behaviour or a routable rung with no file |
| 1 | 5 | 49b551a | retire the effort-variant vocabulary from every live surface |

Range: `d01146d..49b551a`, 5 commits, 31 files, +776/-68.

## Deviations

- [deviation] **AC3 vs task 5's own instruction collide; task 5 kept** (49b551a).
  AC3 wants the `escalate_effort_variant` grep to match only under `.planning/`
  and `CHANGELOG.md`, but task 5 also orders a dated `⚠️ SUPERSEDED (2026-07-28)`
  bullet in DESIGN.md §6 recording what was superseded - which re-introduces
  exactly one match, at `DESIGN.md:369`. The bullet was written as instructed:
  self-verify's own header names DESIGN/LINEAGE/CHANGELOG as historical docs that
  may name cut keys while explaining the cut. Read AC3 as live surfaces only,
  with DESIGN.md's dated bullet in `CHANGELOG.md:43`'s class.
- [deviation] Plan says "add the rung line to the 6 base files that lack it";
  only 5 lacked it (`agents/cad-plan-checker.md` already carried it). Same
  arithmetic species as the plan's own D-11 note. All 13 now carry it (a70bc6b).
- [deviation] Base agent files kept their existing role `description:`; only the
  6 new rung files and `cad-plan-checker-high.md` took the neutral rung-template
  description. Rewriting a base file's description would replace the role's
  model-facing selection text with a rung label (a70bc6b).
- [deviation] `rungAgents` skips non-string rung values rather than mapping them.
  An absent `escalate_to` would otherwise produce a `<role>-undefined` phantom
  that check 8 reports as a missing agent file, burying the real
  `rung-not-declared`. `rungIssues` still reports the absent `escalate_to`
  (6f9d080).
- [deviation] `rungIssues` returns ONE `unknown-rung` naming `rung_order` when
  `rung_order` is absent/empty, rather than that plus one per value. The plan's
  wording allows both; a cascade would bury the single fix. Pinned by its own
  test row (6f9d080).
- [deviation] Task 3's first-pass ladder-consistency test named
  `escalate_effort_variant` in a comment, failing the task's own `grep -c`
  verify. Reworded before commit; the committed grep is 0/0/0 (b6225b7).
- [deviation] Task 5 predicted `workflows/plan.md` might exceed its 13874-byte
  budget; the edit shrank it to 13872, so per the plan's "only if it pushes it
  over" clause the entry was left unchanged. See open items - this leaves the
  only budget entry in the manifest that is not its file's exact size (49b551a).
- [deviation] Renamed a local in `route.test.mjs`'s fable row from `rungs` to
  `matrixModels` - it holds profile-matrix model aliases, and `rungs` now means
  the effort ladder in that file (b6225b7).

## Open items

Findings below marked (reviewer) came from the `diff` trigger, which is
`advisory`. Adjudication was cut short at the user's direction after the two
reviewers returned; the items marked **grounded** were reproduced here, the
rest are recorded as reviewer claims and still need grounding at `/cad-verify 1`.

- **grounded** - `cadence-core/bin/weight-budgets.json` carries
  `cadence-core/workflows/plan.md` at 13874 against an actual 13872 bytes. A
  script over all 63 entries reports exactly one mismatch. The check is a ceiling
  (`bytes > budget`), so CI stays green while 2 bytes of unaudited growth sit
  pre-approved, which is the one thing the manifest's regenerate-on-growth
  convention exists to prevent.
- **grounded** - `DESIGN.md:134` still reads "Effort-variant files
  (`planner-high`/`planner-low` etc., §6)". AC3's grep is case-sensitive, so the
  capitalized spelling slips past it, and neither `planner-low` nor
  `planner-high` is a name the declared ladder can produce.
- (reviewer, medium) `self-verify.mjs:580` dereferences `spec.base_effort`
  without a null guard, so a `null` role entry in `route-table.json` throws and
  collapses `run()` into `{ok:false,reason:"internal"}` with every problem found
  so far discarded - the #49.1 failure the block's own comment says it guards
  against.
- (reviewer, medium) `route.mjs:124` accepts any `escalate_to` without comparing
  it against `rung_order`, so a data-only edit can make a failure retry resolve
  DOWN the ladder while reporting `escalated: true`. `rungIssues` only tests
  membership in `rungs`, never direction, so self-verify reports `ok:true` on
  such a table.
- (reviewer, medium) Check 7 matches only the seven literal section tags, so a
  rung file whose whole body is plain-prose behaviour passes CI. That makes
  `INTERNALS.md:11` ("refuses a rung file that carries any instruction of its
  own") and `DESIGN.md:378` overclaim what the check enforces.
- (reviewer, low) `undeclared-rung-agent` reports a misleading detail for a file
  suffixed with its role's BASE rung: `agents/cad-planner-high.md` yields
  "cad-planner does not declare rung high" when the table does declare it, at the
  unsuffixed filename. The real fault is D-01 duplication.
- (reviewer, low) `LINEAGE.md:14` still publishes `| Agents | 34 | 7 | 21% |` and
  `:35` "Cadence's 7 agents", contradicting README's updated figure; `:43` still
  spells the retired vocabulary. LINEAGE is a dated provenance doc and was not in
  the plan's file list, so it was left alone - needs a keep/update decision.
- **Designed limit, recorded so it is not rediscovered as a bug.** Check 8's
  reverse direction is gated on `order.includes(rung)` (`self-verify.mjs:604`),
  exactly as the plan specified, so an agent file suffixed with a rung outside
  `rung_order` (`agents/cad-x-ludicrous.md`) is silently ignored rather than
  flagged. The gate is what keeps D-04's one-off-agent escape hatch legal.
- **Phase-3 handoff, as designed (D-13).** `fire(trigger)`'s claude-subagent arm
  still dispatches base `cad-reviewer`; `agents/cad-reviewer-medium.md` and
  `-xhigh.md` exist and are covered by check 8, but nothing routes to them yet.
  Issue #64's remaining gap stays open one more phase.
- **Process defect found during this phase, filed as #88.** The `diff` trigger's
  two reviewers were dispatched serially rather than in one message.
  `references/seams.md:119` already mandates concurrent dispatch and names this
  exact case, but `references/review-triggers.md:55` restates it loop-shaped
  ("For each reviewer in the set, in parallel where the host allows"). On the
  v2.0.0 milestone.

## Goal check

The phase goal was that effort become a dial the routing layer can vary per
role, by materializing each single-sourced contract at the rungs it needs. The
mechanism is in place and provable: `route-table.json` declares `rung_order` and
a per-role `rungs` + `escalate_to` with `escalate_effort_variant` deleted
(`grep -c` = 0 across table, `route.mjs`, `route.test.mjs`); all 13 names the
table can produce exist on disk (`ls agents/*.md | wc -l` = 13) with the
route.test.mjs row "every rung the table can name has an agent file carrying
exactly that effort" pinning frontmatter agreement; and the dial is
demonstrably a dial rather than a hardcode - the row "escalate_to is the SOURCE
of the swap - repointing it moves the resolved agent" resolves
`cad-plan-checker-xhigh`, a name no code hardcodes. CI now fails in both
directions (`missing-rung-agent`, `undeclared-rung-agent`), and the full suite
is green: 774 tests / 0 fail, `tsc -p tsconfig.ci.json` clean, `self-verify.mjs`
`ok:true` with `agent-behaviour, rung-agents` added to `checked` and
`agent-skills` retained.

What is honestly NOT delivered, and is worth carrying into phase 3 rather than
reading as complete: the dial is built but turned for exactly one role.
`route.mjs` reads only `escalate_to` and never `rungs`, and D-03/D-07 held
today's escalation verbatim, so five of six roles ship `escalate_to` equal to
their own `base_effort`. At `--attempt 5` under an auto config, `cad-planner`,
`cad-reviewer`, `cad-verifier`, `cad-executor` and `cad-assumptions-analyzer`
all return their base agent with reason `rung held at <base> (escalate_to
<base>)`; only `cad-plan-checker` moves. Six of the 13 files are therefore
reachable by no code path in the tree today while paying standing context in
every main-session prompt - a cost D-02 accepted deliberately and phase 3's
bundle cell is what spends it. Two of the reviewer findings above sharpen this:
nothing yet stops an `escalate_to` from pointing DOWN the ladder, and check 7
enforces less than `INTERNALS.md:11` claims it does. Neither blocks the phase
goal; both should be settled before the ladder starts carrying real routing
decisions in phase 3.
