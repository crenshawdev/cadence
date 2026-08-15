---
phase: 5
plan: 1
requirements: [DOC-02]
files:
  - .planning/phases/5/docs-verify-run-2-a.md
---

# Phase 5: What Cadence claims about itself is true - Plan 1 (sweep, half A)

## Goal

Run 2 of the `/cad-docs-verify` sweep over the first half of run 1's recorded
surface - the four root docs and the ten A-M workflow files - producing a report
whose per-doc claim tables the ledger can be diffed against.

## Must be true when done

- `.planning/phases/5/docs-verify-run-2-a.md` exists and states the sweep date,
  the HEAD sha it was read at, and the two invocation strings it ran, each
  byte-identical to the strings `.planning/DOCS-CLAIMS.md:28-29` records.
- All fourteen swept filenames appear in that report, each with its own claim
  table in the `claim | location | verdict | correct value (if stale)` shape
  `cadence-core/workflows/docs-verify.md:46` states.
- Every claim row carries one of exactly three verdicts - `accurate`, `stale`,
  `unverifiable` - and a stale row names the correct value where it is knowable.
- The report ends with a half-A headline count of the form
  `N accurate, M stale, K unverifiable`, counted from the table ROWS, and the
  three numbers sum to the number of rows in the report.
- No document under `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md`
  or `cadence-core/workflows/` was edited by this plan - `git diff --name-only`
  over the plan's commit range names only the report file.

## Context

Locked by `phases/5/CONTEXT.md`: D-01 re-runs run 1's three recorded invocations
BYTE-IDENTICAL so run 2's counts stay comparable against run 1's 509/18/20 = 547
- do not widen an invocation's file list, and do not fold the fourth invocation
(plan 2's) into these two. D-04 forbids changing `docs-verify.md`'s default
target set. `cadence-core/workflows/docs-verify.md` step 5 is binding: the sweep
STOPS at the report and edits no doc, so every stale finding here is written down
and nothing is corrected in this plan. This plan is a FRESH extraction and does
not read `.planning/DOCS-CLAIMS.md` - the ledger join happens in plan 3, on `doc`
plus claim TEXT, which is what makes a shrink in the count mean claims were
fixed rather than that the extraction landed differently. Out of scope: the
ledger file itself, the three direct prose edits, and the test assertions.

## Tasks

### Task 1: Open the run-2 half-A report with its surface and invocations pinned

- **Files:** .planning/phases/5/docs-verify-run-2-a.md
- **Action:** Create the report file. Its header states: the sweep date, the
  output of `git rev-parse HEAD` as the sha the docs were read at, and the two
  invocation strings this half runs, transcribed byte-identically from
  `.planning/DOCS-CLAIMS.md:28` and `:29` (the four root docs; the ten workflow
  files `audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone`).
  Below them list the fourteen files with each one's `wc -c` byte count and their
  total, and state that half B (`.planning/phases/5/docs-verify-run-2-b.md`)
  carries invocations 3 and 4. Include an explicit coverage checklist naming all
  fourteen filenames, unticked, so that a sweep truncated under context pressure
  is visible in the artifact rather than agreeing with itself - this is the guard
  run 1's own plan put on its transcription step. Do not extract or verify any
  claim in this task.
- **Verify:** The two invocation strings quoted in the report are byte-identical
  to the strings `sed -n '28,29p' .planning/DOCS-CLAIMS.md` prints once their
  `N. ` numbering prefix is dropped, checked by reading both;
  `for f in README.md METHOD.md INTERNALS.md CONTRIBUTING.md audit config config-review context coverage debug decision-review docs-verify execute milestone; do grep -q "$f" .planning/phases/5/docs-verify-run-2-a.md || echo "MISSING $f"; done`
  prints nothing; and
  `grep -c "^- \[ \]" .planning/phases/5/docs-verify-run-2-a.md` returns 14 (all
  fourteen checklist entries present and still unticked at the end of this task).

### Task 2: Invocation 1 - the four root docs

- **Files:** .planning/phases/5/docs-verify-run-2-a.md
- **Action:** Run invocation 1, `/cad-docs-verify README.md METHOD.md
  INTERNALS.md CONTRIBUTING.md`, by following `cadence-core/workflows/docs-verify.md`
  steps 2 through 4 over exactly those four files: extract the checkable claims
  (paths, commands, code symbols, config keys, env vars, stated structure,
  defaults, counts and version numbers), verify each against the live tree with
  the cheapest check that decides it, and classify it `accurate`, `stale` or
  `unverifiable`. Batch the independent checks - path existence in one pass,
  symbol greps in one message, cited-code reads in one batch - and serialize only
  a check that needs a prior result. A false `stale` is worse than an
  `unverifiable`: where a claim needs runtime, a network service or judgment, say
  why and do not guess. Two constraints run 1 ran under still hold and are
  restated in this half's report: `CONTRIBUTING.md` has no mechanical check over
  it (`cadence-core/bin/self-verify.mjs` lints only `README.md`, `INTERNALS.md`
  and `METHOD.md`) so it is swept by hand end to end; and `CONTRIBUTING.md`'s
  "the same three checks CI runs" is decided against `.github/workflows/test.yml`
  rather than left unverifiable. `README.md:124`'s `/cad-capture --cadence`
  sentence and `README.md:146`'s "27 skills and 6 agent roles across 19 rung
  files" are both inside this surface and both checkable - extract them like any
  other claim. Write one table per doc into the report and tick that doc on the
  coverage checklist. Edit no document.
- **Verify:** The report carries four tables, one each headed `README.md`,
  `METHOD.md`, `INTERNALS.md` and `CONTRIBUTING.md`; every row in them carries a
  verdict from the set `accurate|stale|unverifiable` and a location cell naming a
  line or line range; and `git status --porcelain` shows no modification to
  `README.md`, `METHOD.md`, `INTERNALS.md` or `CONTRIBUTING.md`.

### Task 3: Invocation 2 - the ten A-M workflow files

- **Files:** .planning/phases/5/docs-verify-run-2-a.md
- **Action:** Run invocation 2 exactly as `.planning/DOCS-CLAIMS.md:29` records
  it - `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`
  - under the same `cadence-core/workflows/docs-verify.md` steps 2-4 process and
  the same batching discipline as task 2. These ten are workflow prose that
  describes seam calls, so the decisive check for most claims is grepping
  `cadence-core/bin/planning.mjs` and its `lib/` modules for the subcommand or
  flag the prose names, and reading the cited code where the claim is about
  behavior or a default. Four of these files moved during this cycle -
  `context.md`, `decision-review.md` and `execute.md` changed since `81bdb5d`, and
  `execute.md` and `context.md` now call one `trace close` subcommand where they
  used to restate a `trace append --event return/checkpoint` pair - so expect
  claim TEXT to have shifted, not just line numbers, and record what the live
  file states rather than what a prior run recorded. Write one table per doc and
  tick each on the coverage checklist. Edit no document.
- **Verify:** The report carries ten further tables, one per file named in the
  invocation string, and `git status --porcelain` shows no modification under
  `cadence-core/workflows/`.

### Task 4: State half A's counts and prove the surface was covered

- **Files:** .planning/phases/5/docs-verify-run-2-a.md
- **Action:** Count the report's claim table ROWS - not any per-group headline -
  and write a closing half-A line of the form `N accurate, M stale, K
  unverifiable` with the row total. Run 1's report carried three per-group
  headlines that each undercounted their own group and the ledger says so at
  `.planning/DOCS-CLAIMS.md:19-23`; the rows are the record, so state the row
  count and state that it is the row count. List the stale rows first in a
  summary block, since they are the actionable output. Then tick the coverage
  checklist to complete and assert in prose that all fourteen filenames carry a
  table; if any does not, stop and report the missing file rather than closing
  the count over a partial surface.
- **Verify:** The count line's three numbers sum to the number of claim rows in
  the file, checked by `grep -c "^| " .planning/phases/5/docs-verify-run-2-a.md`
  minus the table header and separator lines;
  `for f in README.md METHOD.md INTERNALS.md CONTRIBUTING.md audit config config-review context coverage debug decision-review docs-verify execute milestone; do grep -q "$f" .planning/phases/5/docs-verify-run-2-a.md || echo "MISSING $f"; done`
  prints nothing; and
  `grep -c "^- \[x\]" .planning/phases/5/docs-verify-run-2-a.md` returns 14 with
  `grep -c "^- \[ \]" .planning/phases/5/docs-verify-run-2-a.md` returning 0.

## Notes

This plan and plan 2 are the two halves of one sweep, split on capacity: the four
invocations read 308 KB of documentation and produce a fresh extraction over 29
files, which is more than one executor pass carries well. They share no files and
neither depends on the other's output, so they run in parallel. Plan 3 consumes
both reports.
