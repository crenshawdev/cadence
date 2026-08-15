# `/cad-docs-verify` run 2 — half B

Sweep date: 2026-08-14
HEAD sha the docs were read at: `b41821e9e6bd7f71e8c6e4a3577efc677c79481b`
Branch: `cadence/v3.3.0`

This is a FRESH extraction under `cadence-core/workflows/docs-verify.md` steps
2-4. It does not read `.planning/DOCS-CLAIMS.md` rows for extraction — the
ledger join happens in plan 3, on `doc` plus claim TEXT. The one exception is the
targeted `.mjs` pass below, which reads the ledger for its ten-row LIST only.
Per step 5 the sweep STOPS at the report: no document under
`cadence-core/workflows/` or `cadence-core/references/`, and no `.mjs` file, is
edited here.

Half A (`.planning/phases/5/docs-verify-run-2-a.md`) carries invocations 1 and 2
and its own count. Neither half states a run-2 total; plan 3 joins them.

## Invocations run in half B

### Invocation 3 — re-run byte-identical

Transcribed byte-identically from `.planning/DOCS-CLAIMS.md:30` (numbering
prefix dropped), per phase 5 D-01 — run 1's recorded invocations are re-run
unchanged so run 2's counts stay comparable against run 1's 509/18/20 = 547.

3. `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`

### Invocation 4 — NEW surface, added this cycle

4. `/cad-docs-verify cadence-core/workflows/{adopt,minimalism-review,report,suggest}.md`

Why a FOURTH invocation rather than a widened third: run 1 swept 21 workflow
files, and `cadence-core/workflows/` now holds 25. Widening invocation 2 or 3's
glob to reach the four new files would move the surface run 1's
509 accurate / 18 stale / 20 unverifiable = 547 counts were taken over, and run
2's numbers would then be non-comparable against run 1's by construction. Adding
a separately-counted invocation keeps the re-run arm comparable and makes the
new surface visible as new (D-01). Two of these four (`report.md`, `suggest.md`)
describe the run record phase 2 of this cycle rewrote, which is why they are not
deferred to a third cycle.

Everything invocation 4 extracts is NEW claim surface: none of these four files
carries a run-1 ledger row, so their rows are NOT part of run 1's 547 and plan 3
files them under the ledger's post-run-1 section rather than into run 1's table.

### Invocation 5 — ledgered docs no invocation ever named

5. `/cad-docs-verify cadence-core/references/{config-catalog,recall,plan-revision}.md`

Why it exists: these three files carry 32 ledgered rows between them
(`config-catalog.md` 29, `recall.md` 2, `plan-revision.md` 1) and no recorded
invocation names them — run 1's extraction re-pointed claims here from the docs
that cite them. Without this invocation every one of those 32 rows would keep a
run-1 verdict whatever run 2 found, and phase success criterion 1 ("every row
carries a verdict dated this cycle") would fail by construction rather than by
oversight.

These rows are NOT new surface and are not headed as such: plan 3 joins them to
existing ledger rows on `doc` plus claim text.

D-01 is honoured — the three recorded invocation strings stay byte-identical, and
new surface is reached by ADDING a named invocation, never by widening a recorded
one. D-04 is untouched — an explicit-path invocation changes no default target
set, and `cadence-core/workflows/docs-verify.md`'s default (`README.md` plus
`docs/**` and root `*.md`) is not edited.

### Targeted `.mjs` pass — ten ledgered rows, read at the cited site

Ten ledgered rows cite a `.mjs` file rather than a doc:
`cadence-core/bin/lib/trace.mjs` (5 rows), `cadence-core/bin/planning.mjs` (4)
and `cadence-core/bin/self-verify.mjs` (1). These three total 298,480 B, and a
full extraction over them to decide ten claims is a trade this project's token
posture refuses. Each of the ten is verdicted by reading its cited SITE instead.
Not new surface.

With invocations 3, 4 and 5 plus this pass, no ledgered `doc` value is left
outside run 2's reach: half A covers the other fourteen.

## Surface

Eighteen invocation files, 137,725 B (`wc -c`, measured 2026-08-14 at the sha
above), plus the three `.mjs` files the targeted pass reads at ten cited sites
(298,480 B, not swept).

Listed as a bullet list, not a table, so that every `^| ` line in this report is
a claim row and the closing counts can be checked mechanically.

Invocation 3 — eleven files, 87,190 B:

- `cadence-core/workflows/new-project.md` — 18547 B
- `cadence-core/workflows/phase.md` — 3448 B
- `cadence-core/workflows/plan-gaps.md` — 939 B
- `cadence-core/workflows/plan.md` — 21788 B
- `cadence-core/workflows/progress.md` — 8749 B
- `cadence-core/workflows/spike.md` — 2720 B
- `cadence-core/workflows/task.md` — 6104 B
- `cadence-core/workflows/undo.md` — 3103 B
- `cadence-core/workflows/verify-deep.md` — 3706 B
- `cadence-core/workflows/verify.md` — 16823 B
- `cadence-core/workflows/verify-sweep.md` — 1263 B

Invocation 4 — four files, 35,712 B:

- `cadence-core/workflows/adopt.md` — 15627 B
- `cadence-core/workflows/minimalism-review.md` — 8009 B
- `cadence-core/workflows/report.md` — 6935 B
- `cadence-core/workflows/suggest.md` — 5141 B

Invocation 5 — three files, 14,823 B:

- `cadence-core/references/config-catalog.md` — 8542 B
- `cadence-core/references/recall.md` — 2638 B
- `cadence-core/references/plan-revision.md` — 3643 B

Targeted `.mjs` pass — three files, 298,480 B, read only at the ten cited sites:

- `cadence-core/bin/lib/trace.mjs` — 38005 B, 5 rows
- `cadence-core/bin/planning.mjs` — 191760 B, 4 rows
- `cadence-core/bin/self-verify.mjs` — 68715 B, 1 row

## Coverage checklist

Ticked only when that file's claim table is written into this report. An
unticked box at the end of the sweep means the surface was truncated, not that
the sweep agreed with itself.

- [ ] cadence-core/workflows/new-project.md
- [ ] cadence-core/workflows/phase.md
- [ ] cadence-core/workflows/plan-gaps.md
- [ ] cadence-core/workflows/plan.md
- [ ] cadence-core/workflows/progress.md
- [ ] cadence-core/workflows/spike.md
- [ ] cadence-core/workflows/task.md
- [ ] cadence-core/workflows/undo.md
- [ ] cadence-core/workflows/verify-deep.md
- [ ] cadence-core/workflows/verify.md
- [ ] cadence-core/workflows/verify-sweep.md
- [ ] cadence-core/workflows/adopt.md
- [ ] cadence-core/workflows/minimalism-review.md
- [ ] cadence-core/workflows/report.md
- [ ] cadence-core/workflows/suggest.md
- [ ] cadence-core/references/config-catalog.md
- [ ] cadence-core/references/recall.md
- [ ] cadence-core/references/plan-revision.md
- [ ] cadence-core/bin/lib/trace.mjs
- [ ] cadence-core/bin/planning.mjs
- [ ] cadence-core/bin/self-verify.mjs
