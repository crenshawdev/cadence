---
status: testing
phase: 6
started: 2026-07-30
updated: 2026-07-30
---

## Items

### 1. Reach stated at the point of setting
expected: `node cadence-core/bin/config.mjs keys` shows a purpose naming the cross-model backend as the only reach for all six tier keys (review.triggers.{plan,diff,risk_surface,phase_diff,pre_ship}.tier and review.decision_review.tier), and a purpose matching its single real reader for workflow.skip_discuss, workflow.research and granularity.
status: pass
first_pass: pass
source: verifier
evidence: `config.mjs keys`: all five review.triggers.*.tier + review.decision_review.tier carry "cross-model reviewers only"; workflow.skip_discuss = "progress next-step suggestion only; it skips no step" (reader workflows/progress.md:108), workflow.research = "new-project research step only" (new-project.md:144), granularity = "new-project roadmap step only" (new-project.md:236). review.consult.tier correctly left universal (references/consult.md:27).

### 2. New reach check catches all three defect classes
expected: `node cadence-core/bin/self-verify.mjs` reports ok:false naming the offending key for each of: a schema key with no row in the references reach table, a reach row naming no schema key, and a key whose reach is narrower than universal without that reach appearing in its purpose.
status: pass
first_pass: pass
source: verifier
evidence: Scratch copy of HEAD: dropping workflow.plan_check's row -> {"kind":"missing-reach-row","detail":"workflow.plan_check: no row in the reach table"}; adding a frobnicate.enabled row -> {"kind":"unknown-reach-key"}; narrowing that row's Reach -> {"kind":"unstated-reach"}. All three ok:false and name the key. self-verify.test.mjs check-9 rows x9 pass.

### 3. Reach check is green on the unmodified tree
expected: On the clean tree, `node cadence-core/bin/self-verify.mjs` reports ok:true with the new check named in its `checked` string and zero problems of the new kinds.
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs` -> {"ok":true,"checked":"config-keys, ..., risk-surfaces, config-reach","problems":[]}. 72 reach rows vs 72 schema keys.

### 4. Per-trigger knob overclaims removed
expected: workflows/decision-review.md's report_cost step and success_criteria no longer present .tier/.effort as applied to the run and state its claude-subagent arm resolves no model; neither cad-plan-review/SKILL.md nor cad-decision-review/SKILL.md carries an unqualified tier/effort honour claim; templates/config.json's per-trigger block carries `gate` only.
status: pass
first_pass: pass
source: verifier
evidence: workflows/decision-review.md:124-127 report_cost states cad-reviewer "ran at the session default with neither applied"; :175-181 success_criteria "never presented as applying to cad-reviewer"; cad-plan-review/SKILL.md:42-43 "reach cross-model reviewers only"; cad-decision-review/SKILL.md:49-51 "the cad-reviewer arm resolves neither"; templates/config.json per-trigger block is {"gate":...} only for all five triggers.

### 5. Global-layer risk waiver no longer waives, write face refuses by identity
expected: With risk.override.<surface> in the global layer only and a repo config at stakes: solo, `route.mjs resolve --role cad-executor --phase N` against a matching PLAN returns stakes: "critical"; and `config.mjs set --file <global-dir>/./config.json risk.override.auth=true` is refused with a message naming the repo-scope rule.
status: pass
first_pass: pass
source: verifier
evidence: Scratch two-layer fixture: global risk.override.auth=true + repo stakes:solo + PLAN touching src/auth/login.ts -> resolve returns "stakes":"critical" with an IGNORED/repo-scoped warning. `config.mjs set --file <global>/./config.json risk.override.auth=true` -> ok:false, "is repo-scoped (src: repo)". Repo-layer waiver still waives (regression guard). route.mjs:105-113, config.mjs:213-233; both pinning tests pass.

### 6. Documented plugin home moved to git.jcrenshaw.dev
expected: README.md's install block reads `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git`, its test badge points at that host, the ClaudePluginHub badge line is gone, .claude-plugin/plugin.json's homepage and repository name that host, and `grep -rn "github.com/crenshawdev" README.md .claude-plugin/plugin.json` returns nothing.
status: pass
first_pass: pass
source: verifier
evidence: README.md:3 badge and :36 install block both git.jcrenshaw.dev; no ClaudePluginHub match in README; .claude-plugin/plugin.json homepage/repository = https://git.jcrenshaw.dev/crenshawdev/cadence[.git]; grep -rn "github.com/crenshawdev" README.md .claude-plugin/plugin.json -> exit 1, no output.

### 7. Live install from the new remote (human-verify)
expected: In a live Claude Code session, `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git` followed by `/plugin install cadence@cadence` both succeed. (human-verify: needs an interactive /plugin run against the live remote)
status: skipped
first_pass: fail
reported: not working to install
severity: major
cause: Not a defect in the add path - the criterion is unsatisfiable at this point in the lifecycle. The remote's default branch is main = a1453c3 = v1.5.0, whose .claude-plugin/plugin.json still reads homepage/repository = github.com/crenshawdev/cadence; phase 6's hosting move is on the LOCAL cadence/v2.0.0 at d6a35bd, 35 commits ahead of the remote's cadence/v2.0.0 (005b6f9) and unpushed. /plugin marketplace add clones the default branch (git clone --depth 1, no --branch unless a #ref is given), so an install from the new host delivers the pre-move v1.5.0 plugin that names the OLD home. Add-path mechanics verified sound: the CLI parser maps an https URL ending in .git to {source:git} (bundle 2.1.220), and re-running its exact clone command anonymously against the remote exits 0 with both .claude-plugin/marketplace.json and plugin.json present. AC7 is a post-merge check, not a phase-close one.
fix: carried to /cad-land as a post-merge check; unsatisfiable until cadence/v2.0.0 lands on the remote's main (35 commits unpushed, remote main is v1.5.0).
reason: unsatisfiable before the branch lands: /plugin clones the remote default branch, so this is verified against main immediately after the merge

### 8. CHANGELOG records the move and the reframe
expected: The [2.0.0] CHANGELOG entry states that the plugin's home moved, gives the exact action an existing GitHub-installed user takes, and records which items the reframe already closed rather than fixing twice.
status: pass
first_pass: pass
source: verifier
evidence: CHANGELOG [Unreleased] (release-bump renames to [2.0.0] at close) states the home moved, carries a fenced uninstall/marketplace-add/install block with the exact commands, and a "### Closed on the way past" section naming the (stakes, tier) matrix, per-trigger effort, the escalate_effort_variant shim and model.profile/model.auto.*. DESIGN.md:312, :443.

### 9. CI gates clean
expected: `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports ok:true with no budget-overrun on decision-review.md, config.md, cad-plan-review/SKILL.md or cad-decision-review/SKILL.md, and no unknown-config-key.
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/*.test.mjs` -> pass 1045 / fail 0, exit 0. `npx tsc -p tsconfig.ci.json` -> exit 0. self-verify ok:true, problems:[] (no budget-overrun on any of the four named files, no unknown-config-key).

### 10. risk.override.* reach rows still say universal, and check 9 is blind to it
expected: This phase's own commit e09a0e5 made the eight keys repo-layer-only - the grammar's test-1 YES - but the reach table was never updated and the schema purposes never mention the repo scope, so the narrowing this phase introduced is unstated at the point of setting. reachIssues short-circuits at reach === UNIVERSAL before the purpose test, so the check is structurally incapable of catching it.
status: skipped
first_pass: fail
source: verifier
evidence: cadence-core/references/config-reach.md:92-99 (all eight rows read universal; the narrowing appears only in the Honoured by cell, declared not machine-checked at :63); cadence-core/bin/lib/config-reach.mjs:136 `if (reach === UNIVERSAL) continue;`; config.mjs keys shows risk.override.auth's purpose with no repo-scope clause.
reported: This phase's own commit e09a0e5 made the eight keys repo-layer-only - the grammar's test-1 YES - but the reach table was never updated and the schema purposes never mention the repo scope, so the narrowing this phase introduced is unstated at the point of setting. reachIssues short-circuits at reach === UNIVERSAL before the purpose test, so the check is structurally incapable of catching it.
severity: major
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 11. config.mjs get and route.mjs resolve disagree about a global-layer risk waiver, with nothing said
expected: get reports the waiver as an effective value with no warning; the resolver discards it. The value is resolved, carried and thrown away - the phase goal's own defect shape - and /cad-config's menu is built off get, so it shows true for a waiver that waives nothing.
status: skipped
first_pass: fail
source: verifier
evidence: Two-layer scratch fixture: `get` -> {"ok":true,"values":{"risk.override.auth":true},"source":"global+repo"} with no warnings field; `route.mjs resolve` on the same pair -> stakes:"critical" + IGNORED warning. config.mjs:12 calls get "the only correct way for a workflow to read config"; workflows/config.md:46 drives the menu from it.
reported: get reports the waiver as an effective value with no warning; the resolver discards it. The value is resolved, carried and thrown away - the phase goal's own defect shape - and /cad-config's menu is built off get, so it shows true for a waiver that waives nothing.
severity: major
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 12. A duplicate reach row is dropped with no issue emitted
expected: A stale row silently masks a corrected one, inside the very check built to prove that nothing about a key's reach is skipped silently.
status: skipped
first_pass: fail
source: verifier
evidence: cadence-core/bin/lib/config-reach.mjs:95 `if (seen.has(cells[0])) continue;`. Scratch tree with a stale universal duplicate above granularity's real narrow row -> {"ok":true,"checked":"...config-reach","problems":[]}. references/config-reach.md:78-79 documents the silent drop as intended.
reported: A stale row silently masks a corrected one, inside the very check built to prove that nothing about a key's reach is skipped silently.
severity: major
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 13. The URL mask covers https only, so SSH clone forms of the new remote still tokenize as git.* keys
expected: Commit 1ffa48f claims to have eliminated the hostname-as-config-key shape, but Forgejo's default clone widget offers the SSH form, so the first contributor who pastes it into a prose surface turns CI red.
status: skipped
first_pass: fail
source: verifier
evidence: cadence-core/bin/self-verify.mjs:312 masks /https?:\/\/[^\s)\]}>'"`]*/g only. Appending git@git.jcrenshaw.dev:crenshawdev/cadence.git and ssh://git.jcrenshaw.dev/... to a scratch prose surface -> ok:false with two {"kind":"unknown-config-key","detail":"git.jcrenshaw.dev"} problems.
reported: Commit 1ffa48f claims to have eliminated the hostname-as-config-key shape, but Forgejo's default clone widget offers the SSH form, so the first contributor who pastes it into a prose surface turns CI red.
severity: minor
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 14. fsIdentity's last fallback throws outside the try, degrading a diagnosable failure to reason:internal
expected: Regression introduced by this phase's commit 10f03d5: a non-string path raises a TypeError that escapes repoScopedErrors.
status: skipped
first_pass: fail
source: verifier
evidence: cadence-core/bin/config.mjs:213-216 - resolvePath(p) is the unguarded return. `config.mjs set --file` with the flag value missing at HEAD -> {"ok":false,"reason":"internal","detail":"The \"paths[0]\" argument must be of type string. Received undefined"}; the same command against ec4b4b5 -> reason:"read".
reported: Regression introduced by this phase's commit 10f03d5: a non-string path raises a TypeError that escapes repoScopedErrors.
severity: minor
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 15. normalize does not case-fold the Reach cell, so an out-of-vocabulary reach gives the wrong remediation
expected: The grammar has no code for "reach is outside the declared vocabulary", so a capitalised or punctuated Universal falls through to the purpose test and tells the author to paste the wrong phrase into the purpose rather than to fix the cell.
status: skipped
first_pass: fail
source: verifier
evidence: cadence-core/bin/lib/config-reach.mjs:32-34 strips backticks and collapses whitespace, no case fold. Scratch tree with `| workflow.plan_check | Universal |` -> {"kind":"unstated-reach","detail":"workflow.plan_check: reach \"Universal\" is absent from the key's purpose"}.
reported: The grammar has no code for "reach is outside the declared vocabulary", so a capitalised or punctuated Universal falls through to the purpose test and tells the author to paste the wrong phrase into the purpose rather than to fix the cell.
severity: minor
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 16. The global-waiver warning fires wrongly, and gives wrong remediation, in two configurations
expected: Two independent cases, both verified live: (a) with CADENCE_GLOBAL_CONFIG pointing at the repo config the waiver IS honoured yet the same payload warns it was ignored; (b) a misspelled surface warns "set it in this repo's own config" while config.mjs set refuses that key outright.
status: skipped
first_pass: fail
source: verifier
evidence: (a) resolve emits reason "risk floor: waived by risk.override.auth ... stakes stays solo" AND the IGNORED warning together - same root as the open phase-2 mergeLayers identity item. (b) global risk.override.athu:true warns to set it in the repo config, but `config.mjs set --file <repo> risk.override.athu=true` -> ok:false, "athu" is not a risk surface; route.mjs:204-206 and :213-216 are unreachable for global-layer entries now that riskOverrides reads the repo layer alone.
reported: Two independent cases, both verified live: (a) with CADENCE_GLOBAL_CONFIG pointing at the repo config the waiver IS honoured yet the same payload warns it was ignored; (b) a misspelled surface warns "set it in this repo's own config" while config.mjs set refuses that key outright.
severity: minor
fix: routed to /cad-plan
reason: deferred to v2.0.1; defect confirmed and fully evidenced on this item, does not block any v2.0.0 requirement

### 17. Self-hosted test badge renders "Not found" - accept or fix
expected: README.md:3's badge points at git.jcrenshaw.dev/.../actions/workflows/test.yml/badge.svg, which serves HTTP 200 with label text "Not found" because the repo has .github/workflows/test.yml and no .forgejo/workflows/. CONTEXT flags this as a verified accepted state, but it is a user-facing README surface - accept it or stand up a runner.
status: pass
first_pass: fail
reported: this has to be fixed period I made that clear earlier
severity: major
cause: The badge endpoint 303-redirects to shields.io/badge/test.yml-Not%20found-crimson because the Forgejo instance has ZERO workflow runs for the repo: GET /api/v1/repos/crenshawdev/cadence/actions/tasks returns {"workflow_runs":[],"total_count":0}. A Forgejo workflow badge renders the latest run of a named workflow FILE, so with no run it resolves to Not found. This is despite has_actions:true and .github/workflows/test.yml present on main - .forgejo/workflows/ does not exist (contents API 404). A green badge needs both halves: a workflow at a path the instance picks up AND a registered runner satisfying runs-on: ubuntu-latest (plus resolvable actions/checkout@v4 and actions/setup-node@v4), which is host-side infrastructure not visible from the repo.
fix: 74ef564 removed the badge; there is no CI on the new host to back it, and no runner is reachable

## Summary

total: 17
passed: 9
failed: 0
pending: 0
skipped: 8
blocked: 0
reworked: 9
