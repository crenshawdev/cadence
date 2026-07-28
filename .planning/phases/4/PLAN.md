---
phase: 4
plan: 1
requirements: ["RDM-01"]
files: ["cadence-core/bin/lib/planning-files.mjs", "cadence-core/bin/planning-files.test.mjs", "cadence-core/bin/planning.mjs", "cadence-core/bin/planning.test.mjs", "cadence-core/references/roadmap-phases.md", "cadence-core/references/plan-frontmatter.md", "cadence-core/workflows/progress.md", "cadence-core/workflows/milestone.md", "skills/cad-health/SKILL.md", "cadence-core/bin/weight-budgets.json", "design-notes/planning-mjs-interface.md", "CHANGELOG.md"]
---

# Phase 4: A stated grammar for the roadmap phase list - Plan

## Goal

What counts as a phase-shaped line under `## Phases` is stated rather than
guessed, so an empty section is a derived closed-milestone state instead of
`unparseable-roadmap`, `/cad-progress` works between milestones and routes to
`/cad-phase add` (a destination that exists), and cursor-drift detection stays
live in the one state where the cursor is the only surviving evidence.

## Must be true when done

- All five verified non-canonical shapes (`- Phase 1: Ship auth`,
  `### Phase 1: Auth`, `1. Phase 1: Auth`, a `| Phase 1 | Auth |` table row,
  `- ✓ Phase 1: Auth`) and a roadmap whose checkbox list is wiped but whose
  `### Phase N:` details survive make `planning.mjs status` refuse with a
  diagnostic naming the offending LINE - never a closed-milestone verdict.
- A genuinely empty `## Phases` returns `ok:true` carrying the closed-milestone
  field with `current:null` and `total:0`, and still does so when the section
  holds ordinary prose, a stray `- [ ] decide scope` bullet, or a sentence with
  a bolded `**Phase` word that carries no number - all of which are
  `unparseable-roadmap` at HEAD.
- Against an empty phase list, `status` reports `agrees:true` for cursor
  statuses `phase complete` and `ready to plan`, reports cursor drift for
  `planned`, `executed` and `context gathered`, and keeps `paused` agreeing at
  any point; an interrupted close (empty `## Phases`, `phases/N/PLAN.md` still
  on disk) reports the closed state AND a drift entry naming that directory.
- `planning.mjs cursor set --phase 1 --status "ready to plan" --next "..."`
  against a pruned roadmap returns `ok:true` with no `--name`/`--total`, and the
  cursor it writes is read back by the next `cursor get` without
  `unparseable-cursor`.
- A roadmap pruned by following `/cad-milestone` step 3 on a TEMPLATE-shaped
  tree (`## Phases` plus a `## Phase Details` section) classifies `closed`, so
  the closed state is reachable on the shipped close path and not only on a
  roadmap that happens to have no detail section. Step 3's own wording is what
  makes it true.
- `/cad-progress` against a closed milestone reports the closed state and names
  `/cad-phase add` as the next action; running `/cad-phase add` against that same
  pruned roadmap appends an entry a following `status` reads back as phase 1 of a
  live cycle; `/cad-milestone` step 6 names the same destination and derives
  `of 0` without flags on a fully pruned roadmap, keeping the explicit-flags
  escape hatch only for a close that defers a phase and so leaves a live list.
- A close whose prune committed but whose `cursor set` never ran reports drift
  even when every `phases/<N>/` dir was deleted by a tagged close - the stale
  `of <M>` against a zero-phase roadmap is itself the drift signal, so the state
  where the cursor is the only surviving evidence is not reported healthy.
- `cadence-core/references/roadmap-phases.md` states the grammar and names every
  out-of-grammar shape with its own diagnostic code, and each named shape has a
  row in the parser-level grammar table in `planning-files.test.mjs`.
- `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
  pass, `self-verify` reports no `budget-overrun` and no `missing-path`, and
  `/cad-health` reports no structural issue against a legitimately closed
  milestone.

## Context

CONTEXT.md D-01..D-16 are binding: `PHASE_LINE` is NOT widened (D-01) - this
phase adds a CLASSIFIER over the section keyed on a `Phase <number>` token
(D-02), reading past today's `## `-bounded extent (D-03); the verdict is
text-only and pure in `lib/` with surviving phase dirs as a separate drift kind
computed in `cmdStatus` (D-05); no new cursor lifecycle value (D-06), no new
subcommand and therefore no `CONTRACTS`/`self-verify.mjs` change (D-15). Follow
the existing `{line, code, text}` issue shape and the one-`test()`-per-row table
idiom already in `planning-files.test.mjs`. Two planner choices recorded here:
the closed-state envelope field is `cycle:"none"` (the reverted attempt's
spelling, shape pinned by D-08), and the closed cursor reads
`Phase: <N> of 0 (no active cycle)`.

## Tasks

### Task 1: State the phase-list grammar as a pure classifier plus its parser-level table

- **Files:** cadence-core/bin/lib/planning-files.mjs,
  cadence-core/bin/planning-files.test.mjs
- **Action:** In `planning-files.mjs`, directly under `parseRoadmapPhases`, add
  `export const CLOSED_CYCLE_NAME = 'no active cycle';` and
  `export function classifyPhaseList(text)` returning
  `{state, phases, issues}` where `state` is one of `live` | `closed` |
  `out-of-grammar` | `no-section`, `phases` is `parseRoadmapPhases`' output (or
  `[]`), and `issues` is `[{line, code, text}]` in line order. Rules, in this
  order and stated in the function's doc comment: (1) run `normalize(text)`
  first - parse path only, never written back, which is exactly what the
  `normalize` comment at `:542-549` reserves for this phase; also call
  `normalize` inside `parseRoadmapPhases` for the same reason, so a CRLF
  checkout classifies `live` instead of falling through to a near-miss scan -
  `PHASE_LINE` itself is byte-identical (D-01), and `setPhaseBox` keeps writing
  the raw text, so no CRLF file is rewritten. (2) No `^## Phases\s*$` heading ->
  `no-section`. (3) Parse the CANONICAL extent (heading to the next `^## `,
  today's bound) with `parseRoadmapPhases`; one or more matches -> `live` with
  those phases and `issues: []` - a near-miss beside a real checkbox list is
  deliberately NOT reported, because the checkbox list is the phase set (D-01).
  (4) Otherwise scan the CLASSIFICATION extent - the `## Phases` heading to END
  OF TEXT, deliberately wider than the canonical bound (D-03), so a wiped
  checkbox list with intact `### Phase N:` details under `## Phase Details`
  cannot read as a clean close - for `/\bPhase (\d+(?:\.\d+)?)\b/` (capitalized
  `Phase` plus a number, the token `shiftPhaseTokens`/`findProsePhaseRefs`
  already treat as THE phase token; lowercase `phase 2` stays prose). Any
  match -> `out-of-grammar` with at most ONE issue per line, code chosen by the
  line's shape: `^#{1,6}\s` -> `phase-heading`; `^\s*[-*+]\s` -> `phase-bullet`;
  `^\s*\d+[.)]\s` -> `phase-ordered-item`; `^\s*\|` -> `phase-table-row`;
  anything else -> `phase-prose-line` (the catch-all exists so a shape outside
  the grammar gets a diagnostic rather than silence). No match -> `closed`.
  `line` is 1-indexed into the normalized WHOLE text and `text` comes from the
  existing `issueText` helper (trim, 120-char truncate). The function stays pure
  and total: no I/O, no throw, no filesystem (D-05). In `planning-files.test.mjs`
  add a `PHASE_LIST_ROWS` table beside the existing `ROWS`, each row
  `{name, text, state, phases?, codes}`, asserted one `test()` per row (`phase-list:
  ${row.name}`) against `classifyPhaseList`, covering at minimum: a single
  canonical line; several canonical lines mixing `- [x]`/`- [ ]`; a decimal
  `**Phase 2.1: ...**` line; a CRLF canonical fixture; canonical lines PLUS a
  `### Phase 1:` detail (live, no issues); an empty section; a section holding
  only prose with no phase token; a stray `- [ ] decide scope` bullet; a
  sentence containing a bolded `**Phase` word with no number; a missing
  `## Phases` heading (`no-section`); `- Phase 1: Ship auth`; `- ✓ Phase 1: Auth`;
  `- [ ] Phase 1: Auth` (checkbox, unbolded); `- [ ] **Phase 1 Auth**` (no
  colon); `### Phase 1: Auth` surviving under `## Phase Details` with the
  checkbox list wiped; a FULLY pruned template-shaped roadmap - empty
  `## Phases` AND a bare `## Phase Details` heading with every `### Phase N:`
  section removed - which must classify `closed`, since the heading itself
  carries no `Phase <digits>` token (this row is the shipped close path task 5
  makes reachable; its absence is what let the plan's own human-verify pass over
  the gap); `## Phase 12: Auth`; `1. Phase 1: Auth`; `1) Phase 1: Auth`;
  `| Phase 1 | Auth |`; and a prose line `Phase 2 rolls to the next milestone`
  (catch-all). Add one separate test asserting the exact `{line, code, text}`
  object for the surviving-detail fixture, so the line number is pinned, not
  just the code.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes and
  `node --test cadence-core/bin/planning-files.test.mjs 2>&1 | grep -c
  "phase-list:"` reports at least 20; `node -e "import('./cadence-core/bin/lib/planning-files.mjs').then(m=>console.log(JSON.stringify(m.classifyPhaseList('# R\n\n## Phases\n\n\n## Phase Details\n\n### Phase 1: Auth\n'))))"`
  prints `state":"out-of-grammar"` with a `phase-heading` issue, and the same
  call on `'# R\n\n## Phases\n\n\n## Phase Details\n'` - the identical text with
  the `### Phase 1: Auth` LINE removed and the `## Phase Details` heading left
  standing - prints `state":"closed"`. Both literal texts must be used as
  written: dropping the heading instead of the `### Phase N:` line tests nothing,
  since the heading was never a match.

### Task 2: Make `status` derive the closed milestone, its drift, and its cursor agreement

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdStatus`, replace the `parseRoadmapPhases` +
  `if (!roadmap.length) return fail('unparseable-roadmap', ...)` pair with
  `classifyPhaseList(roadmapText)` (add it and `CLOSED_CYCLE_NAME` to the import
  block at `:37-44`). `no-section` -> `fail('unparseable-roadmap', 'no `## Phases`
  section in ROADMAP.md')`. `out-of-grammar` -> emit the failure envelope
  directly (not through `fail`, which has no channel for it) as
  `{ok:false, reason:'unparseable-roadmap', detail, issues}` in that key order,
  where `detail` names the FIRST offending line as ``line <n>: <text>`` and
  `issues` is the classifier's array verbatim - the diagnostic identifies the
  offending line instead of the one blanket string at `:96` (D-04). `live` ->
  today's path unchanged. `closed` -> continue with an empty phase list and add
  `cycle: 'none'` to the `ok(...)` envelope between `total` and `phases`, an
  ADDITIVE field on an `ok:true` envelope with `current: null` and `total: 0`
  preserved exactly as today (D-08); the field is present ONLY in the closed
  state. Still in `cmdStatus`, and only when the state is `closed`, add the
  surviving-directory drift: read `<dir>/phases/` inside a try/catch (absence is
  data), take entries matching `^\d+(\.\d+)?$`, sort numerically, and push
  `{kind:'phase-dir', phase:<n>, detail:'phases/<n>/ survives the milestone close
  (<k> plan files)'}` per entry using the existing `listPlanFiles` helper for the
  count - this is the interrupted-close corroboration, kept OUT of the pure
  classifier on purpose (D-05). In the cursor block, insert the closed arm
  between the `paused` carve-out and the `current === null` arm:
  `agrees = parsed.status === 'phase complete' || parsed.status === 'ready to
  plan'` (D-09, so `planned`/`executed`/`context gathered` stay drift and drift
  detection does NOT die in the state where the cursor is the only evidence);
  the phase number is not compared, because a zero-phase roadmap gives it
  nothing to agree with. Its drift detail reads `cursor says phase <N> <status>;
  derived closed milestone (no phases in ROADMAP)`. Independently of `agrees`,
  and still only in the `closed` state, push a `{kind:'cursor', ...}` drift entry
  when the parsed cursor's `total !== 0`, detail `cursor totals <M> phases;
  ROADMAP has none - milestone close did not finish (run cursor set)`. This does
  NOT touch D-09's agreement mapping, which governs `agrees` alone: a
  `phase complete` cursor still agrees. It closes the case the phase-dir drift
  cannot see - a TAGGED close deletes `phases/<N>/` (milestone.md step 3), so
  when the prune commits and step 6 never runs, the stale `of <M>` is literally
  the only surviving evidence, which is the state the phase goal names. Without
  it `status` reports `agrees:true` with an empty `drift[]` and progress.md's
  reconcile (which fires on drift kind `cursor`) never rewrites, so STATE.md
  keeps `of <M>` indefinitely. In `planning.test.mjs`:
  rewrite the existing test at `:159-165` (`roadmap without phase lines is
  unparseable-roadmap`) - a `(nothing)` body is now a closed milestone - into a
  pair, one asserting `ok:true` + `cycle:'none'` + `current:null` + `total:0` for
  that body, one asserting `ok:false` + `reason:'unparseable-roadmap'` + an
  `issues[0].code` of `phase-bullet` for a `- Phase 1: Ship auth` body with the
  offending line named in `detail`; add a seam test for the wiped-list/surviving-
  `### Phase 1:` roadmap (still `ok:false`); add the interrupted-close test
  (`roadmap: []` fixture plus `phases: {2:{plan:true}}`) asserting `cycle:'none'`
  AND a `phase-dir` drift entry for phase 2; add a test for the tagged-close
  interruption (`roadmap: []`, NO `phases/` dirs, STATE.md `Phase: 5 of 5 (Old)`
  / `phase complete`) asserting `cursor.agrees === true` AND a `cursor` drift
  entry naming the stale total, plus its complement (`Phase: 1 of 0 (no active
  cycle)` / `ready to plan`) asserting an empty `drift[]`; and add a six-row
  agreement table
  (one `test()` per cursor status) over the `roadmap: []` fixture asserting
  `cursor.agrees` true for `phase complete`, `ready to plan`, `paused` and false
  plus a `cursor` drift entry for `planned`, `executed`, `context gathered`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; in a temp
  tree whose ROADMAP has an empty `## Phases`,
  `node cadence-core/bin/planning.mjs status --dir <tmp>` prints
  `"ok":true` with `"cycle":"none"`, `"current":null`, `"total":0` and exits 0,
  and after `mkdir -p <tmp>/phases/2 && touch <tmp>/phases/2/PLAN.md` the same
  command adds a `"kind":"phase-dir"` drift entry naming `phases/2/`; with
  `- Phase 1: Ship auth` in that section it exits 1 with
  `"reason":"unparseable-roadmap"` and an `issues` entry whose `line` and `text`
  name that line.

### Task 3: Give `cursor set` a stated closed-milestone derivation

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdCursorSet`, replace the `parseRoadmapPhases` derivation at
  `:193-198` with `classifyPhaseList` over the same text, keeping the chain's
  precedence (explicit flag > ROADMAP derivation > prior cursor > fail): on
  `live`, behave exactly as today (name from the matching entry, total =
  `phases.length`); on `closed`, fill `name` with `CLOSED_CYCLE_NAME` and
  `total` with `0` when each is still undefined, so the seam succeeds against a
  pruned roadmap BY CONSTRUCTION (D-10) and `milestone.md` step 6 can run on the
  tree its own step 3 produces. `out-of-grammar` and `no-section` deliberately
  keep today's behavior (fall through to the prior cursor, then `cannot-derive`):
  a roadmap holding unrecognized phase-shaped lines is broken, not closed, and
  writing `of 0` there would erase a live cycle's total. The closed arm must sit
  BEFORE the prior-cursor fallback at `:199-205`, because inheriting the prior
  cursor's stale `total` writes `Phase: 1 of 5` against a zero-phase roadmap -
  the failure D-10 calls worse than the error. The written line is
  `Phase: <N> of 0 (no active cycle)`, which still satisfies `parseCursor`'s
  4-line shape (non-empty name, `of <digits>`; D-13) - do not touch `parseCursor`
  or `renderCursor`. In `planning.test.mjs` add: `cursor set --phase 1 --status
  "ready to plan" --next "/cad-phase add"` against a `roadmap: []` fixture
  returns `ok:true` with `cursor.total === 0` and `cursor.name === 'no active
  cycle'`; a following `cursor get` on the same dir returns `ok:true` (never
  `unparseable-cursor`); the same call against a fixture that ALSO has a prior
  cursor of `5 of 5 (Old)` still writes `total: 0`, not the inherited 5; and the
  same call against a roadmap holding `- Phase 1: Ship auth` still returns
  `ok:false` with `reason:'cannot-derive'`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; in a temp
  tree with an empty `## Phases` and a stale `Phase: 5 of 5 (Old)` STATE.md,
  `node cadence-core/bin/planning.mjs cursor set --phase 1 --status "ready to
  plan" --next "/cad-phase add" --dir <tmp>` prints `"ok":true` with
  `"total":0` and `"name":"no active cycle"` (HEAD prints
  `{"ok":false,"reason":"cannot-derive"}`), and
  `node cadence-core/bin/planning.mjs cursor get --dir <tmp>` then prints
  `"ok":true`.

### Task 4: Write the grammar down in `cadence-core/references/`

- **Files:** cadence-core/references/roadmap-phases.md,
  cadence-core/references/plan-frontmatter.md
- **Action:** Create `cadence-core/references/roadmap-phases.md` following the
  shape of `plan-frontmatter.md` (per-code table with a payload column) and
  `git.md`'s rail-3 out-of-grammar table. It states: the canonical entry
  `- [ ] **Phase N: Name** - description` verbatim, that it is unchanged and why
  (it is what `status`, `audit`, `phase-done` and the cursor's `total` count as
  a phase, so widening it is a state-machine change, D-01); the TWO deliberate
  extents - the canonical parse bounded at the next `## `, the classification
  scan running to end of text - and the failure that bound would otherwise allow
  (a wiped list with intact `### Phase N:` details reading as a clean close,
  D-03); the four states (`live`, `closed`, `out-of-grammar`, `no-section`) with
  what `status` and `cursor set` do in each; an out-of-grammar table with one row
  per code (`phase-heading`, `phase-bullet`, `phase-ordered-item`,
  `phase-table-row`, `phase-prose-line`), each row giving an example line, what
  the classifier does, and the fix, and each pinned by a row in
  `planning-files.test.mjs`; the closed-milestone contract - `cycle:"none"` on an
  `ok:true` envelope with `current:null` and `total:0`, the `phase-dir` drift
  kind, the cursor line `Phase: <N> of 0 (no active cycle)`, and the agreement
  mapping (`phase complete`, `ready to plan`, `paused` agree; `planned`,
  `executed`, `context gathered` are drift); and a short "not in this grammar"
  close - a near-miss beside a real checkbox list is not reported, lowercase
  `phase 1` is prose not a token, and the classifier never reads the filesystem.
  Then edit `plan-frontmatter.md:197-198` so the out-of-scope note points at the
  new file instead of calling the roadmap grammar merely "unrelated". Keep both
  files free of any claim the tests do not pin.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c "phase-heading\|phase-bullet\|phase-ordered-item\|phase-table-row\|phase-prose-line" cadence-core/references/roadmap-phases.md`
  is at least 5 and every one of those five codes also appears in
  `cadence-core/bin/planning-files.test.mjs` (`for c in phase-heading phase-bullet
  phase-ordered-item phase-table-row phase-prose-line; do grep -q "$c"
  cadence-core/bin/planning-files.test.mjs || echo "MISSING $c"; done` prints
  nothing); `grep -n "roadmap-phases.md" cadence-core/references/plan-frontmatter.md`
  shows the pointer.

### Task 5: Move every shipped surface the new contract contradicts

- **Files:** cadence-core/workflows/progress.md,
  cadence-core/workflows/milestone.md, skills/cad-health/SKILL.md,
  skills/cad-progress/SKILL.md, design-notes/planning-mjs-interface.md,
  cadence-core/bin/weight-budgets.json
- **Action:** `progress.md`: in the `derive` step's field list add `cycle` -
  present and `"none"` only when the phase list is a derived closed milestone, in
  which case `current: null` means "no cycle open", NOT "all phases complete"
  (the loop D-08 guards); add `phase-dir` to the drift-kind list at `:30`; cite
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/roadmap-phases.md` once for the
  grammar. In `reconcile`, add the closed-state rewrite (`cursor set --phase 1
  --status "ready to plan" --next "/cad-phase add"`, no `--name`/`--total`) and
  route drift kind `phase-dir` to `/cad-milestone` to finish the interrupted
  prune - explicitly NOT to `/cad-verify N`, whose phase N the roadmap no longer
  has (D-16). In `report`, give the closed state its own header line
  ("milestone closed - no active cycle") with no phase list. In the `route`
  table, insert `| `cycle` is `none` (milestone closed) | /cad-phase add |`
  ABOVE the `current` is null row, since the table is first-match-wins, and leave
  the all-complete row routing to `/cad-milestone`. `milestone.md` step 3 - the
  load-bearing edit, without which nothing else in this phase reaches the goal:
  its first bullet currently prunes ONLY the `- [x]` lines from `## Phases`, but
  `templates/ROADMAP.md:22-38` mandates a following `## Phase Details` section of
  `### Phase N: Name` headings, and no workflow removes those (`cutPhaseDetail`
  is called only from `planning.mjs:890`, the `renumber remove` path). A
  template-conformant project that closes a milestone therefore keeps
  `### Phase 1: ...` and `**Depends on:** Phase 1` lines in the tail, which the
  task-1 classification extent reads as `out-of-grammar` - so `status` still
  returns `unparseable-roadmap`, `/cad-progress` stays dead between milestones,
  and task 3's closed arm never fires. Extend that bullet to remove each pruned
  phase's `### Phase N:` detail section along with its list line (leaving the
  `## Phase Details` heading itself, which carries no phase token), and state why
  in one clause: a surviving detail section is the signature of an INTERRUPTED
  close and the grammar reports it as such (D-03), so a finished close must
  leave none. This is prune completeness, not the roadmap-authoring step D-07
  rejects, and it is a prose edit to an already-manual step - no new subcommand
  is added (D-15). `milestone.md` step 6: state that the seam derives
  `of 0 (no active cycle)` from the fully pruned roadmap step 3 now produces, and
  KEEP the `--name`/`--total` parenthetical rather than deleting it, rescoped to
  the case that still needs it - step 3's third bullet leaves an unfinished phase
  and its dir in place, so a close with deferred work leaves a `live` phase list
  whose entries do not include phase 1; the derivation at `planning.mjs:193-207`
  finds no matching entry, the prior cursor's phase does not match either, and
  the seam returns `cannot-derive` exactly as it does at HEAD. Deleting the
  parenthetical would remove the operator's only stated recovery from a path this
  phase does not change. Set the prescribed `--next` to
  `/cad-phase add` - the only workflow that appends a phase line to an existing
  roadmap (D-07; `/cad-plan` stops with "Phase {N} is not in ROADMAP.md"); name
  the same destination in step 8's report line. `skills/cad-health/SKILL.md`:
  rule 3 gains "an empty `## Phases` is a legitimately closed milestone, not a
  numbering gap"; rule 5's cursor-`M` and range clauses gain "when ROADMAP has
  zero phases, the cursor reads `of 0` and `Phase: 1 of 0` is the expected
  closed-milestone shape" (D-12, the minimal targeted edit - the full re-spine
  stays deferred); rule 2's `N <= M` clause gains a one-clause pointer to that
  case, because it states the same range rule and would otherwise flag the cursor
  this phase writes. `skills/cad-progress/SKILL.md`: its `<objective>` at
  `:17-21` lists the routing destinations as "(/cad-context, /cad-plan,
  /cad-execute, /cad-verify, /cad-milestone)" - an exhaustive-reading list that
  the new `cycle`-is-`none` route row contradicts; add `/cad-phase add` to it.
  `design-notes/planning-mjs-interface.md`: add `cycle` to the
  section-2 status shape and its bullet list, add `phase-dir` to the
  `drift[].kind` set, and note the `cursor set` closed derivation in section 3.
  Finally regenerate the FOUR moved surfaces' byte counts and update
  `weight-budgets.json` in the SAME change (D-14) - `progress.md` at 5346,
  `milestone.md` at 6251, `skills/cad-health/SKILL.md` at 2547 and
  `skills/cad-progress/SKILL.md` at 981 are exact today, so any prose byte fails
  `budget-overrun` without the bump. Do not add a
  `planning.mjs` subcommand or a flag anywhere in this prose: no `CONTRACTS` row
  is owed (D-15).
- **Verify:** `node cadence-core/bin/weight.mjs` byte counts for
  `cadence-core/workflows/progress.md`, `cadence-core/workflows/milestone.md`,
  `skills/cad-health/SKILL.md` and `skills/cad-progress/SKILL.md` equal their
  `weight-budgets.json` entries, and
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` (no
  `budget-overrun`, no `missing-path` for the new reference);
  `grep -n "cad-phase add" cadence-core/workflows/progress.md
  cadence-core/workflows/milestone.md skills/cad-progress/SKILL.md` shows the
  destination in all three;
  `grep -n "phase-dir" cadence-core/workflows/progress.md
  design-notes/planning-mjs-interface.md` shows the new drift kind in both;
  `grep -n "Phase Details" cadence-core/workflows/milestone.md` shows step 3's
  new detail-section prune (zero hits at HEAD - this grep is the falsifier for
  the load-bearing edit); `grep -n "\-\-name" cadence-core/workflows/milestone.md`
  still shows the step 6 escape hatch, now scoped to the deferred-work close.
  End-to-end on a scratch copy of `templates/ROADMAP.md`'s filled shape: prune it
  exactly as the amended step 3 prescribes, then
  `node cadence-core/bin/planning.mjs status --dir <tmp>` prints `"ok":true` with
  `"cycle":"none"` - and against the SAME tree pruned by HEAD's step 3 wording
  (list lines only) it prints `"reason":"unparseable-roadmap"`, which is the
  before/after this task exists to move.

### Task 6: Record the change and clear the ship gate

- **Files:** CHANGELOG.md
- **Action:** Under the existing `## [1.4.0] - unreleased` / `### Fixed`
  section, add a block headed **A stated grammar for the roadmap phase list**
  covering: an empty `## Phases` is now a derived closed-milestone state
  (`cycle:"none"` on an `ok:true` `status` envelope, `current` and `total`
  unchanged) instead of `unparseable-roadmap`, so `/cad-progress` works between
  a milestone close and the next cycle; a phase-shaped line that is NOT a
  canonical entry (a plain bullet, a heading, an ordered item, a table row, a
  prose mention) is reported per line with its own diagnostic code rather than
  one blanket string, and never classifies as closed - including the case that
  reverted the v1.3.1 attempt, a wiped checkbox list whose `### Phase N:`
  details survive; drift detection stays live against a closed milestone
  (`phase complete`/`ready to plan` agree, `planned`/`executed`/`context
  gathered` are drift) and a surviving `phases/N/` directory reports as a new
  `phase-dir` drift kind; `cursor set` derives `of 0 (no active cycle)` from a
  pruned roadmap, so `/cad-milestone` step 6 runs on the tree its own step 3
  produces; and `/cad-progress` and `/cad-milestone` now route between
  milestones to `/cad-phase add`, the only workflow that appends a phase line to
  an existing roadmap. Point at `cadence-core/references/roadmap-phases.md` for
  the grammar and its out-of-grammar table. Keep `PHASE_LINE` explicitly
  unchanged in the wording - nothing new counts as a phase.
- **Verify:** `grep -n "roadmap phase list" CHANGELOG.md` shows the entry under
  `[1.4.0]`; `node --test cadence-core/bin/*.test.mjs` passes,
  `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`. human-verify
  (both are slash-command surfaces the executor cannot invoke), and the fixture
  must be TEMPLATE-SHAPED, not this repo's own `.planning/`: `.planning/ROADMAP.md`
  here has only `## Overview` and `## Phases` (no `## Phase Details`), so emptying
  its phase list classifies `closed` whether or not task 5's step 3 edit landed -
  a fixture that cannot fail. Build the scratch tree from `templates/ROADMAP.md`
  filled with two phases, prune it by following the amended step 3 by hand, and
  against THAT tree: `/cad-progress` reports the closed milestone and offers
  `/cad-phase add`; `/cad-health` reports no structural issue; then run
  `/cad-phase add` on that same pruned roadmap and confirm the round trip
  CONTEXT's acceptance criterion 3 names - it appends a phase entry that a
  following `node cadence-core/bin/planning.mjs status --dir <tmp>` reads back as
  phase 1 of a live cycle (`"cycle"` absent, `"current":1`, `"total":1`). This is
  the one check that exercises the destination the route table now names;
  `workflows/phase.md:13-20` derives the new number from "current total + 1" and
  was written for mid-cycle insertion into a populated roadmap, so record what it
  does from zero rather than assuming it.

## Notes

- Two spellings were left to the planner by CONTEXT's flagged assumptions and
  are fixed here: the closed-state envelope field is `cycle:"none"` (the
  reverted attempt's spelling, kept so any prose or caller written against it
  still reads true; D-08 pins the shape, not the name), and the closed cursor
  name is the constant `no active cycle`, exported as `CLOSED_CYCLE_NAME` so the
  format lives in `planning-files.mjs` with the rest of the cursor grammar.
- The closed cursor writes `Phase: 1 of 0`, which `cad-health` rule 2's `N <= M`
  clause would flag. D-12 names only `SKILL.md:33` and `:38-40`; task 5 adds a
  one-clause pointer at rule 2 because it states the same range rule, and
  shipping prose that contradicts shipped code is the drift D-12 exists to
  prevent. No new rule, no re-spine - that stays deferred to its own branch.
- `cmdRenumber`'s `unparseable-roadmap` at `planning.mjs:813` is deliberately
  left alone: renumbering a zero-phase roadmap has nothing to renumber, and
  `/cad-phase add` appends without calling `renumber`.
- The `normalize` comment at `planning-files.mjs:542-549` explicitly reserves
  CRLF/BOM normalization on the parse path for "the roadmap grammar it owns";
  task 1 takes it, for the classifier and `parseRoadmapPhases` alike, and only
  on the read path - `setPhaseBox` and `phase-done` still rewrite raw bytes.
- Recalled prior art applied: the v1.2.0 close capture first proposed a
  between-milestones cursor status; D-06 supersedes it (no new lifecycle value),
  so `ready to plan` carries the closed state. The phase-2 captures on
  `cursor set --phase`/`--total` writing a cursor the next `cursor get` rejects
  are why task 3 asserts the `cursor set` -> `cursor get` round trip rather than
  the write alone.
- The `weight-budgets.json` numbers quoted in task 5 were live at gather time; if
  another change lands on those surfaces first, bump against the new sizes.
- Task 1 adds `normalize` inside the shared `parseRoadmapPhases`, which changes
  behavior for its four other callers, not just the classifier: a CRLF roadmap
  that parses to `[]` today (so `cmdRenumber` bails at `planning.mjs:812-813`)
  will parse to real phases afterward. The one downstream regex worth a look is
  `cutPhaseDetail` (`planning-files.mjs:1083`, `^### Phase N:(?: .*)?$` with the
  `m` flag). It is CRLF-safe for the ordinary heading, since `.` matches `\r` and
  the `$` then lands before the `\n`; only a bare `### Phase 2:` with no trailing
  text fails to match. Executor: confirm that shape does not orphan a detail
  section under `/cad-phase remove` on a CRLF checkout, and if it does, fix the
  anchor in the same task rather than filing it.
- Applied from the adjudicated `plan` review (cad-reviewer + openai/gpt-5.4-mini,
  both of which independently landed on the classification extent): the step 3
  prune gap (BLOCKER, converged), the deferred-work `cannot-derive` regression
  from deleting step 6's escape hatch, the tagged-close stale-total drift hole,
  the human-verify fixture that could not falsify the blocker, the missing
  `skills/cad-progress/SKILL.md` surface and its byte-exact budget, the dropped
  half of CONTEXT acceptance criterion 3, and the ambiguous task-1 verify string.
  Two findings were refuted and NOT applied: that `## Phases` itself matches the
  out-of-grammar heading rule (the scan needs `Phase` + space + digits, which
  `Phases` never provides - the `^#{1,6}\s` test only picks a CODE for a line
  that already matched), and that task 5 violates D-12 silently (the rule-2
  pointer is declared in the note above, not silent - it remains a real, flagged
  step past D-12's literal `:33`/`:38-40` scope for the user to accept or cut).
- The stale-total drift added to task 2 is deliberately additive to `agrees`, not
  a change to it: D-09 fixes the agreement mapping and this leaves it verbatim.
  Flagged because it is the one place this plan reaches past a locked decision's
  literal text to close a hole that decision's own rationale (finding 4) names.
