---
phase: 3
plan: 2
requirements:
  - TRC-13
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/workflows/report.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: The record states the effort that actually ran - Plan 2

## Goal

What the hook wrote reaches a reader. The observed effort and the dispatched
rung land on the `brackets[]` row by both routes the hook can take, and
`/cad-report` prints ran beside routed and says so on the row when the two
disagree.

## Must be true when done

- A `return` carrying an observed effort and a dispatched rung renders those two
  strings verbatim on its `brackets[]` row; a close carrying neither renders a
  row with neither key.
- A `worker_cache` fact carrying them reaches the row its `corr` and `agent_id`
  name, whether it arrived before or after the `--agent-id` close - and a fact
  whose transcript reported an effort and neither cache figure is no longer
  dropped before the fold.
- Neither key ever reaches the `roles` block: `roles` is byte-identical with and
  without every fact and every effort-bearing close in the file.
- `cadence-core/bin/fixtures/verbatim.trace.jsonl` still renders to its pinned
  output byte for byte, so a record written before this phase is unchanged.
- `cadence-core/workflows/report.md` states a Dispatches table with a ran column
  beside `rung`, both read off the bracket row, the `unrecorded` arm for a row
  carrying no observed effort, and the disagreement stated ON the disagreeing row.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` all pass, with the `report.md` budget
  row re-pinned.

## Context

CONTEXT.md's decisions bind every task here. The load-bearing ones: both values
land on the `brackets[]` row, omitted when absent, and never enter `roles` -
an enum has nothing to sum (D-09); the fold rule is FILL-ONLY-EMPTY, the
`agent_id` clause, and not the larger-wins clause the cache keys use (D-10); the
fact reaches the row through the same post-pass that lands the cache keys (D-02);
the `/cad-report` Dispatches table gains a ran column, prints `unrecorded` where
the row carries none, and states a disagreement on the row rather than in a
summary line (D-11); and `fixtures/verbatim.trace.jsonl`'s pin is the proof an
old record renders unchanged (D-15).

PLAN-1 must be complete first: this plan folds the event shape PLAN-1 writes,
whose two keys are `effort` (the observed one, pinned by AC2) and `rung` (the
dispatched one).
Out of scope here: the hook and the transcript rule (PLAN-1), and the
`seam-spawn-agent.md` / `execute.md` prose, the DOCS-CLAIMS anchors and the
`TRC-13` text (PLAN-3). The one comment correction this plan owns is
`lib/trace.mjs:1886`, because it sits inside the code task 1 edits.

## Tasks

### Task 1: The bracket row carries both strings off a close

- **Files:** cadence-core/bin/lib/trace.mjs (`renderTrace`'s forward pass, the
  `brackets` typedef and `moreComplete`), cadence-core/bin/trace.test.mjs
- **Action:** In `renderTrace`'s forward pass, beside the `tokens`, `turns` and
  `duration` guards at `:1674-1684`, read the observed effort and the dispatched
  rung off the lifecycle event as NON-EMPTY STRINGS - anything else contributes
  NOTHING, the same guard those three numeric fields already carry for the same
  hazard, a hand-edited or foreign-producer line. Spread both onto the bracket
  row built at `:1809-1842`, beside `...cache`, OMITTED when absent - the
  `turns`/`duration_ms`/`agent_id` rule stated at `:1814-1823`, so a record
  written before this phase grows no new key (D-09). On the repeat-close fold at
  `:1868-1892` both follow the FILL-ONLY-EMPTY clause `agent_id` uses at `:1892`
  and NOT the `moreComplete` larger-wins clause the cache keys use at `:1884`
  (D-10): `moreComplete` compares with `>`, which is meaningless for an
  enum-shaped string, and there is no "more complete read" of a value that does
  not grow. Extend the `brackets` typedef at `:1243` and its prose at
  `:1260-1285` with both optional keys, and state the inversion a reader will
  otherwise trip on: on a `routing/resolve` event `effort` is the ROUTED rung
  (`route.mjs:1350-1364`), while on a bracket row `effort` is what the worker's
  own transcript recorded and `rung` is the one it was dispatched under. Neither
  key reaches `roles` and neither may: an enum has nothing to sum, and the roles
  bill is denominated in tokens (D-09). Correct the comment at `:1886` that calls
  the hook's close "figureless" - that close now carries the observed effort and
  the dispatched rung, so the word is no longer true (D-12); leave `:1916`'s
  "figureless writer", which is about a close that carried no token figure and is
  a different claim.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes, with the
  committed-fixture pin at `:3485-3510` unedited and still green, and new cases
  showing: a `return` carrying both strings renders them on the bracket row; a
  close carrying neither renders a row where neither key is present (`in` is
  false, not null); a second close of the same worker key does not overwrite
  either value the first writer supplied; a close carrying a number or an empty
  string for either field contributes nothing and leaves the key absent; and
  `roles` is deep-equal with and without the two keys on the close.

### Task 2: The post-pass fold lands both strings off a `worker_cache` fact

- **Files:** cadence-core/bin/lib/trace.mjs (the `cacheFacts` map, the
  `WORKER_CACHE` collection arm and the post-pass fold),
  cadence-core/bin/trace.test.mjs
- **Action:** The collection gate at `:1704-1712` today refuses any
  `worker_cache` fact carrying no cache key. Widen it so a fact carrying an
  observed effort is collected too: PLAN-1 makes the hook write a fact for a
  transcript that reported an effort and neither cache figure (D-08), and
  dropping it here would make that arm unreachable on the record while the hook
  test says it is written. Keep the `agent_id` half of the gate exactly as it is
  - a fact carrying no id can never reach a bracket (D-10). The map declared at
  `:1637-1638` widens to carry the two strings beside the numeric pair, its key
  stays `corr\0agent_id`, and two facts for one worker resolve per field: the
  cache figures keep `moreComplete`'s larger-wins for the reason stated at
  `:1627-1636`, while the two strings take FILL-ONLY-EMPTY (D-10). The post-pass
  at `:1976-1982` lands them on the matched bracket row on that same
  fill-only-empty rule, still touching the bracket ROW alone - not `roleTotals`,
  not `out.roles`, not `seenTerminals`, not `pairedRows` - and still stopping at
  the first bracket a pair matches. Extend the post-pass comment at `:1960-1975`
  to say which rule each field follows and why they differ, because the block
  currently states one rule for everything it folds.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes, with new
  cases in the shape of the existing fold tests at `:4204-4340` showing: a fact
  carrying both strings and arriving BEFORE the `--agent-id` close puts both on
  the row; the same fact arriving after does too; a fact whose event carries an
  effort and neither cache key still reaches the row (the case the old gate
  dropped); a fact never overwrites a value the close already carried, in either
  arrival order; a fact naming an id no bracket carries, or no id at all, adds
  nothing and no row; and the `folded` helper's assertion that a fact moved no
  per-role bill still holds. `node --test cadence-core/bin/trace.test.mjs` also
  keeps the `fixtures/verbatim.trace.jsonl` pin green.

### Task 3: `/cad-report` prints ran beside routed and names the disagreement

- **Files:** cadence-core/workflows/report.md (the `compose` step's Dispatches
  line and the rules block under it), cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** The Dispatches table line at `report.md:114` gains a `ran` column
  beside `rung`, and BOTH are read off the `brackets` row's own keys. The line's
  current source note, "rung from routing resolves", is unfillable: the default
  `trace render` envelope carries `brackets`, `outcomes`, `provider_spend`,
  `unpaired`, `roles`, `coordinator` and `counts` and no routing event at all
  (`bin/planning/trace.mjs:1244-1258`), so restate the source as the row's own
  dispatched-rung key (D-03). A row carrying no observed effort prints
  `unrecorded` in the ran column and is NEVER shown as agreeing; a row whose two
  values differ states the disagreement ON that row - no separate summary line
  and no "Record health" count line (D-11). Add the rule to the rules block
  beside the TWO CLOCKS bullet at `:129-140`, in that bullet's shape and on the
  same grounds it already states: an absent value and an agreement are different
  claims and only one of them is a measurement. This is a COLUMN on the existing
  per-bracket surface and NOT a new surface, which is the choice D-11 leaves to
  the planner - every bracket has a row already, so phase 1 D-15's "a
  cross-model-only phase has zero brackets to make a row from" argument does not
  apply. It still gets a `prose-agreement.test.mjs` case in the shape of the
  `MSR-02` case at `:2030` and the `RDX-01` case at `:2818` - locating the
  Dispatches line and the new rule by their text and asserting the tokens are
  present - because that file is the only mechanical check on this prose and AC4
  has no other falsifiable check short of a live run. Re-pin the
  `cadence-core/workflows/report.md` row in `weight-budgets.json` (23,755 B
  today) to the file's new byte count IN THE SAME COMMIT: self-verify's budget
  check is a ceiling and a grown surface reports `budget-overrun`
  (`self-verify.mjs:791-818`).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes
  including the new case; `node cadence-core/bin/self-verify.mjs` prints
  `"problems":[]`; and `wc -c cadence-core/workflows/report.md` equals the
  `cadence-core/workflows/report.md` value in
  `cadence-core/bin/weight-budgets.json`.
  human-verify: after this plan lands, MINT the disagreeing row rather than wait
  for one - CONTEXT records that this repository is unlikely to hold a natural
  mismatch, so an unminted check exercises only the agreeing branch and AC4's
  bad branch stays unreachable. Under a scratch phase number, append a
  `lifecycle/dispatch` and close it through the trace seam so the record holds
  three brackets: one whose observed `effort` equals its dispatched `rung`, one
  whose two values differ, and one carrying no `effort` key at all. Then run
  `/cad-report` on that phase. The Dispatches table shows a ran column beside
  rung; the equal row is not called a disagreement; the differing row names the
  disagreement ON that row and not in a separate summary line; and the third row
  reads `unrecorded` and is never shown as agreeing. Delete the scratch phase's
  events afterwards - `.planning/trace.jsonl` is gitignored, so nothing is
  committed either way.

## Notes

- Sequential after PLAN-1 and before PLAN-3. PLAN-3 re-pins the other two budget
  rows in the same `weight-budgets.json`; these plans share that file and must
  not be dispatched in parallel.
- The dispatched-rung key name is the planner's choice: CONTEXT names the
  observed key (`effort`, pinned by AC2) but leaves the routed one unnamed. It is
  called the row's rung so the report's existing `rung` column has a source with
  the same name. The inversion against `routing/resolve`, where `effort` IS the
  routed rung, is the reason task 1 requires the typedef to state it.
- AC3's second half - `fixtures/verbatim.trace.jsonl` rendering byte-identically
  - is carried by the existing pin at `trace.test.mjs:3485-3510` rather than by a
  new test. The fixture carries no effort on any line, so the omit-when-absent
  rule is what keeps it green, and a new assertion beside it would prove the same
  thing twice.
