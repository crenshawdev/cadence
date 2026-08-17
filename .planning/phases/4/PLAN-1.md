---
phase: 4
plan: 1
requirements:
  - MSR-03
files:
  - cadence-core/config.schema.json
  - cadence-core/references/config-reach.md
  - cadence-core/references/seams.md
  - cadence-core/bin/lib/window-budget.mjs
  - cadence-core/bin/window-budget.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/workflows/report.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 4: Costs argued from the new record - Plan 1 (MSR-03, the live window budget)

## Goal

A dispatch's live context window carries a per-role token ceiling the way
shipped prose surfaces already carry per-surface byte budgets, and a crossing is
REPORTED after the fact in the same `budget-overrun` problem shape - off the
figure `trace.jsonl` already holds, with no new window key, no capture path and
no refusal.

## Must be true when done

- `node cadence-core/bin/planning.mjs trace window` run against this repo's own
  `.planning/trace.jsonl` prints at least one problem of kind `budget-overrun`
  whose detail names the role that crossed and reads `<n> exceeds budget <m> by
  <d>` in tokens.
- The ceiling is per-role CONFIGURATION: six `workflow.max_dispatch_tokens.<role>`
  keys resolve through the normal repo-over-global-over-default layering, and
  raising one role's key removes exactly that role's crossings from the report.
- Nothing is refused. The report is post-return only: no dispatch path, agent
  frontmatter key or spawn seam consults the ceiling, and a run with crossings
  still completes.
- The numbers are argued in shipped prose from named `trace.jsonl` keys - the
  `tokens` on a `brackets[]` row - with each role's measured figure, its sample
  size and the measurement date, rather than from an asserted constant.
- The check reaches a path in a CONSUMER install: it reads the PROJECT's
  `.planning/trace.jsonl` and is invoked from `/cad-report`, never from
  `self-verify.mjs`'s plugin-root walk.
- A bracket whose role has no ceiling, and one whose terminal carried no token
  figure, are each REPORTED as such rather than silently skipped or priced as
  zero.
- A falsifier committed with a `WATCHED FAILING AT <sha>` header exits non-zero
  against the SHA it names and zero on this tree, and `node --test
  cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs` and
  `npx tsc -p tsconfig.ci.json` are all green.

## Context

CONTEXT D-01 fixes the budgeted quantity as the `tokens` value on a `brackets[]`
row of `trace render` - the terminal lifecycle event's `--tokens`, read as a
FINAL-WINDOW PROXY - and forbids recording a new window key or adding any
capture path. D-02 makes the budget per ROLE, not one global number. D-03 puts
the report on the `planning.mjs trace` surface rather than inside
`self-verify.mjs`, whose full-tree predicate is the PLUGIN root and which reads
`.planning` nowhere. D-04 makes the crossing a report and never a refusal. D-05
puts the number in `config.schema.json`, mirroring `review.max_prompt_tokens`.
D-06 rules out a declared-`files:` byte rail as the proxy. D-11 makes the shape a
CEILING with no shrink arm. D-19 requires the `CONTRACTS` row in the same commit
as the new subcommand; D-20 requires a `weight-budgets.json` re-pin in the same
commit as every prose edit. Out of scope: any new trace key, any host-capture
seam, a declared-byte rail, cache work, and any stored multiplier or ratio.

Ordering: this plan runs FIRST. Plan 2 edits `cadence-core/workflows/report.md`
after this plan does, and Plan 3 audits the header this plan's task 5 writes.

## Tasks

### Task 1: The per-role window ceiling becomes configuration, argued from the record

- **Files:** `cadence-core/config.schema.json`,
  `cadence-core/references/config-reach.md`,
  `cadence-core/references/seams.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Add six `int` keys - `workflow.max_dispatch_tokens.cad-planner`,
  `.cad-executor`, `.cad-verifier`, `.cad-reviewer`, `.cad-plan-checker` and
  `.cad-assumptions-analyzer` - beside the existing `workflow.*` block, each with
  `"min": 1` and a `purpose` mirroring the shape of `review.max_prompt_tokens`'s
  row at `cadence-core/config.schema.json`. Defaults, settled here from the
  record and stated as the rule that produced them - each role's 75th-percentile
  terminal-event `tokens` figure rounded UP to the next 25,000, measured
  2026-08-17 over every `return` and `checkpoint` event in
  `.planning/trace.jsonl` carrying a numeric `tokens`: `cad-planner` 200000
  (n=27, p75 188,135, max 247,585), `cad-executor` 200000 (n=72, p75 185,999,
  max 275,285), `cad-verifier` 100000 (n=24, p75 83,908, max 131,728),
  `cad-reviewer` 150000 (n=2, p75 125,100), `cad-plan-checker` 75000 (n=5, p75
  64,203, max 88,078), `cad-assumptions-analyzer` 150000 (n=25, p75 145,054, max
  188,149). Every `purpose` must carry the reach phrase `trace window report
  only` verbatim, because check 9 compares the reach cell against the purpose
  literally - and add the six matching rows to
  `cadence-core/references/config-reach.md`'s table with that same phrase in the
  reach column and `bin/planning.mjs` named as the honouring file. Write the
  reach cells the way the `model.effort.*` rows are written, naming the file
  rather than an invocation: a `planning.mjs trace window` invocation in prose
  reports `unknown-subcommand` until task 3 adds the `CONTRACTS` row, so no
  surface may carry that invocation form yet. In
  `cadence-core/references/seams.md`, in the dispatch-seam section that states
  `maxTurns: 200` is the only bound that seam has, add the argument AC2 requires:
  the budgeted quantity is the `tokens` on a `brackets[]` row and is a
  FINAL-WINDOW PROXY, the six per-role figures above with their sample sizes and
  the 2026-08-17 measurement date, the rule that produced the defaults, and the
  reason it is a post-return REPORT and not a bound - nothing in that seam can
  resize or cancel a running dispatch, which is the same sentence that section
  already makes about `subagent_timeout`. Do not weaken or contradict the
  existing `maxTurns: 200`-is-the-only-bound sentence; a ceiling reported after
  the return is not a second bound at dispatch time. That prose must name the
  family as the bare two-segment token `workflow.max_dispatch_tokens`, not only
  in its per-role spellings: check 1's tokenizer ends a token at the hyphen, so
  `workflow.max_dispatch_tokens.cad-executor` reads as
  `workflow.max_dispatch_tokens.cad` and covers no key, and check 1b would report
  all six as inert - which is exactly why `cadence-core/workflows/config.md`
  carries "the six `model.effort` per-role start rungs" as a bare family mention.
  Re-pin `seams.md` in
  `cadence-core/bin/weight-budgets.json` from `node cadence-core/bin/weight.mjs`
  in this same commit.
- **Verify:** `node cadence-core/bin/config.mjs get workflow.max_dispatch_tokens.cad-executor`
  returns 200000 and the same call for `.cad-verifier` returns 100000.
  `node cadence-core/bin/self-verify.mjs` exits 0 with no `unknown-config-key`,
  `inert-config-key`, `unknown-reach-key`, `missing-reach-row`,
  `budget-overrun` or `unbudgeted-surface` entry. `grep -n "188,135\|185,999\|2026-08-17"
  cadence-core/references/seams.md` shows the measured figures and the date.

### Task 2: The pure rule - bracket rows plus ceilings become crossings

- **Files:** `cadence-core/bin/lib/window-budget.mjs`,
  `cadence-core/bin/window-budget.test.mjs`
- **Action:** Add a pure rule module in the shape
  `cadence-core/bin/lib/text-transport.mjs` and
  `cadence-core/bin/lib/deferred-reads.mjs` use - no disk, no `emit`, no
  `process.exit`, no `Date`, no randomness, node builtins only, with the caller
  owning the walk and the envelope. It takes the `brackets` array `renderTrace`
  produces (rows carrying `corr`, `phase`, `plan`, `role`, `event`, `ts`, `end`,
  `ms`, `tokens` and an optional `turns`, as documented in
  `cadence-core/bin/lib/trace.mjs`'s `TraceRender` typedef) plus a
  role-to-ceiling map, and returns three things kept apart: the crossings, as
  problems in self-verify's exact `budget-overrun` shape `{kind, file, detail}`
  with `detail` naming the role and the bracket's identity and ending in
  `<n> exceeds budget <m> by <d>`; the rows whose `role` has no ceiling, counted
  per role; and the rows whose `tokens` is null, counted. A row with no ceiling
  and a row with no figure are REPORTED, never skipped and never priced as zero -
  the same distinction `roles`' `unrecorded` counter already makes in
  `lib/trace.mjs`. The comparison is a CEILING with no shrink arm: a row UNDER
  its ceiling is silent, exactly as `self-verify.mjs`'s prose-budget check states
  in its own header (D-11). Carry a header comment stating the quantity is the
  terminal event's `tokens` read as a final-window PROXY rather than a sum across
  the dispatch's turns, and that the rule reports and never refuses. Cover it
  with unit tests in the new test file: a crossing, an exact-equal row that does
  NOT cross, an under row, a null-`tokens` row, an unknown-role row, and an empty
  bracket list.
- **Verify:** `node --test cadence-core/bin/window-budget.test.mjs` exits 0. A
  fixture bracket of role `cad-executor` with `tokens` 275285 against a ceiling
  of 200000 yields exactly one problem, `kind` `budget-overrun`, whose `detail`
  contains `cad-executor` and the substring `275285 exceeds budget 200000 by
  75285`; the same row at `tokens` 200000 yields none.

### Task 3: `trace window` reports the crossing off the project's own record

- **Files:** `cadence-core/bin/planning.mjs`, `cadence-core/bin/self-verify.mjs`,
  `cadence-core/bin/window-budget.test.mjs`
- **Action:** Add a `window` arm to `cmdTrace` in `cadence-core/bin/planning.mjs`
  taking the optional `--phase <N>`, parsed through `requirePhaseArg` exactly as
  the `render` and `suggest` arms parse it, and add `window` to that function's
  closing `fail('usage', ...)` list and to the `trace` block of the usage comment
  at the head of the file. It calls `renderTrace(dir, phase)`, resolves the six
  ceilings from `mergeLayers(join(dir, 'config.json'))` the way `cmdRecall`
  already resolves `memory.backend` - including BINDING the returned `warnings`
  and riding them on the envelope only when non-empty, which check 12 and
  `lib/merge-warnings.mjs` require of every `mergeLayers` callsite - falling back
  per role to the same defaults task 1 wrote into the schema, stated as one named
  constant map in this file with a comment saying the schema row is the source of
  truth and this map is the unset-layer fallback (the duplication `cmdRecall`'s
  `?? 'builtin'` already accepts). Pass `r.brackets` and the resolved map to
  task 2's module and emit the seam's one JSON line: `checked`, the scope, the
  resolved ceilings, the `problems` array, the unbudgeted-role counts, the
  unrecorded count, and the warnings. `file` on each problem is the render's own
  `file` field, so the crossing names the record it was read from. Add the
  `'trace window': ['--phase']` row to the `planning.mjs` block of
  `CONTRACTS` in `cadence-core/bin/self-verify.mjs` in THIS commit (D-19), with a
  comment saying why the flag set is `--phase` alone. Extend
  `cadence-core/bin/window-budget.test.mjs` with CLI cases run through
  `execFileSync` against a temporary `.planning` fixture, following the fixture
  and invocation pattern `cadence-core/bin/trace.test.mjs` already uses: a
  fixture whose bracket crosses reports it, a repo-layer `config.json` raising
  that role's key removes the crossing, an absent trace file is `ok:true` with an
  empty problems list rather than a failure, and a bad `--phase` is
  `ok:false`/`bad-args`.
- **Verify:** `node cadence-core/bin/planning.mjs trace window` in this repo
  prints one JSON line with `"ok":true` carrying at least one entry of
  `"kind":"budget-overrun"` whose detail names a role. `node --test
  cadence-core/bin/window-budget.test.mjs cadence-core/bin/trace.test.mjs` exits
  0, `node cadence-core/bin/self-verify.mjs` exits 0 and `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 4: `/cad-report` reaches the check

- **Files:** `cadence-core/workflows/report.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** In `cadence-core/workflows/report.md`'s `read_record` step, add
  `trace window` beside the two seam calls already there, scoped with the same
  `[--phase <N>]` the render takes, and add one line to the `compose` step's
  shape block reporting what it returns: the crossings, each as role, the figure
  and the ceiling it crossed, plus the unbudgeted-role and unrecorded counts when
  non-zero, and silence when there are none. State in the same place that the
  crossing is a FINDING and refuses nothing - the run already completed - and
  that the figure is the same final-window proxy the existing "Gap terms, never a
  product" line describes, so this command does not acquire a second, differently
  denominated window number. Keep the existing no-fabricated-figures and
  print-no-ratio rules intact: report the ceiling and the crossing as the two
  numbers they are, never their quotient. Re-pin `report.md` in
  `cadence-core/bin/weight-budgets.json` from `node cadence-core/bin/weight.mjs`
  in this same commit.
- **Verify:** `grep -n "trace window" cadence-core/workflows/report.md` shows the
  invocation in `read_record` and the reporting line in `compose`.
  `node cadence-core/bin/self-verify.mjs` exits 0 - which is what proves the new
  invocation matches the `CONTRACTS` row and that the re-pin is in place.

### Task 5: The MSR-03 falsifier, watched failing at a named SHA

- **Files:** `cadence-core/bin/window-budget.test.mjs`
- **Action:** Append one falsifier test that reaches MSR-03 end to end through
  the CLI alone - `execFileSync` on `planning.mjs trace window` against a
  temporary `.planning` fixture whose trace holds one crossing bracket and one
  under-ceiling bracket - asserting the crossing is returned in the
  `budget-overrun` shape with the role named, and the under-ceiling bracket is
  not. It must import nothing this plan added, so against the unpatched tree it
  fails on its ASSERTIONS (the seam answers `ok:false`/`usage`) rather than on a
  missing module. Carry the header comment in the shape
  `cadence-core/bin/milestone-prune.test.mjs`'s RCL-07 falsifier and phase 3's
  falsifiers use: `WATCHED FAILING AT <sha>` naming the tip of the unpatched tree
  (`37796d0` is the tip as this plan is written; use the commit immediately
  preceding this plan's first implementation commit if it has moved), the
  observed unpatched output quoted verbatim, and the re-watch recipe (`git
  worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/`, `node --test` it there, remove the worktree).
- **Verify:** `node --test cadence-core/bin/window-budget.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA the
  header names, the same command exits NON-ZERO with this test failing on an
  assertion, and the header quotes that observed output.

## Notes

- Settled here under CONTEXT's third flagged assumption: the key is spelled
  `workflow.max_dispatch_tokens.<role>` and the per-role ceilings are SIX KEYS
  rather than one key holding a map. The schema's type vocabulary has no map
  type, so a map would mean a new schema type plus its validation, write face and
  catalog type key; six per-role keys reuse the shipped `model.effort.<role>`
  precedent exactly, including its six reach rows and its family-level prose
  mention. Following that precedent, the keys get NO `config-catalog.md` row -
  the six `model.effort` keys have none either - which also keeps that file as
  Plan 3's exclusive lease.
- The defaults fire on this repo's record without firing on its middle: at the
  p75-rounded-to-25,000 rule, 25 of the 155 tokens-bearing terminal events cross
  (`cad-executor` 11 of 72, `cad-planner` 4 of 27, `cad-assumptions-analyzer` 6
  of 25, `cad-verifier` 3 of 24, `cad-plan-checker` 1 of 5, `cad-reviewer` 0 of
  2), which is what satisfies AC1's "prints at least one crossing" without making
  half of every run a finding.
- CONTEXT's first flagged assumption - whether agent frontmatter exposes a
  per-agent window key - stays unsettled and this plan does not probe it. Every
  task here is post-return by construction, so if that key turns out to exist,
  what changes is that a SECOND, enforcing home becomes possible; nothing this
  plan ships becomes wrong.
