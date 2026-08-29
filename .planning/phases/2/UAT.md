---
status: testing
phase: 2
fields_version: 1
started: 2026-08-29
updated: 2026-08-29
---

## Items

### 1. A survived medium with no fix commit is stored
expected: Writing an adjudication record whose survived entry is raised at medium or below and carries no fix_commit is accepted, and that entry appears in the written ADJUDICATION-*.json - not a refusal.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: buildEntries probe: medium and low survived with no fix_commit -> ok true, entry carries no fix_commit key. Real seam: the GH-159 row spawns `planning.mjs adjudication` and re-reads the written record. Live proof on this repo: .planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json holds two `medium survived` entries with no fix_commit key beside a `high survived` naming 3341ffb0.

### 2. A survived blocker/high with no fix commit is still refused
expected: A survived entry raised at blocker or high with no fix_commit is still refused, and an entry carrying the misspelled key fix_comit is still refused as an unknown key.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: blocker and high with no fix_commit and no marker -> ok false, detail names blocker or high (adjudication-record.mjs:460-467). `fix_comit` -> `carries an unknown key: fix_comit`; the new `overriden` typo is refused the same way. The VALUE check still fires on 'zzzzzzz' at medium AND beside `overridden: true` at blocker.

### 3. An overridden blocker writes a record and satisfies risk-check
expected: An overridden blocker/high writes an ADJUDICATION-*.json carrying its override marker with no fabricated commit SHA, and `risk-check status` joins that receipt as satisfied.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `node --test --test-name-pattern='OVERRIDDEN blocking fire' cadence-core/bin/planning-adjudication.test.mjs` -> pass 1. Four real CLI subprocesses; the stored entry carries `overridden: true` with no `fix_commit` key, and `risk-check status` answers ok true, exit 0, state 'recorded'. Non-boolean markers refused by a detail naming the marker.

### 4. issue-filing unfixed skips already-committed findings
expected: `issue-filing unfixed` returns no entry carrying a fix_commit: fed the `medium survived HASFIX` entry in .planning/_archive-v3.7.3/1/ADJUDICATION-risk_surface-plan-2.json it offers nothing for that entry.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Real `issue-filing.mjs unfixed` run over a payload rebuilt from the archived record's own four entries: envelope is `raised 2, already_fixed 1, already_declined 0` and the `medium survived HASFIX` entry (4a1af326) is absent from `findings`. Filter at issue-filing.mjs:278, before the forge is touched.

### 5. The four survived surfaces agree and drift reddens
expected: lib/adjudication-record.mjs, lib/filing-decision.mjs, references/triage-gate.md and references/review-record.md state the same meaning of `survived`, and a prose-agreement.test.mjs row goes red when any one of them is edited apart from the others.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: RSK-07 passes; the phrase 'confirmed and not fixed' is present in all four surfaces after whitespace collapse. Falsification simulated in memory over the real file bodies: removing the phrase from any one surface fails the assertion (4/4), and appending an unqualified 'survived ... names the fix commit' to any one is caught by the regex arm (4/4).

### 6. why record tells a fixed survivor from an unfixed one
expected: Two survivors on one commit, one with a fix_commit and one without, do not render identically in `why record` output.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/why.mjs cadence-core/bin/lib/adjudication-record.mjs` prints three survivors on one commit: `fix: 3341ffb0` on the high, `fix: none - confirmed and left standing` on both mediums. The field is traced from the stored entry through parseAdjudication and reviewFor into findingLines.

### 7. The GH-159 reproduction closes and old records still read
expected: A blocking fire whose highest finding is a medium reaches a written receipt and a satisfied `risk-check status` with no halt, and `trace recount`, `why record` and the deferred readers still read the pre-change records on disk without refusing.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: The reproduction settles through four local subprocesses with no review provider - AC7's flagged assumption confirmed, no human-verify tag needed. 83 ADJUDICATION-*.json blobs recovered from all of git history parse through parseAdjudication with 0 issues and deriveCounts agrees with entry count on every one; the deferred readers only test the sibling's existence. Full suite 3552/3552, self-verify problems: [].

### 8. triage-gate.md still tells the coordinator a survived blocker/high can never be in the unfixed set
expected: behavior wrong - the reference disagrees with the seam this phase changed. `references/triage-gate.md:281-282` states "A survived `blocker` or `high` is NOT in it", but 3341ffb0 deliberately made an OVERRIDDEN survived blocker a member so it would stop being dropped silently. A coordinator following that paragraph at the ask step reads the one entry the override case exists to surface as impossible.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: 323c4b05 amends `references/triage-gate.md:281-287`: the set statement now names THREE exclusions and calls the overridden entry a member. Probe against the live seam - `unfixedFindings` over a 5-finding payload (blocker survived+overridden, high survived HASFIX, high survived HASFIX, medium survived, medium survived HASFIX) -> members `blocker/survived/overridden | medium/survived | medium/survived/HASFIX`, and after `cmdUnfixed`'s `issue-filing.mjs:278` filter -> `blocker/survived/overridden | medium/survived`. Each of the three exclusions the amended paragraph names fires, and the overridden blocker is a member as it now says. `self-verify.mjs` -> `problems: []` (weight-budgets re-pinned to 23006); `node --test cadence-core/bin/prose-agreement.test.mjs` -> 59 pass 0 fail, so RSK-07 still holds over the four survived surfaces.
reported: behavior wrong - the reference disagrees with the seam this phase changed. `references/triage-gate.md:281-282` states "A survived `blocker` or `high` is NOT in it", but 3341ffb0 deliberately made an OVERRIDDEN survived blocker a member so it would stop being dropped silently. A coordinator following that paragraph at the ask step reads the one entry the override case exists to surface as impossible.
severity: minor
cause: triage-gate.md's `The set is READ, never judged.` paragraph (lines 279-282) was written against the pre-phase-2 behaviour of `unfixedFindings` and neither commit that changed that behaviour amended it. 3341ffb0 added `&& e.overridden !== true` at filing-decision.mjs:104-107, making an OVERRIDDEN survived blocker/high a member of the returned set; dda38c4c added `.filter((e) => !e.fix_commit)` at issue-filing.mjs:278, adding a third exclusion the paragraph does not name. The paragraph still states the set as exactly three inclusions and two exclusions with a flat `A survived blocker or high is NOT in it`. Nothing reddens because the RSK-07 drift row pins the four surfaces' meaning of `survived`, not this set enumeration, and no test asserts the prose against `unfixedFindings`.
fix: 323c4b05, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
