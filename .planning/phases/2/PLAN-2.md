---
phase: 2
plan: 2
requirements:
  - BRF-01
files:
  - cadence-core/bin/fixtures/verbatim.design-brief.md
  - cadence-core/bin/design-brief.test.mjs
  - cadence-core/workflows/new-project.md
  - skills/cad-new-project/SKILL.md
  - cadence-core/bin/weight-budgets.json
  - docs/DISCOVERY.md
  - README.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: The front door - Plan 2 (BRF-01)

## Goal

A design brief a freeform conversation already produced is an input to Cadence,
not something the init re-derives: `cad-new-project --brief <file>` reads the
brief whole and asks only what it leaves open, and a `docs/` page tells a user
how to arrive that way.

## Must be true when done

- `/cad-new-project --brief <file>` reads the brief whole and treats what it
  settles as answered; replayed against verbatim's own brief it re-asks none of
  the problem, the users, the non-goals, the stack or the constraints.
- Every question a `--brief` run does ask traces to something the brief leaves
  open, and the suppression is a stated judgment rule - no marker convention, no
  parser, no score, no gate.
- Verbatim's brief is committed as a fixture and a CI test asserts its structural
  facts, so the rule's ground is in the tree rather than on one machine.
- A `docs/` page states the freeform-conversation to design-brief to `--brief`
  sequence and what a good brief answers, and README's getting-started path links
  to it by path.
- `node cadence-core/bin/self-verify.mjs` is green, and the doc-claim ledger's
  line cites for `cadence-core/workflows/new-project.md` and `README.md` point at
  the live text rather than at lines this plan moved.

## Context

Locked by `.planning/phases/2/CONTEXT.md`: D-07 (`--brief` parsed in
`new-project.md`'s EXISTING `setup` step, read whole by `Read`, no parser, no
schema, no `planning.mjs` subcommand), D-08 (suppression keys off what the brief
SAYS, never off a marker convention), D-09 (the fixture's test asserts structural
facts, never the question set), D-13 (the page lands under `docs/`, where it takes
no budget row), D-16 (ledger line cites corrected in the same commits). Runs
AFTER PLAN-1: the two share `README.md`, `.planning/DOCS-CLAIMS.md` and
`cadence-core/bin/weight-budgets.json`.

## Tasks

### Task 1: Commit verbatim's brief as a fixture with a structural test

- **Files:** cadence-core/bin/fixtures/verbatim.design-brief.md, cadence-core/bin/design-brief.test.mjs
- **Action:** Copy `/data/code/verbatim/DESIGN-BRIEF.md` byte-for-byte to
  `cadence-core/bin/fixtures/verbatim.design-brief.md`. The name follows
  `cadence-core/bin/fixtures/verbatim.trace.jsonl`, the run record phase 1
  committed unredacted from the same project, which is the precedent for
  importing a verbatim artifact whole. Write
  `cadence-core/bin/design-brief.test.mjs` in the tree's existing test style
  (`node:test` plus `node:assert/strict`, resolving the repo root from
  `import.meta.url` the way the other `cadence-core/bin/*.test.mjs` files do),
  asserting STRUCTURAL facts of the fixture ONLY (D-09): that a `## 17. Open items`
  heading exists; that the table beneath it carries exactly five data rows and
  that they name the auto-tuner, the `UserPromptSubmit` cost on Windows, the
  `/data/verbatim-legacy` import, the other harnesses and multi-machine sync;
  that each of those rows' Status cell is prose and none of them is the literal
  `**OPEN**`; and that the whole brief contains exactly two `OPEN` occurrences -
  the convention statement near the top and one inline marker - which is the
  measurement D-08's rule rests on. Assert NOTHING about the question set: a test
  over questions goes red on rewording rather than on behaviour. Do not edit
  `cadence-core/bin/test.mjs`: a stem no `GROUPS` entry names falls into `other`,
  and the CI matrix in `.github/workflows/test.yml` already runs `other`, so the
  file is never silently unrun.
- **Verify:** `node --test cadence-core/bin/design-brief.test.mjs` passes;
  `node cadence-core/bin/test.mjs --list` shows `design-brief` under `other`;
  `node cadence-core/bin/test.mjs other` passes;
  `cmp cadence-core/bin/fixtures/verbatim.design-brief.md /data/code/verbatim/DESIGN-BRIEF.md`
  reports no difference (if it does, the source brief was edited since planning and
  the assertions are re-anchored to the committed bytes, with the deviation logged).

### Task 2: `--brief <file>` is parsed, and what the brief settles is not re-asked

- **Files:** cadence-core/workflows/new-project.md, skills/cad-new-project/SKILL.md, cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** In the EXISTING `setup` step of `cadence-core/workflows/new-project.md`,
  parse `--brief <file>` beside the `--research` flag already parsed there, and
  read the named file whole with `Read` - no parser, no schema, no
  `planning.mjs` subcommand, because the brief's whole value is that it is
  freeform and a schema would impose the structure the discovery deliberately
  lacks (D-07). A `--brief` path that does not resolve stops with one line naming
  the path, never a silent fall-through into the blank-page interview. In the
  `questioning` step, state what a brief changes: its settled content is treated
  as ANSWERED, so the opening freeform question is replaced by a short read-back
  of what the brief settles plus an invitation to correct it, and the four
  background items at lines 106-109 that the brief leaves open are what gets
  asked. Suppression keys off what the brief SAYS, never off a marker convention -
  keying on a literal `**OPEN**` marker makes a brief that lacks the convention
  read as fully settled and skips the questioning entirely, which is BRF-01's own
  failure mode inverted (D-08). No score, no coverage gate, no checklist walk
  (D-06). Keep every existing rule of that step intact, including the freeform
  rule and the anti-patterns. Update `skills/cad-new-project/SKILL.md`'s
  `argument-hint` to carry `--brief <file>` alongside `--research` and name the
  flag in its `<objective>`. Re-pin the `cadence-core/workflows/new-project.md`
  and `skills/cad-new-project/SKILL.md` budget rows to their new measured sizes -
  both sit at exactly their entries today, so any addition overruns the ceiling.
  In the SAME commit (D-16), re-pin the 22 `NEW-PROJECT-*` rows in
  `.planning/DOCS-CLAIMS.md` to where each claim's text now sits in the live file,
  on the precedent the ledger records at its lines 92-103, leaving the `claim`,
  `verdict` and `resolution` cells untouched.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and
  no `budget-overrun`; `node cadence-core/bin/test.mjs prose` passes; for
  NEW-PROJECT-03, NEW-PROJECT-09 and NEW-PROJECT-22,
  `sed -n '<cited line>p' cadence-core/workflows/new-project.md` prints the text
  each of those rows claims. human-verify (AC5): in an empty directory, run
  `/cad-new-project --brief` against the committed fixture; it does not re-ask the
  problem, the users, the non-goals, the stack or the constraints, and every
  question it does ask traces to an open item in the brief.

### Task 3: A `docs/` page for the discovery workflow

- **Files:** docs/DISCOVERY.md
- **Action:** Write the one-page guide to arriving with a brief: the sequence -
  a freeform conversation with any model, then a design brief that conversation
  produces, then `/cad-new-project --brief <file>` - and what a good brief
  answers: the problem, the user, the non-goals and the real constraints. State
  plainly that this is guidance and not a scripted interview, and why: the
  discovery works BECAUSE it is freeform, so a page that turned into a
  question script would destroy the thing it documents. Name
  `cadence-core/bin/fixtures/verbatim.design-brief.md` as the worked example and
  say what it does well. Keep it a page. It lands under `docs/`, which takes no
  `weight-budgets.json` row and is linted by no self-verify check (D-13), but it
  IS inside `/cad-docs-verify`'s default target set at
  `cadence-core/workflows/docs-verify.md:9`, so every path, command and flag it
  names must resolve in the live tree. A new file rather than a section of
  `docs/WORKFLOW.md`, settling that CONTEXT flagged assumption: WORKFLOW.md is
  the in-loop figure document and this is what happens BEFORE the loop starts, so
  they differ in trigger and in lifecycle.
- **Verify:** `docs/DISCOVERY.md` exists and names the freeform-conversation to
  design-brief to `--brief` sequence and all four of the things a good brief
  answers; every repo path it cites resolves (`ls` each one); no
  `weight-budgets.json` row was added for it and
  `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true`.

### Task 4: README's getting-started path links the discovery page

- **Files:** README.md, .planning/DOCS-CLAIMS.md
- **Action:** In README's getting-started path, `## The loop`, link
  `docs/DISCOVERY.md` by path beside the `/cad-new-project` step, in one sentence
  naming `--brief` as the way a project that already had a discovery conversation
  starts - the same link style the neighbouring `docs/WORKFLOW.md` and
  `docs/EVIDENCE.md` references use. Then, in the SAME commit (D-16), re-pin the
  `README-*` rows of `.planning/DOCS-CLAIMS.md` that this insert moves, exactly as
  PLAN-1 task 5 did, leaving their `claim`, `verdict` and `resolution` cells
  untouched.
- **Verify:** `grep -n "docs/DISCOVERY.md" README.md` shows the link inside the
  `## The loop` section; for README-31, README-39 and README-46,
  `sed -n '<cited line>p' README.md` prints the line each of those claims is
  about; `git diff --stat .planning/DOCS-CLAIMS.md` shows the ledger changed in the
  same commit as README.md; `node cadence-core/bin/self-verify.mjs` exits 0 with
  `ok:true`.

## Notes

- Plan shape: this plan is the second half of the CONTEXT-directed split and runs
  AFTER PLAN-1. They share `README.md`, `.planning/DOCS-CLAIMS.md` and
  `cadence-core/bin/weight-budgets.json`, so `plan-overlap` will report those
  paths and `/cad-execute` routes sequential - the intended shape, not a parallel
  slice. Both README tasks re-pin the same ledger rows in sequence, which is
  deliberate: each commit leaves the cites true for the tree it produced.
- Two CONTEXT flagged assumptions are settled here so the choices are visible:
  the fixture's filename is `cadence-core/bin/fixtures/verbatim.design-brief.md`,
  following `verbatim.trace.jsonl`'s `<project>.<artifact>` convention, and the
  discovery page is a NEW `docs/DISCOVERY.md` rather than a section absorbed into
  `docs/WORKFLOW.md`.
- Task 1's fixture copy reads `/data/code/verbatim/DESIGN-BRIEF.md`, which is
  outside this repo and outside the `.planning/` corpus. It was measured
  2026-08-12 at 29,447 B / 527 lines with a five-row `## 17. Open items` table; if
  that file has changed by execution time, the `cmp` in task 1's verify is what
  catches it and the assertions re-anchor to the committed bytes.
