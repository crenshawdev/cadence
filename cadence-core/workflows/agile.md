<purpose>
The agile path's one command: ask the project's files what comes next and do
it. The script writes every file of a release from the design's own words, so
nothing under `.planning/agile/` is written, edited or summarized here.
</purpose>

<process>

<step name="next">
Parse `$ARGUMENTS`: an optional `--brief <folder>`, the folder of a finished
Seldon design. Then ask:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" next
```

- `ok:false` -> print `detail` and `hint`, one line each, and stop.
- `release` is a name -> that release is open: go to `commit`. With `--brief`,
  say in one line that the design wasn't read because {release} is still open.
- `release` is null, with `--brief` -> Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-start.md` and follow it,
  then go to `commit`.
- `release` is null, without it -> stop: "No release is open here. Start one
  from a Seldon design with /cad-agile --brief <design folder>."
</step>

<step name="commit">
One Bash step, after a start and on an open release alike, so a project's first
start, cut short before its commit, is finished by the next run:

```
git rev-parse --git-dir >/dev/null 2>&1 || git init
git cat-file -e HEAD:./.planning/agile/release.md 2>/dev/null && echo COMMITTED
git check-ignore .planning/agile/release.md .planning/records/state.json .planning/records/.gitignore >/dev/null && echo IGNORED
git rev-parse -q --verify HEAD >/dev/null || echo NO_COMMITS
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  planning.commit_docs git.protected_branches git.on_protected git.base_branch
```

Make no commit on `IGNORED` or with `planning.commit_docs` false, nor on
`COMMITTED` for a release that was already open. After a start `COMMITTED` is
about the release before this one, so it doesn't count, and the start has
settled its branch. On a release that was already open, unless it printed
`NO_COMMITS` (there is nothing to branch from), Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` and apply section 1.

Then commit the release, its setup and nothing else the user has staged, and
push nothing:

```
set -- .planning/agile/project.md .planning/agile/REQUIREMENTS.md .planning/agile/release.md .planning/agile/epics .planning/records/state.json .planning/records/.gitignore
for f in .planning/config.json .github/cadence/coverage-policy.json; do [ -f "$f" ] && ! git check-ignore -q "$f" && set -- "$@" "$f"; done
git add -- "$@"
git commit -m "docs: start the release" -- "$@"
```

Nothing here ends the run: when the guard stops the commit or git refuses it,
go on to `report` with the reason.
</step>

<step name="report">
After a start:

```
Release: {release}, {N} epics in .planning/agile/
Setup: {each answer this run wrote, the line left out when it asked nothing}
Repository: {created, or "not created - " and why, the line left out unless it was asked for}
Commit: {hash, or "none - " and why}
On no epic: {the `uncovered` requirement IDs, the line left out when empty}

Next: {next.step} {next.id} {next.name}, with /cad-agile
```

A `build` step names `{next.story.id} {next.story.title}` there instead.

On a release that was already open, the `Release: {release}` and `Next:` lines,
with `Commit:` between them only when this run made one or tried to. `next`
null -> "Every epic is done." in place of the `Next:` line.
</step>

</process>
