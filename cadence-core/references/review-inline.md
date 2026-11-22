# Review: running the reviewers off the workflow path

Step 4 of `references/review-triggers.md` sends a fire here when it does not take
the workflow path. The path decision and the cross-model bullet stay in that step.

Issue the resolved set in ONE message (seam-spawn-agent.md Concurrent
dispatch). Per backend:

- **claude-subagent**: bracket this worker in the joined run record first, keyed
  `--plan cad-reviewer --role cad-reviewer`, with `--read` carrying the payload
  reference step 2 assembled - the file path(s) for shape (c), the
  `<base_ref>..<head_ref>` pair for shapes (a) and (b), the named scope for an
  in-context artifact. Never empty: resolving that reference is step one of the
  reviewer's own contract (`skills/cad-reviewer-contract`). The bracket is a
  standalone append HERE, not `--bracket-read` on the step-1 resolve, which
  fires for every backend, including a cross-model-only fire that dispatches no
  claude-subagent.

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent --read "<the payload reference>"
  ```

  `--reviewer` names the backend that ACTUALLY ran, never the one the trigger
  asked for: with `review.reviewers` set to a provider and this arm dispatched
  anyway, the record must show that substitution (step 3). Pass it on the close
  too.

  `<N>` is the phase in hand, or the STATE cursor's phase for a
  milestone-scoped trigger.

  Then dispatch the `agent_type` and `model` the step-1 resolve returned,
  through the spawn-agent seam, with the payload as its prompt; it produces the
  artifact itself in this cwd. Parse the JSON object it returns, and close the
  bracket the moment you have it, under seam-spawn-agent.md's bracket rule:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --agent-id <the id on the subagent return> --reviewer claude-subagent --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
  ```

  A dispatch that failed, returned nothing, or returned an unparseable object
  writes what failed to a scratch file and adds `--detail-file <path>` to that
  same line (caller-derived text - references/conventions.md).

  **An `advisory` gate inverts the bracket's writer.** No fire site halts on an
  advisory return, and an overlapped fire (`plan`'s advisory arm, `diff`'s
  advisory arm on a non-final plan) can end its session before it lands. So
  when step 1 resolved the gate `advisory`, the DISPATCH PROMPT carries a
  persistence tail and the REVIEWER, not this site, closes the bracket. BEFORE
  the dispatch this site makes the phase's records folder (the reviewer's
  heredoc makes no parent folder; a link there is refused), with `<N>` as
  above:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" records-dir --phase <N>
  ```

  The tail carries:
  - the findings path `.planning/phases/<N>/records/REVIEW-<trigger>.md` (a per-plan
    fire suffixes it: `REVIEW-diff-plan-<k>.md`; a `risk_surface` fire takes its
    discriminator), where the reviewer writes the same JSON object it returns, and
  - the return-append command above with `${CLAUDE_PLUGIN_ROOT}` already
    expanded to its absolute path (the subagent does not inherit the variable)
    and NO `--tokens`, `--turns`, `--duration-ms` or `--agent-id`.
  This site then appends NO return and no checkpoint for an advisory fire,
  even when the return lands in-session - two writers on one bracket is a
  double-close. The step that reports advisory findings reads the FILE; a path
  not yet on disk is reported as "review in flight - findings land at <path>",
  never as a clean pass.

  That agent is the reviewer rung `roles.cad-reviewer.effort` names -
  `cad-reviewer-medium` on the schema default, whichever of the five rungs a
  config layer wrote instead, and one rung higher on an `--attempt 2` fire when
  `model.escalate_on_failure` is on. The resolve's own `agent_type` dispatches;
  its bare `agent` is what any mismatch line names. The per-trigger `effort`
  cannot be passed - the seam's surface is `(agent_name, prompt, model?)` - so
  the reviewer runs at the `effort:` its own rung file pins.
  **When the RESOLVED per-trigger effort differs from the rung actually
  dispatched, say so in one line before dispatching**, e.g. "`diff` resolves at
  effort `low`; `roles.cad-reviewer.effort` picks `cad-reviewer`, pinned at
  `high`, so it runs `high` - per-trigger effort reaches cross-model reviewers
  only". One line per fire, not per reviewer, and nothing when the two agree.
  Do not "fix" it by editing the config or by pretending the effort applied.
