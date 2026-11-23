# Git rails: publishing

Rails 1, 2 and 4 live in `references/git-guard.md`. The grammar whose
complement this file's silences are is in `docs/INTERNALS.md`'s push-guard section.

## 3. Never auto-push

No workflow pushes on its own, with two cases. One: under an accepted testing
policy `/cad-verify` pushes a non-protected branch so CI can run on it, through
`git-publish.mjs verify-publish`, and only when this repository's own
`.git/config` holds `cadence.publishForVerification` as true
(set by `/cad-config --testing` on an explicit yes). Nothing else authorizes it:
not the user-global config, `.planning/config.json` or `git.auto_close`. The
other: under `git.auto_close`, `/cad-land` 3(b) publishes the branch. Any other
publishing is a human decision made through `/cad-land`.

Every Bash `git push` the guard sees asks, with no per-push exemption; only
`git.guard_bypass` true in both config layers turns the rail off.

### What the guard does NOT see (rail 3)

v2.2.0 deleted an 840-line shell tokenizer and a 367-line model of git's option
grammar. Their escape surface never closed, and their O(K x N) scan aborted V8
in a hook that runs on every Bash call and fails OPEN, so a long enough command
line switched the guard off.

So these shapes really can run git and are now invisible. Each is a pinned test
row in `git-segments.test.mjs` and
`git-guard.test.mjs` (cadence-tests repository), not an absence:

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
