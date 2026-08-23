---
name: cad-why
description: "Why is this code like this - a git-log chain over one file[:line], joined to the phase, task, decision, deviation and review record on disk"
argument-hint: "<path>[:<line>]"
allowed-tools:
  - Bash
---

<objective>
Answer "why is this code like this" from the record already on disk, at one
file and line. Read-only: no write, no dispatch, no summarization - the seam
does the whole join and this skill relays what it returns.
</objective>

<process>
1. Run the seam with the query as ONE single-quoted literal word:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/why.mjs" '<path>[:<line>]' --dir .`
   Single quotes, never double: `$ARGUMENTS` is caller-supplied, and a
   double-quoted `$(...)` or backtick inside it runs before Node starts. A
   query containing a single quote is refused here, never escaped. Parse the
   one JSON line it prints.
2. `ok:false` - state the `reason` and `detail` fields plainly and stop.
3. `ok:true` - print the `text` field VERBATIM and nothing else: no summary
   before it, no commentary after it, no reformatting. `text` is already the
   whole answer, quoted from the record in its own words - reformatting it
   here would make the byte-identity a reader can check against the seam's
   own output false.
</process>
