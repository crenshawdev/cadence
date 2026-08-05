---
phase: 1
plan: 1
requirements:
  - RES-01
  - RES-02
  - RES-03
  - RES-04
files:
  - cadence-core/references/seams.md
  - cadence-core/references/review-triggers.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/task.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/workflows/debug.md
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-verifier-contract/SKILL.md
  - skills/cad-reviewer-contract/SKILL.md
  - skills/cad-land/SKILL.md
  - agents/cad-verifier.md
  - agents/cad-verifier-medium.md
  - agents/cad-verifier-xhigh.md
  - agents/cad-verifier-max.md
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - CHANGELOG.md
  - .planning/CAPTURE.md
---

# Phase 1: The orchestrator stops holding what its children returned - Plan

## Goal

No subagent's full output is resident in a parent context after the turn it
arrived on. Executor reports, verifier findings and review artifacts each move
to a file or a reference, and `references/seams.md` states the break-even rule
that says when that round-trip pays. Transport only: the content is identical,
only where the bytes live and when they load changes.

## Must be true when done

- A `cad-executor` TERMINAL message (`PLAN COMPLETE`, `PLAN PARTIAL`) carries
  exactly five fields - status, task count, commit range, deviation count,
  open-item count. A CHECKPOINT return is not a digest: it carries D-04's three
  routing fields (checkpoint type, current task number and name, `Need:`) beside
  the status, because the orchestrator must route it without opening anything.
  What holds on EVERY branch, checkpoints included, is the prohibition: no task
  table, no deviation text, no open-item text in any return. The table lives in
  `<plandir>/reports/plan-<k>.md`.
- That report file exists for every plan executed and is named by
  `git show <commit> --stat`: staged into the phase docs commit on the
  sequential path, committed inside its own worktree by the executor on the
  parallel path.
- A `PLAN PARTIAL`, timeout or checkpoint continuation is built from the report
  FILE's path, so re-running executes no task the file already lists complete
  and no table is re-inlined into a dispatch prompt.
- `cad-verifier` writes exactly one JSON file under `.planning/phases/<N>/`,
  not named `FINDINGS.json`, in the `uat merge` payload shape, and returns a
  digest plus that path; `verify-deep` pipes the file straight into
  `uat merge --payload <file>` with no hand-transcription step left.
- A missing, empty, literal-`null` or wrong-shape findings file is refused
  `ok:false` with a named reason and exit 1, and `/cad-verify --deep` reaches
  the same NAMED fall-through step a failed dispatch reaches, with the
  checklist unchanged.
- No reviewer receives an inlined diff: every fire site hands `claude-subagent`
  a ref pair, a staged-diff scope valid in its own cwd, or a path, and
  cross-model a composed `--payload <file>`; a non-string artifact is still
  refused `bad-payload` before the cap is consulted.
- `references/seams.md` states the break-even rule, and
  `node --test cadence-core/bin/*.test.mjs` plus
  `node cadence-core/bin/self-verify.mjs` both pass with `weight-budgets.json`
  regenerated in each commit that edited a budgeted surface.

## Context

CONTEXT.md's D-01..D-18 are locked and every task below names the ids it
implements; the acceptance criteria AC1..AC7 are cited the same way. Scope is
transport only - no review, gate, rung or guardrail is removed or weakened, no
`review.*` config key is added, `assertUnderCap` is not changed (D-11), and
skill and rung-agent DESCRIPTIONS are phase 3's, not this phase's (see Notes).
Every budgeted prose surface this phase touches sits exactly at its byte budget,
so `weight-budgets.json` regenerates in the same commit as each edit (D-17);
`cadence-core/references/*` carries no budget entry until phase 3.
This is ONE plan, not the split CONTEXT's plan shape asked for - see Notes for
the file-independence analysis that forced it.

## Tasks

### Task 1: state the break-even rule in the spawn-agent seam

- **Files:** cadence-core/references/seams.md
- **Action:** RES-04, D-12, AC7. Add one short subsection to `## Seam:
  spawn-agent`, placed immediately after the **Handoff read discipline**
  paragraph and before the `## Seam: call-review-provider` heading, in the same
  bold-lead style as its neighbours (e.g. **File round-trip (when the extra turn
  pays).**). Both neighbours state WHAT to do and neither states WHEN the extra
  turn pays, which is the gap. State: a file round-trip costs one extra turn -
  the parent's read-back - and pays only when BOTH conditions hold, that the
  read-back folds into a turn the parent was taking anyway (writing SUMMARY,
  making the docs commit, merging a worktree) and that the artifact lands LATE
  enough in the run that the bytes would otherwise ride every remaining turn;
  a small return the parent acts on immediately is pure overhead and stays
  inline. State which side extracts: whichever side has the SMALLER resident
  context, which is why the child (holding one plan) writes the file and the
  parent (holding the whole phase) reads a digest. Name the corollary that a
  parent must never read a file only to hand it down, pointing at Handoff read
  discipline rather than restating it. Ground it in the three shipped
  applications so the rule is not abstract: the executor report read back at
  `workflows/execute.md`'s `summary`, the verifier findings file consumed by
  `workflows/verify-deep.md`, and the cross-model `--payload <file>`. Keep it
  under ~900 bytes and add no config key. `cadence-core/references/` has no
  entry in `weight-budgets.json` until phase 3 (D-17), so this commit
  regenerates nothing.
- **Verify:** `grep -n "round-trip" cadence-core/references/seams.md` shows the
  new subsection sitting between the Handoff-read-discipline paragraph and the
  `## Seam: call-review-provider` line (compare the line numbers);
  `node cadence-core/bin/weight.mjs` lists no `cadence-core/references/seams.md`
  surface, so no budget entry moves; `node cadence-core/bin/self-verify.mjs`
  prints `"ok":true`.

### Task 2: the executor writes its report and returns a digest

- **Files:** skills/cad-executor-contract/SKILL.md,
  cadence-core/bin/weight-budgets.json
- **Action:** RES-01, D-01, D-02, D-04, D-09, D-13, AC1, AC3. Add a report-file
  rule to the contract and cut the table out of the return.
  (1) Path derivation (D-01): `<plandir>` is the directory of the plan file the
  dispatch prompt names, `k` is the number in `PLAN-<k>.md` and `1` for a bare
  `PLAN.md`, so the report is `<plandir>/reports/plan-<k>.md`. Derive it - never
  ask for a phase number, never assume `.planning/phases/`; `/cad-task`
  dispatches this same executor with `.planning/tasks/<slug>/PLAN.md` and its
  report must land beside it, which is exactly what a dispatch-supplied path
  would have broken.
  (2) Write it after EVERY task commit, not once at the end, rewriting the whole
  file each time: status line `PLAN PARTIAL` until the last task's row lands,
  `PLAN COMPLETE` after it. Reason to state in the prose: a timed-out executor
  returns nothing at all, so RES-01's "the timeout branch reads the FILE" is
  only true if the file already exists when the timeout fires.
  (3) File contents are today's `<report>` body verbatim - status line, plan
  file, `Tasks: {n} of {m}`, the `| Task | Commit | Note |` table, Deviations,
  Open items. Content identical, location changed.
  (4) The terminal message becomes EXACTLY five fields (D-13): status, task
  count, commit range (first..last short hash, or `none` when nothing was
  committed), deviation count, open-item count. No task table, no plan-file
  line, and no report path - the orchestrator derives the path from the plan
  file it dispatched (D-01), so a sixth field would be a value it already has.
  (5) Checkpoints (D-04): write the same file with status `CHECKPOINT: <type>`
  and the rows completed so far, then return the five-field digest plus the
  three routing fields the orchestrator cannot proceed without - checkpoint
  type, current task number and name, and `Need:` - and NO `Completed:` table.
  Say in the prose that those three are D-04's routing fields, not additions to
  the digest, so the two rules are not read as contradicting each other.
  (6) `risk_surface` checkpoints (D-09): before returning, write the flagged
  staged diff (`git diff --cached`) to
  `<plandir>/reports/plan-<k>-risk-task-<n>.diff` and return that path made
  ABSOLUTE (`git rev-parse --show-toplevel` joined with the relative path).
  Absolute because in worktree mode the orchestrator's tree does not contain
  the file at all (D-15) and a repo-relative path would resolve against the
  wrong tree. Do not commit the risky staged files - the gate still blocks that.
  (7) Worktree mode (D-02): commit the report file on EVERY return that ends
  this executor's turn - `PLAN COMPLETE`, `PLAN PARTIAL` and any CHECKPOINT -
  not only after the last task. Write the report first, then
  `git commit -- <report path>` in the pathspec form, message
  `docs({phase}-{plan}): plan {k} executor report`. Say why each half of that is
  load-bearing. The pathspec is what keeps a guardrail intact: a `risk_surface`
  checkpoint deliberately leaves the flagged changes STAGED and uncommitted, and
  a bare `git commit` after a `git add` would sweep them in and turn a blocking
  gate into a landed commit - naming the path commits the report and leaves
  everything else staged exactly as it was. Committing on the non-final branches
  is what makes D-02 hold at all: a partial or checkpointed plan is the branch
  where the worktree is most likely to be removed or abandoned before the
  executor is dispatched again, and an uncommitted report dies with it - which
  is precisely the re-run hazard RES-01 names. The transient
  `plan-<k>-risk-task-<n>.diff` is the one thing NEVER committed: it is the
  flagged diff itself, the continuation deletes it as its first act, and it must
  not reach history - but it must also not be left behind, because
  `git worktree remove` refuses a worktree holding untracked files. The
  no-merge/no-rebase/no-fetch rules are unchanged. On the sequential path do NOT
  commit it - the orchestrator stages it into the phase docs commit.
  (8) Exempt `<plandir>/reports/**` from the post-commit "no generated files
  left untracked" glance, so a report awaiting the orchestrator's docs commit
  is not re-reported as a stray artifact after every task.
  (9) In `<checkpoints>`, replace "trust its completed-task table and continue"
  with trusting the report FILE at the path the continuation prompt names.
  Regenerate this surface's `weight-budgets.json` entry in this commit from
  `node cadence-core/bin/weight.mjs` (D-17; it sits at 6954/6954). Both
  `cad-executor` rung files already declare `Write` in `tools:`, so no agent
  file changes here.
- **Verify:** `grep -n "reports/plan-" skills/cad-executor-contract/SKILL.md`
  shows the derivation, the per-task write, the checkpoint arm and the worktree
  commit; `grep -n "| Task | Commit | Note |"
  skills/cad-executor-contract/SKILL.md` matches only inside the report-FILE
  section and not in the terminal-message section; `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true` with the regenerated
  budget entry (a stale entry fails it as `budget-overrun`).

### Task 3: both orchestrators read the report file instead of the return

- **Files:** cadence-core/workflows/execute.md, cadence-core/workflows/task.md,
  cadence-core/bin/weight-budgets.json
- **Action:** RES-01, D-01, D-02, D-03, D-04, AC1, AC2. State the open-points
  rule ONCE and make every step agree with it: the orchestrator opens a report
  file at `summary` (once per plan) and on a continuation branch, where it reads
  ONLY task numbers and commit hashes for the `git log` confirmation it already
  performs (D-03) - never anywhere else, and never back into a dispatch prompt.
  Do not write "exactly once" anywhere; the continuation read is permitted and
  the two claims must not contradict.
  In `execute_sequential`: the **complete** arm records the digest and the
  derived report path `<plandir>/reports/plan-<k>.md` and does NOT open the
  file. The **partial** arm makes the report FILE authoritative - open it for
  the task numbers and hashes, confirm them against `git log {pre-plan
  HEAD}..HEAD` as today, then dispatch the continuation with the report PATH
  plus "continue from task <k>"; re-inlining the table would return the bytes
  RES-01 moved out, on the highest-cost path. The **timeout or no report** arm
  now has a file to read because the executor rewrites it after every task
  commit: read it, confirm against `git log`, then ask the user exactly as
  today. On the parallel path resolve the file inside the worktree - `git
  worktree list --porcelain` gives the worktree root for branch
  `cadence/phase-<N>-plan-<k>`.
  In `handle_checkpoint`: the return carries no completed-task table, so the
  fresh dispatch carries the report PATH, the checkpoint outcome, and "continue
  from task <k>". The `risk_surface` arm fires with the flagged-diff FILE path
  the checkpoint returned (D-09); task 9 converts that fire's wording.
  In `execute_parallel` step 3: record each branch's pre-merge HEAD before
  `git merge` runs - task 9 needs that ref pair - and note that the merge is
  what carries the executor's report commit into the phase history (D-02).
  In `goal_check`: change "drawn from the executor reports or a direct look" to
  `git log --oneline`, the returned digests, or a direct look, since the report
  files open at `summary`, not here.
  In `summary`: aggregate by reading each `<plandir>/reports/plan-<k>.md` once,
  at this step.
  In `state`: stage every report file into the docs commit alongside SUMMARY.md,
  STATE.md and CAPTURE.md when `planning.commit_docs` is true. Never stage a
  `plan-<k>-risk-task-<n>.diff` - it is transient by task 2 (6) and the
  continuation deletes it. State the `commit_docs: false` case and its reason in
  one clause, so the asymmetry with the worktree path is deliberate rather than
  an oversight: with the key false the report stays uncommitted exactly like
  SUMMARY.md, because a report IS a planning doc and the key is the user's
  standing answer for all of them; the worktree path commits regardless not as a
  docs decision but because the commit is the only transport across the merge -
  an uncommitted file in a deleted worktree is gone, whereas an uncommitted file
  in the main tree is still on disk for the user to keep or discard. Record in
  Notes that ROADMAP SC1's `git show <commit> --stat` clause is therefore
  evaluated under the default `planning.commit_docs: true`, and that under a
  false key the report still EXISTS at its path - which is what AC1 needs - it
  is simply untracked, like every other doc that key governs.
  In `task.md` `planned_path` step 3: when the cad-executor exception arm was
  taken, write the Outcome section from `.planning/tasks/<slug>/reports/
  plan-1.md`, read once at that step; step 4's commit includes the report file
  when `planning.commit_docs` is true. `task.md`'s `risk_check` line is task 9's.
  Regenerate both budget entries (execute.md 14805, task.md 3671) in this commit.
- **Verify:** `grep -n "reports/plan-" cadence-core/workflows/execute.md
  cadence-core/workflows/task.md` shows the path at the complete, partial,
  timeout, checkpoint, summary and state steps and in task.md; `grep -n
  "completed-task table" cadence-core/workflows/execute.md` returns no line that
  puts a table into a dispatch prompt; `grep -n "executor reports"
  cadence-core/workflows/execute.md` matches only the summary step; `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 4: the narrow `Write` grant, with a blocking check behind it

- **Files:** agents/cad-verifier.md, agents/cad-verifier-medium.md,
  agents/cad-verifier-xhigh.md, agents/cad-verifier-max.md,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** RES-02, D-08, D-16, AC4. On all four rung files move `Write` from
  `disallowedTools:` into `tools:` - `tools: Read, Write, Bash, Grep, Glob` and
  `disallowedTools: Edit, MultiEdit`. That is byte-neutral per file (`, Write`
  adds 7, `Write, ` removes 7), so no budget entry should move; assert it rather
  than assume, and if any count did move, regenerate that entry in this same
  commit (D-17). Do NOT touch any `description:` line - `agents/cad-verifier.md`
  still says "Read-only", which this grant makes false, and descriptions are
  phase 3's scope (see Notes).
  In `self-verify.mjs`, add a blocking check inside the existing `agents/` walk
  (the loop opened at `cadence-core/bin/self-verify.mjs:567`, which already has
  the frontmatter block and the parsed `tools:` set in hand), keyed on the
  file's `name:` being `cad-verifier` or `cad-verifier-<rung>`. Parse
  `disallowedTools:` the same way `tools:` is parsed - a column-0
  `^disallowedTools:\s*(.+)$` line inside the frontmatter, comma-split and
  trimmed - and push one problem of kind `verifier-write-grant` per violation:
  `Write` absent from `tools:`; `Edit` absent from `disallowedTools:`;
  `MultiEdit` absent from `disallowedTools:`; and the reverse direction, `Edit`
  or `MultiEdit` appearing in `tools:`. Detail names the file and the missing or
  offending tool. Add the check's name to the `checked:` string in the final
  `emit` (`:852`). State the reason in the comment: agent frontmatter exposes no
  path-scoped tool permission (D-16), so "narrow" cannot be host-enforced and
  this check is the only mechanical backstop keeping the milestone's one
  deliberate exception from widening silently in a later edit.
  Add rows to `self-verify.test.mjs` using the existing `--root` fixture
  pattern, one `test()` per row: a fixture `cad-verifier` rung with `Write`
  granted and `Edit`/`MultiEdit` denied yields no `verifier-write-grant`;
  dropping `Write` from `tools:` yields one; dropping `Edit` from
  `disallowedTools:` yields one; dropping `MultiEdit` yields one; putting `Edit`
  in `tools:` yields one; and a non-verifier agent with no `Write` yields none.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes with
  the new rows; `node cadence-core/bin/self-verify.mjs` prints `"ok":true`;
  deleting `Write` from `agents/cad-verifier-max.md`'s `tools:` makes it print
  `"ok":false` with a `verifier-write-grant` problem naming that file, and
  restoring it returns `"ok":true` (AC4's falsification, run both ways);
  `node cadence-core/bin/weight.mjs` still reports 548 / 535 / 531 / 523 bytes
  for the four rung files.

### Task 5: the verifier writes one findings file and returns a digest

- **Files:** skills/cad-verifier-contract/SKILL.md,
  cadence-core/bin/weight-budgets.json
- **Action:** RES-02, D-05, D-06, AC4. In `<role>`, replace "You write nothing -
  findings return in your final message" with: you write exactly ONE file,
  `.planning/phases/<N>/verifier-findings.json`, with a single `Write` call, and
  your final message is a digest plus that path.
  Replace the `<output>` markdown report block with the JSON object spec - top
  level `status` (`delivered | gaps | needs_human`), `score`
  (`{verified}/{total}`), `truths` (an array of `{n, truth, status, uat_item,
  evidence}`, `uat_item` null when none), and the three `uat merge` payload
  lists under their exact payload names: `passes` of `{k, name, evidence}`,
  `gaps` of `{k?, name, reason, evidence, severity, missing}`, `human_checks`
  of `{name, expected, why_human}`. State why the field names are the payload's
  (D-06): `uat merge` consumes only `passes`/`gaps`/`human_checks` and ignores
  every other key, at the top level and inside an entry, which is what lets one
  file be both the phase record and the merge payload with no translation step.
  `missing` stays on its gap and `why_human` on its human check because they are
  per-finding fields; the extra TOP-level keys D-06 permits are `status`,
  `score` and `truths`.
  State the name rule explicitly: the file is NOT `FINDINGS.json`, because
  `uat merge` atomically overwrites `.planning/phases/<N>/FINDINGS.json` with
  its own counters envelope on every successful merge
  (`cadence-core/bin/planning.mjs:670-675`), so a verifier writing that name
  would have its input destroyed by the merge it feeds.
  The terminal message carries the digest only - status, score, the counts of
  passes, gaps and human checks, and the file path - never the findings
  themselves and never the truths table.
  In `<guardrails>`, replace "Read-only: never create, edit, or delete files;
  never commit" with: write exactly one file, the findings JSON at the path
  above, and nothing else - never edit or delete a file, never commit, never
  write UAT.md (the seam owns it and its invariants). Leave every other
  guardrail, the four verification levels, the anti-pattern scan and the verdict
  ordering untouched: this is a transport change, not a rigor change.
  Regenerate this surface's `weight-budgets.json` entry (7676) in this commit.
- **Verify:** `grep -n "verifier-findings.json"
  skills/cad-verifier-contract/SKILL.md` shows the path in the role, output and
  guardrail sections; `grep -n "do NOT write any file\|Read-only\|write
  nothing" skills/cad-verifier-contract/SKILL.md` returns nothing; `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true`, which also proves the
  contract's backticked `Write` resolves against the rung `tools:` granted in
  task 4 (an ungranted mention fails as `undeclared-tool`).

### Task 6: `uat merge` takes a payload file and refuses a bad envelope

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs,
  cadence-core/bin/self-verify.mjs
- **Action:** RES-02, D-07, AC5. Give the `merge` arm of `cmdUat` a `--payload
  <file>` input: when the flag is set read that file, otherwise read stdin
  exactly as today, so no existing caller breaks. Then close the two live holes
  with named refusals, all through the existing `fail()` (seam-io already
  mirrors `ok:false` into exit 1):
  `no-payload` - `--payload` names a file that does not exist or cannot be read,
  or the payload text (file or stdin) is empty or whitespace-only. Detail names
  the path.
  `bad-payload` - the text does not parse; or it parses to anything that is not
  a non-null, non-array object; or it parses to an object carrying none of
  `passes`, `gaps` or `human_checks` as an array.
  Fix the sentinel collision rather than patching around it: `readStdinJson`
  currently returns `null` both for a parse failure and for a literal `null`
  payload (`cadence-core/bin/planning.mjs:391-394`), and `merge`'s `if (f ===
  null) return;` then exits 0 having printed NOTHING - a seam whose whole
  contract is one JSON line. Make the reader return a discriminated result (or
  throw the `DONE` sentinel `lib/seam-io.mjs` already exports) so a legitimate
  `null` is distinguishable from a parse error, and check that `uat init` and
  `uat refresh`, which share the reader, still refuse a `null` stdin as
  `bad-payload` rather than exiting silently. The second hole is the same
  shape from the other side: today `"hello"` and `{}` both merge as an all-zero
  `ok:true` success, so a truncated findings file reports a clean deep pass
  instead of falling through - the array test above is what closes it.
  Refuse BEFORE `loadUat` and before any write, so a refused merge leaves
  UAT.md and FINDINGS.json byte-identical. Do not touch the partial-success
  rule for entries INSIDE a well-shaped payload (an unusable entry is still set
  aside and counted - D-07 is about the envelope), and do not touch
  FINDINGS.json's name, shape or write path (D-05).
  Add the flag to the contract table in `self-verify.mjs`: `'uat merge':
  ['--phase', '--payload']`.
  Add rows to `planning.test.mjs`, one `test()` each (the convention and its
  reason are at `retired-keys.test.mjs:4-6`), every failing row asserting
  `ok:false`, the exact reason, `_exit === 1`, and UAT.md byte-identical to a
  pre-run read: a `--payload` path that does not exist; an empty file; a
  whitespace-only file; a file holding `null`; a file holding `"hello"`; a file
  holding `{}`; a file holding a JSON array. Plus one positive row: the same
  well-shaped payload merges identically through `--payload <file>` and through
  stdin - same counters, same resulting UAT.md bytes.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with the
  new rows; in a scratch fixture, `node cadence-core/bin/planning.mjs uat merge
  --phase 1 --dir <fixture> --payload /nonexistent` prints
  `"reason":"no-payload"` and `echo $?` prints `1`; the same call against a file
  holding `null` prints `"reason":"bad-payload"` and exit `1`, where the
  pre-task behaviour was no output and exit `0`; `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true`; `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 7: the deep pass reads the file and falls through on one named step

- **Files:** cadence-core/workflows/verify-deep.md,
  cadence-core/workflows/verify.md, cadence-core/bin/weight-budgets.json
- **Action:** RES-02, D-05, D-06, AC4, AC5, and ROADMAP SC3/SC4. Restructure
  `verify-deep.md` into three steps using the `<step name="...">` convention
  `verify.md` already uses, so the fall-through is a named target rather than a
  promise in prose.
  `dispatch` - dispatch cad-verifier via the spawn-agent seam with the phase
  number, goal, current UAT items and the PLAN/SUMMARY/ROADMAP paths as today,
  and with the findings path it must write. It returns a digest plus that path
  and writes exactly one file; do not restate the contract here.
  `merge` - one call, `planning.mjs uat merge --phase <N> --payload <path>`.
  Delete the quoted payload template and the "building the payload is a copy"
  paragraph: the verifier now writes that shape itself, and that copy IS the
  hand-transcription step ROADMAP SC3 removes. Keep the sentence naming what
  the seam enforces structurally (verifier results fill pending items only,
  unmatched gaps append, human checks append as pending, nameless entries are
  rejected and counted), keep the one-line counters report, and keep the
  paragraph on `FINDINGS.json` being the SEAM's own envelope - name both files
  explicitly in that paragraph so the verifier's `verifier-findings.json` and
  the seam's `FINDINGS.json` can never be confused (D-05).
  `fall_through` - the ONE terminal failure arm, holding the behaviour in a
  single place: report in one line what failed, write nothing, and return to
  `verify.md`'s `walk` with the checklist as-is, because the deep pass is an
  accelerator and never a gate. Both failure arms cite this step BY NAME and
  describe no behaviour of their own: (a) a failed, empty or timed-out dispatch,
  (b) an `ok:false` from `uat merge`, whatever its reason - `no-payload`,
  `bad-payload`, `no-uat`, or anything added later. That convergence is what
  makes SC4 structural: neither arm can grow a private error path.
  In `verify.md` `route_failures` step 1: when the failed item was recorded by
  the deep pass, open the findings file AT THAT POINT and read the gap's
  `missing` (or the human check's `why_human`) before diagnosing - that is the
  diagnosis the verifier already did, and it is why those keys ride the file
  (D-06). This is the only place `verify.md` opens it.
  In `verify.md` `complete`: the docs commit adds
  `phases/<N>/verifier-findings.json` beside the existing
  `phases/<N>/FINDINGS.json` when a deep pass wrote one.
  Regenerate both budget entries (verify-deep.md 2393, verify.md 12753).
- **Verify:** (1) `grep -n "fall_through"
  cadence-core/workflows/verify-deep.md` prints exactly three lines - one
  `<step name="fall_through">` definition and one citation in each of the two
  failure arms - so both arms provably reach the same named step. (2) `grep -n
  '"passes"\|copy, not a translation\|field-for-field'
  cadence-core/workflows/verify-deep.md` returns nothing, i.e. no payload
  template and no transcription instruction survive (AC4's grep clause).
  (3) `grep -n "verifier-findings.json\|FINDINGS.json"
  cadence-core/workflows/verify-deep.md cadence-core/workflows/verify.md` shows
  both names, each described as a different file with a different writer.
  (4) `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.
  (5) human-verify, scoped to what a live run can actually reach. Pre-seeding a
  malformed findings file and then invoking `/cad-verify --deep <N>` does NOT
  test the refusal: `dispatch` runs first and the verifier writes a well-formed
  file at that same path, so `merge` succeeds and the run never enters
  `fall_through`. The reachable live case is a dispatch that produces no usable
  file at all, which is the other arm of the same step: run `/cad-verify --deep
  <N>` once with the cad-verifier dispatch made to fail (interrupt it, or point
  the routing seam at a rung name that does not resolve), and confirm three
  things - one line reporting what failed, the walk running immediately after
  with the checklist unchanged, and `planning.mjs uat status --phase <N>`
  returning counters identical to a reading taken before the run. The
  merge-refusal arm is NOT reachable from a live `--deep` invocation and is
  proved instead by task 6's seven executable refusal rows (each asserting
  `ok:false`, the exact reason, exit 1 and a byte-identical UAT.md) together
  with check (1) above, which proves that arm cites the same `fall_through` step
  the failed-dispatch arm cites and therefore cannot have grown a private error
  path. Record that split in the executor's report so `/cad-verify 1` reads SC4
  against it rather than expecting four live runs.

### Task 8: the review subsystem takes references, not bytes

- **Files:** cadence-core/references/review-triggers.md,
  skills/cad-reviewer-contract/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** RES-03, D-09, D-10, D-11, D-14, D-15, AC6. Rewrite `### 2.
  Payload` so `artifact` is passed by REFERENCE and never inlined, in exactly
  three shapes that every fire site then names:
  (a) a committed range - `{base_ref, head_ref}`;
  (b) an uncommitted change in the ORCHESTRATOR's own working tree - the
  staged-diff scope (`git diff --cached` plus the paths), which the subagent
  re-runs itself because a Task-dispatched subagent inherits the parent's cwd
  (D-15);
  (c) a path - a file artifact such as a PLAN, or an artifact the reviewer's
  tree cannot reach: the executor's uncommitted staged diff, which no ref pair
  can name and which in worktree mode is not in the orchestrator's tree at all,
  so the executor writes it to a file and the checkpoint returns the absolute
  path (D-09).
  In `### 4. Run the reviewers`, say per backend what it does with the
  reference. `claude-subagent` receives the refs, scope or path in its prompt
  and produces the artifact itself - it has Read, Bash, Grep and Glob, and its
  cwd is the orchestrator's. Cross-model cannot run anything, so compose the
  payload FILE in a shell step and pass the EXISTING `--payload <file>` flag
  (D-14) - redirect `git diff <base_ref>..<head_ref>` into a `.diff` under the
  system temp dir, then one `node -e` line that reads it with `readFileSync` and
  writes `JSON.stringify({instruction, artifact})` into a `.json` beside it.
  Forbid hand-assembling that JSON with `echo` or a heredoc and say why: one
  unescaped quote or backslash in a diff makes the payload unparseable, which
  arrives as `bad-payload` after the shell already did the work. No new
  subcommand and no new flag, so no CONTRACTS churn on this arm. Say that the
  temp files are the model's own scratch, never a phase artifact.
  Record two facts in one line each so neither is silently dropped:
  `assertUnderCap` is UNCHANGED and still measures the parsed string fields,
  which under `--payload <file>` ARE the file's contents, so RES-03's "measure
  the file's CONTENTS" clause is satisfied without a byte-measurement change
  (D-11); and a non-string artifact is still refused `bad-payload` before the
  cap is consulted (D-10, `cadence-core/bin/review-provider.mjs:576-579`).
  In the wiring table, replace the `Payload artifact` column values with the
  shape each trigger uses: `plan` -> the PLAN file path(s); `diff` -> refs
  `<pre-plan HEAD>..HEAD`; `risk_surface` -> the flagged-diff FILE path the
  checkpoint returned, or the staged-diff scope at a main-context fire site;
  `phase_diff` -> refs `<PHASE_START>..HEAD`; `pre_ship` -> refs
  `<base>..HEAD`.
  In `cad-reviewer-contract`'s `<role>`, state that the artifact arrives as a
  reference - a ref pair to diff yourself in your cwd, a staged-diff scope, or a
  path to open - that producing it with your own Read/Bash is the first step of
  the review, and that an unresolvable reference returns a single `blocker`
  finding saying so, never an empty `findings: []`, which would read as a clean
  pass. That surface has 56B of headroom (3240/3296); regenerate its budget
  entry if the edit exceeds it (D-17).
  Keep every new sentence compliant with self-verify check 10: a sentence that
  ISSUES a set of dispatches must say "in ONE message". `references/` carries no
  budget entry, but `review-triggers.md` is `@`-preloaded into `/cad-land` and
  `/cad-plan-review` on every invocation, so keep the net growth small (the
  shortened table column pays for part of it) and state the byte delta against
  the pre-task 13224 in the executor's report.
- **Verify:** `grep -n "base_ref" cadence-core/references/review-triggers.md`
  shows step 2, step 4 and the wiring table; `grep -n "as the payload\|the
  diff, or the files under review" cadence-core/references/review-triggers.md`
  returns nothing, i.e. no line hands a reviewer the artifact's TEXT;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` (which is also the
  check-10 dispatch-phrasing pass); `wc -c
  cadence-core/references/review-triggers.md` is reported against 13224.

### Task 9: every fire site hands a reference

- **Files:** cadence-core/workflows/execute.md, skills/cad-land/SKILL.md,
  cadence-core/workflows/debug.md, cadence-core/workflows/task.md,
  cadence-core/workflows/verify.md, cadence-core/bin/weight-budgets.json
- **Action:** RES-03, D-09, D-15, AC6, ROADMAP SC5 - which is universal, so this
  task converts every site that hands over an artifact and records, with
  evidence, the ones that already hand a reference. Convert, naming task 8's
  shape at each site:
  `execute.md` `execute_sequential` - the `diff` fire takes
  `{base_ref: <pre-plan HEAD>, head_ref: HEAD}` (shape a) instead of `git diff
  {pre-plan HEAD}..HEAD` as the payload.
  `execute.md` `handle_checkpoint` - the `risk_surface` fire takes the
  flagged-diff FILE path the checkpoint returned (shape c, D-09), not "the
  flagged diff".
  `execute.md` `execute_parallel` step 5 - each plan's `diff` fire takes the
  ref pair formed by the pre-merge HEAD recorded in step 3 and the HEAD after
  that plan's merge (shape a). Add one line settling CONTEXT's flagged
  assumption instead of leaving it to recur: step 5 runs after step 3 has merged
  every branch, so a per-plan `diff` review never fires before the merge and its
  refs always resolve in the orchestrator's tree (D-15).
  `execute.md` step 6 - `phase_diff` takes `{PHASE_START, HEAD}` (shape a).
  `cad-land` step 3 - `pre_ship` takes `{base, HEAD}` (shape a) instead of the
  full branch diff as the artifact; the one permitted re-fire after triage
  commits uses the same base and the new HEAD.
  `debug.md` Resolve step 3 - the fix is staged in the orchestrator's own tree,
  so the `risk_surface` fire carries the staged-diff scope (shape b): the
  reviewer runs `git diff --cached` in the cwd it inherits, never the diff text.
  `task.md` `risk_check` - the commits already exist, so refs (shape a): the
  parent of the task's first commit and HEAD.
  `verify.md` `route_failures` step 1 - the second-opinion fire carries the
  failed item's cited file PATHS plus its recorded `reported`/`cause` text,
  never file contents; step 3's commit-time `risk_surface` uses shape b like
  debug.md.
  Record as already reference-shaped, no edit, with the evidence in the
  executor's report: `cadence-core/workflows/plan.md:223` ("payload = the PLAN
  file(s)") and `skills/cad-plan-review/SKILL.md:41-42` ("with the resolved PLAN
  file(s) as the artifact") both hand a file reference already, and task 8's
  shape (c) now covers a file artifact explicitly, so SC5 holds at both without
  an edit; `cadence-core/workflows/decision-review.md:34-41` inlines a decision
  QUOTE plus its surrounding context, which is bounded by construction, is no
  diff, and is not one of the five wiring-table triggers - outside RES-03's
  shape, recorded rather than edited.
  Regenerate the four budgeted entries this task touches (execute.md,
  skills/cad-land/SKILL.md 9079, debug.md 6237, task.md 3671, verify.md 12753).
- **Verify:** (1) `grep -rn "as the payload\|the flagged diff\|full branch diff"
  cadence-core/workflows/ skills/` returns no line handing a reviewer diff TEXT,
  and `grep -n "base_ref\|--cached\|flagged-diff"
  cadence-core/workflows/execute.md skills/cad-land/SKILL.md
  cadence-core/workflows/debug.md cadence-core/workflows/task.md
  cadence-core/workflows/verify.md` shows one converted site per bullet above.
  (2) A COMPLETENESS check, because (1) is a phrase blacklist and SC5 is
  universal - a site worded differently passes it. Run
  `grep -rln "risk_surface\|pre_ship\|phase_diff\|review trigger\|fire("
  cadence-core/workflows/ skills/ | grep -v references` and account for EVERY
  file it names in the executor's report, in exactly one of three classes: a
  site this task converted; a site recorded above as already reference-shaped
  with its evidence; or not a fire site at all, with the reason (a config
  catalog naming trigger keys, a gate-resolution note, a description line). At
  the time of planning that command returns 13 files -
  `workflows/{task,debug,milestone,config-review,context,execute,plan,config}.md`
  and `skills/{cad-executor-contract,cad-plan,cad-milestone,cad-land,cad-plan-review}/SKILL.md`
  - so a report accounting for fewer than the command actually returns is
  itself the failure. An unaccounted file fails this task. (3) `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true` with every touched budget
  entry regenerated.

### Task 10: close the stale claims and prove the cycle green

- **Files:** .planning/CAPTURE.md, CHANGELOG.md,
  cadence-core/bin/weight-budgets.json
- **Action:** D-10, D-11, D-18, AC7. Verify three things and change no behaviour
  for any of them.
  D-10: confirm both paid commands refuse a non-string payload as `bad-payload`
  BEFORE `assertUnderCap` - `cadence-core/bin/review-provider.mjs:576-579`
  (review) and `:592-596` (consult), with the ordering stated in
  `estimatePromptTokens`'s own comment at `:246-251` and pinned by the
  regression row at `cadence-core/bin/review-provider.test.mjs:433-455` (object
  artifact, object situation, numeric artifact). Land NO second guard and no
  differently-worded gate. Then close the stale item at
  `.planning/CAPTURE.md:179` in that file's own convention - flip `- [ ]` to
  `- [x]` and append `— closed by <this commit>:` plus what was verified, the
  three citations, and the live probe output.
  D-18: `review.triggers.diff.gate` is ALREADY absent from
  `.planning/config.json`; commit `f784cf4` removed it after CONTEXT was
  gathered. Verify rather than re-remove: `node cadence-core/bin/route.mjs
  resolve --role cad-reviewer` returns no `warnings[]` entry and resolves
  `review.diff` from the level. Make no config edit; record the result.
  D-11: state in the CHANGELOG that `assertUnderCap` is deliberately unchanged
  and why, so RES-03's "measure the file's CONTENTS" wording is recorded as
  satisfied by the parsed-string measurement rather than silently dropped.
  CHANGELOG: add one `### Changed` block under `## [Unreleased]` naming what a
  user sees - executor reports at `<plandir>/reports/plan-<k>.md` with a
  digest-only return, the verifier's single `verifier-findings.json` and its
  narrow `Write` grant with `Edit`/`MultiEdit` still denied and self-verify
  asserting it, `uat merge --payload <file>` with named refusals and exit 1, and
  reviewers receiving refs, scopes or paths instead of inlined diffs. No
  AI-attribution line anywhere in this or any other artifact.
  Finally, confirm the ratchet held: every preceding commit that edited a
  budgeted surface carries its own `weight-budgets.json` change (D-17). A miss
  is NOT repaired quietly inside this task's commit - that would leave the
  manifest correct while the same-commit rule D-17 states was in fact broken,
  and it would make the check below unfalsifiable. Instead, record the miss as a
  deviation and repair it in its OWN commit whose message names the commit it
  repairs (`fix(budget): regenerate manifest missed by <hash>`), so the gap and
  its repair are both legible in `git log`.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes; `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true`; `npx tsc -p
  tsconfig.ci.json` exits 0; `node cadence-core/bin/route.mjs resolve --role
  cad-reviewer` prints no `warnings` key; `grep -n "over-cap refusal is
  bypassable" .planning/CAPTURE.md` shows the line beginning `- [x]`; and `git
  log --stat <PHASE_START>..HEAD` shows a `weight-budgets.json` change in every
  commit that edited a budgeted surface, with the single permitted exception of
  a `fix(budget):` repair commit naming the commit it repairs - which, if one
  exists, is reported as a D-17 deviation rather than passed over.

## Notes

**Plan shape: ONE PLAN.md, deviating from CONTEXT's directive.** CONTEXT asks
for multiple plans split along RES-01 / RES-02 / RES-03+04, each independently
executable. The file-independence test refuses it on two counts, so the hard
constraint wins and the deviation is recorded here rather than taken silently.
(1) Every budgeted prose surface this phase touches sits EXACTLY at its byte
budget, so D-17 makes every such edit regenerate
`cadence-core/bin/weight-budgets.json` - a file all three slices would declare,
which `planning.mjs plan-overlap` reports as an overlap and which sends
`/cad-execute` back to the sequential path anyway. (2) The slices share prose
files independently of the manifest: `cadence-core/workflows/execute.md` carries
both the RES-01 report wiring (tasks 3) and four RES-03 fire sites (task 9);
`cadence-core/workflows/task.md` carries the `/cad-task` report read and a
`risk_surface` fire; `cadence-core/workflows/verify.md` carries both the RES-02
findings read and an RES-03 fire site. A split that declared those files in two
plans would look independent and merge-conflict in practice.

**The one report-file rule, stated once.** The orchestrator opens a report file
at `summary` (once per plan, and at `task.md`'s Outcome step for the `/cad-task`
arm) and on a continuation branch, where it reads only task numbers and commit
hashes to confirm against `git log` (D-03). It is never claimed to open "exactly
once", because the continuation read is permitted and a stronger claim would
contradict the partial branch.

**Left for the user: `agents/cad-verifier.md`'s description still says
"Read-only".** Task 4's grant makes that false, and this plan does NOT edit it:
CONTEXT's Scope puts skill and rung-agent descriptions in phase 3, which
measures all 29 descriptions against a 5,078-byte baseline captured before phase
1, and editing one here would move that baseline mid-cycle. The other three rung
descriptions do not carry the claim (they say "identical contract, different
reasoning depth"). If the user judges the false claim too costly to carry for
two phases, it is a one-line edit to make deliberately - it is not folded into
any task here.

**Fire sites read and recorded, not edited** (ROADMAP SC5 is universal, so each
is evidence rather than an assumption): `workflows/plan.md:223` and
`skills/cad-plan-review/SKILL.md:41-42` already hand the PLAN FILE(s) as the
artifact, which task 8's shape (c) covers explicitly;
`workflows/decision-review.md:34-41` inlines a bounded decision quote, is not a
wiring-table trigger, and carries no diff.

**The panel-accumulation hypothesis, checked.** CONTEXT flags `panel-review` and
`cad-land` at 2.4x the workhorse commands as UNVERIFIED, and project memory asks
whether voice N's output is resident when voice N+1 runs. It is not: a trigger's
reviewers are dispatched in ONE message (`references/review-triggers.md` step 4,
`references/seams.md` Concurrent dispatch), so no voice's findings precede
another's dispatch, and the returned findings must stay resident because the
main model adjudicates them. What `cad-land` actually carries is the two eager
`@`-includes in its `<execution_context>` (`review-triggers.md` at 13,224 bytes
plus `git.md`) - phase 2's LOD work - and the full branch diff it inlines as the
`pre_ship` artifact, which task 9 removes. So this phase reduces that site by
the diff only; the include half is phase 2's, exactly as CONTEXT's flagged
assumption warned.

**Flagged assumption settled:** a per-plan `diff` review on the parallel path
fires at `execute_parallel` step 5, after step 3 has merged every branch, so it
never runs before the merge and its refs always resolve in the orchestrator's
tree. Task 9 writes that line into `execute.md` so the question does not
reopen.

**What stays prose-only, and therefore belongs to `/cad-verify 1`'s human
walk.** Task 6's refusal rows and task 7's `fall_through` grep prove the seam
refuses and that both failure arms converge on one named step, but no automated
check exercises `/cad-verify --deep` end to end - task 7's step (5) is a
human-verify of the ONE arm a live run can reach, the failed dispatch, with the
exact before/after `uat status` comparison. The merge-refusal arm is
deliberately not in that live test: `dispatch` precedes `merge`, so a
pre-seeded malformed findings file is overwritten by the verifier before the
merge ever reads it, and the arm is unreachable from a normal `--deep`
invocation. It is proved instead by task 6's seven executable refusal rows plus
task 7's `fall_through` convergence check, and that substitution is recorded
here so `/cad-verify 1` reads SC4 against it rather than logging a gap. AC2 (a
`PLAN PARTIAL` continuation re-running nothing) and AC3 (a checkpoint's report
file and readable flagged diff) are likewise live-dispatch checks, already
tagged `(human-verify)` in CONTEXT and carried forward as such.

**SC1 and `planning.commit_docs`.** ROADMAP SC1 asks that each plan's report
appear in the phase's docs commit under `git show <commit> --stat`. That clause
is evaluated under the default `planning.commit_docs: true`. With the key false
there is no docs commit at all, and the report stays uncommitted exactly like
SUMMARY.md - a report is a planning doc and that key is the user's standing
answer for all of them. AC1's substance still holds in that configuration: the
file EXISTS at `<plandir>/reports/plan-<k>.md`, which is what the orchestrator
reads back and what a continuation resumes from; it is simply untracked. The
worktree path commits regardless, and that asymmetry is deliberate rather than
an inconsistency - there the commit is not a docs decision but the only
transport across the merge, since an uncommitted file in a deleted worktree is
destroyed while one in the main tree is still on disk.

**D-18 is already shipped.** `f784cf4` dropped
`review.triggers.diff.gate` from `.planning/config.json` after CONTEXT was
gathered; task 10 verifies the absence and the clean `route.mjs resolve` rather
than re-removing a key that is gone. Recorded so the decision is not read as
dropped (source: `.planning/CAPTURE.md`, 2026-08-01 entry, and this repo's
commit history).

**Recalled prior art used here:** the confirmed capture item on executor reports
staying resident (its warning that the `partial`/`timeout` branches must read
the FILE or a continuation silently re-runs finished tasks drove task 2's
per-task write and task 3's continuation arms); the unverified panel/cad-land
measurement (checked above); and the phase-2 v1.4.0 finding that a `blocked`
worktree halt has no described remedy - untouched here, since it is an
orchestrator-side gap in `execute_parallel`, not a transport defect, and
widening into it would exceed this phase's scope.
