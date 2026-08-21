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
status: pass
first_pass: fail
source: model
evidence: `node cadence-core/bin/route.mjs replay` -> ok:true, 30 rows over live + archived phases, each row printing today/computed/raised plus the surface, signal and evidencing file; `regressions: []`. Distribution: 27 raised, 2 solo (_archive-v2.2.0/5, _archive-v2.6.0/1), 1 held at the configured level (_archive-v2.6.0/5, an unreadable declared path). No phase touching an answered surface resolves lower than today. Shipped in c5d38c3.
reported: missing - no replay was ever run or shipped; the work was assigned to a PLAN-2 that does not exist
severity: major
cause: CLOSED by PLAN-3 task 2 (c5d38c3): `route.mjs replay` off `levelFor`, the single scope-to-level implementation resolve shares.
fix: c5d38c3, retested pass

### 4. Lowering below the computed floor needs the new override key
expected: Lowering below the computed floor requires a new `review.triggers.risk_surface` override key naming the surface; a lowering without it is refused, and a test pins `lib/retired-keys.mjs` byte-identical.
criterion: AC4
status: pass
first_pass: fail
source: model
evidence: `review.triggers.risk_surface.waive_routing_floor` declared at config.schema.json:87 (array_enum over the eight surfaces, default null) and read at route.mjs:207,279. `node --test cadence-core/bin/route.test.mjs cadence-core/bin/retired-keys.test.mjs` -> 176 pass 0 fail, including 'waiver: without the key the lowering is REFUSED, and the reason says which key', 'waiver: naming a DIFFERENT surface than the one matched waives nothing', and 'lib/retired-keys.mjs is byte-identical - the eight risk.override.* keys stay retired' (sha256 pin, retired-keys.test.mjs:24-43).
reported: missing - no override key, no lowering path, no byte-identical pin
severity: major
cause: CLOSED by PLAN-3 tasks 3 and 4 (97807b4, 11030c1): the waiver key ships and the retired rail is pinned by sha256.
fix: 97807b4 + 11030c1, retested pass

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
reason: Needs a live milestone run - real dispatches against a provider, which this verification is forbidden to start. The round-1 rationale ('moot until the mention-level scan is fixed') no longer applies: the scan was fixed in b3dbbac and `route.mjs replay` now shows 2 of 30 phases resolving below the default with regressions empty. The measurement is still out of reach here, and .planning/phases/3/MEASUREMENT.md carries the level diff, the token baseline and a falsifiable prediction in its place - including that this repository is a weak test of the economics because its own source genuinely parses JSON and deletes paths.

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
status: pass
first_pass: fail
source: model
evidence: Three route.test.mjs tests pin the arm, all passing: 'declared-nothing: a plan with an EMPTY files: list is not discounted' (route.test.mjs:1844 - asserts stakes shipped/opus, a warning naming the plan file 'declares no files at all', a reason reading '1 of 1 plan in phase 3 declared no files at all', and that the discount sentence 'declaring nothing that touches' is ABSENT), 'a plan with NO files: key at all takes the same arm', and 'the UAT probe verbatim - the SHIPPED template plus a task Files: line' - this item's original probe, reproduced against the shipped template rather than retyped.
reported: behavior wrong - a scope with zero declared paths is scored as 'read clean, declaring nothing that touches [...]', which is absence of evidence reported as absence of surface
severity: major
cause: CLOSED by PLAN-2 task 3 (9129f8c): 'nothing was declared' and 'nothing touches a surface' are now different sentences; a scope that declared no files is never discounted.
fix: 9129f8c, retested pass

### 12. Shipped prose still says detection sets no floor
expected: missing - the prose and claims-ledger half of the phase (PLAN-3) was never written, so two user-facing documents now state the opposite of what the code does
origin: verifier
status: pass
first_pass: fail
source: model
evidence: All four surfaces named in the original evidence now state the shipped floor. METHOD.md:423 reads 'The `stakes` you set is a MINIMUM, not a fixed price. A plan-time floor reads...' (was 'Detection sets no floor'). INTERNALS.md:13 reads 'Your answer is a FLOOR, not the last word: the phase's own declared files, read at plan time, can raise the level above what you set' (was 'Your answer is the last word'). cadence-core/references/config-reach.md:113-118 keeps 'floored by any detected risk surface' on the four post-plan roles and now names the two pre-plan roles exempt - and the clamp it claims IS implemented, pinned by five passing 'clamp:' tests in route.test.mjs. .planning/DOCS-CLAIMS.md:629 (METHOD-59) and :665 (INTERNALS-13) both carry the 're-corrected - CER-01, v3.5.7' entry.
reported: missing - the prose and claims-ledger half of the phase (PLAN-3) was never written, so two user-facing documents now state the opposite of what the code does
severity: major
cause: CLOSED by PLAN-4 tasks 1-4 (d6831b9, 00d8c09, c4b45ff, 72b2339) and PLAN-3 task 5 (12aa4ab, the effort clamp config-reach.md claimed).
fix: d6831b9 + 00d8c09 + c4b45ff + 72b2339 + 12aa4ab, retested pass

### 13. The content pass raises on mentions, so 29 of 30 real phases still floor at shipped
expected: behavior wrong - the plan-time scan reuses the diff-time mention-level tables over whole file bodies, so documentation that MENTIONS a construct raises the phase, and the promised per-change discount almost never fires
origin: verifier
status: pass
first_pass: fail
source: model
evidence: The mention-level defect is closed. This item's own live example inverted: `resolve --role cad-executor --phase 2 --plan 3` now answers 'risk floor: phase 2 plan 3: cadence-core/bin/git-guard.test.mjs touches destructive (body line: a destructive git command)' - a real code file, where before it raised on METHOD.md's prose. Every evidencing file across all 30 replay rows is a .mjs source file; no .md raises anything. CER-01 measured on this phase's own plans: PLAN-4 (documents only) resolves stakes solo / model sonnet, while PLAN-2 and PLAN-3 both resolve shipped / opus - 'a README phase and an auth phase stop buying the same model', demonstrated rather than asserted. HONEST LIMIT on the second clause: the discount still reaches only 2 of 30 phases here, because this repository's own declared files genuinely parse JSON, delete paths and assign credential-named variables. That is a property of this corpus, not the mention bug - .planning/phases/3/MEASUREMENT.md carries the distribution and a falsifiable prediction, and SUMMARY.md's goal check states the same caveat.
reported: behavior wrong - the plan-time scan reuses the diff-time mention-level tables over whole file bodies, so documentation that MENTIONS a construct raises the phase, and the promised per-change discount almost never fires
severity: major
cause: CLOSED by PLAN-2 task 1 (b3dbbac): a declared DOCUMENT contributes its path and not its prose, so documentation that MENTIONS a construct no longer raises the phase.
fix: b3dbbac, retested pass

### 14. Plan-time reasons say 'changed line' when nothing changed
expected: behavior wrong (cosmetic) - the signal strings are the diff-time vocabulary, reused verbatim by a whole-body plan-time scan
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Every plan-time reason on this repo now reads `body line:`. All 30 `route.mjs replay` rows carry it ('body line: a credential-named assignment', 'body line: a JSON.parse call', 'body line: a recursive delete call', 'body line: a destructive git command'), and the live resolves for phase 3 plans 1-3 do too. scanDiff keeps `changed line:` for the diff-time path where a line actually changed.
reported: behavior wrong (cosmetic) - the signal strings are the diff-time vocabulary, reused verbatim by a whole-body plan-time scan
severity: cosmetic
cause: CLOSED by PLAN-2 task 2 (c199846): a plan-time reason says what it actually read; the two scanners no longer share one signal vocabulary.
fix: c199846, retested pass

### 15. Run the same milestone at today's fixed level and at the computed one, then compare per-phase `tokens` in .planning/trace.jsonl
expected: The phases whose declared files touch no answered surface cost measurably fewer tokens at the computed level; no surface-touching phase costs more than it did
origin: verifier
why_human: Out of reach for this pass: it needs a live milestone run - real dispatches against a provider, mutating .planning state - which this verification is forbidden to start. CONTEXT.md:163 and .planning/phases/3/CONTEXT.md's flagged assumptions already class AC6 as human-verify. Note before running: the verifier-side replay found 29 of 30 real phases still resolve shipped, so a milestone of this repo is unlikely to show a difference at all.
status: skipped
reported: skip
reason: Needs a live milestone run - real dispatches against a provider, which this verification is forbidden to start. The round-1 rationale ('moot until the mention-level scan is fixed') no longer applies: the scan was fixed in b3dbbac and `route.mjs replay` now shows 2 of 30 phases resolving below the default with regressions empty. The measurement is still out of reach here, and .planning/phases/3/MEASUREMENT.md carries the level diff, the token baseline and a falsifiable prediction in its place - including that this repository is a weak test of the economics because its own source genuinely parses JSON and deletes paths.

## Summary

total: 15
passed: 13
failed: 0
pending: 0
skipped: 2
blocked: 0
reworked: 6
