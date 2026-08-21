# How Cadence works under the hood

The `/cad-*` commands are the surface. This document is what runs inside them:
the rules the planner, executor, verifier and reviewers actually follow, and why
each one is written the way it is.

Most of it is not configurable, because most of it is not a preference. A
verification that cannot fail is not a verification whether or not you asked for
one. What follows is the working method, and where in the tree it is enforced.

The short version of every section below: **an absent check must never read as a
passing one.** That single idea shapes the planner's task format, the executor's
commit gate, the verifier's scoring, the review subsystem's degradation
handling, and the tool's lint of its own prose.

---

## Planning works backward from the goal

`skills/cad-planner-contract/SKILL.md`

"What should we build?" produces plausible tasks. "What must be TRUE for the
goal to hold?" produces requirements the tasks have to satisfy. The planner is
required to take the second route, in a fixed order:

1. State the goal, outcome-shaped ("working chat interface"), never task-shaped
   ("build chat components").
2. Derive 3 to 7 observable truths that must hold from the user's perspective.
3. For each truth, derive what must exist.
4. For each artifact, derive what must be connected.
5. Write tasks that create the artifacts *and* the wiring.

Step 4 is the one that earns its place. Artifacts that exist but are never wired
are the most common silent failure in generated code, and the derivation catches
them before a line is written.

Tasks are ordered skeleton-first. The earliest tasks produce a minimal
end-to-end path through every layer the goal touches, stubbed thin but wired and
runnable, and later tasks add depth to a spine that already works. A phase should
have a working skeleton by commit 2 or 3, never a pile of polished but
unconnected parts awaiting a final wiring task. Silent failures live in the
seams; the skeleton makes every seam fail loudly on day one.

Before writing any task the planner must read the actual files it will touch,
never plan from filenames or from memory of similar codebases, and read each file
once rather than re-reading it.

### Every task has exactly three fields

- **Files** — exact paths. `src/auth/login.rs`, never "the auth files".
- **Action** — what must become true, the constraints that bind it, and what to
  avoid with the reason. Directive prose, no code blocks. It names symbols that
  already exist and never invents an identifier, signature or call path for code
  the task has yet to write, because the planner cannot know those.
- **Verify** — how to prove it is done. A command whose output settles it, or an
  observable behavior check. "Running X shows Y", never "X works". This is the
  task's authority: any implementation that satisfies it is authorized.

Atomic means one concern, independently verifiable, leaving the repo
committable. A task touching more than about five files is usually two tasks.

If proving a task needs a tool the execution environment does not have, the
planner writes the Verify as a `human-verify` instruction naming the tool and
what to observe. It never writes a command the executor cannot run, because that
turns into a mid-task deferral that later masquerades as a pass.

### Scope reduction is treated as a defect

Prohibited in task actions: "v1", "simplified", "for now", "placeholder",
"future enhancement", or any phrasing that delivers less than the locked
decision states. There are exactly three legitimate reasons to leave something
out, and each is an explicit `## PHASE TOO BIG` return rather than a silent cut:
the phase cannot be executed well in one pass, a required detail exists in no
source artifact, or it depends on a phase that has not shipped.

### Decomposition has named axes

When two responsibilities differ on trigger, size, lifecycle, failure-resume,
freshness, or ownership, they get separate tasks or artifacts. This is a nudge to
weigh, not a rule that forces a split: a genuinely single-concern phase stays one
task, and combining responsibilities that share all six axes is correct rather
than lazy.

### The plan is checked before any code exists

`skills/cad-plan-checker-contract/SKILL.md`, opt-in via `workflow.plan_check`

The checker derives the must-be-true statements from the goal *itself, first,
before it is allowed to open the plan*, then checks the plan against its own
derivation rather than against the plan's claims about itself. That ordering is
deliberate: reading the plan first anchors you to its framing.

It checks six dimensions — requirement coverage, task completeness, sequencing,
goal-backward truths, scope sanity, and proportionality, which asks separately
from the goal whether this is the smallest plan that reaches it and whether it
sits inside the `workflow.max_plan_tasks` ceiling — and every finding carries a
severity. A
truth that no task makes true is a BLOCKER. A task that no truth needs is a
WARNING, because that is scope creep. Findings without a severity are invalid
output, and softening a blocker to be agreeable is called out explicitly.

---

## Execution predicts before it runs

`skills/cad-executor-contract/SKILL.md`

For each task: implement, verify, commit. The verification step has a rule that
does most of the work.

**Before running the Verify command, state the exact output you expect.** Then
run it and compare. A surprise result, *even a passing one*, is evidence about
the plan's assumptions: it gets recorded as `[deviation] expected X, observed Y`
and only then acted on. Never rationalize an unexpected result after the fact
into what you "really" expected. "It should work" is not verification.

This is generalized from Andrej Karpathy's "A Recipe for Training Neural
Networks" — make no assumptions, failures are silent, verify, don't trust. There
is no switch for it.

### A deviation is one thing, with a circuit breaker

The executor's authority is the task's Verify. Any implementation that satisfies
it is authorized, so choosing a shape the Action did not picture is ordinary
engineering — not a deviation, and not recorded. Sorting departures by how
architectural they looked was the older rule, and it asked the wrong question:
it let an invented parsing pass through as "trivial" while a plan's guessed
field name became a finding someone had to defend.

So a deviation is exactly one thing: **an acceptance criterion or a locked
decision turned out wrong or unachievable.** The task's Verify, the plan's
`## Must be true when done`, or a CONTEXT `D-NN` says something reality
contradicts. That is rare, and a report carrying a dozen is evidence the plan
was authored above its knowledge.

The executor stops instead of proceeding when the Verify cannot be met as
written, when a locked decision is contradicted, or when meeting it needs a file
outside the plan's lease. Everything else found along the way is either part of
the task or an open item.

Unsure? Stop and ask.

The circuit breaker is three fix attempts per task, then record it as an open
item and move on, or checkpoint if it blocks the task. Thrashing is a failure
mode with a counter, not a judgment call.

### A failed package install is never auto-fixed

If an install fails, the executor does not retry with a similar name and does not
substitute an alternative. A failed install can mean a hallucinated or squatted
package, so it returns a `blocked` checkpoint for a human to verify the package
is legitimate. This is the one deviation class with no inline path at all.

### Commit protocol

Stage the specific files you changed, individually. Never `git add -A`, never
`git add .`. Commit as `{type}({scope}): {description}`, and take a post-commit
glance for unexpected file deletions and for generated files left untracked.

Executors never push, never force-push, never write `STATE.md`, `ROADMAP.md` or
`SUMMARY.md`, and never spawn their own reviewer. A checkpoint means stop: never
fabricate the answer, never guess and proceed.

### Parallelism is offered only when arithmetic proves it safe

`cadence-core/workflows/execute.md`

Sequential is the default. The parallel path opens only when every condition
holds, and the load-bearing one is not a judgment call: the seam intersects the
plans' declared file lists pairwise, and any overlap forces sequential. A plan
that declares no files also forces sequential, because a plan declaring nothing
cannot be proven independent, and a check that could not run forces it too.
Unproven independence is never treated as independence.

Because per-plan reviews each see one plan's diff in isolation, a bug in the
interaction of two merged plans is invisible to them until pre-ship. That is
what the opt-in `phase_diff` trigger exists to catch, and it is parallel-path
only: on the sequential path each diff review already sees a tree holding every
prior plan's work.

### Worktree safety

In parallel mode the executor verifies it is on its assigned branch before every
commit and halts on a mismatch rather than repairing refs itself. `git stash` is
forbidden because the stash is shared across worktrees; so are `git clean`,
blanket `git reset --hard`, and `git restore .`.

---

## Verification climbs four levels

`skills/cad-verifier-contract/SKILL.md`

The core principle is that task completion is not goal achievement. "Create login
handler" is complete the moment the file exists. The goal "users can log in"
needs that handler to be real, reachable, and working.

So every derived truth is checked at four levels:

1. **Exists** — the artifact files are present.
2. **Substantive** — real implementation, not a stub. A stub satisfies existence.
3. **Wired** — reachable from an entry point: registered, imported *and* called,
   route mounted, UI element invoking it. Orphaned code fails here.
4. **Behaves** — for truths hinging on runtime behavior, presence plus wiring is
   not proof. Code can be present and wired and still leak state on exactly the
   path the invariant covers.

Each truth ends as VERIFIED with cited evidence, FAILED with the file and what is
wrong, or UNCERTAIN when only a human can settle it. **UNCERTAIN counts toward
neither side of the score**, so ambiguity can never be laundered into success. A
clean score means every behavior claim rests on behavior actually observed.

The verifier starts from the stance that the goal was NOT achieved until code
evidence proves it, and `SUMMARY.md` is treated as claims to falsify rather than
as evidence. That is why the executor's goal-check paragraph in
`cadence-core/workflows/execute.md` requires a `file:line` or command output
behind every concrete claim: an evidenced claim closes the loop, an unevidenced
one is a guess wearing a verdict.

### The failure modes of verification itself are named

The agent carries an explicit "how verifiers go soft" list: trusting SUMMARY
bullets without reading the files, accepting "file exists" as "works", marking
UNCERTAIN when absence is observable (that is FAILED), and letting early passes
buy later truths less scrutiny.

### Anti-pattern scan

On the files the phase touched: debt markers (TODO, FIXME, XXX, HACK,
"placeholder", "not implemented") with no issue reference, empty implementations
and `todo!()`, hardcoded values where data should flow, and log-only handlers.
A match counts as a gap only when it sits on the goal path — test fixtures and
deliberate follow-up markers carrying a ticket reference are not gaps. A
`CADENCE-DEBT` marker is exempt under that same clause: its required ceiling and
trigger fields ARE the reference, and the harvest is what carries it forward.

### Spot-checks are bounded on purpose

Two to four checks, each under about ten seconds, no servers started, no state
mutated, no network. Never run the full suite per truth: prove a test *exists* by
enumeration (`cargo test -- --list`, `pytest --collect-only -q`) and prove one
passes by running it by name. At most one full-suite run per verification.

---

## What counts as test coverage

`cadence-core/workflows/coverage.md`

The whole command turns on one definition:

> **Covered** = there exists a test whose failure would signal that this
> requirement regressed. A test that imports or runs the code but would still
> pass if the behavior were wrong is NOT coverage.

Everything follows from that. The audit reads the assertions rather than counting
test files, because the presence of a test file is not enough. Generated tests
prefer a RED check where feasible, to confirm the test pins the behavior and is
not a tautology. The test kind is chosen from what the code is rather than from a
default, written in the project's own framework and conventions.

A gap that genuinely needs a heavy new dependency gets flagged to you rather than
pulled in silently, the plan is approved before anything is written, and a red
test is never committed as coverage — either the test was miswritten and gets
fixed, or it found a real defect and gets handed to `/cad-debug`.

---

## Review: how a claim earns trust

This is the largest subsystem and the one that most shapes the output quality.

`cadence-core/references/review-triggers.md`

### One procedure, no local reviewer loops

Every second opinion goes through a single procedure, `fire(trigger)`. No skill
embeds its own reviewer loop; that rule lives in
`cadence-core/references/conventions.md`. It is why gates are configurable at all
rather than scattered across twenty workflows.

### Four triggers, four consequences, three combination modes

| Trigger | Fired by | On | Gate at `shipped` |
|---|---|---|---|
| `plan` | `/cad-plan` | after PLAN.md is written | blocking |
| `diff` | `/cad-execute` | at plan completion | off |
| `risk_surface` | execute, debug, task, verify | on detection match, once per plan on the committed range | blocking |
| `phase_diff` | `/cad-execute` parallel path | after worktree batches merge | off |

Two of the four fire at the default `shipped` level: the plan review, on every
plan, and `risk_surface`, on a detection match. `diff` is off there and at `solo`,
because an advisory review gates nothing and the last plan of a phase has no next
dispatch to overlap it with, so it is a wait bought for findings that stop
nothing - `risk_surface` already blocked on that same range. `phase_diff` is off at `shipped` for the other half of the same
argument: its findings files were read by nobody, referenced by no SUMMARY and
no CONTEXT, so the dispatch bought findings that changed nothing. `plan` was cut
to `off` on that same evidence and is now `blocking`, because the measurement
condemned the ADVISORY gate rather than the review: a plan is the cheapest thing
in the pipeline to halt on, no code exists yet, and a gate that stops something
cannot be a findings file nobody reads. Setting
`review.triggers.<t>.gate` puts any of them back on and beats the level.
`phase_diff` only ever
fires on the parallel path, which most projects never run. The gate (`off`, `advisory`, `deferred`, `blocking`,
`adjudicated`) decides the consequence - at `deferred` the reviewer still runs, what it found is queued and the
run finishes, so the LAND is what stops - `review.mode` (`single`, `panel`, `adjudicated`) decides how multiple
reviewers combine, and where they disagree the gate wins, because it is the stronger signal.

That gate column is the `shipped` level, not a fixed default. Every gate is
resolved from the project's `stakes` level, so the same trigger fires differently
depending on what a break costs you: a `plan` review is advisory at `solo`, blocking at
`shipped` and adjudicated at `critical`, an ordinary `diff` is off at `solo` and
`shipped`, and blocking at `critical`. `risk_surface` is the one that
does not move, blocking at all three levels. An explicit gate you set in config
beats the level's, as long as it is one of the five values above; a typo loses to
the level's gate and is named in the warnings rather than silently disabling a
review.

The defaults encode an opinion about where scrutiny pays: heavy before code
exists, heavy before publishing, blocking on risk, merely advisory on an ordinary
diff.

### Reviewers are merged blind

The default reviewer is a fresh-context Claude subagent needing no API key.
Configure an OpenAI, Gemini or DeepSeek key and the identical job runs as a direct
API call. OpenAI and Gemini enforce the output schema server-side; DeepSeek has no
server-side schema, so its adapter injects the schema into the prompt and asserts
the shape of the answer on return.

Every backend returns the same shape:

```
{ findings: [ { file, line, severity: blocker|high|medium|low, claim, failure_scenario } ] }
```

That is a bias control, not a convenience. Because the shape is identical, the
adjudicator merges findings without knowing which reviewer produced which, so a
finding cannot be discounted for having come from the free local reviewer rather
than the expensive external one.

### The reviewer's stance

`skills/cad-reviewer-contract/SKILL.md`

The artifact is handed over to be refuted, not blessed. Assume it is wrong until
the evidence clears it; find the input, state or sequence under which it produces
a wrong result, crashes, corrupts data, or misses its goal.

- A finding must tie to a specific line and a concrete failure. Anything else is
  not a finding.
- **Approach differences are not findings.** Review against the goal, not against
  how you would have written it. This kills the most common way code review
  degrades into taste.
- No severity inflation to seem thorough, and no softening a real blocker to seem
  agreeable.
- An empty result is valid, but only after a genuine attempt to falsify.

### Adjudication inverts the hierarchy

Under `adjudicated`, all reviewers run independently and then the main session
adjudicates: open the cited code, confirm or kill each finding, drop false
positives and overstatements, and re-rank by grounded severity. Reviewers
critique; the main model grounds and owns the verdict.

The one signal treated as strong is convergence. A defect found independently by
more than one reviewer is high confidence, and that is the entire justification
in this system for paying for more voices.

What survives is not a work order. The survivors are presented as a numbered
list and the session asks which of them to act on, with none as the default, so
the model that just spent four voices on the artifact does not also get to
decide what happens next. One gate ends this way at every level: the fix list in
`/cad-verify`, which has no resolved gate and is always triaged. Three more end
this way wherever their gate resolves adjudicated: the plan review in
`/cad-plan`, blocking at `shipped` and adjudicated at `critical`;
`/cad-execute`'s per-plan diff review, `off` below `critical`; and its
`phase_diff` review, adjudicated at `critical`. The one exception is the
opt-in unattended close in `/cad-land`, where nothing is acted on at all - it
fires no review of its own, reads only the `risk_surface` findings this branch
already settled, and a surviving blocker or high finding halts the merge
instead of being triaged.

### Decision review rules three ways, and grounds itself

`cadence-core/workflows/decision-review.md`, invoked by `/cad-decision-review`

A single load-bearing decision can be stress-tested on demand. It never
auto-fires: choosing which decision deserves the pass is a human's call, not a
mechanical handoff.

Each objection is ruled `survives`, `partial`, or `refuted`, refusing the binary.
A `refuted` ruling must state the grounding that killed it, so the ruling itself
is falsifiable rather than asserted.

Grounding is mandatory and typed: library and API claims are verified against
live documentation via Context7 rather than trusting training data, factual
claims are verified against the real repo rather than the objection's paraphrase,
and every run must ground at least one of each kind or say explicitly that the
claim set contained none.

When refutation returns nothing, that requirement does not lapse — it retargets
onto the decision's own load-bearing claims, so a clean pass still rests on
checked facts. A clean pass is never reported as a bare "no findings", because
that reads identically to a review that never ran.

Cost is reported qualitatively, never as a token or dollar figure, because the
runtime does not expose one and a fabricated number is worse than none.

### Risk detection is deliberately calibrated

A match on any of these fires the blocking `risk_surface` trigger: auth and
authorization and sessions, DB schema and migrations, money and billing and
pricing, concurrency and async and locking, destructive operations, secrets and
crypto and keys, public API and wire contracts, and untrusted-input parsing.

It fires once, against the plan's completed commit range, never against a staged
index mid-plan. Halting the executor at each risky commit showed the reviewer a
half-built change and cost a fresh-context re-dispatch per match, whose only job
was writing code no plan task authorized - itself new risk surface, and the next
halt. Blocking on the finished range keeps the gate and drops the loop.

The `stakes` you set is a MINIMUM, not a fixed price. A plan-time floor reads
the phase's own declared `files:` before any code is written - the same
anchored construct patterns and whole-path segments the commit-time
`risk_surface` gate fires on, scanned over each declared file's current body
and scoped to the surfaces the project answered, with a document contributing
its path alone and never its prose. A matched phase routes at `shipped`, not
at the top row: raising every match to `critical` is the tax the old floor
died of. This is a different detector reading a different input from the one
that came before it. The dispatch-time detector that read a phase's declared
paths by NAME - one path token in one declared file was enough to put six
roles on their top rung for the rest of the phase - and the eight
`risk.override.<surface>` waivers that existed to lower what it raised, were
both cut in v2.7.0 and stay cut: the eight keys are still retired. It fails
CLOSED - a plan Cadence cannot read holds the configured level and never
drops below it - and lowering below a computed raise takes the waiver key
inside `review.triggers.risk_surface` naming the surface, which lowers the
routing level alone and can never disable the blocking review. What these
surfaces also drive, unconditionally, is that same `risk_surface` review:
blocking at every level, fired once on the completed commit range.

A blocking panel on every `rm -rf dist/` would train you to ignore the gate, so
there is a narrow, evidence-based pre-filter. A destructive op drops only when
its target is provably ephemeral, requiring both `git check-ignore` to match and
`git ls-files` to come back empty, because an ignored `dist/` holding a
force-added tracked file is not safe to drop. A secret match drops only when the
file is template-shaped *and* the value is a stub; either alone still fires.

Drop only when the whole match is harmless, fire when unsure, and note each drop
with its reason so a mis-filter is visible rather than silent.

### Nothing reviews itself

The executor detects the risk surface, stops, and hands it up: "never review
yourself, never skip the gate." Fresh context is the point, because a reviewer
that helped write the code has already accepted its assumptions.

### Consult is not review

`cadence-core/references/consult.md`

Review is scheduled critique of an artifact. Consult is reactive help when the
primary model is stuck, and the distinction is enforced by five rules:

1. **Always user-approval-gated.** Review can fire automatically; consult always
   asks, because it spends a second model's tokens on a judgment call.
2. **Decision support, never delegation.** It returns hypotheses and angles; the
   main model grounds each against the real code and the *user* decides.
3. **Triggered by observable state, not self-assessment.** Never "the model feels
   stuck", which is the least reliable signal available — the feature meant to
   fight thrashing would otherwise cause it. It fires on counters the system can
   see, such as `review.consult.attempt_threshold` failed fix attempts.
4. **Bounded.** One consult per dead end unless genuinely new information appears.
5. **Opportunistic.** There is no local-subagent consult, on the stated grounds
   that a second Claude is not a second opinion. With no provider wired the offer
   is simply never made, and the loop is never blocked by its absence.

### What was deliberately not built

Adjudicated review grounds once and hands off. It does **not** iterate
review → revise → review on its own. That convergence loop was considered and cut,
and the restraint is as load-bearing as the feature.

---

## Nothing silently passes

The thread connecting every subsystem above.

- A reviewer that could not run never silently passes a gate. The gate reports
  that it could not be evaluated and asks.
- A dropped reviewer emits a visible line naming the reason and, for a missing
  key, where to set it.
- An empty reviewer set falls back to the local subagent rather than skipping.
- A risk pre-filter drop is noted with its reason.
- A verification that cannot fail is not coverage.
- An unevidenced claim in a goal check is a guess, not a verdict.
- A clean decision review reports what it grounded, not "no findings".
- A test file that exists proves nothing; a named test that passes proves one
  thing.

The failure this guards against is the one that looks like success: a check that
did not happen and a check that passed are indistinguishable unless the tool
makes them distinguishable.

---

## Traceability runs both directions

`cadence-core/workflows/audit.md`

Before a milestone ships, every requirement is traced requirement → phase → plan
→ verified, and the joins are computed by the planning seam rather than assembled
by hand. Each break carries a code: `no-phase` and `no-plan` mean nothing was ever
committed to deliver it, which is the silent drop the audit exists to catch;
`unpicked` is that same drop one step earlier, a requirement the milestone
declared that no phase picked up, so it never even reached the traceability
table (the partially-planned state the gate used to be blind to);
`phase-missing` points at a phase not in the roadmap; `not-verified` is expected
mid-cycle and a defect at ship time; `drift` means the two status sources
contradict each other, so the status cannot be trusted until reconciled.

The reverse direction matters too. Plan frontmatter referencing unknown
requirement IDs is reported as an orphan, weighed more lightly than a dropped
requirement because it is scope creep rather than missing work.

---

## Debugging keeps hypotheses, not guesses

`cadence-core/workflows/debug.md`

The investigation lives in a file, so a `/clear` never loses it. The loop:

1. **Hypothesize** — 2 to 5 candidate causes ranked most-likely-first, but tested
   risk-first when a cheap test can eliminate a whole class. Never jump to a fix
   before a cause is confirmed by evidence.
2. **Predict and test** — state what you would observe if the top hypothesis were
   true, then run the *cheapest discriminating check*. One variable at a time.
3. **Record** — append the observation, mark the hypothesis confirmed or refuted,
   and rewrite the state file immediately. This is the clear-survival point.
4. **Branch** — confirmed cause goes to resolve; all-refuted forms the next set
   from what the observations now rule in.

When `memory.backend` is `builtin`, the hypothesize step recalls past deviations
and UAT findings from the project's own history, because hypothesizing is the
judgment moment where past experience should shape the candidate set.

---

## Git is guarded by the harness, not by intentions

`cadence-core/references/git-guard.md`

The protected-branch guard is a PreToolUse hook, enforced by the harness rather
than by a paragraph of instructions the model can rationalize away. Before the
first commit of any task or phase, the guard checks `git.protected_branches` and
applies `git.on_protected`, and base integrity is checked in the same pass so
work cannot drift onto an unrelated line.

What it reads is deliberately small: a command counts when its first word is
`git`, and the verb is the first non-flag word after it. A wrapped or
substituted invocation (`bash -c "git commit"`, `$(git commit)`, `sudo git
commit`) is invisible to it. That is a stated limit, not a gap - v2.2.0 deleted
the 2,251-line reader that tried to close it, because the escape surface behind
a shell is unbounded and the parser could be switched off by its own input.
The guard is a rail against drift, not a boundary against an adversary, and
`cadence-core/references/git-publish.md` rail 3 lists exactly what it misses.

Two decisions are marked in `cadence-core/references/seams.md` as deliberately
undefaulted, meaning they are presented with no recommended option and no
reordering toward one: the publish mechanism in `/cad-land`, and the
protected-branch guard when work would land on a protected branch. A nudge there
is a bug, not a convenience.

Work runs on two tiers. A per-milestone integration branch is what parallel
worktree branches merge back into - where a worktree forks FROM is the host's
`worktree.baseRef` setting, which the parallel path requires at `head` -
created at cycle start per `git.auto_branch` and
named by `git.integration_branch` (`milestone` by default, with a `trunk`
escape hatch). After a successful land, `git.on_land_cleanup` returns to the
base branch, pulls, and reaps the merged integration branch.

Everything else is atomic: one conventional commit per task, specific files
staged individually. Publishing flows through a single sanctioned seam, which
exists because a command-string push whitelist was built, defeated four ways by
adversarial review, and then deleted rather than patched. `/cad-land` asks how you
want to publish and does exactly that, unless you opted into the end-to-end
`git.auto_close`, which runs audit through merge with no per-step prompts and
halts on a surviving blocker or high `risk_surface` finding.

---

## State lives in files, with one writer each

`cadence-core/references/conventions.md`

`STATE.md` is a four-line cursor, overwritten in place and never appended. The
only correct writer is the seam, which derives the phase name and total from the
roadmap, validates the status against a fixed lifecycle, stamps the date, and
writes atomically. Hand-editing it is out of bounds.

There are no audit logs, no activity tables, and no session narratives, because
git history is the log and views can be derived from it on demand.

Config is read only through the config seam, one call for every key a workflow
needs. A raw file read sees at most one layer and therefore lies about the rest.

---

## The tool checks its own prose

`cadence-core/bin/self-verify.mjs`

CI lints the documentation against the code. Every config key, script
invocation, and file path named in the workflows must actually exist or the build
fails. Agent prose reaching for a tool its frontmatter never declared fails the
build too. A block that claims a set of dispatches is concurrent has to issue
that set in one message, and every sentence in it that ISSUES the set - an
imperative, or the colon that introduces a list - fails the build when it
serializes, hedges on what the host allows, or hands the set out concurrently
without saying "in one message". A sentence that explains the rule, forbids the
serial shape, or describes dispatch already arranged carries the same words in a
different mood, and is left alone.

It also weighs five surface sets against a byte budget in
`cadence-core/bin/weight-budgets.json` - every agent file, every SKILL.md,
every workflow, and every file under `cadence-core/references/` and
`cadence-core/templates/` - and fails when one EXCEEDS its entry. That ratchet
makes prose growth a conscious act rather than a drift: the budget is raised
only when the growth is intentional and accepted, which is a deliberate step
someone has to take rather than a number that quietly rises.

The budget is a CEILING, not an equality. Exactness was tried, and it taxed a
cut at the rate it taxed growth: every prose removal, however obviously good,
turned CI red until its row was re-pinned in the same commit. Growth is the
risk the budget exists to catch, and a surface sitting under its entry is a
surface that got smaller.

The honest limit is worth stating. These checks catch claims that are *wrong*.
They cannot catch a claim that is true but incomplete, and they cannot catch a
missing paragraph. `/cad-docs-verify` checks factual claims against the live
codebase; omissions still need a human.

---

## Where each rule lives

| Practice | Enforced in |
|---|---|
| Goal-backward derivation, skeleton-first ordering | `skills/cad-planner-contract/SKILL.md` |
| Independent derivation before reading the plan | `skills/cad-plan-checker-contract/SKILL.md` |
| Prediction-first verification, the deviation rule | `skills/cad-executor-contract/SKILL.md` |
| Four-level verification, anti-pattern scan | `skills/cad-verifier-contract/SKILL.md` |
| Refute-don't-bless, finding schema | `skills/cad-reviewer-contract/SKILL.md` |
| Gates, adjudication, risk detection | `cadence-core/references/review-triggers.md` |
| Consult rules | `cadence-core/references/consult.md` |
| Coverage definition | `cadence-core/workflows/coverage.md` |
| Traceability and orphan detection | `cadence-core/workflows/audit.md` |
| Scientific-method debugging | `cadence-core/workflows/debug.md` |
| Branch guard and publish seam | `cadence-core/references/git-guard.md` and `cadence-core/references/git-publish.md` |
| State, config, reporting conventions | `cadence-core/references/conventions.md` |
| Prose-against-code lint and byte budgets | `cadence-core/bin/self-verify.mjs` |
