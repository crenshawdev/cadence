# Review subsystem: fire(trigger)

The single adversarial-review procedure the spine calls. A workflow that reaches
a trigger point runs `fire(<trigger>)` as defined here - it never inlines its own
reviewer loop. Two backends, one finding schema, so the adjudicator merges them
blind:
- `claude-subagent` (default, zero-dep): spawn the `cad-reviewer` agent via the
  spawn-agent seam, prompted to REFUTE the artifact.
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
3); take the reviewer's `agent` and `model` from the same line (step 4). If
the gate is `off`, return immediately (no-op). Else it is one of
`advisory | blocking | adjudicated` (step 6). The stakes level sets it, so the
same trigger gates differently on a solo project and a critical one.

The seam has ALREADY applied config-wins precedence: a
`review.triggers.<trigger>.gate` the user set beats the level's gate, and the
disagreement arrives as a `warnings[]` entry - relay it (seams.md) rather than
resolving it again here. A degraded resolve (`ok:false`) means no bundle: fall
back to the config gate and say so.

**Which fields reach which backend.** The gate governs both. The per-trigger
`tier` and `effort` govern the cross-model backend ONLY - they resolve the
provider's model id and its reasoning-effort API parameter (step 4). The
`claude-subagent` backend can honour neither: its model and its rung both come
from the routing seam, and effort is definition-time only on the spawn-agent
seam - not per-dispatch overridable (seams.md). That is a host constraint, not
an omission here. So a configured `effort` is not a promise this backend can
keep, and step 4 names the gap instead of dropping the value silently.

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
`warnings[]` entry. Relay it (seams.md); never silently skip a `blocking`
trigger.

The limit, so nothing above reads as a guarantee it is not: nothing REFUSES a
dispatch to a reviewer outside this set. The mark step 4 leaves on the run
record is the whole enforcement, so a substitution is visible afterwards rather
than prevented.

### 4. Run the reviewers
Issue the resolved set in ONE message (seams.md Concurrent dispatch);
serialize only when one dispatch consumes another's output, which a reviewer
set never does. Per backend:

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
  OMIT `--tokens` on a figureless return (seams.md's bracket rule):

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent --tokens <the token count on the subagent return>
  ```

  A dispatch that failed, returned nothing, or returned an unparseable object
  adds `--detail "<what failed>"` to that same line and the seam closes it as a
  checkpoint - a reviewer that burned its budget and came back unusable is
  exactly the dispatch whose cost must still reach the record.

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
  **When the per-trigger `effort` differs from the rung actually dispatched, say
  so in one line before dispatching**, e.g. "`diff` is configured at effort
  `medium`; the shipped level dispatches `cad-reviewer`, pinned at `high`, so it
  runs `high` - per-trigger effort reaches cross-model reviewers only". One line
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
  unstated amount. Compose the payload FILE in two shell steps and pass it with the
  EXISTING `--payload <file>` flag - no new subcommand or flag:
  ```
  git diff <base_ref>..<head_ref> > "${TMPDIR:-/tmp}/cad-artifact.txt"
  node -e 'const f=require("fs"),d=process.env.TMPDIR||"/tmp";f.writeFileSync(d+"/cad-payload.json",JSON.stringify({instruction:f.readFileSync(process.argv[1],"utf8")+"\n\n"+process.argv[2],artifact:f.readFileSync(process.argv[3],"utf8")}))' "${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md" "<instruction>" "${TMPDIR:-/tmp}/cad-artifact.txt"
  ```
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
  The second step takes the artifact path as its LAST ARGUMENT, which is what lets
  all three shapes share it: shape (b) redirects `git diff --cached` into the
  same scratch path, shape (c) drops the first step and passes its OWN absolute
  path instead. Hardcode the scratch name and shape (c) has no command at all -
  it silently ships the previous review's file. NEVER hand-assemble that JSON
  with `echo` or a heredoc - one
  unescaped quote or backslash anywhere in a diff makes the payload
  unparseable, which comes back as `bad-payload` after the shell already did
  the work. Both temp files are the model's scratch, never a phase artifact.
  `assertUnderCap` is UNCHANGED and still measures the parsed string fields,
  which under `--payload <file>` ARE the file's contents; a non-string
  `artifact` is still refused `bad-payload` before the cap is consulted. Then
  resolve
  `model = review.providers.<name>.tiers[trigger.tier]`
  and `effort = trigger.effort`, and run the seam:
  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" review \
    --provider <name> --model <model> --effort <effort> --trigger <trigger> \
    --payload "${TMPDIR:-/tmp}/cad-payload.json" \
    [--key-file <review.key_file, only if set>]
  ```
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
- `panel` - union all reviewers' findings (dedupe exact file+line+claim repeats).
- `adjudicated` - all reviewers run independently, then YOU (the main model)
  adjudicate: open the cited code, confirm or kill each finding, drop
  false positives and overstatements, merge findings raised by more than one
  reviewer (convergence = high confidence), and re-rank by grounded severity.
  The adjudicated survivor list is the result.

If `gate == "adjudicated"`, adjudicate regardless of `review.mode` (the gate is
the stronger signal). Adjudication is the same discipline the panel-review skill
uses: reviewers critique, the main model grounds and owns the verdict.

Once the survivor list is settled, record the outcome. This append and the
reported line below it are the ADJUDICATED arm's alone: advisory and blocking
fires keep writing exactly what they write today, and the stated cost is that
at `solo`, where `plan` stays advisory, `trace suggest` gets no rows about the
gate that fires most often there.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event adjudication --raised <findings the reviewers raised before adjudication> --detail "<trigger>: <n> survivors; voices <the reviewers that actually ran>"
```

Then report `<n> survivors of <m> raised` to the user at this step - the line
that makes a nine-findings-all-killed fire visible in the session and not only
in the record.

The RAISED count travels on the `--raised` FLAG and never inside `--detail`: a
figure parsed back out of that free-text slot would be exactly as trustworthy
as the voice-list substitution the slot is already condemned for, so do not
helpfully fold it back in.

`<N>` is the phase in hand, or the STATE cursor's phase for a trigger whose
range spans phases. The VOICE LIST is load-bearing, not decoration: a
`claude-subagent` voice never passes through `review-provider.mjs`, so it has no
provider event of its own, and the survivor count alone cannot show a panel
silently reduced to one voice while the gate reports clean - the dropped
cross-model reviewer is only half of it. Name the set that RAN, never the set
the trigger asked for.

**A `risk_surface` fire PERSISTS its settled survivors, at every gate.** Unlike
the append above, this is not the adjudicated ARM's alone: `risk_surface` is
`blocking` at every level, and the default `review.mode` still settles a
survivor list here. Write that list as the same JSON object every reviewer
returns to `.planning/phases/<N>/REVIEW-risk_surface-<discriminator>.md`.
`/cad-land`'s unattended close unions those files and pipes them to
`land-cleanup.mjs gate`, and it fires no review of its own, so this write is the
ONLY producer that halt has: skip it and an autonomous close merges over a
blocker nobody halted on.

Two properties keep the union honest, and both are failure modes that report
CLEAN rather than erroring:

- **Every write is discriminated - there is no unsuffixed path.** A per-plan
  fire uses `plan-<k>` per step 4's grammar; every other fire uses
  `<command>-<short HEAD sha>` (`REVIEW-risk_surface-debug-a1b2c3d.md`). The
  command half is not decoration: `/cad-debug` and `/cad-verify` can both fire
  against the SAME unchanged HEAD, so the sha alone still collides. Two fires
  sharing a filename do not merge, they overwrite - a later empty settle erases
  an earlier survivor the user had overridden.
- **The producer set outlives the phase dirs.** `/cad-milestone` step 3 prunes
  `.planning/phases/<N>/` and only then chains `/cad-land`, so it carries the
  survivors to `.planning/REVIEW-risk_surface-<label>.md` first. The consumer
  glob is BOTH that path and `.planning/phases/*/REVIEW-risk_surface*.md`. That
  carried file is TRANSIENT and never staged (milestone.md step 7 deletes it):
  committed, it would hard-halt every later land on an answered finding.

### 6. Consequence (gate)
RE-READ `references/triage-gate.md` before acting on ANY gate - `blocking`
included, not only `adjudicated`. It holds this step whole: all three arms
(`advisory` / `blocking` / `adjudicated`), the ONE-round cap on a blocking
re-arm, the multi-select triage the adjudicated arm asks, the `git.auto_close`
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

## risk_surface detection (shipped defaults, configurable)

Path/diff heuristics; a match in one of eight categories fires the
`risk_surface` trigger. The token beside each is the name that category carries
everywhere it is named by machine - in `review.triggers.risk_surface.surfaces`
and in route-table.json's `risk_surface_categories`:

- `auth` - auth/authz/sessions
- `migrations` - DB schema/migrations
- `billing` - money/billing/pricing
- `concurrency` - concurrency/async/locking
- `destructive` - destructive ops (deletes, bulk updates, drops)
- `secrets` - secrets/crypto/keys
- `api_contract` - public API/wire contracts
- `untrusted_input` - untrusted-input parsing

This list is also the operative definition of the `critical` stakes value: a
diff touching one of these surfaces is a break that does not come back as a bug
report.

**The set is chosen ONCE, at the first fire that needs it.** A `risk_surface`
fire whose step-1 resolve reports `surfaces_answered: false` does not proceed to
detection until the project has answered. Run the structural scan FIRST, so the
question arrives carrying evidence instead of asking the user to supply it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" detect-surfaces --root .
```

Then ask through the ask-user seam (seams.md): at most four options, the
recommended one first and labelled `(recommended)`, its REASON taken from the
scan's own output - which costs no research pass, because the scan already ran.

- When the scan reports `inconclusive: true`, recommend its `recommended` array
  (all eight) and say why in the reason: it found no dependency manifest and no
  category directory, so the structure evidences nothing either way. Never
  present a narrower set as the recommendation on evidence that does not exist
  (D-14) - the scan reports what it can SEE, and silence is never absence.
- Otherwise recommend its `recommended` array - what it evidenced, plus the
  categories no structure can ever evidence (`unspeakable`) - and name the
  `signal` string behind each evidenced one in the reason.
- Fill the remaining slots with the narrower sets a user plausibly wants: the
  evidenced categories alone, and all eight. Four options is the cap.

Persist the answer at the repo layer, which is what makes it a one-time ask:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set 'review.triggers.risk_surface.surfaces=["secrets","destructive"]'
```

The choice cannot be skipped and cannot be defaulted: the seam forbids
fabricating an answer it was supposed to collect, so an unanswered project does
not fire and does not proceed past the question. It is asked HERE and not in
`/cad-new-project` or `/cad-adopt` because both front doors forbid configuration
questions in their own prose AND in their own success criteria (D-15), and it
costs nothing on a project that never trips this trigger.

**The resolved set scopes the fire.** A heuristic match in a category OUTSIDE
the resolved `surfaces` set does NOT fire the trigger. That set comes from the
step-1 resolve, never from a config read at this site (D-13): a cost key whose
enforcement is a model remembering to read a value is the same substitution
shape step 3 closed for `review.reviewers`. With the key unset the resolve
returns all eight, so every category fires exactly as today and no existing
project's coverage shrinks on upgrade.

This is the ONE detector, and it reads the diff. A path match against a
phase's declared `files:` list was the other one until v2.7.0; it judged a file
by its NAME, floored a whole phase on one token, and is gone. `tests/ingest_concurrency.rs`
raising six roles to their top rung is what it cost.

**Pre-filter before escalating (avoid a blocking panel on a non-risk).**
These two drops are judgments about diff CONTENT.
A heuristic match is dropped - it does NOT fire the trigger - when the match
is provably harmless:

- **Ephemeral / gitignored target.** A destructive op (`rm -rf`, drop, bulk
  delete) whose only target is a gitignored or build-output path
  (`git check-ignore <path>` matches). For a directory target, also require
  `git ls-files -- <path>` to be empty - an ignored `dist/` that still holds
  a force-added tracked file is not safe to drop. Deleting a truly ignored
  `dist/` is a build clean, not data loss.
- **Placeholder-shaped secret.** A secrets/keys match drops ONLY when BOTH
  hold: the file is a template/sample/example (`*.env.example`, `*.sample`,
  `*.template`, or an obvious example fixture) AND the value is a stub
  (`<...>`, `changeme`, `your-...-here`, `xxx`, `example`, empty after `=`).
  Either alone still fires - a real key in a `.env.example`, or a
  placeholder-shaped value like `changeme` sitting in a runtime `.env` or
  deploy config as an actual weak secret, both stay worth the panel.

Drop only when the WHOLE match is harmless; a diff that also touches a real
risk surface still fires. When unsure, do not drop - fire the trigger. Note
each drop and why, so a mis-filter is visible rather than silent.
