PLAN COMPLETE
Plan: .planning/phases/2/PLAN-2.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - Commit verbatim's brief as a fixture with a structural test | a9f177b | `cmp` against `/data/code/verbatim/DESIGN-BRIEF.md` identical (29,447 B), so the planned assertions held as written; 5 tests pass, `design-brief` lands in the `other` group the CI matrix already runs |
| 2 - `--brief <file>` is parsed, and what the brief settles is not re-asked | cc61863 | Budget rows re-pinned 16098 -> 17858 and 836 -> 964; all 22 `NEW-PROJECT-*` ledger cites re-pinned, eight of which (NEW-PROJECT-15..22) were stale by 3-5 lines BEFORE this phase and are pinned to the live text rather than to old-cite-plus-shift |
| 3 - A `docs/` page for the discovery workflow | e881656 | `docs/DISCOVERY.md`, a new file rather than a `docs/WORKFLOW.md` section (settling the CONTEXT flagged assumption); the four cited repo paths resolve and no budget row was added, per D-13 |
| 4 - README's getting-started path links the discovery page | b5908c1 | Two-line insert at README.md:74 inside `## The loop`; 19 `README-*` ledger rows (README-32 down) shifted by exactly 2 and re-pinned in the same commit, with the ledger preamble recording the second insert |
Deviations: none
Open items:
- AC5 is walked, not run here: `/cad-new-project --brief` against
  `cadence-core/bin/fixtures/verbatim.design-brief.md` in an empty directory,
  checking that the problem, users, non-goals, stack and constraints are not
  re-asked and that every question traces to an open item. Belongs to
  `/cad-verify 2` alongside AC1-AC3.
- NEW-PROJECT-12's claim text ("Dispatch via the spawn-agent seam with timeout
  `workflow.subagent_timeout`") is now half-false: the key was deleted, and
  `cadence-core/workflows/new-project.md:211-213` says so in prose. Its line cite
  is correct and its `claim`/`verdict` cells were left untouched per D-16. The
  text needs the CONTEXT-03 treatment (correct the claim, not the cite) in a
  sweep that owns claim text.
- `.planning/DOCS-CLAIMS.md`'s README-39 row cites a range ("the three command
  lists") that this plan shifted arithmetically; the range's edges were checked,
  not every command in it. A `/cad-docs-verify` sweep is what re-reads it.
