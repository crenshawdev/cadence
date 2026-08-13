---
name: cad-suggest
description: "Turn the run record into evidence-backed retune suggestions - each with the trace figures behind it and the config key it concerns - and apply none of them"
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Read the retune the run record supports back to you: every suggestion carrying
the trace figures that produced it and the config key it concerns, every
receipt line named, and nothing applied. Every figure comes from
`planning.mjs trace suggest` - this command relays the record, it never
recomputes it and never writes a config key. No argument spans the whole
record; a phase number scopes it.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/suggest.md
</execution_context>

<process>
Execute end-to-end.
</process>
