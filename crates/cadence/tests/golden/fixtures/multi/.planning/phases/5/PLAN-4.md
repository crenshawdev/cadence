---
phase: 5
plan: 4
requirements: [DOC-02]
files:
  - cadence-core/references/req-traceability.md
  - cadence-core/templates/REQUIREMENTS.md
  - cadence-core/references/acceptance-criteria.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 5: What Cadence claims about itself is true - Plan 4 (the direct prose edits)

## Goal

The three surfaces still stating the pre-`PRS-02` head-anchored id limit state
the narrower rule that IS still true, and the env-override passage names the
sentinel that override now requires - each landing with its byte budget re-pinned
in the same commit.

## Must be true when done

- `grep -n "2FA-01" cadence-core/references/req-traceability.md
  cadence-core/templates/REQUIREMENTS.md` returns lines stating that an UNBOLDED
  digit-leading id is invisible to the prose scan, and returns no line stating
  that a digit-leading category fails `/cad-audit` admission.
- Nothing in either file still tells a reader to rename a digit-leading category
  in order to be counted, and neither still calls the head-anchored form a known
  limit.
- `cadence-core/references/acceptance-criteria.md`'s env-override passage names
  `CADENCE_TEST_SEAM=1` beside `CADENCE_PLUGIN_MANIFEST`.
- `node cadence-core/bin/self-verify.mjs --root .` reports no `budget-overrun`
  at every commit this plan makes, not only at the last one.

## Context

Locked by `phases/5/CONTEXT.md`. D-05: the narrower statement that is LIVE is the
`REQ_ID_TOKEN` asymmetry, so the remedy prose is REWRITTEN to it and never
deleted - deleting the three false surfaces would remove the only documentation
of a real gap and leave a user with a digit-leading category warned by nothing.
D-04: these are DIRECT edits; `/cad-docs-verify`'s default target set is not
widened to reach them, and none of these three files is in run 1's or run 2's
swept surface, so no ledger row covers them. D-09: all four files this plan
touches sit EXACTLY at their byte budget, so each edit commit re-pins
`cadence-core/bin/weight-budgets.json` in the same commit; the check is a ceiling
(`cadence-core/bin/self-verify.mjs:777-791`) and the same-commit re-pin is the
convention `bd231ec`'s own message states. Out of scope: any change to
`cadence-core/bin/lib/planning-files.mjs` or its tests - the asymmetry is
deliberate and pinned, and this plan documents it rather than closing it.

The live facts, read at plan time: `REQ_ID_EXACT`
(`cadence-core/bin/lib/planning-files.mjs:324`) requires a letter SOMEWHERE in a
2-8 character category rather than at its head, so `isRequirementId('2FA-01')` is
true and a BOLDED `2FA-01` is a real declaration that `audit` counts and reports
nothing about. `REQ_ID_TOKEN` (`:299`) is unchanged and keeps `[A-Z]` at the
head, so the same id UNBOLDED is not a token at all and the near-miss diagnostics
never see it. Both halves are pinned by
`cadence-core/bin/planning-files.test.mjs:916-932`.

## Tasks

### Task 1: Rewrite `req-traceability.md`'s two digit-leading-category surfaces

- **Files:** cadence-core/references/req-traceability.md, cadence-core/bin/weight-budgets.json
- **Action:** Two sites in this file state the head-anchored limit that `PRS-02`
  removed. The first is the `active-non-id-bullet` diagnostic table's last row at
  `:50`, whose example is `- **2FA-01**: two-factor auth` and whose cells say the
  id is "held OUT and reported", that the prose scan requires a letter first, and
  that the remedy is to rename the category or carry it knowing `audit` will not
  count it, "Known limit as of v1.4.0". The second is the `active-prose-line`
  bullet's ADMISSION TEST passage at `:145-153`, which says `isRequirementId`
  admits a prefix "STARTING WITH A LETTER" and then that a digit-leading category
  "fails the admission test", is "held out of `unseeded` AND out of `counts`",
  and that such a milestone "audits clean while nothing carries it". Rewrite both
  to the rule that is still true: the admission test requires a letter SOMEWHERE
  in the 2-8 character category rather than at its head, so a bolded `2FA-01` is
  admitted and counted and reports nothing; the surviving asymmetry is that the
  unanchored prose scan keeps its letter head, so the SAME id written UNBOLDED is
  not a token at all and no near-miss diagnostic fires on it - the bullet declares
  nothing and nothing says so. Keep the shape each site already has: the table row
  stays a row of that table with a remedy cell, and the prose bullet stays a
  bullet. Do not delete either site and do not add a fourth surface. Ensure every
  line that still carries the `2FA-01` token carries part of the TRUE statement,
  and that at least one of them states the unbolded-invisibility clause on the
  same line, because the acceptance check is a line-based grep. Then re-pin
  `cadence-core/bin/weight-budgets.json`'s `cadence-core/references/req-traceability.md`
  key (currently 13725) to the file's new `wc -c` byte count, in this same commit.
- **Verify:** `grep -n "2FA-01" cadence-core/references/req-traceability.md`
  returns at least one line stating that an unbolded digit-leading id is invisible
  to the prose scan, and no returned line states that such a category fails
  admission or is held out of `counts`; `grep -c "Known limit as of v1.4.0"
  cadence-core/references/req-traceability.md` returns 0; and
  `node cadence-core/bin/self-verify.mjs --root .` reports no `budget-overrun`.

### Task 2: Rewrite the REQ-ID note in the REQUIREMENTS template

- **Files:** cadence-core/templates/REQUIREMENTS.md, cadence-core/bin/weight-budgets.json
- **Action:** The REQ-ID format note at `:59-64` tells a user the audit's
  admission test "requires the category to START WITH A LETTER", that a
  digit-leading category "is NOT counted by `/cad-audit`", and to spell it
  `TFA-01`. All three clauses are false against the live `REQ_ID_EXACT`. Rewrite
  the note in template voice - it is advice a user reads while writing their own
  requirements, so it stays short and keeps the `3-5 letter category code` house
  advice and the stable-ids rule intact. State that the admission test is wider
  than the advice, needing a letter somewhere in a 2-8 character category, so
  `2FA-01` IS counted when it is bolded in the `## Active` bullet form; and state
  the one live consequence a template reader can act on - the same id written
  UNBOLDED is invisible to the prose scan, so a bullet that forgets the bold gets
  no diagnostic at all. Do not recommend renaming the category, and do not lift
  `req-traceability.md`'s full explanation into the template; the template points,
  the reference explains. Then re-pin
  `cadence-core/bin/weight-budgets.json`'s `cadence-core/templates/REQUIREMENTS.md`
  key (currently 2914) to the file's new `wc -c` byte count, in this same commit.
- **Verify:** `grep -n "2FA-01" cadence-core/templates/REQUIREMENTS.md` returns
  at least one line, no returned line says a digit-leading category is not counted
  by `/cad-audit`, and at least one states the unbolded-invisibility consequence;
  `grep -c "TFA-01" cadence-core/templates/REQUIREMENTS.md` returns 0; and
  `node cadence-core/bin/self-verify.mjs --root .` reports no `budget-overrun`.

### Task 3: Name the test-seam sentinel beside the manifest override

- **Files:** cadence-core/references/acceptance-criteria.md, cadence-core/bin/weight-budgets.json
- **Action:** The passage at `:246-249` says `version.plugin` is read from
  `.claude-plugin/plugin.json` relative to the SCRIPT's own location "with
  `CADENCE_PLUGIN_MANIFEST` overriding the path for hermetic tests only". That
  override is now gated: `cadence-core/bin/planning.mjs:173` reads the variable
  only when `testSeamOpen()` holds, so the env var alone does nothing and the
  passage as written tells a test author to set half of what the seam requires.
  Add `CADENCE_TEST_SEAM=1` beside it, stating that BOTH are required and that
  without the sentinel the override is ignored and the manifest path falls back
  silently - which is the point of the gate (`cadence-core/bin/lib/test-seam.mjs`
  states what the sentinel buys). Keep the sentence's existing subject: this is
  the `version` envelope key's paragraph, not a new section on env overrides, so
  do not restate the sentinel policy here or list the other gated variables. Then
  re-pin `cadence-core/bin/weight-budgets.json`'s
  `cadence-core/references/acceptance-criteria.md` key (currently 22506) to the
  file's new `wc -c` byte count, in this same commit.
- **Verify:** `grep -n "CADENCE_TEST_SEAM" cadence-core/references/acceptance-criteria.md`
  returns a line inside the same paragraph as `CADENCE_PLUGIN_MANIFEST`;
  `node cadence-core/bin/self-verify.mjs --root .` reports no `budget-overrun`;
  and `node cadence-core/bin/test.mjs prose` exits 0.

## Notes

Independent of plans 1, 2, 3 and 5 - it shares no file with any of them.
`cadence-core/references/COMMANDS.md` also sits exactly at its budget (4905) but
this plan does not edit it: D-11 says both `--cadence` user surfaces already
shipped in `bd231ec`, so re-editing would burn a budget re-pin for no change in
what a user reads.
