# Portability seams

Cadence runs on Claude Code only. These three seams are the ONLY places where
host-runtime specifics may appear. Workflows and skills reference the seam by
name and follow its binding; they never inline host-specific alternatives.
A future runtime port edits this file, not the workflows.

## Seam: ask-user

How a workflow asks the human a question and blocks on the answer.

**Claude Code binding:**
- Structured choice: the `AskUserQuestion` tool, at most four options per
  question, and `multiSelect: true` when more than one option may be picked. A
  set larger than the option cap splits across questions - minus any
  always-present option such as NONE, which consumes a slot - and the questions
  batch at most four per call. Two caps, not one: options per question, and
  questions per call.
- Open-ended question: end the turn with the question in plain prose.
- Never fabricate or default an answer the seam was supposed to collect.

**Recommended option.** For a structured choice, put the option the workflow
recommends FIRST and label it `(recommended)` - unless the choice is one of the
deliberate no-default decisions below. This is a display convention (a nudge),
never a pre-selection: the user still chooses and the seam still blocks.

No research tax: the recommendation must fall out of analysis the step ALREADY
does - the analyzer's ranked alternatives, the sweep's severity order, the
config value in hand. Never add a reasoning or research pass just to produce
one. When no best option is already evident - a plain confirm ("Yes" /
"Correct some"), or genuinely equal alternatives - order them naturally and
omit the label rather than inventing a recommendation.

**Deliberate no-default decisions (never mark a recommendation).** A few choices
are consequential either/ors the tool must not steer: present them plainly, no
recommended option, no reordering toward one -
- the publish mechanism in /cad-land (push / MR or PR / tag / leave local), and
- the protected-branch guard when work would land on a protected branch
  (references/git-guard.md rail 1).
These stay undefaulted by design; a nudge there is a bug, not a convenience.

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
  directions: a rung with no file, and a rung file no cell reaches.
- A turn bound, but no timeout and no cancel. Every `agents/*.md` carries
  `maxTurns: 200` in its frontmatter, one uniform value across all 19 rung
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
through the routing seam - never hardcode a model, never dispatch a role at
the session default when the project has stated its stakes:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role <agent_name> \
  [--attempt <N>] [--phase <N>] --bracket-read "<csv>" [--bracket-plan <key>]
```

**The bracket rides the resolve.** `--bracket-read` (the read-set this SITE
causes the worker to read, one comma-separated value) makes the resolve write
the worker's lifecycle `dispatch` event itself - one seam call where dispatch
sites used to pay two. `--bracket-plan` is the worker key when it is not the
role name (an executor's plan number). The CLOSE half stays with the caller,
which alone sees the return: ONE `trace close` per dispatch moment, keyed
`--plan <the worker key>` and `--role <name>`, carrying
`--tokens <the figure on the subagent return>` and
`--turns <the tool-call count on that same return>`. The seam fixes the family and
picks the arm off the DETAIL, whichever flag carried it (`--detail`, or
`--detail-file <path>` when the text is the worker's own): absent means
`return`, present means `checkpoint` (the worker came back empty, unmarked or
unusable). `escalation` on a path
change is NOT inferred and stays on `trace append`. OMIT `--tokens` when the
return carries no figure - never `--tokens 0`, which would claim a dispatch
that cost nothing - and OMIT `--turns` on the same rule when the return carries
no tool-call count, never `--turns 0`, which would claim a dispatch that used
no tools. A
figureless return is ROUTINE (`lib/trace.mjs` holds the provenance), and the
`unrecorded` it produces names a silent return, never a skipped bracket. A
turn-figureless return is routine in the same way and renders under a counter
of its OWN, `turns_unrecorded`, distinct from the token `unrecorded`, so a
dispatch that reported tokens but no turns stays readable apart from one that
reported turns but no tokens. This
paragraph is the ONE statement of that rule; dispatch sites point here rather
than restating it.

One resolve returns FOUR knobs, not a model: `model` and `effort` for this
dispatch, `review` (the whole trigger -> gate map for the level, which
`references/review-triggers.md` step 1 reads), and `verify` (whether the
deep-verify pass runs, which `workflows/verify.md` reads). Quality is not one
dial, and effort alone cannot express "fire a blocking cross-model review".

The stakes level a config layer set is the level, full stop. A `--phase <N>`
or, when the flag is absent, the `.planning/STATE.md` cursor names the phase a
resolve records against; neither changes the level.

- Pass `--attempt 2` (3, ...) when re-dispatching the SAME role after its prior
  run failed: with `model.escalate_on_failure: true` (an opt-in - the default
  holds the rung, because a retry is usually a narrower job than the pass that
  failed it) the re-dispatch climbs to the retry rung the SAME cell names, and
  swaps to that rung's file. Where the retry rung
  equals the starting rung, `reason` says the rung was held and `escalated`
  stays false - a held retry is never reported as an escalation.
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
  warnings depend on.
- The stakes level picks the row and the role picks the cell in it; the level
  never reacts to `--attempt` by itself - a retry climbs the rung, not the level.
- **Per-role pin.** `model.overrides` maps one role to one model alias
  (`opus`/`sonnet`/`haiku`/`fable`) and wins over the cell's model.
  The resolver reports `pinned: true` and names
  the swap in `reason`; effort is untouched, so a pinned role still climbs to
  its retry rung file. `haiku` and `fable` are reachable this way ONLY - the
  routed vocabulary is `sonnet` and `opus`. An unrecognized alias adds a
  `warnings` entry and the routed model stands - a typo must not silently
  redirect the spend. For `fable` pin-only rests on no ranking claim: it
  requires 30-day data
  retention, so a zero-data-retention org gets a hard `400` on every request;
  its safety classifiers refuse cyber-adjacent content, and Cadence reviews its
  own git rails and secrets handling; and its multi-minute
  turns press against `review.request_timeout_ms` inside the host's Bash
  ceiling. Pinning it is the user's assertion to make about their own org, not
  the table's.
- **Per-role start rung.** The `model.effort` family names the rung a role
  STARTS at, replacing the one its cell holds. One key per role
  (`model.effort.cad-verifier` and so on, six in all), and the accepted values
  are exactly that role's own rungs - the write face refuses any other by key,
  naming the set that role does have. The value lives in the config layers,
  never in the shipped table. It raises and lowers freely, and it always wins
  over the cell. A retry never resolves below it: `--attempt 2` takes whichever
  of the cell's retry rung and the configured start rung sits higher, and says
  which one it out-ranked.
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

## Seam: call-review-provider

How the review subsystem reaches a cross-model reviewer. A cross-model review
is a direct provider HTTPS call (OpenAI / Gemini), NOT a CLI subprocess: review
is a pure function (artifact in -> structured findings out), and the provider
API enforces the finding schema. All provider specifics live in one bundled
script; workflows invoke the script and never inline HTTP or provider bytes.

**Claude Code binding:**
- Run `cadence-core/bin/review-provider.mjs` via the shell (installed at
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs`):
  - Review: `review --provider <openai|gemini> --model <id> [--effort <level>]`,
    the `{instruction, artifact}` payload on stdin. Stdout is one JSON object:
    `{ok:true, findings:[...]}` or `{ok:false, reason, detail}`.
  - Consult: `consult --provider <name> --model <id> [--effort <level>]`, the
    `{situation}` payload on stdin -> `{ok:true, angles:[...]}` (dead-end help;
    see references/consult.md). Same key resolution and degradation as review.
  - Model detection: `detect-models --provider <name>` -> `{ok:true, models:[...]}`.
  - Pass `--key-file <path>` from config `review.key_file` when set (else omit;
    the script uses the XDG default). Never pass a key itself.
- The script resolves the key itself (env first, then the shared providers.env)
  and NEVER logs it; the workflow passes no key.
- Degradation is structured, not exceptional: `ok:false` with `reason` one of
  `no-key | transport | http | over-response | no-output | bad-json | bad-shape`
  (call-shape problems surface as `over-cap | bad-payload | bad-provider |
  bad-args | bad-command`, and an unforeseen bug as `internal`). `over-cap` is
  the prompt bound: `review` and `consult` both refuse a payload over
  `review.max_prompt_tokens` estimated tokens (chars/4, default 120000) BEFORE
  any request is issued; `claude-subagent` never runs this script and is exempt
  from it, bounded instead by the spawn-agent turn cap, `maxTurns: 200`.
  `over-response` is the same bound the other way round, on the response:
  every command destroys the request once the body passes 4 MiB, so a flooding
  provider meets a refusal Cadence owns rather than the execution host's wrapping
  command timeout, and an `http` failure carries `detail.body` as a sanitized
  1024-byte excerpt, always a string, never the body. On `no-key`
  the review subsystem falls back to `claude-subagent` and does not offer a
  consult; a `blocking` trigger reports the failure rather than silently pass.
- The default backend `claude-subagent` does NOT use this seam - it goes
  through spawn-agent with a fresh-context, refute-prompted reviewer, and takes
  that seam's turn cap as its bound in place of anything stated here.
- Model, effort, and per-provider endpoint/key-file path come from config
  (`review.providers.<name>`; per-trigger `review.triggers.<t>.tier` resolves
  the model id, `.effort` the reasoning level).
  A future non-HTTP reviewer backend replaces this script, not the workflows.
