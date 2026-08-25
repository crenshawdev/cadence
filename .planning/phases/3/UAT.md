---
status: testing
phase: 3
fields_version: 1
started: 2026-08-25
updated: 2026-08-25
---

## Items

### 1. Unfixed set comes from the structured payload
expected: filing-decision.test.mjs passes: a payload with one survived blocker, one downgraded high and one survived low returns exactly the non-survivors; when prose and payload disagree the payload's claim wins.
status: pass
first_pass: pass
source: verifier
evidence: lib/filing-decision.mjs:74-81 filters on (ruling, severity) off buildEntries; filing-decision.test.mjs passes 'a survived blocker stays behind; a downgraded high and a survived low are the set' and 'the payload and a prose fixture disagree, and the answer is the payload'.

### 2. Fingerprint is (file, claim) and ignores line
expected: Two findings differing only in `line` share one fingerprint; two differing in `claim` do not.
status: pass
first_pass: pass
source: verifier
evidence: lib/filing-decision.mjs:133-140 digests file NUL claim only; passes 'two findings differing only in LINE share one fingerprint', 'two findings differing in CLAIM do not', 'the NUL join cannot be forged by moving the boundary'.

### 3. One pinned create and lookup argv per forge
expected: filing-decision.test.mjs pins the exact create and lookup argv arrays for tea, gh and glab (the glab create vector carries -y).
status: pass
first_pass: pass
source: verifier
evidence: FILING_TABLE at lib/filing-decision.mjs:375-419; all three vector pairs pinned exactly by filing-decision.test.mjs, gitlab create carrying -y; DECLINE_LABEL frozen at :158.

### 4. One lookup call per fire, whatever the finding count
expected: issue-filing.test.mjs: a five-finding fire makes exactly ONE list call, and a finding already filed is absent from `unfixed`'s answer.
status: pass
first_pass: pass
source: verifier
evidence: issue-filing.mjs:269 calls readDeclines once outside the loop; issue-filing.test.mjs 'a five-finding fire makes exactly ONE list call and no create call' and 'a finding the lookup already carries is absent from the answer'.

### 5. An incomplete decline lookup refuses the fire
expected: A lookup response filling the page returns ok:false naming the incomplete read and makes NO create call.
status: pass
first_pass: pass
source: verifier
evidence: normalizeDeclines refuses at `parsed.length >= limit` (filing-decision.mjs:303); issue-filing.mjs:225-231 emits 'incomplete-lookup'; passes 'a response of exactly the page size is INCOMPLETE' and 'a lookup that filled its page refuses, and no create call is made'.

### 6. A write that does not land refuses instead of dropping
expected: Auth failure / unreachable tracker returns a refusal naming what could not be filed and why; the finding is never silently dropped or parked in CAPTURE.
status: pass
first_pass: pass
source: verifier
evidence: issue-filing.mjs:424-487 'create-failed' carries filed/unfiled, the mirror result and an ambiguous-create warning; passes 'a create exiting nonzero refuses and NAMES the findings that were not filed' and 'a create failure whose mirror ALSO failed says so'.

### 7. A filed finding stays reachable by recall
expected: planning.mjs recall surfaces a FILED.md bullet with source naming FILED.md; with the file absent the corpus is byte-identical; `file` over 3 accepts + 2 declines writes exactly THREE bullets.
status: pass
first_pass: pass
source: verifier
evidence: Traced one value end to end: `issue-filing.mjs file` (stub gh) -> fingerprint 56d89f78cae9c56e -> a single FILED.md row (declined entry absent) -> `planning.mjs recall` returned score 0.863 source FILED.md. Wired at lib/planning-files.mjs:1279-1320 and planning/recall.mjs:165-166.

### 8. The gate asks once, in the step that decided
expected: triage-gate.md carries `## What happens to a finding this fire will not fix`, naming ONE `unfixed` call and ONE `file` call per fire and forbidding a per-finding prompt; self-verify and prose-agreement/seam-calls pass.
status: pass
first_pass: pass
source: verifier
evidence: references/triage-gate.md:244, pointed at from :43 (blocking) and :235 (adjudicated); one `unfixed` call at :256, one `file` call at :284, per-finding prompting forbidden at :267-271; issue-filing.mjs has no CAPTURE.md write and a live `file` run created none; self-verify problems [].

### 9. The tree stops claiming glab is absent, and names no host
expected: grep for the old 'glab is absent' comment returns nothing, issue-decision.mjs names glab 1.114.0 with its measurement date, and `jcrenshaw` appears nowhere in cadence-core/ outside tests, fixtures and pre-existing comments.
status: pass
first_pass: pass
source: verifier
evidence: 'glab is absent' greps to nothing; lib/issue-decision.mjs:39-41 records /usr/bin/glab 1.114.0 dated 2026-08-25; the six surviving `jcrenshaw` hits are comments in self-verify.mjs, redact-url.mjs and forge-decision.mjs whose commits are all ancestors of the phase base b157ccdc.

### 10. The refusal vocabulary is pinned forward
expected: reason-census.test.mjs passes on the live tree; deleting a token still passes, renaming a refusal's token under cadence-core/bin/ FAILS naming that token.
status: pass
first_pass: pass
source: verifier
evidence: reason-census.test.mjs green on the live tree, one-directional by construction with the derivation method stated (266 sites / 104 distinct / 82 literal, re-derived).

### 11. Live forge filing against tea, gh and glab
expected: (human-verify: needs authenticated tea/gh/glab scratch repos) A gate-driven blocking fire ASKS from inside the fire; five findings produce ONE ask step; three issues land without the decline label and two with it; a second fire with the same fingerprint does not re-ask.
status: skipped
reported: skip
reason: Deferred by the user during execution (plan 1 task 8). Needs authenticated tea/gh/glab against three operator-owned scratch repos and live network writes; this repository sets no git.forge_provider/git.forge_repo, so issue-filing.mjs unfixed answers no-forge. Procedure at .planning/phases/3/live-forge-check.md.

### 12. The walked queue reading counts substantive bullets
expected: capture-health.test.mjs: the exact EMPTY_CAPTURE string counts ZERO substantive bullets; `- None.` plus one real bullet counts one; `- [x]` counts; indented continuations and `* ` lines do not.
status: pass
first_pass: pass
source: verifier
evidence: capture-health.test.mjs imports the real EMPTY_CAPTURE and passes 'a freshly created queue counts ZERO substantive bullets', 'a checked bullet counts, and a continuation line and a `* ` line do not', and the fenced-heading/CRLF case.

### 13. An annotated bullet is reported, an unannotated one is not
expected: A `KEPT <date>, re-verified...` bullet and a `recorded not fixed` bullet are each returned with section and line; a plain bullet is not. Proved by fixture, not against the live file.
status: pass
first_pass: pass
source: verifier
evidence: Two annotation shapes in lib/capture-health.mjs; proved by fixture in capture-health.test.mjs and planning-capture-check.test.mjs, not against the live file, which carries annotations [].

### 14. capture-check is the one command both readers use
expected: planning-capture-check.test.mjs: EMPTY_CAPTURE tree reports zero/no annotations/no archive; a tree with three bullets, two annotated and a `## Archive` reports 3, the two annotation line numbers and the archive heading; absent CAPTURE.md is ok:true empty; unreadable is ok:false with reason and hint.
status: pass
first_pass: pass
source: verifier
evidence: Registered at planning.mjs:312, declared at lib/arg-contract.mjs:921, invoked at skills/cad-health/SKILL.md:43, and phase-done.mjs:14 imports the same captureHealth core; all eight planning-capture-check.test.mjs arms pass.

### 15. The configured bound fails loud and refuses nothing
expected: Bound 2 with three bullets reports the crossing naming 3 and 2 and STILL returns ok:true; the same tree at bound 4 reports no crossing. self-verify reports zero problems (reach row, catalog row, budgets).
status: pass
first_pass: pass
source: verifier
evidence: config.schema.json:60 (int, min 1, default 40), config-reach.md:150, config-catalog.md:56; self-verify problems []; passes 'a queue over its bound is REPORTED, with both numbers, and refuses nothing' and the under-bound twin.

### 16. Phase close asserts the queue is empty
expected: planning-phase-done.test.mjs: closing with two substantive bullets returns ok:true, flips the roadmap box, and NAMES both items; EMPTY_CAPTURE names none; absent CAPTURE.md closes cleanly; --undo carries no such field.
status: pass
first_pass: pass
source: verifier
evidence: phase-done.mjs:128 reads before runTransition, :200 rides `capture` on the close arm only; all five planning-phase-done.test.mjs queue arms pass including the --undo case.

### 17. /cad-health prints the capture verdict
expected: Running the capture step of /cad-health against this repository prints the substantive count and the bound, with no annotation or archive line.
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-health/SKILL.md:40-70 names the three prints and forbids filtering; the live envelope on this repository is {substantive:37, bound:40, over_bound:false, annotations:[], archive.present:false}, the count and bound with no annotation or archive line.

### 18. `## Archive` is out of the CAPTURE contract
expected: grep for `## Archive` in capture-grammar.md returns only lines saying the heading is NOT part of this file and is reported when present - no sections-table row, no milestone-close instruction to move bullets into it.
status: pass
first_pass: pass
source: verifier
evidence: One `Archive` line in references/capture-grammar.md (:44), saying the heading is NOT part of the file and is reported - no sections-table row, no milestone-close instruction; .planning/ARCHIVE.md still written by milestone-prune.mjs:160 and read by recall.mjs:111.

### 19. The whole suite is green
expected: node cadence-core/bin/test.mjs runs every group green, npx tsc -p tsconfig.ci.json exits 0, and self-verify.mjs reports problems [].
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/test.mjs` -> tests 3199, pass 3199, fail 0. `npx tsc -p tsconfig.ci.json` exit 0. `node cadence-core/bin/self-verify.mjs` -> problems [] across all 26 checks. No unreferenced debt marker in any of the 30 files touched by b157ccdc..0169ef62.

### 20. The phase-summary step still routes open items into the file this phase declared transient
expected: behavior wrong - the goal's third clause ('nothing durable is ever routed into it') is contradicted inside the shipped tree, and the queue is observably accumulating
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: cadence-core/workflows/execute.md:446-457 instructs 'File each open item into `.planning/CAPTURE.md` through the seam, one call per item' at the phase SUMMARY step, unchanged by this phase and in neither plan's lease. cadence-core/workflows/verify.md:315-325 then has phase-done assert the same queue is empty, so the workflow that closes a phase fills the queue the close reports on. Measured: `node cadence-core/bin/planning.mjs capture-check` on this repository returns substantive 37 (Todos 28, Seeds 9, Notes 0) against bound 40, where .planning/phases/3/SUMMARY.md's goal check records 30 measured the same day (2026-08-25). Nothing in the phase drains the queue, and CAPTURE.md is untracked here so the growth is not even reviewable in git.
reported: behavior wrong - the goal's third clause ('nothing durable is ever routed into it') is contradicted inside the shipped tree, and the queue is observably accumulating
severity: major
cause: `cadence-core/workflows/execute.md:446-457` still instructs the phase-SUMMARY step to file each open item into `.planning/CAPTURE.md` one seam call at a time, and that file was in neither PLAN-1's nor PLAN-2's lease so nothing in this phase touched it. The phase built the ask that files a DECLINED GATE FINDING on the tracker, but left the OTHER durable writer of CAPTURE.md - the phase close's own summary step - intact. Confirmed live: `capture-check` on this tree returns substantive 37 (Todos 28, Seeds 9) against bound 40, up from the 30 SUMMARY.md measured the same day, so the queue is observably still accumulating.
fix: routed to /cad-plan

### 21. ROADMAP criterion 1 and criterion 11 disagree about what happens to a declined finding, and the code follows 11
expected: behavior wrong against criterion 1 as written - a declined finding IS filed as a labeled issue rather than dropped
origin: verifier
status: pass
first_pass: fail
source: model
evidence: `grep -n "are DROPPED\|no artifact anywhere holds a declined" .planning/ROADMAP.md` -> exit 1, no match. ROADMAP.md:172-178 now reads "a declined finding is filed too, carrying the decline label, because that labelled issue is the ONLY thing that stops a later fire asking about it again (criterion 11)", and its verification asks for the declined issue on the tracker carrying the label and absent from `.planning/FILED.md`. That is exactly what issue-filing.mjs:421-423 does. Fixed in c7e16ddf.
reported: behavior wrong against criterion 1 as written - a declined finding IS filed as a labeled issue rather than dropped
severity: minor
cause: ROADMAP criterion 1 was written before criterion 11 settled the decline mechanism, and was never reconciled with it. Criterion 11 makes the filed, LABELLED issue the thing that stops a later fire re-asking, which requires the declined finding to persist as an artifact; criterion 1's 'declined findings are DROPPED / no artifact anywhere holds a declined one' contradicts that directly. The code implements 11 (`issue-filing.mjs:421-423` creates an issue for every entry, `declined` only setting the label), so the defect is in the criterion text, not the implementation. The CAPTURE-byte-unchanged half of criterion 1 does hold.
fix: c7e16ddf, retest

### 22. Live forge filing against tea, gh and glab (plan 1 task 8, still deferred)
expected: One gate-driven blocking fire on three operator-owned scratch repos asks from inside the fire; five findings produce ONE ask step; three issues land without the decline label and two with it; a second fire carrying the same fingerprints does not re-ask; and the open ROADMAP question is settled - whether the `cadence-declined` label must pre-exist or each forge creates it on the create call.
origin: verifier
why_human: Out of reach, not merely unexercised: it needs authenticated tea/gh/glab credentials against three real scratch repositories and live network writes, all of which this pass is forbidden to touch. It also cannot be run on this repository at all - .planning/config.json carries only `git.auto_close`, and `issue-filing.mjs unfixed` against a valid adjudication payload returns {"ok":false,"reason":"no-forge","detail":"...git.forge_provider, git.forge_repo are unset"}, so every argv in FILING_TABLE is currently proved against PATH-injected stubs only. The procedure and the per-forge argv at this commit are at .planning/phases/3/live-forge-check.md, uncommitted.
status: skipped
reported: skip
reason: Deferred by the user during execution (plan 1 task 8). Needs authenticated tea/gh/glab against three operator-owned scratch repos and live network writes; this repository sets no git.forge_provider/git.forge_repo, so issue-filing.mjs unfixed answers no-forge. Procedure at .planning/phases/3/live-forge-check.md.

## Summary

total: 22
passed: 19
failed: 1
pending: 0
skipped: 2
blocked: 0
reworked: 2
