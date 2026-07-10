---
name: cad-capture
description: "Capture without losing your place - an actionable phase-linked todo (the queue mem-* lacks), a seed idea for a future milestone, or a note. One file: .planning/CAPTURE.md. Notes route to the memory backend when one is configured"
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
- **note** - a free note; routes to the memory backend if `memory.backend` is
  set, else lands in the file (built-in minimal - a generic install has no mem-*).
</objective>

<process>
1. **Parse** `$ARGUMENTS`: leading `todo | seed | note` (default `todo` if
   omitted), the text, and an optional `--phase N`. If a todo has no `--phase`,
   default to the current phase from the STATE cursor.

2. **Ensure the file.** If `.planning/CAPTURE.md` is absent, create it with three
   headings: `## Todos`, `## Seeds`, `## Notes`.

3. **Append by kind:**
   - todo -> `- [ ] (phase N) <text>` under `## Todos`.
   - seed -> `- <text>` under `## Seeds`.
   - note -> if `memory.backend` is not `none`, hand the note to that backend
     (the memory hook) and say so; otherwise `- <YYYY-MM-DD> <text>` under
     `## Notes`.

4. **Persist.** Stage ONLY `.planning/CAPTURE.md` and commit `docs: capture
   <kind>` (protected-branch guard applies) - this never touches the user's
   in-flight changes. Report the one line captured and where.
</process>

<guardrails>
- Do not act on the item now - capture is parking, not doing. A todo is queued,
  not executed.
- Stage only CAPTURE.md; never sweep the user's working changes into the commit.
</guardrails>
