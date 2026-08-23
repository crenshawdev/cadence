---
status: testing
phase: 2
fields_version: 1
started: 2026-08-23
updated: 2026-08-23
---

## Items

### 1. Value-level codes stay on their own key
expected: readFrontmatterList(text,'files') over a doc whose goal: scalar is backtick-wrapped returns issues: [] (both trailing-value-content and backtick-wrapped-value suppressed), while the same read over a backticked files: entry still reports its code.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: readFrontmatterList over a backtick-wrapped goal: scalar returns issues: [] on a files: read, with BOTH trailing-value-content and backtick-wrapped-value proved present under a list key and absent here; a backticked files: entry still reports backtick-wrapped-value at line 3.

### 2. Structural codes still cross keys
expected: An unknown-line raised inside a requirements: block still appears on a files: read.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: An unknown-line raised inside the requirements: block appears on a files: read as {line:4,code:'unknown-line'}; item-without-key also fires on the no-block-key path the gate would otherwise have silenced.

### 3. Decoration shapes flagged, plain paths not
expected: parsePlanFiles reports an issue for **path**, for [path](path), and for a matched interior backtick pair; reports none for a plain path or a path with one interior backtick.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: parsePlanFiles reports markdown-decorated-path for **src/a.rs**, [src/a.rs](src/a.rs) and src/`a`.rs, and reports nothing for src/a.rs or src/a`.rs; a backtick-WRAPPED path still reports the boundary code alone.

### 4. Flagged paths keep their bytes
expected: Every flagged decorated entry appears in the returned files list byte-unchanged - not dropped, not rewritten to the undecorated form.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Each flagged declaration is returned in files identical to the declared bytes - files=['**src/a.rs**'], ['[src/a.rs](src/a.rs)'], ['src/`a`.rs'] - nothing dropped, nothing undecorated.

### 5. Collision reaches the plan-overlap envelope
expected: planning.mjs plan-overlap over two plans declaring the same file, one plain and one decorated, returns a non-empty frontmatter_issues naming the decorated line.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs plan-overlap --phase 9 over a bold PLAN-1 and a plain PLAN-2 returned frontmatter_issues:[{plan:'PLAN-1.md',issues:[{line:6,code:'markdown-decorated-path',text:'- **src/shared.rs**'}]}], and execute.md:130-137 routes any such entry to sequential.

### 6. Code-set guard reddens on a missing table row
expected: A grammar code literal in planning-files.mjs that is absent from references/plan-frontmatter.md's code table fails the source-derived test.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: On a scratch copy, injecting an undocumented code literal into parsePlanFiles fails the D-12 test by name: "grammar code `brand-new-code` ... has no row in ... plan-frontmatter.md's `## Diagnostic codes` table". Untouched copy passes.

### 7. Self-verify and full test suite clean
expected: node cadence-core/bin/self-verify.mjs --root . returns ok:true with problems: [], and node cadence-core/bin/test.mjs reports 0 failures.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs --root . -> ok:true, problems: []. test.mjs -> 2673 tests, 0 failures.

### 8. Decoration shapes outside the three named ones are still accepted as clean paths
expected: behavior wrong - incomplete rule. isDecoratedPath (cadence-core/bin/lib/planning-files.mjs:2281-2288) tests exactly bold, the link form and a matched interior backtick pair. Italic and its neighbours are not tested, so an italic-decorated declaration is neither flagged nor equal to its plain sibling, and the phase's own failure mode survives in that spelling. All seven promised acceptance criteria hold and ROADMAP criterion 2 says 'at minimum' those three shapes, so this is scope beyond the phase contract, not a broken promise - it is recorded so it is not rediscovered as a live incident.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest at 317f5fe. Parser probes via parsePlanFiles: '*src/a.rs*', '_src/a.rs_', '__src/a.rs__', '<src/a.rs>', '[src/a.rs]' and '**src/a.rs**' each -> ['markdown-decorated-path'] with files unchanged byte-exact; 'src/a.rs', '_private/a.rs', 'src/__init__.py', 'lib/a`b.mjs' and '[src/a.rs' each -> [] (matched-wrap-only over-fire guard holds). End-to-end: `node cadence-core/bin/planning.mjs plan-overlap --phase 9 --dir <scratch>` over PLAN-1 declaring '  - *src/shared.rs*' and PLAN-2 declaring '  - src/shared.rs' now returns frontmatter_issues:[{plan:'PLAN-1.md',issues:[{line:5,code:'markdown-decorated-path',text:'- *src/shared.rs*'}]}] where it previously returned no frontmatter_issues key at all, so execute.md's choose_path routes the pair sequential. Regression: `npx tsc -p tsconfig.ci.json` exit 0; `node cadence-core/bin/test.mjs` -> 2682 tests, 0 failures (up from 2673, the 9 new decoration rows); `node cadence-core/bin/self-verify.mjs --root .` -> ok:true, problems: []. `risk-check run --base HEAD~1 --head HEAD` -> matches: [], no risk surface.
reported: behavior wrong - incomplete rule. isDecoratedPath (cadence-core/bin/lib/planning-files.mjs:2281-2288) tests exactly bold, the link form and a matched interior backtick pair. Italic and its neighbours are not tested, so an italic-decorated declaration is neither flagged nor equal to its plain sibling, and the phase's own failure mode survives in that spelling. All seven promised acceptance criteria hold and ROADMAP criterion 2 says 'at minimum' those three shapes, so this is scope beyond the phase contract, not a broken promise - it is recorded so it is not rediscovered as a live incident.
severity: minor
cause: isDecoratedPath (cadence-core/bin/lib/planning-files.mjs:2281-2288) is a closed three-shape predicate: a bold wrap (>4 chars, ** on both ends), the link form ([..](..)), and >=2 interior backticks. Every other markdown wrapper falls through the final `return interior >= 2` as false, so *x*, _x_, __x__, <x> and [x] are returned as clean file entries. Confirmed by reading the closure: there is no emphasis arm at all, not a mis-specified one. The three shapes implemented are exactly the three AC3 and ROADMAP criterion 2 name, so the phase contract is met and the gap is uncovered scope, not a regression.
fix: 317f5fe, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
