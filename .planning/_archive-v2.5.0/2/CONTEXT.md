# Phase 2: Context reduction - Context

Gathered: 2026-08-08
Feeds: /cad-plan 2

## Scope boundary

In: A `weight.mjs` composition that reports what a command and a dispatch
actually carry - eager bytes (SKILL.md plus its `@`-includes) and reachable
bytes (eager plus every reference the prose reads mid-run) per command, and
dispatch bytes (agent file plus its preloaded contract skills) per role - with
its first CONTRACTS entry and sibling tests. Then the cut that measurement
justifies: `cad-land` and `cad-plan-review` stop eagerly preloading references
they read at one step, dropping `cad-land` below the workhorse mean. Before and
after numbers for five commands and six roles committed in
`phases/2/MEASUREMENTS.md`. The stale ROADMAP and REQUIREMENTS wording corrected
in place.

Out: Re-budgeting `cadence-core/references/**` - v2.3.0's BUD-02 already did it
(D-01). Anything scoped to `panel-review`, which this codebase does not contain
(D-02). Chasing the 2.4x figure, which is runtime billed-equiv and not derivable
from the tree (D-03). The CTX-02 pair - a preloaded writing contract and a
minimalism review lens - both deferred out of the cycle (D-06). Runtime token
telemetry of live sessions, which `PROJECT.md ### Out of Scope` already excludes
and which is what the 2.4x actually measured. Cutting `config-reach.md`,
`provider-api.md` or `model-hints.json`, which are budgeted but never enter a
model context (D-09). Rewriting `cad-land`'s own prose as the primary lever
(D-07).

Deferred: CTX-02 in full - the writing contract (issue #69) and the minimalism
lens (issue #29). Both ADD resident bytes in a phase whose goal is to cut them,
the writing contract's stated premise is false in this tree, and neither issue
has a statement here to plan against. Moved out of `### Active` with that reason;
re-open it as its own phase in a later cycle if the tracker text justifies it.

Plan shape: one plan. The seam, two load-order cuts that share its measurement,
one measurements file and two doc corrections - narrower than phase 1, and the
cuts cannot be verified without the seam that measures them.

## Durable decisions

- D-01 (Criterion 1 already shipped): `cadence-core/references/**` is fully under
  `weight-budgets.json` today and this phase records that rather than redoing it.
  The manifest holds 93 entries; a walk of `agents/`, `skills/` and
  `cadence-core/{references,templates,workflows}` yields exactly 93 files, every
  one budgeted at an exact byte match, zero unbudgeted and zero orphan keys - all
  16 files in `cadence-core/references/` included, among them
  `acceptance-criteria.md: 22506`, the file ROADMAP criterion 1 names as
  "entirely unbudgeted". Enforcement is a per-file ceiling, and a new file raises
  `unbudgeted-surface` rather than passing silently. This is v2.3.0's BUD-02.
  Evidence: `cadence-core/bin/weight-budgets.json`;
  `cadence-core/bin/self-verify.mjs:600` (`unbudgeted-surface`), `:605`
  (`bytes > budget` -> `budget-overrun`);
  `cadence-core/bin/lib/surface-weight.mjs:117-126` (walks `references` and
  `templates` recursively, every file regardless of extension).
- D-02 (`panel-review` is not in this codebase): the command named by CTX-01 and
  ROADMAP criterion 2 does not exist here and no task may target it. It is
  retired Codex-era prior art that `cad-plan-review` was designed against. The
  in-tree surface carrying the same 15,134 B `review-triggers.md` include is
  `cad-plan-review`, and criterion 2's command pair becomes `cad-land` +
  `cad-plan-review`. Evidence: `skills/` holds 29 skills, none named
  `panel-review`; `DESIGN.md:73` ("a real gap /panel-review doesn't fill (it
  reviews diffs)"), `DESIGN.md:9` (listed beside `codex-rescue` in the retired
  setup); `skills/cad-plan-review/SKILL.md:28`.
- D-03 (The 2.4x is runtime, not static): the 35.7k / 38.4k billed-equiv figures
  come from burnrate transcript analysis over a 30-day window outside this repo,
  and `PROJECT.md ### Out of Scope` excludes runtime token telemetry because the
  host exposes no per-turn stats to a plugin script. The tree does not reproduce
  the ratio in either direction: `cad-land` eager is 32,676 B against a
  `cad-execute`/`cad-plan`/`cad-verify` eager mean of 20,530 B (1.59x), and
  reachable is 61,582 B against a workhorse mean of 97,971 B (0.63x - below the
  average). Criterion 2 is therefore restated against a static target the tree
  can prove, and the source item stays UNVERIFIED rather than being treated as a
  measured defect. Evidence: `.planning/CAPTURE.md:225` (marked UNVERIFIED),
  `:222` (source `/projects/cadence-token-analysis/PROMPT-cadence-token-work.md`);
  `PROJECT.md ### Out of Scope`; measurements above taken live at gather time.
- D-04 (Resident is reported both ways, eager as the headline): eager is
  `SKILL.md` plus its `@`-includes - the bytes the host injects unconditionally -
  and reachable is eager plus every `references/`, `templates/` and `workflows/`
  file the prose names and reads mid-run. Both are reported because the ranking
  INVERTS between them: `cad-land` is heaviest of the five under eager and
  second-lightest under reachable. Publishing one alone would let the phase claim
  or lose a result by choosing a spreadsheet. The graph is shallow enough to make
  both cheap: 25 `@`-include lines exist across `skills/*/SKILL.md` and zero in
  `cadence-core/workflows/*.md` or `cadence-core/references/*.md`, so no include
  resolves to a file that includes another and no recursive resolver is needed.
  Evidence: measured live at gather time; `skills/*/SKILL.md` include lines.
- D-05 (Orchestrator and dispatch loads are never summed): a dispatch's bytes
  land in a FRESH subagent context, not in the orchestrator's, so the phase
  records an orchestrator number per command and a dispatch number per role side
  by side rather than one total. A summed figure would grow with plan count and
  stop being reproducible from the tree, making the "after" incomparable to the
  "before". This is the same separation v2.3.0's RES-01/02/03 applied to output.
  Evidence: measured live - `cad-executor` 13,043 B (contract 12,625 + agent),
  `cad-verifier` 10,082, `cad-planner` 9,057, `cad-plan-checker` 4,927,
  `cad-assumptions-analyzer` 4,596, `cad-reviewer` 4,042, against `/cad-plan`
  16,438 and `/cad-execute` 25,017 on the orchestrator side.
- D-06 (CTX-02 deferred out of the cycle): both halves add resident bytes in the
  phase that exists to cut them, and the writing contract's stated premise is
  false here - nothing restates a writing contract per agent today, so it is
  net-new prose on all 19 agent files rather than a deduplication. A grep of
  `skills/`, `agents/` and `cadence-core/` for `one action per sentence`,
  `constraint before`, `per sentence` and `imperative` returns zero hits; the six
  contract skills carry only role-specific output rules. The minimalism lens as a
  new review trigger needs coordinated edits across at least six mutually
  self-verified surfaces - three schema keys, a `route-table.json` gate at all
  three levels, a `config-reach.md` row, the `/cad-config` catalog, the wiring
  table and a fire site - every one of which adds bytes. Evidence: the grep
  above; `skills/cad-reviewer-contract/SKILL.md:22-45`;
  `cadence-core/bin/self-verify.mjs:364-365` (trigger vocabulary derived from the
  schema), `:576-580` (`inert-config-key`);
  `cadence-core/bin/lib/route-cells.mjs:299-303` (`missing-trigger`).

## Decisions

- D-07 (The cut is load order, not rewriting): `cad-land`'s 32,676 B eager load is
  21,580 B of two `@`-includes against 11,096 B of its own prose, so editing the
  prose caps the saving at a third of the file while leaving three-fifths of the
  load untouched. The same file already demonstrates the fix with its reasoning
  stated inline - it stopped preloading `references/git-publish.md` and Reads it
  at the step instead. Evidence: `skills/cad-land/SKILL.md:20-21`
  (`review-triggers.md` 15,134 B + `git-guard.md` 6,446 B), `:84-92` and `:105-113`
  (the deferral pattern and its break-even reasoning);
  `skills/cad-plan-review/SKILL.md:28` (the same 15,134 B include).
- D-08 (`weight.mjs` gains the composition and its first CONTRACTS entry): no seam
  composes a per-command or per-dispatch total today - `weight.mjs` is 32 lines,
  takes only `--root`, and emits one flat per-file list with no grouping. It also
  carries NO CONTRACTS entry and is invoked by no shipped prose surface, so the
  new subcommand brings the first one, plus tests in the sibling `*.test.mjs`, per
  the standing convention. Resolution reuses what self-verify already has rather
  than a second reader. Evidence: `cadence-core/bin/weight.mjs`;
  `cadence-core/bin/lib/surface-weight.mjs:150-166` (`weighAll` returns
  `{surface, bytes, estTokens}[]`, ungrouped); `cadence-core/bin/self-verify.mjs:102+`
  (CONTRACTS table, no `weight.mjs` row), `:688-711` (`parseSkillsField` resolving
  an agent's `skills:` list to `skills/<name>/SKILL.md`).
- D-09 (Zero-resident references are excluded from the accounting): 26,095 B of
  the budgeted reference surface never enters a model context and a cut there
  would move the main thread by zero - `config-reach.md` (18,412 B) and
  `provider-api.md` (5,048 B) are named by no prose surface at all, and
  `model-hints.json` (2,635 B) is loaded in-process by a script. The measurement
  marks them so criterion 6's numbers cannot record a saving nobody pays.
  Evidence: grep of `skills/`, `agents/` and `cadence-core/workflows/` for each
  path returns nothing; `cadence-core/bin/lib/config-reach.mjs` (self-verify check
  9); `cadence-core/bin/review-provider.mjs:911` (`model-hints.json`), `:600`
  (`provider-api.md` as a prose pin, never loaded).
- D-10 (The stale wording is corrected in place, not annotated): ROADMAP phase 2's
  success criteria and the `CTX-01` requirement row are rewritten to the
  re-scoped scope citing BUD-02 for what already shipped, and `CTX-02` moves out
  of `### Active` with its deferral reason. Recording the drift in this CONTEXT
  alone would leave `/cad-audit` tracing against text the tree contradicts, and
  leaving CTX-02 in Active with no phase serving it FAILs the milestone gate.
  Evidence: `.planning/ROADMAP.md:101-105`; `.planning/REQUIREMENTS.md:58-59`.

## Acceptance criteria

- [ ] AC1: `weight.mjs resident` returns, for a named command, its eager bytes
      (`SKILL.md` + `@`-includes) and its reachable bytes, and for a named role its
      dispatch bytes (agent file + preloaded contract skills). Run against
      `cad-land` and `cad-executor`, the numbers equal a hand sum of the same files
- [ ] AC2: The new subcommand has a CONTRACTS entry in `self-verify.mjs` and
      `self-verify` returns `ok:true`; removing the entry makes self-verify report
      it rather than passing
- [ ] AC3: `cad-land`'s eager resident bytes are below the mean of `cad-execute`,
      `cad-plan` and `cad-verify`, measured by AC1's command before and after, with
      both numbers committed
- [ ] AC4: `cad-plan-review`'s eager resident bytes drop by at least the 15,134 B
      `references/review-triggers.md` include, measured the same way
- [ ] AC5: A check reports zero references removed from an eager `@`-include
      without a Read instruction at the step that needs them, and `self-verify`
      returns `ok:true`
- [ ] AC6: `.planning/phases/2/MEASUREMENTS.md` holds before and after eager and
      reachable bytes for `cad-land`, `cad-plan-review`, `cad-execute`, `cad-plan`
      and `cad-verify`, plus dispatch bytes per role, with zero-resident references
      marked; re-running the recorded command reproduces the "after" bytes exactly
- [ ] AC7: ROADMAP phase 2's success criteria and REQUIREMENTS' `CTX-01` row read
      the re-scoped scope, `CTX-02` sits outside `### Active` with its deferral
      reason, and `/cad-audit` reports zero unserved Active requirements

## Flagged assumptions

- Whether a skill with `user-invocable: false` still contributes its `description`
  to the session system prompt - Unclear; host behaviour no file in this tree
  records. It does not bind this phase now that CTX-02 is deferred (no 7th skill
  ships), but it decides the cost of any future contract skill, and BUD-01's
  5,397 B total counting the six existing contract descriptions is an inference
  from a budget number rather than an observed fact
- The `weight-budgets.json` entry for `cadence-core/workflows/plan.md` reads 13874
  against an actual 13872 bytes - Confident, a script over all entries reports
  exactly this one mismatch. The check is a ceiling, so CI stays green while 2
  bytes of unaudited growth sit pre-approved. Harmless to this phase's numbers;
  if wrong, one manifest row is off by two bytes
- Deferring `references/review-triggers.md` out of `cad-land` costs one extra tool
  call at the step that reads it - Likely, on the break-even reasoning
  `cad-land/SKILL.md:84-92` already states for `git-publish.md`. If wrong, the
  deferral trades resident bytes for an extra TURN rather than an extra call, and
  the cut is not worth its latency on the commands that read the reference early
- Phase 1's growth figures still hold at plan time - Likely; `execute.md` grew
  19,340 -> 24,275 B and `cad-executor-contract` 10,891 -> 12,625 B during phase 1,
  so the "before" numbers must be taken at plan time rather than copied from
  phase 1's SUMMARY. If wrong, the before/after delta is measured against a
  baseline that no longer exists
