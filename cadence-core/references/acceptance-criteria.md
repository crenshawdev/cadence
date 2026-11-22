# CONTEXT.md acceptance-criteria grammar

The stated grammar for the `## Acceptance criteria` section of
`.planning/phases/<N>/CONTEXT.md`, written by `workflows/context.md`'s
`write_context` step. It answers what counts as a criterion and what its id is,
so that `/cad-audit` can prove a TOTAL function: every criterion a phase
declared reached that phase's UAT checklist.

One function in `cadence-core/bin/lib/planning-files.mjs` implements it:
`classifyAcceptanceCriteria(text)`, returning
`{criteria: Array<{id, text}>|null, issues: Issue[], declaresIds}`. Its only
consumer is `planning.mjs criteria-coverage`, whose contract is stated below.
Every claim here is pinned by a row in the `CRITERION_ROWS` or `DECLARES_ROWS`
table in `planning-files.test.mjs` (cadence-tests repository) - one `test()` per row.

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
`workflows/verify.md` keeps its own prose read of it.

## The continuation rule

An INDENTED, non-blank line while a criterion is open is a continuation: it is
appended to that criterion's `text` joined with one space, and never classified
on its own, so a wrapped criterion naming another id (`... unchanged, the same
shape AC3 pins`) stays silent. A blank line, or any non-indented line, closes
the open criterion.

The one exception is an indented bullet whose content begins with an `AC<N>`
token (a checkbox tolerated between): it reports `criterion-indented-bullet`
rather than being swallowed as prose.

## Normalization

The reader normalizes first: one leading `U+FEFF` byte-order mark stripped,
every `\r\n` AND every lone `\r` to `\n` - the shared `normalize`, not the
roadmap grammar's `normalizeCrlf`. CONTEXT.md has no writer anywhere in this
codebase, so a lone-CR CONTEXT.md classifies exactly as its plain-LF twin does.

## Extent

| Extent | Bound |
|---|---|
| Section | The `## Acceptance criteria` heading to the next `## ` line, or end of text |

One extent: there is no wider classification scan.

**Both the heading scan and the section walk are FENCE-AWARE**, through the
same scanner `parseUat`'s `sectionBound` uses. A fenced block inside the
section is skipped whole: it declares no criterion, reports no diagnostic, does
not bound the section, and does not close an open criterion. A `## ` line
inside a fence is content, and a `## Acceptance criteria` line inside one is
not the heading.

An ABSENT heading returns `{criteria: null, issues: []}` - the datum "nothing
declared", never an out-of-grammar report. `null` (not `[]`) is what lets a
caller tell "no criteria section" from "a section that declared nothing".

A NEAR-MISS heading is not absence. A line matching
`^#{1,6}\s*acceptance\s+criteri` case-insensitively, that is not the exact
heading - `## Acceptance Criteria`, `## Acceptance criteria:`, `### Acceptance
criteria` - returns `criteria: null` WITH a `criteria-heading-near-miss` issue
on that line, reported once for the first such line since the section is
singular. A typo drops everything declared out of the coverage domain, and the
items pointing at those ids would otherwise land only in the additive
`unknown_criterion`.

## Out of grammar

These shapes are NOT criteria (except `criterion-empty-text`, which is - see
its row). Each is reported with its own code, at most one per line, in line
order, as `{line, code, text}` - `line` 1-indexed into the normalized whole
text, `text` the offending line trimmed and truncated to 120 characters with a
trailing `...`, the same issue shape the other three grammars use.

| Code | Example line | What the classifier does | Fix |
|---|---|---|---|
| `criterion-unidded` | `- [ ] the tests pass` | Reports the line; the bullet declares no criterion. The CENTRAL diagnostic, the legacy shape. A bullet whose PROSE names an id (`- [ ] the AC3 pin still holds`) is this, not the row below: the head position is empty | Add the phase-local id: `- [ ] AC1: the tests pass` |
| `criterion-malformed-id` | `- [ ] **AC1**: the tests pass` | Reports the line; the head position holds an id the canonical head refused - a second space after the checkbox, emphasis around the token, a lowercase `ac`, a missing colon | Write the head exactly: one space after the checkbox, a bare uppercase `AC<N>`, then a colon |
| `criterion-duplicate-id` | a second `- [ ] AC3: ...` | Reports the line and does NOT push it: the id keeps first-occurrence-wins, so the second bullet is dropped from the coverage domain entirely. `/cad-audit` names this even though it moves no verdict | Renumber the second bullet to the next unused id |
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

**A refused id is still a DECLARED id.** Beside `criteria` and `issues` the
classifier reports `declaresIds`, because an empty `criteria` is three distinct
data: nothing declared, an id this grammar REFUSED, or a section it never read.
It is `'some'` when a criterion parsed OR a reported line carries an `AC<N>`
token in DECLARATION POSITION - the head of the line, after at most one list or
heading marker, an optional checkbox, and any emphasis or code wrapper around
the token. It is `'none'` when nothing does, an absent heading included, and
`'unknown'` for a near-miss heading, whose section is never walked. Which code a
line reports does not decide this; its head position does, drawing the same line
`criterion-malformed-id` draws - `- [ ] the AC3 pin still holds` mentions an id
rather than declaring one, while a backtick-wrapped token declares one this
grammar still reports as `criterion-unidded`. A criterion inside a fence
declares nothing, exactly as it is no criterion. The coverage contract's legacy
exemption is the only consumer, and it requires a provable `'none'`.

**The entry-shaped codes fire regardless of how many criteria parsed**, unlike
`classifyPhaseList`'s near-miss suppression and `active-prose-line`'s
conditional arm: one idded bullet beside six bare ones still reports the six.

## The coverage contract

`planning.mjs criteria-coverage` walks the same `parseRoadmapPhases` map
`audit` walks and, for each phase, reads `phases/<N>/CONTEXT.md` through this
reader and `phases/<N>/UAT.md` through `parseUat`. It is a separate subcommand
from `audit`, whose `counts` identity is pinned and whose `requirements[]`
`workflows/audit.md` filters by milestone id, which a criterion break carries
none of. `workflows/audit.md` folds both results into ONE verdict.

The link itself is a per-item `criterion: AC<N>` line in UAT.md, registered in
`UAT_FIELDS` so it survives `uat refresh` and every `uat record` rewrite, and
written by `workflows/verify.md`'s `uat init` / `uat refresh` payloads. An item
that legitimately derives from no criterion declares `origin:` instead.

| Key | Verdict | Meaning |
|---|---|---|
| `breaks` | BREAKING | Two shapes. `{phase, id, break: 'uncovered' \| 'missing-uat'}` - a declared criterion no item's `criterion` names, or one whose phase has no UAT.md at all. `{phase, break: 'fieldless-checklist', file}` - ONE per phase, naming the checklist to repair. The only verdict-moving key |
| `untraced` | additive | `{phase, item, name}` - an item with no `criterion` and no exempting `origin` |
| `legacy` | additive | `{phase, reason}` - a checklist that genuinely predates the fields, with the reason it was exempted stated |
| `unknown_criterion` | additive | `{phase, item, criterion}` - a `criterion` value naming no declared id |
| `context_issues` | additive | `{phase, issues}` - this reader's diagnostics |
| `counts` | - | `{criteria, covered, uncovered, untraced, phases}`, where `criteria === covered + uncovered` |

The two directions are ASYMMETRIC, matching the shipped `unpicked` /
`active_issues` split: a criterion with no item BREAKS, an item tracing to no
criterion REPORTS, since verifier gap items legitimately trace to none.

**The `origin` exemption values are `verifier` and `smoke`.** `origin:
criterion` exempts nothing: it names no id, so it proves nothing, and such an
item is still `untraced`. `origin` is WRITTEN, never derived - a present
`criterion` is itself the criterion-derived marker, so nothing fabricates a
second one.

**The legacy rule has five terms, and an absent marker is only one of them.** A
checklist is exempt when it has at least one item, its frontmatter carries no
`fields_version`, none of its items carries `criterion` or `origin`, AND its
phase's CONTEXT declares no `AC<N>` ids at all. Then it is reported in `legacy`
as `{phase, reason}` - the reason stated, never a bare phase number -
contributing no breaks, no `untraced` entries and nothing to `counts`, so an
existing project does not hard-fail on upgrade. Legacy is never inferred from
field absence alone: `uat init` writes `fields_version` unconditionally, before
it looks at a single item, so no file the seam produces presents as legacy.

Satisfy the first three terms but not the fourth and it is a
`fieldless-checklist` break instead. Both the AC-id grammar and `fields_version`
post-date `v1.5.0`, so a marker-less checklist beside declared ids is a DROPPED
LINK, not an old file.

**That last term is `declaresIds === 'none'`, never `criteria.length === 0`.**
`- [ ] AC1 the feature works`, `- [ ] **AC1**: x`, `- AC1: x`, `* [ ] AC1: x`,
`### AC1: x`, `1. AC1: x` and an indented criterion bullet each parse to ZERO
criteria while `context_issues` names the id in the SAME envelope; an id the
grammar refused is an id the author declared. `'unknown'` is not `'none'`
either: a near-miss heading (`## Acceptance Criteria`) reads as zero ids by
length alone and must not collect an exemption. Only a provable `'none'`
exempts; everything else takes the break arm. Whether the grammar should ADMIT
those shapes as criteria is a separate, deferred question.

The repair is per item, and it is `criterion`, not `origin`:

```
uat record --phase <N> --item <k> --result <its current status> --criterion AC<N>
```

`record` has no field-only mode, so the repair is a re-record at the status the
item already holds. `--origin criterion` is NOT a substitute: it names no id,
and on a fieldless checklist it disqualifies the phase from the legacy rule and
converts zero breaks into one per criterion with no seam able to add the link
back.

**Every run states the versions it ran as.** `version` is the first key of the
envelope and is always present - a statement about the run, not a finding.
`version.plugin` is read from `.claude-plugin/plugin.json` relative to the
SCRIPT's own location, and is `null` on any unreadable, malformed or
version-less manifest rather than a throw. `CADENCE_PLUGIN_MANIFEST` overrides
that path for hermetic tests only, and only alongside `CADENCE_TEST_SEAM=1`:
BOTH are required, and with the variable alone the override is ignored and the
shipped manifest is read silently. `version.uat_fields` is `UAT_FIELDS_VERSION`.
Both are stated because mid-cycle the manifest names the last RELEASED version,
while the capability number does not lag. A seam predating the fields has no
`criteria-coverage` subcommand and returns `ok:false, reason:"usage"`.

An EMPTY checklist is not legacy. An empty checklist is the drop itself, so
every criterion in that phase breaks.

**An absent CONTEXT.md is nothing to prove.** The phase contributes nothing at
all: no break, no `phases[]` entry. `workflows/milestone.md` runs this gate at
step 1 while the prune that DELETES phase directories, CONTEXT.md with them,
runs at step 3, so a prior milestone's phases are simply not on disk.

**An absent UAT.md, with CONTEXT.md present, is the total drop.** Every
declared criterion counts `uncovered`, and on a CHECKED box each one breaks as
`missing-uat`. The unchecked-box rule below applies unchanged, so a phase still
in flight is counted and never breaks.

**An unchecked roadmap box gates `uncovered` and `missing-uat`, and nothing
else.** For those two, a phase that has not reached verification yet contributes
its `uncovered` count and its `phases[]` entry and no `breaks` entry, so a gate
run mid-cycle does not FAIL on work still in flight. `fieldless-checklist` is
NOT box-gated and fires on an unchecked phase exactly as it does on a checked
one: `uat init` writes `fields_version` before it looks at an item, so no phase
passes through the fieldless state in flight, and finishing the work does not
repair it.

## Not in this grammar

- **The id is phase-local, not globally unique.** `AC1` in phase 2 and `AC1` in
  phase 5 are different criteria; every break, every link and every count is
  scoped to its phase. Nothing in Cadence resolves a bare `AC1` across phases.
- **`AC-01` is rejected as a spelling.** `REQ_ID_EXACT` in
  `lib/planning-files.mjs` admits it, so a criterion id pasted into a plan's
  `requirements:` frontmatter would mint a phantom `orphans.plan_ids` entry in
  `audit`. The bare `AC1` has no hyphen, so it never reads as a requirement id.
- **`/cad-phase` renumber is a NON-EVENT here.** Its computed edits are
  ROADMAP/REQUIREMENTS/STATE only, and `shiftPhaseTokens` matches just
  `Phase N` tokens and `phases/N/` paths; phase directories move whole via
  `gitMv` with their contents never rewritten, so an existing phase's CONTEXT
  ids stay byte-identical. Path-shaped and phase-prefixed ids (`P4-AC1`,
  `phases/4/CONTEXT.md#AC3`) are rejected because they go stale on the first
  insert.
- **The reader never reads the filesystem.** It is pure and total: no I/O, no
  throw. Coverage, absence and every count belong to `criteria-coverage`.
