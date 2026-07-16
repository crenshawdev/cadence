# Review subsystem: fire(trigger)

The single adversarial-review procedure the spine calls. A workflow that reaches
a trigger point runs `fire(<trigger>)` as defined here - it never inlines its own
reviewer loop. Two backends, one finding schema, so the adjudicator merges them
blind:
- `claude-subagent` (default, zero-dep): spawn the `cad-reviewer` agent via the
  spawn-agent seam, prompted to REFUTE the artifact.
- cross-model (`openai` / `gemini`): the call-review-provider seam
  (`bin/review-provider.mjs`), a provider API call.

Every reviewer returns the same shape:
`{ findings: [ { file, line, severity: blocker|high|medium|low, claim, failure_scenario } ] }`.

## fire(trigger)

### 1. Gate
Read `review.triggers.<trigger>` from `.planning/config.json` - an object
`{ gate, tier, effort }`. If `gate == "off"`, return immediately (no-op). Else
`gate` is one of `advisory | blocking | adjudicated` (step 6).

### 2. Payload
Assemble `{ instruction, artifact }` from the wiring table:
- `artifact` = the plan text, the diff, or the files under review.
- `instruction` = what to critique and how, e.g. "Refute this phase plan against
  its goal" / "Refute this diff; find the input that breaks it." Keep it specific
  to the trigger.

### 3. Resolve the reviewer set
Start from `review.reviewers[]`. For each entry, keep only if available:
- `claude-subagent` - always available.
- `openai` / `gemini` - available iff `review.providers.<name>.tiers[<trigger.tier>]`
  is a non-null model id (a key is resolved lazily by the seam; a `no-key`
  result at call time drops it - step 4).

If the resolved set is empty (e.g. `reviewers: ["openai"]` but its `<tier>` is
unassigned), fall back to `["claude-subagent"]` so a review always runs. Log the
fallback; never silently skip a `blocking` trigger.

### 4. Run the reviewers
For each reviewer in the set, in parallel where the host allows:

- **claude-subagent**: dispatch `cad-reviewer` through the spawn-agent seam with
  the payload as its prompt. Parse the JSON object it returns.
- **openai / gemini**: resolve `model = review.providers.<name>.tiers[trigger.tier]`
  and `effort = trigger.effort`, then run the seam:
  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" review \
    --provider <name> --model <model> --effort <effort> \
    [--key-file <review.key_file, only if set>]
  ```
  with `{instruction, artifact}` on stdin. Read the one JSON line.
  - `ok:true` -> use `findings`.
  - `ok:false` -> this reviewer is unavailable. Report `reason` (`no-key` names
    where to set the key). Drop it from the set. If dropping it empties the set,
    fall back to `claude-subagent` (step 3 rule) rather than return nothing.

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

### 6. Consequence (gate)
- **advisory** - report the findings, continue. Nothing halts.
- **blocking** - PASS if no `blocker`/`high` finding survives, else FAIL. On
  FAIL, halt and surface the findings; resume only after they are fixed (re-run
  fire) or the user explicitly overrides. A reviewer that could not run does not
  silently PASS - report that the gate could not be evaluated and ask.
- **adjudicated** - the survivors are already grounded (false positives killed),
  so hand the survivor list back to the firing workflow to act on: `cad-plan`
  applies them to the plan file(s), `cad-land` factors them into the publish
  decision. It does not auto-halt like `blocking`, and it is not the auto-replan
  convergence loop (cut in DESIGN §6) - it grounds once and hands off, it does
  not iterate review->revise->review on its own. Use for the deep, rare gates
  (plan, pre_ship).

`cad-verify` routes fix requests through fire() (as a review that produces the
fix list) instead of spawning its own fixer loop.

## Wiring (which skill fires what)

| Trigger | Fired by | When | Payload artifact | Shipped gate |
|---|---|---|---|---|
| `plan` | `cad-plan` | after PLAN.md is written | the plan | adjudicated |
| `diff` | `cad-execute` | at plan completion | `git diff <pre-plan HEAD>..HEAD` | advisory |
| `risk_surface` | `cad-execute`, `cad-debug`, `cad-task`, `cad-verify` | at commit/fix time, on detection match | the flagged diff | blocking |
| `phase_diff` | `cad-execute` (parallel path only) | after all worktree batches merge | `git diff <PHASE_START>..HEAD` | off (opt-in) |
| `pre_ship` | `cad-land` | before executing the publish mechanism | full branch diff | adjudicated |

## risk_surface detection (shipped defaults, configurable)

Path/diff heuristics; a match fires the `risk_surface` trigger:
auth/authz/sessions - DB schema/migrations - money/billing/pricing -
concurrency/async/locking - destructive ops (deletes, bulk updates, drops) -
secrets/crypto/keys - public API/wire contracts - untrusted-input parsing.

**Pre-filter before escalating (avoid a blocking panel on a non-risk).**
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
