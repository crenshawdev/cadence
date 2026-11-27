<purpose>
The agile path's one command: ask the project's files what comes next and do
it. A script writes every file of a release, so nothing under `.planning/agile/`
is written or edited by hand here.
</purpose>

<process>

<step name="next">
Parse `$ARGUMENTS`: an optional `--brief <folder>`, the folder of a finished
Seldon design. Then ask:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" next
```

- `ok:false` with reason `switch`, with `--brief` -> an old-path project whose
  release has landed, or one whose move stopped partway: Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-start.md` and follow it,
  then go to `commit`.
- Any other `ok:false`, and `switch` without `--brief` -> print `detail` and
  `hint`, one line each, and stop.
- `release` is a name -> that release is open: go to `commit`. With `--brief`,
  say in one line that the design wasn't read because {release} is still open.
- `release` is null -> first, a close stopped after its move and before its
  commit is finished:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get planning.commit_docs
  for d in .planning/agile/releases/*/; do [ -f "${d}release.md" ] && ! git check-ignore -q "${d}release.md" && ! git cat-file -e "HEAD:./${d}release.md" 2>/dev/null && echo "UNCOMMITTED $(basename "$d")"; done
  ```

  Unless `planning.commit_docs` is false, for each version `UNCOMMITTED` names,
  Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` and apply
  section 1 unless HEAD has no commit, a stop going to the report, then Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-close.md` and apply its
  section 3's **Commit** with that version, then its report, and the run ends
  there. The manifest was bumped before the move. With none, go on.
- `release` is null, with `--brief` -> Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-start.md` and follow it,
  then go to `commit`.
- `release` is null, without it -> Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-design.md` and follow it,
  then go to `commit` unless it stopped.
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

Then commit the release, its setup, a switch's moves and nothing else the user
has staged, and push nothing. First stage the switch, which writes only git's
index and answers `paths: []` on any other start:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" stage-switch
```

On its `ok:false`, go on to `report` with its `detail`. Otherwise add each of
its `paths`, in single quotes, at the end of the `git commit` line, never the
`git add` line, and with any, the message is "docs: move to the new path and
start the release":

```
set -- .planning/agile/project.md .planning/agile/REQUIREMENTS.md .planning/agile/release.md .planning/agile/epics .planning/records/state.json .planning/records/.gitignore
for f in .planning/config.json .github/cadence/coverage-policy.json; do [ -f "$f" ] && ! git check-ignore -q "$f" && set -- "$@" "$f"; done
git add -- "$@"
git --literal-pathspecs commit -m "docs: start the release" -- "$@" '<each path stage-switch named>'
```

Nothing here ends the run: when the guard stops the commit or git refuses it,
go on to `report` with the reason.
</step>

<step name="refine">
Only on a release that was already open, with no commit above left unmade.

An acceptance cut short before its commit is finished first, unless `commit`
printed `IGNORED` or `planning.commit_docs` is false:

```
st() { tr -d '\r' | awk 'NR==1 { if ($0 != "---") exit; next } /^---$/ { exit } /^status:/ { sub(/^status:[ \t]*/, ""); sub(/[ \t]*$/, ""); print; exit }'; }
for f in .planning/agile/epics/E-*/epic.md; do [ "$(st < "$f")" = done ] || continue; [ "$(git cat-file blob "HEAD:./$f" 2>/dev/null | st)" = done ] || echo "UNACCEPTED $(basename "$(dirname "$f")")"; done
```

Commit each epic it names, `{e}` its ID, by itself with its retrospective when
it has one, and with nothing else the user has staged. When git refuses, go on
to `report` with its reason:

```
set -- '.planning/agile/epics/{e}/epic.md'; [ -f '.planning/agile/epics/{e}/retro.md' ] && set -- "$@" '.planning/agile/epics/{e}/retro.md'
git add -- "$@"
git commit -m "docs: accept {e}" -- "$@"
```

On `build` and `accept`, a story of `{next.id}` done before its record was made,
a run cut short after its checks passed, is finished first. Leave out the
`git status` test when `planning.commit_docs` is false:

```
for f in '.planning/agile/epics/{next.id}/{next.id}'-*.md; do s="$(basename "$f" .md)"; grep -qx 'status: done' "$f" 2>/dev/null || continue; { ls ".planning/agile/tasks/$s/"payload-*.json || [ -n "$(git status --porcelain -- "$f")" ]; } >/dev/null 2>&1 && echo "UNRECORDED $s"; done
```

On `UNRECORDED`, Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-build.md`
and follow it for the first story named. It reports for itself, so the run ends
there.

- `next.step` is `refine` -> Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-refine.md` and follow it.
  It reports for itself, so the run ends there.
- `next.step` is `build` -> a refinement cut short before its commit is finished
  here, unless `commit` printed `IGNORED` or `planning.commit_docs` is false:

  ```
  git cat-file -e 'HEAD:./.planning/agile/epics/{next.id}/{next.story.id}.md' 2>/dev/null && echo REFINED
  ```

  Without `REFINED`, Read that same file, apply its branch step, where a stop
  goes on to `report` with its reason, and make its commit. Then Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-build.md` and follow it.
  It reports for itself, so the run ends there.
- `next.step` is `accept` -> a cut again that left no story, cut short before
  its commit, is finished as for `build`, with this check in place of that one:

  ```
  [ "$(git cat-file blob 'HEAD:./.planning/agile/epics/{next.id}/epic.md' 2>/dev/null | tr -d '\r')" = "$(tr -d '\r' < '.planning/agile/epics/{next.id}/epic.md')" ] && echo REFINED
  ```

  Then Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-accept.md` and
  follow it. It reports for itself, so the run ends there.
- `next.step` is `close` -> Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-close.md` and follow it.
  It reports for itself, so the run ends there.
- Anything else -> `report`.
</step>

<step name="report">
After a start:

```
Release: {release}, {N} epics in .planning/agile/
Switched: {N of start's switched.archive} paths archived into .planning/_archive-old-path/, the line left out unless this run's start switched
Setup: {each answer this run wrote, the line left out when it asked nothing}
Repository: {created, or "not created - " and why, the line left out unless it was asked for}
Commit: {hash, or "none - " and why}
On no epic: {the `uncovered` requirement IDs, the line left out when empty}

Next: {next.step} {next.id} {next.name}, with /cad-agile
```

A `build` step names `{next.story.id} {next.story.title}` there instead.

On a release that was already open, the `Release: {release}` and `Next:` lines,
with `Commit:` between them only when this run made one or tried to.
</step>

</process>
