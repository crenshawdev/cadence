# cad-verify deep pass (cold branch)

The goal-backward cad-verifier pass. Loaded from verify.md `deep_check` when
it actually runs; return to verify.md `walk` afterward.

<step name="dispatch">
Dispatch cad-verifier on the input composed below, via the spawn-agent seam with
`--bracket-read "<the verifier input path>"` on its resolve. Hand it the phase
number, the goal and the path it must write:
`.planning/phases/<N>/records/verifier-findings.json`. A refused compose hands
over the PLAN, SUMMARY and ROADMAP paths, `UAT.md` and the current UAT items,
and brackets those paths instead. With `testing.scope` set (read in verify.md
`build_or_resume`), the prompt also says "A testing policy is active." and hands
over the suite command, resolved as verify.md `walk` states. The verifier writes
exactly that one file and returns a digest plus that path. Its contract is its
own (`skills/cad-verifier-contract`) and is not restated here.

The verifier reads one composed input in place of the PLAN, SUMMARY and ROADMAP paths and the UAT items.

- **Compose.** Make the scratch directory and print it: `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "scratch dir: $D"`. Keep the printed path as a literal, because each Bash call starts with `$D` empty, then run:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" brief --phase <N> --role verifier --out-dir <the scratch directory>
  ```

  Keep the path the answer names as a literal too. The transcript gets the envelope, never the input, and this session opens neither it nor the documents.
- **Bracket.** The resolve's `--bracket-read` value is `<the verifier input path>`.
- **Dispatch.** Hand it the phase number, the goal, that file by its absolute path in place of the document paths and the UAT items it already carries, and the findings path above, plus the testing-policy sentence and suite command when they apply, as above.
- **A refused or unreadable answer.** Print one line with what it names, and dispatch with the document paths and the UAT items, as the paragraph above lists them.

Close the bracket HERE, the moment the return is in hand and before either arm
is taken - the dispatch ends exactly once, so it closes exactly once:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-verifier --role cad-verifier --agent-id <the id on the subagent return> --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return> --detail-file <path>
```

On a failed, empty or timed-out dispatch, what failed goes to a scratch file and
`--detail-file` carries its PATH. The rest of this line is seam-spawn-agent.md's
bracket rule.

A failed, empty, or timed-out dispatch then goes to `fall_through`. Otherwise
continue to `merge`.
</step>

<step name="merge">
One call. The verifier's file goes in as it was written - nothing is
transcribed, reshaped, or copied by hand:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat merge --phase <N> \
  --payload .planning/phases/<N>/records/verifier-findings.json
```

An `ok:false` return goes to `fall_through`, whatever its reason.

Unmatched gaps append as failed items and human checks as pending. A finding on
an item already recorded is skipped, and an entry with no usable item name is
rejected. Failed items route through verify.md `route_failures` exactly like
user-reported failures.

Report the seam's one-line summary (`auto_passed`, `gaps`, `added`, `skipped`,
`rejected`), then return to verify.md `walk`.
</step>

<step name="fall_through">
The bracket is already closed. Say in ONE line what failed, write nothing else,
and return to verify.md `walk` with the checklist as-is.
</step>
