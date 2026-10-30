# STATE.md template

Write to `.planning/STATE.md`. A cursor of four required lines plus an optional
`Plan:` line, overwritten in place, never appended. No audit logs, no activity tables, no progress bars - git history
is the log. Schema and status lifecycle are pinned in references/conventions.md.

<template>

```markdown
# State

Phase: [N] of [total] ([phase name])
Plan: [K] of [J] ([plan name])   (optional: written only while a plan is unfinished)
Status: [ready to plan | context gathered | planned | executed | phase complete | paused]
Next: [the one command to run next, e.g. /cad-context 1]
Updated: [YYYY-MM-DD]
```

</template>
