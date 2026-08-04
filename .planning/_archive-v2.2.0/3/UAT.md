---
status: testing
phase: 3
fields_version: 1
started: 2026-08-03
updated: 2026-08-03
---

## Items

### 1. A downgrade refuses: ok:false, exit 1, files byte-unchanged; rc->release still bumps
expected: 1. cd /data/code/cadence 2. D=$(mktemp -d); mkdir -p $D/.claude-plugin; printf '{"name":"x","description":"d","version":"2.0.0"}\n' > $D/.claude-plugin/plugin.json; printf '# Changelog\n\n## [Unreleased]\n' > $D/CHANGELOG.md 3. Run: node cadence-core/bin/release-bump.mjs bump --dir $D --version 1.0.0; echo exit=$? 4. Expect: one JSON line with "ok":false, "action":"refuse", "reason":"downgrade", and exit=1 5. Run: grep version $D/.claude-plugin/plugin.json 6. Expect: still 2.0.0. 7. Run: node cadence-core/bin/release-bump.mjs bump --dir $D --version 2.1.0 --date 2026-08-03 8. Expect: "ok":true, "action":"bumped" (the upgrade path still works).
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: live: bump fixture@2.0.0 --version 1.0.0 -> ok:false/refuse/downgrade exit=1, md5 unchanged; 2.1.0 -> bumped; rc boundary both directions correct (release-decision.mjs:211-215)

### 2. An unparseable version on either side refuses by name, nothing written
expected: 1. cd /data/code/cadence 2. Reuse a fresh fixture dir as in AC1 (manifest at 2.0.0) 3. Run: node cadence-core/bin/release-bump.mjs bump --dir $D --version latest; echo exit=$? 4. Expect: "ok":false, "reason":"unparseable-version", exit=1, and the reason detail names the offending value 5. Run: grep version $D/.claude-plugin/plugin.json 6. Expect: still 2.0.0, CHANGELOG.md unchanged.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: live: latest/1.0/01.2.3 -> unparseable-version exit=1 naming the value; current-side 1.0 also refuses; 1.0.0+build -> not-an-upgrade; md5 unchanged (release-decision.mjs:53-59,194-219)

### 3. Staged Unreleased content is promoted INSIDE the dated heading, empty stub survives, nothing stranded
expected: 1. cd /data/code/cadence 2. D=$(mktemp -d); mkdir -p $D/.claude-plugin; printf '{"name":"x","description":"d","version":"1.0.0"}\n' > $D/.claude-plugin/plugin.json; printf '# Changelog\n\n## [Unreleased]\n\n### Removed\n- the old parser\n\n## [1.0.0] - 2026-07-16\n\nfirst\n' > $D/CHANGELOG.md 3. Run: node cadence-core/bin/release-bump.mjs bump --dir $D --version 2.0.0 --date 2026-08-03 4. Run: cat $D/CHANGELOG.md 5. Expect: "- the old parser" sits AFTER "## [2.0.0] - 2026-08-03" and BEFORE "## [1.0.0]"; "## [Unreleased]" still present above with only blank lines under it.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: live on the UAT fixture: bullet after ## [2.0.0] - 2026-08-03, before ## [1.0.0]; Unreleased an empty stub; envelope changed:true promoted:true (release-decision.mjs:331-374)

### 4. Re-run with empty Unreleased is byte-identical; re-run after staging new content promotes it too
expected: 1. Continue from the AC3 fixture. 2. Run: cp $D/CHANGELOG.md /tmp/before.md; node cadence-core/bin/release-bump.mjs bump --dir $D --version 2.0.0 --date 2026-08-03; diff /tmp/before.md $D/CHANGELOG.md 3. Expect: "action":"noop", diff silent (byte-identical). 4. Stage a new bullet: append "### Fixed" and "- a late fix" under ## [Unreleased] 5. Re-run the same bump command 6. Expect: "promoted":true and "- a late fix" now inside ## [2.0.0], Unreleased an empty stub again.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: live: second run noop, diff silent both files; staged ### Fixed bullet promoted on third run, stub restored (idempotency arm release-decision.mjs:349)

### 5. No --version refuses even while PROJECT.md ### Active names a version; prose reads are gone from the seam
expected: 1. cd /data/code/cadence 2. Add to the fixture: mkdir -p $D/.planning; printf '## Requirements\n### Active\n\n`v9.9.9` - the round\n' > $D/.planning/PROJECT.md 3. Run: node cadence-core/bin/release-bump.mjs bump --dir $D; echo exit=$? 4. Expect: "ok":false, "reason":"no-target-version", exit=1 - the prose version is NOT picked up. 5. Run: grep -n "PROJECT\|ROADMAP" cadence-core/bin/release-bump.mjs cadence-core/bin/lib/release-decision.mjs 6. Expect: no matches (the derivation is gone from the code, not just inert).
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: live: fixture with ### Active v9.9.9 -> no-target-version exit=1; grep PROJECT|ROADMAP|activeVersion over both release files: no matches; pre-phase HEAD reproduced shipping 9.9.9 from prose ok:true

### 6. milestone.md documents the refusal halt before any tagging step, plus the sibling and empty-section checks
expected: 1. cd /data/code/cadence 2. Run: grep -n "ok:false" cadence-core/workflows/milestone.md 3. Expect: the refusal arm naming the reason codes and an explicit STOP before the tag. 4. Run: grep -n "siblings\|section_empty" cadence-core/workflows/milestone.md 5. Expect: both success-envelope checks present (sibling refuse halt, author-before-commit on empty section). 6. Run: grep -n "derivation reads the shipping version" cadence-core/workflows/milestone.md 7. Expect: no match (the stale rationale is gone).
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: milestone.md:47-59 three halts BEFORE the bump commit (:61-64) and tag (:66), naming all five codes + siblings refuse + section_empty; stale rationale gone; all five refusal causes observed live as ok:false exit 1

### 7. Full gate: tests, tsc, self-verify all green; budgets regenerated in the same commit as the milestone.md edit
expected: 1. cd /data/code/cadence 2. Run: node --test cadence-core/bin/*.test.mjs 2>&1 | tail -5 3. Expect: fail 0 (total 1067 or higher). 4. Run: npx tsc -p tsconfig.ci.json; echo exit=$? 5. Expect: exit=0. 6. Run: node cadence-core/bin/self-verify.mjs 7. Expect: "ok":true with empty problems. 8. Run: git show c253a3b --stat | grep -c "milestone.md\|weight-budgets.json" 9. Expect: 2 (both files in the one commit).
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1067/1067 tests fail 0; tsc exit 0; self-verify ok:true problems:[]; git show c253a3b --stat has milestone.md + weight-budgets.json, budget 7181->8002, wc -c = 8002

### 8. REL-03 release note staged under Unreleased; tag-at-HEAD contradiction captured, not fixed
expected: 1. cd /data/code/cadence 2. Run: sed -n '/## \[Unreleased\]/,/^## \[[0-9]/p' CHANGELOG.md | grep -c "release-bump" 3. Expect: 1 or more (the REL-03 note sits above the first dated heading). 4. Run: grep -n "(phase 3)" .planning/CAPTURE.md | head -3 5. Expect: the tag-at-HEAD todo present (plus the six diff-review items recorded at execution).
status: pass
first_pass: pass
source: verifier
evidence: sed Unreleased range | grep -c release-bump -> 1; CAPTURE.md:204 carries the (phase 3) todo; milestone.md:66 deliberately unfixed; git status CHANGELOG.md clean - D-10 held, all runs on scratch fixtures

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
