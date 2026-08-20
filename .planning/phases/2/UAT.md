---
status: testing
phase: 2
fields_version: 1
started: 2026-08-20
updated: 2026-08-20
---

## Items

### 1. Record written per fire, one entry per raising voice
expected: A blocking/adjudicated gate fire leaves .planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json beside its sibling REVIEW-<trigger>-<discriminator>.md, using the same discriminator. Each entry carries voice, model and the severity as raised; a two-voice convergent finding yields TWO entries, not one.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: buildEntries emits per finding per voice with derived convergence; tests 'AC1: two voices raising one convergent finding produce TWO entries, not one' and 'adjudication: the record lands beside the sibling REVIEW discriminator (AC1)' pass; live .planning/phases/2/ADJUDICATION-risk_surface-plan-2.json sits beside REVIEW-risk_surface-plan-2.md with voice/model/severity on each entry.

### 2. Verbatim claim text and full 40-char SHAs
expected: Each entry's claim and failure_scenario are byte-identical to the reviewer's returned payload, and a payload paraphrased before storage is refused by the seam. base_id/head_id are stored as full 40-character SHAs even when the caller spelled them 7-char or as the literal HEAD.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Entry text is always copied from the returned side and a restatement differing by one byte is refused; spot-check through the real binary with --base HEAD~1 --head HEAD stored 40-char base_id/head_id on the header and on every entry, matching the live record's 7028a81 -> 7028a81bfd5e52e7a5568a650d95a86f17907260.

### 3. Three refusals: bad ruling, unevidenced refutation, unfixed survivor
expected: The seam refuses a ruling outside survived|downgraded|refuted; refuses a refuted entry with no counter-evidence naming contradicting code; refuses a survived entry with no fix commit SHA. One fixture per refusal, each rejected.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Three named tests, one per refusal, pass; live spot-check of a 'unadjudicated' ruling through the real binary returned ok:false bad-payload naming voices[0].rulings[0].ruling and wrote no file.

### 4. Counts derived from rulings, not parsed from --detail
expected: Survivor/downgrade/refutation counts are derived by counting rulings and ride trace append's structured --survivors/--downgraded/--refuted flags. Flipping one fixture entry's ruling changes the recomputed count, and a record whose counts disagree with its trace event is detected and refused.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: recountReceipt re-derives the three figures from the record before appendEvent; live spot-check refused --survivors 2 against a 1-survivor record with no trace file created, then appended on the correct figure. On this repo the plan-2 gate_pass carries survivors:1 downgraded:0 refuted:1 matching its record's rulings.

### 5. Unresolvable citation is flagged, never dropped
expected: An entry whose file does not resolve at head_id via `git cat-file -e <head_id>:<file>` is stored with a flag set and still present in the record - no entry is silently dropped.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Live spot-check with one present and one absent citation wrote both entries, marked only the absent one citation_missing:true, and reported citations {checked:true, missing:1} on the envelope; the checked:false arm returns an empty missing set by construction.

### 6. Auditor walk on a real fire reaches the cited code
expected: On one real fire, `git checkout <head_id>` then opening the cited file:line reaches the code the verbatim claim describes. (human-verify: needs a live cross-model gate fire)
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: git cat-file blob b4d00eb:cadence-core/bin/planning.mjs at the record's cited line reaches the deriveCounts call outside the try/catch that the verbatim claim describes, and b4d00eb:cadence-core/bin/lib/adjudication-record.mjs at the counter-evidence line reaches the Array.isArray guard that refutes it. Read-only walk rather than a working-tree checkout, because this pass may not mutate the repo.

### 7. /cad-report Gates line renders from the record
expected: `/cad-report 2` renders its Gates line from the ADJUDICATION record; `/cad-report 1` prints its fire as unrecorded and synthesizes no entry for the pre-format phase; the Refuted line still reads SUMMARY deviations unchanged.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: Live render, not a prose reading. `trace render --phase 2` + counting each record's entries by ruling: ADJUDICATION-risk_surface-plan-2.json counts survived 1 / downgraded 0 / refuted 1 and its gate_pass event carries survivors 1, downgraded 0, refuted 1 - agree, figure COUNTED from the record not narrated from the event. ADJUDICATION-risk_surface-plan-1.json counts downgraded 1 / survivors 0 while its gate_pass event carries no count flags, rendered as uncounted on the trace half and named rather than resolved to one side. The `plan` fire at 285243b7 has no ADJUDICATION-plan-*.json and rendered `unrecorded`. `trace render --phase 1`: all its fires (risk_surface plan-1/plan-2, diff, plan) render `unrecorded` - `ls .planning/phases/1/ADJUDICATION-*.json` -> no matches - and no entry was synthesized. Refuted line read SUMMARY deviations on both phases and nothing from the record: phase 1's reads `None`, phase 2's two deviations correct no D-NN, so the section is omitted per report.md's own rule.

### 8. self-verify clean, GAT-04 green, CONTRACTS row present
expected: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with an empty problems array; prose-agreement.test.mjs GAT-04 passes with its outcome-event list still exactly four names; the new subcommand has an arg-contract.mjs CONTRACTS row; weight-budgets.json was re-pinned in the same commit as the prose edits.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify --root . returns ok:true with problems:[]; GAT-04 passes with the four-name deep-equal intact at prose-agreement.test.mjs:1202; arg-contract.mjs:653 carries the adjudication row; weight-budgets.json rides all five prose commits.

### 9. Run /cad-report 2 and then /cad-report 1, and read the Gates line each produces
expected: /cad-report 2 shows a Gates line whose survivor figure is the ADJUDICATION record's rulings COUNTED and checked against the event's survivors/downgraded/refuted (and names any disagreement rather than picking a side); /cad-report 1 shows its fires as `unrecorded` with no synthesized entry; both leave the Refuted line reading SUMMARY deviations.
origin: verifier
why_human: Out of reach for this pass rather than merely unexercised: the Gates line is rendered by a model executing cadence-core/workflows/report.md inside the orchestrator's own /cad-report session, and no CLI entry point renders it, so there is no probe a subagent can run. The prose rule, its prose-agreement test, and the data it reads (`trace render --phase 2` surfacing survivors/downgraded/refuted, and the record listed in the read_record artifact list) are all verified; only the live render is not.
status: pass
first_pass: pass
source: model
evidence: The verifier's why_human said no subagent could run this because the render happens in the orchestrator's own session - the orchestrator is this session, so the render was performed here. /cad-report 2: `trace render --phase 2` yielded three fires this cycle. risk_surface plan-2 (7028a81->b4d00eb): record's entries counted by ruling = survived 1, downgraded 0, refuted 1; event carries survivors 1, downgraded 0, refuted 1 - the two independent artifacts AGREE, and the survivor figure was counted from the record rather than read off the event. risk_surface plan-1 (23121a3->7028a81): record counts downgraded 1, survivors 0; its gate_pass event carries no count flags at all, so the trace half is uncounted - rendered as such and named, not resolved toward either artifact. plan fire at 285243b7: no ADJUDICATION-plan-*.json exists, rendered `unrecorded`. /cad-report 1: `ls .planning/phases/1/ADJUDICATION-*.json` -> no matches, so every phase-1 fire (risk_surface plan-1/plan-2, diff, plan) renders `unrecorded` and no entry was synthesized for the pre-format phase. Refuted line on both: read from SUMMARY deviations only - phase 1's section reads `None`, phase 2's two deviations correct no D-NN - so the section is omitted on both and reads nothing from the record.

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
