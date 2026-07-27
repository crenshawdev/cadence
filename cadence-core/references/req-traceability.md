# REQUIREMENTS.md traceability grammar

The stated grammar for the `## Active` and `## Traceability` sections of
`.planning/REQUIREMENTS.md` (`templates/REQUIREMENTS.md`). Read every shipped
form to exactly the ids and rows declared, the same discipline
`plan-frontmatter.md` states for a plan file's own frontmatter. The single
implementation is `parseActiveIds` / `insertReqRows` / `parseRequirements` /
`setReqStatus` in `cadence-core/bin/lib/planning-files.mjs`.

## `## Active`

The open milestone's committed scope - the requirement ids a `/cad-plan` run
is allowed to seed a row for. Bounded at the next `## ` heading, exactly like
every other section this file's parsers read.

The bullet form is `- **<ID>**: <one line>`, with an optional leading
checkbox (`- [ ] **<ID>**: ...` / `- [x] **<ID>**: ...`) tolerated. The id is
the bolded span's contents, trimmed. First occurrence wins; a repeated id
later in the section is ignored. **An unbolded bullet declares no id** - by
design, not an oversight: there is no fallback that guesses an id out of
unbolded prose, because the id list this seam reports back is exactly what
makes a mis-typed bullet visible instead of silently absorbed.

`parseActiveIds` returns `null` - never `[]` - when the `## Active` heading is
ABSENT, so a caller can tell "no milestone scope declared" from "declared,
nothing matched". A present-but-empty heading (the shipped template's
`**None.**` placeholder, or a real heading with zero bulleted ids yet) returns
`[]`. Both a bookkeeping seam and a diagnostic (`audit`'s `unseeded`, below)
must preserve this distinction; coercing `null` to `[]` silently misreports an
unopened milestone as one that was opened and never seeded.

## `## Traceability`

Live requirement -> phase -> plan -> verified trace for the open milestone.
Bounded the same way. Row form: `| <ID> | Phase <N> | <Status> |`, with
`Pending | Complete | Deferred` the only legal Status values. The `Phase N`
spelling (not a bare number) is mandatory: `shiftPhaseTokens` shifts only
`Phase K` tokens and `phases/K/` paths, and `renumber remove`'s
orphan-blanking regex tests `\bPhase ${at}\b` - a bare-number cell would
silently desync the table on the next phase insert or removal.

## Who writes what

- `/cad-plan` (the `seed-reqs` seam call) CREATES rows, and only ever at
  Status `Pending`. It is incapable of writing any other status - the seam
  has no parameter for it.
- `/cad-verify`'s `phase-done` is the only writer of any Status beyond
  `Pending` (`Complete`, and `Pending` again on `--undo`).
- `/cad-audit` reads this table and never writes it.

This is the invariant restated from row-existence to Status-transition: the
table's rows are no longer solely cad-verify's to create, but a non-`Pending`
Status is still solely cad-verify's to set.

## Seeding rules

`seed-reqs --phase <N>` collects the requirement ids every plan file under
`phases/<N>/` declares in its `requirements:` frontmatter (union,
first-occurrence-wins across the phase's plan(s)), then partitions them
against `## Active`:

- An id WITH an `## Active` bullet gets a row inserted at `| <id> | Phase <N>
  | Pending |`, unless a row for that id already exists (idempotent - a
  replan or a `--gaps` plan can never duplicate a row). An existing row whose
  Phase cell names a different phase is reported (`mismatched`) rather than
  silently accepted as a clean skip - a renumber or a moved requirement
  leaving the row pointing elsewhere is a real discrepancy.
- An id with NO `## Active` bullet gets no row and is reported under
  `orphan_ids` instead. This is deliberate (not a bug to "widen" the bound
  to cover): seeding every declared id unconditionally would make
  `orphans.plan_ids` (below) unreachable for seeded ids, silently deleting
  the audit's reverse-direction check that catches scope creep or a typo in
  a plan's `requirements:` list.
- When the `## Active` heading itself is absent, every id is reported under
  `orphan_ids` PLUS `no_active_section: true` - a different report from an
  ordinary orphan: the milestone's `## Active` section was never opened (an
  old-heading project, or a close that never seeded it), so these ids are not
  scope creep, and the fix is to open the section, not to edit the plan.

## The two additive `/cad-audit` diagnostics

Neither changes `counts` or the PASS/FAIL verdict - both are pure signal for
a human or `/cad-plan` to act on.

- `unseeded: { active_ids: [...] }` fires when the Traceability table has
  ZERO rows at all, naming the `## Active` ids that should have one. This is
  the diagnostic that closes the blind spot verified live twice
  (v1.2.0 and v1.3.1 closes): an empty table PASSes `counts.broken == 0`
  vacuously. `active_ids` preserves the `null`-vs-`[]` distinction from
  `parseActiveIds` above: `no_active_section: true` sits alongside it when the
  heading itself is absent, so "milestone never opened" is never collapsed
  into "declared but never seeded".
- `nonconforming_plans` fires when a phase directory holds a `PLAN*.md` file
  that is not `PLAN.md` or `PLAN-<N>.md` (e.g. a stray `PLAN-gaps.md`) - a
  filename no seam and no executor dispatch reads, so its requirements and
  files are silently invisible everywhere while the phase still reports
  success. `plan-overlap` emits the same field, bare filenames instead of
  `phases/<n>/<file>` paths.

## Migration: a project scaffolded before v1.4.0

A project whose REQUIREMENTS.md still carries the pre-v1.4.0 heading
`## v1 Requirements` has no `## Active` section by this grammar's reading:
`seed-reqs` reports `no_active_section: true` and writes nothing until the
heading is renamed to `## Active` - a one-line edit, and the report names it.
There is no heading-alias fallback in the parser; a second accepted spelling
is exactly the kind of accreted heuristic this cycle exists to remove.
