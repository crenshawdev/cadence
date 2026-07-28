---
phase: 5
plan: 1
requirements: ["AUD-01"]
files: ["cadence-core/bin/lib/planning-files.mjs", "cadence-core/bin/planning-files.test.mjs", "cadence-core/bin/planning.mjs", "cadence-core/bin/planning.test.mjs", "cadence-core/references/req-traceability.md", "cadence-core/workflows/audit.md", "skills/cad-audit/SKILL.md", "METHOD.md", "design-notes/planning-mjs-interface.md", "cadence-core/bin/weight-budgets.json", "CHANGELOG.md"]
---

# Phase 5: An audit armed in the partially-planned state - Plan

## Goal

`audit` counts an `## Active` requirement that no phase has picked up, so the
traceability gate holds in the state a milestone spends most of its life in -
partly planned, rows for some ids and not others - and not only against a
zero-row table.

## Must be true when done

- Against a fixture whose `## Traceability` holds rows for some but not all
  `## Active` ids, `planning.mjs audit` carries the unpicked id in
  `requirements[]` with its own break code and counts it in `counts.broken`, so
  `audit.md`'s arithmetic verdict is FAIL - where the same fixture run against
  the seam at this phase's starting commit prints `broken:0` with that id in no
  field of the envelope.
- In that same fixture `counts.total === counts.traced + counts.broken +
  counts.deferred`, and `counts.total` exceeds the `## Traceability` row count
  by exactly the number of unpicked ids.
- `unseeded` fires at ANY row count, its payload naming exactly the `## Active`
  ids with no row; the two zero-row reports HEAD ships are byte-identical
  afterward - a present-but-empty `## Active` gives `{active_ids: []}`, an
  absent heading adds `no_active_section: true` - and a tree with no `## Active`
  heading gains no break at any row count.
- An id-shaped line inside `## Active` that the bold-bullet grammar does not
  recognize (a v1.3.1-style table row, an unbolded bullet, an ordered item, a
  heading, or a plain prose line in a section that declares no ids at all) is
  reported in `active_issues` with its line number, a code and the offending
  text - while this repo's own `## Active`, whose intro paragraph names three
  ids beside five real bullets, reports zero issues.
- An id under `## Deferred` with no `## Active` bullet produces no break, and a
  `Deferred`-status row still lists under `deferred` and never as unpicked.
- No shipped surface still says the unpicked case changes neither `counts` nor
  the verdict: `workflows/audit.md`, `skills/cad-audit/SKILL.md`,
  `references/req-traceability.md`, `METHOD.md` and
  `design-notes/planning-mjs-interface.md` each name the new break code, and
  `references/req-traceability.md` states the `## Active` out-of-grammar table
  with one row per code, each pinned by a row in `planning-files.test.mjs`.
- `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
  pass and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` - no
  `budget-overrun` after the prose moves.

## Context

CONTEXT.md D-01..D-14 bind this plan: an unpicked `## Active` id BREAKS the
verdict (D-01) with `counts.total` widened so `total = traced + broken +
deferred` survives (D-02), no exemption for a milestone-level requirement no
phase carries (D-03), `unseeded` widened rather than given a sibling field
(D-04), an out-of-grammar `## Active` line reported with the bold-bullet grammar
itself unchanged (D-05), `parseActiveIds`' `null` never coerced to `[]` (D-06),
`## Deferred` excluded by section placement and never by a status check (D-07),
the whole change inside the existing `cmdAudit` so no `CONTRACTS` row and no
`self-verify.mjs` edit is owed (D-08), the unpicked set computed as
`parseActiveIds` minus `parseRequirements` ids with no roadmap-side source
(D-09), no `audit --milestone` flag (D-10), every criterion written against a
FIXTURE because `/cad-plan 5` has already seeded AUD-01's row here (D-11),
breadth pinned by a parser-level table with a handful of seam-level re-asserts
(D-12), every contradicted prose surface moving with `weight-budgets.json`
bumped in the same commit (D-13), and no seam-side `Deferred` writer (D-14).
Follow the existing `{line, code, text}` issue shape and the
one-`test()`-per-row table idiom already in `planning-files.test.mjs`.

## Tasks

### Task 1: State the `## Active` grammar as a classifier, with the parser-level table

- **Files:** cadence-core/bin/lib/planning-files.mjs,
  cadence-core/bin/planning-files.test.mjs
- **Action:** In `planning-files.mjs`, in the `## Active` grammar block, hoist
  the existing bullet regex to a module const `ACTIVE_BULLET =
  /^-\s+(?:\[[ xX]\]\s+)?\*\*([^*]+)\*\*/` (byte-identical - D-05 keeps the
  grammar unchanged) and add `export function classifyActiveSection(text)`
  returning `{ids, issues}` where `ids` is `string[]|null` and `issues` is
  `[{line, code, text}]` in line order. Then reduce `parseActiveIds` to `return
  classifyActiveSection(text).ids;` so the id extraction has exactly ONE
  implementation and `seed-reqs`' declared-id set cannot drift from `audit`'s.
  Rules, stated in the doc comment: (1) Split the RAW text on `\n` - do NOT
  call `normalize`/`normalizeCrlf` here: REQUIREMENTS.md has write paths
  (`insertReqRows`, `setReqStatus`) that split raw bytes, the same asymmetry
  `normalizeCrlf`'s comment states for the roadmap, and a CRLF file already
  parses today because the bold span closes before the `\r`. (2) No line
  matching `/^## Active\s*$/` -> `{ids: null, issues: []}`; an absent heading is
  NOT an out-of-grammar report, it is the datum `no_active_section` already
  carries (D-06). (3) Otherwise walk from that line to the next `/^## /` (the
  same bound `sectionBody` cuts at). A line matching `ACTIVE_BULLET`
  contributes its trimmed bold span as an id - de-duplicated
  first-occurrence-wins, empty skipped - and NEVER produces an issue. (4) Every
  other line is scanned for a requirement-id token, `REQ_ID_TOKEN =
  /\b[A-Z][A-Z0-9]{1,7}-\d+\b|(?:^|[^\w#])#\d+\b/` (the two shipped id
  spellings: `TRI-01`/`GRM-01` and the v1.3.1 issue form `#41`). No token, no
  issue. A token yields at most ONE issue for that line, code by shape:
  `^\s*\|` -> `active-table-row`; `^\s*[-*+]\s` -> `active-unbolded-bullet`;
  `^\s*\d+[.)]\s` -> `active-ordered-item`; `^#{1,6}\s` -> `active-heading`;
  anything else -> `active-prose-line`. (5) The four entry-shaped codes fire
  regardless of how many bullets the section parsed - deliberately unlike
  phase-4's near-miss suppression, because a table row or an unbolded bullet
  BESIDE real bullets is the mixed-authoring case D-05 exists to catch (an id
  half-declared), not a detail section. `active-prose-line` is the one
  conditional code: emit it only when the section declared ZERO ids, so an
  ordinary intro paragraph naming ids beside a real bullet list stays quiet
  (this repo's own `## Active` header paragraph names TOK-01, RDM-01 and AUD-01
  and must report nothing) while a section authored entirely as prose is still
  never silent (phase-1 D-20). Implement that by collecting prose candidates
  during the walk and dropping them at the end when `ids.length > 0`, keeping
  the surviving issues in line order. `line` is 1-indexed into the whole text;
  `text` comes from the existing `issueText` helper. Also state in the doc
  comment the sharp edge the unchanged grammar keeps: a BOLD span that is not
  id-shaped is still read as an id (`- **Note**: ...` declares the id `Note`),
  because narrowing it would change what `seed-reqs` treats as declared - the
  mirror of the reason D-05 rejects widening - and under task 2's break that
  phantom is loud and named rather than silent. Keep the function pure and
  total (no I/O, no throw) and the `@ts-check` annotation exact
  (`@returns {{ids: string[]|null, issues: Issue[]}}`). In
  `planning-files.test.mjs` add an `ACTIVE_ROWS` table beside the existing
  tables, each row `{name, text, ids, codes}`, asserted one `test()` per row
  (`active-section: ${row.name}`) against `classifyActiveSection`, covering at
  minimum: a plain bold bullet; a `- [ ]` and a `- [x]` checkbox bullet; a
  duplicate id (first wins); an absent heading (`ids: null`, no issues); a
  present-but-empty heading (`[]`, no issues); an `## Active`-shaped list under
  a LATER `## ` heading (not read); the v1.3.1 TABLE form (header, separator,
  two `| TRI-01 (...) | v1.3.1 |` rows -> `ids: []` plus two
  `active-table-row`); that same table WITH a real bold bullet above it (the
  mixed case - the id parses AND both table rows still report); an unbolded
  bullet carrying an id (`- AUD-01: text`); an unbolded bullet carrying NO id
  (`- see references/req-traceability.md` -> no issue); an ordered item
  `1. AUD-01: text`; a `### AUTH-01` heading inside the section; a `| #41 (...) |`
  table row (the issue-id spelling); a prose paragraph naming ids in a section
  with NO bullets (`active-prose-line`); the SAME prose paragraph in a section
  that also has bold bullets (ids parse, ZERO issues - the false-positive guard
  this repo's own file depends on); an indented continuation line under a bold
  bullet that names another id (no issue); a `- **Note**: ...` bold non-id
  bullet (`ids: ['Note']`, no issues - the sharp edge, pinned deliberately); and
  a CRLF fixture whose bold bullet still parses with no issue. Add one separate
  test asserting the exact `{line, code, text}` object for the v1.3.1 table
  fixture, so the line number is pinned and not just the code. Leave the seven
  existing `parseActiveIds` tests in place - they now exercise the delegation.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes and
  `node --test cadence-core/bin/planning-files.test.mjs 2>&1 | grep -c
  "active-section:"` reports at least 19 (one per enumerated `ACTIVE_ROWS`
  case above - a lower count means a case was dropped). Against the two REAL shipped shapes:
  `node -e "Promise.all([import('./cadence-core/bin/lib/planning-files.mjs'),import('node:fs')]).then(([m,fs])=>console.log(JSON.stringify(m.classifyActiveSection(fs.readFileSync('.planning/REQUIREMENTS.md','utf8')))))"`
  prints five ids and `"issues":[]` (zero - the intro paragraph naming TOK-01,
  RDM-01 and AUD-01 must NOT fire), and
  `git show 6feef38:.planning/REQUIREMENTS.md > /tmp/v131-reqs.md` followed by
  the same call reading `/tmp/v131-reqs.md` prints `"ids":[]` with exactly three
  `active-table-row` issues naming the TRI-01, FIX-01 and WNF-01 lines. That
  second run is the false-clean this diagnostic exists to remove.

### Task 2: Break the audit verdict on an unpicked `## Active` id

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add `classifyActiveSection` to the import block at `:37-45`,
  keeping `parseActiveIds` (still `seed-reqs`' caller, untouched by this
  phase). In `cmdAudit`: call `const active = classifyActiveSection(reqText);`
  once, beside the existing `parseRequirements` call - no new file read and no
  roadmap-side source, since `parseRoadmapPhases` carries no id mapping (D-09).
  After the `known` Set at `:628`, compute `const unpicked = (active.ids ||
  []).filter((id) => !known.has(id));` - exactly `parseActiveIds` minus
  `parseRequirements` ids (D-09), with NO plan-side subtraction: an id a plan
  declares but no row carries is BOTH `unpicked` here and an
  `orphans.plan_ids` entry there, which is the seed-reqs-never-wrote state and
  must report from both directions. Push `{ id, break: 'unpicked' }` per
  unpicked id, in `## Active` order, AFTER the row-derived entries, so a fully
  seeded tree's `requirements` array stays byte-identical to HEAD. Deliberately
  NO `phase` key on those entries: there is no row, so there is no Phase cell to
  report, and `phase: null` is `no-phase`'s datum (a row that names no phase) -
  conflating them would make two breaks whose fixes differ (assign the row a
  phase vs plan the requirement or defer it) indistinguishable to `audit.md`'s
  next-action list. Change `counts.total` to `rows.length + unpicked.length`
  (D-02), with a comment spelling the identity out: `requirements.length +
  deferred.length === rows.length + unpicked.length`, so `total = traced +
  broken + deferred` survives and `planning.test.mjs`'s pinned counts stay
  arithmetic rather than coincidence. Widen `unseeded` to
  `if (unpicked.length || rows.length === 0)` emitting
  `{ active_ids: unpicked, ...(active.ids === null ? { no_active_section: true }
  : {}) }` - the payload is now "the `## Active` ids with no row" at every row
  count (D-04), and at zero rows that set already equals the whole `## Active`
  list, so every non-empty section's payload is unchanged. Keeping
  `rows.length === 0` as a SECOND trigger is deliberate: the unpicked arm alone
  would drop the two zero-row reports HEAD ships and
  `references/req-traceability.md` documents - a present-but-empty `## Active`
  (`{active_ids: []}`) and an absent heading (`+ no_active_section: true`).
  Never coerce `active.ids` null to `[]` (D-06): every project scaffolded before
  v1.4.0 has no `## Active` heading by this grammar, and a coercion would read
  its entire scope as unpicked and make its audit unpassable. Add
  `...(active.issues.length ? { active_issues: active.issues } : {})` to the
  envelope between `deferred` and `unseeded` - additive, never a break and never
  a count, because a line outside the grammar declares no id and there is
  nothing to count; that consequence (the id on such a line is invisible to the
  unpicked arm until the line is rewritten as a bullet) is stated in tasks 3-4's
  prose rather than implied. Update the two block comments: the break-code
  roster at `:581` gains `unpicked`, and the `:635-641` D-07 comment is rewritten
  for D-01/D-04 - it currently ends "Neither a count nor the verdict moves",
  which this change reverses. In `planning.test.mjs`: REWRITE the test at
  `:1286` (`unseeded is additive - counts, requirements and orphans keep their
  pre-existing shape`) - its zero-row fixture now breaks; assert
  `requirements` is `[{id:'X', break:'unpicked'}]`, `counts` is
  `{total:1, traced:0, broken:1, deferred:0}`, `unseeded` is
  `{active_ids:['X']}`, and the `orphans.plan_ids` entry for X is STILL there
  (the deliberate co-occurrence). Keep the test at `:1302` (absent heading, zero
  rows) unchanged and assert additionally that `requirements` is `[]`. Extend
  the test at `:1314` to assert no entry carries `break: 'unpicked'` and that
  `counts.total` still equals the row count (non-zero rows, no `## Active`
  heading - criterion 5). ADD: a partially-planned fixture (`## Active` with A
  and B, a Traceability row for A only at `Complete` against a checked phase 1,
  `phases/1/PLAN.md` declaring A) asserting A traced with no break, B carrying
  `break:'unpicked'`, `counts` `{total:2, traced:1, broken:1, deferred:0}`,
  `counts.total === counts.traced + counts.broken + counts.deferred`, and
  `unseeded` `{active_ids:['B']}`; a `## Deferred` fixture (id Z under
  `## Deferred`, never in `## Active`) asserting no entry for Z at all, plus an
  `## Active` id whose row Status is `Deferred` appearing in `deferred` and NOT
  in `unseeded` (D-07 - excluded by section placement and by having a row, never
  by a status check that would re-capture RCL-06); a seam-level `active_issues`
  case (a v1.3.1-shaped `## Active` table beside a normally seeded row)
  asserting `active_issues[0].code === 'active-table-row'` with its `line`, and
  that the id named on that line appears in NO break and in `unseeded` nowhere -
  the stated blind spot, pinned so the prose claim is falsifiable; and one
  `seed-reqs` test against that same v1.3.1-shaped `## Active` asserting its
  envelope is unchanged (every declared id under `orphan_ids`, no
  `active_issues` field), proving task 1's delegation did not leak into the
  writer.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes. In a
  scratch tree (ROADMAP with one checked phase, REQUIREMENTS whose `## Active`
  bullets are A and B with a Traceability row for A only, `phases/1/PLAN.md`
  declaring A), `node cadence-core/bin/planning.mjs audit --dir <tmp>` prints
  `{"id":"B","break":"unpicked"}`, `"counts":{"total":2,"traced":1,"broken":1,"deferred":0}`
  and `"unseeded":{"active_ids":["B"]}`; extracting `cadence-core/bin` from this
  phase's starting commit (`git archive <sha> cadence-core/bin | tar -x -C
  <old>`) and running `node <old>/cadence-core/bin/planning.mjs audit --dir
  <tmp>` on the SAME tree prints `"broken":0` with no `B` anywhere in the
  output. That before/after pair is the phase's whole point; if the old copy
  also reports B, the fixture is wrong, not the code.

### Task 3: Write the widened contract into the traceability reference

- **Files:** cadence-core/references/req-traceability.md
- **Action:** In `## Active`, keep the bullet-form and `null`-vs-`[]`
  paragraphs verbatim and add a subsection stating the lines the grammar does
  not recognize: a table with one row per code (`active-table-row`,
  `active-unbolded-bullet`, `active-ordered-item`, `active-heading`,
  `active-prose-line`) giving an example line, what `audit` does with it, and
  the fix, each row pinned by a row in `planning-files.test.mjs`; plus the three
  stated non-rules - an entry-shaped near-miss is reported even beside real
  bullets, a plain prose line is reported ONLY when the section declares no ids
  (so an intro paragraph naming ids stays quiet), and a bold span that is not
  id-shaped is still an id (`- **Note**: ...` declares `Note`, which now FAILs
  the audit by name until the bullet is unbolded or that id is given a phase).
  Rewrite `## The two additive /cad-audit diagnostics` (its title, its opening
  "Neither changes `counts` or the PASS/FAIL verdict" sentence, and the
  `unseeded` bullet's "fires when the Traceability table has ZERO rows at all"
  clause are all now false): `unseeded` fires at any row count, its payload is
  the `## Active` ids with no row, and it is NO LONGER verdict-neutral - each of
  those ids also carries an `unpicked` break and moves `counts.broken`, with
  `counts.total` counting rows PLUS unpicked ids so `total = traced + broken +
  deferred` still holds. State that `active_issues` and `nonconforming_plans`
  ARE additive and change neither `counts` nor the verdict, and say plainly why
  that is a real cost here rather than a reassurance: the id named on an
  `active_issues` line is NOT in the unpicked set and NOT in `counts` until the
  line is rewritten as a bullet. (Phase-1's UAT finding 4 is the reason this is
  spelled out - a promise that a diagnostic never moves the verdict must be
  true or absent.) In the seeding/who-writes-what material, record the two exits
  for an `## Active` id with no row - plan it into a phase, or move it to
  `## Deferred` - and that there is no third: a row with an em-dash Phase cell
  yields `phase: null` and already breaks as `no-phase` (D-03), `## Deferred` is
  excluded by SECTION PLACEMENT because `sectionBody` never reads past the next
  `## `, and the `Deferred` Status value only ever excludes ids that already
  have a row (D-07). In the migration section, add that a project with no
  `## Active` heading gains NO break from this rule, so a pre-v1.4.0 tree's
  audit is unchanged until the heading is renamed. Claim nothing the tests do
  not pin.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `for c in active-table-row active-unbolded-bullet active-ordered-item
  active-heading active-prose-line; do grep -q "$c"
  cadence-core/references/req-traceability.md && grep -q "$c"
  cadence-core/bin/planning-files.test.mjs || echo "MISSING $c"; done` prints
  nothing; `grep -n "ZERO rows at all" cadence-core/references/req-traceability.md`
  and `grep -n "Neither changes" cadence-core/references/req-traceability.md`
  each return nothing (both are HEAD strings this task must remove); `grep -n "unpicked"
  cadence-core/references/req-traceability.md` shows the break code and the two
  exits.

### Task 4: Move every shipped surface the new verdict contradicts, and bump the budgets

- **Files:** cadence-core/workflows/audit.md, skills/cad-audit/SKILL.md,
  METHOD.md, design-notes/planning-mjs-interface.md,
  cadence-core/bin/weight-budgets.json, and - conditionally, only if the CHECK
  below finds them contradicting - cadence-core/workflows/milestone.md,
  skills/cad-health/SKILL.md, cadence-core/templates/REQUIREMENTS.md. The three
  consuming surfaces are listed here so the task holds the authorization its
  own instruction to "edit it in THIS task" needs; leaving them off would make
  the conditional branch unexecutable and D-13's same-commit sync unreachable.
- **Action:** `workflows/audit.md`: add `unpicked` to the break-code
  enumeration at `:23-24`; rewrite the `unseeded` clause at `:28-30` from "the
  Traceability table has no rows at all" to "the `## Active` ids with no
  Traceability row, at any row count - each also carries an `unpicked` break";
  add `active_issues` to that same field list (a line inside `## Active` outside
  the stated bullet grammar - `references/req-traceability.md`). In step 3, add
  the `unpicked` bullet: an `## Active` requirement no phase picked up, the
  quiet failure this audit exists to catch; the two exits are plan it into a
  phase (`/cad-plan` seeds the row) or move it to `## Deferred`, and a row with
  an em-dash Phase cell is `no-phase`, not an exit; expected mid-cycle exactly
  like `not-verified` and a defect at ship time, so the verdict only actually
  moves in the window where every seeded row is already `Complete`. In step 4,
  replace the sentence at `:57-63` - `frontmatter_issues`, `active_issues` and
  `nonconforming_plans` are additive and change neither `counts` nor the
  verdict; `unseeded` names ids that DO break, as `unpicked`. Leave step 5's
  "or mark it deferred" next action standing (D-14: the hand edit is the
  documented exit; no seam writes a `Deferred` row). `skills/cad-audit/SKILL.md`:
  its `<objective>` already promises "a requirement that no phase ever picked
  up" - add the one clause that makes the promise arithmetic (it is an
  `unpicked` break counted in `counts.broken`, not a note beside a PASS). Keep
  it to a clause; the budget is exact. `METHOD.md` "Traceability runs both
  directions" (`:433-447`): add `unpicked` to the break roster with its meaning
  - an `## Active` requirement no phase picked up, the partially-planned state
  the gate used to be blind to. `design-notes/planning-mjs-interface.md` section
  5: add an `{"id":"REQ-8","break":"unpicked"}` entry to the JSON sample, add
  `unpicked` to the `break ∈` roster, and note that `counts.total` is
  Traceability rows PLUS unpicked ids so `total = traced + broken + deferred`
  holds. That sample's own `counts` must be corrected in the same edit: `:160`
  currently reads `{"total":9,"traced":6,"broken":3,"deferred":1}` - 6+3+1=10,
  so it already violates the identity, and the new entry makes it 11 against 9
  directly beneath the sentence asserting the arithmetic is exact. Set the
  sample to a set of numbers that actually adds up with the fifth break entry
  present. Then CHECK - do not auto-edit - the three consuming surfaces D-13
  names, per phase 4's own /cad-verify finding that a `files:` list covered the
  contradicted surfaces and missed the consuming ones:
  `cadence-core/workflows/milestone.md:11-17` (its step-1 gate branches on the
  verdict alone - confirm it enumerates no break codes),
  `skills/cad-health/SKILL.md:38-52` (confirm rules 4-5 claim only that the
  table parses and that phase/row status agree, never that the table is the
  whole of scope), and `cadence-core/templates/REQUIREMENTS.md:64-79` (confirm
  its notes do not promise that an unseeded id is invisible to the audit).
  On that third surface there is a known contradiction to resolve, not merely
  to confirm: every new prose surface above offers `## Deferred` as one of the
  two exits for an `unpicked` break, but no shipped scaffold has that heading -
  `templates/REQUIREMENTS.md:28` names the section `## v2 Requirements`
  ("Deferred. Tracked, not in the current roadmap."), `:71-77` uses `Deferred`
  only as a Traceability Status value, and `references/req-traceability.md`
  documents neither. `## Deferred` exists in this repo's own private
  REQUIREMENTS.md alone (`:77`), which is where D-07 read it. A user whose
  audit FAILs would be told to move the id to a heading their file does not
  have, and the Status-value reading is impossible for an id with no row. Pick
  ONE spelling and make every surface this task touches use it - either add
  `## Deferred` to the template as the section `sectionBody` already excludes,
  or say `## v2 Requirements` in the new prose - and state which in the
  Deviations section. Do not ship the two spellings side by side.
  Report what was checked and whether it moved; if one does contradict, edit it
  in THIS task and bump its budget with the rest. Finally run
  `node cadence-core/bin/weight.mjs` and set every edited measured surface's
  `weight-budgets.json` entry to the exact byte count it reports -
  `cadence-core/workflows/audit.md` (3600) and `skills/cad-audit/SKILL.md`
  (1633) sit at their budgets with zero headroom, so any prose byte fails
  `budget-overrun` without the bump, and this bump must land in the SAME commit
  as the prose (D-13). `METHOD.md`, the reference and the design note are not
  measured surfaces and have no entry - do not add one, and do not touch any
  other entry.
- **Verify:** `node cadence-core/bin/weight.mjs` byte counts for
  `cadence-core/workflows/audit.md` and `skills/cad-audit/SKILL.md` equal their
  `weight-budgets.json` entries and `node cadence-core/bin/self-verify.mjs`
  prints `"problems":[]` (no `budget-overrun`, no `unknown-flag`, no
  `missing-path`); `grep -l "unpicked" cadence-core/workflows/audit.md
  skills/cad-audit/SKILL.md METHOD.md design-notes/planning-mjs-interface.md`
  lists all four; `grep -c "rows at all" cadence-core/workflows/audit.md`
  returns 0, and `grep -n "change neither" cadence-core/workflows/audit.md`
  returns a line that does NOT name `unseeded` - those two greps are the
  falsifiers for the sentence D-01 reverses. Use exactly those two patterns:
  both return 1 at HEAD (`:28-29` wraps as "has no" / "rows at all", and `:59`
  reads "change neither", not "changes neither"), so a longer pattern matches
  nothing before the edit and both falsifiers pass vacuously on an untouched
  file. Confirm that by running both greps BEFORE editing - each must return 1,
  or the pattern has drifted and the check is worthless.

### Task 5: Record the change and clear the ship gate

- **Files:** CHANGELOG.md
- **Action:** Under `## [1.4.0] - unreleased` / `### Fixed`, add a block headed
  **An audit armed in the partially-planned state** covering: an `## Active`
  requirement no phase has picked up now breaks `/cad-audit` as `unpicked` and
  moves `counts.broken`, so the gate holds while a milestone is only partly
  planned rather than only against a zero-row table - the residue of the blind
  spot that let the v1.2.0 and v1.3.1 closes through; `counts.total` now counts
  Traceability rows PLUS unpicked ids so `total = traced + broken + deferred`
  still holds, which is a real change for any caller written against
  `total === rows.length`; `unseeded` is row-count-independent, naming the
  `## Active` ids with no row at any row count, and is no longer verdict-neutral
  (this reverses the additive shape shipped one milestone earlier, deliberately
  - say so); a line inside `## Active` that the bold-bullet grammar does not
  recognize (a v1.3.1-style table row, an unbolded bullet, an ordered item, a
  heading, or a prose line in a section that declares no ids) is reported in
  `active_issues` with its line and a code instead of vanishing, while the
  grammar itself is unchanged; the two exits for a broken id are a real phase or
  `## Deferred`; and a project with no `## Active` heading gains no break, so
  pre-v1.4.0 trees audit exactly as before. Point at
  `cadence-core/references/req-traceability.md` for the grammar and its
  out-of-grammar table.
- **Verify:** `grep -n "partially-planned state" CHANGELOG.md` shows the entry
  under `[1.4.0]`; `node --test cadence-core/bin/*.test.mjs` passes,
  `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`. Then the
  end-user-facing evidence, on a FIXTURE built from scratch - never a copy of
  this repo's `.planning`, and never this repo's tree (D-11). Build
  `<scratch>/.planning/` (the directory MUST be named `.planning`, for the
  human-verify step below) holding: a ROADMAP with one CHECKED phase
  (`- [x] **Phase 1: ...**`), a REQUIREMENTS whose `## Active` declares two bold
  bullets A and B with a Traceability row `| A | Phase 1 | Complete |` only, and
  `phases/1/PLAN.md` declaring `requirements: ["A"]`. Every row seeded and
  Complete is the ONLY window in which the verdict actually moves (D-01), so
  that shape is what makes the demo honest. From `<scratch>`,
  `node <repo>/cadence-core/bin/planning.mjs audit` prints
  `{"id":"B","break":"unpicked"}` with `"broken":1`,
  `"unseeded":{"active_ids":["B"]}` and a FAIL verdict; add
  `| B | Phase 1 | Complete |` and the same command prints `"broken":0` with no
  `B` anywhere and a PASS. Do NOT write this step against a copy of this repo's
  `.planning`: `/cad-plan 5` seeds AUD-01's row against an UNCHECKED Phase 5, so
  that row breaks as `not-verified` and such a copy reports `"broken":1` before
  any edit - verified live, `counts {"total":5,"traced":4,"broken":1}` - which
  makes a `"broken":0` baseline assertion unsatisfiable and the whole before/
  after pair unreadable. human-verify (a slash-command surface the executor
  cannot invoke, so the executor sets the fixture up and hands it over): from
  `<scratch>` - `cd` there, because `/cad-audit` takes a milestone label and has
  no path argument (`workflows/audit.md:12,19`), so it can only ever read the
  `.planning` under the current directory - run `/cad-audit` in the pre-fix
  state and confirm the model reports FAIL naming B, with "plan it into a phase
  or move it to the deferred section" as the next action, not a
  PASS-with-warnings. Use whichever deferred-section spelling task 4 settled on.

## Notes

- Planner choices CONTEXT left open, recorded here: the break code is
  `unpicked` (CONTEXT's own word for the set, and it reads correctly beside
  `unseeded`, which now carries the same ids); the entry shape is
  `{id, break:'unpicked'}` with no `phase` key, so it can never be confused with
  `no-phase`; the envelope field for the grammar diagnostic is `active_issues`,
  shaped and named after `frontmatter_issues` and placed between `deferred` and
  `unseeded`; `unseeded` keeps `rows.length === 0` as a second trigger so HEAD's
  two zero-row reports survive verbatim; and the diagnostic reports entry-shaped
  lines always but a plain prose line only when the section declares no ids.
- The unchanged grammar keeps a sharp edge that D-01 sharpens further: a bold
  bullet whose bold span is not an id (`- **Note**: scope is frozen`) declares
  the id `Note`, which now FAILs the audit by name until the bullet is unbolded.
  Narrowing the bold span to id-shaped text was rejected for D-05's own reason
  in mirror image - it would change what `seed-reqs` treats as declared. Task 1
  pins the behavior with a test row and task 3 states it; flagged for the user
  because it is a new way to fail a gate, loudly and with the offending text
  named.
- `design-notes/planning-mjs-interface.md` is a planner addition past D-13's
  literal contradicted list: its section 5 enumerates the break roster and the
  `counts` shape, both of which this phase changes. Phase 4's task 5 kept the
  same file in sync for the same reason.
- `seed-reqs` is deliberately untouched (D-08 scopes the change to `cmdAudit`).
  It keeps calling `parseActiveIds`, whose behavior task 1 preserves by
  construction through delegation, and its envelope gains no field - task 2 pins
  that with a test. So a v1.3.1-shaped `## Active` still reports every declared
  id under `seed-reqs`' `orphan_ids` with no explanation; `audit`'s
  `active_issues` is where that line is finally named.
- CONTEXT's flagged assumption stands unresolved and is now shipped-visible: an
  external reader written against `total === rows.length` will silently disagree
  after D-02. The CHANGELOG entry states the change for that reader; nothing in
  this repo reads the envelope outside `workflows/audit.md`, verified by
  grepping every `planning.mjs audit` invocation in shipped prose.
- Two pre-existing parser limits bound how far this change can be trusted
  (phase-2 SUMMARY/CAPTURE, out of scope here, recorded so the executor does not
  chase them): a `## Traceability` row indented up to 3 spaces is legal GFM but
  invisible to `parseRequirements`, so its id now reads as unpicked and BREAKS
  where it used to be silently uncounted - louder and in the right direction,
  but a new FAIL mode on a file that renders correctly; and `insertReqRows`
  targets the LAST `## Traceability` heading while `parseRequirements` splits on
  the FIRST.
- Recalled prior art applied: phase-2's UAT item 4 ("zero-row table gets an
  additive unseeded signal, verdict unmoved", phases/2/UAT.md) is deliberately
  reversed by D-01, which is why task 2 rewrites that test and task 5's
  CHANGELOG says so outright; phase-1's UAT open finding 4 (a diagnostic must
  not both drop payload and claim it never moves the verdict, phases/1/UAT.md)
  is why `active_issues`' verdict-neutrality is stated with its cost in tasks 3
  and 4 instead of asserted as a reassurance; and the stated-grammar-plus-
  reported-out-of-grammar shape with a parser-level table and a handful of
  seam-level re-asserts is phase-1 D-06 / phase-3 D-09 / phase-4 D-11 verbatim.
- The `weight-budgets.json` numbers in task 4 were live at gather time
  (`audit.md` 3600, `skills/cad-audit/SKILL.md` 1633, zero headroom on both);
  if another change lands on either file first, bump against the measured size,
  never against these.
- Plan shape honors CONTEXT's `one plan` directive and the file-independence
  test agrees: tasks 1-2 share `planning-files.mjs`/`planning.mjs` and their
  tests, tasks 3-5 depend on the codes and field names tasks 1-2 fix, and task
  4's budget bump must land with the prose it measures. No slice is
  file-disjoint AND order-free.
