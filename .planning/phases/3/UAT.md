---
status: testing
phase: 3
fields_version: 1
started: 2026-08-21
updated: 2026-08-21
---

## Items

### 1. An explicit stakes floor is never resolved below
expected: With `stakes` set explicitly to `critical`, `route.mjs resolve` returns level `critical` for a phase whose declared files touch no surface, and a test pins it.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: stakes=critical + surfaceless phase -> ok:true stakes=critical, reason states nothing raised it; pinned by route.test.mjs:1543 (AC1), passing.

### 2. An unset stakes lets a surfaceless phase resolve solo
expected: With `stakes` unset, a resolve for a real phase whose declared `files:` touch no answered surface returns `solo` where today's resolver returns `shipped` - both outputs shown side by side.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: stakes unset + surfaceless phase -> solo/sonnet with 'floors at "solo" rather than the "shipped" default'; route.test.mjs:1556 asserts solo/sonnet beside shipped/opus in one test. Demonstrated on fixtures only - see the gap on the real-phase economics.

### 3. Replaying shipped phases raises nothing below today
expected: This project's shipped phases replayed through both resolvers: no phase whose declared files touch an answered surface resolves lower than it does today, and the level diff is printed per phase.
criterion: AC3
status: fail
first_pass: fail
source: verifier
evidence: .planning/phases/3/ contains PLAN-1.md only; CONTEXT.md:24 puts the replay in the second plan. No script, tool, measurement file or SUMMARY row prints a per-phase level diff. SUMMARY.md marks the phase complete without mentioning AC3.
reported: missing - no replay was ever run or shipped; the work was assigned to a PLAN-2 that does not exist
severity: major
cause: The replay was PLAN-2 scope (CONTEXT plan shape), and PLAN-2 was never written; the phase was summarized complete after PLAN-1 alone.
fix: routed to /cad-plan

### 4. Lowering below the computed floor needs the new override key
expected: Lowering below the computed floor requires a new `review.triggers.risk_surface` override key naming the surface; a lowering without it is refused, and a test pins `lib/retired-keys.mjs` byte-identical.
criterion: AC4
status: fail
first_pass: fail
source: verifier
evidence: config.schema.json declares no review.triggers.risk_surface override (only .surfaces at line 86). route.mjs riskFloor (lines 412-563) has no arm that lowers below the computed level, so 'a lowering without it is refused' is vacuous - no lowering exists at all. retired-keys.test.mjs has no byte-identical or hash pin on lib/retired-keys.mjs. This was PLAN-2 scope (CONTEXT.md D-03, :24).
reported: missing - no override key, no lowering path, no byte-identical pin
severity: major
cause: Override key, lowering path and the byte-identical pin were PLAN-2 scope (D-03); PLAN-2 was never written.
fix: routed to /cad-plan

### 5. An unreadable plan fails closed at the configured stakes
expected: A resolve whose PLAN is absent or unreadable returns `ok:true` at the configured stakes (default `shipped` when unset) - never below it, never `ok:false` - and the unset->`solo` discount is reachable only when every plan in scope was read clean.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Absent dir, no-PLAN dir, out-of-grammar frontmatter, mode-000 plan, mixed clean+unreadable pair and an unresolvable --plan key all return ok:true at shipped with the reason naming why the discount was withheld; six 'fail-closed:' tests in route.test.mjs pass.

### 6. A milestone at the computed level is measurably cheaper
expected: The same milestone replayed at the fixed level and the computed one, per-phase `tokens` compared from `trace.jsonl`, with the no-surface phases demonstrably cheaper. (human-verify: needs a live milestone run)
criterion: AC6
status: skipped
reported: skip
reason: needs a live milestone run; verifier replay shows 29/30 phases still resolve shipped, so the measurement is moot until the mention-level scan is fixed

### 7. The decision-review ruling and a clean self-verify
expected: A `/cad-decision-review` ruling on "the resolve reads planning state" exists dated before PLAN.md was written, and `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with `problems: []`.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: trace.jsonl decision-review bracket on .planning/phases/3/CONTEXT.md D-06 at 2026-08-20 20:23 local, before the planner dispatch (20:45) and PLAN-1.md (21:04); amendments landed as 23fb76d. self-verify --root . returns ok:true with problems: [].

### 8. An executor resolve floors on the plan it was handed
expected: `route.mjs resolve --role cad-executor --phase <N> --plan <k>` floors on THAT plan's declared files, so a clean plan in a mixed phase routes below its risky sibling, while a phase-scoped role floors on the union.
status: pass
first_pass: pass
source: verifier
evidence: Two-plan fixture: --plan 1 -> solo, --plan 2 -> shipped naming docs/danger.js, no flag -> shipped off the union; bare --plan refused with a usage line; execute.md:220 passes --plan <k> at the executor's own resolve; five --plan tests pass.

### 9. A malformed --phase is refused, not answered about another phase
expected: `route.mjs resolve --role cad-executor --phase 1.10.3` returns `ok:false` naming the flag, rather than warning and answering about the STATE cursor's phase.
status: pass
first_pass: pass
source: verifier
evidence: --phase 1.10.3 and a bare --phase both return {"ok":false,"reason":"usage","detail":"resolve --phase must be a phase number: --phase <N|N.M>"}; an absent flag still resolves off the cursor.

### 10. Every level move states its evidence
expected: A resolved bundle whose level moved names the phase (and plan), the surface, the file that evidenced it and the level it moved from, in `reason`; every unreadable input rides `warnings[]`.
status: pass
first_pass: pass
source: verifier
evidence: Live reason on this repo names phase, plan, file, surface, signal and 'level solo -> shipped'; unreadable plans and unreadable declared bodies each ride a distinct 'risk floor: ' warning.

### 11. A plan that declares no files takes the discount it did not earn
expected: behavior wrong - a scope with zero declared paths is scored as 'read clean, declaring nothing that touches [...]', which is absence of evidence reported as absence of surface
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: Probe with the shipped template's own frontmatter (cadence-core/templates/PLAN.md:5 ships `files:` with no items) plus a `- **Files:** cadence-core/bin/lib/auth-secrets.mjs` task line: resolve returns stakes=solo, model=sonnet, no warning, reason 'phase 11: 1 plan read clean, declaring nothing that touches [secrets, destructive, untrusted_input]'. lib/planning-files.mjs returns {items:[],issues:[]} for a missing frontmatter block, a missing files key and an empty files list alike; lib/phase-plans.mjs:87-93 therefore counts the plan clean, and route.mjs:493 sets read=true with zero paths scanned. At solo, verify is off and the plan gate drops to advisory (route-table.json).
reported: behavior wrong - a scope with zero declared paths is scored as 'read clean, declaring nothing that touches [...]', which is absence of evidence reported as absence of surface
severity: major
cause: declaredPlanFiles treats an empty files: list identically to a read-clean declaration; route.mjs sets read=true with zero paths scanned, so absence of evidence earns the solo discount.
fix: routed to /cad-plan

### 12. Shipped prose still says detection sets no floor
expected: missing - the prose and claims-ledger half of the phase (PLAN-3) was never written, so two user-facing documents now state the opposite of what the code does
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: METHOD.md:423 'Detection sets no floor. What a plan declares raises no level: the `stakes` you set is the whole of it.' INTERNALS.md:13 'Your answer is the last word, and no detection moves it ... both were cut in v2.7.0'. .planning/DOCS-CLAIMS.md:629 still carries METHOD-59 corrected in the no-floor direction. cadence-core/references/config-reach.md:113-118 claims model.effort.<role> is 'floored by any detected risk surface', a clamp route.mjs does not implement (D-08 was PLAN-2 scope). seams.md/execute.md/plan.md were corrected; these four were not. self-verify returns problems: [] and does not catch it.
reported: missing - the prose and claims-ledger half of the phase (PLAN-3) was never written, so two user-facing documents now state the opposite of what the code does
severity: major
cause: Prose and claims-ledger updates were PLAN-3 scope (D-11); PLAN-3 was never written, so METHOD.md, INTERNALS.md, config-reach.md and DOCS-CLAIMS.md still state the pre-floor world.
fix: routed to /cad-plan

### 13. The content pass raises on mentions, so 29 of 30 real phases still floor at shipped
expected: behavior wrong - the plan-time scan reuses the diff-time mention-level tables over whole file bodies, so documentation that MENTIONS a construct raises the phase, and the promised per-change discount almost never fires
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: scanDeclared over METHOD.md's real bytes returns [{category:'destructive',signal:'changed line: an `rm -rf`'}]. Live: `resolve --role cad-executor --phase 2 --plan 3` answers 'risk floor: phase 2 plan 3: METHOD.md touches destructive (changed line: an `rm -rf`); level solo -> shipped'. Replaying all 30 real phase directories (.planning/phases plus every _archive-*) through the shipped matcher with the answered set: 29 shipped, 1 solo. CER-01 (.planning/REQUIREMENTS.md:20) is 'a README phase and an auth phase stop buying the same model'; a docs plan and an auth plan still resolve identically. SUMMARY.md's own open item already records that PLAN-1's 39/48 body-pass figure did not reproduce (9/49 measured), so the phase shipped without a live measurement of what the raise costs.
reported: behavior wrong - the plan-time scan reuses the diff-time mention-level tables over whole file bodies, so documentation that MENTIONS a construct raises the phase, and the promised per-change discount almost never fires
severity: major
cause: scanDeclared reuses scanDiff's mention-level signal tables over whole file bodies, so prose that MENTIONS a construct raises the floor; 29/30 real phases floor at shipped and the discount almost never fires.
fix: routed to /cad-plan

### 14. Plan-time reasons say 'changed line' when nothing changed
expected: behavior wrong (cosmetic) - the signal strings are the diff-time vocabulary, reused verbatim by a whole-body plan-time scan
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: Every raise on this repo reads 'risk floor: phase 3: cadence-core/bin/config-seams.test.mjs touches secrets (changed line: a credential-named assignment)'. At resolve time no diff exists and no line changed - the whole current body was scanned. lib/risk-diff.mjs's signal strings are shared by scanDiff and scanDeclared.
reported: behavior wrong (cosmetic) - the signal strings are the diff-time vocabulary, reused verbatim by a whole-body plan-time scan
severity: cosmetic
cause: scanDiff and scanDeclared share the diff-time signal strings ('changed line: ...'), reused verbatim by the whole-body plan-time scan.
fix: routed to /cad-plan

### 15. Run the same milestone at today's fixed level and at the computed one, then compare per-phase `tokens` in .planning/trace.jsonl
expected: The phases whose declared files touch no answered surface cost measurably fewer tokens at the computed level; no surface-touching phase costs more than it did
origin: verifier
why_human: Out of reach for this pass: it needs a live milestone run - real dispatches against a provider, mutating .planning state - which this verification is forbidden to start. CONTEXT.md:163 and .planning/phases/3/CONTEXT.md's flagged assumptions already class AC6 as human-verify. Note before running: the verifier-side replay found 29 of 30 real phases still resolve shipped, so a milestone of this repo is unlikely to show a difference at all.
status: skipped
reported: skip
reason: needs a live milestone run; verifier replay shows 29/30 phases still resolve shipped, so the measurement is moot until the mention-level scan is fixed

## Summary

total: 15
passed: 7
failed: 6
pending: 0
skipped: 2
blocked: 0
reworked: 6
