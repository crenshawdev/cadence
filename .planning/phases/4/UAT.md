---
status: testing
phase: 4
started: 2026-07-29
updated: 2026-07-29
---

## Items

### 1. Floor raises a solo baseline; --phase and cursor agree
expected: With stakes "solo" in every config layer, `node cadence-core/bin/route.mjs resolve --role <r> --phase <N>` against a phase whose PLAN files: matches a surfaces row returns stakes:"critical" plus that row's model, effort, review and verify, and reason names the matched surface and the path that matched it. The same resolve with no --phase, against a STATE cursor pointing at that phase, returns the identical bundle.
status: pass
first_pass: pass
source: verifier
evidence: resolve --role cad-executor --phase 7 --file <fixture> -> stakes:critical, agent:cad-executor-xhigh, model:opus, effort:xhigh, verify:on, review map = review.critical verbatim; reason 'risk floor: phase 7 surface "auth" matched src/auth/session.rs (pattern "auth"); stakes solo -> critical'. Same resolve without --phase against STATE.md 'Phase: 7 of 9': diff of the two outputs is empty.

### 2. No detection means no floor, and it never blocks
expected: A phase whose PLAN files: match no surface row, a phase with no PLAN file, and a resolve with neither --phase nor a cursor all return the baseline level's bundle with ok:true and no floor entry in reason. A PLAN present but unreadable returns the same baseline bundle plus one warning naming the file.
status: pass
first_pass: pass
source: verifier
evidence: 4 hermetic runs all stakes:solo, reason [config:global+repo], no warnings key: non-matching files (README.md/docs/intro.txt), absent phase dir, phase dir with no PLAN, no --phase and no STATE.md. chmod 000 PLAN -> exactly one warning 'risk floor: cannot read .../phases/10/PLAN.md (EACCES); no risk surface was computed from it', stakes still solo.

### 3. The floor raises and never caps
expected: With stakes "critical" configured and a detected surface whose row floors below critical, resolve returns critical with no override set and no refusal.
status: pass
first_pass: pass
source: verifier
evidence: Injected table with surfaces.auth.floor=shipped: baseline critical -> stakes:critical, pinned:false, ok:true, reason '... (floor shipped); baseline critical already at or above it'. Same table at baseline solo -> stakes:shipped, proving raiseTo is order-based rather than hardcoded to the top rung.

### 4. Per-surface waiver, and a misspelled surface refused at the write face
expected: With stakes "solo" and a phase detecting two surfaces: setting risk.override.<first> alone still resolves critical; setting both resolves solo with reason naming each waived surface; and `node cadence-core/bin/config.mjs set risk.override.<not-a-surface> true` is refused with a message listing the accepted surface names.
status: pass
first_pass: pass
source: verifier
evidence: Phase declaring src/auth/session.rs + db/migrations/001.sql: risk.override.auth alone -> stakes:critical with the waiver line plus the surviving migrations match; both set -> stakes:solo, reason 'waived by risk.override.auth, risk.override.migrations - every detected surface is named'. config.mjs set risk.override.athu=true -> ok:false, detail lists the eight accepted surface names.

### 5. Self-verify catches four classes of surface-table drift
expected: `node cadence-core/bin/self-verify.mjs` reports ok:false naming the offending row for each of: a surface whose floor is not a stakes level, a surface row with an empty pattern list, a surface in route-table.json with no risk.override.<surface> schema key, and a risk.override.<surface> schema key naming no surface row.
status: pass
first_pass: pass
source: verifier
evidence: rsync tree copy (baseline ok:true, 0 problems), one mutation each -> ok:false: unknown-floor | auth: floor "ludicrous" is not one of [solo, shipped, critical]; bad-pattern | auth: patterns []; missing-override-key | frobnicate: no risk.override.frobnicate key in config.schema.json; undeclared-risk-surface | auth: config.schema.json declares risk.override.auth, but the surfaces block has no such row.

### 6. A bad review gate no longer reaches the bundle
expected: A config review.triggers.<t>.gate outside off|advisory|blocking|adjudicated, or not a string, no longer reaches the bundle: resolve returns the LEVEL's gate for that trigger plus one warning naming the rejected value. Verified with {"gate":"blockign"} on risk_surface at critical, which previously resolved ok:true carrying "blockign".
status: pass
first_pass: pass
source: verifier
evidence: Hermetic {"stakes":"critical","review":{"triggers":{"risk_surface":{"gate":"blockign"}}}} -> risk_surface:blocking plus one warning 'gate="blockign" is not one of [off, advisory, blocking, adjudicated]; the critical level gate "blocking" stands'. Non-string 7 behaves identically; control 'advisory' still wins.

### 7. Suite, types and self-verify are green
expected: `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports ok:true with --phase accepted in the route.mjs CONTRACTS entry, no budget overage and no unknown-config-key.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> pass 950 / fail 0, exit 0; npx tsc -p tsconfig.ci.json exit 0; self-verify.mjs -> ok:true, problems [], checked includes routing-cells and risk-surfaces; self-verify.mjs:104 resolve flag whitelist carries --phase.

### 8. CHANGELOG claims a global-layer waiver refusal the resolver does not implement
expected: CHANGELOG.md:112-117 (shipped by this phase's own docs commit 5a4c3e3) states the waiver is repo-scoped and 'the user-global layer is refused outright', and config.schema.json marks all eight keys src:repo - but route.mjs:107 reads riskOverrides from the MERGED config and config.mjs's repoScopedErrors compares paths by string equality, so a global waiver passes both faces. The behaviors are SUMMARY open items 1-2; what is new is that the docs ship the fix as a delivered claim.
status: pass
first_pass: fail
source: verifier
evidence: CHANGELOG.md:112-117; route.mjs:107; config.schema.json risk.override.auth src:repo. Reproduced with CADENCE_GLOBAL_CONFIG at a temp file: global risk.override.auth:true + repo stakes:solo + PLAN declaring src/auth/session.rs -> stakes:solo, reason 'waived by risk.override.auth'; and config.mjs set risk.override.billing=true --file <gdir>/./config.json -> ok:true, waiver lands in the global file.
reported: yes, that reads honest
severity: minor
cause: The docs commit (5a4c3e3) shipped the waiver's repo-scoping as delivered while both faces still leak: route.mjs:107 reads riskOverrides off mergeLayers' MERGED config (config-merge.mjs:110-111 returns only the merged object, never the repo layer alone), and config.mjs:204 repoScopedErrors tests file === GLOBAL_CONFIG by string equality, which any path alias defeats. CHANGELOG.md:117 claims 'the user-global layer is refused outright'; config.schema.json marks all eight keys src:repo, and INTERNALS/seams prose follows the same claim.
fix: 183c170, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
