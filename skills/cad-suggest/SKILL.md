---
name: cad-suggest
description: "Turn the run record into evidence-backed retune suggestions - each with its config key, the value in force, a direction and a target - and offer to route the ones you accept to /cad-config"
argument-hint: "[phase]"
allowed-tools:
  - Bash
  - SlashCommand
---

<objective>
The retune the run record supports, read back to you: every tweak under a
heading of its own carrying its config key, the value in force, the direction to
move it and the target where the record prices one, with the receipts that ask
for nothing kept separate below. Every figure comes from
`planning.mjs trace suggest` - this command relays the record, it never
recomputes it and it writes no config key itself. It ends by offering to route
the tweaks you accept to `/cad-config`, which is where a write would happen. No
argument spans the whole record; a phase number scopes it.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/suggest.md
</execution_context>

<process>
Execute end-to-end.
</process>
