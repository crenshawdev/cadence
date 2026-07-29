---
phase: 5
plan: 1
requirements:
  - ACR-01
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/acceptance-criteria.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/audit.md
  - cadence-core/templates/UAT.md
  - .planning/ROADMAP.md
  - .planning/phases/1/UAT.md
  - .planning/phases/2/UAT.md
  - .planning/phases/3/UAT.md
  - .planning/phases/4/UAT.md
  - CHANGELOG.md
  - README.md
---

# Phase 5: Acceptance-criteria ids - Plan

## Goal

An audit can prove a total function: every acceptance criterion written into a
phase's CONTEXT reached that phase's UAT checklist. A criterion that reached no
item is named by its own id and breaks the ship gate, instead of being
recovered by luck on a second verify pass.

## Must be true when done

- Every acceptance criterion in a CONTEXT file carries a phase-local `AC<N>` id
  that a reader returns as `{id, text}`, and each shape outside that grammar
  returns its own named diagnostic rather than a changed reading.
- `planning.mjs criteria-coverage` names, as a verdict-breaking entry, every
  criterion id that reached no UAT item - and `/cad-audit` FAILs on it naming
  the id with a next action, not PASS-with-warnings.
- A UAT item that traces to no criterion is reported without moving the
  verdict; an item declaring `origin: verifier` is not reported at all; and a
  checklist that predates the field is reported as legacy and breaks nothing.
- A `criterion` and an `origin` written into a UAT item are still byte-present
  in the file after `uat refresh` and after `uat record`, so the link survives
  the whole UAT lifecycle rather than only its first write.
- Phases 1-4's shipped checklists carry `criterion` on every criterion-derived
  item and `origin` on every item that is not, and the coverage call returns
  zero breaks for all four.
- Inserting or removing a phase leaves an existing phase's CONTEXT `AC<N>` ids
  byte-identical.
- `/cad-context` writes new criteria already in the grammar, so a CONTEXT file
  created the day after this phase closes needs no retrofit.

## Context

CONTEXT.md's 17 decisions bind this plan; the load-bearing ones are D-01 (the id
is a bare `AC<N>`, structurally disjoint from `REQ_ID_EXACT`), D-03 (the grammar
has a READER but no writer, so `context.md`'s inline skeleton must change too),
D-05 (the carrier is a per-item `criterion:` line registered in `UAT_FIELDS`),
D-08 (the check is a NEW subcommand, never an extension of `audit`, whose counts
identity is pinned), D-09 (the two directions are asymmetric: uncovered breaks,
untraced reports), D-10 (an absent CONTEXT or UAT is nothing to prove) and D-16
(backfill AND a legacy exemption, both). Follow the four shipped grammars:
`references/roadmap-phases.md` + `classifyPhaseList` and
`references/req-traceability.md` + `classifyActiveSection` are the models for
the reference file, the classifier shape and the per-row test table. Out of
scope: promoting the `(human-verify: ...)` suffix to a declared field (D-11) and
the `human_checks` counting bug (D-14).

## Tasks

### Task 1: The acceptance-criteria reader

- **Files:** cadence-core/bin/lib/planning-files.mjs
- **Action:** Add a new `CONTEXT.md - the ## Acceptance criteria grammar`
  section after `parseContextDecisions` and before the UAT block, exporting
  `classifyAcceptanceCriteria(text)` returning
  `{criteria: Array<{id: string, text: string}>|null, issues: Issue[]}`, fully
  JSDoc-typed (the file is `// @ts-check` and `tsc -p tsconfig.ci.json` must stay
  green). Normalize with the shared `normalize` (BOM, CRLF and lone CR), not
  `normalizeCrlf`: CONTEXT.md has no writer anywhere in this codebase (D-03), so
  this is a pure reader and the roadmap's write-path carve-out does not apply -
  say so in the comment. Locate `^## Acceptance criteria\s*$`; absent returns
  `{criteria: null, issues: []}`, the same absent-heading rule
  `classifyActiveSection` uses, because an absent heading is the datum
  "nothing declared", not an out-of-grammar report. Walk from the heading to the
  next `^## ` or end of text. The canonical head is
  `^- \[( |x|X)\] (AC\d+):[ \t]*(.*)$` - column-0 dash, checkbox, the bare
  `AC<N>` token, a colon, then the text; ids are de-duplicated
  first-occurrence-wins. An indented, non-blank line while a criterion is open is
  a CONTINUATION and is appended to that criterion's text joined with one space,
  never classified on its own (this is what keeps a wrapped criterion that names
  another id from reporting, the same silence `classifyActiveSection`'s
  continuation row pins); the one exception is an indented line whose content
  begins with a bullet marker followed by an `AC<N>` token, which is
  `criterion-indented-bullet`. A blank line or any non-indented line closes the
  open criterion. Nine diagnostic codes, at most one per line, in line order,
  each as `{line, code, text}` with `issueText`'s trim-and-truncate:
  `criterion-unidded` (a column-0 `- [ ]` bullet with no `AC<N>` head - the
  legacy shape and the central diagnostic, checked before any token gate so it
  fires on a bullet naming no id at all), `criterion-duplicate-id` (a second
  bullet reusing an id; reported and NOT pushed), `criterion-empty-text` (an id
  with no text after the colon; the criterion IS still pushed with `text: ''` -
  parse-then-diagnose, matching `trailing-value-content`'s precedent, since the
  id is real and must still reach an item), `criterion-unboxed-bullet`
  (`- AC1: ...`, no checkbox), `criterion-nondash-bullet` (a column-0 `*`/`+`
  marker), `criterion-indented-bullet`, `criterion-ordered-item`,
  `criterion-heading`, and `criterion-prose-line` as the catch-all for any other
  line carrying `\bAC\d+\b`. The entry-shaped codes fire regardless of how many
  criteria parsed - mixed authoring (one idded bullet beside six bare ones) is
  exactly the migration case this exists to catch, so do NOT copy
  `classifyPhaseList`'s near-miss suppression. Trailing prose after the criterion
  text, including `(human-verify: needs <tool>)`, is in-grammar and stays in
  `text` verbatim (D-11): the classifier admits and ignores it, and `verify.md`
  keeps its current prose read.
- **Verify:** Both halves, because a verify that only reads clean files passes
  even if the whole diagnostic path is missing.
  (a) `node -e 'import("./cadence-core/bin/lib/planning-files.mjs").then(async m=>{const {readFileSync}=await import("node:fs");for(const n of [1,2,3,4,5]){const r=m.classifyAcceptanceCriteria(readFileSync(`.planning/phases/${n}/CONTEXT.md`,"utf8"));console.log(n,r.criteria.map(c=>c.id).join(","),r.issues.map(i=>i.code).join("|")||"-")}})'`
  prints `AC1,AC2,AC3,AC4,AC5,AC6,AC7` and `-` for phases 1-4, and
  `AC1,...,AC8` with exactly `criterion-prose-line` for phase 5. That one issue
  is CORRECT and expected, not a bug to code around: `.planning/phases/5/CONTEXT.md:224`
  is a column-0 prose footer inside the section carrying the token `AC7`
  ("Tooling probed on this machine: ... AC7 is"), and the catch-all is defined to
  fire on it. Do NOT weaken `criterion-prose-line` into a conditional code and do
  NOT edit that locked CONTEXT file to make the check quiet - either move re-opens
  the mixed-authoring case the diagnostic exists for.
  (b) A one-off out-of-grammar fixture returns its named code: feed
  `"## Acceptance criteria\n\n- [ ] a bare bullet\n"` and assert `issues[0].code`
  is `criterion-unidded` with `criteria` empty. Deleting the diagnostic path must
  fail this half.

### Task 2: The criteria-coverage subcommand, wired end to end

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/planning.test.mjs, .planning/ROADMAP.md
- **Action:** Add `cmdCriteriaCoverage(dir)` directly after `cmdAudit`, a
  `criteria-coverage` entry in the `COMMANDS` dispatch table, a line in the
  file-header subcommand list, and `'criteria-coverage': []` in
  `self-verify.mjs`'s `CONTRACTS['planning.mjs']` (D-17 - without it the first
  workflow naming the subcommand fires `unknown-subcommand`). It is ONE word, so
  it gets no `TWO_WORD` entry; `--dir` reaches it through the existing `'*'`
  list. Do NOT extend `audit`: `:702-711` pins its counts identity and
  `audit.md` section 4 filters `requirements[]` BY milestone id, which a
  criterion break has none of (D-08). Walk the same `parseRoadmapPhases` map
  `cmdAudit` builds (absent ROADMAP.md returns `fail('no-roadmap', ...)` in
  cmdAudit's own spelling); for each phase read `phases/<n>/CONTEXT.md` through
  `classifyAcceptanceCriteria` and `phases/<n>/UAT.md` through `parseUat`, and
  when EITHER file is absent the phase contributes nothing at all - not a break,
  not a `phases[]` entry (D-10: prior milestones' phase dirs are pruned by
  `milestone.md` step 3 by design, so an absent pair must never make the gate
  unpassable). Envelope: `phases` (per phase `{phase, criteria, items}`),
  `breaks` (`{phase, id, break: 'uncovered'}` - the ONLY verdict-moving field),
  `untraced` (`{phase, item, name}`, additive), `legacy` (phase numbers,
  additive), `unknown_criterion` (`{phase, item, criterion}` for a `criterion`
  value naming no declared id, additive), `context_issues`
  (`{phase, issues}` from the reader, additive) and `counts`
  `{criteria, covered, uncovered, untraced, phases}`. Every additive key is
  omitted when empty, matching the seam convention. Rules, each stated in a
  comment: an item COVERS the id in its `criterion` field; an item is `untraced`
  when it has no `criterion` AND its `origin` is neither `verifier` nor `smoke`
  (so `origin: criterion` with no id is still untraced - it names nothing); a
  phase whose UAT has at least one item, where NO item carries `criterion` AND no
  item carries `origin` either, is `legacy` and contributes nothing to counts, no
  breaks and no untraced entries (D-16, so an existing user project does not
  hard-fail on upgrade). The `origin` half of that test is load-bearing and must
  be stated in the comment: a checklist written AFTER this phase always carries
  at least one `origin` (the cold-start smoke item is emitted with
  `origin: smoke`, and every appended gap item gets `origin: verifier`), so a UAT
  carrying some `origin` value but not one `criterion` is NOT pre-field legacy -
  it is a post-field checklist whose links were dropped, and its criteria break
  normally. Without that discriminator the legacy exemption absolves exactly the
  regression this phase exists to catch: a `/cad-verify` that silently stops
  emitting `criterion` reads as "an old project" and the gate stays green
  forever. A phase whose ROADMAP box is unchecked contributes no breaks either -
  its criteria have not reached verification yet, so an in-progress phase must not
  FAIL a gate run mid-cycle; it still reports its `phases[]` entry. A
  phase with ZERO items is not legacy and its criteria all break (an empty
  checklist is exactly the drop this exists to catch); and legacy phases'
  criteria are held out of `counts.criteria`, which is what keeps the identity
  `counts.criteria === counts.covered + counts.uncovered` true - pin it in a
  comment the way `audit`'s `total = traced + broken + deferred` is pinned. The
  direction asymmetry is deliberate (D-09): four of four phases this cycle
  appended legitimate verifier gap items, so making the reverse direction
  breaking would make the gate unpassable. Add tests to planning.test.mjs with a
  local fixture helper that writes a phase's CONTEXT and UAT text raw (the
  coverage tests deliberately do NOT depend on task 4 - `parseUat` already reads
  any `field: value` line, so hand-written `criterion:` lines parse today). One
  test each: the synthesized fixture (D-15) - this repo's `.planning/phases/1/`
  CONTEXT AC1-AC7 prose and its 14 item names, with the two items carrying AC4
  and AC5 deleted - returns `breaks` naming exactly `AC4` and `AC5` and no
  others; the same fixture with all 14 items returns zero breaks; an item with
  neither `criterion` nor `origin` lands in `untraced` with `counts.uncovered`
  still 0; an item carrying `origin: verifier` and no `criterion` is in neither
  `untraced` nor `breaks`; a checklist where no item carries `criterion` and no
  item carries `origin` reports `legacy` and zero breaks; a checklist where no
  item carries `criterion` but at least one carries `origin` is NOT legacy and
  breaks on every criterion (the dropped-link regression, the sharpest test in
  this task - it must fail if the legacy rule is widened back to a bare
  no-`criterion` test); a phase whose ROADMAP box is unchecked contributes no
  breaks; an absent CONTEXT.md and an absent UAT.md each leave
  the phase out of the envelope with `ok:true`; a CONTEXT of bare `- [ ]`
  bullets surfaces `context_issues` carrying `criterion-unidded` and zero breaks;
  and the counts identity holds on a mixed tree. Finally correct
  `.planning/ROADMAP.md:93` (phase 5 success criterion 2), which names a v1.4.0
  phase-1 fixture that was verified not to exist: restate it as the fixture this
  task actually builds - synthesized from this cycle's phase-1 CONTEXT+UAT pair
  with two items removed, real prose and a synthetic defect (D-15). Change that
  sentence only; touch no other roadmap line.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, and
  running `criteria-coverage` against the synthesized fixture dir prints
  `breaks` with exactly two entries whose ids are `AC4` and `AC5`.

### Task 3: State the grammar and pin every row

- **Files:** cadence-core/references/acceptance-criteria.md,
  cadence-core/bin/planning-files.test.mjs
- **Action:** Write `cadence-core/references/acceptance-criteria.md` in the shape
  `references/roadmap-phases.md` established: what one question the grammar
  answers, the canonical bullet (`- [ ] AC1: text`), the continuation rule, the
  normalization paragraph (shared `normalize`, and WHY it differs from the
  roadmap's `normalizeCrlf`), the extent (heading to the next `## `), a table of
  all nine out-of-grammar codes with an example line, what the classifier does
  and the fix that changes it, the coverage contract read by
  `planning.mjs criteria-coverage` (uncovered breaks, untraced reports, the
  `origin` exemption values, the legacy rule, the absent-file rule), and a
  `Not in this grammar` section carrying the three stated limits: the id is
  phase-local and NOT globally unique, `AC-01` is rejected as a spelling because
  `REQ_ID_EXACT` (`planning-files.mjs:275`) admits it and a criterion id pasted
  into a plan's `requirements:` frontmatter would mint a phantom
  `orphans.plan_ids` entry (D-01), and `/cad-phase` renumber is a NON-EVENT here
  because `shiftPhaseTokens` matches only `Phase N` tokens and `phases/N/` paths
  while phase dirs move whole via `gitMv` with contents never rewritten (D-02).
  `cadence-core/references/` costs no weight budget
  (`lib/surface-weight.mjs:53-80` measures agents, skills and workflows only), so
  state the grammar in full rather than compressing it. Then add a
  `CRITERION_ROWS` table to planning-files.test.mjs beside `ACTIVE_ROWS`, each
  row `{name, text, criteria, codes}`, driven by
  `for (const row of CRITERION_ROWS) test(...)` - one `test()` per row, never one
  looped assertion inside a single test, which hides every row after the first
  failure (D-17). Rows: the canonical bullet; a checked `- [x]` bullet; a
  two-digit id; a wrapped criterion whose continuation lines join into one text;
  a criterion whose trailing `(human-verify: needs docker)` stays in the text; a
  CRLF fixture; an absent heading (`criteria: null`, no issues); a
  present-but-empty heading (`[]`, no issues); a continuation line naming another
  `AC<N>` reporting nothing; and one row per diagnostic code, plus one mixed row
  proving the codes arrive in line order. Every row in the reference's table has
  a row here and vice versa.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes, and
  `grep -c '^| \`criterion-' cadence-core/references/acceptance-criteria.md`
  returns 9, matching the nine distinct codes asserted by the row table.

### Task 4: Carry `criterion` and `origin` through the whole UAT lifecycle

- **Files:** cadence-core/bin/lib/planning-files.mjs,
  cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/templates/UAT.md, cadence-core/bin/planning.test.mjs
- **Action:** Register both fields in `UAT_FIELDS`
  (`planning-files.mjs:664-666`) as
  `['expected', 'criterion', 'origin', 'status', 'first_pass', 'source', ...]` -
  registration is what makes them survive, since `parseUat` accepts any field
  line but `renderUat` filters against this whitelist and every `uat record`
  rewrites the whole file (D-05). Export
  `const UAT_ORIGINS = ['criterion', 'verifier', 'smoke']` beside it as the one
  place the enum lives. In `cmdUat`: `init` and `refresh` validate each payload
  element's optional `criterion` against `/^AC\d+$/` and optional `origin`
  against `UAT_ORIGINS`, returning `bad-payload` naming the offending field, and
  both carry `source`, `criterion` and `origin` onto the item they build -
  `refresh` today drops every field but `name`/`expected` (`:417-420`) while
  `verify.md:48-58` routes every re-run of a phase through it, so an unfixed
  refresh makes any phase verified across two sessions untraceable even after
  init is right (D-06). Do NOT derive `origin: criterion` from the presence of
  `criterion`: `criterion` present is itself the criterion-derived marker, and
  fabricating a second one would put the new seam's output out of step with the
  backfill D-16 pins at 28 links plus 9 markers. `record` gains
  `['origin', 'origin']` in its `[flag, field]` list (`:441-443`), validated
  against `UAT_ORIGINS` BEFORE any write with a `bad-args` naming the legal
  values, plus `--origin` in `self-verify.mjs`'s `'uat record'` contract
  (`:66-67`) or it fires `unknown-flag`. `merge` writes `origin: 'verifier'` on
  the appended gap item (`:517`) and on the appended `human_checks` item
  (`:528`), which today writes no provenance of any kind - observable at
  `.planning/phases/1/UAT.md` items 12 and 14 (D-13). Leave the `human_checks`
  bare-`continue` counting bug alone: it is deferred to its own phase (D-14).
  Document both fields in `templates/UAT.md` - in the file template's item
  blocks and in `## Rules`: `criterion` names the CONTEXT `AC<N>` this item was
  built from, `origin` declares an item that legitimately has none, and a
  checklist where no item carries `criterion` is pre-field legacy that
  `/cad-audit` reports rather than breaks. Tests in planning.test.mjs: a
  `criterion` written by `init` is byte-present in the file after a `refresh`
  and again after a `record` (read the raw file, not the envelope); the same for
  `origin`; `uat record --origin verifier` sets it after the fact on an existing
  item; an out-of-enum `--origin` is refused with the file byte-unchanged; an
  out-of-shape `criterion` in an init payload is `bad-payload` with no file
  written; `refresh` carries all three of source/criterion/origin onto an
  appended item; and `merge`'s gap and `human_checks` appends both carry
  `origin: verifier`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, and a
  scripted lifecycle leaves `grep -c '^criterion: AC3' UAT.md` at 1 after every
  call: `uat init` with a payload carrying `criterion: AC3`, then `uat refresh`
  **with a payload containing one NEW item name** (not the same payload), then
  `uat record --item 1 --result pass`. The new item is what makes this
  falsifiable: `refresh` writes the file only when it appends
  (`if (fresh.length) writeUat(...)`, `planning.mjs:421`), so re-sending the
  identical payload leaves the file untouched and the grep would print 1 whether
  or not the refresh arm carries the field. Reverting the refresh half of this
  task must fail this check.

### Task 5: Teach the two writers the id and the carrier

- **Files:** cadence-core/workflows/context.md, cadence-core/workflows/verify.md,
  cadence-core/bin/weight-budgets.json
- **Action:** The grammar is enforced by a reader only and CONTEXT.md has no seam
  writer, so without this task the reference and the classifier ship while
  `/cad-context` keeps emitting bare bullets and every new CONTEXT is out of
  grammar the day after the phase closes (D-03). In `context.md`'s
  `write_context` skeleton (`:290-294`) change the acceptance-criteria block to
  `- [ ] AC1: {pass/fail, observed behavior}`,
  `- [ ] AC2: {pass/fail, observed behavior} (human-verify: needs {tool/service})`,
  `- [ ] AC3: ...`; and in the `acceptance_criteria` step add one rule to the
  existing list: each criterion carries a phase-local `AC<N>` id at the head of
  its bullet, numbered from 1 in presentation order, never phase-prefixed and
  never renumbered afterwards, pointing at
  `references/acceptance-criteria.md`. The `(human-verify: ...)` suffix stays
  exactly where it is as trailing prose (D-11). In `verify.md`'s
  `build_or_resume`, both the `uat init` and the `uat refresh` payloads gain the
  third field: `[{"name":..., "expected":..., "criterion":"AC3"}]`, with the id
  read from the CONTEXT bullet the item came from - this is where the link is
  lost today, because the model re-words each criterion into `{name, expected}`
  and nothing in the payload, the file or the parser carries a back-reference
  (D-04); do not infer the link by string similarity later, declare it here.
  State the two companion rules in the item rules list: the cold-start smoke item
  is emitted with `"origin":"smoke"`, and an item built from any other source
  (the PLAN+ROADMAP fallback branch, a SUMMARY-derived deliverable) carries
  neither field and is reported by `/cad-audit` as untraced without moving the
  verdict. Add one sentence that a CONTEXT whose criteria carry no `AC<N>` ids
  yields no `criterion` values at all, which reads as a pre-field legacy
  checklist rather than a failure. Update `verify.md`'s first success criterion
  to name the carrier ("one item per acceptance criterion, each carrying its
  `criterion` id"). Both files are budgeted to the byte
  (`weight-budgets.json`: context.md 16046, verify.md 10830), so update both
  entries to the exact counts `node cadence-core/bin/weight.mjs` reports - exact
  fit, never a padded ceiling.
- **Verify:** All four. (1) `node cadence-core/bin/self-verify.mjs` prints
  `ok:true` with no `budget-overrun` and no `unknown-flag` for either file.
  (2) `grep -n 'AC1:' cadence-core/workflows/context.md` shows the skeleton line
  the CONTEXT writer emits. (3) `grep -c '"criterion"' cadence-core/workflows/verify.md`
  returns at least 2 - one in the `uat init` payload and one in the `uat refresh`
  payload - and reading those two lines shows the field inside the payload
  example, not merely named in prose. (4) `grep -c '"origin":"smoke"' cadence-core/workflows/verify.md`
  returns 1. Checks 3 and 4 exist because this task is the ONLY place the
  criterion->UAT link is created, and nothing else in this plan - not
  `self-verify` (which reads script/subcommand/flags, never a payload's JSON
  shape) and not any of AC1-AC8 - would notice its absence. If the payload edit
  is dropped, every checklist written after this phase carries zero `criterion`
  values, and task 2's `origin`-aware legacy discriminator is what then turns
  that into a break rather than a silent pass.

### Task 6: Fold the coverage verdict into /cad-audit

- **Files:** cadence-core/workflows/audit.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Add the second seam call to section 2 and its interpretation to
  sections 3 and 4, so `/cad-audit` issues ONE verdict over both results (D-08).
  State: `breaks` is verdict-breaking and every other key
  (`untraced`, `legacy`, `unknown_criterion`, `context_issues`) is additive and
  changes neither counts nor the verdict, the same additive/breaking split
  `active_issues` and `unpicked` already carry; a `legacy` phase is a checklist
  written before the field existed, reported and never a break; an absent CONTEXT
  or UAT is nothing to prove, never a break, because `milestone.md:11-17` runs
  this gate at step 1 while the prune that deletes phase dirs runs at step 3
  (D-10). State explicitly that the milestone filter in section 2 does NOT apply
  to `breaks`: a criterion break carries no requirement id to filter on, and it
  needs none, because `milestone.md` step 3 removes completed phases from
  ROADMAP.md's live `## Phases` list, so `parseRoadmapPhases` only ever holds the
  current cycle's phases - and within that cycle the unchecked-box rule from task
  2 keeps a phase that has not reached verification from breaking a mid-cycle
  run. Write that reasoning down rather than the bare assertion; two reviewers
  read the bare form as contradicting D-08. Also state that `context_issues`
  carrying `criterion-duplicate-id` or `criterion-unidded` on a NON-legacy phase
  must be named in the report even though it moves no verdict: the reader keeps
  first-occurrence-wins on a duplicate id, so a second bullet reusing an id is
  dropped from the coverage domain entirely, and a silent additive key would let
  a real criterion go unproven with the gate green. Section 4's FAIL arm must name each uncovered id with its
  concrete next action (add the missing UAT item through `/cad-verify <N>`, or
  correct the criterion id in CONTEXT.md), and repeat the existing prohibition in
  the same words: this gate blocks a ship, do not soften it or mark it
  PASS-with-warnings. Then update `weight-budgets.json`'s `audit.md` entry
  (currently 5078) to the exact count `node cadence-core/bin/weight.mjs` reports.
  Keep the prose tight - audit.md is loaded on every run.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with no
  `unknown-subcommand`, no `unknown-flag` and no `budget-overrun` naming
  `audit.md` - which is the check that the CONTRACTS entry from task 2 and the
  invocation written here agree - AND
  `grep -c 'criteria-coverage' cadence-core/workflows/audit.md` returns at least
  1. self-verify only validates a subcommand the prose DOES name; it is silent
  when audit.md names none, so the grep is what proves the fold happened at all.

### Task 7: Backfill the four completed checklists

- **Files:** .planning/phases/1/UAT.md, .planning/phases/2/UAT.md,
  .planning/phases/3/UAT.md, .planning/phases/4/UAT.md
- **Action:** No seam path adds a field to an existing item (`uat init` refuses
  when the file exists, `refresh` only appends), so this is a deliberate hand
  edit of the four files (D-16). For each phase read its CONTEXT `## Acceptance
  criteria` and its UAT items, map each item to the criterion it was built from
  BY CONTENT (never by index - verify each pairing against the criterion text),
  and insert `criterion: AC<N>` on its own line immediately after that item's
  `expected:` line. Every item that maps to no criterion gets
  `origin: verifier` in the same position instead. The verified totals are 28
  criterion links (7 per phase, AC1-AC7) and 9 origin markers - 7 in phase 1, 1
  in phase 2, 0 in phase 3, 1 in phase 4; if a content mapping disagrees with
  those counts, the mapping is wrong, so re-read rather than force it. Record the
  full item-number -> id mapping for all four phases in the task's commit message,
  because every count-based and round-trip check below is permutation-invariant:
  swapping two ids inside one phase leaves all three green while the audit then
  certifies a criterion as covered by an item that tests a different one, which is
  worse than a missing link because it silences the break. Change
  nothing else: no item renumbering, no field reordering, no Summary edit, no
  touched status. The line position matters because `UAT_FIELDS` renders
  `criterion` and `origin` directly after `expected`, and a later `uat record`
  rewrites the whole file - putting them anywhere else means the first record
  silently reorders the file.
- **Verify:** All three hold: a parse-then-render round trip of each of the four
  files is byte-identical (`parseUat` then `renderUat` equals the file on disk,
  proving the inserted lines are in canonical field order and nothing else
  moved);
  `cat .planning/phases/{1,2,3,4}/UAT.md | grep -c '^criterion: AC'` prints 28
  and the same pipe with `grep -c '^origin: verifier'` prints 9; and
  `node cadence-core/bin/planning.mjs criteria-coverage` reports zero `breaks`,
  no `legacy` entry and `counts.criteria === counts.covered` for phases 1-4. Then
  the one check the other three cannot make: spot-read three pairings by content -
  phase 3 item 3 and item 5, and phase 1 item 1 - and confirm each item's `name`
  describes the criterion its `criterion:` id names. The counts and the round trip
  are blind to a permuted mapping; only reading the pair catches it.

### Task 8: Pin the renumber non-event

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Two tests beside the existing renumber block, both built on
  `renumberTree()` with a real `## Acceptance criteria` section written into
  `phases/2/CONTEXT.md` carrying `AC1`-`AC3` (and, to make the test sharp, a
  `Phase 2` token elsewhere in that same file, so the assertion is not vacuous
  about which tokens renumber touches). `renumber insert --at 2`: read
  `phases/3/CONTEXT.md` afterwards and assert its bytes equal the original file's
  bytes, and that `classifyAcceptanceCriteria` returns the same three ids.
  `renumber remove --n 1`: the same assertion against `phases/1/CONTEXT.md` after
  the shift down. The ROADMAP criterion names both directions, so pin both. Name
  in a comment what these tests pin - a NON-event (computed edits are
  ROADMAP/REQUIREMENTS/STATE only, `planning.mjs:1029-1056`; phase dirs move
  whole via `gitMv` with contents never rewritten, `:1128-1140`), so the only way
  to fail them is for an id to embed the phase number, which is exactly what
  D-02 forbids and what the first roadmap criterion calls worse than no id at
  all.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes. The
  falsification is a MUTATION OF THE CODE, not of the fixture: temporarily add
  `phases/<n>/CONTEXT.md` to the set of files `cmdRenumber` runs
  `shiftPhaseTokens` over, and both new tests must fail (the fixture's `Phase 2`
  token shifts and the file's bytes change); revert afterwards. Do NOT use
  "rewrite one fixture id to `P2-AC1` and watch it fail" - that mutation changes
  the expected bytes and the actual bytes together, so the test stays green and
  proves nothing. Additionally assert the parsed ids equal a hardcoded
  `['AC1','AC2','AC3']` rather than a value re-derived from the same file, so the
  test still fails if the grammar itself is deleted.

### Task 9: Public docs and the full gate

- **Files:** CHANGELOG.md, README.md
- **Action:** Under `## [Unreleased]`, add `### Added` entries for the CONTEXT
  acceptance-criteria id grammar and its reference, the `criteria-coverage`
  planning seam, and the two UAT item fields, and a `### Changed` entry saying
  `/cad-audit` now proves criterion coverage in both directions and FAILs on a
  criterion that reached no UAT item. State the upgrade posture in the user's
  terms in one sentence: an existing checklist where no item carries `criterion`
  is read as legacy and breaks nothing, and new checklists carry the link from
  `/cad-verify` onward. In README.md, extend the `/cad-audit` bullet (line 81) so
  it names the second direction alongside the requirement trace, in the same
  voice as the surrounding bullets - one line, no new section. Then run the gate
  and fix anything it names.
- **Verify:** All three pass: `node --test cadence-core/bin/*.test.mjs` exits 0,
  `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `criteria-coverage` reachable from `audit.md` (no `unknown-subcommand`), the
  `--origin` flag accepted (no `unknown-flag`) and no `budget-overrun` on
  `audit.md`, `context.md` or `verify.md`.

### Task 10: The /cad-audit FAIL fixture

- **Files:** cadence-core/references/acceptance-criteria.md
- **Action:** Build two disposable `.planning` trees at
  `/tmp/cadence-phase5-fixture/fail/.planning/` and
  `/tmp/cadence-phase5-fixture/pass/.planning/`, each carrying ROADMAP.md,
  REQUIREMENTS.md, and `phases/1/` with CONTEXT.md, UAT.md **and PLAN.md** -
  built from the same synthesized pair task 2 uses (this cycle's phase-1 CONTEXT
  AC1-AC7 and its 14 items). The PLAN.md is not optional and its frontmatter must
  declare the same requirement id the REQUIREMENTS row carries: `cmdAudit` builds
  `planByReq` solely from `listPlanFiles(pdir)` + `parsePlanRequirements`
  (`planning.mjs:594-606`), so a tree with no PLAN file returns
  `break: "no-plan"` and `counts.broken: 1` for every row - verified live against
  the real seam. Omit it and the `pass` tree FAILs on the requirement arm while
  the `fail` tree's FAIL is not attributable to coverage at all, which destroys
  the whole point of the pair. The REQUIREMENTS and ROADMAP halves must be CLEAN
  in both trees, so `audit`'s own arm reports zero broken and the ONLY difference
  is the coverage arm: the `fail` tree's UAT has the AC4 and AC5 items deleted,
  the `pass` tree has all 14. Confirm that directly while building them -
  `node cadence-core/bin/planning.mjs audit --dir <tree>/.planning` must report
  `counts.broken: 0` for BOTH trees before the human check is worth running.
  Record the two paths and the rebuild recipe in a short
  `## Rebuilding the demonstration fixture` section at the end of
  `cadence-core/references/acceptance-criteria.md`, since `/tmp` is reaped and the
  next person to check this needs the recipe rather than the tree.
- **Verify:** Two parts, because the slash-command half cannot run against this
  working tree.

  Machine half, runnable now by the executor - this is what proves the seam:
  1. `node cadence-core/bin/planning.mjs criteria-coverage --dir /tmp/cadence-phase5-fixture/fail/.planning`
     prints `breaks` with exactly two entries, ids `AC4` and `AC5`.
  2. The same call against `.../pass/.planning` prints no `breaks`.
  3. `node cadence-core/bin/planning.mjs audit --dir /tmp/cadence-phase5-fixture/fail/.planning`
     prints `counts.broken: 0` - the requirement arm is clean, so any FAIL the
     folded verdict issues is attributable to coverage alone.
  4. `node cadence-core/bin/self-verify.mjs` prints `ok:true` again, re-run here
     because this task edits `cadence-core/references/acceptance-criteria.md`,
     which `mdFiles` scans (`self-verify.mjs:130-135`), AFTER task 9 recorded the
     gate green.

  Human half (AC7), carried to `/cad-verify 5`: `/cad-audit` is a slash-command
  surface no executor can invoke, and it resolves its seam through
  `${CLAUDE_PLUGIN_ROOT}`, which points at the INSTALLED plugin - currently the
  released 1.5.0 cache, which contains no `criteria-coverage` subcommand and no
  folded `audit.md`. Running it today therefore exercises the shipped release and
  says nothing about this phase. Do not work around that with a dev symlink into
  this repo (the project has deliberately had none since 2026-07-28). The check is
  valid only once the plugin is updated to a build containing this phase; at
  `/cad-verify 5`, with that build installed: (1) open a session with its working
  directory set to `/tmp/cadence-phase5-fixture/fail`; (2) run `/cad-audit`;
  (3) expect FAIL naming `AC4` and `AC5` by id with a concrete next action for
  each, NOT PASS and not PASS-with-warnings, and note that the requirement trace
  itself reports zero broken; (4) repeat in `/tmp/cadence-phase5-fixture/pass`;
  (5) expect PASS. Record the plugin version the check ran against.

## Notes

- **Plan shape: one plan, deviating from CONTEXT's `multiple plans` directive.**
  CONTEXT proposed splitting at the grammar/reader/check seam (AC1, AC2, AC3,
  AC5) versus the carrier seam (AC4, AC6). The file lists refute it: both halves
  touch `cadence-core/bin/lib/planning-files.mjs` (the reader and `UAT_FIELDS`),
  `cadence-core/bin/planning.mjs` (the new subcommand and the `uat` arms),
  `cadence-core/bin/planning.test.mjs`, `cadence-core/bin/self-verify.mjs` (the
  new CONTRACTS entry and the `--origin` flag) and
  `cadence-core/bin/weight-budgets.json`. There is cross-slice ordering too: AC6
  is proved by the check the other slice builds, and the check reads the fields
  the carrier slice defines. Shared files plus cross-slice ordering means one
  plan; `plan-overlap` would refuse the parallel path anyway.
- **ROADMAP.md:93 is not a source.** It names a v1.4.0 phase-1 fixture ("the
  round-1 checklist that dropped AC4 and AC5") that was verified not to exist:
  no committed checklist has fewer items than its phase's criteria, and v1.4.0's
  criteria carry no `AC<N>` ids at all. Per D-15 the fixture is synthesized from
  this cycle's phase-1 pair instead, and task 2 corrects that roadmap sentence.
- **AC7 is the only human-verify criterion** and it is task 10's Verify. The
  fixture is disposable; the rebuild recipe ships in the reference file so a
  reaped `/tmp` costs a rebuild rather than the check.
- **`origin` is written, never derived** (task 4). `criterion` present is the
  criterion-derived marker; `origin` declares an item that legitimately has none.
  This keeps the seam's new output in step with the backfill D-16 pins at 28
  links plus 9 markers, so the four shipped files and any file written after this
  phase carry the same shape.
- **Adjudicated `plan` review, 2026-07-29.** Four reviewers (cad-reviewer,
  gpt-5.6-terra, gemini-3.6-flash, deepseek-v4-flash), 18 raw findings, 9 applied
  above. The load-bearing one, converged on by three of the four: nothing in the
  original plan proved task 5's `verify.md` payload edit happened, and the legacy
  rule as first written then read a criterion-less new checklist as a pre-field
  project - so a `/cad-verify` regression would have left the gate green forever.
  Closed by the `origin`-aware legacy discriminator in task 2 and the payload
  greps in task 5. Four findings were refuted and deliberately NOT applied:
  (1) two reviewers called the "no milestone filter on `breaks`" rule a D-08
  contradiction on the premise that ROADMAP.md holds phases from every milestone -
  false, `milestone.md` step 3 prunes completed phases from the live list, though
  the unchecked-box rule was added to cover the mid-cycle case they were reaching
  for; (2) one claimed task 2's tests depend on task 7's backfill - task 2 writes
  raw fixture text and says so; (3) two called the one-plan shape a violation of
  the CONTEXT directive - `workflows/plan.md` authorizes the planner's
  file-independence analysis to override it when recorded, which the note above
  does.
