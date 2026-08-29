---
status: testing
phase: 1
fields_version: 1
started: 2026-08-29
updated: 2026-08-29
---

## Items

### 1. A malformed fix_commit is refused on downgraded and refuted
expected: Writing a record whose `downgraded` or `refuted` entry carries `fix_commit: "not-a-sha"` returns a refusal whose detail names BOTH the field and the ruling. The same value on a `survived` entry is refused by that one same check, and the three existing assertions matching /no usable fix_commit/ are still green.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: adjudication-record.mjs:429-443 holds the hoisted check outside the survived arm, refusing with `... is <ruling> and carries no usable fix_commit`; the survived arm at :465-478 keeps only the PRESENCE requirement. adjudication-record.test.mjs 52 pass / 0 fail with the three pre-existing /no usable fix_commit/ arms and three new RSK-08 arms.

### 2. An empty or null fix_commit is refused, not silently dropped
expected: A `downgraded` entry carrying `fix_commit: ""` or `fix_commit: null` is REFUSED. Before this phase both returned ok:true with the key silently absent from the stored entry.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Presence read as `!== undefined` at adjudication-record.mjs:438 and the entry-emit spread at :512 changed off truthiness; adjudication-record.test.mjs:395-419 drives '' and null on both downgraded and refuted and asserts ok:false with entries [].

### 3. A reasonless receipt over a cleared halt is refused
expected: `trace append` refuses a receipt settling a record that holds a survived blocker or high marked `overridden: true` when that receipt asserts no override; the refusal names the record/receipt CONTRADICTION rather than an event name, and nothing is appended. An `override --detail-file` receipt over the same record is accepted, and that accepted shape is stated in references/triage-gate.md.
criterion: AC3
status: fail
first_pass: fail
source: verifier
evidence: cadence-core/bin/planning/trace.mjs:1317 - `if (!['survivors','downgraded','refuted'].some((k) => k in fire.settled)) return pass;`. Measured on the shipped tree with the same fixture shape the phase's own tests use (scratch repo, risk-check run, adjudication of a survived blocker with overridden:true, record written at phases/1/ADJUDICATION-risk_surface-plan-1.json): `planning.mjs trace append --phase 1 --family outcome --event gate_pass --trigger risk_surface --plan 1 --base <base> --sha <head>` with no settled figures returned ok:true and WAS appended, and `planning.mjs risk-check status --phase 1 --plan 1 --base <base> --head <head>` then returned ok:true with plans[0].state === 'recorded'. Nothing else closes it: recountReceipt (trace.mjs:1225) needs all three keys present, and planning/risk-check.mjs:710-721 demands a reason only on the `override` event name, so a figureless `gate_pass` is an accepted FIRE_RECEIPT. Note the guard IS correct on every documented shape - references/triage-gate.md:98 and :109 both spell all three figures - so the hole is the undocumented-but-accepted figureless receipt.
reported: behavior wrong - the guard is declinable. `overrideAccounted` only runs when the receipt carries at least one of --survivors/--downgraded/--refuted, so a settle receipt carrying NONE of the three skips it entirely and still settles the range. The phase deliberately pinned a test that dropping ONE figure cannot discharge the marker; dropping all three does discharge it, which is strictly easier and leaves the goal's second half ('overridden: true no longer discharges the module's strongest refusal on an unverifiable self-assertion') false as stated.
severity: major
cause: The precondition at cadence-core/bin/planning/trace.mjs:1317 tests whether ANY of the three settled figures is PRESENT, so a receipt carrying NONE of them returns pass before the record is ever opened. The docblock at :1280-1286 reasoned only about a caller dropping ONE figure from an otherwise-complete settle line; dropping all three was not considered, and it is strictly easier. Nothing downstream closes it: recountReceipt (trace.mjs:1225) needs all three keys present before it does anything, and planning/risk-check.mjs:710-721 demands a reason only when e.event === 'override', so a figureless gate_pass is an accepted FIRE_RECEIPT and risk-check status reports the range 'recorded'. There is no purely structural discriminator between a settle receipt (gate_pass/override/adjudication, which carry counts by contract) and a non-settle one (rearm/deferral, which the docblock says stay out of scope BY carrying none) - the only thing that separates them is the event name, and D-04 forbids a runtime refusal keyed to an event name in this seam. So closing the hole requires a decision, not a line change: either relax D-04 here, or refuse a figureless settle receipt at the point counts are validated rather than inside overrideAccounted.
fix: routed to /cad-plan

### 4. The ruling vocabulary and the overridden grammar are unchanged
expected: RULINGS is still exactly `survived | downgraded | refuted`, and `overridden: true` on a `downgraded` or `refuted` entry, or on a survived medium or low, is still accepted with no receipt demanded - proved by adjudication-record.test.mjs:292-300 and :309-317 green unchanged.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: No edit to RULINGS in the phase diff; adjudication-record.test.mjs:294-302 and :311-317 green unmodified, and the new arm 'a record holding NO cleared halt takes a reasonless receipt unchanged' proves a survived medium still settles with no reason.

### 5. One predicate answers the unfixed-halting-survivor question on both faces
expected: lib/filing-decision.mjs answers the unfixed-halting-survivor question over a written record's entries[], and its payload face returns the IDENTICAL answer for the same data, proved by one test driving both faces over one fixture.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: filing-decision.mjs:113-126 is the sole statement of the three-field test (grep for `overridden !== true` across non-test bin/*.mjs returns only :121); unfixedFindings:147-151 is the wrapper. adjudication-record.test.mjs:459-495 asserts the two faces deep-equal over one fixture. filing-decision.test.mjs 40/40 and issue-filing.test.mjs 34/34 green, both files untouched.

### 6. Both refusals reproduce end to end over a mixed-ruling fixture
expected: Over a fixture carrying one entry of each ruling with at least one bad `fix_commit`: `risk-check run` -> adjudication -> receipt -> `risk-check status` runs through, with the AC1 and AC3 refusals landing exactly where those criteria say.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: planning-adjudication.test.mjs:574-680 walks risk-check run -> adjudication (refused, then corrected) -> reasonless receipt (refused, nothing appended) -> override --detail-file (accepted) -> risk-check status 'recorded', asserting the stored ADJUDICATION-*.json entries. 27/27 green.

### 7. The full suite and self-verify are green
expected: `node cadence-core/bin/test.mjs` exits 0 with 0 failures and `node cadence-core/bin/self-verify.mjs` reports ok:true with problems: [].
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs -> 3563 tests, 3562 pass, 0 fail, 1 skipped, exit 0. node cadence-core/bin/self-verify.mjs -> ok:true, problems: [].

## Summary

total: 7
passed: 6
failed: 1
pending: 0
skipped: 0
blocked: 0
reworked: 1
