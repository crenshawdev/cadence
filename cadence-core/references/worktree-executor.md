# Worktree-mode rules for a plan executor

Read at `<worktree_mode>` in `skills/cad-executor-contract`, and only when the
dispatch prompt says worktree mode. Every rule below holds for the whole
dispatch; none applies on the sequential path.

- Before task 1, before any implementation or commit, confirm the plan file
  your dispatch prompt names (`PLAN.md` / `PLAN-<k>.md`) exists at that path
  relative to the worktree cwd. Missing -> HALT and return a `blocked`
  checkpoint naming the missing PLAN path and the worktree's
  `git rev-parse --short HEAD`; repair nothing yourself. The fork point is the
  host's `worktree.baseRef`, whose `fresh` value branches from the remote
  default branch without this phase's plans, and the user can change it back:
  assert anyway.
- Before EVERY commit, verify `git branch --show-current` is your assigned
  branch and not a protected one. Mismatch -> HALT and return a `blocked`
  checkpoint. Never repair refs yourself.
- Stay inside the worktree path; keep every file operation within it.
- On EVERY return that ends your turn - `PLAN COMPLETE`, `PLAN PARTIAL` and any
  CHECKPOINT - write the report file, then commit it, since an uncommitted
  report dies with the worktree. `add` and commit the same exact paths, naming
  the rotated report too whenever your first write rotated a previous run's
  aside:
  `git add <plandir>/records/reports/plan-<k>.md [<plandir>/records/reports/plan-<k>.<n>.md]`
  then
  `git commit -- <plandir>/records/reports/plan-<k>.md [<plandir>/records/reports/plan-<k>.<n>.md]`
  with message `docs({phase}-{plan}): plan {k} executor report`. Never skip the
  `add`: `git commit -- <pathspec>` aborts on an untracked path. Never `add` or
  commit the enclosing `<plandir>/records/reports/` directory, so anything else
  staged stays out of the report commit.
- Never `git stash` (the stash is shared across worktrees), never
  `git clean`, never blanket `git reset --hard` or `git restore .`, and
  never `git merge`, `git rebase` or `git fetch` - reconciling a stale
  worktree is the orchestrator's serialized merge. To discard one file you
  changed: `git checkout -- path/to/file`.

## Workflow arm

Only when the mode line reads exactly "Workflow worktree executor on branch
`cadence/phase-<N>-plan-<k>` - worktree mode, workflow rules apply." (today's
line is "Worktree executor on branch {branch} - worktree rules apply."). The
branch and git-verb bullets above stand. These replace the plan check,
stay-inside and report bullets, since the worktree may lack an ignored
`.planning/`:

- Plan check: confirm the brief and the plan file it names at their ABSOLUTE
  paths outside the worktree, never relative to it. Missing -> HALT `blocked`
  naming the path.
- Branch, before anything else: create `cadence/phase-<N>-plan-<k>` from the
  worktree's HEAD and work on it, so the per-commit branch check holds that
  name. Already the current branch -> the host restarted you in this worktree,
  go on. Exists but is not current -> HALT `blocked` naming it and its head;
  never delete, reset or force it, since a resumed plan's earlier work may be
  on it.
- Lease: `lease-check` with `--dir <main tree>/.planning`.
- One plain command per Bash call. The host refuses a command that leaves the
  worktree, chains a git verb with anything else, writes a file through a
  heredoc, or names the main checkout, and each refusal costs a turn. Read a
  file outside the worktree with the Read tool, and write a file, the report
  included, with the Write tool.
- Staying inside: every file operation stays in the worktree, except reading
  the files the prompt and the brief name outside it, and writing your report
  at the path the prompt names, and its `plan-<k>.<n>.md` sibling when it
  rotates, in the run's scratch directory. Never write into the main tree; the
  host refuses it.
- Report: it goes to the path the prompt names, in place of
  `<plandir>/records/reports/plan-<k>.md`, and you NEVER commit it. Write its
  first line as your contract says, `PLAN COMPLETE` included: the main session
  moves it into the main tree only after it has merged your branch.
