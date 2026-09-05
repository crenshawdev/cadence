# Portability seam: spawn-agent

## Seam: spawn-agent

How a workflow dispatches work to a fresh-context subagent.

**Claude Code binding:**
- Dispatch via the agent/Task mechanism with `(agent_name, prompt, model?)`.
- `model` is per-dispatch overridable; use it as the primary auto-routing lever.
- Effort is NOT per-dispatch overridable: it is fixed in agent frontmatter per
  FILE, so varying it means varying the file. A cell names the rung and
  `cadence-core/bin/lib/rung-agent.mjs` names the file that carries it
  (`cad-plan-checker` at `medium` -> `cad-plan-checker-medium`); the map is
  stated per role rather than derived, because the unsuffixed `agents/<role>.md`
  is one rung among the others rather than the lowest. Self-verify fails in both
  directions: a rung with no file, and a rung file no role maps.
- A turn bound, but no timeout and no cancel. Every `agents/*.md` carries
  `maxTurns: 200` in its frontmatter, one uniform value across all 30 rung
  files, so that is the bound a dispatch runs under - and it is the only one
  this seam has: no wall-clock kill, and no way to cancel a dispatch already
  running. A config key claimed a wall-clock kill until v2.7.0, when it was
  deleted for naming a control nothing could apply. Plan size is still the real
  lever on what one dispatch costs, which is what `workflow.max_plan_tasks` is
  for. So a dispatch that comes back unusable has exactly two producers:
  the turn cap cut the dispatch, or the return is missing or unparseable. A
  coordinator's recovery arm names those two rather than a wall-clock kill this
  seam cannot produce (`cadence-core/workflows/execute.md`).
- A window CEILING that is READ, never applied. Six
  `workflow.max_dispatch_tokens` keys - one per dispatched role - say how large
  a dispatch's context window may get before the record calls it a finding, and
  `cadence-core/bin/planning.mjs` compares them against the record AFTER the
  fact. The budgeted quantity is the `tokens` on a `brackets[]` row of the
  rendered `.planning/trace.jsonl`: the terminal lifecycle event's figure, read
  as a FINAL-WINDOW PROXY rather than as a sum across the dispatch's turns,
  because that is the one window-shaped number the host hands back on a return
  and Cadence records no other and captures none for itself. This adds no second
  bound to the paragraph above: `maxTurns: 200` is still the only bound THIS
  seam has, because a ceiling read after the return is not a bound at dispatch
  time. Nothing can resize or cancel a dispatch already running - the same
  sentence that got the wall-clock key deleted in v2.7.0 - so a crossing is a
  REPORT and never a refusal, and the run it describes has already completed by
  the time anything reads it.
- THE STANDING EXPOSURE the ceiling above rests on, stated once because nothing
  in Cadence can fix it. Cadence reads THREE figures off a subagent return, and
  every one of them is copied by hand out of the host's own rendering of `Done
  (N tool uses - X tokens - Ys)`. There is no API handing them over.
  - The TOKEN count. It funds the per-role accounting in the rendered record's
    `roles` block and is the quantity the six `workflow.max_dispatch_tokens`
    ceilings above are compared against, so a change in how it prints empties
    both at once.
  - The TOOL-USE count, copied onto the close as `--turns`. A run's price is
    turns times window, so the token half alone can say what a worker returned
    and never what it cost to get there.
  - The DURATION, copied onto the close as `--duration-ms`. It is the only
    figure for how long the WORKER ran: the `ms` on a `brackets[]` row is
    dispatch-to-close wall clock and includes the orchestrator's own time
    between the two writes.
  Anthropic can change that rendering in any release, with no deprecation
  window and no version this seam can test for. `cadence-core/bin/weight-budgets.json`
  is the half of the same picture that does NOT depend on the host - it bounds
  the bytes Cadence puts INTO a dispatch, which is why a byte budget and a
  token ceiling are two controls and not one restated.
  THE MITIGATION IS ALREADY IN FORCE and is not work this states as owed: a
  return carrying no figure OMITS the flag rather than sending `0`, and the
  renderer keeps `unrecorded` distinct from a recorded zero (`turns_unrecorded`
  for the tool-use half, an absent `duration_ms` key for the wall clock). So a
  rendering change degrades the record to "this run was not measured" -
  visible, countable, and never a fabricated zero that reads as a measurement.
- Where those numbers come from. Each default is that role's 75th-percentile
  terminal `tokens` figure on this repo's own record, rounded UP to the next
  25,000, measured 2026-08-17 over every `return` and `checkpoint` event
  carrying a numeric `tokens`: `cad-planner` 200000 (n=28, p75 188,135, max
  247,585), `cad-executor` 200000 (n=72, p75 182,631, max 275,285),
  `cad-verifier` 100000 (n=24, p75 82,633, max 131,728), `cad-reviewer` 150000
  (n=2, p75 125,100), `cad-plan-checker` 75000 (n=5, p75 64,203, max 88,078),
  `cad-assumptions-analyzer` 150000 (n=25, p75 145,054, max 188,149). That rule
  fires on 26 of the record's 156 tokens-bearing terminals and on none of its
  middle, which is what keeps a crossing worth reading rather than half of every
  run. The numbers are config keys rather than a manifest pinned beside the
  check because the quantity is per-PROJECT: a repository whose files are twice
  this one's size needs different ones, and re-pinning is not a plugin release.
- Every dispatch is fresh-context and self-contained; there is no resume or
  "continue the same agent". A re-dispatch (revision, continuation, escalation)
  is a NEW spawn that reads the prior artifact from disk - never a
  resume/continuation of a prior run, which this seam does not provide.

**Worktree isolation.** The host provides the worktree for the parallel
`/cad-execute` path (`workflows/execute.md`'s `execute_parallel` step).
Cadence issues no `git worktree add` anywhere in `cadence-core/bin`,
`agents/`, `skills/` or `cadence-core/workflows/`, so it never pins the fork
point per dispatch - but the fork point IS selectable: the host's
`worktree.baseRef` setting decides it, and subagent worktrees use the same
base as `--worktree`. Claim holds for Claude Code >= 2.1.208 (before that a
`fresh` worktree used whatever `origin/HEAD` was already cached locally).
- `fresh` - the DEFAULT - branches from the repository's default branch on
  the remote, so unpushed work is absent: a phase's CONTEXT and its PLAN
  files, which live in commits on the integration branch, are not in the
  worktree. A worktree has been observed 31 commits behind, missing both the
  phase CONTEXT and its own `PLAN-2.md` (`.planning/CAPTURE.md:5`) - this
  default is why.
- `head` branches from the local `HEAD`, carrying the integration branch's
  unpushed commits. Inside a worktree, `head` resolves to THAT worktree's
  `HEAD`, not the main checkout's.

`git.base_branch` stays the landing and guard base, distinct from the
integration branch: the integration branch is what work merges back down to,
not a claimed worktree fork point.

It is a settings value, not a per-dispatch parameter, and a plugin must never
silently write a user's settings. So Cadence reads it and refuses: the
parallel path runs only under `head` (`workflows/execute.md`'s `choose_path`
preflight, via `cadence-core/bin/worktree-base.mjs`), and `/cad-config`
offers the change rather than making it.

The executor's assertion stays regardless - a setting the user can change back
is not a guarantee, and a session-level override is invisible to any script.
The executor asserts its own plan file exists before task 1 and halts
`blocked` when it does not (`skills/cad-executor-contract/SKILL.md`'s `<worktree_mode>`), and
reconciling a stale worktree is the orchestrator's serialized call, never the
executor's own merge/rebase/fetch.

**Routing (the quality bundle).** Before every dispatch, resolve the role
through the routing seam - never hardcode a model. The seam decides whether a
model parameter is sent AT ALL: `model: null` on the envelope means send none,
and the dispatch runs at the session's model, which is a resolved answer and
not a fallback (D-04):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role <agent_name> \
  [--attempt <N>] [--phase <N>] [--plan <k>] --bracket-read "<csv>" [--bracket-plan <key>]
```

**The bracket rides the resolve.** `--bracket-read` (the read-set this SITE
causes the worker to read, one comma-separated value) makes the resolve write
the worker's lifecycle `dispatch` event itself - one seam call where dispatch
sites used to pay two. `--bracket-plan` is the worker key when it is not the
role name (an executor's plan number). The CLOSE half is the CALLER's to
write, because the caller alone sees the return: ONE `trace close` per dispatch
moment, keyed
`--plan <the worker key>` and `--role <name>`, carrying
`--tokens <the figure on the subagent return>`,
`--turns <the tool-call count on that same return>` and
`--duration-ms <the wall clock on that same return>`. The seam fixes the family and
picks the arm off the DETAIL, whichever flag carried it (`--detail`, or
`--detail-file <path>` when the text is the worker's own): absent means
`return`, present means `checkpoint` (the worker came back empty, unmarked or
unusable). `escalation` on a path
change is NOT inferred and stays on `trace append`. OMIT `--tokens` when the
return carries no figure - never `--tokens 0`, which would claim a dispatch
that cost nothing - OMIT `--turns` on the same rule when the return carries
no tool-call count, never `--turns 0`, which would claim a dispatch that used
no tools - and OMIT `--duration-ms` when the return carries no wall clock,
never `--duration-ms 0`, which would claim a dispatch that took no time.
`--duration-ms` takes the host's OWN spelling (`1m 23s`, `450ms`) or a plain
millisecond count, so the figure is copied rather than converted; the standing
exposure all three of them create is stated in the window-CEILING bullet above.
`--agent-id <the id on the subagent return>` rides that same line and is its one
non-figure field. The CALLER is its only possible writer - the `dispatch` half is
written before the subagent exists, so it has no id to carry - and it is what
lets the `SubagentStop` hook know a worker whose bracket is already closed and
write nothing, rather than land a late stop on whatever else is open
(`lib/subagent-trace.mjs`). OMIT it when the host returned none: with two
dispatches of one role open and no id, that hook refuses rather than guess.
The caller is no longer the only WRITER of a close, and is still the only one
that can carry the three figures above: the host's `SubagentStop` hook
(`cadence-core/bin/subagent-trace.mjs`) now makes TWO different writes, and
they carry different identity. When it CLOSES - a session that died between
the two halves, a return nobody billed - it adopts the open bracket this
line never reached and carries THAT bracket's identity plus the stopped
worker's OWN `agent_id`, so a bracket the hook closed is joinable rather than
a dead end. When it CANNOT claim
a close - a worker that had not stopped when the host fired, a worker whose
bracket the caller had already closed, a worker whose role has two open
dispatches the evidence cannot separate - it writes a bracketless lifecycle
fact instead, `worker_cache`, claiming no bracket and carrying the stopped
worker's OWN `agent_id` alongside the `corr` and `phase` every lifecycle event
carries. The name stays `worker_cache` while its meaning widens - from the two
cache figures to what the hook read off the worker's own transcript, the
`effort` it ran at and the `rung` it was dispatched under included - because a
rename orphans every fact already written, here and on every other project's
record. BOTH writes now carry the same four values: the cache figures
`cache_creation_input_tokens` and `cache_read_input_tokens`, `effort`, the level
that worker's own transcript says the host actually served it, and `rung`, the
one it was DISPATCHED under. The pair is the point - the record states what a
rung was routed at beside what it ran at, so a reader can see them disagree, and
on Claude Code 2.1.258 they do: a `max` dispatch with extended thinking off runs
at `high` and nothing announces it. `effort` and `rung` are OMITTED together
where the transcript reported no effort, the same absent-is-not-zero rule
`--agent-id` follows above. The three the transcript answers - both cache
figures and `effort` - come off the stopped WORKER's own transcript, which the
stop payload names on `agent_transcript_path` - never the `transcript_path`
every hook event carries, which names this caller's own SESSION and is a
different actor's traffic entirely. `rung` is the one value off the payload and
it is `agent_type`'s stem through the one rung table, never the payload's own
`effort`, which carries the CONFIGURED level and cannot see that downgrade. That fact is
joined to a bracket at render time on `corr` plus `agent_id` - which is
exactly why `--agent-id` rides this caller's own line: without it there, no
bracket in the record carries the id the fact would need to join against,
and the same flag on the other ten close sites is what gives the fact
somewhere to land. The split is WHERE A FIGURE LIVES: `--tokens`,
`--turns` and `--duration-ms` are rendered on a return only this caller sees,
and the cache figures are rendered on no return at all, which is why they have
no flag here and why the hook is their only possible writer. They ride the
`brackets[]` row and never the `roles` token bill. So keep writing this line. It is a permanent FALLBACK rather than a
duplicate to prune: `/cad-task`'s phase-0 bracket has no subagent behind it for
any hook to close, and a hook-only design goes silently quiet on a host rename.
Two closes of one dispatch render as ONE bracket in either arrival order -
`lib/trace.mjs`'s worker-key dedup folds whichever arrived second into the row
the first opened, filling only the fields that row left empty - except the two
cache figures, where the LARGER read wins, because they have one writer and two
values for one worker are two reads of a transcript that only grows.
A
figureless return is ROUTINE (`lib/trace.mjs` holds the provenance), and the
`unrecorded` it produces names a silent return, never a skipped bracket. A
turn-figureless return is routine in the same way and renders under a counter
of its OWN, `turns_unrecorded`, distinct from the token `unrecorded`, so a
dispatch that reported tokens but no turns stays readable apart from one that
reported turns but no tokens. This
paragraph is the ONE statement of that rule; dispatch sites point here rather
than restating it.

One resolve returns FOUR knobs, not a model: `model` and `effort` for this
dispatch, `review` (the whole trigger -> gate map, which
`references/review-triggers.md` step 1 reads), and `verify` (whether the
deep-verify pass runs, which `workflows/verify.md` reads). Quality is not one
dial, and effort alone cannot express "fire a blocking cross-model review".

**The plan-time risk floor does exactly TWO things, and names no level.** It
makes the plan review blocking, and it turns the deep-verify pass on. That is
the whole list: it moves no role's model and no role's start rung, and there is
no third effect to look for. What raises it is the phase's own declared PLAN
`files:`, read at resolve time and scanned against the surfaces the project
answered. `reason` names every move - the phase, the surface, the file that
evidenced it, and the key it moved.

It fails CLOSED and never `ok:false`. A scope it could not read RAISES: a plan
file that would not parse, a declared file it could not stat, a scope naming no
readable plan at all. Only a scope every plan of which was found and read clean
can stand the floor down, and `reason` says which of the two happened, because
"nothing touched a surface" and "nothing could be read" want different fixes.

Withholding the raise takes a named waiver:
`review.triggers.risk_surface.waive_routing_floor` lists the surfaces this
project waives, and a surface named there withholds BOTH effects for that
surface - the plan review keeps its configured gate and the deep pass stays off.
A surface it does not name still raises, and every waiver applied is named in
`reason`. It waives neither review: the blocking `risk_surface` review still
fires on the actual diff, and this key cannot reach it.

A gate a config layer validly SET is what fires, raised or not: when the floor
raises a plan gate the user configured, `reason` says the gate was configured
and the floor moved nothing rather than moving it silently.

`--phase <N>` decides which phase the floor reads, the `.planning/STATE.md`
cursor decides it when the flag is absent, and a MALFORMED `--phase` is refused
- the alternative is a floor off another phase's files. `--plan <k>` narrows the
scope to ONE plan, which is what an executor floors on, so a clean plan in a
mixed phase is not raised by its risky sibling; a key naming no plan file takes
the fail-closed arm rather than widening back to the union. `cad-planner` and
`cad-assumptions-analyzer` are exempt and always have been - dispatched before a
plan exists, they read none, so the floor computes nothing for them and says
so.

- Pass `--attempt 2` (3, ...) when re-dispatching the SAME role after its prior
  run failed: with `model.escalate_on_failure: true` (an opt-in - the default
  holds the rung, because a retry is usually a narrower job than the pass that
  failed it) the re-dispatch climbs ONE rung on the `low, medium, high, xhigh,
  max` ladder from wherever this dispatch started, and swaps to that rung's
  file. One step, never a jump, and a rung this role files no agent for is
  stepped over rather than dispatched. At the top rung there is nowhere to
  climb: `reason` says the rung was held and `escalated` stays false - a held
  retry is never reported as an escalation.
- Use the returned `agent` and `model` in the dispatch. `escalated`/`reason` are
  for logging why.
- `{ok:false}` (unknown role, no table) → dispatch the **base** `agent_name` with
  no `model` override (session default). Routing never blocks a spawn.
- **Relay every `warnings[]` entry to the user before dispatching**, each
  DISTINCT warning once per workflow run - not once per dispatch. A warning
  that reaches JSON and no human is a resolved-then-dropped value wearing a
  diagnostic's clothes; but `route.mjs` runs per role per spawn, so an unscoped
  rule turns one deliberate config gate into a notice on every planner,
  executor, verifier and checker dispatch for the life of the project, and
  warning fatigue degrades the same channel the torn-layer and retired-key
  warnings depend on. ONE warning is not relayed and moved past: an
  entry saying a RETIRED routing key was ignored means a config layer still
  carries the single level that used to decide every role's model and effort,
  so the workflow opens `workflows/config.md`'s **Stakes migration** arm before
  dispatching and re-resolves after it.
- **The roles block answers first.** `roles.<role>.model` names the model this
  role is dispatched on and `roles.<role>.effort` names the rung it STARTS at.
  Nothing sits above them: there is no grid, no level and no table behind the
  answer, so what the user typed IS the routing. Unset means unset -
  `roles.<role>.model` with no value sends NO model parameter, and
  `roles.<role>.effort` with no value takes its own schema default, which is
  `high` for the planner, the analyzer, the verifier and the executor, `medium`
  for the reviewer and `low` for the plan checker.
- **The two older families are the narrower fallbacks UNDER them.**
  `model.overrides.<role>` answers the model when `roles.<role>.model` names
  none, and `model.effort.<role>` answers the rung when `roles.<role>.effort`
  names none. Silence falls back per KEY rather than per role, so a global layer
  naming only the model composes with a repo layer naming only the rung.
  Setting a roles key and its older sibling for one role adds a `warnings[]`
  entry naming which key won; the roles key wins. A rung the role has no file
  for is refused by the write face, naming the set that role does have, and at
  resolve time the next source down answers with the loser named in
  `warnings[]`.
- **An unaccepted model omits the parameter.** The model names the host takes
  are `opus`, `sonnet`, `haiku` and `fable`, and `roles.<role>.model` is a free
  string, so anything else can be written into it. A string the host does not
  accept resolves `ok:true`, dispatches with NO model parameter - the session's
  model runs - and names the rejected string in `warnings[]`. A typo must never
  silently redirect the spend, and it never falls through to
  `model.overrides.<role>` either: a roles key that is SET owns the answer for
  that role whether or not its value is accepted, and falling through would hand
  the role back to an older key on the typo alone. `fable` is accepted but
  deliberately never offered by the interview: it requires 30-day data
  retention, so a zero-data-retention org gets a hard `400` on every request;
  its safety classifiers refuse cyber-adjacent content, and Cadence reviews its
  own git rails and secrets handling; and its multi-minute turns press against
  `review.request_timeout_ms` inside the host's Bash ceiling. Choosing it is the
  user's assertion about their own org.
- **`model_source` says which key decided.** It is always present and carries
  the dotted key that chose the model - `roles.<role>.model` or
  `model.overrides.<role>` - or the string `session` when no key did, a set key
  whose value the host rejected included. It rides the `routing.resolve` trace
  event too. `pinned` stays FALSE when the roles block chose the model: it means
  `model.overrides` chose it, which is what the announcement rule below is keyed
  on, so read `model_source` and not `pinned` to learn what decided.
- **Tell the user when a pin fires.** A dispatch is approved through a UI that
  generally shows the agent name and not the model, so a pinned dispatch looks
  identical to a routed one at the moment of approval. When `pinned` is true,
  say so on its own line before spawning - "dispatching cad-planner on fable
  (pinned, routing would have picked opus)". Burying it in a preamble does not
  count; the user cannot verify what the dialog does not show.

**Concurrent dispatch.** Independent dispatches over disjoint payloads (the
per-plan executors of a parallel phase, per-doc verifiers, the two reviewers of
one artifact) fire concurrently in ONE message, bounded by the host's
max-concurrent-agents. Resolve the route ONCE per (role, attempt) and reuse it
across the batch - the payloads differ, the routing does not, so calling
`route.mjs resolve` again per dispatch is wasted. Serialize dispatches only when
one consumes another's returned artifact.

The EXECUTOR is the stated exception, and not because payloads differ: the plan
scope is a routing INPUT once the risk floor reads it, so the per-plan executors
of a parallel phase can resolve DIFFERENT bundles off one (role, attempt) - a
risky plan gets the blocking plan review and the deep pass, its clean sibling
does not. Each resolves its own, carrying its `--plan <k>`; every other role
keeps the rule.

**Prompt shape (cache discipline).** Order every dispatch prompt stable-first:
context that repeats across dispatches of the same role (phase/goal, shared
files to read) goes BEFORE the volatile per-dispatch specifics (this plan, this
scope, a continuation's completed-task table). The prompt cache matches the
longest identical prefix, so a stable preamble lets the 2nd..Nth dispatch of a
role read most of its prompt from cache instead of paying fresh. And never
restate rules the agent's own definition already carries - the definition is a
cached prefix; the dispatch prompt is billed fresh each time, so repeating
stable rules in it pays for them twice.

**Return shape (bounded handoff).** A subagent's return is the load-bearing
thing the orchestrator ingests back into the main context, so keep it bounded.
When the agent produced a durable artifact (a written file, commits), return a
slim summary plus the path/hashes and let the orchestrator open the artifact
only if it must - never echo the artifact's contents back. When there is no
artifact, cap the structured return to what the orchestrator will act on and
push raw evidence to a file rather than inline. This is what keeps the
orchestrator context flat across a long run of dispatches.

**Handoff read discipline.** The coordinator reads a source doc for handoff only
when it will DISTILL it into the dispatch prompt. If the spawned agent reads the
file whole itself, pass the pointer (the path), not the bytes - reading it in the
orchestrator just to hand it down doubles the read and bloats the main context
with a file the agent is about to open anyway.

**File round-trip (when the extra turn pays).** Routing an artifact through a
file costs one extra turn - the parent's read-back - so it pays only when BOTH
hold: the read-back folds into a turn the parent was taking anyway (writing
SUMMARY, making the docs commit, merging a worktree), and the artifact lands
LATE enough in the run that its bytes would otherwise ride every remaining turn.
A small return the parent acts on immediately is pure overhead and stays inline.
Which side extracts: whichever side has the SMALLER resident context, which is
why the child (holding one plan) writes the file and the parent (holding the
whole phase) reads a digest. Corollary: a parent must never read a file only to
hand it down - see Handoff read discipline above. The same two-clause test
covers any deferred read, not only a subagent round-trip: deferring a reference
pays when the read folds into a turn the command was taking anyway AND only some
branches reach it, so an eager `@`-include whose file is consulted on EVERY path
is already at break-even and stays eager. That test omits a SIZE term, and this
is it: an eager `@`-include costs its bytes times every remaining turn of the
run, while a deferred read costs one tool call inside a turn the command was
already taking, so an every-path reference whose residency outweighs that single
call is past break-even and defers anyway - and
`weight.mjs resident` is what decides which side a given include falls on. One
case stays eager whatever its size: a reference consulted at more than one
distinct STEP, since no single deferred read covers them all - mutually
exclusive arms of ONE step count as one site, which is exactly why `cad-land`
can defer `references/git-publish.md` (step 4a or step 4b, never both) while
`references/git-guard.md` stays eager at steps 1, 2 and 3. Any deferral made
from this point forward states, inline at the Read itself, the reference's
consult-site count - the number the eligibility rule above actually turns on.
It does NOT state the reference's byte size: a figure copied into prose is a
measurement that goes stale the next time the file is edited, and `weight.mjs`
reports the live number on demand. Cite the file, not its size. That count is
distinct consult STEPS, found by grepping the reference name and then reading which step
each hit sits under, with mutually exclusive arms counted once: a raw grep total
is NOT the number and will disagree, since both deferring skills return two
prose hits against a stated count of one. "Folds into" admits an extra tool
round-trip inside a turn the command was already taking; it does not admit a
read that forces a turn the command would not otherwise have taken. Shipped
applications: the
executor report read back at `workflows/execute.md`'s `summary`, the verifier
findings file consumed by `workflows/verify-deep.md`, and the cross-model
`--payload <file>`.
