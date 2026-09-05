---
phase: 3
plan: 3
requirements:
  - ROL-02
files:
  - cadence-core/workflows/config.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/suggest.md
  - cadence-core/workflows/task.md
  - cadence-core/workflows/verify.md
  - cadence-core/references/config-catalog.md
  - cadence-core/references/config-reach.md
  - cadence-core/references/COMMANDS.md
  - cadence-core/references/review-record.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/risk-surface.md
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/references/seams.md
  - skills/cad-config/SKILL.md
  - skills/cad-plan-checker-contract/SKILL.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/lib/close-decision.mjs
  - cadence-core/bin/lib/plan-key.mjs
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/lib/phase-plans.mjs
  - cadence-core/bin/lib/adjudication-record.mjs
  - cadence-core/bin/lib/why-record.mjs
  - cadence-core/bin/lib/why-corpus.mjs
  - cadence-core/bin/lib/task-record.mjs
  - cadence-core/bin/lib/surface-scan.mjs
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/lib/retired-keys.mjs
  - cadence-core/bin/retired-keys.test.mjs
  - cadence-core/bin/planning/risk-check.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/planning/plan-size.mjs
  - README.md
  - METHOD.md
  - INTERNALS.md
  - DESIGN.md
  - CHANGELOG.md
  - docs/WORKFLOW.md
  - docs/rationale/plan.md
  - docs/rationale/verify.md
  - .planning/DOCS-CLAIMS.md
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/seam-calls.test.mjs
  - cadence-core/config.schema.json
---

# Phase 3: The stakes key is gone and an interview replaces it - Plan 3 of 3

Sequential plans. This plan runs LAST, after PLAN-2's last task has committed.
It shares `prose-agreement.test.mjs`, `config.mjs`, `lib/arg-contract.mjs`,
`lib/rung-agent.mjs`, `lib/trace-suggest.mjs`, `planning/trace.mjs`,
`lib/retired-keys.mjs`, `retired-keys.test.mjs` and `review-triggers.md`
with the earlier plans; every edit it makes to a code file is to a COMMENT.

## Goal

A user meets thirteen questions that teach what each role costs - in full on
`/cad-new-project` and `/cad-adopt` writing to the global layer, as a
per-project confirmation writing to the repo layer, on demand through
`/cad-config --roles`, and as the migration any command opens when it finds a
`stakes` key - and no prose surface, comment or ledger row under this
repository still describes a level, a cells grid or an alias list as what
Cadence does.

## Must be true when done

- `/cad-config --roles` asks thirteen questions across four `AskUserQuestion`
  calls, every one carrying a default, and writes one `config.mjs set --global`
  on a first run and repo-layer diffs on a per-project adjustment; which file
  received the write is checkable on disk. (human-verify: needs an interactive
  session - the AskUserQuestion seam cannot be driven by a script)
- A config still carrying `stakes` meets the migration on the next command:
  the level's row is shown as twelve explicit per-role values, confirmed, and
  `stakes` is absent from every layer file afterwards. A config with no
  `stakes` key never sees it. (human-verify: same reason; this repository's
  own `.planning/config.json` is the fixture)
- `/cad-config` offers no stakes level anywhere - not in the menu, the
  catalog, the SKILL description or the COMMANDS row - and the twelve
  `roles.*` keys have catalog rows.
- No line in `cadence-core` or `skills` describes the stakes level or
  `route-table.json` as something Cadence DOES. Ruled 2026-09-05, replacing a
  count-based assertion that expected 3 stakes lines and 0 route-table lines:
  the sweeps now return 14 and 3 because PLAN-1 and PLAN-2 wrote comments in
  this same phase RECORDING the removal, and those are the design record, not
  residue. Every remaining hit is one of three kinds, each correct as written:
  the three "table stakes" lines in `cadence-core/workflows/new-project.md`
  (ordinary English, not the key); eleven comments naming the level in the past
  tense (`cadence-core/bin/route.mjs:12,416,567,888,1374,1396`,
  `cadence-core/bin/config.mjs:488,494,499`,
  `cadence-core/bin/lib/gate-agreement.mjs:17`,
  `cadence-core/bin/lib/rung-agent.mjs:24`); and three naming the deleted table
  the same way (`cadence-core/bin/lib/gate-agreement.mjs:19`,
  `cadence-core/bin/self-verify.mjs:1095,1159`). A hit in any OTHER file, or
  any hit stating either as current behaviour, fails this line.
- Every `.planning/DOCS-CLAIMS.md` row that stated the level as HEAD's
  behaviour now states HEAD's behaviour; `README.md`, `METHOD.md`,
  `INTERNALS.md` and `docs/WORKFLOW.md` describe the roles block, the
  interview and the two-effect floor; `DESIGN.md` carries a dated
  superseding bullet; `CHANGELOG.md`'s `[Unreleased]` records the break.
- `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, the whole suite passes, and `npx tsc -p tsconfig.ci.json`
  is clean.

## Context

Locked by `.planning/phases/3/CONTEXT.md`: D-09 (the interview is a `--roles`
arm of `/cad-config`, beside `--review` and `--surfaces`, and the twelve
`roles.*` keys gain catalog rows; no new skill), D-10 (thirteen questions in
four `AskUserQuestion` calls; the effort question exceeds the option cap and
uses the show-three-plus-`Other` rule `workflows/config.md` already states),
D-11 (no new write machinery - `config.mjs set --global` and `set`), D-12
(the waiver key's meaning re-pointed), D-13 (18 prose surfaces, 8 comment-only
`.mjs` files, 9 tracked prose files outside `cadence-core/` and `skills/`),
D-16 (two roles the floor never reaches), D-17 (the ledger's level-keyed rows
are rewritten now). The seam facts this plan writes against are the ones
PLAN-1 and PLAN-2 shipped: `model: null` on the envelope means send no model
parameter; `model_source` is a dotted key or `session`; the floor raises the
plan gate and `verify` and nothing else; `config.mjs unset` exists; the
`stakes` retirement warning names `/cad-config --roles`. Out of this plan: any
behaviour change in code.

## Tasks

### Task 1: The thirteen questions and the migration live in the config workflow, and the catalog reaches the roles keys

- **Files:** cadence-core/workflows/config.md, skills/cad-config/SKILL.md,
  cadence-core/references/config-catalog.md, cadence-core/references/COMMANDS.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In `workflows/config.md`, add a `--roles` route in section 1 and a
  **Roles interview** arm beside **Risk surfaces**, written in the same voice
  and reusing that arm's ask-user mechanics. The arm asks thirteen questions
  in four `AskUserQuestion` calls of at most four questions each (D-10): for
  each of the six roles, in `RUNG_FILES` order, one model question and one
  effort question, then the floor question. Each question's text says what the
  role does in the phase loop and what the choice costs, so the questions are
  the documentation. Model question options: the value in force FIRST,
  labelled `(current)` or `(in force)` by the walk's existing two-label rule
  and described as "no model parameter - the dispatch runs at your session's
  model" when nothing is set, then `opus`, `sonnet` and `haiku`, with `fable`
  named in the last option's description as reachable via `Other` and the
  reason it is not offered outright (the org-retention and refusal facts the
  schema purpose carried); `Other` is free-typed and goes into config as
  typed, and the arm echoes `config.mjs set`'s `changed` back so the user
  sees the exact string that landed. Effort question: the rung in force plus
  the three the user is most likely to want, every omitted rung named as
  reachable via `Other`, exactly the rule the walk states for
  `review.triggers.<t>.gate`. Floor question: the plan review becomes
  blocking and the deep-verify pass runs when a phase's plans touch one of
  the answered risk surfaces, models and rungs staying as set (D-02); keeping
  that for every surface is the recommended default and writes nothing, and
  naming surfaces to waive writes `review.triggers.risk_surface.waive_routing_floor`
  (D-12). Layer logic (AC4): a first run is a user-global file holding no
  `roles` key (read raw for PRESENCE only, the same exception the walk
  already grants for layer labels); a first run asks all thirteen and writes
  one `config.mjs set --global`; any later run - `/cad-config --roles` on a
  repo, or the confirmation `/cad-new-project` and `/cad-adopt` invoke after
  the first run - shows the twelve values in force with their layer labels
  and writes ONLY diffs to the repo layer with `config.mjs set`;
  `--roles --global` re-enters the full thirteen against the global layer.
  A pick equal to the value in force writes nothing, on the walk's existing
  rule - EXCEPT on a first run, which persists all twelve values plus the
  floor answer to the global layer whatever the user picked, because the
  no-op rule would otherwise leave a first run that accepted every default
  with no `roles` key on disk, which is the exact state this arm reads as
  "first run" and would re-ask forever (AC4 requires the write be checkable
  on disk). Then a **Stakes migration** arm: opened whenever a `config.mjs get`
  or `route.mjs resolve` envelope carries the retired-`stakes` warning; it
  reads `.planning/config.json` and the user-global file raw for a `stakes`
  key (this arm is about to remove that key from those files, so the raw
  read is inherent), expands EACH layer's own level independently -
  the global file's `stakes` becomes the global roles block and the repo
  file's `stakes` becomes the repo roles block, never one level's expansion
  written to both, because a machine holding global `solo` beside this repo's
  `critical` would otherwise have every other project on it silently inherit
  critical's models and rungs. Where only one layer holds the key, only that
  layer is written. Each expansion runs
  through a table this arm carries - the three levels' per-role model and
  effort as `route-table.json` shipped them: at `solo` every role `sonnet`
  with rungs planner high, analyzer high, verifier high, reviewer medium,
  executor high, plan-checker low; at `shipped` `opus` for every role but the
  plan-checker (`sonnet`) with rungs planner high, analyzer high, verifier
  medium, reviewer high, executor high, plan-checker medium; at `critical`
  `opus` everywhere at `xhigh` - shows the twelve values PER LAYER being migrated,
  confirms or adjusts them through the same questions, writes each layer's own
  answers with `config.mjs set` to that layer (`--global` for the user file),
  then removes the key from every layer holding it with `config.mjs unset stakes` (`--global` for the
  user file), and says in one line that the gates, reviewer tiers and the
  deep-verify pass no longer follow a level and which keys now hold them. A
  config with no `stakes` key never opens this arm because the warning that
  opens it never fires. Add `unset` to the **Validation seam** command list.
  Rewrite the paragraph excluding the `model.overrides` and `model.effort`
  families from the menu - its reason (the cells) is gone; keep them out as
  superseded fallbacks reachable by direct set, and say the roles keys are
  in the catalog - and the layering sentence naming "a preferred `stakes`
  level". In `skills/cad-config/SKILL.md`, add the `--roles` route and drop
  "routing stakes" from the description. In `references/config-catalog.md`,
  delete the `stakes` row, add twelve rows for `roles.<role>.model` and
  `roles.<role>.effort` under **Model** with purposes that say what the role
  does and per-value explanations that say what each costs, rewrite the
  `model.escalate_on_failure` row (one rung above the start), the
  `workflow.verifier` row (the risk floor decides; `--deep` forces), the
  three `review.triggers.<t>` rows' Default cells (the real defaults), and
  the `waive_routing_floor` row (stops that surface making the plan review
  blocking and turning the deep pass on). In
  `cadence-core/config.schema.json`, rewrite that same key's own `purpose`
  string in this task: it still reads "Which surfaces may NOT raise this
  project's plan-time ROUTING floor ... it waives a LEVEL, never a review",
  which is false once no level exists. The catalog row here and the reach row
  in Task 3 are the only other re-points, and neither is the SHIPPED schema
  text a `config.mjs keys` reader gets, so D-12 is delivered only when this
  string changes too. In `references/COMMANDS.md`, the
  `/cad-config` row lists `--roles`. Raise the `weight-budgets.json` ceilings
  for `cadence-core/workflows/config.md`, `cadence-core/references/config-catalog.md`
  and `skills/cad-config/SKILL.md` to the bytes `node cadence-core/bin/weight.mjs`
  measures after the edit - deliberate growth, accepted.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok: true` with
  no `budget-overrun`, no `unknown-config-key` and no `inert-config-key`;
  `grep -c "roles.cad-" cadence-core/references/config-catalog.md` prints
  `12`; `grep -cw "stakes" cadence-core/references/config-catalog.md skills/cad-config/SKILL.md cadence-core/references/COMMANDS.md`
  prints `0` for each; `grep -c -- "--roles" cadence-core/workflows/config.md skills/cad-config/SKILL.md cadence-core/references/COMMANDS.md`
  prints a non-zero count for each; `node --test cadence-core/bin/prose-agreement.test.mjs`
  passes. AC4 and AC2 are human-verify: in an interactive session run
  `/cad-config --roles` with a relocated `CADENCE_GLOBAL_CONFIG` holding no
  `roles` key and observe four `AskUserQuestion` calls totalling thirteen
  questions and a `roles` block written to that file and not to
  `.planning/config.json`; then run it again and observe a per-project
  adjustment landing in `.planning/config.json` only; then, on this
  repository, run any phase command and observe the migration showing the
  `critical` row as twelve values, and `stakes` gone from
  `.planning/config.json` afterwards.

### Task 2: The two init workflows run the interview, and the spawn seam states the new contract

- **Files:** cadence-core/workflows/new-project.md, cadence-core/workflows/adopt.md,
  cadence-core/references/seam-spawn-agent.md, cadence-core/references/seams.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In `workflows/new-project.md` step 4 and `workflows/adopt.md`
  step 3, the "ask no configuration questions" rule gains a second deliberate
  exception beside the forge: after the template copy, follow
  `workflows/config.md`'s **Roles interview** arm - the full thirteen to the
  global layer when that layer holds no `roles` key, then the per-project
  confirmation to the repo layer - and rewrite the one-line "Config written
  with defaults ... Stakes is left unset ..." sentence in both files to say
  what was written and where. In `references/seam-spawn-agent.md`: the
  routing paragraph no longer says "never dispatch a role at the session
  default when the project has stated its stakes" - it says the seam decides
  whether a model parameter is sent at all, and `model: null` means omit it
  (D-04); the `--attempt` bullet describes the one-rung climb; the **The
  stakes level a config layer set is the FLOOR** section and its four
  paragraphs are rewritten as the two-effect floor (D-02), the fail-closed
  rule (an unread scope raises), the waiver's re-pointed meaning (D-12), the
  two pre-plan roles it never reaches (D-16), and the `replay` paragraph is
  deleted (D-14); the "stakes level picks the row" bullet goes; the
  **Per-role pin**, **Per-role start rung**, **The roles block** and
  **Per-role model** bullets become: roles keys first, the older two families
  as fallbacks, `model_source` carrying the dotted key or `session`, an
  unaccepted string omitting the parameter; the **Relay every warnings[]
  entry** bullet gains one sentence: a `warnings[]` entry naming the retired
  `stakes` key is not relayed and moved past - the workflow opens
  `workflows/config.md`'s **Stakes migration** arm before dispatching; keep
  the **Tell the user when a pin fires** rule keyed on `pinned`. In
  `references/seams.md`, the `seam-spawn-agent.md` summary line names the
  two-effect floor and the migration trigger instead of "the stakes FLOOR".
  Re-pin the four files' `weight-budgets.json` rows to the measured bytes
  (down where the prose shrank, up where it grew).
- **Verify:** `git grep -nw stakes -- cadence-core/workflows/new-project.md cadence-core/workflows/adopt.md cadence-core/references/seam-spawn-agent.md cadence-core/references/seams.md`
  prints only the three `table stakes` lines of `new-project.md`;
  `grep -c "Roles interview" cadence-core/workflows/new-project.md cadence-core/workflows/adopt.md`
  prints `1` or more for each; `grep -c "Stakes migration" cadence-core/references/seam-spawn-agent.md`
  prints `1` or more; `grep -c "replay" cadence-core/references/seam-spawn-agent.md`
  prints `0`; `node cadence-core/bin/self-verify.mjs` reports `ok: true` with
  no `budget-overrun`; `node --test cadence-core/bin/prose-agreement.test.mjs`
  passes.

### Task 3: The remaining shipped prose and the code comments stop describing a level

- **Files:** cadence-core/references/config-reach.md, cadence-core/references/review-record.md,
  cadence-core/references/review-triggers.md, cadence-core/references/risk-surface.md,
  cadence-core/workflows/decision-review.md, cadence-core/workflows/execute.md,
  cadence-core/workflows/minimalism-review.md, cadence-core/workflows/plan.md,
  cadence-core/workflows/suggest.md, cadence-core/workflows/task.md,
  cadence-core/workflows/verify.md, skills/cad-plan-checker-contract/SKILL.md,
  cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/config.mjs, cadence-core/bin/lib/arg-contract.mjs,
  cadence-core/bin/lib/close-decision.mjs, cadence-core/bin/lib/plan-key.mjs,
  cadence-core/bin/lib/risk-diff.mjs, cadence-core/bin/lib/phase-plans.mjs,
  cadence-core/bin/lib/adjudication-record.mjs, cadence-core/bin/lib/why-record.mjs,
  cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/lib/task-record.mjs,
  cadence-core/bin/lib/surface-scan.mjs, cadence-core/bin/lib/rung-agent.mjs,
  cadence-core/bin/lib/trace-suggest.mjs, cadence-core/bin/lib/retired-keys.mjs,
  cadence-core/bin/retired-keys.test.mjs, cadence-core/bin/planning/risk-check.mjs,
  cadence-core/bin/planning/trace.mjs, cadence-core/bin/planning/plan-size.mjs
- **Action:** Locate every line with `git grep -nw stakes` and
  `git grep -n route-table` over `cadence-core/` and `skills/` (excluding
  tests and `fixtures/`) and rewrite each so it states HEAD's behaviour. The
  prose: `config-reach.md` - delete the `stakes` reach row, reword the six
  `model.overrides` rows as fallbacks under `roles.<role>.model`, drop
  "floored by any detected risk surface" from the eight effort rows (D-03),
  reword the per-trigger tier and effort rows to the schema default, and
  re-point the `waive_routing_floor` row (D-12); `review-triggers.md` - the
  gate is the configured value or the schema default, raised to blocking for
  the plan review by the floor, and the tier and effort sentences say the
  same without a level; `review-record.md`, `risk-surface.md` (the `critical`
  definition sentence), `decision-review.md`, `minimalism-review.md`,
  `execute.md`, `task.md`, `plan.md` and `skills/cad-plan-checker-contract/SKILL.md`
  - "at every stakes level" becomes the plain fact (the gate is blocking
  whatever is configured; the base reviewer runs at the session default
  whatever the roles block says; the plan checker's start rung is
  `roles.cad-plan-checker.effort`); `suggest.md` - the suggestion carries
  the key and the value in force, with no level; `verify.md`'s `deep_check`
  - `verify` on the resolve line is on when the phase's plans touched a
  risk surface, `workflow.verifier: false` still always skips, `--deep` still
  forces, and the off-line message names the floor instead of a level. The
  comments: the lines D-13 lists in `arg-contract.mjs`, `close-decision.mjs`,
  `plan-key.mjs`, `risk-diff.mjs`, `phase-plans.mjs` and `risk-check.mjs`
  ("blocking at every stakes level", "the discount below the configured
  stakes", "fail closed at the configured stakes"), the `route-table.json`
  remarks in `adjudication-record.mjs`, `why-record.mjs`, `surface-scan.mjs`,
  `rung-agent.mjs`, `trace-suggest.mjs`, `retired-keys.mjs`, `risk-check.mjs`,
  `trace.mjs`, `config.mjs` and the `replay` remarks in `phase-plans.mjs`,
  `why-corpus.mjs`, `task-record.mjs` and `plan-size.mjs` - each reworded to
  what is true now (the gate is blocking whatever is configured; an unread
  scope raises the floor; the vocabulary is the schema enum). The
  `retired-keys.mjs` edit is comment-only and still moves the sha256, so
  re-cut `RETIRED_KEYS_SHA256` in `retired-keys.test.mjs` in this same task
  and say why in its docblock. Where `prose-agreement.test.mjs` pins a
  sentence you change, change the pin to the new true sentence in the same
  commit - the pin asserts agreement, never the old words; delete a pin only
  when the fact it pinned (a level) no longer exists, and say so in the
  commit. Re-pin every edited prose surface's `weight-budgets.json` row to
  its measured bytes.
- **Verify:** `git grep -nw stakes -- cadence-core skills ':!*.test.mjs' ':!cadence-core/bin/lib/retired-keys.mjs' ':!cadence-core/bin/fixtures' ':!cadence-core/workflows/config.md'`
  prints exactly three lines, all in `cadence-core/workflows/new-project.md`
  and all containing `table stakes`. `workflows/config.md` is EXCLUDED by
  construction, not by oversight: Task 1's migration arm must name the key it
  removes and must invoke `config.mjs unset stakes` literally, so the sweep
  and that arm cannot both be satisfied over the same file. Its own check
  instead: `git grep -nw stakes -- cadence-core/workflows/config.md` prints
  only lines inside the Stakes migration arm, every one of them naming the key
  as a thing being REMOVED rather than read for routing; `git grep -ln "route-table" -- cadence-core skills ':!*.test.mjs'`
  prints nothing; `node cadence-core/bin/self-verify.mjs` reports `ok: true`
  with no `budget-overrun`; `node --test cadence-core/bin/prose-agreement.test.mjs cadence-core/bin/retired-keys.test.mjs`
  pass.

### Task 4: The public docs, the design record and the claim ledger say what HEAD does

- **Files:** README.md, METHOD.md, INTERNALS.md, DESIGN.md, CHANGELOG.md,
  docs/WORKFLOW.md, docs/rationale/plan.md, docs/rationale/verify.md,
  .planning/DOCS-CLAIMS.md, cadence-core/bin/prose-agreement.test.mjs
- **Action:** `README.md`: the **What a break costs** section becomes the
  section on the roles block and the interview - what each role runs at is a
  per-role model and effort the user chose in thirteen questions, `/cad-config
  --roles` re-opens them, a phase touching a risk surface makes the plan
  review blocking and turns the deep pass on and moves no model; the
  `/cad-config stakes=shipped` block, the 18-cell grid paragraph and the
  `route-table.json` link go; the risk-surface row in the trigger table drops
  "at every stakes level"; the line pointing `docs/WORKFLOW.md` at "the
  eighteen-cell stakes grid" points at what that doc now carries. `METHOD.md`:
  the gate paragraph (the `shipped` column, gates by level) states the real
  defaults and the plan-review raise; the `stakes` MINIMUM paragraph states
  the two-effect floor. `INTERNALS.md` line 13 - the one-key paragraph - is
  rewritten around the roles block, `model: null` as the session default, the
  one-rung climb, the two-effect floor and the waiver; line 17's
  `route-table.json` pointer goes. `docs/WORKFLOW.md`: the escalation note
  and the **Where each role starts, and where a retry lands** section - the
  eighteen-cell table and the torn-table paragraph - become the per-role
  defaults, the interview and the one-rung climb. `docs/rationale/plan.md`
  and `docs/rationale/verify.md`: "the stakes level reaches a fire site" and
  "the stakes term" become the schema default plus the floor. `DESIGN.md`:
  this file is a dated decision log - do not rewrite its history; append one
  dated **SUPERSEDED (2026-09-05)** bullet in the model-routing section
  recording that the stakes axis, the cells grid, `model_aliases` and
  `route-table.json` are replaced by the roles block, the schema's real
  defaults and the thirteen-question interview, and that the floor now moves
  two gates and no model. `CHANGELOG.md`: under `## [Unreleased]`, record the
  break under Keep-a-Changelog headings - Removed (`stakes`, the cells grid,
  `route-table.json`, `route.mjs replay`, `model_aliases`, the
  `model.overrides.*` enum), Added (`roles.*` catalog rows, `/cad-config
  --roles`, `config.mjs unset`, the migration), Changed (real review
  defaults, the two-effect floor, `model: null`, one-rung escalation,
  `model_source` on the trace event) - and leave every released entry as it
  is. `.planning/DOCS-CLAIMS.md` (D-17): rewrite the claim text of every row
  that states the level as HEAD's behaviour so the claim is what HEAD does
  and the verdict column stays truthful, at least `README-17`, `README-72`,
  `METHOD-46`, `METHOD-59`, `INTERNALS-08`, `INTERNALS-13`, `CONFIG-10`,
  `CONFIG-14`, `VERIFY-16`, `VERIFY-20`, `MINIMALISM-REVIEW-09`,
  `CONFIG-CATALOG-09`, `CONFIG-CATALOG-10`, plus any other row
  `git grep -nw stakes .planning/DOCS-CLAIMS.md` finds that is a row (a
  closed-item note recording a past run is history and stays). Where
  `prose-agreement.test.mjs` pins README counts or sentences you change
  (the `DOC-02` README arms), update the pin to the new true statement.
- **Verify:** `git grep -nw stakes -- README.md METHOD.md INTERNALS.md docs/WORKFLOW.md docs/rationale/plan.md docs/rationale/verify.md`
  prints nothing; `grep -c "route-table" README.md INTERNALS.md docs/WORKFLOW.md`
  prints `0` for each; `grep -c "SUPERSEDED (2026-09-05)" DESIGN.md` prints
  `1`; `sed -n '/^## \[Unreleased\]/,/^## \[3.7.11\]/p' CHANGELOG.md | grep -c "roles"`
  prints a non-zero count; for each row id listed in the action, the row must be
  PRESENT and rewritten, which is two assertions and not one:
  `awk -F'|' '$2 ~ /<id>/ {print $5}' .planning/DOCS-CLAIMS.md | grep -c .`
  prints `1` (exactly one non-empty claim cell was selected - without this a
  deleted or renamed row makes the next check pass on nothing), and
  `awk -F'|' '$2 ~ /<id>/ {print $5}' .planning/DOCS-CLAIMS.md | grep -cw stakes`
  prints `0` (the claim cell; the resolution cell is history and keeps its
  words); `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  then the whole tree: `node cadence-core/bin/test.mjs` passes,
  `node cadence-core/bin/self-verify.mjs` reports `ok: true`, and
  `npx tsc -p tsconfig.ci.json` is clean.

## Notes

- Requirement id: **ROL-02**, declared identically in PLAN-1 (see its Notes
  for the statement). Sequential plan; do not start before PLAN-2's Task 4
  commit.
- The migration writes the twelve per-role values only (AC2: "explicit
  per-role values"), not the gates, tiers or `verify` the level also implied;
  D-01 fixed those on schema defaults and the interview asks no gate
  question. The one-line notice the arm prints is how a `critical` project
  learns its adjudicated gates did not come across and where to set them.
  Flagged in the return marker.
- `--roles --global` as the way back into the full thirteen is the planner's
  addition to the arm: without it a user's global defaults could only be
  revised through `set --global` one key at a time. It is the same arm with
  the layer flag `config.mjs` already has (D-11).
- The migration's level table in `workflows/config.md` is the last copy of
  the cells grid anywhere in the tree, and it is prose read by the arm, not
  data read by code; that is deliberate under D-04's reading that no code
  path hand-copies a model name.
- Free-typed `Other` fidelity (flagged assumption) is handled by echoing
  `config.mjs set`'s `changed` back to the user, so a mangled string is seen
  at the moment it lands rather than at the first dispatch.
- `design-notes/design-reversals-2026-07-17.md` line 12 says "Highest
  stakes" in ordinary English and `workflows/new-project.md` says "table
  stakes" three times; neither is the key and neither is edited. The
  `cadence-core/bin/fixtures/` files carry historical trace rows with a
  `stakes` field and stay as fixtures.
- Ceilings in `weight-budgets.json` are re-pinned per task rather than once
  at the end because the file's own comment requires lowering in the same
  commit as a cut and self-verify refuses growth over a ceiling on every
  commit.
