<purpose>
An on-demand refute-then-adjudicate pass over ONE load-bearing decision - a
`- D-NN (...)` line in a CONTEXT.md `## Durable decisions` / `## Decisions`
section, or a row in PROJECT.md's Key Decisions table. It reuses the review
subsystem (references/review-triggers.md): `cad-reviewer` (and, when
configured, a cross-model provider) refutes the decision, then the main model
grounds and rules each objection.
</purpose>

<process>

<step name="resolve_target">
Parse `$ARGUMENTS` for a path (from the invoking skill's `$ARGUMENTS`, a path
to an existing decision doc - a CONTEXT.md or PROJECT.md). If the path or the
decision is missing or unclear, ask (ask-user seam): "Which decision? (path to
a CONTEXT.md or PROJECT.md, plus which D-NN or Key Decisions row)". Read the
file and isolate:
- a CONTEXT.md: the named `- D-NN (area): decision. Evidence: ...` line
  under `## Durable decisions` or `## Decisions`.
- a PROJECT.md: the named row of the `## Key Decisions` table.

- an agile project's `project.md` or `epic.md`, under `.planning/agile/`: the
  named `S-NN` line, or the named line under Key decisions or Decisions.

If the file exists but the named decision cannot be found in it, say so and
stop - do not guess which line the user meant.
</step>

<step name="refute">
Assemble `{ instruction, artifact }`:
- `artifact` = the decision's exact text (statement + rationale/evidence) plus
  enough surrounding context (the phase goal, the CONTEXT.md scope boundary,
  or the PROJECT.md section it sits in) for a reviewer to judge it without
  re-deriving the whole document.
- `instruction` = "Refute this decision. Find the case, constraint, or
  alternative under which it is wrong, already contradicted by the codebase,
  or costs more than it claims to save. Do not critique wording - attack the
  decision itself."

The reviewer set is `review.reviewers[]`, filtered as the two arms below state:
- **claude-subagent** (always available): bracket this worker in the joined
  run record first. `<N>` is the phase whose CONTEXT.md holds the D-NN; for
  a PROJECT.md row it is the STATE cursor's phase (references/review-inline.md).
  On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
  doesn't) it is 0, under a run this command opens first:

  ```
  A="$(git rev-parse --short HEAD)-$$-$(date +%s)"
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family lifecycle --event phase_start --sha "$A"
  ```

  The read-set is the decision doc the USER named, so write that reference to
  a scratch file and pass the path (caller-derived text - references/conventions.md):

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent --read-file <path>
  ```

  Then dispatch the `agent_type` that
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" agent-type --stem cad-reviewer`
  prints (on `{ok:false}`, the bare `cad-reviewer`) through the
  spawn-agent seam with the payload above as its prompt. Parse the returned
  `{findings:[...]}`, then close under seam-spawn-agent.md's bracket rule:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --agent-id <the id on the subagent return> --reviewer claude-subagent --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
  ```

  When the dispatch failed or its return can't be parsed, write what failed to
  a scratch file and add `--detail-file <path>` to that line
  (caller-derived text - references/conventions.md).
  This arm resolves no routing at all: it runs at the session's model and at
  the effort its agent file pins, and `review.decision_review.tier` and
  `.effort` reach the cross-model arm below only.
- **cross-model** (any provider in `review.reviewers` - `openai`, `gemini`,
  `deepseek`, ...), only when `review.reviewers` names it AND the user-global
  config names it too - the `reviewers_global` list
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-reviewer`
  returns (relay its `warnings[]`, seam-spawn-agent.md), never a raw read of
  the global file -
  AND `review.providers.<name>.tiers[review.decision_review.tier]` is a
  non-null model id, read with `config.mjs get` on that key (null for a stored
  value that is not a model id): compose the payload file and check the run
  token as references/review-cross-model.md does, the reviewer brief followed
  by the `instruction` above, the `artifact` written to a file in that scratch
  directory as its third argument, then run the call-review-provider seam
  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" review \
    --provider <name> --model <resolved id> --effort <review.decision_review.effort> \
    --payload "<the echoed scratch directory>/payload.json" \
    [--key-file <review.key_file, only if set>]
  ```
  Read the one JSON line; `ok:false`
  drops that reviewer (name the reason, same degradation rule as
  review-triggers.md step 4) and single-model continues. Relay the envelope's
  `warnings[]` to the user.

When the resolved set has more than one reviewer (claude-subagent plus a
surviving cross-model provider, or several), dispatch them CONCURRENTLY in one
message (seam-spawn-agent.md concurrent dispatch; references/review-inline.md's
one-message batch).
</step>

<step name="adjudicate">
For EACH finding returned by step `refute` (an "objection" to the decision),
the main model grounds it before ruling:

- **Library/API claims** - when an objection cites how a library, framework,
  SDK, or API actually behaves, check it against documentation rather than
  the objection's or your own training-data assumption. When the Context7
  tools are available (`mcp__context7__resolve-library-id` then
  `mcp__context7__query-docs`), verify it live through them. When they are
  not, ground it against what the repo carries: the installed package
  source, the lockfile's resolved version, or vendored docs. A claim no
  documentation could check is never ruled from training data.
- **Factual/codebase claims** - when an objection cites what the code
  currently does or does not do, verify it with Read/Grep/Bash against the
  real repo, not the objection's paraphrase.
- Every run grounds at least one library/API claim by whichever of those
  routes is available, and at least one factual claim against the codebase;
  if the claim set has none of one kind, say so explicitly rather than
  skipping the requirement silently.

**Zero objections (a clean pass).** The requirement above retargets: ground
the DECISION'S OWN load-bearing claims - the assertions in its statement and
`Evidence:` clause which, if false, would invalidate it - by the same two rules. Report each `confirmed`
or `contradicted` with its citation. A `contradicted` claim is a finding the
refutation missed: rule it `survives` and amend it like any objection. If the
decision rests on no claim of one kind, name which and why.

Rule each objection exactly one of:
- `survives` - grounded and correct; the decision has a real, uncorrected gap.
- `partial` - grounded but overstated, narrower than claimed, or already
  partly mitigated; the decision needs adjustment, not reversal.
- `refuted` - the grounding kills it (the cited library/API behavior or
  codebase fact does not hold, or the objection misreads the decision).

For every `survives` or `partial` ruling, write a concrete amendment: the
exact change to the decision (or its implementation) that would close the
gap. `refuted` objections need no amendment - state why the grounding kills
them.
</step>

<step name="report_cost">
Report, qualitatively, with no token or dollar figure:
- which reviewers ran (`claude-subagent` always; the cross-model provider(s)
  and model id(s), when any ran)
- the `review.decision_review.tier` and `.effort` the cross-model call used,
  and that `cad-reviewer` ran at the session's model and its agent file's
  effort with neither key applied - say the second half even when no
  cross-model reviewer ran
- the call count (one `cad-reviewer` dispatch, plus one
  `review-provider.mjs` call per surviving cross-model reviewer)
- any reviewer that was offered but dropped (no-key, no tier assigned, not
  named by the user-global config), and why
</step>

<step name="present">
Present, per objection: the ruling, the grounding that produced it with its
citation, and the amendment (when ruled `survives`/`partial`). List every
library/API claim no documentation could check as unchecked.

On a clean pass, present the grounded load-bearing claims instead, each
`confirmed`/`contradicted` with its citation, and say no reviewer objected.
Never report it as a bare "no findings".

Close with the qualitative cost line from `report_cost`. Do NOT edit the
decision doc or any other file - this is a review, not an auto-apply; the user
decides what to amend and does it themselves (or via a follow-up
`/cad-context` correction, `/cad-task`, etc).
</step>

</process>

<guardrails>
- Never auto-fires: it runs only when the user invokes `/cad-decision-review`
  on a decision they chose. It has no entry in references/review-triggers.md's
  wiring table.
</guardrails>
