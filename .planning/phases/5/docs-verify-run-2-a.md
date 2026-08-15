# `/cad-docs-verify` run 2 — half A

Sweep date: 2026-08-14
HEAD sha the docs were read at: `4602393ca9cf08122fca523b1e44495fe6a2de91`
Branch: `cadence/v3.3.0`

This is a FRESH extraction under `cadence-core/workflows/docs-verify.md` steps
2-4. It does not read `.planning/DOCS-CLAIMS.md` rows — the ledger join happens
in plan 3, on `doc` plus claim TEXT. Per step 5 the sweep STOPS at the report:
no document under `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` or
`cadence-core/workflows/` is edited here.

## Invocations run in half A

Transcribed byte-identically from `.planning/DOCS-CLAIMS.md:28` and `:29`
(numbering prefix dropped), per phase 5 D-01 — run 1's recorded invocations are
re-run unchanged so run 2's counts stay comparable against run 1's
509/18/20 = 547.

1. `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`
2. `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`

Invocations 3 and 4 are carried by half B,
`.planning/phases/5/docs-verify-run-2-b.md`.

## Surface

Fourteen files, 185,264 B (`wc -c`, measured 2026-08-14 at the sha above):

Listed as a bullet list, not a table, so that every `^| ` line in this report is
a claim row and the closing count can be checked mechanically.

- `README.md` — 23172 B
- `METHOD.md` — 33050 B
- `INTERNALS.md` — 16611 B
- `CONTRIBUTING.md` — 4093 B
- `cadence-core/workflows/audit.md` — 12912 B
- `cadence-core/workflows/config.md` — 11545 B
- `cadence-core/workflows/config-review.md` — 3859 B
- `cadence-core/workflows/context.md` — 20033 B
- `cadence-core/workflows/coverage.md` — 4034 B
- `cadence-core/workflows/debug.md` — 6911 B
- `cadence-core/workflows/decision-review.md` — 10754 B
- `cadence-core/workflows/docs-verify.md` — 2796 B
- `cadence-core/workflows/execute.md` — 25289 B
- `cadence-core/workflows/milestone.md` — 10205 B

Total: 185264 B

## Constraints this half runs under

Two constraints run 1 ran under still hold and are restated here:

- `CONTRIBUTING.md` has no mechanical check over it — `cadence-core/bin/self-verify.mjs`
  lints only `README.md`, `INTERNALS.md` and `METHOD.md` — so it is swept by
  hand end to end.
- `CONTRIBUTING.md`'s "the same three checks CI runs" is decided against
  `.github/workflows/test.yml` rather than left `unverifiable`.

## Coverage checklist

Ticked only when that file's claim table is written into this report. An
unticked box at the end of the sweep means the surface was truncated, not that
the sweep agreed with itself.

- [x] README.md
- [x] METHOD.md
- [x] INTERNALS.md
- [x] CONTRIBUTING.md
- [ ] cadence-core/workflows/audit.md
- [ ] cadence-core/workflows/config.md
- [ ] cadence-core/workflows/config-review.md
- [ ] cadence-core/workflows/context.md
- [ ] cadence-core/workflows/coverage.md
- [ ] cadence-core/workflows/debug.md
- [ ] cadence-core/workflows/decision-review.md
- [ ] cadence-core/workflows/docs-verify.md
- [ ] cadence-core/workflows/execute.md
- [ ] cadence-core/workflows/milestone.md

---

# Invocation 1 - `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`

## README.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The git rails are a PreToolUse hook, and every push the model tries stops and asks first | README.md:30 | accurate | `hooks/hooks.json` wires PreToolUse/Bash to `git-guard.mjs`; `git-guard.mjs:199-203` asks on every `push` verb with no exemption |
| `isPlainPush` was deleted; the one sanctioned push runs in a separate subprocess built from an argument vector | README.md:32 | accurate | no code occurrence of `isPlainPush` anywhere; `git-publish.mjs:141,:194` run `execFileSync('git', [...argv])` |
| v2.2.0 deleted 2,251 lines of the shell tokenizer | README.md:34 | accurate | `CHANGELOG.md:1312` states the same figure |
| What the guard reads now is eighty-five lines: a command counts if it starts with the word `git` | README.md:34 | accurate | `cadence-core/bin/lib/git-segments.mjs` is exactly 85 lines; `:74` admits a segment only when the command word is `git` |
| `bash -c "git push"` is invisible, and that is written down rather than discovered | README.md:34 | accurate | `git-segments.mjs:20` states the anchor; `references/git-publish.md` rail 3 lists the accepted-cost shapes |
| The default reviewer is a fresh-context Claude subagent needing no API key | README.md:36 | accurate | `review.reviewers` default is `["claude-subagent"]` |
| OpenAI and Gemini enforce the output schema themselves; DeepSeek has no server-side schema, so its adapter puts the schema in the prompt and asserts the returned shape | README.md:36 | accurate | `review-provider.mjs:634` (`json_schema` strict), `:670` (`responseSchema`), `:701` (DeepSeek `response_format: json_object`) |
| Up to four independent voices on one plan | README.md:36 | accurate | `review.reviewers` is an `array_enum` over four backends: `claude-subagent`, `openai`, `gemini`, `deepseek` |
| What survives adjudication is a numbered list you triage, defaulting to none, as a multi-select prompt | README.md:36 | accurate | `cadence-core/references/triage-gate.md` states the tapped multi-select with NONE first and default |
| `METHOD.md`, `INTERNALS.md`, `docs/WORKFLOW.md` and `docs/EVIDENCE.md` all exist | README.md:38 | accurate | all four present |
| Routing is one question out and four knobs back - model, effort rung, review gates, deep verify | README.md:38 | accurate | `route.mjs resolve` returns `model`, `effort`, `review`, `verify` in one bundle |
| `docs/WORKFLOW.md` is five figures and the four tables behind them | README.md:38 | accurate | 5 image refs (`WORKFLOW.md:19,70,92,125,137`), 5 files in `docs/figures/`, 4 pipe tables |
| `docs/EVIDENCE.md` defines the three weight terms and gives the `weight.mjs` commands | README.md:38 | accurate | `EVIDENCE.md:20` "## The three terms" - eager, reachable, dispatch - and `:52`, `:59` |
| The install snippet's marketplace URL is `https://git.jcrenshaw.dev/crenshawdev/cadence.git` | README.md:10 | accurate | matches `.claude-plugin/plugin.json` `homepage` and the `origin` remote's host and path; network reachability is out of scope for a static check |
| `/plugin install cadence@cadence` names an existing marketplace and plugin | README.md:11 | accurate | `.claude-plugin/marketplace.json` `name` and `plugins[0].name` are both `cadence` |
| `/plugin update cadence@cadence` and `/plugin uninstall cadence@cadence` | README.md:14 | unverifiable | host command surface; nothing in this repo defines or constrains those spellings |
| Requires `node` and `git` on PATH | README.md:14 | accurate | `hooks/hooks.json` invokes `node`; the seams shell out to `git` (`git-publish.mjs:59`) |
| The scripts inside are zero-dependency: there is no npm install, ever | README.md:14 | accurate | every import under `cadence-core/bin/**` is a `node:` builtin or a relative path; no bare specifier anywhere |
| One key sets the routing axis: `/cad-config stakes=shipped` | README.md:45 | accurate | `config.schema.json` `stakes`, enum solo/shipped/critical, default `shipped` |
| A grid of 18 cells, one per level and role pair | README.md:50 | accurate | `route-table.json` `cells`: 3 levels x 6 roles |
| At `solo` the planner runs Sonnet at `high` | README.md:50 | accurate | `cells.solo["cad-planner"]` = sonnet / high / xhigh |
| At `shipped` the planner runs Opus | README.md:50 | accurate | `cells.shipped["cad-planner"].model` = opus |
| At `critical` the planner runs Opus at `xhigh` and a retry goes to `max` | README.md:50 | accurate | `cells.critical["cad-planner"]` = opus / xhigh / max |
| The whole thing is `cadence-core/route-table.json` | README.md:50 | accurate | file present, holds all three grids |
| The rungs are `low`, `medium`, `high`, `xhigh`, `max` | README.md:52 | accurate | `route-table.json` `rung_order` |
| Effort is fixed in an agent file's frontmatter, so a rung is a real file and self-verify fails in both directions | README.md:52 | accurate | 19 files under `agents/`; `self-verify.mjs:35-37` and `:1033-1087` check both directions |
| `model.escalate_on_failure` is off by default | README.md:54 | accurate | schema `bool`, default `false` |
| Each trigger gets a gate: `off`, `advisory`, `blocking`, `adjudicated` | README.md:56 | accurate | `route-table.json` `gates` |
| A plan review is advisory at `solo` and `shipped`, adjudicated at `critical` | README.md:56 | **stale** | advisory at `solo`, **`off`** at `shipped`, adjudicated at `critical` - `route-table.json` `review.shipped.plan` is `"off"`, and `METHOD.md:287`'s own trigger table already states `off` for `shipped` |
| The `risk_surface` trigger is blocking at every level including `solo` | README.md:56 | accurate | `route-table.json` `review.*.risk_surface` = blocking at all three |
| The eight surfaces are auth, billing, secrets, migrations, destructive, concurrency, API contracts, untrusted input | README.md:56 | accurate | `route-table.json` `risk_surface_categories` holds exactly those eight tokens |
| `review.triggers.risk_surface.surfaces` narrows the list, and leaving it unset keeps all eight | README.md:56 | accurate | schema `array_enum`, `default: null`; a resolve with no answer returns all eight with `surfaces_answered: false` |
| The subset is populated from a structural scan of manifests and directories rather than keyword greps | README.md:56 | accurate | `lib/surface-scan.mjs:22` states "Never a keyword grep of source text" and reads manifests plus category directories |
| The list is checked against the diff itself, once per plan, on the completed commit range | README.md:58 | accurate | the `risk_surface` row in `references/review-triggers.md` states "never mid-plan", pinned by `prose-agreement.test.mjs:277` |
| The dispatch-time file-NAME detector that raised a whole phase is gone as of v2.7.0 | README.md:58 | accurate | `route.mjs:61-68` "THERE IS NO RISK FLOOR"; the `risk.override.<surface>` family is retired in `lib/retired-keys.mjs` |
| Deep verification is off at `solo` and on at `shipped` and `critical` | README.md:60 | accurate | `route-table.json` `verify` = off / on / on |
| Commands are namespaced `/cadence:cad-*` | README.md:64 | accurate | plugin name is `cadence` in both `.claude-plugin` manifests |
| The five loop commands `/cad-new-project`, `/cad-context`, `/cad-plan`, `/cad-execute`, `/cad-verify` exist | README.md:66-70 | accurate | one `skills/<name>/SKILL.md` each |
| `/cad-adopt` is the second door into step 1 | README.md:72 | accurate | `skills/cad-adopt/` plus `cadence-core/workflows/adopt.md` |
| `/cad-new-project --brief <file>` | README.md:74 | accurate | `skills/cad-new-project/SKILL.md:4` argument-hint; `workflows/new-project.md:19` |
| `docs/DISCOVERY.md` | README.md:74 | accurate | present |
| `/cad-progress` auto-resumes incomplete work | README.md:76 | accurate | `workflows/progress.md:6` "Includes auto-resume of incomplete or paused work" |
| `docs/figures/phase-loop.svg` | README.md:78 | accurate | present |
| `docs/WORKFLOW.md` carries all fifteen decision points | README.md:80 | accurate | `WORKFLOW.md:32` "There are fifteen"; its section-2 table carries exactly 15 data rows |
| `docs/WORKFLOW.md` carries the eighteen-cell stakes grid | README.md:80 | accurate | `WORKFLOW.md:101` "Eighteen cells", 6 role rows x 3 level columns, matching `route-table.json` cell for cell |
| `/cad-debug` runs hypotheses that survive a clear; `/cad-capture` parks a todo | README.md:95 | accurate | `workflows/debug.md` state file; `skills/cad-capture/SKILL.md` |
| `trace suggest` turns the milestone's trace into evidence-backed retune suggestions and applies none | README.md:97 | accurate | `planning.mjs:2928` dispatches `trace suggest`; `lib/trace-suggest.mjs` emits `kind: 'suggest'` rows |
| `/cad-milestone` audits, bumps the version and prunes completed phases; the tag is cut by `/cad-land` after the merge | README.md:97, :115 | accurate | `workflows/milestone.md:6`, `:68`, `:189` |
| `/cad-land` asks push / MR or PR / tag / leave local with no preselected default | README.md:97, :116 | accurate | `skills/cad-land/SKILL.md:3` states exactly that ask and "Never decides how you publish" |
| `/cad-help` prints the full reference and `/cad-help <name>` shows one entry | README.md:103 | accurate | `skills/cad-help/SKILL.md:3-4`, argument-hint `[command name]`, backed by `references/COMMANDS.md` |
| All 21 commands listed under Review & quality, Lifecycle & git and Support exist | README.md:106-130 | accurate | one `skills/<name>/` directory per entry; 27 command skills once the 6 loop and progress entries are added |
| `/cad-capture --cadence` routes friction with Cadence to Cadence's own queue | README.md:124 | accurate | `skills/cad-capture/SKILL.md:4`, `:13`, `:27`; `references/COMMANDS.md:48` |
| Usage figures: 7,548 requests, 2,845 Cadence, ~92k/28c against ~133k/36c, 27% against 8% Sonnet-Haiku routing | README.md:136 | unverifiable | account usage data measured 2026-07-26; nothing in the tree records or reproduces it, and the paragraph says so |
| Cadence ships no instrumentation and phones nothing home | README.md:136 | accurate | the only network egress under `cadence-core/bin/**` is `review-provider.mjs` calling the provider the user configured |
| v2.3.0 turn-one figures: 231,422 to 199,687 B overall, `/cad-pause` 18,523 to 8,197, `/cad-land` 36,235 to 31,016 | README.md:140 | unverifiable | the sentence states these are a measurement taken at v2.3.0 and explicitly not a reading of today's tree |
| Skill and agent descriptions went from 8,550 bytes to 5,397 | README.md:140 | unverifiable | same historical-measurement basis; the live figure comes from `weight.mjs` |
| `node cadence-core/bin/weight.mjs resident --root .` reports the current numbers | README.md:140 | accurate | `weight.mjs:41` dispatches the `resident` subcommand |
| A subagent's full output no longer stays resident: it writes a file and the parent keeps a five-field digest | README.md:140 | accurate | `skills/cad-executor-contract/SKILL.md` `<report_file>` and `<report>` - `reports/plan-<k>.md` plus a five-field return |
| GSD's figures: 71 skills, 34 agents, 46 capabilities, 1.1M words, and ~3% documentary mass at commit `d010ea1` | README.md:146 | unverifiable | the GSD tree is not in this repo; `LINEAGE.md:11-21` states the same figures and its own reproduction method |
| Today it is 27 skills | README.md:146 | accurate | 33 directories under `skills/`, of which 6 are the `*-contract` agent contracts, leaving 27 command skills |
| ...and 6 agent roles across 19 rung files | README.md:146 | accurate | `route-table.json` `roles` lists 6; `agents/*.md` is 19 files |
| `DESIGN.md`, `INTERNALS.md`, `LINEAGE.md` and `MANIFESTO.md` exist | README.md:148 | accurate | all present |
| CI fails the build when the prose drifts from the code | README.md:148 | accurate | `.github/workflows/test.yml` runs `self-verify.mjs` as its own job |
| `LICENSE` and `NOTICE.md` exist | README.md:150 | accurate | both present |

## METHOD.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `skills/cad-planner-contract/SKILL.md` is where goal-backward planning lives | METHOD.md:20, :639 | accurate | file present |
| The planner derives 3 to 7 observable truths, then artifacts, then wiring | METHOD.md:26-31 | accurate | the contract states the same fixed order |
| Every task has exactly three fields: Files, Action, Verify | METHOD.md:48-57 | accurate | `cadence-core/templates/PLAN.md` and the planner contract state the same three |
| Action names symbols that already exist and never invents an identifier, signature or call path | METHOD.md:52-54 | accurate | pinned in both directions by `prose-agreement.test.mjs:207-255` |
| Verify is the task's authority: any implementation that satisfies it is authorized | METHOD.md:55-57 | accurate | the same test asserts `AUTHORITY` in the template, the planner contract and the executor contract |
| A task touching more than about five files is usually two tasks | METHOD.md:60 | unverifiable | a nudge stated as guidance, with no seam that counts files per task |
| Scope-reduction language is prohibited and the only legitimate out is `## PHASE TOO BIG` | METHOD.md:69-74 | accurate | the planner contract and `workflows/plan.md` both carry the `PHASE TOO BIG` return |
| The plan check is opt-in via `workflow.plan_check` | METHOD.md:86 | accurate | schema `bool`, default `false` |
| The checker checks six dimensions, and proportionality asks about `workflow.max_plan_tasks` | METHOD.md:93-96 | accurate | `skills/cad-plan-checker-contract/SKILL.md:42` "Check six dimensions" enumerating 6; `workflow.max_plan_tasks` is an `int` defaulting to 8 |
| The executor states the exact expected output before running Verify, and a surprise result is a `[deviation]` | METHOD.md:111-115 | accurate | `skills/cad-executor-contract/SKILL.md` process step 2 states it verbatim |
| Generalized from Karpathy's "A Recipe for Training Neural Networks", with no switch for it | METHOD.md:117-119 | accurate | no config key gates the prediction step |
| A deviation is exactly one thing: an acceptance criterion or locked decision turned out wrong | METHOD.md:130-134 | accurate | the executor contract's `<deviation_rules>` states the same single definition |
| The circuit breaker is three fix attempts per task | METHOD.md:143-145 | accurate | the contract states three bounded attempts, with the static-analysis carve-out |
| A failed package install is never auto-fixed and returns a `blocked` checkpoint | METHOD.md:147-152 | accurate | the contract states it as an absolute |
| Commit protocol: stage the specific files individually, never `git add -A`, never `git add .` | METHOD.md:156-157 | accurate | the contract's `<commit_protocol>` step 1 |
| "Then check the staged diff against the risk-surface list before committing" | METHOD.md:157-158 | **stale** | the executor no longer checks a staged risk diff at all. `risk_surface` fires ONCE against the plan's completed commit range, which METHOD.md:415 itself states, and `prose-agreement.test.mjs:269-273` asserts the executor contract carries neither a `risk_surface` checkpoint nor a `git diff --cached`. Correct: stage the files, run the lease gate (`planning.mjs lease-check`), commit, then take the post-commit glance |
| Commit message shape `{type}({scope}): {description}` and a post-commit glance | METHOD.md:158-159 | accurate | the contract's `<commit_protocol>` steps 3 and 5 |
| Executors never push, never write `STATE.md`/`ROADMAP.md`/`SUMMARY.md`, never spawn their own reviewer | METHOD.md:161-163 | accurate | the contract's `<never>` block |
| The parallel path opens only when the seam intersects the plans' declared file lists pairwise, and any overlap forces sequential | METHOD.md:169-174 | accurate | `planning.mjs plan-overlap` plus the gate in `workflows/execute.md` |
| `phase_diff` is parallel-path only | METHOD.md:176-180 | accurate | the wiring table's `phase_diff` row names `/cad-execute`'s parallel path |
| In parallel mode `git stash`, `git clean`, blanket `git reset --hard` and `git restore .` are forbidden | METHOD.md:184-187 | accurate | `cadence-core/references/worktree-executor.md:39-40` |
| Verification climbs four levels: exists, substantive, wired, behaves | METHOD.md:199-207 | accurate | `skills/cad-verifier-contract/SKILL.md` |
| UNCERTAIN counts toward neither side of the score | METHOD.md:210-212 | accurate | the verifier contract states it |
| The executor's goal check requires a `file:line` or command output behind every concrete claim | METHOD.md:216-219 | accurate | the goal-check step in `cadence-core/workflows/execute.md` |
| Anti-pattern scan covers TODO, FIXME, XXX, HACK, "placeholder", "not implemented", `todo!()` | METHOD.md:230-232 | accurate | the verifier contract's scan list |
| A `CADENCE-DEBT` marker is exempt because its ceiling and trigger fields ARE the reference | METHOD.md:234-236 | accurate | `lib/debt-markers.mjs:2-6` states the grammar with `ceiling:` and `trigger:` fields |
| Spot-checks are two to four, each under ~10 s, at most one full-suite run | METHOD.md:240-243 | accurate | the verifier contract states the bound |
| The coverage definition lives in `cadence-core/workflows/coverage.md` | METHOD.md:249, :646 | accurate | file present, carrying the "would signal that this requirement regressed" definition |
| Every second opinion goes through one `fire(trigger)` procedure, the rule stated in `references/conventions.md` | METHOD.md:278-281 | accurate | both files present and state it |
| The trigger table's `shipped` gates: `plan` off, `diff` off, `risk_surface` blocking, `phase_diff` off | METHOD.md:287-290 | accurate | matches `route-table.json` `review.shipped` exactly |
| `risk_surface` is fired by execute, debug, task and verify | METHOD.md:289 | accurate | pinned by `prose-agreement.test.mjs:156` |
| Exactly one of the four fires on its own at the default `shipped` level | METHOD.md:292-293 | accurate | only `risk_surface` is non-`off` in `review.shipped` |
| `review.mode` is `single`, `panel` or `adjudicated`, and the gate wins where they disagree | METHOD.md:302-305 | accurate | schema enum with those three values, default `adjudicated` |
| "a `plan` review is advisory at `solo` and `shipped` and adjudicated at `critical`" | METHOD.md:309-310 | **stale** | advisory at `solo`, **`off`** at `shipped`, adjudicated at `critical` - contradicted by this document's own table at METHOD.md:287 and by `route-table.json` `review.shipped.plan` |
| An ordinary `diff` is off at `solo` and `shipped`, and blocking at `critical` | METHOD.md:310-311 | accurate | `route-table.json` `review.*.diff` = off / off / blocking |
| `risk_surface` is blocking at all three levels | METHOD.md:311-312 | accurate | `route-table.json` |
| A gate typo loses to the level's gate and is named in the warnings | METHOD.md:312-315 | accurate | `route.mjs` checks a config gate against `route-table.json` `gates` and reports the disagreement in `warnings[]` |
| Every backend returns `{ findings: [ { file, line, severity, claim, failure_scenario } ] }` | METHOD.md:329-333 | accurate | `review-provider.mjs:557` requires exactly those five keys |
| The reviewer's stance and its four rules live in `skills/cad-reviewer-contract/SKILL.md` | METHOD.md:342-355 | accurate | pinned against `references/reviewer-brief.md` by `prose-agreement.test.mjs:477-508` |
| "the plan review in `/cad-plan`, advisory at `shipped` and adjudicated at `critical`" | METHOD.md:373-374 | **stale** | the plan review is `off` at `shipped`; it is advisory at `solo` and adjudicated at `critical` |
| `/cad-execute`'s per-plan diff review is `off` below `critical` | METHOD.md:375 | accurate | `route-table.json` `review.solo.diff` and `review.shipped.diff` are both `off` |
| `/cad-land`'s unattended close fires no review of its own and halts on a surviving blocker or high | METHOD.md:376-380 | accurate | `workflows/milestone.md:154-155` chains `/cad-land`; the close gate reads the `risk_surface` findings the branch already settled |
| Decision review rules `survives`, `partial` or `refuted`, and grounds via Context7 plus the real repo | METHOD.md:384-398 | accurate | `cadence-core/workflows/decision-review.md` |
| The eight risk-detection categories named in prose | METHOD.md:410-413 | accurate | one for one with `route-table.json` `risk_surface_categories` |
| It fires once, against the plan's completed commit range, never against a staged index mid-plan | METHOD.md:415-419 | accurate | the `risk_surface` row in `references/review-triggers.md`, pinned by `prose-agreement.test.mjs:277` |
| "Detection also sets a floor... that phase's `stakes` level is raised for the phase... Lowering it back takes a named per-surface `risk.override.<surface>`" | METHOD.md:421-428 | **stale** | there is no risk floor and no `risk.override.*` key. `route.mjs:61-68` states "THERE IS NO RISK FLOOR"; the whole `risk.override.<surface>` family is retired in `lib/retired-keys.mjs:66` onward and is absent from `config.schema.json`. What survives is the commit-time `risk_surface` review read off the diff, which moves no role's model and no role's rung |
| The destructive pre-filter drops only when `git check-ignore` matches AND `git ls-files` is empty | METHOD.md:430-435 | accurate | the detection section of `references/review-triggers.md` states both conditions |
| Consult's five rules live in `cadence-core/references/consult.md`, including `review.consult.attempt_threshold` | METHOD.md:448-464 | accurate | file present; the schema key is an `int` defaulting to 3 |
| Adjudicated review does not iterate review -> revise -> review | METHOD.md:468-470 | accurate | no such loop in any workflow |
| Audit break codes: `no-phase`, `no-plan`, `unpicked`, `phase-missing`, `not-verified`, `drift` | METHOD.md:500-509 | accurate | `planning.mjs:1087-1138` emits all six |
| Plan frontmatter referencing unknown requirement IDs is reported as an orphan | METHOD.md:511-513 | accurate | the audit's reverse direction in `planning.mjs` |
| The debug loop is hypothesize / predict-and-test / record / branch, in a file that survives `/clear` | METHOD.md:519-531 | accurate | `cadence-core/workflows/debug.md` |
| When `memory.backend` is `builtin`, the hypothesize step recalls past deviations and UAT findings | METHOD.md:533-535 | accurate | schema enum `none`/`builtin` defaulting to `builtin`; `debug.md` calls the recall seam |
| The guard reads a command as `git` only in first-word position; wrapped or substituted invocations are invisible | METHOD.md:549-556 | accurate | `lib/git-segments.mjs:74` |
| `references/git-guard.md` and `references/git-publish.md` both exist and rail 3 lists what the guard misses | METHOD.md:541, :556, :649 | accurate | both files present |
| Two decisions are marked undefaulted in `references/seams.md`: the publish mechanism and the protected-branch guard | METHOD.md:558-562 | accurate | `references/seams.md` names both |
| `worktree.baseRef` is the HOST's setting, which the parallel path requires at `head` | METHOD.md:565-566 | accurate | `workflows/execute.md:125` ("the user's `worktree.baseRef` setting, not Cadence's"), `:133`, `:341` |
| `git.auto_branch`, `git.integration_branch` (`milestone` default, `trunk` escape hatch), `git.on_land_cleanup` | METHOD.md:567-570 | accurate | schema: enum ask/auto/off; enum milestone/trunk defaulting to `milestone`; bool defaulting to `true` |
| `git.auto_close` runs audit through merge with no per-step prompts and halts on a surviving blocker or high | METHOD.md:576-578 | accurate | schema bool default `false`; `git-publish.mjs:31`, `:65-71` reads it from the repo layer only |
| `STATE.md` is a four-line cursor, overwritten in place and never appended, written only by the seam | METHOD.md:586-589 | accurate | `references/conventions.md:94`, `templates/STATE.md:3` |
| Config is read only through the config seam, one call per key | METHOD.md:594-595 | accurate | `references/conventions.md` states the rule; `config.mjs get` is the only read face |
| Self-verify lints config keys, script invocations and plugin-root paths, plus the tools declaration | METHOD.md:603-605 | accurate | the checks in `self-verify.mjs`; CI runs it as its own job |
| The concurrency-phrasing lint: a block claiming a concurrent set must issue it in one message | METHOD.md:606-612 | accurate | `cadence-core/bin/lib/dispatch-phrasing.mjs` plus `dispatch-phrasing.test.mjs` |
| It weighs five surface sets against `cadence-core/bin/weight-budgets.json` and fails when one EXCEEDS its entry | METHOD.md:614-620 | accurate | agents, SKILL.md, workflows, `references/**`, `templates/**`; the budget check is a ceiling |
| The budget is a CEILING, not an equality | METHOD.md:622-626 | accurate | `self-verify.mjs`'s budget check fails only on an overrun |
| Every row of the "Where each rule lives" table points at a file that exists | METHOD.md:637-651 | accurate | all 12 targets present |

## INTERNALS.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Model is overridable at dispatch time; effort is frozen in the agent file's frontmatter | INTERNALS.md:9 | unverifiable | a statement about the Claude Code host's resolution order, verified by the author in July 2026; nothing in this repo can decide it |
| `cad-plan-checker-medium` and `cad-plan-checker-high` are the same contract at two depths | INTERNALS.md:11 | accurate | both files exist under `agents/`, and both preload `skills/cad-plan-checker-contract` |
| 19 files cover the six roles | INTERNALS.md:11 | accurate | `agents/*.md` is 19 files; `route-table.json` `roles` lists 6 |
| `cadence-core/bin/lib/rung-agent.mjs` states the rung-to-file map per role | INTERNALS.md:11 | accurate | file present, one frozen object per role |
| The assumptions-analyzer's unsuffixed file is its `xhigh` rung and the `-high` sibling is the lower one | INTERNALS.md:11 | accurate | `lib/rung-agent.mjs:42-44`: `high -> cad-assumptions-analyzer-high`, `xhigh -> cad-assumptions-analyzer` |
| CI refuses a rung a cell names with no file, and a rung file no cell reaches | INTERNALS.md:11 | accurate | `self-verify.mjs:35-37`, `:1033-1087` (`missing-rung-agent`) |
| CI refuses a rung file that carries any instruction of its own | INTERNALS.md:11 | accurate | `self-verify.mjs:946` calls `rungBodyIssue` |
| CI refuses a rung file whose frontmatter effort is not the rung the map filed it under | INTERNALS.md:11 | accurate | `self-verify.mjs:955-966` (`rung-effort-mismatch`) |
| One key, `stakes`, with three answers, set by `/cad-config stakes=shipped` | INTERNALS.md:13 | accurate | schema enum solo/shipped/critical |
| A cell is the whole quality bundle: model, start rung, retry rung, review gates, deep verify | INTERNALS.md:13 | accurate | `route.mjs resolve` returns all of them in one object |
| The routed vocabulary is `sonnet` and `opus`; `haiku` and `fable` are reachable only by a `model.overrides` pin | INTERNALS.md:13 | accurate | every `cells.*.model` is sonnet or opus; `route-table.json` `model_aliases` carries all four |
| A gate you set beats the level's, but a typo loses to the level's gate and gets named | INTERNALS.md:13 | accurate | `route.mjs` validates against `route-table.json` `gates` and reports in `warnings[]` |
| `model.escalate_on_failure` is off by default and climbs a retry to the rung its cell names | INTERNALS.md:13 | accurate | schema bool default `false`; `cells.*.retry` |
| "if the phase's own plan touches a declared risk surface... the level is raised for that phase, the reason says which surface and which file matched, and lowering it back takes a named per-surface override" | INTERNALS.md:13 | **stale** | there is no risk floor. `route.mjs:61-68`: "THERE IS NO RISK FLOOR... nothing here reads a plan's `files:` list, `route-table.json` carries no `surfaces` block... and the `risk.override.<surface>` waiver family is retired". The floor judged a file by NAME and was removed in v2.7.0; what remains is the commit-time `risk_surface` review, read off the diff, which moves no role's model and no role's rung |
| CI refuses a retry rung that sits below the rung it started on | INTERNALS.md:13 | accurate | stated as an enforced rule in `route-table.json` `_meta.cells` and checked by self-verify's rung-ladder pass |
| Routing governs dispatched subagents, not the main session | INTERNALS.md:15 | accurate | `route.mjs resolve` takes a `--role` from the routable set only |
| `route.mjs`, `route-table.json` (three grids, 18 cells), `lib/rung-agent.mjs`, `route.test.mjs` all exist | INTERNALS.md:17 | accurate | all four present; `cells` is 18 |
| Every `git push` through Bash stops and asks, no exceptions | INTERNALS.md:21 | accurate | `git-guard.mjs:199-203` |
| `isPlainPush` was built and deleted; four adversarial rounds, four bypasses | INTERNALS.md:23-26 | accurate | no code occurrence; `DESIGN.md:551` records it as reversal R2 |
| The sanctioned push is `git-publish.mjs`, an argv subprocess with a `--` end-of-options separator and strict branch and remote validation | INTERNALS.md:27 | accurate | `git-publish.mjs:141`; `lib/publish-decision.mjs:79-83` builds `['push','--set-upstream','--',rem,...]` |
| It refuses unless the repo opted into `auto_close` and HEAD is a non-protected branch | INTERNALS.md:27 | accurate | `git-publish.mjs:31-32`, `:65-71` (repo layer only) |
| Six push shapes were silent before v1.4.0 (`git -C`, `&`, `$()`, backticks, subshell, escaped quote, `bash -c`) | INTERNALS.md:31 | accurate | recorded in `CHANGELOG.md` and pinned as test rows in `git-segments.test.mjs` |
| The tokenizer was 2,251 lines with the tests | INTERNALS.md:33 | accurate | `CHANGELOG.md:1312` |
| The scan was O(K x N), 3.1GB at 224KB of input, V8 abort at 280KB | INTERNALS.md:35 | unverifiable | a measurement of deleted code; the code is gone and the figure cannot be re-run |
| `cadence-core/bin/lib/git-segments.mjs` is eighty-five lines, anchored on the command word | INTERNALS.md:37 | accurate | exactly 85 lines; `:74` |
| The invisible shapes are written down in `references/git-publish.md` rail 3, the CHANGELOG entry, and a pinned test row apiece | INTERNALS.md:37 | accurate | all three surfaces present |
| Every file in the push-guard "Read the code" line exists | INTERNALS.md:39 | accurate | `git-guard.mjs`, `lib/git-segments.mjs`, `git-segments.test.mjs`, `git-publish.mjs`, `lib/publish-decision.mjs`, `git-guard.test.mjs`, `git-publish.test.mjs` |
| Live detection asks OpenAI's models endpoint and Gemini's ListModels | INTERNALS.md:45 | accurate | `review-provider.mjs:655` (`/v1/models`), `:687` (`/v1beta/models`) |
| `references/model-hints.json` is the soft hint table and `references/provider-api.md` the wire shapes | INTERNALS.md:49 | accurate | both present |
| Cross-model reviewers are direct API calls, with OpenAI's Responses API `text.format` carrying a strict `json_schema` and Gemini's `responseSchema` | INTERNALS.md:55 | accurate | `review-provider.mjs:634` (`format: { type: 'json_schema', ..., strict: true }`), `:670` |
| The pure decision cores `close-decision`, `publish-decision`, `branch-decision`, `release-decision` live under `cadence-core/bin/lib` | INTERNALS.md:61, :65 | accurate | all four `.mjs` cores and all four `.test.mjs` files present |
| Eager bytes are the skill file plus its `@`-includes; reachable is eager plus one hop | INTERNALS.md:71 | accurate | `docs/EVIDENCE.md:26-34` and `lib/resident-weight.mjs` define them the same way |
| Dispatch weight never sums with the other two | INTERNALS.md:75 | accurate | `docs/EVIDENCE.md:40` states the same rule |
| `node cadence-core/bin/weight.mjs resident --root <repo root>` | INTERNALS.md:79 | accurate | `weight.mjs:41` |
| `lib/resident-weight.mjs` and `weight.test.mjs` exist | INTERNALS.md:81 | accurate | both present |

## CONTRIBUTING.md

Swept by hand end to end: `cadence-core/bin/self-verify.mjs` lints only
`README.md`, `INTERNALS.md` and `METHOD.md`, so no mechanical check covers this
file.

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `MANIFESTO.md` exists and is the thing to read first | CONTRIBUTING.md:3 | accurate | present |
| Cadence has no build step and no runtime dependencies | CONTRIBUTING.md:13 | accurate | no `package.json` at the repo root; nothing to build |
| Nothing under `cadence-core/bin/` imports anything but `node:` builtins | CONTRIBUTING.md:13 | accurate | every import specifier under `cadence-core/bin/**` is `node:*` or a relative path |
| Running Cadence never installs a package | CONTRIBUTING.md:13 | accurate | no install step in any workflow or seam |
| CI installs both packages for one job with `npm install --no-save --no-package-lock typescript @types/node` before `npx tsc` | CONTRIBUTING.md:13 | accurate | the typecheck job in `.github/workflows/test.yml` runs exactly that line, then `npx tsc -p tsconfig.ci.json` |
| `tsconfig.ci.json` sets `"types": ["node"]`, so a missing `@types/node` fails with `TS2688` | CONTRIBUTING.md:13 | accurate | `tsconfig.ci.json` `compilerOptions.types` is `["node"]`; the TS2688 text is the compiler's own diagnostic |
| The first two checks need nothing but `node` and `git` on PATH; the third is the install exception | CONTRIBUTING.md:13 | accurate | CI's three jobs are `node-test` (matrix), `self-verify` and `typecheck`, and only the third installs |
| `node --test cadence-core/bin/*.test.mjs` runs the seam-core unit tests | CONTRIBUTING.md:16 | accurate | 45 `*.test.mjs` files under `cadence-core/bin/`; the `~11s` figure is a timing note, not a checkable fact |
| `node cadence-core/bin/test.mjs routing` runs one group | CONTRIBUTING.md:17 | accurate | `routing` is one of the six groups the CI matrix names |
| `node cadence-core/bin/test.mjs --list` lists the groups and what each owns | CONTRIBUTING.md:18 | accurate | `test.mjs` implements `--list` |
| `node cadence-core/bin/self-verify.mjs` is the prose-against-code drift linter | CONTRIBUTING.md:19 | accurate | file present; CI runs it as its own job |
| `npx tsc -p tsconfig.ci.json` is checkJs over `cadence-core/bin` with tests excluded | CONTRIBUTING.md:20 | accurate | `tsconfig.ci.json` `include` is `cadence-core/bin/**/*.mjs`, `exclude` is `**/*.test.mjs`, `checkJs: true` |
| Self-verify lints every config key, script invocation and file path named in the workflows | CONTRIBUTING.md:23 | accurate | the checks in `self-verify.mjs` |
| It weighs every agent file, every SKILL.md, every workflow, and every file under `cadence-core/references/` and `cadence-core/templates/` | CONTRIBUTING.md:23 | accurate | five surface sets in `lib/surface-weight.mjs`, budgets in `cadence-core/bin/weight-budgets.json` |
| It fails when a surface EXCEEDS its recorded byte count, and the budget is a ceiling not an equality | CONTRIBUTING.md:23 | accurate | the budget check is an overrun test only |
| It fails when an agent's prose reaches for a tool its frontmatter never declared | CONTRIBUTING.md:23 | accurate | the tools-declaration lint in `self-verify.mjs` |
| `NOTICE.md` and `LINEAGE.md` exist and carry the GSD lineage | CONTRIBUTING.md:31 | accurate | both present |
