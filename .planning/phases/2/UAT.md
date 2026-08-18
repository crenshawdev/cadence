---
status: testing
phase: 2
fields_version: 1
started: 2026-08-18
updated: 2026-08-18
---

## Items

### 1. activeVersion answers the milestone on both residue shapes
expected: On a body whose first version token is the milestone with a later line-anchored predecessor (the 81bdb5d wrapped-continuation shape), and on a body naming the predecessor in prose before the milestone, activeVersion returns the milestone, never the predecessor.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: branch-decision.mjs:119-137 two-scan admission (agreement OR opensSentence); fixtures at branch-decision.test.mjs:288 and :308 pass, 26/26 exit 0; live activeVersion(.planning/PROJECT.md) = v3.5.4 and `planning.mjs audit` on this repo emits no version_drift.

### 2. activeVersion still answers on a mid-prose-only token, four pinned fixtures unchanged
expected: A body whose only version token sits mid-prose with no line anchor still returns that version, and the four DECLARED_VERSION_RE fixtures at branch-decision.test.mjs:237-266 pass byte-unchanged.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Diff hunk is `@@ -264,3 +264,64 @@` - lines 237-266 untouched; the continuation-line-only fixture at branch-decision.test.mjs:322 returns v4.2.0 via the retained `loose` fallback (branch-decision.mjs:139).

### 3. DOC-02 pin's remedy names the reader, not the file
expected: prose-agreement.test.mjs's DOC-02 test passes, and the sentence "Fix the section - declare the milestone on its own line above every mention - rather than the anchor" occurs nowhere in the tree.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs:770-792 and :822-831 rewritten to name lib/branch-decision.mjs's admission rule, citing phase 2 D-03; `grep -rn "Fix the section" cadence-core/` returns nothing; test passes. Residual occurrences are only in this phase's own planning records and in UAT.md:22's own quotation of the sentence.

### 4. Rolled-over phase is exempt from version_drift
expected: audit against a project whose sole unsettled phase has all-Deferred requirement rows emits no version_drift; the identical project with those rows Pending still emits one.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:1346-1352 `rolledOver` (>=1 row, all Deferred) gating `cycleOpen`; planning.test.mjs:2667 emits no version_drift, :2685 Pending twin still emits {doc_version, published_as, cycle_state}; both red/green as claimed at caf3a23.

### 5. Tag discovery is bounded to the caller's project root
expected: audit --dir sub/.planning, where sub/ is a non-repository project inside a repo tagged v9.9.0, emits no version_drift and leaves the envelope otherwise unchanged; the same audit inside a linked worktree of a real tagged repo still reads that repo's tags and still emits one.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: git-tags.mjs:70-75 containment probe on realpaths; both callers updated (git-branch.mjs:69, planning.mjs:1307) with no one-arg callsite left; umbrella fixture returns no version_drift with the envelope otherwise unchanged, linked-worktree fixture still emits one; both fail at 487e150.

### 6. Each requirement carries a WATCHED FAILING AT check that is red at its sha
expected: DRF-01, DRF-02 and TAG-01 each have a check headed WATCHED FAILING AT <sha> whose sha resolves to a real commit preceding that fix, and that check fails when re-run against that commit's tree.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 2c88137 / 487e150 / caf3a23 all resolve and each precedes its fix commit; all three checks re-run red against `git archive` extractions of the named trees, with the paired 'must not cost' fixtures green.

### 7. Test suite and self-verify both exit 0
expected: node --test cadence-core/bin/*.test.mjs exits 0 and node cadence-core/bin/self-verify.mjs exits 0.
criterion: AC7
status: pass
first_pass: fail
source: model
evidence: Retest after d4810ff: `node --test cadence-core/bin/*.test.mjs` exit=0, summary `fail 0 / cancelled 0 / skipped 0 / todo 0` over 2183 tests; `node cadence-core/bin/self-verify.mjs` exit=0. The milestone-prune corpus test at milestone-prune.test.mjs:433 is green now that PHS-01 spans 4 lines.
reported: behavior wrong - `node --test cadence-core/bin/*.test.mjs` exits 1, not 0. self-verify exits 0.
severity: major
cause: `.planning/REQUIREMENTS.md`'s `## Active` bullets for PHS-01, RVW-03, REL-01 and ISS-01 were authored as single unwrapped lines (247-290 chars) while every other bullet wraps at ~79 with a 2-space continuation indent. `milestone-prune.test.mjs:433` asserts every MOVED bullet spans more than one line (`activeSpan(...).length > 1`) so the corpus bites. Phase 1 is complete, so PHS-01 is the one that moves today and the one that fails. RVW-03/REL-01/ISS-01 will fail identically when phases 3+ complete. Phase 2's own DRF-01/DRF-02/TAG-01 are correctly wrapped. Not caused by any phase 2 commit: `git log -1 -- .planning/REQUIREMENTS.md` = 2c88137 (phase start), and milestone-prune.mjs/.test.mjs are absent from `git diff --stat 2c88137..HEAD`. Fix site is a planning doc, outside the plan's lease.
fix: d4810ff, retest

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
