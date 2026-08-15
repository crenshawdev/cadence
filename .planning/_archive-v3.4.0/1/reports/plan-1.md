PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 9 of 9 (6 planned tasks, already committed; 3 blocking-review fixes)
| Task | Commit | Note |
|---|---|---|
| 1. Register `git.issue_check` as a config key | 97cf861 | schema + template + catalog row + reach row; three weight budgets re-pinned (config-catalog 8824, config-reach 17232, templates/config.json 1344 - the reach file is budgeted too and the plan named only two) |
| 2. The pure issue-decision core | 0053735 | `lib/issue-decision.mjs` + 15 tests; gh and tea rows confirmed against installed `--help` and live samples, glab against gitlab-org/cli docs; 8 distinct reasons (the 7 named plus the ref-scan failure task 5 requires) |
| 3. The `issue-check` seam, bounded and PATH-resolved | 51e1299 | seam + 7 tests over real temp repos and PATH-injected `gh`/`glab`/`tea` stubs; CONTRACTS row and `test.mjs` git-group stems added; the core gained a 9th reason so a killed call does not report as a nonzero exit |
| 4. Wire the report into `/cad-land` step 1 | 22fc54b | ~16 lines in step 1 above the step-3 arm split; one invocation line, both actions stated, the never-closes-an-issue sentence; SKILL.md re-pinned at 12141 |
| 5. Fault-inject every degradation path | 8f5251e | 11 new cases: the 9 named paths each with exit 0, ok:true, an empty list and a reason unique across the matrix, plus the key-off spawn-marker assertion (with an on-control) and the redacted-credential case; no seam or core fix was needed |
| 6. Register the key and the check on the public surfaces | 9fec27f, 149d807 | COMMANDS row, both README sites, 6 ledger rows, COMMANDS.md re-pinned at 5058 (9fec27f). The `test.mjs prose` half of the Verify needed the two out-of-lease count pins the earlier checkpoint named, authorized by the user and committed separately (149d807); Verify now fully met - see Deviations |
| fix 1. `risk_surface` blocker: forge stderr on the envelope | 64417f4 | `run()` discards the child's stderr (`stdio` stderr `ignore`, so it cannot reach the terminal either) and `skip()` emits `detail: null` on every arm; the two callsites that carried `log.stderr` / `call.stderr` now carry nothing. Test rewritten to assert four token SHAPES (URL userinfo, `*_TOKEN=`, `glpat-`, `Authorization: Bearer`) appear nowhere in the whole envelope, plus `detail === null` on all 9 degradation rows |
| fix 2. `risk_surface` blocker: the off switch still printed a tracker line | b9a1f26 | Fixed in the CORE, not the SKILL branch: `decideIssueCheck` answers a third action `off` for the key-off arm (reason string unchanged), the seam passes `decision.action` through, and SKILL.md step 1 gains an `off` arm that prints nothing. SKILL.md re-pinned 12141 -> 12268; `CAD-LAND-01/02` line refs re-anchored |
| fix 3. `risk_surface` blocker: a control character in the hostname | ada2659 | `splitOrigin` rejects (never strips) a hostname matching `NOT_ONE_LINE` - C0, DEL, C1, U+2028/9 - so the origin reads as unrecognized with `host:null`. Test covers schemed, schemed-and-ported and scp shapes x 6 hostile characters, asserting the reason is one line and carries no injected text; falsified against the unfixed core (1 fail) before the fix |

VERIFY, task 6, all four parts met after 149d807:
- `node cadence-core/bin/test.mjs prose` - 225/225 pass, 0 fail (was 223/225).
- `node cadence-core/bin/self-verify.mjs` - `ok:true`, 21 checks, `problems:[]`.
- `grep -c issue_check` - README.md 2, config-catalog.md 1, DOCS-CLAIMS.md 4,
  COMMANDS.md 1.
- `grep -n 'cad-land' cadence-core/references/COMMANDS.md` - line 40 names both
  the tracker report and `git.issue_check: false` as the switch.

Whole-tree state after the continuation: `node cadence-core/bin/test.mjs` is
1832/1832, 0 fail (was 1830/1832). Static analysis before the commit:
`detect-commands` reports `lint: null` (no lint command Cadence can find - said
once, skipped) and `typecheck: npx tsc -p tsconfig.ci.json`, which exits 0.

Deviations:
- [deviation] The plan's `files:` lease asserted that phase 1's work fits inside
  15 declared paths. That is wrong: task 1's new config key and task 3's new
  `mergeLayers(` callsite each move a tree-wide COUNT PIN in
  `cadence-core/bin/self-verify.test.mjs`, which the lease never named, so task
  6's `node cadence-core/bin/test.mjs prose` could not pass from inside the
  lease. The prior dispatch stopped on that as a `structural` checkpoint. The
  user authorized the edit, scoped to exactly two pins: `` `git.issue_check` ``
  added to the all-keys prose fixture beside `` `git.on_land_cleanup` ``
  (self-verify.test.mjs:315), and `assert.equal(total, 11, ...)` ->
  12 with `assert.equal(files.length, 8, ...)` -> 9
  (self-verify.test.mjs:1591-1592). Nothing else in that file changed - the diff
  is 3 lines, `git diff --stat` 3 insertions / 3 deletions. `lease-check --phase
  1 --plan 1` was run against the staged file and returned
  `{"ok":false,"reason":"undeclared-files","undeclared":["cadence-core/bin/self-verify.test.mjs"]}`;
  the commit proceeded on the user's explicit approval rather than by widening
  the lease, and PLAN.md was NOT edited. Committed alone as 149d807.

Open items:
- `cadence-core/bin/self-verify.test.mjs` is missing from the plan's `files:`
  lease. Any phase that adds a config key or a `mergeLayers` callsite moves the
  two pins in it, so the plan-authoring lesson is wider than this phase: those
  two pins belong in the lease of any plan that touches either surface.
- The check-12 test's NAME and its comment still read "ELEVEN callsites over
  EIGHT files" and "a twelfth callsite cannot be added", now stale against the
  12/9 assertions below them. The authorization was scoped to the two count pins
  and said nothing else in the file may change, so the prose was left alone
  deliberately. It is a one-line rename whenever the file is next in a lease.
- Declined a `--fields`-style title fetch for the open-issue fallback: the plan
  fixes each row's argv to number and state, so the fallback list is numbers.
  Titles would make the fallback readable and cost one more field per row.
- Declined a first-DNS-label heuristic (`gitlab.example.com` -> gitlab) in
  `classifyOrigin`: a self-hosted GitLab or GitHub Enterprise host degrades to
  the one-line unrecognized reason instead. The `Verify:` asks only for
  `github.com`/`gitlab.com`, and a hostname-guessing rule is one this file has
  no way to be right about; make it a table when a task names the shape.
- `tea` clamps a page at 50 server-side (measured live, 2026-08-15: `--limit
  100` and `--limit 200` both returned 50). A Forgejo/Gitea repo whose
  `--state all` list reaches 50 issues therefore degrades to the
  page-may-be-truncated line rather than reporting - including THIS repo, at
  171 issues. Answering it needs paging, which is more than the plan's ONE
  bounded call.
- This repo's own live run degrades for a second, independent reason: `origin`
  is `ssh://git@ssh.jcrenshaw.dev:2222/...` while `tea login list` names
  `git.jcrenshaw.dev`, so the host holds no matching login and step 1 will print
  the no-login line. Worth knowing before the `/cad-verify` UAT walk.

--- FIX ROUND (blocking `risk_surface` review of 97cf861..149d807) ---

Source: `.planning/phases/1/REVIEW-risk_surface-execute-149d807.md`, three
adjudicated blocker/high survivors, fixed in the order the dispatch named them.
Scope was those three findings and nothing else: no refactor, no extra
hardening, no new config key.

State after ada2659:
- `node cadence-core/bin/test.mjs` - 1833/1833 pass, 0 fail (was 1832).
- `node cadence-core/bin/test.mjs prose` - 225/225 pass, 0 fail.
- `node cadence-core/bin/self-verify.mjs` - `ok:true`, `problems:[]`.
- `detect-commands`: `lint: null` (none Cadence can find - said once, skipped),
  `typecheck: npx tsc -p tsconfig.ci.json`, which exits 0.
- Weight budget moved by these fixes and re-pinned: `skills/cad-land/SKILL.md`
  12141 -> 12268. No other budgeted file changed size.

Finding 2, the site chosen and why: the CORE, not the SKILL branch. A `skip` is
a degradation and its `reason` is the line step 1 prints; the key set to false
is the user's own instruction and must print nothing. Leaving it a `skip` forces
the caller either to print a tracker line on every land or to pattern-match a
reason STRING to suppress one, which makes a future rewording a silent
regression. So `decideIssueCheck` answers a third action, `off`, the seam passes
`decision.action` through unchanged, and SKILL.md branches on it. The off
reason STRING is untouched and every other skip reason is byte-identical - the
reason still rides the JSON for anyone reading the envelope, and nobody prints
it. `.planning/DOCS-CLAIMS.md`'s CAD-LAND-01 (the skip arm) stays accurate as
written.

Fix-round deviations:
- [deviation] The plan's task 2 states the core's `action` is "one of `query` or
  `skip`", and its task 5 Verify asks for a case "whose envelope contains
  `<redacted>`". Both turned out wrong against the review's blockers. (a) Two
  actions cannot express both "print this line" and "print nothing", which is
  what the plan's own `Must be true` demands of `git.issue_check: false`, so the
  core now returns `query | skip | off`. (b) The `<redacted>` assertion presumes
  the stderr belongs on the envelope; `redactUrl` redacts credentials in URL
  POSITION only, so `Authorization: Bearer ...`, `*_TOKEN=...` and `glpat-...`
  passed through it intact. The stderr is dropped instead of redacted a second
  way, and the test now asserts the stronger property - four token shapes appear
  nowhere in the envelope, and `detail` is null on all nine degradation rows.

Fix-round open items:
- `.planning/DOCS-CLAIMS.md` CAD-LAND-02's line reference was already off by
  three lines before this round (it cited 50-51 for a claim then at 53-54). Both
  cad-land rows are re-anchored to where the claims now sit (32-54, 56-57), but
  no sweep of the other rows' line numbers was done - out of scope here, worth a
  pass whenever the ledger is next in a lease.
- No ledger row was added for the new `off` action: CONFIG-CATALOG-13 already
  claims `false` "says nothing about the tracker and runs no forge CLI", which
  this round makes true rather than aspirational, and CAD-LAND-01's skip-arm
  claim is unchanged. A dedicated SKILL row for the `off` arm is a one-line add
  whenever the ledger is next in a lease.
- The seam no longer surfaces a failing forge CLI's own diagnostic anywhere, so
  a user whose `gh` is misconfigured gets "gh exited nonzero: no tracker report"
  and must run `gh` themselves to see why. That is the deliberate trade: the
  reason names the degradation, and the alternative is third-party bytes on a
  line /cad-land prints. If a diagnostic is ever wanted back, it needs a
  redactor built for CLI output rather than for URLs.
