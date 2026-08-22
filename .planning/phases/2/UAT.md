---
status: testing
phase: 2
fields_version: 1
started: 2026-08-22
updated: 2026-08-22
---

## Items

### 1. phase-done refuses on an unreadable REQUIREMENTS.md, leaving ROADMAP.md byte-identical
expected: Against a fixture whose REQUIREMENTS.md is a directory, `planning.mjs phase-done --n <N>` prints {"ok":false} with a machine reason naming the unreadable requirements file and exits 1; ROADMAP.md's sha256 is identical before and after.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:734-742 preflight + fail('unreadable-requirements'); test 'phase-done: an unreadable REQUIREMENTS.md refuses whole; ROADMAP.md is byte-identical' (planning.test.mjs:907) passes, comparing sha256 across the run at exit 1.

### 2. phase-done still succeeds when REQUIREMENTS.md is absent entirely
expected: Against a fixture with no REQUIREMENTS.md, `planning.mjs phase-done --n <N>` prints {"ok":true} at exit 0 with the roadmap line boxed - absent and unreadable produce different envelopes.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:700-702 three-state read, no REQUIREMENTS step when absent; test at planning.test.mjs:925 passes (ok:true, exit 0, roadmap.now '[x]', reqs []); live run on a no-REQUIREMENTS fixture returned wrote:["ROADMAP.md"] at exit 0.

### 3. phase-done's success envelope names which documents were written
expected: The success envelope carries a field stating whether both documents were written or only the roadmap, and `node --test cadence-core/bin/planning.test.mjs` passes with every pre-existing phase-done case unedited.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:777 emits `wrote: applied.completed`; test at planning.test.mjs:943 pins both shapes; the 8 removed test lines since 5dd8cdca are all inside the disclosed detail-idiom census, zero pre-existing phase-done cases edited.

### 4. release-bump refuses an unparseable sibling manifest with nothing written
expected: Against a fixture whose .claude-plugin/marketplace.json is present but unparseable, `release-bump.mjs bump --version <v>` prints {"ok":false} at exit 1, plugin.json still reads the OLD version, and CHANGELOG.md's sha256 is unchanged.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: release-bump.mjs:280-295 refuses inside the read-and-decide half; first atomicWrite( at :361 > last readManifest( at :280 and changelog read at :329; test at release-bump.test.mjs:268 passes asserting reason 'unreadable-sibling-manifest', exit 1, plugin.json and CHANGELOG.md byte-identical.

### 5. A readable-but-not-upgradeable sibling stays an ok:true siblings[] refusal row
expected: `release-bump.mjs bump --version <v>` against a fixture whose sibling parses but is not upgradeable returns {"ok":true} with a siblings[] row action:"refuse" carrying that verdict's own code, and release-bump.test.mjs:251-266 passes unmodified.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: release-bump.mjs:302-312; 'bump: a SIBLING that would downgrade is recorded as a refusal, not silently written (D-08)' passes by name at release-bump.test.mjs:250-266, its body unmodified since the phase base.

### 6. The all-or-nothing claim in cmdPhaseDone matches the behaviour
expected: `grep -n "all-or-nothing" cadence-core/bin/planning.mjs` either returns no hit inside cmdPhaseDone, or the hit sits below a pre-flight refusal.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: grep inside the cmdPhaseDone sed range prints 0; the only file hit is planning.mjs:1074 in the unrelated uat-merge comment; planning.mjs:734 is the single runTransition call and :714-731 states the pre-flight guarantee instead.

### 7. self-verify is clean
expected: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with an empty problems array.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs --root .` -> ok:true, problems: [].

### 8. A non-regular CHANGELOG.md refuses instead of hanging or scaffolding over history
expected: With CHANGELOG.md a FIFO or a symlink to /dev/null, the bump refuses under `unreadable-changelog` rather than blocking the CLI or writing a fresh changelog over the release history.
status: pass
first_pass: pass
source: verifier
evidence: release-bump.mjs:212 statSync().isFile() before the read; both the directory case and the symlink-to-/dev/null case (release-bump.test.mjs:293, :315) pass under reason 'unreadable-changelog' at exit 1.

### 9. milestone.md's halt prose, its weight budget and the DOCS-CLAIMS row moved with the behaviour
expected: milestone.md's halt list names the new reason codes, weight-budgets.json carries the re-pinned ceiling for it, and the MILESTONE-06 DOCS-CLAIMS row reflects the changed sibling-refusal behaviour.
status: pass
first_pass: pass
source: verifier
evidence: milestone.md:65 'Four halts', :67-71 new refusal codes, :72-76 partial-bump bullet, :77-82 rewritten siblings[] bullet with the stale parenthetical gone; wc -c = 14937 = weight-budgets.json:66; DOCS-CLAIMS.md:881-882 restated and re-anchored to 67-71 / 77-82.

### 10. phase-done accepts a non-regular REQUIREMENTS.md - the regular-file bar the gate set for CHANGELOG.md never reached the sibling seam
expected: behavior wrong - cadence-core/bin/planning.mjs:700-702 decides 'unreadable' from `read()` returning null, i.e. from whether reading THREW, which is the exact defect the blocking risk_surface review found in readChangelog and gate commit a90d8b12 fixed one seam over with `statSync(file).isFile()`. A path that is not a regular file is either never classified (it reads cleanly) or never reached (it blocks).
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 8b73e001. Retested against the committed binary 2026-08-22, n=1 each: (a) symlink to /dev/null at .planning/REQUIREMENTS.md -> {"ok":false,"reason":"unreadable-requirements"} at exit 1, ROADMAP.md sha256 unchanged and the symlink still a symlink (previously ok:true at exit 0 with the box flipped and a 0-byte regular file written over it); (b) FIFO at the same path -> the same refusal at exit 1 inside 6s (previously exit 124, hung, no envelope). node --test cadence-core/bin/planning.test.mjs -> 456 pass 0 fail, including the new case 'phase-done: a non-regular REQUIREMENTS.md that reads CLEANLY still refuses'. node cadence-core/bin/self-verify.mjs --root . -> ok:true, problems: []. tsc -p tsconfig.ci.json --noEmit -> exit 0. Blocking risk_surface gate on the staged fix: openai/gpt-5.6-terra raised 1 (TOCTOU, high), refuted at adjudication (ADJUDICATION-risk_surface-verify-8b73e00.json); 0 survivors, gate_pass recorded.
reported: behavior wrong - cadence-core/bin/planning.mjs:700-702 decides 'unreadable' from `read()` returning null, i.e. from whether reading THREW, which is the exact defect the blocking risk_surface review found in readChangelog and gate commit a90d8b12 fixed one seam over with `statSync(file).isFile()`. A path that is not a regular file is either never classified (it reads cleanly) or never reached (it blocks).
severity: minor
cause: cadence-core/bin/planning.mjs:700-702 derives the three-state fact from whether read() THREW (`reqText === null`), not from the file's shape. read() wraps readFileSync, which does not throw on a FIFO (it blocks forever) nor on a character device (it streams or reads ''), so neither shape reaches the `unreadable-requirements` refusal the pre-flight advertises. Gate commit a90d8b12 fixed exactly this defect at readChangelog (release-bump.mjs:212) with `statSync(file).isFile()`, but that bar was scoped to the changelog seam and never applied to the sibling REQUIREMENTS.md read one file over. Fix: classify a present-but-not-regular reqFile as unreadable before reading it, mirroring release-bump.mjs:212.
fix: 8b73e001, retest

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
