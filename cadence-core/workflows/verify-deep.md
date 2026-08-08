# cad-verify deep pass (cold branch)

The goal-backward cad-verifier pass. Loaded from verify.md `deep_check` when
it actually runs; return to verify.md `walk` afterward.

<step name="dispatch">
Bracket this worker in the joined run record first - one lifecycle event before
the spawn-agent seam call below, keyed `--plan cad-verifier`, which is the WORKER
key the trace's pairing rule takes for a role-dispatched worker:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-verifier
```

Dispatch cad-verifier via the spawn-agent seam with the phase number, goal,
the current UAT items, the PLAN/SUMMARY/ROADMAP paths, and the path it must
write: `.planning/phases/<N>/verifier-findings.json`. It writes exactly that
one file and returns a digest plus that path. Its contract is its own
(`skills/cad-verifier-contract`) and is not restated here.

A failed, empty, or timed-out dispatch goes to `fall_through`. Otherwise
continue to `merge`. There is no verifier retry to bracket: those are the only
two arms, and `fall_through` is the single terminal failure one both share.
</step>

<step name="merge">
The dispatch came back, so close its bracket before anything else:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event return --plan cad-verifier
```

One call. The verifier's file goes in as it was written - nothing is
transcribed, reshaped, or copied by hand:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat merge --phase <N> \
  --payload .planning/phases/<N>/verifier-findings.json
```

An `ok:false` return goes to `fall_through`, whatever its reason.

The seam enforces the merge rules structurally: verifier results only fill
`pending` items (a user-recorded result is never overwritten - a conflicting
finding is skipped and counted), unmatched gaps append as new failed items,
human checks append as pending. An entry resolving to no usable item name is
rejected and counted, never appended as a nameless item. Failed items route
through verify.md `route_failures` exactly like user-reported failures.

Report the seam's one-line summary (`auto_passed`, `gaps`, `added`, `skipped`,
`rejected`), then return to verify.md `walk`.

Two files, two writers, and never the same one. The VERIFIER writes
`verifier-findings.json` - its findings, the merge's input. The SEAM writes
`.planning/phases/<N>/FINDINGS.json` - those same counters plus
`rejected_entries` and `skipped_entries`, holding the entries it discarded
verbatim, so a finding counted and then dropped survives the dispatch that
produced it. The seam overwrites its own file on every successful merge,
which is precisely why the verifier's may not carry that name.
</step>

<step name="fall_through">
The one terminal failure arm, shared by both branches above so neither can
grow a private error path.

Close the worker's bracket with that same one line as its reason - this arm is
the only place a deep pass can end unfinished, so an unclosed bracket here is
what `trace render` would report as an unpaired worker:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event checkpoint --plan cad-verifier --detail "<what failed>"
```

Say in ONE line what failed, write nothing else, and return to verify.md `walk`
with the checklist as-is. The deep pass is an accelerator, never a gate on
the human walk - a broken dispatch or a refused merge costs speed and the
auto-verified items, and nothing else. The phase is still verified by the
walk.
</step>
