# Portability seams

Cadence runs on Claude Code only. These three seams are the ONLY places where
host-runtime specifics may appear. Workflows and skills reference the seam by
name and follow its binding; they never inline host-specific alternatives.
A future runtime port edits these seam files, not the workflows.

Each seam's binding lives in its own file. Name the seam this call is, Read
that ONE file, and leave the other two unopened.

## The three seams

- **ask-user** - a workflow puts a question to the human and blocks on the
  answer, structured choice or open prose. Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`.
- **spawn-agent** - a workflow dispatches work to a fresh-context subagent,
  which includes routing that dispatch and bracketing it on the record. Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-spawn-agent.md`.
- **call-review-provider** - the review subsystem reaches a cross-model
  reviewer over HTTPS. The default `claude-subagent` backend does NOT use this
  seam and goes through spawn-agent instead. Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-review-provider.md`.

## Rule index

Which of the three holds a rule other surfaces cite by name.

**`seam-ask-user.md`** - the recommended-option convention and its
display-convention-never-a-pre-selection clause; the option and question caps;
never fabricating or defaulting an answer the seam was to collect; the
deliberate no-default decisions.

**`seam-spawn-agent.md`** - the bracket rule (`The bracket rides the resolve.`),
which is where the close half's `--tokens` and `--turns` discipline is stated,
once; the relay rule for the `warnings[]` a `route.mjs resolve` returns;
Routing (the quality bundle), the stakes FLOOR and its waiver, the per-role pin
and the per-role start rung; Concurrent dispatch; Prompt shape (cache
discipline); Return shape (bounded handoff); Handoff read discipline; File
round-trip, which is the break-even test every deferred read is judged on;
Worktree isolation and `worktree.baseRef`; the `maxTurns` turn bound and the
two producers of an unusable return.

**`seam-review-provider.md`** - the degradation reason set; the prompt cap
`over-cap` enforces and the `claude-subagent` exemption from it; key
resolution, and that a workflow passes no key.
