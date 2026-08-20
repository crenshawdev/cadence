---
phase: 2
plan: 1
requirements:        # none seeded for v3.5.6 - planned against CONTEXT.md AC1-AC7, see Notes
files:
  - cadence-core/bin/lib/adjudication-record.mjs
  - cadence-core/bin/adjudication-record.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/references/review-triggers.md
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The adjudication record nobody can recount - Plan 1 (the write path)

## Goal

A gate fire stops summarizing itself. Every blocking or adjudicated fire writes
one committed record per finding raised per raising voice - the voice and model,
the severity as raised, the claim and failure scenario VERBATIM, full 40-character
`base_id`/`head_id`, and a ruling - so a refutation can be audited by checking out
the head commit and opening the cited `file:line`.

## Must be true when done

- A blocking or adjudicated fire leaves
  `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json` beside its
  sibling `REVIEW-<trigger>-<discriminator>.md`, discriminated by the same rule
  that file already uses, and never inside `<plandir>/reports/`.
- That file holds one entry per finding RAISED - not one per survivor, and not
  one per merged finding: two voices raising one convergent finding leave two
  entries, each naming its own voice and model, with the convergence marked on
  both.
- Each entry's claim and failure scenario are byte-identical to what that
  reviewer returned, and a payload whose ruling side paraphrases either one is
  REFUSED rather than stored.
- Each entry carries full 40-character `base_id` and `head_id` even when the
  caller spelled the range 7-char or as the literal `HEAD`, so the auditor path
  `git checkout <head_id>` then open `file:line` is mechanical.
- The seam refuses a ruling outside `survived` | `downgraded` | `refuted`, a
  `refuted` entry with no counter-evidence naming contradicting code, and a
  `survived` entry with no fix commit id.
- An entry whose cited `file` does not exist at `head_id` is stored WITH a flag
  and never dropped, and a check that could not run at all is reported as such
  rather than flagging every entry.
- `references/review-triggers.md` step 5 rules per voice and merges only
  afterwards, and `references/triage-gate.md`'s blocking arm carries the same
  record obligation as the adjudicated one.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array at every commit in this plan.

## Context

Locked by `.planning/phases/2/CONTEXT.md`: D-02 the record is written on the
BLOCKING arm as well as the adjudicated one, the advisory arm excluded, ruling
enum exactly three values; D-03 a validating seam taking a payload FILE that
DERIVES the counts, never a hand-assembled `Write`; D-04 one entry per finding
per raising voice, with the pre-ruling merge moved; D-05 this is a fourth file
and subsumes neither `FINDINGS.json` nor `verifier-findings.json`; D-06 one
record per FIRE at `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`;
D-07 the ORCHESTRATOR composes the payload; D-08 the seam resolves full SHAs
itself; D-09 the seam flags an unresolvable citation and stores it anyway; D-12
the subcommand needs a `CONTRACTS` row before any prose invokes it. Out,
deliberately: backfilling, the advisory arm, tightening `parseAdjudication`, and
both phase-3 surfaces (`cmdLeaseCheck`'s byte-equality exemption and the
empty-range risk-check deadlock). AC4's trace flags and AC6's report change are
PLAN-2's; this plan writes the record and nothing reads it back yet.

## Tasks

### Task 1: State the record's grammar as a pure module

- **Files:** cadence-core/bin/lib/adjudication-record.mjs (new), cadence-core/bin/adjudication-record.test.mjs (new)
- **Action:** Add a pure module under `cadence-core/bin/lib/` that answers, for
  one composed payload, either a refusal naming the entry and the rule it broke
  or the entry list plus the counts derived from the rulings. Pure in the sense
  `cadence-core/bin/lib/report-rotation.mjs` and `cadence-core/bin/lib/lease-grammar.mjs`
  are - classify, never emit, no fs, no git, no env, no process - so the seam in
  task 2 owns every I/O decision. Add NO CLI entry point and no
  `cadence-core/bin/lib/arg-contract.mjs` `CONTRACTS` row: `self-verify.mjs`
  check 14 records that a `lib/*.mjs` module is one prose never invokes.
  The rules it holds:
  (a) ONE ENTRY PER FINDING RAISED PER RAISING VOICE (D-04, AC1). The payload
  carries, per voice, the reviewer's returned findings object VERBATIM as that
  reviewer returned it, that voice's model, and one ruling per returned finding.
  A returned finding with no ruling, and a ruling naming no returned finding,
  are both refusals - AC1 asks for one entry per finding RAISED, not one per
  survivor, so an unruled finding cannot be silently absent.
  (b) THE VERBATIM COMPARISON, which is what makes AC2 mechanical. The entry's
  claim and failure scenario are copied from the RETURNED findings side and
  never from the ruling side, and a ruling that restates either field with bytes
  that differ is REFUSED. This is why the reviewer's returned object has to ride
  the payload alongside the rulings instead of being summarized into it: without
  a second copy the module has nothing to compare a paraphrase against, and the
  paraphrase is the tampering surface the roadmap names.
  (c) THE THREE REFUSALS (AC3): a `ruling` outside `survived` | `downgraded` |
  `refuted`; a `refuted` entry with no counter-evidence naming contradicting
  code; a `survived` entry with no fix commit id. Planner's call, recorded here
  because AC3 bounds only absence: refuse a blank or non-hexadecimal fix commit
  id too - an auditor has to run `git show` on that value, and a string that
  cannot be a commit id fails them exactly as an absent one does.
  (d) SEVERITY AS RAISED is one of the four the review subsystem already uses.
  Carry the vocabulary as this module's own frozen list and pin it in the test
  against the `severity` enum inside `FINDING_SCHEMA`, which
  `cadence-core/bin/review-provider.mjs` already exports - the same
  hand-maintained-then-compared shape `cadence-core/route-table.json` states its
  reason for on `risk_surface_categories`, and it needs no new export.
  (e) CONVERGENCE IS DERIVED, NEVER ASSERTED (D-04). The module can see every
  voice in the fire, so it marks an entry whose `file`, `line` and `claim` were
  also raised by another voice. It never collapses the two - "the raising voice"
  becoming a list is the alternative D-04 rejected.
  (f) THE COUNT DERIVATION is a separately exported function over an entry list,
  answering the survived, downgraded and refuted totals plus the raised total,
  so a reader can recount a record it did not write. That export is what PLAN-2
  runs.
  (g) THE RECORD STORES NO COUNT OF ITS OWN. The numbers are derived on every
  read; a stored count is a second place for the record to disagree with itself,
  and D-01's cross-check is between the RECORD and the TRACE.
  Fail closed on every unreadable input - a refusal, never a best-effort entry
  list - and give it the header this tree's lib modules carry: the defect it
  closes, and why the verbatim comparison needs both sides of the payload.
- **Verify:** `node --test cadence-core/bin/adjudication-record.test.mjs` passes
  with named cases for: two voices raising one convergent finding producing TWO
  entries each marked convergent (AC1); a payload whose ruling side paraphrases a
  claim refused (AC2); the three AC3 refusals, one fixture each; a returned
  finding with no ruling refused; and the derived counts over a mixed-ruling
  fixture. The severity case fails if the module's list and `FINDING_SCHEMA`'s
  enum differ. Then edit the module to merge convergent findings into one entry,
  re-run, and the AC1 case FAILS; restore it and it passes. `node
  cadence-core/bin/test.mjs --list` shows the `adjudication-record` stem, so CI
  runs it.

### Task 2: Add the validating seam that writes the record

- **Files:** cadence-core/bin/lib/arg-contract.mjs (its `CONTRACTS['planning.mjs']` table), cadence-core/bin/planning.mjs (its `COMMANDS` map and a handler beside `cmdRiskCheckRun`), cadence-core/bin/planning.test.mjs
- **Action:** Declare the row FIRST, then the handler (D-12): `self-verify.mjs`
  check 2 reports `unknown-subcommand` against prose whose subcommand has no row,
  and check 14 reports `uncontracted-script` the other way. Name the subcommand
  `adjudication`, a SINGLE word: `subcommandKey` consumes a second word only for
  the families listed in `TWO_WORD`, so a two-word spelling would have to widen
  that Set as well, and one operation does not earn it - `plan-overlap`,
  `lease-check` and `criteria-coverage` are the single-word precedent. Its flags,
  every one `refuse` on both the value and the bare axis, which is the
  disposition this table's own header calls the refusal `lib/seam-input.mjs`'s
  `flagValue` writes by hand: `--phase` (type `phase`, required), `--trigger`
  (string, required), `--discriminator` (string, required), `--base` (string,
  required), `--head` (string, required), `--payload` (string, required),
  `--round` (type `int`, NOT required, default 1).
  `--base` and `--head` are required for the reason the `risk-check run` row
  already states - a defaulted head is a range the caller never stated, and this
  record IS the evidence of what was judged.
  `--round` exists because a blocking re-arm (`references/triage-gate.md`, ONE
  round) is a SECOND fire of the same trigger on the same plan: it resolves to
  the same discriminator, so without it round two's record replaces round one's
  rulings - the destruction phase 1 fixed for reports, reappearing on the very
  artifact this phase exists to make durable.
  The handler: read the payload through the existing `readJsonPayload(opts.payload)`,
  the reader `uat merge` already uses, whose `no-payload` / `bad-payload` split
  is exactly what a truncated or never-written file looks like. Run task 1's
  module and relay its refusal as `ok:false` naming the entry and the rule.
  Resolve the range through the existing `resolveRange`, which already runs
  `git rev-parse --verify <ref>^{commit}` on both ends and redacts a git failure
  through `redactUrl`; every entry stores the RESOLVED ids and never the caller's
  spelling (D-08 - measured, 44 of 52 receipts here carry a 7-char base and
  `cadence-core/workflows/execute.md` passes the literal `HEAD`). A range that
  does not resolve is a REFUSAL, not a record with null ids: a record whose head
  cannot be checked out is not the artifact this phase exists to produce.
  Write to `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json` at
  round 1 and `...-<discriminator>-r<round>.json` at every round above it (D-06,
  AMENDED - see Notes), through `atomicWrite`, resolved under the run's `--dir`
  exactly as `uat merge` resolves `FINDINGS.json` and never as a bare relative
  path, or every run on a temp tree writes into the process cwd. Round 1 keeps
  the sibling REVIEW file's exact name, so the amendment costs the D-06 symmetry
  on re-arms alone and on no ordinary fire.
  REFUSE rather than overwrite when the resolved path already exists: a caller
  that forgot `--round` is the failure this widening is FOR, and a silent
  replacement there lands in exactly the state the flag was added to prevent.
  The refusal names the existing path and the round it holds.
  `--trigger` and `--discriminator` reach a FILENAME, so validate both against a
  strict conservative grammar and REFUSE anything outside it rather than
  sanitizing: `milestone-prune --label` was only trimmed before
  `join(dir, '_archive-' + label)` and a label from PROJECT.md escaped the tree
  (VAL-01). Neither may carry a path separator, a `.`, or any character outside
  the set existing `REVIEW-*` filenames use.
  Return the written path and the counts task 1's module derived on the envelope,
  so PLAN-2's receipt has the figures without anyone recounting by hand.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with cases
  built on a fixture `.planning` tree and a real git repository under
  `mkdtempSync` (the pattern that file already uses) showing: the record landing
  at the D-06 path with the sibling REVIEW discriminator; every entry's
  `base_id` and `head_id` 40 characters when the caller passed a 7-char base and
  the literal `HEAD`; a `--discriminator` carrying a path separator refused
  `ok:false` with NO file created anywhere; an unresolvable `--head` refused with
  no file created. Plus the re-arm case, which is the one this task exists to
  close: the same trigger, plan and discriminator written twice with `--round 1`
  then `--round 2` leaves BOTH files on disk with round one's rulings unchanged
  byte for byte, and the same pair written twice WITHOUT `--round` on the second
  call is refused `ok:false` naming the existing path, with that file also
  unchanged byte for byte.
  `node --test cadence-core/bin/arg-contract-adoption.test.mjs`
  passes - it spawns the real binary for every declared refusal on the new row.
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`.

### Task 3: Ground every citation at the head commit

- **Files:** cadence-core/bin/planning.mjs (the handler task 2 added), cadence-core/bin/planning.test.mjs
- **Action:** D-09/AC5. Before the record is written, ask git whether each
  entry's cited `file` exists at the resolved `head_id` - `git cat-file -e
  <head_id>:<file>` - and MARK the entry when it does not. A marked entry is
  still stored and never dropped: the mark is the auditor's warning that the
  citation cannot be opened, and dropping it would delete the very finding whose
  grounding is in question. This buys the mechanical auditor path instead of
  demonstrating it, and it is needed because nothing upstream checks either
  field - `cadence-core/bin/review-provider.mjs`'s `FINDING_SCHEMA` bounds `file`
  only as a non-empty string of at most 1024 characters, and
  `skills/cad-reviewer-contract/SKILL.md` calls `line` best-effort in as many
  words. Run it under the repository top `resolveRange` already returns, the way
  `cmdRiskCheckRun` reads its diff with `-C`, so the answer is the repository's
  and not the process cwd's. A check that could not run AT ALL - no repository,
  git absent, the invocation itself failing - is reported once on the envelope
  and does NOT mark every entry: an unprovable citation set is not a bad one,
  which is the rail `land-cleanup.mjs`'s collapsed-stdin defect already cost this
  project once.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with a case
  whose fixture repository has one entry citing a file present at head and one
  citing a path that is not: BOTH entries are present in the written record, only
  the second is marked, and the entry count equals the number of findings raised.
  human-verify (AC5's second half, needs a live cross-model gate fire this
  executor cannot make): on one real fire, run `git checkout <head_id>` from the
  record, open the cited `file:line`, and confirm the code there is what the
  verbatim claim describes.

### Task 4: Move the merge so per-voice attribution survives adjudication

- **Files:** cadence-core/references/review-triggers.md (its `### 5. Combine (review.mode)` section), cadence-core/bin/weight-budgets.json (its review-triggers.md row)
- **Action:** D-04. Today the `panel` arm dedupes exact `file+line+claim` repeats
  and the `adjudicated` arm merges findings raised by more than one reviewer, and
  BOTH happen before any ruling exists - so the pipeline destroys per-voice
  attribution before a record could hold it. Move the merge: the adjudicator
  grounds and rules on every raised finding PER VOICE, and the dedupe and
  convergence merge that produce the survivor LIST happen afterwards, on the
  ruled set. State the reason in a clause - convergence is what makes a
  reviewer's individual hit rate countable, which is the measurable form of
  Cadence's "controls are fallible machinery" claim, and a merged finding has no
  raising voice, only a list. Change NOTHING about what the gate acts on or what
  the user is shown: `cadence-core/references/triage-gate.md`'s adjudicated arm
  presents the survivor list as a numbered multi-select and that list keeps its
  shape and its ordering. Re-pin this surface's row in
  `cadence-core/bin/weight-budgets.json` in the SAME commit (AC7): it sits at
  exactly its 34459-byte ceiling with zero headroom, so any growth is a
  `budget-overrun`. Take the figure from `node cadence-core/bin/weight.mjs --root .`,
  the same measurement library self-verify enforces with.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []` and `node cadence-core/bin/test.mjs prose` passes.
  `grep -n` the section for the per-voice ruling instruction and for the merge
  sentence: the merge line's number is GREATER than the ruling line's, and the
  `adjudicated` bullet no longer states the merge ahead of the grounding.
  `grep -n 'multiSelect' cadence-core/references/triage-gate.md` still shows the
  survivor triage unchanged.

### Task 5: Make step 5 write the record

- **Files:** cadence-core/references/review-triggers.md (its outcome-recording block after step 5), cadence-core/bin/weight-budgets.json (its review-triggers.md row)
- **Action:** Three edits in one block, all about where the record comes from.
  (a) WIDEN THE ARM SCOPING (D-02). The sentence introducing the outcome append
  says it and the reported line are "the ADJUDICATED arm's alone". The RECORD is
  written on the blocking arm too - `route.mjs resolve` returns `plan: blocking`
  and `risk_surface: blocking` at `shipped` stakes, so an adjudicated-only rule
  would record nothing at all on this repository and would exclude the roadmap's
  own sharpest case, which is a `gate_pass`. Widen it rather than reading around
  it. The advisory arm stays excluded and the reason is stated: its reviewer
  writes the findings file and closes its own bracket, and the orchestrator's
  session may end before the return lands, so nothing is positioned to rule. The
  ruling enum stays at exactly three values - no `unadjudicated` fourth.
  (b) ADD THE WRITE INSTRUCTION (D-03, D-07). The ORCHESTRATOR composes the
  payload, because it is the only actor holding both the raised finding bodies
  and the ruling: `review-provider.mjs` returns `findings` on stdout and never
  persists them, its own write records provider, model, effort, tier, duration
  and outcome with no finding field, and `skills/cad-reviewer-contract/SKILL.md`
  specifies a return shape only. It composes a payload FILE inside THIS RUN's own
  scratch directory, the way this file already prescribes for the provider
  payload, and passes it to the seam task 2 added. Restate this file's existing
  rule that the JSON is NEVER hand-assembled with `echo` or a heredoc: the
  record's whole content is verbatim reviewer text with arbitrary quoting, so one
  unescaped quote makes the payload unparseable after the work is already done.
  Say what the payload carries - per voice, the reviewer's returned findings
  object VERBATIM plus that voice's model plus one ruling per returned finding -
  and that the seam refuses a ruling whose restated claim differs from the
  returned one.
  (c) NAME THE PATH AND THE DISCRIMINATOR (D-06):
  `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`, beside the
  sibling `REVIEW-<trigger>-<discriminator>.md`, using the discriminator grammar
  this file already states - `plan-<k>` for a per-plan fire, `<command>-<short
  HEAD sha>` otherwise. Then state the ROUND rule in the same place, because the
  fire site is the only actor that knows which round it is on: a re-arm fired
  under `references/triage-gate.md`'s ONE-round cap passes `--round 2`, landing
  at `...-<discriminator>-r2.json`, and an ordinary fire passes nothing and keeps
  the sibling's exact name. Say plainly that omitting it on a re-arm is REFUSED
  rather than merged or overwritten, and that round one's record is what an
  auditor reads to see a finding that a fix was claimed to close.
  Say in one clause that it does NOT go inside
  `<plandir>/reports/`: `cmdLeaseCheck` exempts exactly one path there by byte
  equality, so anything else staged from that directory returns
  `undeclared-files`. Do not add or alter any `trace append` line in this task -
  the receipt's new flags are PLAN-2's, and a flag with no `CONTRACTS` row yet
  would fail check 2 here. Re-pin the weight row in the same commit (AC7).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []` - which is what proves the row from task 2 covers this
  prose, since check 2 reports `unknown-subcommand` otherwise. `node
  cadence-core/bin/test.mjs prose` passes. `grep -n 'ADJUDICATION-'
  cadence-core/references/review-triggers.md` shows the path with its
  discriminator, and `grep -n 'adjudication --phase'
  cadence-core/references/review-triggers.md` shows one fenced invocation of the
  new subcommand carrying `--payload`. `node --test
  cadence-core/bin/prose-agreement.test.mjs` passes with GAT-04 still collecting
  exactly four outcome event names.

### Task 6: Put the same obligation on the blocking arm

- **Files:** cadence-core/references/triage-gate.md (its `blocking` arm), cadence-core/bin/weight-budgets.json (its triage-gate.md row)
- **Action:** D-02. This file's blocking arm settles a fire at two points -
  `gate_pass` when nothing blocker/high survives, `override` when the user
  clears a FAIL - and neither carries a finding body today. State that a blocking
  fire writes the same record at that settle point, and POINT at
  `references/review-triggers.md` step 5 for the payload, the path and the
  discriminator rather than restating them: this file is deliberately re-read at
  the gate step WITHOUT loading that one, so what it owes a coordinator is the
  obligation plus the pointer, and a copy here is a second statement that can
  drift. Say that the advisory arm writes no record and reads as unrecorded, for
  the reason step 5 now states. Introduce NO fifth fenced `trace append --family
  outcome` event name and change no existing receipt line in this task (D-11):
  `prose-agreement.test.mjs`'s GAT-04 asserts every fenced outcome line carries
  `--trigger --plan --base --sha` and that the collected list deep-equals exactly
  `adjudication`, `gate_pass`, `override`, `rearm` - the receipt flags themselves
  are PLAN-2's task 2. Re-pin the weight row in the same commit (AC7): this
  surface sits at exactly its 11037-byte ceiling.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes with
  GAT-04 green and still asserting four event names. `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`. `grep -n 'ADJUDICATION\|review-triggers.md'
  cadence-core/references/triage-gate.md` shows the blocking arm naming the
  record obligation and pointing at step 5, and `grep -c 'family outcome'
  cadence-core/references/triage-gate.md` still returns 3 - the same three
  receipt commands this file carried before the task.

## Notes

- **No requirement ids exist for this phase.** `.planning/ROADMAP.md`'s phase 2
  entry reads `**Requirements:** (seeded at /cad-context)` and none were seeded;
  `.planning/REQUIREMENTS.md`'s `## Active` still reads "No cycle open", which
  `.planning/phases/2/CONTEXT.md` records as a known, deliberately uncorrected
  gap. This plan is written against CONTEXT's AC1-AC7 and the frontmatter
  `requirements:` list is deliberately empty rather than filled with AC ids,
  which are not requirement ids and would trace to nothing at `/cad-audit` -
  the same call phase 1's plan made and shipped.
- **Criteria coverage across both plans.** PLAN-1: AC1 by tasks 1 and 4, AC2 by
  tasks 1 and 2, AC3 by task 1, AC5 by task 3 (its human-verify arm carries the
  live half), AC7 by the same-commit budget re-pins in tasks 4-6 and by the
  `CONTRACTS` row in task 2. PLAN-2: AC4 by its tasks 1, 2 and 4, AC6 by its
  tasks 3 and 4, AC7 again by its re-pins.
- **D-06 IS AMENDED: the record's discriminator carries the re-arm round.**
  D-06 locked the discriminator rule the sibling REVIEW file already uses, and
  `references/review-triggers.md` states in as many words that two fires sharing
  a filename overwrite rather than merge. A capped re-arm round is a second fire
  of the same trigger on the same plan, so under D-06 as written it resolved to
  the same discriminator and its record REPLACED the first round's - the
  self-overwriting evidence phase 1 fixed for reports, reappearing on the
  artifact this phase exists to make durable. The blocking `plan` gate raised it
  as a high finding and the human amended D-06 rather than accept it: tasks 2
  and 5 add a `--round` flag defaulting to 1, round 1 keeps the sibling REVIEW
  file's exact name, and every round above it lands at
  `...-<discriminator>-r<round>.json`. The cost of the amendment is stated
  narrowly: the record and its sibling share a name on ordinary fires and
  diverge on re-arms alone. The sibling REVIEW file's OWN overwrite on a re-arm
  is untouched here - it is a separate producer and a separate decision.
- **The `trigger`-less receipt hole is accepted, not repaired.** CONTEXT's
  flagged assumption measures 47 of 104 outcome receipts on this repo carrying no
  `trigger` field, which `planning.mjs` drops as receipts. This plan keys the
  record on the seam's own `--trigger` flag rather than on a receipt join, so it
  does not inherit the hole; repairing the join is not this phase.
- **Prior art for the structured-flag direction.** A standing capture item
  (recalled from `CAPTURE.md`) records that `lib/trace-suggest.mjs`'s R2 keys its
  re-arm receipt on the `rearm` event's DETAIL text where `triage-gate.md` says
  the trigger travels on the `--trigger` flag. That is the same defect class this
  phase routes around by refusing to put a count in `--detail`, and CONTEXT puts
  repairing `parseAdjudication` explicitly out of scope.
- **Plan shape deviation.** CONTEXT's directive asked for multiple plans and this
  plan honours it, but the two slices are NOT file-independent: PLAN-1 and PLAN-2
  share `cadence-core/bin/planning.mjs`, `cadence-core/bin/lib/arg-contract.mjs`,
  `cadence-core/references/review-triggers.md`,
  `cadence-core/references/triage-gate.md`,
  `cadence-core/bin/adjudication-record.test.mjs` and
  `cadence-core/bin/weight-budgets.json`. `plan-overlap` will therefore report
  overlaps and `execute.md`'s choose_path routes SEQUENTIAL, PLAN-1 first. The
  split is capacity-driven, not independence-driven: ten tasks do not fit one
  plan's ceiling of eight, and the ordering constraint runs the same direction
  anyway - PLAN-2's prose passes flags that PLAN-2's own first task declares, and
  a `CONTRACTS` row must land before the prose that uses it or `self-verify`
  check 2 reports `unknown-flag`.
