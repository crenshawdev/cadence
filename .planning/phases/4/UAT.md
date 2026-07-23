---
status: testing
phase: 4
started: 2026-07-23
updated: 2026-07-23
---

## Items

### 1. live DeepSeek review returns schema-valid findings
expected: `review-provider.mjs review --provider deepseek --model deepseek-v4-pro --effort high` returns {ok:true, findings:[...]} from a live call, each finding passing validateFindings().
status: pass
first_pass: pass
reported: live run returned {ok:true,provider:deepseek,model:deepseek-v4-pro,findings:[3]}, all validateFindings-passing

### 2. detect-models lists tiered DeepSeek model ids
expected: `review-provider.mjs detect-models --provider deepseek` returns the account's model ids, soft-tiered by model-hints, key never printed.
status: pass
first_pass: pass
reported: detect-models returned deepseek-v4-pro(flagship)+deepseek-v4-flash(balanced), key from env, not printed

### 3. deepseek is a valid reviewer/provider in config
expected: `deepseek` is accepted in review.reviewers and review.providers.deepseek.tiers.* is settable; config.mjs validate passes.
status: pass
first_pass: pass
reported: config set reviewers+flagship accepted; config validate ok (51 checked)

### 4. green bar holds (tests + tsc + self-verify), no CONTRACTS change
expected: node --test cadence-core/bin/*.test.mjs passes, tsc -p tsconfig.ci.json clean, self-verify.mjs ok:true; review-provider.mjs CLI subcommands/flags unchanged.
status: pass
first_pass: pass
reported: 253/253 tests, tsc clean, self-verify ok:true; CONTRACTS unchanged

## Summary

total: 4
passed: 4
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
