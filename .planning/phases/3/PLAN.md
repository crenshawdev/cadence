---
phase: 3
plan: 1
requirements: [PHS-02]
files:
  - cadence-core/workflows/task.md
  - cadence-core/workflows/context.md
  - skills/cad-task/SKILL.md
  - skills/cad-phase/SKILL.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/seam-calls.test.mjs
---

# Phase 3: The too-big arm opens a door - Plan

## Goal

When `/cad-task` finds an off-roadmap task has grown phase-sized, the action it
names creates the phase the next command requires, so the user is never routed
to a command that will refuse.

## Must be true when done

- A phase-sized task's stop message names `/cad-phase add` as its first action
  and carries the task's own description into it, so the user does not retype
  what Cadence already holds.
- The phase number printed in the sequence is a real number Cadence resolved
  from `planning.mjs status` (`total + 1`), not a `{N}` the user substitutes.
- No `/cad-task` surface still sends a phase-sized task to `/cad-context`
  first: not the workflow's too-big arm, not its mid-task guardrail, not the
  SKILL objective that rides every session's prompt.
- `/cad-context` on a phase number the roadmap does not carry still stops, but
  now names `/cad-phase add` as the action that creates it.
- `/cad-phase`'s `argument-hint` advertises that `add` accepts a description,
  which is what the printed sequence hands it.
- Following the printed sequence in a live session, from a repo whose roadmap
  has no matching phase, reaches a planned phase with no command refusing.
  (human-verify: needs a live Claude Code session)
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with every changed
  prose file's `weight-budgets.json` entry re-pinned in the commit that changed
  it.

## Context

Locked by `.planning/phases/3/CONTEXT.md`: the sequence is three stops, printed
unconditionally with no config branch (D-02); the number is resolved, never a
placeholder (D-03); the task's description rides as the `/cad-phase add`
argument with nothing persisted to disk (D-04, D-08, D-09); exactly three sites
state the old route and they move together (D-06).

Out: `/cad-phase add`'s own behaviour (`cadence-core/workflows/phase.md` is not
edited - `:15` already takes name, description and criteria from args), the
roadmap grammar, and anything downstream of the appended phase line.

Every prose file here sits EXACTLY at its `weight-budgets.json` ceiling
(measured 2026-08-29: task.md 14131, context.md 19421, cad-task/SKILL.md 737,
cad-phase/SKILL.md 1112), so each prose task re-pins its own entries in its own
commit. A re-pin deferred to a later task leaves an intermediate commit red
with `budget-overrun` and breaks AC7's same-commit requirement (D-07).

## Tasks

### Task 1: The too-big arm names /cad-phase add and prints a resolved sequence

- **Files:** `cadence-core/workflows/task.md` (start at the `<step name="scope">`
  step's "Too big" bullet), `cadence-core/bin/weight-budgets.json`
- **Action:** Rewrite the "Too big" bullet's stop message. It must name
  `/cad-phase add` as the FIRST action and pass `$TASK` - the description the
  `parse` step already stores - as its argument, so the phase's gathered words
  carry forward rather than being retyped (D-04). Before printing, the arm
  resolves the phase number by running
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and taking
  `total + 1`; state that rule in the prose and print the resolved number in the
  later stops rather than a `{N}` the user substitutes (D-03). `status` takes no
  flags - that is the `status: {}` row in `cadence-core/bin/lib/arg-contract.mjs`
  and what self-verify check 2 lints the invocation against, so adding a flag to
  it fails the linter. The three stops are `/cad-phase add` -> `/cad-context` ->
  `/cad-plan`, in that order, printed unconditionally with no branch on any
  config key: `skip_discuss` narrows to `/cad-progress`'s next-step suggestion
  alone, and a dotted config token the schema lacks fails self-verify check 1
  (D-02, D-12). Keep the existing `/cad-capture it for later` alternative, and
  keep the arm TERMINAL - it says so and stops, opens no trace bracket and
  writes nothing under `.planning/tasks/<slug>/`, so the `bracket` step's
  parenthetical excluding this arm stays true and unedited (D-08, D-09). Do not
  restate any of this in `cadence-core/workflows/phase.md`; `add`'s own
  behaviour is out of scope and already accepts what this arm hands it. In the
  SAME commit, raise `cadence-core/workflows/task.md`'s entry in
  `weight-budgets.json` to the file's new `wc -c` count - the entry is a ceiling
  sitting exactly at the current size, so any growth is a `budget-overrun`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true`;
  `grep -n "cad-phase add\|cad-context\|cad-plan" cadence-core/workflows/task.md`
  shows the `/cad-phase add` hit at a LOWER line number than the first
  `/cad-context` hit inside the `scope` step, with all three stops present; and
  `node cadence-core/bin/planning.mjs status` on this repo prints a `total`
  whose `total + 1` is the number the arm's stated rule produces.

### Task 2: The other two statements of the old route move with it

- **Files:** `cadence-core/workflows/task.md` (start at the `<guardrails>`
  section's mid-task re-route bullet), `skills/cad-task/SKILL.md` (start at the
  `<objective>` block), `cadence-core/bin/weight-budgets.json`
- **Action:** Two one-sentence edits, both naming the same door task 1 opened.
  task.md's guardrail bullet tells a run whose scope grew past "planned" to stop
  and re-route to `/cad-context`; it must name `/cad-phase add` instead, keeping
  the "rather than improvising a phase inline" clause, which is the bullet's
  actual rail and the reason `/cad-context` was never allowed to create a phase
  itself. `skills/cad-task/SKILL.md`'s objective sentence "Feature-sized
  requests get re-routed to /cad-context." must name `/cad-phase add`; this file
  rides the main session prompt on every session, so leaving it advertises the
  locked door while the workflow body names the open one (D-06). Do NOT restate
  the three-stop sequence at either site: a second copy can drift from task 1's,
  and both surfaces are at their byte ceiling. Re-pin BOTH entries -
  `cadence-core/workflows/task.md` and `skills/cad-task/SKILL.md` - in
  `weight-budgets.json` in this same commit.
- **Verify:** `grep -n "cad-context" cadence-core/workflows/task.md
  skills/cad-task/SKILL.md` returns no hit at all in `skills/cad-task/SKILL.md`
  and no hit inside task.md's `<guardrails>` block; the only surviving task.md
  hits are the second stop of task 1's sequence.
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 3: The off-roadmap stop in /cad-context names the same door

- **Files:** `cadence-core/workflows/context.md` (start at
  `<step name="resolve_phase">`), `cadence-core/bin/weight-budgets.json`
- **Action:** The sentence "If the phase number is not in the roadmap, stop and
  say so." names nothing further, so a user arriving by any route other than
  `/cad-task` - a stale STATE cursor, a typed number - meets a refusal with no
  exit. Extend it to name `/cad-phase add` as the action that creates the phase,
  in the same shape as the sibling stop directly above it, which already names
  `/cad-new-project` and `/cad-adopt` when ROADMAP.md is absent. The stop
  BEHAVIOUR is unchanged: `resolve_phase` still stops, and must NOT create the
  phase inline - that collides with task 2's "rather than improvising a phase
  inline" rail and widens `/cad-context` past gathering (D-05). Nothing in
  `cadence-core/bin/self-verify.mjs` forces this hint (check 22 lints only
  `.mjs` sites emitting an `ok:false` envelope) and nothing forbids it; it is
  scope taken by explicit user decision. Re-pin
  `cadence-core/workflows/context.md` in `weight-budgets.json` in this same
  commit.
- **Verify:** `grep -n "not in the roadmap" cadence-core/workflows/context.md`
  shows a stop whose text names `/cad-phase add`;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 4: /cad-phase's argument-hint advertises the description add already takes

- **Files:** `skills/cad-phase/SKILL.md` (start at the `argument-hint`
  frontmatter field), `cadence-core/bin/weight-budgets.json`
- **Action:** `argument-hint` reads `"add | insert <N> | remove <N> | edit <N>"`,
  which tells the user `add` takes nothing, while
  `cadence-core/workflows/phase.md:15` takes the name, description and criteria
  "from args or the ask-user seam". Change the `add` alternative ALONE so it
  advertises the description argument; leave the other three alternatives
  byte-identical, because each takes a phase number and nothing else. Change no
  other frontmatter field - `name`, `description` and `allowed-tools` are
  untouched - and do not edit `cadence-core/workflows/phase.md`, whose `add` arm
  already accepts what task 1's sequence hands it. Re-pin
  `skills/cad-phase/SKILL.md` in `weight-budgets.json` in this same commit.
- **Verify:** `grep -n "argument-hint" skills/cad-phase/SKILL.md` shows a hint
  whose `add` alternative names a description argument and whose
  `insert`/`remove`/`edit` alternatives are unchanged;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` and
  `node cadence-core/bin/test.mjs` is green.

### Task 5: Tests pin the new route so it cannot drift back

- **Files:** `cadence-core/bin/prose-agreement.test.mjs`
- **Action:** Add tests to this existing file - it is already in `test.mjs`'s
  `prose` group, already reads live documents through its `doc()` helper, and
  already compares prose against a resolver's own output via `execFileSync`,
  which is exactly the shape of assertion (2) below. Pin five facts, one test
  each, each assertion carrying a message naming which route regressed: (1)
  task.md's too-big arm names `/cad-phase add` at a LOWER string index than its
  first `/cad-context` occurrence, and all three stops appear in order; (2) the
  arm names `planning.mjs status` and the `total + 1` rule, checked against a
  real run of `node cadence-core/bin/planning.mjs status` in this repo whose
  envelope carries an integer `total` - so the printed number is one Cadence can
  resolve rather than a placeholder; (3) the arm's first stop carries the task's
  own description, and `skills/cad-phase/SKILL.md`'s `argument-hint` advertises
  a description on `add`; (4) `skills/cad-task/SKILL.md` names no `/cad-context`
  and task.md's `<guardrails>` block names `/cad-phase add`; (5)
  `cadence-core/workflows/context.md`'s off-roadmap stop names `/cad-phase add`.
  Assert on ORDER and on the NAMED site, never on a bare tree-wide
  `/cad-context` count: the arm legitimately names `/cad-context` as its second
  stop, so a test forbidding the string outright would go red on correct prose -
  and that is the mistake AC4's own wording guards against. Do not pin any line
  NUMBER in these assertions; line numbers rot on the next edit to either file.
  No new test file and no new module.
- **Verify:** `node cadence-core/bin/test.mjs` is green (the new tests run under
  its `prose` group). Then, as a mutation check, temporarily restore task 1's
  old sentence "Route it through /cad-context -> /cad-plan" in place of the new
  arm: `node cadence-core/bin/test.mjs prose` fails on assertion (1)'s named
  message and not on an unrelated one. Restore the new arm and confirm green
  again.

## Notes

- AC6 is human-verify by design. There is no runner in this repo that executes
  three slash-command workflows end to end, and the CONTEXT flags building one
  as the failure mode to avoid; the mechanical half of AC6 is task 5's
  assertion (2), which proves the number the sequence prints is one
  `planning.mjs status` actually yields on this repo. The live half belongs to
  `/cad-verify`'s UAT walk.
- Structure matches the CONTEXT `Plan shape` directive: one plan, four prose
  files, one `argument-hint` line, budget re-pins, and tests in an existing
  file. No deviation. The re-pins are distributed across the four prose tasks
  rather than collected into one, because AC7 requires the re-pin in the SAME
  commit as the prose change and every one of these files sits exactly at its
  ceiling - a single trailing re-pin task would leave four red intermediate
  commits.
- `cadence-core/bin/weight-budgets.json` is declared once in this plan's
  `files:` lease and written by tasks 1-4. The tasks are sequential in one plan,
  so there is no cross-slice collision; they must not be reordered into a
  parallel path.
- No line-pinned linter binds these files: `citation-census.test.mjs` pins
  `planning*.mjs:<line>` citations and DOCS-CLAIMS rows naming the planning seam
  (`lease-check.mjs`, `trace.mjs`, `uat.mjs`, `criteria-coverage.mjs`), none of
  which this phase touches (D-11). A tree-wide search for `task.md:<line>` and
  `context.md:<line>` citations outside `.planning/` returns nothing.
- The v3.6.0 phase 3 UAT item "task.md names no planning machinery" does not
  bind: it is enforced nowhere live and the archive records it as already false
  against shipped code (D-10). Recalled prior art from that same phase - the
  `/cad-why` off-roadmap task rendering (v3.6.0 phase 3 UAT) - concerns
  `.planning/tasks/<slug>/RECORD.md`, which this phase writes nothing into.
