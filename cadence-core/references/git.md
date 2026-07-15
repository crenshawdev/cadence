# Git model

The four rails. Every workflow that touches git follows these.

## 1. Protected-branch guard (before the FIRST commit of any task/phase)

Read `git.protected_branches` and `git.on_protected` from config
(defaults: `["main", "master"]`, `ask`). If `git branch --show-current` is in
the protected list:

- `ask` (default) -> ask the user (ask-user seam), no preselected default:
  1. Create and switch to a work branch (suggest a name from the task/phase slug)
  2. Proceed on this branch anyway
  3. Abort
- `refuse` -> stop with a one-line explanation.
- `allow` -> proceed silently.

Never auto-create a branch without asking. Never commit to a protected branch
unless the user chose to.

**Base integrity (same check, before the first commit).** The guard above
stops you committing *on* a protected branch; this stops work drifting away
from one. Let `base` = `git.base_branch` if set, else the first name in
`git.protected_branches` that resolves as a local branch
(`git rev-parse --verify refs/heads/<name>` - verify the branch ref, since a
bare name would also match a tag):

- `git branch --show-current` is empty (detached HEAD) -> ask (ask-user
  seam) before committing, regardless of the rest.
- `git.base_branch` is set but does not resolve as a branch -> surface a
  base-branch configuration problem and ask; never fall back silently.
- `base` resolves but shares NO history with HEAD (`git merge-base <base>
  HEAD` is empty) -> the branch is on an unrelated line, the no-main drift
  this guards against. Ask before committing; do not proceed silently.
  (Emptiness, not `--is-ancestor`: a normal branch whose `base` has simply
  moved ahead still shares a merge-base and must pass.)
- No configured or protected base resolves at all -> treat the base as
  unknown: note the possible no-main drift and ask whether to set
  `git.base_branch` / `git.protected_branches` or continue.
  `/cad-new-project` on a fresh repo is the expected exception.

A `base` that resolves and shares a merge-base with HEAD -> silent pass.

## 2. Atomic conventional commits

One logical change per commit: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
`test:`. Stage the specific files you changed, not `git add -A`. Planning docs
commit separately from code (`docs:` prefix) when `planning.commit_docs` is true.

## 3. Never auto-push

No workflow pushes, ever. Publishing is a human decision made through
`/cad-land`, which reports git state and asks the mechanism (direct push /
MR or PR / tag / leave local) with NO preselected default.

## 4. Risk surfaces

At commit time, if the diff matches a risk surface (list in
references/review-triggers.md), fire the `risk_surface` review trigger before
landing the commit.
