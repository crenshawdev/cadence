---
phase: 4
status: complete
completed: 2026-08-04
---

# Phase 4: The ladder is what it says it is - Summary

Per-role effort became a real dial - six `model.effort.<role>` config keys,
layer-read, floored by detected risk, never demoted on retry, refused by key -
and every shipped rung-ladder claim was audited against `route-table.json`
(50 rows: 41 true, 9 corrected, 0 left contradicting) after the two-cell
retune (`critical`/`cad-plan-checker` and `shipped`/`cad-reviewer` now start
at `xhigh`).

## What shipped

- Six `model.effort.<role>` schema keys with per-role rung enums, refused by
  key at the write face - `cadence-core/config.schema.json:19-24`,
  `config.mjs` (null rendered as `null`, set refuses before writing)
- Configured start rung in `route.mjs resolve` - four arms (unmapped rung
  warned, floor held and audible in BOTH `reason` and `warnings`, equal rung
  named, config wins), floored per D-01 with `risk.override.<surface>` the
  only way under
- Retry invariant (D-02): attempt 2 resolves at max(cell.retry, start) in
  `rung_order`; a torn table never demotes a configured start; each hold names
  its cause, config-caused holds attributed to the config
- `warnings[]` now rides the `unknown-role` and `unresolved` `ok:false`
  envelopes - `route.mjs:329,374`
- self-verify check 8b (`effortEnumIssues`: shipped enums vs `RUNG_FILES`,
  including a non-enum type) and check 11 (`unrelayed-route-resolve` via
  `lib/route-relay.mjs`, both `${...}` and brace-less spellings, every
  `mdFiles` surface)
- The retune plus its forward CHANGELOG correction under `## [Unreleased]`
- The ladder-claims audit - durable roster at
  `.planning/phases/4/ladder-claims.md`, corrections in `README.md`,
  `review-triggers.md`, `config.md`, `config-reach.md`,
  `cad-plan-checker-contract/SKILL.md` (block and frontmatter),
  `route-cells.mjs:212`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 0a6d7c4 | Roster pinned against HEAD before the retune (44 rows at task 1) |
| 1 | 2 | 4592797 | Six `model.effort.<role>` keys, refused by key at the write face |
| 1 | 3 | 90b88b0 | `route.mjs` starts a role at the configured rung, floored by risk |
| 1 | 4 | 0155132 | A retry never resolves below the rung that failed |
| 1 | 5 | 176cc55 | An `ok:false` resolve carries what the config read found wrong |
| 1 | 6 | 0228fc1 | self-verify proves each shipped effort enum is that role's rung set |
| 1 | 7 | f54f7ef | Every prose site that issues a resolve carries the relay rule |
| 1 | 8 | 6d8ff6d | The retune - two cells start where they used to climb |
| 1 | 9 | 5e3796c | Close the audit - every ladder claim true or corrected |
| 1 | review | 71d74d3 | A held or unprovable start rung is audible, never silently dropped |
| 1 | review | c2df864 | A non-enum type on an effort key is drift, not a green check |
| 1 | review | 1e9ba51 | The brace-less plugin-root spelling is an issuing site too |
| 1 | review | 1986388 | The floor does not reach pre-plan roles; the docs stop claiming it does |

## Deviations

- [deviation] Task 6 - the truncated-`rung_order` fixture reports SIX
  `effort-enum-drift` entries (one per role filing a rung the truncated ladder
  lacks), not one; the test row was narrowed to the executor's entry plus an
  "every issue is drift" assertion. The code is right - a rung `rung_order`
  does not carry is unreachable for every role.
- [deviation] Task 9 - mechanical verdict extraction returned 42 true / 8
  corrected against a hand-written 45/5 header; header corrected to the
  counted values. (The diff review then flipped row 46, so the final roster
  reads 41/9.)
- [deviation] Task 9 - one ladder claim the token grep cannot see was found in
  reconciliation and rostered: `cadence-core/workflows/decision-review.md:45-50`
  (verdict `true` - that arm deliberately does not route).
- [deviation] Tasks 2/3 - three mechanical adjustments (renamed a shadowing
  `v` parameter, reworded one seams.md phrase so self-verify's invocation
  check cannot misread it, inserted the effort arms at the `effort` assignment
  since `agentFor` is a definition above it). Same behavior as planned.

## Review

`diff` trigger, adjudicated, panel of four; `deepseek` dropped mid-round
(`bad-json`) and subsequently removed from `review.reviewers` permanently by
the user. 10 findings: gemini 0, openai 4, claude-subagent (xhigh) 6.
Adjudication killed 3 (no unknown-model `ok:false` path exists; the backtick
false-positive is the relay check's accepted over-fire; `mdFiles` provably
yields root docs). Seven survivors fixed in the four `review` commits above;
openai's replan-window retry demotion is a design-level open item (CAPTURE).

## Open items

- `route.mjs` retry invariant holds only over unchanged inputs: a mid-fire
  replan that removes a risk path lets attempt 2 legally resolve below attempt
  1's rung. Needs a seam-surface decision (caller passes attempt 1's rung
  back). Filed to CAPTURE from the diff review.
- CONTEXT.md's first flagged assumption is STALE: "self-verify never proves a
  rung file's frontmatter effort" was closed before this phase by
  `rungEffortIssue` + check 7b (`lib/rung-agent.mjs:187`,
  `self-verify.mjs:648`).
- Three phase-3 `route.mjs` items stay open per plan Notes: the raw
  `cfg.stakes` index into `TABLE.cells`, `roles[]` unchecked by the cell walk,
  and the unmapped-rung fail-open at `agentFor` (task 3 routes around it).
- This repo's own `review.triggers.diff.gate="adjudicated"` still contradicts
  the 2026-08-01 "diff stays blocking" decision; every local resolve warns
  about it (existing phase-3 CAPTURE todo).
- `#72 maxTurns` stays deferred: no agent frontmatter edited.
- The relay check's accepted limit: it fires on ISSUING sites only;
  `workflows/plan.md` / `workflows/execute.md` delegate through the seam and
  are governed by `seams.md`'s own relay rule.

## Goal check

The goal was that the ladder becomes configurable and its claims become true,
and the commits deliver both halves with evidence. Configurable: a temp-repo
`config.mjs set model.effort.cad-verifier=xhigh` followed by `route.mjs
resolve --role cad-verifier` reports `effort:"xhigh"` /
`agent:"cad-verifier-xhigh"` against a `medium` cell, with nothing under the
plugin root modified (`git status` empty across the run), and
`route.test.mjs`'s layered row pins repo-over-global precedence. Floored:
the three floor rows including the critical-baseline discriminator pass, and
the diff review's floor-hold finding is closed by the `warnings[]` entry
(commit 71d74d3). True or gone: the roster closes at 50 rows with 0
contradicting, `grep -rn "auto mode"` over shipped surfaces returns nothing,
`review-triggers.md` carries exactly one `pinned at` line naming
`cad-reviewer-xhigh`, and the one claim the phase itself shipped false (the
pre-plan-role "floored" purpose strings) was caught by the diff review and
corrected in 1986388. Gates: 1125 tests / 0 fail, `tsc` exit 0, self-verify
`ok:true` with `checked:` naming `effort-enums` and `route-relay`. The known
honest gap is the stateless retry window recorded in Open items - real, rare,
and a design decision rather than a missed edit.
