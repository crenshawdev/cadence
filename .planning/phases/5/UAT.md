---
status: testing
phase: 5
started: 2026-07-28
updated: 2026-07-28
---

## Items

### 1. Unpicked ## Active id breaks the verdict
expected: On a fixture whose ## Traceability has rows for some but not all ## Active ids, `planning.mjs audit` names the unpicked id in requirements[] with break:"unpicked", counts it in counts.broken, and the verdict is FAIL. At 40df6e2 the same tree returns PASS with that id in no field of the envelope.
status: pass
first_pass: pass
source: verifier
evidence: Fixture f1 (## Traceability holds AUD-01 only; ## Active = AUD-01 + AUD-02). HEAD: {"id":"AUD-02","break":"unpicked"} with counts:{total:2,traced:1,broken:1,deferred:0}. Same tree against the seam at 40df6e2: counts:{total:1,traced:1,broken:0,deferred:0} with AUD-02 in no field. Verdict rule cadence-core/workflows/audit.md:59-67; implementation planning.mjs:663,670,707.

### 2. counts arithmetic identity survives the widening
expected: On that same fixture counts.total === counts.traced + counts.broken + counts.deferred, and counts.total exceeds the ## Traceability row count by exactly the number of unpicked ids.
status: pass
first_pass: pass
source: verifier
evidence: f1: total 2 = 1 traced + 1 broken + 0 deferred; 1 Traceability row + 1 unpicked = 2. Holds on the Deferred fixture too (total:2 = 1+0+1). Pinned by cadence-core/bin/planning.test.mjs:1332-1350, run by name: pass 1 / fail 0.

### 3. unseeded fires at a non-zero row count
expected: A fixture with a NON-ZERO row count and at least one unpicked id fires `unseeded`, whose active_ids payload names exactly the unpicked ids. At HEAD-before it fired only at zero rows.
status: pass
first_pass: pass
source: verifier
evidence: f1 (1 row) at HEAD: "unseeded":{"active_ids":["AUD-02"]} - exactly the unpicked id. The old seam emits no unseeded field at all on that tree. Widening at planning.mjs:682.

### 4. Out-of-grammar ## Active line gets a named diagnostic
expected: An id-shaped line inside ## Active that is not a bold bullet (a v1.3.1-style table row, an unbolded bullet) appears in the additive `active_issues` field with a code and the offending line, instead of being silently absent from both the unpicked set and the output.
status: pass
first_pass: pass
source: verifier
evidence: Fixture f4 reports two active-table-row (lines 9,10), active-unbolded-bullet (12), active-ordered-item (13), active-heading (14), each carrying the offending text. Classifier planning-files.mjs:363-405; 31 parser-level active-section: test rows (plan floor was 19).

### 5. No ## Active heading is unchanged from HEAD
expected: A fixture with no ## Active heading returns the same no_active_section report as before the phase, with no unpicked ids and no new break. (D-06: null is never coerced to [], so pre-v1.4.0 projects can still PASS.)
status: pass
first_pass: pass
source: verifier
evidence: Three variants run at HEAD and at 40df6e2, byte-identical output each time: non-zero rows (total:1,broken:0, no unseeded), zero rows with no heading ({"active_ids":[],"no_active_section":true}), zero rows with an empty ## Active ({"active_ids":[]}). null never coerced - planning.mjs:663,683.

### 6. ## Deferred id produces no unpicked break
expected: A fixture with an id under ## Deferred (or ## v2 Requirements) and no ## Active entry produces no unpicked break for that id - exclusion is by section placement, not by Status value.
status: pass
first_pass: pass
source: verifier
evidence: Fixture f6: RCL-06 (## Deferred) and SPN-01 (## v2 Requirements) appear in no field; counts:{total:1,traced:1,broken:0,deferred:0}. Variant f6b: an ## Active id carrying a Deferred-status row lands in deferred, never unseeded. Section-placement cut at planning-files.mjs:370.

### 7. Full gate is clean after the prose moves
expected: `node --test cadence-core/bin/*.test.mjs` passes (720/0 per SUMMARY), `npx tsc -p tsconfig.ci.json` exits 0, `node cadence-core/bin/self-verify.mjs` reports no budget-overrun, and workflows/audit.md, skills/cad-audit/SKILL.md, references/req-traceability.md and METHOD.md no longer state that the unpicked case changes neither counts nor the verdict.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 720 / pass 720 / fail 0; npx tsc -p tsconfig.ci.json exit 0; node cadence-core/bin/self-verify.mjs -> problems: []. `unpicked` present in audit.md (5x), req-traceability.md (9x), METHOD.md:439, skills/cad-audit/SKILL.md:20, CHANGELOG.md:112. The two surviving "changes neither" sentences (audit.md:71, req-traceability.md:146) scope to active_issues/nonconforming_plans and are accurate.

### 8. /cad-audit surfaces the FAIL in the partially-planned state (human-verify: needs the slash-command surface)
expected: Running `/cad-audit` against the FAIL-state fixture reports FAIL naming AUD-02, with the next action "plan it into a phase or move it to ## v2 Requirements" - NOT a PASS-with-warnings. The -after copy of the fixture reports PASS. No executor can invoke a slash command, so this is yours to run.
status: pass
first_pass: pass
reported: FAIL on f1 naming AUD-02 as unpicked, counts total 2 = traced 1 + broken 1 + deferred 0, next action gave both exits (plan it into a phase / move it out of ## Active) and explicitly refused the em-dash Phase cell as a non-exit. PASS on f1-after, traced 2 / broken 0, unseeded empty.

### 9. Digit-prefix requirement id (the HIGH open item)
expected: SUMMARY calls this the single most important thing for /cad-verify 5 to settle. REQ_ID_EXACT requires the category to start with [A-Z], so a milestone declaring `2FA-01`/`3DS-02` returns unseeded.active_ids:[] and counts all-zero at HEAD, where 40df6e2 named them - the phase's goal fails vacuously for that id space. Decide: accept as a known limit, or route the fix.
status: pass
first_pass: fail
source: verifier
evidence: Decided at /cad-verify 5: ACCEPT as a stated limit, not widened - REQ_ID_TOKEN scans arbitrary prose, so a digit-leading category would make every date (2026-07-28) an id token. The limit is now stated on the unseeded field itself (workflows/audit.md:29-33, 'do not read an empty unseeded as proof the section is covered'), in references/req-traceability.md:145-152, and in templates/REQUIREMENTS.md:60-64, and PINNED by planning-files.test.mjs (isRequirementId rejects 2FA-01/3DS-02, admits A11Y-01; a bold 2FA-01 bullet reports active-non-id-bullet). Widening either anchor now breaks a test deliberately. Commit 79f0323.
reported: REQ_ID_EXACT (planning-files.mjs:275) anchors on [A-Z] first, so an id whose category leads with a digit is excluded from the unpicked join (planning.mjs:663) AND from the unseeded payload (:683). SUMMARY's HIGH open item is accurate and, on the goal path, understated: on a PARTIALLY-planned fixture the phase's own blind spot is fully reopened for this id class.
severity: major
cause: REQ_ID_EXACT (planning-files.mjs:275) anchors its first character as [A-Z], so a digit-leading category never passes isRequirementId and is filtered out of the unpicked join (planning.mjs:663) and the unseeded payload (:683). REQ_ID_TOKEN (:264) carries the SAME [A-Z] first-char anchor, so such an id is not even a scannable token - which is why the diagnostic vanishes entirely once the line is unbolded (item 10). One anchor, two symptoms.
fix: 79f0323, retest

### 10. active-non-id-bullet remedy erases the last remaining signal
expected: Remedy 1 in the out-of-grammar table (references/req-traceability.md:48, "put exactly the id inside the bold span") is already satisfied by `- **2FA-01**: text`, so it is a no-op. Remedy 2 ("unbold a bullet that declares no requirement") is worse than SUMMARY reports: following the shipped instruction takes the id from reported-but-uncounted to completely invisible.
status: pass
first_pass: fail
source: verifier
evidence: req-traceability.md:49 adds the remedy row for a span that already holds the id alone: both prior remedies are refused by name, and the unbolded form is stated to delete the diagnostic too. workflows/audit.md:74-82 no longer says 'until that line is rewritten as a bullet' for a line that already is one - it now tells the reader to say so rather than issue a no-op remedy. The silence is pinned: an unbolded 2FA-01 bullet yields ids [] codes [] (planning-files.test.mjs). Commit 79f0323.
reported: Remedy 1 in the out-of-grammar table (references/req-traceability.md:48, "put exactly the id inside the bold span") is already satisfied by `- **2FA-01**: text`, so it is a no-op. Remedy 2 ("unbold a bullet that declares no requirement") is worse than SUMMARY reports: following the shipped instruction takes the id from reported-but-uncounted to completely invisible.
severity: major
cause: Shares item 9's root cause: REQ_ID_TOKEN (planning-files.mjs:264) requires \b[A-Z], so unbolding a digit-leading id removes it from idTokensIn and the active_issues entry disappears with it. Compounded by two prose defects: references/req-traceability.md:48 has no remedy row for a bold span that ALREADY holds the id alone, and workflows/audit.md:71-73 says the line must be 'rewritten as a bullet' when the line already is one.
fix: 79f0323, retest

### 11. references/req-traceability.md states a falsehood about seed-reqs
expected: Line 139-140 reads "an id that is not id-shaped is never in the payload - /cad-plan could not seed a row for it either". seed-reqs intersects plan frontmatter against the UN-narrowed parseActiveIds, so it does seed such rows. This sentence is precisely the reassurance that makes the digit-prefix gap look harmless.
status: pass
first_pass: fail
source: verifier
evidence: The false sentence is gone - grep -c 'could not seed a row' references/req-traceability.md returns 0. Replaced at :138-152 with the admission-test framing that states the two seams disagree by design: seed-reqs asks the wider bullet grammar and WILL seed a row audit refuses to name. Commit 79f0323.
reported: Line 139-140 reads "an id that is not id-shaped is never in the payload - /cad-plan could not seed a row for it either". seed-reqs intersects plan frontmatter against the UN-narrowed parseActiveIds, so it does seed such rows. This sentence is precisely the reassurance that makes the digit-prefix gap look harmless.
severity: major
cause: Documentation-only. references/req-traceability.md:139-140 asserts /cad-plan could not seed a row for a non-id-shaped id, but seed-reqs intersects plan frontmatter against parseActiveIds, which is deliberately the UN-narrowed set (planning-files.mjs:414-430 states this explicitly). The writer uses the wide grammar and audit the narrow one; the doc denies the gap exists.
fix: 79f0323, retest

### 12. active-prose-line suppression is asymmetric
expected: The suppression predicate (planning-files.mjs:406+) tests ids.length > 0 against the UN-narrowed id list while the arithmetic tests the narrowed one, so a bullet declaring no admissible id still counts as "the section declared ids". Independently reproduced - SUMMARY's MEDIUM item is accurate.
status: pass
first_pass: fail
source: verifier
evidence: Fixed at planning-files.mjs:405-411 - suppression now filters ids by isRequirementId, the same question the arithmetic asks. Item 12's own fixture (## Active = the AUTH-05/AUTH-06 prose line plus a '- **Note**: scope frozen' bullet) now returns active_issues [active-prose-line line 5, active-non-id-bullet line 7]; before the fix the Note bullet suppressed the prose line entirely. Pinned by a new ACTIVE_ROWS case; the intro-paragraph guard row (real bullets beside the same prose) still reports nothing. Commit 3ce039f.
reported: The suppression predicate (planning-files.mjs:406+) tests ids.length > 0 against the UN-narrowed id list while the arithmetic tests the narrowed one, so a bullet declaring no admissible id still counts as "the section declared ids". Independently reproduced - SUMMARY's MEDIUM item is accurate.
severity: minor
cause: planning-files.mjs:414 computes the prose suppression as: ids.length === 0 ? (build elsewhere set) : null -- where ids is the UN-narrowed ACTIVE_BULLET list. A bold bullet that declares no admissible id (- **Note**: scope frozen) still makes ids.length > 0, so it suppresses active-prose-line for the whole section. The arithmetic asks isRequirementId; this predicate does not.
fix: 3ce039f, retest

### 13. workflows/audit.md omits the id-shape admission filter
expected: The workflow is what /cad-audit requires reading; the hedge lives only in references/req-traceability.md, which the workflow does not require. A model reading only the workflow issues a wrong PASS on the digit-prefix case.
status: pass
first_pass: fail
source: verifier
evidence: workflows/audit.md:29-33 now carries the admission qualifier inline on the unseeded field description - '2-8 characters STARTING WITH A LETTER, or #N', with the explicit instruction not to read an empty unseeded as proof of coverage. A model reading only the workflow can no longer issue the wrong PASS on the item-9 envelope. Commit 79f0323.
reported: The workflow is what /cad-audit requires reading; the hedge lives only in references/req-traceability.md, which the workflow does not require. A model reading only the workflow issues a wrong PASS on the digit-prefix case.
severity: minor
cause: Documentation-only. workflows/audit.md:29-30 and :50-56 describe unseeded/unpicked with no admission qualifier and never name isRequirementId; the hedge lives only in references/req-traceability.md, which /cad-audit does not require reading. A model reading only the workflow issues PASS on the item-9 envelope.
fix: 79f0323, retest

## Summary

total: 13
passed: 13
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 5
