---
status: testing
phase: 1
fields_version: 1
started: 2026-08-23
updated: 2026-08-24
---

## Items

### 1. Pre-sweep tree reports hintless refusals
expected: At the commit that wired the check in (3425165e), `node cadence-core/bin/self-verify.mjs --root .` returns ok:false with at least one problems[] entry of kind hintless-refusal, and every such entry names a file path and the reason token at that site.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Tree at 3425165e extracted via git archive to a scratch dir and self-verified there: exit 1, ok:false, 215 problems, all kind hintless-refusal, every one carrying a `file` and a detail of the form `line N: <token>` (e.g. cadence-core/bin/config.mjs, 'line 131: read').

### 2. Finished tree is green and SUMMARY states both integers
expected: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with problems: [], and SUMMARY.md states the in-scope site count and the hintless in-scope count, the second being 0.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: self-verify --root . returns ok:true with problems: []; refusalSites('.') independently re-measured at 243 sites / 0 hintless, the same pair SUMMARY.md states.

### 3. config, route and review-provider refusals carry a hint
expected: `node cadence-core/bin/config.mjs set nosuchkey=1`, a route.mjs refusal and a review-provider.mjs refusal each print an envelope whose hint is a non-empty string.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Three live runs: config.mjs set nosuchkey=1 (invalid), route.mjs resolve --role nosuchrole (unknown-role), review-provider.mjs with no subcommand (bad-command) each print a non-empty hint alongside an unchanged reason and detail.

### 4. No reason token or fail() first argument changed
expected: No `reason:` literal value and no positional first argument to a fail(...) call was edited across the phase, and `node cadence-core/bin/test.mjs` reports 0 failures with no test's expected reason string changed.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Independent multiset diff of reason literals and fail() first arguments over 44fead5b..HEAD: empty REMOVED set, no decreased count, additions only. node cadence-core/bin/test.mjs = 2959 pass / 0 fail / 1 skipped over 2960 tests.

### 5. No weight budget crossed and no model-facing prose touched
expected: `node cadence-core/bin/weight.mjs` reports every budgeted surface within its pin, and the phase's changed-file list holds no path under cadence-core/workflows/, cadence-core/references/ or skills/cad-*-contract/.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: weight.mjs ok:true over 111 surfaces, none over pin; the 22 changed paths are 17 files under cadence-core/bin/ plus 5 planning documents, none under workflows/, references/ or skills/cad-*-contract/.

### 6. The exclusion register is named, reasoned and injectable
expected: The check's lib file carries a register naming each exclusion (usage, internal, git-guard.mjs, the three static-registry libs, the re-wrapped sub-envelope returns) each with a one-line reason, and a test injects a substitute register to prove the check reads it rather than a hard-coded list.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: REGISTER carries 2 token rows and 7 file rows covering exactly the exclusions CONTEXT names (usage, internal, git-guard.mjs, the three static-registry libs, the three sub-envelope-return libs), each with a one-line reason citing its D-number; 0 rows lack a reason. Injectability proved live outside the test file: substituting a register that adds `bad-args` moves the site count 243 -> 150, adding `planning.mjs` moves it 243 -> 63. refusal-hints.test.mjs 23/23 pass.

### 7. Hints read as an instruction to the person at the terminal
expected: Reading a sample of the new hints, each names an action in the user's own terms rather than restating the detail or explaining the seam's internals. The check only tests for a non-empty string, so this is judgment, not an assertion.
status: pass
first_pass: pass
reported: looks good

### 8. Read 8-10 of the new hints in cadence-core/bin/planning.mjs and cadence-core/bin/review-provider.mjs and judge whether each names an action in YOUR vocabulary
expected: Each hint tells the person at the terminal what to type or change next, rather than restating the detail or explaining how the seam works. Sampled examples that should hold: 'point --dir at the .planning/ directory that holds ROADMAP.md, or run /cad-new-project if this project has no roadmap yet'; 'let the run holding the lock finish and re-run, or clear a stale lock the detail names - the harvest is idempotent, so a second pass costs nothing'.
origin: verifier
why_human: This is the one truth the phase ships no assertion for: the check tests that a hint KEY exists, never that its text helps, so there is nothing to run. I sampled roughly 35 of the 243 hints and every one opened with an imperative naming an action, but a sample is not the population and 'in the user's own terms' is a judgment about whose terms - the hints are addressed to you, and the SUMMARY itself names this as the gap /cad-verify should push on.
status: pass
first_pass: pass
reported: looks good

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
