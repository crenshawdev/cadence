# cad-verify deep pass (cold branch)

The goal-backward cad-verifier pass. Loaded from verify.md `deep_check` when
it actually runs; return to verify.md `walk` afterward.

Dispatch cad-verifier via the spawn-agent seam with the phase number, goal,
the current UAT items, and the PLAN/SUMMARY/ROADMAP paths. It returns
structured findings (per-truth status + evidence, gaps, human checks) and
writes nothing.

Merge its findings through the uat seam - one call, stdin payload:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat merge --phase <N> --findings -
```

```json
{"passes":[{"name":"<item name>","evidence":"<file:line or command output>"}],
 "gaps":[{"name":"<item or new gap>","reason":"<why it fails>","evidence":"...","severity":"major"}],
 "human_checks":[{"name":"...","expected":"..."}]}
```

The seam enforces the merge rules structurally: verifier results only fill
`pending` items (a user-recorded result is never overwritten - conflicting
verifier findings are dropped), unmatched gaps append as new failed items,
human checks append as pending. Failed items route through verify.md
`route_failures` exactly like user-reported failures.

Report the seam's one-line summary (`auto_passed`, `gaps`, `added`).
