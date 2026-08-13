---
status: testing
phase: 3
fields_version: 1
started: 2026-08-13
updated: 2026-08-13
---

## Items

### 1. Lean-posture reference is registered and read
expected: cadence-core/bin/lib/deferred-reads.mjs carries a register row for the new lean-posture reference file, skills/cad-executor-contract/SKILL.md names that file in a Read at the step the row anchors, and node cadence-core/bin/self-verify.mjs reports no deferred-read-unread, no budget-overrun and no unbudgeted-surface.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: deferred-reads.mjs:231-236 row (anchors ['1']) + cad-executor-contract SKILL.md:22-25 step-1 Read of references/lean-build.md; `node cadence-core/bin/self-verify.mjs` -> problems:[] across all 20 checks (no deferred-read-unread, no budget-overrun, no unbudgeted-surface); weight-budgets.json:33 = 3089 = measured.

### 2. Declined fuller option routes to Open items
expected: The executor contract's deviation rules state that a declined fuller option is recorded as an `Open items:` line, its return digest is still exactly five fields, and node --test cadence-core/bin/prose-agreement.test.mjs is green.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: cad-executor-contract SKILL.md <deviation_rules>: a declined fuller shape is 'one `Open items:` line ... never a `[deviation]` line'; <report> still 'exactly these five fields' and forbids a sixth; `node --test cadence-core/bin/*.test.mjs` -> 1420 pass, 0 fail (prose-agreement.test.mjs included).

### 3. Minimalism command added no role and no trigger
expected: cadence-core/route-table.json's roles array still holds six entries and cadence-core/config.schema.json has no `minimalism` review trigger.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: route-table.json roles array length 6 (unchanged six names); `grep -n minimalism cadence-core/config.schema.json` -> no match; no agents/ rung file added (19 rung files).

### 4. Minimalism command run returns a delete-list and writes nothing
expected: A /cad-minimalism-review run against a named target returns a ranked delete-list in the reviewer findings shape, and `git status --short` is byte-identical before and after the run. (human-verify: needs a walked minimalism-command run)
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Walked workflows/minimalism-review.md end-to-end (branch-only skill; installed plugin is 3.0.0). resolve_target: phase number 3 -> the range SUMMARY.md:57 records, f98c0c4..58a3d3b, both refs verified present; target NAMED in the run. dispatch: bracket opened via `trace append --phase 3 --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --read f98c0c4..58a3d3b` (corr 3-f98c0c4), then ONE base cad-reviewer dispatch at the session default with the four-species instruction and the target as a REFERENCE not bytes; no routing cell resolved, no tier/effort read. Returned {findings:[...]} in the shared {file,line,severity,claim,failure_scenario} schema, 11 entries ranked by severity - 1 blocker (references/lean-build.md as a one-consult-site indirection whose two load-bearing statements are already at the consult site), 3 high (workflows/suggest.md split, cad-capture --cadence metadata fields, cad-minimalism-review SKILL.md restating its own inlined workflow), 4 medium, 3 low. Bracket closed as `return` with --tokens 78788. APPLIES NOTHING confirmed: `git status --short` md5 bba4bd9fd82aab10767a6e6e49d04660 immediately before the dispatch and immediately after, and `diff` of the two listings is empty. .planning/trace.jsonl is gitignored (trace ignore --check -> ignored:true, tracked:false), so the bracket writes do not perturb the comparison.

### 5. Cadence-directed capture lands outside the host project
expected: A /cad-capture --cadence run from inside a host project appends an entry naming the host project and the provoking command to the global Cadence queue, and the host repo's .planning/CAPTURE.md and `git status --short` are both unchanged. (human-verify: needs a walked /cad-capture run from a host project)
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: Walked skills/cad-capture/SKILL.md step 5 from inside host project /data/code/axel (origin git@github.com:HaseebKhalid1507/axel.git), a non-Cadence repo. QUEUE: CADENCE_GLOBAL_CONFIG unset -> ~/.claude/cadence/CAPTURE.md, absent, created with step 2's three headings (## Todos, ## Seeds, ## Notes). Not under CLAUDE_PLUGIN_ROOT. ENTRY appended under ## Notes as '- 2026-08-13 <text> (host: git@github.com:HaseebKhalid1507/axel.git, command: /cad-context)' - both mechanically-known fields present, host resolved via `git remote get-url origin` (first arm), no phase tag, and nothing quoted out of the host tree. HOST UNCHANGED: `git status --short | md5sum` = 8fa5bc8dc6a97ef9b15eb54cc6343c0b before AND after; .planning/CAPTURE.md absent before and after; HEAD still f373cd2, no commit made (rail a). Rail b: nothing transmitted. Global dir is not a working tree - `git rev-parse --show-toplevel` there -> 'fatal: not a git repository', so step 4 structurally cannot run. No .planning/ fallback taken (rail c not exercised; the directory resolved).

### 6. Both prose cuts landed with their keeps and re-pins
expected: skills/cad-land/SKILL.md states the git.auto_close mechanic once with its <guardrails> block no longer restating it, while the no-preselected-default sentence and the not-scoped-to-GitHub clause both survive verbatim; skills/cad-executor-contract/SKILL.md states the static-analysis carve-out once with a pointer to <deviation_rules>; both weight-budgets.json rows equal the measured byte counts in the same commit; and node cadence-core/bin/self-verify.mjs is green with no deferred-read-unread.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: d2c6544 and a87c1ee each touch their SKILL.md plus weight-budgets.json only; guardrails re-derivation and step-3 carve-out duplicate both deleted and replaced by pointers; diff of cad-land:110-118 vs f98c0c4 empty (GitHub-arm clause verbatim), no-preselected-default text intact at :79-80 and :198; weight.mjs 12041/10718 equals weight-budgets.json:92/:89; self-verify problems:[].

### 7. /cad-suggest presents figures and writes no config
expected: /cad-suggest on this repo's own trace presents each recommendation with the trace figures behind it and names its /cad-config key, and leaves .planning/config.json and the global Cadence config byte-identical. (human-verify: needs a walked /cad-suggest run)
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: Walked workflows/suggest.md end-to-end from the checkout (branch-only skill; installed plugin is 3.0.0). Scope step: no argument -> whole record. read_record: `planning.mjs trace suggest` -> ok:true, scope all, events_read 286. present: 3 kind:suggest entries, each carrying the seam's verbatim evidence AND its config key - cad-executor '3 checkpoint return(s) - plans may exceed one context' -> workflow.max_plan_tasks; cad-plan-checker '2 of 10 resolves climbed to the retry rung' -> model.effort.cad-plan-checker; cad-planner '3 of 16 resolves climbed to the retry rung' -> model.effort.cad-planner. Plus 4 kind:info receipt lines (cad-assumptions-analyzer, cad-executor largest spend 2,078,894 of 5,157,953 tokens (40%), cad-reviewer, cad-verifier). No capped/malformed. Figures relayed unchanged including D-15's known resolve-denominated artifact (cad-reviewer '21 resolves, 0 escalations' under a cross-model-only reviewer config). Read-only confirmed by md5sum before and after: .planning/config.json 0944850f9baf13ad10e8e15649ce144a both times, ~/.claude/cadence/config.json f83af8d0a35708775971dd0ce56eef91 both times.

### 8. /cad-suggest refuses a thin trace in one line
expected: Run against a .planning/ whose trace is absent or below the evidence floors, /cad-suggest emits exactly one refusal line and zero suggestions. (human-verify: needs a walked /cad-suggest run)
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: Walked workflows/suggest.md thin_record step, both discriminated cases, against scratch .planning/ dirs. Case A (trace file absent): `trace suggest --dir <scratch>/thin-a/.planning` -> {ok:true, scope:'all', events_read:0, suggestions:[]} -> the events_read:0 arm, ONE line ('the record holds no events in the scope read'), zero suggestions. Case B (one routing/resolve event, below every floor): `trace suggest --dir <scratch>/thin-b/.planning` -> {ok:true, scope:'all', events_read:1, suggestions:[]} -> the non-zero arm, ONE line naming 1 event read and none clearing the floors, zero suggestions. The two arms are distinct as D-13 requires, the discriminator is events_read alone, and no floor figure is stated in either - the envelope returns none. No 'no trace' claim on case B.

### 9. /cad-suggest is registered and is the one statement of the rules
expected: /cad-suggest appears in cadence-core/references/COMMANDS.md, README.md and .planning/DOCS-CLAIMS.md, and cadence-core/workflows/milestone.md step 8 plus cadence-core/workflows/report.md's closing pointer both point at cadence-core/workflows/suggest.md instead of restating the presentation rules.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: COMMANDS.md:53 (help registration via cad-help's @-include), README.md:128, DOCS-CLAIMS.md:235 README-39 re-pinned 105-130 and :240 README-44 corrected to 27 skills (independently measured 27 skills / 19 rung files); milestone.md:155-162 invokes /cad-suggest and no longer calls the seam or restates the rules, report.md:68-69 points at workflows/suggest.md.

### 10. ROADMAP phase-3 criterion 1 still names a record shape the shipped contract forbids
expected: behavior wrong - documentation contract disagrees with the code it governs. .planning/ROADMAP.md criterion 1 says the executor 'records the fuller option in its deviation record'; skills/cad-executor-contract/SKILL.md routes it to `Open items:` and says 'never a `[deviation]` line'. The gate that reads that criterion therefore reads it against a contract that cannot satisfy it as worded.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after 026aafe. `grep -c 'deviation record' .planning/ROADMAP.md` -> 0. Criterion 1 now reads 'records the fuller option as an `Open items:` line in its report file', the same wording REQUIREMENTS.md MIN-01 carries and the shape skills/cad-executor-contract/SKILL.md <deviation_rules> actually implements. The gate and the contract agree.
reported: behavior wrong - documentation contract disagrees with the code it governs. .planning/ROADMAP.md criterion 1 says the executor 'records the fuller option in its deviation record'; skills/cad-executor-contract/SKILL.md routes it to `Open items:` and says 'never a `[deviation]` line'. The gate that reads that criterion therefore reads it against a contract that cannot satisfy it as worded.
severity: minor
cause: ROADMAP.md:76 was authored before D-02 settled the record shape. The CONTEXT flagged it explicitly ('the roadmap was left alone because this workflow edits at most one REQUIREMENTS row') and spent that one edit on REQUIREMENTS.md:21, which now reads the Open-items wording. ROADMAP.md:76 is the lone stale surface; nothing in the shipped code is wrong. Fix is a one-line reword of criterion 1.
fix: 026aafe, retest

### 11. /cad-capture --cadence is undiscoverable on every surface a user reads
expected: unwired at the documentation layer - the arm exists and is specified in skills/cad-capture/SKILL.md step 5, but the reference table that IS the /cad-help registration, the README command list and the claim ledger all still describe only the project-directed arm, so the loop the goal names ('friction found on somebody else's project reaches Cadence') depends on a flag nobody is told about.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after bd231ec. COMMANDS.md:48 signature is now `/cad-capture [todo|seed|note] <text> [--cadence]` and its cell describes the Cadence-queue arm - that row IS the /cad-help registration via cad-help's @-include. README.md:124 names --cadence in the Support bullet. weight-budgets.json COMMANDS.md row re-pinned 4771 -> 4890 in the same commit; `node cadence-core/bin/self-verify.mjs` -> problems:[] (no budget-overrun, no unbudgeted-surface). DOCS-CLAIMS.md deliberately unchanged: the README edit is one line for one so no ledgered row shifts and README-39 still covers 105-130, and the ledger's own doctrine (DOCS-CLAIMS.md:143-145) is that it holds run-1 provenance while new claims are extracted by the next /cad-docs-verify run rather than hand-added.
reported: unwired at the documentation layer - the arm exists and is specified in skills/cad-capture/SKILL.md step 5, but the reference table that IS the /cad-help registration, the README command list and the claim ledger all still describe only the project-directed arm, so the loop the goal names ('friction found on somebody else's project reaches Cadence') depends on a flag nobody is told about.
severity: minor
cause: The CONTEXT scope boundary named the registration surfaces for this phase's two NEW commands only ('/cad-suggest and the minimalism command in cadence-core/references/COMMANDS.md ... README.md'). A new ARM on an existing command fell outside that sentence, so no plan task registered it. Confirmed: COMMANDS.md:48's /cad-capture row and README.md:124's bullet both describe only the project-directed arm, and grep -c capture .planning/DOCS-CLAIMS.md -> 0, so the ledger has no cad-capture row at all. COMMANDS.md is pinned at 4771 = its measured size, so any added text needs a same-commit re-pin.
fix: bd231ec, retest

### 12. The minimalism-review dispatch bracket is watched by no per-file assertion
expected: missing test coverage on a new dispatch site. cadence-core/bin/trace.test.mjs's BRACKETING map carries a row for every other prose file that dispatches a worker, and none for cadence-core/workflows/minimalism-review.md, so its dispatch/return pair can be edited away with the suite still green.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after ae34519. cadence-core/bin/trace.test.mjs:736 now carries [join('cadence-core','workflows','minimalism-review.md'), 1] in the BRACKETING map (8 rows). `node --test cadence-core/bin/trace.test.mjs` -> 59 pass, 0 fail, so the asserted count matches the bracket pair the workflow actually writes. Full suite `node --test cadence-core/bin/*.test.mjs` -> 1420 pass, 0 fail.
reported: missing test coverage on a new dispatch site. cadence-core/bin/trace.test.mjs's BRACKETING map carries a row for every other prose file that dispatches a worker, and none for cadence-core/workflows/minimalism-review.md, so its dispatch/return pair can be edited away with the suite still green.
severity: minor
cause: PLAN-2's files: lease did not declare cadence-core/bin/trace.test.mjs, and the SUMMARY records adding the row as 'outside plan 2's lease'. The BRACKETING map at trace.test.mjs:729-737 holds 7 rows and the comment at :726-727 states the rule the omission breaks - 'A file absent from this map is checked by nothing, so the row travels with the prose'. minimalism-review.md does write both bracket halves today (walked in item 4, corr 3-f98c0c4); nothing asserts it keeps them. Fix is one map entry: [join('cadence-core','workflows','minimalism-review.md'), 1].
fix: ae34519, retest

## Summary

total: 12
passed: 12
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 3
