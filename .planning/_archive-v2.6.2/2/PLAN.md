---
phase: 2
plan: 1
requirements: [CTW-03, CTW-05]
files:
  - skills/cad-verify/SKILL.md
  - skills/cad-land/SKILL.md
  - skills/cad-plan-review/SKILL.md
  - skills/cad-health/SKILL.md
  - skills/cad-planner-contract/SKILL.md
  - skills/cad-reviewer-contract/SKILL.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/workflows/plan.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/config-reach.md
  - cadence-core/references/seams.md
  - cadence-core/bin/lib/include-consumers.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/lib/deferred-reads.mjs
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/include-consumers.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
  - docs/EVIDENCE.md
  - design-notes/sweep-2026-08-10-context-weight.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: The free cuts - Plan

## Goal

Eager bytes leave the path with no new files, no register rows and no new budget
rows - measured per surface, re-pinned in `weight-budgets.json` and
`docs/EVIDENCE.md` in the same commit as the cut - and the four `CTW-05` drifts
found alongside them are closed.

## Must be true when done

- `skills/cad-verify/SKILL.md` no longer `@`-includes `cadence-core/templates/UAT.md`;
  the template is still on disk with its 5,792 B budget row unchanged; and at the
  commit that deletes the include, `node cadence-core/bin/weight.mjs resident --root .`
  prints `/cad-verify` eager as 18,688 B (it falls further at task 6 - see Notes).
- The include-consumer waiver register is EMPTY, its mechanism (`CODES.staleWaiver`,
  `CODES.expiredWaiver`, the `waived` parameter, the ROADMAP read) intact, with
  `WAIVED.length === 0` asserted from both the lib test and the self-verify CLI test.
- The `--tokens` provenance paragraph exists in full in exactly one place in the
  tree - `cadence-core/bin/lib/trace.mjs`'s header, a surface nothing weighs - and
  each of the six prose statements is one sentence carrying all three rules: omit
  the flag when no figure exists, never `--tokens 0`, a figureless return is ROUTINE.
- Every cut surface's `weight-budgets.json` row and every `docs/EVIDENCE.md` figure
  that moved with it are re-pinned in the SAME commit, so
  `node cadence-core/bin/self-verify.mjs` returns `ok:true` with `problems:[]` and
  `node --test cadence-core/bin/*.test.mjs` passes at every one of this phase's nine
  commits, not only the last.
- All four `CTW-05` drifts are closed and grep-checkable: no step named `start` in
  `execute.md`; `workflow.test_command` absent from the `:36` batch resolve and read
  inside `execute_parallel`; `config-reach.md`'s `max_concurrent_agents` reach cell
  changed with `min_plans_for_parallel` and `use_worktrees` byte-identical; `seams.md`
  no longer claims a git-guard consult in cad-land's guardrails.
- Every rationale block removed from an eager surface is readable in a git-tracked
  destination - a `cadence-core/bin/**/*.mjs` header or the tracked
  `design-notes/sweep-2026-08-10-context-weight.md` - and
  `skills/cad-plan-checker-contract/SKILL.md`'s `<success_criteria>` block still exists.
- `cad-land`'s three deferral arms each still carry their own `Read` sentence, each
  stating the reference's measured bytes and consult-site count, and self-verify's
  check 13 reports no `deferred-read-unread` for any of the four register rows.

## Context

- `phases/2/CONTEXT.md`'s D-01..D-21 are locked; every task below implements one or
  more of them exactly. `phases/1/CONTEXT.md` D-13's waiver bridge is what task 1
  dismantles - phase 1 shipped it precisely so this commit could delete it.
- **Every cut commit re-pins `weight-budgets.json` AND `docs/EVIDENCE.md` (D-04).** A
  budget re-pin alone lands red: `cadence-core/bin/prose-agreement.test.mjs` asserts
  six EVIDENCE tables against live measurement, and `:234-236` asserts the
  twelve-largest table's ROW ORDER by `deepEqual` against the sorted top twelve.
- Rationale bound to a rule the model applies at runtime STAYS (ROADMAP criterion 4).
  Rationale addressed to a maintainer moves to a `.mjs` header (D-10, D-20) or the
  tracked sweep note; `design-notes/dd-*.md` is gitignored and is never a destination
  (D-21).
- Out of scope: every deferral behind a `Read` (phase 3 / `CTW-04`), any new
  reference file, any new register row, any new budget row, any new self-verify
  check, and any behaviour change to the sequential execution path (D-17).

## Tasks

### Task 1: Delete the dead `templates/UAT.md` include and its phase-1 waiver bridge

- **Files:** skills/cad-verify/SKILL.md, cadence-core/bin/lib/include-consumers.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/include-consumers.test.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, .planning/DOCS-CLAIMS.md
- **Action:** ONE commit, all of it (D-01, D-02, D-03, D-05). Delete line 29 of
  `skills/cad-verify/SKILL.md` - the whole `@${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/UAT.md`
  line including its newline, leaving `<execution_context>` holding only the
  `workflows/verify.md` include. Leave `cadence-core/templates/UAT.md` on disk and
  leave its `weight-budgets.json` entry at 5792 untouched: it is still the seam's
  renderer spec, just not context anyone pays for. In
  `cadence-core/bin/lib/include-consumers.mjs`, empty the `WAIVED` register to
  `Object.freeze([])` and delete the header paragraph that frames the one row as a
  phase-2 bridge (the block beginning "THE WAIVER REGISTER IS A PHASE-2 BRIDGE"),
  replacing it with a short statement that the register ships EMPTY, that both
  bounds still exist for a future row, and that D-16 of phase 1 makes a waiver row
  with a stated reason - never a widened scan - the remedy for a false positive.
  Keep `CODES.staleWaiver`, `CODES.expiredWaiver`, the `waived` parameter with its
  `= WAIVED` default, the `removeInPhase` field in the row type and the ROADMAP read
  exactly as they are: the MECHANISM survives, only the row goes (D-05). Correct the
  two `self-verify.mjs` comments that describe the register as one-row (`:100` and
  `:1206-1207`) to say it ships empty. Rework - never delete - the five live tests
  written against the include existing (D-03): in `include-consumers.test.mjs`, invert
  `verifyRoot()` so it copies the live SKILL.md and INSERTS the include line back into
  `<execution_context>` for the fixtures that need it (`withInclude: true` becomes the
  edit, `false` becomes the plain copy), keeping the "fixture must carry the include
  line" guard; keep the AC5 report test firing on those bytes with an empty waiver
  list; rewrite the "reports nothing under the shipped one-row WAIVED" test to pass an
  EXPLICIT one-row list as the `waived` argument, so the suppression path stays
  exercised after the register empties; rewrite the register-shape test to assert
  `WAIVED.length === 0` and `Object.isFrozen(WAIVED)`; and drive both bound tests
  (DOWNWARD `staleWaiver`, UPWARD `expiredWaiver` plus its unchecked/no-ROADMAP arm)
  from the same explicit one-row list rather than the default. In `self-verify.test.mjs`,
  change the live-tree test at `:1921-1930` to assert `WAIVED.length === 0` while still
  asserting the live tree is clean of all three codes, and rework the CLI stale-waiver
  test at `:1933-1949` into its honest successor: with the register empty the stale arm
  has no live wiring to reach, so build the same fixture from the live
  `skills/cad-verify/SKILL.md` with the UAT include line RE-INSERTED plus
  `cadence-core/workflows/verify.md`, and assert the CLI files exactly one
  `include-never-named` naming `templates/UAT.md` - the regression guard that re-adding
  this include turns CI red. Re-pin in the same commit: `weight-budgets.json`
  `skills/cad-verify/SKILL.md` 1102 -> 1049; `docs/EVIDENCE.md` turn-one row
  `/cad-verify` 24,533 -> 18,688 and the `**23 user-invocable commands**` total
  280,684 -> 274,839; the eager-vs-reachable row for `/cad-verify` (both columns, from
  the measured output) with the ten rows re-sorted descending by eager bytes;
  the zero-resident table gaining a fourth row `cadence-core/templates/UAT.md` | 5,792
  with the stated total 26,306 -> 32,098 and its lead-in sentence corrected on BOTH
  counts - it says "Three reference files are reachable from no command at all" and
  must now say four SURFACES, three references and one template; and the per-directory
  `skills/` row 90,733 -> 90,680 with the `**total**` row 477,012 -> 476,959. Update
  `.planning/DOCS-CLAIMS.md` row SELFVERIFY-01's line span if the `self-verify.mjs`
  comment edit shifts it.
- **Verify:** `node cadence-core/bin/weight.mjs resident --root .` prints
  `"command":"cad-verify"` with `"eagerBytes":18688`, a `zeroResident` array of four
  entries including `cadence-core/templates/UAT.md`, and `"zeroResidentBytes":32098`;
  `git ls-files cadence-core/templates/UAT.md` prints the path and
  `grep '"cadence-core/templates/UAT.md": 5792' cadence-core/bin/weight-budgets.json`
  matches; `grep -c 'templates/UAT.md' skills/cad-verify/SKILL.md` prints 0;
  `node -e "import('./cadence-core/bin/lib/include-consumers.mjs').then(m=>console.log(m.WAIVED.length))"`
  prints 0; `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]`; `node --test cadence-core/bin/*.test.mjs` reports 0 failures and
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: State the `--tokens` provenance once, in `lib/trace.mjs`'s header

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/workflows/context.md, cadence-core/workflows/execute.md, cadence-core/workflows/plan.md, cadence-core/workflows/verify-deep.md, cadence-core/references/review-triggers.md, skills/cad-land/SKILL.md, skills/cad-plan-review/SKILL.md, cadence-core/bin/trace.test.mjs, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, .planning/DOCS-CLAIMS.md
- **Action:** Implements D-10, D-11, D-12, D-13 and D-08. Add a FOURTH named contract
  to `cadence-core/bin/lib/trace.mjs`'s header block, beside DERIVED id, APPEND and
  NEVER throws, and change the header's "Three contracts, each load-bearing" line to
  four. Name it for the token provenance and give it the paragraph in full: the figure
  is read off the HOST's subagent return metadata at the moment the worker returns and
  Cadence adds no hook, seam or capture mechanism to obtain it; the flag is OMITTED
  when the return carries no figure because `--tokens 0` would claim a dispatch that
  cost nothing; a missing figure is ROUTINE, carrying the measured evidence from
  `context.md:129-136` verbatim (every plugin agent's return carried one -
  `cad-assumptions-analyzer` 186,577, `cad-planner` 146,405, `cad-executor` 154,523,
  `cad-plan-checker` 47,717, `cad-verifier` 78,034 - while the built-in `Explore` agent
  type returned none); the three states read apart (`unpaired` = written and never
  closed, `unrecorded` = written, closed, no number, and a bracket never appended at
  all appears NOWHERE); and the ban on substituting an estimate, another worker's count
  or a figure the host did not report. `cadence-core/bin/` is not a weighed surface, so
  this destination costs zero context (D-10). Then reduce each of the SIX prose
  statements to ONE sentence carrying all three rules - omit when no figure, never
  `--tokens 0`, a figureless return is ROUTINE so `unrecorded` names a silent return
  and never a skipped bracket (D-11; the ROUTINE clause is centralised away from NO
  site, because a missing clause is what made `unrecorded` read as a skipped bracket
  in the regression `.planning/CAPTURE.md` records, closed by `045c479`). The six sites:
  `context.md:122-144` (the whole block, including its "once, for every bracket in this
  plugin" claim, the measured per-agent figures and the read-the-three-states-apart
  paragraph), `execute.md:233-239` (leave `:226-232`'s `--plan`/`--role`/`--read`
  paragraph and the worktree-emits-nothing clause standing - both are runtime rules),
  `plan.md:182-189`, `plan.md:247-248` (D-12: this second one is already short but
  states only two of the three rules, so it is rewritten to the same one-sentence form -
  a criterion phrased "five sites" would leave it a duplicate), `verify-deep.md:37-42`
  and `references/review-triggers.md:106-107`. Do not touch any `trace append` COMMAND
  line: `trace.test.mjs`'s census matches `\btrace\s+append\b` command lines and its
  `BRACKETING` counts must stay 1/4/1/1/1. Re-point the stale citation in
  `trace.test.mjs:384-388` - it cites `context.md` printing `cad-planner 146,405` three
  lines from the `--tokens` order, and those figures move here - to cite
  `lib/trace.mjs`'s header as the surface that prints the grouped form; the test body
  and its `'146,405'` input are unchanged. Because `references/review-triggers.md`
  changes size, this commit also carries D-08's coupled edits: re-state its measured
  byte figure in `skills/cad-land/SKILL.md:44` and `skills/cad-plan-review/SKILL.md:39`
  from the fresh `weighAll` measurement, or
  `prose-agreement.test.mjs:182-204` fails. Re-pin in the same commit: budget rows for
  `cadence-core/workflows/{context,execute,plan,verify-deep}.md` and
  `cadence-core/references/review-triggers.md`, plus
  `skills/{cad-land,cad-plan-review}/SKILL.md` if restating the figure changed their
  byte count; `docs/EVIDENCE.md`'s turn-one rows for `/cad-execute`, `/cad-plan`,
  `/cad-context` (and `/cad-land`, `/cad-plan-review` if their SKILLs moved) with the
  23-command total; the eager-vs-reachable table, where reachable falls for every one
  of the ten rows whose reachable set contains `review-triggers.md` (`/cad-execute`,
  `/cad-verify`, `/cad-plan`, `/cad-context`, `/cad-land`, `/cad-milestone`,
  `/cad-decision-review`), re-sorted descending; the per-directory `cadence-core/workflows/`,
  `cadence-core/references/` (and `skills/`) rows with the grand total; and the
  twelve-largest table's bytes AND est-token cells for `execute.md`, `plan.md`,
  `context.md` and `review-triggers.md` - **re-derive that table's ROW ORDER from the
  measurement rather than editing cells in place**: `context.md` sits 694 B above
  `config.md` and `review-triggers.md` sits 75 B above `verify.md`, so this cut can
  reorder rows 4/5 and 8/9, and `prose-agreement.test.mjs:234-236` `deepEqual`s the
  order. Move `.planning/DOCS-CLAIMS.md` rows EXECUTE-20, PLAN-18 and VERIFY-DEEP-05 to
  the line spans their claims now occupy (D-09), and re-point any other row for these
  five files whose recorded span no longer contains the text it names.
- **Verify:** the one-sentence-per-site rule is proved by a RUNNABLE check, not by
  eye - `node -e 'const f=require("fs");const want={"cadence-core/workflows/context.md":1,"cadence-core/workflows/execute.md":1,"cadence-core/workflows/verify-deep.md":1,"cadence-core/references/review-triggers.md":1,"cadence-core/workflows/plan.md":2};let bad=0;for(const[p,n]of Object.entries(want)){const hits=f.readFileSync(p,"utf8").replace(/\s+/g," ").split(/(?<=\.)\s/).filter(s=>/ROUTINE/.test(s));if(hits.length!==n){console.log("COUNT",p,hits.length);bad++;}for(const h of hits)if(!/--tokens 0/.test(h)||!/\bomit/i.test(h)){console.log("RULES",p,h.slice(0,120));bad++;}}console.log(bad?"FAIL":"OK")'`
  prints `OK` - six sentences across five files, each carrying all three rules;
  ALL FIVE measured figures leave the weighed surfaces and land in the header -
  `grep -rn '186,577\|146,405\|154,523\|47,717\|78,034' cadence-core/workflows/ cadence-core/references/ skills/ agents/`
  returns nothing, while
  `for n in 186,577 146,405 154,523 47,717 78,034; do grep -c "$n" cadence-core/bin/lib/trace.mjs; done`
  prints `1` five times; and AC4's exactly-once claim is checked against the whole
  tree rather than the five known sites -
  `grep -rl 'read off the HOST' cadence-core/ skills/ agents/ docs/` prints exactly
  one path, `cadence-core/bin/lib/trace.mjs`;
  `node --test cadence-core/bin/trace.test.mjs` passes (the census and the BRACKETING
  counts unchanged); `node --test cadence-core/bin/prose-agreement.test.mjs` passes
  (the twelve-largest order, the per-directory sums and both cad-land/cad-plan-review
  byte statements); `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]`; `node --test cadence-core/bin/*.test.mjs` reports 0 failures.

### Task 3: Trim `cad-land`'s guardrails and its three deferral tails, and close the `seams.md` drift

- **Files:** skills/cad-land/SKILL.md, cadence-core/references/seams.md, cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, design-notes/sweep-2026-08-10-context-weight.md, .planning/DOCS-CLAIMS.md
- **Action:** Implements D-07 and D-16. In `skills/cad-land/SKILL.md`'s `<guardrails>`,
  keep the first bullet's rules verbatim - "No preselected publish default, ever. No
  auto-push. No auto-commit." plus the one exception naming `git.auto_close` (default
  off) as the explicit opt-in that SKIPS the 4a ask rather than preselecting a default
  in it, and that still halts on a blocking `pre_ship` finding - and cut the re-derivation
  of the seam mechanic that step 4b states fifty lines above (the sanctioned single
  publish, the subprocess push git-guard does not intercept, the code-guarded
  non-protected-branch condition, `PR -> merge -> reset`). Leave guardrail bullets 2 and
  3 untouched. Then TRIM the three deferral tails around a surviving `Read` sentence per
  arm - never delete an arm as a block, because
  `cadence-core/bin/lib/deferred-reads.mjs:110-137` anchors three register rows at
  regions `3`, `4(a)` and `4(b)` in this file and sentence-level matching is what makes
  a deleted instruction fail (D-07). Step 3 keeps its Read sentence with the
  `references/review-triggers.md` measured figure and its one-consult-site clause
  (re-state whatever figure task 2 left in place) and loses the cost-model tail -
  "larger than this whole skill", "puts those bytes on every remaining turn of the land
  for a single use", "the read folds into the turn that fires the trigger as one extra
  tool call rather than an extra turn". Step 4a keeps its "Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-publish.md` first" sentence with
  the rails-govern clause, and loses the turn-economics tail ("The 4a ask ended the
  turn, so this is the first call of the turn that starts with the user's answer...
  what makes deferring it pay rather than eager"). Step 4b keeps its Read sentence
  INCLUDING the locked "this read is NOT scoped to the GitHub arm" clause naming both
  the GitHub seam call and `glab mr create`, and loses the tail from "This arm skips the
  4a ask, so the read does not fold into..." to the end of that bullet. Both git-publish
  arms currently carry no measured-bytes clause; add one to each surviving sentence -
  `references/git-publish.md`'s measured bytes and "one consult site (step 4a or 4b,
  never both)" - so every surviving Read sentence satisfies D-07 and
  `references/seams.md:240-243` uniformly. The removed per-arm cost reasoning lands in
  `cadence-core/bin/lib/deferred-reads.mjs`'s header, beside the three rows that anchor
  these arms, as the recorded break-even arithmetic for each; the guardrails' seam
  re-derivation needs no new destination and gets none - `cadence-core/bin/git-publish.mjs:3-12`
  already states it - so record that pointer in the header note rather than copying the
  text. In `cadence-core/references/seams.md:236-240`, close the CTW-05 drift by DELETING
  the clause "and in its guardrails block" from the sentence about `references/git-guard.md`
  staying eager at steps 1, 2 and 3 (D-16). Do NOT add a git-guard citation to cad-land's
  guardrails: that would grow the surface this cycle shrinks and insert a fourth consult
  site into a file three register rows' deferral arithmetic depends on. Append to
  `design-notes/sweep-2026-08-10-context-weight.md` a dated section recording where this
  phase's moved rationale landed, starting with this task's entries. Re-pin in the same
  commit: budget rows `skills/cad-land/SKILL.md` and `cadence-core/references/seams.md`;
  `docs/EVIDENCE.md`'s turn-one `/cad-land` row and the 23-command total; the
  eager-vs-reachable `/cad-land` row (both columns), with the ten rows re-sorted
  descending; the per-directory `skills/` and `cadence-core/references/` rows and the
  grand total; and the twelve-largest table's `seams.md` bytes and est-token cells,
  re-deriving the row ORDER from the measurement (`seams.md` sits 48 B below
  `config-reach.md`). Update any `.planning/DOCS-CLAIMS.md` row whose span points into
  the trimmed cad-land or seams.md text.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]` - which includes check 13 finding a `Read` sentence in each of
  regions `3`, `4(a)` and `4(b)` of `skills/cad-land/SKILL.md`;
  `grep -n 'git-publish.md' skills/cad-land/SKILL.md` shows one Read sentence under
  step 4a and one under step 4b, each stating a byte figure and a consult count;
  step 3's surviving Read sentence keeps BOTH halves of D-07, not just the byte
  figure `prose-agreement.test.mjs:182-204` already guards -
  `node -e 'const t=require("fs").readFileSync("skills/cad-land/SKILL.md","utf8").replace(/\s+/g," ");const s=t.split(/(?<=\.)\s/).filter(x=>/review-triggers\.md/.test(x)&&/Read/.test(x));console.log(s.length===1&&/\d,\d{3} B/.test(s[0])&&/consult site/.test(s[0])?"OK":"FAIL")'`
  prints `OK`;
  `grep -c 'guardrails block' cadence-core/references/seams.md` prints 0;
  `grep -n 'No preselected publish default, ever' skills/cad-land/SKILL.md` still
  matches; `node --test cadence-core/bin/deferred-reads.test.mjs` and
  `node --test cadence-core/bin/prose-agreement.test.mjs` pass;
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures.

### Task 4: Cut `execute.md`'s duplication and close its three drifts

- **Files:** cadence-core/workflows/execute.md, cadence-core/references/config-reach.md, cadence-core/bin/planning.mjs, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, design-notes/sweep-2026-08-10-context-weight.md, .planning/DOCS-CLAIMS.md
- **Action:** Implements D-14, D-15 and D-17 alongside the `execute.md` duplication cut.
  Trim the `<purpose>` block (`:1-11`): `skills/cad-execute/SKILL.md`'s `<objective>`
  rides the same context and already states the per-plan executor, the atomic
  conventional commit per task, the recorded deviations, the slim SUMMARY and the
  sequential-by-default/parallel-opt-in split, so keep only what the objective does not
  say - that all worktree ceremony exists inside the opt-in branch and nowhere else -
  and cut the rest, including `:8-10`'s contrast with an orchestration apparatus this
  tree does not have. Cut the lease-check PLACEMENT justification at `:96-104`
  (the paragraph from "This check lives HERE rather than in the executor's lease gate"
  through "provably the executor's own doing") and move it into
  `cadence-core/bin/planning.mjs`'s lease-check header block at `:1605-1624`, which
  already carries this module's design rationale; keep the runtime rule at `:90-94`
  ("start it from a clean worktree, not merely a clean index") eager. Cut the
  gitignore/scaffold archaeology at `:245-253` - the clauses explaining that
  `.planning/trace.jsonl` is gitignored, that `/cad-new-project` writes the line through
  `planning.mjs trace ignore` at scaffold time and that `/cad-health` reports a pre-seam
  scaffold rather than editing a `.gitignore` - keeping "A worktree executor emits NO
  trace events of its own" and the closing rule that the orchestrator's brackets are what
  make every worker attributable; move the removed clauses into `planning.mjs`'s
  trace-ignore header block near `:1980-2020`. D-14: correct the sentence at `:241`,
  wherever task 2's edit left it, from "The `phase_start` line in `start`" to
  "in `git_guard`" - `<step name="git_guard">` opens at `:49` and the `phase_start`
  append sits at `:110`, and no `<step name="start">` exists in the file. D-17: remove
  `workflow.test_command` from the batched `config.mjs get` at `:36` and read it where
  it is consumed, inside `execute_parallel` step 5, by naming the single-key
  `config.mjs get workflow.test_command` call at that step; do NOT make the sequential
  path run it - that is a behaviour change to the default route needing its own
  criterion and UAT item, and shipping it inside a drift closure ships an unreviewed
  behavioural change. D-15: change exactly ONE reach cell in
  `cadence-core/references/config-reach.md` - line 136, `parallelization.max_concurrent_agents`,
  so it names `workflows/execute.md`'s `execute_parallel` step rather than the file as a
  whole. Leave lines 135, 137 and 138 (`enabled`, `min_plans_for_parallel`,
  `use_worktrees`) byte-identical: the latter two are read in `choose_path`, which phase 3
  keeps eager, and rewriting all three would put two of them wrong in both directions.
  Leave the `workflow.test_command` row at `:133` alone as well - `execute_parallel`
  already consumed that key before this task, so the row's accuracy is unchanged by the
  resolve move, and AC5 scopes this file's edit to one cell. Append this task's moved
  rationale to `design-notes/sweep-2026-08-10-context-weight.md`'s destinations section.
  Re-pin in the same commit: budget rows `cadence-core/workflows/execute.md` and
  `cadence-core/references/config-reach.md`; `docs/EVIDENCE.md`'s turn-one `/cad-execute`
  row and the 23-command total; the eager-vs-reachable `/cad-execute` row, re-sorted;
  the per-directory `cadence-core/workflows/` and `cadence-core/references/` rows and the
  grand total; and the twelve-largest bytes/est-token cells for `execute.md` and
  `config-reach.md` with the row order re-derived (`config-reach.md` sits 48 B above
  `seams.md`). Move `.planning/DOCS-CLAIMS.md` rows EXECUTE-21 and EXECUTE-22 with their
  cuts (D-09) - EXECUTE-22's claim about the gitignored run record now describes
  `planning.mjs`, so re-point the row's file and span or retire it against its new home -
  and re-point any other `execute.md` or `config-reach.md` row whose span no longer
  contains the text it names.
- **Verify:** `grep -n 'name="start"\|in `start`' cadence-core/workflows/execute.md`
  returns nothing; `grep -n 'workflow.test_command' cadence-core/workflows/execute.md`
  shows no hit inside the `:28-45` batched resolve and at least one inside
  `<step name="execute_parallel">`; `git diff -- cadence-core/references/config-reach.md`
  shows exactly one changed table row and
  `git diff -- cadence-core/references/config-reach.md | grep -c 'min_plans_for_parallel\|use_worktrees'`
  prints 0; `grep -c 'execute_parallel' cadence-core/references/config-reach.md` prints 1;
  `grep -c 'clean worktree' cadence-core/workflows/execute.md` still prints at least 1;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`
  (this includes check 1's `inert-config-key` reverse arm, which the
  `workflow.test_command` move must not orphan); `node --test cadence-core/bin/*.test.mjs`
  reports 0 failures and `npx tsc -p tsconfig.ci.json` exits 0.

### Task 5: Cut `context.md`'s duplicated purpose and output-contract prose

- **Files:** cadence-core/workflows/context.md, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, design-notes/sweep-2026-08-10-context-weight.md, .planning/DOCS-CLAIMS.md
- **Action:** `skills/cad-context/SKILL.md`'s `<objective>` rides the same context and
  already states the analyzer spawn, the targeted questions, the locked falsifiable
  criteria, the single too-big question, the written artifact and its optionality. Trim
  `<purpose>` accordingly: cut `:9-11`'s cost metaphor ("A clear codebase costs one
  confirmation tap; a murky one costs a few focused questions") while KEEPING "The exit
  condition is judged, not scored: decisions closed, acceptance criteria falsifiable" -
  that is the rule the model applies to decide when the pass is over - and cut
  `:13-15`'s design history entirely ("WHAT and HOW live in one document, not separate
  pre-plan gates; the slicing instinct survives as exactly one 'too big?' question near
  the end"), whose only runtime content is already guardrail 3 at `:412-413`. At
  `:365-370`, keep the output contract "Five sections, nothing else: scope boundary,
  durable decisions, decisions (phase-local), acceptance criteria, flagged assumptions"
  and cut both the history that follows it ("the durability filter splits what used to
  be one Decisions section into two, nothing more") and the no-artifacts restatement
  ("No discussion log, no interview transcript, no ambiguity report - git and the file
  itself are the record"), which guardrail 2 at `:409-411` states in the same context.
  Record both removed blocks in the destinations section of
  `design-notes/sweep-2026-08-10-context-weight.md`. Re-pin in the same commit: the
  `cadence-core/workflows/context.md` budget row; `docs/EVIDENCE.md`'s turn-one
  `/cad-context` row and the 23-command total; the eager-vs-reachable `/cad-context` row,
  re-sorted; the per-directory `cadence-core/workflows/` row and the grand total; and the
  twelve-largest `context.md` bytes/est-token cells with the row order re-derived
  (`context.md` and `config.md` are close enough after task 2's cut that this one can
  reorder them). Re-point any `.planning/DOCS-CLAIMS.md` `context.md` row whose span no
  longer contains the text it names.
- **Verify:** `grep -c 'confirmation tap\|not separate pre-plan gates\|no ambiguity report' cadence-core/workflows/context.md`
  prints 0 while `grep -c 'judged, not scored' cadence-core/workflows/context.md` prints 1
  and `grep -c 'Five sections, nothing else' cadence-core/workflows/context.md` prints 1;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`;
  `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures.

### Task 6: Cut `verify.md`'s duplicated purpose and the `fields_version` legacy archaeology

- **Files:** cadence-core/workflows/verify.md, cadence-core/bin/planning.mjs, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, design-notes/sweep-2026-08-10-context-weight.md, .planning/DOCS-CLAIMS.md
- **Action:** MUST land after task 1, never before it - AC1's 18,688 B figure is
  `verify.md` 17,639 + SKILL.md 1,049, and cutting this file first makes that figure
  unreachable at every point in the phase's life. `skills/cad-verify/SKILL.md`'s
  `<objective>` rides the same context and already states the one-item-at-a-time walk,
  the persistent `.planning/phases/<N>/UAT.md`, survival across `/clear` and resume at
  the first untested item, the no-auto-fixer routing, `--sweep` and `--deep`. Trim
  `<purpose>` (`:1-20`) to what the objective does not carry: keep the seam-ownership
  paragraph at `:12-16` (all checklist persistence through the `uat` subcommands, the
  seam owning first_pass set-once, the verifier never overwriting a user result, counts
  recomputed every write), the two cold-branch lines at `:18-19` and the
  severity-inference rule at `:7-8` ("Plain-text answers. Severity is inferred, never
  asked."), which the objective does not state; cut the rest of `:2-11`, which restates
  the objective clause for clause. At `:84-89`, cut the `fields_version` legacy
  archaeology (the passage from "They are NOT legacy: `uat init` writes `fields_version`
  before it looks at an item" through "which no seam-written file can be"), keeping the
  runtime-facing sentences that a CONTEXT whose criteria carry no `AC<N>` ids yields no
  `criterion` values and that those items report as `untraced`, which is additive.
  `cadence-core/bin/planning.mjs:1266-1320` already carries that reasoning in full; read
  it and add only what is missing there rather than duplicating it, then record the move
  in the destinations section of `design-notes/sweep-2026-08-10-context-weight.md`.
  Leave `:352`'s "UAT.md is written ONLY through the uat seam" untouched - it is the
  claim CTW-03 rests the dead include on. Re-pin in the same commit: the
  `cadence-core/workflows/verify.md` budget row; `docs/EVIDENCE.md`'s turn-one
  `/cad-verify` row (18,688 falls further here) and the 23-command total; the
  eager-vs-reachable `/cad-verify` row (both columns - reachable moves too), re-sorted;
  the per-directory `cadence-core/workflows/` row and the grand total; and the
  twelve-largest `verify.md` bytes/est-token cells with the row order re-derived
  (`verify.md` and `review-triggers.md` sit 75 B apart and task 2 may already have
  swapped them). Re-point any `.planning/DOCS-CLAIMS.md` `verify.md` row whose span no
  longer contains the text it names.
- **Verify:** `grep -c 'They are NOT legacy' cadence-core/workflows/verify.md` prints 0
  while `grep -c 'untraced' cadence-core/workflows/verify.md` still prints at least 1 and
  `grep -c 'written ONLY through the uat seam' cadence-core/workflows/verify.md` prints 1;
  `node cadence-core/bin/weight.mjs resident --root .` prints a `/cad-verify` eager figure
  below 18,688 that equals the new `verify.md` budget row plus 1,049;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`;
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures.

### Task 7: Cut `plan.md`'s duplicated purpose and its design-history contrast

- **Files:** cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, design-notes/sweep-2026-08-10-context-weight.md, .planning/DOCS-CLAIMS.md
- **Action:** `skills/cad-plan/SKILL.md`'s `<objective>` rides the same context and
  already states the artifact, the numbered atomic tasks with files/action/falsifiable
  verification, the cad-planner spawn, the `workflow.plan_check` gate, the `plan` review
  trigger and both flags. Trim `<purpose>` (`:1-10`) to what it does not carry - the
  pipeline's commit-docs terminal step - and cut `:8-9`'s contrast with a four-agent
  fan-out, "4 flags, not ~20" and "one bounded revision, not a convergence loop", which
  describe a design this tree does not ship; KEEP `:10`'s routing rules ("Research is
  /cad-context's job; second opinions belong to the review subsystem"), which tell the
  model where those two things go at runtime. **Do not cut `:330-335`** ("Both
  re-dispatches close on their own, at their own step..."): the sweep listed it as
  verbatim in `trace.test.mjs`, and that is false on inspection - `grep -n 'Both
  re-dispatches\|SOME terminal' cadence-core/bin/trace.test.mjs` returns nothing, the
  `BRACKETING` map pins counts and not prose, and the paragraph carries a rule the model
  applies at runtime (close BOTH re-dispatch brackets at their own step). Record the
  removed design-history block, and this falsified sweep row, in the destinations section
  of `design-notes/sweep-2026-08-10-context-weight.md`. Re-pin in the same commit: the
  `cadence-core/workflows/plan.md` budget row; `docs/EVIDENCE.md`'s turn-one `/cad-plan`
  row and the 23-command total; the eager-vs-reachable `/cad-plan` row, re-sorted; the
  per-directory `cadence-core/workflows/` row and the grand total; and the twelve-largest
  `plan.md` bytes/est-token cells with the row order re-derived. Re-point any
  `.planning/DOCS-CLAIMS.md` `plan.md` row whose span no longer contains the text it names.
- **Verify:** `grep -c 'four-agent fan-out\|4 flags' cadence-core/workflows/plan.md`
  prints 0 while `grep -c "Research is /cad-context's job" cadence-core/workflows/plan.md`
  prints 1 and `grep -c 'Both re-dispatches close on their own' cadence-core/workflows/plan.md`
  prints 1; `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`;
  `node --test cadence-core/bin/trace.test.mjs` passes with `BRACKETING` unchanged;
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures.

### Task 8: Drop the planner and reviewer contracts' `<success_criteria>` blocks

- **Files:** skills/cad-planner-contract/SKILL.md, skills/cad-reviewer-contract/SKILL.md, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, .planning/DOCS-CLAIMS.md
- **Action:** Delete the `<success_criteria>` block from
  `skills/cad-planner-contract/SKILL.md` (the seven-item checklist after
  `<guardrails>`) and from `skills/cad-reviewer-contract/SKILL.md` (the three-item
  checklist at the end). Every item in both is already stated as an instruction earlier
  in its own contract - the planner's file-reading, goal-backward derivation, task
  anatomy, decision-fidelity, plan-split and return-marker rules, and the reviewer's
  falsification, JSON-only output and per-finding field rules - so the checklists restate
  their own contracts item for item. `cadence-core/references/conventions.md:138-141`
  scopes that section to new WORKFLOWS, and `cad-executor-contract`, `cad-verifier-contract`
  and `cad-assumptions-analyzer-contract` already ship without one (D-19). **Do not touch
  `skills/cad-plan-checker-contract/SKILL.md`'s block** (D-18): `prose-agreement.test.mjs:69-95`
  asserts it exists and states "All six dimensions checked" cross-checked against
  `<dimensions>`, and that assertion IS the DFC-03 defect fix - relaxing it would remove
  the only mechanical guard against a checker reporting success having skipped
  Proportionality. Nothing else moves: these are restatements, not rationale, so there is
  no destination to write them to. Re-pin in the same commit: budget rows
  `skills/cad-planner-contract/SKILL.md` and `skills/cad-reviewer-contract/SKILL.md`;
  `docs/EVIDENCE.md`'s dispatch table rows for all three `cad-planner` rungs and all four
  `cad-reviewer` rungs (`Dispatch bytes` = agent bytes + contract bytes, so every one of
  the seven moves while `Agent bytes` stays); and the per-directory `skills/` row with the
  grand total. Neither contract is user-invocable, so no turn-one or eager/reachable row
  changes and neither surface is in the twelve-largest table. Re-point any
  `.planning/DOCS-CLAIMS.md` row whose span points into either deleted block.
- **Verify:** the "already stated earlier" claim is CHECKED before the blocks go, not
  asserted - for each item in both checklists, `grep -n` the instruction that governs it
  elsewhere in the same contract file and record the hit line in the commit body; a
  checklist item with no earlier governing instruction is NOT deleted, and the task
  reports it instead of cutting it (D-19 has no mechanical failure signal, so this
  pre-check is the only guard the phase gets).
  `grep -c 'success_criteria' skills/cad-planner-contract/SKILL.md skills/cad-reviewer-contract/SKILL.md`
  prints 0 for both while
  `grep -c 'success_criteria' skills/cad-plan-checker-contract/SKILL.md` prints 2;
  `node --test cadence-core/bin/prose-agreement.test.mjs` passes, including the
  DFC-03 dimension-count test and the dispatch-bytes table test;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`;
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures.

### Task 9: Move `cad-health`'s maintainer cross-reference into `lib/branch-decision.mjs`

- **Files:** skills/cad-health/SKILL.md, cadence-core/bin/lib/branch-decision.mjs, cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md, design-notes/sweep-2026-08-10-context-weight.md, .planning/DOCS-CLAIMS.md
- **Action:** Implements D-20 - the block SPLITS, it does not move whole. From step 7 of
  `skills/cad-health/SKILL.md`, cut the maintainer-facing cross-reference at `:107-109`
  ("Membership is deliberate and must not drift back to 'sorts above the newest tag'.
  `lib/branch-decision.mjs` refuses an integration branch on exactly this test, and the
  two surfaces have to answer the same question about the same repo.") and the `v2.4.0`
  anecdote at `:103-105` ("This is the failure that let a `v2.4.0` ship while this same
  section still described `v2.4.0` as the open, unstarted milestone - nothing read the two
  numbers together."). **The `v1.9.1` worked example STAYS eager** - "Sort order refuses
  strictly more: an untagged maintenance milestone like `v1.9.1` in a repo tagged `v1.9.0`
  and `v2.0.0` is a legitimate open version the guard allows, and a health check calling it
  drift would push the user to renumber or abandon a valid patch release" - because it
  decides a verdict the model issues at runtime, and removing it makes `/cad-health` report
  a legitimate untagged maintenance milestone as drift, which is the regression the
  paragraph was written after. Keep the surrounding runtime rules too: tags are the
  publication evidence and a manifest in the checkout is not, and the manifest-equals-Active
  case reports as a distinct lower note, never as drift. Move both cut sentences into
  `cadence-core/bin/lib/branch-decision.mjs`'s header, which already carries the
  membership-not-sort-order reasoning at `:36-40` and this module's single-reader
  discipline - state there that `skills/cad-health/SKILL.md` step 7 asks the same question
  at a second moment and must answer it by membership, and carry the `v2.4.0` anecdote as
  the concrete failure. Record the move in the destinations section of
  `design-notes/sweep-2026-08-10-context-weight.md`. Re-pin in the same commit: the
  `skills/cad-health/SKILL.md` budget row; `docs/EVIDENCE.md`'s turn-one `/cad-health` row
  and the 23-command total; and the per-directory `skills/` row with the grand total.
  `/cad-health` is not in the ten-heaviest table and `cad-health` is not in the
  twelve-largest table, so neither moves. Re-point `.planning/DOCS-CLAIMS.md` rows whose
  spans point into the cut text, including AUDIT-29, which cites this section of
  `cad-health` from `workflows/audit.md`, if the claim it names has moved.
- **Verify:** `grep -c 'sorts above the newest tag' skills/cad-health/SKILL.md` prints 0
  and BOTH cut passages are proved present in the destination in full, not by a
  fragment that happens to match -
  `node -e 'const t=require("fs").readFileSync("cadence-core/bin/lib/branch-decision.mjs","utf8").replace(/\s+/g," ");console.log(/must not drift back to/.test(t)&&/cad-health/.test(t)&&/same question/.test(t)&&/v2\.4\.0/.test(t)?"OK":"FAIL")'`
  prints `OK`, and `grep -c 'v2.4.0' skills/cad-health/SKILL.md` prints 0 - the
  anecdote moved rather than being deleted (AC6);
  `grep -c 'v1.9.1' skills/cad-health/SKILL.md` prints 1;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`;
  `node --test cadence-core/bin/branch-decision.test.mjs` passes;
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures and
  `npx tsc -p tsconfig.ci.json` exits 0.

## Notes

- **Plan shape deviates from the CONTEXT directive, deliberately.**
  `phases/2/CONTEXT.md` says "multiple plans, same phase", and that is impossible here:
  `cadence-core/bin/prose-agreement.test.mjs:239-266` asserts per-directory subtotals and
  a grand total over all 93 measured surfaces, and `:206-237` asserts the twelve-largest
  table's membership and order, so EVERY task edits both
  `cadence-core/bin/weight-budgets.json` and `docs/EVIDENCE.md`. `plan-overlap` refuses
  two plans declaring the same path, so slices sharing those two files cannot be separate
  plans. File independence is the hard constraint and it fails; one PLAN.md it is. Task
  ceiling raised to 9 by the user at the context gate for exactly this reason
  (`.planning/config.json` `workflow.max_plan_tasks: 9`).
- **AC1's 18,688 B is observed at task 1's commit, not at phase end.** Task 6 cuts
  `verify.md`, which is 17,639 of that 18,688, so `/cad-verify` eager is lower afterwards.
  Cutting `verify.md` earlier would make the figure unreachable at every point in the
  phase's life, so the ordering above is not negotiable and AC1's UAT item reads task 1's
  commit (`git show <task-1-sha>` or the measurement recorded in that task's verify).
- **Task 2 is twelve files by necessity, not by sprawl.** The `--tokens` paragraph exists
  as six statements across five prose files, and D-08's coupling makes any
  `review-triggers.md` byte change drag `skills/cad-land/SKILL.md:44` and
  `skills/cad-plan-review/SKILL.md:39` with it under
  `prose-agreement.test.mjs:182-204`. Splitting it would leave the tree red between
  commits, which AC2 and AC3 forbid.
- **The twelve-largest table's ORDER is asserted, not just its cells.** Four surfaces sit
  within 100 B of a neighbour (`config-reach.md`/`seams.md` 48 B,
  `review-triggers.md`/`verify.md` 75 B) and two more within 700 B
  (`config.md`/`context.md`). Re-derive the whole table from
  `node cadence-core/bin/weight.mjs --root .` on every cut rather than editing cells in
  place.
- The eager-vs-reachable table's heading claims the TEN HEAVIEST commands. No test
  asserts its order or membership, but three of its rows change rank this phase, so each
  task re-sorts it; membership does not change (the tenth, `/cad-decision-review` at
  12,213, stays above every cut command's floor).
- **`CHANGELOG.md` is untouched by every task above, on purpose (D-06).** Its
  `:474-476` justification for the dead include is false, and it stays as history to be
  answered by the `v2.6.2` entry written at the milestone close - not edited here.
  `self-verify.mjs:5-9` deliberately excludes DESIGN/LINEAGE/CHANGELOG for exactly this
  reason: they may name cut keys while explaining the cut.
- Observation for the docs ledger, not a change this phase makes:
  `cadence-core/references/config-reach.md:133` omits `workflows/execute.md` from
  `workflow.test_command`'s honouring sites even though `execute_parallel` has always
  consumed it. Task 4 leaves it alone because AC5 scopes this file's edit to the
  `max_concurrent_agents` cell; the row's accuracy is not changed by moving where the key
  is resolved.
- Prior art weighed while planning: `phases/1/UAT.md` records that phase 1 proved the
  inverse property - `git diff --stat` over `skills/`,
  `cadence-core/{references,templates,workflows}`, `agents/` and `weight-budgets.json`
  was empty - so this phase's nine commits are this cycle's first prose movement and the
  first exercise of the re-pin discipline D-04 states.
- D-19's cut has no mechanical failure mode. The only signal that a planner or reviewer
  dispatch degraded is AC7's per-command walk; a regression the walk does not surface
  ships silently. D-09's ledger updates are likewise unenforced - a missed row surfaces
  only at the next `/cad-docs-verify` sweep.
