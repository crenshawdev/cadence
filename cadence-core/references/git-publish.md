# Git rails: publishing

Rails 1, 2 and 4 - and the `What the guard sees` grammar whose complement
this file's silences are - live in `references/git-guard.md`.

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
