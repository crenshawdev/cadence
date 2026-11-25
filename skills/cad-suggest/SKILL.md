---
name: cad-suggest
description: "Turn the run record into evidence-backed retune suggestions - each with its config key, the value in force, a direction and a target - and offer to route the ones you accept to /cad-config"
argument-hint: "[phase]"
allowed-tools:
  - SlashCommand
  - PushNotification
---

<objective>
Read back the retune the run record supports. A phase number scopes it.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/suggest.md
</execution_context>

<process>
On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't), stop before anything else, with this line and nothing after it: "This
project is on the agile path. /cad-agile shows what comes next."

Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
