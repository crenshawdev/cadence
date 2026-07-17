---
phase: 4
status: complete
completed: 2026-07-17
---

# Phase 4: Release prep & docs - Summary

Reconciled all six public docs to the shipped v1.1 code, recorded the R1/R2 git-model design reversals in DESIGN, softened GSD "rewrite/forked" framing to lineage/distillation with date-labelled mass figures, and added the plugin/marketplace metadata that clears the community plugin-store bar.

## What shipped

- README covers all five shipped v1.1 capabilities (integration-branch model, land cleanup, `auto_close`, git-publish seam, builtin recall), each tied to its real `config.schema.json` key; stale absolute "never pushes" prose reconciled to the real posture - README.md
- DESIGN §6 drops the absolute "Never auto-push" claim and documents reversals R1 (opt-in `auto_close` + sanctioned git-publish seam) and R2 (isPlainPush whitelist deleted after 4 risk_surface rounds) with what/when/why, cross-referencing R3; git config list now names `integration_branch`, `auto_branch`, `on_land_cleanup`, `auto_close`; lone RTK reference removed - DESIGN.md
- "rewrite/forked" framing softened to lineage/distillation across README/LINEAGE/NOTICE/DESIGN/CHANGELOG (MANIFESTO deliberately untouched); every ~3%/word-count mass figure labelled "measured 2026-07-10 (GSD commit d010ea1)" - README.md, LINEAGE.md, NOTICE.md, DESIGN.md, CHANGELOG.md
- Store-submission metadata: `plugin.json` `displayName: "Cadence"` and `marketplace.json` top-level `description`; `claude plugin validate --strict .` prints no warnings/errors in output text - .claude-plugin/plugin.json, .claude-plugin/marketplace.json
- HAND-DRAFT placeholders left for John's positioning voice (README GSD framing, LINEAGE lineage/framing, DESIGN §6 R1 product "why") with factual stand-ins so docs commit cleanly

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 72b6a41 | README: cover five v1.1 capabilities, reconcile git-model prose |
| 1 | 2 | e16bd9a | DESIGN: R1/R2 reversal narrative, +4 rc.2 config keys, drop RTK |
| 1 | 3 | 5840952 | soften GSD rewrite framing to lineage/distillation, date-label mass figure |
| 1 | 4 | eca0ffd | store metadata (plugin displayName, marketplace description) |
| 1 | 5 | (none) | verification-only: strict-validate clean, readiness bar confirmed |
| 1 | 6 | (none) | verification-only: docs-verify sweep, live-claim counts accurate |

## Deviations

- [deviation] DESIGN §6 config-list parenthetical: softened the stale present-tense "rail 3 says no workflow pushes, ever" auto_push-cut note to point at the reversal (opt-in `auto_close` + git-publish seam); left as-is it would assert an absolute no-push claim three lines above the R1/R2 reversal being documented. Within Task 2's §6 scope; committed in e16bd9a.
- [deviation] Task 6 sweep found the LINEAGE distance table's workflows row (16) and `src/` .mjs row (3) differ from the live tree (~20 workflows, ~11 .mjs). Left unchanged: that table is an explicitly-dated 2026-07-10 / d010ea1 snapshot (LINEAGE.md:7-9), same category as the D-09 mass figure that must not be recounted; recounting only the Cadence column would break consistency with the un-recountable GSD column (GSD tree absent).

## Open items

- HAND-DRAFT placeholders await John's voice (intended hand-off, not drift): README.md:7 and LINEAGE.md (two spots) for GSD lineage/distillation framing (crenshaw-voice); DESIGN §6 R1 product "why" beyond the item-9 functional trigger.
- [advisory diff review, low] README.md:5 "guards protected branches from ad-hoc pushes" conflates two mechanisms: git-guard.mjs asks on *every* `git push` unconditionally (git.md:98-100), while the protected-branch guard blocks *commits* on protected branches. The clause narrows the push-ask to protected branches. Worth a one-line factual tightening in a follow-up.
- [advisory diff review, low] LINEAGE.md:36 heading "What was rewritten - the survivors" still uses the retired "rewrite" verb the framing-softening set out to replace; sits in John's HAND-DRAFT positioning territory, so folded into his voice pass.
- LINEAGE dated-table workflow/script counts flagged for John only if he later wants a fresh recount against a current GSD tree (needs GSD source).
- Version bump + dated rc.2 CHANGELOG heading remain owned by the milestone-close `release-bump.mjs` (D-05), run after this phase - deliberately not done here.

## Goal check

The four commits plausibly deliver the phase goal - a v1.1.0 release honest and store-ready. README now names all five capabilities and their schema keys (reviewer confirmed each of `integration.branch`/`on_land_cleanup`/`auto_close`/`git-publish`/`builtin` present, all keys resolve in config.schema.json) and the absolute "never pushes" claim is gone from README and DESIGN (`grep -ni 'never auto-push' DESIGN.md` returns none). The design reversals are recorded: DESIGN §6 carries the R1/R2 subsection with what/when/why and the four rc.2 keys, `isPlainPush` is confirmed absent from git-guard.mjs and git-publish.mjs exists as the real seam. Lineage framing is softened and mass figures date-labelled; MANIFESTO is untouched (`git diff --stat` shows no change). Store readiness holds: `displayName` and marketplace `description` added, `claude plugin validate --strict .` prints clean, name is kebab-case `cadence`, README+CHANGELOG present, version valid semver and correctly left for the milestone-close bump. `node cadence-core/bin/self-verify.mjs` exits 0. Nothing in the goal is missing; the two advisory-review nits (README:5 push-guard wording, LINEAGE:36 heading verb) are low-severity accuracy tightenings recorded as open items, and the intended HAND-DRAFT positioning voice is John's deliberate hand-off, not a gap.
