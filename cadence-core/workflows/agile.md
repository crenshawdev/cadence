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
- `release` is null, with `--brief` -> go to `start`.
- `release` is null, without it -> stop: "No release is open here. Start one
  from a Seldon design with /cad-agile --brief <design folder>."
</step>

<step name="start">
There is no confirm step: typing the command is the consent. The path goes in
quoted, exactly as typed:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" start --design "<folder>"
```

On `ok:false`, print `detail`, every entry of `issues` and `hint`, and stop.
</step>

<step name="commit">
One Bash step, after a start and on an open release alike, so a run cut short
before its commit is finished by the next one:

```
git rev-parse --git-dir >/dev/null 2>&1 || git init
git cat-file -e HEAD:./.planning/agile/release.md 2>/dev/null && echo COMMITTED
git check-ignore -q .planning/agile/release.md && echo IGNORED
git rev-parse -q --verify HEAD >/dev/null || echo NO_COMMITS
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  planning.commit_docs git.protected_branches git.on_protected git.base_branch
```

Make no commit on `COMMITTED`, on `IGNORED` or with `planning.commit_docs`
false. Otherwise, unless it printed `NO_COMMITS` (there is nothing to branch
from), Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` and
apply section 1's protected-branch guard and base integrity. Skip its
integration branch: that one is named from files this path doesn't have.

Then commit the release and nothing else the user has staged, and push nothing:

```
git add .planning/agile .planning/records/state.json .planning/records/.gitignore
git commit -m "docs: start the release" -- .planning/agile .planning/records/state.json .planning/records/.gitignore
```
</step>

<step name="report">
After a start:

```
Release: {release}, {N} epics in .planning/agile/
Commit: {hash, or "none - " and which of the three reasons}
On no epic: {the `uncovered` requirement IDs, the line left out when empty}

Next: refine {next.id} {next.name}, with /cad-agile
```

On a release that was already open, the `Release: {release}` and `Next:` lines,
with `Commit:` between them only when this run made one. `next` null -> "Every
epic is done." in place of the `Next:` line.
</step>

</process>
