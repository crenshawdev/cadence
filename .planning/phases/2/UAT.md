---
status: testing
phase: 2
fields_version: 1
started: 2026-08-26
updated: 2026-08-26
---

## Items

### 1. Host-return contract documented, stale seams.md citations gone
expected: references/seam-spawn-agent.md names tokens, tool uses and duration, what each funds (brackets, weight-budgets.json, the six max_dispatch_tokens keys), and says the rendering can change with no deprecation, naming the omit --tokens / unrecorded-vs-0 recovery. `grep -n 'seams\.md' cadence-core/config.schema.json` returns no hit inside the six max_dispatch_tokens purposes.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: seam-spawn-agent.md:43-68 names all three figures, what each funds, the no-deprecation exposure and the omit/unrecorded mitigation already in force; `grep -n 'seams\.md' cadence-core/config.schema.json` returns nothing (exit 1) and the six max_dispatch_tokens purposes now cite seam-spawn-agent.md.

### 2. SubagentStop registered and closes a dispatch with no hand-written close
expected: hooks/hooks.json registers SubagentStop, and a real Cadence dispatch completed with NO hand-written `trace close` still appears closed in `planning.mjs trace render --phase 2`. (human-verify: needs a live subagent dispatch in the host)
criterion: AC2
status: pending

### 3. A dispatch whose close never runs is still paired
expected: `trace render` lists that dispatch under `brackets`, not `unpaired`. (human-verify: needs a live subagent dispatch in the host)
criterion: AC3
status: pending

### 4. Two writers on one dispatch render as one close
expected: When both writers fire on one dispatch, `trace render` shows exactly one close for that (corr, phase, plan) and `unpaired` gains no row; a test drives both paths against a fixture and asserts the count is 1.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Ran both real writers against scratch fixtures in both arrival orders: brackets 1, unpaired [], figures (tokens 12345, turns 7, duration_ms 83000) and the checkpoint arm all survive, role billed for one dispatch with nothing unrecorded. Backed by trace.test.mjs:1640-1687, which asserts brackets.length===1 and deep-equals the two orderings.

### 5. self-verify reddens on a renamed hook event and prints the name
expected: Renaming a registered event in hooks/hooks.json to a name outside the pinned set makes self-verify report a failure that prints the offending event name.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify --root against a repo-shaped fixture whose hooks.json renames SubagentStop -> SubagentStopped: ok:false, one unregistered-hook-event problem whose detail contains the exact spelling `SubagentStopped` and lists the declared set. Live tree ok:true with hook-events in `checked`.

### 6. --duration-ms takes the host's spelling, render reports it, flag census is 190
expected: `trace close --duration-ms` accepts a formatted spelling like `1m 23s` without refusal, `trace render` reports a duration per bracket, and arg-contract.test.mjs asserts 190 flag entries.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: '1m 23s' -> duration_ms 83000, 4200 -> 4200, 'later' and a bare flag both refused with nothing appended; `trace render` over the live record shows duration_ms on the brackets whose close carried one (802630, 739724) and no key at all on those that did not; arg-contract.test.mjs:304 asserts 190.

### 7. Full test suite green, BRACKETING loop still exercises the hand-written close
expected: `node cadence-core/bin/test.mjs` is green and trace.test.mjs's BRACKETING loop still asserts closed === dispatched over prose files.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs -> 3321 pass, 0 fail, exit 0; trace.test.mjs:2123-2151 still runs assert.equal(closed.length, dispatched) over the 9-file BRACKETING map plus the zero-raw-terminal-append assertion.

## Summary

total: 7
passed: 5
failed: 0
pending: 2
skipped: 0
blocked: 0
reworked: 0
