# Phase 3: planning-files parser robustness - Context

Gathered: 2026-07-26
Feeds: /cad-plan 3

## Scope boundary

In: The shared `.planning` parsers stop minting phantom rows, stop silently
truncating or mis-indexing recall input, and stop under-reading valid markdown /
YAML. Four filed bugs, ten fix-cases across `cadence-core/bin/lib/planning-files.mjs`
and `cadence-core/bin/planning.mjs`: #41.1 (colon-aligned table separators become
a phantom no-phase requirement, flipping `/cad-audit` to a false FAIL - the
medium, and the only case gating a ship) and #41.2 (unbounded `## Traceability`
section); #46.1 (`parseUat`'s `/m` item-head match mints a phantom statusless item
from any numbered line in a non-item `### ` chunk, which the next `writeUat` then
materializes), #46.2 (`uat merge` appends a `k`-less/`name`-less gap as
`### N. undefined`), #46.3 (`uat merge` silently drops findings for non-pending
items); #47.1 (`parseCaptureSnippets` strips only `[ ]`, so a checked capture keeps
the `[x]` prefix and loses its phase attribution), #47.2 (unquoted multi-word
recall query uses only the first word); #48.1 (inline-only `requirements:`/`files:`
match reads a block YAML list as zero), #48.2 (`cutPhaseDetail` misses a name-less
`### Phase N:` heading). Each fix carries a failing-capable regression test
(FIX-01). Two consequential edits ride along: retiring `REQUIREMENTS.md`'s
now-false "must remain the last in the file" note (D-09), and the
`verify-deep.md` summary line plus its zero-headroom `weight-budgets.json` entry
(D-13).
Out: No `warnings[]` channel on `planning.mjs` (D-14) - phase-1 D-01's convention
covers a file that fails to PARSE, and every case here is an under-read or
phantom read of a file that parsed. No relaxation of the `PHASE_LINE` /
`setPhaseBox` / `renumber` list-line grammar (D-08) - that would change what
counts as a phase for `status`, `audit`, `phase-done` and the cursor's `total`.
No general YAML subset (D-07). No addition to the recall result shape (D-05). No
new `planning-files.test.mjs` (D-15). No change to `init`/`refresh` payload
validation. Phase 4's issues (#37, #49, #50) and the already-closed #35 are not
this phase. No new features.
Deferred: None
Plan shape: one plan

## Durable decisions

- D-01 (Traceability separator, #41.1): the separator skip WIDENS to "a cell made
  only of dashes, colons and spaces" rather than being replaced by a positive
  requirement-id whitelist, so a genuinely malformed id still reaches audit as a
  `no-phase` break instead of being silently dropped. A GFM delimiter cell is one
  or more `-` optionally wrapped in `:`, so the widened blacklist is a strict
  superset of every legal spelling. Chosen over a `/^[A-Z]{2,}-\d+|#\d+/` whitelist,
  which would drop the real rows this project writes - live ids read
  `TRI-01 (collect every open bug issue...)` and plan-side ids are `#39` - making
  `/cad-audit` report `total: 0` on a populated table and the pre-ship gate pass
  vacuously, a worse failure than the phantom row being fixed. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:90,76-80`, `.planning/REQUIREMENTS.md:12-16`,
  `.planning/phases/1/PLAN.md:4`, `cadence-core/bin/planning.mjs:453`.
- D-02 (UAT file ownership, #46.1): the fix anchors the item head to the FIRST
  line of each `### ` chunk AND round-trips unrecognized `### ` sections verbatim
  through `renderUat`, so both halves of the symptom close - no phantom statusless
  item, and the hand-written notes that exposed it survive the next `uat record`.
  This makes UAT.md partly user-owned where it was strictly machine-owned; the
  template's "items are append-only" rule covers items, not hand-added sections.
  Chosen over anchor-only (leaves the data loss that made the phantom visible) and
  anchor-plus-warning (needs a warning channel `planning.mjs` does not have, and
  still destroys the notes). Evidence:
  `cadence-core/bin/lib/planning-files.mjs:266-278,290-308`,
  `cadence-core/bin/planning.mjs:284-287`, `cadence-core/templates/UAT.md:60-63`.
- D-03 (merge is partial-success, #46.2): `uat merge` SKIPS an unusable entry,
  merges the rest, and reports a rejected count - deliberately diverging from
  `init`/`refresh`, which reject a whole payload on one bad element. Keeps
  verify-deep's "the deep pass is an accelerator, never a gate" true; the strict
  form would discard a twenty-good-findings pass over one nameless gap. A future
  reader should not "fix" this inconsistency. Evidence:
  `cadence-core/bin/planning.mjs:301-303,362-364,402`,
  `cadence-core/workflows/verify-deep.md:9-11`.
- D-04 (completed captures stay indexed, #47.1): the fix strips any checkbox state
  (`[ ]`, `[x]`, `[X]`) and THEN extracts `(phase N)`, keeping closed captures in
  the recall corpus rather than excluding them as finished work. CAPTURE.md's eight
  `[x]` items each end `- closed by <hash>` and carry the reasoning that produced
  the fix; three of the seven snippets recalled for this very pass were `[x]`
  items and all three were load-bearing. Chosen over skipping `[x]` items (removes
  every closed-bug post-mortem from recall, shrinking the index under a goal that
  asked to clean it) and over de-weighting them (ranking change, not a bug fix).
  Evidence: `cadence-core/bin/lib/planning-files.mjs:206,209`,
  `.planning/CAPTURE.md:8-14,18`.
- D-05 (closed signal rides the string, #47.1): a closed capture keeps a closed
  MARKER in the emitted snippet; the recall result shape does not grow a
  `done`/`closed` field. The `[x]` prefix is today's accidental closed-marker, and
  stripping it with nothing in its place lets a planner treat a shipped fix as live
  prior evidence - the failure mode is re-planning closed work. Chosen over adding
  `done: true` (cleaner data model, but a schema addition plus edits to the
  cad-context / cad-plan / cad-debug render lines and their weight budgets, in a
  cycle whose roadmap says no new features). Evidence:
  `cadence-core/bin/planning.mjs:566-570,578-586`,
  `cadence-core/workflows/context.md:115`, `cadence-core/workflows/plan.md:125`,
  `cadence-core/workflows/debug.md:86`, `cadence-core/bin/weight-budgets.json`.
- D-06 (frontmatter is bounded, #48.1): the `requirements:`/`files:` key lookup is
  bounded to the leading `---`-fenced frontmatter block, and only then accepts the
  inline `[...]` form OR a block list. The other parsers in this file scan the whole
  body, so this one reads as inconsistent without the reason: an unbounded key scan
  plus a permissive block reader lets a prose `requirements:` line in the plan body
  swallow the following bullets as ids, surfacing as fabricated `orphans.plan_ids`
  in `/cad-audit` - trading the filed under-read for an over-read. Chosen over
  keeping today's whole-text `/m` scan (minimal diff, that risk) and over
  inline-only (leaves the goal's "read block-YAML lists" unmet). Evidence:
  `cadence-core/bin/lib/planning-files.mjs:331,350,344-356`,
  `cadence-core/templates/PLAN.md:1-6`, `cadence-core/bin/planning.mjs:441,500`.
- D-07 (one shared reader, minimal grammar, #48.1): ONE shared list reader in
  `planning-files.mjs` serves both `parsePlanRequirements` and `parsePlanFiles`
  (two copies of the same inline-only pattern today), and its grammar stays
  minimal - the key line, then contiguous `- item` lines, terminating at the first
  non-`- ` line, with a trailing ` # comment` stripped. No nesting, no
  flow-in-block, no comment-only lines. The comment strip is not optional:
  `templates/PLAN.md:3` itself writes `plan: 1              # only meaningful
  when...`. Chosen over two independent regex additions (they would drift, so the
  audit accepts a plan shape the parallel-safety overlap check rejects, breaking
  the single-grammar invariant in the file that declares it) and over a real YAML
  subset (zero-dep constraint). Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1-6,331,350`,
  `cadence-core/templates/PLAN.md:3`, `.planning/phases/2/CONTEXT.md:26-42` (D-01
  shared-helper shape).
- D-08 (heading tolerance is scoped, #48.2): the name-less heading tolerance
  applies to `cutPhaseDetail` ONLY; `PHASE_LINE`, `setPhaseBox` and the `renumber
  remove` list-line filter keep requiring a name. Unifying every `Phase N:`
  matcher "for consistency" is the tempting move and it is wrong: it would change
  what counts as a phase for `status`, `audit`, `phase-done` and the cursor's
  `total` - a state-machine change smuggled into a parser fix. Scoping narrowly
  leaves a bare `### Phase N:` uncut only in a tree whose list line already carries
  a name, which is exactly the filed case. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:408,52,114`,
  `cadence-core/bin/planning.mjs:622,640-641`.

## Decisions

- D-09 (Traceability bound + its stale note, #41.2): the section is bounded at the
  next `^## ` heading using the idiom already in this file, and
  `REQUIREMENTS.md`'s "This section must remain the last in the file" note is
  retired in the same change - bounding the section is what makes the note false,
  and the shipped template never carried the constraint. The reader and the writer
  of this one table currently disagree on its extent. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:83,61-63,161-165,134-137`,
  `.planning/REQUIREMENTS.md:72-73`, `cadence-core/templates/REQUIREMENTS.md:44-48`.
- D-10 (guard the class, not the filed input, #46.2): the merge guard is stated as
  "every appended item must resolve to a usable name", which covers `human_checks`
  as well as `gaps` and covers a `k` that matches no existing item - not merely
  "the entry carries a `k` or a `name`". `human_checks` appends the identical
  phantom at status `pending`, which blocks completion just as permanently. Filed
  narrowly; widened per phase 2's `--total -2` lesson (guard the shape the consumer
  accepts, not the reported input). Evidence:
  `cadence-core/bin/planning.mjs:366-367,388-394,396-401`,
  `cadence-core/bin/lib/planning-files.mjs:316-320`, `.planning/phases/2/UAT.md`.
- D-11 (skip surfacing shape, #46.3): the non-pending drop surfaces as additive
  SCALAR counts on the merge envelope, alongside the existing `auto_passed` /
  `gaps` / `added`, not as a per-item conflict list. Matches the envelope's
  always-present-even-at-zero convention and D-03's rejected count. The trade-off
  accepted: `skipped: 3` says three findings conflict without saying which items -
  a `conflicts:[{k, status}]` array (omitted when empty) stays available as a later
  additive change. Evidence: `cadence-core/bin/planning.mjs:403,369-377,379-387,9-14`,
  `cadence-core/bin/planning.test.mjs:669-686`.
- D-12 (query joins, does not reject, #47.2): an unquoted multi-word recall query
  joins its positional words into the search string, and the dispatch handler's
  signature widens to carry the word list rather than special-casing `recall`.
  `tokenize` splits on non-alphanumerics, so the join separator is immaterial.
  Chosen over `bad-args` on extra positional words, which turns a today-degraded
  call into a hard failure for interactive users while every workflow caller
  already quotes. Evidence: `cadence-core/bin/planning.mjs:752,726-739,741-754`,
  `cadence-core/bin/lib/bm25.mjs:24-29`.
- D-13 (the doc edit is part of the fix, #46.3): the new merge counts mean editing
  `verify-deep.md`'s summary line and bumping its `weight-budgets.json` entry in
  the same change. The budget is 1955 bytes, which equals that file's current size
  exactly - zero headroom - and `self-verify.mjs` fails `budget-overrun` on any
  excess, so omitting the bump breaks CI. Evidence:
  `cadence-core/workflows/verify-deep.md:34-40`, `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:274-278`.
- D-14 (no warnings channel here): no `warnings[]` array is introduced on
  `planning.mjs`. Phase-1 D-01's convention covers a file that fails to PARSE;
  all ten cases here are under-reads or phantom reads of a file that parsed
  cleanly, and D-02 removed the one place a warning was proposed. Evidence:
  `.planning/phases/1/CONTEXT.md:25-33`, `cadence-core/bin/lib/config-merge.mjs:97-123`,
  `cadence-core/bin/review-provider.mjs:603-609`, `cadence-core/bin/planning.mjs:44-46`.
- D-15 (tests are seam-level): the regression tests land in `planning.test.mjs`,
  driving `audit` / `uat` / `recall` / `plan-overlap` / `renumber`, with raw-file
  fixtures written after `makeTree` for the shapes the builder cannot express (it
  hardcodes `|---|---|---|`). No new `planning-files.test.mjs`: a parser-only unit
  test would pass while the phantom row never reaches `cmdAudit`'s `counts.broken`,
  which is the observable the phase goal names. The recall runner passes the query
  as a single argv element and needs a variant to express #47.2 at all. Existing
  tests that assert a behavior being fixed are rewritten, not supplemented (phase-1
  D-05). Evidence: `cadence-core/bin/planning.test.mjs:1-3,110-115,922-934,978-987,1023-1033`,
  `cadence-core/bin/bm25.test.mjs:1-5`, `cadence-core/bin/require-int.test.mjs:1-5`.

## Acceptance criteria

- [ ] `planning.mjs audit` against a REQUIREMENTS.md whose Traceability table uses
      colon-aligned separators (`|:---|:--:|---:|`) returns the same `counts` as the
      byte-equivalent plain-dash table and reports no requirement whose id is made
      of dashes and colons; with a table-bearing `## ` section appended after
      `## Traceability`, none of that section's rows appear in any requirement count.
- [ ] `planning.mjs uat status` on a UAT.md carrying a hand-added `### Manual notes`
      section that contains a `1. check the logs` line reports only the real items
      (no phantom item, no duplicate `k`), and a following `uat record` leaves that
      section present and byte-identical in the file.
- [ ] `uat merge` fed a payload containing a gap with neither `k` nor `name`, a
      `human_checks` entry with no name, a gap whose `k` matches no existing item,
      and one valid gap exits `ok:true`, appends only the valid gap, writes no item
      named `undefined`, and reports a nonzero rejected count.
- [ ] `uat merge` fed a pass or gap for an item already recorded non-pending leaves
      that recorded result unchanged and reports a nonzero skipped count (today it
      drops silently and reports nothing).
- [ ] `planning.mjs recall decimal phases` (two bare words, unquoted) returns the
      same results as `recall "decimal phases"`; and a `- [x] (phase 3) ...`
      CAPTURE.md line appears in results with `phase: 3`, no `[x]` in the snippet,
      and a marker showing it is closed.
- [ ] `audit` on a phase whose PLAN.md frontmatter declares `requirements:` as a
      block YAML list reports that plan's requirement ids rather than zero, and
      `plan-overlap` reads its block-form `files:` list; a `requirements:` line
      appearing in the plan body outside the `---` fence contributes no ids.
- [ ] `renumber remove` on a roadmap whose phase detail heading is exactly
      `### Phase N:` (colon, no trailing name) removes that section from the document.
- [ ] Each of #41, #46, #47, #48 has at least one test that fails on the pre-fix
      code and passes after it, and all three CI gates pass:
      `node --test cadence-core/bin/*.test.mjs`,
      `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Flagged assumptions

- D-07's block-list grammar is settled only for the forms the shipped template and
  a plausible hand-edit produce (contiguous `- item`, trailing ` #` comment) -
  Likely; if wrong: a plan written in an unanticipated block spelling (quoted
  items, odd indentation, `- ` on the key line) still reads as zero requirements
  and zero files, and D-14 means nothing says so. The repo is zero-dep with no
  YAML parser and no in-tree example beyond the inline form, so the tolerance
  boundary cannot be derived from the codebase.
- D-02 likely warrants a line in `cadence-core/templates/UAT.md` stating that
  hand-added sections survive a rewrite - Likely; if wrong: the template's
  machine-owned framing keeps discouraging the very use the fix now supports.
  Left to the planner's judgment; not confirmed as in-scope this pass.
