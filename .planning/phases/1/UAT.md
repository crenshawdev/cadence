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
status: pass
first_pass: fail
source: verifier
evidence: planning-files.mjs:762-771 two-branch, item-without-key at :770. Template shape 'files: [] # comment' + 2 items -> {"files":[],"issues":[item-without-key x2]}; non-empty inline + item -> {"files":["src/a.rs"],"issues":[item-without-key]}; no key at all -> item-without-key. Seam: D-13 two-plan shape -> overlaps:[] WITH frontmatter_issues naming both plans, neither files list contains src/shared.rs
reported: The item classifier computes the payload then discards it when no block key is open, with no diagnostic. Reproduces the exact false-overlaps:[] the phase exists to close, on the shipped template's own shape.
severity: blocker
cause: planning-files.mjs:650 - the item arm is wrapped in `if (currentKey)` with no else branch, so an item line arriving while no block is open is computed and thrown away. Compounded by the inline arm never setting currentKey, which is the shipped template's own `files: []` shape.
fix: 92e4f6e, retest

### 9. A quoted item with trailing text does not mint a fabricated value
expected: `- "src/shared.rs" (new)` yields the path `src/shared.rs` (or a diagnostic), not the quote-retaining `"src/shared.rs"`; `- "#41" stray` does not silently mint the id `"#41" stray`. (SUMMARY open finding 2, high: regression from 7b58a80.)
status: pass
first_pass: fail
source: verifier
evidence: planning-files.mjs:510-531 resolveValue; unwrap deleted. '- "src/shared.rs" (new)' -> ["src/shared.rs"] + trailing-value-content; '- src/a.rs (new)' -> ["src/a.rs"] same code; '- "#41" stray' -> ["#41"]; inline two-element -> exactly ONE code (dedupe at :540-547). Seam: PLAN-1 annotated vs PLAN-2 plain -> overlaps:[{files:["src/shared.rs"]}] + frontmatter_issues on PLAN-1
reported: unwrap returns the raw string with quotes intact when anything follows the closing quote, and add() then normalizes it into a path/id that matches nothing. Regression from 7b58a80, which stripped quotes globally.
severity: blocker
cause: planning-files.mjs:477-483 - unwrap only strips when the closing quote is the last character, and returns the raw line otherwise instead of reporting; add() at :707-709 then normalizes the quote-bearing string into a path/id that can never match a sibling plan's.
fix: 4abe064, retest

### 10. A commented-out key line terminates the active block
expected: `requirements:` / `- "#41"` / `# files:` / `  - src/shared.rs` does not fold src/shared.rs into requirements - it either terminates the block or records a diagnostic, rather than over-reading one key and under-reading the other with issues:[]. (SUMMARY open finding 3, medium.)
status: pass
first_pass: fail
source: verifier
evidence: D-14 accepted the FOLD as a stated cost; the item's original wording predates it. planning-files.mjs:735-750, code at :748. Fixture -> {"items":["#41","src/shared.rs"],"issues":[{"line":4,"code":"commented-key-line"}]}; audit seam -> code present, orphans.plan_ids [src/shared.rs], ok:true, counts.broken:0 - the fold is now loud rather than silent. Non-key-shaped '# shared with plan 2' does NOT over-fire
reported: A comment-only line is skipped unconditionally, so a commented-out key silently folds the next key's items into the previous key. Grammar-consistent but goal-inconsistent: the goal promises reporting rather than a silent over-read.
severity: major
cause: planning-files.mjs:640 - COMMENT_LINE is consumed by the same unconditional `continue` as BLANK_LINE, before the terminator set is consulted, so a commented-out key never reaches the three-member terminator check D-04 defines.
fix: dd5f8a8, retest

### 11. The no-space key form does not both break audit and claim a diagnostic
expected: `requirements:["#41"]` does not simultaneously drop its data (adding a no-plan break and incrementing counts.broken) while being reported as a mere unknown-line diagnostic - the promise that a diagnostic never changes the verdict must hold, or the prose must say otherwise. (SUMMARY open finding 4, medium.)
status: pass
first_pass: fail
source: verifier
evidence: planning-files.mjs:624 MALFORMED_KEY_LINE, :775-783. 'requirements:["#41"]' -> {items:[],issues:[malformed-key-line]}; col-0 http://example.com -> same code not unknown-line. Reference :167 states 'Drops that line's key and value entirely'; falsified invariant gone (grep 'never changes' -> 0). Audit seam one-id twin: twin counts {total:1,traced:1,broken:0}; malformed counts {total:1,traced:0,broken:1} + break no-plan + ok:true + diagnostic - stated behavior matches seam behavior
reported: The stated invariant 'a diagnostic never changes counts or a break' is contradicted on this input: the unknown-line diagnostic co-occurs with a no-plan break and a moved counts.broken.
severity: major
cause: planning-files.mjs:534 - KEY_LINE requires \s or EOL after the colon, so `requirements:["#41"]` falls to the unknown-line arm at :659, which both drops the data and emits a diagnostic. The conflict is in the contract, not only the code: unknown-line's stated contract (plan-frontmatter.md:113-115) forbids exactly the counts/break movement this path produces.
fix: dd5f8a8 + e0e9026, retest

### 12. The grammar is written down and matches the parser
expected: cadence-core/references/plan-frontmatter.md exists, states the grammar (accepted forms, terminator set, every diagnostic code), and its claims match what the parser actually does.
status: pass
first_pass: fail
source: verifier
evidence: plan-frontmatter.md:82-87 vs planning-files.mjs:618. Live: files: / '  -' / '  - src/a.rs' -> {"items":["src/a.rs"],"issues":[{"line":3,"code":"unknown-line","text":"-"}]}; with '  - ' (trailing space) -> issues:[]. git blame puts the sentence at e0e9026.
reported: Retested at 822c477. All four dash spellings now match the corrected prose: bare '-' -> unknown-line; '- ' -> empty item, no issue; '-<tab>' -> empty item, no issue; '-src/a.rs' -> unknown-line. Two stale source comments corrected too, and grammar rows pin each spelling.
severity: minor
cause: Documentation lag, downstream of items 8-11: plan-frontmatter.md:113-115 states an invariant item 11 falsifies, and the grammar statement has no rule for the three silent-read paths (no-active-key item, trailing text after a closing quote, backslash escape). It cannot be corrected until 8-11 resolve.
fix: 822c477, retest

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

### 16. Backslash escapes are detected rather than silently misread
expected: files: ["a\"b.md", "c\"d.md"] produces a diagnostic instead of issues: []. The one-element form files: ["a\"] does too - it has no trailing rest and no surviving quote, so it is the shape a trailing-content-only rule misses.
status: pass
first_pass: pass
source: verifier
evidence: planning-files.mjs:527-529 backslash arm + same-quote arm. Two-element files: ["a\"b.md", "c\"d.md"] -> items ["a\\"] + trailing-value-content AND residual-quote; one-element files: ["a\"] -> items ["a\\"] + residual-quote (was issues:[] before). Named rows: tests 40 and 42 in planning-files.test.mjs

### 17. A frontmatter path reaches plan-overlap byte-exact
expected: plan-overlap reports src/x(1) and a backtick-bearing path, each declared in two plans' files: frontmatter, as overlapping byte-exact as written - while a - **Files:** src/a.rs (edit) task line still normalizes to src/a.rs.
status: pass
first_pass: pass
source: verifier
evidence: planning-files.mjs:866-874 (:867 frontmatter verbatim, add() untouched :862-865). parsePlanFiles -> exactly ["src/x(1)","src/a.rs","src/a.rs (edit)"]. Seam: two plans each declaring src/x(1) and lib/a`b.mjs -> overlaps byte-exact as written

### 18. The residual-quote test does not fire on an in-grammar value
expected: files: ["src/it's-a-file.md"] - the spelling references/plan-frontmatter.md itself prescribes for a path with an apostrophe - returns the path with issues: [], not a permanent diagnostic. A quote inside a differently-quoted value needs no escape and is in the grammar.
status: pass
first_pass: pass
source: verifier
evidence: planning-files.mjs:528 same-quote restriction. files: ["src/it's-a-file.md"] -> {"items":["src/it's-a-file.md"],"issues":[]}. Guard row: test 39

### 19. Cross-arm: a path declared in one plan's frontmatter and another's task line still overlaps
expected: PLAN-1 declaring src/x(1) in files: frontmatter and PLAN-2 declaring it only on a - **Files:** src/x(1) task line report src/x(1) in plan-overlap's overlaps. Before the bridge this was overlaps: [] with no diagnostic - a parallel-safety gate greenlighting two plans that write one file.
status: pass
first_pass: pass
source: verifier
evidence: planning-files.mjs:871-872 dual add. Seam both directions: PLAN-1 frontmatter src/x(1) vs PLAN-2 task-line src/x(1) -> overlaps:[{files:["src/x(1)"]}]; same with lib/a`b.mjs. Tests 154/155

### 20. The new key-line codes do not fire on Cadence's own shipped plan files
expected: node cadence-core/bin/planning.mjs audit on this repo's .planning emits no frontmatter_issues key at all, proving commented-key-line and malformed-key-line do not over-fire on real plans.
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/planning.mjs audit -> keys ['ok','requirements','counts'], no frontmatter_issues. planning.mjs:473-483 walks every roadmap phase's PLAN(-N).md independently of requirement rows, so the empty-requirements cycle does not mask it. plan-overlap --phase 1 -> real correct 7-file overlap, still no frontmatter_issues

### 21. A backtick-wrapped frontmatter path is reported, not silently taken as a path
expected: files: with a block item `src/shared.rs` (backtick-wrapped) either matches a sibling plan's src/shared.rs or records a frontmatter_issues entry - it must not return {issues:[]} while never matching, which would hand plan-overlap a false overlaps: []. Known open item from the diff review; expected to FAIL until the residual test is extended to backticks.
status: pass
first_pass: fail
source: verifier
evidence: parser -> {"files":["`src/shared.rs`"],"issues":[]}; plan-overlap on PLAN-1(backtick frontmatter)/PLAN-2(plain frontmatter) -> {"ok":true,"plans":[{"files":1},{"files":1}],"overlaps":[]}, no diagnostic; identical when PLAN-2 declares it on a task line. Caution on the fix: a bare contains-a-backtick test would also fire on lib/a`b.mjs, which today overlaps correctly cross-arm - scope it to the wrapping form or accept the over-report.
reported: Retested at 822c477. plan-overlap on PLAN-1 (backtick-wrapped) vs PLAN-2 (plain) now returns frontmatter_issues:[{plan:PLAN-1.md,issues:[{line:5,code:backtick-wrapped-value}]}] instead of a bare overlaps:[] with no key - so choose_path routes sequential and the miss is no longer silent. Boundary test also covers half-wrap, wrap+punctuation, wrap+space, and the backtick id the # rule cuts to a lone backtick; lib/a`b.mjs stays diagnostic-free.
severity: major
fix: 822c477, retest

### 22. Price acceptance criterion 6's deliberate narrowing
expected: CONTEXT AC6 asks that BOTH references/plan-frontmatter.md AND workflows/audit.md state per code whether it changes counts or adds a break. What shipped: the per-code Payload table lives in the reference only (plan-frontmatter.md:161-172); workflows/audit.md:52-56 carries the general two-part rule plus a pointer. Accept the narrowing (rationale in PLAN-2.md Notes: audit.md is per-run workflow prose at zero budget headroom, and duplicating the table recreates the prose drift pass 1's UAT-11 failure was; substance proved by the per-code seam test), or ask for the literal reading with weight-budgets.json moved again.
status: pass
first_pass: pass
reported: Accept the narrowing - audit.md is per-run prose at zero headroom; duplicating the table recreates the drift UAT-11 was; substance proved by the per-code seam test.

### 23. Confirm the D-14 accepted over-read is tolerable now that it is observable
expected: requirements: / - "#41" / # files: / '  - src/shared.rs' still folds src/shared.rs into requirements and audit still mints it as orphans.plan_ids - now with a commented-key-line diagnostic beside it and choose_path routing sequential. The alternative (promoting a commented key to a terminator) would let a prose '# TODO:' comment truncate a real list. Parser behavior is verified; whether the fabricated orphan reaching audit output is tolerable operationally is a product call.
status: pass
first_pass: pass
reported: Tolerable - the goal requires it not be silent, not that it be correct outside the grammar; the alternative lets prose truncate a real list.

## Summary

total: 23
passed: 23
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 7
