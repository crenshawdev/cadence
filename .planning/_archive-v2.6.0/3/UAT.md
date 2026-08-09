---
status: testing
phase: 3
fields_version: 1
started: 2026-08-09
updated: 2026-08-09
---

## Items

### 1. Named and zero-padded phase dirs are each reported, the 14- pair together
expected: On a fixture holding phases/08-meteogram-legend, 08, 14-data-depth-x and 14-shared-derivation, planning.mjs status returns phase-dir-grammar drift entries naming every one of the four, with the two 14- entries in ONE entry that also names phases/14 as the phase they collide with.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:155/:176/:288 (PHASE_DIR_NAME, phaseDirGrammarDrift, wired in cmdStatus); the four planning.test.mjs cases at :4460-4505 pass, incl. entries ['08','08-meteogram-legend'] with 'share numeric prefix 8' and ['14-data-depth-x','14-shared-derivation'] with prefix 14, no entry naming legal '1', no `phase` key. `status` on this repo -> drift: None.

### 2. A legal phases/ tree reports zero grammar violations, and conventions.md no longer permits a named directory
expected: planning.mjs status on a tree of only 1, 2, 2.1, 10 returns no drift key at all, and grep over cadence-core/references/conventions.md finds numeric-only stated with no clause permitting an existing named directory.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Legal-tree fixture (1, 2, 2.1, 10) -> drift: undefined; a stray FILE under phases/ produces no entry. conventions.md:22-32 states the grammar and the report-never-resolve guarantee; grep for 'Match an existing directory' returns nothing. cad-health SKILL.md:56 and progress.md:37 name the kind.

### 3. --phase 1.10 addresses phases/1.10 and --phase 08 names phases/08
expected: lease-check --phase 1.10 and trace append --phase 1.10 both address phases/1.10 (never phases/1.1, and the two spellings do not share a trace key), and a seam given --phase 08 reports a not-found naming phases/08 rather than answering about phases/8.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Live scratch tree: lease-check --phase 1.10 -> plan_file .../phases/1.10/PLAN.md; plan-overlap --phase 08 -> detail '.../phases/08 not found'; uat status --phase 08 -> '.../phases/08/UAT.md not found'; trace appends carry "phase":"1.10" vs "1.1" with distinct corr and render --phase 1.10 returns only the 1.10 event. route.mjs imports requirePhaseArg (:55) and its local PHASE_RE is gone.

### 4. A scaffolded project gitignores its run record, idempotently, without losing brownfield lines
expected: trace ignore --root <scratch> writes the comment plus .planning/trace.jsonl into .gitignore with no manual step; a second run reports written:false reason:already-ignored and leaves the file byte-identical; and run against a .gitignore that already had lines, every prior line survives.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Brownfield .gitignore with no trailing newline: written:true, all three original lines verbatim; re-run written:false/reason already-ignored with md5 unchanged; --root "" and valueless --root both bad-args. Call site new-project.md:33; CONTRACTS row self-verify.mjs:152.

### 5. An existing project whose run record is tracked or unignored is REPORTED and edited by nothing
expected: trace ignore --check --root <repo> writes nothing and reports the state as found: tracked:true when trace.jsonl is tracked, ignored:false when no travelling .gitignore line covers it, and ignored:true (silent) when the line is present.
criterion: AC3
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/planning.mjs (gitIgnoreState / cmdTraceIgnore): `git check-ignore -v` does not match a TRACKED path without `--no-index`, so no source is found. Live on a scratch repo with `.planning/trace.jsonl` both in .gitignore and force-added: `--check` -> {"ignored":false,"tracked":true,"written":false}; the write arm returned written:true on run 1 AND run 2, leaving three copies of the line in .gitignore. skills/cad-health/SKILL.md:27-29 names that exact command as the fix, so the health walk sends the user at a non-idempotent no-op that never untracks. AC3's 're-running does not duplicate the line' is violated in this state. Disclosed in SUMMARY.md 'Open items' as high/live-verified under an advisory gate.
reported: behavior wrong - `trace ignore` reports `ignored:false` when the .gitignore line IS present, whenever the path is also tracked, and the remedy it names then duplicates the line on every run
severity: major
cause: git check-ignore does not match a TRACKED path without --no-index, so gitIgnoreState finds no source and reports ignored:false even when .gitignore carries the line; cmdTraceIgnore's write arm keys off that same value, so it re-appends comment+line on every run. cad-health/SKILL.md:27-29 names that command as the remedy.
fix: ea84dd7, retest

### 6. 2FA-01 is a requirement id everywhere audit counts one
expected: isRequirementId returns true for 2FA-01 and false for 14-01, 08-02 and 2026-08; and on a fixture declaring 2FA-01, audit admits it into counts and unpicked instead of reporting it as a phantom.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: isRequirementId: 2FA-01/3DS-02/A11Y-01/#41 true, 14-01/08-02/2026-08/A-01 false. planning.test.mjs:1925-1945 audit fixture -> unpicked entry, unseeded.active_ids, counts.total 1 with the invariant holding; both named tests pass.

### 7. The harvest returns exactly the planted markers and nothing else
expected: debt-harvest over a fixture returns exactly the planted CADENCE-DEBT markers with each ceiling and trigger, and zero entries from this tree's conventional TODO/FIXME/XXX/HACK markers and zero from node_modules/ (including a force-added one).
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Scratch repo -> {markers:2, files:3, malformed for the missing ceiling}; TODO/FIXME/XXX/HACK/NOTE, a token with no colon, a force-added node_modules marker and an untracked marker all contributed nothing. This repo -> markers:0, files:190. debt-markers.test.mjs 10/10.

### 8. The harvest is idempotent and a deleted marker leaves the section without touching ## Todos
expected: Running debt-harvest twice leaves CAPTURE.md byte-identical (second run written:false), and deleting a marker from source removes its bullet from ## Debt markers on the next run while every ## Todos line is unchanged.
criterion: AC6
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/planning.mjs replaceSection locates the owned heading with `lines.findIndex(l => l.trim() === heading)` and carries no fence state; the newly exported `sectionBound` (cadence-core/bin/lib/planning-files.mjs) guards the END only, so the D-12 comment's claim that this shape is covered holds in one direction. Reproduced live on a scratch repo: a CAPTURE.md whose `## Todos` bullet quoted `## Debt markers` inside a ``` fence came back with everything from inside the fence onward replaced - `## Seeds`, `## Notes` and the '- keep me' bullet gone, the fence unclosed - after one `debt-harvest --root .`. The plain idempotence and marker-deletion paths were verified green (written:false, md5-identical, `## Todos` intact), so this is the fenced-heading path only. Disclosed in SUMMARY.md 'Open items' as high/live-verified.
reported: behavior wrong - the section rewrite's START boundary is fence-blind and deletes user content from CAPTURE.md
severity: major
cause: replaceSection (planning.mjs:2444) finds the owned heading with lines.findIndex(l => l.trim() === heading) and carries no fence state; the exported sectionBound guards the END only. A fenced '## Debt markers' inside an earlier section is taken as the start, and the rewrite consumes everything after it.
fix: bb2174a, retest

### 9. The whole tree is green and every fix carries a failing-capable regression test
expected: node --test cadence-core/bin/*.test.mjs, npx tsc -p tsconfig.ci.json, self-verify --root . and weight.mjs --root . are all green with weight-budgets.json regenerated, and SUMMARY.md records a mutation and an observed RED for every fix in the phase.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1425/1425 tests pass; tsc exit 0; self-verify ok:true with problems: []; reports/plan-1.md:47-55 records the mutation and RED count for all five fixes.

### 10. The harvest's marker parse loses data on two shapes it does not refuse
expected: behavior wrong - two data-fidelity defects in the harvest that AC5's 'exactly the planted markers' does not survive on the shapes involved
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: (1) cadence-core/bin/lib/debt-markers.mjs:62-73 takes `indexOf(MARKER_HEAD)` only and then parses EVERY later pipe field into that one marker. Verified by direct call: a line carrying two markers returned ONE entry with text 'first' but ceiling 'c2' and trigger 't2' - the second marker's fields silently attached to the first. (2) planning.mjs's harvest reads with statSync/readFileSync, so a tracked symlink pointing outside the tree contributes the external file's marker under the in-tree path (SUMMARY.md records this live-verified as `src/link.js -> /tmp/outside-debt.js`). Both are disclosed in SUMMARY.md 'Open items' (medium and low) under the advisory review gate, so they are reported rather than hidden - filed here because they sit on AC5's path.
reported: behavior wrong - two data-fidelity defects in the harvest that AC5's 'exactly the planted markers' does not survive on the shapes involved
severity: minor
cause: debtMarkersIn (lib/debt-markers.mjs:62-73) takes indexOf(MARKER_HEAD) once, then parses every later pipe field into that single marker, so a second marker on the line is lost and its ceiling/trigger overwrite the first's; and cmdDebtHarvest reads with statSync/readFileSync, both of which follow a tracked symlink out of the tree.
fix: d1ef850, retest

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 3
