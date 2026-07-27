---
phase: 2
plan: 1
requirements: [SPN-01]
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/bin/branch-decision.test.mjs
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/audit.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/milestone.md
  - cadence-core/workflows/config.md
  - cadence-core/workflows/new-project.md
  - cadence-core/references/req-traceability.md
  - cadence-core/references/seams.md
  - cadence-core/references/git.md
  - cadence-core/config.schema.json
  - cadence-core/templates/REQUIREMENTS.md
  - skills/cad-audit/SKILL.md
  - agents/cad-executor.md
  - METHOD.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/1/PLAN.md
  - .planning/phases/1/PLAN-2.md
  - .planning/CAPTURE.md
---

# Phase 2: The spine's own bookkeeping - Plan

## Goal

`/cad-plan` seeds a `## Traceability` row for every requirement the plan it just
wrote declares, so a milestone close never again needs a hand-populated table
before `/cad-audit` can pass; and an executor dispatched into a worktree that
does not contain its own `PLAN-<k>.md` halts instead of planning against an old
merge point.

## Must be true when done

- Running `/cad-plan` on a phase whose plan declares `requirements: [X]`, where
  `X` has a `## Active` bullet in REQUIREMENTS.md, leaves exactly one
  `| X | Phase <N> | Pending |` row under `## Traceability`; a second run leaves
  that one row and names `X` under `skipped`; a declared id with no `## Active`
  bullet gets no row and is still reported under `audit`'s `orphans.plan_ids`.
- `node cadence-core/bin/planning.mjs audit` on this repo reports
  `counts.total: 2` (GRM-01 traced to phase 1, SPN-01 pending on phase 2)
  instead of today's `total: 0` - the vacuous empty-table PASS that let the
  v1.2.0 and v1.3.1 closes through.
- `audit` against a tree whose `## Traceability` holds zero rows returns an
  additive `unseeded` field naming the `## Active` ids that have no row, while
  `counts` and the PASS/FAIL verdict for that same tree are byte-identical to
  today's output.
- A `PLAN-gaps.md` in a phase directory is named by both `audit` and
  `plan-overlap` as a non-conforming plan filename; a `PLAN-2.md` beside it is
  not.
- A cad-executor in worktree mode that cannot find its own `PLAN-<k>.md` under
  the worktree cwd returns a `blocked` checkpoint naming the missing file before
  any task-1 commit, and repairs nothing itself (no merge, rebase, fetch or
  reset). (human-verify: needs a live parallel `/cad-execute` run under host
  worktree isolation)
- No shipped surface still claims a worktree forks from HEAD or the integration
  tip - `references/git.md`, `lib/branch-decision.mjs`, `METHOD.md` and
  `workflows/config.md` all state the host-owned binding instead, and
  `references/seams.md` states it where `execute.md:151-152`'s dangling
  reference points.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` are all green, the new seeding grammar
  covered at both the parser level and the seam level, with no `budget-overrun`.

## Context

`.planning/phases/2/CONTEXT.md` is locked; read it first. The seeding step was
never authored anywhere (D-01), so this builds it rather than repairing it: ids
come from the plan file's `requirements:` frontmatter (D-02), the write is a new
`planning.mjs` subcommand and never model-authored markdown (D-04), it is
idempotent (D-05), and it seeds only ids already declared under `## Active` so
`orphans.plan_ids` stays reachable (D-06). The unseeded-table signal is additive
and the audit verdict arithmetic does not move (D-07). Cadence cannot pin the
worktree fork point, so the executor-side assertion is the whole fix and it
halts `blocked` without self-repair (D-08, D-09, D-12). Durable rules go in
`cadence-core/references/` where `surface-weight.mjs` does not walk (D-16), and
every measured surface this phase touches is at exactly zero budget headroom, so
`weight-budgets.json` moves in the same commit as any growth (D-15). Out of
scope: the audit PASS/FAIL arithmetic (D-07), any host-side worktree control
(D-10), any `phase-done` `reqs:[]` parser change (D-14), and any `## Active`
requirement for a milestone other than v1.4.0. Shapes to follow: the additive
omitted-when-empty envelope fields at `planning.mjs:514-520` and `:564-572`, the
stated-grammar reference `cadence-core/references/plan-frontmatter.md`, and the
parser-level table style in `cadence-core/bin/planning-files.test.mjs`.

## Tasks

### Task 1: Give the requirements table a stated grammar and an insert path

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs
- **Action:** In the `REQUIREMENTS.md` section of `planning-files.mjs` (beside
  `parseRequirements`/`setReqStatus`, which stay untouched), add and export two
  functions. First `parseActiveIds(text)`: isolate the `## Active` section with
  the module's existing `sectionBody(text, 'Active')` helper (declared lower in
  the file - function declarations hoist, so no reordering), and return the ids
  of every bullet matching `/^-\s+(?:\[[ xX]\]\s+)?\*\*([^*]+)\*\*/`, trimmed,
  de-duplicated first-occurrence-wins. Return `null` - not `[]` - when the
  heading is ABSENT, so a caller can tell "no milestone scope declared" from
  "declared, nothing matched"; the doc comment must repeat
  `parseContextDecisions`' warning that the test is `=== null`, never
  `!body`, because `sectionBody` returns `""` for a present-but-empty heading. A
  bullet with no bold span declares no id by design - the id list the seam
  reports back is what makes a mis-typed bullet visible, so do NOT add a
  fallback that guesses an id out of unbolded prose. Second
  `insertReqRows(text, rows)` taking `rows` as `[{id, phase}]` and returning
  `{text, inserted, skipped, mismatched, error?}`: bound the `## Traceability`
  section at the next `## ` heading exactly as `parseRequirements` and
  `setReqStatus` already do (a table under a later section is somebody else's
  data); find the header row and the all-dashes/colons separator inside it and
  return `{text, inserted: [], skipped: [], mismatched: [], error:
  'no-traceability-table'}` with the text unchanged when there is no separator -
  never fabricate a table. Read the existing ids through `parseRequirements(text)`
  so the reader and the writer of this one table cannot drift; an id that
  already has a row is pushed to `skipped` and, when that row's phase differs
  from the requested one, also to `mismatched` as `{id, row_phase}` (a renumber
  or a moved requirement leaving the row pointing elsewhere must not pass as a
  clean skip). Insert the remaining rows after the LAST contiguous line starting
  with `|` at or below the separator, so the trailing prose paragraph under the
  table survives byte-identical. Render each row as
  `| ${id} | Phase ${phase} | Pending |` - the `Phase N` spelling is mandatory
  and its reason goes in the comment: `shiftPhaseTokens` (`:919`) shifts only
  `Phase K` tokens and `phases/K/` paths, and `renumber remove`'s orphan-blanking
  regex (`planning.mjs:792`) tests `\bPhase ${at}\b`, so a bare-number phase cell
  would silently desync the whole table on the next phase insert or removal.
  Status is the literal `Pending` and is NOT a parameter: the seam must be
  incapable of creating a row at any other status, which is what keeps D-01's
  restated invariant ("no writer but cad-verify ever writes a non-`Pending`
  Status") true by construction. Preserve the anchor line's line ending - when it
  ends with `\r`, the inserted row ends with `\r` too - since this is a write
  path and phase 1's D-05 keeps `normalize` off write paths.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes with
  new rows covering: a plain bullet, a checkbox bullet, an unbolded bullet
  (ignored), a duplicate id (once), an absent `## Active` (null), a
  present-but-empty one (`[]`), and a `## Active`-shaped list under a later
  heading (not read); insertion into an empty table landing directly under the
  separator with the following prose paragraph byte-identical; insertion after
  existing rows appending below the last one; a re-insert of the same id
  reporting `skipped` and returning byte-identical text; a differing phase
  reported in `mismatched`; a CRLF fixture getting a CRLF row; and a table with
  no separator returning `error: 'no-traceability-table'` with the text
  unchanged.

### Task 2: `seed-reqs`, called by `/cad-plan` right where the plan is written

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs, cadence-core/bin/self-verify.mjs, cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json
- **Action:** Add `cmdSeedReqs(dir, opts)` to `planning.mjs` plus its dispatch-table
  entry `'seed-reqs': (dir, _sub, opts) => cmdSeedReqs(dir, opts)` (the file grows
  by dispatch entry, never by if-chain) and a header comment line beside the other
  subcommands. Validate `--phase` through `requireCursorNumber(opts.phase,
  { decimal: true })`, failing `bad-args` before any read (the #42/#45 rail).
  Degrade, never throw: absent REQUIREMENTS.md -> `fail('no-requirements', ...)`;
  absent phase dir -> `fail('no-phase-dir', ...)`; a phase dir with no conforming
  `PLAN(-\d+)?.md` -> `fail('no-plans', ...)` with the hint `/cad-plan <N>`.
  Collect ids in plan-file order via `parsePlanRequirements`, union
  first-occurrence-wins, and carry the frontmatter issues into an additive
  `frontmatter_issues: [{file, issues}]` field in the same shape `cmdAudit`
  emits - a plan whose frontmatter fell outside the grammar must say so at the
  moment its ids are being written, not only at the next audit. Partition the
  ids against `parseActiveIds(reqText)`: ids with an `## Active` bullet go to
  `insertReqRows` with `phase` = the validated N; every other id goes to an
  additive `orphan_ids` list and gets NO row (D-06 - seeding every declared id
  would make `orphans.plan_ids` unreachable at `planning.mjs:506-511` and
  silently delete the audit's reverse direction that `METHOD.md:442-445`
  publishes). Name that field `orphan_ids`, NOT `orphans`: `cmdAudit` already
  emits `orphans` as the object `{plan_ids:[{file, ids}]}` at `planning.mjs:516`,
  and one binary must not ship one key name carrying two incompatible shapes -
  a consumer or doc that learned `orphans.plan_ids` would read `undefined` here.
  When `parseActiveIds` returns `null`, add `no_active_section: true`
  so an unopened milestone is distinguishable from a declared-but-unmatched id.
  Relay `insertReqRows`' `error` as `fail('no-traceability-table', ...)`, and
  `atomicWrite` the file only when `inserted.length` is non-zero. Emit
  `{ok:true, phase, seeded, skipped, ...}` with `seeded` and `skipped` ALWAYS
  present even when empty - contrary to the envelope's omit-empty convention and
  deliberately so, following `uat merge`'s always-present counts: a bookkeeping
  step that has now failed twice by writing nothing must report writing nothing -
  while `mismatched`, `orphan_ids`, `frontmatter_issues` and `no_active_section`
  stay omitted when empty. Add `'seed-reqs': ['--phase']` to `CONTRACTS` in
  `self-verify.mjs`. Then wire it into `cadence-core/workflows/plan.md`'s
  `commit` step as a new item 1 ahead of the cursor set (renumbering the existing
  two), stating: the call with `--phase {N}`, that it inserts
  `| <id> | Phase {N} | Pending |` for exactly the declared ids that have an
  `## Active` bullet, that it is idempotent so a replan or a `--gaps` plan cannot
  duplicate a row, that `orphan_ids` must be reported to the user because it is
  scope creep or a typo, that `no_active_section: true` is a DIFFERENT report -
  the milestone's `## Active` section is absent (an old-heading project, or a
  close that never seeded), so the ids are not scope creep and the fix is to
  open the section, not to edit the plan - that Status is always `Pending` because cad-verify
  remains the only writer of any other status, and that `ok:false` is reported
  and the workflow continues (the plan is already on disk; seeding is not a
  gate). Add `.planning/REQUIREMENTS.md` to the files that step stages when the
  seam reported seeded ids, a `Traceability:` line to the `done` report, and one
  `success_criteria` checkbox. Regenerate `cadence-core/workflows/plan.md`'s
  entry in `weight-budgets.json` from `node cadence-core/bin/weight.mjs` in this
  same commit - it sits at 12362/12362 and any byte fails CI otherwise (D-15).
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with new
  seam tests over `makeTree` fixtures: a plan declaring an id with an `## Active`
  bullet returns `{seeded:["X"], skipped:[]}` and the file gains exactly the row
  `| X | Phase 1 | Pending |`; the second run returns `{seeded:[], skipped:["X"]}`
  with the file byte-identical; an id with no `## Active` bullet returns it under
  `orphans` with no row written and `audit` still lists it under
  `orphans.plan_ids`; a missing `## Active` heading returns
  `no_active_section: true`; `--phase` absent/`abc`/`-1` all return `bad-args`
  with nothing written; a malformed `requirements:` line surfaces
  `frontmatter_issues`; and `node cadence-core/bin/planning.mjs renumber insert
  --at 1 --dir <fixture>` after a seed leaves the seeded row reading `Phase 2`.
  `node cadence-core/bin/self-verify.mjs` exits 0 with no `budget-overrun` and
  no `unknown-subcommand` or `unknown-flag` finding naming `seed-reqs` - those
  are the kinds `self-verify.mjs:264,271` actually emits (there is no
  `unknown-invocation`), and they are what proves the new call written into
  `plan.md` matches the `CONTRACTS` entry rather than only that the entry exists.
  Additionally assert the integration by hand once: `grep -n "seed-reqs"
  cadence-core/workflows/plan.md` shows the call inside the `commit` step ahead
  of the `cursor set`, carrying `--phase {N}`.

### Task 3: Make an unseeded table and a non-conforming plan file loud in `audit`

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs, cadence-core/workflows/audit.md, cadence-core/bin/weight-budgets.json
- **Action:** Two additive diagnostics, neither of which may touch a count or a
  verdict. First, in `cmdAudit`, when `parseRequirements` returned zero rows,
  emit `unseeded: { active_ids: [...] }` from `parseActiveIds`, keeping
  `active_ids` present inside the object even when empty. Preserve
  `parseActiveIds`' null-vs-`[]` distinction rather than coercing null to `[]`:
  add `no_active_section: true` inside the same `unseeded` object when the
  heading is ABSENT, omitted otherwise. Task 1 builds that distinction precisely
  so a caller can tell "no milestone scope declared" from "declared, nothing
  matched", and `unseeded` is the one diagnostic whose job is to separate
  "milestone never opened" from "declared but never seeded" - collapsing both to
  `active_ids: []` here would throw away the datum the field exists to carry, and
  would silently misreport a pre-v1.4.0 project (whose heading is still
  `## v1 Requirements`, see Task 4) as a milestone nobody opened. This closes the blind spot
  verified live on this repo today, where `audit` returns
  `counts:{total:0,...}` and `audit.md:43-46`'s `counts.broken == 0` PASSes an
  empty table. Do NOT add a third verdict state and do not alter `counts` -
  `audit.md:43-50` forbids softening the gate. Second, replace the inline
  `readdirSync(...).filter(/^PLAN(-\d+)?\.md$/)` in BOTH `cmdAudit` (`:476`) and
  `cmdPlanOverlap` (`:535`) with one shared helper `listPlanFiles(pdir)`
  returning `{plans, nonconforming, missing}`, where `nonconforming` is every entry that
  starts with `PLAN`, ends with `.md`, and fails the conforming pattern, and
  `missing: true` reports that `pdir` could not be read at all. That third field
  is load-bearing, not decoration: the two callers have OPPOSITE absent-directory
  contracts today - `cmdAudit:476` swallows the ENOENT to mean "unplanned", while
  `cmdPlanOverlap:536` returns `fail('no-phase-dir', ...)` (verified live:
  `plan-overlap --phase 99` prints `{"ok":false,"reason":"no-phase-dir"}` and
  exits 1). A helper with no channel for that turns an absent phase dir into
  `{ok:true, plans:[], overlaps:[], note:'fewer than two plans'}` - a check that
  could not run reported as a check that passed, which `execute.md:69`'s
  `choose_path` (it routes sequential only on `ok:false`) would then read as
  clearance to run parallel. Each caller keeps its own behavior on `missing`.
  Emit it
  as `nonconforming_plans` - `phases/<n>/<file>` paths in phase order on the
  audit envelope, bare filenames on the plan-overlap envelope, present on
  `cmdPlanOverlap`'s fewer-than-two-plans early return as well as its normal
  return, omitted when empty on both. This closes phase-1 D-21: a `PLAN-gaps.md`
  (shipped once at `eb6db8f`) is invisible to `status`, `audit`, `plan-overlap`
  and the executor dispatch alike, so its requirements and its files are read by
  nothing while everything reports success. Keep it a report only - it must not
  become a break, a count, or a `choose_path` routing input; naming it is the
  fix, and `agents/cad-planner.md:144-145` already directs gaps mode at a
  conforming name. Document both fields in `cadence-core/workflows/audit.md`'s
  section 2 field list (one clause each: `unseeded` = the table has no rows at
  all, with the `## Active` ids that should have them, seeded by `/cad-plan`;
  `nonconforming_plans` = a `PLAN*.md` no seam and no executor reads), and state
  under section 4 that both are additive and change no verdict. Regenerate
  `cadence-core/workflows/audit.md`'s `weight-budgets.json` entry (3037/3037) in
  the same commit.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with tests
  proving: for one fixture tree, the audit output with the new field present is
  otherwise byte-identical to the pre-change output - assert the exact
  `counts` object and that `requirements`/`orphans` are unchanged - and a
  `PLAN-gaps.md` dropped beside a `PLAN-2.md` appears in `nonconforming_plans` on
  both `audit` and `plan-overlap` while `PLAN-2.md` does not, with
  `plan-overlap`'s `overlaps` unchanged. A regression test pins the absent-dir
  contracts across the refactor: `plan-overlap --phase 99` still returns
  `{ok:false, reason:'no-phase-dir'}` and exits 1, while `audit` over a roadmap
  phase with no directory still treats it as unplanned and returns `ok:true` -
  neither is pinned by a test today, so the refactor could regress silently.
  `node cadence-core/bin/planning.mjs audit` on this repo prints `unseeded` with
  `no_active_section: true` alongside `counts.total: 0` (it still will until
  Task 6 runs).

### Task 4: Write the grammar down, and give the `## Active` section an author

- **Files:** cadence-core/references/req-traceability.md, cadence-core/templates/REQUIREMENTS.md, cadence-core/workflows/milestone.md, cadence-core/workflows/new-project.md, cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Write `cadence-core/references/req-traceability.md` as the stated
  grammar for the REQUIREMENTS.md tables, following
  `references/plan-frontmatter.md`'s structure: what `## Active` is (the open
  milestone's committed scope) and its exact bullet form
  `- **<ID>**: <one line>` with the optional checkbox, bounded at the next
  `## `, first occurrence wins, an unbolded bullet declaring nothing; what
  `## Traceability` is and its row form `| <ID> | Phase <N> | <Status> |` with
  `Pending | Complete | Deferred` as the only statuses and the note that the
  `Phase N` spelling is what `renumber` shifts; who writes what - `/cad-plan`
  CREATES rows and only ever at `Pending`, `/cad-verify` (`phase-done`) is the
  only writer of any other Status, `/cad-audit` reads and never writes; the
  seeding rules (bounded by `## Active`, idempotent, an id outside `## Active`
  stays an `orphans.plan_ids` entry on purpose); and the two additive
  diagnostics from Task 3 with the statement that neither changes a count or a
  verdict. Cite it from the `REQUIREMENTS.md` section header comment in
  `planning-files.mjs` the way `:410-414` cites the frontmatter grammar. Then
  give the section an author, because a reader with no writer is how this
  failure happened in the first place: in `cadence-core/templates/REQUIREMENTS.md`
  rename the committed-scope section `## v1 Requirements` to `## Active` (keeping
  its bullets and category sub-headings; nothing in the repo parses the old
  heading - verified by grep - and `new-project.md:218-221` names no heading), and
  extend the Notes to state the `## Active` bullet form, that `/cad-plan` seeds
  the Traceability row per requirement at `Pending`, and the pointer to
  `references/req-traceability.md`. In `cadence-core/workflows/milestone.md` step
  5, name the heading in the existing "Seed the next milestone's headline
  requirements" line - they go under `## Active` in that bullet form, per the
  reference - so the section `/cad-plan` reads is the section the close writes.
  Then retire the OTHER writer of this same table, or the reference ships already
  contradicted: `cadence-core/workflows/new-project.md:248-249` instructs "update
  the Traceability table in REQUIREMENTS.md: every REQ-ID mapped to its phase,
  coverage counts filled" and `:333` gates on "Traceability table shows 100% v1
  coverage", while `:220` in the same file already says the opposite ("Traceability
  table left as headers"). Correct `:248-249` and `:333` to match `:220` and the
  new reference - new-project writes `## Active` bullets and leaves `## Traceability`
  as bare headers, because `/cad-plan` seeds each row when its phase is planned;
  the coverage gate becomes "every `## Active` id appears in a ROADMAP phase",
  which is what `/cad-audit` can actually check before any phase is planned.
  Hand-authoring the whole table up front is exactly the model-authored-markdown
  write D-04 forbids (a malformed Phase cell reads as `phase: null` -> a
  `no-phase` break), and leaving it would mean the seeding path is never
  exercised on a new project. Fix `cadence-core/templates/REQUIREMENTS.md:4`
  ("The Traceability table is filled during roadmap creation") to say the same.
  Because this rename changes a heading shipped in the template, state the
  migration for a project scaffolded before v1.4.0 in `references/req-traceability.md`:
  its committed scope still sits under `## v1 Requirements`, so `seed-reqs`
  reports `no_active_section: true` and writes nothing until the heading is
  renamed to `## Active` - a one-line edit, and the report names it. Do not add a
  heading-alias fallback in the parser: a second accepted spelling is the kind of
  accreted heuristic this whole cycle exists to remove.
  Bump `milestone.md` (6104/6104) and `new-project.md` in `weight-budgets.json`;
  the reference and the template are unmeasured surfaces (D-16) and need no bump.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (the new
  `${CLAUDE_PLUGIN_ROOT}` path resolves, no `budget-overrun`), and
  `grep -c "req-traceability.md" cadence-core/bin/lib/planning-files.mjs
  cadence-core/templates/REQUIREMENTS.md cadence-core/workflows/milestone.md`
  reports at least 1 for each. `grep -n "^## Active" cadence-core/templates/REQUIREMENTS.md`
  matches, and `grep -rn "v1 Requirements" cadence-core skills agents` returns
  nothing that names it as a heading to write except the migration note in
  `references/req-traceability.md`. `grep -n "Traceability" cadence-core/workflows/new-project.md
  cadence-core/templates/REQUIREMENTS.md` shows no surviving instruction to fill
  or populate the table - every remaining mention leaves it as headers for
  `/cad-plan` to seed.

### Task 5: Restate the single-writer invariant everywhere it is asserted

- **Files:** cadence-core/workflows/audit.md, skills/cad-audit/SKILL.md, cadence-core/workflows/progress.md, cadence-core/workflows/verify.md, .planning/REQUIREMENTS.md, cadence-core/bin/weight-budgets.json
- **Action:** D-01 narrows the invariant rather than breaking it: row EXISTENCE
  is no longer the claim, a non-`Pending` Status is. Five shipped assertions say
  the old thing and must move together, or the next reader treats `/cad-plan`'s
  new write as a violation. `cadence-core/workflows/audit.md:5-7` ("both written
  solely by cad-verify") -> the rows are created by `/cad-plan` at `Pending` and
  no writer but cad-verify ever sets a Status beyond it; the ROADMAP checkbox is
  cad-verify's alone. `skills/cad-audit/SKILL.md:23` - same correction, same
  sentence shape. `cadence-core/workflows/progress.md:54-57` - keep the "do NOT
  edit those files here" rule intact and correct only the writer clause.
  `cadence-core/workflows/verify.md:178` ("this skill is the single writer of
  persisted phase status") and `:221` (the guardrail) -> single writer of phase
  status TRANSITIONS, with row creation named as `/cad-plan`'s. `.planning/REQUIREMENTS.md:80-83`
  - the `## Traceability` header prose ("written solely by cad-verify") gets the
  same correction plus the pointer to `references/req-traceability.md`. Change no
  behavior in any of the five: this task is prose only, and the audit's read-only
  posture is untouched. Regenerate the four measured entries in
  `weight-budgets.json` (`audit.md`, `progress.md`, `verify.md`,
  `skills/cad-audit/SKILL.md`, each at exactly its budget today).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`, and
  `grep -rn "solely by cad-verify\|single writer of persisted phase status"
  cadence-core skills .planning/REQUIREMENTS.md` returns no match - every
  occurrence of the superseded wording is gone rather than one being left behind.

### Task 6: Seed this repo - v1.4.0's `## Active` rows and the trace they produce

- **Files:** .planning/REQUIREMENTS.md, .planning/phases/1/PLAN.md, .planning/phases/1/PLAN-2.md
- **Action:** Without this, the step ships from a repo where it writes nothing
  (D-03). Replace `.planning/REQUIREMENTS.md`'s `## Active` body ("**None.**"
  plus its two-line note at `:8-11`) with one bullet per v1.4.0 phase in the
  Task 4 grammar, ids chosen to the file's `[CAT]-NN` convention and matched to
  the ROADMAP phase goals: `- **GRM-01**: Every shipped PLAN.md frontmatter form
  reads to exactly the ids and files declared; anything outside the grammar is
  reported, never silently over- or under-read.`; `- **SPN-01**: /cad-plan seeds
  the Traceability row for every requirement a plan covers, and a worktree
  executor asserts its own plan file before task 1.`; `- **TOK-01**: One
  quote-state tokenizer closes the six verified git-guard rail-3 push holes.`;
  `- **RDM-01**: The roadmap phase list has a stated grammar, so an empty
  `## Phases` is a derived closed-milestone state rather than
  `unparseable-roadmap`.` Keep a one-line lead naming the milestone (v1.4.0,
  opened 2026-07-27) and that `/cad-plan` seeds each id's Traceability row when
  its phase is planned - which is why TOK-01 and RDM-01 have no row yet. Then
  set `requirements: [GRM-01]` in BOTH `.planning/phases/1/PLAN.md` and
  `.planning/phases/1/PLAN-2.md` (they shipped as `requirements: []`; the
  frontmatter is the covering declaration `audit` reads, so without it GRM-01
  takes a `no-plan` break) - frontmatter line only, no other byte of those files
  moves. Run `node cadence-core/bin/planning.mjs seed-reqs --phase 1` and
  `--phase 2`, then flip phase 1's row through the sanctioned writer rather than
  by hand - `node cadence-core/bin/planning.mjs phase-done --n 1 --reqs GRM-01`.
  Two things about that command are deviations to make out loud, not to discover
  mid-execution. First, D-03 accepted the opposite consequence ("its row is
  written at its true status rather than flipped by `phase-done`"); writing a
  `Complete` row by hand is model-authored markdown, which D-04 forbids for
  exactly the malformed-cell reason, so the two decisions conflict and this plan
  resolves it toward D-04 - the deviation is recorded in Notes. Second,
  `cmdPhaseDone` (`planning.mjs:239-259`) unconditionally `atomicWrite`s
  ROADMAP.md, and `agents/cad-executor.md`'s `<never>` block forbids the executor
  to write ROADMAP.md. This one invocation is sanctioned for this task
  specifically, because phase 1's UAT passed 23/23 and its box is already `[x]`,
  making `setPhaseBox` a byte-identical rewrite; the Verify below proves that
  rather than assuming it. Do not generalize the carve-out - no other task may
  run a ROADMAP-writing subcommand.
  Finally rewrite the now-false "Empty: v1.3.1's rows are archived..." paragraph
  under the table (`:88-92`) to state what the table now holds and that
  `/cad-plan` seeds it per phase, and update the `*Last updated:*` footer. Expect
  and do NOT "fix" the resulting mid-cycle audit FAIL: SPN-01 is `Pending` on an
  unchecked phase 2, which is exactly the `not-verified` break the audit is
  supposed to report before this phase is verified.
- **Verify:** `node cadence-core/bin/planning.mjs seed-reqs --phase 1` printed
  `{"ok":true,"phase":1,"seeded":["GRM-01"],"skipped":[]}` and a second run
  prints `{"ok":true,"phase":1,"seeded":[],"skipped":["GRM-01"]}` with
  `git diff --stat .planning/REQUIREMENTS.md` empty for that second run;
  `git diff --stat .planning/ROADMAP.md` is EMPTY after `phase-done` runs -
  proving the sanctioned ROADMAP write was the byte-identical no-op this task
  claims, and failing loudly if it was not. `node cadence-core/bin/planning.mjs
  audit` reports `counts.total: 2` with GRM-01 carrying
  `plan: "phases/1/PLAN-2.md"` - NOT `PLAN.md`: `planning.mjs:476` sorts the
  phase dir and `['PLAN.md','PLAN-2.md'].sort()` yields `PLAN-2.md` first
  (`-` is 0x2D, `.` is 0x2E), and `:480` is first-wins, so with both plans
  declaring GRM-01 the audit names `PLAN-2.md`; that is correct, and it is not a
  deviation to "fix" by stripping the id from one plan - `status: "Complete"`,
  `box: true` and no `break`, SPN-01 carrying `break: "not-verified"`, and no
  `unseeded` field; `node cadence-core/bin/planning.mjs status` reports no
  `req-status` drift entry. Finally re-run Task 5's guard after this task's prose
  rewrites: `grep -rn "solely by cad-verify" .planning/REQUIREMENTS.md` still
  returns nothing, so the superseded wording was not reintroduced alongside the
  new paragraph.

### Task 7: The executor asserts its own plan file before task 1

- **Files:** agents/cad-executor.md, cadence-core/bin/weight-budgets.json
- **Action:** In `<worktree_mode>` (`:106-115`), above the existing pre-commit
  branch check so it reads in execution order, add the assertion: before task 1 -
  before any implementation, and certainly before any commit - confirm the plan
  file named in the dispatch prompt exists at that path relative to the worktree
  cwd; if it does not, HALT and return a `blocked` checkpoint naming the missing
  path and the worktree's `git rev-parse --short HEAD`. State the reason in one
  clause so the rule survives a reader who has never seen the failure: the
  worktree's fork point is the host's, not Cadence's
  (`references/seams.md`, spawn-agent), and a worktree branched from an older
  merge point can be missing this phase's plans and CONTEXT entirely - three
  phase-4 executors hit exactly that (`.planning/CAPTURE.md:5`). Extend the
  block's forbidden-operations line to name `git merge`, `git rebase` and
  `git fetch` alongside the existing `stash`/`clean`/`reset`/`restore`, with the
  reason: reconciling a stale worktree is the orchestrator's serialized decision
  (`workflows/execute.md:159-160` merges one at a time with a user stop on
  conflict), and N executors merging concurrently on their own has no conflict
  policy at all. Do not add a repair path, a retry, or a "merge and record a
  deviation" allowance - `blocked` is defined at `:86-104` as blocked by
  something you may not fix, and this is one. Regenerate the
  `agents/cad-executor.md` entry in `weight-budgets.json` (6073/6073) in the same
  commit.
- **Verify:** `node cadence-core/bin/weight.mjs` reports `agents/cad-executor.md`
  at exactly its new budget and `node cadence-core/bin/self-verify.mjs` exits 0
  with no `budget-overrun` and no tools-declaration finding;
  `grep -n "PLAN" agents/cad-executor.md` shows the assertion inside
  `<worktree_mode>` and above the pre-commit branch check. human-verify: on the
  next parallel `/cad-execute`, an executor dispatched into a worktree lacking
  its own `PLAN-<k>.md` returns a `blocked` checkpoint naming that file with no
  commits on its branch (needs a live parallel run under host worktree
  isolation - acceptance criterion 6).

### Task 8: State the honest worktree binding; retire the fork-from-HEAD claims

- **Files:** cadence-core/references/seams.md, cadence-core/references/git.md, cadence-core/bin/lib/branch-decision.mjs, cadence-core/bin/branch-decision.test.mjs, METHOD.md, cadence-core/workflows/config.md, cadence-core/config.schema.json, .planning/CAPTURE.md, cadence-core/bin/weight-budgets.json
- **Action:** The assertion from Task 7 must not ship beside prose asserting the
  condition it catches cannot occur. In `cadence-core/references/seams.md`'s
  spawn-agent section, add a short **Worktree isolation** paragraph - this is the
  binding `workflows/execute.md:151-152` points at and which today defines
  nothing: the host provides the worktree for the parallel execute path; its fork
  point is host-owned and NOT caller-controllable; Cadence issues no
  `git worktree add` anywhere in `cadence-core/bin`, `agents/`, `skills/` or
  `cadence-core/workflows/`, so it cannot pin the base commit; a worktree has
  been observed 31 commits behind, missing both the phase CONTEXT and its own
  `PLAN-2.md` (`.planning/CAPTURE.md:5`); therefore the executor asserts its plan
  file before task 1 and halts `blocked`, and reconciliation is the
  orchestrator's serialized call. Then correct the four surfaces that contradict
  it, each to "the integration branch is what worktree branches merge back into;
  where the host forks them from is not Cadence's to guarantee" (never a
  downgrade to "expected, not guaranteed" - state what is true). SIX surfaces
  carry it, not four - the count matters because the Verify grep below fails on
  any survivor: `cadence-core/references/git.md:77-81` AND `:69` ("the
  reconciliation point parallel worktrees fork from and merge into", a second
  instance in the same file that a `:77-81`-scoped edit walks straight past);
  `cadence-core/bin/lib/branch-decision.mjs` JSDoc `:72-73` and the `reason`
  string at `:93` (leave `action`/`branch` untouched - only the sentence
  changes); `METHOD.md:487-489`; `cadence-core/workflows/config.md:94`'s
  `git.integration_branch` table cell; and `cadence-core/config.schema.json:36`,
  whose `purpose` string carries that cell's sentence verbatim and is what
  `/cad-config` prints - config.md and the schema must be corrected as a pair or
  the two immediately disagree. CONTEXT's D-11 list enumerates three of the six;
  correcting a subset of one false claim is how the remainder becomes the
  surviving source. Fix the two stale comments in
  `cadence-core/bin/branch-decision.test.mjs:56,76` that repeat it. Close the two
  CAPTURE items this phase actually closes, in the file's existing form: `:5`
  (the worktree fork bug - closed by the executor-side assertion, and note that
  the "fork the worktree explicitly" half is unavailable to Cadence, D-08) and
  `:37` (the empty Traceability table - closed by the `/cad-plan` seeding step,
  and note the item's own placement of the fix at `/cad-verify` was wrong, D-01).
  Bump `cadence-core/workflows/config.md` in `weight-budgets.json` if its byte
  count moves (it has 4 bytes of headroom); the references and METHOD.md are
  unmeasured.
- **Verify:** `grep -rn "fork from HEAD\|fork point\|worktrees fork"
  cadence-core agents skills METHOD.md README.md INTERNALS.md DESIGN.md` returns
  only the corrected, host-owned statements - no surviving claim that a worktree
  forks from HEAD or from the integration tip; `node --test
  cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json` both pass
  (branch-decision's tests assert `action`/`branch`, not the `reason` prose);
  `node cadence-core/bin/self-verify.mjs` exits 0; and
  `grep -n "^- \[x\] (phase 4) \*\*Parallel worktrees" .planning/CAPTURE.md`
  matches.

## Notes

- **Plan shape: one PLAN.md, deviating from CONTEXT's "multiple plans"
  directive.** The two halves are otherwise disjoint, but both must edit
  `cadence-core/bin/weight-budgets.json`: D-15 records every surface this phase
  touches at exactly zero headroom, and `weight.mjs` confirms it live
  (`workflows/plan.md` 12362/12362 on the seeding side,
  `agents/cad-executor.md` 6073/6073 on the executor side), so each half grows a
  measured surface and each owes the bump in its own commit or CI fails
  `budget-overrun`. `plan-overlap` would therefore report the collision and
  `execute.md`'s `choose_path` would route sequential anyway; splitting would
  only advertise an independence the files do not have. The alternative -
  pre-raising `cad-executor.md`'s ceiling in the other slice - was rejected: a
  budget decoupled from the surface it measures is the drift the manifest exists
  to catch.
- **Deviation from D-03 (phase 1's row is flipped by `phase-done`, not written
  at its true status).** D-03 accepted a hand-written `Complete` row as the cost
  of seeding this repo; D-04 forbids model-authored markdown for this exact
  table, because `parseRequirements` reads a malformed Phase cell as
  `phase: null` and audit reports it as a `no-phase` break. The two conflict, and
  Task 6 resolves it toward D-04: `seed-reqs` creates the row at `Pending` and
  `phase-done --n 1 --reqs GRM-01` flips it through the sanctioned writer. The
  cost is that `phase-done` also writes ROADMAP.md, which `agents/cad-executor.md`
  forbids the executor to do - so Task 6 sanctions that one invocation explicitly
  and proves it is a byte-identical no-op (`git diff --stat .planning/ROADMAP.md`
  empty) rather than assuming it. If that diff is ever non-empty, stop: the
  assumption behind the carve-out is false and the task needs a human.
- This plan declares `requirements: [SPN-01]`, an id that does not exist until
  Task 6 writes it. That is deliberate and locked by D-03 (this phase authors
  v1.4.0's `## Active` rows because the repo has none), not a fabricated
  traceability id: until Task 6 runs, `audit` correctly reports SPN-01 under
  `orphans.plan_ids`, which is the reverse-direction behavior D-06 exists to
  preserve. Phase 1's plans gain `GRM-01` in the same task for the same reason.
- After Task 6 the mid-cycle `/cad-audit` verdict on this repo is FAIL, with
  SPN-01's chain breaking at `not-verified`. That is the honest state of an
  unverified phase and must not be "fixed" - it becomes PASS when `/cad-verify 2`
  runs `phase-done`. TOK-01 and RDM-01 stay row-less (and `orphans`-free, since
  no plan declares them) until phases 3 and 4 are planned.
- Acceptance criterion 6 is human-verify by construction: proving the halt needs
  a live parallel `/cad-execute` under host worktree isolation, which no command
  in this repo can stage. Task 7's Verify states the observable for that run.
- Two edits sit slightly outside CONTEXT's enumerated In-list, both recorded
  here rather than made quietly: `workflows/milestone.md` step 5 (Task 4) gains
  the `## Active` heading name, because D-01's own evidence is that a reader was
  built against a section no step was told to write - leaving the author
  unnamed would reproduce that at the next close; and
  `workflows/config.md:94` (Task 8) carries a fourth instance of the fork-from-HEAD
  claim D-11 enumerates three of.
- Prior evidence cited in the tasks: the phase-4 worktree fork bug
  (`.planning/CAPTURE.md:5`, phase 4) grounds Tasks 7 and 8; the still-empty
  v1.3.1 Traceability table (`.planning/CAPTURE.md:37`, phase 3) and the v1.2.0
  close note (`.planning/CAPTURE.md:70`) ground Tasks 2, 3 and 6 - two
  consecutive closes needing a hand-populated table before `/cad-audit` passed.
- **Plan-review pass (adjudicated).** Three reviewers ran against this plan
  (cad-reviewer, gpt-5.3-codex, deepseek-v4-pro); eight findings survived
  grounding and are folded into the tasks above: Task 8's two missed fork-claim
  surfaces (`git.md:69`, `config.schema.json:36` - its own Verify grep matched
  them); the D-03/executor collision in Task 6; `listPlanFiles` dropping
  `plan-overlap`'s `no-phase-dir` contract (confirmed live at `--phase 99`);
  Task 3 collapsing `parseActiveIds`' null into `[]`; Task 4's template rename
  leaving `new-project.md` hand-authoring the same table; Task 6's wrong
  `plan:` expectation (sort order puts `PLAN-2.md` first); Task 2's nonexistent
  `unknown-invocation` self-verify kind; and the `orphans` key-shape collision.
  Three findings were killed as already-locked scope: that seeding is non-gating
  (D-07 puts verdict arithmetic out of scope, `unseeded` is the compensating
  signal), that Task 7's verification is not behavioral (criterion 6 is
  human-verify by construction and the observable is stated), and that a null
  `parseActiveIds` would crash Task 3 (the coercion was specified, the defect was
  semantic). Two reviewers challenged the one-plan shape; upheld - `weight.mjs`
  confirms `workflows/plan.md` at 12362/12362 and `agents/cad-executor.md` at
  6073/6073 live, so both halves owe a bump to the same file in their own commit.
