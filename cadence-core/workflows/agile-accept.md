# cad-agile accept (cold branch)

Read from agile.md when every story of the release's next epic is done. The user
accepts the epic, and a script writes it. `{id}` and `{name}` are `next`'s.

## 1. Show

Read `.planning/agile/epics/{id}/epic.md` and every
`.planning/agile/epics/{id}/{id}-*.md` in one message, then show the user:

- each item under the epic's Done when
- each story's ID, title and size, its `- Check` lines as its Result holds them,
  and its `- Review:` line

## 2. Ask

Through the ask-user seam, with no option recommended:

- header: "Accept"
- question: "Is {id} {name} done? Every story's checks passed."
- options:
  - "Accept - {id} is done, and the next epic comes after it"
  - "Not yet - nothing is written, and {id} waits to be accepted"

"Not yet" ends the run: go to section 4.

## 3. Write

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" accept
```

On `ok:false`, print `detail` and `hint`, one line each, and go to section 4.
Then one commit of the epic's file and nothing else the user has staged, unless
agile.md's `commit` printed `IGNORED` or `planning.commit_docs` is false. Push
nothing:

```
git add -- '.planning/agile/epics/{id}/epic.md'
git commit -m "docs: accept {id}" -- '.planning/agile/epics/{id}/epic.md'
```

When git refuses it, go on to section 4 with its reason.

## 4. Report

```
Epic: {id} {name}, {accepted | not yet | not accepted: why}
Commit: {hash, or "none - " and why}

Next: {the accept call's next.step, its id and name, or a build's story id and title}, with /cad-agile
```

With no next epic, "Every epic is done." in place of the `Next:` line. After
"Not yet", the `Commit:` line is left out and `Next:` is accept {id}.
