# Phase 3 - Measurements

Every number below was RECOMPUTED at write time against the working tree and
against archived copies of `0bf6284`, `312011d` and `35ba9eb`, never transcribed
from PLAN.md or CONTEXT.md (D-16). The three conventions used:

- **Description bytes** - the `description:` VALUE as written, including its
  surrounding quotes where it has them, plus one newline (D-09). Reproducible as
  `grep -h "^description:" skills/cad-*/SKILL.md | sed 's/^description: //' | wc -c`.
- **Turn-one total** - a command's `SKILL.md` bytes plus the bytes of every file
  its `@${CLAUDE_PLUGIN_ROOT}/...` lines pull in, followed transitively. This
  convention reproduces all twelve of D-19's baseline figures EXACTLY against an
  archived `312011d` (the phase-2 context commit D-19 was measured at), which is
  what makes the deltas in section 2 like-for-like.
- **Weighed total** - `cadence-core/bin/weight.mjs --root <tree>`, run from THAT
  tree's own copy of the script, so a comparison against `0bf6284` reads the
  narrow walker of the time rather than this phase's widened one.

## 1. Trigger words, before and after

One row per skill task 5 edited. "Before" is read back with
`git show 35ba9eb:skills/<name>/SKILL.md`; the trigger words are the per-skill
lists task 5 required, and each was tested against BOTH strings mechanically
rather than eyeballed. A word absent from the before line and present in the
after one is marked `(new)`; a word present before and absent after would be
marked `**DROPPED**`.

**No trigger word was dropped: 0 dropped, 9 gained.** The nine gains are mostly
the command's own verb, which several before-lines never contained - `/cad-land`
never said "land", `/cad-verify` never said "verify", `/cad-progress` never said
"progress", `/cad-undo` never said "undo", `/cad-help` never said "help".

| Command | description B | Before (`35ba9eb`) | After | Trigger words |
|---|---|---|---|---|
| `/cad-audit` | 223 -> 154 | "Pre-ship requirement-traceability audit - every requirement traced to a phase, a plan, and a verification; orphan detection both directions; a FAIL gate that catches silently-dropped requirements before a milestone ships" | "Pre-ship traceability audit - every requirement traced to a phase, plan and verification, orphan detection both directions, a FAIL gate before shipping" | traceability, requirement, orphan, pre-ship, gate |
| `/cad-capture` | 241 -> 137 | "Capture without losing your place - an actionable phase-linked todo (the queue mem-* lacks), a seed idea for a future milestone, or a note. One file: .planning/CAPTURE.md, which the builtin memory backend makes recallable at planning time" | "Capture a phase-linked todo, a seed idea for a future milestone, or a note, without losing your place - one file, .planning/CAPTURE.md" | capture, todo, seed, note, CAPTURE.md |
| `/cad-config` | 165 -> 120 | "Configure Cadence's config.json - workflow toggles, routing stakes, and interactive cross-model review-provider setup (live model detection + per-tier assignment)" | "Configure Cadence's config.json - workflow toggles, routing stakes, and interactive cross-model review provider setup" | config, config.json, review provider (new), stakes |
| `/cad-context` | 142 -> 127 | "Gather phase context before planning - codebase assumptions, locked decisions, falsifiable acceptance criteria - in one conversational pass" | "Gather phase context before planning - codebase assumptions, locked decisions, falsifiable acceptance criteria - in one pass" | context, assumptions, decisions, acceptance criteria, phase |
| `/cad-coverage` | 186 -> 147 | "Find which of a completed phase's requirements have zero failing-capable test coverage, then generate tests to close the gaps - using the project's own test framework, not a fixed one" | "Find a completed phase's requirements with no failing-capable test coverage and generate tests to close the gaps, in the project's own framework" | coverage, tests, requirements, gaps |
| `/cad-debug` | 180 -> 146 | "Systematic debugging - scientific method with hypothesis state persisted across /clear, and a user-gated second-model consult at dead-ends. Single pass, no session-manager layer" | "Systematic debugging - hypothesis and symptom tracked in a state file that survives /clear, with a user-gated second-model consult at dead ends" | debug, hypothesis, symptom (new) |
| `/cad-decision-review` | 275 -> 155 | "On-demand adversarial refute-then-adjudicate pass over one load-bearing decision - a CONTEXT.md D-NN line or a PROJECT.md Key Decisions row - grounded against Context7 and the codebase. Per-objection survives/partial/refuted ruling plus an amendment list; never auto-fires" | "Adversarial refute-then-adjudicate pass over one load-bearing decision - a CONTEXT D-NN line or a PROJECT Key Decisions row - with per-objection rulings" | decision, refute, adjudicate, objection |
| `/cad-docs-verify` | 210 -> 170 | "Verify factual claims in docs against the live codebase - file paths, commands, code symbols, config keys, structure - and report which are accurate, stale, or unverifiable. Reports; it does not rewrite docs" | "Verify docs claims against the live codebase - paths, commands, symbols, config keys - each reported accurate, stale or unverifiable. Reports; it does not rewrite docs" | docs, claims, stale, codebase |
| `/cad-execute` | 107 -> 101 | "Execute all plans in a phase - one cad-executor per plan, atomic commit per task, slim per-phase SUMMARY" | "Execute a phase's plans - a subagent per plan, an atomic commit per task, a slim per-phase SUMMARY" | execute, plans, phase, commit |
| `/cad-health` | 244 -> 172 | "Quick planning-health check - are .planning's core docs present, and is the STATE cursor / ROADMAP / REQUIREMENTS parseable and mutually consistent? Reports issues and offers to fix trivial ones. Not a traceability audit (that is /cad-audit)" | "Planning-health check - .planning's core docs present, the STATE cursor, ROADMAP and REQUIREMENTS parseable and consistent. Not a traceability audit (that is /cad-audit)" | health, .planning, STATE, ROADMAP, REQUIREMENTS |
| `/cad-help` | 205 -> 129 | "The Cadence command reference - every /cad-* skill grouped by cluster (spine, review & quality, lifecycle, support), plus the review and consult capabilities. Pass a command name to show just that entry" | "Cadence's own help - the command reference for every /cad-* skill, grouped by cluster; pass a command name for just that entry" | help (new), command reference |
| `/cad-land` | 218 -> 159 | "Publish finished work - report git state, fire the pre_ship review, then ask the publish mechanism with NO preselected default (push / MR or PR / tag / leave local) and do exactly that. Never decides how you publish" | "Land finished work - report git state, fire the pre_ship review, then ask the mechanism (push / MR or PR / tag / leave local). Never decides how you publish" | land (new), publish, push, MR, PR, tag, pre_ship |
| `/cad-milestone` | 283 -> 160 | "Cut a milestone - verify nothing was dropped (cad-audit), tag the release when the project tags, prune completed phases from the live roadmap (git is the archive), evolve PROJECT.md, and refresh REQUIREMENTS for the next cycle. Works for non-release projects too. Folds in cleanup" | "Cut a milestone - audit that nothing was dropped, tag when the project tags, prune completed phases from the roadmap, evolve PROJECT and refresh REQUIREMENTS" | milestone, tag, prune, roadmap, PROJECT, REQUIREMENTS |
| `/cad-new-project` | 119 -> 120 | "Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, phased ROADMAP.md, and .planning/ state" | "Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, a phased ROADMAP.md and .planning/ state" | initialize, project, PROJECT.md, REQUIREMENTS.md, ROADMAP.md |
| `/cad-pause` | 205 -> 149 | "Pause work cleanly - a WIP commit of in-flight changes plus a STATE cursor set to paused with a one-line 'where I was' as the resume pointer. Resume is /cad-progress, which auto-detects it. No Stop hook" | "Pause work cleanly - a WIP commit of in-flight changes plus a STATE cursor set to paused with a one-line resume pointer (/cad-progress resumes it)" | pause, WIP commit, STATE, resume |
| `/cad-phase` | 253 -> 154 | "CRUD phases in ROADMAP - add, insert, remove, edit. The op that earns the skill is remove/insert: it renumbers the following phases, their .planning/phases dirs, and every phase-number reference in one consistent pass - the thing humans botch by hand" | "CRUD phases in ROADMAP - add, insert, remove, edit, with remove/insert renumbering the following phases, their .planning dirs and every phase reference" | phase, ROADMAP, add, insert, remove, edit, renumber |
| `/cad-plan` | 105 -> 105 | "Create an executable phase plan (PLAN.md) - planner subagent, optional check gate, plan review trigger" | "Create an executable phase plan (PLAN.md) - planner subagent, optional check gate, plan review trigger" | plan, PLAN.md, phase |
| `/cad-plan-review` | 219 -> 148 | "On-demand adversarial review of a phase PLAN before code, through the review subsystem's plan trigger. For a hand-written, imported, or just-edited plan - /cad-plan already fires this automatically when it writes one" | "On-demand adversarial plan review of a phase PLAN.md before code - for a hand-written, imported or just-edited plan (/cad-plan fires this itself)" | plan review (new), adversarial, PLAN.md (new) |
| `/cad-progress` | 149 -> 120 | "Show where the project stands and what's next - count-based status from files and git, auto-resume of incomplete work, --stats for a quick summary" | "Project progress - count-based status from files and git, auto-resume of incomplete work, --stats for a quick summary" | progress (new), status, resume |
| `/cad-spike` | 264 -> 144 | "Time-boxed experiment to resolve a specific unknown before betting on it - falsifiable Given/When/Then criteria tested risk-first (fail fast), a clear validated \| invalidated \| inconclusive verdict, throwaway code. One slim SPIKE.md, not a five-artifact wrap-up" | "Spike - a time-boxed experiment resolving one unknown before you bet on it, risk-first, with a validated \| invalidated \| inconclusive verdict" | spike, experiment, time-boxed, unknown, verdict |
| `/cad-task` | 103 -> 103 | "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work" | "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work" | task, off-roadmap, atomic commits |
| `/cad-undo` | 253 -> 134 | "Safely roll back a phase's commits - discover the hashes from the phase SUMMARY manifest, guard against a dirty tree, revert (or --no-commit squash to re-do), and reset the phase's status. Reports later work factually instead of guessing dependencies" | "Safely undo a phase - roll back its commits from the SUMMARY manifest, revert (or --no-commit to re-do), and reset the phase status" | undo (new), roll back, revert, phase, commits |
| `/cad-verify` | 162 -> 138 | "Conversational UAT for a completed phase - persistent checklist that survives /clear, --sweep for a cross-phase audit, --deep for a goal-backward codebase pass" | "Verify a completed phase by conversational UAT - a persistent checklist that survives /clear, plus cross-phase and goal-backward passes" | verify (new), UAT, checklist, phase |

Aggregates:

| Set | Before (`35ba9eb`) | After | Delta |
|---|---|---|---|
| 23 edited skills | 4,511 B | 3,192 B | -1,319 B |
| 6 `cad-*-contract` skills (untouched, D-10) | 567 B | 567 B | 0 |
| **all 29 `skills/cad-*/SKILL.md`** | **5,078 B** | **3,759 B** | **-1,319 B** |
| **19 `agents/*.md`** | **3,472 B** | **1,638 B** | **-1,834 B** |

Reproduce, exact command output (unformatted, so a `grep` for the figure matches
what the command actually prints):

- `grep -h "^description:" skills/cad-*/SKILL.md | sed 's/^description: //' | wc -c`
  prints `3759` at HEAD, `5078` at `35ba9eb`.
- `grep -h "^description:" agents/*.md | sed 's/^description: //' | wc -c`
  prints `1638` at HEAD, `3472` at `35ba9eb`.

Two of the 23 needed no edit: `/cad-plan` (105 B) and `/cad-task` (103 B) were
already one routing line carrying every required trigger word, so rewriting them
would have churned two compliant lines and two budget entries for no gain - the
same reasoning D-10 applies to the six contract skills. They are still in the
table above, with identical before and after text.

## 2. Closing measurement - turn-one totals (the headline)

This is the cycle's actual result (D-08): what a session pays to run a command,
against D-19's stated baseline. Cause column reads the per-file deltas between
`312011d` and HEAD.

| Command | D-19 baseline | HEAD | Delta | Where it moved |
|---|---|---|---|---|
| `/cad-land` | 36,235 | 31,016 | -5,219 | SKILL.md +1,296; references/review-triggers.md -1,351; references/git.md include removed (-11,330); references/git-guard.md include added (+6,166) |
| `/cad-milestone` | 20,855 | 15,655 | -5,200 | SKILL.md -117; workflows/milestone.md +81; references/git.md include removed (-11,330); references/git-guard.md include added (+6,166) |
| `/cad-verify` | 19,834 | 19,834 | 0 | SKILL.md -24; workflows/verify.md +24 |
| `/cad-config` | 19,601 | 19,832 | +231 | SKILL.md -45; workflows/config.md +276 |
| `/cad-pause` | 18,523 | 8,197 | -10,326 | SKILL.md -47; references/git.md include removed (-11,330); references/conventions.md include removed (-5,115); references/git-guard.md include added (+6,166) |
| `/cad-execute` | 18,452 | 18,644 | +192 | SKILL.md -6; workflows/execute.md +198 |
| `/cad-plan-review` | 18,182 | 16,760 | -1,422 | SKILL.md -71; references/review-triggers.md -1,351 |
| `/cad-context` | 17,233 | 17,442 | +209 | SKILL.md -15; workflows/context.md +224 |
| `/cad-phase` | 15,941 | 10,726 | -5,215 | SKILL.md -93; workflows/phase.md +42; references/git.md include removed (-11,330); references/git-guard.md include added (+6,166) |
| `/cad-undo` | 15,633 | 10,362 | -5,271 | SKILL.md -113; workflows/undo.md +6; references/git.md include removed (-11,330); references/git-guard.md include added (+6,166) |
| `/cad-plan` | 15,584 | 15,621 | +37 | workflows/plan.md +37 |
| `/cad-new-project` | 15,349 | 15,598 | +249 | SKILL.md +1; workflows/new-project.md +248 |
| **12 commands** | **231,422** | **199,687** | **-31,735** | |

Read honestly: **six of twelve fell, one is flat, and five rose.**

- The six falls are phases 1 and 2 removing eager reference includes -
  `references/git.md` (11,330 B) left five commands' turn one, replaced on four
  of them by the smaller `references/git-guard.md` (6,166 B), and
  `references/conventions.md` (5,115 B) left `/cad-pause` outright. `/cad-land`
  is the largest single win at -5,219 B even though its own SKILL.md GREW by
  1,296 B absorbing the publish rails it stopped including.
- `/cad-verify` is flat to the byte by coincidence, not design: its SKILL.md lost
  24 B this phase and `workflows/verify.md` gained exactly 24 B in phase 2.
- The five rises are all the same shape and none is this phase's doing: the
  command's WORKFLOW file grew in phase 2 (`config.md` +276, `new-project.md`
  +248, `context.md` +224, `execute.md` +198, `plan.md` +37) because phase 2
  inlined guidance where it removed an include, while this phase's SKILL.md cut
  is only 6-45 B per command. `/cad-plan` rose by 37 B with no SKILL.md change at
  all. A description cut cannot pay for a workflow that grew by five times as
  much, and no attempt was made to hide that by netting the two.

Summed over the twelve commands: **231,422 B -> 199,687 B, -31,735 B (-13.7%).**

## 3. Closing measurement - weighed total (new coverage, not growth)

| Tree | Walker | Surfaces | Bytes |
|---|---|---|---|
| `0bf6284` (pre-phase-1) | that tree's own `weight.mjs` | 69 | 246,127 |
| HEAD | this phase's `weight.mjs` | 92 | 418,081 |
| HEAD, previously-budgeted subset | | 69 | 255,895 |
| HEAD, references + templates (new coverage) | | 23 | 162,186 |

Reproduce, unformatted: `node cadence-core/bin/weight.mjs` reports 92 surfaces
totalling `418081` B, of which the 23 `cadence-core/references/` and
`cadence-core/templates/` entries are `162186` B and the previously-budgeted 69
are `255895` B. `git archive 0bf6284 | tar -x -C <tmp>` then
`node <tmp>/cadence-core/bin/weight.mjs --root <tmp>` reports 69 surfaces
totalling `246127` B.

The already-budgeted 69 surfaces GREW across the cycle, 246,127 -> 255,895
(+9,768). That is the same movement section 2 reports from the other side:
phases 1 and 2 moved prose INTO weighed workflow and skill files while cutting
what loads in turn one. Phase 3 is the only cycle phase to shrink this number -
259,048 B at the phase-2 close to 255,895 B now, exactly the -3,153 B the 29
skill and 19 agent description lines gave up.

The 23 reference and template entries are new COVERAGE, not growth. That set
measured 156,572 B at `0bf6284` and 162,186 B at both `35ba9eb` and HEAD - the
+5,614 B is phase 2 adding `git-guard.md`, `git-publish.md` and `triage-gate.md`
against the deleted `git.md`, and the flat `35ba9eb` -> HEAD figure is D-02
holding: this phase budgeted every one of those files at its exact current size
and trimmed no reference prose.

Adding them to the ratchet closes the hole BUD-02 names: before this phase a
162 KB directory pair named in five workflows could grow without limit, and the
largest file in it, `references/acceptance-criteria.md` at 22,506 B, is now
budgeted above the largest budgeted workflow (`workflows/config.md`, 18,541 B).
That size is filed as a capture item rather than fixed here.
