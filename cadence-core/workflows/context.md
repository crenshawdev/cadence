<purpose>
Gather everything /cad-plan needs to plan a phase without guessing: locked
implementation decisions, falsifiable acceptance criteria, flagged
assumptions, and explicit scope boundaries - in ONE conversational pass.

The flow is codebase-first. A cad-assumptions-analyzer subagent reads the
relevant source off the main context and returns evidence-cited assumptions;
questioning is adaptive and covers only what the analyzer could not resolve.
The exit condition is judged, not scored: decisions closed, acceptance
criteria falsifiable.

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
ROADMAP.md does not exist, stop: "No roadmap found. Run /cad-new-project first
for a blank page, or /cad-adopt if this repo already has code and history."
If the phase number is not in the roadmap, stop and say so.

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
- the `## Deviations` bullets of up to 3 most recent prior
  `phases/*/SUMMARY.md` files - bounded most-recent-first exactly as the
  CONTEXT reads above are, so this read set cannot grow with N. Those
  deviations are the evidence the spend gate's "already grounded by a prior
  phase" arm turns on; without them that arm never fires and the gate
  collapses to its size arm alone. `workflows/report.md` already reads
  deviations out of SUMMARY for its `Refuted:` line, so this is the same
  source, not a new artifact.

Priors are subordinate to current scope: `REQUIREMENTS.md` and `ROADMAP.md`
carry the latest decisions, while a prior CONTEXT can be stale - a scope change
often updates requirements without touching an older phase's CONTEXT file. When
a carried-forward decision contradicts current REQUIREMENTS/ROADMAP, treat the
current docs as authoritative: drop or re-open that decision rather than
feeding it forward as settled.

Missing files are fine - continue without. Build an internal prior-decisions
summary - what earlier phases locked, plus what their deviations later
corrected - for the spend gate below, for the analyzer prompt, and for
annotating questions ("you chose X in phase 2").
</step>

<step name="spend_gate">
The analyzer pass is the single most expensive dispatch in this spine, and no
phase buys it unasked. Decide here, BEFORE `analyze`: that step's `route.mjs
resolve` writes the lifecycle dispatch half unconditionally, so a gate placed
after it strands an unpaired bracket on every skipped phase and inverts the
record-health signal /cad-report reads.

Load prior-project memory first - BOTH arms need it. The buy arm feeds it to
the analyzer payload; the skip arm reasons with it directly:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get memory.backend
```

When it is `builtin` (the schema default), run recall for the phase goal:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the phase goal>"
```

Skip this substep entirely when the backend is `none` - do not issue the
recall call at all. The gate precedes the call on purpose: recall's own
backend-off return is a backstop for a direct caller, not this workflow's gate,
so `none` means the call is never made and no recalled data reaches the pass.

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/recall.md` (one
consult site - this step) for the result shape and how the top results render
into the `<recalled_memory>` block of the analyzer payload below, and into your
own reasoning on the skip arm.

Then ask (ask-user seam, structured) - a SPEND question, not a second size
question:

- header: "Analyzer"
- question: "Buy the codebase analyzer pass for this phase?"
- options:
  1. "Dispatch it - read the code first"
  2. "Skip it - go straight to the gray areas"

Order the two by your recommendation, recommended first, the way every other
ask in this workflow presents its options. Annotate the question with evidence
you have ALREADY read - never with a fresh measurement, and never with a
number you invent for the occasion:

- how many requirements this phase carries
- the surfaces its ROADMAP entry names, by path
- whether prior phases' SUMMARY deviations (load_priors) already settled the
  ground this phase reopens

Recommend DISPATCH unless all three point the other way: the phase's whole
surface is already named in its roadmap entry, those files are ones this
session has already read, and prior deviations have already settled how they
behave. That is a judgment on evidence, and it is the whole gate. Compute no
score, hold no threshold, and run no seam to rank the phase - measured on the
committed verbatim fixture, a requirement-count threshold orders its two
phases backwards, and this workflow's guardrails already ban splitting
frameworks for the same reason.

On "Dispatch it", continue into `analyze` below, unchanged.

On "Skip it", do NOT enter `analyze` at all - no resolve, no dispatch, no
bracket, and so no analyzer cost in this phase's run record. Say plainly that
the pass was skipped and on which evidence, then take the same plain
conversational pass `analyze`'s failure arm describes: derive 2-4 gray areas
from the phase goal and the priors yourself, treat each as Unclear, and
continue at `close_gray_areas`. Skipping is a stated choice, never a silent
degradation.
</step>

<step name="analyze">
Before dispatching, settle any user-only foundational fork the analyzer cannot
resolve from code - where new code lives (which repo / path), the target
platform, whether a referenced repo is even in scope this milestone. Surface
the blocking ones via the ask-user seam first, and do NOT bake an unverified
scope premise (e.g. "port repo X") into the analyzer prompt: a wrong premise
wastes the whole pass and forces a mid-analysis interruption.

Dispatch `cad-assumptions-analyzer` via the spawn-agent seam
(references/seams.md), the bracket on its resolve:
`--bracket-read ".planning/ROADMAP.md"`. That read-set is what this SITE causes
the worker to read, which is not the same as what the prompt below names. The
prompt names no planning path at all; the analyzer's contract
(`skills/cad-assumptions-analyzer-contract`) is what sends it to the roadmap
entry, and this is the single most expensive dispatch in the whole spine. Prior
phases' decisions reach it as the `<prior_decisions>` summary in the payload,
distilled from the (at most 3) files load_priors read - the contract opens a
prior CONTEXT.md itself only when the code contradicts a cited decision, so the
sweep of every prior phase's file that used to grow with N is gone from both
the contract and this record.

This keeps raw file contents out of the main context. Prompt payload:

```
Analyze the codebase for Phase {N}: {phase_name}.

<phase_goal>{goal and description from ROADMAP.md}</phase_goal>
<prior_decisions>{prior-decisions summary from load_priors}</prior_decisions>
<search_terms>{key terms extracted from the phase goal}</search_terms>
<recalled_memory>{one line per recalled result: snippet - source file, phase (when present); omit this block on `none` or empty results}</recalled_memory>

Follow your output format exactly.
```

The dispatch came back, so close its bracket before anything else. ONE line,
whichever way it ended - add `--detail "<what failed>"` when the agent failed or
timed out and the seam closes it as a `checkpoint` instead of a `return`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-assumptions-analyzer --role cad-assumptions-analyzer --tokens <the token count on the subagent return>
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
with evidence and prior decisions. These per-item questions are independent -
batch them ceil(N/4) per AskUserQuestion call (up to four questions per call),
not one blocking turn each; only a question whose wording depends on an earlier
answer stays sequential. If more than ~5 items are Unclear, ask
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
selected item with 2-3 concrete alternatives, batched ceil(N/4) per
AskUserQuestion call, up to four questions per call; only a question whose
wording depends on an earlier answer stays sequential. Corrections override the
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
- Each criterion carries a phase-local `AC<N>` id at the head of its bullet,
  numbered from 1 in presentation order - never phase-prefixed, never
  renumbered afterwards. `/cad-verify` carries that id onto the UAT item it
  builds, and `/cad-audit` FAILs on a criterion that reached none
  (`references/acceptance-criteria.md`).

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
Exactly ONE size question - and exactly one spend question, which was the one
`spend_gate` already asked - now that the criteria make size visible (ask-user
seam, structured):

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
Write `{phase_dir}/CONTEXT.md` (create the directory if needed).
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/CONTEXT.md` (one
consult site - this step) for its shape - five sections, nothing else, with the
fill-in guidance for each.

Deferred on SIZE, not branch-locality (references/seams.md, File round-trip):
this step is unconditional but reached once, at the very end, so the read folds
into the turn that writes the file while an eager copy would ride every turn of
the interview before it.

Then count what was written against the 3-7 the `acceptance_criteria` step
states - a ceiling nothing counts is the silent no-op this seam removes:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" criteria-size --phase {N} --context-min 3 --context-max 7
```

Report an `over` entry to the user in ONE line, its count and the bound it
broke. A REPORT, not a gate - like `plan-size`'s `phase-too-big`, present it and
continue. `context_found: false` is not zero: the section was never read (absent
or near-miss heading), which is a file to fix rather than a count to report.
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
(references/git-guard.md rail 1 - context is the first act of a phase), then
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
- Exactly one size question, near the end, and exactly one spend question,
  before the analyzer - two asks, never merged into one and never re-asked.
  No SPIDR, no story formats, no splitting frameworks, for either of them.
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
- [ ] Exactly one size question and exactly one spend question were asked -
      the size outcome recorded as Plan shape, the spend arm stated plainly
- [ ] CONTEXT.md contains exactly: scope boundary, durable decisions,
      decisions (phase-local), acceptance criteria, flagged assumptions -
      each decision classified against the durability filter
- [ ] Committed per planning.commit_docs with the protected-branch guard
      applied; no audit artifacts written
</success_criteria>
