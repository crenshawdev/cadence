# Review: running the reviewers off the workflow path

Step 4 of `references/review-triggers.md` sends a fire here when it does not take
the workflow path. The path decision and the cross-model bullet stay in that step.

Issue the resolved set in ONE message (seam-spawn-agent.md Concurrent
dispatch); serialize only when one dispatch consumes another's output, which a
reviewer set never does. Per backend:

- **claude-subagent**: bracket this worker in the joined run record first, keyed
  `--plan cad-reviewer --role cad-reviewer`, with `--read` carrying the payload
  reference step 2 assembled - the file path(s) for shape (c), the
  `<base_ref>..<head_ref>` pair for shapes (a) and (b), the named scope for an
  in-context artifact. Never empty: resolving that reference is step one of the
  reviewer's own contract (`skills/cad-reviewer-contract`), so it is exactly what
  this site causes it to read, and the read-set grammar admits a non-path
  reference as readily as a path. (The bracket stays a standalone append HERE,
  not `--bracket-read` on the step-1 resolve: that resolve fires for every
  backend, and a cross-model-only fire dispatches no claude-subagent - the flag
  there would record a worker that never ran.)

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent --read "<the payload reference>"
  ```

  `--reviewer` names the backend that ACTUALLY ran, never the one the trigger
  asked for: with `review.reviewers` set to a provider and this arm dispatched
  anyway, that substitution is what the record has to be able to show, since
  nothing refuses it (step 3). Pass it on the close too - a bracket half that
  drops it says the return came from somewhere else.

  `<N>` is the phase in hand, or the STATE cursor's phase for a
  milestone-scoped trigger.

  Then dispatch the `agent_type` and `model` the step-1 resolve
  returned, through the spawn-agent seam, with the payload as its prompt. It
  gets the refs, the scope, or the path and PRODUCES the artifact itself - it
  holds Read, Bash, Grep, Glob and LSP and shares this cwd. Parse
  the JSON object it returns, and close the bracket the moment you have it.
  OMIT `--tokens` on a figureless return (seam-spawn-agent.md's bracket rule):

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --agent-id <the id on the subagent return> --reviewer claude-subagent --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return>
  ```

  A dispatch that failed, returned nothing, or returned an unparseable object
  writes what failed to a scratch file and adds `--detail-file <path>` to that
  same line (caller-derived text - references/conventions.md), and the seam
  closes it as a checkpoint - a reviewer that burned its budget and came back
  unusable is exactly the dispatch whose cost must still reach the record.

  **An `advisory` gate inverts the bracket's writer.** No fire site halts on an
  advisory return, and the overlapped fires (`plan`'s advisory arm, `diff`'s
  advisory arm on a non-final plan) can end their session before it lands - a
  dispatch recorded with findings and return lost is a review that burned a
  full dispatch to report to nobody. So when step 1 resolved the gate
  `advisory`, the DISPATCH PROMPT carries a persistence tail and the REVIEWER,
  not this site, closes the bracket. The reviewer's heredoc makes no parent
  folder, so BEFORE the dispatch this site makes the phase's records folder
  (a link there is refused), with `<N>` as the bracket above names it:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" records-dir --phase <N>
  ```

  The tail carries:
  - the findings path `.planning/phases/<N>/records/REVIEW-<trigger>.md` (a per-plan
    fire suffixes it: `REVIEW-diff-plan-<k>.md`), where the reviewer writes
    the same JSON object it returns, and
  - the return-append command above with `${CLAUDE_PLUGIN_ROOT}` already
    expanded to its absolute path (the subagent does not inherit the variable)
    and NO `--tokens` - a subagent never sees its own figure.
  This site then appends NO return and no checkpoint for an advisory fire,
  even when the return does land in-session - two writers on one bracket is a
  double-close. The step that reports advisory findings reads the FILE; a path
  not yet on disk is reported as "review in flight - findings land at <path>",
  never as a clean pass. The trade is stated, not hidden: advisory reviewer
  returns carry no token figure in the trace (figureless by construction) -
  durability of findings over pricing fidelity, and the overlapped fire was
  already losing both.

  That agent is the reviewer rung `roles.cad-reviewer.effort` names -
  `cad-reviewer-medium` on the schema default, whichever of the five rungs a
  config layer wrote instead, and one rung higher on an `--attempt 2` fire when
  `model.escalate_on_failure` is on. The resolve's own `agent_type`,
  never a list here, is what dispatches; its bare `agent` is what any mismatch line names. The per-trigger
  `effort` is NOT
  passed and cannot be - the seam's surface is `(agent_name, prompt, model?)` -
  so the reviewer runs at the `effort:` its own rung file pins.
  **When the RESOLVED per-trigger effort differs from the rung actually
  dispatched, say so in one line before dispatching**, e.g. "`diff` resolves at
  effort `low`; `roles.cad-reviewer.effort` picks `cad-reviewer`, pinned at
  `high`, so it runs `high` - per-trigger effort reaches cross-model reviewers
  only". One line
  per fire, not per reviewer, and nothing when the two agree. A resolved value
  the backend cannot deliver is a degradation like any other: name it. Do not
  "fix" it by editing the config or by pretending the effort applied.