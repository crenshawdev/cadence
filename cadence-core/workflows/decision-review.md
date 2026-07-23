<purpose>
An on-demand refute-then-adjudicate pass over ONE load-bearing decision - a
`- D-NN (...)` line in a CONTEXT.md `## Durable decisions` / `## Decisions`
section, or a row in PROJECT.md's Key Decisions table. It reuses the review
subsystem (references/review-triggers.md): `cad-reviewer` (and, when
configured, a cross-model provider) refutes the decision; the main model
grounds each objection against Context7 and the real codebase, then rules it
`survives | partial | refuted` and lists concrete amendments.

This workflow never auto-fires (no entry in references/review-triggers.md's
wiring table). It runs only when a human invokes `/cad-decision-review
<path>` on a decision they chose to stress-test - durability (cad-context's
`## Durable decisions` filter) names candidates; picking one for this deeper
pass is the human's call, not a mechanical handoff.

The ruling and amendment list are this workflow's own prose output, not a
`review-provider.mjs` FINDING_SCHEMA change and not a new self-verify
CONTRACTS entry - the shared finding schema (`{findings:[...]}`) still comes
back from step 2 unchanged; step 3 is where this workflow's own judgment
turns those findings into a ruling.
</purpose>

<process>

<step name="resolve_target">
Parse `$ARGUMENTS` for a path (from the invoking skill's `$ARGUMENTS`, a path
to an existing decision doc - a CONTEXT.md or PROJECT.md). If missing, ask
(ask-user seam): "Which decision? (path to a CONTEXT.md or PROJECT.md, plus
which D-NN or Key Decisions row)". Read the file and isolate:
- a CONTEXT.md: the named `- D-NN (area): decision. Evidence: ...` line
  under `## Durable decisions` or `## Decisions`.
- a PROJECT.md: the named row of the `## Key Decisions` table.

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

Resolve the reviewer set exactly as references/review-triggers.md step 3
does, from `review.reviewers[]`:
- **claude-subagent** (always available): dispatch `cad-reviewer` through the
  spawn-agent seam with the payload above as its prompt. Parse the returned
  `{findings:[...]}`.
- **cross-model** (any provider in `review.reviewers` - `openai`, `gemini`,
  `deepseek`, ...), only when `review.reviewers` names it
  AND `review.providers.<name>.tiers[review.decision_review.tier]` is a
  non-null model id (rests on the Phase-1 REV-01 seam repair - a symlinked
  install must run this seam for real, not no-op): run the call-review-
  provider seam
  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" review \
    --provider <name> --model <resolved id> --effort <review.decision_review.effort> \
    [--key-file <review.key_file, only if set>]
  ```
  with `{instruction, artifact}` on stdin. Read the one JSON line; `ok:false`
  drops that reviewer (name the reason, same degradation rule as
  review-triggers.md step 4) and single-model continues.

If the resolved set (after any drops) is only `claude-subagent`, this is the
single-model default; when a cross-model provider survives, this is the
panel path. Either way, every reviewer's findings feed adjudication next -
there is no separate schema per path.
</step>

<step name="adjudicate">
For EACH finding returned by step `refute` (an "objection" to the decision),
the main model grounds it before ruling:

- **Library/API claims** - when an objection cites how a library, framework,
  SDK, or API actually behaves, verify it live via Context7
  (`mcp__context7__resolve-library-id` then `mcp__context7__query-docs`)
  rather than trusting the objection's or your own training-data assumption.
  Context7 is declared on THIS skill's main-model surface (D-08) - the
  read-only `cad-reviewer` subagent has no MCP tools, so this verification
  step only happens here, in adjudication.
- **Factual/codebase claims** - when an objection cites what the code
  currently does or does not do, verify it with Read/Grep/Bash against the
  real repo, not the objection's paraphrase.
- Every run must ground at least one library/API claim against Context7 and
  at least one factual claim against the codebase; if an objection set has
  none of one kind, say so explicitly rather than skipping the requirement
  silently.

Rule each objection exactly one of:
- `survives` - grounded and correct; the decision has a real, uncorrected gap.
- `partial` - grounded but overstated, narrower than claimed, or already
  partly mitigated; the decision needs adjustment, not reversal.
- `refuted` - the grounding kills it (the cited library/API behavior or
  codebase fact does not hold, or the objection misreads the decision).

For every `survives` or `partial` ruling, write a concrete amendment: the
exact change to the decision (or its implementation) that would close the
gap. `refuted` objections need no amendment - state why the grounding kills
them so the ruling itself is falsifiable, not asserted.
</step>

<step name="report_cost">
Report, qualitatively (D-09 - the runtime exposes no per-turn token/dollar
figures, so never fabricate one):
- which reviewers ran (`claude-subagent` always; the cross-model provider(s)
  and model id(s), when the panel path ran)
- the resolved `review.decision_review.tier` and `.effort`
- the call count (one `cad-reviewer` dispatch, plus one
  `review-provider.mjs` call per surviving cross-model reviewer)
- any reviewer that was offered but dropped (no-key, no tier assigned), and why
</step>

<step name="present">
Present, per objection: the ruling (`survives | partial | refuted`), the
grounding that produced it (the Context7 doc or codebase citation), and the
amendment (when ruled `survives`/`partial`). Close with the qualitative cost
line from `report_cost`. Do NOT edit the decision doc - this is a review, not
an auto-apply; the user decides what to amend and does it themselves (or via
a follow-up `/cad-context` correction, `/cad-task`, etc).
</step>

</process>

<guardrails>
- Never auto-fires: this workflow runs only when a skill dispatches it with a
  resolved path argument. It has no entry in references/review-triggers.md's
  wiring table and no trigger condition of its own (D-11).
- Never edits the target decision doc, PROJECT.md, or any source file -
  read-only grounding, prose output only.
- The `survives|partial|refuted` ruling and amendment list are this
  workflow's own prose output. review-provider.mjs's FINDING_SCHEMA and
  self-verify's CONTRACTS table are unchanged (D-07) - step `refute` still
  returns the shared `{findings:[...]}` shape; only step `adjudicate` adds
  the ruling on top of it, here in prose.
- Cost reporting is qualitative only - never a token count or dollar figure
  the runtime cannot actually measure (D-09).
</guardrails>

<success_criteria>
- [ ] Every objection from `refute` receives exactly one ruling
      (survives | partial | refuted) and, for survives/partial, a concrete
      amendment
- [ ] At least one library/API claim was checked against Context7 and at
      least one factual claim against the codebase during adjudication
- [ ] The report names which reviewers/models/tier/effort ran, qualitatively
      - no fabricated token/dollar figures
- [ ] Single-model (claude-subagent) ran when no cross-model provider was
      configured; the panel ran through the review seam, resolving the model
      from `review.decision_review.{tier,effort}`, when one was
- [ ] No file was edited - the target decision doc is untouched
</success_criteria>
