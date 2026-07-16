# cad-verify deep pass (cold branch)

The goal-backward cad-verifier pass. Loaded from verify.md `deep_check` when
it actually runs; return to verify.md `walk` afterward.

Dispatch cad-verifier via the spawn-agent seam with the phase number, goal,
the current UAT items, and the PLAN/SUMMARY/ROADMAP paths. It returns
structured findings (per-truth status + evidence, gaps, human checks) and
writes nothing. On a failed, empty, or timed-out dispatch: say so and
continue to the walk with the checklist as-is - the deep pass is an
accelerator, never a gate on the human walk.

Merge its findings through the uat seam - one call, payload on stdin:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat merge --phase <N>
   stdin: the payload below
```

```json
{"passes":[{"k":1,"name":"<item name>","evidence":"<file:line or command output>"}],
 "gaps":[{"k":2,"name":"<item or new gap>","reason":"<why it fails>","evidence":"...","severity":"major"}],
 "human_checks":[{"name":"...","expected":"..."}]}
```

Building the payload is a copy, not a translation - the verifier's report
already speaks these field names: `passes` come from the Truths table's
VERIFIED rows that carry a UAT item number (k + evidence); `gaps` and
`human_checks` entries copy over field-for-field (`k`/`name`/`reason`/
`evidence`/`severity`, `name`/`expected`; the verifier's extra `missing` and
`why_human` lines inform route_failures but are not part of the payload).
Entries match existing items by `k` or exact `name`; unmatched gaps append.

The seam enforces the merge rules structurally: verifier results only fill
`pending` items (a user-recorded result is never overwritten - conflicting
verifier findings are dropped), unmatched gaps append as new failed items,
human checks append as pending. Failed items route through verify.md
`route_failures` exactly like user-reported failures.

Report the seam's one-line summary (`auto_passed`, `gaps`, `added`).
