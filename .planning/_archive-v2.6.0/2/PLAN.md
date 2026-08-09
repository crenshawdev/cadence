---
phase: 2
plan: 1
requirements: [FRI-01, FRI-02, FRI-03]
files:
  - .planning/spikes/maxturns-cap-behaviour/SPIKE.md
  - agents/cad-assumptions-analyzer-high.md
  - agents/cad-assumptions-analyzer.md
  - agents/cad-executor-xhigh.md
  - agents/cad-executor.md
  - agents/cad-plan-checker-high.md
  - agents/cad-plan-checker-medium.md
  - agents/cad-plan-checker-xhigh.md
  - agents/cad-plan-checker.md
  - agents/cad-planner-max.md
  - agents/cad-planner-xhigh.md
  - agents/cad-planner.md
  - agents/cad-reviewer-max.md
  - agents/cad-reviewer-medium.md
  - agents/cad-reviewer-xhigh.md
  - agents/cad-reviewer.md
  - agents/cad-verifier-max.md
  - agents/cad-verifier-medium.md
  - agents/cad-verifier-xhigh.md
  - agents/cad-verifier.md
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/bin/lib/git-tags.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/triage-gate.md
  - cadence-core/templates/UAT.md
  - cadence-core/workflows/audit.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/verify.md
---

# Phase 2: Live friction - Plan

## Goal

The session-level defects the user hits by hand stop firing: UAT stops
interrogating the user with commands the model can run, a blocking review stops
re-arming on its own fix, and a planning-doc version drift becomes mechanically
visible to the gates.

## Must be true when done

- A walk over a checklist of 9 read-only-command items and 1 destructive item
  ends the turn asking about exactly ONE item; the other nine are shown as
  executed-and-cited rows and are already recorded in `UAT.md` with their
  evidence.
- `UAT.md` distinguishes three provenances that no longer collapse into one: a
  user answer (no `source` line), a deep-pass verifier result (`source:
  verifier`), and a model-executed walk result (`source: model`) - and the
  distinction survives every later `uat record` rewrite of the file.
- A verifier human check reaches `UAT.md` carrying `why_human`, so the walk can
  tell an item the verifier already judged human-only from one it must judge
  itself against the stated bar.
- A `risk_surface` firing on the commit that fixes the findings it just raised
  terminates: the cap is stated once in the arm every fire site shares, the
  second pass is narrowed to the fix, and a third would-be round is a terminal
  ask naming its reason.
- `.planning/spikes/maxturns-cap-behaviour/SPIKE.md` records - criteria written
  before the experiment - what a `maxTurns`-capped run actually returns, with a
  validated / invalidated / inconclusive verdict; every dispatched agent then
  carries the bound that verdict licensed, or the phase record names the path
  left unbounded and why.
- `/cad-audit` FAILs - the seam emits `version_drift` (task 6) and `audit.md`
  section 4 counts it as verdict-moving, not additive (task 7) - on a
  planning-doc version this repo has already tagged WHILE its cycle is still
  open; the key is absent when every phase is complete (the interrupted close),
  and absent when no tag carries the version at all. The manifest is not read. `cmdAudit` itself computes no verdict (it returns `ok:true`
  with data keys, planning.mjs:931-940); the FAIL is section 4's arithmetic over
  the key.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs --root .` are all green with
  `cadence-core/bin/weight-budgets.json` regenerated for every surface this phase
  edits.

## Context

Binding: `.planning/phases/2/CONTEXT.md` D-01..D-20. FRI-03 is NARROWED to the
`/cad-audit` arm alone - D-16's self-verify arm is CUT, not deferred, and must
not be planned. D-07 governs task 5: the spike's verdict decides whether a
`maxTurns` value ships at all this phase, so task 5 carries both arms and neither
is a scope cut. D-18: every prose surface here sits at EXACTLY its byte budget
today, so each task that edits prose regenerates its own entries in
`cadence-core/bin/weight-budgets.json` - an unregenerated entry is a hard
`budget-overrun` on the introducing commit. D-19: `references/review-triggers.md`
must stay at 15,134 B (two skills and `seams.md` hardcode the figure), which is
why the cap lands in `triage-gate.md`. D-20: no new `planning.mjs` flag,
subcommand or config key is introduced anywhere in this plan, so no `CONTRACTS`
or `config-reach.md` row moves.

## Tasks

### Task 1: Register model-executed provenance and carry `why_human` into UAT.md

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.mjs, cadence-core/templates/UAT.md, cadence-core/bin/planning.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Make the walk's two new item facts survivable before any prose asks
  for them. In `planning-files.mjs`: export `UAT_SOURCES = ['user', 'verifier',
  'model']` beside `UAT_ORIGINS` as the one place that enum lives, and add
  `why_human` to `UAT_FIELDS` immediately after `origin`. Registration is what
  makes a field survive - `renderUat` filters against `UAT_FIELDS` and every `uat
  record` rewrites the whole file, so an unregistered field is written by `merge`
  and destroyed by the next `record` (planning-files.mjs:936-943). In
  `planning.mjs` `uat record`: import `UAT_SOURCES`, validate `opts.source`
  against it BEFORE any write and fail `bad-args` naming the enum, in the same
  shape as the `--origin` guard at :554 - today `--source` accepts any string and
  silently stores nothing outside `verifier`, which would make a walk-executed
  pass indistinguishable from a user answer with nothing reporting the drop. Keep
  `user` IMPLICIT (never written onto the item) so existing checklists stay
  byte-identical, and store `item.source = source` for `verifier` and `model`.
  Leave the "verifier results only fill pending items" invariant scoped to
  `verifier` alone: a walk-executed result is a live answer at the item the walk
  is standing on, and widening the guard would refuse the retest re-record
  `route_failures` depends on. In `uat merge`'s `human_checks` append
  (planning.mjs:717-742) carry the entry's own `why_human` onto the appended item
  next to `origin: 'verifier'`, spread-guarded so an omitted value writes no line
  and no default is invented. In `templates/UAT.md` add both to the Rules
  vocabulary - `source: user | verifier | model` with `user` implicit and `model`
  meaning the walk ran the check itself and cited its evidence, and `why_human`
  as the verifier's per-item reason code inspection cannot settle it, written by
  `uat merge` from `human_checks[].why_human` - and show `why_human` on one
  example item. Keep that addition tight: `skills/cad-verify/SKILL.md` eagerly
  `@`-includes this template, so every byte is resident on every `/cad-verify`
  run. Add four tests to `planning.test.mjs`: `--source model` stores `source:
  model` and it survives a later `uat record` on a DIFFERENT item; `--source
  bogus` returns `ok:false` `bad-args` and leaves UAT.md byte-identical;
  `--source user` writes no `source` line; a `uat merge` payload whose
  `human_checks` entry carries `why_human` appends an item rendering that field,
  and a subsequent `uat record` on that item preserves it. Then regenerate ONLY
  the `cadence-core/templates/UAT.md` entry in `weight-budgets.json` from the
  byte count `node cadence-core/bin/weight.mjs --root .` reports.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes including
  the four new tests; `npx tsc -p tsconfig.ci.json` is clean; `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` (proves the
  template's budget entry was regenerated - it sits at exactly 5276 B today).

### Task 2: verify.md states the human-check bar and runs everything else

- **Files:** cadence-core/workflows/verify.md, cadence-core/bin/weight-budgets.json
- **Action:** Rewrite the `walk` step AND one clause of the resident
  `<guardrails>` block (those two only - `build_or_resume`'s item rules and the
  criteria grammar in `references/acceptance-criteria.md` stay closed). The walk
  step becomes a stated bar plus two passes. The BAR: an item is a human check only
  when the model cannot execute it - irreversible against real data, or outside
  the model's reach (credentials it lacks, a GUI, hardware, another machine).
  An item carrying `why_human` is already judged and its reason stands, do not
  re-litigate it. An item whose `expected` carries the CONTEXT-time
  `(human-verify: needs <tool/service>)` suffix is ALSO already judged - it is a
  human check, it does not enter pass 1, and pass 1 never runs its command. That
  exemption is not optional: `context.md:236-241` writes that suffix precisely
  when the tool is absent on this machine, `verify.md:92-95` (a region this task
  leaves closed) already routes it to the user, and such an item carries no
  `why_human`, because `why_human` reaches UAT.md only through `uat merge`'s
  `human_checks` append (planning.mjs:740) and never through `uat init`
  (:503-506). Without the exemption those items clear the bar, pass 1 runs a
  command the machine cannot run, and the result is recorded `blocked` - which is
  TERMINAL: `nextPending` returns only `pending` (planning.mjs:457-459),
  `uat refresh` appends only unseen names (:526-533), `route_failures`' reset to
  `pending` is scoped to `status: fail` (verify.md:210), and `uatComplete`
  refuses anything not pass-or-skipped-with-reason (planning-files.mjs:1085-1089).
  A phase would never reach Complete again. Pass 1 therefore records `blocked`
  ONLY for an item that cleared the bar and then failed on an environmental
  cause the bar did not predict, and the walk states that a `blocked` item needs
  the user's answer on the next run rather than being left to rot.
  PASS 1, execute-and-cite: read `.planning/phases/<N>/UAT.md` ONCE
  at the top of the walk to enumerate the pending items with their `expected`
  text - that read is pass 1's only stated input and has no substitute, since
  `uat status` returns `status`, `counts`, `result` and `first_pending` alone
  (planning.mjs:780-789), carrying neither an item list nor any `expected`
  string, and on a resumed session nothing has put the item bodies in context at
  all. Say in the same passage that this is ONE read BEFORE the chain starts, so
  the "no UAT.md re-reads between items" rule - and the success criterion that
  restates it - is unchanged and still governs pass 2's per-item chain. Then,
  before offering any item, run the check
  for every pending item that clears the bar and record each the moment it is
  settled with `uat record --phase <N> --item <k> --result <r> --evidence "<the
  command and the output that settles it>" --source model` - one call per item,
  never a `uat merge` payload, because `merge` atomically overwrites
  `phases/<N>/FINDINGS.json` on every success and would clobber the deep pass's
  envelope, the file that exists to make a discarded verifier finding recoverable
  (D-10). Then print ONE results table (item, result, cited command/output) so the
  executed items are visible in the transcript rather than only on disk. PASS 2,
  the ask: walk only the items that survive the bar, one per turn, ending the turn
  on the ask exactly as today - this needs no new seam, because an item recorded
  in pass 1 is no longer `pending` and `nextPending` (planning.mjs:457-459) stops
  offering it. A pass-1 `fail` routes to `route_failures` unchanged; the walk
  fixes nothing itself. Update the report block so the model-executed count is its
  own number - `Passed {n}/{total} ({v} auto-verified, {m} model-executed)` -
  because the template defines `auto-verified` as `source: verifier`, the deep
  pass, and folding the two would make that definition false. Add no new seam
  subcommand or flag: the mechanism already exists (D-08). THE GUARDRAIL, in the
  same file and the same commit: `<guardrails>`'s first bullet
  (verify.md:275-276) today permits a pass from exactly TWO sources - "the user's
  own answer or cited cad-verifier evidence" - which prohibits the pass-1 result
  the walk step now directs, so the file would ship a directive and a
  prohibition of the same behaviour on a surface whose only implementation
  mechanism is prose, and the guardrail is the more general and more quotable of
  the two. Rewrite that clause to THREE permitted sources: the user's own answer,
  cited cad-verifier evidence, or a walk-executed check whose command and output
  are cited on the item (`source: model`). Keep its prohibition verbatim - never
  from assuming a criterion holds because the code "should" work - because that
  half is what is actually load-bearing, and a cited command and output is
  evidence, which an assumption is not. Regenerate this file's
  `weight-budgets.json` entry from the byte count after BOTH edits (13758 B
  today, zero slack).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  (it lints every seam invocation in the new prose against the `uat record`
  CONTRACTS row and the regenerated budget together); `node
  cadence-core/bin/weight.mjs --root .` shows `cadence-core/workflows/verify.md`
  at or under its new entry; `sed -n '/<guardrails>/,/<\/guardrails>/p'
  cadence-core/workflows/verify.md` shows the third permitted source
  (`source: model`, cited command and output) beside the two existing ones with
  the "never from assuming" prohibition still there. Then human-verify (needs the plugin reinstalled from
  this branch - the skill resolves this prose through `${CLAUDE_PLUGIN_ROOT}`, so
  the repo copy is not what `/cad-verify` reads):
  1. `cd /data/code/cadence` and reinstall the plugin from this branch.
  2. Build a scratch phase whose UAT checklist holds 9 items each settled by a
     read-only command (`node --test ...`, `grep -n ...`, `git log --oneline -1`)
     and 1 item that would delete real data.
  3. Run `/cad-verify <that phase>`.
  4. Expected: the turn ends asking about exactly ONE item (the destructive one),
     with a results table above it holding 9 executed rows, each citing its
     command and output.
  5. Run `grep -c "^source: model" .planning/phases/<N>/UAT.md` - expected output:
     `9`.

### Task 3: Spike what a `maxTurns`-capped dispatch actually returns

- **Files:** .planning/spikes/maxturns-cap-behaviour/SPIKE.md
- **Action:** Follow `cadence-core/workflows/spike.md`. The question: when a
  subagent hits its frontmatter `maxTurns` cap, does the dispatch return the
  partial work the agent produced, or does it fail as a dispatch error with
  nothing usable - and is the count model turns or tool-use rounds? The decision
  that hinges on it is task 5: if a capped run is a failed dispatch, every long
  executor run converts into a dispatch failure at the cap and no value ships this
  phase. Write the file FIRST with the question and Given/When/Then criteria, each
  with an observable outcome, before any experiment exists, ordered risk-first:
  C1 (the kill test) - a throwaway agent file pinned at a deliberately tiny
  `maxTurns` (2), dispatched on a task that provably needs more rounds; a return
  carrying the agent's partial output -> validated, an error envelope with no
  usable content -> invalidated. C2 - whether the cap counts model turns or
  tool-use rounds, measured by how many Bash calls the capped run got through.
  C3 - re-confirm against the current host's subagent-frontmatter table and Agent
  tool parameter set that no PER-DISPATCH turn cap has appeared since the
  2026-07-28 enumeration in `.planning/spikes/xhigh-executor-truncation/SPIKE.md:53-77`;
  if one has, D-12 inverts and the recommendation says the bound belongs in
  `references/seams.md`'s dispatch binding rather than in 19 files. The throwaway
  agent definition lives under the spike dir or a temp dir and NEVER in `agents/`;
  discard it or note where it is. Close the file with two NAMED, EMPTY slots -
  an `Observation` section and a closing `VERDICT: ` / `RECOMMENDATION: ` pair -
  to be filled with one of validated / invalidated / inconclusive and a
  recommendation line task 5 executes verbatim: either a `maxTurns` value per
  role family with the observed turn count it clears, or "ship no value" with the
  reason. Do not touch an agent file, and do not write a value into any surface
  from this task. THEN HALT: commit this task's SPIKE.md (the criteria half) as
  the usual atomic task commit, then return a `human-verify` checkpoint naming
  this task (`execute.md:288`, `skills/cad-executor-contract/SKILL.md:118-131`)
  BEFORE starting task 4, and fill neither slot yourself. The experiment needs the
  `Task` tool the executor does not hold, so the verdict cannot come into
  existence while the executor is running - walking on to task 5 would find
  criteria and no verdict, and the inconclusive arm would be the only arm
  available, making AC5's value half unreachable regardless of what the host
  actually does at the cap. The orchestrator runs the experiment in the main
  session per the Verify steps below, writes the observation, the verdict word
  and the RECOMMENDATION line into SPIKE.md itself, then re-dispatches a fresh
  executor with `continue from task 4`.
- **Verify:** The dispatch half needs the `Task` tool, which `cad-executor` does
  not hold (`agents/cad-executor.md` declares Read, Write, Edit, Bash, Grep, Glob,
  LSP), so the experiment is human-verify while the criteria half is not. First,
  mechanically: `sed -n '1,80p' .planning/spikes/maxturns-cap-behaviour/SPIKE.md`
  shows the question and all three criteria in Given/When/Then form, written
  before any observation. Then human-verify, in the main session (which holds
  `Task`):
  1. Write the throwaway agent file with `maxTurns: 2` to
     `.claude/agents/cad-spike-maxturns.md` (or the host's agent dir), body: run
     three separate `Bash` echo commands, then report all three outputs.
  2. Dispatch it once with the Task tool.
  3. Observe and record verbatim in SPIKE.md: whether the return carries any of
     the agent's own text (partial work) or is an error envelope, and how many
     Bash calls it completed.
  4. Fill the two slots - the observation, then `VERDICT:` with one of the three
     words and `RECOMMENDATION:` with the line task 5 executes - delete the
     throwaway agent file, and commit as `docs: spike maxturns-cap-behaviour`.
  5. Re-dispatch a fresh cad-executor for this plan with `continue from task 4`
     (`execute.md`'s handle_checkpoint), so task 5 reads a SPIKE.md that already
     carries its verdict.

### Task 4: Cap the blocking arm's re-arm where every fire site shares it

- **Files:** cadence-core/references/triage-gate.md, cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** Rewrite `triage-gate.md`'s `blocking` bullet so "resume only after
  they are fixed (re-run fire)" is bounded, in the vocabulary the spine's other
  bounded loop already uses (`plan.md:212-236`, D-06): ONE re-arm maximum; the
  second fire is NARROWED to the fix's own diff plus the blocker list it is
  confirming and asks one question - is each blocker actually closed, and did the
  fix introduce anything new - rather than re-reviewing the whole artifact; if a
  blocker still survives that pass, STOP and ask the user (ask-user seam) whether
  to proceed anyway or stop and fix by hand, naming the reason ("`<trigger>`
  re-armed once on its own fix and still reports N blocker/high findings"), and
  never fire again in that loop. State plainly that the round count is
  orchestrator-context state, not persisted - nothing counts fires today, so a
  `/clear` between rounds resets it - so the limitation is visible rather than
  assumed (D-14). Write it ONCE, here: this is the arm all five fire sites
  (`execute.md`, `task.md`, `debug.md`, `verify.md`, `git-guard.md`) reach through
  `review-triggers.md` step 6, and a per-workflow cap would bound one path and
  leave four unbounded (D-05). Do NOT touch `references/review-triggers.md` - step
  6 already delegates this arm whole and the file must stay at 15,134 B (D-19).
  Then fix the one sentence this cap falsifies: `execute.md:303-307` argues
  against a bounded re-dispatch loop because it "would put the unbounded re-arm
  filed against the review triggers onto the execute path too" - reword that
  clause to name the re-arm as capped at one round in `triage-gate.md`, keeping
  the argument (the fallback is not a loop) intact and the edit byte-small.
  Regenerate both files' `weight-budgets.json` entries.
- **Verify:** `node cadence-core/bin/weight.mjs --root .` shows
  `cadence-core/references/review-triggers.md` still at exactly 15134 bytes and
  `triage-gate.md`/`execute.md` at or under their regenerated entries; `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true`; `grep -n
  "maximum\|re-armed once" cadence-core/references/triage-gate.md` shows the
  stated cap and the terminal ask inside the blocking arm.

### Task 5: Ship the runaway-loop bound the spike's verdict licensed

- **Files:** agents/cad-assumptions-analyzer-high.md, agents/cad-assumptions-analyzer.md, agents/cad-executor-xhigh.md, agents/cad-executor.md, agents/cad-plan-checker-high.md, agents/cad-plan-checker-medium.md, agents/cad-plan-checker-xhigh.md, agents/cad-plan-checker.md, agents/cad-planner-max.md, agents/cad-planner-xhigh.md, agents/cad-planner.md, agents/cad-reviewer-max.md, agents/cad-reviewer-medium.md, agents/cad-reviewer-xhigh.md, agents/cad-reviewer.md, agents/cad-verifier-max.md, agents/cad-verifier-medium.md, agents/cad-verifier-xhigh.md, agents/cad-verifier.md, cadence-core/workflows/new-project.md, cadence-core/bin/weight-budgets.json
- **Action:** Read `.planning/spikes/maxturns-cap-behaviour/SPIKE.md` and FIRST
  assert it carries a filled `VERDICT:` line (one of validated / invalidated /
  inconclusive) and a filled `RECOMMENDATION:` line. Either one still empty means
  the experiment task 3 halted for has not been run: HALT with a `blocked`
  checkpoint naming this task and the missing line, and take no arm - defaulting
  to the inconclusive arm there would ship no value on an experiment nobody
  performed and would report that as the spike's finding. With both lines
  present, execute the recommendation verbatim - the value is the spike's call,
  not this plan's (D-07). VALIDATED arm: add one `maxTurns: <the spike's value for
  that role family>` frontmatter key to each of the 19 files in `agents/`, placed
  directly after `effort:`. It is a per-FILE field and cannot vary by dispatch the
  way `model` can, so it goes in the 19 files and NOT into the spawn-agent seam in
  `references/seams.md` - a value resolved there and dropped at dispatch is the
  shape already documented for per-trigger `effort` (D-12). Add nothing to any
  agent BODY: self-verify check 7 fails a rung file whose body carries behaviour,
  while frontmatter is read for `tools:`/`skills:`/`effort:` only and a new key is
  accepted (self-verify.mjs:700-792). INVALIDATED or INCONCLUSIVE arm: ship NO
  value anywhere, and record it as a `[deviation]` entry on the Deviations line
  of this plan's own report file `.planning/phases/2/reports/plan-1.md` - the
  verdict, the observation behind it, and that every dispatched agent therefore
  stays unbounded this cycle - do not ship a guessed number to have one. The
  report file and NOT SUMMARY.md: the executor never writes SUMMARY
  (`execute.md:191`), the orchestrator's `summary` step aggregates the report
  into it, and the report path is the single exemption `lease-check` allows a
  path no plan declares (planning.mjs:1602-1604), which SUMMARY.md is not.
  BOTH arms: name the one
  dispatch path that carries no Cadence agent file. `new-project.md`'s research
  step (`:147-149`) dispatches a generic host agent Cadence owns no file for, so
  it is outside any frontmatter bound; add one sentence at that step saying so
  deliberately, with its reason (no Cadence agent file exists for it, and minting
  a 20th rung to bound one optional research pass costs a `route-table.json` rung
  row and both directions of self-verify check 8) and the bound it does have,
  `workflow.subagent_timeout`. It may not be silently counted as bounded (D-13).
  Regenerate every entry this task changed in `weight-budgets.json` - the 19 agent
  files on the validated arm, and `new-project.md` on both.
- **Verify:** Validated arm: `grep -c "^maxTurns:" agents/*.md` returns `1` for
  each of the 19 files. Invalidated/inconclusive arm: `grep -rn "maxTurns"
  agents/` returns nothing and `grep -n "deviation" .planning/phases/2/reports/plan-1.md`
  shows the recorded deviation naming the verdict. Both arms:
  `grep -n "subagent_timeout" cadence-core/workflows/new-project.md` shows the
  named-exclusion sentence at the research step; `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` (proving no
  `budget-overrun`, no `rung-effort-mismatch` and no `agent-carries-behaviour`);
  `node --test cadence-core/bin/self-verify.test.mjs` passes.

### Task 6: The audit seam detects an already-published planning-doc version

- **Files:** cadence-core/bin/lib/branch-decision.mjs, cadence-core/bin/lib/git-tags.mjs, cadence-core/bin/git-branch.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Reuse the readers that already exist rather than growing second
  ones. In `lib/branch-decision.mjs`: export `activeVersion`, `titleVersion` and
  `tagCarrying` (all module-private today) and update the header's "Public
  surface" paragraph to name them and their one new consumer - the prose reader
  keeps the `### Active` -> ROADMAP-title precedence exactly as branch naming uses
  it, FOR DRIFT DETECTION ONLY, never for deriving a release number (REL-03's ban
  stands, D-15). Keep `tagCarrying`'s MEMBERSHIP semantics untouched: a version
  that merely sorts below the newest tag is not drift, and the new consumer passes
  the whole `publishedVersions` list (D-04). Move `readTags(dir)` out of
  `git-branch.mjs:43-49` into a new `lib/git-tags.mjs`, exported unchanged (same
  `git -C <dir> tag --list`, same degrade-to-`[]` on any failure - no repo, no
  tags, no git), and import it from both `git-branch.mjs` and `planning.mjs`: one
  tag reader for the same reason D-15 gives for one prose reader. In
  `planning.mjs` `cmdAudit`: read `<dir>/PROJECT.md` through the existing `read()`
  (absence is data, never a crash), derive `docVersion = activeVersion(project) ||
  titleVersion(roadmap)`, call `readTags(dir)` (the `--dir` planning root sits
  inside the repo so `git -C` discovers it), and compute the tag carrying that
  version. The comparator is IMPORTED, never minted: bring `compareVersions` and
  `normalizeTargetVersion` into `planning.mjs` from `lib/release-decision.mjs`
  (no edit to that module - it holds the one module-private `SEMVER_RE`, and
  `tagCarrying` already applies `compareVersions` on the tag side at
  branch-decision.mjs:107, so the two halves of this check cannot drift). It is
  NOT in `branch-decision.mjs` and is not among the three exports above, so an
  executor left to find it would mint a second comparator - the duplication D-15
  argues against for the prose reader, reproduced for the version comparator.
  Normalize the doc version's spelling before comparing: `activeVersion` returns
  the prose token with its `v` (`v9.9.0`, branch-decision.mjs:40), while
  `tagCarrying` takes a BARE comparand (its existing caller strips first, :184)
  and `compareVersions` returns null - not 0 - for a `v`-prefixed operand, so the
  raw token would match no tag at all.

  **The manifest is NOT a comparand, and `pluginVersion()` is not read here.**
  D-03 states the reason and the plan review demonstrated it: `MANIFEST_PATH` is
  SCRIPT-relative (planning.mjs:86-87) and `audit.md:19` invokes the seam through
  `${CLAUDE_PLUGIN_ROOT}`, so in any project that is not Cadence it reports
  Cadence's own version - proved by running `criteria-coverage --dir` against a
  non-Cadence tree, which returns `plugin: "2.5.0"` for a repo with no manifest
  at all. A manifest-based predicate makes a downstream project's ship gate
  depend on Cadence's release number. `skills/cad-health/SKILL.md:72-88`, shipped
  in this cycle's phase 1, already states the rule this arm must match: tags are
  the publication evidence, a manifest in the checkout is not.

  Emit a top-level `version_drift: {doc_version, published_as, cycle_state}`
  ONLY when a TAG carries the doc's Active version AND the cycle is still OPEN -
  that is, `phases[]` holds at least one phase that is not `complete`. Omit the
  key otherwise. The two omissions are different states and both are correct: a
  doc version no tag carries is the ordinary ahead-of-manifest mid-cycle state
  (this repo is in it now), and a tagged doc version with EVERY phase complete is
  the interrupted close between `milestone.md` step 2 and step 4, which is D-01's
  exemption. The cycle's own completeness is what separates them, and the
  manifest cannot: at tag `v2.4.0` this repo had PROJECT.md Active naming
  `v2.4.0`, tag `v2.4.0` present, and manifest `2.4.0` - byte-identical to an
  interrupted close on the manifest test, which is why the manifest predicate
  would have been silent on issue #87, the incident FRI-03 exists for. Under the
  tag-plus-open-cycle predicate it fires there, because that cycle's phases were
  still open while its number had already shipped. Leave
  `requirements[]` and `counts` untouched - `total = traced + broken + deferred`
  is an asserted invariant and this signal is milestone-scoped, not
  per-requirement - so the key is present-or-absent, matching the seam's
  additive-field convention. No new flag or subcommand, so no CONTRACTS row moves
  (D-20). Add six tests to `planning.test.mjs` on a scratch git repo that can
  actually carry a tag - model it on `git-branch.test.mjs:36-47`'s
  `taggedFixture`, NOT on `leaseRepo` (:3860), which makes no commit and
  neutralizes no global git config, so `git tag` dies with `fatal: no tag
  message?` on any machine with `tag.gpgsign` or `commit.gpgsign` set globally,
  including this one. `taggedFixture` passes `GIT_AUTHOR_*`/`GIT_COMMITTER_*`
  plus `GIT_CONFIG_GLOBAL: '/dev/null'` and `GIT_CONFIG_SYSTEM: '/dev/null'` for
  exactly that reason and says so in its own comment. No manifest injection is
  needed, since this predicate never reads one. The cases:
  docs `v9.9.0` + tag `v9.9.0` + one phase not complete -> `version_drift`
  present naming `doc_version`, `published_as` and `cycle_state`; the SAME tree
  with every phase complete -> key absent (D-01's interrupted-close exemption,
  and the case that falsifies a tag-only predicate); docs `v9.9.0` with tags
  `['v9.9.1']` -> key absent (published by nothing, merely sorted below); no git
  repo at all -> key absent, `ok:true`, the rest of the audit envelope unchanged;
  PROJECT.md with no `### Active` version -> the ROADMAP `# ` title supplies the
  comparand. Add a sixth replaying this repo's own `v2.4.0` state - docs Active
  `v2.4.0`, tag `v2.4.0`, phases open - and assert the key IS present, so issue
  #87 has a regression test naming it.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs
  cadence-core/bin/git-branch.test.mjs` passes with the six new tests; `npx tsc
  -p tsconfig.ci.json` is clean; `node cadence-core/bin/planning.mjs audit | grep
  -c version_drift` returns `0` against this repo (the docs name `v2.6.0`, which
  no tag carries); `node cadence-core/bin/self-verify.mjs --root .` returns
  `ok:true`.

### Task 7: audit.md states the drift break and makes it verdict-moving

- **Files:** cadence-core/workflows/audit.md, cadence-core/bin/weight-budgets.json
- **Action:** Name the seam's new key in all three places the workflow reads it.
  In §2, list `version_drift` (`{doc_version, published_as, cycle_state}`, omitted
  when there is nothing to report) beside the other returned keys. In §3, add its
  interpretation: the planning docs name a version this repo has ALREADY tagged
  while its cycle is still open - issue #87's failure mode, a cycle being planned
  under a number that already shipped - with two exits: open the next version in
  `PROJECT.md ### Active`, or, if the cycle really is finished, complete the close
  so no phase is left open. In §4, state it as VERDICT-MOVING and not
  additive, in the same explicit form `unseeded` already gets: FAIL when
  `version_drift` is present, listing the doc version, the tag spelling that
  carries it and the cycle state. An additive report would change nothing -
  `/cad-health` already reports this in prose, and FRI-03's wording is
  "mechanically, rather than only reported" (D-01). Say in the same passage what
  is NOT drift, so the gate is not softened later by someone re-deriving it: a doc
  version no tag carries is the normal mid-cycle state, and a tagged doc version
  with every phase complete is exempt because that is exactly what a close
  interrupted between `milestone.md` steps 2 and 4 leaves on disk. State also
  that the manifest is deliberately not a comparand - `pluginVersion()` resolves
  relative to the SCRIPT, so reading it here would judge a downstream project
  against Cadence's own release number (D-03), and `/cad-health` already settled
  that tags are the publication evidence.
  Regenerate `audit.md`'s `weight-budgets.json` entry (9894 B today, zero slack).
- **Verify:** `grep -n "version_drift" cadence-core/workflows/audit.md` shows it
  in the §2 key list, the §3 interpretation list and the §4 verdict arithmetic;
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`; `node
  cadence-core/bin/weight.mjs --root .` shows `cadence-core/workflows/audit.md` at
  or under its regenerated entry.

## Notes

**One plan, against the CONTEXT `Plan shape` directive (multiple plans, roughly
one per requirement).** The independence test refuses the split on two counts,
both of them shared files rather than shared ordering:

1. `cadence-core/bin/weight-budgets.json` is written by all three requirements -
   FRI-01 edits `templates/UAT.md` and `verify.md`, FRI-02 edits
   `triage-gate.md`, `execute.md` and 19 `agents/*.md`, FRI-03 edits `audit.md`,
   and every one of those surfaces sits at EXACTLY its budget today (D-18), so
   each slice must regenerate its own entries to leave CI green. Deferring the
   regeneration to one slice would make the other slices' commits red and
   introduce exactly the cross-slice ordering a split is supposed to remove.
2. `cadence-core/bin/planning.mjs` and `cadence-core/bin/planning.test.mjs` are
   written by both FRI-01 (the `uat record` source enum and the `uat merge`
   `human_checks` append) and FRI-03 (`cmdAudit`'s drift signal).

Task order carries the two real dependencies: task 3's spike must complete before
task 5 acts on its verdict (D-07), and task 6's seam key must exist before task 7
documents it. The first of those is not carried by ORDER alone, because the
spike's experiment needs the `Task` tool the executor does not hold: task 3
therefore ends in a `human-verify` checkpoint, the orchestrator runs the
experiment and writes the verdict into SPIKE.md, and a fresh executor resumes at
task 4. Task 5 re-asserts the verdict line and halts `blocked` if it is missing,
so a plan walked straight through cannot silently take the inconclusive arm.

FRI-03's self-verify arm is CUT by D-16 and is deliberately absent from this
plan; AC7 as narrowed asks only that this phase's edits leave the test suite and
`self-verify` green with the budgets regenerated, which every task verifies.

`cadence-core/bin/git-branch.test.mjs` is declared in the frontmatter for lease
headroom on task 6's `readTags` extraction; the move is behaviour-preserving and
may need no edit there.

Recalled prior art, weighed while planning: `/cad-audit` resolves its seam
through `${CLAUDE_PLUGIN_ROOT}`, an installed cache that may not hold what the
repo has (`.planning/CAPTURE.md`, carried to `/cad-verify 5`) - which is why task
6 is proved against the repo's own script and test file (D-17) and task 2's live
walk check is written as a human-verify that names the reinstall as step 1.
