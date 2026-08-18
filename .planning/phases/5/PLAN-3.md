---
phase: 5
plan: 3
requirements:
  - SGT-01
files:
  - cadence-core/workflows/suggest.md
  - skills/cad-suggest/SKILL.md
  - README.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 5: The retune says what to change - Plan 3 (SGT-01, the presentation)

## Goal

`/cad-suggest` stops reading as a report. The tweaks the record supports get a
heading of their own - key, current value, direction and target - the receipts
that ask for nothing sit under a separate heading below, and the command ends by
offering to route the change to `/cad-config` rather than by declining to have
an apply arm.

## Must be true when done

- `/cad-suggest <N>` prints a heading carrying only the `suggest` entries, each
  as its config key, its current value, its direction with the target value or
  a stated absence, and the evidence behind it - and no `info` entry appears
  inside that block.
- The `info` receipts sit under their own heading BELOW the tweak block, never
  interleaved with it.
- A run whose record supports no tweak says so in one line under that heading
  rather than printing an empty block with an offer attached to it.
- `/cad-suggest` ends by offering to route the change to `/cad-config`, naming
  the exact tokens it would pass, and applies nothing until the user answers;
  the command still writes no config key itself.
- `skills/cad-suggest/SKILL.md` declares every tool the offer's steps name, and
  its prose names no tool the frontmatter lacks.
- `README.md`'s retune sentence names `/cad-suggest`, says each tweak carries a
  direction and a target value, and states the offer instead of claiming the
  command applies none of them.
- Every surface this plan edits is re-pinned in
  `cadence-core/bin/weight-budgets.json` in the same commit as its edit, every
  `.planning/DOCS-CLAIMS.md` row whose anchor those edits move is re-anchored in
  that same commit, and `node cadence-core/bin/self-verify.mjs` exits 0.

## Context

- D-16: `workflows/suggest.md`'s `present` step is rewritten IN PLACE. The two
  bullets that interleave both kinds today are what makes the output read as a
  report.
- D-11: the command OFFERS to route the change to `/cad-config`, and
  `skills/cad-suggest/SKILL.md` gains the tools that offer needs - its
  frontmatter grants only `Read, Bash` today. The write still happens inside
  `/cad-config`, which accepts `<key>=<value>` tokens directly, so "this command
  writes no config key" stays literally true and the triage-gate posture is
  preserved. `skills/cad-milestone/SKILL.md` is the shipped `SlashCommand`
  precedent - it invokes `/cad-suggest` that way.
- D-18: `README.md`'s retune sentence and claim row README-74 are in this phase,
  because the offer arm is what makes "applies none" misleading.
- D-19: every pin and claim row travels in the same commit as its edit.
- This plan depends on PLAN-2: the keys it presents do not exist until the seam
  returns them.

## Tasks

### Task 1: The present step leads with the tweaks and puts the receipts below

- **Files:** `cadence-core/workflows/suggest.md`,
  `cadence-core/bin/weight-budgets.json`, `.planning/DOCS-CLAIMS.md`
- **Action:** Rewrite the `present` step in place. It opens as it does now, with
  one line naming the scope read and the `events_read` count. Then a HEADED
  block carrying only the `kind: "suggest"` entries, each as a numbered item
  stating the config key (`action`, spelled as returned), the current value, the
  direction and the target value where the seam returned one, and the evidence
  verbatim as the seam computed it. Where the seam returned no target, state
  that absence explicitly and say the record cannot price it - a blank is
  indistinguishable from a forgotten field, and the roadmap's own criterion is
  that a suggestion it cannot price is returned WITHOUT one rather than with a
  guess. Where the current value came back as unset, relay that unset form and
  the level it names as given; do not resolve it to a value here, for the reason
  the seam refuses to. Then a SEPARATE heading below it carrying the
  `kind: "info"` receipts, one line each, with the existing sentence that an
  `info` asks for nothing. The two kinds must never interleave: the two bullets
  that mix them today are the defect. Add the empty-tweaks arm: when the return
  carries `info` entries but no `suggest` entry, the tweak heading still appears
  and carries one line saying the record supports no tweak in this scope, and no
  offer is attached to it - an offer with nothing behind it is the same mute
  output pointed the other way. `capped` and `malformed` keep their one line
  each. Keep the relay-unchanged rule and its paragraph about the arguable
  denominator exactly as they are: this step changes the SHAPE of the
  presentation and recomputes nothing. Leave the `thin_record` step alone - it
  replaces `present` entirely when `suggestions` came back empty. In the same
  commit, re-pin `cadence-core/workflows/suggest.md` in
  `cadence-core/bin/weight-budgets.json` and move the
  `.planning/DOCS-CLAIMS.md` rows this edit touches: SUGGEST-07 (the envelope
  key list, which the seam widened), SUGGEST-08 (the
  `subject`/`evidence`/`action` claim, now a longer list) and SUGGEST-09 (an
  `info` asks for nothing). Re-anchor every OTHER `SUGGEST-*` row whose line
  range this rewrite shifts - that is D-19's rule applied to the rows the edit
  actually moves, and REPORT-13 in this same file is the standing example of
  what leaving one behind costs.
- **Verify:** `cadence-core/workflows/suggest.md`'s `present` step contains two
  distinct headings, one carrying only `suggest` entries and one carrying only
  `info` receipts, with the tweak heading first - readable by opening the file at
  that step. No sentence in the step instructs printing both kinds in one list.
  The `cadence-core/workflows/suggest.md` value in
  `cadence-core/bin/weight-budgets.json` equals
  `wc -c < cadence-core/workflows/suggest.md`. For every `SUGGEST-*` row in
  `.planning/DOCS-CLAIMS.md`, the lines its anchor names in
  `cadence-core/workflows/suggest.md` contain that row's claim, checked by
  reading those exact lines rather than by grepping the file as a whole.
  `node cadence-core/bin/self-verify.mjs` and
  `node --test cadence-core/bin/*.test.mjs` both exit 0.
  (human-verify: needs a live `/cad-suggest` run - run `/cad-suggest 2` in a
  session with Cadence installed and confirm the output shows a tweak heading
  above a receipts heading, with every entry under the tweak heading carrying a
  config key, a current value and either a target value or a stated absence, and
  no receipt line inside that block.)

### Task 2: The command offers to route the change, and declares the tools that offer needs

- **Files:** `cadence-core/workflows/suggest.md`, `skills/cad-suggest/SKILL.md`,
  `cadence-core/bin/weight-budgets.json`, `.planning/DOCS-CLAIMS.md`
- **Action:** Replace the `present` step's closing paragraph - the one that
  says to STOP, apply NOTHING and that "There is no apply arm here to decline" -
  with the offer D-11 settles. After the receipts heading, the step names the
  exact `/cad-config <key>=<value>` tokens the accepted tweaks would become, for
  the entries that carry a target value, and ASKS whether to run `/cad-config`
  with them. Keep the posture the sentence being replaced was protecting: the
  user decides, an unanswered offer means no change, and nothing is applied on
  the way to asking. Say plainly WHERE the write happens - inside `/cad-config`,
  which accepts `<key>=<value>` tokens directly - so the read-only claim stays
  literally true of this command. A tweak the seam could not price has no token
  to offer and is named in the block without one; do not synthesize a value for
  it. Update the `guardrails` block in the same file so its first bullet no
  longer claims the command is read-only in a way the offer contradicts: state
  that this command writes nothing itself and that the write, if the user says
  yes, is `/cad-config`'s. The no-fabricated-figures and no-phantom-key bullets
  stay as they are. Then bring `skills/cad-suggest/SKILL.md` up to what the
  offer does: its `allowed-tools` grants only `Read` and `Bash` today, so add
  every tool the offer's steps actually name - `SlashCommand` at minimum, since
  `/cad-config` is how the write happens, and the ask-user tool as well IF the
  offer is presented through that seam. Declare exactly the tools the prose
  names and no others; an offer naming an action the skill cannot take degrades
  silently to a sentence, and a declared tool no step names is an unearned
  grant. `skills/cad-milestone/SKILL.md` is the shipped precedent for the
  `SlashCommand` grant. Update the skill's `objective` so it stops promising
  "nothing applied" in terms the offer contradicts, keeping the truthful half:
  the command relays the record, never recomputes it, and writes no config key
  itself. In the same commit, re-pin both
  `cadence-core/workflows/suggest.md` and `skills/cad-suggest/SKILL.md` in
  `cadence-core/bin/weight-budgets.json`, and move the
  `.planning/DOCS-CLAIMS.md` rows SUGGEST-11, SUGGEST-12 and SUGGEST-16 - the
  three that carry the apply posture - re-anchoring any other `SUGGEST-*` row
  this edit shifts.
- **Verify:** `grep -n "There is no apply arm" cadence-core/workflows/suggest.md`
  returns nothing, and the step's closing paragraph names `/cad-config` and the
  `<key>=<value>` form. `skills/cad-suggest/SKILL.md`'s `allowed-tools` list
  contains every tool named in its own prose and in the `present` step's offer,
  and contains no tool neither of them names - checked by reading both files and
  listing the tool names each mentions. Both
  `cadence-core/workflows/suggest.md` and `skills/cad-suggest/SKILL.md` values
  in `cadence-core/bin/weight-budgets.json` equal those files' `wc -c` output.
  SUGGEST-11, SUGGEST-12 and SUGGEST-16 each name a line range whose bytes carry
  that row's claim. `node cadence-core/bin/self-verify.mjs` and
  `node --test cadence-core/bin/*.test.mjs` both exit 0.
  (human-verify: needs a live `/cad-suggest` run - run `/cad-suggest 2` in a
  session with Cadence installed, confirm the run ends by offering to route the
  change to `/cad-config` and naming the tokens it would pass, decline the
  offer, and confirm `git diff .planning/config.json` is empty afterwards.)

### Task 3: README's retune sentence states the offer and names the command

- **Files:** `README.md`, `.planning/DOCS-CLAIMS.md`
- **Action:** Rewrite the retune sentence in `README.md`'s `/cad-milestone`
  paragraph - the one beginning "It also reads the run record back at you". Three
  things change and nothing else in that paragraph does. It names `/cad-suggest`,
  the command a reader can run, rather than `trace suggest`, the seam under it -
  a defect `.planning/CAPTURE.md` recorded in phase 3, with no claim row over the
  command NAME. It says each tweak carries a direction and a target value rather
  than only its config key and receipts. And it states the offer instead of
  claiming the command "applies none of them without your say" - D-11's offer arm
  is exactly what makes that phrasing misleading, so the sentence must say the
  command writes nothing itself and offers to route an accepted tweak to
  `/cad-config`. Keep the sentence's existing examples (a gate whose fires kept
  coming back empty, a role that never needed its escalation) - they are accurate
  and they are what make the claim concrete. The `/cad-suggest` bullet in
  README's command list makes the SAME "applies none of them" claim and names no
  direction or target, so it moves with the sentence for D-18's stated reason -
  the offer arm is what makes that phrasing misleading, and the reason does not
  stop at one line. Verified while planning: no `.planning/DOCS-CLAIMS.md` row
  carries that bullet's apply claim (README-77 over the same range asserts only
  that the listed commands exist), so that half is an edit with no row to move.
  In the same commit update
  `.planning/DOCS-CLAIMS.md` row README-74, whose claim text currently reads that
  `trace suggest` turns the milestone's trace into evidence-backed retune
  suggestions and applies none: both its anchor and its claim must describe the
  sentence as it now stands. `README.md` carries no `weight-budgets.json` row, so
  no pin moves here.
- **Verify:** The retune sentence in `README.md` contains `/cad-suggest`, names a
  direction and a target value, and contains no phrasing claiming the command
  applies none of the suggestions.
  `grep -n "trace suggest" README.md` returns nothing - that string appears on
  exactly one line today, the retune sentence.
  `grep -n "applies none" README.md` returns exactly one line, the
  `/cad-minimalism-review` bullet, which this task does not touch - the phrase
  sits on three lines today and the other two are the retune sentence and the
  `/cad-suggest` bullet.
  `.planning/DOCS-CLAIMS.md` row README-74 names a `README.md` line whose bytes
  contain that row's claim, checked by reading that exact line.
  `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Notes

- CONTEXT's fifth flagged assumption (whether SGT-01 splits again at the
  seam/presentation line) is settled YES: PLAN-2 owns the return shape and this
  plan owns the presentation. The two share no file, but this plan shares
  `.planning/DOCS-CLAIMS.md` and `cadence-core/bin/weight-budgets.json` with
  PLAN-1, so all three plans are SEQUENTIAL - PLAN-1, then PLAN-2, then PLAN-3.
- AC3 and AC4 are `human-verify` in CONTEXT and stay so here: proving them needs
  a live `/cad-suggest` run, which the execution environment cannot perform.
  Each task carries the structural check the executor CAN run beside the walk the
  user performs.
- The phase-level `## AC7: watched failures` record - the two SHAs extracted per
  line from the falsifier headers in PLAN-1 and PLAN-2 - belongs in `SUMMARY.md`
  and is the orchestrator's to append; the executor contract forbids an executor
  writing that file, and phase 4 halted at a checkpoint on exactly that.
