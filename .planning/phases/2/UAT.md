---
status: testing
phase: 2
fields_version: 1
started: 2026-09-02
updated: 2026-09-02
---

## Items

### 1. The task settlement record is seam-produced
expected: .planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json has no `note` field, has a `task` field naming the slug, and carries base_id, head_id, citations and per-entry ids.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: The committed record holds no `note`, holds task="declines-off-the-tracker", 40-hex base_id/head_id, a citations object and per-entry base_id/head_id; its top-level key set matches a fresh seam run's exactly, probed against a scratch planning dir.

### 2. --task beside a real phase is refused
expected: `planning.mjs adjudication --phase 2 --task some-slug` answers ok:false where phases/2/ exists; `--phase 0 --task <slug>` still answers ok:true.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Live probe: `adjudication --phase 2 --task some-slug` -> ok:false / bad-args with both phases/2/ and tasks/some-slug/ left empty; `--phase 0 --task some-slug` -> ok:true and the record written under the slug. Guard at planning/core.mjs:690-701.

### 3. A task settlement's counts are recounted
expected: A receipt with --survivors 999 against a record under tasks/<slug>/ is refused with count-disagreement, matching the phases/<N>/ refusal; the same call under deferred/<N>/ still omits the check.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live probes: --survivors 999 against a record under tasks/<slug>/ -> count-disagreement with nothing appended; the seam's own figure -> ok:true; the same record under deferred/9/ -> ok:true, check omitted; under phases/9/ -> count-disagreement; two task dirs holding a match -> check omitted.

### 4. A receipt can name the window it settles
expected: `trace append` accepts the anchor flag, its row is declared in arg-contract.mjs, and an outcome/adjudication written under an earlier phase window's corr appears in `trace render` for that phase and is joined by `risk-check status` for that range.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Row at arg-contract.mjs:992; live probe shows corr stamped 5-<older sha> under --anchor while the newest anchor is a different sha, and `trace render --phase 5` still lists it; the two named D-01 tests show risk-check status settles the range with the flag and reads unfired without it.

### 5. An override receipt names its authorization
expected: Two outcome/override events on one authorization carry the same authorization id; two on different authorizations carry different ids. The id is absent, not empty, when written without one.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Live probe over four written events: two share "AUTH-1" (one supplied padded, stored trimmed), one carries "AUTH-2", one written without the flag has no authorization_id key at all; bare and blank both refused bad-args with nothing appended.

### 6. An authorization id labels, never widens
expected: A fired range carrying no receipt of its own stays ok:false under `risk-check status` even when a receipt naming the same authorization id settles a different range.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Named test at planning-adjudication.test.mjs:1400-1428 passes on the real seams: two receipts on auth-9 over the first range leave risk-check status at ok:false / risk-fire-missing / unfired, and only a receipt naming the second range's own ends clears it. risk-check.mjs holds zero references to authorization_id.

### 7. All three gates are green tree-wide
expected: `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and `self-verify` all pass, with every edited file's weight-budgets.json row re-pinned.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3723 pass / 0 fail; tsc -p tsconfig.ci.json exit 0; self-verify ok:true with problems []. triage-gate.md is 25593 bytes against a 25593 pin, re-pinned in each of the two commits that grew it, and the arg-contract census moved 197->198->199 in those same commits.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
