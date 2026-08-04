---
status: testing
phase: 4
fields_version: 1
started: 2026-08-04
updated: 2026-08-04
---

## Items

### 1. Configured effort rung reaches dispatch
expected: 1) cd /data/code/cadence 2) node cadence-core/bin/config.mjs set model.effort.cad-verifier=medium 3) node cadence-core/bin/route.mjs resolve --role cad-verifier - JSON reports effort "medium" and agent "cad-verifier-medium" at stakes shipped 4) nothing under /home/john/.claude/plugins/cache/cadence is modified (the value lands in .planning/config.json) 5) restore: node cadence-core/bin/config.mjs set model.effort.cad-verifier=null
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live temp-layer walk: set model.effort.cad-verifier=medium -> resolve reports effort:"medium", agent:"cad-verifier-medium"; discriminating xhigh value confirms config wins over the shipped cell; repo tracked tree clean after the run; layer-read pinned by route.test.mjs:1067

### 2. A rung the role lacks is refused by key
expected: 1) cd /data/code/cadence 2) node cadence-core/bin/config.mjs set model.effort.cad-executor=max - refused, output names key model.effort.cad-executor and the role's allowed rung set, nothing written 3) node cadence-core/bin/self-verify.mjs - ok:true on the shipped tree with effort-enums in checked (the drift case is test-proven by self-verify.test.mjs)
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Live: config.mjs check/set model.effort.cad-executor=max -> ok:false naming key with 'must be one of: high, xhigh, null', file byte-identical; config.test.mjs:882,906,944 pass; self-verify.test.mjs:1218 proves effort-enum-drift fires by key; shipped tree self-verify ok:true with effort-enums checked

### 3. Floor holds a low start; only risk.override goes under
expected: 1) cd /data/code/cadence 2) node --test cadence-core/bin/route.test.mjs - passes, including the floor rows: a model.effort.<role> below a computed risk floor resolves AT the floor with the surface named in reason and warnings, and adding risk.override.<surface> (and only that) lowers it - one test per side
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: route.test.mjs:1097 (held AT floor, surface auth named), :1112 (override alone lowers), :1127 (critical-baseline discriminator), :1208 (hold in warnings[]) all pass; arms at route.mjs:404-441

### 4. A retry never resolves below the configured start
expected: 1) cd /data/code/cadence 2) node --test cadence-core/bin/route.test.mjs - passes, including the retry rows: with a configured start at or above the cell's retry, --attempt 2 resolves at max(cell.retry, start) in rung_order
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: route.test.mjs:1173 (xhigh start holds over high retry), :1187 (start below retry climbs medium->high), :1223 (torn rung_order holds start), :1245 (hold attributed to config) all pass; logic at route.mjs:451-514

### 5. ok:false envelopes carry warnings[]; relay rule checked at every issuing site
expected: 1) cd /data/code/cadence 2) node --test cadence-core/bin/route.test.mjs - the retired-key and unresolvable-stakes ok:false fixtures assert warnings[] is present 3) node cadence-core/bin/self-verify.mjs - checked names route-relay; self-verify.test.mjs proves the check fails when an issuing prose block drops the relay rule
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: route.test.mjs:1270,1282,1293 pass (unknown-role and unresolved carry warnings[], no empty-array fabrication); route-relay.test.mjs 14/14 incl. brace-less spelling; self-verify.test.mjs:1260 proves check 11 fails when the rule is dropped; checked: includes route-relay

### 6. Ladder-claims audit closed: every claim true or corrected
expected: 1) open .planning/phases/4/ladder-claims.md - 50 rows, each with file:line and a verdict (41 true / 9 corrected / 0 contradicting), listed from SUMMARY.md 2) CHANGELOG.md ## [Unreleased] carries the retune's forward correction 3) a path-scoped grep over live prose (excluding DESIGN.md and dated CHANGELOG sections) finds no claim contradicting route-table.json
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: ladder-claims.md parses to exactly 41 true / 9 corrected / 0 contradicting over 50 rows; CHANGELOG ## [Unreleased] carries the retune forward correction; grep 'auto mode' over live surfaces -> 0; review-triggers.md exactly one 'pinned at' line naming cad-reviewer-xhigh; spot-checked claims agree with route-table.json

### 7. Gates green: tests, tsc, self-verify
expected: 1) cd /data/code/cadence 2) node --test cadence-core/bin/*.test.mjs - all pass, 0 fail 3) npx tsc -p tsconfig.ci.json - exit 0 4) node cadence-core/bin/self-verify.mjs - ok:true, no budget overrun on any surface this phase edits
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> 1125 pass / 0 fail; npx tsc -p tsconfig.ci.json exit 0; self-verify ok:true, problems:[], checked includes budgets, effort-enums, route-relay

### 8. Retuned cells start where they used to climb
expected: 1) cd /data/code/cadence 2) grep -A3 'cad-plan-checker' cadence-core/route-table.json (critical row) and grep -A3 'cad-reviewer' (shipped row) - both cells show effort xhigh as the starting rung, equal to their retry
status: pass
first_pass: pass
source: verifier
evidence: route-table.json critical/cad-plan-checker and shipped/cad-reviewer both {effort:"xhigh", retry:"xhigh"}; live shipped resolve -> cad-reviewer-xhigh; critical --attempt 2 -> xhigh, escalated:false, 'retry rung is the same rung'

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
