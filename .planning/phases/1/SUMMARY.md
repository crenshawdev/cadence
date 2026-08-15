---
phase: 1
status: complete
completed: 2026-08-15
---

# Phase 1: Authorization the repo grants, not the user - Summary

`git.auto_close` now resolves as two named booleans - `autoCloseRequested` from
the merged config and `autoCloseAuthorized` from the repository layer alone -
and every host's unattended publish or merge, GitLab included, consults the
repo-layer one through a new `git-publish.mjs authorized` subcommand before it
touches the remote.

## What shipped

- The repo-layer authorization read, extracted whole - `cadence-core/bin/lib/repo-auto-close.mjs`
  (61 lines), raw `JSON.parse` and fail-closed, deliberately not derived via
  `mergeLayers` so the `tornLayerDetail` defect cannot reach it
- One refusal-wording core that sees both booleans - `authorizationDetail({requested, authorized})`
  in `cadence-core/bin/lib/publish-decision.mjs:115`, so "off everywhere" and
  "requested globally, never authorized here" read differently
- The `authorized` subcommand - `cadence-core/bin/git-publish.mjs:248`, emitting
  `ok:true action:repo-authorized` or `ok:false reason:auto-close-off` with that
  detail, and running no git of its own
- The GitLab arm's consult, ahead of every remote mutation in the arm -
  `skills/cad-land/SKILL.md` step 3(b), with `cadence-core/references/git-publish.md`
  rail 3 restated to match
- The two-boolean behaviour stated where the key is set - `cadence-core/config.schema.json`
  `git.auto_close` purpose and `cadence-core/references/config-reach.md`'s consumer cell
- Failing-capable pins: a PATH-stubbed forge-CLI arm proving no CLI spawns on a
  refusal (`git-publish.test.mjs`), the four-fact divergence arm
  (`config-seams.test.mjs`), and two call-order pins in `prose-agreement.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | c42135c | Demonstrated the ungated GitLab path against the unfixed tree - marker recorded `glab mr create` then `glab mr merge` with no refusal between |
| 1 | 2 | 864861f | Extracted the repo-layer `auto_close` read into `lib/repo-auto-close.mjs`, behaviour byte-for-byte |
| 1 | 3 | 22935e6 | Added `authorizationDetail`, pure and total, null when the repository authorized |
| 1 | 4 | ff60d9a | Wired both booleans into the seam and added the `authorized` subcommand |
| 1 | 5 | acf5318 | Proved the GitLab authorization refuses with no forge CLI spawned, plus a control run |
| 1 | 6 | a20ed10 | Rewrote the two doc surfaces that said GitLab needs no seam call; budgets re-pinned |
| 1 | 7 | cb6a163 | Stated the two resolutions in `config.schema.json` and `config-reach.md` |
| 1 | 8 | fdc13d2 | Pinned the two resolutions and the skipped-ask / halt pairing they must not break |
| 1 | gate fix | 65dd7ba | Hoisted the GitLab consult ahead of the reuse probe after the `risk_surface` review found the reuse arm ungated |

## Deviations

- None - plans executed as written. The one change beyond the plan is the
  `risk_surface` gate fix in `65dd7ba`, recorded under Open items rather than as
  a plan deviation.

## Open items

- The `risk_surface` gate (blocking, gpt-5.6-sol at flagship/high) raised ONE
  blocker against the plan's own output: the consult sat beside `glab mr create`,
  so an already-open MR skipped it and `glab mr merge` ran unauthorized. Fixed in
  `65dd7ba` and pinned by a new order assertion against the reuse probe, watched
  RED against the unfixed doc. The capped narrowed re-arm returned zero findings.
- `skills/cad-land/SKILL.md`'s weight budget was re-pinned twice in this phase
  (12268 -> 13005 in `a20ed10`, 13005 -> 13145 in `65dd7ba`). The file has grown
  ~7% in one phase; worth a trim pass before it grows again.

## Goal check

The sum of these commits plausibly delivers the goal. The two resolutions exist
and are read by name: `git-publish.mjs:113` returns `autoCloseRequested` from the
merged layer while `repoAutoClose` (now `lib/repo-auto-close.mjs`, 61 lines) is
the only source of the authorized value, and `decidePublish` at
`lib/publish-decision.mjs:98` takes both as separate parameters. The GitLab gap
is closed at the only place it could be closed - the prose that drives the arm -
and `git-publish.mjs:248`'s `authorized` subcommand gives that prose something to
call; `git-publish.test.mjs`'s stubbed-PATH arm shows the marker file absent on a
refusal, with a control run proving the absence is not vacuous. The pairing the
prior revert protected is intact and pinned: `config-seams.test.mjs` asserts on
one global-true/repo-unset pair that `config.mjs get git.auto_close` still reports
`true`, that `authorized` refuses, that the two therefore differ, and that
`land-cleanup.mjs gate` still halts. Whole suite 1932 pass / 0 fail;
`self-verify.mjs` reports `ok:true, "problems":[]`.

What is NOT proved here: the enforcement on GitLab is prose plus a test that reads
prose, not a runtime interlock - nothing in `land-cleanup.mjs` refuses to merge if
the consult was skipped, so a model that departs from step 3(b) still reaches
`glab mr merge`. That is the same enforcement shape the phase inherited and the
plan chose deliberately, but it is the honest limit of "no unattended mutation
runs without the repo-layer boolean". The GitHub and Forgejo arms are stronger,
because their publish seam call is a real refusal in the path.
