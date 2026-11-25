# Git rails: the guard

The commit-side rails. Rail 3 (never auto-push, and what the guard does NOT
see) is in `references/git-publish.md`. The one grammar both rails read is in
`docs/INTERNALS.md`'s push-guard section.

## 1. Protected-branch guard (before the FIRST commit of any task/phase)

Read `git.protected_branches` and `git.on_protected` from config
(defaults: `["main", "master"]`, `ask`). If `git branch --show-current` is in
the protected list:

- `ask` (default) -> ask the user (ask-user seam), no preselected default,
  filling in the branch and a suggested name from the task/phase slug, or on an
  agile project the release's branch, from **Integration branch** below:

  - header: "Branch"
  - question: "You're on {branch}, a protected branch. Cadence won't commit there unless you say so. What do you want to do?"
  - options:
    - "Make a new branch - create a work branch named {suggested name} and switch to it"
    - "Commit here anyway - the commits go on {branch}"
    - "Stop - nothing is committed"
- `refuse` -> stop with a one-line explanation.
- `allow` -> proceed silently.

Never auto-create a branch without asking. Never commit to a protected branch
unless the user chose to.

**Base integrity (same check, before the first commit).** This stops work
drifting away from a protected branch. Let `base` = `git.base_branch` if set,
else the first name in `git.protected_branches` that resolves as a local branch
(`git rev-parse --verify refs/heads/<name>`, since a bare name also matches a
tag):

- `git branch --show-current` is empty (detached HEAD) -> ask (ask-user
  seam) before committing, regardless of the rest.
- `git.base_branch` is set but does not resolve as a branch -> surface a
  base-branch configuration problem and ask; never fall back silently.
- `base` resolves but `git merge-base <base> HEAD` is empty -> the branch is
  on an unrelated line (no-main drift). Ask before committing. Test emptiness,
  not `--is-ancestor`: a branch whose `base` moved ahead still shares a
  merge-base and passes.
- No configured or protected base resolves -> the base is unknown: note the
  possible no-main drift and ask whether to set `git.base_branch` /
  `git.protected_branches` or continue. `/cad-new-project` on a fresh repo and
  `/cad-adopt`, which commits its scaffolding under this guard, are the
  expected exceptions.

A `base` that resolves and shares a merge-base with HEAD -> silent pass.

**Integration branch (before the first commit, once per cycle).** After the
guards above pass, ask the seam whether this cycle runs on a per-milestone
integration branch. It only advises, it never checks out:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" decide
```

Relay the envelope's `warnings[]` to the user before acting: a config layer
that did not parse means the advice came from DEFAULTS, not the user's settings.

On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't) run it before the guard's question and suggest its `branch` there. Null
-> say its `reason` and suggest the slug, or with no slug let the user type the
name. Act on its `action` only when that question wasn't asked, and switch to a
branch that already exists.

Act on its `action`:

- `create` -> `git checkout -b <branch>` and continue on it. `<branch>` is the
  seam's `branch` field: `git.integration_branch_name` if set (e.g.
  `seldon/hardin`), else `cadence/<version>` (e.g. `cadence/v1.1.0-rc.2`) from
  `PROJECT.md`'s `### Active` milestone, falling back to the `ROADMAP.md`
  title, or on an agile project `cadence/` and the release's name. A configured
  name that fails its grammar comes back as `ask`, never `create`. Never run
  `checkout -b` with an empty/null `branch`: treat a `create` with a null
  `branch` as a naming problem too.
- `ask` -> prompt once via the ask-user seam, no preselected default. With
  `branch` named: create it / stay on the base / abort. With `branch` null:
  tell the user no milestone version was found in `PROJECT.md`'s `### Active`
  or the `ROADMAP.md` title, and offer to set the version / stay on the base /
  abort - never invent a name. On an agile project, tell them the `reason` and
  offer the last two.
- `stay` -> do nothing.

`git.integration_branch` picks the model. `milestone` creates the integration
branch, which parallel worktree branches merge back into (they fork FROM the
host's `worktree.baseRef`), keeping merge churn off `main`. `trunk` creates
nothing: commits land on the base, still under `git.on_protected`
(`git-guard.mjs`). `git.auto_branch` picks how it is created: `ask` prompts
once, `auto` creates and switches silently, `off` stays put. The seam creates
lazily, once per cycle, from HEAD sitting on a protected base, so later phases
already off the base pass silently.

## 2. Atomic conventional commits

One logical change per commit: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
`test:`, `perf:`, `style:`. Stage the specific files you changed, not `git add -A`.
Planning docs commit separately from code (`docs:` prefix) when
`planning.commit_docs` is true. A commit that carries `STATE.md`, the
`## Phases` list or the `## Traceability` table carries
`.planning/records/state.json` with it.

**The one migration commit.** When the seam call that converts an unstamped
project answers `migration` with `commit_due: true`, stage the planning
directory and make one `docs:` commit with Bash before the next step, under the
guard in section 1, and push nothing. With `commit_due: false`, make no commit.
The script never commits. Staging the whole directory is the one exception to
staging specific files, so the commit leaves the tree clean and takes in any
other uncommitted change under the planning directory. Carried risk rulings stay
out, because the records folder's own `.gitignore` ignores `risk-carry/`.

## 4. Risk surfaces

Detection is the seam's `risk-check run` (references/risk-surface.md), never a
reading of the diff against a list at commit time. `/cad-execute` and
`/cad-task` run it over the range a plan or task committed, after its commits.
`/cad-debug`'s fix and `/cad-verify`'s Apply-now fix run it with
`--base HEAD --staged` before theirs. A match fires the `risk_surface` review
trigger, `blocking` by default. RE-READ
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before the fix
that clears it lands: its re-arm rule lives only there, and no caller of this
file preloads it.
