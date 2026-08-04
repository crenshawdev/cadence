---
phase: 1
plan: 1
requirements:
  - RES-01
  - RES-03
  - RES-04
files:
  - cadence-core/references/seams.md
  - cadence-core/references/review-triggers.md
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-reviewer-contract/SKILL.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/task.md
  - skills/cad-land/SKILL.md
  - .planning/config.json
  - .planning/CAPTURE.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The orchestrator stops holding what its children returned - Plan 1

## Goal

No subagent's full output is resident in a parent context after the turn it
arrived on. This plan takes the executor-report seam (RES-01), the
review-artifact seam (RES-03), and the break-even rule that justifies both
(RES-04). Transport only: the same bytes exist, in a file instead of a return,
and they load at the turn that acts on them.

## Must be true when done

- A cad-executor's final message carries status, task count, commit range,
  deviation count, open-item count and its report path - and no task table, on
  any terminal branch (complete, partial, checkpoint).
- Every executed plan has `<plandir>/reports/plan-<k>.md` beside it in git
  history: staged into the phase docs commit on the sequential path, committed
  inside the worktree and carried by the merge on the parallel path.
- A `PLAN PARTIAL`, TIMEOUT or CHECKPOINT continuation is built from the report
  FILE's path: the re-dispatch executes no task the file lists complete, and the
  orchestrator never re-inlines the table into the prompt. Only on the timeout
  branch, and only when no report file exists, does the prompt fall back to
  `git log`-derived task numbers.
- No fire site hands a reviewer diff bytes: `claude-subagent` receives a
  `{base_ref, head_ref}` pair that resolves in the tree it inherits (or, for
  `risk_surface`, the file path the checkpoint named), and cross-model receives
  `--payload <file>`.
- `cadence-core/references/seams.md` states when a file round-trip's extra turn
  pays for itself and which side does the extraction, inside the spawn-agent
  section every "bounded handoff" citation already points at.
- `route.mjs resolve` emits no diff-gate disagreement warning and reports the
  `diff` trigger at `critical`'s `blocking`.

## Context

- D-01/D-02/D-03/D-04 bind the executor half: the report path is derived from
  the plan file's OWN directory, the worktree copy survives by commit, and
  continuations (partial, timeout, checkpoint) carry the PATH, never the table.
- D-09 binds `risk_surface`: its artifact is an uncommitted staged diff, so the
  executor writes it to a file and the checkpoint returns that path. D-15 is why:
  a Task-dispatched subagent inherits the parent's cwd, so no ref pair can name
  an uncommitted diff in a worktree the orchestrator cannot see.
- D-11/D-14 bind the cross-model half: `assertUnderCap` is UNCHANGED, and the
  payload file is composed by a shell step using the existing `--payload <file>`
  flag - no new seam subcommand, no new flag, no CONTRACTS churn.
- D-17: every prose surface this plan edits sits exactly at its byte budget, so
  `cadence-core/bin/weight-budgets.json` is regenerated in the SAME commit as
  each edit. `cadence-core/references/**` carries no budget entry until phase 3 -
  never add one here.
- Out of scope: changing `assertUnderCap`'s measurement (D-11), any `review.*`
  config-key addition, and the `references/` load-order judgments (phase 2).

## Tasks

### Task 1: State the file round-trip break-even rule in the spawn-agent seam

- **Files:** cadence-core/references/seams.md
- **Action:** In `## Seam: spawn-agent`, directly after the **Handoff read
  discipline** paragraph (and before `## Seam: call-review-provider`), add a
  bolded **Break-even (when the round-trip pays)** paragraph. It states the rule
  RES-04 asks for, in this shape: moving an artifact out of a return and into a
  file buys a smaller resident context and costs one extra turn - the parent's
  read-back - so it pays only when BOTH hold. First, the read-back folds into a
  turn the parent was taking anyway (writing SUMMARY, opening the file at the
  step that acts on it) rather than adding a turn of its own. Second, the
  artifact lands LATE in the run, so the bytes it displaces would otherwise ride
  every remaining turn; an artifact that arrives on the last turn saves nothing
  and still costs the write. Then state the ownership half: extraction belongs
  to whichever side has the SMALLER resident context, because the write is paid
  once by the writer while the resident copy is paid per turn by the holder.
  Close with the two shipped applications as one clause each - the executor
  report (read back once at SUMMARY time, late in the phase) and the verifier
  findings file (read back by the `uat merge` call the workflow already makes) -
  so a reader sees the rule satisfied rather than only asserted. Keep it inside
  the spawn-agent section: every existing "seams.md, bounded handoff" citation
  must reach the whole rule without being re-pointed (D-12). Do NOT open a new
  `##` section and do NOT add a `weight-budgets.json` entry for `references/`
  (D-17). Avoid clause-initial imperative dispatch verbs (`Dispatch`, `Spawn`,
  `Fire`, `Issue`) anywhere near the words "concurrent"/"parallel" in the new
  prose - `self-verify.mjs` check 10 lints `cadence-core/references/` for that
  shape and would report `unbatched-dispatch` on otherwise correct text.
- **Verify:** `grep -n "Break-even" cadence-core/references/seams.md` prints
  exactly one line, whose number is greater than the line
  `grep -n "^## Seam: spawn-agent" cadence-core/references/seams.md` prints and
  less than the line `grep -n "^## Seam: call-review-provider" ...` prints; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 2: The executor writes its report to a file and returns a digest

- **Files:** skills/cad-executor-contract/SKILL.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Rewrite `<report>` so the executor's task table becomes a FILE and
  its final message becomes a digest. Path derivation (D-01): take the directory
  of the plan file named in the dispatch prompt and write
  `<that dir>/reports/plan-<k>.md`, where `<k>` is the number in `PLAN-<k>.md`
  and `1` for an unsplit `PLAN.md` - so `/cad-execute` lands under
  `.planning/phases/<N>/reports/` and `/cad-task` under
  `.planning/tasks/<slug>/reports/` with no new prompt field and no phase number
  the executor does not have. Create the `reports/` directory if absent. The
  FILE carries exactly what the return carries today: a `status:` line
  (`COMPLETE`, `PARTIAL` or `CHECKPOINT`), the plan file, `tasks: {n} of {m}`,
  the `| Task | Commit | Note |` table with exact short hashes, the
  `[deviation]` entries, and the open items. The final MESSAGE carries only:
  the status word, the plan file, the report path, `Tasks: {n} of {m}`, the
  commit range as `{first}..{last}` short hashes (the single hash when there was
  one, `none` when there were none), `Deviations: {count}` and
  `Open items: {count}` (D-13). No table row, no deviation text, no open-item
  text in the message on ANY terminal branch - the orchestrator reads the file
  when it needs the detail, and re-inlining the table would return exactly the
  bytes this moves out (`cadence-core/references/seams.md` § spawn-agent
  break-even). Then update `<checkpoints>` (D-04): a checkpoint writes the SAME
  report file with `status: CHECKPOINT`, and its return carries the checkpoint
  type, the plan, the report path, the current task number and name, and the
  one-line `Need:` - never the completed-task table, which now lives in the file
  the continuation prompt names. Rewrite that block's closing paragraph in the
  same pass (it currently ends "A continuation dispatch will carry the outcome
  back to you (fresh context) - trust its completed-task table and continue from
  the task it names"): after D-03 the continuation prompt carries a report PATH,
  not a table, so the sentence must tell the continuation executor to read the
  report file its prompt names and continue from the first task that file does
  not list complete. Leaving it as written is RES-01's own failure mode - a
  continuation trusting a table it will never receive re-runs finished tasks.
  Write both rewrites positively - say what the return and the continuation DO
  carry - without spelling the phrase "completed-task table" anywhere in the new
  prose, so the check below reads as a clean removal.
  Update `<commit_protocol>` step 2 for D-09: on
  a risk-surface match, write the flagged staged diff (`git diff --cached`) to
  `<plandir>/reports/plan-<k>-risk-surface.diff` before halting and name that
  file in the checkpoint by ABSOLUTE path, because in worktree mode a
  repo-relative path does not resolve in the orchestrator's tree and no ref pair
  can name an uncommitted diff; it is a transient artifact, never committed, and
  the continuation that carries the review outcome back DELETES it as its first
  act, before any implementation. State that deletion as a rule, not a courtesy:
  left in place it is an untracked file under tracked `.planning/`, where a later
  broad stage can sweep it into a commit and where `git worktree remove` - which
  refuses a worktree holding untracked files - would fail on exactly the plan
  that produced the checkpoint. Add to `<commit_protocol>` step 5 that the
  report file is an EXPECTED untracked file on the sequential path - the
  orchestrator stages it into the phase docs commit - so the post-commit glance
  neither commits it nor reports it as a stray. Update `<worktree_mode>` for
  D-02: on a TERMINAL return only - `PLAN COMPLETE` or `PLAN PARTIAL` - after
  writing the report, stage the report alone (`git add <report path>`) and commit
  it with an explicit pathspec, `git commit -- <report path>`, message
  `docs({scope}): plan <k> execution report` using the scope from the dispatch
  prompt, so `git merge` carries the report back. State the boundary in the same
  breath, because it is what keeps a guardrail intact: never commit the report
  while a CHECKPOINT has left a diff staged - a `risk_surface` halt deliberately
  leaves the flagged changes staged and uncommitted (`<commit_protocol>` step 2),
  and a bare `git commit` after `git add` would carry that diff in and turn a
  blocking gate into a landed commit; the pathspec is what makes anything else
  already staged stay staged. A CHECKPOINT report file therefore stays
  uncommitted inside the worktree until the continuation's own terminal return
  commits it. This stays inside the worktree path and adds no merge, rebase or
  fetch. Update `<role>`'s last sentence so it
  says the executor writes a report FILE and returns a digest, and that the
  orchestrator reads the files back when it writes SUMMARY.md. Restate
  `<process>`'s last line ("After the last task: return the report.") as writing
  the report file and returning the digest - it is the only line in that block
  this change touches, and left alone it names the return where the file now is.
  Leave `<never>`,
  `<deviation_rules>` and the rest of `<process>` untouched, and do not add
  `STATE.md`/`SUMMARY.md` write permission of any kind. Finally regenerate this
  surface's entry in `cadence-core/bin/weight-budgets.json` to the exact byte
  count `node cadence-core/bin/weight.mjs` now reports for it, in this task's
  commit (D-17).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` (proves
  the budget was regenerated and no undeclared tool was referenced); and
  `grep -n "reports/plan-" skills/cad-executor-contract/SKILL.md` prints lines
  inside `<report>`, `<checkpoints>`, `<commit_protocol>` and `<worktree_mode>`,
  while `grep -c "| Task | Commit | Note |" skills/cad-executor-contract/SKILL.md`
  prints `1` and that single occurrence is inside the report-FILE description,
  not the final-message description; and
  `grep -n "completed-task table" skills/cad-executor-contract/SKILL.md` prints
  nothing.

### Task 3: /cad-execute stops holding what the executors returned

- **Files:** cadence-core/workflows/execute.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Rework the six steps that hold, or claim to hold, executor output.
  In `execute_sequential`, replace the **complete** branch's "collect its report
  (tasks, hashes, deviations, open items)" with: record the report PATH and the
  digest counts and do NOT open the file - the read-back happens once, in
  `summary`. Replace the **partial** branch so the report FILE is authoritative:
  read `<plandir>/reports/plan-<k>.md`, confirm its hashes against
  `git log {pre-plan HEAD}..HEAD`, then ask the user (ask-user seam) exactly as
  today; the continuation prompt carries the report PATH and "continue from task
  <k>", never the table itself (D-03) - distilling task numbers plus hashes for
  the `git log` confirmation is the only material that may leave the file.
  Extend the **timeout or no report** branch to check whether the report file
  exists before inspecting `git log`: a timed-out executor may have committed
  tasks and written no report, and the two states get different reports to the
  user AND different re-dispatch prompts. When
  `<plandir>/reports/plan-<k>.md` EXISTS, the re-dispatch prompt carries the
  report PATH plus "continue from task <k>", identical to the partial branch;
  only when the file is ABSENT does the prompt fall back to the task numbers
  derived from `git log`. RES-01 names this branch beside `partial` for a reason -
  it is the branch where re-running finished tasks is most likely, so leaving its
  prompt unspecified is the defect, not a detail. In `handle_checkpoint`, rewrite
  the step's OPENING sentence, which today reads "A checkpoint return carries:
  completed tasks with commit hashes, the current task, and what the executor
  needs" and after task 2 states the opposite of the contract it dispatches: it
  becomes "A checkpoint return carries: the checkpoint type, the plan, the report
  path, the current task, and what the executor needs" (D-04/D-13). Then change
  the continuation dispatch so the prompt carries the report path plus "continue
  from task <k>" and the checkpoint outcome, in place of the task table it sends
  today (D-03/D-04). Write every rewrite in this task positively - what the
  return, the prompt and the step DO carry - without spelling the phrase
  "completed-task table" in the new prose, so the check below reads as a clean
  removal. In
  `execute_parallel`, add to step 3 that each merge carries that plan's report
  commit back, so after the merges every plan's report is readable at
  `.planning/phases/<N>/reports/plan-<k>.md` in the orchestrator's own tree, and
  a report missing after a clean merge is a defect to report rather than
  something to reconstruct from the returns. Add to the SAME step that the
  orchestrator records, per plan, the short SHA of HEAD immediately BEFORE it
  merges that plan's branch and the short SHA immediately AFTER - that plan's
  merge range - and keeps both for step 5. This is the enabling half of task 5:
  step 4 deletes each worktree branch before step 5 fires anything, so a reviewer
  handed a branch name gets a ref that no longer resolves, and the SHAs are the
  only names for that plan's changes that survive the deletion. State that reason
  in the step without spelling the branch pattern, which task 5's check expects
  to appear only where step 1 names the branch it creates.
  Add to step 4 that before removing a merged worktree, any leftover transient
  `plan-<k>-risk-surface.diff` inside it is deleted first, since
  `git worktree remove` refuses a worktree holding untracked files and that file
  is written on exactly the path a checkpoint took. In `summary`, replace
  "aggregating the executor reports" with a single explicit read-back: read
  every plan's report file in ONE batch here and aggregate them into SUMMARY.md -
  this is the turn the orchestrator was taking anyway, which is what makes the
  round-trip pay (`cadence-core/references/seams.md` § spawn-agent break-even).
  In `goal_check`, which runs BEFORE `summary`, replace "drawn from the executor
  reports or a direct look" with evidence drawn from
  `git log --oneline {PHASE_START}..HEAD` plus a direct look at the code: the
  report files open exactly once, at `summary`, so this step neither holds
  material it no longer has nor opens the files a step early. Change nothing else
  about it - it stays an inline assessment, not a gate.
  In `state`, add the report files to the docs commit's staged set on the
  sequential path (`.planning/phases/<N>/reports/plan-<k>.md` for each plan
  executed), and state that on the parallel path they are already committed and
  arrived by merge, so staging them again is a no-op rather than an error. Do
  not change the `diff`/`phase_diff` fire wording in this task - task 5 owns it.
  Regenerate this surface's `weight-budgets.json` entry in this task's commit.
- **Verify:** `grep -n "collect its report\|completed tasks with commit hashes"
  cadence-core/workflows/execute.md` prints nothing and
  `grep -n "completed-task table\|executor reports or a direct look"
  cadence-core/workflows/execute.md` prints nothing - one pattern per stale
  sentence this task replaces: the complete branch, `handle_checkpoint`'s opening
  line, both continuation dispatches, and `goal_check`'s evidence clause;
  `grep -n "reports/plan-" cadence-core/workflows/execute.md`
  prints at least one line inside each of `execute_sequential`,
  `handle_checkpoint`, `execute_parallel`, `summary` and `state`;
  `grep -n "merge range" cadence-core/workflows/execute.md` prints a line in
  `execute_parallel` step 3; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 4: A review artifact reaches a reviewer as a reference, not as bytes

- **Files:** cadence-core/references/review-triggers.md,
  skills/cad-reviewer-contract/SKILL.md, .planning/CAPTURE.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In `review-triggers.md` § 2 Payload, restate `artifact` as a
  REFERENCE the reviewer resolves rather than text assembled at the fire site,
  with one line per artifact kind: a committed diff is the pair
  `{base_ref, head_ref}`; a file already on disk is its path (the `plan`
  trigger's PLAN file or files); an uncommitted staged diff produced inside an
  executor's worktree is the path the executor's `risk_surface` checkpoint named,
  since no ref pair can name a diff that is not committed and the orchestrator
  cannot see that tree (D-09); and an uncommitted change in the tree the reviewer
  itself inherits needs no transport at all - the fire site says which change and
  the reviewer runs `git diff` there (D-15), which is the `cad-debug` case, where
  the fix is applied and never committed. State the prohibition with its reason:
  running `git diff` in the firing context pays for the bytes twice - once to
  read them into this turn, again to send them - and they ride every later turn
  (cite `cadence-core/references/seams.md` § spawn-agent break-even). Leave
  `instruction` as it is. In § 4, extend the **claude-subagent** bullet: the
  dispatch prompt carries the reference and the reviewer runs
  `git diff <base_ref>..<head_ref>` itself; a Task-dispatched subagent inherits
  the FIRING context's cwd (D-15), so the refs must resolve there - true for
  `phase_diff`, `pre_ship`, and a `diff` fired after the worktree merge - and a
  trigger whose artifact cannot be named by refs in that tree passes a file path
  instead. Extend the **cross-model** bullet with the payload-file step (D-14),
  and REPLACE the clause that has the fire site assemble the payload in context -
  today the bullet reads "with `{instruction, artifact}` on stdin. Read the one
  JSON line", the file's only `stdin` occurrence, and it is exactly the
  in-context assembly RES-03 removes; the `--payload <file>` form below takes its
  place, keeping "Read the one JSON line". Before the seam call, resolve the
  artifact into a temp file (redirect
  `git diff <base_ref>..<head_ref>` into it, or use the named file directly),
  then run a `node -e` one-liner that reads that file and writes the
  `{instruction, artifact}` JSON to a second temp file, redirecting both so no
  artifact bytes reach the transcript, and pass that second path as
  `--payload <file>` on the EXISTING `review-provider.mjs review` invocation -
  no new flag, no new subcommand. Add one clause that `assertUnderCap` measures
  the parsed `instruction` and `artifact` strings, which under `--payload` are
  exactly that file's contents, so `review.max_prompt_tokens` bounds the file
  (D-11), and that a non-string `artifact` is refused as `bad-payload` before
  the cap is consulted. Update the Wiring table's "Payload artifact" column to
  the reference forms: `plan` -> the PLAN file path(s); `diff` ->
  `{base_ref: <pre-plan HEAD>, head_ref: HEAD}`; `risk_surface` -> two cases in
  one clause, because that row governs four firing skills
  (`cad-execute`, `cad-debug`, `cad-task`, `cad-verify`) and only `cad-execute`
  has an executor checkpoint: the flagged-diff FILE the checkpoint named when the
  diff is staged and uncommitted inside an executor's worktree (`cad-execute`,
  D-09), and refs in the tree the reviewer inherits for the other three -
  `{base_ref, head_ref}` once the change is committed (`cad-task` fires on
  commits), the working-tree diff the reviewer runs itself when it is not
  (`cad-debug` fires on an applied, uncommitted fix), both resolvable because the
  reviewer inherits the FIRING cwd (D-15). That row DOCUMENTS those three sites;
  it does not edit them - `debug.md:104-105` and `task.md:71-73` name the trigger
  and pass no bytes today, and neither file's fire site is in this plan's scope.
  `phase_diff` ->
  `{base_ref: <PHASE_START>, head_ref: HEAD}`; `pre_ship` ->
  `{base_ref: <base>, head_ref: HEAD}`. In `cad-reviewer-contract`'s `<role>`,
  state that the artifact arrives as a reference - a `{base_ref, head_ref}` pair
  to resolve with `git diff` in the working tree you inherit, the uncommitted
  change in that same tree when the fire site names one, or a file path to
  read - and that a reviewer never asks for it to be pasted and never reviews a
  fragment; keep `<returns>`, `<guardrails>` and the read-only stance unchanged.
  Then close D-10's stale capture item: mark the `[high] The over-cap refusal is
  bypassable with a non-string payload field` bullet in `.planning/CAPTURE.md`
  as `[x]` with the evidence from the Verify below (both paid commands already
  refuse a non-string field as `bad-payload` before the cap, with a named test),
  and do NOT implement a second guard - `.planning/CAPTURE.md` is gitignored, so
  do not stage it. Regenerate the `skills/cad-reviewer-contract/SKILL.md` entry
  in `weight-budgets.json`; `cadence-core/references/` gets no entry (D-17).
- **Verify:** `node --test --test-name-pattern 'non-string payload'
  cadence-core/bin/review-provider.test.mjs` exits 0 with 1 test passing;
  `grep -n "base_ref" cadence-core/references/review-triggers.md` prints lines
  in § 2, § 4 and the Wiring table; `grep -n "as the payload\|as the artifact"
  cadence-core/references/review-triggers.md` prints no line that hands raw diff
  text to a reviewer; `grep -n "stdin" cadence-core/references/review-triggers.md`
  prints nothing (its single occurrence today is the cross-model bullet's
  payload-assembly clause this task replaces); and
  `node cadence-core/bin/self-verify.mjs` prints
  `"ok":true` (which also proves the `--payload` invocation uses only
  CONTRACTS-declared flags).

### Task 5: /cad-execute's fire sites hand references

- **Files:** cadence-core/workflows/execute.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Convert the four fire sites in `execute.md` to the reference form
  task 4 defined, changing no gate, no trigger and no triage behaviour. In
  `execute_sequential`, the per-plan `diff` fire passes
  `{base_ref: {pre-plan HEAD}, head_ref: HEAD}` instead of
  "`git diff {pre-plan HEAD}..HEAD` as the payload", and states in half a line
  that the workflow does not run `git diff` itself. In `execute_parallel` step
  5, each plan's concurrent `diff` fire passes
  `{base_ref: <that plan's recorded pre-merge HEAD>, head_ref: <its recorded
  post-merge HEAD>}` - the two short SHAs step 3 recorded as that plan's merge
  range - and never that plan's worktree branch, which step 4 deleted before this
  step runs; say in half a line that the SHAs are used because the branch no
  longer exists at this step, so a reviewer inheriting this cwd (D-15) gets refs
  that resolve. Write that half-line without spelling the branch pattern itself,
  so the check below reads as a clean removal. Keep the existing one-message
  concurrency rule and its wording intact. In step 6, `phase_diff` passes
  `{base_ref: {PHASE_START}, head_ref: HEAD}`. In `handle_checkpoint`, the
  `risk_surface` arm fires with the flagged-diff FILE the checkpoint named
  (absolute path) rather than "the flagged diff", and keeps its blocking
  behaviour word for word - a matched risk surface still halts and triage is
  still not an override for it. Do not touch the report-handling sentences task
  3 rewrote, and do not add a `git diff` invocation anywhere in this file.
  Regenerate this surface's `weight-budgets.json` entry in this task's commit.
- **Verify:** `grep -n "git diff" cadence-core/workflows/execute.md` prints
  nothing (the file's only two matches today, lines 147 and 206, are the two
  payload builders this task deletes); `grep -n "base_ref"
  cadence-core/workflows/execute.md` prints one line each in
  `execute_sequential`, `execute_parallel` step 5 and step 6, and the step-5 line
  names the recorded pre-merge/post-merge SHAs, with
  `grep -n "cadence/phase-" cadence-core/workflows/execute.md` printing only
  step 1's branch-naming line and no line in step 5;
  `grep -n "risk_surface" cadence-core/workflows/execute.md` shows the
  `handle_checkpoint` arm naming the file the checkpoint returned; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 6: /cad-task keeps the report its executor writes

- **Files:** cadence-core/workflows/task.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In `planned_path`, state what D-01's derivation produces for this
  command: when step 2's exception dispatches cad-executor instead of executing
  inline, that executor writes `.planning/tasks/{slug}/reports/plan-1.md`
  (derived from the plan file's own directory - no prompt field carries it), and
  step 3 reads that file ONCE to write the PLAN.md "Outcome" section rather than
  taking the detail from the executor's return. In step 4, add the report file
  to the `docs: task plan {slug}` commit's staged set when it exists, so a
  `/cad-task` report is tracked exactly as a phase report is. State the two
  boundaries in one clause each: the inline path dispatches no executor and so
  has no report, and a task run where `.planning/` does not exist writes no plan
  file and therefore no report either. Regenerate this surface's
  `weight-budgets.json` entry in this task's commit.
- **Verify:** `grep -n "reports/plan-1.md" cadence-core/workflows/task.md`
  prints lines in both step 3 and step 4 of `planned_path`; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 7: /cad-land's pre_ship fires on refs

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In step 3, replace "with the full branch diff
  `git diff <base>..HEAD` as the artifact" with the pair
  `{base_ref: <base>, head_ref: HEAD}`, noting in half a line that the reviewer
  resolves it in this tree (the refs are committed and local, so they resolve
  for a `claude-subagent` reviewer inheriting this cwd - D-15). Change nothing
  else in the step: the re-fire limit of one per run, the triage-then-publish
  ordering, the `git.auto_close` carve-out and the `land-cleanup.mjs gate` halt
  all stay exactly as written. Regenerate this surface's `weight-budgets.json`
  entry in this task's commit.
- **Verify:** `grep -n "git diff <base>..HEAD" skills/cad-land/SKILL.md` prints
  nothing; `grep -n "base_ref" skills/cad-land/SKILL.md` prints the step-3 line;
  and `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 8: Restore the diff gate the config had drifted back to

- **Files:** .planning/config.json
- **Action:** Remove the `review.triggers.diff.gate: "adjudicated"` entry from
  `.planning/config.json`, and with it the now-empty `triggers` and `diff`
  objects, leaving the rest of the `review` block (`request_timeout_ms`,
  `consult`, `providers`) byte-identical (D-18). This restores the decision
  `.planning/CAPTURE.md` records as taken on 2026-08-01 - the key was removed
  and the `diff` trigger runs at `critical`'s `blocking` - which the shipped
  config had drifted back from, and it stops `route.mjs resolve` emitting a
  gate-disagreement warning on every dispatch. Do not touch the user-global
  layer at `~/.claude/cadence/config.json`: it carries no `review.triggers` key
  (verified during planning) and a plugin never writes a user's global settings.
- **Verify:** `node cadence-core/bin/route.mjs resolve --role cad-executor
  --phase 1` prints `"diff":"blocking"` inside `review` and no `warnings` key at
  all; and `node cadence-core/bin/config.mjs validate` prints `"ok":true`.

## Notes

- **Plan-shape deviation (recorded, not silent).** CONTEXT's `Plan shape`
  directive asks for three plans split RES-01 / RES-02 / RES-03+04. File
  analysis refuses the RES-01 / RES-03 boundary: both requirements edit
  `cadence-core/workflows/execute.md` (report handling and the `diff`,
  `phase_diff` and `risk_surface` fire sites live in the same steps) and both
  edit `skills/cad-executor-contract/SKILL.md` (the report block and the
  `risk_surface` checkpoint that D-09 turns into a file). Two plans editing the
  same steps of the same file is the shared-file case the planner contract
  forbids, so RES-01, RES-03 and RES-04 are one plan here and RES-02 is
  `PLAN-2.md`. The two plans still share exactly one file,
  `cadence-core/bin/weight-budgets.json`, because D-17 requires the budget
  manifest to regenerate in the same commit as each prose edit and both plans
  edit budgeted surfaces. `plan-overlap` will therefore report that overlap and
  `/cad-execute` will run the phase SEQUENTIALLY - which is correct and
  expected: the split buys a fresh executor context per seam and independent
  verifiability, not parallelism.
- **D-13 digest, two fields beyond the letter (recorded).** D-13 and ROADMAP AC1
  name the digest as "status, task count, commit range, deviation count and
  open-item count". Task 2 specifies those five PLUS the plan file and the report
  path. The plan file is already in today's return and disambiguates which plan a
  report belongs to on the parallel path; the report path is the continuation's
  handle, and D-01 makes it derivable from the plan file, so an implementation
  that returns only the plan file also satisfies task 2. Neither field carries
  task, deviation or open-item TEXT, which is what D-13's "only" is protecting.
  Recorded here so `/cad-verify 1` reads AC1 against this, not against a literal
  five-field count.
- Recalled prior art: the CAPTURE.md entry confirming executor reports stay
  resident (`workflows/execute.md` `execute_sequential` "collect its report" plus
  `summary`) and naming the `partial`/`timeout` re-run hazard is what tasks 2 and
  3 close; the v1.4.0 phase-2 finding that a `blocked` worktree halt has no
  described remedy is deliberately NOT addressed here - it is a different defect
  in the same step and belongs to its own phase.
- Hazards for the executor: (1) `self-verify.mjs` check 10 lints
  `cadence-core/workflows/` and `cadence-core/references/` for dispatch phrasing,
  so a new sentence pairing a clause-initial imperative dispatch verb with
  "concurrent"/"parallel" fails CI even when the prose is right; (2) every prose
  surface here sits exactly at its byte budget, so an edit without the budget
  regeneration in the same commit fails `self-verify` with `budget-overrun`;
  (3) `cadence-core/references/**` has no budget entry and must not gain one in
  this phase.
- AC2 and AC3 are `human-verify` in CONTEXT (both need a live cad-executor
  dispatch). Tasks 2 and 3 make them true; proving them end to end belongs to
  `/cad-verify 1`'s walk, not to a command this plan can run.
