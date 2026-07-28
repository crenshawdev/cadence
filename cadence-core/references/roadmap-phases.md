# ROADMAP.md phase-list grammar

The stated grammar for the `## Phases` section of `.planning/ROADMAP.md`
(`templates/ROADMAP.md`). It answers one question - what counts as a
phase-shaped line - so that an empty section is a DERIVED closed-milestone
state rather than a parse failure, and so that a line which looks like a phase
but is not one is reported with its own diagnostic rather than guessed at in
either direction.

Two functions in `cadence-core/bin/lib/planning-files.mjs` implement it:
`parseRoadmapPhases` (the canonical entry, unchanged) and `classifyPhaseList`
(the classifier over the section). Every claim below is pinned by a row in the
`PHASE_LIST_ROWS` table in `cadence-core/bin/planning-files.test.mjs`.

## The canonical entry, unchanged

```markdown
- [ ] **Phase N: Name** - description
```

`- [ ]` open, `- [x]` complete; `N` may be decimal (a `2.1` insertion sorts
between 2 and 3); the description after the ` - ` is optional. This is
`PHASE_LINE`, and it is the ONLY shape that is a phase.

It is deliberately not widened. What this line matches is what `status`,
`audit`, `phase-done` and the cursor's `total` count as a phase, so making
five more shapes "real" would be a state-machine change wearing a parser fix's
clothes. `templates/ROADMAP.md` states the same contract to users: phase
status is the `## Phases` checkbox, and nothing else.

## Normalization

The classifier and `parseRoadmapPhases` both normalize first: one leading
`U+FEFF` byte-order mark stripped and every `\r\n` to `\n`. PARSE PATH ONLY -
`setPhaseBox` and `phase-done` still rewrite the raw bytes, so a CRLF
ROADMAP.md is never rewritten wholesale. A CRLF checkout therefore classifies
exactly as its plain-LF twin does.

**CRLF only - a lone `\r` is deliberately NOT normalized here**, which is why
this uses `normalizeCrlf` rather than the shared `normalize` (that one does
collapse lone CR, and is right for readers that never write back). The roadmap
write paths split the RAW bytes on `\n`, so a lone-CR file is one giant line to
all of them. CRLF survives that round trip because every roadmap write path
matches either without a `$` anchor (`setPhaseBox`, `cmdRenumber`'s list
filter) or under `/m`, where `$` matches before `\r` (`cutPhaseDetail`). Lone
CR has no such guarantee: making it parse once let `renumber remove` report
`ok:true` while leaving two `**Phase 1:**` lines and deleting both
`### Phase N:` detail sections. So a lone-CR roadmap stays unparseable, falls
out at `no-section`, and the caller refuses - the only safe answer for a
format these writers cannot reproduce.

## Two deliberate extents

| Extent | Bound | Used for |
|---|---|---|
| Canonical | `## Phases` heading to the next `## ` line | Parsing the phase entries (`parseRoadmapPhases`) |
| Classification | `## Phases` heading to END OF TEXT | Deciding whether an empty phase list is closed or broken |

The wider scan exists because the shipped template places `## Phase Details`
immediately after `## Phases`. Bounded at the next `## `, a roadmap whose
checkbox list was wiped while its `### Phase 1: ...` detail sections survived
would read as a cleanly closed milestone - the exact false close that reverted
the first attempt at this feature. A surviving detail section is the signature
of an INTERRUPTED prune, so the grammar reports it as one.

The two readers having different extents is intentional. Restoring
"consistency" between them re-opens the false close.

## The phase token

Near misses are detected on `/\bPhase (\d+(?:\.\d+)?)\b/` - capitalized
`Phase`, a space, a number. This is the same token `shiftPhaseTokens` and
`findProsePhaseRefs` already treat as THE phase reference in this codebase.

It keys on the number, not on bullet or checkbox decoration, and that is the
line separating a near miss from ordinary prose. `- [ ] decide scope` and a
sentence containing a bolded `**Phase` word carry no number, so neither is a
near miss. Lowercase `phase 1` is prose and stays prose. `## Phases` itself
never matches: the token needs `Phase` + space + digits, which `Phases` cannot
provide.

## The four states

| State | When | `status` does | `cursor set` does |
|---|---|---|---|
| `live` | One or more canonical entries in the canonical extent | Today's derivation: `current`, `total`, per-phase status | Derives `name` from the matching entry, `total` from the entry count |
| `closed` | No canonical entry AND no phase token anywhere below the heading | `ok:true` with `cycle:"none"` (see below) | Fills `no active cycle` / `0` for whichever of name/total was not passed |
| `out-of-grammar` | No canonical entry, but a phase token survives somewhere below the heading | `ok:false`, `reason:"unparseable-roadmap"`, `detail` naming the FIRST offending line, `issues` listing every one | Nothing: falls through to the prior cursor, then `cannot-derive` |
| `no-section` | No `## Phases` heading at all | `ok:false`, `reason:"unparseable-roadmap"`, detail "no `## Phases` section in ROADMAP.md" | Same as `out-of-grammar` |

`out-of-grammar` deliberately does NOT derive a closed cursor. A roadmap
holding unrecognized phase-shaped lines is broken, not closed, and writing
`of 0` there would erase a live cycle's total.

## Out of grammar

These shapes are NOT phases. Each is reported with its own code, at most one
per line, in line order, as `{line, code, text}` - `line` 1-indexed into the
normalized whole text, `text` the offending line trimmed and truncated to 120
characters with a trailing `...`, the same issue shape the plan-frontmatter
grammar uses. Every row is pinned by a test.

| Code | Example line | What the classifier does | Fix |
|---|---|---|---|
| `phase-bullet` | `- Phase 1: Ship auth`, `- ✓ Phase 1: Auth`, `- [ ] Phase 1: Auth`, `- [ ] **Phase 1 Auth**` | Reports the line; the phase list is out of grammar, never closed | Rewrite as the canonical entry - checkbox, bold span, colon after the number |
| `phase-heading` | `### Phase 1: Auth` (a detail section outliving its list line), `## Phase 12: Auth` | Same | Finish the prune (remove the detail section too), or restore the list line |
| `phase-ordered-item` | `1. Phase 1: Auth`, `1) Phase 1: Auth` | Same | Rewrite as the canonical entry |
| `phase-table-row` | `\| Phase 1 \| Auth \|` | Same | Rewrite as the canonical entry; ROADMAP has no phase table |
| `phase-prose-line` | `Phase 2 rolls to the next milestone.` | Same - the catch-all, so a shape outside the grammar gets a diagnostic rather than silence | Move the sentence out of the `## Phases` section, or lowercase the reference (`phase 2` is prose) |
| `phase-outside-section` | a byte-perfect `- [ ] **Phase 1: Auth** - desc` sitting under a LATER `## ` heading | Same - but the shape is already canonical, so the fault is the location, not the syntax | Move the entry up into `## Phases`; it is the right line under the wrong heading |

`phase-outside-section` is checked BEFORE the shape tests, because they cannot
tell it apart from `phase-bullet` - both are bullets. Without it the classifier
reports a canonical entry as `phase-bullet` and prescribes "rewrite as the
canonical entry", which is a no-op on a line that already is one, and the real
cause (the classification extent runs to end of text while the canonical extent
stops at the next `## `) is never named.

## The closed-milestone contract

A `closed` phase list is a real, derived state - the window between a
milestone close and the next cycle - not an error:

- `planning.mjs status` returns `ok:true` with an ADDITIVE `cycle: "none"`
  field. `current` stays `null` and `total` stays `0`, exactly as before. The
  field is present ONLY in this state, and it is what stops a caller branching
  on `current === null` alone from reading a closed milestone as "all phases
  complete" and routing back to `/cad-milestone`. The next action is
  `/cad-phase add`, the only workflow that appends a phase line to an existing
  roadmap.
- A surviving `phases/<N>/` directory is reported as drift kind `phase-dir`,
  computed in `cmdStatus` from the filesystem. The classifier itself never
  reads the filesystem, so the pair is accurate: the milestone IS closed AND
  the prune was interrupted. One orphan directory can never block the closed
  state.
- The cursor reads `Phase: <N> of 0 (no active cycle)`, which still satisfies
  the canonical 4-line shape (`references/conventions.md`) - the name group is
  non-empty. `cursor set` derives it with no `--name` or `--total` flags. No
  new lifecycle status exists for this state.
- A cursor whose `total` is not `0` against a zero-phase roadmap reports drift
  kind `cursor` regardless of agreement: after a tagged close deletes the
  phase directories, that stale `of <M>` is the only surviving evidence the
  close never finished.
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
nothing to agree with. The mapping is what keeps drift detection alive in the
one state where the cursor is the only surviving evidence - a blanket "closed
always agrees" would report an interrupted close as healthy.

## Not in this grammar

- A near miss BESIDE a real checkbox list is not reported. Once the canonical
  extent yields one entry, the list is `live` and the checkbox list is the
  phase set; the near-miss scan never runs.
- Lowercase `phase 1` is prose, not a token, everywhere in this grammar.
- The classifier never reads the filesystem. It is pure and total: no I/O, no
  throw. Everything the filesystem knows (surviving phase directories, plan
  files) is corroboration a caller adds beside the verdict.
- `renumber`'s own `unparseable-roadmap` is untouched: a zero-phase roadmap
  has nothing to renumber, and `/cad-phase add` appends without renumbering.
