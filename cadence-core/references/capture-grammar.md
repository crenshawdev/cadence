# CAPTURE.md bullet grammar

The stated grammar for `.planning/CAPTURE.md` - which sections the recall walk
visits, what counts as a bullet, and which leading parenthetical is a PHASE TAG
rather than content. It answers one question at each level, so a bullet that is
filed but never recalled is a stated out-of-grammar row rather than a silent
drop.

Three modules implement it. `cadence-core/bin/lib/capture-file.mjs` is the WRITE
side - the one owner of this file's bytes, and the reason no writer can name its
own heading. `parseCaptureSnippets` in `cadence-core/bin/lib/planning-files.mjs`
is the READ side, the walk that feeds the BM25 corpus behind
`planning.mjs recall`. `cadence-core/bin/lib/capture-health.mjs` is the HEALTH
reading behind `planning.mjs capture-check`: the same bullet definition, counted
without the `- None.` placeholder. Every claim below about the TAG is pinned by a row in
the `CAPTURE_TAG_ROWS` table in `cadence-core/bin/planning-files.test.mjs`;
every claim about where a written bullet LANDS is pinned by the per-kind rows
in `cadence-core/bin/capture-file.test.mjs`.

## The sections, and which three are walked

| Section | Walked | Written by |
|---|---|---|
| `## Todos` | yes | `/cad-capture --kind todo`, `/cad-execute`'s open items |
| `## Seeds` | yes | `/cad-capture --kind seed` |
| `## Notes` | yes | `/cad-capture --kind note` |
| `## Debt markers` | NO | `planning.mjs debt-harvest`, rewritten wholesale |
| any other `## ` heading | NO | nothing - a hand-added section |

The three walked headings are ONE fact with one home: the frozen list beside
`parseCaptureSnippets`. `capture-file.mjs` derives its kind-to-heading map from
that list rather than restating the names, because the writer and the reader
disagreeing about which sections are the walk is the defect this grammar exists
to close - five filed bullets were lost to exactly that disagreement.

**`## Debt markers` is outside the walk deliberately (D-03).** It is written
wholesale by `planning.mjs debt-harvest` from the markers in the source tree and
is not a queue: nothing files into it and nothing is resolved out of it, so
walking it would put generated text in front of every `/cad-plan`. A bullet
under it is invisible to recall BY DESIGN, and `/cad-health` names every
out-of-walk section with its bullet count on every run so the invisibility is
stated rather than discovered.

**`## Archive` is NOT part of this file (CAP-03).** A CAPTURE.md carrying that
heading is REPORTED by `planning.mjs capture-check`, neither walked nor ignored.
This file holds the phase IN FLIGHT, and moving a settled item to a heading in
the same document resolves nothing - the bytes stay exactly where they were,
and 185 bullets sat under that heading here proving it while five filed bullets
were lost under it outright.

**An item is resolved by REMOVAL** - filed on the tracker or dropped - never by
annotation and never by relocation within the file. That RULE has one home and
it is `cadence-core/references/triage-gate.md`, at the gate that declines to fix
a finding; a rule written down twice is the drift this grammar exists to
prevent. What belongs here is the grammar half: the two shapes that make an
annotation are `KEPT <date>` and `recorded not fixed`, `capture-check` returns
every walked bullet carrying one with its section and line, and `/cad-health`
prints them as issues.

## The bullet

```markdown
- [ ] (phase 2) the sentence
```

A column-0 `- `, an OPTIONAL checkbox in any state (`[ ]`, `[x]`, `[X]`), then
the text. Anything else on a line is not a bullet and is not indexed: an
indented continuation line, a `* ` bullet, a table row, prose. A capture's text
is therefore flattened to one line at the write seam - a second line would not
be a bullet, and the walk would drop it in silence.

A CHECKED bullet is still indexed, with a literal `[closed] ` prefix on its
text. A closed item carries the reasoning that produced the fix, which is the
prior evidence recall exists to surface; the prefix is what stops a planner
reading a shipped fix as live work.

## The leading phase tag

A tag is matched ANCHORED at the head of the text, after the checkbox strip.
There are four admitted shapes. An admitted tag emits a numeric `phase` field
and is stripped WHOLE - tag and trailing space - so a version token or a label
riding inside a tag leaves the indexed text.

| Shape | Example | Emits | Indexed text |
|---|---|---|---|
| `(phase N)` | `- [ ] (phase 2) wire recall` | `phase: 2` | `wire recall` |
| `(phase N.M)` | `- [ ] (phase 2.1) hotfix` | `phase: 2.1` | `hotfix` |
| `(vX.Y.Z phase N)` | `- [ ] (v3.2.0 phase 1) close it` | `phase: 1` | `close it` |
| `(phase N, label)` | `- [ ] (phase 3, docs) state it` | `phase: 3` | `state it` |
| `(vX.Y.Z phase N, label)` | `- [ ] (v3.2.0 phase 1, docs) name it` | `phase: 1` | `name it` |

`N` is an integer or a decimal `N.M` (a `2.1` insertion is a real phase number
everywhere in Cadence). The version prefix is a `v` and dot-separated digits.
The label is everything after the comma up to the closing paren.

Stripping the tag whole is a decision with a stated cost: 32 bullets tagged
`(vX.Y.Z phase N)` stop carrying their version as a BM25 term. The alternative -
strip the phase words, keep the remainder - synthesizes bullet text nobody wrote
and needs a second rule for the case where the remainder is empty. What those
32 bullets gain is a correct `phase` field, which is what recall renders and
what a planner filters on.

## Out of grammar

These leading parentheticals are NOT tags. Each emits no `phase` and keeps the
parenthetical, byte-identical, in the indexed text.

| Shape | Example | Why |
|---|---|---|
| a non-phase scope marker | `(cadence-wide)`, `(tooling)` | It is the bullet's only scope word - see below |
| a milestone rather than a phase | `(v3.2.0 close)` | A close is not a phase; there is no number to emit |
| capitalized | `(Phase 2)` | The tag is lowercase, the way `Phase 2` is the ROADMAP token and `phase 2` is prose |
| no number | `(phase)` | Nothing to emit; guessing a phase is worse than none |
| a non-numeric phase | `(phase two)` | Same |
| not at the head | `wire the path (phase 2) next` | Anchored: a mid-sentence parenthetical is prose |
| unclosed | `(phase 2 wire the path` | No closing paren, so no tag ends anywhere |

**A leading parenthetical that is not a tag is CONTENT (D-05).** The widening
is deliberately not a greedy `^\([^)]*\)` strip: 24 live bullets carry
`(cadence-wide)` or `(tooling)` as their ONLY scope marker, and
`parseCaptureSnippets` feeds BM25 directly, so a greedy strip would eat the one
word those bullets can be found by. A rule that reads the phase correctly while
eating content is the failure this row exists to catch, which is why every row
in the table asserts the emitted TEXT as well as the emitted phase.

## Not in this grammar

- Ordering, deduplication and triage of bullets. The queue is append-only at the
  seam, and what takes a bullet OUT of it is a removal made at the gate that
  settled the item (`references/triage-gate.md`), never a rewrite here.
- The `- None.` placeholder is an ordinary bullet to this walk, unlike
  `parseSummarySnippets`, which skips the template's own prose. It costs one
  low-scoring corpus entry per empty section and removing it is a separate
  change with its own blast radius. The SUBSTANTIVE count `capture-check`
  reports is a second, differently-defined number that excludes it, so a
  freshly created queue counts zero.
- BM25 scoring and ranking, which read the text this grammar produces and know
  nothing about tags.
