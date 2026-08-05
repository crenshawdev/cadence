# Git rails: the guard

The commit-side rails. Rail 3 (never auto-push, and what the guard
consequently does NOT see) lives in `references/git-publish.md`.

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

**Integration branch (before the first commit, once per cycle).** After the
guards above pass, decide whether this cycle runs on a per-milestone
integration branch. Ask the seam - it only advises, it never checks out:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" decide
```

Act on its `action`:

- `create` -> `git checkout -b <branch>` and continue on it. `<branch>` is the
  seam's `branch` field: the per-milestone integration branch (e.g.
  `cadence/v1.1.0-rc.2`, derived from `PROJECT.md`'s `### Active` milestone,
  falling back to the `ROADMAP.md` title). Guard: never run `checkout -b` with an
  empty/null `branch` - the seam already downgrades an unnameable branch to
  `ask`, so treat any `create` with a null `branch` as a naming problem too.
- `ask` -> prompt once via the ask-user seam, no preselected default. When
  `branch` is named: create the named integration branch / stay on the base /
  abort. When `branch` is null (no version derivable - the seam's
  naming-problem `ask`): tell the user no milestone version was found in
  `PROJECT.md`'s `### Active` or the `ROADMAP.md` title, and offer to set the
  version / stay on the base / abort - never invent a name.
- `stay` -> do nothing (already off the base, or the mode says not to).

`git.integration_branch` picks the model. `milestone` creates the integration
branch: the integration branch is what parallel worktree branches merge back
into; where they fork FROM is the host's `worktree.baseRef`. It keeps
merge churn off `main`. `trunk` creates nothing - commits land on the base,
still governed by `git.on_protected` (git-guard.mjs unchanged). `git.auto_branch`
picks how it is created at cycle start: `ask` prompts once, `auto` creates and
switches silently, `off` stays put. Creation is lazy and once per cycle - the
seam infers it from HEAD sitting on a protected base, so later phases already
off the base pass silently.

## 2. Atomic conventional commits

One logical change per commit: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
`test:`, `perf:`, `style:`. Stage the specific files you changed, not `git add -A`. Planning docs
commit separately from code (`docs:` prefix) when `planning.commit_docs` is true.

## What the guard sees

One grammar, governing the commit rail here and the push rail in
`references/git-publish.md`.

Both rails read one function (`cadence-core/bin/lib/git-segments.mjs`), so they
always agree on what a command IS. It is about thirty lines, and it reads one
thing: **a segment counts only when its COMMAND WORD is `git`, and the verb is
its first non-flag word.** Segments split on `;`, a newline, `|`, `||`, `&&` and
`&`. The seven git global options that take a separate argument (`-C`, `-c`,
`--git-dir`, `--work-tree`, `--namespace`, `--exec-path`, `--config-env`) are
skipped WITH that argument, which is the only reason the scan looks past a flag
at all. Nothing else is inferred. That is the entire grammar.

It is a **detection widener, not a security boundary**: being wrong here costs a
prompt, never a bypass, and the sanctioned publish never reaches this hook at
all (it runs through the git-publish seam as a subprocess). The reader is total
and linear, because it runs on every Bash tool call and a guard that stalls or
aborts is worse than one that misses.

The anchor is also why there is no deny gate any more. Detection used to be
any-position, so `rg -t sh "git commit"` was read as a commit, so refusal had to
be narrowed back to command position by a second rule with an enumerated prefix
set. Reading only the command word makes those shapes silent up front:
`rg -n "git push" .`, `grep git commit`, `command -v git commit` and
`echo "git commit"` produce no decision at all, rather than a decision that then
has to be gated back down. One rule where there were two, and nothing to
enumerate.

## 4. Risk surfaces

At commit time, if the diff matches a risk surface (list in
references/review-triggers.md), fire the `risk_surface` review trigger before
landing the commit.
