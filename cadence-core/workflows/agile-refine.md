# cad-agile refine (cold branch)

Read from agile.md when the release's next step is to refine an epic. One
conversation: read, ask, cut, show, write. `{id}` and `{name}` are `next`'s. No
agent is started but the one section 2 offers, no code is changed, and a script
writes every file.

## 1. Read

**The branch first**, unless `commit` printed `IGNORED`, `planning.commit_docs`
is false, or that step already asked: Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` and apply section 1.
A stop or an abort ends the run here.

**This run's own folder**, whose printed path goes into every later call as a
literal:

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-refine-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"
```

Then, in one message:

- `.planning/agile/epics/{id}/epic.md`, `.planning/agile/project.md` and
  `.planning/agile/REQUIREMENTS.md`
- `.planning/agile/backlog.md`, the whole file, when it's there
- the `## Decisions` of every epic this one builds on
- the question and the verdict of every `.planning/agile/spikes/*/SPIKE.md`
- the code this epic's Outcome changes, as far as cutting and sizing its stories
  takes, and nothing past it

What those settle is settled: the epic's Boundaries, Done when and Spine
decisions, the project's Constraints and Key decisions, the earlier epics'
decisions, a validated or invalidated spike's verdict, and every line already
under this epic's own Decisions, which an earlier run of this conversation saved.
None of it is asked about. A saved answer that opens with "Guess:" isn't asked
again either, and step 4 shows it. An inconclusive spike settles nothing: its
question is an unknown again, asked with what the spike said would decide it.

## 2. Ask

**An unknown first.** It's a fact the cut depends on that nothing read above
tells: how code too wide to read here behaves, or whether something works at all.
A choice isn't one, and neither is an `[ASSUMPTION]` the design has made. With
one, Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-unknown.md` and
settle it there. With none, no agent is started and nothing is asked about it.

**Then the choices.** Ask about a choice only when undoing it later costs real rework and nothing above
settles it. Pick every other one and put the pick on the list in step 4. With
nothing to ask, go on.

Each question goes through the ask-user seam with two or three answers, said by
what the user will see happen, the one you recommend first with its reason.
Questions that don't wait on each other go in one call. An answer that reaches
past the epic's Boundaries is a line for "You didn't ask for this" in step 4.

Save the answers the moment they come, before anything else, so a cleared
session doesn't ask them again. Write `answers.json` in that folder with the
Write tool, each value on one line and each answer in the user's own words where
they typed one:

```
{"epic": "{id}", "answers": [{"question": "...", "answer": "..."}]}
```

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" answer --payload <that file>
```

On `answers-refused`, fix what `issues` names and run it again. Any other
`ok:false`: print `detail` and `hint`, one line each, and stop. The same question
answered again replaces the answer before it.

## 3. Cut

- A story is the smallest piece that delivers something by itself. Stop when the
  next cut leaves a half that isn't worth accepting, and never cut to reach a
  count.
- It builds on the story before it, or on what's already built, and sets up the
  next or completes the epic.
- S is one change that needs no written plan. M needs a short plan of two or
  three tasks. Anything more is an L and is split here.
- Each check is one line Cadence can run or see fail: "running X shows Y". None
  is the user's to do.
- Together the stories deliver every Done when line and carry every requirement
  the epic names that isn't under Deferred in REQUIREMENTS.md, and each carries
  at least one.
- What no Done when line and no requirement needs is on no story. It goes under
  "You didn't ask for this".
- A backlog item this epic delivers goes into the story that does, and its line
  goes in `backlog`, exactly as it stands in that file.
- No plan is written for any of them.

Write `stories.json` in that folder. A story's ID is `{id}-` and its place in
the list, so the second is `{id}-2`. `builds_on` takes those, an earlier epic or
one of its stories, or nothing. `decisions` holds your picks. `defer` holds the
IDs of the epic's requirements the user said to leave for later, and `add` each
requirement they asked for that none covers, as `{"id": "...", "text": "..."}`,
its ID the next number of the prefix it belongs with in REQUIREMENTS.md,
deferred ones counted. One `propose` lists under `unplaced` is on no epic, left
there by the design or by a refinement cut short, and goes in `add` exactly as
listed when this epic takes it. Both stay empty unless the user said so:

```
{"epic": "{id}", "decisions": ["..."], "backlog": [], "defer": [], "add": [], "stories": [
  {"title": "...", "size": "S", "builds_on": [], "requirements": ["..."],
   "delivers": "...", "accepted_when": ["..."]}]}
```

Have it checked before anyone sees it. This call writes nothing:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" propose --payload <that file>
```

On `stories-refused`, fix what `issues` names and run it again until it answers
`ok:true`. Any other `ok:false`: print `detail` and `hint`, one line each, and
stop.

## 4. Show and ask

Show the list, each part left out when it's empty:

```
{id} {name}: {N} stories

| Story | Size | Delivers | Accepted when |

Picked for you
- {each decision}

Resting on a guess
- {each saved answer that opens with "Guess:"}

From the backlog
- {each item taken}, in {story}

Deferred
- {each ID deferred}: {its text}

Added
- {each ID added}: {its text}

On no epic
- {each ID `propose` lists under `unplaced`}: {its text}

You didn't ask for this
- {each thing left off, and why it came up}
```

Then ask, through the ask-user seam and with nothing recommended:

- header: "Stories"
- question: "Do you want {id} built from these stories?"
- options:
  - "Build them - the stories are saved, and the first one is built next"
  - "Change them - say what to change, and the list is shown again"
  - "Not now - no story is saved, and the answers you gave are kept"

On "Change them", take the change in the user's words. One that changes an
answer is saved first, with `answer` and the question as it stands under
Decisions. Then cut again and come back through `propose`. Something they want from "You didn't ask for this" goes on a
story when one of the epic's requirements covers it. Otherwise it's added as a
requirement if they say so, or `/cad-capture` keeps it for a later epic. A
requirement they say to leave for later goes in `defer`. On "Not now", stop there: nothing else
is written and nothing is committed.

## 5. Write

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" refine --payload <the same stories.json>
```

On `ok:false`, print `detail` and `hint` and stop. Relay `warnings` when there
are any.

Then one commit of the refinement and nothing else the user has staged, unless
the branch step above was skipped for `IGNORED` or `planning.commit_docs`. Push
nothing. `backlog.md` goes in only when lines taken out of it are all that
changed there, and `REQUIREMENTS.md` only when the epic's requirements line
changed:

```
set -- '.planning/agile/epics/{id}/epic.md' ':(glob).planning/agile/epics/{id}/{id}-*.md'
git diff --numstat HEAD -- .planning/agile/backlog.md 2>/dev/null | grep -qE '^0[[:space:]]' && set -- "$@" .planning/agile/backlog.md
[ "$(git cat-file blob 'HEAD:./.planning/agile/epics/{id}/epic.md' 2>/dev/null | grep -m1 '^requirements:')" = "$(grep -m1 '^requirements:' '.planning/agile/epics/{id}/epic.md')" ] || set -- "$@" .planning/agile/REQUIREMENTS.md
git add -A -- "$@"
git commit -m "docs: refine {id}" -- "$@"
```

When git refuses it, go on to the report with its reason.

```
Epic: {id} {name}, {N} stories
Commit: {hash, or "none - " and why}

Next: build {next.story.id} {next.story.title}, with /cad-agile
```
