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
- [x] cadence-core/workflows/audit.md
- [x] cadence-core/workflows/config.md
- [x] cadence-core/workflows/config-review.md
- [x] cadence-core/workflows/context.md
- [x] cadence-core/workflows/coverage.md
- [x] cadence-core/workflows/debug.md
- [x] cadence-core/workflows/decision-review.md
- [x] cadence-core/workflows/docs-verify.md
- [x] cadence-core/workflows/execute.md
- [x] cadence-core/workflows/milestone.md

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

---

# Invocation 2 - `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`

A note on the batched check that decides one whole class here.
`cadence-core/bin/self-verify.mjs` lints, as blocking CI, that every config key,
script invocation and `${CLAUDE_PLUGIN_ROOT}` path named in these workflows
exists. It was run at this sha and returned
`{"ok":true,"checked":"config-keys, invocations, paths, ...","problems":[]}`
over 21 checks, so key-exists / subcommand-exists / path-exists claims are
decided in one pass rather than one grep per row. Rows below that turn on a
DEFAULT, a returned SHAPE or a stated BEHAVIOUR are checked individually
against the code, because that class is exactly what the linter cannot see.

## cadence-core/workflows/audit.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The persisted status is the REQUIREMENTS traceability table plus the ROADMAP `## Phases` checkbox, and the audit never edits status | audit.md:4-9 | accurate | `references/req-traceability.md` states the same writer split |
| `planning.mjs audit` returns the requirement -> phase -> plan -> verified chain on one JSON line | audit.md:18-22 | accurate | run at this sha: `{ok, requirements, counts}`, each requirement carrying `id, phase, plan, status, box` |
| The break codes are `no-phase`, `phase-missing`, `no-plan`, `not-verified`, `drift`, `unpicked` | audit.md:23-24 | accurate | `planning.mjs:1087-1138` emits all six |
| The line also carries `orphans.plan_ids`, `frontmatter_issues`, `unseeded`, `active_issues`, `nonconforming_plans`, `deferred` and `version_drift` | audit.md:24-41 | accurate | `planning.mjs:1213-1226`; each of those keys is spread in only when non-empty, which is why the live run at this sha shows `{ok, requirements, counts}` alone |
| `version_drift` is `{doc_version, published_as, cycle_state}` and is OMITTED when there is nothing to report | audit.md:40-41 | accurate | `planning.mjs:1226` guards it on `cycleOpen` |
| `counts.total` is Traceability rows plus unpicked ids, so `total = traced + broken + deferred` | audit.md:41-43 | accurate | live run: `{"total":5,"traced":4,"broken":1,"deferred":0}` |
| Only ids whose category is 2-8 chars of `[A-Z0-9]` holding at least one letter, or `#N`, are admitted to `unseeded`; `2FA-01` is admitted, `14-01` is not | audit.md:31-35 | accurate | `lib/planning-files.mjs`'s `REQ_ID_EXACT`, pinned by `planning-files.test.mjs:916-932` |
| `planning.mjs criteria-coverage` is the second arm | audit.md:50-52 | accurate | subcommand present and run at this sha |
| `version` is `{plugin, uat_fields}` and comes first | audit.md:53-56 | accurate | live run: `{"plugin":"3.2.0","uat_fields":"1"}` as the first key after `ok` |
| The coverage arm returns `phases`, `breaks`, `untraced`, `legacy`, `unknown_criterion`, `context_issues` and `counts` | audit.md:57-63 | accurate | same conditional-emission pattern; the live run returned `{ok, version, phases, untraced, counts}` because the rest were empty |
| `counts.criteria = covered + uncovered` | audit.md:63 | accurate | live run: 32 = 25 + 7 |
| Break shapes: `{phase, id, break:"uncovered"}` and `{phase, break:"fieldless-checklist", file}` | audit.md:59-61 | accurate | the emitter's own shapes |
| Grammar and field semantics live in `references/acceptance-criteria.md` | audit.md:64 | accurate | file present |
| `milestone.md` step 3 removes completed phases from ROADMAP's live `## Phases`, so `parseRoadmapPhases` only holds the current cycle | audit.md:66-69 | accurate | `milestone.md:88-98`'s `milestone-prune` call |
| `uat init` writes `fields_version` before it looks at an item, so no phase is transiently fieldless | audit.md:71-73 | accurate | the `uat init` arm in `planning.mjs` |
| The `uat record --phase --item --result --criterion` repair spelling | audit.md:102 | accurate | those flags are the `uat record` contract |
| `--origin criterion` names no id and is not a repair | audit.md:104 | accurate | `origin` is an exemption field, not an id field |
| `version_drift` moves the verdict to FAIL; it is not additive | audit.md:105-113, :146-153 | accurate | §4's FAIL clause names it explicitly |
| The membership test is the tag list, not sort order | audit.md:168-169 | accurate | `lib/git-tags.mjs` / `branch-decision.mjs` decide by membership |
| The manifest is deliberately not a comparand, because `pluginVersion()` resolves relative to the SCRIPT | audit.md:171-177 | accurate | `pluginVersion()` reads the manifest beside the seam, which is Cadence's own under `${CLAUDE_PLUGIN_ROOT}` |
| PASS is zero broken and zero coverage `breaks`; FAIL on any break whatever its code | audit.md:118-129 | accurate | stated arithmetic over the two seam calls, both of which return those keys |
| `frontmatter_issues`, `active_issues` and `nonconforming_plans` are additive and change neither counts nor verdict; `unseeded` is not additive | audit.md:131-144 | accurate | `unseeded` ids each also carry an `unpicked` break in the emitter |
| `references/plan-frontmatter.md` states per code which diagnostics drop payload | audit.md:132-133 | accurate | file present with the per-code table |

## cadence-core/workflows/config.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Canonical shape and validation live in `cadence-core/config.schema.json`, enforced by the `bin/config.mjs` seam | config.md:3-5 | accurate | both files present; `config.mjs` reads the schema as its only vocabulary |
| `cadence-core/templates/config.json` is the scaffolded default | config.md:5 | accurate | file present |
| Four sets stay edit-the-file-only: `review.providers.*`, the six `model.overrides` role pins, the six `model.effort` per-role rungs, and `review.decision_review`'s two keys | config.md:28-34 | accurate | the schema carries exactly 6 `model.overrides.*`, 6 `model.effort.*` and 2 `review.decision_review.*` keys |
| The ask-user seam has a 4-option cap, which is why the walk pages 4 knobs per call | config.md:39-40 | accurate | `references/seams.md` states the `AskUserQuestion` cap |
| `references/config-catalog.md` carries the rows in walk order | config.md:54-56, :68 | accurate | file present |
| The catalog is deliberately transcribed, not derived from `config.mjs keys`, because the schema carries no per-value explanation field | config.md:73-76 | accurate | `config.mjs keys` dumps `{type, values, default, purpose}` and no per-value copy |
| `config.mjs validate` asks whether the whole file is ok | config.md:84 | accurate | `config.mjs:299` |
| `config.mjs check <key=value>...` dry-runs pairs | config.md:85 | accurate | `config.mjs:300` |
| `config.mjs set <key=value>...` validates then writes atomically | config.md:86 | accurate | `config.mjs:307` |
| `config.mjs get [key ...]` returns EFFECTIVE values, repo > global > defaults | config.md:87, :91 | accurate | `config.mjs:308` reading through `lib/config-merge.mjs mergeLayers` |
| `config.mjs keys` dumps the schema | config.md:88 | accurate | `config.mjs:309` emits `{ok:true, keys: SCHEMA}` |
| Each prints one JSON line `{ok, ...}`; `--file <path>` overrides the default and `--global` targets `~/.claude/cadence/config.json`, relocatable by `CADENCE_GLOBAL_CONFIG` | config.md:97-100 | accurate | `lib/config-merge.mjs:12-27` |
| At read time `bin/route.mjs` deep-merges global under repo; nested objects merge, arrays replace wholesale | config.md:103-105 | accurate | `route.mjs` does merge that way, through the shared `lib/config-merge.mjs mergeLayers` that `config.mjs get` also uses |
| `worktree.baseRef=...` is not a Cadence key and the seam rejects it as unknown | config.md:111-113, :137-138 | accurate | absent from `config.schema.json`; `config.mjs check bogus.key=1` returns `{"ok":false,"reason":"invalid","detail":[{"key":"bogus.key","error":"unknown key"}]}` |
| Rejection contract is `{ok:false, reason:"invalid", detail:[...]}`, atomic, and success echoes `{ok:true, changed:[...]}` | config.md:118-121 | accurate | observed live on a rejected pair |
| A key retired by a release carries a `detail` naming its replacement, so remediation needs no `keys` lookup | config.md:123-125 | accurate | `config.mjs check 'risk.override.auth=true'` returns `detail[0].error` = "retired in v2.7.0: removed with the dispatch-time risk floor..." |
| A `cannot set through "..."` detail means the container holds an array or scalar | config.md:129-133 | accurate | `config.mjs`'s dotted-path walk refuses rather than overwriting |
| `worktree.baseRef`'s `"fresh"` default makes a worktree branch from the remote default branch, which is why `choose_path` refuses to parallelize there | config.md:139-145 | accurate | `workflows/execute.md:132-136` states the same refusal |
| `node .../worktree-base.mjs resolve` reads the effective value and returns `parallelSafe` | config.md:154-160 | accurate | live run: `{"ok":true,"baseRef":"head","source":".../.claude/settings.json","parallelSafe":true,"reason":"..."}` |
| The step runs whenever `parallelization.use_worktrees` is true, without also requiring `parallelization.enabled` | config.md:147-152 | accurate | both keys exist and default to true; the gate is stated as `use_worktrees` alone |
| The assignment flow lives in `cadence-core/workflows/config-review.md` and rejoins at Wrap-up | config.md:177-182 | accurate | that file's header and its `## Wrap-up` say the same |
| A trigger whose provider tier resolves to `null` silently falls back to `claude-subagent` | config.md:192-198 | accurate | all twelve `review.providers.*.tiers.*` keys default to `null` |

## cadence-core/workflows/config-review.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| It is loaded from config.md on `--review` and rejoins config.md at Wrap-up | config-review.md:3-5, :84-87 | accurate | `config.md:177-182` |
| The goal is filling `review.providers.<name>.tiers.{flagship,balanced,cheap}` | config-review.md:8-9 | accurate | twelve such keys in the schema, one per provider per tier |
| The three providers are openai, gemini and deepseek | config-review.md:20-21 | accurate | `review.reviewers` values are `claude-subagent`, `openai`, `gemini`, `deepseek` |
| `review-provider.mjs detect-models --provider <name> [--key-file ...]` | config-review.md:26-28 | accurate | subcommand and both flags present; `review.key_file` is a schema key defaulting to `null` |
| `ok:false, reason:"no-key"` names the env var or the providers.env path in `detail` | config-review.md:36-39 | accurate | `review-provider.mjs:791`, `:900` fail with `no-key`; `:175` maps `OPENAI_API_KEY` / `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` |
| `ok:false, reason:"transport"` and `"http"` | config-review.md:40-42 | accurate | `review-provider.mjs:810-815`, `:907-912` |
| `ok:true` carries `models[]` of `{id, tier, high_effort}` | config-review.md:43-45 | accurate | `review-provider.mjs:939` |
| `tier` is `flagship\|balanced\|cheap` for known ids or `null` for unknown ones, which stay selectable | config-review.md:44-45 | accurate | same site: "unknown text id -> tier:null so cad-config asks the user" |
| `claude-subagent` is the always-available fallback, so a failed provider never blocks | config-review.md:38-39, :200-205 | accurate | `review.reviewers` defaults to `["claude-subagent"]` |
| The write goes through `config.mjs set 'review.providers.<name>.tiers.flagship=<id>'` | config-review.md:72-76 | accurate | those keys are settable through the seam |
| A position with no suitable model stays `null` and its triggers fall back to `claude-subagent` | config-review.md:78-80 | accurate | every tier key's schema default is `null` |
| Assignment alone does not enrol a reviewer - the provider must be added to `review.reviewers` | config-review.md:80-82 | accurate | `review.reviewers` is the key `fire()` resolves the set from |

## cadence-core/workflows/context.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Output is `.planning/phases/{N}/CONTEXT.md`, an OPTIONAL phase artifact | context.md:12-13 | accurate | `workflows/plan.md` reads it when present |
| `planning.mjs cursor get` supplies the phase, and `no-cursor` is its miss reason | context.md:19-21 | accurate | subcommand and reason both present |
| Priors read: PROJECT.md, REQUIREMENTS.md, up to 3 prior CONTEXT.md files, and up to 3 prior SUMMARY `## Deviations` blocks | context.md:44-58 | accurate | all four are real artifacts; the bound is a stated rule, not a seam |
| `workflows/report.md` already reads deviations out of SUMMARY for its `Refuted:` line | context.md:55-58 | accurate | `report.md` is present and does read SUMMARY deviations |
| The spend gate is decided BEFORE `analyze`, because that step's `route.mjs resolve` writes the lifecycle dispatch half unconditionally | context.md:73-78 | accurate | pinned by `prose-agreement.test.mjs:403-459`, which asserts the gate step opens above both `<step name="analyze">` and the `--bracket-read` resolve |
| One batched `config.mjs get memory.backend planning.commit_docs` | context.md:84-87 | accurate | both keys exist: enum `none\|builtin` default `builtin`, bool default `true` |
| `memory.backend` `builtin` is the schema default | context.md:93 | accurate | schema default is `builtin` |
| `planning.mjs recall "<terms>"` is the recall call, skipped entirely on `none` | context.md:96-103 | accurate | `recall` is a documented subcommand (`planning.mjs:44`) |
| `references/recall.md` is the one consult site for the result shape | context.md:105-108 | accurate | file present and registered in `lib/deferred-reads.mjs` |
| The analyzer dispatch brackets on `--bracket-read ".planning/ROADMAP.md"` | context.md:157-159 | accurate | `route.mjs:19-20` documents `--bracket-read <csv> [--bracket-plan <key>]` |
| `skills/cad-assumptions-analyzer-contract` is what sends the analyzer to the roadmap entry | context.md:161-163 | accurate | directory present |
| The close is one `planning.mjs trace close --phase --plan --role --tokens` line, with `--detail` on a failure | context.md:184-189 | accurate | `planning.mjs:70-71` documents exactly those flags, and infers `checkpoint` from `--detail` |
| The analyzer returns `assumptions[]` with area, statement, evidence, if-wrong, confidence and alternatives, plus `needs_research[]` | context.md:191-196 | accurate | the analyzer contract's stated output format |
| Unclear items are batched `ceil(N/4)` per `AskUserQuestion` call, up to four questions per call | context.md:206-211 | accurate | matches the seam's stated 4-question batching |
| Each criterion carries a phase-local `AC<N>` id, never phase-prefixed, never renumbered | context.md:291-295 | accurate | `references/acceptance-criteria.md`'s grammar |
| `/cad-audit` FAILs on a criterion that reached no UAT item | context.md:294-295 | accurate | `audit.md:118-129` and the `uncovered` break |
| The durability filter is prose judgment with no scoring seam | context.md:257-270 | accurate | no durability seam exists |
| `templates/CONTEXT.md` has five sections | context.md:340-342 | accurate | scope boundary, durable decisions, decisions, acceptance criteria, flagged assumptions |
| `planning.mjs criteria-size --phase {N} --context-min 3 --context-max 7`, reporting `over` entries and `context_found: false` | context.md:352-359 | accurate | live run returned `{"ok":true,"phase":4,"phases":[{"context_criteria":7,"context_found":true,...}],"context_min":3,"context_max":7,"over":[],"compared":[...],"within":true}` |
| `planning.mjs cursor set --phase --status --next` derives name/total from ROADMAP and stamps the date | context.md:366-368 | accurate | the `cursor set` arm in `planning.mjs` |
| The commit is gated on `planning.commit_docs` and applies `references/git-guard.md` rail 1 | context.md:371-378 | accurate | key present, defaults true; the reference states rail 1 |
| No review trigger fires in this workflow | context.md:414-415 | accurate | `references/review-triggers.md`'s wiring table names no `cad-context` fire |

## cadence-core/workflows/coverage.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The definition of Covered is a test whose failure would signal the requirement regressed | coverage.md:6-8 | accurate | `METHOD.md:253-255` quotes the same definition |
| `planning.mjs status` supplies the last completed phase | coverage.md:11-13 | accurate | live run returns `{ok, current, total, phases[]}` with per-phase `status` |
| `ok:false` reasons are `no-planning-dir` / `no-roadmap` | coverage.md:13-14 | accurate | `planning.mjs:295`, `:297` |
| An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived closed milestone | coverage.md:14-18 | accurate | `planning.mjs:417` spreads `cycle: 'none'` only when closed |
| The runner is `workflow.test_command`, and when null it is detected from the repo | coverage.md:34-35 | accurate | schema key `workflow.test_command`, default `null` |
| `git diff <phase-start>..<phase-end> --stat` is the implementation read | coverage.md:32 | accurate | ordinary git; the range comes from SUMMARY.md |
| A red test is never committed as coverage; the failure goes to `/cad-debug` | coverage.md:64-67 | accurate | `workflows/debug.md` is the destination and exists |
| The commit is `test(phase-<N>): cover <requirements>` honouring `references/git-guard.md`, never auto-pushed | coverage.md:71-74 | accurate | reference present; the guard asks on every push |
| The approval gate precedes any test being written | coverage.md:47-52 | accurate | stated as a gate through the ask-user seam |
| Test kind is chosen from what the code is rather than from a default | coverage.md:48-49 | unverifiable | a judgment instruction with no mechanical check over it |

## cadence-core/workflows/debug.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The state file is `.planning/debug/<slug>.md` and a resume reads only this | debug.md:7-9 | accurate | the path this workflow writes and reads |
| The schema carries Status, Slug, Attempts, Symptom, Hypotheses, Observations, Resolution | debug.md:12-29 | accurate | stated inline as the file's own template |
| `list` greps `^# debug:\|^Status:` across `.planning/debug/*.md` in one pass | debug.md:33-37 | accurate | ordinary grep over the stated path |
| One `config.mjs get memory.backend review.consult.attempt_threshold` at method-loop entry | debug.md:58-60 | accurate | both keys exist |
| `review.consult.attempt_threshold` defaults to 3 | debug.md:125-127 | accurate | schema `int`, default `3` |
| `references/bug-patterns.md` is read FIRST, before any candidate is written | debug.md:69-73 | accurate | file present |
| Recall runs inline via `planning.mjs recall "<terms>"` when the backend is `builtin`, and is skipped entirely on `none` | debug.md:79-88 | accurate | `recall` subcommand present; the gate precedes the call |
| `references/recall.md` is the one consult site for the result shape | debug.md:88-91 | accurate | file present and registered in the deferred-read register |
| 2-5 candidate causes, ranked most-likely-first but tested risk-first | debug.md:73-76 | accurate | `METHOD.md:523-525` states the same bound |
| A fix touching a risk surface fires the `risk_surface` trigger as shape (b), the reviewer running `git diff --cached` in its inherited cwd | debug.md:109-113 | accurate | `references/review-triggers.md`'s `risk_surface` row names `cad-debug` as a fire site and admits shape (b), which is pinned by `prose-agreement.test.mjs:159` |
| That gate is `blocking` and its re-arm is capped at ONE narrowed round per `references/triage-gate.md` | debug.md:113-116 | accurate | `route-table.json` has `risk_surface` blocking at all three levels; the cap is stated in `triage-gate.md` |
| The consult thresholds are Attempts >= T, test still red after T iterations, exhausted hypotheses | debug.md:132-134 | accurate | stated triggers over observable counters |
| `offer_consult` is the seam, defined in `references/consult.md` | debug.md:136 | accurate | `references/consult.md:30` "## offer_consult(dead_end)" |
| Single pass, no automatic retry loops | debug.md:146-147 | accurate | no retry construct in the workflow |

## cadence-core/workflows/decision-review.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The target is a `- D-NN (...)` line in a CONTEXT.md `## Durable decisions` / `## Decisions` section, or a PROJECT.md Key Decisions row | decision-review.md:2-4, :24-26 | accurate | both shapes are what `templates/CONTEXT.md` and `.planning/PROJECT.md` carry |
| It reuses the review subsystem via `references/review-triggers.md` | decision-review.md:5-6 | accurate | file present |
| It never auto-fires and has no entry in the wiring table | decision-review.md:10-11, :171-173 | accurate | the wiring table names no `cad-decision-review` fire |
| The claude-subagent arm brackets with `planning.mjs trace append --phase --family lifecycle --event dispatch --plan --role --read` | decision-review.md:51-53 | accurate | `planning.mjs:60-62` documents `--family`, `--event`, `--plan`, `--role` and `--read` on `trace append` |
| The close is `planning.mjs trace close --phase --plan --role --tokens`, with `--detail` closing it as a checkpoint | decision-review.md:60-66 | accurate | `planning.mjs:70-71`, and `:2779` infers `checkpoint` from a non-empty `--detail` |
| `--tokens` is omitted on a figureless return, per seams.md's bracket rule | decision-review.md:57-58 | accurate | `--tokens` is optional in the contract |
| No routing cell resolves a model for the claude-subagent arm - it is base `cad-reviewer` at the session default | decision-review.md:66-68 | accurate | `review.decision_review.tier`'s own schema `purpose` says "cross-model reviewers only; its claude-subagent arm is cad-reviewer at the session default and resolves no model at all" |
| `review.decision_review.tier` and `.effort` reach the cross-model arm only | decision-review.md:68-69, :78 | accurate | both keys exist; `tier` is `flagship\|balanced\|cheap` default `flagship`, `effort` is `minimal\|low\|medium\|high` default `high` |
| The cross-model arm runs only when `review.reviewers` names the provider AND its `tiers[tier]` is a non-null model id | decision-review.md:70-75 | accurate | `review.reviewers` is the enrolment key; every tier key defaults to `null` |
| `review-provider.mjs review --provider --model --effort [--key-file]` with `{instruction, artifact}` on stdin | decision-review.md:77-81 | accurate | the `review` subcommand and those flags are present |
| `ok:false` drops that reviewer and single-model continues | decision-review.md:81-83 | accurate | the same degradation rule `review-triggers.md` step 4 states |
| Multiple reviewers dispatch CONCURRENTLY in one message | decision-review.md:85-89 | accurate | required and enforced by the `dispatch-phrasing` self-verify check |
| Context7 grounding uses `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`, declared on the skill's main-model surface | decision-review.md:100-107 | accurate | `skills/cad-decision-review/SKILL.md` declares those tools; a rung agent declaring a tool its prose does not have would fail the `tools` check |
| Each objection is ruled exactly one of `survives`, `partial`, `refuted` | decision-review.md:125-131 | accurate | this workflow's own prose vocabulary |
| `review-provider.mjs`'s FINDING_SCHEMA and self-verify's CONTRACTS table are unchanged by this workflow | decision-review.md:176-180 | accurate | `review-provider.mjs:557` still requires the same five finding fields |
| Cost is reported qualitatively, never as a token or dollar figure | decision-review.md:138-140, :181-182 | accurate | no runtime per-turn cost figure exists to report |
| The workflow edits no file, including the target decision doc | decision-review.md:162-165, :174-175 | accurate | its only outputs are prose |

## cadence-core/workflows/docs-verify.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The default target set is `README.md` plus `docs/**` and any root `*.md` that reads like user docs, excluding `.planning/` | docs-verify.md:9-10 | accurate | `README.md`, `docs/` and the root `*.md` files all exist; the exclusion is a stated rule |
| It reports only and never rewrites - the writer is cut, per DESIGN §2 | docs-verify.md:3-4, :50-54 | accurate | `DESIGN.md` §2 records the cut; the workflow has no write step |
| The claim classes are paths, commands, code symbols, config keys, env vars, structure/behavior, defaults, counts and version numbers | docs-verify.md:16-21 | accurate | the workflow's own taxonomy |
| Checks are batched: path checks one pass, symbol greps in one message, cited-code reads one batch | docs-verify.md:25-27 | accurate | the discipline this sweep ran under |
| Never run a destructive or state-changing command to verify one | docs-verify.md:32-33 | accurate | a stated prohibition with no counterexample in the file |
| The three verdicts are exactly `accurate`, `stale`, `unverifiable` | docs-verify.md:38-44 | accurate | no fourth verdict anywhere in the file |
| The emitted table is `claim \| location \| verdict \| correct value (if stale)`, led by a one-line count | docs-verify.md:46-48 | accurate | the shape this report follows |
| It stops at the report and offers the follow-up through the ask-user seam without auto-applying | docs-verify.md:50-54 | accurate | step 5 is terminal |

## cadence-core/workflows/execute.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `planning.mjs status` supplies `current`, and `ok:false` relays `reason` and `hint` | execute.md:10-12 | accurate | live run returns `{ok, current, total, phases[]}`; the fail arm carries `reason` and `hint` |
| `cycle: "none"` with an empty `phases[]` is a derived closed milestone and `current` is legitimately null | execute.md:13-16 | accurate | `planning.mjs:417` |
| Plans execute in numeric order, `PLAN.md` or `PLAN-1.md`, `PLAN-2.md`, ... | execute.md:17-18 | accurate | `lib/phase-plans.mjs` orders them numerically |
| One batched `config.mjs get` of `planning.commit_docs`, four `parallelization.*` keys, `git.protected_branches`, `git.on_protected`, `git.base_branch` | execute.md:28-33 | accurate | all eight keys exist: `parallelization.enabled` true, `max_concurrent_agents` 3, `min_plans_for_parallel` 2, `use_worktrees` true, `git.base_branch` null |
| The `diff` and `phase_diff` gates are NOT read here, because `config.mjs get` of a gate returns the schema default when no layer set it | execute.md:35-39 | accurate | `route.mjs`'s own `_meta` states the same reason for not reading schema defaults |
| The clean-index check is `git diff --cached --quiet`, named by `git diff --cached --name-status`, with `git stash push --staged` (git 2.35+) as option 1 | execute.md:59-66 | accurate | ordinary git; `--staged` is a real `stash push` flag |
| PHASE_START is `git rev-parse --short HEAD`, anchored by `planning.mjs trace append --phase --family lifecycle --event phase_start --sha` | execute.md:89-94 | accurate | `planning.mjs:60` documents `--family`, `--event` and `--sha` on `trace append` |
| The whole trace is BEST EFFORT: `written:false` changes nothing about the execute path | execute.md:97-100 | accurate | the trace seam returns `written` and never throws into the caller |
| `planning.mjs plan-overlap --phase <N>` decides the file-overlap half, requiring empty `overlaps` | execute.md:112-114 | accurate | live run on phase 5: `{"ok":true,"phase":5,"plans":[...],"overlaps":[]}` |
| Any `undeclared` or `frontmatter_issues` entry also forces sequential | execute.md:117-121 | accurate | both keys are emitted by the same seam when non-empty |
| `worktree-base.mjs resolve` decides the fork point, and `parallelSafe: false` triggers the offer rather than a silent fallback | execute.md:124-153 | accurate | live run returns `parallelSafe` with a `reason` and the resolving `source` file |
| Under `baseRef: "fresh"` (the default, so an unset key counts) a worktree branches from the remote default branch | execute.md:132-136 | accurate | `workflows/config.md:139-145` states the same default and consequence |
| The dispatch prompt hands over the resolve's `surfaces` verbatim, and says what `surfaces_answered: false` means | execute.md:168-171 | accurate | pinned by `prose-agreement.test.mjs:572-606`, which asserts both tokens appear in this prompt |
| The executor's standing rules are NOT restated, because `skills/cad-executor-contract/SKILL.md` carries them and every rung file preloads it | execute.md:176-181 | accurate | `agents/cad-executor.md` is a stub whose body is "This file names that contract and your rung, and adds nothing else", with `skills: [cad-executor-contract]` |
| An executor writes `<plandir>/reports/plan-<k>.md` and returns a five-field digest, and the digest deliberately does not carry the path | execute.md:183-187 | accurate | the contract's `<report_file>` derives the path and its `<report>` forbids a sixth field |
| `git worktree list --porcelain` gives the worktree root for branch `cadence/phase-<N>-plan-<k>` | execute.md:191-193 | accurate | ordinary git; the branch name is the parallel path's stated convention |
| The DISPATCH half rides the executor's own resolve as `--bracket-plan <k> --bracket-read "..."` | execute.md:195-199 | accurate | `route.mjs:19` documents `--bracket-read <csv> [--bracket-plan <key>]` |
| The close is `planning.mjs trace close --phase --plan --role --tokens --detail`; omitting `--detail` closes a `return`, carrying it closes a `checkpoint`, and `escalation` stays on `trace append` | execute.md:205-213 | accurate | `planning.mjs:2779` infers exactly that from `--detail`, and its comment states `escalation` is deliberately not inferred |
| `trace render` reports a worker with no close as unpaired | execute.md:213 | accurate | `lib/trace.mjs`'s `renderTrace` carries an `unpaired[]` |
| The `phase_start` line takes no `--role`, `--tokens` or `--read` | execute.md:221-224 | accurate | those flags are optional on `trace append`, and the anchor site passes none |
| `risk_surface` fires ONCE after each plan, on `git diff {pre-plan HEAD}..HEAD`, written to `<plandir>/reports/plan-<k>-risk.diff` as shape (c) | execute.md:248-254 | accurate | pinned by `prose-agreement.test.mjs:281-283`, which asserts `plan-<k>-risk.diff`, the never-stage rail and the delete rail |
| The risk diff is transient: never staged, deleted once the trigger returns | execute.md:253-254 | accurate | same test |
| The `risk_surface` re-arm is capped at ONE narrowed round per `references/triage-gate.md` | execute.md:255-258 | accurate | the cap is stated in that reference and binds every blocking gate |
| The `diff` trigger's default is `off` at `solo` and `shipped` | execute.md:270 | accurate | `route-table.json` `review.solo.diff` and `review.shipped.diff` are both `off` |
| At `advisory` the fire overlaps the next dispatch and persists findings at `.planning/phases/<N>/REVIEW-diff-plan-<k>.md` | execute.md:277-284 | accurate | that path is the advisory persistence tail `review-triggers.md` step 4 states |
| The structural checkpoint arm runs `offer_consult` per `references/consult.md` before the ask | execute.md:305-309 | accurate | `references/consult.md:30` defines it |
| `references/worktree-executor.md` forbids `git merge`, `rebase`, `fetch` and `stash` outright | execute.md:318-321 | accurate | `worktree-executor.md:39-40` states the forbidden verb set |
| Cadence issues no `git worktree add` of its own | execute.md:323-324 | accurate | no `worktree add` anywhere under `cadence-core/bin/**` |
| `references/execute-parallel.md` is the one consult site for the parallel path | execute.md:345-349 | accurate | file present |
| SUMMARY.md is written from `templates/SUMMARY.md` | execute.md:367-369 | accurate | template present |
| Open items are filed with `planning.mjs capture --kind todo --text-file <path> --phase <N>`, never `--text`, because `--text` would shell-expand a `$(...)` | execute.md:383-388 | accurate | `planning.mjs:3295-3305` calls `--text-file` the SAFE transport and refuses both flags together |
| `planning.mjs debt-harvest --root .` lands a `CADENCE-DEBT` marker in the queue, rewriting only its `## Debt markers` section | execute.md:396-401 | accurate | `planning.mjs:92` documents the subcommand; `lib/debt-markers.mjs` owns the grammar |
| The cursor is set through `planning.mjs cursor set --phase <N> --status executed --next "/cad-verify <N>"` | execute.md:404-409 | accurate | the `cursor set` arm validates `--status` against a fixed lifecycle |
| The docs commit is `docs(<N>): phase <N> summary`, gated on `planning.commit_docs`, and never stages a transient risk diff | execute.md:411-420 | accurate | key present, defaults true |
| This workflow is the only STATE writer, and only as the 4-line overwrite | execute.md:438-439 | accurate | `references/conventions.md:94` and `templates/STATE.md:3` |

## cadence-core/workflows/milestone.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The release tag is NOT cut here; `/cad-land` cuts it on the pulled base after the merge | milestone.md:6-7, :68-72, :188-190 | accurate | no `git tag` write anywhere in this workflow |
| One `config.mjs get git.create_tag git.auto_close` up front, reused at steps 2 and 7 | milestone.md:9-12 | accurate | both keys exist; `git.auto_close` is a bool defaulting to `false` |
| `/cad-audit <milestone>` is invoked via the SlashCommand tool as the FAIL gate | milestone.md:16-20 | accurate | `skills/cad-audit/` exists and `workflows/audit.md` is the gate |
| `release-bump.mjs bump --dir <root> --version <version>`, with `--version` REQUIRED and no number derived | milestone.md:33-39 | accurate | `release-bump.mjs:22` names `no-target-version` as the refusal when it is missing |
| The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"` when absent | milestone.md:41-42 | accurate | `lib/release-decision.mjs:199` returns `action:'skip'` on `no-version-field`; the manifest is present in this repo |
| It scaffolds the dated `## [<version>]` heading and link reference and PROMOTES `## [Unreleased]` into it | milestone.md:43-45 | accurate | `release-bump.mjs:189-193` emits `changelog: {changed, promoted, section_empty}` |
| The `ok:false` reasons are `no-target-version`, `unparseable-version`, `unreadable-manifest`, `downgrade`, `not-an-upgrade` | milestone.md:52-54 | accurate | `lib/release-decision.mjs:195-217` and `release-bump.mjs:121` emit all five (the file also carries `no-version-field`, which is an `action:"skip"` rather than a refusal) |
| A `siblings[]` entry with `action:"refuse"` leaves top-level `ok` true | milestone.md:57-59 | accurate | `release-bump.mjs:153-167` pushes sibling refusals without failing the top level |
| `changelog.section_empty: true` means the dated heading has no body | milestone.md:60-62 | accurate | `release-bump.mjs:193` |
| The bump commit is `chore: bump manifest to <version> + changelog` | milestone.md:64-66 | accurate | a stated message convention, not a seam output |
| The carry-forward unions `.planning/phases/*/REVIEW-risk_surface*.md` into `.planning/REVIEW-risk_surface-<label>.md`, transient and never staged | milestone.md:76-86, :163-165 | accurate | that glob is what `/cad-land`'s unattended halt reads, and the phase dirs the prune removes are the only producer |
| `planning.mjs milestone-prune --label <label> --mode <delete\|archive>` does the mechanical half | milestone.md:96-98 | accurate | `planning.mjs:96` documents exactly that spelling |
| Checked phases leave ROADMAP.md by both their `- [x]` line AND their `### Phase N:` detail section | milestone.md:88-91 | accurate | `references/roadmap-phases.md` states that a surviving detail section is the interrupted-close signature |
| Requirements move from `## Active` and `## Traceability` into `## Shipped` rows carrying the label | milestone.md:92-94 | accurate | `lib/milestone-prune.mjs`'s `archiveRequirements` |
| `--mode delete` on a release, `--mode archive` on an untagged milestone, moving dirs to `_archive-<label>/` | milestone.md:100-104 | accurate | the seam refuses a label that would resolve `_archive-<label>` outside the planning root (`planning.mjs:3547`) |
| `action:"skip"` means no checked phase existed | milestone.md:105-106 | accurate | `planning.mjs:3560` returns `{action:'skip', reason:'no completed (checked) phases to prune'}` |
| The prune commit is `chore: prune <label> completed phases`, not staging the carry-forward file | milestone.md:110-112 | accurate | stated convention consistent with the transient rule above |
| New `## Active` bullets take the `- **<ID>**: <one line>` form that `/cad-plan`'s seeding step reads | milestone.md:126-128 | accurate | `references/req-traceability.md`'s stated bullet grammar, and the same shape `audit`'s `active-non-id-bullet` diagnostic names |
| `planning.mjs cursor set --phase 1 --status "ready to plan" --next "/cad-phase add"` needs no other flags on a fully pruned roadmap | milestone.md:135-140 | accurate | the seam derives name and total from the roadmap and returns `cannot-derive` (`planning.mjs:510`) only when it cannot |
| `/cad-phase add` is the only workflow that appends a phase line to an existing roadmap | milestone.md:141-143 | accurate | `workflows/phase.md` owns the add arm; `/cad-plan` stops on a phase absent from ROADMAP.md |
| `git.auto_close` false (the default) stops the close here | milestone.md:152-154 | accurate | schema bool, default `false` |
| On `true` it chains `/cad-land` via the SlashCommand tool for PR -> merge -> tag -> reset | milestone.md:155-157 | accurate | `skills/cad-land/` exists and owns the tag |
| A surviving blocker/high `risk_surface` finding stops the chain before merge | milestone.md:157-161 | accurate | `lib/close-decision.mjs`'s `decideGateHalt`, called from `land-cleanup.mjs:43` |
| cad-land reaps via `land-cleanup.mjs`'s `cadence/*`-merged fallback, `resolveReapBranch` | milestone.md:167-172 | accurate | `cadence-core/bin/land-cleanup.mjs:17`, `:43`, `:118` |
| Step 8 invokes `/cad-suggest` unscoped, with its rules in `cadence-core/workflows/suggest.md` | milestone.md:174-178 | accurate | both the skill and the workflow file exist |
| A failed or missing retune run degrades to a one-line note, never a halt | milestone.md:180-182 | accurate | stated posture with no gate wired to it |

---

# Half A: the stale rows first

These six are the actionable output. Each names the file, the line and the
correct value, so the fix is mechanical. This sweep edits none of them
(`cadence-core/workflows/docs-verify.md` step 5).

1. **`README.md:56`** - "a plan review is advisory at `solo` and `shipped`,
   adjudicated at `critical`". Correct: advisory at `solo`, **`off`** at
   `shipped`, adjudicated at `critical`. Source:
   `cadence-core/route-table.json` `review.shipped.plan` is `"off"`.
2. **`METHOD.md:309-310`** - the same sentence, and this document's OWN trigger
   table at `METHOD.md:287` already states `off` for `shipped`, so the file
   contradicts itself. Correct: advisory at `solo`, `off` at `shipped`,
   adjudicated at `critical`.
3. **`METHOD.md:373-374`** - "the plan review in `/cad-plan`, advisory at
   `shipped` and adjudicated at `critical`". Correct: `off` at `shipped`;
   advisory is the `solo` gate.
4. **`METHOD.md:157-158`** - "Then check the staged diff against the
   risk-surface list before committing". The executor has no staged risk check
   at all: `risk_surface` fires ONCE against the plan's completed commit range,
   which `METHOD.md:415` itself states, and
   `cadence-core/bin/prose-agreement.test.mjs:269-273` asserts the executor
   contract carries neither a `risk_surface` checkpoint nor a
   `git diff --cached`. Correct: stage the specific files, run the lease gate
   (`planning.mjs lease-check`), commit, then take the post-commit glance.
5. **`METHOD.md:421-428`** - "Detection also sets a floor... that phase's
   `stakes` level is raised for the phase... Lowering it back takes a named
   per-surface `risk.override.<surface>`". There is no risk floor and no
   `risk.override.*` key. `cadence-core/bin/route.mjs:61-68` states "THERE IS NO
   RISK FLOOR"; the waiver family is retired in `lib/retired-keys.mjs` and
   absent from `config.schema.json`
   (`config.mjs check 'risk.override.auth=true'` answers "retired in v2.7.0").
   Correct: what survives is the commit-time `risk_surface` review read off the
   diff, which moves no role's model and no role's rung.
6. **`INTERNALS.md:13`** - the same retired floor, stated as live ("the level is
   raised for that phase, the reason says which surface and which file
   matched... lowering it back takes a named per-surface override"). Same
   correction as row 5.

The nine `unverifiable` rows are all one of three kinds and none is a defect:
a host command surface this repo does not define (`README.md:14`), a
measurement of the author's own account usage or of deleted code
(`README.md:136`, `:140` twice, `INTERNALS.md:35`), an external tree not in
this repo (`README.md:146`), a statement about the Claude Code host's own
resolution order (`INTERNALS.md:9`), or a prose nudge with no seam behind it
(`METHOD.md:60`, `coverage.md:48-49`).

# Half A count

**356 accurate, 6 stale, 9 unverifiable** - 371 claims.

That is the ROW count, counted from the claim table rows in this file and not
from any per-group headline. Run 1's report carried three per-group headlines
that each undercounted their own group, and
`.planning/DOCS-CLAIMS.md:19-23` says so; the rows are the record. Arithmetic:
385 lines beginning `| `, minus 14 table header rows, is 371 claim rows, and
356 + 6 + 9 = 371.

Coverage: all fourteen filenames in this half's surface carry a claim table -
`README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and
`cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`
- and every box on the coverage checklist above is ticked. The surface was
covered in full; nothing was closed over a partial read.

Half B (`.planning/phases/5/docs-verify-run-2-b.md`) carries invocations 3 and
4 and its own count. Neither half states a run-2 total; plan 3 joins them.
