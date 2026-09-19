---
phase: 1
plan: 2
requirements:
  - MSR-05
  - TRC-05
files:
  - cadence-core/bin/lib/subagent-transcript.mjs
  - cadence-core/bin/subagent-transcript.test.mjs
  - cadence-core/bin/lib/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.test.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/workflows/report.md
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: Make the record say what happened - Plan 2

## Goal

Two figures the rest of this cycle argues from become consumable and complete: a
bracket records the worker's cache traffic, and the worker's own `duration_ms` -
written onto every bracket since `v3.7.2` and read by nothing - reaches both
surfaces that price a dispatch.

## Must be true when done

- A bracket close records cache figures and `planning.mjs trace render` reports
  them on the bracket row; a close carrying none omits the keys entirely rather
  than writing zeros.
- `roles.tokens` is byte-identical with and without the cache figures present -
  they ride the bracket and are never folded into the per-role token bill.
- `/cad-report` prints a per-dispatch figure sourced from the bracket's
  `duration_ms`, labelled apart from the existing minutes column derived from
  `ms`, and prints `unrecorded` for a bracket whose close carried no wall clock.
- `/cad-suggest` prints a receipt denominated in `duration_ms` with the count of
  dispatches that reported none stated beside it, and prints nothing at all when
  no bracket in scope carries one.
- `cadence-core/references/seam-spawn-agent.md` no longer claims the hook
  carries no figures at all, and still holds the close-half rule as ONE
  statement in one paragraph.
- `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs`
  reports `ok:true`, including the byte-budget check over both edited prose
  surfaces.

## Context

CONTEXT.md's locked decisions bind this plan: D-02 (`coordinator.wall_ms`,
`bracket_ms` and `residue_ms` stay denominated in the dispatch-to-close span and
are NOT re-based on `duration_ms` - only 6 of 386 live brackets carry one), D-03
(cache figures land on the BRACKET row and are never folded into the `roles`
block's `tokens`), D-04 ("unrecorded" is the ABSENT key, never a null and never
a counter of its own), D-10 (`workflows/report.md`'s `compose` step reads a
FIXED tuple, so that tuple must grow `duration_ms` or the figure never arrives -
`renderTrace` itself needs no change), D-11 (cache figures cannot be hand-copied
off a return; the writer reads the `SubagentStop` payload's `transcript_path`),
D-12 (a new flag on a `trace <sub>` row moves the 190 flag census - this plan
adds none) and D-13 (close-half prose corrections stay inside the
`**The bracket rides the resolve.**` paragraph, and any edited prose file's byte
budget is re-measured).

This plan runs AFTER Plan 1 and extends six of its files, including the
transcript module Plan 1 creates.

## Tasks

### Task 1: Sum the worker's cache traffic off its own transcript

- **Files:** cadence-core/bin/lib/subagent-transcript.mjs,
  cadence-core/bin/subagent-transcript.test.mjs
- **Action:** The module Plan 1 created gains the cache figures rather than a
  second module beside it: same file, same trigger, same worker, same parse.
  Sum `message.usage.cache_creation_input_tokens` and
  `message.usage.cache_read_input_tokens` across EVERY assistant entry in the
  transcript. SUM is the choice CONTEXT left to planning, and the reason belongs
  in the module header: each `message.usage` describes ONE billed request, so
  the sum is the worker's total billed cache traffic, which is the quantity a
  prompt-cache claim is argued in, while a max would answer how large the cached
  prefix got at its biggest and cannot be compared across two dispatches with
  different turn counts. State the consequence in the same place: the read
  figure counts one cached prefix once per turn, so it is NOT a window size and
  is denominated differently from the bracket's `tokens` - measured 2026-08-26,
  one 292-assistant worker on this machine sums to 33,033,480 cache-read tokens
  against a six-figure bracket `tokens`, and a reader that mistook the two for
  the same kind of number would misprice every role. A non-numeric or
  non-finite value contributes NOTHING rather than being concatenated, the guard
  `cadence-core/bin/lib/trace.mjs` already applies to `tokens`, `turns` and
  `duration_ms`. A transcript in which NO assistant entry carried a given field
  answers that figure ABSENT rather than 0 - an absent key and a zero are
  different claims, and this record keeps them apart everywhere. The terminal
  and instant answers Plan 1 built must be unchanged by the addition.
- **Verify:** `node --test cadence-core/bin/subagent-transcript.test.mjs` shows,
  against injected lines: two assistant entries carrying 100/1000 and 50/2000
  answer 150 creation and 3000 read; a transcript whose assistant entries carry
  no `usage` object answers both figures absent, checked by key presence and
  never against 0; a `"cache_read_input_tokens": "1,000"` string contributes
  nothing and leaves that figure absent; and Plan 1's terminal and timestamp
  cases still pass with their bodies unmodified.

### Task 2: The hook's close carries the cache figures and still carries no return figure

- **Files:** cadence-core/bin/lib/subagent-trace.mjs,
  cadence-core/bin/subagent-trace.mjs,
  cadence-core/bin/subagent-trace.test.mjs
- **Action:** Start at GATE 3 in `closeForStop` and the THREE GATES header above
  it. GATE 3's "the event, and NOTHING else on it" is re-aimed rather
  than deleted, and the discriminator goes in the header where the current
  argument sits. The event still carries no `tokens`, no `turns`, no
  `duration_ms` and no `detail`: those three figures live on the host's RETURN,
  which only the hand-written close sees, and the standing argument that a
  fabricated figure is strictly worse than an absent one is unchanged. It now
  carries the two cache figures when task 1's evidence supplied them, each key
  OMITTED when it did not, because those are read off the worker's own
  transcript - evidence this hook holds and the orchestrator does not (D-11).
  Spell the keys the way the host spells them,
  `cache_creation_input_tokens` and `cache_read_input_tokens`, so a bracket
  figure joins back to the transcript line it was summed from with no
  translation table - the same reason `duration_ms` took the spelling the record
  already used. Add NO `trace close` flag for either figure and touch no
  `cadence-core/bin/lib/arg-contract.mjs` row: D-11 records that the host
  renders three figures on a return and no more, so a flag would be a spelling
  nothing can fill, and the flag census stays at 190 (D-12 does not fire).
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` shows a
  payload whose injected transcript evidence carries both sums producing an
  event whose key set is the identity keys plus exactly those two, with
  `tokens`, `turns`, `duration_ms` and `detail` each still absent; a payload
  whose transcript carried neither producing an event with neither key present;
  and `node --test cadence-core/bin/arg-contract.test.mjs` still asserting 190
  flag entries across 20 top-level rows.

### Task 3: The bracket row records the cache figures and the roles block does not

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start at the `TraceRender` typedef's `brackets` property, the
  lifecycle branch's figure guards, `bracketRow`, and the repeat-close FOLD.
  `renderTrace` reads the two keys off a TERMINAL exactly the way it
  reads `duration_ms`: the same numeric-and-finite guard at the head of the
  lifecycle branch, the same omit-when-absent spread onto `bracketRow`, and the
  same fill-only-empty clause in the repeat-close fold, so whichever writer
  arrives second fills a field the row left empty and never overwrites one the
  first writer supplied. Take them off the terminal ALONE, as `duration_ms` is -
  a dispatch half has no transcript to read. Extend the `TraceRender` typedef's
  `brackets` documentation to say what these two figures are NOT: they never
  reach `roles`, and `roles.tokens` is unchanged by their presence (D-03),
  because the roles block bills the return's `tokens` while a cache figure
  summed over turns is a different denomination - the same rule
  `cadence-core/workflows/report.md` states when it forbids a second,
  differently denominated window number. Do NOT add either key to the replay
  identity string: that identity keys the millisecond so a byte-identical replay
  folds, and widening it would let a re-fired hook open a second row. `trace
  render` needs no change in `cadence-core/bin/planning/trace.mjs` - it already
  ships `r.brackets` through - so do not edit that file.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` shows: a close
  carrying both figures rendering a bracket that carries both, with `roles`
  deep-equal to the same fixture rendered without them; a close carrying neither
  rendering a bracket with NEITHER key present, checked by `in` and never
  against 0; a string value contributing nothing; and the two-writer fold
  filling a cache key the first writer left empty while not overwriting one it
  supplied. `fixture: the committed verbatim trace renders exactly as it did
  before this phase` stays green unmodified. Then, on a scratch planning root
  holding such a close, `node cadence-core/bin/planning.mjs trace render --phase <N>`
  prints both keys on the bracket row.

### Task 4: Correct the dispatch contract's claim that the hook carries no figures

- **Files:** cadence-core/references/seam-spawn-agent.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Start at the `**The bracket rides the resolve.**` paragraph, which
  is the only part of that file this task may edit. It says the hook "carries IDENTITY and no figures at
  all, because the stop payload holds none" - false once task 2 lands, and a
  false self-claim in the one statement of this rule is the defect class
  `v3.7.2`'s DOC-04 closed twice already. Correct it INSIDE that single
  paragraph (D-13): the hook carries identity plus the cache figures it reads
  off the worker's own transcript, and the hand-written close remains the only
  writer that can carry `--tokens`, `--turns` and `--duration-ms`, because those
  three live on the return only it sees. Keep the paragraph the ONE statement of
  the rule - open no second paragraph and restate none of it at a dispatch site,
  which `cadence-core/bin/prose-agreement.test.mjs`'s `ONE statement` marker
  count refuses - and leave the three OMIT sentences and the two-closes-one-bracket
  sentence intact. Re-pin this surface's entry in `weight-budgets.json` in this
  same change, which D-13 requires and which the `weight-budgets` census row's
  `cadence-core/references/` subject is the rail for.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` and no `unbudgeted-surface`; `node cadence-core/bin/weight.mjs`
  reports `cadence-core/references/seam-spawn-agent.md` at exactly the byte
  figure the manifest now carries; and `node --test cadence-core/bin/prose-agreement.test.mjs`
  is green, including `MSR-01: the spawn seam's close-half rule states the turn
  count, its omission and its own counter`.

### Task 5: /cad-report prints the worker's own clock beside the step's

- **Files:** cadence-core/workflows/report.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Start at the `read_record` step's field-read line and the
  `compose` step's `Dispatches:` row with the rules beneath it. `compose` reads
  a FIXED tuple out of the scratch render -
  `[b.role,b.plan,b.event,b.ms,b.tokens,b.turns]` - so the field has to be added
  there or the figure never reaches the report however the render carries it
  (D-10). Grow that tuple with the bracket's `duration_ms` and grow the
  `Dispatches:` row with a column for it, labelled so it cannot be read as the
  existing minutes column: the existing minutes come from `ms`, which is
  dispatch-to-close and includes whatever the orchestrator did between the two
  writes, while the new one is what the HOST reported for the worker itself -
  the distinction `cadence-core/bin/lib/trace.mjs`'s `TraceRender` typedef
  already states under TWO ELAPSED FIGURES. State beneath it, in the rules list
  that already says a null `ms` reports absent rather than zero, that a bracket
  with no `duration_ms` key prints `unrecorded` and never `0`, because an absent
  wall clock and a worker that took no time are different claims (D-04). Keep
  the `node -e` line's three guards, its `$D`-plus-run-token discipline and its
  single `trace render` invocation exactly as they are: self-verify's
  `scratch-path` check reads this file, and `prose-agreement.test.mjs` asserts
  this surface prescribes exactly one `trace render` call whose output rides a
  scratch file. Do not re-base the existing minutes on `duration_ms` anywhere
  (D-02), and add no second window-denominated number - this file's own crossing
  rule forbids it. Re-pin this surface in `weight-budgets.json` in the same
  change.
- **Verify:** `grep -n duration_ms cadence-core/workflows/report.md` returns the
  field in both the `read_record` tuple and the `compose` step's `Dispatches:`
  row, and the rules beneath that row name `unrecorded` for a bracket carrying
  no wall clock; `node cadence-core/bin/self-verify.mjs` reports `ok:true` with
  no `budget-overrun` and no `scratch-path` problem; and
  `node --test cadence-core/bin/prose-agreement.test.mjs` is green.

### Task 6: /cad-suggest prints a receipt denominated in the worker's own clock

- **Files:** cadence-core/bin/lib/trace-suggest.mjs,
  cadence-core/bin/trace-suggest.test.mjs
- **Action:** Start at `suggestFromRender`, beside the R5 spend receipt and the
  R6 coordinator receipt. It gains one more receipt, denominated in the
  brackets' own `duration_ms`: the summed worker wall clock in scope, with the
  count of dispatches whose close carried none stated beside it as unrecorded
  rather than folded in as zero (D-04). Reuse this file's existing `minutes`
  helper rather than writing a second formatter. `action` is null and the entry
  stays a `kind: 'info'` carrying exactly `{kind, subject, evidence, action}` -
  the closed `Suggestion` vocabulary this file's D-12 test pins, and which
  `cadence-core/workflows/suggest.md`'s ask step depends on because it builds
  `/cad-config <key>=<value>` tokens out of `action` plus `proposed`. SILENT
  when no bracket in scope carries a `duration_ms` at all - nothing at all,
  never an entry saying nothing - which is R6's stated posture for a render with
  no coordinator block and is also what keeps the committed-fixture test green,
  since `fixtures/verbatim.trace.jsonl` predates the flag. Name the two clocks
  apart in the evidence string the way the `TraceRender` typedef does, and do
  NOT re-base R6's `coordinator.residue_ms` on this figure: measured 2026-08-26
  only 6 of 386 live brackets carry a `duration_ms`, so re-basing would make 380
  of them contribute zero worker time and fire R6 on every run (D-02).
  `cadence-core/workflows/suggest.md` needs no edit and is not in this plan's
  lease - its `present` step already relays every `info` entry as a receipt
  line generically.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` shows a
  render whose brackets carry two `duration_ms` figures and one bracket without
  producing exactly one new `info` entry naming the summed minutes and the one
  dispatch that reported none; a render whose brackets carry none producing no
  such entry; `fixture: the committed verbatim trace suggests exactly what it
  did before this phase` still deep-equal to its two shipped entries with its
  body unmodified; and `D-12: an info receipt gains NONE of the three new keys,
  under every rule that emits one` still asserting every info entry's key set is
  `['action', 'evidence', 'kind', 'subject']`. Then `node cadence-core/bin/test.mjs`
  is green and `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

- This plan SHARES six files with Plan 1 - `cadence-core/bin/lib/trace.mjs`,
  `cadence-core/bin/trace.test.mjs`, `cadence-core/bin/lib/subagent-trace.mjs`,
  `cadence-core/bin/subagent-trace.mjs`, `cadence-core/bin/subagent-trace.test.mjs`
  and both files Plan 1's task 2 creates - so `plan-overlap` reports overlaps
  and the two plans MUST run sequentially, Plan 1 first. The split follows
  CONTEXT's plan-shape directive and the task ceiling; it is not an
  independence claim, and the parallel path must not be taken for this phase.
- The cache-summing question CONTEXT left open is decided here as SUM on both
  figures, stated in task 1 with its reason and its consequence. The flagged
  assumption behind it is now measured rather than likely: every assistant line
  of every subagent transcript sampled on this machine carries both
  `usage.cache_creation_input_tokens` and `usage.cache_read_input_tokens`.
- `cadence-core/bin/weight-budgets.json` is written by two tasks (4 and 5),
  which is why they are in one plan; each re-pins only its own surface's entry.
- AC5's `unrecorded` obligation is PER CLOSE, not per render, and that reading
  is settled rather than assumed: the `plan` review raised the all-absent case
  as an unmet MSR-05 and the user ruled silence stands. `/cad-report`'s tuple
  (task 5) is fixed, so it always carries the word for a close with no wall
  clock; `/cad-suggest` (task 6) states the unrecorded COUNT beside a real sum
  whenever any bracket in scope carries a `duration_ms`. A render where NONE
  does is not a bracket that reported zero - it is a scope with no figure to
  denominate a receipt in, so task 6 emits nothing, which D-02's measurement
  (6 of 386 live brackets) and the committed `fixtures/verbatim.trace.jsonl`
  deep-equal assertion both require. Verify this at UAT against that reading,
  not against a per-render one.
