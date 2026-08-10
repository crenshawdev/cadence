---
phase: 2
status: complete
completed: 2026-08-10
---

# Phase 2: The free cuts - Summary

11,639 B of duplicated prose and dead includes left the eager path across six
commands, with no new file, no new register row and no new budget row, and all
four `CTW-05` drifts closed.

## What shipped

- The dead `@`-include of `cadence-core/templates/UAT.md` deleted from
  `skills/cad-verify/SKILL.md`; the template stays on disk as the seam's spec
  with its 5,792 B budget row unchanged
- Phase 1's one-row `WAIVED` bridge deleted from
  `cadence-core/bin/lib/include-consumers.mjs` in that same commit, its
  mechanism (`CODES.staleWaiver`, `CODES.expiredWaiver`, the `waived`
  parameter, the ROADMAP read) intact and `WAIVED.length === 0` asserted from
  both the lib test and the self-verify CLI test
- The `--tokens` provenance paragraph stated once, in
  `cadence-core/bin/lib/trace.mjs`'s header (a surface nothing weighs), with
  each of its six prose sites reduced to one imperative sentence carrying all
  three rules
- Per-surface cuts, one commit each with its `weight-budgets.json` and
  `docs/EVIDENCE.md` re-pin in the same commit: `skills/cad-land/SKILL.md`
  guardrails and three deferral tails, `workflows/execute.md`,
  `workflows/context.md`, `workflows/verify.md`, `workflows/plan.md`, the
  planner and reviewer contracts' `<success_criteria>` blocks, and
  `skills/cad-health/SKILL.md`'s maintainer cross-reference
- Moved rationale landed in git-tracked destinations - `lib/deferred-reads.mjs`
  (the cad-land break-even arithmetic), `lib/trace.mjs` (token provenance),
  `lib/branch-decision.mjs` (the cad-health tag-ordering note),
  `planning.mjs:1282-1288` (the `fields_version` argument, already complete
  there) - with a destination table recorded in
  `design-notes/sweep-2026-08-10-context-weight.md`
- All four `CTW-05` drifts closed: the nonexistent `start` step at
  `execute.md:241`, `workflow.test_command`'s misplaced resolve, the
  `config-reach.md` reach cell for the three `parallelization.*` keys, and
  `seams.md`'s claim of a git-guard consult in cad-land's guardrails

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 75f4aac | Delete the dead `templates/UAT.md` include and its waiver bridge |
| 1 | 2 | b5a4143 | State the `--tokens` provenance once, in `lib/trace.mjs`'s header |
| 1 | 3 | 064f49e | Trim `cad-land`'s guardrails and its three deferral tails |
| 1 | 4 | a5ec70b | Cut `execute.md`'s duplication and close its three drifts |
| 1 | 5 | f914dbe | Cut `context.md`'s duplicated purpose and output-contract prose |
| 1 | 6 | 0e9d24e | Cut `verify.md`'s duplicated purpose and the `fields_version` archaeology |
| 1 | 7 | 9ab56dd | Cut `plan.md`'s duplicated purpose and its design-history contrast |
| 1 | 8 | 49ba72e | Drop the planner and reviewer contracts' `success_criteria` blocks |
| 1 | 9 | 366771b | Move `cad-health`'s maintainer cross-reference into `branch-decision.mjs` |

Range `b3748a4..366771b`, 9 commits. Task 3 was committed as `4f7f07a` and
amended message-only to `064f49e` (see deviations); the tree is byte-identical
to the diff the risk-surface gate reviewed.

## Reviews fired

- **`risk_surface`** (blocking, task 3, artifact shape (c) - the flagged staged
  diff). Voice: `openai/gpt-5.6-terra` at tier `balanced`, effort `high`. One
  `blocker` raised, claiming the cut sentence "Every Bash `git push` still asks
  unconditionally; the seam is the only code-guarded unattended publish" was the
  only statement of that rule. Adjudicated dead: the rule survives operative on
  the eager path at `skills/cad-land/SKILL.md:113-118` ("do NOT fall back to a
  raw `git push`, which would hit the guard's unconditional ask", beside the
  seam's own sanctioned-single-push description), the blanket `No auto-push`
  guardrail still stands at `:169-172`, and the `deferred-reads.mjs` edit is
  comment-only. 0 survivors, gate PASS.
- **`diff`** (advisory, end of plan, artifact shape (a) - refs
  `b3748a4..HEAD`). Same voice. Two `high` findings, both on task 8's
  `<success_criteria>` deletions, both adjudicated dead: the planner items
  survive as imperatives at `cad-planner-contract` `<decision_fidelity>`:21-22,
  :27-31 and :123-125 ("an ID covered by no plan is a planning failure"); the
  reviewer items at `cad-reviewer-contract` `<returns>`:47-48 ("Return ONE JSON
  object and nothing else"), :67 and the `line`-is-an-integer rule at :63-64.
  0 survivors.

## Deviations

- [deviation] Task 1, D-02 (75f4aac): expected `weight.mjs resident` to report a
  fourth `zeroResident` entry for `templates/UAT.md` and `zeroResidentBytes`
  26,306 -> 32,098; observed the array unchanged at three entries / 26,306.
  Cause: `cadence-core/bin/lib/resident-weight.mjs:372-379` walks
  `cadence-core/references` only, never `templates/`. The template IS now
  reachable from no command (`/cad-verify` reachable 100,098 -> 94,253, exactly
  the 5,845 B removed) but the seam cannot report it. `docs/EVIDENCE.md`'s
  zero-resident table was left unchanged because it remains true as written and
  `prose-agreement.test.mjs:340-352` asserts it live. Task 1's own Verify clause
  is unmeetable as written; AC1 does not mention `zeroResident` and is satisfied.
- [deviation] Task 2 (b5a4143): `references/review-triggers.md` GREW 17,714 ->
  17,837 B rather than shrinking, because its site stated only two of the three
  rules and the one-sentence form adds the third. The file is eager for no
  command, so no turn-one figure rose; D-08's coupling re-stated the figure in
  `cad-land` and `cad-plan-review`, both byte-neutral.
- [deviation] Task 2: the six site sentences carry the three rules and no
  provenance clause, because the task's own AC4 check greps `cadence-core/` for
  "read off the HOST" expecting exactly one path - and `lib/trace.mjs` is itself
  under `cadence-core/`. The operational pointer survives at each site in the
  `<the token count on the subagent return>` placeholder.
- [deviation] Task 3 (064f49e): D-07's verify command failed on the first shape
  of the step-3 Read sentence - the `(?<=\.)\s` splitter put the byte figure in a
  separate sentence from the `Read`. All three arms were restructured to
  `Read <path> (<N> B, one consult site - <where>) ...`. The required phrase is
  literally "consult site", not "step".
- [deviation] Task 3: cutting the `(references/seams.md, File round-trip)`
  citations removed `seams.md` from `/cad-land`'s one-hop reachable set entirely
  (63,473 -> 43,787, of which 18,547 is seams.md leaving). Checked before
  accepting: `seams.md` is still reachable from seven other commands, so it did
  not go zero-resident and the EVIDENCE zero-resident table is unaffected.
- [deviation] Task 3: `git-publish.mjs:3-12` does not carry the
  `git.auto_close`-plus-non-protected-branch condition the plan attributed to it;
  that sits at `:31-34`. The `deferred-reads.mjs` note cites both spans.
- [deviation] Task 3, self-inflicted: the continuation dispatch's commit message
  stated `/cad-land` turn-one as "12,957 -> 11,890". Those figures were
  fabricated - they appear in no measurement, report row or plan line. The true
  pair is 18,209 -> 17,098. Caught during task 4's measurement, before any push;
  corrected by `git commit --amend` on the message only (4f7f07a -> 064f49e).
- [deviation] Task 4 (a5ec70b): the task's `grep -c 'clean worktree'
  execute.md` verify expected at least 1; observed 0 both before and after the
  edit, because the phrase is line-wrapped in the source. The runtime rule is
  intact at `execute.md:86-87`; substitute check `grep -c 'not merely a clean
  index'` prints 1.
- [deviation] Task 4: the task's `git diff -- config-reach.md | grep -c
  'min_plans_for_parallel\|use_worktrees'` expected 0; observed 2, both unchanged
  CONTEXT lines a bare grep over diff output counts. `--numstat` reports `1 1`
  and scoping to changed lines prints 0, so D-15 holds as stated.
- [deviation] Task 4: `docs/EVIDENCE.md`'s zero-resident table needed a re-pin
  the task did not name - `config-reach.md` is itself zero-resident, so its 26 B
  growth moved that row and its total (26,306 -> 26,332). CONTEXT D-04
  anticipated this; the task text listed four figures, not five.
- [deviation] Task 4: `.planning/DOCS-CLAIMS.md` row EXECUTE-06 claimed "the ten
  config keys in the single `config.mjs get`". D-17's move leaves nine, so the
  row's text was corrected alongside its span rather than only re-pointed.
- [deviation] Task 6 (0e9d24e): the task said to read `planning.mjs:1266-1320`
  and add what is missing. Observed NO gap - both halves of the cut passage were
  already stated in full at `:1282-1288`. Nothing was copied; a five-line pointer
  was added recording that this block is now the tree's only statement of the
  argument.
- [deviation] Task 7 (9ab56dd): cutting `plan.md:8-9` deleted the exact sentence
  `.planning/DOCS-CLAIMS.md` row PLAN-03 quotes ("4 flags, not ~20"), which no
  re-point can fix. The row is RETIRED in place (span `—`, resolution naming the
  v2.6.2 cut) rather than deleted. First retired row in the ledger.
- [deviation] Dispatch-wide: `planning.mjs detect-commands` returns
  `lint:null, typecheck:null` and no `workflow.lint_command` is set, so Cadence
  finds no static-analysis command here. Each task instead ran
  `npx tsc -p tsconfig.ci.json` (exit 0 at tasks 1, 4, 9).

## Open items

- Whether `zeroResident` should widen from `references/` to `references/` +
  `templates/` - a real seam question the D-02 deviation surfaced, with its own
  EVIDENCE-table consequences. Out of this phase's scope (no new check, no
  unleased file). File for the verify pass or a later cycle.
- `cadence-core/references/config-reach.md:133` still omits
  `workflows/execute.md` from `workflow.test_command`'s honouring sites even
  though `execute_parallel` names the key explicitly after task 4. Scoped out of
  AC5 by PLAN.md's Notes; now one grep away from being obviously wrong. Close in
  phase 3 or at the docs sweep.
- The measured eager saving is 11,639 B (280,684 -> 269,045 across the 23
  user-invocable commands) against the sweep's ~17,400 B estimate. CONTEXT's
  flagged assumption predicted the shortfall and named two causes (D-11 keeps
  ~200 B per `--tokens` site; D-18 makes one of three contract checklists
  uncuttable); a third appeared in execution - `review-triggers.md` and
  `config-reach.md` both GREW to state a rule correctly. No criterion pins a
  total. The recoverable bytes are in phase 3's deferrals.
- AC7's per-command UAT walk is the verifier's to write. The six commands this
  phase's commits touch are `/cad-verify`, `/cad-land`, `/cad-execute`,
  `/cad-plan`, `/cad-context` and `/cad-health`.

## Goal check

The nine commits plausibly deliver the phase goal, with one criterion met in
substance rather than in the number the goal names. The structural half is clean
and checkable: `git diff --diff-filter=A b3748a4..HEAD` lists no added file, and
`weight-budgets.json` holds 93 rows before and after with no key added or removed,
so "no new files and no new budget rows" is literal. The register half holds too -
`WAIVED.length` is 0 with the mechanism intact, and it went in 75f4aac alongside
the include, which is what criterion 1 required to keep `self-verify` off both
`include-waiver-stale` and `include-waiver-expired`. `grep -c 'templates/UAT.md'
skills/cad-verify/SKILL.md` is 0 while `cadence-core/templates/UAT.md` is still on
disk with its 5,792 B row untouched. All four CTW-05 drifts grep clean:
`grep -c 'in \`start\`' execute.md` 0 and `grep -c 'guardrails block' seams.md` 0,
with the `workflow.test_command` resolve and the `config-reach.md` reach cell
confirmed in a5ec70b's own verify run. `node --test cadence-core/bin/*.test.mjs`
passes 1516/1516 and `node cadence-core/bin/self-verify.mjs` returns `ok:true`
with `problems:[]` at HEAD, so every re-pin landed with the cut it belongs to.

What is short is the byte figure. The goal says "~17,400 B leaves the eager path";
the measured fall is 11,639 B (`docs/EVIDENCE.md` at b3748a4 line 66 pinned
280,684; the live `weight.mjs resident` sum over 23 commands is 269,045). That is
67% of the estimate, and the shortfall is explained rather than unaccounted:
CONTEXT flagged two causes in advance and execution found a third, all three named
in the open items. No success criterion pins a total, so this is not a failed
criterion - but a reader taking the phase headline at face value would be off by
~5,800 B, which is why it is recorded here and not smoothed over. Criterion 6's
per-command UAT walk is the only piece deliberately left for `/cad-verify`, and
criterion 4's "rationale that moves lands somewhere" is satisfied by four
git-tracked destinations plus one deliberate no-copy whose pointer is recorded in
`design-notes/sweep-2026-08-10-context-weight.md` - the `<guardrails>` seam
re-derivation, which `git-publish.mjs:3-12,31-34` already states at the code that
enforces it. Nothing looks missing that the open items do not already name.
