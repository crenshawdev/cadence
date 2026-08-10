# Roadmap

## Overview

**`v2.6.2 — what the plugin carries`, opened 2026-08-10.** Scoped from a
context-weight sweep of Cadence's own eager surfaces — four parallel read-only
passes over the heaviest `@`-included prose, recorded in
`design-notes/sweep-2026-08-10-context-weight.md` and filed as issues #98-#103.

The measured baseline: 119,232 est tokens of shipped prose, and an eager set per
command of 28,682 B on `/cad-execute`, 24,533 B on `/cad-verify`, 22,662 B on
`/cad-plan`, 20,777 B on `/cad-context`, 20,547 B on `/cad-config` and 18,209 B
on `/cad-land`. Those are the bytes an `@`-include puts in context on turn one
and keeps there every turn after, before the command reads a single project
file. ~39,700 B of it is removable.

**The sweep also falsified the obvious hypothesis, and that is why this cycle
looks the way it does.** Skill frontmatter `description:` fields — the suspected
bloat — total 3,730 B across all 29 skills, against 27,940 B for
`workflows/execute.md` alone. One command's eager include outweighs the entire
description surface by 7x, and descriptions are what make the model select the
right command at all. Nothing in this cycle touches them.

**Phase 1 is checks, not cuts, and the ordering is the design.** This tree
shipped a 5,792 B eager include that nothing has ever read, with a `CHANGELOG`
entry defending it on a comparison that is false on inspection. Two CI holes let
that happen and are still open: check 13 cannot watch a deferral made from a
workflow file or a contract skill, and no check at all catches an `@`-include
whose consumer does not exist. Cutting prose before those close means cutting it
on exactly the evidence that produced the defect — and phase 3's deferrals would
ship unguarded by the one check written to guard them.

**Phase 2 is bounded by a real risk and is sequenced accordingly.** Roughly
9,000 B of what it removes is rationale, and this repo keeps rationale because
removing it caused regressions before. Rationale bound to a rule the model
applies at runtime stays; rationale addressed to a human maintainer moves to a
`.mjs` header or a design-note, where it costs zero context. `self-verify`
structurally cannot tell those apart, which is why each surface gets its own
commit and its own `/cad-verify` walk rather than one bulk edit.

## Phases

- [ ] **Phase 1: The checks that make the cuts safe** - CI learns to watch a deferral anchored in a workflow file or a contract skill, and to fail an `@`-include nothing reads
- [ ] **Phase 2: The free cuts** - ~17,400 B off the eager path with no new files and no register rows, plus the four drifts the sweep found in passing
- [ ] **Phase 3: The deferrals** - ~22,300 B of branch-local prose moves behind a `Read` at the step that needs it

## Phase Details

### Phase 1: The checks that make the cuts safe
**Goal:** A deferral this cycle makes is watched by CI afterwards, and the class
of defect that motivated the cycle cannot return silently.
**Depends on:** Nothing
**Requirements:** CTW-01, CTW-02
**Success Criteria:** (superseded 2026-08-10 by `phases/1/CONTEXT.md`'s AC1-AC7,
which carry the locked decisions. Two below are REPLACED, not merely restated:
criterion 4's live-tree firing is delivered as a byte-copy fixture instead
(D-13), because firing on the live include and exiting 0 on a clean tree cannot
both hold while CI runs self-verify on every push; and criterion 5's CONTRACTS
registration is WRONG (D-11) — check 14 is top-level-only by design, since
`lib/*.mjs` are modules prose never invokes, so the new rule lib takes no row.
Criterion 1 also understates the work: `regionLabels()` additionally treats the
first `</step>` as closing `<process>`, so `execute.md` yields zero labelled
lines today and no row against it could ever pass (D-01), and heading-style
workflows need their own label form or phase 3's largest move has no anchorable
region at all (D-02).)
1. A `lib/deferred-reads.mjs` register row can anchor a deferral whose `Read` sentence lives in a `cadence-core/workflows/*.md` `<step name="...">` region, and self-verify fails when that sentence is deleted. Rows gain a `file` field naming where the sentence must live; `regionLabels()` labels `<step name="...">` regions alongside the existing top-level `^N. ` numbered steps.
2. A register row can anchor a deferral inside a `skills/cad-*-contract/SKILL.md`, with the same failure behaviour. The scope exclusion at `lib/deferred-reads.mjs:40-44` is removed together with its stated rationale, which prices main-thread residency only and does not price subagent context.
3. The SENTENCE remains the matching unit, not the blank-line block. The existing header explains why and the reason still holds: `skills/cad-land/SKILL.md` step 4b is a single ~2,900 B paragraph, so a block-level test passes when the real instruction is deleted, and `do NOT Read <path>` passes a block-level test.
4. A new self-verify check fails when a `skills/*/SKILL.md` `@`-includes a surface that nothing in that command's reachable prose ever names. It fires on `skills/cad-verify/SKILL.md:29` while that include still exists, and `cad-help`'s `COMMANDS.md` include passes — the workflow IS the surface there, which is the legitimate shape the dead include was wrongly compared to.
5. The check reuses `lib/resident-weight.mjs`' eager/reachable split rather than re-walking the tree, and is registered in `self-verify.mjs`'s `checked` list and its CONTRACTS table.
6. Every existing register row still passes unchanged, and `node cadence-core/bin/self-verify.mjs` returns `ok:true` on a clean tree.

### Phase 2: The free cuts
**Goal:** ~17,400 B leaves the eager path without a single new file, register row
or budget row, and the four drifts found alongside it are closed.
**Depends on:** Phase 1 (criterion 4 must fire on the dead include before it is deleted, so the check is proved against a live instance rather than a synthetic one; and phase 1 shipped a one-row `WAIVED` register in `cadence-core/bin/lib/include-consumers.mjs` as a bridge that this phase's first commit must delete alongside the include itself)
**Requirements:** CTW-03, CTW-05
**Success Criteria:**
1. `skills/cad-verify/SKILL.md:29` is deleted and `cadence-core/templates/UAT.md` stays on disk as the seam's spec, its 5,792 B budget row unchanged. `/cad-verify` eager falls 24,533 -> 18,741. The one-row `WAIVED` register in `cadence-core/bin/lib/include-consumers.mjs` is deleted in the same commit; leaving it turns `self-verify` red with `include-waiver-stale`. (Phase 1 shipped that row as a stated bridge, because check 16 must REPORT this include on a byte-copy fixture while the live tree stays green — the two are the same bytes until the include goes. Its second arm, `include-waiver-expired`, fires instead if this phase's box is checked while the row still stands, so the bridge cannot be left behind quietly either.)
2. The `--tokens` provenance paragraph is stated once, in `lib/trace.mjs`'s header at zero context cost, with each of its five prose sites keeping one imperative sentence. The rules that must survive everywhere: omit the flag when no figure exists, never `--tokens 0`, and a return carrying no figure is ROUTINE rather than a defect.
3. The remaining free-tier cuts land per surface, one commit each with its `weight-budgets.json` re-pin in the same commit: `cad-land` guardrails and deferral tails, `execute.md` and `context.md` and `verify.md` and `plan.md` duplication, three contract `<success_criteria>` checklists, and the `cad-health` regression anecdotes.
4. Rationale that moves lands somewhere — a `.mjs` header or a design-note — and is not deleted. Rationale bound to a rule the model applies at runtime is not moved at all.
5. All four `CTW-05` drifts are closed: the nonexistent `start` step at `execute.md:241`, the `workflow.test_command` resolved at `execute.md:36` but read only on the parallel path, `config-reach.md:136-138`' reach site for the three `parallelization.*` keys, and `seams.md:236-240`' claim of a git-guard consult in cad-land guardrails that cite none.
6. `/cad-verify` walks each affected command rather than one bulk check, because behavioural regression from removed rationale is what `self-verify` cannot catch.

### Phase 3: The deferrals
**Goal:** ~22,300 B of branch-local prose is read at the step that needs it
instead of riding every turn, and every move is watched by phase 1's register.
**Depends on:** Phase 1 (without CTW-01 these ship unguarded, which is the exact failure `lib/deferred-reads.mjs` exists to catch), Phase 2 (shares `execute.md` and `context.md`; sequencing avoids two rounds of budget churn on one file)
**Requirements:** CTW-04
**Success Criteria:**
1. Each move passes `references/seams.md:216-253` on its own terms — only some branches reach it, one consult site, and the read folds into a turn already being taken — and its `Read` sentence states the reference's measured bytes and consult-site count inline.
2. `config.md:71-133` (catalog plus its Type-key legend, which is unreadable apart from it) moves to `references/config-catalog.md`, read at the Interactive-menu walk step 2. `/cad-config` eager falls 20,547 -> ~11,700. The "never hand-validate against this table; call the seam" rule stays behind, because it binds all three routes.
3. `plan.md:267-336`, `execute.md:343-402`, `cad-executor-contract:151-193` and the shared recall gate move to their own references, with `choose_path` staying eager because it decides the branch, and `templates/CONTEXT.md` taking `context.md`'s inlined output template.
4. `trace.test.mjs`'s `BRACKETING` map is updated in the same commit as any moved dispatch block (plan.md 4 -> 2 moments, with its returns and checkpoints).
5. Every new reference carries a `weight-budgets.json` row and exists before its `Read` sentence lands. No config key is orphaned: `risk.override.<surface>` and the three `review.triggers.<t>.*` keys are named only in the moved catalog, so it is moved and never trimmed.
6. Each deferral has a register row that fails when its `Read` sentence is deleted — the capability phase 1 delivers, exercised here on real cuts.
