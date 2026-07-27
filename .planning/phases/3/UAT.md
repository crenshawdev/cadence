---
status: testing
phase: 3
started: 2026-07-27
updated: 2026-07-27
---

## Items

### 1. Colon-aligned + bounded Traceability parse
expected: `audit` against a REQUIREMENTS.md whose Traceability table uses colon-aligned separators (|:---|:--:|---:|) returns the same counts as the plain-dash table, reports no requirement whose id is dashes/colons, and rows in a `## ` section appended after `## Traceability` appear in no requirement count.
status: pass
first_pass: pass

### 2. UAT hand-added section survives, mints no phantom item
expected: `uat status` on a UAT.md carrying a hand-added `### Manual notes` section containing a `1. check the logs` line reports only the real items (no phantom, no duplicate k), and a following `uat record` leaves that section present and byte-identical.
status: pass
first_pass: pass

### 3. uat merge rejects unusable entries, merges the rest
expected: `uat merge` fed a k-less/name-less gap, a nameless human_check, a gap whose k matches nothing, and one valid gap exits ok:true, appends only the valid gap, writes no item named `undefined`, and reports a nonzero rejected count.
status: pass
first_pass: pass

### 4. uat merge reports non-pending conflicts as skipped
expected: `uat merge` fed a pass or gap for an item already recorded non-pending leaves that recorded result unchanged and reports a nonzero skipped count (pre-fix it dropped silently and reported nothing).
status: pass
first_pass: pass

### 5. Unquoted multi-word recall query
expected: `planning.mjs recall decimal phases` (two bare words, unquoted) returns the same results as `recall "decimal phases"`.
status: pass
first_pass: pass

### 6. Closed captures indexed with phase and a closed marker
expected: A `- [x] (phase 3) ...` CAPTURE.md line appears in recall results with phase: 3, no `[x]` in the snippet, and a marker showing it is closed.
status: pass
first_pass: pass

### 7. Block-YAML frontmatter requirements/files, bounded to the fence
expected: `audit` on a phase whose PLAN.md frontmatter declares `requirements:` as a block YAML list reports that plan's ids rather than zero; `plan-overlap` reads its block-form `files:` list; and a `requirements:` line in the plan body outside the `---` fence contributes no ids.
status: pass
first_pass: pass

### 8. renumber remove cuts a name-less phase heading
expected: `renumber remove` on a roadmap whose phase detail heading is exactly `### Phase N:` (colon, no trailing name) removes that section from the document.
status: pass
first_pass: pass

### 9. Regression tests failing-capable + all three CI gates green
expected: Each of #41, #46, #47, #48 has at least one test that fails on pre-fix code and passes after; and `node --test cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json` all pass.
status: pass
first_pass: pass

### 10. Comment-only frontmatter value reads as empty, not an id
expected: A PLAN.md whose frontmatter reads `requirements:   # comment` followed by a block list yields the block items (not the comment as a fabricated scalar id), so `audit` shows no `# ...` in orphans.plan_ids. (SUMMARY logged this as a HIGH regression; 2470e95 claims the fix.)
status: pass
first_pass: pass

### 11. v1.3.1 Traceability table seeded
expected: `audit` on this repo reports a nonzero counts.total with #41/#46/#47/#48 traced to phase 3, rather than counts.total: 0 with those ids as orphans.plan_ids. (SUMMARY: 'Needs the seeding step at /cad-verify' - the step that did not fire at the v1.2.0 close.)
status: pass
first_pass: fail
reported: audit reports counts.total: 0; #41/#46/#47/#48 sit in orphans.plan_ids alongside phases 1 and 2's ids
severity: major
cause: The v1.3.1 ## Traceability table in .planning/REQUIREMENTS.md is a header + separator with no rows - it was never seeded when the cycle opened, and phase 3 task 1 edited only the stale prose note above it. audit reads rows from that section only, so every plan id in the milestone reads as an orphan.
fix: 7cc96cb, retest

## Summary

total: 11
passed: 11
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
