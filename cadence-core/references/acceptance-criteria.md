# CONTEXT.md acceptance-criteria grammar

The stated grammar for the `## Acceptance criteria` section of
`.planning/phases/<N>/CONTEXT.md`, written by `workflows/context.md`'s
`write_context` step. It answers one question - what counts as a criterion, and
what is its id - so that `/cad-audit` can prove a TOTAL function: every
criterion a phase declared reached that phase's UAT checklist. Two of 122
criteria were silently dropped at checklist-build time in the cycle before this
grammar existed, and were recovered only because a second verify pass happened
to run.

One function in `cadence-core/bin/lib/planning-files.mjs` implements it:
`classifyAcceptanceCriteria(text)`, returning
`{criteria: Array<{id, text}>|null, issues: Issue[]}`. Its only consumer is
`planning.mjs criteria-coverage`, whose contract is stated below. Every claim
here is pinned by a row in the `CRITERION_ROWS` table in
`cadence-core/bin/planning-files.test.mjs` - one `test()` per row.

## The canonical criterion

```markdown
- [ ] AC1: pass/fail, observed behavior
```

A column-0 `-`, a checkbox (`- [ ]` open, `- [x]`/`- [X]` recorded), the bare
`AC<N>` token, a colon, then the text. The id is PHASE-LOCAL and numbered from
1 in presentation order. This is `CRITERION_HEAD`, and it is the only shape
that is a criterion.

Trailing prose stays in `text` verbatim, `(human-verify: needs <tool/service>)`
included: the classifier admits and ignores that suffix, and
`workflows/verify.md` keeps its own prose read of it. Promoting it to a declared
field is deliberately out of this grammar.

## The continuation rule

An INDENTED, non-blank line while a criterion is open is a continuation: it is
appended to that criterion's `text` joined with one space, and never classified
on its own. That is what keeps a wrapped criterion which happens to name
another id (`... unchanged, the same shape AC3 pins`) silent instead of
reporting. A blank line, or any non-indented line, closes the open criterion.

The one exception is an indented bullet whose content begins with an `AC<N>`
token (a checkbox tolerated between): that is a criterion the grammar cannot
see, so it reports `criterion-indented-bullet` rather than being swallowed as
prose.

## Normalization

The reader normalizes first: one leading `U+FEFF` byte-order mark stripped,
every `\r\n` AND every lone `\r` to `\n` - the shared `normalize`, not the
roadmap grammar's `normalizeCrlf`.

The difference is deliberate. `normalizeCrlf` exists because ROADMAP.md has
WRITE paths (`setPhaseBox`, `cutPhaseDetail`, `cmdRenumber`'s list filter) that
split the raw bytes on `\n`, so a lone-CR roadmap must stay unparseable or
those writers corrupt it. CONTEXT.md has no writer anywhere in this codebase:
no seam creates or edits one, `parseContextDecisions` and this function only
read. A pure reader can normalize fully, and a lone-CR CONTEXT.md therefore
classifies exactly as its plain-LF twin does.

## Extent

| Extent | Bound |
|---|---|
| Section | The `## Acceptance criteria` heading to the next `## ` line, or end of text |

One extent, not two. Unlike the roadmap grammar there is no wider
classification scan: CONTEXT.md has no template section that follows the
criteria and can outlive them, so there is no interrupted-prune state to
detect.

**Both the heading scan and the section walk are FENCE-AWARE**, through the
same scanner `parseUat`'s `sectionBound` uses. A fenced block inside the
section is skipped whole: it declares no criterion, reports no diagnostic, does
not bound the section, and does not close an open criterion. A `## ` line
inside a fence is content, and a `## Acceptance criteria` line inside one is
not the heading. Without this the illustrative `- [ ] AC1: ...` in this very
document parses as a live criterion, minting a phantom id no UAT item can
cover - a false FAIL out of a code block.

An ABSENT heading returns `{criteria: null, issues: []}` - the datum "nothing
declared", never an out-of-grammar report. CONTEXT.md is itself an optional
artifact, and `null` (not `[]`) is what lets a caller tell "no criteria section"
from "a section that declared nothing".

A NEAR-MISS heading is not absence. A line matching
`^#{1,6}\s*acceptance\s+criteri` case-insensitively, that is not the exact
heading - `## Acceptance Criteria`, `## Acceptance criteria:`, `### Acceptance
criteria` - returns `criteria: null` WITH a `criteria-heading-near-miss` issue
on that line, reported once for the first such line since the section is
singular. Absence means nothing was declared; a typo means everything declared
was dropped out of the coverage domain, and the items pointing at those ids land
in the additive `unknown_criterion` while the gate stays green. It is the
section-level twin of the in-section near-misses below and exists for the same
reason.

## Out of grammar

These shapes are NOT criteria (except `criterion-empty-text`, which is - see
its row). Each is reported with its own code, at most one per line, in line
order, as `{line, code, text}` - `line` 1-indexed into the normalized whole
text, `text` the offending line trimmed and truncated to 120 characters with a
trailing `...`, the same issue shape the other three grammars use.

| Code | Example line | What the classifier does | Fix |
|---|---|---|---|
| `criterion-unidded` | `- [ ] the tests pass` | Reports the line; the bullet declares no criterion. The CENTRAL diagnostic - the legacy shape every CONTEXT written before this grammar is in. A bullet whose PROSE names an id (`- [ ] the AC3 pin still holds`) is this, not the row below: the head position is empty | Add the phase-local id: `- [ ] AC1: the tests pass` |
| `criterion-malformed-id` | `- [ ] **AC1**: the tests pass` | Reports the line; the head position holds an id the canonical head refused - a second space after the checkbox, emphasis around the token, a lowercase `ac`, a missing colon. Split out of `criterion-unidded`, whose remedy ("add the id") is a no-op on a line whose id is right there | Write the head exactly: one space after the checkbox, a bare uppercase `AC<N>`, then a colon |
| `criterion-duplicate-id` | a second `- [ ] AC3: ...` | Reports the line and does NOT push it: the id keeps first-occurrence-wins, so the second bullet is dropped from the coverage domain entirely. `/cad-audit` names this even though it moves no verdict, because a dropped criterion with a green gate is the failure this grammar exists to prevent | Renumber the second bullet to the next unused id |
| `criterion-empty-text` | `- [ ] AC4:` | Reports the line AND pushes the criterion with `text: ''` - parse-then-diagnose, because the id is real and must still reach a UAT item | Write the criterion's text after the colon |
| `criterion-unboxed-bullet` | `- AC1: the tests pass` | Reports the line; no checkbox, so it is not a criterion | Add the checkbox |
| `criterion-nondash-bullet` | `* AC1: the tests pass` | Reports the line; legal GFM, but the grammar reads `-` only | Rewrite the marker as `-` |
| `criterion-indented-bullet` | `  - [ ] AC2: the linter is clean` | Reports the line; the grammar reads column-0 bullets only, and an indented one would otherwise be read as continuation prose of the criterion above | Move it to column 0 |
| `criterion-ordered-item` | `1. AC1: the tests pass` | Reports the line | Rewrite as a checkbox bullet |
| `criterion-heading` | `### AC1: the tests pass` | Reports the line | Rewrite as a checkbox bullet |
| `criterion-prose-line` | `AC7 is the only human-verify criterion.` | Reports the line - the catch-all, so any other line naming an `AC<N>` token gets a diagnostic rather than silence | Move the sentence below the section's last criterion into its own `## ` section, or drop the token |

A line naming no `AC<N>` token at all is ordinary section prose and is never
reported - except a column-0 checkbox bullet, which is always reported
whatever it carries: `criterion-malformed-id` when its head position holds an
id, `criterion-unidded` otherwise.

**The entry-shaped codes fire regardless of how many criteria parsed.** This is
deliberately unlike `classifyPhaseList`'s near-miss suppression and unlike
`active-prose-line`'s conditional arm: one idded bullet beside six bare ones is
exactly the mixed-authoring migration case this grammar exists to catch, and
suppressing the codes once anything parsed would hide it.

## The coverage contract

`planning.mjs criteria-coverage` walks the same `parseRoadmapPhases` map
`audit` walks and, for each phase, reads `phases/<N>/CONTEXT.md` through this
reader and `phases/<N>/UAT.md` through `parseUat`. It is a separate subcommand
from `audit` on purpose: `audit`'s `counts` identity is pinned, and
`workflows/audit.md` filters its `requirements[]` by milestone id, which a
criterion break carries none of. `workflows/audit.md` folds both results into
ONE verdict.

The link itself is a per-item `criterion: AC<N>` line in UAT.md, registered in
`UAT_FIELDS` so it survives `uat refresh` and every `uat record` rewrite, and
written by `workflows/verify.md`'s `uat init` / `uat refresh` payloads. An item
that legitimately derives from no criterion declares `origin:` instead.

| Key | Verdict | Meaning |
|---|---|---|
| `breaks` | BREAKING | `{phase, id, break: 'uncovered' \| 'missing-uat'}` - a declared criterion no item's `criterion` names, or one whose phase has no UAT.md at all. The only verdict-moving key |
| `untraced` | additive | `{phase, item, name}` - an item with no `criterion` and no exempting `origin` |
| `legacy` | additive | phase numbers whose checklist predates the field |
| `unknown_criterion` | additive | `{phase, item, criterion}` - a `criterion` value naming no declared id |
| `context_issues` | additive | `{phase, issues}` - this reader's diagnostics |
| `counts` | - | `{criteria, covered, uncovered, untraced, phases}`, where `criteria === covered + uncovered` |

The two directions are ASYMMETRIC, matching the shipped `unpicked` /
`active_issues` split: a criterion with no item BREAKS, an item tracing to no
criterion REPORTS. Four of four phases in the cycle that built this appended
legitimate verifier gap items, so making the reverse direction breaking would
make the gate unpassable.

**The `origin` exemption values are `verifier` and `smoke`.** `origin:
criterion` exempts nothing: it names no id, so it proves nothing, and such an
item is still `untraced`. `origin` is WRITTEN, never derived - a present
`criterion` is itself the criterion-derived marker, so nothing fabricates a
second one.

**The legacy rule tests for an absent `fields_version` frontmatter marker.** A
checklist with at least one item, whose frontmatter carries no
`fields_version` and none of whose items carries `criterion` or `origin`, is a
pre-field checklist: reported in `legacy`, contributing no breaks, no
`untraced` entries and nothing to `counts`, so an existing project does not
hard-fail on upgrade.

The marker is what makes the rule sound, and it replaced an unsound one. The
original test was the two item fields alone - no `criterion` AND no `origin` -
on the stated premise that every post-field checklist carries at least one
`origin`. That premise was false the day it shipped: `.planning/phases/3/UAT.md`
is a post-field checklist with seven `criterion` lines and zero `origin` lines,
so a `/cad-verify` that silently stopped emitting `criterion` on a
phase-3-shaped checklist read as an old project and the gate stayed green
forever - precisely the regression this check exists to catch. `uat init`
writes `fields_version` unconditionally, before it looks at a single item, so
no file this seam produces can present as legacy however few links it carries.
Infer legacy from field absence again and the exemption absolves the drop.

An EMPTY checklist is not legacy. An empty checklist is the drop itself, so
every criterion in that phase breaks.

**An absent CONTEXT.md is nothing to prove.** The phase contributes nothing at
all: no break, no `phases[]` entry. `workflows/milestone.md` runs this gate at
step 1 while the prune that DELETES phase directories runs at step 3, so a
prior milestone's phases are simply not on disk, and treating that as a break
would make `/cad-milestone`'s own gate unpassable. The prune removes the whole
directory, so it always takes CONTEXT.md with it - which is why absence of
CONTEXT is the exemption and absence of UAT is not.

**An absent UAT.md, with CONTEXT.md present, is the total drop.** A phase that
declared criteria and never got a checklist is exactly what this gate exists to
catch, and exempting it left the one load-bearing direction with an unnamed
hole. Every declared criterion counts `uncovered`, and on a CHECKED box each one
breaks as `missing-uat`. The unchecked-box rule below applies unchanged, so a
phase still in flight is counted and never breaks.

**An unchecked roadmap box counts but never breaks.** A phase that has not
reached verification yet contributes its `uncovered` count and its `phases[]`
entry, and no `breaks` entry, so a gate run mid-cycle does not FAIL on work
still in flight.

## Not in this grammar

- **The id is phase-local, not globally unique.** `AC1` in phase 2 and `AC1` in
  phase 5 are different criteria; every break, every link and every count is
  scoped to its phase. Nothing in Cadence resolves a bare `AC1` across phases.
- **`AC-01` is rejected as a spelling.** It is admitted by `REQ_ID_EXACT`
  (`lib/planning-files.mjs:275`), so a criterion id pasted into a plan's
  `requirements:` frontmatter would read as a requirement id and mint a phantom
  `orphans.plan_ids` entry in `audit` - fabricated breaks in the very gate this
  grammar strengthens. The bare `AC1` is structurally disjoint from the
  requirement-id vocabulary, which requires a hyphen.
- **`/cad-phase` renumber is a NON-EVENT here.** Its computed edits are
  ROADMAP/REQUIREMENTS/STATE only, and `shiftPhaseTokens` matches just
  `Phase N` tokens and `phases/N/` paths; phase directories move whole via
  `gitMv` with their contents never rewritten. So an insert or a remove leaves
  an existing phase's CONTEXT ids byte-identical, and the only way to fail the
  renumber tests that pin this is for an id to embed the phase number - which is
  why path-shaped and phase-prefixed ids (`P4-AC1`,
  `phases/4/CONTEXT.md#AC3`) are rejected: they go stale on the first insert,
  because the directory moved and the file body did not. An id that renumbers
  under the user is worse than no id at all.
- **The reader never reads the filesystem.** It is pure and total: no I/O, no
  throw. Coverage, absence and every count belong to `criteria-coverage`.

## Rebuilding the demonstration fixture

The `/cad-audit` demonstration is a disposable pair of `.planning` trees:

- `/tmp/cadence-phase5-fixture/fail/.planning` - `/cad-audit` must FAIL, naming
  `AC4` and `AC5` by id with a next action for each.
- `/tmp/cadence-phase5-fixture/pass/.planning` - `/cad-audit` must PASS.

`/tmp` is reaped, so the recipe rather than the tree is what ships here. Both
trees are synthesized from this repo's own phase-1 pair - real prose, a
synthetic defect:

1. `mkdir -p /tmp/cadence-phase5-fixture/{fail,pass}/.planning/phases/1`.
2. Copy `.planning/phases/1/CONTEXT.md` (criteria `AC1`-`AC7`) and
   `.planning/phases/1/UAT.md` into each tree's `phases/1/`. That checklist
   already carries `criterion: AC1` through `AC7` on items 1-7 and
   `origin: verifier` on items 8-14.
3. In the `fail` tree ONLY, delete the whole `### 4.` and `### 5.` item blocks -
   the two carrying `criterion: AC4` and `criterion: AC5` - and set the
   `## Summary` `total:` and `passed:` to 12. The `pass` tree keeps all 14.
4. In BOTH trees write a ROADMAP.md whose `## Phases` holds one CHECKED
   `- [x] **Phase 1: Rungs**` entry with a matching `### Phase 1: Rungs` detail
   section, a REQUIREMENTS.md whose `## Active` bullet and `## Traceability` row
   both name `RNG-01` at Status `Complete`, and `phases/1/PLAN.md` whose
   frontmatter declares `requirements:\n  - RNG-01`.

Step 4's PLAN.md is not optional. `audit` builds its requirement -> plan map
solely from the phase's plan files, so a tree with no PLAN.md returns
`break: "no-plan"` for every row: the `pass` tree would FAIL on the requirement
arm, and the `fail` tree's FAIL would not be attributable to coverage at all.
Confirm `node cadence-core/bin/planning.mjs audit --dir <tree>/.planning`
reports `counts.broken: 0` for BOTH trees before the human check is worth
running, so the only difference between them is the coverage arm.

Then the two seam calls, which are what the human check reads through
`/cad-audit`: `criteria-coverage --dir .../fail/.planning` prints `breaks` with
exactly `AC4` and `AC5`, and the same call against `.../pass/.planning` prints
no `breaks` at all.
