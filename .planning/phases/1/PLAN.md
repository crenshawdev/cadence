---
phase: 1
plan: 1
requirements:
  - LOD-06
files:
  - cadence-core/references/seams.md
  - cadence-core/references/seam-ask-user.md
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/references/seam-review-provider.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/risk-surface.md
  - cadence-core/references/review-cross-model.md
  - cadence-core/references/review-record.md
  - cadence-core/references/conventions.md
  - cadence-core/references/git-guard.md
  - cadence-core/references/worktree-executor.md
  - cadence-core/references/execute-parallel.md
  - cadence-core/references/reviewer-brief.md
  - cadence-core/workflows/adopt.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/config.md
  - cadence-core/workflows/config-review.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/route-table.json
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/reference-routers.mjs
  - cadence-core/bin/reference-routers.test.mjs
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/lib/bulk-output.mjs
  - cadence-core/bin/bulk-output.test.mjs
  - cadence-core/bin/lib/text-transport.mjs
  - cadence-core/bin/text-transport.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/scratch-readback.test.mjs
  - cadence-core/bin/seam-calls.test.mjs
  - cadence-core/bin/trace.test.mjs
  - METHOD.md
  - DESIGN.md
---

# Phase 1: Cold-split the eager references - Plan

## Goal

A site that fires one review trigger, or calls one seam, stops reading the other
branches. `cadence-core/references/review-triggers.md` (40,413 B) and
`cadence-core/references/seams.md` (25,068 B) each become a small router with an
unambiguous branch decision plus cold files loaded only after that decision,
copying the `workflows/verify.md` / `verify-deep.md` split that already works.

## Must be true when done

- A site that runs risk-surface detection and matches nothing reads
  `cadence-core/references/risk-surface.md` alone and never opens
  `review-triggers.md`; a project whose `review.reviewers` is unset never loads
  the cross-model arm's prose at any fire.
- Naming a trigger or a seam call is enough to name the file it loads: both
  routers carry a branch index, every entry of which is a
  `${CLAUDE_PLUGIN_ROOT}` path that resolves on disk.
- Every gate arm, the pointer to the one-round re-arm cap, and every record
  obligation a caller owes before it picks a branch are readable in
  `review-triggers.md` without opening any cold file.
- `node cadence-core/bin/self-verify.mjs` reports `ok:true` with
  `reference-routers` in `checked`; deleting any cold file, or deleting its Read
  line out of its router, makes that same run report a problem naming the branch.
- `node cadence-core/bin/weight.mjs` reports every one of the eight reference
  files at the exact byte size `weight-budgets.json` pins for it, with no
  overrun anywhere in the tree.
- `node --test cadence-core/bin/*.test.mjs` passes after every task.

## Context

No CONTEXT.md exists for this phase; the plan is derived from the ROADMAP goal,
its seven Success Criteria and the source files themselves.

**OQ-1 is resolved here**, against the fire sites read during planning
(`workflows/plan.md` `review`, `workflows/execute.md` `risk_check` and the
`diff` fire, `references/execute-parallel.md` step 6, `workflows/task.md`,
`workflows/debug.md`, `workflows/verify.md`, `skills/cad-plan-review/SKILL.md`
step 2, `workflows/decision-review.md`, `workflows/minimalism-review.md`,
`workflows/config.md`'s surfaces arm).

*Genuinely per-branch, and therefore cold:* the `risk_surface` trigger's own
contract (the detection seam call, the eight categories, the one-time surfaces
ask, the pre-filter, the survivor-file path grammar and the milestone carry) -
selected by "this fire's trigger is `risk_surface`", and by the four detection
sites that run detection and never fire at all; the cross-model reviewer arm
(the scratch composition, the `--payload` seam call, the request-timeout rule) -
selected by "step 3's resolved set holds a provider besides `claude-subagent`",
which is false on a default project; and the outcome record's mechanics (the two
command lines, their flag semantics, the payload and ruling grammar) - selected
by "a survivor list settled under a non-advisory gate".

*Must stay hot, because a caller obeys it before it picks a branch:* step 6's
RE-READ mandate for `references/triage-gate.md` on ANY gate, `blocking`
included, verbatim - it is the only thing standing between a blocking site and
an uncapped re-arm, and the cap itself lives in `triage-gate.md`; step 1's gate
vocabulary and the `off`-returns-immediately rule; the four-arm record
statement (the trace append is the adjudicated arm's alone, the ADJUDICATION
RECORD is written on the BLOCKING arm as well, the ADVISORY arm writes neither);
the one sentence that a `risk_surface` fire persists its survivors at EVERY gate
and that `/cad-land`'s unattended close is their only consumer; the sentence
that a re-arm passes `--round 2` and that omitting it is REFUSED; step 3's
"never silently skip a `blocking` trigger" and its empty-set fallback; and the
Wiring table. For `seams.md` the only hot rule is the framing one - these are
the ONLY places host-runtime specifics may appear, and a workflow never inlines
a host alternative.

**The split rule, applied at every cut:** the router keeps the DECISION and the
RULE; the cold file takes the PROCEDURE - command lines, flag semantics, payload
shapes and failure handling. That is also what keeps criterion 6 cheap: the
roughly fifty existing citations of "`review-triggers.md` step 4" and
"`seams.md`'s bracket rule" still land on a file that states the rule or indexes
where it moved, so only citations pointing at prose the file no longer contains
are re-pointed.

Out of scope: `CHANGELOG.md` and `.planning/_archive-*` citations, which are
records of what was true when written; any further sub-split of the spawn-agent
seam.

## Tasks

### Task 1: Split `seams.md` into a router plus one cold file per seam

- **Files:** cadence-core/references/seams.md,
  cadence-core/references/seam-ask-user.md,
  cadence-core/references/seam-spawn-agent.md,
  cadence-core/references/seam-review-provider.md,
  cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Move the three seam sections out of `seams.md` VERBATIM, each into
  its own new reference, each keeping its existing `## Seam: <name>` heading
  text unchanged: `## Seam: ask-user` (through the deliberate no-default
  decisions) into `seam-ask-user.md`, `## Seam: spawn-agent` (from the Claude
  Code binding through the File round-trip block) into `seam-spawn-agent.md`,
  and `## Seam: call-review-provider` into `seam-review-provider.md`. Keeping
  the heading text is what lets `prose-agreement.test.mjs` keep splitting on
  `## Seam: spawn-agent` with only its path changed. `seams.md` becomes the
  router: the opening paragraph stays verbatim and hot (Cadence runs on Claude
  Code only, these seams are the ONLY places host-runtime specifics may appear,
  workflows reference a seam by name and never inline host-specific
  alternatives), then one entry per seam giving what it is for in a line and the
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/<file>` Read that loads it,
  then a rule index naming which of the three files holds each rule other
  surfaces cite by name - the bracket rule, the relay rule, Concurrent dispatch,
  Prompt shape, Return shape, Handoff read discipline, File round-trip, Worktree
  isolation, Routing, the per-role pin and the per-role start rung, the
  recommended-option convention, the deliberate no-default decisions, the
  degradation reason set and the prompt cap. The router must NOT carry a
  `route.mjs resolve` invocation: self-verify check 11 demands the relay
  paragraph in whatever file issues one, and that paragraph travels with the
  spawn-agent seam. In `prose-agreement.test.mjs` re-point the four reads that
  now resolve to nothing - the rung-bound check's `## Seam: spawn-agent` split,
  WIR-01's `## Seam: spawn-agent` split, WIR-01's
  `sentenceAround(seams, 'is exempt', ...)` (which follows the `over-cap`
  exemption into `seam-review-provider.md`), and MSR-01's
  `The bracket rides the resolve.` anchor. Pin all four budgets in
  `weight-budgets.json` in this same commit - a new reference with no budget row
  is an `unbudgeted-surface` failure, not a slack one.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an
  empty `problems` array; `node cadence-core/bin/weight.mjs` reports
  `cadence-core/references/seams.md` under 4,000 bytes and reports the three new
  seam files, each byte-equal to its `weight-budgets.json` row;
  `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  `grep -c 'route.mjs" resolve' cadence-core/references/seams.md` prints 0.

### Task 2: Pin every router branch with a self-verify check and a census row

- **Files:** cadence-core/bin/lib/reference-routers.mjs,
  cadence-core/bin/reference-routers.test.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/lib/census-registry.mjs
- **Action:** Write `lib/reference-routers.mjs` as a pure rule in the shape
  `lib/deferred-reads.mjs` and `lib/include-consumers.mjs` already use - no
  emit, no exit, no Date, node builtins only, every read guarded so one
  unreadable file is a reported issue rather than an unwound run, and no
  CONTRACTS row, for the reason self-verify check 14 states about `lib/*.mjs`.
  It exports a frozen hand-maintained `ROUTERS` register of
  `{router, branch, cold}` rows (root-relative POSIX paths), a `CODES` object,
  and a `referenceRouterIssues(root, rows)` taking `rows` as a parameter so a
  test can anchor a synthetic row without adding one to the shipped register.
  Three arms, one code each: the row's `cold` path is absent on disk; the
  router's text carries no `${CLAUDE_PLUGIN_ROOT}` mention of that cold path, so
  the branch lost its Read; and a registered router names a
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/*.md` path OUTSIDE any fenced
  code block that no row for that router declares. The third arm is the one that
  keeps the register honest, and excluding fenced blocks is what keeps
  `review-triggers.md`'s in-command `reviewer-brief.md` argument from reading as
  an unregistered branch. Seed the register with four rows that are true of the
  tree as it stands after task 1: the three `seams.md` seam branches, and
  `review-triggers.md`'s existing `triage-gate` branch - registering the
  triage-gate re-read is what makes phase criterion 3's named case machine-
  checked rather than asserted. Wire it into `self-verify.mjs` as a new check
  after the markdown walk, beside the existing `deferredReadIssues` call, and add
  `reference-routers` to the `checked:` string. Put the pure-rule tests in
  `reference-routers.test.mjs` with a `CADENCE-CENSUS: reference-router-branches`
  marker stating the row count and the router count, put the live-tree assertion
  in `self-verify.test.mjs` beside check 13's, and add the matching row to
  `CENSUSES` in `lib/census-registry.mjs` - holder
  `cadence-core/bin/reference-routers.test.mjs`, subjects
  `cadence-core/references/`. Do not add a length export to the registry (D-04).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` and its
  `checked` string contains `reference-routers`; with
  `cadence-core/references/seam-ask-user.md` temporarily renamed, the same
  command prints `ok:false` and a problem naming `seam-ask-user.md`, and with
  the file restored but its Read line deleted from `seams.md` it prints
  `ok:false` and a problem naming that branch; `node --test
  cadence-core/bin/reference-routers.test.mjs
  cadence-core/bin/census-registry.test.mjs
  cadence-core/bin/self-verify.test.mjs` passes.

### Task 3: Re-point every `seams.md` citation that names a specific seam or rule

- **Files:** cadence-core/workflows/adopt.md,
  cadence-core/workflows/new-project.md, cadence-core/workflows/config.md,
  cadence-core/workflows/config-review.md, cadence-core/workflows/context.md,
  cadence-core/workflows/decision-review.md,
  cadence-core/workflows/execute.md,
  cadence-core/workflows/minimalism-review.md,
  cadence-core/workflows/plan.md, cadence-core/workflows/progress.md,
  cadence-core/workflows/verify.md, cadence-core/workflows/verify-deep.md,
  cadence-core/references/review-triggers.md,
  cadence-core/references/conventions.md,
  cadence-core/references/worktree-executor.md,
  cadence-core/references/execute-parallel.md, METHOD.md, DESIGN.md,
  cadence-core/bin/seam-calls.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Every citation in these surfaces that names a SEAM or a named
  sub-rule now points at the file that holds it:
  `cadence-core/references/seam-ask-user.md` for the ask-user seam, the
  recommended-option convention, the no-fabricated-answer rule and the
  deliberate no-default decisions; `seam-spawn-agent.md` for the spawn-agent
  seam, the bracket rule, Concurrent dispatch, Prompt shape / cache discipline,
  Handoff read discipline, File round-trip, Worktree isolation, the Routing
  block and the relay rule; `seam-review-provider.md` for the provider seam and
  its degradation reasons. Citations that name the seam FAMILY rather than one
  seam stay on `seams.md`, which is now the index. Preserve each citation's
  existing spelling class - a bare `references/<file>` parenthetical stays bare
  and a `${CLAUDE_PLUGIN_ROOT}` path stays a plugin-root path - because check 3
  only validates the second form and silently reshaping the first would drop
  coverage. `workflows/plan.md` and `workflows/context.md` are subjects of the
  `seam-call-counts` census, so `cadence-core/bin/seam-calls.test.mjs` is
  declared here; re-pointing a citation adds no literal command block, so the
  pinned 14 and 6 are expected to hold, and if either moves it is re-pinned in
  this same commit. Sixteen of these surfaces are weight-budgeted, so re-pin
  every one whose byte size moved. Do NOT touch `CHANGELOG.md`.
- **Verify:** `grep -rn "seams\.md" cadence-core/workflows cadence-core/references
  skills agents METHOD.md DESIGN.md` returns only citations of the router as an
  index, with no surviving mention of a bracket rule, concurrent dispatch,
  spawn-agent, ask-user or provider degradation attributed to `seams.md`;
  `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an empty
  `problems` array; `node --test cadence-core/bin/*.test.mjs` passes.

### Task 4: Cold-split the `risk_surface` trigger contract out of `review-triggers.md`

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/references/risk-surface.md, cadence-core/workflows/execute.md,
  cadence-core/workflows/config.md, cadence-core/references/git-guard.md,
  cadence-core/route-table.json,
  cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/lib/reference-routers.mjs,
  cadence-core/bin/reference-routers.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Move the whole `## risk_surface detection` section - the
  `risk-check run` seam call, the two `surface`-named libraries, the eight
  categories in their `- \`token\` - prose` form, the one-time surfaces ask with
  its `detect-surfaces` call and its `config.mjs set` persistence, the
  resolved-set scoping and the two pre-filter drops - into
  `cadence-core/references/risk-surface.md` with the heading text unchanged, and
  move step 5's `A risk_surface fire PERSISTS its settled survivors, at every
  gate.` block with it. Keep the heading text and the category bullet shape
  byte-identical: `prose-agreement.test.mjs` splits on that literal heading and
  parses those bullets against `config.schema.json` and `route-table.json`, and
  reshaping either turns a three-way agreement check into a false pass. In the
  router leave the branch line that Reads the new file - reached both by a
  `risk_surface` fire and by a site running detection - plus, hot, the single
  sentence that a `risk_surface` fire persists its settled survivors at EVERY
  gate and that `/cad-land`'s unattended close is the only consumer that halt
  has, and the discriminator grammar (`plan-<k>` for a per-plan fire,
  `<command>-<short HEAD sha>` otherwise) stated ONCE in the router because both
  cold files use it. Re-point `workflows/execute.md`'s `surfaces-unanswered`
  citation and `workflows/config.md`'s one-time-ask citation at the new file,
  and update `route-table.json`'s `risk_surface_categories` comment, which names
  `references/review-triggers.md` as the third statement of the list.
  Re-point `references/git-guard.md`'s rail-4 sentence too - it reads "if the
  diff matches a risk surface (list in references/review-triggers.md)", and the
  LIST is exactly what this task moves. No test pins that sentence, so left
  alone it becomes a citation naming a file that no longer holds the thing it
  names, and nothing reddens. It is a prose citation rather than an include
  target, so criterion 6's include-target check does not reach it - the grep in
  Verify below is what covers it.
  Re-point `prose-agreement.test.mjs`'s `## risk_surface detection` read. Add
  the `risk_surface` row to `ROUTERS` and move the census marker's counts in the
  same commit. Re-pin every budget that moved.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes,
  including the three-way risk-surface-categories agreement;
  `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an empty
  `problems` array; `grep -c "risk_surface detection"
  cadence-core/references/review-triggers.md` prints 0 and
  `grep -c "risk_surface detection" cadence-core/references/risk-surface.md`
  prints 1; `grep -n "list in" cadence-core/references/git-guard.md` names
  `references/risk-surface.md` and not `references/review-triggers.md`; `node --test cadence-core/bin/*.test.mjs` passes.

### Task 5: Cold-split the cross-model reviewer arm out of step 4

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/references/review-cross-model.md,
  cadence-core/references/reviewer-brief.md,
  cadence-core/bin/lib/bulk-output.mjs, cadence-core/bin/bulk-output.test.mjs,
  cadence-core/bin/scratch-readback.test.mjs,
  cadence-core/bin/lib/reference-routers.mjs,
  cadence-core/bin/reference-routers.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Move step 4's `any cross-model provider` arm into
  `cadence-core/references/review-cross-model.md`: the scratch-directory
  composition block and its character-class guard, the echoed-directory and
  run-token discipline, the `node -e` composer and its refusals, the
  reviewer-brief rationale, the compose-here-not-in-the-seam argument, the
  run-token check and the `review-provider.mjs review --payload` call, the
  `review.request_timeout_ms` rule and the `ok:true` / `ok:false` handling. Move
  the `node -e` composer VERBATIM - `scratch-readback.test.mjs` extracts that
  script out of the prose and executes it, so a reflowed or re-quoted copy is a
  test that runs a different program than the one that ships. In the router's
  step 4 leave the branch decision and the rules a caller owes without the
  procedure: that this arm gets NO lifecycle bracket and no token field
  deliberately and what that costs `trace render`'s per-role total, that the
  trigger's tier and effort come off the step-1 line and index the provider's own
  `tiers` map, that an `ok:false` reviewer is named in one visible line before it
  is dropped, that emptying the set falls back to `claude-subagent` rather than
  returning nothing, and the `${CLAUDE_PLUGIN_ROOT}` Read of the new file gated
  on step 3's resolved set holding a provider other than `claude-subagent`.
  In `lib/bulk-output.mjs` move the `git diff <base_ref>..<head_ref>` redirect row
  to the new surface and ADD a second `git diff --cached` row for it: the one row
  whose reason today covers two occurrences of that call now spans two files, and
  one row per surface is what the check reads - that takes the register from 17
  rows to 18 and the `CADENCE-CENSUS: bulk-output-register` marker in
  `bulk-output.test.mjs` moves with it in this same commit, `4 redirect and 3
  file` unchanged. Re-point `scratch-readback.test.mjs`'s
  `surface: 'cadence-core/references/review-triggers.md'` row at the new file, and
  `references/reviewer-brief.md`'s citation of `review-triggers.md step 4` at the
  arm that actually composes it. Add the `cross-model` row to `ROUTERS`, move its
  census counts, and re-pin every budget that moved.
- **Verify:** `node --test cadence-core/bin/scratch-readback.test.mjs
  cadence-core/bin/bulk-output.test.mjs cadence-core/bin/census-registry.test.mjs`
  passes; `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an empty
  `problems` array, with `bulk-output`, `scratch-path` and `text-transport` all in
  `checked`; `grep -c "mktemp" cadence-core/references/review-triggers.md` prints
  0; `node --test cadence-core/bin/*.test.mjs` passes.

### Task 6: Cold-split the outcome record out of step 5

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/references/review-record.md,
  cadence-core/bin/lib/text-transport.mjs,
  cadence-core/bin/text-transport.test.mjs,
  cadence-core/bin/lib/reference-routers.mjs,
  cadence-core/bin/reference-routers.test.mjs, cadence-core/bin/trace.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Move step 5's record MECHANICS into
  `cadence-core/references/review-record.md`: the
  `trace append --family outcome --event adjudication` command line and every
  flag rule around it (`--plan`, `--base`/`--sha` as both ends of the range,
  `--raised` and the three settled counts travelling on flags rather than inside
  `--detail`, the seam's recount refusal, `--round`, `--trigger`), the voice-list
  detail and its scratch-file transport, and the adjudication record itself - who
  composes it and why, the per-voice payload shape, the three ruling values, the
  byte-exact restatement refusal, the `planning.mjs adjudication` call, the
  landing path and the `reports/` carve-out. In the router's step 5 leave, hot,
  the three combine modes and the RULE FIRST, MERGE AFTER paragraph unchanged;
  the arm statement that the trace append is the ADJUDICATED arm's alone, that
  the ADJUDICATION RECORD is written on the BLOCKING arm as well, and that the
  ADVISORY arm writes neither with the reason it writes neither; the instruction
  to report `<n> survivors of <m> raised` to the user; the sentence that a
  re-arm passes `--round 2`, that the fire site is the only actor that knows
  which round it is on, and that omitting it is REFUSED; and the
  `${CLAUDE_PLUGIN_ROOT}` Read of the new file at the settle point. Keep the
  router naming `planning.mjs adjudication` as the seam that writes the record,
  so `references/triage-gate.md`'s four "review-triggers.md step 5" citations
  still resolve without editing that file. In `lib/text-transport.mjs` move the
  `--detail <trigger>: <n> survivors; voices ...` row's `surface` to the new
  file; the register stays 36 rows with 20 derived, so the
  `CADENCE-CENSUS: text-transport-register` marker's numbers hold, and
  `text-transport.test.mjs` is declared because it is that census's holder.
  `trace.test.mjs`'s `BRACKETING` row for `review-triggers.md` is expected to
  stay at 1 - the subagent dispatch bracket stays in the router - and is re-pinned
  here only if the split moves it. Add the `record` row to `ROUTERS`, move its
  census counts, and re-pin every budget that moved. Then measure: run
  `node cadence-core/bin/weight.mjs` and record in the executor report the
  before/after byte sizes of `review-triggers.md` and `seams.md` and the sizes of
  all six new references, so the phase SUMMARY states measured numbers rather
  than numbers this plan asserted.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an
  empty `problems` array; `node cadence-core/bin/weight.mjs` reports
  `cadence-core/references/review-triggers.md` at under half its pre-split
  40,413 bytes and every one of the eight reference files byte-equal to its
  `weight-budgets.json` row; `node --test cadence-core/bin/*.test.mjs` passes;
  the executor report carries the measured before/after figures for both split
  files.

## Notes

- **The ROADMAP's premise for criterion 5 is stale at HEAD, and the criterion
  still binds.** `weight-budgets.json` pins `review-triggers.md` at 40,413 and
  the file measures 40,413, so it is AT its line rather than over it, and
  self-verify's budget check is a ceiling (`bytes > budget`), which means a
  shrink would pass with a stale pin. That is exactly why the pin has to be
  moved deliberately in the same commit as each cut rather than left to redden:
  nothing would redden. Every task above re-pins in its own commit, and the
  `weight-budgets` census row (subjects `cadence-core/references/`) makes the
  declaration mandatory at plan time.
- **Census obligations this lease carries**, each because the work edits a
  subject: `weight-budgets` (holder `cadence-core/bin/weight-budgets.json`),
  `bulk-output-register` (holder `cadence-core/bin/bulk-output.test.mjs`, count
  moves 17 -> 18), `text-transport-register` (holder
  `cadence-core/bin/text-transport.test.mjs`, count expected to hold at 36),
  `seam-call-counts` (holder `cadence-core/bin/seam-calls.test.mjs`, counts
  expected to hold at 14 and 6), and the new `reference-router-branches` row
  added in task 2.
- **Measured region sizes taken during planning**, for sequencing only - the
  SUMMARY's figures come from task 6's measurement, not from here.
  `review-triggers.md`: cross-model arm 8,762 B, risk_surface detection 7,295 B
  plus its persistence block 1,709 B, outcome record 6,956 B. `seams.md`:
  ask-user 1,873 B, spawn-agent 19,829 B, call-review-provider 3,053 B. The
  headline win is the detection-only site, which reads roughly 8 KB where it
  reads 40 KB today, and the ask-only site, which reads roughly 4 KB where it
  reads 25 KB today.
- **A ~17 KB `review-triggers.md` router is the pattern, not a miss.** The split
  this phase copies leaves `workflows/verify.md` at 18,281 B as the hot side
  against a 3,904 B cold branch; "small router" is read against that, and the
  rules criterion 3 requires to stay hot are what set the floor.
- **`weight.mjs resident` will report the six new references as
  `zeroResident`.** Its reachability is deliberately ONE hop from a command's
  eager set, so a file cited only by another reference does not count as
  reached - `capture-grammar.md`, `config-reach.md` and `lean-build.md` already
  sit there for the same reason. This is pre-existing behaviour rather than a
  regression this phase introduces, and no task changes it. Whether that measure
  should follow a router hop is a separate decision for the human.
- No task touches `skills/cad-plan-review/SKILL.md`: its deferred-read row and
  its stated one-consult-site count both still describe the router, which keeps
  its name and its step numbering.
