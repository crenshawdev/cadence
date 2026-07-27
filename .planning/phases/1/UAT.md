---
status: testing
phase: 1
started: 2026-07-27
updated: 2026-07-27
---

## Items

### 1. Comment on the requirements key line above a block list
expected: audit against a PLAN.md whose `requirements:` key line carries a trailing comment above a block list returns BOTH declared ids, with zero orphans.plan_ids entries and no no-plan break.
status: pass
first_pass: pass
source: verifier
evidence: audit on `requirements:   # ids this plan delivers` / `# covers auth` / `- "#41"` / blank / `- "#46"` -> both ids traced to phases/1/PLAN.md, counts {total:2,traced:2,broken:0}, no orphans, no break.

### 2. plan-overlap sees through comment lines in files blocks
expected: plan-overlap against two plans whose `files:` block lists each contain a comment line and share a path reports that shared path in `overlaps`.
status: pass
first_pass: pass
source: verifier
evidence: two plans, each files: block headed by a comment, both declaring src/shared.rs -> overlaps:[{plans:[PLAN-1.md,PLAN-2.md],files:[src/shared.rs]}].

### 3. Inline list with a bracketed trailing comment
expected: `requirements: ["#41"]  # see [D-06]` parses to exactly ["#41"] - no entry containing `]`, `#`, or `see`.
status: pass
first_pass: pass
source: verifier
evidence: parsePlanRequirements('requirements: ["#41"]  # see [D-06]') -> {ids:["#41"],issues:[]}; greedy \[(.*)\] replaced by depth-0 scan at planning-files.mjs:516-529.

### 4. #TODO no-space comment form, and a quoted # id as a block item
expected: `requirements: #TODO fill this in` above a block list of two quoted ids returns exactly those two ids and mints nothing containing `TODO`; a block item `- "#41"` still reads as the id `#41`.
status: pass
first_pass: pass
source: verifier
evidence: `requirements: #TODO fill this in` + two quoted ids -> {ids:["#41","#46"],issues:[]}; block item `- "#41"` -> items:["#41"].

### 5. CRLF, leading-blank-line, and BOM variants
expected: The CRLF, leading-blank-line, and BOM variants of one PLAN.md each return ids and files identical to its plain-LF equivalent.
status: pass
first_pass: pass
source: verifier
evidence: parser: all three variants -> {ids:["#41","#46"],files:["src/a.rs"],issues:[]}; seam two-plan trees: LF, CRLF and BOM all -> identical plans/files counts and overlaps:[{files:[src/shared.rs]}].

### 6. frontmatter_issues surfaces on both envelopes without changing the verdict
expected: A frontmatter line that is neither item, comment, blank, nor terminator appears in the frontmatter_issues field on BOTH audit and plan-overlap output, and its presence does not change the audit PASS/FAIL verdict.
status: pass
first_pass: pass
source: verifier
evidence: audit with a stray line between two block ids -> frontmatter_issues:[{file:phases/1/PLAN-1.md,issues:[{line:5,code:unknown-line,text:'garbage here'}]}], both ids still resolve, counts byte-identical to the stray-free twin, ok:true; same issue present on plan-overlap.

### 7. Full CI gate: tests, typecheck, self-verify budgets
expected: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json` both pass, self-verify reports no budget-overrun, and the four rewritten frontmatter tests plus the new parser-level grammar table are among the passing set.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> pass 349 / fail 0; npx tsc -p tsconfig.ci.json exit 0; self-verify -> {ok:true, problems:[]}; the four rewritten seam tests and the 33-row planning-files.test.mjs grammar table are in the passing set.

### 8. Block item under a key that took the inline arm is not silently dropped
expected: `files: []  # comment` followed by `  - src/shared.rs` either returns the path or records a frontmatter_issues entry - it must not return {items:[],issues:[]}. Same for an item line with no preceding key at all. (SUMMARY open finding 1, high: this is the false-overlaps:[] the phase exists to close.)
status: fail
first_pass: fail
source: verifier
evidence: planning-files.mjs:650 `if (currentKey) {...}` has no else. parsePlanFiles('files: []            # files this plan touches' + '  - src/shared.rs' + '  - src/a.rs') -> {files:[],issues:[]}. readFrontmatterList('---\n- "#41"\n---','requirements') -> {items:[],issues:[]}. Seam: two plans as `files: [src/a.rs]  # comment` / `  - src/shared.rs` -> {plans:[{PLAN-1,files:1},{PLAN-2,files:1}],overlaps:[]} with neither undeclared nor frontmatter_issues, so choose_path greenlights parallel while both write src/shared.rs.
reported: The item classifier computes the payload then discards it when no block key is open, with no diagnostic. Reproduces the exact false-overlaps:[] the phase exists to close, on the shipped template's own shape.
severity: blocker
cause: planning-files.mjs:650 - the item arm is wrapped in `if (currentKey)` with no else branch, so an item line arriving while no block is open is computed and thrown away. Compounded by the inline arm never setting currentKey, which is the shipped template's own `files: []` shape.
fix: routed to /cad-plan

### 9. A quoted item with trailing text does not mint a fabricated value
expected: `- "src/shared.rs" (new)` yields the path `src/shared.rs` (or a diagnostic), not the quote-retaining `"src/shared.rs"`; `- "#41" stray` does not silently mint the id `"#41" stray`. (SUMMARY open finding 2, high: regression from 7b58a80.)
status: fail
first_pass: fail
source: verifier
evidence: planning-files.mjs:477-483 (unwrap), :707-709 (add). `- "src/shared.rs" (new)` -> files:["\"src/shared.rs\""]; `- "#41" stray` -> ids:["\"#41\" stray"]; issues:[] in both. Seam: plan A `- "src/shared.rs" (new)` vs plan B `- src/shared.rs` -> overlaps:[], no undeclared, no frontmatter_issues.
reported: unwrap returns the raw string with quotes intact when anything follows the closing quote, and add() then normalizes it into a path/id that matches nothing. Regression from 7b58a80, which stripped quotes globally.
severity: blocker
cause: planning-files.mjs:477-483 - unwrap only strips when the closing quote is the last character, and returns the raw line otherwise instead of reporting; add() at :707-709 then normalizes the quote-bearing string into a path/id that can never match a sibling plan's.
fix: routed to /cad-plan

### 10. A commented-out key line terminates the active block
expected: `requirements:` / `- "#41"` / `# files:` / `  - src/shared.rs` does not fold src/shared.rs into requirements - it either terminates the block or records a diagnostic, rather than over-reading one key and under-reading the other with issues:[]. (SUMMARY open finding 3, medium.)
status: fail
first_pass: fail
source: verifier
evidence: planning-files.mjs:640 `if (BLANK_LINE.test(line) || COMMENT_LINE.test(line)) continue;`. `requirements:` / `- "#41"` / `# files:` / `  - src/shared.rs` -> {items:["#41","src/shared.rs"],issues:[]}. Seam audit mints a fabricated orphan: orphans.plan_ids:[{file:phases/1/PLAN-1.md,ids:[src/shared.rs]}]; plan-overlap reports PLAN-1 undeclared.
reported: A comment-only line is skipped unconditionally, so a commented-out key silently folds the next key's items into the previous key. Grammar-consistent but goal-inconsistent: the goal promises reporting rather than a silent over-read.
severity: major
cause: planning-files.mjs:640 - COMMENT_LINE is consumed by the same unconditional `continue` as BLANK_LINE, before the terminator set is consulted, so a commented-out key never reaches the three-member terminator check D-04 defines.
fix: routed to /cad-plan

### 11. The no-space key form does not both break audit and claim a diagnostic
expected: `requirements:["#41"]` does not simultaneously drop its data (adding a no-plan break and incrementing counts.broken) while being reported as a mere unknown-line diagnostic - the promise that a diagnostic never changes the verdict must hold, or the prose must say otherwise. (SUMMARY open finding 4, medium.)
status: fail
first_pass: fail
source: verifier
evidence: KEY_LINE = /^([A-Za-z_][A-Za-z0-9_.-]*):(\s|$)/ at planning-files.mjs:534 rejects `requirements:["#41"]`, which falls to the unknown-line arm at :659. audit -> {requirements:[{id:#41,plan:null,break:no-plan}],frontmatter_issues:[{...code:unknown-line}],counts:{total:1,traced:0,broken:1}}. references/plan-frontmatter.md:113-115 and PLAN.md:44-50 both promise this cannot happen.
reported: The stated invariant 'a diagnostic never changes counts or a break' is contradicted on this input: the unknown-line diagnostic co-occurs with a no-plan break and a moved counts.broken.
severity: major
cause: planning-files.mjs:534 - KEY_LINE requires \s or EOL after the colon, so `requirements:["#41"]` falls to the unknown-line arm at :659, which both drops the data and emits a diagnostic. The conflict is in the contract, not only the code: unknown-line's stated contract (plan-frontmatter.md:113-115) forbids exactly the counts/break movement this path produces.
fix: routed to /cad-plan

### 12. The grammar is written down and matches the parser
expected: cadence-core/references/plan-frontmatter.md exists, states the grammar (accepted forms, terminator set, every diagnostic code), and its claims match what the parser actually does.
status: fail
first_pass: fail
source: verifier
evidence: references/plan-frontmatter.md:113-115 asserts a diagnostic 'never changes counts, and never adds or clears an audit break' - falsified by the item-11 run. The file states no rule for a block item with no active key (planning-files.mjs:650 drops it), none for text following a closing quote (:477-483 keeps the quotes), and no escape rule: files: ["a\\"b.md", "c\\"d.md"] returns one fabricated path with issues:[].
reported: The reference exists and is substantive, but one stated invariant is falsifiable and three silent-read paths are unstated.
severity: minor
cause: Documentation lag, downstream of items 8-11: plan-frontmatter.md:113-115 states an invariant item 11 falsifies, and the grammar statement has no rule for the three silent-read paths (no-active-key item, trailing text after a closing quote, backslash escape). It cannot be corrected until 8-11 resolve.
fix: routed to /cad-plan

### 13. The grammar table reports 4 tests, not the >= 20 Task 4's verify names
expected: The 33 rows sit inside one test() with a sequential loop, so the file reports 4 tests and the first failing row aborts every row below it.
status: pass
first_pass: fail
source: verifier
evidence: planning-files.test.mjs:203-209; node --test cadence-core/bin/planning-files.test.mjs -> tests 4 / pass 4. PLAN.md:297-299 names 'reports at least 20 tests' as the verify.
reported: The 33 rows sit inside one test() with a sequential loop, so the file reports 4 tests and the first failing row aborts every row below it.
severity: minor
cause: planning-files.test.mjs:203-209 - the 33 rows are a for-loop inside a single test(), so node --test counts one test and an assertion failure aborts every row after it. Independent of the parser defects.
fix: afccec8, retest

### 14. choose_path actually forces sequential dispatch on frontmatter_issues
expected: In a real /cad-execute run, a phase whose plan-overlap output carries frontmatter_issues is dispatched sequentially, not in parallel. The machine verify only proves the sentence sits inside the step; choose_path is prose a model follows, not code a test can branch through.
status: pass
first_pass: pass

### 15. Whether CRLF or BOM bytes ever really reach a .planning file
expected: Either a real path that produces them (Claude Code's Write tool, a Windows core.autocrlf checkout) making normalize live coverage, or a recorded finding that it is defensive-only. CONTEXT flags this as unrecorded anywhere in the repo. Does not affect item 5, which is verified regardless.
status: pass
first_pass: pass
reported: defensive only

## Summary

total: 15
passed: 10
failed: 5
pending: 0
skipped: 0
blocked: 0
reworked: 6
