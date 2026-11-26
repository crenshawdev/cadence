# cad-agile accept (cold branch)

Read from agile.md when every story of the release's next epic is done. The user
accepts the epic and approves its retrospective, and a script writes both.
`{id}` and `{name}` are `next`'s.

## 1. Show

```
[ -f '.planning/agile/epics/{id}/retro.md' ] && echo RETRO
```

On `RETRO` the user approved the retrospective and the run stopped before {id}
turned done: ask nothing, and go to section 3's **Accept** with no payload.

Otherwise read `.planning/agile/epics/{id}/epic.md`, every
`.planning/agile/epics/{id}/{id}-*.md` and every
`.planning/agile/tasks/{id}-*/ADJUDICATION-*.json` in one message, then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" evidence
```

On `ok:false`, print `detail` and `hint`, one line each, and go to section 4.

Draft the retrospective from the Evidence, the stories' Results and the review
records: What went well, What could we do better, and Change next, what the next
epic does differently. Each is a few lines of one sentence, and each line rests
on something you read. Then show the user:

- each item under the epic's Done when
- each story's ID, title and size, its `- Check` lines as its Result holds them,
  and its `- Review:` line
- the Evidence, `text`'s lines as they are
- the drafted What went well, What could we do better and Change next

## 2. Ask

Through the ask-user seam, with no option recommended:

- header: "Accept"
- question: "Is {id} {name} done, with this retrospective? Every story's checks passed."
- options:
  - "Accept - {id} is done with this retrospective, and the next epic comes after it"
  - "Change the retrospective - say what to change, and {id} is accepted with it"
  - "Not yet - say what's missing, and {id} is cut again for it before it's asked about again"

After "Change the retrospective", ask in plain words what to change, and wait for
the answer. Make those changes and no others, then section 3's **Accept**,
asking nothing more. After "Not yet", ask in plain words what's missing from
{id}, and wait for the answer. Then section 3's **Not yet**.

## 3. Write

**Accept.** Write `{"epic": "{id}", "went_well": [...], "do_better": [...],
"change_next": [...]}`, each a list of the approved lines, to `retro.json` in a
folder of its own (`mktemp -d "${TMPDIR:-/tmp}/cad-accept-XXXXXX"`), then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" accept --payload <that file>
```

After `RETRO`, the same call without `--payload`. On `retro-refused`, fix what
`issues` names and run it again; on any other `ok:false`, print `detail` and
`hint`, one line each, and go to section 4. Then one commit of the epic's file
and its retrospective and nothing else the user has staged, unless agile.md's
`commit` printed `IGNORED` or `planning.commit_docs` is false. Push nothing:

```
git add -- '.planning/agile/epics/{id}/epic.md' '.planning/agile/epics/{id}/retro.md'
git commit -m "docs: accept {id}" -- '.planning/agile/epics/{id}/epic.md' '.planning/agile/epics/{id}/retro.md'
```

When git refuses it, go on to section 4 with its reason.

**Not yet.** Write `{"epic": "{id}", "missing": "<what they said, in their words,
on one line>"}` to `not-yet.json` in a folder of its own, made the same way, then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" not-yet --payload <that file>
```

On `not-yet-refused`, fix what `issues` names and run it again; on any other
`ok:false`, print `detail` and `hint` and go to section 4. Then commit the
epic's file alone, under the same conditions:

```
git add -- '.planning/agile/epics/{id}/epic.md'
git commit -m "docs: not yet {id}" -- '.planning/agile/epics/{id}/epic.md'
```

## 4. Report

```
Epic: {id} {name}, {accepted | not yet: what's missing | not accepted: why}
Retrospective: {the accept call's retro, the line left out unless it was accepted}
Commit: {hash, or "none - " and why}

Next: {the accept call's next.step, its id and name, or a build's story id and title}, with /cad-agile
```

With `next_refusal`, its `detail` and `hint` take the `Next:` line's place, and
with neither that nor a next epic, "Every epic is done." does.
