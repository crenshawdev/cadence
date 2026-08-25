# Review subsystem: fire(trigger)

The single adversarial-review procedure the spine calls. A workflow that reaches
a trigger point runs `fire(<trigger>)` as defined here - it never inlines its own
reviewer loop. Two backends, one finding schema, so the adjudicator merges them
blind:
- `claude-subagent` (default, zero-dep): spawn the `cad-reviewer` agent via the
  spawn-agent seam, prompted to REFUTE the artifact. Bounded by that seam's turn
  cap, `maxTurns: 200`.
- cross-model (`openai` / `gemini` / `deepseek`, ... - any provider with an
  adapter): the call-review-provider seam (`bin/review-provider.mjs`), a
  provider API call.

Every reviewer returns the same shape:
`{ findings: [ { file, line, severity: blocker|high|medium|low, claim, failure_scenario } ] }`.

## fire(trigger)

### 1. Gate
Resolve the bundle ONCE through the routing seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-reviewer
```

Take the gate from the resolved bundle's review map, keyed by this trigger's
name; take the reviewer SET from its `reviewers` map, keyed the same way (step
3); take the reviewer's `agent` and `model` from the same line, and the
cross-model half's model tier and reasoning effort from that line's
`reviewer_tiers` and `reviewer_efforts` maps, keyed the same way again (step
4). If
the gate is `off`, return immediately (no-op). Else it is one of
`advisory | deferred | blocking | adjudicated` (step 6). The stakes level sets it, so the
same trigger gates differently on a solo project and a critical one.

The seam has ALREADY applied config-wins precedence: a
`review.triggers.<trigger>.gate` the user set beats the level's gate, and the
disagreement arrives as a `warnings[]` entry - relay it (seam-spawn-agent.md)
rather than resolving it again here. The same precedence has applied to the
tier and the effort since RVW-03, so those two maps are answers, not defaults:
a layer that
set `review.triggers.<trigger>.tier` or `.effort` is already folded in, and
where no layer did, the STAKES LEVEL's row answered - raising `stakes` moves the
cross-model half of the panel exactly as it moves the subagent half. A degraded
resolve (`ok:false`) means no bundle: fall back to the config gate, tier and
effort, and say so.

**Which fields reach which backend.** The gate governs both. The per-trigger
tier and effort govern the cross-model backend ONLY - they resolve the
provider's model id and its reasoning-effort API parameter (step 4), and both
arrive RESOLVED on the step-1 line rather than being read from config here. The
`claude-subagent` backend can honour neither: its model and its rung both come
from the routing seam, and effort is definition-time only on the spawn-agent
seam - not per-dispatch overridable (seam-spawn-agent.md). That is a host
constraint, not an omission here. So a configured `effort` is not a promise
this backend can keep, and step 4 names the gap instead of dropping the value
silently.

### 2. Payload
Assemble `{ instruction, artifact }` from the wiring table:
- `instruction` = what to critique and how, e.g. "Refute this phase plan against
  its goal" / "Refute this diff; find the input that breaks it." Keep it specific
  to the trigger.
- `artifact` = a REFERENCE, never the material itself. Inlining a diff keeps
  every byte of it resident here for the rest of the run, when the reviewer can
  produce it in one command. Three shapes; every fire site names the one it uses:
  - **(a) refs** - `{base_ref, head_ref}`, an already-committed range.
  - **(b) staged-diff scope** - `git diff --cached` plus the paths, for an
    uncommitted change in the ORCHESTRATOR's OWN tree. The reviewer re-runs the
    command: a Task-dispatched subagent inherits the parent's cwd, so it reads
    the same index.
  - **(c) a path** - a file artifact (a PLAN), or one the reviewer's tree cannot
    reach. A plan's committed range is the latter for `risk_surface`: shape (a)
    refs is not one of the shapes this trigger admits, so the orchestrator
    writes `git diff <pre-plan HEAD>..HEAD` to a file and fires with that path,
    which also survives worktree mode, where the range is not in this tree.

### 3. Take the reviewer set
Step 1's resolve already answered this half: its `reviewers` map, keyed by this
trigger's name, IS the set. TAKE it from that same line - alongside the gate -
and do not derive one here. One resolve serves every dispatch: payloads differ,
routing does not.

What the seam decided, stated so the set is readable rather than mysterious:
- `claude-subagent` is always available.
- any cross-model provider named in `review.reviewers` (`openai`, `gemini`,
  `deepseek`, ...) is kept iff `review.providers.<name>.tiers[<tier>]` is a
  non-null model id, where `<tier>` is the layer's `review.triggers.<t>.tier`
  when a layer set one and `route-table.json`'s `tiers` row otherwise. The rule
  is by provider `<name>`, not a fixed list: any provider with an adapter in
  `review-provider.mjs` and a config `review.providers.<name>` block resolves
  the same way. A key is resolved lazily at CALL time, so a `no-key` result
  there still drops a reviewer this set kept (step 4).

An empty set already arrives as `["claude-subagent"]`, so a review always runs -
and the resolve says which provider it dropped and at which tier, as a
`warnings[]` entry. Relay it (seam-spawn-agent.md); never silently skip a
`blocking` trigger.

The limit, so nothing above reads as a guarantee it is not: nothing REFUSES a
dispatch to a reviewer outside this set. The mark step 4 leaves on the run
record is the whole enforcement, so a substitution is visible afterwards rather
than prevented.

### 4. Run the reviewers
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

  `<N>` follows the rule the adjudication append in step 5 already states: the
  phase in hand, or the STATE cursor's phase for a milestone-scoped trigger.

  Then dispatch the `agent` and `model` the step-1 resolve
  returned, through the spawn-agent seam, with the payload as its prompt. It
  gets the refs, the scope, or the path and PRODUCES the artifact itself - it
  holds Read, Bash, Grep and Glob, and its cwd is this one. Parse
  the JSON object it returns, and close the bracket the moment you have it.
  OMIT `--tokens` on a figureless return (seam-spawn-agent.md's bracket rule):

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return>
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
  not this site, closes the bracket:
  - the findings path `.planning/phases/<N>/REVIEW-<trigger>.md` (a per-plan
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

  That agent is the reviewer rung the LEVEL names -
  `cad-reviewer-medium` at solo, the unsuffixed `cad-reviewer` (this role's
  `high` rung) at shipped and on a solo retry, `cad-reviewer-xhigh` at
  critical and on a shipped retry, and `cad-reviewer-max` when a critical-level
  fire is re-dispatched with `--attempt 2`. That
  enumeration is the DEFAULT table's: a configured `model.effort.cad-reviewer`
  start rung replaces the level's rung, so the resolve's own `agent` field,
  never this list, is what dispatches and what any mismatch line names. The per-trigger
  `effort` is NOT
  passed and cannot be - the seam's surface is `(agent_name, prompt, model?)` -
  so the reviewer runs at the `effort:` its own rung file pins.
  **When the RESOLVED per-trigger effort differs from the rung actually
  dispatched, say so in one line before dispatching**, e.g. "`diff` resolves at
  effort `low`; the shipped level dispatches `cad-reviewer`, pinned at `high`, so
  it runs `high` - per-trigger effort reaches cross-model reviewers only". One line
  per fire, not per reviewer, and nothing when the two agree. A resolved value
  the backend cannot deliver is a degradation like any other: name it. Do not
  "fix" it by editing the config or by pretending the effort applied.
- **any cross-model provider** (`openai` / `gemini` / `deepseek`, ...): an API
  call runs nothing, so this is the one backend that cannot resolve a reference
  itself. **This arm gets NO lifecycle bracket and no token field, deliberately.**
  It is the one place a real API-reported usage figure could exist rather than a
  host-reported one, and no adapter extracts one today. State the consequence
  rather than let a reader infer completeness: under a panel, `cad-reviewer`'s
  per-role total in `trace render` covers the claude-subagent voice ONLY, and the
  provider call that ran beside it is unmeasured, so that number is short by an
  unstated amount. Compose the payload FILE inside THIS RUN's own scratch
  directory and pass it with the EXISTING `--payload <file>` flag - no new
  subcommand or flag:
  ```
  D="$(mktemp -d "${TMPDIR:-/tmp}/cad-review-XXXXXX")" \
    && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D holds a character a carried literal cannot survive" >&2; exit 1;; esac \
    && T="$$-$(date +%s)" && printf '%s' "$T" > "$D/run-token" \
    && git diff <base_ref>..<head_ref> > "$D/artifact.txt" \
    && node -e 'const f=require("fs");const rd=(p)=>{try{return f.readFileSync(p,"utf8")}catch(e){console.error("scratch-unreadable: "+p+": "+e.message);process.exit(1)}};const brief=rd(process.argv[1]),art=rd(process.argv[3]);if(art===""){console.error("scratch-unreadable: "+process.argv[3]+" is empty");process.exit(1)}f.writeFileSync(process.argv[4],JSON.stringify({instruction:brief+"\n\n"+process.argv[2],artifact:art}))' "${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md" "<instruction>" "$D/artifact.txt" "$D/payload.json" \
    && echo "scratch dir: $D  run token: $T"
  ```
  A carried literal is pasted into a later command unquoted-by-construction, so the guard REFUSES the directory at creation rather than trying to quote it defensively at every use site: `mktemp` builds the path from `$TMPDIR`, which the operator does not always own (a cloned repo's `.envrc`, a devcontainer, a CI runner), and one `"` in it closes the argument and runs the rest as commands. The character class is deliberately narrow - a `TMPDIR` holding a space is refused too, and fixing that is one `export` away, where a path that executes is not.

  **The directory and the token are ECHOED because the seam call below runs in a
  DIFFERENT Bash invocation**, where `$D` is empty - the tool persists the
  working directory and not shell state. Carry both printed values into that
  block as LITERALS. A fixed shared scratch name here is the worst collision in
  the tree: a concurrent review in another repository would be the one whose
  diff is sent to the provider under this run's instruction, at a gate that
  blocks. The token is what a carried path needs, because a previous run's
  payload is well-formed BY CONSTRUCTION and no shape guard can tell it from
  this run's.
  The composer REFUSES rather than composing something the provider would
  accept: a brief or an artifact it cannot read, and an artifact that is EMPTY,
  each name `scratch-unreadable` on stderr and exit non-zero without writing a
  payload. The empty case is not defensive padding - an empty artifact is
  exactly what a failed or colliding redirect leaves behind, and it would
  otherwise be sent as a review of nothing.
  The `instruction` is the reviewer BRIEF followed by this trigger's own
  sentence, never the sentence alone.
  `references/reviewer-brief.md` is the stance, the severity definitions, the
  "approach differences are NOT findings" rule and the empty-findings rule -
  the bar the claude-subagent arm gets from `skills/cad-reviewer-contract` and
  this arm had no way to receive, so the two backends' findings were being
  merged blind while only one of them had been told what a `blocker` is. The
  same `node -e` step reads it, for the same reason it reads the artifact:
  nothing is hand-assembled.
  It is composed HERE, at the fire site, and NOT inside `review-provider.mjs`
  because `assertUnderCap` measures the payload's parsed string FIELDS - bytes
  added here are inside what the cap counts, so an over-cap payload is still
  refused before any request is issued, while bytes added in the seam would be
  invisible to it (the cap deliberately excludes the adapters'
  schema-injection bytes) and every provider's cap would under-report by the
  brief. The cost is measured, not unknown: about 670 estimated tokens against
  the 120,000 default `review.max_prompt_tokens`, ~0.6% of one payload.
  The composing step takes the artifact path as its THIRD argument and the
  payload path it WRITES as its fourth. Both are arguments, and that is what
  lets all three shapes share the step: shape (b) redirects `git diff --cached`
  into the same run directory in place of the range diff, and shape (c) drops
  the diff step and passes its OWN absolute path as that third argument.
  Hardcode either name - as the payload path was, derived inside the script
  from the environment - and shape (c) has no command at all, and every run
  writes over every other run: it silently ships the previous review's file.
  NEVER hand-assemble that JSON
  with `echo` or a heredoc - one
  unescaped quote or backslash anywhere in a diff makes the payload
  unparseable, which comes back as `bad-payload` after the shell already did
  the work. Both files are the model's own scratch inside that run directory,
  never a phase artifact, and the directory is left for the operating system to
  reap.
  `assertUnderCap` is UNCHANGED and still measures the parsed string fields,
  which under `--payload <file>` ARE the file's contents; a non-string
  `artifact` is still refused `bad-payload` before the cap is consulted. Then
  take this trigger's tier and effort off the step-1 line -
  `reviewer_tiers[<trigger>]` and `reviewer_efforts[<trigger>]` - index the
  provider's own map with the tier
  (`model = review.providers.<name>.tiers[<the resolved tier>]`),
  and run the seam with that model and that effort. Check the run token FIRST,
  in the same invocation, so a carried path that is not this run's refuses
  instead of being sent:
  ```
  [ "$(cat "<the echoed scratch directory>/run-token" 2>/dev/null)" = "<the echoed run token>" ] || { echo "scratch-stale: that directory holds another run payload" >&2; exit 1; }
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" review \
    --provider <name> --model <model> --effort <effort> --trigger <trigger> \
    --payload "<the echoed scratch directory>/payload.json" \
    [--key-file <review.key_file, only if set>]
  ```
  Both `<the echoed ...>` placeholders are the literals the composition block
  printed, never a fresh `mktemp` and never a `$(...)` - a path is the
  caller-derived-text rule `references/conventions.md` states, and re-deriving
  the directory here would point `--payload` at an empty one.
  `--trigger` is what JOINS this arm's seam-written event to the fire: the event
  it writes already shares the phase's correlation id, and the trigger name is
  the field that was missing. That event plus the subagent arm's `--reviewer`
  field are what make two fires of ONE trigger - one cross-model, one subagent -
  distinguishable in the record afterwards.
  Read the one JSON line.
  - `ok:true` -> use `findings`.
  **Run this with an explicit command timeout of at least
  `review.request_timeout_ms`** (default 540000; the host's own default is
  120000 and its ceiling 600000). Without one the host kills the command
  first, and a host kill prints NOTHING - the "one JSON line" below is then an
  empty string, strictly worse than the `{ok:false, reason:"transport"}` this
  seam degrades to on its own timer. A high-effort review legitimately takes
  minutes (a flagship model on a ~13KB diff measured 292s), and the bound is a
  socket INACTIVITY timeout on an unstreamed response, so it caps total
  thinking time rather than detecting a dead
  connection. Set it too low and the blocking gates lose their cross-model
  voices to `reason:"transport"` while still reporting PASS.
  - `ok:false` -> this reviewer is unavailable or unusable. Before dropping it,
    emit one visible line naming the degradation - the reviewer and its
    `reason` (`no-key` names where to set the key), e.g. "cross-model reviewer
    `openai` unavailable: no-key (set $OPENAI_API_KEY) - dropping it from the
    reviewer set". Do not swallow the reason silently. Drop the reviewer from
    the set. If dropping it
    empties the set, fall back to `claude-subagent` (step 3 rule) rather than
    return nothing. A payload over `review.max_prompt_tokens` arrives here as
    `reason: over-cap`, refused before any request was issued.

### 5. Combine (review.mode)
- `single` - use the first available reviewer only; its findings are the result.
- `panel` - union all reviewers' findings, then dedupe exact file+line+claim
  repeats.
- `adjudicated` - all reviewers run independently, then YOU (the main model)
  adjudicate: open the cited code and confirm or kill EVERY finding raised, PER
  RAISING VOICE, dropping false positives and overstatements and re-ranking by
  grounded severity.

RULE FIRST, MERGE AFTER, on both arms: the dedupe and the convergence merge that
produce the survivor LIST run on the RULED set, never ahead of it. A merged
finding has no raising voice, only a list, so merging first destroys the
attribution before any record can hold it - and per-voice attribution is what
makes a reviewer's individual hit rate countable, which is the measurable form
of this project's claim that its controls are fallible machinery. Convergence
still means high confidence and still ranks the survivor. What the gate acts on
and what the user is shown do not change: the adjudicated survivor list, after
the merge, is the result, it keeps its shape and its order, and
`references/triage-gate.md` presents it as the same numbered multi-select.

If `gate == "adjudicated"`, adjudicate regardless of `review.mode` (the gate is
the stronger signal). Adjudication is the same discipline the panel-review skill
uses: reviewers critique, the main model grounds and owns the verdict.

Once the survivor list is settled, record the outcome. The trace append and the
reported line below it are the ADJUDICATED arm's alone: advisory and blocking
fires keep writing exactly what they write today, and the stated cost is that
at `solo`, where `plan` stays advisory, `trace suggest` gets no rows about the
gate that fires most often there. The ADJUDICATION RECORD further down is NOT
scoped that way: it is written on the BLOCKING arm as well, at the settle point
`references/triage-gate.md` names. The ADVISORY arm writes neither, and the
reason is not tidiness - its reviewer writes the findings file and closes its
own bracket, and this session may end before the return lands, so nothing is
positioned to rule. An advisory fire reads as unrecorded.

Write the detail - `<trigger>: <n> survivors; voices <the reviewers that
actually ran>` - to a scratch file and pass its path; the voice list is composed
from what actually ran (caller-derived text - references/conventions.md):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event adjudication --trigger <trigger> --plan <k> --base <base> --sha <head> --raised <findings the reviewers raised before adjudication> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] --detail-file <path>
```

Then report `<n> survivors of <m> raised` to the user at this step - the line
that makes a nine-findings-all-killed fire visible in the session and not only
in the record.

`--plan <k>` is required whenever the fire was per-plan: `risk-check status`
joins a receipt to a record on the run AND the plan, so a receipt written
without it keys to no plan and joins nothing, leaving a range that WAS fired and
adjudicated reading as never fired. Omit it only for a fire that is not per-plan
(`/cad-debug`, `/cad-task`, `/cad-verify`).

`--base <base> --sha <head>` name the RANGE this adjudication settled - BOTH
ends, since two ranges can share a head and differ at the base and are then
different diffs over different surfaces. That is what lets `risk-check status`
tell an adjudication of THIS range from one of an earlier, narrower range for
the same plan. A receipt missing either end settles nothing, so omitting one
leaves a matched range reading as never fired.

The RAISED count travels on the `--raised` FLAG and never inside `--detail`: a
figure parsed back out of that free-text slot would be exactly as trustworthy
as the voice-list substitution the slot is already condemned for, so do not
helpfully fold it back in. The three SETTLED counts travel the same way, on
`--survivors`, `--downgraded` and `--refuted`, and they are the figures the
record seam DERIVED and returned on its envelope - never a number you counted
by hand off the survivor list, and never folded into `--detail` either. The
seam recounts the record's rulings against them and REFUSES a receipt that
disagrees, which is what makes the survivor count recomputable instead of
asserted. `--round <round>` is omitted on an ordinary fire and carries the
round on a re-armed one, because that is the record the recount has to read:
without it a round-two settle is checked against round one's stale rulings and
passes whenever the two counts happen to coincide. The TRIGGER travels the same way, on `--trigger`,
and `--plan <k>` rides a per-plan fire: `risk-check status` joins a matched
range to its receipt on those two structured fields and never on the detail
(`references/triage-gate.md` states the rule at all four settle points).

`<N>` is the phase in hand, or the STATE cursor's phase for a trigger whose
range spans phases. The VOICE LIST is load-bearing, not decoration: a
`claude-subagent` voice never passes through `review-provider.mjs`, so it has no
provider event of its own, and the survivor count alone cannot show a panel
silently reduced to one voice while the gate reports clean - the dropped
cross-model reviewer is only half of it. Name the set that RAN, never the set
the trigger asked for.

Then WRITE THE ADJUDICATION RECORD: the rulings themselves, not a count of them.
An adjudicated-only rule would record nothing at all on most projects -
`route.mjs resolve` returns `plan: blocking` and `risk_surface: blocking` at
`shipped` stakes - and would exclude the sharpest case there is, a gate that
passed with everything killed.

YOU compose the payload, because you are the only actor holding both the raised
finding bodies and the ruling: `review-provider.mjs` returns `findings` on
stdout and never persists them, its own record carries provider, model, effort,
tier, duration and outcome with no finding field, and
`skills/cad-reviewer-contract/SKILL.md` specifies a return shape only. Compose
it as a FILE in THIS RUN's own scratch directory, the way the provider payload
is composed above, and NEVER hand-assemble that JSON with `echo` or a heredoc:
the record's whole content is verbatim reviewer text with arbitrary quoting, so
one unescaped quote makes the payload unparseable after the adjudication is
already done and cannot be redone.

The payload carries, PER VOICE, the reviewer's returned findings object
VERBATIM, that voice's model, and one ruling per returned finding -
`{voices: [{voice, model, returned, rulings: [...]}]}`, one entry per finding
RAISED per raising voice. A `ruling` is `survived`, `downgraded` or `refuted`
and there is no fourth value. Each ruling RESTATES the claim and the failure
scenario it rules on, and the seam REFUSES the payload when a restatement
differs from the returned text by one byte: the entry is stored from the
reviewer's own words, so a paraphrase is refused rather than recorded. A
`refuted` ruling names the contradicting code in its counter-evidence; a
`survived` one names the fix commit.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" adjudication --phase <N> --trigger <trigger> --discriminator <discriminator> --base <base> --head <head> --payload <path>
```

It lands at `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`,
beside the sibling `REVIEW-<trigger>-<discriminator>.md` and on the same
discriminator grammar, which this step states once at its end. It does NOT go
inside `<plandir>/reports/`: the lease check
exempts exactly one path under that directory by byte equality, so anything else
staged from there answers `undeclared-files`.

A RE-ARM PASSES `--round 2`, and the fire site is the only actor that knows
which round it is on. A capped re-arm (`references/triage-gate.md`, ONE round)
is a SECOND fire of the same trigger on the same plan, so it resolves to the
same discriminator: round two lands at `...-<discriminator>-r2.json`, while an
ordinary fire passes nothing and keeps the sibling's exact name. Omitting it on
a re-arm is REFUSED - never merged and never overwritten - because round one's
record is what an auditor reads to see the finding a fix was claimed to close.

**A `risk_surface` fire PERSISTS its settled survivors, at every gate.** Unlike
the append above, this is not the adjudicated ARM's alone: `risk_surface` is
`blocking` at every level, and the default `review.mode` still settles a
survivor list here. `/cad-land`'s unattended close is the ONLY consumer that
halt has - it fires no review of its own - so skipping the write lets an
autonomous close merge over a blocker nobody halted on. Where the list is
written, and the two properties that keep its union honest, are in
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md`.

**The discriminator grammar, stated ONCE here** because both the record above
and the survivor write use it: `plan-<k>` for a per-plan fire,
`<command>-<short HEAD sha>` for every other one
(`REVIEW-risk_surface-debug-a1b2c3d.md`). The command half is not decoration -
`/cad-debug` and `/cad-verify` can both fire against the SAME unchanged HEAD,
so the sha alone still collides, and two fires sharing a filename do not merge,
they overwrite.

### 6. Consequence (gate)
RE-READ `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before
acting on ANY gate - `blocking` included, not only `adjudicated`. It holds this
step whole: all four arms
(`advisory` / `deferred` / `blocking` / `adjudicated`), the ONE-round cap on a
blocking re-arm, the multi-select triage the adjudicated arm asks, the `git.auto_close`
carve-out inside `/cad-land`, and the `cad-verify`
fix-list rule. It is a separate file because the fire sites re-read it at their
gate step without loading this one - and a `blocking` site that treats the read
as an adjudicated-only errand is exactly how an uncapped re-arm gets back in.

## Wiring (which skill fires what)

The gate column is per LEVEL: solo / shipped / critical, in that order.

| Trigger | Fired by | When | Payload artifact | Gate (solo/shipped/critical) |
|---|---|---|---|---|
| `plan` | `cad-plan` | after PLAN.md is written | (c) the PLAN file path(s), plus `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` and `.planning/phases/<N>/CONTEXT.md` (optional) - the artifacts the plan is checked AGAINST | advisory / blocking / adjudicated |
| `diff` | `cad-execute` | at plan completion | (a) refs `<pre-plan HEAD>..HEAD` | off / off / blocking |
| `risk_surface` | `cad-execute`, `cad-debug`, `cad-task`, `cad-verify` | on detection match, ONCE per plan/task/fix - `cad-execute`/`cad-task` on the completed commit range, never mid-plan; `cad-debug`/`cad-verify` on their single staged fix | (c) the range-diff FILE path, or (b) the staged-diff scope for a single in-tree fix | blocking / blocking / blocking |
| `phase_diff` | `cad-execute` (parallel path only) | after all worktree batches merge | (a) refs `<PHASE_START>..HEAD` | off / off / adjudicated |

`risk_surface` is `blocking` at every level on purpose: it fires only on a
detection match, and there is no level at which a matched risk surface is worth
waving through.

`phase_diff` is `off` at `shipped` because an advisory gate blocks nothing and
its findings files were referenced by no SUMMARY and no CONTEXT - the dispatch
bought findings that changed nothing. A user who reads them sets
`review.triggers.<t>.gate` back on and wins over the level; that is the existing
config-wins precedence in step 1, not new code.

`plan` is `blocking` at `shipped` on that same measurement: it condemned the
ADVISORY gate, not the review, so the choice was a gate that changes an outcome
or no review at all. A plan is the cheapest artifact to halt on - no code exists
yet - and `blocking` adds no user-triage turn, which is what `critical` buys.

It fires on a COMPLETED range, never on a staged index mid-plan. Halting an
executor at each risky commit bought nothing the range-level fire does not:
the reviewer saw a half-built change, and every halt cost a fresh-context
re-dispatch whose only job was writing code no plan task authorized - itself
new risk surface, and the next halt. Blocking on the finished range keeps the
gate and drops the loop.

## The `risk_surface` trigger's own contract

Everything specific to this trigger is one Read away, and no other branch of
this file needs it: the `risk-check run` seam call, the two `surface`-named
libraries, the eight categories, the one-time surfaces ask and how it is
persisted, the resolved-set scoping, the two pre-filter drops, and the survivor
write step 5 names.

TWO ways in, one file. Either this fire's trigger IS `risk_surface`; or this
site runs detection without necessarily firing anything at all - `/cad-execute`'s
`risk_check` step, `/cad-task`, `/cad-debug` and `/cad-verify` each do, and a
range that matches nothing fires no review and reads nothing else here.

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md`.
