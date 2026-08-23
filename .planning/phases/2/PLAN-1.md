---
phase: 2
plan: 1
requirements:
  - RBK-01
files:
  - cadence-core/bin/lib/cite-surfaced.mjs
  - cadence-core/bin/cite-surfaced.test.mjs
  - cadence-core/bin/lib/cite-cited.mjs
  - cadence-core/bin/cite-cited.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
---

# Phase 2: The read-back gate - Plan 1

## Goal

The count itself exists as a deterministic seam: for a planned phase, one JSON
object that names what the recall pass surfaced and what the produced PLAN
cites, per item, with the arms that cannot be joined visibly unjoinable. This
plan delivers the subcommand and its two readers; the `/cad-plan` wiring and the
trace event are plans 2 and 3.

## Must be true when done

- `node cadence-core/bin/planning.mjs cite-count --phase <N> --payload <file>`
  emits one JSON object carrying a `surfaced` count and id list, a `cited` count
  and id list, and a `cited_by_kind` breakdown whose D-NN, CAPTURE and deviation
  arms are named separately.
- A payload row sourced under `phases/<the queried N>/` is absent from
  `surfaced`, and a row sourced under an archived same-numbered phase is
  present.
- A plan's bare `D-NN` mention is read as its own phase's, and a
  phase-qualified one as that phase's, in each of the four spellings measured on
  this corpus.
- Running the subcommand twice over an unchanged plan and payload writes
  byte-identical stdout, and the run's trace records no `lifecycle/dispatch`
  event for it.
- A run whose effective `memory.backend` is `none` answers with `backend: none`
  on the envelope and needs no payload, while a `builtin` run with no
  `--payload` is refused rather than answered.
- The subcommand's name carries no `recall` token, and no new prose line puts
  `recall` and `planning.mjs` together.

## Context

Locked by `phases/2/CONTEXT.md`: D-07 puts this in `planning.mjs` as a
subcommand, not a new bin. D-01 makes the match PER ITEM with a `cited_by_kind`
breakdown; D-02 says only CONTEXT decisions carry an id, so the CAPTURE and
deviation arms report as unjoinable, never as zero. D-03 makes the surfaced set
a payload FILE, the `--payload` shape `adjudication` and `deferred record`
already read. D-04 excludes own-phase rows and keeps archived same-numbered ones.
D-09 makes the cited side a textual scan of the whole `PLAN*.md` with no
fence-awareness; D-10 scopes a bare `D-NN` to the plan's own phase. D-11 counts
against the bounded `results`, never `total`. D-06 makes `memory.backend: none`
a third state on the record. D-13 forbids the token `recall` in the name.
Out of scope here: the trace append (plan 2), every `workflows/plan.md` edit
(plan 2), and any refusal of a plan - this seam reports and never gates.

## Tasks

### Task 1: The surfaced set, own-phase scoped and kinded

- **Files:** cadence-core/bin/lib/cite-surfaced.mjs, cadence-core/bin/cite-surfaced.test.mjs
- **Action:** A new pure module in the mold of `lib/lease-grammar.mjs` and
  `lib/risk-diff.mjs`: no disk, no emit, no exit, no `Date`, no randomness, and
  the caller owns every refusal sentence. It takes a parsed recall envelope and
  the queried phase's own spelling, and returns the surfaced rows. Read the
  envelope's `results` array and NOTHING else - never `total` (D-11: `--top`
  defaults to 5 and the reconstructed phase-1 query returned `total: 441`
  against 5 results, so counting against `total` caps the reported rate near 1%
  on a set the planner was never shown). Drop a row whose `source` starts with
  `phases/<the queried spelling>/` and keep every other row, which is what
  leaves an ARCHIVE.md row (`parseArchiveRows` composes `<label>/phases/<n>/...`,
  so it never starts with `phases/`) and an `_archive-v*/<N>/` row in - D-04:
  a plan trivially cites its own CONTEXT, 1028 own-phase D-NN mentions were
  measured across this corpus, so admitting those rows reads near-100% on every
  phase that ran `/cad-context`. Derive each row's KIND from the trailing
  artifact name in `source`: `CONTEXT.md` is `decision`, `CAPTURE.md` is
  `capture`, `SUMMARY.md` is `deviation`, `UAT.md` is `uat`; a source matching
  none of the four gets no kind and is reported rather than silently binned,
  because a row counted in `surfaced` and in no arm makes the breakdown stop
  reconciling. Only a `decision` row carries an ID, and it is read out of the
  snippet's own head: `parseContextDecisions` pushes `line.replace(/^- /, '')`
  so the snippet begins `D-09 (deviation edge): ...`, and its phase is the `<n>`
  of the `phases/<n>/` segment in `source` (D-10 compares the SOURCE's phase,
  not the row's `phase` field). Never synthesize an id from corpus position -
  D-02: it would break determinism the moment a bullet is added above the row,
  the instability `parseArchiveRows`' "ARCHIVE.md LAST, and the position is
  load-bearing" comment exists to avoid. Spell an id `<source>#<D-NN>` so a live
  `phases/1/CONTEXT.md#D-09` and an archived `v3.5.3/phases/1/CONTEXT.md#D-09`
  stay separable. A malformed row (no `source`, a non-object) contributes
  nothing and is reported, never a throw - a payload is a file a caller wrote.
- **Verify:** `node --test cadence-core/bin/cite-surfaced.test.mjs` passes with
  cases proving: a row sourced `phases/2/CONTEXT.md` is absent when the queried
  phase is 2 while `_archive-v3.5.0/2/CONTEXT.md` and
  `v3.5.3/phases/2/CONTEXT.md` are both present; a 5-result envelope carrying
  `total: 441` yields 5 surfaced rows and never 441; a CONTEXT row's id reads
  `phases/1/CONTEXT.md#D-09` from a snippet beginning `D-09 (deviation edge):`;
  a CAPTURE, SUMMARY and UAT row each carry their kind and no id; and a row
  whose `source` names none of the four artifacts is reported rather than
  counted into an arm.

### Task 2: The cited mentions, bare and phase-qualified

- **Files:** cadence-core/bin/lib/cite-cited.mjs, cadence-core/bin/cite-cited.test.mjs
- **Action:** A second pure module beside task 1's, same discipline. It takes
  plan text and the plan's own phase spelling and returns every `D-NN` mention
  with the phase it is scoped to. The scan is TEXTUAL over the whole file and
  fence-awareness is NOT required (D-09: measured across all 47 `PLAN*.md` under
  `.planning/`, 1041 D-NN mentions appear and 0 of them are inside a fenced
  block, with 43 of 47 files carrying at least one). Match the same number shape
  `parseContextDecisions` accepts on its own bullets. A mention is
  PHASE-QUALIFIED when the text immediately before it names a phase and is
  scoped to that phase; otherwise it is BARE and scoped to the plan's own phase
  (D-10: of 1028 D-NN mentions 23 are phase-qualified, 2.2%, and since
  D-numbers restart per phase, matching by number alone makes the collision rate
  near-total). The qualifier grammar must admit the four spellings measured on
  this corpus - `phase 2 D-02`, `` `phases/1/CONTEXT.md` D-13 ``,
  `` `phases/5/CONTEXT.md`: D-01 `` and `` `phases/2/CONTEXT.md`'s D-01 `` -
  which means allowing an intervening backtick, colon, possessive and
  whitespace run between the phase reference and the number, and nothing that
  would let an unrelated phase number several words back capture a mention.
  Return the mentions with their resolved scope rather than a set, so the
  caller can count distinct pairs itself; do not deduplicate here, because
  `.planning/phases/1/PLAN-2.md:285` is the case where one line stands for two
  distinct surfaced rows and the caller owns that arithmetic.
- **Verify:** `node --test cadence-core/bin/cite-cited.test.mjs` passes with
  cases proving: in a plan whose own phase is 2, a bare `D-08` scopes to 2 while
  each of the four measured qualified spellings scopes to the phase it names;
  a `D-08` inside a fenced block is still a mention; `D-2.1` is matched on the
  same shape `parseContextDecisions` accepts; and a sentence naming a phase
  several words before an unrelated `D-01` does not read as qualified.

### Task 3: The `cite-count` subcommand and its envelope

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs
- **Action:** Declare a `cite-count` row in `CONTRACTS['planning.mjs']` in
  `lib/arg-contract.mjs` - ONE word, never a two-word spelling, since
  `subcommandKey` consumes a second word only for the `TWO_WORD` families and one
  operation does not earn widening that Set (the `adjudication` precedent). The
  row declares `--phase` (required, `phase`, refuse/refuse), `--payload`
  (optional, `string`, refuse/refuse) and `--point` (optional, `string`,
  refuse/refuse); every entry states all four fields, since
  `arg-contract.test.mjs` walks the whole table and a row without a complete
  grammar reddens. `--payload` is a FILE and never inline JSON, the rule the
  `adjudication` row's comment already states. `--point` is an ENUM the
  declaration cannot express, so its two values (`planned` and `committed`) are
  refused by the handler in this file's own `bad-args` vocabulary, the carve-out
  `capture --kind must be one of ...` already occupies. Then add the handler
  beside `cmdPlanOverlap` and `cmdPlanSize`, one `COMMANDS` entry, and one entry
  in this file's header Subcommands block - this file grows by dispatch-table
  entry, never by if-chain. The handler resolves `--phase` through
  `requirePhaseArg` (the DIRECTORY is the caller's spelling, only the echoed
  `phase` is the number, the D-02 rule `cmdPlanOverlap` states), reads the
  payload through `readJsonPayload` (an absent `--payload` must be refused
  rather than fed to stdin, the reason `cmdAdjudication` states - task 4
  qualifies that refusal by backend), reads the phase's plan files through
  `listPlanFiles` so this reader and `plan-overlap` cannot disagree about what a
  plan file is, and joins task 1's rows against task 2's mentions PER ITEM: a
  surfaced `decision` row is cited when some mention carries the same number AND
  the same scope phase as that row's source phase. Emit `phase`, `point` when
  given, the plan file names read, `surfaced` as a count plus its id list,
  `cited` as a count plus an explicit id list that is a subset of the surfaced
  ids (AC1 requires a list, never a number alone), and `cited_by_kind` carrying
  all four arms ALWAYS, including as zero - `decision` with `surfaced` and
  `cited`, and `capture`, `deviation` and `uat` each with `surfaced` and an
  explicit unjoinable mark, because D-02 requires those arms to read as
  unjoinable rather than as silently zero, and this codebase's rule is that
  absence and silence are different answers. Key order is fixed and the output
  is compact, the seam contract this file's header states. Note that under
  D-04 plus D-10 a bare mention can only ever match an archived same-numbered
  phase's decision; that is the locked consequence of the two rules and is not
  to be "fixed" by widening either. Do not put `recall` and `planning.mjs`
  together on any line of new prose in this file or in the table - `BULK_SHAPES`
  watches that pairing and self-verify files `bulk-output-unregistered` for it.
- **Verify:** `node cadence-core/bin/planning.mjs cite-count --phase 2 --payload
  <a fixture payload> --dir <a fixture .planning>` prints one JSON line carrying
  `surfaced`, `cited` and a `cited_by_kind` with four arms; the same call with a
  bare `--payload`, a bare `--point` and a `--point` value outside the two each
  exit 1 with an `ok:false` line naming the flag; and `node --test
  cadence-core/bin/arg-contract.test.mjs cadence-core/bin/arg-contract-adoption.test.mjs`
  reports 0 failures with the new row exercised by the adoption census.

### Task 4: The `memory.backend` third state

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Make the handler read the effective `memory.backend` across the
  config layers through `mergeLayers`, the same way `cmdRecall` does, with the
  schema default `builtin` for an unset key - this repository sets no
  `memory.backend` and runs that default, so the off arm has to be constructed
  to be exercised at all (D-06). On `none` the answer carries `backend: 'none'`
  on the envelope, mirroring `cmdRecall`'s own `{backend:'none', results:[],
  total:0}` shape and omitting the field otherwise, and `--payload` is NOT
  required, because `workflows/plan.md` skips the recall call entirely on that
  path so no envelope exists to hand over (D-06). On `builtin` an absent
  `--payload` stays the refusal task 3 wrote, in this file's `bad-args`
  vocabulary. This is what makes three runs separable by their recorded fields
  alone: `backend: 'none'` is one state, a `surfaced` count of zero without that
  field is a second, and a non-empty `surfaced` with `cited` zero is a third.
  Do not invent a fourth field to say the same thing, and do not let the backend
  read change the cited-side arithmetic on the `builtin` path.
- **Verify:** `node cadence-core/bin/planning.mjs cite-count --phase 2 --dir <a
  fixture .planning whose config.json sets memory.backend to none>` exits 0 with
  a line carrying `backend` as `none` and no `--payload` passed, while the same
  call against a fixture with no `memory.backend` key exits 1 with an
  `ok:false` line naming the missing payload.

### Task 5: The seam's stated behavior, at the CLI

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Add a `cite-count` section to this file, built with the existing
  `makeTree` fixture builder and the `execFileSync` spawn shape the rest of the
  file uses, asserting the shapes AC1, AC2 and AC6 name. The JSON shapes
  asserted here ARE the interface contract, so assert the fields and their
  meanings and not just exit status: the `surfaced` count and ids, the `cited`
  count and explicit id list, and `cited_by_kind`'s four arms with the CAPTURE
  and deviation arms reading unjoinable rather than zero. Prove the own-phase
  exclusion in both directions on ONE payload (a `phases/2/CONTEXT.md` row and an
  `_archive-v3.5.0/2/CONTEXT.md` row, queried at phase 2), so a rule that dropped
  both or kept both fails. Prove determinism by spawning twice over the
  unchanged fixture and comparing stdout BYTE for byte, and prove no subagent by
  reading the fixture's `trace.jsonl` after the run and asserting it holds no
  `lifecycle` `dispatch` event attributable to this call. Every fixture is a
  scratch tree; nothing here may reach this repository's own `.planning`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` reports 0
  failures, and deleting the own-phase exclusion from `lib/cite-surfaced.mjs`
  makes exactly the AC2 case fail rather than the whole section.

## Notes

- Plan shape deviation, recorded per the dispatch instruction: CONTEXT's
  directive puts the three-state separation (D-06 / AC5) in the third slice.
  Its SEAM half is task 4 here instead, because plan 2's `workflows/plan.md`
  prose prescribes a `--payload`-less call on the `none` path and the seam has
  to accept that call before prose instructs it. The RECORD half of AC5 - three
  runs distinguishable on disk - stays in plan 3.
- All three plans of this phase declare `cadence-core/bin/planning.mjs` and
  `cadence-core/bin/planning.test.mjs`, so they are SEQUENTIAL and must not run
  concurrently. `plan-overlap` will report the shared paths; that is the
  expected answer here, not a defect.
- The `cited_by_kind` `uat` arm is not named in AC1, which requires the D-NN,
  CAPTURE and deviation arms separately. It is present because recall's corpus
  walk puts `phases/<n>/UAT.md` rows in `results`, so a surfaced UAT row would
  otherwise be counted in `surfaced` and in no arm, and the breakdown would stop
  reconciling with the headline count.
- `lib/arg-contract.mjs`'s header says `arg-contract.test.mjs` walks "all 156"
  flag rows; the table already holds 170 before this phase adds any. The count
  was stale before this work and correcting it is left out of these tasks
  deliberately - see the return marker.
