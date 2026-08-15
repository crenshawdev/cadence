---
phase: 1
status: complete
completed: 2026-08-15
---

# Phase 1: The tracker enters the spine - Summary

`/cad-land` step 1 now reads the issue tracker: a pure decision core plus a
bounded, PATH-resolved seam over `gh` / `glab` / `tea` that names the issues
this branch's commits reference and whether each is open, and degrades to
exactly one line - nine distinct reasons - on every path that cannot answer.

## What shipped

- The pure decision core - `cadence-core/bin/lib/issue-decision.mjs`: host
  classifier over both URL shapes (five verdicts, `no-login` distinct from
  `unrecognized`), a `#N` / `closes #N` / `fixes #N` commit scanner, an
  open/closed/not-found partition that answers only over a fetch the normalizer
  reports complete, and `decideIssueCheck` returning `query | skip | off`.
- The frozen per-host table in the same file - one bounded call per land per
  host, each argv carrying its paging flag (`gh` 200, `glab` 100, `tea` 100).
- The seam - `cadence-core/bin/issue-check.mjs`: one `check` subcommand, exit 0
  always, one JSON line, a 10s `SIGKILL`-backed bound, and the forge call bound
  to the repo two ways (`cwd: dir` plus the explicit `owner/name` selector).
- The wiring - `skills/cad-land/SKILL.md` step 1, before any publish ask, on
  both step-3 arms, branching on `action` alone and never writing to a tracker.
- The config key - `git.issue_check` (default `true`) in the schema, the
  template, the catalog, the reach table, `references/COMMANDS.md`, `README.md`
  and `.planning/DOCS-CLAIMS.md`, with `self-verify.mjs` clean.
- 33 new tests over temp repos and PATH-injected `gh`/`glab`/`tea` stubs,
  including all nine degradation paths and a `glab` arm proved with no `glab`
  process spawned.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 97cf861 | Register `git.issue_check` as a config key (schema, template, catalog row, reach row, three weight budgets re-pinned) |
| 1 | 2 | 0053735 | The pure issue-decision core + 15 tests; `gh`/`tea` rows confirmed against installed `--help`, `glab` against published docs |
| 1 | 3 | 51e1299 | The `issue-check` seam, bounded and PATH-resolved, + 7 tests over temp repos and stub binaries |
| 1 | 4 | 22fc54b | Wire the tracker report into `/cad-land` step 1 |
| 1 | 5 | 8f5251e | Fault-inject every degradation path: 11 cases, each reason unique across the matrix |
| 1 | 6 | 9fec27f | Register the key and the check on the public surfaces (COMMANDS, README, 6 ledger rows) |
| 1 | 6 | 149d807 | Move the two tree-wide count pins this phase moved (authorized out-of-lease edit) |
| 1 | fix 1 | 64417f4 | `risk_surface` blocker: keep third-party stderr off the envelope entirely |
| 1 | fix 2 | b9a1f26 | `risk_surface` blocker: the `issue_check` off switch prints nothing, as its own `off` action |
| 1 | fix 3 | ada2659 | `risk_surface` blocker: reject a control character in the parsed origin hostname |

## Reviews

`risk_surface` fired once on the completed range `7b1466b..149d807` (blocking,
`untrusted_input` + `api_contract` matched; voice openai/gpt-5.6-sol). Four
findings raised, three survived adjudication as blocker/high and were fixed in
64417f4, b9a1f26 and ada2659. The one narrowed re-arm round over the fix diff
returned zero findings, so the gate passes; the settled empty list is
`.planning/phases/1/REVIEW-risk_surface-execute-ada2659.md`. The killed fourth
finding is the first open item below. The `diff` trigger is `off` at `shipped`
and did not fire.

## Deviations

- [deviation] The plan's `files:` lease was wrong: task 1's new config key and
  task 3's new `mergeLayers(` callsite each move a tree-wide count pin in
  `cadence-core/bin/self-verify.test.mjs`, which the lease never named, so task
  6's `test.mjs prose` could not pass from inside it. Returned as a `structural`
  checkpoint, authorized by the user scoped to exactly two pins (the all-keys
  fixture at :315, and 11 -> 12 / 8 -> 9 at :1591-1592), committed alone as
  149d807. `lease-check` was run and reported `undeclared-files`; the commit
  proceeded on explicit approval rather than by widening the lease, and PLAN.md
  was not edited.
- [deviation] The plan's task 2 fixed the core's `action` at `query | skip`, and
  its task 5 asked for an envelope containing `<redacted>`. The blocking review
  falsified both. Two actions cannot express both "print this line" and "print
  nothing", which the plan's own `Must be true` demands of
  `git.issue_check: false`, so the core answers `query | skip | off` (b9a1f26).
  And `redactUrl` redacts credentials in URL position only, so
  `Authorization: Bearer ...`, `*_TOKEN=...` and `glpat-...` passed through it
  intact; the stderr is now dropped rather than redacted a second way, and the
  test asserts four token shapes appear nowhere in the envelope (64417f4).

## Open items

- A tracker whose list call is filtered by the caller's permissions reports a
  referenced-but-invisible issue as `not-found`. No list call can separate
  "absent" from "invisible", so the remedy is wording, not a completeness check
  - the line should say the issue is not among the ones this login can see.
  (Raised by the `risk_surface` review, adjudicated down from high.)
- `cadence-core/bin/self-verify.test.mjs` belongs in the `files:` lease of any
  plan that adds a config key or a `mergeLayers` callsite - the lesson is wider
  than this phase.
- The check-12 test's name and comment still read "ELEVEN callsites over EIGHT
  files", stale against the 12/9 assertions below them. Deliberately left alone
  under the scoped authorization; a one-line rename when the file is next leased.
- `tea` clamps a page at 50 server-side (measured 2026-08-15: `--limit 100` and
  `--limit 200` both returned 50), so a Forgejo/Gitea repo with 50+ issues
  degrades to the truncation line rather than reporting. Answering it needs
  paging, which is more than the plan's one bounded call.
- This repo's own origin is `ssh://git@ssh.jcrenshaw.dev:2222/...` while
  `tea login list` names `git.jcrenshaw.dev`, so a live run here prints the
  no-login line. Worth knowing before the `/cad-verify` UAT walk.
- No ledger row for the new `off` action, and `DOCS-CLAIMS.md`'s other rows were
  not swept for line drift (both cad-land rows were re-anchored). One-line adds
  when the ledger is next leased.
- The seam no longer surfaces a failing forge CLI's diagnostic anywhere: a
  misconfigured `gh` yields "gh exited nonzero: no tracker report" and the user
  must run `gh` themselves. Deliberate - the alternative is third-party bytes on
  a line `/cad-land` prints.
- Declined in-plan: a `--fields` title fetch for the open-issue fallback (the
  fallback lists numbers), and a first-DNS-label heuristic mapping
  `gitlab.example.com` to gitlab (self-hosted GitLab and GHE degrade to the
  unrecognized line instead).

## Goal check

The goal is delivered on its degradation half and proved-by-test on its
reporting half. `skills/cad-land/SKILL.md` step 1 now invokes
`issue-check.mjs check --dir <root> --base <base>` before any publish ask and
branches on `action` alone (22fc54b), the core answers the referenced numbers
and their open/closed/not-found states (`lib/issue-decision.mjs`, 0053735), and
the whole suite is green at 1833/1833 with `self-verify.mjs` reporting
`ok:true, problems:[]`. The one honest gap is that the happy path has never run
against a live tracker in this repository: run here, the seam returns
`{"action":"skip","reason":"tea holds no login for ssh.jcrenshaw.dev: no tracker
report","host":"ssh.jcrenshaw.dev","repo":"crenshawdev/cadence","detail":null}`,
because the origin's ssh hostname differs from the host `tea login list` names,
and even with that fixed this repo's 171 issues exceed `tea`'s server-side
50-row clamp and would degrade to the truncation line. So every path a user of
THIS repo reaches is a one-line degradation working exactly as specified, and
the reporting path rests on the stub-driven tests plus `gh`/`tea` argv confirmed
against their installed `--help`. That is what the plan asked for (criterion 1
explicitly wants a failing-capable test over a fabricated log, not a live run),
but it is the claim `/cad-verify` should press on hardest.
