# cad-agile close (cold branch)

Read from agile.md when every epic of the release is done. The user picks the
version and says what happens to a requirement still open, and a script moves
the release into `.planning/agile/releases/<version>/`. `{release}` is `next`'s.

## 1. A close under way

With `next.closing`, a close stopped while its files moved: ask nothing, run

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" close
```

and go to section 3's **Commit** with its `version`. On `ok:false`, print
`detail` and `hint`, one line each, and go to section 4.

## 2. Show and ask

Show `Requirements: {N} done, {N} deferred, {N} open` from `next.requirements`,
then `Open: {id}: {text}` for each one open. Then read what's been published:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" tags --dir .
```

The last version is the higher of the highest tag that reads as one, its `v`
kept, and the `version` in `.claude-plugin/plugin.json`, else in `package.json`,
so the one offered is never below what the manifest holds.

Ask through the ask-user seam, in one call:

- header: "Version"
- question: "Which version is {release}?"
- options, from the last version: its next patch "(Recommended) - the release
  fixes or finishes what's there", then its next minor "- the release adds
  something new"; with none, "0.1.0" and "1.0.0", nothing recommended

and, only with a requirement open, with nothing recommended:

- header: "Open"
- question: "{the open IDs} aren't built. Close {release} without them?"
- options:
  - "Defer them - they move under Deferred, and the release closes without them"
  - "Stop - nothing is written, and the release stays open"

On "Stop", go to section 4: not closed, and the open IDs.

## 3. Write

**Bump.** The manifest takes the version first, so a version it won't take stops
the close with nothing moved. A project with no plugin manifest answers `action:
skip`, and one already at the version `noop`. On `ok:false`, print `detail` and
go to section 4; nothing else was written:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/release-bump.mjs" bump --dir . --version '{version}'
```

**Close.** Write `{"version": "<the version picked>", "defer": [<the open IDs
when deferred, else none>]}` to `close.json` in a folder of its own
(`mktemp -d "${TMPDIR:-/tmp}/cad-close-XXXXXX"`), then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" close --payload <that file>
```

On `close-refused`, fix what `issues` names and run it again; on any other
`ok:false`, print `detail` and `hint`, one line each, and go to section 4.

**Commit.** One commit of the close and nothing else the user has staged,
unless agile.md's `commit` printed `IGNORED` or `planning.commit_docs` is false.
Push nothing. The release's old paths go in when git tracks them, and a manifest
file or CHANGELOG.md only when it holds the version and HEAD's copy doesn't:

```
b='{version}'; b="${b#v}"
set -- '.planning/agile/releases/{version}'
for f in .planning/agile/release.md .planning/agile/REQUIREMENTS.md .planning/agile/epics; do [ -n "$(git ls-files -- "$f")" ] && set -- "$@" "$f"; done
for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json; do [ -f "$f" ] && ! git check-ignore -q "$f" && tr -d ' \t\r' < "$f" | grep -qF "\"version\":\"$b\"" && ! git cat-file blob "HEAD:./$f" 2>/dev/null | tr -d ' \t\r' | grep -qF "\"version\":\"$b\"" && set -- "$@" "$f"; done
[ -f CHANGELOG.md ] && ! git check-ignore -q CHANGELOG.md && grep -qF "## [$b]" CHANGELOG.md && ! git cat-file blob HEAD:./CHANGELOG.md 2>/dev/null | grep -qF "## [$b]" && set -- "$@" CHANGELOG.md
git add -A -- "$@"
git commit -m "docs: close the release {version}" -- "$@"
```

When git refuses it, go on to section 4 with its reason.

**Land.** With the commit made, ask whether this project lands on its own:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" authorized --dir .
```

On `ok:true`, `git.auto_close` is set in both config layers: invoke
`/cadence:cad-land` through the SlashCommand tool, as `/cad-milestone`'s close
does, so it runs PR, merge and tag and asks once, before the tag push; its gate
can still stop it before the merge. Its report follows this one. On `ok:false`,
nothing more runs here.

## 4. Report

```
Release: {release}, {closed as {version} in .planning/agile/releases/{version}/ | not closed: why}
Deferred: {each ID deferred, the line left out when none}
Manifest: {the bump's detail, the line left out on skip}
Commit: {hash, or "none - " and why}

Next: publish it with /cad-land
```

Not closed, the `Next:` line is "Next: close the release, with /cad-agile", and
after `/cad-land` ran it is left out.
