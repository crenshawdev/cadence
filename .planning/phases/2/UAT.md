---
status: testing
phase: 2
started: 2026-07-29
updated: 2026-07-29
---

## Items

### 1. The write face refuses a retired key by name
expected: `node cadence-core/bin/config.mjs check model.profile=balanced` returns `{ok:false,"reason":"invalid"}` whose `detail[].error` names `stakes` as the replacement (not a generic `unknown key`), and `check stakes=quality` is refused with a message naming solo, shipped, critical.
status: pass
first_pass: pass

### 2. Both live read faces warn on a stale config
expected: With a repo config still holding `model.profile: "balanced"`, `config.mjs get stakes` and `route.mjs resolve --role cad-planner` each emit a warning naming `model.profile` and pointing at `stakes`; neither resolves silently at the default, and route's reason does not report `config:repo` for a value it never read.
status: pass
first_pass: pass

### 3. The retired vocabulary is gone from the live tree
expected: `grep -rn "model\.profile\|profile_order\|model\.auto\." --include="*.md" --include="*.json" --include="*.mjs" .` matches only under `.planning/`, in CHANGELOG.md, in DESIGN.md's dated marker, and in the retired-keys lib/tests whose job is to name it; and the phase diff touches no `review.providers.*.tiers.*`, `tier_order` or `rung_order` line.
status: pass
first_pass: pass

### 4. The rung ladder is reachable at the shipped default
expected: With NO `stakes` key set anywhere, resolving `cad-plan-checker` with `--attempt 2` returns `agent: "cad-plan-checker-high"` and `escalated: true` - phase 1's ladder fires out of the box, which it did not before.
status: pass
first_pass: pass

### 5. The schema carries stakes and none of the retired keys
expected: `config.schema.json` holds `stakes` (`["solo","shipped","critical"]`, default `"shipped"`) and `model.escalate_on_failure`, and holds no `model.profile`, no `model.auto.ceiling` and no `model.auto.max_escalations`.
status: pass
first_pass: pass

### 6. CI arms are green
expected: `node --test cadence-core/bin/*.test.mjs` exits 0 and `npx tsc -p tsconfig.ci.json` exits 0.
status: pass
first_pass: pass

### 7. self-verify is clean and the CHANGELOG states the break
expected: `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no `unknown-config-key`, no `inert-config-key` and no budget overage; and CHANGELOG.md's `## [Unreleased]` names the break plus the exact command a user runs on upgrade.
status: pass
first_pass: fail
reported: fail it on item 1, the ladder claim is misleading
severity: major
cause: CHANGELOG.md:51-57 and DESIGN.md:391 claim the per-role rung ladder is reachable on a default install and that a retry swaps to the role's escalate_to rung at every stakes level. The escalation plumbing is correct and unconditional, but route-table.json sets escalate_to === base_effort for cad-planner, cad-assumptions-analyzer, cad-verifier, cad-reviewer and cad-executor, so resolve --attempt 2 takes the no-op arm and reports escalated:false for 5 of 6 roles. Only cad-plan-checker swaps (low->high). The xhigh rung files for planner/verifier/reviewer/executor are reachable by no config and no attempt count. Literally defensible, practically misleading.
fix: 5b8728d, retest

### 8. The documented upgrade path actually migrates a stale config
expected: Following the CHANGELOG's Upgrading steps verbatim against a config holding the old `model.profile` / `model.auto.*` block leaves a config that `config.mjs validate` accepts, with the user's escalate-on-failure choice carried across rather than inverted.
status: pass
first_pass: pass

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
