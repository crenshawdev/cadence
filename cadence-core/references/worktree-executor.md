# Worktree-mode rules for a plan executor

Read at `<worktree_mode>` in `skills/cad-executor-contract`, and only when the
dispatch prompt says worktree mode. Every rule below is in force for the whole
dispatch; none of them applies on the sequential path.

- Before task 1 - before any implementation, and certainly before any commit -
  confirm your own `PLAN.md` / `PLAN-<k>.md`, the plan file named in your
  dispatch prompt, exists at that path relative to the worktree cwd. Missing
  -> HALT and return a `blocked` checkpoint naming the missing PLAN path and
  the worktree's `git rev-parse --short HEAD`; repair nothing yourself.
  Reason: the fork point comes from the host's `worktree.baseRef` setting,
  not from Cadence (`references/seam-spawn-agent.md`), and under its
  `fresh` default a worktree branches from the remote default branch,
  missing this phase's plans and CONTEXT entirely - three phase-4 executors
  hit exactly that (`.planning/CAPTURE.md:5`). A setting the user can change
  back is not a guarantee: assert anyway.
- Before EVERY commit, verify `git branch --show-current` is your assigned
  branch and not a protected one. Mismatch -> HALT and return a `blocked`
  checkpoint. Never repair refs yourself.
- Stay inside the worktree path; keep every file operation within it.
- Commit the report file on EVERY return that ends your turn - `PLAN COMPLETE`,
  `PLAN PARTIAL` and any CHECKPOINT, not only after the last task. Write it
  first, then STAGE those exact paths and commit them by PATHSPEC, naming the
  rotated report too whenever your first write rotated a previous run's aside -
  unnamed it stays untracked, never reaches the branch, and dies with the
  worktree, which is the evidence the rotation exists to keep:
  `git add <plandir>/reports/plan-<k>.md [<plandir>/reports/plan-<k>.<n>.md]`
  then
  `git commit -- <plandir>/reports/plan-<k>.md [<plandir>/reports/plan-<k>.<n>.md]`
  with message `docs({phase}-{plan}): plan {k} executor report`. All three parts
  are load-bearing. The `add` is not optional: `git commit -- <pathspec>` commits
  only paths git already TRACKS, so an untracked report - every rotated
  `plan-<k>.<n>.md`, and a first run's `plan-<k>.md` on a path not yet in history
  - aborts the entire commit with `did not match any file(s) known to git`. The
  pathspec keeps a guardrail intact: a `risk_surface`
  checkpoint deliberately leaves the flagged changes STAGED, and a bare
  `git commit` after a broad `git add` would sweep them in - turning a blocking
  gate into a landed commit. Naming the paths commits the reports and leaves
  everything else staged exactly as it was; the enclosing `<plandir>/reports/`
  directory is NOT a path you may `add` or commit here, because the flagged diff
  below lives inside it - which is why the `add` names the same exact paths the
  commit does. Committing on the non-final branches is what makes the report
  survive at all: a partial or checkpointed
  worktree is the one most likely to be removed or abandoned before you are
  dispatched again, and an uncommitted report dies with it - the re-run hazard
  the file exists to prevent. NEVER commit `plan-<k>-risk-task-<n>.diff`: it
  is the flagged staged diff itself and must not reach history, but do not leave it
  behind either - the continuation deletes it as its first act, and
  `git worktree remove` refuses a worktree holding untracked files.
- Never `git stash` (the stash is shared across worktrees), never
  `git clean`, never blanket `git reset --hard` or `git restore .`, and
  never `git merge`, `git rebase` or `git fetch` - reconciling a stale
  worktree is the orchestrator's serialized decision (the merge step of
  `references/execute-parallel.md` merges one at a time with a user stop on
  conflict), and N executors merging concurrently on their own has no
  conflict policy at all. To discard one file you changed:
  `git checkout -- path/to/file`.
