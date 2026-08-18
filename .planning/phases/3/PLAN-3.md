---
phase: 3
plan: 3
requirements:
  - ISS-01
files:
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/issue-check.test.mjs
---

# Phase 3: Flags that do more or less than they say - Plan 3 (ISS-01)

## Goal

The per-issue resolve bound is a LAND's budget, not a per-call one: the resolve
loop is bounded by wall clock across the whole loop, so a `tea` that answers
slowly and exits non-zero can no longer cost the call timeout five times over
on the land path.

## Must be true when done

- With a PATH-stubbed `tea` that sleeps and exits non-zero, `issue-check.mjs
  check` over five or more referenced numbers completes inside ONE stated
  wall-clock budget rather than five call timeouts.
- That run still exits 0 with `ok:true` and `action:"report"`, and reports
  every number the loop did not reach as `unresolved`.
- A FAST non-zero resolve does not stop the loop: only budget exhaustion and a
  timeout do, so a land that references several absent issues still collects
  the answers that follow them.
- `MAX_RESOLVES` still caps the number of calls, and no new flag and no new
  config key exist - the budget derives from the existing
  `--timeout-ms`/`DEFAULT_TIMEOUT_MS` surface.
- `node --test cadence-core/bin/issue-check.test.mjs` passes and `node
  cadence-core/bin/self-verify.mjs` exits 0.

## Context

Locked: D-10 (a wall-clock BUDGET over the resolve LOOP, each call's timeout
derived from the remaining budget; `MAX_RESOLVES` stays as the separate
call-count cap), D-11 (a FAST non-zero resolve does NOT stop the loop - an
absent issue is a legitimate answer the loop must be able to collect several
of), D-12 (the budget derives from the existing `--timeout-ms` /
`DEFAULT_TIMEOUT_MS` surface - no new flag, no new config key; `cad-land`
passes no timeout at all, so a new flag would be inert on the shipped path),
D-15 (exhausting the budget still yields `ok:true`, `action:"report"`, exit 0,
with the unreached numbers reported `unresolved`), D-16 (the bound is proved
with the existing PATH-stub harness, never a live forge).

The existing deadline pattern in this tree is `lib/capture-file.mjs`'s
`Date.now()` budget in `takeLock`. `skills/cad-land/SKILL.md` is untouched: it
is the sole call site and passes no timeout.

## Tasks

### Task 1: Bound the resolve loop by wall clock

- **Files:** cadence-core/bin/issue-check.mjs,
  cadence-core/bin/issue-check.test.mjs
- **Action:** The resolve loop's only exit is `if (one.timedOut) break;`, and
  `run` sets `timedOut` from `err.signal === 'SIGKILL'` alone - so a CLI that
  answers at just under the per-call timeout and exits non-zero is never marked
  timed out, and `MAX_RESOLVES` calls each cost nearly the full bound. Take a
  `Date.now()` deadline once, when the loop starts, from the SAME resolved
  timeout value the flag and `DEFAULT_TIMEOUT_MS` already produce (D-12 - no
  new flag, no new key, no new constant a caller cannot reach), and derive each
  call's own timeout from what remains of it, so no single call can outlive the
  budget and the loop as a whole cannot exceed it. Stop the loop when the
  budget is spent. `MAX_RESOLVES` stays exactly as it is: a separate
  call-count cap with its own stated reason, not a thing this change folds
  into the budget. The comment above the loop states the old rule ("The loop
  STOPS at the first resolve killed at the call bound rather than continuing")
  and must be rewritten to state the new one, including which conditions end
  the loop; the header's `--timeout-ms` line and the `DEFAULT_TIMEOUT_MS` doc
  comment describe the value as the bound on every subprocess and must say what
  else it now bounds. Nothing about the envelope changes: `check` stays
  `ok:true` on every path, `detail` stays null, and no third-party output
  reaches the envelope.
- **Verify:** With a PATH-stubbed `tea` sleeping and exiting non-zero for every
  issue number, `issue-check.mjs check` over eight referenced numbers under an
  explicit `--timeout-ms` completes in less than the number of resolves times
  that bound and inside the single budget, measured in the test; `node --test
  cadence-core/bin/issue-check.test.mjs` passes, and the new case carries a
  `WATCHED FAILING AT <sha>` header naming a real commit preceding this fix,
  observed there taking one full call bound per resolve.

### Task 2: The two behaviours the budget must not break

- **Files:** cadence-core/bin/issue-check.test.mjs
- **Action:** Two guarantees the new exit condition sits directly beside, each
  as its own case against the existing PATH-stub harness (D-16). First (D-11):
  a FAST non-zero resolve does not stop the loop - build a commit set whose
  first unanswered number the stub exits 1 for immediately and whose LATER
  numbers it answers, and assert the later ones still resolve. The shipped
  fixture at `issue-check.test.mjs` cannot prove this: its absent number is the
  LAST one, so a loop that breaks on the first non-zero exit still passes it.
  Second (D-15): a run whose budget is exhausted mid-loop still exits 0 with
  `ok:true` and `action:"report"`, the numbers it reached carry their real
  states, and every number it did not reach is `unresolved` - never
  `not-found`, which would be an affirmative claim about input the seam could
  not read.
- **Verify:** `node --test cadence-core/bin/issue-check.test.mjs` passes; the
  first new case fails against a loop that breaks on any non-zero resolve exit,
  and the second asserts status 0, `ok:true`, `action:"report"` and an
  `unresolved` state for each unreached number on the same run Task 1 bounds.

## Notes

- This plan shares no file with PLAN-1 or PLAN-2 and can execute beside either.
