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
`agents/cad-executor.md`'s worktree mode asserts its own plan file before task
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

Both rails read one left-to-right tokenizer
(`cadence-core/bin/lib/shell-tokens.mjs`), so they always agree on what a
command IS. What follows is the grammar it implements. It is a **detection
widener, not a security boundary**: being wrong here costs a prompt, never a
bypass, and the sanctioned publish never reaches this hook at all (it runs
through the git-publish seam as a subprocess). Anything a determined command
can hide from a reader of the string, it hides from this too.

**Words and quoting.** One pass carries one quote state (outside / single /
double). A quoted span is word CONTENT, never stripped: `git -C "my repo" push
origin main` keeps its word boundaries and reads `push`, and an empty quoted
span (`git -C "" push`) is still a word. Single quotes honor no escapes. Double
quotes honor a backslash before `"`, `` ` ``, `\`, `$` and a newline only; any
other backslash is a literal backslash plus the following character. Outside
quotes a backslash escapes the next character, which can then never be read as
a separator, quote or region opener, and backslash-newline (or backslash-CRLF)
is a line continuation. Parity follows from that rule rather than from a
pre-pass: an ODD trailing run of backslashes continues the line, an EVEN run is
a literal backslash and the newline still separates.

**Separators.** `;`, a newline, `|`, `||`, `&&` and `&` each end a simple
command. A `#` that OPENS a word is a comment to end of line, and that newline
still separates, so `git add . # git push` is one `add`; a `#` inside a word
(`file#1`) is ordinary content.

**Regions.** `$(...)`, backticks and a `(` in command position are descended
into as their own command lists, so `$(git push)`, `` `git push` ``,
`(git push origin main)` and `( git push )` all read alike. `<(...)` and
`>(...)` process substitutions are descended into as well. A region
contributes no CONTENT to the enclosing word, but it does leave an empty
placeholder WORD in its place rather than deleting the word - the word COUNT
is what the rules around it depend on. `git -C $(pwd) push origin main` reads
`push` because the placeholder is what `-C` consumes, and a `#` glued onto a
region (`echo hi $(echo)#x; git push origin main`) is mid-word content rather
than a comment, because the region left the word started. `$'...'` is a single-quoted span with the `$` dropped, and `$"..."` a
double-quoted span with the `$` dropped, because that is how bash evaluates
them.

**Redirection.** `<` and `>` are word BOUNDARIES, not word characters, and the
operator absorbs a leading all-digit fd and a trailing `&` (`2>&1`), so
`git push>/tmp/out` and `git 2>out push origin main` both still read `push`.
The target word that follows is DROPPED, the way the shell removes a
redirection from the word list - but the dropped word is still read for a
`git` token, because for a redirect-fed wrapper (`bash <<< "git push origin
main"`) it is the only evidence there is.

**Wrappers.** The stated set is `bash`, `sh`, `zsh`, `dash` and `eval`, matched
on a word equal to a member or ending in `/` plus a member (`/bin/bash`
counts). It is matched AT ANY POSITION in a simple command, which covers
`sudo bash -c ...`, `timeout 60 bash -c ...`, `nohup`, `xargs`, an `env` or
`/usr/bin/env` prefix and `VAR=value` prefixes with one rule instead of a
second enumerated prefix set. Every operand that is not a genuine flag cluster
(`-c`, `-lc`, `-exc` - tolerated rather than enumerated) is re-tokenized. A
`-`-leading operand that is NOT a flag cluster is a payload, read whole and
again with its leading flag letters stripped, so `bash -c "-n; git push origin
main"` and the glued `bash -c"git push origin main"` are both seen. `eval`'s
operands are CONCATENATED with a space before re-tokenization, because that is
what the shell executes: `eval "git" "push origin main"` is a real push. A
matched wrapper with NO operand at all is being fed by a pipe, a heredoc or a
redirect (`echo "git push origin main" | bash`); there the whole original
command text is read for a `git` token and the guard asks. No pipeline
data-flow analysis is attempted.

**`env`.** GNU `env -S` / `--split-string` splits its operand and executes it,
so that operand is a command line rather than an argument: `env -S "git push
origin main"` really pushes, and it is re-tokenized like a wrapper operand.
Finding it means walking env's whole option region rather than stopping at the
first non-flag word, so the options that take a SEPARATE argument (`-a` /
`--argv0`, `-u` / `--unset`, `-C` / `--chdir`, and `-S` itself) are skipped
WITH that argument: stopping early is what made `env -u HOME -S "git push
origin main"` silent. A short cluster is walked letter by letter, because `-S`
is an option wherever it sits in one (`env -iS "git push origin main"`), and
the argument of an arg-taking letter is the rest of its cluster when there is
one and the next word otherwise. The long options whose argument is OPTIONAL
(`--block-signal`, `--default-signal`, `--ignore-signal`) consume no following
word, since getopt_long reads an optional argument only from an `=`-glued
spelling. `--` ends the options; a mere `-` implies `-i` and the operands
follow it.

An `env` option this walk does NOT know is the important case, and it does not
end the walk quietly: env's operands were never located, so a `-S` further
along may have been missed, and the guard reads the command text for a `git`
token and ASKS. That fallback is what keeps the next env option nobody
anticipated from becoming the next silent bypass. An `env` word whose options
resolve with no `-S` among them is just a transparent prefix.

**Detection is any-position, refusal is command-position only.** Matching a
wrapper anywhere is what keeps `sudo bash -c "git push"` from going silent, but
at any position other than the command word the "wrapper" is very often an
ordinary argument: `rg -t sh "git commit"` and `echo bash -c "git commit -m x"`
both resolve to `commit`. The same is true one level down, of the git word
itself: `grep git commit`, `command -v git commit` and
`bash -c "echo git commit"` mention a git word without invoking git. So a
subcommand can produce a `git.on_protected` refusal only when the wrapper it
was reached through (if any) sat at command position in its simple command AND
the git word itself sat at command position in its own; anything else can only
ever ASK. A read-only search must not be hard-blocked by a rail meant for real
commits.

Command position is one rule with nothing to enumerate: word 0 of the simple
command, after leading `VAR=value` assignments and empty placeholder words (a
descended region leaves a slot, and `$(echo) git commit -m x` really commits),
and past an `env` word with its whole option region as described above. It is
the same rule for the wrapper and for the git word.

The consequence to know: a transparent prefix costs the refusal. `sudo git
commit -m x` on a protected branch under `git.on_protected: refuse` ASKS
rather than denying, and so do `timeout 60 git commit`, `nice -n 5 git commit`,
`{ git commit; }` and `find . -exec git commit \;`. The guard still SEES every
one of them and still prompts. An earlier cut kept those denies with an
enumerated set of prefix commands and shell keywords, and that set was dropped
because every prefix carries its own option grammar - `sudo -u john`,
`timeout --signal KILL 60`, `find -exec` - so the enumeration had an
open-ended tail that three review rounds kept finding new members of, and it
produced a false deny on `command -v git commit`, a lookup that runs nothing.
A missing deny costs a prompt on a real commit; a wrong deny hard-blocks
read-only work.

**The git word and the subcommand.** A word is a git word when it EQUALS `git`
or ends with `/git` - word content, so the single word produced by
`echo "git push"` is not one. From the word after it, a global option that
takes an argument (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`,
`--exec-path`, `--config-env`) is skipped with its argument, other `-`-leading
words are skipped, an empty word (a region placeholder, an empty quoted span)
is skipped, and the first remaining word is the subcommand. The scan
then continues, so EVERY git invocation in a command is reported, not just the
first. `git stash push -m wip` reads `stash`.

**Unplaced git words.** A shape the tokenizer cannot resolve stays silent
unless its raw text carries a `git` token, in which case the guard ASKS and
never denies - it could not place the word, so it cannot know what the command
is. `echo "unterminated` and `eval $CMD` are silent; an unterminated quote
around `git push origin main` asks.

**Budgets.** Descent stops at 8 nested regions and operand re-tokenization at
200 expansions per command, both threaded through every recursive call rather
than counted per call. At either bound the guard stops descending and sets the
unplaced flag, so a pathological input fails toward asking instead of stalling
the hook - which runs on every Bash call - or aborting it. When it checks
undescended raw text for a `git` token it splits on whitespace AND on region
openers and closers (`$ ( ) ' " ;` `|` `&` and a backtick), so a nest holding
no space at all still trips it.

Two consequences worth knowing: quoted text is word content, so
`echo "git push"` is one word and stays silent while `echo "git" "push"` is two
words and asks; and the guard prefers a needless prompt to a missed one
everywhere the two conflict.

### Out of grammar (rail 3)

These shapes are NOT implemented. Each is listed with the behavior the
tokenizer actually has, so none of them is a silent unknown:

| Shape | What the guard does |
|---|---|
| Heredoc (`bash <<EOF` ... `EOF`) | The body is read as ordinary command lines, not as data: `git push` in a heredoc body is read as a command and asks. A heredoc that really runs git therefore never goes silent, but a heredoc that merely CONTAINS the text can ask. |
| Herestring (`bash <<< "git push origin main"`) | The string is a redirection target, dropped from the word list; it is read for a `git` token, so this asks rather than going silent. The guard does not read the string as a command. |
| `${...}` expansion, including nested in `$()` (`echo $(echo ${x:-git push})`) | No expansion is performed; `${x:-git` and `push}` stay ordinary word content, so this is SILENT. Resolving it needs the variable's value, which a static reader does not have. |
| Brace expansion (`{git,echo} push origin main`) | Not expanded: `{git,echo}` is one ordinary word and is not a git word, so this is SILENT. Braces in ARGUMENTS are harmless - `git push origin {main,dev}` reads `push` normally. |
| ANSI-C escape sequences inside `$'...'` (`bash -c $'g\x69t push'`) | The span IS read and the `$` dropped, but escape sequences stay literal two-character content, so `g\x69t` is not the word `git` and this is SILENT. Plain `bash -c $'git push origin main'` reads `push`. |
| A command word supplied by a substitution (`$(echo git) push origin main`) | The substitution's own words are read as their own command; its OUTPUT is not fed back, so nothing supplies the command word and this is SILENT. `$(echo git push) origin main` asks, but for the inner command, not the outer one. |
| Aliases and shell functions (`gp origin main`) | Only the words present are read, so a call to an alias or function defined elsewhere is SILENT. A function DEFINITION whose body holds `git push` asks, because the body's words are present. |
| Variable indirection (`CMD="git push"; $CMD`, `eval $CMD`) | Not expanded, and no `git` token survives outside the assignment word, so this is SILENT - the same limit as `${...}`. |
| Remote execution (`ssh host "git push origin main"`) | `ssh` is not in the wrapper set, so the quoted command stays word content and this is SILENT. It also pushes from another machine, which is outside what a local rail can see. |
| Redirect-both (`git &>/dev/null push origin main`, `git &>>out push`) | The `&` separator is read before `&>` can be recognized as a redirection operator, so the command splits at it and `git` is left with no subcommand: SILENT. The trailing-`&` form is unaffected (`git 2>&1 push origin main` reads `push`). This is a real push, and it predates the tokenizer - the strip-and-split arms were silent on it too. |
| A brace list in the SUBCOMMAND slot (`git {push,fetch} origin main`) | Not expanded, so the subcommand reads as the literal word `{push,fetch}`, which is not a known subcommand: SILENT. Bash really runs `git push fetch origin main`. This is the case the brace-expansion row above does NOT cover - braces in later ARGUMENTS (`git push origin {main,dev}`) are genuinely harmless, braces in the subcommand slot are not. |
| Negation or a pattern glued to a subshell (`!(git push)`) | A `(` opens a descended region only when it STARTS a word, so the leading `!` glues it into the word `!(git`, which is not a git word: SILENT. Bash runs `git push`. A bare `(git push)` and `( git push )` both read `push` normally. |

## 4. Risk surfaces

At commit time, if the diff matches a risk surface (list in
references/review-triggers.md), fire the `risk_surface` review trigger before
landing the commit.
