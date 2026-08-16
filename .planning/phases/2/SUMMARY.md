---
phase: 2
status: complete
completed: 2026-08-15
---

# Phase 2: The seams that fail quietly - Summary

`milestone-prune` now moves a wrapped requirement bullet as a whole span through a
fence-aware `## Active` bound with its pipes escaped, and `/cad-land`'s tracker
report reaches this repository's Forgejo tracker by delegating the login binding
to `tea --remote origin` instead of inferring it from the origin's hostname.

## What shipped

- Whole-span bullet reading in both halves of `archiveRequirements` - `cadence-core/bin/lib/milestone-prune.mjs`
- Fence-aware `## Active` bound, both ends from `sectionSpan` - `cadence-core/bin/lib/milestone-prune.mjs`
- Pipe escaping at the `## Shipped` row interpolation - `cadence-core/bin/lib/milestone-prune.mjs`
- Forgejo tracker read as `--state open` plus a bounded per-issue resolve, with `unresolved` as a new referenced-state - `cadence-core/bin/lib/issue-decision.mjs`, `cadence-core/bin/issue-check.mjs`
- The tea call bound by `--remote origin`, with `classifyOrigin`'s login inference deleted - `cadence-core/bin/lib/issue-decision.mjs`, `cadence-core/bin/issue-check.mjs`
- Corrected host rule and `unresolved` rendering in the land prose - `skills/cad-land/SKILL.md`, `.planning/DOCS-CLAIMS.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | d54391f | Pin the wrapped-bullet prune, watched to FAIL |
| 1 | 2 | 71ec570 | Read the whole bullet span in both halves of archiveRequirements |
| 1 | 3 | 73ec9cc | Bound `## Active` with the fence-aware sectionSpan |
| 1 | 4 | 6417a94 | Escape a pipe before it reaches the Shipped table cell |
| 1 | 5 | b6005f7 | Pin the differing-host tracker resolution, watched to FAIL |
| 1 | 6 | f2d4d31 | Match a tea login by registrable domain, not host equality |
| 1 | 7 | c11cc8d | Forgejo open list plus a bounded per-issue resolve |
| 1 | 8 | 80e8c2b | State the shipped host rule in cad-land's prose |
| 1 | risk-fix 1 | 0d1c979 | Bind the tea query to the login that matched, not to config order |
| 1 | risk-fix 2 | cfc41a6 | Deny every ccTLD registry suffix, not just the anglophone few |
| 1 | cut 1 | 20b6bd5 | Delete classifyOrigin's login inference |
| 1 | cut 2 | fd42f87 | Bind the forgejo call with --remote origin |
| 1 | cut 3 | c5a2f57 | Pin the remote binding, delete the cover for the rule that went |
| 1 | cut 4 | ce58695 | cad-land states the login rule the seam actually has |

## Deviations

- [deviation] AC3 and task 4's Verify assert that every row under `## Shipped` in
  this repository's `REQUIREMENTS.md` carries exactly five unescaped pipes. Two
  pre-existing rows carry 7 (`CFG-01`) and 6 (`RVW-01`), and the plan forbids
  repairing them, so the criterion as worded is unachievable this phase. The
  corpus test asserts five pipes over every row the run ADDED and separately
  asserts every pre-existing row survives byte-identical, so the two scars are
  pinned as scars rather than exempted silently. (6417a94)
- [deviation] AC4 and CONTEXT D-07 assert the seam still skips, with no forge CLI
  call beyond the login probe, for a remote sharing no registrable domain with
  any login. The user's ruling deleted the registrable-domain rule as unfixable
  without a vendored public suffix list, so that criterion is no longer true and
  its test could not be kept. Replaced by the two properties that are true: an
  empty `tea login list` reading skips on the same line and queries nothing, and
  an origin no login names is handed to tea bound by `--remote origin` rather
  than by a login this seam picked. The five reason-unique verdicts are intact.
  (c5a2f57)

## Open items

Filed as issues #181-#187 on git.jcrenshaw.dev, no milestone assigned.

- #181 the per-issue resolve bound is per call, not per land
- #182 `normalizeNumber` accepts digit strings past the safe-integer range
- #183 the `## Shipped` heading is still located fence-blind
- #184 the corpus pipe-escape assertion is vacuous on today's corpus
- #185 the resolve cap is a fixed constant, and only the forgejo row resolves
- #186 the cad-land weight budget was re-pinned rather than the edit squeezed under it
- #187 AC6's walk needs a commit citing an issue number to read the sentence it describes

Not filed, recorded here:

- The residual risk of delegating to tea is ACCEPTED and written down, not
  guarded: for a remote whose host names no login, tea falls back to config
  order, answers exit 0 with a stranger's tracker, and says so only on stderr,
  which this seam discards by contract. The statement lives in `HOST_TABLE`'s
  header where the binding happens and it names the fix - a login whose
  `ssh_host` names the remote's host. This repository's login was corrected on
  2026-08-15, which is what makes `--remote origin` bind here for the right
  reason.
- The `no-login` reason line is now reachable only when `tea login list` reads as
  an empty array. A tea holding logins that serve none of this remote's hosts
  reports rather than skips - by design after the cut.
- `tea issues <index> --fields index,state` does not filter on the single-issue
  form and prints the whole issue including the body. Nothing of it reaches the
  envelope, so this is a wire-size observation, not a leak.
- Two Cadence frictions went to `.planning/CAPTURE.md`: `risk-check status`
  derives its plan list from lifecycle brackets while `risk-check run --plan`
  only accepts a number, and `risk-check status` matches a recorded range by the
  literal ref string rather than the resolved sha.

## Goal check

The phase goal is met on both halves, and the tracker half is proved live rather
than only in fixtures. Prune: `node --test cadence-core/bin/*.test.mjs` reports
1948 pass / 0 fail, and the milestone-prune suite grew from 22 to 27 arms
covering a wrapped-bullet fixture, a fenced `## Active` example and a corpus run
over this repository's own `ROADMAP.md` and `REQUIREMENTS.md`; each of tasks 1-4
recorded its predicted red-to-green transition in `reports/plan-1.md`. Tracker:
`node cadence-core/bin/issue-check.mjs check --dir /data/code/cadence --base main`
returns `action: report`, `host: ssh.jcrenshaw.dev`, `repo: crenshawdev/cadence`
and a complete 26-row open list, where the same command printed
`tea holds no login for ssh.jcrenshaw.dev` before this phase.
`node cadence-core/bin/self-verify.mjs` reports `ok:true` with no problems.

What is honestly missing. AC6 remains a human walk: the seam is proved but
`/cad-land`'s step 1 has not been read by a person, and because no commit on this
branch cites a `#N` the walk will see the open-list fallback rather than named
issues (#187). The route to the goal was not the planned one - the blocking
`risk_surface` gate FAILed twice on the login-matching surface tasks 6 and 8
built, and the surface was deleted rather than patched a third time, which is why
two of the plan's acceptance criteria are recorded above as deviations rather
than as met. The binding that replaced it is honest about what it does not know,
and the one machine-specific precondition it needs was made real here rather than
assumed.
