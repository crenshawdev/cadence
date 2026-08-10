# Context-weight sweep, 2026-08-10

Four parallel read-only sweeps over the plugin's eager surfaces. Nothing edited.
Every figure is measured (`weight.mjs`, `weight.mjs resident`, line-span scripts),
not estimated.

## Baseline

Shipped prose: 119,232 est tokens across 93 files.

| group | est tokens | files |
|---|---|---|
| workflows | 50,372 | 21 |
| references | 39,796 | 16 |
| skills | 22,693 | 29 |
| templates | 4,218 | 8 |
| agents | 2,153 | 19 |

Eager bytes per command (rides turn one and every turn after):

```
cad-execute   28,682   execute.md 27,940 + SKILL 742
cad-verify    24,533   verify.md 17,639 + templates/UAT.md 5,792 + SKILL 1,102
cad-plan      22,662   plan.md 21,814 + SKILL 848
cad-context   20,777   context.md 19,950 + SKILL 827
cad-config    20,547   config.md 19,256 + SKILL 1,291
cad-land      18,209   SKILL 11,488 + git-guard.md 6,721
```

**Frontmatter `description:` fields are not the problem.** All 29 skill
descriptions total 3,730 B (~930 tok); all 19 agent descriptions 1,619 B (~404
tok). One command's eager include outweighs the entire description surface by
7x, and descriptions are what make the model select the right command. Out of
scope for cuts.

## Free tier — no decision, no new files, no register work (~16,000 B)

| bytes | where | what |
|---|---|---|
| 5,792 | `skills/cad-verify/SKILL.md:29` | **Dead include.** `@`-includes `templates/UAT.md`; `verify.md` never names the template (all 8 "UAT.md" mentions are the runtime artifact `.planning/phases/<N>/UAT.md`), and `verify.md:352` says UAT.md is written ONLY through the uat seam, field order owned by `UAT_FIELDS`. The template is a renderer spec the model cannot act on. `CHANGELOG.md:475` justifies it as "consulted on every path, for the same reason" as `cad-help`'s COMMANDS.md — false: `cad-help`'s workflow *is* COMMANDS.md. Delete the line, keep the file, budget row unchanged. |
| ~2,900 tree-wide (~1,450 eager here) | `plan.md:182-189`, `context.md:122-144`, `execute.md:233-237`, `verify-deep.md:37-41`, `review-triggers.md:106-107` | The `--tokens` provenance paragraph, duplicated 5x. `context.md:122` claims to state it "once, for every bracket in this plugin" — already false four ways. Destination is `lib/trace.mjs`'s header (zero token cost); each site keeps one imperative sentence. |
| ~2,050 | `skills/cad-land/SKILL.md` | Guardrails bullet 1 re-derives the `git.auto_close` mechanic given 50 lines above (`:119-132`); three deferral-rationale tails (`:44-49`, `:93-97`, `:115-118`) are maintainer cost-model prose. Keep "No preselected publish default, ever." and the "NOT scoped to the GitHub arm" clause — both runtime-bound. |
| ~1,780 | `execute.md:96-104`, `:245-253`, `:1-11` | Lease-check placement justification; gitignore/scaffold archaeology; `<purpose>` duplicating `SKILL.md`'s `<objective>` in the same context (lines 8-10 describe a removed design). |
| ~1,713 | `context.md:128-144`, `:366-370`, `:9-11`, `:13-15` | Per-agent token figures + "read the three states apart"; clauses already in guardrails 413-421. |
| 990 | `verify.md:2-11`, `:84-89` | Purpose duplicating `SKILL.md`; the `fields_version` legacy paragraph, which is /cad-audit's and already lives twice on its surfaces. |
| 942 | `cad-planner-contract:167-175`, `cad-reviewer-contract:76-80`, `cad-plan-checker-contract:111-116` | `<success_criteria>` checklists restating their own contracts item-for-item. `conventions.md:141` scopes the section to workflows; executor/verifier/assumptions-analyzer contracts already ship without one. Cut reviewer's first (highest multiplier, easiest to reverse if compliance drops). |
| 606 | `cad-health:107-113`, `:103-105` | Membership-not-sort-order anti-regression note (move to a comment beside `lib/branch-decision.mjs`) and a `v2.4.0` regression anecdote. |
| 439 | `plan.md:8-10`, `:329-333` | Design-history contrast with a tool that isn't here; a paragraph verbatim already in `trace.test.mjs`. |
| 180 | `cad-executor-contract:44-46` | Static-analysis carve-out stated in full twice (also `:100-103`). |

## Blocked tier — gated on one decision (~22,300 B)

| bytes | where | move |
|---|---|---|
| 8,052 | `config.md:71-133` | Knob catalog + Type-key legend → `references/config-catalog.md`. One consult site; `--review` and direct-set (2 of 3 routes) never touch it. Takes /cad-config 20,547 → ~11,700 (-43%). |
| 4,050 | `plan.md:267-336` | BLOCKER revision branch → `references/plan-revision.md`. Costs a `BRACKETING` edit in `trace.test.mjs` (plan.md 4→2). |
| 3,430 | `execute.md:343-402` | `execute_parallel` body → `references/execute-parallel.md`. `choose_path` (120-171) stays eager — it decides the branch. |
| 2,594 | `cad-executor-contract:151-193` | `<worktree_mode>` → `references/worktree-executor.md`. Dead on a default install (`worktree.baseRef` defaults `fresh` → `parallelSafe:false`), yet paid by every executor dispatch. |
| 2,200 | `plan.md:100-121`,`:173-178`; `context.md:74-104` | Recall gate + `<recalled_memory>` render contract, near-verbatim in both → `references/recall.md`. `workflows/debug.md` is a third consumer. |
| 1,050 | `context.md:324-363` | CONTEXT.md output template → `templates/CONTEXT.md`, following how `plan.md` points cad-planner at `templates/PLAN.md`. Keep the one-line section list eager as the parse backstop. |
| 950 | `execute.md:316-335` | Worktree reconciliation remedy; travels with `execute_parallel`. Arguably a second consult site — take only the ~450 B of pure rationale if that reading is rejected. |

### The decision

`lib/deferred-reads.mjs` (self-verify check 13) is what keeps a deferral honest:
delete one Read sentence and the reference becomes unreachable with nothing
failing. Its coverage has two holes, and every cut above lands in one of them:

1. **`deferredReadIssues()` only opens `skills/<name>/SKILL.md`, and
   `regionLabels()` only labels regions under a top-level `^N. ` numbered step
   inside `<process>`.** Workflow files use `<step name="...">` tags and are
   themselves the `@`-include. `skills/cad-execute/SKILL.md` is a bare include
   with no numbered steps; `cad-verify`'s `<process>` is the single line
   "Execute end-to-end." A register row for a workflow-file deferral can never
   satisfy its anchor — adding one fails CI, omitting one leaves the deferral
   unwatched.
2. **Contract skills are explicitly out of scope** (`deferred-reads.mjs:40-44`).
   The stated reason is that dispatch prose "bytes never touch the main thread
   at all" — which prices main-thread residency and does not price subagent
   context. That is the argument to revisit, since a contract byte is paid on
   every dispatch of that role.

So: extend the register to anchor on workflow files and cover contract skills,
or ship these deferrals knowingly unguarded by CI. Three of four sweeps hit this
wall independently. It gates ~22,300 B of the ~38,000 B found.

## Constraints on any cut

- `weight-budgets.json` pins exact bytes per surface; **undershoot fails CI as
  hard as overrun**. Every cut needs a same-commit re-pin, and every new
  reference needs a new row (check 4 requires a row per measured surface).
- `trace.test.mjs`'s `BRACKETING` map pins dispatch-moment counts per file
  (plan.md 4, context.md 1) and asserts a non-empty `--read` on every dispatch.
  Moving a dispatch block edits that test in the same commit.
- Check 1's reverse arm (`inert-config-key`) requires every schema key to be
  referenced in prose somewhere. `references/` is walked, so *moving* the config
  catalog is safe; *deleting* rows would orphan `risk.override.<surface>` and the
  three `review.triggers.<t>.*` keys, which are named only in that table.
- Check 3: a new `${CLAUDE_PLUGIN_ROOT}/...` path must exist before the Read
  sentence lands. Check 10 (dispatch phrasing) applies in `references/` too, so
  concurrency sentences survive a move unchanged.
- `seams.md:240-243`: a new deferral's Read sentence must state the reference's
  measured bytes and consult-site count inline.
- Check 7 bans moving contract material into agent rung files. The rung files
  (407-519 B) are correctly at floor.

## Rejected — recorded so they are not re-derived

- **Cross-contract dedup is a mirage.** ~450 B is stated twice across
  `cad-reviewer-contract` and `cad-plan-checker-contract`, but a dispatch
  preloads exactly one — they never share a context. Factoring them out adds a
  Read round-trip to every dispatch to save ~200 B each: a net loss.
- **Deriving `config.md`'s catalog from the schema.** `config.mjs keys` dumps
  24,544 B (larger than the whole 19,256 B document) and carries no per-value
  explanation, which the walk requires as each option's `description`. The doc's
  own defense at `:61-70` is correct. The fix is residency, not derivation.
- **Extracting `cad-land` / `cad-health` to workflow files.** Saves zero eager
  bytes either way: `@`-included loads on turn one, and the process is consulted
  at every step so it cannot defer (`seams.md:235-237`). Hygiene argument only.
- **`git-guard.md`'s 6,721 B eager include in cad-land.** Correct as-is —
  consulted at steps 1, 2 and 3, and `seams.md:236-240` names this exact case.
- **Consolidating `execute.md`'s four per-arm `RE-READ triage-gate.md`
  sentences.** That is the defect `deferred-reads.mjs`'s header documents as
  reproduced, not theorised.
- **Skill/agent frontmatter descriptions.** 5,349 B total, load-bearing for
  command selection.

## Caveat on the dispatch multiplier

`execute.md:192-195` asserts the contract is the "stable, cached definition", so
on repeat dispatches within a session those bytes are prefix-cache reads, not
fresh input. The honest fresh-input multiplier is ~1.3x, not the raw ~4x; the
raw figure is the upper bound (cold cache, worktree/parallel batches where
prefixes diverge, dispatches past TTL).

## Defects found in passing (not cuts)

- `execute.md:241` names a step `start`; no such step exists (the `phase_start`
  line is appended in `git_guard`).
- `execute.md:36` resolves `workflow.test_command`, consumed only at `:369` on
  the parallel path — a sequential run resolves a key it never reads.
- `config-reach.md:136-138` names `workflows/execute.md` as the reach site for
  the three `parallelization.*` keys; deferring `execute_parallel` moves it.
- `seams.md:236-240` says `git-guard.md` is consulted "in its guardrails block",
  but cad-land's current guardrails cite no git-guard.

## Where phase 2's moved rationale landed (2026-08-10)

Every rationale block phase 2 removed from an eager surface is listed here with
its git-tracked destination. `design-notes/dd-*.md` is gitignored and is never a
destination (phase 2 D-21): a block that "moved" into one would satisfy the
rule on the working tree and violate it in the published repo.

| Removed from | What | Landed in |
|---|---|---|
| `workflows/context.md:122-144` | The `--tokens` provenance paragraph, the five measured per-agent figures, and the read-the-three-states-apart passage | `cadence-core/bin/lib/trace.mjs`, TOKEN PROVENANCE (the header's fourth named contract) |
| `workflows/{execute,plan,verify-deep}.md`, `references/review-triggers.md` | The same provenance, restated per site | same header - stated once for all six sites |
| `skills/cad-land/SKILL.md` steps 3, 4a, 4b | The per-arm turn-economics/cost-model tails behind each deferred Read | `cadence-core/bin/lib/deferred-reads.mjs`, THE BREAK-EVEN ARITHMETIC, beside the three rows that anchor those arms |
| `skills/cad-land/SKILL.md` `<guardrails>` | The re-derivation of the git-publish seam mechanic (sanctioned single push, subprocess push git-guard does not intercept, code-guarded non-protected-branch condition, PR -> merge -> reset) | No copy made, deliberately: `cadence-core/bin/git-publish.mjs:3-12,31-34` already states it at the code that enforces it. The `deferred-reads.mjs` note records the pointer instead. |
| `workflows/execute.md:1-11` | The `<purpose>` block's restatement of `skills/cad-execute/SKILL.md`'s `<objective>`, and its contrast with an orchestration apparatus (waves, worktree manifests, an end-of-phase gate pipeline) this tree does not have | Nowhere, deliberately: the objective rides the same context and states the guarantees, and the contrast describes a design Cadence never shipped. The one clause the objective does not carry - all worktree ceremony lives inside the opt-in branch - stays eager. |
| `workflows/execute.md:96-104` | Why the clean-starting-index check lives in the orchestrator and not in the executor's lease gate (`lease-check` has no provenance signal, so a gate placed there could only refuse the user's work or excuse an unknown path) | `cadence-core/bin/planning.mjs`, the `lease-check` header block, beside the D-01 hook-versus-seam reasoning it belongs with |
| `workflows/context.md:9-11` | The cost metaphor: "A clear codebase costs one confirmation tap; a murky one costs a few focused questions." | Nowhere, deliberately: it illustrates the adaptive-questioning rule stated one line above it and decides nothing at runtime. The rule it illustrates, and the judged-not-scored exit condition beside it, both stay eager. |
| `workflows/context.md:13-15` | The design history: "WHAT and HOW live in one document, not separate pre-plan gates; the slicing instinct survives as exactly one 'too big?' question near the end." | Nowhere, deliberately: its only runtime content is guardrail 3 in the same file ("Exactly one size question, near the end. No SPIDR, no story formats, no splitting frameworks"), which rides the same context. |
| `workflows/context.md:365-370` | The output contract's tail: that the durability filter split one Decisions section into two, and the no-audit-artifacts restatement ("No discussion log, no interview transcript, no ambiguity report") | Nowhere, deliberately: the five-section contract itself stays, and guardrail 2 in the same file already forbids the artifacts ("no DISCUSSION-LOG, no checkpoint JSON, no interview log, no ambiguity scores"). |
| `workflows/execute.md:244-248` | That `.planning/trace.jsonl` is gitignored, that `/cad-new-project` writes the line through `planning.mjs trace ignore` at scaffold time, and that `/cad-health` REPORTS a pre-seam scaffold rather than editing its `.gitignore` | `cadence-core/bin/planning.mjs`, the `cmdTraceIgnore` header - the seam that owns both arms. The runtime rule that a worktree executor emits no trace events of its own stays eager. |

Also closed here: the `seams.md:236-240` drift above, by DELETING the "and in
its guardrails block" clause rather than adding a `references/git-guard.md`
citation to cad-land's guardrails. Adding one would grow the surface this cycle
exists to shrink and insert a fourth consult site into a file whose deferral
arithmetic three register rows depend on; git-guard's eager justification
already survives on steps 1, 2 and 3 alone.

The other three CTW-05 drifts closed with the `execute.md` cut: the nonexistent
step `start` became `git_guard`; `workflow.test_command` left the `locate` batch
resolve and is now read at its only consumer, `execute_parallel` step 5, WITHOUT
being made to run on the sequential path (that is a behaviour change to the
default route and needs its own criterion, phase 2 D-17); and exactly one
`config-reach.md` reach cell moved, `parallelization.max_concurrent_agents`,
because `min_plans_for_parallel` and `use_worktrees` are read in `choose_path`,
which phase 3 keeps eager - rewriting all three would put two of them wrong.
