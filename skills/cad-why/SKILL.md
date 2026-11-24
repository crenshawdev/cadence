---
name: cad-why
description: "Why is this code like this - a git-log chain over one file[:line], joined to the phase, task, decision, deviation and review record on disk"
argument-hint: "<path>[:<line>]"
---

<objective>
Answer "why is this code like this" from the record on disk, at one file and
line. Read-only: no write, no dispatch.
</objective>

<process>
1. Run the seam with the query as ONE single-quoted literal word:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/why.mjs" '<path>[:<line>]' --dir .`
   Single quotes, never double: a double-quoted `$(...)` or backtick inside it
   runs before Node starts. A query containing a single quote is refused here,
   never escaped. Parse the one JSON line it prints.
2. `ok:false` - state the `reason` and `detail` fields plainly and stop.
3. `ok:true` - print the `text` field VERBATIM and nothing else: no summary
   before it, no commentary after it, no reformatting.
</process>
