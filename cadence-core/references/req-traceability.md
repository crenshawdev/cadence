# REQUIREMENTS.md traceability grammar

The stated grammar for the `## Active` and `## Traceability` sections of
`.planning/REQUIREMENTS.md` (`templates/REQUIREMENTS.md`). Read every shipped
form to exactly the ids and rows declared, the same discipline
`plan-frontmatter.md` states for a plan file's own frontmatter. The single
implementation is `parseActiveIds` / `insertReqRows` / `parseRequirements` /
`setReqStatus` in `cadence-core/bin/lib/planning-files.mjs`.

## `## Active`

The open milestone's committed scope - the requirement ids a `/cad-plan` run
is allowed to seed a row for. Bounded at the next `## ` heading, like every
other section this file's parsers read.

The bullet form is `- **<ID>**: <one line>`, with an optional leading
checkbox (`- [ ] **<ID>**: ...` / `- [x] **<ID>**: ...`) tolerated. The id is
the bolded span's contents, trimmed. First occurrence wins; a repeated id
later in the section is ignored. **An unbolded bullet declares no id**, and no
fallback guesses an id out of unbolded prose.

`parseActiveIds` returns `null` - never `[]` - when the `## Active` heading is
ABSENT, so a caller can tell "no milestone scope declared" from "declared,
nothing matched". A present-but-empty heading (the shipped template's
`**None.**` placeholder, or a real heading with zero bulleted ids yet) returns
`[]`. Every bookkeeping seam and diagnostic (`audit`'s `unseeded`, below) keeps
this distinction; coercing `null` to `[]` misreports an unopened milestone as
one opened and never seeded.

### The lines this grammar does not read

A line inside `## Active` that names a requirement id but is not a bullet of
the form above declares NO id. `/cad-audit` reports it in `active_issues` as
`{line, code, text}`, one issue per line, in line order. Each code below is
pinned by a case in `planning-files.test.mjs` (cadence-tests repository).

| Code | Example line | What `audit` does with it | Fix |
|---|---|---|---|
| `active-table-row` | `\| TRI-01 (triage every open bug) \| v1.3.1 \|` | declares no id; reported | rewrite the row as `- **TRI-01**: ...` |
| `active-indented-bullet` | `  - **AUD-02**: a sub-bullet` | declares no id; reported | move it to column 0; the grammar reads column-0 bullets only |
| `active-nondash-bullet` | `* **AUD-02**: star-bulleted` | declares no id; reported | use `- **AUD-02**: ...`; the grammar reads `-` markers only |
| `active-unbolded-bullet` | `- AUD-02: an unbolded bullet` | declares no id; reported | bold the id immediately after the marker: `- **AUD-02**: ...` |
| `active-ordered-item` | `1. AUD-02: the audit gate` | declares no id; reported | rewrite as a `-` bullet |
| `active-heading` | `### AUD-02` | declares no id; reported | declare the requirement as a bullet under it (a `###` sub-heading is section text; a `## ` heading ends the section) |
| `active-prose-line` | `Scope for v1.4.0: TOK-01 and RDM-01.` | declares no id; reported (conditionally - see below) | write one bullet per requirement |
| `active-non-id-bullet` | `- **Note**: scope frozen` / `- **AUD-01:** text` | IS an id by the grammar, and stays one for `seed-reqs`; held OUT of `audit`'s arithmetic and reported | put exactly the id inside the bold span, punctuation and prose outside it (`- **AUD-01**: text`), or unbold a bullet that declares no requirement |
| `active-multi-id-bullet` | `- **AUTH-01** and **AUTH-02**: both sides` | the FIRST span is the declared id; every later id-shaped span declares nothing and is reported | give each requirement its own bullet. The grammar never reads every span, since that would mint an id out of ordinary emphasis (`- **GRM-01**: the **core** path` would declare `core`); emphasis that is not id-shaped is not reported |
| none - the near-miss no diagnostic can see | `- 2FA-01: two-factor auth` | declares no id and reports NOTHING: the unanchored prose scan requires a letter at the HEAD of the category, so an unbolded digit-leading id is not a token at all | bold it. `- **2FA-01**: two-factor auth` is a real declaration `audit` admits and counts (`isRequirementId` wants a letter SOMEWHERE in the 2-8 character category, not at its head) - but nothing tells you when the bold is what you forgot |

Three rules a reader would not guess:

- An entry-shaped near-miss (every code above but `active-prose-line` and
  `active-non-id-bullet`) is reported even when real bullets parsed beside it:
  an id half-declared in a mixed section is what the diagnostic catches.
- `active-prose-line` is the one conditional code. It fires only when the
  section declares ZERO ids that `audit` admits into its arithmetic
  (`isRequirementId`) AND the line names at least one id that appears
  nowhere else in REQUIREMENTS.md. A `- **Note**: ...` bullet is not a
  declaration for this purpose, though it is one to `seed-reqs`. So an intro
  paragraph naming ids above a real bullet list stays quiet, and so does a
  closed milestone's `## Active` ("No active milestone. `v1.2.0` shipped its
  scope (REV-01, SOC-01) - see `## Shipped`"). A section authored entirely as
  prose naming ids the file records nowhere is never silent.
- A bold span that is not id-shaped is STILL an id to the grammar:
  `- **Note**: ...` declares the id `Note`, and `seed-reqs` treats it as
  declared. `audit` narrows on its own side instead: only an id that is
  exactly `PREFIX-N` or `#N` may carry an `unpicked` break or enter `counts`,
  so a prose bold-bullet is reported (`active-non-id-bullet`) and never fails a
  gate under a name that is not a requirement.

## `## Traceability`

Live requirement -> phase -> plan -> verified trace for the open milestone.
Bounded the same way. Row form: `| <ID> | Phase <N> | <Status> |`, with
`Pending | Complete | Deferred` the only legal Status values. The `Phase N`
spelling (not a bare number) is mandatory: `shiftPhaseTokens` shifts only
`Phase K` tokens and `phases/K/` paths, and `renumber remove` blanks a
Pending row's cell only when it holds the removed integer `Phase N`, so a
bare-number cell desyncs the table on the next phase insert or removal.
`renumber insert` and `renumber remove` both shift them only on rows whose
Status is exactly `Pending`. `Complete` and `Deferred` rows, and every
REQUIREMENTS line outside this table including `## Shipped`, stay
byte-identical. A `Complete` row citing a moved phase, or on remove the
removed one, is named in `warn` so it can be re-pointed with `req-row --id <id>
--phase <N>`.

## Who writes what

The rows live in the state file, and this table is generated from it. Three
seams change them:

- `/cad-plan` (the `seed-reqs` seam call) CREATES rows, and only ever at
  Status `Pending` - the seam has no parameter for any other status.
- `/cad-verify`'s `phase-done` is the only writer of `Complete` (and of
  `Pending` again on `--undo`).
- `req-row` re-points a row at a phase the state holds, keeping its Status,
  or writes `Deferred` over a `Pending` one (`/cad-phase remove`'s orphans).
- `/cad-audit` reads this table and never writes it.

## Seeding rules

`seed-reqs --phase <N>` collects the requirement ids every plan file under
`phases/<N>/` declares in its `requirements:` frontmatter (union,
first-occurrence-wins across the phase's plan(s)), then partitions them
against `## Active`:

- An id WITH an `## Active` bullet gets a row inserted at `| <id> | Phase <N>
  | Pending |`, unless a row for that id already exists (idempotent - a
  replan or a `--gaps` plan never duplicates a row). An existing row whose
  Phase cell names a different phase is reported (`mismatched`), not skipped
  as clean.
- An id with NO `## Active` bullet gets no row and is reported under
  `orphan_ids` instead. Never widen this to seed every declared id: that would
  make `orphans.plan_ids` (below) unreachable for seeded ids and delete the
  audit's check for scope creep or a typo in a plan's `requirements:` list.
- When the `## Active` heading itself is absent, every id is reported under
  `orphan_ids` PLUS `no_active_section: true`: the milestone's `## Active`
  section was never opened (an old-heading project, or a close that never
  seeded it), so these ids are not scope creep, and the fix is to open the
  section, not to edit the plan.

## What `/cad-audit` reports on this section

`unseeded` is NOT additive. An `## Active` id with no Traceability row carries
an `unpicked` break in `requirements[]` and moves `counts.broken`, so the
verdict is FAIL: the gate holds while a milestone is only partly planned, not
only against a zero-row table. `workflows/milestone.md`'s ship gate branches on
the verdict alone.

- `unseeded: { active_ids: [...] }` fires at ANY row count, naming the
  `## Active` ids with no Traceability row. Every id it names also carries an
  `unpicked` break; the field is the payload, `requirements[]` is the verdict.
  `active_ids` keeps the `null`-vs-`[]` distinction from `parseActiveIds`
  above: `no_active_section: true` sits alongside it when the heading itself is
  absent. A present-but-empty `## Active` still reports `{active_ids: []}` at
  zero rows, and an id that is not id-shaped (`- **Note**: ...`) is never in
  the payload. That exclusion is `isRequirementId`'s ADMISSION TEST: `PREFIX-N`
  whose prefix is 2-8 characters carrying a letter SOMEWHERE in them - not at
  the head (PRS-02) - plus `#N`. `seed-reqs` asks the wider bullet grammar
  instead, so it will seed a row for an id this payload refuses to name; the
  gap is visible only in `active_issues`. A bolded digit-leading category
  (`2FA-01`, `3DS-02`) IS admitted, counted and named in `unseeded`; unbolded
  it declares nothing and no diagnostic says so (the table's last row). A category with no letter in it at all
  (`2026-08`) is refused, and reported as `active-non-id-bullet`.
- `counts.total` is Traceability rows PLUS unpicked ids, so
  `total = traced + broken + deferred` holds when a break has no row.
- `active_issues` and `nonconforming_plans` ARE additive: they change neither
  `counts` nor the verdict. The id named on an `active_issues` line is NOT in
  the unpicked set and NOT in `counts` until the line is rewritten as a bullet
  whose bold span is exactly the id. A section authored entirely as a table
  reports every row and still PASSes; the issues are the only place that scope
  is visible.
- `nonconforming_plans` fires when a phase directory holds a `PLAN*.md` file
  that is not `PLAN.md` or `PLAN-<N>.md` (e.g. a stray `PLAN-gaps.md`) - a
  filename no seam and no executor dispatch reads, so its requirements and
  files are invisible everywhere while the phase still reports success.
  `plan-overlap` emits the same field, bare filenames instead of
  `phases/<n>/<file>` paths.

### The two exits for an `unpicked` id, and the one that is not an exit

- Plan it into a phase. `/cad-plan <n>` seeds the row (`seed-reqs`, above), and
  the break clears on the next audit.
- Move the bullet out of `## Active` into any `## ` section after it - the
  shipped template spells it `## v2 Requirements`; this repo's own file uses
  `## Deferred`. The exclusion is by SECTION PLACEMENT, because every parser
  here cuts at the next `## ` heading, never a status check: the `Deferred`
  Status value only excludes ids that ALREADY have a row.

There is no third exit. Giving the id a row with an em-dash Phase cell yields
`phase: null`, which breaks as `no-phase` instead - a different break with a
different fix (assign the row a phase), which is why `unpicked` entries carry
no `phase` key at all.

## Migration: a project scaffolded before v1.4.0

A REQUIREMENTS.md still carrying the pre-v1.4.0 heading `## v1 Requirements`
has no `## Active` section by this grammar: `seed-reqs` reports
`no_active_section: true` and writes nothing until the heading is renamed to
`## Active`, and the report names that edit. The parser has no heading-alias
fallback.

Such a project gains NO `unpicked` break, at any row count: with no heading
there is no declared scope, and `parseActiveIds`' `null` is never coerced to
`[]`. Once the heading is renamed its `## Active` ids become scope, and the
ones with no row break.
