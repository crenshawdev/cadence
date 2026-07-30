---
phase: 6
plan: 1
requirements:
  - CFG-01
  - HST-01
files:
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/config-reach.mjs
  - cadence-core/references/config-reach.md
  - cadence-core/config.schema.json
  - cadence-core/workflows/config.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/templates/config.json
  - cadence-core/bin/weight-budgets.json
  - skills/cad-plan-review/SKILL.md
  - skills/cad-decision-review/SKILL.md
  - cadence-core/bin/lib/config-merge.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - README.md
  - .claude-plugin/plugin.json
  - CHANGELOG.md
  - DESIGN.md
  - .planning/REQUIREMENTS.md
  - .planning/PROJECT.md
  - .planning/ROADMAP.md
---

# Phase 6: The remaining silent drops - Plan

## Goal

No config key is resolved, carried through the dispatch path, and then thrown
away with nothing said. The same defect shape `v1.5.0` closed for per-trigger
`effort` is closed everywhere it remains, the sweep that proves it is
re-runnable, and the plugin's documented home moves to
`https://git.jcrenshaw.dev/crenshawdev/cadence.git`.

## Must be true when done

- `node cadence-core/bin/config.mjs keys` shows every one of the six `tier`
  keys naming the cross-model backend as its only reach, and
  `workflow.skip_discuss`, `workflow.research` and `granularity` each naming the
  single reader that actually honours it.
- `cadence-core/references/config-reach.md` carries a reach row for all 72
  schema keys, and `node cadence-core/bin/self-verify.mjs` names the offending
  key on a key with no row, a row naming no key, and a narrow reach absent from
  its `purpose`.
- On the unmodified tree `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with the new check named in `checked`, and a key whose only prose
  mention is its reach row is still reported `inert-config-key`.
- No live prose surface presents a per-trigger or decision-review
  `tier`/`effort` as applied to a `claude-subagent` run, and a freshly
  scaffolded `.planning/config.json` carries `gate` and nothing else under a
  trigger.
- A `risk.override.<surface>` sitting in the user-global layer alone raises
  nothing and is named in `warnings`, and writing one through any spelling of
  the global file path is refused with the repo-scope rule.
- `README.md` and `.claude-plugin/plugin.json` name `git.jcrenshaw.dev` and no
  `github.com/crenshawdev`, and the `[2.0.0]` CHANGELOG entry gives an existing
  GitHub-installed user the exact commands to follow the move.
- `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
  tsconfig.ci.json` exits 0, and self-verify reports `ok:true` with no
  `budget-overrun` and no `unknown-config-key`.

## Context

- D-01/D-03: `tier` is SCOPED, never deleted and never wired - the cross-model
  arm is the only backend that honours it, and the delivery shape is #64's
  (`bc0095d`): schema `purpose`, a degradation line where the value fires, a
  catalog row, a DESIGN section-6 marker, a CHANGELOG bullet. No write-face
  refusal, no runtime validator.
- D-02/D-05: the re-runnable sweep is a reach table in
  `cadence-core/references/` plus ONE new self-verify check - never a `reach`
  field on 72 keys, and never a strengthening of check 1b's tokenizer, which
  passes today on all six defective keys and fires three false positives if
  naively narrowed.
- D-12: every budgeted surface is exact-fit, so any prose edit regenerates
  `cadence-core/bin/weight-budgets.json` in the same task.
  `cadence-core/references/*.md`, `config.schema.json`,
  `templates/config.json`, `README.md`, `DESIGN.md` and `CHANGELOG.md` are
  unbudgeted and free.
- Out of scope, do not touch: deleting any `tier` key, a write-face refusal for
  a tier set with only `claude-subagent` configured, wiring tier through as a
  model mapping, `review.triggers.<t>.gate`, the template's pre-written `gate`
  values, the issue tracker and `.github/ISSUE_TEMPLATE/config.yml`.

## Tasks

### Task 1: A URL host stops reading as a config key (AC9, prerequisite for AC6)

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Check 1's dotted-token regex reads `git.jcrenshaw.dev` out of
  `https://git.jcrenshaw.dev/crenshawdev/cadence.git` as a `git.*` config token:
  `git` is a real schema family, no segment is in `NON_KEY_SEGMENT`, and no
  schema key matches - so the moment README carries the new install URL,
  self-verify reports `unknown-config-key` and AC9 fails. Verified this session
  against the shipped schema. Before the `text.matchAll` at `self-verify.mjs:290`,
  build a scan copy with every URL masked - replace `https?://` runs up to the
  first whitespace or closing bracket/quote with a single space - and run the
  dotted-token loop over that copy instead of `text`. Leave the `BARE_KEYS` loop,
  the invocation join and the `${CLAUDE_PLUGIN_ROOT}` loop reading the raw `text`;
  they are unaffected and masking there would cost coverage for nothing. Say in
  the comment WHY the narrowing is bounded to URLs: a hostname is not a key, but
  a dotted token in ordinary prose still is, so the check keeps its teeth
  everywhere a key is actually written. Add two test rows to
  `self-verify.test.mjs` using the existing `fixture()` helper: prose carrying
  the full `https://git.jcrenshaw.dev/crenshawdev/cadence.git` install line
  yields no `unknown-config-key`, and prose carrying a bare `git.jcrenshaw.dev`
  outside any URL still yields one naming it.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes
  including both new rows, and `node cadence-core/bin/self-verify.mjs` still
  reports `ok:true`.

### Task 2: State each key's real reach at the point of setting (AC1)

- **Files:** cadence-core/config.schema.json, cadence-core/workflows/config.md, cadence-core/bin/weight-budgets.json
- **Action:** Rewrite nine `purpose` strings in `config.schema.json` so each
  states the reach it actually has. The five
  `review.triggers.{plan,diff,risk_surface,phase_diff,pre_ship}.tier` purposes
  and `review.decision_review.tier` each gain the phrase `cross-model reviewers
  only` verbatim - the same phrase the six `effort` purposes already carry, so
  the vocabulary stays one - plus a clause saying the `claude-subagent`
  reviewer's model comes from the routing cell (for the trigger keys) or that
  `/cad-decision-review`'s `cad-reviewer` arm resolves no model at all (for
  `review.decision_review.tier`, per D-04). `granularity`'s purpose drops "how
  finely phases split into tasks" and reads as the roadmap phase count its one
  reader at `workflows/new-project.md:236` computes, carrying the phrase
  `new-project roadmap step only`. `workflow.research` carries `new-project
  research step only`, its single reader being `new-project.md:144`.
  `workflow.skip_discuss` stops claiming a step is skipped and says it selects
  which command `/cad-progress` suggests for an unplanned phase, carrying the
  phrase `progress next-step suggestion only`; its only reader is the
  suggestion-table row at `workflows/progress.md:108` and nothing in
  `workflows/context.md` gates on it. Those three phrases plus `cross-model
  reviewers only` are the exact strings Task 3's table will require, so write
  them byte-identically. In `workflows/config.md`: update the `granularity`,
  `workflow.research` and `workflow.skip_discuss` catalog rows' Purpose text to
  match, add the same cross-model qualifier to the `review.triggers.<t>.tier`
  row at `:116` in the shape `:117`'s effort row already uses, and correct the
  "every knob, `review.providers.*` is the one exception" claim at `:24-29` to
  name the real exception set - `review.providers.*`, the six `model.overrides`
  pins, and `review.decision_review`'s two keys. Write `model.overrides` and
  `review.decision_review` as bare prefixes there, never
  `model.overrides.<role>`: check 1 expands only `<t>`, `<name>`/`<provider>`
  and `<surface>`, so a `<role>` placeholder reports `unknown-config-key`.
  Also add `deepseek`→cross-model to the `review.reviewers` row's option list at
  `:107`, which today offers `claude-subagent`/`openai`/`gemini` while
  `config.schema.json`'s enum and `review-provider.mjs`'s adapter both carry
  `deepseek` - CONTEXT:301 flagged it as a reach misstatement of D-08's family
  and left the call here, and this is the only task that opens `config.md` for
  the sweep arm.
  Regenerate `config.md`'s `weight-budgets.json` entry (17350 today, exact fit)
  from `node cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/config.mjs keys` shows all six `tier`
  purposes containing `cross-model reviewers only` and the three workflow keys
  containing their new phrases; `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with no `budget-overrun` on `cadence-core/workflows/config.md`.

### Task 3: The reach table and the check that proves it total (AC2, AC3)

- **Files:** cadence-core/bin/lib/config-reach.mjs, cadence-core/references/config-reach.md, cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Write the sweep as a stated grammar plus one pure lib function
  plus one self-verify check, the shape the four `v1.4.0` grammars use.
  `cadence-core/references/config-reach.md` states the grammar and then carries
  one row per schema key under a `## Reach rows` heading, table columns `Key |
  Reach | Honoured by`. `Reach` is either the literal `universal` or a phrase
  naming the narrower reach; `Honoured by` is prose naming the consumer and is
  not machine-checked. State the test a human applies when adding a key: is
  there a configuration in which this value is resolved and then not honoured,
  or a reader narrower than the purpose's plain reading? If yes, the reach is
  that narrower thing and the `purpose` must say so. State plainly what the
  check does and does not prove - it proves the table and the schema agree, not
  that either agrees with the code (D-02's accepted cost). Mark the twelve
  cross-model keys (six `tier`, five trigger `effort`,
  `review.decision_review.effort`) with `cross-model reviewers only`, and
  `granularity`, `workflow.research`, `workflow.skip_discuss` with the three
  phrases Task 2 wrote; every other key is `universal`.
  `cadence-core/bin/lib/config-reach.mjs` is pure - no fs, no emit, no process,
  matching `lib/risk-surfaces.mjs`'s header contract - and exports
  `parseReachTable(text)` returning `{rows, issues}` (rows `{key, reach,
  honouredBy, line}`, backticks stripped and whitespace collapsed; a body row
  with fewer than three cells or an empty key or reach cell yields a
  `malformed-reach-row` issue and no row; first occurrence of a key wins) and
  `reachIssues(schema, rows)` returning `{code, detail}` entries for exactly
  three classes: `missing-reach-row` for a schema key no row names,
  `unknown-reach-key` for a row whose key is absent from the schema, and
  `unstated-reach` for a row whose reach is not `universal` and whose key's
  `purpose` does not contain that phrase (compare with backticks stripped and
  whitespace collapsed on both sides). Every detail names the offending key. Wire
  it into `self-verify.mjs` as check 9, root-relative like `route-table.json` and
  `weight-budgets.json` so a `--root` fixture supplies its own: absent file skips
  the check, absent on a full tree is a `missing-input`, and the read plus parse
  are guarded so a malformed table is ONE problem and the run continues rather
  than unwinding to `reason:"internal"`. Add `config-reach` to the `checked`
  string in the final `emit` and a numbered entry to the header comment block.
  Crucially, stop `cadence-core/references/config-reach.md` from feeding
  `seenTokens` - and ONLY that. The table names all 72 keys by construction, so
  letting it feed `seenTokens` would make check 1b's `inert-config-key`
  unreachable forever. At `self-verify.mjs:290-301` the `seenTokens.add` and the
  `unknown-config-key` push are separate statements inside one `matchAll`, so
  skip the adds (and the `BARE_KEYS` `seenTokens` loop) for this one file while
  the forward `unknown-config-key` scan keeps reading it. Do NOT exclude the file
  from check 1 wholesale: class 2 (`unknown-reach-key`) inspects the Key column
  only, so a dead token written in the grammar prose or an `Honoured by` cell -
  a retired `model.profile`, a typo'd `review.triggers.<t>.efort` - would be
  scanned by nothing and ship green. Do NOT touch check 1b's tokenizer
  otherwise (D-05). Test rows in `self-verify.test.mjs`: add
  a fixture helper that writes BOTH a small synthetic `config.schema.json` (three
  keys, one narrow) and a reach table over it, so no expectation is derived from
  the shipped schema; then one row each for a consistent pair yielding no reach
  problems, a dropped row yielding `missing-reach-row` naming the key, an extra
  row for a key the schema lacks yielding `unknown-reach-key`, a narrow reach
  whose phrase is absent from the purpose yielding `unstated-reach`, the same
  narrow reach with the phrase present yielding none, a two-cell body row
  yielding `malformed-reach-row`, and a full tree with the reach doc deleted
  yielding `missing-input`. Add one more row that is the point of the exclusion:
  a key named ONLY by the reach table and by no other prose surface is still
  reported `inert-config-key`.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with `config-reach`
  in `checked` and zero problems; deleting one row from
  `cadence-core/references/config-reach.md` and re-running reports
  `missing-reach-row` naming that key, and restoring it returns `ok:true`.

### Task 4: The surfaces that still hand out a dropped knob (AC4)

- **Files:** skills/cad-plan-review/SKILL.md, skills/cad-decision-review/SKILL.md, cadence-core/templates/config.json, cadence-core/bin/weight-budgets.json
- **Action:** `skills/cad-plan-review/SKILL.md:42-43` currently says "Honor
  `review.triggers.plan` (gate, tier, effort)"; rewrite it so the gate is
  honoured unconditionally and `tier`/`effort` are named as reaching cross-model
  reviewers only. `skills/cad-decision-review/SKILL.md:49` currently says "plus
  which providers/models/tier/effort ran"; rewrite it so the report names which
  reviewers ran plus the tier/effort that reached the cross-model arm, stating
  the `cad-reviewer` arm resolves neither. Leave `skills/cad-land/SKILL.md`
  alone - it names only the gate default and needs nothing (D-09). In
  `cadence-core/templates/config.json:34-40`, drop `tier` and `effort` from all
  five per-trigger objects so each carries `gate` alone; leave the pre-written
  `gate` values exactly as they are (D-10 defers them). An unset knob must stay
  unset: `workflows/new-project.md:35` copies this template verbatim, so today
  every scaffolded project is handed a tier the default reviewer set drops.
  Regenerate both SKILL.md entries in `weight-budgets.json` (2439 and 2448
  today, exact fit) from `node cadence-core/bin/weight.mjs`.
- **Verify:** `grep -n "tier\|effort" cadence-core/templates/config.json` shows
  matches only under `providers`, `consult` and `decision_review`, none under
  `triggers`; copying the template to a scratch `.planning/config.json` and
  running `node cadence-core/bin/config.mjs validate --file <that path>` returns
  `ok:true`; `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` on either SKILL.md.

### Task 5: Decision review states what its subagent arm resolves (AC4)

- **Files:** cadence-core/workflows/decision-review.md, cadence-core/bin/weight-budgets.json
- **Action:** This workflow never calls `route.mjs` at all - its
  `claude-subagent` reviewer is the base `cad-reviewer` dispatched through the
  spawn-agent seam with no model, at every stakes level - so its scope clause is
  written independently and must NOT borrow `references/review-triggers.md`'s
  wording, which describes a resolved bundle this file never resolves (D-04).
  Add one short clause to the `refute` step's `claude-subagent` bullet saying
  exactly that: no routing cell resolves a model for this arm, and
  `review.decision_review.tier` and `.effort` reach the cross-model arm only.
  Rewrite `report_cost` at `:127` so the tier/effort line is reported as what the
  cross-model call used, with the `cad-reviewer` arm reported as having run at
  the session default with neither applied - said even when no cross-model
  reviewer ran, since that is the case where the old line was most misleading.
  Rewrite the `<success_criteria>` items at `:175` and `:179` the same way: the
  report names which reviewers ran and the tier/effort that reached the
  cross-model arm, never presented as applying to `cad-reviewer`. Keep the
  `review.providers.<name>.tiers[review.decision_review.tier]` token at `:56` and
  the `--effort <review.decision_review.effort>` token at `:62` intact - a
  rewrite that drops a token must leave a covering one behind or the key turns
  `inert-config-key`. Note the coverage is wider than those two lines: `:127`
  carries `review.decision_review.tier` directly and `:179`'s
  `review.decision_review.{tier,effort}` tokenizes to `review.decision_review`
  (the `{` ends the match at `self-verify.mjs:290`), which covers BOTH keys via
  the >=2-segment prefix rule at `:390-391`. So the `:127`/`:179` rewrites below
  are free to reshape those lines as long as at least one covering token for each
  key survives somewhere in the file. The file is exact-fit at 9436 with zero
  headroom, and D-12 makes the trim available: delete the `<purpose>` third
  paragraph (the "ruling and amendment list are this workflow's own prose
  output" paragraph), because `<guardrails>`' third bullet asserts the same
  thing and is the copy that carries the `D-07` citation. Regenerate the
  `weight-budgets.json` entry to the new exact measured size from `node
  cadence-core/bin/weight.mjs` - a justified bump is equally legal if the file
  ends larger.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` on `cadence-core/workflows/decision-review.md` and no
  `inert-config-key` for `review.decision_review.tier` or `.effort`. The
  mechanical clause above passes on the untouched tree, so it does not prove the
  edit landed - these three do:
  `grep -c "cad-reviewer" cadence-core/workflows/decision-review.md` is higher
  than its pre-task count and at least one match falls inside the `report_cost`
  step and one inside `<success_criteria>`;
  `grep -n "ruling and amendment list" cadence-core/workflows/decision-review.md`
  returns exactly one line and it is inside `<guardrails>`, not `<purpose>`; and
  reading `report_cost` shows no unqualified claim that a tier or effort applied
  to the run.

### Task 6: The resolver stops honouring a global-layer risk waiver (AC5)

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs, cadence-core/workflows/config.md, cadence-core/bin/weight-budgets.json
- **Action:** `route.mjs:107` reads `riskOverridesIn(c)` off the MERGED config
  while `config.schema.json` marks all eight `risk.override.*` keys `src: repo`,
  so one line in one global file disables the risk floor in every repository on
  the machine - phase 4 shipped this as a documented gap and this task closes it
  (D-06). `mergeLayers` already knows which layer supplied what but discards it,
  so add an additive `layers: {global, repo}` field to its return carrying the
  two validated per-layer objects (or null each), documented as: the merge loses
  provenance, and a key whose `src` is `repo` needs to know which file carried
  it. Do not change `config`, `source` or `warnings` - existing callers must be
  byte-identical. In `route.mjs`'s `readConfig`, build `riskOverrides` from the
  REPO layer alone, and separately collect the surfaces the GLOBAL layer
  WAIVES - a truthy `risk.override.<surface>`, not merely one the layer names.
  A global `risk.override.auth: false` waives nothing and is the ordinary
  not-waived case `route.mjs:194` already produces, so warning on it would put a
  "move your waiver" line on every dispatch in every repository on the machine
  for a waiver that does not exist - the every-resolve-noise shape the CONTEXT's
  Deferred section already names as a defect. For each waived surface push a
  `_warnings` entry naming the key, saying it is repo-scoped (`src: repo`), that
  it was ignored, and that a waiver belongs in this repo's own
  `.planning/config.json`. Warn whether or not the repo layer also names that
  surface - the global value never applies either way, and a waiver that
  vanishes without a trace is the exact shape this milestone closes.
  Leave `triggerGatesIn` and every other merged read untouched.
  This task also falsifies a shipped doc claim: `workflows/config.md:105`'s
  `risk.override.<surface>` row reads "Repo-scoped: `--global` is refused, though
  a waiver already in the global layer still resolves - set it in the repo's own
  config". D-06 names that line alongside `CHANGELOG:128-133` as the two places
  the gap is documented, and Task 10 only covers the CHANGELOG. Rewrite the
  clause here so it states the waiver is ignored and warned about, and regenerate
  `config.md`'s `weight-budgets.json` entry from `node cadence-core/bin/weight.mjs`
  (Task 2 already moved it off 17350; measure, do not assume). Add
  `route.test.mjs` rows: a global-only `risk.override.auth` with a repo config at
  `stakes: solo` and a PLAN declaring an auth path resolves `stakes: "critical"`
  and carries a warning naming `risk.override.auth` and the repo-scope rule; the
  same waiver in the REPO file still waives (the regression guard); both layers
  naming it waives via the repo value and still warns about the global one; and a
  global layer carrying only `stakes` still merges exactly as before.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes including the
  new rows; with a scratch global config holding `risk.override.auth: true`, a
  repo config at `stakes: solo` and a phase PLAN declaring an auth path,
  `CADENCE_GLOBAL_CONFIG=<that file> node cadence-core/bin/route.mjs resolve
  --role cad-executor --phase <N> --file <repo config>` prints `"stakes":
  "critical"` and a warning naming the key; the same command with the global
  value flipped to `false` prints no such warning; and
  `grep -n "still resolves" cadence-core/workflows/config.md` returns nothing
  while `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` on `cadence-core/workflows/config.md`.

### Task 7: The write face compares paths by identity, not by string (AC5)

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** `repoScopedErrors` at `config.mjs:204` decides "is this the global
  layer" with `file === GLOBAL_CONFIG`, so `set --file <global-dir>/./config.json
  risk.override.auth=true` writes straight through the refusal, and a symlink,
  a relative path or a trailing slash opens the same door (D-11). Replace the
  string equality with a filesystem-identity comparison: resolve both paths with
  `realpathSync`, and when a path does not exist yet - the global file is
  auto-created on `--global`, so absence is the ordinary case - fall back to
  `realpathSync` of its directory joined with its basename, and to plain
  `resolve()` if that throws too. Guard the whole comparison on `GLOBAL_CONFIG`
  being non-empty: `lib/config-merge.mjs` deliberately yields `''` where
  `homedir()` throws, and `''` must never match a real target. Keep the refusal
  message and the all-or-nothing placement exactly as they are - it is the
  comparison that is wrong, not the rule. Add `config.test.mjs` rows for the
  three aliases: `--file <dir>/./config.json`, a symlink pointing at the global
  file, and a path with a redundant `..` segment are each refused with a
  `repo-scoped` detail and write nothing, while a genuinely different repo file
  still accepts the same pair (the control that proves the check did not become
  a blanket refusal).
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes including
  the new rows; with `CADENCE_GLOBAL_CONFIG` pointed at a scratch global file,
  `node cadence-core/bin/config.mjs set --file <global-dir>/./config.json
  risk.override.auth=true` prints `ok:false` with a detail naming the repo-scope
  rule and leaves the file unchanged.

### Task 8: The plugin's documented home moves (AC6, AC7)

- **Files:** README.md, .claude-plugin/plugin.json
- **Action:** Exactly two files change (D-14). In `README.md`, the install block
  at `:37` reads `/plugin marketplace add
  https://git.jcrenshaw.dev/crenshawdev/cadence.git`; the test badge at `:3`
  points its image and link at the same host
  (`https://git.jcrenshaw.dev/crenshawdev/cadence/actions/workflows/test.yml`);
  and the ClaudePluginHub badge line at `:4` is DELETED outright - the endpoint
  still serves and the slug is not ours, so it cannot follow the move. In
  `.claude-plugin/plugin.json`, `homepage` becomes
  `https://git.jcrenshaw.dev/crenshawdev/cadence` and `repository` becomes the
  same with `.git`; that also fixes every future release link for free, since
  `release-bump.mjs:52-53` derives `<base>/releases/tag/v<version>` from those
  two fields and Forgejo uses the same path shape. Do not touch
  `.claude-plugin/marketplace.json` (its `source` is `./`), `CHANGELOG.md`'s
  historical release links, `DESIGN.md`'s one reference, or
  `.github/ISSUE_TEMPLATE/config.yml`. The self-hosted test badge renders "Not
  found" until a runner exists on that host; that is a verified, accepted state,
  not a defect to fix here.
- **Verify:** `grep -rn "github.com/crenshawdev" README.md
  .claude-plugin/plugin.json` returns nothing; `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `unknown-config-key` (Task 1 is what makes this hold). Then human-verify AC7:
  in a live Claude Code session run `/plugin marketplace add
  https://git.jcrenshaw.dev/crenshawdev/cadence.git` followed by `/plugin install
  cadence@cadence` and observe both succeed - it needs an interactive `/plugin`
  run against the live remote, which no executor command can stand in for.

### Task 9: HST-01 enters the traceability record (D-15)

- **Files:** .planning/REQUIREMENTS.md, .planning/PROJECT.md, .planning/ROADMAP.md
- **Action:** The hosting move gets its own requirement row rather than being
  folded under `CFG-01`, whose wording is about config keys and in which a later
  audit reader would never find it. Add `- **HST-01**: The plugin's documented
  home moves to the self-hosted Forgejo remote - README install block and test
  badge and the plugin manifest name `git.jcrenshaw.dev`, and GitHub stops being
  the published source` to `.planning/REQUIREMENTS.md`'s `## Active`, in the
  bullet form `references/req-traceability.md` states (column-0 `-`, the id
  alone inside the bold span). Update the counts: `REQUIREMENTS.md`'s footer
  line ("6 active requirements declared" -> 7), `PROJECT.md`'s Active paragraph
  ("Six requirements across six phases" -> Seven) and its footer ("6
  requirements, 6 phases" -> 7 requirements, 6 phases), plus a matching HST-01
  bullet in `PROJECT.md`'s Active requirement list. In `ROADMAP.md`, Phase 6's
  `**Requirements:**` line becomes `CFG-01, HST-01`; its `## Overview` carries
  no requirement count (verified this session), so nothing changes there. THEN
  run `node cadence-core/bin/planning.mjs seed-reqs --phase 6` - the row write
  must be ordered after the `## Active` bullet exists, because `seed-reqs`
  partitions the plan's declared ids against that section and reports an id with
  no bullet under `orphan_ids` instead of creating a row. Never hand-write a
  `## Traceability` row: `/cad-plan`'s seam call is its only creator and
  `Pending` its only status.
- **Verify:** `node cadence-core/bin/planning.mjs seed-reqs --phase 6` prints
  `ok:true` with no `orphan_ids` entry for HST-01, `.planning/REQUIREMENTS.md`'s
  `## Traceability` now holds `| HST-01 | Phase 6 | Pending |`, and `node
  cadence-core/bin/planning.mjs audit` reports no `unpicked` break naming
  HST-01.

### Task 10: The record, and the green gate (AC8, AC9)

- **Files:** CHANGELOG.md, DESIGN.md
- **Action:** Append two dated markers to `DESIGN.md` section 6, in the existing
  append-only style (`SCOPED (2026-07-28, #64)` at `:300` is the exemplar) -
  never rewrite a prior bullet, since section 6 must keep naming what it retires
  (D-13). The first goes in `### Provider model selection + live detection`,
  beside the `#64` bullet: `SCOPED (2026-07-29, CFG-01)`, naming the six
  surviving `tier` keys, stating that the cross-model arm is the only backend
  with a bridge from a trigger to a provider model id, that deletion was rejected
  because it removes six keys out from under the only backend that reads them,
  and that wiring tier through as a model mapping was rejected because the cell
  grid owns model resolution one phase after it shipped. Note in it that the
  `SUPERSEDED (2026-07-29)` bullet's "the whole `tier` vocabulary is deleted with
  the matrix" is true of the MODEL matrix only and left standing as the record it
  is. The second goes at the end of `### Model routing`: a dated marker recording
  that the `risk.override` repo-scope hole is closed in both directions - the
  resolver reads waivers from the repo layer alone and names a global one it
  ignored, and the write face compares by filesystem identity. In `CHANGELOG.md`,
  edit the current `## [Unreleased]` entry (which `release-bump.mjs` renames to
  `[2.0.0]` at the close): rewrite the last three sentences of the
  `risk.override.<surface>` Added bullet - the "that refusal is not yet airtight
  in either direction" paragraph and its "set a waiver only in a repo's own
  config until both close" advice - to state both arms as closed; add a bullet
  for the tier scoping, the reach table at
  `cadence-core/references/config-reach.md` and the new self-verify check; and
  add the hosting bullet stating that the plugin's home moved to
  `https://git.jcrenshaw.dev/crenshawdev/cadence.git`, that the GitHub repo stops
  moving, and the exact action an existing GitHub-installed user takes, spelled
  only with commands README already documents: `/plugin uninstall
  cadence@cadence`, then `/plugin marketplace add
  https://git.jcrenshaw.dev/crenshawdev/cadence.git`, then `/plugin install
  cadence@cadence`. Close the entry's record of this phase by naming what the
  reframe already closed on its way past rather than fixing twice - the
  `(stakes, tier)` model matrix deleted in phase 3, per-trigger `effort` scoped
  by `#64` in `v1.5.0`, the `escalate_effort_variant` shim retired in phase 1,
  and `model.profile` plus the `model.auto.*` keys retired in phase 2 - each
  already carrying its own dated section-6 marker.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
  tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with no `budget-overrun` on `decision-review.md`, `config.md`,
  `cad-plan-review/SKILL.md` or `cad-decision-review/SKILL.md` and no
  `unknown-config-key`; `grep -n "2026-07-29, CFG-01" DESIGN.md` returns the new
  marker, and the `[Unreleased]` entry contains all three `/plugin` commands of
  the upgrade action.

## Notes

- **Plan shape: ONE plan, deviating from CONTEXT's "multiple plans" directive.**
  The two arms do share files, so the independence test forbids the split. Two
  of them: `cadence-core/bin/self-verify.mjs` (+ its test), because the hosting
  URL `https://git.jcrenshaw.dev/...` is read by check 1's dotted-token regex as
  `git.jcrenshaw.dev` under the real `git` schema family and reported
  `unknown-config-key` - verified this session against the shipped schema, and
  AC9 forbids exactly that problem - so the hosting arm cannot land without
  editing the same file the config arm rewrites; and `CHANGELOG.md`, whose one
  `[Unreleased]` entry AC8 asks to carry the hosting note AND the record of what
  the reframe already closed, while D-06 requires the config arm to correct that
  same entry's documented-gap paragraph. Task order absorbs the coupling: Task 1
  lands the URL narrowing before Task 8 moves the README, and Task 10 writes the
  whole CHANGELOG entry once.
- `cadence-core/workflows/config.md` is touched twice on purpose: Task 2 for the
  reach wording and the `deepseek` option, Task 6 for the `risk.override` row
  whose "still resolves" clause that task falsifies. Task 2 runs first and Task 6
  re-measures the budget rather than assuming Task 2's number.
- Applied from the `plan` review trigger (adjudicated): the reach-doc exclusion
  narrowed to the `seenTokens` feed so the forward `unknown-config-key` scan
  still reads that file; Task 5's Verify given falsifiable greps because its
  mechanical clauses passed on the untouched tree; Task 5's ":56/:63 are the only
  coverage" claim corrected (`:62`, and `:127`/`:179` cover too); Task 6's global
  warning narrowed from surfaces-named to surfaces-waived; and the two additions
  above. Refuted and not applied: that the schema lives at
  `templates/config.schema.json` (it is `cadence-core/config.schema.json`), that
  an additive `layers` field breaks a `mergeLayers` caller (every caller
  destructures named fields), and two readings of Task 3's exclusion wording.
- `config.mjs get` still reports a global-layer `risk.override.<surface>` as an
  effective value after Task 6, because `get` reads the merged config by
  contract. D-06 scopes this phase to the resolver and the write face; the read
  face is out of scope and is recorded here so a later sweep does not read it as
  a missed surface.
- `/cad-plan`'s own `seed-reqs` call runs before this plan executes, so it will
  report `HST-01` under `orphan_ids` on this pass - the `## Active` bullet does
  not exist yet. Task 9 writes the bullet and re-runs the seam, which is
  idempotent; nothing needs re-planning.
- AC7 is the only human-verify criterion: it needs an interactive `/plugin` run
  against the live remote. `node`, `npx`, `git` and `curl` are all present on
  this machine, so every other Verify is executable by the executor.
