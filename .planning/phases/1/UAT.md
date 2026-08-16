---
status: testing
phase: 1
fields_version: 1
started: 2026-08-16
updated: 2026-08-16
---

## Items

### 1. The transport rule lives in exactly one file
expected: cadence-core/references/conventions.md holds the rule and states the derivation test (value derived from agent output or repository content, not authored by the workflow). Converted sites cite that path; none restates the reasoning.
criterion: AC1
status: pass
first_pass: fail
source: model
evidence: grep -rn 'shell-expand|shell.expands' over cadence-core/workflows/, cadence-core/references/ and skills/, excluding references/conventions.md -> no output. Both sites now carry the citation form: execute.md:410-411 '(caller-derived text - references/conventions.md)', cad-capture/SKILL.md:43-45 '(caller-derived text - cadence-core/references/conventions.md)'. Fixed in 53c74b4.
reported: behavior wrong - the rule is stated once in conventions.md and cited by 20+ sites, but two converted sites still restate the reasoning at the site instead of citing it, which is exactly the duplication AC1 targets
severity: minor
cause: AC1 says no CONVERTED site restates the reasoning. Plan 2 read 'converted' as 'converted by this phase' and task 4 explicitly told the executor to leave execute.md's capture site untouched; both cited restatements were converted in an earlier milestone, so they fell outside that reading and were logged as an open item instead. The rule itself is correct and single-sourced at references/conventions.md:76, and this phase's own 13 conversions all cite it. What is missing is folding the two pre-existing restatements onto the same citation.
fix: 53c74b4, retest

### 2. The register is a frozen module the check reads
expected: A module under cadence-core/bin/lib/ carries one row per examined site (surface, flag, value, caller-derived classification), every out-of-scope row carrying a reason. A test pins the row count, and self-verify reads the register, not a markdown table.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: TEXT_TRANSPORT frozen, 36 rows / 20 derived / 16 reasoned, count pinned at text-transport.test.mjs:40; self-verify.mjs:168,818 imports and calls textTransportIssues on every prose surface; 26/26 module tests pass.

### 3. The check was watched failing on the real tree
expected: At the SHA where the register and check landed but the prose fix did not, the check prints a non-empty list naming real tree sites, not fixtures. SUMMARY records that SHA and the site list.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Reproduced at ca55f45 in a scratch checkout: self-verify exits 1 with 21 text-transport problems across 13 real surfaces including skills/cad-land and skills/cad-pause; no fixtures.

### 4. Every new -file flag refuses all four bad inputs
expected: For each -file flag added: missing path, empty file, unreadable path, and both inline+file forms together each return bad-args. The unreadable case names the read error. No case resolves by precedence.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: All five flags route through resolveTextFlag (planning.mjs:475,838,2859,2960,4150) and return bad-args; refusal tables at trace.test.mjs:860,879,921, planning.test.mjs:685,1002, milestone-prune.test.mjs:672; 52/52 named tests pass.

### 5. uat record --fields-file writes the same record as the inline flags
expected: --fields-file accepts a JSON object of the free-text fields and produces the record the inline flags produce for identical values, and workflows/verify.md prescribes the file form at its failing-item sites.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: planning.test.mjs:971 'writes the SAME UAT.md the five inline flags write' passes; verify.md:182,238,249 prescribe the file form at the failing-item sites.

### 6. Out-of-scope sites are untouched
expected: The seven literal cursor set --next "/cad-<command> N" sites still prescribe the inline form; no enum- or integer-validated flag (--phase, --status, --result, --severity, --origin) gained a -file variant; the check reports no problem for any of them; capture --text and its siblings still accept an inline value.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Literal /cad-* --next sites still inline (context.md:369, plan.md:374, execute.md:432, undo.md:49); no *-file variant for any enum/int flag; capture --text inline preserved; self-verify reports none of them.

### 7. The tag site uses -F and the tree is green
expected: skills/cad-land/SKILL.md prescribes git tag -a <version> -F <path>, no -m "<...>" carrying a repository-derived label remains anywhere in the tree, and both the test suite and self-verify exit 0.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-land/SKILL.md:187 uses -F <path>; only the negative fixture retains -m; self-verify exit 0 and suite 1996 pass / 0 fail / 1 skip.

### 8. Quoted path-CSV flags are outside the register with no recorded reason
expected: missing - AC2 requires sites passing workflow-constructed paths to be listed out-of-scope with their reason rather than silently omitted; --bracket-read and --payload are neither watched by TEXT_FLAGS nor present in TEXT_TRANSPORT, and the TEXT_FLAGS comment justifies only the enum/int exclusion
origin: verifier
status: pass
first_pass: fail
source: model
evidence: cadence-core/bin/lib/text-transport.mjs TEXT_FLAGS doc comment now carries a PATH-CSV FLAGS ARE EXCLUDED BY CONSTRUCTION paragraph naming --bracket-read (eight sites) and --payload (one), why their values are workflow-built rather than caller-derived, and why --read is watched without contradiction. node cadence-core/bin/self-verify.mjs -> problems: []; node --test cadence-core/bin/text-transport.test.mjs -> 17 pass 0 fail. Fixed in 2f1bbe2.
reported: missing - AC2 requires sites passing workflow-constructed paths to be listed out-of-scope with their reason rather than silently omitted; --bracket-read and --payload are neither watched by TEXT_FLAGS nor present in TEXT_TRANSPORT, and the TEXT_FLAGS comment justifies only the enum/int exclusion
severity: minor
cause: TEXT_FLAGS (lib/text-transport.mjs:98-101) watches ten FREE-TEXT flags; --bracket-read and --payload carry workflow-constructed path lists, so the scan never examines them and no register row exists for them. The D-01 comment above the array justifies only the enum/integer exclusion (--phase, --status, --result, --severity, --origin, --family, --event, --tokens) and is silent on path-CSV flags. The inconsistency the verifier names is real: --read IS watched and its workflow-constructed values carry out-of-scope rows with reasons, so the same class of value is recorded in one place and silently omitted in another.
fix: 2f1bbe2, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
