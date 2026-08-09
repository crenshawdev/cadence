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
name; take the reviewer's `agent` and `model` from the same line (step 4). If
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
    reach. An executor's flagged staged diff is the latter: no ref pair names an
    uncommitted change, and in worktree mode it is not in this tree at all, so
    the executor writes it to a file and its checkpoint returns the absolute
    path.

### 3. Resolve the reviewer set
Start from `review.reviewers[]`. For each entry, keep only if available:
- `claude-subagent` - always available.
- any cross-model provider named in `review.reviewers` (`openai`, `gemini`,
  `deepseek`, ...) - available iff `review.providers.<name>.tiers[<trigger.tier>]`
  is a non-null model id (a key is resolved lazily by the seam; a `no-key`
  result at call time drops it - step 4). The rule is by provider `<name>`, not a
  fixed list: any provider with an adapter in `review-provider.mjs` and a config
  `review.providers.<name>` block resolves the same way.

If the resolved set is empty (e.g. `reviewers: ["openai"]` but its `<tier>` is
unassigned), fall back to `["claude-subagent"]` so a review always runs. Log the
fallback; never silently skip a `blocking` trigger. Step 1's resolve serves
the set, reused by every dispatch: payloads differ, routing does not.

### 4. Run the reviewers
Issue the resolved set in ONE message (seams.md Concurrent dispatch);
serialize only when one dispatch consumes another's output, which a reviewer
set never does. Per backend:

- **claude-subagent**: dispatch the `agent` and `model` the step-1 resolve
  returned, through the spawn-agent seam, with the payload as its prompt. It
  gets the refs, the scope, or the path and PRODUCES the artifact itself - it
  holds Read, Bash, Grep and Glob, and its cwd is this one. Parse
  the JSON object it returns. That agent is the reviewer rung the LEVEL names -
  `cad-reviewer-medium` at solo, `cad-reviewer-xhigh` at shipped AND critical,
  and `cad-reviewer-max` when a critical-level
  fire is re-dispatched with `--attempt 2`. The unsuffixed `cad-reviewer` is
  this role's `high` rung, reachable only through solo's retry. That
  enumeration is the DEFAULT table's: a configured `model.effort.cad-reviewer`
  start rung replaces the level's rung, so the resolve's own `agent` field,
  never this list, is what dispatches and what any mismatch line names. The per-trigger
  `effort` is NOT
  passed and cannot be - the seam's surface is `(agent_name, prompt, model?)` -
  so the reviewer runs at the `effort:` its own rung file pins.
  **When the per-trigger `effort` differs from the rung actually dispatched, say
  so in one line before dispatching**, e.g. "`diff` is configured at effort
  `medium`; the shipped level dispatches `cad-reviewer-xhigh`, pinned at `xhigh`, so it
  runs `xhigh` - per-trigger effort reaches cross-model reviewers only". One line
  per fire, not per reviewer, and nothing when the two agree. A resolved value
  the backend cannot deliver is a degradation like any other: name it. Do not
  "fix" it by editing the config or by pretending the effort applied.
- **any cross-model provider** (`openai` / `gemini` / `deepseek`, ...): an API
  call runs nothing, so this is the one backend that cannot resolve a reference
  itself. Compose the payload FILE in two shell steps and pass it with the
  EXISTING `--payload <file>` flag - no new subcommand or flag:
  ```
  git diff <base_ref>..<head_ref> > "${TMPDIR:-/tmp}/cad-artifact.txt"
  node -e 'const f=require("fs"),d=process.env.TMPDIR||"/tmp";f.writeFileSync(d+"/cad-payload.json",JSON.stringify({instruction:process.argv[1],artifact:f.readFileSync(process.argv[2],"utf8")}))' "<instruction>" "${TMPDIR:-/tmp}/cad-artifact.txt"
  ```
  The second step takes the artifact path as an ARGUMENT, which is what lets
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
    --provider <name> --model <model> --effort <effort> \
    --payload "${TMPDIR:-/tmp}/cad-payload.json" \
    [--key-file <review.key_file, only if set>]
  ```
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

Once the survivor list is settled, record the outcome:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event adjudication --detail "<trigger>: <n> survivors; voices <the reviewers that actually ran>"
```

`<N>` is the phase in hand, or the STATE cursor's phase for a milestone-scoped
trigger like `pre_ship`. The VOICE LIST is load-bearing, not decoration: a
`claude-subagent` voice never passes through `review-provider.mjs`, so it has no
provider event of its own, and the survivor count alone cannot show a panel
silently reduced to one voice while the gate reports clean - the dropped
cross-model reviewer is only half of it. Name the set that RAN, never the set
the trigger asked for.

### 6. Consequence (gate)
RE-READ `references/triage-gate.md` before acting on ANY gate - `blocking`
included, not only `adjudicated`. It holds this step whole: all three arms
(`advisory` / `blocking` / `adjudicated`), the ONE-round cap on a blocking
re-arm, the multi-select triage the adjudicated arm asks, the `git.auto_close`
carve-out scoped to `pre_ship` inside `/cad-land`, and the `cad-verify`
fix-list rule. It is a separate file because the fire sites re-read it at their
gate step without loading this one - and a `blocking` site that treats the read
as an adjudicated-only errand is exactly how an uncapped re-arm gets back in.

## Wiring (which skill fires what)

The gate column is per LEVEL: solo / shipped / critical, in that order.

| Trigger | Fired by | When | Payload artifact | Gate (solo/shipped/critical) |
|---|---|---|---|---|
| `plan` | `cad-plan` | after PLAN.md is written | (c) the PLAN file path(s) | advisory / adjudicated / adjudicated |
| `diff` | `cad-execute` | at plan completion | (a) refs `<pre-plan HEAD>..HEAD` | off / advisory / blocking |
| `risk_surface` | `cad-execute`, `cad-debug`, `cad-task`, `cad-verify` | at commit/fix time, on detection match | (c) the flagged-diff FILE path the checkpoint returned, or (b) the staged-diff scope in-context | blocking / blocking / blocking |
| `phase_diff` | `cad-execute` (parallel path only) | after all worktree batches merge | (a) refs `<PHASE_START>..HEAD` | off / off / adjudicated |
| `pre_ship` | `cad-land` | before executing the publish mechanism | (a) refs `<base>..HEAD` | advisory / adjudicated / adjudicated |

`risk_surface` is `blocking` at every level on purpose: it fires only on a
detection match, and there is no level at which a matched risk surface is worth
waving through.

## risk_surface detection (shipped defaults, configurable)

Path/diff heuristics; a match fires the `risk_surface` trigger:
auth/authz/sessions - DB schema/migrations - money/billing/pricing -
concurrency/async/locking - destructive ops (deletes, bulk updates, drops) -
secrets/crypto/keys - public API/wire contracts - untrusted-input parsing.

This list is also the operative definition of the `critical` stakes value: a
diff touching one of these surfaces is a break that does not come back as a bug
report. A machine translation of it now lives in `cadence-core/route-table.json`
as the `surfaces` block, where a path match against the phase's own PLAN
`files:` list RAISES the resolved stakes level at dispatch time (see
`references/seams.md` § Routing).

So TWO detectors exist and neither replaces the other. The dispatch-time one is
a path match: coarse, with no diff in hand, and it sets the stakes floor for the
whole phase. This section's one is model judgment at commit time: it reads the
actual diff and fires the trigger. A phase can be floored without this trigger
firing, and this trigger can fire on a phase the floor never raised.

**Pre-filter before escalating (avoid a blocking panel on a non-risk).**
These two drops are judgments about diff CONTENT, so they apply to the
COMMIT-TIME detection only - the dispatch-time floor has no diff to judge, and
the per-surface override is its escape hatch instead.
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
