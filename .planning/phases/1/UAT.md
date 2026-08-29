---
status: testing
phase: 1
fields_version: 1
started: 2026-08-29
updated: 2026-08-29
---

## Items

### 1. Append at the bound lands instead of being refused
expected: With .planning/reads.jsonl at or over MAX_READS_BYTES, appendRead reports the record written and reading the live file afterward finds that record - no {written:false, reason:"size-cap"}.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Root padded to 8388607 B: appendRead -> {"written":true}; live file afterwards 181 B whose first line satisfies isReadsRotationMarker and whose last line is the appended record; sibling holds the 8388607 pre-rotation bytes. `size-cap` returns no hit in read-trace.mjs or read-trace.test.mjs. read-trace.test.mjs 67/67.

### 2. Two rotations keep exactly one prior generation
expected: After two rotations .planning/ holds the live record plus exactly one sibling, and the first generation's records are present in neither file.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: After two real rotations the reads-prefixed files are exactly reads.jsonl, reads.1.jsonl and the inert reads.1.jsonl.claim; the pre-first-rotation generation is in neither file; live 135 B, sibling 8388607 B, distinct inodes.

### 3. Concurrent appends at the bound lose nothing and leave no blocking claim
expected: Two appendRead processes appending at the bound at once leave every record they wrote present across the live file and the sibling, with no held hard-link claim and no private stamp left behind that would stop a later rotation.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: 6 spawned appendRead processes against a root at the bound, 4 repetitions: no tag missing across live+sibling, exactly one sibling, no *.rotate.*/*.evict.*/*.claim.<pid> file left, live and sibling distinct inodes, and a later pad-to-bound append still rotated and landed.

### 4. An abandoned claim does not disable rotation forever
expected: With a stale claim on disk and the record at the bound, the next append rotates rather than refusing.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Killed-claim state built by linkSync plus a sidecar utimes'd 120 s old: appendRead rotated in 1 ms, live 139 B starting with the marker, sibling a distinct inode holding the prior generation. Sidecar dated now, and no sidecar at all, both leave the claim standing and still append (fail-live), matching the designed asymmetry.

### 5. The trace's own rotation is untouched
expected: cadence-core/bin/trace.test.mjs's existing rotation rows pass with no edit to that file.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: git diff v3.7.6..HEAD touches neither cadence-core/bin/lib/trace.mjs nor cadence-core/bin/trace.test.mjs; node --test cadence-core/bin/trace.test.mjs 171/171 pass. Full suite once: 3528 tests, 3527 pass, 0 fail, 1 skipped.

### 6. Both reader envelopes name the record and report the cut
expected: planning.mjs reads and trace suggest each name the reads record they read and report a reads rotation on a key distinct from the trace's `rotated`; the rotation marker appears in none of calls, byAgent, or the unresolved/coordinator split.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `planning.mjs reads --join` and `planning.mjs trace suggest` on a rotated root both return reads:{file,rotated:{file,ts}}; trace suggest's top-level `rotated` is absent; calls is 3 for 3 ordinary records, byAgent gains no marker entry, unresolved 0, coordinator 2, topTargets names no sibling. Absent record still returns 'no reads recorded yet' with reads:{file} and no rotation.

### 7. The never-shortened claims are gone and the sibling is ignored
expected: R7's evidence string, workflows/suggest.md and workflows/report.md no longer claim the reads record is never shortened, their pinning tests assert the new wording, and a .gitignore write covers the reads sibling and its claim files.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: R7's SCOPE clause, report.md's reading rule/Reading line/seam description and suggest.md's scope and read_record steps all corrected and pinned (trace-suggest.test.mjs:933-942, prose-agreement.test.mjs:2476-2490 and :2499-2517). trace ignore writes the four derived reads rules on a trace-only repo, reports ignored:false under --check, is byte-idempotent on re-run, and git check-ignore names the repo's own .gitignore for the record, the sibling and both claim spellings - the same four lines present in this repo at .gitignore:39-42. self-verify reports problems: [].

### 8. A killed reads rotation strands an unignored temp of up to 8 MiB in .planning/
expected: missing - rotateReads writes two private paths inside the planning root that no ignore rule, shipped or local, covers
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fix 94d0a699. On a fresh git repo with an empty .planning/, `planning.mjs trace ignore --root <t>` now reports reads_lines of six, the last two being .planning/reads.jsonl.rotate.* and .planning/reads.1.jsonl.evict.*, and `git check-ignore -v .planning/reads.jsonl.rotate.9.abc .planning/reads.1.jsonl.evict.9.abc` exits 0 naming those two written lines. Same check exits 0 in this repo against .gitignore:45-46. Both rules derive from READS_ROTATE_TEMP_FILE and READS_EVICT_TEMP_FILE, newly exported from lib/read-trace.mjs and used at the writer's own two temp sites, so the rule and the path cannot drift. planning-trace-ignore.test.mjs re-pinned to six and green; full suite `node --test cadence-core/bin/*.test.mjs` -> 3528 tests, 3527 pass, 0 fail, 1 skipped (pre-existing). risk-check run over the staged range: checked true, matches [], inconclusive false, so no risk_surface gate was owed.
reported: missing - rotateReads writes two private paths inside the planning root that no ignore rule, shipped or local, covers
severity: minor
cause: READS_IGNORE_LINES (cadence-core/bin/planning/trace.mjs:109-114) derives its four rules from READS_FILE, ROTATED_READS_FILE and READS_CLAIM_FILE only. rotateReads writes two further private paths whose spellings are not exported and so are not derived from: `${file}.rotate.${priv}` (lib/read-trace.mjs:669) and `${sibling}.evict.${priv}` (:637). Both are cleared by the finally block on every non-fatal arm, so they persist only when the process dies inside the rotation window - reachable under the 5 s hook timeout (hooks/hooks.json:15-25) - and the evict temp is a whole prior generation of up to MAX_READS_BYTES. AC7 is satisfied as worded (it names the sibling and its claim files); this is residue the phase introduced that no rule, shipped or local, covers.
fix: 94d0a699, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
