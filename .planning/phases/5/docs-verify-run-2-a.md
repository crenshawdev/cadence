# `/cad-docs-verify` run 2 — half A

Sweep date: 2026-08-14
HEAD sha the docs were read at: `4602393ca9cf08122fca523b1e44495fe6a2de91`
Branch: `cadence/v3.3.0`

This is a FRESH extraction under `cadence-core/workflows/docs-verify.md` steps
2-4. It does not read `.planning/DOCS-CLAIMS.md` rows — the ledger join happens
in plan 3, on `doc` plus claim TEXT. Per step 5 the sweep STOPS at the report:
no document under `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` or
`cadence-core/workflows/` is edited here.

## Invocations run in half A

Transcribed byte-identically from `.planning/DOCS-CLAIMS.md:28` and `:29`
(numbering prefix dropped), per phase 5 D-01 — run 1's recorded invocations are
re-run unchanged so run 2's counts stay comparable against run 1's
509/18/20 = 547.

1. `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`
2. `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`

Invocations 3 and 4 are carried by half B,
`.planning/phases/5/docs-verify-run-2-b.md`.

## Surface

Fourteen files, 185,264 B (`wc -c`, measured 2026-08-14 at the sha above):

Listed as a bullet list, not a table, so that every `^| ` line in this report is
a claim row and the closing count can be checked mechanically.

- `README.md` — 23172 B
- `METHOD.md` — 33050 B
- `INTERNALS.md` — 16611 B
- `CONTRIBUTING.md` — 4093 B
- `cadence-core/workflows/audit.md` — 12912 B
- `cadence-core/workflows/config.md` — 11545 B
- `cadence-core/workflows/config-review.md` — 3859 B
- `cadence-core/workflows/context.md` — 20033 B
- `cadence-core/workflows/coverage.md` — 4034 B
- `cadence-core/workflows/debug.md` — 6911 B
- `cadence-core/workflows/decision-review.md` — 10754 B
- `cadence-core/workflows/docs-verify.md` — 2796 B
- `cadence-core/workflows/execute.md` — 25289 B
- `cadence-core/workflows/milestone.md` — 10205 B

Total: 185264 B

## Constraints this half runs under

Two constraints run 1 ran under still hold and are restated here:

- `CONTRIBUTING.md` has no mechanical check over it — `cadence-core/bin/self-verify.mjs`
  lints only `README.md`, `INTERNALS.md` and `METHOD.md` — so it is swept by
  hand end to end.
- `CONTRIBUTING.md`'s "the same three checks CI runs" is decided against
  `.github/workflows/test.yml` rather than left `unverifiable`.

## Coverage checklist

Ticked only when that file's claim table is written into this report. An
unticked box at the end of the sweep means the surface was truncated, not that
the sweep agreed with itself.

- [ ] README.md
- [ ] METHOD.md
- [ ] INTERNALS.md
- [ ] CONTRIBUTING.md
- [ ] cadence-core/workflows/audit.md
- [ ] cadence-core/workflows/config.md
- [ ] cadence-core/workflows/config-review.md
- [ ] cadence-core/workflows/context.md
- [ ] cadence-core/workflows/coverage.md
- [ ] cadence-core/workflows/debug.md
- [ ] cadence-core/workflows/decision-review.md
- [ ] cadence-core/workflows/docs-verify.md
- [ ] cadence-core/workflows/execute.md
- [ ] cadence-core/workflows/milestone.md
