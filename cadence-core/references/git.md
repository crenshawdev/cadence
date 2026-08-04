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

Cadence issues no `git worktree add` anywhere in its own code, so it pins no
fork point per dispatch; the host does, from the user's `worktree.baseRef`
setting - `fresh` (the default) forks from the remote default branch and drops
unpushed work, `head` forks from the local `HEAD` (`references/seams.md`,
spawn-agent, Worktree isolation; Claude Code >= 2.1.208). `git.base_branch`
stays the landing and guard base, distinct from the integration branch: the
integration branch is what work merges back down to, not a claimed worktree
fork point. Under `fresh` a worktree can be missing a phase's plans and CONTEXT
entirely - which is why `workflows/execute.md`'s `choose_path` refuses the
parallel path unless `worktree.baseRef` is `head`, and why
`skills/cad-executor-contract/SKILL.md`'s worktree mode asserts its own plan file before task
1 anyway rather than assuming the fork point.

## 2. Atomic conventional commits

One logical change per commit: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
`test:`, `perf:`, `style:`. Stage the specific files you changed, not `git add -A`. Planning docs
commit separately from code (`docs:` prefix) when `planning.commit_docs` is true.

## 3. Never auto-push

No workflow pushes, ever. Publishing is a human decision made through
`/cad-land`, which reports git state and asks the mechanism (direct push /
MR or PR / tag / leave local) with NO preselected default.

`git.auto_close` (default off) is the single sanctioned opt-in to that ask: it
lets `/cad-land` complete the close unattended, landing the integration branch
on base via a host-CLI PR/MR **merge** on the platform (`gh pr merge` /
`glab mr merge`). That platform merge is not a `git push`. On the GitHub arm the
local-only integration branch is first published by the git-publish seam - one
sanctioned push of the current non-protected branch, run as a subprocess so the
Bash `git push` guard never sees it and there is no prompt. The seam refuses
unless repo `git.auto_close` is true and HEAD is a non-protected branch, and it
pushes exactly that branch to a configured bare-name remote. Every Bash
`git push` the guard sees still asks unconditionally (git-guard now carries NO
push exemption); the git-publish seam is the one code-guarded exception, invoked
only by cad-land, so the never-auto-push rule and the no-preselected-default
posture both still hold. On GitLab `glab mr create` publishes the source branch
itself. A blocking `pre_ship` finding still halts the chain before merge.

After a land/merge actually lands on this machine, `git.on_land_cleanup`
(default on) returns HEAD to the base, pulls, and reaps the merged integration
branch locally - advised by the `land-cleanup.mjs cleanup` seam, which reaps
only when `git branch --merged <base>` confirms the branch is merged, and never
via a remote-tracking delete (that would trip the push guard).

### What the guard sees

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

### What the guard does NOT see (rail 3)

v2.2.0 deleted an 840-line shell tokenizer and a 367-line model of git's option
grammar. The bet behind them was sound in kind - a widener is safe to be wrong -
but the price was not. The escape surface behind `bash -c`, `$(...)`, `${...}`,
aliases and `ssh` is unbounded, so three consecutive blocking review panels each
found new holes and each patch bought more grammar, and the reader still went
silent on `git switch -f main`. Then the scan turned out to be O(K x N) in
memory: 3.1GB at 224KB of input, a V8 abort at 280KB, in a hook that runs on
every Bash call and fails OPEN. A long enough command line switched the guard
off entirely and let the push inside it run unprompted.

So these shapes really can run git and are now invisible. Each is a pinned test
row in `cadence-core/bin/git-segments.test.mjs` and
`cadence-core/bin/git-guard.test.mjs`, not an absence:

| Shape | Why it is silent |
|---|---|
| Shell wrappers (`bash -c "git push"`, `sh -c`, `zsh`, `dash`, `eval`) | The command word is the wrapper, not `git`. Operands are not re-tokenized. |
| Command substitution and subshells (`$(git push)`, `` `git push` ``, `(git push)`) | The command word is `$(git`, `` `git `` or `(git`, none of which is a git word. Regions are not descended into. |
| Transparent prefixes (`sudo git push`, `timeout 60 git push`, `nice`, `xargs git push`, `VAR=x git push`) | The command word is the prefix. There is no prefix set to enumerate, which is the point: every prefix carries its own option grammar and that enumeration never closed. |
| `env -S "git push origin main"` | The command word is `env`. Its option region is not walked. |
| A quoted path with a space (`git -C "my repo" push origin main`) | Quoting is not tracked, so `-C` consumes `"my` and the verb reads as `repo"`. |
| Line continuation (`git \` + newline + `push origin main`) | The newline is a separator; neither half is a `git` segment with a verb. |
| Remote execution (`ssh host "git push origin main"`) | The command word is `ssh`, and it pushes from another machine anyway, which is outside what a local rail can see. |
| Heredocs, herestrings, `${...}` expansion, brace expansion, `$'...'` escapes, aliases and shell functions, variable indirection (`CMD="git push"; $CMD`) | Nothing is expanded and no body is read as commands. These were out of grammar for the tokenizer too. |

The trade, stated plainly: the guard now catches the shapes a model actually
writes when it is doing its job, and misses the shapes it would have to be
deliberately routing around. The adversary here is the model issuing the
command, not an attacker, and a rail that costs a prompt when it fires is not
worth an unbounded parser to make exhaustive.

## 4. Risk surfaces

At commit time, if the diff matches a risk surface (list in
references/review-triggers.md), fire the `risk_surface` review trigger before
landing the commit.
