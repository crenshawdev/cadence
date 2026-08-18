---
phase: 3
status: complete
completed: 2026-08-18
---

# Phase 3: Flags that do more or less than they say - Summary

The stakes level now moves both halves of a review panel (level-keyed `tiers` +
new `efforts` grid, both returned from `route.mjs resolve`), `git.create_tag`
governs only the land-time tag cut (milestone.md decides release mode from
evidence), and issue-check's per-issue resolve loop runs under one wall-clock
budget taken once at loop start.

## What shipped

- Level-keyed `tiers` grid + dense `efforts` grid with `effort_names`
  vocabulary; `resolve` returns `reviewer_tiers`/`reviewer_efforts` beside
  `reviewers` - `cadence-core/route-table.json`, `cadence-core/bin/route.mjs`
- Both grids validated per level in both directions (`unknown-effort`,
  `<grid>/<level>/<trigger>` locations) - `cadence-core/bin/lib/route-cells.mjs`
- All 8 per-trigger `.tier`/`.effort` schema defaults on the `null` unset
  sentinel; docs (reach table, catalog, review-triggers.md, INTERNALS.md)
  rewritten to the resolve-line handoff - `cadence-core/config.schema.json`
- Config-layer tier/effort vocabulary check with warn-and-stand fallback, the
  same shape as the gate check (post-review fix) - `cadence-core/bin/route.mjs`
- Read-only bounded `tags` arm on the git-branch seam;
  milestone.md step 2 decides release mode from a confirmed version + published
  tags, with ONE skip rule (no confirmed version) after the post-review fix;
  `git.create_tag` words name the land-time cut; REL-01 falsifier in
  prose-agreement.test.mjs - `cadence-core/bin/git-branch.mjs`,
  `cadence-core/workflows/milestone.md`
- Per-issue resolve loop bounded by a single `Date.now()` deadline from the
  resolved timeout; D-11/D-15 behaviours pinned by test -
  `cadence-core/bin/issue-check.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 5e4b883 | Level-key the tier grid, add the effort grid, return both from resolve |
| 1 | 2 | c968b00 | Validate the tiers and efforts grids in both directions, per level |
| 1 | 3 | b3a5515 | Move the tier and effort schema defaults onto the unset sentinel |
| 1 | 4 | 71b238b | Rewrite the tier and effort rows in the reach table and the catalog |
| 1 | 5 | a41f64c | review-triggers.md takes the tier and effort off the resolve line |
| 1 | 6 | 25fd067, 9d47e87 | Settle the grid count everywhere it is stated; reach rows name the resolved tier |
| 1 | review fix | c78cbdb | Refuse an out-of-vocabulary config tier or effort, as the gate check already does |
| 2 | 1 | 58cb940 | A bounded, read-only tags arm on the git-branch seam |
| 2 | 2 | 4a05bf1 | The milestone close decides release mode from evidence, not a flag |
| 2 | 3 | de2886c | The tag flag's words name the land-time cut that reads it |
| 2 | 4 | 79b337c | The REL-01 falsifier - one read site, and words that name it |
| 2 | review fix | 1ca00f7 | One skip rule for a close with no confirmed version |
| 3 | 1 | dd30e52 | The per-issue resolve loop is bounded by one wall-clock budget |
| 3 | 2 | 17e58d1 | The two behaviours the resolve budget must not break |

## Deviations

- [deviation] Plan 2 task 3: D-13 named DOCS-CLAIMS CONFIG-26 as moving with
  the catalog rewrite, but its claim is the Default column, which the
  Purpose-cell fix does not touch - the row was left `accurate` and the ledger
  narrative records why (4a05bf1); D-13 annotated in CONTEXT.md.
- [deviation] AC2's read half was reworded at UAT. It asked
  `config.mjs get review.triggers.plan.tier` to report the value the resolver
  uses at the effective stakes level; D-04 put that key on the `null` unset
  sentinel and `cadence-core/bin/config.mjs:288-291` states the matching
  refusal outright - that seam does not know the stakes level and never reads
  `route-table.json`, so answering as if it did is the same defect pointed the
  other way. What shipped is the `.gate` shape: `null` plus a warning naming
  `route.mjs resolve` as the answering seam, which is the fix for the fixed
  `flagship` the criterion was written against. AC2 now states that; the grids
  half is unchanged and held on first check.

## Review gates

`risk_surface` fired per plan (blocking, claude-subagent voice; openai dropped:
no-key - `~/.config/cadence/providers.env` missing, likely lost in the /data
migration). Plan 1: 5 raised, 1 high confirmed -> fixed c78cbdb, re-arm passed.
Plan 2: 4 raised, 1 high confirmed -> fixed 1ca00f7; the one re-arm round was
already spent, user explicitly accepted the prose-only fix range (override
recorded). Plan 3: no detector match. Medium survivors persisted at
`REVIEW-risk_surface-plan-1.md` / `-plan-2.md` and filed as open items.

## Open items

- Restore the cross-model review key: `~/.config/cadence/providers.env` is
  missing, so every panel this run degraded to claude-subagent.
- No drift check ties `effort_names` (or `tier_names`) to config.schema.json's
  enums; a `vocabularyIssues` pass in the shape of `gate-vocabulary-drift` is
  the fuller form.
- CHANGELOG migration note: the level-keyed tiers grid means a flagship-only
  provider config loses its cross-model reviewer at shipped on upgrade
  (warned per resolve, but documented nowhere).
- A missing table `efforts` entry resolves null silently (no runtime warning;
  CI-only detection) and route.mjs's guard comment misdescribes it.
- review-triggers.md's degraded-resolve fallback ("config gate, tier and
  effort") is unfollowable with the null schema defaults, and reads raw
  unvalidated config values.
- route-table.json `_meta.review`'s level-invariance rationale for
  risk_surface needs reconciling with the level-varying tier ladder.
- `readTags` swallows ENOBUFS (1 MiB maxBuffer) and reports a heavily tagged
  repo as `tags: []` with `ok:true`.
- `git-branch.mjs tags` collapses an empty `--dir` with an absent one and
  answers about the process cwd (`flagValue`'s strict reader is the fix shape).
- issue-check test harness `stub()` gained `issueSleep` (sleeps only the
  unmatched resolve arm) so the budget measurement stays falsifiable.

## Goal check

The phase goal names three controls; each has landed evidence. (1) Raising
`stakes` moves both panel halves: route-table.json now carries level-keyed
`tiers` and `efforts` grids (route-table.json:61-90) and `resolve` returns
`reviewer_tiers`/`reviewer_efforts` per trigger - verified live this run, where
`shipped` resolved `balanced/medium` for risk_surface (plan 1's review fire)
against `critical`'s `flagship/high` row; 10 route.test.mjs cases were watched
failing on the pre-fix tree. (2) `git.create_tag` governs the tag alone:
`grep -n create_tag` is empty in milestone.md, step 2 decides release mode
from the `tags` probe plus a confirmed version, and prose-agreement.test.mjs's
REL-01 falsifier fails on any second read site (watched failing at c78cbdb
where milestone.md was still a reader). (3) The per-issue resolve bound is a
land's budget: issue-check.mjs takes one deadline at loop start and the
falsifier showed 5 resolves/5.07s before vs 2 resolves/2.06s after
(dd30e52). Full suite 2215+ passing, self-verify `ok:true` after every plan.
Gap named honestly: the review found the panel's config-layer inputs were
unvalidated (fixed c78cbdb) and milestone step 2's two skip rules contradicted
(fixed 1ca00f7); the medium-severity residue is in Open items, not silently
dropped.
