---
status: testing
phase: 1
fields_version: 1
started: 2026-08-01
updated: 2026-08-01
---

## Items

### 1. One file as both layers merges once
expected: With a config file resolving as BOTH layers (identical path, symlink, or relative-vs-absolute spelling), `config.mjs get` reports a SINGLE layer in `source` (not `global+repo`), and a broken such file produces exactly ONE parse warning instead of two.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: config-merge.mjs:148-152 gates readLayer(GLOBAL_CONFIG) off when shared; label at :171-174. Live probes (CADENCE_GLOBAL_CONFIG fixtures per D-07): symlink alias -> {"source":"repo"}; relative and .. spellings -> "repo"; shared broken file -> 1 warning; two different files -> "global+repo" with 2 warnings. Severance: pre-phase config-merge.mjs (b8d200e~1) fails 4 rows including 'get --global: the one file it reads' (actual 'global+repo', expected 'global').

### 2. A global-layer risk waiver is named on the get face
expected: With `risk.override.<surface>` present only in the global layer, `config.mjs get` returns the merged value AND a warning naming that key as repo-scoped, while `route.mjs resolve` still ignores it - both read faces report the same situation.
criterion: AC2
status: pass
first_pass: fail
source: verifier
evidence: config.mjs:298-303 filters Boolean(v) and emits one fixed string per key. Global layer {"risk":{"override":{"athu":true,"auth":"yes"}}}: get -> two 'write it to this repo's own .planning/config.json' warnings; route.mjs resolve -> 'risk.override.athu names no declared risk surface' and 'risk.override.auth="yes" is not true or false'; config.mjs check refuses both. Adjudicated high (REVIEW-diff-plan-1.md:23, CS#1+OA#3), unfixed - no commit after f452f80 touches config.mjs.
reported: get's new warning is shape-blind, so for an undeclared surface or a non-boolean value it hands out the exact remediation config.mjs set/check refuses, and the two read faces emit contradictory diagnostics for one input. This is the CAPTURE.md:166 defect task 4 removed from route.mjs, re-created on the get face by task 3.
severity: major
fix: 84f0816, retest

### 3. Global config pointed at the repo config honours the waiver
expected: With `CADENCE_GLOBAL_CONFIG` pointed at the repo config, the waiver is honoured and `route.mjs resolve` emits NO `IGNORED ... waives nothing here` warning.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: route.mjs resolve --role cad-executor --file <cfg> --phase 9 with CADENCE_GLOBAL_CONFIG=<cfg> -> stakes: solo, warnings: undefined, reason carries config:repo, floor entry 'waived by risk.override.auth'; identical through a symlink. Severance: route.test.mjs:963 and the symlink row both fail against the pre-phase merge lib.

### 4. A valueless --file is diagnosed, not crashed on
expected: `node cadence-core/bin/config.mjs set stakes=solo --file` (flag value missing) returns a named diagnostic rather than `{"ok":false,"reason":"internal"}` carrying a Node type error.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: config.mjs {set stakes=solo,get,validate} --file all return {"ok":false,"reason":"usage","detail":"--file needs a path after it: --file <config file> (or --global)"}, no Node type text. Guard at config.mjs:350, fsIdentity made total at :218-223. (The quoted spelling --file "" is a distinct input, tracked as its own gap.)

### 5. Reach parser reports duplicates and reads the universal sentinel
expected: A duplicate reach row emits an issue rather than being silently dropped, and reach cells `Universal` and `universal.` normalize rather than emitting `unstated-reach`.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Duplicate row -> [{"code":"duplicate-reach-row","detail":"stakes: line 6 repeats the row declared on line 5..."}] with first-occurrence-wins intact; Universal, universal., UNIVERSAL, Universal. -> reachIssues returns []; a narrow phrase absent from the purpose still returns unstated-reach. lib/config-reach.mjs:52-54,119-126; wired at self-verify.mjs:788-799; pinned by self-verify.test.mjs:1009,1030.

### 6. The narrowed reach phrase lands in all eight rows and the schema
expected: The eight `risk.override.*` reach rows read the narrowed phrase, all eight `purpose` strings in `config.schema.json` carry it verbatim, `node cadence-core/bin/self-verify.mjs` stays `ok:true`, and the SUMMARY names each of the seven roster items (D-03) individually with the test that pins it.
criterion: AC6
status: pass
first_pass: fail
source: verifier
evidence: references/config-reach.md:108-115 all read 'repo config layer only'; all 8 schema purposes carry it verbatim; self-verify.mjs -> ok:true, problems:[]; coupling has teeth (self-verify.test.mjs:1050 reports unstated-reach when a purpose omits the phrase). Missing artifact: .planning/phases/1/SUMMARY.md.
reported: The code/doc half is verified, but AC6's SUMMARY clause cannot be satisfied: .planning/phases/1/SUMMARY.md does not exist, so no roster of the seven D-03 items with their pinning tests has been written. Roster status if one were written: 6 of 7 items have a pinning test (:165,:166,:168,:169,:170,:171); :164 is half closed - validate --global on a file holding risk.override.auth:true still returns ok:true while set --global refuses the same write (recorded at CAPTURE.md:189, commit a249232).
severity: major
fix: SUMMARY.md written, retest

### 7. Every consuming seam agrees with config.mjs get
expected: For each of the seven seams (`git-guard`, `git-branch`, `land-cleanup`, `git-publish`, `route`, `planning`, `review-provider`) a test reads one key that seam actually reads and asserts agreement with `config.mjs get`, with `git-publish`'s and `route.mjs`'s repo-layer narrowings encoded as expected rather than as equality.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: config-seams.test.mjs (576 lines, 12 arms, 12 pass): route/stakes :187, git-branch/git.integration_branch :220, land-cleanup/git.base_branch :257+:284, git-guard/git.on_protected :315, git-publish/git.auto_close narrowing :350, git-publish/git.protected_branches equality :392, route/risk.override.auth narrowing :420, planning/memory.backend :448, review-provider/review.max_prompt_tokens :512,:562, merge precedence :547. Severance: 11 mutations in isolated copies, every arm fails when the read it pins is cut; widening repoAutoClose to the merged value fails the git-publish arm, widening riskOverridesIn(layers.repo) fails the route arm, inverting deepMerge precedence fails 3. Hermetic per D-07/D-08: subprocesses only.

### 8. Phase gate: tests, types, and budgets clean
expected: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json` both exit 0, and `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no budget overrun on any surface this phase edits.
criterion: AC8
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 1172 / pass 1172 / fail 0, exit 0 (baseline 1138). npx tsc -p tsconfig.ci.json -> exit 0. self-verify.mjs -> {"ok":true,...,"problems":[]}. Budgets: references/config-reach.md has no weight-budgets.json entry (D-11 confirmed), workflows/config.md untouched at 18168 = its budget.

### 9. A quoted empty --file still answers ok:true about the user-global layer
expected: The valueless---file guard tests tokens[i + 1] === undefined only, so --file "$VAR" on an unset variable (the quoted spelling of the input AC4 fixes) falls through and get performs a full effective read of the user-global layer as if it were the file the caller named. Worse than the case AC4 closed: that one is loud, this one is a silent wrong answer.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: config.mjs:350. CADENCE_GLOBAL_CONFIG=<file holding risk.override.auth:true> config.mjs get --file "" stakes risk.override.auth -> {"ok":true,"values":{"stakes":"shipped","risk.override.auth":true},"source":"global"}, exit 0. Adjudicated CS#3 medium, unfixed.
reported: The valueless---file guard tests tokens[i + 1] === undefined only, so --file "$VAR" on an unset variable (the quoted spelling of the input AC4 fixes) falls through and get performs a full effective read of the user-global layer as if it were the file the caller named. Worse than the case AC4 closed: that one is loud, this one is a silent wrong answer.
severity: major
fix: 130c696, retest

### 10. route.mjs's own valueless --file still degrades to reason:"internal"
expected: AC4's fix landed in config.mjs only; route.mjs's parseArgs still does o.file = a[++i] unguarded, and dirname(undefined) escapes as a raw Node error.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: route.mjs:480. route.mjs resolve --role cad-executor --file -> {"ok":false,"reason":"internal","detail":"The \"path\" argument must be of type string. Received undefined"}. Adjudicated CS#4 low, unfixed.
reported: AC4's fix landed in config.mjs only; route.mjs's parseArgs still does o.file = a[++i] unguarded, and dirname(undefined) escapes as a raw Node error.
severity: minor
fix: 4f40641, retest

### 11. Sixteen shipped surfaces assert a global waiver is always ignored and named
expected: All 8 schema purpose strings and all 8 reach rows end with the unconditional claim that a user-global waiver 'is ignored and named in the resolver's warnings', which this phase's own AC3 collapse makes false whenever the two layer paths resolve to one file.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: config.schema.json (the 8 risk.override.* purposes) and references/config-reach.md:108-115; contradicted by the AC3 probe and by route.test.mjs's own row 'the global env pointed AT the repo config: one layer, waiver honoured, nothing IGNORED'. Adjudicated CS#5 low, unfixed.
reported: All 8 schema purpose strings and all 8 reach rows end with the unconditional claim that a user-global waiver 'is ignored and named in the resolver's warnings', which this phase's own AC3 collapse makes false whenever the two layer paths resolve to one file.
severity: minor
fix: 50b25da, retest

### 12. Hard-linked layer paths escape the identity check
expected: layerIdentity and fsIdentity both use realpathSync, which canonicalizes symlinks but cannot see a hard link, so one file under two hard-linked names still reports two layers. Outside AC1's literal list (identical path / symlink / relative-vs-absolute), so it does not fail item 1.
origin: verifier
status: skipped
first_pass: fail
source: verifier
evidence: lib/config-merge.mjs:93-98, config.mjs:218-223. Two hard-linked names -> {"source":"global+repo"}, and one broken hard-linked file is diagnosed twice. Correction to the adjudication (OA#2, REVIEW-diff-plan-1.md:28): the write-face half is LESS serious than recorded - set --file <hard link> does pass the repo-scope guard, but atomicWrite's temp+rename breaks the link, so the physical user-global file is untouched (verified: it still held {"stakes":"solo"}). The defect is a guard that fails to fire, not a waiver written into the global layer.
reported: layerIdentity and fsIdentity both use realpathSync, which canonicalizes symlinks but cannot see a hard link, so one file under two hard-linked names still reports two layers. Outside AC1's literal list (identical path / symlink / relative-vs-absolute), so it does not fail item 1.
severity: minor
reason: deferred out of phase 1 at /cad-verify 1: a hard link is outside AC1's enumerated cases (identical path, symlink, relative-vs-absolute), and the write-face half proved benign - atomicWrite's temp+rename breaks the link. Carried to CAPTURE.md with the fix shape.

### 13. The write face refuses waivers in the very configuration AC3 blesses
expected: The read face decides which layer a shared file is from caller intent (asGlobal), the write face decides it from filesystem identity, so with CADENCE_GLOBAL_CONFIG aliased at the repo config the two faces disagree about the same file and the refusal names what was already passed. CS#2 is also the divergence from PLAN-1's own D-02 amendment (PLAN-1.md:116-127), which required source:'global' for the aliased-env path too.
origin: verifier
status: skipped
first_pass: fail
source: verifier
evidence: lib/config-merge.mjs:171 vs config.mjs:235-237. With the env at <G>: get --file <G> risk.override.auth -> source:"repo", no warning; get --global on the identical file -> source:"global" plus the warning; set --file <G> risk.override.auth=true -> refused with 'set it with --file <repo config> instead'. Adjudicated CS#2 + CS#6, unfixed.
reported: The read face decides which layer a shared file is from caller intent (asGlobal), the write face decides it from filesystem identity, so with CADENCE_GLOBAL_CONFIG aliased at the repo config the two faces disagree about the same file and the refusal names what was already passed. CS#2 is also the divergence from PLAN-1's own D-02 amendment (PLAN-1.md:116-127), which required source:'global' for the aliased-env path too.
severity: minor
reason: deferred out of phase 1 at /cad-verify 1: reconciling the caller-intent read face with the identity-based write face is a WRITE-face shape change, which this phase's scope boundary puts explicitly Out. Carried to CAPTURE.md, including that it diverges from PLAN-1's own D-02 amendment.

### 14. The reach vocabulary list is stale again, and so is a src-count comment
expected: D-12 had this phase correct 'Four phrases are in use today'; the corrected line now says 'Six phrases are in use today' and lists six, while a seventh is in use at :134, added by this phase's last commit. Nothing machine-checks the list, so self-verify stays green while /cad-docs-verify reads it as this phase's drift - D-12's exact rationale.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: references/config-reach.md:48-55 (six listed) vs :134 'git.auto_close | repo config layer only for the unattended publish' (added by dbfe84c). Separately config.mjs:282 says '41 of 73 keys carry src: repo'; it is 42 now, because dbfe84c added src:"repo" to git.auto_close.
reported: D-12 had this phase correct 'Four phrases are in use today'; the corrected line now says 'Six phrases are in use today' and lists six, while a seventh is in use at :134, added by this phase's last commit. Nothing machine-checks the list, so self-verify stays green while /cad-docs-verify reads it as this phase's drift - D-12's exact rationale.
severity: cosmetic
fix: 436e117, retest

### 15. PLAN-2 edited four files it never declared, and no SUMMARY records it
expected: PLAN-2 declares files: [cadence-core/bin/config-seams.test.mjs] and states it 'modifies no source', but its commits edited land-cleanup.mjs, land-cleanup.test.mjs, config.schema.json and references/config-reach.md, and 0b1c322 shipped a land-gate behaviour change that dbfe84c then reverted. Net effect on source is comment-only, so this is a record gap, not a behaviour defect - but it is exactly the kind of decision AC6's SUMMARY exists to carry.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: git show --stat 0b1c322 dbfe84c; git diff b8d200e~1..dbfe84c -- cadence-core/bin/land-cleanup.mjs shows only added comments. skills/cad-land/SKILL.md:27 does read git.auto_close through config.mjs get (merged) and :60 suppresses the triage ask under it, so the gate's halt must read the same value; three new land-cleanup.test.mjs rows pin the halt in the direction a repo-layer read breaks.
reported: PLAN-2 declares files: [cadence-core/bin/config-seams.test.mjs] and states it 'modifies no source', but its commits edited land-cleanup.mjs, land-cleanup.test.mjs, config.schema.json and references/config-reach.md, and 0b1c322 shipped a land-gate behaviour change that dbfe84c then reverted. Net effect on source is comment-only, so this is a record gap, not a behaviour defect - but it is exactly the kind of decision AC6's SUMMARY exists to carry.
severity: minor
fix: SUMMARY.md written, retest

### 16. Decide where the eight adjudicated diff-review survivors land, then write the phase SUMMARY AC6 requires
expected: A recorded decision (a PLAN-3 inside phase 1, or carried to CAPTURE with the reasons) plus .planning/phases/1/SUMMARY.md existing, naming each of the seven D-03 roster items with its pinning test and :164 as PARTIALLY closed.
origin: verifier
status: pass
first_pass: fail
reported: open: no SUMMARY.md exists and STATE.md still poses the survivors as undecided
severity: major
cause: The phase never reached its execute-cycle summary step: it paused after PLAN-1 with the diff review unadjudicated (010ce48), the review was adjudicated standalone (f452f80), then PLAN-2 ran to completion (6add5e2..dbfe84c) - so no run wrote SUMMARY.md, and the 8 adjudicated survivors were never assigned to a plan.
fix: decided at /cad-verify 1: 5 fixed here, 2 to CAPTURE, SUMMARY written

### 17. Confirm the intended reading of src: "repo" now that git.auto_close carries it while the land gate deliberately honours the MERGED value
expected: Either the annotation's meaning stays 'project-scoped setting' (consistent with stakes, which also carries it and inherits globally - D-13) and no change is due, or src gains a stated definition somewhere a user reads it. src drives no code path (repoScopedErrors and globalScopeWarnings both filter on OVERRIDE_PREFIX alone).
origin: verifier
status: pass
first_pass: pass
reported: no change due: src stays 'project-scoped setting', consistent with D-13

## Summary

total: 17
passed: 15
failed: 0
pending: 0
skipped: 2
blocked: 0
reworked: 10
