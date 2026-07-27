# Phase 1: The plan-file frontmatter grammar - Context

Gathered: 2026-07-27
Feeds: /cad-plan 1

## Scope boundary

In: `readFrontmatterList` and its `clean()` helper in
`cadence-core/bin/lib/planning-files.mjs` are replaced by an explicit line
classifier written against a stated grammar, closing the nine open CAPTURE
items in that function: the HIGH comment-on-key-line regression from `ef75864`
(a trailing comment read as the whole scalar value, discarding the block list),
the greedy inline `\[(.*)\]` three reviewers found independently, the block
reader that breaks at the first non-item line, a block item that is itself a
comment, the `#TODO` no-space comment form, the byte-0 fence anchor (leading
blank line / BOM), and total failure on a CRLF checkout. A shared
`normalize(text)` lands on the parse path. Both consumer envelopes
(`audit`, `plan-overlap`) gain an additive diagnostic field so a PARTIAL read
stops being invisible. The four existing frontmatter tests are rewritten as the
new grammar's acceptance set, and a parser-level `planning-files.test.mjs`
carries the grammar table.

Out: the task-line arm of `parsePlanFiles` (`- **Files:** a, b`) and its `add()`
helper (D-09). The sibling parsers' CRLF/BOM exposure - `PHASE_LINE`, the
snippet parsers, `parseUat`'s fence - which stays unfixed this phase; `PHASE_LINE`
and `parseRoadmapPhases` belong to phase 4 (D-10). Any relaxation of what counts
as a phase-shaped line. Any new feature.

Deferred: None
Plan shape: one plan

## Durable decisions

- D-01 (`#` discrimination, quoting decides): an unquoted `#` after `key:`
  always starts a comment; `"#41"` is data. This is real YAML's own rule, and it
  is the only candidate that is a stated rule rather than a heuristic, which is
  the milestone's whole premise. It matches 100% of live plan files - every
  `#`-shaped id in this repo's history appears double-quoted - and
  `templates/REQUIREMENTS.md:59` documents the id format as `CATEGORY-NUMBER`
  and never uses `#` at all; the `#NN` spelling exists only because Cadence
  dogfoods against its own GitHub issue numbers. Chosen over "`#` followed by a
  digit is an id" (closes `#TODO` but silently loses a non-numeric `#auth-1` id
  to the comment arm, so audit reports `no-plan` on a requirement a plan
  genuinely covers) and over keeping `#` + non-space = id with an added id-shape
  test (no test inverts, but the grammar stays two rules instead of one).
  Accepted cost: the `requirements: #41` case inverts and its test is rewritten,
  and a hand-written unquoted `- #41` block item reads as a comment. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:472`,
  `cadence-core/bin/planning.test.mjs:966-976`,
  `cadence-core/templates/REQUIREMENTS.md:59`, `.planning/REQUIREMENTS.md` history.
- D-02 (the reporting channel; phase-3 D-14 RE-OPENED): the reader reports what
  falls outside the grammar through an additive, omitted-when-empty diagnostic
  field on both the `audit` and `plan-overlap` envelopes, following the existing
  `orphans` / `undeclared` shape. D-14 held that no `warnings[]` was needed
  because phase-1 D-01's convention covers a file that fails to PARSE while
  every phase-3 case was an under-read of a file that parsed cleanly; that
  reasoning does not survive this phase's goal, which requires the reader to
  report rather than absorb. The gap being closed is specifically the PARTIAL
  read: a total under-read is already loud (`no-plan` breaks, or `undeclared`
  routing execute to sequential), but a truncated-but-nonempty `files:` list
  leaves a plan neither `undeclared` nor overlapping, so the parallel gate
  greenlights two plans that write the same path - the one failure with no
  observable at all. Never `{ok:false}`: that would turn one odd frontmatter
  line into a total audit failure across every phase, violating the seam
  contract's never-blocks-the-spine rule. Chosen over making the grammar total
  so nothing falls outside it (cheapest, no envelope or budget change, but a
  genuinely malformed input still yields a silent partial read) and over a
  `plan-overlap`-only `{ok:false, reason:"unparseable-plan"}` (targets the
  parallel-safety case but leaves a fabricated audit orphan undiagnosed, and is
  asymmetric between two callers of one reader). Evidence:
  `cadence-core/bin/planning.mjs:9-14,512-517,545-553,832`,
  `cadence-core/bin/lib/config-merge.mjs:93-125`,
  `cadence-core/workflows/execute.md:73`, `cadence-core/workflows/audit.md:23`.
- D-03 (rewrite, not a tenth arm): the function body is replaced by an explicit
  line classifier against a written-down grammar, not patched with more regex
  arms. `readFrontmatterList` was introduced whole at `ef75864` and patched once
  at `2470e95`, and that patch moved the comment-only case from an over-read to
  an under-read rather than closing it - the second failed regex round on a
  36-line function now carrying nine open defects. The same accretion pattern
  produced phase 4's two push-rail regressions. Chosen over targeted per-defect
  fixes, which is the cheaper diff and the reason the defect list is this long.
  Evidence: commits `ef75864`, `2470e95`;
  `cadence-core/bin/lib/planning-files.mjs:447-486`.
- D-04 (block termination; phase-3 D-07 RE-OPENED): a block list SKIPS blank and
  comment-only lines and terminates on a stated terminator set - the closing
  `---` fence, a following `key:` line at column 0, or EOF - rather than
  breaking at the first non-`- ` line. D-07's minimal grammar ("contiguous
  `- item` lines, terminating at the first non-`- ` line, no comment-only
  lines") is precisely what makes a comment heading or splitting a list truncate
  it silently, and D-07's own flagged assumptions predicted this as its failure
  point. Every live block list terminates at the fence (`21114c8`, `f828beb`) or
  at a following key line (`155378f`, `f0ce954`), so the terminator set covers
  every shipped case with no widening risk. Chosen over treating a comment line
  as an item that yields nothing (same effect, smaller statement, but leaves
  termination undefined for anything else) and over indentation-based
  termination (introduces a nesting concept the grammar deliberately lacks).
  Evidence: `cadence-core/bin/lib/planning-files.mjs:476-480`; phase-3 CONTEXT.md
  at commit `d8f5903` (D-07).
- D-05 (where normalization lives): a shared `normalize(text)` in
  `planning-files.mjs` runs on the PARSE path only, wired to this reader, with
  phase 4 adopting it for the roadmap grammar it already owns. Explicitly NOT in
  `planning.mjs`'s `read()`, which is the obvious chokepoint and the wrong one:
  the text `read()` returns is written back verbatim by `phase-done`
  (`planning.mjs:240,246,259-260`) and `renumber` (`:676,762`), so normalizing
  there would silently convert a user's CRLF `ROADMAP.md` and `REQUIREMENTS.md`
  wholesale to LF on the next `phase-done` - a byte-level rewrite of files
  Cadence promises to touch surgically (`setPhaseBox` returns "everything else
  byte-preserved"). Known risk, accepted: a shared helper wired to one caller
  can read as though the whole file is CRLF-safe when `status` still degrades to
  `unparseable-roadmap` on a CRLF checkout; phase 4 owning adoption is what
  closes it, and D-10 records the boundary. Evidence:
  `cadence-core/bin/planning.mjs:52,240,246,259-260,676,762`,
  `cadence-core/bin/lib/planning-files.mjs:125-135`.
- D-06 (parser-level tests; phase-3 D-15 RE-OPENED): a new
  `cadence-core/bin/planning-files.test.mjs` carries the grammar table,
  ALONGSIDE - not instead of - the seam-level `audit` and `plan-overlap` tests
  that prove the defects reach an observable. D-15 barred a parser-only unit
  file on the grounds that it would pass while the defect never reached
  `cmdAudit`; that holds for a per-defect fix and not for a stated grammar,
  where the acceptance set is the artifact and every seam case costs a
  `mkdtempSync` tree plus an `execFileSync` process spawn. The table is 20+
  cases (shipped forms, nine defects, CRLF/BOM/blank-line variants). Precedent
  is already in the repo: six of ten `lib/` modules have unit test files, and CI
  globs `cadence-core/bin/*.test.mjs`, so the file is picked up with no config
  change. Chosen over holding D-15 (20+ process spawns) and over exporting the
  reader to table-drive it from inside `planning.test.mjs` (one file, but breaks
  that file's seam-only framing). Evidence:
  `cadence-core/bin/planning.test.mjs:25-123,126-136`,
  `cadence-core/bin/require-int.test.mjs`, `cadence-core/bin/bm25.test.mjs`,
  `cadence-core/bin/branch-decision.test.mjs`, `.github/workflows/test.yml:27`.

## Decisions

- D-07 (the accepted set is fixed by what Cadence writes): the grammar must
  accept inline quoted (`requirements: ["#39", "#40"]`), inline unquoted
  (`requirements: [CWT-01, CWT-02]`), two-space-indented block lists, and a key
  line carrying a trailing `#` comment - the template's own two lines. No live
  plan uses a scalar, a comment-only key line, a comment inside a block, CRLF,
  BOM, or a leading blank line, so those are widenings rather than shapes at
  risk. Non-greedy `\[([^\]]*)\]` newly rejects nothing: no historical PLAN file
  has a bracket in a frontmatter comment. Evidence:
  `cadence-core/templates/PLAN.md:1-6`; PLAN files at `bfdafc2`, `155378f`,
  `f0ce954`, `21114c8`, `c4ab89f`, `f828beb` and twelve others;
  `cadence-core/bin/planning.test.mjs:43`; `cadence-core/agents/cad-planner.md:122-127`.
- D-08 (`clean()`'s quote strip narrows, forced by D-01): the global `["']`
  strip becomes a WRAPPING-quote strip. Under D-01 quotes carry meaning, so a
  strip that fires anywhere in the value is no longer merely lossy - it also
  destroys the signal the grammar now reads. It is lossy today regardless:
  `src/it's-a-file.md` is silently rewritten to `src/its-a-file.md`. The
  `#`-at-index-0 block-item defect is likewise a `clean()` bug, not a line-loop
  bug. Evidence: `cadence-core/bin/lib/planning-files.mjs:456`.
- D-09 (the task-line arm stays out): `parsePlanFiles`' second source
  (`- **Files:** a, b`, `planning-files.mjs:511-513`) is a `/gm` regex, already
  CRLF-tolerant, and shares none of the reader's exposure, so it is not restated
  here. Its `add()` helper does mangle real inputs (`lib/(x)/y)` yields `lib/`),
  which no CAPTURE item files - that gets filed as a new capture item in this
  phase rather than fixed. Known consequence: `plan-overlap` trusts the union of
  both sources, so a mangled task-line path remains a second route to a false
  `overlaps: []`. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:504-515,507,511-513`.
- D-10 (sibling parsers stay out; phase 4 adopts `normalize`): `PHASE_LINE`
  (`:52`) and the snippet parsers (`:192,227`) fail on a CRLF line, and
  `parseUat`'s fence (`:325`) is the identical expression to this reader's
  (`:450`) and fails on both CRLF and BOM. None is repaired this phase.
  `PHASE_LINE` / `parseRoadmapPhases` are phase 4's by roadmap, and phase-3 D-08
  bars unifying matchers "for consistency" as a state-machine change smuggled
  into a parser fix. `parseCursor`, `parseRequirements` and
  `parseContextDecisions` are already CRLF-tolerant and need nothing.
- D-11 (budgets move with the prose; the grammar is written where it costs
  nothing): `audit.md` (2599) and `execute.md` (12140) sit at exactly their
  budget, so `weight-budgets.json` moves in the same change - the phase-3 D-13
  pattern - or CI fails `budget-overrun`. `audit.md:48` forbids
  PASS-with-warnings, so the new prose must state that a grammar diagnostic is
  orthogonal to the verdict rather than a third state. The grammar itself is
  written into `references/` and `templates/PLAN.md`, which
  `lib/surface-weight.mjs:53-78` does not measure, so stating it costs no
  budget. Evidence: `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:346-350`,
  `cadence-core/bin/lib/surface-weight.mjs:53-78`,
  `cadence-core/workflows/audit.md:48`.
- D-12 (the return shape widens under the typecheck): `readFrontmatterList` no
  longer returns a bare `string[]`, which propagates through
  `parsePlanRequirements` / `parsePlanFiles` JSDoc and is enforced by the
  required CI typecheck; the diagnostic must survive `parsePlanFiles`' `Set`
  merge with its second source. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:447,490,503-515` (`// @ts-check`),
  `tsconfig.ci.json`, `.github/workflows/test.yml:50`.

## Acceptance criteria

- [ ] `audit` against a PLAN.md whose `requirements:` key line carries a
      trailing comment above a block list returns both declared ids, with zero
      `orphans.plan_ids` entries and no `no-plan` break.
- [ ] `plan-overlap` against two plans whose `files:` block lists each contain a
      comment line and share a path reports that path in `overlaps`.
- [ ] `requirements: ["#41"]  # see [D-06]` parses to exactly `["#41"]` - no
      entry containing `]`, `#`, or `see`.
- [ ] `requirements: #TODO fill this in` above a block list of two quoted ids
      returns exactly those two ids and mints nothing containing `TODO`; a block
      item `- "#41"` still reads as the id `#41`.
- [ ] The CRLF, leading-blank-line, and BOM variants of one PLAN.md each return
      ids and files identical to its plain-LF equivalent.
- [ ] A frontmatter line that is neither item, comment, blank, nor terminator
      appears in the new diagnostic field on both `audit` and `plan-overlap`
      output, and its presence does not change the audit PASS/FAIL verdict.
- [ ] `node --test cadence-core/bin/*.test.mjs` and
      `npx tsc -p tsconfig.ci.json` both pass, `self-verify` reports no
      `budget-overrun`, and the four rewritten frontmatter tests plus the new
      parser-level grammar table are among the passing set.

## Flagged assumptions

- Whether Claude Code's Write tool or a Windows `core.autocrlf` checkout
  actually produces CRLF or BOM bytes in a `.planning` file is unrecorded
  anywhere in this repo - Unclear; if wrong, the normalization in D-05 is dead
  code. Harmless either way, and criterion 5 pins the behavior regardless, but
  do not cite it as a fixed live defect.
- A hand-written unquoted `- #41` block item reads as a comment under D-01 and
  is silently dropped - Confident, and an accepted cost rather than a defect; if
  a user does write unquoted `#`-ids, audit reports `no-plan` on a requirement a
  plan genuinely covers. Nothing in the shipped templates or the repo's own
  history writes that form.
- `add()`'s path mangling in the task-line arm (D-09) is a live defect being
  filed rather than fixed - Confident; if deferring is wrong, `plan-overlap`
  keeps a second route to a false `overlaps: []`, which is the exact failure
  class this phase exists to close.
- D-01 aligns the grammar WITH real YAML on comments and quoting, so the
  downstream-tooling risk the analyzer raised is reduced rather than measured -
  Likely; no specific editor or `gray-matter`-style consumer was tested.
