---
status: testing
phase: 3
started: 2026-07-17
updated: 2026-07-17
---

## Items

### 1. Version decision derives bare semver and no-ops at target
expected: Given milestone version v1.1.0-rc.2, the decision function returns target 1.1.0-rc.2 (v stripped); given a manifest already at the target, it returns a no-op (bumped:false / action:noop).
status: pass
first_pass: pass
source: verifier
evidence: release-decision.mjs:26-32 strips one leading v; :62-64 returns action:noop,bumped:false when from===to. Live run emitted noop. Named tests pass.

### 2. Bump seam rewrites only version and is idempotent
expected: Run against a fixture plugin.json at 1.0.0, the seam rewrites only the version field to the target and preserves every other field; a second run changes nothing (no double-bump).
status: pass
first_pass: pass
source: verifier
evidence: Live fixture 1.0.0->1.1.0-rc.2, other fields preserved (release-bump.mjs:101); second run byte-identical (sha match). Test 'a second run is a noop' passes.

### 3. Version-less sibling manifest left unchanged
expected: Given a sibling manifest with no version field (marketplace.json shape), the seam leaves it byte-unchanged and injects no version field.
status: pass
first_pass: pass
source: verifier
evidence: release-bump.mjs:106-116 + release-decision.mjs:57-59 (absent version -> skip). Live: marketplace.json sha256 identical before/after; emit siblings action:skip.

### 4. Changelog entry prepended above prior version, history untouched
expected: The changelog step prepends a dated ## [1.1.0-rc.2] - <date> heading plus its [1.1.0-rc.2]: link reference above the [1.0.0] entry, leaving [1.0.0] unaltered.
status: pass
first_pass: pass
source: verifier
evidence: Live: ## [1.1.0-rc.2] - 2026-07-17 inserted above ## [1.0.0]; [1.1.0-rc.2]: link above unaltered [1.0.0]:. release-decision.mjs:92-95 idempotency guard; test passes.

### 5. self-verify, node --test, and tsc all green with new subcommand
expected: node cadence-core/bin/self-verify.mjs exits 0 with the new subcommand registered in CONTRACTS; node --test and tsc --checkJs pass across cadence-core/bin.
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs:75-78 registers release-bump.mjs CONTRACTS row; self-verify ok:true exit 0; node --test 233/233 pass; npx tsc -p tsconfig.ci.json exit 0.

### 6. milestone.md orders bump+changelog before tag and before Active evolve
expected: cadence-core/workflows/milestone.md runs the bump + changelog step before both the tag cut and the ### Active evolve (verifiable by reading the step sequence).
status: pass
first_pass: pass
source: verifier
evidence: milestone.md:30 release-bump in step 2; :45 git tag -a later; :61 step 4 ### Active evolve. Flags match CONTRACTS; self-verify validates invocation.

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
