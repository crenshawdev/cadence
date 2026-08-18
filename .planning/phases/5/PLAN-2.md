---
phase: 5
plan: 2
requirements:
  - SGT-01
files:
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 5: The retune says what to change - Plan 2 (SGT-01, the seam)

## Goal

`trace suggest` stops returning a bare config key. Every keyed suggestion
carries the direction to move it and the value it holds now, a target value
where one can be read rather than guessed, and a ceiling rule whose evidence
does not bind is not returned as a suggestion at all.

## Must be true when done

- `planning.mjs trace suggest --phase <N>` returns a direction beside every
  non-null `action`, plus the key's current value.
- A target value appears only where one is READ - stepped down
  `route-table.json`'s stated gate ladder from a value a config layer set, or
  taken off the rung the record shows a role's escalated resolves landing on -
  and a rule that cannot be priced omits it entirely rather than returning null
  or a derived number.
- A key held in no config layer reports its current value as unset and names the
  stakes level the record carries, never the value that level would fire.
- A ceiling suggestion is not returned at all when every checkpoint it counted
  maps to a readable plan whose task count is under the resolved ceiling, and a
  checkpoint whose plan file cannot be read leaves the rule speaking rather than
  silencing it. The comparison is against the same resolved ceiling the
  suggestion prints as `current`, never a hardcoded 8.
- No `info` entry gains any of the three new keys, and the committed
  `fixtures/verbatim.trace.jsonl` assertion in `trace-suggest.test.mjs` is
  byte-identical to what it asserts today.
- The unset-layer defaults literal cannot drift from `cadence-core/config.schema.json`
  without a test going red.
- A check carrying a `WATCHED FAILING AT <sha>` header exits non-zero at the SHA
  it names and 0 here; `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Context

- D-05: `direction`, `current` and `proposed` are resolved in `planning.mjs`'s
  `sub === 'suggest'` arm and passed INTO `suggestFromRender`.
  `lib/trace-suggest.mjs` stays a pure function over the render - no I/O, no
  config import. The `window` arm two hundred lines below is the shipped
  precedent for exactly this shape.
- D-06 (unset names the decider, never the value), D-07 (which arms carry a
  target), D-08/D-09/D-10 (the binding check and its unknown arm), D-12
  (emit only where a figure exists), D-13 (`mergeLayers` warnings bound and
  ridden), D-14 (no flag change, so `self-verify.mjs`'s contract row is
  untouched), D-15 (a frozen defaults literal, not a runtime schema parse).
- Out: retuning `workflow.max_plan_tasks` itself (phase 4's PLN-01 closed it at
  8); any new flag or subcommand; any rule beyond R1, R3 and R4 gaining a keyed
  action - R2, R5 and R6 stay receipts with `action: null`.

## Tasks

### Task 1: The pure rules say which way to move a key and what it holds now

- **Files:** `cadence-core/bin/lib/trace-suggest.mjs`,
  `cadence-core/bin/trace-suggest.test.mjs`
- **Action:** Give `suggestFromRender` one additional parameter carrying the
  values its caller resolved - the config values behind the keys the rules name,
  the gate ladder, and the stakes level the record carries - and keep the
  function PURE: no `readFileSync`, no import of `config-merge.mjs`, nothing
  that reaches disk. The file's header states that constraint and the reason for
  it; extend that header rather than contradicting it. The parameter must be
  OPTIONAL in the sense that an absent one degrades honestly: every existing
  unit test in `trace-suggest.test.mjs` calls `suggestFromRender(render(...))`
  with one argument, and those calls must keep working, emitting a direction and
  an unset current rather than throwing. Emit on the three keyed rules only:
  R1's gate arm (`review.triggers.<t>.gate`) gets direction `lower`, because its
  evidence is a gate whose fires keep coming back empty; R1's reviewer arm
  (`review.reviewers`) gets direction `raise`, meaning strengthen the reviewer
  set - the gate caught work and the reviewers are what look miscalibrated, so
  `lower` would name the opposite move and no third value is available (the
  vocabulary is `raise`/`lower`, and widening it is a schema-shaped decision
  CONTEXT did not make); R3 (`model.effort.<role>`) gets `raise`; R4
  (`workflow.max_plan_tasks`) gets `lower`. R2, R5 and R6 gain NOTHING - they
  are receipts with `action: null` and D-12 requires their objects stay exactly
  `{kind, subject, evidence, action}`. For `current`: emit the value the caller
  resolved; when no config layer holds the key, emit a value that SAYS unset and
  names the stakes level the caller passed - the same refusal `config.mjs get`
  makes in the same words, for the reason its D-07 comment states, and never the
  value that level would fire, because printing an effective value invites the
  user to pin a gate at every level. When the caller passed no stakes level
  either (a record in scope with no `routing/resolve` event), say unset without
  naming a level rather than naming one the record does not carry. For
  `proposed`, follow D-07 exactly: R1's gate arm carries one - the value one
  step below `current` in the gate ladder the caller passed - and only when
  `current` is a value a layer actually set, since an unset gate has no position
  on the ladder to step down from and D-06 forbids reading the level's value to
  find one; R3 carries one - a rung the record shows that role's escalated
  resolves landing on, read off the `effort` field those events carry; R1's
  reviewer arm and R4 carry NONE, and the key is OMITTED rather than set to null
  or 0, which is the omit-not-zero rule `--turns` already follows and what keeps
  the change invisible where nothing was computed. Add unit tests beside the
  existing R1/R3/R4 cases covering each arm's direction, a set `current`, an
  unset `current` naming a level, an unset `current` with no level on the
  record, and the two arms that omit `proposed`.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` exits 0, with
  every test that existed before this task unedited except where a new
  assertion was added to it. `grep -n "readFileSync\|require(\|from 'node:fs'"
  cadence-core/bin/lib/trace-suggest.mjs` returns nothing. A unit case passing a
  resolution where `review.triggers.plan.gate` is `blocking` returns that
  suggestion with direction `lower`, current `blocking` and a proposed value one
  step below `blocking` in the ladder passed in; the same case with the gate
  unset returns a current that contains the word unset and the level's name, and
  carries no `proposed` key at all (checked with `'proposed' in entry`, not a
  null comparison). A case with two escalated `cad-planner` resolves carrying
  `effort: "xhigh"` returns `model.effort.cad-planner` with direction `raise`
  and proposed `xhigh`. `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 2: The suggest arm resolves the layer, the ladder and the level

- **Files:** `cadence-core/bin/planning.mjs`,
  `cadence-core/bin/prose-agreement.test.mjs`
- **Action:** In `planning.mjs`'s `sub === 'suggest'` arm, resolve everything
  task 1's parameter needs and pass it in, leaving the arm's ownership of scope
  and envelope otherwise as it is. Call `mergeLayers(join(dir, 'config.json'))`
  the way the `window` arm below it does, destructuring `warnings` and riding it
  on the envelope when non-empty - D-13, and the `undocumented-merge-warnings`
  rule in `lib/merge-warnings.mjs` refuses a callsite that binds neither
  `warnings` nor a file-header marker. Read the resolved values for the keys the
  rules name: each `review.triggers.<t>.gate` the record's fires reach,
  `review.reviewers`, each `model.effort.<role>` the record's resolves reach,
  and `workflow.max_plan_tasks`. For a key no layer holds, supply the unset
  signal rather than a value - except where the schema's default is a real value
  rather than the `null` that means "the stakes level decides": add a frozen
  defaults literal mirroring `cadence-core/config.schema.json` for exactly those
  keys (`workflow.max_plan_tasks` and `review.reviewers` are the two the rules
  name), sited and commented the way `DISPATCH_WINDOW_DEFAULTS` above it is,
  including its sentence naming the schema as the source of truth and this map
  as the unset-layer fallback; do NOT parse `config.schema.json` at runtime -
  neither `planning.mjs` nor `lib/trace-suggest.mjs` reads it today and D-15
  keeps it that way. Take the stakes level off the record: the level the most
  recent `routing/resolve` event in scope carries in its `stakes` field, and
  nothing when the scope holds none. Take the gate ladder from
  `cadence-core/route-table.json`'s `gates` array, resolved relative to this
  file's own directory the way `route.mjs` resolves that same file, and do NOT
  honour the `CADENCE_ROUTE_TABLE` environment override - an env-supplied ladder
  is the ungated override class EXP-01 closed. A route table that cannot be read
  or parsed degrades to no ladder, which makes the gate arm omit `proposed`;
  that omission IS the report, and no guessed ladder is substituted. Then close
  the drift CONTEXT's first flagged assumption names, settled here as YES:
  add one arm to `prose-agreement.test.mjs` that extracts the new frozen
  literal's key/value pairs from `planning.mjs`'s own source bytes and compares
  them to the `default` field `cadence-core/config.schema.json` carries for
  those same keys, in the extract-and-compare shape that file's PLN-01 arm
  already uses. Scope it to the keys the NEW literal carries;
  `DISPATCH_WINDOW_DEFAULTS` is not this phase's to widen onto.
- **Verify:** `node cadence-core/bin/planning.mjs trace suggest` unscoped on this
  repository exits 0 and returns its four `model.effort.<role>` entries and its
  `review.reviewers` entry each carrying a direction and a current - the
  `model.effort.*` currents reading unset and naming `shipped`, because no layer
  here pins one and every `routing/resolve` event in the record carries that
  level, and the `review.reviewers` current reading `["openai"]`, which is what
  `mergeLayers` resolves on this tree. No entry carries a null `direction`,
  a null `current` or a `proposed` key set to null. `node --test
  cadence-core/bin/prose-agreement.test.mjs` exits 0, and changing one value in
  the new frozen literal alone makes it FAIL naming the two unequal extractions
  (restore it afterwards). `node cadence-core/bin/self-verify.mjs` exits 0 with
  no `undocumented-merge-warnings` problem. `node cadence-core/bin/planning.mjs
  trace suggest --phase 2` against a `.planning/config.json` deliberately
  truncated mid-object returns a `warnings` array on the envelope (restore the
  file afterwards).

### Task 3: The ceiling rule goes silent when its evidence does not bind

- **Files:** `cadence-core/bin/planning.mjs`,
  `cadence-core/bin/lib/trace-suggest.mjs`,
  `cadence-core/bin/trace-suggest.test.mjs`
- **Action:** Make R4 SUPPRESS its suggestion - not return it with a caveat -
  when every checkpoint it counted maps to a readable plan whose task count is
  under the resolved ceiling. The file half stays in `planning.mjs` because
  `lib/trace-suggest.mjs` is pure: for each `lifecycle/checkpoint` event in
  scope whose `role` is `cad-executor`, take the `phase` and `plan` the event
  carries, resolve the plan file under `.planning/phases/<phase>/` using the
  existing `listPlanFiles` helper in this file, and count its tasks with
  `planTaskTitles` from `lib/planning-files.mjs`, which `planning.mjs` already
  imports and `cmdPlanSize` already uses this way. Pass the per-checkpoint
  counts and the resolved ceiling into `suggestFromRender`, and compare against
  that SAME resolved ceiling the suggestion prints as `current`, never a
  hardcoded 8 (D-10) - a project that raised the ceiling to 12 must not be told
  to lower one its plans never touched. A checkpoint whose plan file cannot be
  read is UNKNOWN and never under-ceiling (D-09): measured on this record, of 16
  executor checkpoints across 9 distinct `(phase, plan)` keys, three map to no
  file at all because their `plan` is a worker key rather than a plan number
  (`2/1-cut`, `2/1-fix`, `3/5`), and archived cycles keep phase dirs under a
  different milestone dir and filename shape while a delete-mode close removes
  them outright. So a single unknown leaves the rule speaking exactly as it does
  today, and only an all-known, all-under set silences it. A count EQUAL to the
  ceiling is not under it, so the rule speaks. This is a new class of check: the
  only gating in this path today is four evidence FLOORS, and none of them is
  being tightened - do not touch `MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION`. State in
  R4's comment why suppression rather than a caveat: a suggestion the evidence
  does not support is the thing that made `/cad-suggest` read as a report.
- **Verify:** Against a scratch `.planning` written through the CLI holding two
  `cad-executor` checkpoints whose `(phase, plan)` both resolve to plan files
  carrying fewer tasks than the resolved ceiling,
  `node cadence-core/bin/planning.mjs --dir <scratch> trace suggest --phase 1`
  returns NO entry whose `action` is `workflow.max_plan_tasks`; deleting one of
  those plan files and re-running returns one; restoring it and padding the
  other to exactly the ceiling's task count returns one as well. On this
  repository, `node cadence-core/bin/planning.mjs trace suggest --phase 2` STILL
  returns the ceiling entry and that is the correct answer under D-09 - see this
  plan's Notes, which records the divergence from AC2's live clause and why the
  locked decision wins. A unit
  case in `trace-suggest.test.mjs` passing two `cad-executor` checkpoints whose
  counts are both known and under the ceiling returns no ceiling suggestion; the
  same case with one count unknown returns one; the same case with one count
  equal to the ceiling returns one. The existing test "R4: executor checkpoints
  at the floor suggest workflow.max_plan_tasks; other roles do not" passes
  unedited, because its checkpoints carry no `(phase, plan)` and are therefore
  unknown. `node --test cadence-core/bin/trace-suggest.test.mjs` exits 0.

### Task 4: The change is invisible where nothing was computed

- **Files:** `cadence-core/bin/trace-suggest.test.mjs`
- **Action:** Pin D-12's silence with tests, so the three new keys can never
  leak onto an entry that computed none of them. Assert that no `kind: "info"`
  entry carries `direction`, `current` or `proposed` under any of the rules that
  emit one - R2's re-arm receipt, R3's held-rung receipt, R5's spend receipt and
  R6's coordinator receipt - checked with key presence (`'direction' in entry`),
  never with a null comparison, because a `null` would satisfy an equality check
  and is exactly what D-12 forbids. Assert that a `suggest` entry which cannot
  be priced omits `proposed` by key presence too. Confirm the committed-fixture
  test "fixture: the committed verbatim trace suggests exactly what it did
  before this phase" still asserts its two literal `info` objects with exactly
  `{kind, subject, evidence, action}` and that its literals were not edited by
  this plan. Leave the schema-key test ("config keys named in actions exist in
  config.schema.json") as the guard it already is - every `action` this plan
  emits is an existing key and none is new.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` exits 0.
  `git diff` over the range of this plan's commits shows no change to the two
  literal `info` objects in the fixture test. Adding `direction: 'raise'` to
  R2's receipt in `lib/trace-suggest.mjs` makes the new assertions FAIL naming
  the receipt that carried it (restore it afterwards).

### Task 5: The SGT-01 falsifier, watched failing at a named SHA

- **Files:** `cadence-core/bin/trace-suggest.test.mjs`
- **Action:** Add one test that fails against the unpatched tree and passes
  here, exercising the whole path rather than the pure function: write a scratch
  `.planning` through `appendEvent` holding two empty adjudicated fires for one
  trigger and two escalated resolves for one role, run
  `planning.mjs trace suggest --phase <N>` over it the way the existing seam
  test in this file runs the CLI, and assert the RETURN shape - each keyed
  suggestion carries a direction and a current, and the entry the record can
  price carries a proposed. That shape does not exist at all on the unpatched
  tree, which is what makes the check fail there. Carry the header in the shape
  this file's MSR-02 falsifier already uses: `WATCHED FAILING AT <sha>` naming
  the tip of the unpatched tree - the commit immediately preceding this plan's
  first implementation commit, which is task 1's - the observed unpatched output
  quoted verbatim, and the re-watch recipe (`git worktree add --detach <tmp>
  <sha>`, copy this file into that checkout's `cadence-core/bin/`,
  `node --test cadence-core/bin/trace-suggest.test.mjs` there,
  `git worktree remove <tmp>`). Write the SHA from what git reports at execution
  time, never from a SHA typed into this plan.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA the
  header names, the same command exits NON-ZERO with this test failing, and the
  header quotes that observed output. The SHA is read by EXTRACTING it from the
  `WATCHED FAILING AT` line rather than by counting occurrences of the phrase,
  and `git cat-file -t <extracted sha>` returns `commit` for a commit preceding
  task 1's in `git log`. `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Notes

- DEVIATION from D-05's letter, recorded rather than taken silently. D-05 reads
  "`direction`, `current` and `proposed` are resolved in `planning.mjs`'s
  `sub === 'suggest'` arm and passed INTO `suggestFromRender`". Task 1 places
  `current` there as written, but assigns `direction` per rule INSIDE the pure
  function, and derives R1's gate-arm `proposed` there too by stepping the
  ladder the caller passed. The reason is that `direction` is a property of the
  RULE, not of the config: `planning.mjs` cannot know whether R1 fired on its
  gate arm (`lower`) or its reviewer arm (`raise`) until `suggestFromRender` has
  run, so D-05's letter is not implementable for that field. D-05's stated
  REASON is honored exactly - `trace-suggest.mjs` acquires no `readFileSync`, no
  `config-merge.mjs` import and no disk access, and the 20-plus pure-render
  tests keep pinning exact outputs to exact traces. If the reviewer of this plan
  disagrees, the alternative is for `planning.mjs` to pre-compute a direction per
  (rule, arm) pair and pass a map in, which moves rule knowledge into the caller
  and buys nothing the purity constraint was protecting. Raised as a `high` by
  the `plan` trigger on 2026-08-17 and resolved this way.
- CONTEXT's first flagged assumption (whether the defaults-literal drift check
  widens in this phase) is settled YES in task 2, scoped to the keys the new
  literal carries and no further.
- CONTEXT's second flagged assumption (how R3 prices its target) is settled in
  task 1: the target is a rung the record SHOWS that role's escalated resolves
  landing on, read off the `effort` field those events carry - measured on this
  repository, an escalated `cad-planner` resolve carries `effort: "xhigh"`. That
  is a rung the routing table actually resolved, so it cannot be a legal rung the
  table would never produce.
- AC2's LIVE clause ("on this repo, `trace suggest --phase 2` returns no ceiling
  suggestion") conflicts with D-09 and is not planned. Measured while planning:
  phase `2` in `.planning/trace.jsonl` holds three `cad-executor` checkpoints,
  and they come from three different cycles - `('2','1')` under corr
  `2-b3748a4` (2026-08-10, `v3.5.1`), and `('2','1-cut')` and `('2','1-fix')`
  under corr `2-fc162e3` (2026-08-15, `v3.5.2`) - while the `phases/2/` directory
  on disk holds `v3.5.3`'s plans. Two of the three are worker keys that map to no
  plan file, which is exactly the case D-09 locks as UNKNOWN and never as
  under-ceiling, so the rule correctly keeps speaking on `--phase 2`. Resolving
  `1-cut` and `1-fix` to today's `PLAN-1.md` would satisfy the AC by reading a
  different cycle's plan, which is the hazard D-09's evidence names in those same
  three keys. The locked decision wins; the AC clause is raised to the human
  rather than engineered around.
- D-14 holds: no flag changes, so `cadence-core/bin/self-verify.mjs`'s
  `'trace suggest': ['--phase']` contract row is untouched and phase 4 D-19's
  same-commit CONTRACTS row requirement is not triggered.
- This plan shares `cadence-core/bin/planning.mjs` and
  `cadence-core/bin/lib/trace-suggest.mjs` with PLAN-1 and must run AFTER it,
  not beside it.
