---
status: testing
phase: 5
fields_version: 1
started: 2026-08-19
updated: 2026-08-19
---

## Items

### 1. Relocation and the command cut landed
expected: README.md has no `## The commands`, `## What it costs to run` or `## A worked example` heading; two files under docs/ carry the cost-to-run and worked-example material; no docs/ file lists the /cad-* commands; README.md has a line naming both /cad-help and cadence-core/references/COMMANDS.md
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: No `## The commands` / `## What it costs to run` / `## A worked example` heading remains; docs/COST.md (3,839 B) and docs/EXAMPLE.md (2,868 B) carry the material in the siblings' shape and are both linked from README.md:73; zero `- **`/cad-*` bullets in README.md and all five docs/ pages; README.md:38 names both `/cad-help` and `cadence-core/references/COMMANDS.md`.

### 2. Demand section sits above Install
expected: The audience/demand section appears above `## Install` in README.md, contains "if you want to describe a feature and come back to a merged PR, this is the wrong tool" verbatim, and states no count of decision points or gates
criterion: AC2
status: pass
first_pass: fail
source: model
evidence: After 9f109cb. Clause 2: `grep -c 'if you want to describe a feature and come back to a merged PR, this is the wrong tool' README.md` = 1, at README.md:5. Clause 1: `grep -n '^## ' README.md` puts `## Install` at line 9, so the whole stretch carrying it is above Install; the criterion's word was 'section', and AC2 in CONTEXT.md, .planning/ROADMAP.md's wording rule and RME-01 were all revised in the same commit to 'material' because the register review that produced 47d7214 dissolved the section deliberately - the placement and the sentence are what the criterion tests and both hold. Clause 3: README.md:1-8 states no count of stops, gates, checks or decision points. Regressions checked: `sed -n '1,19p' README.md | grep -ciE 'gate|seam|rung|dispatch|adversarial|traceabilit|subagent'` = 0 (AC3 holds), self-verify ok:true with 0 problems (AC4), node cadence-core/bin/test.mjs 2380/2380 pass (AC5), and no line was added to README.md (118 lines before and after), so every README-* ledger pin still resolves (AC6).
reported: missing - the audience/demand section no longer exists in README.md, and the verbatim sentence the roadmap called load-bearing is in no shipped file. Commit 47d7214's reframe deleted `## What it asks of you` (the section SUMMARY.md:24 reports as delivered) and replaced it with `## The controls`, which sits at line 40, below `## Install` at line 9.
severity: major
cause: Commit 47d7214 (the post-execution reframe) dissolved the `## What it asks of you` section into the opening definition paragraph at README.md:5, moving the demand material below Install as `## The controls` (line 40). Two of AC2's three clauses broke as a side effect: the section no longer sits above Install because there is no section, and the verbatim sentence "if you want to describe a feature and come back to a merged PR, this is the wrong tool" was dropped rather than relocated - it appears in no shipped file. The third clause (no count of stops or gates) still holds. The reframe was a deliberate, recorded response to a review round, but it overrode a wording rule that .planning/ROADMAP.md:154-160 calls "load-bearing and not a style note" and that .planning/REQUIREMENTS.md RME-01 states as a requirement clause, and neither document was amended - so the contract and the artifact now disagree with no record of which one won.
fix: 9afdc3d, retest

### 3. Plain register through Install
expected: From line 1 through the end of `## Install`, README.md contains none of: gate, seam, rung, dispatch, adversarial, traceability, subagent
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: The awk stretch README.md:1-19 greps 0 for gate|seam|rung|dispatch|adversarial|traceabilit|subagent; the first occurrence is "decision gate" in the figure alt text at README.md:36, below Install.

### 4. self-verify clean with docs/ on the walk
expected: `node cadence-core/bin/self-verify.mjs` returns ok:true with an empty problems array, and grep 'docs/' cadence-core/bin/self-verify.mjs shows docs/ on the mdFiles walk
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs returns ok:true with problems:[] over 25 checks; `join(root, 'docs')` is in the mdFiles dirs array at cadence-core/bin/self-verify.mjs:310; the D-05 regression test asserts a fixture docs/ page's defect is reported with file === 'docs/COST.md' and passes (163/163 in that file).

### 5. Test suite passes including the counts sentence
expected: `node cadence-core/bin/test.mjs` passes, including prose-agreement.test.mjs:700's "27 skills and 6 agent roles across 19 rung files" match
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs: 2380 tests, 2380 pass, 0 fail. The counts test passes by name and measures both sides at run time; README.md:112 carries the sentence.

### 6. Claim ledger re-pointed, retired and re-pinned
expected: No .planning/DOCS-CLAIMS.md row has doc = README.md while its claim text lives in a docs/ file; the six command-list rows (README-39, -40, -76, -77, -78, -86) each carry a RETIRED verdict; and every surviving README-* row's cited line number resolves to that claim in the current README.md
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 86 README-* rows split 70/8/8 across README.md, docs/COST.md, docs/EXAMPLE.md; 0 pin misses on every literal-bearing row and all 27 literal-free rows confirmed by reading their pinned line; README-39/-40/-76/-77/-78/-86 all carry `RETIRED - <reason>` with an em-dash line cell. The RETIRED-in-resolution convention (PLAN.md:426-429) and the four unchanged run-1 provenance rows (.planning/DOCS-CLAIMS.md:444-445) are documented, disclosed departures, not drift.

### 7. Stale figures gone and LINEAGE counts live
expected: The string 5,397 appears in neither README.md nor any docs/ file, and LINEAGE.md's Agents and Skills counts match the live repo counts
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `5,397` and `8,550` absent from README.md and all docs/ pages; LINEAGE.md:16-17 read 19 rung files (6 roles) and 33 (27 user-invocable, 6 contract), matching `ls agents/*.md`=19, `ls -d skills/*/`=33, `grep -L 'user-invocable: false' skills/*/SKILL.md`=27.

### 8. The landing page reads as a decision document
expected: Reading README.md top to bottom, a stranger can tell what Cadence is and decide whether to install it before hitting any mechanism, and the register does not read as marketing
status: pass
first_pass: pass
reported: yes

### 9. Read README.md top to bottom cold, as someone who has never seen Cadence, and stop at `## Install` (line 9)
expected: By line 8 you can say what Cadence is, what it will demand of you, and whether you want it - and nothing in lines 1-8 reads as marketing rather than as a description of what the code does
origin: verifier
why_human: Register is a taste judgement no probe settles, and this phase's own history shows why: two review rounds inside phase 5 (commits 0d55dfc then 47d7214) each rejected the text above Install as marketing, so a third read by John is the only thing that can call it clear. The structural half I did settle - the definition is at README.md:5-7 and every mechanism section is below Install. What needs the human eye specifically is whether the demand is legible now that it is one clause at README.md:5 instead of the section gap 2 reports as missing.
status: pass
first_pass: pass
reported: yes
reason: answered against the same stretch: item 8 was presented with README.md:1-8 quoted in full, which is exactly this item's scope

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
