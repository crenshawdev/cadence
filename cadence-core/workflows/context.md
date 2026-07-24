<purpose>
Gather everything /cad-plan needs to plan a phase without guessing: locked
implementation decisions, falsifiable acceptance criteria, flagged
assumptions, and explicit scope boundaries - in ONE conversational pass.

The flow is codebase-first. A cad-assumptions-analyzer subagent reads the
relevant source off the main context and returns evidence-cited assumptions;
questioning is adaptive and covers only what the analyzer could not resolve.
A clear codebase costs one confirmation tap; a murky one costs a few focused
questions. The exit condition is judged, not scored: decisions closed,
acceptance criteria falsifiable.

WHAT and HOW live in one document, not separate pre-plan gates; the slicing
instinct survives as exactly one "too big?" question near the end.

Output: `.planning/phases/{N}/CONTEXT.md` - an OPTIONAL phase artifact.
/cad-plan reads it when present and plans without it when not.
</purpose>

<process>

<step name="resolve_phase">
Parse `$ARGUMENTS` for a phase number. If missing, run
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor get` and
use its phase; if there is no cursor either (`no-cursor`), ask:
"Which phase? (number from ROADMAP.md)"

Read `.planning/ROADMAP.md` and extract the phase's name and goal. If
ROADMAP.md does not exist, stop: "No roadmap found. Run /cad-new-project
first." If the phase number is not in the roadmap, stop and say so.

Phase directory: `.planning/phases/{N}/` (match the existing directory
naming if phase directories already exist; create it at write time).
</step>

<step name="check_existing">
If `{phase_dir}/CONTEXT.md` already exists, ask (ask-user seam, structured):

- header: "Context"
- question: "Phase {N} already has CONTEXT.md. Regather it?"
- options: "Regather (overwrite)" / "Leave it (stop)"

On "Leave it", stop with a one-line report. On "Regather", read the existing
file so confirmed decisions can carry forward instead of being re-asked.
</step>

<step name="load_priors">
Read what already constrains this phase - never re-ask a settled question:

- `.planning/PROJECT.md` and `.planning/REQUIREMENTS.md` (project-level
  decisions and requirement IDs this phase serves)
- up to 3 most recent prior `phases/*/CONTEXT.md` files (locked decisions
  that carry forward)

Priors are subordinate to current scope: `REQUIREMENTS.md` and `ROADMAP.md`
carry the latest decisions, while a prior CONTEXT can be stale - a scope change
often updates requirements without touching an older phase's CONTEXT file. When
a carried-forward decision contradicts current REQUIREMENTS/ROADMAP, treat the
current docs as authoritative: drop or re-open that decision rather than
feeding it forward as settled.

Missing files are fine - continue without. Build an internal prior-decisions
summary for the analyzer prompt and for annotating questions ("you chose X
in phase 2").
</step>

<step name="analyze">
Before dispatching, settle any user-only foundational fork the analyzer cannot
resolve from code - where new code lives (which repo / path), the target
platform, whether a referenced repo is even in scope this milestone. Surface
the blocking ones via the ask-user seam first, and do NOT bake an unverified
scope premise (e.g. "port repo X") into the analyzer prompt: a wrong premise
wastes the whole pass and forces a mid-analysis interruption.

Recall prior-project memory before dispatching. Read the config this step needs
in ONE call - the recall gate and the dispatch timeout together (conventions.md
Parallel work):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get memory.backend workflow.subagent_timeout
```

When it is `builtin` (the schema default), run recall for the phase goal:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the phase goal>"
```

Skip this substep entirely when the backend is `none` - do not issue the
recall call at all. The gate precedes the call on purpose (D-03): recall's own
backend-off return is a backstop for a direct caller, not this workflow's gate,
so `none` means the call is never made and no recalled data reaches the pass.

Parse recall's JSON line (`{ok, results:[{score, source, phase?, snippet}]}`)
and render the top results into a `<recalled_memory>` block in the analyzer
payload below (placed right after `<search_terms>`), one line per result
carrying its `snippet`, `source` file, and `phase`. `phase` is optional - a
phaseless CAPTURE.md item omits it; render it only when present, matching the
omit-optionals convention. These snippets ride the dispatch prompt, never the
cad-assumptions-analyzer definition (D-01 / cache discipline): they are
volatile per-phase data, while the agent's stable instruction to consume and
cite them lives in its cached file. On `none`, or when results are empty, omit
the block.

Dispatch `cad-assumptions-analyzer` via the spawn-agent seam
(references/seams.md), timeout `workflow.subagent_timeout` (read above).
This keeps raw file contents out of the main context. Prompt payload:

```
Analyze the codebase for Phase {N}: {phase_name}.

<phase_goal>{goal and description from ROADMAP.md}</phase_goal>
<prior_decisions>{prior-decisions summary from load_priors}</prior_decisions>
<search_terms>{key terms extracted from the phase goal}</search_terms>
<recalled_memory>{one line per recalled result: snippet - source file, phase (when present); omit this block on `none` or empty results}</recalled_memory>

Follow your output format exactly.
```

Wait for the result. Parse:
- `assumptions[]` - each with area, statement, evidence, if-wrong
  consequence, confidence (Confident / Likely / Unclear), and alternatives
  (Likely/Unclear items only)
- `needs_research[]` - topics the codebase alone could not settle (often empty)

If the agent fails or times out, say so and continue with a plain
conversational pass: derive 2-4 gray areas from the phase goal yourself and
treat each as Unclear below. Do not silently degrade.
</step>

<step name="close_gray_areas">
Adaptive questioning - ask only what the analyzer could not resolve.

**Unclear items** are the real gray areas. For each, ask ONE focused
question (ask-user seam, structured): the analyzer's alternatives as
options, recommended first, described by user-visible outcome, annotated
with evidence and prior decisions. If more than ~5 items are Unclear, ask
the highest-consequence ones (worst "if wrong") and leave the rest as
flagged assumptions.

**Research-flagged topics** (`needs_research`): present each and ask whether
the user can settle it from knowledge. If yes, record the answer as a
decision. If not, it stays a flagged assumption for the planner - do NOT
spawn research agents here; if it genuinely blocks planning, say so and let
the user research it outside this pass.

Universal rules while questioning:
- If an answer references a doc, spec, or ADR, read it now and cite its path
  in the resulting decision.
- If an answer drifts outside the phase boundary, capture it under Deferred
  and redirect - scope grows only by explicit user choice.
- Never invent an answer the seam was supposed to collect.
</step>

<step name="confirm_decisions">
Present the full picture grouped by area - resolved Unclear items plus the
Confident and Likely assumptions:

```
## Phase {N}: {phase_name} - proposed decisions

### {Area}
{Confidence} **{statement}**
  Evidence: {file paths}
  If wrong: {consequence}
```

Then ask (ask-user seam, structured):
- header: "Decisions"
- question: "These all look right?"
- options: "Yes, lock them" / "Correct some"

On "Correct some": multiSelect over the assumptions (label = statement,
description = "If wrong: {consequence}"), then one focused question per
selected item with 2-3 concrete alternatives. Corrections override the
original.

Everything confirmed or corrected becomes a numbered decision (D-01, D-02,
...). Anything the user explicitly leaves open ("planner's call") becomes a
flagged assumption, not a decision.

**Durability filter.** Classify each decision durable only when it passes
all three parts of this test:
- Hard-to-reverse: undoing it later costs real rework, not a one-line edit.
- Surprising without context: a future reader (or /cad-context on a later
  phase) would misjudge or reverse it without knowing the reasoning.
- The result of a real trade-off: an alternative was genuinely considered
  and rejected, not the only option on the table.

A decision failing any part of the test stays phase-local. This is workflow-
prose judgment, applied here at confirm/write time - there is no scoring
seam and no durability score is computed or stored; write_context (below)
sorts confirmed decisions into `## Durable decisions` and `## Decisions` on
this judgment.

**Requirement wording drift.** If a locked decision contradicts the wording
of a REQUIREMENTS.md row this phase serves - a corrected count or a term
that no longer matches ("19 posts" when the decision settles 18 posts + 1
page) - offer via the ask-user seam to correct that one row in place so the
audit source of truth matches reality. Only on the user's yes, edit exactly
that row; never rewrite requirements wholesale and never touch a row this
phase does not serve.
</step>

<step name="acceptance_criteria">
Draft the acceptance criteria that make this phase falsifiable, from the
phase goal plus the locked decisions. Rules:

- Pass/fail only - a stranger could check each box without judgment calls.
- Observed behavior, not implementation: "running X shows Y", not "X is
  implemented" or "X works well".
- 3-7 criteria. Fewer means the goal is vague; more means the phase is
  probably too big (feeds the next step).
- No subjective words: "clean", "reasonable", "robust" are banned.

Present the draft list and ask (ask-user seam, structured):
- header: "Acceptance"
- question: "Do these criteria pin the phase down?"
- options: "Lock them" / "Edit"

On "Edit", take the user's changes in prose and re-present once. These
criteria are what /cad-verify will check - do not lock anything untestable.

**Tool-availability tag.** For each criterion, judge whether proving it
needs an external tool or service (docker, a cloud CLI like doctl, a browser
driver, a live endpoint). Probe the machine ones with `command -v <tool>`.
Tag a criterion `(human-verify: needs <tool/service>)` when the tool is
absent here or the check is inherently live/external - so /cad-verify routes
it to a human check from the start and the executor never discovers
mid-task that it cannot self-verify (which is how a deferred check
masquerades as a pass). A criterion whose tool is present stays a normal
machine-checkable box.
</step>

<step name="size_check">
Exactly ONE size question, now that the criteria make size visible
(ask-user seam, structured):

- header: "Size"
- question: "Can one plan deliver all of these criteria, or is this phase
  too big?"
- options:
  1. "Right-sized - one plan"
  2. "Big - multiple plans, same phase" (let /cad-plan break it down)
  3. "Too big - defer a slice"

On option 3, capture the split in this same exchange: which criteria and
scope stay, which defer. Move the deferred slice (with its criteria) under
Deferred in the scope boundary - the user adds it as a phase later via
/cad-phase. Do not re-ask, re-score, or run a splitting framework; one
question, one answer, move on.

Record the outcome as a one-line "Plan shape" note for CONTEXT.md.
</step>

<step name="write_context">
Write `{phase_dir}/CONTEXT.md` (create the directory if needed):

```markdown
# Phase {N}: {phase_name} - Context

Gathered: {date}
Feeds: /cad-plan {N}

## Scope boundary

In: {what this phase delivers - from the roadmap goal, tightened by discussion}
Out: {explicitly not this phase}
Deferred: {slices deferred by the size check or scope redirects, one line
each with reason; "None" if empty}
Plan shape: {one plan | multiple plans | split - deferred slice above}

## Durable decisions

- D-01 ({area}): {decision}. Evidence: {file paths / cited docs}.
- D-02 ...
{decisions that pass all three parts of the durability filter above; "None
this phase" if every decision is phase-local}

## Decisions

- D-03 ({area}): {decision}. Evidence: {file paths / cited docs}.
- D-04 ...
{the phase-local rest, continuing the same D-NN sequence; "None - all
decisions this phase are durable" if empty}

## Acceptance criteria

- [ ] {pass/fail, observed behavior}
- [ ] {pass/fail, observed behavior} (human-verify: needs {tool/service})
- [ ] ...

## Flagged assumptions

- {statement} - {confidence}; if wrong: {consequence}
{unresolved research topics and items left to the planner's judgment;
"None - all assumptions confirmed" if empty}
```

Five sections, nothing else: scope boundary, durable decisions, decisions
(phase-local), acceptance criteria, flagged assumptions - the durability
filter splits what used to be one Decisions section into two, nothing more.
No discussion log, no interview transcript, no ambiguity report - git and
the file itself are the record.
</step>

<step name="update_cursor">
Update the cursor through the seam (it derives name/total from ROADMAP and
stamps the date):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase {N} --status "context gathered" --next "/cad-plan {N}"
```
</step>

<step name="commit">
If `planning.commit_docs` is true: apply the protected-branch guard
(references/git.md rail 1 - context is the first act of a phase), then
commit exactly `{phase_dir}/CONTEXT.md`, `.planning/STATE.md`, and - only
when the requirement-wording-drift step edited it - `.planning/REQUIREMENTS.md`:
`docs: capture context for phase {N}`. Nothing this workflow wrote may be
left dirty.

If false, leave the files uncommitted and say so in the report.
</step>

<step name="done">
Report:

```
Context gathered: phase {N} - {phase_name}
Decisions: {count} | Criteria: {count} | Flagged: {count}
File: {phase_dir}/CONTEXT.md
Commit: {hash or "not committed (planning.commit_docs=false)"}
```

One suggestion max: `/cad-plan {N}` - safe to `/clear` first: CONTEXT.md
holds every decision and planning runs in a fresh subagent, so a cleared
context loses nothing.
</step>

</process>

<guardrails>
- Never modify source code - this workflow writes CONTEXT.md and the
  STATE.md cursor, plus at most one user-approved REQUIREMENTS.md row
  correction (requirement-wording drift, above). Nothing else.
- No audit artifacts: no DISCUSSION-LOG, no checkpoint JSON, no interview
  log, no ambiguity scores. Git history is the log.
- Exactly one size question, near the end. No SPIDR, no story formats, no
  splitting frameworks.
- Question budget is earned by the analyzer: Confident items cost zero
  questions. Never interview area-by-area through things the codebase
  already answers.
- Decisions record WHAT was decided, not HOW to build it - implementation
  detail belongs to /cad-plan.
- No review trigger fires here (see references/review-triggers.md wiring) -
  the plan gets its review after /cad-plan writes PLAN.md.
- CONTEXT.md is optional. Never tell the user planning is blocked on this
  workflow, and never create one retroactively for phases that skipped it.
</guardrails>

<success_criteria>
- [ ] Every decision traces to a user confirmation or correction, with
      evidence cited
- [ ] Every acceptance criterion is pass/fail observable behavior
- [ ] Exactly one size question was asked, and its outcome is recorded as
      Plan shape
- [ ] CONTEXT.md contains exactly: scope boundary, durable decisions,
      decisions (phase-local), acceptance criteria, flagged assumptions -
      each decision classified against the durability filter
- [ ] Committed per planning.commit_docs with the protected-branch guard
      applied; no audit artifacts written
</success_criteria>
