---
name: cad-capture
description: "Capture without losing your place - an actionable phase-linked todo (the queue mem-* lacks), a seed idea for a future milestone, or a note. One file: .planning/CAPTURE.md, which the builtin memory backend makes recallable at planning time"
argument-hint: "[todo | seed | note] <text> [--phase N]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Get a thought out of your head and into the right place without derailing. Three
kinds, one file (`.planning/CAPTURE.md`):
- **todo** - an actionable item, tagged to a phase, so it resurfaces where it
  matters. This is the phase-linked queue mem-* lacks and the reason this exists.
- **seed** - an idea for a future phase or milestone, parked in the backlog.
- **note** - a free note; lands in the file like the rest. With
  `memory.backend: builtin` (the default) the note becomes recallable - it is
  still written here, `builtin` only reads `.planning/` back, never relocates
  the write.
</objective>

<process>
1. **Parse** `$ARGUMENTS`: leading `todo | seed | note` (default `todo` if
   omitted), the text, and an optional `--phase N`. If a todo has no `--phase`,
   default to the current phase from the STATE cursor (`cursor get`); if the
   cursor is absent or unparseable, capture it unphased - `- [ ] <text>` with
   no phase tag - rather than guessing a phase or stopping.

2. **Ensure the file.** If `.planning/CAPTURE.md` is absent, create it with three
   headings: `## Todos`, `## Seeds`, `## Notes`. (When step 1 needs `cursor get`,
   batch it with this existence check in one message - independent;
   conventions.md Parallel work.)

3. **Append by kind:**
   - todo -> `- [ ] (phase N) <text>` under `## Todos`.
   - seed -> `- <text>` under `## Seeds`.
   - note -> `- <YYYY-MM-DD> <text>` under `## Notes`. (CAPTURE.md is always
     the write path; `memory.backend: builtin` makes these notes recallable
     via `planning.mjs recall`, and `none` turns that recall off.)

4. **Persist.** Stage ONLY `.planning/CAPTURE.md` and commit `docs: capture
   <kind>` (protected-branch guard applies) - this never touches the user's
   in-flight changes. Report the one line captured and where.
</process>

<guardrails>
- Do not act on the item now - capture is parking, not doing. A todo is queued,
  not executed.
- Stage only CAPTURE.md; never sweep the user's working changes into the commit.
</guardrails>
