# Bring a design brief

You may have already spent an evening working through the idea. Save what you settled and let Cadence start there.

```text
/cadence:cad-new-project --brief docs/design-brief.md
```

Replace the path with your own file. Cadence reads the brief, tells you what it understands to be decided, and asks about what remains open. You can correct that reading before it becomes the project plan.

## What to put in it

A useful brief explains the problem, who has it, what you're trying to achieve and the constraints you've accepted. Include what you deliberately won't build. Those boundaries matter when the next plausible idea turns up.

Keep decisions separate from hypotheses. If you haven't measured the performance, settled the data format or chosen a provider, say so. A confident paragraph can make an unresolved question look like a requirement.

There's no required template. The brief can come from a conversation, your own notes or an existing design document. It needs enough context for someone who wasn't in the conversation to understand your choices.

For example:

> I want a CLI that checks a directory of Markdown files for broken local links. It's for my own documentation repositories. It should report the source file and line, and return a failing exit status when a link is broken. It won't check external URLs or modify files. I haven't decided how to handle links into generated pages.

That gives Cadence a concrete goal, useful limits and a question still worth asking.

The brief changes where questioning starts. Setup still produces requirements and a roadmap, offers the testing policy, and asks you to review the result. From there, continue with [your first phase](first-phase.md).

If the repository already contains an implemented project, use `/cadence:cad-adopt` so the code informs the starting point.
