---
phase: 2
plan: 1
requirements:
  - RNG-03
files:
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
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/seam-calls.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/plan-revision.md
  - cadence-core/workflows/plan.md
  - skills/cad-plan-checker-contract/SKILL.md
---

# Phase 2: Unforeclose the shared rung prefix - Plan

## Goal

A role's rung files share a cached prefix instead of diverging at body line 2.
Whether that recovers anything on the record is phase 3's question, because the
hook that would write the cache figures cannot reach its write path until
`TRC-07` ships.

## Must be true when done

- Opening `agents/cad-planner.md`, `agents/cad-planner-xhigh.md` and
  `agents/cad-planner-max.md` shows three bodies with no rung sentence in any of
  them, byte-identical to one another, and the same holds for all six roles.
- Re-wrapping the pointer paragraph in ONE rung file and leaving its siblings
  alone turns `self-verify` red, naming the role and the file that broke rank.
  Today the same edit passes.
- `node cadence-core/bin/route.mjs resolve` still returns the same agent, model
  and effort for all 18 (level, role) cells as it does today.
- A plan checker reading its contract is told its RUNG comes from its dispatch
  prompt, and both places Cadence dispatches that role put the resolved rung in
  that prompt.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs --root .` prints `problems: []`.

## Context

Locked by `.planning/phases/2/CONTEXT.md`: the rung sentence is DELETED, never
relocated (D-01); the plan checker's rung moves to its dispatch prompt (D-02);
the new check compares RAW BYTES over one role's rung bodies (D-04); the rule
lives beside `RUNG_FILES` in `cadence-core/bin/lib/rung-agent.mjs` and
`self-verify.mjs` owns the envelope (D-07); no re-pin of the 19 shrinking
`weight-budgets.json` rows (D-08); `rungBodyIssue`'s body-vs-frontmatter-effort
arm goes away with the line and `rungEffortIssue` holds the chain (D-09); no rung
file is renamed, added or removed (D-10).

Out of scope: consolidating or renaming any rung file, `route-table.json`, the
stakes ladder, any `model.effort.*` pin, and the measurement itself - whether the
shared prefix recovers anything is phase 3's question (`TRC-07`).

Measured 2026-08-26 while planning: with the rung sentence removed and the
pointer paragraph reworded, all six roles collapse to ONE distinct body each
(141-154 B), and each of the 19 files sheds 34-39 B.

## Tasks

### Task 1: Delete the rung sentence from the canonical body and every rung file

- **Files:** cadence-core/bin/lib/rung-agent.mjs, cadence-core/bin/rung-agent.test.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs,
  agents/cad-assumptions-analyzer-high.md, agents/cad-assumptions-analyzer.md,
  agents/cad-executor-xhigh.md, agents/cad-executor.md,
  agents/cad-plan-checker-high.md, agents/cad-plan-checker-medium.md,
  agents/cad-plan-checker-xhigh.md, agents/cad-plan-checker.md,
  agents/cad-planner-max.md, agents/cad-planner-xhigh.md, agents/cad-planner.md,
  agents/cad-reviewer-max.md, agents/cad-reviewer-medium.md,
  agents/cad-reviewer-xhigh.md, agents/cad-reviewer.md,
  agents/cad-verifier-max.md, agents/cad-verifier-medium.md,
  agents/cad-verifier-xhigh.md, agents/cad-verifier.md
  (start at `rungBody` and `rungBodyIssue` in the lib, and at check 7's
  `rungBodyIssue` call site inside self-verify's `agents/` walk)
- **Action:** `rungBody` stops emitting the `Your rung is ...` sentence, and the
  sentence left behind it is reworded in the SAME edit: it currently reads "This
  file names that contract and your rung, and adds nothing else", which is false
  the moment the rung line goes, and shipping it unchanged is a stale
  self-description of exactly the class this repo keeps closing. Deletion, never
  relocation (D-01) - relocating the line moves the divergence from body byte 15
  to roughly byte 156 and leaves the whole contract behind it. The `rung`
  argument then has no reader left in `rungBody` or in `rungBodyIssue`: drop it
  from both and update self-verify's check 7 call site, which today scrapes the
  frontmatter `effort:` off `fm[1]` purely to feed it. Apply the same deletion
  and reword to all 19 files under `agents/`, BODY ONLY - every frontmatter key
  stays exactly as it is, because `rungEffortIssue` reads `effort:` and
  `prose-agreement.test.mjs`'s turn-bound row reads `maxTurns:`. Per D-09, delete
  the two rows that assert the arm being removed - `rung-agent.test.mjs`'s
  "rungBodyIssue REJECTS a body whose rung disagrees with the frontmatter effort"
  and `self-verify.test.mjs`'s "check 7: a body whose rung disagrees with the
  frontmatter effort is flagged" - and state in the task record that this is a
  REDUNDANT arm and not a hole, because `rungEffortIssue` (filename stem vs
  frontmatter `effort:`) is what holds that chain and check 7b already runs it on
  every agent file; without that sentence the deletion reads as a weakened gate at
  review. Update `rungBody`'s doc comment, which today calls the canonical body
  "the rung line, then a pointer at the contract it preloads". Rename, add and
  remove nothing under `agents/` (D-10): `route.mjs` returns the stem as its
  `agent` string, so any rename changes what a resolve returns. Do NOT re-pin the
  19 `weight-budgets.json` rows (D-08) - the manifest is a ceiling and all 19
  files shrink.
- **Verify:** `node --test cadence-core/bin/rung-agent.test.mjs cadence-core/bin/self-verify.test.mjs`
  reports `fail 0`; `grep -rn "Your rung is" agents/` returns nothing and
  `grep -rn "and your rung" agents/` returns nothing; a one-liner that strips the
  leading `---`-fenced frontmatter from each of the 19 files, groups the
  remaining raw bytes by the contract skill each body names, and prints the count
  of DISTINCT bodies per group prints 1 for all six roles;
  `node cadence-core/bin/self-verify.mjs --root .` reports no
  `agent-carries-behaviour` and no `budget-overrun` entry.

### Task 2: CI refuses a rung body that differs from its siblings by one byte

- **Files:** cadence-core/bin/lib/rung-agent.mjs, cadence-core/bin/rung-agent.test.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
  (state the rule beside `RUNG_FILES`; wire it in the `agents/` walk that already
  computes `body`, and name it in the single `checked:` list on self-verify's
  `emit` call)
- **Action:** State the prefix rule in `cadence-core/bin/lib/rung-agent.mjs`
  beside `RUNG_FILES`, returning problem CODES the way `effortEnumIssues`
  already does, and let `self-verify.mjs` own the envelope and add the new check
  to its single `checked:` list (D-07 - putting the rule in `self-verify.mjs`
  would stop `rung-agent.mjs` being the one statement of what a rung file is,
  which is the duplication its own header cites #39/#43/#64 for). The comparison
  is RAW BYTES over one role's rung bodies (D-04). That knowingly reverses
  `normalizeBody`'s deliberate whitespace tolerance for this one span - a pointer
  paragraph re-wrapped in one rung file and not its siblings becomes a CI failure
  - and it is correct here because two line-break variants are two different
  cache prefixes. It is also why this rule is NOT a duplicate of `rungBodyIssue`:
  that one normalizes whitespace away and forgives precisely the re-wrap this one
  exists to catch. Leave `normalizeBody` and `rungBodyIssue`'s tolerance untouched
  everywhere else. Scope the rule by `RUNG_FILES`: a stem the map does not name is
  not its business (check 8's reachability arm owns stale and unreachable files),
  and a role contributing fewer than two bodies yields nothing, because an absent
  file is already `missing-rung-agent`'s to report and a second entry would
  double-count one fault. The detail must name the role AND the stems that
  disagree, the way every other detail in this lib names the key or file a
  maintainer would edit. Keep the lib pure - no fs, no emit, no process - so
  self-verify hands it the bodies its walk already read. Choose the export's name
  and its parameter shape. Add no `CADENCE-CENSUS` marker: a marked site with no
  row in `lib/census-registry.mjs` reddens `census-registry.test.mjs`, and this
  rule needs no census. When building the self-verify fixture, note that the
  existing `cad-t`-style agent fixtures cannot exercise a rule scoped to
  `RUNG_FILES` - the fixture has to name two real stems of one real role.
- **Verify:** `node --test cadence-core/bin/rung-agent.test.mjs` reports `fail 0`
  and carries a row proving that two rung bodies of one role differing by a
  SINGLE byte (one line break re-wrapped) are reported while byte-identical
  bodies are not; `node --test cadence-core/bin/self-verify.test.mjs` reports
  `fail 0` and carries a fixture root in which one rung file's body is re-wrapped
  and self-verify reports the new problem kind naming that file and its role;
  `node cadence-core/bin/self-verify.mjs --root .` prints `problems: []` and its
  `checked:` string carries the new check's name.

### Task 3: The plan checker's rung arrives in its dispatch prompt

- **Files:** skills/cad-plan-checker-contract/SKILL.md,
  cadence-core/workflows/plan.md, cadence-core/references/plan-revision.md,
  cadence-core/bin/weight-budgets.json
  (the `<rung>` block; `<step name="check_gate">` and its fenced
  `<verification_context>` prompt; step 2's narrowed checker re-dispatch)
- **Action:** Rewrite the `<rung>` block so it no longer opens "Your agent file
  names your rung" - task 1 makes that false - and says instead that the dispatch
  prompt names it. This block is the ONE place in any of the six role contracts
  that branches on the rung, which corrects the spike's claim that nothing in the
  contracts reads the prose line (D-02), so keep its one real instruction intact:
  the higher the rung the harder the reasoning and the stricter the borderline
  BLOCKER vs WARNING call, and what is checked and how it is reported is
  identical at every rung. Keep the four-rung vocabulary (`low`, `medium`,
  `high`, `xhigh`) - an earlier phase corrected a two-file, two-rung claim in this
  same block, and a rewrite that loses the count restores that defect. Then make
  the new claim TRUE at both sites Cadence dispatches this role from:
  `workflows/plan.md`'s `check_gate` prompt, in the fenced
  `<verification_context>` block beside its `Task ceiling:` line, and
  `references/plan-revision.md`'s step 2 narrowed re-dispatch. The value is the
  `effort` field the resolve immediately above each dispatch already emits -
  `route.mjs`'s resolve envelope carries `effort` beside `agent` and `model` - so
  the prompt carries the RESOLVED rung and never a rung name the prose hardcodes,
  which plan-revision.md's own sentence already forbids and which would be wrong
  at three stakes levels and on a retry. Add no `node` invocation and no
  `trace close` line at either site, and leave the consult sentence that names
  `plan-revision.md` alone: `seam-calls.test.mjs` pins `workflows/plan.md` at
  exactly 14 seam invocations, `trace.test.mjs` pins 2 close moments in `plan.md`
  and 2 in `plan-revision.md`, and `lib/deferred-reads.mjs` pins
  `plan-revision.md` as read at one consult site. Finally the budget: all three
  prose files sit EXACTLY at their `weight-budgets.json` entry today
  (`workflows/plan.md` 29,485 B, `references/plan-revision.md` 3,863 B,
  `skills/cad-plan-checker-contract/SKILL.md` 6,746 B), so any growth is a
  `budget-overrun`. Measure with `node cadence-core/bin/weight.mjs --root .` and
  raise ONLY the rows this edit pushed over their entry, leaving every row that
  shrank untouched. That is D-08's own carve-out - it drops the re-pin duty for a
  surface that SHRINKS and leaves it standing for one that grows - and it is not
  licence to touch the 19 `agents/` rows.
- **Verify:** `grep -n "agent file names your rung" skills/cad-plan-checker-contract/SKILL.md`
  returns nothing, while `grep -n "BLOCKER vs WARNING" skills/cad-plan-checker-contract/SKILL.md`
  still returns the block's instruction; reading `<step name="check_gate">` in
  `cadence-core/workflows/plan.md` and step 2 of
  `cadence-core/references/plan-revision.md` shows each dispatch prompt naming
  the rung as the value that dispatch's own resolve returned, with no rung name
  written into the prose; `node cadence-core/bin/test.mjs` reports every group
  green; `node cadence-core/bin/self-verify.mjs --root .` prints `problems: []`;
  `node --test cadence-core/bin/route.test.mjs` reports `fail 0`, which is where
  all 18 (level, role) cells are pinned literally with their model, effort and
  agent.

## Notes

- **Plan shape.** ONE plan, as CONTEXT directs. The three tasks share
  `cadence-core/bin/lib/rung-agent.mjs` and `cadence-core/bin/self-verify.mjs`,
  so they are sequential and could not have been split anyway.
- **AC2 needs no new test.** `cadence-core/bin/route.test.mjs` already pins all
  18 (level, role) cells literally - hand-written data, one `test()` per cell,
  asserting `model`, `effort`, `agent` and the retry agent. D-10 is why it stays
  green: `route.mjs` imports only `rungFile` and `RUNG_FILES` and never opens an
  agent body, so as long as no stem changes, routing cannot move. Task 3's
  Verify runs it rather than adding a second pin.
- **A tension in D-08, resolved by reading D-08.** The decision says "no
  `weight-budgets.json` re-pin", and its stated reason is that the 19 agent files
  only SHRINK; its own last sentence keeps the re-pin duty for "a surface that
  GROWS". `workflows/plan.md` and `references/plan-revision.md` sit exactly at
  their entries, so AC3's prompt lines cannot land without a raise, and AC4
  ("`self-verify` reports `problems: []`") is unreachable otherwise. Task 3
  therefore raises only the rows its own edit pushes over, and touches no agent
  row. Flagged for the human rather than assumed.
- **Not planned, surfaced for the human.** `INTERNALS.md:11` says "Three things
  keep the price honest" about the rung-file gates. Task 2 makes it four. Nothing
  in that sentence becomes FALSE, no acceptance criterion covers it, and
  `INTERNALS.md` carries its own weight budget, so it is left alone here rather
  than widened into a task.
- **Flagged assumption carried from CONTEXT, unchanged by this plan.** Whether
  the Claude Code host attempts prompt-cache prefix reuse across two different
  agent definitions at all is not observable from this repository. This phase
  ships the LAYOUT; if the host keys its cache per agent definition, the layout
  recovers nothing and phase 3 records a substantiated zero.
