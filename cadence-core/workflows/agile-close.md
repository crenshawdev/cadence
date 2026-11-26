# cad-agile close (cold branch)

Read from agile.md when every epic of the release is done. The user picks the
version and says what happens to a requirement still open, and a script moves
the release into `.planning/agile/releases/<version>/`. `{release}` is `next`'s.

## 1. A close under way

With `next.closing`, a close stopped while its files moved: ask nothing, run

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" close
```

and go to section 3's **Bump and commit** with its `version`. On `ok:false`,
print `detail` and `hint`, one line each, and go to section 4.

## 2. Show and ask

Show `Requirements: {N} done, {N} deferred, {N} open` from `next.requirements`,
then `Open: {id}: {text}` for each one open. Then read what's been published:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" tags --dir .
```

The last version is the highest tag that reads as one, its `v` kept; with no
tag, the `version` in `.claude-plugin/plugin.json`, else in `package.json`.

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

**Close.** Write `{"version": "<the version picked>", "defer": [<the open IDs
when deferred, else none>]}` to `close.json` in a folder of its own
(`mktemp -d "${TMPDIR:-/tmp}/cad-close-XXXXXX"`), then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" close --payload <that file>
```

On `close-refused`, fix what `issues` names and run it again; on any other
`ok:false`, print `detail` and `hint`, one line each, and go to section 4.

**Bump and commit.** The manifest takes the version; a project with no plugin
manifest answers `action: skip`, and one already at it `noop`. On `ok:false`,
print `detail` and go to section 4 with nothing committed:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/release-bump.mjs" bump --dir . --version '{version}'
```

Then one commit of the close and nothing else the user has staged, unless
agile.md's `commit` printed `IGNORED` or `planning.commit_docs` is false. Push
nothing. The release's old paths go in when git tracks them, and a manifest file
when it differs from HEAD:

```
set -- '.planning/agile/releases/{version}'
for f in .planning/agile/release.md .planning/agile/REQUIREMENTS.md .planning/agile/epics; do [ -n "$(git ls-files -- "$f")" ] && set -- "$@" "$f"; done
for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md; do [ -f "$f" ] && ! git check-ignore -q "$f" && [ "$(git cat-file blob "HEAD:./$f" 2>/dev/null | tr -d '\r')" != "$(tr -d '\r' < "$f")" ] && set -- "$@" "$f"; done
git add -A -- "$@"
git commit -m "docs: close the release {version}" -- "$@"
```

When git refuses it, go on to section 4 with its reason.

## 4. Report

```
Release: {release}, {closed as {version} in .planning/agile/releases/{version}/ | not closed: why}
Deferred: {each ID deferred, the line left out when none}
Manifest: {the bump's detail, the line left out on skip}
Commit: {hash, or "none - " and why}

Next: publish it with /cad-land
```

Not closed, the `Next:` line is "Next: close the release, with /cad-agile".
