---
status: testing
phase: 3
fields_version: 1
started: 2026-08-19
updated: 2026-08-19
---

## Items

### 1. Unreachable configured tool nulls its slot
expected: On a fixture tree configuring ruff (or mypy, or eslint) with that binary absent from PATH and from node_modules/.bin, detect-commands returns that slot as null, names the unreachable tool in warnings[], and does NOT fall through to a lower matching arm.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live fixture (pyproject [tool.ruff] + go.mod, ruff absent, no node_modules): lint null, source.lint null, warning names ruff and pyproject.toml, and `go vet ./...` was not substituted. planning.mjs:2645-2662; named test planning.test.mjs:5368 passes.

### 2. npx-delegated typecheck resolves in this repo
expected: Run in this repository, detect-commands returns `npx tsc -p tsconfig.ci.json` for the typecheck slot, with tsc absent from PATH and present at node_modules/.bin/tsc.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: detect-commands --root . in /code/cadence -> typecheck 'npx tsc -p tsconfig.ci.json', source 'tsconfig.ci.json', with tsc absent from PATH and node_modules/.bin/tsc present. Delegated-tool split at planning.mjs:2622-2639, directory probe at lib/on-path.mjs:65-71. Known root-only limitation (ancestor node_modules) reproduced and conservative - it nulls, it never names an unreachable tool.

### 3. detect-commands suite is machine-independent
expected: The full detect-commands test set passes with ruff, mypy, eslint, tsc and go all absent, and passes again with a stub for each made reachable.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: 25/25 detect-commands rows pass on this machine with ruff/mypy/eslint/tsc/go all absent from PATH, and 25/25 again with executable stubs for all five prepended to PATH. Override is sentinel-gated and read by presence (planning.mjs:2613-2618).

### 4. risk-check accepts the worker-key grammar
expected: `risk-check run --phase 3 --plan 1-fix --base <ref> --head <ref>` returns ok:true and records a risk row; `risk-check status` for a range whose brackets carry 1-fix returns ok:false before a receipt exists under that corr+1-fix and ok:true after one does.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: plan-key.test.mjs:180 walks refuse -> run ok:true -> refuse (risk-fire-missing) -> receipt -> ok:true for key '1-fix'; the record carries '1-fix' verbatim (:166). 16/16 pass. Live read-only `risk-check status --phase 3` on this repo answers ok:true, three plans recorded.

### 5. One predicate behind both risk-check faces
expected: risk-check run and risk-check status reach the plan-key grammar through one exported predicate, and a test asserts a key accepted by either face is accepted by both.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: lib/plan-key.mjs:65 requirePlanKey is the only grammar; planning.mjs:192 imports it once and calls it at :3761, :3983 and :4157. Cross-face test plan-key.test.mjs:243 drives all 16 spellings through both CLI faces and asserts identical bad-args verdicts; passes.

### 6. Risk detector stops matching itself
expected: scanDiff over a whole-file add of cadence-core/bin/lib/risk-diff.mjs returns zero matches, and over a whole-file add of cadence-core/bin/risk-diff.test.mjs returns zero matches, under both this repo's configured surfaces and the full eight-surface set; a committed test asserts both and was watched failing against the pre-fix tree.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Independent scanDiff probe: zero matches for both files under the repo's three surfaces and under all eight. Same probe against the 0e7844b blobs returns 6 and 4 categories, so the census row (risk-diff.test.mjs:1245) is a real falsifier. Detector reach unchanged - every edit is a one-character class or a split label with identical bytes.

### 7. Fence-aware Shipped and Traceability locators
expected: On a fixture whose ## Shipped and ## Traceability headings appear only inside a fenced block, milestone-prune leaves the fenced content unedited and reports no section found; on the same fixture with real headings below the fence, it archives rows under the real ## Shipped.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: sectionSpan at milestone-prune.mjs:206/:243/:254 and planning-files.mjs:235/:297/:736; both AC7 halves proven by milestone-prune.test.mjs:729 (fenced-only -> byte-identical, moved []) and :742 (real headings below the fence -> row archived under the real ## Shipped). 6/6 fence and census rows pass.

### 8. Full suite passes on the merged tree
expected: `node cadence-core/bin/test.mjs` on the merged phase-3 tree reports 0 failures (SUMMARY records 2357 pass / 0 fail).
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs at 4d69457: 2357 pass, 0 fail, exit 0.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
