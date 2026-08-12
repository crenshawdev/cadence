---
phase: 2
plan: 1
requirements:
  - ADP-01
files:
  - skills/cad-adopt/SKILL.md
  - cadence-core/workflows/adopt.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/config.md
  - cadence-core/references/git-guard.md
  - cadence-core/references/COMMANDS.md
  - skills/cad-health/SKILL.md
  - README.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: The front door - Plan 1 (ADP-01)

## Goal

A repo that already exists can enter Cadence as itself: `/cad-adopt` reads the
code and the git history, asks only what they cannot answer, and writes the same
`.planning/` shape `/cad-new-project` writes, so every downstream command works
unchanged.

## Must be true when done

- Running `/cad-adopt` in a git repo that has code and no `.planning/` leaves
  PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and config.json on disk, and
  `/cad-health` on that directory reports zero problems.
- The adopted `.planning/` describes REMAINING work: no `- [x]` entry in
  ROADMAP's `## Phases`, a `## Traceability` table of bare headers and zero rows,
  an `### Active` version that is not a member of `git tag --list`, and a STATE
  cursor at phase 1.
- Adopt asks nothing the repo already answers: a README and manifest that state
  the goal, the stack and the build commands are read, not re-interrogated, and
  every question it does ask names something absent from the repo.
- Adopt dispatches no subagent: no route-table role, no rung agent file, no
  `BRACKETING` row, and the brownfield read is paid in the coordinator's own
  context.
- A user who arrives with no `.planning/` through `/cad-progress`, `/cad-health`,
  `/cad-context`, `/cad-config` or the git guard is told about both doors, not
  just the blank-page one.
- `/cad-adopt` is findable by name in `cadence-core/references/COMMANDS.md` (so
  in `/cad-help`) and in `README.md`.
- `node cadence-core/bin/self-verify.mjs` is green: both new surfaces carry
  budget rows and nothing overruns.

## Context

Locked by `.planning/phases/2/CONTEXT.md`: D-01 (inline derivation, no dispatch,
no `BRACKETING` row), D-02 (a new skill plus a NEW `cadence-core/workflows/adopt.md`;
`new-project.md` is untouched here), D-03 (no new role or route cell), D-04
(remaining work only), D-05 (judgment reading, no new detector seam), D-06
(suppression is prose, never a score), D-10 (Traceability stays bare), D-11
(the same `trace ignore` and config-copy setup seams), D-12 (a proposed NEXT
version), D-14 (registration is unenforced and carried as explicit work), D-15
(five refusal surfaces), D-16 (ledger line cites corrected in the same commit).
Out: composing `--brief` with `/cad-adopt`, and everything PLAN-2 owns.

## Tasks

### Task 1: The `/cad-adopt` command, end to end

- **Files:** skills/cad-adopt/SKILL.md, cadence-core/workflows/adopt.md, cadence-core/bin/weight-budgets.json
- **Action:** Create `skills/cad-adopt/SKILL.md` on the shape
  `skills/cad-report/SKILL.md` uses: frontmatter `name: cad-adopt`, a
  description that is ONE routing line (it rides every session's system prompt),
  an `argument-hint`, `allowed-tools` of Read, Write, Edit, Bash, Grep, Glob and
  AskUserQuestion, an `<objective>`, an `<execution_context>` whose only content
  is `@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/adopt.md`, and a `<process>`
  of "Execute end-to-end." Do NOT grant `Task`: D-01 and D-03 bind adopt to zero
  dispatches, so a route-table role, a rung agent file and a
  `cadence-core/bin/trace.test.mjs` `BRACKETING` row are all out, and the tool
  grant is what makes that checkable. Create
  `cadence-core/workflows/adopt.md` with the `<purpose>` / `<process>` /
  `<step name="...">` / `<guardrails>` / `<success_criteria>` structure
  `cadence-core/workflows/new-project.md` and `report.md` share, carrying these
  steps. `setup`: stop when `.planning/PROJECT.md` exists, with the message shape
  at `new-project.md:27-28`; stop when `git rev-parse --git-dir` fails, pointing
  at `/cad-new-project` (which runs `git init`) - adopt's inputs are the code AND
  the history, and git discovers a repo UPWARD from the working directory, so a
  non-repo directory nested under one would answer this whole workflow from an
  enclosing project's history and tags (the diff-review note recorded in
  `.planning/CAPTURE.md` for this phase found the same upward-discovery hazard in
  `readTags`); then, as ONE Bash step the way `new-project.md:22-26` requires,
  `mkdir -p .planning`, `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace ignore --root .`,
  a verbatim `cp` of `cadence-core/templates/config.json` to `.planning/config.json`
  when it is absent, and one
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get` reading
  `planning.commit_docs granularity git.protected_branches git.on_protected git.base_branch`
  (D-11; `/cad-health` rule 1 reports `ignored:false` and `tracked:true` with
  different remedies, so the ignore line is not optional). `survey`: read the
  README, the manifests, the tree shape and `git log` in this context and state
  the shape found in a few lines - no subagent (D-01) and no new detector seam,
  with `planning.mjs detect-commands` neither extended nor required (D-05).
  `write_project`, `write_requirements`, `write_roadmap`: read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/PROJECT.md`, `.../REQUIREMENTS.md`
  and `.../ROADMAP.md` and write the three files - shipped capability under
  PROJECT.md `### Validated` and the current code state in its Context (the
  PROJECT template already states the brownfield rule), an `### Active` milestone
  version that is a PROPOSED NEXT version confirmed through the ask-user seam and
  never the repo's current tag (D-12; `/cad-health` rule 7 reports drift on an
  `### Active` version that is a member of `git tag --list`), REQUIREMENTS.md
  `## Active` ids in the `- **[CAT]-01**: ...` grammar with `## Traceability`
  left as bare headers (D-10; `planning.mjs seed-reqs` reads
  `.planning/phases/<N>/PLAN*.md` and returns `no-phase-dir` / `no-plans` before
  a plan exists, so adopt structurally cannot seed a row and a hand-authored row
  would make `insertReqRows`' `mismatched` arm the normal case), and a ROADMAP.md
  of REMAINING work whose `## Phases` entries are all `- [ ]`, phase count
  following the `granularity` value just read, 2-5 falsifiable criteria per phase,
  every `## Active` id mapped to exactly one phase (D-04; a reconstructed `- [x]`
  phase is refused because `/cad-health` rule 5 flags an `- [x]` phase whose
  mapped REQUIREMENTS rows are not all `Complete`, which is what `Pending` rows
  always are). `state`:
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"`,
  and create no `.planning/phases/` directory. `commit`: honor
  `planning.commit_docs` and apply the protected-branch guard from
  `references/git-guard.md` before the first commit, then ONE `docs:` commit
  naming the five written files. `done`: the terse report shape at
  `new-project.md:311-326`. Finally add `skills/cad-adopt/SKILL.md` and
  `cadence-core/workflows/adopt.md` rows to `cadence-core/bin/weight-budgets.json`
  at their measured byte counts from `node cadence-core/bin/weight.mjs`, because
  self-verify files `unbudgeted-surface` as a hard problem for any measured
  surface with no entry.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and
  reports no `unbudgeted-surface` and no `budget-overrun`;
  `node cadence-core/bin/weight.mjs` lists both new surfaces and each is at or
  under its new budget row; `grep -n "Task" skills/cad-adopt/SKILL.md` returns
  nothing; `grep -rn "adopt" cadence-core/route-table.json cadence-core/bin/trace.test.mjs`
  returns nothing. human-verify (AC1, AC2): in a git checkout that has source and
  no `.planning/` (see Notes for candidates), run `/cad-adopt`; afterwards
  `.planning/` holds PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and
  config.json, `/cad-health` reports zero problems, ROADMAP's `## Phases` shows no
  `- [x]` entry, REQUIREMENTS' `## Traceability` has its headers and zero rows,
  the `### Active` version does not appear in `git tag --list`, and STATE.md names
  phase 1.

### Task 2: Adopt asks only what the repo cannot answer

- **Files:** cadence-core/workflows/adopt.md, cadence-core/bin/weight-budgets.json
- **Action:** Add the questioning step between `survey` and `write_project`, and
  state its rule as prose judgment. What the survey read is ANSWERED and is never
  re-asked; a question is legitimate only when it names something the repo does
  not state. Carry `new-project.md:104-118`'s four background items (what, why,
  who, what done looks like) as a mental checklist that is never a conversation
  structure, and its anti-pattern list, including the ban on asking about the
  user's skill level. Structured questions go through the ask-user seam
  (`references/seams.md`) with the freeform escape rule at `new-project.md:92-102`:
  the moment the user wants to explain in their own words, structured questions
  stop. Forbid explicitly, with the reason: no score, no coverage percentage, no
  threshold, no rubric and no per-item walk of the repo's own documents - phase 1
  D-11 banned the first computed discriminator in this tree on measured evidence
  that a threshold ordered its fixture's phases backwards, and `.planning/ROADMAP.md:66`
  requires this door stay "never a scripted interview" (D-06). Re-pin
  `cadence-core/workflows/adopt.md`'s budget row to its new measured size in the
  same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and
  no `budget-overrun`; `grep -niE "score|threshold|rubric|percent|[0-9]+%" cadence-core/workflows/adopt.md`
  returns only lines that FORBID such a mechanism, never one that defines one.
  human-verify (AC3): walked on a repo whose README and manifest already state its
  goal, its stack and its build commands, adopt asks about none of those three, and
  every question it does ask names something absent from the repo.

### Task 3: The five absent-`.planning/` surfaces learn the second door

- **Files:** cadence-core/workflows/progress.md, skills/cad-health/SKILL.md, cadence-core/workflows/context.md, cadence-core/workflows/config.md, cadence-core/references/git-guard.md, cadence-core/bin/weight-budgets.json
- **Action:** Each of the five sites D-15 names sends an absent-`.planning/` user
  to `/cad-new-project` alone today; make each name both doors, keeping the
  existing wording and voice and adding the shortest true clause. `progress.md:40`
  (the `no-planning-dir` relay), `skills/cad-health/SKILL.md:25` (the missing-dir
  pointer in rule 1), `context.md:39` (the "No roadmap found" stop) and
  `config.md:13` (the absent-config note) each get the brownfield arm:
  `/cad-new-project` for a blank page, `/cad-adopt` for a repo that already has
  code and history. `git-guard.md:41` is not a refusal but the guard's
  no-resolvable-base exception clause, so name adopt truthfully there: adopt
  commits its scaffolding under this same guard, so `/cad-adopt` on a repo whose
  base does not resolve is the same expected exception the clause already grants
  `/cad-new-project` on a fresh repo. All five files sit at exactly their
  `weight-budgets.json` entries and the budget check is a ceiling, so re-pin each
  edited surface's row to its new measured size in the same commit.
- **Verify:** `grep -n "cad-adopt" cadence-core/workflows/progress.md skills/cad-health/SKILL.md cadence-core/workflows/context.md cadence-core/workflows/config.md cadence-core/references/git-guard.md`
  returns at least one hit per file, each inside the region its D-15 line cite
  names; `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and no
  `budget-overrun`; `node cadence-core/bin/test.mjs prose` passes.

### Task 4: Register `/cad-adopt` in the command reference

- **Files:** cadence-core/references/COMMANDS.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a `/cad-adopt` row to the `## Build spine (the core loop)`
  table immediately after the `/cad-new-project` row, in that table's existing
  one-sentence voice, saying it initializes `.planning/` from an existing repo -
  PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the
  code and history. Re-pin the `cadence-core/references/COMMANDS.md` budget row
  to its new measured size. Make no edit to `skills/cad-help/SKILL.md`: its whole
  content is the eager `@`-include of this reference and its `<objective>`
  already names `references/COMMANDS.md` by path, so this row IS cad-help's
  registration and AC7's cad-help clause - an added mention in the skill file
  would be resident bytes that buy nothing.
- **Verify:** `grep -n "cad-adopt" cadence-core/references/COMMANDS.md` shows the
  row under `## Build spine (the core loop)`; `grep -n "COMMANDS.md" skills/cad-help/SKILL.md`
  shows both the eager `@`-include and the objective's naming of it, so
  `/cad-help` renders the new row; `node cadence-core/bin/self-verify.mjs` exits 0
  with `ok:true` and no `budget-overrun`.

### Task 5: README names the second door, and the ledger's README cites are re-pinned

- **Files:** README.md, .planning/DOCS-CLAIMS.md
- **Action:** In README's getting-started path, `## The loop`, name `/cad-adopt`
  as the entrance for a project that already exists, beside the `/cad-new-project`
  step it parallels, and add it to the command lists under `## The commands` in
  the same one-line style the neighbouring entries use. Then, in the SAME commit
  (D-16), correct the `README-*` rows of `.planning/DOCS-CLAIMS.md`: re-pin each
  row's `line` cell to where that claim's text now sits in the live README, on the
  precedent the ledger records at its lines 92-103, where phase 1 of `v3.1.0`
  re-pinned the ten `context.md` rows for exactly this reason. Leave every
  `claim`, `verdict` and `resolution` cell untouched - the join is on `doc` plus
  claim text and nothing here changes what any claim says - and extend the
  `## Reading this ledger` note that records the context.md re-pin with one
  sentence recording this one, so the next sweep reads the README cells as live
  locations rather than run-1 provenance. Do NOT restate README's "23 skills"
  count: it is stale before this phase touches anything and correcting it is not
  this phase's work (see Notes).
- **Verify:** `grep -n "cad-adopt" README.md` shows a hit inside the `## The loop`
  section and one in a `## The commands` list; for README-31, README-39 and
  README-46, `sed -n '<cited line>p' README.md` prints the line each of those
  claims is about; `git diff --stat .planning/DOCS-CLAIMS.md` shows the ledger
  changed in the same commit as README.md; `node cadence-core/bin/self-verify.mjs`
  exits 0 with `ok:true`.

## Notes

- Plan shape: CONTEXT directs multiple plans in this phase with the adopt half
  first. Honored, with the deviation recorded: PLAN-1 and PLAN-2 SHARE
  `README.md`, `.planning/DOCS-CLAIMS.md` and `cadence-core/bin/weight-budgets.json`,
  so they are SEQUENTIAL (PLAN-1 then PLAN-2), not the independent slices a
  parallel split needs. `plan-overlap` will report those three paths and
  `/cad-execute` will route sequential, which is the intended shape - the split
  exists to land the entirely new adopt surface green before `new-project.md`'s
  22 line-cited ledger rows shift underneath it. Same shape phase 1 of this
  milestone used.
- The brownfield walk target for AC1, AC2 and AC3 is the user's pick at
  `/cad-verify 2`. Probed on this machine 2026-08-12: `/code/axel` (74 commits,
  `README.md` + `Cargo.toml` + `SPEC.md`, no `.planning/`) is the cheapest
  candidate and states goal, stack and build commands in exactly the way AC3
  needs; `/code/powercurve` (663 commits) and `/code/headroom` (2,319 commits)
  are the larger alternatives. `/cad-adopt` writes into whichever is chosen, so
  the walk wants a clean working tree there.
- Two CONTEXT flagged assumptions are settled here so the choices are visible:
  adopt REFUSES a directory that is not a git repo rather than running `git init`
  (its inputs are code and history, and git's upward discovery would otherwise
  answer from an enclosing repo), and adopt commits its scaffolding in ONE `docs:`
  commit under the same guard `new-project` uses rather than mirroring that
  workflow's three commits, because adopt derives all three documents in a single
  pass.
- For the human, not built here: `README.md:139`'s "23 skills" is already wrong
  before this phase (the v3.0.0 `cad-report` skill made it 24) and `/cad-adopt`
  makes it 25. Correcting a count this phase did not break would be scope
  invention; it is left standing and named here so the next docs sweep files it
  as its own defect.
