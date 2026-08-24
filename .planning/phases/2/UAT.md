---
status: testing
phase: 2
fields_version: 1
started: 2026-08-24
updated: 2026-08-24
---

## Items

### 1. --global refuses a repo-layer-only key; the repo layer takes it
expected: `config.mjs set git.auto_close=true --global` returns ok:false with reason "invalid", a detail entry naming git.auto_close and the layer, and a non-empty hint. The same pair with no --global returns ok:true and the value appears in .planning/config.json.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: set git.auto_close=true --global -> ok:false / reason:"invalid" / detail[0].key git.auto_close / error naming --file <repo config> / non-empty hint, and the temp global file was not created. Plain set in a temp cwd -> ok:true with the value in .planning/config.json. Rule: cadence-core/bin/config.mjs:193-215.

### 2. The rule reads the resolved target file, not the flag
expected: `set git.auto_close=true --file $CADENCE_GLOBAL_CONFIG` also returns ok:false, and the path spelled <global-dir>/./config.json refuses identically.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: --file $CADENCE_GLOBAL_CONFIG, <gdir>/./config.json and a symlinked <gdir>/config.json all returned the identical detail[0]; target left byte-identical. config.mjs:277-279 via the exported layerIdentity at lib/config-merge.mjs:115.

### 3. check --global reports the same scope error set refuses on
expected: `check --global git.auto_close=true` returns the same scope error; `check --global stakes=critical` returns ok:true.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: check --global git.auto_close=true returned the byte-identical detail[0] the set arm returns; check --global stakes=critical -> {"ok":true}. Row declared at lib/arg-contract.mjs:920-923, read via evaluateFlag at config.mjs:459.

### 4. No src:"repo" key is refused
expected: `set stakes=critical --global` returns ok:true and the file holds the value; config.test.mjs:29-38 passes unchanged.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: set stakes=critical --global -> ok:true with the value on disk; the rule reads spec.repo_only, never spec.src; config.test.mjs:29-38 is byte-identical in the phase diff and passed in the full suite run.

### 5. The refused set is schema-derived, not a literal list
expected: A committed test substitutes a schema fixture marking a second key; that key refuses with no line of the rule changed.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: A scratch fixture using key names absent from the shipped schema refused the marked key and accepted the unmarked sibling; stripping the marker flipped the refusal to ok:true; no key name appears in config.mjs or config-merge.mjs. Committed test 'SCP-01: a fixture schema marking a DIFFERENT key refuses that key' passed by name.

### 6. A multi-pair refusal writes nothing
expected: `set git.auto_close=true stakes=critical --global` refuses and the target file is byte-identical before and after.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: set git.auto_close=true stakes=critical --global refused and sha256sum of the target was unchanged. checkPairs at config.mjs:282 precedes the read at :286 and the write at :301.

### 7. Self-verify and the whole suite are clean
expected: `self-verify.mjs --root .` returns ok:true with problems: [], and `test.mjs` reports 0 failures.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs --root . -> ok:true, problems: []; test.mjs -> 2969 pass / 0 fail; weight.mjs -> ok:true with config-catalog.md pinned at its actual 10725 bytes.

### 8. The scope decision is not bound to the file it clears (path re-resolved between check and write)
expected: behavior wrong - the layer check and the write resolve the same pathname independently, so the check does not govern the bytes that land. CONFIRMED against the cited code, and it is NOT a new finding: this is the risk_surface HIGH the user adjudicated and explicitly OVERRODE, recorded in SUMMARY.md open items.
origin: verifier
status: skipped
first_pass: fail
source: verifier
evidence: cadence-core/bin/config.mjs:277 layerIdentity(file) resolves a pathname; :286 readFileSync(file) and :301 atomicWrite(file) each re-resolve the same pathname with nothing carried between them. A directory or symlink swap landing in that window writes through a cleared path. Not a regression - before this phase set() applied the pair with no layer check at all. The exposure is the user-global layer, where global-only keys such as workflow.test_command are honoured and that value is a command Cadence later executes.
reported: behavior wrong - the layer check and the write resolve the same pathname independently, so the check does not govern the bytes that land. CONFIRMED against the cited code, and it is NOT a new finding: this is the risk_surface HIGH the user adjudicated and explicitly OVERRODE, recorded in SUMMARY.md open items.
severity: major
cause: Not a defect introduced by this phase and not a rework item. config.mjs:277 resolves layerIdentity(file), then :286 readFileSync(file) and :301 atomicWrite(file) re-resolve the same pathname with nothing carried between them, so a directory or symlink swap in that window writes through a path the check already cleared. The verifier CONFIRMED the mechanism against the cited lines and states no action is requested for this phase. The user adjudicated it at the blocking risk_surface gate on range 89dcb93a..47be9e04 and explicitly OVERRODE it, with the override receipt and reason on the trace record and the fd-binding fix captured against phase 2.
reason: Accepted known limitation, not a failing check. The user adjudicated this at phase 2s blocking risk_surface gate on range 89dcb93a..47be9e04 and explicitly OVERRODE it; the override receipt carries the reason, SUMMARY.md records it as an open item, and the fd-binding fix is captured against phase 2 as its own work. The verifier confirmed the mechanism and states no action is requested for this phase. first_pass keeps the original fail, so the raise stays on the record.

### 9. ROADMAP still describes the superseded src:"repo" rule
expected: behavior wrong (documentation) - the contract surface contradicts the shipped code and the current UAT
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retested after fix be8fa4ca. `sed -n 64p .planning/ROADMAP.md` now reads "reads the schema Ss repo_only marker", matching the shipped field; success criterion 2 now states the derivation (a substituted schema fixture marking a different key refuses with no line of the rule changed) and records the superseded 33-key count inline as corrected by CONTEXT D-01. No `"src": "repo"` claim about the refused set remains in ROADMAP.md. self-verify.mjs ok:true problems [].
reported: behavior wrong (documentation) - the contract surface contradicts the shipped code and the current UAT
severity: minor
cause: ROADMAP.md was never reconciled with CONTEXT D-01. Line 64 and success criterion 2 (lines 154-156) both describe the superseded rule - the schema `"src": "repo"` marker, and a refusal covering all 33 such keys. D-01 found that `src: "repo"` means "settable in either layer" and is NOT a layer-scope marker, so the phase shipped a new `repo_only` field carried by one key. UAT item 4 asserts the opposite of SC2 by design. The supersession is recorded in CONTEXT and PLAN Notes but not in the ROADMAP the next reader opens.
fix: be8fa4ca, retest

## Summary

total: 9
passed: 8
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 2
