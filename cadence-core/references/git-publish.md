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
other: under `git.auto_close`, `/cad-land` 3(b) publishes the branch and opens
and merges its request through `git-publish.mjs publish`, `open` and `merge`.
Any other publishing is a human decision made through `/cad-land`.

A Bash `git push` the guard sees asks when it can reach a protected branch
(`git.protected_branches`): a refspec naming one (`main`, `heads/main`,
`refs/heads/main`, or `HEAD` with it checked out), `--all`, `--branches` or
`--mirror`, or no refspec while one is checked out. It stays quiet only when what
it reads is what git will run, so it also asks on a word the shell can change (a
quote, `$`, a glob), a global option other than a plain `-C`, a command before it
in the same call other than git `add`, `commit`, `status`, `diff`, `log`, `show`,
`tag`, `fetch` or `pull`, and, where git config picks the destination, a
`remote.<name>.push` or `.mirror` or a `push.default` other than `simple`,
`current` or `nothing`. A torn config layer asks on every push. Any other push, a
work branch or a tag, goes through. Only `git.guard_bypass` true in both config
layers turns the rail off.

### What the guard does NOT see (rail 3)

These shapes can run git and the guard doesn't see them:

| Shape | Why it is silent |
|---|---|
| Shell wrappers (`bash -c "git push"`, `sh -c`, `zsh`, `dash`, `eval`) | The command word is the wrapper, not `git`. Operands are not re-tokenized. |
| Command substitution and subshells (`$(git push)`, `` `git push` ``, `(git push)`) | The command word is `$(git`, `` `git `` or `(git`, none of which is a git word. Regions are not descended into. |
| Transparent prefixes (`sudo git push`, `timeout 60 git push`, `nice`, `xargs git push`, `VAR=x git push`) | The command word is the prefix. There is no prefix set to enumerate, which is the point: every prefix carries its own option grammar and that enumeration never closed. |
| `env -S "git push origin main"` | The command word is `env`. Its option region is not walked. |
| A quoted path with a space (`git -C "my repo" push origin main`) | Quoting is not tracked, so `-C` consumes `"my` and the verb reads as `repo"`. |
| Line continuation (`git \` + newline + `push origin main`) | The newline is a separator; neither half is a `git` segment with a verb. |
| Remote execution (`ssh host "git push origin main"`) | The command word is `ssh`, and it pushes from another machine anyway, which is outside what a local rail can see. |
| Heredocs, herestrings, `${...}` expansion, brace expansion, `$'...'` escapes, aliases and shell functions, variable indirection (`CMD="git push"; $CMD`) | Nothing is expanded and no body is read as commands. |
