# Pause and resume

You should be able to end a session without writing a second account of everything it did. Cadence keeps the roadmap, decisions, plans and results in the repository so the next session can read them.

## Find your place

```text
/cadence:cad-progress
```

Progress derives the state from phase artifacts and Git, using the state cursor as a hint. It identifies incomplete or paused work and offers the next step.

| State | What it means |
|---|---|
| Unplanned | The phase has no plan yet. |
| Planned | Plans exist and execution remains. |
| Executed | A summary exists, but verification hasn't fully passed. |
| Complete | The phase's recorded completion conditions are satisfied. |

A summary isn't proof that every later gap plan has run. Progress also checks for outstanding plans and deferred reviews.

The normal progress command can reconcile a stale state cursor. For a read-only summary, use `/cadence:cad-progress --stats`; `--trace` gives a read-only view of what the current phase's run did.

## Leave a deliberate pause

```text
/cadence:cad-pause Finish the parser error handling, then rerun its tests
```

Pause preserves in-flight work with a WIP commit when there are changes, then records a one-line resume pointer. It also commits the cursor update. **It is a committing command**, not just a bookmark.

Your note should name the next concrete action. “Finish the parser error handling” helps the next session more than “continue working.”

When you return, run `/cadence:cad-progress`. It reads the pause note and offers to resume from there.

## Capture a thought without changing the phase

```text
/cadence:cad-capture todo Add a JSON output mode in a later phase
```

Capture parks a todo, seed or note without making it part of the current implementation. It gives the idea somewhere to go without reopening the task you're trying to finish.

## After an interrupted run

Start with progress. If an executor stopped partway through, execution checks its report against the commits before offering to continue the remaining tasks. Completed work shouldn't be repeated merely because the session ended.

If the planning files disagree or can't be read, `/cadence:cad-health` reports structural problems. Use that evidence to resolve the state rather than marking work complete from memory.
