---
status: testing
phase: 1
started: 2026-07-22
updated: 2026-07-22
---

## Items

### 1. Symlink invocation parity
expected: Invoking review-provider.mjs through a symlink emits a non-empty JSON line identical to invoking it by its real path. Concretely, `node <symlink> detect-models --provider skynet` prints the same ok:false bad-provider line as `node review-provider.mjs detect-models --provider skynet`. Before the fix the symlinked invocation emitted nothing.
status: pass
first_pass: pass
source: verifier
evidence: Ran both: real review-provider.mjs and symlinked /tmp/rp-link-*.mjs both print {"ok":false,"reason":"bad-provider","detail":"unknown provider: skynet"} exit 1. Guard at review-provider.mjs:505-516: canonicalize() wraps fs.realpathSync in try/catch, falls back to path.resolve (D-02); isRunAsScript() false on absent argv[1]; file-local, no seam-io helper (D-03).

### 2. Symlink regression test + green bin suite
expected: review-provider.test.mjs contains a regression test that invokes the script through a symlink and asserts a single non-empty parseable JSON line, and the full `node --test cadence-core/bin/` suite is green.
status: pass
first_pass: pass
source: verifier
evidence: Test review-provider.test.mjs:187-206 symlinks SCRIPT into tmpdir, asserts lines.length===1, r truthy, r.ok===false, r.reason==='bad-provider'. Full suite `node --test 'cadence-core/bin/*.test.mjs'` = 245/245 pass. Env note: directory-form `node --test cadence-core/bin/` fails on this host Node v26.4.0 (generic Node CLI change, reproduces for any dir, not a phase defect); expected fine on CI Node 22/24; glob form green.

### 3. No schema/CONTRACTS drift
expected: `tsc --checkJs` and `node cadence-core/bin/self-verify.mjs` both pass with the change in place - no schema/CONTRACTS drift; review/consult/detect-models subcommands and flags unchanged.
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/self-verify.mjs -> {ok:true, problems:[]} exit 0. tsc -p tsconfig.ci.json exits 0 clean; --listFilesOnly confirms review-provider.mjs is checked. D-06 holds; subcommands/flags unchanged.

### 4. Empty-provider degradation line in fire() path (human-verify)
expected: In the review fire() path, an empty or unusable cross-model provider result produces one visible line naming the degradation before falling back to the claude-subagent reviewer, rather than degrading silently. human-verify: needs a live review run with an empty/failing provider result.
status: pass
first_pass: pass

### 5. Symlinked plugin returns real cross-model result (human-verify)
expected: On a symlinked plugin install with a cross-model provider configured, a review/consult/detect-models invocation returns a real cross-model result instead of no-opping to the subagent. human-verify: needs a configured provider API key.
status: pass
first_pass: pass

### 6. step-4 example line hardcodes 'falling back to claude-subagent'
expected: Example string at review-triggers.md:57 embeds '- falling back to claude-subagent'; in a multi-provider panel where dropping one ok:false reviewer leaves another, no fallback occurs, so the example overstates it. Surrounding instruction prose correctly scopes the real fallback ('If dropping it empties the set'); only the embedded example overstates. AC4's contract is delivered; this does not break it. Already tracked in SUMMARY open items.
status: pass
first_pass: fail
source: verifier
evidence: references/review-triggers.md:54-60
reported: Example string at review-triggers.md:57 embeds '- falling back to claude-subagent'; in a multi-provider panel where dropping one ok:false reviewer leaves another, no fallback occurs, so the example overstates it. Surrounding instruction prose correctly scopes the real fallback ('If dropping it empties the set'); only the embedded example overstates. AC4's contract is delivered; this does not break it. Already tracked in SUMMARY open items.
severity: cosmetic
fix: 5e5c475, retest

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
