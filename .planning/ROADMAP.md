# Roadmap

## Overview

`v2.6.1 — the defects the sweep found`. Opened 2026-08-09. Scope is `DFC-01`
through `DFC-04`, the four defects `v2.6.0`'s doc sweep found and filed rather
than reworded away. No phases yet: `/cad-phase add` opens the first.

`v2.6.0` and everything before it are pruned from this file by design. The
shipped requirement rows live in `.planning/REQUIREMENTS.md` under `## Shipped`,
the phase records in `.planning/_archive-v2.6.0/`, and the narrative in
`CHANGELOG.md`. Git history is the archive.

## Phases

- [ ] **Phase 1: The filed defects** - close DFC-01..04, the four defects v2.6.0's doc sweep found and filed, each with the check that would have caught it

## Phase Details

### Phase 1: The filed defects
**Goal:** The four defects `v2.6.0`'s doc sweep filed rather than reworded away
are closed at their source, and each lands with a check that would have caught
its own failure mode.
**Depends on:** Nothing
**Requirements:** DFC-01, DFC-02, DFC-03, DFC-04
**Success Criteria:**
1. `cadence-core/bin/lib/trace.mjs` contains no literal U+0000 byte: `file(1)`
   reports it as text rather than `data`, and a `grep` over
   `cadence-core/bin/**` without `-a` returns matches from that file. The
   composite worker key still separates its parts with NUL, written `\0`, and
   `node --test cadence-core/bin/trace.test.mjs` stays green, so this is a
   change to the source bytes and not to behaviour.
2. The `phase_diff` row of the wiring table at
   `cadence-core/references/review-triggers.md` states the gates
   `route.mjs resolve` actually returns at each level (`off / advisory /
   adjudicated`), and `docs/WORKFLOW.md`'s copy of that row agrees with it.
3. `skills/cad-plan-checker-contract/SKILL.md` names the same number of
   dimensions in its `<dimensions>` block and its `<success_criteria>`, so a
   checker cannot report success having skipped the dimension that bounds plan
   size.
4. The `risk_surface` row of the same wiring table admits an artifact shape
   that `/cad-task` can produce, and `cadence-core/workflows/task.md`'s
   instruction matches it without losing the named transient-diff path,
   never-stage rule or cleanup that `execute.md` states for its sibling site.
5. `cadence-core/bin/weight-budgets.json`'s entry for `review-triggers.md`
   equals what `node cadence-core/bin/weight.mjs --root .` reports for it, and
   the inline figure quoted at `skills/cad-land/SKILL.md:44` and
   `skills/cad-plan-review/SKILL.md:39` equals the same number. All three move
   together or none do (they are 17,733 B today, at exactly the budget with
   zero slack).
6. Each fix ships with a check that fails against the unpatched code, proved by
   a mutation or a patch-and-rerun recorded in the SUMMARY, so no vacuous
   assertion ships. A defect this cycle exists to close must not be closable
   again next cycle.
7. `node --test cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs --root .`
   and `npx tsc -p tsconfig.ci.json` are green.
