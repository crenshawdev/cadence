# Phase 5: An audit armed in the partially-planned state - Context

Gathered: 2026-07-28
Feeds: /cad-plan 5

The design brief is the phase-2 diff-review capture (`.planning/CAPTURE.md`,
HIGH): `unseeded` fires only on a ZERO-row `## Traceability` table
(`planning.mjs:642-646`) and `counts.total` is `rows.length`, so once any phase
of a milestone is planned, an `## Active` id no phase picked up is never
counted and never breaks. Phase 2's D-07 deliberately scoped the verdict
arithmetic out and left the call here.

Reproduced live at gather time on this repo: `node cadence-core/bin/planning.mjs
audit` returns `counts:{total:4,traced:4,broken:0,deferred:0}` - a clean PASS -
while `AUD-01` sits in `## Active` (`REQUIREMENTS.md:24-26`) with no row in
`## Traceability` (`:103-108`) and appears in no field of the output. Note the
ROADMAP goal line's own evidence is stale: it names TOK-01 and RDM-01 as the
unpicked ids, but phases 3 and 4 have since been planned and seeded rows.
AUD-01 is now the only witness.

## Scope boundary

In: a verdict-breaking unpicked-id rule inside the existing `cmdAudit` (D-01),
with `counts.total` widened so the envelope's arithmetic identity survives
(D-02) and no exemption for a milestone-level requirement no phase carries
(D-03); `unseeded` widened to be row-count-independent rather than gaining a
sibling field (D-04); an out-of-grammar diagnostic for an id-shaped line inside
`## Active` that the bold-bullet grammar does not recognize (D-05); the
`null`-vs-`[]` distinction preserved exactly as today (D-06); `## Deferred`
excluded by section placement rather than by status (D-07); and every
contradicted shipped prose surface moving in the same change with
`weight-budgets.json` bumped in the same commit (D-13).

Out: a new `planning.mjs` subcommand, and therefore any `CONTRACTS` row or
`self-verify.mjs` change (D-08). An `audit --milestone <label>` flag (D-10).
Widening `parseActiveIds` to accept the v1.3.1 table form, which would change
what counts as a declared id for `seed-reqs` too (D-05, rejected arm). A
seam-side writer for `Deferred` rows or any other escape hatch (D-14). Any
change to the reverse-orphan direction (`orphans.plan_ids`) beyond what the
shared computation implies. Any rewrite of `## Shipped` rows whose Phase cell
is `—`.

Deferred: None
Plan shape: one plan - the verdict change is the spine criteria 1-3 and 5-6 all
hang off, criterion 4 is a parser change feeding the same computation, and
criterion 7 is the prose sweep that must move with them or `self-verify` fails.
The only file-disjoint split (parser+test, then seam+docs) is serial by
dependency, so a split would pay bookkeeping for no parallelism - the same
shape phases 3 and 4 both took.

## Durable decisions

- D-01 (an unpicked `## Active` id BREAKS the verdict; it is not an additive
  signal): a new break code on a `requirements[]` entry moves `counts.broken`.
  This reverses the direction phase-2 D-07 set, and does so deliberately:
  `workflows/milestone.md:11-17` branches solely on the /cad-audit verdict, so
  an additive field leaves the gate exactly as permeable as it was at the
  v1.2.0 and v1.3.1 closes, and `skills/cad-audit/SKILL.md:19-21`'s shipped
  promise - "the quiet failure a per-phase flow can miss - a requirement that
  no phase ever picked up" - stays unbacked by arithmetic. The usual objection
  does not hold: a planned-but-unverified phase already breaks as `not-verified`
  (`planning.mjs:623`, `audit.md:41-42` "Expected mid-cycle"), so the verdict
  only actually moves in windows where every seeded row is already `Complete`.
  Accepted cost, verified live: on this repo the audit flips `broken:0` ->
  `broken:1` (AUD-01) and PASS -> FAIL the moment this ships, and stays there
  until `/cad-plan 5` seeds the row. Chosen over the additive arm, which
  `audit.md:57-63` currently describes as the shape of `unseeded`.
- D-02 (`counts.total` includes unpicked ids, so `total = traced + broken +
  deferred` survives): today `counts.total` is `rows.length`
  (`planning.mjs:656`) and deferred rows `continue` before the
  `requirements.push` (`:610-626`), so `requirements.length + deferred.length
  === rows.length` holds and `planning.test.mjs:1059` pins it. An unpicked id
  has no row, so counting it as broken without moving `total` would make
  `broken` exceed what `total` can account for and would make every shipped
  statement of `counts` (`audit.md:22-32,48-49`) describe arithmetic the seam
  no longer does. Chosen over restating the identity in prose, and over a
  separate count field - which would leave the break arm with no arithmetic to
  move, contradicting D-01.
- D-03 (no exemption for a milestone-level requirement no phase carries): the
  doctrine already exists - `templates/ROADMAP.md:52-54` ("Every v1 REQ-ID
  appears in exactly one phase") and `:80-81` ("coverage must reach 100% before
  the roadmap is approved"). The phase-less rows this project shipped (PUB-01,
  PUB-02 at v1.1.0; TRI-01, FIX-01, WNF-01 at v1.3.1, all archived with Phase
  `—` at `REQUIREMENTS.md:53-54,60-62`) were the doctrine being violated with
  no gate to catch it, not a supported pattern. There is also no half-measure
  available: with no row an id is unpicked and breaks, and giving it a row with
  Phase `—` yields `phase: null`, which already breaks as `no-phase`. The two
  exits are a real phase or `## Deferred`. Chosen over a stated
  "milestone-level, no phase" marker, which adds a notation to REQUIREMENTS.md
  and a rule to every reader of the table.
- D-04 (`unseeded` is WIDENED to be row-count-independent, rather than gaining a
  sibling field): it becomes "the `## Active` ids with no row", firing at any
  row count. Its payload is already exactly that set at zero rows
  (`planning.mjs:642-646`, `references/req-traceability.md:80-92`), so this is
  one question at two row counts rather than two questions. Chosen over freezing
  `unseeded` at zero rows and adding a second field, which makes both fire with
  identical payloads at zero rows and leaves the two shipped prose statements
  of `unseeded`'s meaning ambiguous about which a reader should act on. This is
  the shape the phase-2 capture note asked for.
- D-05 (an id-shaped line inside `## Active` that the grammar does not recognize
  is REPORTED, not silently dropped; the bold-bullet grammar itself is
  unchanged): `parseActiveIds` matches
  `/^-\s+(?:\[[ xX]\]\s+)?\*\*([^*]+)\*\*/` (`planning-files.mjs:266-280`) and
  its own comment at `:253-263` refuses to guess an id out of unbolded prose -
  that refusal stands. What changes is that the refusal becomes visible. The
  drop is real and this repo is the proof: at `6feef38` the v1.3.1 `## Active`
  was a markdown TABLE of milestone asks, which parses to `[]`, so under D-01 a
  milestone authored that way would report a clean gate over a section holding
  every uncovered id - the exact false-clean this phase exists to remove. Same
  stated-grammar-plus-diagnostic pattern as phase-1 D-20, phase-3 D-05 and
  phase-4 D-04. Chosen over leaving it documented-but-uncoded, and over widening
  the grammar to accept the table form, which would change what counts as a
  declared id for `seed-reqs` as well.
- D-06 (`parseActiveIds`' `null` is never coerced to `[]`): an absent `##
  Active` heading stays a different report from "declared, nothing unpicked".
  `planning.mjs:638-645` already states the reason ("that would collapse
  'milestone never opened' into 'declared but never seeded'") and `:775` carries
  the same `no_active_section` in `seed-reqs`. Under D-01 the stakes rise
  sharply: every project scaffolded before v1.4.0 has no `## Active` heading by
  this grammar (`references/req-traceability.md:24-30,100-107`), so a coercion
  would read their entire scope as unpicked and their audit could never PASS
  until the heading was renamed.
- D-07 (a deliberately deferred requirement is excluded by SECTION PLACEMENT,
  not by status): `parseActiveIds` calls `sectionBody(text, 'Active')`
  (`planning-files.mjs:266-268`) and `sectionBody` cuts at the next `## `
  (`:375-379`), so `## Deferred` is never read; the `Deferred` Status value
  only ever excludes ids that already have a table row
  (`planning.mjs:611-612`). Recorded because the obvious "fix" - adding a status
  check - is wrong and would re-capture RCL-06, deferred since v1.1.0
  (`REQUIREMENTS.md:77-81`), blocking every future close under D-01 until
  someone deleted it from a file it is correctly recorded in.

## Decisions

- D-08 (the change lands inside the existing `cmdAudit`; no new subcommand, so
  no `CONTRACTS` row and no `self-verify.mjs` change is owed):
  `planning.mjs:583-658` already reads REQUIREMENTS.md, ROADMAP.md and every
  phase dir's plan files, and already calls `parseActiveIds` at `:644`;
  `self-verify.mjs:50` holds the `audit: []` row. Phase-2 D-04 attaches the
  CONTRACTS obligation to new seam subcommands, and this phase adds none - the
  same reason phases 3 and 4 stayed inside existing commands.
- D-09 (the unpicked set is `parseActiveIds(reqText)` minus the ids of
  `parseRequirements(reqText)` - both already loaded, no new file read and no
  roadmap-side source): `planning.mjs:608` parses the rows and `:628` already
  builds `known` for the reverse-orphan check. The roadmap side carries no id
  mapping to cross-check against - `parseRoadmapPhases` returns only
  `{n, name, desc, checked}` (`planning-files.mjs:66-78`) and the template's
  `**Requirements:**` line (`templates/ROADMAP.md:29`) is read by nothing in
  `cadence-core/bin`, so a rule keyed on it would see nothing on this repo,
  whose ROADMAP has no `## Phase Details` section at all.
- D-10 (no `audit --milestone` flag): `## Active` IS the open milestone's scope
  by the stated grammar (`references/req-traceability.md:10-14`), so the
  unpicked set is already milestone-bounded, unlike `requirements[]` which
  traces the whole table and which `audit.md:34-35` assigns the model to
  filter. Adding a flag would also fail `self-verify`'s prose lint
  (`:264-279`) until the CONTRACTS row moved with it.
- D-11 (the falsifiable evidence is a FIXTURE, never this repo's tree): running
  `/cad-plan 5` calls `seed-reqs` (`planning.mjs:719-777`,
  `workflows/plan.md:224-243`), which inserts the AUD-01 row and erases the
  exact state under test. A criterion written against this tree would pass
  vacuously the moment the phase is planned, and the phase would ship with no
  test that fails if the code were reverted.
- D-12 (breadth is pinned by a parser-level table in `planning-files.test.mjs`;
  only a handful of rows re-assert at seam level): phase-1 D-06, phase-3 D-09
  and phase-4 D-11 verbatim. `planning.test.mjs:126-130` spawns a node process
  per case; the six existing `parseActiveIds` cases live at
  `planning-files.test.mjs:639-672` and the three seam-level `unseeded` cases
  D-07 shipped at `planning.test.mjs:1286-1323`.
- D-13 (every contradicted shipped surface moves in the same change, with
  `weight-budgets.json` bumped in the same commit): contradicted -
  `workflows/audit.md:22-32` (the field list) and `:57-63` (the explicit
  "changes neither `counts` nor the verdict" sentence, which D-01 reverses),
  `skills/cad-audit/SKILL.md:13-26`, `references/req-traceability.md:80-92`,
  and `METHOD.md:433-447` (the break-code roster gains a member). Consumers to
  CHECK rather than auto-edit, per phase 4's own /cad-verify finding that a
  `files:` list covered the contradicted surfaces and missed the consuming
  ones: `workflows/milestone.md:11-17`, `skills/cad-health/SKILL.md:38-52`,
  `templates/REQUIREMENTS.md:64-79`. Live at gather time, `audit.md` is at 3600
  and `skills/cad-audit/SKILL.md` at 1633 - their exact budgets, zero headroom
  on both - so any prose byte fails `budget-overrun` without the bump.
- D-14 (no seam-side escape hatch ships with this phase; the hand edit stays the
  documented exit): no writer in `cadence-core/bin` ever creates or sets a
  `Deferred` row - `insertReqRows` writes the literal `Pending`
  (`planning-files.mjs:283-290`) and `setReqStatus` writes only `Pending` or
  `Complete` (`planning.mjs:345`). `workflows/audit.md:66-68`'s next-action list
  already ends with "or mark it deferred", so the exit is stated even though no
  command performs it. Chosen over shipping a `Deferred` writer in the same
  phase, which would add a seam writer and its tests to a phase already moving
  the verdict arithmetic.

## Acceptance criteria

- [ ] Against a fixture whose `## Traceability` holds rows for some but not all
      `## Active` ids, `planning.mjs audit` names the unpicked id, counts it in
      `counts.broken`, and the verdict is FAIL - where HEAD returns PASS with
      that id absent from every field of the envelope.
- [ ] In that same fixture `counts.total === counts.traced + counts.broken +
      counts.deferred`, and `counts.total` exceeds the `## Traceability` row
      count by exactly the number of unpicked ids.
- [ ] `unseeded` fires on a fixture with a NON-ZERO row count and at least one
      unpicked id, where HEAD fires only at zero rows, and its payload names
      exactly the unpicked ids.
- [ ] An id-shaped line inside `## Active` that is not a bold bullet - a
      v1.3.1-style table row, an unbolded bullet - is reported with its own
      diagnostic naming the offending line, instead of being absent from both
      the unpicked set and the output.
- [ ] A fixture with no `## Active` heading returns the same no-active-section
      report as HEAD, with no unpicked ids and no new break.
- [ ] A fixture with an id under `## Deferred` and no `## Active` entry produces
      no unpicked break for that id.
- [ ] `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
      both pass, `self-verify` reports no `budget-overrun` after the prose moves,
      and `workflows/audit.md`, `skills/cad-audit/SKILL.md`,
      `references/req-traceability.md` and `METHOD.md` no longer state that the
      unpicked case changes neither `counts` nor the verdict.

## Flagged assumptions

- Whether any consumer outside Cadence reads the `audit` envelope's `counts`
  shape - Unclear, carried forward from phase 2's own flagged assumption. D-02
  changes what `total` means, so a external reader written against
  `total === rows.length` would silently disagree.
- The exact out-of-grammar shape set inside `## Active` - Unclear. The v1.3.1
  table form is verified failing, but D-05's rule generalizes past it, so the
  row set is the planner's judgment against the stated rule rather than a closed
  enumeration. Phase-1 D-20 applies: a shape left out of grammar needs a
  diagnostic, not silence.
- Whether the widened `unseeded` should keep its name - Likely fine. The field's
  meaning generalizes rather than reverses, but a reader written against its
  "zero rows" semantics now sees it fire in a state it never fired in before,
  and the name still says "unseeded" rather than "unpicked".
- The `weight-budgets.json` byte-exactness in D-13 was live-checked at gather
  time (`audit.md` 3600, `skills/cad-audit/SKILL.md` 1633, zero headroom). If
  another change lands on either file first, the bump is against the new sizes.
- This repo's own `/cad-audit` FAILs from the moment this ships until
  `/cad-plan 5` seeds the AUD-01 row - Confident, and it is the intended
  dogfood rather than a defect, but it means the v1.4.0 close cannot run its
  gate clean until phase 5 is both planned and verified.
