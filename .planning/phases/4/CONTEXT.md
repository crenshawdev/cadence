# Phase 4: Token accounting - Context

Gathered: 2026-08-09
Feeds: /cad-plan 4

## Scope boundary

In: A numeric token count and a role identity on lifecycle events, a read-set on
the `dispatch` event, per-role totals in `trace render`, and a lifecycle bracket
at the three phase-scoped dispatch sites that have none today (`context.md`,
`plan.md`, `review-triggers.md`) - six brackets in total. Coverage of those
brackets is asserted mechanically by the existing producer census.

Out: The `provider` family. `traceProvider` records duration and outcome and no
usage figure, and no adapter extracts one; the cross-model arm of a review panel
stays unmeasured this phase (D-12, and the flagged assumption below). Also out:
the three spawn-agent sites that cannot produce a legal `--phase` value -
`new-project.md`, `task.md`, `decision-review.md` (D-09). Also out: converting a
read-set into a byte or duplicate-read figure - the record is written here, the
arithmetic is a reader's job outside this phase (D-13). Also out: any
`SubagentStop` hook or new capture mechanism for the token number (D-11).

Deferred: None.

Plan shape: One plan. `cadence-core/bin/weight-budgets.json` is edited by every
prose task in the phase, so a multi-plan split is refused by `plan-overlap` at
`choose_path` (D-15).

## Durable decisions

- D-01 (Write surface): Both new fields ride the EXISTING `trace append`
  subcommand as flags - a token count and a role on lifecycle events, a read-set
  on `dispatch`. No new subcommand, and each flag lands its
  `CONTRACTS['planning.mjs']['trace append']` row in the same task that adds it.
  A new subcommand would need its own `CONTRACTS` key plus a `TWO_WORD` entry,
  and the producer census's `\btrace\s+append\b` matcher would stop seeing the
  new writer at all. Evidence: `cadence-core/bin/planning.mjs:2118-2147`;
  `cadence-core/bin/self-verify.mjs:150`, `:75-81`, `:124-128`, `:219`;
  `cadence-core/bin/trace.test.mjs:384-394`; `.planning/phases/2/CONTEXT.md`
  D-20.
- D-02 (Malformed count is a malformed call): The token flag validates through
  `requireInt`; a non-integer value returns `{ok:false, reason:"bad-args"}` and
  appends nothing, rather than a best-effort append that silently drops the
  field. A dropped field would render the role `unrecorded` while the
  orchestrator believed it recorded a figure, which is exactly the
  zero/unrecorded/recorded conflation AC3 exists to prevent. Evidence:
  `cadence-core/bin/lib/require-int.mjs:15-22`;
  `cadence-core/bin/planning.mjs:2119-2126`, `:469-477`;
  `cadence-core/bin/trace.test.mjs:287-302`.
- D-03 (Tokens on any terminal event): The token flag is honored on ALL three
  terminal events - `return`, `checkpoint` and `escalation` - not on `return`
  alone as the requirement's literal wording reads. Both shipped brackets close
  with `checkpoint` on their partial paths, so a `return`-only flag would render
  `unrecorded` for exactly the runs that burned most (a checkpointed executor did
  the work twice). Evidence: `cadence-core/bin/lib/trace.mjs:60-65`;
  `cadence-core/workflows/execute.md:216`;
  `cadence-core/workflows/verify-deep.md:71`;
  `cadence-core/bin/planning.mjs:2127-2141` (the seam couples no flag to an event
  name today).
- D-04 (Role is its own flag, `plan` stays the pairing key): Per-role totals
  group on a NEW role flag on lifecycle events; `--plan` keeps its existing job
  as the pairing key. Grouping on `plan` alone would print
  `{"1": ..., "2": ..., "cad-planner": ...}` - executors keyed by plan NUMBER
  while every other worker keys by ROLE NAME - so `cad-executor`, the single
  largest spender in a phase, is the one line AC3 could structurally never
  print. Evidence: `cadence-core/workflows/execute.md:214-223` ("`--plan <k>` is
  the WORKER key - the plan number here, the role name for a role-dispatched
  worker"); `cadence-core/workflows/verify-deep.md:8-12`;
  `cadence-core/bin/lib/trace.mjs:243-247`, `:290-300`.
- D-05 (Aggregation lives in the lib): Per-role totals are computed inside
  `renderTrace` as a new `TraceRender` field, not assembled in `planning.mjs`'s
  `cmdTrace`. `lib/trace.mjs` is the stated ONE writer and ONE reader, its
  existing `counts`/`malformed`/`unpaired` are all lib-computed, and the typedef
  governs the `@type {TraceRender}` annotation - an aggregate assigned to `out`
  without a typedef entry fails `npx tsc -p tsconfig.ci.json` on the introducing
  commit. Evidence: `cadence-core/bin/lib/trace.mjs:2-9`, `:228-308`, `:229-237`,
  `:266`; `cadence-core/bin/planning.mjs:2148-2165`.
- D-06 (`unrecorded` is a count, not a string): A role with dispatches carrying
  no token figure reports an `unrecorded` dispatch COUNT beside the numeric
  total, omitted when zero - never the string `unrecorded` sitting in a numeric
  field. A string forces every reader to type-check before summing, and a
  half-recorded role (2 of 3 dispatches carried a figure) has no honest
  representation otherwise. Evidence: `cadence-core/bin/planning.mjs:9-14` (the
  seam contract: compact output, absent optionals omitted, additive-only),
  `:2156-2164` (the `...(r.malformed ? {malformed} : {})` pattern).
- D-09 (Bracket sites are phase-scoped only): The six sites are `context.md` (1
  dispatch), `plan.md` (planner, checker, revision re-dispatch) and
  `review-triggers.md` step 4's claude-subagent arm. `new-project.md` (runs
  before any phase exists), `task.md` (`.planning/tasks/{slug}`, no phase) and
  `decision-review.md` stay OUT: `trace append` requires a `--phase`, and two of
  the three cannot produce a legal value at all. "EVERY site that dispatches a
  worker" in TOK-03 means every PHASE-SCOPED site. Evidence:
  `cadence-core/workflows/context.md:105-118`;
  `cadence-core/workflows/plan.md:80-84`, `:186`, `:212-232`;
  `cadence-core/references/review-triggers.md:80-106`;
  `cadence-core/workflows/new-project.md:158-160`;
  `cadence-core/workflows/task.md:62-64`;
  `cadence-core/workflows/decision-review.md:44-47`;
  `cadence-core/bin/planning.mjs:2119-2120` with
  `cadence-core/bin/lib/require-int.mjs:39-47`.
- D-11 (The number comes from the host's subagent return): The orchestrator
  reads the token count off the subagent return at the moment it returns; Cadence
  adds no `SubagentStop` hook, no seam and no capture mechanism to obtain it.
  Settled empirically during this context pass: the `cad-assumptions-analyzer`
  dispatch that produced these assumptions returned
  `<usage>subagent_tokens: 186577 tool_uses: 78 duration_ms: 555893</usage>`.
  `decision-review.md:119-121` and `:162-163` assert as D-09 there that "the
  runtime exposes no per-turn token/dollar figures" - that is a DIFFERENT claim
  (per-turn figures for the orchestrator's own turns) and it does not bind here;
  neither decision needs amending. Evidence: this session's analyzer return;
  `hooks/hooks.json` (one `PreToolUse`/Bash hook, no `SubagentStop`);
  `.planning/ROADMAP.md:34-36`, `:77` (the Stop hook was cut this cycle).
- D-12 (Provider family untouched): No token field on `provider/request` events
  and no per-adapter usage extraction this phase. The cross-model arm is the one
  place a real API-reported usage figure exists rather than a host-reported one,
  and pulling it in adds ~2 tasks plus a `provider-api.md` edit against a ceiling
  of 8. The consequence is stated rather than hidden: under a panel,
  `cad-reviewer`'s per-role total covers the claude-subagent arm and omits the
  cross-model voice that ran beside it (see Flagged assumptions). Evidence:
  `cadence-core/bin/review-provider.mjs:410-437` (traceProvider's fixed field
  set), `:627-641` (adapters extract text only);
  `cadence-core/references/provider-api.md` (documents no usage field).
- D-13 (Read-set is what the site CAUSES the worker to read): The read-set
  records the prompt-named planning-doc paths PLUS the contract-prescribed ones,
  stored verbatim with no existence check and no byte measurement. A literal
  "paths named in the prompt" reading records an EMPTY read-set at
  `context.md`, because the analyzer's reads are prescribed by its cached
  contract rather than by the dispatch prompt - and that is the single most
  expensive unbracketed dispatch in the motivating measurement (206,901 tokens),
  so the duplicate-read fraction would under-report by a full copy of the
  planning set, in the direction that kills the follow-on trimming decision.
  Evidence: `cadence-core/workflows/context.md:109-118` (names no planning path);
  `skills/cad-assumptions-analyzer-contract/SKILL.md` process step 1;
  `cadence-core/workflows/plan.md:120-125`, `:195-199`;
  `cadence-core/workflows/execute.md:182-188`;
  `cadence-core/bin/lib/surface-weight.mjs:8-20` (measures plugin surfaces only,
  never `.planning/*`).

## Decisions

- D-07 (Read-set is one comma-separated value): The read-set arrives as ONE
  comma-separated flag value, split-and-trimmed like `phase-done --reqs`. A
  repeated flag is not an option: `parseArgs` does `opts[a.slice(2)] = next`, so
  `--read a --read b` records only `b` - the record would drop most of its rows
  while looking complete. Evidence: `cadence-core/bin/planning.mjs:2561-2574`,
  `:469-477`; `cadence-core/bin/lib/trace.mjs:171-184`.
- D-08 (One consumer prose surface): `cadence-core/workflows/progress.md:87-101`
  is the only place in the shipped surfaces that invokes `trace render`, so it is
  the only consumer prose this phase updates. Without that edit the seam emits
  per-role totals no command ever prints and `/cad-progress --trace` still shows
  four family counts. Evidence: `cadence-core/workflows/progress.md:87-101`;
  `skills/cad-progress/SKILL.md:23`; `cadence-core/bin/self-verify.mjs:151`.
- D-10 (Brackets are written, not described): Each new bracket copies
  `verify-deep.md`'s literal shape - a fenced single-line `trace append` command
  immediately before the spawn-agent call and another at the return - rather than
  describing the bracket in prose. A described-but-not-written bracket is
  invisible to both the producer census and self-verify's check 2 flag lint, so
  the site would be unenforced and a wrong flag name would ship CI-green.
  Evidence: `cadence-core/workflows/verify-deep.md:6-13`, `:26-31`, `:62-72`;
  `cadence-core/workflows/execute.md:208-233`;
  `cadence-core/bin/trace.test.mjs:384-394`;
  `cadence-core/bin/self-verify.mjs:498-531`.
- D-14 (Coverage is mechanical, via the existing census): Bracket coverage is
  asserted by extending `trace.test.mjs`'s producer census to require a
  dispatch/terminal pair per bracketing FILE, not left to prose plus the UAT
  walk. The census already collects a `where` per invocation and asserts only
  global vocabulary, so this is a narrow widening of an existing test. Without
  it, five new brackets land and a later edit deletes one with the whole suite
  green - precisely the regression the census was written to catch, one scope
  level short. Evidence: `cadence-core/bin/trace.test.mjs:335-352`, `:396-446`.
- D-15 (One plan, budgets in-task): Every task that edits a prose surface
  regenerates that surface's `weight-budgets.json` entry in the SAME task, and
  the phase ships as ONE plan because that shared file makes any multi-plan split
  fail `plan-overlap` at `choose_path`. Budgets are exact byte counts and
  `bytes > budget` is a hard `budget-overrun`. Evidence:
  `.planning/phases/2/CONTEXT.md` D-18; `.planning/phases/3/CONTEXT.md` D-14;
  `cadence-core/bin/self-verify.mjs:617-640`;
  `cadence-core/bin/weight-budgets.json`;
  `.planning/_archive-v2.5.0/2/PLAN.md:525` (the same argument forced one plan
  there).
- D-16 (Evidence runs against the repo, not the installed plugin): AC6's
  end-to-end evidence is produced against this repo's own script and workflow
  paths, never through the installed `/cad-*` commands. The installed copy is
  2.5.0 and already stale before this phase edits anything (its `audit.md` is
  9894 B against this repo's 12812 B), so a UAT walk that ran `/cad-plan 4` would
  observe zero lifecycle events at the new sites and fail the criterion against
  correct code. Evidence: `.planning/phases/2/CONTEXT.md` D-17;
  `.claude-plugin/plugin.json`;
  `/home/john/.claude/plugins/cache/cadence/cadence/2.5.0/cadence-core/workflows/audit.md`.

## Acceptance criteria

- [ ] AC1: `planning.mjs trace append --phase 4 --family lifecycle --event return --plan 1 --role cad-executor --tokens 12345` writes one event carrying both `role` and `tokens`; the same call with `--tokens abc` returns `{"ok":false,"reason":"bad-args"}` and appends nothing; `--tokens` is stored the same way on `checkpoint` and `escalation`. Both flags have rows in `CONTRACTS['planning.mjs']['trace append']`.
- [ ] AC2: `trace append --event dispatch --read "a.md,b.md,c.md"` stores a three-element read-set on the event, visible in `trace render` output.
- [ ] AC3: `trace render --phase <N>` prints a per-role block giving tokens and dispatch count per role key, beside the four family counts it already prints. A role whose dispatches carried no `--tokens` reports an `unrecorded` dispatch count and no zero token total.
- [ ] AC4: `context.md`, `plan.md` (3 dispatches) and `review-triggers.md` each carry a fenced `trace append --event dispatch` with `--role` and `--read` immediately before the spawn-agent call, and a terminal append after, in `verify-deep.md`'s literal shape. All six read-sets are non-empty, including `context.md`'s analyzer dispatch.
- [ ] AC5: `node --test cadence-core/bin/trace.test.mjs` FAILS when any single bracketing file's dispatch/terminal pair is deleted, and passes with the tree intact - proved by patch-and-rerun recorded in the SUMMARY.
- [ ] AC6: A dispatch run after this phase ships, driven by the repo's own workflow prose rather than the installed 2.5.0 plugin, produces a `trace render` whose per-role totals carry a non-zero token figure for the role that ran.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and `node cadence-core/bin/self-verify.mjs --root .` are green, with `weight-budgets.json` regenerated for every surface this phase edits.

## Flagged assumptions

- Under a cross-model review panel, `cad-reviewer`'s per-role total counts the
  claude-subagent arm only and silently omits the provider call(s) that ran
  beside it - Likely; if wrong, the reviewer's number is short by an unstated
  amount and a reader concludes reviews are cheaper than they are. Scoped out by
  D-12; the honest fix is a per-adapter `extractUsage`, and no provider response
  body has been confirmed to carry a usage block (`provider-api.md`, the file
  that pins every wire detail, documents none). Worth a CAPTURE item at execute
  time.
- The read-set is stored verbatim with no existence check, so a path that is
  renamed or deleted leaves a stale entry the record cannot distinguish from a
  live one - Likely; if wrong, the duplicate-read fraction counts bytes nobody
  read. Accepted because no seam converts a path list into bytes today
  (`surface-weight.mjs` measures plugin surfaces only), so the arithmetic that
  would surface the staleness does not exist yet either.
- The planning set has already grown past the figure TOK-04 cites: PROJECT +
  REQUIREMENTS + ROADMAP + the phase-3 CONTEXT measure 91,950 B today against the
  requirement's 85,413 B - Confident; if wrong, nothing breaks, but any
  duplicate-read percentage computed against the older figure is understated.
