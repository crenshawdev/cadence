---
status: testing
phase: 1
fields_version: 1
started: 2026-08-22
updated: 2026-08-22
---

## Items

### 1. Version-less primary manifest halts the close
expected: `release-bump.mjs bump --version <v>` against a fixture whose primary manifest has no `version` field returns {"ok":false,"action":"refuse","reason":"no-version-field"} at exit 1 and writes nothing; the same command against this repo's own manifests still returns ok:true with the .claude-plugin/marketplace.json sibling row as action:"skip".
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: `release-bump.mjs bump --dir <version-less fixture> --version 2.0.0` returns ok:false / action:"refuse" / reason:"no-version-field" at exit 1 with both fixture files md5-identical afterwards; the same seam over this repo's real plugin.json + marketplace.json returns ok:true with the marketplace sibling row as action:"skip". Pinned by release-bump.test.mjs:409-429 and :431-456, both green (40/40). milestone.md:68 lists the code in step 2's refusal halt.

### 2. Fenced `## ` lines survive promotion and prepend
expected: Promoting an [Unreleased] body containing a fenced block with a `## ` line moves the whole body (fence-open, the fenced line, fence-close, trailing bullet) into the dated section; prependChangelogEntry over the same document writes the dated heading before the fence, never inside it.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: End-to-end bump over a fixture whose [Unreleased] body wraps a fenced `## [9.9.9]` line: the dated heading lands above the fence-open line, the fence stays contiguous, and all five body lines sit between it and `## [1.0.0]`. Fence masking applied to every `^## ` scan in release-decision.mjs; the two D-09 tests pass in a 48/48 green file with zero deletions in its phase diff.

### 3. Heading-only section is empty, prose-only is not
expected: An [Unreleased] body carrying only `### Added`/`### Fixed` with no bullets returns section_empty:true and the close's empty-section halt fires; a body that is a prose paragraph with no bullets returns section_empty:false.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Seam runs: heading-only [Unreleased] body -> section_empty:true with promoted:true (D-04 preserved); prose-only body -> section_empty:false. releaseSectionEmpty treats only blanks and `###`/`####` as empty. milestone.md:84 halts on section_empty:true. Both D-03 tests plus the pre-existing sectionEmpty guard pass.

### 4. Three changelog states are distinguishable
expected: CHANGELOG.md absent, present with nothing to do, and gate never entered return three distinguishable envelopes asserted by one test, and workflows/milestone.md names the absent state.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Three executed runs return changelog.state "absent", "ok" and "not-examined" - three values, key present on every path. One test asserts all three together at release-bump.test.mjs:458-483 including a Set-size-3 check. milestone.md:84-89 names the absent state with the same field and value the seam emits.

### 5. Trailing link-reference block bounded by heading keys
expected: A last-in-file [Unreleased] section ending in a `[#NN]: url` definition promotes that definition with its section, while a file-final `[1.0.0]: url` whose key names an existing `## [1.0.0]` heading stays put; release-decision.test.mjs:381-404 and :406-432 still pass.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: A last-section [Unreleased] body ending in `[#87]: url` promotes the definition with its bullet into the dated section; a file-final `[1.0.0]: url` naming an existing `## [1.0.0]` heading stays at EOF. Both committed link-ref guards still pass unmodified in the 48/48 run.

### 6. Unparseable --version names the raw argument
expected: `release-bump.mjs bump --version v` returns ok:false with a reason naming the unparseable target and the raw `v` in the envelope; and a test derives the verdict-code set from release-decision.mjs's executable `code:` literals, reddening when any code is missing from either the release-bump.mjs header or the release-decision.mjs JSDoc.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `bump --version v` returns ok:false / reason:"unparseable-version" / target:"v" with the value quoted in detail, exit 1, nothing written; absent --version still no-target-version, blank still missing-flag-value. The code-set test (prose-agreement.test.mjs:2257-2290) was falsified on mutated source copies: it reddens when a code is dropped from either document and when a new `code:` literal is added.

### 7. self-verify clean
expected: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with an empty problems array.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs --root .` -> ok:true with problems:[]; milestone.md is 15190 bytes against a re-pinned 15190 budget; one full-suite run is 2655 pass / 0 fail / 1 skipped.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
