# Phase 5 - `/cad-docs-verify` run 1

Swept: 2026-08-09, at `a6b8931` on `cadence/v2.6.0`.

Surface: 25 files, 268,992 B - `README.md`, `METHOD.md`, `INTERNALS.md`,
`CONTRIBUTING.md` and all 21 `cadence-core/workflows/*.md`.

**547 claims: 509 accurate, 18 stale, 20 unverifiable.**

That total is counted from the table ROWS, not from the three per-group headline
lines below, which sum to 480/18/20. The stale and unverifiable halves agree
exactly; the accurate half does not, because each group's headline undercounted
its own table by a few rows. The rows are the record - the ledger transcribes
rows, and any count derived from a headline is derived from the wrong thing.

Three invocations over an explicit path list, because `docs-verify.md`'s default
target set (`README.md` plus `docs/**`) misses `cadence-core/workflows/` entirely
and pulls in `docs/WORKFLOW.md`, which this surface does not name (D-01). The
default is deliberately left unchanged: `cadence-core/workflows/` is a
Cadence-only path and a generic default naming it would be wrong prose in the
shipped plugin for every other project.

Run verbatim, so the next cycle re-runs them unchanged:

1. `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`
2. `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`
3. `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`

Two constraints the sweep ran under:

- `CONTRIBUTING.md` was swept by hand end to end because no mechanical check
  covers it - `cadence-core/bin/self-verify.mjs:303` lints only `README.md`,
  `INTERNALS.md` and `METHOD.md` (D-15).
- `CONTRIBUTING.md:13`'s "the same three checks CI runs" is verified accurate
  against `.github/workflows/test.yml` rather than left unverifiable: that
  workflow still executes, with `origin` self-hosted and GitHub a mirror (D-14).
  The adjacent "no dependencies / no `npm install`" claim is judged on its own
  merits and is reported below.

A search hazard applied throughout: `cadence-core/bin/lib/trace.mjs` carries two
literal NUL bytes at `:336`, so `grep`/`rg` over `cadence-core/bin/**` silently
skips that whole file without `-a`. Every group ran its searches with `-a`.

---

## Group 1 - root docs

`162 accurate, 8 stale, 15 unverifiable`

### README.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| An OpenAI, Gemini **or DeepSeek** key runs the identical review job "with the provider enforcing the output schema". | README.md:36 | stale | True for OpenAI (`text.format` json_schema) and Gemini (`responseSchema`), false for DeepSeek: its only structured mode is `response_format:{type:"json_object"}` with no server-side schema, so `cadence-core/bin/review-provider.mjs:682-712` injects the schema into the system prompt and asserts the shape on return. |
| `docs/WORKFLOW.md` is "six figures and the three tables behind them". | README.md:38 | stale | Six figures is right (6 files in `docs/figures/`, 6 embeds); the file carries **four** markdown tables - decision points (:37), the rung ladder (:85), the role/cell grid (:105), the trigger grid (:164). README:76 enumerates only three of them. |
| Install adds marketplace `https://git.jcrenshaw.dev/crenshawdev/cadence.git` then `/plugin install cadence@cadence`. | README.md:10-11 | accurate | |
| Runtime scripts are zero-dependency; "there is no npm install, ever". | README.md:14 | accurate | No non-`node:` import exists anywhere under `cadence-core/bin/`. |
| All durable state lives in `.planning/` and git, incl. a four-line state cursor. | README.md:26 | accurate | `cadence-core/references/conventions.md:94`. |
| Verifier scores every claim verified/failed/uncertain and uncertain counts toward neither side. | README.md:28 | accurate | |
| The coverage audit reads assertions rather than counting test files. | README.md:28 | accurate | `cadence-core/workflows/coverage.md:6`. |
| The git rails are a PreToolUse hook and every push stops and asks. | README.md:30 | accurate | `hooks/hooks.json` + `git-guard.mjs:206`. |
| `isPlainPush` was deleted; the sanctioned push runs in a separate subprocess built from an argument vector. | README.md:32 | accurate | No code occurrence remains; `git-publish.mjs` uses `execFileSync` argv. |
| What the guard reads now is eighty-five lines; a command counts if it starts with the word `git`. | README.md:34 | accurate | `git-segments.mjs` is exactly 85 lines. |
| v2.2.0 deleted 2,251 lines of tokenizer. | README.md:34 | accurate | `CHANGELOG.md:460`. |
| The hook fails open. | README.md:34 | accurate | `git-guard.mjs:218` `try { main(); } catch {}`. |
| `bash -c "git push"` is invisible and that is written down. | README.md:34 | accurate | `references/git-publish.md` rail 3 + pinned row `git-segments.test.mjs:69`. |
| Default reviewer is a fresh-context Claude subagent needing no API key. | README.md:36 | accurate | `review.reviewers` default `["claude-subagent"]`. |
| Up to four independent voices on one plan. | README.md:36 | accurate | `review.reviewers` enum has exactly 4 members. |
| Triage is a multi-select prompt with none as the default. | README.md:36 | accurate | `references/triage-gate.md:37,49`. |
| `/cad-config stakes=shipped` is the one key. | README.md:45 | accurate | `stakes` in schema; `workflows/config.md:21` direct-set path. |
| `solo` / `shipped` / `critical` are the three answers. | README.md:48 | accurate | |
| The grid is 18 cells, one per level+role pair, in `cadence-core/route-table.json`. | README.md:50 | accurate | 3 levels x 6 roles. |
| solo planner = Sonnet at `high`; shipped = Opus; critical = Opus `xhigh` with retry `max`. | README.md:50 | accurate | |
| Rungs are `low`, `medium`, `high`, `xhigh`, `max`. | README.md:52 | accurate | `rung_order`. |
| Effort is frozen in agent frontmatter; self-verify fails on a cell naming a rung with no file and on a rung file no cell reaches. | README.md:52 | accurate | `self-verify.mjs` check 8. |
| `model.escalate_on_failure`, on by default. | README.md:54 | accurate | schema default `true`. |
| Gates are `off`, `advisory`, `blocking`, `adjudicated`. | README.md:56 | accurate | |
| Plan review is advisory at `solo`, adjudicated at `shipped` and `critical`. | README.md:56 | accurate | |
| `risk_surface` is blocking at every level including `solo`. | README.md:56 | accurate | |
| The eight surfaces are auth, billing, secrets, migrations, destructive, concurrency, API contracts, untrusted input. | README.md:56 | accurate | |
| `risk.override.<surface>` waives one surface, repo config only; a global waiver is ignored and warned. | README.md:58 | accurate | 8 schema keys; `route.mjs` warnings. |
| Deep verification off at `solo`, on at `shipped` and `critical`. | README.md:60 | accurate | `verify` grid. |
| Commands are namespaced `/cadence:cad-*`. | README.md:64 | accurate | plugin name `cadence`. |
| The five loop commands exist as named. | README.md:66-70 | accurate | |
| `/cad-progress` auto-resumes incomplete work. | README.md:72 | accurate | `workflows/progress.md:6`. |
| `docs/figures/phase-loop.svg` exists. | README.md:74 | accurate | |
| WORKFLOW.md holds fifteen decision points, the eighteen-cell grid, and the trigger-by-level table. | README.md:76 | accurate | 15 rows at `docs/WORKFLOW.md:38-52`. |
| `/cad-new-project` writes PROJECT.md, REQUIREMENTS.md and a phased ROADMAP.md into `.planning/` and sets a cursor. | README.md:80 | accurate | |
| `/cad-verify` records in UAT.md. | README.md:88 | accurate | |
| `/cad-milestone` tags the release. | README.md:93 | accurate | `workflows/milestone.md:67` creates an annotated tag (unpushed). |
| `/cad-land` asks push / MR or PR / tag / leave local with no preselected default. | README.md:93,111 | accurate | `references/seams.md:37-40`. |
| Every command in the three command lists exists. | README.md:101-122 | accurate | All 23 resolve to `skills/<name>/SKILL.md`. |
| `/cad-config` walks every switch; `key=value` sets one directly. | README.md:117 | accurate | `workflows/config.md:21-22`. |
| Cadence ships no instrumentation and phones nothing home. | README.md:128 | accurate | Only provider API hosts appear in source. |
| GSD is 71 skills, 34 agents, 46 capabilities, ~1.1M words. | README.md:138 | accurate | `LINEAGE.md` table (1,113,812 words). |
| Cadence carries ~3% of GSD's documentary mass, measured 2026-07-10 against GSD `d010ea1`. | README.md:138 | accurate | `LINEAGE.md` provenance block. |
| Today it is 23 skills and 6 agent roles across 19 rung files. | README.md:138 | accurate | 29 skill dirs - 6 contracts = 23; `agents/` holds 19; `RUNG_FILES` names 6 roles. |
| CI fails the build when the prose drifts from the code. | README.md:140 | accurate | `self-verify` job in `.github/workflows/test.yml`. |
| MIT, original copyright in `LICENSE`, lineage in `NOTICE.md`. | README.md:142 | accurate | |
| The marketplace URL actually serves a plugin marketplace. | README.md:10 | unverifiable | Needs a network fetch; `plugin.json` homepage and the `origin` remote both point at that host. |
| Usage measurements: 7,548 requests / 2,845 Cadence, ~92k vs ~133k context, ~28c vs ~36c, 27% vs 8% Sonnet+Haiku. | README.md:128 | unverifiable | Personal account billing data, external to the repo. |
| v2.3.0 eager totals 231,422 -> 199,687 across "the twelve main commands"; `/cad-pause` 18,523 -> 8,197; `/cad-land` 36,235 -> 31,016. | README.md:132 | unverifiable | Historical v2.3.0 measurement. Current tree (2026-08-09): 23 user-invocable commands, 278,315 B eager total, `/cad-pause` 8,752, `/cad-land` 18,209. |
| Skill and agent descriptions went from 8,550 to 5,397 bytes. | README.md:132 | unverifiable | Same historical v2.3.0 measurement; the description surface is not weighed by `weight-budgets.json`. |
| Five of the twelve commands ended up slightly heavier. | README.md:134 | unverifiable | Historical per-phase record. |

### METHOD.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `phase_diff`'s gate at `shipped` is "off (opt-in)". | METHOD.md:276 | stale | `advisory`. `route-table.json` `review.shipped.phase_diff` and the `review.triggers.phase_diff.gate` schema default were both moved to `advisory` in commit `8814cc0`. (`references/review-triggers.md:244` and `docs/WORKFLOW.md:168` carry the same stale "off/off/adjudicated" row.) |
| "Four of the five fire on their own; `phase_diff` ships off." | METHOD.md:279 | stale | It ships **off only at `solo`**; advisory at `shipped` (the default level) and adjudicated at `critical`. All five now fire on their own at the default level, `phase_diff` only on the parallel path. |
| The plan checker "checks five dimensions - requirement coverage, task completeness, sequencing, goal-backward truths, and scope sanity". | METHOD.md:91 | stale | Six. `skills/cad-plan-checker-contract/SKILL.md` `<dimensions>` says "Check six dimensions" and adds **6. Proportionality** (smallest plan that delivers the goal, `workflow.max_plan_tasks` ceiling, default WARNING). Note the contract's own `<success_criteria>` still says "All five dimensions checked" - the same drift, one file over. |
| "Configure an OpenAI, Gemini or DeepSeek key and the identical job runs as a direct API call with the provider enforcing the output schema." | METHOD.md:301-303 | stale | Same as README:36 - DeepSeek has no server-side `json_schema`; the adapter injects the schema in-prompt and asserts the shape on return (`review-provider.mjs:16-19, 682-712`; `references/provider-api.md:57-62`). |
| `skills/cad-planner-contract/SKILL.md` is where planning lives. | METHOD.md:20 | accurate | |
| The planner follows the five-step goal-backward order (goal, truths, artifacts, wiring, tasks). | METHOD.md:24-31 | accurate | |
| 3 to 7 observable truths. | METHOD.md:28 | accurate | |
| Skeleton-first ordering; a working skeleton by commit 2 or 3. | METHOD.md:38-42 | accurate | |
| Read the actual files before writing tasks, each file once. | METHOD.md:44-46 | accurate | |
| Every task has exactly three fields: Files, Action, Verify, with the stated rules. | METHOD.md:50-55 | accurate | |
| Atomic; a task touching more than ~5 files is usually two tasks. | METHOD.md:57 | accurate | |
| A tool the environment lacks makes Verify a `human-verify` instruction. | METHOD.md:60-62 | accurate | |
| The prohibited scope words and the three `## PHASE TOO BIG` reasons. | METHOD.md:66-71 | accurate | |
| Six decomposition axes (trigger, size, lifecycle, failure-resume, freshness, ownership), a nudge not a rule. | METHOD.md:74-79 | accurate | |
| Plan check is on by default via `workflow.plan_check`. | METHOD.md:83 | accurate | schema default `true`. |
| The checker derives must-be-trues before it is allowed to open the plan. | METHOD.md:85-88 | accurate | `<process>` steps 2-3. |
| Truth with no task = BLOCKER; task no truth needs = WARNING; findings without severity are invalid. | METHOD.md:93 | accurate | |
| `skills/cad-executor-contract/SKILL.md`. | METHOD.md:100 | accurate | |
| For each task: implement, verify, commit. | METHOD.md:102 | accurate | The contract's loop is implement / verify / static analysis / commit / rewrite report - the three named steps are all present and in order. |
| State the expected output before running Verify; a surprise result is recorded as `[deviation] expected X, observed Y`. | METHOD.md:105-110 | accurate | |
| Generalized from Karpathy's recipe; there is no switch for it. | METHOD.md:112-114 | accurate | No config key gates prediction-first. |
| Trivial vs structural deviation buckets; unsure means structural. | METHOD.md:117-127 | accurate | |
| Circuit breaker is three fix attempts per task. | METHOD.md:129-131 | accurate | |
| A failed package install is never auto-fixed and is the one deviation class with no inline path. | METHOD.md:133-138 | accurate | The static-analysis carve-out still gets three inline attempts, so it is not a counterexample. |
| Commit protocol: individual staging, never `git add -A`/`.`, risk check on the staged diff, `{type}({scope}): {description}`, post-commit glance. | METHOD.md:142-145 | accurate | |
| Executors never push, force-push, write STATE/ROADMAP/SUMMARY, or spawn a reviewer. | METHOD.md:147-149 | accurate | `<never>` block. |
| `cadence-core/workflows/execute.md`. | METHOD.md:153 | accurate | |
| The seam intersects declared file lists pairwise; overlap forces sequential; a plan declaring no files forces sequential; a check that could not run forces it too. | METHOD.md:156-160 | accurate | `execute.md:126-140`. |
| `phase_diff` is parallel-path only. | METHOD.md:161-166 | accurate | |
| Worktree safety: branch check before every commit, halt on mismatch; `git stash`, `git clean`, blanket `reset --hard`, `restore .` forbidden. | METHOD.md:169-173 | accurate | |
| `skills/cad-verifier-contract/SKILL.md`. | METHOD.md:180 | accurate | |
| Four levels: Exists, Substantive, Wired, Behaves. | METHOD.md:185-193 | accurate | |
| VERIFIED / FAILED / UNCERTAIN, with UNCERTAIN counting toward neither side. | METHOD.md:195-198 | accurate | |
| SUMMARY.md is treated as claims to falsify; the goal check in `execute.md` requires a `file:line` or command output. | METHOD.md:200-205 | accurate | `execute.md:407`. |
| The four "how verifiers go soft" items. | METHOD.md:209-212 | accurate | Verbatim in `<stance>`. |
| Anti-pattern scan list, the goal-path clause, and the `CADENCE-DEBT` exemption via required ceiling + trigger. | METHOD.md:216-222 | accurate | `lib/debt-markers.mjs` requires both fields. |
| Spot-checks: 2-4, ~10s each, no servers/state/network; `cargo test -- --list`, `pytest --collect-only -q`; at most one full-suite run. | METHOD.md:227-230 | accurate | |
| `cadence-core/workflows/coverage.md`. | METHOD.md:235 | accurate | |
| The Covered definition quoted verbatim. | METHOD.md:239-241 | accurate | `coverage.md:6`. |
| Reads assertions not file counts; prefers a RED check; test kind in the project's own framework. | METHOD.md:244-247 | accurate | |
| A heavy new dependency is flagged; the plan is approved first; a red test is never committed and goes to `/cad-debug`. | METHOD.md:250-252 | accurate | `coverage.md:56-69`. |
| `cadence-core/references/review-triggers.md`. | METHOD.md:260 | accurate | |
| One `fire(trigger)` procedure, no embedded reviewer loops; that rule lives in `references/conventions.md`. | METHOD.md:265-267 | accurate | |
| Trigger table rows for `plan`, `diff`, `risk_surface`, `pre_ship` (fired-by, when, gate at `shipped`). | METHOD.md:272-277 | accurate | |
| Gate vocabulary (4) and `review.mode` vocabulary (`single`, `panel`, `adjudicated`). | METHOD.md:281-283 | accurate | |
| Gates resolve from `stakes`; `diff` is off/advisory/blocking across the three levels; `risk_surface` does not move; a typo loses to the level's gate and is named in warnings. | METHOD.md:286-292 | accurate | `route.mjs:537-552`. |
| The default reviewer is a fresh-context Claude subagent needing no key. | METHOD.md:300-301 | accurate | |
| The finding schema `{file, line, severity: blocker\|high\|medium\|low, claim, failure_scenario}`. | METHOD.md:308 | accurate | Matches `cad-reviewer-contract` `<returns>` exactly. |
| `skills/cad-reviewer-contract/SKILL.md`. | METHOD.md:318 | accurate | |
| Reviewer stance: refute not bless, line + concrete failure, approach differences are not findings, no inflation or softening, empty result valid after a genuine attempt. | METHOD.md:320-331 | accurate | |
| Adjudication: all reviewers run independently, main session grounds and owns the verdict; convergence is the one strong signal. | METHOD.md:336-342 | accurate | |
| Survivors are a numbered list with none as the default; three gates ship that way; the auto_close pre-ship arm triages none and halts on blocker/high. | METHOD.md:344-355 | accurate | `references/triage-gate.md:37`; `workflows/milestone.md:133`. |
| `cadence-core/workflows/decision-review.md` never auto-fires. | METHOD.md:359-362 | accurate | |
| Rulings are `survives`, `partial`, `refuted`, and a `refuted` must state its grounding. | METHOD.md:365-366 | accurate | `decision-review.md:107-116`. |
| Grounding is mandatory and typed: Context7 for library/API claims, the real repo for factual ones, one of each per run or an explicit statement of none. | METHOD.md:369-373 | accurate | `decision-review.md:83-92`. |
| A clean pass retargets onto the decision's own load-bearing claims and is never reported as a bare "no findings". | METHOD.md:376-378 | accurate | `decision-review.md:97-104`. |
| Cost is reported qualitatively, never as a token or dollar figure. | METHOD.md:380-381 | accurate | `decision-review.md:120,162`. |
| The eight risk surfaces that fire the blocking trigger. | METHOD.md:385-388 | accurate | |
| Detection sets a floor that only ever raises; lowering takes a named `risk.override.<surface>` read from the repo config alone, a global one is ignored and named. | METHOD.md:390-397 | accurate | |
| The pre-filter: a destructive op drops only when `git check-ignore` matches **and** `git ls-files` is empty; a secret drops only when template-shaped **and** a stub. | METHOD.md:399-406 | accurate | |
| The executor detects, stops and hands up; never reviews itself, never skips the gate. | METHOD.md:411-413 | accurate | |
| `references/consult.md` and its five rules, including `review.consult.attempt_threshold` and no local-subagent consult. | METHOD.md:418-433 | accurate | `consult.md:12-27`; threshold default 3. |
| The review -> revise -> review convergence loop was considered and cut. | METHOD.md:437-440 | accurate | `docs/WORKFLOW.md:55-59`. |
| The "nothing silently passes" bullets (dropped reviewer names its reason, empty set falls back to the local subagent, pre-filter drop noted, etc.). | METHOD.md:447-457 | accurate | |
| `cadence-core/workflows/audit.md` and the six break codes `no-phase`, `no-plan`, `unpicked`, `phase-missing`, `not-verified`, `drift`, with `not-verified` expected mid-cycle. | METHOD.md:467-478 | accurate | `audit.md:23-92`. |
| Plan frontmatter naming unknown requirement IDs is an orphan, weighed more lightly. | METHOD.md:480-482 | accurate | `audit.md:25`. |
| `cadence-core/workflows/debug.md` and the four-step loop; 2 to 5 hypotheses, ranked most-likely-first, tested risk-first. | METHOD.md:489-501 | accurate | `debug.md:69-98`. |
| `memory.backend: builtin` gates the hypothesize-step recall. | METHOD.md:503-504 | accurate | `debug.md:62,79`; schema default `builtin`. |
| `references/git-guard.md`; before the first commit the guard reads `git.protected_branches`, applies `git.on_protected`, and checks base integrity in the same pass. | METHOD.md:510-516 | accurate | `git-guard.md:8,22-43`. |
| A command counts when its first word is `git` and the verb is the first non-flag word; `bash -c`, `$(...)`, `sudo git` are invisible; rail 3 lists what it misses. | METHOD.md:518-525 | accurate | `git-segments.mjs`; pinned rows at `git-segments.test.mjs:69,75`. |
| Two decisions are marked in `references/seams.md` as deliberately undefaulted: the publish mechanism and the protected-branch guard. | METHOD.md:527-531 | accurate | `seams.md:37-40`. |
| Two tiers: an integration branch merged into per `git.auto_branch`, named by `git.integration_branch` (`milestone` default, `trunk` escape hatch); worktrees fork from the host's `worktree.baseRef`, required at `head`; `git.on_land_cleanup` returns to base, pulls, reaps. | METHOD.md:533-539 | accurate | `worktree-base.mjs` `SAFE_BASE_REF='head'`; `land-cleanup.mjs:4-19`. |
| One conventional commit per task; publishing flows through a single sanctioned seam; `git.auto_close` runs audit through merge with no per-step prompts and halts on a blocking `pre_ship` FAIL. | METHOD.md:542-547 | accurate | schema default `false`; `docs/WORKFLOW.md:52`. |
| `references/conventions.md`; `STATE.md` is a four-line cursor, overwritten in place, seam is the only correct writer. | METHOD.md:554-558 | accurate | `conventions.md:94`. |
| No audit logs, activity tables or session narratives. | METHOD.md:560 | accurate | |
| Config is read only through the config seam, one call per key. | METHOD.md:562-564 | accurate | |
| `cadence-core/bin/self-verify.mjs` lints config keys, script invocations and file paths, and fails on agent prose reaching for an undeclared tool. | METHOD.md:570-573 | accurate | checks 1, 2, 3; `undeclared-tool` at `self-verify.mjs:859`. |
| The concurrency-phrasing check: a block claiming a concurrent set must issue it in one message, judged per issuing sentence, explanatory moods left alone. | METHOD.md:575-581 | accurate | check 10. |
| Five surface sets weighed against `cadence-core/bin/weight-budgets.json`: agents, SKILL.md, workflows, `references/`, `templates/`. | METHOD.md:584-589 | accurate | 19 + 29 + 21 + 16 + 8 = 93 budget entries. |
| `/cad-docs-verify` checks factual claims against the live codebase. | METHOD.md:593 | accurate | |
| Every path in the "Where each rule lives" table. | METHOD.md:600-614 | accurate | All 14 resolve. |
| "This is the largest subsystem and the one that most shapes the output quality." | METHOD.md:258 | unverifiable | A judgment about subsystem scope, not a measurable count; by bytes `review-triggers.md` (17,733) is smaller than `acceptance-criteria.md` (22,506) and `seams.md` (18,575), but the subsystem spans several files. |

### INTERNALS.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| "The API enforces the output shape (OpenAI `response_format`, Gemini `responseSchema`)." | INTERNALS.md:55 | stale | The Gemini half is right. OpenAI's adapter uses the **Responses API** with `text: { format: { type: 'json_schema', name, strict: true, schema } }` on `/v1/responses` (`review-provider.mjs:611-623`); `response_format` is the Chat-Completions parameter and appears only in the DeepSeek adapter. `references/provider-api.md:18-19` states this explicitly. |
| 19 files cover the six roles. | INTERNALS.md:11 | accurate | `agents/` holds 19; `RUNG_FILES` names 6 roles. |
| `cad-plan-checker-medium` and `cad-plan-checker-high` are the same contract at two depths. | INTERNALS.md:11 | accurate | Both preload `cad-plan-checker-contract`. |
| `lib/rung-agent.mjs` states the rung->file map per role; the analyzer's unsuffixed file is its `xhigh` rung and `-high` is the lower one. | INTERNALS.md:11 | accurate | `RUNG_FILES['cad-assumptions-analyzer']`. |
| CI refuses a rung a cell names with no file, and a rung file no cell reaches. | INTERNALS.md:11 | accurate | `self-verify.mjs` check 8, both directions. |
| CI refuses a rung file carrying any instruction of its own. | INTERNALS.md:11 | accurate | `rungBodyIssue` (allowlist against the canonical body). |
| CI refuses a rung file whose frontmatter effort is not the rung it is filed under. | INTERNALS.md:11 | accurate | `rungEffortIssue`, called at `self-verify.mjs:795`. |
| One key `stakes` with three answers; set with `/cad-config stakes=shipped`. | INTERNALS.md:13 | accurate | |
| A cell is model + start rung + retry rung + review gates + deep verify. | INTERNALS.md:13 | accurate | The three grids in `route-table.json`. |
| The routed vocabulary is `sonnet` and `opus`; `haiku` and `fable` are reachable only by a `model.overrides` pin. | INTERNALS.md:13 | accurate | No cell names either; `model_aliases` carries all four. |
| An explicit pick wins; a config gate beats the level's only if it is one of the four values, else it loses and is named. | INTERNALS.md:13 | accurate | `route.mjs:537-552`. |
| `model.escalate_on_failure`, on by default; false holds the retry at its start rung. | INTERNALS.md:13 | accurate | |
| The risk floor only ever raises; lowering takes a named per-surface override; a project at `critical` is unaffected. | INTERNALS.md:13 | accurate | |
| CI refuses a retry rung that sits below the rung it started on. | INTERNALS.md:13 | accurate | `lib/route-cells.mjs:287-290`, code `rung-demotion`. |
| Routing governs dispatched subagents, not the main session. | INTERNALS.md:15 | accurate | `route.mjs` emits an agent name per dispatch only. |
| The five "read the code" pointers in the routing section. | INTERNALS.md:17 | accurate | All exist. |
| Every `git push` through Bash stops and asks; no exceptions. | INTERNALS.md:21 | accurate | `git-guard.mjs:206`. |
| `auto_close` is an opt-in key. | INTERNALS.md:23 | accurate | `git.auto_close`, default `false`. |
| `git-publish.mjs` runs git with an argument vector, a `--` end-of-options separator, strict branch/remote validation, and refuses unless `auto_close` is on and HEAD is a non-protected branch. | INTERNALS.md:27 | accurate | `execFileSync`; `publish-decision.mjs:62-83` (`SAFE_BRANCH`, `REMOTE_NAME`, five ordered gates). |
| What replaced the tokenizer is `lib/git-segments.mjs`, eighty-five lines; a segment counts only when its command word is `git`, verb = first non-flag word. | INTERNALS.md:37 | accurate | Exactly 85 lines. |
| The invisible shapes are written down in `references/git-publish.md` rail 3, in the CHANGELOG, and as a pinned test row apiece. | INTERNALS.md:37 | accurate | rail 3 at `git-publish.md:33`; `CHANGELOG.md:460`; `git-segments.test.mjs:69,75`. |
| The six "read the code" pointers in the push-guard section. | INTERNALS.md:39 | accurate | All exist. |
| Detection intersects the live provider list with a shipped hint table; unknown ids fall through to manual placement rather than erroring. | INTERNALS.md:45 | accurate | `references/model-hints.json` + `extractModels`. |
| The three "read the code" pointers in the detection section. | INTERNALS.md:49 | accurate | |
| Gemini's schema enforcement is `responseSchema`. | INTERNALS.md:55 | accurate | `review-provider.mjs:655`. |
| Four pure decision cores - `close-decision`, `publish-decision`, `branch-decision`, `release-decision` - each with a unit test per branch. | INTERNALS.md:61,65 | accurate | All four `lib/*.mjs` and all four `*.test.mjs` exist. |
| Eager bytes are the skill plus its `@`-includes; reachable is eager plus one hop. | INTERNALS.md:71 | accurate | `weight.mjs resident` emits `eagerFiles`/`reachableFiles`. |
| Dispatch weight is a third number that never sums with the other two (agent file plus preloaded contracts). | INTERNALS.md:75 | accurate | `dispatchBytes` in the `roles` block. |
| `node cadence-core/bin/weight.mjs resident --root <repo root>` works. | INTERNALS.md:79 | accurate | Run read-only; emits `{"ok":true,"checked":"resident-weight",...}`. |
| `lib/resident-weight.mjs` and `bin/weight.test.mjs` exist. | INTERNALS.md:81 | accurate | |
| "Cross-model review can call OpenAI or Gemini for a second opinion." | INTERNALS.md:43,45 | accurate | True as written; incomplete - DeepSeek is a third configured provider with its own `detect-models` endpoint (`/models`). Worth re-anchoring alongside METHOD:302. |
| The host's override resolution order is environment -> per-invocation parameter -> frontmatter -> session, and reasoning effort cannot be overridden. | INTERNALS.md:9 | unverifiable | Claude Code host behavior; nothing in this repo can decide it. The design's dependence on it is real (`rung-agent.mjs`), but the claim itself is external and dated July 2026. |
| Live detection actually returns what a key can reach, and a model-not-found mid-review offers re-detect. | INTERNALS.md:45-47 | unverifiable | Requires a live provider key and network. |
| The six shapes v1.4.0 found silent (`git -C`, `&`, `$(...)`, backticks, subshell, escaped quote, `bash -c`). | INTERNALS.md:31 | unverifiable | Historical claim about a version whose reader has since been deleted. |
| The old scan was O(KxN), 3.1GB at 224KB input, V8 abort at 280KB. | INTERNALS.md:35 | unverifiable | A measurement of code that no longer exists in the tree. |
| The 336KB input that aborted the old hook decides in milliseconds. | INTERNALS.md:37 | unverifiable | Needs a benchmark run; not measured here. |
| "Before I cut it, `/cad-land` was the heaviest in the plugin by eager bytes and the second lightest of the five I measured by reachable." | INTERNALS.md:73 | unverifiable | Explicitly a pre-cut measurement over a 5-command sample. Current tree: `/cad-land` is 18,209 eager (4th of 23, behind `cad-execute` 28,476, `cad-verify` 24,533, `cad-plan` 22,662) and 63,369 reachable. |

### CONTRIBUTING.md

Zero mechanical drift coverage - `self-verify.mjs:303` lints only `README.md`,
`INTERNALS.md` and `METHOD.md` - so every row below is checked here for the
first time.

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| "Cadence has no build step and no dependencies. The scripts inside are zero-dependency Node, so there is no `npm install`." | CONTRIBUTING.md:13 | stale | The first half holds - no file under `cadence-core/bin/` imports anything but `node:` builtins. The conclusion does not: the third check needs `typescript` + `@types/node`. CI runs `npm install --no-save --no-package-lock typescript @types/node` **before** `npx tsc -p tsconfig.ci.json`, and `tsconfig.ci.json`'s own `_comment` says "CI installs typescript + @types/node ephemerally (npm install --no-save)". The local recipe at :16-19 omits that step; a cold `npx tsc` fetches typescript over the network instead. |
| "The same three checks CI runs" - three checks, runnable locally. | CONTRIBUTING.md:13 | accurate | `.github/workflows/test.yml` has exactly three jobs: `node-test`, `self-verify`, `typecheck`. |
| `node --test cadence-core/bin/*.test.mjs` - unit tests for the seam cores. | CONTRIBUTING.md:16 | accurate | Byte-identical to the CI step; 30 `*.test.mjs` files resolve. CI additionally runs it on a node 22/24 matrix. |
| `node cadence-core/bin/self-verify.mjs` - the prose<->code drift linter. | CONTRIBUTING.md:17 | accurate | Byte-identical to the CI step; the file exists. |
| `npx tsc -p tsconfig.ci.json` - honors the `@ts-check` pragmas. | CONTRIBUTING.md:18 | accurate | Same command as CI's second typecheck step; `tsconfig.ci.json` exists with `checkJs: true` over `cadence-core/bin/**/*.mjs`. |
| `node` and `git` on your PATH are what the three checks need. | CONTRIBUTING.md:13 | accurate | None of the three shells out to git, so git is not strictly required for them; `npx` (and a network or warm cache) is the real extra. |
| self-verify: every config key, script invocation and file path named in the workflows has to exist or the build fails. | CONTRIBUTING.md:21 | accurate | checks 1, 2, 3; it in fact lints wider than "the workflows" (all `.md` surfaces plus README/INTERNALS/METHOD). |
| It weighs every agent file, every SKILL.md, every workflow, and every file under `cadence-core/references/` and `cadence-core/templates/`. | CONTRIBUTING.md:21 | accurate | `weight-budgets.json`: 19 agents, 29 skills, 21 workflows, 16 references, 8 templates = 93 entries. |
| It fails when one outgrows its byte budget. | CONTRIBUTING.md:21 | accurate | check 4, against `cadence-core/bin/weight-budgets.json`. |
| It fails when an agent's prose reaches for a tool its frontmatter never declared. | CONTRIBUTING.md:21 | accurate | `undeclared-tool` at `self-verify.mjs:859`. |
| "the build will run it for you either way." | CONTRIBUTING.md:21 | accurate | The `self-verify` job fires on push to `main` and on every pull_request. |
| The MIT license, and contributions landing under it. | CONTRIBUTING.md:9,29 | accurate | `LICENSE` is MIT. |
| Cadence is a derivative of GSD at `https://github.com/open-gsd/gsd-core`, spelled out in `NOTICE.md` and `LINEAGE.md`. | CONTRIBUTING.md:29 | accurate | Both files exist; the URL matches `LINEAGE.md` and `README.md:138`. |
| `MANIFESTO.md` link. | CONTRIBUTING.md:3 | accurate | Exists. |
| "Bug reports are welcome... doc fixes land fast"; the feature-PR policy. | CONTRIBUTING.md:5,7,9 | unverifiable | Maintainer intent, no code surface. |
| "The self-verify step is the one that catches most drift." | CONTRIBUTING.md:21 | unverifiable | A relative-yield judgment across three checks; nothing measures it. |
| What a good bug report contains (Claude Code version, `node --version`, the relevant `.planning/` slice). | CONTRIBUTING.md:25 | unverifiable | Process guidance, not a code claim. No issue template enforces it, though `.github/ISSUE_TEMPLATE/bug_report.md` exists. |

---

## Group 2 - `cadence-core/workflows/` A-M

`154 accurate, 7 stale, 2 unverifiable`

### cadence-core/workflows/audit.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| A digit-leading category like `2FA-01` is not admitted, so it appears in neither `unseeded` nor `counts` and is reported only in `active_issues`. | audit.md:31-34 | stale | `isRequirementId` (`bin/lib/planning-files.mjs:290`) needs 2-8 `[A-Z0-9]` chars containing at least one letter *anywhere*, not a leading one. Verified end to end: `2FA-01` returns `"unseeded":{"active_ids":["2FA-01"]}` and an `unpicked` break inside `counts`. Only an all-digit prefix (`14-01`, `2026-08`) is refused. |
| On an `active-non-id-bullet`, a span holding nothing but the id that is still reported means the id failed the admission test (a digit-leading category), and no rewrite will count it. | audit.md:136-140 | stale | Rests on the same false premise; a digit-leading category like `2FA-01` passes admission, so this remedy-is-useless advice does not apply to it. The genuine non-admitted shapes are all-digit prefixes. |
| `planning.mjs audit` exists and returns one JSON line. | audit.md:19 | accurate | |
| Break codes are `no-phase \| phase-missing \| no-plan \| not-verified \| drift \| unpicked`. | audit.md:23-24 | accurate | |
| `orphans.plan_ids` holds plan frontmatter referencing unknown REQ-IDs. | audit.md:25 | accurate | |
| `frontmatter_issues` exists; `references/plan-frontmatter.md` states the grammar. | audit.md:27-28 | accurate | |
| `unseeded` names `## Active` ids with no Traceability row, each also carrying an `unpicked` break. | audit.md:29-30 | accurate | |
| `active_issues` holds lines inside `## Active` outside the bullet grammar; `references/req-traceability.md` exists. | audit.md:35-36 | accurate | |
| `nonconforming_plans` names a `PLAN*.md` no seam reads, e.g. `PLAN-gaps.md`. | audit.md:36-37 | accurate | |
| `deferred` holds rows whose Status is `Deferred`. | audit.md:37-38 | accurate | |
| `version_drift` is `{doc_version, published_as, cycle_state}` and is omitted when there is nothing to report. | audit.md:39-40 | accurate | |
| `counts.total` is Traceability rows plus unpicked ids, so `total = traced + broken + deferred`. | audit.md:41-42 | accurate | |
| `planning.mjs criteria-coverage` exists. | audit.md:50 | accurate | |
| `version` (`{plugin, uat_fields}`) is the first key of the coverage envelope. | audit.md:53 | accurate | |
| `phases` entries are `{phase, criteria, items}`. | audit.md:56-57 | accurate | |
| `breaks` entries are `{phase, id, break:"uncovered"}` or `{phase, break:"fieldless-checklist", file}`. | audit.md:58-59 | accurate | |
| `untraced` is an item with no `criterion` and no exempting `origin`. | audit.md:59-60 | accurate | |
| `legacy` entries are `{phase, reason}` with the exemption's reason stated. | audit.md:60 | accurate | |
| Coverage `counts` satisfies `criteria = covered + uncovered`. | audit.md:62 | accurate | |
| `references/acceptance-criteria.md` holds the grammar and field semantics. | audit.md:63 | accurate | |
| `milestone.md` step 3 prunes completed phases from ROADMAP `## Phases`, so `parseRoadmapPhases` only holds the current cycle. | audit.md:66-68 | accurate | |
| An unchecked phase contributes its `uncovered` count but no `uncovered` or `missing-uat` break. | audit.md:68-70 | accurate | |
| `fieldless-checklist` is not box-gated; `uat init` writes `fields_version` before it looks at an item. | audit.md:70-73 | accurate | |
| Repair form `uat record --phase <N> --item <k> --result <...> --criterion AC<N>`; `--origin criterion` names no id. | audit.md:101-103 | accurate | `UAT_ORIGINS = ['criterion','verifier','smoke']`; `--criterion` is validated against `^AC\d+$`. |
| `version_drift` is issue #87's failure mode: a cycle planned/branched under an already-tagged number. | audit.md:107-108 | accurate | Named verbatim at `bin/planning.mjs:1081`. |
| A phase whose checklist holds only passes, skipped-with-reason and `blocked` items no longer holds the cycle open. | audit.md:164-166 | accurate | Matches `settled()`, `bin/planning.mjs:1128-1132`. |
| The test is membership in the tag list, not sort order. | audit.md:167-168 | accurate | |
| `pluginVersion()` resolves relative to the SCRIPT, so the manifest is deliberately not the comparand. | audit.md:170-176 | accurate | |
| `skills/cad-health/SKILL.md` already settled that tags are the publication evidence. | audit.md:173-174 | accurate | |
| `legacy` exempts only on all five terms, the fifth being a CONTEXT declaring no `AC<N>` ids. | audit.md:183-190 | accurate | |
| An absent UAT.md under a present CONTEXT breaks every declared criterion as `missing-uat` on a checked box. | audit.md:194-196 | accurate | |
| `context_issues` can carry `criterion-duplicate-id` / `criterion-unidded`. | audit.md:196-197 | accurate | Defined in `bin/lib/planning-files.mjs:791,798,891`. |
| First-occurrence-wins on a duplicate id, so a second bullet reusing one is dropped from the coverage domain. | audit.md:198-201 | accurate | |

### cadence-core/workflows/config.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `parallelization.enabled` default is `false`. | config.md:97 | stale | `true`. Both `cadence-core/config.schema.json` and `cadence-core/templates/config.json` ship `true`. |
| The `review.triggers.<t>.{gate,tier,effort}` defaults are "per DESIGN section 7". | config.md:126-128 | stale | DESIGN section 7 carries no per-trigger defaults - it explicitly hands defaults to `config.schema.json` ("the source of truth for keys, types, enums, and defaults"), and neither config.md nor review-triggers.md has a section 7. Actual schema defaults: gate - plan/pre_ship `adjudicated`, diff/phase_diff `advisory`, risk_surface `blocking`; tier - `flagship` except diff `balanced`; effort - `high` except diff `medium`. |
| Canonical shape lives in `cadence-core/config.schema.json`, enforced by `bin/config.mjs`. | config.md:3-5 | accurate | |
| `cadence-core/templates/config.json` is the scaffolded default. | config.md:5 | accurate | |
| `model.overrides` carries six role pins. | config.md:29 | accurate | Six keys. |
| `model.effort` carries six per-role start rungs. | config.md:31 | accurate | |
| `review.decision_review` has two keys. | config.md:32 | accurate | `.tier`, `.effort`. |
| The four edit-the-file-only sets have no catalog row. | config.md:27-33 | accurate | None of the four appears in the catalog table. |
| `granularity` enum `fine\|standard\|coarse`, default `standard`, split sizes 8-12 / 5-8 / 3-5. | config.md:82 | accurate | |
| `stakes` enum `solo\|shipped\|critical`, default `shipped`. | config.md:84 | accurate | |
| `model.escalate_on_failure` bool, default `true`. | config.md:85 | accurate | |
| `workflow.research` bool, default `false`. | config.md:87 | accurate | |
| `workflow.plan_check` bool, default `true`. | config.md:88 | accurate | |
| `workflow.verifier` bool, default `true`; the stakes level decides and `--deep` forces. | config.md:89 | accurate | `route-table.json` `verify` = off/on/on; `--deep` is a real `/cad-verify` flag. |
| `workflow.skip_discuss` bool, default `false`. | config.md:90 | accurate | |
| `workflow.subagent_timeout` int, default `300000`. | config.md:91 | accurate | |
| `workflow.inline_plan_threshold` int, default `3`. | config.md:92 | accurate | |
| `workflow.max_plan_tasks` int, default `8`; above it the plan must return `## PHASE TOO BIG`. | config.md:93 | accurate | |
| `workflow.test_command` / `workflow.lint_command` are `str\|null`, default `null`; there is no typecheck key. | config.md:94-95 | accurate | |
| `parallelization.max_concurrent_agents` 3, `min_plans_for_parallel` 2, `use_worktrees` true. | config.md:98-100 | accurate | |
| `git.protected_branches` default `main, master`. | config.md:102 | accurate | |
| `git.on_protected` enum `ask\|refuse\|allow`, default `ask`. | config.md:103 | accurate | |
| `git.integration_branch` enum `milestone\|trunk`, default `milestone`. | config.md:104 | accurate | |
| `git.auto_branch` enum `ask\|auto\|off`, default `ask`. | config.md:105 | accurate | |
| `git.base_branch` `str\|null`, default `null`. | config.md:106 | accurate | |
| `git.create_tag` true, `git.on_land_cleanup` true, `git.auto_close` false. | config.md:107-109 | accurate | |
| `planning.commit_docs` bool, default `true`. | config.md:111 | accurate | |
| `memory.backend` enum `builtin\|none`, default `builtin`. | config.md:113 | accurate | |
| `risk.override.<surface>` covers exactly the eight named surfaces, default `false`, repo-scoped with a global waiver named in `warnings`. | config.md:115 | accurate | |
| `review.reviewers` list(enum) of `claude-subagent\|openai\|gemini\|deepseek`, default `claude-subagent`. | config.md:117 | accurate | |
| `review.mode` enum `single\|panel\|adjudicated`, default `adjudicated`. | config.md:118 | accurate | |
| `review.key_file` `str\|null`, default `null`. | config.md:119 | accurate | |
| `review.request_timeout_ms` default `540000`, clamped to a 600000 host ceiling. | config.md:120 | accurate | Schema `max: 600000`. |
| `review.max_prompt_tokens` default `120000`; over-cap refused before any request, cross-model only. | config.md:121 | accurate | `review-provider.mjs` `assertUnderCap` -> `over-cap`. |
| `review.consult.{enabled,tier,effort,attempt_threshold}` = false / flagship / high / 3. | config.md:122-125 | accurate | |
| Trigger set is `{plan, diff, risk_surface, phase_diff, pre_ship}`. | config.md:130 | accurate | |
| `config.mjs` subcommands are `validate \| check \| set \| get \| keys`. | config.md:141-145 | accurate | Usage line confirms exactly these five. |
| `--file <path>` overrides `.planning/config.json`; `--global` targets `~/.claude/cadence/config.json`, relocatable via `CADENCE_GLOBAL_CONFIG`, auto-created by `set`. | config.md:154-157 | accurate | |
| `route.mjs` deep-merges global under repo (repo > global > defaults); nested objects merge, arrays replace wholesale. | config.md:160-163 | accurate | `bin/lib/config-merge.mjs:58-70`, imported by `route.mjs:51`. |
| A `worktree.baseRef=...` pair is rejected by the seam as an unknown key. | config.md:168-169 | accurate | Live check returns `{"ok":false,"reason":"invalid","detail":[{"key":"worktree.baseRef","error":"unknown key"}]}`. |
| `set` rejects unknown key / bad value / non-object top level / a dotted path through a non-object, atomically, and echoes `{ok:true, changed:[...]}`. | config.md:174-178 | accurate | |
| A key retired by a release carries a `detail` naming the replacement. | config.md:180-182 | accurate | `retiredKeyError`, `bin/lib/retired-keys.mjs`. |
| A `(root)` detail means the target file's top level is not a JSON object; `cannot set through "..."` means a container holds an array or scalar. | config.md:183-189 | accurate | |
| `worktree.baseRef` is absent from `config.schema.json`, never goes through `config.mjs`, `"fresh"` is its default and `"head"` is the parallel-safe value. | config.md:194-202 | accurate | `worktree-base.mjs:50-52`. |
| `worktree-base.mjs resolve` reports `parallelSafe` and the file the value came from. | config.md:214-217 | accurate | Live run returns `{ok,baseRef,source,parallelSafe,reason}`. |
| `workflows/config-review.md` holds the detect/classify/assign/write flow. | config.md:237-238 | accurate | |

### cadence-core/workflows/config-review.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `review.providers.<name>.tiers.{flagship,balanced,cheap}` are the target keys. | config-review.md:8 | accurate | |
| DESIGN section 6 carries the three-layer detection decision. | config-review.md:9 | accurate | `DESIGN.md:283` "Provider model selection + live detection". |
| Providers under `review.providers` are openai, gemini, deepseek. | config-review.md:20 | accurate | |
| `review-provider.mjs detect-models --provider <name> [--key-file <path>]`. | config-review.md:26-28 | accurate | Usage line at `review-provider.mjs:45`. |
| `ok:false, reason:"no-key"` with a `detail` naming `$OPENAI_API_KEY` / `$GEMINI_API_KEY` or the providers.env path. | config-review.md:35-37 | accurate | `ENV_VAR` map at `review-provider.mjs:170`. |
| `ok:false, reason:"transport"\|"http"`. | config-review.md:40 | accurate | |
| `models[]` entries are `{id, tier, high_effort}` with `tier` = `flagship\|balanced\|cheap` or `null` for unknown ids. | config-review.md:44-46 | accurate | `review-provider.mjs:939-940`. |
| `config.mjs set 'review.providers.<name>.tiers.<pos>=<id>'` is the write path. | config-review.md:72-76 | accurate | |
| Adding a provider to `review.reviewers` via `set 'review.reviewers=["claude-subagent","openai"]'` is what enrolls it. | config-review.md:80-82 | accurate | Verified: that exact JSON-array form validates `{"ok":true}`. |
| `claude-subagent` is the always-available fallback when a tier is `null`. | config-review.md:78-80 | accurate | |

### cadence-core/workflows/context.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `planning.mjs cursor get` returns `no-cursor` when STATE.md is absent. | context.md:24-26 | accurate | `bin/planning.mjs:376`. |
| Output path `.planning/phases/{N}/CONTEXT.md`. | context.md:16 | accurate | |
| `config.mjs get memory.backend workflow.subagent_timeout` reads both in one call. | context.md:80 | accurate | Both keys exist; `get` is variadic. |
| `builtin` is the schema default for `memory.backend`. | context.md:83 | accurate | |
| `planning.mjs recall "<terms>"` exists and returns `{ok, results:[{score, source, phase?, snippet}]}` with `phase` optional. | context.md:86, :96-98 | accurate | `bin/planning.mjs:1592-1600`. |
| `trace append --phase --family lifecycle --event dispatch --plan --role --read "..."` - every flag exists. | context.md:111 | accurate | `bin/planning.mjs:2125-2199`. |
| `--family lifecycle` is a valid family. | context.md:111 | accurate | `FAMILIES = ['routing','provider','lifecycle','outcome']`. |
| The analyzer's contract lives at `skills/cad-assumptions-analyzer-contract`. | context.md:117 | accurate | |
| Measured token figures: analyzer 186,577, planner 146,405, executor 154,523, plan-checker 47,717, verifier 78,034. | context.md:131-134 | accurate | 47,717 and 78,034 reproduce live in `.planning/trace.jsonl`; all five recorded in `.planning/phases/4/CONTEXT.md:106`. |
| A built-in agent type (`Explore`) returned no token figure at all. | context.md:134-135 | accurate | `trace render --phase 4` shows a `cad-verifier` dispatch with `unrecorded:1`. |
| `unrecorded` can only be nonzero where a dispatch was counted, and sits beside a dispatch COUNT. | context.md:135-137 | accurate | `bin/lib/trace.mjs:386-393`. |
| A dispatch written and never closed is `unpaired`; a bracket never appended appears nowhere. | context.md:138-142 | accurate | |
| The census in `trace.test.mjs` binds these lines per file. | context.md:143-144 | accurate | `BRACKETING` map, `bin/trace.test.mjs:692-698`. |
| The failure arm closes with `--event checkpoint`. | context.md:178 | accurate | `TERMINAL = ['return','checkpoint','escalation']`. |
| `cursor set --phase {N} --status "context gathered" --next "/cad-plan {N}"`. | context.md:377 | accurate | `"context gathered"` is in `CURSOR_STATUSES`. |
| `/cad-audit` FAILs on a criterion that reached no UAT item. | context.md:277-279 | accurate | |
| No review trigger fires here per `references/review-triggers.md`'s wiring table. | context.md:422-423 | accurate | The wiring table has no `cad-context` row. |

### cadence-core/workflows/coverage.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `planning.mjs status` reports per-phase status. | coverage.md:12-13 | accurate | |
| Statuses include `complete` and `executed` (and `unplanned` / `planned`). | coverage.md:13-19 | accurate | `bin/planning.mjs:145-147`. |
| `ok:false` reasons include `no-planning-dir` and `no-roadmap`, each carrying a `hint`. | coverage.md:14-15 | accurate | `bin/planning.mjs:236,238`. |
| An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived closed milestone. | coverage.md:15-19 | accurate | `bin/planning.mjs:358`. |
| A plan's `requirements` frontmatter is a real field. | coverage.md:30-31 | accurate | `references/plan-frontmatter.md`. |
| `workflow.test_command` is the runner config key. | coverage.md:35, :63 | accurate | |
| `references/git-guard.md` holds the protected-branch guard. | coverage.md:73 | accurate | |
| Commit form `test(phase-<N>): cover <requirements>`. | coverage.md:72 | accurate | |

### cadence-core/workflows/debug.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| State file lives at `.planning/debug/<slug>.md`. | debug.md:7 | accurate | Same path in `skills/cad-debug/SKILL.md:18`. |
| `config.mjs get memory.backend review.consult.attempt_threshold` reads both in one call. | debug.md:59 | accurate | |
| `references/bug-patterns.md` exists and is frequency-ordered. | debug.md:70-72 | accurate | |
| `planning.mjs recall` exists; its JSON is `{ok, results:[{score, source, phase?, snippet}]}`. | debug.md:83, :89-92 | accurate | |
| A `none` backend makes recall's own backend-off return a backstop, not this workflow's gate. | debug.md:85-87 | accurate | `bin/planning.mjs:1549` returns `{backend:'none', results:[]}`. |
| The `risk_surface` trigger is `blocking` and its re-arm is capped at ONE narrowed round in `references/triage-gate.md`. | debug.md:110-117 | accurate | `triage-gate.md:14`. |
| The fix's artifact is shape (b), the staged-diff scope, and the reviewer runs `git diff --cached` in the inherited cwd. | debug.md:111-114 | accurate | `references/review-triggers.md:55`. |
| `review.consult.attempt_threshold` default is 3. | debug.md:126-127 | accurate | |
| `references/consult.md` defines `offer_consult`. | debug.md:123, :137 | accurate | `references/consult.md:30`. |
| `cad-debug` is one of the skills that fires `risk_surface`. | debug.md:110 | accurate | Named in the wiring table's `Fired by` column. |

### cadence-core/workflows/decision-review.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| D-09: the runtime exposes no per-turn token/dollar figures, so cost reporting stays qualitative. | decision-review.md:120-121, :162-163 | unverifiable | Needs runtime introspection of the host's per-turn accounting. `.planning/phases/4/CONTEXT.md:107-109` adjudicated this against phase 4's subagent-return figures and ruled it a different claim (per-turn orchestrator figures) that does not bind here. |
| The cross-model arm rests on the Phase-1 REV-01 seam repair - a symlinked install must run this seam for real, not no-op. | decision-review.md:54-55 | unverifiable | A claim about a past repair's effect under a symlinked install; needs an installed-plugin runtime to test. |
| The target is a `- D-NN (...)` line under `## Durable decisions` / `## Decisions`, or a PROJECT.md `## Key Decisions` row. | decision-review.md:2-5, :24-26 | accurate | Matches the CONTEXT.md sections `cad-context` writes. |
| This workflow has no entry in `references/review-triggers.md`'s wiring table. | decision-review.md:11-12, :152-154 | accurate | |
| The reviewer set resolves from `review.reviewers[]` exactly as review-triggers.md step 3 does. | decision-review.md:43-44 | accurate | |
| No routing cell resolves a model for the `claude-subagent` arm; it is base `cad-reviewer` at the session default. | decision-review.md:47-50 | accurate | `config-reach.md:182`. |
| `review-provider.mjs review --provider <name> --model <id> --effort <level> [--key-file <path>]` with `{instruction, artifact}` on stdin. | decision-review.md:58-62 | accurate | Usage at `review-provider.mjs:37-39`; `--model` is required. |
| `ok:false` drops that reviewer, same degradation rule as review-triggers.md step 4. | decision-review.md:62-64 | accurate | |
| `review.decision_review.{tier,effort}` reach the cross-model arm only. | decision-review.md:49-50, :180-182 | accurate | `config-reach.md:182-183`. |
| Context7 is on this skill's main-model surface; the read-only `cad-reviewer` subagent has no MCP tools. | decision-review.md:86-88 | accurate | `agents/cad-reviewer.md` frontmatter. |
| `review-provider.mjs`'s `FINDING_SCHEMA` and self-verify's `CONTRACTS` table are unchanged, and refute still returns `{findings:[...]}`. | decision-review.md:157-161 | accurate | `review-provider.mjs:532`, `self-verify.mjs:129`. |

### cadence-core/workflows/docs-verify.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The writer is cut, per DESIGN section 2. | docs-verify.md:4 | accurate | `DESIGN.md:76`. |
| The default target set is `README.md` plus `docs/**`. | docs-verify.md:10-11 | accurate | Both exist at the repo root. |
| The report table columns are `claim \| location \| verdict \| correct value (if stale)`. | docs-verify.md:46 | accurate | |
| Verdicts are exactly `accurate \| stale \| unverifiable`. | docs-verify.md:40-44 | accurate | |

### cadence-core/workflows/execute.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `cad-executor.md` already carries the executor's standing rules (atomic commit per task, deviation recording, checkpoints, never writing STATE/ROADMAP/SUMMARY, the report format) as its stable, cached definition. | execute.md:191-193 | stale | Those rules live in `skills/cad-executor-contract/SKILL.md`. `agents/cad-executor.md` is an eleven-line stub that names the rung and the contract skill and says outright "adds nothing else". |
| The `phase_diff` trigger is "Off by default (opt-in)". | execute.md:382-383 | stale | At the default `shipped` stakes it resolves to `advisory`. `route-table.json` `review` = solo `off` / shipped `advisory` / critical `adjudicated`, and `route.mjs resolve` returns `"phase_diff":"advisory"` on this repo. Only `solo` is off. |
| `phase_diff` is "`adjudicated` wherever it is on at all (critical only)". | execute.md:387-388 | stale | It is on at `shipped` as `advisory`; `adjudicated` only at `critical`. |
| `planning.mjs status` returns `current`, `ok:false` with `reason`/`hint`, and `cycle:"none"` with an empty `phases[]` on a closed milestone. | execute.md:18-24 | accurate | |
| Plan files are `PLAN.md`, or `PLAN-1.md`, `PLAN-2.md`, ... in numeric order. | execute.md:24-25 | accurate | `listPlanFiles`, `bin/planning.mjs:956-963`. |
| The ten config keys in the single `config.mjs get` all exist. | execute.md:35-39 | accurate | |
| `fire(trigger)` takes gates from the routing bundle, and a `config.mjs get` of a gate returns the schema default when no layer set it. | execute.md:41-46 | accurate | `route.mjs:537-554`. |
| `references/git-guard.md` holds the protected-branch guard. | execute.md:50-51 | accurate | |
| `git diff --cached --quiet` / `--name-status` and `git stash push --staged` (git 2.35+). | execute.md:68-73 | accurate | `--staged` landed in git 2.35. |
| `lease-check` reads the whole staged index and has no provenance signal; its refusal code is `undeclared-files`. | execute.md:97-104 | accurate | `bin/planning.mjs:1834-1852`. |
| `trace append --phase <N> --family lifecycle --event phase_start --sha <PHASE_START>` anchors the correlation id. | execute.md:110-114 | accurate | |
| An append returning `written:false` (size cap, unwritable root) changes nothing on the execute path. | execute.md:115-117 | accurate | `bin/lib/trace.mjs:195-225`. |
| `planning.mjs plan-overlap --phase <N>` returns `overlaps`, `undeclared` and `frontmatter_issues`. | execute.md:129-138 | accurate | `bin/planning.mjs:1429-1445`. |
| `worktree-base.mjs resolve` reports `parallelSafe`, with `baseRef:"fresh"` the default. | execute.md:146-153 | accurate | `worktree-base.mjs:50,132`. |
| An executor writes its task table to `<plandir>/reports/plan-<k>.md` and returns a five-field digest. | execute.md:196-198 | accurate | `skills/cad-executor-contract/SKILL.md:48,125,200`. |
| `git worktree list --porcelain` gives the worktree root for branch `cadence/phase-<N>-plan-<k>`. | execute.md:205-206 | accurate | Same branch spelling asserted in `bin/dispatch-phrasing.test.mjs:93`. |
| The three `trace append` bracket lines and every flag on them exist. | execute.md:214-216 | accurate | |
| The closing event is `return`, `checkpoint` or `escalation`; a worker with none is what `trace render` reports as unpaired. | execute.md:219-223 | accurate | `bin/lib/trace.mjs:65`. |
| `--role` is a separate key from `--plan`; `--plan` pairs the bracket, `--role` groups the per-role totals. | execute.md:226-231 | accurate | `bin/planning.mjs:43-50`, `bin/lib/trace.mjs:306`. |
| `--tokens 0` would claim a dispatch that cost nothing, so the flag is omitted when no figure is returned. | execute.md:232-237 | accurate | `bin/lib/trace.mjs:374-375`. |
| The `phase_start` line takes no `--role`, `--tokens` or `--read`. | execute.md:240-242 | accurate | Enforced by the census's anchor/dispatch split in `bin/trace.test.mjs`. |
| `.planning/trace.jsonl` is gitignored; `/cad-new-project` writes the line via `planning.mjs trace ignore` and `/cad-health` only reports a pre-seam scaffold. | execute.md:246-250 | accurate | `workflows/new-project.md:33`, `skills/cad-health/SKILL.md:27`. |
| The `diff` trigger's artifact is shape (a) refs `{base_ref, head_ref}` and its default at `shipped` is advisory. | execute.md:272-275 | accurate | |
| `references/triage-gate.md` makes NONE the default and caps the blocking re-arm at ONE round. | execute.md:285-291, :312-313 | accurate | `triage-gate.md:14,37`. |
| The `risk_surface` checkpoint artifact is shape (c), a flagged-diff FILE path. | execute.md:306-309 | accurate | |
| `SUMMARY.md` is written from `cadence-core/templates/SUMMARY.md`. | execute.md:417-419 | accurate | |
| `planning.mjs debt-harvest --root .` rewrites `.planning/CAPTURE.md`'s own `## Debt markers` section only. | execute.md:432-437 | accurate | `bin/planning.mjs:2493-2505`. |
| `cursor set --phase <N> --status executed --next "/cad-verify <N>"`. | execute.md:444 | accurate | |
| `plan-<k>-risk-task-<n>.diff` is the transient flagged diff and must never be staged. | execute.md:450-452 | accurate | |
| STATE.md is exactly the 4-line cursor, overwritten, and this workflow is its only writer. | execute.md:472-473, :488 | accurate | |

### cadence-core/workflows/milestone.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| One `config.mjs get git.create_tag git.auto_close` reads both keys. | milestone.md:7-8 | accurate | |
| `/cad-audit` is the requirement/phase/plan/verified FAIL gate invoked here. | milestone.md:13-16 | accurate | |
| `release-bump.mjs bump --dir <root> --version <version>`, with `--version` REQUIRED. | milestone.md:33-36 | accurate | `release-bump.mjs:18-22`. |
| The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"` when absent. | milestone.md:39-40 | accurate | `release-bump.mjs:117-119`. |
| It bumps the manifest `version` and any versioned sibling, scaffolds the dated `## [<version>]` heading + link reference, and promotes `## [Unreleased]`. | milestone.md:40-44 | accurate | `release-bump.mjs:174-194`. |
| `ok:false` reasons are `no-target-version`, `unparseable-version`, `unreadable-manifest`, `downgrade`, `not-an-upgrade`, with nothing written and exit 1. | milestone.md:49-54 | accurate | `lib/release-decision.mjs:191-217`. |
| A `siblings[]` entry with `action:"refuse"` leaves top-level `ok` true. | milestone.md:55-57 | accurate | |
| `changelog.section_empty: true` means the dated heading has no body. | milestone.md:58-60 | accurate | |
| An annotated tag at HEAD (`git tag -a <version> -m ...`), unpushed. | milestone.md:67-68 | accurate | |
| A surviving `### Phase N:` detail section is the signature of an interrupted close. | milestone.md:71-76 | accurate | `references/roadmap-phases.md` exists. |
| Requirement rows must stay as rows so `/cad-audit` can trace shipped scope; `## Active` bullets take the `- **<ID>**: <one line>` form. | milestone.md:95-104 | accurate | `ACTIVE_BULLET` grammar. |
| `cursor set --phase 1 --status "ready to plan" --next "/cad-phase add"`. | milestone.md:111-113 | accurate | |
| On a fully pruned roadmap the seam derives `of 0 (no active cycle)`; passing `--name`/`--total` is needed when work was deferred, else it returns `cannot-derive`. | milestone.md:115-124 | accurate | `bin/planning.mjs:403-412,451`. |
| `/cad-phase add` is the only workflow that appends a phase line to an existing roadmap. | milestone.md:117-119 | accurate | |
| `git.auto_close` false is the default, so the tag stays unpushed and publishing is a separate `/cad-land`. | milestone.md:128-131 | accurate | |
| The chain reaps via `land-cleanup.mjs`'s `cadence/*`-merged fallback (`resolveReapBranch`). | milestone.md:138-142 | accurate | `land-cleanup.mjs:35,87`. |

---

## Group 3 - `cadence-core/workflows/` N-Z

`164 accurate, 3 stale, 3 unverifiable`

### cadence-core/workflows/new-project.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The written defaults are "interactive, research off, plan check and verifier on". | new-project.md:51 | stale | `templates/config.json` contains no `interactive` key or value anywhere; the leading defaults are `granularity: "standard"` and `stakes: "shipped"`. The other three terms are correct. The word survives from a retired `mode: interactive` config key. |
| Structured-question headers are capped at 12 characters. | new-project.md:95 | unverifiable | Host `AskUserQuestion` constraint; stated nowhere in the repo except this file and its own `:209`. |
| Skipping init when `git rev-parse --git-dir` fails identifies a non-repo. | new-project.md:29 | accurate | |
| `planning.mjs trace ignore --root .` exists as a seam call. | new-project.md:33 | accurate | |
| A re-run returns `written:false` with `reason:"already-ignored"`. | new-project.md:38 | accurate | |
| A project ignoring `.planning/` wholesale is detected and left alone. | new-project.md:39 | accurate | `gitIgnoreState` tries the git arm first precisely so a wholesale ignore is seen. |
| `cadence-core/templates/config.json` is the engine template. | new-project.md:47 | accurate | |
| Defaults are research off, plan check on, verifier on. | new-project.md:51 | accurate | |
| The seven keys read via `config.mjs get` all resolve. | new-project.md:57-60 | accurate | |
| `cadence-core/templates/PROJECT.md` exists. | new-project.md:134 | accurate | |
| The protected-branch guard lives in `references/git-guard.md`. | new-project.md:146 | accurate | |
| Dispatch via the spawn-agent seam with timeout `workflow.subagent_timeout`. | new-project.md:161 | accurate | |
| The research agent is the only Cadence dispatch path with no `maxTurns` bound, and `maxTurns` is per-FILE frontmatter. | new-project.md:179-181 | accurate | All 19 files in `agents/` carry `maxTurns`. |
| A 20th rung file would cost a `route-table.json` rung row plus both directions of self-verify's rung checks. | new-project.md:182-184 | accurate | |
| Category questions batch up to 4 per AskUserQuestion call. | new-project.md:213 | accurate | `references/seams.md`. |
| `cadence-core/templates/REQUIREMENTS.md` exists. | new-project.md:237 | accurate | |
| Traceability rows are seeded per phase by `/cad-plan`. | new-project.md:240,269 | accurate | `plan.md` step `commit` runs `seed-reqs`. |
| `granularity`: coarse 3-5, standard 5-8, fine 8-12. | new-project.md:256-257 | accurate | Verbatim in `config.schema.json:7`. |
| `cadence-core/templates/ROADMAP.md` exists. | new-project.md:266 | accurate | |
| `cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"` is a valid call. | new-project.md:293-294 | accurate | |
| A phase directory is `.planning/phases/<N>/` with no zero-padding and no slug suffix. | new-project.md:297-301 | accurate | `PHASE_DIR_NAME = /^[1-9]\d*(?:\.\d+)?$/`. |
| STATE.md is a 4-line cursor. | new-project.md:358 | accurate | `renderCursor`. |

### cadence-core/workflows/phase.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| A phase number appears in four places: ROADMAP list, `.planning/phases/<N>/`, the REQUIREMENTS Phase column, the STATE cursor. | phase.md:4-6 | accurate | `renumber` edits exactly those. |
| The renumber mechanics live in the planning seam's `renumber` subcommand. | phase.md:7 | accurate | |
| `cursor set` requires `--phase` and does not preserve the prior one, so `cursor get` first is not optional. | phase.md:18-20 | accurate | |
| `renumber insert --at <N> --dry-run` is the dry-run form. | phase.md:30 | accurate | |
| The dry-run returns `ops`, `in_text_refs` and `warn`. | phase.md:32 | accurate | |
| Insert moves dirs high-to-low via `git mv`, shifts `Phase K`/`phases/K/` at or above N, re-points the cursor. | phase.md:36-38 | accurate | |
| The insert output carries `slot` for the empty numbered slot. | phase.md:39 | accurate | |
| `renumber remove --n <N> --dry-run` returns `orphaned_reqs`. | phase.md:51-53 | accurate | |
| Remove drops the list line and detail section, `git rm`s the dir, renumbers low-to-high, re-points the cursor. | phase.md:54-57 | accurate | |
| Orphaned rows' Phase cells are blanked and surface as `no-phase` in /cad-audit. | phase.md:56-57 | accurate | `planning.mjs:2370`; break code at `:1011`. |
| A failed apply returns `ok:false` with a `completed` list; the seam is not transactional. | phase.md:62-64 | accurate | `reason: 'partial-apply'`. |
| `planning.mjs status` is the sanity spot-check. | phase.md:65 | accurate | |
| The protected-branch guard is in `references/git-guard.md`. | phase.md:67 | accurate | |

### cadence-core/workflows/plan-gaps.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `planning.mjs uat status --phase <N>` reads the outstanding items. | plan-gaps.md:10 | accurate | |
| A missing checklist returns `no-uat`. | plan-gaps.md:13 | accurate | |
| `.planning/phases/<N>/UAT.md` holds the item detail. | plan-gaps.md:15 | accurate | |
| plan.md has a `spawn_planner` step to rejoin. | plan-gaps.md:19 | accurate | |

### cadence-core/workflows/plan.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `(D-03)` names the decision that recall's backend-off return is a backstop, not this workflow's gate. | plan.md:102 | unverifiable | A bare decision id naming no phase or file; the CONTEXT that held it is not in the live `.planning/` tree nor in any `_archive-*` milestone, so it cannot be resolved mechanically. |
| `(D-01 / cache discipline)` names the decision that recall snippets ride the dispatch prompt. | plan.md:118 | unverifiable | Same reason; the `cache discipline` half resolves (`references/seams.md:191`), the `D-01` half does not. |
| 4 flags, not ~20. | plan.md:8 | accurate | `parse` documents exactly four arguments. |
| `planning.mjs status` returns `current` and a `phases[]` showing which phases still need plans. | plan.md:19-21 | accurate | |
| `ok:true` with `cycle: "none"` and an empty `phases[]` is a derived closed milestone. | plan.md:22-24 | accurate | |
| `--gaps` loads `cadence-core/workflows/plan-gaps.md`. | plan.md:30 | accurate | |
| The eight-key `config.mjs get` batch is valid. | plan.md:36-40 | accurate | |
| `fire(trigger)` takes gates from the routing bundle (`route.mjs resolve`). | plan.md:43-45 | accurate | |
| `config.mjs get` returns the schema DEFAULT for a gate no layer set. | plan.md:46-47 | accurate | Verified against a nonexistent config file. |
| `memory.backend` gates recall in spawn_planner and inline_plan. | plan.md:50-51 | accurate | |
| `workflow.inline_plan_threshold` is the inline routing threshold. | plan.md:74 | accurate | |
| `trace append --phase --family lifecycle --event dispatch --plan --role --read` is a valid call. | plan.md:88 | accurate | |
| `planning.mjs recall "<terms>"` is the recall call. | plan.md:110 | accurate | |
| Recall returns `{ok, results:[{score, source, phase?, snippet}]}`. | plan.md:113 | accurate | `planning.mjs:1594-1600`. |
| seams.md states a cache discipline for dispatch prompts. | plan.md:119,155 | accurate | `references/seams.md:191`. |
| `workflow.max_plan_tasks` is the ceiling and the planner returns `## PHASE TOO BIG` above it. | plan.md:132 | accurate | `skills/cad-planner-contract/SKILL.md:153`. |
| `cadence-core/templates/PLAN.md` exists. | plan.md:143 | accurate | |
| `trace append ... --event return ... --tokens <n>` is valid, and `--tokens` may be omitted. | plan.md:191 | accurate | |
| `trace append ... --event checkpoint ... --detail` is valid. | plan.md:199 | accurate | |
| `## PLANNING COMPLETE` is a planner return marker. | plan.md:202 | accurate | |
| `plan-overlap` means plans sharing a file cannot run concurrently. | plan.md:206-210 | accurate | |
| `offer_consult` is defined in `references/consult.md`. | plan.md:211 | accurate | |
| The Task ceiling feeds the checker's dimension 6. | plan.md:233 | accurate | Dimension 6 (Proportionality) names `Task ceiling` explicitly. |
| The checker returns `## VERIFICATION PASSED` or `## ISSUES FOUND` with BLOCKER/WARNING findings. | plan.md:241-242 | accurate | |
| WARNING means quality is degraded but execution can proceed. | plan.md:262-263 | accurate | |
| `--attempt 2` makes the routing seam climb to the retry rung the cell names. | plan.md:271-273,311 | accurate | `route.mjs:458`. |
| The `plan` gate defaults to adjudicated. | plan.md:342-343 | accurate | `config.schema.json:80`. |
| `cadence-core/references/triage-gate.md` exists. | plan.md:349 | accurate | |
| `planning.mjs seed-reqs --phase {N}` exists. | plan.md:360 | accurate | |
| seed-reqs inserts `\| <id> \| Phase {N} \| Pending \|` for `## Active`-bounded declared ids, idempotently. | plan.md:364-367 | accurate | |
| It reports `orphan_ids`, `no_active_section: true`, and always Pending status. | plan.md:367-372 | accurate | |
| `cursor set --phase {N} --status planned --next "/cad-execute {N}"` is valid. | plan.md:379 | accurate | |
| `references/git-guard.md` rail 1 is the protected-branch guard. | plan.md:383 | accurate | |

### cadence-core/workflows/progress.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The trace file is written by the seams and by the execute and verify workflows. | progress.md:172-173 | stale | Five workflows write `trace append` now, not two: `context.md`, `plan.md`, `execute.md`, `verify.md`, `verify-deep.md` - plus the reviewer bracket in `references/review-triggers.md`. Phase 4 added the `plan.md` sites. |
| `planning.mjs status` is the derivation. | progress.md:18 | accurate | |
| Derived statuses are unplanned -> planned -> executed -> complete, with UAT counts. | progress.md:23-25 | accurate | `planning.mjs:147,364`. |
| `current` is the lowest non-complete phase, null when all complete. | progress.md:26 | accurate | |
| `cycle` is present and `"none"` only for a derived closed milestone. | progress.md:28-30 | accurate | |
| `references/roadmap-phases.md` holds the grammar. | progress.md:31 | accurate | |
| `cursor` carries `agrees`, already computed. | progress.md:32-34 | accurate | |
| `drift[]` kinds are `cursor`, `roadmap-box`, `req-status`, `phase-dir`, `phase-dir-grammar`. | progress.md:36-37 | accurate | All five emitted. |
| `ok:false` with `no-planning-dir` is the no-project reason. | progress.md:39-40 | accurate | |
| Cursor drift is repaired through `cursor set`. | progress.md:56-59 | accurate | |
| Status mapping unplanned/planned/executed/all-complete are legal cursor statuses. | progress.md:61-64 | accurate | |
| A closed-milestone cursor set with no `--name`/`--total` derives "no active cycle" and 0. | progress.md:65-68 | accurate | |
| `trace render --phase <current>`. | progress.md:92 | accurate | |
| Four family counts `routing`, `provider`, `lifecycle`, `outcome` under one `corr`. | progress.md:95 | accurate | |
| The `roles` block carries a token total, a dispatch count, and `unrecorded` when present; an absent total prints `unrecorded`, never 0. | progress.md:96-102 | accurate | |
| A render carrying no `roles` key prints nothing for it. | progress.md:104 | accurate | |
| `unpaired` names a worker with no return, checkpoint or escalation. | progress.md:105-107 | accurate | |
| `capped` true means the record hit its size bound. | progress.md:107-109 | accurate | `MAX_TRACE_BYTES = 1048576`. |
| An absent trace file returns `ok:true` with empty counts. | progress.md:109-110 | accurate | |
| `workflow.skip_discuss` selects /cad-plan over /cad-context. | progress.md:138 | accurate | |

### cadence-core/workflows/spike.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The spike record lives at `.planning/spikes/<slug>/SPIKE.md`. | spike.md:20-21,45 | accurate | `.planning/spikes/` exists in this repo. |
| The SPIKE.md commit honors the protected-branch guard. | spike.md:51 | accurate | |

### cadence-core/workflows/task.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The `risk_surface` fire's artifact is refs, shape (a) `{base_ref: parent of the task's first commit, head_ref: HEAD}`. | task.md:75-77 | stale | The wiring table at `references/review-triggers.md:243` gives `risk_surface` only "(c) the flagged-diff FILE path the checkpoint returned, or (b) the staged-diff scope in-context". Shape (a) is not among the shapes that row admits, and every other `risk_surface` fire site (`verify.md:276`, `execute.md`) uses (b) or (c). The table is the reference. |
| Rail 1 is the protected-branch check plus base-integrity plus the integration-branch decision, not a bare branch check. | task.md:2-4 | accurate | |
| `cadence-core/references/git-guard.md` exists. | task.md:23 | accurate | |
| `workflow.test_command` is a config key. | task.md:46 | accurate | |
| Rail 2 is atomic conventional commits of specific files. | task.md:48 | accurate | |
| Planned tasks write `.planning/tasks/{slug}/PLAN.md`. | task.md:57 | accurate | `.planning/tasks/` exists. |
| cad-executor is dispatched via the spawn-agent seam. | task.md:63-64 | accurate | |
| The executor's report is `.planning/tasks/{slug}/reports/plan-1.md` and it returns a digest, not a table. | task.md:66-68 | accurate | |
| `planning.commit_docs` gates the plan-file commit. | task.md:69 | accurate | |
| `risk_surface` is blocking at every level. | task.md:80 | accurate | |
| Its re-arm is capped at ONE narrowed round, and that cap lives only in `triage-gate.md`. | task.md:80-83 | accurate | `triage-gate.md:14`. |

### cadence-core/workflows/undo.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| SUMMARY.md is the manifest - cad-execute writes commits-per-task with hashes there. | undo.md:4-5 | accurate | `templates/SUMMARY.md` has the commit table. |
| The phase's docs commit is `docs(<N>): ...`. | undo.md:10 | accurate | `execute.md:449`. |
| The dirty guard offers a stash through the ask-user seam. | undo.md:20-21 | accurate | |
| Only the protected-branch check of `git-guard.md` rail 1 applies to a committing revert. | undo.md:28-33 | accurate | |
| `git revert --no-edit`, `git revert --no-commit`, `git revert --abort`. | undo.md:35-42 | accurate | |
| `planning.mjs phase-done --n <N> --undo`. | undo.md:48 | accurate | |
| `cursor set --phase <N> --status <planned \| "ready to plan"> --next ...`. | undo.md:49 | accurate | |
| `--undo` unchecks the ROADMAP box and flips traceability rows back to Pending. | undo.md:54-55 | accurate | |

### cadence-core/workflows/verify-deep.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The dispatch bracket call with `--plan cad-verifier --role cad-verifier --read "..."` is valid. | verify-deep.md:13 | accurate | |
| `--plan` is the pairing key and `--role` the per-role grouping key. | verify-deep.md:8-11 | accurate | `trace.mjs:336`. |
| The verifier writes `.planning/phases/<N>/verifier-findings.json`. | verify-deep.md:21 | accurate | Same path read at `verify.md:257`. |
| The verifier contract lives at `skills/cad-verifier-contract`. | verify-deep.md:23 | accurate | |
| The close bracket `--event return ... --tokens` is valid, and `--tokens` is omitted when the return carries no figure. | verify-deep.md:34-42 | accurate | |
| `uat merge --phase <N> --payload <file>`. | verify-deep.md:48-50 | accurate | |
| Verifier results only fill `pending` items; a conflicting finding is skipped and counted. | verify-deep.md:54-56 | accurate | |
| Unmatched gaps append as new failed items; human checks append as pending. | verify-deep.md:56-57 | accurate | |
| An entry resolving to no usable item name is rejected and counted, never appended. | verify-deep.md:57-58 | accurate | `usableName` guard -> `no-usable-name`. |
| The seam's summary carries `auto_passed`, `gaps`, `added`, `skipped`, `rejected`. | verify-deep.md:61 | accurate | |
| The seam writes `.planning/phases/<N>/FINDINGS.json` with those counters plus `rejected_entries` and `skipped_entries`, overwriting on every successful merge. | verify-deep.md:64-70 | accurate | |
| The fall-through checkpoint call with `--tokens` and `--detail` is valid. | verify-deep.md:82 | accurate | |

### cadence-core/workflows/verify.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The seam owns first_pass set-once, verifier-never-overwrites-user, counts recomputed every write. | verify.md:14-18 | accurate | `planning.mjs:679,716-719`. |
| `--sweep` cold branch is `workflows/verify-sweep.md`; `--deep` is `workflows/verify-deep.md`. | verify.md:19-20,27,136 | accurate | |
| `planning.mjs cursor get` supplies the current phase. | verify.md:31 | accurate | |
| `uat status --phase <N>` is the state check and returns `counts`. | verify.md:38,41 | accurate | |
| `uat refresh --phase <N>` takes a stdin array of `{name, expected, criterion}`. | verify.md:47-48 | accurate | |
| Refresh appends only genuinely new names and never touches recorded results. | verify.md:50-52 | accurate | |
| A missing checklist reports `no-uat`. | verify.md:55 | accurate | |
| An item from a CONTEXT criterion carries `"criterion":"AC<N>"`. | verify.md:73-76 | accurate | Validated `^AC\d+$` at the payload face. |
| /cad-audit FAILs on a criterion no item names. | verify.md:77-78 | accurate | |
| Other-source items carry `"origin"`; the smoke item sends `"origin":"smoke"`. | verify.md:79-82 | accurate | |
| `uat init` writes `fields_version` before it looks at an item. | verify.md:85-87 | accurate | `planning.mjs:629-633`. |
| Legacy also requires a CONTEXT declaring no ids beside a fieldless checklist. | verify.md:87-89 | accurate | `planning-files.mjs:984-985`. |
| CONTEXT criteria may carry a `(human-verify: needs <tool/service>)` tag. | verify.md:92 | accurate | `references/acceptance-criteria.md:30`. |
| `uat init --phase <N>` takes the item array on stdin. | verify.md:106-107 | accurate | |
| `workflow.verifier: false` always skips the deep pass. | verify.md:114-115 | accurate | |
| `route.mjs resolve --role cad-verifier` is the stakes probe. | verify.md:120 | accurate | |
| Every `warnings[]` entry must be relayed. | verify.md:123-124 | accurate | `seams.md:131`. |
| `verify` on that line is `on` or `off`. | verify.md:126 | accurate | Live resolve returns `"verify":"on"`. |
| The seam refuses a resolve with no role. | verify.md:126-128 | accurate | |
| At stakes solo the deep verify pass is off. | verify.md:132-134 | accurate | |
| A suffix-tagged `(human-verify: ...)` item goes straight to pass 2. | verify.md:150-152,167 | accurate | |
| The deep pass writes `why_human` for every UNCERTAIN truth as well as every human-only check. | verify.md:157-160 | accurate | `cad-verifier-contract/SKILL.md:196-197`. |
| `blocked` is terminal: `next` offers only `pending`. | verify.md:169-170 | accurate | |
| `refresh` appends only unseen names. | verify.md:170 | accurate | |
| `route_failures`' reset is scoped to `status: fail`. | verify.md:171 | accurate | |
| Completion refuses a `blocked` item. | verify.md:171-172 | accurate | |
| `uat status` returns `status`, `counts`, `result` and `first_pending` alone. | verify.md:179-181 | accurate | `planning.mjs:927-931`. |
| `uat record --phase <N> --item <k> --result <r> --evidence "..." --source model` is valid. | verify.md:188-190 | accurate | `model` is in `UAT_SOURCES`. |
| `uat merge` atomically overwrites `phases/<N>/FINDINGS.json` on every success. | verify.md:194-197 | accurate | |
| The reply/result mapping uses only legal results (pass/skipped/blocked/fail). | verify.md:226-231 | accurate | |
| `uat record ... [--reported] [--severity] [--reason]` are recorded fields. | verify.md:241-243 | accurate | |
| The output's `next` field is the next pending item. | verify.md:245 | accurate | |
| A re-record with `--cause` adds the field and leaves first_pass safe. | verify.md:251-253 | accurate | |
| The verifier's gap carries `missing` and its human check carries `why_human`. | verify.md:257-262 | accurate | |
| The route_failures review fire uses shape (c), file paths. | verify.md:262-265 | accurate | |
| `cadence-core/references/triage-gate.md` exists and holds the triage rules. | verify.md:268-270 | accurate | |
| The commit-time `risk_surface` fire is shape (b), the staged-diff scope, blocking, re-arm capped at one narrowed round. | verify.md:276-282 | accurate | |
| `uat record --item <k> --result pending --fix "{hash}, retest"` is valid. | verify.md:283 | accurate | |
| `result: complete` means every item passed or was skipped with a reason. | verify.md:299-300 | accurate | |
| `trace append --phase <N> --family outcome --event uat_verdict --detail "..."` is valid. | verify.md:306 | accurate | |
| `phase-done --n <N>` checks the ROADMAP box and flips traceability rows to Complete, Deferred exempt. | verify.md:314-316 | accurate | |
| `cursor set --phase <N> --status "phase complete" --next ...` is valid. | verify.md:317-319 | accurate | |
| The commit stages UAT.md, `phases/<N>/FINDINGS.json` and `phases/<N>/verifier-findings.json`. | verify.md:323-327 | accurate | |
| The report distinguishes `{v} auto-verified` from `{m} model-executed`. | verify.md:333 | accurate | `source: verifier` vs `source: model`. |

### cadence-core/workflows/verify-sweep.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `planning.mjs status` is the one seam call. | verify-sweep.md:9 | accurate | |
| `phases[]` already carries each phase's derived state and UAT counts. | verify-sweep.md:11-12 | accurate | |
| A phase with status `executed` and no `uat` field was built and never verified. | verify-sweep.md:12-14 | accurate | |
| Open-failure phases are read from `.planning/phases/<N>/UAT.md`. | verify-sweep.md:20 | accurate | |
| The resume offer goes through the ask-user seam. | verify-sweep.md:28 | accurate | |
| verify.md has a `build_or_resume` step to return to. | verify-sweep.md:4,32 | accurate | |

---

## Cross-group notes

- `references/review-triggers.md:244`'s wiring table lists `phase_diff` as
  `off / off / adjudicated`, contradicting the live `route-table.json`
  (`off / advisory / adjudicated`). That file is outside this sweep's surface,
  but it is the shared root cause of the stale rows at `METHOD.md:276`,
  `METHOD.md:279`, `execute.md:382-383` and `execute.md:387-388`, and
  `docs/WORKFLOW.md:168` carries the same row. Four of the 18 stale claims are
  one fact.
- The two `audit.md` rows share a single false premise about the requirement-id
  admission regex, confirmed by running `planning.mjs audit` against a scratch
  planning tree.
- `skills/cad-plan-checker-contract/SKILL.md` states "Check six dimensions" in
  its `<dimensions>` block while its own `<success_criteria>` still says "All
  five dimensions checked" - the same drift `METHOD.md:91` carries, one file
  over and outside this surface.
