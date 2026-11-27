# cad-agile build (cold branch)

Read from agile.md when the release's next step is to build a story, or when it
finds a story done with no record yet. One story, begun to done in this run or
as far as a stop lets it get, and the story file says where the next run picks
up. `{id}` is `next.id`, and `{story}`, `{title}` and `{size}` are that story's.
A script writes every story and epic file, and none is edited by hand.

## 1. Before anything is built

A story picked up done needs only this run's own folder, then section 2.

**This run's own folder**, whose printed path goes into every later call as a
literal:

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-build-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"
```

**The findings rule**, once for each epic. When `## Decisions` in
`.planning/agile/epics/{id}/epic.md` has no line for "How are review findings
handled?", ask it through the ask-user seam:

- header: "Findings"
- question: "How should what the review finds be handled while {id}'s stories are built?"
- options:
  - "Fix them, ask about lows (Recommended) - every medium and up is fixed before the checks run, and the lows come to you in one question at the end of each story"
  - "Ask me each time - every finding comes to you after the review, and only the ones you pick are fixed"

Save it the moment it comes, as agile-refine.md's section 2 saves an answer,
with `{"epic": "{id}", "answers": [{"question": "How are review findings
handled?", "answer": "<the label picked>"}]}`, the label without
"(Recommended)", and `agile.mjs answer`.

**Read**, in one message: the story file, the epic file,
`.planning/agile/project.md`, whose Standing rules this build follows, the
Result of each story it builds on, and the code its Delivers changes, as far as
building it takes. With a testing policy
(`testing.scope` set), `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/test-policy.md`
too.

## 2. Begin, or pick up

This run's own bracket, the three `trace` lines on their own lines:

```
T="$$-$(date +%s)" && S="$(git rev-parse --short HEAD)" && printf '%s' ".planning/agile/epics/{id}/{story}.md" > "<the folder>/read-set.txt" && echo "run token: $T  start sha: $S"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family lifecycle --event phase_start --sha "$S-$T"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family lifecycle --event dispatch --plan {story} --role cad-agile --read-file "<the folder>/read-set.txt"
```

Then the story's status and its Result say where to go. Base is where the story
began, and every commit after it is the story's and is never made again:

- `backlog`: begin it with
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" move --to in-progress`,
  then section 3.
- `in-progress` with no `- Check` lines: section 3, from what
  `git log --oneline {Base}..HEAD` and `git status` show is already there.
- `in-progress` with every check `not run`: section 5 with no `- Review:` line,
  and section 6 with one, a fix round noted before its checks ran.
- `review` with no `- Review:` line: section 5.
- `review` with a `- Review:` line: section 6.
- `in-progress` with checks that ran: section 7.
- `done`: section 8, its record not made yet.

`agile.mjs` calls answer one JSON object. On `ok:false`, print `detail` and
`hint`, one line each, go to section 8, and close the bracket with the reason.

## 3. Build

**Its size**, before anything is changed. An S is one change with no written
plan, an M has a short plan of two or three tasks, and anything more is an L,
which is never built. When an M's Plan says "None yet.", write `size.json` in
the folder, each task one line saying what it changes, in which files, and what
shows it's done:

```
{"story": "{story}", "size": "M", "plan": ["...", "..."]}
```

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" size --payload <that file>
```

A story that needs more than three tasks is sized `"L"` with `why`, one line,
and no plan, which sends it back to backlog for the next run to cut again:
section 8, with nothing built.

Then make it, an M task by task, with the tests the testing policy asks for
when there is one. A cleared run takes the tasks the log already holds as done.

Something the story doesn't need, found on the way, isn't built. Write it to a
file in the folder and keep it for later:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture --kind todo --text-file <that file>
```

Commit per references/git-guard.md rail 2: the paths you changed by name,
`feat({story}): ...` or `fix({story}): ...`, and nothing else the user has
staged. An M commits each task as it's done.

## 4. The commands

One command for each Accepted when line, in order, each one Cadence runs and the
line decides: a test that fails without the change, a script call, or a headless
run. None passes whatever the code does, and none is a judgement. A filter that
matches no test still passes, as `node --test --test-name-pattern` does, so a
command runs the test's own file or shows the test ran. Write `commands.json` in
the folder:

```
{"story": "{story}", "commands": ["...", "..."]}
```

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" check-commands --payload <that file>
```

On `commands-refused`, fix what `issues` names and run it again.

## 5. Review

When `.planning/agile/tasks/{story}/` holds a `payload-{reviewed}-{HEAD}.json`,
`{HEAD}` being `git rev-parse --short HEAD`, the review ran and its fixes are in:
go straight to its record below, with the reviewed head its name gives.
Otherwise:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" move --to review
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase 0 --base {Base} --head HEAD
```

**A match**, or `inconclusive: true`, fires the `risk_surface` trigger as
references/review-triggers.md states, with `git diff {Base}..HEAD` written to
`.planning/agile/tasks/{story}/risk-task-{story}.diff`, shape (c), and its
records written with `--task {story}`. On the workflow path its `args` carry
`checkers: false`: prove each finding as **Its findings** below does, and one
you can neither prove nor kill goes to the user. At `blocking` and
`adjudicated` you fix what the gate says to fix, here, and its one narrowed
round is the gate's. `advisory` reports and goes on. `deferred` fixes nothing:
its `deferred record` takes `--task {story}` too, and the member is committed
with the record. Remove that `.diff` file once the fire is done. A gate of
`off` reviews nothing, so the story takes the reviewers below.

**No match**, or the gate `off`: every reviewer the resolve below prints under
`reviewers.diff`, started together over one diff. Write `git diff {Base}..HEAD`
to `.planning/agile/tasks/{story}/review-{story}.diff`, then resolve it and
relay each `warnings[]` entry to the user. `claude-subagent` is the
`agent_type` and `model` it prints, bracketed by the append below, since the
resolve fires for a set without it too, and dispatched through
`references/seam-spawn-agent.md` with the prompt below. Any other name is a
cross-model reviewer: Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-cross-model.md` (one
consult site - this step) and run it there with trigger `diff` at `reviewer_tiers.diff` and `reviewer_efforts.diff`,
its artifact a file in this run's folder holding the story file and then the
diff, and its instruction the prompt below with the story file named as the
artifact's top. One answering `ok:false` is named with its reason and dropped,
and with none left `claude-subagent` runs.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-reviewer --phase 0
```

```
printf '%s' ".planning/agile/tasks/{story}/review-{story}.diff,.planning/agile/epics/{id}/{story}.md" > "<the folder>/review-read.txt"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family lifecycle --event dispatch --plan {story}-review --role cad-reviewer --reviewer claude-subagent --read-file "<the folder>/review-read.txt"
```

```
Refute this change. {story} {title} is to deliver: {its Delivers}. Its Accepted when lines, its plan when it has one, and the command recorded to check each one, are in .planning/agile/epics/{id}/{story}.md. The change is the diff at .planning/agile/tasks/{story}/review-{story}.diff. Find what breaks it, what it misses of Delivers or of a line, and any command that would pass with its line untrue. {With a testing policy: the test-finding sentence of references/review-triggers.md step 2.} Follow your output format exactly.
```

Close the `claude-subagent` bracket the moment it's back, with
`--detail-file <path>` naming what failed when it did:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase 0 --plan {story}-review --role cad-reviewer --reviewer claude-subagent --agent-id <the id on the subagent return> --tokens <the token count on it> --turns <the tool-call count on it> --duration-ms <the wall clock on it>
```

**Its findings.** Prove each one before anything is fixed: open the code it
cites, or run what it describes. It's `survived`, `downgraded` with the
severity it proved at, or `refuted` with the code that contradicts it. One you
can neither prove nor kill goes to the user. Then, by the epic's findings rule:

- "Fix them, ask about lows": every survivor at medium and up is fixed now.
- "Ask me each time": the survivors go to the user in one ask, at most three to a
  question, and the ones picked are fixed now. A blocker or high not picked
  carries `overridden: true` in its ruling, since the user let it stand.

Each fix is committed as section 3 commits, its hash set as that ruling's
`fix_commit`. A finding that a command doesn't show its line is fixed by
recording the commands again as section 4 does, while the story is in review,
and committing the story file as section 3 commits; it isn't reviewed again. A
fix's own range gets `risk-check run` from the review's HEAD, and its fire on a
match. Then write `.planning/agile/tasks/{story}/payload-{reviewed}-{HEAD}.json`,
`{reviewed}` being the head the reviewer read and `{HEAD}` the one now, both
short, as references/review-record.md composes it, with each reviewer that ran
as its own voice, its return verbatim, and one ruling for each finding, and
record it. It stays there until
section 8 has settled the lows, so a cleared run still has them, and
`record-exists` means a run cut short recorded it already:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" adjudication --phase 0 --trigger diff --discriminator {Base}-{reviewed} --base {Base} --head {reviewed} --payload .planning/agile/tasks/{story}/payload-{reviewed}-{HEAD}.json --task {story}
```

Remove the `.diff` file.

**Either way**, note the review in the story, in one line: who reviewed, how
many findings and what came of them. The checks don't run without it.

```
{"story": "{story}", "review": "..."}
```

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" note --payload <that file>
```

## 6. Checks

Note anything done differently from what the story says it delivers first, as
section 5 notes the review, with `differently`, since a done story takes no
more notes. With nothing, leave it out.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" move --to review
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" run-checks
```

`status: done` goes to section 8. `in-progress` goes to section 7, or to section
8 once this run has had its fix round, the story staying in progress.

## 7. One fix round

A run gets one. Read what each failed check printed. A commit past the last one
the Commits line names, or a change in the tree, that touches something outside
`.planning/` is a fix already made, by the user after an earlier run's round or
by a run cut short: commit what's uncommitted as section 3 does, take it as this
round's fix, and go on from the `risk-check run` below. A record commit, or what
`run-checks` wrote in the story file, isn't one.

With none, when the command is what's wrong, a check that can't show its line
whatever the code does, record the commands again as section 4 does and commit
the story file as section 3 does. That clears the review, so note the round and go to
section 5, which reviews the new commands. Otherwise fix the code, commit it as
section 3 does, and run `risk-check run` from the last commit the Commits line
names to HEAD, with its fire on a match. Then note the round, which sets the
checks back to `not run`, and go to section 6:

```
{"story": "{story}", "fix_round": "check {n}: what was wrong and what fixed it, in {hash}"}
```

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" note --payload <that file>
```

A check still failing after the round leaves the story in progress, and the
next story doesn't start until it passes.

## 8. Lows and the record

A survivor nobody fixed, a low under "Fix them, ask about lows" or one not
picked under "Ask me each time", goes to the user, as
references/triage-gate-unfixed.md states, with `issue-filing.mjs unfixed` and
`file` over each `payload-*.json` in `.planning/agile/tasks/{story}/`, one ask
for each. With none, nothing is asked. Then remove those files.

Then one commit of the story's record and nothing else the user has staged,
unless agile.md's `commit` printed `IGNORED` or `planning.commit_docs` is false.
Push nothing:

```
set -- '.planning/agile/epics/{id}/{story}.md'
[ -d '.planning/agile/tasks/{story}' ] && set -- "$@" '.planning/agile/tasks/{story}'
for f in '.planning/agile/epics/{id}/epic.md' .planning/agile/backlog.md .planning/agile/declined.md .planning/agile/filed.md; do [ -f "$f" ] && [ -n "$(git status --porcelain -- "$f")" ] && set -- "$@" "$f"; done
git add -A -- "$@"
git commit -m "docs({story}): record its build" -- "$@"
```

Close this run's bracket, with `--detail-file <path>` naming why when the story
isn't done:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase 0 --plan {story} --role cad-agile
```

## 9. Report

```
Story: {story} {title}, {done | in progress: check {n} failed after its fix round, {what it printed} | sized L, back to be cut again: {why} | stopped: {why}}
Commits: {the Commits line}
Review: {the Review line}
Checks: {passed} of {N}
Record: {hash, or "none - " and why}

Next: {agile.mjs next's step, its id, and the story's id and title for a build}, with /cad-agile
```
