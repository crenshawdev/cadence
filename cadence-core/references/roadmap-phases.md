# ROADMAP.md phase-list grammar

The stated grammar for the `## Phases` section of `.planning/ROADMAP.md`
(`templates/ROADMAP.md`). It answers what counts as a phase-shaped line: an
empty section is a DERIVED closed milestone rather than a parse failure, and a
line that looks like a phase but is not one is reported with its own
diagnostic, never guessed at in either direction.

In a project with a state file the list is generated from it: `phase-entry
add|edit`, `renumber`, `phase-done` and `milestone-prune` change it, and a
hand-written line is overwritten on the next state write. The grammar below is
the line the renderer writes and the importer reads.

## The canonical entry

```markdown
- [ ] **Phase N: Name** - description
```

`- [ ]` open, `- [x]` complete; `N` may be decimal (a `2.1` insertion sorts
between 2 and 3); the description after the ` - ` is optional. This is
`PHASE_LINE` in `cadence-core/bin/lib/planning-files.mjs`, and it is the ONLY
shape that is a phase. It is deliberately not widened: what it matches is what
`status`, `audit`, `phase-done` and the cursor's `total` count as a phase.

## Reading the list

Entries are read from the `## Phases` heading to the next `## ` line, the
canonical extent. With none there, the check for a surviving phase token runs
from the heading to the END OF TEXT. A phase token is a capitalized `Phase`, a
space and a number (`Phase 2`, `Phase 2.1`); lowercase `phase 1` is prose. A
near miss BESIDE a real entry is not reported: one canonical entry makes the
list `live`. One leading byte-order mark is dropped and CRLF read as LF, on the
parse only; a lone-CR file is unparseable (`no-section`).

## The phase directory

`.planning/phases/<N>/`, where `<N>` is the bare integer of a phase from
ROADMAP.md or an `N.M` sub-phase insertion (`phases/1/`, `phases/2/`,
`phases/2.1/`) - no zero-padding on either part, no slug suffix - created
lazily by the first skill that needs it (cad-context or cad-plan). That is the WHOLE grammar: Cadence
resolves no other spelling, ships no second legal form, and migrates nothing.

`2.0` is NOT a legal spelling of phase 2: the fraction is the sub-phase ORDINAL,
and there is no sub-phase zero. The same no-padding rule makes `1.01` a padded
spelling of `1.1` rather than a directory of its own, while `1.10` is legal:
sub-phase ten, whose `phases/1.10/` every command can address.

The guarantee is that no spelling is ever silently redirected to a DIFFERENT
phase's directory. Every seam builds its path from the string the caller typed,
so `--phase 08` addresses `phases/08` literally, reading it when it exists and
reporting a not-found naming it when it does not. Where the caller's spelling
would normalize onto a phase directory that ALSO exists on that tree, the
command refuses `bad-args` and names both fixes - retype the flag, or rename
the directory - rather than picking one. `cursor set` and `seed-reqs`, which
WRITE a phase identity, refuse a lossy spelling whatever is on disk.

A directory outside the grammar is unsupported and REPORTED, never migrated:
`planning.mjs status` returns it as a `phase-dir-grammar` drift entry naming
the legal directory it collides with, `/cad-health` reports every such entry as
an issue, and renaming it is the user's call, never an auto-fix.

Two names that are both LEGAL can still parse to one number: `Number` maps
`1.1` and `1.10` onto the same value. Neither is preferable and neither is
refusable, so `status` reports the pair as `phase-dir-collision` drift, its own
kind. A `phase-dir` entry carries the directory NAME in `dir` beside the parsed
`phase`, and a `recall` result carries it in `source`: that says which of the
two a record describes.

## The four states

In a project that has a state file, `status` answers from the state: it
refuses only a missing `## Phases` heading and does not classify the lines
under it. The four states are what the importer reports when an unstamped
project is converted or `state-rebuild` rebuilds a state file:

| State | When | The import does |
|---|---|---|
| `live` | One or more canonical entries in the canonical extent | Reads each entry into the state's phases |
| `closed` | No canonical entry AND no phase token anywhere below the heading | An empty phase list with no cycle open; `status` then answers `cycle:"none"` (see below) |
| `out-of-grammar` | No canonical entry, but a phase token survives somewhere below the heading | Refuses `unparseable-roadmap`, `detail` naming the FIRST offending line, `issues` listing every one |
| `no-section` | No `## Phases` heading at all | Refuses `unparseable-roadmap`, detail "no `## Phases` section in ROADMAP.md" |

`out-of-grammar` deliberately does NOT import as closed: it is broken, and an
empty phase list there would erase a live cycle.

## Out of grammar

These codes are the importer's. Where a state file exists there is nothing to
repair: the next state write regenerates the list from the state. Where the
conversion or the rebuild refused the roadmap, the list is still the input,
and the Fix column says how to repair its line by hand.

These shapes are NOT phases. Each is reported with its own code, at most one
per line, in line order, as `{line, code, text}` - `line` 1-indexed into the
normalized whole text, `text` the offending line trimmed and truncated to 120
characters with a trailing `...`, the same issue shape the plan-frontmatter
grammar uses.

| Code | Example line | What the importer does | Fix |
|---|---|---|---|
| `phase-bullet` | `- Phase 1: Ship auth`, `- ✓ Phase 1: Auth`, `- [ ] Phase 1: Auth`, `- [ ] **Phase 1 Auth**` | Reports the line; the phase list is out of grammar, never closed | In a roadmap the conversion or the rebuild refused: Rewrite as the canonical entry - checkbox, bold span, colon after the number |
| `phase-heading` | `### Phase 1: Auth` (a detail section outliving its list line), `## Phase 12: Auth` | Same | Finish the prune (remove the detail section too), or, in a roadmap the conversion or the rebuild refused, restore the list line |
| `phase-ordered-item` | `1. Phase 1: Auth`, `1) Phase 1: Auth` | Same | In a roadmap the conversion or the rebuild refused: Rewrite as the canonical entry |
| `phase-table-row` | `\| Phase 1 \| Auth \|` | Same | In a roadmap the conversion or the rebuild refused: Rewrite as the canonical entry; ROADMAP has no phase table |
| `phase-prose-line` | `Phase 2 rolls to the next milestone.` | Same - the catch-all, so a shape outside the grammar gets a diagnostic rather than silence | Move the sentence out of the `## Phases` section, or lowercase the reference (`phase 2` is prose) |
| `phase-outside-section` | a byte-perfect `- [ ] **Phase 1: Auth** - desc` sitting under a LATER `## ` heading | Same - but the shape is already canonical, so the fault is the location, not the syntax | Move the entry up into `## Phases`; it is the right line under the wrong heading |

## The closed-milestone contract

A `closed` phase list is a real, derived state - the window between a
milestone close and the next cycle - not an error:

- `planning.mjs status` returns `ok:true` with an ADDITIVE `cycle: "none"`
  field. `current` stays `null` and `total` stays `0`. The field is
  present ONLY in this state, and it is what stops a caller branching on
  `current === null` alone from reading a closed milestone as "all phases
  complete" and routing back to `/cad-milestone`. The next action is
  `/cad-phase add`, which enters a phase through `phase-entry add`.
- A surviving `phases/<N>/` directory is reported as drift kind `phase-dir`,
  computed from the filesystem, which deciding `closed` never reads, so the pair
  is accurate: the milestone IS closed AND the prune was interrupted. One
  orphan directory can never block the closed state.
- `STATE.md` says in words that no cycle is open and keeps `Next:` and
  `Updated:`, with no `Phase:` line (`references/conventions.md`). The same
  `cursor set` call writes it. No new lifecycle status exists for this state.
- Cursor agreement against an empty phase list:

| Cursor status | Agrees | Why |
|---|---|---|
| `phase complete` | yes | The close's own terminal status |
| `ready to plan` | yes | The between-milestones status the close writes |
| `paused` | yes | Legal at any point, its existing carve-out |
| `planned` | no | There is no phase to have planned |
| `executed` | no | There is no phase to have executed |
| `context gathered` | no | There is no phase to have gathered context for |

The phase NUMBER is not compared in this state: a zero-phase roadmap gives it
nothing to agree with. The status still is: a blanket "closed always agrees"
would report an interrupted close as healthy.
