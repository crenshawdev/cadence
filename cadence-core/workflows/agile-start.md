# cad-agile start (cold branch)

Read from agile.md when `--brief` starts a release, and from agile-design.md
with the design it wrote or found. Everything a start has to
ask is asked before it writes anything, in this order: check, ask, write.

## 1. Check

There is no confirm step: typing the command is the consent. The path goes in
as one single-quoted word, a leading `~` written out as the home folder. Double
quotes would run a `$(...)` or a backtick in it, and a path holding a single
quote is refused here, never escaped. One Bash step, which writes nothing:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" check --design '<folder>'
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" detect --dir .
git remote get-url origin >/dev/null 2>&1 || echo NO_ORIGIN
git rev-parse -q --verify HEAD >/dev/null 2>&1 || echo NO_COMMITS
git check-ignore .planning/agile/release.md .planning/records/state.json .planning/records/.gitignore >/dev/null 2>&1 && echo IGNORED
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  planning.commit_docs git.protected_branches git.on_protected git.base_branch review.key_file
```

On `ok:false` from `agile.mjs`, print `detail`, every entry of `issues` and
`hint`, and stop.

## 2. Ask

Nothing is written here. Each answer is held for **Write**, and so is every call
the files named below make after one. Ask only what the check left open. An
answer the user didn't give is never filled in for them: a start still waiting
on one ends the turn there. Questions that don't wait on each other go in one
call.

**Outside reviewers.** For every name in `reviewers.outside`, all in one message:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" detect-models --provider '<name>' [--key-file '<review.key_file, only if set>']
```

A name that answers `no-key`, `bad-provider`, or `http` with a 401 or 403 joins
`dropped`, for its `detail`. Any other `ok:false` is a provider that couldn't be
reached just now: say so in one line and ask nothing about it. A name already
there is dropped for what `reviewers.warnings` says of it. With none dropped,
ask nothing. Otherwise ask once for all of them, with no option recommended:

- header: "Reviewers"
- question: "{names} can't review this project: {why, in plain words}. How do you want to start?"
- options:
  - "Without {names} - reviews here leave them out, and this isn't asked again"
  - "Not yet - nothing is written, and /cad-config --review sets a reviewer up"

On the first, hold `review.reviewers` as `reviewers.list` without them, or
`["claude-subagent"]` when none is left. On the second, the start stops.

**Forge**, when `unanswered` names `forge`. From the `forge.mjs detect` line: on
`refuse`, print its `reason` and `hint`, one line each, and the start stops. On
`ask`, Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/new-project.md`, only
its **Pick a forge** item, and ask that item's questions a, b and c. On "None of
these" the start stops: name the binaries in `installed`, and say the project can
start once one of those services hosts it. After `NO_ORIGIN`, ask its **Create
repo** question too, and hold the answer. Hold `git.forge_provider`,
`git.forge_repo` and, on forgejo, `git.forge_host`.

**Risk surfaces**, when `unanswered` names `surfaces`. Ask as
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` states it, legend
and all, with the check's own `surfaces` as the options and no scan run. No
structured question can hold a single option, so one alone is asked in plain
prose: that set and its reason, and the user takes it or names the ones they
want. Hold `review.triggers.risk_surface.surfaces`.

**Testing policy**, when `unanswered` names `testing`. Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-testing.md` and follow items
1 to 3 of its **Testing policy** arm. The stack is the check's `constraints`, and
where the design decides none, the user is asked for it. A strong area's
requirement is one the design's `prd.md` states, and the surfaces just answered
count. Item 4 waits for **Write**, and item 5 is never asked here.

**The branch**, unless this start makes no commit (`IGNORED`, or
`planning.commit_docs` false) or has nothing to branch from (`NO_COMMITS`). Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` and apply section 1
as on an agile project, with the check's `decide` as that call's answer, since
no release is on disk yet. Its second option reads "Commit here anyway - this
release's commits go on {branch}, and this question isn't asked again". A new branch is
held for **Write**, and so is that answer, with the branch it names. A stop or
an abort stops the start.

**The answers.** Every value goes in single quotes, here and in **Write**, the
branch's name with them, and one that holds a single quote is asked again. This
call writes nothing and leaves the testing lists out. A pair it refuses is asked
again with its error, until none is:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" check '<key>=<value>' '<key>=<value>'
```

## 3. Write

In this order, stopping at the first call that fails, with its `detail` and
`hint` or git's own words. The next run asks only what is still unanswered.

1. The repository, when there isn't one. Some git settings only apply inside it,
   so one made here is checked again before anything else is written:

   ```
   git rev-parse --git-dir >/dev/null 2>&1 || { git init && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" check --design '<folder>'; }
   ```

   Its `ok:false` stops the start, with only an empty `.git` on disk, and
   nothing else it says is used. Then `git checkout -b '<branch>'` when there's
   a new one. One that already exists stops here, since the check didn't see
   what's on it: name `git checkout '<branch>'` and this command again.
2. The settings, when any was answered, the testing ones left to the next call.
   A project's first config.json holds its answers and the guard switch every
   new project gets, so the rest follows the user's own settings:

   ```
   mkdir -p .planning
   [ -f .planning/config.json ] || printf '{"git":{"guard_bypass":true}}\n' > .planning/config.json
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set '<key>=<value>' '<key>=<value>'
   ```
3. The repository, when the user said to create it: the `forge.mjs create` call
   in that same forge item. Its `ok:false` is printed and carried to the report,
   and the start goes on.
4. The testing answers, when they were asked: the one `config.mjs set` of item 4
   in that same arm. `start` renders the policy file from them, so none of that
   item's other calls is run.
5. The release, with `--commit-here '<branch>'` after "Commit here anyway", so
   no later run asks the branch question there again. The git-guard hook still
   asks at each commit there unless `git.guard_bypass` is set in both layers:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" start --design '<folder>' [--commit-here '<branch>']
   ```
