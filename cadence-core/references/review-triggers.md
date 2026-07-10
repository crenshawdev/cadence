# Review trigger interface

STATUS: building (step 5). Spine skills call this interface from day one.
Backends: `claude-subagent` (default, zero-dep) spawns a fresh-context subagent
(spawn-agent seam) prompted to REFUTE the artifact and report findings;
cross-model reviewers (OpenAI / Gemini) run through the call-review-provider seam
(`bin/review-provider.mjs`, built). Still to wire: the per-skill `fire()`
dispatch/adjudication logic and the consult capability.

## fire(trigger)

1. Read `review.triggers.<trigger>` from `.planning/config.json`:
   `off | advisory | blocking | adjudicated`. `off` -> return immediately.
2. Assemble the payload (see wiring table).
3. Dispatch to the configured backend(s): `review.backend`, `review.reviewers[]`,
   `review.mode` (single | panel | adjudicated). Default backend is
   `claude-subagent` (zero-dep, via spawn-agent); cross-model reviewers
   (OpenAI / Gemini) go through the call-review-provider seam (a provider API
   call, not a CLI).
4. Act on the gating level:
   - **advisory** - report findings, continue.
   - **blocking** - PASS/FAIL; on FAIL, halt until findings are fixed or the
     user explicitly overrides.
   - **adjudicated** - reviewers run independently; an adjudicator grounds each
     claim against the actual repo state, kills false positives, and integrates
     the survivors before the verdict.

## Wiring (which skill fires what)

| Trigger | Fired by | When | Payload | Default |
|---|---|---|---|---|
| `plan` | `cad-plan` | after PLAN.md is written | the plan | adjudicated |
| `diff` | `cad-execute` | at plan completion | the plan's commits as a diff | advisory |
| `risk_surface` | `cad-execute` | at commit time, on detection match | the flagged diff | blocking |
| `pre_ship` | `cad-land` | before executing the publish mechanism | full branch diff | adjudicated |

`cad-verify` routes fix requests through this subsystem instead of spawning
its own fixer loop.

## risk_surface detection (shipped defaults, configurable)

Path/diff heuristics; a match fires the `risk_surface` trigger:
auth/authz/sessions - DB schema/migrations - money/billing/pricing -
concurrency/async/locking - destructive ops (deletes, bulk updates, drops) -
secrets/crypto/keys - public API/wire contracts - untrusted-input parsing.
