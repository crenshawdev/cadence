---
status: testing
phase: 3
fields_version: 1
started: 2026-08-17
updated: 2026-08-17
---

## Items

### 1. Response byte ceiling destroys the request
expected: node --test cadence-core/bin/review-provider.test.mjs runs green and contains a test where fakeTransport emits chunks totalling more than the ceiling, whose result is {ok:false, reason:"over-response"} with the request destroyed - not a resolved response carrying the full body.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: review-provider.mjs:276,588-604,639-640; review-provider.test.mjs ceiling + one-read-path + under-ceiling + transport-discrimination tests all green in a 69/0 run; chunksEmitted 5 of 8 proves the stream was cut, not drained.

### 2. HTTP failure envelope is a capped, sanitized string
expected: In the same run, a fault-injected non-2xx response returns detail.body as a string no longer than the stated cap (1024 bytes), containing none of the key=, token, secret or Bearer substrings planted in the injected body.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: review-provider.mjs:676-693 bodyExcerpt on both http fail sites (:1035, :1131); RVP-01 falsifier asserts string type, <=1024 bytes, no planted Bearer/key=/token/secret/value substrings, and that the diagnostic text survives. Green.

### 3. validateFindings returns seven distinct diagnostics
expected: Calling validateFindings on each of line: 0, file: "", claim: "", failure_scenario: "", an unknown key, a findings array past the count bound, and a field past the length bound returns a distinct non-null diagnostic string for each - seven different strings, no null.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: review-provider.test.mjs:280 - seven calls, all strings, Set size 7, each matched against its own wording; plus file's own maximum, the top-level unknown-key case and code-point length counting. Green.

### 4. Schema and validator agree on every fixture
expected: A test runs every fixture through both the in-repo schema evaluator and validateFindings and asserts the two verdicts match; the run is green and the fixture table includes at least one accept case.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: review-provider.test.mjs:405 - 18 fixtures through evaluateSchema against the live FINDING_SCHEMA and through validateFindings, verdicts compared per fixture, accepts>=1 and rejects>=1 asserted; schema-eval.mjs throws on any keyword it does not implement (test at :338). Green.

### 5. The recovery arm names its real producers
expected: rg -n "timeout or no report" cadence-core/workflows/execute.md returns no match, and the replacement arm's producer wording appears verbatim in both cadence-core/workflows/execute.md and cadence-core/references/seams.md.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: rg for 'timeout or no report' in execute.md returns no match; execute.md:244 and seams.md:64 carry the same producer clause verbatim; the arm still reads reports/plan-<k>.md.

### 6. Prose agreement is pinned and the default reviewer states its bound
expected: node --test cadence-core/bin/prose-agreement.test.mjs is green and contains a check that reddens when either file's wording is changed alone; rg -n "is exempt" cadence-core/references/seams.md shows the claude-subagent sentence naming maxTurns: 200 as its bound.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs:636 compares the two EXTRACTED producer clauses (one-sided reword reddens) and checks maxTurns against the 19 rung frontmatters; seams.md:306-307 and review-triggers.md:9 both name maxTurns: 200. 27 pass / 0 fail.

### 7. SUMMARY records each watched-FAIL SHA
expected: .planning/phases/3/SUMMARY.md records, for each of RVP-01, RVP-02 and WIR-01, the SHA at which its check was watched failing before the fix landed.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: SUMMARY.md:184-211 SHAs e1e6c0a / 15b5d4c / cdf8676 each match the WATCHED FAILING AT header and quoted unpatched output in the file that line names (review-provider.test.mjs:1566,:1630; prose-agreement.test.mjs:573).

### 8. bodyExcerpt leaks a credential fragment at the sanitize-window edge
expected: behavior wrong - the goal's 'sanitized excerpt' clause does not hold for one reachable class of provider-controlled body, even though AC2's own fixture passes
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: cadence-core/bin/review-provider.mjs:683-686 - the trailing-token safeguard is gated on `Buffer.byteLength(clean) <= room`, so when redaction shrinks the 4096-byte window to just PAST the cap the window-edge-truncated credential survives inside the first `room` bytes. Reproduced against the real cadence-core/bin/lib/redact-url.mjs: the returned excerpt ends `\"password\":\"SUPERSECRET ...[truncated]` (key name plus 11 bytes of value). Cause is that a quoted value cut before its closing quote matches none of CRED_VALUE's three alternatives (lib/redact-url.mjs:122), so redactCredentials leaves it whole. Declared at SUMMARY.md:118-125; the related quadratic in redactUrl that forces the window at all is SUMMARY.md:126-130.
reported: behavior wrong - the goal's 'sanitized excerpt' clause does not hold for one reachable class of provider-controlled body, even though AC2's own fixture passes
severity: minor
cause: review-provider.mjs:683-686 gates the trailing-token safeguard on Buffer.byteLength(clean) <= room, so when redaction shrinks the 4096-byte window to just past the cap, a window-edge-truncated credential survives inside the first `room` bytes. Root cause is lib/redact-url.mjs:122: a quoted value cut before its closing quote matches none of CRED_VALUE's three alternatives, so redactCredentials leaves it whole. The window exists only because redactUrl is quadratic; fixing that removes the window and this hole together.
fix: left open - redactUrl quadratic fix is the repair
reason: Left open by user decision. Minor, already declared in SUMMARY open items. Correct repair is the redactUrl quadratic fix, which removes the 4096-byte window and this hole together - phase-sized, not a gate-time patch.

## Summary

total: 8
passed: 7
failed: 1
pending: 0
skipped: 0
blocked: 0
reworked: 1
